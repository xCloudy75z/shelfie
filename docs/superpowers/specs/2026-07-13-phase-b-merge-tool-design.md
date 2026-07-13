# Phase B — Merge Tool (design spec)

**Date:** 2026-07-13
**Status:** owner-approved (design); break-spec pass done & folded in — ready to plan
**Phase:** B of the A→B→C+D roadmap (`polish-phases-decisions.txt`)

## 1. Purpose

The same product sometimes exists as two separate items — a manually-typed name and Carrefour's cryptic receipt name (e.g. "Popcorn" vs "A.G PCORN") — which splits its price history across two items. The merge tool folds two items into one so the whole history lives together.

## 2. Scope

**In scope**
- On the **Prices item view**, a "Merge into another item…" action (decision B6 — no new screen).
- Manual pick-two (decision B7): you open one item, pick the other.
- **Owner chooses which name survives** (owner decision 2026-07-13, refining B8's "keep target name"): the confirm shows both names; the one you tap is the **survivor**, the other is the **merged-in** item.
- The merged-in item's **purchases and barcodes move to the survivor**; the survivor keeps its own name **and category**; the merged-in item is deleted.
- **Confirm-first + one-tap Undo** (decision B9), using a snapshot the action returns (same pattern as Backup/Restore).

**Out of scope (decision B10)**
- No split. No bulk/multi-merge. No fuzzy auto-suggest of duplicates (a possible later enhancement). No new top-level screen.

## 3. Data model

No schema change. Uses existing relations:
- `Purchase.itemId` → repointed from merged-in → survivor.
- `Barcode.code` is the `@id` (globally unique, one code → one item), `Barcode.itemId` → repointed from merged-in → survivor. Because `code` is globally unique, a code owned by the merged-in item cannot also be owned by the survivor, so repointing never collides (decision B8 confirmed).
- `Item` (merged-in) → deleted.

## 4. Server action (`app/actions/merge.ts`, `"use server"`)

```
mergeItems(survivorId: string, mergedId: string): Promise<
  | { ok: true; undo: MergeUndo }
  | { error: string }
>
```

- `validateMerge(survivorId, mergedId, existingIds)` first (self-merge / unknown id → `{ error }`).
- Wrap the whole thing in `try/catch` and return a friendly `{ error }` on any throw (mirror `importReceipt`).
- In a `$transaction`:
  1. **Re-check both items still exist** inside the tx (`findUnique` each) — return `{ error }` if either was deleted concurrently (break-spec #4). This avoids a raw FK/P2025 error reaching the user.
  2. Snapshot for undo — read the merged-in item's `{ name, normalized, categoryId }`, the **ids of its purchases**, and the **codes of its barcodes** (BEFORE any repoint).
  3. `purchase.updateMany({ where: { itemId: mergedId }, data: { itemId: survivorId } })`.
  4. `barcode.updateMany({ where: { itemId: mergedId }, data: { itemId: survivorId } })`.
  5. `item.delete({ where: { id: mergedId } })`.
- **⚠️ STEP ORDER IS LOAD-BEARING (break-spec #3):** the `Barcode.itemId` FK is `ON DELETE Cascade` with **no RESTRICT guard** — if `item.delete` runs before the barcode `updateMany`, the merged item's barcodes are **silently cascade-DELETED (lost), not moved**. Purchases + barcodes MUST be repointed before the delete. Add a code comment saying so; the build review must confirm this order.
- Return `{ ok: true, undo }` where `undo = { mergedItem: {name, normalized, categoryId}, purchaseIds: string[], barcodeCodes: string[] }`. Revalidate `/prices`, `/month`, `/log`.

**Undo action** `undoMerge(undo: MergeUndo): Promise<{ ok: true } | { error: string }>`:
- Wrap in `try/catch` → friendly `{ error }`. In a `$transaction`:
  1. **Resolve the item to restore into, tolerating a re-taken name (break-spec #2a):** `Item.name` is `@unique`, and the freed name can be re-minted (a new purchase/receipt with that name) between merge and undo. So: `const target = (await tx.item.findFirst({ where: { name: undo.mergedItem.name } })) ?? (await tx.item.create({ data }))` — if an item with that name now exists, **fold the snapshot rows back into it** rather than crashing on the unique constraint; otherwise recreate it fresh.
  2. **Tolerate a deleted category (break-spec #2b):** the snapshot's `categoryId` may have been deleted via CategoryManager. When creating, use `categoryId: (categoryId && await tx.category.findUnique({where:{id:categoryId}})) ? categoryId : null` (mirrors the schema's `ON DELETE SET NULL`).
  3. Repoint `purchaseIds` back (`updateMany where id in purchaseIds`) and `barcodeCodes` back (`updateMany where code in barcodeCodes`) to `target.id`. Only rows that still exist are moved (a purchase deleted between merge and undo is skipped) — same tolerance as Backup undo.
- Revalidate the three paths.

Pure helper (unit-tested) in `lib/merge.ts`: `validateMerge(survivorId, mergedId, existingIds: Set<string>): { ok: true } | { error: string }` — rejects self-merge and unknown ids. Keeping the pure check in `lib/` honors the `"use server"` rule.

## 5. UI — `ItemMergeControl` (client) on the Prices item view

- Rendered on `app/(app)/prices/page.tsx` near the item name / category picker (page level, so it shows even for an item with no purchases). Receives `currentItem: { id, name }` and `otherItems: { id, name }[]` (all items except the current — the page already fetches the full `items` list for the picker).
- Collapsed state: a subtle **"Merge into another item…"** text button.
- Expanded: a small typeahead/select to pick the **other** item, then a **confirm** that shows both names and asks **which name to keep** — two buttons, e.g. `Keep "Popcorn"` / `Keep "A.G PCORN"`. Tapping one sets survivor = that item, merged-in = the other, and calls `mergeItems`.
- On success: a non-blocking toast **"Merged ✓ · Undo"**; the Undo button calls `undoMerge(undo)` and is **disabled after the first tap** (break-spec #2 idempotency). After merge, `router.push('?item=<survivorId>')` (or refresh) so the view lands on the surviving item. After undo, refresh. (Loading a stale `?item=<deletedId>` is already safe — `prices/page.tsx` falls back to a valid item when the requested id isn't in the list, so no 404 — break-spec #3 confirmed.)
- Inline error text on failure. Token styling; matches `ItemCategoryPicker`/`BackupRestore`.

## 6. Edge cases (for the break-spec pass to attack)

- **Self-merge** (same item) — blocked by `validateMerge`.
- **Merged-in item currently selected/URL** — after merge it's deleted; the view must move to the survivor (not 404 on a dead `?item=`).
- **Barcode uniqueness** — repoint can't collide (code is global `@id`); confirm no case where `updateMany` throws.
- **Large item** (many purchases) — transaction timeout; use the same generous timeout as `importReceipt`.
- **Undo window** — if a moved purchase is edited/deleted before undo, undo repoints what remains; acceptable, documented.
- **Undo re-creates the item with a new id** — invisible to the user (ids aren't surfaced), but confirm nothing keys off the old id.
- **Orphan/delete interplay** — merging doesn't trigger the `deletePurchase` orphan logic (we move, not delete, purchases). Confirm.
- **Category** — survivor keeps its category; the merged-in item's category is discarded (its purchases inherit the survivor's category via the survivor item). Confirm this matches intent.
- **Backup/restore** — merge/undo produce normal items+purchases+barcodes, all covered by the existing backup. No format change.

## 7. Testing

**Unit (`tests/merge.test.ts`, new):** `validateMerge` — self-merge rejected; unknown survivor/merged id rejected; valid pair ok.

**Live verification (owner's iPhone + Vercel):**
1. Open a duplicate item on Prices → "Merge into another item…" → pick the other → choose which name to keep → both items become one; its price story now includes both items' purchases; barcodes carried over.
2. **Undo** → the two items are back as they were.
3. Merge where one item has a barcode and the other doesn't → survivor ends up with the barcode.
4. Merge into an item, then open Month → the merged purchases still sum correctly (no double count, no loss).
5. Try to merge an item into itself → blocked with a friendly message (or the option isn't offered).

## 7a. Break-spec pass — resolved (2026-07-13)
- **Undo name @unique collision (Major, fixed):** undo folds into an existing same-name item if the name was re-taken, else recreates (§4).
- **Undo deleted-category FK (Major, fixed):** undo recreates with `categoryId: null` when the snapshotted category is gone (§4).
- **Barcode `ON DELETE Cascade` (guardrail):** move-before-delete order is load-bearing and called out; the build review must confirm barcodes are moved before the item delete (§4).
- **Concurrency (guardrail):** re-check both items inside the tx + try/catch → friendly error; Undo disabled after first tap (§4, §5).
- **Confirmed sound:** forward merge loses no data; stale `?item` degrades gracefully (no 404); barcode repoint can't collide; the Month discount derive-by-`importId` is unaffected (moved purchases keep `importId`/`monthKey`); price stats stay same-unit-only. No schema change; transaction is 3 writes (timeout is over-provisioning, harmless).

## 8. Original open questions (addressed by the break-spec pass)
- Is the survivor/merged-in framing (survivor keeps name+category; merged-in folds in + deleted) fully consistent, especially for Undo?
- Any way `mergeItems` loses data (a purchase or barcode not moved, or moved twice)?
- Does the Prices page handle the `?item=<mergedId>` becoming invalid after merge (redirect to survivor)?
- Undo correctness if the survivor item is itself deleted/merged again before undo.
- Concurrency: two merges racing.
