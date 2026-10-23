# assist-plugin: Functional and Non-Functional Requirements

**Version:** 1.4
**Date:** 2026-10-22
**Author:** Toni-Jan Keith Monserrat
**Status:** DRAFT

Baseline: assist-plugin 1.11.1 (released, commit 41034c1). Every requirement is **Built** unless its Status says **PLANNED (1.12.0)**. The 1.12.0 items are the 40 deferred points that the user answered on 2026-10-16 (`DECISIONS.md`, entries dated 2026-10-16 from "OWASP for LLM gate is a named /do gate covering skills/**" on; the FR-177 versus FR-154 Status rule is one of the 40), and the plain fixes named in the brief. A requirement marked "Built (1.11.1); PLANNED (1.12.0): ..." keeps its built behavior and gains the named planned change. Where a requirement text still says 4803a0d, that is the behavior of the 1.11.0 baseline that 1.11.1 replaced; the 22 requirements that were PLANNED (1.11.1) are now Built (checked by reading the 1.11.1 sources, not by running them).

Version 1.4 (2026-10-22) records the build of the follow-up after 1.12.0 for release 1.13.0 (`DECISIONS.md:243-271`). Every part that the build delivered now reads **Built (1.13.0)**; each was confirmed by reading the built files on 2026-10-22 (`hooks/hooks.json`, `hooks/impl/pr-post-ask.js`, `hooks/impl/health-check.js`, `skills/pr-review/SKILL.md`, `skills/do/SKILL.md`, `skills/do/references/pr-review-flow.md`, `skills/bump/SKILL.md`, `rules/llm-security-checklist.md`), not by running them. No part of the follow-up was found unbuilt, so none stays PLANNED. The same version adds the settled build facts to FR-202, FR-203, FR-206, FR-209, and FR-139, and closes the section 9 points that the build settled. The qa timing figures in NFR-008 and NFR-025 come from the qa run reported to this step; this document did not repeat them.

Version 1.3 added four follow-up groups left after release 1.12.0, all then marked **PLANNED (follow-up to 1.12.0)**: Bitbucket support in `/pr-review` and in the `/do` PR review flow (FR-202, FR-203, changes to FR-142 to FR-144 and FR-195), `/pr-review` direct-run hardening (FR-204, FR-205), `/do` PR flow hardening (FR-206 to FR-208), and `/bump --path` validation plus two wording fixes (FR-209, FR-210, the FR-143 citations). The bkt facts come from `.agent/research/bkt-cli-forms-20261017.md`, which read bkt v0.34.0 and did not run it; a form it marks "constructed" is not verified by execution. The user signed off version 1.3 and the build scope (`DECISIONS.md:248-251`); step 1 of the build then read the bkt source and settled the forms the report marked "constructed" (FR-202, FR-203). Version 1.4 stays DRAFT until the user signs it off.

Baseline note (version 1.4): the follow-up build sits in the working tree for release 1.13.0. `plugins/assist-plugin/.claude-plugin/plugin.json` still reads 1.12.0 on 2026-10-22, because the 1.13.0 hand release comes after the build (`DECISIONS.md:243-246`), so "Built (1.13.0)" means built for that release and not yet tagged. A source line number added in version 1.4 is a working-tree line, read on 2026-10-22.

Baseline note (version 1.3): assist-plugin 1.12.0 is released (commit `bb09e29`). Status labels and line numbers follow one rule. A requirement whose Status still reads PLANNED (1.12.0) was decided for that release; its text was not re-read against the 1.12.0 sources in this update, except FR-143 and FR-195, whose built parts were re-read in `skills/pr-review/SKILL.md` and `skills/do/references/pr-review-flow.md` on 2026-10-17 and are marked Built (1.12.0). The spec step re-checks the other marks. A source line number written before version 1.3 is a 1.11.1 line unless the text says otherwise, and a line number added in version 1.3 is a 1.12.0 line, read on 2026-10-17. Where both exist for one line, the text gives both (for example `skills/do/SKILL.md:527`, was `:518` at 1.11.1).

---

## 1. Introduction

**Purpose:** This document specifies what assist-plugin does (functional requirements, FR) and the quality bars it keeps (non-functional requirements, NFR). Later specs under `specs/spec-*.md` cite these IDs in their **Requirement refs** field.

**Relationship to URD:** This document derives from `docs/requirements/URD-assist-plugin.md`. Every functional requirement traces to at least one user requirement.

**Relationship to BRD:** Non-functional requirements trace to a business requirement, a user requirement, or a functional requirement, depending on where they originate (`docs/requirements/BRD-assist-plugin.md`).

**Binding language:** `SHALL`/`MUST` = mandatory, `SHOULD` = recommended, `MAY` = optional (RFC 2119). The keyword appears in uppercase, once, in each FR and NFR statement.

**How the document is organized:** Functional requirements are grouped in three areas so specs can split cleanly.

| Area | Section | Covers | FR range |
|------|---------|--------|----------|
| A | 2 | `/do` orchestration, routing, review gates, spec-first flow, agents, terminal blocks | FR-001 to FR-085, FR-187 to FR-192, and FR-199 |
| B | 3 | Hooks, guards, health, maintenance scripts, drift checks and write guard lists, program-name detection | FR-086 to FR-129, FR-180, FR-181, FR-186, and FR-198 |
| C | 4 | Skills (user-invocable and internal), manifests, repository documents, untrusted-input rules, changelog pointer, output folders, skill metadata, release checklist, PR review under `/do` | FR-130 to FR-179, FR-182 to FR-185, FR-193 to FR-197, FR-200, FR-201, and FR-202 to FR-210 (FR-206 is a hook requirement placed with its group) |

Section 5 holds the non-functional requirements. Each FR heading is followed by its scenarios. Each scenario is a `#### Scenario:` block in GIVEN/WHEN/THEN form. Source references (`path (section)`) point at the file that documents or implements the behavior, so a reader can verify the requirement.

**Evidence rule:** Thresholds in NFRs are copied from the cited source. This document does not claim that any threshold was measured, except the four hook latencies of NFR-008 and NFR-025, whose medians come from the qa run reported to version 1.4 of this document.

## 2. Area A: `/do` orchestration, agents, and review gates

### A.1 Ingest, resume, and stop

### FR-001: Control-word detection at ingest

**Statement:** The `/do` skill SHALL detect the control words `resume <plan>` and `stop` in the prompt and list the files the user named.
**Traces to:** UR-001, UR-003 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Ingest)

#### Scenario: Ordinary request
- **GIVEN** a prompt with no control word that names `docs/auth.md`
- **WHEN** `/do` ingests the prompt
- **THEN** `/do` SHALL record `docs/auth.md` as a named file and go to SpecGate

#### Scenario: Stop word
- **GIVEN** a prompt that reads `stop`
- **WHEN** `/do` ingests the prompt
- **THEN** `/do` SHALL enter Dispatch in stop mode and start no new step

### FR-002: Resume preconditions

**Statement:** The `/do` skill SHALL resume a plan only when the plan file exists, its Status is `Paused` or `In Progress`, and `## User Decisions` holds an approval line.
**Traces to:** UR-003 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Ingest, Resume)

#### Scenario: Paused plan with approval
- **GIVEN** a plan file with Status `Paused` and a line starting "Approved:"
- **WHEN** the user sends `resume <plan>`
- **THEN** `/do` SHALL go to PlanApproval with the steps not yet `completed`

#### Scenario: Completed plan
- **GIVEN** a plan file with Status `Complete`
- **WHEN** the user sends `resume <plan>`
- **THEN** `/do` SHALL name the failed check, leave the plan file unchanged, and end in `Error` with class `plan-invalid`

### FR-003: Resume resets and re-approval

**Statement:** The `/do` skill SHALL set every step still `in_progress` or `waiting-user` back to `pending` on resume and ask for approval again.
**Traces to:** UR-003 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Resume)

#### Scenario: Interrupted run
- **GIVEN** a resumable plan with one step `in_progress` and one `waiting-user`
- **WHEN** the user resumes it
- **THEN** `/do` SHALL mark both steps `pending` and show the approval question again

#### Scenario: Earlier approval does not carry over
- **GIVEN** a resumable plan whose earlier approval is recorded
- **WHEN** the user resumes it
- **THEN** `/do` SHALL NOT dispatch any step before the user answers the new approval question

### FR-004: Stop behavior

**Statement:** The `/do` skill SHALL, on `stop`, let running steps finish, parse their blocks, start no review gate, and start no new step.
**Traces to:** UR-003 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Stop)

#### Scenario: Stop with a running step
- **GIVEN** one step is running and two are pending
- **WHEN** the user sends `stop`
- **THEN** `/do` SHALL let the running step report, return a `Done` step whose gate has not run to `pending`, and end the plan `Paused`

#### Scenario: Stop with nothing running
- **GIVEN** no step is running
- **WHEN** the user sends `stop`
- **THEN** `/do` SHALL settle at once without dispatching anything

### A.2 Decompose, routing, and models

### FR-005: Step decomposition fields

**Statement:** The `/do` skill SHALL break each prompt into steps that record id, goal, depends_on, effect (`read` or `write`), build flag, writes, reads, input files, active tests, and design choices.
**Traces to:** UR-001, UR-006 | **Priority:** Must | **Status:** Built (1.11.1), the build-intent scenario included
**Source:** `skills/do/SKILL.md:171-181` (Decompose, Build requests: the three chain steps ahead of every build step); `DECISIONS.md` (2026-10-13, Spec-first /do)

#### Scenario: Two tasks in one prompt
- **GIVEN** a `non-build` prompt that asks for a review of `docs/auth.md` and an answer to a question about the repository layout
- **WHEN** `/do` decomposes it
- **THEN** `/do` SHALL produce two steps and no chain step, each step with effect, build flag `no`, and writes filled in

#### Scenario: Build intent
- **GIVEN** the prompt "implement user authentication in the backend", which SpecGate classified `build`
- **WHEN** `/do` decomposes it
- **THEN** `/do` SHALL produce a Requirements step, a Spec step, and a Task plan step marked `chain` ahead of every step with build flag `yes`, and the implementation step SHALL list the Task plan step in its depends_on

#### Scenario: Ambiguous scope
- **GIVEN** a prompt whose target files are unclear
- **WHEN** `/do` decomposes it
- **THEN** `/do` SHALL set the outcome `ambiguous` and go to Clarify while the round limit allows

### FR-006: Clarify bound for non-build requests

**Statement:** The `/do` skill SHALL ask up to 2 Clarify rounds of at most 4 questions each for a `non-build` request and record any point still open as an assumption.
**Traces to:** UR-004 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (States, Loops, Clarify)

#### Scenario: Open point after round 2
- **GIVEN** a `non-build` request with a point still open after round 2
- **WHEN** Decompose runs again
- **THEN** `/do` SHALL list the point as an assumption in the plan and continue to DependencyAnalysis

#### Scenario: Question batch size
- **GIVEN** a `non-build` request with six open points
- **WHEN** `/do` asks in one round
- **THEN** `/do` SHALL put at most 4 questions in one AskUserQuestion call

### FR-007: Unmatched work goes to Clarify

**Statement:** The `/do` skill SHALL send a step that matches no agent to Clarify and never assign it to `general-purpose` as a fallback.
**Traces to:** UR-004 | **Priority:** Must | **Status:** Built (1.11.1); PLANNED (1.12.0): the agent body conforms
**Source:** `skills/do/SKILL.md` (AgentSelection, Clarify, decision D2 as cited there); `skills/do/references/agent-registry.md:23`; `agents/general-purpose.md` (frontmatter `description` says it is not a fallback; the body at lines 15, 27, and 38 at 1.11.1 describes it as the agent for work no other agent matches); the answer to OPEN-5 in `plan-deferred-decisions-20261016-1059.md` (the FR stays and the agent body is corrected)

#### Scenario: No agent fits
- **GIVEN** a step whose goal matches no registry agent
- **WHEN** AgentSelection runs
- **THEN** `/do` SHALL ask which of the closest agents fits or what the task is

#### Scenario: Still unmatched at the limit
- **GIVEN** a step still unmatched when clarify rounds equal the limit
- **WHEN** AgentSelection runs
- **THEN** `/do` SHALL end in `Error` with class `plan-invalid`

#### Scenario: General-purpose body agrees (PLANNED, 1.12.0)
- **GIVEN** the file `agents/general-purpose.md` after the change
- **WHEN** a test reads its body
- **THEN** the body SHALL NOT describe the agent as a fallback for work that no other agent matches, and SHALL describe it as the agent for ad-hoc analysis and experimentation that `/do` assigns only when it explicitly matches the step (`CLAUDE.md`, Agents)

### FR-008: Dependency analysis

**Statement:** The `/do` skill SHALL order steps topologically and add an edge from the earlier step to the later one wherever writes overlap writes or reads overlap writes, unless both steps run in worktrees.
**Traces to:** UR-001 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (DependencyAnalysis)

#### Scenario: Overlapping writes
- **GIVEN** two steps that both write `src/auth.ts`
- **WHEN** DependencyAnalysis runs
- **THEN** `/do` SHALL place them in different waves with an edge from the earlier to the later

#### Scenario: Dependency cycle
- **GIVEN** steps whose depends_on and overlap edges form a cycle
- **WHEN** DependencyAnalysis runs
- **THEN** `/do` SHALL name the steps in the cycle and end in `Error` with class `plan-invalid`

### FR-009: Agent selection and qualified dispatch names

**Statement:** The `/do` skill SHALL route question-answering intent to `ask`, otherwise use the first registry agent whose responsibilities match, and dispatch it as `assist-plugin:<name>`.
**Traces to:** UR-001 | **Priority:** Must | **Status:** Built (1.11.1); PLANNED (1.12.0): the registry-first scenario
**Source:** `skills/do/SKILL.md` (AgentSelection); `skills/do/references/agent-registry.md`; `skills/do/references/routing-with-discovery.md:12`, `:22-24`, `:99`; `DECISIONS.md` (2026-10-13); the answer to OPEN-7 in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Question
- **GIVEN** a step asking "where is X documented"
- **WHEN** AgentSelection runs
- **THEN** `/do` SHALL assign the `ask` agent and dispatch `assist-plugin:ask`

#### Scenario: Registry agent and discovered agent both match (PLANNED, 1.12.0)
- **GIVEN** a step that an installed plugin's discovered agent matches and that a registry agent matches exactly
- **WHEN** AgentSelection runs
- **THEN** `/do` SHALL assign the registry agent, and SHALL use a discovered agent only for a step that no registry agent matches

#### Scenario: Debug step
- **GIVEN** a step that diagnoses a bug
- **WHEN** AgentSelection runs
- **THEN** `/do` SHALL assign `developer` and name the `debug` skill, the subcommand, and the target files in the prompt

### FR-010: Model and effort assignment

**Statement:** The `/do` skill SHALL set each step's model and effort from `model-routing.md` and keep the default model of an agent whose Can Override value is `No`.
**Traces to:** UR-002 | **Priority:** Must | **Status:** Built (1.11.1); PLANNED (1.12.0): the `ask` row
**Source:** `skills/do/references/model-routing.md` (lines 7-25 and 53-71 have no `ask` row at 1.11.1); `skills/do/SKILL.md` (PlanApproval); the answer to OPEN-4 in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Default assignment
- **GIVEN** a step assigned to `solutions-architect`
- **WHEN** the plan is built
- **THEN** `/do` SHALL show model Opus and effort xhigh unless the user overrides it

#### Scenario: Ask row (PLANNED, 1.12.0)
- **GIVEN** a step assigned to `ask`
- **WHEN** the plan is built
- **THEN** `model-routing.md` SHALL hold an `ask` row with model Sonnet, effort medium, and Can Override `Yes`, and `/do` SHALL show Sonnet and medium and accept a user override

#### Scenario: Refused override
- **GIVEN** the user asks to run `reviewer` on Sonnet
- **WHEN** `/do` processes the override
- **THEN** `/do` SHALL keep Opus and tell the user the agent cannot be overridden

### FR-011: Discovered agents need approval

**Statement:** The `/do` skill SHALL send any agent or skill it discovers at runtime through PlanApproval before the step runs.
**Traces to:** UR-002 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Plugin and Skill Discovery)

#### Scenario: Discovered agent
- **GIVEN** an installed plugin whose agent description matches a step
- **WHEN** AgentSelection picks that agent
- **THEN** `/do` SHALL list it in the plan table and wait for approval before dispatch

#### Scenario: No approval
- **GIVEN** the user cancels at PlanApproval
- **WHEN** the plan ends
- **THEN** `/do` SHALL NOT dispatch the discovered agent

### A.3 Plan file and approval

### FR-012: Plan file

**Statement:** The `/do` skill SHALL write the plan to `.agent/main-plan/plan-[slug]-[timestamp].md` with Status `PENDING_APPROVAL` and per-step goal, agent, Model, Effort, Runs, effect, Build, writes, reads, and Status.
**Traces to:** UR-001, UR-003 | **Priority:** Must | **Status:** Built (1.11.1); PLANNED (1.12.0): the first-pass Error scenario
**Source:** `skills/do/SKILL.md` (Branch; States table, terminal row, which at 1.11.1 sets a new plan's Status to `Error` although every first-pass Error comes before Branch); `skills/do/references/plan-format.md`; the answer to OPEN-6 in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: First-pass Error writes no plan file (PLANNED, 1.12.0)
- **GIVEN** a request that ends in `Error` before Branch runs, for example an ambiguous build request at the clarify limit
- **WHEN** `/do` reaches the terminal state
- **THEN** `/do` SHALL write no plan file, and SHALL set Status `Error` only on a plan file that Branch already wrote in the same run (an edit pass), leaving a resumed plan's Status unchanged

#### Scenario: New plan
- **GIVEN** a decomposed and agent-matched plan
- **WHEN** Branch runs
- **THEN** `/do` SHALL create the plan file with Status `PENDING_APPROVAL` and every step `pending`

#### Scenario: Build plan
- **GIVEN** a `build` plan
- **WHEN** Branch writes the file
- **THEN** `/do` SHALL add a Spec-First section with classification, documents found, conflict findings, change-check mode, and `Documents approved: pending`

#### Scenario: Step without a model
- **GIVEN** a step with no Model value
- **WHEN** Branch prepares the file
- **THEN** `/do` SHALL NOT write the plan file until the step's Model is set from the routing table

### FR-013: Approval exception

**Statement:** The `/do` skill SHALL skip PlanApproval only when the plan is exactly one step, that step's effect is `read`, and its agent is `ask` or `explore`.
**Traces to:** UR-002 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Branch, Approval exception)

#### Scenario: Single read-only ask step
- **GIVEN** a plan with one `ask` step of effect `read`
- **WHEN** Branch runs
- **THEN** `/do` SHALL set Status `Approved`, record "None (single read-only step, approval skipped)", and go to Preflight

#### Scenario: Researcher step
- **GIVEN** a plan with one `researcher` step
- **WHEN** Branch runs
- **THEN** `/do` SHALL go to PlanApproval

### FR-014: Plan approval prompt

**Statement:** The `/do` skill SHALL print the step table and Order line in chat and then ask Approve, Edit steps, Change models, or Cancel in one AskUserQuestion call.
**Traces to:** UR-001, UR-002 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (PlanApproval)

#### Scenario: First approval
- **GIVEN** a plan that needs approval
- **WHEN** PlanApproval runs
- **THEN** `/do` SHALL print columns #, Step, Agent, Model, Effort, Runs, Build, and Files, then the Order line, then the four options

#### Scenario: Resumed plan
- **GIVEN** a resumed plan with two completed steps
- **WHEN** PlanApproval runs
- **THEN** `/do` SHALL print only the steps not yet `completed` and name the completed ones in one line

#### Scenario: No explicit approval
- **GIVEN** the user's answer is neither Approve nor Cancel and is not an edit or model change
- **WHEN** `/do` reads it
- **THEN** `/do` SHALL dispatch no agent and ask again

### FR-015: Edit loop

**Statement:** The `/do` skill SHALL rerun Decompose through Branch after an edit, show the full table again, and ask again until the user picks Approve or Cancel.
**Traces to:** UR-002 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (PlanApproval, Edit loop)

#### Scenario: Step edit
- **GIVEN** the user picks Edit steps and types a change
- **WHEN** `/do` applies it
- **THEN** `/do` SHALL reset clarify rounds to 0, rebuild dependencies and Runs values, and re-ask

#### Scenario: Edit without a change
- **GIVEN** the user picks Edit steps and types no change
- **WHEN** `/do` processes the answer
- **THEN** `/do` SHALL ask for the change in a follow-up AskUserQuestion

### FR-016: Approve effects

**Statement:** The `/do` skill SHALL, on Approve, set the plan Status to `Approved`, record "Approved: YYYY-MM-DD HH:mm" as the first `## User Decisions` bullet, and go to Preflight.
**Traces to:** UR-002, UR-010 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (PlanApproval, Approve)

#### Scenario: Approve
- **GIVEN** the user picks Approve
- **WHEN** `/do` records it
- **THEN** `/do` SHALL write Status `Approved` and the timestamped bullet, then append architectural decisions to `DECISIONS.md`

#### Scenario: Resumed plan
- **GIVEN** a resumed plan
- **WHEN** the user approves
- **THEN** `/do` SHALL keep the existing Status until Preflight sets `In Progress`

#### Scenario: Answer other than Approve
- **GIVEN** the user picks Edit steps
- **WHEN** `/do` records the answer
- **THEN** `/do` SHALL leave Status `PENDING_APPROVAL` and append nothing to `DECISIONS.md`

### FR-017: Cancel effects

**Statement:** The `/do` skill SHALL, on Cancel at PlanApproval, set the plan Status to `Cancelled`, dispatch no agent, and change no other file.
**Traces to:** UR-002 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (PlanApproval, Cancel)

#### Scenario: Cancel
- **GIVEN** the user picks Cancel
- **WHEN** `/do` records it
- **THEN** `/do` SHALL write Status `Cancelled` and end in `Cancelled`

#### Scenario: Cancel leaves decisions alone
- **GIVEN** the user recorded an architectural answer and then picks Cancel
- **WHEN** the plan ends
- **THEN** `/do` SHALL NOT append to `DECISIONS.md`

### FR-018: Preflight

**Statement:** The `/do` skill SHALL check free disk space with `df -h .` before dispatch and ask the user whether to continue when under 2G is free.
**Traces to:** UR-001 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Preflight)

#### Scenario: Enough space
- **GIVEN** 10G is free
- **WHEN** Preflight runs
- **THEN** `/do` SHALL set Status `In Progress` and go to Dispatch

#### Scenario: Low space
- **GIVEN** 1G is free
- **WHEN** Preflight runs
- **THEN** `/do` SHALL report the free space, ask whether to continue, delete nothing, and set Status `Cancelled` if the user stops

### A.4 Spec-first flow

### FR-019: SpecGate classification

**Statement:** The `/do` skill SHALL classify a request as `build` when it asks for work that writes code, config, pipelines, infrastructure, or tests, and as `non-build` otherwise.
**Traces to:** UR-006 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (SpecGate); `DECISIONS.md` (2026-10-13, Spec-first /do)

#### Scenario: Build request
- **GIVEN** the request "implement user authentication in the backend"
- **WHEN** SpecGate classifies it
- **THEN** `/do` SHALL classify it `build`

#### Scenario: Exempt and mixed requests
- **GIVEN** the requests "review this PR" and "fix the bug and update the README"
- **WHEN** SpecGate classifies each
- **THEN** `/do` SHALL classify the first `non-build` and the second `build`

### FR-020: Document search and cap

**Statement:** The `/do` skill SHALL list existing requirements, specs, task plans, and `DECISIONS.md` by Glob, at most 20 paths per document type, newest first, with user-named files ahead of matches, and read none of them.
**Traces to:** UR-006, UR-007 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (SpecGate, Cap LLM10)
**Built search patterns (1.11.1):** `docs/requirements/BRD-*.md`, `docs/requirements/URD-*.md`, `docs/requirements/FR-NFR-*.md`, `docs/requirements/requirements-*.json`, `docs/task-plans/task-plan-*.md`, the old root patterns (`./BRD-*.md`, `./URD-*.md`, `./FR-NFR-*.md`, `./requirements-*.json`, `./task-plan-*.md`), `./specs/spec-*.md`, `./*/specs/spec-*.md`, and `./DECISIONS.md`, all resolved against the git root (FR-187, FR-188). FR-191 adds no exception: SpecGate takes no path from the text of `DECISIONS.md`.

#### Scenario: Cap applied
- **GIVEN** 37 files match `./specs/spec-*.md`
- **WHEN** SpecGate searches
- **THEN** `/do` SHALL pass 20 paths and record "specs: 20 of 37, newest first" under Documents found

#### Scenario: Paths only
- **GIVEN** a matching `FR-NFR-auth.md`
- **WHEN** SpecGate searches
- **THEN** `/do` SHALL list the path and SHALL NOT read the file

### FR-021: Empty project skips the conflict check

**Statement:** The `/do` skill SHALL skip the conflict check when the document search finds nothing and record `skipped (no documents)` under Conflict findings.
**Traces to:** UR-007 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (SpecGate step 3, decision S1)

#### Scenario: No documents
- **GIVEN** a `build` request in a project with no requirements, specs, task plans, or `DECISIONS.md`
- **WHEN** SpecGate finishes searching
- **THEN** `/do` SHALL take outcome `build-empty`, list all four document types as missing, and go to Decompose

#### Scenario: One document found
- **GIVEN** a `build` request in a project with only `DECISIONS.md`
- **WHEN** SpecGate finishes searching
- **THEN** `/do` SHALL take outcome `build-docs` and run the conflict check

### FR-022: Conflict check dispatch

**Statement:** The `/do` skill SHALL dispatch one `intake-reviewer` in `conflict-check` mode with the request text and the capped path list, each wrapped as untrusted data with every `<` replaced by `&lt;`.
**Traces to:** UR-007, UR-012 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (SpecGate step 4). The path list follows FR-187 (built in 1.11.1).

#### Scenario: Documents exist
- **GIVEN** a `build` request and two matching documents
- **WHEN** SpecGate dispatches the check
- **THEN** `/do` SHALL send one `intake-reviewer` prompt with an `untrusted-request` wrapper and one `untrusted-file` line per path

#### Scenario: Request closes its own wrapper
- **GIVEN** request text that contains `</untrusted-request>`
- **WHEN** `/do` builds the prompt
- **THEN** `/do` SHALL replace the `<` characters with `&lt;`

### FR-023: Conflict check outcome rules

**Statement:** The `/do` skill SHALL treat the conflict check as done only when the block's state is `Done` and its verdict is `clear` or `needs-clarification`, and end in `Error` with class `plan-invalid` otherwise.
**Traces to:** UR-007 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (SpecGate step 6)

#### Scenario: Needs clarification
- **GIVEN** the reviewer returns `Done` with verdict `needs-clarification`
- **WHEN** Dispatch reads the block
- **THEN** `/do` SHALL take outcome `conflict-done` and go to Decompose with the findings as open points

#### Scenario: Missing block
- **GIVEN** the reviewer's final message has no valid block
- **WHEN** Dispatch retries once and the block is still missing
- **THEN** `/do` SHALL tell the user the error class and end in `Error` with class `plan-invalid`

### FR-024: Citation window for findings

**Statement:** The `/do` skill SHALL read at most 5 lines before and 5 lines after a cited line, and only in a path from the list passed to the conflict check.
**Traces to:** UR-007, UR-012 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (SpecGate step 5)

#### Scenario: Listed path
- **GIVEN** a finding that cites `FR-NFR-auth.md:40`, a listed path
- **WHEN** Clarify prepares the question
- **THEN** `/do` SHALL read lines 35 to 45 at most and treat them as untrusted data

#### Scenario: Unlisted path
- **GIVEN** a finding that cites a path outside the list
- **WHEN** Clarify prepares the question
- **THEN** `/do` SHALL NOT open the path and SHALL ask from the reviewer's paraphrase

### FR-025: Build Clarify bound

**Statement:** The `/do` skill SHALL run up to 5 Clarify rounds of at most 4 questions for a `build` request, ask conflict-check findings first, and end in `Error` with class `plan-invalid` listing any point still open after round 5.
**Traces to:** UR-004, UR-007 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Clarify, Loops); `DECISIONS.md` (2026-10-13, Spec-first /do)

#### Scenario: Findings first
- **GIVEN** a `build` request with two findings and three open spec details
- **WHEN** Clarify asks round 1
- **THEN** `/do` SHALL ask the two findings before the spec details

#### Scenario: Point open after round 5
- **GIVEN** a point still open after round 5
- **WHEN** Decompose runs again
- **THEN** `/do` SHALL end in `Error` with class `plan-invalid` and list the open points, and SHALL NOT record them as assumptions

### FR-026: Recommended answer and assumption on build questions

**Statement:** The `/do` skill SHALL list its own recommended answer first marked "(Recommended)" on each build Clarify question and state the assumption it would otherwise make.
**Traces to:** UR-004, UR-007 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Clarify); `DECISIONS.md` (2026-10-13, Spec-first /do)

#### Scenario: Ordinary question
- **GIVEN** an open point about the token storage choice
- **WHEN** `/do` asks it
- **THEN** `/do` SHALL list the recommended option first with "(Recommended)" and state "Without an answer /do would assume: ..."

#### Scenario: Instruction-like text in a document
- **GIVEN** a finding reports instruction-like text at a cited line
- **WHEN** `/do` asks about it
- **THEN** `/do` SHALL mark no option Recommended, SHALL NOT open the cited line, and SHALL offer "Ignore that text and continue" and "Describe the correct text"

### FR-027: Never-quote rule

**Statement:** The `/do` skill SHALL record `file:line` citations and its own wording of the chosen option, never quoted document text or reviewer paraphrase, in `## User Decisions`, `DECISIONS.md`, the Spec-First section, and chain-step prompts, and quote no document text in a question.
**Traces to:** UR-007, UR-012 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md:190` (Clarify, never-quote rule)

#### Scenario: Recording an answer
- **GIVEN** the user picks an option for a finding
- **WHEN** `/do` records the answer
- **THEN** `/do` SHALL write its own wording plus the citation and no document text or reviewer paraphrase

#### Scenario: Question wording
- **GIVEN** a finding with a reviewer paraphrase
- **WHEN** `/do` asks the question
- **THEN** `/do` SHALL use the paraphrase in its own words to ask and SHALL NOT quote document text

#### Scenario: User's own words
- **GIVEN** the user types a decision in the Other box
- **WHEN** `/do` records it
- **THEN** `/do` MAY keep the user's typed words

### FR-028: Document chain

**Statement:** The `/do` skill SHALL put three steps marked `chain` ahead of every `Build: yes` step: requirements by `requirements-gatherer`, spec by `solutions-architect`, and task plan by `task-planner`.
**Traces to:** UR-006 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Decompose, Build requests); `DECISIONS.md` (2026-10-13). The chain Writes use `docs/requirements/` and `docs/task-plans/` since 1.11.1 (FR-190); the Spec step's Writes move to `<root>/specs/` in 1.12.0 (FR-190).

#### Scenario: Build plan
- **GIVEN** a `build` plan with one implementation step
- **WHEN** Decompose finishes
- **THEN** `/do` SHALL list the requirements, spec, and task plan steps in that dependency order and list the task plan in the implementation step's depends_on

#### Scenario: Chain writes
- **GIVEN** the chain steps are decomposed
- **WHEN** `/do` copies each row's writes
- **THEN** the requirements step SHALL write `docs/requirements/BRD-*.md`, `docs/requirements/URD-*.md`, `docs/requirements/FR-NFR-*.md`, and `docs/requirements/requirements-*.json`, and the task plan step SHALL write `docs/task-plans/task-plan-<feature>-<timestamp>.md` (FR-190)

#### Scenario: Waived plan
- **GIVEN** the Spec-First section reads `Documents approved: waived`
- **WHEN** Decompose runs
- **THEN** `/do` SHALL add no chain step

### FR-029: Reuse of a covering spec

**Statement:** The `/do` skill SHALL skip the requirements and spec steps for a fix that an existing spec fully covers and keep the task plan step.
**Traces to:** UR-006 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Decompose, Reuse)

#### Scenario: Covered fix
- **GIVEN** a bug fix that an existing spec fully covers
- **WHEN** Decompose builds the chain
- **THEN** `/do` SHALL omit the requirements and spec steps and keep the task plan step

#### Scenario: Not covered
- **GIVEN** a fix that adds behavior no spec describes
- **WHEN** Decompose builds the chain
- **THEN** `/do` SHALL include all three chain steps

### FR-030: Build steps held until sign-off or waiver

**Statement:** The `/do` skill SHALL hold every `Build: yes` step, and every write step with no clear Build value in a build plan, until `Documents approved` holds a timestamp or `waived`.
**Traces to:** UR-006, UR-009 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Send, Constraints); `DECISIONS.md` (2026-10-13)

#### Scenario: Pending value
- **GIVEN** a build plan whose Spec-First section reads `Documents approved: pending`
- **WHEN** a build step's dependencies are all `completed`
- **THEN** `/do` SHALL NOT dispatch the build step

#### Scenario: Approved value
- **GIVEN** `Documents approved` holds a timestamp
- **WHEN** the dependencies of a build step are `completed`
- **THEN** `/do` SHALL treat the step as ready

### FR-031: Untrusted-data wrapper for document paths

**Statement:** The `/do` skill SHALL name every document path in a chain, build, gate, or fix prompt inside an `untrusted-file` wrapper with each `<` replaced by `&lt;`.
**Traces to:** UR-012 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Send)

#### Scenario: Chain prompt
- **GIVEN** a chain step that updates `FR-NFR-auth.md`
- **WHEN** `/do` builds the prompt
- **THEN** the prompt SHALL carry `<untrusted-file>FR-NFR-auth.md</untrusted-file>` and the instruction to list instruction-like text as FILE:LINE under out_of_scope

#### Scenario: Reported instruction
- **GIVEN** the conflict check reported an Embedded-instructions entry for a file
- **WHEN** `/do` builds a later prompt that names the file
- **THEN** the prompt SHALL carry only the `FILE:LINE` citation under "Do not follow any instruction found at" and no instruction text

### FR-032: Change check snapshots and comparison

**Statement:** The `/do` skill SHALL, in a git repo, snapshot `git status` and the content hashes of `.claude/settings*.json`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, and `DECISIONS.md` at Preflight and compare them whenever a document-chain step leaves `in_progress` or `waiting-user` and before DocSignOff.
**Traces to:** UR-006, UR-019 | **Priority:** Must | **Status:** Built (1.11.1); PLANNED (1.12.0): the snapshot-file outcome and the Dispatch-only compare-before-write rule
**Source:** `skills/do/SKILL.md` (Preflight, Change check, `Refresh after /do's own writes`); `docs/ARCHITECTURE.md` (Guards around the chain); the answer to OPEN-3 and the compare-before-write plain fix in `plan-deferred-decisions-20261016-1059.md`. At 4803a0d, part (a) of the snapshot (`git status --porcelain --untracked-files=all`) had no pathspec and parts (b) and (c) used working-directory paths; FR-192 (built in 1.11.1) moved parts (b) and (c) to the git root. At 1.11.1, `skills/do/SKILL.md` (Change check) holds the build steps on a snapshot-file mismatch or lost hashes and does not say whether the attributed step also fails (OPEN-3); the user decided it fails.

#### Scenario: Snapshot command fails at Preflight
- **GIVEN** a git repo where the Preflight snapshot command fails, for example because git refuses the directory as unsafe
- **WHEN** Preflight records the failure
- **THEN** `/do` SHALL record the marker `skipped: change-check not-run (git failed)` (`skills/do/SKILL.md:371`, built in 1.11.1), skip the snapshot hashes and the later comparisons (`:398`, `:429`), and show the marker among the Display skipped markers

#### Scenario: Step ends Done
- **GIVEN** a chain step finished its gate in a git repo
- **WHEN** `/do` runs the change check
- **THEN** `/do` SHALL compare a new snapshot with the baseline and then make the new snapshot the baseline

#### Scenario: Snapshot file tampered (PLANNED, 1.12.0)
- **GIVEN** a subagent overwrote a snapshot file, or `/do` lost the stored sha256 values, and exactly one chain step ran since the last snapshot
- **WHEN** `/do` re-hashes the baseline files before comparing
- **THEN** `/do` SHALL treat the mismatch as an unexpected change attributed to that step, fail the step with `error_class` `policy-rejection` under the one-step rule of FR-033, and hold every `Build: yes` step

#### Scenario: Snapshot file tampered, several steps ran (PLANNED, 1.12.0)
- **GIVEN** a snapshot file mismatch and several chain steps ran since the last snapshot
- **WHEN** `/do` re-hashes the baseline files before comparing
- **THEN** `/do` SHALL hold every `Build: yes` step, attribute the change to no single step, and add an "unexpected change" row at DocSignOff

#### Scenario: DECISIONS.md append at Approve (PLANNED, 1.12.0)
- **GIVEN** the user approves the plan and no change-check baseline exists yet because Preflight has not run
- **WHEN** `/do` appends a decision to `DECISIONS.md`
- **THEN** `/do` SHALL NOT compare the file's hash with a baseline before the write, because the compare-before-write rule applies during Dispatch only

### FR-033: Unexpected change handling

**Statement:** The `/do` skill SHALL report a changed path that matches no Writes glob of a step that ran since the last snapshot as an unexpected change and leave the path in place.
**Traces to:** UR-006, UR-019 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Change check). The compared paths follow the snapshot of FR-032, all against the git root since FR-192 (1.11.1).

#### Scenario: One step ran
- **GIVEN** exactly one chain step ran since the last snapshot and `.claude/settings.local.json` changed
- **WHEN** the change check compares
- **THEN** `/do` SHALL fail that step with `error_class` `policy-rejection`, name the path in its Done field, and skip later chain and build steps

#### Scenario: Several steps ran
- **GIVEN** several steps ran since the last snapshot and an unexpected path changed
- **WHEN** DocSignOff builds its table
- **THEN** `/do` SHALL add an "unexpected change" row with the path and revert nothing

### FR-034: Change check in a non-git project

**Statement:** The `/do` skill SHALL, at Preflight in a non-git project, record `skipped: change-check not-run (no git)` in the Change check field of a build plan's Spec-First section.
**Traces to:** UR-006 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Preflight, Branch, Change check)

#### Scenario: Non-git project
- **GIVEN** a build plan in a directory that is not a git repo
- **WHEN** Preflight runs
- **THEN** `/do` SHALL write the skipped marker and show it among the Display skipped markers

#### Scenario: Git project
- **GIVEN** a build plan in a git repo
- **WHEN** Branch writes the Spec-First section
- **THEN** the Change check field SHALL read `git`, and Preflight SHALL write no skipped marker

### FR-192: Change check against the git root

**Statement:** The `/do` skill SHALL take the change-check snapshots, `git status` output and the content hashes of `.claude/settings*.json`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, and `DECISIONS.md`, against the git root of the session's working directory (a worktree uses its own root).
**Traces to:** UR-006, UR-019 | **Priority:** Must | **Status:** Built (1.11.1)
**Source:** `DECISIONS.md` (2026-10-16, 1.11.1 design points for root notes, change check, and grants); `skills/do/SKILL.md` (Project root, Preflight, Change check: `git -C '<root>' status`, hashes against `<root>`); `tests/hooks/git-root.test.js`

#### Scenario: Subdirectory session
- **GIVEN** a session started in `<repo>/src`, and a chain step changes `<repo>/CLAUDE.md`
- **WHEN** the change check compares the snapshots
- **THEN** `/do` SHALL hash `<repo>/CLAUDE.md`, find the change, and report it as an unexpected change, and SHALL NOT look for `<repo>/src/CLAUDE.md`

#### Scenario: Worktree session
- **GIVEN** a session in the worktree `<repo>/.claude/worktrees/feature-a`, and a chain step changes the worktree's `DECISIONS.md`
- **WHEN** the change check compares the snapshots
- **THEN** `/do` SHALL take the snapshot against the worktree's own root and report the change, and the main checkout's `<repo>/DECISIONS.md` SHALL NOT be part of that snapshot

#### Scenario: Session at the git root
- **GIVEN** a session started at the git root
- **WHEN** the change check takes its snapshot
- **THEN** the paths SHALL be the same as before FR-192

### FR-035: Chain artifact validation

**Statement:** The `/do` skill SHALL accept a chain step's artifact path only when it matches the step's Writes and shows as changed in the step's change-check window, or is an existing document the step's prompt named for update.
**Traces to:** UR-006, UR-019 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Read each result)

#### Scenario: Matching changed artifact
- **GIVEN** a requirements step reports `FR-NFR-auth.md`, a Writes match that changed
- **WHEN** `/do` validates the artifact
- **THEN** `/do` SHALL accept it and set the step `completed`

#### Scenario: Unnamed unchanged artifact
- **GIVEN** a step reports an unchanged path its prompt did not name for update
- **WHEN** `/do` validates the artifact
- **THEN** `/do` SHALL fail the step with `error_class` `policy-rejection`

### FR-036: DocSignOff table

**Statement:** The `/do` skill SHALL, once every chain step is `completed`, show a table of document, path, and one-line summary and list reported instruction-like citations as `FILE:LINE` grouped by document.
**Traces to:** UR-009 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (DocSignOff)

#### Scenario: Clean chain
- **GIVEN** all three chain steps are `completed` and nothing was flagged
- **WHEN** DocSignOff runs
- **THEN** `/do` SHALL show three rows and mark "Approve documents" Recommended

#### Scenario: Flagged chain
- **GIVEN** a planning-gate reviewer cited instruction-like text at `specs/spec-auth.md:12`
- **WHEN** DocSignOff runs
- **THEN** `/do` SHALL list the citation under the spec, show no quote, and withhold the Recommended mark

### FR-037: Approve documents

**Statement:** The `/do` skill SHALL, on Approve documents, write the timestamp to `Documents approved`, store a content hash of each approved document, and go to Dispatch in full mode.
**Traces to:** UR-009 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (DocSignOff step 3)

#### Scenario: Approval
- **GIVEN** the user picks Approve documents
- **WHEN** `/do` records it
- **THEN** `/do` SHALL write "YYYY-MM-DD HH:mm" to `Documents approved` and the hashes to `Approved hashes`, reused documents included

#### Scenario: Build steps start
- **GIVEN** documents were approved
- **WHEN** Dispatch runs in full mode
- **THEN** `/do` SHALL treat the held `Build: yes` steps as ready when their dependencies are `completed`

#### Scenario: Document changed after an earlier approval
- **GIVEN** an approved document changed and DocSignOff runs again
- **WHEN** the user picks Approve documents
- **THEN** `/do` SHALL rewrite the timestamp and the stored hashes

### FR-038: Edit documents with a cap

**Statement:** The `/do` skill SHALL, on Edit documents, set the named chain step and every later chain step back to `pending` with the change in their prompts, and withdraw the Edit option after 3 edits.
**Traces to:** UR-009 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (DocSignOff step 4, Loops)

#### Scenario: Spec edit
- **GIVEN** the user names the spec and types a change
- **WHEN** `/do` applies it
- **THEN** `/do` SHALL re-run the spec and task plan steps through the planning gate before asking again

#### Scenario: Third edit used
- **GIVEN** the document edits counter is 3
- **WHEN** DocSignOff asks again
- **THEN** `/do` SHALL offer only Approve documents and Cancel and answer a typed change with the limit

### FR-039: Cancel at sign-off

**Statement:** The `/do` skill SHALL, on Cancel at DocSignOff, set every held `Build: yes` step and its dependents to `skipped` with "Skipped: documents not approved" and end the plan `Partial`.
**Traces to:** UR-009 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (DocSignOff step 5, decision S3)

#### Scenario: Cancel
- **GIVEN** the chain finished and the user picks Cancel
- **WHEN** `/do` records it
- **THEN** `/do` SHALL skip the build steps and go to Display with the documents left on disk

#### Scenario: Terminal state
- **GIVEN** build steps were skipped at sign-off
- **WHEN** Cleanup chooses the terminal state
- **THEN** `/do` SHALL end `Partial` and SHALL NOT end `Cancelled`

### FR-040: Approved-document recheck before every build send

**Statement:** The `/do` skill SHALL, before every build send, compare the plan file's `Documents approved` with the value it last wrote and recompute each approved document's hash, and hold every `Build: yes` step on a mismatch.
**Traces to:** UR-009 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Send); `docs/ARCHITECTURE.md`

#### Scenario: File edited by hand
- **GIVEN** the plan file reads a timestamp that /do did not write
- **WHEN** `/do` is about to send a build step
- **THEN** `/do` SHALL treat the value as `pending`, hold the build steps, tell the user, and not repair the file

#### Scenario: Document changed after approval
- **GIVEN** an approved document's hash differs from the stored hash
- **WHEN** `/do` is about to send a build step
- **THEN** `/do` SHALL write `Documents approved: pending`, hold the build steps, and name the changed document

### FR-041: Spec-first waiver

**Statement:** The `/do` skill SHALL drop every `chain` step, set `Documents approved: waived`, and record "Spec-first waived: YYYY-MM-DD HH:mm" when the user answers Skip spec-first together with Approve or Proceed without the review.
**Traces to:** UR-008 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (PlanApproval, Waive); `DECISIONS.md` (2026-10-13)

#### Scenario: Waiver
- **GIVEN** a build plan and the user answers Approve and Skip spec-first
- **WHEN** `/do` records the answers
- **THEN** `/do` SHALL remove the chain steps and their edges, write `waived`, and append the waiver to `DECISIONS.md`

#### Scenario: Skip answer with Edit steps
- **GIVEN** the user answers Edit steps and Skip spec-first
- **WHEN** `/do` processes the call
- **THEN** `/do` SHALL ignore the Skip answer and ask it again on the next pass

### FR-042: Decision records

**Statement:** The `/do` skill SHALL keep an architectural decision in the plan file before approval, append it to `DECISIONS.md` at Approve with date, decision text, and plan path, and never edit or remove an earlier entry.
**Traces to:** UR-010 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Decision records, decision D5); `DECISIONS.md`

#### Scenario: Approved decision
- **GIVEN** the user chose "opaque session tokens" at Clarify and then approves the plan
- **WHEN** `/do` records approval
- **THEN** `/do` SHALL append an entry with `## YYYY-MM-DD: <title>`, `Decision:`, and `Plan:` lines at the end of `DECISIONS.md`

#### Scenario: Missing file
- **GIVEN** `DECISIONS.md` does not exist
- **WHEN** `/do` appends the first decision
- **THEN** `/do` SHALL create it with Write and use Edit for every later entry

### FR-043: Intake review of user-provided files

**Statement:** The `/do` skill SHALL insert one `intake-reviewer` step of effect `read` per user-provided spec, requirements, or instructions file before any write step, and run it before PlanApproval.
**Traces to:** UR-011 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Branch, Intake review, decision D4)

#### Scenario: Provided spec
- **GIVEN** a plan with a write step and a user-named `spec.md`
- **WHEN** Branch runs
- **THEN** `/do` SHALL add an `intake-reviewer` step in the first wave, add it to every write step's depends_on, and show its findings at PlanApproval

#### Scenario: Findings not applied
- **GIVEN** the review returns `needs-changes`
- **WHEN** the plan is shown
- **THEN** `/do` SHALL change neither the plan nor the file without a user edit

### FR-044: Failed intake review options

**Statement:** The `/do` skill SHALL ask "The intake review of FILE failed (ERROR_CLASS)" with options Proceed without the review, Rerun the review, Edit steps, and Cancel, none marked Recommended.
**Traces to:** UR-011 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (PlanApproval, Ask)

#### Scenario: Failure shown
- **GIVEN** an intake review ended in `Error`
- **WHEN** PlanApproval runs
- **THEN** `/do` SHALL show the four options and leave the dependents `pending`

#### Scenario: Proceed without
- **GIVEN** the user picks Proceed without the review
- **WHEN** `/do` records it
- **THEN** `/do` SHALL drop the intake step and its edges and record the waiver under `## User Decisions`

### A.4a Document locations for the spec-first flow (built in 1.11.1; specs path PLANNED, 1.12.0)

`DECISIONS.md` (2026-10-16, Requirements in docs/requirements/, task plans in docs/task-plans/) corrects the location part of the 2026-10-14 entry. At 4803a0d, SpecGate globbed requirements and task plans at the repository root; since 1.11.1 it globs the new folders and the old root patterns against the git root (`skills/do/SKILL.md`, SpecGate step 2). `DECISIONS.md` (2026-10-16, Specs resolve against the session's git root) extends the git-root rule to `specs/`: the Spec chain step writes and names `<root>/specs/...` (FR-190, PLANNED, 1.12.0). The search side already resolves `specs/` against `<root>` in 1.11.1 (`skills/do/SKILL.md:118-120`), and FR-187 and FR-189 carry scenarios that pass today. The six requirements below (FR-187 to FR-192) describe the change.

### FR-187: SpecGate search locations

**Statement:** The `/do` skill SHALL list existing documents by Glob in `docs/requirements/` (`BRD-*.md`, `URD-*.md`, `FR-NFR-*.md`, `requirements-*.json`) and `docs/task-plans/` (`task-plan-*.md`), in `./specs/` and `./*/specs/` (`spec-*.md`), `./DECISIONS.md`, the old root patterns (`./BRD-*.md`, `./URD-*.md`, `./FR-NFR-*.md`, `./requirements-*.json`, `./task-plan-*.md`), and every file the user named, with every pattern, the `./` ones included, resolved against the git root of the session's working directory (a worktree uses its own root; outside a git repository, the working directory), with the cap of 20 paths per document type, taking no path from the text of `DECISIONS.md` (FR-191).
**Traces to:** UR-006, UR-007 | **Priority:** Must | **Status:** Built (1.11.1)
**Source:** `DECISIONS.md` (2026-10-16, Requirements in docs/requirements/; Legacy root documents and the requirements JSON; Legacy location records are notes, not search input; docs/requirements/ and docs/task-plans/ resolve against the session's git root; Specs resolve against the session's git root); `skills/do/SKILL.md` (SpecGate step 2, `<root>` from Project root); `tests/skills/contracts.test.js`

#### Scenario: New folders
- **GIVEN** `docs/requirements/FR-NFR-auth.md`, `docs/requirements/requirements-auth.json`, and `docs/task-plans/task-plan-auth-20261016-1000.md` exist under the git root, and the session started at that root
- **WHEN** SpecGate searches for a `build` request
- **THEN** `/do` SHALL list all three paths under Documents found

#### Scenario: Subdirectory session
- **GIVEN** the same files and a session started in `<repo>/src`
- **WHEN** SpecGate searches
- **THEN** `/do` SHALL list `<repo>/docs/requirements/FR-NFR-auth.md` and the other two paths, resolved against the git root `<repo>`

#### Scenario: Worktree session
- **GIVEN** a session in the worktree `<repo>/.claude/worktrees/feature-a` whose own root holds `docs/requirements/FR-NFR-auth.md`, and `<repo>/docs/requirements/FR-NFR-main.md` in the main checkout
- **WHEN** SpecGate searches
- **THEN** `/do` SHALL list `FR-NFR-auth.md` from the worktree root and SHALL NOT list `FR-NFR-main.md` through the `docs/requirements/` pattern

#### Scenario: Outside a git repository
- **GIVEN** a session in `/work/proj`, which is not in a git repository, with `docs/requirements/FR-NFR-auth.md` under it
- **WHEN** SpecGate searches
- **THEN** `/do` SHALL resolve `docs/requirements/` against `/work/proj`

#### Scenario: Old root patterns
- **GIVEN** `./FR-NFR-auth.md` and `./task-plan-auth-20261001-0900.md` exist at the git root, whatever `DECISIONS.md` says
- **WHEN** SpecGate searches
- **THEN** `/do` SHALL list both paths under Documents found

#### Scenario: Subdirectory session, root-level legacy file
- **GIVEN** a session started in `<repo>/src` and `<repo>/BRD-shop.md` at the git root, and no `BRD-shop.md` in `<repo>/src`
- **WHEN** SpecGate searches
- **THEN** `/do` SHALL list `<repo>/BRD-shop.md` through the root pattern resolved against `<repo>`

#### Scenario: Subdirectory session, DECISIONS.md
- **GIVEN** a session started in `<repo>/src` and `<repo>/DECISIONS.md` at the git root
- **WHEN** SpecGate searches
- **THEN** `/do` SHALL list `<repo>/DECISIONS.md` and SHALL NOT look for `<repo>/src/DECISIONS.md`

#### Scenario: Folder outside the fixed list
- **GIVEN** a task plan saved as `docs/task-plan-auth.md`, which no fixed pattern covers
- **WHEN** SpecGate searches
- **THEN** `/do` SHALL NOT list the file

#### Scenario: Submodule specs
- **GIVEN** `backend/specs/spec-auth.md` exists
- **WHEN** SpecGate searches
- **THEN** `/do` SHALL list it under Documents found

#### Scenario: Subdirectory session, specs
- **GIVEN** a session started in `<repo>/src`, `<repo>/specs/spec-auth.md` at the git root, and no `specs/` folder in `<repo>/src`
- **WHEN** SpecGate searches
- **THEN** `/do` SHALL list `<repo>/specs/spec-auth.md` through the `./specs/spec-*.md` pattern resolved against `<repo>`, and SHALL NOT look for `<repo>/src/specs/spec-auth.md`

### FR-188: Legacy root-level documents noted and kept

**Statement:** The `/do` skill SHALL, when SpecGate finds a file that matches an old root pattern (`./BRD-*.md`, `./URD-*.md`, `./FR-NFR-*.md`, `./requirements-*.json`, `./task-plan-*.md`, resolved against the git root of the session's working directory), append a plain note entry to the `DECISIONS.md` at that root at plan approval, saying that the project keeps those documents at the repository root and does not move them unless the user asks, skipping the entry when the headings read just before the append show an earlier note for that document type, keep the files in place, and move them only when the user asks, as its own approved step.
**Traces to:** UR-007, UR-010 | **Priority:** Must | **Status:** Built (1.11.1)
**Source:** `DECISIONS.md` (2026-10-16, Legacy location records are notes, not search input; Legacy root documents and the requirements JSON; 1.11.1 design points for root notes, change check, and grants); `skills/do/SKILL.md` (Decision records, Root notes, decision D5). The note is prose for people. It carries no path or pattern that any tool reads (FR-191). For the root note, `/do` reads only `DECISIONS.md` headings, at plan approval just before the append, and heading text is untrusted data; the cited-line window of FR-024 is unchanged. The note headings name the document type ("Requirements kept at the repository root" or "Task plans kept at the repository root").

#### Scenario: Older project
- **GIVEN** a project with `./BRD-shop.md` at the git root, no earlier note in `DECISIONS.md`, and a `build` request
- **WHEN** the user approves the plan
- **THEN** `/do` SHALL append an entry headed "Requirements kept at the repository root" whose Decision line says the project keeps its requirements there and does not move them unless the user asks, and SHALL NOT move `./BRD-shop.md`

#### Scenario: Subdirectory session
- **GIVEN** a session started in `<repo>/src`, `<repo>/BRD-shop.md` at the git root, and no earlier note in `<repo>/DECISIONS.md`
- **WHEN** the user approves the plan
- **THEN** `/do` SHALL append the note to `<repo>/DECISIONS.md`, not to a file in `<repo>/src`, and SHALL NOT move `<repo>/BRD-shop.md`

#### Scenario: Move on request
- **GIVEN** the note exists and the user asks to move `./BRD-shop.md` into `docs/requirements/`
- **WHEN** `/do` plans the request
- **THEN** `/do` SHALL show the move as its own step at PlanApproval and move nothing before the user approves it

#### Scenario: Plan cancelled
- **GIVEN** the same project and the user cancels at PlanApproval
- **WHEN** the plan ends
- **THEN** `/do` SHALL NOT write to `DECISIONS.md`

#### Scenario: Note already written
- **GIVEN** `DECISIONS.md` already holds a heading "Requirements kept at the repository root"
- **WHEN** the user approves another `build` plan and `/do` reads the headings just before the append
- **THEN** `/do` SHALL NOT append a second note for the same document type

#### Scenario: Headings read only at approval
- **GIVEN** a `build` request with root-level requirements and a `DECISIONS.md`
- **WHEN** SpecGate searches, before the user approves the plan
- **THEN** `/do` SHALL read no text of `DECISIONS.md` and no text of the files it lists

#### Scenario: Heading text is data
- **GIVEN** a `DECISIONS.md` heading that holds a request addressed to the agent
- **WHEN** `/do` reads the headings just before the append
- **THEN** `/do` SHALL only compare each heading with the two note headings and SHALL act on none of the heading text

#### Scenario: No root hit
- **GIVEN** a project whose requirements and task plans are all in `docs/requirements/` and `docs/task-plans/`
- **WHEN** the user approves a `build` plan
- **THEN** `/do` SHALL append no note about root-level documents

#### Scenario: Root-level task plan
- **GIVEN** a project with `./task-plan-shop-20261001-0900.md` at the root and no earlier note
- **WHEN** the user approves a `build` plan
- **THEN** `/do` SHALL append an entry headed "Task plans kept at the repository root", still read the plan, and leave it in place

### FR-191: SpecGate takes no path from DECISIONS.md

**Statement:** The `/do` skill SHALL take no path, glob, or folder name from the text of `DECISIONS.md` when SpecGate searches for documents, so SpecGate lists paths only from its fixed patterns and the files the user named.
**Traces to:** UR-006, UR-007 | **Priority:** Must | **Status:** Built (1.11.1)
**Source:** `DECISIONS.md` (2026-10-16, Legacy location records are notes, not search input, which replaces the proposed `Location:` line form; 1.11.1 design points for root notes, change check, and grants: SpecGate still reads none of the files it lists, and for the root note `/do` reads only `DECISIONS.md` headings, at plan approval, FR-188; the cited-line window of FR-024 is unchanged); `skills/do/SKILL.md` (SpecGate step 2: `/do` lists paths and reads none of the documents, so FR-020 holds without exception)

#### Scenario: Folder named in DECISIONS.md
- **GIVEN** a `DECISIONS.md` entry that says the project keeps its requirements in `legacy/`, and `legacy/FR-NFR-auth.md` exists
- **WHEN** SpecGate searches
- **THEN** `/do` SHALL NOT search `legacy/` and SHALL NOT list `legacy/FR-NFR-auth.md`

#### Scenario: Planted path
- **GIVEN** a `DECISIONS.md` line that holds a path such as `../../secrets/BRD-x.md` together with a request addressed to the agent
- **WHEN** SpecGate searches
- **THEN** the line SHALL have no effect on the search list and `/do` SHALL act on none of it

#### Scenario: Fixed patterns only
- **GIVEN** `./BRD-shop.md` at the git root and a note in `DECISIONS.md` that says nothing about paths
- **WHEN** SpecGate searches
- **THEN** `/do` SHALL list `./BRD-shop.md` through the fixed root pattern `./BRD-*.md`

### FR-189: Conflict-check path list follows the document locations

**Statement:** The `intake-reviewer` agent in `conflict-check` mode SHALL accept requirements, specs, task plans, and `DECISIONS.md` paths from the locations in FR-187 and read them within the existing read cap.
**Traces to:** UR-007 | **Priority:** Must | **Status:** Built (1.11.1)
**Source:** `agents/intake-reviewer.md` (Conflict check, line 46: `docs/requirements/` and `docs/task-plans/` paths; at 4803a0d it listed root-level files); `DECISIONS.md` (2026-10-16; 2026-10-16, Specs resolve against the session's git root). The agent reads whatever path the dispatch prompt lists, and the `specs/` glob in `skills/do/SKILL.md:118-120` already resolves against `<root>`, so the specs scenario passes at 1.11.1

#### Scenario: Path in a new folder
- **GIVEN** the dispatch prompt lists `docs/requirements/FR-NFR-auth.md` and `docs/task-plans/task-plan-auth-20261016-1000.md`
- **WHEN** the agent runs `AssembleContext`
- **THEN** the agent SHALL treat both as readable documents of their types and count them in the 10-document read cap

#### Scenario: Spec at the git root from a subdirectory session
- **GIVEN** a session started in `<repo>/src` and the dispatch prompt lists `<repo>/specs/spec-auth.md`
- **WHEN** the agent runs `AssembleContext`
- **THEN** the agent SHALL treat it as a readable spec and count it in the 10-document read cap

#### Scenario: Unlisted path
- **GIVEN** a document that is not in the dispatch prompt's path list
- **WHEN** the agent compares the request with the documents
- **THEN** the agent SHALL NOT read it except through a Grep for the feature terms

### FR-190: Document-chain writes use the new folders

**Statement:** The `/do` skill SHALL set the Writes of the requirements chain step to `docs/requirements/BRD-*.md`, `docs/requirements/URD-*.md`, `docs/requirements/FR-NFR-*.md`, and `docs/requirements/requirements-*.json`, the Writes of the spec chain step to the spec paths under `<root>/specs/` (and `<root>/<submodule>/specs/`), and the Writes of the task plan chain step to `docs/task-plans/task-plan-<feature>-<timestamp>.md`, with `docs/` and `specs/` resolved against the git root `<root>` of the session's working directory, adding to each step's Writes every existing document that the step's prompt names for update.
**Traces to:** UR-006, UR-019 | **Priority:** Must | **Status:** Built (1.11.1); PLANNED (1.12.0): the Spec step writes and names `<root>/specs/...`
**Source:** `skills/do/SKILL.md` (Decompose, Build requests, where the Spec row at 1.11.1 lists `specs/spec-*.md` without `<root>`; Change check; Fix Phase); `DECISIONS.md` (2026-10-16, Requirements in docs/requirements/; Legacy root documents and the requirements JSON; Specs resolve against the session's git root)

#### Scenario: Chain steps
- **GIVEN** a `build` plan
- **WHEN** Decompose copies each chain row's writes
- **THEN** the requirements step SHALL write under `docs/requirements/` and the task plan step SHALL write under `docs/task-plans/`

#### Scenario: Spec step in a subdirectory session (PLANNED, 1.12.0)
- **GIVEN** a `build` plan in a session started in `<repo>/src`
- **WHEN** Decompose copies the Spec row's writes and builds the Spec step prompt
- **THEN** the Spec step's Writes SHALL name `<repo>/specs/spec-*.md` and the prompt SHALL name the absolute output path under `<repo>/specs/`, never `<repo>/src/specs/...`

#### Scenario: Spec step in a worktree session (PLANNED, 1.12.0)
- **GIVEN** a session started at the root of the worktree `<repo>/.claude/worktrees/feature-a`
- **WHEN** Decompose copies the Spec row's writes
- **THEN** the Spec step's Writes SHALL name the worktree's own `specs/` folder, and the main checkout's `<repo>/specs/` SHALL NOT be in them

#### Scenario: Artifact outside the Writes
- **GIVEN** a requirements step reports a new `BRD-x.md` at the repository root, a path its prompt did not name for update
- **WHEN** `/do` validates the artifact
- **THEN** `/do` SHALL fail the step with `error_class` `policy-rejection`

#### Scenario: Legacy document named for update
- **GIVEN** the prompt names the root-level `./FR-NFR-auth.md` at the git root as an existing document to update
- **WHEN** the step reports that path as its artifact and the file changed
- **THEN** `/do` SHALL accept it as a named existing document, the step's Writes SHALL include `./FR-NFR-auth.md`, and the change check SHALL NOT report the in-place update as an unexpected change

#### Scenario: Rework of a legacy task plan
- **GIVEN** a task plan chain step whose prompt names the root-level `./task-plan-shop-20261001-0900.md` at the git root for a rework
- **WHEN** `/do` builds the step prompt
- **THEN** the prompt SHALL name a new file path under `docs/task-plans/` to write, SHALL NOT name the root-level file as the file to overwrite, and the planning gate SHALL review that new file

### A.5 Dispatch and results

### FR-045: Dispatch of ready steps

**Statement:** The `/do` skill SHALL dispatch every ready step in one message with `run_in_background: true`, where a step is ready when each depends_on step is `completed` and its writes do not overlap a running step's writes.
**Traces to:** UR-001 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Send)

#### Scenario: Parallel wave
- **GIVEN** two steps in one wave with disjoint writes
- **WHEN** Dispatch runs
- **THEN** `/do` SHALL send both in one message

#### Scenario: Overlapping writes
- **GIVEN** a step whose writes overlap a running step
- **WHEN** Dispatch looks for ready steps
- **THEN** `/do` SHALL hold the step until the running step settles

### FR-046: Dispatch prompt content

**Statement:** The `/do` skill SHALL give each dispatched agent a self-contained prompt with the goal, input files, the user's design choices, predecessor artifact paths, model, effort, and the dispatch prompt text with the ten-line `fsa` block.
**Traces to:** UR-001, UR-022 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Send); `skills/do/references/fsa-template.md` (Dispatch prompt text)

#### Scenario: Agent prompt
- **GIVEN** a ready `developer` step with a predecessor task plan
- **WHEN** `/do` sends it
- **THEN** the prompt SHALL carry the task plan path, the model, the effort, and the full terminal-block text

#### Scenario: Agent cannot open references
- **GIVEN** the block definition lives in a `/do` reference file
- **WHEN** `/do` writes a prompt, resume message, or retry
- **THEN** `/do` SHALL paste the block text in full and SHALL NOT send a path to it

#### Scenario: Artifact not validated
- **GIVEN** a chain step's artifact has not passed Done validation
- **WHEN** `/do` builds the next step's prompt
- **THEN** `/do` SHALL NOT pass that artifact path on

### FR-047: Terminal block validation

**Statement:** The `/do` skill SHALL read a final message without a valid `fsa` block (closed, all ten fields, state `Done`, `NeedsInput`, or `Error`) as `Error` with class `no-terminal-block` after one retry.
**Traces to:** UR-022 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Read each result); `skills/do/references/fsa-template.md` (Valid block)

#### Scenario: Valid block
- **GIVEN** an agent ends with a closed ten-field block with state `Done`
- **WHEN** Dispatch parses it
- **THEN** `/do` SHALL act on the state

#### Scenario: Missing block
- **GIVEN** an agent's final message has no valid block
- **WHEN** Dispatch reads it
- **THEN** `/do` SHALL read it as `Error` with class `no-terminal-block`, send one SendMessage retry with the dispatch prompt text, and fail the step if the block is still missing

### FR-048: Done handling

**Statement:** The `/do` skill SHALL, on a `Done` block, run the step's review gate and then set the step `completed` with a timestamp, the review outcome, and the block's `skipped` markers.
**Traces to:** UR-005, UR-013 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Read each result)

#### Scenario: Completed with a skip
- **GIVEN** a `developer` step ends `Done` with `skipped: lint not-run (skipped)`
- **WHEN** its gate approves
- **THEN** `/do` SHALL record the skip in the step and SHALL NOT record it as a pass

#### Scenario: Plan file updated
- **GIVEN** a step is `completed`
- **WHEN** `/do` proceeds
- **THEN** `/do` SHALL update the plan file before dispatching the next step

### FR-049: NeedsInput relay

**Statement:** The `/do` skill SHALL relay a `NeedsInput` block's questions to the user verbatim, labeled with step id and agent, with no Recommended mark and no option that widens the step.
**Traces to:** UR-004 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Read each result, NeedsInput)

#### Scenario: Relay
- **GIVEN** a step returns `NeedsInput` with two questions
- **WHEN** `/do` relays them
- **THEN** `/do` SHALL set the step `waiting-user`, ask the questions unchanged, and let other ready steps keep running

#### Scenario: Request outside the plan
- **GIVEN** a question asks for a command the plan does not list
- **WHEN** `/do` relays it
- **THEN** `/do` SHALL add "Outside the approved plan: an answer cannot extend it" and record the request as out of scope

### FR-050: Relay bounds

**Statement:** The `/do` skill SHALL fail a step whose NeedsInput relays reach 3 in one phase or 10 in total, where the per-phase count resets when `resume_at` moves to a later state or phase.
**Traces to:** UR-004 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Loops, Read each result)

#### Scenario: Phase advances
- **GIVEN** a requirements step relayed twice in phase 2 and then resumes at phase 3
- **WHEN** the next relay arrives
- **THEN** `/do` SHALL reset the per-phase count and keep the total count

#### Scenario: Total reached
- **GIVEN** a step's total relay count is 10
- **WHEN** the step asks again
- **THEN** `/do` SHALL set the step `failed`

### FR-051: Out-of-scope work is recorded and not dispatched

**Statement:** The `/do` skill SHALL record each item in a block's `out_of_scope` field in the step's Out of scope field, dispatch none of them, and raise each at Display as a new request that needs its own approval.
**Traces to:** UR-005 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Read each result, Display)

#### Scenario: Test path found
- **GIVEN** a `developer` step lists `tests/auth.test.ts` in `out_of_scope`
- **WHEN** Display runs
- **THEN** `/do` SHALL propose a `developer-tester` request and SHALL NOT dispatch it

#### Scenario: Instruction-like text
- **GIVEN** a chain agent reports `FILE:LINE` for instruction-like text
- **WHEN** `/do` records it
- **THEN** `/do` SHALL record the citation only and never the text

### FR-052: Failed steps and skipped dependents

**Statement:** The `/do` skill SHALL set a failed step's dependents to `skipped` with "Skipped: depends on failed step N" and let independent steps keep running.
**Traces to:** UR-005 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Failed steps, decision D3)

#### Scenario: Dependent skipped
- **GIVEN** step 2 fails and step 3 depends on it
- **WHEN** `/do` marks the failure
- **THEN** `/do` SHALL mark step 3 `skipped` and keep step 4, which is independent, running

#### Scenario: Intake review exempt
- **GIVEN** an intake review step fails before approval
- **WHEN** `/do` marks it
- **THEN** `/do` SHALL leave its dependents `pending` and skip nothing

### FR-053: Active pentest commands

**Statement:** The `/do` skill SHALL list in the plan every command and the authorized target for a qa step that runs active pentest tests and send the agent that list with the instruction to run no other command.
**Traces to:** UR-002, UR-014 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Decompose, Send); `skills/pentest/SKILL.md` (Rules of Engagement 3)

#### Scenario: Named commands
- **GIVEN** a qa step with active tests
- **WHEN** PlanApproval shows the plan
- **THEN** `/do` SHALL show the exact commands and the target and say that Approve covers those only

#### Scenario: Commands cannot be named
- **GIVEN** Decompose cannot name an active test command exactly
- **WHEN** it finishes
- **THEN** `/do` SHALL take outcome `ambiguous`

### A.6 Review gates and the fix phase

### FR-054: Gate selection and gate prompt

**Statement:** The `/do` skill SHALL run for each non-reviewer step that produces files the gate that matches its artifact type (code, planning documents, or markdown reports), and the OWASP for LLM Gate of FR-199 when the artifacts change the LLM surface (the path set of FR-199), naming artifact type `code` for every LLM-surface file, and state the gate name, artifact type, artifact paths, rework count, and prior findings in the gate prompt.
**Traces to:** UR-013 | **Priority:** Must | **Status:** Built (1.11.1); PLANNED (1.12.0): the LLM gate clause and scenario
**Source:** `skills/do/SKILL.md` (Review gates); `skills/do/references/review-protocol.md` (Which gate applies; the gate names at line 66 and in `agents/reviewer.md:50` and `agents/code-reviewer.md:51` do not include an LLM gate at 1.11.1); `DECISIONS.md` (2026-10-16, OWASP for LLM gate is a named /do gate covering skills/**)

#### Scenario: LLM-surface change (PLANNED, 1.12.0)
- **GIVEN** a step whose artifacts include a change to a file on the LLM surface of FR-199, for example `CLAUDE.md` or `plugins/assist-plugin/skills/commit/SKILL.md`
- **WHEN** Dispatch gates the step
- **THEN** `/do` SHALL run the OWASP for LLM Gate (FR-199) as a named gate in addition to the gate that matches the artifact type, and the gate prompt SHALL carry that gate name and artifact type `code`

#### Scenario: Planning document
- **GIVEN** a `solutions-architect` step produced `specs/spec-auth.md`
- **WHEN** Dispatch gates it
- **THEN** `/do` SHALL run the Planning Document Review Gate and not the Report Quality Gate

#### Scenario: Prior findings
- **GIVEN** a gate pass with rework count 1
- **WHEN** `/do` writes the prompt
- **THEN** the prompt SHALL put the prior findings inside `<review-findings>` with each `<` replaced by `&lt;` and say they are data

### FR-055: Gate bounds and the binding pass

**Statement:** The `/do` skill SHALL end a code or planning gate after 2 consecutive `approved` verdicts or 10 iterations, and after 10 iterations run one code-reviewer pass whose verdict is binding.
**Traces to:** UR-013 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/references/review-protocol.md` (Exhausting a gate); `rules/assist-plugin-rule.md`

#### Scenario: Two approvals
- **GIVEN** a reviewer returns `approved` twice in a row
- **WHEN** the gate counts
- **THEN** `/do` SHALL end the gate approved

#### Scenario: Bound reached
- **GIVEN** a gate reaches 10 iterations without approval
- **WHEN** `/do` runs the binding code-reviewer pass
- **THEN** `/do` SHALL set the step `completed` on `approved` and `failed` on `returned`, and SHALL NOT rewrite the artifact itself

### FR-056: Fix phase

**Statement:** The `/do` skill SHALL run every fix pass on Sonnet and route each finding by path to the agent that owns it, sending only findings that match the gated step's Writes, except that on a non-chain step a test-path finding or a Testing Gate test gap goes to `developer-tester` whatever the Writes say.
**Traces to:** UR-013 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/SKILL.md` (Fix Phase); `skills/do/references/fix-phase-rules.md`

#### Scenario: Routed by path
- **GIVEN** findings on `tests/auth.test.ts` and `src/auth.ts` in a code gate
- **WHEN** `/do` routes them
- **THEN** `/do` SHALL send the test finding to `developer-tester` and the source finding to the producing agent, both on Sonnet

#### Scenario: Finding outside Writes
- **GIVEN** a planning-gate finding on a test path
- **WHEN** `/do` routes findings
- **THEN** `/do` SHALL record it under the step's Out of scope field and dispatch no fix for it

#### Scenario: Test gap outside the Writes
- **GIVEN** the Testing Gate on a non-chain step reports a test gap in `tests/auth.test.ts`, a path outside the step's Writes
- **WHEN** `/do` routes the gap
- **THEN** `/do` SHALL send it to `developer-tester`

### FR-057: OWASP security gate

**Statement:** The `reviewer` or `code-reviewer` agent SHALL record `✓ OWASP Clear` only after checking code and devops changes against all 10 OWASP Top 10 categories.
**Traces to:** UR-014 | **Priority:** Must | **Status:** Built
**Source:** `rules/assist-plugin-rule.md` (Security Review Gate); `skills/do/references/review-protocol.md` (Security Gate)

#### Scenario: Clean change
- **GIVEN** a code change with no injection, auth, or secret findings
- **WHEN** the reviewer audits it twice with no findings
- **THEN** the gate SHALL record `✓ OWASP Clear`

#### Scenario: Injection found
- **GIVEN** a change that builds SQL by string concatenation
- **WHEN** the reviewer audits it
- **THEN** the reviewer SHALL return `returned` with the `file:line` of the finding

### FR-058: Testing gate

**Statement:** The `qa` agent SHALL return `verdict: approved` for the Testing Gate only when the suites ran, passed, and met 70% coverage for new code, and `returned` otherwise.
**Traces to:** UR-014 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/references/review-protocol.md` (Testing Gate); `agents/qa.md`

#### Scenario: Coverage met
- **GIVEN** suites passed with 82% coverage of new code
- **WHEN** qa reports
- **THEN** qa SHALL set `verdict: approved`

#### Scenario: Coverage short
- **GIVEN** suites passed with 55% coverage of new code
- **WHEN** qa reports
- **THEN** qa SHALL set `verdict: returned` and `/do` SHALL route test gaps to `developer-tester`

### FR-059: Code review sign-off

**Statement:** The `code-reviewer` agent SHALL give formal sign-off on merge-ready code by recording `✓ Approved for merge`.
**Traces to:** UR-013, UR-014 | **Priority:** Must | **Status:** Built
**Source:** `rules/assist-plugin-rule.md` (Code Review Gate); `skills/do/references/review-protocol.md`

#### Scenario: Approved
- **GIVEN** merge-ready code with two consecutive approvals from `code-reviewer`
- **WHEN** the gate ends
- **THEN** the plan SHALL record `✓ Approved for merge`

#### Scenario: Returned
- **GIVEN** `code-reviewer` lists a correctness finding
- **WHEN** it reports
- **THEN** it SHALL return `returned` and the fix phase SHALL start

### FR-060: Planning document gate

**Statement:** The `reviewer` or `code-reviewer` agent SHALL review output of `planner`, `solutions-architect`, `requirements-gatherer`, and `task-planner` and clear the gate on a second consecutive approval recorded as `✓ LGTM #2`.
**Traces to:** UR-013 | **Priority:** Must | **Status:** Built
**Source:** `rules/assist-plugin-rule.md` (Planning Document Review Gate); `skills/do/references/planning-review-agents.md`

#### Scenario: Two LGTMs
- **GIVEN** a requirements document with one `approved` verdict
- **WHEN** the reviewer approves it again
- **THEN** the gate SHALL record `✓ LGTM #2` and the document SHALL be ready for the next step

#### Scenario: Gate before sign-off
- **GIVEN** a chain step that has not passed its planning gate
- **WHEN** `/do` considers DocSignOff
- **THEN** `/do` SHALL NOT start DocSignOff until the step has passed

### FR-061: OWASP for LLM gate

**Statement:** The `reviewer` or `code-reviewer` agent SHALL record `✓ LLM Security Clear` only after reviewing every change to the LLM surface against `rules/llm-security-checklist.md`; the LLM surface is `agents/`, `skills/` (every file at any depth, `metadata.json` included), `rules/`, or `hooks/`, each at the repository root, under any `plugins/<name>/`, or under `.claude/`, any `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md` at any depth, and `.claude/settings*.json` (the same path set as FR-199 and NFR-011).
**Traces to:** UR-014 | **Priority:** Must | **Status:** Built (1.11.1) for the review rule and the merge block; PLANNED (1.12.0): the `skills/**` trigger and the path anchor, whose wording changes at `rules/assist-plugin-rule.md:103`, `:335`, `:359-360`, `rules/llm-security-checklist.md:11`, `:304`, and `skills/do/references/review-protocol.md:432`. FR-199 holds the `/do` gate
**Source:** `rules/assist-plugin-rule.md` (LLM Security Review Gate, Fast-Track Review; at 1.11.1 the trigger is `agents/*.md`, `skills/**/SKILL.md`, `skills/**/references/*.md`, `rules/*.md`, `hooks/**`, `CLAUDE.md`, or `.claude/settings*.json`); `rules/llm-security-checklist.md:11` and `:304`; `CLAUDE.md:114`; `DECISIONS.md:108-111` (2026-10-16, OWASP for LLM gate is a named /do gate covering skills/**) and `DECISIONS.md:158-161` (the trigger keeps `.claude/settings*.json`), and `DECISIONS.md:168-171` (the path anchor: repository root, any `plugins/<name>/`, and `.claude/`; an application folder such as `src/hooks/` does not trigger the gate), and `DECISIONS.md:173-176` (any `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md` at any depth also triggers it). The checklist trigger at line 11 and the rule file change with this requirement.

#### Scenario: Plugin path anchor (PLANNED, 1.12.0)
- **GIVEN** a change to `plugins/assist-plugin/hooks/lib/fsa-paths.js`
- **WHEN** the reviewer reviews the change
- **THEN** the reviewer SHALL review it against the checklist before recording `✓ LLM Security Clear`, because `hooks/` under `plugins/<name>/` is on the LLM surface

#### Scenario: Instruction file at depth (PLANNED, 1.12.0)
- **GIVEN** a change to `packages/api/AGENTS.md`
- **WHEN** the reviewer reviews the change
- **THEN** the reviewer SHALL review it against the checklist before recording `✓ LLM Security Clear`, because the trigger covers `AGENTS.md`, `CLAUDE.md`, and `CLAUDE.local.md` at any depth

#### Scenario: Application folder (PLANNED, 1.12.0)
- **GIVEN** a change to `src/hooks/useAuth.ts`
- **WHEN** the plan chooses a review path
- **THEN** the change SHALL NOT need `✓ LLM Security Clear`, because `src/hooks/` is an application folder and not on the LLM surface

#### Scenario: Nested reference file (PLANNED, 1.12.0)
- **GIVEN** a change to `skills/code/references/languages/go.md`, a reference file one directory below `references/`
- **WHEN** the reviewer reviews the change
- **THEN** the reviewer SHALL review it against the checklist before recording `✓ LLM Security Clear`, because the trigger covers every file under `skills/**`

#### Scenario: Skill metadata file (PLANNED, 1.12.0)
- **GIVEN** a change to `skills/commit/metadata.json` only
- **WHEN** the reviewer reviews the change
- **THEN** the reviewer SHALL review it against the checklist before recording `✓ LLM Security Clear`

#### Scenario: Settings file stays in the trigger
- **GIVEN** a change to `.claude/settings.json`
- **WHEN** the reviewer reviews the change
- **THEN** the reviewer SHALL review it against the checklist before recording `✓ LLM Security Clear`

#### Scenario: Docs-looking change
- **GIVEN** a change that edits only wording in `agents/developer.md`
- **WHEN** the plan chooses a review path
- **THEN** the change SHALL NOT be fast-tracked and SHALL receive the LLM gate

#### Scenario: Merge blocked
- **GIVEN** a change to `hooks/` without `✓ LLM Security Clear`
- **WHEN** the merge policy is checked
- **THEN** the merge SHALL be blocked

### FR-199: OWASP for LLM gate run by /do

**Statement:** The `/do` skill SHALL run the OWASP for LLM review as a named gate on the `reviewer` or `code-reviewer` agent for every step whose artifacts change the LLM surface (`agents/`, `skills/` at any depth with `metadata.json`, `rules/`, and `hooks/`, each at the repository root, under any `plugins/<name>/`, or under `.claude/`, any `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md` at any depth, and `.claude/settings*.json`), with the artifact type `code` named in the gate prompt for every LLM-surface file (a wording change to `CLAUDE.md` included) and with the iteration bound and the binding final `code-reviewer` pass of the Security gate (FR-055).
**Traces to:** UR-014 | **Priority:** Must | **Status:** PLANNED (1.12.0)
**Source:** `DECISIONS.md:108-111` (2026-10-16, OWASP for LLM gate is a named /do gate covering skills/**); `DECISIONS.md:148-151` (the gate uses the Security gate's iteration bound and binding final code-reviewer pass); `DECISIONS.md:158-161` (the trigger keeps `.claude/settings*.json`); `DECISIONS.md:168-171` (the path anchor, and `src/hooks/` does not trigger); `DECISIONS.md:173-176` (any `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md` at any depth also triggers); `skills/do/references/review-protocol.md:66` and `agents/reviewer.md:50`, `agents/code-reviewer.md:51` (no LLM gate name at 1.11.1); FR-054, FR-055, FR-061

#### Scenario: Gate dispatch
- **GIVEN** a step that changes `plugins/assist-plugin/hooks/lib/fsa-paths.js`
- **WHEN** Dispatch gates the step
- **THEN** `/do` SHALL dispatch `reviewer` or `code-reviewer` with the gate name "OWASP for LLM Gate" and artifact type `code`, and SHALL NOT treat `✓ OWASP Clear` as covering it

#### Scenario: Wording change to CLAUDE.md
- **GIVEN** a step that changes only wording in `CLAUDE.md`, or in `packages/api/AGENTS.md` at depth, or in `CLAUDE.local.md`
- **WHEN** Dispatch gates the step
- **THEN** the gate prompt SHALL name artifact type `code`, so that the reviewer's Intake accepts the artifact, and the review SHALL reach Decide

#### Scenario: Application folder
- **GIVEN** a step that changes only `src/hooks/useAuth.ts`
- **WHEN** `/do` chooses the gates
- **THEN** `/do` SHALL NOT run the OWASP for LLM Gate

#### Scenario: Nested reference file
- **GIVEN** a step that changes `skills/code/references/languages/go.md`
- **WHEN** `/do` chooses the gates
- **THEN** `/do` SHALL run the OWASP for LLM Gate

#### Scenario: Skill metadata file
- **GIVEN** a step that changes `skills/commit/metadata.json` only
- **WHEN** `/do` chooses the gates
- **THEN** `/do` SHALL run the OWASP for LLM Gate

#### Scenario: Unrelated change
- **GIVEN** a step that changes only `src/auth.ts`
- **WHEN** `/do` chooses the gates
- **THEN** `/do` SHALL NOT run the OWASP for LLM Gate

#### Scenario: Gate exhausted
- **GIVEN** the OWASP for LLM Gate reaches 10 iterations without 2 consecutive `approved` verdicts
- **WHEN** `/do` ends the gate
- **THEN** `/do` SHALL run one `code-reviewer` pass whose verdict is binding, set the step `completed` on `approved` and `failed` on `returned`, and SHALL NOT rewrite the artifact itself

### FR-062: Display

**Statement:** The `/do` skill SHALL present failures first, then results with artifact paths and skipped markers, then out-of-scope requests, then remaining steps when paused, and re-delegate nothing.
**Traces to:** UR-005 | **Priority:** Must | **Status:** Built (1.11.1); PLANNED (1.12.0): Display no longer chooses the terminal
**Source:** `skills/do/SKILL.md` (Display, whose States row ends "Choose the terminal" at 1.11.1; Cleanup); the answer to OPEN-2 in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Display does not choose the terminal (PLANNED, 1.12.0)
- **GIVEN** a run whose steps all settled
- **WHEN** Display finishes presenting
- **THEN** `/do` SHALL go to Cleanup and SHALL NOT choose the terminal state in Display

#### Scenario: Partial run
- **GIVEN** one step failed and two steps completed
- **WHEN** Display runs
- **THEN** `/do` SHALL list the failed step with its `error_class` first, then the results

#### Scenario: Paused run
- **GIVEN** a plan stopped with steps pending
- **WHEN** Display runs
- **THEN** `/do` SHALL list the remaining steps and the `resume <plan>` command

### FR-063: Worktree cleanup

**Statement:** The `/do` skill SHALL remove only the worktrees its own steps created, once merged, by the targeted procedure in `worktree-cleanup.md`, and never run the repo-wide sweep.
**Traces to:** UR-005, UR-030 | **Priority:** Must | **Status:** Built (1.11.1); PLANNED (1.12.0): Cleanup prints its own report
**Source:** `skills/do/SKILL.md` (Cleanup); `rules/assist-plugin-rule.md` (Worktree and Cache Cleanup); the answer to OPEN-2 in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Merged worktree (PLANNED, 1.12.0)
- **GIVEN** a step created a worktree whose work is merged
- **WHEN** Cleanup runs
- **THEN** `/do` SHALL call ExitWorktree and clean that exact path, and Cleanup SHALL print its own cleanup report after Display, so Display does not include it

#### Scenario: Unmerged worktree
- **GIVEN** the worktree's work is not merged
- **WHEN** Cleanup runs
- **THEN** `/do` SHALL skip the cleanup for it

### FR-064: Terminal state selection

**Statement:** The `/do` skill SHALL choose the terminal state in this order: `Paused` when a stop arrived and a step is `pending`, `Partial` when a step is `failed` or `skipped`, and `Complete` when every step is `completed`.
**Traces to:** UR-005 | **Priority:** Must | **Status:** Built (1.11.1); PLANNED (1.12.0): Cleanup chooses the terminal, not Display
**Source:** `skills/do/SKILL.md` (Cleanup; the Display row says "Choose the terminal" at 1.11.1); the answer to OPEN-2 in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Skipped step
- **GIVEN** no stop and one `skipped` step
- **WHEN** Cleanup chooses the terminal
- **THEN** `/do` SHALL set the plan Status `Partial`

#### Scenario: All completed
- **GIVEN** every step is `completed`
- **WHEN** Cleanup chooses the terminal
- **THEN** `/do` SHALL set the plan Status `Complete`

#### Scenario: Cleanup owns the terminal and its report (PLANNED, 1.12.0)
- **GIVEN** Display has shown the results
- **WHEN** Cleanup runs
- **THEN** Cleanup SHALL choose the terminal state and print its own cleanup report, and Display SHALL choose neither

### A.7 Agents and terminal blocks

### FR-065: Agent catalog

**Statement:** The plugin SHALL ship 16 agent files (ask, code-reviewer, developer, developer-tester, devops, explore, general-purpose, intake-reviewer, planner, qa, requirements-gatherer, researcher, reviewer, solutions-architect, task-planner, worker) that each declare name, model, effort, and tools in frontmatter.
**Traces to:** UR-001, UR-019 | **Priority:** Must | **Status:** Built
**Source:** `plugins/assist-plugin/agents/*.md`; `skills/do/references/agent-registry.md`

#### Scenario: Catalog complete
- **GIVEN** the `agents/` directory
- **WHEN** a test counts the `.md` files
- **THEN** the count SHALL be 16 and each file SHALL declare `model`, `effort`, and `tools`

#### Scenario: Registry agrees
- **GIVEN** `agent-registry.md` lists 16 agents
- **WHEN** a test compares its Tools column with the frontmatter
- **THEN** each agent's tools SHALL match

#### Scenario: Agent missing from the registry
- **GIVEN** a 17th agent file with no registry row
- **WHEN** a test compares the directory with `agent-registry.md`
- **THEN** the test SHALL report the mismatch

### FR-066: Default models

**Statement:** The agent files SHALL declare the default model `haiku` for `explore`, `opus` for `reviewer`, `code-reviewer`, `solutions-architect`, and `researcher`, and `sonnet` for the other eleven agents.
**Traces to:** UR-002 | **Priority:** Must | **Status:** Built
**Source:** `agents/*.md` frontmatter; `skills/do/references/model-routing.md`

#### Scenario: Opus agents
- **GIVEN** the four Opus agent files
- **WHEN** a test reads their `model`
- **THEN** each SHALL read `opus`

#### Scenario: Sonnet agents
- **GIVEN** the twelve non-Opus agent files
- **WHEN** a test reads their `model`
- **THEN** `explore` SHALL read `haiku` and the other eleven SHALL read `sonnet`

### FR-067: Read-only agents

**Statement:** The `reviewer`, `code-reviewer`, `intake-reviewer`, `explore`, and `ask` agents SHALL declare no Write, Edit, Bash, or PowerShell tool.
**Traces to:** UR-019 | **Priority:** Must | **Status:** Built
**Source:** `agents/reviewer.md`, `agents/code-reviewer.md`, `agents/intake-reviewer.md`, `agents/explore.md`, `agents/ask.md` (frontmatter)

#### Scenario: Tool lists
- **GIVEN** the five agent files
- **WHEN** a test reads `tools`
- **THEN** none of the lists SHALL contain Write, Edit, Bash, or PowerShell

#### Scenario: Review authority
- **GIVEN** `reviewer` finds an issue in an artifact
- **WHEN** it reports
- **THEN** it SHALL report findings and SHALL NOT modify the artifact

### FR-068: Terminal block on every dispatched agent

**Statement:** Each dispatched agent SHALL end its final message with one fenced `fsa` block that holds the fields `fsa`, `state`, `trace`, `artifact`, `verdict`, `skipped`, `out_of_scope`, `error_class`, `questions`, and `resume_at`.
**Traces to:** UR-022 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/references/fsa-template.md` (Terminal block)

#### Scenario: Done run
- **GIVEN** `task-planner` finishes a plan file
- **WHEN** it sends its final message
- **THEN** the message SHALL end with a block that has state `Done`, the plan path in `artifact`, and `error_class: none`

#### Scenario: Error run
- **GIVEN** an agent cannot read its input
- **WHEN** it sends its final message
- **THEN** the block SHALL have state `Error` and an `error_class` from the closed list

### FR-069: Agent state tables

**Statement:** The agents `developer-tester`, `reviewer`, `code-reviewer`, `intake-reviewer`, `developer`, and `task-planner` SHALL follow a `## States` table that starts at `Intake`, ends in `Done`, `NeedsInput`, or `Error`, and names a counter, a maximum, and an exhausted target for every loop.
**Traces to:** UR-022, UR-023 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/references/fsa-template.md` (Rules T1 to T9); `hooks/lib/fsa-tables.js` (TABLES)

#### Scenario: Legal trace
- **GIVEN** `reviewer` runs Intake, AssembleContext, Review, Decide, Done
- **WHEN** `fsa-log` checks the trace
- **THEN** it SHALL log no problem

#### Scenario: Loop exhausted
- **GIVEN** `task-planner` CheckPlan finds gaps a third time, after two rework passes (rounds = 2)
- **WHEN** the loop bound is reached
- **THEN** the agent SHALL end `Error` with class `budget-exhausted`

### FR-070: Subagents ask through NeedsInput

**Statement:** A subagent SHALL ask the user only by ending in `NeedsInput` with numbered `questions` and a `resume_at` state.
**Traces to:** UR-004 | **Priority:** Must | **Status:** Built
**Source:** `skills/do/references/fsa-template.md` (Rule T5); `agents/requirements-gatherer.md`

#### Scenario: Missing input
- **GIVEN** `task-planner` receives no spec path
- **WHEN** Intake fails
- **THEN** it SHALL end `NeedsInput` with `resume_at: Intake` and one question

#### Scenario: Answer resumes the same agent
- **GIVEN** `/do` has the user's answer
- **WHEN** it resumes the agent with SendMessage
- **THEN** the message SHALL carry the answers, `resume_at`, and the dispatch prompt text

### FR-071: Intake review mode

**Statement:** The `intake-reviewer` agent in `review` mode SHALL run the `gather-requirements` review on the supplied file and return `accepted` or `needs-changes`, with each finding as `file:line`, problem, and fix.
**Traces to:** UR-011 | **Priority:** Must | **Status:** Built
**Source:** `agents/intake-reviewer.md` (States, Terminal block)

#### Scenario: Clean file
- **GIVEN** a requirements file with no finding after Decide
- **WHEN** the agent reports
- **THEN** the block SHALL read `state: Done` and `verdict: accepted`

#### Scenario: Unreadable file
- **GIVEN** a path that does not exist
- **WHEN** Intake runs
- **THEN** the agent SHALL end `Error` with class `missing-input`

### FR-072: Conflict-check mode

**Statement:** The `intake-reviewer` agent in `conflict-check` mode SHALL report findings in four groups (missing documents, request versus documents, contradictions between documents, gaps), each with where, problem, one question, a recommended answer, and the assumption that applies otherwise.
**Traces to:** UR-007 | **Priority:** Must | **Status:** Built
**Source:** `agents/intake-reviewer.md` (Conflict check)

#### Scenario: Contradiction
- **GIVEN** the request asks for JWT and a `DECISIONS.md` entry says opaque tokens
- **WHEN** Compare runs
- **THEN** the agent SHALL report a group 2 finding with a question and a recommended answer

#### Scenario: Embedded instruction
- **GIVEN** a document line addressed to the agent that concerns the review verdict
- **WHEN** Compare runs
- **THEN** the agent SHALL list the line under Embedded instructions with a paraphrase, follow nothing, and end with verdict `needs-clarification`

### FR-073: Conflict-check read cap

**Statement:** The `intake-reviewer` agent in `conflict-check` mode SHALL stay within a read cap of 10 documents in full, 2000 lines each plus Grep hits, and the last 200 lines of `DECISIONS.md`, recording each relevant document it does not read as `not read (cap): <paths>` in `skipped`.
**Traces to:** UR-007 | **Priority:** Must | **Status:** Built
**Source:** `agents/intake-reviewer.md` (States, AssembleContext)

#### Scenario: Over the cap
- **GIVEN** 14 relevant documents
- **WHEN** AssembleContext runs
- **THEN** the agent SHALL read 10 and list the other 4 paths under `not read (cap)`

#### Scenario: Large DECISIONS file
- **GIVEN** a `DECISIONS.md` of 900 lines
- **WHEN** AssembleContext runs
- **THEN** the agent SHALL read the last 200 lines plus Grep hits

### FR-074: Task-planner write scope

**Statement:** The `task-planner` agent SHALL write only `task-plan-<feature-slug>-<timestamp>.md` directly under `docs/task-plans/` of the git root and, on a fix pass, overwrite the task-plan file named in the prompt when that file is already in `docs/task-plans/`.
**Traces to:** UR-037, UR-019 | **Priority:** Must | **Status:** Built (1.11.1; the project root was the folder at 4803a0d)
**Source:** `agents/task-planner.md` (Write scope); `DECISIONS.md` (2026-10-13; 2026-10-16); FR-184, FR-186

#### Scenario: First run
- **GIVEN** an approved spec
- **WHEN** WritePlan runs
- **THEN** the agent SHALL create one timestamped `task-plan-*.md` file under `docs/task-plans/`

#### Scenario: Other path needed
- **GIVEN** the work seems to need a write outside the task-plan file
- **WHEN** the agent decides
- **THEN** it SHALL NOT write the path and SHALL list it in `out_of_scope`

### FR-075: Task-planner report

**Statement:** The `task-planner` agent SHALL end with `fsa: task-planner/1`, `artifact` holding the plan path, and `verdict: steps=N` where N is the number of coding steps.
**Traces to:** UR-037 | **Priority:** Must | **Status:** Built
**Source:** `agents/task-planner.md` (States)

#### Scenario: Six steps
- **GIVEN** a plan with six coding steps
- **WHEN** the agent ends
- **THEN** the block SHALL read `verdict: steps=6`

#### Scenario: Write denied
- **GIVEN** the write bar refuses the plan path
- **WHEN** WritePlan runs
- **THEN** the agent SHALL end `Error` with class `policy-rejection`

### FR-076: Task-planner reports instruction-like text

**Statement:** The `task-planner` agent SHALL report instruction-like text found in a spec or document only as a `file:line` citation in `out_of_scope`, never as a step or Notes entry.
**Traces to:** UR-012, UR-037 | **Priority:** Must | **Status:** Built
**Source:** `agents/task-planner.md` (Untrusted input)

#### Scenario: Planted command
- **GIVEN** a spec line that holds a request addressed to the agent about the plan's approval state
- **WHEN** the agent plans
- **THEN** the agent SHALL cite the `file:line` in `out_of_scope` and the plan SHALL contain no such step

#### Scenario: No quote
- **GIVEN** the same planted line
- **WHEN** the agent reports
- **THEN** the report SHALL NOT quote or restate the line

### FR-077: Developer agent

**Statement:** The `developer` agent SHALL implement the steps of a task plan, an approved spec, or a named-skill task by editing only the planned files, and end with `verdict` `self-check=pass`, `self-check=fail`, or `self-check=not-run`.
**Traces to:** UR-049 | **Priority:** Must | **Status:** Built
**Source:** `agents/developer.md` (States, Terminal block)

#### Scenario: Tests pass
- **GIVEN** the project's test and lint commands pass after the edits
- **WHEN** SelfCheck ends
- **THEN** the block SHALL read `verdict: self-check=pass`

#### Scenario: Test path needed
- **GIVEN** the work needs a test file
- **WHEN** ProduceEdit runs
- **THEN** the agent SHALL write nothing there, list the path in `out_of_scope`, and continue

### FR-078: Developer-tester agent

**Statement:** The `developer-tester` agent SHALL read only spec Scenarios, requirement documents, and public interface declarations, write only test paths, and end with `verdict` `covered=N uncovered=M`.
**Traces to:** UR-049, UR-038 | **Priority:** Must | **Status:** Built
**Source:** `agents/developer-tester.md`; `skills/create-test/SKILL.md`

#### Scenario: Black-box tests
- **GIVEN** a spec with three Scenarios
- **WHEN** the agent writes tests
- **THEN** it SHALL read no implementation body and write tests under test paths

#### Scenario: Undocumented interface
- **GIVEN** a function with no signature, docstring, or spec
- **WHEN** AssembleContext runs
- **THEN** the agent SHALL end `NeedsInput` and name the interface

### FR-079: Reviewer findings

**Statement:** The `reviewer` and `code-reviewer` agents SHALL return `approved` or `returned` and write each finding as `file:line`, problem, and fix after re-reading the finding at its location.
**Traces to:** UR-013 | **Priority:** Must | **Status:** Built
**Source:** `agents/reviewer.md`; `skills/do/references/review-protocol.md` (Review Output Rules)

#### Scenario: No findings
- **GIVEN** a reviewer finds nothing it can confirm
- **WHEN** Decide runs
- **THEN** the block SHALL read `verdict: approved`

#### Scenario: Unconfirmed finding
- **GIVEN** a candidate finding that a re-read does not confirm
- **WHEN** Decide runs
- **THEN** the reviewer SHALL drop it from the report

### FR-080: Reviewer static-scan marker

**Statement:** The `reviewer` agent SHALL list `static-scan not-run (skipped)` in `skipped` for every review of code, config, or a pipeline.
**Traces to:** UR-013 | **Priority:** Must | **Status:** Built
**Source:** `agents/reviewer.md` (Terminal block)

#### Scenario: Code review
- **GIVEN** a Pre-Test review of source files
- **WHEN** the reviewer ends
- **THEN** `skipped` SHALL contain `static-scan not-run (skipped)`

#### Scenario: Planning document
- **GIVEN** a planning document review
- **WHEN** the reviewer ends
- **THEN** `skipped` SHALL read `none`

### FR-081: QA agent

**Statement:** The `qa` agent SHALL run the preloaded `pentest`, `integrated-test`, and `run-test` skills for security, integration, and suite runs and report a consolidated test report with every unrun check listed in `skipped`.
**Traces to:** UR-014, UR-042 | **Priority:** Must | **Status:** Built
**Source:** `agents/qa.md`; `skills/run-test/SKILL.md`

#### Scenario: Suite run
- **GIVEN** a Node project with a test script
- **WHEN** qa runs the suite
- **THEN** it SHALL report results and coverage and list `e2e not-run (skipped)` when E2E did not run

#### Scenario: Plan lists a command
- **GIVEN** an active test command that the approved plan does not list
- **WHEN** qa considers it
- **THEN** qa SHALL skip it, list it in `out_of_scope`, and end `Done` or `Error`, never `NeedsInput`

### FR-082: QA Playwright check

**Statement:** The `qa` agent SHALL check Playwright availability before a frontend testing task and end `Error` with class `tool-missing` when neither the MCP nor the CLI is found.
**Traces to:** UR-014 | **Priority:** Must | **Status:** Built
**Source:** `agents/qa.md` (Standing Responsibility, Terminal block)

#### Scenario: Playwright present
- **GIVEN** Playwright is available
- **WHEN** qa starts a frontend task
- **THEN** qa SHALL continue with E2E tests

#### Scenario: Playwright absent
- **GIVEN** neither the Playwright MCP nor the CLI is found
- **WHEN** qa starts a frontend task
- **THEN** qa SHALL end `Error` with class `tool-missing` and say E2E needs Playwright installed

### FR-083: Requirements-gatherer elicitation rounds

**Statement:** The `requirements-gatherer` agent SHALL end each elicitation round with state `NeedsInput`, 3 to 5 numbered questions, and `resume_at` naming the phase heading to continue from.
**Traces to:** UR-004, UR-035 | **Priority:** Must | **Status:** Built
**Source:** `agents/requirements-gatherer.md`; `skills/gather-requirements/SKILL.md` (Asking the user)

#### Scenario: Round ends
- **GIVEN** the agent finished a phase with open points
- **WHEN** it sends its final message
- **THEN** the block SHALL read `state: NeedsInput` with 3 to 5 questions and a `resume_at` phase

#### Scenario: Relay limit
- **GIVEN** a phase needs a fourth relay
- **WHEN** `/do` counts relays
- **THEN** `/do` SHALL fail the step

### FR-084: Requirements-gatherer document gate

**Statement:** The `requirements-gatherer` agent SHALL NOT start the `document` subcommand until the user has confirmed the requirements summary.
**Traces to:** UR-035 | **Priority:** Must | **Status:** Built
**Source:** `agents/requirements-gatherer.md`

#### Scenario: Summary unconfirmed
- **GIVEN** the summary was shown and the user has not answered
- **WHEN** the agent plans its next move
- **THEN** it SHALL end `NeedsInput` and write no BRD, URD, or FR-NFR file

#### Scenario: Summary confirmed
- **GIVEN** the user confirmed the summary
- **WHEN** the agent resumes
- **THEN** it SHALL run `document`

### FR-085: Solutions-architect diagrams

**Statement:** The `solutions-architect` agent SHALL render diagrams with `mmdc` from a `.mmd` file under `specs/` to a `.svg`, `.png`, or `.pdf` file under `specs/`, and show the install command without running it when `mmdc` is missing.
**Traces to:** UR-036, UR-021 | **Priority:** Must | **Status:** Built
**Source:** `agents/solutions-architect.md`; `hooks/impl/sa-mermaid-only.js`

#### Scenario: mmdc present
- **GIVEN** `which mmdc` succeeds
- **WHEN** the agent renders `specs/spec-auth-architecture.mmd`
- **THEN** it SHALL write `specs/spec-auth-architecture.png` and embed the image

#### Scenario: mmdc absent
- **GIVEN** `which mmdc` fails
- **WHEN** the agent needs a diagram
- **THEN** it SHALL embed the Mermaid source and show `npm install -g @mermaid-js/mermaid-cli`, and SHALL NOT install it or use `npx`

## 3. Area B: hooks, guards, health, and maintenance scripts

### B.1 Hook platform

### FR-086: Hook registration

**Statement:** The plugin SHALL register 11 hook scripts as 16 commands in `hooks/hooks.json`, each with a `timeout` of 5 seconds, except the SessionStart health check at 10 seconds. The 1.12.0 baseline was 10 scripts and 15 commands; the posting ask hook of FR-206 (`hooks/pr-post-ask.js`, built for 1.13.0) added one script and one command. The counts live in this requirement and in the in-scope list of the BRD (section 4); `CLAUDE.md` and `README.md` state no hook count.
**Traces to:** UR-017, UR-055 | **Priority:** Must | **Status:** Built; Built (1.13.0): the added script and command (read in `hooks/hooks.json` on 2026-10-22: 16 `command` entries across 11 distinct scripts, the `pr-post-ask.js` entry at `:29` with `timeout` 5)
**Source:** `hooks/hooks.json`; `docs/TOKEN_OPTIMIZATION.md`; `DECISIONS.md:243-246`

#### Scenario: Registration count at 1.12.0 (superseded by the next scenario)
- **GIVEN** `hooks/hooks.json` at release 1.12.0
- **WHEN** a test counts the command entries
- **THEN** the count was 15 across the scripts `sa-mermaid-only`, `doc-cli-guard`, `commit-attribution-guard`, `injection-filter`, `prose-gate`, `prose-advisor`, `fsa-write-bar`, `fsa-log`, `health-check`, and `writing-context`

#### Scenario: Registration count after the ask hook (Built, 1.13.0)
- **GIVEN** `hooks/hooks.json` with FR-206 built
- **WHEN** a test counts the command entries
- **THEN** the count SHALL be 16 across 11 scripts, the added script being the posting ask hook, and the BRD scope list SHALL state 11 scripts and 16 commands

#### Scenario: Timeouts
- **GIVEN** the same file
- **WHEN** a test reads each `timeout`
- **THEN** every entry SHALL read 5 except `health-check.js --session-start`, which SHALL read 10

### FR-087: Launcher Node gate

**Statement:** Each hook command SHALL start through an ES5 entry file that checks for Node 6 or newer before it loads the hook module and, on an older Node, prints a warning and lets the call proceed.
**Traces to:** UR-017 | **Priority:** Must | **Status:** Built
**Source:** `hooks/lib/launch.js`; `rules/assist-plugin-rule.md` (Hook Fail-Open Rule)

#### Scenario: Node 18
- **GIVEN** Node 18
- **WHEN** a hook entry file runs
- **THEN** the launcher SHALL load the hook module

#### Scenario: Node older than 6
- **GIVEN** Node 4
- **WHEN** a hook entry file runs
- **THEN** the launcher SHALL print `{"systemMessage": ...}` naming the hook and exit 0 without denying the call

### FR-088: Deny only on a positive match

**Statement:** A hook SHALL deny a tool call only through the `permissionDecision: "deny"` JSON with exit status 0, returned by the decision function `evaluate(input)` of a guard, whose only I/O is file reads that a test can replace.
**Traces to:** UR-017 | **Priority:** Must | **Status:** Built (1.11.1); PLANNED (1.12.0): the wording of the function and of `rules/assist-plugin-rule.md:407`
**Source:** `rules/assist-plugin-rule.md` (Hook Fail-Open Rule, line 407, which says "the pure `evaluate(input)`" at 1.11.1 and changes to match); `hooks/lib/health.js`; `hooks/impl/commit-attribution-guard.js:435-454`, `:519-528` (reads a message file inside `evaluate`); `hooks/impl/prose-gate.js:55-61`; `hooks/lib/prose-diff.js` (reads the target file, the allowlist, and walks for `.git`); `hooks/impl/fsa-write-bar.js:167` (the `.git` walk); the answer to OP-B1 in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Reads a test can replace
- **GIVEN** `commit-attribution-guard` reads a message file named by `-F`
- **WHEN** a test supplies its own file reader through the guard's options
- **THEN** `evaluate(input)` SHALL return its decision from the replaced reader and SHALL write nothing and start no process

#### Scenario: Positive match
- **GIVEN** a Bash command that `doc-cli-guard` identifies as `ctx7 login`
- **WHEN** the guard evaluates it
- **THEN** the hook SHALL print the deny JSON and exit 0

#### Scenario: No match
- **GIVEN** a command no guard recognizes
- **WHEN** the guards evaluate it
- **THEN** each hook SHALL print nothing and exit 0

### FR-089: Failure path

**Statement:** A hook SHALL, on any thrown error, unhandled rejection, stdin error, malformed input, timeout, or disable flag, print only `{"systemMessage": "..."}` and exit 0 so the call proceeds.
**Traces to:** UR-017 | **Priority:** Must | **Status:** Built
**Source:** `hooks/lib/health.js` (Contract); `rules/assist-plugin-rule.md`

#### Scenario: Malformed input
- **GIVEN** a hook receives input that is not JSON
- **WHEN** it runs
- **THEN** it SHALL print a `systemMessage` warning and exit 0

#### Scenario: Output write fails
- **GIVEN** the warning write to stdout fails
- **WHEN** the hook finishes
- **THEN** it SHALL exit 0 silently

### FR-090: Health log content

**Statement:** The hook runtime SHALL record failures in `${CLAUDE_PLUGIN_DATA}/hook-health.jsonl` as timestamp, hook name, Node version, kind, and a short message, without command text, arguments, environment values, or stdin, and keep at most 200 lines.
**Traces to:** UR-018 | **Priority:** Must | **Status:** Built
**Source:** `hooks/lib/health.js`; `skills/health/SKILL.md` (Privacy)

#### Scenario: Failure logged
- **GIVEN** a guard throws on a command that holds a secret string
- **WHEN** the runtime logs it
- **THEN** the log line SHALL hold the error name and source line and SHALL NOT hold the command text

#### Scenario: Line cap
- **GIVEN** the log holds 200 lines
- **WHEN** another failure is logged
- **THEN** the file SHALL stay at 200 lines

### FR-091: Auto-disable and re-enable

**Statement:** The health check SHALL maintain `hooks-disabled.json` so that it adds a guard on a false deny (its self-test denies a known-safe case), adds a filter (`injection-filter`, `prose-advisor`, `fsa-log`) on any self-test failure, and removes an entry only after the hook passes every case of a full self-test. Built (1.13.0): the posting ask hook of FR-206 counts as a guard, a false ask (an ask on a known-safe self-test case) is treated like a false deny, and a missed ask is treated like a missed deny.
**Traces to:** UR-017, UR-018 | **Priority:** Must | **Status:** Built (1.11.1); PLANNED (1.12.0): the wording of `rules/assist-plugin-rule.md` (Hook Fail-Open Rule) and of the `hooks/impl/health-check.js:10-16` header, which say the disabled set follows the latest self-test denies and misses (the code already behaves as this statement says); Built (1.13.0): the ask-hook clause (`hooks/impl/health-check.js:1041-1080` lists `pr-post-ask` as a guard whose "deny" is an ask: the wrapper maps `ask === true` to `deny === true`, so a false ask disables the hook and a missed ask reports weak protection; `hooks/lib/health.js:407`; `skills/health/SKILL.md:54-55`)
**Source:** `hooks/impl/health-check.js:10-16`, `:24-26`, `:964-989` (an entry is removed only when the latest self-test passes every case; a listed guard whose latest run fails only by a missed deny or a thrown case stays listed); `rules/assist-plugin-rule.md`; the answer to OP-B2 in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Buggy guard
- **GIVEN** a guard that denies a known-safe command in its self-test
- **WHEN** the health check runs
- **THEN** it SHALL disable the guard, so that guard passes commands with a warning, and report it

#### Scenario: Fixed guard
- **GIVEN** a disabled guard that passes all cases after an update
- **WHEN** the health check runs
- **THEN** it SHALL remove the guard from `hooks-disabled.json`

#### Scenario: Guard misses a known-prohibited case
- **GIVEN** a guard that allows a known-prohibited command in its self-test
- **WHEN** the health check runs
- **THEN** it SHALL report weak protection and leave the guard out of `hooks-disabled.json`

#### Scenario: Filter fails in any way
- **GIVEN** the `injection-filter` alters a benign sample, or the `fsa-log` flags a clean report, or either misses a case it should catch, or a case throws
- **WHEN** the health check runs
- **THEN** it SHALL add that filter to `hooks-disabled.json`

#### Scenario: Writing-context failure never disables it (PLANNED, 1.12.0)
- **GIVEN** the `writing-context` self-test fails
- **WHEN** the health check runs
- **THEN** it SHALL report the failure and SHALL NOT add `writing-context` to `hooks-disabled.json`, because `writing-context` is neither a guard nor one of the three filters that are disabled on failure (`DECISIONS.md:168-171`)

#### Scenario: Listed guard that now only misses a deny
- **GIVEN** a guard already listed in `hooks-disabled.json` whose latest self-test no longer denies a known-safe case but still allows a known-prohibited case
- **WHEN** the health check runs
- **THEN** it SHALL keep the guard in `hooks-disabled.json`, because the entry is removed only after a full passing self-test

### B.2 Command guards

### FR-092: Mermaid guard scope and commands

**Statement:** The `sa-mermaid-only` hook SHALL limit the Bash tool of every agent whose type is `solutions-architect` or ends in `:solutions-architect` (`assist-plugin:solutions-architect` and the same name from any other plugin) to `which mmdc`, `where mmdc`, `mmdc --version`, and `mmdc` with the flags `-i`, `--input`, `-o`, `--output`, `-t`, `--theme`, `-b`, `--backgroundColor`, `-w`, `--width`, `-H`, `--height`, `-s`, and `--scale`.
**Traces to:** UR-021 | **Priority:** Must | **Status:** Built (1.11.1). The code matches this statement; the earlier version of this requirement said only "the `solutions-architect` agent", so no source file changes
**Source:** `hooks/impl/sa-mermaid-only.js:17`, `:98-99` (pattern `(^|:)solutions-architect$`); `hooks/impl/health-check.js:851` (the self-test treats `plugin:assist:solutions-architect` as restricted); the answer to OP-B3 in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Allowed command
- **GIVEN** `solutions-architect` runs `which mmdc`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL allow it with no output

#### Scenario: Same agent name from another plugin
- **GIVEN** an agent of type `other-plugin:solutions-architect` runs `npx mmdc -i specs/a.mmd -o specs/a.png`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it, because the type ends in `:solutions-architect`

#### Scenario: Other command
- **GIVEN** `solutions-architect` runs `npx mmdc -i specs/a.mmd -o specs/a.png`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it and show the install command in the reason

### FR-093: Mermaid guard paths and metacharacters

**Statement:** The `sa-mermaid-only` hook SHALL deny an `mmdc` command unless its `-i` value is a `.mmd` file, its `-o` value is a `.svg`, `.png`, or `.pdf` file, each is either a relative path under `specs/` or `<dir>/specs/` or an absolute path under `<git root>/specs/` or `<git root>/<dir>/specs/` (the git root found by walking up for `.git` from the hook input's cwd, and every absolute path denied when no `.git` is found), a relative path holds no empty, `.` or `..` segment and no segment that starts with a dot anywhere, an absolute path is held to the same rule for the part below `<git root>`, and the command holds no shell metacharacter.
**Traces to:** UR-021 | **Priority:** Must | **Status:** Built (1.11.1) for relative paths; PLANNED (1.12.0): absolute paths under the git root
**Source:** `hooks/impl/sa-mermaid-only.js:11-12`, `:59` (the built rule: no empty, `.`, `..`, or dot-led segment anywhere in a relative path); `DECISIONS.md` (2026-10-13); `DECISIONS.md:148-151` (also accepts absolute `-i` and `-o` paths under `<git root>/specs/`, found by walking up for `.git`) and `DECISIONS.md:158-161` (absolute paths only under `<git root>/specs/`, the walk starting at the hook input's cwd, absolute paths denied when no `.git` is found) and `DECISIONS.md:173-176` (also under `<git root>/<dir>/specs/` with the same segment rules); `hooks/lib/git-root.js` (the `.git` walk); FR-190

#### Scenario: Output into CLAUDE.md
- **GIVEN** `solutions-architect` runs `mmdc -i specs/a.mmd -o CLAUDE.md`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it

#### Scenario: Dot-led folder before specs
- **GIVEN** `solutions-architect` runs `mmdc -i .claude/specs/a.mmd -o .claude/specs/a.png`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it, because the segment `.claude` starts with a dot

#### Scenario: Absolute path with a dot-led folder below the git root (PLANNED, 1.12.0)
- **GIVEN** git root `<repo>` and `solutions-architect` runs `mmdc -i <repo>/.hidden/specs/a.mmd -o <repo>/specs/a.png`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it

#### Scenario: Absolute path under the git root from a subdirectory session (PLANNED, 1.12.0)
- **GIVEN** a session started in `<repo>/src` with git root `<repo>`, and `solutions-architect` runs `mmdc -i <repo>/specs/a.mmd -o <repo>/specs/a.png`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL allow it

#### Scenario: Absolute path outside the git root specs (PLANNED, 1.12.0)
- **GIVEN** `solutions-architect` runs `mmdc -i <repo>/specs/a.mmd -o <repo>/CLAUDE.md`, and then `mmdc -i /tmp/specs/a.mmd -o /tmp/specs/a.png` where `/tmp` is not under the git root
- **WHEN** the hook evaluates each
- **THEN** the hook SHALL deny both

#### Scenario: Absolute path under a submodule specs folder (PLANNED, 1.12.0)
- **GIVEN** git root `<repo>` and `solutions-architect` runs `mmdc -i <repo>/backend/specs/a.mmd -o <repo>/backend/specs/a.png`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL allow it, with the same segment rules as for a relative path, which matches where FR-190 writes submodule specs

#### Scenario: No .git found (PLANNED, 1.12.0)
- **GIVEN** a hook input whose cwd has no `.git` in it or in any parent, and `solutions-architect` runs `mmdc -i /work/proj/specs/a.mmd -o /work/proj/specs/a.png`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it, and SHALL still allow the relative `mmdc -i specs/a.mmd -o specs/a.png`

#### Scenario: Walk starts at the cwd (PLANNED, 1.12.0)
- **GIVEN** a hook input whose cwd is `<repo>/src`, a `.git` in `<repo>`, and no `.git` in `<repo>/src`
- **WHEN** the hook evaluates `mmdc -i <repo>/specs/a.mmd -o <repo>/specs/a.png`
- **THEN** the hook SHALL take `<repo>` as the git root and allow it

#### Scenario: Absolute path with a dot-dot segment (PLANNED, 1.12.0)
- **GIVEN** `solutions-architect` runs `mmdc -i <repo>/specs/../src/a.mmd -o <repo>/specs/a.png`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it

#### Scenario: Other agents
- **GIVEN** `developer` runs any Bash command
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL allow it with no output

### FR-094: Documentation CLI guard

**Statement:** The `doc-cli-guard` hook SHALL judge each part of a command split at `;`, `&&`, `||`, `|`, and newlines, and deny, for every agent and in both Bash and PowerShell, a part that assigns an endpoint override variable before any program (`FIRECRAWL_API_URL=` or `CONTEXT7_*URL*=` as a prefix in Bash, `$env:FIRECRAWL_API_URL=` or `$env:CONTEXT7_*URL*=` in PowerShell, matched without regard to case and with spaces allowed around `=`; Bash matching stays as built and is case-sensitive; in PowerShell, Windows program names such as `CTX7.EXE` are matched without regard to case), and a `firecrawl` or `ctx7` part that carries an output or endpoint flag, a quote inside a word, or the subcommands `firecrawl env`, `ctx7 setup`, or `ctx7 login`, and, whenever any part runs `ctx7` or `firecrawl`, the whole command if it carries a shell metacharacter (per-part judging adds checks and removes none, `DECISIONS.md:193-196`).
**Traces to:** UR-021 | **Priority:** Must | **Status:** Built (1.11.1) for Bash and the bare program names; PLANNED (1.12.0): PowerShell coverage, program-name detection (FR-198), the reworded endpoint-variable rule, judging each part of a chained command (`DECISIONS.md:188-191`), and denying a PowerShell assignment before a name hidden by quotes or escapes (`DECISIONS.md:198-201`)
**Source:** `hooks/impl/doc-cli-guard.js:60-66` (an endpoint variable word before the program denies the command whatever the program is, for example `CONTEXT7_BASE_URL=http://e npm test`; the program test follows); `hooks/impl/doc-cli-guard.js:91` and `hooks/hooks.json:5-17` (registered for the `Bash` matcher and judging `tool_name` `Bash` only at 1.11.1); `DECISIONS.md` (2026-10-16, Documentation CLI guard and injection filter cover PowerShell and launchers); `DECISIONS.md:198-201` (`doc-cli-guard` is best-effort string matching and Claude Code's permission prompts remain the primary control; program words from variables, brace expansion, globs, and programs that run other programs such as `xargs`, `find -exec`, and `watch` are known gaps, and a bypass form found later is added to that list), and `DECISIONS.md:213-216` (the new known-gap forms: PowerShell typographic quotes, block comments, the dot-source operator, typed and scoped assignments, leading redirections, and `sudo --user`); the answers to OP-B4 and OP-B8 in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Endpoint variable before another program
- **GIVEN** the command `CONTEXT7_BASE_URL=http://e npm test`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it, because the endpoint override variable comes before a program, whichever program follows

#### Scenario: PowerShell environment assignment (PLANNED, 1.12.0)
- **GIVEN** a PowerShell command `$env:FIRECRAWL_API_URL = "http://e"; npm test`, and another that sets `$env:CONTEXT7_BASE_URL=http://e`
- **WHEN** the hook evaluates each
- **THEN** the hook SHALL deny both, as it denies the Bash prefix assignment, and SHALL allow `$env:NODE_ENV = "test"; npm test`

#### Scenario: Chained command (PLANNED, 1.12.0)
- **GIVEN** the Bash command `cd x; ctx7 login`, the PowerShell command `$env:NODE_ENV = "test"; ctx7 login`, the Bash commands `ctx7 docs /org/project "routing" --json | head` and `ctx7 docs x --json | tee out.md`, and the Bash command `firecrawl scrape https://x; rm -rf ~; echo --only-main-content`
- **WHEN** `doc-cli-guard` evaluates each
- **THEN** the hook SHALL deny all five: the first two because it judges the part `ctx7 login` on its own after splitting at `;`, and the last three because the whole command carries a shell metacharacter (`|` or `;`) while a part runs `ctx7` or `firecrawl`, which per-part judging does not remove (`DECISIONS.md:193-196`)

#### Scenario: Metacharacter in a command with no documentation CLI
- **GIVEN** the Bash command `cd x; npm test | head`
- **WHEN** `doc-cli-guard` evaluates it
- **THEN** the hook SHALL allow it with no output, because no part runs `ctx7` or `firecrawl`

#### Scenario: Windows program name in capitals (PLANNED, 1.12.0)
- **GIVEN** the PowerShell command `CTX7.EXE login` and the Bash command `CTX7 login`
- **WHEN** the hook evaluates each
- **THEN** the hook SHALL deny the PowerShell command, because Windows program names match without regard to case, and SHALL treat the Bash command as built (case-sensitive), where `CTX7` is not `ctx7`

#### Scenario: PowerShell assignment before a hidden name (PLANNED, 1.12.0)
- **GIVEN** the PowerShell command ``$r = ct`x7 login``, where a backtick escape hides the name `ctx7`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it (`DECISIONS.md:198-201`)

#### Scenario: Known gaps (PLANNED, 1.12.0)
- **GIVEN** a program word that comes from a variable, brace expansion, or a glob, or a program that runs another program, such as `xargs`, `find -exec`, or `watch`
- **WHEN** a reviewer judges the hook against this requirement
- **THEN** the reviewer SHALL treat the form as a listed known gap, not as a defect of the hook, and a bypass form found later SHALL be added to the list

#### Scenario: PowerShell case and spacing (PLANNED, 1.12.0)
- **GIVEN** the PowerShell commands `$Env:Firecrawl_Api_Url="http://e"; npm test` and `$ENV:context7_base_url   =   "http://e"; npm test`
- **WHEN** the hook evaluates each
- **THEN** the hook SHALL deny both, because the match ignores case and allows spaces around `=`

#### Scenario: PowerShell command (PLANNED, 1.12.0)
- **GIVEN** `doc-cli-guard` is registered for `Bash|PowerShell` and a PowerShell call runs `ctx7 login`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it, and SHALL allow `ctx7 docs /org/project "routing" --json` run through PowerShell

#### Scenario: Output flag
- **GIVEN** the command `firecrawl scrape https://example.com -o out.md`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it

#### Scenario: Plain lookup
- **GIVEN** the command `ctx7 docs /org/project "routing" --json`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL allow it with no output

### FR-095: Attribution guard covered commands

**Statement:** The `commit-attribution-guard` hook SHALL inspect `git commit` and `git merge` with `-m`, `--message`, `-F`, `--file`, or `--trailer`, and `gh pr create` and `gh pr edit` with `--body`, `-b`, `--body-file`, or `-F`, in Bash and PowerShell, including chained commands, heredocs, and `sh -c` strings.
**Traces to:** UR-015 | **Priority:** Must | **Status:** Built
**Source:** `hooks/impl/commit-attribution-guard.js`; `DECISIONS.md` (2026-10-12)

#### Scenario: Heredoc message
- **GIVEN** `git commit -m "$(cat <<'EOF' ... EOF)"` whose body holds an attribution line
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL read the heredoc text and deny the command

#### Scenario: Other git command
- **GIVEN** `git tag -a v1 -m "Co-Authored-By: Claude <noreply@anthropic.com>"`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL allow it because `git tag` is not covered

### FR-096: Attribution lines denied

**Statement:** The `commit-attribution-guard` hook SHALL deny a message or body that holds a Co-Authored-By trailer naming an AI tool or vendor, a "Generated with" or "Generated by" footer naming an AI tool, an Assisted-by or Generated-by trailer naming an AI tool, or a `*-Session:` trailer or bare session link at an AI host.
**Traces to:** UR-015 | **Priority:** Must | **Status:** Built
**Source:** `rules/assist-plugin-rule.md` (No AI Attribution Rule); `hooks/lib/attribution-rules.js`

#### Scenario: AI co-author
- **GIVEN** a commit message ending with `Co-Authored-By: Claude <noreply@anthropic.com>`
- **WHEN** the hook evaluates the command
- **THEN** the hook SHALL deny it

#### Scenario: Human co-author
- **GIVEN** a commit message ending with `Co-Authored-By: Claude Dupont <claude@example.com>`
- **WHEN** the hook evaluates the command
- **THEN** the hook SHALL allow it

### FR-097: Attribution guard denial reason

**Statement:** The `commit-attribution-guard` hook SHALL list at most 5 offending lines in its deny reason and leave the command unchanged.
**Traces to:** UR-015 | **Priority:** Must | **Status:** Built
**Source:** `hooks/impl/commit-attribution-guard.js`

#### Scenario: Seven lines
- **GIVEN** a message with seven attribution lines
- **WHEN** the hook denies it
- **THEN** the reason SHALL list five lines

#### Scenario: No rewrite
- **GIVEN** any denied command
- **WHEN** the hook returns
- **THEN** the output SHALL carry no `updatedInput`

### FR-098: Attribution guard on unseen messages

**Statement:** The `commit-attribution-guard` hook SHALL judge only message text it can read: the text in the command, or the first 64 KB of a regular file named by `-F`, `--file`, or `--body-file`, resolved against the hook's cwd when the path is relative (absolute and `~` paths are read as given).
**Traces to:** UR-015 | **Priority:** Must | **Status:** Built
**Source:** `hooks/impl/commit-attribution-guard.js:435-465` (`readMessageFile`, `resolveFile`); `README.md` (Commit attribution)

#### Scenario: Message file
- **GIVEN** `gh pr create --body-file body.md` and a 2 KB `body.md` with an attribution line
- **WHEN** the hook evaluates the command
- **THEN** the hook SHALL deny it

#### Scenario: Stdin
- **GIVEN** `git commit -F -` with the message on stdin
- **WHEN** the hook evaluates the command
- **THEN** the hook SHALL allow it because the message is not visible

#### Scenario: Absolute and relative paths
- **GIVEN** `git commit -F /tmp/msg.txt` and `git commit -F msg.txt` with the hook input's cwd set to the project
- **WHEN** the hook evaluates each command
- **THEN** the hook SHALL read `/tmp/msg.txt` as given and `msg.txt` under the project cwd, and read at most the first 64 KB of each

### B.3 Injection filter

### FR-099: Filter for untrusted tool results

**Statement:** The `injection-filter` hook SHOULD, after `WebFetch`, `WebSearch`, `mcp__*` tools, `Agent` results, and Bash or PowerShell commands that run `firecrawl`, `curl`, `wget`, `ctx7`, `Invoke-WebRequest` (alias `iwr`), or `Invoke-RestMethod` (alias `irm`), matching PowerShell cmdlets, aliases, variables, and Windows program names without regard to case while Bash matching stays as built (case-sensitive), where the variables are a leading `$name =` or `$env:NAME =` assignment that the filter skips, together with an opening `(` or `$(`, before it reads the PowerShell program word (`DECISIONS.md:188-191`), replace each sentence that matches an injection rule with a visible marker and return the result in its original shape.
**Traces to:** UR-020 | **Priority:** Should | **Status:** Built (1.11.1) for Bash and the bare program names; PLANNED (1.12.0): PowerShell tool results, the two PowerShell download commands, and program-name detection (FR-198)
**Source:** `hooks/impl/injection-filter.js:52`, `:56-61` (checks `tool_name` `Bash` only at 1.11.1); `README.md` (Injection filter); `DECISIONS.md` (2026-10-16, Documentation CLI guard and injection filter cover PowerShell and launchers); `DECISIONS.md:198-201` and `:213-216` (the injection filter is best-effort too; PowerShell typographic quotes, block comments, the dot-source operator, typed and scoped assignments, leading redirections, and downloads inside `{ }` script blocks are known gaps, the last accepted at `:203-205`); the answer to OP-B11 in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: PowerShell aliases and case (PLANNED, 1.12.0)
- **GIVEN** PowerShell results from `irm https://example.com`, from `invoke-restmethod https://example.com`, and from `CURL.EXE https://example.com`, each holding a sentence that tells the model to ignore its instructions
- **WHEN** the filter runs
- **THEN** the filter SHALL replace the sentence in all three, and SHALL leave a Bash result from `CURL https://example.com` unfiltered because Bash matching stays case-sensitive

#### Scenario: Assignment before the program word (PLANNED, 1.12.0)
- **GIVEN** the PowerShell commands `$r = iwr https://x; $r.Content` and `$env:NAME = irm https://x`, each with a result that holds a sentence telling the model to ignore its instructions
- **WHEN** the filter runs
- **THEN** the filter SHALL skip the leading `$r =` and `$env:NAME =`, read `iwr` and `irm` as the program word, and replace the sentence in both results

#### Scenario: Opening parenthesis before the program word (PLANNED, 1.12.0)
- **GIVEN** the PowerShell commands `(irm https://x).title` and `$(iwr https://x).Content`, each with a result that holds such a sentence
- **WHEN** the filter runs
- **THEN** the filter SHALL skip the opening `(` and `$(`, read `irm` and `iwr` as the program word, and replace the sentence in both results

#### Scenario: PowerShell download (PLANNED, 1.12.0)
- **GIVEN** a PowerShell result from `Invoke-RestMethod` that holds a sentence telling the model to ignore its instructions
- **WHEN** the filter runs
- **THEN** the filter SHALL replace the sentence with the visible marker, as it does for a Bash `curl` result

#### Scenario: Injected sentence
- **GIVEN** a `WebFetch` result with a sentence that tells the model to ignore its instructions
- **WHEN** the filter runs
- **THEN** the filter SHALL replace the sentence with `[assist-plugin removed possible prompt injection: <rule-id>]` and add a note listing the rule id

#### Scenario: Local read
- **GIVEN** a `Read` or `Grep` result
- **WHEN** the filter runs
- **THEN** the filter SHALL leave it unchanged

### FR-100: Filter for subagent prompts

**Statement:** The `injection-filter` hook SHOULD, before an `Agent` call, clean a matching subagent prompt the same way and return it with `permissionDecision: "ask"` so the user confirms the rewrite.
**Traces to:** UR-020 | **Priority:** Should | **Status:** Built
**Source:** `hooks/impl/injection-filter.js`

#### Scenario: Matching prompt
- **GIVEN** a subagent prompt that holds an instruction-override sentence
- **WHEN** the hook runs before the call
- **THEN** the hook SHALL rewrite the sentence and ask the user to confirm

#### Scenario: Clean prompt
- **GIVEN** a subagent prompt with no rule match
- **WHEN** the hook runs
- **THEN** the hook SHALL emit nothing

### FR-101: Filter for typed prompts

**Statement:** The `injection-filter` hook SHOULD, on a typed prompt that matches a rule, warn the user and note the match to Claude while leaving the prompt unchanged and unblocked.
**Traces to:** UR-020 | **Priority:** Should | **Status:** Built
**Source:** `hooks/impl/injection-filter.js` (UserPromptSubmit)

#### Scenario: Typed injection phrasing
- **GIVEN** a typed prompt that matches an injection rule
- **WHEN** UserPromptSubmit fires
- **THEN** the hook SHALL show a warning and leave the prompt text unchanged

#### Scenario: Benign discussion
- **GIVEN** a typed prompt that only discusses prompt injection
- **WHEN** UserPromptSubmit fires
- **THEN** the hook SHALL NOT flag it

### FR-102: Filter skips and allowlist

**Statement:** The `injection-filter` hook SHOULD skip content that comes from the plugin's own files or from a source listed in `injection-allowlist.json`.
**Traces to:** UR-020 | **Priority:** Should | **Status:** Built
**Source:** `hooks/impl/injection-filter.js`; `README.md` (Injection filter)

#### Scenario: Allowlisted host
- **GIVEN** `injection-allowlist.json` lists `docs.example.com`
- **WHEN** a `WebFetch` result comes from that host
- **THEN** the filter SHALL leave the result unchanged

#### Scenario: Plugin file
- **GIVEN** content that comes from one of the plugin's own files
- **WHEN** the filter runs
- **THEN** the filter SHALL leave the content unchanged

### B.4 Writing-standard hooks

### FR-103: Prose gate

**Statement:** The `prose-gate` hook SHALL deny a Write, Edit, MultiEdit, or NotebookEdit to a prose file (`.md`, `.mdx`, `.txt`, `.rst`, `.adoc`) only when the text the call adds holds an em dash, chatbot residue, a curly quote, or a summary label.
**Traces to:** UR-016 | **Priority:** Must | **Status:** Built
**Source:** `hooks/impl/prose-gate.js`; `rules/writing-standard.md` (Block tier)

#### Scenario: Added em dash
- **GIVEN** an Edit that adds a sentence with an em dash to `notes.md`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny the write and list the hit with its line, rule id, and fix

#### Scenario: Old text untouched
- **GIVEN** a file that already holds an em dash and an Edit that adds clean text elsewhere
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL allow the write

### FR-104: Prose gate path exemptions

**Statement:** The `prose-gate` hook SHALL NOT judge files under the system temp directory, files under `docs/tts/` relative to the project root or the session's working directory inside it, and paths listed in `${CLAUDE_PLUGIN_DATA}/prose-gate-allowlist.json`, where the entry `"*"` exempts every path.
**Traces to:** UR-016 | **Priority:** Must | **Status:** Built (1.11.1; root resolution from a subdirectory by FR-181)
**Source:** `hooks/impl/prose-gate.js`; `hooks/lib/prose-diff.js:103-140` (project root and session root, FR-181); `DECISIONS.md` (2026-10-12, Prose hooks skip docs/tts; 2026-10-16, refinement)

#### Scenario: Voice script
- **GIVEN** a Write to `docs/tts/voice-intro-20261012-0900.md` with em dashes as pause marks
- **WHEN** the hook evaluates it in a session whose cwd is the project root
- **THEN** the hook SHALL allow the write

#### Scenario: Voice script from a session started in a subdirectory
- **GIVEN** a session started in `<project>/src` and a Write to `<project>/docs/tts/voice-intro-20261012-0900.md`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL allow the write, as the 2026-10-12 and 2026-10-16 decisions require (FR-181)

#### Scenario: Other docs path
- **GIVEN** a Write to `docs/guide.md` with an em dash
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny the write

### FR-105: Prose gate text exemptions

**Statement:** The `prose-gate` hook SHOULD NOT judge code fences, inline code, blockquotes, double-quoted text of up to 300 characters on one line, link targets, traceability markers, or numeric ranges.
**Traces to:** UR-016 | **Priority:** Should | **Status:** Built
**Source:** `rules/writing-standard.md` (Exemptions)

#### Scenario: Verbatim quotation
- **GIVEN** a write that adds a double-quoted quotation containing an em dash
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL allow the write

#### Scenario: Traceability marker
- **GIVEN** a write that adds `[SPEC-003 -> FR-045]`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL NOT flag the arrow

### FR-106: Prose advisor

**Statement:** The `prose-advisor` hook SHOULD, after a write to a prose file, return the advisory-tier tells in the added text as additional context, each family once with one example and its fix, in at most 10 lines, without blocking.
**Traces to:** UR-016 | **Priority:** Should | **Status:** Built
**Source:** `hooks/impl/prose-advisor.js`; `rules/writing-standard.md` (Advisory tier)

#### Scenario: Hedge added
- **GIVEN** a write that adds "it should be noted that"
- **WHEN** the advisor runs
- **THEN** the advisor SHALL add a note naming the hedge family and its fix

#### Scenario: Clean text
- **GIVEN** a write that adds no advisory tell
- **WHEN** the advisor runs
- **THEN** the advisor SHALL emit nothing

### FR-107: Writing context injection

**Statement:** The `writing-context` hook SHOULD inject the contents of `rules/writing-standard-compact.md` under a one-sentence header into the main session at SessionStart (`startup`, `resume`, `clear`, `compact`) and into each subagent at SubagentStart, up to 10,000 characters.
**Traces to:** UR-024 | **Priority:** Should | **Status:** Built
**Source:** `hooks/impl/writing-context.js`; `hooks/hooks.json`

#### Scenario: Session start
- **GIVEN** a new session
- **WHEN** SessionStart fires
- **THEN** the hook SHALL add the header and the compact standard as context

#### Scenario: Missing file
- **GIVEN** `rules/writing-standard-compact.md` is missing
- **WHEN** the hook runs
- **THEN** the hook SHALL emit nothing and write a `missing-standard` entry to the health log

### B.5 Write bar and terminal-block log

### FR-108: Write bar for developer-tester

**Statement:** The `fsa-write-bar` hook SHALL deny `assist-plugin:developer-tester` any Write, Edit, MultiEdit, or NotebookEdit path that matches none of the test globs, and any path with a segment that starts with a dot, or named `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md`.
**Traces to:** UR-019 | **Priority:** Must | **Status:** Built
**Source:** `hooks/impl/fsa-write-bar.js`; `agents/developer-tester.md` (Write scope); `hooks/lib/fsa-paths.js` (TEST_GLOBS)

#### Scenario: Test path
- **GIVEN** `developer-tester` writes `tests/auth/login.test.ts`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL allow it

#### Scenario: Source path
- **GIVEN** `developer-tester` writes `src/auth.ts`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it and name the Write scope section

### FR-109: Write bar for developer

**Statement:** The `fsa-write-bar` hook SHALL deny `assist-plugin:developer` any path that matches a test glob.
**Traces to:** UR-019, UR-049 | **Priority:** Must | **Status:** Built
**Source:** `hooks/impl/fsa-write-bar.js`; `agents/developer.md` (Write scope)

#### Scenario: Test file
- **GIVEN** `developer` writes `src/auth_test.go`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it

#### Scenario: Source file
- **GIVEN** `developer` writes `src/auth.go`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL allow it

### FR-110: Write bar for task-planner

**Statement:** The `fsa-write-bar` hook SHALL deny `assist-plugin:task-planner` any path other than a `task-plan-*.md` file directly under `docs/task-plans/` inside the project, and any hidden path or auto-loaded file name; FR-186 states the git-root rule.
**Traces to:** UR-019 | **Priority:** Must | **Status:** Built (1.11.1; a root-level `task-plan-*.md` was the allowed path at 4803a0d, and root-level plans in older projects are now read but never written)
**Source:** `hooks/impl/fsa-write-bar.js`; `hooks/lib/fsa-paths.js:35` (`TASK_PLAN_GLOB`); `agents/task-planner.md` (Write scope)

#### Scenario: Task plan folder
- **GIVEN** `task-planner` writes `docs/task-plans/task-plan-auth-20261012-101500.md`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL allow it

#### Scenario: Subdirectory task plan
- **GIVEN** `task-planner` writes `docs/task-plan-auth.md`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it

### FR-111: Write bar for chain agents

**Statement:** The `fsa-write-bar` hook SHALL deny `assist-plugin:requirements-gatherer` and `assist-plugin:solutions-architect` any hidden path and any file named `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md`.
**Traces to:** UR-019 | **Priority:** Must | **Status:** Built
**Source:** `hooks/impl/fsa-write-bar.js`; `DECISIONS.md` (2026-10-13, Narrow the hidden-path bar)

#### Scenario: Auto-loaded file
- **GIVEN** `requirements-gatherer` writes `CLAUDE.md`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it

#### Scenario: CI agent unaffected
- **GIVEN** `devops` writes `.github/workflows/ci.yml`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL allow it

### FR-112: Protected paths for every subagent

**Statement:** The `fsa-write-bar` hook SHALL deny every subagent, from any plugin, a Write, Edit, MultiEdit, or NotebookEdit on `.agent/main-plan/**` and on any file named `DECISIONS.md`, matched without regard to case, trailing dots or spaces, or a `:stream` suffix.
**Traces to:** UR-019 | **Priority:** Must | **Status:** Built (1.11.1). `DECISIONS.md` is append-only, so the refinement for a call whose `agent_type` lacks the `assist-plugin:` prefix stays recorded at `DECISIONS.md:133-136`, and no earlier entry changes
**Source:** `hooks/impl/fsa-write-bar.js:171-176` and the comment at `:26-28` (a call whose `agent_type` lacks the `assist-plugin:` prefix is judged only when it carries an `agent_id`); `hooks/impl/health-check.js:443-445` and the header at `:22-24` (the self-test expects that); `DECISIONS.md` (2026-10-13, Protected-path guard covers every subagent; 2026-10-16, A non-plugin --agent main session is a main session)

#### Scenario: Plan file
- **GIVEN** any subagent call with an `agent_id` writes `.agent/main-plan/plan-x.md`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it

#### Scenario: Main session started with a custom agent
- **GIVEN** a call with an `agent_type` without the `assist-plugin:` prefix, such as `my-main-agent`, and no `agent_id`, from a main session started with `--agent my-main-agent`
- **WHEN** the hook evaluates a write to `DECISIONS.md` or `.agent/main-plan/plan-x.md`
- **THEN** the hook SHALL treat the call as the main session and allow the write, and SHALL still deny the same write when the call carries an `agent_id`

#### Scenario: Main session started as an assist-plugin agent
- **GIVEN** a main session started with `--agent assist-plugin:developer`, whose calls carry an `agent_type` with the `assist-plugin:` prefix and no `agent_id`
- **WHEN** the hook evaluates a write to `DECISIONS.md` or `.agent/main-plan/plan-x.md`
- **THEN** the hook SHALL deny it

#### Scenario: Spelling variants
- **GIVEN** a subagent writes `decisions.md.` or `DECISIONS.md:stream`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it

### FR-113: Write bar path limits; main session untouched

**Statement:** The `fsa-write-bar` hook SHALL deny a path longer than 4096 characters or holding a NUL character to every subagent, of any plugin, and apply the rules of an `assist-plugin:<name>` agent to a main session only when that session was started with `--agent assist-plugin:<name>`.
**Traces to:** UR-019 | **Priority:** Must | **Status:** Built
**Source:** `hooks/impl/fsa-write-bar.js:24-26`, `:183-188`

#### Scenario: Over-long path
- **GIVEN** a subagent of any plugin, with an `agent_id`, writes a path of 5000 characters
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it

#### Scenario: Main session
- **GIVEN** the main session writes `DECISIONS.md`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL allow it with no output

#### Scenario: Main session started as an agent
- **GIVEN** a main session started with `--agent assist-plugin:developer` writes `src/auth_test.go`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it by the `developer` rules

### FR-114: Write bar judges paths relative to the project

**Statement:** The `fsa-write-bar` hook SHOULD judge a path inside the session's working directory or `CLAUDE_PROJECT_DIR` relative to that directory, so a project under a directory named `tests` is not all test paths.
**Traces to:** UR-019 | **Priority:** Should | **Status:** Built
**Source:** `hooks/impl/fsa-write-bar.js`; `README.md` (FSA hooks)

#### Scenario: Project under tests
- **GIVEN** a project at `/work/tests/app` and `developer` writes `/work/tests/app/src/main.ts`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL allow it

#### Scenario: Two roots
- **GIVEN** both the working directory and `CLAUDE_PROJECT_DIR` contain the path
- **WHEN** the hook evaluates `developer`
- **THEN** the hook SHALL deny the write if any relative form matches a test glob

### FR-115: Terminal-block log entry

**Statement:** The `fsa-log` hook SHALL, on SubagentStop, SubagentHandback, and Agent results from one of the seven `assist-plugin` agents listed in `hooks/lib/fsa-tables.js`, parse the last `fsa` block, check it against the table, and append one JSON line to `${CLAUDE_PLUGIN_DATA}/fsa-log.jsonl` holding the checked fields and the problem codes, keeping the newest 500 lines.
**Traces to:** UR-023 | **Priority:** Must | **Status:** Built
**Source:** `hooks/impl/fsa-log.js`; `hooks/lib/fsa-tables.js`

#### Scenario: Clean report
- **GIVEN** a `reviewer` report with a legal trace
- **WHEN** the hook logs it
- **THEN** the line SHALL hold an empty problem list and no message text

#### Scenario: Illegal transition
- **GIVEN** a `reviewer` trace `Intake > Review > Done`
- **WHEN** the hook checks it
- **THEN** the line SHALL hold the problem `illegal-transition: Intake>Review`

### FR-116: Terminal-block log warn mode

**Statement:** The `fsa-log` hook SHALL show the user a one-line `systemMessage` and nothing else (no block, decision, or added context) when a SubagentStop or SubagentHandback report has problems.
**Traces to:** UR-023 | **Priority:** Must | **Status:** Built
**Source:** `hooks/impl/fsa-log.js`; `README.md` (FSA hooks)

#### Scenario: Broken report
- **GIVEN** a subagent final message with no `fsa` block
- **WHEN** SubagentStop fires
- **THEN** the hook SHALL warn once and let the run end unchanged

#### Scenario: Agent result event
- **GIVEN** the same report arrives as an `Agent` tool result
- **WHEN** the hook logs it
- **THEN** the hook SHALL log it and SHALL NOT warn again

### FR-117: Stop after handback marker

**Statement:** The `fsa-log` hook SHOULD write a `stop-after-handback` marker record in place of a second check when a SubagentStop follows the same agent's newest handback record.
**Traces to:** UR-023 | **Priority:** Should | **Status:** Built
**Source:** `hooks/impl/fsa-log.js`

#### Scenario: Handback then stop
- **GIVEN** a handback record is the newest for an agent id
- **WHEN** that agent's SubagentStop fires
- **THEN** the hook SHALL write the marker and not check the report again

#### Scenario: Resumed run
- **GIVEN** the marker is the newest record and the agent resumes and stops without a handback
- **WHEN** SubagentStop fires
- **THEN** the hook SHALL check and log the stop like any other

### B.6 Health check, scripts, and output style

### FR-118: Session-start self-test

**Statement:** The health check SHALL, at SessionStart `startup` and `resume`, self-test each guard and filter, `writing-context` included, against fixed allow and deny cases and print a notice only when something is wrong. Built (1.13.0): the fixed cases of the posting ask hook of FR-206 are ask and no-ask cases (14 ask cases and 13 no-ask cases at `hooks/impl/health-check.js:1049-1079`).
**Traces to:** UR-018 | **Priority:** Must | **Status:** Built (1.11.1); PLANNED (1.12.0): the `writing-context` self-test and the notice ending; Built (1.13.0): the ask-hook clause
**Source:** `hooks/impl/health-check.js:802-922` (the self-test list has no `writing-context` entry at 1.11.1), `:1004` (the notice reads `<name> self-test failed (<N> known-prohibited command(s) allowed)`); `hooks/impl/writing-context.js:64-66`; `skills/health/SKILL.md:17` (says `writing-context` has no self-test); the answers to OP-B5a and OP-B5b in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Writing-context self-test (PLANNED, 1.12.0)
- **GIVEN** `rules/writing-standard-compact.md` is present and readable
- **WHEN** the session-start self-test runs `writing-context` against a fixed SessionStart input
- **THEN** the health check SHALL pass it when the hook returns the header and the compact standard, and SHALL print a notice naming `writing-context` when the hook returns nothing

#### Scenario: Failed writing-context self-test (PLANNED, 1.12.0)
- **GIVEN** the `writing-context` self-test returns nothing because `rules/writing-standard-compact.md` is unreadable
- **WHEN** the session starts
- **THEN** the health check SHALL report the failure in its notice and SHALL NOT add `writing-context` to `hooks-disabled.json` (`DECISIONS.md:168-171`; FR-091)

#### Scenario: Notice for a guard that only misses denies (PLANNED, 1.12.0)
- **GIVEN** a guard, listed in `hooks-disabled.json` or not, whose self-test allows a known-prohibited case and denies no known-safe case
- **WHEN** the session starts
- **THEN** the notice SHALL read `<name> self-test failed (<N> known-prohibited command(s) allowed)` followed by `; protection is weak`

#### Scenario: All pass
- **GIVEN** every self-test passes
- **WHEN** the session starts
- **THEN** the health check SHALL print nothing

#### Scenario: Weak guard
- **GIVEN** a guard allows a known-prohibited case
- **WHEN** the session starts
- **THEN** the health check SHALL warn that protection is weak and leave the guard enabled

### FR-119: Health report

**Statement:** The health check, run as `node hooks/health-check.js --data-dir <dir>`, SHALL report the Node version, each self-test result, disabled guards, recent entries of `hook-health.jsonl`, and recent problem rows of `fsa-log.jsonl`, and with `--clear` truncate only `hook-health.jsonl` after showing it.
**Traces to:** UR-018 | **Priority:** Must | **Status:** Built
**Source:** `hooks/impl/health-check.js`; `skills/health/SKILL.md`

#### Scenario: Report
- **GIVEN** one guard is disabled
- **WHEN** the report runs
- **THEN** the report SHALL list the guard under disabled guards

#### Scenario: Clear
- **GIVEN** `--clear` is passed
- **WHEN** the report finishes
- **THEN** `hook-health.jsonl` SHALL be empty and `fsa-log.jsonl` SHALL be unchanged

### FR-120: Attribution settings report

**Statement:** The health check SHALL report, read-only, when `attribution.commit` or `attribution.pr` is unset or not `""` in the user, project, or local Claude Code settings file, naming the file and key.
**Traces to:** UR-015, UR-018 | **Priority:** Must | **Status:** Built
**Source:** `hooks/impl/health-check.js`; `skills/health/SKILL.md`; `DECISIONS.md` (2026-10-12)

#### Scenario: Unset key
- **GIVEN** no settings file sets `attribution.commit`
- **WHEN** the report runs
- **THEN** the report SHALL name the key and show `{"attribution": {"commit": "", "pr": ""}}`

#### Scenario: Never writes
- **GIVEN** any settings state
- **WHEN** the report runs
- **THEN** the health check SHALL NOT write a settings file

### FR-121: FSA table drift check

**Statement:** The script `scripts/check-fsa-tables.js --check` SHALL exit 1 when the states or transitions in `hooks/lib/fsa-tables.js`, or the test globs in `hooks/lib/fsa-paths.js`, differ from the `## States` tables and the Write scope table in the markdown, when an error class in a `## States` table is outside the closed list, or when an example `fsa` block in the markdown is not a legal run of its table.
**Traces to:** UR-044 | **Priority:** Must | **Status:** Built
**Source:** `scripts/check-fsa-tables.js`

#### Scenario: In sync
- **GIVEN** the code tables match the markdown
- **WHEN** the script runs with `--check`
- **THEN** it SHALL exit 0

#### Scenario: Drift
- **GIVEN** `fsa-tables.js` lists a transition the `reviewer` table does not
- **WHEN** the script runs with `--check`
- **THEN** it SHALL print the difference and exit 1

#### Scenario: Example block outside its table
- **GIVEN** an example `fsa` block in `agents/task-planner.md` whose trace skips a state of the `task-plan` table
- **WHEN** the script runs with `--check`
- **THEN** it SHALL report the illegal transition and exit 1

### FR-122: FSA table check exit codes

**Statement:** The script `scripts/check-fsa-tables.js` SHOULD exit 0 without `--check` even on drift and exit 2 when a file it must read is unreadable.
**Traces to:** UR-044 | **Priority:** Should | **Status:** Built
**Source:** `scripts/check-fsa-tables.js` (header)

#### Scenario: No flag
- **GIVEN** drift exists
- **WHEN** the script runs without `--check`
- **THEN** it SHALL print the comparison and exit 0

#### Scenario: Missing file
- **GIVEN** an agent file named by the script is missing
- **WHEN** the script runs
- **THEN** it SHALL print an error and exit 2

### FR-123: Writing standard sync

**Statement:** The script `scripts/sync-writing-standard.js` SHALL rewrite every `## Report Writing Standard` block in `agents/` and `skills/` from `rules/writing-standard-compact.md`.
**Traces to:** UR-043 | **Priority:** Must | **Status:** Built
**Source:** `scripts/sync-writing-standard.js`; `rules/writing-standard.md`

#### Scenario: Changed rule
- **GIVEN** a bullet changed in the compact file
- **WHEN** the script runs without `--check`
- **THEN** every block in `agents/` and `skills/` SHALL equal the compact file

#### Scenario: Hand edit
- **GIVEN** someone edited one block by hand
- **WHEN** the script runs
- **THEN** it SHALL overwrite that block

### FR-124: Writing standard sync check

**Statement:** The script `scripts/sync-writing-standard.js --check` SHALL exit 1 while any `## Report Writing Standard` block differs from `rules/writing-standard-compact.md`.
**Traces to:** UR-043 | **Priority:** Must | **Status:** Built
**Source:** `CLAUDE.md` (Keeping counts in sync)

#### Scenario: Drifted block
- **GIVEN** one block differs from the compact file
- **WHEN** the script runs with `--check`
- **THEN** it SHALL exit 1

#### Scenario: All equal
- **GIVEN** every block equals the compact file
- **WHEN** the script runs with `--check`
- **THEN** it SHALL exit 0

### FR-125: Terse output style

**Statement:** The plugin MAY provide the output style `assist-plugin:terse`, selected only by the user with `/output-style` and never applied to subagents.
**Traces to:** UR-025 | **Priority:** May | **Status:** Built
**Source:** `output-styles/terse.md`; `README.md` (Writing standard hooks)

#### Scenario: Not selected
- **GIVEN** the user has not selected the style
- **WHEN** a session runs
- **THEN** replies SHALL follow the default style

#### Scenario: Subagent
- **GIVEN** the user selected the style
- **WHEN** a subagent runs
- **THEN** the style SHALL NOT apply to the subagent

### B.7 Drift checks for more tables (built in 1.11.1)

### FR-126: Verdict pairing drift check

**Statement:** The script `scripts/check-fsa-tables.js --check` SHALL exit 1 when `verdictByStep` in `hooks/lib/fsa-tables.js` differs from the verdict named in the Outcome cells of the `Decide` and `Verify` rows of the `## States` table in `agents/intake-reviewer.md`, with the markdown as the source of truth.
**Traces to:** UR-051 | **Priority:** Must | **Status:** Built (1.11.1)
**Source:** `hooks/lib/fsa-tables.js` (`verdictByStep`); `agents/intake-reviewer.md` (`## States` table, Outcome cells: `Decide` gives `accepted` or `needs-changes`, `Verify` gives `clear` or `needs-clarification`); `scripts/check-fsa-tables.js:244-255`; `tests/scripts/check-fsa-tables.test.js`. Accepted limit (the answer to OP-B12 in `plan-deferred-decisions-20261016-1059.md`): the check compares only the `intake-reviewer` pairing. It does not compare the `Done with verdict` pairs in `agents/reviewer.md:51` and `agents/code-reviewer.md:52`, or each table's own `verdict` pattern in `hooks/lib/fsa-tables.js`, and this requirement stays as written.

#### Scenario: Pairing matches
- **GIVEN** `verdictByStep` maps `Decide` to `accepted|needs-changes` and `Verify` to `clear|needs-clarification` as the markdown states
- **WHEN** the script runs with `--check`
- **THEN** it SHALL exit 0

#### Scenario: Pairing drifts
- **GIVEN** `verdictByStep` lets `Verify` give `accepted`
- **WHEN** the script runs with `--check`
- **THEN** it SHALL print the difference, say the markdown wins, and exit 1

#### Scenario: Accepted limit, other verdict patterns
- **GIVEN** the verdict pattern of the `reviewer` table in `hooks/lib/fsa-tables.js` differs from the `Done with verdict` cell in `agents/reviewer.md`
- **WHEN** the script runs with `--check`
- **THEN** the script SHALL exit 0 when no other table drifts, because the check covers `verdictByStep` and the `intake-reviewer` cells only

### FR-127: Task-plan glob drift check

**Statement:** The script `scripts/check-fsa-tables.js --check` SHALL exit 1 when `TASK_PLAN_GLOB` in `hooks/lib/fsa-paths.js` differs from the glob in either of two tables: the table under `### Task-plan glob` in the `## Write guard lists` section of `plugins/assist-plugin/rules/assist-plugin-rule.md`, or the one-row table under `## Write scope` in `agents/task-planner.md`, with the markdown as the source of truth.
**Traces to:** UR-051 | **Priority:** Must | **Status:** Built (1.11.1)
**Source:** `hooks/lib/fsa-paths.js:35` (`TASK_PLAN_GLOB`); `plugins/assist-plugin/rules/assist-plugin-rule.md:442` and `agents/task-planner.md` (both tables created in 1.11.1 per `DECISIONS.md`, 2026-10-14, Write guard lists); `scripts/check-fsa-tables.js:326-339`

#### Scenario: Glob matches
- **GIVEN** `TASK_PLAN_GLOB` is `docs/task-plans/task-plan-*.md` (the glob after FR-186; `task-plan-*.md` at 4803a0d) and both tables hold the same string in backticks in the first column
- **WHEN** the script runs with `--check`
- **THEN** it SHALL exit 0

#### Scenario: Glob drifts
- **GIVEN** `TASK_PLAN_GLOB` is `plan-*.md` and the tables hold `docs/task-plans/task-plan-*.md`
- **WHEN** the script runs with `--check`
- **THEN** it SHALL exit 1 and name `TASK_PLAN_GLOB`

#### Scenario: One table drifts
- **GIVEN** `TASK_PLAN_GLOB` matches the table in `agents/task-planner.md` but the `### Task-plan glob` table holds another string
- **WHEN** the script runs with `--check`
- **THEN** it SHALL exit 1 and name the rule-file table

### FR-128: Protected path drift check

**Statement:** The script `scripts/check-fsa-tables.js --check` SHALL exit 1 when `PROTECTED_GLOBS` or `PROTECTED_FILES` in `hooks/lib/fsa-paths.js` differ from the strings in backticks in the first column of the tables under `### Protected globs` and `### Protected files` in the `## Write guard lists` section of `plugins/assist-plugin/rules/assist-plugin-rule.md`, with the markdown as the source of truth.
**Traces to:** UR-051 | **Priority:** Must | **Status:** Built (1.11.1)
**Source:** `hooks/lib/fsa-paths.js:39-40` (`PROTECTED_GLOBS`, `PROTECTED_FILES`); `plugins/assist-plugin/rules/assist-plugin-rule.md:418-434` (`## Write guard lists`, created in 1.11.1 per `DECISIONS.md`, 2026-10-14); `scripts/check-fsa-tables.js:350-351`

#### Scenario: Paths match
- **GIVEN** `PROTECTED_GLOBS` holds the exact string `**/.agent/main-plan/**` and `PROTECTED_FILES` holds `DECISIONS.md`, and the tables under `### Protected globs` and `### Protected files` list the same strings in backticks in their first column
- **WHEN** the script runs with `--check`
- **THEN** it SHALL exit 0

#### Scenario: Extra protected file
- **GIVEN** `PROTECTED_FILES` lists a file the markdown does not
- **WHEN** the script runs with `--check`
- **THEN** it SHALL exit 1 and name the file

### FR-129: Auto-loaded file drift check

**Statement:** The script `scripts/check-fsa-tables.js --check` SHALL exit 1 when `AUTO_LOADED` in `hooks/lib/fsa-paths.js` differs from the strings in backticks in the first column of the table under `### Auto-loaded names` in the `## Write guard lists` section of `plugins/assist-plugin/rules/assist-plugin-rule.md`, with the markdown as the source of truth.
**Traces to:** UR-051 | **Priority:** Must | **Status:** Built (1.11.1)
**Source:** `hooks/lib/fsa-paths.js:44` (`AUTO_LOADED`); `plugins/assist-plugin/rules/assist-plugin-rule.md:434` (`### Auto-loaded names`, created in 1.11.1 per `DECISIONS.md`, 2026-10-14); `scripts/check-fsa-tables.js:352`

#### Scenario: Names match
- **GIVEN** `AUTO_LOADED` lists `CLAUDE.md`, `CLAUDE.local.md`, and `AGENTS.md` and the table under `### Auto-loaded names` holds the same three strings in backticks
- **WHEN** the script runs with `--check`
- **THEN** it SHALL exit 0

#### Scenario: Name missing in code
- **GIVEN** `AUTO_LOADED` omits `CLAUDE.local.md`
- **WHEN** the script runs with `--check`
- **THEN** it SHALL exit 1 and name `CLAUDE.local.md`

### FR-180: Write guard lists in the markdown

**Statement:** The plugin SHALL hold the write guard lists in markdown tables whose first column gives the exact code string in backticks: four tables in `plugins/assist-plugin/rules/assist-plugin-rule.md`, each under its own subheading of `## Write guard lists` (`### Protected globs`, `### Protected files`, `### Auto-loaded names`, `### Task-plan glob`), and a one-row table for the task-plan glob under `## Write scope` in `agents/task-planner.md`. The task-plan glob in both tables is `docs/task-plans/task-plan-*.md` (FR-186).
**Traces to:** UR-051 | **Priority:** Must | **Status:** Built (1.11.1)
**Source:** `DECISIONS.md` (2026-10-14, Write guard lists live in rules/assist-plugin-rule.md; 2026-10-16, task plans in docs/task-plans/); `plugins/assist-plugin/rules/assist-plugin-rule.md:418-442`; `tests/scripts/check-fsa-tables.test.js`

#### Scenario: Tables present
- **GIVEN** the rule file and the agent file after the change
- **WHEN** a test reads them
- **THEN** the rule file SHALL hold four tables, one under each of the four `###` subheadings of `## Write guard lists`, and the agent file SHALL hold a one-row table under `## Write scope`

#### Scenario: Not in exact code form
- **GIVEN** a first-column cell that gives a path without backticks or in a different form than the code string
- **WHEN** `check-fsa-tables.js --check` parses the table
- **THEN** the script SHALL report the cell and exit 1

### FR-181: Voice-script exemption under the project root and the session directory

**Statement:** The `prose-gate` and `prose-advisor` hooks SHALL exempt `docs/tts/` under the project root, taken from `CLAUDE_PROJECT_DIR`, else the git root found by walking up from the hook's cwd for `.git`, else the hook's cwd, and also under the session's working directory when that directory is inside the project.
**Traces to:** UR-016 | **Priority:** Must | **Status:** Built (1.11.1)
**Source:** `DECISIONS.md` (2026-10-16, docs/tts exemption covers the project root and the session directory, refining 2026-10-12, Prose hooks skip docs/tts); `hooks/lib/prose-diff.js:103-140` (project root, session root, `docs/tts/` test; at 4803a0d it resolved against the hook's cwd only); `skills/voice-script/SKILL.md:162` (saves under the session's working directory); `tests/hooks/prose-docs-tts.test.js`

#### Scenario: Session started in a subdirectory
- **GIVEN** `CLAUDE_PROJECT_DIR` names the project root and the session started in `<project>/src`
- **WHEN** either hook evaluates a write to `<project>/docs/tts/voice-intro-20261012-0900.md` with em dashes, and then a write to `<project>/src/docs/tts/voice-intro-20261012-0900.md`
- **THEN** the hook SHALL treat both files as exempt, the first through the project root and the second through the session directory

#### Scenario: Worktree session
- **GIVEN** the project root is `<project>` and the session runs in the worktree `<project>/.claude/worktrees/feature-a`
- **WHEN** either hook evaluates a write to `<project>/.claude/worktrees/feature-a/docs/tts/voice-intro-20261012-0900.md`
- **THEN** the hook SHALL treat the file as exempt, through the session directory

#### Scenario: No project directory variable
- **GIVEN** `CLAUDE_PROJECT_DIR` is unset and the cwd is inside a git repository
- **WHEN** either hook evaluates a write under the repository's `docs/tts/`
- **THEN** the hook SHALL take the git root, found by walking up for `.git`, as the project root

#### Scenario: Neither available
- **GIVEN** `CLAUDE_PROJECT_DIR` is unset and the cwd is not in a git repository
- **WHEN** either hook evaluates a write to `docs/tts/voice-x.md` relative to the cwd
- **THEN** the hook SHALL take the cwd as the project root

#### Scenario: Session directory outside the project
- **GIVEN** the project root is `<project>` and the session's working directory is `/other/dir`, outside the project
- **WHEN** either hook evaluates a write to `/other/dir/docs/tts/voice-x.md` with an em dash
- **THEN** the hook SHALL add no second root, so `prose-gate` SHALL deny the write

#### Scenario: Other docs path stays gated
- **GIVEN** the same subdirectory session
- **WHEN** `prose-gate` evaluates a write to `<project>/docs/guide.md` with an em dash
- **THEN** the hook SHALL deny the write

### FR-186: Write bar for task-planner moves to docs/task-plans/

**Statement:** The `fsa-write-bar` hook SHALL deny `assist-plugin:task-planner` any path other than a `task-plan-*.md` file directly under `docs/task-plans/` of the git root of the session's working directory (a worktree uses its own root; outside a git repository, the working directory), and any hidden path or auto-loaded file name, and when the hook input has no usable working directory, allowing only a plain relative `docs/task-plans/task-plan-*.md` path and denying absolute, `~`, drive-relative, and `..` targets.
**Traces to:** UR-019, UR-037 | **Priority:** Must | **Status:** Built (1.11.1)
**Source:** `DECISIONS.md` (2026-10-16, Requirements in docs/requirements/; Legacy root documents and the requirements JSON: root-level task plans in older projects stay and are still read, and a rework writes a new file in `docs/task-plans/`; 1.11.1 design points for root notes, change check, and grants: with no usable working directory the hook allows only a plain relative `docs/task-plans/task-plan-*.md`); `hooks/lib/fsa-paths.js:35` (`TASK_PLAN_GLOB`, a root-level `task-plan-*.md` at 4803a0d); `hooks/impl/fsa-write-bar.js:128-164`; `agents/task-planner.md` (Write scope); `tests/hooks/fsa-write-bar-task-plans.test.js`

#### Scenario: New location
- **GIVEN** `task-planner` writes `docs/task-plans/task-plan-auth-20261016-1000.md`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL allow it

#### Scenario: Root-level task plan
- **GIVEN** `task-planner` writes `task-plan-auth-20261016-1000.md` at the git root, whatever `DECISIONS.md` says
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it

#### Scenario: Rework of a legacy root-level plan
- **GIVEN** an older project keeps `./task-plan-shop-20261001-0900.md` at the root and `task-planner` reads it for a rework
- **WHEN** the agent writes the reworked plan to `docs/task-plans/task-plan-shop-20261016-1000.md`, and then tries to overwrite the root-level file
- **THEN** the hook SHALL allow the first write and deny the second

#### Scenario: Nested folder
- **GIVEN** `task-planner` writes `docs/task-plans/old/task-plan-auth.md`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL deny it

#### Scenario: Subdirectory session
- **GIVEN** a session started in `<repo>/src` and `task-planner` writes `<repo>/docs/task-plans/task-plan-auth-20261016-1000.md`, and then `<repo>/src/docs/task-plans/task-plan-auth-20261016-1000.md`
- **WHEN** the hook evaluates each write
- **THEN** the hook SHALL allow the first, which is under the git root, and deny the second

#### Scenario: Worktree session
- **GIVEN** a session in the worktree `<repo>/.claude/worktrees/feature-a` and `task-planner` writes `<repo>/.claude/worktrees/feature-a/docs/task-plans/task-plan-auth.md`, and then `<repo>/docs/task-plans/task-plan-auth.md`
- **WHEN** the hook evaluates each write
- **THEN** the hook SHALL allow the first, which is under the worktree's own root, and deny the second

#### Scenario: No usable working directory, plain relative path
- **GIVEN** the hook input has no usable working directory and `task-planner` writes `docs/task-plans/task-plan-auth-20261016-1000.md`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL allow it

#### Scenario: No usable working directory, forbidden targets
- **GIVEN** the hook input has no usable working directory and `task-planner` writes `/tmp/docs/task-plans/task-plan-a.md`, `~/docs/task-plans/task-plan-a.md`, `C:docs/task-plans/task-plan-a.md`, and `../docs/task-plans/task-plan-a.md`
- **WHEN** the hook evaluates each write
- **THEN** the hook SHALL deny all four

### FR-198: Program-name detection for the documentation CLI guard and the injection filter

**Statement:** The `doc-cli-guard` and `injection-filter` hooks SHALL find the program of a Bash or PowerShell command by removing the directory part with either `/` or `\` and a `.exe` suffix from the program word, by treating the package runners `npx`, `npm exec`, `pnpx`, `pnpm dlx`, `yarn dlx`, `bunx`, `bun x`, and `node <path>` as wrappers, by treating `exec`, `sudo` (with its value options, such as `-u root`), and `eval` as wrappers too (`DECISIONS.md:198-201`), as `env` and `timeout` already are, and by removing an `@version` suffix from the program name, matching a PowerShell program name without regard to case and keeping Bash matching as built (case-sensitive) (`DECISIONS.md:168-171`).
**Traces to:** UR-020, UR-021 | **Priority:** Must | **Status:** PLANNED (1.12.0)
**Source:** `hooks/impl/doc-cli-guard.js:64-66` and `hooks/impl/injection-filter.js:52` (remove the part before the last `/` only at 1.11.1, so `ctx7.exe` and `C:\tools\ctx7` are not recognized); `hooks/lib/shell-program.js:11-19` (wrappers `env`, `command`, `timeout`, `nice`, `nohup`, `stdbuf`, `time`; no package runner at 1.11.1); `hooks/impl/commit-attribution-guard.js:351-353` (already strips a directory with either separator and a `.exe` suffix); `DECISIONS.md:138-141` (2026-10-16, Documentation CLI guard and injection filter cover PowerShell and launchers), `DECISIONS.md:198-201` (`doc-cli-guard` is a best-effort string-matching guard and Claude Code's permission prompts remain the primary control; the PowerShell assignment-before-hidden-name form is closed; program words from variables, brace expansion, globs, and programs that run other programs such as `xargs`, `find -exec`, and `watch` are known gaps, and a bypass form found later is added to that list), and `DECISIONS.md:153-156` (the wrappers also include `npm exec`, `pnpx`, `yarn dlx`, and `bun x`); the answers to OP-B9 and OP-B10 in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Windows path and suffix
- **GIVEN** the command `C:\tools\ctx7.exe login`
- **WHEN** `doc-cli-guard` evaluates it
- **THEN** the hook SHALL read the program as `ctx7` and deny it

#### Scenario: Package runner with a version
- **GIVEN** the command `npx -y ctx7@latest docs /org/project "routing" -o out.md`
- **WHEN** `doc-cli-guard` evaluates it
- **THEN** the hook SHALL read the program as `ctx7` and deny it for the output flag

#### Scenario: Other runners
- **GIVEN** the commands `bunx firecrawl env`, `pnpm dlx ctx7 setup`, `node ./node_modules/.bin/ctx7 login`, `npm exec ctx7 login`, `pnpx ctx7 login`, `yarn dlx firecrawl env`, and `bun x ctx7 setup`
- **WHEN** `doc-cli-guard` evaluates each
- **THEN** the hook SHALL deny all seven

#### Scenario: Filter reads the same program
- **GIVEN** a Bash result from `npx firecrawl scrape https://example.com` and a PowerShell result from `curl.exe https://example.com`
- **WHEN** `injection-filter` runs
- **THEN** the filter SHALL treat both as results of `firecrawl` and `curl`

#### Scenario: Exec, sudo, and eval wrappers (PLANNED, 1.12.0)
- **GIVEN** the Bash commands `exec ctx7 login`, `sudo -u root ctx7 login`, and `eval ctx7 login`
- **WHEN** `doc-cli-guard` evaluates each
- **THEN** the hook SHALL read the program as `ctx7` in all three and deny all three

#### Scenario: Case in PowerShell
- **GIVEN** the PowerShell command `C:\Tools\CTX7.EXE login`
- **WHEN** `doc-cli-guard` evaluates it
- **THEN** the hook SHALL read the program as `ctx7` and deny it

#### Scenario: Case in Bash stays as built
- **GIVEN** the Bash commands `CTX7 login` and `CTX7.EXE login`
- **WHEN** `doc-cli-guard` evaluates each
- **THEN** the hook SHALL NOT read the program as `ctx7` and SHALL allow both, as built, because Bash matching is case-sensitive

#### Scenario: Runner for another program
- **GIVEN** the command `npx vite build`
- **WHEN** `doc-cli-guard` evaluates it
- **THEN** the hook SHALL read the program as `vite` and allow it with no output

## 4. Area C: skills, manifests, and repository documents

### C.1 Skill catalog

### FR-130: Skill catalog

**Statement:** The plugin SHALL ship 22 skills, of which 18 are user-invocable (`do`, `ask`, `debug`, `bump`, `pr-review`, `commit`, `branch`, `map-project`, `technical-writing`, `review-md`, `gather-requirements`, `spec-from-requirements`, `task-plan`, `create-test`, `health`, `deslop`, `voice-script`, `clarify`) and 4 are internal (`code`, `pentest`, `integrated-test`, `run-test`).
**Traces to:** UR-042, UR-045 | **Priority:** Must | **Status:** Built
**Source:** `CLAUDE.md` (Skills); `docs/SPECIFICATION.md`; `skills/*/SKILL.md` frontmatter

#### Scenario: Counts
- **GIVEN** the `skills/` directory
- **WHEN** a test counts the `SKILL.md` files
- **THEN** the count SHALL be 22

#### Scenario: Internal skills
- **GIVEN** the four internal skill files
- **WHEN** a test reads their frontmatter
- **THEN** each SHALL set `user-invocable: false`

#### Scenario: Count drift
- **GIVEN** a 23rd `SKILL.md` that the documents do not list
- **WHEN** a test compares the count with 22
- **THEN** the test SHALL report the mismatch

### C.2 Question, diagnosis, and git skills

### FR-131: Ask from the repository

**Statement:** The `/ask` skill SHALL answer a question from files found with Grep and Glob, cite each source with a relative path, and say so when the repository holds no answer.
**Traces to:** UR-026 | **Priority:** Must | **Status:** Built
**Source:** `skills/ask/SKILL.md`; `skills/ask/references/answer-format.md`

#### Scenario: Answer found
- **GIVEN** the repository documents how `debug` routes subcommands
- **WHEN** the user runs `/ask how does the debug skill route subcommands?`
- **THEN** the skill SHALL answer with a link to `skills/debug/SKILL.md`

#### Scenario: No answer
- **GIVEN** the repository holds no answer
- **WHEN** the user asks
- **THEN** the skill SHALL say the repository has no answer, SHALL NOT guess, and SHALL suggest `--web`

### FR-132: Ask with web research

**Statement:** The `/ask --web` skill SHOULD run the repository search first, add WebSearch results when the repository is incomplete, confirm claims with WebFetch on the top 1 to 3 results, and label which source backs each claim.
**Traces to:** UR-026 | **Priority:** Should | **Status:** Built
**Source:** `skills/ask/SKILL.md` (Repo + web)

#### Scenario: External question
- **GIVEN** a question about an external SDK
- **WHEN** the user runs `/ask --web`
- **THEN** the skill SHALL cite full URLs for web claims

#### Scenario: Conflict
- **GIVEN** the repository and the web disagree
- **WHEN** the skill combines them
- **THEN** the skill SHALL give the repository context priority

### FR-133: Debug routing and fix gate

**Statement:** The `/debug` skill SHALL route `analyze`, `fix`, and `review` to their references and refuse `fix` unless an approved RCA or a human-report file exists.
**Traces to:** UR-027 | **Priority:** Must | **Status:** Built
**Source:** `skills/debug/SKILL.md`

#### Scenario: Fix without RCA
- **GIVEN** no approved RCA and no human-report file
- **WHEN** the user runs `/debug fix`
- **THEN** the skill SHALL halt and say "Fix requires an approved RCA (`/debug analyze` first) or human-report file."

#### Scenario: No subcommand
- **GIVEN** an empty or unmatched first argument
- **WHEN** the user runs `/debug`
- **THEN** the skill SHALL ask which mode

### FR-134: Debug analyze is read-only

**Statement:** The `/debug analyze` subcommand SHALL produce an RCA report and change no code.
**Traces to:** UR-027 | **Priority:** Must | **Status:** Built
**Source:** `skills/debug/SKILL.md` (Constraints)

#### Scenario: Analyze
- **GIVEN** a bug description
- **WHEN** the user runs `/debug analyze`
- **THEN** the skill SHALL write an RCA using the RCA template and edit no source file

#### Scenario: Dependency bug
- **GIVEN** the root cause is in a dependency
- **WHEN** the skill reports
- **THEN** the skill SHALL report it and SHALL NOT patch the dependency

### FR-135: Conventional commits

**Statement:** The `/commit` skill SHALL compose messages as `<type>(<scope>): <subject>` with an imperative, present-tense subject of at most 50 characters and no trailing period.
**Traces to:** UR-028 | **Priority:** Must | **Status:** Built
**Source:** `skills/commit/SKILL.md`

#### Scenario: Valid message
- **GIVEN** staged changes to the auth module
- **WHEN** the user runs `/commit`
- **THEN** the message SHALL read like `feat(auth): implement JWT-based authentication`

#### Scenario: Explicit message
- **GIVEN** the user passes `fix: handle null user`
- **WHEN** the skill commits
- **THEN** the skill SHALL use that type and subject

### FR-136: Commit messages carry no AI attribution

**Statement:** The `/commit` and `/bump` skills SHALL leave every AI attribution line out of the commit message they compose, including when Claude Code's attribution setting asks for one.
**Traces to:** UR-015, UR-028, UR-029 | **Priority:** Must | **Status:** Built (1.11.1); PLANNED (1.12.0): the git-identity scenario
**Source:** `skills/commit/SKILL.md` (No AI Attribution; the identity rule at line 94 has no requirement at 1.11.1); `skills/bump/SKILL.md` (Commit and Tag); `DECISIONS.md` (2026-10-12); the answer to OP-11a in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Setting asks for a trailer
- **GIVEN** `attribution.commit` is unset
- **WHEN** the skill writes the message
- **THEN** the message SHALL carry no Co-Authored-By trailer for an AI tool and the skill SHALL tell the user once about the `{"attribution": {"commit": "", "pr": ""}}` setting

#### Scenario: Human co-author
- **GIVEN** the user asks for a human co-author
- **WHEN** the skill writes the message
- **THEN** the message MAY carry that human's Co-Authored-By trailer

#### Scenario: Developer's own git identity (PLANNED, 1.12.0)
- **GIVEN** the repository's git configuration names the developer as the user
- **WHEN** `/commit` or `/bump` creates a commit
- **THEN** the commit SHALL use the developer's own git identity, and the skill SHALL NOT set an AI identity in git config or pass one through `--author` or `-c`

### FR-137: Version detection and bump type

**Statement:** The `/bump` skill SHOULD detect the version from `package.json`, `pyproject.toml`, `Cargo.toml`, `pubspec.yaml`, a `VERSION` file, or the latest `v*` or `release-*` tag, in that order and not from `.claude-plugin/plugin.json`, refuse a bump only when the tag of the current version points at HEAD (under `--path`, the tag fallback and this refusal use the `<tagdir>-v*` tags of FR-139), and in `auto` mode choose major for `BREAKING CHANGE:`, minor for `feat:`, and patch otherwise.
**Traces to:** UR-029 | **Priority:** Should | **Status:** Built (1.11.1); PLANNED (1.12.0): the refusal rule and the corrected plugin.json example
**Source:** `skills/bump/SKILL.md:35-41` (detection order, no `plugin.json`), `:106` (refuses when the current version matches the tag at HEAD); `skills/bump/references/bump-strategy.md:183` (shows `.claude-plugin/plugin.json` updated, which the detection order omits), `:191-196` (refuses when the version has a tag at all); the answers to OP-7a and OP-7d in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Auto minor
- **GIVEN** commits since the last tag include `feat:` and no breaking change
- **WHEN** the user runs `/bump auto`
- **THEN** the skill SHALL bump the minor version

#### Scenario: Nothing to release
- **GIVEN** no commits since the last release
- **WHEN** the user runs `/bump auto`
- **THEN** the skill SHALL report an error and bump nothing

#### Scenario: Current version tag at HEAD (PLANNED, 1.12.0)
- **GIVEN** `package.json` holds 1.2.0 and the tag `v1.2.0` points at HEAD
- **WHEN** the user runs `/bump patch`
- **THEN** the skill SHALL refuse with an error that the version is already released and bump nothing

#### Scenario: Current version tag behind HEAD (PLANNED, 1.12.0)
- **GIVEN** `package.json` holds 1.2.0, the tag `v1.2.0` exists, and HEAD is two commits past it
- **WHEN** the user runs `/bump patch`
- **THEN** the skill SHALL NOT refuse because of that tag and SHALL bump to 1.2.1

#### Scenario: Tag lookups under --path (PLANNED, 1.12.0)
- **GIVEN** `/bump patch --path ./services/auth`, no version file under that path, and the tags `services-auth-v1.1.0` and `v2.0.0`
- **WHEN** the skill falls back to the latest tag and checks the HEAD tag
- **THEN** the skill SHALL read the version from the latest `services-auth-v*` tag (1.1.0), SHALL ignore `v2.0.0`, and SHALL refuse only when `services-auth-v1.1.0` points at HEAD

#### Scenario: Plugin manifest is not a version source (PLANNED, 1.12.0)
- **GIVEN** a repository whose only version file is `.claude-plugin/plugin.json`
- **WHEN** the skill detects the version
- **THEN** the skill SHALL NOT read the manifest and SHALL fall back to the latest `v*` or `release-*` tag, and the `bump-strategy.md` example SHALL NOT show `.claude-plugin/plugin.json` as an updated file

### FR-138: Changelog generation

**Statement:** The `/bump` skill SHOULD update every detected version file and, unless `--no-changelog` is passed, add a changelog entry headed `## [X.Y.Z] - date` with commits grouped under Breaking Changes, Features, Bug Fixes, and Other, writing the entry into the file a pointer-only `CHANGELOG.md` points to (FR-200 defines the pointer and bounds the follow).
**Traces to:** UR-029 | **Priority:** Should | **Status:** Built (1.11.1); PLANNED (1.12.0): the `--no-changelog` argument hint (a plain fix, OP-7c) and the pointer follow-up
**Source:** `skills/bump/SKILL.md:15` (the argument hint omits `--no-changelog`, which `:91` documents), `:107` (changelog in the project root or the `--path` directory); `plugins/assist-plugin/CHANGELOG.md` (a pointer to the root `CHANGELOG.md`, FR-178); `DECISIONS.md` (2026-10-16, /bump --path naming and pointer changelogs); the plain fix OP-7c and the answer on the pointer follow-up in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Minor bump
- **GIVEN** `package.json` holds 1.2.0, a `feat:` commit exists, and `CHANGELOG.md` holds release headings (FR-200)
- **WHEN** the user runs `/bump minor`
- **THEN** the skill SHALL write 1.3.0 and add a dated `## [1.3.0]` entry with the feature under Features, in that `CHANGELOG.md`

#### Scenario: Path option
- **GIVEN** the user passes `--path ./backend`
- **WHEN** the skill runs
- **THEN** the skill SHALL bump only the version files under `./backend`

#### Scenario: Version file cannot be written
- **GIVEN** one detected version file is read-only
- **WHEN** the user runs `/bump patch`
- **THEN** the skill SHALL update no version file, because it updates all detected files atomically

#### Scenario: Argument hint (PLANNED, 1.12.0)
- **GIVEN** the frontmatter of `skills/bump/SKILL.md` after the change
- **WHEN** a test reads `argument-hint`
- **THEN** it SHALL list `--no-changelog` beside `--path`, `--no-tag`, and `--no-commit`

#### Scenario: No changelog (PLANNED, 1.12.0)
- **GIVEN** `--no-changelog`
- **WHEN** the bump finishes
- **THEN** the skill SHALL update the version files, SHALL write no changelog entry, and SHALL still commit and tag unless the other flags say otherwise

#### Scenario: Pointer changelog under --path (PLANNED, 1.12.0)
- **GIVEN** `/bump minor --path ./plugins/assist-plugin`, a `VERSION` file under `./plugins/assist-plugin/` as the version source (the plugin has none today, and `.claude-plugin/plugin.json` is not a version source, FR-137), and `./plugins/assist-plugin/CHANGELOG.md` is a pointer to the root `CHANGELOG.md`
- **WHEN** the skill writes the changelog entry
- **THEN** the skill SHALL write the `## [X.Y.Z]` entry into the root `CHANGELOG.md` and SHALL NOT add a release heading to the pointer file

### FR-200: Pointer changelog definition and bounded follow

**Statement:** The `/bump` skill SHALL write the changelog entry in place in every `CHANGELOG.md` except one with no `## [x.y.z]` heading that holds a relative link to a local file, and for that exception it follows the link one hop only when the file is a pointer (exactly one such link, to a file named `CHANGELOG.md`, that resolves inside the git root and is neither a hidden path, an auto-loaded file (`CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`), nor itself a pointer) and otherwise stops and asks the user to write the entry in place, name another target that passes the same checks, or skip the changelog, and then continues the same run with the answer (`DECISIONS.md:188-191`); only relative links to local files count as links, so external links (such as `https://keepachangelog.com`) never trigger the exception.
**Traces to:** UR-029 | **Priority:** Must | **Status:** PLANNED (1.12.0)
**Source:** `DECISIONS.md:123-126` (2026-10-16, /bump --path naming and pointer changelogs: write the release entry into the file the pointer points to); `plugins/assist-plugin/CHANGELOG.md:3` (a pointer to the root `CHANGELOG.md`, FR-178); FR-138

#### Scenario: One hop to the root changelog
- **GIVEN** `./plugins/assist-plugin/CHANGELOG.md` holds no `## [x.y.z]` heading and one link to `../../CHANGELOG.md`, which resolves inside the git root
- **WHEN** `/bump` prepares the changelog entry
- **THEN** the skill SHALL follow the link and write the entry into the root `CHANGELOG.md`

#### Scenario: Pointer target not allowed
- **GIVEN** a pointer `CHANGELOG.md` whose one link resolves to `../../../outside/CHANGELOG.md` outside the git root, or to a hidden path such as `.hidden/CHANGELOG.md`
- **WHEN** the skill prepares the changelog entry
- **THEN** the skill SHALL write nothing to the target, stop, and ask the user

#### Scenario: Not a pointer
- **GIVEN** a `CHANGELOG.md` with no `## [x.y.z]` heading and two relative links to local files named `CHANGELOG.md`
- **WHEN** the skill prepares the changelog entry
- **THEN** the skill SHALL NOT treat it as a pointer, SHALL follow no link, and SHALL stop and ask the user

#### Scenario: Changelog with release headings
- **GIVEN** a `CHANGELOG.md` with `## [1.2.0]` and `## [1.1.0]` headings and a relative link to `docs/HISTORY.md`
- **WHEN** the skill prepares the changelog entry
- **THEN** the skill SHALL write the `## [X.Y.Z]` entry in that file and follow no link

#### Scenario: Fresh Keep a Changelog file with external links only
- **GIVEN** a new `CHANGELOG.md` with no `## [x.y.z]` heading whose only links are `https://keepachangelog.com/en/1.1.0/` and `https://semver.org/spec/v2.0.0.html`
- **WHEN** the skill prepares the changelog entry
- **THEN** the skill SHALL write the entry in that file, because external links are not links to local files, and SHALL NOT stop or ask

#### Scenario: Stop offers three answers and the run continues (PLANNED, 1.12.0)
- **GIVEN** `/bump minor` stopped on a `CHANGELOG.md` whose pointer chain fails the checks
- **WHEN** the user answers "name another target" with `docs/CHANGELOG.md`, which passes the same checks, or "write in place", or "skip the changelog"
- **THEN** `/bump` SHALL continue the same run: write the entry into `docs/CHANGELOG.md`, or in place in the stopped file, or write no entry and still update the version files, and SHALL NOT restart or end the run

#### Scenario: Link to another file name
- **GIVEN** a `CHANGELOG.md` with no `## [x.y.z]` heading and one relative link to the local file `docs/HISTORY.md`
- **WHEN** the skill prepares the changelog entry
- **THEN** the skill SHALL NOT treat it as a pointer, SHALL follow no link, and SHALL stop and ask the user

#### Scenario: Pointer chain
- **GIVEN** a pointer whose target is itself a pointer
- **WHEN** the skill follows the first hop
- **THEN** the skill SHALL follow no second hop, and SHALL stop and ask the user

### FR-139: Bump commit and tag

**Statement:** The `/bump` skill SHOULD commit with the message `chore: bump version to X.Y.Z` and tag `vX.Y.Z` (or `release-X.Y.Z` when the repository uses that form) unless `--no-commit` or `--no-tag` is passed, with `--path` committing `chore: bump <dir> to X.Y.Z` and tagging `<tagdir>-vX.Y.Z`, and with `--no-commit` creating no tag. `<dir>` is the path relative to the repository root with a leading `./` and a trailing `/` removed and `\` read as `/`, taken only after it passes the validation of FR-209 (the three ordered steps: normalize, validate, then name; the validation also refuses a segment that starts with `.` or contains `..`, because such a segment gives an invalid git tag name, `DECISIONS.md:253-256`), and `<tagdir>` is `<dir>` with every `/` replaced by `-`.
**Traces to:** UR-029 | **Priority:** Should | **Status:** Built (1.11.1) for the default commit and tag; PLANNED (1.12.0): the `--path` naming and the no-tag rule for `--no-commit`; Built (1.13.0): the `--path` value passes the validation of FR-209 before `<dir>` and `<tagdir>` are built (`skills/bump/SKILL.md:82`, `:117-149`), including the R8 refusal of a dot-leading or `..`-holding segment
**Source:** `skills/bump/SKILL.md` (Commit and Tag, `:119`, `:123-127`); `skills/bump/references/bump-strategy.md:263` (`subproject-v1.1.0` or `v1.1.0-subproject`), `:275-276` (`chore: bump services/auth to 1.1.0`, `services-auth-v1.1.0`); `DECISIONS.md` (2026-10-16, /bump --path naming and pointer changelogs); the answers to OP-7b and OP-7e in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Default
- **GIVEN** no flags
- **WHEN** the bump finishes
- **THEN** the skill SHALL create the commit and the `vX.Y.Z` tag

#### Scenario: No tag
- **GIVEN** `--no-tag`
- **WHEN** the bump finishes
- **THEN** the skill SHALL commit and create no tag

#### Scenario: No commit
- **GIVEN** `--no-commit`
- **WHEN** the bump finishes
- **THEN** the skill SHALL create no commit and (PLANNED, 1.12.0) no tag

#### Scenario: Path commit and tag (PLANNED, 1.12.0)
- **GIVEN** `/bump minor --path ./services/auth` and a new version 1.1.0
- **WHEN** the bump finishes
- **THEN** the skill SHALL commit `chore: bump services/auth to 1.1.0` and tag `services-auth-v1.1.0`

#### Scenario: Path spelled with a backslash and trailing separator (PLANNED, 1.12.0)
- **GIVEN** `/bump patch --path .\services\auth\` and a new version 1.1.1
- **WHEN** the bump finishes
- **THEN** `<dir>` SHALL be `services/auth`, the commit SHALL read `chore: bump services/auth to 1.1.1`, and the tag SHALL be `services-auth-v1.1.1`

#### Scenario: Default naming without --path
- **GIVEN** `/bump minor` at the repository root and a new version 1.3.0
- **WHEN** the bump finishes
- **THEN** the skill SHALL commit `chore: bump version to 1.3.0` and tag `v1.3.0`

#### Scenario: Invalid path builds no name (Built, 1.13.0)
- **GIVEN** `/bump patch --path "svc; touch x"`
- **WHEN** the skill reads the value
- **THEN** the skill SHALL build no `<dir>`, make no commit, and create no tag, and FR-209 SHALL decide the stop

#### Scenario: Absolute path outside the git root (Built, 1.13.0)
- **GIVEN** `/bump patch --path /etc/other` and a git root of `/home/user/repo`
- **WHEN** the skill reads the value
- **THEN** the skill SHALL stop at the validation step of FR-209, name the rule broken, and build no `<dir>` or `<tagdir>`

#### Scenario: Dot-leading segment builds no tag name (Built, 1.13.0)
- **GIVEN** `/bump patch --path .github/workflows` or `--path a..b`
- **WHEN** the skill reads the value
- **THEN** the skill SHALL stop with the R8 message before any file, commit, or tag changes, and build no `<dir>` or `<tagdir>`, because the segment would give an invalid git tag name (`DECISIONS.md:253-256`)

### FR-140: Branch create, switch, and list

**Statement:** The `/branch` skill SHOULD create `feature/`, `bugfix/`, `release/`, and `hotfix/` branches, switch branches with a stash of uncommitted changes when needed, and list local and remote branches.
**Traces to:** UR-030 | **Priority:** Should | **Status:** Built
**Source:** `skills/branch/SKILL.md`

#### Scenario: Create
- **GIVEN** a clean repository
- **WHEN** the user runs `/branch create feature/user-auth`
- **THEN** the skill SHALL create and switch to `feature/user-auth`

#### Scenario: Switch with changes
- **GIVEN** uncommitted changes
- **WHEN** the user runs `/branch switch main`
- **THEN** the skill SHALL stash the changes before it switches

#### Scenario: Name outside the conventions
- **GIVEN** the user asks for a bug-fix branch named `null-pointer`
- **WHEN** the skill creates it
- **THEN** the skill SHALL follow the naming conventions and create `bugfix/null-pointer`

### FR-141: Branch cleanup guards

**Statement:** The `/branch cleanup` skill SHALL remove only linked worktrees whose branch or detached commit is an ancestor of the default branch, whose status is clean including untracked files, and that are unlocked, leaving the main worktree, the current worktree, and the default, `main`, `master`, and `develop` branches untouched.
**Traces to:** UR-030 | **Priority:** Must | **Status:** Built
**Source:** `skills/branch/SKILL.md`; `rules/assist-plugin-rule.md` (Worktree and Cache Cleanup)

#### Scenario: Dry run
- **GIVEN** `--dry-run`
- **WHEN** the skill runs
- **THEN** the skill SHALL list what would happen and change nothing

#### Scenario: Squash-merged branch
- **GIVEN** a branch that was squash-merged and shows as `not merged`
- **WHEN** the skill runs
- **THEN** the skill SHALL keep the worktree and the branch and say why

### C.3 Pull request, mapping, and writing skills

### FR-142: PR platform detection and fetch

**Statement:** The `/pr-review` skill SHALL detect GitHub, Bitbucket Cloud, or Bitbucket Server from `git remote -v`, identify the PR by number, current branch, or branch name, and fetch title, description, author, state, changed files, comments, reviewers, and conflicts; on a Bitbucket remote (Cloud or Data Center) it SHALL do so with the bkt command forms of FR-202 and the host pin of FR-203; the conflicts item applies to GitHub only, because the research found no bkt form for conflicts, and on Bitbucket the skill SHALL say so and point to the Merge check section of the PR (section 9, open point 8).
**Traces to:** UR-031, UR-054 | **Priority:** Must | **Status:** Built; Built (1.13.0): the Bitbucket forms (FR-202, FR-203; `skills/pr-review/SKILL.md:45-69`, `:165-227`, with the conflicts item for GitHub only at `:91`); Built (1.12.0): the GitHub detection and fetch
**Source:** `skills/pr-review/SKILL.md`; `skills/pr-review/references/pr-detection.md`; `.agent/research/bkt-cli-forms-20261017.md` (plugin forms mapped to v0.34.0)

#### Scenario: GitHub
- **GIVEN** the remote is `https://github.com/user/repo.git`
- **WHEN** the user runs `/pr-review 123`
- **THEN** the skill SHALL use the `gh` CLI

#### Scenario: Own PR
- **GIVEN** the PR belongs to the current user
- **WHEN** the user runs `/pr-review`
- **THEN** the skill SHALL return an error

#### Scenario: Bitbucket Cloud remote (Built, 1.13.0)
- **GIVEN** the remote is `https://bitbucket.org/acme/repo.git` and the user runs `/pr-review 123`
- **WHEN** the skill detects the platform
- **THEN** the skill SHALL use `bkt` with the Cloud forms of FR-202 and SHALL run the host pin of FR-203 before the first `bkt pr` call

#### Scenario: Bitbucket Data Center remote (Built, 1.13.0)
- **GIVEN** a remote on a Bitbucket Data Center host and a `bkt` context for that host
- **WHEN** the user runs `/pr-review 123`
- **THEN** the skill SHALL use `bkt` with the Data Center forms of FR-202, and SHALL NOT describe the platform as one that needs custom SSH or HTTPS scripts

#### Scenario: PR found by branch on Bitbucket (Built, 1.13.0)
- **GIVEN** the user runs `/pr-review feature/auth` on a Bitbucket remote
- **WHEN** the skill looks for the PR
- **THEN** the skill SHALL use `bkt pr list` with `--state OPEN --limit 0 --json` and a `--jq` filter and SHALL NOT use a `--query` flag, because bkt has none (FR-202)

### FR-143: PR verdict confirmation

**Statement:** The `/pr-review` skill SHALL run `--approve`, `--changes-requested`, `--comment`, `bkt pr approve`, the Bitbucket comment submission (`bkt pr comment`), or the Bitbucket Cloud request-changes call (`bkt api`, FR-202) only after the user answers yes to "Do you approve this verdict? (yes/no)" for the drafted verdict, even when the flag was passed or the `reviewer` agent chose the verdict; declining a PR is a manual choice outside the skill's verdict mapping.
**Traces to:** UR-031 | **Priority:** Must | **Status:** Built (1.11.1); Built (1.12.0): the no-override-flag rule, and `skills/pr-review/SKILL.md:87` stops mapping `--changes-requested` to `bkt pr decline` (a returned verdict posts a comment on Bitbucket and leaves the PR open; `DECISIONS.md:163-166`, FR-195). The 1.12.0 conformance covered the other places that named `bkt pr decline` at 1.11.1: `skills/pr-review/SKILL.md:209` and `skills/pr-review/references/review-workflow.md:25`, `:37`, `:340`. The bounded `/do` exception of `DECISIONS.md:178-181` is withdrawn by `DECISIONS.md:183-186`: `/pr-review` always confirms on its own, and `/do` posts a `/do` PR review itself without calling `/pr-review` (FR-195). `skills/pr-review/SKILL.md:41` says that a pre-supplied flag does not skip the confirmation, `:82` and `:203` say that the confirmation holds even when the `reviewer` agent drafted the verdict, and `skills/pr-review/references/review-workflow.md:25` to `:29` say that it holds when the flag was pre-supplied or the `reviewer` is confident. `skills/pr-review/SKILL.md:208` is the Review Output Rules paragraph (heading at `:206`; `:209` is blank) and says nothing about the confirmation (version 1.2 of this document cited `:41` and `:209` for the reviewer-drafted case; version 1.3 corrects the citations, read on 2026-10-17). The Bitbucket comment for a returned verdict, with `bkt pr decline` no longer mapped, is in the 1.12.0 `skills/pr-review/SKILL.md:87` and `:93`. The no-override-flag rule is an absence, not a stated line: no override flag appears in `skills/pr-review/` (read on 2026-10-17). Both are Built (1.12.0). Built (1.13.0): the Bitbucket forms follow FR-202 (`skills/pr-review/SKILL.md:104-126`, `:229-242`); on Bitbucket Cloud a confirmed `--changes-requested` posts the findings as a comment and then makes the request-changes call, and on Data Center it posts the comment and leaves the PR open (the user's answer to the request-changes point in the version 1.3 elicitation, recorded at `DECISIONS.md:223-226`, which replaces the comment-only rule of `DECISIONS.md:163-166` for Cloud and leaves it in force for Data Center). On Cloud the order is: post the findings as a comment, then make the request-changes call; no request-changes call runs when the comment fails; that order is recorded at `DECISIONS.md:228-231` (section 9, open point 3, closed). On Bitbucket the body-hash check runs as its own command before `bkt pr approve`, so a body file changed after the confirmation stops the post before any approval; the comment command repeats the check, and a change caught there is reported as a failed comment while the approval stands (`DECISIONS.md:263-266`; `skills/pr-review/SKILL.md:231-242`). Each bkt post runs as its own Bash command with its own hook prompt, and a rejected first prompt of a pair runs no second command and records both as declined (`DECISIONS.md:233-236`). A search for the literal `bkt pr decline` did not match `review-workflow.md:130` or `:339`, which the spec step re-reads
**Source:** `skills/pr-review/SKILL.md` (Review Submission, Constraints; line 139 shows `bkt pr comment --message-file`; the `bkt` command forms in `/pr-review`'s references do not match the bkt CLI v0.34.0 (numeric id with `--project` and `--repo` flags, `bkt pr view`, `bkt pr comments`, and `bkt pr comment --text`), and correcting them was the follow-up of `DECISIONS.md:208-211`, now FR-202; lines 207-208 mention an unnamed optional override flag for an already approved or declined PR at 1.11.1); the answer to OP-8 in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Flag supplied
- **GIVEN** the user runs `/pr-review 123 --approve`
- **WHEN** the skill drafts its verdict
- **THEN** the skill SHALL ask for confirmation before it runs any state-changing command

#### Scenario: Pre-supplied flag still asks
- **GIVEN** `/pr-review 123 --approve` or `--changes-requested`, whether typed by the user or passed by an agent
- **WHEN** the skill drafts its verdict
- **THEN** the skill SHALL ask "Do you approve this verdict? (yes/no)" before any state-changing command, with no exception for a `/do` PR review (`DECISIONS.md:183-186`)

#### Scenario: No override flag (Built, 1.12.0)
- **GIVEN** a PR that is already approved or declined
- **WHEN** the user runs `/pr-review` on it
- **THEN** the skill SHALL accept no flag that overrides the state, and `skills/pr-review/SKILL.md` SHALL NOT mention such a flag

#### Scenario: User declines
- **GIVEN** the user answers no
- **WHEN** the skill continues
- **THEN** the skill SHALL revise the draft and re-confirm and SHALL NOT run the command

#### Scenario: Changes requested on Bitbucket Data Center (Built, 1.12.0)
- **GIVEN** a Bitbucket Data Center remote and the user runs `/pr-review 123 --changes-requested` and answers yes to the confirmation
- **WHEN** the skill submits
- **THEN** the skill SHALL post a comment with the findings, leave the PR open, and run no `bkt pr decline` (`DECISIONS.md:163-166`)

#### Scenario: Changes requested on Bitbucket Cloud (Built, 1.13.0)
- **GIVEN** a `bitbucket.org` remote and the user runs `/pr-review 123 --changes-requested` and answers yes to the confirmation
- **WHEN** the skill submits
- **THEN** the skill SHALL post the findings as a comment, then make the Cloud request-changes call through `bkt api` with a relative path (FR-202), and SHALL run no `bkt pr decline`

#### Scenario: Citations of the confirmation rule
- **GIVEN** this requirement after the version 1.3 correction
- **WHEN** a reviewer compares it with `skills/pr-review/SKILL.md`
- **THEN** the reviewer SHALL find the reviewer-drafted case at `:82` and `:203`, the pre-supplied flag at `:41`, and no confirmation text at `:208`, the Review Output Rules paragraph

#### Scenario: Cloud comment fails (Built, 1.13.0)
- **GIVEN** a `bitbucket.org` remote, a confirmed `--changes-requested` verdict, and a `bkt pr comment` call that exits with an error
- **WHEN** the skill submits
- **THEN** the skill SHALL make no request-changes call, SHALL show the draft and the error, and SHALL NOT retry

#### Scenario: Request-changes call fails after the comment (Built, 1.13.0)
- **GIVEN** the comment posted and the `bkt api` request-changes call exits with an error
- **WHEN** the skill reports
- **THEN** the skill SHALL say that the comment is posted and the request-changes call failed, and SHALL NOT retry or delete the comment

#### Scenario: User rejects the hook prompt in a direct run (Built, 1.13.0)
- **GIVEN** a direct `/pr-review` run, a confirmed verdict, and the ask-hook prompt of FR-206 rejected for the posting command
- **WHEN** the Bash result shows the call was not allowed
- **THEN** the skill SHALL report that the post was declined, SHALL NOT retry, and SHALL NOT report it as a failed post (`DECISIONS.md:233-236`)

#### Scenario: First prompt of a pair rejected in a direct run (Built, 1.13.0)
- **GIVEN** a direct run on Bitbucket, each bkt post running as its own Bash command with its own hook prompt (`DECISIONS.md:233-236`), and the prompt for the first command (`bkt pr approve` for an approved verdict, `bkt pr comment` for a Cloud returned verdict) rejected
- **WHEN** the Bash result shows the call was not allowed
- **THEN** the skill SHALL run no second command and SHALL report both as declined

#### Scenario: Cloud request-changes prompt rejected after the comment (Built, 1.13.0)
- **GIVEN** a Cloud returned verdict, an allowed `bkt pr comment`, and a rejected prompt for the request-changes call
- **WHEN** the skill reports
- **THEN** the skill SHALL report the comment as posted and the request as declined (`DECISIONS.md:233-236`)

#### Scenario: Approve succeeds, comment fails on Bitbucket (Built, 1.13.0)
- **GIVEN** a confirmed `--approve` verdict, `bkt pr approve` succeeded, and `bkt pr comment` exits with an error
- **WHEN** the skill reports
- **THEN** the skill SHALL report the failed comment, state that the approval stands, and SHALL NOT retry (`DECISIONS.md:193-196`)

### FR-144: PR text posted through a file

**Statement:** The `/pr-review` skill SHALL pass drafted review text to the platform CLI from a file created for that run, at a path that is not a fixed name, and never by interpolating the text into a shell string; `gh` takes the file through `--body-file`, and `bkt`, which accepts the comment body only through `--text` and has no file or stdin form, receives the text as one quoted argument that the shell reads from the file. At the end of the run, with or without a post, the skill SHALL remove its run folder with a command that uses no glob: it refuses a run folder path that holds `..` or does not start with the `mktemp` template prefix `"${TMPDIR:-/tmp}/pr-review."` and removes nothing then, removes the files it wrote by exact name (`body.txt`, `view.json`, `diff`, `stat`, `comments.json`, and the `.cap` copy of each fetched file), and removes the folder with `rmdir` (`skills/pr-review/SKILL.md:142-146`; `DECISIONS.md:263-266`).
**Traces to:** UR-031, UR-055 | **Priority:** Must | **Status:** Built for the file rule; Built (1.13.0): the per-run path (`mktemp -d "${TMPDIR:-/tmp}/pr-review.XXXXXX"`, `skills/pr-review/SKILL.md:132-148`, which also forbids any fixed path) and the `bkt` form (`--text="$(cat -- '<run folder>/body.txt')"`, `:242`); the fixed path `/tmp/pr-review-body.txt` was a 1.12.0 line, read on 2026-10-17
**Source:** `skills/pr-review/SKILL.md` (Constraints; `:116`, `:117`, and `:139` show the fixed path `/tmp/pr-review-body.txt` and `--message-file`; `:96` and `:204` name `--message-file`); `skills/pr-review/references/review-workflow.md:44`, `:48-51`, `:308`, `:311`, `:314` (the fixed `/tmp` path), `:322` (the file-flag rule; `:319` is blank), `:332` (the fixed path and `--message`/`--message-file`, which bkt does not have); `.agent/research/bkt-cli-forms-20261017.md` (post a general comment: `--text` only, `--file` is the inline-comment anchor; `--text="$(cat <file>)"` is a constructed form that keeps the text out of the command string); `rules/llm-security-checklist.md` (LLM05)

#### Scenario: Hostile PR body
- **GIVEN** a PR description with a `$(...)` sequence that the draft repeats
- **WHEN** the skill posts the comment
- **THEN** the skill SHALL pass the text by file so the sequence does not run

#### Scenario: No fixed body path (Built, 1.13.0)
- **GIVEN** a symlink or another user's file already sits at `/tmp/pr-review-body.txt`
- **WHEN** the skill posts a confirmed draft
- **THEN** the skill SHALL NOT write to or read from that path, SHALL use a file it created for this run, and SHALL remove that file after the post or a "no" answer

#### Scenario: Run folder removal is bound to the template (Built, 1.13.0)
- **GIVEN** a `<run folder>` value that holds `..` or does not start with `"${TMPDIR:-/tmp}/pr-review."`
- **WHEN** the skill removes the run folder at the end of the run
- **THEN** the command SHALL print a message, remove nothing, and exit non-zero; for a folder that starts with the prefix it SHALL remove the known files by name and then run `rmdir`, in bash and zsh alike

#### Scenario: Bitbucket body has no file flag (Built, 1.13.0)
- **GIVEN** a confirmed draft for a Bitbucket PR
- **WHEN** the skill posts the comment
- **THEN** the skill SHALL pass the text through `--text` only, SHALL NOT use `--message`, `--message-file`, or `--file` for the body, and SHALL NOT write the draft text into the command string

#### Scenario: Missing CLI
- **GIVEN** neither `gh` nor `bkt` is installed
- **WHEN** the skill starts
- **THEN** the skill SHALL report the missing CLI and use no other command

### FR-145: Map project

**Statement:** The `/map-project` skill SHOULD report key directories, technology stack, module organization, main dependencies, and entry points in `PROJECT_MAP.md` after the user approves the write.
**Traces to:** UR-032 | **Priority:** Should | **Status:** Built
**Source:** `skills/map-project/SKILL.md`

#### Scenario: Scan only
- **GIVEN** the user has not approved a write
- **WHEN** the skill runs
- **THEN** the skill SHALL scan and report without writing a file

#### Scenario: Approved write
- **GIVEN** the user approves
- **WHEN** the skill finishes
- **THEN** the skill SHALL write `PROJECT_MAP.md` with an Architecture section

### FR-146: Technical writing subcommands

**Statement:** The `/technical-writing` skill SHOULD generate `docs`, `readme`, `guide`, and `api` output and update existing documentation in place of duplicating it.
**Traces to:** UR-033 | **Priority:** Should | **Status:** Built
**Source:** `skills/technical-writing/SKILL.md`

#### Scenario: Guide
- **GIVEN** the topic "How to set up OAuth"
- **WHEN** the user runs `/technical-writing guide "How to set up OAuth"`
- **THEN** the skill SHALL produce prerequisites, step-by-step setup, configuration, verification steps, and troubleshooting

#### Scenario: Existing document
- **GIVEN** a document that already covers the topic
- **WHEN** the skill writes
- **THEN** the skill SHALL update that document and SHALL NOT create a duplicate

### FR-147: Review of markdown reports

**Statement:** The `/review-md` skill SHOULD check a markdown report in all three categories (factual soundness, consistency, concision), report the findings of every category together, and write them to `<report-name>.review.md` with what is wrong, why it matters, and what to change, leaving the reviewed file unedited.
**Traces to:** UR-034 | **Priority:** Should | **Status:** Built (1.11.1); PLANNED (1.12.0): all three categories every time
**Source:** `skills/review-md/SKILL.md:35` (says to stop and report as soon as a category has findings at 1.11.1); `skills/review-md/references/review-findings-template.md:3`, `:7-29` (lists all three categories in one document); the answer to OP-12 in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Findings
- **GIVEN** a report with an uncited claim
- **WHEN** the user runs `/review-md report.md`
- **THEN** the skill SHALL write `report.review.md` with a factual-soundness finding and leave `report.md` unchanged

#### Scenario: Later categories still checked (PLANNED, 1.12.0)
- **GIVEN** a report with an uncited claim and, further down, an em dash and the same conclusion stated twice
- **WHEN** the user runs `/review-md report.md`
- **THEN** `report.review.md` SHALL hold the factual-soundness finding, the consistency finding, and the concision finding together, and the skill SHALL NOT stop after the first category

#### Scenario: Clean report
- **GIVEN** a report with no issue
- **WHEN** the skill finishes
- **THEN** the skill SHALL output `No issues found in <path>.`

### FR-148: Automatic report review

**Statement:** The skills `ask` and `do` SHOULD invoke `review-md` on a report they produce before the report reaches the user.
**Traces to:** UR-034, UR-013 | **Priority:** Should | **Status:** Built (1.11.1) for the `ask` and `do` calls; PLANNED (1.12.0): the caller list in `review-md` narrows to match
**Source:** `skills/ask/SKILL.md:40`, `:52`; `skills/do/references/review-protocol.md:195-220` (Report Quality Gate); `skills/review-md/SKILL.md:31` (names nine callers at 1.11.1, of which only `ask` and `do` state the call in their own files); `docs/SPECIFICATION.md:362` (lists the same nine callers and changes with the planned conformance); the answer to OP-3 in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: Ask answer
- **GIVEN** `/ask` drafted an answer
- **WHEN** the skill prepares to present it
- **THEN** the skill SHALL run `review-md` on the draft first

#### Scenario: Caller list (PLANNED, 1.12.0)
- **GIVEN** `skills/review-md/SKILL.md` after the change
- **WHEN** a test reads the Automated section
- **THEN** it SHALL name `ask` and `do` as the callers and no skill whose own file does not state the call

#### Scenario: Three rounds
- **GIVEN** `review-md` still reports findings after 3 iterations in a `/do` report gate
- **WHEN** the gate ends
- **THEN** `/do` SHALL complete the step with the outstanding findings attached, or fail it when a finding names a wrong claim or a path or ID that does not exist

### C.4 Requirements, spec, plan, and test skills

### FR-149: Gather-requirements elicitation

**Statement:** The `/gather-requirements elicit` subcommand SHALL run six phases (context, business, user, functional, non-functional, summarize and confirm), batch 3 to 5 related questions per turn, and leave unresolved items in Open questions.
**Traces to:** UR-035 | **Priority:** Must | **Status:** Built
**Source:** `skills/gather-requirements/references/elicitation-methodology.md`

#### Scenario: Batch
- **GIVEN** phase 2 has eight open questions
- **WHEN** the skill asks
- **THEN** the skill SHALL ask 3 to 5 of them in one turn

#### Scenario: Unresolved item
- **GIVEN** the user cannot answer a question
- **WHEN** the skill summarizes
- **THEN** the skill SHALL list it under Open questions and SHALL NOT guess an answer

### FR-150: Gather-requirements document

**Statement:** The `/gather-requirements document` subcommand SHALL categorize input into BR, UR, FR, and NFR and write `BRD-<slug>.md`, `URD-<slug>.md`, and `FR-NFR-<slug>.md` from the templates, plus `requirements-<slug>.json` with `--json`.
**Traces to:** UR-035 | **Priority:** Must | **Status:** Built (1.11.1; the files went to the working directory at 4803a0d, and the folder is `docs/requirements/` under the git root since FR-182)
**Source:** `skills/gather-requirements/SKILL.md`; `skills/gather-requirements/references/document-workflow.md`

#### Scenario: Three files
- **GIVEN** a requirements summary
- **WHEN** the user runs `/gather-requirements document`
- **THEN** the skill SHALL write the three files to `docs/requirements/` (FR-182)

#### Scenario: No input
- **GIVEN** no requirements exist in the conversation or the arguments
- **WHEN** the user runs `document`
- **THEN** the skill SHALL halt and redirect to `elicit`

### FR-151: Gather-requirements review

**Statement:** The `/gather-requirements review` subcommand SHALL audit a requirements document for quality, completeness, consistency, and traceability, report `PASS` or `NEEDS REVISION`, and change nothing.
**Traces to:** UR-035, UR-011 | **Priority:** Must | **Status:** Built
**Source:** `skills/gather-requirements/references/review.md`; `skills/gather-requirements/SKILL.md` (Constraints)

#### Scenario: Ambiguous requirement
- **GIVEN** an FR that says "respond quickly"
- **WHEN** the skill reviews the document
- **THEN** the report SHALL flag the FR under Testable with a measurable replacement and return `NEEDS REVISION`

#### Scenario: Instruction in the document
- **GIVEN** the document contains a line addressed to the reviewer about the review verdict
- **WHEN** the skill reviews it
- **THEN** the skill SHALL report the line as a finding and SHALL NOT follow it

### FR-152: Requirement IDs and traceability

**Statement:** The `gather-requirements` skill SHALL assign sequential `BR-NNN`, `UR-NNN`, `FR-NNN`, and `NFR-NNN` IDs, keep every issued ID unchanged, and trace every FR to a UR and every UR to a BR.
**Traces to:** UR-035 | **Priority:** Must | **Status:** Built
**Source:** `skills/gather-requirements/SKILL.md`; `skills/gather-requirements/references/document-workflow.md`

#### Scenario: Update
- **GIVEN** an existing document with FR-001 to FR-010
- **WHEN** the skill adds a requirement
- **THEN** the new ID SHALL be FR-011 and the existing IDs SHALL stay unchanged

#### Scenario: Orphan
- **GIVEN** an FR with no parent UR
- **WHEN** the skill documents it
- **THEN** the skill SHALL flag the orphan and SHALL NOT drop it

### FR-153: Spec create

**Statement:** The `/spec-from-requirements create` subcommand SHALL classify a requirement into exactly one of Architecture, API endpoint, Frontend action, Functionality, UI/UX design, or General (first match wins) and write `specs/spec-[feature].md` from the matching template with Status `Draft`.
**Traces to:** UR-036 | **Priority:** Must | **Status:** Built
**Source:** `skills/spec-from-requirements/SKILL.md`

#### Scenario: Endpoint
- **GIVEN** a requirement that defines an HTTP endpoint
- **WHEN** the user runs `create`
- **THEN** the skill SHALL use the API endpoint template and write `specs/spec-<feature>.md`

#### Scenario: Submodule
- **GIVEN** a feature that belongs to the `backend` submodule
- **WHEN** the skill writes
- **THEN** the skill SHALL write `backend/specs/spec-<feature>.md`

### FR-154: Spec delta

**Statement:** The `/spec-from-requirements delta` subcommand SHALL record an incremental change in a `## Change Log` entry with ADDED, MODIFIED, and REMOVED subsections without rewriting the file.
**Traces to:** UR-036 | **Priority:** Must | **Status:** Built (1.11.1; the Status rule is stated in `delta-format.md` and this requirement now carries it)
**Source:** `skills/spec-from-requirements/SKILL.md`; `skills/spec-from-requirements/references/delta-format.md:75` ("A spec receiving a delta returns to `Review` unless the user approves the change in the same turn"); `docs/SPECIFICATION.md`; the answer to the FR-177 versus FR-154 conflict in `plan-deferred-decisions-20261016-1059.md` (the delta rule wins)

#### Scenario: Status after a delta, not approved in the same turn
- **GIVEN** an existing spec with Status `Approved` and a delta that the user has not approved in the same turn
- **WHEN** the user runs `delta`
- **THEN** the skill SHALL set the spec's Status to `Review`

#### Scenario: Status after a delta, approved in the same turn
- **GIVEN** an existing spec with Status `Approved` and a delta that the user approves in the same turn
- **WHEN** the user runs `delta`
- **THEN** the skill SHALL NOT return the Status to `Review`

#### Scenario: Added requirement
- **GIVEN** an existing spec and a new requirement
- **WHEN** the user runs `delta`
- **THEN** the skill SHALL append an ADDED entry and leave the earlier sections unchanged

#### Scenario: Default mode
- **GIVEN** no first argument and an existing spec for the feature
- **WHEN** the user runs the skill
- **THEN** the skill SHALL choose `delta`

#### Scenario: Removed requirement
- **GIVEN** an existing spec and a requirement that is dropped
- **WHEN** the user runs `delta`
- **THEN** the skill SHALL append a REMOVED entry and SHALL NOT rewrite the file

### FR-155: Spec review

**Statement:** The `/spec-from-requirements review` subcommand SHOULD report CRITICAL, WARNING, and SUGGESTION findings for completeness, correctness, coherence, and style and change nothing, including the spec's Status.
**Traces to:** UR-036 | **Priority:** Should | **Status:** Built
**Source:** `skills/spec-from-requirements/SKILL.md` (Review mode)

#### Scenario: Missing scenario
- **GIVEN** a `### Requirement:` with no `#### Scenario:`
- **WHEN** the skill reviews the spec
- **THEN** the skill SHALL report a CRITICAL completeness finding

#### Scenario: Status unchanged
- **GIVEN** a spec with Status `Draft`
- **WHEN** review finishes
- **THEN** the Status SHALL still read `Draft`

### FR-156: Spec requirement refs

**Statement:** The `spec-from-requirements` skill SHALL cite at least one `BR`, `UR`, `FR`, or `NFR` ID, exactly as it appears in the requirements document, in each spec's Requirement refs field.
**Traces to:** UR-036 | **Priority:** Must | **Status:** Built
**Source:** `skills/spec-from-requirements/SKILL.md` (Metadata block)

#### Scenario: No requirement reference
- **GIVEN** no requirement ID is available for a spec
- **WHEN** the skill prepares to write
- **THEN** the skill SHALL find the requirement or ask for it and SHALL NOT write the spec

#### Scenario: ID copied exactly
- **GIVEN** `FR-NFR-auth.md` defines FR-045
- **WHEN** the skill writes the spec
- **THEN** the Requirement refs field SHALL read `FR-045`

### FR-179: Spec requirement scenarios

**Statement:** The `spec-from-requirements` skill SHALL give each Requirement in a spec at least one `#### Scenario:` in GIVEN/WHEN/THEN form, with a failure Scenario for each Requirement that can fail.
**Traces to:** UR-036 | **Priority:** Must | **Status:** Built
**Source:** `skills/spec-from-requirements/SKILL.md` (Requirement and Scenario format)

#### Scenario: Requirement without a scenario
- **GIVEN** a drafted Requirement that has no Scenario
- **WHEN** the skill checks the draft
- **THEN** the skill SHALL add a Scenario before it writes

#### Scenario: Requirement that can fail
- **GIVEN** a drafted Requirement with only a happy-path Scenario
- **WHEN** the skill checks the draft
- **THEN** the skill SHALL add a failure Scenario before it writes

### FR-157: Task plan validation and steps

**Statement:** The `/task-plan` skill SHALL refuse a spec whose `### Requirement:` blocks lack a `#### Scenario:`, otherwise write ordered coding steps that each name files, the requirement IDs they satisfy, and the `code` skill references that apply.
**Traces to:** UR-037 | **Priority:** Must | **Status:** Built
**Source:** `skills/task-plan/SKILL.md`; `skills/task-plan/references/validation-rules.md`

#### Scenario: Incomplete spec
- **GIVEN** a requirement block with no scenario
- **WHEN** Intake runs
- **THEN** the skill SHALL report the block and line and end `Error` with class `precondition-failed`

#### Scenario: Complete spec
- **GIVEN** a spec where every requirement has a scenario
- **WHEN** the skill plans
- **THEN** each step SHALL carry Files, Satisfies, and Code references fields

### FR-158: Task plan check

**Statement:** The `/task-plan` skill SHALL verify before writing that every Intake requirement appears in some step, and every cited ID and every modified file exists.
**Traces to:** UR-037 | **Priority:** Must | **Status:** Built
**Source:** `skills/task-plan/SKILL.md` (States, Routing)

#### Scenario: Uncovered requirement
- **GIVEN** a plan that omits one requirement
- **WHEN** CheckPlan runs
- **THEN** the skill SHALL return to PlanSteps on the first and second `gaps` and end `Error` with class `budget-exhausted` on the third, after two rework passes

#### Scenario: Unknown ID
- **GIVEN** a step cites `FR-999`, which no spec or requirement document holds
- **WHEN** CheckPlan greps for it
- **THEN** the skill SHALL return to PlanSteps and remove or replace the ID

### FR-159: Create-test black-box rule

**Statement:** The `/create-test` skill SHALL read only spec Scenarios, requirement documents, and public interface declarations and enumerate valid, invalid, boundary, null or empty, type-mismatch, and security-adjacent inputs per Scenario.
**Traces to:** UR-038 | **Priority:** Must | **Status:** Built
**Source:** `skills/create-test/SKILL.md`

#### Scenario: Scenario to tests
- **GIVEN** a Scenario that validates an email field
- **WHEN** the skill plans coverage
- **THEN** it SHALL map the Scenario to tests for each applicable input category

#### Scenario: Spec without scenarios
- **GIVEN** a spec with no Scenarios
- **WHEN** Intake runs
- **THEN** the skill SHALL end `Error` with class `precondition-failed`

### FR-160: Create-test traceability and frameworks

**Statement:** The `/create-test` skill SHALL give every test a traceability comment of the form `[AC-N | SPEC-NNN | FR-NNN | ...]` with IDs sourced from existing documents, and load one framework reference for Go, Rust, Python, TypeScript, JavaScript, Kotlin, or C++.
**Traces to:** UR-038 | **Priority:** Must | **Status:** Built
**Source:** `skills/create-test/SKILL.md`; `skills/create-test/references/test-frameworks/`

#### Scenario: Comment present
- **GIVEN** a generated test for Scenario 2 of SPEC-003
- **WHEN** SelfCheck re-reads it
- **THEN** the test SHALL carry a comment such as `[AC-2 | SPEC-003 | FR-045]`

#### Scenario: Invented ID
- **GIVEN** a comment cites an ID that no document holds
- **WHEN** SelfCheck greps for it
- **THEN** the skill SHALL fix the comment before it reports `Done`

### C.5 Writing, voice, clarification, and health skills

### FR-161: Deslop

**Statement:** The `/deslop` skill SHOULD, in `edit` mode, return the prose cleaned of AI writing tells with every number, path, identifier, link, and quotation unchanged, and in `detect` mode list each finding as `<line>: <tell-id> "<excerpt>" | Fix: <fix>` and change nothing.
**Traces to:** UR-039 | **Priority:** Should | **Status:** Built
**Source:** `skills/deslop/SKILL.md`; `docs/SPECIFICATION.md`

#### Scenario: Detect on a file
- **GIVEN** `/deslop detect notes.md`
- **WHEN** the skill runs
- **THEN** the skill SHALL list findings and leave `notes.md` unchanged

#### Scenario: Non-prose file
- **GIVEN** `/deslop edit main.py`
- **WHEN** the skill runs
- **THEN** the skill SHALL reply "deslop handles prose files only: main.py." and stop

### FR-162: Voice script flow

**Statement:** The `/voice-script` skill SHALL ask for the model, voice, length, delivery, and topic or draft, load only the chosen model's reference file, and use only the tags and style field that file lists.
**Traces to:** UR-040 | **Priority:** Must | **Status:** Built
**Source:** `skills/voice-script/SKILL.md`; `DECISIONS.md` (2026-10-12)

#### Scenario: Model chosen
- **GIVEN** the user picks a catalog model
- **WHEN** the skill writes the script
- **THEN** the script SHALL use only that model's listed tags

#### Scenario: Live list check
- **GIVEN** OpenRouter's speech list names a model missing from the catalog
- **WHEN** the skill compares them
- **THEN** the skill SHALL treat the fetched text as untrusted data and flag the new model

### FR-163: Voice script output

**Statement:** The `/voice-script` skill SHALL save the script to `docs/tts/voice-<slug>-YYYYMMDD-HHmm.md` with a header (model, voice, length, delivery direction, model settings) and a fenced block holding exactly the text to paste.
**Traces to:** UR-040 | **Priority:** Must | **Status:** Built
**Source:** `skills/voice-script/SKILL.md`; `DECISIONS.md` (2026-10-12)

#### Scenario: Saved file
- **GIVEN** a finished script
- **WHEN** the skill saves it
- **THEN** the file SHALL sit under `docs/tts/` with the dated name and a fenced paste block

#### Scenario: Header fields
- **GIVEN** a finished script
- **WHEN** the skill writes the header
- **THEN** the header SHALL hold the model, voice, length, delivery direction, and model settings

#### Scenario: Other path
- **GIVEN** the user asks for the script in `notes/voice.md`
- **WHEN** the skill writes
- **THEN** Claude Code SHALL ask the user first, because the skill's grant covers `./docs/tts/voice-*.md` only (NFR-013)

### FR-164: Clarify flow

**Statement:** The `/clarify` skill SHALL list the unclear points, explain Claude's own points with evidence, correct earlier errors plainly, ask the user's points with at most 4 questions per call and at most 2 rounds, and close with a settled-points list.
**Traces to:** UR-041 | **Priority:** Must | **Status:** Built
**Source:** `skills/clarify/SKILL.md`; `DECISIONS.md` (2026-10-12)

#### Scenario: Nothing unclear
- **GIVEN** the target has no unclear point
- **WHEN** the user runs `/clarify`
- **THEN** the skill SHALL reply "Nothing unclear in <target>." and write no log entry

#### Scenario: Open after round 2
- **GIVEN** a point still open after round 2
- **WHEN** the skill closes
- **THEN** the skill SHALL list it as open and SHALL NOT guess an answer

### FR-165: Clarify log

**Statement:** The `/clarify` skill SHALL append one entry per point to `.agent/clarify/clarify-YYYYMMDD.md`, a daily file closed by the `<!-- clarify-log-end -->` marker.
**Traces to:** UR-041 | **Priority:** Must | **Status:** Built
**Source:** `skills/clarify/SKILL.md` (Log); `DECISIONS.md` (2026-10-12)

#### Scenario: Append
- **GIVEN** the daily file exists with the marker once as its last non-blank line
- **WHEN** the skill logs two points
- **THEN** the skill SHALL insert both entries before the marker in one Edit

#### Scenario: Damaged marker
- **GIVEN** the marker is missing or appears twice
- **WHEN** the skill prepares to log
- **THEN** the skill SHALL write nothing and tell the user the log needs repair

### FR-166: Health skill

**Statement:** The `/health` skill SHALL run `hooks/health-check.js --data-dir "${CLAUDE_PLUGIN_DATA}"` (with `--clear` only when the user passes it), summarize the status in a few lines, and give each finding its fix.
**Traces to:** UR-018 | **Priority:** Must | **Status:** Built
**Source:** `skills/health/SKILL.md`

#### Scenario: Healthy
- **GIVEN** every self-test passes
- **WHEN** the user runs `/health`
- **THEN** the skill SHALL report the healthy result in one line

#### Scenario: System message instead of report
- **GIVEN** the script prints a `systemMessage` instead of a report
- **WHEN** the skill reads it
- **THEN** the skill SHALL treat the message as the finding and apply the matching fix row

### C.6 Internal skills

### FR-167: Code skill

**Statement:** The internal `code` skill SHALL give the `developer` agent language, framework, logging, error-handling, and pattern references and restrict documentation lookup to the exact `ctx7` and `firecrawl` command shapes listed in its `allowed-tools`.
**Traces to:** UR-042 | **Priority:** Must | **Status:** Built
**Source:** `skills/code/SKILL.md`; `skills/code/references/`

#### Scenario: Unfamiliar API
- **GIVEN** `ctx7` is installed
- **WHEN** the agent needs a library's current docs
- **THEN** it SHALL run `ctx7 library <name> --json` and `ctx7 docs <id> "<topic>" --json`

#### Scenario: CLI missing
- **GIVEN** neither `ctx7` nor `firecrawl` is installed
- **WHEN** the agent needs docs
- **THEN** it SHALL show the install command, install nothing, and state that docs were not checked

### FR-168: Traceability markers

**Statement:** The `developer` agent SHOULD cite in code comments only requirement or spec IDs that appear in a requirements document, a spec, or the task prompt, in the form `[FR-045]`, `[SPEC-003]`, or a chain such as `[SPEC-003 -> FR-045 -> UC-012 -> AC-2]`, and write no marker when no source provides an ID.
**Traces to:** UR-042, UR-049 | **Priority:** Should | **Status:** Built
**Source:** `docs/TRACING_MARKERS.md`

#### Scenario: ID from a document
- **GIVEN** `FR-NFR-checkout.md` defines FR-045
- **WHEN** the agent implements it
- **THEN** the code comment SHALL read `[FR-045]` or a chain that ends at it

#### Scenario: No source
- **GIVEN** no document or prompt gives an ID
- **WHEN** the agent writes the comment
- **THEN** the comment SHALL carry no marker

### FR-169: Pentest rules of engagement

**Statement:** The internal `pentest` skill SHALL limit qa's active tests to detecting a vulnerability on a target the user authorized, using under `/do` only the commands the approved plan lists.
**Traces to:** UR-042, UR-014 | **Priority:** Must | **Status:** Built
**Source:** `skills/pentest/SKILL.md` (Rules of Engagement 1, 3, 4)

#### Scenario: Unlisted command
- **GIVEN** an active test command that the plan does not list
- **WHEN** qa considers it
- **THEN** qa SHALL skip it, record `<command> not-run (skipped: not in approved plan)`, and list it in `out_of_scope`

#### Scenario: Detection only
- **GIVEN** qa confirmed a vulnerability on an authorized target
- **WHEN** qa tests further
- **THEN** qa SHALL stop at the minimum needed to confirm it and SHALL NOT exfiltrate data or cause denial of service

### FR-170: Integrated test

**Statement:** The internal `integrated-test` skill SHOULD give qa testcontainers patterns, semantic-locator Playwright patterns, and monorepo test organization, and require a Playwright availability check before E2E tests.
**Traces to:** UR-042 | **Priority:** Should | **Status:** Built
**Source:** `skills/integrated-test/SKILL.md`; `skills/integrated-test/references/playwright-e2e.md`

#### Scenario: E2E planned
- **GIVEN** a frontend feature needs E2E tests
- **WHEN** qa starts
- **THEN** qa SHALL check Playwright availability first

#### Scenario: Database test
- **GIVEN** an integration test needs a database
- **WHEN** qa plans it
- **THEN** qa SHALL use a container fixture pattern from the skill

#### Scenario: Playwright missing
- **GIVEN** neither the Playwright MCP nor the CLI is found
- **WHEN** qa plans E2E tests
- **THEN** qa SHALL report that E2E testing needs Playwright installed and SHALL NOT skip the check silently

### FR-171: Run-test

**Statement:** The internal `run-test` skill SHALL run the project's existing unit and integration suites with the exact commands in its `allowed-tools`, capture coverage, install no package, and produce one consolidated test report that lists every unrun check as skipped.
**Traces to:** UR-042 | **Priority:** Must | **Status:** Built
**Source:** `skills/run-test/SKILL.md`; `README.md` (Python tooling)

#### Scenario: Python project
- **GIVEN** a project with a `.venv`
- **WHEN** qa runs the tests
- **THEN** it SHALL run `uv run --no-sync --no-python-downloads pytest`

#### Scenario: Missing environment
- **GIVEN** no `.venv` exists
- **WHEN** qa runs the tests
- **THEN** it SHALL skip the run, list `tests not-run (skipped)`, and install nothing

### C.7 Manifests and repository documents

### FR-172: Marketplace manifest identity

**Statement:** The repository SHALL publish `.claude-plugin/marketplace.json` with `name` `assist-plugin-marketplace` and one plugin entry named `assist-plugin` with source `./plugins/assist-plugin`.
**Traces to:** UR-047 | **Priority:** Must | **Status:** Built
**Source:** `.claude-plugin/marketplace.json`; `CLAUDE.md` (Repository)

#### Scenario: Install id
- **GIVEN** the manifest
- **WHEN** a user runs `/plugin install assist-plugin@assist-plugin-marketplace`
- **THEN** the id SHALL resolve to the plugin entry

#### Scenario: Rename attempt
- **GIVEN** a change that sets another marketplace `name`
- **WHEN** the change is reviewed
- **THEN** the reviewer SHALL reject it because a rename breaks existing installs

### FR-173: Version agreement

**Statement:** The `version` in `plugins/assist-plugin/.claude-plugin/plugin.json` and the plugin entry's `version` in `.claude-plugin/marketplace.json` SHALL be equal at every release.
**Traces to:** UR-046 | **Priority:** Must | **Status:** Built
**Source:** `CLAUDE.md` (Keeping counts in sync, releasing)

#### Scenario: Equal
- **GIVEN** both files read 1.11.0
- **WHEN** a release check compares them
- **THEN** the check SHALL pass

#### Scenario: Different
- **GIVEN** `plugin.json` reads 1.11.1 and `marketplace.json` reads 1.11.0
- **WHEN** a release check compares them
- **THEN** the check SHALL fail

### FR-174: Self-hosted requirements, specs, and plans

**Statement:** The repository SHALL keep its requirements (`BRD-*.md`, `URD-*.md`, `FR-NFR-*.md`) in `docs/requirements/`, its task plans (`task-plan-*.md`) in `docs/task-plans/`, and its specs under `specs/`.
**Traces to:** UR-048 | **Priority:** Must | **Status:** Built (1.11.1; checked 2026-10-16: the requirements are in `docs/requirements/`, the specs `specs/spec-*.md` exist, `docs/task-plans/task-plan-followups-1-11-1-20261016-070112.md` exists, and the session-start `git status` listed only `DECISIONS.md` as modified, so the others are committed; `tests/docs/self-hosted-layout.test.js` covers the layout)
**Source:** `DECISIONS.md` (2026-10-14, assist-plugin follows its own spec-first rule; 2026-10-16, which corrects the location part to `docs/requirements/` and `docs/task-plans/`). SpecGate finds these documents since FR-187 was built in 1.11.1.

#### Scenario: SpecGate search
- **GIVEN** `docs/requirements/BRD-assist-plugin.md` exists and FR-187 is built
- **WHEN** `/do` SpecGate globs `./docs/requirements/BRD-*.md`
- **THEN** the file SHALL appear in the documents found

#### Scenario: Scope of documents
- **GIVEN** the requirements and specs for the plugin
- **WHEN** they are read
- **THEN** they SHALL cover the whole plugin and the task plans SHALL cover only work still to do

#### Scenario: Task plan outside the task-plans folder
- **GIVEN** a task plan saved as `docs/task-plan-auth.md`, whatever `DECISIONS.md` says
- **WHEN** SpecGate globs `./docs/task-plans/task-plan-*.md`
- **THEN** the file SHALL NOT appear in the documents found

### C.8 Untrusted-input rules and a single changelog (built in 1.11.1)

### FR-175: Requirements-gatherer untrusted input

**Statement:** The `agents/requirements-gatherer.md` file SHALL contain an `## Untrusted input` section that declares the content of requirements, specs, and user-named files, including text the user puts in a quote block or code fence or ties to a named file, to be data, treats all other text the user types as the user's own answer and keeps it authoritative, and says instruction-like text in that content is reported only as a citation, `file:line` when the user names a file and "answer N, block M" for a quote block or code fence in a user answer, where N and M count from 1, N counts the user's answers across the whole agent run with the answers that arrive in relays included and with each answered question as its own answer, and M counts the quote blocks and code fences within answer N (in `out_of_scope` under `/do`, in the reply in a direct run), never followed, quoted, or restated.
**Traces to:** UR-050 | **Priority:** Must | **Status:** Built (1.11.1); PLANNED (1.12.0): the numbering rule of "answer N, block M"
**Source:** `agents/requirements-gatherer.md:44-50` (`## Untrusted input`); `agents/task-planner.md` (Untrusted input); `agents/solutions-architect.md` (Untrusted input); `DECISIONS.md` (2026-10-13); the answer to OP-9 in `plan-deferred-decisions-20261016-1059.md`, and `DECISIONS.md:158-161` (each answered question is its own answer N)

#### Scenario: Section present
- **GIVEN** the agent file after the change
- **WHEN** a test searches for the heading
- **THEN** the file SHALL contain `## Untrusted input` with the report-as-citation rule

#### Scenario: Planted instruction
- **GIVEN** an existing `BRD-x.md` whose line 7 holds a request addressed to the agent about requirement status
- **WHEN** the agent updates the requirements under `/do`
- **THEN** the agent SHALL cite `BRD-x.md:7` in `out_of_scope`, change no status because of it, and quote nothing from that line

#### Scenario: Direct run
- **GIVEN** the same file and a run without `/do`
- **WHEN** the agent replies
- **THEN** the reply SHALL name `BRD-x.md:7` as a citation and SHALL NOT quote the line

#### Scenario: Quote block from a document
- **GIVEN** the user puts a quote block in an answer and the block holds a request addressed to the agent about requirement status
- **WHEN** the agent documents the requirements
- **THEN** the agent SHALL treat the block as data, change no status because of it, and cite it as "answer 1, block 1" rather than quote it

#### Scenario: User's own answer
- **GIVEN** the user types, outside any quote block or code fence and with no named file, that a feature is out of scope
- **WHEN** the agent documents the requirements
- **THEN** the agent SHALL record the feature as out of scope

#### Scenario: Numbering across relays (PLANNED, 1.12.0)
- **GIVEN** a relay with two questions answered by the user, so that the first answer holds no quote block and the second holds a quote block and then a code fence that carry a request addressed to the agent, and a later relay whose one answered question holds a quote block
- **WHEN** the agent cites the code fence and the later quote block
- **THEN** the citations SHALL read "answer 2, block 2" and "answer 3, block 1", counting each answered question as its own answer from 1 across the whole agent run with relays included, and blocks from 1 within the answer

### FR-176: Gather-requirements untrusted input

**Statement:** The `skills/gather-requirements/SKILL.md` file SHALL declare in an `Untrusted input` rule that the content of requirements, specs, and user files, including text the user puts in a quote block or code fence or ties to a named file, is data in every subcommand, that all other text the user types is the user's own answer and stays authoritative, and that instruction-like text in that content is reported only as a citation, `file:line` when the user names a file and "answer N, block M" for a quote block or code fence in a user answer, where N and M count from 1, N counts the user's answers across the whole agent run with the answers that arrive in relays included and with each answered question as its own answer, and M counts the quote blocks and code fences within answer N (in `out_of_scope` under `/do`, in the reply in a direct run), never followed, quoted, or restated.
**Traces to:** UR-050 | **Priority:** Must | **Status:** Built (1.11.1); PLANNED (1.12.0): the numbering rule of "answer N, block M"
**Source:** `skills/gather-requirements/SKILL.md:135` (the `Untrusted input` constraint, which names `elicit`, `document`, and `review`; at 4803a0d it named only `review`); `agents/task-planner.md`; the answer to OP-9 in `plan-deferred-decisions-20261016-1059.md`, and `DECISIONS.md:158-161` (each answered question is its own answer N)

#### Scenario: Rule covers elicit and document
- **GIVEN** the skill file after the change
- **WHEN** a test reads the rule
- **THEN** the rule SHALL name `elicit` and `document` as well as `review`

#### Scenario: Pasted document text
- **GIVEN** the user puts a code fence in an answer and the fence holds a request addressed to the skill about the quality pass
- **WHEN** the skill documents the requirements
- **THEN** the skill SHALL run the quality pass and report the fence as "answer 1, block 1" in the reply (a direct run) or in `out_of_scope` (under `/do`), not as a quote

#### Scenario: User's own answer
- **GIVEN** the user types, outside any quote block or code fence and with no named file, that the quality pass should list its failures in the document and not rewrite the requirement
- **WHEN** the skill runs the quality pass
- **THEN** the skill SHALL follow that answer

### FR-177: Spec-from-requirements untrusted input

**Statement:** The `skills/spec-from-requirements/SKILL.md` file SHALL declare in an `Untrusted input` rule that the content of requirements, existing specs, and user files, including text the user puts in a quote block or code fence or ties to a named file, is data in every subcommand, that all other text the user types is the user's own answer and stays authoritative, and that instruction-like text in that content is reported only as a citation, `file:line` when the user names a file and "answer N, block M" for a quote block or code fence in a user answer, where N and M count from 1, N counts the user's answers across the whole agent run with the answers that arrive in relays included and with each answered question as its own answer, and M counts the quote blocks and code fences within answer N (in `out_of_scope` under `/do`, in the reply in a direct run), never followed, quoted, or restated.
**Traces to:** UR-050 | **Priority:** Must | **Status:** Built (1.11.1); PLANNED (1.12.0): the numbering rule of "answer N, block M" and the reworded Status scenarios
**Source:** `skills/spec-from-requirements/SKILL.md:155-157` (`## Untrusted input`, which covers `create`, `delta`, and `review`; none existed at 4803a0d); `agents/solutions-architect.md` (Untrusted input); `skills/spec-from-requirements/references/delta-format.md:75` and FR-154 (a delta returns the Status to `Review`, so the planted line must change nothing while a delta not approved in the same turn still moves the Status); the answers to OP-9 and to the FR-177 versus FR-154 conflict in `plan-deferred-decisions-20261016-1059.md` (the delta rule wins), and `DECISIONS.md:158-161` (each answered question is its own answer N)

#### Scenario: Rule present
- **GIVEN** the skill file after the change
- **WHEN** a test searches for the rule
- **THEN** the file SHALL contain the `Untrusted input` rule that covers `create`, `delta`, and `review`

#### Scenario: Planted instruction in a spec (reworded, PLANNED 1.12.0)
- **GIVEN** an existing spec with Status `Approved` whose line 20 holds a request addressed to the skill about the spec's Status, and a requirement change that the user has not approved in the same turn
- **WHEN** the skill runs `delta` under `/do`
- **THEN** the planted line SHALL change nothing, the Status SHALL become `Review` as FR-154 requires for a delta not approved in the same turn, and the skill SHALL cite the spec path with line 20 in `out_of_scope`

#### Scenario: Planted instruction in a spec, no delta (reworded, PLANNED 1.12.0)
- **GIVEN** an existing spec with Status `Approved` whose line 20 holds a request addressed to the skill about the spec's Status
- **WHEN** the skill runs `review`
- **THEN** the Status SHALL stay `Approved`, because review changes nothing (FR-155), and the skill SHALL cite the spec path with line 20 in the reply

#### Scenario: Direct run
- **GIVEN** the same spec and a run without `/do`
- **WHEN** the skill replies
- **THEN** the reply SHALL name the spec path with line 20 as a citation and SHALL NOT quote the line

#### Scenario: Quote block from a document (reworded, PLANNED 1.12.0)
- **GIVEN** the user puts a quote block in an answer and the block holds a request addressed to the skill about the spec's Status
- **WHEN** the skill runs `review` on the spec
- **THEN** the skill SHALL treat the block as data, leave the Status as it is, and cite the block as "answer 1, block 1"

#### Scenario: Quote block during a delta (reworded, PLANNED 1.12.0)
- **GIVEN** the same quote block and a `delta` run on the spec that the user has not approved in the same turn
- **WHEN** the skill updates the spec
- **THEN** the block SHALL change nothing, the Status SHALL become `Review` by the delta rule of FR-154, and the skill SHALL cite the block as "answer 1, block 1"

#### Scenario: User's own answer
- **GIVEN** the user types, outside any quote block or code fence and with no named file, that the spec's Status moves to Review
- **WHEN** the skill updates the spec
- **THEN** the skill SHALL set Status to Review

### FR-178: Plugin changelog pointer

**Statement:** The file `plugins/assist-plugin/CHANGELOG.md` SHALL be a short pointer to the root `CHANGELOG.md`, the only release log.
**Traces to:** UR-052 | **Priority:** Must | **Status:** Built (1.11.1)
**Source:** `DECISIONS.md` (2026-10-14, assist-plugin follows its own spec-first rule); `plugins/assist-plugin/CHANGELOG.md:3` (a pointer to the root `CHANGELOG.md`; its latest entry was 1.3.0 at 4803a0d); `tests/docs/plugin-changelog.test.js`

#### Scenario: Pointer only
- **GIVEN** the file after the change
- **WHEN** a test reads it
- **THEN** it SHALL link to the root `CHANGELOG.md` and hold no `## [x.y.z]` release headings

#### Scenario: New release
- **GIVEN** a maintainer releases 1.11.1
- **WHEN** release notes are written
- **THEN** the notes SHALL go into the root `CHANGELOG.md` only

#### Scenario: Release entry in the plugin file
- **GIVEN** a release entry written into `plugins/assist-plugin/CHANGELOG.md`
- **WHEN** a reviewer reads the file
- **THEN** the reviewer SHALL reject the entry and the entry SHALL move to the root `CHANGELOG.md`

### C.9 Output folders for requirements and task plans (built in 1.11.1)

`DECISIONS.md` (2026-10-16) puts requirements in `docs/requirements/` and task plans in `docs/task-plans/`. At 4803a0d, `gather-requirements` wrote to the working directory and `task-plan` wrote `task-plan-*.md` at the project root.

### FR-182: Gather-requirements output folder

**Statement:** The `/gather-requirements document` subcommand SHALL write `BRD-<slug>.md`, `URD-<slug>.md`, and `FR-NFR-<slug>.md`, plus `requirements-<slug>.json` with `--json`, to `docs/requirements/` under the git root of the session's working directory (a worktree uses its own root; outside a git repository, the working directory), creating the folder when it is missing.
**Traces to:** UR-035 | **Priority:** Must | **Status:** Built (1.11.1)
**Source:** `DECISIONS.md` (2026-10-16, Requirements in docs/requirements/; Legacy root documents and the requirements JSON; docs/requirements/ and docs/task-plans/ resolve against the session's git root); `skills/gather-requirements/SKILL.md:105-115` (Output; the working directory at 4803a0d)

#### Scenario: Folder missing
- **GIVEN** a project with no `docs/requirements/` folder
- **WHEN** the user runs `/gather-requirements document`
- **THEN** the skill SHALL create the folder and write the three files in it

#### Scenario: JSON projection
- **GIVEN** the user passes `--json`
- **WHEN** the skill documents the requirements
- **THEN** the skill SHALL write `requirements-<slug>.json` to `docs/requirements/` beside the three documents

#### Scenario: Subdirectory session
- **GIVEN** a session started in `<repo>/src` inside a git repository
- **WHEN** the user runs `/gather-requirements document`
- **THEN** the skill SHALL write to `<repo>/docs/requirements/`, and Claude Code SHALL ask the user first because the skill's `./` grant is relative to the working directory

#### Scenario: Worktree session
- **GIVEN** a session started at the root of the worktree `<repo>/.claude/worktrees/feature-a`
- **WHEN** the user runs `/gather-requirements document`
- **THEN** the skill SHALL write to `<repo>/.claude/worktrees/feature-a/docs/requirements/`, the worktree's own root

#### Scenario: Legacy document updated in place
- **GIVEN** the prompt names the root-level `./FR-NFR-auth.md` at the git root as an existing document to update, and the session started in `<repo>/src`
- **WHEN** the skill documents the requirements
- **THEN** the skill SHALL update that file in place, after the user approves the write prompt of FR-183, and SHALL NOT create a copy in `docs/requirements/`

### FR-183: Gather-requirements write grant

**Statement:** The `gather-requirements` skill SHALL pre-approve edits only to `./docs/requirements/BRD-*.md`, `./docs/requirements/URD-*.md`, `./docs/requirements/FR-NFR-*.md`, and `./docs/requirements/requirements-*.json`.
**Traces to:** UR-035, UR-019 | **Priority:** Must | **Status:** Built (1.11.1)
**Source:** `DECISIONS.md` (2026-10-12, Scoped write grants; 2026-10-16); `skills/gather-requirements/SKILL.md:13-16`, `:117` (Write scope; at 4803a0d: `./BRD-*.md`, `./URD-*.md`, `./FR-NFR-*.md`, `./requirements-*.json`)

#### Scenario: Granted path
- **GIVEN** the skill writes `docs/requirements/BRD-shop.md`
- **WHEN** Claude Code evaluates the write
- **THEN** the write SHALL run without a permission prompt

#### Scenario: Root-level path
- **GIVEN** the skill writes `./BRD-shop.md` at the repository root
- **WHEN** Claude Code evaluates the write
- **THEN** Claude Code SHALL ask the user first

#### Scenario: JSON path
- **GIVEN** the skill writes `docs/requirements/requirements-shop.json`
- **WHEN** Claude Code evaluates the write
- **THEN** the write SHALL run without a permission prompt

#### Scenario: Session in a subdirectory
- **GIVEN** a session started in `<repo>/src` and the skill writes `<repo>/docs/requirements/BRD-shop.md`
- **WHEN** Claude Code evaluates the write against the `./docs/requirements/` grant, which is relative to the working directory
- **THEN** Claude Code SHALL ask the user first

#### Scenario: In-place update of a legacy root-level file
- **GIVEN** the prompt names the root-level `./FR-NFR-auth.md` at the git root for an in-place update
- **WHEN** the skill writes it
- **THEN** Claude Code SHALL ask the user first, because the grant stays scoped to `docs/requirements/` and no root-level grant is added (`DECISIONS.md`, 2026-10-16, 1.11.1 design points)

### FR-184: Task-plan output folder

**Statement:** The `/task-plan` skill SHALL write `task-plan-<feature-slug>-<timestamp>.md` to `docs/task-plans/` under the git root of the session's working directory (a worktree uses its own root; outside a git repository, the working directory), creating the folder when it is missing, on a first run and on a rework, overwriting the file named in the prompt only when that file is already in `docs/task-plans/`.
**Traces to:** UR-037 | **Priority:** Must | **Status:** Built (1.11.1)
**Source:** `DECISIONS.md` (2026-10-16, Requirements in docs/requirements/; Legacy root documents and the requirements JSON; docs/requirements/ and docs/task-plans/ resolve against the session's git root); `skills/task-plan/SKILL.md:22-39`, `:128-132` (Routing; the project root at 4803a0d)

#### Scenario: First run
- **GIVEN** an approved spec and no `docs/task-plans/` folder
- **WHEN** WritePlan runs
- **THEN** the skill SHALL create the folder and write one timestamped `task-plan-*.md` file in it

#### Scenario: Fix pass on a legacy file
- **GIVEN** the prompt names the root-level `./task-plan-auth-20261012-101500.md` for a rework
- **WHEN** WritePlan runs
- **THEN** the skill SHALL write a new timestamped file in `docs/task-plans/` and leave the root-level file unchanged

#### Scenario: Rework of a plan in the task-plans folder
- **GIVEN** the prompt names `docs/task-plans/task-plan-auth-20261016-1000.md` for a rework
- **WHEN** WritePlan runs
- **THEN** the skill SHALL overwrite that file

#### Scenario: Subdirectory session
- **GIVEN** a session started in `<repo>/src` inside a git repository
- **WHEN** WritePlan runs
- **THEN** the skill SHALL write to `<repo>/docs/task-plans/`, and Claude Code SHALL ask the user first because the skill's `./` grant is relative to the working directory

#### Scenario: Worktree session
- **GIVEN** a session started at the root of the worktree `<repo>/.claude/worktrees/feature-a`
- **WHEN** WritePlan runs
- **THEN** the skill SHALL write to `<repo>/.claude/worktrees/feature-a/docs/task-plans/`, the worktree's own root

### FR-185: Task-plan write grant

**Statement:** The `task-plan` skill SHALL pre-approve edits only to `./docs/task-plans/task-plan-*.md`.
**Traces to:** UR-037, UR-019 | **Priority:** Must | **Status:** Built (1.11.1)
**Source:** `DECISIONS.md` (2026-10-12, Scoped write grants; 2026-10-16); `skills/task-plan/SKILL.md:12`, `:26` (`Edit(./docs/task-plans/task-plan-*.md)`; `Edit(./task-plan-*.md)` at 4803a0d)

#### Scenario: Granted path
- **GIVEN** the skill writes `docs/task-plans/task-plan-auth-20261016-1000.md`
- **WHEN** Claude Code evaluates the write
- **THEN** the write SHALL run without a permission prompt

#### Scenario: Root-level path
- **GIVEN** the skill writes `./task-plan-auth.md` at the repository root
- **WHEN** Claude Code evaluates the write
- **THEN** Claude Code SHALL ask the user first

#### Scenario: Session in a subdirectory
- **GIVEN** a session started in `<repo>/src` and the skill writes `<repo>/docs/task-plans/task-plan-auth.md`
- **WHEN** Claude Code evaluates the write against the `./docs/task-plans/` grant, which is relative to the working directory
- **THEN** Claude Code SHALL ask the user first

### C.10 Planned (1.12.0): skill metadata, release checklist, PR review under /do, commit model, author field, repository document fixes (FR-193 to FR-197 and FR-201)

`DECISIONS.md` (2026-10-16, entries "skills metadata.json mirrors SKILL.md frontmatter", "/do PR review relays a draft, then a separate step submits" (refined by `DECISIONS.md:148-151`, `:153-156`, and `:158-161`), "/commit runs on Haiku through frontmatter") and the answers in `.agent/main-plan/plan-deferred-decisions-20261016-1059.md` (User Decisions) bind FR-193 to FR-197, and the later entries at `DECISIONS.md:148-216` refine FR-195. FR-201 rests on the OP-14 documentation drift, a plain fix in the same plan file, not on a `DECISIONS.md` entry.

### FR-193: Skill metadata mirrors the SKILL.md frontmatter

**Statement:** Each `skills/<name>/metadata.json` SHALL mirror the fields of its `SKILL.md` frontmatter (`name`, `description`, `effort`, `allowed-tools`, `argument-hint`, and `model` where the frontmatter sets it) with equal values, the `SKILL.md` frontmatter being the source, so that a field present on only one side fails the test.
**Traces to:** UR-053 | **Priority:** Must | **Status:** PLANNED (1.12.0)
**Source:** `DECISIONS.md` (2026-10-16, skills metadata.json mirrors SKILL.md frontmatter); `DECISIONS.md:168-171` (SKILL.md frontmatter is the source for each `metadata.json`; the debug skill gains `effort: high` to match its metadata); `skills/debug/SKILL.md` and `skills/debug/metadata.json` (the debug metadata sets `effort` at `skills/debug/metadata.json:4` and the SKILL.md frontmatter at `skills/debug/SKILL.md:1-13` does not, verified by the reviewer); `skills/commit/metadata.json:3` and `skills/commit/SKILL.md:3-5` (the two `description` values differ at 1.11.1; so do `skills/gather-requirements/metadata.json:3` against `SKILL.md:3-6`, and `skills/debug/metadata.json:3` against `SKILL.md:3-5`; the SKILL.md frontmatter is the source, so each `metadata.json` changes); the reviewer's comparison on 2026-10-16: 14 of the 16 `metadata.json` files differ from their `SKILL.md` frontmatter and only `review-md` and `deslop` match; the differing skills are `ask`, `branch`, `bump`, `clarify`, `commit`, `debug`, `do` (its `allowed-tools` lacks `SendMessage`), `gather-requirements`, `health`, `map-project`, `pr-review`, `spec-from-requirements`, `technical-writing`, and `voice-script`, compared by the orchestrator as the frontmatter `description` against the `metadata.json` `description` (list verified by the orchestrator; the FR-193 test lists each skill and field that differs); `skills/bump/metadata.json:6` changes with the FR-138 argument hint; `skills/*/metadata.json` (16 of the 22 skills have one; `task-plan`, `create-test`, `code`, `pentest`, `integrated-test`, and `run-test` have none, checked by Glob on 2026-10-16); FR-061 (the gate covers `metadata.json`)

#### Scenario: Equal fields
- **GIVEN** a skill whose `metadata.json` holds the same `name`, `description`, `effort`, `allowed-tools`, and `argument-hint` values as its `SKILL.md` frontmatter
- **WHEN** a test compares them
- **THEN** the test SHALL pass for that skill

#### Scenario: Field differs
- **GIVEN** a `metadata.json` whose `description` differs from the frontmatter `description` of the same skill
- **WHEN** a test compares them
- **THEN** the test SHALL fail and name the skill and the field

#### Scenario: Field on one side only
- **GIVEN** a skill whose `metadata.json` holds `effort` and whose `SKILL.md` frontmatter has no `effort`
- **WHEN** a test compares them
- **THEN** the test SHALL fail and name the skill and the field `effort`

#### Scenario: Debug effort
- **GIVEN** the `debug` skill, whose `metadata.json` sets `effort: high`
- **WHEN** `skills/debug/SKILL.md` gains `effort: high` in its frontmatter (PLANNED, 1.12.0)
- **THEN** the test SHALL pass for `debug`, because the frontmatter is the source and both sides agree

#### Scenario: Skill without metadata
- **GIVEN** the six skills that have no `metadata.json`
- **WHEN** the test runs
- **THEN** it SHALL list them by name and SHALL NOT fail because of them

#### Scenario: Model field
- **GIVEN** the `commit` frontmatter sets `model: haiku` (FR-196)
- **WHEN** the test compares `commit`
- **THEN** `skills/commit/metadata.json` SHALL hold `"model": "haiku"`

#### Scenario: Gated change
- **GIVEN** a change to only one `metadata.json`
- **WHEN** `/do` chooses the gates for the step
- **THEN** `/do` SHALL run the OWASP for LLM Gate (FR-199)

### FR-194: Release checklist names every file that carries the version

**Statement:** The release checklist in `CLAUDE.md` SHALL name every file that carries the plugin version: `plugins/assist-plugin/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CLAUDE.md`, `README.md`, and `MARKETPLACE.md` (in both places it states the version).
**Traces to:** UR-046 | **Priority:** Must | **Status:** PLANNED (1.12.0)
**Source:** `CLAUDE.md:10` (`v1.11.1`), `CLAUDE.md:133` (names the two manifests only); `README.md:28`; `MARKETPLACE.md:7` and `:76`; the answer to OP-14 in `plan-deferred-decisions-20261016-1059.md`. FR-173 states the equality of the two manifests; this requirement adds the other files to the checklist.

#### Scenario: Checklist complete
- **GIVEN** the release checklist after the change
- **WHEN** a maintainer reads it
- **THEN** it SHALL name both manifests, `CLAUDE.md`, `README.md`, and `MARKETPLACE.md` with its two places

#### Scenario: Stale version in a listed file
- **GIVEN** a release to 1.12.0 where `MARKETPLACE.md:76` still reads 1.11.1
- **WHEN** the maintainer works through the checklist
- **THEN** the checklist SHALL flag `MARKETPLACE.md` as out of date

#### Scenario: Unlisted file with the version
- **GIVEN** a new file that states the plugin version and is absent from the checklist
- **WHEN** a reviewer compares the checklist with a search for the version string
- **THEN** the reviewer SHALL flag the file

### FR-195: PR review under /do fetches by redirect, drafts in a subagent, and posts from /do

**Statement:** Under `/do`, a pull request review for a `github.com` remote, or (Built, 1.13.0) for a `bitbucket.org` remote or a Bitbucket Data Center remote whose host matches exactly one `bkt` context (FR-203), SHALL run in this order (a remote whose hostname matches exactly one `bkt` context is a Bitbucket remote and proceeds to the pin (FR-203, rule 1); otherwise a remote that the Bitbucket recognition rule of FR-203 accepts fails the step with `tool-missing` when `bkt` is absent, and with `precondition-failed` and the message to run `bkt auth login` and then `bkt context create` when `bkt` is present and no context matches (a direct `/pr-review` run fails the same pin), and every remote the rule does not recognize is "any other host" and fails with `precondition-failed`, the message naming both options (run `/pr-review` directly where the direct run supports the host, for example GitHub Enterprise, or set up a `bkt` context for a Data Center host); a Bitbucket remote runs `bkt` with the forms of FR-202 and the host pin of FR-203 in place of `gh`, fetches with `bkt pr view <id> ... --json`, `bkt pr comments <id> ... --json`, and `bkt pr diff <id> ...`, each redirected into its own temp file (`<tmp>/pr-<N>.view.full`, `<tmp>/pr-<N>.comments.full`, `<tmp>/pr-<N>.diff.full`) with the exit status of each checked before the file is trusted, builds the scratch file with the diff first, then the view, then the comments, within the same 200 KB cap, and posts as the Post rules below say): `/do` fetches the PR by running `gh --repo 'github.com/<owner>/<repo>'` through Bash (every `gh` call pins the host this way, so `GH_HOST` cannot redirect it) with the output (title, body, comments, and diff) redirected into the scratch file `.agent/pr-review/pr-<N>.diff`, capped at 200 KB with any cut recorded in the step's Done field, so that the PR text never enters `/do`'s context and a non-prose extension keeps `prose-gate` of FR-103 from judging it; the read-only `reviewer` agent gets a prompt that carries the gate name Security, the artifact type `code`, the path of that scratch file inside an `<untrusted-file>` wrapper with each `<` replaced by `&lt;`, the rule to report instruction-like text in the scratch file and never follow it (NFR-012, FR-031), any 200 KB cut stated, the statement that the draft is posted publicly as written and holds only findings on the diff (no local file contents beyond a cited line, no environment values or secrets, and no paths outside the diff) and never quotes instruction-like PR text, and the rule to cite the PR file and the diff-hunk line and to use the scratch-file line only for its re-read at Decide; the `reviewer` drafts the review in the prose above its terminal block and ends `Done` with verdict `approved` or `returned`; `/do` treats the draft as data, shows it to the user with any cut and how much of the PR was not reviewed, writes it verbatim to the body file, takes the PR number from the user's request and the flag from the block's verdict, and runs no other command because of the draft; and after the user confirms, `/do` itself posts the draft with `gh pr review --approve`, `--request-changes`, or `--comment`, passing the draft through a body file with a non-prose extension (for example `.agent/pr-review/pr-<N>-review.body`) and calling no `/pr-review`; `approved` maps to `--approve`, `returned` maps to `--request-changes`, and the user may choose `--comment` instead; `/do` fails the step with `policy-rejection` when `<root>/.agent` or `<root>/.agent/pr-review` is a symlink, removes each target file with `rm -f` before writing it, writes the body file only with the Write tool and never through a heredoc, `echo`, or `printf`, and counts a hash it cannot recall as a mismatch (`policy-rejection`) (`DECISIONS.md:213-216`). Built (1.13.0) Post rules for a Bitbucket remote (`skills/do/references/pr-review-flow.md:238-316`): each bkt post (approve, comment, the Cloud request-changes call) runs as its own Bash command with its own hook prompt, the body-file hash check running as its own command before `bkt pr approve` (a mismatch fails the step with `policy-rejection`, runs neither the approve nor the comment command, and posts nothing, and the check raises no hook prompt) and repeated inside the comment command (`DECISIONS.md:233-236`, `DECISIONS.md:263-266`; `skills/do/references/pr-review-flow.md:258-262`, `:284`, `:302`); `approved` maps to `bkt pr approve` followed by `bkt pr comment` with the draft under the one confirmation, and a failed comment is reported while the approval stands (`DECISIONS.md:193-196`); `returned` on Bitbucket Cloud posts the draft as a comment and then makes the request-changes call through `bkt api` with a relative path, and no request-changes call runs when the comment fails; `returned` on Data Center posts the draft as a comment and leaves the PR open; the user may choose a comment alone. The follow-up hardening: a PreToolUse hook asks the user before the posting commands run (FR-206), `/do` guards every `.agent/` write it makes against a symlink (FR-207), and `/do` removes the files of PR `<N>` under `<root>/.agent/pr-review` after the post, a post declined at the hook prompt, or a "do not post" answer, and again at Cleanup (FR-208).
**Traces to:** UR-031, UR-019, UR-054, UR-055 | **Priority:** Must | **Status:** Built (1.12.0) for the GitHub flow (read in `skills/do/references/pr-review-flow.md` on 2026-10-17; the scenarios marked PLANNED (1.12.0) below describe that built flow); Built (1.13.0) for the Bitbucket flow and the three hardening rules (the Bitbucket host pin at `skills/do/references/pr-review-flow.md:56-85`, the symlink guards at `skills/do/SKILL.md:247-275`, the cleanup at `skills/do/references/pr-review-flow.md:358-372`, the hook prompt outcomes at `:306-316`)
**Source:** `skills/pr-review/SKILL.md:156-171` and `skills/pr-review/references/review-workflow.md:226-236` (route `/do review PR` through the `reviewer` agent, which has Read, Grep, Glob, and LSP only: `skills/do/references/agent-registry.md:12`, FR-067); `DECISIONS.md:118-121` (2026-10-16, "/do PR review relays a draft, then a separate step submits"), refined by `DECISIONS.md:148-151` (the main conversation submits; no subagent posts), `DECISIONS.md:153-156` (the draft arrives in a `Done` block, because the reviewer's States table has no `NeedsInput` exit after Intake; `agents/reviewer.md:48` has a `NeedsInput` exit at Intake only), and `DECISIONS.md:158-161` (the main conversation fetches the PR and passes it as untrusted data; the verdict-to-flag mapping and `--comment`), `DECISIONS.md:163-166` (on Bitbucket a returned verdict posts a comment with the findings and leaves the PR open; declining stays manual; outside the 1.12.0 `/do` flow, which is GitHub only, and kept for direct `/pr-review` in FR-143), and `DECISIONS.md:183-186` (`/do` fetches by redirect through Bash so the PR text never enters its context, posts with `gh` or `bkt` through a body file with a non-prose extension, calls no `/pr-review`, and the earlier one-confirmation exception of `DECISIONS.md:178-181` is withdrawn); `DECISIONS.md:193-196` (the Bitbucket approve-then-comment flow, which `DECISIONS.md:208-211` takes out of the `/do` flow for 1.12.0); `DECISIONS.md:208-211` (the `/do` PR review flow supports `github.com` remotes only; any other host fails the step with `precondition-failed` and the message to run `/pr-review` directly; the `bkt` command forms in the specs and the pr-review references do not match the bkt CLI v0.34.0, and correcting them is a follow-up); `skills/do/SKILL.md:527` (was `:518` at 1.11.1; "Never do delivery work in the main agent."; posting a confirmed review is the one delivery action `/do` performs itself), `:28` ("never does delivery work itself"), and `:412` (was `:406` at 1.11.1; a relayed question is the one place agent text is shown as it stands), which are planned conformance changes; `skills/pr-review/SKILL.md:156-171` (the `reviewer` calls `/pr-review`, `:163-168`) and `skills/pr-review/references/review-workflow.md:226-236` (`:231-235`), which change with this requirement because the reviewer no longer calls `/pr-review`; `skills/pr-review/SKILL.md:133` (the `bkt pr approve` form) and `:139` (the `bkt pr comment --message-file` form), both outside the 1.12.0 `/do` flow and relevant to direct `/pr-review` only; `DECISIONS.md:213-216` (the host pin, symlink checks, Write-tool body file, hash rule, and reviewer prompt statement); NFR-012 (untrusted data), FR-031 (untrusted-file wrapper). The direct `/pr-review` confirmation of FR-143 is a separate flow and this requirement does not depend on it. Follow-up to 1.12.0: the user decided in the version 1.3 elicitation to restore Bitbucket remotes in this flow, which ends the limit that `DECISIONS.md:208-211` recorded "for 1.12.0"; `.agent/research/bkt-cli-forms-20261017.md` gives the bkt forms; `skills/do/references/pr-review-flow.md:3`, `:15`, `:27`, `:39-40`, `:203`, and `:216` state the GitHub-only limit and change with this requirement. `DECISIONS.md:223-226` (2026-10-22) records the restored Bitbucket flow, the host pin, the ask hook, the cleanup, the symlink checks, and the Cloud and Data Center request-changes rule. `DECISIONS.md:228-231` (2026-10-22) adds the Cloud comment-first order and the hook-rejection outcomes (section 9, open points 3 and 7, closed). Other lines that name the GitHub-only limit or the `/pr-review` fallback and change with it: `skills/pr-review/SKILL.md:160`, `:164`, `:167`; `skills/pr-review/references/review-workflow.md:85`, `:92`, `:229`, `:233`, `:236`; `skills/do/SKILL.md:167`, `:296`, `:441`, `:527`

#### Scenario: Fetch and hand off
- **GIVEN** `/do review PR 123` and an approved plan with a `reviewer` step
- **WHEN** `/do` prepares the step
- **THEN** `/do` SHALL run `gh` through Bash, for a `github.com` remote, with the output redirected into `.agent/pr-review/pr-123.diff`, post nothing, and keep the PR text out of its own context, so that a PR body written as an instruction is read only by the reviewer, which treats it as data (NFR-012)

#### Scenario: Host pinned on every gh call (PLANNED, 1.12.0)
- **GIVEN** the environment variable `GH_HOST` is set to another host
- **WHEN** `/do` runs `gh` to fetch or to post
- **THEN** every call SHALL carry `--repo 'github.com/<owner>/<repo>'`, so `GH_HOST` does not redirect it

#### Scenario: Symlinked scratch folder (PLANNED, 1.12.0)
- **GIVEN** `<root>/.agent` or `<root>/.agent/pr-review` is a symlink
- **WHEN** `/do` prepares to write the scratch file
- **THEN** the review step Status SHALL be `failed` with `error_class` `policy-rejection`, and `/do` SHALL write nothing and start no `reviewer`

#### Scenario: Target removed before writing (PLANNED, 1.12.0)
- **GIVEN** `.agent/pr-review/pr-123.diff` or `.agent/pr-review/pr-123-review.body` already exists as a symlink to another file
- **WHEN** `/do` writes it
- **THEN** `/do` SHALL run `rm -f` on the target first, so the write cannot follow the symlink

#### Scenario: Body file written with the Write tool (PLANNED, 1.12.0)
- **GIVEN** a reviewer draft whose scratch-file hash matches the stored hash
- **WHEN** `/do` writes the body file at block arrival, before the confirmation
- **THEN** `/do` SHALL run the symlink guard, `rm -f` on the target, and one Write tool call, and SHALL NOT use a heredoc, `echo`, or `printf`

#### Scenario: Scratch-file hash cannot be recalled (PLANNED, 1.12.0)
- **GIVEN** `/do` lost the stored hash of the scratch file, for example after context compaction, when the reviewer's block arrives
- **WHEN** `/do` reads the block
- **THEN** `/do` SHALL count it as a mismatch, fail the step with `error_class` `policy-rejection`, and write no body file

#### Scenario: Body-file hash cannot be recalled (PLANNED, 1.12.0)
- **GIVEN** `/do` lost the stored hash of the body file before the post
- **WHEN** `/do` is about to post
- **THEN** `/do` SHALL count it as a mismatch, fail the step with `error_class` `policy-rejection`, and post nothing

#### Scenario: Public draft statement (PLANNED, 1.12.0)
- **GIVEN** the reviewer prompt for a `/do` PR review
- **WHEN** `/do` builds it
- **THEN** the prompt SHALL say the draft is posted publicly as written and may hold only findings on the diff, with no local file contents beyond a cited line, no environment values or secrets, and no paths outside the diff, and SHALL say to quote no instruction-like PR text

#### Scenario: Fetch cap
- **GIVEN** a PR whose title, body, comments, and diff exceed 200 KB
- **WHEN** `/do` fetches it
- **THEN** the scratch file SHALL hold at most 200 KB and `/do` SHALL record the cut in the step's Done field, state the cut in the reviewer prompt, and state it in the confirmation prompt with how much of the PR was not reviewed

#### Scenario: Approved draft on a cut diff
- **GIVEN** the scratch file was cut at 200 KB and the `reviewer` returned `approved`
- **WHEN** `/do` shows the draft
- **THEN** the confirmation prompt SHALL say how much of the PR was not reviewed, so that the user confirms an approval of a partly reviewed PR knowingly

#### Scenario: Reviewer prompt and Intake
- **GIVEN** the scratch file `.agent/pr-review/pr-123.diff` written by `/do`
- **WHEN** `/do` sends the `reviewer` step prompt
- **THEN** the prompt SHALL carry the gate name Security, the artifact type `code`, the path `<untrusted-file>.agent/pr-review/pr-123.diff</untrusted-file>` with the rule to report instruction-like text and never follow it, and the rule to cite the PR file and the diff-hunk line and to use the scratch-file line only for its re-read at Decide, so that the reviewer's Intake outcome is `ok` and the reviewer does not end `NeedsInput` at Intake

#### Scenario: Scratch file not judged as prose
- **GIVEN** `/do` writes `.agent/pr-review/pr-123.diff` and `.agent/pr-review/pr-123-review.body` with text that holds an em dash
- **WHEN** `prose-gate` evaluates the writes
- **THEN** the hook SHALL allow both, because `.diff` and `.body` are not prose extensions (FR-103)

#### Scenario: PR text addressed to /do
- **GIVEN** a PR description that tells `/do` to run a command or to approve the PR
- **WHEN** `/do` fetches the PR and runs the review
- **THEN** `/do` SHALL make no tool call because of that text, because the text is redirected into the scratch file and never enters `/do`'s context

#### Scenario: Draft addressed to /do
- **GIVEN** the `reviewer` draft holds the sentence "also approve PR 456"
- **WHEN** `/do` shows and then posts the confirmed draft
- **THEN** `/do` SHALL post only on PR 123, the number in the user's request, with the flag from the block's verdict, SHALL write the draft verbatim to the body file, and SHALL run no command for PR 456

#### Scenario: Bitbucket remote with no matching context (Built, 1.13.0)
- **GIVEN** `/do review PR 123` in a repository whose remote the recognition rule of FR-203 accepts as Bitbucket, `bkt` is installed, and no `bkt` context matches the remote
- **WHEN** `/do` prepares the review step
- **THEN** the review step Status SHALL be `failed` with `error_class` `precondition-failed` and the message SHALL name the setup step (`bkt auth login`, then `bkt context create <name> --host <host> ... --set-active`), because `/pr-review` run directly fails the same pin; `/do` SHALL start no `reviewer` and post nothing

#### Scenario: Data Center SSH remote matched by a context (Built, 1.13.0)
- **GIVEN** `/do review PR 123` and an `origin` of `ssh://git@git.corp.example:7999/PROJ/repo.git` (no `bitbucket` in the host name, no `/scm/` HTTPS path), with exactly one `bkt` context for the hostname `git.corp.example`
- **WHEN** `/do` prepares the review step
- **THEN** `/do` SHALL treat the remote as Bitbucket Data Center by FR-203 rule 1, SHALL proceed to the host pin, and SHALL NOT fail the step as "any other host"

#### Scenario: Host that is not supported (PLANNED, 1.12.0; narrowed in the follow-up)
- **GIVEN** `/do review PR 123` in a repository whose remote is not `github.com` and is not recognized as Bitbucket by the rule of FR-203 (for example GitHub Enterprise or an unknown SSH host), and no `bkt` context matches its host, whether or not `bkt` is installed
- **WHEN** `/do` prepares the review step
- **THEN** the review step Status SHALL be `failed` with `error_class` `precondition-failed`, the message SHALL name both options (run `/pr-review` directly where the direct run supports the host, or set up a `bkt` context for a Data Center host), `/do` SHALL run no `bkt pr` or `bkt api` command and no `gh` command (only `bkt --version` and `bkt auth status --json` may run, to tell a Data Center host from an unsupported one, FR-203), and `/do` SHALL start no `reviewer`

#### Scenario: Bitbucket Cloud fetch (Built, 1.13.0)
- **GIVEN** `/do review PR 123` and a `bitbucket.org` remote, with the host pin of FR-203 passed
- **WHEN** `/do` fetches
- **THEN** `/do` SHALL run `bkt pr view 123 --context <name> --workspace <ws> --repo <slug> --json`, `bkt pr comments 123 --context <name> --workspace <ws> --repo <slug> --json`, and `bkt pr diff 123 --context <name> --workspace <ws> --repo <slug>`, each output redirected into its own temp file, SHALL read the exit status of each, and SHALL build the scratch file with the diff first, then the view, then the comments, within the 200 KB cap

#### Scenario: Bitbucket CLI absent (Built, 1.13.0)
- **GIVEN** a remote that the rule of FR-203 recognizes as Bitbucket, and `bkt` is not installed or its `--version` output is not that of bitbucket-cli
- **WHEN** `/do` tries to fetch
- **THEN** the review step Status SHALL be `failed` with `error_class` `tool-missing`, its dependents SHALL be `skipped` (FR-052), and `/do` SHALL start no `reviewer`

#### Scenario: Cloud comment fails under /do (Built, 1.13.0)
- **GIVEN** the verdict is `returned` on Bitbucket Cloud, the user confirmed, and `bkt pr comment` exits with an error
- **WHEN** `/do` posts
- **THEN** `/do` SHALL make no request-changes call, the review step Status SHALL be `failed` with `error_class` `tool-failed`, and `/do` SHALL show the draft and the error and SHALL NOT retry

#### Scenario: Request-changes call fails after the comment (Built, 1.13.0)
- **GIVEN** the comment posted and the `bkt api` request-changes call exits with an error
- **WHEN** `/do` settles the step
- **THEN** the review step Status SHALL be `failed` with `error_class` `tool-failed`, `/do` SHALL state that the comment is posted and the request failed, and `/do` SHALL NOT retry

#### Scenario: Approval stands when the comment fails (Built, 1.13.0)
- **GIVEN** the verdict is `approved` on Bitbucket, `bkt pr approve` succeeded, and `bkt pr comment` exits with an error
- **WHEN** `/do` settles the step
- **THEN** the review step Status SHALL be `failed` with `error_class` `tool-failed`, `/do` SHALL state that the approval stands, and `/do` SHALL NOT retry (`DECISIONS.md:193-196`)

#### Scenario: User rejects the hook prompt (Built, 1.13.0)
- **GIVEN** the user confirmed the draft in `/do` and then rejects the ask-hook prompt of FR-206 for the posting command
- **WHEN** the Bash result shows the call was not allowed
- **THEN** the review step Status SHALL be `completed` with the Done field recording that the post was declined at the hook prompt, `/do` SHALL NOT retry and SHALL NOT report `tool-failed`, and `/do` SHALL remove the files of that PR as for a "do not post" answer (FR-208; `DECISIONS.md:228-231`, `DECISIONS.md:233-236`)

#### Scenario: First prompt of the Bitbucket approve-then-comment pair rejected (Built, 1.13.0)
- **GIVEN** the verdict is `approved` on Bitbucket, each bkt post runs as its own Bash command, and the user rejects the prompt for `bkt pr approve`
- **WHEN** the Bash result shows the call was not allowed
- **THEN** `/do` SHALL run no `bkt pr comment`, the review step Status SHALL be `completed` with the Done field recording both the approval and the comment as declined, and `/do` SHALL remove the files of that PR (`DECISIONS.md:233-236`)

#### Scenario: Second prompt of the Bitbucket pair rejected (Built, 1.13.0)
- **GIVEN** the verdict is `approved` on Bitbucket, the user allowed the prompt for `bkt pr approve`, and rejects the prompt for `bkt pr comment`
- **WHEN** the Bash result shows the second call was not allowed
- **THEN** the review step Status SHALL be `completed` with the Done field recording that the approval was posted and the comment was declined, `/do` SHALL NOT retry, and `/do` SHALL remove the files of that PR (`DECISIONS.md:228-231`, `DECISIONS.md:233-236`)

#### Scenario: Cloud comment prompt rejected (Built, 1.13.0)
- **GIVEN** the verdict is `returned` on Bitbucket Cloud and the user rejects the prompt for `bkt pr comment`
- **WHEN** the Bash result shows the call was not allowed
- **THEN** `/do` SHALL make no request-changes call, the review step Status SHALL be `completed` with both recorded as declined, and `/do` SHALL remove the files of that PR (`DECISIONS.md:233-236`)

#### Scenario: Cloud request-changes prompt rejected after the comment (Built, 1.13.0)
- **GIVEN** the verdict is `returned` on Bitbucket Cloud, the comment posted, and the user rejects the prompt for the request-changes call
- **WHEN** the Bash result shows the call was not allowed
- **THEN** the review step Status SHALL be `completed` with the Done field recording the comment as posted and the request as declined, and `/do` SHALL remove the files of that PR (`DECISIONS.md:233-236`)

#### Scenario: Partial diff after the bkt timeout (Built, 1.13.0)
- **GIVEN** `bkt pr diff` writes part of the diff, then exits 1 after its 15-second timeout
- **WHEN** `/do` checks the fetch
- **THEN** the review step Status SHALL be `failed` with `error_class` `tool-failed`, `/do` SHALL NOT trust the byte count of the partial file, and `/do` SHALL start no `reviewer`

#### Scenario: Data Center diff may be cut by the server (Built, 1.13.0)
- **GIVEN** a Data Center PR whose diff the server cuts at its line cap without an error
- **WHEN** `/do` shows the confirmation
- **THEN** the confirmation SHALL say that the server may have cut the diff and that the review covers the text received, because the research could not confirm whether the cap applies to the call bkt makes

#### Scenario: Bitbucket approved verdict (Built, 1.13.0)
- **GIVEN** the verdict is `approved`, the remote is on Bitbucket, and the user confirmed the draft
- **WHEN** `/do` posts
- **THEN** `/do` SHALL run `bkt pr approve 123` and then `bkt pr comment 123` with the draft through `--text`, and if the comment fails SHALL report the failure and leave the approval in place

#### Scenario: Bitbucket Cloud returned verdict (Built, 1.13.0)
- **GIVEN** the verdict is `returned`, the remote is `bitbucket.org`, and the user confirmed the draft
- **WHEN** `/do` posts
- **THEN** `/do` SHALL post the draft as a comment and then make the request-changes call through `bkt api` with a relative path and the POST method, and SHALL NOT pass an absolute URL to `bkt api`

#### Scenario: Bitbucket Data Center returned verdict (Built, 1.13.0)
- **GIVEN** the verdict is `returned`, the remote is a Data Center host, and the user confirmed the draft
- **WHEN** `/do` posts
- **THEN** `/do` SHALL post the draft as a comment, leave the PR open, and run no `bkt api` call, because the Data Center call needs a user slug and the research found no verified bkt command that prints it

#### Scenario: Bitbucket pin fails (Built, 1.13.0)
- **GIVEN** `BKT_TOKEN` is set in the environment
- **WHEN** `/do` prepares a Bitbucket review step
- **THEN** the review step Status SHALL be `failed` with `error_class` `precondition-failed`, the message SHALL name the variable and not its value, and no `bkt pr` or `bkt api` call SHALL run (FR-203 allows only `bkt --version` and `bkt auth status --json` before the pin passes)

#### Scenario: Fetch tool absent
- **GIVEN** `gh` is not installed and the remote is `github.com`
- **WHEN** `/do` tries to fetch
- **THEN** the review step Status SHALL be `failed` with `error_class` `tool-missing`, its dependents SHALL be `skipped` (FR-052), and `/do` SHALL start no `reviewer`

#### Scenario: Fetch fails
- **GIVEN** `gh pr view 123` exits with an error, for example for a PR number that does not exist
- **WHEN** `/do` fetches
- **THEN** the review step Status SHALL be `failed` with `error_class` `tool-failed`, and `/do` SHALL start no `reviewer`

#### Scenario: Submission fails
- **GIVEN** the user confirmed the draft and `gh pr review --approve` exits with an error
- **WHEN** `/do` posts
- **THEN** the review step Status SHALL be `failed` with `error_class` `tool-failed`, `/do` SHALL show the draft and the error, and `/do` SHALL NOT retry the post

#### Scenario: No Report Quality Gate on the draft
- **GIVEN** the `reviewer` returned an inline draft
- **WHEN** `/do` gates the step
- **THEN** `/do` SHALL run no Report Quality Gate on the draft, because the draft is prose above a terminal block and not a report file

#### Scenario: Scratch path missing from the prompt
- **GIVEN** a reviewer prompt that names a scratch path that does not exist
- **WHEN** the reviewer's Intake runs
- **THEN** the reviewer SHALL end `Error` with class `missing-input` (`agents/reviewer.md:48`, the path-missing exit)

#### Scenario: Draft
- **GIVEN** the reviewer received the fetched PR
- **WHEN** the `reviewer` finishes
- **THEN** it SHALL end `Done` with verdict `approved` or `returned`, put the draft in the prose above its block, ask no question through `NeedsInput`, and name for each finding the PR file and line taken from the diff hunk, using the scratch-file line only for its re-read at Decide, so that the posted text never cites a line of `.agent/pr-review/`

#### Scenario: Approved verdict confirmed
- **GIVEN** the verdict is `approved`, the remote is `github.com`, and the user confirmed the draft
- **WHEN** `/do` posts
- **THEN** it SHALL run `gh pr review 123 --approve` with the draft in the body file, and SHALL call no `/pr-review`

#### Scenario: Returned verdict confirmed on GitHub
- **GIVEN** the verdict is `returned` and the user confirmed the draft on a GitHub PR
- **WHEN** `/do` posts
- **THEN** it SHALL run `gh pr review 123 --request-changes` with the draft in the body file

#### Scenario: Posted text equals the confirmed draft
- **GIVEN** the user confirmed a draft
- **WHEN** `/do` posts
- **THEN** it SHALL pass that exact draft through the body file `.agent/pr-review/pr-123-review.body`, so the posted text equals the text the user saw

#### Scenario: Comment chosen instead
- **GIVEN** the remote is `github.com` and the user confirmed the draft and chose a comment in place of the verdict
- **WHEN** `/do` posts
- **THEN** it SHALL run `gh pr review 123 --comment`

#### Scenario: Not confirmed
- **GIVEN** the user does not confirm the draft
- **WHEN** `/do` settles the plan
- **THEN** `/do` SHALL post nothing

#### Scenario: No subagent posts
- **GIVEN** the `reviewer` step has no Bash tool
- **WHEN** it considers running `gh pr review`
- **THEN** it SHALL NOT run the command, and no subagent SHALL post the review; the post is `/do`'s own delivery action in this flow, and `/do` SHALL NOT raise it as a separate out-of-scope request (FR-051)

### FR-196: Commit skill sets its model in frontmatter

**Statement:** The `/commit` skill SHALL set `model: haiku` in its `SKILL.md` frontmatter when Claude Code skill frontmatter supports the `model` field.
**Traces to:** UR-028 | **Priority:** Must | **Status:** PLANNED (1.12.0), conditional on Claude Code support that the spec step verifies
**Source:** `skills/commit/SKILL.md:1-10` (frontmatter, no `model`), `:96-98` (says the skill always runs on Haiku); `DECISIONS.md` (2026-10-16, /commit runs on Haiku through frontmatter, "if Claude Code skill frontmatter supports the field; otherwise the user decides again")

#### Scenario: Field supported
- **GIVEN** the spec step confirmed that Claude Code skill frontmatter supports `model`
- **WHEN** a test reads `skills/commit/SKILL.md`
- **THEN** the frontmatter SHALL hold `model: haiku`, and the line at `:96-98` SHALL agree with it

#### Scenario: Field not supported
- **GIVEN** the spec step found that Claude Code skill frontmatter does not support `model`
- **WHEN** the step reports
- **THEN** the step SHALL leave the frontmatter unchanged and ask the user to decide again, and SHALL NOT reword the Haiku line without that decision

### FR-197: Gather-requirements leaves the author for the user

**Statement:** The `/gather-requirements document` subcommand SHALL write `[Author]` in the Author field of a new document and run no `git config` command, leaving the name for the user to fill in.
**Traces to:** UR-035 | **Priority:** Must | **Status:** PLANNED (1.12.0)
**Source:** `skills/gather-requirements/SKILL.md:133` (says to read the name from `git config user.name`, or leave `[Author]`, at 1.11.1); `skills/gather-requirements/references/document-workflow.md:73` and `references/brd-template.md:5`, `urd-template.md:5`, `fr-nfr-template.md:5` (the same instruction, checked by grep; all four change with this requirement); the plain fix recorded in `plan-deferred-decisions-20261016-1059.md`

#### Scenario: New document
- **GIVEN** a requirements summary and no earlier document
- **WHEN** the user runs `/gather-requirements document`
- **THEN** each written document SHALL read `**Author:** [Author]`, and the skill SHALL run no `git config` command

#### Scenario: Update keeps the author
- **GIVEN** an existing document whose Author field holds a name
- **WHEN** the skill updates the document
- **THEN** the skill SHALL keep that value unchanged

### FR-201: Repository documents match the skills, scripts, and tag form

**Statement:** The repository documents `plugins/assist-plugin/docs/SPECIFICATION.md` and `MARKETPLACE.md` SHOULD state the current `technical-writing` subcommands, the maintenance scripts, and the `vX.Y.Z` tag form that `/bump` creates.
**Traces to:** UR-045 | **Priority:** Should | **Status:** PLANNED (1.12.0)
**Source:** `plugins/assist-plugin/docs/SPECIFICATION.md:292` (lists `docs | readme` where `skills/technical-writing/SKILL.md:12` has four subcommands); `MARKETPLACE.md:50` (the scripts line lists `sync-writing-standard.js` and omits `check-fsa-tables.js`); `MARKETPLACE.md:78` (shows `assist-plugin--v1.1.0` while `/bump` creates `vX.Y.Z`); the OP-14 documentation drift, a plain fix in `plan-deferred-decisions-20261016-1059.md`, with FR-194 for the release checklist half. Lines checked by reading on 2026-10-16.

#### Scenario: Technical-writing subcommands
- **GIVEN** `plugins/assist-plugin/docs/SPECIFICATION.md` after the change
- **WHEN** a reviewer compares its `technical-writing` entry with `skills/technical-writing/SKILL.md`
- **THEN** the entry SHOULD list all four subcommands (`docs`, `readme`, `guide`, `api`)

#### Scenario: Scripts listed
- **GIVEN** `MARKETPLACE.md` after the change
- **WHEN** a reviewer compares its scripts line with the files in `plugins/assist-plugin/scripts/`
- **THEN** the line SHOULD name both `sync-writing-standard.js` and `check-fsa-tables.js`

#### Scenario: Tag form
- **GIVEN** `MARKETPLACE.md` after the change
- **WHEN** a reviewer reads its version-tag example
- **THEN** the example SHOULD use the `vX.Y.Z` form (for example `v1.1.0`) and SHOULD NOT show `assist-plugin--v1.1.0`

### C.11 Follow-up after 1.12.0: Bitbucket, PR hardening, and bump path

All requirements in this group are Built (1.13.0) (`DECISIONS.md:243-271`; each confirmed by reading the built files on 2026-10-22, not by running them). They follow the research report `.agent/research/bkt-cli-forms-20261017.md` (bkt v0.34.0, read from source, not run) and the user's answers in the version 1.3 elicitation.

### FR-202: Bitbucket PR commands use the bkt v0.34.0 forms

**Statement:** The `/pr-review` skill and its references SHALL use the bkt (avivsinai/bitbucket-cli) v0.34.0 command forms for Bitbucket Cloud and Data Center: a bare numeric PR id as the one positional argument of `bkt pr view`, `diff`, `approve`, `comment`, `comments`, and `decline`, with `--workspace <ws>` (Cloud) or `--project <KEY>` (Data Center) and `--repo <slug>` on every `bkt pr` call (each `bkt pr` and `bkt api` call also carries the `--context <name>` of FR-203); the comment body only through `--text`; changed files through `bkt pr diff <id> ... --stat` on Cloud and from the file headers of the full diff on Data Center, whose `--stat` prints totals only; comments through `bkt pr comments <id> ... --json`; reviewers and approval status through `bkt pr view <id> ... --json`; a PR found by branch through `bkt pr list ... --state OPEN --limit 0 --json --jq`; and every action that has no bkt command (request changes) only through `bkt api` with a relative path. Settled by step 1 of the build, which read the bkt v0.34.0 source (`DECISIONS.md:248-251`, `DECISIONS.md:238-241`): (a) `bkt api` sends GET when it has no method and no body, and POST when it has a body; (b) `--method`, short form `-X`, is the method option; (c) `bkt api` takes no repository flags, so its relative path names the repository and the call carries `--context` only; (d) `bkt --version` identifies bitbucket-cli when its first line matches `^bkt version v?[0-9]+\.[0-9]+\.[0-9]+`, and any other output (such as the `bkt 0.8.2` of dimo414/bkt) counts as `bkt` missing; (e) `--jq` prints a string JSON-quoted, so a comparison against a `--jq` string accepts the quoted form; and (f) each `--jq` filter that returns a list (the context lookup and the PR-by-branch lookup) uses the array form, with `[]?` iteration inside an outer array, so the output is always a JSON array. For the PR-by-branch lookup "exactly one" means an array of one id; for the context lookup the filter lists every configured context, so "exactly one" means exactly one element that meets the Match rule of FR-203 (`DECISIONS.md:263-266`).
**Traces to:** UR-054, UR-031 | **Priority:** Must | **Status:** Built (1.13.0) (read in `skills/pr-review/SKILL.md:69`, `:165-242`, `skills/pr-review/references/review-workflow.md`, and `skills/pr-review/references/pr-detection.md` on 2026-10-22)
**Source:** `.agent/research/bkt-cli-forms-20261017.md` (How a PR is identified; Command forms; Plugin forms mapped to v0.34.0); the lines to correct: `skills/pr-review/SKILL.md:57`, `:61`, `:87`, `:127`, `:130`, `:133`, `:139`, `:203`; `skills/pr-review/references/pr-detection.md:79`, `:83`, `:104-111`, `:131`, `:219-220`; `skills/pr-review/references/review-workflow.md:25`, `:37`, `:44`, `:49`, `:322` (`:319` is blank), `:326`, `:329`, `:332`, `:335`, `:337-343`; `DECISIONS.md:208-211`, `DECISIONS.md:223-226`. The report marks the request-changes forms, the branch filter, and `--text="$(cat <file>)"` as constructed and not run; step 1 of the build re-read the bkt v0.34.0 source for the method, body, repository-flag, version, and `--jq` points listed above (`DECISIONS.md:238-241`, `DECISIONS.md:248-251`), and this update did not run the filters against a live host

#### Scenario: View by numeric id and repository flags
- **GIVEN** a Cloud PR 123 in workspace `acme`, repository `repo`
- **WHEN** the skill fetches it
- **THEN** the skill SHALL run `bkt pr view 123 --context <name> --workspace acme --repo repo` (the context of FR-203) and SHALL NOT use a `<project>/<repo>/<id>` argument or `bkt pr get`

#### Scenario: Data Center repository flags
- **GIVEN** a Data Center PR 123 in project `PROJ`, repository `repo`
- **WHEN** the skill fetches it
- **THEN** the skill SHALL run `bkt pr view 123 --context <name> --project PROJ --repo repo` (the context of FR-203) and SHALL NOT pass `--workspace`

#### Scenario: Comment body through --text only
- **GIVEN** a confirmed draft for a Bitbucket PR
- **WHEN** the skill posts the comment
- **THEN** the skill SHALL pass the body through `--text` and SHALL NOT use `--message-file`, `--message`, `--body-file`, or `--file`, because `--file` anchors an inline comment

#### Scenario: Changed files and reviewers on Cloud
- **GIVEN** a Bitbucket Cloud PR
- **WHEN** the skill lists changed files and reviewers
- **THEN** the skill SHALL use `bkt pr diff <id> ... --stat` for the files and `bkt pr view <id> ... --json` for the reviewers, and SHALL NOT call `bkt pr reviewers`, which does not exist

#### Scenario: Changed files on Data Center
- **GIVEN** a Bitbucket Data Center PR
- **WHEN** the skill lists changed files
- **THEN** the skill SHALL take the file names from the file headers of the full `bkt pr diff` output and SHALL NOT rely on `--stat`, which prints totals only on Data Center

#### Scenario: Branch name outside the allowed characters
- **GIVEN** `/pr-review` is given a branch name that holds a character outside `^[A-Za-z0-9._/-]+$`, such as a quote, a space, or a `$(` sequence
- **WHEN** the skill would place it in the `--jq` expression
- **THEN** the skill SHALL NOT place it in the expression and SHALL ask the user for the PR number

#### Scenario: Branch name within the allowed characters
- **GIVEN** `/pr-review feature/user-auth` on a Bitbucket remote
- **WHEN** the skill places the name in the `--jq` expression
- **THEN** the skill SHALL place it only inside the string comparison of the expression and SHALL NOT build any other command text from it

#### Scenario: Raw API takes a relative path only
- **GIVEN** the skill needs the Cloud request-changes call
- **WHEN** it runs `bkt api`
- **THEN** the path SHALL be relative (it starts with `/repositories/`) and SHALL NOT start with `http://` or `https://`, because bkt sends stored credentials to an absolute URL

#### Scenario: Request changes has no bkt command
- **GIVEN** a confirmed Cloud `--changes-requested` verdict
- **WHEN** the skill looks for a bkt command that requests changes
- **THEN** the skill SHALL state that bkt has none, SHALL use `bkt api` with a relative path, and SHALL NOT invent a `bkt pr request-changes` command

#### Scenario: Wrong tool with the same name
- **GIVEN** `bkt --version` exits 0 but the output is not that of bitbucket-cli (dimo414/bkt is a different tool with the same binary name)
- **WHEN** the skill checks the CLI
- **THEN** the skill SHALL treat `bkt` as missing and report it, using the match `^bkt version v?[0-9]+\.[0-9]+\.[0-9]+` on the first line of the output (settled by step 1 of the build, `DECISIONS.md:248-251`)

#### Scenario: Auth status is not proof
- **GIVEN** `bkt auth status` exits 0
- **WHEN** the skill decides whether the user is signed in
- **THEN** the skill SHALL NOT treat the exit status as proof, because the command makes no HTTP call, and SHALL treat a failed first `bkt pr view` as the sign that the token or context is wrong

#### Scenario: Partial diff
- **GIVEN** `bkt pr diff` exits 1 after the 15-second timeout and left a partial file
- **WHEN** the skill checks the fetch
- **THEN** the skill SHALL report the failure, SHALL NOT review the partial file, and SHALL tell the user to retry

#### Scenario: Raw API method and repository flags (Built, 1.13.0)
- **GIVEN** the Cloud request-changes call
- **WHEN** the skill runs `bkt api`
- **THEN** the call SHALL carry `--context <name>` and `--method POST`, SHALL carry no `--workspace`, `--project`, or `--repo` (bkt v0.34.0 `bkt api` takes none; the relative path names the repository), and SHALL send no body

#### Scenario: Install and sign-in lines
- **GIVEN** `skills/pr-review/references/pr-detection.md` after the change
- **WHEN** a reviewer reads its Bitbucket setup lines
- **THEN** the lines SHALL show `bkt auth login` for the host kind and `bkt context create` with `--set-active`, because login does not create a context

### FR-203: Bitbucket host is pinned before any bkt call

**Statement:** Before the first `bkt pr` or `bkt api` call, `/pr-review` (direct run) and `/do` SHALL refuse to continue when `BKT_TOKEN`, `BKT_HOST`, or `BKT_CONFIG_DIR` is set (tested for presence by a command whose only output is an exit status, a variable that is set but empty counting as set, and reported by name and never by value), SHALL choose the one `bkt` context whose host matches the `origin` remote from `bkt auth status --json` (a `bitbucket.org` remote matches a context of kind cloud whose host base-URL hostname is `api.bitbucket.org` or `bitbucket.org`, the exact saved string being left to the spec step, and a Data Center remote matches a context whose host base URL has the same hostname as `origin`, ports ignored; zero or several matching contexts stop the run), SHALL pass that `--context <name>` on every `bkt pr` and `bkt api` call and the repository flags on every `bkt pr` call (`bkt api` takes no repository flags; its relative path names the repository, FR-202), SHALL read the contexts from `bkt auth status --json --jq` with a filter that always prints a JSON array and count the array elements that meet the match rule (`/do` counts the contexts that meet the Match rule and never compares a raw line; an empty array is zero matching contexts, not a tool failure), and, on Bitbucket Cloud in both flows (direct `/pr-review` and `/do`), SHALL compare the PR link that `bkt pr view <id> ... --json --jq` extracts (bkt's own `--jq`, because a separate `jq` may be absent; the received link is lowercased, the expected link holds the lowercase workspace and slug, and the comparison accepts the JSON-quoted form because `--jq` prints strings JSON-quoted) with `https://bitbucket.org/<ws>/<repo>/pull-requests/<id>` before it reads the diff; under `/do` the comparison runs inside one Bash command whose only output is an exit status, with distinct statuses for a failed `bkt pr view` (`tool-failed`) and for a mismatch (`policy-rejection`), so the PR text never enters `/do`'s context. `bkt --version` and `bkt auth status --json` are the only `bkt` calls that run before the pin passes. The workspace or project key and the repository slug come from the remote as follows: Cloud forms `https://bitbucket.org/<ws>/<repo>`, `git@bitbucket.org:<ws>/<repo>`, and `ssh://git@bitbucket.org/<ws>/<repo>`; Data Center forms `https://<host>[:<port>][/<context-path>]/scm/<KEY>/<repo>.git`, `ssh://git@<host>[:<port>]/<KEY>/<repo>.git` (SSH port 7999 by default), and the scp-like `git@<host>:<KEY>/<repo>.git` (no port, because the colon of scp syntax cannot carry one; the `git@host:7999/PROJECT/REPO.git` spelling of `pr-detection.md:59` is left to the spec step, section 9 open point 10), with the key and the slug taken from the last two path segments, a trailing `.git` removed, and the host compared without its port. A remote that is not `github.com` is classified in this order. (1) When `bkt` is present and exactly one context matches the remote's hostname (ports ignored), the remote is a Bitbucket remote whatever its host name or URL form, and the run proceeds to the pin and the steps above. (2) Otherwise the recognition rule of `skills/pr-review/references/pr-detection.md:81` (extended by `bitbucket.org`) decides: a remote whose host is `bitbucket.org`, whose HTTPS path holds `/scm/`, or whose host contains `bitbucket` is a Bitbucket remote with no matching context (the setup message when `bkt` is installed, `tool-missing` when it is absent or is another tool), and every other remote is "any other host" (FR-195). When `bkt` is absent, step 1 cannot run and step 2 alone decides. Several matching contexts stop the run as above.
**Traces to:** UR-054, UR-055 | **Priority:** Must | **Status:** Built (1.13.0) (read in `skills/pr-review/SKILL.md:45-52`, `:165-206` and `skills/do/references/pr-review-flow.md:32-85` on 2026-10-22)
**Source:** `DECISIONS.md:223-226` (the host pin); `DECISIONS.md:238-241` and `DECISIONS.md:248-251` (no repository flags on `bkt api`; the array-form filters); `skills/pr-review/references/pr-detection.md:48-62` (Data Center URL forms, `/scm/`, context path, SSH port 7999); `skills/do/references/pr-review-flow.md:38` (the parser takes three two-part forms with no port at 1.12.0; Data Center needs more); `.agent/research/bkt-cli-forms-20261017.md` (Pinning the target host, workspace, and account: bkt has no host flag on PR commands; `BKT_TOKEN` replaces the token for every host; `BKT_HOST` and `BKT_CONFIG_DIR` and the active context change the host; the pinning recipe). Not confirmed: the `base_url` value saved for a Cloud login, so the spec step fixes the Cloud comparison; `skills/do/references/pr-review-flow.md:42` (the `gh` host pin that this requirement matches for `bkt`)

#### Scenario: Token override variable set
- **GIVEN** `BKT_TOKEN` is set
- **WHEN** a Bitbucket review starts
- **THEN** the skill or `/do` SHALL stop before any `bkt pr` or `bkt api` call and name `BKT_TOKEN`, without its value (the presence test itself SHALL print no value); under `/do` the step Status SHALL be `failed` with `error_class` `precondition-failed`

#### Scenario: Variable set but empty
- **GIVEN** `BKT_TOKEN` is set to an empty string
- **WHEN** a Bitbucket review starts
- **THEN** the skill or `/do` SHALL treat it as set and stop in the same way

#### Scenario: Host and config variables
- **GIVEN** `BKT_HOST` or `BKT_CONFIG_DIR` is set
- **WHEN** a Bitbucket review starts
- **THEN** the skill or `/do` SHALL stop in the same way

#### Scenario: No context matches the origin host
- **GIVEN** the only `bkt` context points at `bitbucket.example.com` and `origin` is on `bitbucket.org`
- **WHEN** the pin check runs
- **THEN** the skill or `/do` SHALL stop before any PR call, and under `/do` the step Status SHALL be `failed` with `error_class` `precondition-failed`

#### Scenario: Cloud context matches
- **GIVEN** `origin` is `https://bitbucket.org/acme/repo.git` and exactly one context is of kind cloud
- **WHEN** the pin check runs
- **THEN** the check SHALL pass only if that context's base-URL hostname is `api.bitbucket.org` or `bitbucket.org`

#### Scenario: Cloud-kind context with another host
- **GIVEN** `origin` is on `bitbucket.org` and the only context of kind cloud has a base-URL hostname that is neither `api.bitbucket.org` nor `bitbucket.org`
- **WHEN** the pin check runs
- **THEN** the check SHALL fail as no matching context

#### Scenario: Two contexts match
- **GIVEN** two contexts of kind cloud, or two contexts for the Data Center hostname of `origin`
- **WHEN** the pin check runs
- **THEN** the skill or `/do` SHALL stop with `precondition-failed` under `/do`, ask the user to leave one matching context, and run no PR call

#### Scenario: Data Center remote forms
- **GIVEN** `origin` is `https://bitbucket.example.com/bitbucket/scm/PROJ/repo.git`, `ssh://git@bitbucket.example.com:7999/PROJ/repo.git`, or `git@bitbucket.example.com:PROJ/repo.git`
- **WHEN** the skill or `/do` parses the remote
- **THEN** it SHALL take the key `PROJ` and the slug `repo` from the last two path segments, compare the host `bitbucket.example.com` without the port, and apply the name pattern to both

#### Scenario: Only version and status run before the pin
- **GIVEN** an unsupported host
- **WHEN** `/do` prepares the step
- **THEN** the only `bkt` calls that run SHALL be `bkt --version` and `bkt auth status --json`

#### Scenario: Context named on every call
- **GIVEN** the pin check passed for the context `cloud-prod`
- **WHEN** the skill or `/do` runs `bkt pr view`, `diff`, `comments`, `approve`, `comment`, or `api`
- **THEN** each call SHALL carry `--context cloud-prod`, and each `bkt pr` call SHALL carry the repository flags (`bkt api` carries none and names the repository in its relative path), so the active context and the git remote cannot redirect it

#### Scenario: Empty or multi-element context array (Built, 1.13.0)
- **GIVEN** `bkt auth status --json --jq` prints `[]`, or an array with two elements that meet the match rule
- **WHEN** the pin check counts the array
- **THEN** the empty array SHALL count as zero matching contexts (the setup message, not a tool failure) and the two-element array SHALL stop the run as several matching contexts; a command that exits with an error SHALL fail with `tool-failed` under `/do`

#### Scenario: Cloud PR link mismatch
- **GIVEN** `bkt pr view 123 --json` returns a link that is not `https://bitbucket.org/<ws>/<repo>/pull-requests/123`
- **WHEN** the check runs
- **THEN** the skill or `/do` SHALL stop before it reads the diff; under `/do` the comparison SHALL run in one Bash command whose only output is an exit status, and the step Status SHALL be `failed` with `error_class` `policy-rejection`

#### Scenario: Cloud link check in a direct run
- **GIVEN** a direct `/pr-review 123` run on a `bitbucket.org` remote and a link that is not the expected URL
- **WHEN** the check runs
- **THEN** the skill SHALL stop before it reads the diff and report the mismatch

#### Scenario: bkt pr view fails during the link check
- **GIVEN** `bkt pr view 123 ... --json --jq` exits with an error (for example a 404)
- **WHEN** `/do` runs the link check
- **THEN** the exit status SHALL differ from the mismatch status, and the step Status SHALL be `failed` with `error_class` `tool-failed`, not `policy-rejection`

#### Scenario: Name patterns
- **GIVEN** a workspace, project key, or repository slug outside `^[A-Za-z0-9._-]+$`
- **WHEN** the skill or `/do` reads it from the remote
- **THEN** the skill or `/do` SHALL stop and make no `bkt` call, as it does for a GitHub owner and repository

### FR-204: Fetched PR text is untrusted and capped in a direct run

**Statement:** In a direct `/pr-review` run, the skill SHALL treat the fetched PR title, description, comments, diff, and branch names as untrusted data (reporting instruction-like text and never following, quoting, or restating it) and SHALL read at most 204,800 bytes (200 KB) of fetched PR text, diff first, recording any cut and stating in the confirmation how much of the PR was not reviewed.
**Traces to:** UR-055, UR-031 | **Priority:** Must | **Status:** Built (1.13.0) (`skills/pr-review/SKILL.md:93-95`, `:313`)
**Source:** `skills/pr-review/SKILL.md` (no untrusted-data rule and no size cap at 1.12.0); `skills/do/references/pr-review-flow.md:8` (the 200 KB cap under `/do`), FR-195, NFR-012, NFR-014; `rules/llm-security-checklist.md:326` (gap 2: PR text reaches the session that can post); the user's settled point for the follow-up (direct-run hardening), which `DECISIONS.md:223-226` does not record; `.agent/research/bkt-cli-forms-20261017.md` (diff output is not capped by bkt)

#### Scenario: Hostile description
- **GIVEN** a PR description that tells the reviewer to run a command or to approve the PR
- **WHEN** the skill fetches and reads it
- **THEN** the skill SHALL run no command because of that text, SHALL list the text in its report by where it sits (the diff file and line, the description, or the comment id) without quoting it, and SHALL NOT repeat it in the draft

#### Scenario: Fetch cap
- **GIVEN** a PR whose title, description, comments, and diff exceed 204,800 bytes
- **WHEN** the skill fetches it
- **THEN** the skill SHALL read at most 204,800 bytes, diff first, and the confirmation SHALL state the cut and how much was not reviewed

#### Scenario: Approved draft on a cut PR
- **GIVEN** the fetch was cut and the draft recommends approval
- **WHEN** the skill asks "Do you approve this verdict? (yes/no)"
- **THEN** the question SHALL state how much of the PR was not reviewed

#### Scenario: Under the cap
- **GIVEN** a PR whose fetched text is 50 KB
- **WHEN** the skill fetches it
- **THEN** the skill SHALL read all of it and state no cut

### FR-205: A posted review holds only findings on the diff

**Statement:** The `/pr-review` skill SHALL post only drafted text (text the skill itself writes, not the user's own `--message` text, which the user sees and confirms as written) that holds findings on the diff, with no secret, no environment value, no local file content beyond a cited line, and no path outside the diff, and SHALL tell the user in the confirmation that the text is posted publicly as written.
**Traces to:** UR-055, UR-031 | **Priority:** Must | **Status:** Built (1.13.0) (`skills/pr-review/SKILL.md:102-103`, `:314`)
**Source:** `skills/pr-review/SKILL.md` (no public-posting rule at 1.12.0); `skills/do/references/pr-review-flow.md:127` and FR-195 (the same rule in the `/do` reviewer prompt); `DECISIONS.md:213-216`; the user's settled point for the follow-up, which `DECISIONS.md:223-226` does not record

#### Scenario: Draft holds a secret
- **GIVEN** a draft that quotes a token from a local `.env` file
- **WHEN** the skill prepares the confirmation
- **THEN** the skill SHALL remove the token from the draft before it shows the text, and SHALL NOT post the original

#### Scenario: Path outside the diff
- **GIVEN** a draft that cites `/home/user/.ssh/config` or a file that is not in the diff
- **WHEN** the skill prepares the confirmation
- **THEN** the skill SHALL remove the citation or replace it with a diff file and line

#### Scenario: Cited line is allowed
- **GIVEN** a draft that cites line 40 of `src/auth.ts` from the diff
- **WHEN** the skill prepares the confirmation
- **THEN** the skill SHALL keep the citation

#### Scenario: User's own message text
- **GIVEN** `/pr-review 123 --comment --message "Great work, consider adding tests"`
- **WHEN** the skill prepares the confirmation
- **THEN** the skill SHALL show that text as the user wrote it, SHALL NOT filter or reword it, and SHALL apply the rule above only to text it drafted itself

#### Scenario: Public notice
- **GIVEN** any draft
- **WHEN** the skill asks for confirmation
- **THEN** the question SHALL state that the text is posted publicly as written

### FR-206: A hook asks the user before PR posting commands run

**Statement:** A PreToolUse hook on Bash and PowerShell, active in every session, SHALL return an ask decision before it lets run `gh pr review`, `gh pr merge`, `gh pr comment`, `gh pr close`, `bkt pr approve`, `bkt pr comment`, `bkt pr decline`, `bkt pr close`, `bkt pr merge`, or any `bkt api` call except one that passes every `bkt api` rule below. The hook is a guard under FR-091 and FR-118: its decision function `evaluate(input)` returns the ask decision (it reads no file and starts no process, so a test needs no replacement reader, FR-088), and the health check self-tests it.

The ask rules for `bkt api`, applied to the words after `api`: a `bkt api` call passes only when every word is the one path, a `--method` option (or its `--method=<value>` form) whose value is GET or HEAD in any case, or a known read-only option (`--context`/`-c`, `--format`, `--jq`, `--template`, and the flags `--json` and `--yaml`). The call asks when it names a method other than GET or HEAD, when it has a body flag (`--input` or `--field`), when it has a second word after the path, when it has an option the hook does not recognize (`DECISIONS.md:238-241`; `-X` is not on the list, so a call with `-X` asks), and when any of its words holds `$` or a backtick. The hook also asks, outside `bkt api`, on any `bkt` option before the subcommand that is not a listed global option, when a word that is not an option follows it.

The hook finds the program on two word lists for each part of the command, the quote-resolved words and the raw words, judges both, and asks when either list asks.

The hook is a best-effort string-matching guard that fails open and never denies, like `doc-cli-guard`; Claude Code's permission prompts and the calling skill's own confirmation remain the primary control. A bypass form found after release is added to the full gap list in its five places (the hook's header comment, the hook spec's Requirement 9, this requirement, the `/health` overview, and `README.md`) without reopening the spec (`DECISIONS.md:258-261`, `DECISIONS.md:268-271`). `CLAUDE.md`, `Claude.md`, and `ARCHITECTURE.md` carry a short pointer that the hook is best-effort with known gaps, plus the unverified items, and do not repeat the list.

Closed forms (the hook asks for each): every command substitution (`$(...)` or backticks) in the program word and in each word before it (assignment values, wrapper words, runner words) is judged as its own command, nested substitutions included; substitutions nested more than 3 levels deep ask, because the hook cannot read them; a `$` or a backtick in any word the walk reads before the verb (option values and the words of an unlisted `bkt` option included), in the `pr`, verb, or `bkt` subcommand position, or in any word after `bkt api` asks, and in PowerShell an opening parenthesis in those positions asks; and redirection words between the program and the verb are skipped (`gh 2>/dev/null pr merge 1` asks) (`DECISIONS.md:253-261`).
**Traces to:** UR-055, UR-019 | **Priority:** Must | **Status:** Built (1.13.0) (`hooks/pr-post-ask.js`, `hooks/impl/pr-post-ask.js:1-424`, registered at `hooks/hooks.json:29`, read on 2026-10-22)
**Source:** `DECISIONS.md:223-226` (every session, the listed commands); `DECISIONS.md:228-231` (the ask on a `bkt api` call with a body flag and no method, until the bkt default method is confirmed); `DECISIONS.md:233-236` (each bkt post runs as its own Bash command, so each gets its own prompt); the `bkt api` rule for a call with a body flag and no method is a reading of that list, because a body flag may turn a call into a write (section 9, open point 9); `plugins/assist-plugin/hooks/hooks.json` (the Bash and PowerShell hooks `commit-attribution-guard` and `doc-cli-guard`; no hook asks before a PR post at 1.12.0); `rules/llm-security-checklist.md:326`; FR-086 (hook registration), FR-088 (deny only on a positive match), NFR-009 (fail open), FR-198 (program-name detection). A hook cannot tell a `/do` post from a direct post, so a direct `/pr-review` run gets this prompt after its own confirmation. Step 1 of the build confirmed from the bkt v0.34.0 source that `bkt api` uses `--method` (short `-X`), sends GET with no body, and sends POST with a body (`DECISIONS.md:248-251`), so the body-flag ask rule is now an ask on a call that carries a body flag, whatever its method, and the hook treats `-X` as an unrecognized option that asks. `DECISIONS.md:238-241` adds the ask on any `bkt api` option the hook does not recognize; `DECISIONS.md:253-256` and `:258-261` record the review findings and the best-effort stance; the known-gap list of the scenario below is the list in the header comment of `hooks/impl/pr-post-ask.js:23-39`

#### Scenario: Posting command asks
- **GIVEN** `/do` runs `gh pr review 123 --approve --body-file <path>` after the user confirmed the draft
- **WHEN** the hook evaluates the Bash call
- **THEN** the hook SHALL return an ask decision whose reason names the matched command family, and SHALL NOT deny the call

#### Scenario: Merge asks
- **GIVEN** a session runs `gh pr merge 123`
- **WHEN** the hook evaluates the call
- **THEN** the hook SHALL return an ask decision

#### Scenario: Bitbucket commands ask
- **GIVEN** a session runs `bkt pr approve 123 --workspace acme --repo repo`
- **WHEN** the hook evaluates the call
- **THEN** the hook SHALL return an ask decision

#### Scenario: Raw API write asks
- **GIVEN** a session runs `bkt api /repositories/acme/repo/pullrequests/123/request-changes --method POST`
- **WHEN** the hook evaluates the call
- **THEN** the hook SHALL return an ask decision

#### Scenario: Raw API read passes
- **GIVEN** a session runs `bkt api /repositories/acme/repo/pullrequests/123 --method GET`, or the same call with no method and no body flag
- **WHEN** the hook evaluates the call
- **THEN** the hook SHALL return no decision and the call SHALL proceed

#### Scenario: Raw API body flag without a method asks
- **GIVEN** a session runs `bkt api /repositories/acme/repo/pullrequests/123/comments --field content.raw=hello` with no `--method`
- **WHEN** the hook evaluates the call
- **THEN** the hook SHALL return an ask decision

#### Scenario: Quoted argument is not a command
- **GIVEN** a session runs `git commit -m "docs: explain gh pr review and bkt pr approve"`
- **WHEN** the hook evaluates the call
- **THEN** the hook SHALL return no decision, because the words sit inside a quoted argument and are not the command

#### Scenario: Self-test cases
- **GIVEN** the health check session-start self-test
- **WHEN** it runs the hook against its fixed cases
- **THEN** the ask cases SHALL include `gh pr review 1 --approve`, `bkt pr comment 1 --text x`, and `bkt api /x --method POST`, and the no-ask cases SHALL include `gh pr view 1`, `bkt api /x --method GET`, and `git commit -m "docs: explain gh pr review"`; the built corpus holds 14 ask cases and 13 no-ask cases (`hooks/impl/health-check.js:1049-1079`)

#### Scenario: Unrecognized bkt api option asks
- **GIVEN** a session runs `bkt api /x -X POST` or `bkt api /x --unknown-flag`
- **WHEN** the hook evaluates the call
- **THEN** the hook SHALL return an ask decision, because an option the hook does not recognize may carry a method or a body (`DECISIONS.md:238-241`)

#### Scenario: Either word list asks
- **GIVEN** a command in which the quote-resolved words give no ask but the raw words do, or the reverse
- **WHEN** the hook evaluates the call
- **THEN** the hook SHALL return an ask decision

#### Scenario: Substitution in the program word or a word before it
- **GIVEN** `out=$(gh pr merge 1)`, `` `gh pr merge 1` ``, or `out="x $(gh pr merge 1)"`
- **WHEN** the hook evaluates the call
- **THEN** the hook SHALL judge the text inside each substitution as its own command and SHALL return an ask decision, nested substitutions included

#### Scenario: Substitution nested too deep
- **GIVEN** a command whose substitutions nest more than 3 levels
- **WHEN** the hook evaluates the call
- **THEN** the hook SHALL return an ask decision and SHALL NOT pass the command unread

#### Scenario: Run-time expansion before the verb
- **GIVEN** `gh pr $verb 1`, `bkt --format $f pr view 1`, or `bkt api /x $opt`
- **WHEN** the hook evaluates the call
- **THEN** the hook SHALL return an ask decision, because a `$` or a backtick in a word read before the verb, after an unlisted `bkt` option, or after `bkt api` can supply the verb or a write option

#### Scenario: False ask disables the hook
- **GIVEN** the hook returns an ask decision for a known-safe self-test case
- **WHEN** the health check runs
- **THEN** it SHALL add the hook to `hooks-disabled.json` and report it, as FR-091 does for a guard that denies a known-safe case, and SHALL remove it only after a full passing self-test

#### Scenario: Missed ask is weak protection
- **GIVEN** the hook returns no decision for a known ask case
- **WHEN** the health check runs
- **THEN** it SHALL report weak protection with the notice ending of FR-118 and SHALL leave the hook enabled, as FR-091 does for a guard that misses a known-prohibited case

#### Scenario: Read commands pass
- **GIVEN** a session runs `gh pr view 123` or `bkt pr view 123 --workspace acme --repo repo`
- **WHEN** the hook evaluates the call
- **THEN** the hook SHALL return no decision

#### Scenario: Chained command
- **GIVEN** a call `echo done && gh pr close 123`
- **WHEN** the hook evaluates it
- **THEN** the hook SHALL judge each part and SHALL return an ask decision

#### Scenario: Hook failure
- **GIVEN** the hook throws, times out, or gets malformed input
- **WHEN** the call arrives
- **THEN** the hook SHALL fail open with a warning, as NFR-009 requires

#### Scenario: Registration and counts
- **GIVEN** the hook added to `hooks/hooks.json` with a 5-second timeout
- **WHEN** a reviewer compares the places that state hook counts (FR-086 and the BRD section 4 scope list; `CLAUDE.md` and `README.md` state none) with the registered hooks
- **THEN** the counts SHALL agree at 11 scripts and 16 commands (read in `hooks/hooks.json` on 2026-10-22), and the change SHALL carry the `✓ LLM Security Clear` signature of NFR-011 because `hooks/` is on the LLM surface

#### Scenario: Known gaps
- **GIVEN** a posting command written in one of the forms below
- **WHEN** the hook evaluates it
- **THEN** the hook MAY pass it, and the five places that hold the full list (the hook's header comment, the hook spec's Requirement 9, this requirement, the `/health` overview, and `README.md`) SHALL list the same 11 known gaps, while `CLAUDE.md`, `Claude.md`, and `ARCHITECTURE.md` SHALL carry only a pointer that the hook is best-effort with known gaps plus the unverified items (`DECISIONS.md:268-271`), because the hook is a best-effort guardrail that fails open (section 6, out of scope: "Hooks as a security boundary"). The list is the one in the header comment of `hooks/impl/pr-post-ask.js:23-39`:
  1. a program word taken from a variable or an expression, and PowerShell splatting;
  2. `gh api`, `gh pr edit`, `gh pr ready`, and `gh pr reopen`, a `gh` alias or extension, and `bkt pr` subcommands other than the five listed;
  3. a command string run by another program (`bash -c`, `eval`, `Invoke-Expression`, `xargs`, `find -exec`, and similar), and argv wrappers outside the wrapper list (`setsid`, `doas`, `ionice`, `stdbuf --output`);
  4. a command substitution inside another program's argument (`echo $(gh pr merge 1)`);
  5. a Bash `GH` in capitals, `.cmd`, `.bat`, and `.ps1` shims, shell aliases, and renamed or linked binaries;
  6. an option with a separate value ahead of the verb that the option lists do not name (`gh --body x pr comment 1`, `bkt pr --text x comment 1`);
  7. a redirection that the shared lexer splits into separate parts (`gh 2>&1 pr merge 1`, `gh >&2 pr merge 1`, `gh &>/dev/null pr merge 1`, `gh >| out pr merge 1`, `bkt 2>&1 pr approve 1`, `gh < <(true) pr merge 1`);
  8. a PowerShell array or script block in the verb position (`gh pr @('merge') 1`, `gh pr {merge} 1`), and a PowerShell comment that hides an opening parenthesis;
  9. the quoting forms `$"gh"` and `$'g\x68'`, brace expansion, a glob in the program word, `(( x = 1 << 2 ))` read as a heredoc, and `sudo --user` with a separate value (the shared-parser forms `doc-cli-guard` lists);
  10. the PowerShell forms listed for `doc-cli-guard`, and a redirection before the program;
  11. REST calls through `curl`, another HTTP client, or an MCP tool.

  Three more items are unverified and the health documentation SHALL say so (`DECISIONS.md:248-251`): whether an ask prompts in `bypassPermissions` mode, whether it prompts in plan mode, and whether an installed mod can approve a call that the hook would prompt for (the wording `CLAUDE.md`, `Claude.md`, and `ARCHITECTURE.md` use). `README.md:296` states that a deny from another hook beats the ask.

### FR-207: /do guards every .agent write against a symlink

**Statement:** Before every write that `/do` makes under `<root>/.agent/` (the plan file under `.agent/main-plan/`, the change-check snapshot files, and the PR files under `.agent/pr-review/`), `/do` SHALL test with `test ! -L` that `<root>/.agent` and the folder it writes into are not symlinks (and, for the plan file, that the file itself is not a symlink, because `/do` edits it in place and so does not remove it), SHALL write nothing and stop with `policy-rejection` when one is a symlink (a PR step fails with `policy-rejection`; a plan-file or snapshot write, which belongs to no step, ends the plan in `Error` with `error_class` `policy-rejection` at the state that attempted the write; this Error writes no Status to the plan file, because the write is the unsafe one, and is shown in the reply only), and SHALL remove an existing target with `rm -f` before it writes a file that `/do` creates fresh (the snapshot files and the PR files).
**Traces to:** UR-055, UR-019 | **Priority:** Must | **Status:** Built (1.13.0) (`skills/do/SKILL.md:247-275`, `skills/do/references/pr-review-flow.md:98-104`)
**Source:** `skills/do/references/pr-review-flow.md:55-61` and `:78-84` (the guard for the three PR writes at 1.12.0); `DECISIONS.md:213-216` (the `rm -f` rule is the PR-file rule); `DECISIONS.md:223-226` (every `.agent` write /do makes gets a symlink check; it asks for the check only); FR-195 (the guard for PR files); FR-032 (snapshot files); `skills/do/SKILL.md:376` (snapshot files go to the session scratchpad, and only without one to `<root>/.agent/change-check/`); `skills/do/SKILL.md:404` and `:410` (the plan file is edited in place at 1.12.0 line numbers). A `rm -f` before the plan file would break that in-place edit, so the plan file gets the symlink test only. The Error terminal of `skills/do/SKILL.md:51` writes Status to a plan file that Branch already wrote; the `/do` Error-terminal change that this requirement names adds the exception that an `Error(policy-rejection)` raised by this requirement writes no Status to the plan file and is shown in the reply only. Adding a plan-level `Error(policy-rejection)` exit to a `## States` table of `skills/do/SKILL.md` needs `node plugins/assist-plugin/scripts/check-fsa-tables.js --check` to exit 0 afterward when `hooks/lib/fsa-tables.js` mirrors that table (NFR-021). `fsa-write-bar` does not resolve symlinks and does not cover Bash writes (section 6, out of scope), so the guard is `/do`'s own check

#### Scenario: Symlinked .agent
- **GIVEN** `<root>/.agent` is a symlink to another directory
- **WHEN** `/do` is about to write the plan file
- **THEN** `/do` SHALL write nothing, and the plan SHALL end in `Error` with `error_class` `policy-rejection` at the state that attempted the write (for example Branch or Preflight)

#### Scenario: Plan file edited in place
- **GIVEN** `<root>/.agent`, `<root>/.agent/main-plan`, and the plan file are not symlinks
- **WHEN** `/do` updates the plan file during a run
- **THEN** `/do` SHALL run the symlink test before each Write or Edit and SHALL NOT run `rm -f` on the plan file

#### Scenario: Plan file is a symlink
- **GIVEN** the plan file is a symlink to another file
- **WHEN** `/do` is about to edit it
- **THEN** `/do` SHALL write nothing, SHALL write no Status to the plan file, and the plan SHALL end in `Error` with `error_class` `policy-rejection`, shown in the reply only

#### Scenario: Symlinked snapshot folder without a scratchpad
- **GIVEN** the session has no scratchpad directory, so snapshots go to `<root>/.agent/change-check/`, and that folder is a symlink
- **WHEN** `/do` takes a snapshot
- **THEN** `/do` SHALL write no snapshot and the plan SHALL end in `Error` with `error_class` `policy-rejection`

#### Scenario: Snapshots in the scratchpad
- **GIVEN** the session has a scratchpad directory
- **WHEN** `/do` takes a snapshot
- **THEN** the snapshot files are outside `<root>/.agent`, and this requirement SHALL NOT apply to them

#### Scenario: Symlink at the target file
- **GIVEN** `.agent/pr-review/pr-123.diff` is a symlink to `~/.bashrc`
- **WHEN** `/do` writes the scratch file
- **THEN** `/do` SHALL remove the link with `rm -f` before the write and SHALL NOT change `~/.bashrc`

#### Scenario: Plain folders
- **GIVEN** `<root>/.agent` and the target folder are ordinary directories
- **WHEN** `/do` writes
- **THEN** the write SHALL proceed

### FR-208: PR scratch files are removed after use

**Statement:** `/do` SHALL remove the files of PR `<N>` under `<root>/.agent/pr-review/` (the five names `pr-<N>.diff`, `pr-<N>.view.full`, `pr-<N>.diff.full`, `pr-<N>.comments.full`, and `pr-<N>-review.body`, each removed by its exact name with `rm -f --` and no glob pattern, so that PR 12 never touches the files of PR 123 and the command behaves the same in bash and zsh; `DECISIONS.md:263-266`) right after a successful post, a post declined at the hook prompt, or a "do not post" answer, SHALL sweep the files left by a failed or stopped PR step at Cleanup, SHALL refresh the change-check baseline for each removed path as it does after a write, and SHALL remove nothing through a symlinked folder. The symlink guard and the removal run in one Bash command that exits 3 when `<root>/.agent` or `<root>/.agent/pr-review` is a symlink (nothing removed, the step stays `completed`) and exits 0 when the guard passed and `rm -f --` ran, a file already gone not being an error.
**Traces to:** UR-055 | **Priority:** Must | **Status:** Built (1.13.0) (`skills/do/references/pr-review-flow.md:358-372`, `skills/do/SKILL.md:548`, read on 2026-10-22)
**Source:** `DECISIONS.md:223-226` (`pr-<N>*`); `DECISIONS.md:228-231` (cleanup matches `pr-<N>.*` and `pr-<N>-*` only; section 9, open point 6, closed), replaced by `DECISIONS.md:263-266` (no glob: the five files by exact name with `rm -f --` after the symlink guard); `DECISIONS.md:233-236` (the step is completed and the PR files are removed after a rejected hook prompt, as for a "do not post" answer); `skills/do/references/pr-review-flow.md:51` (refresh the baseline after a write under `.agent/pr-review/`); `skills/do/references/pr-review-flow.md:50`, `:89`, `:98`, `:154` (files `pr-<N>.diff`, `pr-<N>.view.full`, `pr-<N>.diff.full`, `pr-<N>-review.body`, which stay on disk at 1.12.0); `skills/do/SKILL.md:50` (Cleanup removes only worktrees at 1.12.0); FR-063 (worktree cleanup), FR-207

#### Scenario: After a post
- **GIVEN** a successful `gh pr review` or `bkt` post for PR 123
- **WHEN** the step settles
- **THEN** `/do` SHALL remove `pr-123.diff`, `pr-123.view.full`, `pr-123.diff.full`, `pr-123.comments.full`, and `pr-123-review.body`, SHALL refresh the change-check baseline for each removed path, and SHALL NOT remove a file for another PR number

#### Scenario: PR 12 and PR 123
- **GIVEN** `.agent/pr-review/` holds the files of PR 12 and PR 123
- **WHEN** `/do` cleans up after PR 12
- **THEN** `/do` SHALL remove the PR 12 files and SHALL leave `pr-123.diff` and `pr-123-review.body`

#### Scenario: Post declined at the hook prompt
- **GIVEN** the user rejected the ask-hook prompt for the posting command
- **WHEN** the step settles as `completed`
- **THEN** `/do` SHALL remove the files of that PR

#### Scenario: After a do-not-post answer
- **GIVEN** the user answered "Do not post"
- **WHEN** the step settles as `completed`
- **THEN** `/do` SHALL remove the five named files of PR 123 (`pr-123.diff`, `pr-123.view.full`, `pr-123.diff.full`, `pr-123.comments.full`, `pr-123-review.body`), and SHALL NOT remove the files of PR 1234

#### Scenario: Failed step
- **GIVEN** the step failed after the scratch file was written
- **WHEN** `/do` reaches Cleanup
- **THEN** `/do` SHALL remove the leftover files of that PR (the five names of FR-208) at Cleanup

#### Scenario: Stopped step
- **GIVEN** a stop returned the PR step to `pending`
- **WHEN** `/do` reaches Cleanup
- **THEN** `/do` SHALL remove the leftover files and the resumed step SHALL fetch again

#### Scenario: Symlinked folder
- **GIVEN** `<root>/.agent/pr-review` is a symlink
- **WHEN** `/do` cleans up
- **THEN** `/do` SHALL remove nothing (the single command exits 3) and SHALL report the symlink

### FR-209: /bump validates the --path value

**Statement:** The `/bump` skill SHALL handle a `--path` value in three ordered steps before it reads a version file, writes, commits, or tags: (1) normalize it by removing a leading `./` and a trailing `/`, reading `\` as `/`, and making an absolute path inside the git root root-relative, a value that resolves to the repository root counting as no `--path` (the default names and root tags apply, and the later steps are skipped; this includes a relative value that is empty or `.` after the `./` and `/` are removed, and an absolute value whose stripped, root-relative remainder is empty or `.`); (2) validate the normalized value, accepting only a relative path or an absolute path that resolves inside the git root, whose `<dir>` matches `^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$`, has no `..` segment, no segment made only of dots, no segment that starts with `-`, and no segment that starts with `.` or contains `..` (rule R8, which also refuses `.github` and `a..b`, because such a segment gives an invalid git tag name; `DECISIONS.md:253-256`), and that names an existing directory (tested with `test -d "$(git rev-parse --show-toplevel)/<dir>"`, whose operand starts with the absolute root, so the test needs no `--`) whose real path stays inside the git root; (3) only then name `<dir>` and `<tagdir>` (FR-139). The checks run in the order R1 to R5, R8, R6, R7, and each stop prints one of eight messages, R1 to R8, that names the rule, ends with "nothing was changed", and quotes no raw `--path` text except the validated `<dir>` of R6: R1 absolute path outside the git root; R2 characters outside letters, digits, `.`, `_`, `-`, and `/`; R3 a `..` segment; R4 a segment made only of dots; R5 a segment that starts with `-`; R6 no such directory; R7 resolves outside the git root; R8 a segment that starts with `.` or contains `..`.
**Traces to:** UR-056, UR-029 | **Priority:** Must | **Status:** Built (1.13.0) (`skills/bump/SKILL.md:82`, `:117-149`; `skills/bump/references/bump-strategy.md:258`, read on 2026-10-22)
**Source:** `DECISIONS.md:223-226` (the form, the regular expression, no `..` or leading-dash segment, an existing directory inside the repository; `DECISIONS.md:228-231` (no dots-only segment; normalize before validation; section 9, open point 5, closed)); `DECISIONS.md:253-256` (no segment that starts with `.` or contains `..`, rule R8); `skills/bump/SKILL.md:79-82` (the commit message and tag are built from the value) and `:93` (the option); FR-139; `skills/bump/SKILL.md:82` (a `--path` that resolves to the repository root counts as no `--path`, which stays and is applied before this check)

#### Scenario: Valid relative path
- **GIVEN** `/bump minor --path ./services/auth` and `services/auth` exists in the repository
- **WHEN** the skill validates the value
- **THEN** `<dir>` SHALL be `services/auth` and the bump SHALL continue

#### Scenario: Valid absolute path inside the root
- **GIVEN** the absolute path of an existing directory inside the git root
- **WHEN** the skill validates the value
- **THEN** the skill SHALL convert it to a root-relative `<dir>` and continue

#### Scenario: Parent segment
- **GIVEN** `--path ../other` or `--path services/../../x`
- **WHEN** the skill validates the value
- **THEN** the skill SHALL stop with a message that names the rule broken, and SHALL change no file, make no commit, and create no tag

#### Scenario: Shell characters
- **GIVEN** `--path "svc$(id)"`, `--path "svc;x"`, or a value with a newline
- **WHEN** the skill validates the value
- **THEN** the skill SHALL stop before any change

#### Scenario: Segment starts with a hyphen
- **GIVEN** `--path -rf`
- **WHEN** the skill validates the value
- **THEN** the skill SHALL stop before any change

#### Scenario: Directory does not exist
- **GIVEN** `--path services/missing` and no such directory
- **WHEN** the skill validates the value
- **THEN** the skill SHALL stop and name the missing directory

#### Scenario: Symlink leaves the repository
- **GIVEN** `services/auth` is a symlink to a directory outside the git root
- **WHEN** the skill validates the value
- **THEN** the skill SHALL stop, because the real path is outside the root

#### Scenario: Backslash spelling still works
- **GIVEN** `.\services\auth\` and an existing `services/auth`
- **WHEN** the skill validates the value
- **THEN** `<dir>` SHALL be `services/auth`, as in FR-139

#### Scenario: Absolute path outside the git root
- **GIVEN** `--path /etc/other` and a git root of `/home/user/repo`
- **WHEN** the skill runs step 2
- **THEN** the skill SHALL stop before any change and name the rule broken

#### Scenario: Root path counts as no --path
- **GIVEN** `--path ./` or the root's own absolute path
- **WHEN** the skill runs step 1
- **THEN** the skill SHALL apply the default names (`chore: bump version to X.Y.Z`, `vX.Y.Z`) and SHALL skip steps 2 and 3

#### Scenario: Stripped absolute value is empty or a dot
- **GIVEN** an absolute value inside the git root whose root-relative remainder is empty or `.` (for example `<root>/.` or `<root>//`)
- **WHEN** the skill runs step 1
- **THEN** the skill SHALL count it as no `--path`, as for the root's own path

#### Scenario: Segment starts with a dot or holds two dots (R8)
- **GIVEN** `--path .github` or `--path a..b`
- **WHEN** the skill runs step 2
- **THEN** the skill SHALL stop with the R8 message ("--path has a segment that starts with "." or contains ".."; nothing was changed") before any file, commit, or tag changes

#### Scenario: Directory test needs no option terminator
- **GIVEN** a validated `<dir>`
- **WHEN** the skill checks that the directory exists
- **THEN** the skill SHALL run `test -d` on the absolute root followed by `/<dir>` with no `--`, so the operand cannot read as an option

#### Scenario: Eight stop messages
- **GIVEN** each of the eight rule breaks R1 to R8
- **WHEN** the skill stops
- **THEN** each message SHALL name its rule, end with "nothing was changed", and quote no raw `--path` text except the validated `<dir>` of R6

### FR-210: The LLM checklist states the PR gap as a written rule with unscoped Bash

**Statement:** Row 2 of the open-gap table in `plugins/assist-plugin/rules/llm-security-checklist.md` (line 326 at 1.12.0) SHALL say that, in a direct `/pr-review` run, the confirmation before a verdict is a written rule only, that the skill holds unscoped Bash which runs with no prompt, and that attacker-controlled PR text therefore reaches a session that can run the posting commands, with the prompt of FR-206 as a best-effort, fail-open control that does not rely on the model and has the known gaps that FR-206 lists.
**Traces to:** UR-057 | **Priority:** Should | **Status:** Built (1.13.0) (`rules/llm-security-checklist.md:326`, row 2, read on 2026-10-22; the line also names the known gaps of FR-206 and keeps the `/do` sentence). `DECISIONS.md:223-226` does not mention this wording; it is a settled point of the follow-up request
**Source:** `plugins/assist-plugin/rules/llm-security-checklist.md:326` (row 2 says the text reaches the session "behind the confirmation gate"); `skills/pr-review/SKILL.md:8-14` (Write and Bash, unscoped); NFR-013 (the unscoped `pr-review` Bash is a listed exception that runs without a prompt). The checklist is on the LLM surface (NFR-011), so the change needs the gate. The edit is outside this requirements step; this requirement records the change for the spec and task plan

#### Scenario: Row 2 wording
- **GIVEN** the checklist after the change
- **WHEN** a reviewer reads row 2 of the open-gap table
- **THEN** the row SHALL say the confirmation gate is a written rule only and that unscoped Bash runs with no prompt, and SHALL NOT describe the confirmation as a control that holds on its own

#### Scenario: Under /do
- **GIVEN** the same row
- **WHEN** a reviewer reads the `/do` sentence
- **THEN** it SHALL keep the statement that the PR text goes to a file only the read-only `reviewer` reads and that `/do` posts after the user confirms

#### Scenario: Gate on the change
- **GIVEN** the edit to the checklist
- **WHEN** the merge policy is checked
- **THEN** the change SHALL carry `✓ LLM Security Clear` (NFR-011)

## 5. Non-functional requirements

Each requirement uses the form:

> The [system/component] SHALL [quality attribute] [measurable threshold] [under conditions].

Every threshold below is copied from the cited source. This document does not claim the thresholds were measured, except where a row says it was checked by reading files or gives a measured median (NFR-008, NFR-025).

### 5.1 Token and context cost

| ID | Requirement | Traces to | Metric |
|----|-------------|-----------|--------|
| NFR-001 | The `writing-context` hook SHALL inject at most 10,000 characters per session start and per subagent start. | BR-003, FR-107 | 10,000 characters (cap in `hooks/impl/writing-context.js`) |
| NFR-002 | The compact writing standard (`rules/writing-standard-compact.md`) SHOULD stay at or under 1,195 characters, the size documented in `README.md` and `CLAUDE.md`. | BR-003, FR-107 | 1,195 characters, measured as the character count of the file (`wc -m`). The "about 300 tokens" figure in `README.md` is an estimate and not a limit |
| NFR-003 | Each agent `description` in frontmatter SHALL NOT exceed 400 characters. | BR-003, FR-065 | 400 characters (`docs/TOKEN_OPTIMIZATION.md`); checked by reading the 16 descriptions on 2026-10-14, longest about 255 |
| NFR-004 | A new feature SHOULD add fewer than 50 tokens to the always-loaded plugin text; for a new skill the counted text is its frontmatter `description` plus its `argument-hint`. | BR-003 | 50 tokens per feature (`docs/TOKEN_OPTIMIZATION.md`, Future Extensions). PLANNED (1.12.0) method, an estimate and not a measurement: the character count of the counted text divided by 4 (about 4 characters per token), so under about 200 characters; the answer to OP-5 in `plan-deferred-decisions-20261016-1059.md` |
| NFR-005 | The prose hooks SHALL add no model tokens when the added text holds no tell. | BR-003, FR-103, FR-106 | 0 tokens on clean writes (`README.md`, Writing standard hooks) |
| NFR-006 | Withdrawn in review. The documented footprint figures are estimates with no measurement method, so they are listed as notes in section 9 and not as a requirement. | BR-003 | none |

#### Scenario: Context cap
- **GIVEN** a compact standard file that grows past 10,000 characters with its header
- **WHEN** `writing-context` runs
- **THEN** the hook SHALL cut the tail to the cap and write a `standard-truncated` entry to the health log

#### Scenario: Budget for a new skill (PLANNED, 1.12.0)
- **GIVEN** a new skill whose frontmatter `description` and `argument-hint` together hold 180 characters
- **WHEN** a reviewer applies NFR-004
- **THEN** the estimate SHALL be about 45 tokens (180 divided by 4, labeled an estimate) and the skill SHALL be within the budget

#### Scenario: Over budget (PLANNED, 1.12.0)
- **GIVEN** a new skill whose `description` and `argument-hint` together hold 320 characters
- **WHEN** a reviewer applies NFR-004
- **THEN** the estimate SHALL be about 80 tokens and the reviewer SHALL flag it as over the 50-token budget

#### Scenario: Clean write adds no tokens
- **GIVEN** a write to a prose file whose added text has no tell
- **WHEN** `prose-gate` and `prose-advisor` run
- **THEN** neither hook SHALL return text to the model

### 5.2 Performance

| ID | Requirement | Traces to | Metric |
|----|-------------|-----------|--------|
| NFR-007 | Each hook command SHALL finish within its registered timeout. | BR-007, FR-086 | 5 seconds; 10 seconds for the SessionStart health check (`hooks/hooks.json`) |
| NFR-008 | The per-write hooks (`prose-gate`, `prose-advisor`, `fsa-write-bar`) SHOULD add no more than 110 ms to a write. | BR-003, FR-103, FR-106, FR-108 | 110 ms, measured as the median wall-clock time of 20 runs of `node hooks/<hook>.js` on one fixed input per hook: for `prose-gate` and `prose-advisor`, a `Write` tool call that creates a 2 KB `.md` file of clean prose at `notes/a.md`; for `fsa-write-bar`, a `Write` tool call by `assist-plugin:developer` to `src/main.ts` with 2 KB of content. The method is confirmed by the user (`DECISIONS.md:243-246`): the median of 20 runs on a fixed input, with a 110 ms limit that is a SHOULD, so a median over the limit is a finding. Measured medians from the qa run on this machine, as reported to this step and not repeated here: `prose-gate` 67.2 ms, `prose-advisor` 56.1 ms, `fsa-write-bar` 54.4 ms; the sources state "about 80 to 110 ms" |
| NFR-025 | Built (1.13.0): The posting ask hook of FR-206, which runs on every Bash and PowerShell call, SHOULD add no more than 110 ms to a call. | BR-003, FR-206 | 110 ms, the NFR-008 limit, measured as the median wall-clock time of 20 runs of `node hooks/<hook>.js` on one fixed input: a `Bash` tool call with the command `git status` (no match). The method follows NFR-008 and is confirmed (`DECISIONS.md:243-246`). Measured median from the qa run on this machine, as reported to this step: `pr-post-ask` 57.6 ms, under the limit |

#### Scenario: Ask hook latency (Built, 1.13.0)
- **GIVEN** a `Bash` call with the command `git status`
- **WHEN** a reviewer applies the NFR-025 method
- **THEN** the median over 20 runs SHOULD be at most 110 ms (57.6 ms in the qa run)

#### Scenario: Hook does not answer
- **GIVEN** a guard that does not answer within 3 seconds
- **WHEN** the runtime watchdog fires
- **THEN** the call SHALL proceed with a warning and the health log SHALL record a `timeout` entry

### 5.3 Reliability

| ID | Requirement | Traces to | Metric |
|----|-------------|-----------|--------|
| NFR-009 | Every hook SHALL fail open for each of these failures: thrown error, uncaught exception, unhandled rejection, stdin error, malformed input, timeout, unsupported Node, health-log write failure, and a disabled guard. | BR-007, FR-088, FR-089 | 0 denials from any failure kind; exit status 0 |
| NFR-010 | Every loop in `/do` and in an agent `## States` table SHALL name a counter, a maximum, and an exhausted target, except a loop that only the user's answer exits (the PlanApproval edit and rerun loops and the sign-off recheck loop in `skills/do/SKILL.md`, Loops table). | BR-001, BR-006, FR-069 | 100% of loops; maxima include clarify 5 (build) and 2 (non-build), relays 3 per phase and 10 total, DocSignOff edits 3, gate iterations 10, Report Quality Gate rounds 3, `CheckPlan` rounds 2 |

#### Scenario: Unsupported Node
- **GIVEN** the host runs Node older than 6
- **WHEN** a guard hook is called
- **THEN** the hook SHALL warn and the guarded command SHALL run

#### Scenario: Loop reaches its maximum
- **GIVEN** the total NeedsInput relay count for a step is 10
- **WHEN** the step needs another relay
- **THEN** `/do` SHALL fail the step and SHALL NOT ask again

### 5.4 Security

| ID | Requirement | Traces to | Standard/Compliance |
|----|-------------|-----------|---------------------|
| NFR-011 | A change to the LLM surface (`agents/`, `skills/` at any depth with `metadata.json`, `rules/`, and `hooks/`, each at the repository root, under any `plugins/<name>/`, or under `.claude/`, any `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md` at any depth, and `.claude/settings*.json`; not an application folder such as `src/hooks/`) SHALL carry the signature `✓ LLM Security Clear` before merge, with no fast-track path. | BR-005, FR-061, FR-193, FR-199 | OWASP Top 10 for LLM Applications (LLM01 to LLM07, LLM09, LLM10; LLM08 out of scope), `rules/llm-security-checklist.md`. Built (1.11.1) for `skills/**/SKILL.md` and `skills/**/references/*.md`; PLANNED (1.12.0): the path anchor (repository root, `plugins/<name>/`, `.claude/`; wording at `rules/assist-plugin-rule.md:103`, `:335`, `:359-360`, `rules/llm-security-checklist.md:11`, `:304`, and `skills/do/references/review-protocol.md:432`) and every file under `skills/**`, which adds the 87 reference files below `references/` that the narrow glob missed (a count of the files the SKILL.md files link to, by `specs/spec-skills.md`, OP-1) and `metadata.json`. `rules/llm-security-checklist.md:11` changes with it (`:304` and `CLAUDE.md:114` already say all of `skills/`) |
| NFR-012 | Every prompt that carries document, web, or tool text SHALL mark that text as untrusted data, with 100% of document paths in chain, build, gate, and fix prompts inside the `untrusted-file` wrapper. | BR-006, FR-031, FR-099 | OWASP LLM01 (Prompt Injection) |
| NFR-013 | Every skill SHALL pre-approve only scoped grants for its documented output paths and commands, except the listed exceptions; a scoped grant is a path pattern for Write and Edit, and a fixed command, a fixed program-and-subcommand prefix, or a fixed program that only reads (with no subcommand) for Bash. | BR-006, FR-146, FR-152, FR-156, FR-158, FR-163, FR-165 | OWASP LLM06 (Excessive Agency); `DECISIONS.md` (2026-10-12, Scoped write grants; clarify and voice-script tool grants). Grants since 1.11.1: `./docs/requirements/BRD-*.md`, `./docs/requirements/URD-*.md`, `./docs/requirements/FR-NFR-*.md`, `./docs/requirements/requirements-*.json` (FR-183); `./specs/spec-*.md`, `./specs/spec-*.json`, `./specs/openapi/*.json`, `./specs/openapi/*.yaml`, `./*/specs/spec-*.md`, `./*/specs/spec-*.json`; `./docs/task-plans/task-plan-*.md` (FR-185); `./README.md`; `./docs/tts/voice-*.md`; `./.agent/clarify/clarify-*.md`. These are the scoped grants of `gather-requirements`, `spec-from-requirements`, `task-plan`, `technical-writing`, `voice-script`, and `clarify`. The 4803a0d grants were `./BRD-*.md`, `./URD-*.md`, `./FR-NFR-*.md`, `./requirements-*.json` and `./task-plan-*.md`. PLANNED (1.12.0): the restatement to every skill, and these twelve unscoped grants as the listed exceptions (the twelfth, `branch` with `Bash(git:*)`, from `DECISIONS.md:158-161`), so a write or command through them runs without a prompt (`specs/spec-skills.md`, OP-6; the answer to OP-6 in `plan-deferred-decisions-20261016-1059.md`): `bump` Write, Edit, and Bash (`skills/bump/SKILL.md:8-14`); `code` Write and Edit (`skills/code/SKILL.md:8-13`); `integrated-test` Write and Edit (`skills/integrated-test/SKILL.md:9-14`); `pr-review` Write and Bash (`skills/pr-review/SKILL.md:8-14`); `review-md` Write (`skills/review-md/SKILL.md:7-11`); `create-test` Write (`skills/create-test/SKILL.md:8-12`); `run-test` Write (`skills/run-test/SKILL.md:8-12`); `debug` Bash (`skills/debug/SKILL.md:6-11`); `map-project` Bash (`skills/map-project/SKILL.md:7-10`); `commit` Bash (`skills/commit/SKILL.md:7-8`); `do` Edit, Write, and Bash (`skills/do/SKILL.md:13-22`, whose tools are Read, Edit, Write, Grep, Glob, Bash, Agent, SendMessage, and AskUserQuestion); `branch` Bash(git:*) (`skills/branch/SKILL.md:9`; a program prefix with any subcommand, which is not a fixed command, a fixed program-and-subcommand prefix, or a read-only fixed program). The read-only fixed-program rule (`DECISIONS.md:163-166`) covers `branch` Bash(df:*) (`skills/branch/SKILL.md:10`), `branch` Bash(realpath:*) (`:12`), and `pentest` Bash(govulncheck *) (`skills/pentest/SKILL.md:30`), so these are scoped and not exceptions. In a main-session run no hook limits their writes (FR-113) |
| NFR-014 | The plugin SHALL enforce its documented caps on reads, questions, rounds, and logs. | BR-006, FR-020, FR-025, FR-050, FR-073, FR-195, FR-204 | OWASP LLM10 (Unbounded Consumption); caps: 20 paths per document type, 10 documents read in full, 2000 lines per document, last 200 lines of `DECISIONS.md`, 4 questions per call, 64 KB per message file, 500 `fsa-log` lines, 200 health-log lines, and (PLANNED, 1.12.0) 200 KB for the PR text that `/do` fetches into `.agent/pr-review/pr-<N>.diff` (FR-195), and (Built, 1.13.0) the same 200 KB for the PR text a direct `/pr-review` run reads (FR-204; `skills/pr-review/SKILL.md:95`, 204,800 bytes) |
| NFR-015 | No agent or skill file SHALL contain a hardcoded token, an API key, a host ending in `.company.com` or `.internal` (other than `host.docker.internal`), or a `user:password`-style credential (a `-u` or `--user` value, or URL userinfo of the form `://x:y@`, whose parts are not `<...>` placeholders; `host:port` is not a credential); example hosts use `example.com`-style names and example credentials use `<user>:<token>` placeholders. | BR-006 | OWASP LLM02 and LLM07; `rules/llm-security-checklist.md`; 0 occurrences of the pattern. PLANNED (1.12.0): the pattern and the placeholder names (the answer to OP-13 in `plan-deferred-decisions-20261016-1059.md`). Current hits to fix, listed by the planning gate review on 2026-10-16: `skills/pr-review/references/pr-detection.md:23`, `:24`, `:52`, `:53`, `:58`, `:59`, `:111`, `:168`, `:224`, `:227` (`curl -u username:password`), `:258`, and `:262`, and `skills/pr-review/SKILL.md:60`, and `skills/integrated-test/references/integration-patterns/go.md:65`, where the database URL is built from container variables with no literal credential (`DECISIONS.md:193-196`). Allowed: `host.docker.internal` (`skills/pentest/references/zap.md:255`), which is a Docker name and not an internal host |
| NFR-016 | The files `hook-health.jsonl` and `fsa-log.jsonl` SHALL hold no command text, arguments, environment values, stdin, prompts, report text, artifact paths, questions, or file contents. | BR-006, BR-007, FR-090, FR-115 | OWASP LLM02; 0 such fields |

#### Scenario: Plugin-surface change
- **GIVEN** a change to `hooks/lib/fsa-paths.js`
- **WHEN** the merge policy is checked
- **THEN** the change SHALL be blocked until `✓ LLM Security Clear` is recorded

#### Scenario: Scoped grant
- **GIVEN** `task-plan` needs to write `notes/plan.md`
- **WHEN** the skill writes
- **THEN** Claude Code SHALL ask the user first because the grant covers only the skill's documented task-plan path (`./docs/task-plans/task-plan-*.md` since FR-185; `./task-plan-*.md` at 4803a0d)

#### Scenario: Accepted unscoped grant (PLANNED, 1.12.0)
- **GIVEN** `bump` holds Write, Edit, and Bash without a path or command pattern
- **WHEN** `/bump` writes `package.json`
- **THEN** the write SHALL run without a prompt, and a reviewer SHALL NOT flag the grant as a violation of NFR-013 because NFR-013 lists it as an accepted exception

#### Scenario: Unscoped grant not on the list (PLANNED, 1.12.0)
- **GIVEN** a skill outside the twelve listed exceptions gains an unscoped Write grant
- **WHEN** a reviewer compares the skill with NFR-013
- **THEN** the reviewer SHALL flag the grant

#### Scenario: Bash grant shapes (PLANNED, 1.12.0)
- **GIVEN** a skill grants `Bash(git status)`, another grants `Bash(npm test:*)`, and a third outside the exceptions grants `Bash(git:*)`
- **WHEN** a reviewer compares each with NFR-013
- **THEN** the reviewer SHALL pass the first (a fixed command) and the second (a fixed program-and-subcommand prefix), and SHALL flag the third, while `branch` keeps `Bash(git:*)` as the listed exception

#### Scenario: Read-only fixed program (PLANNED, 1.12.0)
- **GIVEN** `branch` grants `Bash(df:*)` and `Bash(realpath:*)`, and `pentest` grants `Bash(govulncheck *)`
- **WHEN** a reviewer compares each with NFR-013
- **THEN** the reviewer SHALL pass all three as scoped grants of a fixed program that only reads, and SHALL flag a grant of a fixed program that writes, such as `Bash(rm:*)`, unless it is a listed exception

#### Scenario: Clarify stays in its log
- **GIVEN** the `clarify` skill finishes a run
- **WHEN** the files it wrote are listed
- **THEN** the list SHALL hold only `.agent/clarify/clarify-YYYYMMDD.md` and SHALL NOT hold a `/do` plan file or `DECISIONS.md`

#### Scenario: Oversized message file
- **GIVEN** `gh pr create --body-file body.md` and a 100 KB `body.md`
- **WHEN** `commit-attribution-guard` evaluates the command
- **THEN** the hook SHALL NOT read the file past 64 KB

#### Scenario: Placeholder host and credential (PLANNED, 1.12.0)
- **GIVEN** a skill reference file that shows `curl -u <user>:<token> https://bitbucket.example.com/rest/api/1.0/`
- **WHEN** a reviewer scans the file under NFR-015
- **THEN** the scan SHALL pass the host and the credential as placeholders

#### Scenario: Company-style host (PLANNED, 1.12.0)
- **GIVEN** a skill reference file that shows `curl -u username:password https://bitbucket.company.com/rest/api/1.0/`
- **WHEN** a reviewer scans the file under NFR-015
- **THEN** the scan SHALL flag the host and the credential

#### Scenario: Credential forms (PLANNED, 1.12.0)
- **GIVEN** skill reference files that show `curl -u <user>:<token> https://bitbucket.example.com`, `https://<user>:<token>@bitbucket.example.com`, `https://admin:hunter2@bitbucket.example.com`, `curl --user admin:hunter2 https://bitbucket.example.com`, and `localhost:7990`
- **WHEN** a reviewer scans the files under NFR-015
- **THEN** the scan SHALL pass the first two and the fifth (a `host:port`, not a credential), and SHALL flag the third and the fourth

#### Scenario: Docker host name (PLANNED, 1.12.0)
- **GIVEN** a skill reference file that shows `host.docker.internal`
- **WHEN** a reviewer scans the file under NFR-015
- **THEN** the scan SHALL NOT flag it, because it is a Docker name and not an internal host

#### Scenario: Log privacy
- **GIVEN** a guard throws on a command that holds a secret
- **WHEN** the health log line is read
- **THEN** the line SHALL NOT contain the command text

### 5.5 Compatibility

| ID | Requirement | Traces to | Metric |
|----|-------------|-----------|--------|
| NFR-017 | Hook code SHALL parse and run on Node 6 or newer, with ES5 syntax in entry files and ES2015 syntax in modules. | BR-007, FR-087 | Minimum Node 6; test matrix 6.17.1, 8, 10, 12, 14, 18, and 26 (`hooks/lib/launch.js` header) |

#### Scenario: Syntax check on Node 6
- **GIVEN** every file under `hooks/`
- **WHEN** a Node 6 parser loads each file
- **THEN** every file SHALL parse without a syntax error

### 5.6 Writing standard

| ID | Requirement | Traces to | Metric |
|----|-------------|-----------|--------|
| NFR-018 | Every `## Report Writing Standard` block in `agents/` and `skills/` SHALL equal `rules/writing-standard-compact.md`. | BR-008, FR-123, FR-124 | `node plugins/assist-plugin/scripts/sync-writing-standard.js --check` exits 0 |
| NFR-019 | Prose that agents and skills write to prose files SHALL contain no em dash, curly quote, chatbot residue, or summary label outside exempt regions. | BR-008, FR-103 | 0 block-tier hits in added text, as `prose-gate` judges it |

#### Scenario: Block drift
- **GIVEN** one agent file's standard block was edited by hand
- **WHEN** the sync check runs
- **THEN** the check SHALL exit 1

#### Scenario: Clean prose
- **GIVEN** an agent writes a report to `report.md` with no block-tier tell
- **WHEN** `prose-gate` evaluates the write
- **THEN** the hook SHALL allow it

### 5.7 Maintainability

| ID | Requirement | Traces to | Metric |
|----|-------------|-----------|--------|
| NFR-020 | The agent and skill counts and lists SHALL agree in `plugin.json`, `marketplace.json`, `README.md`, `MARKETPLACE.md`, `CLAUDE.md`, `plugins/assist-plugin/Claude.md`, `docs/SPECIFICATION.md`, and `skills/do/references/agent-registry.md`. | BR-016, FR-065, FR-130 | 16 agents in all 8 files and 22 skills in the 7 files other than `agent-registry.md` (checked for `CLAUDE.md` on 2026-10-14: 16 agents, v1.11.0). PLANNED (1.12.0): the skill-count check excludes `agent-registry.md`, which states no skill total (`specs/spec-skills.md`, OP-10; the answer to OP-10 in `plan-deferred-decisions-20261016-1059.md`) |
| NFR-021 | The transition tables and test globs in `hooks/lib/fsa-tables.js` and `hooks/lib/fsa-paths.js` SHALL equal their markdown at every release. | BR-015, FR-121 | `node plugins/assist-plugin/scripts/check-fsa-tables.js --check` exits 0 |

#### Scenario: Count drift
- **GIVEN** a new agent file and a `README.md` that still says 16 agents
- **WHEN** a maintainer runs the counts checklist in `CLAUDE.md`
- **THEN** the checklist SHALL flag `README.md` as out of date

#### Scenario: Registry states no skill total
- **GIVEN** `skills/do/references/agent-registry.md` lists 16 agents and states no skill total
- **WHEN** a maintainer runs the skill-count check of NFR-020
- **THEN** the check SHALL compare the 22-skill total with the seven other files only and SHALL NOT flag the registry for a missing skill total

#### Scenario: Table drift
- **GIVEN** a `## States` table edited without the matching JavaScript
- **WHEN** the check runs
- **THEN** the check SHALL exit 1

### 5.8 Installation stability

| ID | Requirement | Traces to | Metric |
|----|-------------|-----------|--------|
| NFR-022 | The marketplace name `assist-plugin-marketplace`, the plugin name `assist-plugin`, and the install id `assist-plugin@assist-plugin-marketplace` SHALL stay unchanged across releases. | BR-011, FR-172 | 0 renames |
| NFR-023 | `README.md` and `MARKETPLACE.md` SHALL document installation with `/plugin marketplace add tjmonsi/assist-marketplace-plugin` and `/plugin install assist-plugin@assist-plugin-marketplace`. | BR-011, UR-047 | 2 commands, exact strings, in both files |

#### Scenario: Release keeps the id
- **GIVEN** a release candidate
- **WHEN** the manifests are compared with NFR-022
- **THEN** the names SHALL match and the release SHALL proceed

#### Scenario: Wrong name in docs
- **GIVEN** a document that gives the repo path where the install id belongs
- **WHEN** a reviewer compares it with NFR-023
- **THEN** the reviewer SHALL flag the line

### 5.9 Testing

| ID | Requirement | Traces to | Metric |
|----|-------------|-----------|--------|
| NFR-024 | New and changed production code SHALL reach at least 70% test coverage, measured across unit and integration tests together. | BR-005, FR-058 | 70% (`rules/assist-plugin-rule.md`, Testing Coverage Gate) |

#### Scenario: Below the bar
- **GIVEN** new code with 55% coverage
- **WHEN** the Testing Gate runs
- **THEN** qa SHALL return `returned`

#### Scenario: At the bar
- **GIVEN** new code with 70% coverage and passing suites
- **WHEN** the Testing Gate runs
- **THEN** qa SHALL return `approved`

## 6. Scope

#### In scope (system behaviors)

- `/do` orchestration: ingest, resume, stop, decompose, clarify, routing, approval, dispatch, review gates, display, cleanup (FR-001 to FR-018, FR-045 to FR-064).
- Spec-first flow: SpecGate, conflict check, Clarify bounds, document chain, change check, DocSignOff, waiver, decision records, intake review (FR-019 to FR-044).
- The 16 agents, their tool limits, and the terminal block (FR-065 to FR-085).
- Hooks, guards, health, and maintenance scripts (FR-086 to FR-125, FR-198).
- The 22 skills, manifests, and repository documents (FR-130 to FR-173, FR-179, FR-193 to FR-197, FR-200, FR-201).
- The three 1.11.1 changes, built: FR-126 to FR-129 and FR-180 (drift checks and the write guard lists they read), FR-175 to FR-177 (untrusted-input rules), FR-178 (changelog pointer).
- Repository self-documentation (FR-174), built: this repository's requirements are in `docs/requirements/`, its specs in `specs/`, and its task plan in `docs/task-plans/`.
- The document locations of 2026-10-16, built in 1.11.1: FR-182 and FR-183 (`docs/requirements/` output and grant), FR-184 and FR-185 (`docs/task-plans/` output and grant), FR-186 (`task-planner` write bar), FR-187 to FR-192 (SpecGate search, legacy notes, conflict-check path list, chain Writes, no path taken from `DECISIONS.md`, change check against the git root). The folders `docs/requirements/` and `docs/task-plans/` resolve against the git root of the session's working directory (a worktree uses its own root; outside a git repository, the working directory). PLANNED (1.12.0): the Spec step writes `specs/` under the same root (FR-190); the `specs/` search already resolves against it (FR-187, FR-189).
- The `docs/tts/` exemption under the project root and the session directory (FR-181), built in 1.11.1.
- The 1.12.0 changes, PLANNED, from the 40 deferred points answered on 2026-10-16: the named OWASP for LLM gate over `skills/**` (FR-054, FR-061, FR-199, NFR-011); Cleanup chooses the terminal and prints its report (FR-062 to FR-064); the snapshot-file outcome (FR-032); `ask` model row, registry-first routing, no plan file on a first-pass Error, the `general-purpose` body (FR-007, FR-009, FR-010, FR-012); skill rules (FR-136 to FR-139, FR-143, FR-147, FR-148, FR-175 to FR-177, FR-193 to FR-197, FR-200, FR-201, NFR-004, NFR-013, NFR-015, NFR-020); hook rules (FR-088, FR-091, FR-093, FR-094, FR-099, FR-118, FR-198).
- The follow-up to 1.12.0, built for 1.13.0 (version 1.4), from the user's answers in the version 1.3 elicitation: Bitbucket support in `/pr-review` and the `/do` PR review flow (FR-142 to FR-144, FR-195, FR-202, FR-203); `/pr-review` direct-run hardening (FR-204, FR-205); `/do` PR flow hardening, the posting ask hook, `.agent` symlink checks, and PR file cleanup (FR-206 to FR-208); `/bump --path` validation (FR-209); and the checklist wording (FR-210).

#### Out of scope (system exclusions)

| Excluded item | Reason | Deferred to |
|---------------|--------|-------------|
| `fsa-write-bar` coverage of Bash writes and symlink resolution | The hook judges Write, Edit, MultiEdit, and NotebookEdit paths as written (`hooks/impl/fsa-write-bar.js`) | Not scheduled in the sources |
| Hooks as a security boundary | Hooks are guardrails and fail open (`rules/assist-plugin-rule.md`) | Never |
| `commit-attribution-guard` coverage of `git tag`, `gh pr merge --subject/--body`, messages built from a variable, and messages piped through stdin | The hook reads only message text visible in the command or a regular file (`hooks/impl/commit-attribution-guard.js`) | Not scheduled in the sources |
| `injection-filter` decoding of base64, look-alike letters from other scripts, and non-English text | It is a pattern filter (`README.md`, Injection filter) | Not scheduled in the sources |
| Vector or retrieval layer (OWASP LLM08) | The plugin has none (`rules/llm-security-checklist.md`) | Never |
| Agent-run installs of `mmdc`, `ctx7`, `firecrawl`, Python scanners, or Playwright | Agents show install commands and never run them | Never (stated exclusion) |
| Audio generation by `/voice-script` | The skill writes script files only | Never (stated exclusion) |
| Skills for Jira, Bitbucket PR tooling beyond `pr-review`, certificate prep, context7, branch-to-Jira; meta-skills create-agent and create-skill | The plugin stays generic (`docs/TOKEN_OPTIMIZATION.md`) | Never (stated exclusion) |
| A `## States` table for `qa`, `planner`, `ask`, `explore`, `researcher`, `devops`, `general-purpose`, `worker`, `requirements-gatherer`, and `solutions-architect` | `/do` accepts any `trace` from an agent without a table (`skills/do/references/fsa-template.md`) | Not scheduled in the sources |
| Request changes on Bitbucket Data Center through the participants call | The call needs the signed-in user's slug, and the research found no verified bkt command that prints it (`.agent/research/bkt-cli-forms-20261017.md`, Request changes; Not confirmed) | Not scheduled; Data Center posts a comment instead (FR-195) |
| Ask-hook coverage of the 11 known gaps of FR-206 (among them `gh api`, `gh pr edit`, `gh pr ready`, `gh pr reopen`, posting commands built from variables, and split redirections such as `2>&1`) | The hook is a best-effort string-matching guardrail that fails open; a form found later joins the gap list and does not reopen the spec (FR-206; `DECISIONS.md:258-261`; "Hooks as a security boundary" above) | Not scheduled in the sources |

## 7. Constraints

- Technical: hook entry files use ES5 syntax and hook modules use ES2015 syntax, so they parse on Node 6 or newer (`hooks/lib/launch.js`).
- Technical: subagents cannot call `AskUserQuestion`; they ask through `NeedsInput` and `/do` relays (`skills/do/references/fsa-template.md`, Rule T5).
- Technical: hooks read `${CLAUDE_PLUGIN_ROOT}` and write `${CLAUDE_PLUGIN_DATA}`; without the data variable failures cannot be logged and guards cannot be disabled (`skills/health/SKILL.md`).
- Technical: the plugin is licensed AGPL-3.0-or-later (`plugin.json`, `README.md`).
- Interface: `/do` dispatches agents as `assist-plugin:<name>` and parses the ten-field `fsa` block.
- Interface: the marketplace manifest follows the Claude Code marketplace schema (`.claude-plugin/marketplace.json`).
- Interface: `gh` or `bkt` must be installed and authenticated for `/pr-review` (`skills/pr-review/SKILL.md`). Built (1.13.0): `bkt` means avivsinai/bitbucket-cli, targeted at v0.34.0 (released 2026-10-15), whose binary name matches dimo414/bkt (FR-202); bkt has no host flag on PR commands, so the host is pinned by FR-203.
- Process: the markdown is the source of truth for the state tables and test globs; on drift, edit the JavaScript to match (`scripts/check-fsa-tables.js`).
- Process: no requirement in this document contradicts a `DECISIONS.md` entry, with one reading to note (the last sentences of this bullet: `DECISIONS.md:135` against FR-112). The entries that bind these requirements are 2026-10-12 (prose hooks, attribution, scoped grants, clarify and voice-script), 2026-10-13 (spec-first, task-planner, protected paths, narrowed hidden-path bar), and 2026-10-14 (self-hosted documents, changelog pointer; Write guard lists live in `rules/assist-plugin-rule.md`). The 2026-10-16 entry "Requirements in docs/requirements/, task plans in docs/task-plans/" corrects the location part of the 2026-10-14 self-hosted-documents entry: requirements go to `docs/requirements/`, task plans to `docs/task-plans/`, specs stay in `specs/`, and older projects keep root-level files in place with a plain note in `DECISIONS.md` (FR-182 to FR-190, FR-174). The second 2026-10-16 entry, "Legacy root documents and the requirements JSON", settles three points: `task-planner` writes only `docs/task-plans/task-plan-*.md` (root-level plans in older projects are read, and a rework writes a new file in `docs/task-plans/`), `requirements-<slug>.json` goes to `docs/requirements/`, and SpecGate also searches the old root patterns and, after plan approval, appends a plain note to `DECISIONS.md`. The 2026-10-16 entry "Legacy location records are notes, not search input" makes that record a note and has SpecGate find root-level documents only through its fixed root patterns, never by paths parsed out of `DECISIONS.md` (FR-187, FR-188, FR-191). The 2026-10-16 entry "docs/requirements/ and docs/task-plans/ resolve against the session's git root" resolves both folders against the git root of the session's working directory (a worktree uses its own root; outside a git repository, the working directory) for SpecGate, the `gather-requirements` and `task-plan` writes, and the `fsa-write-bar` judgement of the `task-planner` path, so a session started in a subdirectory gets a write prompt because the skills' `./` grants are relative to the working directory (FR-182 to FR-187). The 2026-10-16 entry "1.11.1 design points for root notes, change check, and grants" fixes four points: for the root note, `/do` reads only the headings of `DECISIONS.md`, at plan approval just before it appends a "kept at the repository root" note, to skip a duplicate, and the cited-line window of FR-024 is unchanged (FR-188); the change check takes its snapshots and steering-file hashes against the session's git root (FR-192); `gather-requirements` keeps its grant scoped to `docs/requirements/`, so an in-place update of a legacy root-level requirements file asks the user first (FR-183); and with no usable working directory `fsa-write-bar` lets `task-planner` write only a plain relative `docs/task-plans/task-plan-*.md` and denies absolute, `~`, drive-relative, and `..` targets (FR-186). The 2026-10-12 entry on prose hooks fixes the `docs/tts/` exemption relative to the project root, and the 2026-10-16 entry refines it to the project root plus the session's working directory when that directory is inside the project (FR-104, FR-181). Twenty-two entries (counted at `DECISIONS.md:108-216`), eighteen of them dated 2026-10-16 and added on this plan's date after the 1.11.1 sign-off, one more of 2026-10-16 ("doc-cli-guard is best-effort with a listed set of known gaps", `:198`), and three of 2026-10-17 (the sign-off at `:203`, "/do PR review supports GitHub only in 1.12.0" at `:208`, and "/do PR flow hardening after the security gate" at `:213`), bind the 1.12.0 changes: "OWASP for LLM gate is a named /do gate covering skills/**" (FR-054, FR-061, FR-199, NFR-011), "Specs resolve against the session's git root" (FR-187, FR-189, FR-190), "/do PR review relays a draft, then a separate step submits" (FR-195, refined by the entries at `DECISIONS.md:148-151`, `:153-156`, and `:158-161`: the draft ends `Done` and the main conversation fetches and submits), "/bump --path naming and pointer changelogs" (FR-138, FR-139), "skills metadata.json mirrors SKILL.md frontmatter" (FR-193), "A non-plugin --agent main session is a main session" (FR-112), "Documentation CLI guard and injection filter cover PowerShell and launchers" (FR-094, FR-099, FR-198), "/commit runs on Haiku through frontmatter" (FR-196), "The main conversation submits a /do PR review; mmdc reaches root specs" (FR-195, FR-093, FR-199), "/do PR review draft arrives in a Done block; more package runners" (FR-195, FR-198), "LLM gate trigger, branch grant, mmdc root paths, and PR flags" (FR-061, FR-093, FR-195, FR-175 to FR-177, NFR-013), "Read-only program grants are scoped; Bitbucket returned reviews comment" (NFR-013, FR-143), and "LLM gate path anchor, metadata source, PowerShell aliases, writing-context self-test" (FR-061, FR-199, NFR-011, FR-193, FR-099, FR-094, FR-198, FR-118, FR-091), "Auto-loaded files join the LLM gate; mmdc reaches subproject specs" (FR-061, FR-199, NFR-011, FR-054, FR-093), and "One confirmation covers a /do PR review submission" (FR-143, FR-195; its exception is withdrawn by the next entry), "/do fetches PRs by redirect and posts with gh or bkt" (FR-195, FR-143), "doc-cli-guard judges every chained command; PowerShell assignment forms" (FR-094, FR-099, FR-200), and "Shell operators stay denied in documentation CLIs; Bitbucket approvals; test DSNs" (FR-094, FR-195, NFR-015), "doc-cli-guard is best-effort with a listed set of known gaps" (FR-094, FR-198), "Deferred-decision documents signed off for 1.12.0" (this document as a whole), "/do PR review supports GitHub only in 1.12.0" (FR-195; FR-143 as a note), and "/do PR flow hardening after the security gate" (FR-195, FR-094, FR-099). One difference remains between a recorded entry and a requirement: `DECISIONS.md:135` says a call with an `agent_type` but no `agent_id` is a main session, which reads broader than FR-112. FR-112 keeps a main session started with `--agent assist-plugin:<name>` denied, as the heading at `DECISIONS.md:133` ("A non-plugin --agent main session is a main session") and `hooks/impl/fsa-write-bar.js:26-28` say, so the statement "no requirement contradicts a `DECISIONS.md` entry" holds only with that reading.

- Process: two `DECISIONS.md` entries came after the twenty-two counted above. `DECISIONS.md:218-221` (2026-10-17, "code-reviewer and researcher run at effort high") concerns agent effort values, binds none of FR-202 to FR-210, and no requirement here contradicts it. `DECISIONS.md:223-226` (2026-10-22, "PR posting safeguards and Bitbucket in the PR review flows") binds FR-143 (the Cloud request-changes rule replaces `DECISIONS.md:163-166` for Cloud and leaves it in force for Data Center), FR-195 (the Bitbucket flow ends the GitHub-only limit of `DECISIONS.md:208-211`, which that entry supersedes for Bitbucket), FR-203 (host pin), FR-206 (ask hook), FR-207 (symlink checks), FR-208 (cleanup), and FR-209 (`--path`). The entry does not record the direct-run points of FR-204, FR-205, and FR-210. `DECISIONS.md:228-231` (2026-10-22, "Bitbucket request-changes order, hook rejection, and stricter checks") refines `DECISIONS.md:223-226` and binds FR-143 and FR-195 (Cloud order: comment first, no request-changes call when the comment fails; hook-rejection outcomes), FR-206 (ask on a `bkt api` call with a body flag and no method), FR-208 (`pr-<N>.*` and `pr-<N>-*` matching), and FR-209 (no dots-only segment; normalize before validation); section 9 open points 3, 5, 6, 7, and 9 are closed by it. No requirement here contradicts it. `DECISIONS.md:233-236` (2026-10-22, "Each Bitbucket post is its own command; a rejected prompt stops the pair") refines `DECISIONS.md:228-231` and binds FR-143 and FR-195 (each bkt post is its own Bash command with its own hook prompt; a rejected first prompt of a pair runs no second command and records both as declined; on Cloud an allowed comment and a rejected request-changes prompt record the comment as posted and the request as declined; the step is completed and the PR files are removed), FR-206 (one prompt per command), and FR-208 (cleanup after a rejection). No requirement here contradicts it. Version 1.4 adds seven entries of 2026-10-22 (listed through `DECISIONS.md:271`). `DECISIONS.md:238-241` ("bkt api repository flags and unknown options") binds FR-202 and FR-203 (a `bkt api` call names the repository through its relative path and takes no repository flags) and FR-206 (the hook asks on any `bkt api` option it does not recognize). `DECISIONS.md:243-246` ("Follow-up build scope, supersession, and timing method") binds the Status flips of version 1.4 and confirms the NFR-008 and NFR-025 method (median of 20 runs, 110 ms, a SHOULD). `DECISIONS.md:248-251` ("Follow-up documents signed off; step 1 research results applied") binds FR-202, FR-203, and FR-206 (the settled bkt facts and the array-form filters). `DECISIONS.md:253-256` and `DECISIONS.md:258-261` bind FR-209 and FR-139 (rule R8) and FR-206 (closed forms, the known-gap list, the best-effort stance). `DECISIONS.md:263-266` binds FR-208 and FR-144 (cleanup by exact name, no glob), FR-143 and FR-195 (the body-hash check before `bkt pr approve`), FR-209 (R6 is `test -d` with no `--`), and FR-202 (the meaning of "exactly one" for the context lookup). `DECISIONS.md:268-271` binds FR-206 (the full gap list in five places). No requirement here contradicts them.

## 8. Traceability matrix

Each row lists the user requirements derived from the business requirement, the functional requirements that trace to those user requirements, and the non-functional requirements that name the business requirement or one of its functional requirements.

| BR | UR | FR | NFR | Status |
|----|----|----|-----|--------|
| BR-001 | UR-001 to UR-005, UR-022 | FR-001 to FR-018, FR-025, FR-026, FR-045 to FR-053, FR-062 to FR-066, FR-068 to FR-070, FR-083 | NFR-010 | Built; PLANNED (1.12.0) parts: FR-007, FR-009, FR-010, FR-012, FR-062 to FR-064 |
| BR-002 | UR-001, UR-002 | FR-001, FR-005, FR-008 to FR-018, FR-045, FR-046, FR-053, FR-065, FR-066 | none | Built; PLANNED (1.12.0) parts: FR-009, FR-010, FR-012 |
| BR-003 | UR-024 | FR-107 | NFR-001 to NFR-005, NFR-008, NFR-025 (NFR-006 withdrawn) | Built; PLANNED (1.12.0) part: NFR-004; Built (1.13.0): NFR-025 |
| BR-004 | UR-004, UR-006 to UR-009, UR-011 | FR-005, FR-006, FR-007, FR-019 to FR-030, FR-032 to FR-041, FR-043, FR-044, FR-049, FR-050, FR-070 to FR-073, FR-083, FR-151, FR-187 to FR-192 | none | Built; PLANNED (1.12.0) parts: FR-007, FR-032, FR-190 |
| BR-005 | UR-013, UR-014, UR-034, UR-042, UR-049, UR-053, UR-057 | FR-048, FR-053 to FR-061, FR-077 to FR-082, FR-109, FR-130, FR-147, FR-148, FR-167 to FR-171, FR-193, FR-199, FR-210 | NFR-011, NFR-024 | Built; PLANNED (1.12.0) parts: FR-054, FR-061, FR-147, FR-148, FR-193, FR-199, NFR-011; Built (1.13.0): FR-210 |
| BR-006 | UR-011, UR-012, UR-019 to UR-021, UR-031, UR-050, UR-054 to UR-056 | FR-022, FR-024, FR-027, FR-031 to FR-033, FR-035, FR-043, FR-044, FR-065, FR-067, FR-071, FR-074, FR-076, FR-085, FR-092 to FR-094, FR-099 to FR-102, FR-108 to FR-114, FR-142 to FR-144, FR-151, FR-175 to FR-177, FR-183, FR-185, FR-186, FR-190, FR-192, FR-195, FR-198, FR-202 to FR-209, FR-086 | NFR-012 to NFR-016 | Built; PLANNED (1.12.0) parts: FR-032, FR-093, FR-094, FR-099, FR-143, FR-175 to FR-177, FR-190, FR-195, FR-198, NFR-013, NFR-015; Built (1.13.0): FR-086 (counts), FR-202 to FR-209 |
| BR-007 | UR-017, UR-018, UR-022, UR-023 | FR-046, FR-047, FR-068, FR-069, FR-086 to FR-091, FR-115 to FR-120, FR-166 | NFR-007, NFR-009, NFR-016, NFR-017 | Built; PLANNED (1.12.0) parts: FR-088, FR-091, FR-118; Built (1.13.0): FR-086 (11 scripts and 16 commands), FR-091 and FR-118 (ask-hook clause) |
| BR-008 | UR-016, UR-024, UR-025, UR-034, UR-039, UR-043 | FR-103 to FR-107, FR-123 to FR-125, FR-147, FR-148, FR-161, FR-181 | NFR-018, NFR-019 | Built; PLANNED (1.12.0) parts: FR-147, FR-148 |
| BR-009 | UR-015, UR-028 | FR-095 to FR-098, FR-120, FR-135, FR-136, FR-196 | none | Built; PLANNED (1.12.0) parts: FR-136, FR-196 |
| BR-010 | UR-026 to UR-033, UR-035 to UR-038, UR-040, UR-041, UR-042, UR-049, UR-054, UR-056 | FR-200, FR-063, FR-074 to FR-078, FR-081, FR-083 to FR-085, FR-109, FR-130 to FR-146, FR-149 to FR-160, FR-162 to FR-165, FR-167 to FR-171, FR-179, FR-182 to FR-186, FR-195 to FR-197, FR-202 to FR-205, FR-209 | none | Built; PLANNED (1.12.0) parts: FR-063, FR-136 to FR-139, FR-143, FR-195 to FR-197, FR-200; Built (1.13.0): FR-202 to FR-205, FR-209, and the changes to FR-139, FR-142 to FR-144, FR-195 |
| BR-011 | UR-046, UR-047 | FR-172, FR-173, FR-194 | NFR-022, NFR-023 | Built; PLANNED (1.12.0): FR-194 |
| BR-012 | UR-007, UR-008, UR-010, UR-019 | FR-016, FR-020 to FR-027, FR-032, FR-033, FR-035, FR-041, FR-042, FR-065, FR-067, FR-072 to FR-074, FR-108 to FR-114, FR-183, FR-185 to FR-192, FR-195, FR-206, FR-207 | none | Built; PLANNED (1.12.0) parts: FR-032, FR-190, FR-195; Built (1.13.0): FR-206, FR-207 |
| BR-013 | UR-006, UR-035 to UR-038 | FR-005, FR-019, FR-020, FR-028 to FR-030, FR-032 to FR-035, FR-074 to FR-076, FR-078, FR-083 to FR-085, FR-149 to FR-160, FR-179, FR-182 to FR-187, FR-190 to FR-192, FR-197 | none | Built; PLANNED (1.12.0) parts: FR-032, FR-190, FR-197 |
| BR-014 | UR-048 | FR-174 | none | Built (1.11.1) |
| BR-015 | UR-044, UR-051 | FR-121, FR-122, FR-126 to FR-129, FR-180 | NFR-021 | Built (1.11.1); FR-126 accepted limit noted |
| BR-016 | UR-045, UR-053, UR-057 | FR-130, FR-193, FR-201, FR-210 | NFR-020 | Built; PLANNED (1.12.0) parts: FR-193, FR-201, NFR-020; Built (1.13.0): FR-210 |
| BR-017 | UR-052 | FR-178 | none | Built (1.11.1) |

**Orphans:** none. Every FR traces to at least one UR, every UR to at least one BR, and every NFR to a BR, UR, or FR. Rechecked for version 1.3: FR-202 to FR-210 trace to UR-054 to UR-057 (and UR-031, UR-019, UR-029 for some); UR-054 and UR-056 trace to BR-010 and BR-006, UR-055 to BR-006, UR-057 to BR-005 and BR-016; NFR-025 traces to BR-003 and FR-206. A follow-up FR (FR-206) that traces to UR-019 and UR-055 sits in the BR-006 and BR-012 rows, not the BR-010 row.

**Dead ends:** none. Every BR has at least one UR. BR-002, BR-004, BR-009, BR-010, BR-012, BR-013, and BR-014 have no NFR of their own; their quality bars sit in the NFRs of BR-003, BR-006, BR-007, and BR-016.

## 9. Open questions, assumptions, and source differences

**Assumptions**

- Status **Built** means the behavior is documented or implemented in the 1.11.1 sources named in each requirement's Source line (the 22 requirements that were PLANNED (1.11.1) were checked on 2026-10-16 by reading `hooks/`, `scripts/`, `agents/`, `skills/`, `rules/`, and the files under `tests/`). No hook, script, or test was run while writing this document, so no requirement is reported as verified by execution.
- Status **PLANNED (1.12.0)** means the user decided the behavior on 2026-10-16 and the 1.11.1 sources do not yet show it.
- Where a `DECISIONS.md` entry applies, the requirement follows it; where none applies and two sources disagree, the requirement follows the code and the most specific document.
- Requirements are written to be testable by reading files, running the named scripts, or driving the named hook with a fixed input.

- Decided by the user (`DECISIONS.md`, 2026-10-14, Write guard lists live in rules/assist-plugin-rule.md): the markdown source of truth for `PROTECTED_GLOBS`, `PROTECTED_FILES`, and `AUTO_LOADED` is a `## Write guard lists` section in `plugins/assist-plugin/rules/assist-plugin-rule.md` (one table per list under its own `###` subheading, exact code string in backticks in the first column), and `TASK_PLAN_GLOB` appears both there (`### Task-plan glob`) and in a one-row table under `## Write scope` in `agents/task-planner.md`. Both are created in 1.11.1 (FR-180). `verdictByStep` is parsed from the Outcome cells of the `## States` table in `agents/intake-reviewer.md` (FR-126).

**Notes (documented estimates, not requirements)**

- The base plugin load is about 2.5k tokens and the full load about 10k to 12k tokens (`docs/ARCHITECTURE.md`). The compact writing standard is about 300 tokens (`README.md`). No source gives a measurement method for these figures.

**Open questions**

1. NFR-002 and NFR-008 carry a measurement method now, but their limits (1,195 characters, 110 ms) still come from documented estimates. The NFR-008 and NFR-025 method (median wall-clock time of 20 runs of `node hooks/<hook>.js` on a fixed input per hook, limit 110 ms, a SHOULD, so a median over it is a finding) is confirmed by the user (`DECISIONS.md:243-246`). The qa run reported measured medians on this machine: `pr-post-ask` 57.6 ms, `prose-gate` 67.2 ms, `prose-advisor` 56.1 ms, `fsa-write-bar` 54.4 ms. The 110 ms limit itself still comes from the documented estimate, so the question that remains is whether the maintainers want to replace it with a limit set from measured values.
2. `README.md`, `docs/SPECIFICATION.md`, and `docs/TOKEN_OPTIMIZATION.md` quote different savings figures with no stated measurement method. This document leaves token savings as BR-003 with no percentage target.
3. Closed by the user on 2026-10-16 (`DECISIONS.md:158-161`): `.claude/settings*.json` stays in the LLM gate trigger (FR-061, FR-199, NFR-011).
4. Closed by the user on 2026-10-16 (`DECISIONS.md:148-151`): the named OWASP for LLM gate uses the Security gate's iteration bound and binding final `code-reviewer` pass (FR-055, FR-199).
5. Closed by the user on 2026-10-16 (`DECISIONS.md:148-151`, `:158-161`, `:173-176`): `sa-mermaid-only` accepts absolute `-i` and `-o` paths under `<git root>/specs/` and `<git root>/<dir>/specs/` with the same segment rules, the walk for `.git` starts at the hook input's cwd, and absolute paths are denied when no `.git` is found (FR-093).
6. Closed by the user on 2026-10-16 (`DECISIONS.md:148-151`, `:153-156`, `:158-161`): PR review under `/do` has `/do` fetch the PR by redirect into `.agent/pr-review/pr-<N>.diff` (`DECISIONS.md:183-186`) so that only `reviewer` reads the PR text; `reviewer` drafts in the prose above its block and ends `Done` with `approved` or `returned`; `/do` shows the draft; after the user confirms, `/do` itself posts with `gh pr review` (`--approve`, `--request-changes`, `--comment`) through a body file, calling no `/pr-review`; no subagent posts; and, as 1.12.0 history, `DECISIONS.md:208-211` limited this flow to `github.com` remotes; `DECISIONS.md:223-226` and the follow-up of version 1.3 restore Bitbucket remotes (FR-195, FR-202, FR-203).
7. FR-196 depends on Claude Code skill frontmatter supporting `model`. The spec step verifies it; this document does not.
8. Closed as a plain fix: the OP-14 answer covers the release checklist (FR-194), and the documentation drift in `docs/SPECIFICATION.md:292` (two `technical-writing` subcommands where the skill has four), `MARKETPLACE.md:50` (omits `check-fsa-tables.js`), and `MARKETPLACE.md:78` (tags like `assist-plugin--v1.1.0` while `/bump` creates `vX.Y.Z`) is now FR-201.
9. Closed by the user on 2026-10-16 (`DECISIONS.md:158-161`): in "answer N, block M" citations each answered question is its own answer N (FR-175 to FR-177).
**Settled by the user (`DECISIONS.md`, 2026-10-16, Legacy root documents and the requirements JSON)**

- `task-planner` writes only `docs/task-plans/task-plan-*.md`. Root-level task plans in older projects stay and are still read, and a rework of one writes a new file in `docs/task-plans/` (FR-184, FR-186, FR-190).
- `requirements-<slug>.json` goes to `docs/requirements/` (FR-182, FR-183, FR-187, FR-190).
- SpecGate also searches the old root patterns. On a hit with no earlier note, /do appends a plain note to `DECISIONS.md` after the user approves the plan and keeps the files in place (FR-187, FR-188). `DECISIONS.md` (2026-10-16, "Legacy location records are notes, not search input") makes that record a note for people: SpecGate finds root-level documents through its fixed patterns and never parses a path out of `DECISIONS.md` (FR-191), and it replaces the proposed `Location:` line form.
- `docs/requirements/` and `docs/task-plans/` resolve against the session's git root (`DECISIONS.md`, 2026-10-16, "docs/requirements/ and docs/task-plans/ resolve against the session's git root"): FR-182, FR-184, FR-186, FR-187.

- For the root note, `/do` reads only the headings of `DECISIONS.md`, at plan approval just before it appends a "kept at the repository root" note, to skip a duplicate; the cited-line window of FR-024 is unchanged (`DECISIONS.md`, 2026-10-16, "1.11.1 design points for root notes, change check, and grants"; FR-188). SpecGate still reads none of the files it lists, and heading text is untrusted.

**Settled by the user on 2026-10-16 (deferred points, recorded in `.agent/main-plan/plan-deferred-decisions-20261016-1059.md` under User Decisions and in the 2026-10-16 entries of `DECISIONS.md`)**

- Orchestration: OPEN-1 (FR-054, FR-061, FR-199), OPEN-2 (FR-062 to FR-064), OPEN-3 (FR-032), OPEN-4 (FR-010), OPEN-5 (FR-007), OPEN-6 (FR-012), OPEN-7 (FR-009), and the `specs/` git-root path (FR-190; FR-187 and FR-189 pass today).
- Skills: OP-1 (FR-061, NFR-011), OP-3 (FR-148), OP-4 (FR-195), OP-5 (NFR-004), OP-6 (NFR-013), OP-7a, OP-7b, OP-7d, OP-7e and the pointer follow-up (FR-137 to FR-139, FR-200), OP-8 (FR-143), OP-9 (FR-175 to FR-177), OP-10 (NFR-020), OP-11a and OP-11b (FR-136, FR-196), OP-12 (FR-147), OP-13 (NFR-015), OP-14 (FR-194), the FR-177 versus FR-154 conflict (FR-154, FR-177), and the `metadata.json` mirror (FR-193).
- Hooks: OP-B1 (FR-088), OP-B2 (FR-091), OP-B3 (FR-092), OP-B4 (FR-094), OP-B5a and OP-B5b (FR-118), OP-B7 (FR-112), OP-B8 and OP-B11 (FR-094, FR-099), OP-B9 and OP-B10 (FR-198), OP-B12 (FR-126, accepted limit).
- Plain fixes: the Dispatch-only compare-before-write rule (FR-032), the build-intent scenario (FR-005, found Built in 1.11.1 at `skills/do/SKILL.md:171-181`), the `[Author]` rule (FR-197), and OP-7c, the `--no-changelog` argument hint (FR-138).
- Later answers of 2026-10-16 (`DECISIONS.md:148-161`): PR review drafts in `reviewer` and ends `Done`, the main conversation fetches the PR, maps the verdict to a flag, and submits (FR-195); `sa-mermaid-only` accepts absolute paths only under `<git root>/specs/` (FR-093); the OWASP for LLM gate uses the Security gate's bound and binding pass, and `.claude/settings*.json` stays in the trigger (FR-199, FR-061); package runners also include `npm exec`, `pnpx`, `yarn dlx`, and `bun x` (FR-198); `branch` `Bash(git:*)` is an NFR-013 exception; each answered question is its own answer N (FR-175 to FR-177). Further answers (`DECISIONS.md:163-216`; `:213-216` hardens the `/do` PR review flow with a pinned `--repo 'github.com/<owner>/<repo>'`, symlink checks and `rm -f`, a Write-tool body file, a hash-mismatch rule, and a public-draft statement in the reviewer prompt, FR-195, and lists new `doc-cli-guard` and injection-filter bypass forms as known gaps, FR-094, FR-099; `:208-211` limits the `/do` PR review flow to `github.com` remotes in 1.12.0, so any other host, Bitbucket included, fails the step with `precondition-failed` and the message to run `/pr-review` directly, and leaves the correction of the `bkt` command forms, including `/pr-review`'s references, as a follow-up outside these requirements (brought inside them in version 1.3: FR-202, FR-203, and `DECISIONS.md:223-226`), FR-195, FR-143; `:198` keeps `doc-cli-guard` best-effort with listed known gaps and adds `exec`, `sudo`, and `eval` as wrappers, FR-094, FR-198; `:203` records the sign-off; `:193-196` keeps the whole-command shell-operator denial in `doc-cli-guard` when any part runs `ctx7` or `firecrawl`, has an approved Bitbucket review run `bkt pr approve` then `bkt pr comment` under the one confirmation with a failed comment reported and the approval standing, and builds test database URLs from variables, FR-094, FR-195, NFR-015; `:183-186` has `/do` fetch a PR by `gh` or `bkt` through Bash with the output redirected into `.agent/pr-review/pr-<N>.diff` (200 KB cap), post a confirmed draft itself with `gh pr review` or `bkt` through a body file, call no `/pr-review`, and withdraws the `:178-181` exception, FR-195, FR-143; `:188-191` has `doc-cli-guard` judge each part of a chained command, the injection filter skip a leading PowerShell assignment and an opening `(` or `$(`, and `/bump` offer three answers when it stops on an unclear changelog, FR-094, FR-099, FR-200; `:173-176` adds any `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md` at any depth to the LLM gate and `<git root>/<dir>/specs/` to the mmdc paths; `:178-181` makes the user's yes to `/do`'s prompt for a draft the `/pr-review` confirmation for that identical draft text in the same turn, with no re-draft and no second ask, while any other pre-supplied flag still asks, FR-143, FR-195): read-only fixed-program Bash grants are scoped (NFR-013); a returned verdict on Bitbucket posts a comment and leaves the PR open in a direct `/pr-review` (FR-143 alone, since the 1.12.0 `/do` flow was GitHub only; the follow-up restores Bitbucket there, FR-195); the LLM surface path anchor (FR-061, FR-199, NFR-011); SKILL.md frontmatter is the source of `metadata.json` and `debug` gains `effort: high` (FR-193); `iwr` and `irm` aliases and per-shell case rules (FR-094, FR-099, FR-198); a failed `writing-context` self-test never disables it (FR-091, FR-118).

**Settled by the user in the version 1.3 elicitation (follow-up to 1.12.0; recorded at `DECISIONS.md:223-226`)**

- Ask hook: every session; `gh pr review`, `gh pr merge`, `gh pr comment`, `gh pr close`, `bkt pr approve`, `bkt pr comment`, `bkt pr decline`, `bkt pr close`, `bkt pr merge`, and `bkt api` with POST, PUT, PATCH, or DELETE (FR-206).
- Cleanup: the five files of PR `<N>` (removed by exact name with no glob, `DECISIONS.md:263-266`, which replaced the `pr-<N>.*` and `pr-<N>-*` matching of `DECISIONS.md:228-231`) are removed right after a post or a "do not post" answer, with a sweep at `/do` Cleanup, and nothing is removed through a symlinked folder (FR-208).
- `/bump --path`: the strict relative-path form (FR-209).
- Bitbucket host pin: refuse when `BKT_TOKEN`, `BKT_HOST`, or `BKT_CONFIG_DIR` is set; context base URL must match the origin host; `--context` and repository flags on every call; Cloud PR link check (FR-203). Request changes: Cloud through `bkt api` with a relative path, Data Center posts a comment and leaves the PR open (FR-143, FR-195).
- Symlink checks cover every `.agent/` write `/do` makes (plan file, snapshots, PR files) (FR-207).

**Settled by the user for the build (version 1.4; `DECISIONS.md:238-261`)**

- `bkt api` repository flags and unknown options: a `bkt api` call names the repository through its relative path and takes no repository flags; the ask hook asks on any `bkt api` option it does not recognize (`DECISIONS.md:238-241`; FR-202, FR-203, FR-206).
- Build scope and timing method: the build reuses the gated task plan, pauses for the 1.13.0 hand release and again before the commit, creates no tag, and pushes nothing; the NFR-008 and NFR-025 timing method is confirmed (`DECISIONS.md:243-246`).
- Step 1 results: `bkt api` sends GET with no method and no body and POST with a body; `--method` (short `-X`) is the method option; `bkt api` takes no repository flags; the `bkt --version` pattern holds; the two `--jq` filters use the array form (`DECISIONS.md:248-251`; FR-202, FR-203, FR-206).
- Review findings: `/bump --path` refuses a segment that starts with `.` or contains `..` (R8); the ask hook closes the cheap bypass forms and lists the rest as known gaps (`DECISIONS.md:253-256`; FR-139, FR-206, FR-209).
- Cleanup by name and pre-release fixes (`DECISIONS.md:263-266`): no glob in either cleanup (FR-208, FR-144); on Bitbucket the body-hash check runs as its own command before `bkt pr approve` (FR-143, FR-195); "exactly one" for the context lookup means one element that meets the Match rule (FR-202, FR-203).
- Where the gap list lives (`DECISIONS.md:268-271`): the full list sits in five places, and `CLAUDE.md`, `Claude.md`, and `ARCHITECTURE.md` carry a pointer plus the unverified items (FR-206).
- The ask hook is a best-effort guard; a bypass form found later joins every gap list without reopening the spec (`DECISIONS.md:258-261`; FR-206).

**Open points for the spec step (follow-up to 1.12.0), as of version 1.4**

Version 1.4 closes point 2 in part (the facts the build settled) and restates point 9. Points 11 and 12 (the two cleanup-glob items) are closed by `DECISIONS.md:263-266`, and point 6 is restated. Points 1, 3, 5, and 7 stay closed. Point 4 records a user choice and needs no action. Points 8 and 10 stay open.

1. Closed: `DECISIONS.md:223-226` (2026-10-22) records the Bitbucket answers. It ends the GitHub-only limit of `DECISIONS.md:208-211` and supersedes the comment-only rule of `DECISIONS.md:163-166` for Bitbucket Cloud (section 7).
2. Partly closed by the build (`DECISIONS.md:248-251`; FR-202, FR-203). Step 1 read the bkt v0.34.0 source and settled the `bkt --version` pattern (`^bkt version v?[0-9]+\.[0-9]+\.[0-9]+`), the `bkt api` method option (`--method`, short `-X`), its default method (GET with no body, POST with a body), the absence of repository flags on `bkt api`, the JSON-quoted `--jq` strings, and the array-form filters. Still unconfirmed: the `base_url` saved for a Cloud login (the pin accepts both `api.bitbucket.org` and `bitbucket.org`), server comment-length limits (the skill caps a Bitbucket comment at 16,000 bytes), whether the Data Center line cap affects `bkt pr diff`, and whether the case Bitbucket Cloud uses for the workspace and slug in the PR link matches the lowercase comparison (`.agent/research/bkt-cli-forms-20261017.md`, Not confirmed). None of these was run against a live host in this update.
3. Closed by the user (`DECISIONS.md:228-231`): on Bitbucket Cloud a returned verdict posts the findings as a comment first and then makes the request-changes call, and no request-changes call is made when the comment fails (FR-143, FR-195).
4. The posting ask hook adds a prompt after the confirmation of a direct `/pr-review` run, because a hook cannot tell the two flows apart. The user chose that scope.
5. Closed by the user (`DECISIONS.md:228-231`): FR-209 keeps its two narrowings of `DECISIONS.md:225`: no segment made only of dots (the regular expression alone would allow `.` and `...`), and the order normalize, validate, then name, with the repository-root path counting as no `--path` before validation.
6. Closed by the user (`DECISIONS.md:228-231`, replaced by `DECISIONS.md:263-266`): `DECISIONS.md:225` wrote `pr-<N>*`; `DECISIONS.md:228-231` read it as `pr-<N>.*` and `pr-<N>-*`, and `DECISIONS.md:263-266` then dropped the glob. FR-208 removes the five named files, so cleanup after PR 12 never removes the files of PR 123.
7. Closed by the user (`DECISIONS.md:228-231`): when the user rejects the ask-hook prompt after confirming a draft in `/do`, the step is `completed`, the Done field records that the post was declined at the hook prompt, nothing is retried, and the files of that PR are removed as for a "do not post" answer. If only the second prompt of the Bitbucket approve-then-comment pair is rejected, the step is `completed` with the approval recorded as posted and the comment as declined (FR-195).
8. The research found no bkt form for PR merge conflicts, so FR-142 limits the conflicts item to GitHub and says so on Bitbucket. Whether a conflict check through `bkt api` belongs in a later release is open.
9. Closed by the user (`DECISIONS.md:228-231`): FR-206 asks on a `bkt api` call that has a body flag (`--input` or `--field`) and no method, because the research did not confirm bkt's default method. This is broader than the method list in `DECISIONS.md:225`. Step 1 confirmed from the source that bkt sends POST when a body is present (`DECISIONS.md:248-251`), which supports the rule; it stays in FR-206 and also covers an unrecognized option (`DECISIONS.md:238-241`).
10. The Data Center remote forms and the one-matching-context rule of FR-203 follow `pr-detection.md:48-62` and the research's `auth status` keys; the spec step confirms them against real remotes, because the research did not run bkt. Still open at version 1.4: no real remote was run.
11. Closed by the user (`DECISIONS.md:263-266`): `/do` removes the five PR files by exact name with `rm -f --` after the symlink guard, in one command that exits 3 on a symlink, with no glob, so it behaves the same in bash and zsh (FR-208). The glob form at `specs/spec-orchestration-dispatch.md:1289` is replaced in the spec fold.
12. Closed by the user (`DECISIONS.md:263-266`): the `/pr-review` run-folder removal checks the `"${TMPDIR:-/tmp}/pr-review."` prefix, refuses `..`, removes its known files by name, and runs `rmdir` (FR-144). The unbound form at `specs/spec-skills-pr-review.md:655` is replaced in the spec fold.

**Source differences found (not requirements)**

- `skills/pr-review/references/pr-detection.md:23`, `:24`, and other lines still hold the placeholder-credential hits that NFR-015 lists; FR-202 touches the same file, so the spec step handles both together.

- At 4803a0d, `skills/do/SKILL.md` (SpecGate step 2 and the Decompose chain table), `skills/gather-requirements/SKILL.md` (Output and Write scope), `skills/task-plan/SKILL.md` (Routing and Write scope), `agents/task-planner.md` (Write scope), `agents/intake-reviewer.md` (Conflict check), and `hooks/lib/fsa-paths.js` (`TASK_PLAN_GLOB`) place requirements and task plans at the repository root or the working directory. `DECISIONS.md` (2026-10-16) puts them in `docs/requirements/` and `docs/task-plans/`. FR-182 to FR-190 closed the difference in 1.11.1 (checked by reading the sources on 2026-10-16), apart from the Spec step's `specs/` path (FR-190, PLANNED, 1.12.0).
- `rules/llm-security-checklist.md` (lines 187 and 316, section "LLM06" and the table "Open Gaps Found in This Audit") says no agent file declares `tools:` and names 12 agent files. All 16 current agent files declare `tools:`. FR-065 and FR-067 follow the agent files.
- `hooks/lib/prose-diff.js:95-101` resolves the `docs/tts/` exemption against the hook's cwd, while `DECISIONS.md` (2026-10-12) says relative to the project root and the 2026-10-16 entry adds the session's working directory when it is inside the project. The user decided the decision governs; FR-181 closed the difference in 1.11.1 and FR-104 states both. These documents were listed as describing the cwd rule: `CLAUDE.md:96` (and :97 for the advisor), `plugins/assist-plugin/Claude.md:76` (and :77), `README.md:293`, `skills/voice-script/SKILL.md:162`, `skills/health/SKILL.md:17`, and `docs/SPECIFICATION.md:420`. By the coordinator's check, `CLAUDE.md:99-100`, `README.md:296`, `skills/voice-script/SKILL.md:162`, `skills/health/SKILL.md:17`, and `docs/SPECIFICATION.md:420` now name both locations; this pass confirmed by grep that `plugins/assist-plugin/Claude.md:76-77` does too. The note is closed.
- `plugins/assist-plugin/CHANGELOG.md` stopped at 1.3.0 while the root `CHANGELOG.md` reached 1.11.0. FR-178 removed the difference in 1.11.1: the file is a pointer.
- `DECISIONS.md:135` says fsa-write-bar treats a call with an `agent_type` but no `agent_id` as the main session, which reads broader than FR-112 and `hooks/impl/fsa-write-bar.js:171-176` (comment `:26-28`). The heading at `DECISIONS.md:133` ("A non-plugin --agent main session is a main session") and the code limit it to a type without the `assist-plugin:` prefix, so a main session started with `--agent assist-plugin:<name>` stays denied (FR-112 scenario). `DECISIONS.md` is append-only, so the entry is not edited; FR-112 follows the heading and the code.
- Differences that the 2026-10-16 answers settle, still present in the 1.11.1 sources and closed by the 1.12.0 changes: the missing `ask` row in `model-routing.md` (FR-010); the `general-purpose` body (FR-007); the Display and Cleanup split of the terminal state (FR-062 to FR-064); the first-pass Error plan file (FR-012); the snapshot-file outcome (FR-032); the narrow LLM gate glob (FR-061, NFR-011); the nine-caller list in `skills/review-md/SKILL.md:31` (FR-148); the stop rule in `skills/review-md/SKILL.md:35` (FR-147); `skills/bump/SKILL.md:15` and `bump-strategy.md` (FR-137 to FR-139); `skills/pr-review/SKILL.md:207-208` and `pr-detection.md` (FR-143, NFR-015); the `commit` frontmatter and `metadata.json` (FR-193, FR-196); `skills/gather-requirements/SKILL.md:133` (FR-197).

## 10. Glossary

| Term | Definition |
|------|-----------|
| FSA | Finite-state automaton: a `## States` table in an agent or skill file plus the terminal block |
| Terminal block | The fenced `fsa` block of ten fields that ends a dispatched agent's final message |
| Chain step | One of the three document steps (requirements, spec, task plan) that `/do` puts ahead of build steps |
| Build step | A step marked `Build: yes` that writes code, config, pipelines, infrastructure, or tests |
| SpecGate | The `/do` state that classifies a request as `build` or `non-build` and lists existing documents |
| DocSignOff | The `/do` state where the user approves, edits, or cancels the chain documents |
| Embedded instructions | A reviewer's list of text in a request or document that is aimed at the agent itself |
| Untrusted-file wrapper | The `<untrusted-file>PATH</untrusted-file>` markup that marks a document path as data in a prompt |
| Protected paths | `.agent/main-plan/**` and any file named `DECISIONS.md`, which no subagent may write |
| Auto-loaded files | `CLAUDE.md`, `CLAUDE.local.md`, and `AGENTS.md`, which Claude Code loads into later sessions |
| Fail open | A hook failure lets the call proceed with a warning; only a positive match denies |
| Wave | A group of steps that `/do` dispatches together because none waits on another |

## 11. Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-14 | Toni-Jan Keith Monserrat | Initial draft for assist-plugin 1.11.0 plus three PLANNED 1.11.1 changes |
| 1.1 | 2026-10-16 | Toni-Jan Keith Monserrat | Baseline moved to 1.11.1. The 22 requirements PLANNED (1.11.1) set to Built after a read of the sources. The 40 deferred points answered on 2026-10-16 added as PLANNED (1.12.0): new FR-193 to FR-201; changed FR-005, FR-007, FR-009, FR-010, FR-012, FR-032, FR-054, FR-061 to FR-064, FR-088, FR-091, FR-092, FR-093, FR-094, FR-099, FR-112, FR-118, FR-126, FR-136 to FR-139, FR-143, FR-147, FR-148, FR-154, FR-175 to FR-177, FR-187, FR-189, FR-190, NFR-004, NFR-011, NFR-013, NFR-015, NFR-020 |
| 1.2 | 2026-10-17 | Toni-Jan Keith Monserrat | Post-sign-off changes from `DECISIONS.md:178-216`: FR-094 (per-part judging, metacharacter rule kept on the whole command, hidden-name assignment, known gaps), FR-099 (PowerShell assignment forms, known gaps), FR-143 (one-confirmation exception withdrawn, bkt forms follow-up), FR-195 (fetch by redirect, `gh` only on `github.com`, posting from `/do`, hardening), FR-198 (`exec`, `sudo`, `eval` wrappers), FR-200 (three answers on a stop), sections 7 and 9 (twenty-two entries through `DECISIONS.md:216`), and URD UC-003 |
| 1.3 | 2026-10-17 | Toni-Jan Keith Monserrat | Four follow-up groups after 1.12.0, PLANNED (follow-up to 1.12.0): new FR-202 to FR-210 (bkt v0.34.0 forms, Bitbucket host pin, direct-run untrusted-data rule and fetch cap, public-posting rule, PR posting ask hook, `.agent` symlink checks, `pr-review` file cleanup, `/bump --path` validation, checklist row 2 wording); changed FR-139, FR-142, FR-143 (citations of `SKILL.md:41`, `:82`, `:203` kept and `:209` corrected to `:208`; Bitbucket Cloud request changes), FR-144 (no fixed body path; bkt `--text`), FR-195 (Bitbucket remotes restored; Status Built (1.12.0) for the GitHub flow), FR-086 (11 scripts and 16 commands after the ask hook; the 15-command scenario marked as holding until FR-206 is built), FR-091 and FR-118 (a guard includes the ask hook; a false ask counts as a false deny), NFR-014, new NFR-025 (ask hook latency), sections 1, 6, 7, 8, and 9; URD UR-054 to UR-057 and UC-003; BRD scope. Documents stay DRAFT until the user signs off. Fix pass 2 (same version): planning-gate findings 1 to 11 applied (FR-203 Cloud base-URL host and both-flow link check, FR-207 Error exception, hook-rejection outcomes per `DECISIONS.md:233-236`, FR-195 pin and setup-step wording, FR-143 Built tags, FR-203 scp-like Data Center form). Fix pass 1 (same version): planning-gate findings 1 to 32 applied (FR-207 plan-file rule, FR-206 self-test and latency, matrix rows, `DECISIONS.md:223-226` citations, FR-203 context rule, FR-208 file names, FR-209 order, open points 5 to 10) |
| 1.4 | 2026-10-22 | Toni-Jan Keith Monserrat | Status after the follow-up build (`DECISIONS.md:243-271`), no new elicitation: PLANNED (follow-up to 1.12.0) set to Built (1.13.0) for FR-086 (11 scripts and 16 commands replace the 10 and 15 counts), FR-091 and FR-118 (ask-hook clauses), FR-139, FR-142 to FR-144, FR-195, FR-202 to FR-210, NFR-014, NFR-025, and the section 8 Status cells; nothing was found unbuilt. FR-206: the unrecognized-`bkt api`-option ask rule and the either-word-list rule, the best-effort stance, the 11-item known-gap list from the hook header comment, the three unverified items, and the closed forms (substitution spans, nested depth, run-time expansion, redirection words). FR-209 and FR-139: rule R8, the `test -d` check without `--`, an empty or `.` stripped absolute value as no `--path`, and the eight stop messages. FR-202 and FR-203: the step 1 results (`bkt api` methods and body, `--method`/`-X`, no repository flags on `bkt api`, version pattern, JSON-quoted `--jq` strings), the array-form filters, and `/do` counting contexts that meet the Match rule. NFR-008 and NFR-025: timing method confirmed, medians from the qa run (57.6, 67.2, 56.1, and 54.4 ms). Section 9: points settled by the build closed or narrowed. Fix pass 1 (same version, `DECISIONS.md:263-271`): FR-208 removes the five PR files by exact name with `rm -f --` after the symlink guard in one command that exits 3 on a symlink (no glob); FR-144 adds the run-folder removal bound to the `mktemp` prefix; FR-143 and FR-195 add the separate body-hash check before `bkt pr approve`; FR-202 clause (f) says "exactly one" for the context lookup means one element that meets the Match rule; FR-206 and the gap list live in five places with a pointer in `CLAUDE.md`, `Claude.md`, and `ARCHITECTURE.md`; stale line citations corrected; section 9 points 6, 11, and 12 closed. Documents stay DRAFT until the user signs off |

