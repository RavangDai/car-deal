import datetime as dt
from typing import List, Dict

import httpx
from bs4 import BeautifulSoup

BASE_URL_TEMPLATE = "https://{city}.craigslist.org/search/cta"


def parse_price(text: str) -> int | None:
    try:
        digits = "".join(ch for ch in text if ch.isdigit())
        return int(digits) if digits else None
    except ValueError:
        return None


def search_craigslist_cars(
    city: str,
    query: str,
    max_results: int = 20,
) -> List[Dict]:
    params = {
        "query": query,
        "hasPic": 1,
        "srchType": "T",
    }

    url = BASE_URL_TEMPLATE.format(city=city)

    # 👇 add a browser-ish User-Agent and timeouts
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0 Safari/537.36"
        )
    }

    resp = httpx.get(url, params=params, headers=headers, timeout=10)

    # If Craigslist returns 4xx/5xx, raise a clean error
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    rows = soup.select("li.result-row")

    results: List[Dict] = []

    for row in rows[:max_results]:
        a = row.select_one("a.result-title")
        price_el = row.select_one("span.result-price")
        hood_el = row.select_one("span.result-hood")
        date_el = row.select_one("time.result-date")

        if not a:
            continue

        title = a.get_text(strip=True)
        url = a.get("href")
        price_text = price_el.get_text(strip=True) if price_el else ""
        price = parse_price(price_text)

        location = ""
        if hood_el:
            location = hood_el.get_text(strip=True).strip("()")

        posted_at = dt.datetime.utcnow()
        if date_el and date_el.has_attr("datetime"):
            try:
                posted_at = dt.datetime.fromisoformat(date_el["datetime"])
            except Exception:
                posted_at = dt.datetime.utcnow()

        year = None
        make = ""
        model = ""
        parts = title.split()
        if parts and parts[0].isdigit() and len(parts[0]) == 4:
            try:
                year = int(parts[0])
                if len(parts) >= 3:
                    make = parts[1]
                    model = " ".join(parts[2:])
            except ValueError:
                year = None

        results.append(
            {
                "source": "craigslist",
                "url": url,
                "title": title,
                "description": title,
                "listed_price": price,
                "year": year,
                "make": make,
                "model": model,
                "mileage": None,
                "location": f"{city} ({location})" if location else city,
                "posted_at": posted_at,
            }
        )

    return results
