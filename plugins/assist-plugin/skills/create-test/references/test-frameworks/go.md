# Go Testing: testing + testify

## Test Structure

Go's standard `testing` package + Testify assertions for readable test output.

```go
package mypackage_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"myapp/mypackage"
)

// [AC-1 | SPEC-003 | FR-045] Happy path: valid input succeeds
func TestValidInput_Succeeds(t *testing.T) {
	result, err := mypackage.Process("valid")
	require.NoError(t, err)
	assert.Equal(t, "expected", result)
}

// Boundary: empty string
func TestEmptyInput_ReturnsError(t *testing.T) {
	_, err := mypackage.Process("")
	assert.Error(t, err)
	assert.Equal(t, mypackage.ErrEmptyInput, err)
}

// Invalid: null-like (nil interface)
func TestNilInput_PanicsOrReturnsError(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			// Acceptable: panic on nil
			assert.NotNil(t, r)
		}
	}()
	_, _ = mypackage.Process(nil)
}
```

## Naming Conventions

- `Test[FunctionName]_[Scenario]` — e.g., `TestPaymentProcess_ValidCard_Succeeds`
- Use descriptive suffixes: `_Succeeds`, `_ReturnsError`, `_PanicsWithMessage`, `_BlockedByValidation`

## Assertions

| Pattern | Usage |
|---------|-------|
| `assert.Equal(t, expected, actual)` | Value equality (non-fatal) |
| `require.Equal(t, expected, actual)` | Value equality (fatal, stops test) |
| `assert.Error(t, err)` | Expect non-nil error |
| `require.NoError(t, err)` | Require no error (fatal) |
| `assert.Nil(t, value)` | Expect nil |
| `assert.NotNil(t, value)` | Expect non-nil |
| `assert.True(t, condition)` | Boolean assertion |
| `assert.Contains(t, haystack, needle)` | String/slice containment |
| `assert.Regexp(t, pattern, string)` | Regex match |

## Subtests (Table-Driven)

For enumeration across multiple input categories:

```go
func TestPaymentProcessor(t *testing.T) {
	tests := []struct {
		name    string
		amount  float64
		card    *Card
		wantErr bool
		errType error
	}{
		{
			name:    "valid: happy path",
			amount:  50.00,
			card:    &Card{Type: "visa", Last4: "1234"},
			wantErr: false,
		},
		{
			name:    "invalid: negative amount",
			amount:  -10.00,
			card:    &Card{Type: "visa", Last4: "1234"},
			wantErr: true,
			errType: mypackage.ErrInvalidAmount,
		},
		{
			name:    "boundary: zero amount",
			amount:  0.00,
			card:    &Card{Type: "visa", Last4: "1234"},
			wantErr: false, // or true, depending on business rule
		},
		{
			name:    "null: nil card",
			amount:  50.00,
			card:    nil,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := mypackage.ProcessPayment(tt.amount, tt.card)
			if tt.wantErr {
				require.Error(t, err)
				if tt.errType != nil {
					assert.Equal(t, tt.errType, err)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}
```

## Running Tests

```bash
go test ./...                    # All tests in all packages
go test -v ./mypackage          # Verbose output
go test -run TestSpecific       # Run specific test
go test -cover ./...            # Show coverage
go test -coverprofile=cov.out ./...
go tool cover -html=cov.out     # HTML coverage report
```

## Fixtures and Setup

Use `TestMain` for package-level setup, or setup within individual tests:

```go
func TestMain(m *testing.M) {
	// Global setup
	dbConn := setupTestDB()
	defer dbConn.Close()

	// Run tests
	code := m.Run()
	os.Exit(code)
}

func TestWithFixture(t *testing.T) {
	// Per-test setup
	user := &User{ID: 1, Email: "test@example.com"}
	defer cleanupUser(user.ID) // Cleanup

	result := mypackage.DoSomething(user)
	assert.NotNil(t, result)
}
```

## Mocking External Boundaries

Use interfaces; inject test doubles:

```go
type PaymentProcessor interface {
	Charge(amount float64) error
}

type MockPaymentProcessor struct {
	chargeFunc func(amount float64) error
}

func (m *MockPaymentProcessor) Charge(amount float64) error {
	return m.chargeFunc(amount)
}

func TestWithMockProcessor(t *testing.T) {
	mockProc := &MockPaymentProcessor{
		chargeFunc: func(amount float64) error {
			if amount < 0 {
				return errors.New("negative amount")
			}
			return nil
		},
	}

	result := mypackage.PaymentService{Processor: mockProc}.Pay(50.00)
	assert.NoError(t, result)
}
```

## Best Practices

1. **Test file location:** `*_test.go` alongside the implementation (same package for unit tests, `package_test` for black-box)
2. **Parallelization:** Use `t.Parallel()` at test start to run tests concurrently
3. **Cleanup:** Defer cleanup operations in tests that set up resources
4. **Avoid implementation details:** Test via the public interface; don't test private functions unless necessary
5. **Error messages:** Use `assert.Errorf(t, ...)` to provide context
