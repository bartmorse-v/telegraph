import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { CorpusReviewSchema, type CorpusReview, type RedactedDocument } from "./schema";
import { finishOrExplain, type Usage } from "./extract";

const MODEL = "claude-opus-5";

/**
 * Asks one narrow question: did any identifier survive substitution?
 *
 * Not whether a motivated reader could work out whose matter this is. That is a
 * question about a published article — what a reader would actually see — and
 * it is answered at publish time, where it can be answered properly. Asking it
 * of a full corpus produces a permanent "blocked" that means nothing, because a
 * complete case file is always identifiable to someone holding the case file.
 *
 * Findings describe what was missed; they never quote it. That keeps the review
 * shareable when the corpus is not.
 */
const REVIEW_SYSTEM = `You are checking whether a redaction pass over legal documents actually worked.

You are looking for identifiers that survived substitution: a person or company named where a token should be, an address, a specific date, a dollar figure, a docket or account number, a phone number or email.

Look first for a recorded mapping — a key, legend, glossary or redaction note that shows what a token replaced, in any form: "1234567890 -> [CASE_NUMBER]", "[PARTY_1] (formerly Jane Smith)", a table pairing tokens with originals. That is always high severity, however brief and wherever it sits, because one such line reverses the redaction everywhere that token appears and the documents share their tokens. It is the single worst thing that can be in here.

Watch for names carried through as defined short forms. A document that introduces a party once and then uses a surname, an acronym, or an initialism as shorthand has leaked that name onto every page that follows, even though the introduction was replaced.

Do NOT flag:
- County, state, or court level — these are kept deliberately
- Statutes, rules, regulations, published case citations
- Procedural terms, deadlines, standards of review
- Generic role words: the plaintiff, the insurer, the treating physician
- Tokens themselves

Describe what you find; never quote it. Say "a company name appears in the jurisdiction section" rather than reproducing the name — this report has to remain shareable when the documents are not.

Also judge substitution quality: were tokens used consistently within a document AND across the set — one token meaning one person or company throughout — and was anything summarized that should have been reproduced in full? A pass that quietly condensed the documents has failed even if no identifier survived. Note that only certificates of service, signature blocks, tables of authorities and repeated caption headers may be compressed; a section replaced by a note saying it matches an earlier one has been lost.

Verdict: "blocked" if any high-severity identifier survived, "needs_review" for medium or low only, "clean" if substitution held throughout.`;

export interface ReviewResult {
  review: CorpusReview;
  usage: Usage;
}

export async function reviewCorpus(
  client: Anthropic,
  documents: RedactedDocument[],
): Promise<ReviewResult> {
  const corpus = documents
    .map((d, i) => `## Document ${i + 1} — ${d.document_type}\n\n${d.content}`)
    .join("\n\n");

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system: [{ type: "text", text: REVIEW_SYSTEM, cache_control: { type: "ephemeral" } }],
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(CorpusReviewSchema), effort: "high" },
    messages: [{ role: "user", content: [{ type: "text", text: corpus }] }],
  });

  let chars = 0;
  stream.on("text", (t) => {
    chars += t.length;
  });
  const response = await finishOrExplain(stream, () => chars);

  if (!response.parsed_output) {
    // Fail closed. An unparseable review is not a pass.
    throw new Error(
      `Review returned nothing parseable (stop_reason: ${response.stop_reason}). Treating as blocked.`,
    );
  }

  return {
    review: response.parsed_output,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? null,
    },
  };
}

/** Key-sorted JSON, so stored artifacts hash stably for the audit log. */
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
