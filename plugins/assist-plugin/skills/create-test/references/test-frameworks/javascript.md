# JavaScript Testing: Node.js + Vitest / Jest

## Test Structure

JavaScript can use `node:test` (built-in, Node 18+), `vitest` (ESM-native), or `jest` (CommonJS/ESM compatible).

### With node:test (no dependencies)

```javascript
import { test, describe } from 'node:test'
import assert from 'assert'
import { process, InvalidInputError } from './mymodule.js'

describe('process module', () => {
  // [AC-1 | SPEC-003 | FR-045] Happy path: valid input succeeds
  test('should process valid input', () => {
    const result = process('valid')
    assert.equal(result, 'expected')
  })

  test('should reject empty input', () => {
    assert.throws(() => process(''), InvalidInputError)
  })

  test('should handle null input', () => {
    assert.throws(() => process(null))
  })
})
```

### With Vitest (ESM, faster)

```javascript
import { describe, it, expect } from 'vitest'
import { process, InvalidInputError } from './mymodule.js'

describe('process module', () => {
  it('should process valid input', () => {
    const result = process('valid')
    expect(result).toBe('expected')
  })
})
```

## Naming Conventions

- `describe('FunctionName', () => { it('should ...') })`
- Test description: `should validate input before processing` (not `validates input validation`)
- No redundancy in test names

## Assertions

### node:test + assert

| Pattern | Usage |
|---------|-------|
| `assert.equal(actual, expected)` | Equality |
| `assert.deepEqual(obj1, obj2)` | Deep equality |
| `assert.throws(fn, ErrorType)` | Expect exception |
| `assert.doesNotThrow(fn)` | No exception |
| `assert.ok(condition)` | Truthy |
| `assert.strictEqual(a, b)` | Strict equality |

### Vitest (preferred for modern code)

| Pattern | Usage |
|---------|-------|
| `expect(value).toBe(expected)` | Equality |
| `expect(obj).toEqual(expected)` | Deep equality |
| `expect(fn).toThrow()` | Expect exception |
| `expect(fn).toThrow(TypeError)` | Specific error type |
| `expect(array).toContain(item)` | Array membership |
| `expect(string).toMatch(/regex/)` | Regex match |

## Parameterized Tests (Table-Driven)

### node:test with sub-tests

```javascript
describe('payment processor', () => {
  const testCases = [
    { name: 'valid: happy path', amount: 50.0, shouldSucceed: true },
    { name: 'invalid: negative', amount: -10.0, shouldSucceed: false },
    { name: 'boundary: zero', amount: 0.0, shouldSucceed: true },
  ]

  testCases.forEach(({ name, amount, shouldSucceed }) => {
    test(name, () => {
      if (shouldSucceed) {
        const result = processPayment(amount)
        assert.ok(result !== null)
      } else {
        assert.throws(() => processPayment(amount))
      }
    })
  })
})
```

### Vitest with it.each()

```javascript
describe('payment processor', () => {
  it.each([
    ['valid: happy path', 50.0, true],
    ['invalid: negative', -10.0, false],
    ['boundary: zero', 0.0, true],
  ])('%s', (name, amount, shouldSucceed) => {
    if (shouldSucceed) {
      const result = processPayment(amount)
      expect(result).toBeDefined()
    } else {
      expect(() => processPayment(amount)).toThrow()
    }
  })
})
```

## Setup and Teardown

```javascript
describe('user management', () => {
  let user

  beforeEach(() => {
    user = { id: 1, email: 'test@example.com', verified: true }
  })

  afterEach(() => {
    // Cleanup
  })

  it('should fetch user', () => {
    assert.equal(user.email, 'test@example.com')
  })
})
```

## Mocking

### node:test with module mocking

```javascript
import { mock } from 'node:test'

test('should charge card with mock gateway', () => {
  const mockGateway = mock.fn(async (amount) => 'txn_123')
  
  const result = processPayment(50.0, mockGateway)
  assert.equal(mockGateway.mock.callCount(), 1)
})
```

### Vitest with vi.mock()

```javascript
import { vi, describe, it, expect } from 'vitest'
import * as paymentModule from './payment.js'

vi.mock('./payment.js', () => ({
  charge: vi.fn().mockResolvedValue('txn_123'),
}))

it('should charge card', async () => {
  const result = await paymentModule.charge(50.0)
  expect(result).toBe('txn_123')
})
```

## Async Testing

```javascript
// With node:test
test('should fetch user data', async () => {
  const user = await fetchUser(1)
  assert.equal(user.email, 'test@example.com')
})

// With Vitest
it('should reject on network error', async () => {
  await expect(fetchUser(1)).rejects.toThrow('network error')
})
```

## Running Tests

### node:test

```bash
node --test                          # Run all test files
node --test --grep="payment"         # Run tests matching pattern
node --test --reporter=verbose       # Detailed output
```

### Vitest

```bash
vitest                    # Watch mode
vitest run                # Single run
vitest --coverage         # Coverage report
vitest run --reporter=verbose  # Detailed output
```

### Jest

```bash
jest                      # Run all tests
jest --watch              # Watch mode
jest --coverage           # Coverage
jest --testNamePattern="payment"  # Pattern match
```

## Best Practices

1. **File location:** `*.test.js` or `*.spec.js` adjacent to implementation or in `tests/`
2. **Use `describe()` to group related tests**
3. **Explicit assertions:** `assert.equal(result, true)` not just `assert(result)`
4. **Module format:** Use ESM (`import`/`export`) for modern code; CommonJS (`require`) for legacy
5. **Async handling:** Always return promise or use `async/await`
6. **Parameterize:** Use table-driven tests to reduce duplication
7. **Avoid spying on internals:** Test via public API only
8. **Clean up resources:** Use `afterEach()` to close connections, files, etc.
