---
name: create-test
description: >-
  Generate black-box acceptance-criteria tests without reading implementation.
  Enumerates input space (valid, invalid, boundary, null, type-mismatch, injection)
  per criterion. Every test traces to AC/SPEC/FR/UC with [AC-N|SPEC-NNN|...] chains.
effort: high
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
argument-hint: "[spec-file | feature-name] [language]"
---

# Create-Test

Generate test files from acceptance criteria, spec Scenarios, and public interfaces — without reading implementation. Produces input-space-enumerated black-box tests with traceability chains.

## Constraint: No Implementation Knowledge

**Hard rule, not a tool restriction.** Never open, read, or reference the body of an implementation file. Read only:

1. **Acceptance-criteria Scenarios** — the `#### Scenario:` blocks in a spec's `### Requirement:` sections
2. **Requirement documents** — BRD/URD/FR-NFR references that define what the system must do
3. **Public interface declarations** — function signatures, type definitions, API route/schema specs, method signatures (the "what to call" parts, never the "how it works" implementation)

If you need to know what a function does, read its signature, docstring, and the spec's Scenario; never read the function body. If a signature is missing and you cannot understand the interface from the spec alone, halt and report that the public interface is undocumented.

## How It Works

### 1. Load References

Per the target language, load one reference from [references/test-frameworks/](references/test-frameworks/):
- `go.md` for Go (`testing`, `testify`)
- `rust.md` for Rust (`cargo test`, assertion frameworks)
- `python.md` for Python (`pytest`, fixtures, parametrization)
- `typescript.md` for TypeScript (`vitest`, `jest`)
- `javascript.md` for JavaScript (native `test()` runner, or ESM/CommonJS options)
- `kotlin.md` for Kotlin (`JUnit5`, `Kotest`)
- `cpp.md` for C++ (`Catch2`, `GoogleTest`)

Also load [references/black-box-methodology.md](references/black-box-methodology.md) to apply the enumeration checklist.

### 2. Enumerate Input Space Per Acceptance Criterion

For every Scenario (acceptance criterion), build the input space:

- **Valid inputs:** Examples that satisfy the Scenario's GIVEN/WHEN/THEN — happy path and expected variations
- **Invalid inputs:** Inputs that violate the Scenario's preconditions (GIVEN clause violated, or business rules broken)
- **Boundary inputs:** Edge cases — zero, max value, empty list, first/last element, one-before-limit
- **Null and empty:** `null`/`nil`/`None`, empty string, empty collection, uninitialized field
- **Type mismatches:** Wrong type passed where a specific type is expected (if the interface allows it, e.g., REST APIs with JSON, or if the language's type system permits it)
- **Security-adjacent:** Injection-shaped strings where input is used in a command/query context — SQL injection patterns, path traversal, XSS strings, shell metacharacters

Choose 3–5 representatives per category. Write a comment on each test explaining which category it covers and why (e.g., "Boundary: max string length per RFC 2822").

### 3. Traceability Chain

Every test file and test case must carry a traceability comment that chains from the acceptance criterion up to the spec and requirements:

```
// [AC-2 | SPEC-003 | FR-045 | UR-012 | BR-008]
```

or shorter if not all links exist:

```
// [AC-1 | SPEC-002 | FR-010]
// [SPEC-001 | FR-020]  // No AC ID in this spec
```

**Rules:**
- `AC-N` — Scenario index within the requirement (required if reading a spec with Scenarios)
- `SPEC-NNN` — Spec document ID (required)
- `FR-NNN`, `UR-NNN`, `BR-NNN`, `NFR-NNN` — Requirements IDs from upstream docs (include if a requirement doc references them)
- Source every ID from actual documents; never invent one.
- Arrow direction is always upward: AC → SPEC → FR → UR → BR.

### 4. Write Test Files

For unit tests, place them alongside implementation (language convention: `test` subdirectory, `_test.go`, `.spec.ts`, `Test.java`). For API endpoint tests, see [references/black-box-methodology.md](references/black-box-methodology.md) "Integration-level endpoint tests" section.

Output: one test file per public interface or per feature, depending on granularity. Name: `[function_name]_test.[ext]` or `[feature_name].test.[ext]`, matching the language convention.

## Constraints

- Read only specs and public interfaces; never implementation.
- If a spec has no Scenarios (no acceptance criteria), halt and ask the user to complete the spec first.
- Generate tests only; never modify or run existing code.
- If a test needs setup/fixtures, define them in the test file or reference the framework's standard fixture pattern (see language reference).
- Test names must state what is being tested: `testRejectsNullInput_throwsTypeError` (good), `test1` (bad).
- No implementation-specific mocking or spy verification: test the contract (input → output), not how it's built.

## Report Writing Standard

- Lead with the most important finding; never write "this is the more important of the two."
- Every finding has three parts: what happened, why it matters, what to do next.
- State each conclusion once. One optional summary line at the end for multi-finding reports; never repeat findings there.
- Use active voice, important subject before the verb ("Validation is skipped" not "The validation was skipped by...").
- Cut hedges ("it should be noted," "arguably") and contrastive filler ("This is X, not Y" — state what it is).
- No meta-headers about the act of writing ("What follows," "Key takeaway," "In conclusion").
- No em-dashes; use a period, comma, parentheses, or semicolon.
- No severity badges, remediation blocks, or summary sections unless the reader would be lost without them.
- Never restate the user's prompt or an assumption as fact; report the tested result.
- The first sentence of every paragraph must add new information.
