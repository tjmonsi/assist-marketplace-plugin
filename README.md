# assist-plugin-marketplace

Claude marketplace for token-optimized development plugins.

## Quick Start

Install the marketplace and enable assist-plugin:

```bash
/plugin marketplace add tjmonsi/assist-plugin-marketplace
/plugin install assist-plugin@assist-plugin-marketplace
/plugin enable assist-plugin
```

Then use the `/do` orchestrator:

```bash
/do implement user authentication
/pr-review 123 --approve
/bump minor
/debug analyze
```

## What's Inside

### assist-plugin v1.0.0

**8 specialized skills:**
- `do` — Task orchestration and routing
- `debug` — Root cause analysis + iterative fixes
- `bump` — Semantic versioning & changelog generation
- `pr-review` — GitHub/Bitbucket PR review with auto-detection
- `commit` — Conventional commits
- `branch` — Git branch management
- `map-project` — Repository discovery
- `technical-writing` — Documentation generation

**12 expert agents:**
- developer, reviewer, planner, qa, solutions-architect, requirements-gatherer, devops, researcher, code-reviewer, explore, general-purpose, worker

**Governance gates:**
- OWASP Top 10 security review
- >70% test coverage requirement
- Formal code review sign-off

**Platform support:**
- GitHub (auto-detect, use `gh` CLI)
- Bitbucket Cloud (auto-detect, use `bkt` CLI)
- Bitbucket Server/DC (auto-detect)

## Documentation

- **[plugins/assist-plugin/Claude.md](plugins/assist-plugin/Claude.md)** — Quick reference
- **[plugins/assist-plugin/docs/SPECIFICATION.md](plugins/assist-plugin/docs/SPECIFICATION.md)** — Full agent/skill catalog
- **[plugins/assist-plugin/docs/ARCHITECTURE.md](plugins/assist-plugin/docs/ARCHITECTURE.md)** — System design
- **[plugins/assist-plugin/docs/TOKEN_OPTIMIZATION.md](plugins/assist-plugin/docs/TOKEN_OPTIMIZATION.md)** — Optimization strategy
- **[MARKETPLACE.md](MARKETPLACE.md)** — Marketplace overview

## Installation

### Option 1: Claude Code Plugin Command

```bash
/plugin marketplace add tjmonsi/assist-plugin-marketplace
/plugin install assist-plugin@assist-plugin-marketplace
/plugin enable assist-plugin
```

### Option 2: Manual Git Clone

```bash
git clone https://github.com/tjmonsi/assist-plugin-marketplace.git ~/.claude/plugins/assist-plugin-marketplace
```

### Option 3: Manual Git Clone (Self-Hosted)

```bash
git clone ssh://git@git.tjmonsi.com/tjmonsi/assist-plugin-marketplace.git ~/.claude/plugins/assist-plugin-marketplace
```

## Marketplace Structure

```
assist-plugin-marketplace/
├── .claude-plugin/marketplace.json (marketplace definition)
├── MARKETPLACE.md (marketplace overview)
├── README.md (this file)
├── plugins/
│   └── assist-plugin/
│       ├── .claude-plugin/plugin.json (plugin metadata)
│       ├── agents/ (12 agent definitions)
│       ├── skills/ (8 skill implementations)
│       ├── rules/ (governance)
│       ├── docs/ (comprehensive documentation)
│       ├── Claude.md (quick reference)
│       ├── NOTICE (attribution)
│       └── LICENSE (MIT)
└── (future plugins will be added here)
```

## License

MIT — See individual plugin LICENSE files for details.

## Support

- **Documentation:** See [MARKETPLACE.md](MARKETPLACE.md) and plugin docs
- **Repository:** https://github.com/tjmonsi/assist-plugin-marketplace
- **Issues:** Open an issue on GitHub or check plugin documentation

---

**Status:** Ready for Kollab IP sign-off → GitHub publication → Claude marketplace registration
