# Categories & Discount Accuracy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. ALL work on Opus (project rule). Windows: run npm/npx via `cmd /c "..."`; `git commit -F <file>` (PowerShell mangles special chars); always `Set-Location -LiteralPath` to the repo.

**Goal:** (1) Make the Month "Spent"/budget reflect what was actually PAID (receipt discounts netted out; items stay at shelf price). (2) Let the owner add/rename/delete categories and re-file any item; unknown items file as "Uncategorized" not "Groceries".

**Architecture:** Discount stored per `ReceiptImport` (`discountFils`); Month derives it from LIVE `Purchase.importId` (so deletes/restores can't leave a phantom discount). Categories: pure validation helpers in `lib/categories.ts`, a server-only `findOrCreateCategory` (case-insensitive) in `lib/category-db.ts`, CRUD server actions, and two small client islands (`CategoryManager` on Month, `ItemCategoryPicker` on Prices). Null `categoryId` = "Uncategorized".

**Spec:** `docs/superpowers/specs/2026-07-12-categories-and-discounts-design.md` (break-spec folded in).

**Tech:** Next.js 15 App Router (RSC + Server Actions), React 19, Prisma 7 + Postgres, TS strict, Vitest.

---

## Execution order (break-plan fix — READ THIS FIRST)

The task numbers below are logical groupings, but they MUST be executed in this order/grouping so the tree compiles at every commit. Changing `guessCategory` to return `string | null` breaks its **three** callers (`receipt.ts`, `purchases.ts`, `ReceiptImport.tsx`), so that change must land in the **same commit** as all three caller fixes — never commit Task 1 alone (its intermediate tree does not typecheck).

1. **Task 2** — `lib/category-db.ts` (compiles standalone).
2. **Task 3** — schema + migration + `prisma generate` for `discountFils` (no code uses it yet; tree stays green).
3. **COMBINED green commit** = Task 1 (guessCategory→null + helpers + tests) **＋** Task 4 (all steps) **＋** Task 5 (purchases.ts). Make ALL these edits, THEN run `cmd /c "npx vitest run tests/categories.test.ts"` + `cmd /c "npm run typecheck"` + `cmd /c "npm run build"` + `cmd /c "npm test"` (first point the whole tree compiles), THEN commit ONCE. The per-task "typecheck (clean)" gate lines inside Tasks 1/4/5 are **superseded** by this single combined gate.
4. **Task 6** → **Task 7** → **Task 8** → **Task 9** (note its Step-1 fix) → **Task 10** → **Task 11**, each with its own gate + commit as written.

---

## File Structure
- **Modify** `lib/categories.ts` — `guessCategory` → `string | null`; add `normalizeCategoryName`, `isReservedCategoryName`. (PURE — stays client-safe; it's imported by `ReceiptImport.tsx`. Do NOT add DB code here.)
- **Create** `lib/category-db.ts` — server-only `findOrCreateCategory(client, name)` (case-insensitive find-or-create). Takes a Prisma client or tx.
- **Modify** `prisma/schema.prisma` + **Create** `prisma/migrations/3_receipt_discount/migration.sql` — add `ReceiptImport.discountFils`.
- **Modify** `app/actions/receipt.ts` — `paidFils` input, compute+store `discountFils`, null-guess + `findOrCreateCategory`.
- **Modify** `app/components/ReceiptImport.tsx` — pass `parsed.paidFils`; `guessCategory(...) ?? ""`.
- **Modify** `app/actions/purchases.ts` — `createItem` null-guess + `findOrCreateCategory`.
- **Create** `app/actions/categories.ts` — `createCategory`, `renameCategory`, `deleteCategory`, `setItemCategory`.
- **Modify** `app/(app)/month/page.tsx` — paid-spend calc + footnote + "Uncategorized" label + Categories card.
- **Create** `app/components/CategoryManager.tsx` (client) — add/rename/delete list on Month.
- **Modify** `app/(app)/prices/page.tsx` — fetch categories; render picker.
- **Create** `app/components/ItemCategoryPicker.tsx` (client) — re-file an item.
- **Modify** `app/actions/backup.ts` — `restoreBackup` wipes `receiptImport`; use `findOrCreateCategory`.

---

### Task 1: Pure category helpers (`lib/categories.ts`)

**Files:** Modify `lib/categories.ts`; Test `tests/categories.test.ts` (new).

- [ ] **Step 1: Write failing tests** — create `tests/categories.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { guessCategory, normalizeCategoryName, isReservedCategoryName } from "@/lib/categories";

describe("guessCategory", () => {
  it("matches known keywords", () => {
    expect(guessCategory("Al Marai Milk FF 1")).toBe("Dairy");
    expect(guessCategory("Brown Bread")).toBe("Bakery");
    expect(guessCategory("Fresh Bananas")).toBe("Produce");
  });
  it("returns null for anything it can't place (was 'Groceries')", () => {
    expect(guessCategory("AG PCORN")).toBeNull();
    expect(guessCategory("Basmati Rice 5kg")).toBeNull();
    expect(guessCategory("")).toBeNull();
  });
});

describe("normalizeCategoryName", () => {
  it("trims and collapses inner whitespace", () => {
    expect(normalizeCategoryName("  Frozen   Foods ")).toBe("Frozen Foods");
  });
  it("returns null for empty/whitespace", () => {
    expect(normalizeCategoryName("   ")).toBeNull();
    expect(normalizeCategoryName("")).toBeNull();
  });
});

describe("isReservedCategoryName", () => {
  it("reserves Uncategorized and Other, case-insensitively", () => {
    expect(isReservedCategoryName("Uncategorized")).toBe(true);
    expect(isReservedCategoryName("uncategorized")).toBe(true);
    expect(isReservedCategoryName("OTHER")).toBe(true);
    expect(isReservedCategoryName("Dairy")).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `cmd /c "npx vitest run tests/categories.test.ts"` (normalizeCategoryName/isReservedCategoryName not exported; guessCategory returns "Groceries" not null).

- [ ] **Step 3: Implement** — replace `lib/categories.ts` body:

```ts
export const PRESET_CATEGORIES = ["Dairy", "Produce", "Bakery", "Household", "Snacks", "Groceries"];

const KEYWORDS: Record<string, string> = {
  milk: "Dairy", laban: "Dairy", cream: "Dairy", yog: "Dairy", cheese: "Dairy",
  bread: "Bakery", bun: "Bakery", croissant: "Bakery",
  banana: "Produce", apple: "Produce", tomato: "Produce", eggplant: "Produce", onion: "Produce",
  detergent: "Household", tissue: "Household", soap: "Household",
  chips: "Snacks", chocolate: "Snacks", gum: "Snacks", biscuit: "Snacks",
};

/** Best-effort category from an item name, or null when nothing matches
 *  (null files as "Uncategorized" so mis-files are visible, not hidden in Groceries). */
export function guessCategory(name: string): string | null {
  const n = name.toLowerCase();
  for (const k in KEYWORDS) if (n.includes(k)) return KEYWORDS[k];
  return null;
}

const RESERVED = new Set(["uncategorized", "other"]);

/** Trim + collapse inner whitespace; null if empty. */
export function normalizeCategoryName(raw: string): string | null {
  const n = raw.trim().replace(/\s+/g, " ");
  return n.length === 0 ? null : n;
}

/** True for names reserved by the app (the null-category label). Case-insensitive. */
export function isReservedCategoryName(name: string): boolean {
  return RESERVED.has(name.trim().toLowerCase());
}
```

- [ ] **Step 4: Run — expect PASS** — `cmd /c "npx vitest run tests/categories.test.ts"`.

- [ ] **Step 5: Commit** — msg `feat(accuracy): category helpers — guessCategory→null, normalize, reserved`.

---

### Task 2: Server-only `findOrCreateCategory` (`lib/category-db.ts`)

**Files:** Create `lib/category-db.ts`. (No unit test — DB helper; covered by typecheck/build + live. Keep it out of `lib/categories.ts` so the client-imported pure file never pulls in Prisma.)

- [ ] **Step 1: Create the file**:

```ts
import type { PrismaClient, Prisma } from "@prisma/client";

type Client = PrismaClient | Prisma.TransactionClient;

/**
 * Find a category by name CASE-INSENSITIVELY, else create it. Prevents the
 * case-variant duplicates the old case-sensitive upsert allowed (break-spec F5).
 * Returns the category id.
 */
export async function findOrCreateCategory(client: Client, name: string): Promise<string> {
  const existing = await client.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await client.category.create({ data: { name }, select: { id: true } });
  return created.id;
}
```

- [ ] **Step 2: Typecheck** — `cmd /c "npm run typecheck"` (clean; unused for now is fine).
- [ ] **Step 3: Commit** — msg `feat(accuracy): findOrCreateCategory (case-insensitive, server-only)`.

---

### Task 3: Discount schema + migration

**Files:** Modify `prisma/schema.prisma`; Create `prisma/migrations/3_receipt_discount/migration.sql`.

- [ ] **Step 1: Add the field** — in `prisma/schema.prisma`, `ReceiptImport` model, after `totalFils`:

```prisma
  discountFils Int @default(0) // trip discount = shelf grand total − paid; nets the Month total to what was paid
```

- [ ] **Step 2: Write the migration** — create `prisma/migrations/3_receipt_discount/migration.sql`:

```sql
-- Add per-receipt discount (fils). Existing rows default to 0 (never captured before).
ALTER TABLE "ReceiptImport" ADD COLUMN "discountFils" INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 3: Regenerate the client** — `cmd /c "npx prisma generate"` (so `discountFils` is in the TS types for the build).
- [ ] **Step 4: Typecheck + build** — `cmd /c "npm run typecheck"` then `cmd /c "npm run build"` (clean).
- [ ] **Step 5: Commit** — msg `feat(accuracy): ReceiptImport.discountFils + migration 3`.

---

### Task 4: Capture the discount at import (`app/actions/receipt.ts` + `ReceiptImport.tsx`)

**Files:** Modify `app/actions/receipt.ts`, `app/components/ReceiptImport.tsx`.

- [ ] **Step 1: Extend the input type** — in `receipt.ts`, add to `ImportReceiptInput`:

```ts
  /** Amount actually paid (after discount), from the parse. Null when unknown. */
  paidFils?: number | null;
```

- [ ] **Step 2: Compute + store discount** — in `importReceipt`, after `const totalFils = grandTotalFils ?? items.reduce(...)`, add:

```ts
  const discountFils =
    grandTotalFils != null && input.paidFils != null && input.paidFils < grandTotalFils
      ? grandTotalFils - input.paidFils
      : 0;
```

Then in the `tx.receiptImport.create` call, add `discountFils` to `data`:

```ts
      data: { fingerprint, store: "Carrefour", totalFils, discountFils },
```

- [ ] **Step 3: Null-safe category on the create path** — in `importReceipt`'s `else` (create) branch, replace the `guessCategory` + `category.upsert` block with:

```ts
        const catName = guessCategory(draft.name); // string | null now
        let categoryId: string | null = null;
        if (catName) {
          categoryId = categoryCache.get(catName) ?? null;
          if (!categoryId) {
            categoryId = await findOrCreateCategory(tx, catName);
            categoryCache.set(catName, categoryId);
          }
        }
        const created = await tx.item.create({
          data: { name: draft.name.trim(), normalized: normalizeName(draft.name), categoryId },
          select: { id: true },
        });
```

Add the import at the top: `import { findOrCreateCategory } from "@/lib/category-db";` (keep `guessCategory` import).

- [ ] **Step 4: Pass paidFils from the client** — in `ReceiptImport.tsx` `save()`, in the `importReceipt({ ... })` call, add `paidFils: parsed.paidFils,` (alongside `grandTotalFils`). Fix the dead review-category to compile with the new null return: change `category: guessCategory(it.name),` to `category: guessCategory(it.name) ?? "",`. **Also relabel the review `<select>`** (break-plan MINOR) so a `""` value reads "Uncategorized": in the options `.map((c) => ...)` render the label as `{c === "" ? "Uncategorized" : c}`, and make the option list include `""` when `row.category === ""` (mirror the existing `PRESET_CATEGORIES.includes(row.category) ? PRESET_CATEGORIES : [row.category, ...PRESET_CATEGORIES]` pattern — with `row.category === ""` that yields `["", ...PRESET_CATEGORIES]`, so just fix the label).

- [ ] **Step 5: Typecheck + build** — `cmd /c "npm run typecheck"` then `cmd /c "npm run build"` (clean).
- [ ] **Step 6: Commit** — msg `feat(accuracy): capture receipt discount at import; null-safe category`.

---

### Task 5: Null-safe category on manual add (`app/actions/purchases.ts`)

**Files:** Modify `app/actions/purchases.ts`.

- [ ] **Step 1: Update `createItem`** — replace its body with a null-safe version:

```ts
async function createItem(input: AddPurchaseInput): Promise<string> {
  const catName = input.categoryName?.trim() || guessCategory(input.itemName); // string | null
  let categoryId: string | null = null;
  if (catName) categoryId = await findOrCreateCategory(db, catName);
  const item = await db.item.create({
    data: {
      name: input.itemName.trim(),
      normalized: normalizeName(input.itemName),
      categoryId,
    },
  });
  return item.id;
}
```

Add `import { findOrCreateCategory } from "@/lib/category-db";` and remove the now-unused `guessCategory`/`category.upsert` usage if it becomes unused elsewhere (keep `guessCategory` import — still used here).

- [ ] **Step 2: Typecheck + build** — clean.
- [ ] **Step 3: Commit** — msg `feat(accuracy): manual add files unknown items as Uncategorized`.

---

### Task 6: Category CRUD actions (`app/actions/categories.ts`)

**Files:** Create `app/actions/categories.ts`.

- [ ] **Step 1: Create the actions**:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { normalizeCategoryName, isReservedCategoryName } from "@/lib/categories";

type Ok = { ok: true };
type Err = { error: string };

async function nameError(name: string, excludeId?: string): Promise<string | null> {
  if (isReservedCategoryName(name)) return `"${name}" is a reserved name.`;
  const clash = await db.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  return clash ? `A category called "${name}" already exists.` : null;
}

export async function createCategory(raw: string): Promise<(Ok & { id: string }) | Err> {
  const name = normalizeCategoryName(raw);
  if (!name) return { error: "Enter a category name." };
  const err = await nameError(name);
  if (err) return { error: err };
  const cat = await db.category.create({ data: { name }, select: { id: true } });
  revalidatePath("/month"); revalidatePath("/prices"); revalidatePath("/log");
  return { ok: true, id: cat.id };
}

export async function renameCategory(id: string, raw: string): Promise<Ok | Err> {
  const name = normalizeCategoryName(raw);
  if (!name) return { error: "Enter a category name." };
  const err = await nameError(name, id);
  if (err) return { error: err };
  await db.category.update({ where: { id }, data: { name } });
  revalidatePath("/month"); revalidatePath("/prices"); revalidatePath("/log");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<{ ok: true; movedToUncategorized: number } | Err> {
  const moved = await db.$transaction(async (tx) => {
    const res = await tx.item.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
    await tx.category.delete({ where: { id } });
    return res.count;
  });
  revalidatePath("/month"); revalidatePath("/prices"); revalidatePath("/log");
  return { ok: true, movedToUncategorized: moved };
}

export async function setItemCategory(itemId: string, categoryId: string | null): Promise<Ok | Err> {
  if (categoryId) {
    const exists = await db.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!exists) return { error: "That category no longer exists." };
  }
  await db.item.update({ where: { id: itemId }, data: { categoryId } });
  revalidatePath("/month"); revalidatePath("/prices");
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck + build** — clean.
- [ ] **Step 3: Commit** — msg `feat(accuracy): category CRUD + re-file actions`.

---

### Task 7: Month page — paid spend + footnote + Uncategorized

**Files:** Modify `app/(app)/month/page.tsx`.

- [ ] **Step 1: Derive discounts + paid spend** — replace `const spentFils = purchases.reduce((s, p) => s + p.totalFils, 0);` with:

```ts
  const shelfSpentFils = purchases.reduce((s, p) => s + p.totalFils, 0);
  const importIds = [...new Set(purchases.map((p) => p.importId).filter((x): x is string => !!x))];
  const discountImports = importIds.length
    ? await db.receiptImport.findMany({ where: { id: { in: importIds } }, select: { discountFils: true } })
    : [];
  const discountsFils = discountImports.reduce((s, i) => s + i.discountFils, 0);
  const spentFils = Math.max(0, shelfSpentFils - discountsFils); // what was PAID; used everywhere below
```

(`purchases` already carry `importId` — it's a scalar column, returned by default. Keep the rest of the file's `spentFils` references — they now mean paid.)

- [ ] **Step 2: "Uncategorized" label** — in the category loop, change `const name = p.item.category?.name ?? "Other";` to `?? "Uncategorized";`.

- [ ] **Step 3: Discount footnote** — inside the "Spent vs budget" card, right after the big amount `<div className="mono" …>…</div>`, add:

```tsx
        {discountsFils > 0 && (
          <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: "6px 0 0" }}>
            Items total {formatAed(shelfSpentFils)} at shelf price · you paid{" "}
            {formatAed(spentFils)} after {formatAed(discountsFils)} in receipt discounts.
          </p>
        )}
```

- [ ] **Step 4: Typecheck + build** — clean.
- [ ] **Step 5: Commit** — msg `feat(accuracy): Month reflects amount paid + discount footnote`.

---

### Task 8: CategoryManager on the Month tab

**Files:** Create `app/components/CategoryManager.tsx`; Modify `app/(app)/month/page.tsx`.

- [ ] **Step 1: Fetch categories with counts** — in `month/page.tsx`, add to the `Promise.all`:

```ts
    db.category.findMany({
      select: { id: true, name: true, _count: { select: { items: true } } },
      orderBy: { name: "asc" },
    }),
```

Destructure it (e.g. `categoriesRaw`) and map to a serialisable shape: `const categories = categoriesRaw.map((c) => ({ id: c.id, name: c.name, count: c._count.items }));`

- [ ] **Step 2: Create the component** — `app/components/CategoryManager.tsx`, a `"use client"` component taking `categories: { id: string; name: string; count: number }[]`. It renders each row (name + count + rename/delete), an add-input, uses `createCategory`/`renameCategory`/`deleteCategory` from `@/app/actions/categories`, `router.refresh()` after success, a non-blocking toast, inline error text, and an **inline confirm** for delete ("Delete 'X'? N items become Uncategorized"). Handles 0-count categories. Match the inline-style / token pattern used by `BackupRestore`/`PurchaseForm` (design tokens, no new globals).

- [ ] **Step 3: Render it on Month** — add a card near "Your data":

```tsx
      <div className="card">
        <div className="card-kicker">Categories</div>
        <CategoryManager categories={categories} />
      </div>
```

Import it at the top.

- [ ] **Step 4: Typecheck + build** — clean.
- [ ] **Step 5: Commit** — msg `feat(accuracy): CategoryManager (add/rename/delete) on Month`.

---

### Task 9: ItemCategoryPicker on Prices

**Files:** Create `app/components/ItemCategoryPicker.tsx`; Modify `app/(app)/prices/page.tsx`.

- [ ] **Step 1: Fetch categories on Prices** — in `prices/page.tsx`, add `const categories = await db.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });`. **Do NOT touch the `selected` query** (break-plan MINOR): it uses `include`, so all Item scalars — including `categoryId` (`string | null`) — are already returned; `selected!.categoryId` is directly available. (Adding `categoryId: true` to an `include` is a TS error — `include` accepts only relation fields.)

- [ ] **Step 2: Create the component** — `app/components/ItemCategoryPicker.tsx`, `"use client"`, props `{ itemId: string; categoryId: string | null; categories: { id: string; name: string }[] }`. A labelled `<select>` with an "Uncategorized" option (value `""` → null) + each category; current value preselected; on change calls `setItemCategory(itemId, value || null)` from `@/app/actions/categories`, then `router.refresh()` + toast. Token styling.

- [ ] **Step 3: Render it on Prices** — under the item name / `BarcodeLine` (page level, so it shows even with no purchases):

```tsx
      <ItemCategoryPicker itemId={selected!.id} categoryId={selected!.categoryId} categories={categories} />
```

Import it; guard so it only renders when `selected` exists.

- [ ] **Step 4: Typecheck + build** — clean.
- [ ] **Step 5: Commit** — msg `feat(accuracy): re-file an item's category on Prices`.

---

### Task 10: Backup restore — drop stale imports (`app/actions/backup.ts`)

**Files:** Modify `app/actions/backup.ts`.

- [ ] **Step 1: Wipe receiptImport on restore** — in `restoreBackup`'s wipe block (inside the transaction, alongside the existing `purchase`/`item`/`budget` deletes), add `await tx.receiptImport.deleteMany({});` (do it BEFORE deleting items/purchases if FK order requires — `Purchase.importId` is `SET NULL`, so order is not strict, but delete purchases before/along with imports). If the restore rebuilds categories from item.category names via an upsert, switch that to `findOrCreateCategory(tx, name)` for case-insensitive consistency.

- [ ] **Step 2: Typecheck + build + full test run** — `cmd /c "npm test"` (existing backup tests still green), typecheck + build clean.
- [ ] **Step 3: Commit** — msg `fix(accuracy): restore wipes stale receipt imports (no phantom discount)`.

---

### Task 11: Verification gate (break-build + live)

- [ ] **Step 1: Full suite + typecheck + build** — `cmd /c "npm test"` (all green, incl. new category tests), typecheck clean, build clean.
- [ ] **Step 2: Break-build adversarial pass** — fresh skeptical Opus vs the diff + spec's adversarial cases (discount-from-live-importId correctness, delete/restore no phantom, reserved-name enforcement, case-insensitive dupes, null-category display, RSC boundaries of the two client islands, the migration). Fix findings (test → fix → commit).
- [ ] **Step 3: Push + verify Ready** — `git push origin main`; then `cmd /c "vercel inspect <latest>"` → `status ● Ready` (the migration `3_receipt_discount` applies via `vercel-build`; "No pending migrations" won't appear — it's new).
- [ ] **Step 4: Live verify (owner's phone + Vercel)** — per spec §5: re-import the discounted receipt → Month shows amount PAID + footnote; category chart still shelf; add/rename/delete a category (items → Uncategorized, confirmed); re-file a Groceries item on Prices; a new unknown item shows Uncategorized; backup→restore preserves categories.
- [ ] **Step 5: Update hub board + docs** — flip the "Categories & discount accuracy" card steps to done on `docs/progress.html`; note it in HANDOVER.md / MASTER-DOCUMENTATION.md. Commit + push.

---

## Notes
- The migration only ADDS a defaulted column — safe on existing Neon data via `prisma migrate deploy`.
- Do NOT put DB code in `lib/categories.ts` (it's imported by the client `ReceiptImport.tsx`). DB helper lives in `lib/category-db.ts`.
- Items stay at shelf price; only the Month total and category filing change.
