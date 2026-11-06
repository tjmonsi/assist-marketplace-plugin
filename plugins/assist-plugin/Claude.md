# assist-plugin

Token-optimized software development plugin for orchestrating specialized agents and skills across the full development lifecycle.

## Quick Start

Use `/do` to route any development task to the right agent:

```
/do implement user authentication in the backend
/do review this PR for security issues
/do design the API schema for the new feature
```

## Agents (16)

| Agent | Purpose |
|-------|---------|
| **ask** | Answer questions using repo + web research |
| **developer** | Write, fix, refactor code |
| **developer-tester** | Create black-box tests from acceptance criteria |
| **reviewer** | Code review, security, quality checks |
| **planner** | Architecture, design, planning |
| **qa** | Testing, validation, acceptance; run pentest, integration, security tests |
| **solutions-architect** | Feature specs, data flow, contracts, architecture diagrams |
| **requirements-gatherer** | Elicitation, BRD/URD, FR+NFR |
| **devops** | CI/CD, infrastructure, deployment |
| **researcher** | Web research, documentation audit |
| **code-reviewer** | Formal code review (specialized) |
| **intake-reviewer** | Read-only intake review before `/do` plans write steps: `review` audits a user-provided spec or requirements file; `conflict-check` compares a build request with existing requirements, specs, task plans, and `DECISIONS.md` |
| **task-planner** | Turn an approved spec into an ordered task plan; writes only `docs/task-plans/task-plan-*.md` |
| **general-purpose** | Ad-hoc analysis and experimentation when /do explicitly matches it; unmatched work goes to Clarify |
| **explore** | Fast read-only code search |
| **worker** | Multi-discipline fallback |

## Skills (22)

| Skill | Command | Purpose |
|-------|---------|---------|
| **do** | `/do [task description or prompt]` | Route task to best agent + orchestrate; a build request gets requirements, a spec, and a task plan approved first |
| **ask** | `/ask [--web] <question>` | Answer questions using repo + optional web research |
| **debug** | `/debug [analyze \| fix \| review] [description \| file:line]` | Root cause analysis & iterative fixes |
| **bump** | `/bump [patch \| minor \| major \| auto] [--path PATH] [--no-tag] [--no-commit] [--no-changelog]` | Semantic versioning & changelog generation |
| **pr-review** | `/pr-review [PR#\|branch-name] [--approve\|--changes-requested\|--comment] [--message TEXT]` | Auto-detect GitHub/Bitbucket, review PRs |
| **commit** | `/commit [--squash] [--amend] [--scope SCOPE] [TYPE: message]` | Conventional commit with git |
| **branch** | `/branch [create \| switch \| list \| cleanup] [branch-name \| --dry-run]` | Branch management and merged worktree cleanup |
| **map-project** | `/map-project` | Discover repo structure |
| **technical-writing** | `/technical-writing [docs \| readme \| guide \| api] [topic \| file]` | Generate documentation |
| **review-md** | `/review-md <path-to-report.md>` | Review reports for consistency, conciseness, and factual accuracy |
| **gather-requirements** | `/gather-requirements [elicit \| document \| review] [topic \| file]` | Elicit and document BR/UR/FR/NFR with IEEE 29148 templates and GIVEN/WHEN/THEN criteria |
| **spec-from-requirements** | `/spec-from-requirements [create \| delta \| review] [feature-name \| file-path]` | Classify-first feature specs with Requirement/Scenario blocks and delta change logs |
| **task-plan** | `/task-plan <spec-file-or-prompt> [target-language]` | Generate ordered coding steps from feature specs |
| **create-test** | `/create-test [spec-file \| feature-name] [language]` | Create black-box tests from acceptance criteria only |
| **health** | `/health [--clear]` | Check hook health: Node version, guard, injection-filter, prose-hook, FSA-hook, and writing-context self-tests, recent hook failures, subagent reports with terminal-block problems, disabled guards |
| **deslop** | `/deslop [edit \| detect] <file-or-text>` | Remove AI writing tells from prose; edit returns cleaned text, detect lists findings |
| **voice-script** | `/voice-script [topic \| draft-file]` | Write a paste-ready TTS script for a chosen model with its own tags; saves to `docs/tts/` |
| **clarify** | `/clarify [what is unclear]` | Explain unclear points with evidence, ask the user about points only the user can settle, log each to `.agent/clarify/` |
| **code** | (preloaded by developer) | Language/framework standards, logging, error-handling, traceability conventions |
| **pentest** | (preloaded by qa) | Security testing: OWASP Top 10, LLM OWASP Top 10, dependency audit |
| **integrated-test** | (preloaded by qa) | Integration/E2E testing with Playwright, container patterns, Playwright availability check |
| **run-test** | (preloaded by qa) | Execute test suites, collect coverage, produce consolidated test report |

