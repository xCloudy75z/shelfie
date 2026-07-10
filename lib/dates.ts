const TZ = "Asia/Dubai";
function dubaiParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return { y: parts.year, m: parts.month, d: parts.day };
}
export function dubaiMonthKey(d: Date = new Date()): string {
  const { y, m } = dubaiParts(d);
  return `${y}-${m}`;
}
export function dubaiToday(d: Date = new Date()): string {
  const { y, m, d: day } = dubaiParts(d);
  return `${y}-${m}-${day}`;
}
export function monthKeyToLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" }) + " " + y;
}
