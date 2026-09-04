"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import type { Article } from "../../../src/store";

/**
 * Markdown goes through `dangerouslySetInnerHTML`, so any raw HTML in the
 * article body would execute here — in the session of the one person allowed
 * to approve articles.
 *
 * The path is real end to end rather than theoretical: redaction's whole job is
 * to reproduce a document faithfully, so an exhibit containing an `<img src=x
 * onerror=...>` — a printed email, a web page, a code listing — reaches the
 * corpus intact and can reach an article from there.
 *
 * Escaping before parsing rather than sanitizing after keeps this independent
 * of any library's HTML allowlist, and costs nothing: a legal article has no
 * business carrying raw HTML, and anything that looks like a tag should render
 * as the text it is.
 */
function escapeHtml(markdown: string): string {
  return markdown.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const CHECK_LABELS: Record<string, string> = {
  re_identification: "Re-identification",
  jurisdictional_accuracy: "Jurisdictional accuracy",
  groundedness: "Groundedness",
  advertising_compliance: "Advertising compliance",
  advice_framing: "Advice framing",
  structure: "Structure",
};

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [approvedBy, setApprovedBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/articles/${id}`);
      if (res.ok) setArticle((await res.json()) as Article);
    })();
  }, [id]);

  const html = useMemo(
    () => (article ? marked.parse(escapeHtml(article.body), { async: false }) : ""),
    [article],
  );

  async function act(action: "approve" | "reject") {
    if (!article || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/articles/${article.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, approvedBy }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "That did not work.");
      setBusy(false);
      return;
    }
    router.push(`/matters/${article.matterId}`);
  }

  if (!article) {
    return (
      <div className="head">
        <h1>Loading…</h1>
      </div>
    );
  }

  const blocked = article.gate.verdict === "block";

  return (
    <>
      <div className="head">
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--faint)", marginBottom: 6 }}>
            <Link href={`/matters/${article.matterId}`}>Matter</Link> / {article.angleId}
          </div>
          <h1 style={{ fontSize: 22 }}>Review before publishing</h1>
          <p>{article.readerSituation}</p>
        </div>
      </div>

      <div className="body" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 32, maxWidth: 1180 }}>
        <div style={{ minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--ox)", marginBottom: 14 }}>
            {article.status === "draft" ? "Draft · not published" : article.status}
          </div>

          <h2
            className="serif"
            style={{
              fontSize: 30,
              fontWeight: 600,
              lineHeight: 1.2,
              letterSpacing: "-0.015em",
              margin: "0 0 20px",
              textTransform: "none",
              color: "var(--ink)",
            }}
          >
            {article.headline}
          </h2>

          <div
            style={{
              borderLeft: "3px solid var(--ox)",
              background: "var(--surface)",
              padding: "16px 20px",
              marginBottom: 22,
            }}
          >
            <div
              className="mono"
              style={{ fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 7 }}
            >
              Answer block · {article.answerBlock.trim().split(/\s+/).length} words
            </div>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55 }}>{article.answerBlock}</p>
          </div>

          <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
        </div>

        <div style={{ alignSelf: "start", position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 22 }}>
          <div className="panel" style={{ padding: 18 }}>
            <h2 style={{ marginBottom: 12 }}>Checks</h2>
            {article.gate.checks.map((c) => (
              <div
                key={c.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "16px 1fr",
                  gap: 10,
                  alignItems: "start",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--rule-soft)",
                }}
              >
                <span
                  className="dot"
                  style={{
                    marginTop: 6,
                    background: c.passed
                      ? "var(--good)"
                      : c.severity === "block"
                        ? "var(--crit)"
                        : "var(--warn)",
                  }}
                />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                    {CHECK_LABELS[c.name] ?? c.name}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45 }}>
                    {c.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {blocked ? (
            <div className="note" style={{ borderLeftColor: "var(--crit)" }}>
              <strong>Blocked.</strong>
              <div style={{ marginTop: 6, fontSize: 13.5 }}>
                A blocking check failed, so this cannot be approved. Reject it and write another —
                the angle stays on the ledger either way, so the next article will pick something
                else.
              </div>
            </div>
          ) : null}

          {article.status === "draft" ? (
            <div className="panel" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label htmlFor="approvedBy">Approving attorney</label>
                <input
                  id="approvedBy"
                  type="text"
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  placeholder="M. Cerjak"
                  disabled={blocked}
                />
              </div>
              {error ? (
                <div style={{ fontSize: 13, color: "var(--crit)" }}>{error}</div>
              ) : null}
              <button
                className="btn"
                onClick={() => act("approve")}
                disabled={blocked || busy || !approvedBy.trim()}
              >
                Approve
              </button>
              <button className="btn btn-ghost" onClick={() => act("reject")} disabled={busy}>
                Reject
              </button>
              <div style={{ fontSize: 12, color: "var(--faint)", lineHeight: 1.5 }}>
                Approving records your name, the time, and this exact version.
              </div>
            </div>
          ) : (
            <div className="panel" style={{ padding: 18, fontSize: 13.5 }}>
              <strong>{article.status === "approved" ? "Approved" : "Rejected"}</strong>
              {article.approvedBy ? (
                <div style={{ color: "var(--muted)", marginTop: 4 }}>
                  {article.approvedBy} ·{" "}
                  {article.approvedAt ? new Date(article.approvedAt).toLocaleString() : ""}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
