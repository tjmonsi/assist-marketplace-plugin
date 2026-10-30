## assist-plugin Harness Governance: Functional and Non-Functional Requirements

**Version:** 1.3
**Date:** 2026-10-30
**Author:** [Author]
**Status:** DRAFT

---

### 1. Introduction

**Purpose:** This document specifies the behaviors and quality attributes of the assist-plugin harness roadmap in four themes: harness security, integrity, governance and compliance profiles, and shift-left severity routing.

**Relationship to URD:** This document derives from `URD-harness-governance.md`. Every functional requirement traces to at least one user requirement. IDs continue `FR-NFR-assist-plugin.md` (FR-200 to FR-213, NFR-001 to NFR-025 are taken there).

**Relationship to BRD:** Non-functional requirements trace to business requirements in `BRD-harness-governance.md` when they originate from compliance or policy.

**Binding language:** `MUST` = mandatory, `SHOULD` = recommended, `MAY` = optional (RFC 2119). The keyword appears in uppercase in every FR and NFR statement.

**Source reliability:** Compliance and shift-left sources are mostly vendor blogs and give direction, not authority. FR-232 is verified against 45 CFR 164.312(b) and FR-246 cites 34 CFR 99.32 (see NFR-033); FR-230 carries no 99.32 citation.

### 2. Functional requirements

| ID | Requirement | Traces to | Priority | Acceptance criteria |
|----|-------------|-----------|----------|---------------------|
| FR-214 | The PR-posting guard MUST deny a PR verdict command when no recorded user confirmation exists for that PR and verdict. | UR-059 | Must | 2.1 |
| FR-215 | The commit workflow MUST stage only explicitly named paths. | UR-060 | Must | 2.2 |
| FR-216 | The plugin MUST recommend and check for a push grant limited to the `origin` remote. | UR-060 | Must | 2.3 |
| FR-217 | The commit workflow MUST run a secret scan on staged changes before it commits. | UR-060 | Must | 2.4 |
| FR-218 | The revision loop MUST stop at a maximum of 10 iterations and escalate to a human. | UR-061 | Must | 2.5 |
| FR-219 | A PostToolUse guardrail MUST deny when an alignment check finds goal hijack in tool output. | UR-062 | Should | 2.6 |
| FR-220 | The guardrail MUST scan generated code for insecure patterns and deny on a high-confidence, high-severity match. | UR-062 | Should | 2.7 |
| FR-221 | The governance gates MUST clear only on a parsed command exit code or a CI artifact. | UR-063 | Must | 2.8 |
| FR-222 | Approval status MUST be written only by a hook or the orchestrator. | UR-064 | Must | 2.9 |
| FR-223 | The write bar MUST cover shell writes to `.agent/main-plan/**` and `DECISIONS.md` by subagents. | UR-064 | Must | 2.10 |
| FR-224 | Each line of the governance audit log MUST carry the hash of the prior line. | UR-065 | Must | 2.11 |
| FR-225 | The plugin MUST provide a command that verifies the audit chain. | UR-065 | Must | 2.12 |
| FR-226 | Each logged event MUST carry a per-agent identity. | UR-066 | Must | 2.13 |
| FR-227 | The audit log MUST record operation, data accessed, agent identity, human authorizer, and timestamp per access event, and the subagent log MUST add agent identity and human authorizer per report. | UR-066 | Must | 2.14 |
| FR-228 | Event logging MUST be active from the first session and MUST record its own disablement. | UR-067 | Must | 2.15 |
| FR-229 | The plugin MUST export control evidence for a date range from its hook logs. | UR-067 | Should | 2.16 |
| FR-230 | While the FERPA profile is enforced (the default unless the project opts out), the plugin MUST log each access to a student-record path to the audit log with who and the purpose from the hook-written session purpose record (FR-247), or `unstated`, and MUST NOT deny an access on a missing purpose alone. | UR-068 | Should | 2.17 |
| FR-231 | The plugin MUST read its compliance configuration from two files: a profile flag in the `env` block of the committed `.claude/settings.json`, which the hooks read directly from the committed file, not the merged process environment, and `.agent/governance/profile.json`, which holds the PHI patterns, data-class path globs, and BAA references. When the flag is absent the plugin MUST enforce all three profiles. | UR-068, UR-069 | Should | 2.18 |
| FR-232 | While the HIPAA profile is enforced (the default unless the project opts out), the plugin MUST log at agent level each action that touches a PHI-tagged path, with the purpose from the session purpose record (FR-247) or `unstated`, in a form that supports review of the log. | UR-069 | Should | 2.19 |
| FR-233 | While the HIPAA profile is enforced (the default unless the project opts out), the plugin MUST deny an outbound call whose payload matches a configured PHI pattern or names a PHI-tagged path. | UR-069 | Should | 2.20 |
| FR-234 | While the HIPAA profile is enforced (the default unless the project opts out), the plugin MUST require a recorded BAA reference for each external system that may receive data. | UR-069 | Should | 2.21 |
| FR-235 | The plugin MUST keep a control register that maps each control to OWASP Agentic AI Top 10 items. | UR-070 | Should | 2.22 |
| FR-236 | The control register MUST map each control to a NIST AI RMF function with an owner role and review cadence. | UR-070 | Should | 2.23 |
| FR-237 | A severity policy MUST exist and be approved before any severity-based rule blocks. | UR-071 | Must | 2.24 |
| FR-238 | Each new blocking-capable check MUST run advisory-only first and produce a baseline report. | UR-071 | Must | 2.25 |
| FR-239 | Only findings with high confidence and severity at or above HIGH MUST route as blocking. | UR-072 | Must | 2.26 |
| FR-240 | The reviewer and code-reviewer MUST add severity, confidence, and a routing decision to each finding. | UR-073 | Must | 2.27 |
| FR-241 | The reviewer output MUST include SARIF so findings reach the GitHub Security tab. | UR-074 | Should | 2.28 |
| FR-242 | A confirmation-recording step MUST write the user's PR-verdict confirmation to a store that only a hook or the orchestrator can write and that the PR-posting guard can read. | UR-059 | Must | 2.29 |
| FR-243 | A compliance profile MUST be turned off only by a change to the committed `.claude/settings.json` that the user applies; the plugin MUST NOT edit a settings file, and the hooks MUST read the flag directly from the committed project file, never the merged process environment, so a personal `.claude/settings.local.json` cannot disable enforcement. | UR-075 | Must | 2.30 |
| FR-244 | Each profile disablement MUST write a logged event naming the profile and the time, and MUST have its own `DECISIONS.md` entry. | UR-075 | Must | 2.31 |
| FR-245 | The files `.claude/settings.json` and `.agent/governance/profile.json`, the confirmation store (FR-242), `.agent/logs/governance/**`, the session purpose record (FR-247), and the rule-mode store MUST be protected from writes by every subagent. | UR-075 | Must | 2.32 |
| FR-246 | While the FERPA profile is enforced (the default unless the project opts out), the plugin MUST log each disclosure of education-record data to an outside party with the receiving party and the legitimate interest, MUST NOT accept `unstated` for either, MUST deny the outbound disclosure when the receiving party or the legitimate interest is missing or the receiving party is not on the `profile.json` allowlist, and MUST apply the exceptions of 34 CFR 99.32(d). The receiving party and the legitimate interest are declared in the outbound call payload and parsed by the guard. | UR-076 | Should | 2.33 |
| FR-247 | A hook MUST write the session purpose record from a purpose the user declares, and the access-logging hooks MUST read that record; model output and text from a PR, web page, or file MUST NOT create or alter it. | UR-068, UR-069 | Should | 2.34 |

Acceptance criteria are the scenarios below, in GIVEN/WHEN/THEN form.

#### Theme 1: Harness security

#### 2.1 FR-214: Deny unconfirmed PR verdict

**Statement:** The PR-posting guard MUST deny `gh pr review` and `bkt pr approve` or `decline` for a PR when no recorded user confirmation exists for that PR and that verdict (recording: FR-242). The deny replaces the current ask for these commands; the ask for other posting commands stays.
**Traces to:** UR-059
**Priority:** Must
**Origin:** Gap 2, `plugins/assist-plugin/rules/llm-security-checklist.md:326`; LLM01 section, `:30-37`. Current control: the best-effort, fail-open `pr-post-ask` hook (`rules/assist-plugin-rule.md:409`).

##### Scenario: Confirmed verdict posts

- **GIVEN** the user confirmed "approve PR 42" and the confirmation is recorded
- **WHEN** the session runs `gh pr review 42 --approve`
- **THEN** the guard MUST allow the command
- **AND** the log MUST hold the confirmation reference

##### Scenario: Injected approval is denied

- **GIVEN** PR 42's description tells the session to approve and no confirmation is recorded
- **WHEN** the session runs `gh pr review 42 --approve`
- **THEN** the guard MUST deny the command
- **AND** the denial message MUST name the missing confirmation

