/**
 *   npm run synthesize
 *   npm run synthesize -- --visits 60      (long enough to be split into ranges)
 *
 * Writes an invented closed personal injury matter as PDFs, plus the answer key
 * listing every identifier planted in them.
 *
 * Two real matters have now gone through this pipeline, and both were the wrong
 * shape to answer the question that matters. Business disputes in one county
 * are identifiable however well the redaction works, and neither file contained
 * a result to write about. This one is a motor vehicle case in a county of
 * nearly a million people, and it settles.
 *
 * The point of inventing it is not convenience. It is that a real matter can
 * only be graded by asking a model whether the redaction looked thorough, and
 * a model will answer confidently either way. Here the grader has the list.
 */
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { answerKey, RETAIN } from "./synthetic-matter.mjs";
import { complaint, answer, demand, ime, release, chronology } from "./documents.mjs";

const PAGE = { w: 612, h: 792 };
const MARGIN = 72;
const SIZE = 11;
const LEADING = 15.5;
const WIDTH = PAGE.w - MARGIN * 2;

/** pdf-lib's standard fonts encode WinAnsi, so anything outside it must go. */
const ascii = (s) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "");

function wrap(text, font, size, width) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const trial = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(trial, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function render(doc, outPath) {
  const pdf = await PDFDocument.create();
  const roman = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  let page = pdf.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - MARGIN;
  let pageIndex = 0;

  const stamp = () => {
    // A production number in the footer of every page, which is exactly where
    // one survived redaction on a real matter.
    const label = `${doc.bates}-${String(doc.batesStart + pageIndex).padStart(6, "0")}`;
    page.drawText(label, {
      x: PAGE.w - MARGIN - roman.widthOfTextAtSize(label, 9),
      y: MARGIN - 28,
      size: 9,
      font: roman,
      color: rgb(0.35, 0.35, 0.35),
    });
  };

  stamp();

  const newPage = () => {
    page = pdf.addPage([PAGE.w, PAGE.h]);
    pageIndex += 1;
    y = PAGE.h - MARGIN;
    stamp();
  };

  const write = (text, font, { indent = 0, centre = false } = {}) => {
    for (const line of wrap(ascii(text), font, SIZE, WIDTH - indent)) {
      if (y < MARGIN + 24) newPage();
      const x = centre
        ? (PAGE.w - font.widthOfTextAtSize(line, SIZE)) / 2
        : MARGIN + indent;
      page.drawText(line, { x, y, size: SIZE, font });
      y -= LEADING;
    }
  };

  for (const block of doc.body) {
    switch (block.type) {
      case "gap":
        y -= LEADING * 0.7;
        break;
      case "rule":
        if (y < MARGIN + 24) newPage();
        y -= 4;
        page.drawLine({
          start: { x: MARGIN, y },
          end: { x: PAGE.w - MARGIN, y },
          thickness: 0.75,
          color: rgb(0.2, 0.2, 0.2),
        });
        y -= LEADING;
        break;
      case "center":
        write(block.text, bold, { centre: true });
        break;
      case "h":
        y -= LEADING * 0.4;
        write(block.text, bold);
        break;
      case "num":
        write(`${block.n}.  ${block.text}`, roman, { indent: 18 });
        y -= LEADING * 0.35;
        break;
      default:
        write(block.text, roman);
        y -= LEADING * 0.35;
    }
  }

  fs.writeFileSync(outPath, await pdf.save());
  return pdf.getPageCount();
}

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};

const outDir = arg("out", path.join("samples", "synthetic-pi-milwaukee"));
const visits = Number(arg("visits", "26"));

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const documents = [complaint(), answer(), demand(), ime(), release(), chronology(visits)];

let pages = 0;
for (const doc of documents) {
  const count = await render(doc, path.join(outDir, doc.file));
  pages += count;
  console.log(`  ${String(count).padStart(3)} pp  ${doc.file}`);
}

const key = answerKey();
fs.writeFileSync(
  path.join(outDir, "answers.json"),
  `${JSON.stringify(
    {
      matter: "Invented closed personal injury matter, Milwaukee County, Wisconsin",
      warning:
        "Synthetic. The people, companies and events are invented and the law is illustrative. Nothing written from this file may be published.",
      generated: new Date().toISOString(),
      identifiers: key,
      retain: RETAIN,
    },
    null,
    2,
  )}\n`,
);

console.log(
  `\n${documents.length} documents · ${pages} pages · ${key.length} planted identifiers`,
);
console.log(`Written to ${outDir}/`);
console.log(`\nUpload the PDFs as one matter, reference it SYNTHETIC-001, then:`);
console.log(`  npm run score -- <matter-id>`);
