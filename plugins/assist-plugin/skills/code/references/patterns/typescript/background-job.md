# Background Job Queue — TypeScript (BullMQ)

Redis-backed job queue with typed payloads, retry policy, and a worker
process. See [../../languages/typescript.md](../../languages/typescript.md)
for conventions.

## Pattern

```typescript
// queue.ts
import { Queue, JobsOptions } from "bullmq";
import { connection } from "./redis";

interface WelcomeEmailJob {
  userId: string;
}

export const emailQueue = new Queue<WelcomeEmailJob>("email", { connection });

const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 1000 }, // BullMQ adds jitter internally
  removeOnComplete: { age: 3600 },
  removeOnFail: { age: 86400 },
};

export async function enqueueWelcomeEmail(userId: string): Promise<void> {
  await emailQueue.add("send-welcome", { userId }, defaultJobOptions);
}
```

```typescript
// worker.ts
import { Worker, Job } from "bullmq";
import { connection } from "./redis";
import { deliverEmail, PermanentDeliveryError } from "./mailer";

interface WelcomeEmailJob {
  userId: string;
}

const worker = new Worker<WelcomeEmailJob>(
  "email",
  async (job: Job<WelcomeEmailJob>) => {
    try {
      await deliverEmail(job.data.userId);
    } catch (err) {
      if (err instanceof PermanentDeliveryError) {
        logger.error("permanent email failure", { userId: job.data.userId });
        throw new UnrecoverableError(err.message); // skips remaining retries
      }
      throw err; // transient — BullMQ retries with backoff
    }
  },
  { connection, concurrency: 10 }
);

worker.on("failed", (job, err) => {
  logger.error("job failed", { jobId: job?.id, error: err.message });
});
```

## Enqueue from a Request Handler

```typescript
app.post("/users", async (req, reply) => {
  const user = await createUser(req.body);
  await enqueueWelcomeEmail(user.id); // non-blocking; response returns immediately
  return reply.code(201).send({ id: user.id });
});
```

## Notes

- `attempts` + `backoff: { type: "exponential" }` gives automatic exponential
  backoff; BullMQ applies jitter internally to avoid synchronized retries.
- Throw `UnrecoverableError` for permanent failures (validation, business
  rule) to stop retries immediately instead of exhausting the attempt budget.
- Keep job payloads minimal (IDs, not full objects); the worker re-fetches
  current state to avoid processing stale data.
- Set `concurrency` on the `Worker` to bound parallelism per process; scale
  horizontally with more worker processes rather than unbounded concurrency.
- `removeOnComplete`/`removeOnFail` prevent Redis from growing unbounded with
  historical job records.
- Run workers as a separate process/deployment from the API so a slow job
  cannot starve request-handling threads.
