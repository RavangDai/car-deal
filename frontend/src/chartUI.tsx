// frontend/src/chartUI.tsx
// The shared chart furniture: a legend and a tooltip. Dependency-free,
// like the charts themselves. The hover behaviour that drives the tooltip
// lives in chartHooks.ts.
import type { ReactNode } from "react";
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

// ── View controls ─────────────────────────────────────────────────────────

/** Segmented control — one choice from a short, visible set. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="rv-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`rv-seg-btn${value === o.value ? " is-active" : ""}`}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A toggle for one chart overlay. The swatch shows the colour the overlay
 * actually draws in, so the control is self-describing without a legend.
 */
export function OverlayToggle({
  checked,
  onChange,
  children,
  swatch,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  /** CSS colour of the mark this toggle governs. */
  swatch?: string;
}) {
  return (
    <label className={`rv-toggle${checked ? " is-on" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rv-toggle-input"
      />
      <span className="rv-toggle-box" aria-hidden="true">
        {checked && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {swatch && <span className="rv-toggle-swatch" style={{ background: swatch }} aria-hidden="true" />}
      <span className="rv-toggle-label">{children}</span>
    </label>
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

  /* ── Segmented control ── */
  .rv-seg { display: inline-flex; gap: 2px; }
  .rv-seg-btn {
    font-family: var(--font-mono); font-size: 11px; font-weight: 600; letter-spacing: .08em;
    text-transform: uppercase; padding: 6px 11px; cursor: pointer;
    color: var(--ink-muted); background: var(--paper-pale);
    border: 1px solid var(--rule-strong);
    transition: background-color var(--dur-fast) ease, color var(--dur-fast) ease,
                border-color var(--dur-fast) ease;
  }
  .rv-seg-btn:hover { color: var(--ink); border-color: var(--ink); }
  .rv-seg-btn.is-active {
    background: var(--ink); color: var(--paper); border-color: var(--ink);
  }

  /* ── Overlay toggle ── */
  .rv-toggle {
    display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
    user-select: none; padding: 4px 0;
  }
  .rv-toggle-input { position: absolute; opacity: 0; width: 0; height: 0; }
  .rv-toggle-box {
    display: grid; place-items: center; width: 16px; height: 16px; flex: none;
    border: 1px solid var(--rule-strong); background: var(--paper-pale);
    border-radius: var(--r-sm); color: var(--paper);
    transition: background-color var(--dur-fast) ease, border-color var(--dur-fast) ease;
  }
  .rv-toggle.is-on .rv-toggle-box { background: var(--ink); border-color: var(--ink); }
  .rv-toggle-input:focus-visible + .rv-toggle-box { outline: 2px solid var(--ink); outline-offset: 2px; }
  .rv-toggle-swatch { width: 10px; height: 10px; border-radius: 2px; flex: none; }
  .rv-toggle-label { font-size: 12.5px; color: var(--ink-soft); white-space: nowrap; }
  .rv-toggle:hover .rv-toggle-label { color: var(--ink); }

  /* ── The strip that holds them ── */
  .rv-viewbar {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px 24px; flex-wrap: wrap;
    padding-bottom: 16px; margin-bottom: 18px;
    border-bottom: 1px solid var(--rule);
  }
  .rv-viewbar-overlays { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
`;
