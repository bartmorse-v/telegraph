# Telegraph

Turns a law firm's closed matters into publishable articles, without exposing a
client.

The **redacted corpus** is the product: each document reproduced with names,
addresses, dates, amounts and case numbers replaced by tokens, and nothing else
changed. It is kept indefinitely — every future article is written from it, and
it can be re-read with a new question any number of times.

A small **profile** indexes the corpus so a matter can be found in a list.

Source PDFs are deleted once processed.

Articles are written from the corpus one at a time, each choosing a question
the documents answer that is **not already on the matter's ledger**. Nothing is
predicted up front, so nothing duplicates: the writer can see what exists.

Every article passes a publish gate before a person sees it, and no article
publishes without a named attorney approving that exact version.

**Everything runs on your machine.** Case files never reach infrastructure
anyone else operates — they go to the Anthropic API to be redacted, and are
deleted immediately afterward. Storage is the local filesystem under `data/`.

## Why it is not called an anonymizer

"Anonymization" is a term of art implying irreversibility, and this is not that. It is **de-identification with an attorney review gate**. The distinction matters in a client agreement: promising anonymization is a promise you cannot keep, and a sophisticated legal buyer will know it.

## Run it

Clone to **your own machine** — not a shared or remote environment — because the
input is privileged material. Run these **one line at a time**; pasting a block
of them together is how quoting breaks.

```bash
git clone https://github.com/bartmorse-v/telegraph.git
cd telegraph
git checkout claude/arvo-blog-generation-research-ncfz85
npm install
npm run setup                        # prompts for your API key
npm run dev
```

Then open **http://localhost:3000**.

### Using it

1. **Add a matter.** Upload every PDF for one closed matter together — they are
   read as a single case. The eligibility attestation is part of this form and
   cannot be skipped; it is checked again server-side, because the record is
   what protects the firm.
2. **Wait.** Redaction takes a few minutes. The page updates itself.
3. **Write the next article.** Each one picks a question the documents answer
   that is not already on the matter's ledger.
4. **Review and approve.** The publish gate has already run. A blocking failure
   cannot be approved past.

One folder per matter. Pointing it at a folder holding *all* matters produces
one incoherent case out of many.

### Or from the terminal

`npm run extract -- ~/matters/BC-0114/` runs redaction only, writing to
`out/<name>/`:

| Path | What it is |
|---|---|
| `corpus/` | The redacted documents, one markdown file each. The durable asset. |
| `profile.json` | Index card over the corpus: practice area, venue, outcome, themes. |
| `review.json` | Whether any identifier survived substitution. |
| `report.md` | What a human actually reads. Start here. |

The app stores the same things under `data/matters/<id>/`, plus articles.

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

**Redact — page ranges, run under a concurrency ceiling.** Each document is
reproduced with identifiers replaced and nothing else changed, then the uploaded
copy is deleted in a `finally`.

A reproduction is roughly as long as its source, and the model's output ceiling
covers its thinking as well as its output — so a long filing cannot come back in
one response at any setting. Documents over 30 pages are split locally into page
ranges, redacted separately, and stitched back together. Splitting happens with
a PDF library rather than by asking the model to respect a page range, so the
result is deterministic and nothing is silently skipped.

Redaction runs at medium effort: substitution is careful work but not hard
reasoning, and leaving thinking room to the output is what keeps a long document
from being cut off mid-sentence.

**The cast carries across page ranges.** Each range reports which tokens it used
and the part each one plays — "the treating physician", "the defendant's
insurer" — and the next range is given that list and told to reuse it. Ranges
therefore run in order rather than at once. Without that, every range numbers its
witnesses from one, and stitching them back together merges people who were never
the same person; an article written from that reads as confidently wrong. Whole
documents still run concurrently, which is where the parallelism that matters
comes from.

No token-to-value mapping is stored anywhere. `[CLIENT]` is consistent across a
whole document so it reads coherently, and the cast records the *part* a token
plays — never a name. There is no key back to a real identity, because
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

- **Nothing publishes anywhere yet.** Approved articles sit in `data/`. Pushing
  them into a firm's own Sanity dataset is the next piece.
- **`data/` is a filesystem, not a store.** It works because everything runs on
  one machine. Serving more than one firm needs a real home for the corpus:
  encrypted, per-tenant, access-logged.
- **Practice-area enum** spans common firm types. Narrow it to the first
  client's actual areas.
- **No per-firm voice.** Every article comes out in the same register. Firms
  will want their own.
- **Ethics counsel has not reviewed this.** Worth doing before a paying client,
  along with a DPA and a subprocessor list.
