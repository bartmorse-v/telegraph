"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { usePoll } from "../../use-poll";
import type { Article, MatterMeta } from "../../../src/store";
import type { CorpusReview, MatterProfile } from "../../../src/schema";
import { GateBadge } from "../../page";

interface Detail {
  matter: MatterMeta;
  profile: MatterProfile | null;
  review: CorpusReview | null;
  articles: Article[];
  documents: Array<{
    index: number;
    type: string;
    words: number;
    illegible: number;
    cast: Array<{ token: string; role: string }>;
  }>;
}

export default function MatterPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/matters/${id}`);
    if (res.ok) setData((await res.json()) as Detail);
  }, [id]);

  // Only while redaction is actually running. Once the matter settles there is
  // nothing to watch, and the page stops asking.
  const working =
    data === null || data.matter.status === "processing" || data.matter.status === "attested";
  const deleted = data?.matter.status === "deleted";
  usePoll(load, working ? 4000 : null);

  async function writeNext() {
    setWriting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/matters/${id}/articles`, { method: "POST" });
      const body = (await res.json()) as
        | Article
        | { exhausted: true; reason: string }
        | { error: string };

      if ("error" in body) setMessage(body.error);
      else if ("exhausted" in body)
        setMessage(`No further distinct article from this matter. ${body.reason}`);
      else await load();
    } finally {
      setWriting(false);
    }
  }

  async function destroy() {
    setDeleting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/matters/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: typed, reason }),
      });
      if (res.ok) router.push("/matters");
      else {
        const body = (await res.json()) as { error?: string };
        setMessage(body.error ?? "Could not delete this matter.");
        setDeleting(false);
      }
    } catch {
      setMessage("Could not reach the server.");
      setDeleting(false);
    }
  }

  if (!data) {
    return (
      <>
        <div className="head">
          <h1>Loading…</h1>
        </div>
      </>
    );
  }

  const { matter, profile, review, articles, documents } = data;
  const words = documents.reduce((n, d) => n + d.words, 0);

  return (
    <>
      <div className="head">
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--faint)", marginBottom: 6 }}>
            <Link href="/matters">Matters</Link> / {matter.reference}
          </div>
          <h1>
            {profile
              ? `${profile.practice_area.replaceAll("_", " ")} · ${profile.jurisdiction.county || "—"} County`
              : matter.reference}
          </h1>
          <p>
            {working
              ? "Redacting — this takes a few minutes."
              : profile
                ? `${profile.jurisdiction.state} · ${profile.outcome_category.replaceAll("_", " ")} · ${profile.time_period.year || "—"} ${profile.time_period.quarter}`
                : matter.error ?? ""}
          </p>
        </div>
        {matter.status === "ready" || matter.status === "needs_review" ? (
          <button className="btn" onClick={writeNext} disabled={writing}>
            {writing ? "Writing…" : "Write the next article"}
          </button>
        ) : null}
      </div>

      <div className="body">
        {working ? (
          <div className="note">
            <span className="dot working" style={{ background: "var(--ox)", marginRight: 8 }} />
            Reading {matter.sourceCount} document{matter.sourceCount === 1 ? "" : "s"}. This page
            updates itself.
          </div>
        ) : null}

        {deleted ? (
          <div className="note">
            <strong>This matter was deleted.</strong>
            <div style={{ marginTop: 6 }}>
              The corpus, the profile, the redaction check and every article drawn from it are
              gone. The attestation below is kept, so the record of who cleared this matter and
              when survives the deletion.
              {matter.deletionReason ? ` Reason given: ${matter.deletionReason}` : ""}
            </div>
          </div>
        ) : null}

        {matter.status === "failed" ? (
          <div className="note" style={{ borderLeftColor: "var(--crit)" }}>
            <strong>Processing failed.</strong>
            <div style={{ marginTop: 6 }}>{matter.error}</div>
          </div>
        ) : null}

        {message ? <div className="note">{message}</div> : null}

        {profile ? (
          <div className="section">
            <h2>Summary</h2>
            <div className="panel" style={{ padding: "18px 20px" }}>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{profile.summary}</p>
            </div>
          </div>
        ) : null}

        {articles.length || matter.status === "ready" || matter.status === "needs_review" ? (
          <div className="section">
            <h2>
              Articles from this matter — {articles.length} written
            </h2>
            <div className="panel">
              {articles.length === 0 ? (
                <div className="empty">
                  Nothing written yet. Each article picks a question the documents answer that is
                  not already on this list.
                </div>
              ) : (
                articles.map((a) => (
                  <Link
                    key={a.id}
                    className="row"
                    href={`/articles/${a.id}`}
                    style={{ gridTemplateColumns: "1fr 150px 100px" }}
                  >
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: 3 }}>{a.headline}</div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>
                        {a.angleId}
                      </div>
                    </div>
                    <GateBadge verdict={a.gate.verdict} />
                    <span
                      className={`pill ${
                        a.status === "approved"
                          ? "pill-good"
                          : a.status === "rejected"
                            ? "pill-muted"
                            : "pill-warn"
                      }`}
                    >
                      {a.status}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        ) : null}

        {profile?.themes.length ? (
          <div className="section">
            <h2>Themes the corpus covers</h2>
            <div className="panel" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {profile.themes.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 13,
                      padding: "4px 10px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--rule)",
                      borderRadius: 3,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {documents.length ? (
          <div className="section">
            <h2>
              Redacted corpus — {words.toLocaleString()} words retained
            </h2>
            <div className="panel">
              {documents.map((d) => (
                <div
                  key={d.index}
                  className="row"
                  style={{ gridTemplateColumns: "40px 1fr 120px", alignItems: "start" }}
                >
                  <div className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>
                    {String(d.index).padStart(2, "0")}
                  </div>
                  <div>
                    <div style={{ fontSize: 14.5 }}>{d.type}</div>
                    {d.illegible > 0 ? (
                      <div style={{ fontSize: 12.5, color: "var(--warn)" }}>
                        {d.illegible} illegible section{d.illegible === 1 ? "" : "s"}
                      </div>
                    ) : null}
                    {/* The cast is generic parts, never names. It is here so a
                        long document stitched from page ranges can be checked
                        by eye: one token should mean one person throughout. */}
                    {d.cast.length ? (
                      <div style={{ marginTop: 8, display: "grid", gap: 2 }}>
                        {d.cast.map((c) => (
                          <div key={c.token} style={{ fontSize: 12.5, color: "var(--muted)" }}>
                            <span className="mono" style={{ color: "var(--faint)" }}>
                              {c.token}
                            </span>{" "}
                            {c.role}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>
                    {d.words.toLocaleString()} words
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {review ? (
          <div className="section">
            <h2>Redaction check</h2>
            <div className="panel" style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
                <span
                  className="dot"
                  style={{
                    background:
                      review.verdict === "clean"
                        ? "var(--good)"
                        : review.verdict === "blocked"
                          ? "var(--crit)"
                          : "var(--warn)",
                  }}
                />
                <strong style={{ fontSize: 14.5 }}>
                  {review.findings.length === 0
                    ? "No identifiers survived substitution"
                    : `${review.findings.length} identifier${review.findings.length === 1 ? "" : "s"} survived`}
                </strong>
              </div>
              {review.findings.map((f, i) => (
                <div key={i} style={{ fontSize: 13.5, color: "var(--ink-2)", marginBottom: 5 }}>
                  <strong>{f.severity.toUpperCase()}</strong> · doc {f.document_index} ·{" "}
                  {f.what_survived}{" "}
                  <span className="mono" style={{ color: "var(--faint)" }}>
                    → {f.suggested_token}
                  </span>
                </div>
              ))}
              <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 12, marginBottom: 0 }}>
                {review.substitution_quality}
              </p>
            </div>
          </div>
        ) : null}

        <div className="section">
          <h2>Attestation on file</h2>
          <div className="panel" style={{ padding: "16px 20px", fontSize: 13.5 }}>
            <div style={{ fontWeight: 500 }}>
              {matter.attestation.attestedBy} · Bar {matter.attestation.barNumber}
            </div>
            <div style={{ color: "var(--faint)", marginTop: 2 }}>
              {new Date(matter.attestation.at).toLocaleString()}
            </div>
            <div style={{ color: "var(--muted)", marginTop: 8, fontSize: 12.5 }}>
              Closed · no protective order · no confidentiality clause · not on appeal · authorized
            </div>
            {matter.processedAt ? (
              <div style={{ color: "var(--good)", marginTop: 10, fontSize: 12.5 }}>
                Source files deleted after processing on{" "}
                {new Date(matter.processedAt).toLocaleString()}.
              </div>
            ) : null}
            {matter.deletedAt ? (
              <div style={{ color: "var(--crit)", marginTop: 10, fontSize: 12.5 }}>
                Matter deleted on {new Date(matter.deletedAt).toLocaleString()}.
              </div>
            ) : null}
          </div>
        </div>

        {/* Deliberately quiet until opened, and deliberately not a browser
            confirm dialog: retyping the reference is the difference between
            meaning it and clicking through. The server checks it again. */}
        {deleted ? null : (
          <div className="section">
            <h2>Delete this matter</h2>
            {confirming ? (
              <div className="panel" style={{ padding: "18px 20px", borderLeft: "3px solid var(--crit)" }}>
                <p style={{ margin: "0 0 4px", fontSize: 14, lineHeight: 1.6 }}>
                  This destroys the redacted corpus, the profile, the redaction check and{" "}
                  {articles.length === 0
                    ? "any articles drawn from it"
                    : `all ${articles.length} article${articles.length === 1 ? "" : "s"} drawn from it`}
                  . The source PDFs were already deleted after processing, so re-creating this
                  matter means uploading them again from the firm&rsquo;s own files.
                </p>
                <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.6, color: "var(--muted)" }}>
                  The attestation is kept — the named attorney, the bar number and the date. An
                  audit should be able to see that a matter was destroyed, not find a gap where
                  one used to be.
                </p>

                {/* Not a <label>: the app's label style uppercases its text,
                    and the reference has to be shown exactly as it must be
                    typed. */}
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>
                  Type{" "}
                  <span className="mono" style={{ color: "var(--ink)" }}>
                    {matter.reference}
                  </span>{" "}
                  to confirm
                </div>
                <input
                  type="text"
                  className="mono"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={matter.reference}
                  style={{ maxWidth: 360, marginBottom: 14 }}
                />

                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>
                  Reason, kept on the record (optional)
                </div>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. redaction check failed"
                  style={{ maxWidth: 360, marginBottom: 18 }}
                />

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    className="btn"
                    onClick={destroy}
                    disabled={deleting || typed.trim() !== matter.reference.trim()}
                    style={{ background: "var(--crit)", borderColor: "var(--crit)" }}
                  >
                    {deleting ? "Deleting…" : "Delete permanently"}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setConfirming(false);
                      setTyped("");
                    }}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="panel" style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                  <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)" }}>
                    Destroys the corpus and every article drawn from it. Keeps the attestation.
                    There is no undo.
                  </p>
                  <button className="btn btn-ghost" onClick={() => setConfirming(true)}>
                    Delete this matter
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
