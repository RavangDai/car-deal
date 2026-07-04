"""Tests for the Claude-backed extraction fallback and verdict generation.

Both modules must degrade gracefully when the API key is absent, and must
distinguish a transient RateLimitError (propagate so Celery retries) from
any other API failure (swallow and return None — tracking must never
depend on the LLM being up).
"""
from datetime import datetime, timezone
from decimal import Decimal

import anthropic
import httpx
import pytest

from app.ai import extract as extract_mod
from app.ai import verdict as verdict_mod
from app.ai.extract import LLMExtractedProduct, llm_extract_product
from app.ai.verdict import VerdictResult, generate_verdict
from app.dealmath import PriceStats


class FakeParsedResponse:
    def __init__(self, parsed_output):
        self.parsed_output = parsed_output


def _rate_limit_error() -> anthropic.RateLimitError:
    request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    response = httpx.Response(429, request=request)
    return anthropic.RateLimitError("rate limited", response=response, body=None)


def _server_error() -> anthropic.APIStatusError:
    request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    response = httpx.Response(500, request=request)
    return anthropic.APIStatusError("server error", response=response, body=None)


def make_stats(**overrides) -> PriceStats:
    defaults = dict(
        latest_price=Decimal("49.99"),
        latest_price_at=datetime.now(timezone.utc),
        median_90d=Decimal("69.99"),
        min_ever=Decimal("45.00"),
        min_90d=Decimal("45.00"),
        max_90d=Decimal("79.99"),
        discount_vs_median_pct=28.6,
        rarity=0.7,
        stability=0.9,
        drop_freshness=1.0,
        deal_score=78.5,
        is_lowest_ever=False,
        n_points=60,
        coverage_days=90,
    )
    defaults.update(overrides)
    return PriceStats(**defaults)


# ── extraction fallback ─────────────────────────────────────────────────

def test_llm_extract_disabled_returns_none_without_calling_client(monkeypatch):
    monkeypatch.setattr(extract_mod, "is_enabled", lambda: False)

    def _boom():
        raise AssertionError("get_client should not be called when AI is disabled")

    monkeypatch.setattr(extract_mod, "get_client", _boom)
    result = llm_extract_product("content", "https://example.com", model="claude-opus-4-8")
    assert result is None


def test_llm_extract_success_builds_product(monkeypatch):
    monkeypatch.setattr(extract_mod, "is_enabled", lambda: True)
    parsed = LLMExtractedProduct(
        title="Widget", price=49.99, currency="usd", image_url="https://x/img.jpg", in_stock=True
    )

    class FakeMessages:
        def parse(self, **kwargs):
            return FakeParsedResponse(parsed)

    class FakeClient:
        messages = FakeMessages()

    monkeypatch.setattr(extract_mod, "get_client", lambda: FakeClient())

    result = llm_extract_product("content", "https://example.com", model="claude-opus-4-8")
    assert result is not None
    assert result.title == "Widget"
    assert result.price == Decimal("49.99")
    assert result.currency == "USD"
    assert result.in_stock is True


@pytest.mark.parametrize("bad_price", [None, 0, -5])
def test_llm_extract_returns_none_for_missing_or_invalid_price(monkeypatch, bad_price):
    monkeypatch.setattr(extract_mod, "is_enabled", lambda: True)
    parsed = LLMExtractedProduct(
        title="Widget", price=bad_price, currency="USD", image_url=None, in_stock=True
    )

    class FakeMessages:
        def parse(self, **kwargs):
            return FakeParsedResponse(parsed)

    class FakeClient:
        messages = FakeMessages()

    monkeypatch.setattr(extract_mod, "get_client", lambda: FakeClient())
    result = llm_extract_product("content", "https://example.com", model="claude-opus-4-8")
    assert result is None


def test_llm_extract_propagates_rate_limit_for_celery_retry(monkeypatch):
    monkeypatch.setattr(extract_mod, "is_enabled", lambda: True)

    class FakeMessages:
        def parse(self, **kwargs):
            raise _rate_limit_error()

    class FakeClient:
        messages = FakeMessages()

    monkeypatch.setattr(extract_mod, "get_client", lambda: FakeClient())

    with pytest.raises(anthropic.RateLimitError):
        llm_extract_product("content", "https://example.com", model="claude-opus-4-8")


def test_llm_extract_swallows_generic_api_error(monkeypatch):
    monkeypatch.setattr(extract_mod, "is_enabled", lambda: True)

    class FakeMessages:
        def parse(self, **kwargs):
            raise _server_error()

    class FakeClient:
        messages = FakeMessages()

    monkeypatch.setattr(extract_mod, "get_client", lambda: FakeClient())
    result = llm_extract_product("content", "https://example.com", model="claude-opus-4-8")
    assert result is None


# ── verdict generation ────────────────────────────────────────────────────

def test_generate_verdict_disabled_returns_none_without_calling_client(monkeypatch):
    monkeypatch.setattr(verdict_mod, "is_enabled", lambda: False)

    def _boom():
        raise AssertionError("get_client should not be called when AI is disabled")

    monkeypatch.setattr(verdict_mod, "get_client", _boom)
    result = generate_verdict(make_stats(), "Widget", "USD", model="claude-opus-4-8")
    assert result is None


def test_generate_verdict_success(monkeypatch):
    monkeypatch.setattr(verdict_mod, "is_enabled", lambda: True)
    parsed = VerdictResult(verdict="buy", rationale="Lowest in months.", confidence="high")

    class FakeMessages:
        def parse(self, **kwargs):
            return FakeParsedResponse(parsed)

    class FakeClient:
        messages = FakeMessages()

    monkeypatch.setattr(verdict_mod, "get_client", lambda: FakeClient())

    result = generate_verdict(make_stats(), "Widget", "USD", model="claude-opus-4-8")
    assert result is not None
    assert result.verdict == "buy"
    assert result.confidence == "high"


def test_generate_verdict_propagates_rate_limit(monkeypatch):
    monkeypatch.setattr(verdict_mod, "is_enabled", lambda: True)

    class FakeMessages:
        def parse(self, **kwargs):
            raise _rate_limit_error()

    class FakeClient:
        messages = FakeMessages()

    monkeypatch.setattr(verdict_mod, "get_client", lambda: FakeClient())

    with pytest.raises(anthropic.RateLimitError):
        generate_verdict(make_stats(), "Widget", "USD", model="claude-opus-4-8")


def test_generate_verdict_swallows_generic_api_error(monkeypatch):
    monkeypatch.setattr(verdict_mod, "is_enabled", lambda: True)

    class FakeMessages:
        def parse(self, **kwargs):
            raise _server_error()

    class FakeClient:
        messages = FakeMessages()

    monkeypatch.setattr(verdict_mod, "get_client", lambda: FakeClient())
    result = generate_verdict(make_stats(), "Widget", "USD", model="claude-opus-4-8")
    assert result is None
