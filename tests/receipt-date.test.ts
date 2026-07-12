import { describe, it, expect } from "vitest";
import { extractReceiptDate } from "@/lib/receipt";
describe("extractReceiptDate", () => {
  it("DD/MM/YYYY", () => expect(extractReceiptDate(["Carrefour", "26/06/2026 14:32", "..."])).toBe("2026-06-26"));
  it("DD-MM-YYYY", () => expect(extractReceiptDate(["26-06-2026"])).toBe("2026-06-26"));
  it("DD.MM.YYYY", () => expect(extractReceiptDate(["Date : 26.06.2026"])).toBe("2026-06-26"));
  it("DD Mon YYYY", () => expect(extractReceiptDate(["26 Jun 2026"])).toBe("2026-06-26"));
  it("interprets day-first even when ambiguous (UAE)", () => expect(extractReceiptDate(["06/07/2026"])).toBe("2026-07-06"));
  it("uses MM/DD only when the first field can't be a day (>12)", () => expect(extractReceiptDate(["Printed 13/06/2026"])).toBe("2026-06-13"));
  it("handles 2-digit year", () => expect(extractReceiptDate(["26/06/26"])).toBe("2026-06-26"));
  it("returns null when no date present", () => expect(extractReceiptDate(["Carrefour", "MILK 1 5.50"])).toBeNull());
  it("rejects an impossible date", () => expect(extractReceiptDate(["99/99/2026"])).toBeNull());
});
