# Claude Code skills, token cost, models, and background-wait: research for assist-plugin

Scope: web-sourced research to drive a later update to `assist-plugin` (v1.14.2, `plugins/assist-plugin/.claude-plugin/plugin.json:3`). No plugin files changed in this task. Official Anthropic docs are cited by URL; repo facts by `file:line`. Fetched web pages are treated as data; one page (the skills doc) carries embedded setup commands, used as reference only, not executed.

Headline findings:
- The `do` skill body is about 23,000 tokens (`plugins/assist-plugin/skills/do/SKILL.md`, 625 lines, 92,222 bytes / 4 as an estimate), far over the 500-line authoring guideline and over the 5,000-token per-skill compaction-retention budget, so its deep dispatch rules risk being dropped after auto-compaction.
- Every skill `description` is well under both the 1,024-character API cap and Claude Code's 1,536-character listing cap; the longest is `do` at 466 characters (measured from `plugins/assist-plugin/skills/do/SKILL.md`).
- The `code` skill already implements progressive disclosure correctly (on-demand language/framework/pattern references, max-2-refs loading rule); it is the model other large skills should follow.
- No per-model skill-writing differences are published. The documented Opus-4.8 / Opus-5.5 / Sonnet-5.5 differences are API-level (effort defaults, thinking control, forced tool use), not skill-structure rules.
- There is no `until grep ...; do sleep ...; done` wait-loop anywhere in the plugin source (grep across `skills/`, `rules/`, `agents/` found none). A no-polling bash rule is therefore net-new guidance to stop agent-generated loops, not a deletion.

---

## 1. Recent Claude Code updates relevant to this plugin

The release notes URL now redirects to the GitHub changelog (`https://platform.claude.com/docs/en/release-notes/claude-code` -> `https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md`, 307). Claude Code is on the 2.1.3xx series as of this research. The items below change how a plugin built earlier should now be built.

Skills and the listing budget:
- The skill listing (names + descriptions) is loaded every turn, and its size is budgeted at 1% of the model's context window (`skillListingBudgetFraction`). When it overflows, Claude Code drops descriptions starting with the least-invoked skills, which removes the keywords Claude matches against. Source: https://code.claude.com/docs/en/skills
- A skill's combined `description` + `when_to_use` is truncated at 1,536 characters in the listing, configurable via `skillListingMaxDescChars`. Source: https://code.claude.com/docs/en/skills
- Before v2.1.196, the `/context` Skills row counted full descriptions and could overstate the real cost; it now matches what the model receives. Source: https://code.claude.com/docs/en/skills
- `/skill-doctor` (added v2.1.252) finds unused skills; `/doctor` estimates the listing's context cost. Source: https://code.claude.com/docs/en/skills
- `claude plugin validate` (requires v2.1.233+) flags SKILL.md files whose frontmatter does not parse; `claude plugin eval` with a `tool_used: Skill` grader measures how often a skill triggers. Source: https://code.claude.com/docs/en/skills
- Auto-compaction re-attaches the most recent invocation of each skill after the summary, keeping the first 5,000 tokens of each, with a combined 25,000-token budget across re-attached skills. Source: https://code.claude.com/docs/en/skills
- `${CLAUDE_SKILL_DIR}` resolves a bundled script path whether the skill is installed at personal, project, or plugin level. Source: https://code.claude.com/docs/en/skills

Hooks:
- Hooks can be declared in a skill's or agent's `hooks` frontmatter; such a hook applies from skill invocation until the session ends. This is the documented fix for "Claude stops following a skill" when a rule must hold every time. Source: https://code.claude.com/docs/en/skills
- v2.1.323 added type checking of a plugin's TypeScript hooks module to `claude plugin validate`, and a 30-second progress heartbeat while hooks run long in `claude -p` and SDK sessions. Source: https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md

