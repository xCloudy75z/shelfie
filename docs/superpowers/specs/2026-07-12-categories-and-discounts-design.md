# Categories & Discount Accuracy — design spec

**Date:** 2026-07-12
**Status:** owner-approved (design); break-spec pass done & folded in — ready to plan
**Why:** The owner is using the live app with real receipts and hit two gaps: (1) a receipt discount made the Month budget overstate what he actually paid, and (2) the auto-categoriser dumps almost everything into "Groceries" with no way to manage categories or re-file items.

This is one focused "Month accuracy" feature in two parts. Item shelf prices and price intelligence are **not** touched.

## 1. Part 1 — Discount accuracy

### 1.1 Goal
The Month **"Spent"** and budget pace must reflect **what was actually paid** = shelf total − receipt discount. Items stay logged at shelf price. The category chart stays shelf-based (a discount belongs to no single category — owner's decision, "Option 2"), with a footnote explaining the gap.

### 1.2 Data model
Add to `ReceiptImport`:
- `discountFils Int @default(0)` — the trip's discount = `grandTotalShelf − paid`, clamped ≥ 0.

**No `monthKey` on the import (break-spec F1).** An earlier draft denormalized `monthKey` onto the import and summed discounts by month — but that produces a WRONG "Spent" the moment an imported purchase is deleted (`deletePurchase` never touches the import row, so the discount lingers with no purchases behind it). Instead, **the Month page derives discounts from LIVE purchases via `Purchase.importId`** (§1.4) — so a discount only counts while its purchases still exist. This drops the `monthKey` column and also neutralizes the restore-orphan issue (F2) and the edit-date issue (F7).

Migration: hand-authored `prisma/migrations/<n>_receipt_discount/migration.sql` adding the single `discountFils` column (`INTEGER NOT NULL DEFAULT 0`). Existing rows get `0` — correct, since their discount was never captured.

### 1.3 Capture at import
- `parseReceipt` already yields `paidFils` (the amount actually paid, after discount) and `grandTotalFils` (sum of shelf lines). The review UI already computes a display-only discount from these.
- `importReceipt` input gains `paidFils?: number | null`. The client (`ReceiptImport.tsx` `save()`) passes `parsed.paidFils`.
- Server computes `discountFils = (grandTotalFils != null && paidFils != null && paidFils < grandTotalFils) ? grandTotalFils − paidFils : 0` (integer, ≥ 0), and stores it on the `ReceiptImport` row (`discountFils` only — no `monthKey`, per §1.2/F1). Purchases still store shelf `lineFils` — unchanged.

### 1.4 Month page
- `shelfSpentFils = Σ purchase.totalFils` (today's value; rename the local from `spentFils`).
- **Discounts derived from LIVE purchases (break-spec F1):**
  - `const importIds = [...new Set(purchases.map((p) => p.importId).filter(Boolean))]` (the imports that still have ≥1 purchase in this month — `importId` is already a scalar on the fetched purchases).
  - `const imports = importIds.length ? await db.receiptImport.findMany({ where: { id: { in: importIds } }, select: { discountFils: true } }) : []` (added to the reads).
  - `const discountsFils = imports.reduce((s, i) => s + i.discountFils, 0)`.
- `paidSpentFils = Math.max(0, shelfSpentFils − discountsFils)`.
- **Use `paidSpentFils` for ALL of (break-spec F8):** the headline "Spent" figure, the pace metric + projection, `barPct`, AND every pace-note string (`Spent X of Y` in the non-current-month branches) — so the headline and the notes never disagree. The only figure that stays shelf-based is the category breakdown.
- **Category breakdown unchanged** — still built from `purchase.totalFils` (shelf).
- **Footnote (only when `discountsFils > 0`):** a small muted line under the Spent card: `Items total {formatAed(shelfSpentFils)} at shelf price · you paid {formatAed(paidSpentFils)} after {formatAed(discountsFils)} in receipt discounts.`
- Edge (accepted): if a user manually edits SOME of an import's purchases into another month, that import appears in both months' `importIds` and its discount is counted in each — a rare over-subtraction from hand-editing imported dates. Documented, not guarded (deriving from live `importId` already fixes the common delete case, which is the one that mattered).

### 1.5 Discount edge cases
- `paidFils` null (parser found no paid line) → discount 0, no change.
- `paidFils ≥ grandTotal` (rounding / no discount) → clamp to 0.
- Multiple imports in one month → summed by the aggregate.
- A user later edits an imported purchase's **date** into another month: see the §1.4 accepted edge (the discount is derived from live `importId`, so it follows wherever that import's purchases are).
- **Backup/restore (break-spec F2 — corrected):** the backup file carries no `importId` and no ReceiptImports, so after a REPLACE-restore every rebuilt purchase has `importId = null` → the discount derivation finds no imports → `discountsFils = 0` and shelf = paid (consistent). To also stop stale import rows lingering, `restoreBackup`'s wipe block **must additionally `await tx.receiptImport.deleteMany({})`** (they're orphaned once their purchases are wiped). Discounts themselves are not restorable (never in the backup) — accepted, and now consistent rather than showing a phantom subtraction.

