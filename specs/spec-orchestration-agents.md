# spec-orchestration-agents

## Metadata

| Field | Value |
|---|---|
| **Feature** | Agent catalog: the 16 agent files, their models and tools, and per-agent behavior under `/do` |
| **Parent feature** | spec-orchestration.md |
| **Sub-features** | None |
| **Requirement refs** | BR-002, BR-003, BR-005, BR-006, BR-010, BR-012, BR-013, BR-016, UR-001, UR-002, UR-004, UR-007, UR-011, UR-012, UR-013, UR-014, UR-019, UR-021, UR-035, UR-036, UR-037, UR-038, UR-042, UR-049, FR-065, FR-066, FR-067, FR-071, FR-072, FR-073, FR-074, FR-075, FR-076, FR-077, FR-078, FR-079, FR-080, FR-081, FR-082, FR-083, FR-084, FR-085, FR-189, NFR-003, NFR-014, NFR-015, NFR-020 |
| **Feature type** | Configuration |
| **Status** | Draft |

Status values: Draft, Review, Approved, Implemented.

Baseline: assist-plugin 1.11.0 at commit 4803a0d; every behavior here is Built unless marked PLANNED, as `docs/requirements/FR-NFR-assist-plugin.md` marks it. Paths are relative to `plugins/assist-plugin/`. Hooks that enforce agent write paths (FR-092, FR-093, FR-108 to FR-114) and skills the agents preload (FR-130 onward) belong to Areas B and C and are cited by ID only.

## Description

The plugin ships 16 agent files that `/do` dispatches as `assist-plugin:<name>`. Each file declares its model, effort, and tools in frontmatter, so an agent's authority is fixed before any prompt reaches it (UR-019, BR-006). The reviewers and search agents cannot write or run commands; the chain agents and task-planner read documents as untrusted data; developer and developer-tester split code from tests (UR-049). This spec fixes the catalog and the observable behavior of each agent that `/do` relies on. The terminal block and the six `## States` tables are in spec-orchestration-terminal-block.md.

## Triggered by

| Trigger type | Source | Condition |
|---|---|---|
| Configuration change | An agent file is added, removed, or edited | The catalog, the registry, and the count documents must agree |
| User action | `/do` dispatches a step to an agent | The agent's frontmatter and file govern the run |

## Required data

| Data | Source | Type | Notes |
|---|---|---|---|
| Agent frontmatter | `agents/*.md` | YAML: `name`, `description`, `type`, `model`, `effort`, `tools`, `skills` | `skills` lists preloaded skills |
| Agent registry | `skills/do/references/agent-registry.md:5-24` | Table | Routing source of truth |
| Count documents | The 8 files listed in `CLAUDE.md`, Keeping counts in sync | Text | Must say 16 agents |

## Behavior

### Requirement: Ship 16 agent files with model, effort, and tools

The plugin SHALL ship 16 agent files (ask, code-reviewer, developer, developer-tester, devops, explore, general-purpose, intake-reviewer, planner, qa, requirements-gatherer, researcher, reviewer, solutions-architect, task-planner, worker) that each declare name, model, effort, and tools in frontmatter. (FR-065; `agents/*.md` lines 1 to 10)

Frontmatter as read at the baseline:

| Agent | `model` | `effort` | `tools` | `skills` |
|---|---|---|---|---|
| ask | sonnet | medium | Read, Grep, Glob, WebSearch, WebFetch | none |
| code-reviewer | opus | xhigh | Read, Grep, Glob, LSP | none |
| developer | sonnet | high | Read, Write, Edit, Grep, Glob, Bash, PowerShell, LSP | code |
| developer-tester | sonnet | high | Read, Write, Grep, Glob | create-test |
| devops | sonnet | high | Read, Write, Edit, Grep, Glob, Bash, PowerShell | none |
| explore | haiku | low | Read, Grep, Glob | none |
| general-purpose | sonnet | medium | Read, Write, Edit, Grep, Glob, Bash, PowerShell | none |
| intake-reviewer | sonnet | medium | Read, Grep, Glob | gather-requirements |
| planner | sonnet | xhigh | Read, Write, Edit, Grep, Glob | none |
| qa | sonnet | high | Read, Write, Edit, Grep, Glob, Bash, PowerShell, LSP | pentest, integrated-test, run-test |
| requirements-gatherer | sonnet | medium | Read, Write, Edit, Grep, Glob | gather-requirements |
| researcher | opus | xhigh | Read, Write, Edit, Grep, Glob, Bash, PowerShell, WebSearch, WebFetch | none |
| reviewer | opus | xhigh | Read, Grep, Glob, LSP | none |
| solutions-architect | opus | xhigh | Read, Write, Edit, Grep, Glob, Bash | spec-from-requirements |
| task-planner | sonnet | high | Read, Write, Grep, Glob | task-plan |
| worker | sonnet | high | Read, Write, Edit, Grep, Glob, Bash, PowerShell | none |

