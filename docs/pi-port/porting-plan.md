# Porting assist-plugin to Pi CLI

The port is feasible and its core value (per-agent model routing to reach other models) maps cleanly onto Pi, but one guarantee does not survive unchanged: assist-plugin's hooks see every subagent's tool calls through a single top-level registration, and Pi does not. In Pi a subagent runs in a child session the subagent extension constructs through the SDK, and a parent-bound `tool_call` handler is not invoked for that child's calls. The governance gate must instead be loaded into each subagent session. This is the main porting risk and it drives the recommended path: reuse `@tintinweb/pi-subagents` for the subagent layer (it already loads per-agent extensions into the child session and scopes models against `enabledModels`), port the 22 skills first (near-direct, same Agent Skills spec), then the 16 agents to prove model routing, then rewrite the 11 hooks as in-process TypeScript `pi.on(...)` handlers, and only then re-establish the governed core.

Model-routing goal: achievable. Pi agents pin a model per agent via frontmatter `model:` (for example `anthropic/claude-haiku`, `openai/gpt-...`, or any provider you register), and Pi's provider and virtual-model APIs let you point an agent at a different model or a router without touching the agent file. The three-tier Haiku/Sonnet/Opus table in `skills/do/references/model-routing.md:7-26` becomes per-agent `model:` pins plus an optional `enabledModels` allowlist.

Verification basis: Pi API claims are verified against the official docs at pi.dev. Subagent-extension claims are verified against the actual TypeScript source of `tintinweb/pi-subagents` where cited; claims verified only from a project README are labeled "README-only, not verified in code". Port-effort figures are estimates and labeled as such.

## 1. Component mapping

