# WasItCheaper

**"Was it cheaper? Now you'll know."** Paste any product URL. WasItCheaper tracks its real price every day, builds a genuine price history, and scores every "deal" against 90 days of that history — so a store raising a price for three weeks and "dropping" it back to baseline gets caught, not celebrated.

- **Track any product URL** — an extraction agent reads structured page data first (JSON-LD, Open Graph, microdata), falling back to a Claude API reader only when a site publishes none
- **Daily scheduled rechecks** — Celery beat fans out a jittered daily recheck per product, appending to an append-only price history — never overwritten, never guessed
- **Real deal math** — a deterministic, unit-tested statistics module scores discount depth vs. the 90-day median, historical rarity, pre-drop stability, and drop freshness
- **Two AI features, one clean boundary** — the extraction fallback reads pages; a separate "Buy or Wait" feature narrates the *already-computed* statistics — the LLM never invents the numbers, only explains them
- **Real alerts** — set an alert rule (any drop / percent drop / target price) and get emailed via Resend the moment the price genuinely changes
- **Honest charts** — hand-rolled, dependency-free SVG price-history charts using a step-after line, because prices are step functions and a smooth curve would fabricate prices that were never observed

This is a pivot of an earlier car-deal-finder project. The auth stack, Celery/Redis plumbing, and TanStack Query frontend layer carried over; the domain and the core math did not — the old app's "deal score" was a flat `price × 1.15` heuristic with no real statistics behind it.

---

## The deal math (why this isn't just another discount badge)

Every tracked product gets a `deal_score` (0–100) computed purely from its own price history — no external comps, no vendor-supplied "was" price:

| Component | Weight | What it catches |
|---|---|---|
| Discount depth vs. 90-day median | 40% | A price raised ~20% for a few weeks then "dropped" back to baseline never moved the median — this component scores it near **zero** |
| Historical rarity | 30% | What fraction of the last 90 tracked days were priced *above* today's price |
| Pre-drop stability | 20% | A price that was flat before a drop is a trustworthy reference point; one that bounced around isn't |
| Drop freshness | 10% | A drop today is more actionable than one from two weeks ago |

The statistics module (`backend/app/dealmath.py`) is pure — no database, no network — and exhaustively unit tested, including a direct test asserting a fake-discount fixture scores lower than a genuine-sale fixture with an identical headline percentage-off.

---

## Architecture

```
                    ┌─────────────┐        ┌──────────────┐
  user pastes URL → │   FastAPI   │──202──▶│ Celery worker │──┐
                    └─────────────┘        └──────────────┘  │
                          │                                   │ extract_product()
                          │                          SSRF-guarded fetch
                          │                          → JSON-LD/og/microdata
                          │                          → Claude API fallback
                          ▼                                   │
                    ┌─────────────┐                            ▼
                    │  Postgres   │◀── price_points (append-only) + products (materialized stats)
                    └─────────────┘
                          ▲
                          │  daily, jittered, per-domain-spread fan-out
                    ┌─────────────┐
                    │ Celery beat │── prices.schedule_rechecks (cron)
                    └─────────────┘
                          │
                          ▼
              recompute dealmath stats → evaluate watch alert rules → email via Resend
                          │
                          ▼
              invalidate cached "Buy or Wait" verdict on real price change
```

Frontend: React 19 + Vite + TanStack Query, hash-routed (`#/product/:id`, `#/alerts`, `#/terms`, `#/privacy`). The homepage hero is itself a full-viewport carousel of real top-scoring tracked products (not a small floating widget) with a persistent paste-URL box overlaid on every slide.

---

## Project Structure

```
car-deal-finder/
├── backend/
│   ├── app/
│   │   ├── dealmath.py         Pure deal-quality statistics (the project's core)
│   │   ├── urlnorm.py          URL normalization — product identity
│   │   ├── alerts.py           Pure alert-rule evaluation
│   │   ├── extraction/         SSRF-guarded fetch + structured-data + Claude fallback
│   │   ├── ai/                 Claude API client, extraction fallback, verdict generation
│   │   ├── notify/             Email abstraction (console dev backend / Resend prod)
│   │   ├── products_api.py     /products* routes
│   │   ├── watches_api.py      /watches* + /alerts routes
│   │   ├── auth.py / oauth.py  Cookie-session auth + Google/GitHub OAuth
│   │   ├── tasks.py            Celery task graph
│   │   └── celery_app.py       Beat schedule (daily price recheck)
│   ├── scripts/seed_products.py  ~100 demo products, synthetic 180-day histories
│   └── tests/                  177 tests — dealmath, urlnorm, SSRF, extraction, alerts, AI, API
└── frontend/
    └── src/
        ├── HeroCarousel.tsx     Full-viewport hero carousel
        ├── ProductDetailPage.tsx  Price chart, deal-score breakdown, watch panel, AI verdict
        ├── charts.tsx           Dependency-free SVG charts (step-after price line)
        └── App.tsx              Routing + "My tracked products" dashboard
```

---

## Run locally

```bash
docker compose up --build
# Postgres :5432, Redis :6379, API :8000, Celery worker + beat attached
# Alembic migrations run automatically on backend container start

docker compose exec backend python -m scripts.seed_products
# seeds ~100 demo products so the deals feed and hero carousel aren't empty

cd frontend && npm install && npm run dev   # http://localhost:5173
```

> Never `docker compose down -v` — it wipes the Postgres volume.

### Optional: enable the Claude API features

