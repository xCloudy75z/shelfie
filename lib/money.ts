/** All money is stored as integer fils. 1 AED = 100 fils. */
export function filsFromAed(aed: string | number): number {
  const n = typeof aed === "string" ? parseFloat(aed) : aed;
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}
export function aedFromFils(fils: number): number {
  return Math.round(fils) / 100;
}
export function formatAed(fils: number): string {
  const aed = aedFromFils(fils);
  return "AED " + aed.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
