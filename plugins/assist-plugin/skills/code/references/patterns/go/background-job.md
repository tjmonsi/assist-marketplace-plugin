# Background Job Pattern — Go (Worker Pool)

Bounded goroutine pool consuming a job channel, with graceful shutdown and
per-job panic recovery. See [../../languages/go.md](../../languages/go.md)
for conventions.

## Pattern

```go
package jobs

import (
	"context"
	"sync"
)

type Job struct {
	UserID string
}

type Pool struct {
	jobs    chan Job
	wg      sync.WaitGroup
	handler func(context.Context, Job) error
}

func NewPool(workers int, buffer int, handler func(context.Context, Job) error) *Pool {
	p := &Pool{
		jobs:    make(chan Job, buffer),
		handler: handler,
	}
	for i := 0; i < workers; i++ {
		p.wg.Add(1)
		go p.worker(i)
	}
	return p
}

func (p *Pool) worker(id int) {
	defer p.wg.Done()
	for job := range p.jobs {
		p.process(job)
	}
}

func (p *Pool) process(job Job) {
	defer func() {
		if r := recover(); r != nil {
			logger.Error("job panicked", "job", job, "recover", r)
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := retry.Do(ctx, retry.DefaultOptions(), func() error {
		return p.handler(ctx, job)
	}); err != nil {
		logger.Error("job failed after retries", "job", job, "error", err)
	}
}

// Enqueue submits a job; returns false if the queue is full (caller decides:
// drop, block, or apply backpressure to the producer).
func (p *Pool) Enqueue(job Job) bool {
	select {
	case p.jobs <- job:
		return true
	default:
		return false
	}
}

// Shutdown closes the queue and waits for in-flight jobs to finish.
func (p *Pool) Shutdown() {
	close(p.jobs)
	p.wg.Wait()
}
```

## Usage from a Request Handler

```go
var emailPool = jobs.NewPool(10, 1000, sendWelcomeEmail)

func sendWelcomeEmail(ctx context.Context, job jobs.Job) error {
	return mailer.Deliver(ctx, job.UserID)
}

func createUserHandler(c *fiber.Ctx) error {
	user, err := createUser(c)
	if err != nil {
		return err
	}
	if !emailPool.Enqueue(jobs.Job{UserID: user.ID}) {
		logger.Warn("email queue full, dropping job", "userID", user.ID)
	}
	return c.Status(fiber.StatusCreated).JSON(user)
}
```

## Notes

- `recover()` inside `process` stops one bad job from crashing the entire
  worker goroutine — required per
  [../../error-handling-standards.md](../../error-handling-standards.md).
- A buffered channel (`make(chan Job, buffer)`) plus a non-blocking `select`
  in `Enqueue` gives explicit backpressure behavior instead of an unbounded
  queue that can exhaust memory.
- For durability across process restarts, back the queue with Redis/SQS/NATS
  instead of an in-memory channel; the worker loop shape stays the same.
- `Shutdown` closing the channel and calling `wg.Wait()` ensures graceful
  drain on `SIGTERM` — wire it into the server's shutdown hook.
- Wrap the handler call with retry/backoff (see
  [retry-backoff.md](retry-backoff.md)) for transient failures; log
  exhausted-retry failures for manual follow-up or a dead-letter path.
