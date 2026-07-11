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

// Use pdf.js's LEGACY (compatibility) build in the browser.
//
// Evidence (iOS 18 Safari, main thread, latest build): the MODERN build hangs at
// "opening document" — getDocument().promise never resolves — even with the
// Web Worker disabled. The exact same code parses these receipts in ~2s under
// Node, where pdf.js loads its `legacy` build. The legacy build is pdf.js's
// documented choice for WebKit / embedded / older-runtime compatibility, so we
// use it here to match the proven-working configuration.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
// @ts-expect-error — the minified worker bundle ships no type declarations
import { WorkerMessageHandler } from "pdfjs-dist/legacy/build/pdf.worker.min.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

// Run pdf.js ON THE MAIN THREAD — never spawn a Web Worker.
//
// Root cause of the iOS receipt-import hang (verified against pdf.js source,
// PDFWorker in pdfjs-dist): in the browser pdf.js spawns a module Web Worker and
// waits for its "ready" message. On iOS Safari — inside our installed PWA — that
// worker spawns but never signals ready, and pdf.js only falls back to the main
// thread when the worker *errors*, NOT when it *hangs*. So getDocument() waited
// forever (our 45s timeout fired). Node avoids this by running on the main
// thread, which is exactly why the same code parses these receipts correctly
// there.
//
// pdf.js uses its main-thread ("fake worker") path when
// `globalThis.pdfjsWorker.WorkerMessageHandler` is present (see PDFWorker's
// #mainThreadWorkerMessageHandler / _setupFakeWorkerGlobal). Pre-registering it
// means no real Worker is ever created. Receipts are tiny (2–3 pages), so
// main-thread extraction is fast and won't jank the UI.
(
  globalThis as unknown as { pdfjsWorker?: { WorkerMessageHandler: unknown } }
).pdfjsWorker = { WorkerMessageHandler };

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
/**
 * "function" when the main-thread worker handler loaded (the iOS worker-hang fix
 * is active); "undefined" if it somehow didn't. Surfaced in the import
 * diagnostics so a failure tells us whether the fix is even in effect.
 */
export const PDF_WORKER_HANDLER_TYPE: string = typeof WorkerMessageHandler;

export async function extractReceiptLines(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer();

  // Track how far extraction gets so a stall reports WHERE it stalled (opening
  // the document vs reading a page's text) instead of a generic timeout.
  const progress = { stage: "starting" };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `TIMEOUT: stalled at [${progress.stage}] after ${EXTRACT_TIMEOUT_MS / 1000}s`,
          ),
        ),
      EXTRACT_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([extract(buf, progress), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function extract(
  buf: ArrayBuffer,
  progress: { stage: string },
): Promise<string[]> {
  progress.stage = "opening document";
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

  progress.stage = `opened (${doc.numPages} pages)`;
  const lines: string[] = [];

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      progress.stage = `page ${pageNum}/${doc.numPages}: get text`;
      const page = await doc.getPage(pageNum);
      const tc = await page.getTextContent();
      progress.stage = `page ${pageNum}/${doc.numPages}: grouping`;

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
