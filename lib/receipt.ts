import { canonicalizeBarcode } from "./barcode";

export type DraftItem = {
  name: string;
  quantity: number;
  unit: "each" | "kg";
  unitPriceFils: number; // unit price incl VAT
  lineFils: number;      // line total incl VAT (what was paid for the line)
  barcode?: string | null; // canonical GTIN-14 captured from a `Barcode:` line, or null
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

  let current: DraftItem | null = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) { current = null; continue; }

    // Barcode line: attach to the item directly above, then this line is consumed.
    if (/^barcode\b/i.test(line)) {
      if (current) current.barcode = canonicalizeBarcode(line);
      continue; // keep `current` so nothing else attaches; next non-item line resets it
    }

    const totalMatch = /total amount incl\.?\s*vat.*?(\d+\.\d{2})\s*$/i.exec(line);
    if (totalMatch) { grandTotalFils = fils(totalMatch[1]); current = null; continue; }

    const paidMatch = /^amount\s*:?\s*aed\s*(\d+\.\d{2})/i.exec(line);
    if (paidMatch) { paidFils = fils(paidMatch[1]); current = null; continue; }

    const m = ITEM.exec(line);
    if (!m) { current = null; continue; }
    const name = m[1].trim();
    if (/description|unit price|vat/i.test(name)) { current = null; continue; } // header row

    const quantity = parseFloat(m[2]);
    const draft: DraftItem = {
      name,
      quantity,
      unit: Number.isInteger(quantity) ? "each" : "kg",
      unitPriceFils: fils(m[3]),
      lineFils: fils(m[4]),
      barcode: null,
    };
    items.push(draft);
    current = draft;
  }

  const sumFils = items.reduce((a, b) => a + b.lineFils, 0);
  const matchesTotal = grandTotalFils !== null && Math.abs(sumFils - grandTotalFils) <= 5;
  if (grandTotalFils === null) warnings.push("Couldn't find the receipt's grand total.");
  else if (!matchesTotal) warnings.push(`Parsed items add up to AED ${(sumFils/100).toFixed(2)} but the receipt total is AED ${(grandTotalFils/100).toFixed(2)} — please check before saving.`);
  if (items.length === 0) warnings.push("No items were recognised in this file.");
  return { items, grandTotalFils, paidFils, sumFils, matchesTotal, warnings };
}

/**
 * A stable, deterministic fingerprint for a parsed receipt, used to detect
 * re-imports of the same emailed PDF. Built from the item count + grand total +
 * the SORTED list of `name|lineFils` pairs, so the physical row order never
 * changes the result — the same trip always hashes the same. A one-cent price
 * change or a different item count produces a different fingerprint.
 *
 * Uses a 32-bit FNV-1a rolling hash (no crypto import needed) rendered in base36.
 */
export function computeFingerprint(items: DraftItem[], grandTotalFils: number | null): string {
  const pairs = items.map((i) => `${i.name}|${i.lineFils}`).sort();
  const payload = `${items.length}#${grandTotalFils ?? ""}#${pairs.join(";")}`;
  let h = 0x811c9dc5; // FNV-1a offset basis
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  return (h >>> 0).toString(36);
}
