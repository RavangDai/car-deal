// frontend/src/chartUI.tsx
// The shared chart furniture: a legend and a tooltip. Dependency-free,
// like the charts themselves. The hover behaviour that drives the tooltip
// lives in chartHooks.ts.
import type { HoverState } from "./chartHooks";

// ── Legend ────────────────────────────────────────────────────────────────
// Required whenever a chart carries ≥2 series, so identity is never colour
// alone. A single-series chart gets none — its title names it.
export function ChartLegend({
  items,
  className,
}: {
  items: { label: string; color: string; value?: string }[];
  className?: string;
}) {
  return (
    <ul className={`rv-legend-list${className ? ` ${className}` : ""}`}>
      {items.map((it) => (
        <li key={it.label} className="rv-legend-item">
          <span className="rv-legend-dot" style={{ background: it.color }} aria-hidden="true" />
          <span className="rv-legend-label">{it.label}</span>
          {it.value != null && <span className="rv-legend-value rv-num">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}

// ── Hover layer ───────────────────────────────────────────────────────────

/**
 * Positions a tooltip inside a `position: relative` chart wrapper.
 * Flips below the anchor when it would escape the top of the chart, and
 * clamps horizontally so it never runs off either edge — a tooltip that
 * covers the legend it is explaining is worse than no tooltip.
 */
export function ChartTooltip({ hover }: { hover: HoverState }) {
  if (!hover) return null;
  const below = hover.y < 26;
  const x = Math.min(94, Math.max(6, hover.x));
  return (
    <div
      className={`rv-tip${below ? " rv-tip-below" : ""}`}
      style={{ left: `${x}%`, top: `${hover.y}%` }}
      role="status"
      aria-live="polite"
    >
      {hover.content}
    </div>
  );
}

export const CHART_UI_STYLES = `
  /* ── Legend — a dot carries identity, the text stays in ink tokens.
     Never colour the label text itself: the mark beside it does that job. ── */
  .rv-legend-list {
    display: flex; flex-wrap: wrap; gap: 6px 18px;
    list-style: none; margin: 0; padding: 0;
  }
  .rv-legend-item { display: inline-flex; align-items: center; gap: 7px; min-width: 0; }
  .rv-legend-dot { width: 9px; height: 9px; border-radius: 2px; flex: none; }
  .rv-legend-label { font-size: 12.5px; color: var(--ink-soft); white-space: nowrap; }
  .rv-legend-value {
    font-size: 12.5px; color: var(--ink); font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  /* ── Chart frame + tooltip ── */
  .rv-chart-wrap { position: relative; }
  .rv-tip {
    position: absolute; z-index: var(--z-raised-2);
    transform: translate(-50%, -100%);
    margin-top: -10px; pointer-events: none;
    max-width: 260px; white-space: normal;
    background: var(--ink); color: var(--paper);
    padding: 7px 10px; border-radius: var(--r-md);
    font-size: 12px; line-height: 1.45;
    box-shadow: var(--shadow-md);
  }
  .rv-tip-below { transform: translate(-50%, 0); margin-top: 12px; }
  .rv-tip-title { font-weight: 600; display: block; }
  .rv-tip-row {
    display: flex; align-items: center; gap: 7px;
    font-family: var(--font-mono); font-variant-numeric: tabular-nums;
    color: rgba(244,243,239,.82);
  }
  .rv-tip-dot { width: 8px; height: 8px; border-radius: 2px; flex: none; }
  .rv-tip-strong { color: var(--paper); font-weight: 600; }

  /* Marks are hit targets — bigger than the drawn mark. */
  .rv-mark-hit { cursor: pointer; }
  .rv-mark-hit:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; }
`;
