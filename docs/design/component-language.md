# Component language — Bibek's reference set

Bibek supplied these components as the taste target for WasItCheaper. They are
Hyper UI / Tailwind patterns. This file is the durable record: what was chosen,
what the shared vocabulary is, and where each pattern lands in this app.

Status: **catalogued, not yet implemented.** Nothing below is in the codebase
except where the "In this app today" line says so.

Last updated 2026-09-10.

---

## Decisions locked so far

| Decision | Answer | Consequence |
|---|---|---|
| Typography | Plus Jakarta Sans (body/UI), Urbanist (display + figures) | **Done** — swapped in `theme.css`, `index.html`, `tailwind.config.cjs` |
| Palette | **Full Hyper UI** — white cards, gray borders, blue/indigo/emerald accents | `theme.css`'s warm-paper system is replaced, not adapted |
| New components | **Build and place** them in real screens | Not a detached component library |
| Approach | Retoken, then rebuild the vocabulary (Approach C) | Pending confirmation |

### What the palette decision costs

The existing `theme.css` documents a system this replaces. Recorded here so the
reversal is deliberate rather than accidental:

- **"Green is the one loud color"** — green meant *a genuine, verified price
  drop* and nothing else. Hyper UI uses emerald decoratively (a "Paid" badge),
  so this rule ends.
- **"The CTA is achromatic on purpose"** — the primary button was ink, not a
  brand hue, specifically so green stayed meaningful. Ends with the above.
- **Warm paper canvas** (`#f4f3ef`), the fixed light-source gradient, and the
  `.rv-gridded` plotter substrate — all replaced by white/gray-50.
- `Bezel` (nested-radius shell) has no Hyper UI equivalent and retires.

---

## The shared vocabulary

Derived from the thirteen pasted components. These are the constants — match
them when building anything new, so additions read as part of the same set.

**Color**

```
surface        bg-white
page           bg-gray-50            (zebra rows: *:even:bg-gray-50)
border         border-gray-100       cards, stat tiles, product cards
               border-gray-200       accordions, button groups
               border-gray-300       dropdowns, filter popovers, inputs
text           text-gray-900         headings, figures
               text-gray-700         body, default control text
               text-gray-600         de-emphasised (strikethrough prices)
               text-gray-500         labels, captions
accent         blue-600 / blue-100   informational, icon wells
               indigo-600            loading
positive       emerald-700 on emerald-100   ·   outline: border-emerald-500
               green-700/800 on green-50    (toasts)
caution        amber-700 on amber-100       ·   outline: border-amber-500
danger         red-700 on red-100           ·   outline: border-red-500
               red-700 hover:bg-red-50      (destructive menu items)
```

**Shape**

```
rounded-full   badges, icon buttons, timeline dots, icon wells
rounded-lg     accordion summaries, stat cards
rounded-md     toasts
rounded        dropdowns, filter popovers, inputs
rounded-sm     button-group ends, product-card CTAs
(square)       product card body — border only, no radius
shadow-sm      dropdowns, popovers, toasts, inputs
```

**Type**

```
text-sm        the default for controls, badges, body
text-xs        stat-card deltas, timeline dates (text-xs/none)
text-lg        card headings — font-medium or font-bold
text-2xl       the figure in a stat card — font-medium
font-medium    the workhorse weight for anything interactive
```

**Motion**

```
transition-colors                        links, menu items, buttons
transition-transform duration-300        chevrons
group-open:-rotate-180                   accordion / filter disclosure
hover:scale-105                          product-card CTAs
duration-500 group-hover:scale-105       product-card image zoom
```

**Icons** — Heroicons 24 outline, `stroke-width="1.5"`, always
`aria-hidden="true"`. Sizes: `size-4` inline with text, `size-5` in summaries
and menus, `size-8` in stat-card wells.

**Accessibility patterns worth preserving** — `role="alert"` on toasts,
`role="status"` on loaders, `role="menu"`/`role="menuitem"` on dropdowns,
`aria-label="Breadcrumb"` on the nav, `sr-only` text behind icon-only buttons
and behind stat-card trend arrows ("Increase: ", "Decrease: "),
`[&_summary::-webkit-details-marker]:hidden` on every `<details>`,
`rtl:rotate-180` on directional chevrons.

---

## The catalogue

### 1. Badge

Pill, icon + label, two variants: solid tint and outline. Semantics are
Paid / Refunded / Failed.

```html
<!-- solid -->
<span class="inline-flex items-center justify-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-emerald-700">
  <svg aria-hidden="true" ... class="-ms-1 me-1.5 size-4"> <!-- check-circle --> </svg>
  <p class="text-sm whitespace-nowrap">Paid</p>
</span>

<!-- outline -->
<span class="inline-flex items-center justify-center rounded-full border border-emerald-500 px-2.5 py-0.5 text-emerald-700">
```

