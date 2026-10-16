# Decisions

## 2026-10-12: Prose hooks skip docs/tts

Decision: prose-gate and prose-advisor skip files whose normalized path, relative to the project root, starts with `docs/tts/`, so voice scripts may use em dashes for pauses. Every other path stays gated.
Plan: .agent/main-plan/plan-voice-script-20261012.md

## 2026-10-12: voice-script output format

Decision: `/voice-script` writes a `.md` file to `docs/tts/` with a header (model, voice, length, delivery direction, model settings) and one fenced block holding exactly the text to paste.
Plan: .agent/main-plan/plan-voice-script-20261012.md

## 2026-10-12: voice-script tag catalog

Decision: paralinguistic tags come from one dated reference file per TTS model with source URLs, plus a run-time WebFetch of OpenRouter's model list, treated as untrusted data, that flags new or removed TTS models.
Plan: .agent/main-plan/plan-voice-script-20261012.md

## 2026-10-12: clarify skill scope and log

Decision: `/clarify` explains Claude's unclear output and asks the user about points only the user can settle; it logs each clarification to `.agent/clarify/clarify-YYYYMMDD.md` (append-only, one file per day) and never writes `/do` plan files or `DECISIONS.md`.
Plan: .agent/main-plan/plan-clarify-skill-20261012.md

## 2026-10-12: clarify tool grants

Decision: `/clarify` pre-approves Write and Edit only for `.agent/clarify/**` and the single command `date +%Y-%m-%dT%H:%M`; every other write prompts, and Claude does not start the skill on its own for ambiguous requests.
Plan: .agent/main-plan/plan-clarify-skill-20261012.md

## 2026-10-12: voice-script tool grants

Decision: `/voice-script` pre-approves writes only for `docs/tts/voice-*.md` (scripts are named `voice-<slug>-YYYYMMDD-HHmm.md`) and the single command `date +%Y%m%d-%H%M`; every other write prompts.
Plan: .agent/main-plan/plan-voice-script-20261012.md

## 2026-10-12: No AI attribution in commits or PRs

Decision: commits and PR bodies never carry a Co-Authored-By trailer or other attribution line for an AI tool (human co-authors stay allowed). A PreToolUse guard on Bash and PowerShell denies git and gh commands that add one, the skills and plugin rules state the rule, and `/assist-plugin:health` reports when Claude Code's `attribution.commit` or `attribution.pr` is not empty.
Plan: .agent/main-plan/plan-no-ai-coauthor-20261012.md

## 2026-10-12: Scoped write grants for document skills

Decision: gather-requirements, technical-writing, and spec-from-requirements pre-approve Edit only for their documented output paths (keeping CLAUDE.md, AGENTS.md, and `.claude/` out where the layout allows); every other write prompts. DECISIONS.md is committed with the project.
Plan: .agent/main-plan/plan-release-1-10-0-20261012.md

## 2026-10-13: Spec-first /do for build requests

Decision: `/do` requires requirements, a spec, and a task plan before any step that writes code, config, pipelines, infrastructure, or tests; docs-only edits, reviews, questions, and commits are exempt. A read-only intake-reviewer conflict check compares the request against existing documents and `DECISIONS.md`; Clarify asks about every gap and contradiction (up to 5 rounds, each question showing a recommended answer and the assumption /do would otherwise make; a point open after round 5 stops the plan). The user signs off on the finished documents in the same run before build steps start. PlanApproval offers a "Skip spec-first" waiver, recorded in `DECISIONS.md`.
Plan: .agent/main-plan/plan-spec-first-do-20261013.md

## 2026-10-13: task-planner agent and plan-file write guard

Decision: the spec-first Task plan step runs on a dedicated `task-planner` agent with only Read, Write, Grep, and Glob, and fsa-write-bar limits its writes to `task-plan-*.md`; the developer no longer runs task-plan. fsa-write-bar denies every assist-plugin subagent Write, Edit, MultiEdit, and NotebookEdit on `.agent/main-plan/**` and `DECISIONS.md`, so only the orchestrator records plans, sign-off, waivers, and decisions.
Plan: .agent/main-plan/plan-spec-first-do-20261013.md

## 2026-10-13: Protected-path guard covers every subagent

