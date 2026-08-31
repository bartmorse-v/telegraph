import { z } from "zod";

/**
 * Two artifacts survive extraction, and they do different jobs.
 *
 *   1. RedactedNarrative — the full matter, retold at length with every
 *      identifier replaced by a stable token. This is the durable asset. It is
 *      what you re-read in eight months when you want an angle nobody thought
 *      of yet.
 *
 *   2. MatterInsight — the structured index over that narrative, including an
 *      inventory of every article the matter can support.
 *
 * De-identification is not compression. The narrative should be LONGER than a
 * summary of the source, not shorter — organized, generalized, and stripped of
 * identifiers, but not thinned out. Detail that carries no identifying power is
 * exactly what makes the tenth article from a matter worth reading, and there
 * is no confidentiality argument for throwing it away.
 *
 * What gets deleted is the raw identified document. What gets kept and grown is
 * everything else.
 */

/* ------------------------------------------------------------------ */
/* Stage 1 — Redacted narrative                                        */
/* ------------------------------------------------------------------ */

/**
 * Tokens are consistent within a single matter so the narrative stays coherent
 * — [CLIENT] is the same person on page 1 and page 40.
 *
 * There is deliberately NO stored mapping from token back to real value.
 * Persisting one would build exactly the re-identification database this
 * architecture exists to avoid. Coherence within the document is worth having;
 * a decryption key is not.
 */
export const REDACTION_TOKENS = [
  "[CLIENT]",
  "[OPPOSING_PARTY]",
  "[WITNESS_N]",
  "[INSURER]",
  "[PROVIDER_N]",
  "[EMPLOYER]",
  "[COUNSEL]",
  "[LOCATION]",
  "[DATE_N]",
  "[AMOUNT]",
  "[CASE_NUMBER]",
] as const;

export const RedactedNarrativeSchema = z.object({
  schema_version: z.literal("1.0"),
  /**
   * The long form. Target several thousand words for a substantial matter.
   * Chronological, specific about mechanism and procedure, generic about
   * people. This is the raw material for every future article.
   */
  narrative: z
    .string()
    .describe(
      "The full matter retold at length: what happened, what the client wanted, what was done, in what order, and how it resolved. Preserve every detail that carries no identifying power — procedural steps, tactical reasoning, medical or technical mechanism, timing relationships, what surprised the client. Replace identifiers with tokens. Do not summarize; retell.",
    ),
  /**
   * Relative time is content-useful and safe. "Three weeks after the collision"
   * teaches a reader something; "March 14, 2022" identifies a docket.
   */
  chronology: z
    .array(
      z.object({
        relative_timing: z
          .string()
          .describe("Time expressed relative to other events, never as an absolute date."),
        event: z.string(),
        why_it_mattered: z.string(),
      }),
    )
    .describe("The procedural and factual sequence, in relative time."),
  tokens_used: z
    .array(z.string())
    .describe("Which redaction tokens appear in the narrative."),
  source_quality: z
    .string()
    .describe("Legibility and completeness of the source — drives whether a human re-checks."),
  gaps: z
    .array(z.string())
    .describe("What the source did not establish, or was too degraded to read."),
});

export type RedactedNarrative = z.infer<typeof RedactedNarrativeSchema>;

/* ------------------------------------------------------------------ */
/* Stage 2 — Matter Insight                                            */
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

/** Outcome is a category, never a figure — re-identifying and an ad-rule problem both. */
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

export const ANGLE_DEPTHS = ["pillar", "supporting", "quick_answer"] as const;

export const LOCAL_DETAIL_CATEGORIES = [
  "court_or_venue_procedure",
  "filing_requirement_or_fee",
  "local_rule",
  "agency_or_office_practice",
  "regional_service_provider_type",
  "geographic_or_infrastructure",
] as const;

/**
 * The angle inventory is the commercial heart of this schema.
 *
 * One matter is never one article. A single motor-vehicle case touches the
 * limitations period, dealing with adjusters, medical liens, comparative fault,
 * underinsured-motorist coverage, treatment gaps, what mediation actually looks
 * like, and when hiring counsel changes the outcome — each a separate search
 * intent and a separate article.
 *
 * Extraction is explicitly asked to enumerate exhaustively rather than pick
 * highlights. `supporting_insight` is what makes each angle publishable: the
 * specific thing THIS matter teaches about that question, which is what a
 * competitor writing from a keyword tool cannot produce.
 */
