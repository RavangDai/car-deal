from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from .db import Base

class Listing(Base):
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String, index=True)
    url = Column(String, unique=True, index=True)

    title = Column(String)
    description = Column(String)

    listed_price = Column(Integer)
    predicted_price = Column(Integer)
    undervalue_percent = Column(Float)

    year = Column(Integer, index=True)
    make = Column(String, index=True)
    model = Column(String, index=True)
    mileage = Column(Integer, nullable=True)
    location = Column(String)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    posted_at = Column(DateTime(timezone=True), server_default=func.now())