Tools and background execution:
- `TaskOutput` was removed in v2.1.277; Claude now reads a background task's output file with `Read` instead. Source (tools reference, line 59 of the fetched page): https://code.claude.com/docs/en/tools-reference
- The `Monitor` tool runs a command in the background and feeds each output line back to Claude so it can react to log entries, file changes, or polled status mid-conversation; it can also open a WebSocket and treat each message as an event. Source: https://code.claude.com/docs/en/tools-reference
- In some environments (Bedrock, Claude Platform on AWS, Google Cloud Agent Platform, Microsoft Foundry, or with telemetry disabled) `Monitor` requires v2.1.310+. Plugins can declare monitors that start automatically when the plugin is active ("plugin monitors"). Source: https://code.claude.com/docs/en/tools-reference
- `run_in_background: true` starts a command as a background task; `/tasks` lists and stops them; `TaskStop` stops one by ID. Background commands have a time limit only in unattended sessions (`-p`, SDK, CI, cloud): 30 minutes default, up to a 2-hour max. A local interactive terminal session has no time limit on background commands. Source: https://code.claude.com/docs/en/tools-reference
- A foreground command that reaches its timeout is auto-moved to the background, except a command that starts with `sleep`, which is stopped instead. Source: https://code.claude.com/docs/en/tools-reference
- `bashOutputMaxChars` (v2.1.261+) sets the inline and read-back ceiling for Bash output, up to 128,000 characters. `CLAUDE_CODE_TOOL_MEMORY_LIMIT` (v2.1.233+) caps Bash/PowerShell/Monitor memory together. Source: https://code.claude.com/docs/en/tools-reference

Agents and subagents:
- Claude Code runs subagents in the background by default; background subagents surface permission prompts in the main session. Source: https://code.claude.com/docs/en/tools-reference
- Recent fixes target exactly the orchestration pattern `/do` uses: v2.1.327 fixed "the main conversation not being told a background agent had finished when the subagent that started it ended by itself," and v2.1.326 fixed "the main conversation of a terminal session waiting in silence for a background subagent" and "background subagents started in Code Mode failing when they preload a skill." Source: https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md
- v2.1.325 changed scheduled tasks and `/loop` to ask before running a skill that declares `allowed-tools` or hooks, and stopped `.claude/skills` folders inside `--plugin-dir` plugins from loading. Source: https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md

Plugin packaging:
- v2.1.323 added `engines["claude-code"]` to `plugin.json`, so a plugin can declare a supported Claude Code version range. `plugins/assist-plugin/.claude-plugin/plugin.json` does not set it today (confirmed by reading the file; it has `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords` only). Source: https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md
- Skills in a plugin ship under a `skills/` directory, which matches this repo's `plugins/assist-plugin/skills/`. Source: https://code.claude.com/docs/en/skills

Model families: Claude Opus 5.5, Sonnet 5.5, and Haiku 5.5 are generally available on the Claude API (`claude-opus-5-5`, `claude-sonnet-5-5`). Details in Part 3. Sources: https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5 and https://platform.claude.com/docs/en/models/sonnet-5-5/whats-new-sonnet-5-5

---

## 2. Skill structure for lower token cost, measured against this plugin

How loading works (official): at startup only each skill's `name` and `description` are in context; the SKILL.md body loads on invocation and then stays in context across turns; reference files load only when read and cost zero context until then; bundled scripts run without loading their contents. Sources: https://code.claude.com/docs/en/skills and https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

The measurable levers, each tied to this plugin:

Lever A: keep SKILL.md under 500 lines; split the rest into references.
- Official: "Keep `SKILL.md` under 500 lines. Move detailed reference material to separate files." and the best-practices checklist item "SKILL.md body is under 500 lines." Sources: https://code.claude.com/docs/en/skills and https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- As-built, one skill breaks this: `do` at 625 lines (`plugins/assist-plugin/skills/do/SKILL.md`). Every other skill is under 500: next largest are `pr-review` 343, `voice-script` 230, `pentest` 201, `run-test` 198, `bump` 193, `integrated-test` 188, `spec-from-requirements` 185, `health` 174, `task-plan` 157, `gather-requirements` 150, `code` 152, `commit` 148, `create-test` 144, `technical-writing` 114, `clarify` 113, `branch`/`deslop`/`map-project` 91, `ask` 81, `debug` 80, `review-md` 67 (measured by `wc -l` on each SKILL.md). Verdict: compliant except `do`.

