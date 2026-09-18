# Debug Review

Verify that an applied fix is correct and doesn't introduce new issues.

## When to Use

After developer has applied a fix via `/debug fix`, use review to verify:
- Bug is actually fixed
- No new bugs introduced
- Tests pass
- No side effects

## Verification Checklist

1. **Reproduction** — Does the original bug still occur? (Should be fixed)
2. **Tests** — Do all existing tests still pass?
3. **Side effects** — Did the fix break other functionality?
4. **Code quality** — Is the fix clean and maintainable?
5. **Coverage** — Are new test cases needed?

## Review Process

1. Read the RCA (root cause analysis)
2. Review the code changes
3. Run tests if applicable
4. Verify fix works by reproducing original bug
5. Check for side effects
6. Approve or request changes

## Approval Format

```
✓ Fix Verified

- Bug is fixed (reproduction steps now pass)
- All tests pass (no regressions)
- No side effects detected
- Code quality acceptable

Ready to merge.
```

## Rejection Format

```
✗ Fix Not Verified

Issues found:
1. [Issue 1]
2. [Issue 2]
3. [Issue 3]

Please fix and resubmit.
```

## When to Loop Back

If review finds issues:
1. Document the issues
2. Return to developer
3. Developer applies new fix or adjustments
4. Re-run review
5. Repeat until approved

## Report Writing Standard

- Lead with the most important finding; never write "this is the more important of the two."
- Every finding has three parts: what happened, why it matters, what to do next.
- State each conclusion once. One optional summary line at the end for multi-finding reports; never repeat findings there.
- Use active voice, important subject before the verb ("Validation is skipped" not "The validation was skipped by...").
- Cut hedges ("it should be noted," "arguably") and contrastive filler ("This is X, not Y" — state what it is).
- No meta-headers about the act of writing ("What follows," "Key takeaway," "In conclusion").
- No em-dashes; use a period, comma, parentheses, or semicolon.
- No severity badges, remediation blocks, or summary sections unless the reader would be lost without them. The ✓/✗ verdict format above is the exception; keep it terse.
- Never restate the user's prompt or an assumption as fact; report the tested result.
- The first sentence of every paragraph must add new information.

