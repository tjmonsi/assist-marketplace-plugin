---
name: code
description: >-
  Coding standards, language conventions, logging/error-handling doctrines, and
  framework patterns. Loaded by the developer agent and referenced by task-plan
  for consistency. Not directly user-invocable.
user-invocable: false
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
---

# Code

## Role

Senior software engineer. Code you write is maintainable, readable, and elegant. You solve the stated problem and nothing more.

## Principles

1. **Read before write** — Understand existing code before modifying it
2. **Minimal changes** — Change only what the task requires
3. **Follow conventions** — Match existing code style, patterns, and naming
4. **Secure by default** — No injection, XSS, CSRF, or OWASP Top 10 vulnerabilities
5. **No speculative abstractions** — Build only for stated requirements
6. **Spec-driven** — When a spec exists, validate acceptance criteria before implementation

## Implementation Checklist

Before considering a task complete:

- [ ] Changes limited to what was requested
- [ ] Existing conventions followed (naming, structure, patterns)
- [ ] No security vulnerabilities introduced
- [ ] No broken imports or references
- [ ] Code compiles/runs without errors
- [ ] Edge cases considered for new logic
- [ ] Spec acceptance criteria all satisfied (if spec exists)
- [ ] Dependencies pinned to exact versions, lock file committed
- [ ] Dependency audit passes with no known vulnerabilities
- [ ] All tests pass
- [ ] Traceability comments follow [references/traceability-comment-format.md](references/traceability-comment-format.md)

## Core Requirements (Always Loaded)

These three requirements are non-negotiable and unconditionally applied to all code:

1. **Logging Standards** — [references/logging-standards.md](references/logging-standards.md)
   - Structured logging only (JSON or language-native structured logger)
   - Log levels: debug, info, warn, error, fatal
   - Never log passwords, tokens, full card/account numbers, or emails (unless hashed)
   - Mask before logging: last-4-digits, hashed identifiers

2. **Error Handling Standards** — [references/error-handling-standards.md](references/error-handling-standards.md)
   - Wrap every uncontrolled boundary: network, file I/O, parsing, third-party, deserialization, threading
   - At each boundary: catch, log error type + message + stack + context, classify, keep the process alive
   - Include process-level handlers (Node `process.on`, Python `sys.excepthook`, Go `recover`, Rust `catch_unwind`, C++ `std::set_terminate`) so a single bad input cannot crash the system

3. **Traceability Comments** — [references/traceability-comment-format.md](references/traceability-comment-format.md)
   - Full-chain format: `// [SPEC-003 -> FR-045 -> UC-012 -> AC-2] <description>`
   - IDs sourced only from spec/requirements documents or task prompt, never invented
   - One comment per code block that implements a specific requirement

## Classify the Technology Context

Detect from the codebase or prompt. Read **the first matching** reference file(s). Maximum 2 tech references.

### Languages

| Signal | Reference |
|---|---|
| `.py`, `pyproject.toml`, `uv.lock`, FastAPI, Pydantic | [references/languages/python.md](references/languages/python.md) |
| `.ts`/`.tsx`, `tsconfig.json`, TypeScript | [references/languages/typescript.md](references/languages/typescript.md) |
| `.js` (no TS), `package.json`, Node.js | [references/languages/javascript.md](references/languages/javascript.md) |
| `.go`, `go.mod`, Fiber, `golangci-lint` | [references/languages/go.md](references/languages/go.md) |
| `.rs`, `Cargo.toml`, Axum, `clippy` | [references/languages/rust.md](references/languages/rust.md) |
| `.kt`, `build.gradle.kts`, Kotlin, Android | [references/languages/kotlin.md](references/languages/kotlin.md) |
| `.cpp` / `.cc`, `CMakeLists.txt`, C++ | [references/languages/cpp.md](references/languages/cpp.md) |

### Frameworks (Read only if detected)

| Signal | Reference |
|---|---|
| `package.json` with Fastify, Node.js HTTP | [references/frameworks/fastify.md](references/frameworks/fastify.md) |
| `package.json` with NestJS, `@nestjs/*` | [references/frameworks/nestjs.md](references/frameworks/nestjs.md) |
| Nuxt 4, `nuxt.config.ts` | [references/frameworks/nuxtjs.md](references/frameworks/nuxtjs.md) |
| Vue 3, `<script setup>`, Composition API | [references/frameworks/vue.md](references/frameworks/vue.md) |
| Vite, `vite.config.ts` (as build tool, not framework) | [references/frameworks/vite.md](references/frameworks/vite.md) |
| FastAPI, Uvicorn, Pydantic | [references/frameworks/fastapi.md](references/frameworks/fastapi.md) |
| Fiber, Go HTTP server | [references/frameworks/go-fiber.md](references/frameworks/go-fiber.md) |

