# Python Testing: pytest

## Test Structure

`pytest` is the de-facto standard; use it with fixtures for reusable setup.

```python
import pytest
from myapp.mymodule import process, InvalidInputError

# [AC-1 | SPEC-003 | FR-045] Happy path: valid input succeeds
def test_valid_input_succeeds():
    result = process("valid")
    assert result == "expected"

# Boundary: empty string
def test_empty_input_returns_error():
    with pytest.raises(InvalidInputError):
        process("")

# Invalid: None
def test_none_input_raises_type_error():
    with pytest.raises(TypeError):
        process(None)
```

## Naming Conventions

- `test_[function_name]_[scenario]` — e.g., `test_payment_process_valid_card_succeeds`
- Use descriptive suffixes: `_succeeds`, `_raises_error`, `_returns_none`, `_blocked_by_validation`
- Filename: `test_*.py` or `*_test.py`

## Assertions

| Pattern | Usage |
|---------|-------|
| `assert actual == expected` | Equality |
| `assert actual != expected` | Inequality |
| `assert condition` | Boolean |
| `assert obj is not None` | Non-null |
| `assert value in collection` | Membership |
| `with pytest.raises(ExceptionType)` | Expect exception |
| `with pytest.raises(ExceptionType, match=r"regex")` | Exception with message |

## Parameterized Tests (Table-Driven)

Use `@pytest.mark.parametrize`:

```python
@pytest.mark.parametrize("input_val,expected", [
    ("valid", "expected"),
    ("", None),
    (None, None),
])
def test_process_multiple_cases(input_val, expected):
    if expected is None:
        with pytest.raises((InvalidInputError, TypeError)):
            process(input_val)
    else:
        result = process(input_val)
        assert result == expected

# Or with dict for readability:
@pytest.mark.parametrize("name,amount,should_succeed,error_type", [
    ("valid: happy path", 50.0, True, None),
    ("invalid: negative", -10.0, False, ValueError),
    ("boundary: zero", 0.0, True, None),  # or False, per spec
    ("null-like: none", None, False, TypeError),
])
def test_payment_processor(name, amount, should_succeed, error_type):
    if should_succeed:
        result = process_payment(amount)
        assert result is not None
    else:
        with pytest.raises(error_type):
            process_payment(amount)
```

## Fixtures (Reusable Setup)

```python
@pytest.fixture
def user_fixture():
    """Fixture providing a test user."""
    return {"id": 1, "email": "test@example.com", "verified": True}

@pytest.fixture
def database():
    """Fixture with setup and teardown."""
    db = create_test_db()
    yield db  # Test runs here
    db.cleanup()  # Teardown

def test_with_fixtures(user_fixture, database):
    result = database.get_user(user_fixture["id"])
    assert result["email"] == user_fixture["email"]
```

Session, module, and function scopes:

```python
@pytest.fixture(scope="session")
def expensive_setup():
    """Run once per test session."""
    return initialize_service()

@pytest.fixture(scope="module")
def module_db():
    """Run once per test module."""
    return create_test_db()

@pytest.fixture(scope="function")
def function_db():
    """Run per test function (default)."""
    db = create_test_db()
    yield db
    db.close()
```

## Running Tests

```bash
pytest                        # Run all tests
pytest -v                     # Verbose
pytest test_file.py           # Specific file
pytest -k "payment"           # Run tests matching "payment"
pytest --co                   # List tests without running
pytest --cov=myapp            # Coverage report
pytest -x                     # Stop on first failure
pytest --tb=short             # Short traceback format
pytest -m slow --run-slow     # Run only marked slow tests
```

## Markers for Categorization

Mark and filter tests:

```python
@pytest.mark.slow
def test_long_running_operation():
    ...

@pytest.mark.integration
def test_with_external_api():
    ...

# Run with: pytest -m integration
# Skip with: pytest -m "not slow"
```

## Mocking External Boundaries

Use `unittest.mock` or `pytest-mock`:

```python
from unittest.mock import Mock, patch

def test_with_mock_payment_gateway():
    mock_gateway = Mock()
    mock_gateway.charge.return_value = "txn_123"
    
    result = pay(50.0, payment_gateway=mock_gateway)
    assert result == "txn_123"
    mock_gateway.charge.assert_called_with(50.0)

# Or using pytest-mock:
def test_with_pytest_mock(mocker):
    mock_gateway = mocker.Mock()
    mock_gateway.charge.return_value = "txn_123"
    
    result = pay(50.0, payment_gateway=mock_gateway)
    assert result == "txn_123"

# Or using patch:
@patch('myapp.payment.PaymentGateway')
def test_with_patch(mock_gateway_class):
    mock_instance = mock_gateway_class.return_value
    mock_instance.charge.return_value = "txn_123"
    
    from myapp.payment import process_payment
    result = process_payment(50.0)
    assert result == "txn_123"
```

## Context Managers for Setup/Teardown

```python
def test_with_context_manager():
    with create_test_database() as db:
        user = db.create_user(email="test@example.com")
        assert user.id is not None
        # db.cleanup() called on exit
```

## Best Practices

1. **Test file location:** `tests/test_*.py` in the project root, or `test_*.py` adjacent to implementation
2. **No hardcoded paths:** Use fixtures to provide paths or config
3. **Isolation:** Each test should be independent; use fixtures for shared setup
4. **Names matter:** `test_process_empty_string_raises_value_error` is better than `test_1`
5. **Parametrize for enumeration:** Use `@pytest.mark.parametrize` to test multiple input cases concisely
6. **Avoid test interdependence:** Tests should run in any order
7. **Explicit assertions:** Use clear messages: `assert result == 42, f"Expected 42, got {result}"`
