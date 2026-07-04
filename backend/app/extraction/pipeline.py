"""Extraction orchestration: fetch -> structured chain -> LLM fallback ->
validate, plus the strategy-recording behavior that keeps recheck cost down.

Cost-critical design note: `recheck_product` always tries the free
structured-data chain first, regardless of which strategy last succeeded.
The recorded strategy on `Product.extraction_strategy` is a *hint* for
display/diagnostics, not a shortcut that skips straight to the LLM — a
naive "reuse last strategy" reading would mean one Claude call per product
per day forever for any site that needed the LLM once. Running structured
parsing first is free, and lets a product self-heal off the LLM path the
day a site adds JSON-LD.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Callable

from .fetch import FetchError, SsrfBlockedError, safe_fetch
from .llm import llm_extract
from .structured import extract_structured
from .types import ExtractedProduct, ExtractionResult

MAX_PLAUSIBLE_PRICE = Decimal("10000000")
KNOWN_CURRENCIES = {
    "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "MXN", "BRL", "CHF",
    "SEK", "NOK", "DKK", "NZD", "CNY", "KRW", "SGD", "HKD", "ZAR", "PLN",
}

_BOT_WALL_MARKERS = (
    "cloudflare",
    "captcha",
    "access denied",
    "are you a robot",
    "perimeterx",
    "attention required",
)


class ExtractionFailedError(RuntimeError):
    """Neither structured parsing nor the LLM fallback found a valid
    product on the page."""


def _validate(product: ExtractedProduct) -> None:
    if product.price <= 0 or product.price >= MAX_PLAUSIBLE_PRICE:
        raise ValueError(f"implausible price: {product.price}")
    if not product.title or not product.title.strip():
        raise ValueError("empty title")
    if product.currency not in KNOWN_CURRENCIES:
        raise ValueError(f"unrecognized currency: {product.currency}")


def _looks_bot_walled(html: str) -> bool:
    lowered = html[:5000].lower()
    return any(marker in lowered for marker in _BOT_WALL_MARKERS)


def extract_product(
    url: str, on_stage: Callable[[str], None] | None = None
) -> ExtractionResult:
    """First-track extraction, used when a user pastes a new URL. Raises
    on failure — the caller (Celery task) turns that into a job-failure
    state visible to the poller. `on_stage` is an optional progress hook
    (called with 'fetching' / 'parsing' / 'llm_fallback') so the tracking
    job can report granular status to the poller."""
    if on_stage:
        on_stage("fetching")
    fetch_result = safe_fetch(url)

    if _looks_bot_walled(fetch_result.html):
        raise ExtractionFailedError(f"{url} appears to block automated checks")

    if on_stage:
        on_stage("parsing")
    structured = extract_structured(fetch_result.html)
    if structured is not None:
        product, strategy = structured
        _validate(product)
        return ExtractionResult(
            product=product, strategy=strategy, meta={"final_url": fetch_result.final_url}
        )

    if on_stage:
        on_stage("llm_fallback")
    product = llm_extract(fetch_result.html, fetch_result.final_url)
    if product is not None:
        _validate(product)
        return ExtractionResult(
            product=product, strategy="llm", meta={"final_url": fetch_result.final_url}
        )

    raise ExtractionFailedError(f"could not extract a product from {url}")


@dataclass(frozen=True)
class RecheckOutcome:
    product: ExtractedProduct | None
    strategy: str | None
    blocked: bool
    blocked_reason: str | None
    failed: bool


def recheck_product(url: str) -> RecheckOutcome:
    """Daily recheck: always structured-first (see module docstring), LLM
    only as today's fallback. Never raises — every failure mode is
    represented in the returned outcome so the caller can update
    `Product.status`/`consecutive_failures` accordingly."""
    try:
        fetch_result = safe_fetch(url)
    except SsrfBlockedError:
        return RecheckOutcome(
            product=None, strategy=None, blocked=True, blocked_reason="ssrf", failed=True
        )
    except FetchError as exc:
        if exc.status_code in (403, 429):
            return RecheckOutcome(
                product=None,
                strategy=None,
                blocked=True,
                blocked_reason=f"http_{exc.status_code}",
                failed=True,
            )
        return RecheckOutcome(
            product=None, strategy=None, blocked=False, blocked_reason=None, failed=True
        )

    if _looks_bot_walled(fetch_result.html):
        return RecheckOutcome(
            product=None, strategy=None, blocked=True, blocked_reason="bot_wall", failed=True
        )

    structured = extract_structured(fetch_result.html)
    if structured is not None:
        product, strategy = structured
        try:
            _validate(product)
        except ValueError:
            pass
        else:
            return RecheckOutcome(
                product=product, strategy=strategy, blocked=False, blocked_reason=None, failed=False
            )

    product = llm_extract(fetch_result.html, fetch_result.final_url)
    if product is not None:
        try:
            _validate(product)
        except ValueError:
            pass
        else:
            return RecheckOutcome(
                product=product, strategy="llm", blocked=False, blocked_reason=None, failed=False
            )

    return RecheckOutcome(
        product=None, strategy=None, blocked=False, blocked_reason=None, failed=True
    )
