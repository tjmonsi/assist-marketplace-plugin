# assist-plugin Governance Rules

Governance rules and constraints for development workflows in assist-plugin.

---

## Routing Rule

**Invoke the orchestrator:** All actionable development prompts SHOULD be routed through the `/do` skill. The `do` skill classifies the task, matches it to the right agent, creates an execution plan, and coordinates agents with review loops.

**Do NOT invoke `/do`:**
- Quick informational queries ("what is X?", "explain Y")
- Git operations where `/commit` or `/branch` is more direct
- Pure code search (use `/explore` or `/map-project` directly)
- Simple documentation requests (use `/technical-writing` directly)

**Default behavior:** If a prompt does not obviously match a specific skill, route to `/do` for classification and delegation.

---

## Security Review Gate (OWASP)

**When triggered:** Code changes in production code  
**Who reviews:** `reviewer` or `code-reviewer` agent  
**Authority:** Blocks merge if vulnerabilities found

### OWASP Top 10 Checklist

Code MUST pass ALL checks before approval:

1. **Injection Flaws** — SQL, command, script injection prevented?
   - [ ] Use prepared statements for SQL
   - [ ] Escape shell arguments
   - [ ] No `eval()` or dynamic code execution

2. **Broken Authentication** — Auth logic sound?
   - [ ] Passwords hashed with strong algorithm (bcrypt, scrypt)
   - [ ] Session tokens generated securely
   - [ ] No hardcoded credentials

3. **Sensitive Data Exposure** — Data protected?
   - [ ] No hardcoded secrets in code
   - [ ] PII encrypted at rest and in transit
   - [ ] Secure transmission (HTTPS/TLS)

4. **XML External Entity (XXE)** — XML parsing safe?
   - [ ] XML parser disabled for external entities
   - [ ] DTD processing disabled

5. **Broken Access Control** — Authorization working?
   - [ ] Authentication checks present before resource access
   - [ ] Role-based access control enforced
   - [ ] No privilege escalation paths

6. **Security Misconfiguration** — Config secure?
   - [ ] Default credentials changed
   - [ ] Unnecessary features disabled
   - [ ] Security headers set (CORS, CSP, etc.)

7. **Cross-Site Scripting (XSS)** — User input safe?
   - [ ] All user input sanitized
   - [ ] Output HTML-escaped
   - [ ] Content Security Policy set

8. **Insecure Deserialization** — Untrusted input safe?
   - [ ] No unsafe deserialization of untrusted data
   - [ ] Use allowlists for object types

9. **Using Components with Known Vulnerabilities** — Dependencies safe?
   - [ ] Dependencies up-to-date
   - [ ] No known CVEs in versions
   - [ ] Dependency audit run before merge

10. **Insufficient Logging & Monitoring** — Events logged?
    - [ ] Security events logged (login, auth failures)
    - [ ] Logs retained for audit trail
    - [ ] Alerts set for suspicious activity

**Approval:** Must sign: `✓ OWASP Clear`

---

## LLM Security Review Gate

**When triggered:** Changes to `agents/*.md`, `skills/**/SKILL.md`, `skills/**/references/*.md`, `rules/*.md`, `CLAUDE.md`, or `.claude/settings*.json`  
**Who reviews:** `reviewer` or `code-reviewer` agent  
**Authority:** Blocks merge

### Scope

These files are not documentation — they are executable instructions handed to a model with tool
access (agent prompts, skill definitions, routing logic, permission grants). They MUST be reviewed
with the same rigor as production application code, and this gate applies **in addition to**, not
instead of, the OWASP Top 10 gate above.

### OWASP Top 10 for LLM Checklist

Full checklist with per-category attack surface and verification items:
[llm-security-checklist.md](llm-security-checklist.md)

Covers: LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Supply Chain,
LLM04 Data and Model Poisoning, LLM05 Improper Output Handling, LLM06 Excessive Agency,
LLM07 System Prompt Leakage, LLM09 Misinformation/Overreliance, LLM10 Unbounded Consumption.
(LLM08 Vector/Embedding Weaknesses is out of scope — no vector store or RAG layer in this plugin.)

**Not fast-trackable:** This gate cannot be skipped under the Fast-Track Review rules below, even
for changes that look like "docs-only." Files under `agents/`, `skills/`, and `rules/` are this
plugin's executable surface.

**Approval:** Must sign: `✓ LLM Security Clear`

---

## Planning Document Review Gate

**When triggered:** Output from planning-related tasks:
- `planner` agent: Architecture decisions, task planning documents, roadmaps
- `solutions-architect` agent: API specifications, data flows, schema designs, implementation contracts
- `requirements-gatherer` agent: Business Requirements Document (BRD), User Requirements Document (URD), Feature/Non-functional requirements lists

**Who reviews:** `reviewer` or `code-reviewer` agent

**Authority:** Blocks next step if review incomplete; creator must fix feedback or escalate after 10 iterations

### Review and Iteration Process

1. **Creator Self-Reflection (1 pass):** Creator reviews own document for completeness, clarity, feasibility
2. **Reviewer Audit:** Reviewer checks for:
   - Clarity and completeness
   - Technical feasibility (for solutions-architect docs)
   - Requirement coverage (for requirements-gatherer docs)
   - Alignment with architecture (for planning docs)
