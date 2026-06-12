"""Unit tests for the Craigslist scraper.

These tests are fully offline: live HTTP is replaced with saved HTML fixtures
so they are deterministic and CI-safe (Craigslist itself is non-deterministic
and may block automated traffic).
"""

from datetime import datetime, timezone
from pathlib import Path

import httpx
import pytest

from app import scraper_craigslist as scr

FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


# --------------------------------------------------------------------------- #
# Pure helpers
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "text,expected",
    [
        ("$8,500", 8500),
        ("$22,000", 22000),
        ("1200", 1200),
        ("", None),
        ("please contact", None),
        ("$0", None),
    ],
)
def test_parse_price(text, expected):
    assert scr._parse_price(text) == expected


@pytest.mark.parametrize(
    "title,expected",
    [
        ("2015 Honda Civic LX", 2015),
        ("Clean 1998 Toyota", 1998),
        ("No year here", None),
        ("Call 555-1234 about this car", None),  # not a plausible year
    ],
)
def test_parse_year(title, expected):
    assert scr._parse_year(title) == expected


@pytest.mark.parametrize(
    "title,make,model",
    [
        ("2015 Honda Civic LX - clean title", "Honda", "Civic"),
        ("Chevy Silverado 1500", "Chevrolet", "Silverado"),
        ("2018 Ford F-150 XLT 4x4", "Ford", "F-150"),
        ("Mercedes-Benz C300 sport", "Mercedes-Benz", "C300"),
        ("VW Golf GTI", "Volkswagen", "Golf"),
        ("Some random furniture for sale", "Unknown", "Unknown"),
        ("", "Unknown", "Unknown"),
    ],
)
def test_parse_make_model(title, make, model):
    assert scr._parse_make_model(title) == (make, model)


def test_parse_iso_datetime_compact_offset():
    dt = scr._parse_iso_datetime("2024-05-01T12:30:00-0500")
    assert dt == datetime(2024, 5, 1, 12, 30, tzinfo=timezone(_hours(-5)))


def test_parse_iso_datetime_invalid_returns_none():
    assert scr._parse_iso_datetime("not-a-date") is None
    assert scr._parse_iso_datetime("") is None


def _hours(n):
    from datetime import timedelta

    return timedelta(hours=n)


# --------------------------------------------------------------------------- #
# Search-results parsing
# --------------------------------------------------------------------------- #


def test_parse_search_results_extracts_priced_rows():
    rows = scr._parse_search_results(_load("search_results.html"), city="austin")

    # The Toyota row has no price and must be dropped.
    assert len(rows) == 2

    honda = rows[0]
    assert honda["source"] == "craigslist"
    assert honda["url"].endswith("7700000001.html")
    assert honda["listed_price"] == 8500
    assert honda["make"] == "Honda"
    assert honda["model"] == "Civic"
    assert honda["year"] == 2015
    assert honda["location"] == "austin"

    ford = rows[1]
    assert ford["make"] == "Ford"
    assert ford["listed_price"] == 22000


def test_parse_search_results_empty_html():
    assert scr._parse_search_results("<html><body></body></html>", "austin") == []


# --------------------------------------------------------------------------- #
# Detail-page parsing
# --------------------------------------------------------------------------- #


def test_detail_parsers():
    from bs4 import BeautifulSoup

    detail = BeautifulSoup(_load("detail.html"), "html.parser")

    assert scr._parse_mileage(detail) == 78000

    posted = scr._parse_posted_at(detail)
    assert posted.year == 2024 and posted.month == 5 and posted.day == 1

    desc = scr._clean_description(detail)
    assert desc is not None
    assert "QR Code Link to This Post" not in desc
    assert "Clean title, runs great" in desc


# --------------------------------------------------------------------------- #
# End-to-end with mocked HTTP
# --------------------------------------------------------------------------- #


class _FakeResponse:
    def __init__(self, text: str):
        self.text = text

    def raise_for_status(self):
        return None


def test_search_craigslist_cars_end_to_end(monkeypatch):
    search_html = _load("search_results.html")
    detail_html = _load("detail.html")

    def fake_get(self, url, *args, **kwargs):
        if "/search/" in url:
            return _FakeResponse(search_html)
        return _FakeResponse(detail_html)

    monkeypatch.setattr(httpx.Client, "get", fake_get)
    monkeypatch.setattr(scr.time, "sleep", lambda *_: None)

    results = scr.search_craigslist_cars("austin", "honda civic", max_results=10)

    # Two priced listings, each enriched from the detail page.
    assert len(results) == 2

    for item in results:
        # Contract: these keys are accessed without defaults downstream.
        for key in (
            "source",
            "url",
            "title",
            "listed_price",
            "make",
            "model",
            "location",
            "posted_at",
        ):
            assert item.get(key) is not None, f"missing {key}"
        assert isinstance(item["posted_at"], datetime)
        assert item["posted_at"].tzinfo is not None
        assert item["mileage"] == 78000
        assert "Clean title, runs great" in item["description"]


def test_detail_fetch_failure_degrades_gracefully(monkeypatch):
    search_html = _load("search_results.html")

    def fake_get(self, url, *args, **kwargs):
        if "/search/" in url:
            return _FakeResponse(search_html)
        raise httpx.ConnectError("boom")

    monkeypatch.setattr(httpx.Client, "get", fake_get)
    monkeypatch.setattr(scr.time, "sleep", lambda *_: None)

    results = scr.search_craigslist_cars("austin", "honda civic", max_results=10)

    # Detail fetches all fail, but search-page data survives with safe defaults.
    assert len(results) == 2
    item = results[0]
    assert item["listed_price"] == 8500
    assert item["mileage"] is None
    assert item["description"] is None
    assert isinstance(item["posted_at"], datetime)


def test_search_request_error_propagates(monkeypatch):
    def fake_get(self, url, *args, **kwargs):
        raise httpx.ConnectError("network down")

    monkeypatch.setattr(httpx.Client, "get", fake_get)

    with pytest.raises(httpx.ConnectError):
        scr.search_craigslist_cars("austin", "honda civic", max_results=5)
