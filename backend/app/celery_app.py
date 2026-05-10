from celery import Celery

from .settings import settings


celery_app = Celery(
    "car_deal_finder",
    broker=f"{settings.redis_url}/0",
    backend=f"{settings.redis_url}/1",
    include=["app.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=120,
    task_soft_time_limit=90,
    result_expires=3600,
    worker_prefetch_multiplier=1,
)
