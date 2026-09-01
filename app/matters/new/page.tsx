"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const CONFIRMATIONS = [
  ["closed", "This matter is closed, with no further action pending."],
  ["noProtectiveOrder", "It is not subject to a protective or sealing order."],
  [
    "noConfidentialityClause",
    "No settlement confidentiality clause restricts discussing it generally.",
  ],
  ["notOnAppeal", "It is not on appeal or within an appeal window."],
  ["authorized", "I am authorized to release it for de-identified content use."],
] as const;

/**
 * The attestation is part of this form, not a settings page somebody visits
 * once. Nothing is processed without it, and the server checks it again — the
 * record is what protects the firm, so it cannot be bypassed by anything that
 * can post a form.
 */
export default function NewMatter() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [reference, setReference] = useState("");
  const [attestedBy, setAttestedBy] = useState("");
  const [barNumber, setBarNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = CONFIRMATIONS.filter(([key]) => !checked[key]).length;
  const ready =
    files.length > 0 && reference.trim() && attestedBy.trim() && barNumber.trim() && remaining === 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);

    const form = new FormData();
    form.set("reference", reference);
    form.set("attestedBy", attestedBy);
    form.set("barNumber", barNumber);
    for (const [key] of CONFIRMATIONS) if (checked[key]) form.set(key, "on");
    for (const file of files) form.append("files", file);

    const res = await fetch("/api/matters", { method: "POST", body: form });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Upload failed.");
      setBusy(false);
      return;
    }
    const matter = (await res.json()) as { id: string };
    router.push(`/matters/${matter.id}`);
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>Add a matter</h1>
          <p>Every file for one closed matter. Nothing is read until you attest below.</p>
        </div>
      </div>

      <div className="body">
        <form onSubmit={submit} style={{ display: "grid", gap: 28, gridTemplateColumns: "1fr 400px" }}>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label htmlFor="reference">Your matter reference</label>
              <input
                id="reference"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="BC-0114"
              />
              <div style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 6 }}>
                Use your own numbering — never a client name. This is the only label stored, and
                filenames are never sent to the model.
              </div>
            </div>

            <div>
              <label htmlFor="files">Documents</label>
              <input
                id="files"
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                style={{ fontSize: 14 }}
              />
              <div style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 6 }}>
                All documents for one matter. They are read together, then deleted.
              </div>
            </div>

            {files.length > 0 ? (
              <div className="panel">
                <div className="thead row" style={{ gridTemplateColumns: "1fr 90px" }}>
                  <div>File</div>
                  <div>Size</div>
                </div>
                {files.map((f) => (
                  <div key={f.name} className="row" style={{ gridTemplateColumns: "1fr 90px" }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.name}
                    </div>
                    <div className="mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>
                      {(f.size / 1_000_000).toFixed(1)} MB
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {error ? (
              <div className="note" style={{ borderLeftColor: "var(--crit)", color: "var(--crit)" }}>
                {error}
              </div>
            ) : null}
          </div>

          <div className="panel" style={{ borderColor: "var(--ox)", alignSelf: "start" }}>
            <div
              className="mono"
              style={{
                background: "var(--ox)",
                color: "#fff",
                padding: "12px 20px",
                fontSize: 10.5,
                letterSpacing: "0.13em",
                textTransform: "uppercase",
              }}
            >
              Eligibility attestation — required
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 15 }}>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-2)" }}>
                Confirm each of the following. This is recorded against your name and bar number and
                kept permanently.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {CONFIRMATIONS.map(([key, text]) => (
                  <label
                    key={key}
                    htmlFor={key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "18px 1fr",
                      gap: 11,
                      alignItems: "start",
                      textTransform: "none",
                      letterSpacing: 0,
                      fontFamily: "inherit",
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      color: "var(--ink)",
                      margin: 0,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      id={key}
                      type="checkbox"
                      checked={Boolean(checked[key])}
                      onChange={(e) => setChecked((c) => ({ ...c, [key]: e.target.checked }))}
                      style={{ marginTop: 3, accentColor: "var(--ox)" }}
                    />
                    <span>{text}</span>
                  </label>
                ))}
              </div>

              <div style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 15, display: "grid", gap: 12 }}>
                <div>
                  <label htmlFor="attestedBy">Attesting attorney</label>
                  <input
                    id="attestedBy"
                    type="text"
                    value={attestedBy}
                    onChange={(e) => setAttestedBy(e.target.value)}
                    placeholder="M. Cerjak"
                  />
                </div>
                <div>
                  <label htmlFor="barNumber">Bar number</label>
                  <input
                    id="barNumber"
                    type="text"
                    value={barNumber}
                    onChange={(e) => setBarNumber(e.target.value)}
                    placeholder="448201"
                  />
                </div>
              </div>

              <button className="btn" type="submit" disabled={!ready || busy}>
                {busy ? "Uploading…" : "Attest and begin processing"}
              </button>
              {!ready && !busy ? (
                <div style={{ fontSize: 12, color: "var(--faint)", textAlign: "center" }}>
                  {files.length === 0
                    ? "No documents selected"
                    : remaining > 0
                      ? `${remaining} box${remaining === 1 ? "" : "es"} remaining`
                      : "Reference and attorney details required"}
                </div>
              ) : null}
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
