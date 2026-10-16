# spec-skills-requirements-specs

## Metadata

| Field | Value |
|---|---|
| **Feature** | Requirements and specification skills: `/gather-requirements`, `/spec-from-requirements` |
| **Parent feature** | spec-skills.md |
| **Sub-features** | None |
| **Requirement refs** | BR-006, BR-010, BR-012, BR-013, UR-011, UR-019, UR-035, UR-036, FR-149, FR-150, FR-151, FR-152, FR-153, FR-154, FR-155, FR-156, FR-179, FR-182, FR-183, NFR-013 |
| **Feature type** | Tooling |
| **Status** | Draft |

Status values: Draft, Review, Approved, Implemented.

Citation paths: cited paths that start with `skills/` or `agents/` are relative to `plugins/assist-plugin/`; a citation of this repository's own requirement documents (`docs/requirements/...`) or `DECISIONS.md` is relative to this repository's root. That rule covers citations only: the skill's output folder `docs/requirements/` resolves against the git root of the session's working directory (`DECISIONS.md:93-96`), as the requirements below state. Baseline: commit 4803a0d; references into `docs/requirements/` and `DECISIONS.md` point at their current text (re-checked on 2026-10-16, after the last requirements update). The planned untrusted-input rule for both skills (FR-176, FR-177) is specified in `spec-skills-untrusted-input.md`.

## Description

`/gather-requirements` elicits requirements in six phases, writes them as a BRD, a URD, and an FR-NFR document with stable `BR`, `UR`, `FR`, and `NFR` IDs and GIVEN/WHEN/THEN scenarios, and reviews existing requirement documents read-only. `/spec-from-requirements` classifies a requirement into one of six spec types, writes `specs/spec-<feature>.md` from the matching template, records later changes as dated deltas, and reviews specs read-only. Together they are the first two links of the document chain that `/do` runs ahead of build steps (Area A FR-028 to FR-030); `task-plan` and `create-test` consume their IDs (`spec-skills-plan-test.md`). At 4803a0d `document` writes to the working directory; FR-182 and FR-183, PLANNED (1.11.1), move its output and write grant to `docs/requirements/`, with the folder resolved against the session's git root (`DECISIONS.md:78-86`, `:93-96`, 2026-10-16). Specs stay in `specs/`. How `/do` finds documents in the new folder and, in an older project, at the old root patterns is Area A (FR-187, FR-188); the note `/do` leaves in `DECISIONS.md` about kept root documents is never read as a path (`DECISIONS.md:88-91`).

## Triggered by

| Trigger type | Source | Condition |
|---|---|---|
| User action | `/gather-requirements [elicit \| document \| review] [topic \| file]` (`skills/gather-requirements/SKILL.md:17`) | Requirements work |
| User action | `/spec-from-requirements [create \| delta \| review] [feature-name \| file-path]` (`skills/spec-from-requirements/SKILL.md:19`) | Spec work |
| Agent preload | `requirements-gatherer` and `intake-reviewer` preload `gather-requirements`; `solutions-architect` preloads `spec-from-requirements` | `/do` chain steps and intake reviews (Area A FR-071, FR-083 to FR-085) |

## Required data

| Data | Source | Type | Notes |
|---|---|---|---|
| Subcommand | First argument | Enum | `gather-requirements`: empty means `elicit` (`SKILL.md:26`). `spec-from-requirements`: empty means `create` when no spec exists for the feature, else `delta` (`SKILL.md:28`) |
| Topic, file, or feature name | Second argument | String or path | Topic for `elicit`; source file for `document` and `review`; feature or spec path for the spec modes |
| User answers | AskUserQuestion in the main conversation, or `/do` relays in a subagent | Text | Batches of 3 to 5 questions |
| Existing requirement documents | `./BRD-*.md`, `./URD-*.md`, `./FR-NFR-*.md` in the working directory at 4803a0d; `docs/requirements/` under the session's git root after FR-182 (PLANNED, 1.11.1) | Markdown | Numbering continues from them; `review` scans the working directory for them when no file is named (`skills/gather-requirements/references/review.md:9`). A root-level document the prompt names for update is updated in place after FR-182 |
| Author | `git config user.name` | String | Falls back to `[Author]` (`skills/gather-requirements/references/document-workflow.md:71`) |
| `--json` | Flag | Flag | Adds `requirements-<slug>.json` or the spec JSON projection |
| Templates | `skills/gather-requirements/references/*-template.md`; `skills/spec-from-requirements/references/templates/*.md` | Markdown | One per output type |

