import { describe, it, expect } from "vitest";
import { hashPin, verifyPin } from "@/lib/auth";

describe("pin hashing", () => {
  it("verifies a correct pin and rejects a wrong one", async () => {
    const { hash, salt } = await hashPin("1234");
    expect(await verifyPin("1234", hash, salt)).toBe(true);
    expect(await verifyPin("9999", hash, salt)).toBe(false);
  });

  it("produces a unique salt per hash", async () => {
    const a = await hashPin("1234");
    const b = await hashPin("1234");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});
