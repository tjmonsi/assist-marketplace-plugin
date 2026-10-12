# assist-plugin

Token-optimized software development plugin for orchestrating specialized agents and skills across the full development lifecycle.

## Quick Start

Use `/do` to route any development task to the right agent:

```
/do implement user authentication in the backend
/do review this PR for security issues
/do design the API schema for the new feature
```

## Agents (14)

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
| **general-purpose** | Catch-all for unmatched tasks |
| **explore** | Fast read-only code search |
| **worker** | Multi-discipline fallback |

## Skills (20)

| Skill | Command | Purpose |
|-------|---------|---------|
| **do** | `/do [task description or prompt]` | Route task to best agent + orchestrate |
| **ask** | `/ask [--web] <question>` | Answer questions using repo + optional web research |
| **debug** | `/debug [analyze \| fix \| review] [description \| file:line]` | Root cause analysis & iterative fixes |
| **bump** | `/bump [patch \| minor \| major \| auto] [--path PATH] [--no-tag] [--no-commit]` | Semantic versioning & changelog generation |
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
| **health** | `/health [--clear]` | Check hook health: Node version, guard, injection-filter, and prose-hook self-tests, recent hook failures, disabled guards |
| **deslop** | `/deslop [edit \| detect] <file-or-text>` | Remove AI writing tells from prose; edit returns cleaned text, detect lists findings |
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

- **prose-gate** (PreToolUse on `Write`, `Edit`, `MultiEdit`, `NotebookEdit`): denies only added block-tier tells (em dash, chatbot residue, curly quotes, summary-label phrases) in prose files.
- **prose-advisor** (PostToolUse on the same tools): adds an advisory note about the added advisory-tier tells; never blocks.
- **writing-context** (SessionStart and SubagentStart): injects `rules/writing-standard-compact.md` (about 1,195 characters, about 300 tokens per session and per subagent).
- **Output style** `assist-plugin:terse`: opt-in, not applied to subagents.
- All hooks fail open. The per-write hooks cost about 80 to 110 ms per write.

## Getting Started

1. Install this plugin to your Claude Code environment
2. Use `/do` to start delegating tasks
3. Review [docs/SPECIFICATION.md](docs/SPECIFICATION.md) for detailed workflows
4. Check [docs/TOKEN_OPTIMIZATION.md](docs/TOKEN_OPTIMIZATION.md) to understand scope

## Governance

- **Security:** OWASP top 10 review on code changes
- **Testing:** >70% coverage required for new code
- **Review:** Code reviewer sign-off required before merge
- See [rules/assist-plugin-rule.md](rules/assist-plugin-rule.md)