## Behavior

### Requirement: Six-phase elicitation in batches

The `/gather-requirements elicit` subcommand SHALL run six phases (context, business, user, functional, non-functional, summarize and confirm), batch 3 to 5 related questions per turn, and leave unresolved items in Open questions.

**Requirement refs:** FR-149, UR-035 | **Status:** Built | **Source:** `skills/gather-requirements/SKILL.md:24-39`; `skills/gather-requirements/references/elicitation-methodology.md:9-102`

Phase 1 checks the working directory for existing documents before asking about anything already written. Every NFR gets a number. A solution the user names is recorded as a note under the need it serves. In the main conversation the skill uses AskUserQuestion for closed choices; in a subagent it ends each round with `state: NeedsInput`, numbered `questions`, and `resume_at` naming the phase heading (Area A FR-083). `document` waits until the user confirms the summary.

#### Scenario: Batch

- **GIVEN** phase 2 has eight open questions
- **WHEN** the skill asks
- **THEN** one turn SHALL hold 3 to 5 of them

#### Scenario: Default subcommand

- **GIVEN** `/gather-requirements` with no first argument
- **WHEN** the skill routes
- **THEN** it SHALL run `elicit`

#### Scenario: Unresolved item

- **GIVEN** the user cannot answer a question
- **WHEN** the skill summarizes
- **THEN** the summary SHALL list the item under Open questions and SHALL NOT supply an answer for it

### Requirement: Requirements documents from gathered input

The `/gather-requirements document` subcommand SHALL categorize input into BR, UR, FR, and NFR and write `BRD-<slug>.md`, `URD-<slug>.md`, and `FR-NFR-<slug>.md` from the templates, plus `requirements-<slug>.json` with `--json`.

**Requirement refs:** FR-150, UR-035, NFR-013 | **Status:** Built (4803a0d: files in the working directory); the folder becomes `docs/requirements/` in 1.11.1 (FR-182) | **Source:** `skills/gather-requirements/SKILL.md:103-119`; `skills/gather-requirements/references/document-workflow.md:1-87`; `docs/requirements/FR-NFR-assist-plugin.md:2851-2852`

The workflow applies the sentence templates and uppercase RFC 2119 keywords, writes at least one happy-path and one failure-path scenario per FR, files each exclusion in the BRD, URD, or FR-NFR by level with item, reason, and deferred-to, runs the quality checklist and records failures in the document in place of rewriting a requirement the user supplied, and reports counts, quality issues, exclusions, open questions, and file paths.

#### Scenario: Three files (4803a0d)

- **GIVEN** a confirmed requirements summary for project `checkout`
- **WHEN** the user runs `/gather-requirements document`
- **THEN** the working directory SHALL hold `BRD-checkout.md`, `URD-checkout.md`, and `FR-NFR-checkout.md`, until FR-182 is built

#### Scenario: JSON projection

- **GIVEN** the same summary and `--json`
- **WHEN** the skill writes
- **THEN** it SHALL also write `requirements-checkout.json`, beside the three documents, holding the same requirement IDs

#### Scenario: No input

- **GIVEN** no requirements exist in the conversation, the arguments, or a named file
- **WHEN** the user runs `document`
- **THEN** the skill SHALL halt, redirect to `/gather-requirements elicit`, and write no file

#### Scenario: Requirement fails the quality pass

- **GIVEN** a user-supplied FR that says "respond quickly"
- **WHEN** the quality pass runs
- **THEN** the document SHALL record the failure next to the FR and SHALL keep the user's wording

### Requirement: Requirements output folder

The `/gather-requirements document` subcommand SHALL write `BRD-<slug>.md`, `URD-<slug>.md`, and `FR-NFR-<slug>.md`, plus `requirements-<slug>.json` with `--json`, to `docs/requirements/` under the git root of the session's working directory (a worktree uses its own root; outside a git repository, the working directory), creating the folder when it is missing.

