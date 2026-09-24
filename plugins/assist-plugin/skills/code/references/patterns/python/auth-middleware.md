# JWT Auth Middleware — Python (FastAPI)

Bearer JWT verification as a reusable dependency, with role-based guard.
See [../../languages/python.md](../../languages/python.md) and
[../../frameworks/fastapi.md](../../frameworks/fastapi.md) for conventions.

## Pattern

```python
import os
from datetime import datetime, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

security = HTTPBearer(auto_error=False)
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"


class AuthUser(BaseModel):
    sub: str
    roles: list[str] = []


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> AuthUser:
    if credentials is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Missing bearer token"
        )
    try:
        payload = jwt.decode(
            credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    return AuthUser(sub=payload["sub"], roles=payload.get("roles", []))


def require_role(role: str):
    def _check(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if role not in user.roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role")
        return user

    return _check
```

## Usage

```python
from fastapi import APIRouter, Depends

router = APIRouter()


@router.get("/me")
def read_profile(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    return user


@router.delete("/admin/users/{user_id}")
def delete_user(
    user_id: str, _: AuthUser = Depends(require_role("admin"))
) -> None:
    ...
```

## Notes

- Verify signature, expiry (`exp`), and algorithm explicitly; never accept
  `alg: none` or decode without `algorithms=[...]` pinned.
- Load `JWT_SECRET` (or public key for RS256) from environment/secret manager,
  never hardcode it.
- Return `401` for missing/invalid/expired tokens and `403` for valid tokens
  lacking permission — do not conflate the two.
- Dependency injection (`Depends`) keeps auth logic out of route handlers and
  testable in isolation with FastAPI's `TestClient` overrides.
- For session-based auth, replace the bearer check with a signed, `HttpOnly`,
  `Secure`, `SameSite=Lax` cookie lookup against a server-side session store.