| assist-plugin concept | Repo evidence | Pi mechanism | Port effort (estimate) | Pi-side verification |
|---|---|---|---|---|
| Plugin package (`plugin.json`, `marketplace.json`) | `plugins/assist-plugin/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | Pi package: directory or npm package with conventional `extensions/`, `skills/`, `prompts/` dirs or an explicit `pi` key in `package.json`; installed with `pi install` | Low | Verified, https://pi.dev/docs/latest/packages |
| 22 skills (`skills/*/SKILL.md`) | 22 `SKILL.md` files present (ls) | Pi Skills (same Agent Skills spec); drop into `skills/` or ship under the package `pi.skills` path | Low | Verified, https://pi.dev/docs/latest/skills |
| 16 agents (`agents/*.md`, `type: agent`, `model`, `effort`, `tools`, `skills`) | `agents/*.md` frontmatter | Subagent extension agent files (markdown + YAML frontmatter) under `.pi/agents/*.md`, `.agents/agents/*.md`, or a package `pi.subagents.agents` path | Medium | Verified in source, `tintinweb/pi-subagents` `src/custom-agents.ts:158-213` |
| Per-agent model pin (`model: sonnet` etc.) | all `agents/*.md`; table in `model-routing.md:7-26` | Frontmatter `model: provider/modelId` or fuzzy name (`"haiku"`); locks the agent | Low | Verified in source, `src/types.ts:54`, `src/custom-agents.ts:199` |
| Effort tier (`effort: low\|medium\|high\|xhigh`) | all `agents/*.md` | Frontmatter `thinking:` (`off\|minimal\|low\|medium\|high\|xhigh\|max`), clamped to the model | Low; value rename | Verified in source, `src/custom-agents.ts:200`, `src/types.ts:55` |
| enabledModels scoping of routing | `model-routing.md` intent | `scopeModels` policy reading `enabledModels` from `settings.json` | Low | Verified in source, `src/model-scope.ts`, `src/enabled-models.ts` |
| Preloaded skills on an agent (`skills:` frontmatter) | `developer.md:9-10`, `qa.md:10-14`, etc. | Frontmatter `skills: true\|false\|csv` | Low | Verified in source, `src/types.ts:53`, `src/custom-agents.ts:198` |
| Tool allowlist (`tools: [Read, Write, ...]`) | all `agents/*.md` | Frontmatter `tools:` csv of builtin names (`read, bash, edit, write, grep, find, ls`), `*`/`all`/`none`, or `ext:<ext>/<tool>` | Medium; name remap, gaps | Verified in source, `src/custom-agents.ts:362`, `src/agent-types.ts:14-23` |
| `/do` orchestration skill | `skills/do/SKILL.md` | A skill plus a subagent-extension workflow or the `Agent` tool to dispatch; `/do` logic stays prose-driven | High | Partially verified (workflow in `tintinweb`); orchestration contract is prose |
| Model-routing table (3 tiers) | `model-routing.md:7-26` | Per-agent `model:` pins + `enabledModels` + optional `registerVirtualModel` router | Medium | Verified, see sections 3 |
| `fsa-write-bar` (PreToolUse Write) | `hooks/impl/fsa-write-bar.js` | `pi.on("tool_call")` returning `{ block: true, reason }` on write tools | Medium (logic ports; plumbing rewritten) | Verified, https://pi.dev/docs/latest/extensions |
| `prose-gate` (PreToolUse Write, deny) | `hooks/impl/prose-gate.js`, `lib/prose-diff.js` | `pi.on("tool_call")` block on prose write | Medium | Verified |
| `prose-advisor` (PostToolUse Write, note) | `hooks/impl/prose-advisor.js` | `pi.on("tool_result")` or `tool_execution_end`, notify-only | Medium | Verified |
| `commit-attribution-guard` (PreToolUse Bash) | `hooks/impl/commit-attribution-guard.js`, `lib/attribution-rules.js` | `pi.on("tool_call")` matching the `bash` tool args | Medium | Verified |
| `doc-cli-guard`, `sa-mermaid-only` (PreToolUse Bash) | `hooks/impl/*.js`, `lib/shell-lex.js` | `pi.on("tool_call")` on `bash` | Medium | Verified |
| `pr-post-ask` (ask before PR writes) | `hooks/impl/pr-post-ask.js` | `pi.on("tool_call")`; no documented "ask" verdict, so emulate with block + prompt or a confirming tool | Medium; behavior gap | Partially verified; ask-verdict unverified |
| `injection-filter` (mutate tool output / subagent prompt) | `hooks/impl/injection-filter.js`, `lib/injection-rules.js` | `pi.on("tool_result")` mutation and `pi.on("tool_call")` for the Agent-equivalent; `message`/UserPrompt via `input`/`context` events | Medium-High | Partially verified; input-event surface unverified |
| `writing-context` (inject standard at session/subagent start) | `hooks/impl/writing-context.js` | `pi.on("session_start")` and per-agent `extra_context`/system prompt; `before_agent_start` | Low-Medium | Verified events exist; subagent injection path needs the subagent ext |
| `fsa-log` (SubagentStop/Handback audit) | `hooks/impl/fsa-log.js` | `tintinweb` `subagents:*` events (`created/started/completed/...`) or `agent_end` | Medium | Verified in `tintinweb` README; event payload fields README-only |
| `health-check` (SessionStart self-test) | `hooks/impl/health-check.js`, `lib/health.js` | `pi.on("session_start")` self-test or a `/health` command | Low-Medium | Verified event exists |
| Node-process + `hooks.json` plumbing | `hooks/hooks.json`, `hooks/lib/launch.js` | Removed. Handlers become in-process TypeScript registered on `pi.on(...)`; no spawn, no JSON stdin/stdout | Medium | Verified (extensions run in-process) |
| Subagent identity for a hook (`input.agent_id`) | `hooks/impl/fsa-write-bar.js:171-176`, `fsa-log.js:76-88` | No equivalent on a parent `tool_call` event; gate must run inside the child session, see section 6 | High (design change) | Verified in source, see section 6 |

## 2. Skills port

Near-direct. Pi implements the Agent Skills specification, so a `SKILL.md` directory with `name` and `description` loads as-is (https://pi.dev/docs/latest/skills). Pi discovers skill directories recursively from user and project skill roots, and also supports `~/.agents/skills/` and `.agents/skills/` (same page). Ship the 22 skills under the package's `skills/` directory or an explicit `pi.skills` glob (https://pi.dev/docs/latest/packages).

Frontmatter fields that carry over, per the Pi Skills page: `name` (lowercase, hyphens, max 64 chars), `description` (max 1024 chars), `license`, `compatibility`, `metadata`, `allowed-tools` (experimental), and `disable-model-invocation`. assist-plugin's `SKILL.md` files use `name`, `description`, `allowed-tools`, and `user-invocable`; they do not set `disable-model-invocation`. `user-invocable: false` is what marks the 4 internal skills (`skills/code/SKILL.md:7`, `run-test/SKILL.md:6`, `pentest/SKILL.md:8`, `integrated-test/SKILL.md:8`), so the port needs a Pi equivalent for `user-invocable` (see the bullet below).

Fields and assumptions that need checking:
- `user-invocable: false` on the 4 internal skills (`code`, `pentest`, `integrated-test`, `run-test`; `skills/code/SKILL.md:7`, `run-test/SKILL.md:6`, `pentest/SKILL.md:8`, `integrated-test/SKILL.md:8`) keeps them out of user command invocation in Claude Code, and assist-plugin preloads them through an agent's `skills:` frontmatter (CLAUDE.md forbids setting `disable-model-invocation: true` on a skill an agent preloads, which is why these use `user-invocable` instead). In `tintinweb`, an agent's `skills:` list "preloads only those skills" (README, verified intent in `src/types.ts:53`). Confirm whether Pi has a `user-invocable` equivalent and that a Pi subagent preload still works when a skill sets it; preload should hold because it is an explicit opt-in independent of model selection, but this is unverified in Pi source.
- The `/command` names (for example `/do`, `/ask`, `/debug`) derive from the skill `name` on both platforms. Pi does not force `name` to match the directory, but matching is more portable (https://pi.dev/docs/latest/skills). The assist-plugin directories already match.
- Pi loads skills without descriptions and malformed `SKILL.md` as failures, and keeps the first on a name collision with a warning (same page). Run `pi config` after install to confirm all 22 loaded.
- Skills that shell out (for example `health`, `commit`, `bump`) rely on Node and git being present. Pi runs the skill's directed programs with full OS permission once the project is trusted (https://pi.dev/docs/latest/packages), so no change, but see section 6 on the trust model.

No field is known to be dropped. The portability gap is behavioral, not structural: a skill body that assumes Claude Code tool names (for example a `Bash` tool reference in prose) reads fine but points at a tool Pi calls `bash`. Audit skill bodies for hard-coded Claude Code tool names during the port.

## 3. Agents and model access

Goal met: each of the 16 agents becomes one markdown agent file with a per-agent `model:` pin, and Pi's provider and virtual-model layer lets you repoint any agent at another model without editing the agent file.

### 3.1 Agent file format

`tintinweb/pi-subagents` loads agents from `.pi/agents/<name>.md` (project, highest precedence), `.agents/agents/<name>.md`, and the global agent dir, and a package can ship them under `"pi": { "subagents": { "agents": ["./agents"] } }` (README; file resolution verified in `src/custom-agents.ts`). The frontmatter parser reads these fields (verified in `src/custom-agents.ts:183-213`):

- `name` sets the agent type; falls back to the filename (`src/custom-agents.ts:163`, `:71`).
- `model`: `provider/modelId` or a fuzzy name such as `"haiku"` (`src/custom-agents.ts:199`, `src/types.ts:54`). Resolution tolerates `.`/`-` differences and trailing date stamps (README; `src/model-resolver.ts` present).
- `thinking`: `off\|minimal\|low\|medium\|high\|xhigh\|max`, clamped to the model (`src/custom-agents.ts:200`).
- `tools`: csv of builtin names, `*`/`all`, `none`, or `ext:<extension>/<tool>` selectors (`src/custom-agents.ts:362`). The 7 builtins are `read, bash, edit, write, grep, find, ls` (`src/agent-types.ts:14-23`).
- `skills`: `true`/`false`/csv (`src/custom-agents.ts:198`, `src/types.ts:53`).
- `extensions`: `true`/`false`/csv of extension names to load into the agent's session (`src/custom-agents.ts:196`, `src/types.ts:48`). This field is the hook-porting lever (section 6).
- Also parsed: `max_turns`, `prompt_mode` (`replace`/`append`), `inherit_context`, `run_in_background`, `isolated`, `isolation`, `memory`, `display_name`, `color`, `enabled` (`src/custom-agents.ts:190-213`). `display_name` and `color` are Claude Code-compatible (`src/types.ts:36-39`).

### 3.2 Field mapping, the 16 agents

| Claude Code field | Value in assist-plugin | Pi frontmatter | Note |
|---|---|---|---|
| `type: agent` | present on all | drop | Pi infers agent from the file location |
| `model: haiku\|sonnet\|opus` | `explore`/`commit` haiku; most sonnet; `code-reviewer`/`reviewer`/`researcher`/`solutions-architect` opus | `model: anthropic/claude-haiku` etc. or fuzzy `haiku` | Pin exact `provider/modelId` for `enabledModels` scope matches (section 3.4) |
| `effort: low\|medium\|high\|xhigh` | per `model-routing.md:54-73` | `thinking:` same words | `low/medium/high/xhigh` shared; Pi adds `minimal`/`max`; Pi clamps |
| `tools: [...]` | capitalized Claude Code names | `tools:` lowercase csv | See remap below |
| `skills: [...]` | `code`, `pentest`, etc. | `skills:` csv | Direct |

Tool-name remap (the gap to plan for). Claude Code `Read/Write/Edit/Grep/Glob/Bash` map to Pi `read/write/edit/grep/find`(or `grep`)/`bash`. Pi has no builtin for `Glob` as a distinct tool (use `find`/`grep`), and no builtins named `PowerShell`, `LSP`, `WebSearch`, or `WebFetch`. Those four must come from extensions and be referenced as `ext:<extension>/<tool>`, or be dropped. Affected agents, by tool, verified against each `agents/*.md` `tools:` line: PowerShell on `developer`, `devops`, `qa`, `worker`, `researcher`, `general-purpose`; LSP on `developer`, `qa`, `code-reviewer`, `reviewer`; WebSearch/WebFetch on `ask`, `researcher`. Decide per tool whether to find a Pi extension that provides it or to drop it; this is the main per-agent conversion work (estimate: a few hours for all 16).

### 3.3 Pointing agents at other models (provider and virtual-model config)

Three layers, in increasing flexibility:

1. Pin per agent. Set `model:` in the agent file to any `provider/modelId` Pi knows. Changing the model is a one-line edit.
2. Register a provider. `pi.registerProvider()` / `pi.unregisterProvider()` add a custom or proxied provider (https://pi.dev/docs/latest/extensions; examples `custom-provider-anthropic/`, `custom-provider-gitlab-duo/` on that page). This is how you reach a non-default model host (a local gateway, an OpenAI-compatible endpoint, a corporate proxy). The exact `registerProvider` config fields were not in the fetched section of the docs and are unverified here; confirm against the Providers reference before building one.
3. Virtual model / router. `registerVirtualModel` defines a virtual model that routes to different real models; the docs list a `jev-router.ts` example, "Virtual model that routes planning and implementation to different models" (https://pi.dev/docs/latest/extensions). Pin agents at the virtual model to recreate the `/do` routing table in one place. The signature and config fields are not given in the fetched docs and are unverified; confirm before relying on it.

Runtime model change: `pi.setModel(model)` switches the session's model but returns `false` if the provider has no auth configured, and does not change `defaultProvider`/`defaultModel` (https://pi.dev/docs/latest/extensions). `ctx.modelRegistry` exposes `find()`, `getAvailable()`, `getProvider()`, `getProviderAuth()` for a router to pick a model at dispatch time (same page).

### 3.4 Mapping the routing tiers to Pi

The table at `model-routing.md:7-26` becomes:
- Each agent's default tier -> the agent file `model:` pin.
- "Can Override: No" agents (`orchestrator`, `reviewer`, `code-reviewer`, `explore`, `commit`, `researcher`, `requirements-gatherer`, `intake-reviewer`; `model-routing.md:95-104`) -> a pinned `model:` plus, if you want the pin enforced against caller overrides, rely on `tintinweb`'s rule that frontmatter `model` "locks the agent" and Agent-tool params "only fill unspecified fields" (README; the lock is the design in `src/agent-types.ts` and `src/types.ts:54`).
- "Can Override" agents -> leave `model:` as the default; a caller (the `/do` equivalent) may pass a different model on the spawn, subject to scope.
- `enabledModels` scope -> `tintinweb`'s `scopeModels` (opt-in via `/agents -> Settings -> Scope models`) validates a subagent's model against `enabledModels` from `~/.pi/agent/settings.json` and `<cwd>/.pi/settings.json` (`src/model-scope.ts` docstring, `src/enabled-models.ts`). A caller-supplied out-of-scope model is a hard error; a frontmatter-pinned out-of-scope model warns and still runs (`src/model-scope.ts` `checkModelScope`). Only exact `provider/modelId` entries are honored; globs and bare ids are dropped (README; `src/enabled-models.ts`). So to use `enabledModels` as the routing allowlist, pin agents with exact ids.

### 3.5 Reuse vs build your own

Recommendation: reuse `tintinweb/pi-subagents` for the first working port, and keep a thin own-extension escape hatch for the governed core.

Why reuse `tintinweb/pi-subagents`:
- It already implements every subagent capability the plan needs, verified in source: markdown agent files with per-agent `model`/`thinking`/`tools`/`skills`/`extensions` (`src/custom-agents.ts:183-213`), `enabledModels` scoping (`src/model-scope.ts`), background/parallel spawn with `maxConcurrent` (README), session fork via `inherit_context` (README), and workflow orchestration (`agent()`, `parallel()`, `pipeline()`, `phase()`) for a `/do`-style pipeline (README; `src/workflow/*`).
- Critically for governance, it loads per-agent `extensions` into the child session, which is the only verified way to make a `tool_call` gate fire for a subagent (section 6; evidenced by `test/e2e/tool-veto-reachability.e2e.test.ts` and `AgentConfig.extensions` in `src/types.ts:48`).
- It is active and test-covered (50+ test files under `test/`, including e2e), which lowers maintenance risk.

Tradeoffs of reuse:
- You inherit a large third-party dependency that runs in-process with full OS permission (https://pi.dev/docs/latest/extensions). Trust and supply-chain review required (section 6).
- Its agent frontmatter dialect (snake_case `max_turns`, `inherit_context`) differs from Claude Code; the conversion is mechanical but is a conversion.
- Its spawn and scope semantics are its own; you adopt its `fallbackSubagent` and model-scope policies rather than `/do`'s.

Build-your-own on official primitives (`ctx.newSession`/`ctx.fork`, `pi.setModel`, `ctx.modelRegistry`, `pi.on("tool_call")`): justified only if you must control the exact dispatch and attribution semantics for the compliance work (`docs/requirements/FR-NFR-harness-governance.md` SC-019, FR-227). The cost is real: you reimplement child-session construction, tool-scope enforcement, and extension injection, which `tintinweb` shows is nontrivial. The e2e test comment states the hard part plainly: "`ExtensionBindings` has no tool_call hook, so there is no SDK-level way to inject a veto into a session we construct" (`test/e2e/tool-veto-reachability.e2e.test.ts`), so a from-scratch builder must wrap `session.agent.beforeToolCall` and load an inline extension into the child exactly as `tintinweb` does. Recommendation: do not build from scratch first. Reuse to prove routing, and if the compliance attribution contract cannot be met on the reused extension, fork it or build a minimal own extension for the governed subset only.

Other candidates, for the record (verify before use):
- `HamdiMaz/pi-sub-agent` (pi.dev/packages/pi-sub-agent): subagents are separate subprocesses launched as `pi --mode json -p --no-session`; markdown agents with `name`/`description`/`tools`/`model`/`thinking`; parallel (max 8) and chain modes. No skill config and no session fork documented, and no extension-injection path, so a governance gate cannot be loaded into the child. README-only, not verified in code.
- `chthub/pi-subagents`: separate `pi --mode rpc` child processes with persisted sessions; per-call `model`/`thinking`/`tools`; background default; exposes a `pi-subagents:child-launch:v1` event that "lets other extensions modify a child's environment and extensions", which is a possible injection path for a gate. README-only, not verified in code.
- `arcanemachine/pi-subagent`: spawns via RPC for parallel execution; agent types live under the `pi-subagent.agents` key in `settings.json` (not markdown files); per-type `model`/`thinking_level`/`when_to_use`/`extra_context`/`fork`; no per-agent tools and no hook attribution documented. README-only, not verified in code.
- `HazAT/pi-interactive-subagents`: spawns and manages subagent sessions in cmux terminals; interactive focus, not a headless orchestration layer. README-only, not verified in code.
- `pi-ecosystem/pi-spawn` redirects to `pi-ecosystem/pi-jobs`: runs shell commands as persistent session-tracked jobs; not a model-routing subagent layer. README-only, not verified in code.

## 4. Hooks

The matching logic ports; the plumbing does not. Each assist-plugin hook is a Node process that Claude Code spawns per event, reads JSON on stdin, and answers on stdout per `hooks/hooks.json`. The entry files are thin ES5 launchers that gate the Node version and then call an impl module's `main()` (`hooks/fsa-write-bar.js`, `hooks/lib/launch.js`). In Pi, every hook becomes an in-process TypeScript handler registered with `pi.on(event, handler)` inside one extension module (https://pi.dev/docs/latest/extensions). Delete `hooks.json`, `lib/launch.js`, and the per-hook stdin/stdout JSON handling; keep and port the rule libraries (`lib/prose-rules.js`, `lib/prose-diff.js`, `lib/attribution-rules.js`, `lib/injection-rules.js`, `lib/shell-lex.js`, `lib/shell-program.js`, `lib/fsa-paths.js`, `lib/fsa-tables.js`), which are pure logic and translate to TypeScript with little change.

Event mapping (Claude Code -> Pi, events verified at https://pi.dev/docs/latest/extensions):

| assist-plugin hook | Claude Code trigger | Pi event and verdict shape |
|---|---|---|
| `fsa-write-bar` | PreToolUse `Write\|Edit\|MultiEdit\|NotebookEdit` | `tool_call` on `write`/`edit`; return `{ block: true, reason }` |
| `prose-gate` | PreToolUse Write | `tool_call` on `write`/`edit`; block |
| `prose-advisor` | PostToolUse Write | `tool_result` or `tool_execution_end`; notify only (no block) |
| `commit-attribution-guard` | PreToolUse `Bash\|PowerShell` | `tool_call` on `bash`; inspect `event.input` args; block |
| `doc-cli-guard` | PreToolUse `Bash\|PowerShell` | `tool_call` on `bash`; block |
| `sa-mermaid-only` | PreToolUse Bash | `tool_call` on `bash`; block |
| `pr-post-ask` | PreToolUse `Bash\|PowerShell` (ask) | `tool_call` on `bash`; no documented ask verdict (gap) |
| `injection-filter` | PreToolUse Agent, PostToolUse web/mcp/Agent/Bash, UserPromptSubmit | `tool_result` mutation (`event.input` is mutable); `tool_call` for the Agent-equivalent; a prompt/input event for typed prompts |
| `writing-context` | SessionStart, SubagentStart | `session_start`; plus per-agent `extra_context`/system prompt for subagents |
| `fsa-log` | PostToolUse Agent/SubagentHandback, SubagentStop | `tintinweb` `subagents:completed`/`failed` or `agent_end` |
| `health-check` | SessionStart | `session_start` self-test |

What ports directly: the rule evaluation. `tool_call` can block (`{ block: true, reason?, terminate? }`) and can modify arguments (`event.input` is mutable and affects execution; "No re-validation is performed after your mutation"), both verified at https://pi.dev/docs/latest/extensions. So the deny decisions of `fsa-write-bar`, `prose-gate`, `commit-attribution-guard`, `doc-cli-guard`, and `sa-mermaid-only` map onto a `block` return, and the rewrite behavior of `injection-filter` maps onto mutating `event.input` on `tool_result`.

What must be rewritten or redesigned:
- The process/JSON plumbing disappears (handlers are in-process). The Node-version gate in `lib/launch.js` is moot because Pi loads TypeScript through jiti in its own runtime (https://pi.dev/docs/latest/extensions).
- `pr-post-ask` relies on Claude Code's "ask" verdict (prompt, do not deny). Pi's `tool_call` documents `block`, not a non-blocking ask. Until an ask verdict is confirmed, emulate it by blocking with a reason that tells the user to re-run after confirmation, or route PR-posting through a custom tool that prompts. Unverified whether Pi exposes a prompt-and-continue verdict to `tool_call`.
- `injection-filter`'s UserPromptSubmit path maps to an input/prompt event (`input`, `ui_prompt_start`, or `context` are candidates at https://pi.dev/docs/latest/extensions); which one carries the typed prompt for mutation is unverified. Confirm against the event payload reference.
- `writing-context` per-subagent injection: SessionStart maps to `session_start`, but the per-subagent injection must happen in the subagent session. Use the subagent extension's per-agent `extra_context` or a `before_agent_start` handler loaded into the child (section 6).

Behavioral contract to preserve:
- Fail open. assist-plugin hooks never exit 2 on their own failure; any crash prints a `systemMessage` and exits 0 so the command still runs (`hooks/lib/launch.js`, header comment "Fail-open: every failure path prints ... and exits 0. It never exits 2."; `docs/TOKEN_OPTIMIZATION.md:69` "All are guardrails (fail-open if `node` is missing)"). Pi's own guidance pulls the other way for safety gates: it advises that gate handlers "should fail closed when their safety decision cannot be made" (https://pi.dev/docs/latest/extensions). Decide per hook. The assist-plugin design treats these as guardrails, not boundaries (`rules/assist-plugin-rule.md:404` "Hook Fail-Open Rule"), so wrap each handler body in try/catch that logs and returns no block, matching current behavior, unless you deliberately upgrade a specific gate to fail closed.
- Block/modify on tool_call only on a positive match. `prose-gate` denies only when the write adds a block-tier tell, never judging existing text (`rules/assist-plugin-rule.md:414`); `injection-filter` rewrites only on a positive rule match and never blocks (`rules/assist-plugin-rule.md:416`). Preserve both: return no block when no rule matches, and mutate only matched spans.
- Self-test and auto-disable. `injection-filter` auto-disables if its benign/injection self-test corpus fails (`rules/assist-plugin-rule.md:416`); keep that self-test in the extension's `session_start` path.

## 5. Packaging and install

Package shape (https://pi.dev/docs/latest/packages): a directory or npm package. With no manifest, Pi discovers `extensions/`, `skills/`, `prompts/`, `themes/`. An explicit `pi` key in `package.json` can declare `extensions`, `skills`, `prompts`, `themes` paths (arrays accept globs and `!` exclusions, resolved from the package root). For the agents, `tintinweb` reads a `pi.subagents.agents` array (README), so the assist-plugin agent files ship under that key.

Proposed layout for a Pi package `assist-pi`:
- `extensions/assist-governance.ts` (the ported hooks as one extension).
- `skills/` (the 22 skill directories, moved as-is).
- `agents/` (the 16 converted agent files), declared via `"pi": { "subagents": { "agents": ["./agents"] } }`.
- `package.json` with the `pi-package` keyword (makes it gallery-eligible), `pi` resource keys, and `peerDependencies` set to `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `typebox` at `"*"` (do not bundle these; https://pi.dev/docs/latest/packages).
- A dependency on the chosen subagent extension (for example `@tintinweb/pi-subagents`), or instruct the user to `pi install` it alongside.

Install and configure:
1. `pi install npm:@tintinweb/pi-subagents` (or `git:`/local path) to get the subagent layer (https://pi.dev/docs/latest/packages). Confirm the exact npm name against its `package.json` before publishing instructions; the `pi.dev/packages/pi-sub-agent` entry resolves to a different package (`HamdiMaz/pi-sub-agent`), so do not conflate the two.
2. `pi install npm:<your-assist-pi>` or `pi install <local path>` for this package. Local paths load without copying (https://pi.dev/docs/latest/packages).
3. Personal installs write to `~/.pi/agent/settings.json`; `--local`/`-l` writes to `.pi/settings.json` (same page). Packages are declared in a `packages` array; per-type filters (`extensions`, `skills`, `prompts`, `themes`) narrow what loads.
4. Trust the project. Project packages and `.pi/settings.json` load only after project trust is resolved (https://pi.dev/docs/latest/packages). Review third-party source before trusting.
5. `pi config` (Tab to switch personal/project scope) enables or disables discovered resources; run it to confirm all 22 skills, 16 agents, and the governance extension loaded.

Model configuration so the user can select other models:
1. Configure provider auth for each provider you will route to (Anthropic, plus any other). `pi.setModel` returns `false` without configured auth (https://pi.dev/docs/latest/extensions), so auth must exist first.
2. To reach a non-default host, ship or install an extension that calls `pi.registerProvider()` (the docs' `custom-provider-anthropic/` and `custom-provider-gitlab-duo/` examples). The provider config fields are unverified here; confirm against the Providers reference.
3. Set each agent's `model:` pin in its file, using exact `provider/modelId` if you will scope with `enabledModels`.
4. Put an `enabledModels` array of exact `provider/modelId` entries in `settings.json` (global and/or project) and turn on `scopeModels` in the subagent extension (`/agents -> Settings -> Scope models`, verified in `tintinweb` `src/model-scope.ts`). This bounds which models any agent may use.
5. Optional: register a virtual model (`registerVirtualModel`) and pin routing-tier agents at it to keep the Haiku/Sonnet/Opus policy in one place (signature unverified; confirm first).

## 6. Risks and gaps

### 6.1 Security-model dependency (main risk)

assist-plugin's governance assumes one top-level hook sees every tool call, including a subagent's, and can read who did it. `fsa-write-bar` keys its deny decisions on two fields on the hook payload: `agent_type`, and `agent_id`, which "is present only when the hook fires inside a subagent" (`hooks/impl/fsa-write-bar.js:171-176`). `fsa-log` reads the same fields to attribute each terminal block to an `agent_id` (`hooks/impl/fsa-log.js:76-88, 114-115`). The compliance work depends on exactly this: the requirements call for "a per-event attribution record" and "per-agent identity" (`docs/requirements/BRD-harness-governance.md:46`), and SC-019 requires that "Each governed event carries the five attribution fields" at 100% (`docs/requirements/BRD-harness-governance.md:90`), with FR-227 defining the attribution record (`docs/requirements/FR-NFR-harness-governance.md:343`). FR-227 puts all five fields (operation, data accessed, agent identity, human authorizer, timestamp) on the per-access audit log `audit.jsonl`; the subagent report log `fsa-log.jsonl` adds only agent identity and human authorizer, with no operation or data-accessed field (`docs/requirements/FR-NFR-harness-governance.md:345`). FERPA, HIPAA, and SOC 2 profiles are built on "one attributable audit trail" (`docs/requirements/BRD-harness-governance.md:36`, FR-230/FR-232 log access and PHI actions at agent level, `docs/requirements/FR-NFR-harness-governance.md:42-46`).

Verified finding: Pi does not give a parent-bound `tool_call` handler the subagent's tool calls at all, so there is no parent-side per-event subagent view and no documented subagent-identity field on `tool_call`. The evidence is in the chosen extension's own source, which had to work around it: "`ExtensionBindings` has no tool_call hook, so there is no SDK-level way to inject a veto into a session we construct. Pi exposes the veto to EXTENSIONS as `pi.on("tool_call") -> { block, reason }`, but we are the SDK caller here, not an extension bound to the child session" (`tintinweb/pi-subagents` `test/e2e/tool-veto-reachability.e2e.test.ts`). The official docs corroborate the direction: on `tool_call` the only cross-call identity field is `parentToolCallId`, present "when another tool made the call", for nested tool calls within a session, not a subagent identity (https://pi.dev/docs/latest/extensions). Pi marks subagent session construction with an async-local `inChildSessionContext()` flag (`src/child-context.ts`), which is internal to the subagent extension, not surfaced on a parent `tool_call` event.

Consequence and the one viable port: the governance gate must run inside each subagent session, not once at the top. The verified mechanism is the agent frontmatter `extensions:` field, which loads named extensions into that agent's child session (`src/types.ts:48`, `src/custom-agents.ts:196`); those extensions' `tool_call` handlers then fire for the child's calls, including codemode `ctx.executeTool()` calls routed through the session's `_beforeToolCall` (demonstrated in `test/e2e/tool-veto-reachability.e2e.test.ts`). So the port must: (a) list the governance extension in every agent's `extensions:` (or use `extensions: true` to inherit all and accept that policy), and (b) derive identity inside the child from the child session itself (its agent type and session id) rather than from a parent-passed `agent_id`. Attribution then comes from the child-session context plus the subagent extension's lifecycle events (`subagents:created/started/completed/failed`, carrying `rootSessionId` and per-agent `.output` transcripts, README-only for payload fields, not verified in code).

Flagged as the main porting risk, partly unconfirmed: whether a governance extension loaded via `extensions:` into the child can read a stable per-agent identity sufficient for the five SC-019 attribution fields is not verified in source; only the tool-veto path (block/allow) is verified. Confirm this before porting the governed core. If it cannot be met on the reused extension, fork it or build a minimal own extension that constructs child sessions with the gate and identity attached (section 3.5).

Also note: `fsa-write-bar`'s rule that "every subagent" is barred from `.agent/main-plan/**` and `DECISIONS.md` (`hooks/impl/fsa-write-bar.js:192`, CLAUDE.md governance) only holds in Pi if the gate runs in every subagent session; a subagent spawned without the gate in its `extensions:` is unguarded. The default must therefore be gate-on-every-agent, and a subagent-extension setting that spawns without inherited extensions is a governance bypass to prevent.

### 6.2 Terminal fsa-block protocol

The terminal block (the fenced `fsa` block every dispatched agent ends with, `skills/do/references/fsa-template.md`) is prose the model emits, so it ports as skill/agent instructions unchanged. What changes is the checker: `fsa-log` reads it from Claude Code's `SubagentStop`/`SubagentHandback` payloads (`hooks/impl/fsa-log.js:76-81`). In Pi, read it from the subagent extension's completion event or transcript (`subagents:completed` and the per-agent `.output` transcript, README-only) or from `agent_end` (verified event name, payload unverified). The check logic (compare the block against the agent's `## States` table) ports directly. Risk: if the completion-event payload does not carry the agent's final message, the checker must read the transcript file, which is a different and unverified code path.

### 6.3 Execution and trust model

Pi extensions run in-process with the same OS permissions and "can inspect prompts, tool calls, files, credentials, and session history" (https://pi.dev/docs/latest/extensions). This is stronger access than assist-plugin's hooks, which are short-lived separate Node processes. Two implications: the ported governance extension is itself high-privilege code to review and sign, and any third-party subagent extension you reuse runs with the same reach. Project-local extensions load only after project trust (https://pi.dev/docs/latest/packages), so the trust boundary moves to the `pi` trust prompt rather than Claude Code's plugin install.

### 6.4 Third-party maintenance and trust

Reusing `tintinweb/pi-subagents` (or any listed extension) makes the governance guarantees depend on a third party's code and its future changes. The extension's own tests warn that its veto reaches "past the documented surface" by wrapping `session.agent.beforeToolCall`, and that a future Pi rename could silently break it (`test/e2e/tool-veto-reachability.e2e.test.ts`). Pin the dependency to an exact version or commit (Pi pins versioned npm specs and git tags/commits, https://pi.dev/docs/latest/packages), test the gate-in-child path on every upgrade, and keep the fork/own-extension option (section 3.5) ready if the upstream drops the extension-injection capability the governance port depends on.

### 6.5 Smaller gaps

- Tool coverage: PowerShell, LSP, WebSearch, WebFetch have no Pi builtins (section 3.2); agents needing them need an extension or lose the tool.
- `pr-post-ask` ask verdict unverified (section 4).
- `injection-filter` prompt-mutation event unverified (section 4).
- `registerProvider` and `registerVirtualModel` config fields unverified (section 3.3).
- Exact npm names for the subagent extensions unverified; confirm from each `package.json` before writing install commands.

## 7. Phased roadmap

Each phase lists what is verified and what to confirm before starting it.

Phase 0, provider and trust baseline. Install Pi, configure auth for every provider you will route to, and trust the project. Verified: install and settings flow (https://pi.dev/docs/latest/packages); `setModel` needs auth (https://pi.dev/docs/latest/extensions). Confirm: `registerProvider` config fields if reaching a non-default host.

Phase 1, skills. Move the 22 skill directories into the package `skills/`; run `pi config` and confirm all load. Verified: Agent Skills compatibility and frontmatter fields (https://pi.dev/docs/latest/skills). Confirm: whether Pi has a `user-invocable` equivalent and that preload still works for the 4 internal skills marked `user-invocable: false`; audit skill bodies for hard-coded Claude Code tool names.

Phase 2, agents on one extension to prove model routing. Install `tintinweb/pi-subagents`, convert the 16 agent files (model, thinking, tools remap, skills), pin models, set `enabledModels`, turn on `scopeModels`. Prove an agent runs on Haiku, another on a non-Anthropic model, and that an out-of-scope caller model is rejected. Verified in source: agent file format and fields (`src/custom-agents.ts:183-213`), model scoping (`src/model-scope.ts`, `src/enabled-models.ts`), model pin lock (`src/types.ts:54`). Confirm: tool remap targets for PowerShell/LSP/WebSearch/WebFetch; exact npm name; virtual-model signature if you use a router.

Phase 3, hooks as one in-process extension. Port the pure rule libraries to TypeScript and register `tool_call`/`tool_result`/`session_start` handlers; keep fail-open try/catch; preserve positive-match-only blocking. Validate each gate blocks and allows as the current hook does. Verified: `tool_call` block/modify, event names, in-process model (https://pi.dev/docs/latest/extensions). Confirm: `pr-post-ask` ask verdict; `injection-filter` prompt event; whether to fail open or closed per gate.

Phase 4, governed core (highest risk, do last). Wire the governance extension into every agent's `extensions:`, re-establish per-agent identity from the child session for both audit paths: the five-field FR-227 record lands on the per-access audit log `audit.jsonl`, while `fsa-log.jsonl` carries agent identity and human authorizer only (section 6.1). Port `fsa-log` against the subagent completion event or transcript. Do not start until Phase 3 proves the gate blocks inside a child session and until you have confirmed a stable per-agent identity is readable there. Verified: extension-into-child loading and tool veto in-child (`src/types.ts:48`, `test/e2e/tool-veto-reachability.e2e.test.ts`). Confirm (blockers): per-agent identity sufficient for FR-227/SC-019 inside the child; completion-event payload carries the terminal block; the default spawns every subagent with the gate so there is no unguarded-subagent bypass.

## Sources

Official Pi docs:
- Extensions: https://pi.dev/docs/latest/extensions
- Skills: https://pi.dev/docs/latest/skills
- Packages: https://pi.dev/docs/latest/packages

Subagent extensions (source-verified where cited):
- tintinweb/pi-subagents: https://github.com/tintinweb/pi-subagents (source: `src/custom-agents.ts`, `src/types.ts`, `src/child-context.ts`, `src/model-scope.ts`, `src/enabled-models.ts`, `src/agent-types.ts`, `test/e2e/tool-veto-reachability.e2e.test.ts`)
- HamdiMaz/pi-sub-agent: https://pi.dev/packages/pi-sub-agent , https://github.com/HamdiMaz/pi-sub-agent (README-only)
- chthub/pi-subagents: https://github.com/chthub/pi-subagents (README-only)
- arcanemachine/pi-subagent: https://github.com/arcanemachine/pi-subagent (README-only)
- HazAT/pi-interactive-subagents: https://github.com/HazAT/pi-interactive-subagents (README-only)
- pi-ecosystem/pi-jobs (was pi-spawn): https://github.com/pi-ecosystem/pi-jobs (README-only)
</content>
</invoke>