Source difference, recorded and not settled here: the `general-purpose` frontmatter `description` says the agent is not a fallback, but its body at `agents/general-purpose.md:15`, `:27`, and `:38` describes it as the agent for work no other agent matches, which disagrees with FR-007. This spec follows FR-007 (spec-orchestration-planning.md, Requirement 9). Whether the body is corrected is pending the user (OPEN-5 in spec-orchestration.md).

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

### Requirement: Declare the default models

The agent files SHALL declare the default model `haiku` for `explore`, `opus` for `reviewer`, `code-reviewer`, `solutions-architect`, and `researcher`, and `sonnet` for the other eleven agents. (FR-066; `skills/do/references/model-routing.md:7-25`)

#### Scenario: Opus agents

- **GIVEN** the four Opus agent files
- **WHEN** a test reads their `model`
- **THEN** each SHALL read `opus`

#### Scenario: Sonnet agents

- **GIVEN** the twelve non-Opus agent files
- **WHEN** a test reads their `model`
- **THEN** `explore` SHALL read `haiku` and the other eleven SHALL read `sonnet`

#### Scenario: Model changed in a file

- **GIVEN** an edit that sets `model: sonnet` in `agents/reviewer.md`
- **WHEN** a test reads the `model` values
- **THEN** the test SHALL name `agents/reviewer.md` and fail

### Requirement: Keep reviewers and search agents read-only

The `reviewer`, `code-reviewer`, `intake-reviewer`, `explore`, and `ask` agents SHALL declare no Write, Edit, Bash, or PowerShell tool. (FR-067)

#### Scenario: Tool lists

- **GIVEN** the five agent files
- **WHEN** a test reads `tools`
- **THEN** none of the lists SHALL contain Write, Edit, Bash, or PowerShell

#### Scenario: Review authority

- **GIVEN** `reviewer` finds an issue in an artifact
- **WHEN** it reports
- **THEN** it SHALL report findings and SHALL NOT modify the artifact

#### Scenario: Write tool added to a read-only agent

- **GIVEN** an edit that adds `Edit` to the `tools` list in `agents/explore.md`
- **WHEN** a test reads the five `tools` lists
- **THEN** the test SHALL name `agents/explore.md` and fail

### Requirement: Keep agent descriptions short

Each agent `description` in frontmatter SHALL NOT exceed 400 characters. (NFR-003; `docs/TOKEN_OPTIMIZATION.md`)

`docs/requirements/FR-NFR-assist-plugin.md:3529` (NFR-003 row) records that the 16 descriptions were read on 2026-10-14 with the longest about 255 characters; that figure is an estimate and was not measured for this spec.

#### Scenario: Within the limit

- **GIVEN** the 16 agent files
- **WHEN** a test measures each `description` value
- **THEN** every value SHALL be 400 characters or fewer

#### Scenario: Over the limit

- **GIVEN** an edit that makes a description 420 characters long
- **WHEN** the test runs
- **THEN** the test SHALL name the agent file and fail

### Requirement: Keep secrets and internal hosts out of agent files

No agent file SHALL contain a hardcoded token, API key, or internal hostname. (NFR-015; `rules/llm-security-checklist.md`)

#### Scenario: Clean files

- **GIVEN** the 16 agent files
- **WHEN** a secret scan runs over `agents/`
- **THEN** it SHALL report 0 findings

#### Scenario: Key added

- **GIVEN** an edit that pastes an API key into `agents/researcher.md`
- **WHEN** a secret scan runs over `agents/`
- **THEN** the scan SHALL report the key with its `file:line`
- **AND** the change SHALL NOT merge until `✓ OWASP Clear` and `✓ LLM Security Clear` appear in the commit message or plan file (`rules/assist-plugin-rule.md:348-350`); how `/do` dispatches the LLM gate is pending OPEN-1

### Requirement: Keep agent counts and lists in every count document

