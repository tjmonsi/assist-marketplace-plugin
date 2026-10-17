# spec-skills

## Metadata

| Field | Value |
|---|---|
| **Feature** | Area C: skill catalog, shared skill contract, manifests, and repository documents |
| **Parent feature** | None |
| **Sub-features** | spec-skills-ask-debug.md, spec-skills-git.md, spec-skills-pr-review.md, spec-skills-docs-review.md, spec-skills-requirements-specs.md, spec-skills-plan-test.md, spec-skills-deslop-voice-clarify.md, spec-skills-health.md, spec-skills-internal.md, spec-skills-manifests-docs.md, spec-skills-untrusted-input.md |
| **Requirement refs** | BR-003, BR-005, BR-006, BR-008, BR-010, BR-016, UR-019, UR-042, UR-045, FR-130, FR-183, FR-185, NFR-004, NFR-011, NFR-013, NFR-015, NFR-018, NFR-019 |
| **Feature type** | Tooling |
| **Status** | Approved |

Status values: Draft, Review, Approved, Implemented.

Baseline: assist-plugin 1.11.1 at commit 41034c1 (the 1.11.0 baseline was commit 4803a0d). A requirement is Built unless its Status line says PLANNED, copied from `docs/requirements/FR-NFR-assist-plugin.md` (version 1.1, 2026-10-16, final and approved: 201 FR). The PLANNED (1.12.0) changes sit in the `## Change Log: 2026-10-16` section at the end of each spec that receives them, with a `## Change Log: 2026-10-17` section where the 2026-10-17 decision applies; the main body keeps the built behavior. Citation paths: a citation of this repository's own requirement documents (`docs/requirements/...`) or `DECISIONS.md` is relative to this repository's root; other cited paths that start with `skills/`, `agents/`, `hooks/`, `rules/`, `scripts/`, or `docs/` are relative to `plugins/assist-plugin/`. That rule covers citations only. When a requirement names the skills' output folders `docs/requirements/` and `docs/task-plans/`, the folders resolve against the git root of the session's working directory, a worktree using its own root and the working directory serving outside a git repository (`DECISIONS.md:93-96`). A `file:line` reference points at the file as it stands at commit 41034c1, and references into `docs/requirements/` and `DECISIONS.md` point at their current text. Line cites in this spec family were re-checked on 2026-10-16 by reading the files that 1.11.1 changed (`CHANGELOG.md:5-23`) and every file a change log entry below names; a cite marked "at 4803a0d" describes the 1.11.0 text on purpose.

## Description

assist-plugin ships 22 skills under `skills/<name>/SKILL.md`: 18 that the user invokes as `/<name>` and 4 internal skills that agents preload. This parent spec fixes the catalog and the contract every skill file keeps: frontmatter, tool grants, write scope, the writing-standard block, prose quality, change control, and token cost. The eleven child specs specify each skill family, the manifests, the repository documents, and the untrusted-input rule. The `do` skill's behavior belongs to Area A (`specs/spec-orchestration*.md`, FR-001 to FR-085, FR-187 to FR-192, and FR-199); this spec covers `do` only as a catalog entry, as an invoker of `review-md`, and as the holder of one listed NFR-013 exception. Hooks belong to Area B (`specs/spec-hooks*.md`, FR-086 to FR-129, FR-180, FR-181, FR-186, and FR-198). The move of requirements to `docs/requirements/` and task plans to `docs/task-plans/` was built in 1.11.1 (FR-182 to FR-185 in `spec-skills-requirements-specs.md` and `spec-skills-plan-test.md`, FR-174 in `spec-skills-manifests-docs.md`), under the five 2026-10-16 entries at `DECISIONS.md:78-101`. The 1.12.0 changes that the user decided on 2026-10-16 (`DECISIONS.md:108-196`) and refined on 2026-10-17 (`:208-211`, the `/do` PR review on GitHub only) add FR-193 to FR-197, FR-200, and FR-201 to Area C and revise FR-136 to FR-139, FR-143, FR-147, FR-148, FR-154, FR-175 to FR-177, NFR-004, NFR-011, NFR-013, NFR-015, and NFR-020; each child spec records its part in its own Change Log.

### Decided points (no open point remains)

Every open point that this spec family carried was settled by the user on 2026-10-16: the answers are recorded under User Decisions in `.agent/main-plan/plan-deferred-decisions-20261016-1059.md` and `.agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md`, and the architectural ones in `DECISIONS.md:108-196`, with the 2026-10-17 refinement of OP-4 at `DECISIONS.md:208-211`. Each entry names the requirement that now carries the answer and the Change Log that applies it. Where a later `DECISIONS.md` entry refines an earlier answer, the later entry governs.

