# Python Integration Testing

Integration testing patterns for Python projects using pytest and async frameworks (FastAPI, etc.).

## Setup

### Dependencies
- pytest — testing framework
- pytest-asyncio — async test support
- sqlalchemy (asyncio extension) and asyncpg — async database access
- httpx — async HTTP client
- testcontainers[postgres] — PostgreSQL container
- respx — HTTP mocking library
- fakeredis — mock Redis

Detect uv with `command -v uv`. Agents show these commands and never run them; the user runs them. Before an agent runs `uv run --no-sync --no-python-downloads pytest ...`, it Globs for `.venv/bin/pytest` (`.venv/Scripts/pytest.exe` on Windows); if missing, it shows `uv sync` and stops.

```bash
# uv (preferred): add to the project's dev dependency group, then create/update .venv
uv add --dev pytest pytest-asyncio httpx "testcontainers[postgres]" respx fakeredis sqlalchemy asyncpg
uv sync

# pip (when uv is absent), inside the project's virtual environment
python -m pip install pytest pytest-asyncio httpx "testcontainers[postgres]" respx fakeredis sqlalchemy asyncpg
```

## Test Database

### With testcontainers (recommended for CI/CD)

`PostgresContainer(..., driver="asyncpg")` makes `get_connection_url()` return a `postgresql+asyncpg://` URL, which `create_async_engine` needs (the default driver is `psycopg2`). `sqlalchemy` and `asyncpg` are not dependencies of `testcontainers[postgres]`, so the project must declare them.

Async fixtures use `@pytest_asyncio.fixture`. Plain `@pytest.fixture` on an `async def` does not work in pytest-asyncio's default strict mode. (Alternative: set `asyncio_mode = "auto"` under `[tool.pytest.ini_options]` and keep `@pytest.fixture`.)

```python
# conftest.py
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from testcontainers.postgres import PostgresContainer

from app.models import Base  # placeholder: your declarative base

@pytest.fixture(scope="session")
def postgres_url():
    """Spin up a test PostgreSQL instance once per session."""
    with PostgresContainer("postgres:16", driver="asyncpg") as pg:
        yield pg.get_connection_url()

@pytest_asyncio.fixture
async def engine(postgres_url):
    """Create an async SQLAlchemy engine bound to the test database."""
    engine = create_async_engine(postgres_url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

@pytest_asyncio.fixture
async def db_session(engine):
    """Session joined to an outer transaction that is rolled back after the test.

    create_savepoint makes session.commit() release a SAVEPOINT instead of
    committing the outer transaction, so nothing persists between tests.
    """
    async with engine.connect() as conn:
        outer = await conn.begin()
        session = AsyncSession(bind=conn, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            await session.close()
            await outer.rollback()
```

## HTTP Client Testing

### With FastAPI

Override the app's session dependency so requests use the same rolled-back session as the test.

```python
# conftest.py (continued)
from httpx import ASGITransport, AsyncClient

from app import app
from app.deps import get_session  # placeholder: your session dependency

@pytest_asyncio.fixture
async def async_client(db_session):
    """Async HTTP client for the ASGI app, sharing the test's session."""
    async def override_get_session():
        yield db_session

    app.dependency_overrides[get_session] = override_get_session
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
    finally:
        app.dependency_overrides.clear()
```

## Example Tests

### Simple API test

```python
# tests/test_users.py
import pytest

@pytest.mark.asyncio
async def test_create_user(async_client, db_session):
    """Test creating a user via API."""
    response = await async_client.post("/api/users", json={"name": "Alice", "email": "alice@test.com"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Alice"
```

### Mock external API

```python
# tests/test_external_api.py
import pytest
import respx
from httpx import Response

@pytest.mark.asyncio
@respx.mock
async def test_fetch_external_data(async_client):
    """Test API that calls external service."""
    # Mock the external API
    respx.get("https://api.example.com/data").mock(
        return_value=Response(200, json={"status": "ok"})
    )
    
    response = await async_client.get("/api/proxy-data")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
```

### Redis testing

```python
# conftest.py
import fakeredis
import pytest

@pytest.fixture
def redis_client():
    """Provide a fake Redis client for tests."""
    return fakeredis.FakeStrictRedis()
```

## Best Practices

1. **Use async fixtures:** Declare `async def` fixtures with `@pytest_asyncio.fixture` (or set `asyncio_mode = "auto"`) and `await` async operations.
2. **Transaction rollback:** Return a session inside a transaction that rolls back after the test. This is faster than rebuilding the database.
3. **Separate integration from unit tests:** Use pytest markers to run them separately: `uv run --no-sync --no-python-downloads pytest -m integration` (or `pytest -m integration` in an activated virtual environment).
4. **Mock external APIs:** Use respx to mock HTTP calls to third-party services.
5. **Test database cleanup:** Ensure each test starts with a clean state. Use the `db_session` fixture with rollback.

## Coverage

Coverage needs `pytest-cov` (`uv add --dev pytest-cov`, else `python -m pip install pytest-cov`).

```bash
# uv (no install; needs an existing .venv from `uv sync`)
uv run --no-sync --no-python-downloads pytest --cov=app --cov-report=term-missing tests/

# pip / activated virtual environment
pytest --cov=app --cov-report=term-missing tests/
```

Target: 90%+ coverage. Report uncovered lines for review.
