# Retry with Exponential Backoff + Jitter — Go

Resilient outbound call helper using context-aware sleep. See
[../../languages/go.md](../../languages/go.md) and
[../../error-handling-standards.md](../../error-handling-standards.md).

## Pattern

```go
package retry

import (
	"context"
	"errors"
	"math"
	"math/rand"
	"time"
)

type Options struct {
	MaxAttempts int
	BaseDelay   time.Duration
	MaxDelay    time.Duration
	IsRetryable func(error) bool
}

func DefaultOptions() Options {
	return Options{
		MaxAttempts: 5,
		BaseDelay:   500 * time.Millisecond,
		MaxDelay:    8 * time.Second,
		IsRetryable: func(error) bool { return true },
	}
}

// Do runs fn with exponential backoff and full jitter, honoring ctx cancellation.
func Do(ctx context.Context, opts Options, fn func() error) error {
	var lastErr error
	for attempt := 1; attempt <= opts.MaxAttempts; attempt++ {
		lastErr = fn()
		if lastErr == nil {
			return nil
		}
		if !opts.IsRetryable(lastErr) || attempt == opts.MaxAttempts {
			return lastErr
		}

		capped := math.Min(
			float64(opts.MaxDelay),
			float64(opts.BaseDelay)*math.Pow(2, float64(attempt-1)),
		)
		jittered := time.Duration(rand.Float64() * capped) // full jitter

		logger.Warn("retrying after failure",
			"attempt", attempt, "delay", jittered, "error", lastErr)

		select {
		case <-time.After(jittered):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return lastErr
}
```

## Usage

```go
var ErrUpstream = errors.New("upstream error")

func fetchUpstream(ctx context.Context, client *http.Client, url string) ([]byte, error) {
	var body []byte
	err := retry.Do(ctx, retry.DefaultOptions(), func() error {
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		resp, err := client.Do(req)
		if err != nil {
			return err // network error — retryable
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 500 {
			return ErrUpstream
		}
		if resp.StatusCode >= 400 {
			return fmt.Errorf("client error: %d", resp.StatusCode) // not retried
		}
		body, err = io.ReadAll(resp.Body)
		return err
	})
	return body, err
}
```

## Notes

- Full jitter (`rand.Float64() * capped`) prevents synchronized retry storms
  across many callers hitting the same recovering dependency.
- `IsRetryable` must exclude `4xx` and non-idempotent write failures; retry
  only network errors, timeouts, and `5xx` responses.
- `select` on `ctx.Done()` alongside the backoff timer ensures a canceled
  request context aborts the retry loop immediately instead of blocking.
- Set an overall deadline via `context.WithTimeout` on the caller side so
  retries cannot exceed a bounded total duration.
- Log every retry attempt (attempt, delay, error) per
  [../../logging-standards.md](../../logging-standards.md); the final
  returned error should carry enough context for the caller to log at `error`.
