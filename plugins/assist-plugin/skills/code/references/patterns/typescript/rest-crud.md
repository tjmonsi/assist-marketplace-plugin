# REST CRUD — TypeScript (Fastify)

Full Create/Read/Update/Delete endpoint set with schema validation via
`@fastify/type-provider-typebox`. See
[../../languages/typescript.md](../../languages/typescript.md) and
[../../frameworks/fastify.md](../../frameworks/fastify.md) for conventions.

## Pattern

```typescript
import { FastifyPluginAsync } from "fastify";
import { Type, Static } from "@sinclair/typebox";
import { randomUUID } from "node:crypto";

const ItemCreate = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  price: Type.Number({ exclusiveMinimum: 0 }),
});
const ItemUpdate = Type.Partial(ItemCreate);
const Item = Type.Intersect([ItemCreate, Type.Object({ id: Type.String() })]);

type ItemCreateT = Static<typeof ItemCreate>;
type ItemUpdateT = Static<typeof ItemUpdate>;
type ItemT = Static<typeof Item>;

const db = new Map<string, ItemT>();

export const itemRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: ItemCreateT }>(
    "/items",
    { schema: { body: ItemCreate, response: { 201: Item } } },
    async (req, reply) => {
      const item: ItemT = { id: randomUUID(), ...req.body };
      db.set(item.id, item);
      return reply.code(201).send(item);
    }
  );

  app.get<{ Params: { id: string } }>(
    "/items/:id",
    { schema: { response: { 200: Item } } },
    async (req, reply) => {
      const item = db.get(req.params.id);
      if (!item) {
        return reply.code(404).send({ message: "Item not found" });
      }
      return item;
    }
  );

  app.put<{ Params: { id: string }; Body: ItemUpdateT }>(
    "/items/:id",
    { schema: { body: ItemUpdate, response: { 200: Item } } },
    async (req, reply) => {
      const existing = db.get(req.params.id);
      if (!existing) {
        return reply.code(404).send({ message: "Item not found" });
      }
      const updated = { ...existing, ...req.body };
      db.set(existing.id, updated);
      return updated;
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/items/:id",
    async (req, reply) => {
      if (!db.delete(req.params.id)) {
        return reply.code(404).send({ message: "Item not found" });
      }
      return reply.code(204).send();
    }
  );
};
```

## Notes

- TypeBox schemas validate requests and serialize responses in one place;
  Fastify rejects malformed input with `400` before the handler runs.
- Register a global `setErrorHandler` to map thrown errors to consistent JSON
  error bodies per [../../error-handling-standards.md](../../error-handling-standards.md).
- Prefer plugin encapsulation (`FastifyPluginAsync`) over a monolithic route
  file so each resource owns its schemas and dependencies.
- Replace the in-memory `Map` with a repository injected via
  `fastify.decorate` so handlers stay free of persistence details.
- Use `reply.code(...).send(...)` explicitly for non-200 responses; Fastify
  infers `200` by default.
