# assist-plugin-marketplace

Token-optimized Claude marketplace for development plugins.

## Plugins

### assist-plugin v1.6.1

Token-optimized software development plugin with 19 skills (15 user-invocable, 4 internal), 14 expert agents, and governance gates.

**Features:**
- 15 user-invocable skills: do, ask, debug, bump, pr-review, commit, branch, map-project, technical-writing, review-md, gather-requirements, spec-from-requirements, task-plan, create-test, health
- 4 internal skills (loaded by agents): code, pentest, integrated-test, run-test
- 14 agents: ask, code-reviewer, developer, developer-tester, devops, explore, general-purpose, planner, qa, requirements-gatherer, researcher, reviewer, solutions-architect, worker
- Governance: OWASP security, >70% test coverage, code review gates
- Auto-detection: GitHub/Bitbucket platform detection
- Full documentation: SPECIFICATION, ARCHITECTURE, TOKEN_OPTIMIZATION, DOCUMENTATION_STANDARD, TRACING_MARKERS

**Location:** `plugins/assist-plugin/`

**Quick start:**
```bash
/do implement a feature
/pr-review 123 --approve
/bump minor
/debug analyze
```

## Marketplace Structure

```
assist-marketplace-plugin/
├── .claude-plugin/marketplace.json (marketplace metadata)
├── LICENSE (AGPL-3.0-or-later)
├── NOTICE (attribution)
├── CHANGELOG.md (release history)
├── CLAUDE.md (repo quick reference)
├── MARKETPLACE.md (this file)
├── README.md (marketplace overview)
└── plugins/
    └── assist-plugin/
        ├── .claude-plugin/plugin.json (plugin metadata)
        ├── agents/ (14 agent definitions)
        ├── skills/ (19 skills: 15 user-invocable, 4 internal)
        ├── hooks/ (fail-open PreToolUse guards and health check)
        ├── rules/ (governance)
        ├── docs/ (comprehensive documentation)
        ├── Claude.md (quick reference)
        ├── NOTICE (attribution)
        └── LICENSE (AGPL-3.0-or-later)
```

## Installation

### Method 1: From Claude Code

```bash
/plugin marketplace add tjmonsi/assist-marketplace-plugin
/plugin install assist-plugin@assist-plugin-marketplace
/plugin enable assist-plugin
```

### Method 2: Manual Git Clone

```bash
git clone https://github.com/tjmonsi/assist-marketplace-plugin.git ~/.claude/plugins/marketplaces/assist-plugin-marketplace
/plugin reload
```

## Versioning

Each plugin follows semantic versioning. Version 1.6.1 is available in `plugins/assist-plugin/`.

Future versions will follow the same pattern: a single `plugins/assist-plugin/` directory with versioning managed through git tags (e.g., `assist-plugin--v1.1.0`, `assist-plugin--v2.0.0`).

## License

All plugins in this marketplace are licensed under the GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later). See [LICENSE](LICENSE) and each plugin's LICENSE and NOTICE files. Releases up to and including v1.6.1 were published under the MIT License.

## Support

For issues, feature requests, or contributions, visit the repository or check the plugin's documentation.
