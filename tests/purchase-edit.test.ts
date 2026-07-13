import { describe, it, expect } from "vitest";
import { isPurchaseDirty, type EditableFields } from "@/lib/purchase-edit";

const base: EditableFields = {
  price: "4.99",
  qty: "1",
  store: "Carrefour",
  date: "2026-07-09",
  onOffer: false,
};

describe("isPurchaseDirty", () => {
  it("is false when nothing changed", () => {
    expect(isPurchaseDirty(base, { ...base })).toBe(false);
  });
  it("detects a price change", () => {
    expect(isPurchaseDirty(base, { ...base, price: "5.00" })).toBe(true);
  });
  it("detects a qty change", () => {
    expect(isPurchaseDirty(base, { ...base, qty: "2" })).toBe(true);
  });
  it("detects a store change", () => {
    expect(isPurchaseDirty(base, { ...base, store: "Lulu" })).toBe(true);
  });
  it("detects a date change", () => {
    expect(isPurchaseDirty(base, { ...base, date: "2026-07-10" })).toBe(true);
  });
  it("detects an offer toggle", () => {
    expect(isPurchaseDirty(base, { ...base, onOffer: true })).toBe(true);
  });
});
