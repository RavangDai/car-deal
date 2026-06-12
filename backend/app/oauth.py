"""Social login (Google + GitHub) via Authlib.

Authorization Code flow + PKCE + ``state`` (state/PKCE live in the signed
Starlette session — see ``SessionMiddleware`` in main.py). On a successful
callback we upsert a ``User`` and drop the app JWT into the httpOnly session
cookie (``app.cookies``), then redirect back to the SPA.

Security note on account linking: when an OAuth identity arrives with an email
that already belongs to an existing account, we only auto-link if the provider
reports the email as **verified** — otherwise an attacker could register an
unverified address at a provider to take over someone's account.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import urlencode

from authlib.integrations.starlette_client import OAuth, OAuthError
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .cookies import set_session_cookies
from .db import get_db
from .limiter import limiter
from .models import User
from .security import create_access_token
from .settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

SUPPORTED_PROVIDERS = ("google", "github")


# ── Authlib registry ──────────────────────────────────────────────────────────

oauth = OAuth()

if settings.google_client_id and settings.google_client_secret:
    oauth.register(
        name="google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

if settings.github_client_id and settings.github_client_secret:
    oauth.register(
        name="github",
        client_id=settings.github_client_id,
        client_secret=settings.github_client_secret,
        access_token_url="https://github.com/login/oauth/access_token",
        authorize_url="https://github.com/login/oauth/authorize",
        api_base_url="https://api.github.com/",
        client_kwargs={"scope": "read:user user:email"},
    )


def _get_client(provider: str):
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown provider")
    client = oauth.create_client(provider)
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{provider} login is not configured",
        )
    return client


# ── Normalized profile + pure helpers (unit-tested offline) ───────────────────

class OAuthAccountError(Exception):
    """Raised when an OAuth identity can't be turned into a usable account."""

    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class OAuthProfile:
    provider: str
    subject: str
    email: Optional[str]
    email_verified: bool
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


def profile_from_google(userinfo: dict[str, Any]) -> OAuthProfile:
    return OAuthProfile(
        provider="google",
        subject=str(userinfo["sub"]),
        email=userinfo.get("email"),
        email_verified=bool(userinfo.get("email_verified")),
        full_name=userinfo.get("name"),
        avatar_url=userinfo.get("picture"),
    )


def pick_github_email(emails: list[dict[str, Any]]) -> tuple[Optional[str], bool]:
    """Choose the best email from GitHub's /user/emails list.

    Prefer the primary verified address; fall back to any verified address.
    Returns (email, verified). Unverified addresses are never returned as
    verified.
    """
    primary = next(
        (e for e in emails if e.get("primary") and e.get("verified")), None
    )
    if primary:
        return primary["email"], True
    any_verified = next((e for e in emails if e.get("verified")), None)
    if any_verified:
        return any_verified["email"], True
    return None, False


def profile_from_github(user: dict[str, Any], emails: list[dict[str, Any]]) -> OAuthProfile:
    email, verified = pick_github_email(emails)
    if email is None:
        # Public profile email (if any) is not guaranteed verified.
        email = user.get("email")
        verified = False
    return OAuthProfile(
        provider="github",
        subject=str(user["id"]),
        email=email,
        email_verified=verified,
        full_name=user.get("name") or user.get("login"),
        avatar_url=user.get("avatar_url"),
    )


def resolve_account_action(
    by_identity: Optional[User],
    by_email: Optional[User],
    email_verified: bool,
) -> str:
    """Decide what to do with an incoming OAuth identity.

    Returns one of: ``existing`` (known identity), ``link`` (attach to an
    existing email account), ``create`` (brand-new account), or a ``reject_*``
    code. This is the security-critical decision and is pure for easy testing.
    """
    if by_identity is not None:
        return "existing"
    if by_email is not None:
        if not email_verified:
            return "reject_unverified"
        if by_email.oauth_provider is not None:
            # The email account is already linked to a different provider; our
            # schema holds one identity per user, so don't clobber it.
            return "reject_other_provider"
        return "link"
    return "create"


