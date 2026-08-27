# assist-plugin

Token-optimized software development plugin for orchestrating specialized agents and skills across the full development lifecycle.

## Quick Start

Use `/do` to route any development task to the right agent:

```
/do implement user authentication in the backend
/do review this PR for security issues
/do design the API schema for the new feature
```

## Agents

| Agent | Purpose |
|-------|---------|
| **developer** | Write, fix, refactor code |
| **reviewer** | Code review, security, quality checks |
| **planner** | Architecture, design, planning |
| **qa** | Testing, validation, acceptance |
| **solutions-architect** | Feature specs, data flow, contracts |
| **requirements-gatherer** | Elicitation, BRD/URD, FR+NFR |
| **devops** | CI/CD, infrastructure, deployment |
| **researcher** | Web research, documentation audit |
| **code-reviewer** | Formal code review (specialized) |
| **general-purpose** | Catch-all for unmatched tasks |
| **explore** | Fast read-only code search |
| **worker** | Multi-discipline fallback |

## Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| **do** | `/do <task>` | Route task to best agent + orchestrate |
| **debug** | `/debug [analyze\|fix\|review]` | Root cause analysis & iterative fixes |
| **bump** | `/bump [patch\|minor\|major\|auto]` | Semantic versioning & changelog generation |
| **commit** | `/commit` | Conventional commit with git |
| **branch** | `/branch [create\|switch]` | Branch management |
| **map-project** | `/map-project` | Discover repo structure |
| **technical-writing** | `/technical-writing [docs\|readme]` | Generate documentation |

## Documentation

- **[SPECIFICATION.md](docs/SPECIFICATION.md)** — Full agent/skill catalog
- **[TOKEN_OPTIMIZATION.md](docs/TOKEN_OPTIMIZATION.md)** — What's included/excluded and why
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Design rationale and structure

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

