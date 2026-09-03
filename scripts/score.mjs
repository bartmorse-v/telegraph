/**
 *   npm run score -- <matter-id>
 *   npm run score -- <matter-id> --key samples/synthetic-pi-milwaukee/answers.json
 *
 * Grades a redacted corpus against the answer key of the synthetic matter it
 * came from. Every planted identifier is either in the corpus or it is not, and
 * this says which — no model, no judgment, no opinion that shifts between runs.
 *
 * It also checks the other direction. A pass that deleted the whole document
 * would score perfectly on identifiers and be worthless, so the load-bearing
 * legal facts are counted too. Both halves have to hold.
 */
import fs from "node:fs";
import path from "node:path";

const [, , matterId, ...rest] = process.argv;
const flag = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? fallback : rest[i + 1];
};

if (!matterId) {
  console.error("usage: npm run score -- <matter-id> [--key <answers.json>]");
  process.exit(2);
}

const keyPath = flag("key", path.join("samples", "synthetic-pi-milwaukee", "answers.json"));
if (!fs.existsSync(keyPath)) {
  console.error(`No answer key at ${keyPath}. Run \`npm run synthesize\` first.`);
  process.exit(2);
}

const corpusDir = path.join("data", "matters", matterId, "corpus");
if (!fs.existsSync(corpusDir)) {
  console.error(
    `No corpus at ${corpusDir}. Check the matter id in the browser address bar, and that processing finished.`,
  );
  process.exit(2);
}

const { identifiers, retain } = JSON.parse(fs.readFileSync(keyPath, "utf8"));
const documents = fs
  .readdirSync(corpusDir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(corpusDir, f), "utf8")));

const corpus = documents.map((d) => d.content).join("\n\n");
const cast = documents.flatMap((d) => d.cast ?? []);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Short values need word boundaries — "HCM" would otherwise match inside an
 * unrelated word and report a leak that is not there. Long values are matched
 * as written, because a surname inside a longer name is still that surname.
 */
function occurrences(haystack, needle) {
  const pattern =
    needle.length <= 6 && /^[A-Za-z0-9]+$/.test(needle)
      ? new RegExp(`\\b${escape(needle)}\\b`, "gi")
      : new RegExp(escape(needle), "gi");
  return (haystack.match(pattern) ?? []).length;
}

const results = identifiers.map((entry) => ({
  ...entry,
  count: occurrences(corpus, entry.value),
  // A role description that names the person defeats the point of the cast.
  inCast: cast.filter((c) => occurrences(c.role, entry.value) > 0).length,
}));

const survived = results.filter((r) => r.count > 0 || r.inCast > 0);
const bySeverity = { high: 0, medium: 0, low: 0 };
for (const s of survived) bySeverity[s.severity] += 1;

const kept = retain.map((value) => ({ value, count: occurrences(corpus, value) }));
const lost = kept.filter((k) => k.count === 0);

const words = corpus.trim().split(/\s+/).filter(Boolean).length;

console.log(
  `\n${documents.length} documents · ${words.toLocaleString()} words retained · ${cast.length} cast entries\n`,
);

console.log(`IDENTIFIERS  ${identifiers.length - survived.length} of ${identifiers.length} removed`);
if (survived.length === 0) {
  console.log(`  nothing planted in the source survived redaction.`);
} else {
  for (const s of survived.sort((a, b) => b.count - a.count)) {
    const where = s.inCast > 0 ? `  (${s.inCast} in the cast)` : "";
    console.log(
      `  ${s.severity.toUpperCase().padEnd(6)} ${String(s.count).padStart(4)}x  ${s.category.padEnd(24)} ${s.value}${where}`,
    );
  }
  console.log(
    `\n  ${bySeverity.high} high, ${bySeverity.medium} medium, ${bySeverity.low} low`,
  );
}

console.log(`\nRETAINED     ${kept.length - lost.length} of ${kept.length} legal facts still present`);
if (lost.length) {
  console.log(`  missing, which means redaction took content with it:`);
  for (const l of lost) console.log(`    ${l.value}`);
}

// This file is the source, so its own identifiers are safe to print. Never run
// a scorer like this against a real matter — there is no key to run it with,
// and building one would mean writing down what the tokens replaced.
const pass = survived.length === 0 && lost.length === 0;
console.log(`\n${pass ? "PASS" : "FAIL"} — ${
  pass
    ? "every identifier gone, every legal fact kept"
    : `${survived.length} identifier${survived.length === 1 ? "" : "s"} survived, ${lost.length} fact${lost.length === 1 ? "" : "s"} lost`
}\n`);

process.exit(pass ? 0 : 1);
