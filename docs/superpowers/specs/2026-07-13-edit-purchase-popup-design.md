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
- **Open:** tap row → modal appears, fields pre-filled from that row. Save and Delete controls are in a **footer that stays visible** (sticky within the card), so the user never has to reach past the fields (or tap outside) to find Save.
- **Save:** edit fields → tap `Save · AED x.xx` → `updatePurchase` → on success the modal closes and Month refreshes. On validation/thrown/`{error}` failure, an inline error shows and the modal **stays open**.
- **Delete:** tap Delete → inline **"Delete this purchase?"** confirm (Delete / Cancel) inside the modal → Delete → `deletePurchase` → modal closes + refresh. (Destructive stays confirm-gated.)
- **Close paths (option A, hardened):**
  - **✕** in the header — always closes and discards.
  - **Backdrop tap** — closes and discards **only when the form is pristine** (no field changed since open). If there are unsaved edits, a backdrop tap is **ignored** (the ✕ is the deliberate discard). *Rationale (break-spec finding 4):* on iOS the natural "tap outside a field to dismiss the keyboard" gesture lands on the backdrop; closing-on-any-backdrop-tap would silently wipe edits. The pristine guard keeps the quick tap-to-close for the common "just looking" case while protecting real edits. **← owner-facing refinement, see note in §9.**
  - **Escape** (desktop/hardware keyboard) — same as ✕. *There is intentionally no "iOS back-gesture closes" behavior* (break-spec finding 2): the iPhone has no Escape key and the edge-swipe navigates PWA history, not the modal — promising it would fail live-verify. ✕ and backdrop are the real affordances on the phone.
  - **While a Save/Delete is in flight (`pending`), ALL close paths are inert** (break-spec finding 3) — mirrors the existing `disabled={pending}` buttons — so a stray tap can't unmount mid-request (dropped error / phantom write / setState-after-unmount).
  - Closing always resets any half-open delete-confirm (guaranteed by fresh-mount, §3.2).
- **Backdrop hit-test (break-spec finding 6):** a backdrop close fires only when the pointer **both went down and up on the backdrop element itself** (track the `pointerdown` target; require `up.target === down.target === backdrop`). Never close on a click that bubbled from card contents, nor on a drag that started inside a field and released on the backdrop (text-selection footgun).
- **Background scroll lock (break-spec finding 8):** in a `useEffect`, capture `prevOverflow = document.body.style.overflow`, set it to `"hidden"`, and **restore `prevOverflow` in the effect cleanup** (runs on unmount no matter how the modal dies — ✕, backdrop, Escape, Save/Delete success, or a `router.refresh()` re-render). Never restore only inside a click handler. Verbatim `BarcodeScanner` pattern.

