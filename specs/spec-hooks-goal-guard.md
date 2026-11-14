# spec-hooks-goal-guard

## Metadata

| Field | Value |
|---|---|
| **Feature** | Goal-hijack guardrail: a rule-based, advisory-first alignment check on tool results |
| **Parent feature** | spec-hooks-platform.md |
| **Sub-features** | None |
| **Requirement refs** | BR-018, UR-062, FR-219, FR-238, NFR-026, NFR-027, NFR-028 (blocking mode, per `DECISIONS.md` 2026-11-13), NFR-031, NFR-034, NFR-035 |
| **Feature type** | Functionality |
| **Status** | Review |

Status values: Draft, Review, Approved, Implemented.

Paths that start with `hooks/` are relative to `plugins/assist-plugin/`. This spec describes planned behavior for harness-governance Tranche 2 (task plan `docs/task-plans/task-plan-harness-governance-20261028-0759.md`, Step 19); nothing here is built. It traces to FR-NFR-harness-governance.md v1.3 (2026-10-30).

## Description

`goal-guard` is a PostToolUse hook on `WebFetch`, `WebSearch`, and `mcp__*` that runs a rule-based alignment check over a tool result. The check looks for text that tries to redirect the agent from the user's stated goal, for example a fetched page that tells the agent to send repository files to a URL. In Tranche 2 the hook ships advisory-only: when a rule matches, it records a would-deny event with a rule id to the governance audit log and withholds nothing; when nothing matches, it records a pass. The check is rule-based and calls no model, by deliberate choice, because it reads attacker-controlled text and a model-evaluating hook would itself be a prompt-injection surface (`DECISIONS.md`, 2026-10-30, "Build-time open items resolved (PN-1, PN-7, Step 18, Step 34, Step 3 binding)", D-13).

The existing `injection-filter` replaces injection phrasing with a marker and never blocks (spec-hooks-injection-filter.md); `goal-guard` adds a separate, deny-capable alignment layer and does not change `injection-filter`. Promotion from advisory to blocking is task plan Step 36 (Tranche 4), governed by the advisory-baseline-first gate of FR-238 and the severity policy, and is out of scope for this spec. The hook registration and counts are in spec-hooks-platform.md (Change Log 2026-11-06); the audit log that holds the would-deny and pass records is in spec-hooks-audit.md.

## Triggered by

| Trigger type | Source | Condition |
|---|---|---|
| Event | PostToolUse, matcher `WebFetch\|WebSearch\|mcp__.*` (spec-hooks-platform.md, Change Log 2026-11-06; the matcher string is proposed, task plan Step 19 naming the events) | Every result of a `WebFetch`, `WebSearch`, or `mcp__*` tool call |

## Required data

| Data | Source | Type | Notes |
|---|---|---|---|
| Tool result | Hook input `tool_response` | Text | The attacker-controlled text the check reads |
| User goal | The source the `UserPromptSubmit` hook sees (directional, task plan Step 19, Notes) | Text | How the check learns the goal is a build-time confirmation; advisory mode needs no withhold |
| Hijack rules | `hooks/lib/hijack-rules.js` | Rule catalog | Built in the style of `hooks/lib/injection-rules.js` |

## Preconditions

| Condition | Check | If not met |
|---|---|---|
| The result is a `WebFetch`, `WebSearch`, or `mcp__*` result | Matcher and `tool_name` | Not judged |
| Platform preconditions | spec-hooks-platform.md | Fail open |

## Algorithmic steps

Start-to-end flow of one advisory check. Source: [spec-hooks-goal-guard-flow.mmd](spec-hooks-goal-guard-flow.mmd).

```mermaid
flowchart TD
  S(["PostToolUse: WebFetch, WebSearch, or mcp__*"]) --> R["Run the rule-based alignment check<br/>over the tool result (no model, no network)"]
  R --> M{"A hijack rule matched?"}
  M -->|"yes"| WD["Record a would-deny event with a rule id<br/>to the governance audit log"]
  M -->|"no"| PS["Record a pass to the governance audit log"]
  WD --> ADV["Advisory mode: withhold nothing;<br/>print no deny"]
  PS --> ADV
  ADV --> X(["exit 0; the result reaches the agent unchanged"])
```

![Goal-guard advisory alignment-check flow](spec-hooks-goal-guard-flow.png)

**Note:** Rendered on 2026-11-06 with `mmdc -i specs/spec-hooks-goal-guard-flow.mmd -o specs/spec-hooks-goal-guard-flow.png`. The `.mmd` source is the record; re-render it after any edit.

### Requirement: Advisory alignment check on tool results

The `goal-guard` hook SHALL run a rule-based alignment check over a `WebFetch`, `WebSearch`, or `mcp__*` result and, in advisory mode, SHALL record a would-deny event with a rule id to the governance audit log when a rule finds that the result tries to redirect the agent from the user's stated goal, and a pass record otherwise, and SHALL withhold nothing from the agent.

**Requirement refs:** FR-219, FR-238, NFR-026, UR-062 | **Status:** Planned (harness-governance Tranche 2) | **Source:** FR-NFR-harness-governance.md v1.3, FR-219 (section 2.6), FR-238 (section 2.25, advisory run); task plan Step 19 (`hooks/goal-guard.js`, `hooks/impl/goal-guard.js`, PostToolUse on `WebFetch`, `WebSearch`, and `mcp__*`)

In advisory mode the hook records a finding and does not block (FR-238). The design of the deny path and the withholding of a result are confirmed against current hooks documentation before Step 36 promotes the rule; advisory mode needs no withhold (task plan Step 19, Notes). FR-219 is a `Should` requirement.

#### Scenario: Hijack would-deny recorded

- **GIVEN** the user's goal is "summarize this page" and a fetched page tells the agent to send repository files to a URL
- **WHEN** the WebFetch result reaches the hook in advisory mode
- **THEN** the audit log SHALL hold a would-deny event with a rule id
- **AND** the hook SHALL pass the result to the agent unchanged

#### Scenario: Benign result passes

- **GIVEN** a fetched page holds only documentation text
- **WHEN** the result reaches the hook
- **THEN** the hook SHALL pass the result unchanged
- **AND** the audit log SHALL hold a pass record

### Requirement: Rule-based, no model call

The `goal-guard` alignment check SHALL be rule-based, loading its rules from `hooks/lib/hijack-rules.js`, and SHALL import no model client and make no network call.

**Requirement refs:** FR-219, NFR-027 | **Status:** Planned (harness-governance Tranche 2) | **Source:** FR-NFR-harness-governance.md v1.3, FR-219 (section 2.6, "MUST be rule-based ... and MUST NOT call a model"); `DECISIONS.md`, 2026-10-30, "Build-time open items resolved (PN-1, PN-7, Step 18, Step 34, Step 3 binding)" (D-13); task plan Step 19

The check reads attacker-controlled text (a PR, a web page, a tool result), so a model-evaluating hook would itself be an injection surface; the rule-based choice is deliberate and may be revisited only after the FR-238 baseline (task plan Step 19, Notes; the hook facts cited there are directional).

#### Scenario: No model client

- **GIVEN** the `goal-guard` implementation and its rule library
- **WHEN** a test inspects them
- **THEN** they SHALL import no model client and SHALL make no network call

### Requirement: No write tools and no new grant

The `goal-guard` hook SHALL hold no write tools, and its addition SHALL introduce no new unscoped `Bash` grant.

**Requirement refs:** NFR-027, FR-219 | **Status:** Planned (harness-governance Tranche 2) | **Source:** FR-NFR-harness-governance.md v1.3, NFR-027 (section 3.2); task plan Step 19 (the guardrail holds no write tools)

#### Scenario: Guardrail holds no write tools

- **GIVEN** the `goal-guard` hook
- **WHEN** a reviewer reads its implementation and the registration
- **THEN** it SHALL neither write files nor add an unscoped `Bash` grant

### Requirement: Fails open and records to the audit log

The `goal-guard` hook SHALL fail open: when the check throws, times out, or cannot read its rules, it SHALL record the failure in `hook-health.jsonl` and withhold nothing, and each would-deny and pass record SHALL carry a rule id to the governance audit log.

**Requirement refs:** NFR-026, FR-219, NFR-035 | **Status:** Planned (harness-governance Tranche 2) | **Source:** FR-NFR-harness-governance.md v1.3, NFR-026 (section 3.2); task plan Step 19 (an explicit short `timeout` in `hooks.json` for the NFR-029 budget; the self-test corpus with a hijack sample and a benign sample)

The hook ships a self-test corpus with a known hijack sample and a known benign sample, reported through `/assist-plugin:health` (NFR-035; spec-hooks-health-check.md). The records reach the chain of spec-hooks-audit.md.

#### Scenario: Check error withholds nothing

- **GIVEN** the alignment check throws while reading a result
- **WHEN** the hook returns
- **THEN** the hook SHALL record the failure in `hook-health.jsonl`
- **AND** the result SHALL reach the agent unchanged

## Business rules

| Rule ID | Rule | Traces to | Applied at |
|---|---|---|---|
| RULE-001 | Advisory mode records and withholds nothing | FR-219, FR-238 | Requirement: Advisory alignment check on tool results |
| RULE-002 | The check is rule-based and calls no model | FR-219 | Requirement: Rule-based, no model call |
| RULE-003 | The guardrail holds no write tools and adds no new grant | NFR-027 | Requirement: No write tools and no new grant |
| RULE-004 | The hook fails open; records carry a rule id | NFR-026 | Requirement: Fails open and records to the audit log |

## Data transformations

| Input | Transformation | Output | Notes |
|---|---|---|---|
| Tool result text | Rule-based alignment match | Match or no match | `hooks/lib/hijack-rules.js` |
| Match or no match | Record with a rule id | A would-deny or pass record in the audit log | Advisory mode withholds nothing |

## Output / Outcome

| Output | Type | Description |
|---|---|---|
| Would-deny record | Audit log line | A rule matched; advisory mode withholds nothing |
| Pass record | Audit log line | No rule matched |
| No stdout | Exit 0 | The result reaches the agent unchanged in advisory mode |

## Error handling

| Error condition | Handling strategy | Outcome |
|---|---|---|
| Check throws, times out, or cannot read its rules | Platform failure path; record in `hook-health.jsonl` | Withhold nothing; the result proceeds |
| Audit-log append fails | Record the failure in `hook-health.jsonl` | The result proceeds; no would-deny or pass record is stored |

## Events emitted

| Event name | Payload | Consumer(s) | When emitted |
|---|---|---|---|
| Would-deny record | Rule id, tool name | Chain verification; control-evidence export (task plan Step 29, Tranche 3) | A hijack rule matched |
| Pass record | Tool name | Same | No rule matched |

## Events consumed

| Event name | Producer | Payload used | Handling |
|---|---|---|---|
| PostToolUse (`WebFetch`, `WebSearch`, `mcp__*`) | Claude Code | `tool_response` | Alignment check, advisory record |

## Sub-feature breakdown

Not applicable: a leaf feature of spec-hooks-platform.md.

## Performance considerations

| Concern | Target | Approach |
|---|---|---|
| Per-call cost (NFR-029) | Within the per-hook median budget | An explicit short `timeout` in `hooks.json`; a rule-match pass over the result, no model and no network |

## Traceability

| Requirement | Spec section | Verified by |
|---|---|---|
| FR-219, FR-238 | Requirement: Advisory alignment check on tool results | Hijack sample records a would-deny and passes the result; benign sample records a pass (`tests/hooks/goal-guard.test.js`, task plan Step 20) |
| FR-219 | Requirement: Rule-based, no model call | The hook imports no model client and makes no network call (asserted in the test) |
| NFR-027 | Requirement: No write tools and no new grant | Tool review; no new `Bash` grant in the registration |
| NFR-026, NFR-035 | Requirement: Fails open and records to the audit log | A check error withholds nothing and records the failure; the self-test corpus reports through `/assist-plugin:health` |

## Change Log: 2026-11-06

**Source:** FR-NFR-harness-governance.md v1.3 (2026-10-30), FR-219 (section 2.6), FR-238 (section 2.25), NFR-026 (section 3.2); task plan `docs/task-plans/task-plan-harness-governance-20261028-0759.md`, Step 19; the as-built advisory-record behavior of the harness-governance Tranche 2 build (shipped and gate-approved), which a loose line of this spec misworded. This entry reconciles the record-fields wording to that build and records the advisory-recall reassessment items. It adds no new requirement, so the change is Planned (harness-governance Tranche 2) and matches what shipped. This spec received a reconciliation delta, so its Status moves to `Review` (delta rule 6, no same-turn user approval).

### Direct edits in this pass (no behavior change)

- Status: Draft -> Review.

### Body text this entry supersedes (applied at the next fold)

- Description preamble: the sentence "This spec describes planned behavior for harness-governance Tranche 2 ...; nothing here is built" is superseded by the shipped, gate-approved harness-governance Tranche 2 build that this entry reconciles to. At the next fold the preamble reads as built; the Status stays `Review` until then, not `Implemented`.
- Events emitted: the Would-deny record row reads "Rule id, rule family, rule count (`rule_count`), tool name, agent identity" and the Pass record row reads "Tool name, agent identity" (no rule id).
- Data transformations, the "Match or no match" row: a would-deny record carries the rule id, rule family, count of matching rules (`rule_count`), tool name, and agent identity; a pass record carries the tool name and agent identity and no rule id.

### ADDED Requirements

None.

