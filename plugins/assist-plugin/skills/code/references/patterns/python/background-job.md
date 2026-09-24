# Background Job Queue — Python (Celery)

Async task offloading with retry policy and result tracking. See
[../../languages/python.md](../../languages/python.md) for conventions.

## Pattern

```python
# celery_app.py
from celery import Celery

celery_app = Celery(
    "worker",
    broker=os.environ["REDIS_URL"],
    backend=os.environ["REDIS_URL"],
)
celery_app.conf.update(
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_time_limit=300,
    task_soft_time_limit=270,
)
```

```python
# tasks.py
import logging

from celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
    retry_backoff_max=60,
    retry_jitter=True,
    max_retries=5,
)
def send_welcome_email(self, user_id: str) -> None:
    try:
        deliver_email(user_id)
    except PermanentDeliveryError:
        logger.error("permanent email failure", extra={"user_id": user_id})
        raise  # not retried; falls through to failure state
```

## Enqueue from a Request Handler

```python
from fastapi import APIRouter, status

router = APIRouter()


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate) -> dict:
    user = save_user(payload)
    send_welcome_email.delay(user.id)  # fire-and-forget, non-blocking
    return {"id": user.id}
```

## Notes

- `task_acks_late=True` + `worker_prefetch_multiplier=1` ensures a task is
  redelivered if a worker crashes mid-execution instead of being lost.
- `autoretry_for` + `retry_backoff`/`retry_jitter` gives exponential backoff
  with jitter for transient errors without manual retry loops.
- Distinguish transient (retry) from permanent (log and fail) errors; do not
  let `autoretry_for` catch validation or business-logic exceptions.
- Keep task payloads small and serializable (IDs, not full objects) — fetch
  fresh state inside the task to avoid stale data.
- Set `task_time_limit`/`task_soft_time_limit` so a hung task cannot block a
  worker slot indefinitely.
- For lighter-weight needs without a broker, `BackgroundTasks` in FastAPI
  handles fire-and-forget work within the same process (no persistence,
  no retry — use only for non-critical, best-effort jobs).
