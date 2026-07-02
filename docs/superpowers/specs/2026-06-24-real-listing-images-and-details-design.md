# Real listing images + full detail surfaces — design

Date: 2026-06-24
Status: Approved (pending spec review)

## Problem

Every car in the UI currently shows one of **4 recycled brand photos** (Mustang /
silver Mustang / Challenger / chrome detail) via `thumbFor(i)` in `frontend/src/images.ts`
— the photo has nothing to do with the actual car. The `Listing` model stores **no
image**, and the Craigslist scraper never captures one. Listings also expose only a
compact subset of their fields in the UI.

Goal: each car shows **its own real photo**, and the **full detail set** is viewable.

## Decisions (approved)

- **A — Image serving: hotlink now.** Store the `images.craigslist.org` URL and
  `<img>`-render it directly with a neutral placeholder fallback. Re-hosting (download +
  self-serve) is deferred to a future phase.
- **B — Detail page: best-effort gallery.** Store up to 8 gallery URLs; show a gallery on
  the detail page, falling back to the single primary photo when only one exists.
- **C — Demo safety net: seed fallback.** If a live scrape returns nothing in this
  environment, seed a small set of real listings (with stable, real, license-clear photo
  URLs) so the feature is demonstrable. Live scraping remains the primary path.

## Scope

**In scope (per-car images become real):**
- Deals table rows (HomePage public catalog + Dashboard results in `App.tsx`)
- Hero "Top pick" spotlight thumbnail (HomePage)
- Expandable row detail (both surfaces)
- New dedicated detail page per listing

**Out of scope (intentionally unchanged):**
- Brand art direction: full-bleed Mustang hero, Challenger CTA band, login-panel photo
  (`IMAGES.heroFeature` / `bandFeature` / `loginFeature` / `detailChrome`). These are
  deliberate, not fake per-car images.
- Re-hosting/optimizing remote images; persisting saved/favorite deals to the backend.

## Backend

### Model — `backend/app/models.py`
Add two nullable columns to `Listing`:
- `image_url: str | None` — primary photo (hotlinked Craigslist URL).
- `image_urls: list[str] | None` — gallery, JSONB, best-effort.

Use `from sqlalchemy.dialects.postgresql import JSONB` for `image_urls`.

### Migration — `backend/alembic/versions/004_listing_images.py`
Mirror the existing `002`/`003` style. `upgrade`: `add_column` both (nullable, no
backfill). `downgrade`: drop both.

### Scraper — `backend/app/scraper_craigslist.py`
The detail page is already fetched in `_enrich_with_detail`. Add
`_parse_images(detail) -> tuple[str | None, list[str] | None]`:
- **Primary**: `<meta property="og:image" content="...">` (Craigslist's reliable
  server-rendered primary image).
- **Gallery**: full-size hrefs from the static thumbnail strip
  (`#thumbs a.thumb[href]`, fall back to `.gallery a[href]` / `img[src*="images.craigslist"]`),
  deduped, capped at 8, primary first.
- Both **best-effort**: any failure → `None`. A listing never fails because of images.

Add `image_url` + `image_urls` to the returned dict and update the module-docstring
contract (both optional). The exact selectors must be **verified against a live detail
page** during implementation and the test **fixtures updated** with real image markup
(current fixtures are text-only).

### Persist — `backend/app/tasks.py`
Pass `image_url=item.get("image_url")` and `image_urls=item.get("image_urls")` into the
`Listing(...)` constructor (~line 61).

