import { normalizeName } from "@/lib/items";

export type ResolveCtx = { byBarcode: Map<string, string>; byName: Map<string, string> };
export type ResolveResult =
  | { action: "reuse"; itemId: string; attachBarcode?: string }
  | { action: "create"; attachBarcode: string | null }
  | { action: "conflict"; ownedByItemId: string; itemId: string; attachBarcode: string };

export function resolveDraftIdentity(
  d: { name: string; barcode: string | null; linkedItemId?: string; ignoreBarcodeMatch?: boolean },
  ctx: ResolveCtx,
): ResolveResult {
  // 0) Conflict (F6, spec §11.9): the owner explicitly linked this draft to a
  // DIFFERENT, REAL item, yet the barcode is already owned by another item.
  // The barcode is authoritative, so surface a conflict for the user to resolve.
  // "Real" = the linked id is a known item (a value in one of the lookup maps);
  // a link to an unknown id is treated as noise and lets the barcode win (test 1).
  if (d.linkedItemId && d.barcode && !d.ignoreBarcodeMatch) {
    const owner = ctx.byBarcode.get(d.barcode);
    if (owner && owner !== d.linkedItemId && isKnownItem(d.linkedItemId, ctx)) {
      return { action: "conflict", ownedByItemId: owner, itemId: d.linkedItemId, attachBarcode: d.barcode };
    }
  }
  // 1) Barcode wins (unless the owner detached it).
  if (d.barcode && !d.ignoreBarcodeMatch) {
    const hit = ctx.byBarcode.get(d.barcode);
    if (hit) return { action: "reuse", itemId: hit };
  }
  // 2) Explicit owner link -> reuse that item, attach barcode (if new & unowned).
  if (d.linkedItemId) {
    return { action: "reuse", itemId: d.linkedItemId, ...(d.barcode ? { attachBarcode: d.barcode } : {}) };
  }
  // 3) Exact normalized-name match -> reuse, attach barcode if present.
  const byName = ctx.byName.get(normalizeName(d.name));
  if (byName) return { action: "reuse", itemId: byName, ...(d.barcode ? { attachBarcode: d.barcode } : {}) };
  // 4) New item.
  return { action: "create", attachBarcode: d.barcode ?? null };
}

// A linked item is "real" when its id is an owner in one of the lookup maps.
function isKnownItem(itemId: string, ctx: ResolveCtx): boolean {
  for (const v of ctx.byName.values()) if (v === itemId) return true;
  for (const v of ctx.byBarcode.values()) if (v === itemId) return true;
  return false;
}
