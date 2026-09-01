"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MatterMeta } from "../../src/store";

const STATUS: Record<MatterMeta["status"], [string, string]> = {
  attested: ["pill-muted", "queued"],
  processing: ["pill-muted", "processing"],
  ready: ["pill-good", "ready"],
  needs_review: ["pill-warn", "needs review"],
  blocked: ["pill-crit", "blocked"],
  failed: ["pill-crit", "failed"],
};

export default function Matters() {
  const [matters, setMatters] = useState<MatterMeta[] | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/matters");
      if (res.ok) setMatters((await res.json()) as MatterMeta[]);
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

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
                  <div style={{ fontWeight: 500 }}>{m.reference}</div>
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
