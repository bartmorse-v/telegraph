import { NextResponse } from "next/server";
import { getArticle, saveArticle } from "../../../../src/store";

export const runtime = "nodejs";
// These read the filesystem, which Next cannot know has changed. Without this
// the UI serves a cached snapshot and a matter appears stuck forever.
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = getArticle(id);
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(article);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = getArticle(id);
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json()) as {
    action: "approve" | "reject";
    approvedBy?: string;
    note?: string;
  };

  if (body.action === "approve") {
    // A blocked gate is not something an approval can override. The point of a
    // block is that it is not a matter of judgement.
    if (article.gate.verdict === "block") {
      return NextResponse.json(
        { error: "This article is blocked by the publish gate and cannot be approved." },
        { status: 400 },
      );
    }
    if (!body.approvedBy?.trim()) {
      return NextResponse.json({ error: "An approving attorney must be named." }, { status: 400 });
    }
    saveArticle({
      ...article,
      status: "approved",
      approvedBy: body.approvedBy.trim(),
      approvedAt: new Date().toISOString(),
    });
  } else {
    // Rejected articles stay on the ledger: the angle was spent whether or not
    // the piece was any good, and offering it again wastes another run.
    saveArticle({ ...article, status: "rejected", rejectionNote: body.note ?? "" });
  }

  return NextResponse.json(getArticle(id));
}
