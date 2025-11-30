from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from datetime import datetime
from uuid import UUID, uuid4
from fastapi.middleware.cors import CORSMiddleware
from .db import engine
from .models import Base

Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="Car Deal Finder API",
    version="0.1.0",
    description="Backend for Car Deal Finder AI Agent (v1 with mock data).",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Deal(BaseModel):
    id: UUID
    source: str  # "craigslist", "fb_marketplace", etc.
    url: HttpUrl

    title: str
    description: str

    listed_price: int
    predicted_price: int
    undervalue_percent: float  # (pred - listed)/pred * 100

    year: int
    make: str
    model: str
    mileage: Optional[int] = None
    location: str

    created_at: datetime
    posted_at: datetime


def _mock_deals() -> List[Deal]:
    now = datetime.utcnow()
    return [
        Deal(
            id=uuid4(),
            source="craigslist",
            url="https://example.com/listing/1",
            title="2016 Honda Civic LX",
            description="Single owner, clean title, no accidents. Great condition.",
            listed_price=10500,
            predicted_price=13000,
            undervalue_percent=(13000 - 10500) / 13000 * 100,
            year=2016,
            make="Honda",
            model="Civic",
            mileage=78000,
            location="Austin, TX",
            created_at=now,
            posted_at=now,
        ),
        Deal(
            id=uuid4(),
            source="craigslist",
            url="https://example.com/listing/2",
            title="2015 Toyota Camry SE",
            description="Some cosmetic scratches, mechanically sound, new tires.",
            listed_price=9500,
            predicted_price=11500,
            undervalue_percent=(11500 - 9500) / 11500 * 100,
            year=2015,
            make="Toyota",
            model="Camry",
            mileage=98000,
            location="Dallas, TX",
            created_at=now,
            posted_at=now,
        ),
        Deal(
            id=uuid4(),
            source="fb_marketplace",
            url="https://example.com/listing/3",
            title="2018 Mazda 3 Touring",
            description="Low mileage, dealer serviced, no issues.",
            listed_price=15000,
            predicted_price=17000,
            undervalue_percent=(17000 - 15000) / 17000 * 100,
            year=2018,
            make="Mazda",
            model="3",
            mileage=45000,
            location="Houston, TX",
            created_at=now,
            posted_at=now,
        ),
    ]


DEALS_DB: List[Deal] = _mock_deals()


@app.get("/health", tags=["meta"])
def health_check():
    return {"status": "ok", "service": "car-deal-finder-api"}


@app.get("/deals", response_model=List[Deal], tags=["deals"])
def list_deals(
    min_undervalue_percent: float = 15.0,
    make: Optional[str] = None,
    model: Optional[str] = None,
    location: Optional[str] = None,
):
    results = []

    for deal in DEALS_DB:
        if deal.undervalue_percent < min_undervalue_percent:
            continue

        if make and deal.make.lower() != make.lower():
            continue

        if model and deal.model.lower() != model.lower():
            continue

        if location and location.lower() not in deal.location.lower():
            continue

        results.append(deal)

    results.sort(key=lambda d: d.undervalue_percent, reverse=True)
    return results


@app.get("/deals/{deal_id}", response_model=Deal, tags=["deals"])
def get_deal(deal_id: UUID):
    for deal in DEALS_DB:
        if deal.id == deal_id:
            return deal
    raise HTTPException(status_code=404, detail="Deal not found")
