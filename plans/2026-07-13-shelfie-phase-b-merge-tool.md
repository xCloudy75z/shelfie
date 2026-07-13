# Phase B — Merge Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. ALL work on Opus. Windows: npm/npx via `cmd /c "..."`; `git commit -F <file>`; always `Set-Location -LiteralPath` to the repo. No local DB — tests/typecheck/build are DB-free; the merge actions are verified by build + live (there's no schema change).

**Goal:** On the Prices item view, fold two items into one — the owner taps which name to keep (that item survives); the other item's purchases + barcodes move to it, then it's deleted. One-tap Undo.

**Architecture:** A pure `validateMerge` + `MergeUndo` type in `lib/merge.ts` (unit-tested). Two server actions in `app/actions/merge.ts` (`mergeItems`, `undoMerge`) doing the DB work in a transaction with the break-spec-mandated ordering + undo-collision tolerance. One client island `ItemMergeControl` on Prices. No schema change.

**Spec:** `docs/superpowers/specs/2026-07-13-phase-b-merge-tool-design.md` (break-spec folded in).

**Tech:** Next.js 15 App Router (RSC + Server Actions), React 19, Prisma 7 + Postgres, TS strict, Vitest.

---

## File Structure
- **Create** `lib/merge.ts` — `MergeUndo` type + pure `validateMerge`. (No DB — safe to import from the client control for the type.)
- **Create** `tests/merge.test.ts` — `validateMerge` cases.
- **Create** `app/actions/merge.ts` — `mergeItems`, `undoMerge` (`"use server"`).
- **Create** `app/components/ItemMergeControl.tsx` — client island on Prices.
- **Modify** `app/(app)/prices/page.tsx` — render `ItemMergeControl` with the other-items list.

---

### Task 1: Pure merge helper (`lib/merge.ts`)

**Files:** Create `lib/merge.ts`; Test `tests/merge.test.ts`.

- [ ] **Step 1: Write failing tests** — create `tests/merge.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateMerge } from "@/lib/merge";

const ids = new Set(["a", "b", "c"]);

describe("validateMerge", () => {
  it("accepts two distinct existing items", () => {
    expect(validateMerge("a", "b", ids)).toEqual({ ok: true });
  });
  it("rejects merging an item into itself", () => {
    expect(validateMerge("a", "a", ids)).toEqual({ error: "Can't merge an item into itself." });
  });
  it("rejects an unknown survivor or merged id", () => {
    expect("error" in validateMerge("a", "z", ids)).toBe(true);
    expect("error" in validateMerge("z", "a", ids)).toBe(true);
  });
  it("rejects empty ids", () => {
    expect("error" in validateMerge("", "b", ids)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `cmd /c "npx vitest run tests/merge.test.ts"` (module/function missing).

- [ ] **Step 3: Implement** — create `lib/merge.ts`:

```ts
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
```

- [ ] **Step 4: Run — expect PASS** — `cmd /c "npx vitest run tests/merge.test.ts"`; then `cmd /c "npm test"` (all green) + `cmd /c "npm run typecheck"`.

- [ ] **Step 5: Commit** — msg `feat(phase-b): validateMerge + MergeUndo (pure, tested)`.

---

### Task 2: Merge + undo server actions (`app/actions/merge.ts`)

**Files:** Create `app/actions/merge.ts`. (No unit test — DB actions; verified by build + break-build + live. The correctness risk lives here, so the build review scrutinises the ordering + undo.)

- [ ] **Step 1: Create the actions**:

```ts
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
```

- [ ] **Step 2: Typecheck + build** — `cmd /c "npm run typecheck"` then `cmd /c "npm run build"` (clean).
- [ ] **Step 3: Commit** — msg `feat(phase-b): mergeItems + undoMerge actions (ordered, undo-safe)`.

---

### Task 3: `ItemMergeControl` on the Prices item view

**Files:** Create `app/components/ItemMergeControl.tsx`; Modify `app/(app)/prices/page.tsx`.

- [ ] **Step 1: Create the component** — `app/components/ItemMergeControl.tsx`:

```tsx
"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { mergeItems, undoMerge } from "@/app/actions/merge";
import type { MergeUndo } from "@/lib/merge";

type ItemRef = { id: string; name: string };

