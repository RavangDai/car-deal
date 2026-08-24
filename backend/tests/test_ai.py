"""Tests for the Gemini-backed extraction fallback, verdict generation, and
the shared structured-output client.

Three contracts are pinned here:

1. All three features degrade to None when no API key is configured, without
   ever constructing a client.
2. The two retryable failure classes (429 -> RateLimitedError, 5xx ->
   TransientAIError) propagate so Celery's autoretry_for can back off, while
   every other API failure is swallowed - tracking must never depend on the
   LLM being up.
3. `response.parsed is None` is treated as a failure. This is not theoretical:
   a thinking-enabled model spends the whole output budget deliberating and
   returns exactly this shape, with no exception raised. Measured on
   gemini-3.5-flash with a system instruction and a 512-token cap, 0 of 4
   calls produced output. `app.ai.client` disables thinking to prevent it,
   and these tests pin the None-handling behind that.
"""
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from google.genai import errors

from app.ai import categorize as categorize_mod
from app.ai import client as client_mod
from app.ai import extract as extract_mod
from app.ai import verdict as verdict_mod
from app.ai.client import RateLimitedError, TransientAIError, generate_structured
from app.ai.extract import LLMExtractedProduct, llm_extract_product
from app.ai.verdict import VerdictResult, generate_verdict
from app.dealmath import PriceStats

EXTRACT_MODEL = "gemini-3.5-flash-lite"
VERDICT_MODEL = "gemini-3.5-flash"


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


class FakeResponse:
    """Mimics the SDK response surface generate_structured touches."""

    def __init__(self, parsed, finish_reason="STOP"):
        self.parsed = parsed
        self.candidates = [type("C", (), {"finish_reason": finish_reason})()]


def fake_client(*, returns=None, raises=None):
    """A stand-in for genai.Client exposing only models.generate_content."""

    class FakeModels:
        def generate_content(self, **kwargs):
            if raises is not None:
                raise raises
            return returns

    return type("FakeClient", (), {"models": FakeModels()})()


# -- the shared client: error mapping and None handling --------------------

def test_generate_structured_maps_429_to_rate_limited(monkeypatch):
    err = errors.ClientError(429, {"error": {"message": "quota", "code": 429}})
    monkeypatch.setattr(client_mod, "get_client", lambda: fake_client(raises=err))
    with pytest.raises(RateLimitedError):
        generate_structured(
            model=EXTRACT_MODEL, system="s", prompt="p",
            schema=VerdictResult, max_output_tokens=64,
        )


def test_generate_structured_maps_5xx_to_transient(monkeypatch):
    err = errors.ServerError(503, {"error": {"message": "busy", "code": 503}})
    monkeypatch.setattr(client_mod, "get_client", lambda: fake_client(raises=err))
    with pytest.raises(TransientAIError):
        generate_structured(
            model=EXTRACT_MODEL, system="s", prompt="p",
            schema=VerdictResult, max_output_tokens=64,
        )


def test_generate_structured_swallows_other_client_errors(monkeypatch):
    err = errors.ClientError(400, {"error": {"message": "bad request", "code": 400}})
    monkeypatch.setattr(client_mod, "get_client", lambda: fake_client(raises=err))
    result = generate_structured(
        model=EXTRACT_MODEL, system="s", prompt="p",
        schema=VerdictResult, max_output_tokens=64,
    )
    assert result is None


def test_generate_structured_treats_unparsable_response_as_failure(monkeypatch):
    """The silent failure mode: no exception, parsed is None. See module docstring."""
    monkeypatch.setattr(
        client_mod, "get_client",
        lambda: fake_client(returns=FakeResponse(None, finish_reason="MAX_TOKENS")),
    )
    result = generate_structured(
        model=VERDICT_MODEL, system="s", prompt="p",
        schema=VerdictResult, max_output_tokens=512,
    )
    assert result is None


def test_generate_structured_disables_thinking(monkeypatch):
    """Thinking must be off on every call, or the model can burn the entire
    output budget before emitting JSON."""
    captured = {}

    class FakeModels:
        def generate_content(self, **kwargs):
            captured.update(kwargs)
            return FakeResponse(
                VerdictResult(verdict="buy", rationale="r", confidence="high")
            )

    fake = type("FakeClient", (), {"models": FakeModels()})()
    monkeypatch.setattr(client_mod, "get_client", lambda: fake)

    generate_structured(
        model=VERDICT_MODEL, system="s", prompt="p",
        schema=VerdictResult, max_output_tokens=512,
    )

    assert captured["config"].thinking_config.thinking_budget == 0


# -- extraction fallback ---------------------------------------------------

def test_llm_extract_disabled_returns_none_without_calling_client(monkeypatch):
    monkeypatch.setattr(extract_mod, "is_enabled", lambda: False)

    def _boom(**kwargs):
        raise AssertionError("generate_structured must not be called when AI is disabled")

    monkeypatch.setattr(extract_mod, "generate_structured", _boom)
    assert llm_extract_product("content", "https://example.com", model=EXTRACT_MODEL) is None


