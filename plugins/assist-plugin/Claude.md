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

## Skills (18)

| Skill | Command | Purpose |
|-------|---------|---------|
| **do** | `/do <task>` | Route task to best agent + orchestrate |
| **ask** | `/ask [--web] <question>` | Answer questions using repo + optional web research |
| **debug** | `/debug [analyze\|fix\|review]` | Root cause analysis & iterative fixes |
| **bump** | `/bump [patch\|minor\|major\|auto]` | Semantic versioning & changelog generation |
| **pr-review** | `/pr-review [PR#] [--approve\|--changes-requested]` | Auto-detect GitHub/Bitbucket, review PRs |
| **commit** | `/commit` | Conventional commit with git |
| **branch** | `/branch [create\|switch]` | Branch management |
| **map-project** | `/map-project` | Discover repo structure |
| **technical-writing** | `/technical-writing [docs\|readme]` | Generate documentation |
| **review-md** | `/review-md <path-to-report.md>` | Review reports for consistency, conciseness, and factual accuracy |
| **gather-requirements** | `/gather-requirements [elicit\|document\|review]` | Elicit and document BR/UR/FR/NFR with IEEE 29148 templates and GIVEN/WHEN/THEN criteria |
| **spec-from-requirements** | `/spec-from-requirements [create\|delta\|review]` | Classify-first feature specs with Requirement/Scenario blocks and delta change logs |
| **task-plan** | `/task-plan <spec-file>` | Generate ordered coding steps from feature specs |
| **code** | (loaded by developer) | Language/framework standards, logging, error-handling, traceability conventions |
| **create-test** | (via developer-tester) | Create black-box tests from acceptance criteria only |
| **pentest** | (via qa) | Security testing: OWASP Top 10, LLM OWASP Top 10, dependency audit |
| **integrated-test** | (via qa) | Integration/E2E testing with Playwright, container patterns, Playwright availability check |
| **run-test** | (via qa) | Execute test suites, collect coverage, produce consolidated test report |

## Documentation

- **[SPECIFICATION.md](docs/SPECIFICATION.md)** — Full agent/skill catalog
- **[TOKEN_OPTIMIZATION.md](docs/TOKEN_OPTIMIZATION.md)** — What's included/excluded and why
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Design rationale and structure
- **[DOCUMENTATION_STANDARD.md](docs/DOCUMENTATION_STANDARD.md)** — Writing standards, AI-slop removal, conciseness checklist
- **[TRACING_MARKERS.md](docs/TRACING_MARKERS.md)** — Requirement/spec traceability marker convention

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

