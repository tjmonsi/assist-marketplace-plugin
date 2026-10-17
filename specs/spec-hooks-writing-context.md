# spec-hooks-writing-context

## Metadata

| Field | Value |
|---|---|
| **Feature** | Writing context: inject the compact writing standard at session and subagent start |
| **Parent feature** | spec-hooks-platform.md |
| **Sub-features** | None |
| **Requirement refs** | BR-003, BR-008, UR-024, FR-107, FR-118, NFR-001, NFR-002, NFR-009 |
| **Feature type** | Functionality |
| **Status** | Approved |

Status values: Draft, Review, Approved, Implemented.

## Description

`writing-context` adds the compact writing standard (`rules/writing-standard-compact.md`) under a one-sentence header to the context of the main session and of every subagent, so all prose follows the standard without the user loading it (UR-024). It reads the file at run time, so an edit to the file changes the next session. It never blocks, has no self-test at 1.11.1, and reports its own problems only in the health log. This spec describes the behavior at commit 4803a0d, which assist-plugin 1.11.1 (commit 41034c1) keeps at every cited line (read 2026-10-16). The change log at the end records the 1.12.0 (PLANNED) report-only self-test (FR-118).

## Triggered by

| Trigger type | Source | Condition |
|---|---|---|
| Event | SessionStart, matcher `startup\|resume\|clear\|compact` (`hooks/hooks.json:124-133`) | Session start, resume, `/clear`, and compaction |
| Event | SubagentStart, matcher `.*` (`hooks/hooks.json:135-146`) | Every subagent start, including a restart after the subagent compacts |

## Required data

| Data | Source | Type | Notes |
|---|---|---|---|
| `hook_event_name` | Hook input | string | `SessionStart` or `SubagentStart`; any other value emits nothing |
| `rules/writing-standard-compact.md` | `${CLAUDE_PLUGIN_ROOT}`, else the directory two levels above `impl/writing-context.js` | UTF-8 text | Read on every call |

## Preconditions

| Condition | Check | If not met |
|---|---|---|
| Event is SessionStart or SubagentStart | `EVENTS` (`impl/writing-context.js:19`, `:43`) | Emit nothing |
| Platform preconditions | spec-hooks-platform.md | Fail open |

## Algorithmic steps

Start-to-end flow. Source: [spec-hooks-writing-context-flow.mmd](spec-hooks-writing-context-flow.mmd).

```mermaid
flowchart TD
  S(["SessionStart startup, resume, clear, compact; or SubagentStart"]) --> A["Read rules/writing-standard-compact.md under the plugin root"]
  A --> B{"Readable?"}
  B -->|no| L1["Health log: missing-standard; emit nothing"]
  B -->|yes| C{"Empty after trimming trailing whitespace?"}
  C -->|yes| L2["Health log: empty-standard; emit nothing"]
  C -->|no| D["Context = header line, newline, body"]
  D --> E{"Longer than 10,000 characters?"}
  E -->|yes| F["Cut at the last line break before 10,000; health log: standard-truncated"]
  E -->|no| G["Emit additionalContext under the event's name"]
  F --> G
```

**Note:** PNG rendering requires mermaid-cli with its headless browser, which is missing on this machine (see spec-hooks-platform.md). Render with `mmdc -i specs/spec-hooks-writing-context-flow.mmd -o specs/spec-hooks-writing-context-flow.png` once it is installed.

### Requirement: Injected context

The `writing-context` hook SHOULD, on SessionStart and SubagentStart, emit `{"hookSpecificOutput": {"hookEventName": <event>, "additionalContext": <header> + "\n" + <body>}}`, where `<body>` is the compact file with trailing whitespace removed.

**Requirement refs:** FR-107, UR-024, BR-008
**Status:** Built
**Source:** `hooks/impl/writing-context.js:14-23`, `:41-62`

The header is the fixed text: "assist-plugin writing standard for prose you write (reports, docs, replies, comments). It does not apply to code, data, or quoted text; project and user instructions take precedence:"

#### Scenario: Session start

- **GIVEN** a new session and a readable compact file
- **WHEN** SessionStart fires with source `startup`
- **THEN** the hook SHALL emit the header and the compact standard as `additionalContext` under `hookEventName` `SessionStart`

#### Scenario: Subagent start

- **GIVEN** `/do` dispatches a subagent
- **WHEN** SubagentStart fires
- **THEN** the hook SHALL emit the same context under `hookEventName` `SubagentStart`