### MODIFIED Requirements

#### Requirement: Fails open and records to the audit log

**Was:** The `goal-guard` hook SHALL fail open: when the check throws, times out, or cannot read its rules, it SHALL record the failure in `hook-health.jsonl` and withhold nothing, and each would-deny and pass record SHALL carry a rule id to the governance audit log.

**Now:** The `goal-guard` hook SHALL fail open: when the check throws, times out, or cannot read its rules, it SHALL record the failure in `hook-health.jsonl` and withhold nothing; a would-deny record SHALL carry a rule id, the rule family, the count of matching rules (`rule_count`), the tool name, and the agent identity to the governance audit log, and a pass record SHALL carry the tool name and the agent identity and no rule id.

**Reason:** The loose clause "each would-deny and pass record SHALL carry a rule id" contradicted this spec's own record-fields table (Events emitted), where a pass record holds the tool name only. As built the would-deny record is fuller than the table first stated: it carries the rule family, the count of matching rules (`rule_count`), and the agent identity besides the rule id and tool name, and the pass record carries the tool name and the agent identity. This reconciles the statement to the record-fields table and to the build.

**Requirement refs:** NFR-026, FR-219, NFR-035 | **Status:** Planned (harness-governance Tranche 2); matches the shipped build

##### Scenario: Pass record carries no rule id

- **GIVEN** a `WebFetch` result that matches no hijack rule
- **WHEN** the hook records a pass to the governance audit log
- **THEN** the pass record SHALL hold the tool name and the agent identity
- **AND** the pass record SHALL NOT hold a rule id

##### Scenario: Would-deny record carries the rule id and family

- **GIVEN** a `WebFetch` result that matches a hijack rule in advisory mode
- **WHEN** the hook records a would-deny event
- **THEN** the would-deny record SHALL hold the rule id, the rule family, the count of matching rules (`rule_count`), the tool name, and the agent identity

### REMOVED Requirements

None.

### Advisory-recall reassessment items (Tranche 4 / task plan Step 36)

The build documents these recall limits in the rule library. They are known limits of the advisory baseline, not defects, and are carried for reassessment when Step 36 promotes the rule from advisory to blocking (FR-238):

- The scan reads the head (about 150 KB) and the tail (about 50 KB) of a tool result, so a hijack placed in the middle of a result larger than about 200 KB can be missed.
- The scan-window overlap can miss a long match that straddles a window boundary.
- The discussion and quote carve-out now excludes modal verbs, so `you must ignore ...` is caught, but it still exempts the `to`-marked phrasings (`you need to ignore ...`, `you have to ignore ...`) and does not match `disregard your rules` without a `previous|prior|system|...` qualifier.

### Traceability added

| Requirement | Spec section | Verified by |
|---|---|---|
| NFR-026 | Change Log 2026-11-06: Requirement: Fails open and records to the audit log | A pass record holds the tool name and agent identity and no rule id; a would-deny record holds the rule id, rule family, count of matching rules (`rule_count`), tool name, and agent identity (`tests/hooks/goal-guard.test.js`) |
| FR-238 | Change Log 2026-11-06: Advisory-recall reassessment items | The head and tail scan cap, the window-overlap gap, and the carve-out phrasings are recorded for the Step 36 promotion reassessment |

## Change Log: 2026-11-13 (Tranche 4)

**Source:** FR-NFR-harness-governance.md v1.3 (2026-10-30): FR-219 (section 2.6), FR-238 (section 2.25), FR-239 (section 2.26), NFR-034 (section 3.5); task plan `docs/task-plans/task-plan-harness-governance-20261028-0759.md`, Tranche 4 Step 32 (the rule-mode store, `route(finding)`, the baseline, and the promotion check) and Step 36 (promote FR-219 and FR-220 to blocking after the baseline); `DECISIONS.md`, 2026-10-31, "Severity policy approved". Harness-governance Tranche 4 is not built yet, so every change here is Planned (harness-governance Tranche 4). This spec received a delta, so its Status stays `Review` (delta rule 6, no same-turn approval). The severity-routing mechanism this entry ties `goal-guard` to (`route(finding)`, the rule-mode store, the advisory baseline, and the promotion gate) is specified in spec-hooks-code-scan.md; this entry only binds `goal-guard`'s advisory-or-blocking mode to it and records that this release enables no blocking.

### Direct edits in this pass (no behavior change)

- Requirement refs: FR-239 and NFR-034 added. FR-219 and FR-238 are already present.

### Body text this entry supersedes (applied at the next fold)

- Description, the sentence "Promotion from advisory to blocking is task plan Step 36 (Tranche 4), governed by the advisory-baseline-first gate of FR-238 and the severity policy, and is out of scope for this spec": now reads that the advisory-or-blocking mode of `goal-guard` is read from the rule-mode store `.agent/governance/rule-modes.json` (advisory when absent or malformed), and that promotion to blocking is the user-run `scripts/promote-rule.js` of task plan Step 36, built on the mechanism in spec-hooks-code-scan.md and governed by FR-238 and NFR-034; this release enables no blocking.

### ADDED Requirements

#### Requirement: Mode read from the rule-mode store, promotion disabled this release

The `goal-guard` hook SHALL read its advisory-or-blocking mode from the rule-mode store `.agent/governance/rule-modes.json`, treating an absent or malformed store as advisory and never failing open into blocking, and SHALL stay advisory this release; a switch to blocking SHALL be only the user-run `scripts/promote-rule.js` of task plan Step 36, which the advisory baseline and the precision bar gate (FR-238, NFR-034).

**Requirement refs:** FR-219, FR-238, NFR-034 | **Status:** Planned (harness-governance Tranche 4) | **Source:** FR-NFR-harness-governance.md v1.3, FR-219 (section 2.6), FR-238 (section 2.25); task plan Step 32 (the rule-mode store and the promotion check) and Step 36 (promotion is a user-run operation; this release builds the mechanism only and enables no blocking); spec-hooks-code-scan.md, Requirement: Rule-mode store governs advisory versus blocking and Requirement: Promotion gate

`goal-guard` is the first of the two rules that the Tranche 4 severity-routing mechanism governs (the insecure-code scan of FR-220 is the second; spec-hooks-code-scan.md). Its mode comes from the shared rule-mode store, so no `goal-guard`-specific toggle exists. The fail-open-into-advisory default means a missing or corrupt store never turns `goal-guard` blocking. Before the Step 36 switch, the `PostToolUse` output shape that withholds a result is confirmed against current hooks documentation (the open build-time item of the Description), because advisory mode withholds nothing and so never exercises it. FR-219 is not a member of the NFR-028 security-critical class (NFR-028 names FR-214, FR-217, FR-220, FR-223, FR-231, FR-233, and FR-246), so `goal-guard` fails open on an evaluation error in advisory mode and after promotion alike.

##### Scenario: Absent store keeps goal-guard advisory

- **GIVEN** `.agent/governance/rule-modes.json` does not exist
- **WHEN** a `WebFetch` result that matches a hijack rule reaches the hook
- **THEN** the hook SHALL record a would-deny event and withhold nothing, because the mode is advisory

##### Scenario: Promotion is user-run and off this release

- **GIVEN** the mechanism is built and no user has run `promote-rule.js`
- **WHEN** a hijack-matching result reaches `goal-guard`
- **THEN** the hook SHALL stay advisory and withhold nothing, because this release enables no blocking

### MODIFIED Requirements

#### Requirement: Advisory alignment check on tool results

**Was:** The `goal-guard` hook SHALL run a rule-based alignment check over a `WebFetch`, `WebSearch`, or `mcp__*` result and, in advisory mode, SHALL record a would-deny event with a rule id to the governance audit log when a rule finds that the result tries to redirect the agent from the user's stated goal, and a pass record otherwise, and SHALL withhold nothing from the agent.

**Now:** The `goal-guard` hook SHALL run a rule-based alignment check over a `WebFetch`, `WebSearch`, or `mcp__*` result and, while its mode in the rule-mode store is advisory (the default, including an absent or malformed store), SHALL record a would-deny event with a rule id to the governance audit log when a rule finds that the result tries to redirect the agent from the user's stated goal, and a pass record otherwise, and SHALL withhold nothing from the agent.

**Reason:** FR-238 and task plan Step 32: the advisory-or-blocking mode of each check is read from the rule-mode store, and the advisory default (an absent or malformed store) is the safe direction. The record behavior is unchanged; the clause only names the store as the source of the advisory mode.

**Requirement refs:** FR-219, FR-238, NFR-026, UR-062 | **Status:** Planned (harness-governance Tranche 4); the advisory record behavior matches the shipped Tranche 2 build

The scenarios Hijack would-deny recorded and Benign result passes are unchanged.

### REMOVED Requirements

None.

### Traceability added

| Requirement | Spec section | Verified by |
|---|---|---|
| FR-219, FR-238 | Change Log 2026-11-13 (Tranche 4): Requirement: Mode read from the rule-mode store, promotion disabled this release | An absent rule-mode store keeps `goal-guard` advisory; no blocking is enabled without a user-run `promote-rule.js` (`tests/hooks/goal-guard.test.js`, `tests/scripts/promote-rule.test.js`, task plan Step 37) |
| NFR-034 | Change Log 2026-11-13 (Tranche 4): Requirement: Mode read from the rule-mode store, promotion disabled this release | A promotion of `goal-guard` is refused below 90% precision (spec-hooks-code-scan.md, Requirement: Promotion gate) |

## Change Log: 2026-11-13 (Tranche 5)

**Source:** FR-NFR-harness-governance.md v1.3 (2026-10-30): FR-219 (section 2.6), FR-238 (section 2.25), NFR-028 (section 3.2); task plan `docs/task-plans/task-plan-harness-governance-20261028-0759.md`, Step 36 (promote FR-219 and FR-220 to blocking; "For FR-219, confirm the PostToolUse output shape that withholds a result (PN-1 note) before the switch"); `DECISIONS.md`, 2026-11-13, "Harness-governance Tranche 5 (control register) approved for build" (choice 3: the deferred FR-219 goal-guard blocking wiring, reading `.agent/governance/rule-modes.json` and the result-withhold mechanism, is built now; the runbook documents the path and performs no promotion); the Claude Code PostToolUse hook output shape, confirmed from the hooks documentation (`hookSpecificOutput.hookEventName` `"PostToolUse"` with `updatedToolOutput`; high confidence), which resolves the design this spec deferred at line 70 and line 262. This entry specifies the blocking-mode contract the advisory-only body left open; it enables no blocking (the default stays advisory, and a switch is a user-run promotion). FR-219's membership in the NFR-028 fail-closed set, in blocking mode only, rests on the user decision `DECISIONS.md`, 2026-11-13, "FR-219 (goal-guard) joins the NFR-028 fail-closed set in blocking mode". The NFR-028 enumeration in FR-NFR-harness-governance.md (section 3.2) does not list FR-219 today; it is updated to add FR-219 (blocking mode) in the Tranche 5 documentation sync (task plan Step 8), so this entry does not claim the enumeration already holds it. This spec received a delta, so its Status stays `Review` (delta rule 6, no same-turn approval).

### Direct edits in this pass (no behavior change)

- Requirement refs: NFR-028 added, for the blocking-mode fail-closed behavior this entry specifies; the basis is `DECISIONS.md`, 2026-11-13, "FR-219 (goal-guard) joins the NFR-028 fail-closed set in blocking mode". FR-219 and FR-238 are already present.

### Body text this entry supersedes (applied at the next fold)

