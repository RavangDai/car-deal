"""Deal-quality math: pure, deterministic, zero I/O.

The core claim this module makes: a "deal" is a *statistical* property of a
price history, not a retailer's claimed discount. A store can raise a price
for two weeks then "drop" it back to where it always was — that's not a
deal, and the math here scores it near zero because the fake reference price
never moved the 90-day median.

Everything here is pure functions over plain data (`PricePointData`), with
`now` always passed explicitly rather than read from the clock. That makes
every code path — including "what did this look like 45 days into
tracking?" — trivially testable without mocking time.
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Sequence

# Minimum days of tracking history before a deal_score is computed at all.
# Below this, any "discount" is too likely to be an artifact of a short
# observation window rather than a real price movement.
MIN_COVERAGE_DAYS = 14

# Minimum price points before is_lowest_ever can be claimed — a 2-point
# history being "the lowest ever" is not a meaningful signal.
MIN_POINTS_FOR_LOWEST_EVER = 5

# Component weights. Must sum to 1.0.
WEIGHT_DISCOUNT_DEPTH = 0.40
WEIGHT_RARITY = 0.30
WEIGHT_STABILITY = 0.20
WEIGHT_FRESHNESS = 0.10

# Depth normalization: a price 30% below the 90-day median earns full marks
# on the discount-depth component.
DEPTH_FULL_MARKS_PCT = 0.30

# Stability normalization: a coefficient of variation of 0.15 (15%) or more
# in the pre-drop history earns zero stability marks.
STABILITY_CV_ZERO_MARKS = 0.15

# Freshness normalization: a price decrease 14+ days ago earns zero
# freshness marks.
FRESHNESS_DECAY_DAYS = 14

WINDOW_DAYS_DEFAULT = 90


@dataclass(frozen=True)
class PricePointData:
    captured_at: datetime
    price: Decimal


@dataclass(frozen=True)
class PriceStats:
    latest_price: Decimal | None
    latest_price_at: datetime | None
    median_90d: Decimal | None
    min_ever: Decimal | None
    min_90d: Decimal | None
    max_90d: Decimal | None
    discount_vs_median_pct: float | None
    rarity: float | None
    stability: float | None
    drop_freshness: float | None
    deal_score: float | None
    is_lowest_ever: bool
    n_points: int
    coverage_days: int


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


def _median(values: Sequence[Decimal]) -> Decimal:
    ordered = sorted(values)
    n = len(ordered)
    mid = n // 2
    if n % 2 == 1:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / 2


def daily_series(
    points: Sequence[PricePointData],
    now: datetime,
    window_days: int = WINDOW_DAYS_DEFAULT,
) -> list[tuple[date, Decimal]]:
    """Day-bucketed, forward-filled price series over the trailing window.

    Only the *last* observation on a given calendar day is kept (so multiple
    scrapes in one day count once), and gaps between observations are
    forward-filled from the last known price. This makes every downstream
    statistic a statement about "days at a price", immune to uneven sampling
    — the crux that makes the deal math defensible.

    No backward-fill: days before the first ever observation are omitted
    rather than fabricated.
    """
    if not points:
        return []

    ordered = sorted(points, key=lambda p: p.captured_at)

    by_day: dict[date, Decimal] = {}
    for p in ordered:
        by_day[p.captured_at.date()] = p.price  # last write wins (chronological order)

    window_end = now.date()
    window_start = window_end - timedelta(days=window_days - 1)

    # Seed last_price with the most recent observation at or before
    # window_start, so a gap at the start of the window still forward-fills
    # from real prior history rather than starting blank.
    last_price: Decimal | None = None
    for p in ordered:
        d = p.captured_at.date()
        if d <= window_start:
            last_price = p.price
        else:
            break

    series: list[tuple[date, Decimal]] = []
    day = window_start
    while day <= window_end:
        if day in by_day:
            last_price = by_day[day]
        if last_price is not None:
            series.append((day, last_price))
        day += timedelta(days=1)

    return series


def _trim_trailing_run(
    series: Sequence[tuple[date, Decimal]], current: Decimal
) -> list[tuple[date, Decimal]]:
    """Drop the trailing run of days already at `current` price, isolating
    the pre-drop history used for the stability component."""
    idx = len(series)
    while idx > 0 and series[idx - 1][1] == current:
        idx -= 1
    return list(series[:idx])


def _freshness_score(series: Sequence[tuple[date, Decimal]], now: datetime) -> float:
    last_decrease_day: date | None = None
    for i in range(1, len(series)):
        prev_price = series[i - 1][1]
        day, price = series[i]
        if price < prev_price:
            last_decrease_day = day
    if last_decrease_day is None:
        return 0.0
    days_since = (now.date() - last_decrease_day).days
    return _clamp(1 - days_since / FRESHNESS_DECAY_DAYS)


def compute_stats(points: Sequence[PricePointData], now: datetime) -> PriceStats:
    if not points:
        return PriceStats(
            latest_price=None,
            latest_price_at=None,
            median_90d=None,
            min_ever=None,
            min_90d=None,
            max_90d=None,
            discount_vs_median_pct=None,
            rarity=None,
            stability=None,
            drop_freshness=None,
            deal_score=None,
            is_lowest_ever=False,
            n_points=0,
            coverage_days=0,
        )

    ordered = sorted(points, key=lambda p: p.captured_at)
    latest = ordered[-1]
    earliest = ordered[0]
    n_points = len(ordered)
    coverage_days = (now.date() - earliest.captured_at.date()).days + 1

    min_ever = min(p.price for p in ordered)
    current = latest.price
    is_lowest_ever = current <= min_ever and n_points >= MIN_POINTS_FOR_LOWEST_EVER

    series = daily_series(ordered, now, window_days=WINDOW_DAYS_DEFAULT)
    if series:
        prices_90d = [p for _, p in series]
        median_90d = _median(prices_90d)
        min_90d = min(prices_90d)
        max_90d = max(prices_90d)
    else:
        median_90d = None
        min_90d = None
        max_90d = None

    discount_vs_median_pct: float | None = None
    rarity: float | None = None
    stability: float | None = None
    drop_freshness: float | None = None
    deal_score: float | None = None

    has_enough_history = coverage_days >= MIN_COVERAGE_DAYS and median_90d is not None
    if has_enough_history:
        assert median_90d is not None  # for type-checkers; guarded above

        if median_90d > 0:
            depth = max(Decimal(0), (median_90d - current) / median_90d)
            discount_vs_median_pct = float(depth * 100)
            depth_score = _clamp(float(depth) / DEPTH_FULL_MARKS_PCT)
        else:
            depth_score = 0.0

        above = sum(1 for _, p in series if p > current)
        rarity = above / len(series) if series else 0.0

        trimmed = _trim_trailing_run(series, current)
        if len(trimmed) == 0:
            # The entire window is at the current price — no drop has been
            # observed at all, which is zero variance (maximally stable),
            # not "insufficient data".
            stability = 1.0
        elif len(trimmed) < 3:
            # A drop happened, but there's barely any pre-drop history to
            # judge it against — neither clearly stable nor unstable.
            stability = 0.5
        else:
            trimmed_prices = [float(p) for _, p in trimmed]
            mean = statistics.fmean(trimmed_prices)
            if mean == 0:
                stability = 0.5
            else:
                cv = statistics.pstdev(trimmed_prices) / mean
                stability = _clamp(1 - cv / STABILITY_CV_ZERO_MARKS)

        drop_freshness = _freshness_score(series, now)

        deal_score = round(
            100
            * (
                WEIGHT_DISCOUNT_DEPTH * depth_score
                + WEIGHT_RARITY * rarity
                + WEIGHT_STABILITY * stability
                + WEIGHT_FRESHNESS * drop_freshness
            ),
            1,
        )

    return PriceStats(
        latest_price=current,
        latest_price_at=latest.captured_at,
        median_90d=median_90d,
        min_ever=min_ever,
        min_90d=min_90d,
        max_90d=max_90d,
        discount_vs_median_pct=discount_vs_median_pct,
        rarity=rarity,
        stability=stability,
        drop_freshness=drop_freshness,
        deal_score=deal_score,
        is_lowest_ever=is_lowest_ever,
        n_points=n_points,
        coverage_days=coverage_days,
    )
