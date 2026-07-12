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
