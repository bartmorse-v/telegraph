# Matter Insight extractor

Strips identifiers from a closed matter's documents and keeps the result.

The **redacted corpus** is the product: each document reproduced with names,
addresses, dates, amounts and case numbers replaced by tokens, and nothing else
changed. It is kept indefinitely — every future article is written from it, and
it can be re-read with a new question any number of times.

A small **profile** indexes the corpus so a matter can be found in a list.

Source PDFs are deleted once processed.

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

| Path | What it is |
|---|---|
| `corpus/` | The redacted documents, one markdown file each. The durable asset. |
| `profile.json` | Index card over the corpus: practice area, venue, outcome, themes. |
| `review.json` | Whether any identifier survived substitution. |
| `report.md` | What a human actually reads. Start here. |

Exit codes: `0` clean · `1` needs review · `2` blocked · `3` error.

If your key is **identity-linked**, requests must also name a workspace or the
API returns a 400. `npm run setup` asks for the id; find it in the Console
address bar — `platform.claude.com/workspaces/<THIS PART>/...`. Keys that are
not identity-linked ignore it, so setting it is harmless either way.

## Working with real case files

Real closed matters are better test material than synthetic ones, provided the firm has authorized this use. Three rules:

- **Never commit them.** `.gitignore` blocks `samples/*.pdf` and `out/`, but the real protection is keeping them outside the repo directory entirely.
- **Never paste them into a chat, issue, or ticket.** Including into a Claude session. The pipeline exists so that the file is read exactly once, by one process, on your machine.
- **Share the output, not the input.** `report.md` is de-identified by construction and is the thing worth discussing.
- **Never paste your API key anywhere either.** `npm run setup` exists so the key never passes through shell quoting or your shell history. If a key is ever exposed, revoke it at console.anthropic.com rather than hoping.

That last rule doubles as the test. If `report.md` is safe to paste somewhere public, de-identification worked. If it is not, you have found a bug worth fixing before the next matter — read the verdict first and describe the finding categories rather than pasting the file.

### What to look at first

**Word count retained versus the source.** Redaction substitutes; it does not
summarize. A corpus far shorter than the documents means the pass quietly
condensed them, which loses the material future articles depend on. The report
prints per-document word counts for exactly this.

**The findings list.** Findings describe what survived substitution without
quoting it, so `report.md` stays shareable even when the corpus is not.

**The themes.** They should read as subject areas the documents genuinely cover,
not as article headlines. Headlines here mean the profile drifted into
speculating about content instead of indexing it.

## How it works

**Redact — one call per document, run in parallel.** Each document is
reproduced with identifiers replaced and nothing else changed, then the
uploaded copy is deleted in a `finally`. Output is bounded by input length,
which is what stops a large matter from running past the token ceiling.

No token-to-value mapping is stored anywhere. `[CLIENT]` is consistent within a
document so it reads coherently, but there is no key back to a real name —
persisting one would build exactly the re-identification database this design
exists to avoid.

**Scan — free and local.** Regex for dollar figures, dates, emails, phone
numbers and docket-shaped strings. Runs before anything expensive and catches a
redaction pass that plainly did not happen.

**Profile — a short index card.** Practice area, venue, posture, outcome, a
summary, and the subject areas the corpus covers.

**Review — did substitution work?** One narrow question, asked of the corpus.
Findings describe what survived rather than quoting it, so the report stays
shareable.

### Why redaction does only one job

An earlier version asked a single call to remove identifiers *and* judge what
was worth keeping. Those pull against each other: "keep what matters" has no
correct answer, so it drifted toward transcription, and transcription carries
identifiers with it. On a real matter that produced a 12,839-word retelling with
31 surviving identifiers and 54 predicted article angles, most of them the same
few questions reworded.

Splitting the jobs gives redaction a right answer, which is what makes it
checkable.

### Where the confidentiality gate is

**Not here.** Whether a motivated reader could work out whose matter this is is
a question about a *published article* — what a reader would actually see — and
it is answered at publish time. Asking it of a full corpus produces a permanent
"blocked" that means nothing, because a complete case file is always
identifiable to someone holding the case file.

The corpus is protected by being a vault: encrypted, per-tenant, access-logged.
The article is protected by the gate.

## Open decisions

- **The angle ledger is not built.** Choosing the next angle against a record of
  what has already been published from a matter is the next piece. It replaces
  predicting angles up front, which does not work.
- **The publish-time gate is not built.** The re-identification check on a
  finished article, which is where that question belongs.
- **Practice-area enum** spans common firm types. Narrow it to the first
  client's actual areas.
- **`out/` is not a store.** The corpus needs a real home: encrypted,
  per-tenant, access-logged, kept indefinitely.
- **The attestation gate is not built.** No matter should reach this tool before
  the firm has attested it is closed, unsealed, and cleared.
