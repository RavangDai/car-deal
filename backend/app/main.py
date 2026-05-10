from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import engine, AsyncSessionLocal
from .models import Listing
from .scraper_craigslist import search_craigslist_cars
from .settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(
    title="Car Deal Finder API",
    version="0.3.0",
    description="Finds undervalued used cars via async scraping + PostgreSQL.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Dependency ────────────────────────────────────────────────────────────────

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


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


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health", tags=["meta"])
async def health_check():
    return {"status": "ok", "service": "car-deal-finder-api"}


@app.get("/deals", response_model=List[Deal], tags=["deals"])
async def list_deals(
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


@app.post("/scrape/craigslist", tags=["scraper"])
async def scrape_craigslist(
    city: str,
    query: str,
    max_results: int = 10,
    db: AsyncSession = Depends(get_db),
):
    try:
        raw_listings = search_craigslist_cars(city=city, query=query, max_results=max_results)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Scraper error: {e}")

    inserted = 0

    for item in raw_listings:
        if not item.get("listed_price"):
            continue

        existing = await db.execute(select(Listing).where(Listing.url == item["url"]))
        if existing.scalar_one_or_none():
            continue

        predicted_price = int(item["listed_price"] * 1.15)
        undervalue_percent = (predicted_price - item["listed_price"]) / predicted_price * 100

        listing = Listing(
            source=item["source"],
            url=item["url"],
            title=item["title"],
            description=item.get("description"),
            listed_price=item["listed_price"],
            predicted_price=predicted_price,
            undervalue_percent=undervalue_percent,
            year=item.get("year") or 0,
            make=item["make"],
            model=item["model"],
            mileage=item.get("mileage"),
            location=item["location"],
            created_at=datetime.now(timezone.utc),
            posted_at=item["posted_at"],
        )

        db.add(listing)
        inserted += 1

    await db.commit()

    return {"inserted": inserted, "city": city, "query": query}
