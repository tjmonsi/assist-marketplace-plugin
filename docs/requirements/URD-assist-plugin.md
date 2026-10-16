# assist-plugin: User Requirements Document

**Version:** 1.0
**Date:** 2026-10-14
**Author:** Toni-Jan Keith Monserrat
**Status:** DRAFT

Baseline: assist-plugin 1.11.0 (commit 4803a0d). Every requirement is **Built** unless marked **PLANNED** (the three 1.11.1 changes, the write guard lists they read, the `docs/tts/` exemption fix, the move of requirements and task plans to `docs/requirements/` and `docs/task-plans/`, and UR-048, which waits for the specs and the task plan).

---

## 1. Introduction

**Purpose:** This document captures what the people who use and maintain assist-plugin need to accomplish with it.

**Relationship to BRD:** This document derives from `docs/requirements/BRD-assist-plugin.md`. Every user requirement traces to at least one business requirement.

## 2. Stakeholder map

| Stakeholder | Role | Goals | Pain points | Priority |
|-------------|------|-------|-------------|----------|
| Plugin user | Developer who runs `/do` and the skills | Hand off a task and get reviewed work; keep control of writes | Agents that guess, write outside their role, or follow text planted in files | High |
| Project owner | The plugin user acting as approver | Approve plans, documents, waivers; keep decisions on record | Building on requirements nobody agreed to; lost decisions | High |
| Plugin maintainer | Owner of the repository and releases | Keep docs, tables, versions, and counts consistent; release safely | Drift between code tables and markdown; stale counts; two changelogs | High |
| PR author or reviewer | Person whose pull request `/pr-review` handles | Verdicts posted only after a human confirms | Auto-posted approvals driven by PR text | Medium |

## 3. User requirements

Each requirement uses the shall-statement form:
> The [user/role] shall be able to [accomplish goal] [qualifying condition].

Status is Built unless the row says PLANNED.