- **OP-1: LLM gate scope (decided).** The OWASP for LLM gate covers every file under `skills/**`: `SKILL.md`, reference files at any depth (the 87 nested reference files that the narrow `skills/**/references/*.md` glob missed), and `metadata.json` (`DECISIONS.md:108-111`); `.claude/settings*.json` stays in the trigger (`DECISIONS.md:158-161`). The path set is anchored: `agents/`, `skills/`, `rules/`, and `hooks/` count at the repository root, under any `plugins/<name>/`, or under `.claude/`, and an application folder such as `src/hooks/` does not trigger the gate (`DECISIONS.md:168-171`); any `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md` at any depth triggers it, because Claude Code loads those files into the model's context (`DECISIONS.md:173-176`). Carried by NFR-011 (`docs/requirements/FR-NFR-assist-plugin.md:4345`) and FR-061 (`:1304-1348`); `/do` runs it as a named gate under FR-199 (Area A, `:1350`). Applied in: this spec's Change Log (MODIFIED Requirement: LLM security gate on skill changes).
- **OP-3: Callers of `review-md` (decided).** FR-148 is reworded: only `ask` and `do` invoke `review-md` on their reports, and the caller list in `skills/review-md/SKILL.md:31` narrows to those two, PLANNED (1.12.0) (`docs/requirements/FR-NFR-assist-plugin.md:3283-3302`). Applied in: `spec-skills-docs-review.md` Change Log; the catalog diagram below; notes in `spec-skills-ask-debug.md` and `spec-skills-pr-review.md`.
- **OP-4: `/do` PR reviews (decided).** FR-195 (`docs/requirements/FR-NFR-assist-plugin.md:4079-4218`) covers `github.com` remotes only in 1.12.0. `/do` fetches the PR by running `gh` through Bash with the output redirected into `.agent/pr-review/pr-<N>.diff` (capped at 200 KB, any cut recorded), so the PR text never enters its context; the read-only `reviewer` gets gate Security, artifact type `code`, and that path as untrusted data, drafts above its terminal block with findings cited at the PR file and diff line, and ends `Done` with `approved` or `returned`; `/do` shows the draft once and, after the user confirms, posts it itself with `gh pr review --approve`, `--request-changes`, or `--comment` through a body file with a non-prose extension. On any other host, Bitbucket included, `/do` fails the step with `precondition-failed` and the message to run `/pr-review` directly, and runs no `bkt` command (`DECISIONS.md:208-211`; FR-195 scenario "Bitbucket remote", `:4155-4158`). The `bkt` forms in the specs and in `/pr-review`'s references do not match the bkt CLI, and correcting them everywhere is a follow-up outside 1.12.0 (`DECISIONS.md:208-211`). `/do` calls no `/pr-review`, so `/pr-review` always confirms on its own (FR-143, `:3183-3212`); the bounded exception of `DECISIONS.md:178-181` is withdrawn (`DECISIONS.md:183-186`). Sources: `DECISIONS.md:118-121`, refined by `:148-151`, `:153-156`, `:158-161`, `:163-166`, `:183-186`, `:193-196` (the Bitbucket approve-then-comment flow, which `:208-211` takes out of the `/do` flow for 1.12.0), and `:208-211`; the first answer (relay through `NeedsInput`, a Bash step submits) was replaced by those later entries. The `/do` side belongs to Area A; the skill-text part is applied in the `spec-skills-pr-review.md` Change Logs of 2026-10-16 and 2026-10-17.
- **OP-5: NFR-004 counted text and method (decided).** For a new skill the counted text is its frontmatter `description` plus its `argument-hint`, and the token figure is the character count divided by 4 (about 4 characters per token), reported as an estimate (`docs/requirements/FR-NFR-assist-plugin.md:4288`). Applied in: this spec's Change Log (MODIFIED Requirement: Token budget for a new skill).
- **OP-6: Unscoped grants (decided).** NFR-013 (`docs/requirements/FR-NFR-assist-plugin.md:4347`) now defines a scoped grant (a path pattern for Write and Edit; a fixed command, a fixed program-and-subcommand prefix, or a fixed program that only reads for Bash) and lists twelve accepted exceptions: the unscoped grants of the ten skills named in the question (`bump`, `code`, `integrated-test`, `pr-review`, `review-md`, `create-test`, `run-test`, `debug`, `map-project`, `commit`), `do` with Edit, Write, and Bash, and `branch` with `Bash(git:*)` (`DECISIONS.md:158-161`). A read-only fixed program counts as scoped, so `branch` `Bash(df:*)` and `Bash(realpath:*)` and `pentest` `Bash(govulncheck *)` are not exceptions (`DECISIONS.md:163-166`). Applied in: this spec's Change Log (MODIFIED Requirement: Scoped write grants for the document and log skills) and the Output table; Dependencies notes in the child specs.
- **OP-7: `/bump` source conflicts (decided).** (a) `/bump` refuses only when the tag of the current version points at HEAD (FR-137). (b) `--path <dir>` commits `chore: bump <dir> to X.Y.Z` and tags `<tagdir>-vX.Y.Z`, `<tagdir>` being `<dir>` with every `/` replaced by `-` (FR-139; `DECISIONS.md:123-126`). (c) `--no-changelog` joins the argument hint, a plain fix (FR-138). (d) The `bump-strategy.md:183` example drops `.claude-plugin/plugin.json` (FR-137). (e) `--no-commit` creates no tag (FR-139; `DECISIONS.md:125`). A follow-up adds the pointer rule: when the target `CHANGELOG.md` only points at another changelog, `/bump` writes the entry into the file it points to, one hop at most, and on an unclear `CHANGELOG.md` it asks the user to write in place, name another target that passes the same checks, or skip the changelog, and continues the same run (FR-138, FR-200; `DECISIONS.md:125`, `:188-191`). Applied in: `spec-skills-git.md` Change Log; a note in `spec-skills-manifests-docs.md`.
- **OP-8: Unnamed override flag (decided).** The mention at `skills/pr-review/SKILL.md:207-208` is dropped and no flag overrides an already approved or declined PR (FR-143, scenario "No override flag"). Applied in: `spec-skills-pr-review.md` Change Log.
- **OP-9: Citation numbering (decided).** In "answer N, block M", N and M count from 1; N counts the user's answers across the whole agent run, relays included, each answered question being its own answer; M counts the quote blocks and code fences within answer N (FR-175 to FR-177, `docs/requirements/FR-NFR-assist-plugin.md:3778`, `:3814`, `:3835`; `DECISIONS.md:158-161`). Applied in: `spec-skills-untrusted-input.md` Change Log.
- **OP-10: Skill total in the agent registry (decided).** The NFR-020 skill-count check excludes `skills/do/references/agent-registry.md`, which states no skill total; the agent count still covers all eight files (`docs/requirements/FR-NFR-assist-plugin.md:4449`, `:4457-4460`). Applied in: `spec-skills-manifests-docs.md` Change Log.
- **OP-11: Commit rules (decided).** (a) FR-136 gains the scenario "Developer's own git identity" for `/commit` and `/bump` (`docs/requirements/FR-NFR-assist-plugin.md:2969-2972`). (b) FR-196: the `commit` skill sets `model: haiku` in its frontmatter (`DECISIONS.md:143-146`). The condition in FR-196 holds: Claude Code skill frontmatter supports a `model` field, a check the main conversation recorded on 2026-10-16 against code.claude.com/docs/en/slash-commands (`.agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md:56`). Applied in: `spec-skills-git.md` Change Log.
- **OP-12: `review-md` stop rule (decided).** `review-md` checks all three categories on every run and reports their findings together; the stop rule at `skills/review-md/SKILL.md:35` goes (FR-147, `docs/requirements/FR-NFR-assist-plugin.md:3262-3281`). Applied in: `spec-skills-docs-review.md` Change Log.
- **OP-13: Placeholders in the secret scan (decided).** NFR-015 (`docs/requirements/FR-NFR-assist-plugin.md:4349`) bars a host ending in `.company.com` or `.internal` (other than `host.docker.internal`) and a `user:password`-style credential, defined as a `-u` or `--user` value in the `x:y` form, or URL userinfo of the form `://x:y@`, whose parts are not `<...>` placeholders (a `host:port` is not a credential, and a `-u` value without a colon, such as the container user in `docker run -u zap` at `skills/pentest/references/zap.md:123`, is not one either); examples use `example.com`-style hosts and `<user>:<token>` placeholders. The 14 current hits are `skills/pr-review/references/pr-detection.md:23`, `:24`, `:52`, `:53`, `:58`, `:59`, `:111`, `:168`, `:224`, `:227`, `:258`, `:262`, `skills/pr-review/SKILL.md:60`, and `skills/integrated-test/references/integration-patterns/go.md:65` (a `postgres://postgres:test@` URL that becomes a URL built from container variables, `DECISIONS.md:193-196`); each was re-read on 2026-10-16. Applied in: this spec's Change Log (MODIFIED Requirement: No secrets or internal hosts in skill files).
- **OP-14: Documentation drift (decided).** FR-194 (`docs/requirements/FR-NFR-assist-plugin.md:4058-4077`): the release checklist in `CLAUDE.md` names every file that carries the plugin version. FR-201 (`:4252-4271`, SHOULD) covers the other three items, which began as plain fixes (FR-NFR section 9, open question 8, `:4593`): `docs/SPECIFICATION.md:292` names two of the four `technical-writing` subcommands, `MARKETPLACE.md:50` omits `check-fsa-tables.js`, and `MARKETPLACE.md:78` shows `assist-plugin--v1.1.0`-style tags where the repository's tags and `/bump` use `vX.Y.Z`. Applied in: `spec-skills-manifests-docs.md` and `spec-skills-docs-review.md` Change Logs.
- **FR-177 against FR-154 (decided).** The delta rule wins: a spec that receives a delta returns to `Review` unless the user approves the change in the same turn, and a planted line in the spec changes nothing either way (FR-154, `docs/requirements/FR-NFR-assist-plugin.md:3386-3415`, whose Status scenarios are Built through `delta-format.md:75`; FR-177, `:3833-3872`). Applied in: `spec-skills-requirements-specs.md` and `spec-skills-untrusted-input.md` Change Logs.
- **OP-15: Legacy in-place updates ask first (decided, built in 1.11.1).** `gather-requirements` keeps its grant scoped to `docs/requirements/`, so an in-place update of a legacy root-level requirements file asks the user first, and that prompt is intended (`DECISIONS.md:98-101`). FR-182 (`docs/requirements/FR-NFR-assist-plugin.md:3925-3928`) and FR-183 (`:3956-3959`) carry it; `skills/gather-requirements/SKILL.md:115` and `:117` state it. Reflected in: `spec-skills-requirements-specs.md` (Requirements output folder, Requirements write grant).
- **OP-2: Two-location `docs/tts/` exemption (decided, built in 1.11.1).** `prose-gate` and `prose-advisor` exempt `docs/tts/` under the project root and under the session's working directory when that directory is inside the project, and `/voice-script` keeps saving under the session directory (`DECISIONS.md:73-76`; FR-181, `docs/requirements/FR-NFR-assist-plugin.md:2720`). The text update is done: `skills/voice-script/SKILL.md:162`, `skills/health/SKILL.md:17`, and `docs/SPECIFICATION.md:420` name both locations (read on 2026-10-16). Reflected in: `spec-skills-deslop-voice-clarify.md`, `spec-skills-health.md`.

## Triggered by

| Trigger type | Source | Condition |
|---|---|---|
| User action | The user types `/<name> [arguments]`; the namespaced form `/assist-plugin:<name>` also works (`README.md:259` uses it for `health`) | Any of the 18 user-invocable skills |
| Model invocation | Claude Code matches a skill `description` to the request | No skill sets `disable-model-invocation: true` (all 22 frontmatter blocks read for this spec) |
| Agent preload | An agent's `skills:` frontmatter loads the skill into the subagent | The seven pairs in the preload table under Behavior |
| Maintenance | The maintainer adds, removes, or edits a skill | The checklist in `CLAUDE.md:117-133` |

## Required data

