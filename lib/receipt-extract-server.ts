// Server-side PDF text extraction for Carrefour receipts (Node only).
//
// This module runs ONLY in a Node/serverless environment. It is imported
// dynamically from a Server Action (app/actions/receipt.ts) — NEVER from a
// client component. In Node, pdf.js runs its extraction on the main thread
// (no Web Worker), which is exactly the configuration proven to parse a real
// Carrefour receipt in ~2s (28 items, correct prices, total matched).
//
// Why server-side: the client-side (browser) pdf.js path hangs on iOS Safari —
// its Web Worker spawns but never signals ready, and pdf.js only falls back to
// the main thread when the worker *errors*, not when it *hangs*. Running the
// identical extraction in Node sidesteps that entirely.
//
// The uploaded PDF bytes are handed in, extracted, and discarded by the caller
// when the request returns. This module never logs file contents.

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

// Rows whose baseline y-coordinates fall within this many PDF units are treated
// as the same visual line. Receipt rows are well separated, so a 2-unit bucket
// keeps a line's cells together without merging adjacent lines. (Mirrors
// lib/receipt-extract.ts.)
const ROW_BUCKET = 2;

// Hard ceiling on a single extraction so a pathological PDF can't hang the
// serverless function forever.
const EXTRACT_TIMEOUT_MS = 30_000;

/**
 * Extract the visible text of a receipt PDF as an ordered array of row strings.
 *
 * Text items are grouped into rows by their baseline y-coordinate (bucketed to
 * the nearest {@link ROW_BUCKET} units), each row's cells are ordered left→right
 * by x, and the cells are joined with a single space. Rows are returned
 * top→bottom, pages in order. Reconstruction mirrors lib/receipt-extract.ts
 * exactly so the shared parser sees identical input.
 *
 * Throws (does not swallow) if pdf.js cannot parse the file, so the calling
 * action can return a friendly error.
 */
export async function extractReceiptLinesServer(
  data: Uint8Array,
): Promise<string[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(`TIMEOUT: extraction exceeded ${EXTRACT_TIMEOUT_MS / 1000}s`),
        ),
      EXTRACT_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([extract(data), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function extract(data: Uint8Array): Promise<string[]> {
  // This exact config is the proven-working one: in Node pdf.js runs on the
  // main thread, and useSystemFonts:true decodes fonts without needing the
  // shipped cmap/standard-font assets.
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
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
