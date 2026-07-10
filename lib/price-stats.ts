export type PurchaseInput = {
  totalFils: number;
  quantity: number;
  unit: string;
  onOffer: boolean;
  store: string;
  purchasedAt: Date;
};
export type Stats = {
  unit: string;
  count: number;
  enoughToJudge: boolean;
  lastFils: number;              // unit price, most recent
  bestFils: number;              // all-time min unit price (incl. offers) — display
  benchmarkBestFils: number;     // min unit price, non-offer & within window — for verdict (0 if none)
  benchmarkAvgFils: number;      // avg unit price, non-offer & within window (0 if none)
  avgFils: number;               // alias of benchmarkAvgFils (windowed avg) — used by UI/tests
  highestFils: number;
  lastStore: string;
  lastDate: Date;
};
const WINDOW_MS = 365 * 24 * 60 * 60 * 1000; // rolling 12 months for the benchmark
const MIN_SAMPLE = 3;

function unitFils(p: PurchaseInput): number {
  const q = p.quantity > 0 ? p.quantity : 1;
  return Math.round(p.totalFils / q);
}

/**
 * Compute an item's price stats. `now` anchors the rolling benchmark window to the
 * caller's current time (Dubai time in the app) — NOT to the latest purchase — so a
 * shelf check today is only judged against genuinely recent prices. The verdict
 * benchmark (best/avg) uses non-offer purchases within the window; `enoughToJudge`
 * reflects that same set, so we never claim confidence we don't have or silently
 * fall back to stale data.
 */
export function computeStats(all: PurchaseInput[], unit: string, now: Date): Stats | null {
  const same = all.filter((p) => p.unit === unit);
  if (same.length === 0) return null;
  const byDate = [...same].sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
  const last = byDate[0];
  const units = same.map(unitFils);

  const windowStart = now.getTime() - WINDOW_MS;
  const bench = same.filter((p) => !p.onOffer && p.purchasedAt.getTime() >= windowStart);
  const benchUnits = bench.map(unitFils);
  const enoughToJudge = benchUnits.length >= MIN_SAMPLE;
  const avg = benchUnits.length
    ? Math.round(benchUnits.reduce((a, b) => a + b, 0) / benchUnits.length)
    : 0;

  return {
    unit,
    count: same.length,
    enoughToJudge,
    lastFils: unitFils(last),
    bestFils: Math.min(...units),
    benchmarkBestFils: benchUnits.length ? Math.min(...benchUnits) : 0,
    benchmarkAvgFils: avg,
    avgFils: avg,
    highestFils: Math.max(...units),
    lastStore: last.store,
    lastDate: last.purchasedAt,
  };
}

export type Verdict = { level: "great" | "cheaper" | "same" | "pricier" | "unknown"; label: string };
export function shelfVerdict(shelfFils: number, s: Stats): Verdict {
  if (!s.enoughToJudge) return { level: "unknown", label: "Not enough recent prices to judge yet" };
  const best = s.benchmarkBestFils, avg = s.benchmarkAvgFils;
  if (shelfFils <= best * 1.03) return { level: "great", label: "Great price — at or below your best" };
  if (shelfFils < avg * 0.97) return { level: "cheaper", label: "Cheaper than usual" };
  if (shelfFils <= avg * 1.03) return { level: "same", label: "About the same as usual" };
  return { level: "pricier", label: "Pricier than usual — maybe wait" };
}
