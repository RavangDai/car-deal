# Car Deal Finder AI — Project Context

## What This App Does

A full-stack web application that finds undervalued used car deals. It scrapes marketplace listings (starting with Craigslist), predicts fair market prices, calculates discount percentages, and surfaces the best deals through a filtered, sortable UI.

The scraping pipeline runs **asynchronously** on Celery workers backed by Redis, so the API stays responsive while a background worker fetches and persists listings to PostgreSQL.

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
│   │       └── 001_initial_schema.py  Initial `listings` table migration
│   ├── alembic.ini                    Alembic config
│   ├── app/
│   │   ├── __init__.py                Empty package marker
│   │   ├── main.py                    FastAPI app, endpoints, Pydantic schemas
│   │   ├── settings.py                Pydantic Settings — env-driven config
│   │   ├── db.py                      Async + sync SQLAlchemy engines, Base class
│   │   ├── models.py                  SQLAlchemy ORM (Listing table, UUID PK)
│   │   ├── celery_app.py              Celery instance — Redis broker + result backend
│   │   ├── tasks.py                   Celery tasks (scrape_craigslist_task)
│   │   └── scraper_craigslist.py      Craigslist scraper (currently stubbed w/ mock data)
│   ├── Dockerfile                     Backend image (Python 3.12-slim)
│   └── requirements.txt               Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                    Top-level router (home → login → dashboard)
│   │   ├── HomePage.tsx               Landing page w/ adaptive nav theme
│   │   ├── LoginPage.tsx              Login UI (UI-only — no real auth wired)
│   │   ├── api.ts                     HTTP client: scrape enqueue + job polling + deals
│   │   ├── api/deals.ts               Deprecated duplicate, unused
│   │   ├── main.tsx                   React root entry
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
| HTTP (frontend) | Native Fetch API | — | API calls + polling |
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
| Auth libs (not yet wired) | python-jose, passlib[bcrypt], slowapi | — | Reserved for Phase 4 (JWT + rate limit) |
| Config (frontend) | `VITE_API_URL` env var | — | Switch API base between dev / prod |

Planned deployment: **Vercel** (frontend) + **Railway** or **Fly.io** (backend + worker + Postgres + Redis).

---

## Database Schema

Single table: **`listings`**, managed by **Alembic** (no more `Base.metadata.create_all` at startup — `alembic upgrade head` runs in the backend container's entrypoint).

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

---

## API Endpoints

Base URL (dev): `http://localhost:8000`

### `GET /health`
Health check. Returns `{ "status": "ok", "service": "car-deal-finder-api" }`.

### `GET /deals`
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

### `POST /scrape/craigslist`  →  HTTP **202 Accepted**
**Enqueues** a Celery scrape task; returns immediately with a job id. Does NOT wait for the scrape to complete.

| Query param | Type | Default | Description |
|-------------|------|---------|-------------|
| `city` | string | required | City slug, e.g. `"austin"` |
| `query` | string | required | Search term, e.g. `"honda civic"` |
| `max_results` | int | `10` | Max listings to fetch |

Returns:
```json
{ "job_id": "uuid", "status": "queued", "city": "austin", "query": "honda civic", "max_results": 10 }
```

### `GET /scrape/jobs/{job_id}`
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

### Async Scrape Flow (Phase 3)

```
User submits search (city + query)
  → POST /scrape/craigslist             (FastAPI handler)
     → scrape_craigslist_task.delay()   (push to Redis broker, db 0)
     → return 202 { job_id }            (immediate)

Frontend
  → polls GET /scrape/jobs/{job_id} every ~1.2s
  → renders worker stage (queued → scraping → persisting)
  → on SUCCESS, renders summary + GET /deals to refresh

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

- **Routing**: `App.tsx` is a 3-state state machine (`home` → `login` → `dashboard`); no router library
- **Pages**:
  - `HomePage.tsx` — landing page, adaptive nav theme based on scroll position
  - `LoginPage.tsx` — UI only, fakes auth with a 1.2s setTimeout (no `/auth` endpoint exists yet)
  - `Dashboard` (in `App.tsx`) — search form + async job polling + deal grid
- **API client** (`api.ts`):
  - `runCraigslistScrape(city, query, max)` → enqueues, returns `{ job_id, ... }`
  - `getScrapeJob(id)` → one-shot status fetch
  - `waitForScrapeJob(id, opts)` → polling helper with `onUpdate` callback, abort signal, 90s default timeout
  - `fetchDeals(minPct)` → list deals
- **API base**: `import.meta.env.VITE_API_URL ?? "http://localhost:8000"`
- **Dashboard worker UX**: button label and results subtitle reflect live `stage` (`queued` → `scraping` → `persisting` → `loading deals`); job summary line shows `N fetched · N inserted · N skipped` after success
- **Dead code**: `src/api/deals.ts` is an older duplicate, unreferenced — leave for now / delete in cleanup pass

---

## Configuration

### Backend (`app/settings.py` — Pydantic Settings, reads `.env`)

| Setting | Default | Notes |
|---------|---------|-------|
| `database_url` | `postgresql+asyncpg://postgres:postgres@localhost:5432/cardeals` | Async URL; sync URL derived |
| `redis_url` | `redis://localhost:6379` | Celery uses `/0` (broker) + `/1` (results) |
| `secret_key` | `"changeme"` | Reserved for JWT (Phase 4) |
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

### Not Yet Implemented
- **Real Craigslist scraper** — `scraper_craigslist.py` still returns mock listings; BeautifulSoup logic TBD
- **Phase 4 — JWT auth + rate limiting** — libraries (`python-jose`, `passlib`, `slowapi`) are in `requirements.txt` but NOT wired in code; `LoginPage` is UI-only
- **Phase 5 — TanStack Query on frontend** — not installed; manual `useState` + `fetch` everywhere
- **Phase 6 — Real ML pricing model** — still `listed_price × 1.15` heuristic
- Additional marketplaces (Facebook Marketplace, AutoTrader, etc.)
- Pagination on `/deals`
- Real-time alerts / notifications
- Mobile responsiveness polish
- Structured logging / monitoring (Sentry, OpenTelemetry)

---

## Key Files to Know

| File | Why it matters |
|------|---------------|
| `backend/app/main.py` | FastAPI endpoints, Pydantic schemas, the enqueue + status surface |
| `backend/app/celery_app.py` | Celery instance config — Redis URLs, serialization, time limits |
| `backend/app/tasks.py` | The `scrape_craigslist_task` — only place sync DB session is used |
| `backend/app/db.py` | Both engines (async + sync) and the sync-URL derivation helper |
| `backend/app/models.py` | Source of truth for ORM models |
| `backend/app/settings.py` | All env-driven config |
| `backend/app/scraper_craigslist.py` | Where real scraping logic will go (currently stubbed) |
| `backend/alembic/versions/` | Migration history |
| `docker-compose.yml` | Full local stack — db, redis, backend, worker |
| `frontend/src/App.tsx` | Dashboard + page-state machine |
| `frontend/src/api.ts` | The only file talking to the backend; defines polling helper |
| `frontend/src/HomePage.tsx` / `LoginPage.tsx` | Editorial landing + login UI |
