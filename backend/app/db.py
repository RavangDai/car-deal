from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .settings import settings


class Base(DeclarativeBase):
    pass


# Async engine — used by FastAPI request handlers via `get_db` dependency.
engine = create_async_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


def _to_sync_url(async_url: str) -> str:
    # asyncpg is async-only, so Celery workers (sync) need a psycopg2 URL.
    return async_url.replace("+asyncpg", "+psycopg2", 1)


sync_engine = create_engine(
    _to_sync_url(settings.database_url),
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    future=True,
)

SyncSessionLocal = sessionmaker(
    sync_engine,
    autoflush=False,
    expire_on_commit=False,
    future=True,
)


# Shared FastAPI dependency for async DB sessions.
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