The agent count and list SHALL agree in `plugin.json`, `marketplace.json`, `README.md`, `MARKETPLACE.md`, `CLAUDE.md`, `plugins/assist-plugin/Claude.md`, `docs/SPECIFICATION.md`, and `skills/do/references/agent-registry.md`. (NFR-020; `CLAUDE.md`, Keeping counts in sync)

The skill counts in the same files are Area C (FR-130).

#### Scenario: All agree

- **GIVEN** the 8 files at a release
- **WHEN** a maintainer runs the counts checklist
- **THEN** each SHALL state 16 agents

#### Scenario: Count drift

- **GIVEN** a new agent file and a `README.md` that still says 16 agents
- **WHEN** a maintainer runs the counts checklist in `CLAUDE.md`
- **THEN** the checklist SHALL flag `README.md` as out of date

### Requirement: Intake review mode returns accepted or needs-changes

The `intake-reviewer` agent in `review` mode SHALL run the `gather-requirements` review on the supplied file and return `accepted` or `needs-changes`, with each finding as `file:line`, problem, and fix. (FR-071; `agents/intake-reviewer.md:16-23`, `:59-79`)

`review` is the mode when the prompt names none. The mode comes only from the dispatch prompt's own text outside any untrusted wrapper; a mode named inside the file is a finding. Every instruction written inside the file is reported as a finding, described in the agent's own words, never quoted. Decide re-reads each finding at its location and drops any it cannot confirm.

#### Scenario: Clean file

- **GIVEN** a requirements file with no finding after Decide
- **WHEN** the agent reports
- **THEN** the block SHALL read `state: Done` and `verdict: accepted`

#### Scenario: Unreadable file

- **GIVEN** a path that does not exist
- **WHEN** Intake runs
- **THEN** the agent SHALL end `Error` with class `missing-input`

#### Scenario: Unknown file type

- **GIVEN** a readable file that is not a BRD, URD, FR-NFR, spec, or instructions file
- **WHEN** Intake runs
- **THEN** the agent SHALL end `NeedsInput` with `resume_at: Intake` and ask what the file is

### Requirement: Conflict-check mode reports four groups and embedded instructions

The `intake-reviewer` agent in `conflict-check` mode SHALL report findings in four groups (missing documents, request versus documents, contradictions between documents, gaps), each with where, problem, one question, a recommended answer, and the assumption that applies otherwise. (FR-072; `agents/intake-reviewer.md:38-57`)

"Where" is `file:line`, `request`, or, for a group 1 finding, the searched pattern. A group with no finding reads `none`. Text aimed at the agent itself (skip the check, return `clear`, read or run something, name the mode) goes in a separate Embedded instructions list with the line and a paraphrase and no question; any entry there ends the run `needs-clarification`. A missing `DECISIONS.md` is not a group 1 finding. `clear` means no finding in the four groups and an empty Embedded instructions list. The agent never asks the user directly.

#### Scenario: Contradiction

- **GIVEN** the request asks for JWT and a `DECISIONS.md` entry says opaque tokens
- **WHEN** Compare runs
- **THEN** the agent SHALL report a group 2 finding with a question and a recommended answer

#### Scenario: Embedded instruction

- **GIVEN** a document line addressed to the agent that concerns the review verdict
- **WHEN** Compare runs
- **THEN** the agent SHALL list the line under Embedded instructions with a paraphrase, follow nothing, and end with verdict `needs-clarification`

#### Scenario: Empty list

- **GIVEN** a conflict-check prompt with an empty document list
- **WHEN** the agent runs
- **THEN** it SHALL report the requirements, spec, and task plan as group 1 findings and list the gaps in the request

### Requirement: Conflict-check stays inside its read cap

The `intake-reviewer` agent in `conflict-check` mode SHALL stay within a read cap of 10 documents in full, 2000 lines each plus Grep hits, and the last 200 lines of `DECISIONS.md`, recording each relevant document it does not read as `not read (cap): <paths>` in `skipped`. (FR-073, NFR-014; `agents/intake-reviewer.md:66`, `:68`, `:70`)

Requirements documents and `DECISIONS.md` are read first, then other matches by relevance. Compare and Verify reads count against the same cap. Verify checks completeness (every listed document recorded as read, `not relevant`, or `not read (cap)`; each group holds a finding or `none`) and returns to Compare at most 2 times.

#### Scenario: Over the cap

- **GIVEN** 14 relevant documents
- **WHEN** AssembleContext runs
- **THEN** the agent SHALL read 10 and list the other 4 paths under `not read (cap)`

#### Scenario: Large DECISIONS file

