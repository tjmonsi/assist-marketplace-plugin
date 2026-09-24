# Retry with Exponential Backoff + Jitter — JavaScript

Resilient outbound call helper, dependency-free. See
[../../languages/javascript.md](../../languages/javascript.md) and
[../../error-handling-standards.md](../../error-handling-standards.md).

## Pattern

```javascript
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {() => Promise<T>} fn
 * @param {{ maxAttempts?: number, baseDelayMs?: number, maxDelayMs?: number, isRetryable?: (err: unknown) => boolean }} [options]
 * @template T
 * @returns {Promise<T>}
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxAttempts = 5,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    isRetryable = () => true,
  } = options;

  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxAttempts || !isRetryable(err)) {
        throw err;
      }
      const capped = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jittered = Math.random() * capped; // full jitter
      logger.warn("retrying after failure", {
        attempt,
        delayMs: Math.round(jittered),
        error: err instanceof Error ? err.message : String(err),
      });
      await sleep(jittered);
    }
  }
}

module.exports = { retryWithBackoff };
```

## Usage

```javascript
const fetch = require("node-fetch");

class UpstreamError extends Error {}

async function fetchUpstream(url) {
  return retryWithBackoff(
    async () => {
      const res = await fetch(url, { timeout: 5000 });
      if (res.status >= 500) {
        throw new UpstreamError(`upstream returned ${res.status}`);
      }
      if (res.status >= 400) {
        throw new Error(`client error ${res.status}`); // not retried
      }
      return res.json();
    },
    { isRetryable: (err) => err instanceof UpstreamError || err.code === "ECONNRESET" }
  );
}
```

## Notes

- Full jitter (`Math.random() * capped`) spreads retries across clients and
  prevents synchronized retry storms after a shared dependency recovers.
- `isRetryable` must exclude `4xx` and non-idempotent write failures; retry
  only timeouts, connection resets, and `5xx` responses.
- Cap total attempts with `maxAttempts` and combine with a per-call timeout so
  a degraded dependency cannot cause unbounded blocking.
- Log every retry (attempt, delay, error) per
  [../../logging-standards.md](../../logging-standards.md); log the final
  exhausted-retries failure at `error` level with full context.
- Prefer an established library (`p-retry`, `async-retry`) in larger codebases
  over a hand-rolled loop, but the same backoff/jitter/exclusion rules apply.