- Description, line 70 ("The design of the deny path and the withholding of a result are confirmed against current hooks documentation before Step 36 promotes the rule"): now reads that the withhold mechanism is the Claude Code PostToolUse `updatedToolOutput` output (Requirement: Blocking-mode result withhold via PostToolUse `updatedToolOutput`), confirmed from the hooks documentation.
- Change Log 2026-11-13 (Tranche 4), Requirement: Mode read from the rule-mode store, promotion disabled this release, the clause "Before the Step 36 switch, the `PostToolUse` output shape that withholds a result is confirmed against current hooks documentation ... because advisory mode withholds nothing and so never exercises it": superseded; the output shape is confirmed and specified below, and the mode-read and withhold wiring is built this release (the Tranche 4 build left `goal-guard.js` hardcoded advisory per `DECISIONS.md`, 2026-11-13, "Harness-governance Tranche 4 ... built"; Tranche 5 wires it).
- Change Log 2026-11-13 (Tranche 4), the sentence "FR-219 is not a member of the NFR-028 security-critical class ..., so `goal-guard` fails open on an evaluation error in advisory mode and after promotion alike": the claim that FR-219 is not a member of the NFR-028 security-critical class and the "after promotion alike" clause are superseded by the user decision `DECISIONS.md`, 2026-11-13, "FR-219 (goal-guard) joins the NFR-028 fail-closed set in blocking mode" and by Requirement: Fail closed for the guarded class in blocking mode. Advisory mode still fails open; in blocking mode, a result the hook cannot finish evaluating is withheld (fail-closed for the guarded class). FR-219's `Should` priority is unchanged. The FR-NFR-harness-governance.md NFR-028 enumeration (section 3.2) is updated to add FR-219 (blocking mode) in the Tranche 5 documentation sync (task plan Step 8); until that sync lands the enumeration does not list it.
- Business rules, row RULE-004 ("The hook fails open; records carry a rule id", traced to NFR-026): now reads "The hook fails open in advisory mode; fails closed for the guarded class in blocking mode (NFR-028); records carry a rule id", and its Traces-to cell reads "NFR-026, NFR-028". The unqualified fail-open wording contradicts Requirement: Fail closed for the guarded class in blocking mode, which fails closed in blocking mode and keeps the fail-open behavior in advisory mode only.
- Requirements, Requirement: Fails open and records to the audit log (statement at line 114, and the "Now" wording of Change Log 2026-11-06): the opening clause "The `goal-guard` hook SHALL fail open: when the check throws, times out, or cannot read its rules, it SHALL record the failure in `hook-health.jsonl` and withhold nothing" is unqualified and contradicts Requirement: Fail closed for the guarded class in blocking mode. It now reads "The `goal-guard` hook SHALL fail open in advisory mode: when the check throws, times out, or cannot read its rules, it SHALL record the failure in `hook-health.jsonl` and withhold nothing; in blocking mode it SHALL fail closed for the guarded class (NFR-028), withholding a result it cannot finish evaluating through `updatedToolOutput` and recording the failure in `hook-health.jsonl`". The record-field clauses that follow in the 2026-11-06 "Now" wording (the would-deny and pass record fields) are unchanged, the requirement's Requirement refs gain NFR-028, and the heading is unchanged so existing references resolve. The advisory-mode scenario Check error withholds nothing is unchanged.
- Error handling, the first row (line 155), Outcome cell "Withhold nothing; the result proceeds": now scoped to advisory mode. The row's Error condition reads "Check throws, times out, or cannot read its rules (advisory mode)" and its Outcome stays "Withhold nothing; the result proceeds". A row is added for blocking mode: Error condition "Check throws, times out, or cannot read its rules after the hook has read the result (blocking mode)", Handling strategy "Platform failure path; record in `hook-health.jsonl`; withhold the result through `updatedToolOutput`", Outcome "The result is withheld; fail-closed for the guarded class (NFR-028)". The unqualified outcome contradicts Requirement: Fail closed for the guarded class in blocking mode, which withholds a result the hook cannot finish evaluating in blocking mode and keeps pass-through in advisory mode only.

### ADDED Requirements

#### Requirement: Blocking-mode result withhold via PostToolUse `updatedToolOutput`

While its mode in the rule-mode store `.agent/governance/rule-modes.json` is blocking, the `goal-guard` hook SHALL, on a hijack-rule match, withhold or rewrite the tool result the model sees by emitting a JSON stdout object whose `hookSpecificOutput.hookEventName` is `"PostToolUse"` and whose `updatedToolOutput` replaces the tool output, and SHALL record a deny record with the rule id to the governance audit log; an absent or malformed store SHALL keep the mode advisory and withhold nothing.

**Requirement refs:** FR-219, FR-238, NFR-028 | **Status:** Planned (harness-governance Tranche 5) | **Source:** FR-NFR-harness-governance.md v1.3, FR-219 (section 2.6, "withhold the result from the agent"), FR-238 (section 2.25); task plan Step 36; the Claude Code PostToolUse output shape (confirmed from the hooks documentation, high confidence); `DECISIONS.md`, 2026-11-13, "Harness-governance Tranche 5 (control register) approved for build" (choice 3)

The PostToolUse event fires after the tool has already executed, so the hook governs only what the model then sees, not whether the tool ran. The confirmed suppression path is `updatedToolOutput`: a `decision` of `"block"` with a `reason` appends the reason to the transcript but does not suppress the tool result, so a hijack result would still reach the model; replacing the result through `updatedToolOutput` is the mechanism that withholds or rewrites it. Withholding replaces the result with a short safe notice that names the rule id; rewriting strips the hijack span and keeps the benign remainder. The mode comes from the shared rule-mode store (spec-hooks-code-scan.md, Requirement: Rule-mode store governs advisory versus blocking); the default is advisory, and an absent, malformed, or non-promoting store never turns `goal-guard` blocking. This release wires the mode read and the `updatedToolOutput` path but performs no promotion, so `goal-guard` stays advisory until a user runs `scripts/promote-rule.js` (spec-hooks-code-scan.md, Requirement: Promotion gate).

##### Scenario: Blocking mode withholds a hijack result

- **GIVEN** the rule-mode store marks `goal-guard` blocking and a fetched page tells the agent to send repository files to a URL
- **WHEN** the `WebFetch` result reaches the hook
- **THEN** the hook SHALL emit a PostToolUse JSON object whose `updatedToolOutput` replaces the result the model sees
- **AND** the hook SHALL record a deny record with the rule id to the governance audit log

##### Scenario: A block decision alone does not suppress the result

- **GIVEN** the hook is in blocking mode on a hijack-matching result
- **WHEN** the hook forms its output
- **THEN** the hook SHALL use `updatedToolOutput` to replace the result, because a `decision` of `"block"` with a `reason` appends a reason and does not suppress the tool output

##### Scenario: Known limit, the tool has already run

- **GIVEN** a `WebFetch` whose result matches a hijack rule in blocking mode
- **WHEN** the hook runs
- **THEN** the hook SHALL govern only the result the model sees through `updatedToolOutput`
- **AND** the hook SHALL NOT be able to prevent the `WebFetch` from having run, which is a recorded limit of the PostToolUse timing

#### Requirement: Fail closed for the guarded class in blocking mode

While its mode is blocking, the `goal-guard` hook SHALL fail closed for its guarded class: when it errors or times out after reading its input on a result it cannot finish evaluating (a would-block result), it SHALL withhold that result through `updatedToolOutput` rather than pass it through; in advisory mode the hook SHALL continue to fail open and withhold nothing.