- **GIVEN** a `DECISIONS.md` of 900 lines
- **WHEN** AssembleContext runs
- **THEN** the agent SHALL read the last 200 lines plus Grep hits

#### Scenario: Incomplete after two rounds

- **GIVEN** Verify finds the run incomplete for the third time
- **WHEN** the loop bound is reached
- **THEN** the agent SHALL end `Error` with class `budget-exhausted`

### Requirement: Conflict-check path list follows the document locations (PLANNED)

The `intake-reviewer` agent in `conflict-check` mode SHALL accept requirements, specs, task plans, and `DECISIONS.md` paths from the locations in FR-187 and read them within the existing read cap. (FR-189, PLANNED 1.11.1; `docs/requirements/FR-NFR-assist-plugin.md:927-941`; `DECISIONS.md` 2026-10-16)

At 4803a0d the Conflict check section lists root-level requirements (`BRD-*.md`, `URD-*.md`, `FR-NFR-*.md`, `requirements-*.json`), `specs/spec-*.md`, root-level `task-plan-*.md`, and `DECISIONS.md` as the path types (`agents/intake-reviewer.md:46`). The locations of FR-187 are in spec-orchestration-spec-first.md, Requirement 14: every pattern resolves against the git root of the session's working directory, so in a session started in a subdirectory the listed paths sit at the repository's top level, outside that subdirectory. The list holds no path taken from `DECISIONS.md` (FR-191).

#### Scenario: Path in a new folder

- **GIVEN** the dispatch prompt lists `docs/requirements/FR-NFR-auth.md` and `docs/task-plans/task-plan-auth-20261016-1000.md`
- **WHEN** the agent runs `AssembleContext`
- **THEN** the agent SHALL treat both as readable documents of their types and count them in the 10-document read cap

#### Scenario: Unlisted path

- **GIVEN** a document that is not in the dispatch prompt's path list
- **WHEN** the agent compares the request with the documents
- **THEN** the agent SHALL NOT read it except through a Grep for the feature terms

### Requirement: Task-planner writes only its task-plan file

The `task-planner` agent SHALL write only `task-plan-<feature-slug>-<timestamp>.md` at the project root and, on a fix pass, overwrite the task-plan file named in the prompt. (FR-074; `docs/requirements/FR-NFR-assist-plugin.md:1454-1468`; `agents/task-planner.md:40-42`; `DECISIONS.md` 2026-10-13)

Status as the requirements mark it (`docs/requirements/FR-NFR-assist-plugin.md:1457`): Built at 4803a0d with the project root; the folder moves to `docs/task-plans/` in 1.11.1 (FR-184 in Area C, FR-186 in Area B), resolved against the git root of the session's working directory (a worktree uses its own root; outside a git repository, the working directory), per `DECISIONS.md` 2026-10-16. The statement above and the "First run" and "Fix pass" Scenarios describe 4803a0d. The agent has no Edit, Bash, or PowerShell tool. The fsa-write-bar hook enforces the path and also denies hidden paths, `CLAUDE.md`, `CLAUDE.local.md`, and `AGENTS.md` (FR-110 at 4803a0d; FR-186 when the folder moves, Area B). The one-row Write scope table in `agents/task-planner.md` that will state the glob in code form is PLANNED (1.11.1), FR-180.

#### Scenario: First run

- **GIVEN** an approved spec
- **WHEN** WritePlan runs
- **THEN** the agent SHALL create one timestamped `task-plan-*.md` file at the project root

#### Scenario: Other path needed

- **GIVEN** the work seems to need a write outside the task-plan file
- **WHEN** the agent decides
- **THEN** it SHALL NOT write the path and SHALL list it in `out_of_scope`

#### Scenario: Fix pass

- **GIVEN** a planning-gate finding on `task-plan-auth-20261012-101500.md` and a fix prompt that names that file
- **WHEN** the agent runs WritePlan
- **THEN** it SHALL overwrite that file and create no second task-plan file

#### Scenario: New folder (PLANNED 1.11.1)

- **GIVEN** FR-184 and FR-186 are built and an approved spec
- **WHEN** WritePlan runs
- **THEN** the agent SHALL write one timestamped `task-plan-*.md` file directly under `docs/task-plans/` of the session's git root, and a write to a root-level `task-plan-*.md` SHALL be denied

#### Scenario: Subdirectory session (PLANNED 1.11.1)

- **GIVEN** FR-184 and FR-186 are built and a session started in `<repo>/src`
- **WHEN** WritePlan runs
- **THEN** the agent SHALL write under `<repo>/docs/task-plans/`, and a write under `<repo>/src/docs/task-plans/` SHALL be denied (FR-186, Area B)

