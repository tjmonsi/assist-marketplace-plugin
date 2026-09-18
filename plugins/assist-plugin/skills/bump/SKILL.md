---
name: bump
description: >-
  Semantic version bumping with automated changelog generation.
  Detects version files, determines bump type from commits or explicit input,
  updates versions, generates changelog, and commits with optional git tag.
effort: medium
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
argument-hint: "[patch | minor | major | auto] [--path PATH] [--no-tag] [--no-commit]"
---

# Bump

Manage semantic versioning and changelog generation for your project or submodules.

## Quick Start

```bash
/bump auto                    # Auto-detect bump type from commits
/bump minor                   # Explicit minor version bump
/bump major --path ./backend  # Major bump in backend subfolder
/bump patch --no-tag          # Patch bump without git tag
```

## How It Works

### 1. Version Detection

Searches for version in this priority order:
1. `package.json` (npm/Node.js)
2. `pyproject.toml` (Python poetry)
3. `Cargo.toml` (Rust)
4. `pubspec.yaml` (Dart)
5. `VERSION` file (single version file)
6. Latest git tag matching `v*` or `release-*`

### 2. Bump Type Determination

**Explicit mode:** Use provided bump type (patch/minor/major)

**Auto mode:** Parse commit history since last tag/version:
- `BREAKING CHANGE:` in commit body → **MAJOR**
- `feat:` prefix → **MINOR** (or MAJOR if breaking)
- `fix:` prefix or no prefix → **PATCH**
- No commits since last release → No bump (error)

### 3. Version Update

Updates all detected version files atomically:
- `package.json` → `version` field
- `pyproject.toml` → `version` in `[tool.poetry]`
- `Cargo.toml` → `version` in `[package]`
- `pubspec.yaml` → `version` field
- `VERSION` file → plain text version

### 4. Changelog Generation

Creates or updates `CHANGELOG.md` with:
- New version header (e.g., `## [1.2.0] - 2026-08-27`)
- Grouped commits:
  - `### Breaking Changes`
  - `### Features`
  - `### Bug Fixes`
  - `### Other`
- Link to compare view: `[1.2.0]: https://github.com/user/repo/compare/v1.1.0...v1.2.0`

### 5. Commit & Tag (optional)

- Commits with message: `chore: bump version to X.Y.Z`
- Tags with `vX.Y.Z` (or `release-X.Y.Z` if found in existing tags)
- Both commit and tag are optional via flags

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `patch` | Bump patch version (X.Y.+Z) | — |
| `minor` | Bump minor version (X.+Y.0) | — |
| `major` | Bump major version (+X.0.0) | — |
| `auto` | Auto-detect from commits | — |
| `--path PATH` | Path to project/subfolder | `.` (root) |
| `--no-tag` | Skip git tag creation | False (creates tag) |
| `--no-commit` | Skip git commit | False (creates commit) |
| `--no-changelog` | Skip changelog update | False (updates changelog) |

## Strategy Reference

See [references/bump-strategy.md](references/bump-strategy.md) for:
- Version file format details
- Conventional Commits parsing
- Changelog structure
- Edge case handling

## Constraints

- Requires git repository (checks for `.git/`)
- Requires clean working tree (no uncommitted changes)
- Requires at least one commit since last version/tag
- Cannot bump if current version matches HEAD tag (already released)
- Creates changelog in project root or `--path` directory

## Examples

**Auto-bump a backend service:**
```
/bump auto --path ./services/auth
```
→ Detects version from `./services/auth/package.json`
→ Parses commits since last tag in that subtree
→ Bumps version, updates `./services/auth/CHANGELOG.md`
→ Commits and tags at root level

**Manual patch bump without git operations:**
```
/bump patch --no-commit --no-tag
```
→ Bumps patch version in all detected files
→ Updates CHANGELOG.md
→ Exits without committing or tagging (for review first)

**Major version bump across monorepo:**
```
/bump major
```
→ Finds root `package.json`
→ Updates root version
→ Updates root CHANGELOG.md
→ Commits and tags at root

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
