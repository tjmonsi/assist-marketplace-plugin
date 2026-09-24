# JWT Auth Middleware — JavaScript (Express)

Bearer JWT verification via `jsonwebtoken`, with a role-based guard. See
[../../languages/javascript.md](../../languages/javascript.md) for conventions.

## Pattern

```javascript
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing bearer token" });
  }
  const token = header.slice("Bearer ".length);

  jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }, (err, payload) => {
    if (err) {
      const message = err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
      return res.status(401).json({ message });
    }
    req.user = { sub: payload.sub, roles: payload.roles ?? [] };
    next();
  });
}

function requireRole(role) {
  return (req, res, next) => {
    authenticate(req, res, (err) => {
      if (err) return next(err);
      if (!req.user.roles.includes(role)) {
        return res.status(403).json({ message: "Insufficient role" });
      }
      next();
    });
  };
}

module.exports = { authenticate, requireRole };
```

## Usage

```javascript
const { authenticate, requireRole } = require("./auth-middleware");

router.get("/me", authenticate, (req, res) => res.json(req.user));

router.delete("/admin/users/:id", requireRole("admin"), async (req, res) => {
  await deleteUser(req.params.id);
  res.status(204).end();
});
```

## Notes

- Pin `algorithms: ["HS256"]` (or `RS256` for asymmetric keys) explicitly on
  `jwt.verify` — never allow the token to dictate its own algorithm.
- Return `401` for missing/invalid/expired tokens, `403` once identity is
  established but the role check fails; do not conflate the two.
- Load `JWT_SECRET` from environment/secret manager, never hardcode or commit
  it; rotate on a schedule and support key overlap during rotation.
- Middleware composition (`authenticate` then role check) keeps auth logic
  centralized and testable independent of route handlers.
- For session-based auth, verify a signed, `HttpOnly`, `Secure`,
  `SameSite=Lax` cookie against a server-side session store (Redis) instead
  of decoding a bearer token.
