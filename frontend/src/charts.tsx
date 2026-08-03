// Lightweight, dependency-free SVG charts — no charting library, by design.
//
// Price lines are drawn with MONOTONE CUBIC interpolation (see smoothPath).
// Prices really are step functions between observations, and `shape="step"`
// still draws them that way; the smooth default is a deliberate, bounded
// trade. Monotone cubic is the only smoothing that keeps the chart honest:
// it passes through every recorded observation and cannot overshoot between
// them, so the line never touches a price lower than the lowest ever paid.
// An ordinary spline would, and on this product that would undercut the
// exact claim the chart exists to prove.
//
// Visual system ("instrument"): the line is monochrome ink and the 90-day
// median is a dashed datum. The ONLY color in a chart is green, and it
// appears in exactly two places — the shaded band where the price sits
// below its own median (the discount, drawn to scale) and the lowest-ever
// marker. So green in a chart is never decoration: it is the discount.
import { useId } from "react";
import { formatMoney } from "./format";
import { computeStepSegments } from "./priceHistoryGeometry";
import { ChartTooltip } from "./chartUI";
import { useMarkHover, usePointerTrack } from "./chartHooks";

export type PricePointLike = { t: string; price: number; in_stock?: boolean };

function stepPath(xs: number[], ys: number[]): string {
  let d = "";
  xs.forEach((x, i) => {
    if (i === 0) d += `M ${x} ${ys[i]}`;
    else d += ` H ${x} V ${ys[i]}`;
  });
  return d;
}

/**
 * Monotone cubic interpolation (Fritsch–Carlson), emitted as cubic béziers.
 *
 * This is the ONLY smoothing allowed on price data, and the choice is not
 * cosmetic. A plain spline (Catmull-Rom, cardinal, "basis") overshoots: between
 * two observations it can dip below the lowest price ever recorded or rise above
 * the highest, which on this product would be a fabricated price undercutting
 * the very claim the chart exists to support.
 *
 * Fritsch–Carlson guarantees two properties that make it safe here:
 *   1. the curve passes exactly through every recorded observation, and
 *   2. it is monotone on every segment, so it never overshoots the interval
 *      between two neighbouring readings.
 *
 * What it still softens, and callers should know: the transition *between* two
 * readings is drawn as a gradual slope rather than a flat hold and a vertical
 * jump. Real prices step. Pass shape="step" to draw them that way.
 */
