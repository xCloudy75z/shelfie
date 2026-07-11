# Shelfie — Plan 2: Carrefour PDF Receipt Import

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. **All agents on Opus** (owner instruction).

**Goal:** On the Log tab, import the emailed Carrefour "Tax Invoice" PDF entirely on-device: parse every line into item + qty + unit price + line total, let the user review/fix, and save the whole trip in one tap — with total self-check, duplicate protection, and no raw receipt ever leaving the browser.

**Architecture:** The PDF is read **client-side** with `pdfjs-dist` (already installed). A pure `parseReceipt` turns coordinate-reconstructed text lines into draft rows; the browser shows a review screen; a server action creates items+purchases with dedupe. Privacy: only extracted item names + prices (not personal data) are sent to the server; the PDF stays on the device.

**Real layout (confirmed from two real receipts, coordinate-read):** each item is one visual row —
`<Description> <Qty> <UnitPriceInclVAT> <UnitPriceExclVAT> <TotalPriceExclVAT> <VATRate> <VATAmount> <TotPriceInclVAT>` — followed by a `Barcode: <n>` line. Weighed items have a fractional Qty (e.g. `0.425` = kg) and a per-kg unit price; counted items have a whole Qty. The receipt ends with `Total Amount Incl. VAT … AED <grand>` and (if a discount applied) `Amount : AED <paid>`.

**Working location:** `C:\Users\games\Documents\xCloudy\IDEAS\Shelfie` on `main`. NO local DB — build/typecheck/tests DB-free; live-verify the flow on Vercel. `pdfjs-dist` is already in package.json.

---

## File Structure
```
lib/receipt.ts              # PURE parser: lines[] -> draft items + totals (TDD)
lib/receipt-extract.ts      # browser: File -> reconstructed text lines via pdfjs-dist
app/actions/receipt.ts      # importReceipt(items, fingerprint) -> create + dedupe
app/components/ReceiptImport.tsx  # Log-tab flow: pick -> extract -> parse -> review -> save
tests/receipt.test.ts       # parser tests (synthetic fixtures in the real format)
```

---

## Task 1: Pure receipt parser (TDD)

**Files:** Create `lib/receipt.ts`, `tests/receipt.test.ts`.

