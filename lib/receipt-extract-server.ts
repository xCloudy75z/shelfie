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

import type { TextItem } from "pdfjs-dist/types/src/display/api";

// pdf.js v6's Node build references DOMMatrix (and Path2D) at MODULE-LOAD time
// (`const SCALE_MATRIX = new DOMMatrix()`), pulling them from the optional
// native package @napi-rs/canvas. That package is present in local dev but is
// NOT reliably included in Vercel's serverless function, so importing pdf.js
// there throws "ReferenceError: DOMMatrix is not defined" before a single byte
// of the receipt is read.
//
// Receipt TEXT extraction never does any of the matrix/drawing math these
// globals are for — they only need to EXIST so the module can load. So we
// provide tiny, dependency-free pure-JS shims and install them BEFORE pdf.js is
// imported. Verified: with the native package hidden (i.e. Vercel's condition)
// this shim yields the exact same, correct text extraction. Only installed when
// the globals are absent, so a real DOMMatrix (browser/native) always wins.
function installPdfGlobals(): void {
  const g = globalThis as Record<string, unknown>;

  if (typeof g.DOMMatrix === "undefined") {
    class DOMMatrixShim {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      constructor(init?: number[]) {
        if (Array.isArray(init) && init.length === 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
        }
      }
      multiply(o: DOMMatrixShim): DOMMatrixShim {
        const r = new DOMMatrixShim();
        r.a = this.a * o.a + this.c * o.b;
        r.b = this.b * o.a + this.d * o.b;
        r.c = this.a * o.c + this.c * o.d;
        r.d = this.b * o.c + this.d * o.d;
        r.e = this.a * o.e + this.c * o.f + this.e;
        r.f = this.b * o.e + this.d * o.f + this.f;
        return r;
      }
      translate(tx = 0, ty = 0): DOMMatrixShim {
        return this.multiply(Object.assign(new DOMMatrixShim(), { e: tx, f: ty }));
      }
      scale(sx = 1, sy = sx): DOMMatrixShim {
        return this.multiply(Object.assign(new DOMMatrixShim(), { a: sx, d: sy }));
      }
    }
    g.DOMMatrix = DOMMatrixShim;
  }

  if (typeof g.Path2D === "undefined") {
    g.Path2D = class Path2DShim {
      addPath(): void {}
      moveTo(): void {}
      lineTo(): void {}
      bezierCurveTo(): void {}
      quadraticCurveTo(): void {}
      closePath(): void {}
      rect(): void {}
    };
  }
}

// pdf.js is imported dynamically (below, inside extract) so the shims above are
// guaranteed installed before pdf.js's module-load code runs. A static top-level
// import would be hoisted ahead of installPdfGlobals() and defeat the purpose.
type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

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
  // Install DOMMatrix/Path2D shims, THEN load pdf.js (order matters — see the
  // note above installPdfGlobals). The dynamic import is cached by the ESM
  // loader, so repeated extractions don't re-parse pdf.js.
  installPdfGlobals();
  const pdfjs: PdfjsModule = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Pre-load pdf.js's worker on the main thread. In Node, pdf.js runs the worker
  // in-process, but by default it fetches the handler via
  //   await import(/* webpackIgnore */ "./pdf.worker.mjs")
  // — that ignore hint makes the bundler SKIP the file, so it's absent on
  // Vercel's serverless function ("Setting up fake worker failed: Cannot find
  // module …/pdf.worker.mjs"). Importing it here with a plain literal specifier
  // forces the bundler to include it, and assigning globalThis.pdfjsWorker makes
  // pdf.js use it directly, never taking the broken dynamic-import path (see
  // PDFWorker.#mainThreadWorkerMessageHandler / _setupFakeWorkerGlobal in pdf.mjs).
  const g = globalThis as Record<string, unknown>;
  if (!g.pdfjsWorker) {
    g.pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  }

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
