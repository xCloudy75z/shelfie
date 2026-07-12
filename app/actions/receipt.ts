"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeName, resolveItem } from "@/lib/items";
import { dubaiMonthKey } from "@/lib/dates";
import { guessCategory } from "@/lib/categories";
import { parseReceipt, type ParsedReceipt } from "@/lib/receipt";
import { resolveDraftIdentity } from "@/lib/receipt-match";

// Cap on the uploaded PDF size. Carrefour receipts are a few hundred KB; 10MB
// is a generous ceiling that still refuses anything that isn't a small receipt.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Per-row recognition hints the review screen uses to flag / recognise / suggest.
 * Index-aligned to `parsed.items`. Types are erased at build, so exporting this
 * from a `"use server"` module is fine (only functions must be async).
 */
export type Hint = {
  /** Name of the item that already owns this row's barcode, else null. */
  knownItemName: string | null;
  /** True when this row's name normalizes to an item we already track. */
  nameKnown: boolean;
  /** A fuzzy "same as my X?" candidate — only when there's no barcode/name match. */
  suggestItemId: string | null;
  suggestName: string | null;
};

export type ParseReceiptUploadResult =
  | { ok: true; parsed: ParsedReceipt; hints: Hint[] }
  | { error: string };

/**
 * Read an uploaded Carrefour receipt PDF on the server and return the parsed
 * items for the user to review. Extraction runs in Node (main-thread pdf.js),
 * which is reliable where the iOS-Safari browser path hangs.
 *
 * Stores NOTHING: the PDF buffer is discarded when this function returns. The
 * separate `importReceipt` action does the actual saving after the user reviews.
 */
export async function parseReceiptUpload(
  formData: FormData,
): Promise<ParseReceiptUploadResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file received — please pick your Carrefour receipt PDF." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "That file is too large — receipts are only a few hundred KB." };
  }

  const buf = new Uint8Array(await file.arrayBuffer());

  let lines: string[];
  try {
    // Dynamic import keeps pdfjs-dist out of any bundle that doesn't need it and
    // loads it only from node_modules inside the serverless function.
    const { extractReceiptLinesServer } = await import(
      "@/lib/receipt-extract-server"
    );
    lines = await extractReceiptLinesServer(buf);
  } catch (err) {
    // Instrumentation only: surface the REAL extraction failure in the server
    // logs so it can be diagnosed. Logs the error (name/message/stack) ONLY —
    // never the uploaded file's bytes or extracted text, to honour the privacy
    // rule. Safe to keep; can be tidied once extraction is reliable on Vercel.
    console.error(
      "[parseReceiptUpload] extraction failed:",
      err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : err,
    );
    return { error: "Couldn't read that PDF — is it the Carrefour receipt?" };
  }

  const parsed = parseReceipt(lines);

  // Build recognition hints so the review screen can recognise / flag / suggest
  // each row. Read-only lookups against existing items + taught barcodes.
  const existing = await db.item.findMany({ select: { id: true, name: true } });
  const nameById = new Map(existing.map((e) => [e.id, e.name] as const));
  const byNormName = new Set(existing.map((e) => normalizeName(e.name)));
  const barcodes = await db.barcode.findMany({ select: { code: true, itemId: true } });
  const byBarcode = new Map(barcodes.map((b) => [b.code, b.itemId] as const));

  const hints: Hint[] = parsed.items.map((it) => {
    const ownerId = it.barcode ? byBarcode.get(it.barcode) ?? null : null;
    const knownItemName = ownerId ? nameById.get(ownerId) ?? null : null;
    const nameKnown = byNormName.has(normalizeName(it.name));

    // Only offer a "same as my X?" link when neither the barcode nor an exact
    // name already resolves this row — otherwise it's already handled.
    let suggestItemId: string | null = null;
    let suggestName: string | null = null;
    if (!ownerId && !nameKnown) {
      const res = resolveItem(it.name, existing);
      if (res.kind === "suggest") {
        suggestItemId = res.item.id;
        suggestName = res.item.name;
      }
    }
    return { knownItemName, nameKnown, suggestItemId, suggestName };
  });

  return { ok: true, parsed, hints };
}

