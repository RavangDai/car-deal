# Car Deal Finder — One-Page Cheat Sheet

> Quick reference. For the *why* and mental model, read **`HOW_IT_WORKS.md`**.
> For the exact spec of every file/setting, read **`CLAUDE.md`**.

---

## The stack at a glance

| Layer | Tech | Its one job |
|---|---|---|
| UI framework | **React** + **TypeScript** | Draw the UI from components, typed & safe |
| Build/dev | **Vite** | Hot-reload dev server + production bundler |
| Styling | **Tailwind CSS** | Utility-class styling |
| Server state | **TanStack Query** | Cache, refetch, poll, handle loading/errors |
| API framework | **FastAPI** | The endpoints the frontend calls |
| Validation | **Pydantic** | Reject bad request/response data at the door |
| ORM | **SQLAlchemy** | Talk to the DB via Python objects, not raw SQL |
| Migrations | **Alembic** | Version-control the DB schema |
| Database | **PostgreSQL** | Long-term storage (users, listings) |
| Background jobs | **Celery** | Run slow scrapes off the request path |
| Queue / results | **Redis** | To-do list between API and worker (db0 + db1) |
| Scraping | **httpx** + **BeautifulSoup** | Fetch + parse Craigslist HTML |
| Auth | **bcrypt**, **JWT**, **Authlib** (OAuth) | Passwords, sessions, Google/GitHub login |
| Rate limiting | **slowapi** | Per-IP caps to stop abuse/brute-force |
| Packaging | **Docker** + **docker-compose** | Run the whole stack identically anywhere |

---

## The scrape flow in 8 steps

1. You submit a search → `POST /scrape/craigslist` (needs login + CSRF).
2. API enqueues a Celery task, returns **`202` + `job_id`** instantly.
3. Frontend **polls** `GET /scrape/jobs/{id}` every 1.5s.
4. Worker pulls the job from Redis, scrapes search + detail pages.
5. Computes `predicted = listed × 1.15`, `undervalue% = (pred−listed)/pred × 100`.
6. `INSERT`s new cars into Postgres (deduped by URL).
7. Writes `{ fetched, inserted, skipped }` to Redis.
8. Poll sees `SUCCESS` → stops, marks deals stale → `/deals` auto-refetches.

**The point:** the API *promises* (202) instead of *waiting*. Async keeps the API
snappy on short waits; Celery+Redis move long jobs out of the request entirely.

---

## Two ideas people confuse

| | **Async** (FastAPI) | **Background work** (Celery + Redis) |
|---|---|---|
| Solves | Don't block during *short* waits (ms) | Get *long* jobs (sec) off the request |
| Where | Same process, many requests interleaved | Separate process / container |
| Analogy | One waiter serving many tables | A buzzer: order now, collect later |

---

## Security in one screen

| Defense | What it stops |
|---|---|
| **bcrypt hash** (never store raw password) | DB-leak → password theft |
| **JWT in httpOnly cookie** (`revveal_session`) | XSS reading your session |
| **CSRF double-submit** (`revveal_csrf` ↔ `X-CSRF-Token`) | Other sites forging requests with your cookie |
| **`revveal_authed` hint cookie** (JS-readable, non-secret) | — (just gates the `/auth/me` call) |
| **OAuth verified-email linking only** | Account takeover via unverified email |
| **Rate limits** (login 10/min, register 5/min, scrape 5/min) | Brute-force, spam, worker abuse |
| **Dummy-hash on failed login** | Email enumeration via response timing |

**Golden rule:** never trust the frontend — the backend re-checks everything.

---

## Endpoints

| Method · Path | Limit | Does |
|---|---|---|
| `POST /auth/register` | 5/min | Create account (auto-login) |
| `POST /auth/login` | 10/min | Log in (sets session cookie) |
| `POST /auth/logout` | — | Clear cookies |
| `GET /auth/me` | — | Who am I? (reads session cookie) |
| `GET /auth/oauth/{provider}/login` · `/callback` | 10/min | Google / GitHub login |
| `GET /deals` | 60/min | List deals, sorted by undervalue% |
| `GET /deals/{id}` | — | One listing |
| `POST /scrape/craigslist` | 5/min · **auth** | Enqueue scrape → `202` + `job_id` |
| `GET /scrape/jobs/{id}` | 120/min · **auth** | Poll job state/progress/result |
| `GET /health` | — | Liveness check |

Default cap on everything else: **200/min**.

---

## Key files

| File | What lives there |
|---|---|
| `backend/app/main.py` | Endpoints + schemas + middleware |
| `backend/app/auth.py` | Register/login/logout/me + `get_current_user` |
| `backend/app/oauth.py` | Google/GitHub login + account linking |
| `backend/app/cookies.py` | Cookie helpers + `require_csrf` |
| `backend/app/security.py` | bcrypt + JWT encode/decode |
| `backend/app/tasks.py` | `scrape_craigslist_task` (the only sync-DB code) |
| `backend/app/scraper_craigslist.py` | httpx + BeautifulSoup scraper |
| `backend/app/models.py` | ORM tables: `Listing`, `User` |
| `backend/alembic/versions/` | Schema migrations (ordered history) |
| `frontend/src/hooks.ts` | Every API read/write (TanStack hooks) |
| `frontend/src/queryClient.ts` | Shared cache + global 401 → logout |
| `frontend/src/api.ts` | Raw fetchers (called only by hooks) |
| `frontend/src/App.tsx` | Auth-derived page choice + Dashboard |

---

## Commands

```bash
# Run the whole backend stack (db + redis + api + worker)
docker compose up --build          # API → http://localhost:8000

# Frontend dev server
cd frontend && npm install && npm run dev      # → http://localhost:5173

# Backend tests (offline, fixture-based scraper tests)
cd backend && pytest

# Apply DB migrations manually (Docker does this automatically)
cd backend && alembic upgrade head

# Explore the live API
open http://localhost:8000/docs    # auto-generated, clickable
```

---

## Mini-glossary

**API** set of callable URLs · **Endpoint** one such URL · **202 Accepted** "I'll do
it later" · **ORM** objects instead of SQL · **Migration** versioned schema change ·
**Async** interleave waits, never block · **Worker** separate process for slow jobs ·
**Broker/queue** shared to-do list (Redis) · **Polling** repeatedly asking "done?" ·
**JWT** signed identity token · **httpOnly cookie** JS can't read it · **CSRF/XSS**
the two web attacks our cookie scheme defends against · **bcrypt** one-way password
scramble · **Container** app + its environment, portable.
