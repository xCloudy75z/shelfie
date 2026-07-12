"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parsePriceFils } from "@/lib/money";
import { normalizeName, resolveItem } from "@/lib/items";
import { dubaiMonthKey } from "@/lib/dates";
import { guessCategory } from "@/lib/categories";
import { findOrCreateCategory } from "@/lib/category-db";
import { canonicalizeBarcode } from "@/lib/barcode";
import { resolveManualIdentity, shouldDeleteOrphan } from "@/lib/purchase-match";

export type AddPurchaseInput = {
  itemName: string;
  priceAed: string;
  quantity: number;
  unit: string;
  store: string;
  onOffer: boolean;
  categoryName?: string;
  /** Optional product barcode typed by the user (barcode-first identity). */
  barcode?: string | null;
  /** Set when the user confirmed a suggested item is the same thing. */
  chosenItemId?: string;
  /** Set when the user rejected the suggestion — create a brand-new item. */
  confirmNewItem?: boolean;
};

export type AddPurchaseResult =
  | { ok: true }
  | { needsConfirm: true; suggestion: { id: string; name: string } }
  | { error: string };

/**
 * Log a purchase, keeping item identity clean.
 *
 * The item is resolved against existing names:
 *  - `chosenItemId`  → user already confirmed this maps to an existing item.
 *  - exact match     → reuse it silently.
 *  - close match     → return `needsConfirm` so the client can ask
 *                      "is this the same as <name>?" (nothing is written yet).
 *  - new / rejected  → create the item (auto-categorised unless overridden).
 */
export async function addPurchase(
  input: AddPurchaseInput,
): Promise<AddPurchaseResult> {
  // Validate money before touching the DB so a bad price never creates an item.
  const totalFils = parsePriceFils(input.priceAed);
  if (totalFils === null) return { error: "Enter a valid price above 0" };

  // A provided-but-unrecognised barcode canonicalises to null and is treated as
  // "no barcode" — it never blocks the save, it just doesn't drive identity.
  const canon = canonicalizeBarcode(input.barcode);

  // Barcode ownership (code -> itemId) for barcode-first identity.
  const barcodeRows = await db.barcode.findMany({
    select: { code: true, itemId: true },
  });
  const byBarcode = new Map(barcodeRows.map((b) => [b.code, b.itemId]));

  const existing = await db.item.findMany({ select: { id: true, name: true } });

  let itemId: string;
  // Canonical barcode to attach to `itemId` once resolved (null = attach nothing).
  let attachBarcode: string | null = null;

  if (input.chosenItemId) {
    // User confirmed the suggestion is the same item; carry the barcode onto it.
    itemId = input.chosenItemId;
    attachBarcode = canon;
  } else if (input.confirmNewItem) {
    // User rejected the suggestion → brand-new item carrying the barcode.
    itemId = await createItem(input);
    attachBarcode = canon;
  } else {
    // First pass — resolve identity barcode-first, then owner-name, then new.
    const itemsOwningBarcode = new Set(barcodeRows.map((b) => b.itemId));
    const res = resolveManualIdentity(
      { name: input.itemName, barcode: canon },
      { byBarcode, existing, itemsOwningBarcode },
    );
    if (res.action === "reuse") {
      itemId = res.itemId;
      // When matched BY barcode the code is already owned by this item, and the
      // typed name is ignored for identity — nothing to attach.
      if (!res.matchedByBarcode) attachBarcode = res.attachBarcode ?? null;
    } else if (res.action === "confirm") {
      // Pause and ask before creating a possible duplicate. Write nothing; the
      // form re-submits (barcode still in its state) with chosen/new.
      const sug = existing.find((e) => e.id === res.suggestItemId);
      if (sug) return { needsConfirm: true, suggestion: sug };
      // Suggestion vanished between reads → fall through to a fresh new item.
      itemId = await createItem(input);
      attachBarcode = res.attachBarcode;
    } else if (res.action === "create") {
      itemId = await createItem(input);
      attachBarcode = res.attachBarcode;
    } else {
      // action === "name": no usable barcode → today's name-only resolution,
      // unchanged from before this feature.
      const r = resolveItem(input.itemName, existing);
      if (r.kind === "exact") {
        itemId = r.item.id;
      } else if (r.kind === "suggest") {
        return { needsConfirm: true, suggestion: r.item };
      } else {
        itemId = await createItem(input);
      }
    }
  }

  // Attach the barcode only when it isn't already owned (this run or in the DB).
  if (attachBarcode && !byBarcode.has(attachBarcode)) {
    await db.barcode.create({ data: { code: attachBarcode, itemId } });
  }

  const now = new Date();
  await db.purchase.create({
    data: {
      itemId,
      totalFils,
      quantity: input.quantity || 1,
      unit: input.unit || "each",
      store: input.store || "Carrefour",
      onOffer: input.onOffer,
      purchasedAt: now,
      monthKey: dubaiMonthKey(now),
    },
  });

  revalidatePath("/month");
  revalidatePath("/prices");
  revalidatePath("/log");
  return { ok: true };
}

