// tests/manual-barcode.test.ts
import { describe, it, expect } from "vitest";
import { resolveManualIdentity } from "@/lib/purchase-match";

const ctx = () => ({
  byBarcode: new Map<string, string>([["05000159407236", "item-pop"]]),
  // resolveItem-style existing items:
  existing: [{ id: "item-milk", name: "Milk" }],
  itemsOwningBarcode: new Set<string>(), // item-milk owns no barcode in the base ctx
});

describe("resolveManualIdentity", () => {
  it("known barcode -> reuse that item, ignore typed name", () => {
    const r = resolveManualIdentity({ name: "random", barcode: "05000159407236" }, ctx());
    expect(r).toEqual({ action: "reuse", itemId: "item-pop", matchedByBarcode: true });
  });
  it("new barcode + exact name -> attach barcode to that item", () => {
    const r = resolveManualIdentity({ name: "Milk", barcode: "07350053850019" }, ctx());
    expect(r).toEqual({ action: "reuse", itemId: "item-milk", attachBarcode: "07350053850019" });
  });
  it("new barcode + fuzzy name -> confirm prompt, carry barcode", () => {
    const r = resolveManualIdentity({ name: "Milk 2L", barcode: "07350053850019" }, ctx());
    expect(r).toEqual({ action: "confirm", suggestItemId: "item-milk", attachBarcode: "07350053850019" });
  });
  it("new barcode + exact name whose item ALREADY owns a barcode -> create new (§11.3)", () => {
    const c = { ...ctx(), itemsOwningBarcode: new Set<string>(["item-milk"]) };
    const r = resolveManualIdentity({ name: "Milk", barcode: "07350053850019" }, c);
    expect(r).toEqual({ action: "create", attachBarcode: "07350053850019" });
  });
  it("new barcode + no name match -> create a new item carrying the barcode", () => {
    const r = resolveManualIdentity({ name: "Pistachios", barcode: "07350053850019" }, ctx());
    expect(r).toEqual({ action: "create", attachBarcode: "07350053850019" });
  });
  it("no barcode -> defer to existing name resolution (action: name)", () => {
    const r = resolveManualIdentity({ name: "Milk 2L", barcode: null }, ctx());
    expect(r).toEqual({ action: "name" });
  });
});
