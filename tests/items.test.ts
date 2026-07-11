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

  // Owner choice 2026-07-11: prompt whenever a new name shares a base word,
  // so size/pack variants pause and ask "is this the same?" rather than duplicating silently.
  it("suggests when a size variant shares a base word", () => {
    const r = resolveItem("Milk 2L", [{ id: "m", name: "Milk" }]);
    expect(r.kind).toBe("suggest");
    if (r.kind === "suggest") expect(r.item.id).toBe("m");
  });
  it("suggests the base item when logging a shorter shared name", () => {
    const r = resolveItem("Milk", [{ id: "m", name: "Milk 2L" }]);
    expect(r.kind).toBe("suggest");
    if (r.kind === "suggest") expect(r.item.id).toBe("m");
  });
  it("still treats an unrelated item (no shared base word) as new", () => {
    expect(resolveItem("Salt", [{ id: "m", name: "Milk" }]).kind).toBe("new");
  });
  it("ignores short size tokens (2l, 1) as shared words", () => {
    // "2l" is too short to count as a shared base word on its own
    const r = resolveItem("Sugar 2L", [{ id: "m", name: "Milk 2L" }]);
    expect(r.kind).toBe("new");
  });
});
