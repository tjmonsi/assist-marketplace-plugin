# REST CRUD — Go (Fiber)

Full Create/Read/Update/Delete endpoint set with `validator` and explicit
error handling. See [../../languages/go.md](../../languages/go.md) and
[../../frameworks/go-fiber.md](../../frameworks/go-fiber.md) for conventions.

## Pattern

```go
package items

import (
	"sync"

	"github.com/gofiber/fiber/v2"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
)

type Item struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
}

type CreateItemRequest struct {
	Name  string  `json:"name" validate:"required,min=1,max=100"`
	Price float64 `json:"price" validate:"required,gt=0"`
}

type UpdateItemRequest struct {
	Name  *string  `json:"name" validate:"omitempty,min=1,max=100"`
	Price *float64 `json:"price" validate:"omitempty,gt=0"`
}

var validate = validator.New()

type Store struct {
	mu    sync.RWMutex
	items map[string]Item
}

func NewStore() *Store {
	return &Store{items: make(map[string]Item)}
}

func RegisterRoutes(app fiber.Router, store *Store) {
	app.Post("/items", createItem(store))
	app.Get("/items/:id", getItem(store))
	app.Put("/items/:id", updateItem(store))
	app.Delete("/items/:id", deleteItem(store))
}

func createItem(store *Store) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req CreateItemRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
		}
		if err := validate.Struct(req); err != nil {
			return fiber.NewError(fiber.StatusUnprocessableEntity, err.Error())
		}

		item := Item{ID: uuid.NewString(), Name: req.Name, Price: req.Price}
		store.mu.Lock()
		store.items[item.ID] = item
		store.mu.Unlock()

		return c.Status(fiber.StatusCreated).JSON(item)
	}
}

func getItem(store *Store) fiber.Handler {
	return func(c *fiber.Ctx) error {
		store.mu.RLock()
		item, ok := store.items[c.Params("id")]
		store.mu.RUnlock()
		if !ok {
			return fiber.NewError(fiber.StatusNotFound, "item not found")
		}
		return c.JSON(item)
	}
}

func updateItem(store *Store) fiber.Handler {
	return func(c *fiber.Ctx) error {
		id := c.Params("id")
		store.mu.Lock()
		defer store.mu.Unlock()

		item, ok := store.items[id]
		if !ok {
			return fiber.NewError(fiber.StatusNotFound, "item not found")
		}

		var req UpdateItemRequest
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
		}
		if err := validate.Struct(req); err != nil {
			return fiber.NewError(fiber.StatusUnprocessableEntity, err.Error())
		}
		if req.Name != nil {
			item.Name = *req.Name
		}
		if req.Price != nil {
			item.Price = *req.Price
		}
		store.items[id] = item
		return c.JSON(item)
	}
}

func deleteItem(store *Store) fiber.Handler {
	return func(c *fiber.Ctx) error {
		id := c.Params("id")
		store.mu.Lock()
		defer store.mu.Unlock()
		if _, ok := store.items[id]; !ok {
			return fiber.NewError(fiber.StatusNotFound, "item not found")
		}
		delete(store.items, id)
		return c.SendStatus(fiber.StatusNoContent)
	}
}
```

## Notes

- Return `fiber.NewError` for all failure paths; register a single
  `app.Use(errorHandlerMiddleware)`/`fiber.Config{ErrorHandler: ...}` to map
  errors to a consistent JSON body per
  [../../error-handling-standards.md](../../error-handling-standards.md).
- `validator` struct tags enforce constraints declaratively; check
  `validate.Struct` immediately after `BodyParser` and before touching state.
- Guard shared in-memory state with `sync.RWMutex`; use `RLock` for reads and
  `Lock` for writes to avoid data races under concurrent requests.
- Pointer fields (`*string`, `*float64`) on the update request distinguish
  "field omitted" from "field explicitly set to zero value".
- Replace `Store` with a database-backed repository behind the same interface
  for production use; keep handlers free of SQL/driver details.
