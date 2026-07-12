# Receipt Import v2 (Barcode Identity, Offers & Accuracy) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Every task is strict TDD: write the failing test → run it (see it fail) → minimal implementation → run it (see it pass) → commit. All work runs on **Opus**.

**Goal:** Make the product **barcode** the durable identity of an item so cryptic receipt names and hand-typed names reconcile automatically — with a two-way (receipt + optional manual) barcode bridge, per-item "on offer" on import, and a no-barcode accuracy self-check.

**Architecture:** Add a `Barcode` table (code = PK → one item; an item may own many). A new `lib/barcode.ts` canonicalises every code to GTIN-14 and validates the check digit. The parser captures only `Barcode:`-prefixed lines directly under an item and resets its "current item" pointer on any non-item line. `importReceipt` resolves identity barcode-first (then owner-link, exact-name, new) using per-run caches and create-if-absent barcode writes; dedupe checks both a new barcode-based fingerprint and the legacy name fingerprint. Manual entry gains an optional barcode with the same precedence. Backup gains validated barcode rows.

**Tech Stack:** Next.js 15 · TypeScript (strict) · Prisma 7 + Postgres (Neon) · Vitest · Server Actions.

**Spec:** `docs/superpowers/specs/2026-07-12-receipt-import-v2-design.md` (APPROVED 2026-07-12, incl. adversarial §15). Read it before starting.

**Conventions:** money = integer fils; barcodes = **strings** always (never `Number()`); Windows shell → run npm via `cmd /c "..."`; commit co-author line `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File map

- **Create** `lib/barcode.ts` — canonicalise + validate barcodes (pure).
- **Create** `lib/receipt-match.ts` — pure `resolveDraftIdentity` (import-matching precedence). MUST live in `lib/`, not `app/actions/receipt.ts`: a `"use server"` file may only export async functions.
- **Create** `lib/purchase-match.ts` — pure `resolveManualIdentity` + `shouldDeleteOrphan` (same reason).
- **Create** `tests/barcode.test.ts`, `tests/receipt-barcode.test.ts`, `tests/receipt-fingerprint.test.ts`, `tests/import-matching.test.ts`, `tests/manual-barcode.test.ts`, `tests/backup-barcode.test.ts`.
- **Modify** `prisma/schema.prisma` — add `Barcode` model + `Item.barcodes` back-relation. New migration `prisma/migrations/2_add_barcode/`.
- **Modify** `lib/receipt.ts` — `DraftItem.barcode`; barcode pairing + pointer reset in `parseReceipt`; raw-parse fingerprint (new + legacy) via `computeFingerprint`/`computeLegacyFingerprint`.
- **Modify** `lib/items.ts` — none required (reuse `normalizeName`/`resolveItem`); matching helpers live in the new `lib/*-match.ts` files.
- **Modify** `app/actions/receipt.ts` — `parseReceiptUpload` returns both fingerprints; `importReceipt` precedence, per-run caches, create-if-absent, offer flag, dual-dedupe, detach/link.
- **Modify** `app/actions/purchases.ts` — `addPurchase` optional barcode + precedence; `deletePurchase` orphan-prune guard for barcode-owning items.
- **Modify** `app/components/PurchaseForm.tsx` — optional "Barcode" field.
- **Modify** `app/components/ReceiptImport.tsx` — editable name, on-offer checkbox, same-as suggestion, no-barcode flag, "not this item / detach" control.
- **Modify** `lib/backup.ts` — barcode export/import types + `validateBackup` barcode rules.
- **Modify** `app/actions/backup.ts` — persist/restore barcodes.

Two barcodes may map to one item; one barcode maps to exactly one item (DB-enforced by `code` PK).

---

## Task 1: Barcode canonicalisation + validation (pure)

**Files:**
- Create: `lib/barcode.ts`
- Test: `tests/barcode.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/barcode.test.ts
import { describe, it, expect } from "vitest";
import { canonicalizeBarcode } from "@/lib/barcode";

describe("canonicalizeBarcode", () => {
  it("pads a valid EAN-13 to GTIN-14", () => {
    // 5000159407236 is a valid EAN-13 (check digit ok)
    expect(canonicalizeBarcode("5000159407236")).toBe("05000159407236");
  });
  it("treats UPC-12 and its EAN-13 zero-padded form as the SAME canonical code", () => {
    // 036000291452 (UPC-A, valid) vs 0036000291452 (EAN-13 of same)
    expect(canonicalizeBarcode("036000291452")).toBe("00036000291452");
    expect(canonicalizeBarcode("0036000291452")).toBe("00036000291452");
  });
  it("strips spaces and non-digits before validating", () => {
    expect(canonicalizeBarcode("  5000159407236 ")).toBe("05000159407236");
    expect(canonicalizeBarcode("Barcode: 5000159407236")).toBe("05000159407236");
  });
  it("rejects a wrong check digit", () => {
    expect(canonicalizeBarcode("5000159407237")).toBeNull(); // last digit wrong
  });
  it("rejects too-short / too-long / empty", () => {
    expect(canonicalizeBarcode("1234567")).toBeNull();       // 7 digits
    expect(canonicalizeBarcode("123456789012345")).toBeNull(); // 15 digits
    expect(canonicalizeBarcode("")).toBeNull();
    expect(canonicalizeBarcode("abcd")).toBeNull();
  });
  it("accepts a valid EAN-8", () => {
    // 96385074 is a valid EAN-8
    expect(canonicalizeBarcode("96385074")).toBe("00000096385074");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c "npx vitest run tests/barcode.test.ts"`
Expected: FAIL — `canonicalizeBarcode` is not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/barcode.ts
// Product barcodes (EAN-8/UPC-12/EAN-13/ITF-14). Canonical form = GTIN-14:
// digits only, mod-10 check digit verified, left-padded with zeros to 14.
// Storing as GTIN-14 makes UPC-12 and its zero-padded EAN-13 the SAME key,
// which is the whole point (one product = one identity). Always a STRING —
// never pass a barcode through Number(), which would drop leading zeros.

/** Standard GTIN mod-10 check-digit validation over the first n-1 digits. */
function checkDigitValid(digits: string): boolean {
  const body = digits.slice(0, -1);
  const check = Number(digits.slice(-1));
  let sum = 0;
  // Weight 3,1,3,1… from the RIGHTMOST body digit leftwards.
  for (let i = body.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += Number(body[i]) * w;
  }
  const computed = (10 - (sum % 10)) % 10;
  return computed === check;
}

