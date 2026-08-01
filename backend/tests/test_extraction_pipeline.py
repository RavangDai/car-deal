"""Extraction orchestration: bot-wall detection and the structured-first
ordering in `extract_product` / `recheck_product`.

These exercise the pipeline through its real entry points with `safe_fetch`
patched to return saved HTML — the fetch layer itself is covered by
test_ssrf.py, and what matters here is what the pipeline *decides* once bytes
are in hand.
"""

from decimal import Decimal
from pathlib import Path

import pytest

from app.extraction import pipeline
from app.extraction.types import FetchResult

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


@pytest.fixture
def served(monkeypatch):
    """Patch the pipeline's fetch so a named fixture is what the extractor
    sees. Returns a callable so each test picks its own page."""

    def _serve(fixture_name: str, url: str = "https://shop.example.com/p/item"):
        result = FetchResult(html=load(fixture_name), final_url=url, status_code=200)
        monkeypatch.setattr(pipeline, "safe_fetch", lambda *a, **kw: result)
        return url

    return _serve


# --- The false positive -------------------------------------------------


def test_product_page_referencing_cloudflare_cdn_is_not_treated_as_bot_walled(served):
    """A page loading an asset from cdnjs.cloudflare.com contains the literal
    substring 'cloudflare' in its <head>, but blocks nothing. It must extract
    normally."""
    url = served("cdn_cloudflare_product.html")

    result = pipeline.extract_product(url)

    assert result.product.title == "Trail Runner GTX"
    assert result.product.price == Decimal("134.95")
    assert result.strategy == "json_ld"


def test_recheck_of_cloudflare_cdn_page_succeeds_rather_than_reporting_blocked(served):
    url = served("cdn_cloudflare_product.html")

    outcome = pipeline.recheck_product(url)

    assert outcome.blocked is False
    assert outcome.failed is False
    assert outcome.product is not None
    assert outcome.product.price == Decimal("134.95")


# --- Genuine challenge pages must still be caught -----------------------


def test_genuine_cloudflare_challenge_page_is_detected(served):
    url = served("cloudflare_challenge.html")

    with pytest.raises(pipeline.ExtractionFailedError):
        pipeline.extract_product(url)


def test_recheck_of_challenge_page_reports_blocked_with_reason(served):
    url = served("cloudflare_challenge.html")

    outcome = pipeline.recheck_product(url)

    assert outcome.blocked is True
    assert outcome.blocked_reason == "bot_wall"
    assert outcome.failed is True


# --- The no-product path stays distinguishable from a block -------------


def test_page_without_product_data_is_not_labelled_a_bot_wall(served):
    """A small page with no structured data and no challenge markers is a
    plain extraction failure, not a block — the two drive different
    consecutive-failure accounting."""
    url = served("no_product.html")

    outcome = pipeline.recheck_product(url)

    assert outcome.failed is True
    assert outcome.blocked is False
    assert outcome.blocked_reason is None