def _apply_profile(user: User, profile: OAuthProfile) -> None:
    user.full_name = profile.full_name or user.full_name
    user.avatar_url = profile.avatar_url or user.avatar_url


# ── DB upsert ─────────────────────────────────────────────────────────────────

async def upsert_oauth_user(db: AsyncSession, profile: OAuthProfile) -> User:
    if not profile.email:
        raise OAuthAccountError(
            "no_email", "Your provider account has no usable email address."
        )

    by_identity = (
        await db.execute(
            select(User).where(
                User.oauth_provider == profile.provider,
                User.oauth_subject == profile.subject,
            )
        )
    ).scalar_one_or_none()

    by_email = None
    if by_identity is None:
        by_email = (
            await db.execute(select(User).where(User.email == profile.email))
        ).scalar_one_or_none()

    action = resolve_account_action(by_identity, by_email, profile.email_verified)

    if action == "existing":
        user = by_identity
        _apply_profile(user, profile)
    elif action == "link":
        user = by_email
        user.oauth_provider = profile.provider
        user.oauth_subject = profile.subject
        user.is_email_verified = True
        _apply_profile(user, profile)
    elif action == "create":
        user = User(
            email=profile.email,
            hashed_password=None,
            is_active=True,
            oauth_provider=profile.provider,
            oauth_subject=profile.subject,
            is_email_verified=profile.email_verified,
            full_name=profile.full_name,
            avatar_url=profile.avatar_url,
        )
        db.add(user)
    elif action == "reject_unverified":
        raise OAuthAccountError(
            "email_unverified",
            "An account with this email exists. Verify your email with the "
            "provider, or sign in with your password to link the account.",
        )
    else:  # reject_other_provider
        raise OAuthAccountError(
            "already_linked",
            "This email is already linked to a different sign-in method.",
        )

    if not user.is_active:
        raise OAuthAccountError("inactive", "This account is disabled.")

    await db.commit()
    await db.refresh(user)
    return user


async def _fetch_profile(provider: str, client, token: dict) -> OAuthProfile:
    if provider == "google":
        userinfo = token.get("userinfo")
        if not userinfo:
            userinfo = await client.userinfo(token=token)
        return profile_from_google(dict(userinfo))

    # github
    user_resp = await client.get("user", token=token)
    emails_resp = await client.get("user/emails", token=token)
    return profile_from_github(user_resp.json(), emails_resp.json())


def _frontend_redirect(error_code: str | None = None) -> RedirectResponse:
    url = settings.frontend_url
    if error_code:
        url = f"{url}/?{urlencode({'auth_error': error_code})}"
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/oauth/{provider}/login")
@limiter.limit("10/minute")
async def oauth_login(request: Request, provider: str):
    client = _get_client(provider)
    redirect_uri = f"{settings.oauth_redirect_base}/auth/oauth/{provider}/callback"
    return await client.authorize_redirect(request, redirect_uri)


@router.get("/oauth/{provider}/callback")
@limiter.limit("10/minute")
async def oauth_callback(
    request: Request,
    provider: str,
    db: AsyncSession = Depends(get_db),
):
    client = _get_client(provider)
    try:
        token = await client.authorize_access_token(request)
        profile = await _fetch_profile(provider, client, token)
        user = await upsert_oauth_user(db, profile)
    except OAuthAccountError as exc:
        logger.info("OAuth account rejected (%s): %s", exc.code, exc)
        return _frontend_redirect(exc.code)
    except OAuthError as exc:
        logger.warning("OAuth flow error for %s: %s", provider, exc)
        return _frontend_redirect("oauth_failed")
    except Exception:  # noqa: BLE001 - never leak provider internals to the user
        logger.exception("Unexpected OAuth error for %s", provider)
        return _frontend_redirect("oauth_failed")

    response = _frontend_redirect()
    set_session_cookies(response, create_access_token(subject=str(user.id)))
    return response
