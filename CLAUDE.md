# assist-marketplace-plugin

Claude Code marketplace hosting `assist-plugin`, a token-optimized software development plugin that orchestrates specialized agents and skills across the full development lifecycle.

## Repository

- **GitHub repo:** `tjmonsi/assist-marketplace-plugin`
- **Marketplace name:** `assist-plugin-marketplace` (from `.claude-plugin/marketplace.json`)
- **Install id:** `assist-plugin@assist-plugin-marketplace`
- **Plugin:** `plugins/assist-plugin` (v1.10.0)

GitHub URLs and `/plugin marketplace add` use the repo path (`tjmonsi/assist-marketplace-plugin`). Install ids (`/plugin install assist-plugin@assist-plugin-marketplace`) use the marketplace name (`assist-plugin-marketplace`). Do not rename the marketplace; it breaks existing installs.

## Quick Start

Use `/do` to route any development task to the right agent:

```
/do implement user authentication in the backend
/do review this PR for security issues
/do design the API schema for the new feature
```

## Agents (15)

| Agent | Purpose |
|-------|---------|
| **ask** | Answer questions using repo search and optional web research |
| **code-reviewer** | Formal line-by-line code review and sign-off |
| **developer** | Write, fix, and refactor code from specs |
| **developer-tester** | Write black-box acceptance-criteria tests without reading implementation |
| **devops** | CI/CD, infrastructure, deployment, monitoring |
| **explore** | Fast read-only code search |
| **intake-reviewer** | Read-only intake review of a user spec, requirements, or instructions file before `/do` plans write steps |
| **general-purpose** | Ad-hoc analysis and experimentation when /do explicitly matches it; unmatched work goes to Clarify |
| **planner** | Architecture, roadmaps, dependency and risk analysis |
| **qa** | Test plans, acceptance validation, pentest, integration and coverage checks |
| **requirements-gatherer** | Requirements elicitation, BRD/URD, FR and NFR |
| **researcher** | Web research, documentation audit, best practices |
| **reviewer** | Code review for bugs, security (OWASP), and quality |
| **solutions-architect** | Requirements to specs, APIs, schemas, data flows |
| **worker** | Multi-discipline generalist for small features |

## Skills (22)

### User-invocable (18)

| Skill | Command | Purpose |
|-------|---------|---------|
| **do** | `/do [task description or prompt]` | Route a task to the best agent and orchestrate with review loops |
| **ask** | `/ask [--web] <question>` | Answer questions from the repo, optionally with web research |
| **debug** | `/debug [analyze \| fix \| review] [description \| file:line]` | Root cause analysis and iterative fixes |
| **bump** | `/bump [patch \| minor \| major \| auto] [--path PATH] [--no-tag] [--no-commit]` | Semantic version bump with changelog generation |
| **pr-review** | `/pr-review [PR#\|branch-name] [--approve\|--changes-requested\|--comment] [--message TEXT]` | Review GitHub or Bitbucket PRs with platform auto-detection |
| **commit** | `/commit [--squash] [--amend] [--scope SCOPE] [TYPE: message]` | Create conventional commits |
| **branch** | `/branch [create \| switch \| list \| cleanup] [branch-name \| --dry-run]` | Create, switch, and list git branches; clean up merged worktrees and branches, and clear the Go build cache |
| **map-project** | `/map-project` | Discover repo structure, tech stack, and dependencies |
| **technical-writing** | `/technical-writing [docs \| readme \| guide \| api] [topic \| file]` | Generate and update technical documentation |
| **review-md** | `/review-md <path-to-report.md>` | Review markdown reports for consistency, conciseness, and accuracy |
| **gather-requirements** | `/gather-requirements [elicit \| document \| review] [topic \| file]` | Elicit and document requirements (IEEE 29148, RFC 2119) |
| **spec-from-requirements** | `/spec-from-requirements [create \| delta \| review] [feature-name \| file-path]` | Write feature specs and delta change logs from requirements |
| **task-plan** | `/task-plan <spec-file-or-prompt> [target-language]` | Turn a spec into ordered coding steps |
| **create-test** | `/create-test [spec-file \| feature-name] [language]` | Generate black-box acceptance-criteria tests (also used by developer-tester) |
| **health** | `/health [--clear]` | Check hook health: Node version, guard, injection-filter, and prose-hook self-tests, recent hook failures, disabled guards |
| **deslop** | `/deslop [edit \| detect] <file-or-text>` | Remove AI writing tells from prose; edit returns cleaned text, detect lists findings |
| **voice-script** | `/voice-script [topic \| draft-file]` | Write a paste-ready text-to-speech script for a chosen TTS model, using that model's own tags; saves it to `docs/tts/` |
| **clarify** | `/clarify [what is unclear]` | Explain unclear points from the discussion with evidence, ask the user about points only the user can settle, and append each to a daily log in `.agent/clarify/` |

### Internal (4)

| Skill | Preloaded by | Purpose |
|-------|-----------|---------|
| **code** | developer | Language and framework standards, logging, error handling, traceability |
| **pentest** | qa | OWASP Top 10 and LLM guardrail security testing |
| **integrated-test** | qa | Integration and E2E testing patterns (testcontainers, Playwright) |
| **run-test** | qa | Run test suites, capture coverage, produce consolidated reports |

## Documentation

