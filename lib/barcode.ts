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
