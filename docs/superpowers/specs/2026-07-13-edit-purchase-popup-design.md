# Edit-a-purchase popup — design spec

**Date:** 2026-07-13
**Status:** Design approved (owner, in chat) → break-spec next
**Scope:** Month tab only. Change how an existing purchase is edited/deleted: from an **inline-expanding row** to a **centered modal popup**. No server, action, schema, or data-model changes.

---

## 1. Motivation

On the Month tab, the "purchases" list (`EditablePurchases.tsx`) currently lets you tap a purchase row to **expand the edit form inline**. This shoves the other rows around inside a fixed-height scroll box, the Delete action is buried at the bottom of the form, and on a small phone the inline form competes for space with the list.

The owner wants: **tap a purchase → a popup opens with the edit fields and Delete**, floating over the page. Calmer list, clearer actions.

Owner decisions (locked in chat 2026-07-13):
- **Popup style = "Edit form popup"** — the popup shows all the edit fields directly (not a two-step Edit/Delete chooser).
- **Close = option A** — tap the dark backdrop **or** an ✕ closes it; unsaved edits are discarded (nothing persists until Save).

## 2. Current behavior (baseline, do not regress)

`EditablePurchases` renders a `maxHeight: 268` scroll box of `PurchaseRow` buttons. Tapping a row toggles `openId`; the open row renders, inline beneath the button, an edit form with:
- **Price (AED)** — `inputMode="decimal"`, validated by `parsePriceFils` (blank/≤0 rejected).
- **Qty** — `inputMode="decimal"`, `parseFloat(qty) || 1`.
- **Store** — `<select>` over `["Carrefour","Lulu","Union Coop","Other"]` (unknown store coerced to "Other").
- **Date** — `<input type="date">`, `yyyy-mm-dd` Dubai date.
- **"This was on offer"** — a toggle switch.
- **Save** — button labelled `Save · AED x.xx` (live preview via `filsFromAed(price)`); calls `updatePurchase(id, {...})`; on success `onDone()` (→ close + `router.refresh()`).
- **Delete** — reveals an inline confirm block ("Delete this purchase?" → Delete / Cancel); Delete calls `deletePurchase(id)` → `onDone()`.
- Errors from validation / thrown actions / `{error}` results render in red; the form stays open.

All of this logic is **correct and stays exactly as-is**. This change only moves *where* it renders (inline → modal).

## 3. New behavior

### 3.1 The list
- Rows render as before (icon · item name · store · date · offer · price), but tapping a row **no longer expands it inline**. Rows never change height. The `maxHeight: 268` scroll box and row markup are unchanged.
- Tapping a row sets `openId = row.id` and opens the modal for that row.

### 3.2 The modal
- A single `PurchaseEditModal` renders when `openId` is set, **portaled to `document.body`** (not nested in the list). Rationale: the Month page uses a `.rise` transform on load; a `position: fixed` element inside a transformed ancestor is boxed by that ancestor (the exact trap hit by the scanner overlay in Phase C/D). Portaling to `body` avoids it, and also escapes the list's `overflow: auto` clip.
- Structure: a full-screen **backdrop** (dimmed, covers safe areas) + a **centered card** containing the header, the edit fields (§2), and the Save/Delete actions.
- The card is keyed by `openId` (fresh mount per open) so editing purchase A then B never carries A's field state into B.

### 3.3 Interactions
- **Open:** tap row → modal appears, fields pre-filled from that row.
- **Save:** edit fields → tap `Save · AED x.xx` → `updatePurchase` → on success the modal closes and Month refreshes. On validation/thrown/`{error}` failure, an inline error shows and the modal **stays open**.
- **Delete:** tap Delete → inline **"Delete this purchase?"** confirm (Delete / Cancel) inside the modal → Delete → `deletePurchase` → modal closes + refresh. (Destructive stays confirm-gated.)
- **Close without saving (option A):** tap the backdrop, tap the **✕** in the header, or press **Escape** / iOS back gesture → modal closes, edits discarded (none were saved). Closing also resets any half-open delete-confirm.
- **Background scroll lock:** while the modal is open, `document.body.style.overflow = "hidden"` (restored on close), mirroring `BarcodeScanner`.

