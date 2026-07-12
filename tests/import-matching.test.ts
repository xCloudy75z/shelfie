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
  it("conflict: owner links to item-milk but barcode is owned by item-pop", () => {
    const d = { name: "X", barcode: "05000159407236", linkedItemId: "item-milk" } as any;
    expect(resolveDraftIdentity(d, ctx())).toEqual({
      action: "conflict", ownedByItemId: "item-pop", itemId: "item-milk", attachBarcode: "05000159407236",
    });
  });
});