### 3.4 Mobile / device requirements (hard)
- **Safe areas:** the backdrop covers the whole screen including notch/home-indicator; the card sits clear of them (`env(safe-area-inset-*)` in the card's max-height/margins). This is the Phase C/D lesson — bake it in from the start.
- **Z-index (break-spec finding 1):** the backdrop is `z-index: 200` — **above** the fixed tab bar (`z-index: 50`) and the theme toggle (`z-index: 100`) — and must fully occlude both. Otherwise the round theme toggle floats over the dim and stays tappable (theme flips mid-edit) and the tab bar bleeds through.
- **Viewport unit + centering (break-spec finding 5):** size the card off the **dynamic** viewport (`100dvh`, or `window.visualViewport` height), **never `100vh`** (iOS `100vh` is the *large* viewport and pushes a centered card's top above the visible area when the keyboard opens). The backdrop is a **scrollable container** (`overflow-y: auto`) and the card is centered with `margin: auto` / `align-items: flex-start` + padding — **not** `align-items: center` on a clipping flex (which makes a too-tall card's top unreachable). Net effect: when the keyboard is open on a small iPhone, the top fields (Price/Qty) are always reachable by scrolling.
- **Card:** `max-width: min(440px, 92vw)` (break-spec finding 13 — it escapes the app-shell's 480px cap), with `overscroll-behavior: contain` on its scroll region (break-spec finding 12 — reduces scroll-chaining to the background; note the body-`overflow:hidden` lock is not airtight on iOS, accepted).
- **Long item names** wrap or truncate in the header without breaking layout.
- Uses existing design tokens (`--card`, `--line`, `--ink`, `--green`, `--red`, `--radius`, `--shadow`) — light + dark; the backdrop dim reads well on both themes.

### 3.5 Accessibility
- `role="dialog"`, `aria-modal="true"`, `aria-label` = e.g. `Edit purchase: <item name>`.
- The **row trigger** uses `aria-haspopup="dialog"` and **no longer sets `aria-expanded`** (break-spec finding 10 — it opens a dialog, not an inline disclosure).
- **Focus trap is a hard requirement** (break-spec finding 7), not "ideally": on open, focus moves into the card (✕ or first field); Tab is trapped within the card; background content (list rows, tab bar, theme toggle) is `inert`/`aria-hidden` while open so focus can't land behind the backdrop.
- **Focus restore on close** follows a fallback chain: the originating row **if it still exists** → else the list container/heading → else the empty-state message (after deleting the last purchase, the row is gone, so "return to the row" is impossible).
- The ✕ has `aria-label="Close"`. The offer toggle keeps its existing `role="switch"` semantics.

## 4. Architecture

- **`app/components/EditablePurchases.tsx`** — refactor:
  - Keep the scroll box + row buttons; drop the inline `open && (…form…)` block.
  - Extract the form + actions currently inside `PurchaseRow`'s open branch into a new `PurchaseEditModal` component (same file or a sibling file — implementer's call; prefer a sibling `PurchaseEditModal.tsx` if the file grows too large).
  - Derive `openRow = rows.find(r => r.id === openId)`. Render `<PurchaseEditModal key={openId} row={openRow} … />` (portaled) **only when `openRow` is truthy** (break-spec finding 9 — a Save that moves a purchase to another month can drop it from *this* month's `rows` before `openId` clears; guard against `openRow` being `undefined` and treat that as closed). The `key={openId}` guarantees a fresh mount per open (resets all field + delete-confirm state).
- **`PurchaseEditModal`** — owns the local edit state (price/qty/store/date/onOffer/confirmDelete/error/pending), the save/remove handlers (verbatim from today), and the modal chrome (backdrop, card, ✕, scroll lock, Escape, focus trap, safe-area). Depends on: `updatePurchase`, `deletePurchase` (existing actions), money helpers, `createPortal`.
- **Preserve the store-coercion quirk verbatim** (break-spec finding 11): the `<select>` coerces an unknown/legacy `store` to "Other" **for display only**; the underlying `store` state keeps the original value until the user actively changes it, so Save never silently rewrites an untouched unknown store. Do not "clean this up."
- **No changes** to `app/actions/purchases.ts`, Prisma, or any server code. The `updatePurchase`/`deletePurchase` calls (incl. the orphan-item pruning when deleting an item's last purchase) are byte-for-byte the same — only their container moves.

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

---

## 9. Break-spec pass — findings folded in (2026-07-13)

A fresh skeptical Opus review attacked this design before planning. All 14 findings were verified as legitimate (the reviewer even checked the real code — `.rise` at `month/page.tsx:177`, orphan-delete at `purchases.ts:187-197`) and folded in above:

| # | Sev | Finding | Where folded |
|---|-----|---------|--------------|
| 1 | Blocker | Backdrop z-index unspecified → theme toggle (z100) + tab bar (z50) bleed through & stay tappable | §3.4 z-index: 200 |
| 2 | Blocker | Escape/iOS back-gesture don't work on the actual iPhone (no Esc key; edge-swipe = history nav) | §3.3 dropped back-gesture; Escape=desktop only |
| 3 | Major | Close during a pending Save/Delete → dropped error / phantom write / setState-after-unmount | §3.3 close paths inert while `pending` |
| 4 | Major | Backdrop-close + iOS keyboard-dismiss tap = silent total edit loss | §3.3 backdrop closes only when pristine; Save always visible **(owner-facing, below)** |
| 5 | Major | `100vh` + `align-items:center` → top fields unreachable with keyboard open | §3.4 `100dvh` + scrollable backdrop + flex-start |
| 6 | Major | Backdrop close on bubbled clicks / drag-release footgun | §3.3 pointerdown+up both on backdrop |
| 7 | Major | Focus trap not mandated; focus-return impossible after delete | §3.5 hard focus trap + restore fallback chain |
| 8 | Major | Scroll-lock must restore prior value in effect cleanup, not a click handler | §3.3 verbatim BarcodeScanner pattern |
| 9 | Minor | `openRow` undefined while `openId` set → crash | §4 mount only when `openRow` truthy |
| 10 | Minor | Row's `aria-expanded` semantically wrong for a dialog | §3.5 `aria-haspopup="dialog"` |
| 11 | Minor | Store coercion could silently rewrite unknown stores | §4 preserve display-only coercion |
| 12 | Minor | iOS scroll-lock leaks / scroll-chaining | §3.4 `overscroll-behavior: contain`, limitation noted |
| 13 | Nit | Card has no max-width → stretches on wide viewports | §3.4 `max-width: min(440px, 92vw)` |
| 14 | Nit | Scroll jump / empty-state focus after delete | §3.5 restore chain covers empty state |

**Owner-facing refinement (finding 4):** you chose "tap outside closes." The break pass showed that on iPhone, tapping outside a field to dismiss the keyboard often lands on the backdrop — so a naive "any outside tap closes" would silently wipe your edits. The folded-in rule: **backdrop tap closes only when you haven't changed anything; if you've edited, tap the always-visible ✕ to discard or Save to keep.** This keeps the quick tap-to-close for the "just looking" case and protects real edits. If you'd rather have pure "any outside tap always closes (and discards)", say so and I'll switch it.

**Verdict after fold-in:** the reviewer's blockers/majors are resolved as explicit, testable requirements; the design is sound to proceed to planning.
