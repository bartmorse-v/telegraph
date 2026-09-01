import fs from "node:fs";
import path from "node:path";
import { createClient, explainError } from "./client";
import { redactCorpus, scanForPatterns, corpusText } from "./redact";
import { buildProfile } from "./extract";
import { reviewCorpus } from "./scrub";
import { saveCorpus, saveProfile, saveReview, updateMatter } from "./store";

/**
 * Runs a matter through redaction, profiling and review, then deletes the
 * source PDFs.
 *
 * Deliberately not awaited by the request that starts it — a matter takes
 * minutes, and an HTTP request that long fails for reasons that have nothing to
 * do with the work. Progress lives in the matter's status instead, which the UI
 * polls. Any failure is written to the record rather than thrown into a void.
 */
export async function processMatter(matterId: string, sourceDir: string): Promise<void> {
  const client = createClient();

  try {
    updateMatter(matterId, { status: "processing" });

    const files = fs
      .readdirSync(sourceDir)
      .filter((f) => /\.pdf$/i.test(f))
      .sort()
      .map((f) => path.join(sourceDir, f));

    if (files.length === 0) throw new Error("No PDFs found in the upload.");

    const { documents } = await redactCorpus(client, files, () => {});
    saveCorpus(matterId, documents);

    // Free and instant. A pass that plainly did not happen is caught here
    // rather than after two more model calls.
    const scan = scanForPatterns(corpusText(documents));

    const [{ profile }, { review }] = await Promise.all([
      buildProfile(client, documents),
      reviewCorpus(client, documents),
    ]);
    saveProfile(matterId, profile);

    // The local scan can only add doubt, never remove it: a clean regex sweep
    // says nothing about names it has no pattern for.
    const merged =
      !scan.clean && review.verdict === "clean"
        ? {
            ...review,
            verdict: "needs_review" as const,
            substitution_quality: `${review.substitution_quality}\n\nPattern scan also matched: ${scan.hits
              .map((h) => `${h.count} ${h.kind}`)
              .join(", ")}.`,
          }
        : review;
    saveReview(matterId, merged);

    updateMatter(matterId, {
      status:
        merged.verdict === "blocked"
          ? "blocked"
          : merged.verdict === "needs_review"
            ? "needs_review"
            : "ready",
      processedAt: new Date().toISOString(),
    });
  } catch (err) {
    updateMatter(matterId, {
      status: "failed",
      // Through the same translator the CLI uses, so a missing key reads as
      // an instruction rather than as an SDK stack trace.
      error: explainError(err),
    });
  } finally {
    // The source files go whether the run succeeded or not. Their lifetime is
    // the processing attempt, and a failed attempt is not a reason to keep
    // privileged documents sitting on disk.
    fs.rmSync(sourceDir, { recursive: true, force: true });
  }
}
