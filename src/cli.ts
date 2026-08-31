import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { redactDocument, buildInsight, type Usage } from "./extract.js";
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

async function main(): Promise<number> {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("usage: npm run extract -- <path-to-pdf>");
    return EXIT.error;
  }
  if (!fs.existsSync(pdfPath)) {
    console.error(`No such file: ${pdfPath}`);
    return EXIT.error;
  }

  const slug = path.basename(pdfPath).replace(/\.pdf$/i, "").replace(/[^a-z0-9-_]/gi, "_");
  const outDir = path.join("out", slug);
  fs.mkdirSync(outDir, { recursive: true });

  const client = new Anthropic();

  // Deliberately generic. A filename like "Delgado-v-Progressive.pdf" would
  // leak two party names into the prompt before redaction even begins.
  const documentLabel = "Closed matter file";

  console.log(`Redacting   ${pdfPath}`);
  const { narrative, usage: rUsage } = await redactDocument(client, pdfPath, documentLabel);
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

  fs.writeFileSync(path.join(outDir, "report.md"), renderReport(pdfPath, narrative, insight, report));

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
  sourcePath: string,
  narrative: RedactedNarrative,
  insight: MatterInsight,
  report: ScrubReport,
): string {
  const L: string[] = [];

  L.push(`# Matter review`, "");
  L.push(`- Source: \`${path.basename(sourcePath)}\``);
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