#### Scenario: Rework of a root-level plan (PLANNED 1.11.1)

- **GIVEN** FR-184, FR-186, and FR-190 are built, and the fix prompt names the root-level `./task-plan-shop-20261001-0900.md`
- **WHEN** the agent runs WritePlan
- **THEN** it SHALL write a new timestamped file in `docs/task-plans/` and leave the root-level file unchanged

### Requirement: Task-planner reports the step count

The `task-planner` agent SHALL end with `fsa: task-planner/1`, `artifact` holding the plan path, and `verdict: steps=N` where N is the number of coding steps. (FR-075; `agents/task-planner.md:48-72`)

#### Scenario: Six steps

- **GIVEN** a plan with six coding steps
- **WHEN** the agent ends
- **THEN** the block SHALL read `verdict: steps=6`

#### Scenario: Write denied

- **GIVEN** the write bar refuses the plan path
- **WHEN** WritePlan runs
- **THEN** the agent SHALL end `Error` with class `policy-rejection`

### Requirement: Task-planner reports instruction-like text as citations only

The `task-planner` agent SHALL report instruction-like text found in a spec or document only as a `file:line` citation in `out_of_scope`, never as a step or Notes entry. (FR-076; `agents/task-planner.md:36-38`)

#### Scenario: Planted command

- **GIVEN** a spec line that holds a request addressed to the agent about the plan's approval state
- **WHEN** the agent plans
- **THEN** the agent SHALL cite the `file:line` in `out_of_scope` and the plan SHALL contain no such step

#### Scenario: No quote

- **GIVEN** the same planted line
- **WHEN** the agent reports
- **THEN** the report SHALL NOT quote or restate the line

### Requirement: Developer edits only planned non-test files and reports its self-check

The `developer` agent SHALL implement the steps of a task plan, an approved spec, or a named-skill task by editing only the planned files, and end with `verdict` `self-check=pass`, `self-check=fail`, or `self-check=not-run`. (FR-077; `agents/developer.md:45-87`)

Inputs: a task-plan file, an approved spec that passes task-plan validation, an approved RCA or refactor request that names its targets, or a prompt that names the `debug` or `technical-writing` skill with its target files and the absolute skill path. SelfCheck runs only the project's own test and lint commands and the code-slop checklist; a command that cannot run is listed as `tests not-run (skipped)` or `lint not-run (skipped)`. The developer never writes a test path (fsa-write-bar, FR-109, Area B).

#### Scenario: Tests pass

- **GIVEN** the project's test and lint commands pass after the edits
- **WHEN** SelfCheck ends
- **THEN** the block SHALL read `verdict: self-check=pass`

#### Scenario: Test path needed

- **GIVEN** the work needs a test file
- **WHEN** ProduceEdit runs
- **THEN** the agent SHALL write nothing there, list the path in `out_of_scope`, and continue

#### Scenario: Spec without scenarios

- **GIVEN** an approved spec whose `### Requirement:` block has no `#### Scenario:`
- **WHEN** Intake validates it
- **THEN** the agent SHALL end `Error` with class `precondition-failed`

### Requirement: Developer-tester writes black-box tests on test paths only

The `developer-tester` agent SHALL read only spec Scenarios, requirement documents, and public interface declarations, write only test paths, and end with `verdict` `covered=N uncovered=M`. (FR-078; `agents/developer-tester.md:38-156`; `skills/create-test/SKILL.md`)

