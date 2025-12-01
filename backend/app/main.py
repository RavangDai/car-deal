from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from datetime import datetime
from uuid import UUID, uuid4
from uuid import uuid4
from fastapi.middleware.cors import CORSMiddleware
from .db import engine
from .models import Base
from .scraper_craigslist import search_craigslist_cars

Base.metadata.create_all(bind=engine)

def get_db():
    # local import to avoid any circular import problems
    from .db import SessionLocal

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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

from uuid import uuid4

@app.post("/scrape/craigslist", tags=["scraper"])
def scrape_craigslist(
    city: str = "austin",
    query: str = "honda civic",
    max_results: int = 10,
):
    """
    TEMP STUB:
    - Does NOT hit Craigslist
    - Does NOT touch the DB
    - Just generates some fake deals and returns them
    so the rest of the app can be built safely.
    """

    now = datetime.utcnow()
    deals = []

    for i in range(max_results):
        listed_price = 8000 + i * 500
        predicted_price = int(listed_price * 1.2)
        undervalue_percent = (
            (predicted_price - listed_price) / predicted_price * 100
        )

        deals.append(
            {
                "id": str(uuid4()),
                "source": "stubbed_craigslist",
                "url": f"https://example.com/{city}/{query.replace(' ', '-')}/{i}",
                "title": f"201{5 + i} Honda Civic LX",
                "description": "Stubbed listing for local testing",
                "listed_price": listed_price,
                "predicted_price": predicted_price,
                "undervalue_percent": undervalue_percent,
                "year": 2015 + i,
                "make": "Honda",
                "model": "Civic",
                "mileage": 70000 + i * 4000,
                "location": f"{city}, TX",
                "created_at": now,
                "posted_at": now,
            }
        )

    return {
        "inserted": len(deals),
        "city": city,
        "query": query,
        "deals": deals,
    }