/**
 * Return the canonical GTIN-14 string for a raw barcode, or null if it is not a
 * valid 8–14 digit product barcode. Strips any non-digit characters first.
 */
export function canonicalizeBarcode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 14) return null;
  if (!checkDigitValid(digits)) return null;
  return digits.padStart(14, "0");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c "npx vitest run tests/barcode.test.ts"`
Expected: PASS (6 tests). If a sample code fails, verify it is a real valid GTIN with an online check-digit calculator and correct the fixture — do NOT weaken the check.

- [ ] **Step 5: Commit**

```bash
git add lib/barcode.ts tests/barcode.test.ts
git commit -m "feat: GTIN-14 barcode canonicalisation + check-digit validation"
```

---

## Task 2: Schema — Barcode table + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/2_add_barcode/migration.sql`

- [ ] **Step 1: Add the model** (`prisma/schema.prisma`) — add after the `Item` model and add the back-relation on `Item`.

```prisma
model Barcode {
  code      String   @id            // canonical GTIN-14; one barcode -> one item
  itemId    String
  item      Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@index([itemId])
}
```

On `Item`, add the back-relation line:

```prisma
  purchases  Purchase[]
  barcodes   Barcode[]
```

- [ ] **Step 2: Create the migration SQL** — Prisma 7 uses `prisma migrate`. Because local dev is DB-free, hand-author the migration folder to match the schema (mirrors how `1_add_last_backup_at` was created). Create `prisma/migrations/2_add_barcode/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "Barcode" (
    "code" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Barcode_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "Barcode_itemId_idx" ON "Barcode"("itemId");

-- AddForeignKey
ALTER TABLE "Barcode" ADD CONSTRAINT "Barcode_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Regenerate the Prisma client**

Run: `cmd /c "npx prisma generate"`
Expected: "Generated Prisma Client". (`vercel-build` runs `prisma migrate deploy` on deploy, applying `2_add_barcode` to Neon. Additive only — no backfill.)

- [ ] **Step 4: Typecheck**

Run: `cmd /c "npm run typecheck"`
Expected: clean (the generated client now knows `db.barcode` and `item.barcodes`).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/2_add_barcode/migration.sql
git commit -m "feat: add Barcode table (many barcodes -> one item)"
```

---

## Task 3: Parser — capture barcodes, reset pointer, flag no-barcode rows

**Files:**
- Modify: `lib/receipt.ts`
- Test: `tests/receipt-barcode.test.ts`

Design: `DraftItem` gains `barcode: string | null`. In `parseReceipt`, keep a `current: DraftItem | null` pointer. On an item match, push and set `current`. On a line matching `/^barcode\b/i`, canonicalise its digits and set `current.barcode` **only if `current` is non-null**. On ANY other consumed line (total/paid/blank/header/unmatched), set `current = null`. This guarantees a footer transaction barcode (no item directly above) never attaches, and a stray total line that sneaks past the ITEM regex won't get a barcode (so it stays flagged by the UI).

- [ ] **Step 1: Write the failing test**

```ts
// tests/receipt-barcode.test.ts
import { describe, it, expect } from "vitest";
import { parseReceipt } from "@/lib/receipt";

// Item line shape: name qty unitIncl unitExcl totExcl vatRate vatAmt totIncl
const item = (name: string, qty: string, unit: string, tot: string) =>
  `${name} ${qty} ${unit} ${unit} ${tot} 5.00 0.00 ${tot}`;

describe("parseReceipt barcode pairing", () => {
  it("attaches a Barcode line to the item directly above it (canonical GTIN-14)", () => {
    const r = parseReceipt([
      item("A.G PCORN EBTR273G", "1", "5.50", "5.50"),
      "Barcode: 5000159407236",
    ]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].barcode).toBe("05000159407236");
  });

  it("leaves barcode null when there is no Barcode line", () => {
    const r = parseReceipt([item("LOOSE TOMATO", "0.75", "4.00", "3.00")]);
    expect(r.items[0].barcode).toBeNull();
  });

  it("does NOT attach a footer/transaction barcode after a totals line", () => {
    const r = parseReceipt([
      item("MILK FF 1L", "1", "5.50", "5.50"),
      "Total Amount Incl. VAT 5.50",
      "Barcode: 5000159407236", // transaction barcode -> must be ignored
    ]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].barcode).toBeNull();
  });

  it("ignores an invalid barcode (bad check digit) -> null", () => {
    const r = parseReceipt([
      item("BREAD BROWN", "1", "3.25", "3.25"),
      "Barcode: 5000159407237",
    ]);
    expect(r.items[0].barcode).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c "npx vitest run tests/receipt-barcode.test.ts"`
Expected: FAIL — `barcode` is undefined on `DraftItem` / property missing.

- [ ] **Step 3: Implement** — edit `lib/receipt.ts`:

