# Plan Format

Template and format for execution plans created by the `do` orchestrator.

## Plan Structure

```markdown
# Execution Plan: [Task Slug]

**Created:** YYYY-MM-DD HH:mm  
**Status:** PENDING_APPROVAL | Approved | Cancelled | In Progress | Complete | Partial | Paused | Error  
**User:** [GitHub username or email]

## Summary

Brief 1-2 sentence summary of what this plan accomplishes.

## Steps

| # | Step | Agent | Model | Effort | Runs | Build | Files |
|---|---|---|---|---|---|---|---|
| 1 | [Action title] | [agent-name] | [Opus / Sonnet / Haiku] | [effort] | [Runs value] | [yes / no] | [key files] |
| 2 | ... | ... | ... | ... | ... | ... | ... |

Order: [one line, for example "1a and 1b in parallel, then 2, then 3"]

## User Decisions

- Approved: YYYY-MM-DD HH:mm (written at Approve)
- [Answer the user gave during clarification or approval]

## Intake Findings

[Findings from each intake review, by file: citations (`file:line`) and descriptions only, never quoted file text. Omit the section when no intake review ran. Never applied without a user edit.]

## Spec-First

[Build plans only; omit for a non-build plan.]

**Build:** yes  
**Documents found:** [requirements: path or missing; spec: path or missing; task plan: path or missing; DECISIONS.md: path or missing. Paths resolve against the git root of the session's working directory (the working directory outside a git repository); mark a path that came from an old root pattern. Name any cut, for example `specs: 20 of 37, newest first`]  
**Conflict findings:** [By group (missing documents, request versus documents, contradictions inside documents, gaps): citations and descriptions only, never quoted text, each with the user's answer or `open`. `none` when the check found nothing; `skipped (no documents)` on an empty project. Also list any `not read (cap)` paths the reviewer reported, so a `clear` run still shows them]  
**Change check:** git | skipped: change-check not-run (no git) | skipped: change-check not-run (git failed)  
**Approved hashes:** [content hash per approved document, written at DocSignOff Approve; empty before approval and when waived]  
**Documents approved:** pending | YYYY-MM-DD HH:mm | waived

---

## Step Details

### Step 1: [Action Title]

**Goal:** [What this step achieves]  
**Agent:** [agent-name]  
**Model:** [Opus | Sonnet | Haiku]  
**Effort:** [low | medium | high | xhigh]  
**Background:** [yes | no]  
**Effect:** [read | write]  
**Chain:** [yes for a document-chain step of a build plan; omit otherwise]  
**Build:** [yes | no]  
**Writes:** [paths, globs, or `project`; `none` for a read step]  
**Reads:** [paths and globs this step reads]  
**Active tests:** [exact commands and the authorized target for a qa step that runs active pentest tests; omit otherwise]  
**Relevant Files:** [List key files this agent will read/write]

**Details:**
- Task breakdown
- Key inputs
- Expected outputs

**Status:** pending | in_progress | waiting-user | completed | failed | skipped  
**Done:** [YYYY-MM-DD HH:mm]: [Brief summary of what was accomplished]  
**Review:** [LGTM (N approvals) | Revision requested | N/A]  
**Out of scope:** [Work the agent reported but may not do; omit when none]

### Step 2: [Next Step Title]
...

---

## Review Gates

**Security (OWASP):** [Gate status]  
**Testing (>=70% coverage):** [Gate status]  
**Code Review (sign-off):** [Gate status]

---

## Success Criteria

- [ ] All steps completed
- [ ] All review gates passed
- [ ] User approved final result
```

---

## Field Definitions

### Header Fields
- **Created:** Timestamp when plan was created
- **Status:** Plan lifecycle state
  - `PENDING_APPROVAL`: Awaiting user approval before execution
  - `Approved`: User approved; ready to execute
  - `Cancelled`: User cancelled at approval or preflight; nothing runs
  - `In Progress`: Executing steps
  - `Complete`: Every step completed
  - `Partial`: The run ended with at least one `failed` or `skipped` step and no step left to run
  - `Paused`: The user stopped the run; undispatched steps stay `pending`. `resume <plan>` accepts a plan in `Paused` or `In Progress` whose User Decisions record an approval, shows the remaining steps, asks for approval again, and then runs Preflight
  - `Error`: The plan could not run, for example a dependency cycle, an unmatched agent after the clarify limit, a build request with open points after five clarify rounds, or a failed conflict check. A run that ends in `Error` before Branch writes no plan file, so no Status is set; `Error` is set only on a plan file that Branch already wrote in the same run, and a resumed plan keeps its Status
- **User:** GitHub username or email of requester

### Step Table and Order Line

The table under `## Steps` is the canonical step summary. The `do` skill prints the same table and Order line in chat before asking for approval, and reprints both after every edit.

