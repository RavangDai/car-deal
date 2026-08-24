from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.sessions import SessionMiddleware

from .ai import is_enabled as ai_is_enabled
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


@app.get("/config", tags=["meta"])
async def client_config():
    """What this deployment is actually configured to do.

    The frontend uses this to decide what to render. Several features here are
    optional and degrade to a 503 when their credential is absent — donations
    without a Stripe key, social login without a provider id/secret. A button
    that can only ever return 503 is worse than no button, so the client asks
    first and omits those surfaces entirely.

    Deliberately reports booleans only. No key, id, or partial credential is
    exposed, and the endpoint stays public so a signed-out visitor gets the
    same honest UI as a signed-in one.
    """
    return {
        "donations": bool(settings.stripe_secret_key),
        "ai": ai_is_enabled(),
        "oauth": {
            # Mirrors the registration guard in oauth.py: a provider exists
            # only when BOTH halves of its credential pair are present.
            "google": bool(settings.google_client_id and settings.google_client_secret),
            "github": bool(settings.github_client_id and settings.github_client_secret),
        },
    }
