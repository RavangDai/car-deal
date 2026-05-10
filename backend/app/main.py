from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from celery.result import AsyncResult
from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import get_current_user, router as auth_router
from .celery_app import celery_app
from .db import engine, get_db
from .limiter import limiter
from .models import Listing, User
from .settings import settings
from .tasks import scrape_craigslist_task


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(
    title="Car Deal Finder API",
    version="0.5.0",
    description="Undervalued used cars — async scraping (Celery) + JWT auth + rate limiting.",
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

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth_router)


# ── Schemas ───────────────────────────────────────────────────────────────────

class Deal(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source: str
    url: str

    title: str
    description: Optional[str] = None

    listed_price: int
    predicted_price: int
    undervalue_percent: float

    year: int
    make: str
    model: str
    mileage: Optional[int] = None
    location: str

    created_at: datetime
    posted_at: datetime


class ScrapeJobAccepted(BaseModel):
    job_id: str
    status: str = "queued"
    city: str
    query: str
    max_results: int


class ScrapeJobStatus(BaseModel):
    job_id: str
    state: str
    progress: Optional[dict[str, Any]] = None
    result: Optional[dict[str, Any]] = None
    error: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health", tags=["meta"])
async def health_check():
    return {"status": "ok", "service": "car-deal-finder-api"}


@app.get("/deals", response_model=List[Deal], tags=["deals"])
@limiter.limit("60/minute")
async def list_deals(
    request: Request,
    min_undervalue_percent: float = 15.0,
    make: Optional[str] = None,
    model: Optional[str] = None,
    location: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Listing).where(Listing.undervalue_percent >= min_undervalue_percent)

    if make:
        stmt = stmt.where(Listing.make.ilike(make))
    if model:
        stmt = stmt.where(Listing.model.ilike(model))
    if location:
        stmt = stmt.where(Listing.location.ilike(f"%{location}%"))

    stmt = stmt.order_by(Listing.undervalue_percent.desc())

    result = await db.execute(stmt)
    return result.scalars().all()


@app.get("/deals/{deal_id}", response_model=Deal, tags=["deals"])
async def get_deal(deal_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Listing).where(Listing.id == deal_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Deal not found")
    return listing


@app.post(
    "/scrape/craigslist",
    response_model=ScrapeJobAccepted,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["scraper"],
)
@limiter.limit("5/minute")
async def enqueue_craigslist_scrape(
    request: Request,
    city: str,
    query: str,
    max_results: int = 10,
    user: User = Depends(get_current_user),
):
    async_result = scrape_craigslist_task.delay(
        city=city, query=query, max_results=max_results
    )
    return ScrapeJobAccepted(
        job_id=async_result.id,
        city=city,
        query=query,
        max_results=max_results,
    )


@app.get(
    "/scrape/jobs/{job_id}",
    response_model=ScrapeJobStatus,
    tags=["scraper"],
)
@limiter.limit("120/minute")
async def get_scrape_job(
    request: Request,
    job_id: str,
    user: User = Depends(get_current_user),
):
    result = AsyncResult(job_id, app=celery_app)
    state = result.state

    payload = ScrapeJobStatus(job_id=job_id, state=state)

    if state == "PROGRESS":
        info = result.info if isinstance(result.info, dict) else None
        payload.progress = info
    elif state == "SUCCESS":
        payload.result = result.result
    elif state == "FAILURE":
        payload.error = str(result.info) if result.info else "Task failed"

    return payload
