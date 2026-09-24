# Fastify Reference

## Contents
- Mandatory Toolchain
- Fastify Patterns
- CORS (@fastify/cors)
- Security Headers (@fastify/helmet)
- Project Structure

## Mandatory Toolchain

| Tool | Purpose | Prohibited alternatives |
|------|---------|------------------------|
| Fastify | Web framework | Express for new services (no built-in schema validation) |
| `@sinclair/typebox` | Schema + type co-location | Manual JSON Schema without static types |
| `@fastify/cors` | CORS | manual header-writing hook |
| `@fastify/helmet` | Security headers | manual header-writing hook |
| `fastify-plugin` | Plugin encapsulation escape hatch | Ad-hoc `app.decorate()` outside a plugin |

Language-level toolchain (TypeScript 5.x, `eslint`, `vitest`) is covered by the TypeScript language reference; this file covers Fastify-specific patterns only.

## Fastify Patterns

**Schema-first routes:** Every route must declare JSON Schema for request and reply. Missing `schema.response` or missing return type annotation is a violation.

Use `@sinclair/typebox` for schema + type co-location:

```typescript
const UserSchema = Type.Object({ id: Type.Number(), name: Type.String() });
type User = Static<typeof UserSchema>;

app.get<{ Params: { id: number }; Reply: User }>("/users/:id", {
  schema: { params: Type.Object({ id: Type.Number() }), response: { 200: UserSchema } },
}, async (request, reply): Promise<User> => { ... });
```

**HTTP/2 support:** Fastify natively supports HTTP/2.

```typescript
// Plaintext h2c — behind proxy (Cloud Run, GKE, ALB)
const fastify = require('fastify')({ http2: true })
fastify.listen({ port: 8080, host: '0.0.0.0' })

// HTTPS h2 — direct TLS termination
const fastify = require('fastify')({
  http2: true,
  https: {
    allowHTTP1: true,  // fallback for HTTP/1.1 clients
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.cert'),
  }
})
```

- Behind proxy: use `http2: true` without `https` — proxy handles TLS
- Direct: `https` + `allowHTTP1: true` for backward compat
- Set `trustProxy: true` when behind a reverse proxy

**Plugin registration:** All routes via `app.register(routePlugin, { prefix })`. Inline route registration outside a plugin is a violation.

**Pino logging:** Fastify uses Pino by default. Use `request.log.info()`, never `console.log`.

**Global error handler:** Register via `app.setErrorHandler()`. Log error, return 500 with generic message.

**Dependency injection:** Use `fastify-plugin` + `app.decorate()` with module augmentation for type safety.

## CORS (@fastify/cors)

`origin: "*"` in production is a security violation. Configure explicitly:

```typescript
import cors from '@fastify/cors'

await fastify.register(cors, {
  origin: ['https://app.example.com'],   // explicit list from env
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86400,                          // preflight cache seconds
  strictPreflight: true,                  // require Origin + Access-Control-Request-Method
})
```

Rules:
- `credentials: true` + wildcard origin is rejected by browsers
- `strictPreflight: true` (default) — enforce proper preflight headers
- `hook: 'onRequest'` (default) — runs before any other hook

## Security Headers (@fastify/helmet)

Register `@fastify/helmet` on every Fastify app. Missing registration is a security violation.

**Registration order:** helmet → CORS → routes.

```typescript
import helmet from '@fastify/helmet'

await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      upgradeInsecureRequests: [],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
})
```

Per-route CSP overrides with nonces (admin pages):
```typescript
fastify.get('/admin', {
  helmet: {
    enableCSPNonces: true,
    frameguard: { action: 'deny' },
  }
}, async (req, reply) => {
  const { script, style } = reply.cspNonce
  // use nonces in rendered HTML
})
```

## Project Structure

```
src/
  app.ts                 # Fastify instance factory, plugin registration
  config.ts              # Env loading, typed config object
  server.ts              # Entry point: create app, listen on PORT
  modules/
    users/
      router.ts          # Fastify route registration (register as plugin)
      schema.ts          # TypeBox schemas for request/response
      service.ts         # Business logic (no HTTP concerns)
      types.ts           # Module-specific types
    items/
      router.ts
      schema.ts
      service.ts
  plugins/
    db.ts                # Prisma/database decorator
    redis.ts             # ioredis decorator
    auth.ts              # JWT/session auth plugin
  middleware/
    helmet.ts            # @fastify/helmet config
    cors.ts              # @fastify/cors config
    csrf.ts              # csrf-csrf config
  lib/
    errors.ts            # Custom error classes
    logger.ts            # Pino config
tests/
  modules/
    users.test.ts
    items.test.ts
  helpers/
    setup.ts             # Test fixtures, app factory
tsconfig.json
eslint.config.js
Dockerfile
```