**Requirement refs:** NFR-028, FR-219 | **Status:** Planned (harness-governance Tranche 5) | **Source:** FR-NFR-harness-governance.md v1.3, NFR-028 (section 3.2, "MUST deny its own guarded operation class when it cannot evaluate because of an error or timeout"); task plan Step 36; `DECISIONS.md`, 2026-11-13, "Harness-governance Tranche 5 (control register) approved for build" (choice 3); `DECISIONS.md`, 2026-11-13, "FR-219 (goal-guard) joins the NFR-028 fail-closed set in blocking mode" (the basis for FR-219's NFR-028 membership)

FR-219 is a member of the NFR-028 fail-closed set in blocking mode only, by the explicit user decision `DECISIONS.md`, 2026-11-13, "FR-219 (goal-guard) joins the NFR-028 fail-closed set in blocking mode", which mirrors the 2026-10-30 FR-246 addition. The NFR-028 enumeration in FR-NFR-harness-governance.md (section 3.2) names FR-214, FR-217, FR-220, FR-223, FR-231, FR-233, and FR-246 and does not yet list FR-219; that enumeration is updated to add FR-219 (blocking mode) in the Tranche 5 documentation sync (task plan Step 8), so this spec does not claim the enumeration already lists it. Advisory mode is outside the NFR-028 membership and stays fail-open (NFR-026).

The guarded class is a `WebFetch`, `WebSearch`, or `mcp__*` result in blocking mode. When the hook has the result in hand but cannot complete the alignment check because it threw or hit its `timeout`, it treats the uncovered result as a would-block result and withholds it, because passing attacker-controlled text through on an evaluation failure is the unsafe direction. This fail-closed behavior is scoped to blocking mode only: in advisory mode, and before any user-run promotion, the hook withholds nothing and records the failure in `hook-health.jsonl` (Requirement: Fails open and records to the audit log, as modified 2026-11-06). The record of the failure still reaches `hook-health.jsonl`.

##### Scenario: Evaluation error in blocking mode withholds

- **GIVEN** the rule-mode store marks `goal-guard` blocking and the alignment check throws or times out after reading a `WebFetch` result
- **WHEN** the hook returns
- **THEN** the hook SHALL withhold the result through `updatedToolOutput`
- **AND** the hook SHALL record the failure in `hook-health.jsonl`

##### Scenario: Evaluation error in advisory mode passes through

- **GIVEN** the rule-mode store is absent or marks `goal-guard` advisory and the alignment check throws
- **WHEN** the hook returns
- **THEN** the hook SHALL pass the result to the agent unchanged
- **AND** the hook SHALL record the failure in `hook-health.jsonl`

### MODIFIED Requirements

#### Requirement: Mode read from the rule-mode store, promotion disabled this release

**Was:** The `goal-guard` hook SHALL read its advisory-or-blocking mode from the rule-mode store `.agent/governance/rule-modes.json`, treating an absent or malformed store as advisory and never failing open into blocking, and SHALL stay advisory this release; a switch to blocking SHALL be only the user-run `scripts/promote-rule.js` of task plan Step 36, which the advisory baseline and the precision bar gate (FR-238, NFR-034).

**Now:** The `goal-guard` hook SHALL read its advisory-or-blocking mode from the rule-mode store `.agent/governance/rule-modes.json`, treating an absent, malformed, or non-promoting store as advisory and never failing open into blocking, and SHALL act on a blocking mode by withholding or rewriting the result through the PostToolUse `updatedToolOutput` path (Requirement: Blocking-mode result withhold via PostToolUse `updatedToolOutput`); this release wires the mode read and the withhold path but performs no promotion, so `goal-guard` stays advisory until a user runs `scripts/promote-rule.js` of task plan Step 36, which the advisory baseline and the precision bar gate (FR-238, NFR-034).

**Reason:** Tranche 5 builds the deferred FR-219 blocking wiring (`DECISIONS.md`, 2026-11-13, "Harness-governance Tranche 5 ... approved for build", choice 3): the hook now reads the store and acts on a blocking mode through the confirmed `updatedToolOutput` path, where the Tranche 4 build left `goal-guard.js` hardcoded advisory. The default stays advisory and no promotion is performed, so the release enables no blocking.

**Requirement refs:** FR-219, FR-238, NFR-034 | **Status:** Planned (harness-governance Tranche 5)

The scenarios Absent store keeps goal-guard advisory and Promotion is user-run and off this release are unchanged.

### REMOVED Requirements

None.

### Traceability added

| Requirement | Spec section | Verified by |
|---|---|---|
| FR-219 | Change Log 2026-11-13 (Tranche 5): Requirement: Blocking-mode result withhold via PostToolUse `updatedToolOutput` | In blocking mode a hijack-matching result is replaced through `updatedToolOutput` and a deny record holds the rule id; a `block` decision alone does not suppress the result (`tests/hooks/goal-guard.test.js`, task plan Step 41) |
| NFR-028 | Change Log 2026-11-13 (Tranche 5): Requirement: Fail closed for the guarded class in blocking mode | In blocking mode an evaluation error or timeout withholds the result through `updatedToolOutput`; in advisory mode the same error passes the result through (`tests/hooks/goal-guard.test.js`). FR-219 (blocking mode) joins the NFR-028 set by `DECISIONS.md`, 2026-11-13, "FR-219 (goal-guard) joins the NFR-028 fail-closed set in blocking mode"; the FR-NFR NFR-028 enumeration (section 3.2) gains FR-219 in the Tranche 5 documentation sync (task plan Step 8) |
| FR-219, FR-238 | Change Log 2026-11-13 (Tranche 5): Requirement: Mode read from the rule-mode store, promotion disabled this release | The hook reads the store and acts on a blocking mode; the default stays advisory and no promotion is performed this release (`tests/hooks/goal-guard.test.js`, `tests/scripts/promote-rule.test.js`) |

## Change Log: 2026-11-13 (Tranche 5, FR-219 end-to-end: advisory findings-write)

**Source:** FR-NFR-harness-governance.md v1.3 (2026-10-30): FR-219 (section 2.6), FR-238 (section 2.25, "record every finding, and produce a baseline report with finding counts and precision before promotion"), NFR-034 (section 3.5, the at-least-90% precision bar computed from the user's true or false labels); `DECISIONS.md`, 2026-11-13, "FR-219 completed end-to-end (goal-guard writes advisory findings for the promotion baseline)"; the shared baseline store and scripts of spec-hooks-code-scan.md (Requirement: Advisory baseline and precision from user labels, Requirement: Promotion gate, Requirement: Rule-mode store governs advisory versus blocking). This entry adds the advisory findings-write that makes `goal-guard` promotable under FR-238: in advisory mode the hook records each hijack would-deny match as a finding in the baseline store `.agent/governance/review-findings.jsonl`, besides its existing governance audit-log would-deny and pass records. Without this write `scripts/promote-rule.js goal-guard` refuses with the missing-baseline reason forever, because the baseline the promotion gate reads is the findings store, not the audit log, and `goal-guard` wrote only the audit log through the Tranche 4 build. The findings-write changes none of the mode behaviors the earlier Tranche 5 blocking delta specifies: advisory mode still fails open and withholds nothing, and blocking mode withholds or rewrites the result through `updatedToolOutput` and fails closed for the guarded class. This entry enables no blocking (the mode default stays advisory, and a switch is still the user-run `scripts/promote-rule.js`). This spec received a delta, so its Status stays `Review` (delta rule 6, no same-turn approval).

### Direct edits in this pass (no behavior change)

- Requirement refs: NFR-034 added, for the promotion precision bar the advisory findings-write feeds; this also applies the NFR-034 addition that the Change Log 2026-11-13 (Tranche 4) direct-edits line recorded but the metadata block had not yet carried. FR-219 and FR-238 are already present.
- Correction to this entry's finding-field wording (no behavior change): the baseline finding's `rule_id` is the fixed string `"goal-guard"`, not the per-hijack rule id. `scripts/baseline-report.js` and `scripts/promote-rule.js` group and filter findings by `rule_id` equal to the rule-mode store key, so a finding whose `rule_id` is a per-hijack id such as `go-ignore-previous` leaves `promote-rule.js goal-guard` with zero findings and a missing-baseline refusal, which defeats the findings-write. The per-hijack rule id moves to a separate field, `hijack_rule_id`. The corrected wording is in the Algorithmic steps and Events emitted bullets below, Requirement: Advisory would-deny finding written to the baseline store (now with a field table), Requirement: Rule-mode store key for goal-guard is the flat key "goal-guard", Requirement: Findings keep accruing in blocking mode, and the Traceability rows. The record shape matches the as-built `hooks/impl/goal-guard.js` (`findingOf`).

### Body text this entry supersedes (applied at the next fold)

- Description, the sentence (line 20) "when a rule matches, it records a would-deny event with a rule id to the governance audit log and withholds nothing; when nothing matches, it records a pass": now reads that, in advisory mode, besides the governance audit-log would-deny and pass records, the hook also records each would-deny (hijack match) as a finding in the baseline store `.agent/governance/review-findings.jsonl` (Requirement: Advisory would-deny finding written to the baseline store). The audit-log records are unchanged.
- Requirement: Advisory alignment check on tool results (statement at line 66, and the "Now" wording of Change Log 2026-11-13 (Tranche 4)): the clause "SHALL record a would-deny event with a rule id to the governance audit log ... and a pass record otherwise" stays unchanged for the audit log and is supplemented: in advisory mode the hook also writes a finding to `.agent/governance/review-findings.jsonl` on each would-deny, per Requirement: Advisory would-deny finding written to the baseline store. The withhold behavior is unchanged.
- Algorithmic steps, the advisory flow: on a hijack match in advisory mode the "Record a would-deny event ... to the governance audit log" node gains a parallel step, "Append a finding (`rule_id` `"goal-guard"`, `hijack_rule_id`, severity, confidence, tool name) to `.agent/governance/review-findings.jsonl`"; the branch structure is otherwise unchanged (the finding is a second record, not a new branch), so the diagram's `.mmd` and PNG are re-rendered at the next fold, not in this pass.
- Business rules: a row RULE-005 is added, "Each advisory would-deny is also recorded as a finding in `review-findings.jsonl` for the FR-238 baseline", with Traces-to "FR-238, NFR-034" and Applied-at "Requirement: Advisory would-deny finding written to the baseline store".
- Data transformations: a row is added, Input "A would-deny (hijack match)", Transformation "Append a finding record", Output "A baseline record in `.agent/governance/review-findings.jsonl` awaiting a user label", Notes "The shared store code-scan uses; not an FR-245 protected path (FR-245 Origin)". The existing audit-record rows are unchanged.
- Output / Outcome: a row is added, Output "Would-deny finding", Type "`review-findings.jsonl` line", Description "A hijack rule matched; the baseline record the FR-238 promotion gate reads". The existing audit-log and exit rows are unchanged.
- Events emitted: a row is added, Event name "Would-deny finding", Payload "The fields of the finding field table in Requirement: Advisory would-deny finding written to the baseline store: `rule_id` (the fixed string `"goal-guard"`), `hijack_rule_id` (the matching hijack rule id), severity, confidence, `file` (the tool name), `line` (1), and `review_id` when the session id fits the id pattern; never the matched text, the result text, a URL, or a query", Consumer(s) "`scripts/label-findings.js`, `scripts/baseline-report.js`, `scripts/promote-rule.js` (spec-hooks-code-scan.md)", When emitted "A hijack rule matched (advisory mode; also blocking mode under Requirement: Findings keep accruing in blocking mode)". The existing Would-deny record and Pass record rows (the audit-log records) are unchanged.

### ADDED Requirements

#### Requirement: Advisory would-deny finding written to the baseline store

In advisory mode the `goal-guard` hook SHALL record a finding, whose `rule_id` is the fixed string `"goal-guard"`, to the shared baseline store `.agent/governance/review-findings.jsonl` on each hijack-rule match, besides its governance audit-log would-deny record, so the check produces the baseline the FR-238 promotion gate reads.

**Requirement refs:** FR-219, FR-238, NFR-034 | **Status:** Planned (harness-governance Tranche 5) | **Source:** FR-NFR-harness-governance.md v1.3, FR-219 (section 2.6), FR-238 (section 2.25, "record every finding"); `DECISIONS.md`, 2026-11-13, "FR-219 completed end-to-end (goal-guard writes advisory findings for the promotion baseline)"; spec-hooks-code-scan.md, Requirement: Advisory baseline and precision from user labels (the shared record shape and the session-id `review_id`), Requirement: Promotion gate (the missing-baseline refusal)

The finding is one record in the shared finding schema that `checkFinding` validates and that `scripts/baseline-report.js`, `scripts/label-findings.js`, and `scripts/promote-rule.js` read (spec-hooks-code-scan.md, Requirement: Advisory baseline and precision from user labels). The hook builds it field by field as the table states, and the Step 9 tests (`tests/hooks/goal-guard.test.js`) assert exactly these fields:

| Field | Value | Notes |
|---|---|---|
| `id` | A minted unique id with the prefix `gg` | 1 to 64 characters of `A-Z a-z 0-9 . _ : -`, starting with a letter or digit (the `checkFinding` id pattern) |
| `rule_id` | The fixed string `"goal-guard"` | The rule-mode store key. `baseline-report.js` and `promote-rule.js` filter findings by `rule_id` equal to the store key, so this value lets `promote-rule.js goal-guard` find its baseline. It is not the per-hijack rule id |
| `hijack_rule_id` | The id of the first matching hijack rule, for example `go-ignore-previous` | An extra field, the same id the audit would-deny or deny record carries as its `rule_id`. `checkFinding` ignores extra fields, and `scripts/label-findings.js` preserves them |
| `severity` | `"HIGH"`, fixed | A fixed heuristic mapping for the hijack rule set (see the note below the table) |
| `confidence` | `"Medium"`, fixed | Same note |
| `file` | The tool name: `WebFetch`, `WebSearch`, or an MCP tool name of the form `mcp__<server>__<tool>` | The schema requires `file`, and a tool result has no file path, so the tool name stands in |
| `line` | `1` | The schema requires `line`, and a tool result has no line, so the value is fixed |
| `timestamp` | The UTC time the finding was recorded, ISO 8601 | Set by the hook at write time |
| `review_id` | The session id when it matches the id pattern; otherwise the field is omitted | The baseline counts a session as one review |
| `label` | Absent | The hook sets no label; only the user-run `scripts/label-findings.js` does (NFR-034) |

The `severity` and `confidence` values are a fixed heuristic mapping for the hijack rule set, not values drawn from the severity policy (`rules/severity-policy.md`): the rules of `hooks/lib/hijack-rules.js` carry no severity or confidence of their own, so the hook sets the same pair on every goal-guard finding (a goal hijack in tool output is high impact, and the rule set is a heuristic signal). The pair feeds baseline labeling only. It does not drive `goal-guard`'s block decision, which the rule-mode store alone gates, and the user's labels, not these values, decide the precision.

The hook writes one finding per result, for the first matching rule. A pass (no hijack rule matched) and a fail-closed withhold (an evaluation failure, not a hijack match) write no finding. The finding never carries the matched text, the result text, a URL, or a query, the same privacy rule the existing audit-log would-deny and pass records follow (NFR-031).

The store `.agent/governance/review-findings.jsonl` is the one `code-scan` writes and is not an FR-245 protected path (FR-245 Origin). This is the write FR-238 requires of an advisory-first check ("record every finding, and produce a baseline report"): the user labels the goal-guard findings true or false with `scripts/label-findings.js`, `scripts/baseline-report.js` computes the precision over the baseline window from those user-set labels only, and `scripts/promote-rule.js` gates a goal-guard promotion on that precision (at least 90%, NFR-034). Reading the store and acting on a blocking mode is unchanged (Requirement: Mode read from the rule-mode store, promotion disabled this release); this requirement adds only the advisory record the gate reads.

##### Scenario: Advisory hijack writes a baseline finding

- **GIVEN** the rule-mode store is absent or marks `goal-guard` advisory and a fetched page tells the agent to send repository files to a URL
- **WHEN** the WebFetch result reaches the hook and a hijack rule matches
- **THEN** the hook SHALL append a finding to `.agent/governance/review-findings.jsonl` whose `rule_id` is `"goal-guard"` and whose `hijack_rule_id` is the id of the matching hijack rule
- **AND** the finding SHALL carry `severity` `"HIGH"`, `confidence` `"Medium"`, `file` equal to the tool name (`WebFetch`), and `line` 1, and SHALL carry no `label`
- **AND** the finding SHALL NOT carry the matched text, the result text, a URL, or a query
- **AND** the hook SHALL also record its governance audit-log would-deny record and withhold nothing

##### Scenario: Finding groups under the rule-mode key

- **GIVEN** an advisory `WebFetch` result that matches the hijack rule `go-ignore-previous` and is recorded as a finding
- **WHEN** `scripts/baseline-report.js --rule goal-guard` or `scripts/promote-rule.js goal-guard` reads `review-findings.jsonl`
- **THEN** the script SHALL count that finding under `goal-guard`, because the finding's `rule_id` is `"goal-guard"`
- **AND** the finding's `rule_id` SHALL NOT be `go-ignore-previous`, which appears only in `hijack_rule_id` (and as the audit record's `rule_id`)

##### Scenario: review_id follows the session id

- **GIVEN** an advisory hijack match in a session whose id matches the id pattern, and a second match in a session whose id does not
- **WHEN** the hook writes each finding
- **THEN** the first finding SHALL carry `review_id` equal to the session id
- **AND** the second finding SHALL omit `review_id`

##### Scenario: Benign result writes no finding

- **GIVEN** a fetched page holds only documentation text
- **WHEN** the result reaches the hook and no hijack rule matches
- **THEN** the hook SHALL write no finding to `.agent/governance/review-findings.jsonl`
- **AND** the hook SHALL record its governance audit-log pass record

##### Scenario: Findings-write makes goal-guard promotable

- **GIVEN** `goal-guard` has recorded advisory findings over the baseline window and the user has labelled them true or false with `scripts/label-findings.js`
- **WHEN** the user runs `scripts/baseline-report.js` and then `scripts/promote-rule.js goal-guard`
- **THEN** `promote-rule.js` SHALL read a non-empty goal-guard baseline from `review-findings.jsonl` and SHALL NOT refuse on an absent baseline
- **AND** the switch SHALL still be gated on an approved policy and a precision of at least 90% (NFR-034)

##### Scenario: Without the findings-write promotion refuses

- **GIVEN** a build in which `goal-guard` records only to the governance audit log and writes no finding to `review-findings.jsonl`
- **WHEN** the user runs `scripts/promote-rule.js goal-guard`
- **THEN** the switch SHALL be refused with the missing-baseline reason, because the baseline the gate reads is the findings store and not the audit log

#### Requirement: Rule-mode store key for goal-guard is the flat key "goal-guard"

The mode of the goal-hijack check in the rule-mode store `.agent/governance/rule-modes.json` SHALL be the single flat key `"goal-guard"`, which `scripts/promote-rule.js` sets to `"blocking"` by writing `{"goal-guard": "blocking"}` on a promotion; the per-hijack-rule id is carried in the audit would-deny record as its `rule_id` and in the baseline finding as `hijack_rule_id`, and is not a rule-mode key, while the baseline finding's own `rule_id` is the same flat key `"goal-guard"`.

**Requirement refs:** FR-219, FR-238 | **Status:** Planned (harness-governance Tranche 5) | **Source:** `DECISIONS.md`, 2026-11-13, "FR-219 completed end-to-end (goal-guard writes advisory findings for the promotion baseline)" ("The rule-mode store key for goal-guard is the flat key \"goal-guard\" (promote-rule.js writes {\"goal-guard\": \"blocking\"}); the per-hijack-rule id stays the audit rule_id"); spec-hooks-code-scan.md, Requirement: Rule-mode store governs advisory versus blocking

`goal-guard` is governed as one check, so one rule-mode key covers it; the many hijack rules of `hooks/lib/hijack-rules.js` are not promoted one at a time. The promotion scripts look findings up by that same key: `baseline-report.js` and `promote-rule.js` match a finding's `rule_id` to the store key, so the baseline finding carries `"goal-guard"` as its `rule_id` and keeps the matching hijack rule in `hijack_rule_id` (Requirement: Advisory would-deny finding written to the baseline store). The DECISIONS.md line cited above names the audit `rule_id`, which stays the per-hijack id. The key sits in the same flat store `code-scan` reads (spec-hooks-code-scan.md), where an absent key, any value other than `"blocking"`, a non-object, or malformed JSON reads as advisory and never fails open into blocking (Requirement: Mode read from the rule-mode store, promotion disabled this release).

##### Scenario: promote-rule writes the flat goal-guard key

- **GIVEN** an approved policy and a goal-guard baseline at or above 90% precision
- **WHEN** the user runs `scripts/promote-rule.js goal-guard`
- **THEN** the rule-mode store SHALL hold `{"goal-guard": "blocking"}` for the check
- **AND** no per-hijack rule id (the audit `rule_id` or the finding's `hijack_rule_id`) SHALL appear as a rule-mode key

#### Requirement: Findings keep accruing in blocking mode

The `goal-guard` hook SHOULD continue to record a would-deny finding to `.agent/governance/review-findings.jsonl` on each hijack-rule match while its mode is blocking, so findings keep accruing for review after a promotion.

**Requirement refs:** FR-238, NFR-034 | **Status:** Planned (harness-governance Tranche 5) | **Source:** `DECISIONS.md`, 2026-11-13, "FR-219 completed end-to-end (goal-guard writes advisory findings for the promotion baseline)"; FR-NFR-harness-governance.md v1.3, FR-238 (section 2.25); spec-hooks-code-scan.md, Requirement: Advisory baseline and precision from user labels

The baseline that gates a promotion under FR-238 and NFR-034 is the advisory-period precision: `scripts/baseline-report.js` and `scripts/promote-rule.js` read the findings the hook recorded while the check was advisory and the user labelled. A blocking-mode finding is recorded and labelled the same way, but it feeds ongoing monitoring, not the promotion gate that a promotion has already cleared. Recording in blocking mode is additive: it changes neither the blocking-mode audit-log deny record nor the `updatedToolOutput` withhold (Requirement: Blocking-mode result withhold via PostToolUse `updatedToolOutput`) and neither the advisory fail-open nor the blocking fail-closed behavior (Requirement: Fail closed for the guarded class in blocking mode). A build that records findings in advisory mode only still satisfies FR-238, because the gate reads the advisory baseline; recording in both modes is the recommended default so post-promotion findings are not lost.

##### Scenario: Blocking-mode hijack records a finding

- **GIVEN** the rule-mode store marks `goal-guard` blocking and a fetched page tells the agent to send repository files to a URL
- **WHEN** the WebFetch result reaches the hook and a hijack rule matches
- **THEN** the hook SHOULD append a finding to `.agent/governance/review-findings.jsonl` with the same fields as an advisory finding: `rule_id` `"goal-guard"`, `hijack_rule_id`, `severity` `"HIGH"`, `confidence` `"Medium"`, `file` the tool name, and `line` 1
- **AND** the hook SHALL still withhold the result through `updatedToolOutput` and record its blocking-mode audit-log deny record

##### Scenario: The promotion gate reads the advisory baseline

- **GIVEN** `goal-guard` has recorded findings in both advisory and blocking periods
- **WHEN** `scripts/promote-rule.js goal-guard` evaluates a promotion
- **THEN** the precision bar SHALL be computed over the advisory-period findings the user labelled, the baseline FR-238 requires, not over blocking-mode findings alone

### MODIFIED Requirements

None. The existing audit-log record requirement (Requirement: Fails open and records to the audit log) is unchanged; the findings-write is an added, separate record, and the lines that read as audit-log-only are qualified above under "Body text this entry supersedes".

### REMOVED Requirements

None.

### Traceability added

| Requirement | Spec section | Verified by |
|---|---|---|
| FR-219, FR-238 | Change Log 2026-11-13 (Tranche 5, FR-219 end-to-end): Requirement: Advisory would-deny finding written to the baseline store | An advisory hijack match writes a finding to `review-findings.jsonl` with `rule_id` `"goal-guard"`, `hijack_rule_id`, `severity` `"HIGH"`, `confidence` `"Medium"`, `file` the tool name, `line` 1, `review_id` from the session id when it fits the id pattern, no `label`, and no matched, result, URL, or query text; the finding groups under `goal-guard` in the baseline; a benign result writes none (`tests/hooks/goal-guard.test.js`, Step 9) |
| FR-238, NFR-034 | Change Log 2026-11-13 (Tranche 5, FR-219 end-to-end): Requirement: Advisory would-deny finding written to the baseline store | With the findings-write `promote-rule.js goal-guard` reads a non-empty baseline and is gated on the 90% precision bar; without it the switch refuses with the missing-baseline reason (`tests/hooks/goal-guard.test.js`, `tests/scripts/promote-rule.test.js`) |
| FR-219, FR-238 | Change Log 2026-11-13 (Tranche 5, FR-219 end-to-end): Requirement: Rule-mode store key for goal-guard is the flat key "goal-guard" | `promote-rule.js goal-guard` writes `{"goal-guard": "blocking"}`; no per-hijack id is a rule-mode key, and the baseline finding's `rule_id` equals the key `"goal-guard"` so `baseline-report.js` and `promote-rule.js` find the findings (`tests/scripts/promote-rule.test.js`, `tests/hooks/goal-guard.test.js`) |
| FR-238, NFR-034 | Change Log 2026-11-13 (Tranche 5, FR-219 end-to-end): Requirement: Findings keep accruing in blocking mode | A blocking-mode hijack match records a finding, and the promotion gate computes precision over the advisory-period baseline (`tests/hooks/goal-guard.test.js`) |

## Change Log: 2026-11-14 (goal-guard blocking-mode fail-closed hardening)

**Source:** FR-NFR-harness-governance.md v1.3 (2026-10-30): FR-219 (section 2.6), NFR-028 (section 3.2, "MUST deny its own guarded operation class when it cannot evaluate because of an error or timeout"; the enumeration now names FR-219 in blocking mode only), NFR-031 (section 3.2, "Logs MUST NOT hold prompt text, file contents, or secret values"); `DECISIONS.md`, 2026-11-13, "Harness-governance Tranche 5 (control register) built, gated, merged, and released as v1.14.0" (the deferred follow-up: the goal-guard fail-closed structural-field residual where a short url or title can survive a fail-closed withhold because the rules that would flag it are the ones that failed, and the clone breadth cap and the `collectText` depth-6 versus clone depth-32 mismatch, to be reconsidered, for example by blanking every string on fail-closed, when Step 36 makes the vector live); `DECISIONS.md`, 2026-11-14, "goal-guard blocking-mode fail-closed hardening approved for build" (choice 1, blank scope; choice 2, caps scope). This entry hardens the blocking-mode withhold the earlier Tranche 5 deltas specified (Requirement: Blocking-mode result withhold via PostToolUse `updatedToolOutput`, Requirement: Fail closed for the guarded class in blocking mode). It touches only the blocking-mode paths: advisory mode still fails open and withholds nothing, promotion stays user-run (`scripts/promote-rule.js`), and the audit and finding records are unchanged (NFR-031; a fail-closed withhold still writes no finding, Requirement: Advisory would-deny finding written to the baseline store). This spec received a delta, so its Status stays `Review` (delta rule 6, no same-turn approval).

### Direct edits in this pass (no behavior change)

- Requirement refs: NFR-031 added, for the data-minimization rule the unchanged audit and finding records and the no-finding-on-fail-closed behavior follow; the basis is `DECISIONS.md`, 2026-11-14, "goal-guard blocking-mode fail-closed hardening approved for build" ("the audit and finding records are unchanged (NFR-031)"). NFR-031 governs logs and the data-accessed field, so it does not anchor the model-facing blanked `updatedToolOutput`; that property rests on FR-219 and NFR-028. FR-219 and NFR-028 (blocking mode) are already present.

### Body text this entry supersedes (applied at the next fold)

- Change Log 2026-11-13 (Tranche 5), Requirement: Blocking-mode result withhold via PostToolUse `updatedToolOutput`, the sentence "Withholding replaces the result with a short safe notice that names the rule id; rewriting strips the hijack span and keeps the benign remainder": now reads that the withhold and the rewrite are built as a structure-preserving clone bounded to the alignment-check scan depth and the scan's per-level item cap (Requirement: Depth- and breadth-bounded shape-preserving withhold clone), so the benign remainder a rewrite keeps is bounded by the same depth and breadth the scan read, and content past the scan depth or the item cap no longer survives on a blocking match. The "names the rule id" part of the notice is unchanged.
- Change Log 2026-11-13 (Tranche 5), Requirement: Fail closed for the guarded class in blocking mode (statement and the scenario Evaluation error in blocking mode withholds), the clause "it SHALL withhold that result through `updatedToolOutput`": refined to the blank-all-text scope of the MODIFIED requirement below. On a fail-closed withhold the hook replaces every attacker-controllable text string in the cloned result with the safe notice, not only the body-text fields, because it cannot trust any part of a result it could not finish evaluating. The advisory-mode scenario Evaluation error in advisory mode passes through is unchanged.
- Change Log 2026-11-13 (Tranche 5), Requirement: Fail closed for the guarded class in blocking mode, the sentence "The NFR-028 enumeration in FR-NFR-harness-governance.md (section 3.2) names FR-214, FR-217, FR-220, FR-223, FR-231, FR-233, and FR-246 and does not yet list FR-219; that enumeration is updated to add FR-219 (blocking mode) in the Tranche 5 documentation sync (task plan Step 8), so this spec does not claim the enumeration already lists it"; and the matching clauses in the Change Log 2026-11-13 (Tranche 5) preamble, in the Change Log 2026-11-13 (Tranche 5) "Body text this entry supersedes" FR-219-not-a-member bullet's final enumeration sentence (its "until that sync lands the enumeration does not list it" clause), and in the Change Log 2026-11-13 (Tranche 5) traceability row for NFR-028: superseded. The Tranche 5 documentation sync has landed (`DECISIONS.md`, 2026-11-13, "Harness-governance Tranche 5 ... released as v1.14.0": "the FR-NFR status flipped to Approved with FR-219 added to the NFR-028 enumeration"), so the NFR-028 enumeration in FR-NFR-harness-governance.md section 3.2 now names FR-219 in blocking mode only (FR-NFR-harness-governance.md revision history note 4, 2026-11-13). Advisory mode still fails open per NFR-026.

### ADDED Requirements

#### Requirement: Depth- and breadth-bounded shape-preserving withhold clone

While its mode is blocking, the `goal-guard` hook SHALL build the withheld or rewritten tool output as a structure-preserving clone that recurses no deeper than the alignment-check scan (`collectText`) reads, clones no more items per level than the scan's per-level item cap, replaces each item past that cap with the safe notice rather than dropping it so every array keeps its original length, and keeps each fixed-vocabulary shape-discriminator key (for example an MCP content block's `type`, and the like such as `mimeType` and `role`) unchanged, so the result still validates against its tool's output shape and Claude Code does not silently ignore the `updatedToolOutput`. This depth and breadth bound SHALL apply to both the blocking-match withhold and the fail-closed withhold.

**Requirement refs:** FR-219, NFR-028 | **Status:** Planned (goal-guard blocking-mode fail-closed hardening) | **Source:** FR-NFR-harness-governance.md v1.3, FR-219 (section 2.6), NFR-028 (section 3.2); `DECISIONS.md`, 2026-11-13, "Harness-governance Tranche 5 ... released as v1.14.0" (the deferred follow-up naming the clone breadth cap and the `collectText` depth-6 versus clone depth-32 mismatch, and the as-built shape-preserving `updatedToolOutput` clone); `DECISIONS.md`, 2026-11-14, "goal-guard blocking-mode fail-closed hardening approved for build" (choice 2, caps scope)

The Tranche 5 build already withholds through a shape-preserving `updatedToolOutput` clone, because Claude Code silently ignores an `updatedToolOutput` whose shape does not match the tool's real output and the result then reaches the model (a silent fail-open). This hardening bounds that clone. Depth parity aligns the clone recursion with `collectText`: the as-built clone recursed to depth 32 while the scan read to depth 6, so structured content between those depths was cloned but never scanned. The breadth cap adds the matching per-level item cap, keeping array lengths by substituting the safe notice for each over-cap item. Applying the bound to the blocking-match path as well as the fail-closed path is a deliberate behavior change: content past the scan depth or the item cap no longer survives on a blocking match, where it survived before. The rationale is that content the scanner never read must not survive in a result the hook has already judged hostile. The fail-closed path adds the blank-all-text scope (Requirement: Fail closed for the guarded class in blocking mode); the depth and breadth bound here is shared by both paths and is the only part that changes the match path.

##### Scenario: Result wider than the item cap stays bounded

- **GIVEN** the rule-mode store marks `goal-guard` blocking and a tool result holds an array with more items than the scan's per-level item cap, one of them a hijack
- **WHEN** the hook builds the withheld result
- **THEN** the hook SHALL clone no more items per level than the scan's item cap
- **AND** the hook SHALL replace each item past the cap with the safe notice so the array keeps its original length
- **AND** the hook SHALL NOT emit an array shorter than the tool's real output

##### Scenario: Content past the scan depth does not survive a blocking match

- **GIVEN** `goal-guard` is blocking and a hijack rule matches a result that also carries structured content nested deeper than the `collectText` scan depth
- **WHEN** the hook rewrites or withholds the result through `updatedToolOutput`
- **THEN** the emitted clone SHALL carry no content from below the scan depth
- **AND** the clone SHALL keep the shape-discriminator keys so the result still validates against the tool's output shape

##### Scenario: Content past the scan depth is blanked on a fail-closed withhold

- **GIVEN** `goal-guard` is blocking and the alignment check throws or times out after reading a result that carries structured content nested deeper than the `collectText` scan depth
- **WHEN** the hook fails closed and withholds the result through `updatedToolOutput`
- **THEN** the emitted clone SHALL carry no content from below the scan depth
- **AND** every attacker-controllable text string the clone does carry SHALL be the safe notice

##### Scenario: Real tool output validates after blanking

- **GIVEN** a real `WebFetch`, `WebSearch`, and MCP tool output
- **WHEN** the hook blanks each through the withhold clone
- **THEN** each blanked result SHALL validate against its tool's output shape
- **AND** Claude Code SHALL NOT silently ignore the `updatedToolOutput` and pass the original result to the model

### MODIFIED Requirements

#### Requirement: Fail closed for the guarded class in blocking mode

**Was:** While its mode is blocking, the `goal-guard` hook SHALL fail closed for its guarded class: when it errors or times out after reading its input on a result it cannot finish evaluating (a would-block result), it SHALL withhold that result through `updatedToolOutput` rather than pass it through; in advisory mode the hook SHALL continue to fail open and withhold nothing.

**Now:** While its mode is blocking, the `goal-guard` hook SHALL fail closed for its guarded class: when it errors or times out after reading its input on a result it cannot finish evaluating (a would-block result), it SHALL withhold that result through `updatedToolOutput` rather than pass it through, replacing every attacker-controllable text string in the structure-preserving clone (Requirement: Depth- and breadth-bounded shape-preserving withhold clone) with the safe notice, not only the body-text fields; in advisory mode the hook SHALL continue to fail open and withhold nothing.

**Reason:** `DECISIONS.md`, 2026-11-14, "goal-guard blocking-mode fail-closed hardening approved for build" (choice 1): on a fail-closed withhold the hook cannot trust any part of a result it could not finish evaluating, and the withheld result already carries a do-not-act notice, so it blanks every attacker-controllable string rather than only the body-text fields. This closes the fail-closed structural-field residual the Tranche 5 completion recorded, where a short url or title could survive a fail-closed withhold because the rules that would flag it were the ones that failed. The match-path rewrite still strips the hijack span and keeps the bounded benign remainder; blank-all-text is the fail-closed path only.

**Requirement refs:** NFR-028, FR-219, NFR-031 (NFR-031 only for the unchanged audit and finding records and the no-finding-on-fail-closed behavior, not for the blanked `updatedToolOutput`) | **Status:** Planned (goal-guard blocking-mode fail-closed hardening)

The blanked result keeps only the safe notice as its text, so the withhold removes every attacker-controllable text string, and with it any prompt text, file contents, or secret value the result carried, from what the model sees (FR-219; NFR-028 for a result the hook could not finish evaluating). NFR-031 governs logs and the data-accessed field, so it is not the anchor for this model-facing result. NFR-031 anchors the records this change leaves unchanged: a fail-closed withhold is an evaluation failure, not a hijack match, so it still writes no finding to the baseline store (Requirement: Advisory would-deny finding written to the baseline store), and the audit and finding records hold no prompt text, file contents, or secret value (NFR-031). The scenarios Evaluation error in blocking mode withholds and Evaluation error in advisory mode passes through stay in force; the advisory-mode scenario is unchanged, and the blocking-mode scenario now also blanks every attacker-controllable string per the scenario below.

##### Scenario: Hijack in a short structural field is blanked on fail-closed

- **GIVEN** `goal-guard` is blocking, the alignment check throws or times out after reading a result, and the result carries a hijack in a short structural field such as a title or a url rather than in the body text
- **WHEN** the hook fails closed and withholds the result through `updatedToolOutput`
- **THEN** the hook SHALL replace that title or url, and every other attacker-controllable text string, with the safe notice
- **AND** the hook SHALL keep the shape-discriminator keys so the result still validates against the tool's output shape
- **AND** the withheld result SHALL carry no prompt text, file contents, or secret value (FR-219, NFR-028)

### REMOVED Requirements

None.

### Diagram

Not re-rendered in this pass. The hardening changes the blocking-mode withhold internals, not the advisory start-to-end flow the Algorithmic steps diagram shows. The `.mmd` source and PNG are re-rendered at the next fold with the other deferred diagram edits.

### Traceability added

| Requirement | Spec section | Verified by |
|---|---|---|
| FR-219, NFR-028 | Change Log 2026-11-14 (goal-guard blocking-mode fail-closed hardening): Requirement: Depth- and breadth-bounded shape-preserving withhold clone | A result wider than the item cap stays bounded with its array length kept; content past the `collectText` scan depth does not survive on a blocking match or a fail-closed withhold; a real `WebFetch`, `WebSearch`, and MCP output still validates against its tool shape after blanking (`tests/hooks/goal-guard.test.js`) |
| NFR-028, FR-219 | Change Log 2026-11-14 (goal-guard blocking-mode fail-closed hardening): Requirement: Fail closed for the guarded class in blocking mode | A fail-closed withhold replaces every attacker-controllable string, including a short title or url, with the safe notice and still emits a shape-valid `updatedToolOutput`; the blanked withheld result holds only the safe notice and no prompt, file, or secret text (`tests/hooks/goal-guard.test.js`) |
| NFR-031 | Change Log 2026-11-14 (goal-guard blocking-mode fail-closed hardening): Requirement: Fail closed for the guarded class in blocking mode | A fail-closed withhold writes no finding, and the audit and finding records hold no prompt, file, or secret text, unchanged by this hardening (`tests/hooks/goal-guard.test.js`) |

## Change Log: 2026-11-14 (goal-guard fail-closed MCP discriminator and key-name hardening)

**Source:** FR-NFR-harness-governance.md v1.3 (2026-10-30): FR-219 (section 2.6), NFR-028 (section 3.2, "MUST deny its own guarded operation class when it cannot evaluate because of an error or timeout"; the enumeration names FR-219 in blocking mode only), NFR-031 (section 3.2, "Logs MUST NOT hold prompt text, file contents, or secret values"); `DECISIONS.md`, 2026-11-14, "goal-guard fail-closed MCP discriminator and key-name hardening folded in" (the basis: the OWASP for LLM review of the fail-closed hardening code found that keeping shape-discriminator values and object key names verbatim on the fail-closed blank-all path lets attacker goal-hijack text survive for an MCP tool, because the MCP server is itself the untrusted source and Claude Code does not validate MCP output shape, so the shape-preservation justification that holds for `WebFetch` and `WebSearch` does not apply to MCP); `DECISIONS.md`, 2026-11-14, "goal-guard blocking-mode fail-closed hardening approved for build" (the prior blocking-mode fail-closed hardening this entry refines). This entry refines the blocking-mode fail-closed withhold the prior section (Change Log 2026-11-14, goal-guard blocking-mode fail-closed hardening) specified: it adds a tool-class split on the fail-closed blank-all path so that, for an `mcp__*` tool, the withhold also blanks the shape-discriminator values (`type`, `mimeType`, `role`) and the object key names, while the existing carve-out that keeps those keys, their values, and the object key names verbatim is kept for `WebFetch` and `WebSearch`, where Claude Code validates the output shape and those fields are not attacker-controllable.

This entry touches only the fail-closed blank-all path in blocking mode. The blocking-MATCH path (the bounded strip-the-span rewrite) is unchanged, as are the depth parity and the breadth/item cap on both paths, and the blank-all-text scope for ordinary string fields (already blanked for all tools). Advisory mode is unchanged: it fails open and withholds nothing. The governance audit-log and the baseline finding-store records are unchanged (NFR-031), and a fail-closed withhold still writes no finding (an evaluation failure is not a hijack match). Blocking mode is off by default this release; the vector goes live only at the user-run Step 36 promotion (`scripts/promote-rule.js`). This spec received a delta, so its Status stays `Review` (delta rule 6, no same-turn approval).

### Direct edits in this pass (no behavior change)

- Requirement refs: unchanged. FR-219, NFR-028, and NFR-031 are already present (added in the Change Log 2026-11-13 (Tranche 5) and Change Log 2026-11-14 (goal-guard blocking-mode fail-closed hardening) sections). This entry adds no new ID.

### Body text this entry supersedes (applied at the next fold)

- Change Log 2026-11-14 (goal-guard blocking-mode fail-closed hardening), Requirement: Fail closed for the guarded class in blocking mode, the scenario Hijack in a short structural field is blanked on fail-closed, the clause "the hook SHALL keep the shape-discriminator keys so the result still validates against the tool's output shape": now tool-class-dependent on the fail-closed path. It holds for a `WebFetch` or `WebSearch` result, whose output shape Claude Code validates; for an `mcp__*` result the hook instead blanks the discriminator values (`type`, `mimeType`, `role`) and the object key names, because Claude Code does not validate MCP output shape and the MCP server is the untrusted source (Requirement: Fail closed for the guarded class in blocking mode, as modified below; Requirement: Depth- and breadth-bounded shape-preserving withhold clone, as modified below).
- Change Log 2026-11-14 (goal-guard blocking-mode fail-closed hardening), Requirement: Depth- and breadth-bounded shape-preserving withhold clone, the scenario Real tool output validates after blanking, the step "each blanked result SHALL validate against its tool's output shape": now tool-class-dependent. A blanked `WebFetch` or `WebSearch` result still validates against its tool's output shape; a blanked `mcp__*` result instead forms a usable, well-formed withheld result the model receives in place of the original, because Claude Code does not validate MCP output shape (so there is no shape-validation fail-open to preserve for MCP). The clause "Claude Code SHALL NOT silently ignore the `updatedToolOutput`" is unchanged for every tool.

### ADDED Requirements

None.

### MODIFIED Requirements

#### Requirement: Depth- and breadth-bounded shape-preserving withhold clone

**Was:** While its mode is blocking, the `goal-guard` hook SHALL build the withheld or rewritten tool output as a structure-preserving clone that recurses no deeper than the alignment-check scan (`collectText`) reads, clones no more items per level than the scan's per-level item cap, replaces each item past that cap with the safe notice rather than dropping it so every array keeps its original length, and keeps each fixed-vocabulary shape-discriminator key (for example an MCP content block's `type`, and the like such as `mimeType` and `role`) unchanged, so the result still validates against its tool's output shape and Claude Code does not silently ignore the `updatedToolOutput`. This depth and breadth bound SHALL apply to both the blocking-match withhold and the fail-closed withhold.