- **#:** Execution order. Steps in the same wave may share a number with letter suffixes (1a, 1b).
- **Step:** Action title, matching the `### Step N` heading below.
- **Agent, Model, Effort:** Same values as the step's detail fields.
- **Runs:** Where the step sits in the execution order:
  - `Wave N, parallel with X`: starts together with step X
  - `After step N`: waits for step N to finish
  - `After steps X and Y`: waits for both steps to finish
  - `After wave N`: waits for every step in wave N to finish
  - `Starts first`: a lone first step
  - `Running now`: already in flight when the plan is shown
- **Build:** `yes` or `no`, from the step's Build field. A reader sees at approval which steps wait for document sign-off.
- **Files:** Key files only, comma-separated.
- **Order line:** One line under the table that reads the waves in sequence, for example "Order: 1a and 1b in parallel, then 2, then 3 to 5 in parallel, then 6."

### User Decisions

One bullet per answer the user gave: clarifications, step edits, model overrides, plan-specific choices, and answers to an agent's `NeedsInput` questions. A bullet holds citations (`file:line`) and /do's own wording of the option the user chose, never text from a document or the reviewer's paraphrase of it (the user's own typed words may be kept). The first bullet is "Approved: YYYY-MM-DD HH:mm", written at Approve (a plan that skipped approval reads "None (single read-only step, approval skipped)"). `resume` checks for it. The orchestrator records the other answers as they arrive. A waived intake review is a bullet too, and so is a spec-first waiver ("Spec-first waived: YYYY-MM-DD HH:mm"), which also goes to `DECISIONS.md`. The bullet is a record only; `/do` reads the waiver state from `Documents approved` in the Spec-First section, never from a bullet. The document sign-off timestamp is not a bullet either. Architectural decisions stay in this section until the user approves; then they are appended to `DECISIONS.md` at the target project root (append-only, dated, citing this plan file), and later ones are appended as they arrive.

### Intake Findings

The intake-reviewer's findings for each user-provided file, shown to the user at PlanApproval. Each finding holds a citation and a description, never text quoted from the file. Findings stay here. The plan and the file change only when the user edits them.

### Spec-First

Present for a build plan. A build step writes code, config, pipelines, infrastructure, or tests. Such a plan carries three `chain` steps ahead of every build step: requirements (requirements-gatherer), spec (solutions-architect), and task plan (task-planner). `Documents approved` is the gate, and `/do` reads waiver and sign-off state only from it, comparing it with the value `/do` itself last wrote: a `Build: yes` step stays held while it reads `pending` or while the two disagree (the mismatch is treated as `pending` and shown to the user), and the Spec-first question is asked only while it reads `pending`. Only `/do` writes this file: fsa-write-bar denies every subagent's Write, Edit, MultiEdit, and NotebookEdit calls on `.agent/main-plan/**` and `DECISIONS.md`; Bash writes are not covered, and the hook fails open. `Documents found` lists at most 20 paths per document type, newest first, and names any cut. `Change check` records whether `/do` could compare git status and content-hash snapshots around the document chain; without git it reads `skipped: change-check not-run (no git)`, and when `.git` exists but a snapshot command fails it reads `skipped: change-check not-run (git failed)`. `Documents approved` becomes a timestamp when the user approves the three documents at DocSignOff (with `Approved hashes` written beside it; a later change to an approved document resets it to `pending`), or `waived` when the user picks Skip spec-first at PlanApproval (the chain steps are then removed). Only that answer waives; a Clarify or NeedsInput answer never does. On resume the only correction is a reset to `pending`, which Branch writes; a typed edit never sets a timestamp or `waived`. A reused document has no chain step; its path is under Documents found. An unresolved finding stays `open` until a Clarify answer settles it; after round 5 an open finding ends the run in Error(plan-invalid).

### Step Fields
- **Goal:** What this step accomplishes in 1-2 sentences
- **Agent:** Name of agent to invoke (from agent-registry.md)
- **Model:** Model tier for this agent (from model-routing.md)
- **Effort:** Effort level (low/medium/high/xhigh)
- **Background:** Whether to run in background (`yes`/`no`)
  - `yes`: Run parallel with other background steps (Runs is `Wave N, parallel with X`)
  - `no`: Block on this step before proceeding