### 3.4 Mobile / device requirements (hard)
- **Safe areas:** the backdrop covers the whole screen including notch/home-indicator; the card sits clear of them (`env(safe-area-inset-*)` in the card's max-height/margins). This is the Phase C/D lesson — bake it in from the start.
- **Tall content + on-screen keyboard:** the card has `max-height` bounded to the visible viewport and **scrolls internally** (`overflow-y: auto`) so that, when the iOS keyboard opens over a centered modal, every field (esp. Price/Qty at the top) remains reachable by scrolling. The card is vertically centered but must degrade to scrollable when space is tight (e.g. `align-items` that doesn't clip the top; test with keyboard open).
- **Long item names** wrap or truncate in the header without breaking layout.
- Uses existing design tokens (`--card`, `--line`, `--ink`, `--green`, `--red`, `--radius`, `--shadow`) — light + dark.

### 3.5 Accessibility
- `role="dialog"`, `aria-modal="true"`, `aria-label` = e.g. `Edit purchase: <item name>`.
- On open, focus moves into the modal (the ✕/close control or the first field); Escape closes; focus ideally returns to the originating row on close.
- The ✕ has `aria-label="Close"`. The offer toggle keeps its existing `role="switch"` semantics.

## 4. Architecture

- **`app/components/EditablePurchases.tsx`** — refactor:
  - Keep the scroll box + row buttons; drop the inline `open && (…form…)` block.
  - Extract the form + actions currently inside `PurchaseRow`'s open branch into a new `PurchaseEditModal` component (same file or a sibling file — implementer's call; prefer a sibling `PurchaseEditModal.tsx` if the file grows too large).
  - Render `<PurchaseEditModal row={openRow} onClose={…} onDone={…} />` (portaled) only when a row is open.
- **`PurchaseEditModal`** — owns the local edit state (price/qty/store/date/onOffer/confirmDelete/error/pending), the save/remove handlers (verbatim from today), and the modal chrome (backdrop, card, ✕, scroll lock, Escape, focus, safe-area). Depends on: `updatePurchase`, `deletePurchase` (existing actions), money helpers, `createPortal`.
- **No changes** to `app/actions/purchases.ts`, Prisma, or any server code.

## 5. Testing & verification

- This is a **presentation-only refactor**: it introduces **no new pure logic**, so there is no new unit test to write test-first (the save/delete/validation logic is unchanged and already covered indirectly by `parsePriceFils`/money tests). Do **not** invent hollow tests to satisfy a TDD ritual.
- Regression bar: the full existing suite (**123 tests**) stays green; `typecheck` clean; `build` clean; `/month` First-Load JS does not balloon.
- If any small pure helper is extracted during build (e.g. a focus-trap or "coerce store" helper), it gets a unit test.
- **Correctness is proven by the two adversarial build reviews + the owner's live verify** on his iPhone (Safari **and** the installed PWA — the safe-area/keyboard behaviour only shows on a real device).

## 6. Edge cases (break-it targets)

1. Open A, close, open B → B shows B's data, not A's (fresh mount by key).
2. Invalid price on Save → error in modal, modal stays open, nothing saved.
3. Action throws / returns `{error}` → error shown, modal open, no refresh.
4. Delete confirm open, then tap backdrop → modal fully closes (no orphaned confirm state next open).
5. Small screen + keyboard open → Price/Qty still reachable (internal scroll).
6. Very long item name → header wraps/truncates, ✕ stays tappable.
7. Rapid open/close/open → no stuck scroll-lock (`body.overflow` always restored, even if unmounted mid-transition).
8. Installed PWA safe areas → card never under the status bar / home indicator; backdrop covers full screen.
9. Deleting a purchase that is an item's **last** purchase still removes the now-orphan item (existing `deletePurchase` behaviour — unchanged, must not regress).
10. Dark mode → tokens render correctly; backdrop dim reads well on both themes.

## 7. Non-goals / out of scope

- No changes to the Log tab, Prices tab, receipt review, or any other editor.
- No server, action, schema, migration, or data change.
- No bulk edit/select, no swipe-to-delete, no drag. Single-purchase edit only.
- Not changing the fields, validation rules, store list, or the delete-orphan-item behaviour.

## 8. Success criteria

- Tapping a purchase opens a floating popup with the same fields + Save + Delete; the list rows never expand.
- Save and Delete behave exactly as today (same results, same confirm gate), then close + refresh.
- Backdrop/✕/Escape close and discard.
- Works and looks correct on the owner's iPhone in **both** Safari and the installed PWA, including with the keyboard open.
- 123 tests still green; typecheck + build clean.
