"""Structured-data extraction: JSON-LD, Open Graph, microdata, and the
precedence chain between them."""

from decimal import Decimal
from pathlib import Path

from app.extraction.structured import (
    extract_structured,
    parse_json_ld,
    parse_microdata,
    parse_og_meta,
)

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def test_json_ld_basic_product():
    product = parse_json_ld(load("jsonld_product.html"))
    assert product is not None
    assert product.title == "Widget Pro 3000"
    assert product.price == Decimal("49.99")
    assert product.currency == "USD"
    assert product.image_url == "https://shop.example.com/img/widget.jpg"
    assert product.in_stock is True


def test_json_ld_at_graph_wrapper():
    product = parse_json_ld(load("jsonld_graph.html"))
    assert product is not None
    assert product.title == "Graph Widget"
    assert product.price == Decimal("89.5")
    assert product.currency == "EUR"
    assert product.image_url == "https://shop.example.com/img/graph1.jpg"


def test_json_ld_aggregate_offer_low_price_fallback():
    product = parse_json_ld(load("jsonld_aggregate_offer.html"))
    assert product is not None
    assert product.title == "Bundled Widget"
    assert product.price == Decimal("19.99")
    assert product.currency == "GBP"
    assert product.in_stock is False  # first offer in the list is OutOfStock


def test_json_ld_malformed_falls_through_to_none():
    assert parse_json_ld(load("malformed_jsonld.html")) is None


def test_og_meta_basic():
    product = parse_og_meta(load("og_only.html"))
    assert product is not None
    assert product.title == "OG Widget Deluxe"
    assert product.price == Decimal("34.95")
    assert product.currency == "USD"
    assert product.image_url == "https://shop.example.com/img/og-widget.jpg"
    assert product.in_stock is True


def test_og_meta_used_as_fallback_when_json_ld_malformed():
    product = parse_og_meta(load("malformed_jsonld.html"))
    assert product is not None
    assert product.title == "Fallback Widget"
    assert product.price == Decimal("12.50")


def test_microdata_basic():
    product = parse_microdata(load("microdata.html"))
    assert product is not None
    assert product.title == "Microdata Widget"
    assert product.price == Decimal("59.00")
    assert product.currency == "CAD"
    assert product.image_url == "https://shop.example.com/img/micro-widget.jpg"


def test_no_product_page_returns_none_for_every_parser():
    html = load("no_product.html")
    assert parse_json_ld(html) is None
    assert parse_og_meta(html) is None
    assert parse_microdata(html) is None


# ── chain precedence ──────────────────────────────────────────────────────

def test_extract_structured_prefers_json_ld_over_og():
    result = extract_structured(load("jsonld_product.html"))
    assert result is not None
    product, strategy = result
    assert strategy == "json_ld"
    assert product.title == "Widget Pro 3000"


def test_extract_structured_falls_back_to_og_when_json_ld_malformed():
    result = extract_structured(load("malformed_jsonld.html"))
    assert result is not None
    product, strategy = result
    assert strategy == "og_meta"
    assert product.title == "Fallback Widget"


def test_extract_structured_falls_back_to_microdata():
    result = extract_structured(load("microdata.html"))
    assert result is not None
    product, strategy = result
    assert strategy == "microdata"


def test_extract_structured_none_when_nothing_matches():
    assert extract_structured(load("no_product.html")) is None
