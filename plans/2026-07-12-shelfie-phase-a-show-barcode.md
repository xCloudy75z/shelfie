# Phase A — Show the Barcode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. ALL work runs on Opus (project rule).

**Goal:** Show each item's stored barcode number(s) on the Prices tab and the receipt-review screen, so the owner can verify the app is tracking the right physical product.

**Architecture:** One tested pure helper `displayBarcode()` in `lib/barcode.ts` reconstructs the printed form from the stored canonical (14-digit zero-padded) code. One tiny presentational component `BarcodeLine` renders formatted codes (with a11y) and is reused by the Prices page (server) and the receipt-review screen (client). No schema change, no new dependency, no write path touched.

**Tech Stack:** Next.js 15 (App Router, RSC + client components), TypeScript strict, Prisma 7, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-12-phase-a-show-barcode-design.md` (break-spec pass folded in).

---

## File Structure

- **Modify** `lib/barcode.ts` — add `displayBarcode(canonical)` next to `canonicalizeBarcode` (its lossy best-effort counterpart). All real logic lives here.
- **Modify** `tests/barcode.test.ts` — add a `describe("displayBarcode")` block, including the pinned lossy edge cases.
- **Create** `app/components/BarcodeLine.tsx` — presentational, logic-free (maps `displayBarcode` over codes, renders stacked with `aria-label`). Shared by server + client callers (no `"use client"`, no hooks).
- **Modify** `app/(app)/prices/page.tsx` — fetch `barcodes` on the selected item; render `<BarcodeLine>` at **page level** (shows in both the has-purchases and no-purchase branches — break-spec F2).
- **Modify** `app/components/ReceiptImport.tsx` — render `<BarcodeLine codes={[row.barcode]} />` under each review row's item name.

---

### Task 1: `displayBarcode` helper (the only real logic)

**Files:**
- Modify: `lib/barcode.ts`
- Test: `tests/barcode.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/barcode.test.ts` (keep the existing import line; add `displayBarcode` to it):

```ts
import { canonicalizeBarcode, displayBarcode } from "@/lib/barcode";

describe("displayBarcode", () => {
  it("shows the real Carrefour UPC as printed (11 significant → 12)", () => {
    expect(displayBarcode("00071727355039")).toBe("071727355039");
  });
  it("shows a 13-digit EAN-13 unchanged", () => {
    expect(displayBarcode("04006381333931")).toBe("4006381333931");
  });
  it("shows an 8-digit EAN-8 unchanged", () => {
    expect(displayBarcode("00000096385074")).toBe("96385074");
  });
  it("shows a full 14-digit GTIN-14 unchanged", () => {
    expect(displayBarcode("12345678901234")).toBe("12345678901234");
  });
  it("round-trips everyday standard-length codes (no excess leading zeros)", () => {
    expect(displayBarcode(canonicalizeBarcode("4006381333931")!)).toBe("4006381333931");
    expect(displayBarcode(canonicalizeBarcode("96385074")!)).toBe("96385074");
    expect(displayBarcode(canonicalizeBarcode("071727355039")!)).toBe("071727355039");
  });
  // PINNED lossy edge cases (break-spec F1). displayBarcode is best-effort, NOT a
  // true inverse — length isn't stored. These outputs are ACCEPTED, not bugs.
  it("over-collapses leading-zero-heavy codes (accepted limitation)", () => {
    expect(displayBarcode("00000000123456")).toBe("00123456"); // 6 significant → 8, not 12
  });
  it("over-pads a genuine 10-digit code to 12 (accepted limitation)", () => {
    expect(displayBarcode(canonicalizeBarcode("1234567890")!)).toBe("001234567890");
  });
  it("pads 9/10/11 significant up to 12", () => {
    expect(displayBarcode("00000123456789")).toBe("0123456789".padStart(12, "0"));
  });
  it("is defensive: empty / null / garbage never throw", () => {
    expect(displayBarcode(null)).toBe("");
    expect(displayBarcode(undefined)).toBe("");
    expect(displayBarcode("")).toBe("");
    expect(displayBarcode("abc")).toBe("");
  });
  it("returns >14 significant digits as-is (never seen from canonical)", () => {
    expect(displayBarcode("123456789012345")).toBe("123456789012345");
  });
});
```

Note on the 9/11-digit assertion: `"00000123456789"` has significant `123456789` (n=9) → target 12 → `"000123456789"`. `"0123456789".padStart(12,"0")` = `"000123456789"` (both are 12 chars) — matches.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cmd /c "npx vitest run tests/barcode.test.ts"`
Expected: FAIL — `displayBarcode is not a function` / not exported.

