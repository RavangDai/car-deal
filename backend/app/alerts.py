"""Pure alert-rule evaluation — no I/O, no DB, no Celery. Given a price
change and a watch's rule, decides whether to fire an alert and/or re-arm
the watch for a future alert."""
from __future__ import annotations

from decimal import Decimal


def should_fire(
    *,
    rule_type: str,
    threshold: Decimal | None,
    last_notified_price: Decimal | None,
    previous_price: Decimal,
    new_price: Decimal,
) -> tuple[bool, bool]:
    """Returns (fire, rearm).

    fire: create an AlertEvent + send an email for this price change.
    rearm: clear `last_notified_price` even though nothing fires this time
    (used by target_price: once the price rises back above the threshold,
    the watch is ready to fire again on a future crossing).
    """
    if rule_type == "any_drop":
        if new_price >= previous_price:
            return False, False
        # Dedup: a price that bounces 50 -> 45 -> 50 -> 45 alerts once, not
        # on every bounce; a further drop to 40 fires again.
        if last_notified_price is not None and new_price >= last_notified_price:
            return False, False
        return True, False

    if rule_type == "percent_drop":
        if threshold is None or previous_price <= 0:
            return False, False
        drop_pct = (previous_price - new_price) / previous_price * 100
        if drop_pct < threshold:
            return False, False
        if last_notified_price is not None and new_price >= last_notified_price:
            return False, False
        return True, False

    if rule_type == "target_price":
        if threshold is None:
            return False, False
        crossed_below = new_price <= threshold and (
            last_notified_price is None or last_notified_price > threshold
        )
        if crossed_below:
            return True, False
        if new_price > threshold and last_notified_price is not None:
            return False, True  # re-arm for a future crossing
        return False, False

    return False, False
