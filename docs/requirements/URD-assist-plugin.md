# assist-plugin: User Requirements Document

**Version:** 1.5
**Date:** 2026-10-23
**Author:** Toni-Jan Keith Monserrat
**Status:** DRAFT

Baseline: assist-plugin 1.11.1 (released, commit 41034c1). Version 1.5 (2026-10-23) adds UR-058 as PLANNED (1.13.1), for release 1.13.1, "voice scripts without em dashes" (`DECISIONS.md:273-276`, `:278-281`, `:283-286`, and `:288-291`); the functional requirements that satisfy it are FR-211 to FR-213, and no other user requirement changes. Every other requirement is **Built** unless marked **PLANNED (1.12.0)** or **PLANNED (1.13.1)**. UR-048, UR-050, UR-051, and UR-052 were PLANNED (1.11.1) and are now Built. UR-054 to UR-057 were added in version 1.3 as PLANNED (follow-up to 1.12.0): Bitbucket PR review, PR review hardening, `/bump --path` validation, and the checklist wording. Version 1.4 sets them to Built (1.13.0) after the follow-up build (`DECISIONS.md:243-271`): the functional requirements that satisfy them (FR-202 to FR-210) were confirmed by reading the built files on 2026-10-22, not by running them, and the version files still read 1.12.0 until the 1.13.0 hand release. UR-053 is new and PLANNED (1.12.0); the 1.12.0 changes to existing behavior sit in the functional requirements (`docs/requirements/FR-NFR-assist-plugin.md`) and do not change the wording of the other user requirements.

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

Status is Built unless the row says PLANNED (1.12.0) or PLANNED (1.13.1). UR-054 to UR-057 read Built (1.13.0). UR-058 is PLANNED (1.13.1).

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
| UR-048 | The plugin maintainer shall be able to find this repository's own requirements in `docs/requirements/`, task plans in `docs/task-plans/`, and specs in `specs/`, where `/do` SpecGate looks. | Plugin maintainer | BR-014 | Should |
| UR-049 | The plugin user shall be able to have code written, fixed, or refactored from a plan by one agent and tested by another that never reads the implementation. | Plugin user | BR-010, BR-005 | Must |
| UR-050 | The plugin user shall have the requirements agent and the two document skills treat the content of requirements, specs, and user files, including text the user puts in a quote block or code fence or ties to a named file, as data, while all other text the user types stays the user's own authoritative answer. | Plugin user | BR-006 | Must |
| UR-051 | The plugin maintainer shall be told when the verdict, task-plan path, protected-path, or auto-loaded-file tables in code differ from the markdown that documents them. | Plugin maintainer | BR-015 | Must |
| UR-052 | The plugin maintainer shall be able to read the release history in one changelog. | Plugin maintainer | BR-017 | Should |
| UR-053 | PLANNED (1.12.0): The plugin maintainer shall be able to rely on each skill's `metadata.json` matching the frontmatter of its `SKILL.md`, with a test that fails on a difference and lists the skills that have no `metadata.json`. | Plugin maintainer | BR-016, BR-005 | Should |
| UR-054 | Built (1.13.0): The plugin user shall be able to review a Bitbucket Cloud or Data Center pull request with `/pr-review` using `bkt` commands that work, and to have `/do` run the same review for a Bitbucket remote, with the call kept on the host of the repository. | Plugin user | BR-010, BR-006 | Must |
| UR-055 | Built (1.13.0): The plugin user shall have pull request text treated as data, posted reviews limited to findings on the diff, a prompt, in every session, before the commands on the posting ask hook's list that post, merge, or close a pull request (a best-effort guardrail with known gaps, FR-206), and the scratch files of a `/do` review written safely and removed afterward. | Plugin user | BR-006 | Must |
| UR-056 | Built (1.13.0): The plugin user shall have the `--path` value of `/bump` checked before it reaches the commit message and tag, and a value that would give an invalid git tag name refused (FR-209). | Plugin user | BR-010, BR-006 | Must |
| UR-057 | Built (1.13.0): The plugin maintainer shall be able to read in the LLM security checklist that the pull request confirmation is a written rule and that the skill's Bash runs with no prompt. | Plugin maintainer | BR-005, BR-016 | Should |
| UR-058 | PLANNED (1.13.1): The plugin user shall be able to paste a `/voice-script` script that holds no U+2014, U+2015, or curly quote anywhere in the saved file, with dash-style pauses marked as the chosen model's reference file lists, so the file passes the prose gates of this plugin and of other tools, and to see in the script's header how many em dashes of a draft or of header text were replaced, whether curly quotes were straightened, and which other writing tells were kept (FR-211 to FR-213). | Plugin user | BR-010, BR-008 | Should |

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
- **Precondition:** `gh` or `bkt` is installed and authenticated; a git remote exists. Built (1.13.0): for a Bitbucket remote, `bkt auth login` was run and a `bkt` context exists for the host (login does not create one), and `BKT_TOKEN`, `BKT_HOST`, and `BKT_CONFIG_DIR` are unset (FR-203).
- **Success guarantee:** A verdict was posted only after the user confirmed the drafted text.
- **Main scenario:** (1) The user types `/pr-review 123`. (2) The skill detects the platform and fetches the PR. (3) It drafts a verdict. (4) The user confirms. (5) The skill posts the verdict through a message file.
- **Key extensions:** The user answers no and edits the draft. The PR is the user's own and the skill returns an error. PLANNED (1.12.0): under `/do`, the read-only `reviewer` drafts the verdict in the prose above its block and ends `Done` with `approved` or `returned`, `/do` fetched the PR by redirect so that the PR text never enters its context and shows the draft, and after the user confirms, `/do` itself posts it with `gh` through a body file, without calling `/pr-review`; no subagent posts. The `/do` flow supports `github.com` remotes only in 1.12.0, and any other host, Bitbucket included, fails the step with `precondition-failed` and the message to run `/pr-review` directly (FR-195). Built (1.13.0): the flow also supports `bitbucket.org` and matching Bitbucket Data Center remotes with `bkt`, refuses to run when `BKT_TOKEN`, `BKT_HOST`, or `BKT_CONFIG_DIR` is set, removes its `pr-<N>` files afterward, while a best-effort hook with listed known gaps asks before the posting commands on its list in every session, a direct `/pr-review` run included (FR-206); a user who rejects that prompt gets a declined post, not a failure, and no retry; a direct `/pr-review` run treats PR text as data, caps the fetch at 200 KB, and posts only findings on the diff (FR-202 to FR-208).

