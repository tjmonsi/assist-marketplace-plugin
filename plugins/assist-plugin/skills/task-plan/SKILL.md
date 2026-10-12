---
name: task-plan
description: >-
  Validates specifications have acceptance criteria, then outputs ordered coding
  steps with file names, requirement IDs, and code skill references for the
  developer to implement.
effort: medium
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
argument-hint: "<spec-file-or-prompt> [target-language]"
---

# Task Plan

Plan the implementation of a feature by validating its specification and producing an ordered list of coding steps. Each step names the files to create/modify, the requirements it satisfies, and which `code` skill references apply.

## Routing

Parse input: target spec file path, optional target language (detected from codebase if omitted).

## Workflow

### 1. Validate Specification

Read the target spec file and check every `### Requirement:` block for at least one `#### Scenario:` subsection. If any requirement lacks scenarios (acceptance criteria), halt and report:

```
Specification incomplete: [Requirement block] has no scenarios.
Complete the acceptance criteria before planning.
File: [path]
Line: [N]
```

Reference: [references/validation-rules.md](references/validation-rules.md)

### 2. Classify Technology Context

Detect the target language from:
1. Explicit argument (if provided)
2. Codebase files (`.py`, `.ts`, `.go`, `.rs`, `.kt`, `.cpp`, etc.)
3. Spec's tech-context field (if present)
4. Prompt context

| Language | Signal |
|---|---|
| Python | `.py`, `pyproject.toml`, `uv.lock` |
| TypeScript | `.ts`, `tsconfig.json`, `.tsx` |
| JavaScript | `.js`, `package.json` (no TS) |
| Go | `.go`, `go.mod` |
| Rust | `.rs`, `Cargo.toml` |
| Kotlin | `.kt`, `build.gradle.kts` |
| C++ | `.cpp`, `.cc`, `CMakeLists.txt` |

### 3. Extract Requirements and Acceptance Criteria

From the spec, list:
- Each `SPEC-NNN` ID
- Each requirement's `FR-NNN`/`NFR-NNN` refs (if linked)
- Each `#### Scenario:` block's title

### 4. Plan Coding Steps

For each requirement, generate one or more steps. Each step:
- Names the file(s) to create or modify (relative paths, as they exist in the codebase)
- Cites the requirement IDs the step satisfies: `[SPEC-NNN]` or `[FR-NNN -> UC-NNN -> AC-N]` (full chain when applicable)
- Lists which `code` skill references apply: language, framework (if any), activity (if any), or pattern names

Example:
```markdown
### Step 1: User API endpoint
- **Files:** `src/api/users.ts`
- **Satisfies:** [SPEC-003 -> FR-045 -> UC-012 -> AC-1]
- **Code references:** `languages/typescript.md`, `frameworks/fastify.md`, `patterns/typescript/rest-crud-endpoint.md`
- **Notes:** Implement GET /users/:id with validation per the spec.
```

Order steps so:
- Core domain models and types are defined first
- API/interface definitions precede implementations
- Database setup precedes service code
- Services precede handlers/controllers
- Tests follow implementations (or align with them per TDD approach noted in the spec)

### 5. Output

Write `task-plan-[feature-slug]-[timestamp].md` using the template at [references/task-plan-template.md](references/task-plan-template.md).

The file is ready for the `developer` agent to follow: each step becomes one implementation task.

## Validation Gate

If spec validation fails (missing scenarios), output a report and stop. Do not proceed to planning.

## Constraints

- Never invent acceptance criteria or requirement IDs
- Every code reference cited must exist in the `code` skill
- File paths must match the target codebase structure (run `ls` / `find` to verify before citing)
- Do not estimate effort or timeline; steps are ordered, not sized
- Do not propose refactoring or cleanup steps; focus on the feature's requirements

## Report Writing Standard

- Put the answer or the most important finding first. No preamble, no restating the question, no closing recap.
- Let content set the length. Report a clean check in one line.
- Give each finding three parts: what happened, why it matters, what to do next.
- State each conclusion once. Open every paragraph with new information.
- Use active voice; put the important subject before the verb.
- Use plain words ("use" for "utilize"). Cut hedges, intensifiers, throat-clearing, buzzwords, and "not X but Y" framing; state what it is.
- Name headings after their content. Skip summary labels ("In conclusion", "Key takeaways"), severity badges, and summary sections unless the reader needs them.
- Write no em dashes (use a period, comma, colon, parentheses, or semicolon), no curly quotes, and no chatbot sign-offs or offers.
- Back every claim with evidence (file and line, log, test result, URL) and every number with a source; label estimates as estimates.
- Report tested results; never present the prompt or an assumption as fact.
- Quote exactly; never reword a quotation.
- Keep ticket ids and internal blame out of user-facing text.
