"""oauth fields on users

Adds social-login support: makes hashed_password nullable (OAuth-only users
have no local password) and adds the provider identity + profile columns.

Revision ID: 003
Revises: 002
Create Date: 2026-06-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=True)

    op.add_column("users", sa.Column("oauth_provider", sa.String(), nullable=True))
    op.add_column("users", sa.Column("oauth_subject", sa.String(), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "is_email_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column("users", sa.Column("full_name", sa.String(), nullable=True))
    op.add_column("users", sa.Column("avatar_url", sa.String(), nullable=True))

    op.create_unique_constraint(
        "uq_users_oauth_identity", "users", ["oauth_provider", "oauth_subject"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_oauth_identity", "users", type_="unique")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "full_name")
    op.drop_column("users", "is_email_verified")
    op.drop_column("users", "oauth_subject")
    op.drop_column("users", "oauth_provider")
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=False)
