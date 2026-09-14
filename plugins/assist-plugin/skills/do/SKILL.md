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

Check the ask agent first: if the primary intent from Step 1 is question-answering, repo research, or documentation lookup (not implementation, review, or planning), route directly to the **ask** agent and skip the table below. See [Plugin & Skill Discovery](#plugin--skill-discovery).

Otherwise, read [references/agent-registry.md](references/agent-registry.md).

Use the FIRST agent whose responsibilities match the primary intent. If multiple tasks: identify one agent per task, plan sequencing.

## Step 2.5 — Model routing

Read [references/model-routing.md](references/model-routing.md).

Apply the priority chain:
1. **Opus** → orchestrator, reviewer, code-reviewer
2. **Sonnet** → ask, developer, planner, qa, solutions-architect, requirements-gatherer, devops, researcher, general-purpose, worker
3. **Haiku** → explore, (commit, branch)

## Plugin & Skill Discovery

The router is not limited to the fixed agent registry. It can discover available plugins and skills at runtime and use them to route or enrich a task.

- Before finalizing agent selection, the orchestrator may scan installed plugins (`plugins/*/skills/*/SKILL.md`, `plugins/*/agents/*.md`) to find skills or agents whose frontmatter `description` matches the task, beyond what is listed in the static registry.
- Subagents can be handed suggested plugins/skills that match their task context. For example, if a `developer` step will touch documentation, the orchestrator can note in that agent's task prompt: "Consider using the `technical-writing` skill for the README update."
- Discovery never replaces the approval flow: any newly discovered agent/skill still goes through Step 4 (user approval) before execution.

For the full discovery mechanism and examples, see [references/routing-with-discovery.md](references/routing-with-discovery.md).

### Ask skill routing

Use the **ask** agent for question-answering, repo research, or documentation lookup tasks (for example: "how does X work", "where is Y documented", "research this in the repo"). It is Sonnet-tier and read-only (Read, Grep, Glob, WebSearch, WebFetch) — it answers questions rather than changing code.

Routing order:
1. Classify primary intent (Step 1).
2. If intent is a question/research/documentation lookup → route to **ask** (checked AFTER primary intent matching, BEFORE the agent-registry table).
3. Otherwise → proceed with Step 2 matching against [references/agent-registry.md](references/agent-registry.md).

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
   - Model parameter per routing table (or always Sonnet if fix phase — see [references/fix-phase-rules.md](references/fix-phase-rules.md))
   - Effort level stated explicitly
   - `run_in_background: true` if independent
2. **Collect result** — Wait for completion
3. **Review** — If step produces files AND agent ≠ reviewer → trigger review loop
4. **Tag done** — Use Edit tool to update plan status to `completed` + timestamp + review outcome
5. **Proceed** — Only after plan file updated

**Fix Phase:** All fix-phase agents run on Sonnet model (non-negotiable). See [references/fix-phase-rules.md](references/fix-phase-rules.md) for scope constraints and procedure.

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