function smoothPath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n < 2) return n === 1 ? `M ${xs[0]} ${ys[0]}` : "";
  if (n === 2) return `M ${xs[0]} ${ys[0]} L ${xs[1]} ${ys[1]}`;

  // Secant slopes between consecutive points.
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = xs[i + 1] - xs[i];
    dx.push(h);
    slope.push(h === 0 ? 0 : (ys[i + 1] - ys[i]) / h);
  }

  // Initial tangents: average of neighbouring secants, zeroed at local extrema
  // so the curve flattens at turning points instead of bulging past them.
  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }

  // Fritsch–Carlson correction — this is the step that enforces monotonicity.
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }

  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C ${xs[i] + h} ${ys[i] + m[i] * h} ${xs[i + 1] - h} ${ys[i + 1] - m[i + 1] * h} ${xs[i + 1]} ${ys[i + 1]}`;
  }
  return d;
}

export type LineShape = "smooth" | "step";

function linePathFor(shape: LineShape, xs: number[], ys: number[]): string {
  return shape === "step" ? stepPath(xs, ys) : smoothPath(xs, ys);
}

// ── Full price-history chart — the centerpiece of the product ──────────────
export function PriceHistoryChart({
  points,
  median90d,
  minEver,
  currency = "USD",
  variant = "detail",
  shape = "smooth",
}: {
  points: PricePointLike[];
  median90d?: number | null;
  minEver?: number | null;
  currency?: string;
  /** "hero" draws itself on mount and annotates larger. */
  variant?: "detail" | "hero";
  /** "step" renders the literal step function prices actually follow. */
  shape?: LineShape;
}) {
  const uid = useId().replace(/:/g, "");
  const hero = variant === "hero";

  const W = hero ? 1000 : 900;
  const H = hero ? 400 : 340;
  const pad = hero
    ? { l: 66, r: 118, t: 34, b: 34 }
    : { l: 62, r: 104, t: 28, b: 32 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  // Declared before the empty-data return: hooks cannot sit after it.
  const { ref: svgRef, vx: pointerX, onMove: onPointerMove, onLeave: onPointerLeave } =
    usePointerTrack(W);

  const geo = points.length > 0 ? computeStepSegments(points, { median90d, minEver }) : null;

  if (!geo) return <EmptyAxis width={W} height={H} label="No price history yet" />;

  const { dates, prices, oosSpans, lowestIdx, lastIdx } = geo;
  const [minX, maxX] = geo.xDomain;
  const [yMin, yMax] = geo.yDomain;
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(yMax - yMin, 0.01);

  const sx = (t: number) => pad.l + ((t - minX) / spanX) * plotW;
  const sy = (v: number) => pad.t + plotH - ((v - yMin) / spanY) * plotH;

  const xs = dates.map(sx);
  const ys = prices.map(sy);
  const linePath = linePathFor(shape, xs, ys);

  const medianNum = median90d != null ? Number(median90d) : null;
  const medianY = medianNum != null ? sy(medianNum) : null;

  // The discount band: the region between the price line and the median,
  // clipped to below the median so only genuine discount is shaded. Its
  // area IS the saving, drawn to scale — not an arbitrary highlight.
  const discountPath =
    medianY != null
      ? `${linePath} L ${xs[lastIdx]} ${medianY} L ${xs[0]} ${medianY} Z`
      : null;

  const xTickCount = 4;
  const xTicks = Array.from({ length: xTickCount }, (_, i) => minX + (spanX * i) / (xTickCount - 1));
  const yTicks = [yMin + spanY * 0.12, yMin + spanY * 0.5, yMin + spanY * 0.88];

  const axisSize = hero ? 12 : 11;
  const annoSize = hero ? 13 : 12;
  const lastPrice = prices[lastIdx];

  // Crosshair read-out: map the pointer to a viewBox x, then snap to the
  // nearest real observation — never interpolate a price that wasn't seen.
  const hoverIdx =
    pointerX == null
      ? null
      : (() => {
          let best = 0;
          let bestD = Infinity;
          for (let i = 0; i < xs.length; i++) {
            const d = Math.abs(xs[i] - pointerX);
            if (d < bestD) { bestD = d; best = i; }
          }
          return best;
        })();

  const hoverTip =
    hoverIdx == null
      ? null
      : {
          x: ((xs[hoverIdx] - 0) / W) * 100,
          y: ((ys[hoverIdx] - 0) / H) * 100,
          content: (
            <>
              <span className="rv-tip-title">{formatMoney(prices[hoverIdx], currency)}</span>
              <span className="rv-tip-row">
                {new Date(dates[hoverIdx]).toLocaleDateString(undefined, {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </span>
              {medianNum != null && (
                <span className="rv-tip-row">
                  {prices[hoverIdx] < medianNum
                    ? `${(((medianNum - prices[hoverIdx]) / medianNum) * 100).toFixed(0)}% below median`
                    : prices[hoverIdx] > medianNum
                      ? `${(((prices[hoverIdx] - medianNum) / medianNum) * 100).toFixed(0)}% above median`
                      : "at its median"}
                </span>
              )}
            </>
          ),
        };

  return (
    <div className="rv-chart-wrap">
    <svg
      ref={svgRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={`Price history. Latest ${formatMoney(lastPrice, currency)}${
        medianNum != null ? `, 90-day median ${formatMoney(medianNum, currency)}` : ""
      }`}
      className="rv-chart"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Out of stock: hatched, not a gray fill — an absence of data is
            not a low price, and it must not read as one. */}
        <pattern id={`oos-${uid}`} width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="7" stroke="var(--ink-fade)" strokeWidth="1.4" opacity="0.5" />
        </pattern>
        {medianY != null && (
          <clipPath id={`below-${uid}`}>
            <rect x={pad.l} y={medianY} width={plotW} height={Math.max(pad.t + plotH - medianY, 0)} />
          </clipPath>
        )}
      </defs>

      {/* Plot frame — two rules only: baseline and left axis. */}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + plotH} stroke="var(--rule-strong)" strokeWidth="1" />
      <line x1={pad.l} y1={pad.t + plotH} x2={W - pad.r} y2={pad.t + plotH} stroke="var(--rule-strong)" strokeWidth="1" />

      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={pad.l} y1={sy(v)} x2={W - pad.r} y2={sy(v)} stroke="var(--rule)" strokeWidth="1" />
          <text
            x={pad.l - 10} y={sy(v) + 4} textAnchor="end"
            fontSize={axisSize} className="rv-chart-axis" fill="var(--ink-fade)"
          >
            {formatMoney(v, currency)}
          </text>
        </g>
      ))}

      {xTicks.map((t, i) => (
        <text
          key={i} x={sx(t)} y={H - 10} textAnchor={i === 0 ? "start" : i === xTickCount - 1 ? "end" : "middle"}
          fontSize={axisSize} className="rv-chart-axis" fill="var(--ink-fade)"
        >
          {new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </text>
      ))}

      {oosSpans.map(([s, e], i) => (
        <rect
          key={i}
          x={sx(dates[s])} y={pad.t}
          width={Math.max(sx(dates[e]) - sx(dates[s]), 2)} height={plotH}
          fill={`url(#oos-${uid})`}
        />
      ))}

      {discountPath && (
        <path d={discountPath} fill="var(--green)" opacity="0.13" clipPath={`url(#below-${uid})`} />
      )}

      {medianY != null && (
        <>
          <line
            x1={pad.l} y1={medianY} x2={W - pad.r} y2={medianY}
            stroke="var(--ink-fade)" strokeWidth="1.5" strokeDasharray="6 5"
          />
          <text
            x={W - pad.r + 8} y={medianY - 6} textAnchor="start"
            fontSize={axisSize} className="rv-chart-axis" fill="var(--ink-muted)"
          >
            90d median
          </text>
          <text
            x={W - pad.r + 8} y={medianY + 12} textAnchor="start"
            fontSize={annoSize} className="rv-chart-figure" fill="var(--ink-muted)"
          >
            {formatMoney(medianNum!, currency)}
          </text>
        </>
      )}

      <path
        d={linePath}
        fill="none"
        stroke="var(--ink)"
        strokeWidth={hero ? 2.6 : 2.2}
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        className={hero ? "rv-chart-line rv-chart-line-draw" : "rv-chart-line"}
      />

      {/* The same line redrawn in green and clipped to below the median, so
          the stretch where this product was genuinely cheap than its own
          normal price is coloured. Status green, not a series hue: it means
          the deal math verified it, exactly like the band beneath it. */}
      {medianY != null && (
        <path
          d={linePath}
          fill="none"
          stroke="var(--green)"
          strokeWidth={hero ? 2.6 : 2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
          clipPath={`url(#below-${uid})`}
          pathLength={1}
          className={hero ? "rv-chart-line rv-chart-line-draw" : "rv-chart-line"}
        />
      )}

      {lowestIdx >= 0 && (
        <g className="rv-chart-anno">
          <line
            x1={xs[lowestIdx]} y1={ys[lowestIdx]} x2={xs[lowestIdx]} y2={pad.t + plotH}
            stroke="var(--green)" strokeWidth="1" strokeDasharray="3 3" opacity="0.55"
          />
          <circle cx={xs[lowestIdx]} cy={ys[lowestIdx]} r={hero ? 6 : 5} fill="var(--green)" />
          <circle cx={xs[lowestIdx]} cy={ys[lowestIdx]} r={hero ? 6 : 5} fill="none" stroke="var(--paper)" strokeWidth="2" />
          {/* Knocked out of whatever it sits over — the lowest point is very
              often right on the price line it labels. */}
          <text
            x={xs[lowestIdx]} y={ys[lowestIdx] - (hero ? 18 : 16)} textAnchor="middle"
            fontSize={axisSize} className="rv-chart-axis" fill="var(--green-deep)"
            letterSpacing="0.1em"
            stroke="var(--paper)" strokeWidth="4" paintOrder="stroke"
          >
            LOWEST
          </text>
        </g>
      )}

      <g className="rv-chart-anno">
        <circle cx={xs[lastIdx]} cy={ys[lastIdx]} r={hero ? 6 : 5} fill="var(--ink)" />
        <text
          x={Math.min(xs[lastIdx] + 12, W - pad.r + 8)} y={ys[lastIdx] + 5} textAnchor="start"
          fontSize={hero ? 17 : 15} className="rv-chart-figure" fill="var(--ink)" fontWeight="600"
          stroke="var(--paper)" strokeWidth="4" paintOrder="stroke"
        >
          {formatMoney(lastPrice, currency)}
        </text>
      </g>

      {hoverIdx != null && (
        <g pointerEvents="none">
          <line
            x1={xs[hoverIdx]} y1={pad.t} x2={xs[hoverIdx]} y2={pad.t + plotH}
            stroke="var(--ink)" strokeWidth="1" opacity="0.45"
          />
          <circle
            cx={xs[hoverIdx]} cy={ys[hoverIdx]} r="5"
            fill="var(--ink)" stroke="var(--paper)" strokeWidth="2"
          />
        </g>
      )}
    </svg>
    <ChartTooltip hover={hoverTip} />
    </div>
  );
}

