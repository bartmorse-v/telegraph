import { z } from "zod";

/**
 * The Matter Insight is the ONLY artifact permitted to cross the
 * de-identification boundary. Everything downstream (planning, drafting,
 * publishing) reads this and never the source document.
 *
 * The schema is a control, not just a data shape. There is deliberately no
 * field in which a name, address, docket number, exact date, or dollar amount
 * can be stored. If the model has nowhere to put an identifier, the most
 * common leak path closes by construction. The scrub pass in `scrub.ts` exists
 * to catch what leaks into free-text fields anyway.
 */

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

/**
 * Outcome is a category, never an amount. "Settled for $214,500" is both a
 * re-identification vector and an advertising-rule problem; "settled at
 * mediation" is neither and is just as useful for content planning.
 */
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

export const LOCAL_DETAIL_CATEGORIES = [
  "court_or_venue_procedure",
  "filing_requirement_or_fee",
  "local_rule",
  "agency_or_office_practice",
  "regional_service_provider_type",
  "geographic_or_infrastructure",
] as const;

/**
 * Time is deliberately coarse. Quarter + year is enough to say "rules changed
 * after 2023"; it is not enough to cross-reference against a public docket.
 */
const TimePeriod = z.object({
  year: z
    .number()
    .int()
    .describe("Four-digit year the matter concluded. Use 0 if not determinable."),
  quarter: z.enum(QUARTERS),
});

const Jurisdiction = z.object({
  state: z.string().describe("Two-letter US state code, or empty string if not determinable."),
  county: z
    .string()
    .describe(
      "County or parish name only. Never a city, neighborhood, street, or intersection.",
    ),
  court_level: z
    .string()
    .describe(
      "Generic level only, e.g. 'state trial court', 'federal district court', 'administrative agency'. Never a specific judge, division, or courtroom.",
    ),
});

/**
 * `source_pages` is self-reported by the model rather than system-enforced.
 * Structured outputs and the citations feature are mutually exclusive at the
 * API level, and schema conformance matters more here than citation rigor —
 * a malformed insight breaks the pipeline, an imprecise page number does not.
 * `verify.ts` (not yet built) re-reads the document with citations enabled to
 * confirm these anchors.
 */
const sourcePages = z
  .array(z.number().int())
  .describe("Page numbers in the source document supporting this item.");

const LegalIssue = z.object({
  issue: z.string().describe("The legal question at stake, stated generically."),
  authority: z
    .string()
    .describe(
      "Controlling statute, rule, or doctrine if identified in the document. Public authority is safe to record. Empty string if none.",
    ),
  source_pages: sourcePages,
});

const ClientQuestion = z.object({
  question: z
    .string()
    .describe(
      "A question the client actually asked, rephrased in plain language as a prospective client would search for it. This is the single most valuable field for content planning.",
    ),
  context: z.string().describe("Why the question arose, stated generically."),
  source_pages: sourcePages,
});

const Obstacle = z.object({
  obstacle: z.string(),
  how_addressed: z.string(),
  source_pages: sourcePages,
});

const LocalSpecific = z.object({
  detail: z
    .string()
    .describe(
      "A verifiable, publicly checkable local fact — a filing procedure, a local rule, an agency practice. Never a fact about the parties.",
    ),
  category: z.enum(LOCAL_DETAIL_CATEGORIES),
  source_pages: sourcePages,
});

const ContentAngle = z.object({
  angle: z.string().describe("A article topic this matter could support."),
  target_reader: z
    .string()
    .describe("Who would search for this, described as a situation rather than a person."),
});

export const MatterInsightSchema = z.object({
  schema_version: z.literal("1.0"),
  practice_area: z.enum(PRACTICE_AREAS),
  jurisdiction: Jurisdiction,
  procedural_posture: z.enum(PROCEDURAL_POSTURES),
  outcome_category: z.enum(OUTCOME_CATEGORIES),
  time_period: TimePeriod,
  fact_pattern: z
    .string()
    .describe(
      "A generalized description of what happened, written so it could describe any of a hundred similar matters. Roles ('the driver', 'the employer'), never names.",
    ),
  legal_issues: z.array(LegalIssue),
  client_questions: z.array(ClientQuestion),
  obstacles: z.array(Obstacle),
  local_specifics: z.array(LocalSpecific),
  content_angles: z.array(ContentAngle),
  document_quality: z
    .string()
    .describe(
      "How legible and complete the source was — 'clean native PDF', 'OCR with gaps', 'partial scan'. Drives whether a human should re-check.",
    ),
  low_confidence_areas: z
    .array(z.string())
    .describe("Anything inferred rather than stated, or unreadable in the source."),
});

export type MatterInsight = z.infer<typeof MatterInsightSchema>;

/* ------------------------------------------------------------------ */
/* Scrub pass                                                          */
/* ------------------------------------------------------------------ */

export const FINDING_CATEGORIES = [
  "direct_identifier",
  "quasi_identifier",
  "identifying_combination",
  "monetary_amount",
  "date_too_precise",
  "distinctive_detail",
  "confidentiality_marker",
] as const;

export const SEVERITIES = ["low", "medium", "high"] as const;

const Finding = z.object({
  field_path: z.string().describe("Dotted path into the insight, e.g. 'client_questions[2].context'."),
  excerpt: z.string().describe("The exact offending text."),
  category: z.enum(FINDING_CATEGORIES),
  severity: z.enum(SEVERITIES),
  reasoning: z.string().describe("Why this could identify a party or matter."),
  suggested_replacement: z
    .string()
    .describe("A generalized rewrite preserving the editorial value. Empty string if it must simply be deleted."),
});

export const ScrubReportSchema = z.object({
  verdict: z.enum(["clean", "needs_review", "blocked"]),
  findings: z.array(Finding),
  /**
   * The hard part. Direct identifiers are easy; the real risk is a set of
   * individually-innocuous details that together single out one matter —
   * a rare injury plus a small county plus a quarter. This field forces the
   * model to reason about the set rather than field by field.
   */
  combination_risk: z.object({
    could_a_motivated_reader_identify_the_matter: z.boolean(),
    reasoning: z
      .string()
      .describe(
        "Assume the reader has access to public dockets, local news, and social media, and knows the firm's name.",
      ),
    riskiest_combination: z
      .string()
      .describe("The specific set of details that together create the risk. Empty string if none."),
  }),
});

export type ScrubReport = z.infer<typeof ScrubReportSchema>;
