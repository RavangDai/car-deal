// frontend/src/ScoreBar.tsx
// The deal score, shown as what it actually is: a weighted blend of four
// measured components. Each segment's WIDTH is that component's weight in
// dealmath.py; its FILL is the component's real sub-score. So the amount
// of ink on this bar is literally the score out of 100, and a product can
// be read at a glance — "deep discount but the price is unstable" is a
// visibly different shape from "shallow discount held for months".
//
// The model itself lives in scoreModel.ts so this file only draws.
import type { ProductStats } from "./api";
import {
  COMPONENT_COLOR,
  scoreComponents,
  WEIGHT_DISCOUNT_DEPTH,
  WEIGHT_FRESHNESS,
  WEIGHT_RARITY,
  WEIGHT_STABILITY,
} from "./scoreModel";

export function ScoreBar({
  score,
  stats,
  compact = false,
}: {
  score: number | null;
  stats: ProductStats | null;
  compact?: boolean;
}) {
  if (score == null || !stats) {
    return (
      <div className="rv-scorebar rv-scorebar-locked">
        <div className="rv-scorebar-track" aria-hidden="true">
          {[WEIGHT_DISCOUNT_DEPTH, WEIGHT_RARITY, WEIGHT_STABILITY, WEIGHT_FRESHNESS].map((w, i) => (
            <div key={i} className="rv-scorebar-seg" style={{ flexGrow: w }} />
          ))}
        </div>
        <p className="rv-scorebar-locked-note">
          The score unlocks after 14 days of tracking. Until then there isn&rsquo;t enough history to tell a
          real drop from a temporary one.
        </p>
      </div>
    );
  }

  const components = scoreComponents(stats);

  return (
    <div className="rv-scorebar">
      <div
        className="rv-scorebar-track"
        role="img"
        aria-label={`Deal score ${Math.round(score)} of 100. ${components
          .map((c) => `${c.label}: ${c.readout}`)
          .join(". ")}`}
      >
        {components.map((c) => (
          <div
            key={c.key}
            className="rv-scorebar-seg"
            style={{ flexGrow: c.weight }}
            title={`${c.label} — ${c.readout} (${Math.round((c.value ?? 0) * c.weight * 100)} of ${Math.round(c.weight * 100)} points)`}
          >
            <div
              className="rv-scorebar-fill"
              style={{ width: `${(c.value ?? 0) * 100}%`, background: COMPONENT_COLOR[c.key] }}
            />
          </div>
        ))}
      </div>

      {/* The BAR carries the weights — that's what the segment widths mean.
          The legend below is equal columns: at 10% the freshness column
          would be too narrow to hold its own label.

          The colour dot is what makes four segments readable at a glance,
          and the readout under each is also the contrast-relief channel
          two of the four slots require (they sit below 3:1 on paper). */}
      {!compact && (
        <dl className="rv-scorebar-legend">
          {components.map((c) => (
            <div key={c.key} className="rv-scorebar-item">
              <dt>
                <span className="rv-scorebar-item-label">
                  <span
                    className="rv-legend-dot"
                    style={{ background: COMPONENT_COLOR[c.key] }}
                    aria-hidden="true"
                  />
                  {c.label}
                </span>
                <span className="rv-scorebar-item-weight rv-num">{Math.round(c.weight * 100)}%</span>
              </dt>
              <dd className="rv-scorebar-item-readout rv-num">{c.readout}</dd>
              <dd className="rv-scorebar-item-explain">{c.explain}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export const SCOREBAR_STYLES = `
  .rv-scorebar-track {
    display: flex; gap: 3px; height: 34px;
    background: var(--paper-deep);
  }
  /* The unfilled remainder is the points the component did NOT earn. */
  .rv-scorebar-seg { position: relative; background: var(--series-empty); overflow: hidden; flex-basis: 0; }
  .rv-scorebar-fill {
    position: absolute; inset: 0 auto 0 0;
    animation: rv-fill .7s var(--ease-out-expo) both;
  }
  @keyframes rv-fill { from { width: 0 !important; } }

  .rv-scorebar-locked .rv-scorebar-track { opacity: .55; }
  .rv-scorebar-locked-note {
    margin-top: 12px; font-size: 13.5px; line-height: 1.55; color: var(--ink-muted); max-width: 46ch;
  }

  .rv-scorebar-legend {
    display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 22px; margin: 14px 0 0;
  }
  .rv-scorebar-item { min-width: 0; }
  .rv-scorebar-item dt {
    display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
    padding-bottom: 5px; border-bottom: 1px solid var(--rule);
  }
  .rv-scorebar-item-label {
    display: inline-flex; align-items: center; gap: 7px; min-width: 0;
    font-size: 12.5px; font-weight: 600; color: var(--ink); letter-spacing: -0.01em;
  }
  .rv-scorebar-item-weight { font-size: 11px; color: var(--ink-fade); flex: none; }
  /* Text wears text tokens, never the series colour — the dot beside the
     label is what carries identity. */
  .rv-scorebar-item-readout { margin: 7px 0 0; font-size: 12.5px; color: var(--ink-soft); font-weight: 500; }
  .rv-scorebar-item-explain { margin: 5px 0 0; font-size: 12px; line-height: 1.5; color: var(--ink-muted); }

  @media (max-width: 860px) {
    .rv-scorebar-legend { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .rv-scorebar-item-explain { display: none; }
  }
  @media (max-width: 520px) {
    .rv-scorebar-legend { grid-template-columns: minmax(0, 1fr); }
  }
  @media (prefers-reduced-motion: reduce) {
    .rv-scorebar-fill { animation: none; }
  }
`;
