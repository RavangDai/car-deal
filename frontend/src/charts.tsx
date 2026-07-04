// Lightweight, dependency-free SVG charts — no charting library, by design.
// Prices are step functions between observations, so every price line here
// uses a step-after path rather than smooth interpolation: a curve would
// literally fabricate prices that were never observed.
import { formatMoney } from "./format";

export type PricePointLike = { t: string; price: number; in_stock?: boolean };

function stepPath(xs: number[], ys: number[]): string {
  let d = "";
  xs.forEach((x, i) => {
    if (i === 0) d += `M ${x} ${ys[i]}`;
    else d += ` H ${x} V ${ys[i]}`;
  });
  return d;
}

// ── Full price-history chart — the centerpiece of the product detail page ──
export function PriceHistoryChart({
  points,
  median90d,
  minEver,
  currency = "USD",
}: {
  points: PricePointLike[];
  median90d?: number | null;
  minEver?: number | null;
  currency?: string;
}) {
  const W = 560;
  const H = 220;
  const pad = { l: 46, r: 12, t: 16, b: 26 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  if (points.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" role="img" aria-label="No price history yet">
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="12" fontFamily="'Manrope', sans-serif" fill="var(--ink-muted)">
          Not enough history yet
        </text>
      </svg>
    );
  }

  const dates = points.map((p) => Date.parse(p.t));
  const prices = points.map((p) => p.price);
  const minX = Math.min(...dates);
  const maxX = Math.max(...dates);
  const spanX = Math.max(maxX - minX, 1);

  const candidateMins = [...prices, median90d ?? Infinity, minEver ?? Infinity].filter(Number.isFinite);
  const candidateMaxs = [...prices, median90d ?? -Infinity].filter(Number.isFinite);
  const rawMin = Math.min(...candidateMins);
  const rawMax = Math.max(...candidateMaxs);
  const padP = (rawMax - rawMin) * 0.1 || rawMax * 0.1 || 1;
  const yMin = rawMin - padP;
  const yMax = rawMax + padP;
  const spanY = Math.max(yMax - yMin, 0.01);

  const sx = (t: number) => pad.l + ((t - minX) / spanX) * plotW;
  const sy = (v: number) => pad.t + plotH - ((v - yMin) / spanY) * plotH;

  const xs = dates.map(sx);
  const ys = prices.map(sy);
  const linePath = stepPath(xs, ys);

  // Out-of-stock spans, rendered as dimmed background bands.
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
  if (minEver != null) {
    let bestDiff = Infinity;
    points.forEach((p, i) => {
      const diff = Math.abs(p.price - minEver);
      if (diff < bestDiff) {
        bestDiff = diff;
        lowestIdx = i;
      }
    });
  }

  const xTickCount = 4;
  const xTicks = Array.from({ length: xTickCount }, (_, i) => minX + (spanX * i) / (xTickCount - 1));
  const yTicks = [yMin + spanY * 0.15, yMin + spanY * 0.5, yMin + spanY * 0.85];

  const lastIdx = points.length - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" role="img" aria-label="Price history">
      {oosSpans.map(([s, e], i) => (
        <rect
          key={i}
          x={sx(dates[s])}
          y={pad.t}
          width={Math.max(sx(dates[e]) - sx(dates[s]), 2)}
          height={plotH}
          fill="var(--ink-muted)"
          opacity="0.08"
        />
      ))}

      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={pad.l} y1={sy(v)} x2={W - pad.r} y2={sy(v)} stroke="var(--rule)" strokeWidth="1" />
          <text
            x={pad.l - 6} y={sy(v) + 3} textAnchor="end"
            fontSize="9" fontFamily="'Manrope', sans-serif" fill="var(--ink-muted)"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatMoney(v, currency)}
          </text>
        </g>
      ))}

      {xTicks.map((t, i) => (
        <text
          key={i} x={sx(t)} y={H - 6} textAnchor="middle"
          fontSize="9" fontFamily="'Manrope', sans-serif" fill="var(--ink-muted)"
        >
          {new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </text>
      ))}

      {median90d != null && (
        <>
          <line
            x1={pad.l} y1={sy(median90d)} x2={W - pad.r} y2={sy(median90d)}
            stroke="var(--ink-muted)" strokeWidth="1" strokeDasharray="4 4"
          />
          <text
            x={W - pad.r} y={sy(median90d) - 4} textAnchor="end"
            fontSize="9" fontFamily="'Manrope', sans-serif" fill="var(--ink-muted)"
          >
            90d median {formatMoney(median90d, currency)}
          </text>
        </>
      )}

      <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {lowestIdx >= 0 && (
        <>
          <circle cx={xs[lowestIdx]} cy={ys[lowestIdx]} r="4" fill="var(--green)" stroke="var(--paper-pale)" strokeWidth="1.5" />
          <text
            x={xs[lowestIdx]} y={ys[lowestIdx] - 9} textAnchor="middle"
            fontSize="9" fontWeight="700" fontFamily="'Manrope', sans-serif" fill="var(--green-deep, var(--green))"
          >
            lowest {formatMoney(points[lowestIdx].price, currency)}
          </text>
        </>
      )}

      <circle cx={xs[lastIdx]} cy={ys[lastIdx]} r="4.5" fill="var(--primary)" stroke="var(--paper-pale)" strokeWidth="1.5" />
    </svg>
  );
}

