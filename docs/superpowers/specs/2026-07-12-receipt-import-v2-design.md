# Receipt Import v2 — Barcode Identity, Offers & Accuracy

**Date:** 2026-07-12
**Status:** Design — awaiting owner approval
**Feature area:** Log tab → receipt import + manual entry; item identity; price stats
**Depends on:** Receipt import (Plan 2) now working end-to-end on Vercel (server-side pdf.js extraction fixed 2026-07-12).

---

## 1. Why this exists (the problem)

Receipt import now works, but three real gaps surfaced when the owner used it:

1. **Cryptic names fragment item identity.** A receipt line reads `A.G PCORN EBTR273G`; the same product typed by hand is "Americana Garden extra butter popcorn". Today items are matched by **name only**, so these become two separate items → price history splits → the shelf-price verdict is wrong.
2. **No "on offer" control on import.** Every imported purchase is hardcoded `onOffer: false`, even though a promo price should be excluded from the "best price ever" benchmark. Manual entry already has this toggle; import does not.
3. **Item-count confidence.** The owner saw 30 items and wasn't sure all 30 were real products (vs. a stray total/heading line). There's no self-check.

**The unifying insight:** every genuine product line on a Carrefour tax invoice is immediately followed by its **product barcode** line. That barcode is a stable identity that (a) reconciles cryptic vs. friendly names, (b) confirms a row is really a product, and (c) — extended to manual entry — becomes a two-way bridge between typed and imported items.

## 2. Goals / Non-goals