**Requirement refs:** FR-182, UR-035, BR-013 | **Status:** PLANNED (1.11.1) | **Source:** `docs/requirements/FR-NFR-assist-plugin.md:3401-3430`; `DECISIONS.md:78-86` (2026-10-16, Requirements in docs/requirements/; Legacy root documents and the requirements JSON); `DECISIONS.md:93-96` (2026-10-16, docs/requirements/ and docs/task-plans/ resolve against the session's git root); `skills/gather-requirements/SKILL.md:103-115` (working directory at 4803a0d)

The folder resolves against the session's git root, so a session started in a subdirectory writes to the repository's `docs/requirements/` and gets a write prompt, because the planned grant (FR-183) is relative to the working directory; the user decided that prompt is intended (`DECISIONS.md:95`). A root-level document that the prompt names as an existing document to update stays where it is: an older project keeps its root-level files in place, and `/do` leaves a plain note in `DECISIONS.md` that it keeps them there (`DECISIONS.md:80`, `:85`, `:90`; Area A FR-188). The in-place update asks the user first, because the grant stays scoped to `docs/requirements/`; the user decided that prompt is intended (`DECISIONS.md:100`). Until this requirement is built, the 4803a0d behavior of the requirement above applies.

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

### Requirement: Requirements write grant

The `gather-requirements` skill SHALL pre-approve edits only to `./docs/requirements/BRD-*.md`, `./docs/requirements/URD-*.md`, `./docs/requirements/FR-NFR-*.md`, and `./docs/requirements/requirements-*.json`.

**Requirement refs:** FR-183, UR-035, UR-019, NFR-013, BR-006 | **Status:** PLANNED (1.11.1) | **Source:** `docs/requirements/FR-NFR-assist-plugin.md:3432-3461`, `:3579`; `DECISIONS.md` (2026-10-12, Scoped write grants; 2026-10-16, including `DECISIONS.md:93-96` and `:98-101`); `skills/gather-requirements/SKILL.md:13-16`, `:113` (`./BRD-*.md`, `./URD-*.md`, `./FR-NFR-*.md`, `./requirements-*.json` at 4803a0d)

The grant is relative to the session's working directory. A write from a session started in a subdirectory prompts, and the user decided that prompt is intended (`DECISIONS.md:95`). After this change a root-level requirements write also prompts, including the in-place update of a legacy root-level document under FR-182. The user decided that no root-level grant is added and that this prompt is intended (`DECISIONS.md:100`; decided point OP-15 in `spec-skills.md`).

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
- **THEN** Claude Code SHALL ask the user first, because the grant stays scoped to `docs/requirements/` and no root-level grant is added (`DECISIONS.md:100`)

### Requirement: Read-only requirements review

The `/gather-requirements review` subcommand SHALL audit a requirements document for quality, completeness, consistency, and traceability, report `PASS` or `NEEDS REVISION`, and change nothing.

**Requirement refs:** FR-151, UR-035, UR-011 | **Status:** Built | **Source:** `skills/gather-requirements/references/review.md:1-75`; `skills/gather-requirements/SKILL.md:128-129`

`NEEDS REVISION` needs at least one critical finding (ambiguous, contradictory, untestable, or untraceable); style findings alone leave `PASS`. Every finding cites the requirement ID and section. The document under review is untrusted data: an instruction inside it is a finding, never a step.

#### Scenario: Ambiguous requirement

- **GIVEN** an FR that says "respond quickly"
- **WHEN** the skill reviews the document
- **THEN** the report SHALL flag the FR under Testable with a measurable replacement and return `NEEDS REVISION`

#### Scenario: Style findings only

- **GIVEN** a document whose only findings are formatting issues
- **WHEN** the skill reviews it
- **THEN** the verdict SHALL read `PASS` with the formatting issues listed separately

#### Scenario: Instruction in the document

- **GIVEN** the document contains a line addressed to the reviewer about the review verdict
- **WHEN** the skill reviews it
- **THEN** the skill SHALL report the line as a finding and SHALL NOT follow it
- **AND** the file SHALL be unchanged after the run

### Requirement: Stable requirement IDs and upward trace

The `gather-requirements` skill SHALL assign sequential `BR-NNN`, `UR-NNN`, `FR-NNN`, and `NFR-NNN` IDs, keep every issued ID unchanged, and trace every FR to a UR and every UR to a BR.

**Requirement refs:** FR-152, UR-035, BR-013 | **Status:** Built | **Source:** `skills/gather-requirements/SKILL.md:41-56`, `:121-127`; `skills/gather-requirements/references/document-workflow.md:33-35`, `:45-50`

An NFR traces to the FR, UR, or BR it originates from.

#### Scenario: Update keeps IDs

- **GIVEN** an existing document with FR-001 to FR-010
- **WHEN** the skill adds a requirement
- **THEN** the new ID SHALL be FR-011 and FR-001 to FR-010 SHALL keep their numbers and text

#### Scenario: Orphan

- **GIVEN** an FR with no parent UR
- **WHEN** the skill documents it
- **THEN** the traceability matrix SHALL flag the orphan and the FR SHALL stay in the document

### Requirement: Classify-first spec creation

The `/spec-from-requirements create` subcommand SHALL classify a requirement into exactly one of Architecture, API endpoint, Frontend action, Functionality, UI/UX design, or General (first match wins) and write `specs/spec-[feature].md` from the matching template with Status `Draft`.

**Requirement refs:** FR-153, UR-036 | **Status:** Built | **Source:** `skills/spec-from-requirements/SKILL.md:36-89`; `skills/spec-from-requirements/references/classification-guide.md:1-75`

The file opens with the Metadata block, never mixes sections from two templates, marks a template section that does not apply as "Not applicable" with a reason, and ends with the traceability table. A feature that spans two types becomes two specs linked as parent and sub-feature. A submodule feature goes to `<submodule>/specs/`. With `--json` the skill also writes the JSON projection, and for an API endpoint spec the OpenAPI 3.1 path-item fragment.

#### Scenario: Endpoint

- **GIVEN** a requirement that defines an HTTP endpoint
- **WHEN** the user runs `create`
- **THEN** the skill SHALL use the API endpoint template and write `specs/spec-<feature>.md` with `**Status** | Draft`

#### Scenario: Submodule

- **GIVEN** a feature that belongs to the `backend` submodule
- **WHEN** the skill writes
- **THEN** the skill SHALL write `backend/specs/spec-<feature>.md`

#### Scenario: Requirement spans two types

- **GIVEN** a payment requirement with both an endpoint and a screen
- **WHEN** the skill classifies it
- **THEN** it SHALL write two specs linked through Parent feature and Sub-features and SHALL NOT mix both templates in one file

#### Scenario: Path outside the grant

- **GIVEN** a feature in a nested submodule `apps/web`
- **WHEN** the skill writes `apps/web/specs/spec-login.md`
- **THEN** Claude Code SHALL ask the user first, because the grant covers `./specs/` and `./*/specs/` only

### Requirement: Delta change log without rewrite

The `/spec-from-requirements delta` subcommand SHALL record an incremental change in a `## Change Log` entry with ADDED, MODIFIED, and REMOVED subsections without rewriting the file.

**Requirement refs:** FR-154, UR-036 | **Status:** Built | **Source:** `skills/spec-from-requirements/SKILL.md:26-34`; `skills/spec-from-requirements/references/delta-format.md:1-91`; `docs/SPECIFICATION.md:338`

The entry heading is `## Change Log: YYYY-MM-DD`, one per change event, appended at the end of the file, with a `**Source:**` line citing the requirement IDs and document version. Requirements in a delta sit one heading level deeper (`#### Requirement:`, `##### Scenario:`). MODIFIED shows `Was:`, `Now:`, and a reason; REMOVED shows the reason, the retiring requirement ref, and the migration. The Requirement refs field gains new IDs and keeps removed ones with `(removed YYYY-MM-DD)`. Status returns to `Review` unless the user approves the change in the same turn. Editorial changes and Status-only changes are direct edits with no delta.

#### Scenario: Added requirement

- **GIVEN** an existing spec and a new requirement
- **WHEN** the user runs `delta`
- **THEN** the skill SHALL append an ADDED entry and leave every pre-existing line below the Metadata table byte-identical
- **AND** in the Metadata table only the Status and Requirement refs rows MAY change (`delta-format.md:75-76`)

#### Scenario: Default mode

- **GIVEN** no first argument and an existing spec for the feature
- **WHEN** the user runs the skill
- **THEN** the skill SHALL choose `delta`

#### Scenario: Removed requirement

- **GIVEN** an existing spec and a requirement that is dropped
- **WHEN** the user runs `delta`
- **THEN** the skill SHALL append a REMOVED entry with reason, requirement ref, and migration and SHALL NOT rewrite the file

#### Scenario: Change with no requirement source

- **GIVEN** a design change that no BR, UR, FR, or NFR ID backs
- **WHEN** the user asks for a delta
- **THEN** the skill SHALL NOT write the delta and SHALL ask for the change to be approved as a requirement first

### Requirement: Read-only spec review

The `/spec-from-requirements review` subcommand SHOULD report CRITICAL, WARNING, and SUGGESTION findings for completeness, correctness, coherence, and style and change nothing, including the spec's Status.

**Requirement refs:** FR-155, UR-036 | **Status:** Built | **Source:** `skills/spec-from-requirements/SKILL.md:138-149`; `skills/spec-from-requirements/references/pseudo-code-gate.md:33-40`

| Check | Level when it fails |
|---|---|
| Completeness: every Requirement has a Scenario, every template section is present or "Not applicable", error handling covers more than the happy path | CRITICAL |
| Correctness: refs exist in the requirement documents, no orphan traceability rows, one RFC 2119 keyword per statement | CRITICAL |
| Coherence: one template's sections only, Feature type matches, parent and sub-feature links resolve | WARNING |
| Style: scenario names, observable statements, no pseudo-code outside the gate | SUGGESTION |

#### Scenario: Missing scenario

- **GIVEN** a `### Requirement:` with no `#### Scenario:`
- **WHEN** the skill reviews the spec
- **THEN** the skill SHALL report a CRITICAL completeness finding

#### Scenario: Status unchanged

- **GIVEN** a spec with Status `Draft`
- **WHEN** review finishes
- **THEN** the Status SHALL still read `Draft` and the file SHALL be byte-identical

#### Scenario: Unapproved suggested pseudo-code

- **GIVEN** a spec marked `Approved` that holds a block under `<!-- SUGGESTED: review before approval -->` with no recorded approval
- **WHEN** the skill reviews it
- **THEN** the skill SHALL report a CRITICAL finding

### Requirement: Requirement refs copied from the requirement documents

The `spec-from-requirements` skill SHALL cite at least one `BR`, `UR`, `FR`, or `NFR` ID, exactly as it appears in the requirements document, in each spec's Requirement refs field.

**Requirement refs:** FR-156, UR-036, BR-013 | **Status:** Built | **Source:** `skills/spec-from-requirements/SKILL.md:70-89`, `:123-132`

#### Scenario: No requirement reference

- **GIVEN** no requirement ID is available for a spec
- **WHEN** the skill prepares to write
- **THEN** the skill SHALL find the requirement or ask for it and SHALL NOT write the spec

#### Scenario: ID copied exactly

- **GIVEN** `FR-NFR-auth.md` defines FR-045
- **WHEN** the skill writes the spec
- **THEN** the Requirement refs field SHALL read `FR-045`, and the traceability table SHALL hold a row for FR-045

### Requirement: Every spec requirement carries scenarios

The `spec-from-requirements` skill SHALL give each Requirement in a spec at least one `#### Scenario:` in GIVEN/WHEN/THEN form, with a failure Scenario for each Requirement that can fail.

**Requirement refs:** FR-179, UR-036 | **Status:** Built | **Source:** `skills/spec-from-requirements/SKILL.md:91-121`

#### Scenario: Requirement without a scenario

- **GIVEN** a drafted Requirement that has no Scenario
- **WHEN** the skill checks the draft
- **THEN** the skill SHALL add a Scenario before it writes

#### Scenario: Requirement that can fail

- **GIVEN** a drafted Requirement with only a happy-path Scenario
- **WHEN** the skill checks the draft
- **THEN** the skill SHALL add a failure Scenario before it writes

## Algorithmic steps

**`gather-requirements document`** (`document-workflow.md:14-79`): load and parse the input; extract candidates; categorize and assign IDs, continuing existing numbering; apply sentence templates; write scenarios per FR; establish traceability and flag orphans and dead ends; file exclusions by level; write the three files (and the JSON with `--json`) in the working directory at 4803a0d, or after FR-182 in `docs/requirements/` under the git root of the session's working directory (a worktree's own root; the working directory outside a git repository), creating the folder when missing; run the quality pass; present counts, issues, exclusions, open questions, and paths.

