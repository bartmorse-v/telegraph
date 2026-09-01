import { z } from "zod";

/**
 * The corpus is the product.
 *
 * Redaction reproduces each document with identifiers replaced and nothing else
 * changed. The result is kept indefinitely: it is what every future article is
 * written from, and it can be re-read with a new question any number of times.
 *
 * Nothing here enumerates article angles. An earlier version asked the model to
 * predict them up front and it produced 54 for a single matter, most of them
 * the same few questions reworded. Angles are chosen at writing time instead,
 * against a ledger of what has already been published — which cannot duplicate,
 * because it can see what exists.
 */

/* ------------------------------------------------------------------ */
/* Redacted document — one per source file                             */
/* ------------------------------------------------------------------ */

export const RedactedDocumentSchema = z.object({
  schema_version: z.literal("1.0"),
  document_type: z
    .string()
    .describe(
      "What this document is, generically: 'answer', 'brief in support of motion', 'settlement agreement', 'medical record'.",
    ),
  content: z
    .string()
    .describe(
      "The document reproduced with identifiers replaced by tokens and nothing else changed. Not a summary.",
    ),
  tokens_used: z
    .array(z.string())
    .describe("Which redaction tokens appear, so the substitution can be audited."),
  illegible_sections: z
    .array(z.string())
    .describe("Anything unreadable, described by location rather than guessed at."),
});

export type RedactedDocument = z.infer<typeof RedactedDocumentSchema>;

/* ------------------------------------------------------------------ */
/* Matter profile — a small index over the corpus                      */
/* ------------------------------------------------------------------ */

export const PRACTICE_AREAS = [
  "personal_injury_motor_vehicle",
  "personal_injury_premises",
  "workers_compensation",
  "family_law",
  "estate_planning_probate",
  "criminal_defense",
  "employment",
  "immigration",
  "business_commercial",
  "real_estate",
  "bankruptcy",
  "other",
] as const;

export const PROCEDURAL_POSTURES = [
  "pre_suit",
  "pleadings",
  "discovery",
  "motion_practice",
  "mediation_arbitration",
  "trial",
  "post_trial_appeal",
  "transactional_non_litigation",
] as const;

export const OUTCOME_CATEGORIES = [
  "resolved_pre_suit",
  "resolved_in_litigation",
  "dismissed_voluntary",
  "dismissed_involuntary",
  "judgment_for_client",
  "judgment_against_client",
  "transaction_completed",
  "withdrawn_or_transferred",
  "not_determinable",
] as const;

export const QUARTERS = ["Q1", "Q2", "Q3", "Q4", "unknown"] as const;

/**
 * Deliberately small. This exists so a person can find the right matter in a
 * list and so the angle picker knows roughly what is in the corpus — not to
 * replace reading it. The corpus is the source of truth; this is the index card.
 */
export const MatterProfileSchema = z.object({
  schema_version: z.literal("3.0"),
  practice_area: z.enum(PRACTICE_AREAS),
  jurisdiction: z.object({
    state: z.string().describe("Two-letter US state code, or empty string."),
    county: z.string().describe("County or parish only."),
    court_level: z.string().describe("Generic level, e.g. 'state trial court'."),
  }),
  procedural_posture: z.enum(PROCEDURAL_POSTURES),
  outcome_category: z.enum(OUTCOME_CATEGORIES),
  time_period: z.object({
    year: z.number().int().describe("Year the matter concluded, or 0 if unknown."),
    quarter: z.enum(QUARTERS),
  }),
  summary: z
    .string()
    .describe("Under 200 words. What this matter was about, for someone scanning a list."),
  /**
   * Subject areas the corpus actually covers — not article ideas. A theme is
   * "medical lien negotiation"; an angle is "how do liens affect what I take
   * home?" Themes are a map for the angle picker to search against.
   */
  themes: z
    .array(z.string())
    .describe("Subject areas this corpus genuinely covers. Topics, not headlines."),
});

export type MatterProfile = z.infer<typeof MatterProfileSchema>;

/* ------------------------------------------------------------------ */
/* Corpus review — did redaction actually happen?                      */
/* ------------------------------------------------------------------ */

export const FINDING_CATEGORIES = [
  "person_name",
  "organization_name",
  "location",
  "date",
  "monetary_amount",
  "case_or_account_number",
  "contact_detail",
  "other_identifier",
] as const;

export const SEVERITIES = ["low", "medium", "high"] as const;

/**
 * This asks one narrow question: did any identifier survive substitution?
 *
 * It deliberately does NOT assess whether a motivated reader could work out
 * whose matter this is. That question is about a published article, not about
 * a vault, and it is asked at publish time where it can be answered against
 * what a reader would actually see.
 */
export const CorpusReviewSchema = z.object({
  verdict: z.enum(["clean", "needs_review", "blocked"]),
  findings: z.array(
    z.object({
      document_index: z.number().int().describe("Which document, 1-based."),
      category: z.enum(FINDING_CATEGORIES),
      severity: z.enum(SEVERITIES),
      what_survived: z
        .string()
        .describe("The kind of identifier that was missed, described — not quoted."),
      suggested_token: z.string().describe("Which token should have replaced it."),
    }),
  ),
  substitution_quality: z
    .string()
    .describe("Whether tokens were used consistently, and whether content was summarized when it should have been reproduced."),
});

export type CorpusReview = z.infer<typeof CorpusReviewSchema>;

/* ------------------------------------------------------------------ */
/* Article — written from the corpus, against the ledger              */
/* ------------------------------------------------------------------ */

export const ARTICLE_DEPTHS = ["pillar", "supporting", "quick_answer"] as const;

export const DraftArticleSchema = z.object({
  schema_version: z.literal("1.0"),
  angle_id: z
    .string()
    .describe("Stable kebab-case slug for the question this answers. Goes on the ledger."),
  headline: z
    .string()
    .describe("The H1: the question phrased the way a prospective client would search it."),
  reader_situation: z
    .string()
    .describe("The situation someone is in when they search this. A circumstance, not a person."),
  answer_block: z
    .string()
    .describe(
      "40-60 words answering the headline directly, with no preamble. This is what gets extracted into AI summaries and cited by language models.",
    ),
  body: z
    .string()
    .describe(
      "The article in markdown, starting after the answer block. H2 sections that each stand alone.",
    ),
  depth: z.enum(ARTICLE_DEPTHS),
  drawn_from: z
    .string()
    .describe("What in this matter's corpus supports the article, in one sentence."),
});

export type DraftArticle = z.infer<typeof DraftArticleSchema>;

/* ------------------------------------------------------------------ */
/* Publish gate — asked of the article, not the vault                 */
/* ------------------------------------------------------------------ */

export const GATE_CHECKS = [
  "re_identification",
  "jurisdictional_accuracy",
  "groundedness",
  "advertising_compliance",
  "advice_framing",
  "structure",
] as const;

/**
 * This is where the confidentiality question belongs. A reader sees the
 * article and nothing else, so the reviewer is given the article and nothing
 * else — not the corpus, not the matter reference. Given the source it would
 * reason from information the reader lacks and rate the piece safer than it is.
 */
export const PublishGateSchema = z.object({
  verdict: z.enum(["pass", "flag", "block"]),
  checks: z.array(
    z.object({
      name: z.enum(GATE_CHECKS),
      passed: z.boolean(),
      severity: z.enum(["info", "warn", "block"]),
      detail: z
        .string()
        .describe("What was checked and what was found. Never quote an identifier you found."),
    }),
  ),
});

export type PublishGate = z.infer<typeof PublishGateSchema>;
