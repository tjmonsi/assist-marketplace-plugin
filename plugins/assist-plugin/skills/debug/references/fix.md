# Debug Fix

Apply a fix to the bug. Requires approved RCA or human-report.

## Prerequisites

Before running `fix`, one of these MUST exist:

1. **Approved RCA** — From `/debug analyze` + user confirmation
2. **Human-report file** — e.g., `human-report.md` with bug description and expected fix

If neither exists, halt and tell user:
> "Fix requires an approved RCA (`/debug analyze` first) or human-report file."

## Workflow

1. **Confirm RCA** — Review approved root cause
2. **Design fix** — What changes are needed?
3. **Implement fix** — Make minimal, targeted change
4. **Verify fix** — Run tests; check reproduction steps work now
5. **Check side effects** — Did fix break anything else?

## Implementation Principles

- **Fix root cause, not symptoms** — Don't patch the error message
- **Minimal change** — Only code needed to fix the bug
- **No broad try/catch** — Don't suppress errors
- **One change at a time** — If two changes needed, submit one at a time
- **Test the fix** — Run relevant tests before returning

## Code Changes

- **What:** Minimal targeted fix
- **Where:** Only files involved in root cause
- **How:** Comment explaining why change is needed (if non-obvious)

## Validation

After applying fix:
1. Run original reproduction steps — Bug should be gone
2. Run existing tests — Should all still pass
3. Run new tests if applicable — Should now pass
4. Check related code — No new bugs introduced?

## When to Reject a Fix

- Too complex or speculative
- Doesn't actually address root cause
- Introduces side effects or new bugs
- Suppresses errors instead of fixing cause
- Requires human-report clarification

If rejected, provide feedback and loop back to `analyze` or refine human-report.

