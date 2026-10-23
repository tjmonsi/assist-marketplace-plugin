# assist-plugin-marketplace

Claude marketplace for token-optimized development plugins.

GitHub repo: `tjmonsi/assist-marketplace-plugin`. Marketplace name: `assist-plugin-marketplace`.

## Quick Start

Install the marketplace and enable assist-plugin:

```bash
/plugin marketplace add tjmonsi/assist-marketplace-plugin
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

### assist-plugin v1.13.1

**18 user-invocable skills:**
- `do`: Task orchestration and routing; a build request gets requirements, a spec, and a task plan approved first
- `ask`: Repo and web Q&A with citations
- `debug`: Root cause analysis + iterative fixes
- `bump`: Semantic versioning & changelog generation; `--path PATH` takes a relative path or an absolute path inside the git root and is validated before anything changes
- `pr-review`: GitHub/Bitbucket PR review with auto-detection; asks for your confirmation before it posts
- `commit`: Conventional commits
- `branch`: Git branch management and merged worktree cleanup
- `map-project`: Repository discovery
- `technical-writing`: Documentation generation
- `review-md`: Markdown report review
- `gather-requirements`: Requirements elicitation and documentation
- `spec-from-requirements`: Feature specs and delta change logs
- `task-plan`: Ordered coding steps from specs (run by the `task-planner` agent)
- `create-test`: Black-box acceptance-criteria tests
- `health`: Hook health: Node version, guard, injection-filter, prose-hook, FSA-hook, and writing-context self-tests, recent hook failures, subagent reports with terminal-block problems, disabled guards
- `deslop`: Remove AI writing tells from prose; `/deslop [edit | detect] <file-or-text>` (edit returns cleaned text, detect lists findings)
- `voice-script`: Paste-ready text-to-speech script for a chosen TTS model with its own tags; `/voice-script [topic | draft-file]` (saves to `docs/tts/`)
- `clarify`: Explain unclear points from the discussion with evidence and ask the user about points only the user can settle; `/clarify [what is unclear]` (appends to `.agent/clarify/clarify-YYYYMMDD.md`)

**4 internal skills (loaded by agents):**
- `code`: Coding standards and conventions (developer)
- `pentest`: OWASP and LLM security testing (qa)
- `integrated-test`: Integration and E2E testing patterns (qa)
- `run-test`: Test execution and coverage reports (qa)

**16 expert agents:**
- ask, code-reviewer, developer, developer-tester, devops, explore, general-purpose, intake-reviewer, planner, qa, requirements-gatherer, researcher, reviewer, solutions-architect, task-planner, worker

**Spec-first builds in `/do`:**
- SpecGate classifies a request as `build` (it writes code, config, pipelines, infrastructure, or tests) or not
- For a build, a read-only `intake-reviewer` `conflict-check` compares the request with existing requirements, specs, task plans, and `DECISIONS.md`
- Clarify runs up to 5 rounds for a build (2 otherwise), each question with /do's recommended answer, except a question about instruction-like text in a document, which has no recommended option
- A chain of requirements, spec, and task plan (`requirements-gatherer`, `solutions-architect`, `task-planner`) runs before any build step
- You approve the documents at DocSignOff before any `Build: yes` step starts; plan approval also offers "Skip spec-first", which is recorded in `DECISIONS.md`
- Docs-only edits, reviews, questions, and commits are not build steps

**Governance gates:**
- OWASP Top 10 security review
- >=70% test coverage requirement
- Formal code review sign-off

**Platform support:**
- GitHub (auto-detect, use `gh` CLI)
- Bitbucket Cloud (auto-detect, use `bkt` CLI)
- Bitbucket Server/DC (auto-detect)

The `/do` PR review flow covers `github.com` remotes and Bitbucket Cloud and Data Center remotes through `bkt` (the bkt v0.34.0 command forms). It pins the Bitbucket host to one `bkt` context before any `bkt pr` or `bkt api` call, and a Cloud remote also passes a link check. A direct `/pr-review` run also reviews GitHub Enterprise remotes. If you reject the `pr-post-ask` prompt for a post, the step reports the post as declined, not failed. `/do` removes the PR files it wrote under `.agent/pr-review/` after use and at Cleanup.

## Token Efficiency

The assist-plugin uses several strategies to reduce orchestration token overhead while maintaining feature parity or exceeding capability:

### Defensible Claims (Verified by Analysis)

- **~64% savings** on typical implementation tasks (e.g., user authentication, feature development)
- **~65–70% savings** on design and architecture workflows  
- **Up to 82% savings** on fast read-only operations (e.g., repository mapping)
- **83% reduction** in static plugin footprint vs. software-development
- **36.6% average savings** across multi-step orchestrated workflows

See [plugins/assist-plugin/docs/TOKEN_OPTIMIZATION.md](plugins/assist-plugin/docs/TOKEN_OPTIMIZATION.md) for methodology and per-scenario breakdowns.

### Where assist-plugin Costs More (And Why)

Some skills intentionally use more tokens to provide capabilities the baseline lacks:

**PR Review (`/pr-review`)**: Consolidates GitHub and Bitbucket detection + platform-specific workflows in one skill (~16.6KB). software-development provides only Bitbucket support (review-bkt-pr). The token cost increase reflects support for both platforms.

**Semantic Versioning (`/bump`)**: Generates a full categorized CHANGELOG.md with sections for features, fixes, and breaking changes. software-development's release-version only bumps version numbers. The token cost increase reflects added functionality.

These trade-offs are intentional: **higher token cost reflects added capability, not inefficiency.**

### Understanding Model Routing

The 3-tier model routing (Haiku/Sonnet/Opus) reduces **inference cost and latency**, not token context:
- Haiku processes the same context as Opus, but at lower cost (~99% less) and faster inference
- Switching models changes the price-per-token and response time, not the tokens-read
- See [plugins/assist-plugin/skills/do/references/model-routing.md](plugins/assist-plugin/skills/do/references/model-routing.md) for details

For a full breakdown of token savings by scenario, cost implications, and methodology, see [plugins/assist-plugin/docs/TOKEN_OPTIMIZATION.md](plugins/assist-plugin/docs/TOKEN_OPTIMIZATION.md).

## Documentation

- **[plugins/assist-plugin/Claude.md](plugins/assist-plugin/Claude.md)**: Quick reference
- **[plugins/assist-plugin/docs/SPECIFICATION.md](plugins/assist-plugin/docs/SPECIFICATION.md)**: Full agent/skill catalog
- **[plugins/assist-plugin/docs/ARCHITECTURE.md](plugins/assist-plugin/docs/ARCHITECTURE.md)**: System design
- **[plugins/assist-plugin/docs/TOKEN_OPTIMIZATION.md](plugins/assist-plugin/docs/TOKEN_OPTIMIZATION.md)**: Optimization strategy
- **[plugins/assist-plugin/rules/writing-standard.md](plugins/assist-plugin/rules/writing-standard.md)**: Writing rules and AI-slop removal tiers (source of truth for the prose hooks)
- **[plugins/assist-plugin/docs/DOCUMENTATION_STANDARD.md](plugins/assist-plugin/docs/DOCUMENTATION_STANDARD.md)**: Writing standards and conciseness checklist
- **[plugins/assist-plugin/docs/TRACING_MARKERS.md](plugins/assist-plugin/docs/TRACING_MARKERS.md)**: Traceability marker convention
- **[docs/requirements/](docs/requirements/)**: Requirements documents (BRD, URD, FR-NFR)
- **[specs/](specs/)**: Feature specs
- **[docs/task-plans/](docs/task-plans/)**: Task plans
- **[MARKETPLACE.md](MARKETPLACE.md)**: Marketplace overview

## Installation

### Option 1: Claude Code Plugin Command

```bash
/plugin marketplace add tjmonsi/assist-marketplace-plugin
/plugin install assist-plugin@assist-plugin-marketplace
/plugin enable assist-plugin
```

### Option 2: Manual Git Clone

```bash
git clone https://github.com/tjmonsi/assist-marketplace-plugin.git ~/.claude/plugins/marketplaces/assist-plugin-marketplace
```

### Option 3: Manual Git Clone (Self-Hosted)

```bash
git clone ssh://git@git.tjmonsi.com/tjmonsi/assist-marketplace-plugin.git ~/.claude/plugins/marketplaces/assist-plugin-marketplace
```

## Recommended CLI Tools

The plugin works without these tools, but agents fall back or skip steps when one is missing; agents detect each tool before use. Install only what your workflow needs. Agents never run installs themselves.

### Core

| Tool | Install | Used by | Required? |
|------|---------|---------|-----------|
| git | Your OS package manager | `commit`, `branch`, `bump`, `pr-review` | Yes |
| Node.js 6+ and npm | Your OS package manager or nodejs.org | The plugin hooks (`hooks/sa-mermaid-only.js`, `hooks/doc-cli-guard.js`, `hooks/pr-post-ask.js`, `hooks/commit-attribution-guard.js`, `hooks/injection-filter.js`, `hooks/prose-gate.js`, `hooks/prose-advisor.js`, `hooks/writing-context.js`, `hooks/fsa-write-bar.js`, `hooks/fsa-log.js`, `hooks/health-check.js`). Hooks fail open: if `node` is missing or older than 6, or a hook crashes, the command still runs unchecked and you see a warning. See [Hook health](#hook-health) | Yes |
| uv | Follow the [uv installation docs](https://docs.astral.sh/uv/getting-started/installation/) | Preferred installer and runner for Python tooling (see [Python tooling](#python-tooling-uv-preferred)) | Recommended |
| Python 3 | Your OS package manager (uv can also fetch Python itself) | Python-based scanners (Semgrep, garak, PyRIT, pip-audit); pip fallback when uv is absent | Recommended |

#### Python tooling: uv preferred

Every Python command in this plugin shows the uv form first and the pip or pipx form second. Detect uv with `command -v uv`; use the pip or pipx form only when uv is absent. Agents show these commands and never run them; you run the installs. Agents run tests with the no-install form `uv run --no-sync --no-python-downloads pytest ...`, which needs an existing `.venv` (create it with `uv sync`).

- **Global CLI** (one machine-wide tool in its own environment): `uv tool install [--python X] <pkg>`; fallback `pipx install [--python X] <pkg>`, which also isolates the tool. Plain `pip install` outside a virtual environment is not recommended.
- **Per-repo** (dev dependency of a Python project you test): `uv add --dev <pkg>`, then `uv run <command>`; fallback `python -m pip install <pkg>` inside the project's virtual environment. The project's `requires-python` lower bound must be at least 3.11 for garak (3.10 for PyRIT). uv ignores dependency upper bounds, so the project's `.venv` must also use Python 3.13 or lower for garak.

### PR platforms

Install only the one you use. Authenticate with `gh auth login` or `bkt auth login` (check GitHub with `gh auth status`; `bkt auth status` lists contexts but does not test the token). `bkt auth login` creates no context, so for Bitbucket also run `bkt context create <name> --host <host> ... --set-active`; `/pr-review` and the `/do` PR review need exactly one context whose host matches the remote.

| Tool | Install | Used by | Required? |
|------|---------|---------|-----------|
| `gh` (GitHub) | `brew install gh` or `winget install GitHub.cli` | `pr-review` | One of `gh` or `bkt` |
| `bkt` (Bitbucket, [avivsinai/bitbucket-cli](https://github.com/avivsinai/bitbucket-cli)) | `brew install avivsinai/tap/bitbucket-cli`, `winget install AvivSinai.Bitbucket-CLI`, or `go install github.com/avivsinai/bitbucket-cli/cmd/bkt@latest` | `pr-review` | One of `gh` or `bkt` |

### Docs lookup

| Tool | Install | Used by | Required? |
|------|---------|---------|-----------|
| `ctx7` | `npm i -g ctx7`; optional `CONTEXT7_API_KEY` for higher rate limits | `code` skill (developer) | Optional |
| `firecrawl` | `npm i -g firecrawl-cli`; authenticate with `firecrawl login` or set `FIRECRAWL_API_KEY` | `code` skill, researcher | Optional |

### Diagrams

| Tool | Install | Used by | Required? |
|------|---------|---------|-----------|
| `mmdc` | `npm i -g @mermaid-js/mermaid-cli` | solutions-architect, `spec-from-requirements` (PNG rendering) | Optional |

### Testing

| Tool | Install | Used by | Required? |
|------|---------|---------|-----------|
| Playwright | `npm install -D @playwright/test && npx playwright install` (run by you) | `integrated-test` (E2E) | For E2E tests |
| Docker | Your OS package manager or docker.com | `integrated-test` (testcontainers), ZAP | For container-backed tests |

`run-test` uses your project's own runner (`pytest`, `npm test`, `vitest`, `jest`, `go test`, `cargo test`, `./gradlew test`).

### LLM security testing

Used by the `pentest` skill (qa). See [tooling.md](plugins/assist-plugin/skills/pentest/references/tooling.md) for commands and versions.

| Tool | Install | Used by | Required? |
|------|---------|---------|-----------|
| promptfoo | `npm install -g promptfoo` (Node.js 22.22.0+) | `pentest` (LLM/bot) | Optional |
| garak | Global: `uv tool install --python 3.13 garak` (garak needs Python 3.11 to 3.13), else `pipx install --python python3.13 garak`<br>Per-repo: `uv add --dev garak`, run with `uv run garak`; else pip into the project venv | `pentest` (LLM/bot) | Optional |
| PyRIT | Global: `uv tool install --python 3.13 pyrit` (console script `pyrit_scan`; Python 3.10 to 3.14), else `pipx install --python python3.13 pyrit`<br>Per-repo: `uv add --dev pyrit`, run with `uv run pyrit_scan`; else pip into the project venv | `pentest` (LLM/bot) | Optional |

### Web security scanning

Run only against an authorized target. See [tooling.md](plugins/assist-plugin/skills/pentest/references/tooling.md).

| Tool | Install | Used by | Required? |
|------|---------|---------|-----------|
| OWASP ZAP | `docker pull zaproxy/zap-stable`, then `mkdir -p "$HOME/zap-wrk" && chmod 777 "$HOME/zap-wrk"` (outside any repo; the container runs as user `zap`); see [zap.md](plugins/assist-plugin/skills/pentest/references/zap.md) | `pentest` (web, dynamic) | Optional |
| Nuclei | `go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest` or `brew install nuclei` | `pentest` (web, dynamic) | Optional |
| Semgrep | `uv tool install semgrep`, else `pipx install semgrep` | `pentest` (web, static) | Optional |
| CodeQL | Download `codeql-bundle-PLATFORM.tar.zst` from [codeql-action releases](https://github.com/github/codeql-action/releases) | `pentest` (web, static) | Optional |

CodeQL is not open source. GitHub licenses its CLI for public repositories on GitHub.com and for organization repositories with GitHub Code Security; confirm your repository qualifies before use.

### Dependency audit

Used by the `pentest` skill ([Dependency Audit](plugins/assist-plugin/skills/pentest/SKILL.md#dependency-audit)). Install only the tools for ecosystems your projects use.

| Ecosystem | Tool | Install |
|-----------|------|---------|
| npm, pnpm, Bun | `npm audit`, `pnpm audit`, `bun audit` | Built in (Bun 1.2.15+) |
| Yarn | Yarn 1: `yarn audit` (prompts for permission). Yarn 2+: `yarn npm audit` (prompts for permission: runs the repo's `yarnPath` binary and plugins) | Built in |
| PHP | `composer audit` | Built in |
| .NET | `dotnet list package --vulnerable` (SDK 9 and earlier) or `dotnet package list --vulnerable` (SDK 10+). Prompts for permission: `global.json` `sdk.paths` and restore (MSBuild) run repo-controlled code | Built in |
| Elixir | `mix hex.audit` | Built in |
| Elixir | `mix_audit` | `mix escript.install hex mix_audit` (flag parity unverified) |
| Python | `pip-audit` | `uv tool install pip-audit`, else `pipx install pip-audit` (Python 3.10+) |
| Python (uv) | `uv audit` (experimental) | Ships with uv |
| Go | `govulncheck` | `go install golang.org/x/vuln/cmd/govulncheck@latest` |
| Rust | `cargo-audit` (run as the direct binary `cargo-audit audit --file Cargo.lock`, which skips repo `.cargo/config.toml` alias lookup; `cargo audit` prompts) | `cargo install cargo-audit` |
| Rust | `cargo deny` (prompts for permission: repo `.cargo/config.toml` aliases) | `cargo install --locked cargo-deny` |
| Ruby | `bundle-audit` | `gem install bundler-audit` |
| C/C++ (Conan) | `conan audit` (experimental) | Conan 2.14.0+ |
| Java/Kotlin | OWASP dependency-check | Gradle or Maven plugin |
| Poetry, SwiftPM (unverified), Dart/Flutter, any lockfile | `osv-scanner` | `brew install osv-scanner` or `go install github.com/google/osv-scanner/v2/cmd/osv-scanner@latest` |
| Cross-ecosystem | `trivy` (prompts for permission: repo `trivy.yaml` can set output paths) | `brew install trivy`. Pin the version and verify signatures: Trivy v0.69.4 binaries, Docker images 0.69.5 and 0.69.6, and the `trivy-action` and `setup-trivy` tags were malicious in March 2026. |
| Cross-ecosystem | `grype` (prompts for permission: repo `.grype.yaml` or `.grype/config.yaml` can set output paths) | `curl -sSfL https://get.anchore.io/grype \| sudo sh -s -- -b /usr/local/bin` |

