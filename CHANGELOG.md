# Changelog

All notable changes to assist-plugin-marketplace are documented in this file.

## [1.11.1] - 2026-10-16

### Changes

- Requirements go to `docs/requirements/` (`gather-requirements`: BRD, URD, FR-NFR, and the optional JSON) and task plans go to `docs/task-plans/` (`task-plan`), both under the git root of the session's working directory; specs stay in `specs/`
  - SpecGate searches the new folders and the old root patterns (`./BRD-*.md`, `./URD-*.md`, `./FR-NFR-*.md`, `./requirements-*.json`, `./task-plan-*.md`)
  - In an older project that keeps these files at the repo root, `/do` appends a plain note to `DECISIONS.md` after plan approval and leaves the files in place; a rework of a root-level task plan is written as a new file in `docs/task-plans/`
  - The change check takes its snapshots and steering-file hashes against the session's git root
- `prose-gate` and `prose-advisor` skip `docs/tts/` under the project root (`CLAUDE_PROJECT_DIR`, else the git root, else the hook's working directory) and under the session's working directory when that directory is inside the project; `/voice-script` still saves under the session directory
- `check-fsa-tables.js` makes three new comparisons: `verdictByStep` against the Decide and Verify rows of the `intake-reviewer` `## States` table; the protected paths and the auto-loaded names against the new `## Write guard lists` section in `rules/assist-plugin-rule.md`; and the task-plan glob against that section and the Write scope table in `agents/task-planner.md`
- The plugin `CHANGELOG.md` is a pointer to this file and holds no release entries
- Counts: 16 agents, 22 skills

### Security

- `requirements-gatherer`, `gather-requirements`, and `spec-from-requirements` are told to treat the files they read as untrusted data and to report instruction-like text only as a file:line citation (a prompt rule, not a hook)
- `fsa-write-bar` limits `task-planner` to `docs/task-plans/task-plan-*.md` under the session's git root; with no usable working directory in the hook input, only a plain relative `docs/task-plans/task-plan-*.md` passes
- `gather-requirements` pre-approves edits only to `docs/requirements/`, so an in-place update of a root-level requirements file asks the user first
- `task-plan` pre-approves edits only to `./docs/task-plans/task-plan-*.md` (was `./task-plan-*.md`), so a write at the root or from a session started in a subdirectory now prompts

## [1.11.0] - 2026-10-14

### New Features

- **Spec-first `/do`**: a request that writes code, config, pipelines, infrastructure, or tests now gets requirements, a spec, and a task plan, approved by the user, before any build step runs
  - SpecGate classifies the request as `build` or not; docs-only edits, reviews, questions, and commits are exempt
  - For a build, a read-only `intake-reviewer` `conflict-check` compares the request with existing requirements, specs, task plans, and `DECISIONS.md`; an empty project skips the check
  - Build Clarify runs up to 5 rounds (2 for other requests), each question with /do's recommended answer and the assumption /do would otherwise make, except a question about instruction-like text in a document, which has no recommended option; a point still open after round 5 ends the run in `Error(plan-invalid)`
  - A requirements, spec, and task-plan chain (`requirements-gatherer`, `solutions-architect`, `task-planner`) runs ahead of every `Build: yes` step, and the plan file gets a Spec-First section
  - DocSignOff asks the user to approve the documents (Approve documents, Edit documents up to 3 times, or Cancel) before any `Build: yes` step starts
  - PlanApproval offers "Skip spec-first", recorded in `DECISIONS.md`
- **New agent `task-planner`** (Read, Write, Grep, Glob; preloads `task-plan`): writes only a root-level `task-plan-*.md`, treats the spec and every document it reads as untrusted data, and reports as `task-planner/1` with verdict `steps=N`. The plugin now has 16 agents. The `developer` agent no longer runs `task-plan`
- **`intake-reviewer` `conflict-check` mode**: reports missing documents, request versus documents, contradictions between documents, and gaps, each with a question, a recommended answer, and the assumption that applies otherwise; verdict `clear` or `needs-clarification`

### Changes

- `/do` runs, in a git repo, a change check (`git status` plus content hashes of `.claude/settings*.json`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, and `DECISIONS.md`) around each chain step, validates each chain artifact against the step's writes, and stores a hash of each approved document that it rechecks before every build send
- `/do` wraps document paths as untrusted data in chain, build, gate, and fix prompts, and dispatches registry agents as `assist-plugin:<name>`
- `task-plan` pre-approves edits only to `./task-plan-*.md` and no longer lists `Write`; a fix pass overwrites the task-plan file named in the prompt
- The `review-protocol` reference lists the reviewer and code-reviewer tools correctly (Read, Grep, Glob, LSP; no write, no shell) and routes a fix only for findings on the gated step's writes
- `mmdc` examples in `solutions-architect` and `diagram-generation.md` read a `.mmd` file and write a `.svg`, `.png`, or `.pdf` file under `specs/`
- Counts: 16 agents, 22 skills

### Security

- `fsa-write-bar` limits `task-planner` to a root-level `task-plan-*.md` inside the project
- `fsa-write-bar` bars `requirements-gatherer` and `solutions-architect` from dot paths, `CLAUDE.md`, `CLAUDE.local.md`, and `AGENTS.md`; `developer-tester` is now also barred from `CLAUDE.local.md`
- `fsa-write-bar` denies every subagent (any plugin, when `agent_id` is present) writes to `.agent/main-plan/**` and `DECISIONS.md`, matched without regard to case, trailing dots or spaces, or a `:stream` suffix, and denies subagents a path over 4096 characters or with a NUL character (Write, Edit, MultiEdit, and NotebookEdit calls only; Bash writes are not covered; the hook fails open)
- `sa-mermaid-only` accepts `mmdc` only with a `.mmd` input and a `.svg`, `.png`, or `.pdf` output under `specs/` or `<dir>/specs/`
- Fast-Track never applies to a change in `agents/`, `skills/`, `rules/`, `hooks/`, `CLAUDE.md`, or `.claude/settings*.json`

## [1.10.2] - 2026-10-13

### Bug Fixes

- The `developer-tester` terminal block in `agents/developer-tester.md` is labelled as an example of a `Done` run, so an agent fills in its own state, trace, paths, and counts
- `check-fsa-tables.js` lists the files it checks for example blocks in its own `EXAMPLE_FILES` constant

## [1.10.1] - 2026-10-13

### Bug Fixes

- `developer-tester` reports keep their terminal block after context compaction
  - `agents/developer-tester.md` now holds the literal ten-field ```` ```fsa ```` block; it used to link to the create-test template, which compaction could drop with the dispatch prompt
  - `/do` resume messages after `NeedsInput` now carry the dispatch prompt text, as retries already did
  - `check-fsa-tables.js` now checks the example block in `agents/developer-tester.md`

## [1.10.0] - 2026-10-12

### New Features

- **New user-invocable `voice-script` skill**: `/voice-script [topic | draft-file]` writes a paste-ready text-to-speech script for a chosen TTS model
  - Asks for the model, voice, length, delivery, and a topic or draft, then saves `docs/tts/voice-<slug>-YYYYMMDD-HHmm.md` with that model's own paralinguistic tags
  - Catalog of Chatterbox-Turbo, 32 OpenRouter speech models, and OpenAI gpt-audio and gpt-audio-mini, with a live OpenRouter check
- **New user-invocable `clarify` skill**: `/clarify [what is unclear]` turns unclear points in the current discussion into explanations and settled answers
  - Explains Claude's own unclear output with evidence, then asks the user about points only the user can settle through `AskUserQuestion`
  - Appends each clarification to `.agent/clarify/clarify-YYYYMMDD.md`, a daily append-only log; never writes `/do` plan files or `DECISIONS.md`
  - The plugin now has 22 skills (18 user-invocable)
- **`commit-attribution-guard` hook**: PreToolUse on `Bash` and `PowerShell` denies a `git commit`, `git merge`, `gh pr create`, or `gh pr edit` command whose commit message or PR body holds AI attribution
  - Denies a Co-Authored-By trailer that names an AI tool or vendor (human co-authors pass), a "Generated with/by" footer, an Assisted-by or Generated-by trailer naming an AI tool, and a `*-Session:` trailer or bare session link at an AI host
  - Reads `-m`, `--message`, `-F`, `--file`, `--trailer`, `--body`, `-b`, `--body-file`, chained commands, heredocs, and PowerShell; does not cover `git tag` or a message built from a variable or stdin
  - Lists up to 5 lines to remove, never rewrites the command, and fails open
- **Health check reports Claude Code's attribution setting**: `/assist-plugin:health` runs the new guard's self-test and reports, read-only, when `attribution.commit` or `attribution.pr` is unset or not `""` in the user, project, or local settings file; the README shows the snippet `{"attribution": {"commit": "", "pr": ""}}`

### Changes

- `prose-gate` and `prose-advisor` skip files under `docs/tts/` in the hook's working directory (not the git root), so voice scripts may use em dashes as pause marks
- The `health` skill now lists `docs/tts/` among the paths the prose hooks skip
- The `commit` and `bump` skills and `rules/assist-plugin-rule.md` state the no-AI-attribution rule: no Co-Authored-By trailer or other attribution line for an AI tool in a commit message or PR body; human co-authors are fine
- The `gather-requirements`, `technical-writing`, and `spec-from-requirements` skills pre-approve writes only to their documented output paths through scoped `Edit(...)` rules in `allowed-tools`, replacing plain `Write` and `Edit`; a write to any other path now asks the user first
  - `gather-requirements`: `./BRD-*.md`, `./URD-*.md`, `./FR-NFR-*.md`, `./requirements-*.json`
  - `spec-from-requirements`: `./specs/spec-*.md`, `./specs/spec-*.json`, `./specs/openapi/*.json`, `./specs/openapi/*.yaml`, `./*/specs/spec-*.md`, `./*/specs/spec-*.json`
  - `technical-writing`: `./README.md` only

## [1.9.0] - 2026-10-12

### New Features

- **/do as a deterministic Communicator state machine**: Ingest, Decompose (structured steps with effect, writes, reads), Clarify, DependencyAnalysis (no shared writes in a wave), AgentSelection, Branch, PlanApproval, Preflight, Dispatch, Display, Cleanup; terminals Complete, Partial, Paused, Cancelled, Error
  - Approval is skipped only for a single ask or explore step; unmatched work goes to Clarify; a failed step skips only its dependents; stop and resume go back through approval
  - Every dispatch carries a 10-field fsa terminal block; relayed questions are verbatim and never widen an approved step; out-of-scope items become new requests
  - Read-only intake review of user-provided spec files before approval; architectural decisions append to `DECISIONS.md` after approval
- **FSA state tables and terminal blocks** for developer-tester, reviewer, code-reviewer, developer, task-plan, and create-test; qa reports an approved or returned Testing Gate verdict
- **New agent `intake-reviewer`** (Read, Grep, Glob only) that reviews user files as untrusted data
- **FSA hooks**: `fsa-write-bar` (developer-tester writes only test paths, never dot folders, `CLAUDE.md`, or `AGENTS.md`; developer never writes test paths) and `fsa-log` (records parsed terminal blocks without message text and warns on illegal traces); `scripts/check-fsa-tables.js` keeps hook tables in sync with the markdown

### Changes

- One coverage bar of >=70% everywhere
- debug and technical-writing tasks route to developer through a named-skill intake; general-purpose is no longer a fallback
- pentest active tests under /do run only commands listed in the approved plan
- Counts: 15 agents, 20 skills

## [1.8.0] - 2026-10-12

### New Features

- **Injection filter hook** (`hooks/injection-filter.js`): a deterministic, fail-open filter for prompt-injection text in untrusted content
  - PostToolUse on `WebFetch`, `WebSearch`, `mcp__*` tools, `Agent` results, and Bash `firecrawl`/`curl`/`wget`/`ctx7`: matching sentences are replaced with a visible marker, invisible Unicode is stripped, and the result is returned in its original shape with a factual note listing rule ids
  - PreToolUse on `Agent`: a matching subagent prompt is rewritten and returned with an `ask` decision; UserPromptSubmit only warns (the typed prompt is never changed or blocked)
  - Eight rule families (instruction override, role reassignment, system-prompt or secret exfiltration, fake chat delimiters, hidden-instruction carriers, tool hijack, data-exfiltration links, concealment); plugin files and sources in `injection-allowlist.json` are skipped
  - `lib/health.js` gains `transform()` (fail-open runtime for filter hooks); the health check self-tests the filter with a known-injection and known-benign corpus and disables it if a benign sample is altered or an injection sample is missed
- **Writing standard and de-slop layer**: one source of truth for how the plugin writes, with hooks, a skill, and a style that apply it
  - `rules/writing-standard.md` holds every rule with its reason and examples; `rules/writing-standard-compact.md` holds the always-on bullets; `scripts/sync-writing-standard.js` rewrites every `## Report Writing Standard` block in `agents/` and `skills/` from the compact file (`--check` exits 1 on drift)
  - `prose-gate` (PreToolUse on `Write`, `Edit`, `MultiEdit`, `NotebookEdit`) denies a prose write only when the text it adds holds a block-tier tell: em dash, chatbot residue, curly quote, or summary-label phrase. Text already in the file is not judged
    - The prose hooks skip files under the system temp directory and any path listed in `prose-gate-allowlist.json` in the plugin data directory (the entry `"*"` disables the gate for all paths). The deny reason names the standard by absolute path and says how to keep verbatim text
  - `prose-advisor` (PostToolUse on the same tools) adds a short advisory note for hedges, intensifiers, AI vocabulary, throat-clearing, binary contrast, en dashes, and prose arrows. It never blocks
  - `writing-context` (SessionStart and SubagentStart) injects the compact standard (about 1,195 characters, about 300 tokens) into the session and into each subagent
  - `hooks/lib/prose-rules.js` is the tell catalog and `hooks/lib/prose-diff.js` finds the added text; all three hooks fail open, only `prose-gate` and `prose-advisor` are self-tested by the health check, and the per-write hooks add about 80 to 110 ms per write
  - Opt-in `assist-plugin:terse` output style (`output-styles/terse.md`): answer first, no preamble, recap, or sign-off. Subagents do not use it
  - New user-invocable `deslop` skill: `/deslop [edit | detect] <file-or-text>` removes AI writing tells from prose; `edit` returns cleaned text and `detect` lists findings. The plugin now has 20 skills (16 user-invocable)
  - New `code` reference `code-slop.md` and a stricter TypeScript rule: `unknown` only at trust boundaries, narrowed immediately; concrete types inside the codebase
  - Review output rules in `do/references/review-protocol.md`, `agents/reviewer.md`, `agents/code-reviewer.md`, and `skills/pr-review`: terse, three-part findings
  - De-slop pass over the plugin's agents, skills, rules, docs, and READMEs: em dashes, curly quotes, prose arrows, and filler words removed

## [1.7.0] - 2026-10-12

### License

- Relicense the marketplace and assist-plugin from MIT to the GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`): both LICENSE files carry the verbatim AGPL v3 text, manifests use the SPDX identifier, hook sources carry SPDX headers, and NOTICE keeps the original MIT notice for derived components. Releases up to and including v1.6.1 remain available under MIT.

## [1.6.1] - 2026-10-12

### Bug Fixes

- Ship `plugins/assist-plugin/hooks/lib/` (`launch.js`, `health.js`). The root `.gitignore` rule `lib/` excluded them from v1.6.0, so installed guards failed open with a launch-error warning on every Bash call; the rule is now anchored to the repo root (`/lib/`).

## [1.6.0] - 2026-10-12

### New Features

- **Fail-open guard hooks and health reporting**
  - Add PreToolUse guards: `sa-mermaid-only` (solutions-architect may run only mermaid-cli with allowlisted flags and relative paths) and `doc-cli-guard` (blocks firecrawl/ctx7 output, endpoint, and shell-operator forms)
  - Guards deny only on a positive match; crashes, unsupported Node (below 6), timeouts, and disabled guards let the command run with a `systemMessage` warning and never exit 2
  - Add SessionStart self-test (silent when healthy; auto-disables a guard that blocks known-safe commands) and `health` skill (`/assist-plugin:health [--clear]`)
- **Worktree and cache cleanup**
  - Add `/branch cleanup [--dry-run]`: removes only merged, clean, unlocked, non-protected worktrees; never `--force` or `-D`; clears the Go build and test cache
  - `/do` runs targeted cleanup for worktrees its own steps created and checks free disk space (asks under 2G) before dispatching agents
- **Pentest references**
  - Web checklist moves to OWASP Top 10:2025 and LLM checklist to the 2026 OWASP LLM Top 10, with mapping tables
  - Dependency-audit table for every ecosystem with read-only commands and mutating flags to avoid
  - Add `tooling.md` (ZAP, Nuclei, Semgrep, CodeQL, garak, promptfoo, PyRIT) and `zap.md` (Docker runbook)

### Changes

- Agents preload dependent skills via `skills:`; internal skills drop `disable-model-invocation`
- researcher gains WebSearch/WebFetch; solutions-architect gains mmdc-only Bash; developer, qa, reviewer, code-reviewer gain LSP; Tools lines match frontmatter
- researcher and solutions-architect route as Opus; planner documented as Sonnet
- Pre-approved commands narrowed to exact forms; anything that runs repo code or installs software prompts; `npx --no` everywhere
- Python guidance prefers uv with pip/pipx fallback; garak and PyRIT documented as global tools and per-repo dev dependencies

### Documentation

- GitHub URLs use `tjmonsi/assist-marketplace-plugin`; root `Claude.md` renamed to `CLAUDE.md` and rewritten
- README adds Recommended CLI Tools, hook health, and corrected installs (bkt from avivsinai/bitbucket-cli, ZAP via Docker)
- Counts updated to 14 agents and 19 skills (15 user-invocable)

## [1.5.0] - 2026-09-24

### New Features

- **Complete Spec-to-Shipped Pipeline**
  - Add `task-plan` skill: Convert feature specifications to ordered implementation steps with file names, requirement IDs, and code skill references
  - Add `code` skill: Shared standards library for developer agent covering 7 languages, 7 frameworks, 35 patterns, plus mandatory logging and error-handling standards
  - Add `create-test` skill: Black-box test generation from acceptance criteria with no implementation knowledge
  - Add `developer-tester` agent: Specialized test writer using create-test skill for behavior-driven testing

- **Security & Quality Assurance Enhancement**
  - Add `pentest` skill: OWASP Top 10 and LLM OWASP Top 10 security testing with numbered reproduction steps
  - Add `integrated-test` skill: Integration and E2E testing patterns with Playwright detection (CLI/MCP availability check)
  - Add `run-test` skill: Test execution, coverage capture (90% target), and consolidated test report generation

### Standards & Doctrines

- **Code Standards (code skill)**
  - Mandatory structured logging with PII/secret redaction (Pino/logging/slog/tracing per language)
  - Defensive error handling at system boundaries with process-level handlers (Node/Python/Go/Rust/C++/Kotlin)
  - Full-chain code traceability comments: `[SPEC-NNN -> FR-NNN -> UC-NNN -> AC-N]`
  - 7 language guides (Go, Rust, Python, TypeScript, JavaScript, Kotlin, C++)
  - 7 framework guides (FastAPI, Fastify, Go-Fiber, NestJS, Nuxt, Vue, Vite)
  - 35 idiomatic patterns covering CRUD, pagination, retry, auth, and background jobs

- **Testing Standards (create-test skill)**
  - Input-space enumeration: valid, invalid, boundary, null/empty, type-mismatch, injection payloads
  - Black-box methodology: test acceptance criteria only, never implementation details
  - Traceability to AC/SPEC/FR/UC requirement IDs in test comments

- **Diagram Generation (solutions-architect enhancement)**
  - Mermaid flowcharts for architecture and data flows (PNG via mermaid-cli when available)
  - Required diagrams in all feature specs with start-to-end data flow visualization

### Agent Enhancements

- **developer agent**: Added persona ("Code is maintainable, readable, elegant"), workflow with code skill standards, pre-test review gate
- **qa agent**: Added pentest/integrated-test/run-test orchestration, Playwright availability detection
- **solutions-architect agent**: Added diagram generation with mermaid-cli detection and fallback

### Governance & Routing

- **Pre-Test Code Review Gate**: Syntactic and semantic consistency check after developer implements, before tester/qa
- **Agent Registry Update**: All 6 new skills documented in agent-registry.md routing table
- **Model Routing**: developer-tester assigned to Sonnet/high effort tier

### Agent & Skill Count Updates

- Total agents increased to 14 (added `developer-tester` agent)
- Total skills increased to 18 (added `task-plan`, `code`, `create-test`, `pentest`, `integrated-test`, `run-test`)
- Version bumped to 1.5.0

## [1.4.0] - 2026-09-24

### Agent & Skill Count Updates

- Total agents increased to 14 (added `developer-tester` agent)
- Total skills increased to 18 (added task-plan, code, create-test, pentest, integrated-test, run-test)
- (Note: Version was immediately bumped to 1.5.0 on same day)

## [1.3.0] - 2026-09-14

### New Features

- **Ask Skill & Agent**
  - Add `/ask [--web] <question>` skill for answering questions using repository + optional web research
  - New `ask` agent to handle research and information retrieval across codebase and internet
  - Integration with router discovery for intelligent agent selection

### Router & Model Optimization

- **Router Plugin Discovery**
  - Enhanced router to auto-discover plugin capability and route complex tasks across specialized agents
  - Improved model assignment strategy based on task complexity and agent role

- **Model Routing Optimization**
  - Assign Sonnet tier to planner agent for better architectural reasoning
  - Assign Haiku tier to commit skill for efficient git message composition
  - Right-size model selection across all agents for token efficiency

### Governance Improvements

- **Review-Fix Protocol Enhancement**
  - Streamline resolution of code review blockers with adversarial self-reflection
  - Apply iteration-loop review process to developer code changes
  - Consistent exit criteria across all review gates

### Documentation Standards

- **Documentation Standard Formalization**
  - Add DOCUMENTATION_STANDARD.md covering AI-slop removal, conciseness, and clarity
  - Establish consistent writing guidelines across all plugin documentation
  - Remove unnecessary verbosity from documentation and specifications

### Bug Fixes

- Em-dash contradiction in ask answer-format template (changed to colon separator)
- Conflicting revision workflow removed (single iteration path per fix-phase-rules)

### Breaking Changes

- **LLM Co-Authorship Removal**
  - Remove Claude/AI tool co-authorship tags from commit messages (human-focused commits)
  - Streamline Git history for better human readability and compliance

### Agent & Skill Count Updates

- Total agents increased to 13 (added `ask` agent)
- Total skills increased to 9 (added `ask` skill)

## [1.2.0] - 2026-08-28

### Governance Enhancements

- **Planning Document Review Gates with Iteration Loops**
  - Add review gates for planner, solutions-architect, requirements-gatherer outputs
  - Creator self-reflection → Reviewer audit → Iteration loop (max 10 or 2 consecutive LGTMs)
  - Reference: planning-review-agents.md with typical iteration counts per agent/document type

- **Developer Code Review Iteration Loops**
  - Extend iteration-based review to OWASP and Code Review gates (same as planning docs)
  - Developer self-reflection step before reviewer audit
  - Exit conditions: 2 consecutive LGTMs OR 10 iterations (escalate to code-reviewer)
  - Reference: developer-self-review.md with pre-submission checklist

- **Reviewer Adversarial Self-Reflection**
  - Add adversarial self-reflection phase for reviewers (before formal audit)
  - Five-category checklist: Errors, Inconsistencies, Assumptions/Edge Cases, Security/Performance, Clarity
  - Applied to all review gates (OWASP, Code Review, Planning Documents)
  - Reference: reviewer-adversarial-reflection.md with examples and workflow

### Documentation & References

- Create planning-review-agents.md: Map planning agents to document types and typical iterations
- Create developer-self-review.md: Pre-submission checklist for developer code quality
- Create reviewer-adversarial-reflection.md: Guide for deliberate issue-finding before formal audit
- Update assist-plugin-rule.md: Add Planning Document Review Gate and Reviewer Adversarial Self-Reflection sections
- Update review-protocol.md: Integrate self-reflection phases into all review workflows

### Improvements

- Unified review process across all deliverables (code and documents)
- Quality improves through multiple iteration cycles (typical: 2-3, max: 10)
- Earlier issue detection via adversarial self-reflection phase
- Clear escalation path after 10 iterations
- Version bump infrastructure (commit tracking)

## [1.1.0] - 2026-08-27

### Security

- **Close 3 HIGH-severity LLM security gaps:**
  - Add `tools:` frontmatter to all 12 agents (restricts tool access per role)
  - Sandbox pr-review skill with mandatory confirmation gate before state changes
  - Fix shell injection vectors in pr-review (use `--body-file` instead of inline strings)
  - Restrict git command wildcards in settings.local.json (`push origin *`, `add -- .`)

### Features

- Add OWASP Top 10 for LLM security checklist (llm-security-checklist.md)
  - 9 LLM-specific security categories with verification steps
  - Explicit audit of agent definitions, skill prompts, routing logic
  - Integration into governance framework as mandatory gate (`✓ LLM Security Clear`)
- Enhance pr-review skill with explicit user confirmation workflow
  - Draft verdict → Ask user for confirmation → Execute only on "yes"
  - Prevents unapproved PR state changes from attacker-controlled PR bodies

### Improvements

- Update token optimization documentation with concrete findings
  - 36.6% average token savings across primary scenarios
  - Defensible marketing claims backed by ground-truth analysis
  - Explanation of scenarios with intentional higher costs (pr-review GitHub support, bump changelog)
- Upgrade planner, solutions-architect, researcher to Opus model tier
- Fix marketplace compliance for `/plugin` discovery (marketplace.json schema)
- Resolve marketplace validation warnings (invalid fields, missing metadata)
- Remove duplicate root-level plugin files (consolidated to plugins/assist-plugin/)
- Restructure as proper Claude marketplace with semantic versioning

### Documentation

- Create comprehensive LLM security review checklist
- Expand governance rules with LLM security gate
- Add fast-track exclusions for prompt-surface files
- Include SLA and merge policy for security gates

## [1.0.0] - 2026-08-20

### Initial Release

- Token-optimized software development plugin
- 12 specialized agents (developer, reviewer, planner, qa, solutions-architect, requirements-gatherer, devops, researcher, code-reviewer, general-purpose, explore, worker)
- 8 skills (do, debug, bump, pr-review, commit, branch, map-project, technical-writing)
- OWASP Top 10 security review gate
- >70% test coverage requirement
- Code reviewer sign-off gate for merge
- Marketplace structure with semantic versioning
- MIT License
