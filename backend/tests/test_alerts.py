"""Pure alert-rule evaluation tests — dedup and re-arm sequences matter as
much as the basic firing conditions here."""
from decimal import Decimal

from app.alerts import should_fire


def fire(rule_type, threshold, last_notified, previous, new):
    return should_fire(
        rule_type=rule_type,
        threshold=Decimal(str(threshold)) if threshold is not None else None,
        last_notified_price=Decimal(str(last_notified)) if last_notified is not None else None,
        previous_price=Decimal(str(previous)),
        new_price=Decimal(str(new)),
    )


# ── any_drop ──────────────────────────────────────────────────────────────

def test_any_drop_fires_on_decrease():
    assert fire("any_drop", None, None, 100, 90) == (True, False)


def test_any_drop_does_not_fire_on_increase_or_same():
    assert fire("any_drop", None, None, 100, 100) == (False, False)
    assert fire("any_drop", None, None, 100, 110) == (False, False)


def test_any_drop_dedup_bounce_sequence():
    # 50 -> 45 -> 50 -> 45 alerts once; a further drop to 40 fires again.
    assert fire("any_drop", None, None, 50, 45) == (True, False)          # first drop: fire
    assert fire("any_drop", None, 45, 45, 50) == (False, False)           # bounce up: no fire
    assert fire("any_drop", None, 45, 50, 45) == (False, False)          # back to same low: dedup blocks
    assert fire("any_drop", None, 45, 45, 40) == (True, False)           # new low: fire again


# ── percent_drop ──────────────────────────────────────────────────────────

def test_percent_drop_fires_when_threshold_met():
    # 20% drop, threshold 15%
    assert fire("percent_drop", 15, None, 100, 80) == (True, False)


def test_percent_drop_does_not_fire_below_threshold():
    # 5% drop, threshold 15%
    assert fire("percent_drop", 15, None, 100, 95) == (False, False)


def test_percent_drop_dedup():
    assert fire("percent_drop", 10, None, 100, 85) == (True, False)
    assert fire("percent_drop", 10, 85, 85, 80) == (False, False)  # 5.9% off 85 -> below threshold anyway
    assert fire("percent_drop", 10, 85, 85, 70) == (True, False)   # >10% below 85, and below last_notified


def test_percent_drop_requires_threshold():
    assert fire("percent_drop", None, None, 100, 50) == (False, False)


# ── target_price ────────────────────────────────────────────────────────

def test_target_price_fires_on_crossing_below():
    assert fire("target_price", 50, None, 60, 45) == (True, False)


def test_target_price_does_not_fire_above_threshold():
    assert fire("target_price", 50, None, 60, 55) == (False, False)


def test_target_price_does_not_refire_while_still_below_threshold():
    assert fire("target_price", 50, None, 60, 45) == (True, False)
    assert fire("target_price", 50, 45, 45, 40) == (False, False)  # still below, already notified


def test_target_price_rearms_after_rising_above_threshold():
    # fire once, price rises back above threshold (re-arm), then a fresh
    # crossing fires again
    assert fire("target_price", 50, None, 60, 45) == (True, False)
    assert fire("target_price", 50, 45, 45, 55) == (False, True)   # rose above -> re-arm
    assert fire("target_price", 50, None, 55, 40) == (True, False)  # fresh crossing fires


def test_target_price_requires_threshold():
    assert fire("target_price", None, None, 100, 10) == (False, False)


# ── unknown rule type ──────────────────────────────────────────────────────

def test_unknown_rule_type_never_fires():
    assert fire("bogus_rule", 10, None, 100, 50) == (False, False)


# -- delivery: an alert with no possible recipient --------------------------
#
# users.email became nullable when tracking stopped requiring an account, so
# an alert can legitimately fire for someone who has not given an address.
# These pin the two things that matter: it must not be recorded as a failure,
# and it must not raise -- deliver_alert_task carries
# autoretry_for=(Exception,), so raising would retry a condition that cannot
# improve, burning four sends per alert once a real provider is configured.

import types
from datetime import datetime, timezone

import pytest

from app import tasks


class _FakeSession:
    """Stands in for SyncSessionLocal(): get-by-type plus commit tracking."""

    def __init__(self, objects):
        self._objects = objects
        self.commits = 0

    def get(self, model, _id):
        return self._objects.get(model.__name__)

    def commit(self):
        self.commits += 1

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _wire(monkeypatch, *, email):
    event = types.SimpleNamespace(
        product_id="p1", user_id="u1", previous_price=Decimal("100"),
        new_price=Decimal("80"), status="pending", sent_at=None,
    )
    objects = {
        "AlertEvent": event,
        "Product": types.SimpleNamespace(
            title="Widget", currency="USD", deal_score=Decimal("70"),
        ),
        "User": types.SimpleNamespace(email=email),
    }
    session = _FakeSession(objects)
    monkeypatch.setattr(tasks, "SyncSessionLocal", lambda: session)

    sent = []

    def _send(**kw):
        # Mimic a real provider: Resend rejects a null recipient and
        # ResendEmailSender surfaces that through raise_for_status(). Without
        # this, the fake would silently accept to=None and the test would pass
        # against the very bug it exists to catch.
        if not kw.get("to"):
            raise RuntimeError("422 Unprocessable Entity: 'to' is required")
        sent.append(kw)

    monkeypatch.setattr(
        tasks, "get_email_sender", lambda: types.SimpleNamespace(send=_send)
    )
    return event, sent


def test_alert_for_user_without_email_is_recorded_not_failed(monkeypatch):
    event, sent = _wire(monkeypatch, email=None)

    result = tasks.deliver_alert_task.run("evt1")

    assert result["status"] == "no_recipient"
    assert event.status == "no_recipient", "must not be marked failed -- nothing failed"
    assert sent == [], "must not attempt a send with no address"


def test_alert_without_recipient_does_not_raise(monkeypatch):
    """The retry-storm guard. deliver_alert_task retries on any exception, so
    raising here would mean four attempts per alert at a condition that cannot
    resolve itself."""
    _wire(monkeypatch, email=None)
    tasks.deliver_alert_task.run("evt1")  # must not raise


def test_alert_with_email_still_sends(monkeypatch):
    event, sent = _wire(monkeypatch, email="buyer@example.com")

    result = tasks.deliver_alert_task.run("evt1")

    assert result["status"] == "sent"
    assert event.status == "sent"
    assert len(sent) == 1 and sent[0]["to"] == "buyer@example.com"
