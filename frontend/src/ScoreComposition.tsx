// frontend/src/ScoreComposition.tsx
// Today's top deals as stacked bars — one bar per product, each segment a
// score component's REAL point contribution (weight × sub-score), so the
// bars total each product's deal score out of 100.
//
// Why this chart exists: the ScoreBar explains ONE product, and the index
// ranks products by a single number. Neither lets you compare *composition*
// across products — that a 90 built on a deep, stable, long-standing
// discount is a different animal from a 90 built mostly on freshness. That
// comparison is the only thing this chart does.
//
// Nothing here is derived from anything but ProductStats: a product with no
// stats is filtered out rather than drawn at zero.
import { useEffect, useRef, useState } from "react";
import type { Product } from "./api";
import { formatMoney } from "./format";
import {
  scoreComponents,
  COMPONENT_COLOR,
  COMPONENT_LABEL,
  type ScoreComponentKey,
} from "./scoreModel";
import { ChartLegend, ChartTooltip } from "./chartUI";
import { useMarkHover } from "./chartHooks";

type Stacked = {
  product: Product;
  total: number;
  parts: { key: ScoreComponentKey; label: string; points: number; readout: string }[];
};

function buildStacks(products: Product[], limit: number): Stacked[] {
  return products
    .filter((p) => p.deal_score != null && p.stats != null)
    .slice(0, limit)
    .map((p) => {
      const parts = scoreComponents(p.stats!).map((c) => ({
        key: c.key,
        label: c.label,
        // The component's actual contribution to the 0–100 score.
        points: (c.value ?? 0) * c.weight * 100,
        readout: c.readout,
      }));
      return {
        product: p,
        total: parts.reduce((s, x) => s + x.points, 0),
        parts,
      };
    });
}

