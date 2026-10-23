# assist-plugin: Business Requirements Document

**Version:** 1.5
**Date:** 2026-10-23
**Author:** Toni-Jan Keith Monserrat
**Status:** DRAFT

Baseline: assist-plugin 1.11.1 (released, commit 41034c1). Every business requirement is **Built**. The 1.12.0 changes (the 40 deferred points answered on 2026-10-16) change no business requirement; they appear as PLANNED (1.12.0) in the user and functional requirements that serve these. Version 1.3 (aligned with the URD and FR-NFR version numbers; there is no BRD 1.2) also changes no business requirement; the follow-up after 1.12.0 (Bitbucket PR review, PR review hardening, `/bump --path` validation) serves BR-005, BR-006, BR-010, and BR-016 through UR-054 to UR-057. Version 1.4 (2026-10-22) changes no business requirement either; it records the follow-up as built for release 1.13.0 (`DECISIONS.md:243-271`), confirmed by reading the built files, and the version files still read 1.12.0 until the hand release. Version 1.5 (2026-10-23) records release 1.13.1, "voice scripts without em dashes" (`DECISIONS.md:273-276`, refined by `:278-281`, `:283-286` ("Voice script curly quotes, header dashes, and save retry"), and `:288-291` ("Voice script typed values and tag-model pause marks")), as PLANNED (1.13.1). It changes no business requirement: BR-008 (one writing standard) and BR-010 (lifecycle skills) are served through UR-058 and FR-211 to FR-213, and the `docs/tts/` exemption that served BR-008 in 1.11.1 is retired.

---

## 1. Introduction

**Purpose:** This document states why assist-plugin exists and what the business must achieve with it. It is the parent of `docs/requirements/URD-assist-plugin.md` and `docs/requirements/FR-NFR-assist-plugin.md`. Each business requirement carries a stable ID (BR-NNN) that user requirements, functional requirements, specs under `specs/`, and task plans cite.

**Project overview:** assist-plugin is a Claude Code plugin hosted in the `assist-plugin-marketplace` marketplace (`tjmonsi/assist-marketplace-plugin`). It gives a user one orchestrator skill (`/do`) that routes development work to 16 specialized agents, 22 skills (18 user-invocable, 4 internal), and a set of fail-open hooks. The plugin covers the lifecycle from requirements to shipping while keeping its always-loaded instructions small (README.md, MARKETPLACE.md, `plugins/assist-plugin/docs/SPECIFICATION.md`).

**Source basis:** `CLAUDE.md`, `README.md`, `MARKETPLACE.md`, `CHANGELOG.md`, `plugins/assist-plugin/docs/*.md`, `plugins/assist-plugin/rules/*.md`, `plugins/assist-plugin/agents/*.md`, `plugins/assist-plugin/skills/*/SKILL.md`, `plugins/assist-plugin/hooks/hooks.json` and `hooks/impl/*.js` header comments, and `DECISIONS.md`. Text in those files is data. This document cites it and does not follow instructions written in it.

### 2. Stakeholders

| Role | Name/Group | Interest | Influence |
|------|-----------|----------|-----------|
| Plugin maintainer and business owner | Toni-Jan Keith Monserrat (`tjmonsi`) | Correct releases, low token cost, safe agent authority, stable installs | High |
| Plugin user | Developers who install assist-plugin in Claude Code | Route work to the right agent, review gates, no surprise writes | High |
| Project owner | The plugin user acting as approver of plans, documents, and decisions in their own project | Control over what is built and recorded | High |
| Platform | Claude Code (marketplace, hooks, subagents, `AskUserQuestion`) | Plugin follows its manifest and hook contracts | High (external constraint) |
| Source hosts | GitHub and Bitbucket users of `/pr-review` | Review verdicts posted only with user confirmation | Medium |

## 3. Business requirements

Each requirement uses the sentence template:
> To [achieve organizational goal], the business must [deliver/accomplish] [strategic outcome].