// ── Sparkline — compact trend line for watchlist rows, no axes ──────────────
export function Sparkline({ points }: { points: PricePointLike[] }) {
  const W = 120;
  const H = 32;

  if (points.length < 2) {
    return <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden />;
  }

  const dates = points.map((p) => Date.parse(p.t));
  const prices = points.map((p) => p.price);
  const minX = Math.min(...dates);
  const maxX = Math.max(...dates);
  const spanX = Math.max(maxX - minX, 1);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const spanP = Math.max(maxP - minP, maxP * 0.02, 0.01);

  const sx = (t: number) => ((t - minX) / spanX) * W;
  const sy = (v: number) => H - 3 - ((v - minP) / spanP) * (H - 6);

  const xs = dates.map(sx);
  const ys = prices.map(sy);
  const path = stepPath(xs, ys);

  const trendingDown = prices[prices.length - 1] < prices[0];
  const stroke = trendingDown ? "var(--green)" : "var(--ink-muted)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Price trend">
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Deal-score distribution across the feed ─────────────────────────────
export function ScoreHistogram({ products }: { products: { deal_score: number | null }[] }) {
  const W = 320;
  const H = 130;
  const pad = { l: 26, r: 8, t: 8, b: 22 };

  const edges = [0, 20, 40, 60, 80, 100];
  const labels = ["0", "20", "40", "60", "80"];
  const counts = new Array(labels.length).fill(0) as number[];
  for (const p of products) {
    if (p.deal_score == null) continue;
    let bin = labels.length - 1;
    for (let i = 0; i < labels.length; i++) {
      if (p.deal_score < edges[i + 1]) {
        bin = i;
        break;
      }
    }
    counts[bin] += 1;
  }
  const maxCount = Math.max(1, ...counts);
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const bw = plotW / counts.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" role="img" aria-label="Deal score distribution">
      <line x1={pad.l} y1={pad.t + plotH} x2={W - pad.r} y2={pad.t + plotH} stroke="var(--rule-strong)" strokeWidth="1" />
      {counts.map((c, i) => {
        const h = (c / maxCount) * plotH;
        const x = pad.l + i * bw + bw * 0.16;
        const y = pad.t + plotH - h;
        const w = bw * 0.68;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} rx="2" fill="var(--green)" opacity={0.25 + 0.6 * (c / maxCount)} />
            {c > 0 && (
              <text x={x + w / 2} y={y - 4} textAnchor="middle" fontSize="9" fontFamily="'Manrope', sans-serif" fill="var(--ink-soft)">{c}</text>
            )}
            <text x={x + w / 2} y={H - 7} textAnchor="middle" fontSize="9" fontFamily="'Manrope', sans-serif" fill="var(--ink-muted)">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}
