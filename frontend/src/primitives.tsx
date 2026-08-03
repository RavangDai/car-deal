// frontend/src/primitives.tsx
// Shared UI primitives, injected once at the app-shell level (App.tsx) so
// every page composes the same nav/button/panel/stamp classes instead of
// redeclaring near-duplicate rule sets per page. Page-specific layout CSS
// (hero grid, index table, login split, legal typography) stays in each
// page's own file and references these classes directly.
//
// Direction: "instrument". The chrome is deliberately quiet — hairline
// rules, no cards, no shadows on content — so that the DEAL FACTS can be
// loud. Delta, Score and Stamp are the loud primitives; everything else
// gets out of their way. That contrast is the whole mechanic.
import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// Standard trailing arrow — sits inline after a button/link label.
export function Arrow({ size = 14 }: { size?: number }) {
  return <ArrowRight size={size} strokeWidth={2.4} className="rv-btn-arrow" />;
}

// On-mount fade-up. Deliberately NOT whileInView: a scroll-gated reveal
// ships blank in headless / non-scrolled renders, which is why the
// screenshot harness had to scroll the whole page before capturing.
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
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

// ── Wordmark — the step-line mark plus the name. The mark is the product:
// a price line stepping down onto the green datum.
export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <span className="rv-wordmark" style={{ fontSize: `${size * 0.78}px` }}>
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="rv-wordmark-mark">
        <rect width="48" height="48" fill="var(--ink)" />
        <path
          d="M6 15 H16 V22 H24 V19 H32 V31 H42"
          stroke="var(--paper)" strokeWidth="3.4" strokeLinecap="square" fill="none"
        />
        <path d="M32 31 H42" stroke="var(--green)" strokeWidth="3.4" strokeLinecap="square" fill="none" />
        <circle cx="42" cy="31" r="4" fill="var(--green)" />
      </svg>
      <span className="rv-wordmark-text">WasItCheaper</span>
    </span>
  );
}

// ── Delta — the loudest thing on any surface. A price's distance from its
// own 90-day median, in the mono figure face. Green ONLY when the deal
// math verified a real discount; amber when the price is above its median.
// Never rendered from a guess: callers pass a computed value or nothing.
export function Delta({
  pct,
  size = "md",
  showLabel = false,
}: {
  pct: number | null | undefined;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
}) {
  if (pct == null) return <span className={`rv-delta rv-delta-${size} rv-delta-none`}>—</span>;
  const below = pct > 0;
  const tone = below ? "down" : "up";
  return (
    <span className={`rv-delta rv-delta-${size} rv-delta-${tone}`}>
      <span className="rv-delta-glyph" aria-hidden="true">{below ? "▼" : "▲"}</span>
      <span className="rv-num">{below ? "−" : "+"}{Math.abs(pct).toFixed(0)}%</span>
      {showLabel && <span className="rv-delta-label">vs 90d median</span>}
    </span>
  );
}

// ── Stamp — a verified claim, never decoration. Every stamp corresponds to
// something dealmath.py actually computed (lowest-ever needs ≥5 price
// points; a score needs ≥14 days of coverage).
export function Stamp({
  tone = "signal",
  children,
}: {
  tone?: "signal" | "caution" | "quiet";
  children: ReactNode;
}) {
  return <span className={`rv-stamp rv-stamp-${tone}`}>{children}</span>;
}