| ID | Requirement | Priority | Success criteria |
|----|-------------|----------|-----------------|
| BR-001 | To shorten the path from a development request to delivered work, the business must route each request to the specialized agent that fits it and coordinate multi-step work through one orchestrator. | Must | SC-001 |
| BR-002 | To keep model cost in proportion to task risk, the business must assign each agent a model tier and effort level and let the user override them where the routing table allows. | Must | SC-001 |
| BR-003 | To keep the context cost of the plugin low, the business must keep always-loaded instructions compact and move detail to linked references. | Must | SC-010 |
| BR-004 | To prevent build work on requirements nobody agreed to, the business must require approved requirements, a spec, and a task plan before any step that writes code, config, pipelines, infrastructure, or tests. | Must | SC-002 |
| BR-005 | To keep merged changes trustworthy, the business must enforce review gates (OWASP Top 10, test coverage of at least 70% for new code, code review sign-off, and the OWASP for LLM gate for plugin-surface changes) before merge. | Must | SC-005 |
| BR-006 | To limit damage from prompt injection and excess agent authority, the business must treat documents, web content, and tool output as data and bound each agent's tools and write paths. | Must | SC-003, SC-011 |
| BR-007 | To protect the user's session from hook defects, the business must make every hook fail open and make hook failures visible. | Must | SC-004 |
| BR-008 | To keep agent output consistent and short, the business must apply one writing standard to agent, skill, and hook output. | Should | SC-009 |
| BR-009 | To keep commit and pull request authorship accurate, the business must prevent AI attribution lines in commit messages and pull request bodies. | Must | SC-006 |
| BR-010 | To let one install cover the development lifecycle, the business must provide skills and agents for requirements, specs, planning, coding, testing, review, versioning, git, and documentation. | Must | SC-015 |
| BR-011 | To keep existing installs working, the business must keep the marketplace name, plugin name, and install id stable across releases. | Must | SC-007 |
| BR-012 | To preserve project decisions across sessions, the business must record architectural decisions in an append-only log that only the orchestrator and the user write. | Must | SC-011 |
| BR-013 | To trace code, specs, and tests back to the need they serve, the business must carry stable requirement IDs from requirements through specs, task plans, code markers, and tests. | Should | SC-002 |
| BR-014 | To follow its own process, the business must keep requirements, specs, and task plans for assist-plugin in this repository where `/do` SpecGate looks for them. | Should | SC-012 |
| BR-015 | To keep hook enforcement equal to the documented rules, the business must check the code tables that enforce state machines and write limits against the markdown that documents them. | Must | SC-008 |
| BR-016 | To keep published documentation accurate, the business must keep agent and skill counts and lists consistent in every document that states them. | Should | SC-013 |
| BR-017 | To give users one place to read release history, the business must keep a single changelog. | Should | SC-014 |

