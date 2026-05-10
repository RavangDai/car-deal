from datetime import datetime, timezone
from typing import Any, Dict

from sqlalchemy import select

from .celery_app import celery_app
from .db import SyncSessionLocal
from .models import Listing
from .scraper_craigslist import search_craigslist_cars


@celery_app.task(
    bind=True,
    name="scrape.craigslist",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=30,
    max_retries=3,
)
def scrape_craigslist_task(
    self,
    city: str,
    query: str,
    max_results: int = 10,
) -> Dict[str, Any]:
    self.update_state(
        state="PROGRESS",
        meta={"stage": "scraping", "city": city, "query": query},
    )

    raw_listings = search_craigslist_cars(
        city=city, query=query, max_results=max_results
    )

    self.update_state(
        state="PROGRESS",
        meta={"stage": "persisting", "fetched": len(raw_listings)},
    )

    inserted = 0
    skipped = 0

    with SyncSessionLocal() as session:
        for item in raw_listings:
            if not item.get("listed_price"):
                skipped += 1
                continue

            already = session.execute(
                select(Listing.id).where(Listing.url == item["url"])
            ).scalar_one_or_none()
            if already:
                skipped += 1
                continue

            predicted_price = int(item["listed_price"] * 1.15)
            undervalue_percent = (
                (predicted_price - item["listed_price"]) / predicted_price * 100
            )

            session.add(
                Listing(
                    source=item["source"],
                    url=item["url"],
                    title=item["title"],
                    description=item.get("description"),
                    listed_price=item["listed_price"],
                    predicted_price=predicted_price,
                    undervalue_percent=undervalue_percent,
                    year=item.get("year") or 0,
                    make=item["make"],
                    model=item["model"],
                    mileage=item.get("mileage"),
                    location=item["location"],
                    created_at=datetime.now(timezone.utc),
                    posted_at=item["posted_at"],
                )
            )
            inserted += 1

        session.commit()

    return {
        "city": city,
        "query": query,
        "fetched": len(raw_listings),
        "inserted": inserted,
        "skipped": skipped,
    }