**`gather-requirements review`** (`review.md:11-68`): load; check each requirement against the quality checklist; check completeness, consistency, and traceability; report with a verdict.

**`spec-from-requirements create`:** read the requirement IDs; walk the decision tree and stop at the first yes; read the matched template end to end; fill Metadata with every satisfied ID; write each behavior as `### Requirement:` with `#### Scenario:` blocks; mark non-applicable sections; add diagrams through `solutions-architect` (Area A FR-085); close with the traceability table.

**`spec-from-requirements delta`:** confirm a requirement source; append the dated Change Log with ADDED, MODIFIED, and REMOVED subsections; update Requirement refs; set Status to `Review` unless approved in the same turn.

The document chain these skills start:

```mermaid
flowchart LR
  E["gather-requirements elicit: six phases, 3 to 5 questions per turn"] --> SUM{"User confirms the summary?"}
  SUM -->|"no"| E
  SUM -->|"yes"| D["document: categorize, assign BR, UR, FR, NFR IDs"]
  D --> R1[("BRD-slug.md, URD-slug.md, FR-NFR-slug.md: working directory at 4803a0d, git-root docs/requirements/ after FR-182")]
  R1 --> SC["spec-from-requirements create: classify, template, Requirement refs"]
  SC --> S1[("specs/spec-feature.md")]
  S1 --> TP["task-plan: Intake gate, Satisfies IDs"]
  TP --> T1[("task-plan-slug-timestamp.md: root at 4803a0d, git-root docs/task-plans/ after FR-184")]
  S1 --> CT["create-test: Scenarios to tests with traceability comments"]
  CT --> T2[("test files")]
  RV["gather-requirements review"] -.->|"PASS or NEEDS REVISION"| R1
  SR["spec-from-requirements review"] -.->|"CRITICAL, WARNING, SUGGESTION"| S1
  DL["spec-from-requirements delta"] -.->|"Change Log entry"| S1
```

