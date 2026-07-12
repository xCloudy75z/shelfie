import { describe, it, expect } from "vitest";
import { guessCategory, normalizeCategoryName, isReservedCategoryName } from "@/lib/categories";

describe("guessCategory", () => {
  it("matches known keywords", () => {
    expect(guessCategory("Al Marai Milk FF 1")).toBe("Dairy");
    expect(guessCategory("Brown Bread")).toBe("Bakery");
    expect(guessCategory("Fresh Bananas")).toBe("Produce");
  });
  it("returns null for anything it can't place (was 'Groceries')", () => {
    expect(guessCategory("AG PCORN")).toBeNull();
    expect(guessCategory("Basmati Rice 5kg")).toBeNull();
    expect(guessCategory("")).toBeNull();
  });
});

describe("normalizeCategoryName", () => {
  it("trims and collapses inner whitespace", () => {
    expect(normalizeCategoryName("  Frozen   Foods ")).toBe("Frozen Foods");
  });
  it("returns null for empty/whitespace", () => {
    expect(normalizeCategoryName("   ")).toBeNull();
    expect(normalizeCategoryName("")).toBeNull();
  });
});

describe("isReservedCategoryName", () => {
  it("reserves Uncategorized and Other, case-insensitively", () => {
    expect(isReservedCategoryName("Uncategorized")).toBe(true);
    expect(isReservedCategoryName("uncategorized")).toBe(true);
    expect(isReservedCategoryName("OTHER")).toBe(true);
    expect(isReservedCategoryName("Dairy")).toBe(false);
  });
});
