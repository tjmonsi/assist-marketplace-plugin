# PR Review Workflow

Recommended workflow for reviewing pull requests with the `pr-review` skill.

## Pre-Review Checklist

Before submitting a review, check:

```
[ ] PR has clear title and description
[ ] No conflicts with base branch
[ ] CI/CD pipeline passed
[ ] Commits follow conventional commits
[ ] Code follows project conventions
[ ] No security vulnerabilities
[ ] Tests included for new code
[ ] Documentation updated
```

**GitHub:** Conflicts and CI status shown in PR view
**Bitbucket:** Use "Merge check" section

## Confirmation Gate (Required Before Any State Change)

`--approve`, `--changes-requested`, `--comment` (and their platform equivalents `gh pr review --request-changes`, `bkt pr approve`, `bkt pr comment`) change state visible to the whole team: they can unblock or block a merge and notify the author. **They are never executed without an explicit, affirmative confirmation from the human user in the current turn**, even when:

- the verdict flag (`--approve` / `--changes-requested` / `--comment`) was already supplied on the command line,
- the `reviewer` agent is fully confident in its own analysis,
- a previous PR in the same session was already confirmed (each PR/verdict needs its own confirmation).

**Protocol:**

1. **Analyze only.** Fetch PR details, diff, comments, and CI status. Do not run any command that mutates review state yet.
2. **Draft, don't post.** Compose the verdict and the exact comment body as plain text, e.g. *"Recommend approval because: tests cover the new branch, no security issues found, matches project conventions."* Write the draft body to a temp file (see [Injection-Safe Posting](#injection-safe-posting) below); do not post it anywhere yet.
3. **Present and ask.** Show the user the draft verdict and the exact text that would be posted, then ask directly: **"Do you approve this verdict? (yes/no)"**
4. **Wait for an explicit answer.** Only a clear affirmative ("yes", "approve it", "go ahead") counts as confirmation. Silence, an ambiguous reply, or the user changing the subject is **not** confirmation. Re-ask or treat it as "no" and take no action.
5. **Execute only after "yes".** Run the actual `gh pr review` / `bkt pr approve` / `bkt pr comment` command using the confirmed draft text (via `--body-file` / `--message-file`), unmodified from what the user saw.
6. **On "no" or requested edits:** revise the draft and return to step 3. Never execute the state-changing command as a fallback.

