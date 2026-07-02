// frontend/src/primitives.tsx
// Shared UI primitives, injected once at the app-shell level (App.tsx) so
// every page composes the same eyebrow/button/double-bezel/grain classes
// instead of redeclaring near-duplicate rule sets per page. Page-specific
// layout CSS (hero grid, deals table, login split-screen, legal typography)
// stays in each page's own file and references these classes directly.
import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// Standard trailing arrow — always meant to sit inside a .rv-btn-icon circle
// on a primary/CTA button (button-in-button), or bare on a plain text link.
export function Arrow({ size = 14 }: { size?: number }) {
  return <ArrowRight size={size} strokeWidth={2.4} className="rv-btn-arrow" />;
}

// Confidence-interval rail — the fair-value range visualization shared by the
// deals table's expanded row and the hero carousel's per-slide mini chart.
export function ConfidenceRail({
  low,
  high,
  fair,
  lowVal,
  highVal,
  fairVal,
  compact = false,
}: {
  low: number;
  high: number;
  fair: number;
  lowVal: string;
  highVal: string;
  fairVal: string;
  compact?: boolean;
}) {
  return (
    <div className={`rv-ci${compact ? " rv-ci-compact" : ""}`}>
      <div className="rv-ci-rail">
        <div className="rv-ci-fill" style={{ left: `${low}%`, width: `${high - low}%` }} />
        <div className="rv-ci-mark" style={{ left: `${fair}%` }} />
      </div>
      <div className="rv-ci-labels">
        <span>${lowVal}k</span>
        <span className="rv-ci-fair">fair · ${fairVal}k</span>
        <span>${highVal}k</span>
      </div>
    </div>
  );
}

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 44, filter: "blur(6px)" }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

export const PRIMITIVE_STYLES = `
  /* ── Eyebrow — small uppercase label, shared by every page. ── */
  .rv-eyebrow {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 11.5px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--ink-muted);
  }
  .rv-eyebrow-accent { color: var(--primary); }

  /* ── Buttons ── */
  .rv-btn {
    display: inline-flex; align-items: center; gap: 8px;
    font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 14px;
    border-radius: 10px; padding: 10px 16px; cursor: pointer;
    transition: background-color .18s ease, border-color .18s ease, color .18s ease, transform .2s var(--ease-out-expo);
    white-space: nowrap; border: 1px solid transparent;
  }
  .rv-btn:active:not(:disabled) { transform: scale(.98); }
  .rv-btn-primary { background: var(--primary); color: #fff; box-shadow: 0 1px 2px rgba(37,99,235,.24); transition: background-color .18s ease, box-shadow .25s var(--ease-out-expo), transform .2s var(--ease-out-expo); }
  .rv-btn-primary:hover:not(:disabled) { background: var(--primary-deep); box-shadow: 0 4px 16px rgba(37,99,235,.32); }
  .rv-btn-primary:disabled { opacity: .6; cursor: wait; }
  .rv-btn-ghost { background: transparent; color: var(--ink); border-color: var(--rule-strong); }
  .rv-btn-ghost:hover { border-color: var(--ink); }
  .rv-btn-ghost-light { background: rgba(255,255,255,.08); color: #fff; border-color: rgba(255,255,255,.42); }
  .rv-btn-ghost-light:hover { background: rgba(255,255,255,.16); border-color: #fff; }
  .rv-btn-outline { background: var(--paper-pale); color: var(--ink); border-color: var(--rule-strong); }
  .rv-btn-outline:hover { border-color: var(--ink); }
  .rv-btn-lg { padding: 13px 22px; font-size: 15px; }
  .rv-btn-xl { padding: 15px 26px; font-size: 16px; border-radius: 12px; }
  .rv-btn-sm { padding: 8px 13px; font-size: 13px; border-radius: 8px; }
  .rv-btn-arrow { transition: transform .35s var(--ease-out-expo); }
  .rv-btn:hover .rv-btn-arrow { transform: translateX(3px); }

  /* Button-in-button trailing icon — an arrow never sits naked next to the
     label; it lives in its own circular wrapper flush with the button's
     inner padding, with its own hover kinetic tension. */
  .rv-btn-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: var(--btn-icon-size); height: var(--btn-icon-size);
    margin-right: -6px; border-radius: 999px;
    background: rgba(255,255,255,.16);
    transition: transform .35s var(--ease-out-expo), background-color .2s ease;
  }
  .rv-btn-outline .rv-btn-icon,
  .rv-btn-ghost .rv-btn-icon { background: rgba(15,23,42,.06); }
  .rv-btn-sm .rv-btn-icon { width: var(--btn-icon-size-sm); height: var(--btn-icon-size-sm); margin-right: -4px; }
  .rv-btn-lg .rv-btn-icon, .rv-btn-xl .rv-btn-icon { width: var(--btn-icon-size-lg); height: var(--btn-icon-size-lg); }
  .rv-btn:hover .rv-btn-icon { transform: translate(2px, -1px) scale(1.06); background: rgba(255,255,255,.26); }
  .rv-btn-outline:hover .rv-btn-icon,
  .rv-btn-ghost:hover .rv-btn-icon { background: rgba(15,23,42,.1); }

  /* ── Confidence-interval rail — fair-value range visualization, shared by
     the deals table and the hero carousel. Always green (positive/savings
     signal family). ── */
  .rv-ci-rail { position: relative; height: 8px; background: var(--rule); border-radius: 4px; margin: 4px 0 8px; }
  .rv-ci-fill { position: absolute; top: 0; height: 100%; background: var(--green-tint); border-radius: 4px; }
  .rv-ci-mark { position: absolute; top: -2px; width: 2px; height: 12px; background: var(--green-deep); }
  .rv-ci-labels { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--ink-muted); font-variant-numeric: tabular-nums; }
  .rv-ci-fair { color: var(--green); font-weight: 700; }
  .rv-ci-compact .rv-ci-rail { height: 6px; margin: 3px 0 5px; }
  .rv-ci-compact .rv-ci-labels { font-size: 10px; }

  /* ── Double-bezel — a card never sits flatly on the canvas. Outer shell:
     faint tint + hairline ring + generous padding + large radius. Inner
     core: its own surface, a soft inset highlight, a mathematically smaller
     concentric radius. ── */
  .rv-bezel {
    background: var(--bezel-shell-bg);
    box-shadow: var(--bezel-shell-ring);
    border-radius: var(--bezel-radius-outer);
    padding: var(--bezel-pad);
  }
  .rv-bezel-core {
    background: var(--paper-pale);
    border-radius: var(--bezel-radius-inner);
    box-shadow: var(--bezel-core-highlight), var(--shadow-sm);
  }

  /* ── Grain — a fixed, pointer-events-none texture layer, applied once at
     the app shell. Never attached to a scrolling container (perf). ── */
  .rv-grain {
    position: fixed; inset: 0; z-index: var(--z-grain);
    pointer-events: none;
    opacity: var(--noise-opacity);
    mix-blend-mode: multiply;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  @media (prefers-reduced-motion: reduce) {
    .rv-btn, .rv-btn-arrow, .rv-btn-icon { transition: none !important; }
  }
`;