- [ ] **Step 1: failing test** — `tests/receipt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseReceipt } from "@/lib/receipt";

const LINES = [
  "Description Qty Unit Price Incl Unit Price Excl. Total Price Excl VAT Rate VAT Amount Tot Price Incl VAT",
  "WATER 1.5L X 6 6.0 4.99 4.75 28.51 5.00 1.43 29.94",
  "Barcode: 1234567890123",
  "CHEESE BLOCK 500G 1.0 18.99 18.09 18.09 5.00 0.90 18.99",
  "Barcode: 9876543210000",
  "TOMATO EP 0.62 6.98 6.65 4.12 5.00 0.21 4.33",
  "Barcode: 5555555555555",
  "Total Amount Incl. VAT AED 53.26",
  "Amount : AED 53.26",
];

describe("parseReceipt", () => {
  it("parses each item row into name/qty/unit/unitPrice/lineTotal", () => {
    const r = parseReceipt(LINES);
    expect(r.items).toHaveLength(3);
    expect(r.items[0]).toMatchObject({ name: "WATER 1.5L X 6", quantity: 6, unit: "each", unitPriceFils: 499, lineFils: 2994 });
    expect(r.items[1]).toMatchObject({ name: "CHEESE BLOCK 500G", unit: "each", lineFils: 1899 });
  });
  it("detects weighed items (fractional qty) as kg", () => {
    const r = parseReceipt(LINES);
    expect(r.items[2]).toMatchObject({ name: "TOMATO EP", quantity: 0.62, unit: "kg", unitPriceFils: 698, lineFils: 433 });
  });
  it("reads the grand total and self-checks the sum", () => {
    const r = parseReceipt(LINES);
    expect(r.grandTotalFils).toBe(5326);
    expect(r.sumFils).toBe(5326);
    expect(r.matchesTotal).toBe(true);
  });
  it("skips barcode/header/total lines (no false items)", () => {
    const r = parseReceipt(LINES);
    expect(r.items.every((i) => !/barcode/i.test(i.name))).toBe(true);
  });
  it("flags a mismatch when lines don't sum to the grand total", () => {
    const bad = [...LINES.slice(0, 7), "Total Amount Incl. VAT AED 99.99"];
    const r = parseReceipt(bad);
    expect(r.matchesTotal).toBe(false);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("returns empty items for junk input", () => {
    expect(parseReceipt(["hello", "world"]).items).toHaveLength(0);
  });
});
```
- [ ] **Step 2:** run `cmd /c "npm test -- receipt"` → FAIL.
- [ ] **Step 3: implement** `lib/receipt.ts`:
```ts
export type DraftItem = {
  name: string;
  quantity: number;
  unit: "each" | "kg";
  unitPriceFils: number; // unit price incl VAT
  lineFils: number;      // line total incl VAT (what was paid for the line)
};
export type ParsedReceipt = {
  items: DraftItem[];
  grandTotalFils: number | null; // "Total Amount Incl. VAT"
  paidFils: number | null;       // "Amount : AED" (after discount), if present
  sumFils: number;               // sum of line totals
  matchesTotal: boolean;
  warnings: string[];
};

// name + qty + 6 two-decimal numbers (unitIncl, unitExcl, totalExcl, vatRate, vatAmount, totIncl)
const ITEM = /^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+\.\d{2})\s+\d+\.\d{2}\s+\d+\.\d{2}\s+\d+\.\d{2}\s+\d+\.\d{2}\s+(\d+\.\d{2})\s*$/;
const fils = (s: string) => Math.round(parseFloat(s) * 100);

export function parseReceipt(lines: string[]): ParsedReceipt {
  const items: DraftItem[] = [];
  let grandTotalFils: number | null = null;
  let paidFils: number | null = null;
  const warnings: string[] = [];

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line || /^barcode/i.test(line)) continue;
    const totalMatch = /total amount incl\.?\s*vat.*?(\d+\.\d{2})\s*$/i.exec(line);
    if (totalMatch) { grandTotalFils = fils(totalMatch[1]); continue; }
    const paidMatch = /^amount\s*:?\s*aed\s*(\d+\.\d{2})/i.exec(line);
    if (paidMatch) { paidFils = fils(paidMatch[1]); continue; }
    const m = ITEM.exec(line);
    if (!m) continue;
    const name = m[1].trim();
    if (/description|unit price|vat/i.test(name)) continue; // header row
    const quantity = parseFloat(m[2]);
    items.push({
      name,
      quantity,
      unit: Number.isInteger(quantity) ? "each" : "kg",
      unitPriceFils: fils(m[3]),
      lineFils: fils(m[4]),
    });
  }

  const sumFils = items.reduce((a, b) => a + b.lineFils, 0);
  const matchesTotal = grandTotalFils !== null && Math.abs(sumFils - grandTotalFils) <= 5;
  if (grandTotalFils === null) warnings.push("Couldn't find the receipt's grand total.");
  else if (!matchesTotal) warnings.push(`Parsed items add up to AED ${(sumFils/100).toFixed(2)} but the receipt total is AED ${(grandTotalFils/100).toFixed(2)} — please check before saving.`);
  if (items.length === 0) warnings.push("No items were recognised in this file.");
  return { items, grandTotalFils, paidFils, sumFils, matchesTotal, warnings };
}
```
- [ ] **Step 4:** `cmd /c "npm test -- receipt"` → PASS. Then `cmd /c "npm test"` (full) + `cmd /c "npm run typecheck"`.
- [ ] **Step 5:** commit `feat: pure Carrefour receipt parser (coordinate-line based)`.

---

## Task 2: On-device PDF extraction (pdfjs-dist)

**Files:** Create `lib/receipt-extract.ts`.

- [ ] Implement `extractReceiptLines(file: File): Promise<string[]>` (browser/client module):
  - Configure the pdfjs worker (`import * as pdfjs from "pdfjs-dist"; pdfjs.GlobalWorkerOptions.workerSrc = ...` — use the bundled worker; in Next 15 import `pdfjs-dist/build/pdf.worker.min.mjs?url` or set `workerSrc` to a static path — pick what builds cleanly; a fallback of `disableWorker`/no-worker is acceptable).
  - `const buf = await file.arrayBuffer(); const doc = await pdfjs.getDocument({data: buf}).promise;`
  - For each page: `getTextContent()`, group items into rows by rounded `transform[5]` (y, bucket to nearest 2), sort each row's items by `transform[4]` (x), join `str`s with a space, collapse whitespace. Return the array of row strings across all pages, in top-to-bottom, page order. (This mirrors the coordinate reconstruction that produced clean rows in analysis.)
  - This module runs only in the browser (dynamic import from the client component). Do NOT import it in server code.