Test paths are the globs `**/test/**`, `**/tests/**`, `**/__tests__/**`, `**/*.test.*`, `**/*_test.*`, `**/*.spec.*`, `**/test_*.py`, `**/*Test.kt`, `**/*_test.go`. Even on a glob match, a path is denied when a segment starts with `.`, the file is `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, or `DECISIONS.md`, the path is longer than 4096 characters, or it holds a NUL (fsa-write-bar, Area B: FR-108 for the test globs, dot segments, and auto-loaded names; FR-112 for `DECISIONS.md`; FR-113 for the length and NUL limits). Every run lists `compile not-run (skipped)`.

#### Scenario: Black-box tests

- **GIVEN** a spec with three Scenarios
- **WHEN** the agent writes tests
- **THEN** it SHALL read no implementation body and write tests under test paths

#### Scenario: Undocumented interface

- **GIVEN** a function with no signature, docstring, or spec
- **WHEN** AssembleContext runs
- **THEN** the agent SHALL end `NeedsInput` and name the interface

#### Scenario: Non-test path

- **GIVEN** the work seems to need `src/fixtures.ts`, outside every test glob
- **WHEN** WriteTests runs
- **THEN** the agent SHALL write nothing there and end `Error` with class `policy-rejection`

### Requirement: Reviewers confirm each finding before reporting it

The `reviewer` and `code-reviewer` agents SHALL return `approved` or `returned` and write each finding as `file:line`, problem, and fix after re-reading the finding at its location. (FR-079; `agents/reviewer.md:38-59`; `skills/do/references/review-protocol.md:99-107`)

Each starts with the verdict or the first finding, lets the findings set the length, lists only new or still-open findings on a re-review with resolved ones in one line, and adds no praise or generic advice. A markdown-report artifact ends `Error(out-of-scope)` and names the Report Quality Gate.

#### Scenario: No findings

- **GIVEN** a reviewer finds nothing it can confirm
- **WHEN** Decide runs
- **THEN** the block SHALL read `verdict: approved`

#### Scenario: Unconfirmed finding

- **GIVEN** a candidate finding that a re-read does not confirm
- **WHEN** Decide runs
- **THEN** the reviewer SHALL drop it from the report

#### Scenario: Report artifact

- **GIVEN** a gate prompt whose artifact is a markdown report
- **WHEN** Intake runs
- **THEN** the reviewer SHALL end `Error` with class `out-of-scope`

### Requirement: Reviewers mark the static scan as skipped

The `reviewer` agent SHALL list `static-scan not-run (skipped)` in `skipped` for every review of code, config, or a pipeline. (FR-080; `agents/reviewer.md:63`; `agents/code-reviewer.md:64` states the same rule)

#### Scenario: Code review

- **GIVEN** a Pre-Test review of source files
- **WHEN** the reviewer ends
- **THEN** `skipped` SHALL contain `static-scan not-run (skipped)`

#### Scenario: Planning document

- **GIVEN** a planning document review
- **WHEN** the reviewer ends
- **THEN** `skipped` SHALL read `none`

### Requirement: QA runs its preloaded skills and lists every unrun check

The `qa` agent SHALL run the preloaded `pentest`, `integrated-test`, and `run-test` skills for security, integration, and suite runs and report a consolidated test report with every unrun check listed in `skipped`. (FR-081; `agents/qa.md:14-70`)

`artifact` is the test report path or `inline`. Under `/do`, an active pentest command or target the approved step does not list goes in `out_of_scope` and `skipped` (for example `<command> not-run (skipped: not in approved plan)`); qa ends `Done`, or `Error` when nothing approved could run, and never `NeedsInput` for this.

#### Scenario: Suite run

- **GIVEN** a Node project with a test script
- **WHEN** qa runs the suite
- **THEN** it SHALL report results and coverage and list `e2e not-run (skipped)` when E2E did not run

#### Scenario: Plan lists a command

- **GIVEN** an active test command that the approved plan does not list
- **WHEN** qa considers it
- **THEN** qa SHALL skip it, list it in `out_of_scope`, and end `Done` or `Error`, never `NeedsInput`

### Requirement: QA checks for Playwright before frontend testing

The `qa` agent SHALL check Playwright availability before a frontend testing task and end `Error` with class `tool-missing` when neither the MCP nor the CLI is found. (FR-082; `agents/qa.md:28-29`, `:57`)

The check uses ToolSearch for a Playwright MCP, then the CLI (`npx --no playwright --version` or `which playwright`). qa never installs Playwright.

#### Scenario: Playwright present

- **GIVEN** Playwright is available
- **WHEN** qa starts a frontend task
- **THEN** qa SHALL continue with E2E tests

#### Scenario: Playwright absent

- **GIVEN** neither the Playwright MCP nor the CLI is found
- **WHEN** qa starts a frontend task
- **THEN** qa SHALL end `Error` with class `tool-missing` and say E2E needs Playwright installed

### Requirement: Requirements-gatherer ends each round in NeedsInput

The `requirements-gatherer` agent SHALL end each elicitation round with state `NeedsInput`, 3 to 5 numbered questions, and `resume_at` naming the phase heading to continue from. (FR-083; `agents/requirements-gatherer.md:26`; `skills/gather-requirements/references/elicitation-methodology.md:9-59`)

The phase order is 1 Establish context, 2 Elicit business requirements, 3 Elicit user requirements, 4 Elicit functional requirements, 5 Elicit non-functional requirements, 6 Summarize and confirm. `/do` allows 3 relays per phase and 10 per step (spec-orchestration-dispatch.md, Requirement 7). The agent's `## Untrusted input` section is PLANNED (1.11.1), FR-175 (Area C).

