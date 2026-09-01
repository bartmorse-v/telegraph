import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MatterProfileSchema, type MatterProfile, type RedactedDocument } from "./schema.js";

const MODEL = "claude-opus-5";

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number | null;
}

/**
 * The SDK parses structured output inside finalMessage(), so a response cut off
 * at max_tokens surfaces as a JSON syntax error with no stop_reason to inspect.
 * Translate it, since "unterminated string" says nothing about the actual cause.
 */
export async function finishOrExplain<T>(
  stream: { finalMessage(): Promise<T> },
  // A getter, not a number: the count is still zero when this is called and
  // only grows while finalMessage() is awaited.
  charsSoFar: () => number,
): Promise<T> {
  try {
    return await stream.finalMessage();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/parse structured output/i.test(message)) {
      throw new Error(
        `The model hit its output ceiling after about ${charsSoFar().toLocaleString()} characters and was cut off mid-sentence, so the result could not be parsed.\n\n` +
          `A single document this long may need splitting before it can be processed.`,
      );
    }
    throw err;
  }
}

/**
 * Reads the redacted corpus and writes the index card. Never touches the source.
 *
 * Small on purpose. The corpus is the thing you write from; this exists so a
 * person can find the right matter in a list and so the angle picker knows what
 * subjects are in here worth searching.
 */
const PROFILE_SYSTEM = `You are indexing an already-redacted legal matter so it can be found and searched later.

Produce a short profile. The corpus itself is the source of truth and stays available — you are writing the index card, not replacing it.

The summary is for someone scanning a list of matters. Under 200 words, plain language, no legal jargon where ordinary words work.

Themes are subject areas the corpus genuinely covers, not article ideas. "Medical lien negotiation" is a theme. "How do liens affect what I take home?" is an article headline — do not write those here. List only what the documents actually address; do not pad with topics a matter of this type usually involves but this one does not.

The corpus is already tokenized. Carry no identifiers forward. County, state, court level, and public legal authority are safe and should be precise.`;

export async function buildProfile(
  client: Anthropic,
  documents: RedactedDocument[],
): Promise<{ profile: MatterProfile; usage: Usage }> {
  const corpus = documents
    .map((d, i) => `## Document ${i + 1} — ${d.document_type}\n\n${d.content}`)
    .join("\n\n");

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: [{ type: "text", text: PROFILE_SYSTEM, cache_control: { type: "ephemeral" } }],
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(MatterProfileSchema), effort: "high" },
    messages: [{ role: "user", content: [{ type: "text", text: corpus }] }],
  });

  let chars = 0;
  stream.on("text", (t) => {
    chars += t.length;
  });
  const response = await finishOrExplain(stream, () => chars);

  if (!response.parsed_output) {
    throw new Error(`Profile returned nothing parseable (stop_reason: ${response.stop_reason}).`);
  }
  return {
    profile: response.parsed_output,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? null,
    },
  };
}
