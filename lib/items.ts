export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[m][n];
}
function ratio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - lev(a, b) / max;
}
export type ItemRef = { id: string; name: string };
export type Resolution =
  | { kind: "exact"; item: ItemRef }
  | { kind: "suggest"; item: ItemRef; score: number }
  | { kind: "new" };

/** Significant words for matching — drop short size/qty tokens like "2l", "1", "kg". */
function sigTokens(s: string): string[] {
  return normalizeName(s).split(" ").filter((t) => t.length >= 3);
}

export function resolveItem(rawName: string, existing: ItemRef[], threshold = 0.82): Resolution {
  const norm = normalizeName(rawName);
  for (const e of existing) if (normalizeName(e.name) === norm) return { kind: "exact", item: e };
  const newTokens = new Set(sigTokens(rawName));
  let best: ItemRef | null = null, bestScore = 0;
  for (const e of existing) {
    const fuzzy = ratio(norm, normalizeName(e.name));
    // Owner choice: prompt whenever names share a base word (a size/pack variant of the
    // same product), not only for near-identical spellings. More shared words → stronger.
    const shared = sigTokens(e.name).filter((t) => newTokens.has(t)).length;
    const tokenScore = shared > 0 ? Math.min(0.99, 0.83 + 0.05 * shared) : 0;
    const sc = Math.max(fuzzy, tokenScore);
    if (sc > bestScore) { bestScore = sc; best = e; }
  }
  if (best && bestScore >= threshold) return { kind: "suggest", item: best, score: bestScore };
  return { kind: "new" };
}
