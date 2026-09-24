# Go 1.22+ Reference

## Contents
- Mandatory Toolchain
- Code Style Rules
- Type System Rules
- Prohibited Patterns
- Context Propagation
- Required Configuration Files
- Project Structure

## Mandatory Toolchain

| Tool | Purpose | Prohibited alternatives |
|------|---------|------------------------|
| Go 1.22+ | Runtime | < 1.20 |
| `golangci-lint` | Lint | `go vet` alone |
| `gofmt` / `goimports` | Format | manual formatting |
| `go test` | Testing | external test runners for unit tests |
| `go mod` | Dependency management | `dep`, `glide` |

## Code Style Rules

- Package names: short, lowercase, no underscores (`userservice` not `user_service`)
- Error values: lowercase, no punctuation (`"connection failed"` not `"Connection failed."`)
- All exported symbols have godoc comments
- Import groups: stdlib, external, internal (enforced by `goimports`)
- Use `errors.Is` / `errors.As` for error inspection; never string-match errors
- `context.Context` as first parameter on all I/O functions
- Prefer generics over `interface{}` for collections and utilities (Go 1.18+)

## Type System Rules

- Prefer generics (Go 1.18+) over `interface{}` / `any` for reusable collections and utilities: `func Map[T, U any](in []T, fn func(T) U) []U`
- Use type constraints (`comparable`, custom interfaces) to narrow generic parameters instead of accepting `any`
- Zero values must be valid and safe — a zero-value `struct` should not panic when used
- Prefer small, focused interfaces (1-3 methods) defined at the point of use, not alongside the implementation
- Embed interfaces/structs for composition instead of simulating inheritance
- Use `errors.Is` / `errors.As` for typed error inspection; never string-match errors
- Nil interface vs nil pointer: never return a typed nil pointer as an `error` interface value

## Prohibited Patterns

| Pattern | Fix |
|---------|-----|
| `panic` in library code | Return error instead |
| Shadowed `err` via `:=` | Use separate variable or `=` |
| `time.Sleep` in tests | Use channels or `testing.T.Context()` |
| Unbounded goroutine launch | Use worker pool or `errgroup` |
| `interface{}` / `any` without type assertion | Use generics |

## Context Propagation

Always pass `context.Context` as the first parameter through every I/O call chain. Using `context.Background()` inside a handler or service (instead of the request-scoped context) is a violation.

```go
func (s *UserService) Create(ctx context.Context, payload CreateUserInput) (*User, error) {
    return s.repo.Insert(ctx, payload) // correct — propagates caller's context
}
```

## Required Configuration Files

| File | Purpose | Committed? |
|------|---------|------------|
| `go.mod` | Module name, Go version, dependencies | Yes |
| `go.sum` | Locked dependency checksums | Yes |
| `.golangci.yml` | Linter configuration | Yes |
| `.gitignore` | Exclude built binaries, `vendor/` if not vendoring | Yes |

## Project Structure

```
cmd/
  server/
    main.go              # Entry point: config, DI, start server
internal/
  config/
    config.go            # Env loading, typed config struct
  handler/                # Thin I/O layer: parse, call service, respond
  service/                # Business logic (accepts context.Context)
  repository/             # Database queries
  model/                  # Domain types
  router/
    router.go             # Route registration, group versioning
pkg/
  response/
    response.go           # Shared response helpers
  validator/
    validator.go          # Input validation helpers
tests/
  handler_test.go
  service_test.go
go.mod
go.sum
Dockerfile
```
