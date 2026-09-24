# Rust Reference

## Contents
- Mandatory Toolchain Gate
- Pre-Generation Checklist
- Required Cargo.toml Entries
- Code Style Rules
- Error Handling
- Prohibited Patterns
- Async Rules (tokio)
- Axum HTTP Server (if applicable)
- Project Structure

## Mandatory Toolchain Gate

All four must pass before code is accepted:

```
cargo fmt --check
cargo check
cargo clippy -- -D warnings
cargo test
```

Additionally run `cargo audit` for dependency vulnerability scanning.

## Pre-Generation Checklist

1. `Cargo.toml` declares `edition = "2021"` (or `"2024"` if opted in)
2. MSRV set via `rust-version` (default: current stable, minimum 1.75)
3. Identify required Cargo feature flags for the task
4. If async I/O: confirm `tokio` as runtime
5. Confirm library vs binary for error strategy

## Required Cargo.toml Entries

```toml
[package]
edition = "2021"
rust-version = "1.75"

[dependencies]
tokio = { version = "1", features = ["full"] }     # if async
thiserror = "1"                                     # if library
anyhow = "1"                                        # if binary
serde = { version = "1", features = ["derive"] }    # if serialization
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

[profile.release]
lto = true
codegen-units = 1
```

## Code Style Rules

- All public items have doc comments (`///`)
- Use `?` operator for error propagation; avoid nested `match` on `Result`
- Lifetimes: explicit only when the compiler cannot infer
- Avoid `unsafe` unless performance-critical and well-documented
- `Cargo.lock` committed for binaries, not libraries

## Error Handling

| Context | Crate | Pattern |
|---------|-------|---------|
| Library code | `thiserror` | Define typed error enums with `#[derive(Error)]` |
| Binary / application | `anyhow` | Use `anyhow::Result<T>` and `.context("msg")` |

Never use `.unwrap()` or `.expect()` in library code -- return `Result`/`Option`.

## Prohibited Patterns

| Pattern | Fix |
|---------|-----|
| `.unwrap()` in library code | Return `Result`/`Option` |
| `.expect("msg")` in library code | Return `Result`/`Option` |
| `unsafe` without `// SAFETY:` comment | Add `// SAFETY:` justification |
| `clone()` in hot path | Pass references or use `Arc` |
| `std::process::exit()` without flush | Use proper `main` `Result` return |
| `CorsLayer::permissive()` in production | Use explicit origins |

## Async Rules (tokio)

- Use `tokio` as the async runtime
- All async I/O functions return `Result<T, E>` (not bare futures)
- Annotate async functions with `#[instrument]` (from `tracing`) for observability

## Axum HTTP Server (if applicable)

Use `axum` for HTTP APIs. Route with `Router::new().route("/path", get(handler))`.
Apply `tower_http::cors::CorsLayer` with explicit origins in production -- `CorsLayer::permissive()` is a security violation.

## Project Structure

```
src/
  main.rs                # Entry point: config, router, server start
  config.rs              # Env loading (envy/dotenvy), typed config
  router.rs              # Axum router assembly, middleware layers
  error.rs               # AppError type (thiserror), IntoResponse impl
  middleware/
    mod.rs
    auth.rs              # JWT/session extraction
    cors.rs              # tower-http CorsLayer config
  handlers/
    mod.rs
    user_handler.rs      # Axum handlers (thin: extract, call service, respond)
    item_handler.rs
  services/
    mod.rs
    user_service.rs      # Business logic
    item_service.rs
  repositories/
    mod.rs
    user_repo.rs         # Database queries (sqlx/diesel)
    item_repo.rs
  models/
    mod.rs
    user.rs              # Domain types, serde Serialize/Deserialize
    item.rs
  db.rs                  # Connection pool setup (sqlx::PgPool)
tests/
  integration/
    user_test.rs
    item_test.rs
  common/
    mod.rs               # Test fixtures, test db setup
Cargo.toml
Dockerfile
```
