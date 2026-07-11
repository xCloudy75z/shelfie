import { describe, it, expect } from "vitest";
import { parseReceipt } from "@/lib/receipt";

const LINES = [
  "Description Qty Unit Price Incl Unit Price Excl. Total Price Excl VAT Rate VAT Amount Tot Price Incl VAT",
  "WATER 1.5L X 6 6.0 4.99 4.75 28.51 5.00 1.43 29.94",
  "Barcode: 1234567890123",
  "CHEESE BLOCK 500G 1.0 18.99 18.09 18.09 5.00 0.90 18.99",
  "Barcode: 9876543210000",
  "TOMATO EP 0.62 6.98 6.65 4.12 5.00 0.21 4.33",
  "Barcode: 5555555555555",
  "Total Amount Incl. VAT AED 53.26",
  "Amount : AED 53.26",
];

describe("parseReceipt", () => {
  it("parses each item row into name/qty/unit/unitPrice/lineTotal", () => {
    const r = parseReceipt(LINES);
    expect(r.items).toHaveLength(3);
    expect(r.items[0]).toMatchObject({ name: "WATER 1.5L X 6", quantity: 6, unit: "each", unitPriceFils: 499, lineFils: 2994 });
    expect(r.items[1]).toMatchObject({ name: "CHEESE BLOCK 500G", unit: "each", lineFils: 1899 });
  });
  it("detects weighed items (fractional qty) as kg", () => {
    const r = parseReceipt(LINES);
    expect(r.items[2]).toMatchObject({ name: "TOMATO EP", quantity: 0.62, unit: "kg", unitPriceFils: 698, lineFils: 433 });
  });
  it("reads the grand total and self-checks the sum", () => {
    const r = parseReceipt(LINES);
    expect(r.grandTotalFils).toBe(5326);
    expect(r.sumFils).toBe(5326);
    expect(r.matchesTotal).toBe(true);
  });
  it("skips barcode/header/total lines (no false items)", () => {
    const r = parseReceipt(LINES);
    expect(r.items.every((i) => !/barcode/i.test(i.name))).toBe(true);
  });
  it("flags a mismatch when lines don't sum to the grand total", () => {
    const bad = [...LINES.slice(0, 7), "Total Amount Incl. VAT AED 99.99"];
    const r = parseReceipt(bad);
    expect(r.matchesTotal).toBe(false);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("returns empty items for junk input", () => {
    expect(parseReceipt(["hello", "world"]).items).toHaveLength(0);
  });
});
