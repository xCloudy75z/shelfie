import { describe, it, expect } from "vitest";
import { dubaiMonthKey, dubaiToday, monthKeyToLabel, cycleRange } from "@/lib/dates";

describe("dates (Asia/Dubai, pay-cycle 25th → 24th)", () => {
  it("buckets by pay cycle: day >= 25 belongs to the next month", () => {
    // 25 Jun 2026 Dubai -> July cycle
    // 2026-06-24T21:00:00Z == 2026-06-25 01:00 Dubai (+4) -> "2026-07"
    expect(dubaiMonthKey(new Date("2026-06-24T21:00:00Z"))).toBe("2026-07");
    // 24 Jun 2026 Dubai (2026-06-24T10:00Z == 14:00 Dubai) -> "2026-06"
    expect(dubaiMonthKey(new Date("2026-06-24T10:00:00Z"))).toBe("2026-06");
    // 24 Jul 2026 Dubai -> "2026-07"
    expect(dubaiMonthKey(new Date("2026-07-24T10:00:00Z"))).toBe("2026-07");
    // 25 Jul 2026 Dubai -> "2026-08"
    expect(dubaiMonthKey(new Date("2026-07-25T10:00:00Z"))).toBe("2026-08");
  });

  it("rolls the year: 25 Dec belongs to next January's cycle", () => {
    // 25 Dec 2026 Dubai -> "2027-01"
    expect(dubaiMonthKey(new Date("2026-12-25T10:00:00Z"))).toBe("2027-01");
  });

  it("a late-night UTC instant that crosses into the 25th buckets to the next cycle", () => {
    // 2026-06-24T21:00:00Z == 2026-06-25 01:00 Dubai -> "2026-07"
    expect(dubaiMonthKey(new Date("2026-06-24T21:00:00Z"))).toBe("2026-07");
  });

  it("labels a cycle by its ending month", () => {
    expect(monthKeyToLabel("2026-07")).toBe("July 2026");
  });

  it("dubaiToday returns the plain Dubai calendar date (unchanged)", () => {
    // 2026-07-31T21:00:00Z == 2026-08-01 01:00 Dubai
    expect(dubaiToday(new Date("2026-07-31T21:00:00Z"))).toBe("2026-08-01");
  });

  it("cycleRange gives 25th-of-prev to 24th-of-key with inclusive day count", () => {
    expect(cycleRange("2026-07")).toEqual({
      start: "2026-06-25",
      end: "2026-07-24",
      days: 30,
    });
  });

  it("cycleRange rolls the year for January", () => {
    expect(cycleRange("2026-01")).toEqual({
      start: "2025-12-25",
      end: "2026-01-24",
      days: 31,
    });
  });
});
