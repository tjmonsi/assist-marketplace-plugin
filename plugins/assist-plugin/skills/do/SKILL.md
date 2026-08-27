---
name: do
description: >-
  Routes a task, prompt, or multi-instruction prompt to the best specialized
  subagent, or handles it directly if no agent matches. Creates an execution
  plan, gets user approval with model override options, and coordinates agents with review loops.

effort: xhigh
allowed-tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash
  - Agent
  - AskUserQuestion
argument-hint: "[task description or prompt]"
---

# Do — Orchestrator

Route every incoming task to the right specialized subagent. Fall back to the main agent for anything unmatched.

Think deeply before classifying or delegating.

## Step 1 — Classify the prompt

Before doing any work, read the prompt thoroughly and identify:

- **Primary intent** — what is the core task? (write code, edit docs, review, gather requirements, test, manage)
- **Scope** — is this one task or multiple tasks?
- **Output type** — what does a finished result look like?
- **Context needed** — what files or information does each task require?

If ambiguous, ask the user for clarification.

## Step 2 — Match to agents

Read [references/agent-registry.md](references/agent-registry.md).

Use the FIRST agent whose responsibilities match the primary intent. If multiple tasks: identify one agent per task, plan sequencing.

## Step 2.5 — Model routing

Read [references/model-routing.md](references/model-routing.md).

Apply the priority chain:
1. **Opus** → orchestrator, reviewer, code-reviewer
2. **Sonnet** → developer, planner, qa, solutions-architect, requirements-gatherer, devops, researcher, general-purpose, worker
3. **Haiku** → explore, (commit, branch)

## Step 3 — Create plan

Create plan at `.agent/main-plan/plan-[slug]-[timestamp].md` using [references/plan-format.md](references/plan-format.md).

For each step:
- Provide task breakdown and goal
- List relevant files
- Set **Model** per routing table (required)
- Set **Status:** `PENDING_APPROVAL`

## Step 4 — Get user approval + model overrides

Present plan using AskUserQuestion:

```
Plan includes:
- X agents [default models]

Override models for any agent? (y/n)
```

Do NOT proceed without explicit approval.

**After approval:** Update plan status to `Approved` using Edit tool.

## Step 5 — Execute with review loops

Execute approved plan step by step. Follow [references/review-protocol.md](references/review-protocol.md).

For each step:
1. **Delegate** — Invoke matched agent with:
   - Self-contained task prompt
   - Model parameter per routing table
   - Effort level stated explicitly
   - `run_in_background: true` if independent
2. **Collect result** — Wait for completion
3. **Review** — If step produces files AND agent ≠ reviewer → trigger review loop
4. **Tag done** — Use Edit tool to update plan status to `completed` + timestamp + review outcome
5. **Proceed** — Only after plan file updated

## Step 6 — Synthesize

After all steps complete:
- Present each agent's output (don't re-do their work)
- Light formatting/stitching only
- If output incomplete, re-delegate and fix
- Update plan with final status

## Fallback rule

No agent matched? This is valid. Handle directly using full generalist capability. Note in plan: "No subagent matched — main agent handling."

## Constraints

- Never skip user approval
- Never invoke agent without task breakdown + context files
- Never proceed past failed review without re-invoking agent
- Keep each agent's task focused