## 2. Part 2 — Category management

### 2.1 Goals
- Add / rename / delete categories.
- Re-file any item into a different category (per-item; re-files it everywhere since category is per-item).
- Stop silently dumping unknown items into "Groceries."

### 2.2 The "Uncategorized" model (no new seeded row)
`Item.categoryId` is already optional. **A null category displays as "Uncategorized"** everywhere (replacing today's "Other" label in the Month breakdown). No "Uncategorized" Category row is created — it is simply the null state. This keeps the manageable category list clean (real categories only) and gives deletes a safe target (set items' `categoryId = null`).

**Catch-all change:** `guessCategory` currently returns `"Groceries"` for anything unmatched. Change it to return `null` for no keyword match (matched keywords still return their category). "Groceries" remains a real, assignable preset — just not the silent default.
- `guessCategory` return type becomes `string | null`. There are **THREE** callers (break-spec F3), all must handle null:
  1. `app/actions/purchases.ts:createItem` — null guess → create item with `categoryId = null` (skip the category find/create).
  2. `app/actions/receipt.ts` (import create path) — same.
  3. **`app/components/ReceiptImport.tsx:~234`** — `category: guessCategory(it.name)` into `Row.category: string`. This review-row category is **dead** (`draftFromRow` never sends it; the server re-derives), but it must still compile: use `category: guessCategory(it.name) ?? ""` and let the review `<select>` treat `""` as "Uncategorized".
- The manual `PurchaseForm` "Auto" option → guessCategory → may be null → Uncategorized. Its explicit category options are unchanged.

**Reserved labels (break-spec F4):** because `null` renders as "Uncategorized" in the Month `byCat` map, a real category literally named "Uncategorized" would collide on the same map key and silently merge two buckets. So **`"Uncategorized"` and `"Other"` (the retired label) are RESERVED, case-insensitively** — `normalizeCategoryName`, `createCategory`, and `renameCategory` reject them with a friendly error.

### 2.3 Server actions (`app/actions/categories.ts`, all `"use server"` async)
- `createCategory(name)` → `normalizeCategoryName`; reject empty / reserved; reject if a category with the same name exists **case-insensitively** (`findFirst({ where: { name: { equals: n, mode: "insensitive" } } })`); create; `{ ok, id }` / `{ error }`.
- `renameCategory(id, name)` → same validation (non-empty, not reserved, case-insensitive-unique excluding itself); update; `{ ok }` / `{ error }`.
- `deleteCategory(id)` → in a transaction: `item.updateMany({ where: { categoryId: id }, data: { categoryId: null } })` then `category.delete({ where: { id } })`. Returns the count of items that became Uncategorized so the UI can confirm. (The FK is already `ON DELETE SET NULL` — break-spec F6 — so the `updateMany` is belt-and-suspenders + gives the count; safe, no data loss.) Confirmation enforced in the UI before calling.
- `setItemCategory(itemId, categoryId: string | null)` → validate the category exists when non-null; `item.update`. `{ ok }` / `{ error }`.
- All revalidate `/month` and `/prices` (and `/log` for the item list) as appropriate.

**Case-insensitive find-or-create for the AUTO paths (break-spec F5).** The existing `category.upsert({ where: { name } })` calls in `purchases.ts`, `receipt.ts`, and `backup.ts` match case-sensitively, so a manually-created `"dairy"` plus an auto `"Dairy"` could spawn two near-dupes. Replace those upserts with a shared helper `findOrCreateCategory(client, name)` that does a case-insensitive `findFirst` then `create` — so no path can create case-variant duplicates. (Pragmatic alternative to a DB `lower(name)` index, which would force rewriting every by-name lookup; the helper closes the realistic hole without a risky index migration.)

Pure helpers (unit-tested) in `lib/categories.ts`: `normalizeCategoryName(raw): string | null` (trim; collapse inner whitespace; null if empty) and `isReservedCategoryName(name): boolean` (case-insensitive match of "Uncategorized"/"Other"). Keeping the pure bits in `lib/` honors the `"use server"` rule (actions export only async fns).

### 2.4 UI

**Manage the list — `CategoryManager` (client component) on the Month tab.**
- A new "Categories" card on `app/(app)/month/page.tsx` (near Budget / Your data), given the categories list (with per-category item counts).
- Lists each category with its item count (render 0-item categories gracefully — break-spec F11: they legitimately occur after a restore of a slimmer backup); a rename (inline edit) and a delete (inline confirm per UX tokens — "Delete 'X'? N items become Uncategorized"). An "add category" input + button at the bottom.
- Non-blocking toast on success; friendly inline error on failure (duplicate name, etc.).

**Re-file an item — `ItemCategoryPicker` (client component) on the Prices item view.**
- On `app/(app)/prices/page.tsx`, near the item name / `BarcodeLine`, show `Category: <select>` with all categories + an "Uncategorized" option (value = empty → null). Current value preselected.
- On change → `setItemCategory(itemId, categoryId|null)` → toast → `router.refresh()`. This is how the owner fixes items stuck in Groceries.
- Prices is a server component; this picker is the client island (it needs the categories list, passed from the page).