- [ ] **Step 3: Write the minimal implementation**

Append to `lib/barcode.ts`:

```ts
/**
 * Best-effort HUMAN-FACING form of a stored canonical barcode — the inverse of
 * canonicalizeBarcode's zero-padding, as far as it can be recovered.
 *
 * LOSSY BY CONSTRUCTION: canonical storage discards the original printed length,
 * so this reconstructs it by stripping the padding zeros, then restoring to the
 * nearest standard GTIN length (8/12/13/14). Correct for everyday codes (EAN-13,
 * the known 12-digit UPC), but it CANNOT recover codes with many genuine leading
 * zeros, or non-standard 9/10/11-digit codes — those over-collapse / over-pad.
 * That is an accepted limitation (see the spec + pinned tests); do not "fix" it
 * without storing the original length (a schema change, out of Phase A scope).
 * Never throws. Returns "" for empty/garbage input.
 */
export function displayBarcode(canonical: string | null | undefined): string {
  if (!canonical) return "";
  const digits = String(canonical).replace(/\D/g, "");
  if (digits.length === 0) return ""; // no digits at all → garbage in, show nothing
  const significant = digits.replace(/^0+/, "");
  const n = significant.length;
  if (n === 0) return "00000000"; // has digits but all zero (cannot occur from canonical)
  if (n > 14) return significant; // defensive: never produced by canonicalizeBarcode
  const target = [8, 12, 13, 14].find((len) => len >= n) ?? 14;
  return significant.padStart(target, "0");
}
```

> **break-plan C1 fix:** the no-digits guard (`digits.length === 0 → ""`) MUST come **before** stripping leading zeros. A single `n === 0` guard cannot distinguish `"abc"` (no digits → must be `""`) from `"00000000"` (all-zero → `"00000000"`), and would render a bogus `🏷 00000000` line for any non-digit input.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cmd /c "npx vitest run tests/barcode.test.ts"`
Expected: PASS — all `displayBarcode` cases green, existing `canonicalizeBarcode` cases still green.

- [ ] **Step 5: Run the full suite + typecheck**

Run: `cmd /c "npm test"` then `cmd /c "npm run typecheck"`
Expected: all tests pass (103 + the new ones); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add lib/barcode.ts tests/barcode.test.ts
git commit -F <msg-file>
# msg: "feat(phase-a): displayBarcode() — printed form from canonical (lossy, tested)"
```

---

### Task 2: `BarcodeLine` presentational component

**Files:**
- Create: `app/components/BarcodeLine.tsx`

No new logic (all logic is the tested `displayBarcode`), so no unit test — verified by typecheck/build and the live run. Keep it logic-free so that stays true.

- [ ] **Step 1: Create the component**

Create `app/components/BarcodeLine.tsx`:

```tsx
import { displayBarcode } from "@/lib/barcode";

/**
 * Show one or more product barcodes as small muted, monospace numbers.
 * Presentational only — no state, no hooks — so it renders in both the Prices
 * server component and the ReceiptImport client component. Renders nothing when
 * there are no usable codes. Each code is a11y-labelled as a barcode; the glyph
 * is decorative (aria-hidden).
 */
export default function BarcodeLine({
  codes,
}: {
  codes: (string | null | undefined)[];
}) {
  const shown = codes.map(displayBarcode).filter((c) => c.length > 0);
  if (shown.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        margin: "4px 0 0",
      }}
    >
      {shown.map((code, i) => (
        <span
          key={`${code}-${i}`}
          className="mono"
          aria-label={`Barcode ${code}`}
          style={{
            fontSize: 12,
            color: "var(--ink-faint)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span aria-hidden="true">🏷</span>
          {code}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cmd /c "npm run typecheck"`
Expected: clean (component is unused so far, but must compile).

- [ ] **Step 3: Commit**

```bash
git add app/components/BarcodeLine.tsx
git commit -F <msg-file>
# msg: "feat(phase-a): BarcodeLine presentational component"
```

---

### Task 3: Show the barcode on the Prices tab

**Files:**
- Modify: `app/(app)/prices/page.tsx`

- [ ] **Step 1: Fetch the item's barcodes**

In `app/(app)/prices/page.tsx`, extend the `selected` query's `include` (currently only `purchases`) to also load barcodes:

