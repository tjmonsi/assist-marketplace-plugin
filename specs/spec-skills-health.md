# spec-skills-health

## Metadata

| Field | Value |
|---|---|
| **Feature** | Hook health skill: `/health` |
| **Parent feature** | spec-skills.md |
| **Sub-features** | None |
| **Requirement refs** | BR-007, UR-018, UR-055, FR-104, FR-166, FR-118, FR-206, FR-213 |
| **Feature type** | Tooling |
| **Status** | Review |

Status values: Draft, Review, Approved, Implemented.

Paths that start with `skills/` or `hooks/` are relative to `plugins/assist-plugin/`. Baseline: the build of 2026-10-22 (follow-up to 1.12.0); `skills/health/SKILL.md` (98 lines) was re-read on 2026-10-22 after the build, and every cite below points at that file. The Change Logs 2026-10-16 and 2026-10-22 at the end are folded into this body (Change Log: 2026-10-22 (fold)).

## Description

`/health` runs the plugin's health-check script, then summarizes the result in a few lines and pairs each finding with its fix. The script itself (self-tests, auto-disable, the report sections, the attribution-settings check, and `--clear`) belongs to Area B (FR-091, FR-118 to FR-120); this spec covers what the skill runs, how it reads the output, and what it tells the user. The script self-tests `writing-context` (report-only: a failure is reported and never disables the hook) and the `pr-post-ask` guard (a false ask disables it, a missed ask reports weak protection; FR-118, FR-206, Area B), and the skill's overview and findings table carry the matching text and fix rows.

Resolved source difference (OP-2, built in 1.11.1): the skill's overview (`skills/health/SKILL.md:17`) now says the prose hooks skip `docs/tts/` under the project root and under the session's working directory when that directory is inside the project, as `DECISIONS.md:73-76` and FR-181 (Area B, built in 1.11.1) state. No requirement in this spec depends on that line.

## Triggered by

| Trigger type | Source | Condition |
|---|---|---|
| User action | `/health [--clear]` (`skills/health/SKILL.md:12`); `README.md` uses `/assist-plugin:health` | The user wants hook status, or a hook warning or session-start notice pointed here |
| Fix follow-up | A finding's fix says to run `/assist-plugin:health` again (`skills/health/SKILL.md:40-69`, `:91`) | After the user fixed a cause |

## Required data

| Data | Source | Type | Notes |
|---|---|---|---|
| `--clear` | Argument | Flag | Passed on only when the user typed it |
| `${CLAUDE_PLUGIN_ROOT}` | Claude Code | Path | Locates `hooks/health-check.js` |
| `${CLAUDE_PLUGIN_DATA}` | Claude Code | Path | Data directory holding `hook-health.jsonl`, `fsa-log.jsonl`, `hooks-disabled.json` |
| Script output | `hooks/health-check.js` | Text report, or `{"systemMessage": ...}` | Node version, self-test results, disabled guards, recent health-log entries, recent `fsa-log` problem rows, attribution-settings section |
| Findings and fixes table | `skills/health/SKILL.md:36-69` | Table | One fix per finding kind |
| FSA problem codes | `skills/health/SKILL.md:71-89` | Table | `no-block`, `fsa-mismatch`, `bad-state`, and ten more |

## Behavior

### Requirement: Run the health check with the user's flag

The `/health` skill SHALL run `node "${CLAUDE_PLUGIN_ROOT}/hooks/health-check.js" --data-dir "${CLAUDE_PLUGIN_DATA}"`, adding `--clear` only when the user passed it.

**Requirement refs:** FR-166, UR-018 | **Status:** Built | **Source:** `skills/health/SKILL.md:8-11`, `:19-28`

The skill's grants allow exactly these two command forms plus Read. With `--clear` the script shows the logs first and then truncates `hook-health.jsonl`; it never truncates `fsa-log.jsonl` (Area B FR-119).

#### Scenario: Plain run

- **GIVEN** the user runs `/health`
- **WHEN** the skill runs the check
- **THEN** the command SHALL be the form without `--clear`

#### Scenario: Clear requested

- **GIVEN** the user runs `/health --clear`
- **WHEN** the skill runs the check
- **THEN** the command SHALL be the form with `--clear`

#### Scenario: Long log without the flag

- **GIVEN** the user runs `/health` and the report shows many old log entries
- **WHEN** the skill finishes
- **THEN** it SHALL NOT run the `--clear` form; it MAY suggest `/assist-plugin:health --clear` once the entries are handled

### Requirement: Short summary with a fix per finding

The `/health` skill SHALL summarize the status in a few lines and give each finding its fix from the findings table.

**Requirement refs:** FR-166, FR-118, FR-206, UR-018, UR-055, BR-007 | **Status:** Built: the `writing-context` row in 1.12.0 (commit `bb09e29`); the `pr-post-ask` overview and rows in the follow-up to 1.12.0 (build of 2026-10-22). Folded from the Change Logs 2026-10-16 and 2026-10-22 | **Source:** `skills/health/SKILL.md:17` (overview), `:34-69` (summary step and findings table), `:91`

