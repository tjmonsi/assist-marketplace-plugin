# Task Plan: [Feature Name]

**Target Language:** [e.g., TypeScript]  
**Target Framework:** [e.g., Fastify] (if applicable)  
**Generated:** [YYYY-MM-DD HH:MM:SS]

---

## Specification Summary

- **Spec ID:** [SPEC-NNN]
- **Linked Requirements:** [FR-NNN, NFR-MMM, ...]
- **Use Cases:** [UC-NNN, UC-MMM, ...]

One sentence summary of what the feature does.

---

## Acceptance Criteria

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| [Scenario title] | [condition] | [action] | [expected outcome] |

---

## Implementation Steps

### Step 1: [Brief title]

- **Files:** `path/to/file.ext` (create or modify)
- **Satisfies:** [SPEC-003 -> FR-045 -> UC-012 -> AC-1]
- **Code references:** `languages/[lang].md`, `frameworks/[framework].md`, `patterns/[lang]/[pattern].md`
- **Notes:** Brief description of what this step implements.

### Step 2: [Brief title]

- **Files:** `path/to/file.ext`, `another/file.ext`
- **Satisfies:** [SPEC-003 -> FR-045 -> UC-012 -> AC-2], [NFR-008 -> AC-1]
- **Code references:** `languages/[lang].md`, `patterns/[lang]/[pattern].md`
- **Notes:** What this step does and why.

[Continue for each step...]

---

## Ordering Rationale

- **Step 1-N:** Core types and models
- **Step N-N:** API routes and handlers
- **Step N-N:** Services and business logic
- **Step N:** Tests (unit + integration)

Each subsequent step can depend on previous steps' outputs.

---

## Notes for Developer

- Reference the `code` skill for language/framework conventions before implementing each step
- Load traceability comments per [references/traceability-comment-format.md](../../code/references/traceability-comment-format.md)
- Run code quality gates (linting, testing, security audit) at task completion
