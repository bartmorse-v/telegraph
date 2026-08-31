import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { extractInsight } from "./extract.js";
import { scrubInsight, stableStringify } from "./scrub.js";
import type { MatterInsight, ScrubReport } from "./schema.js";

/**
 * v1 is a local CLI on purpose. It answers the only question that matters
 * right now — does extraction plus scrubbing actually produce something safe
 * and useful — without committing to any hosting decision. Storage, queueing,
 * and multi-tenancy come after this is proven on real documents.
 *
 *   npm run extract -- ./samples/matter-01.pdf
 *
 * Exit codes are meaningful so this can later be a pipeline step:
 *   0 clean   1 needs review   2 blocked   3 error
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

  // The label is what the model sees as the document title. Deliberately
  // generic — a filename like "Delgado-v-Progressive.pdf" would leak two party
  // names into the prompt before extraction even starts.
  const documentLabel = "Closed matter file";

  console.log(`Extracting  ${pdfPath}`);
  const { insight, usage: exUsage } = await extractInsight(client, pdfPath, documentLabel);
  fs.writeFileSync(path.join(outDir, "insight.json"), stableStringify(insight));
  console.log(
    `  in ${exUsage.input_tokens} tok / out ${exUsage.output_tokens} tok` +
      (exUsage.cache_read_input_tokens !== null
        ? ` / cache read ${exUsage.cache_read_input_tokens}`
        : ""),
  );

  console.log("Scrubbing   (adversarial re-identification check)");
  const { report, usage: scUsage } = await scrubInsight(client, insight);
  fs.writeFileSync(path.join(outDir, "scrub.json"), stableStringify(report));
  console.log(`  in ${scUsage.input_tokens} tok / out ${scUsage.output_tokens} tok`);

  const markdown = renderReport(pdfPath, insight, report);
  fs.writeFileSync(path.join(outDir, "report.md"), markdown);

  console.log(`\n${summarize(report)}`);
  console.log(`Written to  ${outDir}/`);

  if (report.verdict === "blocked") return EXIT.blocked;
  if (report.verdict === "needs_review") return EXIT.needsReview;
  return EXIT.clean;
}

function summarize(report: ScrubReport): string {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const f of report.findings) counts[f.severity] += 1;
  const verdict = report.verdict.toUpperCase().replace("_", " ");
  const combo = report.combination_risk.could_a_motivated_reader_identify_the_matter
    ? " — combination risk flagged"
    : "";
  return `${verdict}: ${counts.high} high, ${counts.medium} medium, ${counts.low} low${combo}`;
}

/** Human-readable output. This is what an editor actually reads. */
function renderReport(
  sourcePath: string,
  insight: MatterInsight,
  report: ScrubReport,
): string {
  const lines: string[] = [];

  lines.push(`# Matter Insight review`);
  lines.push("");
  lines.push(`- Source: \`${path.basename(sourcePath)}\``);
  lines.push(`- Verdict: **${report.verdict}**`);
  lines.push(`- Practice area: ${insight.practice_area}`);
  lines.push(
    `- Jurisdiction: ${insight.jurisdiction.county || "—"}, ${insight.jurisdiction.state || "—"} (${insight.jurisdiction.court_level || "—"})`,
  );
  lines.push(`- Period: ${insight.time_period.year || "—"} ${insight.time_period.quarter}`);
  lines.push(`- Outcome: ${insight.outcome_category}`);
  lines.push(`- Document quality: ${insight.document_quality}`);
  lines.push("");

  lines.push(`## Re-identification findings`);
  lines.push("");
  if (report.findings.length === 0) {
    lines.push("None.");
  } else {
    for (const f of report.findings) {
      lines.push(`### ${f.severity.toUpperCase()} — ${f.category}`);
      lines.push(`- Field: \`${f.field_path}\``);
      lines.push(`- Text: "${f.excerpt}"`);
      lines.push(`- Why: ${f.reasoning}`);
      lines.push(
        `- Fix: ${f.suggested_replacement ? `"${f.suggested_replacement}"` : "delete — no safe rewrite"}`,
      );
      lines.push("");
    }
  }

  lines.push(`## Combination risk`);
  lines.push("");
  lines.push(
    `Identifiable by a motivated reader: **${report.combination_risk.could_a_motivated_reader_identify_the_matter ? "yes" : "no"}**`,
  );
  lines.push("");
  lines.push(report.combination_risk.reasoning);
  if (report.combination_risk.riskiest_combination) {
    lines.push("");
    lines.push(`Riskiest combination: ${report.combination_risk.riskiest_combination}`);
  }
  lines.push("");

  lines.push(`## Editorial value`);
  lines.push("");
  lines.push(`**Client questions** — the highest-value output for content planning.`);
  lines.push("");
  for (const q of insight.client_questions) lines.push(`- ${q.question}`);
  if (insight.client_questions.length === 0) lines.push("- (none extracted)");
  lines.push("");
  lines.push(`**Local specifics** — what makes geo content defensible rather than doorway pages.`);
  lines.push("");
  for (const l of insight.local_specifics) lines.push(`- [${l.category}] ${l.detail}`);
  if (insight.local_specifics.length === 0) lines.push("- (none extracted)");
  lines.push("");
  lines.push(`**Content angles**`);
  lines.push("");
  for (const a of insight.content_angles) lines.push(`- ${a.angle} — for ${a.target_reader}`);
  if (insight.content_angles.length === 0) lines.push("- (none extracted)");
  lines.push("");

  if (insight.low_confidence_areas.length > 0) {
    lines.push(`## Low confidence`);
    lines.push("");
    for (const a of insight.low_confidence_areas) lines.push(`- ${a}`);
    lines.push("");
  }

  return lines.join("\n");
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(EXIT.error);
  });
