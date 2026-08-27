# assist-plugin

Token-optimized software development plugin for orchestrating specialized agents and skills across the full development lifecycle.

## Features

- **12 Specialized Agents** — developer, reviewer, planner, qa, solutions-architect, requirements-gatherer, devops, researcher, code-reviewer, explore, general-purpose, worker
- **6 Core Skills** — `do` (orchestrator), `debug` (RCA + fix cycles), `commit`, `branch`, `map-project`, `technical-writing`
- **Smart Model Routing** — Opus for decisions, Sonnet for work, Haiku for search
- **Governance Gates** — Security (OWASP), Testing (>70%), Code Review (sign-off)
- **Token Optimized** — ~65% footprint of software-development plugin with full feature parity

## Quick Start

Install this plugin to your Claude Code environment, then:

```bash
/do implement user authentication in the backend
/debug analyze "Button doesn't respond to clicks"
/map-project
/commit
/branch create feature/new-api
```

## Documentation

- **[Claude.md](Claude.md)** — Plugin overview and command reference
- **[docs/SPECIFICATION.md](docs/SPECIFICATION.md)** — Full agent and skill catalog
- **[docs/TOKEN_OPTIMIZATION.md](docs/TOKEN_OPTIMIZATION.md)** — What's included/excluded and why
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — System design and extension points
- **[rules/assist-plugin-rule.md](rules/assist-plugin-rule.md)** — Governance and review gates

## Installation

Clone this repository and register with Claude Code:

```bash
git clone <repo-url> ~/.claude/plugins/assist-plugin
```

Or use Claude Code's marketplace if available.

## Governance

All code changes must pass:
- **Security Review** (OWASP Top 10)
- **Testing Gates** (>70% coverage)
- **Code Review** (formal sign-off for critical changes)

See [rules/assist-plugin-rule.md](rules/assist-plugin-rule.md) for details.

## License

MIT

## Support

For issues or questions, see [docs/SPECIFICATION.md](docs/SPECIFICATION.md) or create an issue in this repository.

