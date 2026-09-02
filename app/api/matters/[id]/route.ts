import { NextResponse } from "next/server";
import {
  deleteMatter,
  getArticles,
  getCorpus,
  getMatter,
  getProfile,
  getReview,
} from "../../../../src/store";

export const runtime = "nodejs";
// These read the filesystem, which Next cannot know has changed. Without this
// the UI serves a cached snapshot and a matter appears stuck forever.
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matter = getMatter(id);
  if (!matter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const corpus = getCorpus(id);
  return NextResponse.json({
    matter,
    profile: getProfile(id),
    review: getReview(id),
    articles: getArticles(id),
    // The corpus itself is not sent to the browser — only its shape. It is the
    // most sensitive artifact here and the UI has no reason to hold it.
    documents: corpus.map((d, i) => ({
      index: i + 1,
      type: d.document_type,
      words: d.content.trim().split(/\s+/).filter(Boolean).length,
      illegible: d.illegible_sections.length,
      // Generic parts, never names — this is what makes a stitched long
      // document checkable by eye.
      cast: d.cast ?? [],
    })),
  });
}

/**
 * Destroys the corpus, the articles and everything else derived from the case
 * file, leaving the attestation record behind.
 *
 * The reference is retyped and checked here rather than in the browser, for the
 * same reason the attestation is revalidated: a confirmation dialog protects
 * nobody once something can post to this route directly. There is no undo, and
 * the source PDFs were deleted at processing time, so a matter deleted by
 * accident has to be uploaded again from the firm's own files.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matter = getMatter(id);
  if (!matter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotent: a second delete of a tombstone is not an error.
  if (matter.status === "deleted") return NextResponse.json(matter);

  const body = (await request.json().catch(() => ({}))) as {
    confirm?: unknown;
    reason?: unknown;
  };

  const typed = typeof body.confirm === "string" ? body.confirm.trim() : "";
  if (typed !== matter.reference.trim()) {
    return NextResponse.json(
      { error: `Type the matter reference exactly — ${matter.reference} — to confirm.` },
      { status: 400 },
    );
  }

  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  return NextResponse.json(deleteMatter(id, reason));
}