1. Add the import at the top: `import { canonicalizeBarcode } from "./barcode";`
2. Add to the `DraftItem` type: `barcode?: string | null;` — **OPTIONAL on purpose**, so existing `DraftItem` literals (the fixtures in `tests/receipt.test.ts` and the `diFromRow` construction in `ReceiptImport.tsx`) still compile until the client is wired up in Task 6. The parser still sets `barcode: null` explicitly on every draft it creates.
3. Rewrite the loop body of `parseReceipt` to track `current` and reset it. Replace the existing `for (const raw of lines) { ... }` block with:

```ts
  let current: DraftItem | null = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) { current = null; continue; }

    // Barcode line: attach to the item directly above, then this line is consumed.
    if (/^barcode\b/i.test(line)) {
      if (current) current.barcode = canonicalizeBarcode(line);
      continue; // keep `current` so nothing else attaches; next non-item line resets it
    }

    const totalMatch = /total amount incl\.?\s*vat.*?(\d+\.\d{2})\s*$/i.exec(line);
    if (totalMatch) { grandTotalFils = fils(totalMatch[1]); current = null; continue; }

    const paidMatch = /^amount\s*:?\s*aed\s*(\d+\.\d{2})/i.exec(line);
    if (paidMatch) { paidFils = fils(paidMatch[1]); current = null; continue; }

    const m = ITEM.exec(line);
    if (!m) { current = null; continue; }
    const name = m[1].trim();
    if (/description|unit price|vat/i.test(name)) { current = null; continue; } // header row

    const quantity = parseFloat(m[2]);
    const draft: DraftItem = {
      name,
      quantity,
      unit: Number.isInteger(quantity) ? "each" : "kg",
      unitPriceFils: fils(m[3]),
      lineFils: fils(m[4]),
      barcode: null,
    };
    items.push(draft);
    current = draft;
  }
```

