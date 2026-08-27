---
name: pr-review
description: >-
  Review pull requests with automatic platform detection (GitHub/Bitbucket).
  Fetches PR details, lists changed files, shows comments, and submits reviews
  with approval, changes-requested, or comment-only verdict.
effort: medium
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
  - AskUserQuestion
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

> **Note:** Passing `--approve` or `--changes-requested` states your *intended* verdict — it does not skip confirmation. The skill still fetches the PR, drafts the verdict text, and asks "Do you approve this verdict? (yes/no)" before running any state-changing command. See [Review Submission](#4-review-submission-confirmation-required) below.

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

### 4. Review Submission (Confirmation Required)

`--approve` and `--changes-requested` are **state-changing commands and are never executed automatically** — not even when the flag was passed on the command line, and not even when the `reviewer` agent decided the verdict itself. The skill always pauses for explicit human confirmation before running them:

1. Fetch the PR and analyze it (read-only; no state-changing command runs yet).
2. Draft the verdict and reasoning as plain text, e.g. *"Recommend approval because: tests cover the new branch, no security issues found, matches project conventions."*
3. Present the draft verdict — and, for changes-requested/comment, the exact comment body — to the user and ask: **"Do you approve this verdict? (yes/no)"**
4. Only on an explicit "yes" (or clear affirmative) does the skill run the actual `gh pr review <n> --approve` / `--request-changes` (or `bkt pr approve` / `bkt pr decline`) command.
5. On "no", or if the user requests edits, revise the draft and re-confirm. Never fall back to executing the command anyway.

| Verdict | Command | Effect | Requires Confirmation? |
|---------|---------|--------|--------------------------|
| **Approve** | `--approve` | Marks PR approved, ready to merge | Yes — always, before every execution |
| **Changes Requested** | `--changes-requested` | Blocks merge, requires changes | Yes — always, before every execution |
| **Comment** | `--comment` | Leaves feedback, doesn't block | Yes — user must see the exact text before it's posted |

Optional message: `--message "Your feedback here"` is treated as a **draft** to confirm, never auto-posted. Draft text is written to a temp file and passed to the CLI via `--body-file` / `--message-file` — it is never interpolated directly into a shell command string. See [references/review-workflow.md](references/review-workflow.md) for the full confirmation flow and injection-safe posting mechanics.

## Commands by Platform

### GitHub (`gh` CLI)

```bash
# View PR
gh pr view 123

# List files changed
gh pr diff 123

# List reviews
gh api repos/{owner}/{repo}/pulls/123/reviews

# Submit review — only after the user confirms the draft verdict (see step 4 above).
# Draft body text is written to a temp file first; never interpolate model output
# directly into the command string.
gh pr review 123 --approve
gh pr review 123 --request-changes --body-file /tmp/pr-review-body.txt
gh pr review 123 --comment --body-file /tmp/pr-review-body.txt

# Comment on line (in diff)
gh pr review 123 --request-changes --comment-last
```

### Bitbucket (`bkt` CLI)

```bash
# View PR
bkt pr get <project>/<repo>/<id>

# List reviewers
bkt pr reviewers <project>/<repo>/<id>

# Approve — only after the user confirms the draft verdict (see step 4 above)
bkt pr approve <project>/<repo>/<id>

# Decline (request changes) — only after the user confirms the draft verdict.
# Draft body text is written to a temp file first; never interpolate model
# output directly into the command string.
bkt pr decline <project>/<repo>/<id> --message-file /tmp/pr-review-body.txt

# Comment
bkt pr comment <project>/<repo>/<id> --message-file /tmp/pr-review-body.txt
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `PR#` | PR number (GitHub/Bitbucket) | Required (or use current branch) |
| `--approve` | Approve PR (requires user confirmation of drafted verdict before executing) | — |
| `--changes-requested` | Request changes (requires user confirmation of drafted verdict before executing) | — |
| `--comment` | Leave feedback only (requires user to see exact text before posting) | — |
| `--message TEXT` | Review message | (empty if not provided) |
| `--diff` | Show file diff inline | False |
| `--no-comment` | Show PR info, don't submit review | False |

## Workflow Integration

Pair with `/do` orchestrator:

```
/do review PR #123
→ Routes to reviewer agent
→ reviewer invokes /pr-review 123 --no-comment
→ Fetches PR details and changes (read-only)
→ reviewer analyzes code and drafts a verdict + rationale
→ reviewer presents the draft to the user: "Do you approve this verdict? (yes/no)"
→ user confirms "yes"
→ only now does reviewer submit: /pr-review 123 --approve
```

The reviewer agent never submits `--approve` or `--changes-requested` on its own judgment alone — confirmation from the user is required every time, regardless of how confident the analysis is.

Or standalone:

```
/pr-review 123
→ Fetches PR details
→ Shows files changed, comments, existing reviews
→ Drafts a verdict and asks: "Do you approve this verdict? (yes/no)"
→ Waits for your explicit confirmation before submitting anything
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
- Confirmation gate (required before `--approve` / `--changes-requested`) and injection-safe posting
- Integration with CI/CD

## Constraints

- Requires `gh` CLI (GitHub) or `bkt` CLI (Bitbucket)
- Requires valid git remote configured
- Requires authentication to GitHub/Bitbucket
- Cannot review own PR (returns error)
- Cannot approve if already approved (optional override flag)
- Cannot request changes if already declined (optional override flag)
- **Never executes `--approve`, `--changes-requested` (or `bkt pr approve` / `bkt pr decline`) without explicit user confirmation of the drafted verdict** — applies even when invoked by the `reviewer` agent or with the flag pre-supplied on the command line
- **Never interpolates model-generated text directly into a shell command.** Draft body/message text is written to a temp file and passed via `--body-file` / `--message-file` (or the closest equivalent flag); see [references/review-workflow.md](references/review-workflow.md)
