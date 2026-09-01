// Loads .env if present, so the key can live in a file instead of being
// re-exported into every new shell. A missing .env is a no-op.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { redactCorpus, scanForPatterns, corpusText, writeCorpus } from "./redact";
import { buildProfile, type Usage } from "./extract";
import { reviewCorpus, stableStringify } from "./scrub";
import { createClient, explainError } from "./client";
import type { CorpusReview, MatterProfile, RedactedDocument } from "./schema";

/**
 *   npm run extract -- ~/matters/BC-0114/     (a folder = one matter)
 *
 * Produces a redacted corpus that is kept indefinitely, plus a small profile
 * over it. Articles are written later, from the corpus, choosing an angle
 * against a ledger of what has already been published.
 *
 * Exit codes:  0 clean   1 needs review   2 blocked   3 error
 */

const EXIT = { clean: 0, needsReview: 1, blocked: 2, error: 3 } as const;

/** Guards against pointing this at a whole document management system. */
const MAX_FILES = 40;

function collectMatterFiles(target: string): string[] {
  if (fs.statSync(target).isDirectory()) {
    return fs
      .readdirSync(target)
      .filter((f) => /\.pdf$/i.test(f) && !f.startsWith("."))
      .sort()
      .map((f) => path.join(target, f));
  }
  return [target];
}

async function main(): Promise<number> {
  const target = process.argv[2];
  if (!target) {
    console.error("usage: npm run extract -- <matter-folder-or-pdf>");
    return EXIT.error;
  }
  if (!fs.existsSync(target)) {
    console.error(`No such file or folder: ${target}`);
    return EXIT.error;
  }

  const files = collectMatterFiles(target);
  if (files.length === 0) {
    console.error(`No PDFs found in ${target}`);
    return EXIT.error;
  }
  if (files.length > MAX_FILES) {
    console.error(
      `${files.length} PDFs in ${target} — more than ${MAX_FILES}. That is usually a folder of matters rather than one matter; split it into a folder per matter.`,
    );
    return EXIT.error;
  }

  const totalMb = files.reduce((n, f) => n + fs.statSync(f).size, 0) / 1_000_000;
  const slug = path.basename(target).replace(/\.pdf$/i, "").replace(/[^a-z0-9-_]/gi, "_");
  const outDir = path.join("out", slug);
  fs.mkdirSync(outDir, { recursive: true });

  const client = createClient();

  console.log(
    `Redacting   ${files.length} document${files.length === 1 ? "" : "s"} · ${totalMb.toFixed(1)} MB · one call each, in parallel`,
  );
  for (const f of files) console.log(`            ${path.basename(f)}`);

  const { documents, usage: rUsage } = await redactCorpus(client, files, () =>
    process.stdout.write("."),
  );
  process.stdout.write("\n");
  writeCorpus(outDir, documents);
  console.log(`  ${logUsage(rUsage)}`);

  // Free and instant, so it runs before anything expensive.
  const text = corpusText(documents);
  const scan = scanForPatterns(text);
  console.log(
    `  ${words(text).toLocaleString()} words retained · ${scan.tokenCount} tokens substituted`,
  );
  if (!scan.clean) {
    console.log(`  pattern scan found:`);
    for (const h of scan.hits) console.log(`    ${String(h.count).padStart(4)}  ${h.kind}`);
  }

  console.log("Profiling   (index card over the corpus)");
  const { profile, usage: pUsage } = await buildProfile(client, documents);
  fs.writeFileSync(path.join(outDir, "profile.json"), stableStringify(profile));
  console.log(`  ${logUsage(pUsage)} · ${profile.themes.length} themes`);

  console.log("Reviewing   (did substitution actually happen?)");
  const { review, usage: vUsage } = await reviewCorpus(client, documents);
  fs.writeFileSync(path.join(outDir, "review.json"), stableStringify(review));
  console.log(`  ${logUsage(vUsage)}`);

  fs.writeFileSync(
    path.join(outDir, "report.md"),
    renderReport(files, documents, profile, review, scan.tokenCount, words(text)),
  );

  const counts = { high: 0, medium: 0, low: 0 };
  for (const f of review.findings) counts[f.severity] += 1;
  console.log(
    `\n${review.verdict.toUpperCase().replace("_", " ")}: ${counts.high} high, ${counts.medium} medium, ${counts.low} low`,
  );
  console.log(`Corpus in   ${outDir}/corpus/`);
  console.log(`Report      ${outDir}/report.md`);

  if (review.verdict === "blocked") return EXIT.blocked;
  if (review.verdict === "needs_review") return EXIT.needsReview;
  return EXIT.clean;
}

const logUsage = (u: Usage): string =>
  `in ${u.input_tokens.toLocaleString()} / out ${u.output_tokens.toLocaleString()}` +
  (u.cache_read_input_tokens ? ` / cached ${u.cache_read_input_tokens.toLocaleString()}` : "");

const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

function renderReport(
  sourceFiles: string[],
  documents: RedactedDocument[],
  profile: MatterProfile,
  review: CorpusReview,
  tokenCount: number,
  wordCount: number,
): string {
  const L: string[] = [];

  L.push(`# Matter review`, "");
  L.push(`- Source: ${sourceFiles.length} document${sourceFiles.length === 1 ? "" : "s"}`);
  L.push(`- Verdict: **${review.verdict}**`);
  L.push(`- Practice area: ${profile.practice_area}`);
  L.push(
    `- Jurisdiction: ${profile.jurisdiction.county || "—"}, ${profile.jurisdiction.state || "—"} (${profile.jurisdiction.court_level || "—"})`,
  );
  L.push(`- Period: ${profile.time_period.year || "—"} ${profile.time_period.quarter}`);
  L.push(`- Outcome: ${profile.outcome_category}`);
  L.push(`- Corpus retained: ${wordCount.toLocaleString()} words, ${tokenCount} substitutions`, "");

  L.push(`## Summary`, "", profile.summary, "");

  L.push(`## Themes`, "");
  L.push(`Subject areas the corpus covers. Articles are chosen from these later,`);
  L.push(`against a ledger of what has already been published.`, "");
  for (const t of profile.themes) L.push(`- ${t}`);
  if (!profile.themes.length) L.push("- (none identified)");
  L.push("");

  L.push(`## Documents`, "");
  documents.forEach((d, i) => {
    L.push(`${i + 1}. **${d.document_type}** — ${words(d.content).toLocaleString()} words`);
    if (d.illegible_sections.length) {
      L.push(`   illegible: ${d.illegible_sections.join("; ")}`);
    }
  });
  L.push("");

  L.push(`## Redaction findings`, "");
  L.push(`Identifiers that survived substitution. Described, never quoted.`, "");
  if (review.findings.length === 0) {
    L.push("None.", "");
  } else {
    for (const f of review.findings) {
      L.push(
        `- **${f.severity.toUpperCase()}** · doc ${f.document_index} · ${f.category} — ${f.what_survived} (should be \`${f.suggested_token}\`)`,
      );
    }
    L.push("");
  }

  L.push(`## Substitution quality`, "", review.substitution_quality, "");

  L.push(`## Not assessed here`, "");
  L.push(
    `Whether a motivated reader could identify this matter is a question about a`,
  );
  L.push(
    `published article, not about the vault — a complete case file is always`,
  );
  L.push(`identifiable to someone holding it. That check runs before publishing.`, "");

  return L.join("\n");
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(`\n${explainError(err)}`);
    process.exit(EXIT.error);
  });
