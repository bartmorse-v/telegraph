import { NextResponse } from "next/server";
import { getArticles, getCorpus, getMatter, getProfile, getReview } from "../../../../src/store";

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