// ── Empty axis — the loading/empty state. An instrument with no reading on
// it, not a spinner: it shows the shape of what is about to arrive.
export function EmptyAxis({
  width = 900,
  height = 340,
  label = "Waiting for the first price check",
}: {
  width?: number;
  height?: number;
  label?: string;
}) {
  const pad = { l: 62, r: 84, t: 28, b: 32 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={label} className="rv-chart">
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + plotH} stroke="var(--rule)" strokeWidth="1" />
      <line x1={pad.l} y1={pad.t + plotH} x2={width - pad.r} y2={pad.t + plotH} stroke="var(--rule)" strokeWidth="1" />
      {[0.12, 0.5, 0.88].map((f, i) => (
        <line
          key={i} x1={pad.l} y1={pad.t + plotH * f} x2={width - pad.r} y2={pad.t + plotH * f}
          stroke="var(--rule)" strokeWidth="1"
        />
      ))}
      <text
        x={pad.l + plotW / 2} y={pad.t + plotH / 2} textAnchor="middle"
        fontSize="13" className="rv-chart-axis" fill="var(--ink-fade)" letterSpacing="0.08em"
      >
        {label}
      </text>
    </svg>
  );
}

// ── Sparkline — the spine of an index row. Ink line over a dashed median
// hairline, so a row reads as "above or below its own normal" at a glance.
// This is what differentiates one row from another, which is why it earns
// more width than the product thumbnail.
export function Sparkline({
  points,
  median,
  width = 132,
  height = 34,
  shape = "smooth",
}: {
  points: PricePointLike[];
  median?: number | null;
  width?: number;
  height?: number;
  shape?: LineShape;
}) {
  if (points.length < 2) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
        <line
          x1="0" y1={height / 2} x2={width} y2={height / 2}
          stroke="var(--rule-strong)" strokeWidth="1" strokeDasharray="3 4"
        />
      </svg>
    );
  }

  const dates = points.map((p) => Date.parse(p.t));
  // Prices arrive from the API as JSON strings; coerce before any math.
  const prices = points.map((p) => Number(p.price));
  const medianNum = median != null ? Number(median) : null;

  const minX = Math.min(...dates);
  const maxX = Math.max(...dates);
  const spanX = Math.max(maxX - minX, 1);
  const candidates = medianNum != null ? [...prices, medianNum] : prices;
  const minP = Math.min(...candidates);
  const maxP = Math.max(...candidates);
  const spanP = Math.max(maxP - minP, maxP * 0.02, 0.01);

  const sx = (t: number) => ((t - minX) / spanX) * width;
  const sy = (v: number) => height - 3 - ((v - minP) / spanP) * (height - 6);

  const xs = dates.map(sx);
  const ys = prices.map(sy);
  const path = linePathFor(shape, xs, ys);

  const last = prices[prices.length - 1];
  const belowMedian = medianNum != null && last < medianNum;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="90-day price trend">
      {medianNum != null && (
        <line
          x1="0" y1={sy(medianNum)} x2={width} y2={sy(medianNum)}
          stroke="var(--ink-fade)" strokeWidth="1" strokeDasharray="3 4"
        />
      )}
      <path d={path} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle
        cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2.8"
        fill={belowMedian ? "var(--green)" : "var(--ink)"}
      />
    </svg>
  );
}

