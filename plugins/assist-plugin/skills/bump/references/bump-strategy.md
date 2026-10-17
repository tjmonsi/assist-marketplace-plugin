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
   - Example: `v1.2.3` means version 1.2.3

### Multiple Version Files

If multiple files exist, `bump` updates ALL of them atomically. If they conflict, operation fails with error.

## Semantic Versioning Rules

**Format:** `MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]`

- **MAJOR** (X.0.0): Breaking changes, incompatible API changes
- **MINOR** (0.X.0): New features, backwards-compatible
- **PATCH** (0.0.X): Bug fixes, backwards-compatible

**Examples:**
- `1.0.0` to `1.1.0` (minor: new feature)
- `1.0.0` to `2.0.0` (major: breaking change)
- `1.0.0` to `1.0.1` (patch: bug fix)
- `1.0.0-alpha.1` to `1.0.0` (release candidate to stable)

## Commit Parsing (Auto Mode)

### Conventional Commits Format

The `bump` skill uses **Conventional Commits** to auto-detect bump type:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat:` (new feature): **MINOR** bump
- `fix:` (bug fix): **PATCH** bump
- `refactor:`, `style:`, `docs:`, `test:` need no version bump (or PATCH if significant)
- `perf:` (performance improvement): **PATCH** or **MINOR**

**Breaking Changes:**
- If **any** commit includes `BREAKING CHANGE:` in body, the bump is **MAJOR**
- If **any** commit includes `!` after type (e.g., `feat!:`), the bump is **MAJOR**

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

If no commits exist since the last version:
```
error: No commits since version X.Y.Z; nothing to bump
```

Resolution: Make commits before bumping. A tag of the current version at HEAD is a different case: see "Current Version Already Released".

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

- **Breaking Changes**: Commits with `BREAKING CHANGE:` (MAJOR)
- **Features**: Commits with `feat:` prefix (MINOR)
- **Bug Fixes**: Commits with `fix:` prefix (PATCH)
- **Other**: Other commits (refactor, style, docs, perf, etc.)

### Comparison Links

Automatically generated at bottom:
- Format: `[X.Y.Z]: https://github.com/owner/repo/compare/vA.B.C...vX.Y.Z`
- Requires: Git remote `origin` to be GitHub/GitLab
- Fallback: Links omitted if remote detection fails

## Workflow Example

**Scenario:** Bump assist-plugin from 1.0.0 to 1.1.0

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
✅ package.json: version = 1.1.0
✅ CHANGELOG.md: new [1.1.0] section added
✅ Git commit: "chore: bump version to 1.1.0"
✅ Git tag: "v1.1.0"
```

## Edge Cases & Errors

### Current Version Already Released

```
error: Version 1.0.0 is already released (tag v1.0.0 points at HEAD)
→ Cannot bump: version already released
→ Resolve: Check git log; either delete tag or update version files
```

The skill refuses only when a tag of the current version points at HEAD: `vX.Y.Z`, `release-X.Y.Z`, or `<tagdir>-vX.Y.Z` under a `--path` below the root. A tag of that version on an older commit does not block the bump. This check runs before the commits-since check, so a version released at HEAD reports "already released", not "No commits since version X.Y.Z".

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
git describe --tags --abbrev=0  # Last tag; under --path add --match '<tagdir>-v*'

# Parse commits
git log v1.0.0..HEAD --format="%s"

# Update version
sed -i.bak 's/"version": "[^"]*"/"version": "1.1.0"/' package.json

# Create commit and tag
git add -A
git commit -m "chore: bump version to 1.1.0"
git tag -a v1.1.0 -m "Release version 1.1.0"
```

The commit message and tag message carry no AI attribution: no `Co-Authored-By` trailer for an AI tool, no "Generated with" line, no `Assisted-by` or session trailer. Human co-authors are fine. The `commit-attribution-guard` hook denies a `git commit` whose message holds such a line; it does not check `git tag`, so keep the tag message free of attribution as well.

## Subproject Bumping

When using `--path ./subproject`:

1. Searches for version files **within** `./subproject/`
2. Parses git commits affecting **only** `./subproject/` (git diff + log)
3. Updates versions in `./subproject/`
4. Writes the changelog entry in `./subproject/CHANGELOG.md`. A pointer-only `CHANGELOG.md` (no `## [x.y.z]` heading and exactly one relative link to a local file) sends the entry one hop to the file it points to, when that file is named `CHANGELOG.md`, resolves inside the git root, is not hidden, is not `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md`, and is not itself a pointer. On any other stop, the skill asks: write in place, name another `CHANGELOG.md` that passes the same checks, or skip the changelog, then continues the same run
5. **Commits at root level** (not inside subproject): `chore: bump <dir> to X.Y.Z`
6. Tags at root: `<tagdir>-vX.Y.Z`, where `<dir>` is the path relative to the repository root (leading `./` and trailing `/` removed, `\` read as `/`) and `<tagdir>` is `<dir>` with every `/` replaced by `-`. `--no-commit` creates no tag

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