The summary starts with the overall status (healthy or needs attention), then one entry per finding. A clean report prints `PASS` for every hook and `Disabled guards: none`. For an attribution-settings finding the fix tells the user to set `{"attribution": {"commit": "", "pr": ""}}` in the file the report names; neither the skill nor the script edits a settings file.

Findings rows for the two hooks the 1.12.0 and follow-up builds added (`skills/health/SKILL.md:54-55`, `:62`):

| Finding | Meaning | Fix |
|---|---|---|
| `pr-post-ask` self-test FAIL, "known-safe command was ASKED" | The hook was auto-disabled, so PR posting commands run with no prompt from it and only the calling flow's own confirmation applies | Report the bug with the report output; after a plugin update, run `/assist-plugin:health` again, and a passing self-test re-enables it |
| `pr-post-ask` self-test FAIL, "known posting command was NOT ASKED" | The hook stays enabled with weak protection | Report the bug with the report output |
| `writing-context` self-test FAIL | The hook stays enabled, and sessions and subagents may start without the writing standard | Restore `rules/writing-standard-compact.md` by reinstalling or updating the plugin, then run `/assist-plugin:health` again; report the bug when the plugin files are unmodified. `writing-context` never appears under disabled guards |

The overview (`skills/health/SKILL.md:17`) names `pr-post-ask` among the PreToolUse guards and says that it asks before `gh pr review`, `merge`, `comment`, and `close`, `bkt pr approve`, `comment`, `decline`, `close`, and `merge`, and a `bkt api` call that may write (an option it does not recognize counts as a possible write), in every session; that it asks and never denies and fails open; that it is best-effort and a bypass form found later is added to its list; and its known gaps, exactly as spec-hooks-pr-post-ask.md, Requirement 9, lists them, and no other. It lists no `bkt api` gap, because an unrecognized `bkt api` option asks. It also states the permission behavior found by the build's research (`DECISIONS.md:248-251`): with several PreToolUse hooks a deny from another hook beats this ask; the ask prompts in default and acceptEdits modes and forces a prompt in auto mode; in a non-interactive `-p` run with no one to answer, the call is denied; whether the ask prompts in bypassPermissions mode or plan mode, and whether an installed mod can approve a call the hook would prompt for, is unverified. The overview also says `writing-context` has a self-test whose failure is reported and never disables the hook.

#### Scenario: Healthy

- **GIVEN** every self-test passes and no guard is disabled
- **WHEN** the user runs `/health`
- **THEN** the skill SHALL report the healthy result in one line

#### Scenario: Guard disabled by a failed self-test

- **GIVEN** the report lists `doc-cli-guard` under disabled guards after a "known-safe command was DENIED" failure
- **WHEN** the skill summarizes
- **THEN** the entry SHALL say the guard passes commands unchecked and give the fix: report the bug with the report output, and run `/assist-plugin:health` again after a plugin update

#### Scenario: Attribution setting not empty

- **GIVEN** the report says `attribution.commit` is unset in `~/.claude/settings.json`
- **WHEN** the skill summarizes
- **THEN** the entry SHALL name the file and key and show `{"attribution": {"commit": "", "pr": ""}}`
- **AND** no settings file SHALL change

#### Scenario: FSA problem rows

- **GIVEN** the report lists `fsa-log.jsonl` rows with the code `illegal-transition: Intake>Review` for `reviewer`
- **WHEN** the skill summarizes
- **THEN** the entry SHALL explain the code from the problem-code table and point at the agent's `## States` table

#### Scenario: Failed writing-context self-test

- **GIVEN** the report shows the `writing-context` self-test failed because `rules/writing-standard-compact.md` is unreadable
- **WHEN** the skill summarizes
- **THEN** the entry SHALL say `writing-context` stays enabled and sessions may start without the writing standard, and SHALL give the fix: restore the file by reinstalling or updating the plugin, then run `/assist-plugin:health` again
- **AND** the entry SHALL NOT list `writing-context` under disabled guards, and no settings or `hooks-disabled.json` file SHALL change because of the skill

#### Scenario: Passing writing-context self-test

- **GIVEN** every self-test, the `writing-context` one included, passes and no guard is disabled
- **WHEN** the user runs `/health`
- **THEN** the skill SHALL report the healthy result in one line and SHALL NOT mention `writing-context`

#### Scenario: Ask hook disabled by a false ask

- **GIVEN** the report lists `pr-post-ask` under disabled guards after "known-safe command was ASKED"
- **WHEN** the skill summarizes
- **THEN** the entry SHALL say that PR posting commands run with no prompt from the hook and that only the calling flow's own confirmation applies, and SHALL give the fix: report the bug with the report output, then run `/assist-plugin:health` again after a plugin update