### Optional

| Tool | Install | Used by | Required? |
|------|---------|---------|-----------|
| `pwsh` (PowerShell 7) | [Install PowerShell](https://learn.microsoft.com/powershell/scripting/install/installing-powershell) | The PowerShell tool on Linux and macOS (developer, qa, researcher, worker, general-purpose, devops) | Optional |
| LSP code-intelligence plugins | Install a code-intelligence (language server) plugin for your language | The LSP tool (developer, qa, reviewer, code-reviewer) | Optional |

### Check what you have

```bash
for t in git node npm uv python3 gh bkt ctx7 firecrawl mmdc docker pwsh promptfoo garak pyrit_scan semgrep pip-audit osv-scanner; do command -v "$t" >/dev/null && echo "ok      $t" || echo "missing $t"; done
```

## Hook health

The three Bash guards (`sa-mermaid-only`, `doc-cli-guard`, `commit-attribution-guard`) and the `prose-gate` block a tool call only when they positively match a prohibited form. The `pr-post-ask` guard never blocks: it asks first (see [PR posting prompt](#pr-posting-prompt)). Any hook failure (crash, bad input, timeout, `node` missing, Node older than 6, a guard disabled after a failed self-test) lets the command run and shows a one-line warning; hooks never exit with status 2. A SessionStart self-test runs each guard, the injection filter, the prose hooks, and the FSA hooks against fixed allow and deny cases and prints a notice only when something is wrong. Run `/assist-plugin:health` for the full report: Node version, self-test results, recent hook failures (`hook-health.jsonl` in the plugin data directory, no command text), subagent reports with terminal-block problems (`fsa-log.jsonl`), disabled guards, and Claude Code's attribution setting (see [Commit attribution](#commit-attribution)). `/assist-plugin:health --clear` empties the failure log after showing it.

### Injection filter

The `injection-filter` hook is a defensive filter for untrusted content. It runs after `WebFetch`, `WebSearch`, `mcp__*` tools, subagent (`Agent`) results, and Bash commands that run `firecrawl`, `curl`, `wget`, or `ctx7`; it never touches `Read`, `Grep`, or other Bash output. Sentences that match a fixed set of prompt-injection rules (instruction override, role reassignment, system-prompt or secret exfiltration, fake chat delimiters, hidden-instruction carriers, tool hijack, data-exfiltration links, concealment) are replaced with `[assist-plugin removed possible prompt injection: <rule-id>]`, invisible Unicode (zero-width, bidi override, tag characters) is stripped, and Claude gets a factual note listing the rule ids. All other text is returned unchanged. A subagent prompt that matches is rewritten the same way and Claude Code asks you to confirm it. A typed prompt that matches is never changed or blocked: you get a warning and Claude gets a note.

The filter fails open (any error returns the original content with a one-line warning), never blocks, and is a pattern filter, not a security boundary: it does not decode base64, does not map look-alike letters from other scripts, and does not read non-English text. Content from the plugin's own files is skipped. To skip other sources, list substrings in `injection-allowlist.json` in the plugin data directory, for example `["docs.example.com", "/home/me/notes/"]`: a URL matches when its host (or a parent domain) or host and path start with the entry; a file path matches when it contains the entry.

### Commit attribution

No commit or pull request made with assist-plugin carries AI attribution. The `commit-attribution-guard` hook (PreToolUse on `Bash` and `PowerShell`) denies a command whose commit message or PR body holds one of these lines, and the commit and bump skills state the same rule.

- **Covered commands:** `git commit` (including `--amend`) and `git merge` with `-m`, `--message`, `-F`, `--file`, or `--trailer`; `gh pr create` and `gh pr edit` with `--body`, `-b`, `--body-file`, or `-F`. Chained commands, heredocs, and PowerShell are read too.
- **Denied lines:** a Co-Authored-By trailer that names an AI tool or vendor (human co-authors pass; an address at anthropic.com or openai.com counts only when it is a noreply address); a "Generated with" or "Generated by" footer that names an AI tool; an Assisted-by or Generated-by trailer that names an AI tool; a `*-Session:` trailer that points at an AI host; a bare AI session link. Lines inside a closed code fence are skipped, and a sentence that only mentions a trailer passes.
- **Not covered:** `git tag`. `git revert` and `git cherry-pick` take no message on the command line. A message built from a variable or piped through stdin is not visible to the hook.
- **On a match:** the hook denies with a reason that lists up to 5 lines to remove. It never rewrites the command and fails open.

#### Attribution settings

Claude Code adds its own Co-Authored-By trailer to commits and a footer to pull requests unless the attribution settings are empty. Set both to empty strings in `~/.claude/settings.json` (or `$CLAUDE_CONFIG_DIR/settings.json`), the project `.claude/settings.json`, or `.claude/settings.local.json`:

```json
{"attribution": {"commit": "", "pr": ""}}
```

Source: https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts

`/assist-plugin:health` reports, read-only, when `attribution.commit` or `attribution.pr` is unset or not `""` in those files. It names the file and key to change and never edits settings.

### PR posting prompt

The `pr-post-ask` hook (PreToolUse on `Bash` and `PowerShell`) asks you before a command that posts to, merges, or closes a pull request runs. It covers every session and every agent, because a hook cannot tell a `/do` post from a direct `/pr-review` post; both flows show the prompt after their own confirmation. It asks and never denies, and it fails open like the other hooks.

- **Asks before:** `gh pr review`, `gh pr merge`, `gh pr comment`, `gh pr close`, `bkt pr approve`, `bkt pr comment`, `bkt pr decline`, `bkt pr close`, `bkt pr merge`, and a `bkt api` call that may write. A `bkt api` call passes only when it shows a read: no body option, no option the hook does not recognize, and the method absent, GET, or HEAD. An unlisted `bkt` option before the subcommand also asks, so the hook sometimes prompts on a read.
- **Known gaps (best-effort, not a security boundary; a bypass form found later is added to this list):** a program word taken from a variable or an expression (`G=gh; $G pr merge 1`, PowerShell `& (Get-Command gh) pr merge 1`) and PowerShell splatting; `gh api` with any method, `gh pr edit`, `gh pr ready`, `gh pr reopen`, a `gh` alias or extension that expands to a posting command, and `bkt pr` subcommands other than `approve`, `comment`, `decline`, `close`, and `merge`; a command string run by another program (`bash -c`, `sh -c`, `pwsh -Command`, `cmd /c`, `eval`, `Invoke-Expression`, `iex`, `Start-Process`, `xargs`, `find -exec`, `watch`, `npx -c`, `node -e`, a script file, a shell function, a coprocess) and argv wrappers outside the hook's wrapper list (`setsid`, `doas`, `ionice`, `stdbuf --output 0 gh ...`); a posting command inside a command substitution in another program's argument (`echo $(gh pr merge 1)`; a substitution in the program word or in an assignment value before it is judged and asks); a Bash program name in another case (`GH`), `.cmd`, `.bat`, and `.ps1` shims, shell aliases, and renamed or linked binaries; an option with a separate value ahead of the verb that the option lists do not name (`gh --body x pr comment 1`, `gh pr --body x comment 1`, `gh pr -b x comment 1`, `gh pr --body-file f review 1 --approve`, `bkt pr --text x comment 1`); a redirection the shared lexer splits into separate parts (`gh 2>&1 pr merge 1`, `gh >&2 pr merge 1`, `gh &>/dev/null pr merge 1`, `gh >| out pr merge 1`, `bkt 2>&1 pr approve 1`, `gh < <(true) pr merge 1`); a PowerShell array or script block in the verb position (`gh pr @('merge') 1`, `gh pr {merge} 1`) and a PowerShell comment that hides an opening parenthesis; the quoting forms `$"gh"` and `$'g\x68'`, brace expansion (`{gh,pr,merge,1}`), a glob in the program word (`/usr/bin/g[h]`), `(( x = 1 << 2 ))` read as a heredoc so the next line is hidden, and `sudo --user root gh ...`; the PowerShell forms listed for `doc-cli-guard` (typographic quotes, block comments, the dot-source operator, typed, scoped, and compound assignments) and a redirection before the program (`2>/dev/null gh pr merge 1`); a REST request through `curl`, another HTTP client, or an MCP tool.
- **Unverified gaps:** Claude Code's documentation does not say whether an ask prompts in `bypassPermissions` mode or plan mode, or whether an installed mod can approve a call the hook would prompt for. A deny from another hook beats the ask (documented).
- **Self-test:** the health check runs the hook as a guard against 27 fixed cases. A known-safe command that asks disables the hook until a later self-test passes; a posting command that does not ask leaves it enabled and reports weak protection.

### Writing standard hooks

[plugins/assist-plugin/rules/writing-standard.md](plugins/assist-plugin/rules/writing-standard.md) is the source of truth for how the plugin's agents and skills write. Three hooks apply it:

- **`prose-gate`** (PreToolUse on `Write`, `Edit`, `MultiEdit`, `NotebookEdit`): denies a write to a prose file (`.md`, `.mdx`, `.txt`, `.rst`, `.adoc`) only when the text the call adds holds a block-tier tell: an em dash, chatbot residue, a curly quote, or a summary-label phrase. Text already in the file is not judged. The denial lists each hit with its fix. Text that must stay verbatim (a quotation, your own words, a title) passes inside double quotes, a blockquote, or a code span.
- **`prose-advisor`** (PostToolUse on the same tools): adds a short advisory note about hedges, intensifiers, AI vocabulary, throat-clearing, and similar tells in the added text. It never blocks.
- **`writing-context`** (SessionStart and SubagentStart): injects the compact standard (`rules/writing-standard-compact.md`, about 1,195 characters or 300 tokens) into the session and into each subagent. The health check self-tests it; a failure is reported and never disables it.

Both per-write hooks skip files under the system temp directory. Files under `docs/tts/` are judged like other prose, with fenced blocks exempt. To exempt other paths, list path substrings in `prose-gate-allowlist.json` in the plugin data directory, for example `["/drafts/", "notes/verbatim"]`; the single entry `["*"]` turns the gate and the advisor off for every path. A missing or malformed file means no allowlist. The file is separate from `hooks-disabled.json`, so a health check never changes it.

All three fail open. The per-write hooks add about 80 to 110 ms to each write. The plugin also ships an opt-in output style, `assist-plugin:terse`: answer-first replies with no preamble, recap, or sign-off. Select it with `/output-style`; subagents do not use it.

To rewrite existing prose, run `/deslop edit <file>`; `/deslop detect <file>` lists the tells without changing the file. To change a writing rule, edit `rules/writing-standard.md`, then run `node plugins/assist-plugin/scripts/sync-writing-standard.js` to refresh the `## Report Writing Standard` blocks in `agents/` and `skills/`.

### FSA hooks

The agents `developer-tester`, `reviewer`, `code-reviewer`, `intake-reviewer`, `developer`, and `task-planner` follow a finite-state automaton: a `## States` table in the agent or skill file. Every dispatched agent, `qa` included, ends its final message with a terminal block (a fenced `fsa` block of ten fields) ([skills/do/references/fsa-template.md](plugins/assist-plugin/skills/do/references/fsa-template.md)). Two hooks check what is visible from outside the model:

- **`fsa-write-bar`** (PreToolUse on `Write`, `Edit`, `MultiEdit`, `NotebookEdit`): `developer-tester` may write only test paths, and `developer` may not write them. Test paths are the globs under "Write scope" in `agents/developer-tester.md` (`**/tests/**`, `**/*.test.*`, `**/*_test.go`, and six more). A denial names the path, the rule, and that section. Other limits:
  - `task-planner` may write only a `task-plan-*.md` file directly under `docs/task-plans/` of the session's git root ("Write scope" in `agents/task-planner.md`).
  - `developer-tester`, `task-planner`, `requirements-gatherer`, and `solutions-architect` are denied any path with a segment that starts with a dot and any file named `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md`. `devops`, `worker`, `qa`, `general-purpose`, and `developer` keep dot-path writes because CI and config files such as `.github/` are their work.
  - Every subagent, from any plugin when the call carries an `agent_id`, is denied `.agent/main-plan/**` and any file named `DECISIONS.md`, so only the orchestrator records plans, sign-off, waivers, and decisions.
  - Every subagent is denied a path over 4096 characters or with a NUL character.

  The main session is not affected, unless it was started with `--agent assist-plugin:<name>`; then that agent's rules apply. A path inside the session's working directory or `CLAUDE_PROJECT_DIR` is judged relative to it, so a project that sits under a directory named `tests` is not all test paths; when both directories contain the path, `developer` is denied if any relative form matches a test glob, and `developer-tester` is allowed only if a form matches and no denial applies.

  **Limits of the bar:** it covers the `Write`, `Edit`, `MultiEdit`, and `NotebookEdit` tools only. A `Bash` command can still write any path, and the bar does not see it. Paths are judged as written: symlinks are not resolved, so a link inside a test directory that points elsewhere passes. The test-glob and `task-plan-*.md` matches are case-sensitive, so `Tests/a.js` is not a test path; the protected names (`DECISIONS.md`, `.agent/main-plan/**`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`) match without regard to case, trailing dots or spaces, or a `:stream` suffix. The bar is a guardrail, not a security boundary.
- **`fsa-log`** (SubagentStop, PostToolUse on `SubagentHandback`, PostToolUse on `Agent`): reads the last `fsa` block of each report from those seven agents, checks its `trace`, `state`, `error_class`, and `verdict` against the agent's transition table (`qa` has no table, so only state, error class, and verdict), and appends one line to `fsa-log.jsonl` in the plugin data directory (newest 500 lines kept). A line holds timestamp, session id, event, agent type, agent id, the block's state, verdict, error class, and trace, the number of `out_of_scope` items, and the problem codes. It never holds prompts, report text, artifact paths, questions, out-of-scope items, or file contents. A stop that follows the same agent's newest handback is not checked twice; the hook writes a marker line (`stop-after-handback`) in its place.

`fsa-log` runs in warn mode. When a final report has no block or an illegal one, you see one line, `assist-plugin fsa: <agent> final report <problem summary>; see /assist-plugin:health`, and the run continues unchanged: the hook never blocks a subagent, never sends it back, and never adds context, because either would make the subagent keep running. The session-start check counts new problem reports since the last notice, and `/assist-plugin:health` lists them with the problem codes.

Both hooks fail open like the rest: any crash, bad input, timeout, or disabled hook lets the write or the report through with a one-line warning. The tables in `hooks/lib/fsa-tables.js` mirror the markdown tables. After you edit a `## States` table, a Write scope table (`agents/developer-tester.md` or `agents/task-planner.md`), or the `## Write guard lists` in `rules/assist-plugin-rule.md`, run `node plugins/assist-plugin/scripts/check-fsa-tables.js --check`; it exits 1 and lists each difference while the code and the markdown disagree. The markdown wins, so edit the JavaScript to match, except that a write guard value found only in `lib/fsa-paths.js`, or a task-plan glob change, needs a user decision recorded in `DECISIONS.md` first (the script prints this line).

## Marketplace Structure

```
assist-marketplace-plugin/
├── .claude-plugin/marketplace.json (marketplace definition)
├── LICENSE (AGPL-3.0-or-later)
├── NOTICE (attribution)
├── CHANGELOG.md (release history)
├── CLAUDE.md (repo quick reference)
├── MARKETPLACE.md (marketplace overview)
├── README.md (this file)
├── DECISIONS.md (decision log)
├── docs/ (requirements/ for BRD, URD, and FR-NFR documents; task-plans/ for task plans)
├── specs/ (feature specs)
├── tests/ (node:test files for the hooks, scripts, skills, and documents)
├── plugins/
│   └── assist-plugin/
│       ├── .claude-plugin/plugin.json (plugin metadata)
│       ├── agents/ (16 agent definitions)
│       ├── skills/ (22 skills: 18 user-invocable, 4 internal)
│       ├── hooks/ (fail-open guards, injection filter, prose hooks, and health check)
│       │   ├── hooks.json (hook registration)
│       │   ├── sa-mermaid-only.js (entry: restricts solutions-architect Bash to mmdc, .mmd input and .svg, .png, or .pdf output under specs/, as a relative path or an absolute path under the git root)
│       │   ├── doc-cli-guard.js (entry: guards firecrawl and ctx7 commands)
│       │   ├── pr-post-ask.js (entry: asks before PR posting commands)
│       │   ├── commit-attribution-guard.js (entry: denies AI attribution lines in commit messages and PR bodies)
│       │   ├── injection-filter.js (entry: prompt-injection filter for tool results, subagent prompts, and typed prompts)
│       │   ├── prose-gate.js (entry: denies added block-tier tells in prose writes)
│       │   ├── prose-advisor.js (entry: advisory note on added tells after a prose write)
│       │   ├── writing-context.js (entry: injects the compact writing standard at SessionStart and SubagentStart)
│       │   ├── fsa-write-bar.js (entry: per-agent write limits and the protected .agent/main-plan/** and DECISIONS.md paths)
│       │   ├── fsa-log.js (entry: logs and checks subagent terminal blocks, warn mode)
│       │   ├── health-check.js (entry: SessionStart self-test and /health report)
│       │   ├── impl/ (guard, PR posting ask, injection-filter, prose-hook, FSA-hook, and health-check logic)
│       │   └── lib/ (Node version gate, fail-open runtime, health log, injection-rules.js, prose-rules.js, prose-diff.js, git-root.js, fsa-tables.js, fsa-paths.js, shell-lex.js, shell-program.js, attribution-rules.js)
│       ├── output-styles/ (terse.md: opt-in `assist-plugin:terse` output style)
│       ├── rules/ (governance, writing-standard.md, writing-standard-compact.md)
│       ├── scripts/ (sync-writing-standard.js: syncs the Report Writing Standard blocks; check-fsa-tables.js: checks the FSA tables against the markdown)
│       ├── docs/ (comprehensive documentation)
│       ├── Claude.md (quick reference)
│       ├── NOTICE (attribution)
│       └── LICENSE (AGPL-3.0-or-later)
└── (future plugins will be added here)
```

## License

Copyright (C) 2026 Toni-Jan Keith Monserrat

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.

Releases up to and including v1.6.1 were published under the MIT License. See [NOTICE](NOTICE) for attribution of components derived from earlier MIT-licensed work.

## Support

- **Documentation:** See [MARKETPLACE.md](MARKETPLACE.md) and plugin docs
- **Repository:** https://github.com/tjmonsi/assist-marketplace-plugin
- **Issues:** Open an issue on GitHub or check plugin documentation
