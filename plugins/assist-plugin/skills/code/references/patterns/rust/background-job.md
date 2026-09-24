# Background Job Pattern — Rust (Tokio Task Queue)

Bounded async worker pool over `tokio::sync::mpsc`, with per-job panic
isolation and graceful shutdown. See
[../../languages/rust.md](../../languages/rust.md) for conventions.

## Pattern

```rust
use tokio::sync::mpsc;
use tokio::task::JoinSet;

#[derive(Debug, Clone)]
pub struct Job {
    pub user_id: String,
}

pub struct Pool {
    sender: mpsc::Sender<Job>,
}

impl Pool {
    pub fn new(workers: usize, buffer: usize, handler: fn(Job) -> futures::future::BoxFuture<'static, anyhow::Result<()>>) -> (Self, JoinSet<()>) {
        let (tx, rx) = mpsc::channel::<Job>(buffer);
        let rx = std::sync::Arc::new(tokio::sync::Mutex::new(rx));
        let mut set = JoinSet::new();

        for _ in 0..workers {
            let rx = rx.clone();
            set.spawn(async move {
                loop {
                    let job = { rx.lock().await.recv().await };
                    match job {
                        Some(job) => process(job, handler).await,
                        None => break, // channel closed, all senders dropped
                    }
                }
            });
        }

        (Self { sender: tx }, set)
    }

    /// Returns Err if the queue is full; caller decides drop/backpressure.
    pub fn try_enqueue(&self, job: Job) -> Result<(), Job> {
        self.sender.try_send(job).map_err(|e| match e {
            mpsc::error::TrySendError::Full(job) => job,
            mpsc::error::TrySendError::Closed(job) => job,
        })
    }
}

async fn process(job: Job, handler: fn(Job) -> futures::future::BoxFuture<'static, anyhow::Result<()>>) {
    let result = tokio::spawn(async move { handler(job.clone()).await }).await;
    match result {
        Ok(Ok(())) => {}
        Ok(Err(err)) => tracing::error!(?job, %err, "job failed"),
        Err(join_err) if join_err.is_panic() => {
            tracing::error!(?job, "job panicked");
        }
        Err(join_err) => tracing::error!(?job, %join_err, "job task failed"),
    }
}
```

## Usage from a Request Handler

```rust
fn send_welcome_email(job: Job) -> futures::future::BoxFuture<'static, anyhow::Result<()>> {
    Box::pin(async move { mailer::deliver(&job.user_id).await })
}

async fn create_user_handler(
    State(state): State<AppState>,
    Json(payload): Json<CreateUser>,
) -> Result<Json<User>, ApiError> {
    let user = create_user(&state, payload).await?;
    if state.email_pool.try_enqueue(Job { user_id: user.id.clone() }).is_err() {
        tracing::warn!(user_id = %user.id, "email queue full, dropping job");
    }
    Ok(Json(user))
}
```

## Notes

- Wrapping each job in `tokio::spawn` isolates a panicking task; `JoinError`
  from a panicked task is caught by the outer `process` loop instead of
  taking down the whole worker per
  [../../error-handling-standards.md](../../error-handling-standards.md).
- A bounded channel (`mpsc::channel(buffer)`) plus `try_send` gives explicit
  backpressure — full queue returns `Err` instead of blocking the producer or
  growing unbounded.
- For durability across process restarts, back the queue with a persistent
  broker (Redis Streams, SQS, NATS JetStream) instead of an in-memory channel.
- Combine job execution with the retry helper (see
  [retry-backoff.md](retry-backoff.md)) for transient failures inside
  `handler`.
- Dropping all `Pool` senders closes the channel, letting worker loops drain
  and exit on `None` — wire this into the application's shutdown sequence.