#### Scenario: Ask hook misses a posting command

- **GIVEN** the report shows "known posting command was NOT ASKED" for `pr-post-ask`
- **WHEN** the skill summarizes
- **THEN** the entry SHALL say the hook stays enabled with weak protection and give the fix: report the bug with the report output

#### Scenario: Overview describes the writing-context self-test

- **GIVEN** `skills/health/SKILL.md` at the build of 2026-10-22
- **WHEN** a test reads the overview (`:17`)
- **THEN** it SHALL say `writing-context` has a self-test whose failure is reported and never disables the hook, and SHALL NOT say the hook has no self-test

#### Scenario: Overview lists the hook and its gaps

- **GIVEN** `skills/health/SKILL.md` at the build of 2026-10-22
- **WHEN** a test reads the overview (`:17`)
- **THEN** it SHALL name `pr-post-ask` among the guards, name the commands it asks before, say it covers every session, say it is best-effort, and list its known gaps exactly as spec-hooks-pr-post-ask.md, Requirement 9, lists them, and no other:
  - a program word taken from a variable or an expression, and PowerShell splatting;
  - `gh api` with any method, `gh pr edit`, `gh pr ready`, `gh pr reopen`, a `gh` alias or extension that expands to a posting command, and `bkt pr` subcommands other than `approve`, `comment`, `decline`, `close`, and `merge`;
  - a command string run by another program (`bash -c`, `sh -c`, `pwsh -Command`, `cmd /c`, `eval`, `Invoke-Expression`, `xargs`, `find -exec`, and the other forms Requirement 9 names), and argv wrappers outside the wrapper list (`setsid`, `doas`, `ionice`, `stdbuf --output`);
  - a posting command inside a command substitution in another program's argument (`echo $(gh pr merge 1)`), while a substitution in the program word or in a word before it is judged and asks;
  - a Bash program name in another case (`GH`), `.cmd`, `.bat`, and `.ps1` shims, shell aliases, and renamed or linked binaries;
  - an option with a separate value ahead of the verb that the option lists do not name (`gh --body x pr comment 1`, `gh pr --body x comment 1`, `gh pr -b x comment 1`, `gh pr --body-file f review 1 --approve`, `bkt pr --text x comment 1`);
  - a redirection the shared lexer splits into separate parts (`gh 2>&1 pr merge 1`, `gh >&2 pr merge 1`, `gh &>/dev/null pr merge 1`, `gh >| out pr merge 1`, `bkt 2>&1 pr approve 1`, `gh < <(true) pr merge 1`);
  - a PowerShell array or script block in the verb position (`gh pr @('merge') 1`, `gh pr {merge} 1`), and a PowerShell comment that hides an opening parenthesis;
  - the quoting forms `$"gh"` and `$'g\x68'`, brace expansion, a glob in the program word, `(( x = 1 << 2 ))` read as a heredoc, and `sudo --user` with a separate value (the shared-parser forms `doc-cli-guard` lists);
  - the PowerShell forms listed for `doc-cli-guard` (typographic quotes, block comments, the dot-source operator, typed, scoped, and compound assignments), and a redirection before the program;
  - a REST request through `curl`, another HTTP client, or an MCP tool.
- **AND** the text SHALL list no `bkt api` gap, because an unrecognized `bkt api` option asks

#### Scenario: Health description lists the hook

- **GIVEN** the frontmatter `description` of `skills/health/SKILL.md` (`:3-6`), which names "guard" self-tests in general
- **WHEN** a reviewer reads it
- **THEN** it SHALL need no change, because `pr-post-ask` is a guard and its self-test is a guard self-test

### Requirement: System message read as the finding

The `/health` skill SHALL treat a `{"systemMessage": ...}` printed in place of a report as the finding and apply the matching fix row.

**Requirement refs:** FR-166, UR-018 | **Status:** Built | **Source:** `skills/health/SKILL.md:32`, `:40-41`, `:69`

#### Scenario: Unsupported Node

- **GIVEN** the script prints a `systemMessage` naming `unsupported-node`
- **WHEN** the skill reads it
- **THEN** the skill SHALL report that guards pass every command unchecked and give the fix: install or upgrade Node to the minimum shown, then run `/assist-plugin:health` again

#### Scenario: Node missing

- **GIVEN** the command fails with `node: command not found`
- **WHEN** the skill reads the output
- **THEN** the skill SHALL report that guards cannot run and point at the Node row in `README.md`

#### Scenario: Data directory unset

- **GIVEN** `CLAUDE_PLUGIN_DATA` is not set
- **WHEN** the skill reads the output
- **THEN** the skill SHALL report that failures cannot be logged and guards cannot be auto-disabled, and tell the user to run through Claude Code with the plugin installed

## Algorithmic steps

