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
from app.extraction.types import ExtractedProduct, FetchResult

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


# --- The challenge-title fallback, calibrated against real pages --------
#
# Sizes here are not arbitrary: the real Walmart interstitial captured by the
# probe is 15,562 bytes with the title "Robot or human?". Under the original
# 15,000-byte gate and title list it matched neither rule, and was caught only
# because it happened to carry a `px-captcha` marker. A vendor that ships a
# challenge page without a marker we know would sail straight through.


def _challenge_page(title: str, size_bytes: int) -> str:
    """A challenge interstitial with NO vendor marker, padded to a size."""
    head = f"<!DOCTYPE html><html><head><title>{title}</title></head><body>"
    tail = "</body></html>"
    filler = "<p>Please enable JavaScript and cookies to continue.</p>"
    repeats = max(1, (size_bytes - len(head) - len(tail)) // len(filler))
    return head + filler * repeats + tail


def test_challenge_title_is_caught_above_the_old_fifteen_kb_gate():
    """The exact shape that slipped past: Walmart's title, Walmart's size."""
    page = _challenge_page("Robot or human?", 20_000)

    assert len(page) > 15_000
    assert pipeline._looks_bot_walled(page) is True


def test_modern_cloudflare_interstitial_title_is_recognised():
    assert pipeline._looks_bot_walled(_challenge_page("Just a moment...", 20_000)) is True


def test_imperva_interstitial_title_is_recognised():
    assert (
        pipeline._looks_bot_walled(_challenge_page("Pardon Our Interruption", 20_000))
        is True
    )


def test_large_page_with_a_challenge_like_title_is_not_flagged():
    """The size gate still earns its place: a full-weight page whose title
    merely reads like a challenge (a product *about* robots, say) is not a
    block. Interstitials are small; real pages are not."""
    page = _challenge_page("Robot or human?", 400_000)

    assert pipeline._looks_bot_walled(page) is False


def test_real_captured_walmart_interstitial_is_detected():
    """Regression against the actual bytes the probe pulled from Walmart."""
    captured = FIXTURES / "live" / "walmart.com-80cfe514.html"
    if not captured.exists():
        pytest.skip("live fixture not captured")

    assert pipeline._looks_bot_walled(
        captured.read_text(encoding="utf-8", errors="replace")
    ) is True


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


def test_real_captured_amazon_captcha_is_detected():
    """Regression against the actual bytes Amazon served the probe.

    This page carried no <title> and none of the vendor markers we knew about,
    so it was classified as 'no product found' rather than a block -- which
    understates the failure and gives the user the wrong explanation.
    """
    captured = FIXTURES / "live" / "amazon.com-df7b291f.html"
    if not captured.exists():
        pytest.skip("live fixture not captured")

    assert pipeline._looks_bot_walled(
        captured.read_text(encoding="utf-8", errors="replace")
    ) is True


# --- Relative image URLs must be resolved against the page ---------------


@pytest.mark.parametrize(
    "raw,expected",
    [
        # The real case: webscraper.io served a site-root-relative path, and
        # storing it verbatim made every thumbnail 404 against localhost.
        ("/images/items/cart2.png", "https://shop.example.com/images/items/cart2.png"),
        ("../img/c.png", "https://shop.example.com/img/c.png"),
        ("//cdn.example.net/b.png", "https://cdn.example.net/b.png"),
        # Already absolute: untouched.
        ("https://cdn.example.net/a.png", "https://cdn.example.net/a.png"),
        # Inline data stays as-is rather than being mangled by urljoin.
        ("data:image/png;base64,AAA", "data:image/png;base64,AAA"),
        # Unfetchable: better to fall back to the UI placeholder than to
        # render a broken <img>.
        ("javascript:alert(1)", None),
    ],
)
def test_image_urls_are_made_absolute(raw, expected):
    product = ExtractedProduct(
        title="Widget", price=Decimal("10"), currency="USD",
        image_url=raw, in_stock=True,
    )
    resolved = pipeline._absolutize_image(
        product, "https://shop.example.com/p/widget"
    )
    assert resolved.image_url == expected


def test_absolutize_leaves_missing_image_alone():
    product = ExtractedProduct(
        title="Widget", price=Decimal("10"), currency="USD",
        image_url=None, in_stock=True,
    )
    assert pipeline._absolutize_image(product, "https://shop.example.com/p/w").image_url is None
