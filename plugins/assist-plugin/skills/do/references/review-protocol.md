# Review Protocol

Procedure for executing code review gates and validation loops in the `do` orchestrator.

## Overview

Review happens AFTER implementation steps. Goals:
- Detect bugs and architectural issues
- Enforce OWASP security standards
- Validate test coverage (>=70%)
- Obtain formal sign-off before merge

**Sole writer of approval status (FR-222).** A review verdict or approval status is recorded only by the orchestrator (`/do`) or by a hook. The agent that produced the artifact under review never writes that artifact's status, and a reviewer's `✓` line is a finding that `/do` reads from the terminal block and then records. Every **Approval:** line below names the status `/do` records, not a string a producer writes. `/do` marks each record `Writer: orchestrator`, as "Approval Tracking" shows. A producer's write to `.agent/main-plan/**` is already denied by the `fsa-write-bar` protected glob and the Shell Write Path, so this rule matches the enforcement.

**Evidence for every gate (FR-221).** `/do` records a gate as cleared only with an evidence reference; a `✓` line or a sign-off string that a model emits never clears a gate, and a gate with no evidence reference stays open so the merge check blocks. A deterministic gate (Coverage >=70% and any test-runner exit) clears only on the `gate-evidence` hook's record in the governance audit log: the command identifier, the exit code, and the measured value. The hook reads a `PostToolUse` success event as exit 0 and takes the exit status of a `PostToolUseFailure` event from the "Exit code N" that begins its `error` field. When the orchestrator reads `gate-evidence` records to clear a deterministic gate, it MUST dedupe the records that share a `tool_use_id` and prefer the failure: if any record for that `tool_use_id` reports a non-zero exit code, or comes from a `PostToolUseFailure` event, the gate does not clear, whatever an exit-0 sibling says. Only an unambiguous success (exit 0 and no failure sibling) clears. This holds even if the platform ever fires `PostToolUse` for a failed run, since the hook may write both records and the reader resolves them. A judgement gate (OWASP Clear, LLM Security Clear, Approved for merge) clears only on an in-plugin scanner exit code together with a verdict from a reviewer other than the producer, carrying `file:line` findings. The gate-to-scanner mapping is fixed, and no gate needs an external scanner installed:

| Gate | In-plugin scanner evidence | Plus |
|---|---|---|
| OWASP for LLM Clear | `check-fsa-tables.js` and `sync-writing-standard.js` and the health self-tests, with the FR-217 pattern and secret scanner | A non-producer reviewer verdict with `file:line` findings |
| Code Security / OWASP Clear | The FR-217 pattern and secret scanner | A non-producer reviewer verdict with `file:line` findings |
| Coverage >=70% | The test runner's coverage exit (the `gate-evidence` record) | The parsed coverage value |
| Approved for merge | The aggregate of those exits | A verdict from a `code-reviewer` other than the producer |

The gate record fields are `command`, `exit code`, `value`, and `evidence reference` (see "Approval Tracking" and `plan-format.md`).

**Evidence basis of a judgement gate.** A judgement gate clears only on both pieces together: (1) the exit code of the gate's in-plugin scanner from the table above, read from the `gate-evidence` record for that run (a scanner run with no record, or a non-zero exit, leaves the gate open), and (2) a verdict from a reviewer that did not produce the artifact, carrying `file:line` findings. A verdict from the producer does not count, so `/do` dispatches a reviewer other than the producer. Reviewers stay read-only (`tools: [Read, Grep, Glob, LSP]`): the verdict in the terminal block is evidence, and the orchestrator reads it and writes the gate record as `Writer: orchestrator`, naming the scanner command, its exit code, the evidence reference, and the reviewer verdict. A model sign-off string never supplies either piece. An external scanner (semgrep, CodeQL) is optional extra evidence and a gate never depends on one.

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

**When:** Applied in all review gates: OWASP, Code Review, Planning Documents