1. Read whether the user passed `--clear`.
2. Run the matching command form.
3. If the output is a `systemMessage`, treat it as the finding and go to step 5.
4. Read the report sections: Node version, self-test results, disabled guards, health-log entries, `fsa-log` problem rows and count since the last report, attribution settings.
5. Report the overall status; when healthy, stop at one line; otherwise list one entry per finding with its fix row.

```mermaid
flowchart TD
  S(["/health, optional --clear"]) --> C{"User passed --clear?"}
  C -->|"no"| R1["node health-check.js --data-dir plugin data dir"]
  C -->|"yes"| R2["Same command with --clear"]
  R1 --> O{"Output is a systemMessage?"}
  R2 --> O
  O -->|"yes"| F["Treat the message as the finding; apply the matching fix row"]
  O -->|"no"| P["Read the report: Node, self-tests, disabled guards, logs, attribution settings"]
  P --> H{"Healthy?"}
  H -->|"yes"| One(["One-line healthy result"])
  H -->|"no"| Fx(["Status line, then one entry per finding with its fix"])
  F --> Fx
```

Render source: `specs/spec-skills-health.mmd`. Rendering skipped: see the note in `spec-skills.md`.

## Output / Outcome

| Output | Type | Description |
|---|---|---|
| Health summary | Chat | One line when healthy; otherwise status plus one entry per finding with its fix |
| Truncated `hook-health.jsonl` | State change | Only with `--clear`, done by the script after it shows the log |

## Error handling

| Error condition | Handling strategy | Outcome |
|---|---|---|
| Script prints a `systemMessage` | Treat it as the finding | Matching fix row |
| `node` missing | Report the Node row fix | User installs Node |
| `CLAUDE_PLUGIN_DATA` unset | Report the fix row | User runs through Claude Code with the plugin installed |
| Guard self-test denied a known-safe case | Report the disabled guard and the bug-report fix | Guard stays disabled until a passing self-test |
| Guard self-test allowed a known-prohibited case | Report weak protection | Guard stays enabled |
| `pr-post-ask` self-test asked on a known-safe case | Report that the hook was auto-disabled and that PR posting commands run with no prompt from it; give the bug-report fix | Hook stays disabled until a passing self-test; the calling flow's own confirmation still applies |
| `pr-post-ask` self-test missed a posting command | Report weak protection and the bug-report fix | Hook stays enabled |
| `writing-context` self-test failed | Report that the hook stays enabled and sessions may start without the standard; give the restore fix | Hook never listed under disabled guards |
| Attribution setting unset or not `""` | Name the file and key; show the setting | No settings file edited |
| Health-log kinds (`exception`, `timeout`, `missing-standard`, `standard-truncated`, `log-write-error`, and others) | Report each with its fix row (`skills/health/SKILL.md:61-68`) | The user acts on the fix |

## Events emitted (if applicable)

Not applicable: the skill reports in chat and emits no events.

## Dependencies

| Dependency | Type | Required | Notes |
|---|---|---|---|
| `hooks/health-check.js` | Runtime | yes | Area B FR-091, FR-118 to FR-120 |
| Node.js 6 or newer | External | yes | Without it the script cannot run (`README.md:157`, read on 2026-10-22) |
| `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` | Runtime | yes | Set by Claude Code (FR-NFR section 7) |
| Health and FSA logs | Runtime | no | Area B FR-090 and FR-115 fix their content and line caps |
| Tool grants | Runtime | yes | The two exact Bash forms and Read (`skills/health/SKILL.md:8-11`) |

## Sub-feature breakdown (if applicable)

Not applicable: this spec has no sub-features.

## Submodule scope (if applicable)

Not applicable: the repository has no submodules.

## Traceability

| Requirement | Spec section | Verified by |
|---|---|---|
| FR-166 | Requirement: Run the health check with the user's flag; Requirement: Short summary with a fix per finding; Requirement: System message read as the finding | Manual `/health` and `/health --clear` runs with a healthy state, a disabled guard, an unset attribution key, and Node below 6; command log shows only the two allowed forms |
| UR-018 | All requirements | As above |
| BR-007 | Requirement: Short summary with a fix per finding | As above |
| FR-166, FR-118 | Requirement: Short summary with a fix per finding (`writing-context` row; Scenarios Failed writing-context self-test, Passing writing-context self-test, Overview describes the writing-context self-test) | `/health` run with `rules/writing-standard-compact.md` made unreadable: the summary names the failed `writing-context` self-test, says the hook stays enabled, gives the restore fix, and `hooks-disabled.json` holds no `writing-context` entry; read of the findings table for the row |
| FR-206, FR-166, UR-055 | Requirement: Short summary with a fix per finding (`pr-post-ask` rows and overview; Scenarios Ask hook disabled by a false ask, Ask hook misses a posting command, Overview lists the hook and its gaps, Health description lists the hook) | Read of `skills/health/SKILL.md:17` against spec-hooks-pr-post-ask.md, Requirement 9 (`tests/skills/contracts-bump-health-followup.test.js`); read of the two findings rows |

