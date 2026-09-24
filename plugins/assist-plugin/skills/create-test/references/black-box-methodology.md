# Black-Box Test Methodology

Test acceptance criteria (Scenarios) without knowing implementation. Focus on the contract: what inputs are expected, what outputs result, what errors occur, and what state changes happen.

## Core Rule: No Implementation Knowledge

- Never read function bodies, class implementations, or internal logic.
- Never assume how the system achieves the requirement — only that it does.
- Source of truth: spec Scenarios, public interface signatures, and requirement documents.

This constraint ensures tests are:

1. **Maintainable across refactors** — If implementation changes but the contract stays the same, tests remain valid.
2. **Bias-free** — You cannot accidentally test the implementation's shortcut instead of the full contract.
3. **Acceptance-grade** — They verify what was promised, not how it was coded.

## Input-Space Enumeration Checklist

For every Scenario, identify and test these equivalence classes:

### 1. Valid Inputs (Happy Path)

**What:** Inputs that satisfy all Scenario preconditions (GIVEN clause).

**How to find them:**
- Read the GIVEN/WHEN/THEN
- Each specific value named in the Scenario is a valid input (e.g., "user is authenticated" → construct an authenticated user; "amount is $50" → test with 50)
- Include one test per "normal" case

**Example:** If Scenario says "GIVEN a logged-in user with admin role WHEN they request report access THEN grant it," test with a real admin user object matching the spec.

### 2. Invalid Inputs (Failure Paths)

**What:** Inputs that violate the Scenario's GIVEN conditions or business rules.

**How to find them:**
- Negate each GIVEN clause: if "user is authenticated," test with unauthenticated user
- Check the spec for business rules: if "amount must be positive," test with negative/zero
- Check for state errors: if "user must have verified email," test with unverified email

**Example:** Scenario says "GIVEN amount > 0 WHEN user submits payment THEN process it." Invalid case: negative amount (violation of GIVEN).

### 3. Boundary Inputs (Edge Cases)

**What:** Values at the edge of valid ranges — exactly at limits, just inside, just outside.

**How to find them:**
- Read the spec for min/max values (e.g., RFC minimum field length, max integer size, URL length limits)
- Test: zero, one, max-1, max, max+1 for numeric boundaries
- Empty vs. one-element vs. large collection for sequences

**Example:** Password field spec says "6–128 characters." Test with 5 (just below), 6 (at boundary), 128 (at boundary), 129 (just above).

### 4. Null and Empty Equivalents

**What:** No value, zero-length, or uninitialized states.

**How to find them:**
- `null`/`nil`/`None` depending on language
- Empty string `""`, empty list `[]`, empty object `{}`
- Uninitialized optional/nullable fields

**Example:** If an optional field can be absent, test both with and without it.

### 5. Type Mismatches (If Applicable)

**What:** Wrong data type where the interface allows runtime type confusion.

**How to find them:**
- REST APIs: JSON payload with wrong types (string instead of number, number instead of boolean)
- Dynamically typed languages: passing list where scalar expected
- Untagged unions/interfaces: passing wrong variant

**Note:** Strongly typed language (e.g., Rust, TypeScript strict) compilers prevent these; test only if the interface allows it (e.g., REST API, reflection-based unmarshaling).

**Example:** REST API expects `{"count": 5}` (number). Test sending `{"count": "five"}` (string) and verify error handling.

### 6. Security-Adjacent / Injection-Shaped Inputs

**What:** Strings shaped like attacks, testing whether the system properly escapes/validates/rejects them.

**How to find them:**
- **SQL injection:** Strings with single quotes, `UNION SELECT`, `--` comments
- **XSS:** Strings with `<script>`, `onclick=`, HTML entities
- **Path traversal:** Strings with `../`, `..\\`, absolute paths when relative expected
- **Command injection:** Shell metacharacters: `; rm -rf`, pipes, backticks
- **Header injection:** Newlines in HTTP headers: `\r\n`

**How to test:**
- Submit the attack string as input.
- Verify the system either:
  - Rejects it (error/exception), or
  - Accepts it safely (properly escaped in output, sanitized before use, logged for detection)
- Never assume it will be "harmless in this context" without proof from the spec or implementation review.

**Examples:**
- User input field gets `'; DROP TABLE users; --` → verify it's treated as literal string, not SQL
- File upload endpoint gets path `../../../../etc/passwd` → verify it's rejected or sandboxed
- Form field gets `<img src=x onerror=alert('xss')>` → verify it's escaped in output or sanitized

