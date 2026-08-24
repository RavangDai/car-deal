"""Endpoint-level tests for the products/watches routers.

Uses FastAPI's `TestClient` (a real ASGI request/response cycle, so
slowapi rate limiting and routing behave exactly as in production) with
dependency overrides for `get_db` (a small scripted fake session),
`get_current_user` (and its anonymous/optional variants), and
`require_csrf`. The fake session returns
pre-queued results in call order rather than executing real SQL — this
exercises the actual ownership checks, rule validation, upsert/dedup
logic, and verdict-cache decision inside each route, but NOT genuine SQL
filtering/sorting (Postgres JSONB columns don't compile on SQLite, so a
real query engine isn't a practical substitute here without a running
Postgres — that coverage lives in the documented docker-compose e2e flow).
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app import products_api, watches_api
from app.auth import (
    get_current_user,
    get_current_user_optional,
    get_or_create_session_user,
)
from app.cookies import require_csrf
from app.db import get_db
from app.main import app
from app.models import AlertEvent, Product, User, Watch


class _ExecuteResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value

    def scalars(self):
        return self

    def all(self):
        if self._value is None:
            return []
        return self._value if isinstance(self._value, list) else [self._value]


class FakeSession:
    """Scripted async session — each queue is consumed FIFO per call type."""

    def __init__(self):
        self._execute_q = []
        self._get_q = []
        self._scalar_q = []
        self.added = []
        self.deleted = []
        self.committed = False

    def queue_execute(self, value):
        self._execute_q.append(_ExecuteResult(value))

    def queue_get(self, value):
        self._get_q.append(value)

    def queue_scalar(self, value):
        self._scalar_q.append(value)

    async def execute(self, _stmt):
        return self._execute_q.pop(0)

    async def get(self, _model, _id):
        return self._get_q.pop(0)

    async def scalar(self, _stmt):
        return self._scalar_q.pop(0)

    def add(self, obj):
        # Simulate what a real flush/insert would populate via column
        # defaults (id, is_active, created_at) — the fake session never
        # actually flushes, so these would otherwise stay None.
        if isinstance(obj, Watch):
            if obj.id is None:
                obj.id = uuid.uuid4()
            if obj.is_active is None:
                obj.is_active = True
            if obj.created_at is None:
                obj.created_at = datetime.now(timezone.utc)
        self.added.append(obj)

    async def commit(self):
        self.committed = True

    async def refresh(self, _obj):
        pass

    async def delete(self, obj):
        self.deleted.append(obj)


def make_user(user_id=None) -> User:
    return User(id=user_id or uuid.uuid4(), email="user@example.com")


def make_product(**overrides) -> Product:
    defaults = dict(
        id=uuid.uuid4(),
        url="https://shop.example.com/p/widget",
        url_hash="a" * 64,
        domain="shop.example.com",
        title="Widget",
        currency="USD",
        status="active",
        consecutive_failures=0,
        created_at=datetime.now(timezone.utc),
        is_lowest_ever=False,
        deal_score=Decimal("70.0"),
    )
    defaults.update(overrides)
    return Product(**defaults)


def make_watch(**overrides) -> Watch:
    defaults = dict(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        product_id=uuid.uuid4(),
        rule_type="any_drop",
        threshold=None,
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    return Watch(**defaults)


@pytest.fixture()
def fake_session():
    return FakeSession()


@pytest.fixture()
def current_user():
    return make_user()


@pytest.fixture()
def client(fake_session, current_user):
    async def _get_db_override():
        yield fake_session

    async def _current_user_override():
        return current_user

    async def _csrf_override():
        return None

    app.dependency_overrides[get_db] = _get_db_override
    # Endpoints now resolve identity three ways: `get_current_user` (strict,
    # e.g. /auth/me), `get_or_create_session_user` (actions -- mints an
    # anonymous owner when there is no session), and `get_current_user_optional`
    # (reads). All three must resolve to the same fake user here, or a test
    # that acts as one identity would read as another.
    app.dependency_overrides[get_current_user] = _current_user_override
    app.dependency_overrides[get_or_create_session_user] = _current_user_override
    app.dependency_overrides[get_current_user_optional] = _current_user_override
    app.dependency_overrides[require_csrf] = _csrf_override

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


# ── POST /products/track ────────────────────────────────────────────────

def test_track_url_rejects_invalid_url_without_touching_db(client):
    resp = client.post("/products/track", json={"url": "ftp://not-http.example"})
    assert resp.status_code == 422


def test_track_url_enqueues_task_and_returns_job_id(client, fake_session, monkeypatch):
    fake_session.queue_scalar(0)  # active watch count, well under the cap

    class FakeAsyncResult:
        id = "job-123"

    monkeypatch.setattr(products_api.track_url_task, "delay", lambda **kw: FakeAsyncResult())

    resp = client.post("/products/track", json={"url": "https://shop.example.com/p/widget"})
    assert resp.status_code == 202
    assert resp.json() == {"job_id": "job-123", "status": "queued"}


def test_track_url_blocked_at_max_watches(client, fake_session, monkeypatch):
    monkeypatch.setattr(products_api.settings, "max_watches_per_user", 5)
    fake_session.queue_scalar(5)  # already at the cap

    resp = client.post("/products/track", json={"url": "https://shop.example.com/p/widget"})
    assert resp.status_code == 429


# ── GET /products/track/{job_id} ────────────────────────────────────────

def test_get_track_job_progress_state(client, monkeypatch):
    class FakeResult:
        state = "PROGRESS"
        info = {"stage": "fetching"}
        result = None

    monkeypatch.setattr(products_api, "AsyncResult", lambda job_id, app: FakeResult())

    resp = client.get("/products/track/job-abc")
    assert resp.status_code == 200
    body = resp.json()
    assert body["state"] == "PROGRESS"
    assert body["progress"] == {"stage": "fetching"}


def test_get_track_job_success_state(client, monkeypatch):
    class FakeResult:
        state = "SUCCESS"
        info = None
        result = {"product_id": "abc-123", "created": True}

    monkeypatch.setattr(products_api, "AsyncResult", lambda job_id, app: FakeResult())

    resp = client.get("/products/track/job-abc")
    assert resp.status_code == 200
    assert resp.json()["result"] == {"product_id": "abc-123", "created": True}


def test_get_track_job_failure_state(client, monkeypatch):
    class FakeResult:
        state = "FAILURE"
        info = "boom"
        result = None

    monkeypatch.setattr(products_api, "AsyncResult", lambda job_id, app: FakeResult())

    resp = client.get("/products/track/job-abc")
    assert resp.status_code == 200
    assert resp.json()["error"] == "boom"


# ── GET /products/{id} ───────────────────────────────────────────────────

def test_get_product_404_when_missing(client, fake_session):
    fake_session.queue_get(None)
    resp = client.get(f"/products/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_get_product_returns_product(client, fake_session):
    product = make_product()
    fake_session.queue_get(product)
    resp = client.get(f"/products/{product.id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Widget"


# ── GET /products/{id}/verdict ───────────────────────────────────────────

def test_verdict_unavailable_when_ai_disabled(client, fake_session, monkeypatch):
    product = make_product()
    fake_session.queue_get(product)
    monkeypatch.setattr(products_api, "ai_is_enabled", lambda: False)

    resp = client.get(f"/products/{product.id}/verdict")
    assert resp.status_code == 200
    assert resp.json()["state"] == "unavailable"


def test_verdict_unavailable_when_no_deal_score(client, fake_session, monkeypatch):
    product = make_product(deal_score=None)
    fake_session.queue_get(product)
    monkeypatch.setattr(products_api, "ai_is_enabled", lambda: True)
    fake_session.queue_scalar(42)  # latest_point_id lookup
    fake_session.queue_get(None)  # no cached verdict

    resp = client.get(f"/products/{product.id}/verdict")
    assert resp.status_code == 200
    assert resp.json()["state"] == "unavailable"


def test_verdict_ready_from_fresh_cache(client, fake_session, monkeypatch):
    product = make_product()
    fake_session.queue_get(product)
    monkeypatch.setattr(products_api, "ai_is_enabled", lambda: True)
    fake_session.queue_scalar(42)  # latest_point_id

    from app.models import ProductVerdict

    cached = ProductVerdict(
        product_id=product.id,
        verdict="buy",
        rationale="It's fresh and it's low.",
        confidence="high",
        model="claude-opus-4-8",
        based_on_price_point_id=42,  # matches latest -> cache is fresh
        computed_at=datetime.now(timezone.utc),
    )
    fake_session.queue_get(cached)

    resp = client.get(f"/products/{product.id}/verdict")
    assert resp.status_code == 200
    body = resp.json()
    assert body["state"] == "ready"
    assert body["verdict"] == "buy"


def test_verdict_pending_enqueues_when_cache_stale(client, fake_session, monkeypatch):
    product = make_product()
    fake_session.queue_get(product)
    monkeypatch.setattr(products_api, "ai_is_enabled", lambda: True)
    fake_session.queue_scalar(99)  # latest_point_id has moved on

    from app.models import ProductVerdict

    stale = ProductVerdict(
        product_id=product.id,
        verdict="wait",
        rationale="stale",
        confidence="low",
        model="claude-opus-4-8",
        based_on_price_point_id=42,  # does NOT match latest -> stale
        computed_at=datetime.now(timezone.utc),
    )
    fake_session.queue_get(stale)

    enqueued = {}
    monkeypatch.setattr(
        products_api.compute_verdict_task, "delay", lambda **kw: enqueued.update(kw)
    )

    resp = client.get(f"/products/{product.id}/verdict")
    assert resp.status_code == 200
    assert resp.json()["state"] == "pending"
    assert enqueued["product_id"] == str(product.id)


# ── POST /watches ──────────────────────────────────────────────────────

def test_create_watch_product_not_found(client, fake_session):
    fake_session.queue_get(None)
    resp = client.post("/watches", json={"product_id": str(uuid.uuid4())})
    assert resp.status_code == 404


def test_create_watch_creates_new(client, fake_session):
    product = make_product()
    fake_session.queue_get(product)  # product lookup
    fake_session.queue_execute(None)  # no existing watch
    fake_session.queue_scalar(0)  # active watch count

    resp = client.post("/watches", json={"product_id": str(product.id), "rule_type": "any_drop"})
    assert resp.status_code == 201
    assert len(fake_session.added) == 1
    assert fake_session.committed is True


def test_create_watch_upserts_existing(client, fake_session):
    product = make_product()
    existing_watch = make_watch(product_id=product.id, rule_type="any_drop")
    fake_session.queue_get(product)
    fake_session.queue_execute(existing_watch)

    resp = client.post(
        "/watches", json={"product_id": str(product.id), "rule_type": "percent_drop", "threshold": 20}
    )
    assert resp.status_code == 201
    assert existing_watch.rule_type == "percent_drop"
    assert len(fake_session.added) == 0  # upsert, not a new row


def test_create_watch_percent_drop_requires_valid_threshold(client, fake_session):
    product = make_product()
    fake_session.queue_get(product)
    fake_session.queue_execute(None)

    resp = client.post(
        "/watches", json={"product_id": str(product.id), "rule_type": "percent_drop", "threshold": 150}
    )
    assert resp.status_code == 422


def test_create_watch_target_price_requires_positive_threshold(client, fake_session):
    product = make_product()
    fake_session.queue_get(product)
    fake_session.queue_execute(None)

    resp = client.post(
        "/watches", json={"product_id": str(product.id), "rule_type": "target_price", "threshold": -5}
    )
    assert resp.status_code == 422


def test_create_watch_blocked_at_max_watches(client, fake_session, monkeypatch):
    monkeypatch.setattr(watches_api.settings, "max_watches_per_user", 2)
    product = make_product()
    fake_session.queue_get(product)
    fake_session.queue_execute(None)
    fake_session.queue_scalar(2)  # already at the cap

    resp = client.post("/watches", json={"product_id": str(product.id)})
    assert resp.status_code == 429


# ── PATCH / DELETE /watches/{id} — ownership ─────────────────────────────

def test_update_watch_404_when_missing(client, fake_session):
    fake_session.queue_get(None)
    resp = client.patch(f"/watches/{uuid.uuid4()}", json={"is_active": False})
    assert resp.status_code == 404


def test_update_watch_404_when_not_owned(client, fake_session, current_user):
    other_users_watch = make_watch(user_id=uuid.uuid4())
    assert other_users_watch.user_id != current_user.id
    fake_session.queue_get(other_users_watch)

    resp = client.patch(f"/watches/{other_users_watch.id}", json={"is_active": False})
    assert resp.status_code == 404


def test_update_watch_changes_rule(client, fake_session, current_user):
    watch = make_watch(user_id=current_user.id, rule_type="any_drop")
    fake_session.queue_get(watch)

    resp = client.patch(
        f"/watches/{watch.id}", json={"rule_type": "target_price", "threshold": 42}
    )
    assert resp.status_code == 200
    assert watch.rule_type == "target_price"
    assert watch.threshold == Decimal("42")


def test_delete_watch_404_when_not_owned(client, fake_session):
    watch = make_watch(user_id=uuid.uuid4())
    fake_session.queue_get(watch)
    resp = client.delete(f"/watches/{watch.id}")
    assert resp.status_code == 404
    assert len(fake_session.deleted) == 0


def test_delete_watch_success(client, fake_session, current_user):
    watch = make_watch(user_id=current_user.id)
    fake_session.queue_get(watch)
    resp = client.delete(f"/watches/{watch.id}")
    assert resp.status_code == 204
    assert fake_session.deleted == [watch]


# ── GET /alerts ────────────────────────────────────────────────────────

def test_list_alerts_returns_queued_events(client, fake_session, current_user):
    event = AlertEvent(
        id=uuid.uuid4(),
        watch_id=uuid.uuid4(),
        user_id=current_user.id,
        product_id=uuid.uuid4(),
        price_point_id=1,
        rule_type="any_drop",
        previous_price=Decimal("100"),
        new_price=Decimal("90"),
        status="sent",
        created_at=datetime.now(timezone.utc),
    )
    fake_session.queue_execute([event])

    resp = client.get("/alerts")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["status"] == "sent"