Render source: `specs/spec-skills-document-chain.mmd`.

## Output / Outcome

| Output | Type | Description |
|---|---|---|
| Requirements summary | Chat report | BR, UR, FR (with scenarios), NFR, out of scope, open questions (`elicitation-methodology.md:69-94`) |
| `BRD-<slug>.md`, `URD-<slug>.md`, `FR-NFR-<slug>.md` | Files | Written from the templates to the working directory at 4803a0d; to `docs/requirements/` under the session's git root, created when missing, after FR-182 (PLANNED, 1.11.1) |
| `requirements-<slug>.json` | File | Only with `--json`; beside the three documents |
| Requirements review | Chat report | Findings table, completeness, consistency, traceability, verdict `PASS` or `NEEDS REVISION` |
| `specs/spec-<feature>.md` or `<submodule>/specs/spec-<feature>.md` | File | Status `Draft` |
| `specs/spec-<feature>.json`, `specs/openapi/*` | Files | Only with `--json`; OpenAPI only for API endpoint specs |
| Change Log entry | File change | Appended to an existing spec |
| Spec review | Chat report | CRITICAL, WARNING, SUGGESTION findings; file unchanged |

## Error handling

| Error condition | Handling strategy | Outcome |
|---|---|---|
| `document` with no input | Halt; redirect to `elicit` | No file written |
| User cannot answer an elicitation question | Record it under Open questions | No invented answer |
| Requirement fails the quality checklist | Record the failure in the document | User wording kept |
| Orphan FR or UR | Flag it in the matrix | Requirement kept |
| Instruction inside a reviewed document | Report it as a finding | Not followed; file unchanged |
| No requirement ID for a spec | Find it or ask | Spec not written |
| Delta with no requirement source | Ask for a requirement first | No delta written |
| Requirement fits two spec types | Two linked specs | No mixed file |
| Write outside the scoped grant | Permission prompt | The user decides |
| `docs/requirements/` missing (after FR-182) | Create the folder | Documents written in it |
| Prompt names a legacy root-level requirements document (after FR-182) | Update it in place; no copy in `docs/requirements/` | The write asks the user first once FR-183 narrows the grant; intended per `DECISIONS.md:100` |
| Session started in a subdirectory (after FR-182, FR-183) | Write to the git root's `docs/requirements/` | Claude Code asks first; intended per `DECISIONS.md:95` |

