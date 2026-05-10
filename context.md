# Car Deal Finder AI — Project Context

## What This App Does

A full-stack web application that finds undervalued used car deals. It scrapes marketplace listings (starting with Craigslist), predicts fair market prices, calculates discount percentages, and surfaces the best deals to the user through a filtered, sortable UI.

---

## Project Structure

```
car-deal-finder/
├── backend/
│   ├── .venv/                        Python virtual environment
│   ├── app/
│   │   ├── __init__.py               Empty package marker
│   │   ├── main.py                   FastAPI app, all endpoints, Pydantic schemas
│   │   ├── models.py                 SQLAlchemy ORM model (Listing table)
│   │   ├── db.py                     DB engine + SessionLocal factory
│   │   └── scraper_craigslist.py     Craigslist scraper (currently stubbed w/ mock data)
│   └── requirements.txt              Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                   Main React component (search form + deal cards)
│   │   ├── api.ts                    HTTP client: runCraigslistScrape(), fetchDeals()
│   │   ├── api/deals.ts              Alternate deals API module (unused/deprecated)
│   │   ├── main.tsx                  React root entry point
│   │   ├── App.css                   Component styles (mostly unused, Tailwind primary)
│   │   └── index.css                 Global Tailwind directives
│   ├── index.html                    HTML shell with <div id="root">
│   ├── vite.config.ts                Vite config (React plugin)
│   ├── tsconfig.json                 TS project references
│   ├── tsconfig.app.json             App TS compiler options
│   ├── tsconfig.node.json            Node TS compiler options (for Vite)
│   ├── eslint.config.js              ESLint rules
│   └── package.json                  Frontend deps + build scripts
│
├── .vscode/settings.json             VS Code workspace settings
├── .claude/settings.local.json       Claude Code permissions config
├── context.md                        This file
└── README.md                         Project docs
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | React | 19.2.0 |
| Build tool | Vite | 7.2.4 |
| Language (frontend) | TypeScript | 5.9.3 |
| Styling | Tailwind CSS | 3.4.18 |
| HTTP (frontend) | Native Fetch API | — |
| Backend framework | FastAPI | 0.122.0 |
| ASGI server | Uvicorn | 0.38.0 |
| ORM | SQLAlchemy | 2.0.44 |
| Data validation | Pydantic | 2.12.5 |
| Scraping | BeautifulSoup4 | 4.14.2 |
| Database | SQLite (file: `car_deals.db`) | — |
| Config | python-dotenv | 1.2.1 |

Planned deployment: **Vercel** (frontend) + **Railway** (backend).

---

## Database Schema

Single table: **`listings`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (UUID) | Primary key, auto-generated |
| `source` | String | Marketplace source, e.g. `"craigslist"` |
| `url` | String | Listing URL — UNIQUE (dedup key) |
| `title` | String | Listing headline |
| `description` | Text | Full description (nullable) |
| `listed_price` | Integer | Asking price in USD |
| `predicted_price` | Integer | AI/heuristic fair market price |
| `undervalue_percent` | Float | `(predicted - listed) / predicted * 100` |
| `year` | Integer | Vehicle model year |
| `make` | String | Manufacturer, e.g. `"Honda"` |
| `model` | String | Model name, e.g. `"Civic"` |
| `mileage` | Integer | Odometer reading (nullable) |
| `location` | String | Geographic location string |
| `created_at` | DateTime | Row insertion time (auto) |
| `posted_at` | DateTime | When listing was published |

Table is auto-created by SQLAlchemy on first backend startup (`Base.metadata.create_all`). No manual migrations needed at this stage.

---

## API Endpoints

Base URL (dev): `http://127.0.0.1:8000`

### `GET /health`
Health check. Returns `{ "status": "ok", "service": "car-deal-finder-api" }`.

### `GET /deals`
Fetch filtered deals from DB, sorted by `undervalue_percent DESC`.

| Query param | Type | Default | Description |
|-------------|------|---------|-------------|
| `min_undervalue_percent` | float | `15.0` | Minimum discount threshold |
| `make` | string | — | Filter by make (case-insensitive) |
| `model` | string | — | Filter by model (case-insensitive) |
| `location` | string | — | Substring match on location |

Returns: JSON array of Deal objects.