const s = {
  linkBtn: {
    border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink-soft)",
    borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  field: {
    width: "100%", padding: "11px 12px", border: "1px solid var(--line)", borderRadius: 10,
    fontSize: 15, background: "var(--card)", color: "var(--ink)", fontFamily: "inherit",
  },
  primaryBtn: {
    flex: 1, border: 0, borderRadius: 12, padding: "11px 12px", fontSize: 14, fontWeight: 700,
    color: "#fff", background: "var(--green)", cursor: "pointer",
  },
  softBtn: {
    flex: 1, border: "1px solid var(--line)", borderRadius: 12, padding: "11px 12px",
    fontSize: 14, fontWeight: 700, background: "var(--card)", color: "var(--ink)", cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;

export default function ItemMergeControl({
  currentItem,
  otherItems,
}: {
  currentItem: ItemRef;
  otherItems: ItemRef[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [otherId, setOtherId] = useState("");
  const [undo, setUndo] = useState<MergeUndo | null>(null);
  const [undone, setUndone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (otherItems.length === 0) return null; // nothing to merge into

  const other = otherItems.find((i) => i.id === otherId) ?? null;

  function run(survivorId: string, mergedId: string) {
    setError(null);
    startTransition(async () => {
      const res = await mergeItems(survivorId, mergedId);
      if ("error" in res) { setError(res.error); return; }
      setUndo(res.undo);
      setUndone(false);
      setOpen(false);
      setOtherId("");
      setToast("Merged ✓");
      window.setTimeout(() => setToast(null), 4000);
      router.push(`/prices?item=${survivorId}`);
    });
  }

  function doUndo() {
    if (!undo || undone) return;
    setUndone(true); // disable after first tap
    startTransition(async () => {
      const res = await undoMerge(undo);
      if ("error" in res) { setError(res.error); setUndone(false); return; }
      setUndo(null);
      setToast("Merge undone");
      window.setTimeout(() => setToast(null), 3000);
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: 10 }}>
      {!open ? (
        <button type="button" style={s.linkBtn} onClick={() => { setOpen(true); setError(null); }}>
          ⤵ Merge into another item…
        </button>
      ) : (
        <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, background: "var(--card-2)" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", margin: "0 2px 6px" }}>
            Merge <strong>{currentItem.name}</strong> with:
          </label>
          <select value={otherId} onChange={(e) => setOtherId(e.target.value)} style={s.field} aria-label="Item to merge with">
            <option value="">Pick an item…</option>
            {otherItems.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>

          {other && (
            <>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "12px 2px 8px" }}>
                Keep which name? The other item's purchases &amp; barcodes move over, then it's removed.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" disabled={pending} style={s.primaryBtn} onClick={() => run(currentItem.id, other.id)}>
                  Keep “{currentItem.name}”
                </button>
                <button type="button" disabled={pending} style={s.primaryBtn} onClick={() => run(other.id, currentItem.id)}>
                  Keep “{other.name}”
                </button>
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" style={s.softBtn} onClick={() => { setOpen(false); setOtherId(""); setError(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ color: "var(--red)", fontSize: 13, fontWeight: 600, margin: "8px 2px 0" }}>{error}</p>}

      {toast && (
        <div role="status" style={{
          display: "flex", alignItems: "center", gap: 12, marginTop: 10, padding: "10px 12px",
          borderRadius: 12, background: "var(--green-soft)", color: "var(--green-strong)", fontWeight: 600, fontSize: 14,
        }}>
          <span>{toast}</span>
          {undo && !undone && (
            <button type="button" onClick={doUndo} disabled={pending}
              style={{ marginLeft: "auto", ...s.softBtn, flex: "none", padding: "6px 12px" }}>
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Render it on Prices** — in `app/(app)/prices/page.tsx`, where the item identity controls render (near `ItemCategoryPicker` / `BarcodeLine`, page level so it shows even with no purchases), add:

```tsx
      {selected && (
        <ItemMergeControl
          currentItem={{ id: selected.id, name: selected.name }}
          otherItems={items.filter((i) => i.id !== selected.id)}
        />
      )}
```

Import at the top: `import ItemMergeControl from "@/app/components/ItemMergeControl";`. (`items` — the full `{id,name}` list — is already fetched for `PriceItemPicker`; `selected` is the current item.)

- [ ] **Step 3: Typecheck + build** — `cmd /c "npm run typecheck"` then `cmd /c "npm run build"` (clean; /prices compiles).
- [ ] **Step 4: Commit** — msg `feat(phase-b): merge control on the Prices item view (choose surviving name + undo)`.

---

### Task 4: Verification gate (break-build ×2 + live)

- [ ] **Step 1: Full suite + typecheck + build** — `cmd /c "npm test"` (all green incl. merge tests), typecheck clean, build clean.
- [ ] **Step 2: Break-build pass #1** — fresh skeptical Opus vs the diff + spec's adversarial cases (the load-bearing move-before-delete order, undo name-collision + deleted-category tolerance, concurrency, `?item` fallback, no data loss). Fix findings (→ commit).
- [ ] **Step 3: Break-build pass #2** — a SECOND, independent fresh skeptic (owner rule 2026-07-13). Fix findings (→ commit).
- [ ] **Step 4: Push + verify Ready** — `git push origin main`; `cmd /c "vercel inspect <latest>"` → `status ● Ready` (no migration this phase).
- [ ] **Step 5: Live verify (owner's iPhone + Vercel)** — per spec §7: merge two dupes choosing the name; price story combines both; barcodes carried; Undo restores; barcode-only merge; Month totals unchanged; self-merge not offered.
- [ ] **Step 6: Update hub board + docs** — flip the Phase B card steps to done on `docs/progress.html` + the hub timeline node; note it in HANDOVER.md. Commit + push.

---

## Notes
- No schema change — nothing to migrate.
- The ONE spot correctness lives is `app/actions/merge.ts`; both build reviews must confirm the move-before-delete order (Barcode cascade) and the undo tolerances.
- `lib/merge.ts` stays DB-free (imported by the client control for `MergeUndo`).
