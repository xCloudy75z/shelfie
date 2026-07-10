import { describe, it, expect } from "vitest";
import { computeStats, shelfVerdict, type PurchaseInput } from "@/lib/price-stats";

const p = (o: Partial<PurchaseInput>): PurchaseInput => ({
  totalFils: 575, quantity: 1, unit: "each", onOffer: false,
  store: "Carrefour", purchasedAt: new Date("2026-07-01"), ...o,
});

describe("computeStats", () => {
  it("uses unit price, not line total (a 6-pack must not distort a single)", () => {
    const s = computeStats([
      p({ totalFils: 575, quantity: 1 }),            // 5.75/unit
      p({ totalFils: 2994, quantity: 6 }),           // 4.99/unit
    ], "each");
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
    ], "each");
    expect(s!.benchmarkBestFils).toBe(3495); // offer excluded
    expect(s!.bestFils).toBe(2495);          // all-time incl. offer, for display
  });
  it("returns null-ish sample flag below 3 non-offer buys", () => {
    const s = computeStats([p({}), p({})], "each");
    expect(s!.enoughToJudge).toBe(false);
  });
  it("only compares same unit basis", () => {
    const s = computeStats([
      p({ totalFils: 849, quantity: 1, unit: "each" }),
      p({ totalFils: 361, quantity: 0.425, unit: "kg" }), // different basis, ignored for 'each'
    ], "each");
    expect(s!.count).toBe(1);
  });
});

describe("shelfVerdict", () => {
  const stats = computeStats([
    p({ totalFils: 560, purchasedAt: new Date("2026-06-01") }),
    p({ totalFils: 560, purchasedAt: new Date("2026-06-10") }),
    p({ totalFils: 560, purchasedAt: new Date("2026-07-01") }),
    p({ totalFils: 499, onOffer: true }),
  ], "each")!;
  it("great when at/below benchmark best", () => {
    expect(shelfVerdict(560, stats).level).toBe("great");
  });
  it("pricier when clearly above average", () => {
    expect(shelfVerdict(650, stats).level).toBe("pricier");
  });
  it("suppresses when not enough data", () => {
    const thin = computeStats([p({})], "each")!;
    expect(shelfVerdict(500, thin).level).toBe("unknown");
  });
});
