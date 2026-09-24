# Background Job Queue — JavaScript (Bull)

Redis-backed job queue with retry policy and a worker process. See
[../../languages/javascript.md](../../languages/javascript.md) for conventions.

## Pattern

```javascript
// queue.js
const Queue = require("bull");

const emailQueue = new Queue("email", process.env.REDIS_URL, {
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

async function enqueueWelcomeEmail(userId) {
  await emailQueue.add("send-welcome", { userId });
}

module.exports = { emailQueue, enqueueWelcomeEmail };
```

```javascript
// worker.js
const { emailQueue } = require("./queue");
const { deliverEmail, PermanentDeliveryError } = require("./mailer");

emailQueue.process("send-welcome", 10, async (job) => {
  const { userId } = job.data;
  try {
    await deliverEmail(userId);
  } catch (err) {
    if (err instanceof PermanentDeliveryError) {
      logger.error("permanent email failure", { userId });
      throw new Error(`unrecoverable: ${err.message}`); // still marked failed after final attempt
    }
    throw err; // transient — Bull retries with backoff
  }
});

emailQueue.on("failed", (job, err) => {
  logger.error("job failed", { jobId: job.id, error: err.message });
});
```

## Enqueue from a Request Handler

```javascript
router.post("/users", async (req, res) => {
  const user = await createUser(req.body);
  await enqueueWelcomeEmail(user.id); // non-blocking; response returns immediately
  res.status(201).json({ id: user.id });
});
```

## Notes

- `attempts` + `backoff: { type: "exponential" }` handles exponential
  backoff automatically; Bull adds internal jitter to spread retry timing.
- For truly unrecoverable errors, either check `job.attemptsMade` and bail
  early or move the job to a dead-letter queue via `on("failed")` once
  attempts are exhausted — Bull has no built-in "no retry" throw type.
- Keep job payloads minimal (IDs, not full objects); the worker re-fetches
  current state to avoid processing stale data.
- Set the processor's concurrency argument (`.process("name", N, fn)`) to
  bound parallelism per worker process; scale with more processes, not
  unbounded concurrency.
- Run workers as a separate process/deployment from the API so a slow job
  cannot starve request-handling.
- `removeOnComplete`/`removeOnFail` caps prevent Redis from growing unbounded
  with historical job records.
