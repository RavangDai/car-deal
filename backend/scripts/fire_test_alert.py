"""Force a price drop on a tracked product so the alert chain runs end to end.

Waiting for a real retailer to cut a price is not a test strategy, and the
alert path is the one part of this product that is both the point and the
revenue mechanism -- so it needs to be exercisable on demand.

This drives the **real** code path rather than faking a send: the same
`_recompute_stats`, `_evaluate_watches` and `deliver_alert_task` that the daily
recheck uses. A fake would happily pass while production was broken.

    # See what would happen -- writes nothing, sends nothing
    docker compose exec backend python -m scripts.fire_test_alert --product-id <id>

    # Actually append the price point and run delivery
    docker compose exec backend python -m scripts.fire_test_alert --product-id <id> --apply

With EMAIL_BACKEND=console (the default) the rendered email lands in the worker
log, which proves everything except the SMTP hop and needs no credentials. With
EMAIL_BACKEND=resend and a verified domain it sends for real.

Note this appends a genuine price point to an append-only history. On a real
tracked product that is a real (if small) distortion of its record -- prefer a
product you tracked specifically for testing.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select

from app.db import SyncSessionLocal
from app.models import AlertEvent, PricePoint, Product, User, Watch
from app.notify.templates import render_price_drop_email
from app.tasks import (
    _evaluate_watches,
    _previous_price_before,
    _recompute_stats,
    deliver_alert_task,
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--product-id", required=True)
    parser.add_argument(
        "--drop-pct", type=float, default=25.0,
        help="how far below the current price to drop (default 25%%)",
    )
    parser.add_argument("--apply", action="store_true", help="write and deliver")
    args = parser.parse_args()

    with SyncSessionLocal() as session:
        product = session.get(Product, args.product_id)
        if product is None:
            raise SystemExit(f"no product with id {args.product_id}")

        current = product.latest_price
        if current is None:
            raise SystemExit(f"{product.title!r} has no recorded price to drop from")

        new_price = (current * Decimal(str(1 - args.drop_pct / 100))).quantize(Decimal("0.01"))
        print(f"product   : {product.title} ({product.domain})")
        print(f"price     : {current} -> {new_price}  ({args.drop_pct}% drop)")

        watches = session.execute(
            select(Watch).where(Watch.product_id == product.id, Watch.is_active.is_(True))
        ).scalars().all()
        if not watches:
            raise SystemExit("no active watches on this product -- nothing could fire")

        print(f"watches   : {len(watches)} active")
        for w in watches:
            user = session.get(User, w.user_id)
            addr = (user.email if user else None) or "(anonymous -- no address)"
            print(f"  - rule={w.rule_type} threshold={w.threshold} -> {addr}")

        if not args.apply:
            subject, _ = render_price_drop_email(
                product_title=product.title or str(product.id),
                previous_price=current,
                new_price=new_price,
                currency=product.currency or "USD",
                deal_score=product.deal_score,
                product_id=str(product.id),
            )
            print(f"\nwould send: {subject!r}")
            print("Dry run. Re-run with --apply to write the price point and deliver.")
            return

        now = datetime.now(timezone.utc)
        point = PricePoint(
            product_id=product.id,
            price=new_price,
            currency=product.currency or "USD",
            in_stock=True,
            captured_at=now,
            source="scrape",
        )
        session.add(point)
        session.flush()

        _recompute_stats(session, product)
        previous = _previous_price_before(session, product.id, point.id)
        event_ids = _evaluate_watches(session, product, previous, point)
        session.commit()

        print(f"\nfired     : {len(event_ids)} alert event(s)")

    # Delivery opens its own session, so the events must be committed first.
    for event_id in event_ids:
        result = deliver_alert_task.run(str(event_id))
        print(f"  {event_id} -> {result.get('status')}")

    with SyncSessionLocal() as session:
        for event_id in event_ids:
            event = session.get(AlertEvent, event_id)
            print(f"  final status: {event.status}")


if __name__ == "__main__":
    main()
