"""onboarding preferences + product categories

Adds the two columns personalization needs:

  users.preferences   JSONB  — onboarding answers (categories, budget,
                               sensitivity, alert cadence). Nullable; NULL
                               means the user has not onboarded.
  products.category   VARCHAR(32) — coarse taxonomy slug, indexed for the
                               feed filter. Nullable; NULL means nothing has
                               classified this product yet.

Also backfills `category` for the seeded demo catalog, whose category was
already being written into extraction_meta->>'category' by
scripts/seed_products.py but never promoted to a queryable column. Only rows
where the value is a slug we recognise are backfilled; anything else is left
NULL for the classifier to pick up.

Revision ID: 006
Revises: 005
Create Date: 2026-08-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Duplicated from app.taxonomy on purpose: a migration must describe the
# schema at ITS point in history and must not drift when the application
# taxonomy later gains or loses a slug.
_SEEDED_SLUGS = ("electronics", "kitchen", "gaming", "home")


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("preferences", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("products", sa.Column("category", sa.String(length=32), nullable=True))

    # Partial index: the feed only ever filters categorised rows, and leaving
    # the ~all-NULL tail out keeps the index small while real products are
    # still mostly unclassified.
    op.create_index(
        "ix_products_category",
        "products",
        ["category"],
        unique=False,
        postgresql_where=sa.text("category IS NOT NULL"),
    )

    op.execute(
        sa.text(
            """
            UPDATE products
               SET category = extraction_meta->>'category'
             WHERE category IS NULL
               AND extraction_meta->>'category' = ANY(:slugs)
            """
        ).bindparams(sa.bindparam("slugs", value=list(_SEEDED_SLUGS)))
    )


def downgrade() -> None:
    op.drop_index("ix_products_category", table_name="products")
    op.drop_column("products", "category")
    op.drop_column("users", "preferences")
