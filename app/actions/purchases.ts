"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { filsFromAed } from "@/lib/money";
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
  | { needsConfirm: true; suggestion: { id: string; name: string } };

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
      totalFils: filsFromAed(input.priceAed),
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
  return { ok: true };
}

/** Implemented in Task 10 (data export). Stub kept so callers can wire up early. */
export async function exportData() {}
