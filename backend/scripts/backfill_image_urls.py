"""One-off repair: make stored product image URLs absolute.

Extraction stored whatever the page gave it, and every strategy can hand back
a site-root-relative path ("/images/items/cart2.png"). The browser then
resolved those against the app's own origin, so every affected thumbnail 404'd
against localhost while the real image sat there returning 200.

`pipeline._absolutize_image` fixes this going forward; this repairs the rows
written before it existed. Idempotent -- rows that are already absolute are
left alone, so it is safe to re-run.

    docker compose exec backend python -m scripts.backfill_image_urls
    docker compose exec backend python -m scripts.backfill_image_urls --apply

Runs as a dry run unless --apply is passed, because it rewrites a column in
place and a dry run is cheap.
"""
from __future__ import annotations

import argparse

from sqlalchemy import select

from app.db import SyncSessionLocal
from app.extraction.pipeline import _absolutize_image
from app.extraction.types import ExtractedProduct
from app.models import Product

from decimal import Decimal


def _resolved(image_url: str, page_url: str) -> str | None:
    """Reuse the production resolver so the backfill and the live path can
    never disagree about what 'absolute' means."""
    stub = ExtractedProduct(
        title="x", price=Decimal("1"), currency="USD",
        image_url=image_url, in_stock=True,
    )
    return _absolutize_image(stub, page_url).image_url


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="write the changes")
    args = parser.parse_args()

    changed = cleared = skipped = 0

    with SyncSessionLocal() as session:
        products = session.execute(
            select(Product).where(Product.image_url.is_not(None))
        ).scalars().all()

        for product in products:
            current = product.image_url
            resolved = _resolved(current, product.url)

            if resolved == current:
                skipped += 1
                continue

            if resolved is None:
                cleared += 1
                print(f"  CLEAR  {product.domain:24} {current[:58]}")
            else:
                changed += 1
                print(f"  FIX    {product.domain:24} {current[:40]}")
                print(f"      -> {resolved[:76]}")

            if args.apply:
                product.image_url = resolved

        if args.apply:
            session.commit()

    print(
        f"\n{len(products)} with an image | {changed} made absolute | "
        f"{cleared} cleared as unusable | {skipped} already fine"
    )
    if not args.apply and (changed or cleared):
        print("Dry run. Re-run with --apply to write.")


if __name__ == "__main__":
    main()
