import { describe, it, expect } from "vitest";
import { normalizeName, resolveItem } from "@/lib/items";

const existing = [
  { id: "1", name: "Almarai Milk 2L" },
  { id: "2", name: "Brown Bread" },
];

describe("items", () => {
  it("normalizes case/punctuation/whitespace", () => {
    expect(normalizeName("  Almarai  MILK 2L! ")).toBe("almarai milk 2l");
  });
  it("returns exact match on normalized equality", () => {
    expect(resolveItem("almarai milk 2l", existing)).toEqual({ kind: "exact", item: existing[0] });
  });
  it("suggests a close match instead of creating a junk item", () => {
    const r = resolveItem("almarai milk 2ltr", existing); // typo/variant
    expect(r.kind).toBe("suggest");
    if (r.kind === "suggest") expect(r.item.id).toBe("1");
  });
  it("treats a clearly different name as new", () => {
    expect(resolveItem("chicken breast", existing).kind).toBe("new");
  });
});
