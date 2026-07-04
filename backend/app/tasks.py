"""Celery tasks: track a new product, the daily recheck fan-out, the
per-product recheck chain (recompute stats -> evaluate watches -> invalidate
verdict cache), alert delivery, and cached AI verdict computation."""
from __future__ import annotations

import logging
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, Optional

import anthropic
import httpx
from sqlalchemy import delete, select

from .ai.verdict import generate_verdict
from .alerts import should_fire
from .celery_app import celery_app
from .dealmath import PricePointData, compute_stats
from .db import SyncSessionLocal
from .extraction.pipeline import extract_product
from .extraction.pipeline import recheck_product as run_recheck
from .models import AlertEvent, PricePoint, Product, ProductVerdict, User, Watch
from .notify import get_email_sender
from .notify.templates import render_price_drop_email
from .settings import settings
from .urlnorm import domain_of, normalize_url, url_hash

logger = logging.getLogger(__name__)

BOT_WALL_FAILURE_THRESHOLD = 3
RECHECK_STALE_HOURS = 20


def _ensure_watch(session, *, user_id: str, product_id) -> None:
    existing = session.execute(
        select(Watch).where(Watch.user_id == user_id, Watch.product_id == product_id)
    ).scalar_one_or_none()
    if existing is None:
        session.add(Watch(user_id=user_id, product_id=product_id, rule_type="any_drop"))


def _recompute_stats(session, product: Product) -> None:
    rows = session.execute(
        select(PricePoint.captured_at, PricePoint.price)
        .where(PricePoint.product_id == product.id)
        .order_by(PricePoint.captured_at)
    ).all()
    data = [PricePointData(captured_at=row.captured_at, price=row.price) for row in rows]
    now = datetime.now(timezone.utc)
    stats = compute_stats(data, now)

    product.latest_price = stats.latest_price
    product.latest_price_at = stats.latest_price_at
    product.median_90d = stats.median_90d
    product.min_ever = stats.min_ever
    product.is_lowest_ever = stats.is_lowest_ever
    product.deal_score = Decimal(str(stats.deal_score)) if stats.deal_score is not None else None
    product.stats = {
        "discount_vs_median_pct": stats.discount_vs_median_pct,
        "rarity": stats.rarity,
        "stability": stats.stability,
        "drop_freshness": stats.drop_freshness,
        "n_points": stats.n_points,
        "coverage_days": stats.coverage_days,
        "min_90d": str(stats.min_90d) if stats.min_90d is not None else None,
        "max_90d": str(stats.max_90d) if stats.max_90d is not None else None,
    }


def _previous_price_before(session, product_id, new_point_id) -> Optional[Decimal]:
    return session.execute(
        select(PricePoint.price)
        .where(PricePoint.product_id == product_id, PricePoint.id < new_point_id)
        .order_by(PricePoint.id.desc())
        .limit(1)
    ).scalar_one_or_none()


def _evaluate_watches(session, product: Product, previous_price: Decimal, new_point: PricePoint) -> list:
    watches = (
        session.execute(
            select(Watch).where(Watch.product_id == product.id, Watch.is_active.is_(True))
        )
        .scalars()
        .all()
    )

    created_ids = []
    for watch in watches:
        fire, rearm = should_fire(
            rule_type=watch.rule_type,
            threshold=watch.threshold,
            last_notified_price=watch.last_notified_price,
            previous_price=previous_price,
            new_price=new_point.price,
        )
        if rearm:
            watch.last_notified_price = None

        if fire:
            event = AlertEvent(
                watch_id=watch.id,
                user_id=watch.user_id,
                product_id=product.id,
                price_point_id=new_point.id,
                rule_type=watch.rule_type,
                threshold=watch.threshold,
                previous_price=previous_price,
                new_price=new_point.price,
                status="pending",
            )
            session.add(event)
            session.flush()
            watch.last_notified_at = datetime.now(timezone.utc)
            watch.last_notified_price = new_point.price
            created_ids.append(event.id)

    return created_ids


