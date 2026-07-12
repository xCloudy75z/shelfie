// tests/barcode.test.ts
import { describe, it, expect } from "vitest";
import { canonicalizeBarcode, displayBarcode } from "@/lib/barcode";

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
  it("accepts a code even if it fails the GTIN check digit (Carrefour codes often do)", () => {
    // 071727355039 is a real Carrefour receipt barcode whose check digit is not
    // GTIN-valid; we still accept it so it can be stored and matched.
    expect(canonicalizeBarcode("071727355039")).toBe("00071727355039");
    expect(canonicalizeBarcode("5000159407237")).toBe("05000159407237");
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
  it("treats an all-zero code as not usable → '' (nothing renders)", () => {
    // canonicalizeBarcode("00000000") is non-null (8 digits), so this can reach
    // the UI; displayBarcode must return "" so BarcodeLine renders nothing.
    expect(displayBarcode("00000000")).toBe("");
    expect(displayBarcode("00000000000000")).toBe("");
  });
  it("returns >14 significant digits as-is (never seen from canonical)", () => {
    expect(displayBarcode("123456789012345")).toBe("123456789012345");
  });
});
