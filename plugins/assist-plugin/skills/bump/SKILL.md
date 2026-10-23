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
argument-hint: "[patch | minor | major | auto] [--path PATH] [--no-tag] [--no-commit] [--no-changelog]"
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
6. Latest git tag matching `v*` or `release-*`. Under a `--path` below the root, the tag fallback reads the latest `<tagdir>-v*` tag (for example `services-auth-v*`) and ignores the root `v*` tags

### 2. Bump Type Determination

**Explicit mode:** Use provided bump type (patch/minor/major)

**Auto mode:** Parse commit history since last tag/version:
- `BREAKING CHANGE:` in commit body: **MAJOR**
- `feat:` prefix: **MINOR** (or MAJOR if breaking)
- `fix:` prefix or no prefix: **PATCH**
- No commits since last release: no bump (error)

### 3. Version Update

Resolves the changelog target first (see step 4), so a stop on the changelog leaves every version file unchanged. Then updates all detected version files atomically:
- `package.json`: `version` field
- `pyproject.toml`: `version` in `[tool.poetry]`
- `Cargo.toml`: `version` in `[package]`
- `pubspec.yaml`: `version` field
- `VERSION` file: plain text version

### 4. Changelog Generation

Skipped with `--no-changelog`. Resolves the target before any version file changes. The entry goes in place in the project root's or `--path` directory's `CHANGELOG.md`, with one exception: a pointer-only `CHANGELOG.md` sends the entry to the file it points to. A pointer has no `## [x.y.z]` heading and exactly one relative link to a local file; external links (such as `https://keepachangelog.com`) never count. The skill follows the link one hop only when the target is a file named `CHANGELOG.md` that resolves inside the git root, is not a hidden path, is not an auto-loaded file (`CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`), and is not itself a pointer. A file with release headings is never a pointer, and the pointer file gets no release heading.

On any other stop (two or more local links, a link to another file name, a target outside the git root, a hidden or auto-loaded target, or a pointer chain), write nothing, change no version file, and ask the user to choose one answer: write the entry in place, name another `CHANGELOG.md` that passes the same checks, or skip the changelog. Then continue the same run with the answer. A named target that fails the checks gets the same three answers again. A named target that passes and does not exist yet is created holding the release entry.

Creates or updates the target with:
- New version header (e.g., `## [1.2.0] - 2026-08-27`)
- Grouped commits:
  - `### Breaking Changes`
  - `### Features`
  - `### Bug Fixes`
  - `### Other`
- Link to compare view: `[1.2.0]: https://github.com/user/repo/compare/v1.1.0...v1.2.0`

### 5. Commit & Tag (optional)