- **Effect:** `read` when the step changes no file; `write` otherwise. The orchestrator uses it, with Writes and Reads, to order steps and to decide whether the plan may skip approval.
- **Active tests:** For a qa step that runs active pentest tests, the exact commands and the authorized target. The agent runs no other command, and the plan approval covers only these. Omit for every other step.
- **Writes:** Paths or globs the step may change, or `project` when it can touch anything. `none` for a read step.
- **Reads:** Paths and globs the step reads. A step whose Reads overlap another step's Writes runs after it, unless both run in worktrees.
- **Relevant Files:** Files the agent will need (1 per line)
- **Details:** Bullet points with task breakdown, inputs, outputs
- **Build:** `yes` when Writes include code, config, pipelines, infrastructure, tests, or `project`; a mixed step counts as `yes`; `no` otherwise (a read step, a docs-only step, a document-chain step). Decompose records it for every step. Dispatch holds every `Build: yes` step until `Documents approved` holds a timestamp or `waived`. In a build plan, a write step that is not a chain step and has no clear Build value is held as `yes`.
- **Chain:** `yes` on a document-chain step of a build plan; omit otherwise. A step marked `chain` is not a build step. The Details of a chain step cite the Clarify answers it must not re-ask.
- **Status:** Current execution state. A step whose Runs value is `Running now` starts as `in_progress`.
  - `pending`: not started
  - `in_progress`: dispatched and running
  - `waiting-user`: the agent ended in `NeedsInput`; the orchestrator is asking the user. It also covers the open draft confirmation of a PR review step. A stop returns it to `pending`
  - `completed`: the agent ended in `Done` and passed its review gate. A PR review step runs no gate: it is `completed` after a successful post or a "do not post" answer
  - `failed`: the agent ended in `Error`, sent no terminal block after one retry, reached a relay maximum (3 in one phase or 10 in total), or left review findings unresolved after the gate's binding code-reviewer pass. A PR review step is also `failed` on a fetch or post error
  - `skipped`: a step it depends on failed, or the user cancelled at DocSignOff ("Skipped: documents not approved"). An intake review step that fails skips nothing
- **Done:** Completion timestamp + summary (added by orchestrator when the step finishes). A `failed` step records its `error_class` and reason here. A `skipped` step records "Skipped: depends on failed step N". Any `skipped:` marker from the agent's terminal block is copied here.
- **Review:** Review outcome if applicable (LGTM, Revision requested, N/A)
- **Out of scope:** Work the agent reported in `out_of_scope` but may not do. The orchestrator does not dispatch it; Display raises it as a new request.

### Writing the Summary and Details Fields

- **Summary:** State what the plan accomplishes, not that a plan exists. State the outcome, not "This plan will..."
- **Details:** Each bullet states one fact once. Do not repeat a bullet's content in the Goal field above it or in the Done summary below it.
- Use active voice with the important subject first: "Developer implements JWT signing" not "JWT signing will be implemented by the developer."
- No hedges ("this should probably cover..."), no filler, no em-dashes.
- The **Done** field follows the three-part pattern when it reports a non-trivial outcome: what was done, why it matters (if not obvious), what remains (if anything).

### Review Gates
- **Security (OWASP):** Must pass OWASP top 10 checks (reviewed by `reviewer` or `code-reviewer`)
- **Testing (>=70% coverage):** Code coverage must meet minimum (validated by `qa`)
- **Code Review (sign-off):** Formal approval required (from `code-reviewer`)

---

## Example Plan