| ID | Requirement | Stakeholder | Traces to | Priority |
|----|-------------|-------------|-----------|----------|
| UR-001 | The plugin user shall be able to give `/do` one task or several and see a step table (agent, model, effort, order, build flag, files) before any step runs. | Plugin user | BR-001, BR-002 | Must |
| UR-002 | The plugin user shall be able to approve, edit steps, change models, or cancel a plan before it runs. | Plugin user | BR-001, BR-002 | Must |
| UR-003 | The plugin user shall be able to stop a running plan and resume it later, with a new approval before pending steps run. | Plugin user | BR-001 | Must |
| UR-004 | The plugin user shall be asked a question when a request is ambiguous or matches no agent, in place of `/do` guessing. | Plugin user | BR-001, BR-004 | Must |
| UR-005 | The plugin user shall be able to read after a run which steps failed, which were skipped, and which extra work agents found but did not do. | Plugin user | BR-001 | Must |
| UR-006 | The project owner shall be able to have every build request produce requirements, a spec, and a task plan that the project owner approves before any code, config, pipeline, infrastructure, or test is written. | Project owner | BR-004, BR-013 | Must |
| UR-007 | The project owner shall be able to see conflicts and gaps between a build request, existing documents, and recorded decisions before approving the plan. | Project owner | BR-004, BR-012 | Must |
| UR-008 | The project owner shall be able to waive spec-first for one plan and have the waiver recorded. | Project owner | BR-004, BR-012 | Must |
| UR-009 | The project owner shall be able to approve, edit, or reject the requirements, spec, and task plan at sign-off. | Project owner | BR-004 | Must |
| UR-010 | The project owner shall be able to have architectural decisions appended to `DECISIONS.md` after approval. | Project owner | BR-012 | Must |
| UR-011 | The plugin user shall be able to have a spec, requirements, or instructions file reviewed read-only before `/do` plans write steps. | Plugin user | BR-004, BR-006 | Should |
| UR-012 | The plugin user shall have every document path that `/do` hands to an agent wrapped as untrusted data. | Plugin user | BR-006 | Must |
| UR-013 | The project owner shall be able to have each produced artifact pass the review gate that fits its type before its step counts as complete. | Project owner | BR-005 | Must |
| UR-014 | The project owner shall be able to see that code changes passed an OWASP check and the 70% coverage bar before merge. | Project owner | BR-005 | Must |
| UR-015 | The plugin user shall have commit messages and pull request bodies free of AI attribution lines. | Plugin user | BR-009 | Must |
| UR-016 | The plugin user shall have prose that agents write checked against the writing standard. | Plugin user | BR-008 | Should |
| UR-017 | The plugin user shall see a warning, and never a blocked command, when a hook fails. | Plugin user | BR-007 | Must |
| UR-018 | The plugin user shall be able to check hook health and recent hook failures on demand. | Plugin user | BR-007 | Must |
| UR-019 | The project owner shall have each subagent's tools and write paths limited to what its role needs, with plan files and `DECISIONS.md` writable only by the orchestrator. | Project owner | BR-006, BR-012 | Must |
| UR-020 | The plugin user shall have prompt-injection phrasing in untrusted tool results and subagent prompts replaced by a visible marker. | Plugin user | BR-006 | Should |
| UR-021 | The plugin user shall have the documentation CLIs and mermaid-cli limited to safe command forms. | Plugin user | BR-006 | Should |
| UR-022 | The plugin user shall have every dispatched agent report its result in a fixed terminal block that `/do` reads. | Plugin user | BR-001, BR-007 | Must |
| UR-023 | The plugin user shall be able to see afterward which subagent reports broke their state table. | Plugin user | BR-007 | Should |
| UR-024 | The plugin user shall have the compact writing standard loaded into every session and subagent without manual action. | Plugin user | BR-008, BR-003 | Should |
| UR-025 | The plugin user shall be able to opt in to an answer-first output style. | Plugin user | BR-008 | May |
| UR-026 | The plugin user shall be able to ask a question and receive an answer with cited sources, from the repository and optionally the web. | Plugin user | BR-010 | Must |
| UR-027 | The plugin user shall be able to diagnose a bug with a root cause analysis and apply a fix only from an approved analysis. | Plugin user | BR-010 | Must |
| UR-028 | The plugin user shall be able to create conventional commits. | Plugin user | BR-010, BR-009 | Must |
| UR-029 | The plugin user shall be able to bump a semantic version and generate a changelog entry. | Plugin user | BR-010 | Should |
| UR-030 | The plugin user shall be able to create, switch, and list git branches, and clean up merged worktrees. | Plugin user | BR-010 | Should |
| UR-031 | The plugin user shall be able to review a GitHub or Bitbucket pull request and post a verdict only after confirming it. | Plugin user, PR author | BR-010, BR-006 | Must |
| UR-032 | The plugin user shall be able to map a repository's structure, stack, and dependencies. | Plugin user | BR-010 | Should |
| UR-033 | The plugin user shall be able to generate and update technical documentation. | Plugin user | BR-010 | Should |
| UR-034 | The plugin user shall be able to have a markdown report reviewed for facts, consistency, and concision. | Plugin user | BR-005, BR-008 | Should |
| UR-035 | The plugin user shall be able to elicit, document, and review requirements as BR, UR, FR, and NFR with scenarios. | Plugin user | BR-010, BR-013 | Must |
| UR-036 | The plugin user shall be able to turn requirements into feature specs and record later changes as deltas. | Plugin user | BR-010, BR-013 | Must |
| UR-037 | The plugin user shall be able to turn a spec into an ordered task plan. | Plugin user | BR-010, BR-013 | Must |
| UR-038 | The plugin user shall be able to generate black-box tests from acceptance criteria without exposing implementation. | Plugin user | BR-010, BR-013 | Must |
| UR-039 | The plugin user shall be able to remove AI writing tells from prose or list them without editing. | Plugin user | BR-008 | Should |
| UR-040 | The plugin user shall be able to get a paste-ready text-to-speech script for a chosen model. | Plugin user | BR-010 | May |
| UR-041 | The plugin user shall be able to have unclear points explained with evidence and settled with the user. | Plugin user | BR-010 | Should |
| UR-042 | The plugin user shall have the developer and qa agents apply coding standards, security testing, integration testing, and test-run procedures through internal skills without user action. | Plugin user | BR-010, BR-005 | Must |
| UR-043 | The plugin maintainer shall be able to change a writing rule in one place and sync every copy. | Plugin maintainer | BR-008 | Should |
| UR-044 | The plugin maintainer shall be able to check the hook state tables and test globs against the markdown that documents them. | Plugin maintainer | BR-015 | Must |
| UR-045 | The plugin maintainer shall be able to keep agent and skill counts and lists consistent across documents. | Plugin maintainer | BR-016 | Should |
| UR-046 | The plugin maintainer shall be able to release a version whose manifests agree and whose changes appear in the changelog. | Plugin maintainer | BR-011 | Must |
| UR-047 | The plugin user shall be able to install and enable the plugin with the documented marketplace commands. | Plugin user | BR-011 | Must |
| UR-048 | PLANNED: The plugin maintainer shall be able to find this repository's own requirements in `docs/requirements/`, task plans in `docs/task-plans/`, and specs in `specs/`, where `/do` SpecGate looks once it searches those folders. | Plugin maintainer | BR-014 | Should |
| UR-049 | The plugin user shall be able to have code written, fixed, or refactored from a plan by one agent and tested by another that never reads the implementation. | Plugin user | BR-010, BR-005 | Must |
| UR-050 | PLANNED: The plugin user shall have the requirements agent and the two document skills treat the content of requirements, specs, and user files, including text the user puts in a quote block or code fence or ties to a named file, as data, while all other text the user types stays the user's own authoritative answer. | Plugin user | BR-006 | Must |
| UR-051 | PLANNED: The plugin maintainer shall be told when the verdict, task-plan path, protected-path, or auto-loaded-file tables in code differ from the markdown that documents them. | Plugin maintainer | BR-015 | Must |
| UR-052 | PLANNED: The plugin maintainer shall be able to read the release history in one changelog. | Plugin maintainer | BR-017 | Should |

