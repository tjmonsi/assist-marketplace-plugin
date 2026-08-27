---
name: commit
description: >-
  Create conventional commits with git. Stages files, composes messages using
  conventional commits format, and supports squash/amend.
effort: low
allowed-tools:
  - Bash
argument-hint: "[--squash] [--amend] [--scope SCOPE] [TYPE: message]"
---

# Commit

Create conventional commits using the Conventional Commits format.

## Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` — A new feature
- `fix` — A bug fix
- `refactor` — Code change without feature/fix
- `docs` — Documentation changes
- `test` — Test changes
- `chore` — Maintenance, dependencies
- `perf` — Performance improvements
- `ci` — CI/CD changes

**Scope (optional):** Component or module affected

**Subject:** Imperative, present tense, no period (50 chars max)

## Examples

```
feat(auth): implement JWT-based authentication

fix(api): resolve null pointer in user endpoint

refactor(database): consolidate query builders

docs(readme): add installation instructions
```

## Options

- `--squash` — Squash commits before committing (clean history)
- `--amend` — Amend the last commit instead of creating new one
- `--scope SCOPE` — Specify scope for the commit

## Workflow

1. Stage your changes: `git add .`
2. Run `/commit`
3. Choose commit type and scope (if prompted)
4. Write commit message
5. Confirm and commit

## Constraints

- Always use Conventional Commits format
- Never commit without review (changes should be reviewed first)
- Keep messages concise and meaningful
- Link to issues/tickets in footer if applicable