Icons: emerald = check-circle · amber = receipt-refund · red = exclamation-triangle.

**In this app today:** `Stamp` in `primitives.tsx:101` — same role
(signal/caution/quiet), no icon, `box-shadow: inset 0 0 0 1px` instead of a
border. Gets rebuilt with the icon slot and both variants.

**Lands on:** lowest-in-90d / price-rise / extraction-failed flags on product
detail, browse cards, and watchlist rows.

---

### 2. Accordion

`<details>` + `<summary>`, no JS. Icon on the left, chevron on the right that
rotates on open.

```html
<div class="space-y-2">
  <details class="group [&_summary::-webkit-details-marker]:hidden">
    <summary class="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 font-medium text-gray-900 hover:bg-gray-50">
      <span class="flex items-center gap-2">
        <svg aria-hidden="true" ... class="size-5"></svg>
        Getting Started
      </span>
      <svg aria-hidden="true" class="size-5 shrink-0 transition-transform duration-300 group-open:-rotate-180" ...>
        <path stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </summary>
    <div class="p-4"><p class="text-gray-700">…</p></div>
  </details>
</div>
```

**In this app today:** does not exist.

**Lands on:** the score explainer's four components (currently a scrubbed
GSAP timeline), and the legal pages' sections.

---

### 3. Breadcrumbs

```html
<nav aria-label="Breadcrumb">
  <ol class="flex items-center gap-1 text-sm text-gray-700">
    <li><a href="#" class="block transition-colors hover:text-gray-900" aria-label="Home">
      <svg aria-hidden="true" class="size-4"> <!-- home --> </svg>
    </a></li>
    <li class="rtl:rotate-180"><svg aria-hidden="true" class="size-4" viewBox="0 0 20 20" fill="currentColor"> <!-- chevron-right, solid --> </svg></li>
    <li><a href="#" class="block transition-colors hover:text-gray-900">Category</a></li>
    <!-- separator, then leaf -->
  </ol>
</nav>
```

Note the separators are solid 20-viewBox icons while the home icon is a
24-viewBox outline — keep that as-is, it is what makes the chevrons read
lighter than the links.

**In this app today:** does not exist — product detail has a bare `onBack`.

**Lands on:** product detail (`Home / <category> / <product>`), replacing the
back button, and browse when a category filter is active.

---

### 4. Button group

Segmented, joined by `-ms-px`, rounded only on the ends.

```html
<div class="inline-flex">
  <button class="rounded-s-sm border border-gray-200 px-3 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:z-10 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white focus:outline-none disabled:pointer-events-auto disabled:opacity-50">View</button>
  <button class="-ms-px border border-gray-200 …">Edit</button>
  <button class="-ms-px rounded-e-sm border border-gray-200 …">Delete</button>
</div>
```

The focus treatment (`focus:z-10` + offset ring) is the detail that makes it
work — keep it.

**In this app today:** `.rv-seg-btn` (`chartUI.tsx:167`) and `.rv-window-btn`
(`ProductDetailPage.tsx:525`) — same idea, house styling.

**Lands on:** the chart range switcher (7D / 30D / 90D / 1Y).

---

### 5. Stat card

```html
<article class="rounded-lg border border-gray-100 bg-white p-6">
  <div class="flex items-center justify-between">
    <div>
      <p class="text-sm text-gray-500">Profit</p>
      <p class="text-2xl font-medium text-gray-900">$240.94</p>
    </div>
    <span class="rounded-full bg-blue-100 p-3 text-blue-600">
      <svg aria-hidden="true" class="size-8" stroke-width="2"> <!-- … --> </svg>
    </span>
  </div>
  <div class="mt-1 flex gap-1 text-green-600">   <!-- or text-red-600 -->
    <svg aria-hidden="true" class="size-4"> <!-- trend arrow --> </svg>
    <span class="sr-only">Increase: </span>
    <p class="flex gap-2 text-xs">
      <span class="font-medium">67.81%</span>
      <span class="text-gray-500">Since last week</span>
    </p>
  </div>
</article>
```

Anatomy: label / figure / icon well, then a trend row. Direction is carried by
`text-green-600` vs `text-red-600` plus the arrow, with `sr-only` text so it
isn't colour-only.

**In this app today:** no direct equivalent; closest is the dashboard's
summary figures.

**Lands on:** the dashboard header — tracked items, active alerts, total saved,
biggest drop. This is the strongest fit of anything in the set.

---

### 6. Toast

