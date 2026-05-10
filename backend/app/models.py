from sqlalchemy import Column, String, Integer, Float, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
import uuid

from .db import Base


class Listing(Base):
    __tablename__ = "listings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    source = Column(String, nullable=False)
    url = Column(String, nullable=False, unique=True)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    listed_price = Column(Integer, nullable=False)
    predicted_price = Column(Integer, nullable=False)
    undervalue_percent = Column(Float, nullable=False)

    year = Column(Integer, nullable=False)
    make = Column(String, nullable=False)
    model = Column(String, nullable=False)
    mileage = Column(Integer, nullable=True)

    location = Column(String, nullable=False)

    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    posted_at = Column(DateTime(timezone=True), nullable=False)