**Goals (this round):**
- Capture the **product barcode** for each receipt line and use it as the primary item identity.
- **Two-way barcode matching:** an optional barcode field on manual entry, checked against known barcodes.
- **Per-item "on offer"** toggle on the import review screen.
- **Count self-check:** flag any parsed row that has no barcode for the owner to confirm/remove.
- Review-screen **rename + "same as my [item]"** linking for new barcodes.
- A **genuine, adversarially-tested build** verified on the real runtime (Vercel + the owner's iPhone) before "done".

**Non-goals (explicitly deferred):**
- **Camera barcode scanning** — deferred to last (own future spike; iOS-Safari/PWA camera reliability must be proven on-device first). Typed barcode only for now.
- **Standalone merge tool** for pre-existing duplicates — designed-for here (data model supports it), built as the **next** plan.
- Auto-detecting offers from receipt discount lines — per-item manual toggle only.

## 3. Locked decisions (from brainstorming)

- Identity model = **barcode-first**, with review-time rename/link **and** a follow-up merge tool ("weight options 1 + 3").
- On offer = **per-item toggle** on the review screen.
- Count concern = **flag rows without a barcode** (self-check), never silently drop a real row.
- Manual entry gets an **optional barcode field**; when present it matches barcode-first.
- Scanning = **last** (deferred).
- A product may have **multiple barcodes** → barcodes stored in a linked table (many barcodes → one item), not a single field.

## 4. Data model changes (`prisma/schema.prisma`)

**New model `Barcode` (many-to-one → Item):**
```
model Barcode {
  code      String  @id            // the EAN/UPC digits; globally unique = the id
  itemId    String
  item      Item    @relation(fields: [itemId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@index([itemId])
}
```
- `code` is the primary key → a given barcode maps to exactly **one** item (enforced by the DB).
- One item can own **many** barcodes (variants/repackaging, or owner-linked receipt codes).

**`Item`** gains `barcodes Barcode[]` (back-relation). No other change; `name` stays unique + human-facing.

**`Purchase`** — no schema change. `onOffer` already exists; import will now set it per item instead of hardcoding `false`.

**Migration:** additive only (new table + relation). No backfill needed; existing items simply have zero barcodes until one is attached. New Prisma migration `2_add_barcode`.

**Backup format (`lib/backup.ts`):** export/import gains a `barcodes` array (`{code, itemName}` — resolved by name on restore, no DB ids, same whitelisting/anti-booby-trap rules). Barcodes are product data, not personal.

## 5. Parser changes (`lib/receipt.ts`)

Today the parser **skips** every `Barcode:` line. New behaviour:

- Process lines in order. When an **item line** matches, push the draft item and remember it as "current".
- When a **`Barcode: <digits>`** line follows, attach its digits to the **current** draft item (the one directly above it). Only per-item barcodes are captured this way.
- A standalone/trailing barcode with no item directly above it (e.g. the transaction barcode at the foot of the receipt) is **ignored** — never attached to a product.
- `DraftItem` gains `barcode: string | null`.
- Barcode value is validated as **8–14 digits** (EAN-8/EAN-13/UPC/ITF-14); anything else → treated as no barcode (flagged).
- **Count self-check:** items with `barcode === null` are surfaced with a `needsReview` flag in the parse result (not dropped).

**Fingerprint (dedupe) change:** `computeFingerprint` currently hashes `name|lineFils` pairs. Since names become editable on review, switch the per-item key to **`barcode ?? normalizedName` + `lineFils`** (sorted, plus item count + grand total). This keeps the duplicate check **stable across renames** — re-importing the same PDF after editing names still detects the duplicate.

## 6. Import matching precedence (`app/actions/receipt.ts` → `importReceipt`)

For each reviewed draft item, resolve identity in this strict order:

1. **Barcode match** — if the draft's barcode exists in `Barcode` → reuse that item (its friendly name wins; the cryptic receipt name is discarded). *This is the payoff: once mapped, silent forever.*
2. **Owner link ("same as my [X]")** — if the owner explicitly linked this row to an existing item on the review screen → reuse item X, and **attach the draft's barcode to X** (add a `Barcode` row) so future imports match by barcode. If X already has other barcodes, the new one is simply added (many-to-one).
3. **Exact name match** — as today, if the (possibly renamed) name normalizes to an existing item → reuse it, and attach the barcode if the row has one and it's not already owned.
4. **New item** — create it with the (renamed or cryptic) name + category guess, and attach the barcode.

**Conflict rule:** a barcode already owned by item A can never be re-pointed to item B during a normal import (the DB `@id` guarantees it). If the owner links a row whose barcode is owned by a *different* item, that's surfaced as a review warning rather than silently moving it (the merge tool handles deliberate merges).

## 7. Manual entry changes (`PurchaseForm.tsx` + `app/actions/purchases.ts`)

Add an **optional "Barcode (optional)"** text field (numeric). On save:

- **Barcode provided + already known** → reuse that item; ignore the typed name for identity; toast "Matched to your **[X]** by barcode." (Keeps history unified.)
- **Barcode provided + new, typed name matches an existing item that has no conflicting barcode** → attach the barcode to that item (enrich it).
- **Barcode provided + new, name matches an item that already owns a *different* barcode** → these are different products (different EANs); create a **new** item with the new barcode (the existing shared-base-word prompt still applies for the name).
- **No barcode** → exactly today's behaviour (`resolveItem` name matching).

## 8. Review-screen UX (`ReceiptImport.tsx`)

Per row: **friendly name (editable)** · qty · unit price · line total · **[ ] on offer** checkbox.
- Rows whose barcode is **already known** show a subtle "recognised" hint (will file automatically).
- Rows with a **new barcode** optionally show **"same as my [suggested item]?"** when the current name fuzzy-matches an existing item (accept → links + remembers the barcode).
- Rows with **no barcode** show a small **"check this"** flag (the self-check) — the owner confirms it's a real product or removes it.
- Header shows the existing "Total matches ✓ / mismatch" badge. Save is allowed on mismatch only with an explicit confirm (unchanged).
- Nothing is forced: the owner can save immediately (cryptic names + barcodes captured) and tidy later.

## 9. Offer flow

The per-row `onOffer` checkbox value flows through `ImportReceiptInput.items[].onOffer` → each `Purchase.onOffer`. `price-stats.ts` already excludes `onOffer` purchases from the benchmark, so no stats change is needed — just stop hardcoding `false`.

## 10. Privacy

- Only **per-item product barcodes** (EAN/UPC identifying the product) are captured — never the transaction/loyalty barcode, never card/phone/receipt-id digits. The parser attaches a barcode only when it directly follows a product line.
- Extraction runs server-side; the assistant never sees the PDF. The diagnostic `console.error` logs error name/message/stack only — never file contents or barcodes.
- Product barcodes are non-personal and safe to store and to include in the backup export.

## 11. Adversarial "break it" cases (must be covered by tests)

1. Same barcode appears **twice** in one receipt (multi-buy) → one item, two separate purchase lines (per §14) — no duplicate item, no unique-constraint crash from attaching the same barcode twice.
2. Barcode matches an existing item but the **receipt name differs** → barcode wins, name untouched.
3. Manual barcode entry whose name matches an item that **already owns a different barcode** → new item (different product), no silent overwrite.
4. **Junk/short barcode** (letters, <8 digits) → treated as no barcode, row flagged.
5. Real item with **no barcode line** (weighed produce, carrier bag) → flagged, **never dropped**.
6. The receipt's **bottom transaction barcode** → never attached to a product.
7. **Re-import after renaming** items on a prior import → dedupe still catches it (barcode-based fingerprint).
8. Two different products that **share a base word** (existing prompt) still behaves.
9. Owner links a row to an item whose **barcode is owned by a third item** → warning, not a silent move.
10. On-offer rows are **excluded** from best-price stats; non-offer rows are not.

## 12. Testing & verification (the "genuine build" gate)

- **Unit tests (Vitest):** parser barcode pairing + no-barcode flagging + digit validation; barcode-based fingerprint stability across renames; `importReceipt` matching precedence (all four branches + conflict); manual-entry barcode precedence; offer flag → stats exclusion. Every case in §11 is a test.
- **Adversarial design review** before build (skeptical engineer tries to break §4–§9), findings folded in.
- **Real-runtime verification (finish gate):** the full flow proven on **Vercel** *and* the owner's **iPhone** with a real receipt — import → barcode recognised on a second receipt → manual entry with a barcode links correctly → offer excluded from stats. Not "done" until this passes. (This is the specific gap that let the earlier import bug through: local Node ≠ Vercel serverless.)

## 13. Scope split

- **This round:** §4–§12 (barcode capture, two-way matching, offers, self-check, review UX, tests, live verification).
- **Next plan:** standalone **merge tool** to fold pre-existing duplicate items (repoint their barcodes/purchases onto one item).
- **Last:** camera **scanning** spike (prove iOS-Safari/PWA camera on-device, then wire into the barcode fields).

## 14. Open questions

None blocking. Defaults chosen: barcodes canonicalised (§15); multi-buy of the same barcode creates separate purchase lines (not merged) for an accurate per-line record; review save allowed with a no-barcode-flagged row after the owner acknowledges it.

## 15. Adversarial review (2026-07-12) — findings folded in

An Opus skeptical-engineer review attacked this design against the live code. 2 Critical + 9 Major + 4 Minor findings. Resolutions below are now part of the spec. **Three need explicit owner sign-off** (marked 🟠).

**Critical**
- **C1 — Legacy dedupe break.** Changing the fingerprint basis would make already-imported receipts re-import as duplicates. **Resolution:** on import, compute **both** the legacy name-hash **and** the new hash and treat a match on **either** as a duplicate; store the new hash. (§6 dedupe amended.)
- **C2 — No way to correct a wrong barcode mapping before the merge tool. 🟠** Barcode-match is absolute, so a mis-taught barcode can't be re-pointed. **Resolution:** the review screen shows a **"not this item / detach"** control on any barcode-recognised row, so the owner can break a wrong mapping immediately (doesn't wait for the merge tool). *Owner: confirm you want this small control now.*