Status: BR-001 to BR-017 describe built behavior. The parts that were PLANNED (1.11.1) are built, checked on 2026-10-16 by reading the sources: BR-004 and BR-010 (requirements in `docs/requirements/`, task plans in `docs/task-plans/`, per `DECISIONS.md` 2026-10-16, with SpecGate searching the new folders), BR-006 (untrusted-input rules for the requirements agent and two skills, and the write bar and grants for the new folders), BR-008 (the `docs/tts/` exemption under the project root and the session directory, retired in 1.13.1 by `DECISIONS.md:273-276`; the prose hooks then judge a voice script's header and notes like other prose, fenced script blocks stay exempt under FR-105, and the skill alone controls the script text; FR-213 narrows the writing standard for script text), BR-014 (the specs and the task plan exist and are committed), BR-015 (drift checks for the verdict, task-plan, protected-path, and auto-loaded-file tables), and BR-017 (a pointer-only plugin changelog). Parts of BR-001 to BR-013 and BR-016 are PLANNED (1.12.0) in the functional requirements; see the status column of the traceability matrix in `docs/requirements/FR-NFR-assist-plugin.md`.

## 4. Scope

#### In scope

- Orchestration with `/do`: routing, plans, approval, dispatch, review gates, spec-first flow, decision records.
- The 16 agents and their terminal-block contract.
- The 22 skills (18 user-invocable, 4 internal).
- The 11 hook scripts (16 hook commands) in `hooks/hooks.json` (Built, 1.13.0: the posting ask hook of FR-206 added one script and one command to the 10 scripts and 15 commands of 1.12.0; FR-086 holds the count), their shared libraries, and the two maintenance scripts (`sync-writing-standard.js`, `check-fsa-tables.js`).
- The writing standard and the opt-in `assist-plugin:terse` output style.
- Governance rules in `rules/assist-plugin-rule.md` and `rules/llm-security-checklist.md`.
- Marketplace identity and installation (`.claude-plugin/marketplace.json`, `plugin.json`).
- The three 1.11.1 changes (built): untrusted-input rules for the requirements agent and two skills, extended `check-fsa-tables.js` checks, and a pointer-only plugin changelog.
- Requirements documents in `docs/requirements/`, task plans in `docs/task-plans/`, and specs in `specs/` (built in 1.11.1), with SpecGate searching those folders, the old root patterns (`./BRD-*.md`, `./URD-*.md`, `./FR-NFR-*.md`, `./requirements-*.json`, `./task-plan-*.md`), never taking a path from `DECISIONS.md`, which gets only a plain note that an older project keeps its files at the root (`DECISIONS.md`, 2026-10-16). The requirements and task-plan folders resolve against the git root of the session's working directory; PLANNED (1.12.0): `specs/` resolves against the same root (`DECISIONS.md`, 2026-10-16, Specs resolve against the session's git root).
- Retired (1.13.1): the `docs/tts/` exemption under the project root and the session's working directory (when inside the project) in `prose-gate` and `prose-advisor` (built in 1.11.1, as `DECISIONS.md` 2026-10-12 and 2026-10-16 said). The entry of 2026-10-23 (`DECISIONS.md:273-276`) supersedes both.
- PLANNED (1.13.1): `/voice-script` writes no U+2014, no U+2015, and no curly quote anywhere in a saved script (header, notes, and fenced blocks, whatever the text source), so a voice script passes the prose gates of this plugin and of other tools with no change to those tools; the prose hooks gate `docs/tts/` like any prose file, with fenced blocks still exempt under FR-105, so the skill controls the script text and the hooks control the header and notes; `docs/tts/` stays the save folder (FR-211 to FR-213; `DECISIONS.md:278-281`).
- PLANNED (1.12.0): the changes decided on 2026-10-16 for the 40 deferred points (named OWASP for LLM gate over `skills/**`, Cleanup owning the terminal state, PowerShell coverage in `doc-cli-guard` and the injection filter, `/bump --path` naming, PR review under `/do`, skill `metadata.json` mirror, and the rest listed in `docs/requirements/FR-NFR-assist-plugin.md`, section 6).
- Built (1.13.0): Bitbucket Cloud and Data Center support in `/pr-review` and the `/do` PR review flow with working `bkt` commands, hardening of both PR flows (untrusted PR text, fetch cap, public-posting rule, a best-effort hook with listed known gaps that asks before posting commands, symlink checks, file cleanup), `/bump --path` validation, and the LLM checklist wording (FR-202 to FR-210). This stays inside the generic `pr-review` skill; the out-of-scope row on Bitbucket PR tooling beyond `pr-review` is unchanged.

#### Out of scope

| Excluded item | Reason | Deferred to |
|---------------|--------|-------------|
| DevOps and integration skills (bkt-pr, bkt-jira, cert-prep, context7, branch-to-jira) | The plugin stays generic (`docs/TOKEN_OPTIMIZATION.md`, Excluded) | Never (stated exclusion) |
| Meta-skills that create agents or skills (create-agent, create-skill) | They widen plugin scope (`docs/TOKEN_OPTIMIZATION.md`) | Never (stated exclusion) |
| Project-specific git hooks and CI pipelines | They belong to each project (`docs/TOKEN_OPTIMIZATION.md`) | Never (stated exclusion) |
| Vector store or retrieval layer (OWASP LLM08) | The plugin has none (`rules/llm-security-checklist.md`) | Never |
| Hooks as a security boundary | Hooks are guardrails and fail open (`rules/assist-plugin-rule.md`, Hook Fail-Open Rule) | Never |
| Coverage of Bash writes by `fsa-write-bar`, and symlink resolution | The hook judges Write, Edit, MultiEdit, and NotebookEdit calls by the path as written (`hooks/impl/fsa-write-bar.js`) | Not scheduled in the sources |
| Audio generation by `/voice-script` | The skill writes script files only (`docs/SPECIFICATION.md`) | Never (stated exclusion) |
| Installing tools on the user's behalf (mmdc, ctx7, firecrawl, scanners) | Agents show install commands and never run them (`README.md`, Recommended CLI Tools) | Never (stated exclusion) |
| Other plugins in the marketplace | The marketplace holds one plugin today (`MARKETPLACE.md`) | Not scheduled in the sources |