## Change Log: 2026-10-16

Folded into the main body on 2026-10-22, through the Change Log 2026-10-22, whose MODIFIED Requirement quotes this entry's Now text as its Was.

**Source:** `docs/requirements/FR-NFR-assist-plugin.md` version 1.1 (2026-10-16, final and approved, read for fix pass 1; line cites checked against the current file on 2026-10-17): FR-118 (`:2478-2507`, Area B) adds the `writing-context` self-test, PLANNED (1.12.0), and its scenario "Failed writing-context self-test" (`:2489-2492`) has the health check report the failure and never add `writing-context` to `hooks-disabled.json`; FR-166 (Area C) holds what `/health` tells the user. Decisions: `DECISIONS.md:168-171` ("A failed writing-context self-test is reported and never disables writing-context"); the answers to OP-B5a and OP-B5b under User Decisions in `.agent/main-plan/plan-deferred-decisions-20261016-1059.md`.

Every change in this entry is PLANNED (1.12.0). This spec received a delta in fix pass 1, so its Status moves to `Review` (FR-154).

### MODIFIED Requirements

#### Requirement: Short summary with a fix per finding

**Was:** The `/health` skill SHALL summarize the status in a few lines and give each finding its fix from the findings table. At 1.11.1 `writing-context` has no self-test (`skills/health/SKILL.md:17`), and the findings table (`:36-66`) has no row for one.
**Now:** The statement is unchanged, and the findings table gains a row for a failed `writing-context` self-test: the hook stays enabled, sessions and subagents may start without the writing standard, and the fix is to restore `rules/writing-standard-compact.md` by reinstalling or updating the plugin and to report the bug when the plugin files are unmodified.
**Reason:** FR-118 adds the self-test, and `DECISIONS.md:168-171` makes its failure report-only.
**Requirement refs:** FR-166, FR-118, UR-018, BR-007 | **Status:** PLANNED (1.12.0) | **Source:** `docs/requirements/FR-NFR-assist-plugin.md:2480`, `:2489-2492`; `skills/health/SKILL.md:17`, `:36-66`

##### Scenario: Failed writing-context self-test

- **GIVEN** the report shows the `writing-context` self-test failed because `rules/writing-standard-compact.md` is unreadable
- **WHEN** the skill summarizes
- **THEN** the entry SHALL say `writing-context` stays enabled and sessions may start without the writing standard, and SHALL give the fix: restore the file by reinstalling or updating the plugin, then run `/assist-plugin:health` again
- **AND** the entry SHALL NOT list `writing-context` under disabled guards, and no settings or `hooks-disabled.json` file SHALL change because of the skill

##### Scenario: Passing writing-context self-test

- **GIVEN** every self-test, the `writing-context` one included, passes and no guard is disabled
- **WHEN** the user runs `/health`
- **THEN** the skill SHALL report the healthy result in one line and SHALL NOT mention `writing-context`

##### Scenario: Overview no longer says there is no self-test

- **GIVEN** `skills/health/SKILL.md` after the change
- **WHEN** a test reads the overview (`:17` at 1.11.1)
- **THEN** it SHALL say `writing-context` has a self-test whose failure is reported and never disables the hook, and SHALL NOT say the hook has no self-test

### ADDED Requirements

None.

### REMOVED Requirements

None.

### Planned conformance (files that change with this entry)

| File and line at 1.11.1 | Change | Requirement |
|---|---|---|
| `skills/health/SKILL.md:17` | The `writing-context` sentence "it has no self-test, so its failures show only in the log" becomes a self-test whose failure is reported and never disables the hook | FR-118, FR-166 |
| `skills/health/SKILL.md:36-66` | The findings table gains a row: `writing-context` self-test FAIL, meaning (the hook stays enabled; sessions may start without the standard), fix (restore `rules/writing-standard-compact.md` by reinstalling or updating the plugin; report the bug if the plugin files are unmodified) | FR-166 |

The self-test itself and the notice text live in `hooks/impl/health-check.js` (Area B, FR-118); this spec covers only what `/health` tells the user.

### Direct edits in this pass (no behavior change)

Status set to `Review`; Requirement refs gain FR-118; the baseline note and the Description sentence on the 1.12.0 script changes point here. On 2026-10-17 the FR-118 cites were checked against the current file, in which FR-094 gained scenarios: `:2468-2497` to `:2478-2507`, `:2470` to `:2480`, `:2479-2482` to `:2489-2492`.

## Change Log: 2026-10-22

Folded into the main body on 2026-10-22.

