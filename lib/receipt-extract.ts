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

// Point pdf.js at its runtime assets, which are copied into /public/pdfjs by
// scripts/copy-pdf-assets.mjs on every install. A plain static public path is
// more reliable than the `new URL(..., import.meta.url)` bundler trick,
// especially on mobile Safari.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

// URLs (served from /public) for the CMap tables and standard-font data.
// pdf.js needs the CMaps to decode Arabic / CID-keyed fonts; without them
// getTextContent() stalls forever on Carrefour's Arabic receipts.
const CMAP_URL = "/pdfjs/cmaps/";
const STANDARD_FONT_DATA_URL = "/pdfjs/standard_fonts/";

// Hard ceiling on a single extraction. If pdf.js still can't make progress
// (e.g. a font asset failed to load), we reject with a friendly message rather
// than spinning forever.
const EXTRACT_TIMEOUT_MS = 45_000;

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

  // Race the extraction against a timeout so a stalled read (e.g. a missing
  // font asset) surfaces as a friendly error instead of an infinite spinner.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error("TIMEOUT: Reading the PDF timed out. Please try again."),
        ),
      EXTRACT_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([extract(buf), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function extract(buf: ArrayBuffer): Promise<string[]> {
  const loadingTask = pdfjs.getDocument({
    data: buf,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  });

  // Stage 1 — open the document. If pdf.js can't even parse the file header
  // (not a PDF, corrupt bytes, password-protected), tag the failure so the UI
  // can surface *which* stage broke rather than a generic error.
  let doc: Awaited<typeof loadingTask.promise>;
  try {
    doc = await loadingTask.promise;
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : typeof e === "string" ? e : String(e);
    throw new Error("OPEN_FAILED: " + msg);
  }

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
