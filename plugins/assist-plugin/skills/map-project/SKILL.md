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

1. **Directory Structure:** Finds key folders (src, tests, config, docs)
2. **Technology Stack:** Detects language, framework, tools
3. **Module Organization:** Maps package/module structure
4. **Dependencies:** Lists main dependencies (npm, cargo, go.mod, etc.)
5. **Entry Points:** Finds main, index, or start files
6. **Architecture Summary:** High-level design overview

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