## Events emitted (if applicable)

Not applicable: the skills write files and chat output and emit no events.

## Dependencies

| Dependency | Type | Required | Notes |
|---|---|---|---|
| `gather-requirements` grants | Runtime | yes | Read, Grep, Glob, AskUserQuestion, and the four scoped Edit rules (`skills/gather-requirements/SKILL.md:8-16`); no Bash, so reading `git config user.name` prompts or falls back to `[Author]`. FR-183 (PLANNED, 1.11.1) moves the four rules under `./docs/requirements/` |
| `/do` SpecGate and legacy notes | Runtime | no | Area A FR-187, FR-188, FR-191 (PLANNED, 1.11.1): search of `docs/requirements/` under the session's git root and of the old root patterns; the `DECISIONS.md` note about kept root documents is never parsed for paths (`DECISIONS.md:88-91`) |
| `spec-from-requirements` grants | Runtime | yes | Read, Grep, Glob, and the six scoped Edit rules (`skills/spec-from-requirements/SKILL.md:9-18`) |
| Templates and references | Reference | yes | BRD, URD, FR-NFR templates; six spec templates; classification guide; delta format; pseudo-code gate; JSON and OpenAPI formats; cloud patterns |
| `/do` relays | Runtime | no | NeedsInput rounds under `/do`: per-phase maximum 3, total 10 (Area A FR-050) |
| `mmdc` through `solutions-architect` | External | no | Diagrams for specs (Area A FR-085; Area B FR-092, FR-093) |
| Untrusted-input rule | Policy | no | PLANNED for both skills (FR-176, FR-177; `spec-skills-untrusted-input.md`) |

