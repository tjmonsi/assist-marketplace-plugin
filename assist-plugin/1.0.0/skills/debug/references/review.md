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