| Data | Source | Type | Notes |
|---|---|---|---|
| Skill frontmatter | `skills/<name>/SKILL.md` | YAML | `name`, `description`, `allowed-tools`, `argument-hint` (user-invocable skills), `effort`, and `user-invocable: false` (internal skills) |
| Catalog lists | `CLAUDE.md:45-77`, `plugins/assist-plugin/Claude.md:36-61`, `README.md:30-54`, `MARKETPLACE.md:12-13`, `docs/SPECIFICATION.md:187` | Markdown | Names, commands, and argument hints shown to users |
| Agent preload lists | `agents/*.md` frontmatter `skills:` | YAML | See the preload table |
| Compact writing standard | `rules/writing-standard-compact.md` | Markdown | The text of every `## Report Writing Standard` block |
| LLM security checklist | `rules/llm-security-checklist.md` | Markdown | Gate for every change to a skill file |

## Behavior

### Requirement: Skill catalog of 22 skills

The plugin SHALL ship 22 skill directories under `skills/`, 18 user-invocable (`do`, `ask`, `debug`, `bump`, `pr-review`, `commit`, `branch`, `map-project`, `technical-writing`, `review-md`, `gather-requirements`, `spec-from-requirements`, `task-plan`, `create-test`, `health`, `deslop`, `voice-script`, `clarify`) and 4 internal (`code`, `pentest`, `integrated-test`, `run-test`) that set `user-invocable: false`.

**Requirement refs:** FR-130, UR-042, UR-045, BR-010 | **Status:** Built | **Source:** `CLAUDE.md:45-77`; `skills/code/SKILL.md:7`; `skills/pentest/SKILL.md:8`; `skills/integrated-test/SKILL.md:7`; `skills/run-test/SKILL.md:6`

#### Scenario: Skill file count

- **GIVEN** the `plugins/assist-plugin/skills/` directory at commit 41034c1
- **WHEN** a test counts the files that match `*/SKILL.md`
- **THEN** the count SHALL be 22

#### Scenario: Internal skills are hidden from the user

- **GIVEN** the four internal skill files
- **WHEN** a test reads their frontmatter
- **THEN** each SHALL set `user-invocable: false`
- **AND** none of the 18 user-invocable skill files SHALL set `user-invocable: false`

#### Scenario: Catalog table matches the directory

- **GIVEN** the user-invocable and internal tables in `CLAUDE.md`
- **WHEN** a test compares their skill names with the directory names under `skills/`
- **THEN** each of the 22 names SHALL appear exactly once across the two tables

#### Scenario: Unlisted skill directory

- **GIVEN** a 23rd `SKILL.md` that no catalog table lists
- **WHEN** the test compares the count with 22
- **THEN** the test SHALL fail and name the unlisted directory

### Requirement: Agents preload the skills they apply

Each agent that applies a skill SHALL list that skill in its `skills:` frontmatter, with `disable-model-invocation` left unset in the skill.

**Requirement refs:** UR-042, FR-130, FR-167, FR-169, FR-170, FR-171 | **Status:** Built | **Source:** `CLAUDE.md:131`; agent frontmatter as cited in the table

| Agent | Preloaded skill | Evidence |
|---|---|---|
| `developer` | `code` | `agents/developer.md:8-9` |
| `qa` | `pentest`, `integrated-test`, `run-test` | `agents/qa.md:8-11` |
| `developer-tester` | `create-test` | `agents/developer-tester.md:8-9` |
| `task-planner` | `task-plan` | `agents/task-planner.md:8-9` |
| `requirements-gatherer` | `gather-requirements` | `agents/requirements-gatherer.md:8-9` |
| `intake-reviewer` | `gather-requirements` | `agents/intake-reviewer.md:8-9` |
| `solutions-architect` | `spec-from-requirements` | `agents/solutions-architect.md:8-9` |

#### Scenario: qa carries its three skills

- **GIVEN** `agents/qa.md`
- **WHEN** a test reads its `skills:` list
- **THEN** the list SHALL hold `pentest`, `integrated-test`, and `run-test`

#### Scenario: Preload entry missing

- **GIVEN** a change that removes `run-test` from `agents/qa.md`
- **WHEN** a test compares the preload table above with the agent frontmatter
- **THEN** the test SHALL fail and name `qa` and `run-test`

#### Scenario: Preloaded skill blocks model invocation

- **GIVEN** a change that sets `disable-model-invocation: true` in `skills/code/SKILL.md`
- **WHEN** the change is reviewed against `CLAUDE.md:131`
- **THEN** the reviewer SHALL return the change

### Requirement: Writing-standard block equals the compact file

Every `## Report Writing Standard` block in a skill file SHALL equal `rules/writing-standard-compact.md`.

**Requirement refs:** NFR-018, BR-008 | **Status:** Built | **Source:** `CLAUDE.md:129`; `rules/writing-standard.md:13`; Area B FR-123 and FR-124 own the sync script

#### Scenario: Blocks in sync

- **GIVEN** the skill files at commit 41034c1
- **WHEN** `node plugins/assist-plugin/scripts/sync-writing-standard.js --check` runs
- **THEN** it SHALL exit 0

#### Scenario: Block edited by hand

- **GIVEN** one bullet of the block in `skills/ask/SKILL.md` was reworded by hand
- **WHEN** the same check runs
- **THEN** it SHALL exit 1
- **AND** file-specific guidance SHALL move to another section of that file, because `rules/writing-standard.md:13` forbids hand edits to the block

### Requirement: Prose that skills write meets the block tier

Prose that a skill writes to a prose file SHALL contain no em dash, curly quote, chatbot residue, or summary label outside the exempt regions.

**Requirement refs:** NFR-019, BR-008 | **Status:** Built | **Source:** `rules/writing-standard.md:101-110`; Area B FR-103 and FR-105 own the gate and its exemptions

#### Scenario: Clean findings file

- **GIVEN** `review-md` writes `report.review.md` with no block-tier tell
- **WHEN** `prose-gate` evaluates the write
- **THEN** the write SHALL proceed

#### Scenario: Em dash in a finding

- **GIVEN** a skill drafts a finding that joins two clauses with an em dash
- **WHEN** it writes the finding to a `.md` file
- **THEN** `prose-gate` SHALL deny the write
- **AND** the skill SHALL rewrite the clause with a colon, period, comma, parentheses, or semicolon before it writes again

#### Scenario: Voice script pause marks

- **GIVEN** a `voice-script` file whose fenced `text` block holds em dashes as pause marks
- **WHEN** `prose-gate` evaluates the write
- **THEN** the write SHALL proceed, because a code fence is an exempt region (FR-105)

### Requirement: Scoped write grants for the document and log skills

The skills `gather-requirements`, `spec-from-requirements`, `task-plan`, `technical-writing`, `voice-script`, and `clarify` SHALL pre-approve edits only to their documented output paths.

