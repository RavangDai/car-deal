// frontend/src/priceViews.tsx
// The non-line views of a price history: bars and the raw table. Kept beside
// charts.tsx rather than inside it so each view stays readable on its own.
import { formatMoney } from "./format";
import { EmptyAxis, type PricePointLike } from "./charts";
import { ChartTooltip } from "./chartUI";
import { useMarkHover } from "./chartHooks";

/**
 * Axis ticks on round numbers, always including zero. Fractions of the data
 * range produce collisions (a +3.2% range yields "+3%" and "+2%" almost on top
 * of each other); a 1/2/5×10ⁿ step never does.
 */
function niceTicks(lo: number, hi: number, target = 5): number[] {
  const span = hi - lo;
  if (span <= 0) return [0];
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
    out.push(Math.abs(v) < 1e-9 ? 0 : v);
  }
  if (!out.some((v) => Math.abs(v) < 1e-9) && lo <= 0 && hi >= 0) out.push(0);
  return out;
}

// ── Bars view — distance from the 90-day median, per price check ───────────
// Deliberately NOT bars of the price itself. Prices sit in a narrow band well
// above zero (e.g. $139–$199), so price bars would need a truncated axis — and
// a truncated bar axis exaggerates small differences, which is the exact
// distortion this product exists to expose. Distance from the median has a
// true zero baseline, so these bars are honest at full length.
export function PriceBarsChart({
  points,
  median90d,
  currency = "USD",
}: {
  points: PricePointLike[];
  median90d?: number | null;
  currency?: string;
}) {
  const { hover, show, hide } = useMarkHover();

  const W = 900;
  const H = 340;
  const pad = { l: 58, r: 16, t: 26, b: 34 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const median = median90d != null ? Number(median90d) : null;
  if (points.length === 0 || median == null || median <= 0) {
    return (
      <div className="rv-chart-wrap">
        <EmptyAxis
          width={W}
          height={H}
          label={
            median == null
              ? "Bars need a 90-day median — not enough history yet"
              : "No price history yet"
          }
        />
      </div>
    );
  }

  const dates = points.map((p) => Date.parse(p.t));
  const prices = points.map((p) => Number(p.price));
  const deltas = prices.map((v) => ((v - median) / median) * 100);

  // The scale spans the data rather than being forced symmetric: a symmetric
  // axis leaves half the plot empty when a product has only ever been cheaper
  // than its median. This does NOT distort — zero stays at true zero on one
  // linear scale, so a −10% bar and a +10% bar are still exactly the same
  // length. Only the empty region is cropped.
  const rawLo = Math.min(0, ...deltas);
  const rawHi = Math.max(0, ...deltas);
  const headroom = Math.max((rawHi - rawLo) * 0.08, 1);
  const lo = rawLo - (rawLo < 0 ? headroom : 0);
  const hi = rawHi + (rawHi > 0 ? headroom : 0);
  const span = Math.max(hi - lo, 0.01);

  const minX = Math.min(...dates);
  const maxX = Math.max(...dates);
  const spanX = Math.max(maxX - minX, 1);

  const sx = (t: number) => pad.l + ((t - minX) / spanX) * plotW;
  const sy = (v: number) => pad.t + plotH - ((v - lo) / span) * plotH;
  const zeroY = sy(0);

  const bw = Math.max(1.5, (plotW / points.length) * 0.72);
  const ticks = niceTicks(lo, hi);

  return (
    <div className="rv-chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="rv-chart"
        role="img"
        aria-label={`Distance from the 90-day median across ${points.length} price checks`}
      >
        {ticks.map((v, i) => (
          <g key={i}>
            <line
              x1={pad.l} y1={sy(v)} x2={W - pad.r} y2={sy(v)}
              stroke={v === 0 ? "var(--ink-fade)" : "var(--rule)"}
              strokeWidth={v === 0 ? 1.5 : 1}
              strokeDasharray={v === 0 ? "6 5" : undefined}
            />
            <text
              x={pad.l - 8} y={sy(v) + 4} textAnchor="end"
              fontSize="11" className="rv-chart-axis" fill="var(--ink-fade)"
            >
              {v > 0 ? `+${v.toFixed(0)}%` : v.toFixed(0) + "%"}
            </text>
          </g>
        ))}

        {deltas.map((d, i) => {
          const cheaper = d < 0;
          const x = sx(dates[i]) - bw / 2;
          const y = cheaper ? zeroY : sy(d);
          const h = Math.max(Math.abs(sy(d) - zeroY), 1);
          return (
            <rect
              key={i}
              x={x} y={y} width={bw} height={h}
              fill={cheaper ? "var(--green)" : "var(--amber)"}
              className="rv-mark-hit"
              onPointerEnter={() =>
                show(((x + bw / 2) / W) * 100, ((cheaper ? zeroY : y) / H) * 100, (
                  <>
                    <span className="rv-tip-title">{formatMoney(prices[i], currency)}</span>
                    <span className="rv-tip-row">
                      {new Date(dates[i]).toLocaleDateString(undefined, {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </span>
                    <span className="rv-tip-row">
                      {d === 0
                        ? "at its median"
                        : `${Math.abs(d).toFixed(1)}% ${cheaper ? "below" : "above"} median`}
                    </span>
                  </>
                ))
              }
              onPointerLeave={hide}
            />
          );
        })}

        <text
          x={W - pad.r} y={pad.t - 10} textAnchor="end"
          fontSize="11" className="rv-chart-axis" fill="var(--ink-muted)"
        >
          zero line = its 90-day median, {formatMoney(median, currency)}
        </text>
      </svg>
      <ChartTooltip hover={hover} />
    </div>
  );
}

// ── Table view — the raw record ───────────────────────────────────────────
// Only rows where the price actually CHANGED. The API forward-fills one point
// per day, so a literal dump would be ~90 near-identical rows that bury the
// handful of moments that matter. The total check count is stated in the
// caption so nothing looks concealed.
export function PriceTable({
  points,
  median90d,
  currency = "USD",
}: {
  points: PricePointLike[];
  median90d?: number | null;
  currency?: string;
}) {
  const median = median90d != null ? Number(median90d) : null;

  const changes: { t: number; price: number; prev: number | null }[] = [];
  points.forEach((p, i) => {
    const price = Number(p.price);
    const prev = i === 0 ? null : Number(points[i - 1].price);
    if (i === 0 || price !== prev) changes.push({ t: Date.parse(p.t), price, prev });
  });
  changes.reverse();

  if (changes.length === 0) {
    return <p className="rv-ptable-empty">No price checks recorded yet.</p>;
  }

  return (
    <div className="rv-ptable-wrap">
      <table className="rv-ptable">
        <caption className="rv-ptable-caption">
          {changes.length} price {changes.length === 1 ? "change" : "changes"} across{" "}
          {points.length} daily checks &mdash; newest first
        </caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col" className="rv-ptable-num">Price</th>
            <th scope="col" className="rv-ptable-num">Change</th>
            <th scope="col" className="rv-ptable-num">vs median</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => {
            const diff = c.prev == null ? null : c.price - c.prev;
            const vsMedian =
              median != null && median > 0 ? ((c.price - median) / median) * 100 : null;
            return (
              <tr key={c.t}>
                <td className="rv-num">
                  {new Date(c.t).toLocaleDateString(undefined, {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                </td>
                <td className="rv-ptable-num rv-num">{formatMoney(c.price, currency)}</td>
                <td className="rv-ptable-num rv-num">
                  {diff == null ? (
                    <span className="rv-ptable-muted">first check</span>
                  ) : (
                    <span className={diff < 0 ? "rv-ptable-down" : "rv-ptable-up"}>
                      {diff < 0 ? "−" : "+"}
                      {formatMoney(Math.abs(diff), currency)}
                    </span>
                  )}
                </td>
                <td className="rv-ptable-num rv-num">
                  {vsMedian == null ? (
                    <span className="rv-ptable-muted">&mdash;</span>
                  ) : (
                    (() => {
                      // Sign off the ROUNDED value: a −0.015% reading would
                      // otherwise print as "−0.0%", which reads as a mistake.
                      const shown = Math.abs(vsMedian).toFixed(1);
                      const isZero = shown === "0.0";
                      return (
                        <span
                          className={
                            isZero ? "rv-ptable-muted" : vsMedian < 0 ? "rv-ptable-down" : "rv-ptable-up"
                          }
                        >
                          {isZero ? "" : vsMedian < 0 ? "−" : "+"}
                          {shown}%
                        </span>
                      );
                    })()
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const PRICE_VIEW_STYLES = `
  .rv-ptable-wrap { max-height: 420px; overflow-y: auto; overflow-x: auto; }
  .rv-ptable { width: 100%; border-collapse: collapse; font-size: 13px; }
  .rv-ptable-caption {
    caption-side: top; text-align: left; padding: 0 0 14px;
    font-family: var(--font-mono); font-size: 11px; letter-spacing: .06em;
    color: var(--ink-muted);
  }
  .rv-ptable th, .rv-ptable td {
    padding: 9px 12px; border-bottom: 1px solid var(--rule); text-align: left;
  }
  .rv-ptable thead th {
    position: sticky; top: 0; background: var(--paper); z-index: 1;
    font-family: var(--font-mono); font-size: 10.5px; font-weight: 600;
    text-transform: uppercase; letter-spacing: .1em; color: var(--ink-muted);
    border-bottom-color: var(--rule-strong); white-space: nowrap;
  }
  .rv-ptable-num { text-align: right; }
  .rv-ptable-down { color: var(--green-deep); font-weight: 500; }
  .rv-ptable-up { color: var(--amber-deep); font-weight: 500; }
  .rv-ptable-muted { color: var(--ink-fade); }
  .rv-ptable-empty { font-size: 14px; color: var(--ink-muted); margin: 0; }
`;
