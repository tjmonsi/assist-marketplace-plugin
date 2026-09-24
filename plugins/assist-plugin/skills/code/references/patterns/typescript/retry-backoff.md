# Retry with Exponential Backoff + Jitter — TypeScript

Resilient outbound call helper, dependency-free and typed. See
[../../languages/typescript.md](../../languages/typescript.md) and
[../../error-handling-standards.md](../../error-handling-standards.md).

## Pattern

```typescript
interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (err: unknown) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  {
    maxAttempts = 5,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    isRetryable = () => true,
  }: RetryOptions = {}
): Promise<T> {
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
```

## Usage

```typescript
import { request } from "undici";

class UpstreamError extends Error {}

async function fetchUpstream(url: string): Promise<unknown> {
  return retryWithBackoff(
    async () => {
      const res = await request(url, { headersTimeout: 5000 });
      if (res.statusCode >= 500) {
        throw new UpstreamError(`upstream returned ${res.statusCode}`);
      }
      if (res.statusCode >= 400) {
        throw new Error(`client error ${res.statusCode}`); // not retried
      }
      return res.body.json();
    },
    {
      isRetryable: (err) =>
        err instanceof UpstreamError || err instanceof TypeError, // network errors
    }
  );
}
```

## Notes

- Full jitter (`Math.random() * capped`) spreads retries across clients and
  avoids synchronized retry storms after an outage.
- `isRetryable` must exclude `4xx` and non-idempotent write failures; only
  retry timeouts, network errors, and `5xx` responses.
- Cap total retry time with `maxAttempts`; combine with an overall
  `AbortController` timeout on the underlying request.
- Log every retry attempt (attempt number, delay, error) per
  [../../logging-standards.md](../../logging-standards.md); log the final
  exhausted-retries failure at `error` level.
- For libraries already offering retry (e.g., `got`, `axios-retry`), prefer
  the library's built-in exponential backoff with jitter over reimplementing.
