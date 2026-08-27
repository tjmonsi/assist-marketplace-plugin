# Changelog Template

Template used by the `bump` skill to generate and update CHANGELOG.md files.

## Full Changelog Structure

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- [optional] List of features planned but not yet released

### Changed
- [optional] Changes to existing functionality

### Deprecated
- [optional] Features that will be removed in future versions

### Removed
- [optional] Features removed in this version

### Fixed
- [optional] Bug fixes in this version

### Security
- [optional] Security vulnerability fixes

## [1.2.0] - 2026-08-27

### Breaking Changes
- Removed deprecated LoginWidget class (#123)

### Features
- Add OAuth2 support for social login (#120)
- New `--config` flag for custom configuration (#121)

### Bug Fixes
- Fix null pointer in auth handler (#119)
- Resolve race condition in cache eviction (#118)

## [1.1.0] - 2026-08-10

### Features
- Add basic authentication with JWT tokens

## [1.0.0] - 2026-07-01

### Features
- Initial public release

[Unreleased]: https://github.com/user/repo/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/user/repo/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/user/repo/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/user/repo/releases/tag/v1.0.0
```

## Minimal Changelog (What `bump` Generates)

When `bump` creates a new release, it generates:

```markdown
# Changelog

## [1.2.0] - 2026-08-27

### Breaking Changes
- [List from commits]

### Features
- [List from commits]

### Bug Fixes
- [List from commits]

## [1.1.0] - 2026-08-10

### Features
- [From previous release]

[1.2.0]: https://github.com/user/repo/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/user/repo/compare/v1.0.0...v1.1.0
```

## Parsing Commits to Changelog

The `bump` skill groups commits by type:

| Commit Type | Changelog Section | Example |
|-------------|------------------|---------|
| `feat:` | Features | "Add OAuth2 support" |
| `fix:` | Bug Fixes | "Resolve null pointer" |
| `BREAKING CHANGE:` | Breaking Changes | "Remove deprecated API" |
| `perf:` | Performance | "Optimize query performance" |
| `refactor:` | Removed (or Other) | "Restructure auth module" |
| `docs:` | Removed (or Other) | "Update README" |
| `test:` | Removed (or Other) | "Add integration tests" |
| `chore:` | Removed (or Other) | "Update dependencies" |

## Formatting Rules

1. **Commit message** → Changelog entry
   ```
   feat(auth): add OAuth2 support
   → "Add OAuth2 support"
   ```

2. **Issue references preserved**
   ```
   fix(cache): resolve race condition (#118)
   → "Resolve race condition (#118)"
   ```

3. **Breaking change format**
   ```
   BREAKING CHANGE: Remove LoginWidget class
   → "Remove LoginWidget class"
   ```

4. **Multi-line entries**
   ```
   feat(api): add new endpoints
   
   - POST /auth/login
   - POST /auth/logout
   → "Add new endpoints" (body not included unless marked BREAKING)
   ```

## Date Format

- **Format:** `YYYY-MM-DD`
- **Example:** `2026-08-27`
- **Source:** Current date when `bump` runs

## Comparison Links

Generated at bottom of changelog (if git remote detected):

```markdown
[1.2.0]: https://github.com/user/repo/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/user/repo/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/user/repo/releases/tag/v1.0.0
```

**Platforms supported:**
- GitHub: `github.com/user/repo`
- GitLab: `gitlab.com/user/repo`
- Gitea: `gitea.com/user/repo`
- Custom: Falls back to remote URL parsing

## Unreleased Section

If `--keep-unreleased` flag used, `bump` preserves an `[Unreleased]` section:

```markdown
## [Unreleased]

### Added
- [anything you want for next release]

## [1.2.0] - 2026-08-27
```

Otherwise, unreleased section is removed when a new release is created.
