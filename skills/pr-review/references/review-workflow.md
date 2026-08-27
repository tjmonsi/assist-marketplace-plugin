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

Use the `reviewer` agent for deep analysis:

```bash
/do review PR #123
→ Routes to reviewer agent
→ Agent fetches details and changes
→ Agent analyzes for bugs, security, performance
→ Agent submits verdict
```

### Step 4: Submit Review

After analysis, submit verdict:

```bash
# Approve
/pr-review 123 --approve --message "Looks good, well tested!"

# Request changes
/pr-review 123 --changes-requested --message "See comments below"

# Comment only (no verdict)
/pr-review 123 --comment --message "Consider using pattern X here"
```

## Review Verdicts

### Approve ✓

**When:** Code is ready to merge

**Effect:**
- GitHub: PR marked as approved
- Bitbucket: PR marked as approved
- Counts toward merge requirements if configured

**Message example:**
```
Looks great! Tests are comprehensive, code is clean.
Ready to merge.
```

### Changes Requested 🔄

**When:** Code needs updates before merging

**Effect:**
- GitHub: Blocks merge until resolved (if configured)
- Bitbucket: Blocks merge until resolved
- Prevents auto-merge

**Message example:**
```
A few things to address:

1. The auth module needs refactoring (see line 42)
2. Add test for edge case (empty token)
3. Update the CHANGELOG entry

After fixes, I'll re-review.
```

### Comment Only 💬

**When:** Feedback but not blocking

**Effect:**
- No verdict submitted
- Leaves comment for visibility
- Does not block merge

**Message example:**
```
Nice refactoring! Wondering if we should also
update the similar pattern in the payment module?
Not required, just a thought.
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
→ You submit verdict
```

### Agent-Assisted Review

```bash
/do review PR #123
→ do skill invokes reviewer agent
→ reviewer fetches details via /pr-review
→ reviewer analyzes code
→ reviewer submits /pr-review 123 --approve (or changes-requested)
```

### Two-Stage Review

```
Stage 1: Quick feedback
/pr-review 123 --comment --message "Looks interesting, let me review more carefully"

Stage 2: Formal verdict
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

```bash
# View PR and diffs
gh pr view 123
gh pr diff 123

# Leave comment on specific commit
gh pr comment 123 --edit

# Request changes
gh pr review 123 --request-changes --body "See comments"

# Approve
gh pr review 123 --approve --body "Approved"

# Dismiss previous review
gh pr review 123 --dismiss --body "Reconsidering..."

# List all reviews
gh api repos/OWNER/REPO/pulls/123/reviews
```

## Bitbucket-Specific Workflow

```bash
# View PR
bkt pr get PROJECT/REPO/123

# List files changed
bkt pr diff PROJECT/REPO/123

# Leave comment
bkt pr comment PROJECT/REPO/123 --message "Feedback"

# Approve
bkt pr approve PROJECT/REPO/123

# Decline (request changes)
bkt pr decline PROJECT/REPO/123 --message "Needs work"

# List reviewers
bkt pr reviewers PROJECT/REPO/123
```

## Handling Review Disputes

**If author disagrees with feedback:**

1. **Discuss in PR comments** — Collaborate to find best solution
2. **Schedule sync** — For complex architectural decisions
3. **Escalate if needed** — Involve team lead or architecture group
4. **Document decision** — Add comment explaining final choice

**As a reviewer:**
- Be open to learning from author's perspective
- Distinguish between "must fix" and "nice to have"
- Admit when you're wrong
- Defer to domain expertise (e.g., author knows their service better)
