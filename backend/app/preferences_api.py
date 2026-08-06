"""Onboarding answers and feed preferences for a signed-in user.

Stored as one JSONB blob on `users.preferences`, validated by Pydantic on the
way in so the looseness of JSONB stops at the API boundary.

Guests have no row here at all. The frontend keeps their answers in
localStorage and POSTs them once, at the moment an account is created — see
frontend/src/onboarding.ts and the merge in auth.register / oauth.upsert.
"""

from datetime import datetime, timezone
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import get_current_user
from .cookies import require_csrf
from .db import get_db
from .limiter import limiter
from .models import User
from .taxonomy import CATEGORIES, normalize

router = APIRouter(tags=["preferences"])

# How picky the user said they are, and the minimum deal_score each implies.
# Kept here rather than in the client so the threshold can be retuned without
# shipping a frontend release, and so both the feed query and any future
# alert-fanout read one definition.
SENSITIVITY_MIN_SCORE: dict[str, float] = {
    "any": 0.0,      # show me everything that scored at all
    "strong": 55.0,  # only drops that hold up
    "lowest": 75.0,  # near-lowest-ever territory only
}

Sensitivity = Literal["any", "strong", "lowest"]
Cadence = Literal["instant", "daily", "weekly", "off"]


class Onboarding(BaseModel):
    """The four onboarding answers. Every field is optional: the flow is
    skippable at any step, and a partially-completed profile is a normal
    state that must round-trip rather than 422."""

    version: int = 1
    completed_at: Optional[datetime] = None

    categories: list[str] = Field(default_factory=list, max_length=len(CATEGORIES))
    budget_min: Optional[float] = Field(default=None, ge=0)
    budget_max: Optional[float] = Field(default=None, ge=0)
    sensitivity: Sensitivity = "strong"
    alert_cadence: Cadence = "daily"

    @field_validator("categories")
    @classmethod
    def _known_categories(cls, v: list[str]) -> list[str]:
        # Drop anything we don't recognise rather than 422: a stale slug in a
        # client's localStorage from a previous taxonomy must not make the
        # whole profile unsaveable.
        seen: set[str] = set()
        out: list[str] = []
        for raw in v:
            slug = normalize(raw)
            if slug and slug not in seen:
                seen.add(slug)
                out.append(slug)
        return out

    @field_validator("budget_max")
    @classmethod
    def _sane_budget(cls, v: Optional[float], info) -> Optional[float]:
        lo = info.data.get("budget_min")
        if v is not None and lo is not None and v < lo:
            raise ValueError("budget_max must be greater than or equal to budget_min")
        return v

    @property
    def min_score(self) -> float:
        return SENSITIVITY_MIN_SCORE.get(self.sensitivity, 0.0)


class PreferencesOut(BaseModel):
    onboarding: Optional[Onboarding] = None
    """True once the user has finished (or explicitly skipped) onboarding."""
    onboarded: bool = False


class PreferencesIn(BaseModel):
    onboarding: Onboarding


def read_onboarding(user: User) -> Optional[Onboarding]:
    """Parsed onboarding block for a user, or None.

    Shared with products_api for feed personalization, so that the mapping
    from a stored profile to query filters lives in one place. Returns None
    for users who never onboarded and for any stored blob that no longer
    parses, both of which mean "no personalization" rather than an error.
    """
    raw = user.preferences or {}
    if not isinstance(raw, dict):
        return None
    block = raw.get("onboarding")
    if not isinstance(block, dict):
        return None
    try:
        return Onboarding.model_validate(block)
    except ValueError:
        return None


def _read(user: User) -> PreferencesOut:
    raw = user.preferences or {}
    block = raw.get("onboarding") if isinstance(raw, dict) else None
    if not isinstance(block, dict):
        return PreferencesOut(onboarding=None, onboarded=False)
    try:
        parsed = Onboarding.model_validate(block)
    except ValueError:
        # A profile written by an older//broken client must not 500 the
        # endpoint — treat it as "not onboarded" and let the user redo it.
        return PreferencesOut(onboarding=None, onboarded=False)
    return PreferencesOut(onboarding=parsed, onboarded=parsed.completed_at is not None)


@router.get("/me/preferences", response_model=PreferencesOut)
@limiter.limit("60/minute")
async def get_preferences(
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
):
    return _read(user)


@router.put("/me/preferences", response_model=PreferencesOut)
@limiter.limit("30/minute")
async def put_preferences(
    request: Request,
    response: Response,
    body: PreferencesIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _csrf: Annotated[None, Depends(require_csrf)] = None,
):
    incoming = body.onboarding
    if incoming.completed_at is None:
        incoming = incoming.model_copy(update={"completed_at": datetime.now(timezone.utc)})

    # Replace the onboarding block, preserve anything else already stored.
    current = dict(user.preferences or {})
    current["onboarding"] = incoming.model_dump(mode="json")
    # Reassign rather than mutate: SQLAlchemy does not track in-place changes
    # to a JSONB dict, so mutating user.preferences would never be flushed.
    user.preferences = current

    await db.commit()
    await db.refresh(user)
    return _read(user)
