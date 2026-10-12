---
name: do
description: >-
  Routes a task, prompt, or multi-instruction prompt to the best specialized
  subagent, or handles it directly if no agent matches. Creates an execution
  plan, shows it in chat as a step table, gets user approval with edit and
  model override options, and coordinates agents with review loops.

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

# Do: Orchestrator

Route every incoming task to the right specialized subagent. Fall back to the main agent for anything unmatched.

Think deeply before classifying or delegating.

## Step 1: Classify the prompt

Before doing any work, read the prompt thoroughly and identify:

- **Primary intent:** what is the core task? (write code, edit docs, review, gather requirements, test, manage)
- **Scope:** is this one task or multiple tasks?
- **Output type:** what does a finished result look like?
- **Context needed:** what files or information does each task require?

If ambiguous, ask the user for clarification.

## Step 2: Match to agents

Check the ask agent first: if the primary intent from Step 1 is question-answering, repo research, or documentation lookup (not implementation, review, or planning), route directly to the **ask** agent and skip the table below. See [Plugin & Skill Discovery](#plugin--skill-discovery).

Otherwise, read [references/agent-registry.md](references/agent-registry.md).

Use the FIRST agent whose responsibilities match the primary intent. If multiple tasks: identify one agent per task, plan sequencing.

## Step 2.5: Model routing

Read [references/model-routing.md](references/model-routing.md).

Apply the priority chain:
1. **Opus:** orchestrator, reviewer, code-reviewer, solutions-architect, researcher
2. **Sonnet:** ask, developer, developer-tester, planner, qa, requirements-gatherer, devops, general-purpose, worker
3. **Haiku:** explore, (commit, branch)

## Plugin & Skill Discovery

The router is not limited to the fixed agent registry. It can discover available plugins and skills at runtime and use them to route or enrich a task.

- Before finalizing agent selection, the orchestrator may scan installed plugins (`plugins/*/skills/*/SKILL.md`, `plugins/*/agents/*.md`) to find skills or agents whose frontmatter `description` matches the task, beyond what is listed in the static registry.
- Subagents can be handed suggested plugins/skills that match their task context. For example, if a `developer` step will touch documentation, the orchestrator can note in that agent's task prompt: "Consider using the `technical-writing` skill for the README update."
- Discovery never replaces the approval flow: any newly discovered agent/skill still goes through Step 4 (user approval) before execution.

For the full discovery mechanism and examples, see [references/routing-with-discovery.md](references/routing-with-discovery.md).

### Ask skill routing

Use the **ask** agent for question-answering, repo research, or documentation lookup tasks (for example: "how does X work", "where is Y documented", "research this in the repo"). It is Sonnet-tier and read-only (Read, Grep, Glob, WebSearch, WebFetch); it answers questions rather than changing code.

Routing order:
1. Classify primary intent (Step 1).
2. If intent is a question/research/documentation lookup, route to **ask** (checked AFTER primary intent matching, BEFORE the agent-registry table).
3. Otherwise, proceed with Step 2 matching against [references/agent-registry.md](references/agent-registry.md).

## Step 3: Clarify, then create the plan

### Clarify first

If the decomposition leaves anything ambiguous (scope, target files, or a choice with trade-offs), ask via AskUserQuestion before showing the plan. Give each open point its own question with concrete options, up to 4 questions per call, and add "(Recommended)" to the option you would pick and list it first. Skip this when nothing is ambiguous.

### Write the plan file

Create the plan at `.agent/main-plan/plan-[slug]-[timestamp].md` using [references/plan-format.md](references/plan-format.md). The file opens with the step table and Order line, followed by the detailed per-step sections.

For each step:
- Provide task breakdown and goal
- List relevant files
- Set **Model** per routing table (required) and **Effort**
- Set **Runs** to its place in the execution order
- Set step **Status** to `pending`, or `in_progress` when its Runs value is `Running now`; set the plan **Status** to `PENDING_APPROVAL`

### Show the plan in chat

Print the step table in the chat reply as well as the plan file. Start with the table; no preamble.

```markdown
| # | Step | Agent | Model | Effort | Runs | Files |
|---|---|---|---|---|---|---|
| 1a | Find every call site of the old auth helper | explore | Haiku | low | Wave 1, parallel with 1b | `src/` |
| 1b | Draft the token refresh spec | solutions-architect | Opus | xhigh | Wave 1, parallel with 1a | `docs/auth.md` |
| 2 | Implement token refresh | developer | Sonnet | high | After wave 1 | `src/auth/` |
| 3 | Review the implementation | reviewer | Opus | xhigh | After step 2 | `src/auth/` |

Order: 1a and 1b in parallel, then 2, then 3.
```

- **#:** execution order. Steps in the same wave may share a number with letter suffixes (1a, 1b).
- **Runs:** `Wave N, parallel with X` for steps that start together; `After step N`, `After steps X and Y`, or `After wave N` for steps that wait on earlier work; `Starts first` for a lone first step; or `Running now` for work already in flight.
- **Model** and **Effort:** the values from [references/model-routing.md](references/model-routing.md), or the user's override.
- **Order line:** one line under the table, for example "Order: 1a and 1b in parallel, then 2, then 3 to 5 in parallel, then 6."

Add a short "Decisions you'll be asked" list under the Order line only when the approval call carries plan-specific questions or a step will pause for user input.

## Step 4: Get user approval

Right after the table, ask via AskUserQuestion. The approval question offers:

| Option | Description |
|---|---|
| Approve (Recommended) | Run the plan as shown |
| Edit steps | Type the change in the Other box |
| Change models | Name the steps and models to change |
| Cancel | Stop without running any step |

Plan-specific questions (for example, which of two approaches a step takes) may go in the same call, up to 4 questions in total.

**Edit loop:** on "Edit steps", "Change models", or an Other answer that describes a change, update the plan file, show the full table and Order line again, and ask again. When "Edit steps" or "Change models" arrives without the change, ask for it in a follow-up AskUserQuestion. Agents with `No` in the Can Override column of [references/model-routing.md](references/model-routing.md) keep their default model; tell the user when a requested override hits one. Repeat until the user picks Approve or Cancel.

**Cancel:** set the plan **Status** to `Cancelled` and stop. Dispatch no agents and change no other files.

**Approve:** use the Edit tool to set the plan **Status** to `Approved` and record every user answer (clarifications, step edits, model overrides, plan-specific choices) under `## User Decisions` in the plan file. Then go to Step 5.

Do NOT proceed without explicit approval.

## Step 5: Execute with review loops

### Preflight: disk space

Before dispatching any agent, check free space on the repo filesystem from the main worktree:

```bash
df -h .
```

If available space is under 2G, tell the user how much is free and ask via AskUserQuestion whether to continue before dispatching agents. Mention safe ways to free space (for example `go clean -cache`, `/branch cleanup --dry-run` to preview finished worktrees). Do not delete anything as part of the preflight. If the user stops here, set the plan **Status** to `Cancelled`.

Set the plan **Status** to `In Progress`, then execute the approved plan in the order its Runs column and Order line give. Follow [references/review-protocol.md](references/review-protocol.md).

**Waves:** dispatch every step of a wave in ONE message, each with `run_in_background: true`. Start a step whose Runs value is `After step N`, `After steps X and Y`, or `After wave N` only once every step it names has step **Status** `completed`.

For each step:
1. **Delegate:** Invoke matched agent with:
   - Self-contained task prompt
   - Model parameter per routing table (or always Sonnet if fix phase; see [references/fix-phase-rules.md](references/fix-phase-rules.md))
   - Effort level stated explicitly
   - `run_in_background: true` when the step belongs to a wave
2. **Collect result:** Wait for completion
3. **Review:** If step produces files AND agent ≠ reviewer, trigger the review loop. If the step's output is a markdown report, also run the **Report Quality Gate** (see [references/review-protocol.md](references/review-protocol.md#report-quality-gate)), which invokes `review-md`.
4. **Tag done:** Use Edit tool to set the step **Status** to `completed` + timestamp + review outcome
5. **Proceed:** Only after plan file updated

**Fix Phase:** All fix-phase agents run on Sonnet model (non-negotiable). See [references/fix-phase-rules.md](references/fix-phase-rules.md) for scope constraints and procedure.

## Step 6: Synthesize

After all steps complete:
- Present each agent's output (don't re-do their work)
- Light formatting/stitching only
- If output incomplete, re-delegate and fix
- Set the plan **Status** to `Complete`