// ── Button — ink fill for primary. Achromatic on purpose: a colored CTA
// would compete with green, and green has to mean "genuine drop".
export function Button({
  as = "button",
  variant = "primary",
  size,
  href,
  target,
  rel,
  type = "button",
  onClick,
  disabled,
  className,
  children,
}: {
  as?: "button" | "a";
  variant?: "primary" | "ghost" | "quiet" | "ghost-light";
  size?: "sm" | "lg" | "xl";
  href?: string;
  target?: string;
  rel?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const classes = `rv-btn rv-btn-${variant}${size ? ` rv-btn-${size}` : ""}${className ? ` ${className}` : ""}`;
  if (as === "a") {
    return (
      <a href={href} target={target} rel={rel} className={classes}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}

// ── Panel — a hairline-ruled region whose label sits in the top rule, the
// way a real instrument panel is labelled. This replaces the retro pass's
// RetroWindow: same grouping affordance, but the label says what the
// region IS instead of faking a titlebar with dead window controls.
export function Panel({
  label,
  aside,
  className,
  bodyClassName,
  gridded = false,
  children,
}: {
  label?: string;
  /** Right-aligned readout in the top rule — a value, not an action. */
  aside?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Measured grid substrate — for regions that hold data, not prose. */
  gridded?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`rv-panel${className ? ` ${className}` : ""}`}>
      {(label || aside) && (
        <div className="rv-panel-rule">
          {label && <span className="rv-panel-label">{label}</span>}
          {aside && <span className="rv-panel-aside">{aside}</span>}
        </div>
      )}
      <div className={`rv-panel-body${gridded ? " rv-gridded" : ""}${bodyClassName ? ` ${bodyClassName}` : ""}`}>
        {children}
      </div>
    </section>
  );
}

// ── TopBar — primary nav on every page. A 56px rule-bar: wordmark, links,
// one ink CTA, and a live mono readout. Replaces the fixed bottom taskbar,
// which hid page content and left "Start" as the only mobile nav.
export function TopBar({
  links,
  activeHref,
  status,
  actions,
  menuOpen,
  onToggleMenu,
}: {
  links: { href: string; label: string }[];
  activeHref?: string;
  /** Live readout — e.g. "412 tracked". Data, not decoration. */
  status?: string;
  actions?: ReactNode;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  return (
    <header className="rv-topbar">
      <div className="rv-topbar-inner">
        <a href="#" className="rv-topbar-brand" aria-label="WasItCheaper home">
          <Wordmark size={22} />
        </a>

        <nav className="rv-topbar-links" aria-label="Primary">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`rv-topbar-link${activeHref === l.href ? " is-active" : ""}`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="rv-topbar-end">
          {status && <span className="rv-topbar-status rv-num">{status}</span>}
          {actions}
          <button
            type="button"
            className="rv-topbar-menu-btn"
            onClick={onToggleMenu}
            aria-expanded={menuOpen}
            aria-controls="rv-topbar-sheet"
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="rv-topbar-sheet" id="rv-topbar-sheet">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={onToggleMenu} className="rv-topbar-sheet-link">
              {l.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}

export const PRIMITIVE_STYLES = `
  /* ── Eyebrow — a small mono label. Mono because it sits next to figures
     and has to share their rhythm. ── */
  .rv-eyebrow {
    display: inline-flex; align-items: center; gap: 7px;
    font-family: var(--font-mono); font-size: 11px; font-weight: 500;
    text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-muted);
  }
  .rv-eyebrow-accent { color: var(--green-deep); }

  /* ── Wordmark ── */
  .rv-wordmark { display: inline-flex; align-items: center; gap: 9px; }
  .rv-wordmark-mark { flex: none; display: block; }
  .rv-wordmark-text {
    font-family: var(--font-sans); font-stretch: 112%; font-weight: 700;
    letter-spacing: -0.02em; color: var(--ink); white-space: nowrap;
  }

  /* ── Delta — the loud figure. ── */
  .rv-delta {
    display: inline-flex; align-items: baseline; gap: .28em;
    font-family: var(--font-mono); font-weight: 600; letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums lining-nums;
  }
  .rv-delta-glyph { font-size: .62em; transform: translateY(-.08em); }
  .rv-delta-label {
    font-size: .34em; font-weight: 500; letter-spacing: .1em;
    text-transform: uppercase; color: var(--ink-muted); margin-left: .5em;
  }
  /* --green is a large-text-only value (4.1:1). sm/md sizes step down to
     --green-deep (6.4:1) so small deltas still clear 4.5:1. */
  .rv-delta-down { color: var(--green); }
  .rv-delta-up   { color: var(--amber); }
  .rv-delta-none { color: var(--ink-fade); }
  .rv-delta-sm { font-size: 13px; }
  .rv-delta-md { font-size: 17px; }
  .rv-delta-lg { font-size: 30px; }
  .rv-delta-xl { font-size: clamp(46px, 7vw, 86px); }
  .rv-delta-sm.rv-delta-down, .rv-delta-md.rv-delta-down { color: var(--green-deep); }
  .rv-delta-sm.rv-delta-up,   .rv-delta-md.rv-delta-up   { color: var(--amber-deep); }

  /* ── Stamp — a verified claim. ── */
  .rv-stamp {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: var(--font-mono); font-size: 10.5px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.11em;
    padding: 4px 8px; border-radius: var(--r-sm); white-space: nowrap;
  }
  .rv-stamp-signal  { background: var(--green-tint); color: var(--green-deep); box-shadow: inset 0 0 0 1px rgba(10,138,79,.28); }
  .rv-stamp-caution { background: var(--amber-tint); color: var(--amber-deep); box-shadow: inset 0 0 0 1px rgba(138,100,16,.28); }
  .rv-stamp-quiet   { background: var(--paper-deep); color: var(--ink-muted); box-shadow: inset 0 0 0 1px var(--rule-strong); }

  /* ── Buttons ── */
  .rv-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    font-family: var(--font-sans); font-weight: 600; font-size: 14px;
    letter-spacing: -0.01em; border-radius: var(--r-md);
    padding: 10px 18px; cursor: pointer; white-space: nowrap;
    border: 1px solid transparent;
    transition: background-color var(--dur-fast) ease, color var(--dur-fast) ease,
                border-color var(--dur-fast) ease;
  }
  .rv-btn-primary { background: var(--ink); color: var(--paper); }
  .rv-btn-primary:hover:not(:disabled) { background: #000; }
  .rv-btn-primary:disabled { opacity: .5; cursor: wait; }
  .rv-btn-ghost { background: transparent; color: var(--ink); border-color: var(--rule-strong); }
  .rv-btn-ghost:hover:not(:disabled) { background: var(--paper-deep); border-color: var(--ink); }
  .rv-btn-ghost:disabled { opacity: .5; cursor: wait; }
  .rv-btn-quiet { background: transparent; color: var(--ink-muted); padding-left: 8px; padding-right: 8px; }
  .rv-btn-quiet:hover:not(:disabled) { color: var(--ink); }
  .rv-btn-ghost-light {
    background: transparent; color: var(--paper); border-color: rgba(244,243,239,.42);
  }
  .rv-btn-ghost-light:hover:not(:disabled) { background: rgba(244,243,239,.12); border-color: var(--paper); }
  .rv-btn-sm { padding: 7px 12px; font-size: 13px; }
  .rv-btn-lg { padding: 13px 22px; font-size: 15px; }
  .rv-btn-xl { padding: 16px 28px; font-size: 16px; }
  .rv-btn-arrow { transition: transform var(--dur-mid) var(--ease-out-expo); flex: none; }
  .rv-btn:hover .rv-btn-arrow { transform: translateX(3px); }

  /* ── Panel — label sits IN the top rule. ── */
  .rv-panel { --panel-bg: var(--paper); }
  .rv-panel-rule {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding-bottom: 7px; border-bottom: 1px solid var(--rule-strong);
  }
  .rv-panel-label {
    font-family: var(--font-mono); font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.13em; color: var(--ink);
  }
  .rv-panel-aside {
    font-family: var(--font-mono); font-size: 11.5px; color: var(--ink-muted);
    font-variant-numeric: tabular-nums; text-align: right;
  }
  .rv-panel-body { padding-top: 16px; }

  /* ── Inline text link — underlined ink, no second hue. ── */
  .rv-link, .rv-ilink {
    color: var(--link); text-decoration: underline;
    text-decoration-thickness: 1px; text-underline-offset: 3px;
    text-decoration-color: var(--rule-strong);
    transition: text-decoration-color var(--dur-fast) ease, color var(--dur-fast) ease;
  }
  .rv-link:hover, .rv-ilink:hover { color: var(--link-hover); text-decoration-color: currentColor; }
  .rv-ilink-on-dark { color: var(--paper); text-decoration-color: rgba(244,243,239,.45); }
  .rv-ilink-on-dark:hover { color: #fff; text-decoration-color: currentColor; }

  /* ── Tag — a quiet mono micro-label. ── */
  .rv-tag {
    display: inline-block; font-family: var(--font-mono); font-size: 11px;
    letter-spacing: .06em; color: var(--ink-muted);
  }

  /* ── Inputs ── */
  .rv-input, .rv-filter-input {
    font-family: var(--font-sans); font-size: 14.5px; color: var(--ink);
    background: var(--paper-pale); border: 1px solid var(--rule-strong);
    border-radius: var(--r-md); padding: 11px 13px; width: 100%;
    transition: border-color var(--dur-fast) ease, box-shadow var(--dur-fast) ease;
  }
  .rv-input:focus, .rv-filter-input:focus {
    outline: none; border-color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink);
  }
  .rv-input::placeholder { color: var(--ink-fade); }

  /* ── TopBar ── */
  .rv-topbar {
    position: sticky; top: 0; z-index: var(--z-sticky-nav);
    background: var(--paper); border-bottom: 1px solid var(--rule-strong);
  }
  .rv-topbar-inner {
    max-width: 1180px; margin: 0 auto; height: 56px; padding: 0 24px;
    display: flex; align-items: center; gap: 28px; min-width: 0;
  }
  .rv-topbar-brand { flex: none; text-decoration: none; display: flex; align-items: center; }
  .rv-topbar-links { display: flex; align-items: center; gap: 22px; flex: 1; }
  .rv-topbar-link {
    font-size: 13.5px; font-weight: 500; color: var(--ink-muted);
    text-decoration: none; padding: 4px 0; position: relative;
    transition: color var(--dur-fast) ease;
  }
  .rv-topbar-link:hover { color: var(--ink); }
  .rv-topbar-link.is-active { color: var(--ink); font-weight: 600; }
  .rv-topbar-link.is-active::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -19px;
    height: 2px; background: var(--ink);
  }
  .rv-topbar-end { display: flex; align-items: center; gap: 12px; margin-left: auto; min-width: 0; }
  .rv-topbar-status {
    font-size: 11.5px; color: var(--ink-muted); letter-spacing: .04em;
    padding-right: 4px; white-space: nowrap;
  }
  .rv-topbar-menu-btn {
    display: none; font-family: var(--font-mono); font-size: 12px; font-weight: 600;
    text-transform: uppercase; letter-spacing: .1em; color: var(--ink);
    padding: 8px 4px; cursor: pointer; background: none;
  }
  .rv-topbar-sheet { display: none; }

  @media (max-width: 760px) {
    .rv-topbar-inner { gap: 10px; padding: 0 18px; }
    .rv-topbar-links { display: none; }
    .rv-topbar-status { display: none; }
    .rv-topbar-menu-btn { display: block; flex: none; }
    /* Mark only. A page can carry two auth actions plus Menu in this bar
       (the guest dashboard does), and the wordmark is what has to give. */
    .rv-topbar-brand .rv-wordmark-text { display: none; }
    .rv-topbar-end { gap: 8px; }
    .rv-topbar-end .rv-btn { padding-left: 11px; padding-right: 11px; font-size: 12.5px; }
    .rv-topbar-sheet {
      display: flex; flex-direction: column;
      border-top: 1px solid var(--rule); background: var(--paper);
    }
    .rv-topbar-sheet-link {
      padding: 15px 18px; font-size: 15px; font-weight: 600; color: var(--ink);
      text-decoration: none; border-bottom: 1px solid var(--rule);
    }
  }

  /* The taskbar used to eat the bottom of every page; it no longer exists,
     so .rv-page only carries the shared page background. */
  .rv-page { background: var(--paper); }

  @media (prefers-reduced-motion: reduce) {
    .rv-btn, .rv-btn-arrow { transition: none !important; }
  }
`;
