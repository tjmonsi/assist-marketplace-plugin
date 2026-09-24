# Fiber Reference

## Contents
- Mandatory Toolchain
- Fiber Route Patterns
- CORS Middleware
- CSRF Protection
- Context Propagation
- Security Headers
- Project Structure

## Mandatory Toolchain

| Tool | Purpose | Prohibited alternatives |
|------|---------|------------------------|
| Fiber v3 | Web framework | net/http raw mux for new HTTP services |
| `gofiber/fiber/v3/middleware/cors` | CORS | manual header-writing middleware |
| `gofiber/fiber/v3/middleware/csrf` | CSRF protection | rolling a custom token check |
| `gofiber/fiber/v3/middleware/helmet` | Security headers | manual header-writing middleware |

Language-level toolchain (Go 1.22+, `golangci-lint`, `gofmt`) is covered by the Go language reference; this file covers Fiber-specific patterns only.

## Fiber Route Patterns

**Handler signature:** Every handler returns `error` and uses typed Fiber context methods.

```go
func (h *UserHandler) GetUser(c *fiber.Ctx) error {
    id, err := c.ParamsInt("id")
    if err != nil {
        return fiber.NewError(fiber.StatusBadRequest, "invalid id")
    }
    u, err := h.svc.GetByID(c.Context(), id)
    if err != nil {
        return fiber.NewError(fiber.StatusNotFound, "user not found")
    }
    return c.JSON(u)
}
```

**Router setup:** Group routes under versioned prefix. Pass `fiber.Config{ErrorHandler: customErrorHandler}` to `fiber.New()`.

**Global error handler:** Use `errors.As(err, &e)` to extract `*fiber.Error` code, return JSON `{"error": ...}`.

## CORS Middleware

`AllowOrigins: "*"` in production is a security violation. Configure explicitly:

```go
import "github.com/gofiber/fiber/v3/middleware/cors"

app.Use(cors.New(cors.Config{
    AllowOrigins:     "https://app.example.com,https://admin.example.com",
    AllowMethods:     "GET,POST,PUT,DELETE",
    AllowHeaders:     "Content-Type,Authorization",
    AllowCredentials: true,
    MaxAge:           86400,
}))
```

Rules:
- `AllowCredentials: true` + wildcard origin is rejected by browsers
- Origins are comma-separated strings, not slices

## CSRF Protection

For SPAs and form-based routes, register CSRF middleware:

```go
import (
    "github.com/gofiber/fiber/v3/middleware/csrf"
    "github.com/gofiber/fiber/v3/extractors"
)

// Production config
app.Use(csrf.New(csrf.Config{
    CookieName:     "__Host-csrf_",
    CookieSecure:   true,
    CookieHTTPOnly: true,           // false for SPAs (JS needs token access)
    CookieSameSite: "Lax",
    Extractor:      extractors.FromHeader("X-Csrf-Token"),
}))
```

## Context Propagation

Always pass `c.Context()` to service layer. Using `context.Background()` in a handler is a violation.

```go
result, err := h.svc.Create(c.Context(), payload)  // correct
result, err := h.svc.Create(context.Background(), payload)  // violation
```

## Security Headers

Register `helmet` on every Fiber app. Missing registration is a security violation.

**Registration order:** helmet → CORS → CSRF → logger → routes.

```go
import "github.com/gofiber/fiber/v3/middleware/helmet"

app.Use(helmet.New(helmet.Config{
    ContentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
    ReferrerPolicy:        "strict-origin-when-cross-origin",
    XFrameOptions:         "DENY",
    XContentTypeOptions:   "nosniff",
    HSTSMaxAge:            31536000,
    HSTSPreloadEnabled:    true,
}))
```

## Project Structure

```
cmd/
  server/
    main.go              # Entry point: config, DI, start server
internal/
  config/
    config.go            # Env loading, typed config struct
  middleware/
    helmet.go            # Security headers
    cors.go              # CORS config
    csrf.go              # CSRF middleware
    auth.go              # JWT/session auth
    logger.go            # Request logging
  handler/
    user_handler.go      # HTTP handlers (thin: parse, call service, respond)
    item_handler.go
  service/
    user_service.go      # Business logic (accepts context.Context)
    item_service.go
  repository/
    user_repo.go         # Database queries (GORM/raw SQL)
    item_repo.go
  model/
    user.go              # Domain types + GORM models
    item.go
  router/
    router.go            # Route registration, group versioning
pkg/
  response/
    response.go          # Shared JSON response helpers
  validator/
    validator.go         # Input validation helpers
tests/
  handler_test.go
  service_test.go
go.mod
go.sum
Dockerfile
```
