---
name: integrated-test
description: >-
  Integration and E2E testing patterns for multiple languages and frameworks.
  Covers testcontainers-based database testing, semantic locators for Playwright E2E,
  monorepo test organization, and Playwright availability detection. Used by QA.
user-invocable: false
disable-model-invocation: true
effort: xhigh
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
---

# Integrated Test

Integration and E2E testing patterns for web applications across multiple languages and frameworks.

## Contents

1. [Language Detection](#language-detection)
2. [Integration Test Patterns](#integration-test-patterns)
3. [Monorepo Test Organization](#monorepo-test-organization)
4. [E2E Testing with Playwright](#e2e-testing-with-playwright)
5. [Playwright Availability Check](#playwright-availability-check)
6. [Best Practices](#best-practices)

---

## Language Detection

Detect the project language from the codebase and read the matching integration pattern reference:

| Signal | Reference |
|--------|-----------|
| `.py`, `pytest`, FastAPI, `pyproject.toml`, `requirements.txt` | [references/integration-patterns/python.md](references/integration-patterns/python.md) |
| `.ts`/`.js`, `vitest`, Fastify, Nuxt, `package.json`, `tsconfig.json` | [references/integration-patterns/typescript.md](references/integration-patterns/typescript.md) |
| `.js`, vanilla JavaScript, `package.json`, no TypeScript | [references/integration-patterns/javascript.md](references/integration-patterns/javascript.md) |
| `.go`, `go test`, Fiber, `go.mod`, `go.sum` | [references/integration-patterns/go.md](references/integration-patterns/go.md) |
| `.rs`, `cargo test`, Axum, `Cargo.toml` | [references/integration-patterns/rust.md](references/integration-patterns/rust.md) |
| `.kt`, `gradle test`, Kotlin, `build.gradle.kts`, Android | [references/integration-patterns/kotlin.md](references/integration-patterns/kotlin.md) |

Each reference covers:
- Test setup and framework initialization
- Integration testing the framework (Fastify inject, Fiber Test, Axum tower::ServiceExt, etc.)
- Database testing with real test containers
- Mocking external APIs
- Coverage commands and CI integration

---

## Integration Test Patterns

### Common Rules Across All Languages

1. **Containers over mocks:** Use testcontainers (or equivalent) to spin up real databases and services for integration tests, not mocks. This ensures tests verify against real systems.

2. **Real test-specific database:** Each test suite gets its own test database instance. Never share a test database across tests.

3. **Cleanup per test:** After each test completes, clean up its data (rollback transactions, truncate tables, or rebuild the container). This isolation prevents test interdependencies.

4. **Build tags for integration tests:** Separate integration tests from unit tests using language-specific build tags or test-path conventions:
   - Go: `//go:build integration` tag
   - Others: place in `tests/` or `__tests__/integration/` directories

### Framework-Specific Patterns

See language-specific references for:
- **Python (pytest + AsyncClient):** Testcontainers PostgreSQL, transaction rollback pattern, async fixtures, respx for HTTP mocking.
- **TypeScript (vitest + supertest):** Fastify inject(), Prisma test database, MSW for HTTP mocking, Nuxt test utils.
- **JavaScript:** Similar to TypeScript patterns, native test runners (Jest, Vitest).
- **Go (testcontainers + testify):** Testcontainers PostgreSQL, TestMain pattern, assert/require helpers.
- **Rust (sqlx::test + tower::ServiceExt):** Automatic migration and rollback, spawn full HTTP server on random port.
- **Kotlin (Hilt + Room + MockWebServer):** DI in tests, Room in-memory database, Hilt for test overrides.

---

## Monorepo Test Organization

For projects with multiple submodules (e.g., frontend + backend, mobile + API):

- **Tests that belong to one submodule** → `<submodule>/tests/` (or language-specific convention like `src/__tests__/`)
- **Tests that span multiple submodules** → `tests/` at the monorepo root

### Monorepo Root Tests Cover

- Frontend → Backend auth flow (login form → auth API → JWT → dashboard)
- Frontend → Backend CRUD (form submit → API → database → display)
- File upload across services
- Real-time communication (WebSocket client → server)
- Cross-service workflow validation

For detailed setup patterns and cross-submodule test examples, see [references/integration-patterns/README.md](references/integration-patterns/) (each language's file covers monorepo setup for that language).

---

## E2E Testing with Playwright

For web applications, use Playwright for browser automation E2E tests. See [references/playwright-e2e.md](references/playwright-e2e.md) for:

- Test structure and Page Object Model pattern
- Semantic locators (role, label, text — never CSS/XPath)
- Visual regression testing (screenshot comparison, maxDiffPixelRatio threshold)
- Accessibility testing (ARIA snapshots, axe-core)
- Authentication state reuse (save/restore storageState)
- Cross-browser testing (Chromium, Firefox, WebKit)
- CI integration with traces and screenshots on failure

### When to Use Playwright E2E

- New web feature with user-facing UI
- Login/auth flows
- Multi-step workflows (checkout, onboarding)
- Visual regression checks
- Accessibility audits

### Before Writing Any E2E Test

**Run the Playwright availability check** (see below). If Playwright is not available, report exactly what needs to be installed and stop — never silently skip E2E testing.

---

## Playwright Availability Check

**CRITICAL:** Before writing or running any Playwright-based E2E test, check for Playwright availability using the detection-then-fallback pattern in [references/playwright-availability-check.md](references/playwright-availability-check.md).

The check sequence:
1. **Try MCP first:** `ToolSearch` for Playwright-related MCP tools (prefer if available).
2. **Fall back to CLI:** If no MCP, try `npx playwright --version` (or `which playwright` on Unix).
3. **If neither found:** Report exactly what to install (`npm install -D @playwright/test && npx playwright install`) and **stop before writing any E2E tests**. Never assume Playwright is installed.

If the check fails, the report should be: "E2E testing needs Playwright installed. Run: `npm install -D @playwright/test && npx playwright install`."

---

## Best Practices

1. **Test real interactions:** Integration tests should exercise the full stack (routing, middleware, database, serialization), not just isolated business logic.

2. **Isolate test data:** Every test must be independent. Use transaction rollback, database reset, or container cleanup to ensure isolation.

3. **Semantic locators in Playwright:** Prefer `getByRole()`, `getByLabel()`, `getByText()` over CSS classes or XPath. This makes tests resilient to UI refactoring.

4. **Screenshot-only on failure:** Playwright should capture screenshots and traces only when tests fail, not for every test run (storage/performance).

5. **Port selection:** When spinning up full HTTP servers in tests, bind to `127.0.0.1:0` (random port) to avoid conflicts on CI servers running tests in parallel.

6. **Cleanup order:** Always clean up in reverse order of setup (databases after servers, etc.) to avoid orphaned connections.
