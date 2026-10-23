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
- **fsa-write-bar** (PreToolUse on `Write`, `Edit`, `MultiEdit`, `NotebookEdit`): keeps `developer-tester` to test paths and `developer` out of them; limits `task-planner` to `docs/task-plans/task-plan-*.md` under the session's git root; bars `developer-tester`, `task-planner`, `requirements-gatherer`, and `solutions-architect` from dot paths, `CLAUDE.md`, `CLAUDE.local.md`, and `AGENTS.md`. Every subagent (any plugin, when `agent_id` is present) is denied `.agent/main-plan/**` and `DECISIONS.md`, and every subagent is denied a path over 4096 characters or with a NUL character. Bash writes are not covered; symlinks are not resolved.
- **sa-mermaid-only** (PreToolUse on `Bash`): limits `solutions-architect` to `which mmdc`, `where mmdc`, `mmdc --version`, and `mmdc` with a fixed flag allowlist. `-i` takes a `.mmd` file and `-o` takes a `.svg`, `.png`, or `.pdf` file, each under `specs/` or `<dir>/specs/`, as a relative path or an absolute path under the git root.
- **doc-cli-guard** (PreToolUse on `Bash` and `PowerShell`): denies `ctx7` and `firecrawl` calls with output or endpoint flags, shell operators, or credential commands. Judges each chained part; reads Windows names, runners. Best-effort, known gaps.
- **pr-post-ask** (PreToolUse on `Bash` and `PowerShell`, every session and every agent): asks (never denies) before `gh pr review`, `merge`, `comment`, and `close`, `bkt pr approve`, `comment`, `decline`, `close`, and `merge`, and a `bkt api` call that may write. Best-effort, known gaps, fails open. The health check self-tests it as a guard. A deny from another hook wins over its ask. Unverified: whether the prompt appears in `bypassPermissions` mode or plan mode, and whether an installed mod can approve a call the hook would prompt for.
- **injection-filter** (PreToolUse on `Agent`; PostToolUse on `WebFetch`, `WebSearch`, `mcp__*`, `Agent`, and `Bash` and `PowerShell` downloads; UserPromptSubmit): replaces injection phrasing with a marker; warns on typed prompts. Never blocks.
- **writing-context** (SessionStart and SubagentStart): injects `rules/writing-standard-compact.md` (about 1,195 characters, about 300 tokens per session and per subagent). The health check self-tests it; a failure is reported and never disables it.
- **Output style** `assist-plugin:terse`: opt-in, not applied to subagents.
- All hooks fail open. The per-write hooks cost about 80 to 110 ms per write.

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

