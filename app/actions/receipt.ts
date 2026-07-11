"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { normalizeName, resolveItem } from "@/lib/items";
import { dubaiMonthKey } from "@/lib/dates";
import { guessCategory } from "@/lib/categories";
import { type DraftItem } from "@/lib/receipt";

export type ImportReceiptInput = {
  items: DraftItem[];
  grandTotalFils: number | null;
  fingerprint: string;
  /** ISO date string; defaults to now when omitted. */
  purchasedAt?: string;
  /** Skip the duplicate check and import anyway. */
  force?: boolean;
};

export type ImportReceiptResult =
  | { ok: true; imported: number }
  | { duplicate: true; when: string }
  | { error: string };

/**
 * Import a whole reviewed Carrefour receipt in one shot.
 *
 * Duplicate protection: the client sends a stable `fingerprint` for the trip.
 * Unless `force` is set, a matching `ReceiptImport` row means this PDF was
 * already imported — we return `{ duplicate, when }` and write nothing.
 *
 * Item identity: each draft row resolves against existing items by EXACT
 * normalized name only. A 30-row receipt can't stop to confirm fuzzy
 * suggestions, so anything without an exact match becomes a brand-new item.
 * (Cross-naming with manually-logged items is reconciled by the Plan 3 merge
 * tool, not here.)
 *
 * The ReceiptImport row plus all its purchases are written inside a single
 * transaction, so a mid-way failure never leaves a half-imported trip.
 */
export async function importReceipt(
  input: ImportReceiptInput,
): Promise<ImportReceiptResult> {
  const { items, grandTotalFils } = input;

  // --- Validate (defense in depth; the client already parsed/validated) ---
  if (!items || items.length === 0) return { error: "No items to import." };
  for (const it of items) {
    if (!Number.isFinite(it.lineFils) || it.lineFils <= 0) {
      return { error: `Invalid line total for "${it.name}".` };
    }
    if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
      return { error: `Invalid quantity for "${it.name}".` };
    }
  }

  // --- Dedupe ---
  if (!input.force) {
    const existingImport = await db.receiptImport.findUnique({
      where: { fingerprint: input.fingerprint },
      select: { importedAt: true },
    });
    if (existingImport) {
      return { duplicate: true, when: existingImport.importedAt.toISOString() };
    }
  }

  // When forcing a re-import, a row with this fingerprint may already exist;
  // recompute a fresh, non-colliding fingerprint so the @unique doesn't clash.
  let fingerprint = input.fingerprint;
  if (input.force) {
    const clash = await db.receiptImport.findUnique({
      where: { fingerprint },
      select: { id: true },
    });
    if (clash) fingerprint = `${input.fingerprint}-${Date.now()}`;
  }

  const totalFils =
    grandTotalFils ?? items.reduce((sum, it) => sum + it.lineFils, 0);
  const purchasedAt = input.purchasedAt ? new Date(input.purchasedAt) : new Date();
  const monthKey = dubaiMonthKey(purchasedAt);

  // Resolve item + category identities BEFORE opening the transaction. Prisma's
  // interactive transaction has a short default timeout; doing the reads up front
  // and only writing inside keeps the transaction fast and atomic.
  const existingItems = await db.item.findMany({ select: { id: true, name: true } });
  const itemIndex = new Map(existingItems.map((e) => [e.id, e] as const));

  await db.$transaction(async (tx) => {
    const receiptImport = await tx.receiptImport.create({
      data: { fingerprint, store: "Carrefour", totalFils },
    });

    // Cache created items/categories within this run so repeated names on one
    // receipt don't create duplicate rows or hit the unique constraint twice.
    const categoryCache = new Map<string, string>();
    const nameToItemId = new Map<string, string>();

    for (const draft of items) {
      const norm = normalizeName(draft.name);

      let itemId = nameToItemId.get(norm);
      if (!itemId) {
        const res = resolveItem(draft.name, [...itemIndex.values()]);
        if (res.kind === "exact") {
          itemId = res.item.id;
        } else {
          // No exact match → this receipt line is its own item.
          const catName = guessCategory(draft.name);
          let categoryId = categoryCache.get(catName);
          if (!categoryId) {
            const cat = await tx.category.upsert({
              where: { name: catName },
              update: {},
              create: { name: catName },
            });
            categoryId = cat.id;
            categoryCache.set(catName, categoryId);
          }
          const created = await tx.item.create({
            data: { name: draft.name.trim(), normalized: norm, categoryId },
            select: { id: true, name: true },
          });
          itemId = created.id;
          // Make the freshly-created item visible to later rows in this receipt.
          itemIndex.set(created.id, created);
        }
        nameToItemId.set(norm, itemId);
      }

      await tx.purchase.create({
        data: {
          itemId,
          totalFils: draft.lineFils,
          quantity: draft.quantity,
          unit: draft.unit,
          store: "Carrefour",
          onOffer: false,
          purchasedAt,
          monthKey,
          importId: receiptImport.id,
        },
      });
    }
  });

  revalidatePath("/month");
  revalidatePath("/prices");
  revalidatePath("/log");
  return { ok: true, imported: items.length };
}
