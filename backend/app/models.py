# backend/app/models.py

from uuid import uuid4
from sqlalchemy import Column, String, Integer, Float, DateTime
from .db import Base  # only import Base, nothing from main.py

class Listing(Base):
    __tablename__ = "listings"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))

    source = Column(String, nullable=False)       # e.g. "craigslist"
    url = Column(String, nullable=False, unique=True)

    title = Column(String, nullable=False)
    description = Column(String, nullable=False)

    listed_price = Column(Integer, nullable=False)
    predicted_price = Column(Integer, nullable=False)
    undervalue_percent = Column(Float, nullable=False)

    year = Column(Integer, nullable=False)
    make = Column(String, nullable=False)
    model = Column(String, nullable=False)
    mileage = Column(Integer)                     # optional
    location = Column(String, nullable=False)

    created_at = Column(DateTime, nullable=False)
    posted_at = Column(DateTime, nullable=False)
