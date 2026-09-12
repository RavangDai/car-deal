"""Clear the topically-random demo photos from already-seeded products.

Seeded demo rows used to carry `picsum.photos/seed/<slug>` image URLs, which
return a real but unrelated photo per product — a street cat on a cookware
card. `seed_products.py` no longer emits them, but rows seeded BEFORE that
change still hold the URLs, so this clears them in place.

Nulling image_url makes the frontend fall back to its category-aware
placeholder (frontend/src/images.ts), which says "kitchen" honestly instead
of showing a photograph of the wrong thing.

Scope is deliberately narrow: only rows whose image_url points at the two
known placeholder hosts. Real tracked products carry their own extracted
image_url and are never touched.

    python -m scripts.clear_demo_images            # report only
    python -m scripts.clear_demo_images --apply    # actually clear
"""
from __future__ import annotations

import sys

from sqlalchemy import select, update

from app.db import SessionLocal
from app.models import Product

HOSTS = ("picsum.photos", "loremflickr.com")


def run(apply: bool) -> None:
    with SessionLocal() as db:
        stmt = select(Product.id, Product.title, Product.image_url).where(
            Product.image_url.is_not(None)
        )
        rows = [r for r in db.execute(stmt).all() if any(h in (r.image_url or "") for h in HOSTS)]

        if not rows:
            print("No demo placeholder images found. Nothing to do.")
            return

        print(f"{len(rows)} product(s) carry a demo placeholder photo:")
        for r in rows[:10]:
            print(f"  {r.title or '(untitled)'} -> {r.image_url}")
        if len(rows) > 10:
            print(f"  ... and {len(rows) - 10} more")

        if not apply:
            print("\nDry run. Re-run with --apply to clear them.")
            return

        ids = [r.id for r in rows]
        db.execute(update(Product).where(Product.id.in_(ids)).values(image_url=None))
        db.commit()
        print(f"\nCleared image_url on {len(ids)} product(s).")


if __name__ == "__main__":
    run("--apply" in sys.argv)
