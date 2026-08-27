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

[High-level description of how the project is organized]
```

## Constraints

- Scan without writing unless user approves
- Identify but don't judge technologies
- Focus on structure, not code analysis