## Documentation

- **[SPECIFICATION.md](docs/SPECIFICATION.md)**: Full agent/skill catalog
- **[TOKEN_OPTIMIZATION.md](docs/TOKEN_OPTIMIZATION.md)**: What's included/excluded and why
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)**: Design rationale and structure
- **[writing-standard.md](rules/writing-standard.md)**: Writing rules and AI-slop removal tiers (source of truth)
- **[DOCUMENTATION_STANDARD.md](docs/DOCUMENTATION_STANDARD.md)**: Documentation structure and conciseness checklist
- **[TRACING_MARKERS.md](docs/TRACING_MARKERS.md)**: Requirement/spec traceability marker convention

## Hooks and writing standard

[rules/writing-standard.md](rules/writing-standard.md) is the source of truth for how agents, skills, and hooks write. Edit rules there first, then update `rules/writing-standard-compact.md` and `hooks/lib/prose-rules.js` when the rule appears in them, then run `node scripts/sync-writing-standard.js`.

- **prose-gate** (PreToolUse on `Write`, `Edit`, `MultiEdit`, `NotebookEdit`): denies only added block-tier tells (em dash, chatbot residue, curly quotes, summary-label phrases) in prose files. Files under `docs/tts/` are judged like other prose, with fenced blocks exempt.
- **prose-advisor** (PostToolUse on the same tools): adds an advisory note about the added advisory-tier tells; never blocks.
- **commit-attribution-guard** (PreToolUse on `Bash` and `PowerShell`): denies `git commit` and `git merge` (with `-m`, `--message`, `-F`, `--file`, `--trailer`) and `gh pr create` and `gh pr edit` (with `--body`, `-b`, `--body-file`, `-F`) when the message or body holds an AI attribution line: a Co-Authored-By trailer naming an AI tool or vendor (human co-authors pass), a "Generated with/by" footer, an Assisted-by or Generated-by trailer, or a `*-Session:` trailer or bare session link at an AI host. It lists up to 5 lines to remove, never rewrites the command, and does not cover `git tag` or a message built from a variable or stdin. `/assist-plugin:health` reports when Claude Code's `attribution.commit` or `attribution.pr` setting is unset or not `""`.
- **fsa-write-bar** (PreToolUse on `Write`, `Edit`, `MultiEdit`, `NotebookEdit`, and `Bash`): keeps `developer-tester` to test paths and `developer` out of them; limits `task-planner` to `docs/task-plans/task-plan-*.md` under the session's git root; bars `developer-tester`, `task-planner`, `requirements-gatherer`, and `solutions-architect` from dot paths, `CLAUDE.md`, `CLAUDE.local.md`, and `AGENTS.md`. Every subagent (any plugin, when `agent_id` is present) is denied `.agent/main-plan/**` and `DECISIONS.md`, and every subagent is denied a path over 4096 characters or with a NUL character. A second registration on `Bash` denies a subagent shell command that writes a protected path (`.agent/main-plan/**`, `DECISIONS.md`, the governance audit log, the confirmation store) through redirection, `tee`, `sed -i`, `cp`, `mv`, or `rm`; reads stay allowed and the main session is not judged. Known limits: a command built from a variable, a command string run by another program, symlinks (not resolved), a script piped into a shell, and PowerShell write verbs.
- **sa-mermaid-only** (PreToolUse on `Bash`): limits `solutions-architect` to `which mmdc`, `where mmdc`, `mmdc --version`, and `mmdc` with a fixed flag allowlist. `-i` takes a `.mmd` file and `-o` takes a `.svg`, `.png`, or `.pdf` file, each under `specs/` or `<dir>/specs/`, as a relative path or an absolute path under the git root.
- **doc-cli-guard** (PreToolUse on `Bash` and `PowerShell`): denies `ctx7` and `firecrawl` calls with output or endpoint flags, shell operators, or credential commands. Judges each chained part; reads Windows names, runners. Best-effort, known gaps.
- **pr-post-ask** (PreToolUse on `Bash` and `PowerShell`, every session and every agent): asks (never denies) before `gh pr review`, `merge`, `comment`, and `close`, `bkt pr approve`, `comment`, `decline`, `close`, and `merge`, and a `bkt api` call that may write. Best-effort, known gaps, fails open. The health check self-tests it as a guard. A deny from another hook wins over its ask. Unverified: whether the prompt appears in `bypassPermissions` mode or plan mode, and whether an installed mod can approve a call the hook would prompt for.
- **phi-outbound-guard** (PreToolUse on `WebFetch`, `Bash`, and `PowerShell`): denies a `WebFetch` call or a `gh pr` or `bkt pr` post command whose payload matches a `phi_patterns` entry or names a PHI-tagged path, and, while HIPAA is enforced, a call to an external system with no BAA reference in `profile.json`. Log-only without a `profile.json`. Security-critical: fails closed for a covered call when it errors or times out after reading its input. Detailed in the Outbound data guards section of `rules/assist-plugin-rule.md`. The health check self-tests it as a guard.
- **ferpa-disclosure-guard** (PreToolUse on `WebFetch`, `Bash`, and `PowerShell`): for a call that carries education-record data, requires a `Receiving-Party` on the `ferpa_receiving_parties` allowlist and a stated `Legitimate-Interest`, records one `ferpa-disclosure` event, and denies a call that cannot be recorded. A party in `ferpa_exceptions` passes with no entry. Status: to verify; not full 34 CFR 99 compliance. Security-critical: fails closed for a covered call like `phi-outbound-guard`. The health check self-tests it as a guard.
- **injection-filter** (PreToolUse on `Agent`; PostToolUse on `WebFetch`, `WebSearch`, `mcp__*`, `Agent`, and `Bash` and `PowerShell` downloads; UserPromptSubmit): replaces injection phrasing with a marker; warns on typed prompts. Never blocks.
- **writing-context** (SessionStart and SubagentStart): injects `rules/writing-standard-compact.md` (about 1,195 characters, about 300 tokens per session and per subagent). The health check self-tests it; a failure is reported and never disables it.
- **audit-log** (PostToolUse on every tool): appends one access record per tool call (tool name, path relative to the project root when the tool names one, agent identity) to the hash-chained governance audit log `.agent/logs/governance/audit.jsonl`. The record never holds a command, prompt, file content, tool result, or secret. Always on, never blocks, fails open. The health check self-tests it as report-only. `scripts/verify-audit-chain.js` (or `/assist-plugin:health --verify-audit`) checks the chain. `/assist-plugin:health --export-evidence --from YYYY-MM-DD --to YYYY-MM-DD` (or `scripts/export-control-evidence.js`) skips the self-tests and counts the control events in the range by type: denies, asks, gate evidence, approvals, disclosures, and logged disablements. It verifies the chain first and reports `UNVERIFIED` on a break.
- **gate-evidence** (PostToolUse and PostToolUseFailure on `Bash`): records the exit code, and the coverage value when there is one, of an allowlisted test, coverage, or in-plugin scanner command as a `gate-evidence` event in the audit log, so a deterministic gate (Coverage >=70%, a test-runner exit) clears on a hook-written record. The record holds a fixed command identifier, never the command text or its output; a command off the allowlist leaves no record. Never blocks, fails open; the self-test is report-only.
- **goal-guard** (PostToolUse on `WebFetch`, `WebSearch`, and `mcp__*`): advisory check of the tool result against a fixed hijack rule set in `hooks/lib/hijack-rules.js`; no model call and no network request. A match appends a would-deny record to the audit log and a clean result appends a `pass` record, neither holding result text, URL, or query. It withholds and rewrites nothing, so it never blocks. Promotion to blocking is a later step. The self-test is report-only.
- **purpose-capture** (UserPromptSubmit): when the first non-blank line of a typed message starts with `Purpose:` (any case) and holds 1 to 200 characters, writes the session purpose record with `fs`, the same trust model as the confirmation store. It reads only the typed prompt and the session id, never model output or a tool result, and the write bar denies every tool caller a write of the record. No declaration writes nothing, and the message always passes. Fails open.
- **data-access-log** (PreToolUse on `Read`, `Grep`, `Glob`, `Write`, `Edit`, `MultiEdit`, and `NotebookEdit`): appends one `data-access` record to the governance audit log for each call that touches a path tagged `student-record` (FERPA) or `PHI` (HIPAA) in `.agent/governance/profile.json`, with the path, data class, agent identity, human authorizer, tool, and the purpose from the session purpose record (`unstated` and flagged for review when none). It never denies and holds no file content. Report-only self-test, fails open.
- **Output style** `assist-plugin:terse`: opt-in, not applied to subagents.
- All hooks fail open except the security-critical guards (the NFR-028 class: pr-verdict-guard, phi-outbound-guard, and ferpa-disclosure-guard), which fail closed for their guarded class after reading input. See the Hook Fail-Open Rule in `rules/assist-plugin-rule.md`. The per-write hooks cost about 80 to 110 ms per write.

## Getting Started

1. Install this plugin to your Claude Code environment
2. Use `/do` to start delegating tasks
3. Review [docs/SPECIFICATION.md](docs/SPECIFICATION.md) for detailed workflows
4. Check [docs/TOKEN_OPTIMIZATION.md](docs/TOKEN_OPTIMIZATION.md) to understand scope

## Governance

- **Security:** OWASP top 10 review on code changes
- **Testing:** >=70% coverage required for new code
- **Review:** Code reviewer sign-off required before merge
- See [rules/assist-plugin-rule.md](rules/assist-plugin-rule.md)