@celery_app.task(
    bind=True,
    name="products.track_url",
    # Only retry genuinely transient network failures. SsrfBlockedError,
    # ExtractionFailedError, and implausible-data ValueErrors are permanent —
    # retrying them just repeats the same failure 3x with backoff for nothing
    # (and, for an SSRF block, needlessly re-attempts a blocked host).
    autoretry_for=(httpx.TimeoutException, httpx.ConnectError, httpx.RemoteProtocolError),
    retry_backoff=True,
    retry_backoff_max=30,
    max_retries=3,
)
def track_url_task(self, url: str, user_id: str) -> Dict[str, Any]:
    normalized = normalize_url(url)
    hashed = url_hash(normalized)
    domain = domain_of(normalized)

    with SyncSessionLocal() as session:
        existing = session.execute(
            select(Product).where(Product.url_hash == hashed)
        ).scalar_one_or_none()

        if existing is not None:
            _ensure_watch(session, user_id=user_id, product_id=existing.id)
            session.commit()
            return {"product_id": str(existing.id), "created": False}

        def report(stage: str) -> None:
            self.update_state(state="PROGRESS", meta={"stage": stage})

        result = extract_product(normalized, on_stage=report)

        self.update_state(state="PROGRESS", meta={"stage": "saving"})

        now = datetime.now(timezone.utc)
        product = Product(
            url=normalized,
            url_hash=hashed,
            domain=domain,
            title=result.product.title,
            image_url=result.product.image_url,
            currency=result.product.currency,
            extraction_strategy=result.strategy,
            extraction_meta=result.meta,
            status="active",
            consecutive_failures=0,
            last_checked_at=now,
            created_at=now,
        )
        session.add(product)
        session.flush()

        point = PricePoint(
            product_id=product.id,
            price=result.product.price,
            currency=result.product.currency,
            in_stock=result.product.in_stock,
            captured_at=now,
            source="initial",
        )
        session.add(point)
        session.flush()

        _recompute_stats(session, product)
        _ensure_watch(session, user_id=user_id, product_id=product.id)

        session.commit()
        return {"product_id": str(product.id), "created": True}