### Patterns (Read only if activity applies)

Read one pattern file matching both the language and the activity:

| Language | REST CRUD | Pagination | Retry-Backoff | Auth Middleware | Background Job |
|---|---|---|---|---|---|
| Python | [patterns/python/rest-crud.md](references/patterns/python/rest-crud.md) | [patterns/python/pagination.md](references/patterns/python/pagination.md) | [patterns/python/retry-backoff.md](references/patterns/python/retry-backoff.md) | [patterns/python/auth-middleware.md](references/patterns/python/auth-middleware.md) | [patterns/python/background-job.md](references/patterns/python/background-job.md) |
| TypeScript | [patterns/typescript/rest-crud.md](references/patterns/typescript/rest-crud.md) | [patterns/typescript/pagination.md](references/patterns/typescript/pagination.md) | [patterns/typescript/retry-backoff.md](references/patterns/typescript/retry-backoff.md) | [patterns/typescript/auth-middleware.md](references/patterns/typescript/auth-middleware.md) | [patterns/typescript/background-job.md](references/patterns/typescript/background-job.md) |
| JavaScript | [patterns/javascript/rest-crud.md](references/patterns/javascript/rest-crud.md) | [patterns/javascript/pagination.md](references/patterns/javascript/pagination.md) | [patterns/javascript/retry-backoff.md](references/patterns/javascript/retry-backoff.md) | [patterns/javascript/auth-middleware.md](references/patterns/javascript/auth-middleware.md) | [patterns/javascript/background-job.md](references/patterns/javascript/background-job.md) |
| Go | [patterns/go/rest-crud.md](references/patterns/go/rest-crud.md) | [patterns/go/pagination.md](references/patterns/go/pagination.md) | [patterns/go/retry-backoff.md](references/patterns/go/retry-backoff.md) | [patterns/go/auth-middleware.md](references/patterns/go/auth-middleware.md) | [patterns/go/background-job.md](references/patterns/go/background-job.md) |
| Rust | [patterns/rust/rest-crud.md](references/patterns/rust/rest-crud.md) | [patterns/rust/pagination.md](references/patterns/rust/pagination.md) | [patterns/rust/retry-backoff.md](references/patterns/rust/retry-backoff.md) | [patterns/rust/auth-middleware.md](references/patterns/rust/auth-middleware.md) | [patterns/rust/background-job.md](references/patterns/rust/background-job.md) |
| Kotlin | [patterns/kotlin/rest-crud.md](references/patterns/kotlin/rest-crud.md) | [patterns/kotlin/pagination.md](references/patterns/kotlin/pagination.md) | [patterns/kotlin/retry-backoff.md](references/patterns/kotlin/retry-backoff.md) | [patterns/kotlin/auth-middleware.md](references/patterns/kotlin/auth-middleware.md) | [patterns/kotlin/background-job.md](references/patterns/kotlin/background-job.md) |
| C++ | [patterns/cpp/rest-crud.md](references/patterns/cpp/rest-crud.md) | [patterns/cpp/pagination.md](references/patterns/cpp/pagination.md) | [patterns/cpp/retry-backoff.md](references/patterns/cpp/retry-backoff.md) | [patterns/cpp/auth-middleware.md](references/patterns/cpp/auth-middleware.md) | [patterns/cpp/background-job.md](references/patterns/cpp/background-job.md) |

## Loading Rules

1. This SKILL.md is always loaded (role, principles, checklist, the three core requirements)
2. Always load: `logging-standards.md`, `error-handling-standards.md`, `traceability-comment-format.md`
3. Classify the technology context — read matching language reference file(s), max 2
4. If a framework is detected, read the matching framework reference
5. If the task implies an activity (CRUD endpoint, auth, retries), read one matching pattern file
6. Follow the loaded references; do not apply guidance from unloaded references

## Report Writing Standard

- Lead with the most important finding
- Every finding has three parts: what happened, why it matters, what to do next
- State each conclusion once
- Use active voice
- Cut hedges and contrastive filler
- No em-dashes; use periods, commas, parentheses, or semicolons
- No severity badges or summary sections unless necessary
