# Running Car Deal Finder — Cheat Sheet

> Everything you need to start, use, and stop the app on your PC.
> Your machine is already set up (Docker, Node, deps, `.env` all present) — no install needed.

---

## TL;DR — start it in 2 terminals

```powershell
# Terminal 1 — backend stack (db + redis + API + worker)
docker compose up --build

# Terminal 2 — frontend
cd frontend
npm run dev
```

Then open **http://localhost:5173**.

> First `docker compose up --build` takes a few minutes (downloads images, builds backend). Later runs start in seconds.

---

## What each terminal starts

| Terminal 1 (`docker compose up`) | Terminal 2 (`npm run dev`) |
|---|---|
| 🗄️ PostgreSQL (port 5432) | 🖥️ Vite dev server (port 5173) |
| 📮 Redis (port 6379) | hot-reloads as you edit `frontend/src` |
| ⚡ FastAPI API (port 8000) — runs DB migrations on start | |
| ⚙️ Celery worker (does the scraping) | |

**Ready signals:**
- Terminal 1: `Uvicorn running on http://0.0.0.0:8000` + worker shows `celery@... ready`
- Terminal 2: `Local: http://localhost:5173/`

---

## URLs

| URL | What |
|---|---|
| **http://localhost:5173** | 👈 **The app** — open this |
| http://localhost:8000/docs | Interactive API explorer (every endpoint, clickable) |
| http://localhost:8000/health | Liveness check → `{"status":"ok"}` |

---

## Try the full pipeline

1. Open the app → **register** an account (auto-logs you in).
2. Go to the **Dashboard** → enter a city + search, e.g. `austin` / `honda civic`.
3. Watch the worker stage change: **queued → scraping → persisting → loading deals**.
4. Deals appear automatically (no manual refresh). 🎉

That's the entire async scrape flow running live.

---

## Stopping & cleanup

```powershell
# Terminal 2: Ctrl+C  (stops frontend)

# Terminal 1: Ctrl+C, then:
docker compose down        # stop containers, KEEP the database
docker compose down -v      # stop containers, WIPE the database (fresh start)
```

Your data lives in a Docker volume, so it survives a normal `down` and is there next time.

---

## Handy commands

```powershell
# See what's running
docker compose ps

# Tail logs for one service (when running detached)
docker compose logs -f backend
docker compose logs -f worker

# Run in the background instead of foreground
docker compose up --build -d        # detached
docker compose down                 # stop it

# Rebuild after changing backend deps (requirements.txt)
docker compose up --build

# Backend tests (offline, no DB/network needed)
cd backend; pytest

# Frontend production build (output in dist/)
cd frontend; npm run build
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `docker compose` fails: *"daemon not running"* | Start **Docker Desktop**, wait for the whale icon to go steady, retry. |
| `port is already allocated` (5432/6379/8000) | Something else uses that port. Stop it, or run `docker compose down` from any old run. |
| Frontend loads but every call fails / can't log in | Backend not up yet — check Terminal 1 for the `Uvicorn running` line. |
| `npm run dev` → *"command not found"* / missing deps | `cd frontend; npm install` then retry. |
| Backend keeps restarting | `docker compose logs backend` — usually a migration or `.env` issue. |
| Want a totally clean slate | `docker compose down -v` (wipes DB), then `docker compose up --build`. |
| Google/GitHub login buttons error | Expected — OAuth stays off until you set provider keys in `.env`. Use email/password. |

---

## Alternative — run backend without Docker

Only if you have local Postgres + Redis running. Otherwise use Docker (above).

```powershell
cd backend
.venv\Scripts\activate
alembic upgrade head
python -m uvicorn app.main:app --reload                       # API on :8000
# in a 2nd terminal (venv activated):
celery -A app.celery_app:celery_app worker --loglevel=info    # worker
```

---

*Deeper context: `HOW_IT_WORKS.md` (mental model) · `CHEATSHEET.md` (tech reference) · `CLAUDE.md` (full spec).*