```html
<div role="alert" class="rounded-md border border-green-500 bg-green-50 p-4 shadow-sm">
  <div class="flex items-start gap-4">
    <svg aria-hidden="true" class="-mt-0.5 size-6 text-green-700"> <!-- check-circle --> </svg>
    <div class="flex-1">
      <strong class="block leading-tight font-medium text-green-800">Success</strong>
      <p class="mt-0.5 text-sm text-green-700">…</p>
    </div>
  </div>
</div>
```

**In this app today:** does not exist — track-job outcomes surface inline.

**Lands on:** track-URL success/failure, alert saved, watch removed. Needs a
host (a stack container + a `useToast` hook); that is new infrastructure, not
just a component.

---

### 7. Details list

```html
<div class="flow-root">
  <dl class="-my-3 divide-y divide-gray-200 text-sm *:even:bg-gray-50">
    <div class="grid grid-cols-1 gap-1 p-3 sm:grid-cols-3 sm:gap-4">
      <dt class="font-medium text-gray-900">Title</dt>
      <dd class="text-gray-700 sm:col-span-2">Mr</dd>
    </div>
    <!-- … -->
  </dl>
</div>
```

Stacks on mobile, 1/3–2/3 split from `sm`. Zebra via `*:even:`.

**In this app today:** `.rv-ptable` (`priceViews.tsx`) is a real `<table>`.

**Lands on:** product detail's spec/metadata block (store, category, first
seen, readings, coverage). The price *history* stays a table — it is tabular
data and a `<dl>` would be the wrong element.

---

### 8. Split dropdown

```html
<div class="relative inline-flex">
  <span class="inline-flex divide-x divide-gray-300 overflow-hidden rounded border border-gray-300 bg-white shadow-sm">
    <button type="button" class="px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:relative">Product</button>
    <button type="button" aria-label="Menu" class="… focus:relative"><svg class="size-4"> <!-- chevron-down --> </svg></button>
  </span>
  <div role="menu" class="absolute end-0 top-12 z-auto w-56 divide-y divide-gray-200 overflow-hidden rounded border border-gray-300 bg-white shadow-sm">
    <div>
      <p class="block px-3 py-2 text-sm text-gray-500">General</p>
      <a href="#" role="menuitem" class="block px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900">Storefront</a>
    </div>
    <div>
      <p class="block px-3 py-2 text-sm text-gray-500">Actions</p>
      <button type="button" class="block w-full px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 ltr:text-left rtl:text-right">Delete</button>
    </div>
  </div>
</div>
```

Grouped with labelled sections; destructive action is red and last.

**In this app today:** does not exist.

**Lands on:** the per-row actions on watchlist rows (View / Re-check / Set
alert / Stop tracking), and the account menu in `TopBar`.

**Note:** as pasted, the menu is always open and has no keyboard handling.
Needs open state, outside-click, Escape, and arrow-key roving focus.

---

### 9. Filter popover

`<details>`-based, anchored via `group-open:absolute`. Two kinds shown:
a checkbox set and a min/max numeric range, each with a count and a Reset.

```html
<details class="group relative">
  <summary class="flex items-center gap-2 border-b border-gray-300 pb-1 text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900 [&::-webkit-details-marker]:hidden">
    <span class="text-sm font-medium">Availability</span>
    <span class="transition-transform group-open:-rotate-180"><svg class="size-4"> <!-- chevron-down --> </svg></span>
  </summary>
  <div class="z-auto w-64 divide-y divide-gray-300 rounded border border-gray-300 bg-white shadow-sm group-open:absolute group-open:start-0 group-open:top-8">
    <div class="flex items-center justify-between px-3 py-2">
      <span class="text-sm text-gray-700">0 Selected</span>
      <button type="button" class="text-sm text-gray-700 underline transition-colors hover:text-gray-900">Reset</button>
    </div>
    <fieldset class="p-3"> <!-- legend.sr-only + labels with size-5 checkboxes --> </fieldset>
  </div>
</details>
```

**In this app today:** browse has filters (`.rv-filter-input`), not popovers.

**Lands on:** browse — category (checkboxes) and price range (min/max).
The summary's `border-b` underline treatment is the signature here.

---

### 10. Floating-label input

```html
<label for="Email" class="relative">
  <input type="email" id="Email" placeholder=""
         class="peer mt-0.5 w-full rounded border-gray-300 shadow-sm sm:text-sm" />
  <span class="absolute inset-y-0 start-3 -translate-y-5 bg-white px-0.5 text-sm font-medium text-gray-700 transition-transform peer-placeholder-shown:translate-y-0 peer-focus:-translate-y-5">
    Email
  </span>
</label>
```

Depends on `placeholder=""` being present and empty — that is what
`peer-placeholder-shown` keys off. The `bg-white px-0.5` is what notches the
label into the border.

**In this app today:** `.rv-input` / `.rv-filter-input` (`primitives.tsx:529`),
conventional label-above.

