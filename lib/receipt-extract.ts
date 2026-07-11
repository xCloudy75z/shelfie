// On-device PDF text extraction for Carrefour receipts.
//
// This module runs ONLY in the browser. It is imported dynamically from the
// client-side receipt-import UI (Task 4) so pdfjs-dist is never pulled into a
// server route. Do NOT import it from a Server Component or Server Action —
// pdfjs relies on browser globals (Worker, DOMMatrix, etc.).
//
// The user's PDF never leaves their device: we read the file's bytes, parse
// them locally with pdf.js, and only the reconstructed text lines are handed
// back to the parser. Nothing is uploaded.

import * as pdfjs from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

// Point pdf.js at its bundled worker. Using `new URL(..., import.meta.url)`
// lets the bundler (webpack, in Next 15) fingerprint and emit the worker as a
// static asset and hand back the correct URL at runtime. The worker version is
// therefore always locked to the installed pdfjs-dist version.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// Rows whose baseline y-coordinates fall within this many PDF units are treated
// as the same visual line. Receipt rows are well separated, so a 2-unit bucket
// keeps a line's cells together without merging adjacent lines.
const ROW_BUCKET = 2;

/**
 * Extract the visible text of a receipt PDF as an ordered array of row strings.
 *
 * Text items are grouped into rows by their baseline y-coordinate (bucketed to
 * the nearest {@link ROW_BUCKET} units), each row's cells are ordered left→right
 * by x, and the cells are joined with a single space. Rows are returned
 * top→bottom, pages in order.
 *
 * Rejects (does not swallow) if pdf.js cannot parse the file — e.g. the user
 * picked something that is not a PDF — so the calling UI can show a friendly
 * error.
 */
export async function extractReceiptLines(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: buf });
  const doc = await loadingTask.promise;

  const lines: string[] = [];

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const tc = await page.getTextContent();

      // Bucket text items into rows keyed by rounded baseline y.
      const rows = new Map<number, { x: number; str: string }[]>();

      for (const item of tc.items) {
        // TextContent.items is (TextItem | TextMarkedContent)[]; only TextItem
        // has `str`/`transform`. Skip marked-content markers and blank cells.
        if (!("str" in item)) continue;
        const t = item as TextItem;
        if (!t.str || !t.str.trim()) continue;

        const x = t.transform[4] as number;
        const y = t.transform[5] as number;
        const key = Math.round(y / ROW_BUCKET) * ROW_BUCKET;

        const bucket = rows.get(key);
        if (bucket) bucket.push({ x, str: t.str });
        else rows.set(key, [{ x, str: t.str }]);
      }

      // Order rows top→bottom (descending y — PDF origin is bottom-left).
      const orderedKeys = [...rows.keys()].sort((a, b) => b - a);

      for (const key of orderedKeys) {
        const cells = rows.get(key)!;
        cells.sort((a, b) => a.x - b.x);
        const line = cells
          .map((c) => c.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (line) lines.push(line);
      }

      // Release page resources as we go (large receipts stay light on memory).
      page.cleanup();
    }
  } finally {
    // Always tear down the worker/document, even if a page fails midway.
    await loadingTask.destroy();
  }

  return lines;
}