**Now:** While its mode is blocking, the `goal-guard` hook SHALL build the withheld or rewritten tool output as a structure-preserving clone that recurses no deeper than the alignment-check scan (`collectText`) reads, clones no more items per level than the scan's per-level item cap, and replaces each item past that cap with the safe notice rather than dropping it so every array keeps its original length. On the blocking-match path for every tool, and on the fail-closed path for a `WebFetch` or `WebSearch` result, the clone SHALL keep each fixed-vocabulary shape-discriminator key `type`, `mimeType`, and `role`, their values, and each object key name unchanged, so the result still validates against its tool's output shape and Claude Code does not silently ignore the `updatedToolOutput`; on the fail-closed path for an `mcp__*` tool, whose output shape Claude Code does not validate, the clone SHALL instead replace the discriminator values (`type`, `mimeType`, `role`) and the object key names with the safe notice, and the emitted clone SHALL remain well-formed so Claude Code does not silently ignore the `updatedToolOutput`. This depth and breadth bound SHALL apply to both the blocking-match withhold and the fail-closed withhold.

**Reason:** `DECISIONS.md`, 2026-11-14, "goal-guard fail-closed MCP discriminator and key-name hardening folded in": the shape-discriminator-key carve-out was justified by Claude Code validating the tool's output shape, which holds for the built-in `WebFetch` and `WebSearch` tools but not for an `mcp__*` tool, whose output shape Claude Code does not validate and whose server is the untrusted source. Keeping the discriminator values and object key names verbatim for MCP therefore left a channel for attacker goal-hijack text to survive a fail-closed withhold. The carve-out is now scoped to the built-in tools on the fail-closed path; for MCP the fail-closed path also blanks the discriminator values and the object key names. The blocking-match path, the `collectText` depth parity, and the per-level item (breadth) cap are unchanged, and the carve-out on the blocking-match path is unchanged for every tool.

