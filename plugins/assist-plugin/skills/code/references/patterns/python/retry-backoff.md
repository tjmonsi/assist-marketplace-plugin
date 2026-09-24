# Retry with Exponential Backoff + Jitter — Python

Resilient outbound call pattern using `tenacity`, plus a dependency-free
fallback. See [../../languages/python.md](../../languages/python.md) and
[../../error-handling-standards.md](../../error-handling-standards.md).

## Pattern (tenacity)

```python
import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)


class UpstreamError(Exception):
    pass


@retry(
    retry=retry_if_exception_type((httpx.TransportError, UpstreamError)),
    wait=wait_exponential_jitter(initial=0.5, max=8, jitter=0.5),
    stop=stop_after_attempt(5),
    reraise=True,
)
def fetch_upstream(client: httpx.Client, url: str) -> dict:
    response = client.get(url, timeout=5)
    if response.status_code >= 500:
        raise UpstreamError(f"upstream returned {response.status_code}")
    response.raise_for_status()
    return response.json()
```

## Dependency-Free Fallback

```python
import random
import time
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")


def retry_with_backoff(
    fn: Callable[[], T],
    *,
    max_attempts: int = 5,
    base_delay: float = 0.5,
    max_delay: float = 8.0,
    retry_on: tuple[type[Exception], ...] = (Exception,),
) -> T:
    for attempt in range(1, max_attempts + 1):
        try:
            return fn()
        except retry_on as exc:
            if attempt == max_attempts:
                raise
            delay = min(max_delay, base_delay * (2 ** (attempt - 1)))
            jittered = random.uniform(0, delay)
            logger.warning(
                "retrying after failure",
                extra={"attempt": attempt, "delay": jittered, "error": str(exc)},
            )
            time.sleep(jittered)
    raise RuntimeError("unreachable")
```

## Notes

- Use full jitter (`random.uniform(0, delay)`) rather than fixed delay to
  avoid thundering-herd retries across many clients.
- Only retry transient failures (timeouts, `5xx`, connection resets); never
  retry `4xx` client errors or non-idempotent writes without an idempotency key.
- Set a `stop_after_attempt` ceiling and an overall request timeout so a
  degraded dependency cannot cause unbounded retry loops.
- Log every retry attempt with attempt number, delay, and error per
  [../../logging-standards.md](../../logging-standards.md); log the final
  failure at `error` level with full context.
- For async code, use `tenacity.AsyncRetrying` or `asyncio.sleep` in the
  fallback loop instead of blocking `time.sleep`.
