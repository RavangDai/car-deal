from sqlalchemy import Column, String, Integer, Float, DateTime, Text, Boolean, UniqueConstraint
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


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, nullable=False, unique=True, index=True)
    # Nullable: OAuth-only users have no local password.
    hashed_password = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    # OAuth / social login. `oauth_provider` is "google" | "github"; the pair
    # (oauth_provider, oauth_subject) is the provider's stable identity and is
    # uniquely constrained. `is_email_verified` gates account linking.
    oauth_provider = Column(String, nullable=True)
    oauth_subject = Column(String, nullable=True)
    is_email_verified = Column(Boolean, nullable=False, default=False)
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("oauth_provider", "oauth_subject", name="uq_users_oauth_identity"),
    )