**Source:** `docs/requirements/FR-NFR-assist-plugin.md` version 1.3 (2026-10-17, DRAFT): FR-206 (`:4655-4734`; scenario Known gaps `:4731-4734`: "the requirements and the health documentation SHALL list that form as a known gap"; scenarios `:4701-4709` on a false ask and a missed ask) and the FR-118 clause at `:2489`; `DECISIONS.md:223-226` and `:238-241` (the ask on an unrecognized `bkt api` option, which leaves no `bkt api` gap to list). The hook is specified in spec-hooks-pr-post-ask.md and its self-test in spec-hooks-health-check.md (Change Logs 2026-10-22); this entry covers only what `/health` tells the user. Every change in this entry is PLANNED (follow-up to 1.12.0). This spec received a delta, so its Status returns to `Review` (FR-154).

Read on 2026-10-22: at 1.12.0 (commit `bb09e29`) the overview of `skills/health/SKILL.md:17` names the guards `sa-mermaid-only`, `doc-cli-guard`, `commit-attribution-guard`, `prose-gate`, and `fsa-write-bar`, and the findings table runs `:36-67`; neither names an ask hook.

### Direct edits in this pass (no behavior change)

- Status: Approved -> Review. Requirement refs: UR-055 and FR-206 added.

### ADDED Requirements

None.

### MODIFIED Requirements

#### Requirement: Short summary with a fix per finding

**Was:** (Change Log 2026-10-16) The statement is unchanged, and the findings table gains a row for a failed `writing-context` self-test: the hook stays enabled, sessions and subagents may start without the writing standard, and the fix is to restore `rules/writing-standard-compact.md` by reinstalling or updating the plugin and to report the bug when the plugin files are unmodified.

**Now:** The statement is unchanged. The findings table also gains two rows for `pr-post-ask`: a self-test FAIL with "known-safe command was ASKED" means the hook was auto-disabled, so PR posting commands run with no prompt from it and only the calling flow's own confirmation applies, and the fix is to report the bug with the report output and run `/assist-plugin:health` again after a plugin update; a self-test FAIL with "known posting command was NOT ASKED" means the hook stays enabled with weak protection, and the fix is to report the bug with the report output. The skill's overview names `pr-post-ask` among the PreToolUse guards, says it asks before `gh pr review`, `merge`, `comment`, and `close`, `bkt pr approve`, `comment`, `decline`, `close`, and `merge`, and a `bkt api` call that may write (an option it does not recognize counts as a possible write), in every session, and lists its known gaps as spec-hooks-pr-post-ask.md (Requirement 9) states them.

**Reason:** FR-206 makes the hook a guard under FR-091 and FR-118 and requires the health documentation to list its known gaps.

**Requirement refs:** FR-166, FR-118, FR-206, UR-018, UR-055 | **Status:** PLANNED (follow-up to 1.12.0) | **Source:** `docs/requirements/FR-NFR-assist-plugin.md:4701-4709`, `:4731-4734`; `skills/health/SKILL.md:17`, `:36-67`

##### Scenario: Ask hook disabled by a false ask

- **GIVEN** the report lists `pr-post-ask` under disabled guards after "known-safe command was ASKED"
- **WHEN** the skill summarizes
- **THEN** the entry SHALL say that PR posting commands run with no prompt from the hook and that only the calling flow's own confirmation applies, and SHALL give the fix: report the bug with the report output, then run `/assist-plugin:health` again after a plugin update

##### Scenario: Ask hook misses a posting command

- **GIVEN** the report shows "known posting command was NOT ASKED" for `pr-post-ask`
- **WHEN** the skill summarizes
- **THEN** the entry SHALL say the hook stays enabled with weak protection and give the fix: report the bug with the report output

##### Scenario: Overview lists the hook and its gaps

- **GIVEN** `skills/health/SKILL.md` after the change
- **WHEN** a test reads the overview (`:17` at 1.12.0)
- **THEN** it SHALL name `pr-post-ask` among the guards, name the commands it asks before, say it covers every session, and list its known gaps exactly as spec-hooks-pr-post-ask.md, Requirement 9, lists them, and no other:
  - a program word taken from a variable or an expression;
  - `gh api`, `gh pr edit`, `gh pr ready`, `gh pr reopen`, a `gh` alias or extension that expands to a posting command, and `bkt pr` subcommands other than `approve`, `comment`, `decline`, `close`, and `merge`;
  - a command string run by another program (`bash -c`, `sh -c`, `pwsh -Command`, `cmd /c`, `eval`, `Invoke-Expression`, `xargs`, `find -exec`, and the other forms Requirement 9 names);
  - a posting command inside a command substitution of another program;
  - a Bash program name in another case, and `.cmd`, `.bat`, or `.ps1` shims;
  - an option with a separate value ahead of the verb that the hook does not list: for `gh`, before `pr` or between `pr` and the verb (`gh --body x pr comment 1`, `gh pr --body x comment 1`, `gh pr -b x comment 1`, `gh pr --body-file f review 1 --approve`); for `bkt`, between `pr` and the verb (`bkt pr --text x comment 1`);
  - the PowerShell forms already listed for `doc-cli-guard`, and leading redirections;
  - a request to the GitHub or Bitbucket REST API through `curl`, another HTTP client, or an MCP tool.