(Note: a second `Barcode:` line right after the first still only overwrites `current.barcode` harmlessly; a blank/total line then clears `current`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c "npx vitest run tests/receipt-barcode.test.ts && npx vitest run tests/receipt.test.ts"`
Expected: PASS. The existing `tests/receipt.test.ts` must still pass unchanged — because `barcode` is optional, its inline `DraftItem` fixtures compile without edits.

- [ ] **Step 5: Commit**

```bash
git add lib/receipt.ts tests/receipt-barcode.test.ts tests/receipt.test.ts
git commit -m "feat: parser captures per-item product barcode, resets on non-item lines"
```

---

## Task 4: Fingerprint — raw parse, barcode-based + legacy dual key

**Files:**
- Modify: `lib/receipt.ts`
- Test: `tests/receipt-fingerprint.test.ts`

Design: keep `computeFingerprint(items, grandTotalFils)` but change its per-item key to `` `${barcode ?? normalizedName}|${lineFils}` `` where `normalizedName` reuses `normalizeName` from `lib/items.ts`. Add `computeLegacyFingerprint` that reproduces the OLD `name|lineFils` behaviour, so `importReceipt` can detect receipts imported before this change. Both are computed from the **raw parse** (the client sends both, unedited).

- [ ] **Step 1: Write the failing test**

```ts
// tests/receipt-fingerprint.test.ts
import { describe, it, expect } from "vitest";
import { computeFingerprint, computeLegacyFingerprint, type DraftItem } from "@/lib/receipt";

const mk = (name: string, lineFils: number, barcode: string | null): DraftItem => ({
  name, quantity: 1, unit: "each", unitPriceFils: lineFils, lineFils, barcode,
});

describe("fingerprints", () => {
  it("new fingerprint is stable when a barcoded item is RENAMED (barcode drives it)", () => {
    const a = [mk("A.G PCORN EBTR273G", 550, "05000159407236")];
    const b = [mk("Americana Popcorn", 550, "05000159407236")];
    expect(computeFingerprint(a, 550)).toBe(computeFingerprint(b, 550));
  });
  it("new fingerprint falls back to name when no barcode", () => {
    const a = [mk("LOOSE TOMATO", 300, null)];
    const b = [mk("loose  tomato", 300, null)];
    expect(computeFingerprint(a, 300)).toBe(computeFingerprint(b, 300)); // normalized
  });
  it("legacy fingerprint ignores barcodes (matches the old name|lineFils hash)", () => {
    const a = [mk("MILK", 550, "05000159407236")];
    const b = [mk("MILK", 550, null)];
    expect(computeLegacyFingerprint(a, 550)).toBe(computeLegacyFingerprint(b, 550));
  });
  it("different totals -> different fingerprint", () => {
    const a = [mk("MILK", 550, "05000159407236")];
    expect(computeFingerprint(a, 550)).not.toBe(computeFingerprint(a, 560));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c "npx vitest run tests/receipt-fingerprint.test.ts"`
Expected: FAIL — `computeLegacyFingerprint` not exported / new key not barcode-based.

- [ ] **Step 3: Implement** — in `lib/receipt.ts`:

1. Add import: `import { normalizeName } from "./items";`
2. Add a shared hasher and the two functions (replace the existing `computeFingerprint`):

```ts
function fnv1a(payload: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Stable dedupe key. Barcode drives identity when present, so renames on the
 *  review screen never change it; falls back to the normalized parsed name. */
export function computeFingerprint(items: DraftItem[], grandTotalFils: number | null): string {
  const pairs = items.map((i) => `${i.barcode ?? normalizeName(i.name)}|${i.lineFils}`).sort();
  return fnv1a(`${items.length}#${grandTotalFils ?? ""}#${pairs.join(";")}`);
}

/** The pre-v2 hash (name|lineFils). Used only to detect receipts imported
 *  before the fingerprint basis changed, so they aren't re-imported twice. */
export function computeLegacyFingerprint(items: DraftItem[], grandTotalFils: number | null): string {
  const pairs = items.map((i) => `${i.name}|${i.lineFils}`).sort();
  return fnv1a(`${items.length}#${grandTotalFils ?? ""}#${pairs.join(";")}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c "npx vitest run tests/receipt-fingerprint.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/receipt.ts tests/receipt-fingerprint.test.ts
git commit -m "feat: barcode-based raw-parse fingerprint + legacy fingerprint for dedupe compatibility"
```

---

## Task 5: `parseReceiptUpload` returns both fingerprints

**Files:**
- Modify: `lib/receipt.ts` (extend `ParsedReceipt`), `app/actions/receipt.ts`
- Test: covered via `tests/receipt-fingerprint.test.ts` (functions) + a small assertion here.

- [ ] **Step 1: Add fields to `ParsedReceipt`** in `lib/receipt.ts`:

```ts
export type ParsedReceipt = {
  items: DraftItem[];
  grandTotalFils: number | null;
  paidFils: number | null;
  sumFils: number;
  matchesTotal: boolean;
  warnings: string[];
  fingerprint: string;        // new (barcode-based, raw parse)
  legacyFingerprint: string;  // old name-based, raw parse
};
```

At the end of `parseReceipt`, before `return`, compute them and include in the returned object:

```ts
  const fingerprint = computeFingerprint(items, grandTotalFils);
  const legacyFingerprint = computeLegacyFingerprint(items, grandTotalFils);
  return { items, grandTotalFils, paidFils, sumFils, matchesTotal, warnings, fingerprint, legacyFingerprint };
```

- [ ] **Step 2: Verify no server change needed** — `parseReceiptUpload` already returns `{ ok: true, parsed }`, so both fingerprints flow to the client automatically. Read `app/actions/receipt.ts` to confirm it returns `parsed` unchanged.

- [ ] **Step 3: Run the full suite + typecheck**

Run: `cmd /c "npm run typecheck && npx vitest run"`
Expected: PASS (existing receipt tests updated for the new required fields — update any `ParsedReceipt` fixtures/asserts if present).

- [ ] **Step 4: Commit**

```bash
git add lib/receipt.ts
git commit -m "feat: parseReceipt returns barcode + legacy fingerprints for dedupe"
```

---

## Task 6: `importReceipt` — barcode-first precedence, caches, offers, dual-dedupe

**Files:**
- Create: `lib/receipt-match.ts` (pure resolver)
- Modify: `app/actions/receipt.ts`, `app/components/ReceiptImport.tsx` (client wiring — required here so typecheck passes)
- Test: `tests/import-matching.test.ts`

**Amendments from the break-the-plan review — apply all of these:**
- **Conflict result (F6, spec §11.9):** add to `ResolveResult` the variant `| { action: "conflict"; ownedByItemId: string; itemId: string; attachBarcode: string }`. In `resolveDraftIdentity`, BEFORE branch 2 (explicit link), if `d.linkedItemId` is set AND `d.barcode` is owned by a DIFFERENT item (`ctx.byBarcode.get(d.barcode)` exists and ≠ `d.linkedItemId`), return `{ action: "conflict", ownedByItemId: <owner>, itemId: d.linkedItemId, attachBarcode: d.barcode }`. Add a test: `linkedItemId: "item-milk"` while `barcode: "05000159407236"` is owned by `item-pop` → expect `action: "conflict"`. In the action, a conflict still imports the row under the barcode's EXISTING owner (barcode is authoritative) and pushes a human message into a returned `warnings: string[]`; it never crashes.
- **tx type (F10):** type the transaction client as `Prisma.TransactionClient` (`import { Prisma } from "@prisma/client";`), not `any`.
- **Client wiring (F2/F4) — REQUIRED in this task:** update `app/components/ReceiptImport.tsx` `save()` to (1) build `ImportDraft[]` — each row → `{ name, quantity, unit, lineFils, barcode: row.barcode ?? null, onOffer: false }` (per-row on-offer / detach / same-as controls arrive in Task 9; default `onOffer: false` and omit `linkedItemId`/`ignoreBarcodeMatch` for now), and (2) send `fingerprint: parsed.fingerprint` and `legacyFingerprint: parsed.legacyFingerprint` taken from the RAW parse result held in state — do NOT recompute the fingerprint from edited rows. Read `ReceiptImport.tsx` first to match its state/save shape; keep the raw `parsed` object in state.
- **Dedupe note (F7):** the dual legacy+new check fully protects prior imports that were not renamed at import time; a pre-v2 receipt whose rows were renamed before saving stored a hash of the edited names and may not dedupe — acceptable, document only (a comment in `importReceipt`).

Update `ImportReceiptInput` and `DraftItem` payloads. Extend `ImportReceiptInput`:

```ts
export type ImportDraft = {
  name: string;
  quantity: number;
  unit: "each" | "kg";
  lineFils: number;
  barcode: string | null;        // canonical GTIN-14 or null
  onOffer: boolean;              // per-item toggle (Task 9)
  linkedItemId?: string;        // owner "same as my [X]"
  ignoreBarcodeMatch?: boolean; // owner tapped "not this item / detach"
};

export type ImportReceiptInput = {
  items: ImportDraft[];
  grandTotalFils: number | null;
  fingerprint: string;
  legacyFingerprint: string;
  purchasedAt?: string;
  force?: boolean;
};
```

Because most matching logic is pure, extract a testable resolver. Create an exported pure function `resolveDraftIdentity` that decides, given the draft + lookup maps, what to do — then the action performs the DB writes.

- [ ] **Step 1: Write the failing test** (pure resolver — no DB)

```ts
// tests/import-matching.test.ts
import { describe, it, expect } from "vitest";
import { resolveDraftIdentity } from "@/lib/receipt-match";

// existingByBarcode: code -> itemId ; existingByName: normalizedName -> itemId
const ctx = () => ({
  byBarcode: new Map<string, string>([["05000159407236", "item-pop"]]),
  byName: new Map<string, string>([["milk", "item-milk"]]),
});

describe("resolveDraftIdentity", () => {
  it("1) barcode match wins over everything", () => {
    const d = { name: "WHATEVER", barcode: "05000159407236", linkedItemId: "item-x" } as any;
    expect(resolveDraftIdentity(d, ctx())).toEqual({ action: "reuse", itemId: "item-pop" });
  });
  it("1b) ignoreBarcodeMatch skips the barcode lookup", () => {
    const d = { name: "MILK", barcode: "05000159407236", ignoreBarcodeMatch: true } as any;
    // falls through to name match on "milk"
    expect(resolveDraftIdentity(d, ctx())).toEqual({ action: "reuse", itemId: "item-milk", attachBarcode: "05000159407236" });
  });
  it("2) explicit link reuses X and attaches the barcode to X", () => {
    const d = { name: "NEWCODE", barcode: "07350053850019", linkedItemId: "item-milk" } as any;
    expect(resolveDraftIdentity(d, ctx())).toEqual({ action: "reuse", itemId: "item-milk", attachBarcode: "07350053850019" });
  });
  it("3) exact name match reuses + attaches barcode if new", () => {
    const d = { name: "Milk", barcode: "07350053850019" } as any;
    expect(resolveDraftIdentity(d, ctx())).toEqual({ action: "reuse", itemId: "item-milk", attachBarcode: "07350053850019" });
  });
  it("4) no match -> create new (carry barcode)", () => {
    const d = { name: "Pistachios", barcode: "07350053850019" } as any;
    expect(resolveDraftIdentity(d, ctx())).toEqual({ action: "create", attachBarcode: "07350053850019" });
  });
  it("no barcode + no name match -> create new, no barcode", () => {
    const d = { name: "Loose Okra", barcode: null } as any;
    expect(resolveDraftIdentity(d, ctx())).toEqual({ action: "create", attachBarcode: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c "npx vitest run tests/import-matching.test.ts"`
Expected: FAIL — `resolveDraftIdentity` not exported.

- [ ] **Step 3: Create the pure resolver, then wire the action.** The resolver goes in a NEW file `lib/receipt-match.ts` — it must NOT be exported from `app/actions/receipt.ts`, because that file starts with `"use server"` and Next.js forbids exporting non-async functions from such a module.

```ts
// lib/receipt-match.ts
import { normalizeName } from "@/lib/items";

export type ResolveCtx = { byBarcode: Map<string, string>; byName: Map<string, string> };
export type ResolveResult =
  | { action: "reuse"; itemId: string; attachBarcode?: string }
  | { action: "create"; attachBarcode: string | null };

export function resolveDraftIdentity(
  d: { name: string; barcode: string | null; linkedItemId?: string; ignoreBarcodeMatch?: boolean },
  ctx: ResolveCtx,
): ResolveResult {
  // 1) Barcode wins (unless the owner detached it).
  if (d.barcode && !d.ignoreBarcodeMatch) {
    const hit = ctx.byBarcode.get(d.barcode);
    if (hit) return { action: "reuse", itemId: hit };
  }
  // 2) Explicit owner link -> reuse that item, attach barcode (if new & unowned).
  if (d.linkedItemId) {
    return { action: "reuse", itemId: d.linkedItemId, ...(d.barcode ? { attachBarcode: d.barcode } : {}) };
  }
  // 3) Exact normalized-name match -> reuse, attach barcode if present.
  const byName = ctx.byName.get(normalizeName(d.name));
  if (byName) return { action: "reuse", itemId: byName, ...(d.barcode ? { attachBarcode: d.barcode } : {}) };
  // 4) New item.
  return { action: "create", attachBarcode: d.barcode ?? null };
}
```

Then in `app/actions/receipt.ts`, add `import { resolveDraftIdentity } from "@/lib/receipt-match";` and rewrite `importReceipt` to:
1. **Dual-dedupe:** unless `force`, `findFirst` a `ReceiptImport` whose `fingerprint` is in `[input.fingerprint, input.legacyFingerprint]`; if found → `{ duplicate, when }`.
2. Build lookup maps up front: `byName` from `db.item.findMany({select:{id,name}})` (keyed by `normalizeName`), `byBarcode` from `db.barcode.findMany({select:{code,itemId}})`.
3. Inside `db.$transaction`, iterate drafts. For each: `resolveDraftIdentity`. On `reuse` → use itemId; if `attachBarcode` and not already present (check a per-run `seenBarcodes` set + `byBarcode`) → `tx.barcode.create` (create-if-absent; on `create`, also add to `seenBarcodes` and `byBarcode`). On `create` → create item (+ category via `guessCategory`), add to `byName`; if `attachBarcode` → create the barcode row and register it. **Never** bare-create a barcode whose code is already registered (skip) — this makes multi-buy of the same barcode safe.
4. Create the `Purchase` with `onOffer: draft.onOffer` (NOT hardcoded false), `importId`, `monthKey`, etc.
5. Store `fingerprint: input.fingerprint` (the new one) on the `ReceiptImport` row (handle `force` collision as today by suffixing).

Barcode attach helper inside the transaction:

```ts
async function attachBarcode(tx: any, code: string, itemId: string, seen: Set<string>, byBarcode: Map<string,string>) {
  if (seen.has(code) || byBarcode.has(code)) return; // already owned (this run or DB) -> no-op
  await tx.barcode.create({ data: { code, itemId } });
  seen.add(code); byBarcode.set(code, itemId);
}
```

Keep the existing item-cache-by-name and category-cache patterns from the current `importReceipt`.

- [ ] **Step 4: Run tests + typecheck**

Run: `cmd /c "npm run typecheck && npx vitest run tests/import-matching.test.ts"`
Expected: PASS (6 tests). Full suite: `cmd /c "npx vitest run"` still green.

- [ ] **Step 5: Commit**

```bash
git add app/actions/receipt.ts tests/import-matching.test.ts
git commit -m "feat: barcode-first import matching, per-run caches, create-if-absent, per-item offers, dual-dedupe"
```

---

## Task 7: Manual entry — optional barcode + precedence

**Files:**
- Modify: `app/actions/purchases.ts`, `app/components/PurchaseForm.tsx`
- Test: `tests/manual-barcode.test.ts`

First read the current `addPurchase` in `app/actions/purchases.ts` to match its exact shape (it returns `needsConfirm` for fuzzy matches). Extract the pure precedence decision so it's testable, mirroring Task 6.

- [ ] **Step 1: Write the failing test**

```ts
// tests/manual-barcode.test.ts
import { describe, it, expect } from "vitest";
import { resolveManualIdentity } from "@/lib/purchase-match";

const ctx = () => ({
  byBarcode: new Map<string, string>([["05000159407236", "item-pop"]]),
  // resolveItem-style existing items:
  existing: [{ id: "item-milk", name: "Milk" }],
});

describe("resolveManualIdentity", () => {
  it("known barcode -> reuse that item, ignore typed name", () => {
    const r = resolveManualIdentity({ name: "random", barcode: "05000159407236" }, ctx());
    expect(r).toEqual({ action: "reuse", itemId: "item-pop", matchedByBarcode: true });
  });
  it("new barcode + exact name -> attach barcode to that item", () => {
    const r = resolveManualIdentity({ name: "Milk", barcode: "07350053850019" }, ctx());
    expect(r).toEqual({ action: "reuse", itemId: "item-milk", attachBarcode: "07350053850019" });
  });
  it("new barcode + fuzzy name -> confirm prompt, carry barcode", () => {
    const r = resolveManualIdentity({ name: "Milk 2L", barcode: "07350053850019" }, ctx());
    expect(r).toEqual({ action: "confirm", suggestItemId: "item-milk", attachBarcode: "07350053850019" });
  });
  it("new barcode + no name match -> create a new item carrying the barcode", () => {
    const r = resolveManualIdentity({ name: "Pistachios", barcode: "07350053850019" }, ctx());
    expect(r).toEqual({ action: "create", attachBarcode: "07350053850019" });
  });
  it("no barcode -> defer to existing name resolution (action: name)", () => {
    const r = resolveManualIdentity({ name: "Milk 2L", barcode: null }, ctx());
    expect(r).toEqual({ action: "name" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c "npx vitest run tests/manual-barcode.test.ts"`
Expected: FAIL — `resolveManualIdentity` not exported.

- [ ] **Step 3: Create the pure resolver** in a NEW file `lib/purchase-match.ts` (again, not in the `"use server"` action file). `addPurchase` in the action imports `resolveManualIdentity` from it.

```ts
// lib/purchase-match.ts
import { resolveItem, normalizeName, type ItemRef } from "@/lib/items";

export type ManualCtx = { byBarcode: Map<string, string>; existing: ItemRef[] };
export type ManualResult =
  | { action: "reuse"; itemId: string; matchedByBarcode?: true; attachBarcode?: string }
  | { action: "confirm"; suggestItemId: string; attachBarcode: string }
  | { action: "create"; attachBarcode: string }
  | { action: "name" };

export function resolveManualIdentity(
  input: { name: string; barcode: string | null },
  ctx: ManualCtx,
): ManualResult {
  if (input.barcode) {
    const hit = ctx.byBarcode.get(input.barcode);
    if (hit) return { action: "reuse", itemId: hit, matchedByBarcode: true };
    const res = resolveItem(input.name, ctx.existing);
    if (res.kind === "exact") return { action: "reuse", itemId: res.item.id, attachBarcode: input.barcode };
    if (res.kind === "suggest") return { action: "confirm", suggestItemId: res.item.id, attachBarcode: input.barcode };
    return { action: "create", attachBarcode: input.barcode };
  }
  return { action: "name" };
}
```

Then in the action, `addPurchase` gains an optional `barcode` arg: canonicalise it with `canonicalizeBarcode`, build `byBarcode` from `db.barcode.findMany`, call `resolveManualIdentity`, and:
- `reuse` → use itemId; if `attachBarcode` and unowned → `db.barcode.create`.
- `confirm` → return `{ needsConfirm, suggestItemId, barcode }` so the form can prompt (reuse the existing confirm UI); on confirm, attach barcode to the chosen item, on "new" create item + attach.
- `create` → create a new item (category via `guessCategory`) and attach the barcode.
- `name` → existing behaviour unchanged (no barcode supplied).

- [ ] **Step 4: Add the form field** — in `app/components/PurchaseForm.tsx`, add an optional numeric input labelled "Barcode (optional)" bound to state, passed to `addPurchase`. Read the current form first and follow its existing field pattern (label + input + state). Empty string → pass `null`.

- [ ] **Step 5: Run tests + typecheck, then commit**

Run: `cmd /c "npm run typecheck && npx vitest run tests/manual-barcode.test.ts"`
Expected: PASS.

```bash
git add app/actions/purchases.ts app/components/PurchaseForm.tsx tests/manual-barcode.test.ts
git commit -m "feat: optional barcode on manual entry with barcode-first matching"
```

---

## Task 8: Orphan-prune guard for barcode-owning items

**Files:**
- Modify: `app/actions/purchases.ts` (`deletePurchase`)
- Test: add a case to `tests/manual-barcode.test.ts` or a new `tests/orphan-prune.test.ts` (pure helper)

Design: extract the orphan decision into a pure helper `shouldDeleteOrphan(remainingPurchases: number, barcodeCount: number): boolean` → delete only when `remainingPurchases === 0 && barcodeCount === 0`.

- [ ] **Step 1: Failing test**

```ts
// tests/orphan-prune.test.ts
import { describe, it, expect } from "vitest";
import { shouldDeleteOrphan } from "@/lib/purchase-match";

describe("shouldDeleteOrphan", () => {
  it("deletes when no purchases and no barcodes", () => {
    expect(shouldDeleteOrphan(0, 0)).toBe(true);
  });
  it("keeps an item that still owns barcodes (taught mapping)", () => {
    expect(shouldDeleteOrphan(0, 2)).toBe(false);
  });
  it("keeps an item that still has purchases", () => {
    expect(shouldDeleteOrphan(3, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail.** `cmd /c "npx vitest run tests/orphan-prune.test.ts"`

- [ ] **Step 3: Implement** — add `shouldDeleteOrphan` to `lib/purchase-match.ts` (pure) and call it from `deletePurchase` in `app/actions/purchases.ts`:

```ts
/** An item is auto-removed only when it has no purchases AND no taught barcodes,
 *  so deleting a mis-entered purchase never destroys a barcode->item mapping. */
export function shouldDeleteOrphan(remainingPurchases: number, barcodeCount: number): boolean {
  return remainingPurchases === 0 && barcodeCount === 0;
}
```

Then in `deletePurchase`, after removing the purchase, count remaining purchases AND `db.barcode.count({ where: { itemId } })`, and gate the item deletion on `shouldDeleteOrphan(...)`.

- [ ] **Step 4: Run → pass.** `cmd /c "npm run typecheck && npx vitest run tests/orphan-prune.test.ts"`

- [ ] **Step 5: Commit**

```bash
git add app/actions/purchases.ts tests/orphan-prune.test.ts
git commit -m "fix: never auto-delete an item that still owns barcodes"
```

---

## Task 9: Review screen — offer toggle, editable name, same-as, no-barcode flag, detach

**Files:**
- Modify: `app/components/ReceiptImport.tsx`
- Test: manual/live (UI); logic already covered by Tasks 3–6.

Read the current `ReceiptImport.tsx` first and extend its draft-row rendering. Per row add:
1. **Editable name** input (already may exist) bound to draft state.
2. **On offer** checkbox → sets `draft.onOffer`.
3. **No-barcode flag:** compute `flagged = !draft.barcode && !nameMatchesExisting(draft.name)` (pass the existing item names to the client, or compute "matches an existing item" via a small server call already available; simplest: the parse result marks rows the server couldn't barcode — show a "check this" chip when `draft.barcode` is null). Show a subtle amber "check this" chip; do not block save.
4. **Recognised hint:** if `draft.barcode` is present and known (server can annotate each parsed draft with `knownItemName` by looking up `byBarcode` during `parseReceiptUpload`), show "→ files as **{knownItemName}**" and a **"not this item"** button that sets `draft.ignoreBarcodeMatch = true` (detach — C2).
5. **Same as my [X]:** when a row is new/renamed and fuzzy-matches an existing item, show "same as my {X}?"; accepting sets `draft.linkedItemId`.

To support (3)/(4), extend `parseReceiptUpload` to annotate each returned draft with `knownItemName: string | null` (barcode lookup) — add this in Task 6's action work if convenient, or here. Send `onOffer`, `barcode`, `linkedItemId`, `ignoreBarcodeMatch` in the `importReceipt` payload.

- [ ] **Step 1:** Read `app/components/ReceiptImport.tsx`; note the draft state shape and the save handler.
- [ ] **Step 2:** Add per-row `onOffer` checkbox + editable name wired to state; include `onOffer` and edited `name` in the import payload. 
- [ ] **Step 3:** Add the "check this" chip for `barcode === null` rows.
- [ ] **Step 4:** Add the "→ files as X / not this item" affordance using `knownItemName`; wire the detach flag.
- [ ] **Step 5:** Add the "same as my X?" accept → `linkedItemId`.
- [ ] **Step 6: Verify build + typecheck**

Run: `cmd /c "npm run typecheck && npm run build"`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add app/components/ReceiptImport.tsx app/actions/receipt.ts
git commit -m "feat: review screen — per-item offers, no-barcode flag, detach + same-as linking"
```

---

## Task 10: Backup/restore — barcodes with validation

**Files:**
- Modify: `lib/backup.ts`, `app/actions/backup.ts`
- Test: `tests/backup-barcode.test.ts`

Extend the backup shape with `barcodes: { code: string; itemName: string }[]`. `validateBackup` gains: canonicalise each `code` (reject nulls), drop duplicate codes within the file, keep only rows whose `itemName` resolves to a backed-up item on restore. Barcodes carry no DB ids.

- [ ] **Step 1: Failing test**

```ts
// tests/backup-barcode.test.ts
import { describe, it, expect } from "vitest";
import { validateBackup, CURRENT_BACKUP_VERSION } from "@/lib/backup";

const base = (over: any = {}) => ({
  app: "shelfie", schemaVersion: CURRENT_BACKUP_VERSION, exportedAt: new Date().toISOString(),
  items: [{ name: "Milk", category: "Dairy" }], purchases: [], budgets: [], barcodes: [], ...over,
});

describe("validateBackup barcodes", () => {
  it("keeps a valid barcode row", () => {
    const r = validateBackup(base({ barcodes: [{ code: "5000159407236", itemName: "Milk" }] }));
    expect(r.ok).toBe(true);
    expect(r.value.barcodes).toEqual([{ code: "05000159407236", itemName: "Milk" }]); // canonicalised
  });
  it("drops an invalid barcode (bad check digit)", () => {
    const r = validateBackup(base({ barcodes: [{ code: "5000159407237", itemName: "Milk" }] }));
    expect(r.ok).toBe(true);
    expect(r.value.barcodes).toEqual([]);
  });
  it("drops duplicate codes within the file (keeps first)", () => {
    const r = validateBackup(base({ barcodes: [
      { code: "5000159407236", itemName: "Milk" },
      { code: "05000159407236", itemName: "Other" },
    ] }));
    expect(r.value.barcodes).toHaveLength(1);
  });
  it("tolerates a missing barcodes array (old backup)", () => {
    const b = base(); delete (b as any).barcodes;
    const r = validateBackup(b);
    expect(r.ok).toBe(true);
    expect(r.value.barcodes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run → fail.** `cmd /c "npx vitest run tests/backup-barcode.test.ts"`

- [ ] **Step 3: Implement** — in `lib/backup.ts`: add `barcodes` to the backup type and to `validateBackup`'s field-by-field whitelist. Use `canonicalizeBarcode`; skip invalid; dedupe by canonical `code` (first wins). Do NOT bump `CURRENT_BACKUP_VERSION` (additive, older files simply have no `barcodes`). In `app/actions/backup.ts`: `buildBackup` includes `barcodes` as `{ code, itemName }` joined from `db.barcode` → `item.name`; `restoreBackup` recreates barcodes after items exist, resolving `itemName` → new item id, skipping unresolved and catching any duplicate-code write defensively.

- [ ] **Step 4: Run → pass + full suite.** `cmd /c "npm run typecheck && npx vitest run"`

- [ ] **Step 5: Commit**

```bash
git add lib/backup.ts app/actions/backup.ts tests/backup-barcode.test.ts
git commit -m "feat: back up & restore barcodes with validation and dedupe"
```

---

## Task 11: Offer exclusion regression guard

**Files:**
- Test: extend `tests/price-stats.test.ts` (no code change expected)

- [ ] **Step 1:** Add a test asserting that a purchase with `onOffer: true` is excluded from the best/benchmark computation and that an item with <3 non-offer samples returns the "not enough to judge" state (locks in the M5 decision).

```ts
// add to tests/price-stats.test.ts
it("on-offer purchases are excluded and can push an item below the judge gate", () => {
  const now = new Date("2026-07-12T00:00:00Z");
  const purchases = [
    { totalFils: 500, quantity: 1, unit: "each", onOffer: true,  purchasedAt: new Date("2026-07-01") },
    { totalFils: 900, quantity: 1, unit: "each", onOffer: false, purchasedAt: new Date("2026-06-01") },
  ] as any;
  const stats = computeStats(purchases, "each", now);
  expect(stats.enoughToJudge).toBe(false); // only 1 non-offer sample
});
```

- [ ] **Step 2: Run.** `cmd /c "npx vitest run tests/price-stats.test.ts"` — if it fails, the existing exclusion contract changed; investigate before adjusting. Expected: PASS with the current `price-stats.ts` logic (no code change).
- [ ] **Step 3: Commit**

```bash
git add tests/price-stats.test.ts
git commit -m "test: lock offer-exclusion + judge-gate behaviour for imported offers"
```

---

## Task 12: Full green + adversarial "break the build" + live verification

**Files:** none (verification gate).

- [ ] **Step 1: Whole suite + typecheck + build**

Run: `cmd /c "npx vitest run && npm run typecheck && npm run build"`
Expected: all tests pass, clean typecheck, successful build.

- [ ] **Step 2: Adversarial "break the build" pass** — dispatch a fresh Opus review agent to attack the *implementation* against the spec §11 cases (multi-buy same barcode; footer barcode; UPC/EAN equivalence; re-import after rename; detach; orphan prune with barcodes; backup dup codes; offer gate). Fix anything it finds with a new failing test → fix → commit.

- [ ] **Step 3: Deploy** — `git push origin main`; confirm the Vercel build goes Ready (`cmd /c "vercel inspect shelfie-gamma-seven.vercel.app"`), and that `2_add_barcode` applied (check the build log for `migrate deploy`).

- [ ] **Step 4: Live verification on the owner's iPhone (finish gate).** With the owner:
  1. Import a real receipt → barcodes captured silently; a genuinely barcode-less row shows "check this".
  2. Rename a cryptic row / mark one "on offer" / link one "same as my X" → save → items appear in Month/Prices; the offer item is excluded from its best-price benchmark.
  3. Import the SAME receipt again → duplicate warning (dedupe stable across the earlier rename).
  4. Manually add a purchase and type the barcode of an imported item → it links to the same item (no duplicate).
  5. Import a second receipt containing a previously-seen barcode → files under the friendly name automatically.
  Not "done" until all five pass on the real device.

- [ ] **Step 5: Update the hub + docs** — flip `progress.html` v2 items to done, add a short §17 to `MASTER-DOCUMENTATION.md` summarising v2, and update `HANDOVER.md`'s "current state / next task". Commit + push.

---

## Notes for the implementer
- **Read before editing:** `lib/receipt.ts`, `lib/items.ts`, `app/actions/receipt.ts`, `app/actions/purchases.ts`, `app/components/ReceiptImport.tsx`, `app/components/PurchaseForm.tsx` — follow the existing patterns (Server Actions, `router.refresh()`, toast conventions).
- **Barcodes are always strings.** Never `Number()` a barcode anywhere (client or server) — it drops leading zeros.
- **Privacy:** only `Barcode:`-prefixed lines directly under an item are captured; the server logs errors only, never file contents or barcodes.
- **DB-free locally:** all tests are pure; DB behaviour is exercised on Vercel via `migrate deploy` + the live verification in Task 12.
- **Merge tool** (fold pre-existing duplicates) and **camera scanning** are separate later plans — do NOT build them here.
