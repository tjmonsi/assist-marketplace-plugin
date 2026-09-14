# Review Protocol

Procedure for executing code review gates and validation loops in the `do` orchestrator.

## Overview

Review happens AFTER implementation steps. Goals:
- Detect bugs and architectural issues
- Enforce OWASP security standards
- Validate test coverage (>70%)
- Obtain formal sign-off before merge

---

## Reviewer Adversarial Self-Reflection

All review gates include a dedicated adversarial self-reflection phase where the reviewer deliberately tries to find issues BEFORE conducting the formal audit.

**What reviewers look for:**
- Errors: syntax, logic, type mismatches, variable scope
- Inconsistencies: with codebase patterns, requirements, architecture, naming
- Assumptions & edge cases: null checks, boundary conditions, error paths, concurrency
- Security & performance: injection vectors, credential leaks, N+1 patterns, memory issues
- Clarity: unclear naming, missing explanations, confusing logic flow

**Why it matters:**
- Catches problems earlier (before formal audit)
- Improves review quality and thoroughness
- Reduces iteration count (issues found in self-reflection phase)
- Provides structured feedback to creators

**When:** Applied in all review gates — OWASP, Code Review, Planning Documents

See [governance rule: Reviewer Adversarial Self-Reflection](../rules/assist-plugin-rule.md#reviewer-adversarial-self-reflection) for detailed checklist.

---

## Review Triggers

A step REQUIRES review if:
1. It produces or modifies code files, OR
2. It requires governance gate (security, testing, approval)

**Agents that DO review:** reviewer, code-reviewer  
**Agents that RECEIVE review:** developer, devops, qa

---

## Review Gate Checklist

### Security Gate (OWASP Top 10)

**Triggered by:** Code changes in developer, devops agents  
**Reviewed by:** reviewer or code-reviewer  

### Reviewer Adversarial Self-Reflection

Before formal audit, reviewer deliberately:
- Looks for syntax/logic errors, type mismatches
- Checks for inconsistencies with codebase patterns
- Questions assumptions: What if input is null? What if it fails?
- Spot-checks security: injection vectors, credential leaks
- Tests mental model: Can I follow the logic?

**Checklist:**

1. **Injection** — SQL, command, script injection prevented?
2. **Broken Auth** — Authentication logic sound? Passwords hashed?
3. **Sensitive Data** — No hardcoded secrets? PII encrypted?
4. **XML/XXE** — XML parsing is safe?
5. **Broken Access Control** — Authorization checks present?
6. **Security Misconfiguration** — Default configs changed? CORS restricted?
7. **XSS** — User input sanitized? Output encoded?
8. **Deserialization** — Untrusted input deserialized safely?
9. **Using Components** — Dependencies up-to-date? Known vulns checked?
10. **Logging & Monitoring** — Security events logged?

### Iteration Process

1. **Developer Self-Review** — Developer checks code against OWASP categories
2. **Reviewer Audit** — Reviewer checks all 10 categories
3. **Iteration Loop** — If issues found: Developer fixes → Reviewer re-checks
4. **Exit Conditions:**
   - 2 consecutive LGTMs from reviewer → Approved
   - 10 iterations reached → Escalate to code-reviewer for final call

**Approval:** `✓ OWASP Clear` (after iteration complete)

---

### Testing Gate (>70% Coverage)

**Triggered by:** Code changes  
**Reviewed by:** qa agent  
**Checklist:**

1. **Unit Tests** — Core functions tested?
2. **Integration Tests** — Components work together?
3. **Edge Cases** — Error paths tested?
4. **Coverage** — New code >70% covered?
5. **Regression** — Existing tests still pass?

**Approval:** QA must sign off: ✓ Coverage >70%

---

### Code Review Gate (Sign-Off)

**Triggered by:** Merge-ready code  
**Reviewed by:** code-reviewer  

### Reviewer Adversarial Self-Reflection

Before formal audit, reviewer deliberately:
- Looks for syntax/logic errors, type mismatches
- Checks for inconsistencies with codebase patterns
- Questions assumptions: What if input is null? What if it fails?
- Spot-checks security: injection vectors, credential leaks
- Tests mental model: Can I follow the logic?

**Checklist:**

1. **Correctness** — Logic sound? No bugs?
2. **Performance** — Efficient algorithms? No N+1 queries?
3. **Readability** — Code clear and maintainable?
4. **Architecture** — Follows project conventions?
5. **Testability** — Code is testable?

### Iteration Process

1. **Developer Self-Review** — Self-check on all 5 dimensions
2. **Code Reviewer Audit** — Line-by-line review on all dimensions
3. **Iteration Loop** — If changes requested: Developer fixes → Reviewer re-audits
4. **Exit Conditions:**
   - 2 consecutive LGTMs from code-reviewer → Approved
   - 10 iterations reached → Escalate to architecture review

**Approval:** `✓ Approved for merge` (after iteration complete)

---

### Planning Document Review Gate

**Triggered by:** Output from planning-related agents (planner, solutions-architect, requirements-gatherer)

**Reviewed by:** reviewer or code-reviewer

### Reviewer Adversarial Self-Reflection

Before formal audit, reviewer deliberately:
- Looks for syntax/logic errors, type mismatches
- Checks for inconsistencies with codebase patterns
- Questions assumptions: What if input is null? What if it fails?
- Spot-checks security: injection vectors, credential leaks
- Tests mental model: Can I follow the logic?

**Process:**

1. **Creator Self-Reflection** — Creator audits own work for:
   - Completeness (all sections present?)
   - Clarity (would a reader understand this?)
   - Feasibility (are requirements realistic? Is architecture sound?)
   - Alignment (does this match project context?)

2. **Reviewer Audit** — Reviewer checks:
   - Technical soundness
   - Completeness against requirements
   - Clarity and organization
   - Feasibility and risk assessment

3. **Iteration Loop**
   - Reviewer approves OR requests changes
   - If changes: Creator fixes → Reviewer re-audits
   - Track iterations (max 10)
   - Exit when: 2 consecutive LGTMs OR 10 iterations (escalate)

**Approval:** `✓ LGTM #2` (two consecutive LGTMs)

**Escalation:** After 10 iterations, escalate to `code-reviewer` for final decision

---

## Review Workflow

**Note:** Planning documents (from planner, solutions-architect, requirements-gatherer) follow a separate iteration-based review workflow (see "Planning Document Review Workflow" section above). All other work follows the standard security → testing → code review sequence below.

```
Developer/Planner submits code/document
  ↓
Creator self-reviews
  ↓
Reviewer adversarially self-reflects (tries to find issues)
  ↓
Reviewer conducts formal audit
  ├─ OWASP check (if code) OR gate-specific checklist
  ├─ Approve or request revision
  └─ If revision: iterate
     - Creator fixes
     - Reviewer repeats adversarial self-reflection + formal audit
     - Exit: 2 consecutive LGTMs or 10 iterations (escalate)
  ↓
Merge approved ✓
```

---

## Fix Phase Rules

Applies whenever a reviewer requests changes at any gate (OWASP, Testing, Code Review, Planning Document).

Full constraint details: [fix-phase-rules.md](fix-phase-rules.md)

### Model Constraint

- Fix phase ALWAYS uses Sonnet
- Never use Opus for fixes, even if the review gate itself uses Opus (reviewer, code-reviewer)
- Never use Haiku for fixes, even for single-line changes
- Applies to every agent performing a fix (developer, planner, solutions-architect, requirements-gatherer)

### Scope Constraint

- Developer/creator fixes ONLY items explicitly identified by the reviewer
- No scope creep: no unrelated refactors, no drive-by cleanup, no "while I'm here" changes
- If additional issues are spotted during the fix, flag them to the orchestrator — do not fix them unilaterally
- Reviewer re-audit checks two things: (1) listed items resolved, (2) no unrelated changes introduced

### Fix Phase Procedure

1. Reviewer produces an itemized findings list (file, line number, issue description)
2. Orchestrator routes findings to the fixing agent with `Model: Sonnet` (non-negotiable)
3. Fixing agent changes ONLY the code/content tied to a listed finding
4. Fixing agent self-reviews the fix against the findings list only (not a full-file pass)
5. Reviewer re-audits: confirms each finding resolved AND scans for unrelated diffs
6. If unrelated changes are present: reject the fix, re-iterate the fix phase
7. If fix is correctly scoped: proceed to next review iteration

### Plan Tracking: Review Iterations vs. Fix Iterations

Track review passes and fix passes as separate counters in the plan file:

```markdown
**Review:** Code Review with Iterations
  - Review Iteration 1 (code-reviewer, Opus): Finds 2 issues — null check L42, unclear naming L88
  - Fix Iteration 1 (developer, Sonnet): Fixes L42, L88 only — no other lines touched
  - Review Iteration 2 (code-reviewer, Opus): Confirms both fixes, no unrelated changes → LGTM #1
  - Review Iteration 3 (code-reviewer, Opus): Re-audit → LGTM #2
  - Exited: 2 consecutive LGTMs
  - Fix Model: Sonnet (all fix iterations, non-negotiable)
```

- **Review iteration** — a reviewer audit pass (model per gate: Opus for reviewer/code-reviewer)
- **Fix iteration** — a fixing-agent pass (model always Sonnet)
- Counters are independent: a review iteration with no findings needs no matching fix iteration
- Max 10 combined iterations per gate before escalation (see Iteration Process per gate)

---

## Approval Tracking

In plan file, mark review outcomes:

```markdown
### Step 2: Implementation

**Status:** completed  
**Done:** [YYYY-MM-DD HH:mm] — [Summary]  
**Review:** LGTM (3 approvals)
  - Security: ✓ OWASP clear
  - Testing: ✓ 85% coverage
  - Code Review: ✓ Approved
```

```markdown
### Step 3: Implementation (Code)

**Status:** completed  
**Done:** [YYYY-MM-DD HH:mm] — [Summary]  
**Review:** Code Review with Iterations
  - Security (OWASP): Iteration 2 → ✓ OWASP Clear
  - Testing: ✓ 82% coverage
  - Code Review: Iteration 3 → ✓ Approved for merge
  - Tracked: Max 10 iterations; exited at 3 (2 consecutive LGTMs)
```

```markdown
### Step 3: Review with Adversarial Self-Reflection

**Status:** completed  
**Done:** [YYYY-MM-DD HH:mm]  
**Review:** Code Review with Adversarial Self-Reflection
  - Reviewer self-reflects: Found 2 potential null-pointer issues, 1 unclear variable name
  - Reviewer audit: Confirmed both edge cases unhandled, variable naming confusing
  - Iteration 1: Developer adds null checks → Reviewer LGTM #1
  - Iteration 2: Developer renames variables → Reviewer LGTM #2
  - Final: ✓ Approved for merge
```

---

## Fast-Track Review

For low-risk changes (docs, tests, non-critical fixes):

1. **Flag as low-risk:** Add to plan: `**Review:** Low-risk (no security gates)`
2. **Skip OWASP gate:** If change doesn't touch production code
3. **Skip full code review:** For small, obvious changes

**Still required:** Testing gate (if code affects logic)

---

## Reviewer Responsibilities

### Security Reviewer (`reviewer` agent)

- Check OWASP top 10 compliance
- Validate authentication/authorization
- Check for credential leaks
- Approve or request revision

**Tools:** Read, Grep, Bash (no write)  
**Authority:** Can block merge if security issues found

### Formal Code Reviewer (`code-reviewer` agent)

- Line-by-line architectural review
- Best practice enforcement
- Critical sign-off authority
- Used for high-impact changes

**Tools:** Read, Grep, Bash, LSP (no write)  
**Authority:** Formal approval required for sensitive changes

---

## Review SLAs

| Review Type | Complexity | SLA |
|-------------|-----------|-----|
| Security | Low (no vulnerabilities found) | ~5 min |
| Security | High (multiple OWASP issues) | ~15 min |
| Testing | Low (high coverage) | ~3 min |
| Testing | High (low coverage, gaps) | ~10 min |
| Code Review | Low (small, obvious change) | ~10 min |
| Code Review | High (complex, critical change) | ~30 min |

---

## Escalation

If reviewer and developer disagree:

1. **Document disagreement:** Add comment to plan
2. **Escalate to code-reviewer:** If not already involved
3. **Code-reviewer makes final call:** Their sign-off is binding
4. **Document decision:** Add to plan for future reference

