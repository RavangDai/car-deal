// frontend/src/ScoreModel.tsx
// The landing page's explanation of how a deal score is built.
//
// This section replaces BOTH the old "How it works" step list and the
// ScoreComposition analytics panel. It is the showcase for the actual
// mechanic, so two rules govern what it may say:
//
//   1. Every weight and label is imported from scoreModel.ts, which mirrors
//      backend/app/dealmath.py. Nothing is retyped here. If the model
//      changes, this section changes with it or the build breaks.
//   2. It is not called a prediction, a model in the ML sense, or an AI.
//      dealmath.py computes deterministic statistics over one product's own
//      price history. Claiming more than that on a page whose entire pitch
//      is "we keep the receipts" would be the one unforgivable copy error.
import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import {
  COMPONENT_COLOR,
  COMPONENT_LABEL,
  WEIGHT_DISCOUNT_DEPTH,
  WEIGHT_RARITY,
  WEIGHT_STABILITY,
  WEIGHT_FRESHNESS,
  type ScoreComponentKey,
} from "./scoreModel";
import { scrubTimeline, useReveal, prefersReducedMotion } from "./motion";

type Row = {
  key: ScoreComponentKey;
  weight: number;
  question: string;
  detail: string;
};

// Order is the fixed slot order from scoreModel.ts — a component's hue is
// its identity, so the sequence here must not be re-sorted by weight.
const ROWS: Row[] = [
  {
    key: "depth",
    weight: WEIGHT_DISCOUNT_DEPTH,
    question: "How far below its own normal price is it?",
    detail:
      "Measured against the 90-day median, not the retailer's “was” price. A price raised and then dropped back to baseline never moved the median, so it earns nothing here.",
  },
  {
    key: "rarity",
    weight: WEIGHT_RARITY,
    question: "How often has it actually been this cheap?",
    detail:
      "The share of tracked days the product cost more than it does right now. A price it hits every other week is not a deal.",
  },
  {
    key: "stability",
    weight: WEIGHT_STABILITY,
    question: "Was the price before the drop trustworthy?",
    detail:
      "A steady price is a real reference point. One that oscillates weekly is noise, and a discount measured against noise means nothing.",
  },
  {
    key: "freshness",
    weight: WEIGHT_FRESHNESS,
    question: "Did it drop recently enough to matter?",
    detail:
      "A cut from this morning is actionable. The same cut from three weeks ago has usually already been priced in.",
  },
];

