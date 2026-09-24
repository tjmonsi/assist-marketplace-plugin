# Go Integration Testing

Integration testing patterns for Go projects using testcontainers, testify, and Fiber.

## Setup

### Dependencies
```bash
go get github.com/testcontainers/testcontainers-go
go get github.com/testcontainers/testcontainers-go/wait
go get github.com/stretchr/testify/assert
go get github.com/stretchr/testify/require
go get github.com/jackc/pgx/v5
```

## Test Database

### With testcontainers

```go
// tests/setup_test.go
//go:build integration

package tests

import (
	"context"
	"database/sql"
	"os"
	"testing"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
	"github.com/testcontainers/testcontainers-go/resources"
)

var testDB *sql.DB

func TestMain(m *testing.M) {
	ctx := context.Background()

	// Start PostgreSQL container
	req := testcontainers.ContainerRequest{
		Image:        "postgres:16",
		ExposedPorts: []string{"5432/tcp"},
		Env: map[string]string{
			"POSTGRES_PASSWORD": "test",
			"POSTGRES_DB":       "testdb",
		},
		WaitingFor: wait.ForLog("database system is ready to accept connections"),
	}

	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		panic(err)
	}
	defer container.Terminate(ctx)

	// Get connection string
	host, _ := container.Host(ctx)
	port, _ := container.MappedPort(ctx, "5432")
	dsn := fmt.Sprintf("postgres://postgres:test@%s:%s/testdb?sslmode=disable", host, port.Port())

	// Connect to database
	testDB, err = sql.Open("pgx", dsn)
	if err != nil {
		panic(err)
	}
	defer testDB.Close()

	// Run migrations
	runMigrations(testDB)

	// Run tests
	code := m.Run()
	os.Exit(code)
}
```

## HTTP Client Testing

### With Fiber

```go
// tests/api_test.go
//go:build integration

package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateUser(t *testing.T) {
	app := setupApp(testDB)

	body := map[string]string{
		"name":  "Alice",
		"email": "alice@test.com",
	}
	bodyBytes, _ := json.Marshal(body)

	req := httptest.NewRequest("POST", "/api/users", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	require.NoError(t, err)

	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	assert.Equal(t, "Alice", result["name"])
}

func TestGetUser(t *testing.T) {
	app := setupApp(testDB)

	req := httptest.NewRequest("GET", "/api/users/1", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)

	assert.Equal(t, http.StatusOK, resp.StatusCode)
}
```

## Database Transaction Testing

```go
// tests/helpers.go
//go:build integration

package tests

import (
	"context"
	"database/sql"
)

func withTx(t *testing.T, fn func(tx *sql.Tx) error) {
	tx, err := testDB.BeginTx(context.Background(), nil)
	require.NoError(t, err)
	defer tx.Rollback() // Automatic rollback after test

	err = fn(tx)
	require.NoError(t, err)
}

// Usage in tests
func TestWithTransaction(t *testing.T) {
	withTx(t, func(tx *sql.Tx) error {
		row := tx.QueryRowContext(context.Background(),
			"INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id",
			"Bob", "bob@test.com")
		var id int
		err := row.Scan(&id)
		require.NoError(t, err)
		assert.Greater(t, id, 0)
		return nil
	})
}
```

## Example Integration Test

```go
// tests/crud_test.go
//go:build integration

package tests

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCRUDIntegration(t *testing.T) {
	app := setupApp(testDB)

	// Create user
	createReq := httptest.NewRequest("POST", "/api/users",
		bytes.NewReader([]byte(`{"name":"Charlie","email":"charlie@test.com"}`)))
	createReq.Header.Set("Content-Type", "application/json")
	createResp, _ := app.Test(createReq)
	assert.Equal(t, http.StatusCreated, createResp.StatusCode)

	var user map[string]interface{}
	json.NewDecoder(createResp.Body).Decode(&user)
	userID := int(user["id"].(float64))

	// Verify in database
	var name string
	testDB.QueryRow("SELECT name FROM users WHERE id = $1", userID).Scan(&name)
	assert.Equal(t, "Charlie", name)

	// Retrieve via API
	getReq := httptest.NewRequest("GET", fmt.Sprintf("/api/users/%d", userID), nil)
	getResp, _ := app.Test(getReq)
	assert.Equal(t, http.StatusOK, getResp.StatusCode)
}
```

## Best Practices

1. **Build tags:** Use `//go:build integration` to separate integration from unit tests.
2. **TestMain:** Set up containers and database once for all tests in a package.
3. **Transactions:** Wrap test database operations in transactions with rollback.
4. **testify:** Use assert/require helpers for cleaner test assertions.
5. **Port binding:** Bind servers to `localhost:0` for random port assignment.

## Coverage

```bash
go test -tags=integration -coverprofile=coverage.out ./tests/...
go tool cover -func=coverage.out
```

Target: 90%+ coverage.

## Running Tests

```bash
# Integration tests only
go test -tags=integration ./...

# With coverage
go test -tags=integration -cover ./...

# Specific test
go test -tags=integration -run TestCreateUser ./tests/
```