3. **Iteration Loop:**
   - Reviewer signs off with changes requested OR approval
   - If changes requested: Creator fixes → Reviewer re-checks
   - Track iterations (1, 2, 3, ... up to 10)
   - Exit condition #1: **2 consecutive LGTMs** from reviewer → Approved (document ready for next step)
   - Exit condition #2: **10 iterations reached** → Escalate to `code-reviewer` for final decision
4. **Approval:** Document is approved when reviewer signs: `✓ LGTM #2` (second consecutive approval)

### Iteration Tracking in Plan Files

Mark each iteration in the plan:

```
**Review:** Planning Document (Architecture)
- Iteration 1: Reviewer requests clarification on [X], add [Y]
- Iteration 2: Creator fixes → Reviewer LGTM #1
- Iteration 3: Creator adds [Z] detail → Reviewer LGTM #2
- Final: ✓ Approved (2 consecutive LGTMs)
```

### Approval Signatures

- `✓ Document Review Clear` — Reviewer has audited the document
- `✓ LGTM #1` — First approval (one more needed for gate clearance)
- `✓ LGTM #2` — Second consecutive approval (gate cleared)

### Escalation

If creator and reviewer cannot reach consensus after 10 iterations:
1. Escalate to `code-reviewer` agent
2. `code-reviewer` makes final judgment call: approve document or reject
3. Decision is final; proceed or abort based on code-reviewer verdict

---

## Testing Coverage Gate (>70%)

**When triggered:** Code changes in production code  
**Who reviews:** `qa` agent  
**Authority:** Blocks merge if coverage below threshold

### Coverage Requirements

- **Unit tests:** Core functions tested (>80%)
- **Integration tests:** Components work together (>60%)
- **Edge cases:** Error paths tested
- **Overall target:** >70% for new/changed code

### Coverage Validation

```bash
# Run coverage before merge
npm run test:coverage  # or equivalent

# Must show: Overall coverage >70%
# Must show: No critical paths uncovered
```

**Approval:** Must sign: `✓ Coverage >70%`

---

## Code Review Gate (Sign-Off)

**When triggered:** High-risk or security-sensitive changes  
**Who reviews:** `code-reviewer` agent  
**Authority:** Formal sign-off required

### Review Dimensions

1. **Correctness** — Logic sound? No bugs?
2. **Performance** — Efficient? No N+1 queries?
3. **Readability** — Clear and maintainable?
4. **Architecture** — Follows conventions?
5. **Testability** — Code is testable?

**Approval:** Must sign: `✓ Approved for merge`

---

## When to Escalate

Escalate to code-reviewer if:

- **Security-sensitive:** Authentication, authorization, encryption, secrets
- **High-impact:** Core business logic, APIs, data pipelines
- **Cross-cutting:** Affects multiple teams or systems
- **Architectural:** Changes system design or contracts
- **Reviewer disagrees:** Developer and reviewer can't agree

---

## Review SLA

| Gate | Complexity | SLA |
|------|-----------|-----|
| Security (OWASP) | Low (no issues) | ~5 min |
| Security (OWASP) | High (multiple issues) | ~15 min |
| Security (OWASP for LLM) | Low (no issues) | ~5 min |
| Security (OWASP for LLM) | High (multiple issues) | ~15 min |
| Testing (>70%) | Low (high coverage) | ~3 min |
| Testing (>70%) | High (low coverage) | ~10 min |
| Code Review | Low (small change) | ~10 min |
| Code Review | High (complex change) | ~30 min |

---

## Merge Policy

**Before merge, ALL gates must be passed:**

- [ ] Security review: ✓ OWASP Clear
- [ ] LLM security review: ✓ LLM Security Clear (required whenever the change touches `agents/**`, `skills/**`, `rules/**`, `CLAUDE.md`, or `.claude/settings*.json`)
- [ ] Testing: ✓ >70% coverage
- [ ] Code review: ✓ Approved (if applicable)
- [ ] Commit format: ✓ Conventional Commits
- [ ] Commits squashed: ✓ Clean history (if requested)

**Merge blocked if:**
- Any gate fails
- Test suite fails
- Conflicts with main
- Author has < 2 hours since last commit (prevents race conditions)

Changes to agents, skills, or rules are only mergeable once **both** the OWASP (application) gate
and the OWASP for LLM gate are signed off — `✓ OWASP Clear` and `✓ LLM Security Clear` must both
appear in the commit message or plan file for traceability.

---

## Fast-Track Review

For low-risk changes (docs, tests, refactoring):

1. **Security gate:** Can skip if no production code changes
2. **LLM security gate:** Cannot be skipped for changes to `agents/*.md`, `skills/**/SKILL.md`,
   `skills/**/references/*.md`, `rules/*.md`, `CLAUDE.md`, or `.claude/settings*.json` — these are
   the plugin's executable surface, not documentation, regardless of how the change looks
3. **Testing gate:** Always required if logic changes
4. **Code review:** Optional if change is obvious/non-critical

Mark in plan: `**Review:** Low-risk (no production code)`

---

## Governance Enforcement

- **Automated:** CI/CD pipeline enforces coverage gates
- **Manual:** Agents enforce OWASP checks
- **Manual:** Agents enforce OWASP for LLM checks ([llm-security-checklist.md](llm-security-checklist.md)) on every change to `agents/`, `skills/`, `rules/`, `CLAUDE.md`, or `.claude/settings*.json`
- **Manual:** code-reviewer gives formal sign-off
- **Escalation:** code-reviewer makes final call on disputes

