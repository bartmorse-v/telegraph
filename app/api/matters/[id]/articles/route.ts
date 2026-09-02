import { NextResponse } from "next/server";
import { createClient } from "../../../../../src/client";
import { runPublishGate, writeArticle } from "../../../../../src/write";
import {
  angleLedger,
  getCorpus,
  getMatter,
  getProfile,
  newArticleId,
  saveArticle,
  type Article,
} from "../../../../../src/store";

export const runtime = "nodejs";
export const maxDuration = 800;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matter = getMatter(id);
  const profile = getProfile(id);
  const documents = getCorpus(id);

  if (!matter) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Before the "not finished" check below: a deleted matter has no corpus by
  // definition, and "still processing" would be a misleading thing to say
  // about one.
  if (matter.status === "deleted") {
    return NextResponse.json({ error: "This matter has been deleted." }, { status: 400 });
  }
  if (!profile || documents.length === 0) {
    return NextResponse.json({ error: "This matter has not finished processing." }, { status: 400 });
  }
  if (matter.status === "blocked") {
    return NextResponse.json(
      { error: "This matter is blocked — identifiers survived redaction. Reprocess it before writing." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { steer?: string };
  const client = createClient();

  const { draft } = await writeArticle(client, profile, documents, angleLedger(id), body.steer);

  // The writer is allowed to decline. A thin article is worse than none, and a
  // ledger that keeps growing past what the matter can support is the failure
  // this whole approach exists to avoid.
  if (draft.headline.trim().toUpperCase() === "EXHAUSTED") {
    return NextResponse.json({ exhausted: true, reason: draft.drawn_from }, { status: 200 });
  }

  const jurisdiction = `${profile.jurisdiction.county}, ${profile.jurisdiction.state}`;
  const { gate } = await runPublishGate(client, draft, jurisdiction);

  const article: Article = {
    id: newArticleId(),
    matterId: id,
    angleId: draft.angle_id,
    headline: draft.headline,
    readerSituation: draft.reader_situation,
    answerBlock: draft.answer_block,
    body: draft.body,
    status: "draft",
    createdAt: new Date().toISOString(),
    gate,
  };
  saveArticle(article);

  return NextResponse.json(article, { status: 201 });
}