**Requirement refs:** FR-219, NFR-028 | **Status:** Planned (goal-guard fail-closed MCP discriminator and key-name hardening)

The fail-closed split closes two residual channels for an MCP result: the discriminator-value channel (an MCP server that sets `type`, `mimeType`, or `role` to hijack text) and the object-key-name channel (an MCP server that sets a key name to hijack text). Because Claude Code does not validate MCP output shape, blanking these fields on the fail-closed path raises no silent fail-open risk; for `WebFetch` and `WebSearch`, whose shape Claude Code validates, the same fields are not attacker-controllable and stay verbatim, so the result still validates and Claude Code does not pass the original to the model. The scenarios Result wider than the item cap stays bounded, Content past the scan depth does not survive a blocking match, and Content past the scan depth is blanked on a fail-closed withhold are unchanged.

##### Scenario: WebFetch result keeps discriminators and key names verbatim on fail-closed

- **GIVEN** the rule-mode store marks `goal-guard` blocking and the alignment check throws or times out after reading a `WebFetch` result that carries a hijack
- **WHEN** the hook fails closed and withholds the result through `updatedToolOutput`
- **THEN** the clone SHALL keep the shape-discriminator keys `type`, `mimeType`, and `role`, their values, and every object key name verbatim
- **AND** the withheld result SHALL still validate against the `WebFetch` output shape so Claude Code does not silently ignore the `updatedToolOutput` and pass the original to the model
- **AND** every ordinary attacker-controllable text string value the clone carries SHALL be the safe notice

##### Scenario: Real MCP output forms a usable withheld result after the broader blanking

- **GIVEN** a real `mcp__<server>__<tool>` output
- **WHEN** the hook fails closed and blanks the output through the withhold clone, blanking the discriminator values (`type`, `mimeType`, `role`) and the object key names as well as the ordinary string values
- **THEN** the emitted `updatedToolOutput` SHALL be a well-formed value the model receives as the tool result in place of the original
- **AND** every attacker-controllable string the clone carries, including each former discriminator value and each former object key name, SHALL be the safe notice
- **AND** Claude Code SHALL NOT silently ignore the `updatedToolOutput`

