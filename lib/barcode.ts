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
