# Categories & Discount Accuracy — design spec

**Date:** 2026-07-12
**Status:** owner-approved (design); pending break-spec pass
**Why:** The owner is using the live app with real receipts and hit two gaps: (1) a receipt discount made the Month budget overstate what he actually paid, and (2) the auto-categoriser dumps almost everything into "Groceries" with no way to manage categories or re-file items.

This is one focused "Month accuracy" feature in two parts. Item shelf prices and price intelligence are **not** touched.

## 1. Part 1 — Discount accuracy

### 1.1 Goal
The Month **"Spent"** and budget pace must reflect **what was actually paid** = shelf total − receipt discount. Items stay logged at shelf price. The category chart stays shelf-based (a discount belongs to no single category — owner's decision, "Option 2"), with a footnote explaining the gap.

### 1.2 Data model
Add to `ReceiptImport`:
- `discountFils Int @default(0)` — the trip's discount = `grandTotalShelf − paid`, clamped ≥ 0.
- `monthKey String?` — the pay-cycle month the trip belongs to (from `purchasedAt`, via `dubaiMonthKey`), so the Month page can aggregate discounts by month without joining purchases. Indexed.

Migration: hand-authored `prisma/migrations/<n>_receipt_discount/migration.sql` adding both columns + an index on `monthKey`. Existing rows get `discountFils = 0`, `monthKey = NULL` (so old imports contribute no discount — correct, since their discount was never captured).

### 1.3 Capture at import
- `parseReceipt` already yields `paidFils` (the amount actually paid, after discount) and `grandTotalFils` (sum of shelf lines). The review UI already computes a display-only discount from these.
- `importReceipt` input gains `paidFils?: number | null`. The client (`ReceiptImport.tsx` `save()`) passes `parsed.paidFils`.
- Server computes `discountFils = (grandTotalFils != null && paidFils != null && paidFils < grandTotalFils) ? grandTotalFils − paidFils : 0` (integer, ≥ 0), and stores it plus `monthKey` on the `ReceiptImport` row. Purchases still store shelf `lineFils` — unchanged.

### 1.4 Month page
- `shelfSpentFils = Σ purchase.totalFils` (today's value; rename the local from `spentFils`).
- `discountsFils = (db.receiptImport.aggregate({ where: { monthKey: selected }, _sum: { discountFils: true } }))._sum.discountFils ?? 0` — added to the existing `Promise.all`.
- `paidSpentFils = Math.max(0, shelfSpentFils − discountsFils)`.
- **Use `paidSpentFils`** for: the headline "Spent" figure, the pace metric + projection, and `barPct`. (What you paid vs budget.)
- **Category breakdown unchanged** — still built from `purchase.totalFils` (shelf). 
- **Footnote (only when `discountsFils > 0`):** a small muted line under the Spent card: `Items total {formatAed(shelfSpentFils)} at shelf price · you paid {formatAed(paidSpentFils)} after {formatAed(discountsFils)} in receipt discounts.`

### 1.5 Discount edge cases
- `paidFils` null (parser found no paid line) → discount 0, no change.
- `paidFils ≥ grandTotal` (rounding / no discount) → clamp to 0.
- Multiple imports in one month → summed by the aggregate.
- A user later edits an imported purchase's **date** into another month: the import's `monthKey` stays put, so the discount stays attributed to the trip's original month while that purchase moves. Accepted, documented (rare; the discount belongs to the trip's date).
- Discounts are **not** in the backup file (ReceiptImports never were) → a restore loses discount adjustments. Accepted existing limitation; note in the spec, not fixed here.

## 2. Part 2 — Category management

### 2.1 Goals
- Add / rename / delete categories.
- Re-file any item into a different category (per-item; re-files it everywhere since category is per-item).
- Stop silently dumping unknown items into "Groceries."

### 2.2 The "Uncategorized" model (no new seeded row)
`Item.categoryId` is already optional. **A null category displays as "Uncategorized"** everywhere (replacing today's "Other" label in the Month breakdown). No "Uncategorized" Category row is created — it is simply the null state. This keeps the manageable category list clean (real categories only) and gives deletes a safe target (set items' `categoryId = null`).

**Catch-all change:** `guessCategory` currently returns `"Groceries"` for anything unmatched. Change it to return `null` for no keyword match (matched keywords still return their category). Callers (`createItem` in `purchases.ts`, the create path in `importReceipt`) already build an item; when the guess is null the item is created with `categoryId = null` (Uncategorized). "Groceries" remains a real, assignable preset — just not the silent default.
- `guessCategory` return type becomes `string | null`. Update both callers to treat null as "no category" (skip the category upsert, leave `categoryId` null).
- The manual `PurchaseForm` "Auto" option → guessCategory → may be null → Uncategorized. Its explicit category options are unchanged.

### 2.3 Server actions (`app/actions/categories.ts`, all `"use server"` async)
- `createCategory(name: string)` → trim; reject empty; reject if a category with the same name (case-insensitive) exists; create; return `{ ok, id }` or `{ error }`.
- `renameCategory(id, name)` → validate as above (unique, non-empty); update; `{ ok }` / `{ error }`.
- `deleteCategory(id)` → in a transaction: `item.updateMany({ where: { categoryId: id }, data: { categoryId: null } })` then `category.delete({ where: { id } })`. Returns the count of items that became Uncategorized so the UI can confirm. Confirmation is enforced in the UI before calling.
- `setItemCategory(itemId, categoryId: string | null)` → validate the category exists when non-null; `item.update`. `{ ok }` / `{ error }`.
- All revalidate `/month` and `/prices` (and `/log` for the item list) as appropriate.

Validation helper (pure, unit-tested) in `lib/categories.ts`: `normalizeCategoryName(raw): string | null` (trim; collapse inner whitespace; return null if empty) and a case-insensitive compare used by the uniqueness check. Keeping the pure bits in `lib/` honors the `"use server"` rule (actions export only async fns).

### 2.4 UI

**Manage the list — `CategoryManager` (client component) on the Month tab.**
- A new "Categories" card on `app/(app)/month/page.tsx` (near Budget / Your data), given the categories list (with per-category item counts).
- Lists each category with its item count; a rename (inline edit) and a delete (inline confirm per UX tokens — "Delete 'X'? N items become Uncategorized"). An "add category" input + button at the bottom.
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
- `prisma/schema.prisma` + new migration — `ReceiptImport.discountFils`, `ReceiptImport.monthKey`.
- `app/actions/receipt.ts` — capture + store discount/monthKey; add `paidFils` to input.
- `app/components/ReceiptImport.tsx` — pass `parsed.paidFils` to `importReceipt`.
- `app/(app)/month/page.tsx` — paid-spend calc, discount aggregate, footnote, "Categories" card, "Uncategorized" label.
- `app/(app)/prices/page.tsx` — fetch categories; render `ItemCategoryPicker`.
- `app/actions/categories.ts` (new) — create/rename/delete/setItemCategory.
- `lib/categories.ts` — `guessCategory` returns `string | null`; add `normalizeCategoryName` + case-insensitive compare (pure, tested).
- `app/actions/purchases.ts` + `app/actions/receipt.ts` — handle null guess (categoryId null).
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

## 6. Open questions for the break-spec pass
- Aggregating discount by `ReceiptImport.monthKey`: any double-count or miss vs deriving from purchases' importIds? Is storing `monthKey` on the import the right call?
- `deleteCategory` transaction: FK/`onDelete` behavior on `Item.categoryId` — is the explicit `updateMany`→`delete` correct and race-safe? What's the current relation `onDelete`?
- Changing `guessCategory` to return `null`: every caller handled? Any test/consumer that assumes a non-null string?
- Uniqueness of category names: case-insensitive compare — collation pitfalls? What about renaming to an existing name, or to "Uncategorized" (should that be reserved since it's the null label)?
- Concurrency: deleting a category while an item is being re-filed into it.
- Does the paid figure ever make pace/projection behave oddly (e.g. paid = 0 with a positive shelf total)?
