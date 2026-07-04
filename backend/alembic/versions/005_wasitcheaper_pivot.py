"""wasitcheaper pivot

Drops the car-specific `listings` table and replaces it with a
domain-agnostic price-history schema: products (global, keyed by normalized
URL), price_points (append-only time series), watches (per-user alert
subscriptions), alert_events (fired-alert audit + idempotency), and
product_verdicts (cached AI buy/wait analysis). `users` is untouched — auth
keeps working through this migration.

Revision ID: 005
Revises: 004
Create Date: 2026-07-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("listings")

    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("url_hash", sa.String(length=64), nullable=False),
        sa.Column("domain", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=True),
        sa.Column("extraction_strategy", sa.String(), nullable=True),
        sa.Column("extraction_meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("consecutive_failures", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("latest_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("latest_price_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("median_90d", sa.Numeric(12, 2), nullable=True),
        sa.Column("min_ever", sa.Numeric(12, 2), nullable=True),
        sa.Column("is_lowest_ever", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("deal_score", sa.Numeric(5, 1), nullable=True),
        sa.Column("stats", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_unique_constraint("uq_products_url_hash", "products", ["url_hash"])
    op.create_index("ix_products_url_hash", "products", ["url_hash"])
    op.create_index("ix_products_domain", "products", ["domain"])
    op.create_index(
        "ix_products_deal_score",
        "products",
        [sa.text("deal_score DESC NULLS LAST")],
        postgresql_where=sa.text("status = 'active'"),
    )
    op.create_index(
        "ix_products_last_checked",
        "products",
        ["last_checked_at"],
        postgresql_where=sa.text("status IN ('active', 'failed', 'unavailable')"),
    )

    op.create_table(
        "price_points",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("in_stock", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(), nullable=False, server_default="scrape"),
    )
    op.create_index(
        "ix_price_points_product_time",
        "price_points",
        ["product_id", sa.text("captured_at DESC")],
    )

    op.create_table(
        "watches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rule_type", sa.String(), nullable=False, server_default="any_drop"),
        sa.Column("threshold", sa.Numeric(12, 2), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_notified_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_unique_constraint("uq_watches_user_product", "watches", ["user_id", "product_id"])
    op.create_index(
        "ix_watches_product",
        "watches",
        ["product_id"],
        postgresql_where=sa.text("is_active"),
    )

    op.create_table(
        "alert_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "watch_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("watches.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "price_point_id",
            sa.BigInteger(),
            sa.ForeignKey("price_points.id"),
            nullable=False,
        ),
        sa.Column("rule_type", sa.String(), nullable=False),
        sa.Column("threshold", sa.Numeric(12, 2), nullable=True),
        sa.Column("previous_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("new_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_unique_constraint(
        "uq_alert_events_watch_pricepoint", "alert_events", ["watch_id", "price_point_id"]
    )
    op.create_index("ix_alert_events_user", "alert_events", ["user_id", sa.text("created_at DESC")])

    op.create_table(
        "product_verdicts",
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("verdict", sa.String(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("confidence", sa.String(), nullable=True),
        sa.Column("model", sa.String(), nullable=False),
        sa.Column("based_on_price_point_id", sa.BigInteger(), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("product_verdicts")
    op.drop_index("ix_alert_events_user", "alert_events")
    op.drop_constraint("uq_alert_events_watch_pricepoint", "alert_events")
    op.drop_table("alert_events")
    op.drop_index("ix_watches_product", "watches")
    op.drop_constraint("uq_watches_user_product", "watches")
    op.drop_table("watches")
    op.drop_index("ix_price_points_product_time", "price_points")
    op.drop_table("price_points")
    op.drop_index("ix_products_last_checked", "products")
    op.drop_index("ix_products_deal_score", "products")
    op.drop_index("ix_products_domain", "products")
    op.drop_index("ix_products_url_hash", "products")
    op.drop_constraint("uq_products_url_hash", "products")
    op.drop_table("products")

    op.create_table(
        "listings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("listed_price", sa.Integer(), nullable=False),
        sa.Column("predicted_price", sa.Integer(), nullable=False),
        sa.Column("undervalue_percent", sa.Float(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("make", sa.String(), nullable=False),
        sa.Column("model", sa.String(), nullable=False),
        sa.Column("mileage", sa.Integer(), nullable=True),
        sa.Column("location", sa.String(), nullable=False),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.Column("image_urls", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_unique_constraint("uq_listings_url", "listings", ["url"])
    op.create_index("ix_listings_undervalue_percent", "listings", ["undervalue_percent"])
    op.create_index("ix_listings_make", "listings", ["make"])
    op.create_index("ix_listings_created_at", "listings", ["created_at"])
