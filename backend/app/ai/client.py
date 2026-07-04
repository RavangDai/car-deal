"""Lazy Claude API client. Sync `anthropic.Anthropic` (not the async client)
because both the Celery workers that call this and FastAPI's request path
here are fine with a blocking call for these short, low-volume requests."""
from __future__ import annotations

import anthropic

from ..settings import settings

_client: anthropic.Anthropic | None = None


def is_enabled() -> bool:
    """False when no API key is configured — every caller must degrade
    gracefully (extraction falls back to structured-data-only; the verdict
    endpoint reports 'unavailable') rather than error."""
    return bool(settings.anthropic_api_key)


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client
