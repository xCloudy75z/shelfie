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
  benchmarkBestFils: number;     // min unit price excluding offers — for verdict
  benchmarkAvgFils: number;      // avg unit price excluding offers, windowed
  avgFils: number;               // alias of benchmarkAvgFils (windowed avg) — used by UI/tests
  highestFils: number;
  lastStore: string;
  lastDate: Date;
};
const WINDOW_MS = 365 * 24 * 60 * 60 * 1000; // rolling 12 months for benchmark
const MIN_SAMPLE = 3;

function unitFils(p: PurchaseInput): number {
  const q = p.quantity > 0 ? p.quantity : 1;
  return Math.round(p.totalFils / q);
}

export function computeStats(all: PurchaseInput[], unit: string): Stats | null {
  const same = all.filter((p) => p.unit === unit);
  if (same.length === 0) return null;
  const byDate = [...same].sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
  const last = byDate[0];
  const units = same.map(unitFils);
  const now = byDate[0].purchasedAt.getTime();
  const bench = same.filter((p) => !p.onOffer && now - p.purchasedAt.getTime() <= WINDOW_MS);
  const benchUnits = (bench.length ? bench : same.filter((p) => !p.onOffer)).map(unitFils);
  const nonOfferCount = same.filter((p) => !p.onOffer).length;
  const avg = benchUnits.length
    ? Math.round(benchUnits.reduce((a, b) => a + b, 0) / benchUnits.length)
    : Math.round(units.reduce((a, b) => a + b, 0) / units.length);
  return {
    unit,
    count: same.length,
    enoughToJudge: nonOfferCount >= MIN_SAMPLE,
    lastFils: unitFils(last),
    bestFils: Math.min(...units),
    benchmarkBestFils: benchUnits.length ? Math.min(...benchUnits) : Math.min(...units),
    benchmarkAvgFils: avg,
    avgFils: avg,
    highestFils: Math.max(...units),
    lastStore: last.store,
    lastDate: last.purchasedAt,
  };
}

export type Verdict = { level: "great" | "cheaper" | "same" | "pricier" | "unknown"; label: string };
export function shelfVerdict(shelfFils: number, s: Stats): Verdict {
  if (!s.enoughToJudge) return { level: "unknown", label: "Only a few past prices — not enough to judge" };
  const best = s.benchmarkBestFils, avg = s.benchmarkAvgFils;
  if (shelfFils <= best * 1.03) return { level: "great", label: "Great price — at or below your best" };
  if (shelfFils < avg * 0.97) return { level: "cheaper", label: "Cheaper than usual" };
  if (shelfFils <= avg * 1.03) return { level: "same", label: "About the same as usual" };
  return { level: "pricier", label: "Pricier than usual — maybe wait" };
}