- [ ] Verify `cmd /c "npm run build"` stays clean (pdfjs must not break the server build — keep this module client-only, import it dynamically).
- [ ] Commit `feat: on-device pdf.js receipt text extraction`.

---

## Task 3: Import server action + duplicate protection

**Files:** Create `app/actions/receipt.ts`.

- [ ] `computeFingerprint(items, grandTotalFils)` helper (pure, can live in `lib/receipt.ts`): a stable string hash of item count + grand total + the sorted item name/line pairs. Used to detect re-imports.
- [ ] `importReceipt(input: { items: DraftItem[]; grandTotalFils: number | null; fingerprint: string; purchasedAt?: string }): Promise<{ ok: true; imported: number } | { duplicate: true; when: string } | { error: string }>`:
  - Re-validate: reject empty items / any non-finite/≤0 lineFils (defense in depth) → `{error}`.
  - **Dedupe:** if a `ReceiptImport` with this `fingerprint` exists → return `{ duplicate: true, when }` (don't insert).
  - Create a `ReceiptImport` row (fingerprint, store "Carrefour", totalFils = grand or sum, importedAt now).
  - For each draft item: resolve/create the Item (use `resolveItem` exact match; for receipts, create by name if no exact match — receipt names are their own items; do NOT run the fuzzy "suggest" prompt here, it'd be unusable for 30 rows), set category via `guessCategory`. Create the Purchase (totalFils = lineFils, quantity, unit, store "Carrefour", onOffer false, purchasedAt = input.purchasedAt||now, monthKey via `dubaiMonthKey`, importId = the ReceiptImport id).
  - `revalidatePath("/month"); revalidatePath("/prices"); revalidatePath("/log");` return `{ ok: true, imported }`.
- [ ] Commit `feat: importReceipt server action with fingerprint dedupe`.

---

## Task 4: Import UI on the Log tab (pick → extract → parse → review → save)

**Files:** Create `app/components/ReceiptImport.tsx`; wire into `app/(app)/log/page.tsx` (replace the disabled "Import receipt" placeholder in `PurchaseForm` or add above it).

- [ ] `ReceiptImport.tsx` (client):
  - An **"Import Carrefour receipt (PDF)"** button → hidden `<input type="file" accept="application/pdf,.pdf">`.
  - On select: dynamically `import("@/lib/receipt-extract")`, `extractReceiptLines(file)` → `parseReceipt(lines)`. Show a spinner while working.
  - **Review screen:** list the parsed `items` as editable rows (name, qty, unit, price AED = lineFils/100, category select defaulting to `guessCategory`), each removable. Show a **badge**: green "Total matches ✓ (AED X)" when `matchesTotal`, amber warning with the `warnings` text otherwise. If a discount is detected (`paidFils` < `grandTotalFils`), show a small note "Receipt had a AED Y discount; items are logged at shelf prices." **Never auto-save** — the user taps **Save N items**.
  - On save: compute `fingerprint` (from `lib/receipt`), call `importReceipt`. On `{ok}` → toast "Imported N items ✓", close, `router.refresh()`. On `{duplicate}` → show "This receipt looks already imported (on <when>). Import anyway?" with an explicit confirm that re-calls with a forced flag (add a `force?: boolean` to `importReceipt` that skips the dedupe check when true). On `{error}` → show it.
  - Style with app tokens to match the mockup's receipt-review sheet.
- [ ] Verify `cmd /c "npm run typecheck"`, `cmd /c "npm test"` (all pass), `cmd /c "npm run build"` (clean; `/log` dynamic; pdfjs client-only).
- [ ] Commit `feat: receipt import UI with draft review + dedupe confirm`.
- [ ] **Deploy & live-verify** (owner): import a real Carrefour PDF → review shows correct items + total-match badge → save → items appear in Month/Prices; re-import same file → duplicate warning; a non-receipt PDF → "No items recognised."

---

## Self-Review
- Coverage: parse (T1) · on-device extract (T2) · dedupe+create (T3) · review UI + no-auto-save + discount note (T4). Privacy: PDF stays client-side; only item/price data sent. Weighed vs counted handled in T1. Total self-check + duplicate protection present. Receipt items are their own items (no fuzzy-prompt spam on 30 rows) — cross-naming with manual items is reconciled by the Plan 3 merge tool.
- The `ReceiptImport` table + `Purchase.importId` already exist in the schema (added in Plan 1) — no migration needed.