#### UC-004: Recover from a hook failure

- **Primary actor:** Plugin user
- **Precondition:** A hook crashed or Node is older than 6.
- **Success guarantee:** The command ran, the user saw a warning, and `/health` shows the failure.
- **Main scenario:** (1) A hook fails. (2) Claude Code shows a one-line warning and the command proceeds. (3) The user runs `/assist-plugin:health`. (4) The report names the failure and the fix.
- **Key extensions:** A guard denies a known-safe command in its self-test; the guard is disabled until a later self-test passes.

#### UC-005: Release a version

- **Primary actor:** Plugin maintainer
- **Precondition:** Changes are reviewed and gates are clear.
- **Success guarantee:** `plugin.json` and `marketplace.json` carry the same new version, the root changelog has an entry, and both maintenance scripts pass with `--check`. PLANNED (1.12.0): the release checklist also names `CLAUDE.md`, `README.md`, and `MARKETPLACE.md` (two places) as files that carry the version (FR-194).
- **Main scenario:** (1) Run `/bump`. (2) Update both manifests. (3) Run `sync-writing-standard.js --check` and `check-fsa-tables.js --check`. (4) Commit without AI attribution.
- **Key extensions:** A script exits 1; the maintainer fixes the drift before releasing.

## 5. Scope

#### In scope (user-facing capabilities)

- Routing and orchestration with approval, stop, and resume.
- Spec-first builds with conflict check, Clarify, document chain, sign-off, and waiver. Since 1.11.1 the chain writes requirements to `docs/requirements/` and task plans to `docs/task-plans/`, and older root-level files stay in place, with a plain note in `DECISIONS.md` that the project keeps them there. PLANNED (1.12.0): the chain writes specs to `specs/` under the same git root.
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
- Resolved by a user decision (`DECISIONS.md`, 2026-10-14): the drift check (UR-051) reads a `## Write guard lists` section in `plugins/assist-plugin/rules/assist-plugin-rule.md` and a one-row table under `## Write scope` in `agents/task-planner.md`, both created in 1.11.1.
- Resolved by the user on 2026-10-16: the 40 deferred points about 1.11.0 behavior, recorded in `DECISIONS.md` (2026-10-16 entries) and in `docs/requirements/FR-NFR-assist-plugin.md`, section 9. Questions that came up while documenting them were closed by later 2026-10-16 answers or are listed there (section 9, open questions 3 to 9).

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
| 1.1 | 2026-10-16 | Toni-Jan Keith Monserrat | Baseline moved to 1.11.1. UR-048, UR-050 to UR-052 set to Built. UR-053 added (PLANNED, 1.12.0). UC-003 and UC-005 note the 1.12.0 changes |
| 1.2 | 2026-10-17 | Toni-Jan Keith Monserrat | Post-sign-off change: UC-003 now says `/do` fetches the PR by redirect, posts with `gh` only, supports `github.com` remotes only in 1.12.0, and calls no `/pr-review` (`DECISIONS.md:183-216`, FR-195) |
| 1.3 | 2026-10-17 | Toni-Jan Keith Monserrat | UR-054 to UR-057 added (PLANNED, follow-up to 1.12.0): Bitbucket PR review, PR review hardening, `/bump --path` validation, checklist wording. UC-003 notes the Bitbucket flow and hardening (FR-202 to FR-210). Documents stay DRAFT until the user signs off |
| 1.4 | 2026-10-22 | Toni-Jan Keith Monserrat | UR-054 to UR-057 set to Built (1.13.0) after the follow-up build (`DECISIONS.md:243-271`), confirmed by reading the built files. UR-056 adds the refusal of a value that gives an invalid git tag name (rule R8, FR-209). UC-003 marks the Bitbucket flow built, calls the ask hook best-effort with listed known gaps, and adds the declined outcome of a rejected prompt. No new elicitation. Documents stay DRAFT until the user signs off |
| 1.5 | 2026-10-23 | Toni-Jan Keith Monserrat | UR-058 added (PLANNED, 1.13.1): voice scripts without em dashes, with header notes for replaced em dashes, straightened curly quotes, and kept tells (FR-211 to FR-213, `DECISIONS.md:273-276`, `:278-281`, `:283-286`, and `:288-291`). Fix pass 1: whole-file scope, header user text, kept tells. Fix pass 3: a typed voice id, clip path, or model id with U+2014, U+2015, or a curly quote is refused (`DECISIONS.md:288-291`). UR-016 and UR-040 unchanged; the `docs/tts/` skip that served UR-016 is retired (FR-181). Documents stay DRAFT until the user signs off |