**Requirement refs:** NFR-013, BR-006, UR-019, FR-146, FR-152, FR-156, FR-158, FR-163, FR-165, FR-183, FR-185 | **Status:** Built (1.11.1); PLANNED (1.12.0): NFR-013 restated for every skill with twelve listed exceptions (Change Log 2026-10-16) | **Source:** as cited in the table; `docs/requirements/FR-NFR-assist-plugin.md:4347`; `DECISIONS.md` (2026-10-12: Scoped write grants for document skills; clarify tool grants; voice-script tool grants; 2026-10-16, `DECISIONS.md:78-86`: requirements in `docs/requirements/`, task plans in `docs/task-plans/`; `DECISIONS.md:93-96`: both folders resolve against the session's git root)

| Skill | `allowed-tools` write grants at 1.11.1 | Grant at 4803a0d, where it differs | Evidence |
|---|---|---|---|
| `gather-requirements` | `Edit(./docs/requirements/BRD-*.md)`, `Edit(./docs/requirements/URD-*.md)`, `Edit(./docs/requirements/FR-NFR-*.md)`, `Edit(./docs/requirements/requirements-*.json)` (FR-183) | `./BRD-*.md`, `./URD-*.md`, `./FR-NFR-*.md`, `./requirements-*.json` | `skills/gather-requirements/SKILL.md:13-16`, `:117`; `docs/requirements/FR-NFR-assist-plugin.md:3932` |
| `spec-from-requirements` | `Edit(./specs/spec-*.md)`, `Edit(./specs/spec-*.json)`, `Edit(./specs/openapi/*.json)`, `Edit(./specs/openapi/*.yaml)`, `Edit(./*/specs/spec-*.md)`, `Edit(./*/specs/spec-*.json)` | Same | `skills/spec-from-requirements/SKILL.md:13-18`, `:68` |
| `task-plan` | `Edit(./docs/task-plans/task-plan-*.md)` (FR-185) | `./task-plan-*.md` | `skills/task-plan/SKILL.md:12`, `:26`; `docs/requirements/FR-NFR-assist-plugin.md:3994` |
| `technical-writing` | `Edit(./README.md)` | Same | `skills/technical-writing/SKILL.md:11`, `:83` |
| `voice-script` | `Edit(./docs/tts/voice-*.md)` | Same | `skills/voice-script/SKILL.md:14`, `:166` |
| `clarify` | `Edit(./.agent/clarify/clarify-*.md)` | Same | `skills/clarify/SKILL.md:14`, `:60` |

An `Edit(path)` rule covers both Edit and Write calls on that path (`skills/clarify/SKILL.md:60`, `skills/voice-script/SKILL.md:166`). A write to any other path goes through Claude Code's permission prompt. Since 1.11.1 (FR-183, FR-185 built), a root-level `BRD-*.md` or `task-plan-*.md` write prompts. Every `./` grant is relative to the session's working directory, while the output folders resolve against the session's git root, so a session started in a subdirectory gets a write prompt for those folders; the user decided that this prompt is intended (`DECISIONS.md:95`). An in-place update of a legacy root-level requirements file also asks first, because the grant stays scoped to `docs/requirements/`; that prompt is intended too (`DECISIONS.md:100`). The scenarios for these grants are in `spec-skills-requirements-specs.md` and `spec-skills-plan-test.md`.

#### Scenario: Write inside the grant

- **GIVEN** `/spec-from-requirements create` in a session whose working directory is the repository root
- **WHEN** the skill writes `specs/spec-auth.md`
- **THEN** Claude Code SHALL perform the write without a permission prompt

#### Scenario: Write outside the grant

- **GIVEN** `task-plan` needs to write `notes/plan.md`
- **WHEN** the skill writes
- **THEN** Claude Code SHALL ask the user first, because the grant covers only the documented task-plan path (`./docs/task-plans/task-plan-*.md` since FR-185; `./task-plan-*.md` at 4803a0d)

#### Scenario: Clarify stays in its log

- **GIVEN** the `clarify` skill finishes a run
- **WHEN** the files it wrote are listed
- **THEN** the list SHALL hold only `.agent/clarify/clarify-YYYYMMDD.md`
- **AND** it SHALL hold no `/do` plan file and no `DECISIONS.md`

### Requirement: LLM security gate on skill changes

A change to `skills/**/SKILL.md` or `skills/**/references/*.md` SHALL carry the signature `✓ LLM Security Clear` before merge, with no fast-track path.

**Requirement refs:** NFR-011, BR-005 | **Status:** Built (1.11.1); PLANNED (1.12.0): the `skills/**` trigger (Change Log 2026-10-16) | **Source:** `rules/llm-security-checklist.md:11-15`, `:304-306`; `CLAUDE.md:114`; Area A FR-061 owns the gate

This requirement keeps the 1.11.1 wording of NFR-011. OP-1 is decided: the gate covers every file under `skills/**`, nested reference files and `metadata.json` included, with `skills/` anchored at the repository root, under any `plugins/<name>/`, or under `.claude/` (`DECISIONS.md:168-171`), and also any `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md` at any depth (`DECISIONS.md:173-176`); the Change Log at the end of this spec carries the widened requirement. The scenarios below use files that both forms cover.

#### Scenario: Wording-only change

- **GIVEN** a change that edits only wording in `skills/commit/SKILL.md`
- **WHEN** the plan chooses a review path
- **THEN** the change SHALL receive the LLM gate and SHALL NOT be fast-tracked

#### Scenario: Signature missing

- **GIVEN** a change to `skills/voice-script/SKILL.md` without `✓ LLM Security Clear`
- **WHEN** the merge policy is checked
- **THEN** the merge SHALL be blocked

### Requirement: No secrets or internal hosts in skill files

No skill file SHALL contain a hardcoded token, API key, or internal hostname.

**Requirement refs:** NFR-015, BR-006 | **Status:** Built (1.11.1); PLANNED (1.12.0): the host and credential pattern and the placeholder names (Change Log 2026-10-16) | **Source:** `rules/llm-security-checklist.md` (LLM02, LLM07)

OP-13 is decided: NFR-015 now names the pattern and the placeholder forms, and the Change Log at the end of this spec carries the revised requirement and the 14 current hits. The scenarios below assert nothing about placeholders.

#### Scenario: Clean scan

- **GIVEN** every file under `skills/`
- **WHEN** a reviewer scans for real tokens, API keys, and internal hostnames
- **THEN** the scan SHALL report 0 occurrences

#### Scenario: Key pasted into a reference

- **GIVEN** a change that adds a literal API key to `skills/debug/references/analyze.md`
- **WHEN** the LLM gate reviews it
- **THEN** the reviewer SHALL return the change and name the line

### Requirement: Token budget for a new skill

A new skill SHOULD add fewer than 50 tokens to the always-loaded plugin text.

**Requirement refs:** NFR-004, BR-003 | **Status:** Built; PLANNED (1.12.0): the counted text and the estimate method (Change Log 2026-10-16) | **Source:** `docs/TOKEN_OPTIMIZATION.md` (Future Extensions); `docs/requirements/FR-NFR-assist-plugin.md:4288`

At 1.11.1 NFR-004 named no counted text and no method. OP-5 is decided as this spec proposed: the counted text is the new skill's frontmatter `description` plus its `argument-hint`, and the token figure is that text's character count divided by 4, reported as an estimate; NFR-004 now states both, and the Change Log carries the revised requirement. The scenarios use this method.

#### Scenario: Small description

- **GIVEN** a proposed skill whose `description` and `argument-hint` total 160 characters (an estimated 40 tokens at 4 characters per token)
- **WHEN** the reviewer checks the change
- **THEN** the change SHALL pass this check

#### Scenario: Over the budget

- **GIVEN** a proposed skill whose `description` and `argument-hint` total 320 characters (an estimated 80 tokens at 4 characters per token)
- **WHEN** the reviewer checks the change
- **THEN** the reviewer SHALL require a documented reason for the deviation, as `SHOULD` demands (`skills/gather-requirements/SKILL.md:81`), before approving it

## Algorithmic steps

Adding or removing a skill, in this order (`CLAUDE.md:117-133`):

1. Create or delete `skills/<name>/SKILL.md`. A new file carries `name`, `description`, `allowed-tools`, and `effort`, plus `argument-hint` for a user-invocable skill or `user-invocable: false` for an internal one. From 1.12.0 a `metadata.json` beside it mirrors those frontmatter values (FR-193, PLANNED; `spec-skills-manifests-docs.md` Change Log).
2. Grant writes by path (`Edit(./<glob>)`) when the skill writes a known output, as the six skills under the scoped-grant requirement do.
3. When an agent applies the skill, add it to that agent's `skills:` frontmatter and leave `disable-model-invocation` unset.
4. Run `node plugins/assist-plugin/scripts/sync-writing-standard.js` to write the `## Report Writing Standard` block; never type it by hand.
5. Update the counts and lists in the eight files that `spec-skills-manifests-docs.md` names.
6. Run `sync-writing-standard.js --check`, and `check-fsa-tables.js --check` when a `## States` table changed.
7. Pass the LLM security gate; then release with equal versions in both manifests (from 1.12.0, in every file the release checklist names, FR-194, PLANNED).

```mermaid
flowchart LR
  User(["User types /name args"])
  subgraph UI["User-invocable skills (18)"]
    Do["do (Area A)"]
    Ask["ask"]
    Dbg["debug"]
    Git["commit, bump, branch"]
    PR["pr-review"]
    Docs["map-project, technical-writing"]
    RMD["review-md"]
    Chain["gather-requirements, spec-from-requirements, task-plan, create-test"]
    Prose["deslop, voice-script, clarify"]
    Health["health"]
  end
  subgraph INT["Internal skills (4), user-invocable: false"]
    Code["code"]
    QA3["pentest, integrated-test, run-test"]
  end
  User --> UI
  ChainAgents["requirements-gatherer, intake-reviewer, solutions-architect, task-planner, developer-tester"] -->|"skills: frontmatter"| Chain
  Dev["developer agent"] -->|"skills: frontmatter"| Code
  QA["qa agent"] -->|"skills: frontmatter"| QA3
  Ask -->|"states the call; FR-148 caller"| RMD
  Do -->|"Report Quality Gate; FR-148 caller"| RMD
  Dbg -.->|"listed only in review-md SKILL.md:31; dropped by FR-148, PLANNED 1.12.0"| RMD
  Git -.->|"listed only in review-md SKILL.md:31; dropped, PLANNED 1.12.0"| RMD
  PR -.->|"listed only in review-md SKILL.md:31; dropped, PLANNED 1.12.0"| RMD
  Docs -.->|"listed only in review-md SKILL.md:31; dropped, PLANNED 1.12.0"| RMD
```

The two solid edges into `review-md` are the callers that FR-148 names and that state the call in their own files (`skills/ask/SKILL.md:40`, `:52`; `skills/do/references/review-protocol.md:195-220`). The four dotted edges come only from the caller list in `skills/review-md/SKILL.md:31` at 1.11.1; OP-3 is decided, and that list narrows to `ask` and `do` in 1.12.0 (`spec-skills-docs-review.md`, Change Log 2026-10-16).

**Note:** PNG rendering requires mermaid-cli and its headless browser. `mmdc` is installed in this environment, but `mmdc -i specs/spec-skills-catalog.mmd -o specs/spec-skills-catalog.png` failed on 2026-10-14 and again on 2026-10-16 (twice, the second time during this delta pass) with "Could not find chrome-headless-shell (ver. 154.0.8037.57)". Rendering is skipped for every diagram in this spec family. The `.mmd` source for each diagram sits next to the spec under `specs/` and matches the inline block. To render, install the browser yourself (the error names `npx puppeteer browsers install chrome-headless-shell`; the agent does not run it), then run, for example:

```bash
mmdc -i specs/spec-skills-catalog.mmd -o specs/spec-skills-catalog.png
```

Or use [Mermaid Live Editor](https://mermaid.live) to render online.

## Output / Outcome

| Output | Type | Description |
|---|---|---|
| 22 skill directories | Artifact | `skills/<name>/SKILL.md` plus `references/` |
| Catalog lists | Documentation | Counts and lists in eight files equal to the agent and skill files in the repository (`spec-skills-manifests-docs.md`) |
| Files each skill writes | State change | Summarized below; each child spec gives paths and conditions |

"Listed exception" in the table below means one of the twelve unscoped grant sets that NFR-013 accepts (OP-6, decided; the restated requirement is PLANNED (1.12.0) in the Change Log). A listed exception runs without a prompt, and in a main-session run no hook limits its writes (FR-113).

| Skill | Writes | Write-related grants in `allowed-tools` |
|---|---|---|
| `ask` | Nothing | Read, Grep, Glob, WebSearch, WebFetch (`skills/ask/SKILL.md:8-13`) |
| `debug` | Source edits during `fix` | Read, Grep, Glob, Bash, LSP (`skills/debug/SKILL.md:6-11`). No Write or Edit grant, so Write and Edit calls prompt; Bash is unscoped and runs without a prompt (listed exception) |
| `commit` | A git commit | Bash, unscoped (`skills/commit/SKILL.md:7-8`; listed exception) |
| `bump` | Version files, `CHANGELOG.md`, commit, tag | Write, Edit, and Bash, all unscoped (`skills/bump/SKILL.md:8-14`; listed exception) |
| `branch` | Worktree removals, branch deletions, Go build cache | `Bash(git:*)` (listed exception), `Bash(df:*)` and `Bash(realpath:*)` (read-only fixed programs, scoped), `Bash(go clean:*)` (program-and-subcommand prefix, scoped) (`skills/branch/SKILL.md:8-12`) |
| `pr-review` | A temp file and the posted review | Write and Bash, unscoped (`skills/pr-review/SKILL.md:8-14`; listed exception) |
| `map-project` | `PROJECT_MAP.md` after approval | Read, Glob, Bash (`skills/map-project/SKILL.md:7-10`). No Write or Edit grant, so Write and Edit calls prompt; Bash is unscoped and runs without a prompt (listed exception) |
| `technical-writing` | `README.md`; other docs prompt | `Edit(./README.md)` |
| `review-md` | `<report-name>.review.md` | Write, unscoped (`skills/review-md/SKILL.md:7-11`; listed exception) |
| `gather-requirements` | `BRD-*.md`, `URD-*.md`, `FR-NFR-*.md`, `requirements-*.json` in `docs/requirements/` under the session's git root (FR-182, built in 1.11.1; the working directory at 4803a0d) | Scoped (table above) |
| `spec-from-requirements` | `specs/spec-*` files | Scoped (table above) |
| `task-plan` | `task-plan-*.md` in `docs/task-plans/` under the session's git root (FR-184, built in 1.11.1; the working directory root at 4803a0d) | Scoped (table above) |
| `create-test` | Test files | Write, unscoped (`skills/create-test/SKILL.md:8-12`; listed exception); the test-path bar applies only when `developer-tester` runs it (Area B FR-108) |
| `health` | Truncates `hook-health.jsonl` only with `--clear`, through the script | Two exact Bash forms and Read (`skills/health/SKILL.md:8-11`) |
| `deslop` | The named prose file in `edit` mode | No Edit grant, so each change prompts (`skills/deslop/SKILL.md:7-10`, `:27`) |
| `voice-script` | `docs/tts/voice-*.md` | Scoped (table above) |
| `clarify` | `.agent/clarify/clarify-*.md` | Scoped (table above) |
| `code` | Source files the developer edits | Write and Edit, unscoped (`skills/code/SKILL.md:8-13`; listed exception) |
| `pentest` | Nothing; reports in the reply | Exact audit commands plus `Bash(govulncheck *)`, a read-only fixed program, so all scoped (`skills/pentest/SKILL.md:10-41`) |
| `integrated-test` | Test files | Write and Edit, unscoped (`skills/integrated-test/SKILL.md:9-14`; listed exception) |
| `run-test` | Test report, `coverage/` | Write, unscoped (`skills/run-test/SKILL.md:8-12`; listed exception) |
| `do` | Plan files, `DECISIONS.md` | Edit, Write, and Bash, unscoped (`skills/do/SKILL.md:13-22`; listed exception); behavior in Area A |

## Error handling

| Error condition | Handling strategy | Outcome |
|---|---|---|
| Skill count or list drift | The counts checklist and a directory comparison test catch it | The test names the stale file or directory; the release waits |
| Writing-standard block drift | `sync-writing-standard.js --check` exits 1 | The maintainer runs the script without `--check` |
| Preload entry missing | Comparison of agent frontmatter with the preload table | The test names the agent and skill |
| Write outside a scoped grant | Claude Code's permission prompt | The user allows or denies the write; nothing is written silently |
| Block-tier tell in skill prose | `prose-gate` denies the write (FR-103) | The skill rewrites and writes again |
| Skill change without the LLM signature | Merge policy (FR-061) | The merge stays blocked |
| Secret or internal host in a skill file | LLM gate review | The change is returned with the line |

## Events emitted (if applicable)

Not applicable: skills emit no events. Files and commands each skill produces are listed under Output and in the child specs.

## Dependencies

| Dependency | Type | Required | Notes |
|---|---|---|---|
| Claude Code skill loader | Runtime | yes | Reads frontmatter, applies `allowed-tools` as permission rules, hides `user-invocable: false` skills |
| `scripts/sync-writing-standard.js` | Build-time | yes | Area B FR-123, FR-124 |
| `prose-gate`, `prose-advisor`, `writing-context` hooks | Runtime | no (fail open) | Area B FR-103 to FR-107 |
| `/do` Report Quality Gate and gate selection | Runtime | no | Area A FR-054; applies when skills run under `/do` |
| LLM security gate | Process | yes | Area A FR-061; `/do` runs it as the named OWASP for LLM Gate under FR-199 (Area A, PLANNED 1.12.0); `rules/llm-security-checklist.md` |

## Sub-feature breakdown (if applicable)

| Sub-feature | Spec file | Description |
|---|---|---|
| Question and diagnosis skills | spec-skills-ask-debug.md | `/ask` and `/debug` (FR-131 to FR-134) |
| Git workflow skills | spec-skills-git.md | `/commit`, `/bump`, `/branch` (FR-135 to FR-141; PLANNED (1.12.0) FR-196, FR-200 and changes to FR-136 to FR-139) |
| Pull request review | spec-skills-pr-review.md | `/pr-review` (FR-142 to FR-144; PLANNED (1.12.0) a change to FR-143 and the skill-text part of FR-195, whose `/do` flow covers `github.com` remotes only, Change Log 2026-10-17) |
| Mapping, documentation, and report review | spec-skills-docs-review.md | `/map-project`, `/technical-writing`, `/review-md` (FR-145 to FR-148; PLANNED (1.12.0) changes to FR-147, FR-148) |
| Requirements and specs | spec-skills-requirements-specs.md | `/gather-requirements`, `/spec-from-requirements` (FR-149 to FR-156, FR-179, FR-182, FR-183, the FR-154 Status scenarios built in 1.11.1; PLANNED (1.12.0) FR-197) |
| Task plans and black-box tests | spec-skills-plan-test.md | `/task-plan`, `/create-test` (FR-157 to FR-160, FR-184, FR-185) |
| Prose cleanup, voice scripts, clarification | spec-skills-deslop-voice-clarify.md | `/deslop`, `/voice-script`, `/clarify` (FR-161 to FR-165) |
| Hook health | spec-skills-health.md | `/health` (FR-166; PLANNED (1.12.0) the failed writing-context self-test finding, with Area B FR-118) |
| Internal skills | spec-skills-internal.md | `code`, `pentest`, `integrated-test`, `run-test`, traceability markers (FR-167 to FR-171) |
| Manifests and repository documents | spec-skills-manifests-docs.md | Marketplace identity, versions, counts, install docs, self-hosted documents, changelog pointer (FR-172 to FR-174, FR-178; PLANNED (1.12.0) FR-193, FR-194, FR-201 and a change to NFR-020) |
| Untrusted-input rule | spec-skills-untrusted-input.md | `requirements-gatherer`, `gather-requirements`, `spec-from-requirements` (FR-175 to FR-177, built in 1.11.1; PLANNED (1.12.0) the numbering rule and the FR-177 Status scenarios) |

## Submodule scope (if applicable)

Not applicable: the repository has no submodules; every skill lives under `plugins/assist-plugin/skills/`.

## Traceability

| Requirement | Spec section | Verified by |
|---|---|---|
| FR-130 | Requirement: Skill catalog of 22 skills; Requirement: Agents preload the skills they apply | File count of `skills/*/SKILL.md`; frontmatter read of the four internal skills; comparison with `CLAUDE.md:45-77` |
| UR-042 | Requirement: Agents preload the skills they apply | Agent frontmatter read against the preload table |
| UR-045 | Requirement: Skill catalog of 22 skills | Catalog table comparison test |
| NFR-018 | Requirement: Writing-standard block equals the compact file | `sync-writing-standard.js --check` exit code |
| NFR-019 | Requirement: Prose that skills write meets the block tier | `prose-gate` on skill-written files |
| NFR-013 | Requirement: Scoped write grants for the document and log skills | Frontmatter read of six skills; out-of-grant write prompts in a manual run |
| FR-183, FR-185, UR-019 | Requirement: Scoped write grants for the document and log skills (1.11.1 grant column) | Frontmatter read of `gather-requirements` and `task-plan`; scenarios in `spec-skills-requirements-specs.md` and `spec-skills-plan-test.md` |
| NFR-011 | Requirement: LLM security gate on skill changes; Change Log 2026-10-16 (MODIFIED) | Merge record shows `✓ LLM Security Clear`; after 1.12.0, a change to a nested reference file, a `metadata.json`, a `.claude/skills/` file, or an `AGENTS.md` at any depth also carries it, and a change to `src/skills/parser.ts` does not need it |
| NFR-015 | Requirement: No secrets or internal hosts in skill files; Change Log 2026-10-16 (MODIFIED) | Pattern scan of `skills/` for `.company.com`, `.internal` (other than `host.docker.internal`), and non-placeholder `-u` and `--user` values in the `x:y` form and `://x:y@` userinfo: 14 hits at 1.11.1, 0 after the fix; `-u zap` at `skills/pentest/references/zap.md:123` is not a hit |
| NFR-004 | Requirement: Token budget for a new skill; Change Log 2026-10-16 (MODIFIED) | Character count of the new skill's `description` plus `argument-hint`, divided by 4 and reported as an estimate |
| NFR-013 | Change Log 2026-10-16 (MODIFIED Requirement: Scoped write grants for the document and log skills) | Frontmatter read of all 22 skills against the scoped-grant definition and the twelve listed exceptions |
| BR-003, BR-005, BR-006, BR-008, BR-010, BR-016 | Requirements above, by their refs | As listed per requirement |

## Change Log: 2026-10-16

**Source:** `docs/requirements/FR-NFR-assist-plugin.md` version 1.1 (2026-10-16, final and approved, re-read for fix pass 1; cites checked against the current file on 2026-10-17): NFR-004 (`:4288`), NFR-011 (`:4345`), NFR-013 (`:4347`), and NFR-015 (`:4349`) revised, PLANNED (1.12.0); `DECISIONS.md:108-111`, `:158-161`, `:163-166`, `:168-171`, `:173-176`, `:193-196`; the answers to OP-1, OP-5, OP-6, and OP-13 under User Decisions in `.agent/main-plan/plan-deferred-decisions-20261016-1059.md`. The catalog diagram change follows FR-148 (`spec-skills-docs-review.md`).

Every change in this entry is PLANNED (1.12.0). This spec received a delta, so its Status returns to `Review` (FR-154; `skills/spec-from-requirements/references/delta-format.md:75`).

### MODIFIED Requirements

#### Requirement: LLM security gate on skill changes

**Was:** A change to `skills/**/SKILL.md` or `skills/**/references/*.md` SHALL carry the signature `✓ LLM Security Clear` before merge, with no fast-track path.
**Now:** A change to any file under a `skills/` folder at the repository root, under any `plugins/<name>/`, or under `.claude/` (`SKILL.md`, reference files at any depth, and `metadata.json`), or to any `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md` at any depth, SHALL carry the signature `✓ LLM Security Clear` before merge, with no fast-track path; other files in a `skills/` folder elsewhere, such as one inside an application's `src/`, do not trigger it.
**Reason:** NFR-011 widened to every file under `skills/**` (OP-1, `DECISIONS.md:108-111`), anchored to the root, `plugins/<name>/`, and `.claude/` (`DECISIONS.md:168-171`), and extended to the auto-loaded instruction files at any depth (`DECISIONS.md:173-176`).
**Requirement refs:** NFR-011, FR-061, FR-193, FR-199, BR-005 | **Status:** PLANNED (1.12.0) | **Source:** `docs/requirements/FR-NFR-assist-plugin.md:4345`; FR-061 (`:1304-1348`); `rules/llm-security-checklist.md:11-12` (narrow trigger at 1.11.1), `:304-306` and `CLAUDE.md:114` (already all of `skills/`)

NFR-011 states one path set for the whole LLM surface (`agents/`, `skills/`, `rules/`, and `hooks/` with the three anchors, any `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md` at any depth, and `.claude/settings*.json`); this requirement holds its skill-file part plus the instruction files that can sit inside a skill folder, and Area A FR-061 and FR-199 hold the rest and the named `/do` gate. NFR-011 names `src/hooks/` as the application-folder example; the `src/skills/` scenarios below apply the same anchor rule to skill folders.

##### Scenario: Nested reference file

- **GIVEN** a change to `plugins/assist-plugin/skills/code/references/languages/go.md`, one directory below `references/`
- **WHEN** the merge policy is checked
- **THEN** the merge SHALL be blocked until `✓ LLM Security Clear` is recorded

##### Scenario: Metadata file only

- **GIVEN** a change to `plugins/assist-plugin/skills/commit/metadata.json` and no other file
- **WHEN** the plan chooses a review path
- **THEN** the change SHALL receive the LLM gate and SHALL NOT be fast-tracked

##### Scenario: Project skill under .claude

- **GIVEN** a change to `.claude/skills/release/SKILL.md` in a project
- **WHEN** the merge policy is checked
- **THEN** the merge SHALL be blocked until `✓ LLM Security Clear` is recorded

##### Scenario: Application folder named skills

- **GIVEN** a change to `src/skills/parser.ts` in an application, a folder outside the three anchors
- **WHEN** the plan chooses a review path
- **THEN** this requirement SHALL NOT demand `✓ LLM Security Clear`

##### Scenario: Instruction file inside an application folder

- **GIVEN** a change to `src/skills/AGENTS.md` in the same application
- **WHEN** the merge policy is checked
- **THEN** the merge SHALL be blocked until `✓ LLM Security Clear` is recorded, because an `AGENTS.md` at any depth is on the LLM surface

##### Scenario: Checklist trigger names the wide glob

- **GIVEN** `rules/llm-security-checklist.md` after the change
- **WHEN** a test reads the "When triggered" line (line 11 at 1.11.1)
- **THEN** it SHALL name every file under `skills/` with the three anchors and SHALL NOT name `skills/**/SKILL.md` and `skills/**/references/*.md` as the only skill globs

##### Scenario: File outside the plugin surface

- **GIVEN** a change to `specs/spec-skills.md` only
- **WHEN** the plan chooses a review path
- **THEN** this requirement SHALL NOT demand `✓ LLM Security Clear`, because the file is outside `skills/`

#### Requirement: Token budget for a new skill

**Was:** A new skill SHOULD add fewer than 50 tokens to the always-loaded plugin text (counted text and method proposed by this spec, pending OP-5).
**Now:** A new skill SHOULD add fewer than 50 tokens to the always-loaded plugin text, counting its frontmatter `description` plus its `argument-hint` and estimating tokens as the character count divided by 4.
**Reason:** NFR-004 names the counted text and the method (OP-5).
**Requirement refs:** NFR-004, BR-003 | **Status:** PLANNED (1.12.0) for the method | **Source:** `docs/requirements/FR-NFR-assist-plugin.md:4288`, `:4297-4305`

The figure is an estimate, not a measurement, and every report of it says so. Under 50 tokens means under about 200 characters.

##### Scenario: Within the budget

- **GIVEN** a new skill whose `description` and `argument-hint` together hold 180 characters
- **WHEN** a reviewer applies the budget
- **THEN** the reviewer SHALL report about 45 tokens (180 divided by 4, labeled an estimate) and SHALL pass the check

##### Scenario: Over the budget

- **GIVEN** a new skill whose `description` and `argument-hint` together hold 320 characters
- **WHEN** a reviewer applies the budget
- **THEN** the reviewer SHALL report about 80 tokens, flag the skill as over the 50-token budget, and require a documented reason before approving it, as `SHOULD` demands (`skills/gather-requirements/SKILL.md:81`)

##### Scenario: Estimate reported as a measurement

- **GIVEN** a review note that states "45 tokens" with no estimate label
- **WHEN** the LLM gate reviews the change
- **THEN** the reviewer SHALL return the note and ask for the estimate label

#### Requirement: No secrets or internal hosts in skill files

**Was:** No skill file SHALL contain a hardcoded token, API key, or internal hostname.
**Now:** No skill file SHALL contain a hardcoded token, an API key, a host ending in `.company.com` or `.internal` (other than `host.docker.internal`), or a `user:password`-style credential (a `-u` or `--user` value in the `x:y` form, or URL userinfo of the form `://x:y@`, whose parts are not `<...>` placeholders; `host:port` is not a credential); example hosts use `example.com`-style names and example credentials use `<user>:<token>` placeholders.
**Reason:** NFR-015 sets the pattern, the credential forms, and the placeholder forms (OP-13; `DECISIONS.md:193-196` for database URLs built from variables).
**Requirement refs:** NFR-015, BR-006 | **Status:** PLANNED (1.12.0) | **Source:** `docs/requirements/FR-NFR-assist-plugin.md:4349`, `:4392-4410`

NFR-015 also covers agent files; this spec holds the skill-file part. The 14 hits at 1.11.1, each re-read on 2026-10-16: `skills/pr-review/references/pr-detection.md:23`, `:24` (`github.company.com`), `:52`, `:58`, `:59`, `:111`, `:168`, `:224` (`bitbucket.company.com`), `:53` (`bitbucket.internal`), `:227` (`curl -u username:password` against `bitbucket.company.com`), `:258` (`github.company.com`), `:262` (`bitbucket.internal`, `jumphost.company.com`), `skills/pr-review/SKILL.md:60` (`bitbucket.company.com`), and `skills/integrated-test/references/integration-patterns/go.md:65` (userinfo `postgres:test` in `postgres://postgres:test@%s:%s/testdb`). Two non-hits stay: `host.docker.internal` at `skills/pentest/references/zap.md:255` is a Docker name, and `-u zap` at `skills/pentest/references/zap.md:123` (`docker run -d --name zap -u zap ...`) is a container user with no colon, so it is not a `user:password` value. A `host:port` such as `localhost:7990` is not a credential either. Reading a `-u` or `--user` value as a credential only in the `x:y` form follows NFR-015's "`user:password`-style" wording.

##### Scenario: Credential forms

- **GIVEN** skill reference files that show `curl -u <user>:<token> https://bitbucket.example.com`, `https://<user>:<token>@bitbucket.example.com`, `https://admin:hunter2@bitbucket.example.com`, `curl --user admin:hunter2 https://bitbucket.example.com`, `localhost:7990`, and `docker run -u zap`
- **WHEN** a reviewer scans the files under NFR-015
- **THEN** the scan SHALL pass the first two, the fifth, and the sixth, and SHALL flag the third and the fourth

##### Scenario: Database URL built from variables

- **GIVEN** `skills/integrated-test/references/integration-patterns/go.md` after the change, whose DSN takes its user and password from the container's variables
- **WHEN** a reviewer scans the file under NFR-015
- **THEN** the scan SHALL find no literal `user:password` userinfo in the DSN line

##### Scenario: Placeholder host and credential

- **GIVEN** a skill reference file that shows `curl -u <user>:<token> https://bitbucket.example.com/rest/api/1.0/`
- **WHEN** a reviewer scans the file under NFR-015
- **THEN** the scan SHALL pass the host and the credential as placeholders

##### Scenario: Company-style host

- **GIVEN** a skill reference file that shows `curl -u username:password https://bitbucket.company.com/rest/api/1.0/`
- **WHEN** a reviewer scans the file under NFR-015
- **THEN** the scan SHALL flag the host and the credential and name the line

##### Scenario: Docker host name

- **GIVEN** `skills/pentest/references/zap.md` with `host.docker.internal`
- **WHEN** a reviewer scans the file under NFR-015
- **THEN** the scan SHALL NOT flag it

##### Scenario: Tree after the fix

- **GIVEN** every file under `skills/` after the 1.12.0 change
- **WHEN** a test searches for hosts ending in `.company.com` or `.internal` (other than `host.docker.internal`), for `-u` and `--user` values in the `x:y` form, and for `://x:y@` userinfo, each without `<...>` placeholders
- **THEN** the search SHALL report 0 hits, where it reports the 14 hits above at 1.11.1, and SHALL NOT count `-u zap` at `skills/pentest/references/zap.md:123`

#### Requirement: Scoped write grants for the document and log skills

**Was:** The skills `gather-requirements`, `spec-from-requirements`, `task-plan`, `technical-writing`, `voice-script`, and `clarify` SHALL pre-approve edits only to their documented output paths.
**Now:** Every skill SHALL pre-approve only scoped grants for its documented output paths and commands, except the twelve listed exceptions; a scoped grant is a path pattern for Write and Edit, and a fixed command, a fixed program-and-subcommand prefix, or a fixed program that only reads (with no subcommand) for Bash.
**Reason:** NFR-013 restated for every skill, with the unscoped grants recorded as accepted exceptions (OP-6; `DECISIONS.md:158-161`, `:163-166`).
**Requirement refs:** NFR-013, BR-006, UR-019, FR-146, FR-152, FR-156, FR-158, FR-163, FR-165, FR-183, FR-185 | **Status:** PLANNED (1.12.0) for the restatement and the list; the six scoped grants above are Built | **Source:** `docs/requirements/FR-NFR-assist-plugin.md:4347`, `:4357-4380`

The six document and log skills keep the scoped grants in the table under the body requirement. The twelve listed exceptions, each read on 2026-10-16:

| # | Skill | Unscoped grants | Evidence |
|---|---|---|---|
| 1 | `bump` | Write, Edit, Bash | `skills/bump/SKILL.md:8-14` |
| 2 | `code` | Write, Edit | `skills/code/SKILL.md:8-13` |
| 3 | `integrated-test` | Write, Edit | `skills/integrated-test/SKILL.md:9-14` |
| 4 | `pr-review` | Write, Bash | `skills/pr-review/SKILL.md:8-14` |
| 5 | `review-md` | Write | `skills/review-md/SKILL.md:7-11` |
| 6 | `create-test` | Write | `skills/create-test/SKILL.md:8-12` |
| 7 | `run-test` | Write | `skills/run-test/SKILL.md:8-12` |
| 8 | `debug` | Bash | `skills/debug/SKILL.md:6-11` |
| 9 | `map-project` | Bash | `skills/map-project/SKILL.md:7-10` |
| 10 | `commit` | Bash | `skills/commit/SKILL.md:7-8` |
| 11 | `do` | Edit, Write, Bash | `skills/do/SKILL.md:13-22` |
| 12 | `branch` | `Bash(git:*)`: a program prefix with any subcommand | `skills/branch/SKILL.md:9` |

Scoped under the read-only fixed-program rule, and so not exceptions: `branch` `Bash(df:*)` (`skills/branch/SKILL.md:10`) and `Bash(realpath:*)` (`:12`), and `pentest` `Bash(govulncheck *)` (`skills/pentest/SKILL.md:30`).

##### Scenario: Accepted unscoped grant

- **GIVEN** `bump` holds Write, Edit, and Bash without a path or command pattern
- **WHEN** `/bump` writes `package.json`
- **THEN** the write SHALL run without a prompt, and a reviewer SHALL NOT flag the grant, because it is listed exception 1

##### Scenario: Unscoped grant not on the list

- **GIVEN** a skill outside the twelve listed exceptions gains an unscoped Write grant
- **WHEN** a reviewer compares the skill with NFR-013
- **THEN** the reviewer SHALL flag the grant

##### Scenario: Bash grant shapes

- **GIVEN** a skill grants `Bash(git status)`, another grants `Bash(npm test:*)`, and a third outside the exceptions grants `Bash(git:*)`
- **WHEN** a reviewer compares each with NFR-013
- **THEN** the reviewer SHALL pass the first (a fixed command) and the second (a fixed program-and-subcommand prefix), and SHALL flag the third, while `branch` keeps `Bash(git:*)` as listed exception 12

##### Scenario: Read-only fixed program

- **GIVEN** `branch` grants `Bash(df:*)` and `Bash(realpath:*)`, and `pentest` grants `Bash(govulncheck *)`
- **WHEN** a reviewer compares each with NFR-013
- **THEN** the reviewer SHALL pass all three as scoped, and SHALL flag a grant of a fixed program that writes, such as `Bash(rm:*)`, unless it is a listed exception

##### Scenario: Scoped document grant still prompts outside its path

- **GIVEN** `task-plan` needs to write `notes/plan.md`
- **WHEN** the skill writes
- **THEN** Claude Code SHALL ask the user first, because `task-plan` is not a listed exception and its grant covers `./docs/task-plans/task-plan-*.md` only

### ADDED Requirements

None in this spec. The new Area C requirements sit in the child specs: FR-193, FR-194, and FR-201 in `spec-skills-manifests-docs.md`, the skill-text part of FR-195 in `spec-skills-pr-review.md` (its `/do` side sits with Area A), FR-196 and FR-200 in `spec-skills-git.md`, and FR-197 in `spec-skills-requirements-specs.md`.

### REMOVED Requirements

None.

### Planned conformance (files that change with this entry)

| File and line at 1.11.1 | Change | Requirement |
|---|---|---|
| `rules/llm-security-checklist.md:11-12`, `:304-306` | The "When triggered" line names every file under `skills/**`, and both lines state the root, `plugins/<name>/`, and `.claude/` anchors and the instruction files at any depth | NFR-011 |
| `rules/assist-plugin-rule.md:103`, `:335`, `:359-360`; `skills/do/references/review-protocol.md:432` | The same path set (listed by NFR-011, `:4345`; Area A FR-061 owns these files) | NFR-011, FR-061 (cross-reference only) |
| `skills/pr-review/references/pr-detection.md:23`, `:24`, `:52`, `:53`, `:58`, `:59`, `:111`, `:168`, `:224`, `:227`, `:258`, `:262`; `skills/pr-review/SKILL.md:60` | Hosts become `example.com`-style names; `username:password` becomes `<user>:<token>` | NFR-015 |
| `skills/integrated-test/references/integration-patterns/go.md:65` | The DSN takes its user and password from the container's variables, so no literal credential remains | NFR-015 |
| `docs/TOKEN_OPTIMIZATION.md` (Future Extensions) | No change required; NFR-004 carries the method | NFR-004 |

### Direct edits in this pass (no behavior change)

Status-only and citation edits, made in place under `skills/spec-from-requirements/references/delta-format.md:12-13`:

- This spec: Status set to `Review`; baseline moved to 1.11.1 (commit 41034c1); the "Open points" section replaced by "Decided points"; line cites refreshed (`CLAUDE.md:114-130` to `:117-133`, `:111` to `:114`, `:126` to `:129`, `:128` to `:131`; `README.md:256` to `:259`; `skills/gather-requirements/SKILL.md:113` to `:117`; FR-NFR cites to the lines of the final, approved version 1.1); two scenario baselines moved from commit 4803a0d to 41034c1; the 1.11.1 grants marked Built; pending notes replaced by pointers to this Change Log; the Output table marks the listed exceptions; the catalog diagram and `specs/spec-skills-catalog.mmd` split `ask` from `debug` and draw the 1.11.1-only callers dotted.
- `spec-skills-ask-debug.md`, `spec-skills-deslop-voice-clarify.md`, `spec-skills-internal.md`: baseline moved to 1.11.1, pending notes replaced by the decided answers, OP-2 and FR-181 marked built; `spec-skills-internal.md` points at the NFR-015 change to `integration-patterns/go.md:65` above. These three specs received no delta, so their Status stays `Draft`. `spec-skills-health.md` received a delta in fix pass 1 (the writing-context self-test finding) and moved to `Review`.

## Change Log: 2026-10-17

**Source:** `DECISIONS.md:208-211` (2026-10-17, "/do PR review supports GitHub only in 1.12.0"), made after the sign-off at `DECISIONS.md:203-206`; `docs/requirements/FR-NFR-assist-plugin.md` FR-195 as revised for that decision (`:4079-4218`: statement `:4081`, Source `:4083`, scenario "Bitbucket remote" `:4155-4158`). Every FR-NFR cite in the skills specs was re-read on 2026-10-17 against FR-NFR version 1.2 (2026-10-17).

The Status stays `Approved`, as directed with this change, which applies the user's decision at `DECISIONS.md:208-211`.

### ADDED Requirements

None.

### MODIFIED Requirements

None in this spec. The requirement that changes is the skill-text part of FR-195 in `spec-skills-pr-review.md` (Change Log 2026-10-17). The `/do` flow belongs to Area A.

### REMOVED Requirements

None.

### Direct edits in this pass (no behavior change)

- OP-4 now says the `/do` PR review flow covers `github.com` remotes only in 1.12.0. On any other host, Bitbucket included, the step fails with `precondition-failed` and the message to run `/pr-review` directly, and `/do` runs no `bkt` command. Correcting the `bkt` forms everywhere, `/pr-review`'s references included, is a follow-up outside 1.12.0.
- The Description, the Decided points intro, the baseline note, and the `spec-skills-pr-review.md` sub-feature row name the 2026-10-17 refinement.
- FR-NFR line cites now match the current file. Since fix pass 1, FR-094 and FR-198 (Area B) gained scenarios and FR-195 was rewritten. Cites in the Area B range moved down 10 lines (FR-181 `:2710` to `:2720`, FR-118 `:2468-2497` to `:2478-2507`). Area C cites before FR-195 moved down 15 (for example FR-136 identity `:2954-2957` to `:2969-2972`, FR-143 `:3168-3197` to `:3183-3212`, FR-147 `:3247-3266` to `:3262-3281`, FR-148 `:3268-3287` to `:3283-3302`, FR-154 `:3371-3400` to `:3386-3415`, FR-175 to FR-177 `:3763`, `:3799`, `:3820` to `:3778`, `:3814`, `:3835`, FR-177 `:3818-3857` to `:3833-3872`, FR-182 legacy `:3910-3913` to `:3925-3928`, FR-183 `:3917` to `:3932` and legacy `:3941-3944` to `:3956-3959`, FR-185 `:3979` to `:3994`, FR-194 `:4043-4062` to `:4058-4077`). In FR-NFR version 1.2, FR-195 is at `:4079-4218`, longer than before, so cites after it sit 35 lines below their fix-pass-1 lines: NFR-004 `:4288` (scenarios `:4297-4305`), NFR-011 `:4345`, NFR-013 `:4347` (scenarios `:4357-4380`), NFR-015 `:4349` (scenarios `:4392-4410`), NFR-020 `:4449` (scenario `:4457-4460`), FR-201 `:4252-4271`, and open question 8 `:4593`. Each was read at its new line. Cites before FR-094 (FR-020 `:393`, FR-061 `:1304-1348`, FR-199 `:1350`) did not move.
