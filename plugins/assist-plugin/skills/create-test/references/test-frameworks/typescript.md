# TypeScript Testing: Vitest / Jest

## Test Structure

`vitest` (recommended for modern TS projects; faster than Jest) or `jest` (more widely compatible).

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { process, InvalidInputError } from './mymodule'

// [AC-1 | SPEC-003 | FR-045] Happy path: valid input succeeds
it('should process valid input', () => {
  const result = process('valid')
  expect(result).toBe('expected')
})

// Boundary: empty string
it('should reject empty input', () => {
  expect(() => process('')).toThrow(InvalidInputError)
})

// Invalid: null
it('should handle null input', () => {
  expect(() => process(null)).toThrow()
})
```

## Naming Conventions

- `describe('FunctionName', () => { it('should ...') })`
- Test description starts with "should": `should validate input before processing`
- No redundant naming: `should validate input` (good), `should validate input validation` (bad)

## Assertions (Vitest/Jest)

| Pattern | Usage |
|---------|-------|
| `expect(value).toBe(expected)` | Identity/equality (primitives) |
| `expect(value).toEqual(expected)` | Deep equality (objects) |
| `expect(value).toStrictEqual(expected)` | Strict equality (no coercion) |
| `expect(array).toContain(item)` | Array membership |
| `expect(string).toMatch(regex)` | Regex match |
| `expect(fn).toThrow()` | Expect exception |
| `expect(fn).toThrow(TypeError)` | Expect specific error type |
| `expect(fn).toThrow(/regex/)` | Exception with message match |
| `expect(value).toBeTruthy()` | Truthy check |
| `expect(value).toBeNull()` | Null check |
| `expect(value).toBeUndefined()` | Undefined check |
| `expect(spy).toHaveBeenCalled()` | Spy assertion |
| `expect(spy).toHaveBeenCalledWith(args)` | Spy call args |

## Parameterized Tests (Table-Driven)

Use `it.each()` or `describe.each()`:

```typescript
describe('payment processor', () => {
  it.each([
    ['valid: happy path', 50.0, true, null],
    ['invalid: negative', -10.0, false, 'negative'],
    ['boundary: zero', 0.0, true, null],
    ['null-like: none', null, false, 'type'],
  ])('%s', (name, amount, shouldSucceed, expectedError) => {
    if (shouldSucceed) {
      const result = processPayment(amount)
      expect(result).toBeDefined()
    } else {
      expect(() => processPayment(amount)).toThrow(
        new RegExp(expectedError || '')
      )
    }
  })
})
```

## Setup and Teardown

```typescript
describe('user management', () => {
  let user: User

  beforeEach(() => {
    user = { id: 1, email: 'test@example.com', verified: true }
  })

  afterEach(() => {
    // Cleanup
  })

  it('should fetch user', () => {
    expect(user.email).toBe('test@example.com')
  })
})
```

## Mocking

```typescript
import { vi } from 'vitest'
import { PaymentGateway } from './types'

const mockGateway: PaymentGateway = {
  charge: vi.fn().mockResolvedValue('txn_123'),
}

it('should charge card with mock gateway', () => {
  const result = processPayment(50.0, mockGateway)
  expect(mockGateway.charge).toHaveBeenCalledWith(50.0)
})

// Spy on existing function
const spy = vi.spyOn(someObject, 'method')
spy.mockReturnValue('mocked')
```

## Async Testing

```typescript
it('should fetch user data', async () => {
  const user = await fetchUser(1)
  expect(user.email).toBe('test@example.com')
})

// Or with explicit Promise handling
it('should reject on network error', () => {
  return expect(fetchUser(1)).rejects.toThrow('network error')
})
```

## Running Tests

```bash
# Vitest
vitest                    # Run in watch mode
vitest run                # Single run
vitest --coverage         # Coverage report
vitest --reporter=verbose # Detailed output

# Jest
jest                      # Run all tests
jest --watch              # Watch mode
jest --coverage           # Coverage
jest --testNamePattern="payment"  # Run tests matching pattern
jest --verbose            # Detailed output
```

## Best Practices

1. **Test file location:** `*.test.ts` or `*.spec.ts` adjacent to implementation, or in `tests/` directory
2. **Use `describe()` to group related tests**
3. **Assertions should be explicit:** `expect(result).toBe(true)` not just `expect(result)`
4. **Avoid mocking implementation internals:** Test the public interface
5. **Parameterize for enumeration:** `it.each()` reduces code duplication
6. **Async handling:** Always return the promise or use `async/await`
7. **Spy selectively:** Only spy on external boundaries (HTTP, DB), not internal calls
