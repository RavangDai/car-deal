// Shared price-history math for the 2D SVG chart (charts.tsx). Kept apart
// from the chart component so this domain logic stays independently
// testable — prices are a step function between real observations, never
// interpolated.
import type { PricePointLike } from "./charts";

export type StepSegment = {
  t0: number;
  t1: number;
  price: number;
  inStock: boolean;
};

export type PriceHistoryGeometry = {
  segments: StepSegment[];
  xDomain: [number, number];
  yDomain: [number, number];
  oosSpans: [number, number][];
  lowestIdx: number;
  lastIdx: number;
  dates: number[];
  prices: number[];
};

export function computeStepSegments(
  points: PricePointLike[],
  { median90d, minEver }: { median90d?: number | null; minEver?: number | null }
): PriceHistoryGeometry | null {
  if (points.length === 0) return null;

  // The API serializes Decimal price fields as JSON strings (e.g. "199.11").
  // Number.isFinite (unlike the global isFinite) never coerces, so every
  // price would otherwise be filtered out below and collapse the domain to
  // +/-Infinity. Coerce once, here, at the shared boundary both charts use.
  const dates = points.map((p) => Date.parse(p.t));
  const prices = points.map((p) => Number(p.price));
  const median90dNum = median90d != null ? Number(median90d) : null;
  const minEverNum = minEver != null ? Number(minEver) : null;
  const minX = Math.min(...dates);
  const maxX = Math.max(...dates);

  const candidateMins = [...prices, median90dNum ?? Infinity, minEverNum ?? Infinity].filter(Number.isFinite);
  const candidateMaxs = [...prices, median90dNum ?? -Infinity].filter(Number.isFinite);
  const rawMin = Math.min(...candidateMins);
  const rawMax = Math.max(...candidateMaxs);
  const padP = (rawMax - rawMin) * 0.1 || rawMax * 0.1 || 1;
  const yMin = rawMin - padP;
  const yMax = rawMax + padP;

  // Out-of-stock spans, expressed as [startIdx, endIdx] runs.
  const oosSpans: [number, number][] = [];
  let spanStart: number | null = null;
  points.forEach((p, i) => {
    const outOfStock = p.in_stock === false;
    if (outOfStock && spanStart === null) spanStart = i;
    if (!outOfStock && spanStart !== null) {
      oosSpans.push([spanStart, i - 1]);
      spanStart = null;
    }
  });
  if (spanStart !== null) oosSpans.push([spanStart, points.length - 1]);

  let lowestIdx = -1;
  if (minEverNum != null) {
    let bestDiff = Infinity;
    prices.forEach((price, i) => {
      const diff = Math.abs(price - minEverNum);
      if (diff < bestDiff) {
        bestDiff = diff;
        lowestIdx = i;
      }
    });
  }

  const lastIdx = points.length - 1;

  // A segment spans from one real observation to the next — its width IS the
  // real elapsed time that price was held. The final point is deliberately
  // NOT extruded into a fabricated "held until now" segment (the 2D chart
  // doesn't draw a line past the last real observation either, just a dot).
  const segments: StepSegment[] = [];
  for (let i = 0; i < lastIdx; i++) {
    segments.push({
      t0: dates[i],
      t1: dates[i + 1],
      price: prices[i],
      inStock: points[i].in_stock !== false,
    });
  }

  return {
    segments,
    xDomain: [minX, maxX],
    yDomain: [yMin, yMax],
    oosSpans,
    lowestIdx,
    lastIdx,
    dates,
    prices,
  };
}
