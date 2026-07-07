# Retro desktop (Windows-95-style) redesign — design

Date: 2026-07-06
Status: Approved (pending spec review)

## Problem

The frontend is mid-flight on an uncommitted glassmorphism + WebGL direction
(`GlassSurface.tsx`, `useGlassBackdrop.ts`, `PriceHistory3D.tsx`, a vendored
`liquid-glass` library, `three`/`@react-three/fiber`/`@react-three/drei`) that is wired
into every page. The user wants a full pivot instead: a "pseudo-retro" Windows-95-style
desktop shell — beveled windows, gradient titlebars, a taskbar — around the real
WasItCheaper product (price tracking, deal scores, watch alerts), with crisp modern
typography so it stays readable and doesn't feel like a novelty skin.

Direction was validated with an iterative HTML mockup (artifact) before any code
changed. Two rounds of feedback were applied and approved:
1. Overall direction + a personalized "quick stats" widget (adapted from a shadcn-style
   reference the user provided — pattern borrowed, not the shadcn scaffolding, since this
   repo doesn't use shadcn/ui).
2. Removed AI-slop tells: no emoji as icons, no soft radial "glow" gradients in the
   background. Icons are small hand-drawn pixel-style SVGs; texture comes from hard-edged
   patterns and hard-offset (0-blur) drop shadows, which is period-accurate anyway.

## Decisions (approved)

- **Color semantics unchanged, values retro.** Blue = brand/CTA (titlebar gradient ends
  on the *existing* `--primary` blue `#2563eb` — one blue, not two systems), green = good
  deal/verified, amber = caution, **red stays error-only** (never repurposed for "price
  went up" or generic emphasis).
- **Whole site**, not just the marketing page: Home, Login, Dashboard, Product detail,
  Alerts, Legal all get the window/titlebar/bevel treatment.
- **Pixel/terminal display font for big titles only** (window titlebars, big headlines,
  the wordmark). A monospace terminal face (VT323) — not Manrope — for those; Manrope
  stays for every price, sentence, and button label. No mixing.
- **Remove the glass/3D work outright**, don't retro-frame it: `GlassSurface`, the
  vendored `liquid-glass` lib, and the WebGL `PriceHistory3D` skyline chart are replaced
  by flat retro equivalents (taskbar nav, 2D step-line charts in beveled windows).
- **No fake urgency/dark patterns.** No "N left!", no coupon codes — this product has
  neither. Badges and status text only ever surface something the deal-math engine
  actually computed (lowest-in-90-days, % below median, last-checked time).
- **No emoji, no soft glow.** Icons are small monochrome pixel-style SVGs (reuse
  `lucide-react`, already a dependency, sized small/monochrome inside titlebars — not
  hand-rolled sprites, that was only needed in the sandboxed mockup). Texture/depth comes
  from bevel borders and hard 0-blur offset shadows, never `filter: blur`/radial glow.

## Scope

**In scope:**
- `frontend/src/theme.css` — repoint existing token *values* to the retro palette; keep
  every token *name* (established convention across every prior redesign in this repo —
  a rename touches dozens of call sites for nothing).
- `frontend/src/primitives.tsx` — remove `GlassBezel`/`GlassButton`; add `RetroWindow`
  (titlebar + `_`/`▢`/`✕` controls + beveled body), `RetroButton` (outset/inset bevel,
  press state), `Taskbar` (Start-style menu button, nav links, real status text).
  `PRIMITIVE_STYLES` gains the new classes, same inject-once-into-head pattern already
  used here.
- All 6 pages (`App.tsx` Dashboard, `HomePage.tsx`, `LoginPage.tsx`,
  `ProductDetailPage.tsx`, `AlertsPage.tsx`, `LegalPage.tsx`) — swap nav chrome for
  `Taskbar`, wrap existing content blocks in `RetroWindow`, swap buttons to `RetroButton`.
  Functional wiring (TanStack Query hooks, OAuth, watch/alert mutations, hash routing)
  is untouched — chrome only.
- New compact **quick-stat widget** (mirrors the mockup's `quick_stats.exe`): trend
  badge + big price + small animated step-line area chart. Used on Dashboard watchlist
  rows and the HomePage. Reuses the **existing step-after path logic** already in the
  2D `PriceHistoryChart` fallback (do not reintroduce a smooth-curve interpolator like
  the pasted reference used — prices are steps, not curves, per the established
  chart-design decision).
- `ProductDetailPage.tsx`'s full price history chart — same step-line data, wrapped in
  a bigger `RetroWindow` instead of the removed 3D skyline view.
- Taskbar status text: **"Last checked <relative time>"**. `Product.last_checked_at`
  already exists on the model (`backend/app/models.py:53`) but isn't exposed on
  `ProductOut` (`backend/app/products_api.py:46`) — add it as one field, no migration,
  no schema change beyond that. Not a "next check" countdown, since that would require
  exposing the beat-schedule internals the API doesn't currently surface. Show what's
  real.
- Incidental fix while touching branding: `index.html` still has stale "Revveal" title/
  meta description and a `<link rel="icon">` pointing at a `revveal-logo.png` that no
  longer exists (broken favicon). Fix to WasItCheaper copy + `wic-logo.svg`.
- `package.json` — remove `three`, `@react-three/fiber`, `@react-three/drei` (no longer
  used once `PriceHistory3D` is deleted); remove the vendored `public/vendor/liquid-glass/`
  + `src/vendor/liquidGlass.ts`/`.d.ts`. Keep `framer-motion` (hover/press micro-motion)
  and `lucide-react` (titlebar icons).
- `index.html` — add a self-hosted-via-Google-Fonts `<link>` for the pixel/terminal
  display face (VT323), alongside the existing Manrope link tag (same mechanism already
  in place, just one more family).

**Out of scope:**
- Any schema/migration change — `last_checked_at` above is a pre-existing column, just
  newly exposed on an existing response model.
- Re-adding any "next check" countdown feature to the API (would need a new endpoint;
  not requested).
- shadcn/ui scaffolding, a `/components/ui` folder, or a Tailwind CSS-variable HSL theme
  — this repo's existing convention (Tailwind utilities + `theme.css` tokens + scoped
  per-page `<style>` blocks via `primitives.tsx`) stays; the pasted reference component's
  *pattern* was reused, not its shadcn plumbing.

## Design reference

Approved mockup (for visual reference during implementation, not shipped code):
`https://claude.ai/code/artifact/c00cdbcb-6db3-4d9d-b6df-42b3b7ebbb30`

## Testing / verification

- `tsc -b` + `eslint .` clean.
- Playwright screenshots (matching this repo's existing `frontend/scripts/shoot*.mjs`
  pattern): all 6 surfaces at desktop/tablet/mobile, the bento-grid → single-column
  collapse below ~720px, reduced-motion (content visible, not scroll-gated — see the
  2026-06-17 lesson already documented in project memory), mobile taskbar/nav state.
- Manual: confirm no `GlassSurface`/`liquidGlass`/`PriceHistory3D`/`three` imports remain
  (`grep` before deleting files, as done in the 2026-07-02 `theme.ts` deletion); confirm
  bundle size drops after removing the three.js family of deps. Note:
  `priceHistoryGeometry.ts` is shared with the 2D `PriceHistoryChart`
  (`computeStepSegments`) and must NOT be deleted — only `PriceHistory3D.tsx` itself goes.
- Confirm color semantics hold end-to-end: a real price rise renders amber, never red; a
  real drop renders green; red only appears on an actual error state.

## Risks & mitigations

- **Bevel/titlebar chrome at small sizes (mobile)** — titlebar controls (`_`/`▢`/`✕`) are
  decorative on stacked mobile cards (no real window management); keep them but make
  them non-interactive there, matching the mockup's mobile note.
- **VT323 legibility** — restricted to titlebars/big headlines only (already decided);
  if a specific heading reads poorly at small sizes, fall back to Manrope for that
  instance rather than shrinking the pixel face further.
- **Removing three.js family** — confirm zero remaining imports via grep before deleting
  `PriceHistory3D.tsx`/`priceHistoryGeometry.ts` and the vendor folder, same discipline
  used for the prior `theme.ts` deletion.

## Future (not now)
A real "next check" countdown would need a small API surface (e.g. expose the beat
schedule's next run per product); not pursued here since taskbar status already has a
truthful value (last-checked) without it.
