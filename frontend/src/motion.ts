// frontend/src/motion.ts
// Scroll choreography. GSAP + ScrollTrigger, wrapped so that pages declare
// WHAT reveals and this module owns HOW.
//
// ── The one rule that is not negotiable ──────────────────────────────────
// The hero never scroll-gates. A whileInView/ScrollTrigger gate on
// above-the-fold content ships BLANK in headless and non-scrolled renders,
// which is exactly what broke the screenshot harness before (see the note
// in theme.css on --reveal-y). Hero content uses the on-mount <Reveal> in
// primitives.tsx. Everything below the fold uses this module.
//
// Failure mode is chosen deliberately: the hidden state is applied by JS,
// never by CSS. If this module throws, fails to load, or GSAP is blocked,
// the page renders fully visible and unanimated rather than blank.
import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

export function registerMotion() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type RevealOptions = {
  /** Stagger between children, in seconds. */
  stagger?: number;
  /** Travel distance in px. Heavier elements travel further. */
  y?: number;
  /** Entry blur in px. 0 disables the filter entirely. */
  blur?: number;
  duration?: number;
  /** ScrollTrigger start. Default fires a little before the element lands. */
  start?: string;
};

/**
 * Reveals every `[data-reveal]` descendant of `root`, in document order.
 *
 * Returns a teardown. Call inside useEffect/useLayoutEffect and return it —
 * gsap.context() scoping means a StrictMode double-invoke fully reverts.
 */
export function revealChildren(
  root: HTMLElement,
  opts: RevealOptions = {},
): () => void {
  const {
    stagger = 0.085,
    y = 52,
    blur = 8,
    duration = 0.95,
    start = "top 84%",
  } = opts;

  // Reduced motion: nothing is hidden, nothing animates, no triggers made.
  if (prefersReducedMotion()) return () => {};

  registerMotion();

  const ctx = gsap.context(() => {
    const targets = gsap.utils.toArray<HTMLElement>("[data-reveal]", root);
    if (!targets.length) return;

    gsap.set(targets, {
      opacity: 0,
      y,
      ...(blur ? { filter: `blur(${blur}px)` } : {}),
    });

    gsap.to(targets, {
      opacity: 1,
      y: 0,
      ...(blur ? { filter: "blur(0px)" } : {}),
      duration,
      ease: "expo.out",
      stagger,
      // clearProps drops the inline filter once it has landed, so a
      // stale blur/will-change never sits on a composited layer for the
      // rest of the session.
      clearProps: "filter",
      scrollTrigger: {
        trigger: root,
        start,
        once: true,
      },
    });
  }, root);

  return () => ctx.revert();
}

/**
 * Hook form of revealChildren. Attach the returned ref to a section; every
 * `[data-reveal]` inside it staggers in when the section is scrolled to.
 *
 * useLayoutEffect, not useEffect: the hidden state must be set before the
 * browser paints, or the first frame flashes the content at full opacity.
 */
export function useReveal<T extends HTMLElement>(opts: RevealOptions = {}) {
  const ref = useRef<T | null>(null);
  const { stagger, y, blur, duration, start } = opts;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    return revealChildren(el, { stagger, y, blur, duration, start });
  }, [stagger, y, blur, duration, start]);

  return ref;
}

/**
 * Scrubbed timeline helper. `build` receives a paused timeline tied to the
 * element's progress through the viewport — used by the score explainer,
 * where the four components assemble as you scroll rather than all at once.
 *
 * Under reduced motion the timeline is built and jumped straight to its end
 * state, so the section still shows its finished composition.
 */
export function scrubTimeline(
  trigger: HTMLElement,
  build: (tl: gsap.core.Timeline) => void,
  opts: { start?: string; end?: string; scrub?: number | boolean } = {},
): () => void {
  const { start = "top 72%", end = "bottom 62%", scrub = 0.85 } = opts;

  if (prefersReducedMotion()) {
    const tl = gsap.timeline({ paused: true });
    build(tl);
    tl.progress(1).kill();
    return () => {};
  }

  registerMotion();
  const ctx = gsap.context(() => {
    const tl = gsap.timeline({
      scrollTrigger: { trigger, start, end, scrub },
    });
    build(tl);
  }, trigger);

  return () => ctx.revert();
}

/**
 * Escape hatch for the screenshot harness and for any consumer that needs
 * the page in its settled state without scrolling to it. Exposed on window
 * so a Playwright page.evaluate() can settle the whole document in one call.
 */
export function settleAll() {
  if (!registered) return;
  ScrollTrigger.getAll().forEach((t) => {
    const anim = t.animation;
    if (anim) anim.progress(1);
    t.kill();
  });
  gsap.set("[data-reveal]", { opacity: 1, y: 0, filter: "none" });
}

if (typeof window !== "undefined") {
  (window as unknown as { __rvSettle?: () => void }).__rvSettle = settleAll;
}
