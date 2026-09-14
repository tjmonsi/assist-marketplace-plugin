# Fix Phase Constraints

Rules governing the fix phase that follows a reviewer's request for changes. Applies to every review gate (OWASP, Testing, Code Review, Planning Document).

---

## Rule 1: Sonnet-Only for Fixes

Fix phase ALWAYS uses Sonnet. Never Opus. Never Haiku.

This applies regardless of:
- Which model reviewed the code (reviewer/code-reviewer use Opus, fixes still use Sonnet)
- Which model wrote the original code (developer uses Sonnet by default already)
- How small or large the fix appears

### Why Sonnet-Only

1. **Cost** — Fix phases repeat across iterations (up to 10 per gate). Running Opus per iteration multiplies the most expensive tier across the highest-frequency step in the workflow.
2. **Speed** — Sonnet returns fixes faster than Opus, reducing iteration latency. Fixes are narrow, well-defined tasks (not open-ended architecture), so Opus's extra reasoning capacity is unnecessary.
3. **Precision** — A narrow, well-specified findings list benefits more from a fast, literal, constrained edit pass than from a heavier model's tendency to broaden scope or re-architect.

### Non-Negotiable

- Do not upgrade to Opus even if the fix is described as "critical" or "security-related" — the review gate (Opus) already gated on severity. The fix itself stays Sonnet.
- Do not downgrade to Haiku even if the fix is a one-line change — Haiku lacks reliable scope discipline for code edits.

---

## Rule 2: Identified Items Only

"Identified items" means the reviewer's specific, itemized findings — nothing else.

### What Counts as an Identified Item

- A specific file + line number (or line range) + issue description from the reviewer's formal audit
- A specific OWASP category finding tied to a specific code location
- A specific test gap tied to a specific function/file
- A specific planning document section flagged as incomplete/incorrect

### What Does NOT Count

- Issues the developer personally notices while fixing (must be flagged, not fixed)
- Style preferences not raised by the reviewer
- Refactors that "would improve" the code but weren't requested
- Fixes to adjacent code that merely resembles the flagged issue (must be separately identified by reviewer first)

---

## Rule 3: Modification Checklist

Before submitting a fix, the fixing agent (developer, planner, solutions-architect, requirements-gatherer) confirms ALL of the following:

1. Every changed line maps to a specific reviewer finding
2. No file is touched that wasn't named in a finding
3. No function/section is touched beyond what the finding's line range requires
4. No new files created unless the finding explicitly required one (e.g., missing test file)
5. No formatting/linting changes outside the touched lines
6. No dependency, config, or unrelated import changes
7. Commit/diff reviewed line-by-line against the findings list before resubmitting

If any item fails this checklist, remove the unrelated change before resubmitting.

---

## Example

**Reviewer finding:**
```
File: src/services/user-service.ts
Line: 42
Issue: Null-pointer risk — `user.profile.email` accessed without checking `user.profile` exists
```

**Allowed fix:**
- Modify line 42 (and immediately adjacent lines strictly required to add the null check, e.g., wrapping in an `if` block)
- Example: change `user.profile.email` to `user.profile?.email` or add a guard clause directly around that access

**Not allowed in the same fix pass:**
- Renaming `user` to `currentUser` elsewhere in the file
- Adding null checks to other functions in `user-service.ts` not flagged by the reviewer
- Reformatting the file
- Adding new tests unless the reviewer's finding was specifically about missing test coverage for this line
- Touching `src/services/order-service.ts` even if it has a similar pattern (must be a separate, reviewer-identified finding first)

---

## Hard Constraint: Fix Phase Failure

If the fixing agent adds unrelated changes:

1. Fix phase FAILS automatically, regardless of whether the identified items were also correctly fixed
2. Reviewer rejects the entire fix submission (not just the unrelated portion)
3. Fix phase re-iterates: fixing agent resubmits with ONLY the identified items addressed
4. The failed attempt counts toward the gate's iteration limit (max 10, see review-protocol.md)
5. Repeated scope violations (2+ in the same gate) escalate to code-reviewer for review of the fixing agent's output before continuing

---

## Procedure Summary

1. Reviewer issues itemized findings (file, line, issue)
2. Orchestrator assigns fix to agent with `Model: Sonnet`
3. Fixing agent runs the Modification Checklist before submitting
4. Fixing agent submits diff scoped strictly to findings
5. Reviewer re-audits: verifies findings resolved AND scans full diff for unrelated changes
6. Unrelated changes present → reject, re-iterate (step 2)
7. Diff scoped correctly and findings resolved → proceed to next review iteration

---

## See Also

- [review-protocol.md](review-protocol.md) — Full review gate workflow and iteration tracking
- [model-routing.md](model-routing.md) — Model tier assignment for all agents
- [developer-self-review.md](developer-self-review.md) — Pre-review self-audit checklist