See [governance rule: Reviewer Adversarial Self-Reflection](../../../rules/assist-plugin-rule.md#reviewer-adversarial-self-reflection) for detailed checklist.

---

## Review Triggers

A step REQUIRES review if:
1. It produces or modifies code files, OR
2. It requires governance gate (security, testing, approval)

**Agents that DO review:** reviewer, code-reviewer, and qa (Testing Gate only)  
**Agents that RECEIVE review:** developer, developer-tester, devops, qa  
**Agents never gated:** reviewer, code-reviewer, and intake-reviewer, whose output is findings; ask and explore, which write no files

---

## Which gate applies to which artifact

`/do` picks the gate from the artifact type a step produced. Every code, planning, and OWASP for LLM gate has one cap of 10 iterations, and two consecutive LGTMs are the normal pass.

| Artifact | Gate | Reviewer | Bound |
|---|---|---|---|
| Code (source, config, tests, pipelines) | Pre-Test Code Review Gate, then Security Gate (when code or devops changed), Testing Gate, and Code Review Gate | reviewer or code-reviewer; qa for the Testing Gate | 2 consecutive LGTMs, or escalation to the user at 10 iterations per gate |
| Planning documents (planner, solutions-architect, requirements-gatherer output, including plans, roadmaps, specs, and task-plans; task-planner output counts) | Planning Document Review Gate | reviewer or code-reviewer | 2 consecutive LGTMs, or escalation to the user at 10 iterations |
| Markdown reports (RCA, PR review verdict, answer, findings doc, generated documentation); the draft of a `/do` PR review is not one | Report Quality Gate | `review-md` | 3 rounds |
| Any LLM-surface file, in addition to the gate for the artifact's type | OWASP for LLM Gate | reviewer or code-reviewer, against `rules/llm-security-checklist.md` | 2 consecutive `approved`, or escalation to the user at 10 iterations per gate |

A planning document written as markdown goes through the planning gate. It does not also go through the Report Quality Gate, so one artifact never runs two document gates. The execution plan file `/do` writes under `.agent/main-plan/` is not an artifact of any step and runs no gate.

### What the gate prompt carries

The reviewer's Intake checks the inputs below, and the reviewer cannot learn them any other way. The `/do` gate prompt states all of them:

- The gate name (Pre-Test Code Review, Security, Testing, Code Review, Planning Document Review, or OWASP for LLM Gate).
- The artifact type: code, config, test, pipeline, or planning document. The OWASP for LLM Gate prompt names artifact type `code` for every LLM-surface file, a `CLAUDE.md` or agent wording change included, so the reviewer's Intake accepts it.
- For the OWASP for LLM Gate: the absolute path of the checklist, `<base>/../../rules/llm-security-checklist.md`, computed from the `do` skill base directory the way [SKILL.md](../SKILL.md) computes `<base>/../debug/SKILL.md` for a debug step. The reviewers cannot learn that path any other way.
- The artifact paths.
- The rework count: 0 the first time, then the number of fix passes so far. An agent that finds no count reads it as 0.
- The prior findings, when the count is above 0, inside a labelled `<review-findings>` data wrapper with every `<` escaped as `&lt;`.
- For a planning-gate reviewer: cite `file:line` and paraphrase, never quote document text.
- For code, the producer's terminal-block `verdict` and `skipped:` markers, copied as they stand. The developer's `verdict` is `self-check=pass`, `self-check=fail`, or `self-check=not-run`. The Pre-Test reviewer reads them to see which checks the producer skipped.
- The "Dispatch prompt text" from [fsa-template.md](fsa-template.md#dispatch-prompt-text), pasted in full.

### Exhausting a gate

Every code, planning, and OWASP for LLM gate has one cap of 10 iterations, and two consecutive LGTMs are the normal pass. Review passes and fix passes count toward the same cap. A gate that reaches the cap without approval ends the loop: `/do` runs no further developer or reviewer round, dispatches no `code-reviewer` pass, and never rewrites the artifact itself. It escalates to the user, presenting the unresolved findings with three choices:

| Choice | Result |
|---|---|
| `continue` | The user authorizes more rounds. The gate resumes with the same prompt and the findings, and escalates again each time it reaches the cap |
| `waive` | The step is `completed`. The orchestrator records the waiver and the unresolved findings in the step's Review field, and adds the bullet "Gate waived: <gate>, step <n>, YYYY-MM-DD HH:mm" under `## User Decisions` in the plan file (`.agent/main-plan/**`, written by the orchestrator only, as for every other waiver) |
| `abort` | The step is `failed`, and the findings are recorded in the step's Done field |

Only the user's answer picks a choice. A reviewer verdict, a producer reply, or a Clarify answer never waives a gate. The Report Quality Gate differs because `review-md` and the producing agent hold the loop (see that gate).

### Reading a gate's outcome

`/do` reads the outcome from the `verdict` field of the reviewer's terminal block (see [fsa-template.md](fsa-template.md)):

| Verdict | Meaning | Next |
|---|---|---|
| `approved` | The reviewer found nothing to fix | Counts as one LGTM; the gate exits at two in a row |
| `returned` | The reviewer listed findings | Fix phase on Sonnet, then re-review |

`review-md` reports "No issues found" or a findings document. `/do` reads the first as `approved` and the second as `returned` until `review-md` writes a `verdict` field of its own. The Testing Gate's reviewer is qa, and its `verdict` is `approved` or `returned` as well (see the Testing Gate). A reviewer reply with no terminal block counts as `Error` with class `no-terminal-block`: `/do` sends one retry that repeats the "Dispatch prompt text", then fails the step. A gate that reaches the cap with `returned` verdicts ends as "Exhausting a gate" describes.

---

## Review Output Rules

Every review verdict, findings list, and PR review comment follows these rules, on top of [rules/writing-standard.md](../../../rules/writing-standard.md). The `reviewer` and `code-reviewer` agents and the `pr-review` skill link here.

- **Start with the verdict or the first finding.** No reasoning preamble; never restate the PR, the diff, or the task.
- **Let the findings set the length.** Zero findings is one line (for example, `LGTM. No findings.`). Each finding is location (`file:line`), problem, fix.
- **Verify before reporting.** Re-read each finding at its file and line before it goes in the report; drop any finding you cannot confirm there. Never report a finding you have not re-read in the source.
- **Report only what changed on a re-review.** List new and still-open findings; give resolved ones one line (`Resolved: auth.ts:42, auth.ts:88`). Never repost earlier findings.
- **No padding.** No praise, no generic advice ("consider adding more tests"). When another reviewer already raised a point, add one line of agreement instead of reposting it.

---

## Review Gate Checklist

### Pre-Test Code Review Gate

**Triggered by:** After `developer` implements code (before `developer-tester`/`qa` run tests)  
**Reviewed by:** reviewer or code-reviewer  

**Purpose:** Syntactic + semantic consistency check on both implementation and any test files already present.

**Process:**
1. Developer self-reviews implementation against syntax, type checking, and semantic consistency
2. Reviewer conducts adversarial self-reflection (see below)
3. Reviewer audits code for:
   - Syntactic correctness (compiles, no parse errors)
   - Semantic consistency (follows project patterns, naming conventions, code style)
   - Coherence with specs and task-plan steps
   - Any test files already present are included in this review (their findings go to `developer-tester`)
4. If issues found: the fixing agent fixes → Reviewer re-audits. Findings on test files go to `developer-tester`; the developer never writes tests. Findings on other files go to the producing agent
5. Exit: 2 consecutive LGTMs, or the cap of 10 iterations (escalate to the user, no further round; see "Exhausting a gate")

**Approval:** `✓ Pre-Test Review Clear` (after iteration complete)

---

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

1. **Injection:** SQL, command, script injection prevented?
2. **Broken Auth:** Authentication logic sound? Passwords hashed?
3. **Sensitive Data:** No hardcoded secrets? PII encrypted?
4. **XML/XXE:** XML parsing is safe?
5. **Broken Access Control:** Authorization checks present?
6. **Security Misconfiguration:** Default configs changed? CORS restricted?
7. **XSS:** User input sanitized? Output encoded?
8. **Deserialization:** Untrusted input deserialized safely?
9. **Using Components:** Dependencies up-to-date? Known vulns checked?
10. **Logging & Monitoring:** Security events logged?

### Iteration Process

1. **Developer Self-Review:** Developer checks code against OWASP categories
2. **Reviewer Audit:** Reviewer checks all 10 categories
3. **Iteration Loop:** If issues found: the fixing agent fixes (test-file findings go to developer-tester) → Reviewer re-checks
4. **Exit Conditions:**
   - 2 consecutive LGTMs from reviewer: Approved
   - 10 iterations reached: no further round; escalate to the user with continue, waive, or abort (see "Exhausting a gate")

**Evidence:** the gate clears on the FR-217 pattern and secret scanner's recorded exit plus a verdict from a reviewer that did not produce the artifact, carrying `file:line` findings. The reviewer's `✓` line alone never clears it.

**Approval:** `✓ OWASP Clear` (after iteration complete), which `/do` records as `Writer: orchestrator` only on that evidence

---

### OWASP for LLM Gate

**Triggered by:** Any non-reviewer step whose artifacts change the LLM surface, run in addition to the gate that matches the artifact's type. The LLM surface is `agents/`, `skills/` at any depth (`metadata.json` included), `rules/`, and `hooks/`, each at the repository root, under any `plugins/<name>/`, or under `.claude/`; any `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md` at any depth; and `.claude/settings*.json` at the repository root. An application folder such as `src/hooks/` is not on the surface.  
**Reviewed by:** reviewer or code-reviewer, auditing against `rules/llm-security-checklist.md`  
**Prompt:** gate name "OWASP for LLM Gate", artifact type `code` for every LLM-surface file, and the checklist path (see "What the gate prompt carries").  
**Position:** after the Security Gate and before the Testing Gate for a code artifact; after the type's gate clears for any other artifact type. A Report Quality Gate that ends "completed with findings attached" counts as cleared, so this gate still runs after it; a step whose type gate fails does not reach it.

**Iteration Process:** the Security Gate's cap applies. Exit on 2 consecutive `approved` verdicts, or at the cap of 10 iterations run no further round and escalate to the user with continue, waive, or abort (see "Exhausting a gate"). The main agent never rewrites the artifact. The fix phase is the usual one (Sonnet, findings routed by path inside the gated step's Writes).

**Evidence:** the gate clears on the recorded exits of `check-fsa-tables.js --check`, `sync-writing-standard.js --check`, the health self-tests, and the FR-217 scanner, plus a verdict from a reviewer that did not produce the artifact, carrying `file:line` findings. The reviewer's `✓` line alone never clears it.

**Approval:** `✓ LLM Security Clear` (after iteration complete), which `/do` records as `Writer: orchestrator` only on that evidence. `✓ OWASP Clear` never stands in for it.

---

### Testing Gate (>=70% Coverage)

**Triggered by:** Code changes  
**Reviewed by:** qa agent  
**Checklist:**

1. **Unit Tests:** Core functions tested?
2. **Integration Tests:** Components work together?
3. **Edge Cases:** Error paths tested?
4. **Coverage:** New code >=70% covered?
5. **Regression:** Existing tests still pass?

**Verdict:** qa ends its terminal block with `verdict: approved` or `verdict: returned`. `approved` means the suites ran, passed, and met the >=70% bar for new code. `returned` means anything else: a test failed, coverage fell short, or a suite could not run. `/do` reads the gate outcome from that field. Any other value, or no block, counts as in "Reading a gate's outcome".

**On `returned`:** the fix phase routes test gaps to `developer-tester` and code defects to the producing agent, then qa reruns. The gate exits at 2 consecutive `approved` verdicts or at the cap of 10 iterations, when `/do` runs no further round and escalates to the user with the last qa report and the unresolved findings (see "Exhausting a gate").

**Evidence:** the gate clears on the `gate-evidence` record for the run, not on the qa verdict string. The record holds the command identifier (for example `npm run test:coverage`), the exit code, and the parsed coverage value; qa's report quotes the same three facts. With no record for the run, or a value below 70, the gate stays open whatever qa wrote.

**Approval:** `✓ Coverage >=70%`, which `/do` records only on that `gate-evidence` record (command, exit code 0, value >=70) and never on a qa sign-off string.

---

### Report Quality Gate

**Triggered by:** Any step whose output is a markdown report (RCA, PR review verdict, answer, findings doc, generated documentation), regardless of which agent produced it. The draft of a `/do` PR review is not a report file: it is inline prose above a terminal block, so no Report Quality Gate or other gate runs on it (see [pr-review-flow.md](pr-review-flow.md)).

**Reviewed by:** `review-md` skill (invoked by the orchestrator or by the producing skill itself before presenting the report)

**Scope of `review-md`:**
- Writing-standard consistency (per [rules/writing-standard.md](../../../rules/writing-standard.md))
- Factual soundness and accuracy
- Consistency with other documents and the codebase
- **New:** Flags when a document/report cites a file path, requirement ID (BR/UR/FR/NFR), or spec ID that doesn't actually exist in the repo, so claims stay verifiable and traceable

**Process:**

1. **Invoke `review-md`** on the report file (or in-memory draft) immediately after it is produced, before it reaches the user.
2. **Findings check:** `review-md` returns either "No issues found" or a findings document ordered by factual soundness, then consistency, then conciseness.
3. **Iteration Loop:** If findings exist:
   - Route the findings back to the producing agent (Sonnet, as in every fix phase)
   - Producing agent fixes only the flagged issues (no unrelated rewrites)
   - Re-run `review-md` on the revised report
   - Repeat until `review-md` reports no issues, or 3 iterations reached
4. **Exit Conditions:**
   - `review-md` reports no issues: Approved
   - 3 iterations reached with unresolved findings: the step is `completed` with the outstanding findings attached to its Review field, and Display shows them with the report. If an outstanding finding names a wrong claim or a path or ID that does not exist, the step is `failed` instead. The main agent never rewrites the report itself

**Approval:** `✓ Report Quality Clear` (after `review-md` finds no issues)

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

1. **Correctness:** Logic sound? No bugs?
2. **Performance:** Efficient algorithms? No N+1 queries?
3. **Readability:** Code clear and maintainable?
4. **Architecture:** Follows project conventions?
5. **Testability:** Code is testable?

### Iteration Process

1. **Developer Self-Review:** Self-check on all 5 dimensions
2. **Code Reviewer Audit:** Line-by-line review on all dimensions
3. **Iteration Loop:** If changes requested: the fixing agent fixes (test-file findings go to developer-tester) → Reviewer re-audits
4. **Exit Conditions:**
   - 2 consecutive LGTMs from code-reviewer: Approved
   - 10 iterations reached: no further round; escalate to the user with continue, waive, or abort (see "Exhausting a gate")

**Evidence:** the gate clears on the recorded exits of the other gates plus a `code-reviewer` verdict, from a `code-reviewer` that did not produce the artifact, carrying `file:line` findings. The sign-off string alone never clears it.

**Approval:** `✓ Approved for merge` (after iteration complete), which `/do` records as `Writer: orchestrator` only on that evidence

---

### Planning Document Review Gate

**Triggered by:** Output from planning-related agents (planner, solutions-architect, requirements-gatherer, task-planner)

**Reviewed by:** reviewer or code-reviewer

### Reviewer Adversarial Self-Reflection

Before formal audit, reviewer deliberately:
- Looks for syntax/logic errors, type mismatches
- Checks for inconsistencies with codebase patterns
- Questions assumptions: What if input is null? What if it fails?
- Spot-checks security: injection vectors, credential leaks
- Tests mental model: Can I follow the logic?

**Process:**

1. **Creator Self-Reflection:** Creator audits own work for:
   - Completeness (all sections present?)
   - Clarity (would a reader understand this?)
   - Feasibility (are requirements realistic? Is architecture sound?)
   - Alignment (does this match project context?)

2. **Reviewer Audit:** Reviewer checks:
   - Technical soundness
   - Completeness against requirements
   - Clarity and organization
   - Feasibility and risk assessment

3. **Iteration Loop**
   - Reviewer approves OR requests changes
   - If changes: Creator fixes → Reviewer re-audits
   - Track iterations against the one cap of 10
   - Exit when: 2 consecutive LGTMs OR the cap of 10 iterations (escalate to the user, no further round)

**Approval:** `✓ LGTM #2` (two consecutive LGTMs)

**Escalation:** At the cap of 10 iterations, `/do` runs no further developer or reviewer round and asks the user to continue, waive, or abort (see "Exhausting a gate")

---

## Review Workflow

**Note:** Planning documents (from planner, solutions-architect, requirements-gatherer, and task-planner) follow a separate iteration-based review workflow (see "Planning Document Review Workflow" section above). All other work follows the standard pre-test → security → testing → code review sequence below.

```
Developer submits code
  ↓
Pre-Test Code Review Gate
  ├─ Developer self-reviews
  ├─ Reviewer adversarially self-reflects + audits
  ├─ Iterate until: 2 consecutive LGTMs or the cap of 10 iterations (escalate to the user)
  └─ Approval: ✓ Pre-Test Review Clear
  ↓
Developer-Tester writes tests; QA runs tests + security
  ↓
Creator self-reviews
  ↓
Reviewer adversarially self-reflects (tries to find issues)
  ↓
Reviewer conducts formal audit
  ├─ OWASP/Security check (if code) OR gate-specific checklist
  ├─ Testing gate (>=70% coverage)
  ├─ Approve or request revision
  └─ If revision: iterate
     - Creator fixes
     - Reviewer repeats adversarial self-reflection + formal audit
     - Exit: 2 consecutive LGTMs or the cap of 10 iterations (escalate to the user)
  ↓
Code Review Gate (sign-off)
  ↓
Merge approved ✓
```

---

## Fix Phase Rules

Applies whenever a reviewer requests changes at any gate (Pre-Test, OWASP, OWASP for LLM, Testing, Code Review, Planning Document).

Full constraint details: [fix-phase-rules.md](fix-phase-rules.md)

### Model Constraint

- Fix phase ALWAYS uses Sonnet
- Never use Opus for fixes, even if the review gate itself uses Opus (reviewer, code-reviewer)
- Never use Haiku for fixes, even for single-line changes
- Applies to every agent performing a fix (developer, developer-tester, devops, planner, solutions-architect, requirements-gatherer, task-planner)

### Scope Constraint

- The fixing agent fixes ONLY items explicitly identified by the reviewer
- No scope creep: no unrelated refactors, no drive-by cleanup, no "while I'm here" changes
- If additional issues are spotted during the fix, flag them to the orchestrator; do not fix them unilaterally
- Reviewer re-audit checks two things: (1) listed items resolved, (2) no unrelated changes introduced

### Fix Phase Procedure

1. Reviewer produces an itemized findings list (file, line number, issue description)
2. Orchestrator routes findings to the fixing agent with `Model: Sonnet` (non-negotiable). Route only findings whose path matches the gated step's Writes; record the rest under the step's Out of scope field. Test-path findings and Testing Gate test gaps are the exception for gates on non-chain steps: they go to `developer-tester` whatever the step's Writes say. In a planning gate (a chain step), a test-path finding goes under Out of scope. When a pass leaves no routable finding, the gate ends and the step fails with the findings in its Done field. All other findings go to the producing agent. A finding on a task-plan file goes to `task-planner`, and the dispatch names the file to overwrite. A pass with both kinds splits into one fix dispatch per agent
3. Fixing agent changes ONLY the code/content tied to a listed finding
4. Fixing agent self-reviews the fix against the findings list only (not a full-file pass)
5. Reviewer re-audits: confirms each finding resolved AND scans for unrelated diffs
6. If unrelated changes are present: reject the fix, re-iterate the fix phase
7. If fix is correctly scoped: proceed to next review iteration

### Plan Tracking: Review Iterations vs. Fix Iterations

Track review passes and fix passes as separate counters in the plan file:

```markdown
**Review:** Code Review with Iterations
  - Review Iteration 1 (code-reviewer, Opus): Finds 2 issues: null check L42, unclear naming L88
  - Fix Iteration 1 (developer, Sonnet): Fixes L42, L88 only: no other lines touched
  - Review Iteration 2 (code-reviewer, Opus): Confirms both fixes, no unrelated changes → LGTM #1
  - Review Iteration 3 (code-reviewer, Opus): Re-audit → LGTM #2
  - Exited: 2 consecutive LGTMs
  - Fix Model: Sonnet (all fix iterations, non-negotiable)
```

- **Review iteration:** a reviewer audit pass (model per gate: Opus for reviewer/code-reviewer)
- **Fix iteration:** a fixing-agent pass (model always Sonnet)
- Counters are independent: a review iteration with no findings needs no matching fix iteration
- One cap of 10 combined iterations per gate; at the cap, no further round and escalation to the user: continue, waive, or abort (see "Exhausting a gate")

---

## Approval Tracking

In plan file, mark review outcomes:

```markdown
### Step 2: Implementation

**Status:** completed  
**Done:** [YYYY-MM-DD HH:mm]: [Summary]  
**Review:** LGTM (3 approvals)
  - Security: ✓ OWASP clear
  - Testing: ✓ 85% coverage (evidence: `npm run test:coverage`, exit 0, value 85, audit log tool_use_id toolu_01ABC)
  - Code Review: ✓ Approved
**Writer:** orchestrator
```

The orchestrator (or a hook) writes the review outcome and every approval line, and marks the record `Writer: orchestrator`. The agent that produced the artifact never writes the artifact's review outcome or approval status. A record that names a producer as its writer is not an approval; `/do` writes the record itself from the reviewer's terminal block.

```markdown
### Step 3: Implementation (Code)

**Status:** completed  
**Done:** [YYYY-MM-DD HH:mm]: [Summary]  
**Review:** Code Review with Iterations
  - Security (OWASP): Iteration 2 → ✓ OWASP Clear
  - Testing: ✓ 82% coverage (evidence: `npm run test:coverage`, exit 0, value 82)
  - Code Review: Iteration 3 → ✓ Approved for merge
  - Tracked: cap of 10 iterations; exited at 3 (2 consecutive LGTMs)
**Writer:** orchestrator
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
**Writer:** orchestrator
```

---

## Fast-Track Review

For low-risk changes (docs, tests, non-critical fixes):

**Excluded:** a change to the LLM surface is never fast-tracked: `agents/`, `skills/` at any depth (`metadata.json` included), `rules/`, and `hooks/`, each at the repository root, under any `plugins/<name>/`, or under `.claude/`; any `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md` at any depth; and `.claude/settings*.json`. An application folder such as `src/hooks/` is not on the surface. The change always gets the full gates and the OWASP for LLM Gate against [../../../rules/llm-security-checklist.md](../../../rules/llm-security-checklist.md), whatever its size.

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

**Tools:** Read, Grep, Glob, LSP (no write, no shell)  
**Authority:** Can block merge if security issues found. Its verdict is evidence that `/do` records, never a status it writes, and it does not review an artifact it produced

### Formal Code Reviewer (`code-reviewer` agent)

- Line-by-line architectural review
- Best practice enforcement
- Critical sign-off authority
- Used for high-impact changes

**Tools:** Read, Grep, Glob, LSP (no write, no shell)  
**Authority:** Formal approval required for sensitive changes. Its sign-off is evidence that `/do` records, never a status it writes, and it does not sign off an artifact it produced

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