export function ScoreComposition({
  products,
  limit = 8,
}: {
  products: Product[];
  limit?: number;
}) {
  const { hover, show, hide } = useMarkHover();
  const [asTable, setAsTable] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [boxW, setBoxW] = useState(900);

  // The viewBox is set to the container's real pixel width so one unit is
  // one CSS pixel. Without this the SVG scales its own text down with the
  // viewport — at 390px the axis labels rendered around 4px tall.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setBoxW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fewer bars on a narrow screen — eight in 340px is a barcode, not a chart.
  const shown = boxW < 460 ? 4 : boxW < 720 ? 5 : limit;
  const stacks = buildStacks(products, shown);

  if (stacks.length === 0) return null;

  const W = Math.max(boxW, 280);
  const H = boxW < 460 ? 260 : 300;
  const pad = { l: 34, r: 12, t: 16, b: 70 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const slot = plotW / stacks.length;
  const barW = Math.min(slot * 0.56, 64);
  const nameMax = Math.max(6, Math.floor(slot / 8));

  // One axis, always 0–100: the score's own scale. Never re-scaled to the
  // data's max, which would make a weak field look strong.
  const sy = (v: number) => pad.t + plotH - (v / 100) * plotH;

  const legendItems = (Object.keys(COMPONENT_LABEL) as ScoreComponentKey[]).map((k) => ({
    label: COMPONENT_LABEL[k],
    color: COMPONENT_COLOR[k],
  }));

  return (
    <div className="rv-comp">
      <div className="rv-comp-head">
        <ChartLegend items={legendItems} />
        <button
          type="button"
          className="rv-comp-toggle"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
        >
          {asTable ? "Show as chart" : "Show as table"}
        </button>
      </div>

      {asTable ? (
        <div className="rv-comp-table-wrap">
          <table className="rv-comp-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                {(Object.keys(COMPONENT_LABEL) as ScoreComponentKey[]).map((k) => (
                  <th scope="col" key={k} className="rv-comp-th-num">{COMPONENT_LABEL[k]}</th>
                ))}
                <th scope="col" className="rv-comp-th-num">Score</th>
              </tr>
            </thead>
            <tbody>
              {stacks.map((s) => (
                <tr key={s.product.id}>
                  <th scope="row" className="rv-comp-td-name">
                    <a href={`#/product/${s.product.id}`}>{s.product.title ?? s.product.domain}</a>
                  </th>
                  {s.parts.map((p) => (
                    <td key={p.key} className="rv-comp-td-num rv-num">{p.points.toFixed(1)}</td>
                  ))}
                  <td className="rv-comp-td-num rv-comp-td-total rv-num">{s.total.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rv-chart-wrap" ref={wrapRef}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            className="rv-chart"
            role="img"
            aria-label={`Deal score composition for the top ${stacks.length} products. ${stacks
              .map((s) => `${s.product.title ?? s.product.domain}: ${s.total.toFixed(0)}`)
              .join(". ")}`}
          >
            {[0, 25, 50, 75, 100].map((v) => (
              <g key={v}>
                <line
                  x1={pad.l} y1={sy(v)} x2={W - pad.r} y2={sy(v)}
                  stroke={v === 0 ? "var(--rule-strong)" : "var(--rule)"} strokeWidth="1"
                />
                <text
                  x={pad.l - 8} y={sy(v) + 4} textAnchor="end"
                  fontSize="11" className="rv-chart-axis" fill="var(--ink-fade)"
                >
                  {v}
                </text>
              </g>
            ))}

            {stacks.map((s, i) => {
              const cx = pad.l + slot * i + slot / 2;
              const x = cx - barW / 2;
              let cursor = 0;
              const name = s.product.title ?? s.product.domain;
              return (
                <g key={s.product.id}>
                  {s.parts.map((p) => {
                    const y0 = sy(cursor + p.points);
                    const y1 = sy(cursor);
                    cursor += p.points;
                    // 2px surface gap between stacked segments so adjacent
                    // fills never blend into one another.
                    const h = Math.max(y1 - y0 - 2, 0);
                    if (h <= 0) return null;
                    return (
                      <rect
                        key={p.key}
                        x={x} y={y0} width={barW} height={h}
                        fill={COMPONENT_COLOR[p.key]}
                        className="rv-mark-hit"
                        onPointerEnter={() =>
                          show((cx / W) * 100, (y0 / H) * 100, (
                            <>
                              <span className="rv-tip-title">{name}</span>
                              <span className="rv-tip-row">
                                <span className="rv-tip-dot" style={{ background: COMPONENT_COLOR[p.key] }} />
                                {p.label}
                                <span className="rv-tip-strong">{p.points.toFixed(1)} pts</span>
                              </span>
                              <span className="rv-tip-row">{p.readout}</span>
                            </>
                          ))
                        }
                        onPointerLeave={hide}
                      />
                    );
                  })}

                  <text
                    x={cx} y={sy(s.total) - 8} textAnchor="middle"
                    fontSize="13" className="rv-chart-figure" fill="var(--ink)" fontWeight="600"
                    pointerEvents="none"
                  >
                    {s.total.toFixed(0)}
                  </text>

                  <text
                    x={cx} y={pad.t + plotH + 18} textAnchor="middle"
                    fontSize="11" className="rv-chart-axis" fill="var(--ink-muted)"
                    pointerEvents="none"
                  >
                    {name.length > nameMax ? `${name.slice(0, nameMax - 1)}…` : name}
                  </text>
                  <text
                    x={cx} y={pad.t + plotH + 34} textAnchor="middle"
                    fontSize="11" className="rv-chart-figure" fill="var(--ink-fade)"
                    pointerEvents="none"
                  >
                    {s.product.latest_price != null
                      ? formatMoney(s.product.latest_price, s.product.currency ?? "USD")
                      : "—"}
                  </text>
                </g>
              );
            })}
          </svg>
          <ChartTooltip hover={hover} />
        </div>
      )}
    </div>
  );
}

export const SCORE_COMPOSITION_STYLES = `
  .rv-comp-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 20px; flex-wrap: wrap; margin-bottom: 18px;
  }
  .rv-comp-toggle {
    font-family: var(--font-mono); font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: .1em; color: var(--ink);
    background: none; cursor: pointer; padding: 6px 10px;
    border: 1px solid var(--rule-strong); border-radius: var(--r-md); flex: none;
    transition: background-color var(--dur-fast) ease, border-color var(--dur-fast) ease;
  }
  .rv-comp-toggle:hover { background: var(--paper-deep); border-color: var(--ink); }

  .rv-comp-table-wrap { overflow-x: auto; }
  .rv-comp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .rv-comp-table th, .rv-comp-table td {
    padding: 9px 10px; border-bottom: 1px solid var(--rule); text-align: left;
  }
  .rv-comp-table thead th {
    font-family: var(--font-mono); font-size: 10.5px; font-weight: 600;
    text-transform: uppercase; letter-spacing: .1em; color: var(--ink-muted);
    border-bottom-color: var(--rule-strong); white-space: nowrap;
  }
  .rv-comp-th-num, .rv-comp-td-num { text-align: right; }
  .rv-comp-td-name { font-weight: 500; }
  .rv-comp-td-name a { color: var(--ink); text-decoration: none; }
  .rv-comp-td-name a:hover { text-decoration: underline; text-underline-offset: 3px; }
  .rv-comp-td-total { font-weight: 600; }

  @media (max-width: 760px) {
    .rv-comp-head { gap: 12px; }
  }
`;
