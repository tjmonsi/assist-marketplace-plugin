# Pagination — TypeScript (Fastify)

Offset-limit pagination with sort validation, plus a cursor variant for large
tables. See [../../languages/typescript.md](../../languages/typescript.md) and
[../../frameworks/fastify.md](../../frameworks/fastify.md) for conventions.

## Offset-Limit Pattern

```typescript
import { FastifyPluginAsync } from "fastify";
import { Type, Static } from "@sinclair/typebox";

const SORT_FIELDS = ["createdAt", "name"] as const;
const SORT_ORDERS = ["asc", "desc"] as const;

const ListQuery = Type.Object({
  limit: Type.Integer({ minimum: 1, maximum: 100, default: 20 }),
  offset: Type.Integer({ minimum: 0, default: 0 }),
  sortBy: Type.Union(SORT_FIELDS.map((f) => Type.Literal(f)), {
    default: "createdAt",
  }),
  sortOrder: Type.Union(SORT_ORDERS.map((o) => Type.Literal(o)), {
    default: "desc",
  }),
});

type ListQueryT = Static<typeof ListQuery>;

export const listRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: ListQueryT }>(
    "/items",
    { schema: { querystring: ListQuery } },
    async (req) => {
      const { limit, offset, sortBy, sortOrder } = req.query;
      const [items, total] = await Promise.all([
        db.item.findMany({ take: limit, skip: offset, orderBy: { [sortBy]: sortOrder } }),
        db.item.count(),
      ]);
      return { items, total, limit, offset };
    }
  );
};
```

## Cursor Pattern

```typescript
interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: string; id: string } {
  const [createdAt, id] = Buffer.from(cursor, "base64url").toString().split("|");
  return { createdAt, id };
}

app.get<{ Querystring: { cursor?: string; limit?: number } }>(
  "/items/cursor",
  async (req): Promise<CursorPage<Item>> => {
    const limit = Math.min(req.query.limit ?? 20, 100);
    const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : undefined;

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

    return { items, nextCursor };
  }
);
```

## Notes

- Enforce `maximum: 100` on `limit` in the schema; Fastify rejects out-of-range
  values with `400` before the handler executes.
- Validate `sortBy`/`sortOrder` against a fixed literal union — never pass a
  raw client string into an ORM's `orderBy` key.
- Use a compound cursor (`createdAt` + `id`) so rows with identical timestamps
  are still ordered deterministically and never skipped or duplicated.
- Prefer cursor pagination for infinite-scroll UIs and large/high-write
  tables; offset pagination is fine for small, page-numbered admin views.
