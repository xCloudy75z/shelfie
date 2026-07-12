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
