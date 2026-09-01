import { NextResponse } from "next/server";
import { allArticles, listMatters } from "../../../src/store";

export const runtime = "nodejs";
// These read the filesystem, which Next cannot know has changed. Without this
// the UI serves a cached snapshot and a matter appears stuck forever.
export const dynamic = "force-dynamic";

export async function GET() {
  const drafts = allArticles().filter((a) => a.status === "draft");
  const matters = listMatters();
  // "failed" belongs here too: a matter that errored is exactly the thing
  // nobody finds out about unless the home screen says so.
  const attention = matters.filter(
    (m) => m.status === "blocked" || m.status === "needs_review" || m.status === "failed",
  );
  return NextResponse.json({
    count: drafts.length + attention.length,
    drafts,
    attention,
    processing: matters.filter((m) => m.status === "processing" || m.status === "attested"),
  });
}
