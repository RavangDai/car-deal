# Hyper UI redesign — design

**Date:** 2026-09-10
**Status:** awaiting review
**Companion:** `docs/design/component-language.md` (the thirteen reference components)

---

## Goal

Move the WasItCheaper frontend from its "instrument" design system (warm paper,
hairline rules, achromatic CTA, green reserved for verified price drops) to the
Hyper UI / Tailwind visual language Bibek selected: white cards, gray borders,
`rounded-lg`, blue and indigo accents, emerald/amber/red badges.

Then build and place the six components from the reference set that this app
does not yet have, and finish with a GSAP motion pass.

### Non-goals

- Dark mode. None of the thirteen reference components define one; light-only.
- Changing the styling *architecture*. Components keep injecting CSS through
  `<style>` template strings (`PRIMITIVE_STYLES`, `CHART_STYLES`, …) driven by
  `theme.css` tokens. Rewriting that to inline Tailwind classes was considered
  (Approach B) and rejected: ~20 files, no single source of truth afterward.
- Backend, API, or data-model changes. This is presentation only.
- Renaming tokens. `theme.css`'s own convention is that names are stable across
  redesigns and only values repoint. Honoured here, with one exception noted
  under Phase 1.

### Decisions already taken

| Decision | Answer |
|---|---|
| Typography | Plus Jakarta Sans (UI/body), Urbanist (display + figures) — **already shipped** |
| Palette | Full Hyper UI; the warm-paper system is replaced, not adapted |
| New components | Built **and placed** in real screens |
| Approach | C — retoken, then rebuild the vocabulary, then add, then motion |

---

## Architecture

The leverage point is that every component already reads tokens. `theme.css`
defines ~70 custom properties on `:root`; roughly 7,900 lines of TSX consume
them via `var(--…)`. Repointing values flips the entire app in one file.

So the work is layered, each layer independently shippable:

```
Phase 1  retoken         theme.css values + rewritten rationale   → whole app flips
Phase 2  primitives      Stamp, Button, Panel, Spinner, input,    → the vocabulary
                         table, cards; Bezel retires                becomes Hyper UI
Phase 3  new components  accordion, breadcrumbs, toast, dropdown, → placed in screens
                         filters, timeline
Phase 4  motion          cursor, inertial scroll, page transitions
```

Phase 1 alone produces a coherent, working app. That matters: it is the review
checkpoint where the direction gets confirmed cheaply, before Phase 2 spends
effort on component internals.

---

## Phase 1 — Retoken

### Token mapping

Values are Tailwind v3 (the project runs `tailwindcss ^3.4.18`).

**Surfaces** — the canvas inverts from warm paper to white-on-gray-50.

| Token | Was | Becomes | Tailwind |
|---|---|---|---|
| `--paper` | `#f4f3ef` | `#ffffff` | white |
| `--paper-soft` | `#ebeae4` | `#f9fafb` | gray-50 |
| `--paper-deep` | `#e2e0d8` | `#f3f4f6` | gray-100 |
| `--paper-pale` | `#ffffff` | `#ffffff` | white |
| `--bone` | `#ffffff` | `#ffffff` | white |

> `--paper` now means "card surface" and `--paper-soft` means "page ground",
> which is the inverse of the old relationship (page was `--paper`, cards were
> `--paper-pale`). **This is the one place a rename is warranted** — leaving a
> token called `--paper` holding pure white while the page behind it is gray is
> the kind of lie that causes the next mistake. Proposal: keep `--paper` as the
> card surface and introduce `--ground` for the page, updating the ~6 page-level
> `background: var(--paper)` call sites (`rv-report`, `rv-browse`, `rv-alerts`,
> `rv-catalog`, `rv-login`, `rv-detail`).

**Ink** — verified against white.

| Token | Was | Becomes | Tailwind | Contrast on white |
|---|---|---|---|---|
| `--ink` | `#1b1a16` | `#111827` | gray-900 | 17.74:1 |
| `--ink-soft` | `#3c3b34` | `#374151` | gray-700 | 10.31:1 |
| `--ink-muted` | `#6a695f` | `#4b5563` | gray-600 | 7.56:1 |
| `--ink-fade` | `#8d8c82` | `#6b7280` | gray-500 | 4.83:1 |