## 4. Use case summaries

#### UC-001: Run a build request through spec-first

- **Primary actor:** Project owner
- **Precondition:** The plugin is installed; the request asks for work that writes code, config, pipelines, infrastructure, or tests.
- **Success guarantee:** Requirements, a spec, and a task plan exist, the owner approved them, and build steps ran afterward.
- **Main scenario:** (1) The owner types `/do <request>`. (2) `/do` classifies it as build and checks existing documents. (3) Clarify resolves open points. (4) The owner approves the plan. (5) The document chain runs. (6) The owner approves the documents. (7) Build steps run and pass their gates.
- **Key extensions:** The owner picks "Skip spec-first" at approval (waiver recorded). The owner edits or cancels at sign-off. A point stays open after round 5 and the run ends in `Error(plan-invalid)`.

#### UC-002: Run a non-build task

- **Primary actor:** Plugin user
- **Precondition:** The request does not write code, config, pipelines, infrastructure, or tests.
- **Success guarantee:** Each step ran on its agent and the final report lists results, failures, and out-of-scope requests.
- **Main scenario:** (1) The user types `/do <task>`. (2) `/do` shows the step table. (3) The user approves. (4) Agents run in dependency order. (5) Review gates run. (6) `/do` displays the results.
- **Key extensions:** A single read-only `ask` or `explore` step skips approval. A `stop` pauses the plan. A step fails and its dependents are skipped.

#### UC-003: Review a pull request

- **Primary actor:** Plugin user
- **Precondition:** `gh` or `bkt` is installed and authenticated; a git remote exists.
- **Success guarantee:** A verdict was posted only after the user confirmed the drafted text.
- **Main scenario:** (1) The user types `/pr-review 123`. (2) The skill detects the platform and fetches the PR. (3) It drafts a verdict. (4) The user confirms. (5) The skill posts the verdict through a message file.
- **Key extensions:** The user answers no and edits the draft. The PR is the user's own and the skill returns an error.

#### UC-004: Recover from a hook failure

