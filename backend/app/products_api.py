from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, List, Optional
from uuid import UUID

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .ai import is_enabled as ai_is_enabled
from .auth import get_current_user, get_current_user_optional
from .celery_app import celery_app
from .cookies import require_csrf
from .dealmath import PricePointData, daily_series
from .db import get_db
from .limiter import limiter
from .models import PricePoint, Product, ProductVerdict, User, Watch
from .preferences_api import read_onboarding
from .settings import settings
from .tasks import compute_verdict_task, track_url_task
from .taxonomy import normalize as normalize_category
from .urlnorm import InvalidUrlError, normalize_url

router = APIRouter(tags=["products"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class TrackIn(BaseModel):
    url: str


class TrackJobAccepted(BaseModel):
    job_id: str
    status: str = "queued"


class TrackJobStatus(BaseModel):
    job_id: str
    state: str
    progress: Optional[dict[str, Any]] = None
    result: Optional[dict[str, Any]] = None
    error: Optional[str] = None


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    url: str
    domain: str
    title: Optional[str] = None
    image_url: Optional[str] = None
    currency: Optional[str] = None
    category: Optional[str] = None
    status: str
    latest_price: Optional[Decimal] = None
    latest_price_at: Optional[datetime] = None
    median_90d: Optional[Decimal] = None
    min_ever: Optional[Decimal] = None
    is_lowest_ever: bool
    deal_score: Optional[Decimal] = None
    stats: Optional[dict[str, Any]] = None
    last_checked_at: Optional[datetime] = None
    created_at: datetime


class HistoryPoint(BaseModel):
    t: str
    price: Decimal
    in_stock: bool


class HistoryOut(BaseModel):
    currency: str
    points: List[HistoryPoint]
    median_90d: Optional[Decimal] = None
    min_ever: Optional[Decimal] = None


class VerdictOut(BaseModel):
    state: str  # ready | pending | unavailable
    verdict: Optional[str] = None
    rationale: Optional[str] = None
    confidence: Optional[str] = None
    computed_at: Optional[datetime] = None


# ── Track a URL ────────────────────────────────────────────────────────────

@router.post(
    "/products/track",
    response_model=TrackJobAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit("5/minute")
async def track_url(
    request: Request,
    response: Response,
    body: TrackIn,
    user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
    db: AsyncSession = Depends(get_db),
):
    try:
        normalize_url(body.url)
    except InvalidUrlError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    active_watches = await db.scalar(
        select(func.count())
        .select_from(Watch)
        .where(Watch.user_id == user.id, Watch.is_active.is_(True))
    )
    if active_watches is not None and active_watches >= settings.max_watches_per_user:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Max {settings.max_watches_per_user} tracked products reached",
        )

    async_result = track_url_task.delay(url=body.url, user_id=str(user.id))
    return TrackJobAccepted(job_id=async_result.id)


@router.get("/products/track/{job_id}", response_model=TrackJobStatus)
@limiter.limit("120/minute")
async def get_track_job(
    request: Request,
    response: Response,
    job_id: str,
    user: User = Depends(get_current_user),
):
    result = AsyncResult(job_id, app=celery_app)
    state = result.state

    payload = TrackJobStatus(job_id=job_id, state=state)
    if state == "PROGRESS":
        info = result.info if isinstance(result.info, dict) else None
        payload.progress = info
    elif state == "SUCCESS":
        payload.result = result.result
    elif state == "FAILURE":
        payload.error = str(result.info) if result.info else "Task failed"

    return payload


# ── Deals feed ─────────────────────────────────────────────────────────────

@router.get("/products", response_model=List[ProductOut])
@limiter.limit("60/minute")
async def list_products(
    request: Request,
    response: Response,
    sort: str = "deal_score",
    min_score: Optional[float] = None,
    q: Optional[str] = None,
    category: Optional[str] = None,
    personalized: bool = False,
    limit: int = 30,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    """Public deals feed.

    Stays the global ranking for everyone by default. When `personalized=1`
    AND a session resolves to an onboarded user, their stored category
    interests and sensitivity threshold are applied as filters.

    Personalization is opt-IN per request rather than implicit-on-session so
    that a shared/cached response and a signed-in one never differ for the
    same URL, and so the client can show an unfiltered feed on demand.
    """
    stmt = select(Product).where(Product.status.in_(["active", "demo"]))

    categories: list[str] = []
    slug = normalize_category(category)
    if slug:
        categories = [slug]

    effective_min = min_score

    if personalized and user is not None:
        prefs = read_onboarding(user)
        if prefs is not None:
            # An explicit query param always beats the stored profile: the
            # user is looking at a specific thing right now.
            if not categories and prefs.categories:
                categories = prefs.categories
            if effective_min is None:
                effective_min = prefs.min_score

    if categories:
        stmt = stmt.where(Product.category.in_(categories))

    if sort == "deal_score":
        stmt = stmt.where(Product.deal_score.is_not(None))
        if effective_min is not None:
            stmt = stmt.where(Product.deal_score >= effective_min)
        stmt = stmt.order_by(Product.deal_score.desc())
    else:
        stmt = stmt.order_by(Product.created_at.desc())

    if q:
        stmt = stmt.where(Product.title.ilike(f"%{q}%"))

    stmt = stmt.limit(min(max(limit, 1), 100)).offset(max(offset, 0))

    result = await db.execute(stmt)

    # NOTE: a personalized query that matches nothing returns nothing.
    #
    # An earlier version fell back to the global ranking here so the feed was
    # never empty. That is the wrong call for this product: the client labels
    # these results "matched to what you told us you shop for", and silently
    # substituting unrelated products makes that label a lie. On a service
    # whose entire pitch is that its claims are checkable, a feed that quietly
    # ignores your stated filter is the one bug users should never forgive.
    #
    # The client renders an explicit "nothing clears your threshold" state
    # instead, with a way to loosen the filter.
    return result.scalars().all()


@router.get("/products/{product_id}", response_model=ProductOut)
@limiter.limit("60/minute")
async def get_product(
    request: Request,
    response: Response,
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/products/{product_id}/history", response_model=HistoryOut)
@limiter.limit("60/minute")
async def get_product_history(
    request: Request,
    response: Response,
    product_id: UUID,
    window: str = "90",
    db: AsyncSession = Depends(get_db),
):
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    rows = (
        await db.execute(
            select(PricePoint.captured_at, PricePoint.price, PricePoint.in_stock)
            .where(PricePoint.product_id == product_id)
            .order_by(PricePoint.captured_at)
        )
    ).all()

    now = datetime.now(timezone.utc)
    data = [PricePointData(captured_at=r.captured_at, price=r.price) for r in rows]

    if window == "180":
        window_days = 180
    elif window == "all":
        window_days = (
            max((now.date() - rows[0].captured_at.date()).days + 1, 1) if rows else 90
        )
    else:
        window_days = 90

    series = daily_series(data, now, window_days=window_days)

    in_stock_by_day = {r.captured_at.date(): r.in_stock for r in rows}
    last_flag = True
    points: List[HistoryPoint] = []
    for day, price in series:
        if day in in_stock_by_day:
            last_flag = in_stock_by_day[day]
        points.append(HistoryPoint(t=day.isoformat(), price=price, in_stock=last_flag))

    return HistoryOut(
        currency=product.currency or "USD",
        points=points,
        median_90d=product.median_90d,
        min_ever=product.min_ever,
    )


@router.get("/products/{product_id}/verdict", response_model=VerdictOut)
@limiter.limit("10/minute")
async def get_product_verdict(
    request: Request,
    response: Response,
    product_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    if not ai_is_enabled():
        return VerdictOut(state="unavailable")

    latest_point_id = await db.scalar(
        select(PricePoint.id)
        .where(PricePoint.product_id == product_id)
        .order_by(PricePoint.captured_at.desc())
        .limit(1)
    )

    cached = await db.get(ProductVerdict, product_id)
    if cached is not None and cached.based_on_price_point_id == latest_point_id:
        return VerdictOut(
            state="ready",
            verdict=cached.verdict,
            rationale=cached.rationale,
            confidence=cached.confidence,
            computed_at=cached.computed_at,
        )

    if product.deal_score is None:
        return VerdictOut(state="unavailable")

    compute_verdict_task.delay(product_id=str(product_id))
    return VerdictOut(state="pending")
