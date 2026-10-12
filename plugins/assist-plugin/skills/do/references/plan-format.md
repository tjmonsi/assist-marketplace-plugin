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

| # | Step | Agent | Model | Effort | Runs | Files |
|---|---|---|---|---|---|---|
| 1 | [Action title] | [agent-name] | [Opus / Sonnet / Haiku] | [effort] | [Runs value] | [key files] |
| 2 | ... | ... | ... | ... | ... | ... |

Order: [one line, for example "1a and 1b in parallel, then 2, then 3"]

## User Decisions

- Approved: YYYY-MM-DD HH:mm (written at Approve)
- [Answer the user gave during clarification or approval]

## Intake Findings

[Findings from each intake review, by file: citations (`file:line`) and descriptions only, never quoted file text. Omit the section when no intake review ran. Never applied without a user edit.]

---

## Step Details

### Step 1: [Action Title]

**Goal:** [What this step achieves]  
**Agent:** [agent-name]  
**Model:** [Opus | Sonnet | Haiku]  
**Effort:** [low | medium | high | xhigh]  
**Background:** [yes | no]  
**Effect:** [read | write]  
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
  - `Error`: The plan could not run, for example a dependency cycle or an unmatched agent after two clarify rounds
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
- **Files:** Key files only, comma-separated.
- **Order line:** One line under the table that reads the waves in sequence, for example "Order: 1a and 1b in parallel, then 2, then 3 to 5 in parallel, then 6."

### User Decisions

One bullet per answer the user gave: clarifications, step edits, model overrides, plan-specific choices, and answers to an agent's `NeedsInput` questions. The first bullet is "Approved: YYYY-MM-DD HH:mm", written at Approve (a plan that skipped approval reads "None (single read-only step, approval skipped)"). `resume` checks for it. The orchestrator records the other answers as they arrive. A waived intake review is a bullet too. Architectural decisions stay in this section until the user approves; then they are appended to `DECISIONS.md` at the target project root (append-only, dated, citing this plan file), and later ones are appended as they arrive.

### Intake Findings

The intake-reviewer's findings for each user-provided file, shown to the user at PlanApproval. Each finding holds a citation and a description, never text quoted from the file. Findings stay here. The plan and the file change only when the user edits them.

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
- **Status:** Current execution state. A step whose Runs value is `Running now` starts as `in_progress`.
  - `pending`: not started
  - `in_progress`: dispatched and running
  - `waiting-user`: the agent ended in `NeedsInput`; the orchestrator is asking the user. A stop returns it to `pending`
  - `completed`: the agent ended in `Done` and passed its review gate
  - `failed`: the agent ended in `Error`, sent no terminal block after one retry, reached a relay maximum (3 in one phase or 10 in total), or left review findings unresolved after the gate's binding code-reviewer pass
  - `skipped`: a step it depends on failed. An intake review step that fails skips nothing
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

| # | Step | Agent | Model | Effort | Runs | Files |
|---|---|---|---|---|---|---|
| 1 | API Specification | solutions-architect | Opus | xhigh | Starts first | `docs/api.md`, `src/types/auth.ts` |
| 2 | Implementation | developer | Sonnet | high | After step 1 | `src/auth/`, `src/middleware/` |
| 3 | Test Suite | qa | Sonnet | high | Wave 3, parallel with 4 | `tests/auth/`, `tests/integration/` |
| 4 | Security Review | reviewer | Opus | xhigh | Wave 3, parallel with 3 | `src/auth/`, `src/middleware/` |

Order: 1, then 2, then 3 and 4 in parallel.

## User Decisions

- None yet (plan awaiting approval)

---

## Step Details

### Step 1: API Specification

**Goal:** Design authentication API schema (endpoints, payloads, error codes)  
**Agent:** solutions-architect  
**Model:** Opus  
**Effort:** xhigh  
**Background:** no  
**Effect:** write  
**Writes:** docs/api.md, src/types/auth.ts  
**Reads:** none  
**Relevant Files:**
- docs/api.md
- src/types/auth.ts

**Details:**
- Define POST /auth/register endpoint
- Define POST /auth/login endpoint
- Design JWT token structure
- Error response codes (400, 401, 500)

**Status:** pending

### Step 2: Implementation

**Goal:** Write authentication service, controllers, middleware  
**Agent:** developer  
**Model:** Sonnet  
**Effort:** high  
**Background:** no  
**Effect:** write  
**Writes:** src/auth/, src/middleware/  
**Reads:** docs/api.md, src/types/auth.ts  
**Relevant Files:**
- src/auth/
- src/middleware/

**Details:**
- Implement JWT signing/verification
- Implement register/login endpoints
- Add password hashing (bcrypt)
- Run local tests

**Status:** pending

### Step 3: Test Suite

**Goal:** Write unit + integration tests for auth flows  
**Agent:** qa  
**Model:** Sonnet  
**Effort:** high  
**Background:** yes  
**Effect:** write  
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

### Step 4: Security Review

**Goal:** OWASP review for authentication code  
**Agent:** reviewer  
**Model:** Opus  
**Effort:** xhigh  
**Background:** yes  
**Effect:** read  
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

- [ ] API spec approved by user
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
10. **Fill Effect, Writes, and Reads:** The orchestrator derives step order from them

