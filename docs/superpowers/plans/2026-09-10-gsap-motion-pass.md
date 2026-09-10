# GSAP Motion Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inertial smooth scrolling, a custom trailing cursor, and GSAP-driven page transitions, so cursor → scroll → route change all read as one motion system.

**Architecture:** `src/motion.ts` already owns scroll choreography (GSAP + ScrollTrigger) and states the project's motion rules. This plan adds two sibling modules — `smoothScroll.ts` (a wheel-driven lerp on GSAP's ticker) and `Cursor.tsx` (a `quickTo`-driven pointer) — and replaces the framer-motion route crossfade in `App.tsx` with a GSAP timeline. Scroll math is extracted into pure functions so it is unit-testable without a browser.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, GSAP 3.15 (with ScrollTrigger), framer-motion 12 (retained elsewhere). Test harness: Vitest 3 + jsdom.

**Spec:** `docs/superpowers/specs/2026-09-10-hyper-ui-redesign-design.md` (Phase 4)

## Global Constraints

- **Never commit.** Bibek owns the git history. Every task ends at a verification checkpoint with changes left in the working tree. Do not run `git commit`, `git add`, `git checkout`, `git reset`, or any history-writing command. Git is read-only here.
- **Working directory:** `C:\Users\bibek\Personal Projects\car catch ai\car-deal-finder\frontend`
- **Build must pass at every checkpoint:** `npm run build` (`tsc -b && vite build`).
- **The failure mode is inherited, not chosen.** `src/motion.ts` states it: *the hidden state is applied by JS, never by CSS. If this module throws, fails to load, or GSAP is blocked, the page renders fully visible and unanimated rather than blank.* Everything here obeys that — smooth scroll failing leaves native scroll; the cursor failing leaves the native cursor; a route transition failing leaves the route visible.
- **The hero never scroll-gates.** A ScrollTrigger gate on above-the-fold content ships blank in headless and non-scrolled renders, which previously broke the screenshot harness. Route-entry animation is on-mount, never ScrollTrigger-driven.
- **Two hard opt-outs, checked before anything installs:** `prefers-reduced-motion: reduce`, and `(pointer: coarse)`. Under either, smooth scroll and the cursor must not install at all — not install-then-disable.
- **`window.__rvSettle` is the screenshot harness's escape hatch.** It must continue to settle the page in one call. Smooth scroll can strand it mid-lerp; Task 3 fixes that.
- **Never use `linear` or `ease-in-out`.** `theme.css` states it: both read as software easing. Use `--ease-out-expo`, `--ease-spring`, `--ease-out-soft`, or GSAP's `expo.out` / `power2.in` / `power3`.
- **This plan does not remove framer-motion.** It stays in `LoginPage`, `primitives`, and `Spinner`. Only the route crossfade moves to GSAP.

**If Vitest is not yet installed** (i.e. the redesign plan's Task 1 has not run), do that setup first — it is reproduced as Task 0 below.

---

### Task 0: Test harness (skip if the redesign plan's Task 1 already ran)

**Files:**
- Create: `vitest.config.ts`, `src/__tests__/setup.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test`.

- [ ] **Step 1: Check whether it already exists**

Run: `ls vitest.config.ts 2>/dev/null && echo PRESENT || echo ABSENT`
If PRESENT, skip to Task 1.

- [ ] **Step 2: Install**

```bash
npm i -D vitest@^3 jsdom@^26 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14
```

- [ ] **Step 3: Add scripts to `package.json`**

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    globals: true,
  },
});
```

- [ ] **Step 5: Create `src/__tests__/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
```

- [ ] **Step 6: Verify**

Run: `npm test` (no tests yet is fine — it must not error on config) and `npm run build`.

- [ ] **Step 7: Checkpoint — do NOT commit.**

---

### Task 1: Scroll math as pure functions

**Files:**
- Create: `src/scrollMath.ts`, `src/scrollMath.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `clampScroll(target: number, maxScroll: number): number`, `lerp(from: number, to: number, alpha: number): number`, `stepToward(current: number, target: number, alpha: number, epsilon: number): { value: number; settled: boolean }`. Task 2 imports all three.

