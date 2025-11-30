from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from .db import Base

class Car(Base):
    __tablename__ = "cars"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String)
    price = Column(Float)
    url = Column(String, unique=True)
    source = Column(String)  # craigslist / fb marketplace / autotrader
    created_at = Column(DateTime, server_default=func.now())
