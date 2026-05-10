from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any


def search_craigslist_cars(
    city: str,
    query: str,
    max_results: int = 10,
) -> List[Dict[str, Any]]:
    """
    STUB — returns mock listings for local development.
    Replace body with real BeautifulSoup scraping logic.
    """
    now = datetime.now(timezone.utc)
    results: List[Dict[str, Any]] = []

    for i in range(max_results):
        listed_price = 8000 + i * 500
        results.append(
            {
                "source": "craigslist",
                "url": f"https://example.com/{city}/{query.replace(' ', '-')}/{i}",
                "title": f"201{5 + i} Honda Civic LX — clean title",
                "description": "Stub listing for local testing.",
                "listed_price": listed_price,
                "year": 2015 + i,
                "make": "Honda",
                "model": "Civic",
                "mileage": 70000 + i * 4000,
                "location": f"{city.title()}, TX",
                "posted_at": now - timedelta(days=i),
            }
        )

    return results
