"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { filsFromAed, aedFromFils } from "@/lib/money";
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

export type ExportedData = {
  exportedAt: string;
  items: { id: string; name: string; category: string | null }[];
  purchases: {
    item: string;
    totalFils: number;
    totalAed: number;
    quantity: number;
    unit: string;
    store: string;
    onOffer: boolean;
    purchasedAt: string;
    monthKey: string;
  }[];
  budgets: { monthKey: string; amountFils: number; amountAed: number }[];
};

/**
 * A full, plain-JSON snapshot of the user's data — items, every purchase (money
 * shown in both integer fils and AED), and budgets. The client turns this into a
 * downloadable file so nothing is locked inside the app.
 */
export async function exportData(): Promise<ExportedData> {
  const [items, purchases, budgets] = await Promise.all([
    db.item.findMany({
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    db.purchase.findMany({
      include: { item: true },
      orderBy: { purchasedAt: "desc" },
    }),
    db.budget.findMany({ orderBy: { monthKey: "asc" } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category?.name ?? null,
    })),
    purchases: purchases.map((p) => ({
      item: p.item.name,
      totalFils: p.totalFils,
      totalAed: aedFromFils(p.totalFils),
      quantity: p.quantity,
      unit: p.unit,
      store: p.store,
      onOffer: p.onOffer,
      purchasedAt: p.purchasedAt.toISOString(),
      monthKey: p.monthKey,
    })),
    budgets: budgets.map((b) => ({
      monthKey: b.monthKey,
      amountFils: b.amountFils,
      amountAed: aedFromFils(b.amountFils),
    })),
  };
}
