# Plan Format

Template and format for execution plans created by the `do` orchestrator.

## Plan Structure

```markdown
# Execution Plan: [Task Slug]

**Created:** YYYY-MM-DD HH:mm  
**Status:** PENDING_APPROVAL | Approved | Cancelled | In Progress | Complete  
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

- [Answer the user gave during clarification or approval]

---

## Step Details

### Step 1: [Action Title]

**Goal:** [What this step achieves]  
**Agent:** [agent-name]  
**Model:** [Opus | Sonnet | Haiku]  
**Effort:** [low | medium | high | xhigh]  
**Background:** [yes | no]  
**Relevant Files:** [List key files this agent will read/write]

**Details:**
- Task breakdown
- Key inputs
- Expected outputs

**Status:** pending | in_progress | completed  
**Done:** [YYYY-MM-DD HH:mm]: [Brief summary of what was accomplished]  
**Review:** [LGTM (N approvals) | Revision requested | N/A]

### Step 2: [Next Step Title]
...

---

## Review Gates

**Security (OWASP):** [Gate status]  
**Testing (>70% coverage):** [Gate status]  
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
  - `Complete`: All steps finished
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

One bullet per answer the user gave: clarifications, step edits, model overrides, and plan-specific choices. The orchestrator records them when the user approves. Write "None" when the user approved without changes.

### Step Fields
- **Goal:** What this step accomplishes in 1-2 sentences
- **Agent:** Name of agent to invoke (from agent-registry.md)
- **Model:** Model tier for this agent (from model-routing.md)
- **Effort:** Effort level (low/medium/high/xhigh)
- **Background:** Whether to run in background (`yes`/`no`)
  - `yes`: Run parallel with other background steps (Runs is `Wave N, parallel with X`)
  - `no`: Block on this step before proceeding
- **Relevant Files:** Files the agent will need (1 per line)
- **Details:** Bullet points with task breakdown, inputs, outputs
- **Status:** Current execution state (pending/in_progress/completed). A step whose Runs value is `Running now` starts as `in_progress`.
- **Done:** Completion timestamp + summary (added by orchestrator when step finishes)
- **Review:** Review outcome if applicable (LGTM, Revision requested, N/A)

### Writing the Summary and Details Fields

- **Summary:** State what the plan accomplishes, not that a plan exists. State the outcome, not "This plan will..."
- **Details:** Each bullet states one fact once. Do not repeat a bullet's content in the Goal field above it or in the Done summary below it.
- Use active voice with the important subject first: "Developer implements JWT signing" not "JWT signing will be implemented by the developer."
- No hedges ("this should probably cover..."), no filler, no em-dashes.
- The **Done** field follows the three-part pattern when it reports a non-trivial outcome: what was done, why it matters (if not obvious), what remains (if anything).

### Review Gates
- **Security (OWASP):** Must pass OWASP top 10 checks (reviewed by `reviewer` or `code-reviewer`)
- **Testing (>70% coverage):** Code coverage must meet minimum (validated by `qa`)
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
**Relevant Files:**
- tests/auth/
- tests/integration/

**Details:**
- Unit tests for JWT handling
- Integration tests for register/login
- Error case coverage
- Target >70% coverage

**Status:** pending

### Step 4: Security Review

**Goal:** OWASP review for authentication code  
**Agent:** reviewer  
**Model:** Opus  
**Effort:** xhigh  
**Background:** yes  
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
**Testing (>70% coverage):** ⏳ Pending  
**Code Review (sign-off):** ⏳ Pending

---

## Success Criteria

- [ ] API spec approved by user
- [ ] Code passes security review
- [ ] Test coverage >70%
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

