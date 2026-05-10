"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_unique_constraint("uq_listings_url", "listings", ["url"])
    op.create_index("ix_listings_undervalue_percent", "listings", ["undervalue_percent"])
    op.create_index("ix_listings_make", "listings", ["make"])
    op.create_index("ix_listings_created_at", "listings", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_listings_created_at", "listings")
    op.drop_index("ix_listings_make", "listings")
    op.drop_index("ix_listings_undervalue_percent", "listings")
    op.drop_constraint("uq_listings_url", "listings")
    op.drop_table("listings")
