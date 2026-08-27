# assist-plugin Governance Rules

Governance rules and constraints for development workflows in assist-plugin.

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
| Testing (>70%) | Low (high coverage) | ~3 min |
| Testing (>70%) | High (low coverage) | ~10 min |
| Code Review | Low (small change) | ~10 min |
| Code Review | High (complex change) | ~30 min |

---

## Merge Policy

**Before merge, ALL gates must be passed:**

- [ ] Security review: ✓ OWASP Clear
- [ ] Testing: ✓ >70% coverage
- [ ] Code review: ✓ Approved (if applicable)
- [ ] Commit format: ✓ Conventional Commits
- [ ] Commits squashed: ✓ Clean history (if requested)

**Merge blocked if:**
- Any gate fails
- Test suite fails
- Conflicts with main
- Author has < 2 hours since last commit (prevents race conditions)

---

## Fast-Track Review

For low-risk changes (docs, tests, refactoring):

1. **Security gate:** Can skip if no production code changes
2. **Testing gate:** Always required if logic changes
3. **Code review:** Optional if change is obvious/non-critical

Mark in plan: `**Review:** Low-risk (no production code)`

---

## Governance Enforcement

- **Automated:** CI/CD pipeline enforces coverage gates
- **Manual:** Agents enforce OWASP checks
- **Manual:** code-reviewer gives formal sign-off
- **Escalation:** code-reviewer makes final call on disputes

