"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { validateMerge, type MergeUndo } from "@/lib/merge";

/**
 * Fold `mergedId` into `survivorId`: move the merged item's purchases + barcodes
 * to the survivor (which keeps its own name + category), then delete the merged
 * item. Returns an undo snapshot.
 */
export async function mergeItems(
  survivorId: string,
  mergedId: string,
): Promise<{ ok: true; undo: MergeUndo } | { error: string }> {
  const ids = await db.item.findMany({ select: { id: true } });
  const v = validateMerge(survivorId, mergedId, new Set(ids.map((i) => i.id)));
  if ("error" in v) return v;

  try {
    const undo = await db.$transaction(
      async (tx) => {
        // Re-check inside the tx (concurrent delete → friendly error).
        const survivor = await tx.item.findUnique({ where: { id: survivorId }, select: { id: true } });
        const merged = await tx.item.findUnique({
          where: { id: mergedId },
          select: { id: true, name: true, normalized: true, categoryId: true },
        });
        if (!survivor || !merged) throw new Error("item-missing");

        // Snapshot BEFORE repointing so ids/codes are captured.
        const purchases = await tx.purchase.findMany({ where: { itemId: mergedId }, select: { id: true } });
        const barcodes = await tx.barcode.findMany({ where: { itemId: mergedId }, select: { code: true } });

        // ⚠️ ORDER IS LOAD-BEARING: move purchases + barcodes BEFORE deleting the
        // item. Barcode.itemId FK is ON DELETE Cascade with no RESTRICT — deleting
        // the item first would SILENTLY cascade-delete its barcodes, not move them.
        await tx.purchase.updateMany({ where: { itemId: mergedId }, data: { itemId: survivorId } });
        await tx.barcode.updateMany({ where: { itemId: mergedId }, data: { itemId: survivorId } });
        await tx.item.delete({ where: { id: mergedId } });

        return {
          mergedItem: { name: merged.name, normalized: merged.normalized, categoryId: merged.categoryId },
          purchaseIds: purchases.map((p) => p.id),
          barcodeCodes: barcodes.map((b) => b.code),
        } satisfies MergeUndo;
      },
      { timeout: 20000, maxWait: 10000 },
    );

    revalidatePath("/prices");
    revalidatePath("/month");
    revalidatePath("/log");
    return { ok: true, undo };
  } catch (err) {
    console.error("[mergeItems] failed:", err instanceof Error ? `${err.name}: ${err.message}` : err);
    return { error: "Couldn't merge those items — please try again." };
  }
}

/** Reverse a merge from its snapshot. Tolerates a re-taken name (fold into the
 *  existing same-name item) and a deleted category (restore as Uncategorized). */
export async function undoMerge(undo: MergeUndo): Promise<{ ok: true } | { error: string }> {
  try {
    await db.$transaction(
      async (tx) => {
        // Re-taken name → fold back into that item instead of crashing on @unique.
        const existing = await tx.item.findFirst({
          where: { name: undo.mergedItem.name },
          select: { id: true },
        });
        let targetId: string;
        if (existing) {
          targetId = existing.id;
        } else {
          // Deleted category → restore as Uncategorized (categoryId null).
          const catOk =
            undo.mergedItem.categoryId != null &&
            (await tx.category.findUnique({
              where: { id: undo.mergedItem.categoryId },
              select: { id: true },
            })) != null;
          const created = await tx.item.create({
            data: {
              name: undo.mergedItem.name,
              normalized: undo.mergedItem.normalized,
              categoryId: catOk ? undo.mergedItem.categoryId : null,
            },
            select: { id: true },
          });
          targetId = created.id;
        }

        if (undo.purchaseIds.length) {
          await tx.purchase.updateMany({ where: { id: { in: undo.purchaseIds } }, data: { itemId: targetId } });
        }
        if (undo.barcodeCodes.length) {
          await tx.barcode.updateMany({ where: { code: { in: undo.barcodeCodes } }, data: { itemId: targetId } });
        }
      },
      { timeout: 20000, maxWait: 10000 },
    );

    revalidatePath("/prices");
    revalidatePath("/month");
    revalidatePath("/log");
    return { ok: true };
  } catch (err) {
    console.error("[undoMerge] failed:", err instanceof Error ? `${err.name}: ${err.message}` : err);
    return { error: "Couldn't undo the merge." };
  }
}
