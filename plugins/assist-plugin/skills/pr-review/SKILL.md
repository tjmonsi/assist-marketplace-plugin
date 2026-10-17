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

> **Note:** Passing `--approve` or `--changes-requested` states your *intended* verdict: it does not skip confirmation. The skill still fetches the PR, drafts the verdict text, and asks "Do you approve this verdict? (yes/no)" before running any state-changing command. See [Review Submission](#4-review-submission-confirmation-required) below.

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
→ origin  https://bitbucket.example.net/scm/repo/project.git
→ Detected: Bitbucket Server, uses custom SSH/HTTPS
```

### 2. PR Identification

Three ways to specify PR:

- **PR number:** `/pr-review 123`: Fetches GitHub/Bitbucket PR #123
- **Current branch:** `/pr-review` (no args): Finds PR for current branch
- **Branch name:** `/pr-review feature/auth`: Finds PR for that branch

### 3. PR Information Fetched

- **Title, description, author, state**
- **Files changed** (with stats: +lines, -lines)
- **Comments** and existing reviews
- **Current reviewers** and approval status
- **Conflicts** (if any)

### 4. Review Submission (Confirmation Required)

`--approve`, `--changes-requested`, and `--comment` are **state-changing commands and are never executed automatically**, not even when the flag was passed on the command line, and not even when the `reviewer` agent drafted the verdict itself. The skill always pauses for explicit human confirmation before running them:

1. Fetch the PR and analyze it (read-only; no state-changing command runs yet).
2. Draft the verdict and reasoning as plain text, e.g. *"Recommend approval because: tests cover the new branch, no security issues found, matches project conventions."*
3. Present the draft verdict to the user (for changes-requested/comment, include the exact comment body) and ask: **"Do you approve this verdict? (yes/no)"**
4. Only on an explicit "yes" (or clear affirmative) does the skill run the actual `gh pr review <n> --approve` / `--request-changes` / `--comment` (or `bkt pr approve` / `bkt pr comment`) command. On Bitbucket a confirmed `--changes-requested` posts a comment with the findings through `bkt pr comment --message-file` and leaves the PR open. Declining a PR is a manual choice outside the verdict mapping.
5. On "no", or if the user requests edits, revise the draft and re-confirm. Never fall back to executing the command anyway.

| Verdict | Command | Effect | Requires Confirmation? |
|---------|---------|--------|--------------------------|
| **Approve** | `--approve` | Marks PR approved, ready to merge | Yes, always, before every execution |
| **Changes Requested** | `--changes-requested` | GitHub: blocks merge, requires changes. Bitbucket: posts a comment and leaves the PR open | Yes, always, before every execution |
| **Comment** | `--comment` | Leaves feedback, doesn't block | Yes; user must see the exact text before it's posted |

Optional message: `--message "Your feedback here"` is treated as a **draft** to confirm, never auto-posted. Draft text is written to a temp file and passed to the CLI via `--body-file` / `--message-file`. It is never interpolated directly into a shell command string. See [references/review-workflow.md](references/review-workflow.md) for the full confirmation flow and injection-safe posting mechanics.

## Commands by Platform

### GitHub (`gh` CLI)

```bash
# View PR
gh pr view 123

# List files changed
gh pr diff 123

# List reviews
gh api repos/{owner}/{repo}/pulls/123/reviews

# Submit review: only after the user confirms the draft verdict (see step 4 above).
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

# Approve: only after the user confirms the draft verdict (see step 4 above)
bkt pr approve <project>/<repo>/<id>

# Comment (also the Bitbucket form of a changes-requested verdict; the PR stays
# open): only after the user confirms the draft verdict. Draft body text is
# written to a temp file first; never interpolate model output directly into
# the command string.
bkt pr comment <project>/<repo>/<id> --message-file /tmp/pr-review-body.txt
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `PR#` | PR number (GitHub/Bitbucket) | Required (or use current branch) |
| `--approve` | Approve PR (requires user confirmation of drafted verdict before executing) | None |
| `--changes-requested` | Request changes (requires user confirmation of drafted verdict before executing) | None |
| `--comment` | Leave feedback only (requires user to see exact text before posting) | None |
| `--message TEXT` | Review message | (empty if not provided) |
| `--diff` | Show file diff inline | False |
| `--no-comment` | Show PR info, don't submit review | False |

## Workflow Integration

Pair with `/do` orchestrator. `/do` does not call `/pr-review` in this flow:

```
/do review PR #123
→ /do fetches the PR through Bash with gh, for a github.com remote (output redirected to a file, capped)
→ the read-only reviewer agent reads that file and drafts a verdict + rationale
→ /do shows the draft to the user and asks for one confirmation
→ user confirms "yes"
→ only now does /do post the confirmed draft with gh pr review --repo 'github.com/<owner>/<repo>'
```

The `reviewer` agent only drafts text; `/do` fetches the PR and posts the confirmed draft. The `/do` flow supports `github.com` remotes only and runs no Bitbucket command. For any other host, Bitbucket included, `/do` fails the step and tells the user to run `/pr-review` directly. Confirmation from the user is required every time, regardless of how confident the analysis is. The full flow is in `skills/do/references/pr-review-flow.md`.

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
- **Never executes `--approve`, `--changes-requested`, `--comment` (or `bkt pr approve` / `bkt pr comment`) without explicit user confirmation of the drafted verdict:** applies even when the `reviewer` agent drafted the verdict or the flag was pre-supplied on the command line
- **Never interpolates model-generated text directly into a shell command.** Draft body/message text is written to a temp file and passed via `--body-file` / `--message-file` (or the closest equivalent flag); see [references/review-workflow.md](references/review-workflow.md)

## Review Output Rules

Drafted verdicts and review comments follow [Review Output Rules](../do/references/review-protocol.md#review-output-rules): verdict or first finding first, length set by findings, every finding re-read at its file and line before reporting, only new or still-open findings on a re-review (read the PR's existing reviews first), no praise or generic advice, and one line of agreement instead of reposting another reviewer's point.

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