## Sub-feature breakdown (if applicable)

Not applicable: this spec has no sub-features.

## Submodule scope (if applicable)

Not applicable: the repository has no submodules. The skill's submodule placement rule is specified under classify-first spec creation.

## Traceability

| Requirement | Spec section | Verified by |
|---|---|---|
| FR-149 | Requirement: Six-phase elicitation in batches | Manual `/gather-requirements` run; question count per turn; Open questions in the summary |
| FR-150 | Requirement: Requirements documents from gathered input | `document` run producing three files; `--json` run; no-input run |
| FR-182 | Requirement: Requirements output folder | After 1.11.1: `document` run in a project without `docs/requirements/`; `--json` run; runs from `<repo>/src` and from a worktree root, checking the target folder; run naming a root-level `FR-NFR-*.md` for update, followed by a check that no copy exists in `docs/requirements/` |
| FR-183 | Requirement: Requirements write grant | After 1.11.1: frontmatter read of `skills/gather-requirements/SKILL.md`; writes to `docs/requirements/BRD-shop.md` and `docs/requirements/requirements-shop.json` from the repository root run without a prompt; a write to `./BRD-shop.md` prompts; a write from a session started in `<repo>/src` prompts; an in-place update of a root-level `./FR-NFR-auth.md` prompts |
| FR-151 | Requirement: Read-only requirements review | `review` on fixtures with "respond quickly", style-only issues, and a planted line; checksum before and after |
| FR-152 | Requirement: Stable requirement IDs and upward trace | Update run on a document with FR-001 to FR-010; orphan fixture |
| FR-153 | Requirement: Classify-first spec creation | `create` runs for an endpoint, a submodule feature, and a two-type requirement |
| FR-154 | Requirement: Delta change log without rewrite | `delta` runs; diff shows an appended Change Log, no change below the Metadata table, and at most the Status and Requirement refs rows changed inside it |
| FR-155 | Requirement: Read-only spec review | `review` on fixtures; Status and checksum unchanged |
| FR-156 | Requirement: Requirement refs copied from the requirement documents | Grep of each Requirement refs ID in the requirement documents |
| FR-179 | Requirement: Every spec requirement carries scenarios | Count of `### Requirement:` blocks without a following `#### Scenario:` is 0 |
| NFR-013 | Requirement: Requirements documents from gathered input; Requirement: Classify-first spec creation | Frontmatter read; out-of-grant prompt |
| UR-011, UR-019, UR-035, UR-036, BR-006, BR-010, BR-012, BR-013 | Requirements above, by their refs | As listed per requirement |