### `GET /deals/{deal_id}`
Get a single listing by UUID. Returns 404 if not found.

### `POST /scrape/craigslist`
Trigger a scrape, persist new listings to DB, return count.

| Query param | Type | Default | Description |
|-------------|------|---------|-------------|
| `city` | string | required | City slug, e.g. `"austin"` |
| `query` | string | required | Search term, e.g. `"honda civic"` |
| `max_results` | int | `10` | Max listings to fetch |

Returns: `{ "inserted": int, "city": string, "query": string }`.
Returns 502 on scraper failure.

---

## Core Business Logic

### Data Acquisition Flow
```
User submits search (city + query)
  → POST /scrape/craigslist
  → scraper_craigslist.search_craigslist_cars() [currently stubbed w/ mock data]
  → For each listing:
      - Check URL against DB (skip duplicates)
      - predicted_price = listed_price * 1.15  ← placeholder heuristic
      - undervalue_percent = (predicted - listed) / predicted * 100
      - INSERT into listings table
  → Return { inserted, city, query }
```

### Deal Discovery Flow
```
User sets filters
  → GET /deals?min_undervalue_percent=X&make=Y&...
  → SQLAlchemy query with filters + ORDER BY undervalue_percent DESC
  → Return JSON array → rendered as deal cards in UI
```

### Pricing Model (current placeholder)
- `predicted_price = listed_price × 1.15` — assumes 15% market markup
- This will be replaced with an actual ML price prediction model
- `undervalue_percent` threshold default is **15%** (configurable per query)

---

## Frontend Key Details

- Single-component architecture — all logic in `App.tsx`
- `api.ts` exports two functions:
  - `runCraigslistScrape(city, query, maxResults)` → triggers scrape
  - `fetchDeals(filters)` → fetches filtered deals
- API base URL is **hardcoded** as `http://127.0.0.1:8000` in `api.ts` — needs an env variable for production
- `src/api/deals.ts` appears to be an older/duplicate module, currently unused

---

## Configuration

### Backend
- DB URL: `"sqlite:///./car_deals.db"` (relative to backend root)
- CORS allowed origins: `http://127.0.0.1:5173`, `http://localhost:5173`
- API title: `"Car Deal Finder API"`, version `0.2.0`

### Frontend
- Dev server port: `5173` (Vite default)
- Build target: ES2022
- JSX: React automatic transform

---

## Running Locally

**Backend:**
```bash
cd backend
.venv\Scripts\activate
python -m uvicorn app.main:app --reload
# Starts on http://127.0.0.1:8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Starts on http://localhost:5173
```

**Frontend build:**
```bash
cd frontend && npm run build
# Output in dist/ (deploy to Vercel)
```

---

## Current Status

### Done
- Full-stack architecture wired up end-to-end
- SQLite DB with SQLAlchemy ORM (auto-created on startup)
- All 4 REST endpoints functional
- React UI with search form + deal card display
- Filtering and sorting by undervalue percentage
- CORS configured for local dev
- DB persistence (deduplication by URL)

### Not Yet Implemented
- **Real scraper** — `scraper_craigslist.py` returns mock/stub data; actual BeautifulSoup Craigslist scraping not wired
- **ML price prediction** — currently a dumb `price × 1.15` heuristic
- **Additional marketplaces** — Facebook Marketplace, AutoTrader, etc.
- **Authentication** — no user accounts or auth layer
- **Environment-based API URL** — frontend has hardcoded localhost URL
- **Production database** — PostgreSQL planned for Railway deployment
- **Pagination** — no limit/offset on deal results
- **Real-time alerts** — no notifications for new deals
- **Mobile responsiveness** — minimal media query coverage
- **Error logging / monitoring**
- **Caching** for repeated scrape results

---

## Key Files to Know

| File | Why it matters |
|------|---------------|
| `backend/app/main.py` | All API logic lives here — endpoints, schemas, DB queries |
| `backend/app/models.py` | Source of truth for DB schema |
| `backend/app/scraper_craigslist.py` | Where real scraping logic will go (currently stubbed) |
| `frontend/src/App.tsx` | Entire frontend UI — search, filters, deal cards |
| `frontend/src/api.ts` | The only file that talks to the backend API |
