from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import get_current_user_optional, get_or_create_session_user
from .cookies import require_csrf
from .db import get_db
from .limiter import limiter
from .models import AlertEvent, Product, User, Watch
from .products_api import ProductOut
from .settings import settings

router = APIRouter(tags=["watches"])

_VALID_RULE_TYPES = {"any_drop", "percent_drop", "target_price"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class WatchIn(BaseModel):
    product_id: UUID
    rule_type: str = "any_drop"
    threshold: Optional[Decimal] = None

    @field_validator("rule_type")
    @classmethod
    def _valid_rule_type(cls, v: str) -> str:
        if v not in _VALID_RULE_TYPES:
            raise ValueError(f"rule_type must be one of {sorted(_VALID_RULE_TYPES)}")
        return v


class WatchUpdateIn(BaseModel):
    rule_type: Optional[str] = None
    threshold: Optional[Decimal] = None
    is_active: Optional[bool] = None

    @field_validator("rule_type")
    @classmethod
    def _valid_rule_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _VALID_RULE_TYPES:
            raise ValueError(f"rule_type must be one of {sorted(_VALID_RULE_TYPES)}")
        return v


class WatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    rule_type: str
    threshold: Optional[Decimal] = None
    is_active: bool
    last_notified_at: Optional[datetime] = None
    created_at: datetime


class WatchWithProductOut(WatchOut):
    product: ProductOut


class AlertEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    rule_type: str
    previous_price: Optional[Decimal] = None
    new_price: Decimal
    status: str
    created_at: datetime


def _validate_rule(rule_type: str, threshold: Optional[Decimal]) -> None:
    if rule_type == "percent_drop":
        if threshold is None or not (Decimal("1") <= threshold <= Decimal("90")):
            raise HTTPException(
                status_code=422, detail="percent_drop threshold must be between 1 and 90"
            )
    elif rule_type == "target_price":
        if threshold is None or threshold <= 0:
            raise HTTPException(
                status_code=422, detail="target_price threshold must be greater than 0"
            )


# ── Watches ────────────────────────────────────────────────────────────────

@router.get("/watches", response_model=List[WatchWithProductOut])
@limiter.limit("60/minute")
async def list_watches(
    request: Request,
    response: Response,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    # No session at all means nobody has tracked anything yet on this browser.
    # An empty list is the honest answer; minting an identity just to read is
    # how a crawler ends up creating user rows.
    if user is None:
        return []

    rows = (
        await db.execute(
            select(Watch, Product)
            .join(Product, Product.id == Watch.product_id)
            .where(Watch.user_id == user.id)
            .order_by(Watch.created_at.desc())
        )
    ).all()

    return [
        WatchWithProductOut(
            id=w.id,
            product_id=w.product_id,
            rule_type=w.rule_type,
            threshold=w.threshold,
            is_active=w.is_active,
            last_notified_at=w.last_notified_at,
            created_at=w.created_at,
            product=ProductOut.model_validate(p),
        )
        for w, p in rows
    ]


@router.post("/watches", response_model=WatchOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_watch(
    request: Request,
    response: Response,
    body: WatchIn,
    user: User = Depends(get_or_create_session_user),
    _csrf: None = Depends(require_csrf),
    db: AsyncSession = Depends(get_db),
):
    _validate_rule(body.rule_type, body.threshold)

    product = await db.get(Product, body.product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = (
        await db.execute(
            select(Watch).where(Watch.user_id == user.id, Watch.product_id == body.product_id)
        )
    ).scalar_one_or_none()

    if existing is not None:
        existing.rule_type = body.rule_type
        existing.threshold = body.threshold
        existing.is_active = True
        watch = existing
    else:
        active_count = await db.scalar(
            select(func.count())
            .select_from(Watch)
            .where(Watch.user_id == user.id, Watch.is_active.is_(True))
        )
        if active_count is not None and active_count >= settings.max_watches_per_user:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Max {settings.max_watches_per_user} tracked products reached",
            )
        watch = Watch(
            user_id=user.id,
            product_id=body.product_id,
            rule_type=body.rule_type,
            threshold=body.threshold,
        )
        db.add(watch)

    await db.commit()
    await db.refresh(watch)
    return watch


@router.patch("/watches/{watch_id}", response_model=WatchOut)
@limiter.limit("20/minute")
async def update_watch(
    request: Request,
    response: Response,
    watch_id: UUID,
    body: WatchUpdateIn,
    user: User = Depends(get_or_create_session_user),
    _csrf: None = Depends(require_csrf),
    db: AsyncSession = Depends(get_db),
):
    watch = await db.get(Watch, watch_id)
    if watch is None or watch.user_id != user.id:
        raise HTTPException(status_code=404, detail="Watch not found")

    if body.rule_type is not None or body.threshold is not None:
        rule_type = body.rule_type or watch.rule_type
        threshold = body.threshold if body.threshold is not None else watch.threshold
        _validate_rule(rule_type, threshold)
        watch.rule_type = rule_type
        watch.threshold = threshold

    if body.is_active is not None:
        watch.is_active = body.is_active

    await db.commit()
    await db.refresh(watch)
    return watch


@router.delete("/watches/{watch_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("20/minute")
async def delete_watch(
    request: Request,
    response: Response,
    watch_id: UUID,
    user: User = Depends(get_or_create_session_user),
    _csrf: None = Depends(require_csrf),
    db: AsyncSession = Depends(get_db),
):
    watch = await db.get(Watch, watch_id)
    if watch is None or watch.user_id != user.id:
        raise HTTPException(status_code=404, detail="Watch not found")
    await db.delete(watch)
    await db.commit()


# ── Alerts ─────────────────────────────────────────────────────────────────

@router.get("/alerts", response_model=List[AlertEventOut])
@limiter.limit("60/minute")
async def list_alerts(
    request: Request,
    response: Response,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    if user is None:
        return []

    result = await db.execute(
        select(AlertEvent)
        .where(AlertEvent.user_id == user.id)
        .order_by(AlertEvent.created_at.desc())
        .limit(100)
    )
    return result.scalars().all()
