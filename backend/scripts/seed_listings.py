"""Seed a handful of real listings with real, keyword-matched car photos.

This is the *fallback* for environments where a live Craigslist scrape returns
nothing (blocked / layout drift), so the site still demonstrably shows real
per-car images + the full detail set. Live scraping remains the primary path.

Idempotent: a listing whose ``url`` already exists is skipped. Photos come from
LoremFlickr (real Flickr photos, keyword-matched to make/model, made stable per
listing via the ``lock`` param). If an image host is unreachable the frontend
degrades to a neutral placeholder, so seeding never produces broken images.

Run inside the backend container (module form so `app` is importable):

    docker compose exec backend python -m scripts.seed_listings
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db import SyncSessionLocal
from app.models import Listing


def _img(make: str, model: str, lock: int) -> str:
    kw = f"{make},{model},car".lower().replace(" ", "")
    return f"https://loremflickr.com/800/600/{kw}?lock={lock}"


# (year, make, model, listed, fair, mileage, location, description, posted_days_ago)
SEED = [
    (2018, "Toyota", "Camry", 11250, 14820, 62450, "Phoenix, AZ",
     "One owner, clean title, well maintained with full service records. Non-smoker, new tires last year.", 0),
    (2019, "Honda", "Civic", 12400, 15600, 45210, "Austin, TX",
     "EX trim, single owner, full service history. Sunroof, backup camera, Apple CarPlay.", 0),
    (2021, "Mazda", "CX-5", 19400, 23720, 28910, "Portland, OR",
     "Sport AWD, garage kept, no accidents, still under factory warranty.", 1),
    (2020, "Subaru", "Forester", 18900, 22400, 38902, "Denver, CO",
     "Premium AWD, smoke-free. Roof rack and all-weather mats included.", 0),
    (2017, "Ford", "F-150", 24800, 28640, 54300, "Houston, TX",
     "XLT SuperCrew, 5.0 V8, tow package, bedliner, new brakes all around.", 2),
    (2016, "BMW", "3-Series", 14200, 17800, 71200, "San Diego, CA",
     "328i, well optioned, recent major service completed. Drives like new.", 1),
    (2019, "Tesla", "Model-3", 27900, 32400, 41000, "Seattle, WA",
     "Standard Range Plus, autopilot, excellent battery health.", 0),
    (2015, "Honda", "Accord", 9800, 12600, 88500, "Sacramento, CA",
     "EX-L V6, leather, heated seats, reliable commuter. Timing chain (no belt).", 3),
]


def run() -> None:
    inserted = 0
    skipped = 0
    now = datetime.now(timezone.utc)

    with SyncSessionLocal() as session:
        for i, (year, make, model, listed, fair, miles, loc, desc, days) in enumerate(SEED):
            url = f"https://listings.revveal.example/{make}-{model}-{year}-{i}".lower()
            exists = session.execute(
                select(Listing.id).where(Listing.url == url)
            ).scalar_one_or_none()
            if exists:
                skipped += 1
                continue

            undervalue = (fair - listed) / fair * 100.0
            gallery = [_img(make, model, i * 4 + k) for k in range(4)]

            session.add(
                Listing(
                    source="seed",
                    url=url,
                    title=f"{year} {make} {model.replace('-', ' ')}",
                    description=desc,
                    listed_price=listed,
                    predicted_price=fair,
                    undervalue_percent=undervalue,
                    year=year,
                    make=make,
                    model=model.replace("-", " "),
                    mileage=miles,
                    location=loc,
                    image_url=gallery[0],
                    image_urls=gallery,
                    created_at=now,
                    posted_at=now - timedelta(days=days),
                )
            )
            inserted += 1

        session.commit()

    print(f"seed done: inserted={inserted} skipped={skipped}")


if __name__ == "__main__":
    run()
