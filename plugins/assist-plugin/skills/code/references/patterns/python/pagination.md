# Pagination — Python (FastAPI)

Offset-limit pagination with sort validation, plus a cursor variant for large,
frequently-mutated tables. See [../../languages/python.md](../../languages/python.md)
and [../../frameworks/fastapi.md](../../frameworks/fastapi.md) for conventions.

## Offset-Limit Pattern

```python
from enum import Enum
from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter(prefix="/items", tags=["items"])


class SortField(str, Enum):
    created_at = "created_at"
    name = "name"


class SortOrder(str, Enum):
    asc = "asc"
    desc = "desc"


class Page(BaseModel):
    items: list[dict]
    total: int
    limit: int
    offset: int


@router.get("", response_model=Page)
def list_items(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    sort_by: SortField = SortField.created_at,
    sort_order: SortOrder = SortOrder.desc,
) -> Page:
    query = build_query(sort_by=sort_by.value, sort_order=sort_order.value)
    total = query.count()
    rows = query.offset(offset).limit(limit).all()
    return Page(items=rows, total=total, limit=limit, offset=offset)
```

## Cursor Pattern

```python
import base64
from pydantic import BaseModel


class CursorPage(BaseModel):
    items: list[dict]
    next_cursor: str | None


def encode_cursor(created_at: str, id_: str) -> str:
    raw = f"{created_at}|{id_}".encode()
    return base64.urlsafe_b64encode(raw).decode()


def decode_cursor(cursor: str) -> tuple[str, str]:
    raw = base64.urlsafe_b64decode(cursor.encode()).decode()
    created_at, id_ = raw.split("|", 1)
    return created_at, id_


@router.get("/cursor", response_model=CursorPage)
def list_items_cursor(cursor: str | None = None, limit: int = 20) -> CursorPage:
    query = build_query(sort_by="created_at", sort_order="asc")
    if cursor:
        created_at, id_ = decode_cursor(cursor)
        query = query.where(
            (Item.created_at, Item.id) > (created_at, id_)
        )
    rows = query.limit(limit + 1).all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = (
        encode_cursor(rows[-1].created_at, rows[-1].id) if has_more else None
    )
    return CursorPage(items=rows, next_cursor=next_cursor)
```

## Notes

- Cap `limit` with `le=100` to prevent unbounded scans; reject with `422`
  automatically via `Query` constraints.
- `sort_by`/`sort_order` as enums prevent SQL injection through free-text sort
  parameters — never interpolate raw query strings into `ORDER BY`.
- Offset pagination is simplest but degrades on deep pages (`OFFSET 1000000`);
  prefer cursor pagination for large or high-write tables.
- Cursor must encode a unique, monotonic tiebreaker (`id`) alongside the sort
  column to avoid skipping/duplicating rows with equal timestamps.
- Return `total` only when the count query is cheap; omit it for cursor
  pagination on very large tables.
