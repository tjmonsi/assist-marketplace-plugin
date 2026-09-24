# Rust Testing: cargo test + assertion libraries

## Test Structure

Rust's built-in `#[test]` attribute + optional assertion libraries (`assert_matches`, `proptest`).

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // [AC-1 | SPEC-003 | FR-045] Happy path: valid input succeeds
    #[test]
    fn test_valid_input_succeeds() {
        let result = process("valid");
        assert_eq!(result.unwrap(), "expected");
    }

    #[test]
    fn test_empty_input_returns_error() {
        let result = process("");
        assert!(result.is_err());
    }

    #[test]
    fn test_null_like_input_panics_or_errors() {
        // Rust's type system prevents null pointers; test Option/Result instead
        let result: Result<String, &str> = Err("not provided");
        assert!(result.is_err());
    }
}
```

## Naming Conventions

- `test_[function_name]_[scenario]` — e.g., `test_payment_process_valid_card_succeeds`
- Rust convention: use snake_case for test names
- Descriptive suffixes: `_succeeds`, `_returns_error`, `_panics`, `_handles_edge_case`

## Assertions

| Pattern | Usage |
|---------|-------|
| `assert_eq!(expected, actual)` | Equality (panics if false) |
| `assert_ne!(left, right)` | Inequality |
| `assert!(condition)` | Boolean assertion |
| `assert!(result.is_ok())` | Result is Ok variant |
| `assert!(result.is_err())` | Result is Err variant |
| `assert!(option.is_some())` | Option is Some variant |
| `assert!(option.is_none())` | Option is None variant |
| `assert_eq!(result.unwrap(), expected)` | Unwrap and compare |
| `assert!(string.contains("substring"))` | String containment |

Use the `?` operator in test code (Rust 1.50+) if your test function returns `Result`:

```rust
#[test]
fn test_with_result() -> Result<(), Box<dyn std::error::Error>> {
    let value = some_fallible_fn()?;
    assert_eq!(value, 42);
    Ok(())
}
```

## Parameterized Tests (Table-Driven)

Use a simple loop or external crate (`parameterized` crate):

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_payment_processor_multiple_cases() {
        let test_cases = vec![
            ("valid: happy path", 50.0, true, None),
            ("invalid: negative amount", -10.0, false, Some("negative")),
            ("boundary: zero amount", 0.0, true, None), // or false, per spec
            ("null-like: no card", 50.0, false, Some("no card")),
        ];

        for (name, amount, should_succeed, expected_error) in test_cases {
            let result = process_payment(amount);
            if should_succeed {
                assert!(result.is_ok(), "case '{}' should succeed", name);
            } else {
                assert!(result.is_err(), "case '{}' should error", name);
                if let Some(err_msg) = expected_error {
                    assert!(result.unwrap_err().contains(err_msg));
                }
            }
        }
    }
}
```

## Attribute-Based Testing (proptest)

For property-based testing across a wider input space:

```toml
# Cargo.toml
[dev-dependencies]
proptest = "1.0"
```

```rust
use proptest::proptest;

#[test]
fn test_process_does_not_panic_on_any_string(s in ".*") {
    let _ = process(&s); // Should not panic
}
```

## Running Tests

```bash
cargo test                    # Run all tests
cargo test -- --nocapture    # Show println! output
cargo test --test '*'        # Run tests in tests/ directory
cargo test payment           # Run tests matching "payment"
cargo test -- --ignored      # Run only #[ignore] tests
cargo test -- --test-threads=1  # Single-threaded (for tests with side effects)
cargo tarpaulin              # Coverage (install via cargo)
```

## Fixtures and Setup

Use functions or test-utility modules:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn setup_user() -> User {
        User {
            id: 1,
            email: "test@example.com".to_string(),
            verified: true,
        }
    }

    #[test]
    fn test_with_fixture() {
        let user = setup_user();
        let result = do_something(&user);
        assert!(result.is_ok());
    }
}
```

For shared setup across tests, use a module or external utility:

```rust
#[cfg(test)]
mod common;

// common/mod.rs
pub fn setup_database() -> Connection {
    // Initialize test DB
}
```

## Mocking External Boundaries

Use trait-based dependency injection:

```rust
trait PaymentGateway {
    fn charge(&self, amount: f64) -> Result<TransactionId, String>;
}

struct MockPaymentGateway {
    charge_fn: Box<dyn Fn(f64) -> Result<TransactionId, String>>,
}

impl PaymentGateway for MockPaymentGateway {
    fn charge(&self, amount: f64) -> Result<TransactionId, String> {
        (self.charge_fn)(amount)
    }
}

#[test]
fn test_with_mock_gateway() {
    let mock = MockPaymentGateway {
        charge_fn: Box::new(|amount| {
            if amount < 0.0 {
                Err("negative amount".to_string())
            } else {
                Ok("txn_123".to_string())
            }
        }),
    };

    let service = PaymentService::new(Box::new(mock));
    let result = service.pay(50.0);
    assert!(result.is_ok());
}
```

## Best Practices

1. **Test file location:** `#[cfg(test)] mod tests { ... }` at the bottom of implementation files, or in `tests/` directory for integration tests
2. **Ownership and lifetimes:** Write tests as if calling from outside the crate (respects visibility, borrows correctly)
3. **Panic vs. Result:** Unit tests use `panic!` (or `assert!`) for assertions; integration tests should use `Result`-returning tests where applicable
4. **No `unwrap()` in production:** Tests can use `unwrap()` on `Result`s to fail fast; production code should not
5. **Test isolation:** Each test owns its resources; don't share state between tests
6. **Ignore slow tests:** Mark with `#[ignore]` and run separately: `cargo test -- --ignored`