- **AND** the text SHALL list no `bkt api` gap, because an unrecognized `bkt api` option asks

##### Scenario: Health description lists the hook

- **GIVEN** the frontmatter `description` of `skills/health/SKILL.md` (`:3-6`), which names "guard" self-tests in general
- **WHEN** a reviewer reads it after the change
- **THEN** it SHALL need no change, because `pr-post-ask` is a guard and its self-test is a guard self-test

### REMOVED Requirements

None.

### Planned conformance (files that change with this entry)

| File and line at 1.12.0 | Change | Requirement |
|---|---|---|
| `skills/health/SKILL.md:17` | The overview names `pr-post-ask`, what it asks before, that it covers every session and fails open, and its known gaps | FR-206, FR-166 |
| `skills/health/SKILL.md:36-67` | Two findings rows for `pr-post-ask` (ASKED and NOT ASKED) | FR-206, FR-166 |

`skills/health/SKILL.md` is on the LLM surface (`skills/**`), so the change carries `✓ LLM Security Clear` (NFR-011).

## Change Log: 2026-10-22 (fold)

**Source:** `DECISIONS.md:243-246` (the spec bodies are folded after qa in the same run), `:248-251` (the 2026-10-22 deltas signed off; the known-gap text also lists bypassPermissions mode, plan mode, and installed mods as unverified), `:253-256` (the gaps found in review join every gap list, `/health` included), and `:258-261` (`pr-post-ask` is best-effort; the remaining forms are listed as gaps, and a form found later joins every list); the build of `docs/task-plans/task-plan-post-1-12-0-followups-20261022-143806.md`, qa passed on 2026-10-22 (`.agent/main-plan/plan-build-post-1-12-0-followups-20261022-1612.md:95`). `skills/health/SKILL.md` was read on 2026-10-22.

Folded into the main body:

- Requirement: Short summary with a fix per finding, from the Change Log 2026-10-22 Now (which quotes the 2026-10-16 Now): the findings rows for `writing-context` and `pr-post-ask`, the overview text, and the Scenarios of both entries. "Overview no longer says there is no self-test" is renamed "Overview describes the writing-context self-test"; its check is unchanged.
- Build-time decisions: the Scenario "Overview lists the hook and its gaps" lists the 11 known gaps of spec-hooks-pr-post-ask.md, Requirement 9 (the header comment of `hooks/impl/pr-post-ask.js:23-39`), in place of the eight items of the Change Log 2026-10-22; it also checks the best-effort wording (`DECISIONS.md:258-261`). The overview paragraph records the permission behavior the step 1 research found (`DECISIONS.md:248-251`).
- Description, Triggered by, Required data, Error handling, and Traceability name the built rows and refreshed line cites (the findings table now runs `:36-69`).

Status: Review -> Draft, by the fold rule of `spec-from-requirements` (`references/delta-format.md`, Folding a delta into the main body, step 5); a `review` pass follows. Every pending change log entry of this spec is now folded.

### Rework 2: line cite refreshed (no behavior change)

The Node row the Dependencies table cites is `README.md:157`, re-read on 2026-10-22. The `/health` overview stays one of the five places that keep the full `pr-post-ask` gap list (`DECISIONS.md:268-271`); every cite into `skills/health/SKILL.md` was re-read and holds.

## Change Log: 2026-10-23

**Source:** `docs/requirements/FR-NFR-assist-plugin.md` version 1.5 (2026-10-23, DRAFT), release 1.13.1, "voice scripts without em dashes": FR-104 (`:2245-2274`; Status `:2248`), FR-213 (`:3854-3883`; statement `:3856`), FR-181 retired (`:2756`), FR-118 (1.13.1 scenarios `:2525-2533`), and the section 9 build list (`:5581`, which names `skills/health/SKILL.md:17`); `DECISIONS.md:273-276` (2026-10-23), which supersedes `DECISIONS.md:3-6` and `:73-75`. Every change in this entry is PLANNED (1.13.1). This spec received a delta, so its Status returns to `Review` (FR-154).

Read on 2026-10-23 at the 1.13.0 release (commit `50817b5`): `skills/health/SKILL.md:17` says that both prose hooks skip files under the system temp directory, files under `docs/tts/` in the project root and in the session's working directory when that directory is inside the project ("voice scripts may use em dashes as pause marks"), and paths listed in `prose-gate-allowlist.json`.

### Direct edits in this pass (no behavior change)

- Status: Draft -> Review.
- Requirement refs: FR-104 and FR-213 added (the overview states their rule).

### Body text this entry supersedes (applied at the next fold)

