# RCA Template

Root Cause Analysis template output for `/debug analyze`. Structure the report in three parts: what happened, why it matters, what to do next. Fill every required field; state each fact once.

---

## What Happened

**Root Cause:** [The single, fundamental reason this bug exists]

**Code Location:** [File path and line number(s)]

**Observed Behavior:** [What actually happened / what user sees]

**Expected Behavior:** [What should have happened]

**Evidence:**

Error messages:
```
[Full error message or stack trace]
```

Relevant code:
```typescript
[Code snippet showing the bug]
```

Logs:
```
[Relevant log output]
```

**Reproduction Steps:**

1. [Step 1]
2. [Step 2]
3. [Step 3]
4. [Expected result: bug should occur]

---

## Why It Matters

**Impact:** [Severity: critical/high/medium/low; how many users/flows affected]

**Affected Components:**
- [Component 1]
- [Component 2]
- [Any dependent code that might be affected]

---

## What To Do Next

**Suggested Fix:** [Concrete description of how to fix this bug; do not repeat the root cause, state the action]

**Risk Level:** [low/medium/high — how risky is the fix?]

---

## Approval

- [ ] User reviewed and approved
- [ ] Ready for `/debug fix`
