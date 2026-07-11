const TZ = "Asia/Dubai";
function dubaiParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return { y: parts.year, m: parts.month, d: parts.day };
}
/**
 * Pay-cycle month key. A cycle runs from the 25th of the previous calendar
 * month to the 24th of the labelled month, in Asia/Dubai time. So a Dubai
 * day-of-month >= 25 belongs to the NEXT month's cycle; <= 24 stays in the
 * current month. Returns "YYYY-MM" of the cycle's ending month.
 */
export function dubaiMonthKey(d: Date = new Date()): string {
  const { y, m, d: day } = dubaiParts(d);
  let year = Number(y);
  let month = Number(m); // 1-12
  if (Number(day) >= 25) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * The inclusive date range covered by a pay-cycle key. For "2026-07":
 * start = 2026-06-25, end = 2026-07-24, days = 30 (inclusive). The end is the
 * 24th of the key's month; the start is the 25th of the previous calendar month
 * (year rolls back for January).
 */
export function cycleRange(monthKey: string): { start: string; end: string; days: number } {
  const [y, m] = monthKey.split("-").map(Number);
  // End = 24th of the key's month.
  const endD = new Date(Date.UTC(y, m - 1, 24));
  // Start = 25th of the previous calendar month.
  const startD = new Date(Date.UTC(y, m - 2, 25));
  const iso = (dt: Date) =>
    `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
      dt.getUTCDate(),
    ).padStart(2, "0")}`;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const days = Math.round((endD.getTime() - startD.getTime()) / MS_PER_DAY) + 1;
  return { start: iso(startD), end: iso(endD), days };
}
export function dubaiToday(d: Date = new Date()): string {
  const { y, m, d: day } = dubaiParts(d);
  return `${y}-${m}-${day}`;
}
export function monthKeyToLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" }) + " " + y;
}