- Description, the paragraph "Resolved source difference (OP-2, built in 1.11.1)": since 1.13.1 the overview says the prose hooks skip only temp-directory and allowlisted paths, and in a separate sentence that files under `docs/tts/` are judged like other prose, with fenced blocks exempt, as FR-104 and FR-213 state; FR-181 is retired.
- Traceability: the row under Traceability added, below.

### ADDED Requirements

None.

### MODIFIED Requirements

#### Requirement: Short summary with a fix per finding

**Was:** The statement as in the body. The overview (`skills/health/SKILL.md:17`) also says that both prose hooks skip files under the system temp directory, files under `docs/tts/` in the project root and in the session's working directory when that directory is inside the project (voice scripts may use em dashes as pause marks), and paths listed in `${CLAUDE_PLUGIN_DATA}/prose-gate-allowlist.json`.

**Now:** The statement is unchanged. The overview's prose-hook text becomes two sentences. The first says that both prose hooks skip files under the system temp directory and paths listed in `${CLAUDE_PLUGIN_DATA}/prose-gate-allowlist.json`, and holds no `docs/tts/`. The second, standing alone, is the required sentence of spec-skills.md (Change Log 2026-10-23, Requirement: Documents describe voice scripts as gated prose): "Files under `docs/tts/` are judged like other prose, with fenced blocks exempt." The parenthetical "voice scripts may use em dashes as pause marks" goes, and no sentence of the file meets F1 to F4 of that requirement. The rest of the overview, the findings table, and the fix rows are unchanged.

**Reason:** FR-104 drops its `docs/tts/` clause, FR-213 gates `docs/tts/` like any prose file, and the FR-NFR build list names `skills/health/SKILL.md:17` (`docs/requirements/FR-NFR-assist-plugin.md:5581`).

**Requirement refs:** FR-166, FR-104, FR-213, UR-018 | **Status:** PLANNED (1.13.1) for the overview sentence | **Source:** `docs/requirements/FR-NFR-assist-plugin.md:2247-2248`, `:3856`, `:5581`; `skills/health/SKILL.md:17`

##### Scenario: Overview names no docs/tts skip

- **GIVEN** `skills/health/SKILL.md` after the 1.13.1 change
- **WHEN** a test reads the overview (`:17`)
- **THEN** it SHALL hold a sentence that names the temp-directory and allowlist exemptions of the prose hooks and holds no `docs/tts/`
- **AND** it SHALL hold, as its own sentence, one that contains `docs/tts/`, "like other prose", and "fenced", and no sentence that meets F1 to F4 of spec-skills.md (Change Log 2026-10-23, Requirement: Documents describe voice scripts as gated prose)

##### Scenario: Prose-gate disabled after an upgrade

- **GIVEN** the report lists `prose-gate` under disabled guards after the line `    known-safe write was DENIED: <label>` for a `docs/tts/` case (nouns at `hooks/impl/health-check.js:1094`)
- **WHEN** the skill summarizes
- **THEN** the entry SHALL use the existing disabled-guard fix row: the guard passes writes unchecked, report the bug with the report output, and run `/assist-plugin:health` again after a plugin update

The other scenarios of this requirement are unchanged.

### REMOVED Requirements

None.

### Planned conformance (files that change with this entry)

| File and line (1.13.0, read 2026-10-23) | Change | Requirement |
|---|---|---|
| `skills/health/SKILL.md:17` | The prose-hook sentence splits in two: the temp-directory and allowlist sentence, with no `docs/tts/`, and the separate required sentence "Files under `docs/tts/` are judged like other prose, with fenced blocks exempt."; the parenthetical "voice scripts may use em dashes as pause marks" goes | FR-104, FR-213, FR-166 |

The self-test case changes behind the report belong to spec-hooks-health-check.md (Change Log 2026-10-23). `skills/health/SKILL.md` is on the LLM surface (`skills/**`), so the change carries `✓ LLM Security Clear` (NFR-011).

### Traceability added

| Requirement | Spec section | Verified by |
|---|---|---|
| FR-213, FR-104, FR-166 | Change Log 2026-10-23: Requirement: Short summary with a fix per finding (Scenario: Overview names no docs/tts skip) | Read of `skills/health/SKILL.md:17` after the build; `tests/docs/self-hosted-layout.test.js` per spec-skills.md, Change Log 2026-10-23, Scenario: Hook descriptions name no docs/tts skip |

### Fix pass 1 (2026-10-23)

Review findings applied: Requirement refs gain FR-104; the overview's end state is also checked by the self-hosted layout test that spec-skills.md (Change Log 2026-10-23) specifies.

### Fix pass 2 (2026-10-23)

Review findings applied: the overview's `docs/tts/` sentence uses "like other prose" and stands apart from the temp-directory and allowlist sentence, and the scenario and conformance row check it against the mechanical rules of spec-skills.md (Change Log 2026-10-23).