def test_llm_extract_success_builds_product(monkeypatch):
    monkeypatch.setattr(extract_mod, "is_enabled", lambda: True)
    parsed = LLMExtractedProduct(
        title=" Widget ", price=49.99, currency="usd",
        image_url="https://x/img.jpg", in_stock=True,
    )
    monkeypatch.setattr(extract_mod, "generate_structured", lambda **kw: parsed)

    result = llm_extract_product("content", "https://example.com", model=EXTRACT_MODEL)
    assert result is not None
    assert result.title == "Widget"
    assert result.price == Decimal("49.99")
    assert result.currency == "USD"
    assert result.in_stock is True


@pytest.mark.parametrize("bad_price", [None, 0, -5])
def test_llm_extract_returns_none_for_missing_or_invalid_price(monkeypatch, bad_price):
    monkeypatch.setattr(extract_mod, "is_enabled", lambda: True)
    parsed = LLMExtractedProduct(
        title="Widget", price=bad_price, currency="USD", image_url=None, in_stock=True,
    )
    monkeypatch.setattr(extract_mod, "generate_structured", lambda **kw: parsed)
    assert llm_extract_product("content", "https://example.com", model=EXTRACT_MODEL) is None


def test_llm_extract_returns_none_when_model_produced_nothing(monkeypatch):
    monkeypatch.setattr(extract_mod, "is_enabled", lambda: True)
    monkeypatch.setattr(extract_mod, "generate_structured", lambda **kw: None)
    assert llm_extract_product("content", "https://example.com", model=EXTRACT_MODEL) is None


def test_llm_extract_propagates_rate_limit_for_celery_retry(monkeypatch):
    monkeypatch.setattr(extract_mod, "is_enabled", lambda: True)

    def _raise(**kwargs):
        raise RateLimitedError("429")

    monkeypatch.setattr(extract_mod, "generate_structured", _raise)
    with pytest.raises(RateLimitedError):
        llm_extract_product("content", "https://example.com", model=EXTRACT_MODEL)


def test_llm_extract_propagates_transient_for_celery_retry(monkeypatch):
    monkeypatch.setattr(extract_mod, "is_enabled", lambda: True)

    def _raise(**kwargs):
        raise TransientAIError("503")

    monkeypatch.setattr(extract_mod, "generate_structured", _raise)
    with pytest.raises(TransientAIError):
        llm_extract_product("content", "https://example.com", model=EXTRACT_MODEL)


# -- verdict generation ----------------------------------------------------

def test_generate_verdict_disabled_returns_none_without_calling_client(monkeypatch):
    monkeypatch.setattr(verdict_mod, "is_enabled", lambda: False)

    def _boom(**kwargs):
        raise AssertionError("generate_structured must not be called when AI is disabled")

    monkeypatch.setattr(verdict_mod, "generate_structured", _boom)
    assert generate_verdict(make_stats(), "Widget", "USD", model=VERDICT_MODEL) is None


def test_generate_verdict_success(monkeypatch):
    monkeypatch.setattr(verdict_mod, "is_enabled", lambda: True)
    parsed = VerdictResult(verdict="buy", rationale="Lowest in months.", confidence="high")
    monkeypatch.setattr(verdict_mod, "generate_structured", lambda **kw: parsed)

    result = generate_verdict(make_stats(), "Widget", "USD", model=VERDICT_MODEL)
    assert result is not None
    assert result.verdict == "buy"
    assert result.confidence == "high"


def test_generate_verdict_never_receives_raw_price_history(monkeypatch):
    """The product's core honesty guarantee: the model narrates computed
    statistics and is never handed the underlying series."""
    monkeypatch.setattr(verdict_mod, "is_enabled", lambda: True)
    captured = {}

    def _capture(**kwargs):
        captured.update(kwargs)
        return VerdictResult(verdict="wait", rationale="r", confidence="low")

    monkeypatch.setattr(verdict_mod, "generate_structured", _capture)
    generate_verdict(make_stats(), "Widget", "USD", model=VERDICT_MODEL)

    prompt = captured["prompt"]
    assert "deal_score_0_to_100" in prompt
    for leaked in ("price_points", "captured_at", "history", "series"):
        assert leaked not in prompt


def test_generate_verdict_propagates_rate_limit(monkeypatch):
    monkeypatch.setattr(verdict_mod, "is_enabled", lambda: True)

    def _raise(**kwargs):
        raise RateLimitedError("429")

    monkeypatch.setattr(verdict_mod, "generate_structured", _raise)
    with pytest.raises(RateLimitedError):
        generate_verdict(make_stats(), "Widget", "USD", model=VERDICT_MODEL)


