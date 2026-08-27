---
name: pr-review
description: >-
  Review pull requests with automatic platform detection (GitHub/Bitbucket).
  Fetches PR details, lists changed files, shows comments, and submits reviews
  with approval, changes-requested, or comment-only verdict.
effort: medium
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
argument-hint: "[PR#|branch-name] [--approve|--changes-requested|--comment] [--message TEXT]"
---

# PR Review

Review pull requests with intelligent platform detection and CLI automation.

## Quick Start

```bash
# Review PR #123 (auto-detects platform)
/pr-review 123

# Approve after reviewing
/pr-review 123 --approve

# Request changes
/pr-review 123 --changes-requested --message "Needs refactoring in auth module"

# Comment without verdict
/pr-review 123 --comment --message "Great work, consider adding tests"

# Review by branch name (if on feature branch)
/pr-review feature/user-auth --approve
```

## How It Works

### 1. Platform Detection

Automatically detects GitHub or Bitbucket from `git remote -v`:

```bash
# GitHub
git remote -v
→ origin  https://github.com/user/repo.git
→ Detected: GitHub, uses `gh` CLI

# Bitbucket Cloud
→ origin  https://bitbucket.org/user/repo.git
→ Detected: Bitbucket Cloud, uses `bkt` CLI

# Bitbucket Server/DC
→ origin  https://bitbucket.company.com/scm/repo/project.git
→ Detected: Bitbucket Server, uses custom SSH/HTTPS
```

### 2. PR Identification

Three ways to specify PR:

- **PR number:** `/pr-review 123` → Fetches GitHub/Bitbucket PR #123
- **Current branch:** `/pr-review` (no args) → Finds PR for current branch
- **Branch name:** `/pr-review feature/auth` → Finds PR for that branch

### 3. PR Information Fetched

- **Title, description, author, state**
- **Files changed** (with stats: +lines, -lines)
- **Comments** and existing reviews
- **Current reviewers** and approval status
- **Conflicts** (if any)

### 4. Review Submission

Submit review with one of three verdicts:

| Verdict | Command | Effect |
|---------|---------|--------|
| **Approve** | `--approve` | Marks PR approved, ready to merge |
| **Changes Requested** | `--changes-requested` | Blocks merge, requires changes |
| **Comment** | `--comment` | Leaves feedback, doesn't block |

Optional message: `--message "Your feedback here"`

## Commands by Platform

### GitHub (`gh` CLI)

```bash
# View PR
gh pr view 123

# List files changed
gh pr diff 123

# List reviews
gh api repos/{owner}/{repo}/pulls/123/reviews

# Submit review
gh pr review 123 --approve
gh pr review 123 --request-changes --body "Needs work"
gh pr review 123 --comment --body "Nice!"

# Comment on line (in diff)
gh pr review 123 --request-changes --comment-last
```

### Bitbucket (`bkt` CLI)

```bash
# View PR
bkt pr get <project>/<repo>/<id>

# List reviewers
bkt pr reviewers <project>/<repo>/<id>

# Approve
bkt pr approve <project>/<repo>/<id>

# Decline (request changes)
bkt pr decline <project>/<repo>/<id>

# Comment
bkt pr comment <project>/<repo>/<id> --message "Feedback"
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `PR#` | PR number (GitHub/Bitbucket) | Required (or use current branch) |
| `--approve` | Approve PR | — |
| `--changes-requested` | Request changes | — |
| `--comment` | Leave feedback only | — |
| `--message TEXT` | Review message | (empty if not provided) |
| `--diff` | Show file diff inline | False |
| `--no-comment` | Show PR info, don't submit review | False |

## Workflow Integration

Pair with `/do` orchestrator:

```
/do review PR #123
→ Routes to reviewer agent
→ reviewer invokes /pr-review 123 --no-comment
→ Fetches PR details and changes
→ reviewer analyzes code
→ reviewer submits verdict: /pr-review 123 --approve
```

Or standalone:

```
/pr-review 123
→ Fetches PR details
→ Shows files changed, comments, existing reviews
→ Waits for your decision
```

## Platform Detection Reference

See [references/pr-detection.md](references/pr-detection.md) for:
- GitHub URL patterns
- Bitbucket Cloud patterns
- Bitbucket Server/DC patterns
- SSH URL handling
- Fallback detection logic

## Review Workflow Reference

See [references/review-workflow.md](references/review-workflow.md) for:
- Pre-review checks (conflicts, build status)
- Common review patterns
- Comment best practices
- Approval gates
- Integration with CI/CD

## Constraints

- Requires `gh` CLI (GitHub) or `bkt` CLI (Bitbucket)
- Requires valid git remote configured
- Requires authentication to GitHub/Bitbucket
- Cannot review own PR (returns error)
- Cannot approve if already approved (optional override flag)
- Cannot request changes if already declined (optional override flag)
