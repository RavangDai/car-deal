from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.sessions import SessionMiddleware

from .auth import router as auth_router
from .db import engine
from .donations import router as donations_router
from .limiter import limiter
from .oauth import router as oauth_router
from .preferences_api import router as preferences_router
from .products_api import router as products_router
from .settings import settings
from .watches_api import router as watches_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(
    title="WasItCheaper API",
    version="1.0.0",
    description=(
        "Track any product URL, watch its real price history, and get "
        "alerted on genuine drops — Celery-scheduled scraping + JWT auth + "
        "rate limiting + Claude-powered extraction and deal analysis."
    ),
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Signed session — holds the OAuth state/PKCE between the login redirect and the
# provider callback (Authlib's standard mechanism). Not used for app sessions.
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    same_site=settings.cookie_samesite,
    https_only=settings.cookie_secure,
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(oauth_router)
app.include_router(donations_router)
app.include_router(preferences_router)
app.include_router(products_router)
app.include_router(watches_router)


@app.get("/health", tags=["meta"])
async def health_check():
    return {"status": "ok", "service": "wasitcheaper-api"}
