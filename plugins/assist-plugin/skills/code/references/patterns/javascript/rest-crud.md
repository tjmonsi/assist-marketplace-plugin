# REST CRUD — JavaScript (Express)

Full Create/Read/Update/Delete endpoint set with `zod` validation and
centralized error handling. See
[../../languages/javascript.md](../../languages/javascript.md) for conventions.

## Pattern

```javascript
import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";

const router = Router();
const db = new Map();

const ItemCreateSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().positive(),
});
const ItemUpdateSchema = ItemCreateSchema.partial();

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

router.post(
  "/items",
  asyncHandler(async (req, res) => {
    const parsed = ItemCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload", issues: parsed.error.issues });
    }
    const item = { id: randomUUID(), ...parsed.data };
    db.set(item.id, item);
    res.status(201).json(item);
  })
);

router.get(
  "/items/:id",
  asyncHandler(async (req, res) => {
    const item = db.get(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  })
);

router.put(
  "/items/:id",
  asyncHandler(async (req, res) => {
    const existing = db.get(req.params.id);
    if (!existing) return res.status(404).json({ message: "Item not found" });

    const parsed = ItemUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload", issues: parsed.error.issues });
    }
    const updated = { ...existing, ...parsed.data };
    db.set(existing.id, updated);
    res.json(updated);
  })
);

router.delete(
  "/items/:id",
  asyncHandler(async (req, res) => {
    if (!db.delete(req.params.id)) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(204).end();
  })
);

export default router;
```

## Central Error Handler

```javascript
// error-handler.js — register last, after all routes
export function errorHandler(err, req, res, next) {
  logger.error("unhandled request error", { path: req.path, error: err.message, stack: err.stack });
  res.status(err.statusCode ?? 500).json({ message: "Internal server error" });
}
```

## Notes

- `zod`'s `safeParse` never throws; check `.success` explicitly and return
  `400` with issue details instead of letting bad input reach business logic.
- `asyncHandler` wraps every async route so rejected promises reach Express's
  error middleware instead of crashing the process unhandled.
- Register the error handler with four arguments (`(err, req, res, next)`) —
  Express identifies error middleware by arity.
- Never leak stack traces or internal error messages to clients; log full
  detail server-side per [../../logging-standards.md](../../logging-standards.md),
  return a generic message.
- Replace the in-memory `Map` with a repository module so route handlers stay
  free of persistence details.