This gate applies to every run of `/pr-review`, standalone or with a flag supplied by an agent. A `/do review PR #123` run does not call this skill; `/do` shows the user the draft and asks for one confirmation before it posts (see [Agent-Assisted Review](#agent-assisted-review)).

### Injection-Safe Posting

Model-drafted or user-drafted review text must **never** be interpolated directly into a shell command string (e.g. `gh pr review 123 --body "$DRAFT"` or `bkt pr comment ... --message "$DRAFT"`). Arbitrary text can contain quotes, backticks, `$()`, `&&`, newlines, or other shell metacharacters that would be interpreted by the shell instead of treated as literal content.

Instead:

1. Write the confirmed draft text to a temp file (e.g. `/tmp/pr-review-body.txt`) using the Write tool, never via shell string concatenation.
2. Pass the file to the CLI with a file-based flag: `gh pr review 123 --body-file /tmp/pr-review-body.txt`, `bkt pr comment ... --message-file /tmp/pr-review-body.txt`.
3. If a given CLI/subcommand has no file-based flag, pass the text as a single argument through the tool's native argument array (not a shell string built by concatenation), so no shell re-parses its contents. Never hand-build a quoted string containing untrusted or model-generated content and execute it via a shell.
4. Delete or ignore the temp file after use; never reuse a stale draft file for a different PR or verdict.

## Review Workflow Steps

### Step 1: Fetch PR Information

```bash
/pr-review 123
```

Output shows:
- PR title, author, description
- Files changed (with +/- counts)
- Current reviewers and approval status
- Comments and existing reviews
- Build status (if available)

### Step 2: Review Changes

```bash
/pr-review 123 --diff
```

Shows:
- Diff for each file changed
- Statistics per file
- Highlights: added lines, removed lines, modified lines

### Step 3: Analyze Code

Use `/do` for deep analysis by the `reviewer` agent:

```bash
/do review PR #123
→ /do fetches the PR details and diff through Bash with gh, for a github.com remote
→ The read-only reviewer agent analyzes for bugs, security, performance
→ The reviewer agent drafts a verdict + rationale (posts nothing)
```

### Step 4: Confirm, Then Submit Review

Follow the [Confirmation Gate](#confirmation-gate-required-before-any-state-change) before running any of these. The commands below are the direct-run form of `/pr-review`: the skill presents the draft verdict and message, asks "Do you approve this verdict? (yes/no)", and only on "yes" runs the command, with the draft text passed via a temp file, never a raw quoted string. Under `/do`, for a `github.com` remote, `/do` shows the draft once and posts it with `gh pr review --repo 'github.com/<owner>/<repo>'` after the user confirms; it runs none of these `/pr-review` commands. For any other host, Bitbucket included, `/do` fails the step and the user runs `/pr-review` directly.

```bash
# Approve (message optional; confirmed with the user first)
/pr-review 123 --approve --message "Looks good, well tested!"

# Request changes (message shown to and confirmed by the user first)
/pr-review 123 --changes-requested --message "See comments below"

# Comment only (no verdict; exact text shown to the user first)
/pr-review 123 --comment --message "Consider using pattern X here"
```

The `--message` text above is the **confirmed draft**, not raw unreviewed model output; see [Injection-Safe Posting](#injection-safe-posting) for how it's carried from draft to the underlying `gh`/`bkt` call.

## Review Verdicts

### Approve ✓

**When:** Code is ready to merge

**Effect:**
- GitHub: PR marked as approved
- Bitbucket: PR marked as approved
- Counts toward merge requirements if configured

**Message example (zero findings is one line):**
```
Approve. No findings.
```

### Changes Requested 🔄

**When:** Code needs updates before merging

**Effect:**
- GitHub: Blocks merge until resolved (if configured)
- Bitbucket: posts a comment with the findings and leaves the PR open; declining the PR is a manual choice
- Prevents auto-merge

**Message example (each item as what happened, why it matters, what to do next):**
```
Request changes.

auth.ts:42 mixes token parsing and validation in one function, which hides which
step failed when a request is rejected. Split into parseToken() and validateToken().

auth.ts:57 lets an empty token pass validation, so unauthenticated requests get
through, and no test covers it. Reject empty tokens and add a test asserting it.

CHANGELOG.md has no entry for this change, so the release notes will miss it.
Add one under Unreleased before merge.
```

### Comment Only 💬

**When:** Feedback but not blocking

**Effect:**
- No verdict submitted
- Leaves comment for visibility
- Does not block merge

**Message example (what happened, why it matters, what to do next):**
```
payment.ts:88 has the same unhandled partial failure this PR fixes in retry.ts,
so it will hit the same bug under load. Not required for this PR; fix it in a
follow-up.
```

## Common Review Patterns

### Code Quality Review

```
Check for:
✓ Does it follow project conventions?
✓ Is the code clear and maintainable?
✓ Are there code smells (long methods, duplication)?
✓ Proper error handling?

Verdict: Changes Requested (if issues) or Approve (if clean)
```

### Security Review

```
Check for:
✓ No SQL injection vulnerabilities
✓ No hardcoded secrets or credentials
✓ Proper authentication/authorization checks
✓ Input validation and sanitization
✓ No command injection risks

Verdict: Changes Requested (if vulnerable) or Approve
```

### Performance Review

```
Check for:
✓ O(n) complexity acceptable?
✓ Any N+1 queries?
✓ Unnecessary allocations?
✓ Caching opportunities?

Verdict: Approve (if performant) or Changes Requested (if issues)
```

### API Contract Review

```
Check for:
✓ Backwards compatibility maintained?
✓ API versioning clear?
✓ Error responses well-defined?
✓ Rate limiting, pagination documented?

Verdict: Changes Requested (if breaking) or Approve
```

## Integration with Reviewer Agent

### Standalone Review

```bash
/pr-review 123
→ Shows PR info
→ You manually analyze
→ You draft a verdict
→ You confirm ("yes") before it's submitted
```

### Agent-Assisted Review

```bash
/do review PR #123
→ /do fetches the PR through Bash with gh, for a github.com remote (output redirected to a file, capped)
→ the read-only reviewer agent reads the file and drafts a verdict + message
→ /do shows the draft to the user and asks for one confirmation
→ user answers "yes"
→ only then: /do posts the confirmed draft with gh pr review --repo 'github.com/<owner>/<repo>' (no /pr-review call)
```

For any other host, Bitbucket included, `/do` fails the step and the user runs `/pr-review` directly; `/do` runs no Bitbucket command. The reviewer agent's own confidence is never sufficient. The user's confirmation of the draft `/do` shows is mandatory every time, before anything is posted. The direct `/pr-review` run keeps its own [Confirmation Gate](#confirmation-gate-required-before-any-state-change).

### Two-Stage Review

```
Stage 1: Quick feedback (still requires the user to see the exact text before posting)
/pr-review 123 --comment --message "Looks interesting, let me review more carefully"

Stage 2: Formal verdict (requires a fresh "yes" confirmation: Stage 1's
confirmation does not carry over)
/pr-review 123 --approve
```

## Best Practices

### 1. Be Constructive

```
❌ Bad: "This is wrong"
✅ Good: "Consider using Map here instead of Object for O(1) lookups"
```

### 2. Explain the Why

```
❌ Bad: "Add error handling"
✅ Good: "Add error handling for the case where the API returns 429; 
         currently we'd fail silently"
```

### 3. Reference Standards

```
✅ Good: "Let's follow the pattern from auth.ts (lines 42-58)"
✅ Good: "Per OWASP top 10, we need input validation here"
```

### 4. Suggest Solutions

```
❌ Bad: "This is slow"
✅ Good: "Consider caching the user object; we're fetching it 3 times per request.
         See cache.ts for our cache utilities"
```

### 5. Know When to Block

**Always block (Changes Requested):**
- Security vulnerabilities
- Breaking changes without justification
- Test failures
- Merge conflicts

**Often approve (Approve):**
- Minor naming improvements (can fix on next iteration)
- Non-critical refactorings
- Code style issues if linter isn't strict
- Questions that don't block functionality

## GitHub-Specific Workflow

All commands below that post text run only **after** the [Confirmation Gate](#confirmation-gate-required-before-any-state-change): the body text is a user-confirmed draft written to a temp file and passed via `--body-file`, never a raw quoted string built from model output (see [Injection-Safe Posting](#injection-safe-posting); a literal `--body "$DRAFT"` is unsafe because `$DRAFT` can contain quotes, backticks, `$()`, or other shell metacharacters).

```bash
# View PR and diffs
gh pr view 123
gh pr diff 123

# Leave comment on specific commit
gh pr comment 123 --edit

# Request changes (confirmed draft passed via --body-file)
gh pr review 123 --request-changes --body-file /tmp/pr-review-body.txt

# Approve (confirmed draft passed via --body-file)
gh pr review 123 --approve --body-file /tmp/pr-review-body.txt

# Dismiss previous review (also a state change: confirm first, then use --body-file)
gh pr review 123 --dismiss --body-file /tmp/pr-review-body.txt

# List all reviews
gh api repos/OWNER/REPO/pulls/123/reviews
```

## Bitbucket-Specific Workflow

Same rule applies: confirmed draft text goes to a temp file first, then a file-based flag (`--message-file`), never a raw quoted string built from model output.

```bash
# View PR
bkt pr get PROJECT/REPO/123

# List files changed
bkt pr diff PROJECT/REPO/123

# Leave comment (confirmed draft passed via --message-file)
bkt pr comment PROJECT/REPO/123 --message-file /tmp/pr-review-body.txt

# Approve: only after user confirmation
bkt pr approve PROJECT/REPO/123

# Request changes: Bitbucket has no blocking verdict here, so a confirmed
# changes-requested verdict posts a comment and leaves the PR open
# (declining the PR is a manual choice outside the skill)
bkt pr comment PROJECT/REPO/123 --message-file /tmp/pr-review-body.txt

# List reviewers
bkt pr reviewers PROJECT/REPO/123
```

## Handling Review Disputes

**If author disagrees with feedback:**

1. **Discuss in PR comments:** Collaborate to find best solution
2. **Schedule sync:** For complex architectural decisions
3. **Escalate if needed:** Involve team lead or architecture group
4. **Document decision:** Add comment explaining final choice

**As a reviewer:**
- Be open to learning from author's perspective
- Distinguish between "must fix" and "nice to have"
- Admit when you're wrong
- Defer to domain expertise (e.g., author knows their service better)
