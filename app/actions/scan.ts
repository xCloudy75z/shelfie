"use server";

import { db } from "@/lib/db";
import { canonicalizeBarcode } from "@/lib/barcode";

/** Resolve a scanned barcode to the item that owns it, or null. */
export async function lookupBarcode(
  raw: string,
): Promise<{ itemId: string; itemName: string } | null> {
  const code = canonicalizeBarcode(raw);
  if (!code) return null;
  const row = await db.barcode.findUnique({
    where: { code },
    select: { item: { select: { id: true, name: true } } },
  });
  return row ? { itemId: row.item.id, itemName: row.item.name } : null;
}