```ts
  const selected = await db.item.findUnique({
    where: { id: selectedId },
    include: {
      purchases: { orderBy: { purchasedAt: "desc" } },
      barcodes: { select: { code: true }, orderBy: { createdAt: "asc" } },
    },
  });
```

- [ ] **Step 2: Import BarcodeLine and derive the codes**

Add the import near the other component imports at the top:

```ts
import BarcodeLine from "@/app/components/BarcodeLine";
```

After `const purchases = selected?.purchases ?? [];` add:

```ts
  const barcodeCodes = (selected?.barcodes ?? []).map((b) => b.code);
```

- [ ] **Step 3: Render it at PAGE level (both branches)**

Immediately AFTER the `<PriceItemPicker items={items} selectedId={selectedId} />` line and BEFORE the `{stats ? (` block, insert:

```tsx
      {/* Item identity — shows regardless of whether the item has purchases yet
          (barcode-only items are deliberately kept — break-spec F2). */}
      <BarcodeLine codes={barcodeCodes} />
```

- [ ] **Step 4: Typecheck + build**

Run: `cmd /c "npm run typecheck"` then `cmd /c "npm run build"`
Expected: both clean; Prices route compiles.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/prices/page.tsx"
git commit -F <msg-file>
# msg: "feat(phase-a): show item barcode(s) on the Prices tab"
```

---

### Task 4: Show the barcode on the receipt-review screen

**Files:**
- Modify: `app/components/ReceiptImport.tsx`

- [ ] **Step 1: Import BarcodeLine**

Add to the imports at the top of `app/components/ReceiptImport.tsx`:

```ts
import BarcodeLine from "@/app/components/BarcodeLine";
```

- [ ] **Step 2: Render it under each row's item name**

In the row render, the item-name input sits in a flex `<div>` that closes just before the `Qty / Price / Category` row (`<div style={{ display: "flex", gap: 8, marginTop: 8 }}>`). Insert the barcode line between them — right after the closing `</div>` of the name+remove-button flex:

```tsx
            {/* captured barcode for this row (display-only; canonical → printed) */}
            <BarcodeLine codes={[row.barcode]} />
```

(When `row.barcode` is null, `BarcodeLine` renders nothing — the existing "⚠ check this" flag still covers no-barcode rows.)

- [ ] **Step 3: Typecheck + build**

Run: `cmd /c "npm run typecheck"` then `cmd /c "npm run build"`
Expected: both clean; the Log route (which renders ReceiptImport) compiles.

- [ ] **Step 4: Commit**

```bash
git add app/components/ReceiptImport.tsx
git commit -F <msg-file>
# msg: "feat(phase-a): show captured barcode on each receipt-review row"
```

---

### Task 5: Full verification gate (break-build + live)

- [ ] **Step 1: Full suite + typecheck + build**

Run: `cmd /c "npm test"` → all green (103 + new). `cmd /c "npm run typecheck"` → clean. `cmd /c "npm run build"` → clean.

- [ ] **Step 2: Break-build adversarial pass**

Dispatch a fresh skeptical Opus reviewer against the diff + the spec's adversarial cases (displayBarcode edge cases, the no-purchase Prices branch, the review-row render, a11y, privacy). Fix anything found (failing test → fix → commit).

- [ ] **Step 3: Push (auto-deploys) and verify Ready**

```bash
git push origin main
```
Then `cmd /c "vercel inspect <latest-url>"` → `status ● Ready`.

- [ ] **Step 4: Live verify (owner's iPhone + Vercel)** — per spec §7:
  1. Prices for a real-receipt item → barcode reads the same as the printed receipt.
  2. A barcode-only item (no purchases) → barcode still shows.
  3. Import a receipt → each recognised row shows its barcode.
  4. No-barcode item → no barcode line, no error.
  5. Two-barcode item → both stack.

- [ ] **Step 5: Update the hub board + docs**

Flip Phase A steps to done on `docs/progress.html`; update HANDOVER.md §5 / MASTER-DOCUMENTATION.md to record Phase A shipped. Commit + push.

---

## Notes for the implementer

- **Commit messages:** PowerShell mangles messages with backticks/parens/slashes — write the message to a temp file and use `git commit -F <file>` (project rule).
- **All commands via `cmd /c "..."`** from PowerShell; always `Set-Location -LiteralPath` to the repo first.
- **Do NOT** add a `"use client"` directive to `BarcodeLine` (it must stay shared) and **do NOT** add logic to it (all logic belongs in the tested `displayBarcode`).
- **Do NOT** change `canonicalizeBarcode`, the receipt parser, or any write/action path — Phase A is display-only.
