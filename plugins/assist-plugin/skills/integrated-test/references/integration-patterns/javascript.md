# JavaScript Integration Testing

Integration testing patterns for vanilla JavaScript projects using Jest or Vitest.

## Setup

### Dependencies (Jest)
- `jest` — testing framework
- `supertest` — HTTP assertions
- `@testcontainers/testcontainers` — container management
- `jest-mock-extended` — advanced mocking

```bash
npm install -D jest supertest @testcontainers/testcontainers jest-mock-extended
```

### Dependencies (Vitest alternative)
```bash
npm install -D vitest @vitest/ui msw
```

## Test Database

### With testcontainers

```javascript
// tests/setup.js
const { PostgresContainer } = require('@testcontainers/testcontainers')

let postgres

beforeAll(async () => {
  postgres = await new PostgresContainer('postgres:16').start()
  global.testDbUrl = postgres.getConnectionUrl()
})

afterAll(async () => {
  await postgres.stop()
})
```

## HTTP Client Testing

### With Express

```javascript
// tests/integration/users.test.js
const request = require('supertest')
const app = require('../../app')

describe('User API', () => {
  it('creates a user', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ name: 'Alice', email: 'alice@test.com' })
    expect(res.statusCode).toBe(201)
    expect(res.body.name).toBe('Alice')
  })

  it('retrieves a user', async () => {
    const res = await request(app)
      .get('/api/users/1')
    expect(res.statusCode).toBe(200)
  })
})
```

### With custom fetch-based client

```javascript
// tests/api.client.js
class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL
  }

  async request(method, path, body = null) {
    const options = { method }
    if (body) options.body = JSON.stringify(body)
    const res = await fetch(`${this.baseURL}${path}`, options)
    return {
      status: res.status,
      data: await res.json()
    }
  }

  post(path, body) { return this.request('POST', path, body) }
  get(path) { return this.request('GET', path) }
}

module.exports = ApiClient
```

## Mocking External APIs

### With jest mock

```javascript
// tests/integration/external-api.test.js
jest.mock('node-fetch')
const fetch = require('node-fetch')

describe('External API', () => {
  beforeEach(() => {
    fetch.mockClear()
  })

  it('calls external service', async () => {
    fetch.mockResolvedValueOnce({
      json: async () => ({ status: 'ok' })
    })

    const res = await someService.fetchData()
    expect(res.status).toBe('ok')
    expect(fetch).toHaveBeenCalledWith('https://api.example.com/data')
  })
})
```

### With nock (HTTP mocking library)

```javascript
const nock = require('nock')

describe('External API', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('mocks external endpoint', async () => {
    nock('https://api.example.com')
      .get('/data')
      .reply(200, { status: 'ok' })

    const res = await fetch('https://api.example.com/data').then(r => r.json())
    expect(res.status).toBe('ok')
  })
})
```

## Database Testing

### With raw SQL

```javascript
// tests/db.test.js
const { Pool } = require('pg')

describe('Database', () => {
  let db

  beforeAll(async () => {
    db = new Pool({ connectionString: process.env.TEST_DATABASE_URL })
  })

  afterAll(async () => {
    await db.end()
  })

  afterEach(async () => {
    // Clean up after each test
    await db.query('TRUNCATE users CASCADE')
  })

  it('inserts and retrieves user', async () => {
    await db.query('INSERT INTO users (name, email) VALUES ($1, $2)', 
      ['Alice', 'alice@test.com'])
    const result = await db.query('SELECT * FROM users WHERE name = $1', ['Alice'])
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].email).toBe('alice@test.com')
  })
})
```

## Example Integration Test

```javascript
// tests/integration/crud.test.js
const request = require('supertest')
const app = require('../../app')
const db = require('../../lib/db')

describe('CRUD Integration', () => {
  beforeEach(async () => {
    // Clean database
    await db.query('TRUNCATE users CASCADE')
  })

  afterAll(async () => {
    await db.end()
  })

  it('creates user via API and retrieves from database', async () => {
    // Create via API
    const createRes = await request(app)
      .post('/api/users')
      .send({ name: 'Bob', email: 'bob@test.com' })
    expect(createRes.statusCode).toBe(201)
    const userId = createRes.body.id

    // Verify in database
    const dbRes = await db.query('SELECT * FROM users WHERE id = $1', [userId])
    expect(dbRes.rows).toHaveLength(1)
    expect(dbRes.rows[0].email).toBe('bob@test.com')

    // Retrieve via API
    const getRes = await request(app).get(`/api/users/${userId}`)
    expect(getRes.statusCode).toBe(200)
    expect(getRes.body.email).toBe('bob@test.com')
  })
})
```

## Best Practices

1. **Clean database per test:** Always truncate/reset between tests.
2. **Mock external APIs:** Use nock or jest.mock() for third-party services.
3. **Use testcontainers:** Spin up real databases for integration tests.
4. **Separate unit from integration:** Use different test directories and run separately.
5. **Keep tests isolated:** Each test should be independent and repeatable.

## Coverage

```bash
jest --coverage tests/integration/
```

Target: 90%+ coverage. Report uncovered lines.

## Running Tests

```bash
# All integration tests
npm run test:integration

# With coverage
npm run test:integration -- --coverage

# Watch mode
npm run test:integration -- --watch

# Specific file
npm run test:integration -- tests/integration/users.test.js
```