#### Requirement: Fail closed for the guarded class in blocking mode

**Was:** While its mode is blocking, the `goal-guard` hook SHALL fail closed for its guarded class: when it errors or times out after reading its input on a result it cannot finish evaluating (a would-block result), it SHALL withhold that result through `updatedToolOutput` rather than pass it through, replacing every attacker-controllable text string in the structure-preserving clone (Requirement: Depth- and breadth-bounded shape-preserving withhold clone) with the safe notice, not only the body-text fields; in advisory mode the hook SHALL continue to fail open and withhold nothing.

**Now:** While its mode is blocking, the `goal-guard` hook SHALL fail closed for its guarded class: when it errors or times out after reading its input on a result it cannot finish evaluating (a would-block result), it SHALL withhold that result through `updatedToolOutput` rather than pass it through, replacing every attacker-controllable text string in the structure-preserving clone (Requirement: Depth- and breadth-bounded shape-preserving withhold clone) with the safe notice, not only the body-text fields; for a `WebFetch` or `WebSearch` result the clone SHALL keep the shape-discriminator keys `type`, `mimeType`, and `role`, their values, and the object key names verbatim, because Claude Code validates those built-in tools' output shape and those fields are not attacker-controllable; for an `mcp__*` tool, whose output shape Claude Code does not validate and whose server is the untrusted source, the fail-closed blank-all withhold SHALL also replace the discriminator values (`type`, `mimeType`, `role`) and the object key names with the safe notice; in advisory mode the hook SHALL continue to fail open and withhold nothing.

**Reason:** `DECISIONS.md`, 2026-11-14, "goal-guard fail-closed MCP discriminator and key-name hardening folded in": on a fail-closed withhold the hook cannot trust any part of a result it could not finish evaluating, and for an MCP tool the discriminator values and object key names are attacker-controllable (the MCP server sets them) and Claude Code does not validate MCP output shape, so blanking them closes the residual hijack channel without a shape-validation fail-open. The `WebFetch` and `WebSearch` carve-out stays, because Claude Code validates those shapes and the fields are not attacker-controllable. The blank-all-text scope for ordinary string fields, the depth parity, and the breadth cap are unchanged.

**Requirement refs:** NFR-028, FR-219, NFR-031 (NFR-031 only for the unchanged audit and finding records and the no-finding-on-fail-closed behavior, not for the blanked `updatedToolOutput`) | **Status:** Planned (goal-guard fail-closed MCP discriminator and key-name hardening)

For an `mcp__*` result the blanked withhold removes every attacker-controllable text string, including each discriminator value and each object key name, from what the model sees, so no prompt text, file contents, or secret value in any of those fields survives (FR-219; NFR-028 for a result the hook could not finish evaluating). NFR-031 is unaffected by this split: a fail-closed withhold is an evaluation failure, not a hijack match, so it still writes no finding to the baseline store (Requirement: Advisory would-deny finding written to the baseline store), and the audit and finding records hold no prompt text, file contents, or secret value (NFR-031). The scenarios Evaluation error in blocking mode withholds, Evaluation error in advisory mode passes through, and Hijack in a short structural field is blanked on fail-closed stay in force; the advisory-mode scenario is unchanged, and the short-structural-field scenario's discriminator-key clause is now tool-class-dependent per the supersedes list above and the two scenarios below.

##### Scenario: Hijack in an MCP discriminator value is blanked on fail-closed

- **GIVEN** the rule-mode store marks `goal-guard` blocking and the alignment check throws or times out after reading an `mcp__<server>__<tool>` result whose `type`, `mimeType`, or `role` value carries hijack text
- **WHEN** the hook fails closed and withholds the result through `updatedToolOutput`
- **THEN** the hook SHALL replace that discriminator value with the safe notice
- **AND** the withheld `mcp__*` result SHALL carry no prompt text, file contents, or secret value in any discriminator value (FR-219, NFR-028)

##### Scenario: Hijack in an MCP object key name is blanked on fail-closed

- **GIVEN** the rule-mode store marks `goal-guard` blocking and the alignment check throws or times out after reading an `mcp__<server>__<tool>` result that carries hijack text as an object key name
- **WHEN** the hook fails closed and withholds the result through `updatedToolOutput`
- **THEN** the hook SHALL replace that object key name with the safe notice, so the key name becomes the notice
- **AND** no attacker-controllable object key name from the MCP result SHALL survive in the withheld result

##### Scenario: WebFetch discriminator and key names survive the fail-closed blanking

- **GIVEN** the rule-mode store marks `goal-guard` blocking and the alignment check throws or times out after reading a `WebFetch` result whose body text carries a hijack and whose `type` and object key names are the tool's own fixed vocabulary
- **WHEN** the hook fails closed and withholds the result through `updatedToolOutput`
- **THEN** the hook SHALL replace the body text, and every other ordinary attacker-controllable string, with the safe notice
- **AND** the hook SHALL keep the `type`, `mimeType`, and `role` values and the object key names verbatim so the result still validates against the `WebFetch` output shape and Claude Code does not pass the original to the model

### REMOVED Requirements

None.

### Diagram

Not re-rendered in this pass. The split changes the fail-closed blank-all internals for an MCP result, not the advisory start-to-end flow the Algorithmic steps diagram shows. The `.mmd` source and PNG are re-rendered at the next fold with the other deferred diagram edits.

### Traceability added

| Requirement | Spec section | Verified by |
|---|---|---|
| FR-219, NFR-028 | Change Log 2026-11-14 (goal-guard fail-closed MCP discriminator and key-name hardening): Requirement: Depth- and breadth-bounded shape-preserving withhold clone | On a fail-closed withhold a `WebFetch` result keeps `type`, `mimeType`, `role`, their values, and object key names verbatim and still validates against the tool shape; a real `mcp__*` output blanks the discriminator values and object key names too and still forms a usable, well-formed withheld result Claude Code does not silently ignore (`tests/hooks/goal-guard.test.js`) |
| NFR-028, FR-219 | Change Log 2026-11-14 (goal-guard fail-closed MCP discriminator and key-name hardening): Requirement: Fail closed for the guarded class in blocking mode | On a fail-closed withhold an `mcp__*` result with a hijack in a `type`/`mimeType`/`role` value has that value blanked, and an `mcp__*` result with a hijack in an object key name has that key name blanked to the notice; a `WebFetch` result keeps its discriminators and key names verbatim (`tests/hooks/goal-guard.test.js`) |
| NFR-031 | Change Log 2026-11-14 (goal-guard fail-closed MCP discriminator and key-name hardening): Requirement: Fail closed for the guarded class in blocking mode | A fail-closed withhold still writes no finding, and the audit and finding records hold no prompt, file, or secret text, unchanged by the MCP split (`tests/hooks/goal-guard.test.js`) |

## Change Log: 2026-11-14 (goal-guard blocking-match MCP discriminator and key-name hardening)

**Source:** FR-NFR-harness-governance.md v1.3 (2026-10-30): FR-219 (section 2.6), NFR-028 (section 3.2, "MUST deny its own guarded operation class when it cannot evaluate because of an error or timeout"; the enumeration names FR-219 in blocking mode only), NFR-031 (section 3.2, "Logs MUST NOT hold prompt text, file contents, or secret values"); `DECISIONS.md`, 2026-11-14, "goal-guard blocking-match MCP discriminator and key-name hardening approved for build" (the basis: the user approved extending the MCP fail-closed tool-class split to the blocking-MATCH path, closing the match-path MCP residual tracked as follow-up 1 of the v1.14.1 completion entry; choice 1, MCP match scope; choice 2, scanner scope unchanged). This entry refines the two prior 2026-11-14 entries, Change Log 2026-11-14 (goal-guard blocking-mode fail-closed hardening) and Change Log 2026-11-14 (goal-guard fail-closed MCP discriminator and key-name hardening): it makes the blocking-MATCH path symmetric with the fail-closed path for an `mcp__*` tool, so that on a blocking hijack match the withhold clone also blanks the shape-discriminator values (`type`, `mimeType`, `role`) and renames the object key names, in addition to the existing replacement of the matched string value(s) with the safe notice. The carve-out that keeps those keys, their values, and the object key names verbatim is kept for `WebFetch` and `WebSearch` on both paths, where Claude Code validates the output shape and those fields are not attacker-controllable.

This entry changes only the blocking-MATCH path for an `mcp__*` tool. Ordinary string values on the match path keep the existing behavior, where the match path replaces the matched string value(s) and keeps the other, unmatched string values (not a full blank-all); only the discriminator values and the object key names change for MCP on a match. The fail-closed blank-all path (already blanking the MCP discriminator values and renaming the object key names per the prior section) is unchanged in behavior, as are the `collectText` depth parity, the per-level breadth/item cap, advisory mode (which fails open and withholds nothing), and the governance audit-log and baseline finding-store records (NFR-031). The as-built fail-closed rename is already position-based, collision-free, and key-count-preserving; this entry corrects the prior section's imprecise wording of that fail-closed key-name result (it reads as every key collapsing to the one safe notice) to match as-built, through the supersede entries below, and changes no behavior. The only behavior change in this entry is on the blocking-MATCH path. A blocking match still writes one finding; a fail-closed withhold still writes none. Blocking mode is off by default this release; the vector goes live only at the user-run Step 36 promotion (`scripts/promote-rule.js`). This spec received a delta, so its Status stays `Review` (delta rule 6, no same-turn approval).

### Direct edits in this pass (no behavior change)

- Requirement refs: unchanged. FR-219, NFR-028, and NFR-031 are already present (added in the Change Log 2026-11-13 (Tranche 5) and Change Log 2026-11-14 (goal-guard blocking-mode fail-closed hardening) sections). This entry adds no new ID.

### Body text this entry supersedes (applied at the next fold)

- Change Log 2026-11-14 (goal-guard fail-closed MCP discriminator and key-name hardening), the preamble's second paragraph (around line 647), which states that the blocking-MATCH path (the match-path rewrite of the matched string value(s)) is unchanged: superseded for an `mcp__*` tool. On the blocking-match path an `mcp__*` result now also has its discriminator values (`type`, `mimeType`, `role`) blanked and its object key names renamed, besides the existing replacement of the matched string value(s); the match path stays unchanged for `WebFetch` and `WebSearch`, and the depth parity and the breadth/item cap on both paths stay unchanged.
- Change Log 2026-11-14 (goal-guard fail-closed MCP discriminator and key-name hardening), Requirement: Depth- and breadth-bounded shape-preserving withhold clone, the "Now" clause (around line 668) that on the blocking-match path for every tool the clone keeps the shape-discriminator keys `type`, `mimeType`, and `role`, their values, and each object key name unchanged: superseded for an `mcp__*` tool. The verbatim-keep clause now holds for `WebFetch` and `WebSearch` on both paths; for an `mcp__*` tool the clone blanks the discriminator values and renames the object key names on the blocking-match path as well as the fail-closed path (Requirement: Depth- and breadth-bounded shape-preserving withhold clone, as modified below).
- Change Log 2026-11-14 (goal-guard fail-closed MCP discriminator and key-name hardening), Requirement: Depth- and breadth-bounded shape-preserving withhold clone, the "Reason" sentence (around line 670) that the carve-out on the blocking-match path is unchanged for every tool: superseded. The match-path carve-out is now unchanged only for `WebFetch` and `WebSearch`; for an `mcp__*` tool the match-path carve-out is dropped and the discriminator values and object key names are blanked, matching the fail-closed path.
- Change Log 2026-11-14 (goal-guard fail-closed MCP discriminator and key-name hardening), Requirement: Fail closed for the guarded class in blocking mode, the "Now" clause (around line 696) that for an `mcp__*` tool the fail-closed blank-all withhold replaces the object key names with the safe notice: the wording is superseded, the behavior is unchanged. The as-built fail-closed rename is position-based, collision-free, and key-count-preserving: the first key becomes the safe notice and each later key becomes the notice plus a distinct position index, so no original key text survives and the object keeps its key count. Read that clause's key-name wording as this rename. The discriminator-value clause (each `type`, `mimeType`, and `role` value becomes the safe notice) stands as written. The same loose key-name wording recurs in that section's Depth- and breadth-bounded shape-preserving withhold clone "Now" clause (around line 668, fail-closed half) and in its traceability row for the fail-closed requirement (around line 738), and is superseded the same way.
- Change Log 2026-11-14 (goal-guard fail-closed MCP discriminator and key-name hardening), Requirement: Depth- and breadth-bounded shape-preserving withhold clone, the scenario Real MCP output forms a usable withheld result after the broader blanking, the clause (around line 689) that each former object key name SHALL be the safe notice: the wording is superseded, the behavior is unchanged. Each former key name is replaced by the position-based rename (the first key the safe notice, each later key the notice plus a distinct position index), so the withheld result carries no original key name and keeps its key count. The clause that each former discriminator value is the safe notice stands as written.
- Change Log 2026-11-14 (goal-guard fail-closed MCP discriminator and key-name hardening), Requirement: Fail closed for the guarded class in blocking mode, the scenario Hijack in an MCP object key name is blanked on fail-closed, the clause (around line 715) that the hook replaces that object key name with the safe notice so the key name becomes the notice: the wording is superseded, the behavior is unchanged. The key is replaced by the position-based, collision-free rename (a key at position 0 becomes the safe notice, a key at a later position becomes the notice plus its position index), and the object keeps its key count. The clause that no attacker-controllable object key name from the MCP result survives stands as written.
- Change Log 2026-11-14 (goal-guard blocking-mode fail-closed hardening), Requirement: Depth- and breadth-bounded shape-preserving withhold clone, the scenario Content past the scan depth does not survive a blocking match (around lines 584-589), the step "the clone SHALL keep the shape-discriminator keys so the result still validates against the tool's output shape": superseded for an `mcp__*` tool. The scenario is written generically over tool class ("a result"), but that step now holds for a `WebFetch` or `WebSearch` result on the blocking-match path only. For an `mcp__*` blocking match the clone blanks the discriminator values (`type`, `mimeType`, `role`) and renames the object key names per the scenarios in this entry (Requirement: Depth- and breadth-bounded shape-preserving withhold clone, as modified below), so the generic keep-the-discriminators step no longer applies to MCP. The step "the emitted clone SHALL carry no content from below the scan depth" stands for every tool.

