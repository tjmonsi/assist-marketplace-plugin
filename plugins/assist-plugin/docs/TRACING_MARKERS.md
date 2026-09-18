# Tracing Markers — Requirement and Specification IDs

Convention for linking code comments to requirements and specifications.

---

## Format

Use square brackets with pipe-separated tags at the start of a comment:

- `[REQ-123]` — Single requirement marker
- `[SPEC-45]` — Single specification marker
- `[REQ-123|SPEC-45]` — Combined marker when both apply

Examples:

```typescript
// [REQ-123] Validate JWT signature before accepting token
const verified = crypto.verify(token, secret);

// [SPEC-45] Implement OAuth2 implicit flow per RFC 6749
const redirectUri = oauth.getAuthorizationUrl();

// [REQ-123|SPEC-45] Session tokens expire after 1 hour per req and spec
const expiresAt = now + 3600000;
```

```python
# [REQ-88] Rate limit authentication attempts to 5 per minute
def check_rate_limit(user_id):
    return cache.get(f"attempts:{user_id}") < 5
```

---

## When to Use Traceability Markers

Add a marker when:
- The code implements a specific requirement (ref: BRD, URD, or task prompt)
- The code follows a specific part of a specification or RFC
- The logic enforces a compliance or security boundary tied to a written rule

**Do not use markers for:**
- General best practices (no marker needed for "this is defensive coding")
- Refactoring or clarity improvements (apply marker only if the original logic was tied to a requirement)
- Bug fixes (use marker only if the bug fix implements a requirement, not for general correctness)

---

## ID Sourcing

Valid sources for an ID:

1. **Requirements/Specification Document** — A formal BRD, URD, or spec doc already in the repo with a numbered requirement or specification section. Example: `docs/requirements.md` states "REQ-123: Authentication must validate JWT signatures."

2. **Task Prompt** — An ID stated by the user in the task prompt or user's original request. Example: User says "Implement REQ-88 (rate limiting)" when assigning the task.

**Never invent an ID.** If no document or task prompt provides the ID, write the comment without a marker.

---

## Examples

### Good (ID from requirements doc)

```typescript
// docs/requirements.md states REQ-123: "Validate token signature"
// [REQ-123] Reject tampered tokens
if (!crypto.verify(token, secret)) {
  throw new AuthError("Invalid token");
}
```

### Good (ID from task prompt)

User said: "Implement REQ-88: rate limiting for login attempts."

```python
# [REQ-88] Enforce rate limit
if attempts_in_last_minute >= 5:
    raise RateLimitError()
```

### Good (no ID, general logic)

```javascript
// Defensive check: prevent null pointer if user object is missing
if (user && user.permissions.includes('admin')) {
  // ...
}
```

### Bad (invented ID)

```typescript
// [REQ-999] This doesn't exist in any doc or task prompt
const x = calculateValue();
```

---

## Impact on Code Review

During code review, traceability markers help:
- Verify that implemented code matches stated requirements
- Trace code to a specific part of the specification for validation
- Detect when requirements are partially or incorrectly implemented
- Link findings back to the requirement that should have prevented the bug

Reviewers should check that every marker points to a valid requirement/spec and that the implementation matches the requirement text.

