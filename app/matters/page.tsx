"use client";

import Link from "next/link";
import { useState } from "react";
import { usePoll } from "../use-poll";
import type { MatterMeta } from "../../src/store";

const STATUS: Record<MatterMeta["status"], [string, string]> = {
  attested: ["pill-muted", "queued"],
  processing: ["pill-muted", "processing"],
  ready: ["pill-good", "ready"],
  needs_review: ["pill-warn", "needs review"],
  blocked: ["pill-crit", "blocked"],
  failed: ["pill-crit", "failed"],
  deleted: ["pill-muted", "deleted"],
};

export default function Matters() {
  const [matters, setMatters] = useState<MatterMeta[] | null>(null);

  const working = matters?.some((m) => m.status === "processing" || m.status === "attested");
  usePoll(
    async () => {
      const res = await fetch("/api/matters");
      if (res.ok) setMatters((await res.json()) as MatterMeta[]);
    },
    matters === null || working ? 4000 : null,
  );

  return (
    <>
      <div className="head">
        <div>
          <h1>Matters</h1>
          <p>
            {matters === null
              ? "Loading…"
              : `${matters.length} matter${matters.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link className="btn" href="/matters/new">
          Add a matter
        </Link>
      </div>

      <div className="body">
        <div className="panel">
          <div className="thead row" style={{ gridTemplateColumns: "1fr 110px 120px 110px" }}>
            <div>Reference</div>
            <div>Documents</div>
            <div>Added</div>
            <div>Status</div>
          </div>
          {matters === null ? (
            <div className="empty">Loading…</div>
          ) : matters.length === 0 ? (
            <div className="empty">
              No matters yet. Add one to get started.
            </div>
          ) : (
            matters.map((m) => {
              const [cls, label] = STATUS[m.status];
              return (
                <Link
                  key={m.id}
                  className="row"
                  href={`/matters/${m.id}`}
                  style={{ gridTemplateColumns: "1fr 110px 120px 110px" }}
                >
                  <div
                    style={{
                      fontWeight: 500,
                      color: m.status === "deleted" ? "var(--faint)" : undefined,
                      textDecoration: m.status === "deleted" ? "line-through" : undefined,
                    }}
                  >
                    {m.reference}
                  </div>
                  <div className="mono" style={{ fontSize: 13, color: "var(--muted)" }}>
                    {m.sourceCount}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--faint)" }}>
                    {new Date(m.createdAt).toLocaleDateString()}
                  </div>
                  <div>
                    <span className={`pill ${cls}`}>{label}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
