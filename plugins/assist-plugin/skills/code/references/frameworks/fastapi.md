# FastAPI Reference

## Contents
- Mandatory Toolchain
- FastAPI Patterns
- CORS Configuration
- Security Headers Middleware
- XSS and Penetration Protection
- ASGI Server Config
- Project Structure

## Mandatory Toolchain

| Tool | Purpose | Prohibited alternatives |
|------|---------|------------------------|
| FastAPI | Web framework | Flask for new async APIs |
| Pydantic v2 | Request/response validation | Pydantic v1, dataclasses for validation |
| Uvicorn | ASGI server (HTTP/1.1) | `python app.py` direct execution |
| Hypercorn | ASGI server (HTTP/2, HTTP/3, QUIC) | — |

Language-level toolchain (Python 3.12, `uv`, `ruff`) is covered by the Python language reference; this file covers FastAPI-specific patterns only.

## FastAPI Patterns

**Async-first:** All I/O-bound handlers use `async def`. Synchronous `def` only for CPU-bound, no-I/O operations.

**Response model + return annotation required on every route:**

```python
@router.post("/items", response_model=ItemResponse, status_code=201)
async def create_item(body: ItemCreate) -> ItemResponse: ...
```

Missing `response_model` or missing return annotation is a violation.

**Dependency injection:** Use `Depends()` for all shared deps (DB sessions, auth, config).

## CORS Configuration

`allow_origins=["*"]` in production is a security violation. Configure explicitly:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,   # explicit list from env
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    allow_origin_regex=None,                  # use for wildcard subdomains only
    max_age=600,                              # preflight cache seconds
)
```

Rules:
- `allow_credentials=True` + `allow_origins=["*"]` is rejected by browsers — always use explicit origins with credentials
- Use `allow_origin_regex` for pattern matching (e.g., `r"https://.*\.example\.com"`)
- Default `allow_methods` is `["GET"]` only — explicitly list what you need

## Security Headers Middleware

Register `SecurityHeadersMiddleware` on every FastAPI app. Missing registration is a security violation.

```python
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response: Response = await call_next(request)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; frame-ancestors 'none'; "
            "base-uri 'none'; object-src 'none'"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)
```

## XSS and Penetration Protection

For production APIs, consider `fastapi-guard` for automated XSS/SQLi/path traversal detection:

```python
from guard import SecurityConfig, SecurityMiddleware

config = SecurityConfig(
    enable_penetration_detection=True,
    auto_ban_threshold=3,          # ban after 3 suspicious requests
    auto_ban_duration=7200,        # ban for 2 hours
)
app.add_middleware(SecurityMiddleware, config=config)
```

Middleware registration order: SecurityHeaders → CORS → Guard → routes.

## ASGI Server Config

| Protocol | Server | Add |
|----------|--------|-----|
| HTTP/1.1 + WebSocket | Uvicorn | `uv add uvicorn[standard]` |
| HTTP/2, HTTP/3, QUIC | Hypercorn | `uv add hypercorn` |

**Uvicorn** (HTTP/1.1 only -- any HTTP/2 requirement must use Hypercorn):
- Dev: `uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- Prod: `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 --loop uvloop --http httptools`

**Hypercorn** (HTTP/2):
- When TLS is terminated at the container/load balancer (Cloud Run, GKE, ALB): run without certfile/keyfile on the container port (e.g., 8080). The proxy handles TLS.
  ```
  uv run hypercorn app.main:app --bind 0.0.0.0:8080 --workers 4
  ```
- When TLS is terminated at the app: `certfile` + `keyfile` are required.
  ```python
  config = Config()
  config.bind = ["0.0.0.0:8443"]
  config.certfile = "cert.pem"
  config.keyfile = "key.pem"
  asyncio.run(serve(app, config))
  ```

## Project Structure

```
src/
  app/
    __init__.py
    main.py              # FastAPI app factory, middleware registration
    config.py            # Settings via pydantic-settings, env loading
    dependencies.py      # Shared Depends() (get_db, get_redis, get_current_user)
    models/
      __init__.py
      user.py            # SQLAlchemy ORM models
    schemas/
      __init__.py
      user.py            # Pydantic v2 request/response models
    routers/
      __init__.py
      users.py           # APIRouter with prefix + tags
      items.py
    services/
      __init__.py
      user_service.py    # Business logic (no HTTP concerns)
    middleware/
      __init__.py
      security_headers.py
      cors.py
      csrf.py
tests/
  conftest.py            # Fixtures (async client, test db)
  test_users.py
  test_items.py
alembic/
  versions/              # Migration files
  env.py
pyproject.toml           # ruff, uv, project config
uv.lock                  # committed — reproducible installs
.python-version          # committed — pins Python version for uv
Dockerfile
```