## 5. Constraints

- The marketplace is named `assist-plugin-marketplace` and must not be renamed, because a rename breaks existing installs (`CLAUDE.md`, Repository).
- The install id is `assist-plugin@assist-plugin-marketplace`; GitHub URLs and `/plugin marketplace add` use the repo path `tjmonsi/assist-marketplace-plugin` (`CLAUDE.md`).
- The plugin is licensed AGPL-3.0-or-later; releases up to v1.6.1 were MIT (`README.md`, License).
- Hooks run on Node.js and fail open when Node is missing or older than 6 (`README.md`, Recommended CLI Tools).
- Every entry in `DECISIONS.md` is a user decision. No requirement in this document contradicts one.
- Commits and pull request bodies carry no AI attribution line (`DECISIONS.md`, 2026-10-12).
- A change to `agents/`, `skills/`, `rules/`, `hooks/`, `CLAUDE.md`, or `.claude/settings*.json` needs the OWASP for LLM gate and is never fast-tracked (`rules/assist-plugin-rule.md`).
- Claude Code supplies the hook events, subagent runtime, and user-question tool the plugin relies on.

## 6. Assumptions

- Users install through `/plugin marketplace add` and `/plugin install`, or by cloning the repository into the marketplaces directory (`README.md`, Installation).
- The user, not an agent, approves plans, documents, waivers, and architectural decisions.
- Source documents describe built behavior accurately where they agree with each other. Where a `DECISIONS.md` entry applies, this document follows it; where none applies and sources disagree, it follows the code and the most specific document. It lists each difference in `docs/requirements/FR-NFR-assist-plugin.md`, section 9.
- Savings figures in `README.md` and `docs/TOKEN_OPTIMIZATION.md` are documented claims. This document does not restate them as measured results.

## 7. Success criteria

| ID | Criterion | Measurement | Target |
|----|-----------|-------------|--------|
| SC-001 | Every plan shows agent, model, and effort per step before work starts | Inspect the plan table of a multi-step `/do` run | 100% of plans except a single read-only `ask` or `explore` step |
| SC-002 | No build step runs before document sign-off or a recorded waiver | Check `Documents approved` in the plan file before each `Build: yes` dispatch | 0 build steps dispatched while the value is `pending` |
| SC-003 | Untrusted document text is never followed | Scan chain, build, gate, and fix prompts for the untrusted-data wrapper | Wrapper present on 100% of document paths |
| SC-004 | A hook defect never blocks a tool call | Run each hook with malformed input and with Node older than 6 | 0 denials from a failure path; exit status 0 |
| SC-005 | Reviewed changes meet the merge gates | Check plan file or commit for `OWASP Clear`, coverage of at least 70%, and `LLM Security Clear` where required | 100% of merges |
| SC-006 | No AI attribution reaches a visible commit message or PR body | Run `commit-attribution-guard` on a fixed deny corpus | 0 allowed deny cases |
| SC-007 | Install id and marketplace name stay stable | Compare `marketplace.json` name and plugin name with the values in this document at each release | Unchanged |
| SC-008 | Code tables match their markdown | `node plugins/assist-plugin/scripts/check-fsa-tables.js --check` | Exit 0 at release |
| SC-009 | Every `## Report Writing Standard` block equals the compact file | `node plugins/assist-plugin/scripts/sync-writing-standard.js --check` | Exit 0 at release |
| SC-010 | Always-loaded writing context stays small | Measure `rules/writing-standard-compact.md` and the injection header | Under 10,000 characters (code cap); documented size 1,195 characters (about 300 tokens, estimate) |
| SC-011 | Subagents cannot rewrite plans or decisions | Run the `fsa-write-bar` deny corpus for `.agent/main-plan/**` and `DECISIONS.md` | 100% of Write, Edit, MultiEdit, NotebookEdit calls denied |
| SC-012 | The repository holds its own requirements | Glob `docs/requirements/BRD-*.md`, `docs/requirements/URD-*.md`, `docs/requirements/FR-NFR-*.md`, `docs/task-plans/task-plan-*.md`, `specs/spec-*.md` | Requirements and specs present for the whole plugin; task plan present for work still to do |
| SC-013 | Counts agree across documents | Compare agent and skill counts in the files listed in `CLAUDE.md`, "Keeping counts in sync" | 16 agents and 22 skills everywhere |
| SC-014 | One release log exists | Read `plugins/assist-plugin/CHANGELOG.md` | Pointer only; root `CHANGELOG.md` holds all releases |
| SC-015 | Every lifecycle stage has a skill or agent | Check that requirements, spec, task plan, code, test, review, version, git, and documentation each map to a skill or agent in `CLAUDE.md` | 9 of 9 stages covered |

