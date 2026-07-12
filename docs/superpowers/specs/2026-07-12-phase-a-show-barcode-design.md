# Phase A — Show the Barcode (design spec)

**Date:** 2026-07-12
**Status:** approved by owner (design); pending break-spec pass
**Phase:** A of the A→B→C+D polish roadmap (`polish-phases-decisions.txt`)

## 1. Purpose

When the owner looks at an item, show the barcode(s) the app has stored for it, so he can confirm at a glance that the app is tracking the right physical product. This makes the existing barcode-based identity (receipt capture + manual "same as" linking) **verifiable** instead of invisible.

One-line: *"Which barcode does the app think this item is? Show me, so I can check it against the pack/receipt."*

## 2. Scope

**In scope**
- Show an item's stored barcode number(s) on the **Prices tab** (the item price-story view).
- Show each row's captured barcode on the **receipt-review screen** during import.
- A `displayBarcode()` helper that converts the stored canonical (14-digit, zero-padded) form back to the human-facing printed form.

**Explicitly out of scope (per decisions A5, B10)**
- No bars/graphic rendering — **numbers only** (decision A1).
- No editing/detaching a barcode from an item here — that belongs to Phase B (decision A5). (The import review screen already has its own in-progress "not this item" detach; that is unchanged.)
- No barcode display on the manual Log form or the Month edit list (decision A2 — avoid clutter).
- No schema change, no new dependency, no data migration.

## 3. The one piece of real logic: `displayBarcode(canonical)`

**Problem.** `lib/barcode.ts` stores every code as a canonical 14-digit string, left-padded with zeros (`canonicalizeBarcode` → `digits.padStart(14, "0")`). A real Carrefour receipt prints `071727355039` but we store `00071727355039`. We must show what's printed, not the padded form. A naïve "strip all leading zeros" is **wrong**: it would yield `71727355039` and drop the leading `0` that is actually printed on that 12-digit UPC.

**Correct rule.**
1. Strip **all** leading zeros to get the significant digits (`significant`).
2. Let `n = significant.length`.
3. Restore to the **smallest standard GTIN length ≥ n** from the set `{8, 12, 13, 14}` by left-padding `significant` back to that length with zeros.
4. Return the result.

**Worked examples**
| Stored canonical | significant (stripped) | n | target len | displayed | matches printed? |
|---|---|---|---|---|---|
| `00071727355039` | `71727355039` | 11 | 12 | `071727355039` | ✓ (12-digit UPC-A) |
| `00012345678905` | `12345678905` | 11 | 12 | `012345678905` | ✓ |
| `04006381333931` | `4006381333931` | 13 | 13 | `4006381333931` | ✓ (EAN-13) |
| `00000096385074` | `96385074` | 8 | 8 | `96385074` | ✓ (EAN-8) |
| `12345678901234` | `12345678901234` | 14 | 14 | `12345678901234` | ✓ (GTIN-14) |

**Edge cases**
- `n` between 9–11 → rounds up to 12 (nearest standard). Between 1–7 → rounds up to 8. This is the intended "nearest standard length" behaviour; no in-between length is ever printed.
- All-zero / empty-significant degenerate input (`n = 0`) → target length 8 → `"00000000"`. Cannot occur from `canonicalizeBarcode` (requires ≥8 input digits) but the helper stays total.
- Input longer than 14 or non-string: the helper only ever receives a stored canonical (already validated 14 digits). It should still be defensive — if given a non-14/garbage string, strip non-digits first and apply the same rule; never throw.

**Location.** Add to `lib/barcode.ts` (co-located with `canonicalizeBarcode`, the inverse). Pure, string-in/string-out, fully unit-tested. This keeps the `"use server"` rule intact (it's a pure lib, not a server action).

## 4. UI changes

### 4.1 Prices tab (`app/(app)/prices/page.tsx`)
- The page already loads `selected` via `db.item.findUnique`. Extend its `include`/`select` to also fetch `barcodes: { select: { code: true }, orderBy: { createdAt: "asc" } }`.
- Render the barcode(s) as a small, muted, monospace line in the price-story header area (near the item name — either inside `PriceCard` via a new prop, or directly on the page just under the picker). Preferred: pass `barcodes: string[]` (already display-formatted) into `PriceCard` so the item name + its identity live together.
- Map each stored `code` through `displayBarcode()` before rendering.
- If `barcodes` is empty → render nothing (no "no barcode" text on Prices).
- Multiple barcodes → stack them (small), each on its own line, prefixed with a subtle barcode glyph or the label "barcode".

### 4.2 Receipt-review screen (`app/components/ReceiptImport.tsx`)
- Each `Row` already carries `barcode: string | null` (canonical). In the per-row control area, when `row.barcode` is present, render a small muted `displayBarcode(row.barcode)` near the item name (a "🏷 071727355039"-style tag).
- This is display-only; it does not change the existing on-offer / "files as" / "same as" / detach controls.
- When `row.barcode` is null, show nothing extra (the existing "⚠ check this" no-barcode flag already covers that case).

## 5. Data flow

```
Stored: Barcode.code (canonical 14-digit)  ──displayBarcode()──▶  printed form (string)  ──▶  rendered muted text
```

- Prices: server component reads `item.barcodes[].code` → maps through `displayBarcode` → passes strings to `PriceCard`.
- Review: client already holds `row.barcode` canonical → renders `displayBarcode(row.barcode)` inline.

No writes. No new state. No action changes.

## 6. Error handling

- `displayBarcode` never throws; on unexpected input it strips non-digits and applies the same nearest-length rule, returning a best-effort string (or the raw digits if length > 14).
- Empty barcode list → nothing renders (not an error).
- No network/DB error paths introduced beyond the existing Prices query (one extra relation select on an already-fetched row).

## 7. Testing

**Unit (`tests/barcode.test.ts`, new or extended):**
- `displayBarcode("00071727355039")` → `"071727355039"` (the real Carrefour case).
- 12-digit UPC-A, 13-digit EAN-13, 8-digit EAN-8, 14-digit GTIN-14 each round-trip to printed form.
- 9/10/11-digit significant → padded up to 12.
- 1–7-digit significant → padded up to 8.
- Round-trip property: for a sample of real-length inputs, `displayBarcode(canonicalizeBarcode(printed)) === printed` when `printed` is a standard length with its natural leading zeros.
- Defensive: non-digit garbage in → no throw.

**Live verification (mandatory, on Vercel + owner's iPhone):**
1. Open Prices for an item imported from the real receipt → its barcode line shows and **reads identical to the printed receipt barcode**.
2. Import a receipt → review screen shows each recognised row's barcode.
3. An item with no barcode → Prices shows no barcode line (no clutter, no error).
4. An item with two barcodes (e.g. one from receipt + one typed manually) → both stack.

## 8. Why this is safe

- Pure additive display. No schema, no migration, no dependency, no action/write path touched.
- The only logic (`displayBarcode`) is isolated, total, and unit-tested against the exact real-world case that previously bit us (the padded Carrefour code).
- Fully reversible: removing the display changes nothing about stored data.

## 9. Open questions for the break-spec pass to attack

- Is the "nearest standard GTIN length" rule ever wrong for a code the owner actually has? (e.g. a legitimately 11-digit or 10-digit code that should NOT be padded to 12.)
- Could an item legitimately have many barcodes such that stacking clutters the Prices header? (Cap/゛+N more"?)
- Does adding `barcodes` to the Prices `findUnique` risk any N+1 / perf issue? (No — single relation include.)
- Any privacy angle? Barcodes are product identity, explicitly **not** personal data (handover §1.3) — confirm nothing personal is surfaced.
