# Test Report Template

Template for consolidated test execution reports.

---

## Report Structure

```markdown
# Test Report: [Feature or Component Name]

**Date:** YYYY-MM-DD
**Project:** [project name]
**Language:** [Python/TypeScript/Go/Rust/Kotlin]
**Framework:** [pytest/vitest/jest/Go test/cargo test/JUnit5]

## Verdict

PASS | FAIL | NEEDS ATTENTION

## Summary

[2-3 sentences: what was tested, test environment, overall assessment]

## What Was Tested

- Test suite: [name and scope]
- Environment: [Node 18.2, Python 3.11, Go 1.21, etc.]
- Configuration: [pytest.ini, jest.config.js, etc.]
- Total tests: [N]

## Test Results

| Category | Passed | Failed | Skipped | Total |
|----------|--------|--------|---------|-------|
| Unit tests | N | N | N | N |
| Integration tests | N | N | N | N |
| E2E tests | N | N | N | N |
| **Total** | **N** | **N** | **N** | **N** |

## Coverage

- **Line coverage:** X% (target: >=70%)
- **Branch coverage:** X% (target: none, secondary)
- **Coverage status:** [✓ Met target | ⚠ Below target by X%]

### Uncovered critical paths

[If below 70%, list high-risk uncovered areas]
- Error handlers in auth.ts: 12 lines uncovered (lines 45-57)
- Validation in models.py: 8 lines uncovered (lines 23, 45-51)

## Test Failures

[Only if failures exist; omit section if all tests pass]

### Failure 1: test_user_creation_with_invalid_email

- **Test file:** tests/test_users.py
- **Test name:** test_user_creation_with_invalid_email
- **How tested:** POST /api/users with invalid email format
- **Failure output:**
  ```
  AssertionError: Expected status 400, got 201
  Response: {"id": 1, "email": "not-an-email", "status": "active"}
  ```
- **Root cause:** Email validation regex is missing @ symbol check
- **Reproduction steps:**
  1. Run `pytest tests/test_users.py::test_user_creation_with_invalid_email`
  2. Observe: API accepts invalid email format
  3. Expected: API rejects with 400 status

### Failure 2: test_concurrent_database_writes

- **Test file:** tests/integration/test_concurrency.ts
- **Test name:** test_concurrent_database_writes
- **How tested:** 10 concurrent POST requests to create records
- **Failure output:**
  ```
  Timeout waiting for database transaction lock after 5000ms
  ```
- **Root cause:** Missing transaction timeout configuration or deadlock
- **Reproduction steps:**
  1. Run `npm test tests/integration/concurrency.test.ts`
  2. Observe: Test times out after 5 seconds
  3. Check database logs for lock contention

## Recommendations

### Tests to Fix

[Required for release if not already listed above]

- [ ] Fix email validation in user creation endpoint
  - Add @ and domain checks to regex
  - Add test coverage for invalid formats
  - Verify integration tests pass after fix

- [ ] Resolve database transaction timeout
  - Investigate transaction lock wait times
  - Review concurrent write handling
  - Add connection pool monitoring

### Coverage Gaps to Address

[If coverage below 70%]

- [ ] Add tests for error handlers in auth middleware
- [ ] Add boundary tests for pagination (empty results, overflow)
- [ ] Add tests for rate-limit edge cases

### Additional Testing

- [ ] Run full E2E test suite for critical user workflows
- [ ] Verify cross-browser compatibility (if applicable)
- [ ] Load test critical endpoints if performance requirements exist

## Next Steps

1. [Fix blocking failures]
2. [Address coverage gaps]
3. [Re-run full suite]
4. [Verify release criteria met]
```

---

## Field Guidance

### Verdict
- **PASS:** All tests pass, coverage >=70%, no blocking issues
- **FAIL:** Tests fail OR coverage below 70% OR critical errors exist
- **NEEDS ATTENTION:** Tests pass but with warnings (flaky tests, coverage edge cases, minor issues)

Use these three words for the verdict, never emoji badges.

### Test Results Table
Count by category. Include skipped tests only if intentional (e.g., tests marked `@skip` in config).

### Coverage
Report both line coverage (primary) and branch coverage (secondary). If below 70%, list specific uncovered files and line numbers, prioritizing high-risk areas (error handlers, auth, validation).

### Test Failures
For each failure, include:
1. **Test name:** Exact test name from runner output
2. **Test file path:** Where the test code lives
3. **How tested:** What the test does (e.g., "POST /api with invalid body")
4. **Failure output:** Full error message, assertion, or timeout message
5. **Root cause:** Your analysis of why it failed (don't just repeat the error)
6. **Reproduction steps:** Numbered steps so another person can independently run the test and see the failure

Cite every location as file and line (`models.py:45`).

### Recommendations
Separate into sections:
- **Tests to Fix:** Blocking failures that must be resolved
- **Coverage Gaps:** Uncovered lines that should be tested
- **Additional Testing:** Optional improvements for quality

### Next Steps
Ordered list of actions. Be specific ("add null check to User.email validation" in place of "fix the bug").

---

## Report Writing Standard (Apply Throughout)

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

---

## Template Sections Checklist

When creating a test report, include:

- ✓ Verdict (PASS/FAIL/NEEDS ATTENTION)
- ✓ Summary (2-3 sentences)
- ✓ What Was Tested (scope, environment, counts)
- ✓ Test Results table (pass/fail/skip counts)
- ✓ Coverage (% vs >=70% target)
- ✓ Failures (if any) with reproduction steps
- ✓ Recommendations (fixes, gaps, additional testing)
- ✓ Next Steps (ordered action list)

Skip sections only if not applicable (e.g., omit "Test Failures" if all tests pass).
