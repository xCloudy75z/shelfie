// tests/orphan-prune.test.ts
import { describe, it, expect } from "vitest";
import { shouldDeleteOrphan } from "@/lib/purchase-match";

describe("shouldDeleteOrphan", () => {
  it("deletes when no purchases and no barcodes", () => {
    expect(shouldDeleteOrphan(0, 0)).toBe(true);
  });
  it("keeps an item that still owns barcodes (taught mapping)", () => {
    expect(shouldDeleteOrphan(0, 2)).toBe(false);
  });
  it("keeps an item that still has purchases", () => {
    expect(shouldDeleteOrphan(3, 0)).toBe(false);
  });
});
