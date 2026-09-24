# Pagination — Go (Fiber)

Offset-limit pagination with sort validation, plus a cursor variant for large
tables. See [../../languages/go.md](../../languages/go.md) and
[../../frameworks/go-fiber.md](../../frameworks/go-fiber.md) for conventions.

## Offset-Limit Pattern

```go
package items

import (
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
)

var allowedSortFields = map[string]bool{"created_at": true, "name": true}
var allowedSortOrders = map[string]bool{"asc": true, "desc": true}

type Page struct {
	Items  []Item `json:"items"`
	Total  int64  `json:"total"`
	Limit  int    `json:"limit"`
	Offset int    `json:"offset"`
}

func listItems(db *Repository) fiber.Handler {
	return func(c *fiber.Ctx) error {
		limit := c.QueryInt("limit", 20)
		if limit < 1 || limit > 100 {
			return fiber.NewError(fiber.StatusBadRequest, "limit must be between 1 and 100")
		}
		offset := c.QueryInt("offset", 0)
		if offset < 0 {
			return fiber.NewError(fiber.StatusBadRequest, "offset must be >= 0")
		}

		sortBy := c.Query("sort_by", "created_at")
		sortOrder := c.Query("sort_order", "desc")
		if !allowedSortFields[sortBy] || !allowedSortOrders[sortOrder] {
			return fiber.NewError(fiber.StatusBadRequest, "invalid sort parameter")
		}

		rows, total, err := db.List(c.Context(), limit, offset, sortBy, sortOrder)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "failed to list items")
		}
		return c.JSON(Page{Items: rows, Total: total, Limit: limit, Offset: offset})
	}
}
```

## Cursor Pattern

```go
type CursorPage struct {
	Items      []Item  `json:"items"`
	NextCursor *string `json:"next_cursor"`
}

func encodeCursor(createdAt, id string) string {
	raw := fmt.Sprintf("%s|%s", createdAt, id)
	return base64.URLEncoding.EncodeToString([]byte(raw))
}

func decodeCursor(cursor string) (createdAt, id string, err error) {
	raw, err := base64.URLEncoding.DecodeString(cursor)
	if err != nil {
		return "", "", err
	}
	parts := strings.SplitN(string(raw), "|", 2)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("malformed cursor")
	}
	return parts[0], parts[1], nil
}

func listItemsCursor(db *Repository) fiber.Handler {
	return func(c *fiber.Ctx) error {
		limit := c.QueryInt("limit", 20)
		if limit < 1 || limit > 100 {
			limit = 20
		}

		var createdAt, id string
		if cursor := c.Query("cursor"); cursor != "" {
			var err error
			createdAt, id, err = decodeCursor(cursor)
			if err != nil {
				return fiber.NewError(fiber.StatusBadRequest, "invalid cursor")
			}
		}

		rows, hasMore, err := db.ListAfter(c.Context(), createdAt, id, limit)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "failed to list items")
		}

		var next *string
		if hasMore {
			last := rows[len(rows)-1]
			cursor := encodeCursor(last.CreatedAt, last.ID)
			next = &cursor
		}
		return c.JSON(CursorPage{Items: rows, NextCursor: next})
	}
}
```

## Notes

- Whitelist `sort_by`/`sort_order` against a fixed map before building the
  query — never concatenate raw query params into SQL `ORDER BY`.
- Clamp/reject `limit` to a hard ceiling (`100`) to prevent unbounded table
  scans from a malicious or buggy client.
- The cursor must encode a compound key (`created_at` + `id`) so rows with
  equal timestamps remain deterministically ordered without skips/dupes.
- `db.ListAfter` should fetch `limit + 1` rows internally and trim the extra
  row to compute `hasMore` without a separate count query.
- Prefer cursor pagination for high-write or very large tables; offset
  pagination is acceptable for small, page-numbered admin views.
