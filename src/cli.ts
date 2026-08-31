// Loads .env if present, so the key can live in a file instead of being
// re-exported into every new shell. A missing .env is a no-op.
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { redactMatter, buildInsight, type Usage } from "./extract.js";
import { scrubMatter, stableStringify } from "./scrub.js";
import type { MatterInsight, RedactedNarrative, ScrubReport } from "./schema.js";

/**
 * v1 is a local CLI on purpose. It answers the only question that matters
 * right now — does the pipeline produce something both safe and re-mineable —
 * without committing to any hosting decision.
 *
 *   npm run extract -- ./samples/matter-01.pdf
 *
 * Exit codes:  0 clean   1 needs review   2 blocked   3 error
 */

const EXIT = { clean: 0, needsReview: 1, blocked: 2, error: 3 } as const;

/** Guards against pointing this at a whole document management system. */
const MAX_FILES = 40;

/**
 * One matter in, one matter out. A directory is a matter whose documents are
 * read together; a lone PDF is a single-document matter. Files are sorted so
 * reruns produce the same prompt and hit cache.
 */
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

  const client = new Anthropic();

  console.log(
    `Redacting   ${files.length} document${files.length === 1 ? "" : "s"} · ${totalMb.toFixed(1)} MB · read as one matter`,
  );
  for (const f of files) console.log(`            ${path.basename(f)}`);
  const { narrative, usage: rUsage } = await redactMatter(client, files);
  fs.writeFileSync(path.join(outDir, "narrative.json"), stableStringify(narrative));
  console.log(`  ${logUsage(rUsage)} · ${wordCount(narrative.narrative)} words retold`);

  console.log("Indexing    (angle inventory)");
  const { insight, usage: iUsage } = await buildInsight(client, narrative);
  fs.writeFileSync(path.join(outDir, "insight.json"), stableStringify(insight));
  console.log(`  ${logUsage(iUsage)} · ${insight.angle_inventory.length} angles found`);

  console.log("Scrubbing   (adversarial re-identification check)");
  const { report, usage: sUsage } = await scrubMatter(client, { narrative, insight });
  fs.writeFileSync(path.join(outDir, "scrub.json"), stableStringify(report));
  console.log(`  ${logUsage(sUsage)}`);

  fs.writeFileSync(path.join(outDir, "report.md"), renderReport(files, narrative, insight, report));

  console.log(`\n${summarize(insight, report)}`);
  console.log(`Written to  ${outDir}/`);

  if (report.verdict === "blocked") return EXIT.blocked;
  if (report.verdict === "needs_review") return EXIT.needsReview;
  return EXIT.clean;
}

const logUsage = (u: Usage): string =>
  `in ${u.input_tokens} / out ${u.output_tokens}` +
  (u.cache_read_input_tokens !== null ? ` / cached ${u.cache_read_input_tokens}` : "");

const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

function summarize(insight: MatterInsight, report: ScrubReport): string {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const f of report.findings) counts[f.severity] += 1;
  const combo = report.combination_risk.could_a_motivated_reader_identify_the_matter
    ? " — combination risk flagged"
    : "";
  const pillars = insight.angle_inventory.filter((a) => a.depth === "pillar").length;
  return (
    `${report.verdict.toUpperCase().replace("_", " ")}: ` +
    `${counts.high} high, ${counts.medium} medium, ${counts.low} low${combo}\n` +
    `${insight.angle_inventory.length} article angles (${pillars} pillar)`
  );
}

/** What a human editor actually reads. */
function renderReport(
  sourceFiles: string[],
  narrative: RedactedNarrative,
  insight: MatterInsight,
  report: ScrubReport,
): string {
  const L: string[] = [];

  L.push(`# Matter review`, "");
  L.push(`- Source: ${sourceFiles.length} document${sourceFiles.length === 1 ? "" : "s"}, read as one matter`);
  L.push(`- Verdict: **${report.verdict}**`);
  L.push(`- Practice area: ${insight.practice_area}`);
  L.push(
    `- Jurisdiction: ${insight.jurisdiction.county || "—"}, ${insight.jurisdiction.state || "—"} (${insight.jurisdiction.court_level || "—"})`,
  );
  L.push(`- Period: ${insight.time_period.year || "—"} ${insight.time_period.quarter}`);
  L.push(`- Outcome: ${insight.outcome_category}`);
  L.push(`- Narrative retained: ${wordCount(narrative.narrative)} words`);
  L.push(`- Source quality: ${narrative.source_quality}`, "");

  L.push(`## Article angles (${insight.angle_inventory.length})`, "");
  L.push(`How many publishable pieces this one matter supports.`, "");
  for (const a of insight.angle_inventory) {
    L.push(`### ${a.headline_question}`);
    L.push(`\`${a.angle_id}\` · **${a.depth}** · for ${a.reader_situation}`, "");
    L.push(a.supporting_insight);
    if (a.legal_authorities.length) L.push("", `Authority: ${a.legal_authorities.join("; ")}`);
    if (a.local_hooks.length) L.push("", `Local: ${a.local_hooks.join("; ")}`);
    L.push("");
  }

  L.push(`## Re-identification findings`, "");
  if (report.findings.length === 0) {
    L.push("None.", "");
  } else {
    for (const f of report.findings) {
      L.push(`### ${f.severity.toUpperCase()} — ${f.category}`);
      L.push(`- Field: \`${f.field_path}\``);
      L.push(`- Text: "${f.excerpt}"`);
      L.push(`- Why: ${f.reasoning}`);
      L.push(`- Fix: ${f.suggested_replacement ? `"${f.suggested_replacement}"` : "delete — no safe rewrite"}`);
      L.push("");
    }
  }

  L.push(`## Combination risk`, "");
  L.push(
    `Identifiable by a motivated reader: **${report.combination_risk.could_a_motivated_reader_identify_the_matter ? "yes" : "no"}**`,
    "",
  );
  L.push(report.combination_risk.reasoning);
  if (report.combination_risk.riskiest_combination) {
    L.push("", `Riskiest combination: ${report.combination_risk.riskiest_combination}`);
  }
  L.push("");

  L.push(`## Client questions`, "");
  for (const q of insight.client_questions) {
    L.push(`- **${q.question}**${q.what_they_assumed ? ` — assumed: ${q.what_they_assumed}` : ""}`);
  }
  if (!insight.client_questions.length) L.push("- (none extracted)");
  L.push("");

  L.push(`## Non-obvious moves`, "");
  for (const m of insight.non_obvious_moves) L.push(`- **${m.move}** — ${m.why_it_mattered}`);
  if (!insight.non_obvious_moves.length) L.push("- (none extracted)");
  L.push("");

  if (narrative.gaps.length || insight.low_confidence_areas.length) {
    L.push(`## Gaps and low confidence`, "");
    for (const g of [...narrative.gaps, ...insight.low_confidence_areas]) L.push(`- ${g}`);
    L.push("");
  }

  return L.join("\n");
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(EXIT.error);
  });