**Major**
- **M3 — Multi-buy crash.** Same barcode twice on one receipt would hit the `code` unique key inside the transaction and roll back the whole import. **Resolution:** per-run barcode cache + **create-if-absent** (never a bare create); attaching an already-present barcode is a no-op. (§6/§11.1.)
- **M4 — Orphan-prune destroys taught barcodes.** Deleting an item's last purchase cascades away its barcodes. **Resolution:** an item with **≥1 barcode is never auto-deleted** on last-purchase deletion (it's kept as a barcode-only "known product"). (§4/§7.)
- **M5 — Offer toggle vs the 3-sample gate. 🟠** Marking promo lines as offers can drop an item below the "≥3 non-offer samples" gate → verdict shows "not enough prices yet." This is *arguably correct* but a visible change. **Resolution (default):** accept it — a promo-heavy item honestly has too few full-price samples to judge. *Owner: agree, or should it fall back to an "based on offer prices" estimate instead?*
- **M6 — Barcode formats fragment identity. 🟠** UPC-12 vs EAN-13 vs leading zeros = different keys = the very duplication we're fixing. **Resolution:** **canonicalise every barcode to GTIN-14** (left-pad with zeros) on both receipt capture and manual entry before it becomes the key; always handle barcodes as **strings**, never numbers. *Owner: this is a technical default — flagging it for awareness; no action needed unless you object.*
- **M7 — Backup has no barcode rules.** **Resolution:** add a `validBarcode` whitelist (canonical GTIN-14), reject duplicate codes within a backup file, and skip barcode rows whose item name doesn't resolve on restore. (§4.)
- **M8 — Privacy: capture net too broad.** Capturing "any digit run after an item" could grab a loyalty/tax/transaction number. **Resolution:** capture **only** a line literally prefixed `Barcode:` that **immediately** follows an item line. (§5/§10.)
- **M9 — "current item" pointer never resets.** The footer transaction barcode would attach to the last product, and a stray total line matching the item regex would look "confirmed." **Resolution:** clear "current" on **any** non-item line (total/subtotal/VAT/payment/blank); only a `Barcode:` line directly after an item attaches. This also makes the count self-check correct. (§5.)
- **M10 — Fingerprint source ambiguity.** **Resolution:** the fingerprint is **always** computed from the **immutable raw parse** (barcodes + parsed names + line totals), never from post-edit review state — so renames never affect dedupe. (§5.)
- **M11 — Manual barcode + fuzzy name.** **Resolution:** a new barcode whose typed name *fuzzy*-matches an existing item still shows the "same as X?" confirm; on "yes" the barcode attaches to X, on "no" a new item is created with the barcode. (§7.)

**Minor**
- **M12 — Check-digit.** Validate the EAN/UPC mod-10 check digit (not just length) to reject glyph-split/truncated codes. (§5.)
- **M13 — Recurring no-barcode items.** Only flag a no-barcode row when it **doesn't** match an existing item by name, so known weighed produce / carrier bags aren't re-flagged every import. (§8.)
- **M14 — Migration.** Ship `2_add_barcode` via `prisma migrate deploy` in `vercel-build` (already the pattern); confirm no live schema drift first.
- **M15 — Normalized-name collision.** Note that "exact name match" is normalized equality; two distinct unique names can normalise alike (rare, single-user). Attach barcode to the first match; acceptable.

**Owner sign-off needed on:** C2 (add the detach control now), M5 (accept "unknown" verdicts for promo-heavy items), M6 (GTIN-14 canonicalisation — awareness only). Everything else is folded in as a default.