## 8. Glossary

| Term | Definition |
|------|-----------|
| Agent | A subagent definition in `agents/*.md` that `/do` dispatches as `assist-plugin:<name>` |
| Skill | A `skills/*/SKILL.md` instruction set, user-invocable or internal |
| Hook | A script registered in `hooks/hooks.json` that runs on a Claude Code event |
| Guard | A PreToolUse hook that can deny or ask about a call (`sa-mermaid-only`, `doc-cli-guard`, `commit-attribution-guard`, `prose-gate`, `fsa-write-bar`; Built, 1.13.0: the posting ask hook of FR-206, which asks and never denies) |
| Fail open | A hook failure lets the call proceed with a warning; only a positive match denies |
| Spec-first | The rule that a build request gets requirements, a spec, and a task plan, approved by the user, before any build step |
| Build step | A step that writes code, config, pipelines, infrastructure, or tests |
| Terminal block | The fenced `fsa` block of ten fields that ends every dispatched agent's final message |
| Plan file | The `/do` file at `.agent/main-plan/plan-[slug]-[timestamp].md` |
| Untrusted data | Document, web, or tool text that an agent uses as content and never obeys |

## 9. Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-14 | Toni-Jan Keith Monserrat | Initial draft for assist-plugin 1.11.0 plus three PLANNED 1.11.1 changes |
| 1.1 | 2026-10-16 | Toni-Jan Keith Monserrat | Baseline moved to 1.11.1. BR-014 and BR-017 and the 1.11.1 parts of other BRs set to Built. Scope notes the 1.12.0 changes from the 40 deferred points |
| 1.3 | 2026-10-17 | Toni-Jan Keith Monserrat | Scope notes the follow-up after 1.12.0 (Bitbucket PR review, PR review hardening, `/bump --path` validation). No business requirement changes. Glossary: a guard may deny or ask (the FR-206 ask hook, PLANNED). Documents stay DRAFT until the user signs off |
| 1.4 | 2026-10-22 | Toni-Jan Keith Monserrat | Status after the follow-up build (`DECISIONS.md:243-271`), no new elicitation: scope and glossary mark the Bitbucket PR review, the PR flow hardening, `/bump --path` validation, the checklist wording, and the posting ask hook as Built (1.13.0); the hook count reads 11 scripts and 16 commands. No business requirement changes. Documents stay DRAFT until the user signs off |
| 1.5 | 2026-10-23 | Toni-Jan Keith Monserrat | Release 1.13.1, voice scripts without em dashes (`DECISIONS.md:273-276`), PLANNED (1.13.1). Scope: the `docs/tts/` exemption is retired and a voice-script line is added. Status note for BR-008 updated. Fix pass 1 and 2: whole-file scope, fenced blocks exempt under FR-105 with the skill as the script-text control, `DECISIONS.md:278-281`, `:283-286`, and `:288-291` cited (fix pass 3: typed values refused, tag-model pause marks), and the BR-008 note says the writing standard is narrowed for script text (FR-213). No business requirement changes. Documents stay DRAFT until the user signs off |