/** One reviewed receipt line ready to import. Barcode drives identity. */
export type ImportDraft = {
  name: string;
  quantity: number;
  unit: "each" | "kg";
  lineFils: number;
  barcode: string | null;        // canonical GTIN-14 or null
  onOffer: boolean;              // per-item toggle
  linkedItemId?: string;        // owner "same as my [X]"
  ignoreBarcodeMatch?: boolean; // owner tapped "not this item / detach"
};

export type ImportReceiptInput = {
  items: ImportDraft[];
  grandTotalFils: number | null;
  fingerprint: string;        // barcode-based, raw parse
  legacyFingerprint: string;  // old name-based, raw parse
  /** ISO date string; defaults to now when omitted. */
  purchasedAt?: string;
  /** Skip the duplicate check and import anyway. */
  force?: boolean;
};

export type ImportReceiptResult =
  | { ok: true; imported: number; warnings?: string[] }
  | { duplicate: true; when: string }
  | { error: string };

/**
 * Create the barcode->item mapping if that code isn't already owned (this run or
 * in the DB). A no-op when the code is already registered, which makes buying
 * the same barcoded product twice on one receipt safe.
 */
async function attachBarcode(
  tx: Prisma.TransactionClient,
  code: string,
  itemId: string,
  seen: Set<string>,
  byBarcode: Map<string, string>,
): Promise<void> {
  if (seen.has(code) || byBarcode.has(code)) return; // already owned -> no-op
  await tx.barcode.create({ data: { code, itemId } });
  seen.add(code);
  byBarcode.set(code, itemId);
}

/**
 * Import a whole reviewed Carrefour receipt in one shot.
 *
 * Duplicate protection: the client sends a stable `fingerprint` for the trip.
 * Unless `force` is set, a matching `ReceiptImport` row means this PDF was
 * already imported — we return `{ duplicate, when }` and write nothing.
 *
 * Item identity: each draft row resolves against existing items by EXACT
 * normalized name only. A 30-row receipt can't stop to confirm fuzzy
 * suggestions, so anything without an exact match becomes a brand-new item.
 * (Cross-naming with manually-logged items is reconciled by the Plan 3 merge
 * tool, not here.)
 *
 * The ReceiptImport row plus all its purchases are written inside a single
 * transaction, so a mid-way failure never leaves a half-imported trip.
 */
