# Car Deal Finder AI — Project Context

## What This App Does

A full-stack web application that finds undervalued used car deals. It scrapes marketplace listings (starting with Craigslist), predicts fair market prices, calculates discount percentages, and surfaces the best deals through a filtered, sortable UI.

The scraping pipeline runs **asynchronously** on Celery workers backed by Redis, so the API stays responsive while a background worker fetches and persists listings to PostgreSQL. Authenticated users (JWT, bcrypt-hashed passwords) hit rate-limited endpoints; the worker is fronted by a 5/minute limit per IP.

---

## Project Structure

```
car-deal-finder/
├── backend/
│   ├── .venv/                         Python virtual environment (local dev only)
│   ├── alembic/
│   │   ├── env.py                     Alembic env — async engine + autogenerate setup
│   │   ├── script.py.mako             Migration script template
│   │   └── versions/
│   │       ├── 001_initial_schema.py  Initial `listings` table migration
│   │       └── 002_users_table.py     `users` table migration
│   ├── alembic.ini                    Alembic config
│   ├── app/
│   │   ├── __init__.py                Empty package marker
│   │   ├── main.py                    FastAPI app, endpoints, Pydantic schemas
│   │   ├── settings.py                Pydantic Settings — env-driven config
│   │   ├── db.py                      Async + sync SQLAlchemy engines, get_db dep
│   │   ├── models.py                  SQLAlchemy ORM (Listing, User)
│   │   ├── auth.py                    /auth router + get_current_user dependency
│   │   ├── security.py                Password hashing (bcrypt) + JWT encode/decode
│   │   ├── limiter.py                 slowapi Limiter instance (shared)
│   │   ├── celery_app.py              Celery instance — Redis broker + result backend
│   │   ├── tasks.py                   Celery tasks (scrape_craigslist_task)
│   │   └── scraper_craigslist.py      Craigslist scraper (real httpx + BeautifulSoup)
│   ├── tests/
│   │   ├── fixtures/                  Saved Craigslist HTML (search + detail pages)
│   │   └── test_scraper_craigslist.py Offline unit tests for the scraper
│   ├── Dockerfile                     Backend image (Python 3.12-slim)
│   ├── pytest.ini                     Pytest config (testpaths + pythonpath)
│   ├── requirements.txt               Python dependencies
│   └── requirements-dev.txt           Test-only deps (pytest) — includes requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                    Auth-derived page selection + Dashboard
│   │   ├── HomePage.tsx               Landing page w/ adaptive nav theme
│   │   ├── LoginPage.tsx              Real login/register form via TanStack mutations
│   │   ├── CarGlyphs.tsx              Car-themed SVG primitives (gauge, odometer, plate, tire, silhouette)
│   │   ├── api.ts                     Raw fetchers + token storage + UnauthorizedError
│   │   ├── queryClient.ts             Shared QueryClient + global 401 handler
│   │   ├── queryKeys.ts               Central query-key factory
│   │   ├── hooks.ts                   useMe / useLogin* / useDeals / useScrape* hooks
│   │   ├── api/deals.ts               Deprecated duplicate, unused
│   │   ├── main.tsx                   React root + QueryClientProvider + Devtools (dev only)
│   │   ├── App.css                    Component styles (mostly unused, Tailwind primary)
│   │   ├── index.css                  Global Tailwind directives
│   │   └── assets/                    Static assets
│   ├── index.html                     HTML shell
│   ├── vite.config.ts                 Vite config
│   ├── tsconfig*.json                 TS project references / app / node configs
│   ├── eslint.config.js               ESLint rules
│   └── package.json                   Frontend deps + build scripts
│
├── docker-compose.yml                 Postgres + Redis + backend + worker
├── .vscode/settings.json              VS Code workspace settings
├── .claude/settings.local.json        Claude Code permissions config
├── context.md                         This file
└── README.md                          Project docs
```

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend framework | React | 19.2.0 | UI |
| Build tool | Vite | 7.2.4 | Dev server + bundler |
| Language (frontend) | TypeScript | 5.9.3 | Types |
| Styling | Tailwind CSS | 3.4.18 | Utility-first CSS |
| HTTP (frontend) | Native Fetch API | — | Wrapped in `apiFetch` for auth + 401 |
| Server-state | @tanstack/react-query | 5.62 | Caching, polling, invalidations, mutations |
| React Query Devtools | @tanstack/react-query-devtools | 5.62 | Dev-only; toggled in `main.tsx` via `import.meta.env.DEV` |
| Backend framework | FastAPI | 0.122.0 | REST API |
| ASGI server | Uvicorn | 0.38.0 | Hot-reload dev server |
| ORM | SQLAlchemy | 2.0.44 | Async + sync engines |
| Async DB driver | asyncpg | 0.30.0 | Used by FastAPI handlers |
| Sync DB driver | psycopg2-binary | 2.9.10 | Used by Celery tasks (asyncpg is async-only) |
| Migrations | Alembic | 1.14.0 | Schema versioning |
| Validation | Pydantic | 2.12.5 | Schemas |
| Settings | pydantic-settings | 2.7.0 | `.env`-driven config |
| Scraping | BeautifulSoup4 | 4.14.2 | HTML parsing (real scraper TBD) |
| HTTP (backend) | httpx | 0.28.1 | For future scraper requests |
| Task queue | Celery | 5.4.0 | Background scrape jobs |
| Broker / result backend | Redis | 7-alpine (image) / redis-py 5.2.1 | Celery transport |
| Database | PostgreSQL | 16-alpine (image) | Primary store |
| Auth | python-jose 3.5.0, passlib[bcrypt] 1.7.4 | — | JWT (HS256) + bcrypt password hashing |
| Rate limiting | slowapi 0.1.9 | — | IP-based limits per endpoint, headers exposed |
| Email validation | pydantic[email] / email-validator | 2.12.5 | EmailStr validation on register/login |
| Config (frontend) | `VITE_API_URL` env var | — | Switch API base between dev / prod |

