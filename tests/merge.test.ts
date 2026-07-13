import { describe, it, expect } from "vitest";
import { validateMerge } from "@/lib/merge";

const ids = new Set(["a", "b", "c"]);

describe("validateMerge", () => {
  it("accepts two distinct existing items", () => {
    expect(validateMerge("a", "b", ids)).toEqual({ ok: true });
  });
  it("rejects merging an item into itself", () => {
    expect(validateMerge("a", "a", ids)).toEqual({ error: "Can't merge an item into itself." });
  });
  it("rejects an unknown survivor or merged id", () => {
    expect("error" in validateMerge("a", "z", ids)).toBe(true);
    expect("error" in validateMerge("z", "a", ids)).toBe(true);
  });
  it("rejects empty ids", () => {
    expect("error" in validateMerge("", "b", ids)).toBe(true);
  });
});