Extracting the arithmetic means the tricky part is tested without a browser, a wheel event, or a ticker.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { clampScroll, lerp, stepToward } from "./scrollMath";

describe("clampScroll", () => {
  it("passes through a value inside the range", () => {
    expect(clampScroll(500, 2000)).toBe(500);
  });

  it("clamps overscroll at the top", () => {
    expect(clampScroll(-320, 2000)).toBe(0);
  });

  it("clamps overscroll at the bottom", () => {
    expect(clampScroll(9999, 2000)).toBe(2000);
  });

  it("collapses to 0 when the page does not scroll", () => {
    expect(clampScroll(400, 0)).toBe(0);
  });

  it("treats a negative maxScroll as 0 rather than inverting the range", () => {
    // getBoundingClientRect can transiently report a viewport taller than
    // the document; that must not produce a negative scroll target.
    expect(clampScroll(400, -50)).toBe(0);
  });
});

describe("lerp", () => {
  it("returns the start at alpha 0", () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it("returns the end at alpha 1", () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it("interpolates at the midpoint", () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });

  it("works when moving backwards", () => {
    expect(lerp(20, 10, 0.5)).toBe(15);
  });
});

describe("stepToward", () => {
  it("moves a fraction of the remaining distance", () => {
    expect(stepToward(0, 100, 0.1, 0.1).value).toBeCloseTo(10, 5);
  });

  it("is not settled while the gap exceeds epsilon", () => {
    expect(stepToward(0, 100, 0.1, 0.1).settled).toBe(false);
  });

  it("snaps exactly to the target once inside epsilon", () => {
    const r = stepToward(99.95, 100, 0.1, 0.1);
    expect(r.value).toBe(100);
    expect(r.settled).toBe(true);
  });

  it("settles when already at the target", () => {
    const r = stepToward(100, 100, 0.1, 0.1);
    expect(r.value).toBe(100);
    expect(r.settled).toBe(true);
  });

  it("settles symmetrically when approaching from above", () => {
    const r = stepToward(100.05, 100, 0.1, 0.1);
    expect(r.value).toBe(100);
    expect(r.settled).toBe(true);
  });

  it("converges rather than oscillating over many steps", () => {
    let v = 0;
    for (let i = 0; i < 200; i++) v = stepToward(v, 100, 0.1, 0.1).value;
    expect(v).toBe(100);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- scrollMath`
Expected: FAIL — `Failed to resolve import "./scrollMath"`.

- [ ] **Step 3: Implement `src/scrollMath.ts`**

```ts
// Pure arithmetic for the smooth-scroll lerp. Kept out of smoothScroll.ts so
// the convergence and clamping behaviour can be tested without a browser,
// a wheel event, or a ticker.

/** Clamps a desired scroll position into [0, maxScroll]. A negative
 *  maxScroll (a transiently mis-measured document) collapses to 0 rather
 *  than inverting the range. */
export function clampScroll(target: number, maxScroll: number): number {
  const max = Math.max(0, maxScroll);
  if (target < 0) return 0;
  if (target > max) return max;
  return target;
}

export function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

/** One frame of easing toward `target`. Once the remaining gap is under
 *  `epsilon` the value SNAPS to the target and reports settled, so the
 *  ticker can park instead of chasing an asymptote forever. */
export function stepToward(
  current: number,
  target: number,
  alpha: number,
  epsilon: number,
): { value: number; settled: boolean } {
  if (Math.abs(target - current) <= epsilon) {
    return { value: target, settled: true };
  }
  return { value: lerp(current, target, alpha), settled: false };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- scrollMath`
Expected: PASS, 16 tests.

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 6: Checkpoint — do NOT commit.**

---

### Task 2: Smooth scroll module

**Files:**
- Create: `src/smoothScroll.ts`, `src/smoothScroll.test.ts`

**Interfaces:**
- Consumes: `clampScroll`, `stepToward` from Task 1; `registerMotion`, `prefersReducedMotion` from `src/motion.ts`.
- Produces: `installSmoothScroll(): () => void` (returns a teardown; a no-op teardown when it declines to install), `isSmoothScrollActive(): boolean`, `killSmoothScroll(): void`. Task 3 and Task 4 both use these.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { installSmoothScroll, isSmoothScrollActive, killSmoothScroll } from "./smoothScroll";

function mockMedia(matches: Record<string, boolean>) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: matches[q] ?? false,
    media: q,
    onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as never;
}

beforeEach(() => mockMedia({}));
afterEach(() => killSmoothScroll());

describe("installSmoothScroll gating", () => {
  it("declines under prefers-reduced-motion", () => {
    mockMedia({ "(prefers-reduced-motion: reduce)": true });
    installSmoothScroll();
    expect(isSmoothScrollActive()).toBe(false);
  });

  it("declines on a coarse pointer", () => {
    mockMedia({ "(pointer: coarse)": true });
    installSmoothScroll();
    expect(isSmoothScrollActive()).toBe(false);
  });

  it("returns a callable teardown even when it declines", () => {
    mockMedia({ "(pointer: coarse)": true });
    expect(() => installSmoothScroll()()).not.toThrow();
  });

  it("installs on a fine pointer with motion allowed", () => {
    installSmoothScroll();
    expect(isSmoothScrollActive()).toBe(true);
  });

  it("is idempotent — installing twice leaves one installation", () => {
    installSmoothScroll();
    installSmoothScroll();
    expect(isSmoothScrollActive()).toBe(true);
    killSmoothScroll();
    expect(isSmoothScrollActive()).toBe(false);
  });
});

describe("teardown", () => {
  it("removes the wheel listener", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const teardown = installSmoothScroll();
    teardown();
    expect(remove).toHaveBeenCalledWith("wheel", expect.any(Function), expect.any(Object));
    remove.mockRestore();
  });

  it("deactivates after teardown", () => {
    installSmoothScroll()();
    expect(isSmoothScrollActive()).toBe(false);
  });

  it("tolerates being torn down twice", () => {
    const teardown = installSmoothScroll();
    teardown();
    expect(() => teardown()).not.toThrow();
  });
});

describe("wheel handling", () => {
  it("prevents default so the native scroll does not double-apply", () => {
    installSmoothScroll();
    const e = new WheelEvent("wheel", { deltaY: 100, cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it("ignores a wheel event once torn down", () => {
    installSmoothScroll()();
    const e = new WheelEvent("wheel", { deltaY: 100, cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- smoothScroll`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/smoothScroll.ts`**

```ts
// frontend/src/smoothScroll.ts
// Inertial scroll, driven by GSAP's ticker.
//
// A non-passive `wheel` listener takes the scroll over: it accumulates a
// target Y, and each frame the actual position eases toward it. ScrollTrigger
// is updated on the same tick, so every reveal in motion.ts stays in sync.
//
// ── What this must NOT break ────────────────────────────────────────────
// Plenty of things move the page without going through the wheel: keyboard
// PageDown/Space/arrows/Home/End, focus jumps, scrollIntoView, and hash
// anchors. A `scroll` listener resyncs the target whenever the position
// moves without us, so none of those fight the lerp.
//
// Failure mode matches motion.ts: if this declines or throws, the page keeps
// native scroll. It is never left in a half-installed state.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { clampScroll, stepToward } from "./scrollMath";
import { prefersReducedMotion, registerMotion } from "./motion";

/** Fraction of the remaining distance covered per frame. Higher is snappier. */
const ALPHA = 0.12;
/** Sub-pixel gap at which the lerp snaps and the ticker parks. */
const EPSILON = 0.1;
/** Wheel delta multiplier. 1 keeps one notch ≈ one native notch. */
const SPEED = 1;

type Installation = {
  onWheel: (e: WheelEvent) => void;
  onScroll: () => void;
  onResize: () => void;
  tick: () => void;
  opts: AddEventListenerOptions;
};

let current: Installation | null = null;
let target = 0;
let position = 0;
let running = false;

function maxScroll(): number {
  return document.documentElement.scrollHeight - window.innerHeight;
}

function frame() {
  const next = stepToward(position, target, ALPHA, EPSILON);
  position = next.value;
  window.scrollTo(0, position);
  // Reveals and scrubbed timelines read scroll position, so they must be
  // updated on the same tick rather than from the native scroll event.
  ScrollTrigger.update();
  if (next.settled) {
    running = false;
    gsap.ticker.remove(frame);
  }
}

function start() {
  if (running) return;
  running = true;
  gsap.ticker.add(frame);
}

export function isSmoothScrollActive(): boolean {
  return current !== null;
}

export function killSmoothScroll(): void {
  if (!current) return;
  window.removeEventListener("wheel", current.onWheel, current.opts);
  window.removeEventListener("scroll", current.onScroll);
  window.removeEventListener("resize", current.onResize);
  if (running) {
    gsap.ticker.remove(frame);
    running = false;
  }
  current = null;
}

/** Installs inertial scroll. Returns a teardown; safe to call twice. */
export function installSmoothScroll(): () => void {
  if (typeof window === "undefined") return () => {};

  // Both opt-outs are checked BEFORE installing — never install-then-disable.
  if (prefersReducedMotion()) return () => {};
  if (window.matchMedia?.("(pointer: coarse)").matches) return () => {};

  if (current) return killSmoothScroll;

  registerMotion();

  position = window.scrollY;
  target = position;

  const onWheel = (e: WheelEvent) => {
    // Let the browser handle zoom and horizontal intent natively.
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    target = clampScroll(target + e.deltaY * SPEED, maxScroll());
    start();
  };

  // Anything that moved the page without us — keyboard, focus, anchors,
  // scrollIntoView — resets the target so the lerp does not yank it back.
  const onScroll = () => {
    if (running) return;
    position = window.scrollY;
    target = position;
  };

  const onResize = () => {
    target = clampScroll(target, maxScroll());
  };

  const opts: AddEventListenerOptions = { passive: false };
  window.addEventListener("wheel", onWheel, opts);
  window.addEventListener("scroll", onScroll);
  window.addEventListener("resize", onResize);

  current = { onWheel, onScroll, onResize, tick: frame, opts };
  return killSmoothScroll;
}

/** Jumps both the lerp and the page to a position with no animation.
 *  Used by the route transition and by settleAll(). */
export function jumpScrollTo(y: number): void {
  const clamped = clampScroll(y, maxScroll());
  position = clamped;
  target = clamped;
  if (running) {
    gsap.ticker.remove(frame);
    running = false;
  }
  window.scrollTo(0, clamped);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- smoothScroll`
Expected: PASS, 10 tests.

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 6: Checkpoint — do NOT commit.**

---

### Task 3: Teach settleAll about the lerp, and install

**Files:**
- Modify: `src/motion.ts` (`settleAll`), `src/main.tsx`
- Create: `src/motion.test.ts`

**Interfaces:**
- Consumes: `killSmoothScroll`, `jumpScrollTo`, `installSmoothScroll` from Task 2.
- Produces: `settleAll()` additionally stops the lerp. `window.__rvSettle` keeps its existing contract.

`settleAll` is the screenshot harness's escape hatch. A lerp mid-flight would leave the page part-scrolled after it runs, so it has to be stopped too.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { settleAll } from "./motion";
import { installSmoothScroll, isSmoothScrollActive, killSmoothScroll } from "./smoothScroll";

afterEach(() => killSmoothScroll());

describe("settleAll", () => {
  it("is exposed on window for the screenshot harness", () => {
    expect(typeof (window as never as { __rvSettle?: () => void }).__rvSettle)
      .toBe("function");
  });

  it("does not throw when nothing is installed", () => {
    expect(() => settleAll()).not.toThrow();
  });

  it("stops an active smooth scroll", () => {
    installSmoothScroll();
    expect(isSmoothScrollActive()).toBe(true);
    settleAll();
    expect(isSmoothScrollActive()).toBe(false);
  });

  it("leaves the page at the top after settling", () => {
    installSmoothScroll();
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: 400, cancelable: true }));
    settleAll();
    expect(window.scrollY).toBe(0);
  });

  it("reveals every data-reveal element", () => {
    const el = document.createElement("div");
    el.setAttribute("data-reveal", "");
    el.style.opacity = "0";
    document.body.appendChild(el);
    settleAll();
    expect(el.style.opacity).toBe("1");
    el.remove();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- motion`
Expected: FAIL — `settleAll` currently early-returns when `registered` is false, and does not know about smooth scroll.

- [ ] **Step 3: Update `settleAll` in `src/motion.ts`**

Replace the existing function with:

```ts
/**
 * Escape hatch for the screenshot harness and for any consumer that needs
 * the page in its settled state without scrolling to it. Exposed on window
 * so a Playwright page.evaluate() can settle the whole document in one call.
 *
 * Smooth scroll has to be killed here too: a lerp in flight would keep
 * moving the page after this returns, which is exactly the mid-scroll
 * screenshot this exists to prevent.
 */
export function settleAll() {
  // Kill the lerp FIRST — a running ticker would otherwise re-scroll the
  // page after we have set its position.
  killSmoothScroll();
  jumpScrollTo(0);

  if (registered) {
    ScrollTrigger.getAll().forEach((t) => {
      const anim = t.animation;
      if (anim) anim.progress(1);
      t.kill();
    });
  }
  // Unconditional: reveals may have been hidden even if no trigger survived.
  gsap.set("[data-reveal]", { opacity: 1, y: 0, filter: "none" });
}
```

Add the import at the top of `src/motion.ts`:

```ts
import { jumpScrollTo, killSmoothScroll } from "./smoothScroll";
```

> **Circular import note:** `smoothScroll.ts` imports `prefersReducedMotion` and `registerMotion` from `motion.ts`, and `motion.ts` now imports from `smoothScroll.ts`. ES modules handle this because every use is inside a function body, not at module top level. Do **not** move either call to module scope.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- motion`
Expected: PASS, 5 tests.

- [ ] **Step 5: Install smooth scroll at app start**

In `src/main.tsx`, add:

```tsx
import { installSmoothScroll } from "./smoothScroll";

// Installs only on a fine pointer with motion allowed; a no-op otherwise.
installSmoothScroll();
```

Place it above `ReactDOM.createRoot(...)`.

- [ ] **Step 6: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 7: Manual scroll check** — `npm run dev`, open the homepage. Confirm: wheel scrolling glides and settles; **PageDown, Space, Home and End still work and do not snap back**; clicking a `#deals` anchor jumps and stays; the deals section still reveals on scroll (ScrollTrigger is in sync).

- [ ] **Step 8: Touch/reduced-motion check** — in DevTools, emulate a touch device and confirm native scrolling returns; enable `prefers-reduced-motion: reduce` and confirm the same.

- [ ] **Step 9: Checkpoint — do NOT commit.**

---

### Task 4: Custom cursor

**Files:**
- Create: `src/Cursor.tsx`, `src/Cursor.test.tsx`
- Modify: `src/main.tsx`, `src/index.css`

**Interfaces:**
- Consumes: `prefersReducedMotion` from `src/motion.ts`.
- Produces: `Cursor()` — no props. Renders `null` on coarse pointers and under reduced motion.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { Cursor } from "./Cursor";

function mockMedia(matches: Record<string, boolean>) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: matches[q] ?? false,
    media: q,
    onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as never;
}

beforeEach(() => mockMedia({ "(pointer: fine)": true }));

describe("Cursor", () => {
  it("renders a dot and a ring on a fine pointer", () => {
    const { container } = render(<Cursor />);
    expect(container.querySelector(".rv-cursor-dot")).toBeTruthy();
    expect(container.querySelector(".rv-cursor-ring")).toBeTruthy();
  });

  it("renders nothing on a coarse pointer", () => {
    mockMedia({ "(pointer: fine)": false, "(pointer: coarse)": true });
    const { container } = render(<Cursor />);
    expect(container.querySelector(".rv-cursor-dot")).toBeNull();
  });

  it("renders nothing under reduced motion", () => {
    mockMedia({ "(pointer: fine)": true, "(prefers-reduced-motion: reduce)": true });
    const { container } = render(<Cursor />);
    expect(container.querySelector(".rv-cursor-dot")).toBeNull();
  });

  it("hides its layers from assistive tech", () => {
    const { container } = render(<Cursor />);
    expect(container.querySelector(".rv-cursor")).toHaveAttribute("aria-hidden", "true");
  });

  it("removes its listeners on unmount", () => {
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<Cursor />);
    unmount();
    expect(remove).toHaveBeenCalledWith("pointermove", expect.any(Function));
    remove.mockRestore();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- Cursor`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/Cursor.tsx`**

```tsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "./motion";

const HOVER_SELECTOR = 'a, button, [role="button"], .rv-pcard, .rv-fan-card, summary';

// Two layers: a dot that tracks the pointer almost exactly, and a ring that
// trails it. quickTo is used rather than gsap.to per event — it reuses one
// tween instead of allocating a new one on every pointermove.
export function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);

  // Decide once, on mount. Both opt-outs are hard: no cursor at all, rather
  // than a cursor that is present but inert.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    setEnabled(fine && !prefersReducedMotion());
  }, []);

  useLayoutEffect(() => {
    if (!enabled) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const dotX = gsap.quickTo(dot, "x", { duration: 0.12, ease: "power3" });
    const dotY = gsap.quickTo(dot, "y", { duration: 0.12, ease: "power3" });
    const ringX = gsap.quickTo(ring, "x", { duration: 0.5, ease: "power3" });
    const ringY = gsap.quickTo(ring, "y", { duration: 0.5, ease: "power3" });

    function onMove(e: PointerEvent) {
      dotX(e.clientX); dotY(e.clientY);
      ringX(e.clientX); ringY(e.clientY);
    }

    // Delegated, so content mounted later (route changes, lazy lists) is
    // covered without re-binding.
    function onOver(e: PointerEvent) {
      if ((e.target as Element | null)?.closest?.(HOVER_SELECTOR)) {
        gsap.to(ring, { scale: 1.8, duration: 0.3, ease: "power3" });
        gsap.to(dot, { scale: 0.5, duration: 0.3, ease: "power3" });
      }
    }
    function onOut(e: PointerEvent) {
      if ((e.target as Element | null)?.closest?.(HOVER_SELECTOR)) {
        gsap.to(ring, { scale: 1, duration: 0.3, ease: "power3" });
        gsap.to(dot, { scale: 1, duration: 0.3, ease: "power3" });
      }
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.documentElement.classList.add("rv-has-cursor");

    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.documentElement.classList.remove("rv-has-cursor");
      gsap.killTweensOf([dot, ring]);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="rv-cursor" aria-hidden="true">
      <div className="rv-cursor-ring" ref={ringRef} />
      <div className="rv-cursor-dot" ref={dotRef} />
    </div>
  );
}

export const CURSOR_STYLES = `
  .rv-cursor { position: fixed; inset: 0; pointer-events: none; z-index: 9999; }
  .rv-cursor-dot, .rv-cursor-ring {
    position: fixed; top: 0; left: 0;
    border-radius: 999px; pointer-events: none;
    will-change: transform;
  }
  .rv-cursor-dot {
    width: 7px; height: 7px; margin: -3.5px 0 0 -3.5px;
    background: var(--ink);
  }
  .rv-cursor-ring {
    width: 30px; height: 30px; margin: -15px 0 0 -15px;
    border: 1px solid var(--ink-fade);
  }

  /* The native cursor is hidden only while ours is mounted, and only
     outside text-entry controls — an I-beam is doing real work that a dot
     cannot replace. */
  .rv-has-cursor, .rv-has-cursor a, .rv-has-cursor button { cursor: none; }
  .rv-has-cursor input,
  .rv-has-cursor textarea,
  .rv-has-cursor [contenteditable="true"] { cursor: auto; }
`;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- Cursor`
Expected: PASS, 5 tests.

- [ ] **Step 5: Mount it**

In `src/main.tsx`, render `<Cursor />` inside `QueryClientProvider`, after `<App />`. Add `CURSOR_STYLES` to the app-level `<style>` block in `src/App.tsx`.

- [ ] **Step 6: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 7: Manual check** — `npm run dev`. Confirm: the ring trails the dot with visible lag; both grow/shrink over links and buttons; the native cursor is hidden generally but **the I-beam returns over the paste-a-URL box and the login fields**; the ring keeps working after navigating to another route (delegation).

- [ ] **Step 8: Opt-out check** — emulate a touch device: no cursor, native pointer behaviour. Enable reduced motion: same.

- [ ] **Step 9: Checkpoint — do NOT commit.**

---

### Task 5: GSAP route transitions

**Files:**
- Create: `src/RouteTransition.tsx`, `src/RouteTransition.test.tsx`
- Modify: `src/App.tsx:351-375`

**Interfaces:**
- Consumes: `prefersReducedMotion` from `src/motion.ts`; `jumpScrollTo` from Task 2.
- Produces: `RouteTransition({ routeKey, children }: { routeKey: string; children: ReactNode })`.

This replaces the framer-motion `AnimatePresence` crossfade at `src/App.tsx:369`. framer-motion stays in the other three files.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouteTransition } from "./RouteTransition";

function mockMedia(matches: Record<string, boolean>) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: matches[q] ?? false,
    media: q,
    onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as never;
}

beforeEach(() => mockMedia({}));

describe("RouteTransition", () => {
  it("renders its children", () => {
    render(<RouteTransition routeKey="home"><p>home page</p></RouteTransition>);
    expect(screen.getByText("home page")).toBeInTheDocument();
  });

  it("renders the incoming route after a key change", () => {
    const { rerender } = render(
      <RouteTransition routeKey="home"><p>home page</p></RouteTransition>,
    );
    rerender(<RouteTransition routeKey="browse"><p>browse page</p></RouteTransition>);
    expect(screen.getByText("browse page")).toBeInTheDocument();
  });

  it("leaves content fully visible under reduced motion", () => {
    mockMedia({ "(prefers-reduced-motion: reduce)": true });
    const { container } = render(
      <RouteTransition routeKey="home"><p>home page</p></RouteTransition>,
    );
    const stage = container.querySelector(".rv-route")! as HTMLElement;
    // Never hidden by CSS — the failure mode is "visible and unanimated".
    expect(stage.style.opacity).not.toBe("0");
  });

  it("does not hide content when GSAP never runs", () => {
    const { container } = render(
      <RouteTransition routeKey="home"><p>home page</p></RouteTransition>,
    );
    expect(screen.getByText("home page")).toBeVisible();
    expect(container.querySelector(".rv-route")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- RouteTransition`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/RouteTransition.tsx`**

```tsx
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "./motion";
import { jumpScrollTo } from "./smoothScroll";

// Replaces the framer-motion crossfade. Speaks the same vocabulary as
// revealChildren in motion.ts — expo.out on the way in — so a route entry
// and a section reveal feel like the same system.
//
// On-mount, never ScrollTrigger-gated: a scroll gate on above-the-fold
// content ships blank in headless renders. See motion.ts's hero rule.
export function RouteTransition({
  routeKey,
  children,
}: {
  routeKey: string;
  children: ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const previousKey = useRef(routeKey);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    if (prefersReducedMotion()) return;

    const isFirstRender = previousKey.current === routeKey;
    previousKey.current = routeKey;

    // Reset scroll between the halves so the incoming route starts at the
    // top, and resync the lerp so it does not glide back to where we were.
    if (!isFirstRender) jumpScrollTo(0);

    const tween = gsap.fromTo(
      el,
      { opacity: 0, y: 16, filter: "blur(8px)" },
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 0.5,
        ease: "expo.out",
        // Drop the inline filter once landed so a stale blur never sits on
        // a composited layer for the rest of the session.
        clearProps: "filter",
      },
    );

    return () => {
      tween.kill();
      // If we are interrupted mid-tween the route must not be left faded.
      gsap.set(el, { opacity: 1, y: 0, filter: "none" });
    };
  }, [routeKey]);

  return (
    <div className="rv-route" ref={stageRef} key={routeKey}>
      {children}
    </div>
  );
}
```

> **Why there is no exit animation.** An outgoing tween needs the old tree kept mounted while it plays, which means holding stale React state — and the routes here are driven by queries that would refetch behind it. The entry tween alone reads as a transition and costs nothing in correctness. If an exit is wanted later, it needs a deliberate two-tree design, not a flag.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- RouteTransition`
Expected: PASS, 4 tests.

- [ ] **Step 5: Replace the framer-motion crossfade in `src/App.tsx`**

Delete the `fade` object (lines ~352–360) and replace the render block:

```tsx
      <RouteTransition routeKey={routeKey}>
        {routeEl}
      </RouteTransition>
```

Remove `AnimatePresence`, `motion`, and `useReducedMotion` from the `framer-motion` import on line 2 **only if** nothing else in `App.tsx` still uses them — check with `grep -n "motion\.\|AnimatePresence\|useReducedMotion" src/App.tsx` first. Add `import { RouteTransition } from "./RouteTransition";`.

- [ ] **Step 6: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 7: Manual check** — `npm run dev`. Navigate home → login → browse → a product → back. Confirm each route fades and lifts in, the page starts at the top every time, and the smooth scroll does not drag the new route back to the old offset.

- [ ] **Step 8: Checkpoint — do NOT commit.**

---

### Task 6: Re-verify the screenshot harness

**Files:**
- Modify: none expected. `verify-anim.mjs`, `verify-dashboard.mjs`, `verify-gsap.mjs`, `verify-login.mjs` only if they break.

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

These four Playwright scripts are the reason `settleAll` exists. Smooth scroll is exactly the kind of change that breaks them.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (leave running; note the port).

- [ ] **Step 2: Run each harness script**

```bash
node verify-anim.mjs
node verify-dashboard.mjs
node verify-gsap.mjs
node verify-login.mjs
```

Expected: each completes and reports success as it did before this plan.

- [ ] **Step 3: If any script hangs or captures a part-scrolled page**

The cause is almost always a lerp still running when the screenshot is taken. Confirm the script calls `window.__rvSettle()` before capturing; if it does and still fails, check that Task 3's `settleAll` calls `killSmoothScroll()` **before** `jumpScrollTo(0)` — the other order lets the ticker re-scroll after the jump.

- [ ] **Step 4: Full suite and build**

Run: `npm test && npm run build`
Expected: both exit 0.

- [ ] **Step 5: Checkpoint — do NOT commit.**

---

## Final verification

- [ ] **Full test run:** `npm test` — every suite passes.
- [ ] **Full build:** `npm run build` — exit 0.
- [ ] **Fine pointer, motion allowed:** wheel scroll glides; cursor dot and trailing ring track and react to hover; routes fade-lift in.
- [ ] **Keyboard scrolling:** PageDown, Space, Home, End, and arrow keys all move the page and do not snap back.
- [ ] **Anchor links:** `#deals` jumps and stays put.
- [ ] **ScrollTrigger sync:** the deals section and score explainer still reveal and scrub correctly while smooth scroll is active.
- [ ] **Coarse pointer:** no custom cursor, native momentum scrolling intact.
- [ ] **Reduced motion:** no cursor, no smooth scroll, no route tween, all content visible.
- [ ] **GSAP-blocked simulation:** throw inside `installSmoothScroll` temporarily and confirm the page still renders and scrolls natively — then revert. This verifies the inherited failure mode.
- [ ] **Screenshot harness:** all four `verify-*.mjs` scripts pass.

---

## Self-review notes

**Spec coverage.** Phase 4 of the design doc maps as: `smoothScroll.ts` → Tasks 1–2; the `scroll`-listener resync, opt-outs, and teardown → Task 2; `settleAll` integration → Task 3; `Cursor.tsx` with delegated hover and the I-beam exception → Task 4; the GSAP route transition replacing `App.tsx:369` → Task 5; harness re-verification → Task 6. Both constraints called out in the spec (the hero rule, the `__rvSettle` hatch) appear in Global Constraints and are enforced by tests in Tasks 3 and 5.

**Deliberate departure from the spec.** The spec describes an outgoing tween (opacity→0 / y→−12 / blur 6 over .28s `power2.in`). Task 5 ships entry-only. Holding the outgoing tree mounted means holding stale query state behind it, which is a correctness cost for a cosmetic gain. Noted inline in `RouteTransition.tsx` so the decision is visible where the code is. **Flag this at review** — if the exit tween is wanted, it needs a two-tree design and its own task.

**Circular import.** `motion.ts` ↔ `smoothScroll.ts` is intentional and safe because every cross-module call sits inside a function body. Task 3 Step 3 documents it; moving either call to module scope would break it.

**Ordering.** Task 2 must precede Task 3 (`settleAll` imports from it), and Task 3 must precede Task 5 (`jumpScrollTo` must actually stop a running lerp before the route transition relies on it).