Both AI features (extraction fallback, "Buy or Wait" verdicts) degrade gracefully with no key set. To enable them, add to `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

### Optional: enable real price-drop emails

Defaults to a console logger (prints the rendered email). To send real email via [Resend](https://resend.com):

```env
EMAIL_BACKEND=resend
RESEND_API_KEY=re_...
```

---

## Authentication & OAuth setup

Auth supports **email/password** *and* **Google / GitHub social login**. The session JWT is stored in a **Secure, httpOnly cookie** (not `localStorage`), with CSRF double-submit protection. Social login stays dormant until you add provider credentials.

**Google** — [Google Cloud Console](https://console.cloud.google.com/) → *APIs & Services* → *Credentials* → *Create Credentials* → *OAuth client ID* → **Web application**. Redirect URI: `http://localhost:8000/auth/oauth/google/callback`

**GitHub** — *Settings* → *Developer settings* → *OAuth Apps* → *New OAuth App*. Callback URL: `http://localhost:8000/auth/oauth/github/callback`

Add to `.env` (repo root):

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

OAUTH_REDIRECT_BASE=http://localhost:8000
FRONTEND_URL=http://localhost:5173

# In production (frontend/backend on different sites) set COOKIE_SECURE=true, COOKIE_SAMESITE=none
COOKIE_SECURE=false
COOKIE_SAMESITE=lax

SECRET_KEY=replace-with-a-long-random-string
```

### Backend tests

```bash
cd backend
.venv\Scripts\activate
pip install -r requirements-dev.txt
pytest   # 177 tests, no network/DB required
```

---

## Tech Stack

**Backend:** FastAPI, SQLAlchemy (async + sync), Alembic, Celery + Redis, BeautifulSoup4, Anthropic SDK
**Frontend:** React 19, Vite, TypeScript, TanStack Query
**Database:** PostgreSQL 16
**Auth:** Argon2id (pwdlib) + JWT cookies, Authlib OAuth
**Email:** Resend
**Payments:** Stripe Checkout (optional donations)

---

## Live snapshot

<!-- SYNC:note:start -->
_Live snapshot of the codebase — auto-generated, do not hand-edit the `SYNC` regions. Last commit `b52a613` (2026-07-09)._
<!-- SYNC:note:end -->

### Stack

<!-- SYNC:stack:start -->
**Frontend**

| Package | Version |
| --- | --- |
| @tanstack/react-query | ^5.62.0 |
| framer-motion | ^12.39.0 |
| html2canvas | ^1.4.1 |
| lucide-react | ^1.23.0 |
| react | ^19.2.0 |
| react-dom | ^19.2.0 |

_Build tooling: vite ^7.2.4 · typescript ~5.9.3 · tailwindcss ^3.4.18 · eslint ^9.39.1_

**Backend**

| Package | Version |
| --- | --- |
| fastapi | 0.122.0 |
| uvicorn[standard] | 0.38.0 |
| sqlalchemy | 2.0.44 |
| asyncpg | 0.30.0 |
| psycopg2-binary | 2.9.10 |
| alembic | 1.14.0 |
| pydantic[email] | 2.12.5 |
| pydantic-settings | 2.7.0 |
| python-dotenv | 1.2.1 |
| beautifulsoup4 | 4.14.2 |
| httpx | 0.28.1 |
| slowapi | 0.1.9 |
| python-jose[cryptography] | 3.5.0 |
| pwdlib[argon2,bcrypt] | 0.3.0 |
| redis | 5.2.1 |
| celery[redis] | 5.4.0 |
| stripe | 11.4.1 |
| authlib | 1.6.5 |
| itsdangerous | 2.2.0 |
| anthropic | 0.116.0 |
<!-- SYNC:stack:end -->

### API surface

<!-- SYNC:api:start -->
| Method | Path | Module |
| --- | --- | --- |
| GET | `/alerts` | `watches_api.py` |
| POST | `/auth/login` | `auth.py` |
| POST | `/auth/logout` | `auth.py` |
| GET | `/auth/me` | `auth.py` |
| GET | `/auth/oauth/{provider}/callback` | `oauth.py` |
| GET | `/auth/oauth/{provider}/login` | `oauth.py` |
| POST | `/auth/register` | `auth.py` |
| POST | `/donate` | `donations.py` |
| GET | `/health` | `main.py` |
| GET | `/products` | `products_api.py` |
| GET | `/products/{product_id}` | `products_api.py` |
| GET | `/products/{product_id}/history` | `products_api.py` |
| GET | `/products/{product_id}/verdict` | `products_api.py` |
| POST | `/products/track` | `products_api.py` |
| GET | `/products/track/{job_id}` | `products_api.py` |
| GET | `/watches` | `watches_api.py` |
| POST | `/watches` | `watches_api.py` |
| DELETE | `/watches/{watch_id}` | `watches_api.py` |
| PATCH | `/watches/{watch_id}` | `watches_api.py` |
<!-- SYNC:api:end -->

### Data model

<!-- SYNC:data:start -->
| Model | Table |
| --- | --- |
| `Product` | `products` |
| `PricePoint` | `price_points` |
| `Watch` | `watches` |
| `AlertEvent` | `alert_events` |
| `ProductVerdict` | `product_verdicts` |
| `User` | `users` |

Migrations: **5** · head `005_wasitcheaper_pivot.py`
<!-- SYNC:data:end -->

### Demo catalog

<!-- SYNC:seed:start -->
**100** demo products across electronics, kitchen, gaming, home (`backend/scripts/seed_products.py`).
<!-- SYNC:seed:end -->

### Current state

<!-- SYNC:state:start -->
- **App:** WasItCheaper — Track any price, see its past
- **API:** WasItCheaper API v1.0.0
- **Branch:** main
- **Last commit:** `b52a613` (2026-07-09) — Add v-home-hero.png image for homepage hero section
<!-- SYNC:state:end -->

---

Made by Bibek Pathak