`--ink-fade` clearing 4.83:1 is an *improvement* — it was 3.05:1 on paper and
carried a documented "never a sentence" restriction. That restriction can be
lifted; gray-500 is the reference set's caption colour and is AA on both white
and gray-50 (4.63:1).

**Status** — the reference set uses two greens: emerald for badges, green for
toasts and trend arrows. Both are kept rather than collapsed, because that is
what the pasted components do.

| Token | Becomes | Tailwind | Verified |
|---|---|---|---|
| `--green` | `#059669` | emerald-600 | — |
| `--green-deep` | `#047857` | emerald-700 | 5.48:1 on white; 4.84:1 on emerald-100 |
| `--green-tint` | `#d1fae5` | emerald-100 | — |
| `--green-line` *(new)* | `#10b981` | emerald-500 | outline-badge border |
| `--amber` | `#f59e0b` | amber-500 | — |
| `--amber-deep` | `#b45309` | amber-700 | 5.02:1 on white; 4.51:1 on amber-100 |
| `--amber-tint` | `#fef3c7` | amber-100 | — |
| `--red` | `#ef4444` | red-500 | — |
| `--red-deep` | `#b91c1c` | red-700 | 6.47:1 on white; 5.30:1 on red-100 |
| `--red-tint` | `#fee2e2` | red-100 | — |
| `--red-wash` | `#fef2f2` | red-50 | destructive menu-item hover |

**Accent** — `--blue` currently holds `#3c3b34`, a placeholder from the prior
pass where "a second hue would compete with green". It finally gets a real
value, so no rename is needed.

| Token | Becomes | Tailwind | Verified |
|---|---|---|---|
| `--primary` | `#111827` | gray-900 | the reference set's primary button is `bg-gray-900` |
| `--primary-deep` | `#000000` | — | hover |
| `--primary-tint` | `#f3f4f6` | gray-100 | the secondary button `bg-gray-100` |
| `--blue` | `#2563eb` | blue-600 | 5.17:1 on white; 4.24:1 on blue-100 (icon wells — graphic, 3:1 bar) |
| `--blue-tint` | `#dbeafe` | blue-100 | — |
| `--blue-bright` | `#3b82f6` | blue-500 | focus rings |
| `--indigo` *(new)* | `#4f46e5` | indigo-600 | 6.29:1 — the loading spinner |
| `--link` | `#2563eb` | blue-600 | |
| `--link-hover` | `#1d4ed8` | blue-700 | |

**Structure**

| Token | Was | Becomes |
|---|---|---|
| `--rule` | `#dcdad1` | `#e5e7eb` gray-200 |
| `--rule-strong` | `#c2bfb2` | `#d1d5db` gray-300 |
| `--rule-faint` *(new)* | — | `#f3f4f6` gray-100 — card borders in the reference set |

**Radius** — the old scale (pill on things you act on, 20px squircle on things
that enclose) collapses to Tailwind's.

| Token | Was | Becomes |
|---|---|---|
| `--r-sm` | 6px | 2px (`rounded-sm`) |
| `--r-md` | 10px | 4px (`rounded`) |
| `--r-lg` | 16px | 8px (`rounded-lg`) |
| `--r-xl` | 24px | 12px (`rounded-xl`) |
| `--r-card` | 20px | 8px (`rounded-lg`) |
| `--r-pill` | 999px | 999px (unchanged) |

**Shadows** — from warm two-stop ambient diffusion to Tailwind's neutral drops.

```
--shadow-sm  0 1px 2px 0 rgb(0 0 0 / .05)
--shadow-md  0 4px 6px -1px rgb(0 0 0 / .1), 0 2px 4px -2px rgb(0 0 0 / .1)
--shadow-lg  0 10px 15px -3px rgb(0 0 0 / .1), 0 4px 6px -4px rgb(0 0 0 / .1)
--shadow-xl  0 20px 25px -5px rgb(0 0 0 / .1), 0 8px 10px -6px rgb(0 0 0 / .1)
```

**Deleted outright** — no consumer survives Phase 2:
`--grid`, `--grid-size` (plotter substrate), `--bezel-pad/-outer/-inner`,
`--shadow-lip`, `--z-grain`.

