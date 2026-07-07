// frontend/src/primitives.tsx
// Shared UI primitives, injected once at the app-shell level (App.tsx) so
// every page composes the same eyebrow/button/window/taskbar classes
// instead of redeclaring near-duplicate rule sets per page. Page-specific
// layout CSS (hero grid, deals table, login split-screen, legal typography)
// stays in each page's own file and references these classes directly.
import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// Standard trailing arrow — sits inline after a button/link label.
export function Arrow({ size = 14 }: { size?: number }) {
  return <ArrowRight size={size} strokeWidth={2.4} className="rv-btn-arrow" />;
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

// A beveled window: gradient titlebar (icon + title + decorative _/▢/✕
// controls) over a plain paper body. The controls are decorative on every
// surface — there is no real window management, mobile included — so they
// are aria-hidden and non-interactive by design, not a stripped-down
// feature.
export function RetroWindow({
  title,
  icon,
  controls = true,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  icon?: ReactNode;
  controls?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rv-win${className ? ` ${className}` : ""}`}>
      <div className="rv-titlebar">
        {icon ? <span className="rv-titlebar-icon">{icon}</span> : null}
        <span className="rv-titlebar-title">{title}</span>
        {controls ? (
          <span className="rv-titlebar-controls" aria-hidden="true">
            <span className="rv-tb-btn">_</span>
            <span className="rv-tb-btn">▢</span>
            <span className="rv-tb-btn rv-tb-close">✕</span>
          </span>
        ) : null}
      </div>
      <div className={`rv-win-body${bodyClassName ? ` ${bodyClassName}` : ""}`}>{children}</div>
    </div>
  );
}

// Beveled button — outset by default, presses to inset on :active. Replaces
// both the old GlassButton and the plain .rv-btn-primary shadow treatment
// with one real border-based bevel mechanic.
export function RetroButton({
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
  variant?: "primary" | "ghost" | "ghost-light" | "outline";
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

// Fixed bottom taskbar — the site's primary nav on every page. On narrow
// viewports the inline links hide and Start becomes the only way to reach
// them, via a small popup menu positioned just above the bar (an actual
// Start-menu behavior, not a stripped-down mobile nav).
export function Taskbar({
  links,
  activeHref,
  status,
  actions,
  menuOpen,
  onToggleMenu,
}: {
  links: { href: string; label: string }[];
  activeHref?: string;
  status?: string;
  /** Auth-conditional buttons (Sign out, Exit, Create account) that don't
      fit the plain-link nav model. Rendered between the links and the
      status readout. */
  actions?: ReactNode;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  return (
    <div className="rv-taskbar">
      <button
        type="button"
        className="rv-taskbar-start"
        onClick={onToggleMenu}
        aria-expanded={menuOpen}
        aria-haspopup="true"
      >
        <svg className="rv-taskbar-start-icon" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1" y="1" width="6" height="6" fill="currentColor" />
          <rect x="9" y="1" width="6" height="6" fill="currentColor" />
          <rect x="1" y="9" width="6" height="6" fill="currentColor" />
          <rect x="9" y="9" width="6" height="6" fill="currentColor" />
        </svg>
        Start
      </button>
      <nav className="rv-taskbar-links" aria-label="Primary">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className={`rv-taskbar-link${activeHref === l.href ? " rv-taskbar-link-active" : ""}`}
          >
            {l.label}
          </a>
        ))}
      </nav>
      <div className="rv-taskbar-spacer" />
      {actions ? <div className="rv-taskbar-actions">{actions}</div> : null}
      {status ? <div className="rv-taskbar-status">{status}</div> : null}
      {menuOpen ? (
        <div className="rv-taskbar-menu" role="menu">
          {links.map((l) => (
            <a key={l.href} href={l.href} role="menuitem" onClick={onToggleMenu}>
              {l.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
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

  /* ── Window — beveled titlebar + paper body. ── */
  .rv-win {
    background: var(--paper);
    border-top: var(--bevel-width) solid var(--bevel-hi);
    border-left: var(--bevel-width) solid var(--bevel-hi);
    border-right: var(--bevel-width) solid var(--bevel-lo);
    border-bottom: var(--bevel-width) solid var(--bevel-lo);
    box-shadow: var(--shadow-md);
  }
  .rv-titlebar {
    display: flex; align-items: center; gap: 8px;
    background: linear-gradient(180deg, var(--primary), var(--primary-deep));
    color: #f2f5ff; padding: 6px 8px 6px 10px;
    font-family: var(--font-display); font-size: 16px; letter-spacing: .02em; line-height: 1;
  }
  .rv-titlebar-icon { display: flex; flex: none; width: 15px; height: 15px; }
  .rv-titlebar-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rv-titlebar-controls { display: flex; gap: 3px; flex: none; }
  .rv-tb-btn {
    width: 17px; height: 16px; display: grid; place-items: center;
    background: var(--paper); color: var(--ink); font-size: 10px; line-height: 1;
    border-top: 1px solid var(--bevel-hi); border-left: 1px solid var(--bevel-hi);
    border-right: 1px solid var(--bevel-lo); border-bottom: 1px solid var(--bevel-lo);
  }
  .rv-tb-close:hover { background: var(--red); color: #fff; }
  .rv-win-body { padding: 20px; }

  /* ── Buttons — real outset bevel, presses to inset on :active. ── */
  .rv-btn {
    display: inline-flex; align-items: center; gap: 8px;
    font-family: var(--font-sans); font-weight: 700; font-size: 14px;
    border-radius: var(--r-md); padding: 9px 16px; cursor: pointer;
    background: var(--paper); color: var(--ink);
    border-top: var(--bevel-width) solid var(--bevel-hi);
    border-left: var(--bevel-width) solid var(--bevel-hi);
    border-right: var(--bevel-width) solid var(--bevel-lo);
    border-bottom: var(--bevel-width) solid var(--bevel-lo);
    transition: transform .12s var(--ease-out-expo), background-color .18s ease, color .18s ease;
    white-space: nowrap;
  }
  .rv-btn:active:not(:disabled) {
    border-top-color: var(--bevel-lo); border-left-color: var(--bevel-lo);
    border-right-color: var(--bevel-hi); border-bottom-color: var(--bevel-hi);
    transform: translate(1px, 1px);
  }
  .rv-btn-primary { background: var(--primary); color: #fff; }
  .rv-btn-primary:hover:not(:disabled) { background: var(--primary-deep); }
  .rv-btn-primary:disabled { opacity: .6; cursor: wait; }
  .rv-btn-ghost { background: transparent; color: var(--ink); }
  .rv-btn-ghost:hover { background: rgba(32,31,26,.06); }
  .rv-btn-ghost-light {
    background: transparent; color: #fff;
    border-top-color: rgba(255,255,255,.7); border-left-color: rgba(255,255,255,.7);
    border-right-color: rgba(0,0,0,.35); border-bottom-color: rgba(0,0,0,.35);
  }
  .rv-btn-ghost-light:hover { background: rgba(255,255,255,.14); }
  .rv-btn-outline { background: var(--paper-pale); color: var(--ink); }
  .rv-btn-outline:hover { background: var(--paper-deep); }
  .rv-btn-lg { padding: 12px 22px; font-size: 15px; }
  .rv-btn-xl { padding: 14px 26px; font-size: 16px; }
  .rv-btn-sm { padding: 7px 12px; font-size: 13px; }
  .rv-btn-arrow { transition: transform .3s var(--ease-out-expo); }
  .rv-btn:hover .rv-btn-arrow { transform: translateX(3px); }

  /* ── Taskbar — fixed bottom nav on every page. ── */
  .rv-taskbar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: var(--z-fixed-nav);
    display: flex; align-items: center; gap: 6px; padding: 8px 14px;
    background: linear-gradient(180deg, #dfe6ee, #c4ccd6);
    border-top: var(--bevel-width) solid var(--bevel-hi);
    box-shadow: 0 -2px 0 rgba(32,31,26,.12);
  }
  .rv-taskbar-start {
    font-family: var(--font-display); font-size: 16px; letter-spacing: .02em;
    display: flex; align-items: center; gap: 7px; padding: 6px 14px;
    background: var(--primary); color: #fff; cursor: pointer; border-radius: var(--r-sm);
    border-top: 2px solid #7fa4f7; border-left: 2px solid #7fa4f7;
    border-right: 2px solid var(--primary-deep); border-bottom: 2px solid var(--primary-deep);
  }
  .rv-taskbar-start:active {
    border-top-color: var(--primary-deep); border-left-color: var(--primary-deep);
    border-right-color: #7fa4f7; border-bottom-color: #7fa4f7;
  }
  .rv-taskbar-start-icon { width: 13px; height: 13px; flex: none; color: #fff; }
  .rv-taskbar-links { display: flex; align-items: center; gap: 2px; }
  .rv-taskbar-link {
    font-family: var(--font-sans); font-size: 13px; font-weight: 600;
    color: var(--ink); padding: 7px 11px; text-decoration: none; border-radius: var(--r-sm);
  }
  .rv-taskbar-link:hover { background: rgba(255,255,255,.5); }
  .rv-taskbar-link-active { background: rgba(32,31,26,.12); }
  .rv-taskbar-spacer { flex: 1; }
  .rv-taskbar-actions { display: flex; align-items: center; gap: 6px; }
  .rv-taskbar-status {
    font-family: var(--font-display); font-size: 15px; padding: 5px 10px;
    background: #eef1f5; color: var(--ink-muted);
    border-top: 1px solid var(--bevel-lo); border-left: 1px solid var(--bevel-lo);
  }
  .rv-taskbar-menu {
    position: absolute; left: 8px; bottom: 100%; margin-bottom: 4px;
    min-width: 190px; background: var(--paper); padding: 4px;
    border-top: var(--bevel-width) solid var(--bevel-hi); border-left: var(--bevel-width) solid var(--bevel-hi);
    border-right: var(--bevel-width) solid var(--bevel-lo); border-bottom: var(--bevel-width) solid var(--bevel-lo);
    box-shadow: var(--shadow-md);
  }
  .rv-taskbar-menu a {
    display: block; padding: 9px 12px; font-family: var(--font-sans);
    font-weight: 600; font-size: 14px; color: var(--ink); text-decoration: none;
  }
  .rv-taskbar-menu a:hover { background: var(--primary); color: #fff; }
  @media (min-width: 641px) { .rv-taskbar-menu { display: none; } }
  @media (max-width: 640px) { .rv-taskbar-links { display: none; } }

  /* Every page needs room at the bottom so content isn't hidden behind the
     fixed taskbar. */
  .rv-page { padding-bottom: 60px; }

  @media (prefers-reduced-motion: reduce) {
    .rv-btn, .rv-btn-arrow { transition: none !important; }
  }
`;
