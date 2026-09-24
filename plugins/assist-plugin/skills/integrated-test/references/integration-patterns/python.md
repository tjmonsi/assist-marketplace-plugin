# Python Integration Testing

Integration testing patterns for Python projects using pytest and async frameworks (FastAPI, etc.).

## Setup

### Dependencies
- pytest — testing framework
- pytest-asyncio — async test support
- httpx — async HTTP client
- 	estcontainers-postgres — PostgreSQL container
- espx — HTTP mocking library
- akeredis — mock Redis

`ash
pip install pytest pytest-asyncio httpx testcontainers[postgres] respx fakeredis
`

## Test Database

### With testcontainers (recommended for CI/CD)

`python
# conftest.py
import pytest
from testcontainers.postgres import PostgresContainer
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

@pytest.fixture(scope="session")
def postgres_container():
    """Spin up a test PostgreSQL instance."""
    with PostgresContainer("postgres:16") as pg:
        yield pg.get_connection_url()

@pytest.fixture
async def engine(postgres_container):
    """Create an async SQLAlchemy engine bound to test database."""
    engine = create_async_engine(postgres_container, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

@pytest.fixture
async def db_session(engine):
    """Provide an async session with automatic rollback after test."""
    async with engine.begin() as conn:
        session = AsyncSession(bind=conn)
        yield session
        await conn.rollback()
`

## HTTP Client Testing

### With FastAPI

`python
# conftest.py
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
from app import app

@pytest.fixture
async def async_client():
    """Async HTTP client for ASGI app."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest.fixture
def sync_client():
    """Sync HTTP client (if app supports it)."""
    return TestClient(app)
`

## Example Tests

### Simple API test

`python
# tests/test_users.py
import pytest

@pytest.mark.asyncio
async def test_create_user(async_client, db_session):
    """Test creating a user via API."""
    response = await async_client.post("/api/users", json={"name": "Alice", "email": "alice@test.com"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Alice"
`

### Mock external API

`python
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
`

### Redis testing

`python
# conftest.py
import fakeredis

@pytest.fixture
def redis_client():
    """Provide a fake Redis client for tests."""
    return fakeredis.FakeStrictRedis()
`

## Best Practices

1. **Use async fixtures:** Always sync def fixtures with wait for async operations.
2. **Transaction rollback:** Return a session inside a transaction that rolls back after the test. This is faster than rebuilding the database.
3. **Separate integration from unit tests:** Use pytest markers to run them separately: pytest -m integration.
4. **Mock external APIs:** Use espx to mock HTTP calls to third-party services.
5. **Test database cleanup:** Ensure each test starts with a clean state. Use db_session fixture with rollback.

## Coverage

`ash
pytest --cov=app --cov-report=term-missing tests/
`

Target: 90%+ coverage. Report uncovered lines for review.
