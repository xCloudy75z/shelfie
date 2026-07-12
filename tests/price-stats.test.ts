import { describe, it, expect } from "vitest";
import { computeStats, shelfVerdict, type PurchaseInput } from "@/lib/price-stats";

const NOW = new Date("2026-07-15");
const p = (o: Partial<PurchaseInput>): PurchaseInput => ({
  totalFils: 575, quantity: 1, unit: "each", onOffer: false,
  store: "Carrefour", purchasedAt: new Date("2026-07-01"), ...o,
});

describe("computeStats", () => {
  it("uses unit price, not line total (a 6-pack must not distort a single)", () => {
    const s = computeStats([
      p({ totalFils: 575, quantity: 1 }),            // 5.75/unit
      p({ totalFils: 2994, quantity: 6 }),           // 4.99/unit
    ], "each", NOW);
    expect(s!.bestFils).toBe(499);
    expect(s!.lastFils).toBe(575);       // most recent by date
    expect(s!.highestFils).toBe(575);
    expect(s!.avgFils).toBe(537);        // round((575+499)/2)
  });
  it("excludes offers from the benchmark but keeps them as all-time best display", () => {
    const s = computeStats([
      p({ totalFils: 3495, onOffer: false, purchasedAt: new Date("2026-06-01") }),
      p({ totalFils: 3495, onOffer: false, purchasedAt: new Date("2026-06-15") }),
      p({ totalFils: 3495, onOffer: false, purchasedAt: new Date("2026-07-01") }),
      p({ totalFils: 2495, onOffer: true,  purchasedAt: new Date("2026-05-01") }),
    ], "each", NOW);
    expect(s!.benchmarkBestFils).toBe(3495); // offer excluded
    expect(s!.bestFils).toBe(2495);          // all-time incl. offer, for display
  });
  it("needs 3+ recent non-offer buys to judge", () => {
    const s = computeStats([p({}), p({})], "each", NOW);
    expect(s!.enoughToJudge).toBe(false);
  });
  it("only compares same unit basis", () => {
    const s = computeStats([
      p({ totalFils: 849, quantity: 1, unit: "each" }),
      p({ totalFils: 361, quantity: 0.425, unit: "kg" }), // different basis, ignored for 'each'
    ], "each", NOW);
    expect(s!.count).toBe(1);
  });

  // Regression (review I-1): the gate must reflect the windowed benchmark set,
  // not the all-time non-offer count.
  it("does not claim 'enough to judge' when only one non-offer buy is within the window", () => {
    const s = computeStats([
      p({ totalFils: 500, purchasedAt: new Date("2024-01-05") }), // outside 12-mo window
      p({ totalFils: 500, purchasedAt: new Date("2024-02-05") }), // outside
      p({ totalFils: 560, purchasedAt: new Date("2026-07-01") }), // inside
    ], "each", NOW);
    expect(s!.enoughToJudge).toBe(false);
    expect(shelfVerdict(560, s!).level).toBe("unknown");
  });

  it("on-offer purchases are excluded and can push an item below the judge gate", () => {
    const now = new Date("2026-07-12T00:00:00Z");
    const purchases = [
      { totalFils: 500, quantity: 1, unit: "each", onOffer: true,  purchasedAt: new Date("2026-07-01") },
      { totalFils: 900, quantity: 1, unit: "each", onOffer: false, purchasedAt: new Date("2026-06-01") },
    ] as any;
    const stats = computeStats(purchases, "each", now);
    expect(stats!.enoughToJudge).toBe(false); // only 1 non-offer sample
  });

  // Regression (review I-2): no silent fallback to stale data when nothing recent is non-offer.
  it("stays 'unknown' when only stale non-offer history and a recent offer exist", () => {
    const s = computeStats([
      p({ totalFils: 340, purchasedAt: new Date("2024-01-05") }),
      p({ totalFils: 340, purchasedAt: new Date("2024-02-05") }),
      p({ totalFils: 340, purchasedAt: new Date("2024-03-05") }),
      p({ totalFils: 250, onOffer: true, purchasedAt: new Date("2026-07-01") }),
    ], "each", NOW);
    expect(s!.enoughToJudge).toBe(false);
    expect(shelfVerdict(340, s!).level).toBe("unknown");
  });
});

describe("shelfVerdict", () => {
  const stats = computeStats([
    p({ totalFils: 560, purchasedAt: new Date("2026-06-01") }),
    p({ totalFils: 560, purchasedAt: new Date("2026-06-10") }),
    p({ totalFils: 560, purchasedAt: new Date("2026-07-01") }),
    p({ totalFils: 499, onOffer: true }),
  ], "each", NOW)!;
  it("great when at/below benchmark best", () => {
    expect(shelfVerdict(560, stats).level).toBe("great");
  });
  it("pricier when clearly above average", () => {
    expect(shelfVerdict(650, stats).level).toBe("pricier");
  });
  it("suppresses when not enough data", () => {
    const thin = computeStats([p({})], "each", NOW)!;
    expect(shelfVerdict(500, thin).level).toBe("unknown");
  });
});
