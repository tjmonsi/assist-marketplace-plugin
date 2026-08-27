# Debug Analyze

Root cause analysis for bug investigation. Output: RCA report (not code changes).

## Workflow

1. **Gather context**
   - Reproduce the bug if possible
   - Get error logs, stack traces
   - Understand what was expected vs. actual

2. **Investigate root cause**
   - Trace the code path
   - Check assumptions (is input what we think?)
   - Bisect: narrow problem space by half each step
   - One hypothesis at a time

3. **Document findings**
   - What is the bug?
   - What is the root cause?
   - Why did it happen?
   - How to reproduce?

4. **Produce RCA**
   - Use [rca-template.md](rca-template.md)
   - Clear, evidence-based
   - Approved by user before proceeding to `fix`

## Input Formats

**Option 1: Description**
```
/debug analyze "Button doesn't respond to clicks in the settings panel"
```

**Option 2: File and line**
```
/debug analyze src/components/Button.tsx:42
```

**Option 3: Previous error**
```
/debug analyze "TypeError: Cannot read property 'map' of undefined at line 156"
```

## Output Format

Produce RCA document matching [rca-template.md](rca-template.md):
- What is the bug? (observed behavior)
- Root cause? (why it happens)
- Evidence? (code/logs that prove it)
- Reproduction steps? (how to trigger it)

## Constraints

- **No code changes** — Analyze only
- **No assumptions** — Verify with code or tests
- **Clear evidence** — Show stack traces, logs, code snippets
- **Reproducible** — Provide exact steps to trigger

## When to Escalate

If bug cannot be reproduced or root cause unclear:
- Ask user for more info (logs, steps)
- Check if bug is in dependency (report, don't patch)
- If impossible to diagnose: "Unable to determine cause; need more context"