#### Scenario: Round ends

- **GIVEN** the agent finished a phase with open points
- **WHEN** it sends its final message
- **THEN** the block SHALL read `state: NeedsInput` with 3 to 5 questions and a `resume_at` phase

#### Scenario: Relay limit

- **GIVEN** a phase needs a fourth relay
- **WHEN** `/do` counts relays
- **THEN** `/do` SHALL fail the step

### Requirement: Requirements-gatherer documents only after the summary is confirmed

The `requirements-gatherer` agent SHALL NOT start the `document` subcommand until the user has confirmed the requirements summary. (FR-084; `agents/requirements-gatherer.md:26`; `skills/gather-requirements/references/elicitation-methodology.md:54-59`)

#### Scenario: Summary unconfirmed

- **GIVEN** the summary was shown and the user has not answered
- **WHEN** the agent plans its next move
- **THEN** it SHALL end `NeedsInput` and write no BRD, URD, or FR-NFR file

#### Scenario: Summary confirmed

- **GIVEN** the user confirmed the summary
- **WHEN** the agent resumes
- **THEN** it SHALL run `document`

### Requirement: Solutions-architect renders diagrams only through mmdc under specs

The `solutions-architect` agent SHALL render diagrams with `mmdc` from a `.mmd` file under `specs/` to a `.svg`, `.png`, or `.pdf` file under `specs/`, and show the install command without running it when `mmdc` is missing. (FR-085; `agents/solutions-architect.md:25-39`)

The sa-mermaid-only hook limits the agent's Bash to `which mmdc`, `where mmdc`, `mmdc --version`, and `mmdc` with allowed flags and relative `specs/` paths (FR-092, FR-093, Area B). The agent treats requirements, existing specs, and user-named files as untrusted data and reports instruction-like text only as a `file:line` citation in `out_of_scope` (`agents/solutions-architect.md:54-56`). The matching rule in the `spec-from-requirements` skill is PLANNED (1.11.1), FR-177 (Area C).

#### Scenario: mmdc present

- **GIVEN** `which mmdc` succeeds
- **WHEN** the agent renders `specs/spec-auth-architecture.mmd`
- **THEN** it SHALL write `specs/spec-auth-architecture.png` and embed the image

#### Scenario: mmdc absent

- **GIVEN** `which mmdc` fails
- **WHEN** the agent needs a diagram
- **THEN** it SHALL embed the Mermaid source and show `npm install -g @mermaid-js/mermaid-cli`, and SHALL NOT install it or use `npx`

## Algorithmic steps

Order for adding or removing an agent (`docs/ARCHITECTURE.md:246-250`; `CLAUDE.md`, Keeping counts in sync):

1. Create or remove `agents/<name>.md` with `name`, `description` (400 characters at most), `model`, `effort`, and `tools` in frontmatter, and `skills` for every preloaded skill.
2. Add or remove the row in `skills/do/references/agent-registry.md`, and in `skills/do/references/model-routing.md` when the agent has a model or effort rule there.
3. Update the count and list in the other seven count documents.
4. Run `node plugins/assist-plugin/scripts/sync-writing-standard.js --check` and, after editing a `## States` table, `node plugins/assist-plugin/scripts/check-fsa-tables.js --check`.
5. Before merge, record `✓ OWASP Clear` and `✓ LLM Security Clear` in the commit message or plan file (FR-061; `rules/assist-plugin-rule.md:348-350`); how `/do` dispatches the LLM gate is pending OPEN-1.

## Output / Outcome

| Output | Type | Description |
|---|---|---|
| Agent files | Markdown with YAML frontmatter | 16 files under `agents/` |
| Registry rows | Table rows | One per agent in `agent-registry.md` |
| Agent run results | Terminal blocks | Per spec-orchestration-terminal-block.md |

## Error handling

