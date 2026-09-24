# REST CRUD — Python (FastAPI)

Full Create/Read/Update/Delete endpoint set with Pydantic validation and explicit
error handling. See [../../languages/python.md](../../languages/python.md) and
[../../frameworks/fastapi.md](../../frameworks/fastapi.md) for conventions.

## Pattern

```python
import uuid
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/items", tags=["items"])


class ItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    price: float = Field(gt=0)


class ItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    price: float | None = Field(default=None, gt=0)


class Item(ItemCreate):
    id: str


_db: dict[str, Item] = {}


@router.post("", response_model=Item, status_code=status.HTTP_201_CREATED)
def create_item(payload: ItemCreate) -> Item:
    item = Item(id=str(uuid.uuid4()), **payload.model_dump())
    _db[item.id] = item
    return item


@router.get("/{item_id}", response_model=Item)
def get_item(item_id: str) -> Item:
    item = _db.get(item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    return item


@router.get("", response_model=list[Item])
def list_items() -> list[Item]:
    return list(_db.values())


@router.put("/{item_id}", response_model=Item)
def update_item(item_id: str, payload: ItemUpdate) -> Item:
    item = _db.get(item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    updated = item.model_copy(update=payload.model_dump(exclude_unset=True))
    _db[item_id] = updated
    return updated


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: str) -> None:
    if item_id not in _db:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    del _db[item_id]
```

## Notes

- Pydantic models enforce validation at the boundary; invalid payloads return `422`
  automatically before the handler runs.
- `HTTPException` is the single error-reporting mechanism; never return raw
  dicts with error fields — keep the response contract consistent.
- `exclude_unset=True` on update makes PATCH-like partial updates safe without
  clobbering unspecified fields.
- Register a global exception handler (`@app.exception_handler`) for unhandled
  exceptions per [../../error-handling-standards.md](../../error-handling-standards.md).
- Swap the in-memory `_db` for a repository/session dependency in production;
  keep route handlers thin.
