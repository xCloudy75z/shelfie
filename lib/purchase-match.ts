// lib/purchase-match.ts
import { resolveItem, type ItemRef } from "@/lib/items";

export type ManualCtx = { byBarcode: Map<string, string>; existing: ItemRef[]; itemsOwningBarcode: Set<string> };
export type ManualResult =
  | { action: "reuse"; itemId: string; matchedByBarcode?: true; attachBarcode?: string }
  | { action: "confirm"; suggestItemId: string; attachBarcode: string }
  | { action: "create"; attachBarcode: string }
  | { action: "name" };

export function resolveManualIdentity(
  input: { name: string; barcode: string | null },
  ctx: ManualCtx,
): ManualResult {
  if (input.barcode) {
    const hit = ctx.byBarcode.get(input.barcode);
    if (hit) return { action: "reuse", itemId: hit, matchedByBarcode: true };
    const res = resolveItem(input.name, ctx.existing);
    if (res.kind === "exact") {
      // §11.3: an exact-name match whose item ALREADY owns a (different) barcode is
      // a different product (e.g. Milk 1L vs Milk 2L) — make a new item, don't merge.
      if (ctx.itemsOwningBarcode.has(res.item.id)) return { action: "create", attachBarcode: input.barcode };
      return { action: "reuse", itemId: res.item.id, attachBarcode: input.barcode };
    }
    if (res.kind === "suggest") return { action: "confirm", suggestItemId: res.item.id, attachBarcode: input.barcode };
    return { action: "create", attachBarcode: input.barcode };
  }
  return { action: "name" };
}

/** An item is auto-removed only when it has no purchases AND no taught barcodes,
 *  so deleting a mis-entered purchase never destroys a barcode->item mapping. */
export function shouldDeleteOrphan(remainingPurchases: number, barcodeCount: number): boolean {
  return remainingPurchases === 0 && barcodeCount === 0;
}