## Step 7: Clean up worktrees

Track the exact worktree paths this plan's steps created (from the Agent `isolation: "worktree"` result or EnterWorktree). If any exist and their work is merged:

1. Call ExitWorktree (keep) so the working directory is the main worktree.
2. Run the procedure in [../branch/references/worktree-cleanup.md](../branch/references/worktree-cleanup.md) in targeted mode, passing only those paths. Never run the repo-wide sweep; that belongs to `/branch cleanup`.
3. Include the report (removed worktrees, deleted branches, caches cleared, ignored files removed, space freed, skipped items with reasons) in the synthesis.
4. Add the cleanup outcome to the plan file.

Skip this step if no step created a worktree or the work is not merged yet.

## Fallback rule

No agent matched? This is valid. Handle directly using full generalist capability. Note in plan: "No subagent matched: main agent handling."

## Constraints

- Never skip user approval
- Never invoke agent without task breakdown + context files
- Never proceed past failed review without re-invoking agent
- Keep each agent's task focused
- Never force-remove worktrees (`git worktree remove --force`) or force-delete branches (`git branch -D`)
- Never clean worktrees the plan did not create

## Report Writing Standard

- Put the answer or the most important finding first. No preamble, no restating the question, no closing recap.
- Let content set the length. Report a clean check in one line.
- Give each finding three parts: what happened, why it matters, what to do next.
- State each conclusion once. Open every paragraph with new information.
- Use active voice; put the important subject before the verb.
- Use plain words ("use" for "utilize"). Cut hedges, intensifiers, throat-clearing, buzzwords, and "not X but Y" framing; state what it is.
- Name headings after their content. Skip summary labels ("In conclusion", "Key takeaways"), severity badges, and summary sections unless the reader needs them.
- Write no em dashes (use a period, comma, colon, parentheses, or semicolon), no curly quotes, and no chatbot sign-offs or offers.
- Back every claim with evidence (file and line, log, test result, URL) and every number with a source; label estimates as estimates.
- Report tested results; never present the prompt or an assumption as fact.
- Quote exactly; never reword a quotation.
- Keep ticket ids and internal blame out of user-facing text.