#### Scenario: Other event

- **GIVEN** a hook input with `hook_event_name` `PostToolUse`
- **WHEN** the module evaluates it
- **THEN** the module SHALL emit nothing

### Requirement: Missing or empty standard

The `writing-context` hook SHALL emit nothing and append a health-log record of kind `missing-standard` when the compact file cannot be read, or `empty-standard` when it is empty after trimming.

**Requirement refs:** FR-107, NFR-009
**Status:** Built
**Source:** `hooks/impl/writing-context.js:44-52`; `hooks/lib/health.js:508-510`

Log messages: `rules/writing-standard-compact.md could not be read; no writing context added` and `rules/writing-standard-compact.md is empty; no writing context added`.

#### Scenario: Missing file

- **GIVEN** `rules/writing-standard-compact.md` is missing
- **WHEN** the hook runs
- **THEN** the hook SHALL emit nothing and write a `missing-standard` record to `hook-health.jsonl`

#### Scenario: Empty file

- **GIVEN** the compact file holds only blank lines
- **WHEN** the hook runs
- **THEN** the hook SHALL emit nothing and write an `empty-standard` record

### Requirement: Context size cap

The `writing-context` hook SHALL inject at most 10,000 characters, cutting the context at its last line break at or before character 10,000 (or at 10,000 when there is none) and appending a health-log record of kind `standard-truncated`.

**Requirement refs:** NFR-001, BR-003
**Status:** Built
**Source:** `hooks/impl/writing-context.js:18`, `:33-38`, `:53-61`

#### Scenario: Context cap

- **GIVEN** a compact file that grows past 10,000 characters with its header
- **WHEN** `writing-context` runs
- **THEN** the hook SHALL emit only whole lines totalling at most 10,000 characters
- **AND** `hook-health.jsonl` SHALL gain a `standard-truncated` record

#### Scenario: Under the cap

- **GIVEN** the compact file at commit 4803a0d (12 bullet lines)
- **WHEN** the hook runs
- **THEN** the hook SHALL emit the whole file and log nothing

### Requirement: Compact standard size

The compact writing standard SHOULD stay at or under 1,195 characters, counted as the character count of `rules/writing-standard-compact.md` (`wc -m`).

**Requirement refs:** NFR-002, BR-003
**Status:** Built (the count was not measured for this spec; a hand count of the 12 bullets at commit 4803a0d gives about 1,140 characters, an estimate)
**Source:** `README.md:291`; `CLAUDE.md` (writing-context bullet); `scripts/sync-writing-standard.js:27` (hard limit 1,400)

The sync script enforces a separate hard limit of 1,400 characters (spec-hooks-writing-standard-sync.md); this requirement is the documented target below it.

#### Scenario: Within the target

- **GIVEN** the compact file
- **WHEN** a maintainer runs `wc -m plugins/assist-plugin/rules/writing-standard-compact.md`
- **THEN** the count SHALL be at most 1,195

#### Scenario: Over the target

- **GIVEN** a change that grows the compact file to 1,300 characters
- **WHEN** the change is reviewed
- **THEN** the reviewer SHALL flag NFR-002, although the sync script still accepts the file

## Business rules

| Rule ID | Rule | Traces to | Applied at step | Example |
|---|---|---|---|---|
| RULE-001 | The file is read at run time, never cached | FR-107 | Requirement: Injected context | An edit reaches the next session |
| RULE-002 | The hook never blocks and has no self-test at 1.11.1; its problems show only in the health log. PLANNED (1.12.0): see the Change Log 2026-10-16 | FR-107, FR-118 | Requirement: Missing or empty standard | `missing-standard` |

## Data transformations

| Input | Transformation | Output | Notes |
|---|---|---|---|
| Compact file text | Trim trailing whitespace, prefix header and newline, cut to 10,000 characters at a line break | `additionalContext` string | Whole lines only |

## Output / Outcome

| Output | Type | Description |
|---|---|---|
| `additionalContext` | SessionStart or SubagentStart JSON | Header plus standard |
| Health-log record | `hook-health.jsonl` line | `missing-standard`, `empty-standard`, or `standard-truncated` |

## Error handling

| Error condition | Handling strategy | Outcome |
|---|---|---|
| File missing or unreadable | Log `missing-standard` | No context; the session starts normally |
| File empty | Log `empty-standard` | No context |
| File too long | Cut and log `standard-truncated` | Partial context |
| Thrown error, malformed input, timeout, old Node | Platform failure path, suffix `the writing standard was not loaded` | Warning; the session starts without the context |

