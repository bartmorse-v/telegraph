# Matter Insight extractor

Turns a closed legal case file into a **de-identified Matter Insight** — the only artifact permitted to cross into the content pipeline.

This is v1: a local CLI. It exists to answer one question before any infrastructure gets built — *does extraction plus adversarial scrubbing actually produce something both safe and editorially useful?* Everything else (storage, queueing, multi-tenancy, Sanity) waits until that answer is yes.

## Why it is not called an anonymizer

"Anonymization" is a term of art implying irreversibility, and this process is not that. It is **de-identification with an attorney review gate**. The distinction matters when you write the client agreement — promising anonymization is a promise you cannot keep, and a sophisticated legal buyer will know it.

## Run it

```bash
npm install
npm run extract -- ./samples/matter-01.pdf
```

Output lands in `out/<name>/`:

| File | Purpose |
|---|---|
| `insight.json` | The de-identified record. The only thing downstream stages may read. |
| `scrub.json` | Structured findings from the adversarial pass. |
| `report.md` | What a human editor actually reads. |

Exit codes: `0` clean · `1` needs review · `2` blocked · `3` error.

Credentials resolve from the environment — `ANTHROPIC_API_KEY`, or an `ant auth login` profile. Do not hardcode a key.

## How it works

**Stage A — `extract.ts`.** Uploads the PDF via the Files API, extracts against a Zod schema using structured outputs, then deletes the uploaded copy in a `finally`. The raw document's lifetime is the lifetime of the extraction.

**Stage B — `scrub.ts`.** A second call that sees **only the extracted JSON** — never the document, filename, or client name. This isolation is the point: the threat model is a reader who has the published article and nothing else, so the reviewer must be in that same position. Given the source, it would rate the output safer than it is.

The scrub reasons about **combinations** separately from individual fields, because that is where real re-identification happens. A county, a quarter, and an uncommon injury are each harmless alone and frequently identify exactly one person together.

### Two design decisions worth knowing

**The schema is a control, not just a data shape.** There is no field in which a name, address, docket number, exact date, or dollar amount can be stored. Time is coarsened to year + quarter; geography stops at county; outcomes are categories, never amounts. If the model has nowhere to put an identifier, the most common leak path closes by construction.

**Source pages are self-reported.** Structured outputs and the citations feature are mutually exclusive at the API level — sending both returns a 400. Schema conformance won, because a malformed insight breaks the pipeline while an imprecise page number does not. A separate citations-enabled grounding pass is the planned v2 addition.

## Test documents

Do **not** put real client files in `samples/` — `.gitignore` blocks `*.pdf` there, but the better protection is not creating the situation. Start with synthetic matters you write yourself: they let you verify the scrub catches things, because you know exactly what you planted.

Write three or four covering the failure modes that matter:

1. **Clean native PDF, common matter.** Baseline — should extract well and scrub clean.
2. **Identifier-dense.** Names, an address, a docket number, a settlement figure, exact dates. The scrub must catch every one. If it does not, stop and fix before going further.
3. **Combination risk, no direct identifiers.** No names anywhere, but a rare occupation plus a small county plus a specific quarter. This is the case that separates a real de-identification gate from a regex.
4. **Degraded scan.** Skewed OCR, a fax header, handwriting. Should degrade honestly into `low_confidence_areas` rather than inventing content.

## Open decisions

- **Practice-area enum** in `schema.ts` is a placeholder spanning common firm types. Narrow it to the first client's actual areas — a tight enum measurably improves extraction.
- **`out/` is not a store.** v1 writes to disk. Where insights actually live is a decision for once this is proven.
- **Attestation gate.** No matter should reach this tool before the firm has attested it is closed, unsealed, and cleared. Not yet built; it belongs upstream of extraction.
