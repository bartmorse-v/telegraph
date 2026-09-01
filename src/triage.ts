import fs from "node:fs";
import path from "node:path";
import type { MatterInsight, RedactedNarrative, ScrubReport } from "./schema.js";

/**
 * Reads a finished run and reports what went wrong, safely.
 *
 * A blocked report cannot be shared to ask for help — the whole reason it is
 * blocked is that it contains identifiers. This prints shape instead of
 * content: which fields leaked, in what category, how many. Excerpts and the
 * scrub's reasoning are deliberately never printed, because both quote the
 * offending text.
 *
 *   npm run triage -- out/case_files
 */

function load<T>(dir: string, file: string): T {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) throw new Error(`Missing ${p} — has the run finished?`);
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

const words = (s: string): string[] => s.toLowerCase().match(/[a-z']+/g) ?? [];

/** Content words only — question scaffolding is shared by every angle. */
const STOP = new Set([
  "what", "when", "how", "why", "who", "does", "do", "did", "is", "are", "was",
  "were", "can", "could", "should", "would", "will", "the", "a", "an", "of",
  "to", "in", "on", "for", "and", "or", "my", "i", "me", "it", "that", "this",
  "if", "be", "have", "has", "at", "by", "with", "from", "as", "about",
]);

function overlap(a: string, b: string): number {
  const sa = new Set(words(a).filter((w) => !STOP.has(w)));
  const sb = new Set(words(b).filter((w) => !STOP.has(w)));
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const w of sa) if (sb.has(w)) shared += 1;
  return shared / Math.min(sa.size, sb.size);
}

function main(): void {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: npm run triage -- <out/folder>");
    process.exit(1);
  }

  const narrative = load<RedactedNarrative>(dir, "narrative.json");
  const insight = load<MatterInsight>(dir, "insight.json");
  const scrub = load<ScrubReport>(dir, "scrub.json");

  const wordCount = words(narrative.narrative).length;

  console.log(`\n== Narrative ==`);
  console.log(`  ${wordCount.toLocaleString()} words (target 3,000-8,000)`);
  if (wordCount > 8000) {
    console.log(`  OVER TARGET by ${Math.round((wordCount / 8000 - 1) * 100)}% — likely still transcribing rather than retelling.`);
  }

  // Tokens are the mechanism; if they are barely used, identifiers stayed put.
  const tokenHits = (narrative.narrative.match(/\[[A-Z_]+(?:_\d+)?\]/g) ?? []).length;
  console.log(`  ${tokenHits} redaction tokens used across the narrative`);
  if (tokenHits < 20) {
    console.log(`  LOW — a real matter should be dense with tokens. Suggests identifiers were kept instead of replaced.`);
  }

  console.log(`\n== Scrub: ${scrub.verdict.toUpperCase()} ==`);
  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byField: Record<string, number> = {};
  for (const f of scrub.findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
    // Strip array indices so 40 findings in one array group into one row.
    const field = f.field_path.replace(/\[\d+\]/g, "[]");
    byField[field] = (byField[field] ?? 0) + 1;
  }

  console.log(`  by severity:`);
  for (const [k, v] of Object.entries(bySeverity).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(v).padStart(4)}  ${k}`);
  }
  console.log(`  by category:`);
  for (const [k, v] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(v).padStart(4)}  ${k}`);
  }
  console.log(`  by field (where it leaked):`);
  for (const [k, v] of Object.entries(byField).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`    ${String(v).padStart(4)}  ${k}`);
  }
  console.log(
    `  combination risk: ${scrub.combination_risk.could_a_motivated_reader_identify_the_matter ? "YES" : "no"}`,
  );

  console.log(`\n== Angles ==`);
  const angles = insight.angle_inventory;
  const depths: Record<string, number> = {};
  for (const a of angles) depths[a.depth] = (depths[a.depth] ?? 0) + 1;
  console.log(`  ${angles.length} total (target 8-15)`);
  for (const [k, v] of Object.entries(depths)) console.log(`    ${String(v).padStart(4)}  ${k}`);

  // The question that decides whether the count means anything: are these
  // distinct questions, or one question asked many ways?
  const pairs: Array<[number, string, string]> = [];
  for (let i = 0; i < angles.length; i += 1) {
    for (let j = i + 1; j < angles.length; j += 1) {
      const a = angles[i];
      const b = angles[j];
      if (!a || !b) continue;
      const score = overlap(a.headline_question, b.headline_question);
      if (score >= 0.6) pairs.push([score, a.angle_id, b.angle_id]);
    }
  }
  pairs.sort((x, y) => y[0] - x[0]);

  const overlapping = new Set(pairs.flatMap(([, a, b]) => [a, b]));
  console.log(`  ${overlapping.size} angles share 60%+ of their content words with another`);
  if (pairs.length > 0) {
    console.log(`  closest pairs (angle ids only):`);
    for (const [score, a, b] of pairs.slice(0, 8)) {
      console.log(`    ${(score * 100).toFixed(0)}%  ${a}  ~  ${b}`);
    }
  }

  const distinct = angles.length - overlapping.size / 2;
  console.log(`\n  Rough distinct-question estimate: ~${Math.round(distinct)}`);
  console.log(`  (Word overlap only — it cannot see two different questions phrased alike,`);
  console.log(`   so treat this as a floor for duplication, not a verdict.)\n`);
}

main();