### Enumeration Table Template

Use this for each Scenario:

| Category | Representative Input | Expected Behavior | Test Name |
|----------|----------------------|-------------------|-----------|
| **Valid** | Spec example (e.g., authenticated user) | Scenario outcome (THEN clause) | `testHappyPath_succeeds` |
| **Invalid: GIVEN violation** | Negate precondition (e.g., unauthenticated) | Error per spec or safe default | `testUnauthenticatedUser_rejectsWithUnauthorized` |
| **Boundary: Min** | Minimum allowed value | Accepts or rejects per spec | `testMinBoundary_succeeds` |
| **Boundary: Max** | Maximum allowed value | Accepts or rejects per spec | `testMaxBoundary_succeeds` |
| **Boundary: Just above** | Max + 1 / 1 past limit | Rejects with error | `testAboveMax_rejectsWithValidationError` |
| **Null/Empty** | `null` or `""` | Spec-defined behavior | `testNullInput_throwsTypeError` |
| **Type mismatch** | Wrong type (if applicable) | Rejects with type error | `testStringInsteadOfNumber_rejectsWithTypeError` |
| **Injection: SQL** | String with `'; DROP--` | Treated as literal or rejected | `testSqlInjectionAttempt_preventsExecution` |

## API Endpoint (HTTP) Tests

For REST endpoints, black-box testing means:

1. **Only know the API spec:** HTTP method, URL, request body schema, response schema, status codes per outcome.
2. **Never inspect server logs, database state, or internal routing** to verify the test setup — only the HTTP response.
3. **Test via HTTP:** Use the client library (e.g., `requests` for Python, `fetch` for JavaScript, `curl` for shell) to send the request and check the response.

### Endpoint Test Structure

```
Per Scenario:
  1. Set up precondition (GIVEN) — if it's a system state, set it via a prior API call or seed data
  2. Send request (WHEN) — HTTP call with specified method/URL/headers/body
  3. Assert response (THEN) — status code, response body schema, headers
```

**Precondition setup:** If GIVEN says "user is authenticated," create a session/token via login API, not by directly modifying the database (which requires implementation knowledge).

**Response assertion:** Assert status code, JSON schema, specific fields — not internal database state.

## Constraints for Black-Box Tests

1. **No mocking of implementation internals.** Mock only external boundaries (database, HTTP client, message queue) when necessary to isolate the endpoint, and only if mocking is unavoidable. Prefer end-to-end tests with a test database.

2. **No spy/verification of internal method calls.** Never assert that "function X called function Y." Test the observable output.

3. **No reading of private/internal state.** Only access what the public interface exposes.

4. **Test only the interface under test.** Don't test the framework, library, or language runtime; test your code's contract.

## Traceability

Every test carries a comment chain linking it to the spec:

```typescript
// [AC-1 | SPEC-003 | FR-045]
// This test verifies the happy path: valid input yields the spec'd output.
test('user with admin role can access admin panel', () => { ... })
```

Chain rules:
- Start with the Acceptance Criterion index (AC-N) if testing a specific Scenario.
- Include the spec document ID (SPEC-NNN).
- Include requirement IDs (FR-NNN, UR-NNN, BR-NNN) if the spec cites them.
- Never invent IDs; source them from actual spec/requirement documents.

## Example: Black-Box Test for a Payment Endpoint

**Spec Scenario:**
> #### Scenario: Successful payment processing
> - GIVEN a user with a valid payment method on file and an order total of $50.00
> - WHEN they submit a payment request
> - THEN the system SHALL charge the card, persist the transaction, and return status 200 with transaction ID

**Black-box tests (no knowledge of database schema, payment processor internals, or code structure):**

1. **Valid happy path:** Submit payment with a valid order and card → assert 200 + valid transaction ID
2. **Invalid: missing card:** Submit payment with no payment method on file → assert 400 + validation error
3. **Boundary: zero amount:** Order total is $0.00 → assert behavior per business rules (reject or allow free order?)
4. **Injection: amount as SQL:** Payload `{"amount": "1; UPDATE users SET balance=0;"}` → assert it's treated as literal or rejected, transaction not executed
5. **Type mismatch:** Amount as string `"50"` instead of number → assert type error or coercion per spec

None of these tests inspect the payment processor library's internals, the database schema, or the code's control flow.
