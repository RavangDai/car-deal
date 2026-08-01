"""Regression tests over real retailer HTML captured by scripts/probe_urls.py.

This is how a live probe run becomes permanent coverage without putting the
network in CI: the probe saves the page, a human checks the sidecar against
the real listing and flips `reviewed` to true, and from then on every run
asserts we still parse that retailer's real markup correctly.

Adding coverage takes no test code — drop in a reviewed pair and the
parametrization picks it up.

Sidecars with `reviewed: false` are skipped, not trusted. The probe writes
what the parser produced, so an unreviewed sidecar would only assert that the
parser agrees with itself.
"""

import json
from decimal import Decimal
from pathlib import Path

import pytest

from app.extraction.structured import extract_structured

LIVE_FIXTURES = Path(__file__).parent / "fixtures" / "live"


def _pairs() -> list[tuple[Path, Path]]:
    if not LIVE_FIXTURES.is_dir():
        return []
    return [
        (html, sidecar)
        for html in sorted(LIVE_FIXTURES.glob("*.html"))
        if (sidecar := html.with_suffix(".json")).exists()
    ]


def _reviewed_cases():
    cases = []
    for html_path, sidecar_path in _pairs():
        meta = json.loads(sidecar_path.read_text(encoding="utf-8"))
        if meta.get("reviewed") is True:
            cases.append(pytest.param(html_path, meta, id=html_path.stem))
    return cases


@pytest.mark.parametrize("html_path,expected", _reviewed_cases())
def test_live_page_still_parses_as_reviewed(html_path: Path, expected: dict):
    html = html_path.read_text(encoding="utf-8")
    structured = extract_structured(html)

    if expected["expected_outcome"] != "ok":
        # A page we currently cannot parse is worth locking in too. If this
        # starts passing, a parser change fixed a site — worth noticing
        # deliberately rather than absorbing silently.
        assert structured is None, (
            f"{html_path.name} now extracts a product but its sidecar records "
            f"{expected['expected_outcome']!r}. If that's an improvement, "
            "update the sidecar."
        )
        return

    assert structured is not None, f"{html_path.name} no longer extracts"
    product, strategy = structured
    assert strategy == expected["expected_strategy"]
    assert product.title == expected["expected_title"]
    assert product.price == Decimal(expected["expected_price"])
    assert product.currency == expected["expected_currency"]


def test_no_unreviewed_fixtures_are_committed():
    """Guards the review gate itself: an unreviewed sidecar in the repo means
    a probe run got committed without anyone checking it against the page."""
    unreviewed = [
        sidecar.name
        for _, sidecar in _pairs()
        if json.loads(sidecar.read_text(encoding="utf-8")).get("reviewed") is not True
    ]
    assert not unreviewed, (
        "Unreviewed live fixtures committed: "
        + ", ".join(unreviewed)
        + ". Check each against the real page, then set \"reviewed\": true."
    )