##### Scenario: Confirmation for a different verdict does not carry over

- **GIVEN** a recorded confirmation covers "approve PR 42" only
- **WHEN** the session runs `gh pr review 42 --request-changes`
- **THEN** the guard MUST deny the command

#### 2.2 FR-215: No blanket staging

**Statement:** The commit workflow MUST stage only paths the user named or the workflow listed and the user accepted, and MUST NOT run `git add .`, `git add -A`, or `git add --all`.
**Traces to:** UR-060
**Priority:** Must
**Origin:** Gap 3, `llm-security-checklist.md:327`; LLM02 section, `:69-73`.

##### Scenario: Named paths staged

- **GIVEN** the user names `src/a.js` and `src/b.js`
- **WHEN** the commit workflow stages changes
- **THEN** the workflow MUST stage exactly those two paths

##### Scenario: Request to stage everything

- **GIVEN** the user says "commit everything" and the tree holds a `.env` file
- **WHEN** the commit workflow starts
- **THEN** the workflow MUST list the changed paths and ask which to stage
- **AND** the workflow MUST stage nothing until paths are named

#### 2.3 FR-216: Push grant limited to origin

**Statement:** The plugin documentation MUST recommend the grant `Bash(git push origin *)` in place of `Bash(git push *)`, and `/assist-plugin:health` MUST report a broader push grant when it reads one.
**Traces to:** UR-060
**Priority:** Must
**Origin:** Gap 3, `llm-security-checklist.md:327`; LLM02 section, `:71-73`. The plugin never edits a settings file (`rules/assist-plugin-rule.md:400`), so the user applies the change to `.claude/settings.local.json` (dependency D-3). The origin-only grant `Bash(git push origin *)` is settled (`DECISIONS.md`, 2026-10-30, "Gap-3 push grant and gap-6 revision-loop cap settled"). The health check and the documentation recommendation ship regardless; gap 3 closes only after the user has applied the grant.

##### Scenario: Narrow grant passes the check

- **GIVEN** the settings hold `Bash(git push origin *)` and no bare `Bash(git push *)`
- **WHEN** the health check runs
- **THEN** the report MUST show no push-grant finding

##### Scenario: Wildcard grant reported

- **GIVEN** the settings hold `Bash(git push *)`
- **WHEN** the health check runs
- **THEN** the report MUST list the broad push grant
- **AND** the report MUST NOT edit the settings file

#### 2.4 FR-217: Secret scan before commit

**Statement:** The commit workflow MUST run a secret scan on the staged changes before creating a commit, and MUST stop with no commit when the scan reports a finding or cannot run.
**Traces to:** UR-060
**Priority:** Must
**Origin:** Gap 3, `llm-security-checklist.md:327`.

##### Scenario: Clean scan commits

- **GIVEN** staged changes hold no secret pattern
- **WHEN** the commit workflow reaches the commit step
- **THEN** the scan MUST report clean
- **AND** the workflow MUST create the commit

##### Scenario: Staged secret stops the commit

- **GIVEN** a staged file holds an API key pattern
- **WHEN** the commit workflow reaches the commit step
- **THEN** the workflow MUST stop with no commit
- **AND** the report MUST show the file path and rule name and MUST NOT show the secret value

##### Scenario: Scanner unavailable

- **GIVEN** the scan tool is not installed
- **WHEN** the commit workflow reaches the commit step
- **THEN** the workflow MUST stop and tell the user the scan did not run

#### 2.5 FR-218: Revision loop cap and escalation

**Statement:** The revision workflow in `skills/do/references/review-protocol.md` MUST declare a maximum iteration count of 10, with two consecutive LGTMs as the normal pass, and MUST escalate to the user when the count is reached without approval. At the cap the orchestrator MUST run no further developer or reviewer round and MUST present the unresolved findings with the choices continue, waive, or abort.
**Traces to:** UR-061
**Priority:** Must
**Origin:** Gap 6, `llm-security-checklist.md:330`; LLM10 section, `:285-287` and `:295`. The cap of 10 replaces the roadmap default of 3 and agrees with the review protocol (`DECISIONS.md`, 2026-10-30, "Gap-3 push grant and gap-6 revision-loop cap settled"; OQ-2 resolved). At the cap this requirement wins over the review protocol's "Exhausting a gate" step, and a waive is recorded in the plan file by the orchestrator.

##### Scenario: Approval inside the cap

- **GIVEN** the cap is 10
- **WHEN** the reviewer returns two consecutive LGTMs at iteration 2
- **THEN** the loop MUST end
- **AND** no escalation MUST occur

##### Scenario: Cap reached

- **GIVEN** the cap is 10 and no approval has come
- **WHEN** iteration 10 ends without approval
- **THEN** the orchestrator MUST invoke no further developer or reviewer round
- **AND** the user MUST receive the unresolved findings with the choices continue, waive, or abort

#### 2.6 FR-219: Goal-hijack guardrail