export function ScoreExplainer() {
  const sectionRef = useReveal<HTMLDivElement>({ y: 44, stagger: 0.07 });
  const barsRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);

  // The composed bar assembles as the section scrolls through: each
  // segment grows from zero in slot order, and the headline figure counts
  // up alongside it.
  useEffect(() => {
    const el = barsRef.current;
    if (!el) return;

    const segments = Array.from(el.querySelectorAll<HTMLElement>(".rv-sm-seg"));
    const readout = scoreRef.current;
    if (!segments.length) return;

    if (prefersReducedMotion()) {
      gsap.set(segments, { scaleX: 1 });
      if (readout) readout.textContent = "93";
      return;
    }

    gsap.set(segments, { scaleX: 0, transformOrigin: "0% 50%" });

    return scrubTimeline(
      el,
      (tl) => {
        segments.forEach((seg) => {
          tl.to(seg, { scaleX: 1, duration: 1, ease: "power2.out" }, "<0.35");
        });
        if (readout) {
          const counter = { v: 0 };
          tl.to(
            counter,
            {
              v: 93,
              duration: 3,
              ease: "none",
              onUpdate: () => {
                readout.textContent = String(Math.round(counter.v));
              },
            },
            0,
          );
        }
      },
      { start: "top 78%", end: "bottom 78%" },
    );
  }, []);

  return (
    <section className="rv-sm" id="how" data-rv-section="how">
      <div className="rv-sm-inner" ref={sectionRef}>
        <header className="rv-sm-head">
          <p className="rv-eyebrow" data-reveal>
            The score
          </p>
          <h2 className="rv-display rv-sm-title" data-reveal>
            Four measurements.<br />One number.
          </h2>
          <p className="rv-sm-lede" data-reveal>
            Every product is scored against <em>its own</em> price history — never
            against a retailer&rsquo;s claim about what it used to cost. These four
            readings are weighted into a single 0–100 figure. No estimates, no
            guesses about the future: arithmetic over prices we recorded ourselves.
          </p>
        </header>

        <ol className="rv-sm-rows">
          {ROWS.map((row) => (
            <li className="rv-sm-row" key={row.key} data-reveal>
              <span
                className="rv-sm-chip"
                style={{ background: COMPONENT_COLOR[row.key] }}
                aria-hidden="true"
              />
              <span className="rv-sm-weight rv-num">
                {Math.round(row.weight * 100)}
                <i>%</i>
              </span>
              <span className="rv-sm-body">
                <span className="rv-sm-label">{COMPONENT_LABEL[row.key]}</span>
                <span className="rv-sm-question">{row.question}</span>
                <span className="rv-sm-detail">{row.detail}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="rv-sm-compose" ref={barsRef} data-reveal>
          <div className="rv-sm-compose-head">
            <span className="rv-panel-label">Weighted into one figure</span>
            <span className="rv-sm-compose-score">
              <span className="rv-num" ref={scoreRef}>
                0
              </span>
              <i className="rv-num">/100</i>
            </span>
          </div>

          <div className="rv-sm-bar" role="img" aria-label="Deal score composition: discount depth 40%, historical rarity 30%, pre-drop stability 20%, drop freshness 10%">
            {ROWS.map((row) => (
              <span
                key={row.key}
                className="rv-sm-seg"
                style={{
                  flexBasis: `${row.weight * 100}%`,
                  background: COMPONENT_COLOR[row.key],
                }}
              />
            ))}
          </div>

          <div className="rv-sm-legend">
            {ROWS.map((row) => (
              <span className="rv-sm-legend-item" key={row.key}>
                <span
                  className="rv-sm-legend-chip"
                  style={{ background: COMPONENT_COLOR[row.key] }}
                  aria-hidden="true"
                />
                {COMPONENT_LABEL[row.key]}
              </span>
            ))}
          </div>

          <p className="rv-sm-gate">
            Below 14 days of tracked history we show no score at all. A number we
            cannot stand behind is worse than no number.
          </p>
        </div>
      </div>
    </section>
  );
}

export const SCORE_MODEL_STYLES = `
  .rv-sm { padding: var(--space-section) 0; position: relative; }
  .rv-sm-inner {
    max-width: var(--measure); margin: 0 auto; padding: 0 var(--gutter);
  }

  .rv-sm-head { max-width: 46rem; margin-bottom: clamp(48px, 6vw, 84px); }
  .rv-sm-title {
    font-size: clamp(38px, 5.4vw, 68px);
    margin: 14px 0 0;
  }
  .rv-sm-lede {
    margin: 22px 0 0; max-width: 40rem;
    font-size: clamp(15.5px, 1.35vw, 17.5px); line-height: 1.62;
    color: var(--ink-soft);
  }
  .rv-sm-lede em { font-style: italic; }

  /* ── The four readings ── */
  .rv-sm-rows {
    list-style: none; margin: 0 0 clamp(48px, 6vw, 80px); padding: 0;
    border-top: 1px solid var(--rule);
  }
  .rv-sm-row {
    display: grid;
    grid-template-columns: 10px 4.5rem minmax(0, 1fr);
    align-items: start; gap: 20px;
    padding: 28px 0;
    border-bottom: 1px solid var(--rule);
  }
  .rv-sm-chip {
    width: 10px; height: 10px; border-radius: var(--r-pill);
    margin-top: 7px;
  }
  .rv-sm-weight {
    font-size: 28px; font-weight: 600; letter-spacing: -0.03em;
    color: var(--ink); line-height: 1;
  }
  .rv-sm-weight i { font-size: 13px; font-style: normal; color: var(--ink-fade); }
  .rv-sm-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .rv-sm-label {
    font-family: var(--font-mono); font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: .13em; color: var(--ink-muted);
  }
  .rv-sm-question {
    font-size: clamp(17px, 1.7vw, 21px); font-weight: 600;
    letter-spacing: -0.02em; line-height: 1.32; color: var(--ink);
  }
  .rv-sm-detail {
    font-size: 14.5px; line-height: 1.6; color: var(--ink-muted);
    max-width: 38rem;
  }

  /* ── The composition ── */
  .rv-sm-compose {
    padding: clamp(26px, 3vw, 38px);
    border-radius: var(--r-card);
    background: linear-gradient(180deg, rgba(255,255,255,.75), rgba(255,255,255,.35));
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.9),
      0 0 0 1px rgba(27,26,22,.06),
      var(--shadow-md);
  }
  .rv-sm-compose-head {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 20px; margin-bottom: 18px;
  }
  .rv-sm-compose-score {
    display: inline-flex; align-items: baseline; gap: 3px;
    font-weight: 600; letter-spacing: -0.03em; color: var(--ink);
  }
  .rv-sm-compose-score > .rv-num { font-size: clamp(36px, 4.5vw, 54px); line-height: 1; }
  .rv-sm-compose-score i { font-size: 15px; font-style: normal; color: var(--ink-fade); }

  .rv-sm-bar {
    display: flex; width: 100%; height: 14px; gap: 3px;
    border-radius: var(--r-pill); overflow: hidden;
  }
  .rv-sm-seg {
    display: block; height: 100%; flex-grow: 0; flex-shrink: 0;
    border-radius: 2px;
  }
  .rv-sm-seg:first-child { border-radius: var(--r-pill) 2px 2px var(--r-pill); }
  .rv-sm-seg:last-child  { border-radius: 2px var(--r-pill) var(--r-pill) 2px; }

  .rv-sm-legend {
    display: flex; flex-wrap: wrap; gap: 8px 20px; margin-top: 16px;
  }
  .rv-sm-legend-item {
    display: inline-flex; align-items: center; gap: 7px;
    font-family: var(--font-mono); font-size: 10.5px; font-weight: 500;
    text-transform: uppercase; letter-spacing: .1em; color: var(--ink-muted);
  }
  .rv-sm-legend-chip { width: 8px; height: 8px; border-radius: var(--r-pill); flex: none; }

  .rv-sm-gate {
    margin: 20px 0 0; padding-top: 16px; border-top: 1px solid var(--rule);
    font-size: 13.5px; line-height: 1.6; color: var(--ink-muted); max-width: 44rem;
  }

  @media (max-width: 720px) {
    .rv-sm-row {
      grid-template-columns: 8px minmax(0, 1fr);
      gap: 14px; padding: 22px 0;
    }
    .rv-sm-weight {
      grid-column: 2; font-size: 22px; order: -1;
    }
    .rv-sm-body { grid-column: 2; }
    .rv-sm-chip { grid-row: 1 / span 2; margin-top: 5px; }
  }
`;