- **[plugins/assist-plugin/Claude.md](plugins/assist-plugin/Claude.md)**: Plugin quick reference
- **[plugins/assist-plugin/docs/SPECIFICATION.md](plugins/assist-plugin/docs/SPECIFICATION.md)**: Full agent/skill catalog
- **[plugins/assist-plugin/docs/ARCHITECTURE.md](plugins/assist-plugin/docs/ARCHITECTURE.md)**: Design rationale and structure
- **[plugins/assist-plugin/docs/TOKEN_OPTIMIZATION.md](plugins/assist-plugin/docs/TOKEN_OPTIMIZATION.md)**: What's included/excluded and why
- **[plugins/assist-plugin/rules/writing-standard.md](plugins/assist-plugin/rules/writing-standard.md)**: Writing rules and AI-slop removal tiers (source of truth)
- **[plugins/assist-plugin/docs/DOCUMENTATION_STANDARD.md](plugins/assist-plugin/docs/DOCUMENTATION_STANDARD.md)**: Writing standards and conciseness checklist
- **[plugins/assist-plugin/docs/TRACING_MARKERS.md](plugins/assist-plugin/docs/TRACING_MARKERS.md)**: Requirement/spec traceability marker convention
- **[README.md](README.md)**: Marketplace overview and installation
- **[MARKETPLACE.md](MARKETPLACE.md)**: Marketplace details and versioning
- **[CHANGELOG.md](CHANGELOG.md)**: Release history

## Hooks and writing standard

[plugins/assist-plugin/rules/writing-standard.md](plugins/assist-plugin/rules/writing-standard.md) is the source of truth for how agents, skills, and hooks write. Edit rules there first, then update `rules/writing-standard-compact.md` and `hooks/lib/prose-rules.js` when the rule appears in them, then run `node plugins/assist-plugin/scripts/sync-writing-standard.js`.

- **prose-gate** (PreToolUse on `Write`, `Edit`, `MultiEdit`, `NotebookEdit`): denies only added block-tier tells (em dash, chatbot residue, curly quotes, summary-label phrases) in prose files. It skips files under `docs/tts/` in the hook's working directory (not the git root), so voice scripts may use em dashes as pause marks.
- **prose-advisor** (PostToolUse on the same tools): adds an advisory note about the added advisory-tier tells; never blocks. It skips `docs/tts/` like prose-gate.
- **commit-attribution-guard** (PreToolUse on `Bash` and `PowerShell`): denies `git commit` and `git merge` (with `-m`, `--message`, `-F`, `--file`, `--trailer`) and `gh pr create` and `gh pr edit` (with `--body`, `-b`, `--body-file`, `-F`) when the message or body holds an AI attribution line: a Co-Authored-By trailer naming an AI tool or vendor (human co-authors pass), a "Generated with/by" footer, an Assisted-by or Generated-by trailer, or a `*-Session:` trailer or bare session link at an AI host. It lists up to 5 lines to remove, never rewrites the command, and does not cover `git tag` or a message built from a variable or stdin. `/assist-plugin:health` reports when Claude Code's `attribution.commit` or `attribution.pr` setting is unset or not `""`.
- **writing-context** (SessionStart and SubagentStart): injects `rules/writing-standard-compact.md` (about 1,195 characters, about 300 tokens per session and per subagent).
- **fsa-write-bar** (PreToolUse on `Write`, `Edit`, `MultiEdit`, `NotebookEdit`): keeps `developer-tester` to test paths (never a dot path, `CLAUDE.md`, or `AGENTS.md`) and `developer` out of them. Bash writes are not covered; symlinks are not resolved.
- **fsa-log** (SubagentStop, PostToolUse on `SubagentHandback` and `Agent`): checks each subagent's terminal block against its `## States` table and logs it to `fsa-log.jsonl`. Warn mode: never blocks.
- **Output style** `assist-plugin:terse`: opt-in, not applied to subagents.
- All hooks fail open. The per-write hooks cost about 80 to 110 ms per write.

## Governance

- **Security:** OWASP top 10 review on code changes
- **Testing:** >=70% coverage required for new code
- **Review:** Code reviewer sign-off required before merge
- **LLM security:** OWASP for LLM gate on changes to `agents/`, `skills/`, `rules/`, `hooks/`, or `CLAUDE.md` (see [plugins/assist-plugin/rules/llm-security-checklist.md](plugins/assist-plugin/rules/llm-security-checklist.md))
- See [plugins/assist-plugin/rules/assist-plugin-rule.md](plugins/assist-plugin/rules/assist-plugin-rule.md)

## Keeping counts in sync

When adding or removing a skill or agent, update the counts and lists in:

- [ ] `plugins/assist-plugin/.claude-plugin/plugin.json` (description)
- [ ] `.claude-plugin/marketplace.json` (description)
- [ ] `README.md`
- [ ] `MARKETPLACE.md`
- [ ] `CLAUDE.md`
- [ ] `plugins/assist-plugin/Claude.md`
- [ ] `plugins/assist-plugin/docs/SPECIFICATION.md`
- [ ] `plugins/assist-plugin/skills/do/references/agent-registry.md`
- [ ] Run `node plugins/assist-plugin/scripts/sync-writing-standard.js --check` (exits 1 while any `## Report Writing Standard` block differs from `rules/writing-standard-compact.md`; drop `--check` to fix them)
- [ ] Run `node plugins/assist-plugin/scripts/check-fsa-tables.js --check` after editing a `## States` table, the Write scope table in `agents/developer-tester.md`, or a terminal-block example (exits 1 while `hooks/lib/fsa-tables.js` or `hooks/lib/fsa-paths.js` differs from the markdown; the markdown wins, so edit the JavaScript to match)
- When an agent depends on a skill, list it in the agent's `skills:` frontmatter; never set `disable-model-invocation: true` on a skill an agent preloads.

When releasing, update the version in `plugins/assist-plugin/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.
