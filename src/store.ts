import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { CorpusReview, MatterProfile, RedactedDocument } from "./schema";

/**
 * Filesystem store, deliberately.
 *
 * The corpus is privileged material, so it lives on the machine the firm's
 * files were already on rather than in infrastructure nobody has agreed to yet.
 * Every read and write goes through here, so replacing it with Postgres and
 * object storage later means changing this file and nothing else.
 */

const ROOT = path.join(process.cwd(), "data", "matters");

export type MatterStatus =
  | "attested"
  | "processing"
  | "ready"
  | "needs_review"
  | "blocked"
  | "failed";

export interface Attestation {
  attestedBy: string;
  barNumber: string;
  at: string;
  confirmations: {
    closed: boolean;
    noProtectiveOrder: boolean;
    noConfidentialityClause: boolean;
    notOnAppeal: boolean;
    authorized: boolean;
  };
}

export interface MatterMeta {
  id: string;
  reference: string;
  createdAt: string;
  status: MatterStatus;
  attestation: Attestation;
  sourceCount: number;
  /** Names are kept for the audit trail only; they never reach a prompt. */
  sourceNames: string[];
  error?: string;
  processedAt?: string;
}

export type ArticleStatus = "draft" | "approved" | "rejected";

export interface Article {
  id: string;
  matterId: string;
  angleId: string;
  headline: string;
  readerSituation: string;
  answerBlock: string;
  body: string;
  status: ArticleStatus;
  createdAt: string;
  gate: GateResult;
  approvedBy?: string;
  approvedAt?: string;
  rejectionNote?: string;
}

export interface GateResult {
  verdict: "pass" | "flag" | "block";
  checks: Array<{
    name: string;
    passed: boolean;
    severity: "info" | "warn" | "block";
    detail: string;
  }>;
}

const id = (): string => crypto.randomUUID().slice(0, 8);
const dir = (matterId: string): string => path.join(ROOT, matterId);

function readJson<T>(p: string): T | null {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

function writeJson(p: string, value: unknown): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value, null, 2));
}

/* ---------------------------------------------------------------- */
/* Matters                                                           */
/* ---------------------------------------------------------------- */

export function createMatter(
  reference: string,
  attestation: Attestation,
  sourceNames: string[],
): MatterMeta {
  const meta: MatterMeta = {
    id: id(),
    reference,
    createdAt: new Date().toISOString(),
    status: "attested",
    attestation,
    sourceCount: sourceNames.length,
    sourceNames,
  };
  writeJson(path.join(dir(meta.id), "meta.json"), meta);
  return meta;
}

export function listMatters(): MatterMeta[] {
  if (!fs.existsSync(ROOT)) return [];
  return fs
    .readdirSync(ROOT)
    .map((d) => readJson<MatterMeta>(path.join(ROOT, d, "meta.json")))
    .filter((m): m is MatterMeta => m !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const getMatter = (matterId: string): MatterMeta | null =>
  readJson<MatterMeta>(path.join(dir(matterId), "meta.json"));

export function updateMatter(matterId: string, patch: Partial<MatterMeta>): MatterMeta {
  const current = getMatter(matterId);
  if (!current) throw new Error(`No matter ${matterId}`);
  const next = { ...current, ...patch };
  writeJson(path.join(dir(matterId), "meta.json"), next);
  return next;
}

/* ---------------------------------------------------------------- */
/* Corpus, profile, review                                           */
/* ---------------------------------------------------------------- */

export function saveCorpus(matterId: string, documents: RedactedDocument[]): void {
  const corpusDir = path.join(dir(matterId), "corpus");
  fs.rmSync(corpusDir, { recursive: true, force: true });
  fs.mkdirSync(corpusDir, { recursive: true });
  documents.forEach((d, i) => {
    writeJson(path.join(corpusDir, `${String(i + 1).padStart(2, "0")}.json`), d);
  });
}

export function getCorpus(matterId: string): RedactedDocument[] {
  const corpusDir = path.join(dir(matterId), "corpus");
  if (!fs.existsSync(corpusDir)) return [];
  return fs
    .readdirSync(corpusDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson<RedactedDocument>(path.join(corpusDir, f)))
    .filter((d): d is RedactedDocument => d !== null);
}

export const saveProfile = (matterId: string, profile: MatterProfile): void =>
  writeJson(path.join(dir(matterId), "profile.json"), profile);

export const getProfile = (matterId: string): MatterProfile | null =>
  readJson<MatterProfile>(path.join(dir(matterId), "profile.json"));

export const saveReview = (matterId: string, review: CorpusReview): void =>
  writeJson(path.join(dir(matterId), "review.json"), review);

export const getReview = (matterId: string): CorpusReview | null =>
  readJson<CorpusReview>(path.join(dir(matterId), "review.json"));

/* ---------------------------------------------------------------- */
/* Articles — and the ledger they form                               */
/* ---------------------------------------------------------------- */

export function saveArticle(article: Article): void {
  writeJson(path.join(dir(article.matterId), "articles", `${article.id}.json`), article);
}

export function getArticles(matterId: string): Article[] {
  const articlesDir = path.join(dir(matterId), "articles");
  if (!fs.existsSync(articlesDir)) return [];
  return fs
    .readdirSync(articlesDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<Article>(path.join(articlesDir, f)))
    .filter((a): a is Article => a !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getArticle(articleId: string): Article | null {
  for (const m of listMatters()) {
    const p = path.join(dir(m.id), "articles", `${articleId}.json`);
    const found = readJson<Article>(p);
    if (found) return found;
  }
  return null;
}

export function allArticles(): Article[] {
  return listMatters()
    .flatMap((m) => getArticles(m.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const newArticleId = id;

/**
 * The ledger: what has already been written from this matter.
 *
 * This is the whole mechanism for avoiding duplicate angles. Rather than
 * predicting every article a matter could support — which produced 54
 * near-identical guesses — the writer is shown what exists and asked for
 * something that is not on the list. Rejected articles stay on it, because
 * their angle was still spent.
 */
export function angleLedger(matterId: string): Array<{ angleId: string; headline: string; status: ArticleStatus }> {
  return getArticles(matterId).map((a) => ({
    angleId: a.angleId,
    headline: a.headline,
    status: a.status,
  }));
}
