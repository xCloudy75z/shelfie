# Edit-a-purchase popup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (a fresh Opus subagent per task) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking. **ALL OPUS.**

**Goal:** On the Month tab, replace the inline-expanding purchase editor with a centered **modal popup** (same fields + Save + Delete), portaled to `document.body`.

**Architecture:** One new pure helper (`isPurchaseDirty`, TDD'd) drives the pristine close-guard. One new client component (`PurchaseEditModal`) holds the edit form + all modal chrome (backdrop z-200, safe-area, focus trap via `inert`, scroll-lock, precise backdrop hit-test, keyboard-aware height). `EditablePurchases` is slimmed to a list of trigger buttons that open the modal. **No server/action/schema/data changes** — `updatePurchase`/`deletePurchase` are called byte-for-byte as today.

**Tech Stack:** Next.js 15 / React 19 client component, `createPortal`, `useTransition`, Vitest, CSS-variable tokens.

**Spec:** `docs/superpowers/specs/2026-07-13-edit-purchase-popup-design.md` (read it — all 14 break-spec findings are folded into the requirements below).

---

## File structure

- **Create** `lib/purchase-edit.ts` — `EditableFields` type + `isPurchaseDirty(initial, current)` pure helper. Client-safe (no DB, no `"use server"`).
- **Create** `tests/purchase-edit.test.ts` — unit tests for `isPurchaseDirty`.
- **Create** `app/components/PurchaseEditModal.tsx` — the modal (form + chrome). `"use client"`.
- **Modify** `app/components/EditablePurchases.tsx` — drop the inline `open && (…form…)` branch; render `<PurchaseEditModal>` via portal when a row is open; row trigger uses `aria-haspopup="dialog"`.
- **No other files.** Do NOT touch `app/actions/purchases.ts`, Prisma, or `app/(app)/month/page.tsx`.

---

## Task 1: `isPurchaseDirty` pure helper (TDD)

**Files:**
- Create: `lib/purchase-edit.ts`
- Test: `tests/purchase-edit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/purchase-edit.test.ts
import { describe, it, expect } from "vitest";
import { isPurchaseDirty, type EditableFields } from "@/lib/purchase-edit";

const base: EditableFields = {
  price: "4.99",
  qty: "1",
  store: "Carrefour",
  date: "2026-07-09",
  onOffer: false,
};

describe("isPurchaseDirty", () => {
  it("is false when nothing changed", () => {
    expect(isPurchaseDirty(base, { ...base })).toBe(false);
  });
  it("detects a price change", () => {
    expect(isPurchaseDirty(base, { ...base, price: "5.00" })).toBe(true);
  });
  it("detects a qty change", () => {
    expect(isPurchaseDirty(base, { ...base, qty: "2" })).toBe(true);
  });
  it("detects a store change", () => {
    expect(isPurchaseDirty(base, { ...base, store: "Lulu" })).toBe(true);
  });
  it("detects a date change", () => {
    expect(isPurchaseDirty(base, { ...base, date: "2026-07-10" })).toBe(true);
  });
  it("detects an offer toggle", () => {
    expect(isPurchaseDirty(base, { ...base, onOffer: true })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c "npx vitest run tests/purchase-edit.test.ts"`
Expected: FAIL — cannot resolve `@/lib/purchase-edit`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/purchase-edit.ts

/** The set of purchase fields the modal lets the user edit (all as the modal
 *  holds them: strings for inputs, boolean for the offer toggle). */
export type EditableFields = {
  price: string;
  qty: string;
  store: string;
  date: string;
  onOffer: boolean;
};

/** True if any editable field differs from the values the modal opened with.
 *  Drives the "close on backdrop tap only when pristine" guard so an accidental
 *  outside tap (e.g. dismissing the iOS keyboard) can't discard real edits. */
export function isPurchaseDirty(
  initial: EditableFields,
  current: EditableFields,
): boolean {
  return (
    initial.price !== current.price ||
    initial.qty !== current.qty ||
    initial.store !== current.store ||
    initial.date !== current.date ||
    initial.onOffer !== current.onOffer
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c "npx vitest run tests/purchase-edit.test.ts"`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/purchase-edit.ts tests/purchase-edit.test.ts
git commit -F <msgfile>   # msg: "feat(edit-popup): isPurchaseDirty helper for the pristine close-guard"
```

---

## Task 2: `PurchaseEditModal` component

**Files:**
- Create: `app/components/PurchaseEditModal.tsx`

This moves the form + save/delete logic out of `EditablePurchases`'s old open-branch **verbatim**, and wraps it in the hardened modal chrome. `EditablePurchaseRow` is imported as a type from `EditablePurchases` (type-only import — safe despite the mutual reference).

- [ ] **Step 1: Write the full component**

```tsx
// app/components/PurchaseEditModal.tsx
"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { updatePurchase, deletePurchase } from "@/app/actions/purchases";
import { filsFromAed, parsePriceFils, formatAed } from "@/lib/money";
import { isPurchaseDirty, type EditableFields } from "@/lib/purchase-edit";
import type { EditablePurchaseRow } from "@/app/components/EditablePurchases";

const STORES = ["Carrefour", "Lulu", "Union Coop", "Other"];

const s = {
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", margin: "12px 2px 6px" },
  field: { width: "100%", padding: "13px 14px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 16, background: "var(--card)", color: "var(--ink)", fontFamily: "inherit" },
  row: { display: "flex", gap: 10 },
  rowChild: { flex: 1, minWidth: 0 },
} satisfies Record<string, CSSProperties>;

export default function PurchaseEditModal({
  row,
  onClose,
  onDone,
}: {
  row: EditablePurchaseRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [price, setPrice] = useState(row.priceAed);
  const [qty, setQty] = useState(String(row.quantity));
  const [store, setStore] = useState(row.store); // NOTE: <select> coerces unknown->Other for DISPLAY ONLY; state keeps original until user changes it.
  const [date, setDate] = useState(row.purchasedAt);
  const [onOffer, setOnOffer] = useState(row.onOffer);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const downOnBackdrop = useRef(false);

  // Values the modal opened with — for the pristine close-guard.
  const initial = useRef<EditableFields>({
    price: row.priceAed,
    qty: String(row.quantity),
    store: row.store,
    date: row.purchasedAt,
    onOffer: row.onOffer,
  });
  const dirty = isPurchaseDirty(initial.current, { price, qty, store, date, onOffer });

  const previewFils = filsFromAed(price);

  // Keyboard-aware max height: track the visual viewport so the card stays
  // within the space *above* the iOS keyboard (top fields reachable, footer
  // visible). Falls back to 100dvh when visualViewport is unavailable.
  const [vh, setVh] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVh(vv.height);
    update();
    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, []);

  // Scroll-lock + focus + Escape + background inert. Restore everything in the
  // cleanup so it runs however the modal unmounts (X, backdrop, Escape, Save/
  // Delete success, or a router.refresh() re-render).
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const shell = document.querySelector(".app-shell");
    shell?.setAttribute("inert", ""); // traps focus + blocks taps on toggle/tab bar/list behind the backdrop
    closeBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose(false);
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      shell?.removeAttribute("inert");
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fromBackdrop=true is the pristine-guarded path; X/Escape pass false (always close).
  function requestClose(fromBackdrop: boolean) {
    if (pending) return; // close paths inert while a save/delete is in flight
    if (fromBackdrop && dirty) return; // protect unsaved edits from an accidental outside tap
    onClose();
  }

  function onBackdropPointerDown(e: React.PointerEvent) {
    downOnBackdrop.current = e.target === e.currentTarget;
  }
  function onBackdropClick(e: React.MouseEvent) {
    // Close only when the pointer BOTH went down and up on the backdrop itself.
    if (e.target !== e.currentTarget) return; // bubbled from card contents
    if (!downOnBackdrop.current) return; // drag started inside a field
    downOnBackdrop.current = false;
    requestClose(true);
  }

  function save() {
    setError(null);
    if (parsePriceFils(price) === null) {
      setError("Enter a valid price above 0.");
      return;
    }
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof updatePurchase>>;
      try {
        res = await updatePurchase(row.id, {
          priceAed: price,
          quantity: parseFloat(qty) || 1,
          store,
          onOffer,
          purchasedAt: date,
        });
      } catch {
        setError("Could not save — please try again.");
        return;
      }
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onDone();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      try {
        await deletePurchase(row.id);
      } catch {
        setError("Could not delete — please try again.");
        return;
      }
      onDone();
    });
  }

  if (typeof document === "undefined") return null;

  const cardMaxHeight = vh ? `${vh - 32}px` : "calc(100dvh - 32px)";

  return createPortal(
    <div
      style={backdrop}
      onPointerDown={onBackdropPointerDown}
      onClick={onBackdropClick}
    >
      <div
        style={{ ...card, maxHeight: cardMaxHeight }}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit purchase: ${row.itemName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (fixed) */}
        <div style={header}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.itemName}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>Edit purchase</div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={() => requestClose(false)}
            aria-label="Close"
            style={xBtn}
          >
            ✕
          </button>
        </div>

        {/* Body (scrolls) */}
        <div style={body}>
          <div style={s.row}>
            <div style={s.rowChild}>
              <label style={s.label}>Price (AED)</label>
              <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" style={s.field} />
            </div>
            <div style={s.rowChild}>
              <label style={s.label}>Qty</label>
              <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} style={s.field} />
            </div>
          </div>

          <div style={s.row}>
            <div style={s.rowChild}>
              <label style={s.label}>Store</label>
              <select value={STORES.includes(store) ? store : "Other"} onChange={(e) => setStore(e.target.value)} style={s.field}>
                {STORES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div style={s.rowChild}>
              <label style={s.label}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={s.field} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>This was on offer</span>
            <button
              type="button"
              role="switch"
              aria-checked={onOffer}
              aria-label="This was on offer"
              onClick={() => setOnOffer((v) => !v)}
              style={{ width: 46, height: 28, borderRadius: 999, border: 0, padding: 0, position: "relative", cursor: "pointer", transition: "background .15s", background: onOffer ? "var(--green)" : "var(--line)", flex: "none" }}
            >
              <span style={{ position: "absolute", top: 3, left: onOffer ? 21 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
            </button>
          </div>

          {error && (
            <p style={{ color: "var(--red)", fontSize: 13, fontWeight: 600, margin: "12px 2px 0" }}>{error}</p>
          )}
        </div>

        {/* Footer (fixed, always visible) */}
        <div style={footer}>
          {confirmDelete ? (
            <div style={{ width: "100%" }}>
              <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ink)" }}>Delete this purchase?</p>
              <div style={s.row}>
                <button type="button" disabled={pending} onClick={remove} style={{ flex: 1, border: 0, borderRadius: 14, padding: 13, fontSize: 15, fontWeight: 700, background: "var(--red)", color: "#fff", cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
                  {pending ? "Deleting…" : "Delete"}
                </button>
                <button type="button" disabled={pending} onClick={() => setConfirmDelete(false)} style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 14, padding: 13, fontSize: 15, fontWeight: 700, background: "var(--card)", color: "var(--ink)", cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ ...s.row, width: "100%" }}>
              <button type="button" disabled={pending} onClick={save} style={{ flex: 1, border: 0, borderRadius: 14, padding: 13, fontSize: 15, fontWeight: 700, background: "var(--green)", color: "#fff", cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
                {pending ? "Saving…" : `Save · ${formatAed(previewFils)}`}
              </button>
              <button type="button" disabled={pending} onClick={() => setConfirmDelete(true)} style={{ flex: "0 0 auto", border: "1px solid var(--line)", borderRadius: 14, padding: "13px 16px", fontSize: 15, fontWeight: 700, background: "var(--card)", color: "var(--red)", cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 200, // above tab bar (50) + theme toggle (100); must occlude both
  background: "rgba(6,10,7,0.55)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  padding: "max(env(safe-area-inset-top), 16px) 16px max(env(safe-area-inset-bottom), 16px)",
};
const card: CSSProperties = {
  width: "100%",
  maxWidth: "min(440px, 92vw)",
  margin: "auto",
  display: "flex",
  flexDirection: "column",
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow)",
  overflow: "hidden",
};
const header: CSSProperties = {
  flex: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "18px 18px 12px",
  borderBottom: "1px solid var(--line)",
};
const body: CSSProperties = {
  flex: "1 1 auto",
  overflowY: "auto",
  overscrollBehavior: "contain",
  padding: "4px 18px 16px",
};
const footer: CSSProperties = {
  flex: "none",
  display: "flex",
  padding: "14px 18px",
  borderTop: "1px solid var(--line)",
  background: "var(--card)",
};
const xBtn: CSSProperties = {
  flex: "none",
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--ink)",
  width: 38,
  height: 38,
  borderRadius: 10,
  fontSize: 16,
  cursor: "pointer",
};
```

- [ ] **Step 2: Typecheck + build**

Run: `cmd /c "npm run typecheck"` then `cmd /c "npm run build"`
Expected: both clean. (The component is imported in Task 3; a temporary "unused" state is fine — it must compile.)

- [ ] **Step 3: Commit**

```bash
git add app/components/PurchaseEditModal.tsx
git commit -F <msgfile>   # msg: "feat(edit-popup): PurchaseEditModal (hardened modal chrome + moved edit form)"
```

---

## Task 3: Rewire `EditablePurchases` to open the modal

**Files:**
- Modify: `app/components/EditablePurchases.tsx`

Replace the whole file. The scroll box + row visuals are unchanged; the inline open-branch is removed; the row button opens the modal.

- [ ] **Step 1: Rewrite the file**

```tsx
// app/components/EditablePurchases.tsx
"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { filsFromAed, formatAed } from "@/lib/money";
import PurchaseEditModal from "@/app/components/PurchaseEditModal";

export type EditablePurchaseRow = {
  id: string;
  itemName: string;
  priceAed: string;
  quantity: number;
  unit: string;
  store: string;
  onOffer: boolean;
  /** yyyy-mm-dd (Dubai date) for the <input type="date">. */
  purchasedAt: string;
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export default function EditablePurchases({
  rows,
  monthLabel,
}: {
  rows: EditablePurchaseRow[];
  monthLabel: string;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 2px" }}>
        No purchases logged for {monthLabel}.
      </p>
    );
  }

  // Guard: a Save that moves a purchase to another month can drop it from `rows`
  // before openId clears — treat a missing row as closed (never render row=undefined).
  const openRow = rows.find((r) => r.id === openId);

  return (
    <>
      <div
        style={{
          maxHeight: 268,
          overflowY: "auto",
          paddingRight: 4,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {rows.map((row) => (
          <PurchaseRow key={row.id} row={row} onOpen={() => setOpenId(row.id)} />
        ))}
      </div>

      {openRow && (
        <PurchaseEditModal
          key={openId!}
          row={openRow}
          onClose={() => setOpenId(null)}
          onDone={() => {
            setOpenId(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function PurchaseRow({
  row,
  onOpen,
}: {
  row: EditablePurchaseRow;
  onOpen: () => void;
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--line)" }}>
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          padding: "11px 2px",
          background: "none",
          border: 0,
          textAlign: "left",
          cursor: "pointer",
          color: "var(--ink)",
          font: "inherit",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "var(--green-soft)",
            display: "grid",
            placeItems: "center",
            fontSize: 18,
            flex: "none",
          }}
          aria-hidden
        >
          🧾
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{row.itemName}</div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            {row.store} · {fmtDate(row.purchasedAt)}
            {row.onOffer ? " · offer" : ""}
          </div>
        </div>
        <span className="mono" style={{ marginLeft: "auto", fontWeight: 700 }}>
          {formatAed(filsFromAed(row.priceAed))}
        </span>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `cmd /c "npm run typecheck"` then `cmd /c "npm run build"`
Expected: both clean. `unit` stays on the type (still passed by the page) even though the row visual doesn't render it — that's fine.

- [ ] **Step 3: Full suite**

Run: `cmd /c "npm test"`
Expected: **129 passed** (123 prior + 6 new from Task 1).

- [ ] **Step 4: Commit**

```bash
git add app/components/EditablePurchases.tsx
git commit -F <msgfile>   # msg: "feat(edit-popup): open the modal from Month; rows no longer expand inline"
```

---

## Task 4: Deploy + verify Ready

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Confirm the deploy fires + reaches Ready**

Run: `cmd /c "vercel ls shelfie"` — expect a fresh Building/Ready row for the new commit. If none within ~2 min: `cmd /c "vercel deploy --prod --force --yes"`. Then confirm `status ● Ready` and that production serves the new build.

- [ ] **Step 3: Hand off for the owner's live verify** (see the verification checklist below).

---

## Verification checklist (owner, on his iPhone — Safari AND installed PWA)

1. Month → tap a purchase → a **popup** opens (list rows do NOT expand). Fields pre-filled.
2. Change the price → **Save · AED x.xx** → popup closes, Month total updates.
3. Tap a purchase → **Delete** → "Delete this purchase?" → Delete → it's gone; deleting an item's only purchase removes the item too.
4. **Close:** with NO edits, tapping the dark area closes it; with edits made, tapping the dark area does nothing → tap **✕** to discard (or Save to keep).
5. Open a purchase, tap the **price field** so the keyboard appears → you can still reach **all fields** and the **Save** button (scroll if needed).
6. The dark overlay covers the whole screen — the **theme toggle and bottom tabs are NOT tappable** behind it.
7. **Installed PWA:** the popup sits clear of the status bar / home indicator; looks right in light AND dark.
8. No console errors; the page never gets stuck un-scrollable after closing.

---

## Self-review (author)

- **Spec coverage:** §3.1 list (Task 3) · §3.2 portal + key (Task 3) · §3.3 close paths/pending-inert/backdrop hit-test/scroll-lock (Task 2) · §3.4 z-200/dvh+visualViewport/max-width/overscroll/safe-area (Task 2) · §3.5 focus (closeBtn focus + `inert` trap) / aria-haspopup (Tasks 2–3) · §4 openRow guard + store-coercion note (Tasks 2–3) · §5 no new pure logic except `isPurchaseDirty` (Task 1). ✅ all covered.
- **Placeholder scan:** none — every step has full code.
- **Type consistency:** `EditableFields` (lib) matches the object passed to `isPurchaseDirty`; `EditablePurchaseRow` shape identical in both files; `updatePurchase`/`deletePurchase` signatures unchanged from the current file.
- **Note for the builder:** the `inert` attribute (focus trap) is supported on the owner's iOS 18; do not add a JS focus-trap library. Keep `updatePurchase`/`deletePurchase` calls identical — this task must not change server behavior.