- Commits with message: `chore: bump version to X.Y.Z`. Under a `--path` below the root, the message is `chore: bump <dir> to X.Y.Z`
- The message carries no AI attribution: no `Co-Authored-By` line for an AI tool and no "Generated with" line. Human co-authors are fine. The `commit-attribution-guard` hook denies a commit whose message holds such a line. When `attribution.commit` is unset or not `""`, Claude Code's instructions ask you to end the commit message with a Co-Authored-By trailer or a session link. Leave those lines out even then. If your instructions asked for such a line, tell the user once that `/assist-plugin:health` reports this setting and that `{"attribution": {"commit": "", "pr": ""}}` in their Claude Code settings turns it off. Never edit a settings file yourself.
- Tags with `vX.Y.Z` (or `release-X.Y.Z` if found in existing tags). Under a `--path` below the root, the tag is `<tagdir>-vX.Y.Z`
- `<dir>` is the `--path` value after it is normalized and validated, and only then named (see "`--path` validation" under Constraints). It is the path relative to the repository root with a leading `./` and a trailing `/` removed and `\` read as `/`. `<tagdir>` is `<dir>` with every `/` replaced by `-`. A `--path` that resolves to the repository root (`.`, `./`, or the root's own path) counts as no `--path`: the default names and the root tags apply
- Both commit and tag are optional via flags. `--no-commit` creates no tag, even without `--no-tag`

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `patch` | Bump patch version (X.Y.+Z) | None |
| `minor` | Bump minor version (X.+Y.0) | None |
| `major` | Bump major version (+X.0.0) | None |
| `auto` | Auto-detect from commits | None |
| `--path PATH` | Directory inside the repository, given as a relative path or an absolute path inside the git root; validated before it is used (see Constraints) | `.` (root) |
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
- Refuses only when a tag of the current version points at HEAD (`vX.Y.Z`, `release-X.Y.Z`, or `<tagdir>-vX.Y.Z` under a `--path` below the root): the version is already released. A tag on an older commit does not block the bump
- Checks the HEAD tag before the commits-since check, so a version released at HEAD reports "already released", not "No commits since version X.Y.Z"
- Requires at least one commit since last version/tag
- Creates changelog in project root or `--path` directory, or in the file a pointer-only `CHANGELOG.md` points to
- Never adds a `Co-Authored-By` trailer or other attribution line for an AI tool to the bump commit, the tag message, or the changelog
- The bump commit uses the developer's own git identity. Never set an AI identity through `git config user.name`/`user.email`, `--author`, or `-c user.name=` / `-c user.email=`; a drafted command that carries one drops the override and commits with the developer's identity

### `--path` validation

A `--path` value passes three ordered steps before the skill reads a version file or writes, commits, or tags anything. A value that breaks a rule stops the run with the message of that rule (R1 to R8), and nothing is changed. The raw `--path` text never reaches a shell command; only a value that passed checks 1 to 5 reaches one, as `<dir>`.

1. **Normalize.** Take the git root `R` from `git rev-parse --show-toplevel` (after the git-repository check) and treat it as text only. `R` is compared as text here and is never pasted into a command. Then work on the value as text:
   - Read every `\` as `/`.
   - Decide from that text, before removing anything, whether the value is absolute: it starts with `/`, or with a drive letter, `:`, and `/`. A lone `/` or `\` is absolute and names the file-system root.
   - A relative value loses one leading `./` and one trailing `/`. It counts as no `--path` when it is then empty or `.`.
   - An absolute value loses one trailing `/` only when more than the root part (`/`, or a drive letter, `:`, and `/`) remains, so `/` and `C:/` keep their slash. Then, in order: when it equals `R` it counts as no `--path`; when it starts with `R` followed by `/` the prefix is stripped and the value becomes root-relative (a drive letter compares without case), and it counts as no `--path` when it is then empty or `.` (so `<root>/.` and `<root>//` mean the root); any other absolute value, the file-system root included (unless `R` is that root), stops with R1.
   - No `--path` means the default names and root tags apply, and steps 2 and 3 are skipped.
2. **Validate**, in this order, on the text first and then on the file system:
   1. The value matches `^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$` (R2).
   2. No segment is `..` (R3).
   3. No segment matches `^\.+$`, so `.` and `...` are refused too (R4).
   4. No segment starts with `-` (R5).
   5. No segment starts with `.` or contains `..` (R8), so `.github` and `a..b` are refused. Such a segment would give an invalid git tag name, so the run stops before any file, commit, or tag changes.
   6. `test -d "$(git rev-parse --show-toplevel)/<dir>"` exits 0 (R6). The operand starts with the absolute root, so it cannot be read as an option and `test` needs no `--`.
   7. The output of `realpath -- "$(git rev-parse --show-toplevel)/<dir>"` starts with the output of `realpath -- "$(git rev-parse --show-toplevel)"` followed by `/` (R7), so a symlink that leaves the repository is refused. Compare the two printed lines as text.
   - Both commands read the git root only through the `$(git rev-parse --show-toplevel)` substitution inside double quotes. Never paste the root into a command: a root name that holds a quote, a `$`, a backtick, or a space then cannot break the quoting. The characters of a validated `<dir>` are all literal inside double quotes.
3. **Name.** `<dir>` is the validated value and `<tagdir>` is `<dir>` with every `/` replaced by `-`.

Only one leading `./` and one trailing `/` are removed, so `././x` fails R4 and `x//` fails R2. Each message names the rule, ends with "nothing was changed", and quotes no raw `--path` text except the validated `<dir>` of R6:

```text
R1  error: --path is an absolute path outside the git root; nothing was changed
R2  error: --path may hold only letters, digits, ".", "_", and "-" in segments joined by "/"; nothing was changed
R3  error: --path has a ".." segment; nothing was changed
R4  error: --path has a segment made only of dots; nothing was changed
R5  error: --path has a segment that starts with "-"; nothing was changed
R6  error: --path names no directory: <dir>; nothing was changed
R7  error: --path resolves outside the git root; nothing was changed
R8  error: --path has a segment that starts with "." or contains ".."; nothing was changed
```

## Examples

**Auto-bump a backend service:**
```
/bump auto --path ./services/auth
```
→ Detects version from `./services/auth/package.json`
→ Parses commits since last tag in that subtree
→ Bumps version, updates `./services/auth/CHANGELOG.md`
→ Commits `chore: bump services/auth to X.Y.Z` at the repository root
→ Tags `services-auth-vX.Y.Z`

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