export async function importReceipt(
  input: ImportReceiptInput,
): Promise<ImportReceiptResult> {
  const { items, grandTotalFils } = input;

  // --- Validate (defense in depth; the client already parsed/validated) ---
  if (!items || items.length === 0) return { error: "No items to import." };
  for (const it of items) {
    if (!Number.isFinite(it.lineFils) || it.lineFils <= 0) {
      return { error: `Invalid line total for "${it.name}".` };
    }
    if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
      return { error: `Invalid quantity for "${it.name}".` };
    }
  }

  try {
  // --- Dedupe (dual key) ---
  // Check BOTH the new barcode-based fingerprint and the pre-v2 name-based one,
  // so a receipt imported before v2 still de-dupes on re-import.
  // F7 limitation: a pre-v2 receipt whose rows were RENAMED before saving stored
  // a hash of the edited names, so its legacy fingerprint won't match a fresh
  // raw parse — that narrow case may not dedupe. Acceptable, documented here.
  if (!input.force) {
    const existingImport = await db.receiptImport.findFirst({
      where: { fingerprint: { in: [input.fingerprint, input.legacyFingerprint] } },
      select: { importedAt: true },
    });
    if (existingImport) {
      return { duplicate: true, when: existingImport.importedAt.toISOString() };
    }
  }

  // When forcing a re-import, a row with this fingerprint may already exist;
  // recompute a fresh, non-colliding fingerprint so the @unique doesn't clash.
  let fingerprint = input.fingerprint;
  if (input.force) {
    const clash = await db.receiptImport.findUnique({
      where: { fingerprint },
      select: { id: true },
    });
    if (clash) fingerprint = `${input.fingerprint}-${Date.now()}`;
  }

  const totalFils =
    grandTotalFils ?? items.reduce((sum, it) => sum + it.lineFils, 0);
  const purchasedAt = input.purchasedAt ? new Date(input.purchasedAt) : new Date();
  const monthKey = dubaiMonthKey(purchasedAt);

  // Resolve identities BEFORE opening the transaction. Prisma's interactive
  // transaction has a short default timeout; doing the reads up front and only
  // writing inside keeps the transaction fast and atomic.
  //   byName    normalized name -> itemId (exact-name reuse)
  //   byBarcode canonical code  -> itemId (barcode is authoritative identity)
  const existingItems = await db.item.findMany({ select: { id: true, name: true } });
  const byName = new Map(existingItems.map((e) => [normalizeName(e.name), e.id] as const));
  const existingBarcodes = await db.barcode.findMany({ select: { code: true, itemId: true } });
  const byBarcode = new Map(existingBarcodes.map((b) => [b.code, b.itemId] as const));

  const warnings: string[] = [];

  await db.$transaction(async (tx) => {
    const receiptImport = await tx.receiptImport.create({
      data: { fingerprint, store: "Carrefour", totalFils },
    });

    // Cache created categories within this run so repeated categories don't hit
    // the unique constraint twice. `byName`/`byBarcode` double as per-run caches.
    const categoryCache = new Map<string, string>();
    const seenBarcodes = new Set<string>();

    for (const draft of items) {
      const resolved = resolveDraftIdentity(draft, { byBarcode, byName });

      let itemId: string;
      if (resolved.action === "reuse") {
        itemId = resolved.itemId;
        if (resolved.attachBarcode) {
          await attachBarcode(tx, resolved.attachBarcode, itemId, seenBarcodes, byBarcode);
        }
      } else if (resolved.action === "conflict") {
        // The barcode is already owned by a DIFFERENT item than the one the user
        // linked. Barcode is authoritative: import under the existing owner and
        // tell the user, rather than crashing or silently ignoring their choice.
        itemId = resolved.ownedByItemId;
        warnings.push(
          `"${draft.name}" was filed under the item that already owns barcode ${resolved.attachBarcode}, not the one you picked.`,
        );
      } else {
        // create: new item (+ category), register it so later rows can reuse it.
        const catName = guessCategory(draft.name);
        let categoryId = categoryCache.get(catName);
        if (!categoryId) {
          const cat = await tx.category.upsert({
            where: { name: catName },
            update: {},
            create: { name: catName },
          });
          categoryId = cat.id;
          categoryCache.set(catName, categoryId);
        }
        const created = await tx.item.create({
          data: { name: draft.name.trim(), normalized: normalizeName(draft.name), categoryId },
          select: { id: true },
        });
        itemId = created.id;
        byName.set(normalizeName(draft.name), itemId);
        if (resolved.attachBarcode) {
          await attachBarcode(tx, resolved.attachBarcode, itemId, seenBarcodes, byBarcode);
        }
      }

      await tx.purchase.create({
        data: {
          itemId,
          totalFils: draft.lineFils,
          quantity: draft.quantity,
          unit: draft.unit,
          store: "Carrefour",
          onOffer: draft.onOffer,
          purchasedAt,
          monthKey,
          importId: receiptImport.id,
        },
      });
    }
  }, {
    // A ~30-item receipt does ~90 sequential writes (item + barcode + purchase per
    // row) to Neon; the default 5s interactive-transaction timeout is too tight
    // (observed 5269ms). Give generous headroom — the real work is only ~5-6s.
    timeout: 20000,
    maxWait: 10000,
  });

  revalidatePath("/month");
  revalidatePath("/prices");
  revalidatePath("/log");
  return warnings.length > 0
    ? { ok: true, imported: items.length, warnings }
    : { ok: true, imported: items.length };
  } catch (err) {
    // Instrumentation: surface the REAL save failure in the Vercel logs (error
    // name/message/stack only — never item/barcode data). A graceful catch also
    // beats an unhandled throw, which would give the user a generic crash.
    console.error(
      "[importReceipt] failed:",
      err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : err,
    );
    return { error: "Couldn't save that receipt — please try again." };
  }
}
