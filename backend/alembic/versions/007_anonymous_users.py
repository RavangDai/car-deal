"""anonymous users — full experience without an account

Signing in is for *keeping* things (history, recommendations, alert delivery),
not for unlocking them. That means a visitor who never signs up still tracks
products and sets alert rules, so those rows need an owner before an email
exists.

Two changes:

  users.email        NOT NULL -> NULL     an anonymous user has no address yet
  users.is_anonymous BOOLEAN NOT NULL     explicit rather than inferred

`email IS NULL` would technically be enough to identify an anonymous row, but
an explicit flag says what it means at the point of reading, and keeps the
door open for a claimed account that legitimately has no email.

Postgres allows unlimited NULLs under a UNIQUE index, so the existing unique
constraint on `email` keeps working unchanged: many anonymous rows can coexist
while real addresses stay unique.

Signing up does not create a second row -- `auth.register` claims the
anonymous row the caller is already holding, so everything they tracked as a
guest carries over with no merge step and nothing to lose.

Revision ID: 007
Revises: 006
Create Date: 2026-08-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("users", "email", existing_type=sa.String(), nullable=True)
    op.add_column(
        "users",
        sa.Column(
            "is_anonymous",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    # Partial index: the only query that filters on this is the cleanup of
    # stale anonymous rows, and the overwhelming majority of rows are not
    # anonymous once the product has real users.
    op.create_index(
        "ix_users_is_anonymous",
        "users",
        ["is_anonymous"],
        unique=False,
        postgresql_where=sa.text("is_anonymous"),
    )


def downgrade() -> None:
    # Anonymous rows have no address, so they cannot survive email becoming
    # NOT NULL again. Removing them is the only correct direction here.
    op.execute(sa.text("DELETE FROM users WHERE is_anonymous"))
    op.drop_index("ix_users_is_anonymous", table_name="users")
    op.drop_column("users", "is_anonymous")
    op.alter_column("users", "email", existing_type=sa.String(), nullable=False)
