from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime, timezone
import uuid

from .db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Canonical (tracking-param-stripped) URL, keyed globally so any user
    # pasting the same product is merged onto one tracked row. url_hash is a
    # fixed-width sha256 of the normalized URL — safer to index than a TEXT
    # column of unbounded length.
    url = Column(Text, nullable=False)
    url_hash = Column(String(64), nullable=False, unique=True, index=True)
    domain = Column(String, nullable=False, index=True)

    title = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    currency = Column(String(3), nullable=True)

    # Coarse product taxonomy, used to personalize the feed against a user's
    # stated interests. One of app.taxonomy.CATEGORIES, or NULL when nothing
    # has classified it yet — NULL is a normal, permanent state for products
    # tracked while no Anthropic key is configured, so every consumer must
    # treat "uncategorised" as a real case rather than a backfill gap.
    category = Column(String(32), nullable=True, index=True)

    # Which extraction strategy last succeeded, so daily rechecks can try it
    # first before falling back through the chain (cheap self-healing: a site
    # that adds JSON-LD later gets demoted off the LLM path automatically).
    extraction_strategy = Column(String, nullable=True)
    extraction_meta = Column(JSONB, nullable=True)

    # pending: tracked but not yet successfully extracted once.
    # active: tracking normally. unavailable: repeated fetch/parse failures.
    # blocked: site actively refuses automated checks (403/429/robots).
    # demo: seeded data, excluded from the daily recheck fan-out.
    status = Column(String, nullable=False, default="pending")
    consecutive_failures = Column(Integer, nullable=False, default=0)
    last_checked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    # Materialized stats, recomputed by the worker on every recheck (and once
    # at initial tracking). Recomputing here — rather than on read — is what
    # lets the deals feed sort/paginate by an indexed deal_score without
    # scanning price_points on every request.
    latest_price = Column(Numeric(12, 2), nullable=True)
    latest_price_at = Column(DateTime(timezone=True), nullable=True)
    median_90d = Column(Numeric(12, 2), nullable=True)
    min_ever = Column(Numeric(12, 2), nullable=True)
    is_lowest_ever = Column(Boolean, nullable=False, default=False)
    deal_score = Column(Numeric(5, 1), nullable=True)  # NULL = insufficient history
    stats = Column(JSONB, nullable=True)  # full component breakdown, for the UI


class PricePoint(Base):
    """Append-only price observation. Never overwritten, never deleted by
    normal operation — this table IS the price history."""

    __tablename__ = "price_points"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    product_id = Column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )

    price = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False)
    in_stock = Column(Boolean, nullable=False, default=True)

    captured_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    source = Column(String, nullable=False, default="scrape")  # scrape | seed | initial


class Watch(Base):
    """A user's subscription to price-drop alerts on one product."""

    __tablename__ = "watches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )

    rule_type = Column(String, nullable=False, default="any_drop")  # any_drop | percent_drop | target_price
    threshold = Column(Numeric(12, 2), nullable=True)  # % for percent_drop, price for target_price

    is_active = Column(Boolean, nullable=False, default=True)

    # Dedup/re-arm state: the price this watch last fired an alert at.
    last_notified_at = Column(DateTime(timezone=True), nullable=True)
    last_notified_price = Column(Numeric(12, 2), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_watches_user_product"),
    )


class AlertEvent(Base):
    """Audit trail + idempotency guard for fired alerts. The DB-level unique
    constraint on (watch_id, price_point_id) makes Celery task retries safe —
    a retried recheck can't double-fire the same alert."""

    __tablename__ = "alert_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    watch_id = Column(UUID(as_uuid=True), ForeignKey("watches.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)  # denormalized: survives watch edits
    product_id = Column(UUID(as_uuid=True), nullable=False)
    price_point_id = Column(BigInteger, ForeignKey("price_points.id"), nullable=False)

    rule_type = Column(String, nullable=False)  # snapshot at fire time
    threshold = Column(Numeric(12, 2), nullable=True)
    previous_price = Column(Numeric(12, 2), nullable=True)
    new_price = Column(Numeric(12, 2), nullable=False)

    status = Column(String, nullable=False, default="pending")  # pending | sent | failed | no_recipient
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    __table_args__ = (
        UniqueConstraint("watch_id", "price_point_id", name="uq_alert_events_watch_pricepoint"),
    )


class ProductVerdict(Base):
    """Cached AI "Buy or Wait" analysis. Valid iff based_on_price_point_id
    still matches the most recent price-changing point — i.e. roughly one
    Claude call per actual price change, not per page view."""

    __tablename__ = "product_verdicts"

    product_id = Column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True
    )
    verdict = Column(String, nullable=False)  # buy | wait | watch
    rationale = Column(Text, nullable=False)
    confidence = Column(String, nullable=True)  # low | medium | high
    model = Column(String, nullable=False)
    based_on_price_point_id = Column(BigInteger, nullable=False)
    computed_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Nullable: an anonymous user tracks products before giving an address.
    # Postgres allows unlimited NULLs under a UNIQUE index, so real addresses
    # stay unique while many anonymous rows coexist.
    email = Column(String, nullable=True, unique=True, index=True)
    # Nullable: OAuth-only users have no local password.
    hashed_password = Column(String, nullable=True)
    # A visitor who has acted but not signed up. Signing up claims this same
    # row rather than creating a second one, so their history carries over.
    is_anonymous = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)

    # OAuth / social login. `oauth_provider` is "google" | "github"; the pair
    # (oauth_provider, oauth_subject) is the provider's stable identity and is
    # uniquely constrained. `is_email_verified` gates account linking.
    oauth_provider = Column(String, nullable=True)
    oauth_subject = Column(String, nullable=True)
    is_email_verified = Column(Boolean, nullable=False, default=False)
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)

    # Onboarding answers and any later feed preferences. JSONB rather than a
    # column per answer: these are a product surface that will change shape
    # more often than the auth schema should, and nothing here is ever joined
    # or filtered on server-side. Shape is validated by app.schemas.Preferences
    # on the way in, so the looseness stops at the API boundary.
    preferences = Column(JSONB, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("oauth_provider", "oauth_subject", name="uq_users_oauth_identity"),
    )
