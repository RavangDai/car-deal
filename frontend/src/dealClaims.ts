// frontend/src/dealClaims.ts
//
// What a card is ALLOWED to say about a price, given how much history the
// product actually has. Pure functions, no JSX, no CSS — so the rules can be
// tested directly and shared by every surface that renders a product.
//
// This exists because the obvious card design lies. A mockup shows "Save $70"
// and "Lowest in 90 days" on every tile, but the backend only earns those
// claims under specific conditions:
//
//   * `median_90d` is computed from as little as ONE price point
//     (dealmath.py). So "usual price" off a bare median can be a single
//     reading from yesterday, and "Save $X" against it is fiction.
//   * `deal_score` and `stats.discount_vs_median_pct` are NULL until
//     `coverage_days >= 14` (MIN_COVERAGE_DAYS, dealmath.py).
//   * `is_lowest_ever` already enforces `n_points >= 5`
//     (MIN_POINTS_FOR_LOWEST_EVER) server-side — trust it, don't re-derive.
//   * There is NO `is_lowest_90d` field. "Lowest in 90 days" has to be
//     derived from `stats.min_90d`, and is only meaningful once there is
//     enough coverage for a 90-day window to mean anything.
//
// One badge per card, first match wins.
import type { Product } from "./api";

/** Coverage below this and the score machinery returns NULL server-side. */
export const MIN_COVERAGE_DAYS = 14;

/** Below this discount a "save" shout is noise, not news. */
export const MIN_INTERESTING_DISCOUNT_PCT = 5;

/** Prices are Decimals over the wire; compare with a half-cent tolerance. */
const EPSILON = 0.005;

export type Claim =
  | { kind: "lowest-ever" }
  | { kind: "lowest-90d" }
  | { kind: "below-usual"; pct: number; saving: number; usual: number }
  | { kind: "tracking"; daysLeft: number }
  | { kind: "none" };

/**
 * `stats.min_90d` is typed `string | null` (a serialised Decimal) while
 * `latest_price` is `number | null`. Comparing them directly is either a type
 * error or, worse, a lexicographic string comparison that silently returns
 * nonsense — "$9" > "$10". Always go through this.
 */
function num(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function deriveClaim(p: Product): Claim {
  const price = num(p.latest_price);
  const coverage = p.stats?.coverage_days ?? 0;

  // 1. Lowest ever. Server-gated on n_points >= 5, so the flag is trustworthy
  //    on its own. Note it is ALL-TIME, not 90-day — the label must not say
  //    "in 90 days" or it misstates what was actually checked.
  if (p.is_lowest_ever) return { kind: "lowest-ever" };

  // 2. Lowest in 90 days. Derived, because no field carries it. The coverage
  //    gate is what makes it honest: a "90-day low" over three days of
  //    history is just "the only price we have seen".
  if (coverage >= MIN_COVERAGE_DAYS && price != null) {
    const min90 = num(p.stats?.min_90d);
    if (min90 != null && price <= min90 + EPSILON) {
      return { kind: "lowest-90d" };
    }
  }

  // 3. Below its usual price. Gated on coverage_days rather than on
  //    `deal_score != null`. The two are set together today, but depending on
  //    that coupling from another file is how this silently breaks later.
  if (coverage >= MIN_COVERAGE_DAYS) {
    const pct = p.stats?.discount_vs_median_pct ?? null;
    const usual = num(p.median_90d);
    if (pct != null && pct >= MIN_INTERESTING_DISCOUNT_PCT && usual != null && price != null) {
      return { kind: "below-usual", pct, saving: usual - price, usual };
    }
  }

  // 4. Not enough history yet. Say so plainly rather than showing a bare
  //    price with no context — "still measuring" is information.
  if (coverage < MIN_COVERAGE_DAYS) {
    return { kind: "tracking", daysLeft: Math.max(0, MIN_COVERAGE_DAYS - coverage) };
  }

  // 5. Enough history, nothing notable. The price stands alone.
  return { kind: "none" };
}

/**
 * Whether the card may show a struck-through comparison price and a savings
 * figure. ONLY the below-usual case earns it — everywhere else the
 * comparison would be against a median the data does not support.
 */
export function comparisonFor(claim: Claim): { usual: number; saving: number } | null {
  return claim.kind === "below-usual"
    ? { usual: claim.usual, saving: claim.saving }
    : null;
}

/** The badge label. Null means render no badge at all. */
export function badgeFor(claim: Claim): { label: string; tone: "signal" | "quiet" } | null {
  switch (claim.kind) {
    case "lowest-ever":
      return { label: "Lowest ever", tone: "signal" };
    case "lowest-90d":
      return { label: "Lowest in 90 days", tone: "signal" };
    case "below-usual":
      return { label: `${Math.round(claim.pct)}% below usual`, tone: "signal" };
    case "tracking":
      return {
        label: claim.daysLeft === 1 ? "1 day to a score" : `${claim.daysLeft} days to a score`,
        tone: "quiet",
      };
    case "none":
      return null;
  }
}
