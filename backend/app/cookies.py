"""Session-cookie + CSRF helpers — the single source of cookie-attribute truth.

The app JWT lives in an httpOnly cookie (``revveal_session``) so JavaScript /
XSS can't read it. A non-httpOnly CSRF token (``revveal_csrf``) backs a
double-submit check, and a non-httpOnly hint (``revveal_authed``) lets the SPA
know a session probably exists without exposing anything sensitive.
"""

from __future__ import annotations

import secrets

from fastapi import HTTPException, Request, status

from .settings import settings

SESSION_COOKIE = "revveal_session"
CSRF_COOKIE = "revveal_csrf"
HINT_COOKIE = "revveal_authed"

CSRF_HEADER = "X-CSRF-Token"


def _max_age() -> int:
    return settings.access_token_expire_minutes * 60


def set_session_cookies(response, jwt: str) -> None:
    """Attach the session (httpOnly), CSRF, and hint cookies to ``response``."""
    max_age = _max_age()
    common = {
        "max_age": max_age,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        "domain": settings.cookie_domain,
        "path": "/",
    }

    response.set_cookie(SESSION_COOKIE, jwt, httponly=True, **common)
    # Readable by JS so the SPA can echo it back as the CSRF header.
    response.set_cookie(
        CSRF_COOKIE, secrets.token_urlsafe(32), httponly=False, **common
    )
    # Pure hint — no security value; just gates the /auth/me bootstrap call.
    response.set_cookie(HINT_COOKIE, "1", httponly=False, **common)


def clear_session_cookies(response) -> None:
    kwargs = {
        "domain": settings.cookie_domain,
        "path": "/",
        "samesite": settings.cookie_samesite,
        "secure": settings.cookie_secure,
    }
    for name in (SESSION_COOKIE, CSRF_COOKIE, HINT_COOKIE):
        response.delete_cookie(name, **kwargs)


async def require_csrf(request: Request) -> None:
    """Double-submit CSRF guard for unsafe authenticated requests.

    The cookie is auto-sent by the browser; the header must be set explicitly by
    our own JS (which read it from the readable CSRF cookie). A cross-site
    attacker can trigger the cookie but cannot read it to set the header.
    """
    cookie_token = request.cookies.get(CSRF_COOKIE)
    header_token = request.headers.get(CSRF_HEADER)
    if (
        not cookie_token
        or not header_token
        or not secrets.compare_digest(cookie_token, header_token)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing or invalid",
        )
