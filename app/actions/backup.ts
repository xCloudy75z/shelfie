"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { normalizeName } from "@/lib/items";
import { findOrCreateCategory } from "@/lib/category-db";
import {
  validateBackup,
  CURRENT_BACKUP_VERSION,
  type BackupData,
  type BackupCounts,
} from "@/lib/backup";

/**
 * A full snapshot of the user's data in the portable backup format.
 * Carries NO database ids — restore always mints fresh ones.
 */
export async function buildBackup(): Promise<BackupData> {
  const [items, purchases, budgets, barcodes] = await Promise.all([
    db.item.findMany({ include: { category: true }, orderBy: { name: "asc" } }),
    db.purchase.findMany({
      include: { item: true },
      orderBy: { purchasedAt: "desc" },
    }),
    db.budget.findMany({ orderBy: { monthKey: "asc" } }),
    db.barcode.findMany({ include: { item: true }, orderBy: { code: "asc" } }),
  ]);

  return {
    app: "shelfie",
    schemaVersion: CURRENT_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items: items.map((i) => ({
      name: i.name,
      category: i.category?.name ?? null,
    })),
    purchases: purchases.map((p) => ({
      itemName: p.item.name,
      totalFils: p.totalFils,
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
    })),
    barcodes: barcodes.map((b) => ({
      code: b.code,
      itemName: b.item.name,
    })),
  };
}

/** Stamp "now" as the last-backed-up time (shown on the Month tab). */
export async function markBackedUp(): Promise<void> {
  await db.settings.update({
    where: { id: 1 },
    data: { lastBackupAt: new Date() },
  });
}

export type RestoreResult =
  | { ok: true; snapshot: BackupData; counts: BackupCounts }
  | { error: string };

/**
 * Replace ALL data with the contents of a validated backup file.
 *
 * Safety:
 *  1. Re-validate on the server — the client is never trusted.
 *  2. Snapshot current data FIRST, so a wrong file can't destroy history; the
 *     snapshot is returned and is exactly what Undo replays.
 *  3. Wipe + rebuild inside one transaction. Ids are always freshly generated
 *     (we never write the file's ids — the format has none), so restoring a
 *     file, or Undo-ing, can never collide with or spoof an existing row.
 */
export async function restoreBackup(data: BackupData): Promise<RestoreResult> {
  // (1) Defense in depth — validate again on the server.
  const v = validateBackup(data);
  if (!v.ok) return { error: v.error };
  const clean = v.data;

  // (2) Snapshot BEFORE deleting anything.
  const snapshot = await buildBackup();

  // (3) One transaction: wipe, then rebuild with fresh ids.
  await db.$transaction(async (tx) => {
    // Order matters: purchases reference items + imports; budgets stand alone.
    // Wipe stale receipt imports too, so their captured discountFils can't leave
    // a phantom discount netting the restored Month total.
    await tx.purchase.deleteMany({});
    await tx.receiptImport.deleteMany({});
    await tx.item.deleteMany({});
    await tx.budget.deleteMany({});

    // Ensure every referenced category exists (upsert by unique name).
    const catNames = [
      ...new Set(
        clean.items
          .map((i) => i.category)
          .filter((c): c is string => c !== null && c.trim() !== ""),
      ),
    ];
    const catIdByName = new Map<string, string>();
    for (const name of catNames) {
      const id = await findOrCreateCategory(tx, name);
      catIdByName.set(name, id);
    }

    // Create items fresh; remember the new id for each name so purchases link up.
    const itemIdByName = new Map<string, string>();
    for (const i of clean.items) {
      const categoryId =
        i.category && i.category.trim() !== ""
          ? (catIdByName.get(i.category) ?? null)
          : null;
      const created = await tx.item.create({
        data: {
          name: i.name,
          normalized: normalizeName(i.name),
          categoryId,
        },
      });
      itemIdByName.set(i.name, created.id);
    }

    // Create purchases with fresh ids, linking to the newly created items.
    // A purchase whose itemName has no matching item is skipped (can't happen
    // with a self-consistent file, but never trust the input).
    const purchaseRows = clean.purchases
      .map((p) => {
        const itemId = itemIdByName.get(p.itemName);
        if (!itemId) return null;
        return {
          itemId,
          totalFils: p.totalFils,
          quantity: p.quantity,
          unit: p.unit,
          store: p.store,
          onOffer: p.onOffer,
          purchasedAt: new Date(p.purchasedAt),
          monthKey: p.monthKey,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (purchaseRows.length > 0) {
      await tx.purchase.createMany({ data: purchaseRows });
    }

    if (clean.budgets.length > 0) {
      await tx.budget.createMany({
        data: clean.budgets.map((b) => ({
          monthKey: b.monthKey,
          amountFils: b.amountFils,
        })),
      });
    }

    // Recreate barcodes AFTER items exist so itemName resolves to a fresh id.
    // Skip rows whose name doesn't resolve. De-dup codes in-loop: a unique
    // violation would abort the whole Postgres transaction, so we must never
    // attempt a duplicate write (the file is already deduped, but never trust
    // the input) — first write wins.
    const seenCodes = new Set<string>();
    for (const bc of clean.barcodes) {
      const itemId = itemIdByName.get(bc.itemName);
      if (!itemId) continue;
      if (seenCodes.has(bc.code)) continue;
      await tx.barcode.create({ data: { code: bc.code, itemId } });
      seenCodes.add(bc.code);
    }
  });

  revalidatePath("/month");
  revalidatePath("/prices");
  revalidatePath("/log");

  return { ok: true, snapshot, counts: v.counts };
}

/**
 * Wipe ALL of the owner's grocery data to start fresh.
 *
 * IRREVERSIBLE — there is no built-in undo. Deletes every purchase, barcode,
 * imported receipt, item and budget. Deliberately PRESERVES:
 *  - `Settings` (keeps the PIN + lastBackupAt), and
 *  - `Category` (preset reference data stays).
 *
 * Deletions run in one transaction in FK-safe order: purchases (reference
 * items + imports) → barcodes (reference items) → imported receipts → items →
 * budgets (stand alone). Encourage the user to "Back up now" first if they want
 * a safety copy.
 */
export async function resetAllData(): Promise<{ ok: true }> {
  await db.$transaction(async (tx) => {
    await tx.purchase.deleteMany({});
    await tx.barcode.deleteMany({});
    await tx.receiptImport.deleteMany({});
    await tx.item.deleteMany({});
    await tx.budget.deleteMany({});
  });

  revalidatePath("/month");
  revalidatePath("/prices");
  revalidatePath("/log");

  return { ok: true };
}