### API schema — `backend/app/main.py`
Add `image_url: Optional[str] = None` and `image_urls: Optional[list[str]] = None` to the
`Deal` Pydantic model (and to `get_deal`'s `Deal` response — same model). `from_attributes`
already set, so values flow automatically. Bump API version.

## Frontend

### Types — `frontend/src/api.ts`
Add `image_url?: string | null` and `image_urls?: string[] | null` to the listing type
(`ApiListing`/`Deal`).

### Image rendering — `frontend/src/CarImage.tsx` + `images.ts`
- `CarImage` accepts a possibly-remote `src`. Add `onError` → swap to a neutral
  **placeholder** (minimal car-silhouette SVG on a paper-tone tile), defined once in
  `images.ts` (e.g. `PLACEHOLDER`/`CarSilhouette`).
- Add `referrerpolicy="no-referrer"` + `loading="lazy"` to hotlinked `<img>` (improves
  Craigslist hotlink success and avoids leaking the visitor's referrer).
- **Retire `thumbFor(i)` for real listings.** It remains only for curated-sample/empty
  states. A listing renders `image_url`, else the placeholder — never the muscle-car thumbs.

### Helper — `frontend/src/hooks.ts`
Add `useDeal(id)` calling `GET /deals/{id}` (key `queryKeys.deals.detail(id)`).

### Expandable rows (both surfaces)
- `HomePage.tsx`: extend `DealRow` + `liveToRow` to carry `image` (= `image_url`). The
  existing `expanded` state opens a row in place showing the photo + **all** fields:
  title, description, listed vs **predicted** price, undervalue %, year/make/model,
  mileage, location, posted date, source, **"View original →"** (`url`), and a link to the
  detail page.
- `App.tsx` (Dashboard): add the same expandable behavior to the results table; row thumb
  uses `image_url` (placeholder fallback) instead of `thumbFor(i)`.

### Detail page — `frontend/src/DealDetailPage.tsx` (new)
- Hash route `#/deal/:id`, reachable from both catalogs.
- Renders large primary image + gallery (`image_urls`) when present (else primary only),
  the full field set, the price/undervalue breakdown, and the outbound original link.
- Uses the existing scoped `.rv-*` warm-light styling + `theme.ts` tokens; Manrope body,
  Source Serif display headline. Reuses `CarImage`.

### Routing — `frontend/src/App.tsx`
Add `#/deal/<id>` to the existing hash-routing page selection so the detail page renders
for both guests and signed-in users. Back link returns to the catalog/dashboard.

### Sample / empty states
When `/deals` is empty, curated samples (`FEATURED`/`HERO_LOTS`) render with the **neutral
placeholder** (not the brand `THUMBS`) so they are never mistaken for real scraped cars.
In practice the seed fallback (Decision C) keeps the DB non-empty, so this path is rare.

## Data population

1. After wiring image capture, run a **live scrape** via `POST /scrape/craigslist`
   (existing Celery job) for a city + query to fill the DB with real cars + photos.
2. **Seed fallback** (Decision C): `backend/scripts/seed_listings.py` inserts ~6–8 real
   listings with stable, real, license-clear photo URLs (e.g., Wikimedia Commons) when the
   live scrape yields nothing. Idempotent (skip existing `url`). Documented run command.

## Testing / verification

- **Backend**: extend `backend/tests/test_scraper_craigslist.py` with image-extraction
  cases (real image markup added to fixtures); migration applies cleanly; `/deals` and
  `/deals/{id}` return the new fields. Run `cd backend && pytest`.
- **Frontend**: `npm run build` (tsc -b + vite) + `npm run lint` clean. Playwright
  screenshots of: deals table with real images, an expanded row, the detail page (gallery
  + single-image cases), and the **placeholder fallback** (broken/missing image).
- **Live in Docker**: rebuild backend/worker, run a scrape, confirm real per-car images +
  full details on the page; if empty, run the seed and confirm.

## Risks & mitigations

- **Live scrape blocked/empty here** → seed fallback (Decision C).
- **Craigslist image markup differs from assumption** → selectors verified against a live
  page; fixtures updated; extraction is best-effort so a miss degrades to placeholder.
- **Hotlinked images expire/blocked** → `onError` placeholder + `referrerpolicy=no-referrer`;
  re-hosting documented as the future-phase fix.

## Future (not now)
Re-host images to object storage; resize/optimize remote images; persist saved deals;
richer ML-driven `predicted_price` (Phase 6) feeding the undervalue breakdown.
