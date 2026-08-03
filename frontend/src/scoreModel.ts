// frontend/src/scoreModel.ts
// The deal score's four components, as data — kept out of the components
// that draw them so both `ScoreBar` (one product) and `ScoreComposition`
// (across products) read from one definition, and so the model can change
// without touching either renderer.
//
// Honesty rule: every value here comes from ProductStats, which the backend
// computed. Nothing is inferred when a component is null — the caller
// renders it empty and says so.
import type { ProductStats } from "./api";

// Mirrors backend/app/dealmath.py. Weights must sum to 1.0 and the
// normalization constants must match, or the segments stop adding up to
// the score the API returned.
export const WEIGHT_DISCOUNT_DEPTH = 0.4;
export const WEIGHT_RARITY = 0.3;
export const WEIGHT_STABILITY = 0.2;
export const WEIGHT_FRESHNESS = 0.1;
const DEPTH_FULL_MARKS_PCT = 0.3; // 30% below median earns full marks

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export type ScoreComponentKey = "depth" | "rarity" | "stability" | "freshness";

// Fixed slot order — a component's hue is its identity and never changes,
// including when a filter or sort reorders the products around it. The
// values are the validated categorical slots in theme.css; slots 2 and 4
// sit below 3:1 on paper, so anything using them must also ship a visible
// label or a table view.
export const COMPONENT_COLOR: Record<ScoreComponentKey, string> = {
  depth: "var(--series-1)",
  rarity: "var(--series-2)",
  stability: "var(--series-3)",
  freshness: "var(--series-4)",
};

export const COMPONENT_LABEL: Record<ScoreComponentKey, string> = {
  depth: "Discount depth",
  rarity: "Historical rarity",
  stability: "Pre-drop stability",
  freshness: "Drop freshness",
};

export type ScoreComponent = {
  key: ScoreComponentKey;
  label: string;
  weight: number;
  /** 0–1, or null when the backend had no value for it. */
  value: number | null;
  /** The measured reading behind the sub-score, in its own units. */
  readout: string;
  explain: string;
};

export function scoreComponents(stats: ProductStats): ScoreComponent[] {
  const depth = stats.discount_vs_median_pct;
  return [
    {
      key: "depth",
      label: COMPONENT_LABEL.depth,
      weight: WEIGHT_DISCOUNT_DEPTH,
      // The API exposes the raw percentage; the sub-score is that
      // percentage normalized the same way dealmath.py normalizes it.
      value: depth != null ? clamp01(depth / 100 / DEPTH_FULL_MARKS_PCT) : null,
      readout: depth != null ? `${depth.toFixed(1)}% below median` : "—",
      explain:
        "How far below the 90-day median this price sits. A price raised and then dropped back to its baseline never moved the median, so it earns nothing here.",
    },
    {
      key: "rarity",
      label: COMPONENT_LABEL.rarity,
      weight: WEIGHT_RARITY,
      value: stats.rarity,
      readout: stats.rarity != null ? `cheaper than ${Math.round(stats.rarity * 100)}% of days` : "—",
      explain: "The share of tracked days this product was priced higher than it is right now.",
    },
    {
      key: "stability",
      label: COMPONENT_LABEL.stability,
      weight: WEIGHT_STABILITY,
      value: stats.stability,
      readout: stats.stability != null ? `${Math.round(stats.stability * 100)}% steady` : "—",
      explain:
        "How steady the price was before this drop. A stable price is a trustworthy reference point; one that oscillates weekly is not.",
    },
    {
      key: "freshness",
      label: COMPONENT_LABEL.freshness,
      weight: WEIGHT_FRESHNESS,
      value: stats.drop_freshness,
      readout: stats.drop_freshness != null ? `${Math.round(stats.drop_freshness * 100)}% recent` : "—",
      explain: "How recently the price actually fell. A drop two weeks old is far less actionable than one from today.",
    },
  ];
}