- **Primary actor:** Plugin user
- **Precondition:** A hook crashed or Node is older than 6.
- **Success guarantee:** The command ran, the user saw a warning, and `/health` shows the failure.
- **Main scenario:** (1) A hook fails. (2) Claude Code shows a one-line warning and the command proceeds. (3) The user runs `/assist-plugin:health`. (4) The report names the failure and the fix.
- **Key extensions:** A guard denies a known-safe command in its self-test; the guard is disabled until a later self-test passes.

#### UC-005: Release a version

- **Primary actor:** Plugin maintainer
- **Precondition:** Changes are reviewed and gates are clear.
- **Success guarantee:** `plugin.json` and `marketplace.json` carry the same new version, the root changelog has an entry, and both maintenance scripts pass with `--check`.
- **Main scenario:** (1) Run `/bump`. (2) Update both manifests. (3) Run `sync-writing-standard.js --check` and `check-fsa-tables.js --check`. (4) Commit without AI attribution.
- **Key extensions:** A script exits 1; the maintainer fixes the drift before releasing.

## 5. Scope

#### In scope (user-facing capabilities)

- Routing and orchestration with approval, stop, and resume.
- Spec-first builds with conflict check, Clarify, document chain, sign-off, and waiver. PLANNED (1.11.1): the chain writes requirements to `docs/requirements/` and task plans to `docs/task-plans/`, and older root-level files stay in place, with a plain note in `DECISIONS.md` that the project keeps them there.
- The 18 user-invocable skills and the opt-in output style.
- Hook protections the user sees: attribution denial, prose gate and advice, injection markers, write limits, warnings, and `/health`.
- Maintainer scripts and the release checklist in `CLAUDE.md`.

#### Out of scope (user-facing exclusions)

| Excluded item | Reason | Deferred to |
|---------------|--------|-------------|
| Skills for Jira, Bitbucket PR tooling beyond `pr-review`, certificate prep, branch-to-Jira | Plugin stays generic | Never (stated exclusion) |
| Creating new agents or skills from inside the plugin | Meta-skills are excluded | Never (stated exclusion) |
| Generated audio from `/voice-script` | The skill writes scripts only | Never (stated exclusion) |
| Protection from Bash writes by a subagent | `fsa-write-bar` does not cover Bash | Not scheduled in the sources |
| Tool installation by agents | Agents show install commands only | Never (stated exclusion) |

## 6. Assumptions

- The user runs Claude Code with the plugin enabled and has git available.
- The user reads the step table and the sign-off table before approving.
- A user who wants hook warnings to disappear installs Node 6 or newer.
- Hooks are guardrails. A user who needs a hard boundary adds one outside the plugin.

## 7. Open questions

- `README.md`, `docs/SPECIFICATION.md`, and `docs/TOKEN_OPTIMIZATION.md` quote different savings figures (about 65% footprint, 83% static footprint reduction, 36.6% multi-step average, up to 82% on read-only operations). The sources name no measurement method that this document can verify. Which figure, if any, should become a measured success criterion?
- Resolved by a user decision (`DECISIONS.md`, 2026-10-14): the planned drift check (UR-051) reads a `## Write guard lists` section in `plugins/assist-plugin/rules/assist-plugin-rule.md` and a one-row table under `## Write scope` in `agents/task-planner.md`, both created in 1.11.1.

## 8. Glossary

| Term | Definition |
|------|-----------|
| Build request | A request that asks `/do` for work that writes code, config, pipelines, infrastructure, or tests |
| DocSignOff | The second approval of a build plan, where the owner approves the three chain documents |
| Waiver | The "Skip spec-first" answer at plan approval, recorded in `DECISIONS.md` |
| Conflict check | A read-only `intake-reviewer` pass that compares a build request with existing documents and decisions |
| Clarify | The `/do` state that asks the user about open points, up to 5 rounds for build requests and 2 otherwise |
| Self-test | A fixed set of allow and deny cases that `health-check.js` runs against each guard or filter |

## 9. Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-14 | Toni-Jan Keith Monserrat | Initial draft for assist-plugin 1.11.0 plus three PLANNED 1.11.1 changes |
