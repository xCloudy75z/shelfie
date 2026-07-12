# Phase A — Show the Barcode (design spec)

**Date:** 2026-07-12
**Status:** approved by owner (design); break-spec pass done & folded in — ready to plan
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

**This helper is a best-effort reconstruction, NOT a guaranteed inverse (lossy by construction).** Because canonical storage discards the original printed length, `displayBarcode` can only *guess* the intended length from the significant digits. It is correct for the codes the owner actually has (13-digit EAN-13 — the overwhelming majority of UAE Carrefour codes — and the known 12-digit UPC `071727355039`), but it is **provably wrong** for two rare classes (documented and test-pinned in §7, not "fixed"): (a) standard codes with many genuine leading zeros (e.g. printed `000000123456` reconstructs as `00123456`), and (b) non-standard 9/10/11-digit codes that `canonicalizeBarcode` also admits (a 10-digit code reconstructs as 12). Recovering these exactly would require storing the original length — a schema change deliberately **out of Phase A scope** (noted as a known limitation). The displayed number equals whatever was canonicalized from the receipt/input, reconstructed to a standard length — it is not *guaranteed* byte-identical to the ink on the receipt for those rare classes.

**Reconstruction rule.**
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

**Edge cases (accepted behaviour — pinned as tests, not bugs to fix)**
- `n` between 9–11 → rounds up to 12; between 1–7 → rounds up to 8. For a code that was genuinely 9/10/11 digits this over-pads (accepted limitation — length isn't stored).
- Leading-zero-heavy standard codes lose their extra zeros: printed `000000123456` (12) → significant `123456` (n=6) → target 8 → `00123456`. **Accepted, documented limitation** — do NOT add length storage to "fix" this in Phase A.
- All-zero / empty-significant degenerate input (`n = 0`) → target length 8 → `"00000000"`. Cannot occur from `canonicalizeBarcode` (requires ≥8 input digits) but the helper stays total.
- Input longer than 14 or non-string: the helper only ever receives a stored canonical (already validated 14 digits). It should still be defensive — if given a non-14/garbage string, strip non-digits first and apply the same rule; if >14 significant digits return them as-is; never throw.

**Location.** Add to `lib/barcode.ts` (co-located with `canonicalizeBarcode`, the inverse). Pure, string-in/string-out, fully unit-tested. This keeps the `"use server"` rule intact (it's a pure lib, not a server action).

## 4. UI changes

### 4.1 Prices tab (`app/(app)/prices/page.tsx`)
- The page already loads `selected` via `db.item.findUnique`. Extend its `include` to also fetch `barcodes: { select: { code: true }, orderBy: { createdAt: "asc" } }` (a nested `select` on a sibling relation is valid alongside the existing `purchases` include).
- **Render the barcode line at PAGE level, NOT only inside `PriceCard`** (break-spec F2). `PriceCard` renders only in the `stats ?` branch (item has purchases). But the app deliberately keeps items that own a barcode with **zero purchases** (`shouldDeleteOrphan` only deletes when purchases AND barcodes are both zero), and those are selectable on Prices — they must still show their barcode. So render the barcode(s) just under the item picker / item name, in a spot that shows in **both** the `stats` and the no-purchase `else` branch. A small dedicated presentational piece (e.g. an inline `<BarcodeLine barcodes={string[]} />` or plain markup on the page) keeps it independent of price stats.
- Map each stored `code` through `displayBarcode()` before rendering. Pass `barcodes: string[]` already display-formatted.
- If `barcodes` is empty → render nothing (no "no barcode" text on Prices).
- Multiple barcodes → stack them (small), each on its own line, prefixed with a decorative barcode glyph (`aria-hidden`) or the muted word "barcode".
- **Accessibility (break-spec F7):** each rendered code carries an `aria-label="Barcode <number>"` so a screen reader announces it as a barcode, not a run-on number; the decorative glyph is `aria-hidden` (matching `PriceCard`'s existing emoji-tile pattern). Use the shared `mono` font + `var(--ink-faint)` tokens so it is theme-aware.

### 4.2 Receipt-review screen (`app/components/ReceiptImport.tsx`)
- Each `Row` already carries `barcode: string | null` (canonical — confirmed by break-spec F3: `row.barcode` is set from `it.barcode`, produced by `canonicalizeBarcode` in `lib/receipt.ts`, so it is always canonical or null at this point). In the per-row control area, when `row.barcode` is present, render a small muted `displayBarcode(row.barcode)` near the item name (a "🏷 071727355039"-style tag, glyph `aria-hidden`, number with `aria-label="Barcode <number>"`).
- This is display-only; it does not change the existing on-offer / "files as" / "same as" / detach controls. When `row.ignoreBarcodeMatch` is set ("barcode detached"), still show the captured number (it is truthful — this is the code that WAS captured); it simply won't drive identity on save.
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
- `displayBarcode("00071727355039")` → `"071727355039"` (the real Carrefour case — 11 significant → 12).
- 13-digit EAN-13 (e.g. `"04006381333931"` → `"4006381333931"`) and 8-digit EAN-8 (`"00000096385074"` → `"96385074"`) and 14-digit GTIN-14 reconstruct to their printed form.
- Round-trip HOLDS only for the everyday standard-length codes without excess leading zeros: assert `displayBarcode(canonicalizeBarcode("4006381333931")) === "4006381333931"` etc. Do NOT assert a universal round-trip.
- **Pinned lossy edge cases (accepted outputs, break-spec F1)** — these document the limitation so nobody "fixes" it:
  - `displayBarcode("00000000123456")` → `"00123456"` (leading-zero-heavy: 6 significant → padded to 8, NOT back to 12). Assert this exact output.
  - a 10-digit input: `displayBarcode(canonicalizeBarcode("1234567890"))` → `"001234567890"` (12, over-padded from 10). Assert this exact output.
- 9/10/11-digit significant → padded up to 12; 1–7-digit significant → padded up to 8.
- Defensive: non-digit garbage in → no throw; >14 significant digits → returned as-is.

**Live verification (mandatory, on Vercel + owner's iPhone):**
1. Open Prices for an item imported from the real receipt → its barcode line shows and reads the same as the printed receipt barcode (for his real EAN-13/UPC codes).
2. **Barcode-only item** (an item that owns a barcode but has no purchases, e.g. after deleting its last purchase) → Prices still shows its barcode line (break-spec F2).
3. Import a receipt → review screen shows each recognised row's barcode.
4. An item with no barcode → Prices shows no barcode line (no clutter, no error).
5. An item with two barcodes (e.g. one from receipt + one typed manually) → both stack.

## 8. Why this is safe

- Pure additive display. No schema, no migration, no dependency, no action/write path touched.
- The only logic (`displayBarcode`) is isolated, total, and unit-tested against the exact real-world case that previously bit us (the padded Carrefour code).
- Fully reversible: removing the display changes nothing about stored data.

## 8a. Privacy confirmation (break-spec F6)

The only value surfaced is a product barcode (GTIN), which is explicitly **not** personal data (handover §1.3). The receipt parser attaches a `Barcode:` line to the item row it sits under, and Carrefour item barcodes are product GTINs — a footer loyalty/customer barcode does not sit under an item row, so it is not surfaced here. No name, card, phone, ID, or any personal token is read or displayed. Nothing personal leaks through this feature.

## 9. Break-spec pass — resolved

The adversarial break-spec pass (2026-07-12) ran and its findings are folded in above:
- **F2 (Major):** barcode now renders at page level so barcode-only / no-purchase items show it (§4.1) — fixed.
- **F1 (Major):** `displayBarcode` reframed as best-effort/lossy-by-construction; the two break cases pinned as accepted unit tests (§3, §7) — fixed.
- **F3/F4/F5:** confirmatory — `row.barcode` is canonical, displays are injective, the Prisma include is safe.
- **F6/F7 (Minor):** privacy sentence added (§8a); a11y aria-label + aria-hidden glyph added (§4).

Original open questions the pass addressed (kept for history):

- Is the "nearest standard GTIN length" rule ever wrong for a code the owner actually has? (e.g. a legitimately 11-digit or 10-digit code that should NOT be padded to 12.)
- Could an item legitimately have many barcodes such that stacking clutters the Prices header? (Cap/゛+N more"?)
- Does adding `barcodes` to the Prices `findUnique` risk any N+1 / perf issue? (No — single relation include.)
- Any privacy angle? Barcodes are product identity, explicitly **not** personal data (handover §1.3) — confirm nothing personal is surfaced.
