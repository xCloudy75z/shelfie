// lib/barcode.ts
// Product barcodes from receipts and manual entry. Canonical form = 14 digits,
// left-padded with zeros, so a 12-digit UPC and its zero-padded 13/14-digit form
// map to the SAME key (one product = one identity). Always a STRING — never pass
// a barcode through Number(), which would drop leading zeros.
//
// NOTE: we deliberately do NOT validate a GTIN mod-10 check digit. Real Carrefour
// receipt barcodes (e.g. the 12-digit code 071727355039) often don't satisfy it,
// and requiring it silently discarded every barcode — defeating the feature
// entirely (found in live testing 2026-07-12). We accept any 8–14 digit run as-is;
// the only sources are a receipt "Barcode:" line or a user-typed barcode, so a
// stray non-barcode number is unlikely.

/**
 * Return the canonical 14-digit string for a raw barcode, or null if it has no
 * usable 8–14 digit code. Strips non-digit characters, then left-pads to 14.
 */
export function canonicalizeBarcode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 14) return null;
  return digits.padStart(14, "0");
}