### 2.5 Display: "Other" → "Uncategorized"
- Month `byCat`: null category name becomes `"Uncategorized"` (was `"Other"`).
- `CategoryBars` renders whatever names it's given — no change needed beyond the label the page supplies.

## 3. Backup interaction
- Item→category (by **name**) is already in the backup (`BackupItem.category: string | null`), so re-filed categories and Uncategorized (null) **survive backup/restore**. Restore recreates categories from item.category names. No backup format change needed. (Discounts are not in backup — see §1.5.)

## 4. Files touched (summary)
- `prisma/schema.prisma` + new migration — `ReceiptImport.discountFils` only (NO monthKey — F1).
- `app/actions/receipt.ts` — capture + store `discountFils` from `paidFils`; add `paidFils` to input; handle null guess; use `findOrCreateCategory`.
- `app/components/ReceiptImport.tsx` — pass `parsed.paidFils` to `importReceipt`; `guessCategory(...) ?? ""` (F3).
- `app/(app)/month/page.tsx` — paid-spend calc (derive discounts from live `importId`), footnote, all pace/notes on paid (F8), "Categories" card, "Uncategorized" label.
- `app/(app)/prices/page.tsx` — fetch categories; render `ItemCategoryPicker`.
- `app/actions/categories.ts` (new) — create/rename/delete/setItemCategory + `findOrCreateCategory` helper.
- `lib/categories.ts` — `guessCategory` returns `string | null`; add `normalizeCategoryName` + `isReservedCategoryName` (pure, tested).
- `app/actions/purchases.ts` — handle null guess (categoryId null); use `findOrCreateCategory`.
- `lib/backup.ts` (`restoreBackup` in `app/actions/backup.ts`) — add `receiptImport.deleteMany({})` to the wipe (F2).
- `app/components/CategoryManager.tsx` (new, client) · `app/components/ItemCategoryPicker.tsx` (new, client).

## 5. Testing
**Unit (pure logic):**
- `guessCategory`: matched keyword → category; unmatched → **null** (changed).
- `normalizeCategoryName`: trims, collapses whitespace, empty → null.
- Discount math helper (if extracted): `discountFils(grandTotal, paid)` → clamp ≥0; null paid → 0; paid≥grand → 0; paid<grand → difference.
Keep these in `lib/` with tests alongside the existing suites.

**Live verification (owner's phone + Vercel):**
1. Import a receipt with a discount → Month "Spent" shows what you PAID; footnote shows the shelf total + discount; category chart still sums to shelf.
2. Import with no discount → no footnote; totals unchanged.
3. Month tab → add a category, rename it, delete one (items become Uncategorized, with confirm).
4. Prices → open an item filed in Groceries → change its category → it re-files (Month breakdown updates).
5. A brand-new unknown item (manual or import) → shows as "Uncategorized," not "Groceries."
6. Backup → restore → categories/re-files preserved.

## 5a. Break-spec pass — resolved (2026-07-12)
- **F1 (Major):** discount denormalized on the import broke on purchase-delete → **derive discounts from live `Purchase.importId`; dropped the `monthKey` column** (§1.2, §1.4).
- **F2 (Major):** restore left phantom discounts → derivation ignores importId-null restored rows; also `restoreBackup` now wipes `receiptImport` (§1.5).
- **F3 (Major):** third `guessCategory` caller in `ReceiptImport.tsx` → `?? ""` guard (§2.2).
- **F4 (Major):** "Uncategorized"/"Other" reserved, case-insensitively (§2.2, §2.3).
- **F5 (Minor→fixed):** `findOrCreateCategory` case-insensitive helper for the auto-create paths (§2.3).
- **F8 (Minor):** all pace/note strings use `paidSpentFils` (§1.4).
- **F6/F10/F11 & the paid plumbing:** confirmed sound; F11 (0-item categories) handled in the UI (§2.4).
- **F7/F9:** accepted edges, documented (§1.4, live-verify §5 item 1).

## 6. Original open questions (addressed by the break-spec pass)
- Aggregating discount by `ReceiptImport.monthKey`: any double-count or miss vs deriving from purchases' importIds? Is storing `monthKey` on the import the right call?
- `deleteCategory` transaction: FK/`onDelete` behavior on `Item.categoryId` — is the explicit `updateMany`→`delete` correct and race-safe? What's the current relation `onDelete`?
- Changing `guessCategory` to return `null`: every caller handled? Any test/consumer that assumes a non-null string?
- Uniqueness of category names: case-insensitive compare — collation pitfalls? What about renaming to an existing name, or to "Uncategorized" (should that be reserved since it's the null label)?
- Concurrency: deleting a category while an item is being re-filed into it.
- Does the paid figure ever make pace/projection behave oddly (e.g. paid = 0 with a positive shelf total)?
