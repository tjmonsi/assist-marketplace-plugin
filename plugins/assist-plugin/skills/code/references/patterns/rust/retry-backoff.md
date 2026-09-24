# Retry with Exponential Backoff + Jitter — Rust

Resilient outbound call helper built on `tokio::time`. See
[../../languages/rust.md](../../languages/rust.md) and
[../../error-handling-standards.md](../../error-handling-standards.md).

## Pattern

```rust
use rand::Rng;
use std::time::Duration;

pub struct RetryOptions {
    pub max_attempts: u32,
    pub base_delay: Duration,
    pub max_delay: Duration,
}

impl Default for RetryOptions {
    fn default() -> Self {
        Self {
            max_attempts: 5,
            base_delay: Duration::from_millis(500),
            max_delay: Duration::from_secs(8),
        }
    }
}

pub async fn retry_with_backoff<T, E, F, Fut>(
    opts: RetryOptions,
    is_retryable: impl Fn(&E) -> bool,
    mut fn_: F,
) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, E>>,
    E: std::fmt::Display,
{
    let mut attempt = 0;
    loop {
        attempt += 1;
        match fn_().await {
            Ok(value) => return Ok(value),
            Err(err) => {
                if attempt >= opts.max_attempts || !is_retryable(&err) {
                    return Err(err);
                }
                let capped = opts.base_delay.as_millis() as f64 * 2f64.powi(attempt as i32 - 1);
                let capped = capped.min(opts.max_delay.as_millis() as f64);
                let jittered = rand::thread_rng().gen_range(0.0..capped); // full jitter

                tracing::warn!(attempt, delay_ms = jittered as u64, error = %err, "retrying after failure");
                tokio::time::sleep(Duration::from_millis(jittered as u64)).await;
            }
        }
    }
}
```

## Usage

```rust
#[derive(Debug, thiserror::Error)]
enum FetchError {
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("upstream returned {0}")]
    Upstream(u16),
    #[error("client error: {0}")]
    Client(u16),
}

async fn fetch_upstream(client: &reqwest::Client, url: &str) -> Result<String, FetchError> {
    retry_with_backoff(
        RetryOptions::default(),
        |err: &FetchError| matches!(err, FetchError::Network(_) | FetchError::Upstream(_)),
        || async {
            let resp = client.get(url).send().await?;
            let status = resp.status();
            if status.is_server_error() {
                return Err(FetchError::Upstream(status.as_u16()));
            }
            if status.is_client_error() {
                return Err(FetchError::Client(status.as_u16())); // not retried
            }
            Ok(resp.text().await?)
        },
    )
    .await
}
```

## Notes

- Full jitter (`gen_range(0.0..capped)`) avoids synchronized retry storms
  across many callers hitting the same recovering dependency.
- `is_retryable` should match only network errors and `5xx`; `Client` (`4xx`)
  and non-idempotent write failures must not be retried.
- `tokio::time::sleep` yields to the runtime instead of blocking a thread;
  never use `std::thread::sleep` inside async code.
- Wrap the whole call with `tokio::time::timeout` for an overall deadline so
  retries cannot exceed a bounded total duration.
- Log every retry attempt via `tracing::warn!` per
  [../../logging-standards.md](../../logging-standards.md); log final
  exhausted-retries failures at `error` level with the error's `Display`.
