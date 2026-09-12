# Hyper UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the WasItCheaper frontend's "instrument" design system (warm paper, hairline rules, achromatic CTA) with the Hyper UI / Tailwind visual language, and build the six reference components the app lacks.

**Architecture:** Every component reads CSS custom properties from `src/theme.css`, so repointing ~70 token values flips all ~7,900 lines of TSX at once (Phase 1). The primitive vocabulary is then rebuilt component-by-component (Phase 2), and six new components are built and placed in real screens (Phase 3). Components keep injecting CSS through `<style>` template strings — that architecture is deliberately unchanged.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Tailwind 3.4, GSAP 3.15, framer-motion 12, TanStack Query 5. Test harness added by Task 1: Vitest 3 + jsdom + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-09-10-hyper-ui-redesign-design.md`
**Reference set:** `docs/design/component-language.md`

## Global Constraints

- **Never commit.** Bibek owns the git history. Every task ends at a verification checkpoint with changes left in the working tree. Do not run `git commit`, `git add`, `git checkout`, `git reset`, or any history-writing command. Git is read-only here.
- **Working directory:** `C:\Users\bibek\Personal Projects\car catch ai\car-deal-finder\frontend`
- **Build must pass at every checkpoint:** `npm run build` (`tsc -b && vite build`).
- **Tailwind v3 values only** (project runs `tailwindcss ^3.4.18`). Do not use v4 syntax.
- **Token names are stable.** `theme.css`'s convention is that names never change across redesigns; only values repoint. The single approved exception is `--paper` → adding `--ground` (Task 3).
- **Light mode only.** No dark-mode blocks; none of the reference components define one.
- **Glass is for CHROME ONLY.** Bibek's 2026-09-11 direction: liquid glass on
  surfaces that float or that you act on (navbar, buttons, dropdowns, toasts,
  filter popovers, mobile sheet); reading surfaces (cards, panels, tables,
  prose, charts) stay flat and opaque. Never set a price, a figure, or a table
  on a blurred ground.
- **Never write `JSX.Element`.** `@types/react` 19 removed the global `JSX`
  namespace — `tsc -b` fails with `TS2503`. Use `ComponentType<P>` for a
  component value, `ReactElement` for an element. `React.ReactNode` and
  `React.KeyboardEvent` remain valid (UMD global).
- **`verbatimModuleSyntax` is on.** Every type-only import must use
  `import type { X }` or an inline `type` modifier, or the build fails.
- **`noUnusedLocals` and `noUnusedParameters` are on.** An unused import or
  parameter is a build error, not a warning. Prefix deliberately-unused
  parameters with `_`.
- **Contrast floors:** 4.5:1 for text under 18px, 3:1 for text ≥18px bold or ≥24px, 3:1 for meaningful graphics. Verify with `src/__tests__/contrast.ts`, never by eye.
- **Typography is already done.** Plus Jakarta Sans (`--font-sans`), Urbanist (`--font-display`, `--font-mono`). Do not re-swap fonts. Do not add `font-stretch` — neither face has a width axis.
- **Figures need `tabular-nums`.** Urbanist is proportional. `body` sets `font-variant-numeric: tabular-nums lining-nums` globally; do not override it to `normal` anywhere a number renders.
- **The hero never scroll-gates.** Above-the-fold content must not be hidden behind a ScrollTrigger — it ships blank in headless renders and breaks the screenshot harness. See `src/motion.ts`.
- **`--series-*` and `--ramp-*` are frozen.** The dataviz palette was re-validated against white; every ratio improves. Do not change these nine values. `--series-4` (2.69:1) keeps its direct-label obligation.

---

## Deviation from the spec, and why

The spec says *"This project does not introduce a test framework; that would be its own change."* This plan overrides that in Task 1.

**Reason:** the spec was written before the plan had to specify how each task is verified. Three things in Phases 2–3 carry real logic that is untestable by build-and-look: the toast reducer, the dropdown's roving focus and Escape handling, and the product card's stretched-link structure (which exists specifically to fix invalid HTML — a regression there is silent). Verifying those by eye is how they break later.

**Scope control:** Vitest is added for *logic and tokens only*. The visual work in Phase 1 is verified by a token-parsing test plus the build; no snapshot tests, no visual-regression tooling, no tests written for pure styling.

---

## File structure

**Created**

| File | Responsibility |
|---|---|
| `vitest.config.ts` | Test runner config, jsdom environment |
| `src/__tests__/setup.ts` | Testing-library cleanup + `matchMedia` stub |
| `src/__tests__/contrast.ts` | WCAG contrast helper: `relativeLuminance`, `contrastRatio`, `parseTokens` |
| `src/__tests__/tokens.test.ts` | Asserts token values and their contrast ratios |
| `src/Badge.tsx` | Icon pill badge (solid + outline) — replaces `Stamp` |
| `src/StatCard.tsx` | Label / figure / icon well / trend row |
| `src/ProductCard.tsx` | Grid product card with stretched link |
| `src/Accordion.tsx` | `<details>`-based disclosure |
| `src/Breadcrumbs.tsx` | `aria-label="Breadcrumb"` nav |
| `src/Toast.tsx` | Toast component + `ToastHost` + `useToast` |
| `src/toastStore.ts` | Framework-free toast reducer and store |
| `src/Dropdown.tsx` | Menu with roving focus, Escape, outside-click |
| `src/FilterPopover.tsx` | `<details>` filter popovers (checkbox + range) |
| `src/Timeline.tsx` | Alternating price-event timeline |
| `src/icons.tsx` | The Heroicons 24-outline set used across the above |

**Modified**

| File | Change |
|---|---|
| `src/theme.css` | All token values + rewritten rationale prose |
| `src/index.css` | Body ground colour |
| `tailwind.config.cjs` | Radius bridge values |
| `src/primitives.tsx` | `Button`/`ButtonGroup`/`Panel` rebuilt; `Bezel` + `Stamp` removed |
| `src/Spinner.tsx` | framer-motion → CSS `animate-spin` |
| `src/priceViews.tsx` | Product metadata → `<dl>` details list |
| `src/HomePage.tsx` | `Bezel` call site; deals fan card shape |
| `src/BrowsePage.tsx` | Product grid → `ProductCard`; filter popovers |
| `src/ProductFan.tsx` | Card shape only — GSAP fan choreography untouched |
| `src/App.tsx` | Watchlist row type/colour; stat cards; row dropdown |
| `src/ProductDetailPage.tsx` | Breadcrumbs, timeline, details list |
| `src/AlertsPage.tsx`, `src/LoginPage.tsx`, `src/LegalPage.tsx` | Badge/input/accordion call sites |
| `src/main.tsx` | Mount `ToastHost` |
| `package.json` | Test deps + `test` script |

---

# Phase 1 — Retoken

### Task 1: Test harness and contrast helper

**Files:**
- Create: `vitest.config.ts`, `src/__tests__/setup.ts`, `src/__tests__/contrast.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `relativeLuminance(hex: string): number`, `contrastRatio(a: string, b: string): number`, `parseTokens(css: string): Record<string, string>` — all from `src/__tests__/contrast.ts`. Task 2 and Task 5 depend on these exact names.

- [ ] **Step 1: Install test dependencies**

```bash
npm i -D vitest@^3 jsdom@^26 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14
```

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

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

- [ ] **Step 4: Create `src/__tests__/setup.ts`**

`matchMedia` does not exist in jsdom, and several components call it via `prefersReducedMotion()`. Without this stub they throw.

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

- [ ] **Step 5: Write the failing test for the contrast helper**

Create `src/__tests__/contrast.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { contrastRatio, relativeLuminance, parseTokens } from "./contrast";

describe("contrast helper", () => {
  it("computes known luminance endpoints", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("computes the maximum contrast ratio", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
  });

  it("is order-independent", () => {
    expect(contrastRatio("#2563eb", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#2563eb"),
      5,
    );
  });

  it("matches a verified reference pair", () => {
    // gray-700 on white, verified during design.
    expect(contrastRatio("#374151", "#ffffff")).toBeCloseTo(10.31, 1);
  });

  it("accepts shorthand hex", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 2);
  });

  it("parses custom properties out of CSS text", () => {
    const css = ":root {\n  --ink: #111827;\n  --rule:  #e5e7eb;\n}";
    expect(parseTokens(css)).toEqual({ "--ink": "#111827", "--rule": "#e5e7eb" });
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test -- contrast`
Expected: FAIL — `Failed to resolve import "./contrast"`.

- [ ] **Step 7: Implement `src/__tests__/contrast.ts`**

```ts
/** WCAG 2.1 relative luminance / contrast, plus a token parser.
 *  Used by tokens.test.ts to hold the palette to measured floors rather
 *  than to anyone's eye. */

function expand(hex: string): string {
  const h = hex.trim().replace(/^#/, "");
  return h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const h = expand(hex);
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`not a hex colour: ${hex}`);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Pulls `--name: value;` pairs out of CSS source text. Values are trimmed;
 *  declarations spanning lines are not supported (none exist in theme.css). */
export function parseTokens(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) out[m[1]] = m[2].trim();
  return out;
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm test -- contrast`
Expected: PASS, 6 tests.

- [ ] **Step 9: Verify the build still passes**

