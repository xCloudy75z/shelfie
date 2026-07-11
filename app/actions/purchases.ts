"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parsePriceFils } from "@/lib/money";
import { normalizeName, resolveItem } from "@/lib/items";
import { dubaiMonthKey } from "@/lib/dates";
import { guessCategory } from "@/lib/categories";

export type AddPurchaseInput = {
  itemName: string;
  priceAed: string;
  quantity: number;
  unit: string;
  store: string;
  onOffer: boolean;
  categoryName?: string;
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

  const existing = await db.item.findMany({ select: { id: true, name: true } });
  const res = resolveItem(input.itemName, existing);

  let itemId: string;
  if (input.chosenItemId) {
    // User confirmed the suggestion is the same item.
    itemId = input.chosenItemId;
  } else if (res.kind === "exact") {
    itemId = res.item.id;
  } else if (res.kind === "suggest" && !input.confirmNewItem) {
    // Pause and ask before creating a possible duplicate. Write nothing.
    return { needsConfirm: true, suggestion: res.item };
  } else {
    const catName = input.categoryName?.trim() || guessCategory(input.itemName);
    const cat = await db.category.upsert({
      where: { name: catName },
      update: {},
      create: { name: catName },
    });
    const item = await db.item.create({
      data: {
        name: input.itemName.trim(),
        normalized: normalizeName(input.itemName),
        categoryId: cat.id,
      },
    });
    itemId = item.id;
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
  if (remaining === 0) {
    await db.item.delete({ where: { id: existing.itemId } });
  }

  revalidatePath("/month");
  revalidatePath("/prices");
  return { ok: true };
}

// (exportData + ExportedData removed — replaced by the validated Backup & Restore in app/actions/backup.ts)
