// Pure merge validation + the undo snapshot shape. No DB here so the client
// control can import the type; the actual DB work lives in app/actions/merge.ts.

export type MergeUndo = {
  mergedItem: { name: string; normalized: string; categoryId: string | null };
  purchaseIds: string[];
  barcodeCodes: string[];
};

/** Guard a merge request against self-merge and unknown ids. */
export function validateMerge(
  survivorId: string,
  mergedId: string,
  existingIds: Set<string>,
): { ok: true } | { error: string } {
  if (!survivorId || !mergedId) return { error: "Pick an item to merge into." };
  if (survivorId === mergedId) return { error: "Can't merge an item into itself." };
  if (!existingIds.has(survivorId) || !existingIds.has(mergedId)) {
    return { error: "One of those items no longer exists." };
  }
  return { ok: true };
}
