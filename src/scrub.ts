import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ScrubReportSchema, type MatterInsight, type ScrubReport } from "./schema.js";

const MODEL = "claude-opus-5";

/**
 * Stage B: adversarial re-identification check.
 *
 * This function is deliberately given ONLY the extracted insight. It never
 * receives the file id, the document, the filename, or the client name.
 *
 * That is the whole point. The threat model is "someone reads the published
 * article and works out whose case it was", and that reader does not have the
 * case file either. Showing this pass the source would let it reason from
 * information the attacker lacks, and it would rate the output safer than it
 * is. Keep the signature narrow so this cannot be widened by accident.
 */
const SCRUB_SYSTEM = `You are a privacy adversary reviewing a de-identified summary of a closed legal matter before it is used to write public content.

Your job is to find anything that could identify a party, a witness, or the specific matter. Assume the reader is motivated and has: public court dockets, local news archives, social media, obituaries, and knowledge of which firm published the content.

Flag as high severity:
- Any name, address, street, intersection, neighborhood, or city
- Any docket, case, claim, or policy number
- Any dollar amount
- Any date more precise than year and quarter
- Any employer, business, or institution identified specifically

Flag as medium severity:
- Distinctive details that narrow the field sharply on their own: an unusual injury or medical condition, a rare occupation, an unusual accident mechanism, an uncommon procedural history, reference to a locally notable event
- Small-population geography combined with any other specific

Flag as low severity:
- Detail that is safe alone but should be watched if the article accumulates more

Then reason about COMBINATIONS separately. Individually safe facts frequently identify someone together — a county with a small population, plus a quarter, plus an uncommon injury, is often a single identifiable person. This is the failure mode that matters most and the one field-by-field review misses.

Set the verdict:
- "blocked" if any high-severity finding exists, or if a motivated reader could identify the matter
- "needs_review" if only medium or low findings exist
- "clean" only if you found nothing and the combination analysis is negative

Be strict. A false positive costs an editor two minutes. A false negative is a confidentiality breach that ends a law firm's relationship with its client and exposes it to bar discipline.`;

export interface ScrubResult {
  report: ScrubReport;
  usage: { input_tokens: number; output_tokens: number };
}

export async function scrubInsight(
  client: Anthropic,
  insight: MatterInsight,
): Promise<ScrubResult> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: [
      { type: "text", text: SCRUB_SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    thinking: { type: "adaptive" },
    output_config: {
      format: zodOutputFormat(ScrubReportSchema),
      effort: "high",
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Review this extracted Matter Insight:\n\n${stableStringify(insight)}`,
          },
        ],
      },
    ],
  });

  if (!response.parsed_output) {
    // Fail closed. An unparseable scrub is not a pass.
    throw new Error(
      `Scrub did not return a parseable report (stop_reason: ${response.stop_reason}). Treating as blocked.`,
    );
  }

  return {
    report: response.parsed_output,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

/**
 * Key-sorted JSON. Two reasons: reruns over the same insight hit prompt cache
 * instead of writing a new entry, and stored insights hash stably for the
 * audit log.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}
