# Background Job Pattern — Kotlin (Coroutines / WorkManager)

Bounded coroutine worker pool for server-side background jobs, plus a
WorkManager variant for Android. See
[../../languages/kotlin.md](../../languages/kotlin.md) for conventions.

## Server-Side Pattern (Coroutines + Channel)

```kotlin
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel

data class Job(val userId: String)

class JobPool(
    private val workers: Int,
    bufferSize: Int,
    private val scope: CoroutineScope,
    private val handler: suspend (Job) -> Unit,
) {
    private val channel = Channel<Job>(capacity = bufferSize)

    init {
        repeat(workers) {
            scope.launch(Dispatchers.IO) {
                for (job in channel) {
                    process(job)
                }
            }
        }
    }

    private suspend fun process(job: Job) {
        try {
            retryWithBackoff { handler(job) }
        } catch (err: CancellationException) {
            throw err // never swallow cancellation
        } catch (err: Throwable) {
            logger.error("job failed after retries job={} error={}", job, err.message)
        }
    }

    /** Returns false if the queue is full; caller decides drop or backpressure. */
    fun tryEnqueue(job: Job): Boolean = channel.trySend(job).isSuccess

    fun shutdown() {
        channel.close()
    }
}
```

## Usage from a Request Handler

```kotlin
val emailPool = JobPool(workers = 10, bufferSize = 1000, scope = applicationScope) { job ->
    mailer.deliver(job.userId)
}

fun Route.createUserRoute() {
    post("/users") {
        val user = createUser(call.receive())
        if (!emailPool.tryEnqueue(Job(user.id))) {
            logger.warn("email queue full, dropping job userId={}", user.id)
        }
        call.respond(HttpStatusCode.Created, user)
    }
}
```

## Android Pattern (WorkManager)

```kotlin
class WelcomeEmailWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val userId = inputData.getString("userId") ?: return Result.failure()
        return try {
            mailer.deliver(userId)
            Result.success()
        } catch (err: IOException) {
            Result.retry() // WorkManager applies its own exponential backoff
        } catch (err: Exception) {
            Result.failure()
        }
    }
}

val request = OneTimeWorkRequestBuilder<WelcomeEmailWorker>()
    .setInputData(workDataOf("userId" to userId))
    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
    .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
    .build()

WorkManager.getInstance(context).enqueue(request)
```

## Notes

- Never catch and swallow `CancellationException` — rethrow it so structural
  concurrency (scope cancellation, timeouts) still works per
  [../../error-handling-standards.md](../../error-handling-standards.md).
- `Channel(capacity = bufferSize)` + `trySend` gives explicit backpressure;
  a full queue returns a failed `SendResult` instead of blocking the producer.
- Combine with the retry helper (see [retry-backoff.md](retry-backoff.md))
  inside `process` for transient failures; log exhausted-retry failures for
  manual follow-up or a dead-letter path.
- For durability across process restarts, back the channel with a persistent
  broker (Redis Streams, SQS) instead of an in-memory `Channel`.
- On Android, prefer `WorkManager` over raw coroutines for anything that must
  survive process death — it persists work requests and handles retry/backoff
  and constraints (network, charging) natively.
