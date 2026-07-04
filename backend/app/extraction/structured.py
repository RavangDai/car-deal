"""Free structured-data extraction: JSON-LD, Open Graph, then microdata.

These cost nothing to run, so `pipeline.recheck_product` always tries this
chain first on every recheck regardless of the recorded strategy — a site
that adds JSON-LD after being LLM-extracted once will self-heal onto the
free path automatically.
"""
from __future__ import annotations

import json
import re
from decimal import Decimal, InvalidOperation
from typing import Any

from bs4 import BeautifulSoup

from .types import ExtractedProduct

_NUMERIC_RE = re.compile(r"[\d.]+")


def _to_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        try:
            return Decimal(str(value))
        except InvalidOperation:
            return None
    if isinstance(value, str):
        match = _NUMERIC_RE.search(value.replace(",", ""))
        if not match:
            return None
        try:
            return Decimal(match.group(0))
        except InvalidOperation:
            return None
    return None


def _availability_to_in_stock(value: str | None) -> bool:
    if not value:
        return True
    lowered = value.lower()
    return not any(marker in lowered for marker in ("outofstock", "out_of_stock", "discontinued", "soldout"))


def _iter_json_ld_nodes(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    nodes: list[dict] = []
    for script in soup.find_all("script", type="application/ld+json"):
        raw = script.string or script.get_text()
        if not raw or not raw.strip():
            continue
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            continue
        candidates = data if isinstance(data, list) else [data]
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            graph = candidate.get("@graph")
            if isinstance(graph, list):
                nodes.extend(n for n in graph if isinstance(n, dict))
            else:
                nodes.append(candidate)
    return nodes


def _is_product_node(node: dict) -> bool:
    type_val = node.get("@type")
    if isinstance(type_val, list):
        return any(isinstance(t, str) and t.lower() == "product" for t in type_val)
    return isinstance(type_val, str) and type_val.lower() == "product"


def _offer_price_currency(offer: dict) -> tuple[Decimal | None, str | None, bool]:
    price = _to_decimal(offer.get("price"))
    if price is None:
        price = _to_decimal(offer.get("lowPrice"))
    currency = offer.get("priceCurrency")
    in_stock = _availability_to_in_stock(offer.get("availability"))
    return price, currency, in_stock


def _extract_image(image: Any) -> str | None:
    if isinstance(image, list):
        return image[0] if image and isinstance(image[0], str) else None
    if isinstance(image, dict):
        url = image.get("url")
        return url if isinstance(url, str) else None
    if isinstance(image, str):
        return image
    return None


def parse_json_ld(html: str) -> ExtractedProduct | None:
    for node in _iter_json_ld_nodes(html):
        if not _is_product_node(node):
            continue

        offers = node.get("offers")
        price: Decimal | None = None
        currency: str | None = None
        in_stock = True
        if isinstance(offers, dict):
            price, currency, in_stock = _offer_price_currency(offers)
        elif isinstance(offers, list):
            for offer in offers:
                if isinstance(offer, dict):
                    price, currency, in_stock = _offer_price_currency(offer)
                    if price is not None:
                        break

        if price is None:
            continue

        title = node.get("name")
        if not title or not isinstance(title, str):
            continue

        return ExtractedProduct(
            title=title.strip(),
            price=price,
            currency=(currency or "USD").upper(),
            image_url=_extract_image(node.get("image")),
            in_stock=in_stock,
        )
    return None


def _meta_content(soup: BeautifulSoup, *names: str) -> str | None:
    for name in names:
        tag = soup.select_one(f'meta[property="{name}"]') or soup.select_one(f'meta[name="{name}"]')
        content = tag.get("content") if tag else None
        if content and content.strip():
            return content.strip()
    return None


def parse_og_meta(html: str) -> ExtractedProduct | None:
    soup = BeautifulSoup(html, "html.parser")

    title = _meta_content(soup, "og:title")
    price_raw = _meta_content(soup, "product:price:amount", "og:price:amount")
    if not title or not price_raw:
        return None

    price = _to_decimal(price_raw)
    if price is None:
        return None

    currency = _meta_content(soup, "product:price:currency", "og:price:currency")
    image = _meta_content(soup, "og:image")
    availability = _meta_content(soup, "product:availability", "og:availability")

    return ExtractedProduct(
        title=title,
        price=price,
        currency=(currency or "USD").upper(),
        image_url=image,
        in_stock=_availability_to_in_stock(availability),
    )


def parse_microdata(html: str) -> ExtractedProduct | None:
    soup = BeautifulSoup(html, "html.parser")
    scope = soup.select_one('[itemtype*="schema.org/Product"]')
    if scope is None:
        return None

    def prop(name: str) -> str | None:
        el = scope.select_one(f'[itemprop="{name}"]')
        if el is None:
            return None
        value = el.get("content") or el.get_text(strip=True)
        return value.strip() if value else None

    title = prop("name")
    price_raw = prop("price")
    if not title or not price_raw:
        return None
    price = _to_decimal(price_raw)
    if price is None:
        return None

    currency = prop("priceCurrency")
    image_el = scope.select_one('[itemprop="image"]')
    image_url = None
    if image_el is not None:
        image_url = image_el.get("content") or image_el.get("src")

    availability = prop("availability")

    return ExtractedProduct(
        title=title,
        price=price,
        currency=(currency or "USD").upper(),
        image_url=image_url,
        in_stock=_availability_to_in_stock(availability),
    )


def extract_structured(html: str) -> tuple[ExtractedProduct, str] | None:
    """Try structured-data parsers in order of reliability."""
    product = parse_json_ld(html)
    if product is not None:
        return product, "json_ld"

    product = parse_og_meta(html)
    if product is not None:
        return product, "og_meta"

    product = parse_microdata(html)
    if product is not None:
        return product, "microdata"

    return None