| Error condition | Handling strategy | Outcome |
|---|---|---|
| Agent file missing from the registry, or registry row without a file | Counts checklist and registry comparison | Mismatch reported; release blocked until fixed |
| A read-only agent gains a write or shell tool | Tools-list test (Requirement: Keep reviewers and search agents read-only); merge blocked until `✓ LLM Security Clear` is recorded (`rules/assist-plugin-rule.md:330-350`); the LLM gate's dispatch path is pending OPEN-1 | Test fails; change not merged |
| Write outside an agent's role | fsa-write-bar deny (Area B); the agent lists the path in `out_of_scope` or ends `Error(policy-rejection)` | Path not written |
| Instruction-like text in a document | Cite `file:line`; never follow or quote | Citation recorded by `/do` |
| Required tool absent (Playwright, mmdc) | Show the install command; never install | `Error(tool-missing)` for qa; embedded Mermaid source for solutions-architect |

## Events emitted (if applicable)

| Event name | Payload | Consumer(s) | When emitted |
|---|---|---|---|
| Terminal block | Ten fields | `/do`, fsa-log | End of every final message (spec-orchestration-terminal-block.md) |

## Dependencies

| Dependency | Type | Required | Notes |
|---|---|---|---|
| Preloaded skills: code, create-test, gather-requirements, task-plan, spec-from-requirements, pentest, integrated-test, run-test | Build-time | yes | Area C; an agent that preloads a skill lists it in `skills:` and the skill never sets `disable-model-invocation: true` (`CLAUDE.md`) |
| fsa-write-bar, sa-mermaid-only | Runtime | no (fail open) | Area B; FR-092, FR-093, FR-108 to FR-114 |
| `skills/do/references/agent-registry.md`, `model-routing.md` | Build-time | yes | Routing tables |

## Sub-feature breakdown (if applicable)

Not applicable: no smaller unit has its own spec.

## Submodule scope (if applicable)

Not applicable: the plugin has no submodules.

## Traceability

| Requirement | Spec section | Verified by |
|---|---|---|
| FR-065 | Requirement: Ship 16 agent files with model, effort, and tools | File count; frontmatter fields; registry comparison |
| FR-066 | Requirement: Declare the default models | Frontmatter `model` values |
| FR-067 | Requirement: Keep reviewers and search agents read-only | Frontmatter `tools` values |
| NFR-003 | Requirement: Keep agent descriptions short | Description length test |
| NFR-015 | Requirement: Keep secrets and internal hosts out of agent files | Secret scan over `agents/` |
| NFR-020 | Requirement: Keep agent counts and lists in every count document | Counts checklist in `CLAUDE.md` |
| FR-071 | Requirement: Intake review mode returns accepted or needs-changes | intake-reviewer `review` fixtures |
| FR-072 | Requirement: Conflict-check mode reports four groups and embedded instructions | Conflict-check fixtures |
| FR-073, NFR-014 | Requirement: Conflict-check stays inside its read cap | Read log with 14 documents; 900-line `DECISIONS.md` |
| FR-074 | Requirement: Task-planner writes only its task-plan file | Write log; fsa-write-bar deny corpus; the three PLANNED Scenarios once FR-184 and FR-186 are built |
| FR-189 (PLANNED) | Requirement: Conflict-check path list follows the document locations | Conflict-check fixture with `docs/requirements/` and `docs/task-plans/` paths; Read log |
| FR-075 | Requirement: Task-planner reports the step count | Terminal block |
| FR-076 | Requirement: Task-planner reports instruction-like text as citations only | Planted-line fixture |
| FR-077 | Requirement: Developer edits only planned non-test files and reports its self-check | Developer fixtures |
| FR-078 | Requirement: Developer-tester writes black-box tests on test paths only | Read log shows no implementation body; write paths |
| FR-079 | Requirement: Reviewers confirm each finding before reporting it | Reviewer fixtures |
| FR-080 | Requirement: Reviewers mark the static scan as skipped | `skipped` field on code and planning reviews |
| FR-081 | Requirement: QA runs its preloaded skills and lists every unrun check | qa report and block |
| FR-082 | Requirement: QA checks for Playwright before frontend testing | Fixtures with and without Playwright |
| FR-083 | Requirement: Requirements-gatherer ends each round in NeedsInput | Block per round; relay count |
| FR-084 | Requirement: Requirements-gatherer documents only after the summary is confirmed | No document file before confirmation |
| FR-085 | Requirement: Solutions-architect renders diagrams only through mmdc under specs | Bash log; `specs/` outputs |
| UR-001, UR-002, UR-004, UR-007, UR-011, UR-012, UR-013, UR-014, UR-019, UR-021, UR-035, UR-036, UR-037, UR-038, UR-042, UR-049 | Description and Behavior | Parent traceability (spec-orchestration.md) |
| BR-002, BR-003, BR-005, BR-006, BR-010, BR-012, BR-013, BR-016 | Description | Design review |
