import { describe, it, expect } from "vitest";
import { filsFromAed, parsePriceFils, aedFromFils, formatAed } from "@/lib/money";

describe("money", () => {
  it("converts AED string/number to whole fils", () => {
    expect(filsFromAed("5.75")).toBe(575);
    expect(filsFromAed(5.75)).toBe(575);
    expect(filsFromAed("0.05")).toBe(5);
    expect(filsFromAed("10")).toBe(1000);
  });
  it("rounds to nearest fils (no float drift)", () => {
    expect(filsFromAed("5.999")).toBe(600);
    expect(filsFromAed("0.014")).toBe(1);
  });
  it("converts fils back to AED number", () => {
    expect(aedFromFils(575)).toBe(5.75);
  });
  it("formats fils as AED string", () => {
    expect(formatAed(575)).toBe("AED 5.75");
    expect(formatAed(100000)).toBe("AED 1,000.00");
  });
});

describe("parsePriceFils", () => {
  it("parses a valid positive price to whole fils", () => {
    expect(parsePriceFils("5.75")).toBe(575);
    expect(parsePriceFils("0.05")).toBe(5);
  });
  it("rejects zero, blank, non-numeric and negative input", () => {
    expect(parsePriceFils("0")).toBeNull();
    expect(parsePriceFils("")).toBeNull();
    expect(parsePriceFils("abc")).toBeNull();
    expect(parsePriceFils("-5")).toBeNull();
  });
});