**Lands on:** login, the paste-a-URL box, alert thresholds.

---

### 11. Loading

```html
<div class="text-center" role="status">
  <svg class="mx-auto size-8 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
  <p class="mt-4 font-medium text-gray-700">Loading...</p>
</div>
```

**In this app today:** `Spinner.tsx` (framer-motion). Gets replaced by this
CSS-only version.

---

### 12. Timeline

Alternating left/right around a centre rail, built from `before:` on the `<ol>`
and `group-odd:` / `group-even:` on each `<li>`.

```html
<ol class="relative space-y-8 before:absolute before:top-0 before:left-1/2 before:h-full before:w-0.5 before:-translate-x-1/2 before:rounded-full before:bg-gray-200">
  <li class="group relative grid grid-cols-2 odd:-me-3 even:-ms-3">
    <div class="relative flex items-start gap-4 group-odd:flex-row-reverse group-odd:text-right group-even:order-last">
      <span class="size-3 shrink-0 rounded-full bg-blue-600"></span>
      <div class="-mt-2">
        <time class="text-xs/none font-medium text-gray-700">12/02/2025</time>
        <h3 class="text-lg font-bold text-gray-900">Kickoff</h3>
        <p class="mt-0.5 text-sm text-gray-700">…</p>
      </div>
    </div>
    <div aria-hidden="true"></div>
  </li>
</ol>
```

**In this app today:** does not exist.

**Lands on:** a product's price-event history — first seen, each drop/rise,
lowest-ever, alert fired. Dot colour can carry direction (drop / rise / neutral).

**Note:** two-column alternation needs a single-column fallback below `sm`.

---

### 13. Product card

The most directly applicable component in the set — this app *is* a product
price tracker.

```html
<a href="#" class="group relative block overflow-hidden">
  <button class="absolute end-4 top-4 z-10 rounded-full bg-white p-1.5 text-gray-900 transition hover:text-gray-900/75">
    <span class="sr-only">Wishlist</span>
    <svg aria-hidden="true" class="size-4"> <!-- heart --> </svg>
  </button>

  <img src="…" alt="" class="h-64 w-full object-cover transition duration-500 group-hover:scale-105 sm:h-72" />

  <div class="relative border border-gray-100 bg-white p-6">
    <p class="text-gray-700">
      $49.99
      <span class="text-gray-600 line-through">$80</span>
    </p>
    <h3 class="mt-1.5 text-lg font-medium text-gray-900">Wireless Headphones</h3>
    <p class="mt-1.5 line-clamp-3 text-gray-700">…</p>
    <form class="mt-4 flex gap-4">
      <button class="block w-full rounded-sm bg-gray-100 px-4 py-3 text-sm font-medium text-gray-900 transition hover:scale-105">Add to Cart</button>
      <button type="button" class="block w-full rounded-sm bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:scale-105">Buy Now</button>
    </form>
  </div>
</a>

```

Anatomy worth keeping:

- `group` + `overflow-hidden` on the anchor, `duration-500 group-hover:scale-105`
  on the image — the zoom is clipped by the card.
- The corner icon button is `absolute … z-10` and sits **above** the anchor.
- **`$49.99` beside a struck-through `$80`** — this is exactly the current-price
  vs was-price pattern this product exists to show.
- Secondary CTA `bg-gray-100`, primary `bg-gray-900 text-white`, equal width.

**Careful:** a `<button>` inside an `<a>` is invalid HTML and the pasted markup
does it twice. Rebuild as a `<div class="group relative">` with a stretched-link
overlay, so the wishlist and CTA buttons stay real buttons.

**In this app today:** three separate card surfaces —

| Surface | Where | Notes |
|---|---|---|
| `.rv-fan-card` | `ProductFan.tsx`, homepage deals | GSAP-animated fan; card *shape* changes, fan choreography stays |
| `.rv-wrow` | `App.tsx` dashboard watchlist | horizontal row w/ sparkline — a list, not a grid; adopt type + colour only |
| browse grid | `BrowsePage.tsx:212` | the natural home for this card verbatim |

**Mapping:** wishlist heart → track/untrack · `$49.99` / `$80` → current vs
previous · "Add to Cart" / "Buy Now" → "Set alert" / "View history".

---

## Open questions

- **Approach C confirmation** — retoken `theme.css`, then rebuild the primitive
  vocabulary, then build and place the six new components, then the GSAP motion
  pass (cursor, inertial scroll, page transitions).
- **Dark mode** — none of the pasted components define one. Assumed light-only
  unless stated otherwise.
- **Charts** — `charts.tsx` colours lines from `--ink` / `--green`. Retokening
  recolours them automatically; whether that is the *wanted* chart palette is
  unaddressed.