@celery_app.task(name="prices.schedule_rechecks")
def schedule_rechecks_task() -> Dict[str, Any]:
    """Beat-triggered fan-out: enqueue a jittered recheck for every product
    due for a check, spreading same-domain hits ~30s apart."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=RECHECK_STALE_HOURS)

    with SyncSessionLocal() as session:
        rows = session.execute(
            select(Product.id, Product.domain)
            .where(Product.status.in_(["active", "failed", "unavailable"]))
            .where((Product.last_checked_at.is_(None)) | (Product.last_checked_at < cutoff))
            .where(Product.domain.notlike("%.example"))
        ).all()

    by_domain: Dict[str, list] = {}
    for product_id, domain in rows:
        by_domain.setdefault(domain, []).append(product_id)

    enqueued = 0
    for domain_products in by_domain.values():
        base_jitter = random.uniform(0, 3600)
        for idx, product_id in enumerate(domain_products):
            countdown = base_jitter + idx * 30
            recheck_product_task.apply_async((str(product_id),), countdown=countdown)
            enqueued += 1

    return {"enqueued": enqueued, "domains": len(by_domain)}


@celery_app.task(
    bind=True,
    name="prices.recheck_product",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=60,
    max_retries=3,
    time_limit=90,
    soft_time_limit=60,
)
def recheck_product_task(self, product_id: str) -> Dict[str, Any]:
    with SyncSessionLocal() as session:
        product = session.get(Product, product_id)
        if product is None:
            return {"product_id": product_id, "skipped": "not_found"}

        outcome = run_recheck(product.url)
        now = datetime.now(timezone.utc)
        product.last_checked_at = now

        new_point: Optional[PricePoint] = None
        if outcome.failed:
            product.consecutive_failures += 1
            if outcome.blocked:
                product.status = "blocked"
            elif product.consecutive_failures >= BOT_WALL_FAILURE_THRESHOLD:
                product.status = "unavailable"
        else:
            assert outcome.product is not None
            product.consecutive_failures = 0
            product.status = "active"
            if outcome.product.currency != product.currency:
                # Currency flip (e.g. geo-IP change): record the point, but
                # the new currency becomes the baseline for future stats.
                product.currency = outcome.product.currency
            product.extraction_strategy = outcome.strategy

            new_point = PricePoint(
                product_id=product.id,
                price=outcome.product.price,
                currency=outcome.product.currency,
                in_stock=outcome.product.in_stock,
                captured_at=now,
                source="scrape",
            )
            session.add(new_point)
            session.flush()

        _recompute_stats(session, product)

        alert_event_ids: list = []
        if new_point is not None:
            previous_price = _previous_price_before(session, product.id, new_point.id)
            if previous_price is not None and previous_price != new_point.price:
                alert_event_ids = _evaluate_watches(session, product, previous_price, new_point)
                session.execute(
                    delete(ProductVerdict).where(ProductVerdict.product_id == product.id)
                )

        session.commit()

        for alert_event_id in alert_event_ids:
            deliver_alert_task.delay(str(alert_event_id))

        return {
            "product_id": str(product.id),
            "status": product.status,
            "new_point": new_point is not None,
            "alerts_fired": len(alert_event_ids),
        }


@celery_app.task(
    bind=True,
    name="alerts.deliver",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=30,
    max_retries=3,
)
def deliver_alert_task(self, alert_event_id: str) -> Dict[str, Any]:
    with SyncSessionLocal() as session:
        event = session.get(AlertEvent, alert_event_id)
        if event is None:
            return {"alert_event_id": alert_event_id, "skipped": "not_found"}

        product = session.get(Product, event.product_id)
        user = session.get(User, event.user_id)

        sender = get_email_sender()
        subject, html = render_price_drop_email(
            product_title=(product.title if product else None) or event.product_id,
            previous_price=event.previous_price,
            new_price=event.new_price,
            currency=(product.currency if product else None) or "USD",
            deal_score=product.deal_score if product else None,
            product_id=str(event.product_id),
        )

        try:
            sender.send(to=user.email, subject=subject, html=html)
        except Exception:
            event.status = "failed"
            session.commit()
            raise

        event.status = "sent"
        event.sent_at = datetime.now(timezone.utc)
        session.commit()
        return {"alert_event_id": alert_event_id, "status": "sent"}


@celery_app.task(
    bind=True,
    name="ai.compute_verdict",
    autoretry_for=(anthropic.RateLimitError,),
    retry_backoff=True,
    retry_backoff_max=30,
    max_retries=3,
)
def compute_verdict_task(self, product_id: str) -> Dict[str, Any]:
    with SyncSessionLocal() as session:
        product = session.get(Product, product_id)
        if product is None:
            return {"product_id": product_id, "skipped": "not_found"}

        rows = session.execute(
            select(PricePoint.captured_at, PricePoint.price)
            .where(PricePoint.product_id == product.id)
            .order_by(PricePoint.captured_at)
        ).all()
        data = [PricePointData(captured_at=row.captured_at, price=row.price) for row in rows]
        stats = compute_stats(data, datetime.now(timezone.utc))

        if stats.deal_score is None:
            return {"product_id": product_id, "skipped": "insufficient_history"}

        latest_point_id = session.execute(
            select(PricePoint.id)
            .where(PricePoint.product_id == product.id)
            .order_by(PricePoint.captured_at.desc())
            .limit(1)
        ).scalar_one()

        result = generate_verdict(
            stats,
            product.title or product.url,
            product.currency or "USD",
            model=settings.ai_verdict_model,
        )
        if result is None:
            return {"product_id": product_id, "skipped": "ai_unavailable"}

        existing = session.get(ProductVerdict, product.id)
        if existing is None:
            existing = ProductVerdict(product_id=product.id)
            session.add(existing)

        existing.verdict = result.verdict
        existing.rationale = result.rationale
        existing.confidence = result.confidence
        existing.model = settings.ai_verdict_model
        existing.based_on_price_point_id = latest_point_id
        existing.computed_at = datetime.now(timezone.utc)
        session.commit()

        return {"product_id": product_id, "verdict": result.verdict}