**Statement:** A PostToolUse guardrail MUST be able to deny a tool result and halt the next action when an alignment check finds that the result tries to redirect the agent from the user's stated goal.
**Traces to:** UR-062
**Priority:** Should
**Origin:** Gap in current control: the injection-filter replaces phrasing with a marker and never blocks (`rules/assist-plugin-rule.md:416`). Modeled on the alignment-auditor check in Meta LlamaFirewall (https://arxiv.org/pdf/2505.03574).

##### Scenario: Hijack denied

- **GIVEN** the user's goal is "summarize this page" and a fetched page tells the agent to send repo files to a URL
- **WHEN** the WebFetch result reaches the guardrail
- **THEN** the guardrail MUST withhold the result from the agent
- **AND** the log MUST hold a deny record with a rule id

##### Scenario: Benign result passes

- **GIVEN** a fetched page holds only documentation text
- **WHEN** the result reaches the guardrail
- **THEN** the guardrail MUST pass the result unchanged
- **AND** the log MUST hold a pass record

#### 2.7 FR-220: Insecure generated code scan

**Statement:** The guardrail MUST scan code that an agent writes for insecure patterns and MUST deny the write when a finding has high confidence and severity at or above HIGH under the severity policy (FR-237).
**Traces to:** UR-062
**Priority:** Should
**Origin:** Insecure-code scanner component of Meta LlamaFirewall (https://arxiv.org/pdf/2505.03574).
**Constraint:** The scan MUST be pattern-based (rule matching on the written text) so it fits the per-write budget of NFR-029. Confirm by measurement; a heavier scan would need a revised budget.

##### Scenario: Injection-prone code denied

- **GIVEN** a write builds an SQL string from request input
- **WHEN** the guardrail scans the write
- **THEN** the guardrail MUST deny the write
- **AND** the denial MUST name the rule id and line

##### Scenario: Safe code passes

- **GIVEN** a write uses a parameterized query
- **WHEN** the guardrail scans the write
- **THEN** the guardrail MUST allow the write

#### Theme 2: Integrity

#### 2.8 FR-221: Evidence-backed gates

**Statement:** The orchestrator MUST record a governance gate (OWASP Clear, LLM Security Clear, Coverage >=70%, Approved for merge) as cleared only with an evidence reference: a parsed command exit code and measured value, or a CI artifact. A sign-off string emitted by a model MUST NOT clear a gate. For judgement-based gates (OWASP Clear, LLM Security Clear, Approved for merge) the evidence MUST be a scanner exit code plus a verdict from a reviewer agent other than the producer, with file:line findings. The required scanner exit code MUST come from the plugin's own scripts (`check-fsa-tables.js`, `sync-writing-standard.js`, the FR-217 pattern/secret scanner, or the health self-tests). An external security scanner is optional additional evidence, and a gate MUST NOT depend on one being installed.
**Traces to:** UR-063
**Priority:** Must
**Origin:** LLM09 section, `llm-security-checklist.md:247-255` and `:266-267`; gates at `rules/assist-plugin-rule.md:95`, `:97`, `:128`, `:268`, `:299`, `:334-336`. OQ-1 resolved by `DECISIONS.md`, 2026-10-30, "Judgement-gate evidence and the /do human authorizer settled". The orchestrator, not the reviewer, writes the gate record; reviewers stay read-only (NFR-027).

##### Scenario: Coverage gate with evidence

- **GIVEN** `npm run test:coverage` exits 0 and the parsed line coverage is 82%
- **WHEN** the orchestrator evaluates the coverage gate
- **THEN** the gate record MUST hold the command, exit code 0, and value 82
- **AND** the gate MUST read as cleared

##### Scenario: Sign-off string alone

- **GIVEN** an agent emits "✓ Coverage >=70%" and no command result exists
- **WHEN** the orchestrator evaluates the coverage gate
- **THEN** the gate MUST stay open
- **AND** the merge check MUST block

#### 2.9 FR-222: Approval written by hook or orchestrator

**Statement:** A hook or the orchestrator MUST write approval status; the agent that produced an artifact MUST NOT write the status of that artifact.
**Traces to:** UR-064
**Priority:** Must
**Origin:** LLM09 section, `llm-security-checklist.md:268-269`.

##### Scenario: Orchestrator records verdict

- **GIVEN** a reviewer returns an approving verdict for a developer's artifact
- **WHEN** the orchestrator updates the plan file
- **THEN** the status MUST show the writer as the orchestrator

##### Scenario: Producer self-approval blocked

- **GIVEN** a developer agent tries to set its artifact's status to approved
- **WHEN** the write reaches the write bar
- **THEN** the write MUST be denied
- **AND** the log MUST hold a deny record

#### 2.10 FR-223: Shell write path closed

**Statement:** The write bar MUST deny a subagent shell command that writes to `.agent/main-plan/**` or to `DECISIONS.md` through redirection, `tee`, `sed -i`, `cp`, `mv`, or `rm`, and MUST allow shell reads of those paths.
**Traces to:** UR-064
**Priority:** Must
**Origin:** Gap 4, `llm-security-checklist.md:328`; LLM09 section, `:256-259`; Write guard lists, `rules/assist-plugin-rule.md:420-434`. Known limit: a command built from a variable can escape matching (out of scope, section 4).

##### Scenario: Shell append to DECISIONS.md

- **GIVEN** a subagent session
- **WHEN** it runs `echo "approved" >> DECISIONS.md`
- **THEN** the write bar MUST deny the command

##### Scenario: Shell read allowed

- **GIVEN** a subagent session
- **WHEN** it runs `cat DECISIONS.md`
- **THEN** the write bar MUST allow the command

#### 2.11 FR-224: Hash-chained audit log

**Statement:** The governance audit log `.agent/logs/governance/audit.jsonl` MUST be appended one JSON line per event, and each line MUST hold a hash of the prior line (SHA-256, BRD A-3) with a defined genesis value for the first line.
**Traces to:** UR-065
**Priority:** Must
**Origin:** Roadmap theme 2. The file is named at `llm-security-checklist.md:78`; no hook code writes it today (BRD A-8).

##### Scenario: Append extends the chain

- **GIVEN** the log holds N lines
- **WHEN** a new event is appended
- **THEN** the new line's prior-hash field MUST equal the hash of line N

##### Scenario: Failed append leaves the chain intact

- **GIVEN** the disk is full
- **WHEN** an append fails
- **THEN** the log MUST hold no partial line
- **AND** the health log MUST record the failure

#### 2.12 FR-225: Chain verification command

**Statement:** The plugin MUST provide a command that walks the audit log, recomputes each hash, and reports the first line where the chain breaks.
**Traces to:** UR-065
**Priority:** Must

##### Scenario: Intact chain

- **GIVEN** an unmodified log of 500 lines
- **WHEN** the command runs
- **THEN** it MUST exit 0
- **AND** it MUST report 500 lines verified

##### Scenario: Edited line

- **GIVEN** line 7 was edited after writing
- **WHEN** the command runs
- **THEN** it MUST exit non-zero
- **AND** it MUST name line 7 as the first break

#### Theme 3: Governance and compliance profiles

#### 2.13 FR-226: Per-agent identity

**Statement:** Each logged event MUST carry the agent type, agent id, and plugin version of the actor, and MUST record the value `main-session` when no subagent acted.
**Traces to:** UR-066
**Priority:** Must
**Origin:** Roadmap theme 3. The subagent log already stores agent type and agent id (`skills/health/SKILL.md:97`).

##### Scenario: Subagent event

- **GIVEN** the developer subagent writes a file
- **WHEN** the event is logged
- **THEN** the record MUST hold agent type `developer`, its agent id, and the plugin version

##### Scenario: Main-session event

- **GIVEN** the main session runs a command
- **WHEN** the event is logged
- **THEN** the record MUST hold `main-session` and MUST NOT leave the identity blank

#### 2.14 FR-227: Attribution record

**Statement:** The audit log `audit.jsonl` MUST record, for each access event, the operation, data accessed (path and data-class tag only), agent identity, human authorizer, and timestamp. The subagent log `fsa-log.jsonl`, which is written once per subagent report, MUST add only the agent identity and human authorizer to each report row and MUST NOT hold an operation or data-accessed field. The human authorizer is the user who approved the plan, recorded as a reference to that approval (the plan's "Approved" decision or the approval message id) and never as message text (NFR-031). An autonomous action, or one with no user approval, MUST record the authorizer as `none` with a reason.
**Traces to:** UR-066
**Priority:** Must
**Origin:** Roadmap theme 3. `fsa-log.jsonl` holds one row per report with terminal-block fields (`skills/health/SKILL.md:97`), so one row cannot carry a single operation or accessed path; per-access attribution therefore goes to the audit log. The two-file split is ratified as written (D-5, OQ-4 resolved) by `DECISIONS.md`, 2026-10-30, "Audit-logging stores settled (per-access split, rotation and retention, confirmation-store writer)". The authorizer under `/do` (OQ-7 resolved) is settled by `DECISIONS.md`, 2026-10-30, "Judgement-gate evidence and the /do human authorizer settled"; it needs no per-action prompt.

##### Scenario: Complete record

- **GIVEN** a user-confirmed PR post under a plan the user approved
- **WHEN** the event is logged
- **THEN** the audit record MUST hold all five fields
- **AND** the authorizer field MUST hold a reference to the plan approval and MUST NOT hold message text
- **AND** the `fsa-log.jsonl` row for that report MUST hold identity and authorizer only

##### Scenario: No human authorizer

- **GIVEN** an autonomous read with no user action, or an action with no user approval of the plan
- **WHEN** the event is logged
- **THEN** the authorizer field MUST read `none` with a reason
- **AND** the field MUST NOT be omitted

#### 2.15 FR-228: Logging from the first session

**Statement:** Event logging MUST be active from the first session after install with no opt-in, and a guard disabled through `hooks-disabled.json` MUST produce a logged disablement event.
**Traces to:** UR-067
**Priority:** Must
**Origin:** Roadmap theme 3 (SOC 2 Type II judges controls over a 6-to-12-month window, so logging cannot start later).

##### Scenario: Fresh install

- **GIVEN** a new install with no configuration
- **WHEN** the first session runs a governed action
- **THEN** a log record for that action MUST exist

##### Scenario: Guard disabled

- **GIVEN** a user adds a guard to `hooks-disabled.json`
- **WHEN** the next session starts
- **THEN** the log MUST hold a disablement event naming the guard and the time

#### 2.16 FR-229: Control evidence export

**Statement:** The plugin MUST export, for a date range, the counts and records of denies, asks, gate evidence, and approvals from its hook logs, together with the chain verification result.
**Traces to:** UR-067
**Priority:** Should
**Origin:** Roadmap theme 3: evidence comes from the plugin's own hooks, not a vendor SOC 2 report. References: https://goteleport.com/blog/ai-agents-soc-2/ , https://www.probo.com/hub/ai-coding-tools-soc2-compliance (vendor blogs, directional).

##### Scenario: Export for a verified range

- **GIVEN** the chain is intact for 2026-01-01 to 2026-06-30
- **WHEN** the export runs for that range
- **THEN** the report MUST list control events by type
- **AND** the report MUST show the chain as verified

##### Scenario: Range with a break

- **GIVEN** the chain breaks inside the range
- **WHEN** the export runs
- **THEN** the report MUST mark the range unverified and name the first bad line

#### 2.17 FR-230: FERPA internal access log

**Statement:** While the FERPA profile is enforced (the default unless the project opts out under FR-243), the plugin MUST write to the audit log, for each agent access to a path tagged as a student record, the five attribution fields plus the purpose. The purpose MUST come from the session purpose record that the purpose-capture hook of FR-247 writes; when no such record exists the plugin MUST log the purpose as `unstated` and flag the record. The plugin MUST NOT deny an access on the missing purpose alone, because a read-time hook sees a path and not a purpose. This control is general FERPA governance support on the purpose dimension. It does not implement the recordation duty of 34 CFR 99.32, which covers disclosures to outside parties (FR-246).
**Traces to:** UR-068
**Priority:** Should
**Origin:** Roadmap theme 3. `DECISIONS.md`, 2026-10-28, "FERPA/HIPAA purpose capture, missing-purpose handling, and governance path protection" (OQ-6 and OQ-11 settled: log control, hook-written purpose) and "OQ-9 resolved; FERPA control reframed, HIPAA scope tightened" (the internal log is not 99.32 recordation). No authoritative source prescribes the logging detail, so the control is directional (NFR-033).

##### Scenario: Access with purpose

- **GIVEN** the FERPA profile is enforced, `records/grades.csv` is tagged student-record in `.agent/governance/profile.json`, and a session purpose record exists
- **WHEN** an agent reads the file
- **THEN** the audit log MUST hold the five attribution fields plus the purpose from that record

##### Scenario: Access without purpose

- **GIVEN** the same setup and no session purpose record
- **WHEN** an agent reads the file
- **THEN** the audit log MUST hold the purpose `unstated`
- **AND** the record MUST be flagged for review
- **AND** the read MUST NOT be denied on the missing purpose

#### 2.18 FR-231: Data-class tags

**Statement:** The compliance configuration MUST be two files. A profile flag in the `env` block of the committed `.claude/settings.json` turns profiles on or off, and the plugin hooks MUST read that committed project file directly (parse the project settings file), not the merged process environment, so a personal `.claude/settings.local.json` cannot override or disable enforcement (FR-243); when the flag is absent from the committed project file the plugin MUST enforce all three profiles (SOC 2, HIPAA, FERPA), so the default needs no settings change. The file `.agent/governance/profile.json` MUST hold the PHI patterns, the data-class path globs (such as student-record or PHI), and the BAA references. A missing or malformed `profile.json` is handled under NFR-028.
**Traces to:** UR-068, UR-069
**Priority:** Should
**Origin:** `DECISIONS.md`, 2026-10-28, "Compliance profile flags, enforced by default"; resolves the open point on configuration location. The opt-out path is FR-243; protection of both files is FR-245.

##### Scenario: Path matches a tag

- **GIVEN** `.agent/governance/profile.json` tags `records/**` as student-record
- **WHEN** a hook classifies `records/grades.csv`
- **THEN** the hook MUST return the class student-record

##### Scenario: Flag absent

- **GIVEN** the `env` block of the committed `.claude/settings.json` holds no profile flag
- **WHEN** a hook reads the profile state by parsing the committed project settings file
- **THEN** the hook MUST treat the SOC 2, HIPAA, and FERPA profiles as enforced

##### Scenario: Malformed profile.json

- **GIVEN** `.agent/governance/profile.json` is invalid JSON and a profile is enforced
- **WHEN** a hook loads it
- **THEN** the plugin MUST report the error through the health check
- **AND** the tagged-path controls MUST deny the guarded operations until the file is fixed (NFR-028)

#### 2.19 FR-232: HIPAA agent-level audit log

**Statement:** While the HIPAA profile is enforced (the default unless the project opts out under FR-243), the plugin MUST write to the audit log, at agent level (one record per agent action, not per session or per inference call), each action that reads, writes, or sends data from a PHI-tagged path, with the purpose from the session purpose record (FR-247) or `unstated`. The records MUST be readable for review (path, agent identity, and timestamp per line), because 45 CFR 164.312(b) requires mechanisms that record and examine activity. This control implements that one required technical safeguard and is not full HIPAA compliance; access control, integrity, authentication, transmission security, and the administrative and physical safeguards are separate.
**Traces to:** UR-069
**Priority:** Should
**Origin:** Roadmap theme 3, 45 CFR 164.312(b). Verified against the CFR 2023 text (`DECISIONS.md`, 2026-10-28, "OQ-9 resolved; FERPA control reframed, HIPAA scope tightened"; https://www.govinfo.gov/content/pkg/CFR-2023-title45-vol2/xml/CFR-2023-title45-vol2-sec164-312.xml). The Kiteworks and TianPan articles (https://www.kiteworks.com/hipaa-compliance/ai-agents-hipaa-phi-access/ ; https://tianpan.co/blog/2026-05-07-hipaa-soc2-ai-agent-architectural-constraints-compliance) are vendor sources and stay directional.

##### Scenario: Agent action logged

- **GIVEN** the HIPAA profile is enforced and `data/patients.csv` is tagged PHI
- **WHEN** a subagent reads the file
- **THEN** the log MUST hold a record naming that subagent and the path
- **AND** the record MUST hold the purpose from the session purpose record, or `unstated` when none exists

##### Scenario: Unidentified actor

- **GIVEN** the same setup
- **WHEN** an action arrives with no agent id and is not the main session
- **THEN** the record MUST carry the identity `unidentified`
- **AND** chain verification output MUST flag the record

#### 2.20 FR-233: PHI outbound guard

**Statement:** While the HIPAA profile is enforced (the default unless the project opts out under FR-243), a guard MUST deny `WebFetch` and PR-post calls whose payload matches a configured PHI pattern or names a PHI-tagged path.
**Traces to:** UR-069
**Priority:** Should
**Origin:** Roadmap theme 3. Known limits: a paraphrase of PHI can escape a pattern match, and the guard sees one call at a time, so it cannot tell that a payload holds content the session read earlier from a PHI-tagged path. That provenance check needs session-level taint tracking and is out of scope (section 4).

##### Scenario: PHI pattern in a PR comment

- **GIVEN** the HIPAA profile is enforced and `profile.json` holds a medical-record-number pattern
- **WHEN** the session posts a PR comment containing a string that matches the pattern
- **THEN** the guard MUST deny the post
- **AND** the denial MUST be logged

##### Scenario: Clean payload

- **GIVEN** the HIPAA profile is enforced with the same `profile.json`
- **WHEN** the session posts a PR comment that matches no pattern and names no PHI-tagged path
- **THEN** the guard MUST allow the post

#### 2.21 FR-234: BAA record

**Statement:** While the HIPAA profile is enforced (the default unless the project opts out under FR-243), the plugin MUST require a BAA reference (identifier, counterparty, date) for each external system that the profile lets receive data, and MUST report the profile as not ready when one is missing. The plugin MUST NOT assess the agreement text.
**Traces to:** UR-069
**Priority:** Should

##### Scenario: BAA recorded

- **GIVEN** `profile.json` lists a BAA reference for the model provider
- **WHEN** the profile readiness check runs
- **THEN** the check MUST report ready

##### Scenario: BAA missing

- **GIVEN** `profile.json` lists an external system with no BAA reference
- **WHEN** the readiness check runs
- **THEN** the check MUST report not ready
- **AND** the outbound guard MUST deny calls to that system

#### 2.22 FR-235: OWASP Agentic mapping

**Statement:** The plugin MUST keep a control register in which each control in this document maps to at least one OWASP Agentic AI Top 10 item (ASI01 to ASI10) or to `not applicable` with a reason.
**Traces to:** UR-070
**Priority:** Should
**Origin:** Roadmap theme 3. References: https://securityboulevard.com/2025/12/owasp-project-publishes-list-of-top-ten-ai-agent-threats/ , https://docs.modulos.ai/frameworks/owasp-top-10-agentic.

##### Scenario: Complete register

- **GIVEN** each control has an ASI id or a reasoned `not applicable`
- **WHEN** the register check runs
- **THEN** the check MUST pass

##### Scenario: Unmapped control

- **GIVEN** a control has neither
- **WHEN** the register check runs
- **THEN** the check MUST fail and name the control

#### 2.23 FR-236: NIST AI RMF mapping, ownership, cadence

**Statement:** The control register MUST map each control to one NIST AI RMF function (GOVERN, MEASURE, or MANAGE), an owner role, and a review cadence with an escalation path. The default cadence is quarterly (estimate).
**Traces to:** UR-070
**Priority:** Should

##### Scenario: Control with owner

- **GIVEN** a control lists function MANAGE, owner role security lead, cadence quarterly
- **WHEN** the register check runs
- **THEN** the check MUST pass

##### Scenario: Missing owner

- **GIVEN** a control lists no owner role
- **WHEN** the register check runs
- **THEN** the check MUST fail and name the control

#### Theme 4: Shift-left severity routing

#### 2.24 FR-237: Severity policy first

**Statement:** A severity policy MUST define CRITICAL, HIGH, MEDIUM, and LOW for this repo, with examples and confidence levels, and MUST be approved by the user (recorded in `DECISIONS.md`) before any rule blocks on severity.
**Traces to:** UR-071
**Priority:** Must
**Origin:** Roadmap theme 4. Reference: https://helpmetest.com/blog/devsecops-testing-pipeline/ (vendor blog, directional). The policy basis is settled by `DECISIONS.md`, 2026-10-30, "Severity-policy basis and SARIF writer settled" (D-4 basis): four levels aligned to a recognized rubric (OWASP risk rating or CVSS bands) with repo-specific examples drawn from this plugin's hook and LLM-surface risks, a per-finding confidence of High, Medium, or Low, and a SARIF mapping of CRITICAL and HIGH to error, MEDIUM to warning, and LOW to note. The concrete policy text is drafted separately. The user's formal approval, a later `DECISIONS.md` entry, is still pending, so no rule blocks on severity yet and the advisory-baseline-first rule of FR-238 still applies.

##### Scenario: Policy approved

- **GIVEN** the policy exists and a `DECISIONS.md` entry approves it
- **WHEN** a rule is switched to blocking
- **THEN** the switch MUST succeed

##### Scenario: Policy missing

- **GIVEN** no approved policy exists
- **WHEN** a rule is switched to blocking
- **THEN** the switch MUST be refused with the missing-policy reason

#### 2.25 FR-238: Advisory baseline first

**Statement:** Each new check that can block (FR-219, FR-220, FR-239) MUST run advisory-only first, record every finding, and produce a baseline report with finding counts and precision before promotion to blocking. The baseline lasts 14 days or 20 reviews, whichever is later (estimate, BRD A-5).
**Traces to:** UR-071
**Priority:** Must

##### Scenario: Advisory run

- **GIVEN** a check is in advisory mode
- **WHEN** it finds a HIGH item
- **THEN** it MUST record the finding
- **AND** it MUST NOT block

##### Scenario: Promotion without baseline

- **GIVEN** a check has no baseline report
- **WHEN** it is switched to blocking
- **THEN** the switch MUST be refused

#### 2.26 FR-239: Block only high-confidence, high-severity

**Statement:** A finding MUST route as blocking only when confidence is high and severity is HIGH or CRITICAL under the severity policy; every other finding MUST route as advisory.
**Traces to:** UR-072
**Priority:** Must
**Origin:** Roadmap theme 4, alert fatigue. References: https://about.gitlab.com/de-de/blog/devsecops-shift-left-guide , https://helpmetest.com/blog/devsecops-testing-pipeline/ (vendor blogs, directional).

##### Scenario: Critical, high confidence

- **GIVEN** a finding with severity CRITICAL and confidence high
- **WHEN** routing runs
- **THEN** the finding MUST route as block-merge

##### Scenario: High severity, low confidence

- **GIVEN** a finding with severity HIGH and confidence low
- **WHEN** routing runs
- **THEN** the finding MUST route as inline-comment or log-only
- **AND** it MUST NOT block merge

#### 2.27 FR-240: Severity and routing fields

**Statement:** The reviewer and code-reviewer agents MUST give each finding a `severity`, a `confidence`, and a `routing` field with one of `block-merge`, `inline-comment`, or `log-only`.
**Traces to:** UR-073
**Priority:** Must

##### Scenario: Complete finding

- **GIVEN** a reviewer reports a defect at `src/a.js:10`
- **WHEN** the report is written
- **THEN** the finding MUST hold severity, confidence, and routing

##### Scenario: Missing field

- **GIVEN** a finding lacks `severity`
- **WHEN** the orchestrator reads the report
- **THEN** the orchestrator MUST reject the report and ask for a corrected one

#### 2.28 FR-241: SARIF output

**Statement:** The reviewer output MUST include a SARIF document (version 2.1.0, estimate) whose result level derives from severity and whose location is file and line, so findings appear in the GitHub Security tab. The reviewer returns the SARIF content or the findings, and the `/do` orchestrator MUST write the `.sarif` file. Uploading the file to GitHub is a posting action under the FR-214 confirmation rule.
**Traces to:** UR-074
**Priority:** Should
**Origin:** Roadmap theme 4. Reference: https://www.autorabit.com/blog/github-shifts-left-on-security-with-its-sarif-compatibility/ (vendor blog, directional). The reviewer holds only `Read, Grep, Glob, LSP` (`llm-security-checklist.md:325`), so another component writes the file. The writer is the `/do` orchestrator (D-9, OQ-8 resolved by `DECISIONS.md`, 2026-10-30, "Severity-policy basis and SARIF writer settled"); no subagent write path is added to the write bar. Uploading to GitHub is a posting action and falls under FR-214's confirmation rule where it posts a verdict. The result-level mapping is CRITICAL and HIGH to error, MEDIUM to warning, LOW to note (FR-237).

##### Scenario: Findings become SARIF

- **GIVEN** a reviewer reports two findings with file and line
- **WHEN** the SARIF document is produced
- **THEN** it MUST hold two results with level and location

##### Scenario: Finding without a location

- **GIVEN** a finding has no file and line
- **WHEN** the SARIF document is produced
- **THEN** the finding MUST be left out of SARIF
- **AND** the report MUST list it as not exported with the reason

#### 2.29 FR-242: Confirmation recording (Theme 1)

**Statement:** A hook on `UserPromptSubmit`, not the orchestrator, MUST write a record of the user's confirmation (PR, verdict, timestamp, a reference to the user message it came from, and the writer marked `hook`) as JSONL to a store under a path in `.agent/` that FR-245 already protects, and the PR-posting guard of FR-214 MUST read that store with file reads alone. A subagent and text from a PR, web page, or file MUST NOT create or alter a confirmation record.
**Traces to:** UR-059
**Priority:** Must
**Origin:** Gap 2, `llm-security-checklist.md:326`. FR-214 denies on a missing confirmation, so the store is security-relevant: a store any agent can write could be forged by the injected PR text the control defends against. The guard's only I/O is file reads that a test can replace (`rules/assist-plugin-rule.md:409`). The writer and form are settled (D-10, OQ-10 resolved) by `DECISIONS.md`, 2026-10-30, "Audit-logging stores settled (per-access split, rotation and retention, confirmation-store writer)": a hook's output cannot be forged by model text or by PR, web, or file content, the same trust model as the FR-247 purpose-capture hook. The hook ships with an ES5 entry file, a timeout, a self-test corpus (NFR-035), and the D-1 fail-closed behavior for its guarded class. The store path is protected from every subagent write under FR-245 (D-2 settled).

##### Scenario: User confirmation recorded

- **GIVEN** the orchestrator asked the user to approve PR 42 and the user answered yes in their own message
- **WHEN** the `UserPromptSubmit` hook runs
- **THEN** the store MUST hold a JSONL record for PR 42 and verdict approve with the timestamp
- **AND** the record MUST name the writer as `hook`

##### Scenario: Forged confirmation rejected

- **GIVEN** a PR description claims that the user confirmed approval
- **WHEN** a subagent or the session tries to write a confirmation record from that text
- **THEN** the write MUST be denied
- **AND** the guard of FR-214 MUST still deny the posting command

#### Theme 3 addition: governed opt-out of compliance profiles

#### 2.30 FR-243: Opt-out through committed settings only

**Statement:** A compliance profile MUST be turned off only by a change to the committed `.claude/settings.json` that the user applies. The plugin MUST NOT edit a settings file. The hooks MUST read the profile flag by parsing the `env` block of the committed project `.claude/settings.json` directly, never the merged process environment, because the merged environment carries a local override; a personal `.claude/settings.local.json` MUST NOT disable enforcement.
**Traces to:** UR-075
**Priority:** Must
**Origin:** `DECISIONS.md`, 2026-10-28, "Compliance profile flags, enforced by default". The plugin never edits a settings file (`rules/assist-plugin-rule.md:400`).

##### Scenario: Opt-out in committed settings

- **GIVEN** the user changed the committed `.claude/settings.json` to turn the FERPA profile off
- **WHEN** the next session starts
- **THEN** the FERPA controls MUST stop enforcing
- **AND** the SOC 2 and HIPAA profiles MUST stay enforced

##### Scenario: Personal settings cannot disable

- **GIVEN** `.claude/settings.local.json` holds a flag that turns the HIPAA profile off and the committed `.claude/settings.json` does not
- **WHEN** a hook reads the profile state by parsing the committed project settings file
- **THEN** the HIPAA profile MUST stay enforced
- **AND** the health check MUST report the ignored personal flag

##### Scenario: Plugin does not write settings

- **GIVEN** a project that wants to opt out
- **WHEN** the plugin explains how to opt out
- **THEN** it MUST describe the settings change for the user to apply
- **AND** it MUST NOT write `.claude/settings.json`

#### 2.31 FR-244: Disablement is logged and recorded

**Statement:** Each profile disablement MUST write a logged event that names the profile and the time, and MUST have its own `DECISIONS.md` entry. This extends the guard-disablement logging of FR-228 to profile opt-outs.
**Traces to:** UR-075
**Priority:** Must
**Origin:** `DECISIONS.md`, 2026-10-28, "Compliance profile flags, enforced by default"; FR-228.

##### Scenario: Disablement logged

- **GIVEN** the committed settings turn the HIPAA profile off
- **WHEN** the next session starts
- **THEN** the audit log MUST hold a disablement event naming the HIPAA profile and the time

##### Scenario: No decision entry

- **GIVEN** a profile is off and `DECISIONS.md` holds no entry for that disablement
- **WHEN** the health check runs
- **THEN** the report MUST list the disablement as lacking a decision entry

#### 2.32 FR-245: Governance files and stores protected from subagents

**Statement:** These six paths MUST be protected from writes by every subagent: `.claude/settings.json`, `.agent/governance/profile.json`, the confirmation store of FR-242, `.agent/logs/governance/**`, the session purpose record of FR-247, and the rule-mode store (the store that holds the advisory or blocking mode of each check, FR-238). A hook or the orchestrator remains the only writer of the last four. The FR-246 attribution decision adds no new store and no seventh path: the six protected paths are unchanged, and `.agent/governance/profile.json` (path 2) is the trust anchor for the FR-246 receiving-party allowlist.
**Traces to:** UR-075
**Priority:** Must
**Origin:** `DECISIONS.md`, 2026-10-28, "Compliance profile flags, enforced by default" (the first two paths, D-12) and "FERPA/HIPAA purpose capture, missing-purpose handling, and governance path protection" (the last four paths, D-2 settled). Adding these paths to the Write guard lists follows those records. The confirmation store is a hook-written JSONL file under `.agent/` (OQ-10 resolved, D-10; `DECISIONS.md`, 2026-10-30, "Audit-logging stores settled (per-access split, rotation and retention, confirmation-store writer)"); the exact file name is set at implementation. The rule-mode store location stays open.

##### Scenario: Subagent write denied

- **GIVEN** a subagent session
- **WHEN** it writes `.agent/governance/profile.json` or `.claude/settings.json`
- **THEN** the write bar MUST deny the write
- **AND** the log MUST hold a deny record

##### Scenario: Evidence and toggle stores denied

- **GIVEN** a subagent session
- **WHEN** it writes the confirmation store, a file under `.agent/logs/governance/`, the session purpose record, or the rule-mode store
- **THEN** the write bar MUST deny the write
- **AND** the log MUST hold a deny record

##### Scenario: Read allowed

- **GIVEN** a subagent session
- **WHEN** it reads `.agent/governance/profile.json`
- **THEN** the read MUST be allowed

#### 2.33 FR-246: FERPA disclosure recordation

**Statement:** While the FERPA profile is enforced (the default unless the project opts out under FR-243), the plugin MUST log each disclosure of education-record data to an outside party, recording the receiving party and the legitimate interest for each. The log MUST NOT accept `unstated` for either field; when the receiving party or the legitimate interest is missing, the plugin MUST deny the outbound call. The receiving party and the legitimate interest MUST be declared in the outbound call payload, and the guard (a read-only PreToolUse hook) MUST parse them from that payload. The guard MUST validate the receiving party against an allowlist held in `.agent/governance/profile.json`, and MUST deny the call when the receiving party is not on that allowlist. The control MUST apply the exceptions of 34 CFR 99.32(d), so a disclosure covered by an exception does not need a recorded entry under this control.
**Traces to:** UR-076
**Priority:** Should
**Origin:** `DECISIONS.md`, 2026-10-28, "OQ-9 resolved; FERPA control reframed, HIPAA scope tightened"; and `DECISIONS.md`, 2026-10-30, "FERPA disclosure control denies on missing attribution and is fail-closed" (the deny-on-missing-attribution clause and the control's membership in the NFR-028 security-critical set); and `DECISIONS.md`, 2026-10-30, "FR-246 disclosure attribution comes from the payload, validated against a profile.json allowlist" (PN-9 settled: payload-declared party and interest, allowlist in `profile.json`, no new store). Because a subagent assembles the payload, the `profile.json` allowlist, a file protected under FR-245, is the real control on which parties pass. Only this control is cited against 34 CFR 99.32 (https://www.govinfo.gov/content/pkg/CFR-2023-title34-vol1/xml/CFR-2023-title34-vol1-sec99-32.xml), which governs recording disclosures and requests for access, and under 99.32(a)(3)(ii) makes the legitimate interest mandatory. It is the FERPA analogue of the PHI outbound guard (FR-233). Known limit: outbound disclosure detection is imperfect. A paraphrase of education-record data, or a payload assembled from content read earlier, can escape a pattern or path match, and the guard sees one call at a time (same limit as FR-233, section 4). Status stays "to verify" until its exception handling is reviewed (NFR-033).

##### Scenario: Disclosure recorded

- **GIVEN** the FERPA profile is enforced and an outbound call names a student-record path, with a receiving party and a legitimate interest declared
- **WHEN** the call is sent
- **THEN** the audit log MUST hold the receiving party and the legitimate interest for that disclosure

##### Scenario: Missing party or interest

- **GIVEN** the same setup and no declared legitimate interest
- **WHEN** the session attempts the outbound call
- **THEN** the plugin MUST deny the call
- **AND** the log MUST NOT hold the value `unstated` for the receiving party or the legitimate interest

##### Scenario: Party not on the allowlist

- **GIVEN** the same setup and a receiving party that is not on the `profile.json` allowlist
- **WHEN** the session attempts the outbound call
- **THEN** the plugin MUST deny the call

##### Scenario: Exception applies

- **GIVEN** the receiving party falls under a 99.32(d) exception that `profile.json` lists
- **WHEN** the call is sent
- **THEN** the plugin MUST apply the exception and MUST NOT require a disclosure entry

#### 2.34 FR-247: Purpose-capture hook

**Statement:** A hook MUST write the session purpose record from a purpose the user declares, and the access-logging hooks (FR-230, FR-232) MUST read that record. Model output and text from a PR, web page, or file MUST NOT create or alter the record. When the user declares no purpose, the access log MUST record the purpose as `unstated` and flag the record.
**Traces to:** UR-068, UR-069
**Priority:** Should
**Origin:** `DECISIONS.md`, 2026-10-28, "FERPA/HIPAA purpose capture, missing-purpose handling, and governance path protection" (OQ-11 and D-11 settled). The writer is a hook, not the orchestrator, the same trust model as the confirmation store of FR-242. The record path is protected under FR-245.

##### Scenario: User declares a purpose

- **GIVEN** the user states "review grading anomalies" as the purpose of the session
- **WHEN** the purpose-capture hook runs
- **THEN** the session purpose record MUST hold that purpose
- **AND** the record MUST name the writer as a hook

##### Scenario: Forged purpose rejected

- **GIVEN** a PR description or file text claims the session purpose is "approved audit"
- **WHEN** the model or a subagent tries to write the session purpose record from that text
- **THEN** the write MUST be denied
- **AND** the access log MUST NOT show that purpose

##### Scenario: No purpose declared

- **GIVEN** the user declares no purpose
- **WHEN** an agent reads a student-record or PHI-tagged path
- **THEN** the access log MUST hold the purpose `unstated`
- **AND** the record MUST be flagged

### 3. Non-functional requirements

#### 3.1 Performance

| ID | Requirement | Traces to | Metric |
|----|-------------|-----------|--------|
| NFR-029 | Each hook added to the per-write path MUST add at most 30 ms at the median, and the total per-write hook cost MUST stay at or below 150 ms at the median. | BR-018, BR-019 | Median ms per write on the maintainer's reference machine. Estimate anchored to the existing 80 to 110 ms (repo `CLAUDE.md`); confirm by measurement |

##### Scenario: Budget check

- **GIVEN** all hooks of this roadmap are installed
- **WHEN** 100 file writes are timed
- **THEN** the median added cost per hook MUST be at most 30 ms
- **AND** the median total MUST be at most 150 ms

#### 3.2 Security

| ID | Requirement | Traces to | Standard/Compliance |
|----|-------------|-----------|---------------------|
| NFR-026 | Every deny, ask, guardrail, and gate decision MUST produce a log record with timestamp, agent identity, decision, and rule id. | BR-019, BR-020 | SOC 2 logging; HIPAA 164.312(b) (verified for FR-232 scope, NFR-033) |
| NFR-027 | Each new hook, agent, or skill MUST hold the fewest tools it needs; the guardrail MUST NOT hold write tools and no new unscoped `Bash` grant MUST appear. | BR-018 | OWASP LLM06; `agents/` `tools:` frontmatter |
| NFR-028 | A control marked security-critical (FR-214, FR-217, FR-220, FR-223, FR-231, FR-233, FR-246) MUST deny its own guarded operation class when it cannot evaluate because of an error or timeout, or when `.agent/governance/profile.json` is malformed while a profile is enforced; the denial MUST last until the file is fixed. When `profile.json` is absent the controls MUST run in log-only mode and MUST NOT hard-deny, because nothing is tagged to match. | BR-018, BR-020 | Settled exception to the Hook Fail-Open Rule, `rules/assist-plugin-rule.md:404-416`, by `DECISIONS.md`, 2026-10-28, "Compliance profile flags, enforced by default" (D-1 settled); FR-246's membership in the set by `DECISIONS.md`, 2026-10-30, "FERPA disclosure control denies on missing attribution and is fail-closed" |
| NFR-031 | Logs MUST NOT hold prompt text, file contents, or secret values; the data-accessed field MUST hold a path and a data-class tag only. | BR-020 | Data minimization; `skills/health/SKILL.md:97` |
| NFR-036 | Every change to the LLM surface made for this roadmap MUST carry `✓ LLM Security Clear` before merge, and any write-guard narrowing MUST follow a DECISIONS.md entry. | BR-018, BR-019 | `rules/assist-plugin-rule.md:335`, `:422` |

##### Scenario: Fail-closed on error (NFR-028)

- **GIVEN** the PR-posting guard throws an error while evaluating `gh pr review 42 --approve`
- **WHEN** the hook returns
- **THEN** the hook MUST deny that command
- **AND** a command outside the guarded class, such as `ls`, MUST still be allowed

##### Scenario: Absent configuration runs log-only (NFR-028)

- **GIVEN** a profile is enforced by default and `.agent/governance/profile.json` does not exist
- **WHEN** a session reads a path and sends an outbound call
- **THEN** the controls MUST log the events in log-only mode
- **AND** no control MUST hard-deny, because nothing is tagged to match

##### Scenario: Malformed configuration denies (NFR-028)

- **GIVEN** a profile is enforced and `.agent/governance/profile.json` is malformed
- **WHEN** a session attempts a guarded tagged-path operation
- **THEN** the control MUST deny the operation
- **AND** the denial MUST continue until the file is fixed

##### Scenario: Secret value kept out of the log (NFR-031)

- **GIVEN** the secret scan finds an API key in a staged file
- **WHEN** the event is logged
- **THEN** the record MUST hold the path and rule name
- **AND** the record MUST NOT hold the key value

#### 3.3 Reliability and availability

| ID | Requirement | Traces to | Metric |
|----|-------------|-----------|--------|
| NFR-030 | Chain verification MUST detect 100% of single-line edits, deletions, and reorderings in the test corpus and MUST finish a 100,000-line log in at most 10 seconds. | FR-224, FR-225 | Test corpus result; seconds (estimate for the time limit) |
| NFR-035 | Each new guard or filter MUST ship a self-test corpus with a known-safe and a known-prohibited case, report through `/assist-plugin:health`, and pass the table sync checks (`check-fsa-tables.js --check`, `sync-writing-standard.js --check`). | FR-214, FR-219, FR-233, FR-246 | Self-test pass; both scripts exit 0 |

##### Scenario: Tamper detection (NFR-030)

- **GIVEN** a test corpus with one edited, one deleted, and one reordered line
- **WHEN** verification runs on each variant
- **THEN** all three MUST be detected

#### 3.4 Retention

| ID | Requirement | Traces to | Metric |
|----|-------------|-----------|--------|
| NFR-032 | Audit and subagent logs MUST rotate by size, each new segment MUST carry the prior segment's final chain hash so the hash chain verifies across the cut, and segments MUST be retained for at least 12 months. | BR-019, BR-020 | 12 months (BRD A-1); the rotation size is an estimate until measured against NFR-030 (NFR-033). Replaces the 500-line cap on `fsa-log.jsonl`, `skills/health/SKILL.md:28` (D-6, OQ-3 resolved by `DECISIONS.md`, 2026-10-30, "Audit-logging stores settled (per-access split, rotation and retention, confirmation-store writer)") |

##### Scenario: Rotation keeps the chain

- **GIVEN** the log reaches its configured rotation size (an estimate until measured)
- **WHEN** rotation runs
- **THEN** the first line of the new segment MUST hold the hash of the last line of the old segment
- **AND** chain verification MUST pass across the cut

#### 3.5 Compliance

| ID | Requirement | Traces to | Regulation/Standard |
|----|-------------|-----------|---------------------|
| NFR-033 | A compliance control that rests on a vendor blog or an unverified citation MUST be labeled directional, and a control MUST NOT be marked complete before verification against the regulation text. Status: the HIPAA audit control (FR-232) is verified against 45 CFR 164.312(b), which requires mechanisms that record and examine activity, and the control implements that one required technical safeguard, not full HIPAA compliance. The FERPA internal access log (FR-230) carries no 34 CFR 99.32 citation and is general governance support, labeled directional. The FERPA disclosure-recordation control (FR-246) is the only control cited against 34 CFR 99.32; it stays "to verify" until its exception handling is reviewed. The exact log rotation size of NFR-032 is an estimate until measured against the NFR-030 verification-time target. The severity-policy basis (FR-237) is settled, but the concrete policy text is not yet approved, so the severity thresholds stay unapproved and no rule blocks on severity. The figures "under 50% mitigation" and "18% governance councils" MUST NOT serve as a threshold. | BR-020, BR-021 | 45 CFR 164.312(b) (FR-232, verified); 34 CFR 99.32 (FR-246 only, to verify) |
| NFR-034 | A rule MUST NOT move from advisory to blocking unless its baseline precision is at least 90% (estimate, BRD A-6). | BR-022 | Alert-fatigue control; helpmetest and GitLab blogs (directional) |

##### Scenario: Unverified FERPA disclosure control (NFR-033)

- **GIVEN** the FERPA disclosure-recordation control (FR-246) has no verification note
- **WHEN** the register check runs
- **THEN** the control status MUST read "to verify" and not "complete"

##### Scenario: FERPA internal log not cited as 99.32 (NFR-033)

- **GIVEN** the FERPA internal access log (FR-230) sits in the control register
- **WHEN** the register check runs
- **THEN** the entry MUST NOT cite 34 CFR 99.32 and MUST read as general governance support

##### Scenario: HIPAA control states its scope (NFR-033)

- **GIVEN** the HIPAA audit control (FR-232) is marked verified
- **WHEN** the register check runs
- **THEN** the entry MUST cite 45 CFR 164.312(b) as one safeguard
- **AND** the entry MUST NOT claim full HIPAA compliance

##### Scenario: Low-precision promotion (NFR-034)

- **GIVEN** a baseline precision of 70%
- **WHEN** the rule is switched to blocking
- **THEN** the switch MUST be refused with the precision value

### 4. Scope

#### In scope (system behaviors)

- All behaviors FR-214 to FR-247 and NFR-026 to NFR-036.

#### Out of scope (system exclusions)

| Excluded item | Reason | Deferred to |
|---------------|--------|-------------|
| Gaps 5, 7, 8, 9 (`llm-security-checklist.md:329`, `:331-333`) | Not in the roadmap | Future roadmap |
| Cryptographic signing of the audit log with an external key | The roadmap asks for a hash chain only | Future roadmap |
| Content-level PHI detection beyond configured patterns and tagged paths | Paraphrase detection has no accepted method here | Future roadmap |
| Session-level taint tracking that denies a payload holding content earlier read from a PHI-tagged path or student-record path (FR-233, FR-246) | A per-call hook has no session state; no tracking mechanism is named | Future roadmap |
| Bash write coverage through symlinks and variable-built commands | Existing known limit of the write bar | Future roadmap |

### 5. Constraints

- Hooks go through an ES5 entry file with a `timeout` in `hooks.json` and record failures in `hook-health.jsonl` (`rules/assist-plugin-rule.md:411-412`).
- Deny only through `permissionDecision: "deny"` with exit 0 (`rules/assist-plugin-rule.md:409`).
- Write guard values live in `hooks/lib/fsa-paths.js` and must match `rules/assist-plugin-rule.md:420-434`; run `node plugins/assist-plugin/scripts/check-fsa-tables.js --check` after an edit.
- Keep counts and lists in sync when an agent or skill is added (repo `CLAUDE.md`, "Keeping counts in sync").

#### Dependencies that need a user decision in DECISIONS.md

| ID | Decision needed | Affects |
|----|-----------------|---------|
| D-1 | Settled (`DECISIONS.md`, 2026-10-28, "Compliance profile flags, enforced by default"): fail-closed on a malformed configuration while a profile is enforced; log-only when the configuration is absent. Exception to the Hook Fail-Open Rule (`rules/assist-plugin-rule.md:404-416`) | NFR-028, FR-214, FR-217, FR-220, FR-223, FR-231, FR-233, FR-246 |
| D-2 | Settled (`DECISIONS.md`, 2026-10-28, "FERPA/HIPAA purpose capture, missing-purpose handling, and governance path protection"): the confirmation store, `.agent/logs/governance/**`, the session purpose record, and the rule-mode store are added to the Write guard lists (`rules/assist-plugin-rule.md:420-434`) and protected from every subagent write; any later narrowing of an entry needs the same record first | FR-245, FR-223, FR-224 |
| D-3 | Settled (`DECISIONS.md`, 2026-10-30, "Gap-3 push grant and gap-6 revision-loop cap settled"): narrow `Bash(git push *)` to `Bash(git push origin *)` in `.claude/settings.local.json`; the user applies it because the plugin never edits settings, and gap 3 closes once applied | FR-216 |
| D-4 | Basis settled (`DECISIONS.md`, 2026-10-30, "Severity-policy basis and SARIF writer settled"); the user's formal approval of the concrete policy text, a later `DECISIONS.md` entry, is still pending | FR-237 |
| D-5 | Settled (`DECISIONS.md`, 2026-10-30, "Audit-logging stores settled (per-access split, rotation and retention, confirmation-store writer)"): identity and authorizer fields in `fsa-log.jsonl` rows, and `audit.jsonl` as the per-access store holding operation and data-accessed (path and class tag) | FR-226, FR-227, NFR-031 |
| D-6 | Settled (same 2026-10-30 entry): size-based rotation replaces the 500-line cap on `fsa-log.jsonl`, with the prior segment's final chain hash carried into each new segment and at least 12 months of retention | NFR-032, FR-228 |
| D-7 | Settled (`DECISIONS.md`, 2026-10-30, "Gap-3 push grant and gap-6 revision-loop cap settled"): cap of 10 with two consecutive LGTMs as the normal pass; escalation at the cap | FR-218 |
| D-8 | Settled (`DECISIONS.md`, 2026-10-30, "Judgement-gate evidence and the /do human authorizer settled"): in-plugin scanner exit code plus a distinct reviewer verdict (OQ-1) | FR-221 |
| D-9 | Settled (`DECISIONS.md`, 2026-10-30, "Severity-policy basis and SARIF writer settled"): the `/do` orchestrator writes the SARIF file; no subagent write path is added | FR-241 |
| D-10 | Settled (`DECISIONS.md`, 2026-10-30, "Audit-logging stores settled (per-access split, rotation and retention, confirmation-store writer)"): a `UserPromptSubmit` hook writes the confirmation store as JSONL under `.agent/`. Its protection from subagent writes is settled under D-2 and FR-245 | FR-214, FR-242, FR-245 |
| D-11 | Settled (`DECISIONS.md`, 2026-10-28, "FERPA/HIPAA purpose capture, missing-purpose handling, and governance path protection"): a hook writes the session purpose record from a user-declared purpose; a missing purpose is logged `unstated` and flagged, never denied on that alone (OQ-6 settled) | FR-230, FR-247 |
| D-12 | Settled (`DECISIONS.md`, 2026-10-28, "Compliance profile flags, enforced by default"): add `.claude/settings.json` and `.agent/governance/profile.json` to the protected paths that every subagent is denied (Write guard lists, `rules/assist-plugin-rule.md:420-434`) | FR-245, FR-231, FR-243 |

Each later profile disablement (FR-244) needs its own `DECISIONS.md` entry when it happens; it is not a standing dependency.

### 6. Traceability matrix

| BR | UR | FR | NFR | Status |
|----|----|----|-----|--------|
| BR-018 | UR-059 | FR-214, FR-242 | NFR-026, NFR-027, NFR-028, NFR-029, NFR-035, NFR-036 | Draft |
| BR-018 | UR-060 | FR-215, FR-216, FR-217 | NFR-028, NFR-031 | Draft |
| BR-018 | UR-061 | FR-218 | NFR-036 | Draft |
| BR-018 | UR-062 | FR-219, FR-220 | NFR-027, NFR-028, NFR-035 | Draft |
| BR-019 | UR-063 | FR-221 | NFR-026 | Draft |
| BR-019 | UR-064 | FR-222, FR-223 | NFR-028, NFR-036 | Draft |
| BR-019, BR-020 | UR-065 | FR-224, FR-225 | NFR-030, NFR-032 | Draft |
| BR-020 | UR-066 | FR-226, FR-227 | NFR-026, NFR-031 | Draft |
| BR-020 | UR-067 | FR-228, FR-229 | NFR-032 | Draft |
| BR-020 | UR-068 | FR-230, FR-231, FR-247 | NFR-028, NFR-033 | Draft |
| BR-020 | UR-069 | FR-231, FR-232, FR-233, FR-234, FR-247 | NFR-028, NFR-033, NFR-035 | Draft |
| BR-020 | UR-075 | FR-243, FR-244, FR-245 | NFR-026, NFR-028, NFR-036 | Draft |
| BR-020 | UR-076 | FR-246 | NFR-026, NFR-028, NFR-031, NFR-033, NFR-035 | Draft |
| BR-021 | UR-070 | FR-235, FR-236 | NFR-033 | Draft |
| BR-022 | UR-071 | FR-237, FR-238 | NFR-034 | Draft |
| BR-022 | UR-072 | FR-239 | NFR-034 | Draft |
| BR-022 | UR-073 | FR-240 | | Draft |
| BR-022 | UR-074 | FR-241 | | Draft |

No orphans. No BR is a dead end. NFR-029 to NFR-036 trace to BR or FR as their origin requires.

Gap traceability:

| Gap | Severity | Requirement | Source line |
|-----|----------|-------------|-------------|
| 2 (LLM01) | High | FR-214, FR-242, FR-245 | `llm-security-checklist.md:326` |
| 3 (LLM02) | High | FR-215, FR-216, FR-217 | `llm-security-checklist.md:327` |
| 4 (LLM09) | Medium | FR-221, FR-222, FR-223 | `llm-security-checklist.md:328` |
| 6 (LLM10) | Medium | FR-218 | `llm-security-checklist.md:330` |

### 7. Glossary

| Term | Definition |
|------|-----------|
| Control register | A table mapping each control to ASI items, an AI RMF function, an owner role, and a cadence |
| Data class | A label such as student-record or PHI attached to paths by glob |
| Routing | The decision for a finding: `block-merge`, `inline-comment`, or `log-only` |
| Session purpose record | The record of the purpose the user declared for the session; a hook writes it and the access-logging hooks read it (FR-247) |
| Rule-mode store | The store holding the advisory or blocking mode of each check (FR-238, FR-245) |
| Disclosure recordation | The log of each disclosure of education-record data to an outside party, with the receiving party and legitimate interest (FR-246) |

### 8. Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-28 | [Author] | Initial draft |
| 1.1 | 2026-10-28 | [Author] | Align with `DECISIONS.md` 2026-10-28: FR-231 names the two-file configuration; FR-230, FR-232, FR-233, FR-234 read as enforced-by-default with opt-out; NFR-028 records the settled fail-closed and log-only behavior (D-1 settled); FR-243 to FR-245 added for the governed opt-out; D-12 added |
| 1.2 | 2026-10-30 | [Author] | Align with `DECISIONS.md` 2026-10-28 entries on purpose capture and OQ-9: FR-247 added (purpose-capture hook; OQ-11, D-11 settled); FR-230 reframed as an internal log that denies nothing on a missing purpose (OQ-6 settled) and carries no 99.32 citation; FR-246 added (FERPA disclosure recordation, the only 99.32 control); FR-232 verified against 45 CFR 164.312(b) with tightened scope; FR-245 extended to six protected paths (D-2 settled); NFR-033 status updated; UR-076 traced. Also aligns with `DECISIONS.md` 2026-10-30, "FERPA disclosure control denies on missing attribution and is fail-closed": FR-246 gains the deny-on-missing-attribution clause; FR-246 added to the NFR-028 security-critical set. Also aligns with `DECISIONS.md` 2026-10-30, "FR-246 disclosure attribution comes from the payload, validated against a profile.json allowlist" (PN-9 settled; note at 1.2, no version bump): FR-246 states that the receiving party and legitimate interest are payload-declared and parsed by the guard, validated against a `profile.json` allowlist, and denied when missing or off the allowlist; FR-245 states that the six paths are unchanged and `profile.json` is the allowlist's trust anchor |
| 1.3 | 2026-10-30 | [Author] | Align with `DECISIONS.md` 2026-10-30, "Audit-logging stores settled (per-access split, rotation and retention, confirmation-store writer)": NFR-032 states size-based rotation with the prior segment's final chain hash carried across the cut and at least 12 months of retention (D-6, OQ-3 resolved); FR-242 names a `UserPromptSubmit` hook writing JSONL under a path protected by FR-245 (D-10, OQ-10 resolved); FR-227 two-file split ratified (D-5, OQ-4 resolved). "Gap-3 push grant and gap-6 revision-loop cap settled": FR-218 cap raised from 3 to 10 with two consecutive LGTMs as the normal pass and a continue/waive/abort escalation at the cap (D-7, OQ-2 resolved); FR-216 records the settled origin-only grant (D-3). "Judgement-gate evidence and the /do human authorizer settled": FR-221 takes the scanner exit code from the plugin's own scripts, with an external scanner optional (D-8, OQ-1 resolved); FR-227 names the plan approver as the authorizer, `none` with a reason otherwise (OQ-7 resolved). "Severity-policy basis and SARIF writer settled": FR-241 names the `/do` orchestrator as the SARIF writer (D-9, OQ-8 resolved); FR-237 and NFR-033 record the settled severity basis, with formal policy approval still pending (D-4 partial, FR-238 unchanged). Rotation size stays an estimate. No trace changes. Version bumped to 1.3 in lockstep with the BRD, URD, and JSON because the URD open-questions list and BRD A-4 changed |