// ── Deal-score distribution across the feed ─────────────────────────────
// Score bands are an ORDERED scale, so they take a single-hue ramp stepping
// light→dark rather than categorical hues: the reader should be able to see
// the order in the colour. Categorical hues here would claim the five bands
// are unrelated identities, which they aren't.
const BAND_RAMP = ["var(--ramp-1)", "var(--ramp-2)", "var(--ramp-3)", "var(--ramp-4)", "var(--ramp-5)"];

export function ScoreHistogram({ products }: { products: { deal_score: number | null }[] }) {
  const { hover, show, hide } = useMarkHover();
  const W = 320;
  const H = 130;
  const pad = { l: 26, r: 8, t: 10, b: 24 };

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
    <div className="rv-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Deal score distribution" className="rv-chart">
        <line x1={pad.l} y1={pad.t + plotH} x2={W - pad.r} y2={pad.t + plotH} stroke="var(--rule-strong)" strokeWidth="1" />
        {counts.map((c, i) => {
          const h = (c / maxCount) * plotH;
          const x = pad.l + i * bw + bw * 0.18;
          const y = pad.t + plotH - h;
          const w = bw * 0.64;
          const hi = edges[i + 1];
          return (
            <g key={i}>
              {/* Hit target spans the full column, not just the drawn bar —
                  a 2-count bar is only a few pixels tall. */}
              <rect
                x={pad.l + i * bw} y={pad.t} width={bw} height={plotH}
                fill="transparent" className="rv-mark-hit"
                onPointerEnter={() =>
                  show(((x + w / 2) / W) * 100, (y / H) * 100, (
                    <>
                      <span className="rv-tip-title">
                        {c} {c === 1 ? "product" : "products"}
                      </span>
                      <span className="rv-tip-row">
                        <span className="rv-tip-dot" style={{ background: BAND_RAMP[i] }} />
                        scores {labels[i]}–{hi}
                      </span>
                    </>
                  ))
                }
                onPointerLeave={hide}
              />
              <rect x={x} y={y} width={w} height={h} fill={BAND_RAMP[i]} pointerEvents="none" />
              {c > 0 && (
                <text x={x + w / 2} y={y - 5} textAnchor="middle" fontSize="10" className="rv-chart-figure" fill="var(--ink-muted)" pointerEvents="none">{c}</text>
              )}
              <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="10" className="rv-chart-axis" fill="var(--ink-fade)" pointerEvents="none">{labels[i]}</text>
            </g>
          );
        })}
      </svg>
      <ChartTooltip hover={hover} />
    </div>
  );
}

export const CHART_STYLES = `
  /* height:auto belongs in CSS, not the SVG height attribute — that
     attribute wants a length and rejects "auto" with a console error. */
  .rv-chart { display: block; width: 100%; height: auto; overflow: visible; }
  /* Every label inside a chart is set in the figure face, so axis numbers
     and table columns share one numeric rhythm. */
  .rv-chart-axis, .rv-chart-figure {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums lining-nums;
    letter-spacing: 0.02em;
  }

  /* The hero's one orchestrated moment: the price line draws itself.
     pathLength="1" normalises the geometry so the dash animation works
     without measuring the path in JS. */
  .rv-chart-line-draw {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: rv-draw var(--dur-draw) var(--ease-out-expo) forwards;
  }
  .rv-chart-anno { opacity: 0; animation: rv-anno-in .4s ease forwards; animation-delay: var(--dur-draw); }
  @keyframes rv-draw { to { stroke-dashoffset: 0; } }
  @keyframes rv-anno-in { to { opacity: 1; } }

  @media (prefers-reduced-motion: reduce) {
    .rv-chart-line-draw { stroke-dasharray: none; stroke-dashoffset: 0; animation: none; }
    .rv-chart-anno { opacity: 1; animation: none; }
  }
`;