Planned deployment: **Vercel** (frontend) + **Railway** or **Fly.io** (backend + worker + Postgres + Redis).

---

## Database Schema

Two tables, both managed by **Alembic** (no `Base.metadata.create_all` at startup — `alembic upgrade head` runs in the backend container's entrypoint).

### `listings`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key, auto-generated |
| `source` | String | Marketplace, e.g. `"craigslist"` |
| `url` | String | Listing URL — UNIQUE (dedup key) |
| `title` | String | Listing headline |
| `description` | Text | Full description (nullable) |
| `listed_price` | Integer | Asking price USD |
| `predicted_price` | Integer | AI/heuristic fair market price |
| `undervalue_percent` | Float | `(predicted − listed) / predicted × 100` — indexed |
| `year` | Integer | Vehicle year |
| `make` | String | Indexed |
| `model` | String | Model name |
| `mileage` | Integer | Nullable |
| `location` | String | Geographic location |
| `created_at` | DateTime(tz) | Row insertion — indexed |
| `posted_at` | DateTime(tz) | Listing publication |

Indexes: `undervalue_percent`, `make`, `created_at`. Unique constraint on `url`.

### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key, auto-generated |
| `email` | String | UNIQUE, indexed |
| `hashed_password` | String | bcrypt hash via passlib |
| `is_active` | Boolean | Defaults to `true` |
| `created_at` | DateTime(tz) | Row insertion |

---

## API Endpoints

Base URL (dev): `http://localhost:8000`

All endpoints below are rate-limited per IP via slowapi. Limits are enforced via `SlowAPIMiddleware`; `RateLimitExceeded` returns HTTP 429 with `Retry-After`. Default limit (when not overridden): **200/minute**.

### Auth (public except `/me`)

| Method + path | Limit | Body | Returns |
|---|---|---|---|
| `POST /auth/register` | **5/minute** | `{ email, password }` (password ≥ 8 chars) | `UserOut` (201). 409 if email exists |
| `POST /auth/login` | **10/minute** | `{ email, password }` | `{ access_token, token_type: "bearer" }`. 401 on bad creds |
| `GET /auth/me` | default | — | `UserOut` (requires `Authorization: Bearer ...`) |

JWT details: HS256, 24h expiry (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`), `sub` = user UUID. Login uses a lazy "dummy hash" to equalize bcrypt timing between "user not found" and "wrong password" — mitigates email enumeration via response timing.

### `GET /health`
Health check. Returns `{ "status": "ok", "service": "car-deal-finder-api" }`.

### `GET /deals` — limit **60/minute**
Fetch filtered deals from DB, sorted by `undervalue_percent DESC`.

| Query param | Type | Default | Description |
|-------------|------|---------|-------------|
| `min_undervalue_percent` | float | `15.0` | Minimum discount threshold |
| `make` | string | — | Filter by make (case-insensitive `ILIKE`) |
| `model` | string | — | Filter by model (case-insensitive `ILIKE`) |
| `location` | string | — | Substring match |

Returns: JSON array of `Deal` objects.

### `GET /deals/{deal_id}`
Get a single listing by UUID. Returns 404 if not found.

### `POST /scrape/craigslist`  →  HTTP **202 Accepted** — limit **5/minute**, **auth required**
**Enqueues** a Celery scrape task; returns immediately with a job id. Does NOT wait for the scrape to complete. Requires `Authorization: Bearer ...`.

| Query param | Type | Default | Description |
|-------------|------|---------|-------------|
| `city` | string | required | City slug, e.g. `"austin"` |
| `query` | string | required | Search term, e.g. `"honda civic"` |
| `max_results` | int | `10` | Max listings to fetch |

Returns:
```json
{ "job_id": "uuid", "status": "queued", "city": "austin", "query": "honda civic", "max_results": 10 }
```

### `GET /scrape/jobs/{job_id}` — limit **120/minute**, **auth required**
Poll Celery task state. Returns one of:

```json
{ "job_id": "...", "state": "PENDING|STARTED|PROGRESS|RETRY|SUCCESS|FAILURE",
  "progress": { "stage": "scraping" | "persisting", ... } | null,
  "result":   { "city": "...", "query": "...", "fetched": N, "inserted": N, "skipped": N } | null,
  "error":    "..." | null }
```

Custom `PROGRESS` state is emitted by `scrape_craigslist_task.update_state(...)` at each pipeline stage.

---

## Core Business Logic

### Auth Flow (Phase 4)

```
Register
  → POST /auth/register { email, password ≥ 8 }
  → bcrypt hash (passlib) → INSERT into users
  → 201 with UserOut

Login
  → POST /auth/login { email, password }
  → SELECT users WHERE email = ?
  → verify_password (bcrypt); on miss, run dummy hash to equalize timing
  → jose.jwt.encode { sub: user.id, exp: now+24h } HS256
  → 200 { access_token, token_type: "bearer" }

Protected request
  → Authorization: Bearer <jwt>
  → OAuth2PasswordBearer extracts → decode_access_token
  → load User by sub → check is_active
  → inject as Depends(get_current_user)
  → 401 on missing/expired/invalid → frontend clears token, kicks to login
```

### Rate Limiting

| Concern | Endpoint | Limit | Why |
|---|---|---|---|
| Brute force | `/auth/login` | 10/min | Slow credential stuffing |
| Spam accounts | `/auth/register` | 5/min | Slow throwaway-account creation |
| Worker abuse | `/scrape/craigslist` | 5/min | Celery is the expensive surface; cap enqueues |
| Polling | `/scrape/jobs/{id}` | 120/min | Allow ~2 polls/sec, comfortably above default 1.5s interval |
| Browse | `/deals` | 60/min | Generous; primary read path |
| Default | everything else | 200/min | Catch-all |

slowapi is wired with `SlowAPIMiddleware` + the standard `RateLimitExceeded` handler; per-endpoint limits use the `@limiter.limit("N/minute")` decorator (which requires `request: Request` as the first non-self parameter). The `Limiter` instance lives in its own module (`app/limiter.py`) so both `main.py` and `auth.py` can decorate handlers without circular imports.

### Async Scrape Flow (Phase 3 + Phase 5 polling)

```
User submits search (city + query)
  → useScrapeMutation.mutate({ city, query, maxResults })
  → POST /scrape/craigslist             (FastAPI handler)
     → scrape_craigslist_task.delay()   (push to Redis broker, db 0)
     → return 202 { job_id }            (immediate)
  → onSuccess: setJobId(data.job_id)    (kicks off useScrapeJob)

Frontend (useScrapeJob, refetchInterval=1500ms while non-terminal)
  → GET /scrape/jobs/{job_id}           (polled by React Query)
  → renders worker stage from data.progress.stage (queued → scraping → persisting)
  → on SUCCESS, useEffect inside the hook invalidates ["deals"]
     → useDeals refetches automatically → new rows render
  → polling stops (refetchInterval returns false on terminal state)

Celery worker (separate container)
  → picks up task from Redis queue
  → state=PROGRESS stage=scraping → search_craigslist_cars()
  → state=PROGRESS stage=persisting → SyncSession + dedupe by URL
  → for each new listing:
        predicted_price = listed_price × 1.15
        undervalue_percent = (predicted − listed) / predicted × 100
        INSERT into `listings`
  → state=SUCCESS, result={ fetched, inserted, skipped }
  → result stored in Redis (db 1) with 1-hour TTL
```

### Why two DB engines?
- `asyncpg` (used by FastAPI) is **async-only** — Celery's worker pool is sync and can't drive it.
- `psycopg2-binary` (used by Celery tasks) provides a sync driver against the same Postgres.
- Both share the same `Base` and ORM models.
- Sync URL is derived from the async URL by replacing `+asyncpg` with `+psycopg2` (`db.py::_to_sync_url`).

### Deal Discovery Flow
```
User sets filters
  → GET /deals?min_undervalue_percent=X&make=Y&...
  → Async SQLAlchemy query w/ filters + ORDER BY undervalue_percent DESC
  → JSON array → rendered as deal cards
```

### Pricing Model (current placeholder)
- `predicted_price = listed_price × 1.15` — assumes 15% market markup
- To be replaced with a trained ML model (Phase 6)
- Default `undervalue_percent` filter threshold: **15%**

---

## Frontend Key Details

- **Routing**: `App.tsx` derives the page from auth state, not from a hand-rolled state machine:
  - `bootstrapping` (token present, `useMe` still loading) → `BootSplash`
  - `me.data` truthy → `Dashboard`
  - `showLogin` (set when user clicks "Get started") → `LoginPage`
  - else → `HomePage`
- **Pages**:
  - `HomePage.tsx` — landing page, adaptive nav theme based on scroll position
  - `LoginPage.tsx` — `useLoginMutation` / `useRegisterAndLoginMutation`, login/register toggle, friendly error mapping
  - `Dashboard` (in `App.tsx`) — search form + scrape mutation + polling job query + auto-fetched deals
- **Server state via TanStack Query**:
  - **`queryClient.ts`** — single shared `QueryClient` with `QueryCache.onError` + `MutationCache.onError` that detect `UnauthorizedError` and reset `auth.me` to `null`. That null value flows into `App.tsx` and re-renders the unauthed branch — no manual "kick to login" event plumbing.
  - **`queryKeys.ts`** — central key factory: `queryKeys.auth.me`, `queryKeys.deals.list(minPct)`, `queryKeys.scrape.job(id)`. All invalidations reference these keys to avoid string drift.
  - **`hooks.ts`** — every server-state read or write goes through a hook here:
    - `useMe()` — `staleTime: 5min`, `enabled: !!getToken()`
    - `useLoginMutation()` / `useRegisterAndLoginMutation()` — invalidate `auth.me` on success
    - `useLogoutMutation()` — clears token, sets `auth.me=null`, removes deals + scrape caches
    - `useDeals(minUndervaluePercent)` — auto-fetches on mount; runs in the background; cached 30s
    - `useScrapeMutation()` — POSTs to `/scrape/craigslist`, returns `{ job_id }`
    - `useScrapeJob(jobId)` — polls `/scrape/jobs/{id}` via `refetchInterval` (1500ms) until state ∈ {SUCCESS, FAILURE}; on SUCCESS, the hook itself invalidates `["deals"]`
  - **Default options**: `retry: false` (auth + scrape errors are not transient), `refetchOnWindowFocus: true`, `staleTime: 30s`
  - **Devtools**: `@tanstack/react-query-devtools` mounted in `main.tsx` only when `import.meta.env.DEV`
- **API client** (`api.ts`):
  - Centralized `apiFetch` wrapper attaches `Authorization: Bearer <token>` when `auth: true`, sets JSON content-type, and on 401 clears the token + throws `UnauthorizedError`
  - Token lives in `localStorage["revveal_access_token"]`; `getToken`/`setToken`/`logout` exposed
  - `register(email, password)` → `POST /auth/register`
  - `login(email, password)` → `POST /auth/login`, stores token on success
  - `getMe()` → `GET /auth/me` (auth required)
  - `runCraigslistScrape(city, query, max)` → enqueues, returns `{ job_id, ... }` (auth required)
  - `getScrapeJob(id)` (auth required)
  - `fetchDeals(minPct)` → list deals (currently public, just rate-limited)
  - These raw fetchers exist *only* to be wrapped by hooks; consumers should always go through `hooks.ts`
- **Dashboard derived state**: `loading` and `stage` are `useMemo` derivations of `scrapeMutation.isPending`, `scrapeJob.data`, and `dealsQuery.isFetching`. There is no `setLoading`, no `setStage`, no `useState` for deals — TanStack Query owns all of it.
- **LoginPage**: real backend wiring with a login/register toggle (the "Create an account" link flips `mode`); `mutation.isPending` drives the spinner state; per-field validation + `parseAuthError` helper that maps backend status codes to friendly copy (`409` → "That email is already registered", `429` → "Too many attempts", etc.)
- **API base**: `import.meta.env.VITE_API_URL ?? "http://localhost:8000"`
- **Car-themed glyphs (`CarGlyphs.tsx`)** — instrument-cluster motifs used across the dashboard:
  - `GaugeDial` — semicircle tachometer with redline arc; needle position maps undervalue %, redline triggers above 25%
  - `LicensePlate` — bordered mono pill (state · index · source code) styled like a real plate
  - `Odometer` — bordered tabular-mono digit cells with leading zeros
  - `CarSilhouette` — minimal sedan side profile (used in header, empty state, success summary)
  - `Tire` — `animate-spin` wheel with spokes (loading states)
- **Dashboard worker UX**: button label and results subtitle reflect live `stage` (`queued` → `scraping` → `persisting` → `loading deals`); job summary line shows `N fetched · N inserted · N skipped` after success
- **Dead code**: `src/api/deals.ts` is an older duplicate, unreferenced — leave for now / delete in cleanup pass

---

## Configuration

### Backend (`app/settings.py` — Pydantic Settings, reads `.env`)

| Setting | Default | Notes |
|---------|---------|-------|
| `database_url` | `postgresql+asyncpg://postgres:postgres@localhost:5432/cardeals` | Async URL; sync URL derived |
| `redis_url` | `redis://localhost:6379` | Celery uses `/0` (broker) + `/1` (results) |
| `secret_key` | `"changeme-please-set-in-env"` | JWT signing key — **MUST be overridden in prod** |
| `jwt_algorithm` | `"HS256"` | JWT alg |
| `access_token_expire_minutes` | `60 * 24` (24h) | Token lifetime |
| `allowed_origins` | `["http://localhost:5173", "http://127.0.0.1:5173"]` | CORS |

Inside Docker Compose, `DATABASE_URL` and `REDIS_URL` are overridden to point at the `db` and `redis` service names.

### Celery (`app/celery_app.py`)
- Broker: `${REDIS_URL}/0`
- Result backend: `${REDIS_URL}/1`
- Task time limit: 120s (soft 90s)
- Result TTL: 1 hour
- `task_track_started=True`, `worker_prefetch_multiplier=1`
- JSON serialization only

### Frontend
- Dev server port: `5173` (Vite default)
- API base via `VITE_API_URL` env var
- Build target: ES2022, JSX automatic transform

---

## Running Locally

### Recommended — Docker Compose (one command)
```bash
docker compose up --build
# Postgres on :5432, Redis on :6379, API on :8000, worker attached
# Alembic migrations run automatically on backend container start
```

Then in another shell:
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

### Backend without Docker (requires local Postgres + Redis)
```bash
cd backend
.venv\Scripts\activate
alembic upgrade head
python -m uvicorn app.main:app --reload          # http://localhost:8000
celery -A app.celery_app:celery_app worker --loglevel=info   # in a 2nd shell
```

### Frontend build
```bash
cd frontend && npm run build   # output in dist/
```

### Backend tests
```bash
cd backend
.venv\Scripts\activate
pip install -r requirements-dev.txt   # first time (adds pytest)
pytest                                # offline scraper tests, no network/DB needed
```

---

## Current Status

### Done (Phase 1 — Postgres / Async / Docker)
- SQLite → PostgreSQL 16 migration
- Sync SQLAlchemy → async engine + sessionmaker (asyncpg)
- Alembic added; `001_initial_schema.py` is the source of truth for the `listings` table
- `Base.metadata.create_all` removed from app startup
- Pydantic Settings + `.env` driven config (`app/settings.py`)
- Dockerfile + docker-compose.yml (Postgres + Redis + backend)
- Frontend `VITE_API_URL` env var (no more hardcoded localhost)
- Editorial UI: HomePage with adaptive nav theme, LoginPage with social buttons (UI only)

### Done (Phase 3 — Celery + Redis async scraping)
- Celery 5.4 with Redis broker + result backend
- `scrape_craigslist_task` with `update_state` progress reporting + auto-retry w/ exponential backoff
- Sync engine (`psycopg2`) for tasks alongside async engine (`asyncpg`) for handlers
- New endpoints: `POST /scrape/craigslist` (202 Accepted, returns `job_id`) + `GET /scrape/jobs/{job_id}`
- `worker` service in docker-compose (concurrency=2)
- Frontend: `waitForScrapeJob` polling helper; Dashboard shows live worker stage + final summary

### Done (Phase 5 — TanStack Query)
- `@tanstack/react-query` 5.62 + devtools (dev only) installed
- `queryClient.ts` — shared instance with `QueryCache` + `MutationCache` `onError` handlers that null `auth.me` on `UnauthorizedError`
- `queryKeys.ts` — central key factory; no raw string keys anywhere
- `hooks.ts` — `useMe`, `useLoginMutation`, `useRegisterAndLoginMutation`, `useLogoutMutation`, `useDeals`, `useScrapeMutation`, `useScrapeJob` (the last one uses `refetchInterval` for live polling and self-invalidates `["deals"]` on SUCCESS)
- `App.tsx` rewritten — page selection derives from `me.data` instead of a hand-rolled state machine; `bootstrapping = !!getToken() && me.isLoading`
- Dashboard rewritten — no more local `useState` for `deals`/`loading`/`stage`/`error`/`jobSummary`; everything is a `useMemo` over query/mutation status
- LoginPage rewritten — `mutation.isPending` drives the loading spinner; mutations report errors via `mutation.error`
- `waitForScrapeJob` removed from `api.ts` (replaced by `useScrapeJob` with `refetchInterval`)
- After successful scrape, deals refetch is automatic via cache invalidation rather than an explicit `fetchDeals(...)` call
- Car-themed instrument-cluster glyphs (`CarGlyphs.tsx`) used across Dashboard: `GaugeDial`, `LicensePlate`, `Odometer`, `CarSilhouette`, `Tire`

### Done (Phase 4 — JWT auth + rate limiting)
- `users` table + Alembic migration 002
- `app/security.py` — bcrypt password hashing + JWT (HS256) encode/decode
- `app/auth.py` — `/auth/register`, `/auth/login`, `/auth/me` + `get_current_user` dependency
- Lazy "dummy hash" pattern in `/auth/login` to mitigate timing-based email enumeration
- `app/limiter.py` — shared slowapi `Limiter` instance (per-IP via `get_remote_address`)
- Per-endpoint rate limits: 5/min register & scrape enqueue, 10/min login, 60/min `/deals`, 120/min job polling, 200/min default
- `/scrape/*` now requires `Authorization: Bearer ...`
- Frontend `apiFetch` wrapper handles token, auth-header injection, and 401 → `UnauthorizedError` → auto-logout
- `LoginPage` wired to real backend with login/register toggle and friendly error mapping (`parseAuthError`)
- `App.tsx` session restore on mount (calls `/auth/me` if token present); `BootSplash` covers the bootstrap window
- API version bumped to 0.5.0

### Done (Phase 2 — Real Craigslist scraper)
- `scraper_craigslist.py` rewritten from stub to real scraping (httpx `Client` + BeautifulSoup) — **same `search_craigslist_cars(city, query, max_results)` signature**, so `tasks.py` and the Celery pipeline are untouched
- Scrapes Craigslist's **static no-JS search results** (`li.cl-static-search-result`) for url/title/price/location — more stable than the JS gallery
- **Per-listing detail fetch** enriches each result with mileage (`odometer` attrgroup), exact `posted_at` (`<time datetime>`), and description (`#postingbody`, QR boilerplate stripped); throttled sequential fetches (`DETAIL_DELAY_RANGE`)
- Title parsing helpers: `_parse_price`, `_parse_year`, `_parse_make_model` (against a `KNOWN_MAKES` map, `"Unknown"` fallback so the downstream contract always holds)
- Resilience: search-request errors propagate to Celery's `autoretry_for`; per-listing detail failures are caught and degrade gracefully (keep search data, null mileage/description, `posted_at = now`); empty/changed layout returns `[]`
- Config: `scraper_user_agent` + `scraper_request_timeout` in `settings.py`
- **Tests**: `backend/tests/test_scraper_craigslist.py` — 25 offline tests against saved HTML fixtures (helpers, search parsing, detail parsing, mocked end-to-end, failure-degradation). Run: `cd backend && pytest`
- No new runtime deps (`httpx` + `beautifulsoup4` were already present); `pytest` added via `requirements-dev.txt`

### Not Yet Implemented
- **Phase 6 — Real ML pricing model** — still `listed_price × 1.15` heuristic
- **GitHub Actions CI** — no automated test/build/lint pipeline yet
- **Refresh tokens** — only access tokens are issued (24h); no rotation, no token blacklist on logout
- **Email verification / password reset** — registration trusts the email; no confirmation flow
- **Per-user rate limits / quotas** — limits are per IP, not per user identity
- Additional marketplaces (Facebook Marketplace, AutoTrader, etc.)
- Pagination on `/deals`
- Real-time alerts / notifications
- Mobile responsiveness polish
- Structured logging / monitoring (Sentry, OpenTelemetry)

---

## Key Files to Know

| File | Why it matters |
|------|---------------|
| `backend/app/main.py` | FastAPI endpoints, Pydantic schemas, middleware wiring |
| `backend/app/auth.py` | `/auth/*` router + `get_current_user` dependency |
| `backend/app/security.py` | Password hashing + JWT — single point of auth-crypto truth |
| `backend/app/limiter.py` | Shared slowapi Limiter — both `main.py` and `auth.py` import it |
| `backend/app/celery_app.py` | Celery instance config — Redis URLs, serialization, time limits |
| `backend/app/tasks.py` | The `scrape_craigslist_task` — only place sync DB session is used |
| `backend/app/db.py` | Both engines (async + sync), `get_db` dep, sync-URL derivation |
| `backend/app/models.py` | Source of truth for ORM models (Listing, User) |
| `backend/app/settings.py` | All env-driven config including JWT settings |
| `backend/app/scraper_craigslist.py` | Real Craigslist scraper (httpx + BeautifulSoup): static search results + per-listing detail enrichment |
| `backend/tests/test_scraper_craigslist.py` | Offline, fixture-based unit tests for the scraper |
| `backend/alembic/versions/` | Migration history (001 listings, 002 users) |
| `docker-compose.yml` | Full local stack — db, redis, backend, worker |
| `frontend/src/App.tsx` | Auth-derived page selection + Dashboard (mostly derived state) |
| `frontend/src/queryClient.ts` | QueryClient with global 401 → reset auth.me handler |
| `frontend/src/queryKeys.ts` | Central key factory for queries + invalidations |
| `frontend/src/hooks.ts` | All `useQuery` / `useMutation` consumers — single source of server-state truth |
| `frontend/src/api.ts` | Raw fetchers + token storage; called only from `hooks.ts` |
| `frontend/src/CarGlyphs.tsx` | Instrument-cluster SVG primitives (gauge, plate, odometer, tire, silhouette) |
| `frontend/src/HomePage.tsx` / `LoginPage.tsx` | Editorial landing + login UI |
