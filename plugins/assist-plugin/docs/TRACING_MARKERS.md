# Tracing Markers — Requirement and Specification IDs

Convention for linking code comments to requirements and specifications.

---

## Format

Use square brackets with pipe-separated tags at the start of a comment:

- `[FR-045]` — Single requirement marker (`BR`, `UR`, `FR`, or `NFR`)
- `[SPEC-003]` — Single specification marker
- `[FR-045|SPEC-003]` — Combined marker when both apply

Examples:

```typescript
// [FR-045] Validate JWT signature before accepting token
const verified = crypto.verify(token, secret);

// [SPEC-003] Implement OAuth2 implicit flow per RFC 6749
const redirectUri = oauth.getAuthorizationUrl();

// [FR-045|SPEC-003] Session tokens expire after 1 hour per req and spec
const expiresAt = now + 3600000;
```

```python
# [NFR-012] Rate limit authentication attempts to 5 per minute
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

1. **Requirements document** — A BRD, URD, or FR-NFR file produced by the `gather-requirements` skill. These carry the concrete ID families:

   | Marker | Source | Meaning |
   |---|---|---|
   | `[BR-NNN]` | `BRD-<slug>.md` | Business requirement |
   | `[UR-NNN]` | `URD-<slug>.md` | User requirement |
   | `[FR-NNN]` | `FR-NFR-<slug>.md` | Functional requirement |
   | `[NFR-NNN]` | `FR-NFR-<slug>.md` | Non-functional requirement |

   Example: `FR-NFR-checkout.md` states "FR-045: The checkout service SHALL validate JWT signatures."

2. **Specification document** — A `specs/spec-[feature].md` file produced by the `spec-from-requirements` skill. Cite its per-spec requirement ID as `[SPEC-NNN]` (the spec's own `REQ-spec-NNN` numbering, which is local to that file). Prefer the requirement ID when both apply, since it is stable across spec rewrites. Combine them when the code implements a spec decision that refines a requirement: `[FR-045|SPEC-003]`.

3. **Task prompt** — An ID stated by the user in the task prompt or original request. Example: User says "Implement FR-088 (rate limiting)" when assigning the task.

Legacy `[REQ-NNN]` markers already in a codebase remain valid. New markers use the families above.

**Never invent an ID.** If no document or task prompt provides the ID, write the comment without a marker.

---

## Examples

### Good (ID from requirements doc)

```typescript
// FR-NFR-auth.md states FR-045: "The system SHALL validate token signatures"
// [FR-045] Reject tampered tokens
if (!crypto.verify(token, secret)) {
  throw new AuthError("Invalid token");
}
```

### Good (ID from task prompt)

User said: "Implement FR-088: rate limiting for login attempts."

```python
# [FR-088] Enforce rate limit
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

