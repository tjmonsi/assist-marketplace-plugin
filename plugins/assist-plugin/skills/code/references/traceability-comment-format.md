# Traceability Comment Format

Full-chain format for linking code to specifications and requirements.

## Format

Use square brackets with arrows linking the full requirement chain:

```
// [SPEC-003 -> FR-045 -> UC-012 -> AC-2] Description of what this code implements
```

Start from the highest-level ID available; only include IDs that have concrete citations in a spec or requirements document.

## Valid ID Chains

Every ID in the chain must come from a document or task prompt. Choose the chain that best fits:

| Chain | When to use | Example |
|---|---|---|
| `[SPEC-NNN]` | Only a spec ID applies | `[SPEC-003] Validate JWT signature` |
| `[FR-NNN]` | Only a functional requirement applies | `[FR-045] Check token expiration` |
| `[NFR-NNN]` | Only a non-functional requirement applies | `[NFR-012] Log all auth attempts` |
| `[UC-NNN]` | Only a use case ID applies (if spec defines UCs) | `[UC-012] User initiates login` |
| `[AC-N]` | Only an acceptance criterion number applies (rare; usually paired with requirement) | `[AC-1] Valid token returns user profile` |
| `[SPEC-003 -> FR-045]` | Spec refines a requirement | `[SPEC-003 -> FR-045] JWT validation per RFC 7519` |
| `[FR-045 -> UC-012]` | Requirement implements a use case | `[FR-045 -> UC-012] Verify signature in login flow` |
| `[FR-045 -> UC-012 -> AC-2]` | Full chain: requirement → use case → acceptance criterion | `[FR-045 -> UC-012 -> AC-2] Return 401 on invalid token` |
| `[SPEC-003 -> FR-045 -> UC-012 -> AC-2]` | All four levels (rare but valid) | `[SPEC-003 -> FR-045 -> UC-012 -> AC-2] Reject expired JWTs` |

**Invalid chains (do not use):**
- `[REQ-999]`, `[SEC-NNN]`, `[CON-NNN]` — legacy scheme, not in assist-plugin
- `[SPEC-999]` — spec doesn't exist in the target file
- `[FR-999]` — requirement doesn't exist in the requirements document
- `[INVENTED-123]` — made-up IDs not sourced from any document

## When to Add Traceability Comments

Add a marker when:
- The code implements a specific requirement, use case, or acceptance criterion
- The logic enforces a compliance, security, or functional boundary tied to a written rule
- The code enforces a specification detail (RFC, standard, or design decision)

**Do not use markers for:**
- General best practices (no marker for "this is defensive coding" unless it's a specific NFR)
- Refactoring or clarity improvements (add a marker only if the original logic was tied to a requirement)
- Bug fixes (use a marker only if the bug fix implements a requirement, not for general correctness)

## ID Sourcing Rules

Valid sources for an ID:

1. **Specification document** — A `specs/spec-[feature].md` file. Cite its spec ID: `[SPEC-NNN]`
2. **Requirements document** — A `BRD-*.md`, `URD-*.md`, or `FR-NFR-*.md` file. Cite its requirement ID: `[FR-NNN]`, `[NFR-NNN]`, `[UR-NNN]`, or `[BR-NNN]`
3. **Specification use case** — A `#### Use Case: ...` block within a spec. Cite its ID: `[UC-NNN]`
4. **Acceptance criteria** — A `#### Scenario: ...` → `#### AC: ...` block within a spec. Cite: `[AC-N]`
5. **Task prompt** — An ID stated by the user when assigning the task. Example: "Implement FR-088 (rate limiting)."

**Never invent an ID.** If no document or task provides the ID, write the comment without a marker:

```typescript
// Defensive check: prevent null pointer if user object is missing
const isAdmin = user && user.permissions.includes('admin')
```

## Examples

### Good (Full chain from spec)

Spec file `specs/spec-auth.md` states:
- `SPEC-003: JWT Authentication`
  - `FR-045: Validate JWT Signatures`
    - `UC-012: User Login`
      - `AC-2: Return 401 if token is invalid`

Code:

```typescript
// [SPEC-003 -> FR-045 -> UC-012 -> AC-2] Reject tampered or expired tokens
const verified = crypto.verify(token, secret)
if (!verified) {
  throw new UnauthorizedError('Invalid token')
}
```

### Good (Partial chain, only what applies)

Requirements document `FR-NFR-checkout.md` states:
- `FR-067: Validate payment method`

Spec does not exist for this part. Code:

```python
# [FR-067] Ensure card is not expired
if card.expiry_date < datetime.now():
    raise PaymentError("Card expired")
```

### Good (Use case only)

Spec file `specs/spec-notifications.md` states:
- `UC-008: User receives email notification`

Code (no FR/SPEC context):

```go
// [UC-008] Send email after order confirmation
if err := sendEmail(user.email, confirmationTemplate); err != nil {
    logger.Error("email send failed", "error", err)
    // Notification failures are not operation-fatal; log and continue
}
```

### Good (No ID, general logic)

Code that isn't tied to a specific requirement:

```javascript
// Defensive check: prevent null pointer if profile is missing
const displayName = profile?.name || 'Anonymous'
```

### Bad (Invented ID)

```typescript
// [REQ-999] This doesn't exist in any document
const x = calculateValue()
```

### Bad (Incomplete chain)

Spec has `SPEC-003 -> FR-045 -> UC-012 -> AC-2`, but you only cite part:

```typescript
// [FR-045] Validate JWT — incomplete; should be full chain or state why
// (Better: [SPEC-003 -> FR-045 -> UC-012 -> AC-2] Validate JWT signature)
```

## Per-Language Syntax

Use the language's native comment syntax:

| Language | Marker Comment |
|---|---|
| Python | `# [SPEC-003] ...` |
| TypeScript/JavaScript | `// [SPEC-003] ...` or `/* [SPEC-003] ... */` |
| Go | `// [SPEC-003] ...` |
| Rust | `// [SPEC-003] ...` or `/// [SPEC-003] ...` |
| Kotlin | `// [SPEC-003] ...` |
| C++ | `// [SPEC-003] ...` or `/* [SPEC-003] ... */` |

Place the marker at the start of the line or above the code it annotates:

```python
# [FR-045] Check token expiration
if token.expiry < now():
    raise AuthError("Token expired")
```

```typescript
// [SPEC-003 -> FR-045] Verify JWT using the app's secret key
const verified = crypto.verify(token, process.env.JWT_SECRET)
```

## Impact on Code Review

During code review, traceability markers help:
- Verify that implemented code matches stated requirements
- Trace code to specific parts of the specification for validation
- Detect when requirements are partially or incorrectly implemented
- Link findings back to requirements that should have prevented the bug

Reviewers should confirm:
- Every marker points to a requirement/spec that actually exists
- The cited requirement ID(s) are correct and match the spec/requirements document
- The implementation matches the requirement text
- The chain is complete (no broken links)

## Updating Markers When Requirements Change

If a requirement ID changes (during spec rewrites or updates):
- Update all code comments to reflect the new ID
- Do not delete old markers without replacing them — always maintain traceability
- If a requirement is deleted, document the change in a commit message and assess code impact

If a feature is refactored and no longer tied to the original requirement:
- Remove the marker or update it to reflect the new context
- Ensure the new code (if any) carries appropriate markers for its new purpose
