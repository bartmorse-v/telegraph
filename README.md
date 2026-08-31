# Matter Insight extractor

Turns a closed legal case file into two artifacts that can safely leave the vault:

1. **A redacted narrative** — the matter retold in full, at length, with every identifier replaced by a stable token. This is the durable asset. It is what you re-read in a year to write an angle nobody has thought of yet.
2. **A matter insight** — the structured index over that narrative, including an inventory of every article the matter can support.

The source PDF is deleted once processed.

This is v1: a local CLI. It exists to answer one question before any infrastructure gets built — *does this produce something both safe and re-mineable?* Storage, queueing, multi-tenancy and Sanity all wait until that answer is yes.

## Why it is not called an anonymizer

"Anonymization" is a term of art implying irreversibility, and this is not that. It is **de-identification with an attorney review gate**. The distinction matters in a client agreement: promising anonymization is a promise you cannot keep, and a sophisticated legal buyer will know it.

## Run it

Clone to **your own machine** — not a shared or remote environment — because the input is privileged material. Run these **one line at a time**; pasting a block of them together is how quoting breaks.

```bash
git clone https://github.com/bartmorse-v/telegraph.git
cd telegraph
git checkout claude/arvo-blog-generation-research-ncfz85
npm install

npm run setup                        # prompts for your API key
npm run extract -- ~/matters/BC-0114/
```

**Point it at a folder, one folder per matter.** A matter is normally several
documents — pleadings, correspondence, medical records, the settlement — and
they only make sense read together. Every PDF in the folder goes into a single
pass and produces one narrative and one angle inventory.

Running the files separately instead would produce several disconnected
narratives and several overlapping inventories: a large angle count made of
the same few questions asked repeatedly. A lone PDF still works — it is just a
single-document matter.

Output lands in `out/<name>/`:

| File | What it is |
|---|---|
| `narrative.json` | The full redacted retelling. The durable asset. |
| `insight.json` | Structured index + the angle inventory. |
| `scrub.json` | Structured findings from the adversarial pass. |
| `report.md` | What a human actually reads. Start here. |

Exit codes: `0` clean · `1` needs review · `2` blocked · `3` error.

## Working with real case files

Real closed matters are better test material than synthetic ones, provided the firm has authorized this use. Three rules:

- **Never commit them.** `.gitignore` blocks `samples/*.pdf` and `out/`, but the real protection is keeping them outside the repo directory entirely.
- **Never paste them into a chat, issue, or ticket.** Including into a Claude session. The pipeline exists so that the file is read exactly once, by one process, on your machine.
- **Share the output, not the input.** `report.md` is de-identified by construction and is the thing worth discussing.
- **Never paste your API key anywhere either.** `npm run setup` exists so the key never passes through shell quoting or your shell history. If a key is ever exposed, revoke it at console.anthropic.com rather than hoping.

That last rule doubles as the test. If `report.md` is safe to paste somewhere public, de-identification worked. If it is not, you have found a bug worth fixing before the next matter — read the verdict first and describe the finding categories rather than pasting the file.

### What to look at first

**The angle count, and whether the angles are genuinely distinct.** Fourteen angles that are three real questions in fourteen phrasings is a failure, not a success — and it is the failure mode that would quietly wreck the business model. Be sceptical here early.

Then: does `supporting_insight` on each angle say something a general article could not? "Statutes of limitation are important" is worthless. "The limitations clock and the insurer's internal review window are unrelated, and waiting for the review to conclude can forfeit the claim" is an article.

## How it works

**Stage 1 — `redactDocument`.** Uploads the PDF, retells the matter in full with identifiers tokenized and timing expressed relatively ("eleven days after the collision", never a date), then deletes the uploaded copy in a `finally`. The instruction to *retell, not summarize* is load-bearing: detail dropped here is gone permanently.

No token-to-value mapping is stored anywhere. `[CLIENT]` is consistent within one document so the narrative reads coherently, but there is no key back to a real name — persisting one would build exactly the re-identification database this design exists to avoid.

**Stage 2 — `buildInsight`.** Reads the narrative, never the document, and enumerates every article angle the matter supports. Targets 8–15 for a substantial matter.

**Stage 3 — `scrubMatter`.** Adversarial re-identification check that sees only what survives — never the document, filename, or client name. That isolation matches the real threat model: a reader with the published article and nothing else. It reasons about identifying **combinations** separately from individual fields, which is where re-identification actually happens — a small county, a quarter, and an uncommon injury are each harmless alone and routinely identify one person together.

### Two things worth knowing

**The schema is a control.** There is no field capable of holding a name, address, docket number, exact date, or dollar amount. Time coarsens to year + quarter, geography stops at county, outcomes are categories rather than figures. If the model has nowhere to put an identifier, the most common leak path closes by construction.

**The narrative is the riskier artifact.** The specificity that keeps it re-mineable is the same specificity that re-identifies people. It gets the same scrutiny as the insight, and in production it should stay in the vault — drafting reads the insight plus one angle's extract, never the whole narrative at once.

## Open decisions

- **Practice-area enum** in `schema.ts` spans common firm types. Narrow it to Barton Cerjak's actual areas — a tight enum measurably improves extraction.
- **Structured outputs and citations are mutually exclusive** at the API level (sending both returns a 400). Schema conformance won. A separate citations-enabled grounding pass to verify claims against the source is the planned addition.
- **`out/` is not a store.** Where insights live is a decision for once this is proven.
- **The attestation gate is not built.** No matter should reach this tool before the firm has attested it is closed, unsealed, and cleared. It belongs upstream of extraction, and it is the next thing to build.
