# Retry with Exponential Backoff + Jitter — Kotlin

Resilient outbound call helper using coroutines. See
[../../languages/kotlin.md](../../languages/kotlin.md) and
[../../error-handling-standards.md](../../error-handling-standards.md).

## Pattern

```kotlin
import kotlinx.coroutines.delay
import kotlin.math.min
import kotlin.math.pow
import kotlin.random.Random

data class RetryOptions(
    val maxAttempts: Int = 5,
    val baseDelayMs: Long = 500,
    val maxDelayMs: Long = 8000,
)

suspend fun <T> retryWithBackoff(
    options: RetryOptions = RetryOptions(),
    isRetryable: (Throwable) -> Boolean = { true },
    block: suspend () -> T,
): T {
    var attempt = 0
    while (true) {
        attempt++
        try {
            return block()
        } catch (err: Throwable) {
            if (attempt >= options.maxAttempts || !isRetryable(err)) throw err

            val capped = min(
                options.maxDelayMs.toDouble(),
                options.baseDelayMs * 2.0.pow(attempt - 1),
            )
            val jittered = Random.nextDouble(0.0, capped).toLong() // full jitter

            logger.warn("retrying after failure attempt={} delayMs={} error={}", attempt, jittered, err.message)
            delay(jittered)
        }
    }
}
```

## Usage

```kotlin
class UpstreamException(message: String) : Exception(message)

suspend fun fetchUpstream(client: HttpClient, url: String): String {
    return retryWithBackoff(
        isRetryable = { it is UpstreamException || it is java.net.ConnectException },
    ) {
        val response = client.get(url)
        when {
            response.status.value >= 500 -> throw UpstreamException("upstream returned ${response.status}")
            response.status.value >= 400 -> error("client error ${response.status}") // not retried
            else -> response.bodyAsText()
        }
    }
}
```

## Notes

- Full jitter (`Random.nextDouble(0.0, capped)`) prevents synchronized retry
  storms across many callers hitting the same recovering dependency.
- `isRetryable` must exclude client errors (`4xx`) and non-idempotent write
  failures; retry only network errors, timeouts, and `5xx` responses.
- `delay()` suspends the coroutine without blocking the underlying thread —
  never use `Thread.sleep` inside a `suspend fun`.
- Wrap the call in `withTimeout(...)` for an overall deadline so retries
  cannot exceed a bounded total duration.
- Log every retry attempt per
  [../../logging-standards.md](../../logging-standards.md); log the final
  exhausted-retries throw at `error` level with full context.
- Catching `Throwable` inside the loop is intentional to cover both
  exceptions and errors from the block, but re-throw immediately when not
  retryable or attempts are exhausted — never swallow silently.
