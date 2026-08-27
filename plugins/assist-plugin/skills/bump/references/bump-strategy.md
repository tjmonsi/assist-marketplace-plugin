# Bump Strategy Reference

Detailed reference for version detection, bumping, and changelog generation.

## Version File Detection

### Priority Order

The `bump` skill searches for version files in this order:

1. **package.json** (npm/Node.js/Yarn/pnpm)
   - Field: `version`
   - Format: `"version": "1.2.3"`

2. **pyproject.toml** (Python poetry)
   - Field: `[tool.poetry] version`
   - Format: `version = "1.2.3"`

3. **Cargo.toml** (Rust)
   - Field: `[package] version`
   - Format: `version = "1.2.3"`

4. **pubspec.yaml** (Dart/Flutter)
   - Field: `version`
   - Format: `version: 1.2.3`

5. **VERSION** file
   - Content: Plain text version only
   - Format: `1.2.3` (one per line, first is current)

6. **Git tags**
   - Pattern: `v*` or `release-*`
   - Latest tag is current version
   - Example: `v1.2.3` → version is 1.2.3

### Multiple Version Files

If multiple files exist, `bump` updates ALL of them atomically. If they conflict, operation fails with error.

## Semantic Versioning Rules

**Format:** `MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]`

- **MAJOR** (X.0.0) — Breaking changes, incompatible API changes
- **MINOR** (0.X.0) — New features, backwards-compatible
- **PATCH** (0.0.X) — Bug fixes, backwards-compatible

**Examples:**
- `1.0.0` → `1.1.0` (minor: new feature)
- `1.0.0` → `2.0.0` (major: breaking change)
- `1.0.0` → `1.0.1` (patch: bug fix)
- `1.0.0-alpha.1` → `1.0.0` (release candidate to stable)

## Commit Parsing (Auto Mode)

### Conventional Commits Format

The `bump` skill uses **Conventional Commits** to auto-detect bump type:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat:` — New feature → **MINOR** bump
- `fix:` — Bug fix → **PATCH** bump
- `refactor:`, `style:`, `docs:`, `test:` — No version bump (or PATCH if significant)
- `perf:` — Performance improvement → **PATCH** or **MINOR**

**Breaking Changes:**
- If **any** commit includes `BREAKING CHANGE:` in body → **MAJOR** bump
- If **any** commit includes `!` after type (e.g., `feat!:`) → **MAJOR** bump

### Detection Algorithm

```
since_last_version = commits since last git tag / version file
has_breaking_change = any commit has "BREAKING CHANGE:" or "!"
has_feature = any commit starts with "feat:"

if has_breaking_change:
  bump_type = MAJOR
elif has_feature:
  bump_type = MINOR
else:
  bump_type = PATCH
```

**Example:**
```
commit 1: fix: resolve null pointer in auth handler
commit 2: feat: add OAuth2 support
commit 3: BREAKING CHANGE: remove deprecated LoginWidget class

→ has_breaking_change = True
→ bump_type = MAJOR
```

### No Commits Since Last Release

If HEAD points to a version tag or no commits exist since last version:
```
error: No commits since version X.Y.Z; nothing to bump
```

Resolution: Make commits before bumping.

## Changelog Format

The `bump` skill generates changelogs in this format:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.2.0] - 2026-08-27

### Breaking Changes
- Removed deprecated LoginWidget class

### Features
- Add OAuth2 support for social login
- New `--config` flag for custom configuration

### Bug Fixes
- Fix null pointer in auth handler
- Resolve race condition in cache eviction

### Other
- Update dependencies to latest versions
- Refactor database connection pooling

## [1.1.0] - 2026-08-10

### Features
- Add basic authentication

...

[1.2.0]: https://github.com/user/repo/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/user/repo/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/user/repo/releases/tag/v1.0.0
```

### Sections

- **Breaking Changes** — Commits with `BREAKING CHANGE:` (MAJOR)
- **Features** — Commits with `feat:` prefix (MINOR)
- **Bug Fixes** — Commits with `fix:` prefix (PATCH)
- **Other** — Other commits (refactor, style, docs, perf, etc.)

### Comparison Links

Automatically generated at bottom:
- Format: `[X.Y.Z]: https://github.com/owner/repo/compare/vA.B.C...vX.Y.Z`
- Requires: Git remote `origin` to be GitHub/GitLab
- Fallback: Links omitted if remote detection fails

## Workflow Example

**Scenario:** Bump assist-plugin from 1.0.0 → 1.1.0

```bash
# Commits since v1.0.0:
# • feat: add model override mechanism (MINOR)
# • fix: remove dead references (PATCH)
# • docs: update SPECIFICATION (no bump)

/bump auto
→ has_feature = True, no BREAKING CHANGE
→ bump_type = MINOR
→ new version = 1.1.0

# Updated files:
✅ .claude-plugin/plugin.json: version = 1.1.0
✅ CHANGELOG.md: new [1.1.0] section added
✅ Git commit: "chore: bump version to 1.1.0"
✅ Git tag: "v1.1.0"
```

## Edge Cases & Errors

### Current Version Already Released

```
error: Version 1.0.0 already has a tag (v1.0.0)
→ Cannot bump: version already released
→ Resolve: Check git log; either delete tag or update version files
```

### Working Tree Not Clean

```
error: Uncommitted changes detected
→ Cannot bump: would lose work
→ Resolve: Commit or stash changes first
```

### No Version File Found

```
error: No version file found in [package.json, pyproject.toml, ...]
→ Cannot detect current version
→ Resolve: Create a VERSION file or package.json with version field
```

### Conflicting Versions

```
error: Version mismatch: package.json=1.0.0, Cargo.toml=1.1.0
→ Cannot update atomically
→ Resolve: Align all version files before bumping
```

### Private Git Repository

```
warning: Cannot generate comparison links (remote is not public GitHub/GitLab)
→ Changelog generated without links
→ Continue? (yes/no)
```

## Shell Commands Used

The `bump` skill uses these shells commands internally:

```bash
# Detect version
grep '"version"' package.json | sed 's/.*: "\([^"]*\)".*/\1/'
git describe --tags --abbrev=0  # Last tag

# Parse commits
git log v1.0.0..HEAD --format="%s"

# Update version
sed -i.bak 's/"version": "[^"]*"/"version": "1.1.0"/' package.json

# Create commit and tag
git add -A
git commit -m "chore: bump version to 1.1.0"
git tag -a v1.1.0 -m "Release version 1.1.0"
```

## Subproject Bumping

When using `--path ./subproject`:

1. Searches for version files **within** `./subproject/`
2. Parses git commits affecting **only** `./subproject/` (git diff + log)
3. Updates versions in `./subproject/`
4. Creates `./subproject/CHANGELOG.md`
5. **Commits at root level** (not inside subproject)
6. Tags at root: `subproject-v1.1.0` or `v1.1.0-subproject`

**Example:**
```bash
/bump minor --path ./services/auth

→ Searches: ./services/auth/{package.json,Cargo.toml,...}
→ Found: ./services/auth/Cargo.toml with version 1.0.0
→ Commits affecting ./services/auth/: 3
→ Auto-detected: minor (has feat commits)
→ New version: 1.1.0
→ Updates: ./services/auth/Cargo.toml + ./services/auth/CHANGELOG.md
→ Commits: "chore: bump services/auth to 1.1.0"
→ Tags: "services-auth-v1.1.0"
```