```markdown
# Execution Plan: user-auth-impl

**Created:** 2026-08-27 14:30  
**Status:** PENDING_APPROVAL  
**User:** tjmonsi

## Summary

Implement JWT-based user authentication with register/login endpoints, test coverage, and OWASP security review.

## Steps

| # | Step | Agent | Model | Effort | Runs | Build | Files |
|---|---|---|---|---|---|---|---|
| 1 | Requirements | requirements-gatherer | Sonnet | medium | Starts first | no | `docs/requirements/FR-NFR-auth.md` |
| 2 | API Specification | solutions-architect | Opus | xhigh | After step 1 | no | `specs/spec-auth.md` |
| 3 | Task Plan | task-planner | Sonnet | high | After step 2 | no | `docs/task-plans/task-plan-auth-*.md` |
| 4 | Implementation | developer | Sonnet | high | After step 3 | yes | `src/auth/`, `src/middleware/`, `src/types/auth.ts` |
| 5 | Test Suite | qa | Sonnet | high | Wave 5, parallel with 6 | yes | `tests/auth/`, `tests/integration/` |
| 6 | Security Review | reviewer | Opus | xhigh | Wave 5, parallel with 5 | no | `src/auth/`, `src/middleware/` |

Order: 1, then 2, then 3, then document sign-off, then 4, then 5 and 6 in parallel.

## User Decisions

- None yet (plan awaiting approval)

## Spec-First

**Build:** yes  
**Documents found:** requirements: missing; spec: missing; task plan: missing; DECISIONS.md: missing  
**Conflict findings:** skipped (no documents)  
**Change check:** git  
**Approved hashes:**  
**Documents approved:** pending

---

## Step Details

### Step 1: Requirements

**Goal:** Document the authentication requirements with acceptance criteria  
**Agent:** requirements-gatherer  
**Model:** Sonnet  
**Effort:** medium  
**Background:** no  
**Effect:** write  
**Chain:** yes  
**Build:** no  
**Writes:** docs/requirements/FR-NFR-auth.md  
**Reads:** none  
**Relevant Files:**
- docs/requirements/FR-NFR-auth.md

**Details:**
- Run `gather-requirements` `elicit`, then `document`
- Skip the points the user settled at Clarify

**Status:** pending

### Step 2: API Specification

**Goal:** Design authentication API schema (endpoints, payloads, error codes)  
**Agent:** solutions-architect  
**Model:** Opus  
**Effort:** xhigh  
**Background:** no  
**Effect:** write  
**Chain:** yes  
**Build:** no  
**Writes:** specs/spec-auth.md, specs/spec-auth.json, specs/openapi/*, specs/*.mmd, specs/*.png, specs/*.svg, specs/*.pdf  
**Reads:** docs/requirements/FR-NFR-auth.md  
**Relevant Files:**
- specs/spec-auth.md

**Details:**
- Define POST /auth/register endpoint
- Define POST /auth/login endpoint
- Design JWT token structure
- Error response codes (400, 401, 500)

**Status:** pending

### Step 3: Task Plan

**Goal:** Turn the spec into ordered coding steps  
**Agent:** task-planner  
**Model:** Sonnet  
**Effort:** high  
**Background:** no  
**Effect:** write  
**Chain:** yes  
**Build:** no  
**Writes:** docs/task-plans/task-plan-auth-*.md  
**Reads:** specs/spec-auth.md  
**Relevant Files:**
- docs/task-plans/task-plan-auth-*.md

**Details:**
- Run `task-plan` on `specs/spec-auth.md`; a fix pass overwrites the same task-plan file only when it is already in `docs/task-plans/`

**Status:** pending

### Step 4: Implementation

**Goal:** Write authentication service, controllers, middleware  
**Agent:** developer  
**Model:** Sonnet  
**Effort:** high  
**Background:** no  
**Effect:** write  
**Build:** yes  
**Writes:** src/auth/, src/middleware/, src/types/auth.ts  
**Reads:** docs/task-plans/task-plan-auth-*.md, specs/spec-auth.md  
**Relevant Files:**
- src/auth/
- src/middleware/
- src/types/auth.ts

**Details:**
- Implement JWT signing/verification
- Implement register/login endpoints
- Add password hashing (bcrypt)
- Run local tests

**Status:** pending

### Step 5: Test Suite

**Goal:** Write unit + integration tests for auth flows  
**Agent:** qa  
**Model:** Sonnet  
**Effort:** high  
**Background:** yes  
**Effect:** write  
**Build:** yes  
**Writes:** tests/auth/, tests/integration/  
**Reads:** src/auth/, src/middleware/  
**Relevant Files:**
- tests/auth/
- tests/integration/

**Details:**
- Unit tests for JWT handling
- Integration tests for register/login
- Error case coverage
- Target >=70% coverage

**Status:** pending

### Step 6: Security Review

**Goal:** OWASP review for authentication code  
**Agent:** reviewer  
**Model:** Opus  
**Effort:** xhigh  
**Background:** yes  
**Effect:** read  
**Build:** no  
**Writes:** none  
**Reads:** src/auth/, src/middleware/  
**Relevant Files:**
- src/auth/
- src/middleware/

**Details:**
- Check for SQL injection (prepared statements)
- Validate password security (bcrypt, salt)
- Check for CSRF/XSS in endpoints
- Verify JWT security (signing, expiry)

**Status:** pending

---

## Review Gates

**Security (OWASP):** ⏳ Pending  
**Testing (>=70% coverage):** ⏳ Pending  
**Code Review (sign-off):** ⏳ Pending

---

## Success Criteria

- [ ] Requirements, spec, and task plan approved by user at document sign-off
- [ ] Code passes security review
- [ ] Test coverage >=70%
- [ ] Reviewer sign-off obtained
```

---

## Best Practices

1. **Name steps clearly:** Use action verbs (Implement, Review, Test, Design)
2. **Keep the table and details in sync:** Every edit updates both the step table and the matching `### Step N` section
3. **Keep goals concise:** 1-2 sentences max
4. **List only relevant files:** Don't list the entire repo
5. **Break into parallel steps:** Mark `Background: yes` for independent work
6. **Always set Model:** Never leave model field blank
7. **Always set Effort:** Effort level guides token budgeting
8. **Review gates:** Explicitly call out security, testing, and approval gates
9. **Tag completion immediately:** Don't batch step completions
10. **Fill Effect, Writes, Reads, and Build:** The orchestrator derives step order and the sign-off hold from them

