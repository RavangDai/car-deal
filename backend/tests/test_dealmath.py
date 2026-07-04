"""Exhaustive tests for the deal-math module — the project's core statistical
claim (real discount detection vs fake reference-price theater) lives here.
Time is always injected via `now`; nothing touches the wall clock."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.dealmath import (
    MIN_COVERAGE_DAYS,
    PricePointData,
    compute_stats,
    daily_series,
)

NOW = datetime(2026, 7, 4, 12, 0, tzinfo=timezone.utc)


def pts(entries: list[tuple[int, float]], at_hour: int = 12) -> list[PricePointData]:
    """Build PricePointData from (days_ago, price) pairs, one point per day."""
    out = []
    for days_ago, price in entries:
        captured_at = (NOW - timedelta(days=days_ago)).replace(hour=at_hour, minute=0, second=0, microsecond=0)
        out.append(PricePointData(captured_at=captured_at, price=Decimal(str(price))))
    return out


def flat_history(days: int, price: float) -> list[tuple[int, float]]:
    return [(d, price) for d in range(days, -1, -1)]


# ── empty / sparse history ───────────────────────────────────────────────────

def test_empty_history_returns_all_none():
    stats = compute_stats([], NOW)
    assert stats.deal_score is None
    assert stats.median_90d is None
    assert stats.latest_price is None
    assert stats.is_lowest_ever is False
    assert stats.n_points == 0
    assert stats.coverage_days == 0


def test_single_point_has_no_deal_score():
    stats = compute_stats(pts([(0, 100.0)]), NOW)
    assert stats.n_points == 1
    assert stats.coverage_days == 1
    assert stats.deal_score is None
    assert stats.latest_price == Decimal("100.0")
    assert stats.median_90d == Decimal("100.0")


def test_coverage_gate_blocks_score_below_minimum_days():
    # 10 days of history — below MIN_COVERAGE_DAYS (14)
    history = flat_history(9, 100.0)
    assert len(history) == 10
    stats = compute_stats(pts(history), NOW)
    assert stats.coverage_days == 10
    assert stats.coverage_days < MIN_COVERAGE_DAYS
    assert stats.deal_score is None


def test_score_unlocks_exactly_at_minimum_coverage():
    history = flat_history(MIN_COVERAGE_DAYS - 1, 100.0)  # 14 days inclusive
    stats = compute_stats(pts(history), NOW)
    assert stats.coverage_days == MIN_COVERAGE_DAYS
    assert stats.deal_score is not None


# ── flat / stable history ────────────────────────────────────────────────────

def test_flat_history_has_zero_discount_and_high_stability():
    stats = compute_stats(pts(flat_history(60, 100.0)), NOW)
    assert stats.discount_vs_median_pct == pytest.approx(0.0)
    assert stats.stability == pytest.approx(1.0)
    assert stats.drop_freshness == pytest.approx(0.0)  # never dropped
    assert stats.deal_score is not None
    assert stats.deal_score < 25  # only the stability component contributes


# ── fake-discount vs genuine-sale ────────────────────────────────────────────

def test_fake_discount_scores_near_zero_on_depth():
    """Retailer raises price for 3 weeks, then 'drops' back to the original
    baseline. The median never moved, so this should NOT read as a discount."""
    history = (
        flat_history(89, 100.0)[:-20]  # 70 days at $100 baseline (oldest)
        + [(d, 130.0) for d in range(19, 2, -1)]  # 18 days "raised" to $130
        + [(2, 100.0), (1, 100.0), (0, 100.0)]  # "dropped" back to $100
    )
    stats = compute_stats(pts(history), NOW)
    assert stats.discount_vs_median_pct is not None
    assert stats.discount_vs_median_pct < 5.0  # essentially no real discount


def test_genuine_sale_scores_high_on_depth_and_freshness():
    """Stable baseline for months, then a real, fresh price cut today."""
    history = flat_history(80, 100.0) + [(0, 65.0)]  # 35% cut, today
    stats = compute_stats(pts(history), NOW)
    assert stats.discount_vs_median_pct > 25.0
    assert stats.drop_freshness == pytest.approx(1.0)
    assert stats.deal_score > 60


def test_fake_discount_scores_lower_than_genuine_sale():
    fake_history = (
        flat_history(89, 100.0)[:-20]
        + [(d, 130.0) for d in range(19, 2, -1)]
        + [(2, 100.0), (1, 100.0), (0, 100.0)]
    )
    genuine_history = flat_history(80, 100.0) + [(0, 65.0)]

    fake = compute_stats(pts(fake_history), NOW)
    genuine = compute_stats(pts(genuine_history), NOW)
    assert fake.deal_score < genuine.deal_score


# ── rarity ────────────────────────────────────────────────────────────────

def test_rarity_is_monotonic_in_how_low_the_current_price_is():
    # 89 days at $100, then today's price varies
    base = flat_history(89, 100.0)[:-1]

    higher = compute_stats(pts(base + [(0, 90.0)]), NOW)
    lower = compute_stats(pts(base + [(0, 50.0)]), NOW)
    assert lower.rarity >= higher.rarity


def test_rarity_is_zero_when_current_price_is_not_below_any_history():
    stats = compute_stats(pts(flat_history(60, 100.0)), NOW)
    assert stats.rarity == pytest.approx(0.0)


# ── stability ────────────────────────────────────────────────────────────

def test_stability_penalizes_oscillating_pre_drop_history():
    oscillating = [(d, 100.0 if d % 2 == 0 else 130.0) for d in range(89, 2, -1)]
    stable = flat_history(89, 100.0)[:-2]

    drop = [(2, 100.0), (1, 100.0), (0, 100.0)]

    osc_stats = compute_stats(pts(oscillating + drop), NOW)
    stable_stats = compute_stats(pts(stable + drop), NOW)

    assert osc_stats.stability < stable_stats.stability


def test_stability_is_perfect_for_a_never_changed_price():
    # Entire window at one price — zero variance, no drop ever observed.
    # This is the maximally stable case, not "insufficient data".
    stats = compute_stats(pts(flat_history(60, 100.0)), NOW)
    assert stats.stability == pytest.approx(1.0)


def test_stability_is_neutral_with_fewer_than_three_predrop_days():
    # Exactly one differing day right at the start of tracking, then stable
    # at the current price for the rest — only 1 point of pre-drop history
    # after excluding the trailing run, too little to judge either way.
    history = [(13, 90.0)] + [(d, 100.0) for d in range(12, -1, -1)]
    stats = compute_stats(pts(history), NOW)
    assert stats.coverage_days == MIN_COVERAGE_DAYS
    assert stats.stability == pytest.approx(0.5)


# ── freshness ────────────────────────────────────────────────────────────

def test_freshness_decays_with_days_since_last_drop():
    base = flat_history(89, 100.0)

    def with_drop_n_days_ago(n: int):
        history = list(base)
        for i, (d, _price) in enumerate(history):
            if d <= n:
                history[i] = (d, 80.0)
        return history

    fresh = compute_stats(pts(with_drop_n_days_ago(0)), NOW)
    stale = compute_stats(pts(with_drop_n_days_ago(13)), NOW)

    assert fresh.drop_freshness == pytest.approx(1.0)
    assert stale.drop_freshness < fresh.drop_freshness
    assert stale.drop_freshness == pytest.approx(0.0, abs=0.1)


def test_freshness_is_zero_when_no_decrease_ever_observed():
    rising = [(d, 100.0 + (89 - d) * 0.1) for d in range(89, -1, -1)]  # monotonic increase
    stats = compute_stats(pts(rising), NOW)
    assert stats.drop_freshness == pytest.approx(0.0)


# ── day bucketing / forward-fill ─────────────────────────────────────────

def test_multiple_points_same_day_count_once():
    today = NOW.replace(hour=1)
    points = [
        PricePointData(captured_at=today, price=Decimal("100")),
        PricePointData(captured_at=today.replace(hour=13), price=Decimal("90")),
        PricePointData(captured_at=today.replace(hour=23), price=Decimal("80")),
    ] + pts(flat_history(60, 100.0)[:-1])

    series = daily_series(points, NOW, window_days=90)
    days_seen = [d for d, _ in series]
    assert len(days_seen) == len(set(days_seen))  # no duplicate calendar days

    # the last (23:00) observation on "today" should win
    today_entries = [p for d, p in series if d == NOW.date()]
    assert today_entries == [Decimal("80")]


def test_forward_fill_carries_last_known_price_across_gaps():
    # Only two real observations, 30 days apart — everything in between and
    # after should forward-fill from the most recent known price.
    points = pts([(89, 50.0), (10, 75.0)])
    series = daily_series(points, NOW, window_days=90)
    prices_by_day = dict(series)

    # a day between the two observations should show the earlier price
    mid_day = (NOW - timedelta(days=40)).date()
    assert prices_by_day[mid_day] == Decimal("50.0")

    # a day after the second observation (but before now) shows the later price
    late_day = (NOW - timedelta(days=2)).date()
    assert prices_by_day[late_day] == Decimal("75.0")


def test_window_boundary_point_at_exactly_90_days_is_included():
    points = pts([(89, 42.0)])
    series = daily_series(points, NOW, window_days=90)
    boundary_day = (NOW - timedelta(days=89)).date()
    assert boundary_day == series[0][0]
    assert dict(series)[boundary_day] == Decimal("42.0")


def test_no_backward_fill_before_first_observation():
    points = pts([(5, 100.0)])
    series = daily_series(points, NOW, window_days=90)
    # nothing before the first real observation should appear
    assert all(d >= (NOW - timedelta(days=5)).date() for d, _ in series)


# ── is_lowest_ever ────────────────────────────────────────────────────────

def test_is_lowest_ever_requires_minimum_points():
    # current price is the lowest ever, but only 3 points exist
    history = [(20, 100.0), (10, 90.0), (0, 80.0)]
    stats = compute_stats(pts(history), NOW)
    assert stats.n_points == 3
    assert stats.is_lowest_ever is False


def test_is_lowest_ever_true_with_enough_points_and_new_low():
    history = [(40, 100.0), (30, 95.0), (20, 90.0), (10, 85.0), (0, 70.0)]
    stats = compute_stats(pts(history), NOW)
    assert stats.n_points == 5
    assert stats.is_lowest_ever is True


def test_is_lowest_ever_false_when_not_at_minimum():
    history = [(40, 100.0), (30, 95.0), (20, 90.0), (10, 85.0), (0, 90.0)]
    stats = compute_stats(pts(history), NOW)
    assert stats.is_lowest_ever is False


# ── score bounds ──────────────────────────────────────────────────────────

def test_deal_score_bounds_are_0_to_100():
    extreme_drop = flat_history(80, 1000.0) + [(0, 0.01)]
    stats = compute_stats(pts(extreme_drop), NOW)
    assert stats.deal_score is not None
    assert 0.0 <= stats.deal_score <= 100.0


def test_deal_score_stays_bounded_for_flat_history():
    stats = compute_stats(pts(flat_history(60, 100.0)), NOW)
    assert stats.deal_score is not None
    assert 0.0 <= stats.deal_score <= 100.0
