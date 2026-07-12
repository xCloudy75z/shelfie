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
