import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { createMatter, listMatters } from "../../../src/store";
import { processMatter } from "../../../src/process";

export const runtime = "nodejs";
// These read the filesystem, which Next cannot know has changed. Without this
// the UI serves a cached snapshot and a matter appears stuck forever.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json(listMatters());
}

export async function POST(request: Request) {
  const form = await request.formData();

  const reference = String(form.get("reference") ?? "").trim();
  const attestedBy = String(form.get("attestedBy") ?? "").trim();
  const barNumber = String(form.get("barNumber") ?? "").trim();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  if (!reference) return NextResponse.json({ error: "A matter reference is required." }, { status: 400 });
  if (!attestedBy || !barNumber) {
    return NextResponse.json({ error: "The attesting attorney and bar number are required." }, { status: 400 });
  }
  if (files.length === 0) return NextResponse.json({ error: "No files were uploaded." }, { status: 400 });

  const confirmations = {
    closed: form.get("closed") === "on",
    noProtectiveOrder: form.get("noProtectiveOrder") === "on",
    noConfidentialityClause: form.get("noConfidentialityClause") === "on",
    notOnAppeal: form.get("notOnAppeal") === "on",
    authorized: form.get("authorized") === "on",
  };

  // Server-side too, not only in the browser. This gate is the record that
  // protects the firm, so it cannot be bypassed by anything that can post a form.
  if (!Object.values(confirmations).every(Boolean)) {
    return NextResponse.json(
      { error: "Every eligibility confirmation must be checked before a matter can be processed." },
      { status: 400 },
    );
  }

  const matter = createMatter(
    reference,
    { attestedBy, barNumber, at: new Date().toISOString(), confirmations },
    files.map((f) => f.name),
  );

  const sourceDir = path.join(process.cwd(), "data", "matters", matter.id, "source");
  fs.mkdirSync(sourceDir, { recursive: true });
  for (const [i, file] of files.entries()) {
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(sourceDir, `${String(i + 1).padStart(2, "0")}.pdf`), buf);
  }

  // Not awaited: the work takes minutes and its progress belongs in the
  // matter's status, not in a hanging request.
  void processMatter(matter.id, sourceDir);

  return NextResponse.json(matter, { status: 201 });
}
