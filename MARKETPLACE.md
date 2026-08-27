# assist-plugin-marketplace

Token-optimized Claude marketplace for development plugins.

## Plugins

### assist-plugin v1.0.0

Token-optimized software development plugin with 8 specialized skills, 12 expert agents, and governance gates.

**Features:**
- 8 skills: do, debug, bump, pr-review, commit, branch, map-project, technical-writing
- 12 agents: developer, reviewer, planner, qa, solutions-architect, requirements-gatherer, devops, researcher, code-reviewer, explore, general-purpose, worker
- Governance: OWASP security, >70% test coverage, code review gates
- Auto-detection: GitHub/Bitbucket platform detection
- Full documentation: SPECIFICATION, ARCHITECTURE, TOKEN_OPTIMIZATION

**Location:** `assist-plugin/1.0.0/`

**Quick start:**
```bash
/do implement a feature
/pr-review 123 --approve
/bump minor
/debug analyze
```

## Marketplace Structure

```
assist-plugin-marketplace/
├── .claude-plugin/plugin.json (marketplace metadata)
├── MARKETPLACE.md (this file)
├── README.md (marketplace overview)
├── assist-plugin/
│   └── 1.0.0/
│       ├── .claude-plugin/plugin.json (plugin metadata)
│       ├── agents/ (12 agent definitions)
│       ├── skills/ (8 skill implementations)
│       ├── rules/ (governance)
│       ├── docs/ (comprehensive documentation)
│       ├── Claude.md (quick reference)
│       ├── NOTICE (attribution)
│       └── LICENSE (MIT)
└── (future plugins)
```

## Installation

### Method 1: From Claude Code

```bash
/plugin install assist-plugin-marketplace
/plugin enable assist-plugin
```

### Method 2: Manual Installation

```bash
git clone https://github.com/tjmonsi/assist-plugin-marketplace.git ~/.claude/plugins/assist-plugin-marketplace
claude plugins reload
```

## Versioning

Each plugin follows semantic versioning. Version 1.0.0 is available in `assist-plugin/1.0.0/`.

Future versions will be added as `assist-plugin/1.1.0/`, `assist-plugin/2.0.0/`, etc.

## License

All plugins in this marketplace are licensed under MIT. See individual plugin LICENSE files for details.

## Support

For issues, feature requests, or contributions, visit the repository or check the plugin's documentation.