### ADDED Requirements

None.

### MODIFIED Requirements

#### Requirement: Depth- and breadth-bounded shape-preserving withhold clone

**Was:** While its mode is blocking, the `goal-guard` hook SHALL build the withheld or rewritten tool output as a structure-preserving clone that recurses no deeper than the alignment-check scan (`collectText`) reads, clones no more items per level than the scan's per-level item cap, and replaces each item past that cap with the safe notice rather than dropping it so every array keeps its original length. On the blocking-match path for every tool, and on the fail-closed path for a `WebFetch` or `WebSearch` result, the clone SHALL keep each fixed-vocabulary shape-discriminator key `type`, `mimeType`, and `role`, their values, and each object key name unchanged, so the result still validates against its tool's output shape and Claude Code does not silently ignore the `updatedToolOutput`; on the fail-closed path for an `mcp__*` tool, whose output shape Claude Code does not validate, the clone SHALL instead replace the discriminator values (`type`, `mimeType`, `role`) and the object key names with the safe notice, and the emitted clone SHALL remain well-formed so Claude Code does not silently ignore the `updatedToolOutput`. This depth and breadth bound SHALL apply to both the blocking-match withhold and the fail-closed withhold.

**Now:** While its mode is blocking, the `goal-guard` hook SHALL build the withheld or rewritten tool output as a structure-preserving clone that recurses no deeper than the alignment-check scan (`collectText`) reads, clones no more items per level than the scan's per-level item cap, and replaces each item past that cap with the safe notice rather than dropping it so every array keeps its original length. For a `WebFetch` or `WebSearch` result, on both the blocking-match path and the fail-closed path, the clone SHALL keep each fixed-vocabulary shape-discriminator key `type`, `mimeType`, and `role`, their values, and each object key name unchanged, so the result still validates against its tool's output shape and Claude Code does not silently ignore the `updatedToolOutput`. For an `mcp__*` tool, whose output shape Claude Code does not validate, the clone SHALL, on both the blocking-match path and the fail-closed path, replace the discriminator values (`type`, `mimeType`, `role`) and rename the object key names with the position-based, collision-free rename that keeps each array's length and each object's key count and leaks no original key text, and the emitted clone SHALL remain well-formed so Claude Code does not silently ignore the `updatedToolOutput`; on the blocking-match path this MCP discriminator-value blanking and key-name rename SHALL apply in addition to the existing replacement of the matched string value(s) with the safe notice, and the clone SHALL keep the other, unmatched ordinary string values rather than blanking them all. This depth and breadth bound SHALL apply to both the blocking-match withhold and the fail-closed withhold.

**Reason:** `DECISIONS.md`, 2026-11-14, "goal-guard blocking-match MCP discriminator and key-name hardening approved for build" (choice 1): on a blocking match for an `mcp__*` tool the discriminator values and object key names are attacker-controllable (the MCP server sets them) and Claude Code does not validate MCP output shape, so keeping them verbatim on the match path left the same hijack channel the fail-closed path already closed. The match path now blanks the MCP discriminator values and renames the MCP object key names, reusing the fail-closed path's position-based, collision-free rename, in addition to the existing replacement of the matched string value(s); ordinary MCP string values keep the existing behavior (the matched string value(s) are replaced and the other, unmatched string values stay), not a full blank-all, because the match path has read and localized the hijack. The `WebFetch` and `WebSearch` carve-out stays verbatim on both paths, because Claude Code validates those shapes and the fields are not attacker-controllable. The `collectText` depth parity and the per-level item (breadth) cap are unchanged on both paths.

**Requirement refs:** FR-219, NFR-028 | **Status:** Planned (goal-guard blocking-match MCP discriminator and key-name hardening)

The match-path split closes the same two residual channels for an `mcp__*` result on a blocking match that the fail-closed path closes on an evaluation failure: the discriminator-value channel (an MCP server that sets `type`, `mimeType`, or `role` to hijack text) and the object-key-name channel (an MCP server that sets a key name to hijack text). This is a bounded blank-on-match change: the scanner (`collectText`) is not extended by this delta. It reads every string value in the result, the discriminator values (`type`, `mimeType`, `role`) included, because it recurses into object values and never into object keys, so it does not read object key names. A hijack in a discriminator value is therefore a scanned string value: it triggers the match on its own, and this delta blanks that value on the MCP match path, so it is not a residual. A hijack placed only in an object key name, with nothing matching in any scanned string value, does not trigger a match and is not withheld on the match path; that key-name-only case is the one residual. The match that triggers the key-name rename must come from a string value the scanner reads. Extending `collectText` to read object key names stays deferred to the Step 36 reassessment, an FR-238 precision concern. The scenarios Result wider than the item cap stays bounded, Content past the scan depth is blanked on a fail-closed withhold, WebFetch result keeps discriminators and key names verbatim on fail-closed, and Real MCP output forms a usable withheld result after the broader blanking are unchanged in behavior. The scenario Content past the scan depth does not survive a blocking match is unchanged only for a `WebFetch` or `WebSearch` result; for an `mcp__*` blocking match its step that the clone keeps the shape-discriminator keys no longer applies, because the clone now blanks the discriminator values and renames the object key names (see the supersede entry for that scenario above). The fail-closed path's behavior is not changed by this delta, because the as-built fail-closed path already uses the same position-based, collision-free, key-count-preserving rename. This delta does correct the prior section's imprecise wording of the fail-closed key-name result (the Requirement: Fail closed for the guarded class in blocking mode clause and the Real MCP output and Hijack in an MCP object key name scenarios) to match as-built, through the supersede entries above; the only behavior change in this delta is on the blocking-match path.

##### Scenario: Hijack in an MCP discriminator value is blanked on a blocking match

- **GIVEN** the rule-mode store marks `goal-guard` blocking and an `mcp__<server>__<tool>` result whose `type`, `mimeType`, or `role` value carries hijack text the scanner matches (a discriminator value is a scanned string value, so it triggers the match on its own, with or without a second hijack elsewhere in the result)
- **WHEN** the hook rewrites or withholds the result through `updatedToolOutput` on the match
- **THEN** the hook SHALL replace that discriminator value with the safe notice
- **AND** the emitted `mcp__*` clone SHALL carry no attacker-controllable text in any `type`, `mimeType`, or `role` value
- **AND** the clone SHALL keep each array's length and each object's key count

##### Scenario: Hijack in an MCP object key name is renamed on a blocking match

- **GIVEN** the rule-mode store marks `goal-guard` blocking and an `mcp__<server>__<tool>` result that carries hijack text as an object key name, with a hijack the scanner matches in an ordinary string value elsewhere in the result
- **WHEN** the hook rewrites or withholds the result through `updatedToolOutput` on the match
- **THEN** the hook SHALL rename that object key with the position-based, collision-free rename, so no original key name survives in the clone
- **AND** the clone SHALL keep the object's key count and leak no original key text

##### Scenario: Ordinary MCP string values on a match: matched values replaced, unmatched values kept

- **GIVEN** the rule-mode store marks `goal-guard` blocking and an `mcp__<server>__<tool>` result that has a matched (hijack-bearing) string value and at least one separate benign, unmatched string value in a short structural field such as a title or a url
- **WHEN** the hook rewrites the result through `updatedToolOutput` on the match
- **THEN** the hook SHALL replace the matched string value wholesale with the safe notice
- **AND** the hook SHALL keep each benign, unmatched string value in such a short structural field verbatim
- **AND** the hook SHALL NOT preserve benign text within a single matched string value (whole-string replacement, not sub-string stripping)
- **AND** the hook SHALL NOT blank every ordinary string value, because blank-all-text is the fail-closed path only: the match path replaces only the matched string values, and the discriminator values and object key names are additionally handled by the scenarios above

##### Scenario: WebFetch and WebSearch keep discriminators and key names verbatim on a match

- **GIVEN** the rule-mode store marks `goal-guard` blocking and a `WebFetch` or `WebSearch` result that carries a matched hijack in its body text and whose `type` and object key names are the tool's own fixed vocabulary
- **WHEN** the hook rewrites the result through `updatedToolOutput` on the match
- **THEN** the hook SHALL keep the `type`, `mimeType`, and `role` values and every object key name verbatim
- **AND** the result SHALL still validate against the tool's output shape so Claude Code does not silently ignore the `updatedToolOutput` and pass the original to the model

##### Scenario: Known limit, a hijack only in an MCP object key name is not withheld on a match

- **GIVEN** the rule-mode store marks `goal-guard` blocking and an `mcp__<server>__<tool>` result whose only hijack text sits in an object key name, with nothing matching in any scanned string value
- **WHEN** the result reaches the hook
- **THEN** the hook SHALL NOT match and SHALL NOT withhold the result on the match path, because `collectText` reads string values and never object key names
- **AND** a hijack in a `type`, `mimeType`, or `role` value is a scanned string value, so it triggers a match and the hook SHALL blank that value on the MCP match path (Scenario: Hijack in an MCP discriminator value is blanked on a blocking match); it is not part of this limit
- **AND** this recorded key-name limit SHALL stay open for the Step 36 scanner-extension reassessment (FR-238), which would extend `collectText` to read object key names

### REMOVED Requirements

None.

### Diagram

Not re-rendered in this pass. The split changes the blocking-match withhold internals for an `mcp__*` result, not the advisory start-to-end flow the Algorithmic steps diagram shows. The `.mmd` source and PNG are re-rendered at the next fold with the other deferred diagram edits.

### Traceability added

| Requirement | Spec section | Verified by |
|---|---|---|
| FR-219, NFR-028 | Change Log 2026-11-14 (goal-guard blocking-match MCP discriminator and key-name hardening): Requirement: Depth- and breadth-bounded shape-preserving withhold clone | Prospective, once built: on a blocking match an `mcp__*` result with a hijack in a `type`/`mimeType`/`role` value has that value blanked, and one with a hijack in an object key name has that key renamed with no original key name surviving, while array length and object key count are kept; on a match an ordinary MCP string value the rules match is replaced wholesale with the safe notice and an unmatched string value in a short structural field is kept verbatim; a `WebFetch`/`WebSearch` result keeps its discriminators and key names verbatim. Verified by the test step (Step 3) of the task plan `docs/task-plans/task-plan-goalguard-matchpath-mcp-20261114-0620.md`, whose build adds these cases to `tests/hooks/goal-guard-blocking.test.js`; the cases are not yet present |
| FR-219, NFR-028 | Change Log 2026-11-14 (goal-guard blocking-match MCP discriminator and key-name hardening): Requirement: Depth- and breadth-bounded shape-preserving withhold clone | Prospective, once built: a hijack placed only in an MCP object key name, with nothing matching in the scanned string values, is not withheld on the match path, because `collectText` reads string values and never object key names and is not extended by this delta; a hijack in a `type`/`mimeType`/`role` value is a scanned string value, triggers the match, and is blanked; the key-name scanner extension stays deferred to the Step 36 reassessment. Verified by the test step (Step 3) of the task plan `docs/task-plans/task-plan-goalguard-matchpath-mcp-20261114-0620.md`, whose build adds these cases to `tests/hooks/goal-guard-blocking.test.js`; the cases are not yet present |
| NFR-031 | Change Log 2026-11-14 (goal-guard blocking-match MCP discriminator and key-name hardening): Requirement: Depth- and breadth-bounded shape-preserving withhold clone | Prospective, once built: the governance audit-log and baseline finding-store records are unchanged by the match-path split: a blocking match still writes one finding and a fail-closed withhold still writes none, and no record holds prompt text, file contents, or secret values. Verified by the test step (Step 3) of the task plan `docs/task-plans/task-plan-goalguard-matchpath-mcp-20261114-0620.md`, whose build adds these cases to `tests/hooks/goal-guard-blocking.test.js`; the cases are not yet present |

**Existing test assertions to revise at build.** `tests/hooks/goal-guard-blocking.test.js` still encodes the superseded pre-delta MCP match-path behavior in two places, and the build that adds the cases above revises both. First, the blocking-match MCP discriminator-keep assertion near line 837 (in the MCP content past the scan depth case) asserts that an MCP content block's `type` stays verbatim on the match path; for an `mcp__*` result that now contradicts the MODIFIED requirement above, which blanks the discriminator value. Second, the file-header assumption near lines 43 to 44 states that the blocking-match path keeps the discriminators and key names for every tool; after this delta it holds only for `WebFetch` and `WebSearch`. The task plan's test step lists the other superseded MCP match-path cases it revises.