Lever B: do not blow the per-skill compaction-retention budget; put must-hold rules near the top.
- Official: after auto-compaction Claude Code keeps only the first 5,000 tokens of each re-attached skill, so "put the most important instructions near the top of `SKILL.md`." Source: https://code.claude.com/docs/en/skills
- As-built: `do` SKILL.md is about 23,000 tokens (92,222 bytes / 4, labeled an estimate). Its must-hold dispatch invariants sit deep: the `run_in_background: true` dispatch rule and the Build-gate hold are at `plugins/assist-plugin/skills/do/SKILL.md:422`, well past the first 5,000 tokens. The States table is near the top (good), but the dispatch and change-check rules are not. Verdict: not compliant; the deep rules are at risk after compaction. The States table at the top partly mitigates, because it carries the outcome logic.

Lever C: budget the `description` (what loads every turn).
- Official caps: API `description` max 1,024 characters (https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices); Claude Code listing truncates combined `description` + `when_to_use` at 1,536 characters (https://code.claude.com/docs/en/skills). Write in third person, specific, with trigger terms first.
- As-built: all 22 descriptions are far under both caps. Measured character lengths: `pentest` 324, `spec-from-requirements` 322, `voice-script` 318, `clarify` 277, `create-test` 242, `integrated-test` 239, `health` 229, `code` 222, `gather-requirements` 218, `branch` 213, `bump` 212, `pr-review` 211, `ask` 185, `task-plan` 177, `map-project` 155, `run-test` 154, `debug` 137, `commit` 132, `technical-writing` 127, `review-md` 122, `deslop` 111, and `do` 466 (measured from each SKILL.md frontmatter). Verdict: compliant. All are third person. No action needed on size; the only risk is listing-budget overflow if the plugin grows many more skills, since the listing budget is 1% of context (Lever A of Part 1).

Lever D: references one level deep, with a table of contents for long reference files.
- Official: "Keep references one level deep from `SKILL.md`." Claude may do partial `head` reads of a file reached through a nested reference, getting incomplete information. Add a contents list to any reference over 100 lines. Source: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- As-built: `code` is exemplary: SKILL.md links its language, framework, and pattern references directly and caps tech references at two (`plugins/assist-plugin/skills/code/SKILL.md:88-137`). One nesting concern in `do`: SKILL.md cites `../gather-requirements/references/elicitation-methodology.md` (`plugins/assist-plugin/skills/do/SKILL.md:449` area), a cross-skill deep link that a reader may only partially read. Verdict: mostly compliant; audit `do` references for second-level links in the follow-up.

Lever E: prefer scripts over inlined procedures; make execution intent explicit.
- Official: bundled scripts run without loading their source, saving tokens, and the SKILL.md should say "run" versus "read as reference." Source: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- As-built: the plugin already ships scripts under `plugins/assist-plugin/scripts/` and `hooks/`, invoked by name from docs (for example `node plugins/assist-plugin/scripts/sync-writing-standard.js`). Skills themselves are procedure-and-reference, not script-driven, which fits their orchestration role. Verdict: no change needed; this lever is minor here.

Lever F: evaluation-driven iteration.
- Official: build three evaluations before extensive docs; test every skill with Haiku, Sonnet, and Opus; `claude plugin eval` can measure trigger rate. Sources: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices and https://code.claude.com/docs/en/skills
- As-built: the repo has no `evals/` for skills (not present under `plugins/assist-plugin/skills/*/`). Verdict: gap; adding eval suites for the highest-traffic skills (`do`, `code`, `debug`) would let a follow-up measure any restructuring against a baseline rather than by eye.

---

## 3. Model-specific guidance for Opus 4.8, Opus 5.5, Sonnet 5.5

Published skill-authoring guidance does not differentiate by model for structure. The best-practices page says only: test with Haiku, Sonnet, and Opus; "What works perfectly for Opus might need more detail for Haiku"; and for Opus, check the skill "avoids over-explaining." It gives no per-model SKILL.md layout, description, or progressive-disclosure rule. Source: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

The documented differences between the three models are API-level (effort, thinking, tool use), and they matter for how `/do` sets `model` and `effort` per step and for any agent that drives the API, not for prose layout. Do not invent per-model skill-writing rules beyond the one above.

Opus 5.5 (`claude-opus-5-5`):
- Adaptive thinking is always on; the effort parameter is the only control for thinking depth. Default effort is `medium` (it was `high` on Opus 5). Source: https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5
- `thinking: {"type": "disabled"}` and manual `budget_tokens` both return 400; omit `thinking` or send `adaptive`. Source: same.
- Forced tool use is unsupported: `tool_choice` `any` or `tool` returns 400. To make the model call a tool, say in the prompt when the tool applies, and use strict tool use or structured outputs for schema-valid JSON. Source: same.
- At the same effort level it tends to think more per turn than Opus 5, most at `xhigh` and `max`; Anthropic says re-run your effort sweep and leave room in `max_tokens`. Context window is 1M by default with no beta header; max output 128K. Source: same.

Sonnet 5.5 (`claude-sonnet-5-5`):
- Adaptive thinking on by default; effort controls depth; default effort is `high`. Source: https://platform.claude.com/docs/en/models/sonnet-5-5/whats-new-sonnet-5-5
- Up-front thinking is turned off with `thinking: {"type": "between_tools"}`, not `disabled` (which returns 400 and points to `between_tools`). `between_tools` is accepted at `low`/`medium`/`high` only; `xhigh`/`max` require adaptive thinking. Source: same.
- Forced tool use unsupported, same as Opus 5.5. Effort levels are recalibrated versus Sonnet 5: start at `high` generally, `medium` for well-specified agentic coding, `medium`/`low` for latency-sensitive chat. Source: same.

Opus 4.8 (`claude-opus-4-8`, the model this plugin currently runs on):
- No Opus-4.8-specific page documents its effort default or context window in the sources found; stated plainly, that guidance is not published in the pages reviewed. What is documented is cross-model: Sonnet 5.5 reads thinking blocks from Opus 4.8 and earlier but not from Opus 5/5.5; and an Opus 4.8 advisor is rejected by a Sonnet 5.5 executor (400). Sources: https://platform.claude.com/docs/en/models/sonnet-5-5/whats-new-sonnet-5-5 and https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5

Implication for this plugin: the `do` skill sets `effort: xhigh` in frontmatter (`plugins/assist-plugin/skills/do/SKILL.md:12`), and `references/model-routing.md` assigns models per agent. When the plugin moves agents to Opus 5.5 or Sonnet 5.5, the default-effort shift (Opus 5.5 default drops to `medium`; "more thinking per turn at a given effort") means the routing table's effort values should be re-swept rather than carried over. This edit belongs in the model-routing table; skill prose stays as is.

---

## 4. Background-wait pattern and the no-polling bash rule

Current recommended way to wait on background work:
- Start the work with `run_in_background: true`. Claude Code notifies the starting conversation or subagent when the task finishes, and Claude reads the task's output file with `Read` (the old `TaskOutput` tool was removed in v2.1.277). Source: https://code.claude.com/docs/en/tools-reference
- To react while other work continues, use the `Monitor` tool: it runs a command in the background and feeds each output line back as a notification, or opens a WebSocket and treats each message as an event, so Claude wakes on a matching line or a status change instead of polling. Source: https://code.claude.com/docs/en/tools-reference
- For subagent orchestration, `/do` already follows this: it dispatches every ready step with `run_in_background: true` and parses each agent's terminal `fsa` block on completion (`plugins/assist-plugin/skills/do/SKILL.md:422` and the "Read each result" section at `:447`). It does not poll. The harness delivers the completion; `/do` reacts to it.

Why `until grep ...; do sleep ...; done` polling hangs a background shell even after the process finished:
1. The harness already emits a completion signal for a background task and expects a one-shot `Read` of the output file afterward (TaskOutput removed, Read is the path). A manual poll loop duplicates that signal and adds a second long-running shell that the harness does not treat as "the task," so nothing ends the loop when the watched task completes. Source: https://code.claude.com/docs/en/tools-reference
2. A `sleep`-led command is specifically carved out of timeout auto-backgrounding: "When a foreground command reaches its timeout without finishing, Claude Code moves it to the background instead of stopping it, unless the command starts with `sleep`." An `until ...; do sleep N; done` gate whose loop body is a sleep is therefore never auto-moved; a foreground instance blocks the agent's turn until it is stopped. Source: https://code.claude.com/docs/en/tools-reference
3. In a local interactive session there is no time limit on background commands, so a backgrounded poll loop never self-terminates; it spins, holds a shell slot, and counts against `CLAUDE_CODE_TOOL_MEMORY_LIMIT`. Source: https://code.claude.com/docs/en/tools-reference
4. The grep exit condition can fail to flip: the watched process may buffer output, write to a different file than the loop greps, or already have exited and been reaped while the loop keeps sleeping. The loop then has no event that ends it. Third-party bug reports describe exactly this symptom ("background bash tasks run in background polling loops get stuck post completion"), corroborating the mechanism; labeled third-party and not an official source. Source: https://claudeissues.com/issue/55893-background-bash-tasks-run-in-background-polling-loops-get-stuck-post-completion

Confirmation of net-new status: a grep for `until grep`, `sleep `, polling, and wait-loop constructs across `plugins/assist-plugin/skills/`, `rules/`, and `agents/` found no such wait-loop in the plugin source. The only adjacent text is `plugins/assist-plugin/skills/do/references/developer-self-review.md:61` ("No polling loops when events/callbacks available"), which is a performance checklist item about application code, not a rule about the agent's own shell. So the rule below is additive guidance to stop agent-generated loops, not a replacement of existing text.

Copy-ready no-polling bash rule (exact wording to add):

> No background-wait polling loops. Do not wait on background work with a shell loop such as `until grep ...; do sleep N; done`, `while ! test -f done.flag; do sleep N; done`, or `tail -f` used as a gate. Claude Code already signals when a background task finishes: start the work with `run_in_background: true`, wait for the completion notification, then `Read` the task output file once. To react to a line of output or a status change while other work continues, use the Monitor tool, which feeds each output line back as it arrives. A `sleep`-led loop is exempt from timeout auto-backgrounding, has no time limit in a local session, and keeps spinning after the watched process exits, so it blocks the turn or wedges a shell.

Harness mechanism the rule points agents to: the Bash `run_in_background: true` completion notification plus a one-shot `Read` of the output file, and the `Monitor` tool for reactive watching (both at https://code.claude.com/docs/en/tools-reference).

Files that should carry it (evaluated):
- `plugins/assist-plugin/skills/code/SKILL.md` (primary): the developer and worker agents preload this skill and generate most of the plugin's shell. Add the rule as a short subsection near Principles. High impact.
- `plugins/assist-plugin/rules/assist-plugin-rule.md` (governance): add a one-line "Background work" entry next to the existing "Shell Write Path" section (`:493`) so the rule applies to every agent, not only code-writers. Medium impact.
- `plugins/assist-plugin/skills/do/SKILL.md` dispatch guidance: already compliant (uses `run_in_background` + terminal blocks). Add at most one sentence telling dispatched agents not to poll inside their own shells. Low impact; the governance rule covers it.
- Optional: tighten `developer-self-review.md:61` from "No polling loops when events/callbacks available" to name the bash wait-loop case and the `run_in_background` + Read mechanism, so the self-review checklist and the rule agree. Low impact.

---

## Recommended changes

Ordered by impact. Each is one candidate edit for the follow-up plan, with rationale and source.

1. Split `plugins/assist-plugin/skills/do/SKILL.md` (625 lines, about 23,000 tokens) to under 500 lines by moving the Dispatch, Read-each-result, and Change-check bodies into one-level-deep references, and hoist the must-hold dispatch invariants (run_in_background, Build-gate hold) near the top. Rationale: it is the only skill over the 500-line guideline, and its deep rules fall outside the 5,000-token compaction-retention window. Source: https://code.claude.com/docs/en/skills ; `plugins/assist-plugin/skills/do/SKILL.md:422`.
2. Add the no-polling bash rule to `plugins/assist-plugin/skills/code/SKILL.md`. Rationale: stops developer/worker agents from writing `until grep; sleep` loops that wedge a shell; net-new (no such loop exists today). Source: https://code.claude.com/docs/en/tools-reference ; grep confirmation across `plugins/assist-plugin/skills`.
3. Add a one-line "Background work: no polling loops" rule to `plugins/assist-plugin/rules/assist-plugin-rule.md` beside the Shell Write Path section so it binds every agent. Rationale: governance-level coverage beyond code-writers. Source: https://code.claude.com/docs/en/tools-reference ; `plugins/assist-plugin/rules/assist-plugin-rule.md:493`.
4. Set `engines["claude-code"]` in `plugins/assist-plugin/.claude-plugin/plugin.json`. Rationale: v2.1.323 lets a plugin declare a supported Claude Code range; the file sets none today, so installs on out-of-range versions are not flagged. Source: https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md ; `plugins/assist-plugin/.claude-plugin/plugin.json`.
5. Re-sweep effort values in `plugins/assist-plugin/skills/do/references/model-routing.md` before moving agents to Opus 5.5 or Sonnet 5.5. Rationale: Opus 5.5 default effort drops to `medium` and "thinks more per turn at a given effort"; carried-over settings misbudget tokens. Source: https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5 ; `plugins/assist-plugin/skills/do/SKILL.md:12`.
6. Audit `do` references for second-level links (for example the cross-skill `../gather-requirements/references/elicitation-methodology.md`) and flatten to one level or inline the needed lines. Rationale: nested references can be partially read, giving Claude incomplete rules. Source: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices.
7. Add a contents list to every reference file over 100 lines under `plugins/assist-plugin/skills/*/references/`. Rationale: protects against partial `head` reads during progressive disclosure. Source: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices.
8. Stand up `evals/` suites for the highest-traffic skills (`do`, `code`, `debug`) using `claude plugin eval`. Rationale: lets the follow-up measure the restructuring in items 1, 6, 7 against a baseline instead of by eye, and tracks trigger rate after description edits. Source: https://code.claude.com/docs/en/skills ; https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices.
9. Consider converting must-hold-every-time invariants (for example the FSA write bars, already hooks) that currently live only in skill prose into skill/agent `hooks` frontmatter where a skill must enforce them for its whole session. Rationale: the docs name this as the fix for "Claude stops following a skill" mid-task. Source: https://code.claude.com/docs/en/skills. Lowest priority; most of this plugin's hard rules are already real hooks under `plugins/assist-plugin/hooks/`.

```fsa
fsa: researcher/1
state: Done
trace: Intake > Research > Draft > Report
artifact: /home/tj/Projects/Personal/assist-marketplace-plugin/docs/research/research-cc-skills-token-opt-20261118.md
verdict: none
skipped: none
out_of_scope: none
error_class: none
questions: none
resume_at: none
```
