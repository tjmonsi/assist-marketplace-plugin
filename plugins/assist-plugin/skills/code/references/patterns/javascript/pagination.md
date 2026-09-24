# Pagination — JavaScript (Express)

Offset-limit pagination with sort validation, plus a cursor variant for large
tables. See [../../languages/javascript.md](../../languages/javascript.md)
for conventions.

## Offset-Limit Pattern

```javascript
import { Router } from "express";
import { z } from "zod";

const router = Router();

const SORT_FIELDS = ["createdAt", "name"];
const SORT_ORDERS = ["asc", "desc"];

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(SORT_FIELDS).default("createdAt"),
  sortOrder: z.enum(SORT_ORDERS).default("desc"),
});

router.get("/items", async (req, res) => {
  const parsed = ListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query", issues: parsed.error.issues });
  }
  const { limit, offset, sortBy, sortOrder } = parsed.data;

  const [items, total] = await Promise.all([
    db.item.findMany({ take: limit, skip: offset, orderBy: { [sortBy]: sortOrder } }),
    db.item.count(),
  ]);

  res.json({ items, total, limit, offset });
});
```

## Cursor Pattern

```javascript
function encodeCursor(createdAt, id) {
  return Buffer.from(`${createdAt}|${id}`).toString("base64url");
}

function decodeCursor(cursor) {
  const [createdAt, id] = Buffer.from(cursor, "base64url").toString().split("|");
  return { createdAt, id };
}

router.get("/items/cursor", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;

  const rows = await db.item.findMany({
    take: limit + 1,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: cursor
      ? { OR: [{ createdAt: { gt: cursor.createdAt } },
               { createdAt: cursor.createdAt, id: { gt: cursor.id } }] }
      : undefined,
  });

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
    : null;

  res.json({ items, nextCursor });
});
```

## Notes

- `z.coerce.number()` converts query-string values to numbers before bounds
  checks; reject with `400` when limit/offset fall outside allowed range.
- Validate `sortBy`/`sortOrder` against a fixed `z.enum` — never interpolate a
  raw client string into an ORM's `orderBy` key (SQL/NoSQL injection risk).
- Use a compound cursor (`createdAt` + `id`) so equal-timestamp rows sort
  deterministically without skips or duplicates.
- Prefer cursor pagination for infinite-scroll and high-write tables; offset
  pagination suits small, page-numbered views where jumping to a page number
  matters.
