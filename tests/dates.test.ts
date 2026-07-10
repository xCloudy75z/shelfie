import { describe, it, expect } from "vitest";
import { dubaiMonthKey, dubaiToday, monthKeyToLabel } from "@/lib/dates";

describe("dates (Asia/Dubai)", () => {
  it("buckets a late-night purchase into the correct Dubai month", () => {
    // 2026-07-31T21:00:00Z == 2026-08-01 01:00 Dubai (+4) -> August
    expect(dubaiMonthKey(new Date("2026-07-31T21:00:00Z"))).toBe("2026-08");
    // 2026-07-31T18:00:00Z == 2026-07-31 22:00 Dubai -> July
    expect(dubaiMonthKey(new Date("2026-07-31T18:00:00Z"))).toBe("2026-07");
  });
  it("labels a month key", () => {
    expect(monthKeyToLabel("2026-07")).toBe("July 2026");
  });
  it("dubaiToday returns YYYY-MM-DD in Dubai", () => {
    expect(dubaiToday(new Date("2026-07-31T21:00:00Z"))).toBe("2026-08-01");
  });
});