const ArticleAngle = z.object({
  angle_id: z.string().describe("Stable kebab-case slug, unique within this matter."),
  headline_question: z
    .string()
    .describe("The article's H1, phrased the way a prospective client would search it."),
  reader_situation: z
    .string()
    .describe("The situation someone is in when they search this. A circumstance, not a person."),
  supporting_insight: z
    .string()
    .describe(
      "What this specific matter teaches about this question that a general article could not say. The substance of the article.",
    ),
  legal_authorities: z
    .array(z.string())
    .describe("Statutes, rules, or doctrines this angle turns on."),
  local_hooks: z
    .array(z.string())
    .describe("Venue or procedure specifics that make this defensible as local content."),
  depth: z.enum(ANGLE_DEPTHS),
  related_angle_ids: z
    .array(z.string())
    .describe("Other angles from this matter that should link to this one."),
});

export type ArticleAngle = z.infer<typeof ArticleAngle>;

const LocalSpecific = z.object({
  detail: z
    .string()
    .describe("A publicly verifiable local fact — a procedure, rule, or office practice. Never a fact about the parties."),
  category: z.enum(LOCAL_DETAIL_CATEGORIES),
});

export const MatterInsightSchema = z.object({
  schema_version: z.literal("2.0"),
  practice_area: z.enum(PRACTICE_AREAS),
  jurisdiction: z.object({
    state: z.string().describe("Two-letter US state code, or empty string."),
    county: z.string().describe("County or parish only. Never a city or neighborhood."),
    court_level: z
      .string()
      .describe("Generic level only, e.g. 'state trial court'. Never a specific judge or division."),
  }),
  procedural_posture: z.enum(PROCEDURAL_POSTURES),
  outcome_category: z.enum(OUTCOME_CATEGORIES),
  time_period: z.object({
    year: z.number().int().describe("Year the matter concluded, or 0 if not determinable."),
    quarter: z.enum(QUARTERS),
  }),

  /** Every question the client actually asked. Exhaustive, not top-three. */
  client_questions: z.array(
    z.object({
      question: z.string().describe("Rephrased as a prospective client would search it."),
      context: z.string().describe("Why it arose."),
      what_they_assumed: z
        .string()
        .describe("The misconception behind the question, if any. Empty string if none."),
    }),
  ),

  /** What a layperson would not have known to do. High-value article material. */
  non_obvious_moves: z.array(
    z.object({
      move: z.string(),
      why_it_mattered: z.string(),
      what_happens_without_it: z.string(),
    }),
  ),

  obstacles: z.array(
    z.object({ obstacle: z.string(), how_addressed: z.string(), transferable_lesson: z.string() }),
  ),

  legal_issues: z.array(
    z.object({ issue: z.string(), authority: z.string(), how_it_resolved: z.string() }),
  ),

  local_specifics: z.array(LocalSpecific),

  /** Target 8-15 for a substantial matter. This is the "ten articles" promise, made countable. */
  angle_inventory: z.array(ArticleAngle),

  low_confidence_areas: z.array(z.string()),
});

export type MatterInsight = z.infer<typeof MatterInsightSchema>;

/* ------------------------------------------------------------------ */
/* Stage 3 — Adversarial scrub                                         */
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

export const ScrubReportSchema = z.object({
  verdict: z.enum(["clean", "needs_review", "blocked"]),
  findings: z.array(
    z.object({
      field_path: z.string().describe("Dotted path into the reviewed object."),
      excerpt: z.string(),
      category: z.enum(FINDING_CATEGORIES),
      severity: z.enum(SEVERITIES),
      reasoning: z.string(),
      suggested_replacement: z
        .string()
        .describe("A generalized rewrite preserving editorial value. Empty string if it must be deleted."),
    }),
  ),
  /**
   * The failure mode field-by-field review misses. Individually safe facts
   * routinely identify one person together — a small county, a quarter, and an
   * uncommon injury.
   */
  combination_risk: z.object({
    could_a_motivated_reader_identify_the_matter: z.boolean(),
    reasoning: z
      .string()
      .describe("Assume public dockets, local news, social media, and knowledge of the firm."),
    riskiest_combination: z.string().describe("Empty string if none."),
  }),
});

export type ScrubReport = z.infer<typeof ScrubReportSchema>;
