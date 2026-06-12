"""Offline unit tests for OAuth + cookie auth.

No network and no database: provider responses are plain dicts, the DB session
is a tiny fake, and Starlette ``Request`` objects are built by hand. The
security-critical surfaces covered here are the account-linking decision, the
CSRF double-submit check, and cookie-based session extraction.
"""

import asyncio
import types
import uuid

import pytest
from starlette.requests import Request

from app import oauth as oa
from app.auth import get_current_user
from app.cookies import CSRF_COOKIE, SESSION_COOKIE, require_csrf
from app.models import User
from app.security import create_access_token
from fastapi import HTTPException


# ── helpers ───────────────────────────────────────────────────────────────────

def _request(cookies: dict | None = None, headers: dict | None = None) -> Request:
    raw: list[tuple[bytes, bytes]] = []
    if cookies:
        cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
        raw.append((b"cookie", cookie_str.encode()))
    for k, v in (headers or {}).items():
        raw.append((k.lower().encode(), v.encode()))
    return Request({"type": "http", "method": "POST", "path": "/", "headers": raw})


class _Result:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class FakeSession:
    """Returns queued results for successive execute() calls."""

    def __init__(self, *results):
        self._results = list(results)
        self.added: list = []
        self.committed = False

    async def execute(self, _stmt):
        return _Result(self._results.pop(0))

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True

    async def refresh(self, _obj):
        pass


def _existing_user(**kw) -> User:
    defaults = dict(
        id=uuid.uuid4(),
        email="taken@example.com",
        is_active=True,
        oauth_provider=None,
        oauth_subject=None,
    )
    defaults.update(kw)
    return User(**defaults)


# ── provider profile extraction ───────────────────────────────────────────────

def test_profile_from_google():
    p = oa.profile_from_google(
        {"sub": "123", "email": "a@b.com", "email_verified": True, "name": "A", "picture": "u"}
    )
    assert p.provider == "google"
    assert p.subject == "123"
    assert p.email == "a@b.com"
    assert p.email_verified is True


def test_pick_github_email_prefers_primary_verified():
    emails = [
        {"email": "old@x.com", "primary": False, "verified": True},
        {"email": "main@x.com", "primary": True, "verified": True},
    ]
    assert oa.pick_github_email(emails) == ("main@x.com", True)


def test_pick_github_email_ignores_unverified():
    emails = [{"email": "u@x.com", "primary": True, "verified": False}]
    assert oa.pick_github_email(emails) == (None, False)


def test_profile_from_github_uses_verified_email():
    user = {"id": 99, "login": "octo", "name": "Octo", "avatar_url": "a", "email": None}
    emails = [{"email": "octo@x.com", "primary": True, "verified": True}]
    p = oa.profile_from_github(user, emails)
    assert p.subject == "99"
    assert p.email == "octo@x.com"
    assert p.email_verified is True
    assert p.full_name == "Octo"


# ── account-linking decision (the security matrix) ─────────────────────────────

def test_resolve_existing_identity_wins():
    u = _existing_user(oauth_provider="google", oauth_subject="1")
    assert oa.resolve_account_action(u, None, True) == "existing"


def test_resolve_links_verified_email():
    assert oa.resolve_account_action(None, _existing_user(), True) == "link"


def test_resolve_refuses_unverified_email():
    # The takeover guard: never link when the provider hasn't verified the email.
    assert oa.resolve_account_action(None, _existing_user(), False) == "reject_unverified"


def test_resolve_refuses_other_provider():
    other = _existing_user(oauth_provider="github", oauth_subject="7")
    assert oa.resolve_account_action(None, other, True) == "reject_other_provider"


def test_resolve_creates_when_no_match():
    assert oa.resolve_account_action(None, None, True) == "create"


# ── upsert_oauth_user (with fake session) ──────────────────────────────────────

def _run(coro):
    return asyncio.run(coro)


def test_upsert_creates_new_user():
    db = FakeSession(None, None)  # no identity match, no email match
    profile = oa.OAuthProfile("google", "1", "new@x.com", True, "New", None)
    user = _run(oa.upsert_oauth_user(db, profile))
    assert user in db.added
    assert db.committed
    assert user.oauth_provider == "google"
    assert user.is_email_verified is True


def test_upsert_links_verified_email():
    existing = _existing_user(email="link@x.com")
    db = FakeSession(None, existing)
    profile = oa.OAuthProfile("google", "1", "link@x.com", True, "L", None)
    user = _run(oa.upsert_oauth_user(db, profile))
    assert user is existing
    assert user.oauth_provider == "google"
    assert user.oauth_subject == "1"
    assert user.is_email_verified is True


def test_upsert_rejects_unverified_email():
    db = FakeSession(None, _existing_user(email="taken@x.com"))
    profile = oa.OAuthProfile("github", "1", "taken@x.com", False, None, None)
    with pytest.raises(oa.OAuthAccountError) as exc:
        _run(oa.upsert_oauth_user(db, profile))
    assert exc.value.code == "email_unverified"


def test_upsert_rejects_missing_email():
    db = FakeSession()
    profile = oa.OAuthProfile("github", "1", None, False, None, None)
    with pytest.raises(oa.OAuthAccountError) as exc:
        _run(oa.upsert_oauth_user(db, profile))
    assert exc.value.code == "no_email"


# ── CSRF double-submit ─────────────────────────────────────────────────────────

def test_require_csrf_accepts_matching_token():
    req = _request(cookies={CSRF_COOKIE: "tok123"}, headers={"X-CSRF-Token": "tok123"})
    _run(require_csrf(req))  # no exception


def test_require_csrf_rejects_mismatch():
    req = _request(cookies={CSRF_COOKIE: "tok123"}, headers={"X-CSRF-Token": "nope"})
    with pytest.raises(HTTPException) as exc:
        _run(require_csrf(req))
    assert exc.value.status_code == 403


def test_require_csrf_rejects_missing_header():
    req = _request(cookies={CSRF_COOKIE: "tok123"})
    with pytest.raises(HTTPException) as exc:
        _run(require_csrf(req))
    assert exc.value.status_code == 403


# ── cookie-based session extraction ────────────────────────────────────────────

class FakeDb:
    def __init__(self, user):
        self._user = user

    async def get(self, _model, _id):
        return self._user


def test_get_current_user_reads_jwt_from_cookie():
    user = _existing_user()
    token = create_access_token(subject=str(user.id))
    req = _request(cookies={SESSION_COOKIE: token})
    got = _run(get_current_user(req, FakeDb(user)))
    assert got is user


def test_get_current_user_missing_cookie_is_401():
    req = _request()
    with pytest.raises(HTTPException) as exc:
        _run(get_current_user(req, FakeDb(None)))
    assert exc.value.status_code == 401
