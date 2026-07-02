"""listing images

Adds per-listing photos: a primary image URL (hotlinked) and a best-effort
gallery (JSONB array) for the detail page. Both nullable — image scraping is
best-effort and the UI degrades to a neutral placeholder when absent.

Revision ID: 004
Revises: 003
Create Date: 2026-06-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("listings", sa.Column("image_url", sa.String(), nullable=True))
    op.add_column(
        "listings",
        sa.Column("image_urls", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("listings", "image_urls")
    op.drop_column("listings", "image_url")
