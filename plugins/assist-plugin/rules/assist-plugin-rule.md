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

## Approval Status Writer (FR-222)

A review verdict or approval status is written only by the orchestrator (`/do`) or by a hook, never by the agent that produced the artifact under review. `/do` records each verdict and approval line in the plan file and marks the record `Writer: orchestrator` (see `skills/do/references/plan-format.md`). A hook that records an approval of its own, such as the confirmation store, marks it `Writer: hook`. A reviewer reports its verdict in its terminal block, and `/do` reads it and writes the record. A producer's write to `.agent/main-plan/**` is denied by the protected glob under [Write guard lists](#write-guard-lists), and a shell write by [Shell Write Path](#shell-write-path); this section is the documented rule that matches that enforcement. Every **Approval:** line below names a status `/do` records.

## Evidence for Gate Approvals (FR-221)

`/do` records a gate as cleared only with an evidence reference. A sign-off string that a model emits, such as `✓ Coverage >=70%`, never clears a gate. With no evidence reference the gate stays open and the merge check blocks.

**Deterministic gate (Coverage >=70%, test-runner exit).** It clears only on a `gate-evidence` record in the governance audit log (`.agent/logs/governance/audit.jsonl`) that holds the command identifier, the exit code, and the measured value. The `gate-evidence` hook writes that record, so the model cannot forge it. The hook runs on `PostToolUse` (a success event, read as exit 0) and on `PostToolUseFailure` (the exit status is the N of the `error` field's leading "Exit code N") for the `Bash` tool, and records only an allowlisted test, coverage, or in-plugin scanner command. The record holds the allowlist's fixed identifier for the command (for example `npm run test:coverage`), never the command text typed, arguments, output, or a secret (NFR-031). A command off the allowlist, a chained or piped command, or a run with no known exit status leaves no record, so its gate stays open. The record shows that an allowlisted command ran and how it ended; the reviewer reads what the run covered.

**Judgement gate (OWASP Clear, LLM Security Clear, Approved for merge).** It clears only on an in-plugin scanner exit code together with a verdict from a reviewer other than the producer, carrying `file:line` findings. The scanners are the plugin's own scripts, so no gate depends on an external scanner being installed; an external scanner (semgrep, CodeQL) is optional extra evidence. The mapping from gate to scanner is fixed:

| Gate | In-plugin scanner evidence | Plus |
|---|---|---|
| OWASP for LLM Clear | `check-fsa-tables.js` and `sync-writing-standard.js` and the health self-tests, with the FR-217 pattern and secret scanner | A non-producer reviewer verdict with `file:line` findings |
| Code Security / OWASP Clear | The FR-217 pattern and secret scanner | A non-producer reviewer verdict with `file:line` findings |
| Coverage >=70% | The test runner's coverage exit (the `gate-evidence` record) | The parsed coverage value |
| Approved for merge | The aggregate of those exits | A verdict from a `code-reviewer` other than the producer |

A CI artifact is an alternative evidence reference; the gate record holds its identifier, not its contents.

**Evidence basis of a judgement gate.** A judgement gate clears only when both pieces exist, and neither alone is enough:

1. **A scanner exit.** The exit code of each in-plugin scanner the table above names for the gate, taken from the `gate-evidence` record for that run. A scanner run with no record, or a non-zero exit, gives no evidence and the gate stays open.
2. **A non-producer verdict.** A reviewer verdict from an agent that did not produce the artifact under review, carrying `file:line` findings. A verdict from the producer does not count, and a returned verdict whose findings name no file and line does not count.

A model sign-off string, from a reviewer or any other agent, never supplies either piece. The reviewers (`reviewer`, `code-reviewer`) stay read-only (`tools: [Read, Grep, Glob, LSP]`): the verdict is evidence the orchestrator records, never a status a reviewer writes. `/do` writes the gate record with `Writer: orchestrator`, naming the scanner command, its exit code, the evidence reference, and the reviewer verdict (see `skills/do/references/plan-format.md`). An external scanner (semgrep, CodeQL) is optional extra evidence and a gate never depends on one.

## Security Review Gate (OWASP)

**When triggered:** Code changes in production code  
**Who reviews:** `reviewer` or `code-reviewer` agent  
**Authority:** Blocks merge if vulnerabilities found

### OWASP Top 10 Checklist

Code MUST pass ALL checks before approval:

1. **Injection Flaws**: SQL, command, script injection prevented?
   - [ ] Use prepared statements for SQL
   - [ ] Escape shell arguments
   - [ ] No `eval()` or dynamic code execution

2. **Broken Authentication**: Auth logic sound?
   - [ ] Passwords hashed with strong algorithm (bcrypt, scrypt)
   - [ ] Session tokens generated securely
   - [ ] No hardcoded credentials

3. **Sensitive Data Exposure**: Data protected?
   - [ ] No hardcoded secrets in code
   - [ ] PII encrypted at rest and in transit
   - [ ] Secure transmission (HTTPS/TLS)

4. **XML External Entity (XXE)**: XML parsing safe?
   - [ ] XML parser disabled for external entities
   - [ ] DTD processing disabled

5. **Broken Access Control**: Authorization working?
   - [ ] Authentication checks present before resource access
   - [ ] Role-based access control enforced
   - [ ] No privilege escalation paths

6. **Security Misconfiguration**: Config secure?
   - [ ] Default credentials changed
   - [ ] Unnecessary features disabled
   - [ ] Security headers set (CORS, CSP, etc.)

7. **Cross-Site Scripting (XSS)**: User input safe?
   - [ ] All user input sanitized
   - [ ] Output HTML-escaped
   - [ ] Content Security Policy set

8. **Insecure Deserialization**: Untrusted input safe?
   - [ ] No unsafe deserialization of untrusted data
   - [ ] Use allowlists for object types

9. **Using Components with Known Vulnerabilities**: Dependencies safe?
   - [ ] Dependencies up-to-date
   - [ ] No known CVEs in versions
   - [ ] Dependency audit run before merge

10. **Insufficient Logging & Monitoring**: Events logged?
    - [ ] Security events logged (login, auth failures)
    - [ ] Logs retained for audit trail
    - [ ] Alerts set for suspicious activity

### Iteration Process

1. **Developer Self-Review**: Developer audits own code for:
   - Logic correctness and edge cases
   - OWASP compliance (no injection, auth sound, secrets protected)
   - Test coverage adequate
   - Readability and naming
   - Performance issues (N+1 queries, etc.)

2. **Reviewer Audit**: Reviewer checks all 10 OWASP categories

3. **Iteration Loop:**
   - If issues found: Developer fixes then Reviewer re-checks
   - Count iterations against the one cap of 10
   - Exit when: 2 consecutive LGTMs from reviewer OR the cap of 10 iterations (no further round; escalate to the user: continue, waive, or abort)

**Approval:** `/do` records `✓ OWASP Clear` as `Writer: orchestrator`, only after the iteration loop completes and on the evidence basis in [Evidence for Gate Approvals](#evidence-for-gate-approvals-fr-221): the FR-217 pattern and secret scanner's exit plus a non-producer reviewer verdict with `file:line` findings

---

## LLM Security Review Gate

**When triggered:** Changes to the LLM surface: `agents/`, `skills/` (every file at any depth, `metadata.json` included), `rules/`, or `hooks/`, each at the repository root, under any `plugins/<name>/`, or under `.claude/`; any `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md` at any depth; and `.claude/settings*.json`. An application folder such as `src/hooks/` is not on the surface  
**Who reviews:** `reviewer` or `code-reviewer` agent  
**Authority:** Blocks merge

### Scope

These files are not documentation. They are executable instructions handed to a model with tool
access (agent prompts, skill definitions, routing logic, permission grants). They MUST be reviewed
with the same rigor as production application code, and this gate applies **in addition to**, not
instead of, the OWASP Top 10 gate above.

### OWASP Top 10 for LLM Checklist

Full checklist with per-category attack surface and verification items:
[llm-security-checklist.md](llm-security-checklist.md)

Covers: LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Supply Chain,
LLM04 Data and Model Poisoning, LLM05 Improper Output Handling, LLM06 Excessive Agency,
LLM07 System Prompt Leakage, LLM09 Misinformation/Overreliance, LLM10 Unbounded Consumption.
(LLM08 Vector/Embedding Weaknesses is out of scope: no vector store or RAG layer in this plugin.)

**Not fast-trackable:** This gate cannot be skipped under the Fast-Track Review rules below, even
for changes that look like "docs-only." The files named under **When triggered** (the `agents/`, `skills/`, `rules/`, and `hooks/`
folders, the instruction files, and `.claude/settings*.json`) are this plugin's executable surface.

**Approval:** `/do` records `✓ LLM Security Clear` as `Writer: orchestrator`, only on the evidence basis in [Evidence for Gate Approvals](#evidence-for-gate-approvals-fr-221): the exits of `check-fsa-tables.js --check`, `sync-writing-standard.js --check`, the health self-tests, and the FR-217 scanner, plus a non-producer reviewer verdict with `file:line` findings

---

## Planning Document Review Gate

**When triggered:** Output from planning-related tasks:
- `planner` agent: Architecture decisions, task planning documents, roadmaps
- `solutions-architect` agent: API specifications, data flows, schema designs, implementation contracts
- `requirements-gatherer` agent: Business Requirements Document (BRD), User Requirements Document (URD), Feature/Non-functional requirements lists

**Who reviews:** `reviewer` or `code-reviewer` agent

**Authority:** Blocks next step if review incomplete; creator must fix feedback; at the cap of 10 iterations the user decides (continue, waive, or abort)

### Review and Iteration Process

1. **Creator Self-Reflection (1 pass):** Creator reviews own document for completeness, clarity, feasibility
2. **Reviewer Audit:** Reviewer checks for:
   - Clarity and completeness
   - Technical feasibility (for solutions-architect docs)
   - Requirement coverage (for requirements-gatherer docs)
   - Alignment with architecture (for planning docs)
3. **Iteration Loop:**
   - Reviewer signs off with changes requested OR approval
   - If changes requested: Creator fixes then Reviewer re-checks
   - Track iterations (1, 2, 3, ... up to 10)
   - Exit condition #1: **2 consecutive LGTMs** from reviewer, then approved (document ready for next step)
   - Exit condition #2: **10 iterations reached** (the one cap), then run no further round and escalate to the user: continue, waive, or abort
4. **Approval:** Document is approved when reviewer signs: `✓ LGTM #2` (second consecutive approval)

### Iteration Tracking in Plan Files

Mark each iteration in the plan:

```
**Review:** Planning Document (Architecture)
- Iteration 1: Reviewer requests clarification on [X], add [Y]
- Iteration 2: Creator fixes then Reviewer LGTM #1
- Iteration 3: Creator adds [Z] detail then Reviewer LGTM #2
- Final: ✓ Approved (2 consecutive LGTMs)
```

### Approval Signatures

- `✓ Document Review Clear`: Reviewer has audited the document
- `✓ LGTM #1`: First approval (one more needed for gate clearance)
- `✓ LGTM #2`: Second consecutive approval (gate cleared)

### Escalation

If creator and reviewer cannot reach consensus by the cap of 10 iterations:
1. Run no further creator or reviewer round, and dispatch no `code-reviewer` pass
2. Escalate to the user with the unresolved findings and three choices: continue, waive, or abort
3. The orchestrator records a waive in the plan file (`.agent/main-plan/**`, orchestrator-written); abort fails the step
4. Only the user's answer picks a choice

---

## Reviewer Adversarial Self-Reflection

All review gates include a dedicated adversarial self-reflection phase for the reviewer, executed BEFORE the formal audit.

**Purpose:** Deliberately find issues (errors, inconsistencies, edge cases) to improve review quality and catch problems earlier.

### Checklist: What Reviewers Deliberately Look For

**Errors & Syntax:**
- [ ] Syntax errors (typos, malformed code/JSON/YAML)
- [ ] Logic errors (off-by-one, null pointer, infinite loop)
- [ ] Type mismatches (wrong type passed, return type inconsistent)
- [ ] Variable scope issues (shadowing, uninitialized variables)

**Inconsistencies:**
- [ ] Inconsistent with codebase (differs from project patterns)
- [ ] Inconsistent with requirements (doesn't match spec)
- [ ] Inconsistent with prior decisions (contradicts architecture)
- [ ] Inconsistent naming (mixes camelCase/snake_case, unclear terms)

**Assumptions & Edge Cases:**
- [ ] Questionable assumptions (is this guaranteed? what if it's null?)
- [ ] Missing null/empty checks (what if input is empty?)
- [ ] Boundary conditions (off-by-one in loops, fence-post errors)
- [ ] Error paths (what happens on failure? is it handled?)
- [ ] Concurrency issues (race conditions, deadlocks if concurrent)

**Security & Performance:**
- [ ] Injection vectors (SQL, command, script injection)
- [ ] Credential leaks (hardcoded secrets, PII in logs)
- [ ] N+1 query patterns (inefficient database access)
- [ ] Memory issues (leaks, unbounded growth)

**Clarity & Maintainability:**
- [ ] Unclear naming (variable/function names confusing)
- [ ] Missing comments (why is this done this way?)
- [ ] Over-commented code (comment states obvious)
- [ ] Can I follow the logic? (does it flow coherently)

### Reviewer Workflow

1. **Adversarial Self-Reflection** (before formal audit)
   - Read through entire submission
   - Deliberately try to find each category of issue above
   - Note potential problems/questions
   - Document findings

2. **Formal Audit** (using checklists)
   - Systematically check all items
   - Combine self-reflection findings + formal checklist
   - Make approval or revision decision

3. **Iteration Loop**
   - Creator addresses feedback
   - Reviewer repeats: adversarial self-reflection + formal audit
   - Exit: 2 consecutive LGTMs or the cap of 10 iterations (escalate to the user, no further round)

**Note:** Adversarial self-reflection is not a separate gate. It is a pre-audit step to improve the quality of the formal review.

---

## Testing Coverage Gate (>=70%)

**When triggered:** Code changes in production code  
**Who reviews:** `qa` agent  
**Authority:** Blocks merge if coverage below threshold

### Coverage Requirements

- **Overall bar:** >=70% coverage for new/changed code, measured across unit and integration tests together
- **Edge cases:** Error paths tested

### Coverage Validation

```bash
# Run coverage before merge
npm run test:coverage  # or equivalent

# Must show: Overall coverage >=70%
# Must show: No critical paths uncovered
```

**Approval:** `/do` records `✓ Coverage >=70%` as `Writer: orchestrator`, only on a `gate-evidence` record that holds the command, the exit code, and the value (see [Evidence for Gate Approvals](#evidence-for-gate-approvals-fr-221)). A qa-authored sign-off string never clears it.

---

## Code Review Gate (Sign-Off)

**When triggered:** High-risk or security-sensitive changes  
**Who reviews:** `code-reviewer` agent  
**Authority:** Formal sign-off required

### Review Dimensions

1. **Correctness**: Logic sound? No bugs?
2. **Performance**: Efficient? No N+1 queries?
3. **Readability**: Clear and maintainable?
4. **Architecture**: Follows conventions?
5. **Testability**: Code is testable?

### Iteration Process

1. **Developer Self-Review**: Developer audits own code against the 5 review dimensions

2. **Code Reviewer Audit**: Line-by-line review on all dimensions

3. **Iteration Loop:**
   - If changes requested: Developer fixes then Code reviewer re-audits
   - Count iterations against the one cap of 10
   - Exit when: 2 consecutive LGTMs from code-reviewer OR the cap of 10 iterations (no further round; escalate to the user: continue, waive, or abort)

**Approval:** `/do` records `✓ Approved for merge` as `Writer: orchestrator`, only after the iteration loop completes and on the evidence basis in [Evidence for Gate Approvals](#evidence-for-gate-approvals-fr-221): the recorded exits of the other gates plus a `code-reviewer` verdict, from a `code-reviewer` that did not produce the artifact, with `file:line` findings

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
| Testing (>=70%) | Low (high coverage) | ~3 min |
| Testing (>=70%) | High (low coverage) | ~10 min |
| Code Review | Low (small change) | ~10 min |
| Code Review | High (complex change) | ~30 min |

---

## Merge Policy

**Before merge, ALL gates must be passed:**

- [ ] Security review: ✓ OWASP Clear, backed by the FR-217 scanner exit and a non-producer reviewer verdict
- [ ] LLM security review: ✓ LLM Security Clear (required whenever the change touches the LLM surface named under [LLM Security Review Gate](#llm-security-review-gate): `agents/`, `skills/` at any depth with `metadata.json`, `rules/`, and `hooks/` at the repository root, under any `plugins/<name>/`, or under `.claude/`; any `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md` at any depth; and `.claude/settings*.json`)
- [ ] Testing: ✓ >=70% coverage, backed by a `gate-evidence` record (command, exit code, value)
- [ ] Code review: ✓ Approved (if applicable), backed by a non-producer `code-reviewer` verdict with `file:line` findings
- [ ] Code review iterations tracked in plan file (one cap of 10, then escalation to the user; or 2 consecutive LGTMs = approved)
- [ ] Commit format: ✓ Conventional Commits
- [ ] Commits squashed: ✓ Clean history (if requested)

**Merge blocked if:**
- Any gate fails
- Any gate has no evidence reference (a sign-off string alone never clears a gate)
- Test suite fails
- Conflicts with main
- Author has < 2 hours since last commit (prevents race conditions)

Changes to the LLM surface named under [LLM Security Review Gate](#llm-security-review-gate) are only mergeable once **both** the OWASP (application) gate
and the OWASP for LLM gate are signed off: `✓ OWASP Clear` and `✓ LLM Security Clear` must both
appear in the commit message or plan file for traceability.

---

## Fast-Track Review

For low-risk changes (docs, tests, refactoring):

1. **Security gate:** Can skip if no production code changes
2. **LLM security gate:** Cannot be skipped for changes to `agents/`, `skills/` (every file at any depth,
   `metadata.json` included), `rules/`, or `hooks/`, each at the repository root, under any `plugins/<name>/`, or
   under `.claude/`; any `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md` at any depth; or `.claude/settings*.json`
   (not an application folder such as `src/hooks/`). These are
   the plugin's executable surface, not documentation, regardless of how the change looks
3. **Testing gate:** Always required if logic changes
4. **Code review:** Optional if change is obvious/non-critical

Mark in plan: `**Review:** Low-risk (no production code)`

---

## Worktree and Cache Cleanup

**Rule:** After a task done in a git worktree is merged, remove the finished worktree, delete its merged branch, and clear the Go build cache. `/do` runs this automatically (the Cleanup state) and only for the exact worktrees its steps created; `/branch cleanup` sweeps all linked worktrees on demand.

**Guards:**
- Never touch the main worktree, the current worktree, or the default, `main`, `master`, or `develop` branches
- Remove only worktrees whose branch or commit is an ancestor of the default branch, that are clean (untracked files count as dirty), unlocked, and have names matching `^[A-Za-z0-9._/-]+$`
- Squash-merged and rebase-merged branches show as `not merged` and are kept
- Never use `git worktree remove --force`, `git branch -D`, `git clean`, or `rm -rf`; if git refuses, report and keep the item
- Stale worktree entries are listed from `git worktree prune --dry-run --verbose`, not pruned

**Cache scope:** `(cd "$HOME" && go clean -cache -testcache)` only (module cache untouched). Rust (`CARGO_TARGET_DIR`) and Gradle clean commands are reported for the user, not run. In-worktree directories go away with the worktree, and ignored files are listed before removal.

Procedure: [worktree-cleanup.md](../skills/branch/references/worktree-cleanup.md)

---

## No AI Attribution Rule

**Rule:** Never add a Co-Authored-By trailer or any other attribution line for an AI tool to a commit message or a pull request body. This holds whether the message comes from `/commit`, `/bump`, a plain prompt, or an agent. Human co-authors are fine, but a co-author named only Claude or Devin, or whose name contains a tool name, counts as the tool.

**Lines that count as AI attribution:**
- A `Co-Authored-By:` trailer whose name or email names an AI tool or vendor (an address at anthropic.com or openai.com counts only when it is a noreply address)
- A "Generated with" or "Generated by" footer that names an AI tool
- An `Assisted-by:` or `Generated-by:` trailer that names an AI tool
- A `*-Session:` trailer that points at an AI host, or a bare AI session link

**Enforcement:** the `commit-attribution-guard` hook denies `git commit` and `git merge` (with `-m`, `--message`, `-F`, `--file`, `--trailer`) and `gh pr create` and `gh pr edit` (with `--body`, `-b`, `--body-file`, `-F`) when the message or body holds such a line. The denial lists up to 5 lines to remove. The hook never rewrites the command and fails open. It does not cover `git tag`, `gh pr merge --subject/--body` (the squash commit message), a message built from a variable, or a message piped through stdin, so the rule still binds whoever composes the message.

**Claude Code setting:** When `attribution.commit` is unset or not `""`, Claude Code's instructions ask you to end the commit message with a Co-Authored-By trailer or a session link. When `attribution.pr` is unset or not `""`, they ask for an attribution footer in the PR body. Leave those lines out even then; the commit-attribution-guard denies them. `/assist-plugin:health` reports, read-only, when either setting is unset or not empty. If your instructions asked for such a line, tell the user once that `{"attribution": {"commit": "", "pr": ""}}` in their Claude Code settings turns these settings off. Never edit a settings file yourself.

**Push grants:** Scope each push grant in `permissions.allow` to a named remote, `Bash(git push origin *)` and, for a mirror, `Bash(git push <mirror-name> *)`, in place of `Bash(git push *)`. More than one named remote is fine. `/assist-plugin:health` reports, read-only, a wildcard or unscoped push grant (`Bash(git push *)`, `Bash(git push:*)`, or a broader entry that lets `git push` reach any remote) and never a grant that names a remote. The check never writes a settings file; if a wildcard grant is reported, tell the user once which grants to apply in `.claude/settings.local.json` or `.claude/settings.json`. Never edit a settings file yourself.

---

## Hook Fail-Open Rule

**Rule:** Plugin hooks (`hooks/`) block a tool call only when the guard logic positively matches a prohibited command. Every other outcome lets the command proceed: a thrown error, uncaught exception, unhandled rejection, stdin or input error, timeout, unsupported Node version, health-log write failure, or a guard disabled by `hooks-disabled.json`.

**Exception (security-critical guards, NFR-028):** A guard on the named security-critical list denies its own guarded operation class when it cannot evaluate because of an error, a timeout, or an unreadable or malformed configuration. The list is the PR verdict guard (FR-214), any hook-level wiring of FR-217, and the controls FR-220, FR-223, FR-231, FR-233, and FR-246. Such a guard passes an optional `failClosedFor(input)` classifier to `guard()`; the classifier must be cheap, must not throw, and returns true only for a call in the guarded class. When `evaluate` throws, an uncaught exception or unhandled rejection occurs, or the watchdog times out after the input was parsed, and the classifier returns true, the runtime prints the `permissionDecision: "deny"` JSON, exits 0, and appends the failure to `hook-health.jsonl`. Every other case still proceeds: a call outside the class (for example `ls`), a stdin error, malformed input, a classifier that throws, a guard disabled by `hooks-disabled.json`, and every guard that declares no classifier. An absent `.agent/governance/profile.json` is not an error: the controls run log-only and never hard-deny. A malformed `profile.json` while a profile is enforced denies the guarded class until the file is fixed. The exception still never exits non-zero to block.

**Requirements for hook code:**
- Deny only through the `permissionDecision: "deny"` JSON with exit 0 returned by the decision function `evaluate(input)` of a guard, whose only I/O is file reads that a test can replace; a guard asks only through the `permissionDecision: "ask"` JSON with exit 0 when `evaluate` returns `ask: true` (the PR posting ask hook); never exit 2 and never exit non-zero to block. The one other deny is the fail-closed deny of a security-critical guard (the exception above)
- On any failure print only `{"systemMessage": "..."}` to stdout and exit 0, except a guarded-class call of a security-critical guard, which prints the deny JSON and exits 0 (the exception above); if that write fails, exit 0 silently
- Every hook command goes through an ES5 entry file (`hooks/*.js`) that gates the Node version before loading the real module; set `timeout` in `hooks.json`
- Record failures in `${CLAUDE_PLUGIN_DATA}/hook-health.jsonl` without command text, arguments, environment values, or stdin
- A guard whose self-test denies a known-safe command, and a filter (`injection-filter`, `prose-advisor`, `fsa-log`) whose self-test fails in any way, is auto-disabled (with a warning) and stays listed until a later self-test passes every case; a guard that only misses a known-prohibited command keeps its state; a failed `writing-context` or `goal-guard` self-test is reported only; a guard whose self-test asks on a known-safe command (the PR posting ask hook) is treated like one that denies it. `/assist-plugin:health` shows the state
- The `fsa-write-bar` shell route (FR-223) is on the security-critical list above and passes `failClosedFor` to `guard()`: an error or timeout after the input was parsed denies a subagent `Bash` command that names a protected path, and every other call fails open as before. Its self-test denies a known-safe command only if the bar has a bug, so such a result disables the whole bar like any guard ([Shell Write Path](#shell-write-path))
- The `pr-verdict-guard` (FR-214) denies `gh pr review` with any verdict flag (`--approve`, `--request-changes`, `--comment`) and `bkt pr approve` or `decline` for a PR unless `.agent/governance/confirmations/confirmations.jsonl` holds a confirmation for that PR and verdict. It reads that file by file reads alone and never `pending.jsonl`, so a pending-action record never satisfies it. The denial names the missing confirmation and repeats no command text beyond the PR number and the verdict; on an allow it logs the confirmation reference to `pr-verdict-log.jsonl`. It is on the security-critical list above and passes `failClosedFor` to `guard()`, so an error or timeout after the input was parsed denies a command that looks like a PR verdict post. It is additive (PN-5): `pr-post-ask` stays unchanged and is not suppressed, a deny from the guard wins over the `pr-post-ask` ask, and after a recorded confirmation the user may still see the `pr-post-ask` prompt (two prompts, accepted as defense in depth). It does not cover `bkt pr comment`, a `bkt api` call, `gh pr merge`, `close`, or `comment`, or a SARIF upload; those keep the `pr-post-ask` ask and the flow's confirmation. Like `pr-post-ask`, it is best-effort: it does not read a verdict post inside a command substitution or a command string run by another program
- The `prose-gate` denies a write to a prose file only when the text the write adds holds a block-tier tell (em dash, chatbot residue, curly quote, summary label); text already in the file is never judged. The `prose-advisor` and `writing-context` never block. Like every guard, all three fail open
- The `commit-attribution-guard` denies a git or gh command only when the message or body it can read holds an AI attribution line; a message it cannot see passes ([No AI Attribution Rule](#no-ai-attribution-rule))
- The `injection-filter` is defensive and fail-open: it rewrites a tool result or subagent prompt only on a positive rule match (and asks the user to confirm a rewritten subagent prompt), never blocks, only warns about the user's own typed prompt, and is auto-disabled if its benign/injection self-test corpus fails
- The `goal-guard` (FR-219, FR-238) is an advisory, rule-based alignment check on `WebFetch`, `WebSearch`, and `mcp__*` results (`PostToolUse`, `timeout` 5). It matches a fixed rule set in `hooks/lib/hijack-rules.js` against attacker-controlled text, so it calls no model and makes no network request (decision D-13, NFR-027), holds no write tool, and adds no tool grant. On a match it appends a `goal-guard` would-deny record to the governance audit log (rule id and family, rule count, tool name, agent identity), and when nothing matches it appends a `pass` record (tool name and agent identity, no rule id); neither holds the result text, a URL, a query, a path, or a secret, and a tool or event outside the matcher leaves no record. The hook withholds, rewrites, and prints nothing, so it never blocks and never exits non-zero. It fails open: a failed or refused append is noted in `hook-health.jsonl` and the result proceeds. The rules are a heuristic signal, not a boundary. It does not read the user's goal. Promotion to blocking is a later step (Tranche 4) and needs the FR-238 baseline first. Its self-test is report-only: a failure reports weak detection and never disables the hook

---

## Write guard lists

`fsa-write-bar` enforces these lists from `hooks/lib/fsa-paths.js`. This section is the source of truth: `node plugins/assist-plugin/scripts/check-fsa-tables.js --check` exits 1 while the code differs, and the fix is to edit the JavaScript. The first column holds the exact code string. Removing or narrowing an entry under Protected globs, Protected files, or Auto-loaded names, or any change to the Task-plan glob, needs a user decision recorded in `DECISIONS.md` before the JavaScript follows this section. The Protected globs and Protected files also bind a subagent `Bash` command ([Shell Write Path](#shell-write-path)).

### Protected globs

| Glob | Meaning |
|---|---|
| `**/.agent/main-plan/**` | The `/do` plan files, which hold sign-off and waiver state; no subagent writes them |
| `**/.agent/governance/confirmations/confirmations.jsonl` | The user's PR-verdict confirmations, written only by the `UserPromptSubmit` confirmation hook; `fsa-write-bar` denies a write of it to every caller, the main session included |
| `**/.agent/governance/confirmations/pending.jsonl` | The pending PR-verdict actions that the main-session `/do` orchestrator writes; no subagent writes it, the main session may |
| `**/.agent/logs/governance/**` | The governance audit log: the hash-chained `audit.jsonl`, its rotated segments, and its lock file, written by the guard runtime and the audit-writer hook through `hooks/lib/audit-chain.js`; no subagent writes it |

### Protected files

| File name | Meaning |
|---|---|
| `DECISIONS.md` | The decision log, in any directory; no subagent writes it |

### Auto-loaded names

| File name | Meaning |
|---|---|
| `CLAUDE.md` | Claude Code loads it into later sessions |
| `CLAUDE.local.md` | Claude Code loads it into later sessions |
| `AGENTS.md` | Claude Code loads it into later sessions |

### Task-plan glob

| Glob | Meaning |
|---|---|
| `docs/task-plans/task-plan-*.md` | The only files `task-planner` writes: a `task-plan-*.md` file directly under `docs/task-plans/` of the git root of the session's working directory (a worktree uses its own root); root-level task plans in older projects are read, never written |

---

## Shell Write Path

`fsa-write-bar` also judges a `Bash` call from a subagent (an `agent_id` is present), so the protected paths in [Write guard lists](#write-guard-lists) cannot be written through the shell. `hooks/lib/shell-writes.js` reads the command and returns the paths it would write; the call is denied when one of them is on the Protected globs or Protected files lists (`.agent/main-plan/**`, `DECISIONS.md`, `.agent/logs/governance/**`, and the confirmation store), and any path a later step adds to those lists is covered without a change here.

- **Forms judged:** output redirection (`>`, `>>`, `>|`, `N>`, `>&FILE`, and a here-document that feeds a redirected command), `tee`, `sed -i`, `perl -i`, `cp`, `mv` (the source too, because it is removed), `rm`, and the same-shaped `unlink`, `rmdir`, `shred`, `truncate`, `touch`, `dd of=`, `install`, `ln`, `curl -o`, and `wget -O`. Each lexed part of a chained command is judged on its own. The text of a `$( )` substitution, `eval`, `sh -c` and `bash -c`, and a here-document that feeds a shell is judged as a command of its own.
- **Reads stay allowed:** `cat DECISIONS.md`, `grep x .agent/main-plan/plan.md`, and `<` input redirection yield no write target. A write to any other path is not judged, and the per-agent limits (test paths, task-plan scope, dot paths) apply to the four write tools only.
- **Names the shell expands:** a glob in a target (`DECISION?.md`, `.agent/main-pl*/p`), a quoted or escaped spelling (`DECI""SIONS.md`, `$'\x44ECISIONS.md'`), a relative target under a protected directory (after `cd .agent`, or when the session's working directory is inside one), and `rm -rf` or `mv` of a directory that holds a protected path (`rm -rf .agent`) are judged. A glob whose literal part could spell a protected file is denied: `rm *.md` could match `DECISIONS.md`, so a command that needs to remove Markdown files names them. A copy or move into a directory (`cp /tmp/DECISIONS.md .`, `mv x .agent/main-plan/`) is judged by the file it creates in that directory; a destination without a trailing slash counts as a directory when it exists as one. A target made only of a variable or wildcards (`> "$OUT"`, `rm -rf build/*`) is not judged.
- **Main session:** not judged on this route. As for the write tools, only a subagent is barred, except that `confirmations.jsonl` stays denied to every caller of a write tool.
- **Fail-closed (NFR-028, FR-223):** `fsa-write-bar` passes `failClosedFor` to `guard()`. An error, an uncaught exception, or a timeout after the input was parsed denies a subagent `Bash` command that names a protected path (loosely, quotes ignored and `\xNN` escapes decoded); a command outside that class, a write-tool call, unreadable input, and a disabled guard proceed with a warning as before. A command or a target too long or too deeply nested to read is denied outright. Each denial is logged to the governance audit log under the rule id `fsa-write-bar.shell-write`.
- **Known limits, recorded and not closed:** a command built from a variable (`$CMD x`, `eval "$X"`, `bash -c "$X"`) or run from a script file; a command string passed to another program (`python -c`, `node -e`, `awk`, `find -exec`, `xargs` fed from a pipe, `git checkout -- FILE`, `rsync`), and a script piped into a shell; symlinks and other aliases of a protected path, which are not resolved; `rm -rf .` and other removals that name a directory above a protected path only as `.` or a variable; PowerShell write verbs (`Set-Content`, `Out-File`, `Move-Item`), which FR-223 does not name and the `Bash` registration does not see; and the main session, which the shell route does not judge. The bar is a guardrail with these gaps, not a boundary against a determined agent.

---

## PR Confirmation Token Rule

A PR verdict posts only after the user confirms it with a per-action token. The token binds the confirmation to one PR and one verdict, so a pasted or injected "yes" confirms nothing.

- **Format:** 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (letters and digits without I and O). The user may type it in any case.
- **Lifetime:** single-use, and it expires 5 minutes after the pending record is written (an estimate, not a measured figure, until it is set against the NFR budget).
- **Placement:** `/do` writes the pending-action record (PR, verdict, token, `session_id`, creation timestamp) to `.agent/governance/confirmations/pending.jsonl` and shows the token next to the option it belongs to. The user confirms by including that token in their own typed chat message. A token on a quoted line (starting with `>`) or inside a code fence is ignored, and a token in PR text, a file, or a tool result never counts.
- **Writers:** `/do` writes `pending.jsonl` and never `confirmations.jsonl`. The `confirmation-record` hook (`UserPromptSubmit`) writes `confirmations.jsonl` only when the user's message carries the token of an unused, unexpired pending record of the same session, then consumes the token by marking that record used. An affirmative without the token, and an unknown, used, expired, or other-session token, record nothing. A pending record carries no authority; only the hook's confirmation record does.
- **Scope:** one confirmation covers one PR and one verdict. The record holds a reference to the user's message, never its text (NFR-031).
- **Fail-open for the prompt:** a hook failure lets the user's message through and records no confirmation; the PR-verdict guard then has nothing to allow. The [Hook Fail-Open Rule](#hook-fail-open-rule) applies.

Flow detail: [pr-review-flow.md](../skills/do/references/pr-review-flow.md#confirm).

---

## Governance Enforcement

- **Automated:** CI/CD pipeline enforces coverage gates
- **Manual:** Agents enforce OWASP checks
- **Manual:** Agents enforce OWASP for LLM checks ([llm-security-checklist.md](llm-security-checklist.md)) on every change to the LLM surface named under [LLM Security Review Gate](#llm-security-review-gate)
- **Manual:** code-reviewer gives formal sign-off
- **Automated:** the SessionStart health check self-tests the hook guards and warns only when something is wrong ([Hook Fail-Open Rule](#hook-fail-open-rule))
- **Escalation:** code-reviewer makes final call on disputes

