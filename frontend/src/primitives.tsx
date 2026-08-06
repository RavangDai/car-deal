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

// Standard trailing arrow. It is never naked next to the label: it sits
// in its own circular well, flush with the button's right inner padding,
// so the CTA reads as a machined object rather than "text plus a glyph".
// Every existing call site is `<Button>…<Arrow /></Button>`, so upgrading
// it here upgrades all of them without touching one of them.
export function Arrow({ size = 14 }: { size?: number }) {
  return (
    <span className="rv-btn-well" aria-hidden="true">
      <ArrowRight size={size} strokeWidth={1.9} className="rv-btn-arrow" />
    </span>
  );
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

// ── Bezel — a nested enclosure: an outer shell holding an inner core.
//
// The "no cards" rule still holds for everything you READ — tables, prose
// and the index stay flat on paper with hairline structure. This is for
// the few surfaces that have to read as OBJECTS: the hero proof panel and
// the product cards. A single flat div on a flat ground is exactly what
// made the old page look unfinished; two concentric radii plus a contact
// shadow and a top lip is what makes a surface look machined.
//
// The inner radius is derived, never hand-picked — --bezel-inner is
// calc(outer - pad), so the two curves stay parallel at any scale.
export function Bezel({
  className,
  bodyClassName,
  /** Data substrate on the inner core — same grid as Panel's `gridded`. */
  gridded = false,
  /** Lifts the shell on hover. For cards that are links; off by default. */
  interactive = false,
  children,
}: {
  className?: string;
  bodyClassName?: string;
  gridded?: boolean;
  interactive?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`rv-bezel${interactive ? " rv-bezel-interactive" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      <div
        className={`rv-bezel-core${gridded ? " rv-gridded" : ""}${
          bodyClassName ? ` ${bodyClassName}` : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}

// ── TopBar — primary nav on every page. A detached glass island rather
// than a rule-bar glued to the top edge. It stays `sticky` (not `fixed`)
// on purpose: every page below was written assuming the nav occupies flow
// height, and going fixed would slide all of them under it.
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
            className={`rv-topbar-menu-btn${menuOpen ? " is-open" : ""}`}
            onClick={onToggleMenu}
            aria-expanded={menuOpen}
            aria-controls="rv-topbar-sheet"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {/* Two bars that rotate into an X rather than swapping glyphs. */}
            <span className="rv-topbar-bar" aria-hidden="true" />
            <span className="rv-topbar-bar" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Full-bleed glass overlay. Kept mounted-on-open only; the links
          stagger in off `is-open` so the delays run every time it opens. */}
      <div
        className={`rv-topbar-sheet${menuOpen ? " is-open" : ""}`}
        id="rv-topbar-sheet"
        hidden={!menuOpen}
      >
        <nav className="rv-topbar-sheet-nav" aria-label="Mobile">
          {links.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              onClick={onToggleMenu}
              className="rv-topbar-sheet-link"
              style={{ transitionDelay: `${60 + i * 55}ms` }}
            >
              <span className="rv-topbar-sheet-num rv-num">
                {String(i + 1).padStart(2, "0")}
              </span>
              {l.label}
            </a>
          ))}
        </nav>
      </div>
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

  /* ── Buttons ─────────────────────────────────────────────────────────
     Was: a 2px-radius rectangle with a 14px label and a colour-only
     hover — visually an unstyled form control. Now a pill that responds
     with mass: it takes a real press on :active, and the trailing arrow
     lives in its own well that gains kinetic tension on hover.

     The fill is still achromatic ink. That has not changed and must not:
     a coloured CTA would compete with green, and green has to keep
     meaning "the deal math verified this". */
  .rv-btn {
    position: relative;
    display: inline-flex; align-items: center; justify-content: center; gap: 10px;
    font-family: var(--font-sans); font-weight: 600; font-size: 14.5px;
    letter-spacing: -0.012em; border-radius: var(--r-pill);
    padding: 11px 20px; cursor: pointer; white-space: nowrap;
    border: 1px solid transparent;
    /* transform + opacity + colour only — nothing here triggers layout. */
    transition: background-color var(--dur-mid) var(--ease-out-soft),
                color var(--dur-mid) var(--ease-out-soft),
                border-color var(--dur-mid) var(--ease-out-soft),
                box-shadow var(--dur-lux) var(--ease-spring),
                transform var(--dur-lux) var(--ease-spring);
    transform: translateZ(0);
  }
  /* The press. Physical, not decorative — this is the whole haptic. */
  .rv-btn:active:not(:disabled) { transform: scale(.978); transition-duration: .08s; }

  .rv-btn-primary {
    background: var(--ink); color: var(--paper);
    box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,.10);
  }
  .rv-btn-primary:hover:not(:disabled) {
    background: var(--primary-deep);
    box-shadow: var(--shadow-md), inset 0 1px 0 rgba(255,255,255,.14);
  }
  .rv-btn-primary:disabled { opacity: .45; cursor: wait; }

  .rv-btn-ghost {
    background: rgba(255,255,255,.5); color: var(--ink);
    border-color: var(--rule-strong);
    backdrop-filter: blur(6px);
  }
  .rv-btn-ghost:hover:not(:disabled) {
    background: var(--paper-pale); border-color: var(--ink);
    box-shadow: var(--shadow-sm);
  }
  .rv-btn-ghost:disabled { opacity: .45; cursor: wait; }

  .rv-btn-quiet {
    background: transparent; color: var(--ink-muted);
    padding-left: 12px; padding-right: 12px;
  }
  .rv-btn-quiet:hover:not(:disabled) { color: var(--ink); background: var(--primary-wash); }

  .rv-btn-ghost-light {
    background: rgba(244,243,239,.06); color: var(--paper);
    border-color: rgba(244,243,239,.34);
  }
  .rv-btn-ghost-light:hover:not(:disabled) {
    background: rgba(244,243,239,.14); border-color: rgba(244,243,239,.72);
  }

  .rv-btn-sm { padding: 7px 14px;  font-size: 13px;   gap: 7px; }
  .rv-btn-lg { padding: 14px 24px; font-size: 15.5px; }
  .rv-btn-xl { padding: 17px 30px; font-size: 16.5px; }

  /* ── The trailing well — a button inside the button. It sits flush with
     the right inner padding, which is why the button carries asymmetric
     padding whenever one is present. ── */
  .rv-btn-well {
    display: inline-flex; align-items: center; justify-content: center;
    flex: none; width: 28px; height: 28px; border-radius: var(--r-pill);
    margin-right: -9px; margin-left: 2px;
    background: rgba(244,243,239,.14);
    transition: transform var(--dur-lux) var(--ease-spring),
                background-color var(--dur-mid) var(--ease-out-soft);
  }
  .rv-btn-ghost .rv-btn-well,
  .rv-btn-quiet .rv-btn-well { background: var(--primary-wash); }
  .rv-btn-sm .rv-btn-well { width: 22px; height: 22px; margin-right: -7px; }
  .rv-btn-xl .rv-btn-well { width: 34px; height: 34px; margin-right: -12px; }

  /* Internal kinetic tension: the well travels diagonally and grows
     slightly while the arrow inside it travels further still. */
  .rv-btn:hover:not(:disabled) .rv-btn-well {
    transform: translate(3px, -1px) scale(1.06);
    background: rgba(244,243,239,.24);
  }
  .rv-btn-ghost:hover:not(:disabled) .rv-btn-well,
  .rv-btn-quiet:hover:not(:disabled) .rv-btn-well { background: rgba(27,26,22,.11); }

  .rv-btn-arrow { transition: transform var(--dur-lux) var(--ease-spring); flex: none; }
  .rv-btn:hover:not(:disabled) .rv-btn-arrow { transform: translateX(2px); }

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

  /* ── Bezel — nested enclosure. Outer shell + inner core, concentric. ── */
  .rv-bezel {
    padding: var(--bezel-pad);
    border-radius: var(--bezel-outer);
    background: linear-gradient(
      180deg,
      rgba(255,255,255,.72),
      rgba(226,224,216,.42)
    );
    box-shadow:
      inset 0 0 0 1px rgba(255,255,255,.85),
      0 0 0 1px rgba(27,26,22,.055),
      var(--shadow-lg);
    transition: transform var(--dur-lux) var(--ease-spring),
                box-shadow var(--dur-lux) var(--ease-spring);
  }
  .rv-bezel-core {
    border-radius: var(--bezel-inner);
    background: var(--paper-pale);
    box-shadow: var(--shadow-lip), 0 0 0 1px rgba(27,26,22,.06);
    overflow: hidden;
  }
  /* Only for shells that are themselves links. Lift, never bounce. */
  .rv-bezel-interactive { cursor: pointer; }
  .rv-bezel-interactive:hover {
    transform: translateY(-4px);
    box-shadow:
      inset 0 0 0 1px rgba(255,255,255,.92),
      0 0 0 1px rgba(27,26,22,.07),
      var(--shadow-xl);
  }

  /* ── Inputs ── */
  .rv-input, .rv-filter-input {
    font-family: var(--font-sans); font-size: 15px; color: var(--ink);
    background: var(--paper-pale); border: 1px solid var(--rule-strong);
    border-radius: var(--r-pill); padding: 14px 20px; width: 100%;
    box-shadow: inset 0 1px 2px rgba(27,26,22,.05);
    transition: border-color var(--dur-mid) var(--ease-out-soft),
                box-shadow var(--dur-mid) var(--ease-out-soft);
  }
  .rv-input:focus, .rv-filter-input:focus {
    outline: none; border-color: var(--ink);
    box-shadow: inset 0 1px 2px rgba(27,26,22,.05), 0 0 0 3px rgba(27,26,22,.10);
  }
  .rv-input::placeholder { color: var(--ink-fade); }
  /* Filter controls stay compact — they sit in dense rows, not heroes. */
  .rv-filter-input { padding: 9px 14px; font-size: 13.5px; border-radius: var(--r-md); }

  /* ── TopBar — a detached glass island ──────────────────────────────
     position:sticky, not fixed: the wrapper keeps occupying flow height
     so every page written against the old 56px bar still lays out. The
     blur lives on this sticky element only, never on scrolling content. */
  .rv-topbar {
    position: sticky; top: 0; z-index: var(--z-sticky-nav);
    background: transparent; border: none;
    padding: 16px var(--gutter) 0;
    pointer-events: none;
  }
  .rv-topbar-inner {
    max-width: var(--measure); margin: 0 auto; height: 62px;
    padding: 0 12px 0 22px;
    display: flex; align-items: center; gap: 28px; min-width: 0;
    pointer-events: auto;
    border-radius: var(--r-pill);
    background: rgba(248,247,244,.74);
    backdrop-filter: blur(20px) saturate(1.5);
    -webkit-backdrop-filter: blur(20px) saturate(1.5);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.9),
      0 0 0 1px rgba(27,26,22,.06),
      var(--shadow-md);
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
  /* The island has no bottom edge to hang an underline off, so the active
     marker is a dot under the label rather than a rule bleeding to it. */
  .rv-topbar-link.is-active::after {
    content: ""; position: absolute; left: 50%; bottom: -7px;
    width: 4px; height: 4px; margin-left: -2px;
    border-radius: var(--r-pill); background: var(--green);
  }
  .rv-topbar-end { display: flex; align-items: center; gap: 12px; margin-left: auto; min-width: 0; }
  .rv-topbar-status {
    font-size: 11.5px; color: var(--ink-muted); letter-spacing: .04em;
    padding-right: 4px; white-space: nowrap;
  }
  /* ── Hamburger — two bars that rotate into an X. Never a glyph swap:
     the morph is what tells you the same control closes what it opened. */
  .rv-topbar-menu-btn {
    display: none; position: relative; flex: none;
    width: 40px; height: 40px; border-radius: var(--r-pill);
    background: var(--primary-wash); cursor: pointer; border: none;
    transition: background-color var(--dur-mid) var(--ease-out-soft);
  }
  .rv-topbar-menu-btn:hover { background: rgba(27,26,22,.10); }
  .rv-topbar-bar {
    position: absolute; left: 50%; top: 50%;
    width: 17px; height: 1.5px; margin-left: -8.5px;
    background: var(--ink); border-radius: var(--r-pill);
    transition: transform var(--dur-lux) var(--ease-spring);
  }
  .rv-topbar-bar:nth-child(1) { transform: translateY(-4px); }
  .rv-topbar-bar:nth-child(2) { transform: translateY(3px); }
  .rv-topbar-menu-btn.is-open .rv-topbar-bar:nth-child(1) {
    transform: translateY(0) rotate(45deg);
  }
  .rv-topbar-menu-btn.is-open .rv-topbar-bar:nth-child(2) {
    transform: translateY(0) rotate(-45deg);
  }

  /* ── Mobile overlay — screen-filling glass, links reveal from a mask. ── */
  .rv-topbar-sheet {
    position: fixed; inset: 0; z-index: var(--z-banner);
    display: none; align-items: center;
    padding: 0 var(--gutter);
    background: rgba(244,243,239,.86);
    backdrop-filter: blur(28px) saturate(1.4);
    -webkit-backdrop-filter: blur(28px) saturate(1.4);
    opacity: 0;
    transition: opacity var(--dur-mid) var(--ease-out-soft);
  }
  .rv-topbar-sheet.is-open { opacity: 1; }
  .rv-topbar-sheet[hidden] { display: none; }
  .rv-topbar-sheet-nav { display: flex; flex-direction: column; gap: 4px; width: 100%; }
  .rv-topbar-sheet-link {
    display: flex; align-items: baseline; gap: 16px;
    padding: 10px 0; text-decoration: none; color: var(--ink);
    font-family: var(--font-display);
    font-size: clamp(34px, 11vw, 52px);
    line-height: var(--display-leading);
    letter-spacing: var(--display-track);
    /* The mask: each link starts below its own box and slides up. */
    opacity: 0; transform: translateY(46px);
    transition: opacity var(--dur-lux) var(--ease-spring),
                transform var(--dur-lux) var(--ease-spring);
  }
  .rv-topbar-sheet.is-open .rv-topbar-sheet-link {
    opacity: 1; transform: translateY(0);
  }
  .rv-topbar-sheet-num {
    font-family: var(--font-mono); font-size: 12px; font-weight: 500;
    color: var(--ink-fade); letter-spacing: .1em; flex: none;
  }

  @media (max-width: 860px) {
    .rv-topbar { padding-top: 12px; }
    .rv-topbar-inner { gap: 10px; padding: 0 10px 0 16px; height: 58px; }
    .rv-topbar-links { display: none; }
    .rv-topbar-status { display: none; }
    .rv-topbar-menu-btn { display: block; }
    .rv-topbar-sheet { display: flex; }
    /* Mark only. A page can carry two auth actions plus Menu in this bar
       (the guest dashboard does), and the wordmark is what has to give. */
    .rv-topbar-brand .rv-wordmark-text { display: none; }
    .rv-topbar-end { gap: 8px; }
    .rv-topbar-end .rv-btn { padding-left: 15px; padding-right: 15px; font-size: 13px; }
    .rv-topbar-end .rv-btn-well { display: none; }
  }

  /* The taskbar used to eat the bottom of every page; it no longer exists,
     so .rv-page only carries the shared page background.
     Transparent on purpose: body owns the canvas colour AND the light
     source now, and an opaque fill here would occlude the gradient. */
  .rv-page { background: transparent; }

  @media (prefers-reduced-motion: reduce) {
    .rv-btn, .rv-btn-arrow, .rv-btn-well, .rv-bezel, .rv-topbar-bar {
      transition: none !important;
    }
    .rv-btn:active:not(:disabled),
    .rv-bezel-interactive:hover { transform: none !important; }
    .rv-btn:hover:not(:disabled) .rv-btn-well,
    .rv-btn:hover:not(:disabled) .rv-btn-arrow { transform: none !important; }
    /* The sheet still needs to arrive — it just arrives without travel. */
    .rv-topbar-sheet-link { opacity: 1 !important; transform: none !important; }
  }
`;
