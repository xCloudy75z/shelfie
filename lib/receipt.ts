import { canonicalizeBarcode } from "./barcode";
import { normalizeName } from "./items";

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
  fingerprint: string;           // new (barcode-based, raw parse)
  legacyFingerprint: string;     // old name-based, raw parse
  purchaseDateISO: string | null; // trip date as yyyy-mm-dd, or null if none found
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// Numeric date: D[sep]M[sep]YY(YY), separators / . -. Fields anchored on word
// boundaries so a price like 5.50 (only 2 fields, no year) can't match.
const NUMERIC_DATE = /\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})\b/;
// Text-month date: D[sep]Mon[sep]YYYY where sep is space, hyphen, dot or slash
// and Mon is a 3+ letter English month name. Matches "26 Jun 2026",
// "26-Jun-2026", "26/Jun/2026", "26 June 2026".
const TEXT_DATE = /\b(\d{1,2})[\s/.\-]+([A-Za-z]{3,9})[\s/.\-]+(\d{4})\b/;

function toISO(day: number, month: number, year: number): string | null {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const maxDay = [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day > maxDay) return null;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Parse a valid calendar date out of a single line, or null. UAE day-first.
 *  Tries a text-month date first (D-Mon-YYYY, any separator) then numeric. */
function parseDateFromLine(line: string): string | null {
  const t = TEXT_DATE.exec(line);
  if (t) {
    const month = MONTHS[t[2].slice(0, 3).toLowerCase()];
    if (month) {
      const iso = toISO(parseInt(t[1], 10), month, parseInt(t[3], 10));
      if (iso) return iso;
    }
  }

  const n = NUMERIC_DATE.exec(line);
  if (n) {
    const f1 = parseInt(n[1], 10);
    const f2 = parseInt(n[2], 10);
    let year = parseInt(n[3], 10);
    if (n[3].length === 2) year += 2000;

    // Day-first (UAE): field1 is DAY unless it can't be (>12) while field2 can.
    let day: number, month: number;
    if (f1 > 12 && f2 <= 12) { day = f1; month = f2; }        // DD/MM
    else if (f2 > 12 && f1 <= 12) { day = f2; month = f1; }   // MM/DD
    else { day = f1; month = f2; }                            // ambiguous -> day-first
    const iso = toISO(day, month, year);
    if (iso) return iso;
  }
  return null;
}

/** Extract the trip date from the receipt. UAE convention is day-first.
 *  First looks for the "Invoice Date" label line and parses the date from it;
 *  only if none is found (or it has no parseable date) does it fall back to
 *  scanning all lines for the first parseable date. Anchoring to the label
 *  avoids grabbing an unrelated date printed elsewhere on the receipt.
 *  Returns `yyyy-mm-dd`, or null. Dependency-free. */
export function extractReceiptDate(lines: string[]): string | null {
  const normalized = lines
    .map((raw) => raw.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);

  for (const line of normalized) {
    if (/invoice date/i.test(line)) {
      const iso = parseDateFromLine(line);
      if (iso) return iso;
    }
  }

  for (const line of normalized) {
    const iso = parseDateFromLine(line);
    if (iso) return iso;
  }

  return null;
}

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
  const fingerprint = computeFingerprint(items, grandTotalFils);
  const legacyFingerprint = computeLegacyFingerprint(items, grandTotalFils);
  const purchaseDateISO = extractReceiptDate(lines);
  return { items, grandTotalFils, paidFils, sumFils, matchesTotal, warnings, fingerprint, legacyFingerprint, purchaseDateISO };
}

function fnv1a(payload: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Stable dedupe key. Barcode drives identity when present, so renames on the
 *  review screen never change it; falls back to the normalized parsed name. */
export function computeFingerprint(items: DraftItem[], grandTotalFils: number | null): string {
  const pairs = items.map((i) => `${i.barcode ?? normalizeName(i.name)}|${i.lineFils}`).sort();
  return fnv1a(`${items.length}#${grandTotalFils ?? ""}#${pairs.join(";")}`);
}

/** The pre-v2 hash (name|lineFils). Used only to detect receipts imported
 *  before the fingerprint basis changed, so they aren't re-imported twice. */
export function computeLegacyFingerprint(items: DraftItem[], grandTotalFils: number | null): string {
  const pairs = items.map((i) => `${i.name}|${i.lineFils}`).sort();
  return fnv1a(`${items.length}#${grandTotalFils ?? ""}#${pairs.join(";")}`);
}