## Events emitted

| Event name | Payload | Consumer(s) | When emitted |
|---|---|---|---|
| SessionStart or SubagentStart context | `additionalContext` | The model in the main session or the subagent | Every matching event with a readable, non-empty file |

## Events consumed

| Event name | Producer | Payload used | Handling |
|---|---|---|---|
| SessionStart, SubagentStart | Claude Code | `hook_event_name` | Requirement: Injected context |

## Sub-feature breakdown

Not applicable: a leaf feature of spec-hooks-platform.md.

## Performance considerations

| Concern | Target | Approach |
|---|---|---|
| Context cost | At most 10,000 characters per start (NFR-001); file at most 1,195 characters (NFR-002) | Compact bullets only; hard cut at 10,000 |
| Latency | Within the 5 s registration (NFR-007) | One small file read |

## Traceability

| Requirement | Spec section | Verified by |
|---|---|---|
| BR-003 | Requirement: Context size cap; Requirement: Compact standard size | Cap test; `wc -m` |
| BR-008 | Requirement: Injected context | Session start scenario |
| UR-024 | Requirement: Injected context | SessionStart and SubagentStart runs |
| FR-107 | Requirement: Injected context; Requirement: Missing or empty standard | Session start, subagent start, missing file scenarios |
| NFR-001 | Requirement: Context size cap | Oversized file test |
| NFR-002 | Requirement: Compact standard size | `wc -m` on the compact file |
| NFR-009 | Requirement: Missing or empty standard; Error handling | Platform failure-path tests |

## Change Log: 2026-10-16

**Source:** `docs/requirements/FR-NFR-assist-plugin.md` v1.1 (2026-10-16, final and approved; baseline assist-plugin 1.11.1, commit 41034c1): FR-118 (`:2478-2507`, scenarios `:2484-2492`) and FR-091 (scenario `:1907-1910`); `DECISIONS.md:168-171` (a failed writing-context self-test is reported and never disables writing-context); the answer to OP-B5a in `.agent/main-plan/plan-deferred-decisions-20261016-1059.md` (User Decisions).

### Body edits without a behavior change

- Status: Draft -> Review. Requirement refs: FR-118 added.
- Description and RULE-002: "no self-test" is stated for 1.11.1, with a pointer to this change log.

### ADDED Requirements

#### Requirement: Self-test coverage

The health check SHALL self-test `writing-context` at session start and in report mode by calling this hook's `evaluate(input, options)` with fixed SessionStart, SubagentStart, and other-event inputs and stub readers, plus one case that reads the installed `rules/writing-standard-compact.md`, and SHALL report a failure without adding `writing-context` to `hooks-disabled.json`.

**Requirement refs:** FR-118, FR-091, FR-107
**Status:** PLANNED (1.12.0)
**Source:** `hooks/impl/writing-context.js:40-45` (`evaluate` already takes `{env, readFile}`, so this hook's code does not change); the case list and the report-only rule are in spec-hooks-health-check.md (Change Log 2026-10-16, Requirement: Self-tests)

##### Scenario: Installed standard readable

- **GIVEN** `rules/writing-standard-compact.md` is present and readable
- **WHEN** the session-start self-test runs `writing-context` against a fixed SessionStart input
- **THEN** the hook SHALL return the header and the compact standard, and the health check SHALL pass the case

##### Scenario: Installed standard missing

- **GIVEN** `rules/writing-standard-compact.md` is missing
- **WHEN** the session starts
- **THEN** the health check SHALL print a notice naming `writing-context`
- **AND** the health check SHALL NOT add `writing-context` to `hooks-disabled.json`, so the hook keeps running and keeps logging `missing-standard` at every start

### MODIFIED Requirements

#### Business rule: RULE-002

**Was:** The hook never blocks and has no self-test; its problems show only in the health log.

**Now:** The hook never blocks. The health check self-tests it, report only: a failed self-test appears in the session notice and the report and never disables the hook. Its run-time problems still show in the health log.

**Reason:** FR-118 (answer to OP-B5a, option (b)) and `DECISIONS.md:168-171`.

**Status:** PLANNED (1.12.0)

### REMOVED Requirements

None.

### Traceability added

| Requirement | Spec section | Verified by |
|---|---|---|
| FR-118 | Change Log 2026-10-16: Requirement: Self-test coverage | Installed-standard readable and missing scenarios |
