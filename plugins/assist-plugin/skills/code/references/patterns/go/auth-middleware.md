# JWT Auth Middleware — Go (Fiber)

Bearer JWT verification via `golang-jwt/jwt`, with a role-based guard. See
[../../languages/go.md](../../languages/go.md) and
[../../frameworks/go-fiber.md](../../frameworks/go-fiber.md) for conventions.

## Pattern

```go
package auth

import (
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret = []byte(os.Getenv("JWT_SECRET"))

type Claims struct {
	Roles []string `json:"roles"`
	jwt.RegisteredClaims
}

func Authenticate(c *fiber.Ctx) error {
	header := c.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return fiber.NewError(fiber.StatusUnauthorized, "missing bearer token")
	}
	tokenStr := strings.TrimPrefix(header, "Bearer ")

	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fiber.NewError(fiber.StatusUnauthorized, "unexpected signing method")
		}
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid or expired token")
	}

	c.Locals("userID", claims.Subject)
	c.Locals("roles", claims.Roles)
	return c.Next()
}

func RequireRole(role string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		roles, _ := c.Locals("roles").([]string)
		for _, r := range roles {
			if r == role {
				return c.Next()
			}
		}
		return fiber.NewError(fiber.StatusForbidden, "insufficient role")
	}
}
```

## Usage

```go
app.Get("/me", auth.Authenticate, func(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"userID": c.Locals("userID")})
})

app.Delete("/admin/users/:id",
	auth.Authenticate,
	auth.RequireRole("admin"),
	deleteUserHandler,
)
```

## Notes

- Explicitly verify the signing method inside the key function
  (`t.Method.(*jwt.SigningMethodHMAC)`) — never trust the token's declared
  algorithm, which prevents `alg: none` / algorithm-confusion attacks.
- `jwt.ParseWithClaims` checks expiry (`exp`) automatically via
  `RegisteredClaims`; treat any parse error as `401` without leaking detail.
- Return `403` (not `401`) once identity is established but role check fails.
- Load `JWT_SECRET` from environment/secret manager; for RS256, parse a
  public key instead of a shared secret.
- Chain `Authenticate` then `RequireRole` as separate middleware so each
  concern (identity vs. authorization) is independently testable.
- For session-based auth, replace the bearer check with a signed, `HttpOnly`,
  `Secure`, `SameSite=Lax` cookie validated against a server-side store.
