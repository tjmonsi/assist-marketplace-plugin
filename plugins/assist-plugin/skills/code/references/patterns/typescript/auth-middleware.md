# JWT Auth Middleware — TypeScript (Fastify)

Bearer JWT verification via `@fastify/jwt`, with a role-based guard decorator.
See [../../languages/typescript.md](../../languages/typescript.md) and
[../../frameworks/fastify.md](../../frameworks/fastify.md) for conventions.

## Pattern

```typescript
import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

interface AuthPayload {
  sub: string;
  roles: string[];
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (role: string) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: AuthPayload;
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET as string,
  });

  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ message: "Missing or invalid token" });
    }
  });

  app.decorate("requireRole", (role: string) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      await app.authenticate(req, reply);
      if (reply.sent) return;
      const user = req.user as AuthPayload;
      if (!user.roles.includes(role)) {
        return reply.code(403).send({ message: "Insufficient role" });
      }
    };
  });
});
```

## Usage

```typescript
app.get("/me", { preHandler: app.authenticate }, async (req) => req.user);

app.delete(
  "/admin/users/:id",
  { preHandler: app.requireRole("admin") },
  async (req, reply) => {
    await deleteUser(req.params.id);
    return reply.code(204).send();
  }
);
```

## Notes

- `@fastify/jwt` verifies signature and expiry (`exp`) automatically; a
  thrown/rejected `jwtVerify()` means the token is missing, malformed, or
  expired — always return `401`, never leak the underlying error message.
- Return `403` (not `401`) once identity is established but the role check
  fails — the two codes are not interchangeable.
- Load `JWT_SECRET` from environment/secret manager; for RS256, configure
  `secret` as a JWKS/public-key resolver instead of a shared string.
- Use `preHandler` hooks, not inline checks in each route, so auth logic is
  centralized and independently testable.
- For session-based auth, swap `@fastify/jwt` for `@fastify/session` with a
  signed, `HttpOnly`, `Secure`, `SameSite=Lax` cookie backed by a server-side
  store (Redis).
