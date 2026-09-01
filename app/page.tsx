"use client";

import Link from "next/link";
import { useState } from "react";
import { usePoll } from "./use-poll";
import type { Article, MatterMeta } from "../src/store";

interface Queue {
  drafts: Article[];
  attention: MatterMeta[];
  processing: MatterMeta[];
}

export default function Home() {
  const [queue, setQueue] = useState<Queue | null>(null);

  // Processing takes minutes, so the screen refreshes itself while a matter is
  // in flight — and stops once nothing is, rather than polling forever.
  usePoll(
    async () => {
      const res = await fetch("/api/review-queue");
      if (res.ok) setQueue((await res.json()) as Queue);
    },
    queue === null || queue.processing.length > 0 ? 4000 : 20000,
  );

  const total = queue ? queue.drafts.length + queue.attention.length : 0;

  return (
    <>
      <div className="head">
        <div>
          <h1>Needs you</h1>
          <p>
            {queue === null
              ? "Loading…"
              : total === 0
                ? "Nothing is waiting on you."
                : `${total} item${total === 1 ? "" : "s"} waiting.`}
          </p>
        </div>
        <Link className="btn" href="/matters/new">
          Add a matter
        </Link>
      </div>

      <div className="body">
        {queue?.processing.length ? (
          <div className="section">
            <h2>Processing</h2>
            <div className="panel">
              {queue.processing.map((m) => (
                <div key={m.id} className="row" style={{ gridTemplateColumns: "1fr auto" }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{m.reference}</div>
                    <div style={{ fontSize: 13, color: "var(--faint)" }}>
                      {m.sourceCount} document{m.sourceCount === 1 ? "" : "s"} · redacting
                    </div>
                  </div>
                  <span className="dot working" style={{ background: "var(--ox)" }} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="section">
          <h2>Articles awaiting your review</h2>
          <div className="panel">
            {queue === null ? (
              <div className="empty">Loading…</div>
            ) : queue.drafts.length === 0 ? (
              <div className="empty">No drafts waiting.</div>
            ) : (
              queue.drafts.map((a) => (
                <Link
                  key={a.id}
                  className="row"
                  href={`/articles/${a.id}`}
                  style={{ gridTemplateColumns: "1fr 150px 90px" }}
                >
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: 3 }}>{a.headline}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>
                      {a.angleId}
                    </div>
                  </div>
                  <GateBadge verdict={a.gate.verdict} />
                  <span className="btn" style={{ textAlign: "center" }}>
                    Review
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {queue?.attention.length ? (
          <div className="section">
            <h2>Matters needing attention</h2>
            <div className="panel">
              {queue.attention.map((m) => (
                <Link
                  key={m.id}
                  className="row"
                  href={`/matters/${m.id}`}
                  style={{ gridTemplateColumns: "1fr auto" }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{m.reference}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>
                      {m.status === "blocked"
                        ? "Identifiers survived redaction"
                        : m.status === "failed"
                          ? "Processing failed"
                          : "Redaction needs a look"}
                    </div>
                  </div>
                  <span className={`pill ${m.status === "blocked" ? "pill-crit" : "pill-warn"}`}>
                    {m.status.replace("_", " ")}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

export function GateBadge({ verdict }: { verdict: "pass" | "flag" | "block" }) {
  const map = {
    pass: ["pill-good", "All checks passed"],
    flag: ["pill-warn", "Flagged"],
    block: ["pill-crit", "Blocked"],
  } as const;
  const [cls, label] = map[verdict];
  return <span className={`pill ${cls}`}>{label}</span>;
}
