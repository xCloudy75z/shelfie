/**
 * Backup file format + validation.
 *
 * The format intentionally carries NO database ids. Restore always creates fresh
 * ids, so ids in a file could never be trusted anyway — leaving them out removes
 * a whole class of "point one record at another's row" tampering.
 *
 * `validateBackup` is the single trust boundary: it runs on the client (fast
 * feedback) AND again on the server before any write (defense in depth). It
 * whitelists — the returned `data` is rebuilt field-by-field from known keys, so
 * booby-trapped extras (`__proto__`, injected `id`, script strings) are dropped.
 */

import { canonicalizeBarcode } from "@/lib/barcode";

export const CURRENT_BACKUP_VERSION = 1;

export type BackupItem = { name: string; category: string | null };
export type BackupBarcode = { code: string; itemName: string };
export type BackupPurchase = {
  itemName: string;
  totalFils: number;
  quantity: number;
  unit: string;
  store: string;
  onOffer: boolean;
  purchasedAt: string;
  monthKey: string;
};
export type BackupBudget = { monthKey: string; amountFils: number };

export type BackupData = {
  app: "shelfie";
  schemaVersion: number;
  exportedAt: string;
  items: BackupItem[];
  purchases: BackupPurchase[];
  budgets: BackupBudget[];
  barcodes: BackupBarcode[];
};

export type BackupCounts = { items: number; purchases: number; budgets: number };

export type ValidateResult =
  | { ok: true; data: BackupData; counts: BackupCounts }
  | { ok: false; error: string };

const MSG_UNREADABLE = "This file isn't a readable backup.";
const MSG_NOT_SHELFIE = "This isn't a Shelfie backup.";
const MSG_NEWER =
  "This backup is from a newer version of Shelfie — update the app first.";
const MSG_CORRUPT = "This backup is corrupted or incomplete.";

const MONTH_RE = /^\d{4}-\d{2}$/;

/** A non-null, non-array object we can read named keys off. */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

/** Non-negative integer (fils are always whole and never negative). */
function isNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function isParsableDate(v: unknown): v is string {
  return typeof v === "string" && !Number.isNaN(new Date(v).getTime());
}

function isMonthKey(v: unknown): v is string {
  return typeof v === "string" && MONTH_RE.test(v);
}

function validItem(v: unknown): v is BackupItem {
  if (!isRecord(v)) return false;
  if (!isNonEmptyString(v.name)) return false;
  return v.category === null || typeof v.category === "string";
}

function validPurchase(v: unknown): v is BackupPurchase {
  if (!isRecord(v)) return false;
  return (
    isNonEmptyString(v.itemName) &&
    isNonNegInt(v.totalFils) &&
    typeof v.quantity === "number" &&
    Number.isFinite(v.quantity) &&
    v.quantity > 0 &&
    typeof v.unit === "string" &&
    typeof v.store === "string" &&
    typeof v.onOffer === "boolean" &&
    isParsableDate(v.purchasedAt) &&
    isMonthKey(v.monthKey)
  );
}

function validBudget(v: unknown): v is BackupBudget {
  if (!isRecord(v)) return false;
  return isMonthKey(v.monthKey) && isNonNegInt(v.amountFils);
}

export function validateBackup(raw: unknown): ValidateResult {
  if (!isRecord(raw)) return { ok: false, error: MSG_UNREADABLE };
  if (raw.app !== "shelfie") return { ok: false, error: MSG_NOT_SHELFIE };
  if (typeof raw.schemaVersion !== "number")
    return { ok: false, error: MSG_CORRUPT };
  if (raw.schemaVersion > CURRENT_BACKUP_VERSION)
    return { ok: false, error: MSG_NEWER };

  if (
    !Array.isArray(raw.items) ||
    !Array.isArray(raw.purchases) ||
    !Array.isArray(raw.budgets)
  )
    return { ok: false, error: MSG_CORRUPT };

  if (!raw.items.every(validItem)) return { ok: false, error: MSG_CORRUPT };
  if (!raw.purchases.every(validPurchase))
    return { ok: false, error: MSG_CORRUPT };
  if (!raw.budgets.every(validBudget)) return { ok: false, error: MSG_CORRUPT };

  // `barcodes` is additive: a pre-v2 backup simply lacks the array. Tolerate a
  // missing array (default []) and, when present, require it to be an array.
  if (raw.barcodes !== undefined && !Array.isArray(raw.barcodes))
    return { ok: false, error: MSG_CORRUPT };

  // Canonicalise each code, DROP invalid codes, and DEDUPE by canonical code
  // (first wins). Rows carry no DB ids — restore resolves itemName -> new item.
  const seenCodes = new Set<string>();
  const barcodes: BackupBarcode[] = [];
  for (const b of (Array.isArray(raw.barcodes) ? raw.barcodes : [])) {
    if (!isRecord(b)) continue;
    if (!isNonEmptyString(b.itemName)) continue;
    const code = canonicalizeBarcode(typeof b.code === "string" ? b.code : null);
    if (!code) continue;
    if (seenCodes.has(code)) continue;
    seenCodes.add(code);
    barcodes.push({ code, itemName: String(b.itemName) });
  }

  // Whitelist: rebuild every record from known fields only. We never spread the
  // raw object, so any extra keys (ids, __proto__, injected strings) are dropped.
  const data: BackupData = {
    app: "shelfie",
    schemaVersion: raw.schemaVersion,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "",
    items: (raw.items as BackupItem[]).map((i) => ({
      name: String(i.name),
      category: i.category === null ? null : String(i.category),
    })),
    purchases: (raw.purchases as BackupPurchase[]).map((p) => ({
      itemName: String(p.itemName),
      totalFils: p.totalFils,
      quantity: p.quantity,
      unit: String(p.unit),
      store: String(p.store),
      onOffer: p.onOffer === true,
      purchasedAt: String(p.purchasedAt),
      monthKey: String(p.monthKey),
    })),
    budgets: (raw.budgets as BackupBudget[]).map((b) => ({
      monthKey: String(b.monthKey),
      amountFils: b.amountFils,
    })),
    barcodes,
  };

  return {
    ok: true,
    data,
    counts: {
      items: data.items.length,
      purchases: data.purchases.length,
      budgets: data.budgets.length,
    },
  };
}