Run: `npm run build`
Expected: exit 0. (`vitest.config.ts` must not be picked up by `tsc -b`; if it errors, add it to `tsconfig.node.json`'s `include`.)

- [ ] **Step 10: Checkpoint — do NOT commit.** Leave changes in the working tree and report completion.

---

### Task 2: Retoken theme.css

**Files:**
- Create: `src/__tests__/tokens.test.ts`
- Modify: `src/theme.css`

**Interfaces:**
- Consumes: `parseTokens`, `contrastRatio` from Task 1.
- Produces: the token values every later task styles against. `--ground`, `--rule-faint`, `--green-line`, `--indigo` are new names introduced here.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/tokens.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { contrastRatio, parseTokens } from "./contrast";

const css = readFileSync(resolve(__dirname, "../theme.css"), "utf8");
const t = parseTokens(css);

const WHITE = "#ffffff";

describe("palette values", () => {
  it("uses the Hyper UI surfaces", () => {
    expect(t["--paper"]).toBe("#ffffff");
    expect(t["--ground"]).toBe("#f9fafb");
    expect(t["--paper-soft"]).toBe("#f9fafb");
    expect(t["--paper-deep"]).toBe("#f3f4f6");
  });

  it("uses the Tailwind gray ramp for ink", () => {
    expect(t["--ink"]).toBe("#111827");
    expect(t["--ink-soft"]).toBe("#374151");
    expect(t["--ink-muted"]).toBe("#4b5563");
    expect(t["--ink-fade"]).toBe("#6b7280");
  });

  it("gives --blue a real value at last", () => {
    expect(t["--blue"]).toBe("#2563eb");
    expect(t["--indigo"]).toBe("#4f46e5");
    expect(t["--link"]).toBe("#2563eb");
    expect(t["--link-hover"]).toBe("#1d4ed8");
  });

  it("maps structure to the gray border ramp", () => {
    expect(t["--rule-faint"]).toBe("#f3f4f6");
    expect(t["--rule"]).toBe("#e5e7eb");
    expect(t["--rule-strong"]).toBe("#d1d5db");
  });

  it("collapses radius to the Tailwind scale", () => {
    expect(t["--r-sm"]).toBe("2px");
    expect(t["--r-md"]).toBe("4px");
    expect(t["--r-lg"]).toBe("8px");
    expect(t["--r-xl"]).toBe("12px");
    expect(t["--r-card"]).toBe("8px");
    expect(t["--r-pill"]).toBe("999px");
  });
});

describe("contrast floors", () => {
  it("every ink step clears AA on white", () => {
    for (const k of ["--ink", "--ink-soft", "--ink-muted", "--ink-fade"]) {
      expect(contrastRatio(t[k], WHITE)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("ink-fade also clears AA on the page ground", () => {
    expect(contrastRatio(t["--ink-fade"], t["--ground"])).toBeGreaterThanOrEqual(4.5);
  });

  it("each status deep tone clears AA on its own tint", () => {
    expect(contrastRatio(t["--green-deep"], t["--green-tint"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["--amber-deep"], t["--amber-tint"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["--red-deep"], t["--red-tint"])).toBeGreaterThanOrEqual(4.5);
  });

  it("each status deep tone clears AA on white", () => {
    for (const k of ["--green-deep", "--amber-deep", "--red-deep"]) {
      expect(contrastRatio(t[k], WHITE)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("accents clear AA on white", () => {
    expect(contrastRatio(t["--blue"], WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["--indigo"], WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it("the blue icon well clears the 3:1 graphic floor", () => {
    expect(contrastRatio(t["--blue"], t["--blue-tint"])).toBeGreaterThanOrEqual(3);
  });
});

describe("the dataviz palette is frozen", () => {
  it("keeps the nine validated marks", () => {
    expect(t["--series-1"]).toBe("#2a78d6");
    expect(t["--series-2"]).toBe("#eb6834");
    expect(t["--series-3"]).toBe("#4a3aa7");
    expect(t["--series-4"]).toBe("#e87ba4");
    expect(t["--ramp-1"]).toBe("#6da7ec");
    expect(t["--ramp-5"]).toBe("#0d366b");
  });

  it("every ramp step clears the 2:1 light-end floor on white", () => {
    for (const k of ["--ramp-1", "--ramp-2", "--ramp-3", "--ramp-4", "--ramp-5"]) {
      expect(contrastRatio(t[k], WHITE)).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps series-4 flagged as label-obligated (under 3:1)", () => {
    expect(contrastRatio(t["--series-4"], WHITE)).toBeLessThan(3);
  });
});

describe("tokens with live consumers survive", () => {
  it("keeps --img-ring, which five call sites still read", () => {
    expect(t["--img-ring"]).toBeDefined();
  });

  it("keeps --img-radius", () => {
    expect(t["--img-radius"]).toBe("8px");
  });
});

describe("dead tokens are gone", () => {
  it("drops the instrument-era tokens with no consumer", () => {
    for (const k of [
      "--grid", "--grid-size", "--bezel-pad", "--bezel-outer",
      "--bezel-inner", "--shadow-lip", "--z-grain",
    ]) {
      expect(t[k]).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tokens`
Expected: FAIL — `--paper` is `#f4f3ef`, `--ground` is undefined, `--grid` still exists, etc.

- [ ] **Step 3: Repoint the values in `src/theme.css`**

Replace the surface, ink, status, accent, structure, radius and shadow blocks with:

```css
  /* ── Surfaces ─────────────────────────────────────────────────────────
     --paper is the CARD surface (white); --ground is the PAGE behind it
     (gray-50). This is the inverse of the instrument system, where the
     page was --paper and cards were --paper-pale. */
  --paper:        #ffffff;   /* white     — card + control surface */
  --ground:       #f9fafb;   /* gray-50   — page behind the cards */
  --paper-soft:   #f9fafb;   /* gray-50   — hover ground, zebra rows */
  --paper-deep:   #f3f4f6;   /* gray-100  — secondary button fill */
  --paper-pale:   #ffffff;   /* white */
  --bone:         #ffffff;   /* white */

  /* ── Ink — the Tailwind gray ramp. Ratios on white:
     --ink 17.74:1 · --ink-soft 10.31:1 · --ink-muted 7.56:1
     · --ink-fade 4.83:1 (and 4.63:1 on --ground).
     Note --ink-fade now clears AA. The instrument system's "never a
     sentence" restriction on it is lifted: gray-500 is the reference
     set's caption colour and is legible at body size. */
  --ink:          #111827;   /* gray-900 */
  --ink-soft:     #374151;   /* gray-700 */
  --ink-muted:    #4b5563;   /* gray-600 */
  --ink-fade:     #6b7280;   /* gray-500 */

  /* ── Green — emerald for badges. NO LONGER RESERVED. The instrument
     system spent green exclusively on "the deal math verified this";
     the reference set uses emerald decoratively, so a green badge no
     longer certifies anything. Deal facts are carried by the figure and
     its label, not by hue alone. */
  --green:        #059669;   /* emerald-600 */
  --green-deep:   #047857;   /* emerald-700 — 5.48:1 white, 4.84:1 on tint */
  --green-tint:   #d1fae5;   /* emerald-100 */
  --green-line:   #10b981;   /* emerald-500 — outline-badge border */
  --green-wash:   #f0fdf4;   /* green-50    — toast ground */

  /* ── Amber — caution: a price rise, thin margin, low coverage. */
  --amber:        #f59e0b;   /* amber-500 */
  --amber-deep:   #b45309;   /* amber-700 — 5.02:1 white, 4.51:1 on tint */
  --amber-tint:   #fef3c7;   /* amber-100 */

  /* ── Red — error / danger. A price rise is amber, not an error. */
  --red:          #ef4444;   /* red-500 */
  --red-deep:     #b91c1c;   /* red-700 — 6.47:1 white, 5.30:1 on tint */
  --red-tint:     #fee2e2;   /* red-100 */
  --red-wash:     #fef2f2;   /* red-50 — destructive menu-item hover */

  /* ── Primary — the reference set's primary button is gray-900 on white
     and its secondary is gray-100. Still achromatic, but now because
     that is what the reference set does, not to protect green. */
  --primary:      #111827;   /* gray-900 */
  --primary-deep: #000000;
  --primary-tint: #f3f4f6;   /* gray-100 — secondary button fill */
  --primary-wash: rgba(17,24,39,.06);

  /* ── Accent — blue for informational chrome and icon wells, indigo for
     loading. --blue held #3c3b34 under the instrument system (a
     placeholder, because "a second hue would compete with green"). It
     finally holds a blue, so no rename is needed. */
  --blue:         #2563eb;   /* blue-600 — 5.17:1 white, 4.24:1 on tint */
  --blue-bright:  #3b82f6;   /* blue-500 — focus rings */
  --blue-deep:    #1d4ed8;   /* blue-700 */
  --blue-tint:    #dbeafe;   /* blue-100 — icon wells */
  --indigo:       #4f46e5;   /* indigo-600 — 6.29:1, the spinner */
  --link:         #2563eb;
  --link-hover:   #1d4ed8;

  /* ── Structure — borders, not hairlines. Three weights, matching the
     reference set: gray-100 on cards, gray-200 on accordions and button
     groups, gray-300 on popovers and inputs. */
  --rule-faint:   #f3f4f6;   /* gray-100 */
  --rule:         #e5e7eb;   /* gray-200 */
  --rule-strong:  #d1d5db;   /* gray-300 */
  --border:        var(--rule);
  --border-strong: var(--rule-strong);
  --err:           var(--red);
```

Then the radius and shadow blocks:

```css
  /* ── Radius — the Tailwind scale. The instrument system ran pill on
     things you act on and a 20px squircle on things that enclose; the
     reference set is flatter and more uniform. */
  --r-sm:   2px;    /* rounded-sm   — button-group ends, card CTAs */
  --r-md:   4px;    /* rounded      — dropdowns, popovers, inputs */
  --r-lg:   8px;    /* rounded-lg   — accordions, stat cards */
  --r-xl:   12px;   /* rounded-xl */
  --r-card: 8px;    /* rounded-lg   — the card radius */
  --r-pill: 999px;  /* rounded-full — badges, icon buttons, dots */

  /* ── Elevation — Tailwind's neutral drops. The instrument system used
     warm two-stop ambient diffusion tinted to the ink ramp; the
     reference set uses flat neutral shadows, mostly shadow-sm. */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / .05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / .1), 0 2px 4px -2px rgb(0 0 0 / .1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / .1), 0 4px 6px -4px rgb(0 0 0 / .1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / .1), 0 8px 10px -6px rgb(0 0 0 / .1);
```

- [ ] **Step 4: Delete the dead tokens**

Remove these declarations entirely — every consumer is removed in Task 4:
`--grid`, `--grid-size`, `--bezel-pad`, `--bezel-outer`, `--bezel-inner`,
`--shadow-lip`, `--z-grain`.

> **`--img-ring` is NOT deleted.** The spec listed it as dead; it is not. It
> has five live consumers — `App.tsx:825`, `App.tsx:885` (`.rv-wrow-thumb`),
> `BrowsePage.tsx:295`, `ProductDetailPage.tsx:491`, and `ProductImage.tsx:15`
> (which reads it with a fallback). Repoint it instead:
>
> ```css
>   --img-ring: inset 0 0 0 1px rgb(0 0 0 / .05);
> ```
>
> `--img-radius` also survives, repointed to `8px` to match `--r-card`.

- [ ] **Step 4b: Add the screen-reader-only utility**

`.rv-sr` is used by `StatCard`, `ProductCard`, `Breadcrumbs`, `Toast` and
`FilterPopover` (Tasks 11, 12, 15, 17, 19). It must live in `theme.css`, which
is loaded globally — defining it inside any one component's style string would
leave the text **visible** on every page that does not render that component.

Add to `src/theme.css`, beside `.rv-num`:

```css
/* Screen-reader-only. Used wherever an icon carries meaning that sighted
   users get from shape or colour — a trend arrow, an icon-only button. */
.rv-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
```

- [ ] **Step 5: Rewrite the file header**

`theme.css`'s header currently argues for the instrument system — "Chrome is quiet — hairline rules, no cards, no bevels, no shadows on content", "green → A GENUINE DROP … Never decorative", "primary → Ink-filled, NOT a brand hue". All of that is now false. Replace the header comment with:

```css
/* frontend/src/theme.css
   Single source of truth for typography + design tokens — loaded once,
   globally, via main.tsx (:root), inherited by every page's own wrapper.

   Direction: "Hyper UI". White cards on a gray-50 ground, gray borders,
   an 8px card radius, blue and indigo accents, and emerald/amber/red
   status badges. Derived from the thirteen reference components in
   docs/design/component-language.md — match those when adding anything.

   Token NAMES are stable across redesigns (the established convention
   here — a rename touches dozens of call sites for nothing). Only values
   repoint. The one exception this pass is --ground, added because --paper
   inverted meaning: it is now the CARD surface, not the page.

   Semantic mapping:
     ink     → gray text ramp; paper → card surface; ground → page
     green   → emerald. Decorative as well as semantic — a green badge
               does NOT certify that the deal math verified anything.
               (This is a deliberate reversal of the instrument system.)
     amber   → caution: a price rise, thin margin, low coverage
     red     → error / danger ONLY (form validation, failed request) —
               never repurposed for "price went up", that is amber
     blue    → informational chrome, icon wells, links, focus rings
     indigo  → loading only
     primary → interactive/CTA, gray-900 fill; gray-100 for secondary

   The --series-* / --ramp-* dataviz palette below is FROZEN — see its own
   note. It was re-validated against white and every ratio improved.
*/
```

- [ ] **Step 6: Update the dataviz palette's note**

Its comment says values were validated against `--paper #f4f3ef`. Append:

```css
     RE-VALIDATED 2026-09-10 against the new white surface. Every ratio
     IMPROVED (white is lighter than the old paper, and all nine marks
     are darker than both): series-2 2.88 → 3.20 (now clears 3:1),
     series-4 2.42 → 2.69, ramp-1 2.25 → 2.50 (clears the 2:1 light-end
     floor). Values are unchanged and must stay unchanged.

     --series-4 remains under 3:1, so its direct-label obligation stands:
     met by the ScoreBar legend readouts and the composition chart's
     "Show as table" toggle.
```

- [ ] **Step 7: Run the token test**

Run: `npm test -- tokens`
Expected: PASS, all describes green.

- [ ] **Step 8: Verify the build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 9: Checkpoint — do NOT commit.**

---

### Task 3: Page ground and the `--ground` split

**Files:**
- Modify: `src/index.css`, `src/App.tsx:840`, `src/BrowsePage.tsx:248`, `src/AlertsPage.tsx:175`, `src/HomePage.tsx:369`, `src/LoginPage.tsx:406`, `src/ProductDetailPage.tsx:469`

**Interfaces:**
- Consumes: `--ground`, `--paper` from Task 2.
- Produces: nothing new.

- [ ] **Step 1: Repoint the body in `src/index.css`**

The instrument system painted a fixed radial light source on `body` to make the flat paper read as a lit sheet. Hyper UI has no light source — it is a flat gray-50 ground.

In `src/index.css`, change `html { background-color: var(--paper); }` to `var(--ground)`.

In `src/theme.css`, replace the whole `body` canvas rule (the `background-image: radial-gradient(...)` block and its comment) with:

```css
/* ── The canvas ──────────────────────────────────────────────────────
   Flat gray-50. The instrument system painted a fixed radial light
   source here to make paper read as a lit sheet; Hyper UI cards carry
   their own separation via border + shadow-sm, so a light source would
   just muddy them. */
body {
  background-color: var(--ground);
}
```

- [ ] **Step 2: Repoint the six page wrappers**

Each page root currently sets `background: var(--paper)`. They are pages, not cards, so they take `--ground`:

> **Correction (found during execution):** an earlier draft of this table listed
> `HomePage.tsx:369` / `.rv-catalog`. That rule sets only `color` and
> `font-family` — it has never had a `background`, and it correctly inherits
> `--ground` from `body`. `LegalPage.tsx:289` / `.rv-legal` DOES set a page
> background and belongs here instead. Step 3's grep sweep is what catches this
> class of error; run it even if the table looks complete.

| File:line | Selector |
|---|---|
| `src/App.tsx:840` | `.rv-report` |
| `src/BrowsePage.tsx:248` | `.rv-browse` |
| `src/AlertsPage.tsx:175` | `.rv-alerts` |
| `src/LegalPage.tsx:289` | `.rv-legal` |
| `src/LoginPage.tsx:406` | `.rv-login` |
| `src/ProductDetailPage.tsx:469` | `.rv-detail` |

In each, change `background: var(--paper)` → `background: var(--ground)`.

- [ ] **Step 3: Find any remaining page-level paper references**

Run: `grep -rn "var(--paper)" src/ --include=*.tsx --include=*.css`
Inspect each hit. A hit is correct if it paints a **card, control, or popover**; wrong if it paints a **page or section background**. Fix the wrong ones to `--ground`.

- [ ] **Step 4: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 5: Manual visual pass**

Run: `npm run dev`, then open each of `/`, `#/login`, `#/browse`, `#/alerts`, a product detail, and a legal page. Confirm: page ground is gray-50, cards are white, no warm cast anywhere, no radial gradient.

- [ ] **Step 6: Checkpoint — do NOT commit.**

---

### Task 4: Retire Bezel and the plotter grid

**Files:**
- Modify: `src/primitives.tsx` (remove `Bezel`, `.rv-bezel*` CSS), `src/HomePage.tsx:151,355`, `src/ProductDetailPage.tsx:177`, `src/theme.css` (remove `.rv-gridded`)

**Interfaces:**
- Consumes: `Panel` from `src/primitives.tsx` (existing signature unchanged in this task).
- Produces: `Panel` gains no new props; the `gridded` prop is **removed** from `Panel`'s type. **Task 8** rebuilds `Panel`'s internals (not Task 7 — that is Button/ButtonGroup).

> **Known interim state this task creates.** Once `Bezel` retires, the hero proof
> region at `HomePage.tsx` is wrapped in a `Panel` that currently draws *nothing*:
> `.rv-panel` only sets `--panel-bg`, a custom property with no consumer, and with
> no `label` passed it renders no rule line either. So between this task and Task 8
> the hero proof panel has no visual boundary at all. That is expected and is fixed
> by Task 8, which turns `.rv-panel` into `rounded-lg border border-gray-100 bg-white p-6`.

`Bezel` has exactly one call site, so this is cheap.

- [ ] **Step 1: Replace the single Bezel call site**

`src/HomePage.tsx:151` reads `<Bezel gridded>`. Replace with `<Panel>` and drop `gridded`. Remove the `Bezel` import. **It lives at `src/HomePage.tsx:19`, not in `App.tsx`** — an earlier draft of this step named `App.tsx:41`, which never imported `Bezel` at all. Trust the grep, not the line reference: `grep -rn "Bezel" src/`.

- [ ] **Step 2: Delete the `Bezel` component**

Remove the `Bezel` function from `src/primitives.tsx` (the block beginning `// ── Bezel — a nested enclosure`) and the `.rv-bezel`, `.rv-bezel-core`, `.rv-bezel-interactive`, `.rv-bezel-interactive:hover` rules from `PRIMITIVE_STYLES`.

- [ ] **Step 3: Remove the `gridded` prop from `Panel`**

Delete `gridded` from `Panel`'s props type and destructuring, and drop `${gridded ? " rv-gridded" : ""}` from its body className. Update the two callers passing it: `src/ProductDetailPage.tsx:177` (remove the `gridded` line) and any other hit from `grep -rn "gridded" src/`.

- [ ] **Step 3b: Remove the film grain, and clean every orphaned token reference**

Task 2 deleted seven tokens; their consumers were deferred to this task. Three
files still reference them, not just `primitives.tsx`:

| Orphaned token | Files still referencing it |
|---|---|
| `--bezel-pad`, `--bezel-outer`, `--bezel-inner`, `--shadow-lip` | `src/primitives.tsx`, `src/OnboardingFlow.tsx`, `src/ProductFan.tsx` |
| `--grid`, `--grid-size` | `src/theme.css` (the `.rv-gridded` rule, removed in Step 4) |
| `--z-grain` | `src/theme.css:360` |

**The film grain must go.** `body::after` paints a fixed, full-viewport
`feTurbulence` noise layer at `opacity: .032` — an instrument-era texture from
the same family as the plotter grid, and it is already broken: its
`z-index: var(--z-grain)` resolves to nothing now that the token is deleted, so
a full-screen fixed layer sits at an unpredictable stacking position. Delete the
entire `body::after` rule.

For `OnboardingFlow.tsx` and `ProductFan.tsx`, the orphaned `--shadow-lip` /
`--bezel-*` references are on **content** surfaces (an onboarding card, product
cards). Under the glass scope rule — glass on chrome, flat content — these lose
their lip and bezel radii and become flat cards: drop the orphaned
`box-shadow: var(--shadow-lip), …` and `border-radius: var(--bezel-*)`
declarations, substituting `var(--r-card)` where a radius is still needed. Do
**not** give them glass.

- [ ] **Step 4: Remove the grid substrate**

Delete the `.rv-gridded` rule from `src/theme.css` (the `background-image` double-linear-gradient block and its comment). Remove the `rv-gridded` class from `src/HomePage.tsx:355` (`<div className="rv-proof-chart rv-gridded">` → `<div className="rv-proof-chart">`).

- [ ] **Step 5: Assert nothing references the removed names**

Run:
```bash
grep -rn "Bezel\|rv-bezel\|rv-gridded\|gridded\|--grid\b\|--bezel\|--shadow-lip\|--z-grain" src/
```
Expected: no output. Any hit is an orphan — remove it.

- [ ] **Step 6: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0. The token test's "dead tokens are gone" block now has no orphan consumers.

- [ ] **Step 7: Checkpoint — do NOT commit.**

---

# Phase 2 — Rebuild the primitive vocabulary

### Task 5: Icon set

**Files:**
- Create: `src/icons.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `CheckCircle`, `ReceiptRefund`, `ExclamationTriangle`, `ChevronDown`, `ChevronRight`, `Home`, `Heart`, `TrendUp`, `TrendDown`, `Cog`, `ChatBubble` — each assignable to `ComponentType<{ className?: string }>`. Every later task imports from here.

> **Do not write `JSX.Element` anywhere in this plan.** `@types/react` 19 removed
> the global `JSX` namespace; `tsc -b` fails with `TS2503: Cannot find namespace
> 'JSX'`. Verified against this project's `tsconfig.app.json`. Use
> `ComponentType<{ className?: string }>` from `react` instead — it is what these
> values actually are. (`React.ReactNode` and `React.KeyboardEvent` are fine: the
> UMD global `React` namespace still exists.)

- [ ] **Step 1: Write the failing test**

Create `src/icons.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CheckCircle, ChevronDown, Home, Heart, TrendUp, TrendDown } from "./icons";

describe("icons", () => {
  it("are hidden from assistive tech", () => {
    const { container } = render(<CheckCircle />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("accept a className so size is a call-site decision", () => {
    const { container } = render(<ChevronDown className="size-5 shrink-0" />);
    expect(container.querySelector("svg")).toHaveClass("size-5", "shrink-0");
  });

  it("use the reference set's 1.5 stroke weight", () => {
    const { container } = render(<Home />);
    expect(container.querySelector("svg")).toHaveAttribute("stroke-width", "1.5");
  });

  it("render every exported icon without throwing", () => {
    for (const Icon of [CheckCircle, ChevronDown, Home, Heart, TrendUp, TrendDown]) {
      const { container } = render(<Icon />);
      expect(container.querySelector("svg")).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- icons`
Expected: FAIL — `Failed to resolve import "./icons"`.

- [ ] **Step 3: Implement `src/icons.tsx`**

Heroicons 24 outline, `stroke-width="1.5"`, always `aria-hidden`. Size is always a call-site `className`, never baked in.

```tsx
// Heroicons 24-outline, the reference set's icon language. stroke-width is
// 1.5 everywhere; size is always the call site's decision via className.
type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      {children}
    </svg>
  );
}

const cap = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const CheckCircle = (p: IconProps) => (
  <Svg {...p}><path {...cap} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></Svg>
);

export const ReceiptRefund = (p: IconProps) => (
  <Svg {...p}><path {...cap} d="M8.25 9.75h4.875a2.625 2.625 0 010 5.25H12M8.25 9.75L10.5 7.5M8.25 9.75L10.5 12m9-7.243V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" /></Svg>
);

export const ExclamationTriangle = (p: IconProps) => (
  <Svg {...p}><path {...cap} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></Svg>
);

export const ChevronDown = (p: IconProps) => (
  <Svg {...p}><path {...cap} d="m19.5 8.25-7.5 7.5-7.5-7.5" /></Svg>
);

export const Home = (p: IconProps) => (
  <Svg {...p}><path {...cap} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></Svg>
);

export const Heart = (p: IconProps) => (
  <Svg {...p}><path {...cap} d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></Svg>
);

export const TrendUp = (p: IconProps) => (
  <Svg {...p}><path {...cap} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></Svg>
);

export const TrendDown = (p: IconProps) => (
  <Svg {...p}><path {...cap} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></Svg>
);

export const Cog = (p: IconProps) => (
  <Svg {...p}>
    <path {...cap} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
    <path {...cap} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </Svg>
);

export const ChatBubble = (p: IconProps) => (
  <Svg {...p}><path {...cap} d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></Svg>
);

/** Solid chevron for breadcrumb separators — a 20-viewBox solid glyph reads
 *  lighter beside 24-outline links, which is why the reference set mixes them. */
export const ChevronRight = ({ className }: IconProps) => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className={className}
       viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd"
      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
  </svg>
);
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- icons`
Expected: PASS, 4 tests.

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 6: Checkpoint — do NOT commit.**

---

### Task 6: Badge replaces Stamp

**Files:**
- Create: `src/Badge.tsx`, `src/Badge.test.tsx`
- Modify: `src/primitives.tsx` (remove `Stamp` + `.rv-stamp*`), and the 12 call sites in `src/App.tsx`, `src/AlertsPage.tsx`, `src/BrowsePage.tsx`, `src/HomePage.tsx`, `src/ProductDetailPage.tsx`

**Interfaces:**
- Consumes: `CheckCircle`, `ReceiptRefund`, `ExclamationTriangle` from Task 5.
- Produces: `Badge({ tone, variant, children }: { tone?: "signal" | "caution" | "quiet" | "danger"; variant?: "solid" | "outline"; children: ReactNode })`. `tone` keeps `Stamp`'s existing three names so the 12 call sites port mechanically; `danger` is new.

- [ ] **Step 1: Write the failing test**

Create `src/Badge.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders its label", () => {
    render(<Badge>Lowest</Badge>);
    expect(screen.getByText("Lowest")).toBeInTheDocument();
  });

  it("defaults to the solid signal tone", () => {
    const { container } = render(<Badge>Lowest</Badge>);
    const el = container.firstElementChild!;
    expect(el).toHaveClass("rv-badge", "rv-badge-signal", "rv-badge-solid");
  });

  it("supports the outline variant", () => {
    const { container } = render(<Badge variant="outline">Lowest</Badge>);
    expect(container.firstElementChild).toHaveClass("rv-badge-outline");
  });

  it("carries a decorative, aria-hidden icon for each semantic tone", () => {
    for (const tone of ["signal", "caution", "danger"] as const) {
      const { container } = render(<Badge tone={tone}>x</Badge>);
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("omits the icon for the quiet tone, which carries no status", () => {
    const { container } = render(<Badge tone="quiet">14d</Badge>);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("never conveys meaning by colour alone — the label is always text", () => {
    render(<Badge tone="danger">Failed</Badge>);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- Badge`
Expected: FAIL — `Failed to resolve import "./Badge"`.

- [ ] **Step 3: Implement `src/Badge.tsx`**

```tsx
import type { ComponentType, ReactNode } from "react";
import { CheckCircle, ExclamationTriangle, ReceiptRefund } from "./icons";

export type BadgeTone = "signal" | "caution" | "quiet" | "danger";

// Tone names are inherited from the retired Stamp so its 12 call sites port
// without rewording. `quiet` is a neutral chip (a countdown, a coverage gap)
// and deliberately carries no icon — an icon would imply a status it lacks.
const ICONS: Record<BadgeTone, ComponentType<{ className?: string }> | null> = {
  signal: CheckCircle,
  caution: ReceiptRefund,
  danger: ExclamationTriangle,
  quiet: null,
};

export function Badge({
  tone = "signal",
  variant = "solid",
  children,
}: {
  tone?: BadgeTone;
  variant?: "solid" | "outline";
  children: ReactNode;
}) {
  const Icon = ICONS[tone];
  return (
    <span className={`rv-badge rv-badge-${tone} rv-badge-${variant}`}>
      {Icon && <Icon className="rv-badge-icon" />}
      <span className="rv-badge-label">{children}</span>
    </span>
  );
}

export const BADGE_STYLES = `
  /* Pill, icon + label. Solid is a tinted fill; outline is a 1px border on
     white. Both keep the same deep text colour, which is what makes them
     read as one family. */
  .rv-badge {
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: var(--r-pill);
    padding: 2px 10px;
    font-size: 14px; line-height: 20px;
    white-space: nowrap;
  }
  .rv-badge-icon { width: 16px; height: 16px; margin-left: -4px; margin-right: 6px; flex: none; }
  .rv-badge-label { white-space: nowrap; }

  .rv-badge-signal  { color: var(--green-deep); }
  .rv-badge-caution { color: var(--amber-deep); }
  .rv-badge-danger  { color: var(--red-deep); }
  .rv-badge-quiet   { color: var(--ink-muted); }

  .rv-badge-solid.rv-badge-signal  { background: var(--green-tint); }
  .rv-badge-solid.rv-badge-caution { background: var(--amber-tint); }
  .rv-badge-solid.rv-badge-danger  { background: var(--red-tint); }
  .rv-badge-solid.rv-badge-quiet   { background: var(--paper-deep); }

  .rv-badge-outline { background: var(--paper); border: 1px solid; }
  .rv-badge-outline.rv-badge-signal  { border-color: var(--green-line); }
  .rv-badge-outline.rv-badge-caution { border-color: var(--amber); }
  .rv-badge-outline.rv-badge-danger  { border-color: var(--red); }
  .rv-badge-outline.rv-badge-quiet   { border-color: var(--rule-strong); }
`;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- Badge`
Expected: PASS, 6 tests.

- [ ] **Step 5: Port the 12 call sites**

Replace `Stamp` with `Badge` at each. The `tone` values carry over unchanged:

- `src/AlertsPage.tsx:169` — `<Stamp tone={tone}>` → `<Badge tone={tone}>`
- `src/App.tsx:696,700,704` — score-band legend (`signal` / `quiet` / `caution`)
- `src/App.tsx:766,768` — coverage countdown (`quiet`), lowest-ever (`signal`)
- `src/BrowsePage.tsx:239,241` — same pair
- `src/HomePage.tsx:325,327` — lowest-ever (`signal`), coverage (`quiet`)
- `src/ProductDetailPage.tsx:98,100,111,455` — lowest-ever, coverage caution, demo-product caution, verdict

Update each file's import from `./primitives` to add `import { Badge } from "./Badge";` and drop `Stamp`.

- [ ] **Step 6: Wire the styles in**

Add `BADGE_STYLES` to the concatenated `<style>` block in `src/App.tsx:363` alongside `PRIMITIVE_STYLES`, and to any page that renders standalone (`AlertsPage`, `BrowsePage`, `HomePage`, `ProductDetailPage` each build their own style string — follow the local pattern in each).

- [ ] **Step 7: Remove `Stamp`**

Delete the `Stamp` function from `src/primitives.tsx` and the `.rv-stamp`, `.rv-stamp-signal`, `.rv-stamp-caution`, `.rv-stamp-quiet` rules from `PRIMITIVE_STYLES`.

- [ ] **Step 8: Assert nothing still references Stamp**

Run: `grep -rn "Stamp\|rv-stamp" src/`
Expected: no output.

- [ ] **Step 9: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 10: Checkpoint — do NOT commit.**

---

### Task 7: Button and ButtonGroup

**Files:**
- Create: `src/primitives.test.tsx`
- Modify: `src/primitives.tsx` (`Button` styles, add `ButtonGroup`), `src/chartUI.tsx:167`, `src/ProductDetailPage.tsx:525`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ButtonGroup({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void })`. `Button`'s existing signature is unchanged — only its CSS repoints.

- [ ] **Step 1: Write the failing test**

Create `src/primitives.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, ButtonGroup } from "./primitives";

describe("Button", () => {
  it("renders a button by default and calls onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Track</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders an anchor when as='a'", () => {
    render(<Button as="a" href="/x">Go</Button>);
    expect(screen.getByRole("link", { name: "Go" })).toHaveAttribute("href", "/x");
  });

  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabled>Track</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("ButtonGroup", () => {
  const options = [
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
    { value: "90d", label: "90D" },
  ];

  it("renders one button per option", () => {
    render(<ButtonGroup options={options} value="7d" onChange={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("marks the active option with aria-pressed", () => {
    render(<ButtonGroup options={options} value="30d" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "30D" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "7D" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the chosen value", async () => {
    const onChange = vi.fn();
    render(<ButtonGroup options={options} value="7d" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "90D" }));
    expect(onChange).toHaveBeenCalledWith("90d");
  });

  it("rounds only the end segments", () => {
    const { container } = render(<ButtonGroup options={options} value="7d" onChange={() => {}} />);
    const btns = container.querySelectorAll("button");
    expect(btns[0]).toHaveClass("rv-bgroup-first");
    expect(btns[1]).not.toHaveClass("rv-bgroup-first");
    expect(btns[1]).not.toHaveClass("rv-bgroup-last");
    expect(btns[2]).toHaveClass("rv-bgroup-last");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- primitives`
Expected: FAIL — `ButtonGroup` is not exported.

- [ ] **Step 3: Add `ButtonGroup` to `src/primitives.tsx`**

```tsx
// ── ButtonGroup — a segmented control. Extracted because .rv-seg-btn
// (chartUI) and .rv-window-btn (ProductDetailPage) hand-rolled the same
// thing twice. Segments overlap by 1px so the shared border is one line,
// and focus lifts a segment with z-index so its ring is not clipped by
// the neighbour that overlaps it.
export function ButtonGroup({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={`rv-bgroup${className ? ` ${className}` : ""}`}>
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={
            "rv-bgroup-btn" +
            (i === 0 ? " rv-bgroup-first" : "") +
            (i === options.length - 1 ? " rv-bgroup-last" : "") +
            (o.value === value ? " rv-bgroup-on" : "")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Repoint `Button`'s CSS and add the group's**

In `PRIMITIVE_STYLES`, replace the `.rv-btn-primary` / `.rv-btn-ghost` colour rules and append the group:

```css
  /* Buttons are chrome — you act on them — so they wear glass. The pill
     radius they already carry is what makes the treatment read as a glass
     capsule rather than a translucent rectangle.

     Primary is TINTED glass, not clear: it stays a dark, dominant CTA, but
     the backdrop blur and the specular lip give it the same material as the
     nav island it sits under. A fully opaque primary beside glass secondary
     buttons reads as two different systems. */
  .rv-btn-primary {
    background: rgba(17,24,39,.88);
    color: #fff;
    border: 1px solid transparent;
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.14), var(--shadow-md);
    isolation: isolate;
  }
  .rv-btn-primary:hover:not(:disabled) { background: rgba(0,0,0,.94); }

  /* Ghost is CLEAR glass — the standard capsule. */
  .rv-btn-ghost {
    background: var(--glass-fill);
    color: var(--ink);
    border: 1px solid transparent;
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    box-shadow: var(--glass-lip), var(--glass-edge), var(--shadow-sm);
    isolation: isolate;
  }
  .rv-btn-ghost:hover:not(:disabled) { background: var(--glass-fill-strong); }

  /* Where the browser cannot blur, both variants go near-opaque rather than
     thin-and-unreadable. */
  @supports not (backdrop-filter: blur(1px)) {
    .rv-btn-primary { background: var(--primary); }
    .rv-btn-ghost   { background: var(--glass-fill-strong); }
  }

  /* Focus is the reference set's offset ring, on every control. */
  .rv-btn:focus-visible, .rv-bgroup-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--blue-bright);
  }

  .rv-bgroup { display: inline-flex; }
  .rv-bgroup-btn {
    border: 1px solid var(--rule);
    background: var(--paper);
    padding: 8px 12px;
    font-family: var(--font-sans); font-weight: 500; font-size: 14px;
    color: var(--ink-soft);
    cursor: pointer;
    transition: background-color var(--dur-fast) var(--ease-out-soft),
                color var(--dur-fast) var(--ease-out-soft);
  }
  .rv-bgroup-btn + .rv-bgroup-btn { margin-left: -1px; }
  .rv-bgroup-btn:hover { background: var(--paper-soft); color: var(--ink); }
  .rv-bgroup-btn:focus-visible { position: relative; z-index: 10; }
  .rv-bgroup-first { border-top-left-radius: var(--r-sm); border-bottom-left-radius: var(--r-sm); }
  .rv-bgroup-last  { border-top-right-radius: var(--r-sm); border-bottom-right-radius: var(--r-sm); }
  .rv-bgroup-on    { background: var(--paper-deep); color: var(--ink); }
  .rv-bgroup-btn:disabled { opacity: .5; }
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npm test -- primitives`
Expected: PASS, 7 tests.

- [ ] **Step 6: Replace the two hand-rolled segmented controls**

`src/chartUI.tsx` renders range buttons with `.rv-seg-btn`; `src/ProductDetailPage.tsx:525` renders window buttons with `.rv-window-btn`. Replace each markup block with `<ButtonGroup options={…} value={…} onChange={…} />` and delete the `.rv-seg-btn` / `.rv-window-btn` rules from their style strings.

- [ ] **Step 7: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 8: Manual check** — `npm run dev`, open a product detail page, click through the chart ranges. Confirm the active segment is filled, the shared borders are single-width, and keyboard focus shows a visible ring not clipped by the neighbour.

- [ ] **Step 9: Checkpoint — do NOT commit.**

---

### Task 8: Panel becomes a card

**Files:**
- Modify: `src/primitives.tsx` (`Panel` + `.rv-panel*`), `src/primitives.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Panel`'s signature is unchanged minus `gridded` (removed in Task 4). All 16 call sites keep working.

- [ ] **Step 1: Add the failing test to `src/primitives.test.tsx`**

```tsx
import { Panel } from "./primitives";

describe("Panel", () => {
  it("renders its children", () => {
    render(<Panel>body</Panel>);
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("renders a label and an aside in the header", () => {
    render(<Panel label="Alerts" aside="3 total">body</Panel>);
    expect(screen.getByText("Alerts")).toBeInTheDocument();
    expect(screen.getByText("3 total")).toBeInTheDocument();
  });

  it("omits the header entirely when neither is given", () => {
    const { container } = render(<Panel>body</Panel>);
    expect(container.querySelector(".rv-panel-rule")).toBeNull();
  });

  it("is a section element so the page keeps its landmark structure", () => {
    const { container } = render(<Panel label="Alerts">body</Panel>);
    expect(container.firstElementChild?.tagName).toBe("SECTION");
  });
});
```

- [ ] **Step 2: Run it to verify the new cases fail**

Run: `npm test -- primitives`
Expected: the first three may pass already; the point of this task is the CSS. Confirm all four pass structurally before restyling, then restyle.

- [ ] **Step 3: Repoint `.rv-panel*` from hairline region to card**

The instrument `Panel` was a label sitting *in* a top hairline rule. The reference set's card is a bordered white box with the label inside it.

```css
  /* Card. The instrument Panel hung its label in a top hairline rule; the
     reference set puts a bordered white box around the whole thing. */
  .rv-panel {
    background: var(--paper);
    border: 1px solid var(--rule-faint);
    border-radius: var(--r-card);
    padding: 24px;
  }
  .rv-panel-rule {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 16px; margin-bottom: 16px;
  }
  .rv-panel-label {
    font-family: var(--font-sans); font-size: 14px; font-weight: 500;
    color: var(--ink-fade); letter-spacing: 0;
    text-transform: none;
  }
  .rv-panel-aside {
    font-family: var(--font-mono); font-size: 14px; color: var(--ink-fade);
  }
  .rv-panel-body { padding-top: 0; }
```

Note the label drops `text-transform: uppercase` and the mono micro-caps treatment — the reference set uses sentence-case gray-500 at `text-sm`.

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: both exit 0.

- [ ] **Step 5: Visual pass over all 16 call sites**

`npm run dev`, then check each: `AlertsPage` (3), `App` dashboard (6), `BrowsePage` (4), `HomePage` (3), `ProductDetailPage` (4). Watch for nested panels — a card inside a card needs the inner one to drop its border. Fix any by passing `className` and adding a `.rv-panel-flush` modifier.

- [ ] **Step 6: Checkpoint — do NOT commit.**

---

### Task 9: Spinner

**Files:**
- Create: `src/Spinner.test.tsx`
- Modify: `src/Spinner.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `Spinner({ size, className }: { size?: number; className?: string })` — signature unchanged, so its existing call sites need no edits.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("announces itself as a status region", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has an accessible name", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toHaveAccessibleName("Loading");
  });

  it("renders an svg rather than a bordered div", () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("honours the size prop", () => {
    const { container } = render(<Spinner size={32} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "32");
    expect(svg).toHaveAttribute("height", "32");
  });

  it("does not import framer-motion", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./Spinner.tsx", import.meta.url), "utf8"),
    );
    expect(src).not.toContain("framer-motion");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- Spinner`
Expected: FAIL — currently renders a `motion.span`, not an `svg`, and does import framer-motion.

- [ ] **Step 3: Rewrite `src/Spinner.tsx`**

```tsx
// The reference set's loading spinner: a CSS-animated SVG, no animation
// library. Colour is indigo-600 by default and overridable via className;
// reduced motion is handled in CSS, not JS, so there is no hook to stub.
export function Spinner({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      role="status"
      aria-label="Loading"
      className={`rv-spinner${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle className="rv-spinner-track" cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4" />
      <path className="rv-spinner-head" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export const SPINNER_STYLES = `
  .rv-spinner {
    color: var(--indigo);
    vertical-align: middle; flex: none;
    animation: rv-spin .7s linear infinite;
  }
  .rv-spinner-track { opacity: .25; }
  .rv-spinner-head  { opacity: .75; }
  @keyframes rv-spin { to { transform: rotate(360deg); } }

  /* Reduced motion: the spinner stops rather than disappearing — a frozen
     ring still reads as "busy", an absent one reads as "done". */
  @media (prefers-reduced-motion: reduce) {
    .rv-spinner { animation: none; }
  }
`;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- Spinner`
Expected: PASS, 5 tests.

- [ ] **Step 5: Wire `SPINNER_STYLES` into the style strings**

Add to the concatenated `<style>` in `src/App.tsx:363` and each standalone page's style string, following the local pattern.

- [ ] **Step 6: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 7: Checkpoint — do NOT commit.**

---

### Task 10: Floating-label input

**Files:**
- Modify: `src/primitives.tsx` (`.rv-input` styles + new `Field` component), `src/primitives.test.tsx`, and the 6 call sites

**Interfaces:**
- Consumes: nothing new.
- Produces: `Field({ id, label, children }: { id: string; label: string; children: ReactNode })` — wraps an input in the floating-label `<label>`. The input itself keeps `className="rv-input"` and **must** carry `placeholder=""`.

- [ ] **Step 1: Add the failing test to `src/primitives.test.tsx`**

```tsx
import { Field } from "./primitives";

describe("Field", () => {
  it("associates the label with the input", () => {
    render(
      <Field id="Email" label="Email">
        <input id="Email" className="rv-input" placeholder="" />
      </Field>,
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("marks the input as a peer so the label can float", () => {
    const { container } = render(
      <Field id="Email" label="Email">
        <input id="Email" className="rv-input" placeholder="" />
      </Field>,
    );
    expect(container.querySelector("input")).toHaveClass("rv-input");
    expect(container.querySelector(".rv-field-label")).toBeTruthy();
  });

  it("requires an empty placeholder — the float keys off :placeholder-shown", () => {
    const { container } = render(
      <Field id="Email" label="Email">
        <input id="Email" className="rv-input" placeholder="" />
      </Field>,
    );
    expect(container.querySelector("input")).toHaveAttribute("placeholder", "");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- primitives`
Expected: FAIL — `Field` is not exported.

- [ ] **Step 3: Implement `Field` and its CSS**

```tsx
// ── Field — the reference set's floating label. The label starts sitting
// on the border and drops into the input when it is empty and unfocused.
//
// The child input MUST carry placeholder="" (present and empty). That is
// what :placeholder-shown keys off; without it the label never drops, and
// with a real placeholder the label never returns.
export function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="rv-field">
      {children}
      <span className="rv-field-label">{label}</span>
    </label>
  );
}
```

```css
  .rv-field { position: relative; display: block; }
  .rv-field-label {
    position: absolute; inset-block: 0; left: 12px;
    display: flex; align-items: center;
    transform: translateY(-20px);
    background: var(--paper); padding: 0 2px;
    font-family: var(--font-sans); font-size: 14px; font-weight: 500;
    color: var(--ink-soft);
    transition: transform var(--dur-fast) var(--ease-out-soft);
    pointer-events: none;
  }
  .rv-field .rv-input:placeholder-shown ~ .rv-field-label { transform: translateY(0); }
  .rv-field .rv-input:focus ~ .rv-field-label { transform: translateY(-20px); }

  .rv-input, .rv-filter-input {
    width: 100%;
    background: var(--paper);
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-sm);
    padding: 10px 12px;
    font-family: var(--font-sans); font-size: 14px;
    color: var(--ink);
  }
  .rv-input:focus, .rv-filter-input:focus {
    outline: none;
    border-color: var(--blue-bright);
    box-shadow: 0 0 0 1px var(--blue-bright);
  }
  .rv-input::placeholder { color: transparent; }
```

`::placeholder` is transparent because the placeholder exists only to drive the float, never to be read.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- primitives`
Expected: PASS.

- [ ] **Step 5: Port the 6 input call sites**

Wrap each in `<Field>` and add `placeholder=""`:

| File:line | Field label |
|---|---|
| `src/App.tsx:526` | "Product URL" |
| `src/HomePage.tsx:139` | "Paste a product link" |
| `src/LoginPage.tsx:196` | "Email" |
| `src/LoginPage.tsx:210` | "Password" |
| `src/ProductDetailPage.tsx:363` | "Target price" |
| `src/ProductDetailPage.tsx:379` | "Email" |

Remove any now-redundant visible `<label>` above each input, and any existing `placeholder="…"` text (it would break the float).

- [ ] **Step 6: Assert no input carries a non-empty placeholder**

Run: `grep -rn 'className="rv-input' -A2 src/ | grep 'placeholder="[^"]'`
Expected: no output.

- [ ] **Step 7: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 8: Manual check** — `npm run dev`, open `#/login`. Confirm the label sits inside the empty field, rises into the border on focus, and stays risen once text is typed.

- [ ] **Step 9: Checkpoint — do NOT commit.**

---

### Task 11: StatCard

**Files:**
- Create: `src/StatCard.tsx`, `src/StatCard.test.tsx`
- Modify: `src/App.tsx` (dashboard header)

**Interfaces:**
- Consumes: `TrendUp`, `TrendDown` from Task 5.
- Produces: `StatCard({ label, value, icon, trend }: { label: string; value: string; icon: ReactNode; trend?: { direction: "up" | "down"; pct: string; note: string } })`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "./StatCard";
import { Heart } from "./icons";

describe("StatCard", () => {
  it("renders label and figure", () => {
    render(<StatCard label="Tracked" value="12" icon={<Heart />} />);
    expect(screen.getByText("Tracked")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("omits the trend row when no trend is given", () => {
    const { container } = render(<StatCard label="Tracked" value="12" icon={<Heart />} />);
    expect(container.querySelector(".rv-stat-trend")).toBeNull();
  });

  it("names the direction for screen readers, not by colour alone", () => {
    render(
      <StatCard label="Saved" value="$240.94" icon={<Heart />}
                trend={{ direction: "up", pct: "67.81%", note: "Since last week" }} />,
    );
    expect(screen.getByText("Increase:")).toBeInTheDocument();
  });

  it("uses the decrease wording for a downward trend", () => {
    render(
      <StatCard label="Saved" value="$1" icon={<Heart />}
                trend={{ direction: "down", pct: "3%", note: "Since last week" }} />,
    );
    expect(screen.getByText("Decrease:")).toBeInTheDocument();
  });

  it("puts the figure in the tabular figure face", () => {
    const { container } = render(<StatCard label="Saved" value="$240.94" icon={<Heart />} />);
    expect(container.querySelector(".rv-stat-value")).toHaveClass("rv-num");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- StatCard`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/StatCard.tsx`**

```tsx
import type { ReactNode } from "react";
import { TrendDown, TrendUp } from "./icons";

export function StatCard({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  trend?: { direction: "up" | "down"; pct: string; note: string };
}) {
  const Arrow = trend?.direction === "down" ? TrendDown : TrendUp;
  return (
    <article className="rv-stat">
      <div className="rv-stat-head">
        <div>
          <p className="rv-stat-label">{label}</p>
          {/* rv-num keeps the figure tabular — Urbanist is proportional. */}
          <p className="rv-stat-value rv-num">{value}</p>
        </div>
        <span className="rv-stat-well">{icon}</span>
      </div>

      {trend && (
        <div className={`rv-stat-trend rv-stat-trend-${trend.direction}`}>
          <Arrow className="rv-stat-arrow" />
          {/* Direction must not be carried by colour alone. */}
          <span className="rv-sr">{trend.direction === "up" ? "Increase:" : "Decrease:"}</span>
          <p className="rv-stat-trend-copy">
            <span className="rv-stat-pct rv-num">{trend.pct}</span>
            <span className="rv-stat-note">{trend.note}</span>
          </p>
        </div>
      )}
    </article>
  );
}

export const STAT_CARD_STYLES = `
  .rv-stat {
    background: var(--paper);
    border: 1px solid var(--rule-faint);
    border-radius: var(--r-card);
    padding: 24px;
  }
  .rv-stat-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .rv-stat-label { margin: 0; font-size: 14px; color: var(--ink-fade); }
  .rv-stat-value { margin: 4px 0 0; font-size: 24px; font-weight: 500; color: var(--ink); }
  .rv-stat-well {
    border-radius: var(--r-pill); background: var(--blue-tint); color: var(--blue);
    padding: 12px; display: inline-flex; flex: none;
  }
  .rv-stat-well svg { width: 32px; height: 32px; }

  .rv-stat-trend { margin-top: 4px; display: flex; gap: 4px; align-items: center; }
  .rv-stat-arrow { width: 16px; height: 16px; flex: none; }
  /* green-700 / red-700, NOT the reference set's green-600: at 12px that
     measures 3.30:1 on white and fails the 4.5:1 floor for small text. */
  .rv-stat-trend-up   { color: #15803d; }
  .rv-stat-trend-down { color: #b91c1c; }
  .rv-stat-trend-copy { margin: 0; display: flex; gap: 8px; font-size: 12px; }
  .rv-stat-pct  { font-weight: 500; }
  .rv-stat-note { color: var(--ink-fade); }

`;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- StatCard`
Expected: PASS, 5 tests.

- [ ] **Step 5: Place four stat cards in the dashboard header**

In `src/App.tsx`'s `Dashboard`, above the existing panels, add a responsive grid of four: **Tracked** (`watches.length`), **Active alerts** (count of watches with a target), **Lowest right now** (count where `is_lowest_ever`), **Best drop** (largest delta, formatted with `formatMoney`). Use existing derived data — do not add API calls.

```css
  .rv-stat-grid {
    display: grid; gap: 16px; margin-bottom: 24px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
```

- [ ] **Step 6: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 7: Checkpoint — do NOT commit.**

---

### Task 12: ProductCard

**Files:**
- Create: `src/ProductCard.tsx`, `src/ProductCard.test.tsx`
- Modify: `src/BrowsePage.tsx` (grid), `src/ProductFan.tsx` (card shape only)

**Interfaces:**
- Consumes: `Heart` from Task 5, `Badge` from Task 6, `ProductImage` from `src/ProductImage.tsx`, `productImage` from `src/images.ts`, `formatMoney` from `src/format.ts`.

> **Two signatures the executor will otherwise get wrong:**
>
> - `ProductImage` takes `{ image: ImageAsset; ratio?: string; className?: string; ... }`, **not** `{ product }`.
> - `productImage` takes `(src: string | null | undefined, alt: string)`, **not** a product.
>
> Together: `productImage(product.image_url, product.title ?? product.domain)`.
> That is exactly how `App.tsx:645` and `BrowsePage.tsx:213` already call it.
>
> **And the `Product` type has no `current_price` or `previous_price`.** The
> real fields (`src/api.ts:203`) are `latest_price: number | null`,
> `median_90d: number | null`, `min_ever: number | null`, `is_lowest_ever:
> boolean`, `title: string | null`, and `id: string` — an id **string**, not a
> number. `formatMoney(value: number, currency = "USD")` takes a non-null
> number, so every price needs a null guard before it.
>
> **`formatMoney` drops the decimals on whole numbers** —
> `maximumFractionDigits: Number.isInteger(value) ? 0 : 2` (`src/format.ts:1`).
> So `formatMoney(80)` is `"$80"` and `formatMoney(49.99)` is `"$49.99"`. Write
> test expectations against that, not against a fixed two-decimal format.
- Produces: `ProductCard({ product, href, tracked, onToggleTrack, onSetAlert }: { product: Product; href: string; tracked: boolean; onToggleTrack: () => void; onSetAlert: () => void })`.

**The reference card nests `<button>` inside `<a>` — twice. That is invalid HTML and the buttons swallow the link.** This task rebuilds it with a stretched-link overlay. The test enforces that.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductCard } from "./ProductCard";
import type { Product } from "./api";

// A real Product. Note there is no `current_price` or `previous_price` on
// this type: the live figure is `latest_price`, and the was-price analogue
// is `median_90d` (the typical 90-day price).
const product: Product = {
  id: "p1",
  url: "https://example.com/headphones",
  domain: "example.com",
  title: "Wireless Headphones",
  image_url: null,
  currency: "USD",
  category: "audio",
  status: "ok",
  latest_price: 49.99,
  latest_price_at: "2026-04-24T00:00:00Z",
  median_90d: 80,
  min_ever: 49.99,
  is_lowest_ever: true,
  deal_score: 88,
  stats: null,
  last_checked_at: null,
  created_at: "2026-02-12T00:00:00Z",
};

function setup(over: Partial<Parameters<typeof ProductCard>[0]> = {}) {
  const onToggleTrack = vi.fn();
  const onSetAlert = vi.fn();
  render(
    <ProductCard product={product} href="#/p/1" tracked={false}
                 onToggleTrack={onToggleTrack} onSetAlert={onSetAlert} {...over} />,
  );
  return { onToggleTrack, onSetAlert };
}

describe("ProductCard", () => {
  it("never nests a button inside an anchor", () => {
    const { container } = render(
      <ProductCard product={product} href="#/p/1" tracked={false}
                   onToggleTrack={() => {}} onSetAlert={() => {}} />,
    );
    expect(container.querySelector("a button")).toBeNull();
  });

  it("exposes exactly one link to the product", () => {
    setup();
    expect(screen.getByRole("link", { name: /Wireless Headphones/i })).toBeInTheDocument();
  });

  it("shows the latest price and strikes through the 90-day median", () => {
    setup();
    expect(screen.getByText("$49.99")).toBeInTheDocument();
    // formatMoney gives INTEGERS zero fraction digits, so 80 formats as
    // "$80", not "$80.00". Verified against src/format.ts:1.
    const was = screen.getByText("$80");
    expect(was.tagName).toBe("S");
  });

  it("omits the was-price when there is no median", () => {
    render(
      <ProductCard product={{ ...product, median_90d: null }} href="#/p/1"
                   tracked={false} onToggleTrack={() => {}} onSetAlert={() => {}} />,
    );
    expect(screen.queryByText("$80")).toBeNull();
  });

  it("omits the was-price when the median is not above the latest price", () => {
    // Striking through a number LOWER than what you pay would read as a
    // discount that does not exist.
    render(
      <ProductCard product={{ ...product, median_90d: 40 }} href="#/p/1"
                   tracked={false} onToggleTrack={() => {}} onSetAlert={() => {}} />,
    );
    expect(screen.queryByText("$40")).toBeNull();
  });

  it("renders a dash when the price is unknown rather than $NaN", () => {
    render(
      <ProductCard product={{ ...product, latest_price: null }} href="#/p/1"
                   tracked={false} onToggleTrack={() => {}} onSetAlert={() => {}} />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("falls back to the domain when a product has no title", () => {
    render(
      <ProductCard product={{ ...product, title: null }} href="#/p/1"
                   tracked={false} onToggleTrack={() => {}} onSetAlert={() => {}} />,
    );
    expect(screen.getByRole("link", { name: /example\.com/ })).toBeInTheDocument();
  });

  it("labels the track toggle by state", () => {
    setup({ tracked: true });
    expect(screen.getByRole("button", { name: "Stop tracking" })).toBeInTheDocument();
  });

  it("fires the track toggle without navigating", async () => {
    const { onToggleTrack } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Track this product" }));
    expect(onToggleTrack).toHaveBeenCalledOnce();
  });

  it("fires the alert action", async () => {
    const { onSetAlert } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Set alert" }));
    expect(onSetAlert).toHaveBeenCalledOnce();
  });

  it("flags a lowest-ever product", () => {
    setup();
    expect(screen.getByText("Lowest ever")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- ProductCard`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/ProductCard.tsx`**

```tsx
import type { Product } from "./api";
import { Badge } from "./Badge";
import { Heart } from "./icons";
import { ProductImage } from "./ProductImage";
import { productImage } from "./images";
import { formatMoney } from "./format";

// The reference card wraps everything in <a> and puts <button>s inside it.
// That is invalid HTML, and the buttons capture clicks meant for the link.
// Here the card is a plain <div>; the title's anchor is stretched over the
// whole card with ::after, and the real buttons sit above it on z-index.
export function ProductCard({
  product,
  href,
  tracked,
  onToggleTrack,
  onSetAlert,
}: {
  product: Product;
  href: string;
  tracked: boolean;
  onToggleTrack: () => void;
  onSetAlert: () => void;
}) {
  const title = product.title ?? product.domain;
  const currency = product.currency ?? "USD";
  // The was-price is the 90-day median, and it is shown ONLY when it sits
  // above what you would pay now — striking through a lower number would
  // advertise a discount that does not exist.
  const price = product.latest_price;
  const was =
    price != null && product.median_90d != null && product.median_90d > price
      ? product.median_90d
      : null;

  return (
    <div className="rv-pcard group">
      <button
        type="button"
        className="rv-pcard-fav"
        aria-pressed={tracked}
        onClick={onToggleTrack}
      >
        <Heart className="rv-pcard-fav-icon" />
        <span className="rv-sr">{tracked ? "Stop tracking" : "Track this product"}</span>
      </button>

      <div className="rv-pcard-shot">
        <ProductImage
          image={productImage(product.image_url, title)}
          ratio="4 / 3"
        />
      </div>

      <div className="rv-pcard-body">
        <p className="rv-pcard-prices">
          <span className="rv-pcard-now rv-num">
            {price != null ? formatMoney(price, currency) : "—"}
          </span>
          {was != null && (
            <s className="rv-pcard-was rv-num">{formatMoney(was, currency)}</s>
          )}
        </p>

        <h3 className="rv-pcard-title">
          {/* The stretched link — see .rv-pcard-link::after. */}
          <a className="rv-pcard-link" href={href}>{title}</a>
        </h3>

        {product.is_lowest_ever && (
          <p className="rv-pcard-flag"><Badge tone="signal">Lowest ever</Badge></p>
        )}

        <div className="rv-pcard-actions">
          <button type="button" className="rv-pcard-btn rv-pcard-btn-2" onClick={onSetAlert}>
            Set alert
          </button>
          <a className="rv-pcard-btn rv-pcard-btn-1" href={href}>View history</a>
        </div>
      </div>
    </div>
  );
}

export const PRODUCT_CARD_STYLES = `
  .rv-pcard { position: relative; overflow: hidden; background: var(--paper); }
  .rv-pcard-shot { overflow: hidden; }
  .rv-pcard-shot img {
    height: 256px; width: 100%; object-fit: cover; display: block;
    transition: transform var(--dur-slow) var(--ease-out-soft);
  }
  .rv-pcard:hover .rv-pcard-shot img { transform: scale(1.05); }

  .rv-pcard-fav {
    position: absolute; top: 16px; right: 16px; z-index: 10;
    border-radius: var(--r-pill); background: var(--paper); color: var(--ink);
    border: 0; padding: 6px; cursor: pointer;
    transition: color var(--dur-fast) var(--ease-out-soft);
  }
  .rv-pcard-fav:hover { color: var(--ink-muted); }
  .rv-pcard-fav[aria-pressed="true"] { color: var(--red-deep); }
  .rv-pcard-fav-icon { width: 16px; height: 16px; display: block; }

  .rv-pcard-body { position: relative; border: 1px solid var(--rule-faint); padding: 24px; }
  .rv-pcard-prices { margin: 0; color: var(--ink-soft); display: flex; gap: 8px; align-items: baseline; }
  .rv-pcard-was { color: var(--ink-muted); }
  .rv-pcard-title { margin: 6px 0 0; font-size: 18px; font-weight: 500; color: var(--ink); }

  .rv-pcard-link { color: inherit; text-decoration: none; }
  /* Stretched link: covers the card without nesting interactive elements.
     The buttons above it carry z-index 10 and stay clickable. */
  .rv-pcard-link::after { content: ""; position: absolute; inset: 0; z-index: 1; }

  .rv-pcard-flag { margin: 6px 0 0; }

  .rv-pcard-actions { margin-top: 16px; display: flex; gap: 16px; position: relative; z-index: 10; }
  .rv-pcard-btn {
    display: block; width: 100%; text-align: center; text-decoration: none;
    border: 0; border-radius: var(--r-sm); padding: 12px 16px;
    font-family: var(--font-sans); font-size: 14px; font-weight: 500;
    cursor: pointer; transition: transform var(--dur-fast) var(--ease-out-soft);
  }
  .rv-pcard-btn:hover { transform: scale(1.05); }
  .rv-pcard-btn-2 { background: var(--primary-tint); color: var(--ink); }
  .rv-pcard-btn-1 { background: var(--primary); color: #fff; }

  @media (prefers-reduced-motion: reduce) {
    .rv-pcard-shot img, .rv-pcard-btn { transition: none; }
    .rv-pcard:hover .rv-pcard-shot img { transform: none; }
    .rv-pcard-btn:hover { transform: none; }
  }
`;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- ProductCard`
Expected: PASS, 8 tests.

- [ ] **Step 5: Use it in the browse grid**

In `src/BrowsePage.tsx`, replace the existing product tile markup (around line 212, where `ProductImage` renders) with `<ProductCard …/>` inside a grid:

```css
  .rv-browse-grid {
    display: grid; gap: 24px;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
```

- [ ] **Step 6: Apply the card shape to the deals fan**

In `src/ProductFan.tsx`, repoint `.rv-fan-card` / `.rv-fan-card-core` to the new surface (white, `--rule-faint` border, `--r-card` radius, `--shadow-sm`). **Do not touch lines 158–316** — that is the GSAP fan choreography and it is out of scope.

- [ ] **Step 7: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 8: Manual check** — `npm run dev`, `#/browse`. Confirm: clicking the card body navigates; clicking the heart or "Set alert" does not navigate; the image zoom is clipped by the card; tabbing reaches the heart, the title link, and both actions.

- [ ] **Step 9: Checkpoint — do NOT commit.**

---

### Task 13: Details list for product metadata

**Files:**
- Modify: `src/priceViews.tsx`, `src/ProductDetailPage.tsx`
- Create: `src/priceViews.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `DetailsList({ rows }: { rows: { term: string; value: ReactNode }[] })` exported from `src/priceViews.tsx`.

**The price history table stays a `<table>`.** It is tabular data; a `<dl>` is the wrong element. Only the *metadata* block converts.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DetailsList } from "./priceViews";

describe("DetailsList", () => {
  const rows = [
    { term: "Store", value: "example.com" },
    { term: "Category", value: "Audio" },
    { term: "Readings", value: "42" },
  ];

  it("renders a definition list", () => {
    const { container } = render(<DetailsList rows={rows} />);
    expect(container.querySelector("dl")).toBeTruthy();
  });

  it("pairs each term with its value", () => {
    render(<DetailsList rows={rows} />);
    expect(screen.getByText("Store")).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });

  it("renders one dt and one dd per row", () => {
    const { container } = render(<DetailsList rows={rows} />);
    expect(container.querySelectorAll("dt")).toHaveLength(3);
    expect(container.querySelectorAll("dd")).toHaveLength(3);
  });

  it("renders nothing for an empty row set", () => {
    const { container } = render(<DetailsList rows={[]} />);
    expect(container.querySelectorAll("dt")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- priceViews`
Expected: FAIL — `DetailsList` is not exported.

- [ ] **Step 3: Implement `DetailsList` in `src/priceViews.tsx`**

```tsx
// The reference set's details list. Stacks on mobile, 1/3–2/3 from `sm`,
// zebra on even rows. Used for product METADATA only — the price history
// stays a <table>, because it is tabular data and a <dl> would be wrong.
export function DetailsList({
  rows,
}: {
  rows: { term: string; value: ReactNode }[];
}) {
  return (
    <div className="rv-dl-root">
      <dl className="rv-dl">
        {rows.map((r) => (
          <div className="rv-dl-row" key={r.term}>
            <dt className="rv-dl-term">{r.term}</dt>
            <dd className="rv-dl-val">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
```

Append to `PRICE_VIEW_STYLES`:

```css
  .rv-dl-root { display: flow-root; }
  .rv-dl { margin: -12px 0; font-size: 14px; }
  .rv-dl-row {
    display: grid; grid-template-columns: 1fr; gap: 4px; padding: 12px;
    border-top: 1px solid var(--rule);
  }
  .rv-dl-row:first-child { border-top: 0; }
  .rv-dl-row:nth-child(even) { background: var(--paper-soft); }
  .rv-dl-term { font-weight: 500; color: var(--ink); margin: 0; }
  .rv-dl-val  { color: var(--ink-soft); margin: 0; }
  @media (min-width: 640px) {
    .rv-dl-row { grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .rv-dl-val { grid-column: span 2; }
  }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- priceViews`
Expected: PASS, 4 tests.

- [ ] **Step 5: Use it on the product detail page**

In `src/ProductDetailPage.tsx`, replace the metadata block inside the `<Panel>` at line 254 with `<DetailsList rows={[…]} />` carrying: Store, Category, First seen, Readings, Coverage. Leave the price-history table untouched.

- [ ] **Step 6: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 7: Checkpoint — do NOT commit.**

---

# Phase 3 — The six new components

### Task 14: Accordion

**Files:**
- Create: `src/Accordion.tsx`, `src/Accordion.test.tsx`
- Modify: `src/LegalPage.tsx`, `src/ScoreExplainer.tsx`

**Interfaces:**
- Consumes: `ChevronDown` from Task 5.
- Produces: `Accordion({ items }: { items: { id: string; title: string; icon?: ReactNode; body: ReactNode }[] })`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Accordion } from "./Accordion";

const items = [
  { id: "a", title: "Getting Started", body: <p>alpha</p> },
  { id: "b", title: "Configuration", body: <p>beta</p> },
];

describe("Accordion", () => {
  it("renders a summary per item", () => {
    render(<Accordion items={items} />);
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("Configuration")).toBeInTheDocument();
  });

  it("starts closed", () => {
    const { container } = render(<Accordion items={items} />);
    for (const d of container.querySelectorAll("details")) {
      expect(d).not.toHaveAttribute("open");
    }
  });

  it("opens on click", async () => {
    const { container } = render(<Accordion items={items} />);
    await userEvent.click(screen.getByText("Getting Started"));
    expect(container.querySelector("details")).toHaveAttribute("open");
  });

  it("keeps each panel independently toggleable", async () => {
    const { container } = render(<Accordion items={items} />);
    await userEvent.click(screen.getByText("Getting Started"));
    await userEvent.click(screen.getByText("Configuration"));
    const all = container.querySelectorAll("details");
    expect(all[0]).toHaveAttribute("open");
    expect(all[1]).toHaveAttribute("open");
  });

  it("hides the chevron from assistive tech", () => {
    const { container } = render(<Accordion items={items} />);
    for (const svg of container.querySelectorAll(".rv-acc-chev")) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- Accordion`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/Accordion.tsx`**

```tsx
import type { ReactNode } from "react";
import { ChevronDown } from "./icons";

// <details>-based, so open/close needs no JS and works before hydration.
// Panels are independent — no single-open accordion behaviour, matching
// the reference set.
export function Accordion({
  items,
}: {
  items: { id: string; title: string; icon?: ReactNode; body: ReactNode }[];
}) {
  return (
    <div className="rv-acc">
      {items.map((it) => (
        <details className="rv-acc-item" key={it.id}>
          <summary className="rv-acc-summary">
            <span className="rv-acc-title">
              {it.icon}
              {it.title}
            </span>
            <ChevronDown className="rv-acc-chev" />
          </summary>
          <div className="rv-acc-body">{it.body}</div>
        </details>
      ))}
    </div>
  );
}

export const ACCORDION_STYLES = `
  .rv-acc { display: flex; flex-direction: column; gap: 8px; }
  /* The default disclosure triangle is replaced by our own chevron. */
  .rv-acc-summary::-webkit-details-marker { display: none; }
  .rv-acc-summary { list-style: none; }

  .rv-acc-summary {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    cursor: pointer;
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    background: var(--paper);
    padding: 12px 16px;
    font-family: var(--font-sans); font-weight: 500;
    color: var(--ink);
    transition: background-color var(--dur-fast) var(--ease-out-soft);
  }
  .rv-acc-summary:hover { background: var(--paper-soft); }
  .rv-acc-summary:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--blue-bright);
  }
  .rv-acc-title { display: flex; align-items: center; gap: 8px; }
  .rv-acc-title svg { width: 20px; height: 20px; flex: none; }

  .rv-acc-chev {
    width: 20px; height: 20px; flex: none;
    transition: transform var(--dur-mid) var(--ease-out-soft);
  }
  .rv-acc-item[open] .rv-acc-chev { transform: rotate(-180deg); }

  .rv-acc-body { padding: 16px; color: var(--ink-soft); }

  @media (prefers-reduced-motion: reduce) {
    .rv-acc-chev { transition: none; }
  }
`;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- Accordion`
Expected: PASS, 5 tests.

- [ ] **Step 5: Place it on the legal pages**

In `src/LegalPage.tsx`, convert the section list into `<Accordion items={…} />`, one item per legal section.

- [ ] **Step 6: Place it on the score explainer**

In `src/ScoreExplainer.tsx`, render the four score components as accordion items **below** the existing scrubbed GSAP visual — do not remove `scrubTimeline`; the accordion is the readable companion to it.

- [ ] **Step 7: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 8: Checkpoint — do NOT commit.**

---

### Task 15: Breadcrumbs

**Files:**
- Create: `src/Breadcrumbs.tsx`, `src/Breadcrumbs.test.tsx`
- Modify: `src/ProductDetailPage.tsx`, `src/BrowsePage.tsx`

**Interfaces:**
- Consumes: `Home`, `ChevronRight` from Task 5.
- Produces: `Breadcrumbs({ trail }: { trail: { label: string; href?: string }[] })`. The final entry is the current page and should omit `href`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breadcrumbs } from "./Breadcrumbs";

const trail = [
  { label: "Home", href: "#/" },
  { label: "Audio", href: "#/browse?c=audio" },
  { label: "Wireless Headphones" },
];

describe("Breadcrumbs", () => {
  it("exposes a labelled navigation landmark", () => {
    render(<Breadcrumbs trail={trail} />);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });

  it("links every entry except the last", () => {
    render(<Breadcrumbs trail={trail} />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("marks the final entry as current", () => {
    render(<Breadcrumbs trail={trail} />);
    expect(screen.getByText("Wireless Headphones")).toHaveAttribute("aria-current", "page");
  });

  it("renders the home entry as an icon with an accessible name", () => {
    render(<Breadcrumbs trail={trail} />);
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
  });

  it("hides the separators from assistive tech", () => {
    const { container } = render(<Breadcrumbs trail={trail} />);
    for (const sep of container.querySelectorAll(".rv-crumb-sep svg")) {
      expect(sep).toHaveAttribute("aria-hidden", "true");
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- Breadcrumbs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/Breadcrumbs.tsx`**

```tsx
import { ChevronRight, Home } from "./icons";

// The first entry renders as a home icon with an sr-only name; the last is
// the current page and is not a link. Separators are decorative.
export function Breadcrumbs({
  trail,
}: {
  trail: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="rv-crumbs">
        {trail.map((c, i) => {
          const last = i === trail.length - 1;
          const isHome = i === 0;
          return (
            <li className="rv-crumb" key={`${c.label}-${i}`}>
              {i > 0 && (
                <span className="rv-crumb-sep"><ChevronRight className="rv-crumb-sep-icon" /></span>
              )}
              {last || !c.href ? (
                <span className="rv-crumb-here" aria-current="page">{c.label}</span>
              ) : (
                <a className="rv-crumb-link" href={c.href}>
                  {isHome ? (
                    <>
                      <Home className="rv-crumb-home" />
                      <span className="rv-sr">{c.label}</span>
                    </>
                  ) : (
                    c.label
                  )}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export const BREADCRUMB_STYLES = `
  .rv-crumbs {
    display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
    list-style: none; margin: 0; padding: 0;
    font-size: 14px; color: var(--ink-soft);
  }
  .rv-crumb { display: flex; align-items: center; gap: 4px; }
  .rv-crumb-link {
    display: block; color: inherit; text-decoration: none;
    transition: color var(--dur-fast) var(--ease-out-soft);
  }
  .rv-crumb-link:hover { color: var(--ink); }
  .rv-crumb-home { width: 16px; height: 16px; display: block; }
  .rv-crumb-sep { display: flex; }
  .rv-crumb-sep-icon { width: 16px; height: 16px; }
  .rv-crumb-here { color: var(--ink); }
`;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- Breadcrumbs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Place on product detail, replacing the back button**

In `src/ProductDetailPage.tsx`, render `<Breadcrumbs trail={[{label:"Home",href:"#/"},{label:categoryLabel(product.category),href:`#/browse`},{label:product.title}]} />` at the top of the page and remove the bare back control. Keep `onBack` wired to the browser history for the keyboard `Escape` path if it exists.

- [ ] **Step 6: Place on browse when a category is active**

In `src/BrowsePage.tsx`, render a two-entry trail when a category filter is set.

- [ ] **Step 7: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 8: Checkpoint — do NOT commit.**

---

### Task 16: Toast store

**Files:**
- Create: `src/toastStore.ts`, `src/toastStore.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `createToastStore()` returning `{ subscribe(fn: (t: Toast[]) => void): () => void; push(t: Omit<Toast, "id">): string; dismiss(id: string): void; clear(): void; getAll(): Toast[] }`, and `type Toast = { id: string; tone: "success" | "error" | "info"; title: string; body?: string; duration: number }`. Task 17 consumes all of these.

The store is deliberately framework-free so it is testable without rendering.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createToastStore } from "./toastStore";

describe("toastStore", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts empty", () => {
    expect(createToastStore().getAll()).toEqual([]);
  });

  it("pushes a toast and returns its id", () => {
    const s = createToastStore();
    const id = s.push({ tone: "success", title: "Saved", duration: 4000 });
    expect(s.getAll()).toHaveLength(1);
    expect(s.getAll()[0].id).toBe(id);
  });

  it("gives every toast a distinct id", () => {
    const s = createToastStore();
    const a = s.push({ tone: "info", title: "A", duration: 4000 });
    const b = s.push({ tone: "info", title: "B", duration: 4000 });
    expect(a).not.toBe(b);
  });

  it("notifies subscribers on push", () => {
    const s = createToastStore();
    const seen = vi.fn();
    s.subscribe(seen);
    s.push({ tone: "info", title: "A", duration: 4000 });
    expect(seen).toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe", () => {
    const s = createToastStore();
    const seen = vi.fn();
    const off = s.subscribe(seen);
    off();
    s.push({ tone: "info", title: "A", duration: 4000 });
    expect(seen).not.toHaveBeenCalled();
  });

  it("auto-dismisses after its duration", () => {
    const s = createToastStore();
    s.push({ tone: "info", title: "A", duration: 4000 });
    vi.advanceTimersByTime(3999);
    expect(s.getAll()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(s.getAll()).toHaveLength(0);
  });

  it("dismisses on demand and cancels the pending timer", () => {
    const s = createToastStore();
    const id = s.push({ tone: "info", title: "A", duration: 4000 });
    s.dismiss(id);
    expect(s.getAll()).toHaveLength(0);
    // Advancing past the original duration must not throw or double-remove.
    vi.advanceTimersByTime(5000);
    expect(s.getAll()).toHaveLength(0);
  });

  it("ignores a dismiss for an unknown id", () => {
    const s = createToastStore();
    expect(() => s.dismiss("nope")).not.toThrow();
  });

  it("never auto-dismisses a duration of 0", () => {
    const s = createToastStore();
    s.push({ tone: "error", title: "Stuck", duration: 0 });
    vi.advanceTimersByTime(60_000);
    expect(s.getAll()).toHaveLength(1);
  });

  it("clears everything and cancels every timer", () => {
    const s = createToastStore();
    s.push({ tone: "info", title: "A", duration: 4000 });
    s.push({ tone: "info", title: "B", duration: 4000 });
    s.clear();
    expect(s.getAll()).toEqual([]);
    vi.advanceTimersByTime(5000);
    expect(s.getAll()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- toastStore`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/toastStore.ts`**

```ts
export type ToastTone = "success" | "error" | "info";

export type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
  /** Milliseconds before auto-dismiss. 0 means it stays until dismissed. */
  duration: number;
};

export type ToastStore = ReturnType<typeof createToastStore>;

// Framework-free on purpose: the timer and queue logic is the part worth
// testing, and keeping it out of React means testing it needs no renderer.
export function createToastStore() {
  let toasts: Toast[] = [];
  const listeners = new Set<(t: Toast[]) => void>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let seq = 0;

  function emit() {
    // Hand out a copy so a subscriber cannot mutate our array.
    const snapshot = toasts.slice();
    listeners.forEach((fn) => fn(snapshot));
  }

  function clearTimer(id: string) {
    const t = timers.get(id);
    if (t !== undefined) {
      clearTimeout(t);
      timers.delete(id);
    }
  }

  function dismiss(id: string) {
    clearTimer(id);
    const next = toasts.filter((t) => t.id !== id);
    if (next.length === toasts.length) return; // unknown id — no-op, no emit
    toasts = next;
    emit();
  }

  function push(t: Omit<Toast, "id">): string {
    const id = `t${++seq}`;
    toasts = [...toasts, { ...t, id }];
    if (t.duration > 0) {
      timers.set(id, setTimeout(() => dismiss(id), t.duration));
    }
    emit();
    return id;
  }

  function clear() {
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    toasts = [];
    emit();
  }

  function subscribe(fn: (t: Toast[]) => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }

  return { subscribe, push, dismiss, clear, getAll: () => toasts.slice() };
}

/** The app-wide store. Mounted once by ToastHost in main.tsx. */
export const toastStore = createToastStore();
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- toastStore`
Expected: PASS, 10 tests.

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 6: Checkpoint — do NOT commit.**

---

### Task 17: Toast component, host, and placement

**Files:**
- Create: `src/Toast.tsx`, `src/Toast.test.tsx`
- Modify: `src/main.tsx`, `src/App.tsx`, `src/ProductDetailPage.tsx`, `src/AlertsPage.tsx`

**Interfaces:**
- Consumes: `toastStore`, `Toast`, `ToastTone` from Task 16; `CheckCircle`, `ExclamationTriangle` from Task 5.
- Produces: `ToastHost()` (no props) and `useToast()` returning `{ success(title: string, body?: string): void; error(title: string, body?: string): void; info(title: string, body?: string): void }`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ToastHost } from "./Toast";
import { toastStore } from "./toastStore";

afterEach(() => act(() => toastStore.clear()));

describe("ToastHost", () => {
  it("renders nothing when there are no toasts", () => {
    const { container } = render(<ToastHost />);
    expect(container.querySelector(".rv-toast")).toBeNull();
  });

  it("renders a pushed toast", () => {
    render(<ToastHost />);
    act(() => { toastStore.push({ tone: "success", title: "Saved", duration: 0 }); });
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("marks each toast as an alert", () => {
    render(<ToastHost />);
    act(() => { toastStore.push({ tone: "error", title: "Failed", duration: 0 }); });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders the optional body", () => {
    render(<ToastHost />);
    act(() => {
      toastStore.push({ tone: "info", title: "Tracking", body: "We will check hourly.", duration: 0 });
    });
    expect(screen.getByText("We will check hourly.")).toBeInTheDocument();
  });

  it("stacks multiple toasts", () => {
    render(<ToastHost />);
    act(() => {
      toastStore.push({ tone: "info", title: "A", duration: 0 });
      toastStore.push({ tone: "info", title: "B", duration: 0 });
    });
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });

  it("removes a toast when the store dismisses it", () => {
    render(<ToastHost />);
    let id = "";
    act(() => { id = toastStore.push({ tone: "info", title: "A", duration: 0 }); });
    act(() => { toastStore.dismiss(id); });
    expect(screen.queryByText("A")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- Toast`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/Toast.tsx`**

```tsx
import { useEffect, useState, type ComponentType } from "react";
import { CheckCircle, ExclamationTriangle, ChatBubble } from "./icons";
import { toastStore, type Toast, type ToastTone } from "./toastStore";

const ICON: Record<ToastTone, ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  error: ExclamationTriangle,
  info: ChatBubble,
};

/** Mounted once, in main.tsx. Subscribes to the store and renders the stack. */
export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>(() => toastStore.getAll());
  useEffect(() => toastStore.subscribe(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="rv-toast-host">
      {toasts.map((t) => {
        const Icon = ICON[t.tone];
        return (
          <div role="alert" className={`rv-toast rv-toast-${t.tone}`} key={t.id}>
            <Icon className="rv-toast-icon" />
            <div className="rv-toast-copy">
              <strong className="rv-toast-title">{t.title}</strong>
              {t.body && <p className="rv-toast-body">{t.body}</p>}
            </div>
            <button
              type="button"
              className="rv-toast-x"
              onClick={() => toastStore.dismiss(t.id)}
            >
              <span className="rv-sr">Dismiss</span>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Call sites use this rather than touching the store directly. */
export function useToast() {
  return {
    success: (title: string, body?: string) =>
      toastStore.push({ tone: "success", title, body, duration: 4000 }),
    // Errors stay until dismissed — an error that vanishes is an error missed.
    error: (title: string, body?: string) =>
      toastStore.push({ tone: "error", title, body, duration: 0 }),
    info: (title: string, body?: string) =>
      toastStore.push({ tone: "info", title, body, duration: 4000 }),
  };
}

export const TOAST_STYLES = `
  .rv-toast-host {
    position: fixed; z-index: var(--z-modal);
    right: 16px; bottom: 16px;
    display: flex; flex-direction: column; gap: 8px;
    width: min(400px, calc(100vw - 32px));
  }
  /* A toast floats over the page — chrome, so it wears glass. The tinted
     status fills below sit ON TOP of the glass fill, which is why they use
     rgba rather than the solid --*-wash tokens: an opaque status colour
     would cancel the blur it is layered over. */
  .rv-toast {
    display: flex; align-items: flex-start; gap: 16px;
    border-radius: var(--r-md); border: 1px solid;
    padding: 16px;
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    box-shadow: var(--glass-lip), var(--shadow-lg);
    isolation: isolate;
  }
  @supports not (backdrop-filter: blur(1px)) {
    .rv-toast-success { background: var(--green-wash); }
    .rv-toast-error   { background: var(--red-wash); }
    .rv-toast-info    { background: var(--paper); }
  }
  .rv-toast-success { border-color: #22c55e; background: rgba(240,253,244,.82); }
  .rv-toast-error   { border-color: var(--red);  background: rgba(254,242,242,.82); }
  .rv-toast-info    { border-color: var(--rule-strong); background: var(--glass-fill); }

  .rv-toast-icon { width: 24px; height: 24px; flex: none; margin-top: -2px; }
  .rv-toast-success .rv-toast-icon { color: #15803d; }
  .rv-toast-error   .rv-toast-icon { color: var(--red-deep); }
  .rv-toast-info    .rv-toast-icon { color: var(--ink-muted); }

  .rv-toast-copy { flex: 1; min-width: 0; }
  .rv-toast-title { display: block; line-height: 1.15; font-weight: 500; }
  .rv-toast-success .rv-toast-title { color: #166534; }
  .rv-toast-error   .rv-toast-title { color: #991b1b; }
  .rv-toast-info    .rv-toast-title { color: var(--ink); }

  .rv-toast-body { margin: 2px 0 0; font-size: 14px; }
  .rv-toast-success .rv-toast-body { color: #15803d; }
  .rv-toast-error   .rv-toast-body { color: var(--red-deep); }
  .rv-toast-info    .rv-toast-body { color: var(--ink-soft); }

  .rv-toast-x {
    flex: none; border: 0; background: transparent; cursor: pointer;
    color: inherit; font-size: 18px; line-height: 1; padding: 0 2px;
  }
`;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- Toast`
Expected: PASS, 6 tests.

- [ ] **Step 5: Mount the host**

In `src/main.tsx`, render `<ToastHost />` inside `QueryClientProvider`, after `<App />`. Add `TOAST_STYLES` to the app-level `<style>` block in `src/App.tsx:363`.

- [ ] **Step 6: Wire the three call sites**

- `src/App.tsx` — track-URL job: `toast.success("Now tracking", product.title)` on `SUCCESS`, `toast.error("Could not read that page", …)` on `FAILURE`.
- `src/ProductDetailPage.tsx` — alert saved: `toast.success("Alert set", …)`.
- `src/AlertsPage.tsx` — watch removed: `toast.info("Stopped tracking", …)`.

- [ ] **Step 7: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 8: Manual check** — `npm run dev`, paste a URL and track it. Confirm the success toast appears bottom-right, auto-dismisses after 4s, and that an error toast stays until dismissed.

- [ ] **Step 9: Checkpoint — do NOT commit.**

---

### Task 18: Dropdown

**Files:**
- Create: `src/Dropdown.tsx`, `src/Dropdown.test.tsx`
- Modify: `src/App.tsx` (watchlist row actions), `src/primitives.tsx` (`TopBar` account menu)

**Interfaces:**
- Consumes: `ChevronDown` from Task 5.
- Produces: `Dropdown({ label, groups }: { label: string; groups: { heading?: string; items: { id: string; label: string; onSelect: () => void; danger?: boolean }[] }[] })`.

**The reference markup is permanently open with no keyboard handling.** This task adds open state, outside-click, Escape, roving arrow-key focus, and focus return. The tests enforce each.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dropdown } from "./Dropdown";

function setup() {
  const a = vi.fn(), b = vi.fn(), del = vi.fn();
  render(
    <div>
      <Dropdown
        label="Product"
        groups={[
          { heading: "General", items: [
            { id: "a", label: "Storefront", onSelect: a },
            { id: "b", label: "Warehouse", onSelect: b },
          ]},
          { heading: "Actions", items: [
            { id: "d", label: "Delete", onSelect: del, danger: true },
          ]},
        ]}
      />
      <button>outside</button>
    </div>,
  );
  return { a, b, del };
}

describe("Dropdown", () => {
  it("starts closed", () => {
    setup();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("reports its collapsed state on the trigger", () => {
    setup();
    expect(screen.getByRole("button", { name: "Product menu" }))
      .toHaveAttribute("aria-expanded", "false");
  });

  it("opens on trigger click", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Product menu" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    setup();
    const trigger = screen.getByRole("button", { name: "Product menu" });
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("closes on an outside click", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Product menu" }));
    await userEvent.click(screen.getByRole("button", { name: "outside" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("focuses the first item on open", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Product menu" }));
    expect(screen.getByRole("menuitem", { name: "Storefront" })).toHaveFocus();
  });

  it("moves focus with ArrowDown and wraps at the end", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Product menu" }));
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Warehouse" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Storefront" })).toHaveFocus();
  });

  it("moves focus with ArrowUp and wraps at the start", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Product menu" }));
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
  });

  it("runs the item's action and closes", async () => {
    const { b } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Product menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Warehouse" }));
    expect(b).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("renders group headings without making them menu items", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Product menu" }));
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- Dropdown`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/Dropdown.tsx`**

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "./icons";

type Item = { id: string; label: string; onSelect: () => void; danger?: boolean };
type Group = { heading?: string; items: Item[] };

// The reference markup is permanently open and has no keyboard handling.
// This adds the parts a real menu needs: open state, outside-click, Escape,
// roving arrow-key focus with wraparound, and focus return to the trigger.
export function Dropdown({ label, groups }: { label: string; groups: Group[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const flat = groups.flatMap((g) => g.items);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Focus the first item once the menu has actually rendered.
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  function onItemKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const delta = e.key === "ArrowDown" ? 1 : -1;
    // Wraparound in both directions; % alone goes negative going up.
    const next = (index + delta + flat.length) % flat.length;
    itemRefs.current[next]?.focus();
  }

  let cursor = -1;

  return (
    <div className="rv-dd" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="rv-dd-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} menu`}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <ChevronDown className="rv-dd-chev" />
      </button>

      {open && (
        <div role="menu" className="rv-dd-menu">
          {groups.map((g, gi) => (
            <div className="rv-dd-group" key={g.heading ?? gi}>
              {g.heading && <p className="rv-dd-heading">{g.heading}</p>}
              {g.items.map((it) => {
                cursor += 1;
                const index = cursor;
                return (
                  <button
                    key={it.id}
                    ref={(el) => { itemRefs.current[index] = el; }}
                    type="button"
                    role="menuitem"
                    className={`rv-dd-item${it.danger ? " rv-dd-item-danger" : ""}`}
                    onKeyDown={(e) => onItemKeyDown(e, index)}
                    onClick={() => { it.onSelect(); close(true); }}
                  >
                    {it.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const DROPDOWN_STYLES = `
  .rv-dd { position: relative; display: inline-flex; }
  .rv-dd-trigger {
    display: inline-flex; align-items: center; gap: 8px;
    border: 1px solid var(--rule-strong); border-radius: var(--r-md);
    background: var(--glass-fill);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    box-shadow: var(--glass-lip), var(--shadow-sm);
    isolation: isolate;
    padding: 8px 12px; cursor: pointer;
    font-family: var(--font-sans); font-size: 14px; font-weight: 500;
    color: var(--ink-soft);
    transition: background-color var(--dur-fast) var(--ease-out-soft);
  }
  .rv-dd-trigger:hover { background: var(--paper-soft); color: var(--ink); }
  .rv-dd-chev { width: 16px; height: 16px; }

  /* The menu floats — glass. `overflow: hidden` plus `isolation: isolate`
     matter together here: the first clips the item hovers to the rounded
     corners, the second stops this glass layer from sampling the trigger's
     glass underneath it and compounding the blur. */
  .rv-dd-menu {
    position: absolute; right: 0; top: calc(100% + 8px); z-index: var(--z-modal);
    width: 224px; overflow: hidden;
    border: 1px solid var(--rule-strong); border-radius: var(--r-md);
    background: var(--glass-fill-strong);
    backdrop-filter: var(--glass-blur-deep);
    -webkit-backdrop-filter: var(--glass-blur-deep);
    box-shadow: var(--glass-lip), var(--shadow-lg);
    isolation: isolate;
  }
  @supports not (backdrop-filter: blur(1px)) {
    .rv-dd-trigger, .rv-dd-menu { background: var(--paper); }
  }
  .rv-dd-group + .rv-dd-group { border-top: 1px solid var(--rule); }
  .rv-dd-heading { margin: 0; padding: 8px 12px; font-size: 14px; color: var(--ink-fade); }
  .rv-dd-item {
    display: block; width: 100%; text-align: left;
    border: 0; background: transparent; cursor: pointer;
    padding: 8px 12px; font-family: var(--font-sans); font-size: 14px;
    font-weight: 500; color: var(--ink-soft);
    transition: background-color var(--dur-fast) var(--ease-out-soft);
  }
  .rv-dd-item:hover, .rv-dd-item:focus-visible {
    background: var(--paper-soft); color: var(--ink); outline: none;
  }
  .rv-dd-item-danger { color: var(--red-deep); }
  .rv-dd-item-danger:hover, .rv-dd-item-danger:focus-visible { background: var(--red-wash); }
`;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- Dropdown`
Expected: PASS, 10 tests.

- [ ] **Step 5: Place on the watchlist rows**

In `src/App.tsx`, replace the `.rv-wrow-unwatch` control with a `Dropdown` carrying: **General** — View history, Re-check now; **Actions** — Stop tracking (`danger: true`).

- [ ] **Step 6: Place on the TopBar, and repoint the nav island to the glass tokens**

In `src/primitives.tsx`'s `TopBar`, render an account `Dropdown` when a signed-in status is present.

Then fix the nav island itself. `.rv-topbar-inner` is **already** liquid glass,
but its values are hardcoded literals from the retired warm-paper system, so the
Task 2 retoken left them behind — it is currently a warm island floating on a
gray-50 page. Repoint it onto the tokens:

```css
  .rv-topbar-inner {
    /* …layout properties unchanged… */
    border-radius: var(--r-pill);
    background: var(--glass-fill);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    box-shadow: var(--glass-lip), var(--glass-edge), var(--shadow-md);
    isolation: isolate;
  }
  @supports not (backdrop-filter: blur(1px)) {
    .rv-topbar-inner { background: var(--glass-fill-strong); }
  }
```

The old values were `rgba(248,247,244,.74)` with an inline
`inset 0 1px 0 rgba(255,255,255,.9), 0 0 0 1px rgba(27,26,22,.06)` shadow stack —
that warm fill and the warm `rgba(27,26,22,…)` hairline are what must go.

Do the same for the mobile sheet (`primitives.tsx`, the rule carrying
`blur(28px) saturate(1.4)`): it takes `--glass-blur-deep` and
`--glass-fill-strong`.

- [ ] **Step 7: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 8: Manual keyboard check** — `npm run dev`, dashboard. Tab to a row menu, press Enter, arrow down through items past the end (must wrap), press Escape (must close and return focus to the trigger).

- [ ] **Step 9: Checkpoint — do NOT commit.**

---

### Task 19: Filter popovers

**Files:**
- Create: `src/FilterPopover.tsx`, `src/FilterPopover.test.tsx`
- Modify: `src/BrowsePage.tsx`

**Interfaces:**
- Consumes: `ChevronDown` from Task 5.
- Produces: `CheckboxFilter({ label, options, selected, onChange })` and `RangeFilter({ label, min, max, onChange, note })`, where `options: { value: string; label: string }[]`, `selected: string[]`, `onChange(next: string[]): void` / `onChange(next: { min: number; max: number }): void`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckboxFilter, RangeFilter } from "./FilterPopover";

const options = [
  { value: "audio", label: "Audio" },
  { value: "laptops", label: "Laptops" },
];

describe("CheckboxFilter", () => {
  it("shows how many are selected", () => {
    render(<CheckboxFilter label="Category" options={options} selected={["audio"]} onChange={() => {}} />);
    expect(screen.getByText("1 Selected")).toBeInTheDocument();
  });

  it("reflects selection state on the boxes", () => {
    render(<CheckboxFilter label="Category" options={options} selected={["audio"]} onChange={() => {}} />);
    expect(screen.getByLabelText("Audio")).toBeChecked();
    expect(screen.getByLabelText("Laptops")).not.toBeChecked();
  });

  it("adds a value when an unchecked box is clicked", async () => {
    const onChange = vi.fn();
    render(<CheckboxFilter label="Category" options={options} selected={["audio"]} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Laptops"));
    expect(onChange).toHaveBeenCalledWith(["audio", "laptops"]);
  });

  it("removes a value when a checked box is clicked", async () => {
    const onChange = vi.fn();
    render(<CheckboxFilter label="Category" options={options} selected={["audio"]} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Audio"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("resets to empty", async () => {
    const onChange = vi.fn();
    render(<CheckboxFilter label="Category" options={options} selected={["audio"]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe("RangeFilter", () => {
  it("renders min and max fields with their values", () => {
    render(<RangeFilter label="Price" min={0} max={600} note="Max price is $600" onChange={() => {}} />);
    expect(screen.getByLabelText("Min")).toHaveValue(0);
    expect(screen.getByLabelText("Max")).toHaveValue(600);
  });

  it("reports a changed max", async () => {
    const onChange = vi.fn();
    render(<RangeFilter label="Price" min={0} max={600} note="" onChange={onChange} />);
    const max = screen.getByLabelText("Max");
    await userEvent.clear(max);
    await userEvent.type(max, "300");
    expect(onChange).toHaveBeenLastCalledWith({ min: 0, max: 300 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- FilterPopover`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/FilterPopover.tsx`**

```tsx
import type { ReactNode } from "react";
import { ChevronDown } from "./icons";

// <details>-anchored popovers, exactly as the reference set does it: the
// panel is in normal flow when closed and absolutely positioned when open,
// via group-open. No JS positioning, no portal.
function Shell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="rv-filter">
      <summary className="rv-filter-summary">
        <span className="rv-filter-label">{label}</span>
        <span className="rv-filter-chev-wrap"><ChevronDown className="rv-filter-chev" /></span>
      </summary>
      <div className="rv-filter-panel">{children}</div>
    </details>
  );
}

export function CheckboxFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }
  return (
    <Shell label={label}>
      <div className="rv-filter-head">
        <span className="rv-filter-count">{selected.length} Selected</span>
        <button type="button" className="rv-filter-reset" onClick={() => onChange([])}>
          Reset
        </button>
      </div>
      <fieldset className="rv-filter-set">
        <legend className="rv-sr">{label}</legend>
        {options.map((o) => (
          <label className="rv-filter-opt" key={o.value}>
            <input
              type="checkbox"
              className="rv-filter-box"
              checked={selected.includes(o.value)}
              onChange={() => toggle(o.value)}
            />
            <span className="rv-filter-opt-label">{o.label}</span>
          </label>
        ))}
      </fieldset>
    </Shell>
  );
}

export function RangeFilter({
  label,
  min,
  max,
  note,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  note: string;
  onChange: (next: { min: number; max: number }) => void;
}) {
  return (
    <Shell label={label}>
      <div className="rv-filter-head">
        <span className="rv-filter-count">{note}</span>
        <button type="button" className="rv-filter-reset" onClick={() => onChange({ min: 0, max: 0 })}>
          Reset
        </button>
      </div>
      <div className="rv-filter-range">
        <label className="rv-filter-num">
          <span className="rv-filter-num-label">Min</span>
          <input
            type="number"
            className="rv-filter-input"
            value={min}
            onChange={(e) => onChange({ min: Number(e.target.value), max })}
          />
        </label>
        <label className="rv-filter-num">
          <span className="rv-filter-num-label">Max</span>
          <input
            type="number"
            className="rv-filter-input"
            value={max}
            onChange={(e) => onChange({ min, max: Number(e.target.value) })}
          />
        </label>
      </div>
    </Shell>
  );
}

export const FILTER_STYLES = `
  .rv-filter { position: relative; }
  .rv-filter-summary::-webkit-details-marker { display: none; }
  .rv-filter-summary {
    list-style: none; cursor: pointer;
    display: flex; align-items: center; gap: 8px;
    border-bottom: 1px solid var(--rule-strong); padding-bottom: 4px;
    color: var(--ink-soft);
    transition: border-color var(--dur-fast) var(--ease-out-soft),
                color var(--dur-fast) var(--ease-out-soft);
  }
  .rv-filter-summary:hover { border-color: var(--ink-fade); color: var(--ink); }
  .rv-filter-label { font-size: 14px; font-weight: 500; }
  .rv-filter-chev-wrap { display: flex; transition: transform var(--dur-fast) var(--ease-out-soft); }
  .rv-filter[open] .rv-filter-chev-wrap { transform: rotate(-180deg); }
  .rv-filter-chev { width: 16px; height: 16px; }

  .rv-filter-panel { width: 256px; }
  /* Open, the panel floats over content — glass. Closed it is in normal
     flow and carries no treatment at all. */
  .rv-filter[open] .rv-filter-panel {
    position: absolute; left: 0; top: 32px; z-index: var(--z-modal);
    border: 1px solid var(--rule-strong); border-radius: var(--r-md);
    background: var(--glass-fill-strong);
    backdrop-filter: var(--glass-blur-deep);
    -webkit-backdrop-filter: var(--glass-blur-deep);
    box-shadow: var(--glass-lip), var(--shadow-lg);
    isolation: isolate;
  }
  @supports not (backdrop-filter: blur(1px)) {
    .rv-filter[open] .rv-filter-panel { background: var(--paper); }
  }
  .rv-filter-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; border-bottom: 1px solid var(--rule-strong);
  }
  .rv-filter-count { font-size: 14px; color: var(--ink-soft); }
  .rv-filter-reset {
    border: 0; background: transparent; cursor: pointer;
    font-size: 14px; color: var(--ink-soft); text-decoration: underline;
  }
  .rv-filter-reset:hover { color: var(--ink); }

  .rv-filter-set { border: 0; margin: 0; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
  .rv-filter-opt { display: inline-flex; align-items: center; gap: 12px; cursor: pointer; }
  .rv-filter-box { width: 20px; height: 20px; border-radius: var(--r-md); border: 1px solid var(--rule-strong); }
  .rv-filter-opt-label { font-size: 14px; font-weight: 500; color: var(--ink-soft); }

  .rv-filter-range { display: flex; gap: 12px; padding: 12px; }
  .rv-filter-num { flex: 1; }
  .rv-filter-num-label { display: block; font-size: 14px; color: var(--ink-soft); margin-bottom: 2px; }
`;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- FilterPopover`
Expected: PASS, 7 tests.

- [ ] **Step 5: Place on browse**

In `src/BrowsePage.tsx`, render a filter bar above the grid with a `CheckboxFilter` for category (options from `categoryLabel`/`taxonomy.ts`) and a `RangeFilter` for price. Wire both to the page's existing filter state; do not add new API parameters.

- [ ] **Step 6: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 7: Checkpoint — do NOT commit.**

---

### Task 20: Timeline

**Files:**
- Create: `src/Timeline.tsx`, `src/Timeline.test.tsx`
- Modify: `src/ProductDetailPage.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `Timeline({ events }: { events: { id: string; date: string; title: string; note?: string; direction?: "down" | "up" | "neutral" }[] })`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Timeline } from "./Timeline";

const events = [
  { id: "1", date: "2026-02-12", title: "First seen", note: "at $80.00", direction: "neutral" as const },
  { id: "2", date: "2026-03-05", title: "Price dropped", note: "to $64.00", direction: "down" as const },
  { id: "3", date: "2026-04-24", title: "Lowest ever", note: "$49.99", direction: "down" as const },
];

describe("Timeline", () => {
  it("renders an ordered list", () => {
    const { container } = render(<Timeline events={events} />);
    expect(container.querySelector("ol")).toBeTruthy();
  });

  it("renders one entry per event", () => {
    const { container } = render(<Timeline events={events} />);
    expect(container.querySelectorAll("li")).toHaveLength(3);
  });

  it("uses a machine-readable time element", () => {
    const { container } = render(<Timeline events={events} />);
    const t = container.querySelector("time")!;
    expect(t).toHaveAttribute("dateTime", "2026-02-12");
  });

  it("renders titles and notes", () => {
    render(<Timeline events={events} />);
    expect(screen.getByText("Lowest ever")).toBeInTheDocument();
    expect(screen.getByText("$49.99")).toBeInTheDocument();
  });

  it("marks direction with a class so colour is not the only cue", () => {
    const { container } = render(<Timeline events={events} />);
    expect(container.querySelector(".rv-tl-dot-down")).toBeTruthy();
    expect(container.querySelector(".rv-tl-dot-neutral")).toBeTruthy();
  });

  it("renders nothing for an empty event list", () => {
    const { container } = render(<Timeline events={[]} />);
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- Timeline`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/Timeline.tsx`**

```tsx
export function Timeline({
  events,
}: {
  events: {
    id: string;
    date: string;
    title: string;
    note?: string;
    direction?: "down" | "up" | "neutral";
  }[];
}) {
  return (
    <ol className="rv-tl">
      {events.map((e) => (
        <li className="rv-tl-item" key={e.id}>
          <div className="rv-tl-content">
            <span className={`rv-tl-dot rv-tl-dot-${e.direction ?? "neutral"}`} />
            <div className="rv-tl-copy">
              <time className="rv-tl-date" dateTime={e.date}>{e.date}</time>
              <h3 className="rv-tl-title">{e.title}</h3>
              {e.note && <p className="rv-tl-note">{e.note}</p>}
            </div>
          </div>
          <div aria-hidden="true" />
        </li>
      ))}
    </ol>
  );
}

export const TIMELINE_STYLES = `
  /* Single column by default; the alternating two-column layout is a
     sm-and-up enhancement. The reference set only shows the wide form,
     which collapses unusably on a phone. */
  .rv-tl { position: relative; list-style: none; margin: 0; padding: 0;
           display: flex; flex-direction: column; gap: 32px; }
  .rv-tl::before {
    content: ""; position: absolute; top: 0; left: 5px;
    width: 2px; height: 100%; border-radius: var(--r-pill);
    background: var(--rule);
  }
  .rv-tl-item { position: relative; }
  .rv-tl-content { display: flex; align-items: flex-start; gap: 16px; }
  .rv-tl-dot { width: 12px; height: 12px; border-radius: var(--r-pill); flex: none; margin-top: 4px; }
  .rv-tl-dot-down    { background: var(--green); }
  .rv-tl-dot-up      { background: var(--amber); }
  .rv-tl-dot-neutral { background: var(--blue); }
  .rv-tl-copy { margin-top: -8px; }
  .rv-tl-date  { font-size: 12px; line-height: 1; font-weight: 500; color: var(--ink-soft); }
  .rv-tl-title { margin: 2px 0 0; font-size: 18px; font-weight: 700; color: var(--ink); }
  .rv-tl-note  { margin: 2px 0 0; font-size: 14px; color: var(--ink-soft); }

  @media (min-width: 640px) {
    .rv-tl::before { left: 50%; transform: translateX(-50%); }
    .rv-tl-item { display: grid; grid-template-columns: 1fr 1fr; }
    .rv-tl-item:nth-child(odd)  { margin-right: -12px; }
    .rv-tl-item:nth-child(even) { margin-left: -12px; }
    .rv-tl-item:nth-child(odd) .rv-tl-content { flex-direction: row-reverse; text-align: right; }
    .rv-tl-item:nth-child(even) .rv-tl-content { order: 2; }
  }
`;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- Timeline`
Expected: PASS, 6 tests.

- [ ] **Step 5: Place on the product detail page**

In `src/ProductDetailPage.tsx`, derive events from the existing price history already fetched by `usePriceHistory`: first reading ("First seen"), each change of direction ("Price dropped" / "Price rose"), the lowest-ever point, and any alert fired. Render inside a `<Panel label="History">`. Do not add an API call.

- [ ] **Step 6: Verify the build and tests**

Run: `npm run build && npm test`
Expected: both exit 0.

- [ ] **Step 7: Responsive check** — `npm run dev`, product detail. Confirm single-column below 640px with the rail on the left, alternating above it.

- [ ] **Step 8: Checkpoint — do NOT commit.**

---

## Final verification

- [ ] **Full test run:** `npm test` — every suite passes.
- [ ] **Full build:** `npm run build` — exit 0.
- [ ] **Orphan scan:** `grep -rn "Bezel\|rv-bezel\|rv-gridded\|Stamp\|rv-stamp\|rv-seg-btn\|rv-window-btn\|font-stretch\|--grid\b\|--bezel\|--shadow-lip\|--z-grain" src/` — no output. (`--img-ring` is NOT in this list: it survives, repointed.)
- [ ] **Hard-coded colour scan:** `grep -rnE "#[0-9a-fA-F]{6}|rgba\(27,26,22" src/ --include=*.tsx --include=*.css` — every hit is either a token definition in `theme.css`, a frozen `--series-*`/`--ramp-*` value, or a documented exception (the stat-card trend greens, the toast greens). Anything else moves into a token.
- [ ] **Route pass:** `npm run dev`, then visit `/`, `#/login`, onboarding, dashboard, `#/browse`, a product detail, `#/alerts`, and a legal page. Every one uses the new palette; no warm cast, no plotter grid.
- [ ] **Reduced-motion pass:** enable `prefers-reduced-motion: reduce` in DevTools rendering options. All content visible, nothing animating, spinner frozen rather than gone.
- [ ] **Keyboard pass:** tab through the dropdown (arrow wraparound, Escape returns focus), the accordion, the filter popovers, and a product card (heart, title, both actions all reachable).
- [ ] **Contrast pass:** any colour pair introduced during implementation and not already covered by `tokens.test.ts` gets checked with `contrastRatio` before it ships.

---

## Self-review notes

**Spec coverage.** Every section of the design doc maps to a task: retoken → Tasks 2–3; `--ground` rename → Task 3; dead tokens and Bezel → Task 4; the ten-row primitive table → Tasks 5–13; the six new components → Tasks 14–20; the stat-card contrast fix → Task 11 Step 3; the product card's invalid-HTML fix → Task 12 Step 1 (enforced by test). Phase 4 (motion) is deliberately **not** here — it is an independent subsystem and gets its own plan, `2026-09-10-gsap-motion-pass.md`.

**Deviation.** Task 1 adds Vitest, which the spec excluded. Rationale is stated at the top of this plan; scope is capped at logic and tokens.

**Known ordering constraint.** Task 4 removes `Panel`'s `gridded` prop, which Task 8 then restyles. Running Task 8 before Task 4 leaves an orphan `rv-gridded` class. Execute in order.