export type UpdatePurchaseInput = {
  priceAed: string;
  quantity: number;
  store: string;
  onOffer: boolean;
  /** ISO date, yyyy-mm-dd, from an <input type="date">. */
  purchasedAt: string;
};

/**
 * Edit a logged purchase. The Dubai month bucket is recomputed from the new
 * date so moving a purchase to a different month re-files it correctly.
 */
export async function updatePurchase(
  id: string,
  input: UpdatePurchaseInput,
): Promise<{ ok: true } | { error: string }> {
  const totalFils = parsePriceFils(input.priceAed);
  if (totalFils === null) return { error: "Enter a valid price above 0" };

  const purchasedAt = new Date(input.purchasedAt);
  await db.purchase.update({
    where: { id },
    data: {
      totalFils,
      quantity: input.quantity || 1,
      store: input.store || "Carrefour",
      onOffer: input.onOffer,
      purchasedAt,
      monthKey: dubaiMonthKey(purchasedAt),
    },
  });
  revalidatePath("/month");
  revalidatePath("/prices");
  return { ok: true };
}

/**
 * Delete a logged purchase. If it was the item's last remaining purchase, the
 * now-orphaned item is removed too, keeping name autocomplete clean.
 */
export async function deletePurchase(id: string): Promise<{ ok: true }> {
  const existing = await db.purchase.findUnique({
    where: { id },
    select: { itemId: true },
  });
  if (!existing) return { ok: true };

  await db.purchase.delete({ where: { id } });

  const remaining = await db.purchase.count({
    where: { itemId: existing.itemId },
  });
  // Keep an item that still owns barcodes — deleting a mis-entered purchase must
  // never destroy a taught barcode -> item mapping.
  const barcodeCount = await db.barcode.count({
    where: { itemId: existing.itemId },
  });
  if (shouldDeleteOrphan(remaining, barcodeCount)) {
    await db.item.delete({ where: { id: existing.itemId } });
  }

  revalidatePath("/month");
  revalidatePath("/prices");
  return { ok: true };
}

/**
 * Create a fresh item from a purchase input, auto-categorising unless the user
 * picked a category. Shared by the create / confirm-new / no-match paths.
 */
async function createItem(input: AddPurchaseInput): Promise<string> {
  const catName = input.categoryName?.trim() || guessCategory(input.itemName); // string | null
  let categoryId: string | null = null;
  if (catName) categoryId = await findOrCreateCategory(db, catName);
  const item = await db.item.create({
    data: {
      name: input.itemName.trim(),
      normalized: normalizeName(input.itemName),
      categoryId,
    },
  });
  return item.id;
}

// (exportData + ExportedData removed — replaced by the validated Backup & Restore in app/actions/backup.ts)