> **Correction (found while planning):** this list originally included
> `--img-ring`. That was wrong — it has five live consumers (`App.tsx:825`,
> `App.tsx:885`, `BrowsePage.tsx:295`, `ProductDetailPage.tsx:491`, and
> `ProductImage.tsx:15`). It is repointed to
> `inset 0 0 0 1px rgb(0 0 0 / .05)`, not deleted. Likewise `--img-radius`
> survives, repointed to `8px`.

### The dataviz palette is kept unchanged — verified

`--series-*` and `--ramp-*` were validated against `--paper #f4f3ef`. Moving to
white was expected to invalidate that. It does not; **every ratio improves**,
because white is lighter than paper and all nine marks are darker than both:

| | on paper | on white | |
|---|---|---|---|
| `--series-1` | 3.98 | **4.42** | |
| `--series-2` | 2.88 | **3.20** | now clears 3:1 |
| `--series-3` | 7.71 | **8.56** | |
| `--series-4` | 2.42 | **2.69** | still under 3:1 — direct-label obligation stands |
| `--ramp-1` | 2.25 | **2.50** | clears the 2:1 light-end floor |
| `--ramp-2`…`5` | 3.28…10.76 | **3.64…11.95** | |

So: no chart recolouring in this project. The one standing obligation carries
over unchanged — `--series-4` needs a visible direct label or table view, met
today by the ScoreBar legend and the composition chart's "Show as table" toggle.

### Rewriting theme.css's rationale

`theme.css` is 328 lines, and the majority is prose arguing *why* the current
system exists — "green is the one loud color", "the CTA is achromatic on
purpose", "the reference is plotter paper", "no cards, no bevels, no shadows on
content". Every one of those becomes false.

The file header and each token block's comment get rewritten to describe the
Hyper UI system and its actual rules. Leaving stale rationale in place is worse
than having none: it instructs the next reader to preserve properties the code
no longer has.

