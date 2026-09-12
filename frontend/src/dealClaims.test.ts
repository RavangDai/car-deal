import { describe, it, expect } from "vitest";
import { deriveClaim, comparisonFor, badgeFor } from "./dealClaims";
import type { Product, ProductStats } from "./api";

function stats(over: Partial<ProductStats> = {}): ProductStats {
  return {
    discount_vs_median_pct: null,
    rarity: null,
    stability: null,
    drop_freshness: null,
    n_points: 40,
    coverage_days: 40,
    min_90d: null,
    max_90d: null,
    ...over,
  };
}

function product(over: Partial<Product> = {}): Product {
  return {
    id: "p1",
    url: "https://example.com/p",
    domain: "example.com",
    title: "A Product",
    image_url: null,
    currency: "USD",
    category: "electronics",
    status: "active",
    latest_price: 100,
    latest_price_at: "2026-09-01T00:00:00Z",
    median_90d: 100,
    min_ever: 90,
    is_lowest_ever: false,
    deal_score: 50,
    stats: stats(),
    last_checked_at: null,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("deriveClaim", () => {
  it("trusts the server's lowest-ever flag above everything else", () => {
    expect(deriveClaim(product({ is_lowest_ever: true })).kind).toBe("lowest-ever");
  });

  it("still says lowest-ever even with thin coverage, because the server gated it on n_points", () => {
    const p = product({ is_lowest_ever: true, stats: stats({ coverage_days: 2, n_points: 6 }) });
    expect(deriveClaim(p).kind).toBe("lowest-ever");
  });

  it("claims a 90-day low when the price matches min_90d and coverage is sufficient", () => {
    const p = product({ latest_price: 80, stats: stats({ coverage_days: 30, min_90d: "80" }) });
    expect(deriveClaim(p).kind).toBe("lowest-90d");
  });

  it("compares min_90d NUMERICALLY, not as a string", () => {
    // "9" > "10" lexicographically. A string compare would wrongly refuse
    // this claim; the price IS the 90-day low.
    const p = product({ latest_price: 9, stats: stats({ coverage_days: 30, min_90d: "10" }) });
    expect(deriveClaim(p).kind).toBe("lowest-90d");
  });

  it("tolerates half-cent float drift when matching the 90-day low", () => {
    const p = product({ latest_price: 80.004, stats: stats({ coverage_days: 30, min_90d: "80" }) });
    expect(deriveClaim(p).kind).toBe("lowest-90d");
  });

  it("REFUSES a 90-day low when coverage is under 14 days", () => {
    // The whole point: a "90-day low" over 3 days of history is a lie.
    const p = product({ latest_price: 80, stats: stats({ coverage_days: 3, min_90d: "80" }) });
    expect(deriveClaim(p).kind).toBe("tracking");
  });

  it("claims below-usual with a real discount and enough coverage", () => {
    const p = product({
      latest_price: 70,
      median_90d: 100,
      stats: stats({ coverage_days: 30, discount_vs_median_pct: 30 }),
    });
    const c = deriveClaim(p);
    expect(c).toEqual({ kind: "below-usual", pct: 30, saving: 30, usual: 100 });
  });

  it("REFUSES below-usual when coverage is thin, even if a discount pct is present", () => {
    // median_90d is computed from as little as one price point, so an
    // ungated "usual price" can be a single reading from yesterday.
    const p = product({
      latest_price: 70,
      median_90d: 100,
      stats: stats({ coverage_days: 5, discount_vs_median_pct: 30 }),
    });
    expect(deriveClaim(p).kind).toBe("tracking");
  });

  it("ignores a trivially small discount", () => {
    const p = product({
      latest_price: 98,
      median_90d: 100,
      stats: stats({ coverage_days: 30, discount_vs_median_pct: 2 }),
    });
    expect(deriveClaim(p).kind).toBe("none");
  });

  it("counts down the days remaining while still measuring", () => {
    const p = product({ stats: stats({ coverage_days: 5 }) });
    expect(deriveClaim(p)).toEqual({ kind: "tracking", daysLeft: 9 });
  });

  it("treats a null stats block as no coverage at all", () => {
    expect(deriveClaim(product({ stats: null })).kind).toBe("tracking");
  });

  it("falls through to none when there is coverage but nothing notable", () => {
    const p = product({ stats: stats({ coverage_days: 40, discount_vs_median_pct: 0 }) });
    expect(deriveClaim(p).kind).toBe("none");
  });

  it("does not claim a 90-day low on a null price", () => {
    const p = product({ latest_price: null, stats: stats({ coverage_days: 30, min_90d: "80" }) });
    expect(deriveClaim(p).kind).not.toBe("lowest-90d");
  });
});

describe("comparisonFor", () => {
  it("permits a struck-through price ONLY for below-usual", () => {
    expect(comparisonFor({ kind: "below-usual", pct: 30, saving: 30, usual: 100 }))
      .toEqual({ usual: 100, saving: 30 });
  });

  it("refuses a comparison for every other claim", () => {
    for (const c of [
      { kind: "lowest-ever" } as const,
      { kind: "lowest-90d" } as const,
      { kind: "tracking", daysLeft: 9 } as const,
      { kind: "none" } as const,
    ]) {
      expect(comparisonFor(c)).toBeNull();
    }
  });
});

describe("badgeFor", () => {
  it("never labels an all-time low as a 90-day one", () => {
    expect(badgeFor({ kind: "lowest-ever" })!.label).toBe("Lowest ever");
  });

  it("labels the derived 90-day low precisely", () => {
    expect(badgeFor({ kind: "lowest-90d" })!.label).toBe("Lowest in 90 days");
  });

  it("rounds the discount for display", () => {
    expect(badgeFor({ kind: "below-usual", pct: 29.6, saving: 30, usual: 100 })!.label)
      .toBe("30% below usual");
  });

  it("singularises the final tracking day", () => {
    expect(badgeFor({ kind: "tracking", daysLeft: 1 })!.label).toBe("1 day to a score");
  });

  it("renders no badge when there is nothing to claim", () => {
    expect(badgeFor({ kind: "none" })).toBeNull();
  });
});
