# Debug Review

Verify that an applied fix is correct and doesn't introduce new issues.

## When to Use

After developer has applied a fix via `/debug fix`, use review to verify:
- Bug is actually fixed
- No new bugs introduced
- Tests pass
- No side effects

## Verification Checklist

1. **Reproduction**: Does the original bug still occur? (Should be fixed)
2. **Tests**: Do all existing tests still pass?
3. **Side effects**: Did the fix break other functionality?
4. **Code quality**: Is the fix clean and maintainable?
5. **Coverage**: Are new test cases needed?

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

The ✓/✗ verdict lines are the one badge format this review uses; keep them terse.

## When to Loop Back

If review finds issues:
1. Document the issues
2. Return to developer
3. Developer applies new fix or adjustments
4. Re-run review
5. Repeat until approved

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