**Files:** `src/theme.css` (values + prose), `src/index.css` (body ground),
`tailwind.config.cjs` (the shadcn token bridge's radius mappings).

**Checkpoint:** app builds and runs, every screen has flipped to the new
palette, nothing is restructured yet.

---

## Phase 2 — Rebuild the primitive vocabulary

Each entry: what exists, what it becomes, per
`docs/design/component-language.md`.

| Primitive | Location | Change |
|---|---|---|
| `Stamp` | `primitives.tsx:101` | → icon pill badge. Adds an icon slot and an `outline` variant alongside the existing solid tint. `box-shadow: inset 0 0 0 1px` → real `border`. |
| `Button` | `primitives.tsx:113` | Variants remap: `primary` → `bg-gray-900 text-white`, `ghost` → `bg-gray-100 text-gray-900`. Adds the reference focus ring (`ring-2 ring-blue-500 ring-offset-2`). `hover:scale-105` on card CTAs only, not globally. |
| `ButtonGroup` *(new)* | `primitives.tsx` | Extracted from `.rv-seg-btn` / `.rv-window-btn`, which both hand-roll the same segmented control. Keeps `focus:z-10` + offset ring. |
| `Panel` | `primitives.tsx:157` | → `rounded-lg border border-gray-100 bg-white p-6` card. |
| `Bezel` | `primitives.tsx:200` | **Retires.** No Hyper UI equivalent; call sites become `Panel`. |
| `Spinner` | `Spinner.tsx` | → the reference CSS-only `animate-spin` SVG in indigo-600. Drops a framer-motion dependency. |
| `Input` | `primitives.tsx:529` | → floating label. Requires `placeholder=""` present-and-empty on every call site — that is what `peer-placeholder-shown` keys off. |
| `.rv-ptable` | `priceViews.tsx` | Product **metadata** → the `<dl>` details list. Price **history** stays a `<table>`: it is tabular data and a `<dl>` is the wrong element. |
| `StatCard` *(new)* | `primitives.tsx` | label / figure / icon well + trend row. |
| `ProductCard` *(new)* | `primitives.tsx` | See below. |

### Product card — three surfaces, one component

The reference card maps onto three existing and quite different surfaces:

| Surface | File | Treatment |
|---|---|---|
| browse grid | `BrowsePage.tsx:212` | the reference card, essentially verbatim |
| `.rv-fan-card` | `ProductFan.tsx` | card *shape* adopts it; the GSAP fan choreography (lines 158–316) is untouched |
| `.rv-wrow` | `App.tsx` watchlist | a horizontal row with a sparkline, not a grid card — adopts type and colour only, keeps its layout |

**Semantic mapping:** wishlist heart → track/untrack · `$49.99` beside
struck-through `$80` → `latest_price` beside `median_90d` · "Add to Cart" /
"Buy Now" → "Set alert" / "View history".

> **Correction (found while planning):** `Product` (`src/api.ts:203`) has no
> `current_price` / `previous_price`. The live figure is `latest_price`, and
> the was-price analogue is `median_90d` — shown only when it exceeds
> `latest_price`, since striking through a lower number would advertise a
> discount that does not exist. `id` is a `string`, and `title` is nullable.

**Markup correction:** the reference card nests `<button>` inside `<a>` — twice
— which is invalid HTML; browsers recover unpredictably and the buttons swallow
the link. Rebuilt as `<div class="group relative">` with a stretched-link
overlay (`<a class="absolute inset-0">` + `z-10` on the real buttons). Visually
identical, valid, and keyboard-navigable.

### Accessibility carried forward

`sr-only` behind icon-only buttons and trend arrows ("Increase: "),
`aria-hidden` on every decorative SVG, `role="status"` on loaders.

**One fix to the reference set:** the stat card's trend row uses `text-green-600`
at `text-xs`. Measured, that is **3.30:1** on white — below the 4.5:1 needed at
12px. Stepping to green-700 clears it (4.79:1 even on green-50, higher on
white). The red side is fine as-is (red-600 = 4.83:1).

---

## Phase 3 — The six new components, placed

| Component | Placement | Notes |
|---|---|---|
| Accordion | score explainer's four components; legal page sections | `<details>`, no JS |
| Breadcrumbs | product detail (`Home / category / product`), replacing the bare `onBack`; browse when a category filter is active | |
| Toast | track-URL success/failure, alert saved, watch removed | **New infrastructure** — see below |
| Dropdown | watchlist row actions (View / Re-check / Set alert / Stop tracking); `TopBar` account menu | **Needs real interaction work** — see below |
| Filter popover | browse — category checkboxes, price min/max | `<details>` + `group-open:absolute` |
| Timeline | a product's price events — first seen, drops/rises, lowest-ever, alert fired | dot colour carries direction |

### Toast is not just markup

Needs a stack host, a `useToast` hook, auto-dismiss with a pause-on-hover
timer, and `role="alert"` with a polite live region. Mounted once in `main.tsx`
beside the existing providers. This is the largest single piece of new code in
the project.

### Dropdown is not just markup

As pasted it is permanently open with no keyboard handling. A real
implementation needs open state, outside-click and Escape to close, roving
arrow-key focus across `role="menuitem"`, focus return to the trigger on close,
and `aria-expanded` / `aria-haspopup` on the trigger.

### Timeline needs a mobile fallback

The alternating two-column layout (`group-odd:` / `group-even:` around a centre
rail) collapses to a single left-aligned column below `sm`, with the rail moved
to the left edge.

---

## Phase 4 — GSAP motion pass

Independent of Phases 1–3; nothing above changes it.

**`src/smoothScroll.ts` (new)** — inertial scroll on GSAP's ticker. A
non-passive `wheel` listener accumulates a target Y clamped to the document;
each frame lerps current→target, calls `window.scrollTo`, and runs
`ScrollTrigger.update()` so existing reveals stay in sync. Parks itself when the
delta drops below ~0.1px.

A `scroll` listener resyncs the target whenever the page moves without us —
keyboard PageDn/Space/arrows, `scrollIntoView`, focus jumps, hash anchors — so
none of those fight the lerp. Refuses to install under `prefers-reduced-motion`
or `(pointer: coarse)`; mobile keeps native momentum. Returns a teardown.

**`src/Cursor.tsx` (new)** — an ink dot tracking ~1:1 plus a ring trailing via
`gsap.quickTo(…, {duration: .5, ease: "power3"})`. Delegated
`pointerover`/`pointerout` on `document` grows the ring over
`a, button, [role="button"], .rv-fan-card`, so late-mounted content works.
Native cursor hidden globally but **restored over text inputs and textareas**.
Fine-pointer only; never on touch or under reduced motion.

**Page transitions** — the framer-motion crossfade at `App.tsx:369` becomes
GSAP: outgoing opacity→0 / y→−12 / blur 6 over .28s `power2.in`, incoming from
opacity 0 / y 16 / blur 8 over .5s `expo.out` — the same `expo.out` vocabulary
`revealChildren` already speaks. Scroll resets to top *between* the halves,
resyncing the smooth-scroll target.

framer-motion stays in `LoginPage`, `primitives`, and `Spinner` (until Phase 2
replaces the latter). Removing it entirely is not in scope.

### Two constraints from the existing motion module

1. **`motion.ts`'s hero rule.** Above-the-fold content must never scroll-gate —
   a ScrollTrigger gate ships blank in headless and non-scrolled renders, which
   previously broke the screenshot harness. The incoming route animation is
   therefore on-mount, not ScrollTrigger-driven.
2. **`settleAll()` / `window.__rvSettle`** is the screenshot harness's escape
   hatch. Smooth scroll can strand it mid-lerp, so `settleAll` must additionally
   kill the lerp and hard-set scroll position.

---

## Error handling and failure modes

The existing motion module chose its failure mode deliberately: the hidden state
is applied by JS, never CSS, so if GSAP is blocked the page renders fully visible
and unanimated rather than blank. **Every addition in Phase 4 inherits this
rule** — smooth scroll failing leaves native scroll; the cursor failing leaves
the native cursor; a route transition failing leaves the route visible.

| Risk | Mitigation |
|---|---|
| Screenshot harness (`verify-*.mjs`, `__rvSettle`) breaks on smooth scroll | `settleAll` kills the lerp and hard-sets scroll; harness scripts re-run in Phase 4 |
| Retoken misses a hard-coded colour | Grep for `#[0-9a-f]{3,6}` and `rgba(27,26,22` across `src/` — the ink ramp appears inline in several `box-shadow`s |
| Floating labels silently don't float | They require `placeholder=""`; audit every `Input` call site |
| `Bezel` retirement leaves orphan CSS | `.rv-bezel*` rules removed with the component |
| Invalid HTML copied from the reference set | Product card rebuilt with a stretched link, per Phase 2 |

---

## Testing

There is no test runner in `frontend/package.json` — no vitest, no jest. The
existing verification is `tsc -b` plus four ad-hoc Playwright scripts
(`verify-anim.mjs`, `verify-dashboard.mjs`, `verify-gsap.mjs`, `verify-login.mjs`).
This project does not introduce a test framework; that would be its own change.

Verification per phase:

1. `npm run build` (`tsc -b && vite build`) must pass at every checkpoint.
2. Visual pass over each route: home, login, onboarding, dashboard, browse,
   product detail, alerts, legal.
3. `prefers-reduced-motion: reduce` pass — everything renders visible and
   unanimated; no cursor, no smooth scroll.
4. Coarse-pointer pass — no custom cursor, native momentum scroll intact.
5. Keyboard pass on the new interactive components — dropdown roving focus,
   Escape, focus return; accordion and filter `<details>` toggling.
6. Re-run the four `verify-*.mjs` scripts after Phase 4.
7. Contrast re-check on any colour pair not already verified in this document.

---

## Sequencing

Each phase ends at a working, reviewable app.

```
1. Retoken             theme.css, index.css, tailwind.config.cjs      ← cheap direction check
2. Primitives          primitives.tsx, Spinner.tsx, priceViews.tsx,
                       ProductFan.tsx, BrowsePage.tsx, App.tsx
3. New components      6 components + their placements
4. Motion              smoothScroll.ts, Cursor.tsx, motion.ts, App.tsx, main.tsx
```

Phase 1 is the important checkpoint: it is where "full Hyper UI" either looks
right or does not, and it costs one file to find out.

---

## Open questions

1. **`--paper` / `--ground` rename** (Phase 1). The only proposed departure from
   the file's stable-names convention. Justified, but it is a convention break
   and should be an explicit yes.
2. **Bezel's call sites.** Retiring it is proposed; if any use of it is load-
   bearing visually, that should surface at the Phase 2 review.
3. **`.rv-wrow` scope.** Proposed to adopt type and colour but keep its
   horizontal sparkline layout, rather than becoming a grid card. Confirm.
