# TypeScript Integration Testing

Integration testing patterns for TypeScript projects using Vitest, Fastify, and Prisma.

## Setup

### Dependencies
- `vitest` — modern test framework (faster than Jest)
- `@vitest/ui` — test dashboard
- `supertest` — HTTP assertions (legacy; prefer app.inject())
- `@testcontainers/testcontainers` — container management
- `msw` — Mock Service Worker for HTTP mocking
- `prisma` — ORM with built-in test database support

```bash
npm install -D vitest @vitest/ui msw @testcontainers/testcontainers
npm install prisma @prisma/client
```

## Test Database

### With Prisma

Prisma handles test database creation and cleanup automatically.

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
})

// tests/setup.ts
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

beforeAll(async () => {
  // Create and migrate test database
  await execAsync('npx prisma migrate deploy')
})

afterAll(async () => {
  // Optional: reset database after all tests
  // await execAsync('npx prisma migrate reset --force')
})

// Or per-test cleanup
export async function resetDatabase() {
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `
  for (const { tablename } of tables) {
    await prisma.$queryRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`)
  }
  await prisma.$disconnect()
}
```

## HTTP Client Testing

### With Fastify

Use `app.inject()` for route testing — no server startup needed.

```typescript
// tests/integration/users.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { build } from '../app'

describe('User API', () => {
  let app: any

  beforeAll(async () => {
    app = await build()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('creates a user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { name: 'Alice', email: 'alice@test.com' },
    })
    expect(res.statusCode).toBe(201)
    const data = JSON.parse(res.payload)
    expect(data.name).toBe('Alice')
  })

  it('retrieves a user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/1',
    })
    expect(res.statusCode).toBe(200)
  })
})
```

## Mocking External APIs

### With Mock Service Worker (MSW)

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('https://api.example.com/data', () =>
    HttpResponse.json({ status: 'ok' })
  ),
  http.post('https://api.example.com/webhook', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ received: body })
  }),
]

// tests/setup.ts
import { setupServer } from 'msw/node'
import { handlers } from './mocks/handlers'

export const mockServer = setupServer(...handlers)

beforeAll(() => mockServer.listen())
afterEach(() => mockServer.resetHandlers())
afterAll(() => mockServer.close())
```

### Runtime handler override

```typescript
it('handles external API error', async () => {
  mockServer.use(
    http.get('https://api.example.com/data', () =>
      HttpResponse.json({ error: 'Service unavailable' }, { status: 503 })
    )
  )
  // ... test error handling
})
```

## Example Tests

### With database

```typescript
// tests/integration/crud.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { build } from '../app'
import { prisma } from '../lib/db'

describe('CRUD operations', () => {
  let app: any

  beforeEach(async () => {
    app = await build()
    // Clean database before each test
    await prisma.user.deleteMany()
  })

  it('creates and retrieves user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { name: 'Bob', email: 'bob@test.com' },
    })
    expect(res.statusCode).toBe(201)
    const user = JSON.parse(res.payload)

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/users/${user.id}`,
    })
    expect(getRes.statusCode).toBe(200)
    expect(JSON.parse(getRes.payload).email).toBe('bob@test.com')
  })
})
```

## Best Practices

1. **Use app.inject():** Avoid spinning up an HTTP server; test the app in-process.
2. **Prisma test database:** Use separate test database URL; don't share with dev DB.
3. **MSW for external APIs:** Mock third-party services, not your own APIs.
4. **Database cleanup:** Truncate or reset after each test to ensure isolation.
5. **Build app once:** Reuse app instance across tests in same file; close after all tests.

## Coverage

```bash
npm run test:integration -- --coverage
```

Target: 90%+ coverage. Report uncovered lines.

## Running Integration Tests

```bash
# All integration tests
npm run test:integration

# Specific file
npm run test:integration -- tests/integration/users.test.ts

# Watch mode
npm run test:integration -- --watch
```
