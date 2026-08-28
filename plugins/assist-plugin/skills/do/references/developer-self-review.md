# Developer Self-Review Checklist

Reference guide for developers to self-audit code before submitting for review.

## Purpose

Before submitting code for security and code review gates, developers self-review to catch obvious issues and improve initial quality. This step precedes the reviewer audit and iteration loop.

## Pre-Review Checklist

### Logic & Correctness

- [ ] Code does what it's supposed to do
- [ ] Edge cases handled (empty input, null, negative numbers, boundary conditions)
- [ ] Error paths tested (what happens on failure?)
- [ ] No infinite loops or unbounded recursion
- [ ] Off-by-one errors checked
- [ ] Async/concurrency issues reviewed (if applicable)

### OWASP Top 10 Compliance

- [ ] No injection vulnerabilities (SQL, command, script)
- [ ] Passwords hashed with strong algorithm (bcrypt, scrypt)
- [ ] Secrets not hardcoded (check env vars, config files)
- [ ] PII encrypted at rest and in transit
- [ ] No XXE vulnerabilities in XML parsing
- [ ] Access control checks before resource access
- [ ] User input sanitized and output encoded
- [ ] No unsafe deserialization of untrusted data
- [ ] Dependencies up-to-date and no known CVEs
- [ ] Security events logged (auth attempts, failures)

### Testing & Coverage

- [ ] New code has tests (>70% coverage)
- [ ] Happy path tested
- [ ] Error cases tested
- [ ] Edge cases tested
- [ ] Existing tests still pass (no regressions)

### Readability & Maintainability

- [ ] Variable/function names are clear (no `x`, `temp`, `data`)
- [ ] Functions do one thing (single responsibility)
- [ ] No deeply nested code (refactor if >3 levels)
- [ ] Comments explain WHY, not WHAT
- [ ] No dead code or commented-out lines
- [ ] Code follows project conventions
- [ ] Formatting consistent with codebase

### Performance

- [ ] No N+1 query patterns (database)
- [ ] Algorithms use efficient data structures
- [ ] No unnecessary loops or iterations
- [ ] Memory usage reasonable (no memory leaks)
- [ ] No polling loops when events/callbacks available

### Architecture & Best Practices

- [ ] Code aligns with project architecture
- [ ] No circular dependencies
- [ ] SOLID principles followed (where applicable)
- [ ] Design patterns used appropriately
- [ ] API contracts clear (if public function)
- [ ] Error messages helpful for debugging

### Git & Commits

- [ ] Commit messages clear and follow Conventional Commits
- [ ] Commits logically grouped (not one massive commit)
- [ ] No merge conflicts unresolved
- [ ] Branch rebased on latest main (if needed)

## Common Issues Caught in Self-Review vs. Reviewer Feedback

| Issue | Self-Review | Reviewer Feedback |
|-------|------------|-------------------|
| Logic errors | Caught more often (developer knows intent) | Caught if subtle |
| Test coverage | Developer should catch first | Reviewer ensures threshold |
| OWASP issues | Should catch obvious; missed on subtle injections | Reviewer specialist; catches all |
| Readability | Developer bias (code makes sense to them) | Reviewer catches confusing parts |
| Performance | May miss N+1 queries; optimization ideas | Reviewer spots inefficiencies |
| Architecture violations | Developer familiar; may not see drift | Reviewer enforces patterns |
| Naming | Developer satisfied; unclear to reader | Reviewer flags unclear names |

## Iteration Loop: Addressing Feedback

When reviewer requests changes:

1. **Identify root cause** — Is this a logic bug, readability issue, or OWASP gap?
2. **Fix in scope** — Address the feedback + any related issues you notice
3. **Re-self-review** — Re-check your own fixes before resubmitting
4. **Minimize iterations** — Each fix should address multiple feedback items where possible

**Goal:** Reduce iterations by catching issues early in self-review. Average code should pass in 2-3 iterations.

## Self-Review vs. Reviewer: Division of Labor

| Reviewer's Job | Your Job (Self-Review) |
|----------------|----------------------|
| Catch security issues | Eliminate obvious bugs |
| Enforce patterns | Ensure tests written |
| Architecture review | Check code readability |
| Line-by-line critique | Verify OWASP compliance |
| Scalability concerns | Optimize algorithms |