Decision: fsa-write-bar denies Write, Edit, MultiEdit, and NotebookEdit on `.agent/main-plan/**` and `DECISIONS.md` for every subagent (any non-empty agent_type, including other plugins' agents). Assist-plugin agents other than developer are also barred from hidden paths, CLAUDE.md, CLAUDE.local.md, and AGENTS.md. sa-mermaid-only limits mmdc to `.mmd` input and `.svg`, `.png`, or `.pdf` output under `specs/`. /do dispatches registry agents by their qualified `assist-plugin:<name>`.
Plan: .agent/main-plan/plan-spec-first-do-20261013.md

## 2026-10-13: Narrow the hidden-path bar to pre-sign-off chain agents

Decision: corrects the previous entry. The hidden-path and auto-loaded-file bar (dot paths, CLAUDE.md, CLAUDE.local.md, AGENTS.md) applies to requirements-gatherer, solutions-architect, task-planner, and developer-tester, the agents that read untrusted documents before sign-off or write only tests. devops, worker, qa, general-purpose, and developer keep dot-path writes because CI and config files (`.github/`, `.gitlab-ci.yml`) are their work.
Plan: .agent/main-plan/plan-spec-first-do-20261013.md

## 2026-10-14: assist-plugin follows its own spec-first rule

Decision: this repo keeps requirements (`BRD-*.md`, `URD-*.md`, `FR-NFR-*.md`) and task plans (`task-plan-*.md`) at the repo root and specs under `specs/`, where /do's SpecGate looks. The requirements and specs cover the whole plugin; task plans cover work still to do. `plugins/assist-plugin/CHANGELOG.md` becomes a pointer to the root `CHANGELOG.md`, which is the only release log.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md

## 2026-10-14: Write guard lists live in rules/assist-plugin-rule.md

Decision: the protected paths, auto-loaded file names, and the task-planner glob that fsa-write-bar enforces are listed in one `## Write guard lists` section of `plugins/assist-plugin/rules/assist-plugin-rule.md`, one table per list with the exact code string in backticks; `agents/task-planner.md` carries a one-row Write scope table for its glob. `check-fsa-tables.js --check` compares these tables with `hooks/lib/fsa-paths.js`, and the markdown wins.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md

## 2026-10-16: docs/tts exemption covers the project root and the session directory

Decision: refines the 2026-10-12 entry. prose-gate and prose-advisor exempt `docs/tts/` under the project root (`CLAUDE_PROJECT_DIR`, else the git root found by walking up for `.git`, else the hook cwd) and also under the session's working directory when that directory is inside the project, so worktree and subdirectory sessions keep working and `/voice-script` keeps saving under the session directory.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md

## 2026-10-16: Requirements in docs/requirements/, task plans in docs/task-plans/

Decision: corrects the location part of the 2026-10-14 "assist-plugin follows its own spec-first rule" entry. gather-requirements writes BRD, URD, and FR-NFR documents to `docs/requirements/`, and task-plan writes task plans to `docs/task-plans/`; specs stay in `specs/`. In an older project that keeps these files at the repo root, /do records their location in DECISIONS.md and leaves them there unless the user asks to move them; SpecGate searches the new folders plus any location DECISIONS.md records. This repo's requirements move to `docs/requirements/`.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md

## 2026-10-16: Legacy root documents and the requirements JSON

Decision: task-planner writes only `docs/task-plans/task-plan-*.md`; root-level task plans in older projects stay where they are and are still read, and a rework of one writes a new file in `docs/task-plans/`. `requirements-<slug>.json` goes to `docs/requirements/`. SpecGate also searches the old root patterns (`./BRD-*.md`, `./URD-*.md`, `./FR-NFR-*.md`, `./requirements-*.json`, `./task-plan-*.md`); on a hit with no DECISIONS.md record, /do records the location after the user approves the plan and keeps the files in place.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md

## 2026-10-16: Legacy location records are notes, not search input

Decision: when /do finds an older project's requirements or task plans at the repo root, it appends a plain DECISIONS.md entry saying the project keeps them there, so they are not moved unless the user asks. SpecGate finds them through its fixed root patterns and never parses paths out of DECISIONS.md. This replaces the proposed `Location:` line form.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md

## 2026-10-16: docs/requirements/ and docs/task-plans/ resolve against the session's git root

Decision: `docs/requirements/` and `docs/task-plans/` resolve against the git root of the session's working directory (a worktree uses its own root), falling back to the working directory outside a git repository. SpecGate searches there, gather-requirements and task-plan write there, and fsa-write-bar judges task-planner's `docs/task-plans/task-plan-*.md` against that root. A session started in a subdirectory gets a write prompt, because the skills' `./` grants are relative to the working directory.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md

## 2026-10-16: 1.11.1 design points for root notes, change check, and grants

Decision: /do reads only the headings of DECISIONS.md, at plan approval just before it appends a "kept at the repository root" note, to skip a duplicate; SpecGate still reads none of the files it lists, and heading text is untrusted. The change check takes its snapshots and steering-file hashes (`.claude/settings*.json`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `DECISIONS.md`) against the session's git root. gather-requirements keeps its grant scoped to `docs/requirements/`, so an in-place update of a legacy root-level requirements file asks the user first. When a hook input has no usable working directory, fsa-write-bar lets task-planner write only a plain relative `docs/task-plans/task-plan-*.md` and denies absolute, `~`, drive-relative, and `..` targets.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md

## 2026-10-16: 1.11.1 documents signed off; tests folder and latency method

Decision: the requirements in `docs/requirements/`, the specs in `specs/`, and the task plan `docs/task-plans/task-plan-followups-1-11-1-20261016-070112.md` are approved for the 1.11.1 build. The repo gains a root-level `tests/` folder of plain `node` tests written by developer-tester and run by qa. NFR-008 is measured as the median of 20 runs of each per-write hook on the named 2 KB inputs, against a 110 ms limit. The 31 open points about 4803a0d behavior (OPEN-1 to OPEN-7, OP-1 and OP-3 to OP-14, OP-B1 to OP-B5 and OP-B7 to OP-B12) are deferred as follow-up requests.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md
