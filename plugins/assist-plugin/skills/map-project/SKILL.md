---
name: map-project
description: >-
  Discover repository structure. Identifies key directories, detects technology
  stack, maps module/package dependencies, and generates architecture summary.
effort: medium
allowed-tools:
  - Read
  - Glob
  - Bash
argument-hint: ""
---

# Map Project

Discover and document repository structure, technology stack, and module organization.

## What It Does

1. **Directory Structure** — Finds key folders (src, tests, config, docs)
2. **Technology Stack** — Detects language, framework, tools
3. **Module Organization** — Maps package/module structure
4. **Dependencies** — Lists main dependencies (npm, cargo, go.mod, etc.)
5. **Entry Points** — Finds main, index, or start files
6. **Architecture Summary** — High-level design overview

## Output

Generates `PROJECT_MAP.md` with:

```markdown
# Project Map

## Directory Structure

```
src/
  components/
  services/
  utils/
tests/
  unit/
  integration/
docs/
config/
```

## Technology Stack

- Language: TypeScript 5.0
- Framework: React 18
- Testing: Jest + Vitest
- Build: Vite
- Linter: ESLint

## Key Dependencies

- react: ^18.0
- react-dom: ^18.0
- typescript: ^5.0

## Entry Points

- Main: src/index.ts
- App: src/App.tsx

## Architecture

[State the organizing pattern found (e.g., layered, feature-folder, monorepo). State why it matters for someone changing code (where new code belongs, what depends on what). State any structural risk worth flagging, if one exists; omit this line otherwise.]
```

## Constraints

- Scan without writing unless user approves
- Identify but don't judge technologies
- Focus on structure, not code analysis

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

