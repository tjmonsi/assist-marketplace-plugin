# Rust Integration Testing

Integration testing patterns for Rust projects using sqlx, tokio, axum, and reqwest.

## Setup

### Dependencies (Cargo.toml)
```toml
[dev-dependencies]
tokio = { version = "1", features = ["full"] }
sqlx = { version = "0.7", features = ["postgres", "runtime-tokio"] }
axum = "0.7"
reqwest = { version = "0.11", features = ["json"] }
tower = "0.4"
serde_json = "1.0"

[package]
# Enable integration tests
```

### Database Setup
```bash
# Create test database
createdb test_myapp

# Add .env for tests
echo "DATABASE_URL=postgres://localhost/test_myapp" >> .env.test
```

## Test Database

### With sqlx::test macro

```rust
// tests/integration_tests.rs
use sqlx::PgPool;

#[sqlx::test(migrations = "./migrations")]
async fn test_user_creation(pool: PgPool) -> Result<(), sqlx::Error> {
    // Each test gets a fresh database with migrations applied
    // Automatic rollback after test

    let result = sqlx::query_as::<_, (i32, String)>(
        "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name"
    )
    .bind("Alice")
    .bind("alice@test.com")
    .fetch_one(&pool)
    .await?;

    assert_eq!(result.1, "Alice");
    Ok(())
}
```

The `#[sqlx::test]` macro:
- Automatically creates a test database per test
- Runs migrations
- Rolls back after test completes
- Provides a `PgPool` for use in the test

## HTTP Client Testing

### With tower::ServiceExt (in-process)

```rust
// tests/integration_tests.rs
use axum::{
    body::Body,
    http::{Request, StatusCode},
    Router,
};
use tower::ServiceExt;

#[sqlx::test(migrations = "./migrations")]
async fn test_create_user_endpoint(pool: PgPool) -> Result<(), Box<dyn std::error::Error>> {
    let app = create_app(pool);

    let req = Request::builder()
        .method("POST")
        .uri("/api/users")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"name":"Bob","email":"bob@test.com"}"#))?;

    let response = app.oneshot(req).await?;
    assert_eq!(response.status(), StatusCode::CREATED);

    Ok(())
}
```

### With reqwest (full HTTP)

```rust
// tests/integration_tests.rs
use tokio::net::TcpListener;

#[sqlx::test(migrations = "./migrations")]
async fn test_full_http_flow(pool: PgPool) -> Result<(), Box<dyn std::error::Error>> {
    // Start server on random port
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let addr = listener.local_addr()?;
    let port = addr.port();

    // Spawn app in background
    let pool_clone = pool.clone();
    tokio::spawn(async move {
        let app = create_app(pool_clone);
        axum::serve(listener, app).await.unwrap()
    });

    // Give server time to start
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    // Test via HTTP
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://127.0.0.1:{}/api/users", port))
        .json(&json!({"name": "Charlie", "email": "charlie@test.com"}))
        .send()
        .await?;

    assert_eq!(resp.status(), 201);

    Ok(())
}
```

## Database Transactions in Tests

```rust
// Explicit transaction with rollback
#[sqlx::test(migrations = "./migrations")]
async fn test_with_explicit_rollback(pool: PgPool) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    // Insert in transaction
    sqlx::query("INSERT INTO users (name, email) VALUES ($1, $2)")
        .bind("Alice")
        .bind("alice@test.com")
        .execute(&mut *tx)
        .await?;

    // Query within transaction
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(&mut *tx)
        .await?;
    assert_eq!(count.0, 1);

    // Rollback happens automatically when tx is dropped
    Ok(())
}
```

## Example Integration Test

```rust
// tests/crud_test.rs
use sqlx::PgPool;
use tower::ServiceExt;

#[sqlx::test(migrations = "./migrations")]
async fn test_crud_workflow(pool: PgPool) -> Result<(), Box<dyn std::error::Error>> {
    let app = create_app(pool.clone());

    // Create user via API
    let create_req = Request::builder()
        .method("POST")
        .uri("/api/users")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"name":"Diana","email":"diana@test.com"}"#))?;

    let create_resp = app.oneshot(create_req).await?;
    assert_eq!(create_resp.status(), StatusCode::CREATED);

    // Read response body
    let body = hyper::body::to_bytes(create_resp.into_body()).await?;
    let user: serde_json::Value = serde_json::from_slice(&body)?;
    let user_id = user["id"].as_i64().unwrap();

    // Verify in database
    let (name,): (String,) = sqlx::query_as("SELECT name FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&pool)
        .await?;
    assert_eq!(name, "Diana");

    Ok(())
}
```

## Best Practices

1. **Use #[sqlx::test] macro:** Automatic migration and rollback per test.
2. **Separate integration tests:** Keep in `tests/` directory (separate compilation).
3. **Use tower::ServiceExt:** Test handlers without spinning up HTTP server.
4. **Spawn full server when needed:** Bind to `127.0.0.1:0` for random port.
5. **Transaction isolation:** Each test gets fresh database via rollback.

## Coverage

```bash
# Unit + integration coverage
cargo tarpaulin --out Html --output-dir coverage/

# With specific features
cargo tarpaulin --features "default" --out Html
```

Target: 90%+ coverage.

## Running Tests

```bash
# All tests (unit + integration)
cargo test

# Integration tests only
cargo test --test "*"

# Specific test
cargo test test_create_user

# With output
cargo test -- --nocapture

# Parallel test execution
cargo test -- --test-threads=4
```
