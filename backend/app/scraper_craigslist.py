"""Craigslist cars+trucks scraper.

Scrapes Craigslist's *static* (no-JS) search results page, which Craigslist
still serves to non-JavaScript clients and which is far more stable to parse
than the JavaScript-rendered gallery. For each result we then fetch the
listing detail page to enrich it with mileage, the exact posted-at timestamp,
and the description.

Public contract (consumed by ``app.tasks.scrape_craigslist_task``): every dict
returned MUST contain ``source``, ``url``, ``title``, ``listed_price``,
``make``, ``model``, ``location`` and ``posted_at`` (these are accessed without
defaults downstream). ``description``, ``year`` and ``mileage`` are optional.

The scraper is intentionally synchronous (``httpx.Client``) because the Celery
worker pool that calls it is sync (psycopg2).
"""

from __future__ import annotations

import logging
import random
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote_plus, urljoin

import httpx
from bs4 import BeautifulSoup

from .settings import settings

logger = logging.getLogger(__name__)

# Craigslist cars+trucks, all sellers (owner + dealer).
SEARCH_URL_TEMPLATE = "https://{city}.craigslist.org/search/cta?query={query}"

HEADERS = {
    "User-Agent": settings.scraper_user_agent,
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# Politeness window (seconds) between sequential detail-page fetches.
DETAIL_DELAY_RANGE: Tuple[float, float] = (0.4, 0.8)

# Lowercased make -> canonical make. Aliases collapse to the canonical name.
KNOWN_MAKES: Dict[str, str] = {
    "acura": "Acura",
    "audi": "Audi",
    "bmw": "BMW",
    "buick": "Buick",
    "cadillac": "Cadillac",
    "chevrolet": "Chevrolet",
    "chevy": "Chevrolet",
    "chrysler": "Chrysler",
    "dodge": "Dodge",
    "fiat": "Fiat",
    "ford": "Ford",
    "gmc": "GMC",
    "honda": "Honda",
    "hyundai": "Hyundai",
    "infiniti": "Infiniti",
    "jeep": "Jeep",
    "kia": "Kia",
    "lexus": "Lexus",
    "mazda": "Mazda",
    "mercedes": "Mercedes-Benz",
    "mercedes-benz": "Mercedes-Benz",
    "benz": "Mercedes-Benz",
    "mini": "Mini",
    "mitsubishi": "Mitsubishi",
    "nissan": "Nissan",
    "porsche": "Porsche",
    "ram": "Ram",
    "subaru": "Subaru",
    "tesla": "Tesla",
    "toyota": "Toyota",
    "volkswagen": "Volkswagen",
    "vw": "Volkswagen",
    "volvo": "Volvo",
}

_YEAR_RE = re.compile(r"\b(19[8-9]\d|20[0-4]\d)\b")
_MILEAGE_RE = re.compile(r"odometer", re.IGNORECASE)
_DIGITS_RE = re.compile(r"[\d,]+")


def search_craigslist_cars(
    city: str,
    query: str,
    max_results: int = 10,
) -> List[Dict[str, Any]]:
    """Fetch live Craigslist car/truck listings for ``query`` in ``city``.

    Returns a list of listing dicts (see module docstring for the contract).
    Network/HTTP errors on the *search* request propagate so Celery's
    ``autoretry_for`` can retry the whole job; per-listing failures are caught
    and skipped so one bad page never aborts the batch.
    """
    search_url = SEARCH_URL_TEMPLATE.format(
        city=city, query=quote_plus(query)
    )

    with httpx.Client(
        headers=HEADERS,
        timeout=settings.scraper_request_timeout,
        follow_redirects=True,
    ) as client:
        resp = client.get(search_url)
        resp.raise_for_status()

        rows = _parse_search_results(resp.text, city=city)
        if not rows:
            logger.warning(
                "Craigslist returned no static search results for %r in %r "
                "(layout change or no matches)",
                query,
                city,
            )
            return []

        results: List[Dict[str, Any]] = []
        for row in rows[:max_results]:
            listing = _enrich_with_detail(client, row)
            results.append(listing)

        return results


def _parse_search_results(html: str, city: str) -> List[Dict[str, Any]]:
    """Parse the static search results page into partial listing dicts.

    Each row carries everything available from the results page: url, title,
    listed_price, location, and year/make/model parsed from the title. Rows
    without a parseable price are dropped (they're useless for deal scoring).
    """
    soup = BeautifulSoup(html, "html.parser")
    rows: List[Dict[str, Any]] = []

    for node in soup.select("li.cl-static-search-result"):
        anchor = node.find("a", href=True)
        if anchor is None:
            continue
        url = anchor["href"].strip()
        if not url:
            continue

        title = (node.get("title") or "").strip()
        if not title:
            title_el = node.select_one(".title")
            title = title_el.get_text(strip=True) if title_el else ""
        if not title:
            continue

        price_el = node.select_one(".price")
        listed_price = _parse_price(price_el.get_text() if price_el else "")
        if listed_price is None:
            continue

        location_el = node.select_one(".location")
        location = (
            location_el.get_text(strip=True) if location_el else ""
        ) or city.title()

        year = _parse_year(title)
        make, model = _parse_make_model(title)

        rows.append(
            {
                "source": "craigslist",
                "url": url,
                "title": title,
                "listed_price": listed_price,
                "location": location,
                "year": year,
                "make": make,
                "model": model,
            }
        )

    return rows


def _enrich_with_detail(
    client: httpx.Client, row: Dict[str, Any]
) -> Dict[str, Any]:
    """Fetch the detail page and add mileage, posted_at and description.

    Always returns a complete, contract-compliant dict. On any failure the
    search-page data is kept, mileage/description are left null, and
    ``posted_at`` falls back to now (UTC).
    """
    listing: Dict[str, Any] = {
        **row,
        "description": None,
        "mileage": None,
        "posted_at": datetime.now(timezone.utc),
    }

    time.sleep(random.uniform(*DETAIL_DELAY_RANGE))

    try:
        resp = client.get(row["url"])
        resp.raise_for_status()
        detail = BeautifulSoup(resp.text, "html.parser")

        listing["mileage"] = _parse_mileage(detail)
        listing["posted_at"] = _parse_posted_at(detail)
        listing["description"] = _clean_description(detail)
        # Prefer an odometer-derived year/make refinement only if missing.
        if listing.get("year") is None:
            listing["year"] = _parse_year(row["title"])
    except Exception as exc:  # noqa: BLE001 - degrade gracefully per-listing
        logger.warning(
            "Failed to fetch Craigslist detail page %s: %s", row["url"], exc
        )

    return listing


def _parse_price(text: str) -> Optional[int]:
    """'$8,500' -> 8500. Returns None when no positive integer is present."""
    if not text:
        return None
    match = _DIGITS_RE.search(text.replace("$", ""))
    if not match:
        return None
    try:
        value = int(match.group(0).replace(",", ""))
    except ValueError:
        return None
    return value or None


def _parse_year(title: str) -> Optional[int]:
    """Extract a plausible 4-digit model year (1980–2049) from the title."""
    match = _YEAR_RE.search(title or "")
    return int(match.group(1)) if match else None


def _parse_make_model(title: str) -> Tuple[str, str]:
    """Best-effort make + model from a free-text title.

    Matches the first known make token; model is the token immediately
    following it. Both default to 'Unknown' so the downstream contract (which
    accesses make/model without defaults) is always satisfied.
    """
    if not title:
        return "Unknown", "Unknown"

    tokens = re.findall(r"[A-Za-z0-9\-]+", title)
    lowered = [t.lower() for t in tokens]

    for idx, token in enumerate(lowered):
        make = KNOWN_MAKES.get(token)
        if make is None:
            continue
        model = "Unknown"
        for follow in tokens[idx + 1 :]:
            # Skip a trailing year sitting right after the make.
            if _YEAR_RE.fullmatch(follow):
                continue
            model = follow.capitalize()
            break
        return make, model

    return "Unknown", "Unknown"


def _parse_mileage(detail: BeautifulSoup) -> Optional[int]:
    """Pull the odometer reading from the listing's attribute groups."""
    for span in detail.select(".attrgroup span, .attr"):
        text = span.get_text(" ", strip=True)
        if _MILEAGE_RE.search(text):
            match = _DIGITS_RE.search(text)
            if match:
                try:
                    return int(match.group(0).replace(",", "")) or None
                except ValueError:
                    return None
    return None


def _parse_posted_at(detail: BeautifulSoup) -> datetime:
    """Read the posting timestamp from the <time datetime=...> element.

    Falls back to now (UTC) when absent or unparseable.
    """
    time_el = detail.select_one("time[datetime]")
    if time_el is not None:
        raw = time_el.get("datetime", "").strip()
        parsed = _parse_iso_datetime(raw)
        if parsed is not None:
            return parsed
    return datetime.now(timezone.utc)


def _parse_iso_datetime(raw: str) -> Optional[datetime]:
    """Parse Craigslist's ISO timestamps (e.g. '2024-05-01T12:30:00-0500')."""
    if not raw:
        return None
    candidate = raw
    # datetime.fromisoformat (3.12) accepts most forms but not a bare
    # '-0500' offset without a colon; normalize that case.
    tz_match = re.search(r"([+-]\d{2})(\d{2})$", candidate)
    if tz_match and ":" not in candidate[-6:]:
        candidate = f"{candidate[:-2]}:{candidate[-2:]}"
    try:
        dt = datetime.fromisoformat(candidate)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _clean_description(detail: BeautifulSoup) -> Optional[str]:
    """Extract the listing body, stripping the QR-code boilerplate."""
    body = detail.select_one("#postingbody")
    if body is None:
        return None
    # Remove the "QR Code Link to This Post" helper block if present.
    for junk in body.select(".print-information, .notices"):
        junk.decompose()
    text = body.get_text("\n", strip=True)
    text = text.replace("QR Code Link to This Post", "").strip()
    return text or None
