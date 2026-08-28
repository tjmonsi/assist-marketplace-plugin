# Reviewer Adversarial Self-Reflection Guide

Before conducting formal audit on any submission (code, planning document, requirements), reviewers deliberately execute an adversarial self-reflection phase to find issues early.

## Purpose

Reviewers approach the submission asking: "Where could this break? What's wrong with this?" This adversarial mindset catches problems that might be missed in a standard audit.

## Five Categories: What to Look For

### 1. Errors & Syntax

- **Syntax errors:** Typos in code, malformed JSON/YAML, missing braces
- **Logic errors:** Off-by-one bugs, null pointer dereferences, infinite loops
- **Type mismatches:** Wrong type passed to function, return type inconsistent
- **Variable scope:** Variable shadowing, uninitialized variables, use-after-free

**Examples:**
- `for (int i = 0; i <= arr.length; i++)` ← off-by-one
- `result = data.process()` when data might be null ← null pointer
- Function says it returns `string` but returns `null` ← type mismatch

### 2. Inconsistencies

- **Inconsistent with codebase:** Violates project patterns, doesn't match existing code style
- **Inconsistent with requirements:** Doesn't meet spec, misses use case, contradicts PR description
- **Inconsistent with architecture:** Breaks design pattern, violates layering
- **Inconsistent naming:** Mixes camelCase and snake_case, uses unclear abbreviations

**Examples:**
- All repos use `snake_case` but this code uses `camelCase` ← style inconsistency
- Spec says "all transactions must be logged" but this doesn't log ← requirement inconsistency
- Helper functions are in `utils/` but this one is inline ← architecture inconsistency

### 3. Assumptions & Edge Cases

- **Questionable assumptions:** "Is this guaranteed?" "What if it's null?"
- **Missing checks:** No validation for empty input, null, negative numbers
- **Boundary conditions:** What happens at array bounds? First/last element?
- **Error paths:** What happens on failure? Is it handled? Does it crash?
- **Concurrency:** Race conditions? Deadlocks if accessed concurrently?

**Examples:**
- Code assumes `user.email` exists but never checks ← assumption
- Loop processes array but no check for empty array ← edge case
- Function doesn't handle database connection failure ← error path

### 4. Security & Performance

- **Injection vectors:** SQL injection, command injection, script injection possible?
- **Credential leaks:** Hardcoded secrets, API keys, passwords in logs?
- **N+1 patterns:** Loop making separate DB query each iteration?
- **Memory issues:** Memory leaks? Unbounded growth? Allocation per iteration?

**Examples:**
- `query = "SELECT * FROM users WHERE id=" + user_id` ← SQL injection
- `password = "hardcoded123"` ← credential leak
- `for (user in users) { db.query(user.id) }` ← N+1 query pattern

### 5. Clarity & Maintainability

- **Unclear naming:** Variable names don't describe purpose (e.g., `x`, `temp`, `data`)
- **Missing explanation:** Why is this done? Not obvious from code
- **Over-commented:** Comments just repeat code ("increment i by 1" commenting `i++`)
- **Logic flow:** Can you follow it? Does it make sense? Too nested?

**Examples:**
- `let x = data.map(...)` ← what is x? Unknown purpose
- Nested if-statements 5 levels deep ← hard to follow
- `arr.push(item); // Add item to array` ← obvious comment, not helpful

## Reviewer Workflow

**Phase 1: Adversarial Self-Reflection (10-15 min)**
1. Read entire submission
2. For each of 5 categories above, deliberately look for issues
3. Note findings (don't edit yet)
4. Document: "I found 3 potential edge cases, 1 unclear name, 2 null-pointer risks"

**Phase 2: Formal Audit (using gate-specific checklists)**
1. Systematically check all items in the review gate checklist (OWASP, code review, planning review)
2. Combine self-reflection findings + formal checklist items
3. Decide: Approve or request revisions
4. Document all issues clearly

**Phase 3: Iteration Loop**
1. If revisions requested: Creator addresses all feedback
2. Repeat phases 1-2 (adversarial self-reflection + formal audit)
3. Exit when: 2 consecutive LGTMs OR 10 iterations (escalate)

## Common Issues: Adversarial vs. Formal Audit

| Issue Type | Caught in Adversarial Phase | Caught in Formal Audit | Notes |
|------------|---------------------------|----------------------|-------|
| Off-by-one errors | ✓ Often | ✓ If systematic | Adversarial: asking "what if boundary is X?" |
| Null pointer risks | ✓ Deliberate check | ✓ If systematic | Adversarial: explicitly checking all null paths |
| Performance (N+1) | ✓ Pattern recognition | ✓ If checked | Adversarial: looking for loop + query pattern |
| Naming clarity | ✓ Can spot immediately | ✓ Always | Both catch it, adversarial may spot first |
| OWASP gaps | ✓ Deliberate focus | ✓ Systematic | Adversarial: thinking like attacker |
| Logic flow errors | ✓ Question assumptions | ✓ If formal check exists | Adversarial: "can I follow this?" |

## Adversarial Mindset Starters

When reviewing, ask yourself:
- "Where could this crash?"
- "What if this is null/empty?"
- "How could someone exploit this?"
- "Is this consistent with the codebase?"
- "Can I understand this in 6 months?"
- "What happens if this fails silently?"
- "What's the worst case input?"

## Tips for Efficient Adversarial Review

1. **Focus on likely issues:** Know your codebase's weak spots (security, performance, concurrency)
2. **Trust your gut:** If something seems off, it probably is — dig deeper
3. **Document as you go:** Don't wait until the end to write feedback
4. **Time-box:** 10-15 minutes of adversarial review, then formal audit
5. **Iterate with creator:** Early feedback helps them catch more next time
