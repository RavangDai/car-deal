"""The probe harness's failure classification.

The probe's contract is that *every* URL yields exactly one row — no
exception escapes — and that each failure mode maps to a distinct, countable
outcome code. Those codes are what the findings report is built from, so
getting them wrong quietly corrupts the conclusions.
"""

from decimal import Decimal
from pathlib import Path

import pytest

from app.extraction import pipeline
from app.extraction.fetch import FetchError, SsrfBlockedError
from app.extraction.types import FetchResult
from scripts.probe_urls import probe_one

FIXTURES = Path(__file__).parent / "fixtures"
URL = "https://shop.example.com/p/item"


def serve_html(monkeypatch, fixture_name: str):
    html = (FIXTURES / fixture_name).read_text(encoding="utf-8")
    result = FetchResult(html=html, final_url=URL, status_code=200)
    monkeypatch.setattr(pipeline, "safe_fetch", lambda *a, **kw: result)


def raise_from_fetch(monkeypatch, exc: Exception):
    def _boom(*a, **kw):
        raise exc

    monkeypatch.setattr(pipeline, "safe_fetch", _boom)


def test_successful_extraction_reports_ok_with_product_fields(monkeypatch):
    serve_html(monkeypatch, "jsonld_product.html")

    row = probe_one(URL)

    assert row.outcome == "ok"
    assert row.strategy == "json_ld"
    assert row.title == "Widget Pro 3000"
    assert row.price == Decimal("49.99")
    assert row.currency == "USD"


def test_challenge_page_reports_bot_wall(monkeypatch):
    serve_html(monkeypatch, "cloudflare_challenge.html")

    assert probe_one(URL).outcome == "bot_wall"


def test_page_without_product_reports_no_product(monkeypatch):
    serve_html(monkeypatch, "no_product.html")

    assert probe_one(URL).outcome == "no_product"


def test_http_error_reports_http_error_and_keeps_the_status_code(monkeypatch):
    raise_from_fetch(monkeypatch, FetchError("HTTP 403 fetching", status_code=403))

    row = probe_one(URL)

    assert row.outcome == "http_error"
    assert "403" in row.detail


def test_fetch_error_without_status_reports_fetch_failed(monkeypatch):
    raise_from_fetch(monkeypatch, FetchError("too many redirects"))

    assert probe_one(URL).outcome == "fetch_failed"


def test_ssrf_block_reports_ssrf_blocked(monkeypatch):
    raise_from_fetch(monkeypatch, SsrfBlockedError("resolves to a private address"))

    assert probe_one(URL).outcome == "ssrf_blocked"


def test_unexpected_exception_does_not_escape_the_probe(monkeypatch):
    """A probe run over 20 URLs must not die on URL 3."""
    raise_from_fetch(monkeypatch, RuntimeError("something nobody predicted"))

    row = probe_one(URL)

    assert row.outcome == "error"
    assert "something nobody predicted" in row.detail


def test_every_row_records_elapsed_time(monkeypatch):
    serve_html(monkeypatch, "jsonld_product.html")

    assert probe_one(URL).elapsed_ms >= 0
