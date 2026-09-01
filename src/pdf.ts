import { PDFDocument } from "pdf-lib";

/**
 * Splitting is what makes a very long filing processable at all.
 *
 * A document's redacted output is roughly as long as the document, and the
 * model's output ceiling is shared with its thinking. A 200-page pleading
 * cannot come back in one response at any setting, so it is cut into page
 * ranges locally — deterministically, rather than by asking the model to count
 * pages and hope it respects a range.
 */

/** Below this, a document goes through whole. Above, it is cut into ranges. */
export const PAGES_PER_CHUNK = 30;

export async function pageCount(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

/**
 * Returns one buffer per chunk, in order. A document at or under the chunk size
 * comes back as a single-element array, so callers need no special case.
 */
export async function splitIntoChunks(bytes: Uint8Array): Promise<Uint8Array[]> {
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = source.getPageCount();
  if (total <= PAGES_PER_CHUNK) return [bytes];

  const chunks: Uint8Array[] = [];
  for (let start = 0; start < total; start += PAGES_PER_CHUNK) {
    const end = Math.min(start + PAGES_PER_CHUNK, total);
    const out = await PDFDocument.create();
    const pages = await out.copyPages(
      source,
      Array.from({ length: end - start }, (_, i) => start + i),
    );
    for (const p of pages) out.addPage(p);
    chunks.push(await out.save());
  }
  return chunks;
}

/**
 * Runs tasks with a ceiling on how many are in flight.
 *
 * A matter of twenty documents split into chunks is a lot of simultaneous
 * large requests; unbounded concurrency turns a slow job into a rate-limited
 * one.
 */
export async function pool<T>(limit: number, tasks: Array<() => Promise<T>>): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const index = next;
      next += 1;
      const task = tasks[index];
      if (task) results[index] = await task();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}
