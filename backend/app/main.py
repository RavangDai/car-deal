# backend/app/main.py

from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from datetime import datetime
from uuid import UUID, uuid4
from fastapi.middleware.cors import CORSMiddleware

from .db import engine
from .models import Base, Listing          # 👈 Listing is safe now
from .scraper_craigslist import search_craigslist_cars

# Create tables
Base.metadata.create_all(bind=engine)


def get_db():
    # local import to avoid any chance of circular import
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
    source: str
    url: HttpUrl
    title: str
    description: str

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

    class Config:
        orm_mode = True


# ─────────────────────────────
#  ENDPOINTS
# ─────────────────────────────

@app.get("/health", tags=["meta"])
def health_check():
    return {"status": "ok", "service": "car-deal-finder-api"}


@app.get("/deals", response_model=List[Deal], tags=["deals"])
def list_deals(
    min_undervalue_percent: float = 15.0,
    make: Optional[str] = None,
    model: Optional[str] = None,
    location: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Listing)

    q = q.filter(Listing.undervalue_percent >= min_undervalue_percent)

    if make:
        q = q.filter(Listing.make.ilike(make))
    if model:
        q = q.filter(Listing.model.ilike(model))
    if location:
        q = q.filter(Listing.location.ilike(f"%{location}%"))

    q = q.order_by(Listing.undervalue_percent.desc())
    return q.all()


@app.get("/deals/{deal_id}", response_model=Deal, tags=["deals"])
def get_deal(deal_id: UUID, db: Session = Depends(get_db)):
    deal = db.query(Listing).filter(Listing.id == str(deal_id)).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


from uuid import uuid4  # keep this near the top if not already

@app.post("/scrape/craigslist", tags=["scraper"])
def scrape_craigslist(
    city: str = "austin",
    query: str = "honda civic",
    max_results: int = 10,
    db: Session = Depends(get_db),  # 👈 now uses DB
):
    """
    TEMP STUB:
    - Does NOT hit Craigslist
    - Generates fake deals
    - ALSO inserts them into the SQLite DB (Listing table)
    """

    now = datetime.utcnow()
    deals = []

    for i in range(max_results):
        listed_price = 8000 + i * 500
        predicted_price = int(listed_price * 1.2)
        undervalue_percent = (
            (predicted_price - listed_price) / predicted_price * 100
        )

        deal_id = str(uuid4())
        url = f"https://example.com/{city}/{query.replace(' ', '-')}/{i}"

        # 👇 skip if this URL already exists in DB
        existing = db.query(Listing).filter(Listing.url == url).first()
        if existing:
            continue

        # create DB row
        row = Listing(
            id=deal_id,
            source="stubbed_craigslist",
            url=url,
            title=f"201{5 + i} Honda Civic LX",
            description="Stubbed listing for local testing",
            listed_price=listed_price,
            predicted_price=predicted_price,
            undervalue_percent=undervalue_percent,
            year=2015 + i,
            make="Honda",
            model="Civic",
            mileage=70000 + i * 4000,
            location=f"{city}, TX",
            created_at=now,
            posted_at=now,
        )

        db.add(row)

        # also keep a JSON version to return
        deals.append(
            {
                "id": deal_id,
                "source": row.source,
                "url": row.url,
                "title": row.title,
                "description": row.description,
                "listed_price": row.listed_price,
                "predicted_price": row.predicted_price,
                "undervalue_percent": row.undervalue_percent,
                "year": row.year,
                "make": row.make,
                "model": row.model,
                "mileage": row.mileage,
                "location": row.location,
                "created_at": row.created_at,
                "posted_at": row.posted_at,
            }
        )

    db.commit()

    return {
        "inserted": len(deals),
        "city": city,
        "query": query,
        "deals": deals,
    }