def test_generate_verdict_returns_none_when_model_produced_nothing(monkeypatch):
    monkeypatch.setattr(verdict_mod, "is_enabled", lambda: True)
    monkeypatch.setattr(verdict_mod, "generate_structured", lambda **kw: None)
    assert generate_verdict(make_stats(), "Widget", "USD", model=VERDICT_MODEL) is None


# -- categorisation --------------------------------------------------------

def test_categorize_disabled_returns_none(monkeypatch):
    monkeypatch.setattr(categorize_mod, "is_enabled", lambda: False)
    assert categorize_mod.categorize_product("Widget", "shop.com", "m") is None


def test_categorize_blank_title_returns_none(monkeypatch):
    monkeypatch.setattr(categorize_mod, "is_enabled", lambda: True)
    assert categorize_mod.categorize_product("   ", "shop.com", "m") is None


def test_categorize_unknown_becomes_none(monkeypatch):
    monkeypatch.setattr(categorize_mod, "is_enabled", lambda: True)
    monkeypatch.setattr(
        categorize_mod, "generate_structured",
        lambda **kw: categorize_mod.CategoryResult(category="unknown"),
    )
    assert categorize_mod.categorize_product("Widget", "shop.com", "m") is None


def test_categorize_returns_normalized_slug(monkeypatch):
    monkeypatch.setattr(categorize_mod, "is_enabled", lambda: True)
    monkeypatch.setattr(
        categorize_mod, "generate_structured",
        lambda **kw: categorize_mod.CategoryResult(category="electronics"),
    )
    assert categorize_mod.categorize_product("Widget", "shop.com", "m") == "electronics"


@pytest.mark.parametrize("exc", [RateLimitedError("429"), TransientAIError("503")])
def test_categorize_swallows_retryable_errors(monkeypatch, exc):
    """Unlike extraction and verdict, categorisation runs inline inside the
    track job - a retryable AI error must not block or fail the track."""
    monkeypatch.setattr(categorize_mod, "is_enabled", lambda: True)

    def _raise(**kwargs):
        raise exc

    monkeypatch.setattr(categorize_mod, "generate_structured", _raise)
    assert categorize_mod.categorize_product("Widget", "shop.com", "m") is None


def test_generate_structured_retries_without_thinking_config_on_400(monkeypatch):
    """A model that does not think rejects being told not to think, with a 400.
    The client must learn that and retry, rather than treat it as a failure --
    gemini-3.5-flash-lite behaves exactly this way."""
    calls = []

    class FakeModels:
        def generate_content(self, **kwargs):
            has_thinking = kwargs["config"].thinking_config is not None
            calls.append(has_thinking)
            if has_thinking:
                raise errors.ClientError(
                    400, {"error": {"message": "invalid argument", "code": 400}}
                )
            return FakeResponse(
                VerdictResult(verdict="buy", rationale="r", confidence="high")
            )

    fake = type("FakeClient", (), {"models": FakeModels()})()
    monkeypatch.setattr(client_mod, "get_client", lambda: fake)
    monkeypatch.setattr(client_mod, "_NO_THINKING_CONFIG", set())

    result = generate_structured(
        model="fake-lite", system="s", prompt="p",
        schema=VerdictResult, max_output_tokens=64,
    )

    assert result is not None
    assert calls == [True, False], "should try with thinking config, then without"
    assert "fake-lite" in client_mod._NO_THINKING_CONFIG


def test_generate_structured_remembers_and_skips_the_failing_attempt(monkeypatch):
    """Once learned, the wasted 400 must not repeat on every subsequent call."""
    calls = []

    class FakeModels:
        def generate_content(self, **kwargs):
            calls.append(kwargs["config"].thinking_config is not None)
            return FakeResponse(
                VerdictResult(verdict="buy", rationale="r", confidence="high")
            )

    fake = type("FakeClient", (), {"models": FakeModels()})()
    monkeypatch.setattr(client_mod, "get_client", lambda: fake)
    monkeypatch.setattr(client_mod, "_NO_THINKING_CONFIG", {"known-lite"})

    generate_structured(
        model="known-lite", system="s", prompt="p",
        schema=VerdictResult, max_output_tokens=64,
    )
    assert calls == [False]


def test_generate_structured_does_not_swallow_unrelated_400(monkeypatch):
    """Only the thinking-config retry is special. A 400 that persists without
    thinking config still degrades to None rather than looping."""
    calls = []

    class FakeModels:
        def generate_content(self, **kwargs):
            calls.append(kwargs["config"].thinking_config is not None)
            raise errors.ClientError(
                400, {"error": {"message": "genuinely bad request", "code": 400}}
            )

    fake = type("FakeClient", (), {"models": FakeModels()})()
    monkeypatch.setattr(client_mod, "get_client", lambda: fake)
    monkeypatch.setattr(client_mod, "_NO_THINKING_CONFIG", set())

    result = generate_structured(
        model="fake-model", system="s", prompt="p",
        schema=VerdictResult, max_output_tokens=64,
    )
    assert result is None
    assert calls == [True, False], "retries once, then gives up"
