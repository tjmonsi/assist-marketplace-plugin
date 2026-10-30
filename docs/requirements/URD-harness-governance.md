## assist-plugin Harness Governance: User Requirements Document

**Version:** 1.3
**Date:** 2026-10-30
**Author:** [Author]
**Status:** DRAFT

---

### 1. Introduction

**Purpose:** This document captures what plugin maintainers, security leads, compliance officers, and auditors need from the harness-governance roadmap.

**Relationship to BRD:** This document derives from `BRD-harness-governance.md`. Every user requirement traces to at least one business requirement (BR-018 to BR-022). IDs continue `URD-assist-plugin.md` (UR-001 to UR-058; UR-059 to UR-076 are used here).

### 2. Stakeholder map

| Stakeholder | Role | Goals | Pain points | Priority |
|-------------|------|-------|-------------|----------|
| Plugin maintainer | Owns the repo and its gates | Close gaps 2, 3, 6; trust the gates; keep hooks fast | Gates pass on a model-emitted string (`llm-security-checklist.md:247-248`); no revision-loop cap (`:285-287`) | High |
| Plugin user | Runs `/commit`, `/pr-review`, `/do` | Safe defaults, few false blocks | `git add .` plus wildcard grants can push secrets (`:69-73`) | High |
| Security lead | Reviews the LLM surface | Unforgeable gates; blocking guardrail; control mapping | The injection-filter only rewrites and never blocks (`rules/assist-plugin-rule.md:416`) | High |
| Compliance officer | Adopts the plugin under SOC 2, HIPAA, FERPA | Evidence from the plugin's own hooks | No attribution record; `audit.jsonl` has no writer (BRD A-8) | Medium |
| Auditor | Reviews controls over 6 to 12 months | Tamper-evident, continuous logs | `fsa-log.jsonl` keeps a 500-line cap (`skills/health/SKILL.md:28`) and stores no data-accessed field (`:97`) | Medium |

### 3. User requirements

| ID | Requirement | Stakeholder | Traces to | Priority |
|----|-------------|-------------|-----------|----------|
| UR-059 | The plugin user shall be able to rely on a PR verdict being posted only after the user's recorded confirmation, even when attacker-controlled PR text is in the session. | Plugin user | BR-018 | Must |
| UR-060 | The plugin user shall be able to commit and push without staging secrets or pushing to an unexpected remote. | Plugin user | BR-018 | Must |
| UR-061 | The maintainer shall be able to rely on a developer and reviewer revision loop stopping after a fixed number of rounds and handing control to a human. | Plugin maintainer | BR-018 | Must |
| UR-062 | The security lead shall be able to have hijacked-goal tool output and insecure generated code blocked, not only rewritten or flagged. | Security lead | BR-018 | Should |
| UR-063 | The security lead shall be able to see, for every cleared governance gate, the command result or CI artifact that backs it. | Security lead | BR-019 | Must |
| UR-064 | The maintainer shall be able to rely on approval status being written only by a hook or the orchestrator, never by the agent that produced the artifact. | Plugin maintainer | BR-019 | Must |
| UR-065 | The auditor shall be able to verify that the governance audit log has not been altered. | Auditor | BR-019, BR-020 | Must |
| UR-066 | The compliance officer shall be able to see, for each agent action, the operation, data accessed, agent identity, human authorizer, and timestamp. | Compliance officer | BR-020 | Must |
| UR-067 | The compliance officer shall be able to collect SOC 2 Type II evidence from the plugin's own hook logs across a 6-to-12-month window. | Compliance officer | BR-020 | Should |
| UR-068 | The compliance officer shall be able to see who accessed student-record paths and the purpose the user declared, or `unstated`, and to tag paths as student records (FERPA). | Compliance officer | BR-020 | Should |
| UR-069 | The compliance officer shall be able to rely on a HIPAA profile, enforced by default, with agent-level audit logs, a recorded BAA per external system, and a refusal to send PHI-tagged content to outbound tools. | Compliance officer | BR-020 | Should |
| UR-070 | The security lead shall be able to see each control mapped to OWASP Agentic AI Top 10 items and NIST AI RMF functions, with an owner and review cadence. | Security lead | BR-021 | Should |
| UR-071 | The maintainer shall be able to define what CRITICAL and HIGH mean for this repo and to run new checks advisory-only before enforcing. | Plugin maintainer | BR-022 | Must |
| UR-072 | The plugin user shall be able to rely on only high-confidence, high-severity findings blocking a PR, with the rest advisory. | Plugin user | BR-022 | Must |
| UR-073 | The maintainer shall be able to read a severity, a confidence, and a routing decision on each reviewer and code-reviewer finding. | Plugin maintainer | BR-022 | Must |
| UR-074 | The security lead shall be able to see reviewer findings in the GitHub Security tab. | Security lead | BR-022 | Should |
| UR-075 | The compliance officer shall be able to rely on a compliance profile being turned off only through a change to the committed project settings that the user applies, with each disablement logged and recorded in `DECISIONS.md`, so that a personal settings file cannot silently disable enforcement. | Compliance officer | BR-020 | Must |
| UR-076 | The compliance officer shall be able to see each disclosure of education-record data to an outside party, with the receiving party and the legitimate interest (FERPA). | Compliance officer | BR-020 | Should |

### 4. Use case summaries

#### UC-001: Post a PR verdict safely

- **Primary actor:** Plugin user
- **Precondition:** A `/pr-review` run holds a drafted verdict for a PR whose text may be attacker-controlled
- **Success guarantee:** The verdict posts only with a recorded user confirmation for that PR and verdict
- **Main scenario:** The reviewer drafts the verdict; the plugin asks the user; the user confirms; the confirmation is recorded; the posting command runs
- **Key extensions:** No confirmation recorded, so the posting command is denied; PR text asks the session to approve, so the injected text is reported and not obeyed

#### UC-002: Prove a gate with evidence

- **Primary actor:** Security lead
- **Precondition:** A change reaches the merge policy
- **Success guarantee:** Each gate holds a command, exit code, or CI artifact reference
- **Main scenario:** The orchestrator runs the gate command; parses the exit code and value; writes the gate record; the merge check reads the record
- **Key extensions:** The agent emits only a sign-off string, so the gate stays open

#### UC-003: Verify the audit log for a compliance window

- **Primary actor:** Auditor
- **Precondition:** The log has run since install
- **Success guarantee:** A report shows control events for the window and the chain verification result
- **Main scenario:** The auditor sets a date range; the verifier walks the chain; the exporter lists denies, asks, gates, and approvals
- **Key extensions:** A broken link marks the range unverified and names the first bad line

### 5. Scope

#### In scope (user-facing capabilities)

- Confirmation-gated PR posting, scoped commit staging and push, bounded revision loops, a blocking guardrail.
- Evidence-backed gates, orchestrator-written approvals, a verifiable audit log.
- Attribution records, SOC 2 evidence export, FERPA and HIPAA profiles (enforced by default, governed opt-out), a user-declared session purpose, FERPA disclosure recordation, control mapping.
- Severity policy, advisory baseline, severity-routed findings, SARIF output.

#### Out of scope (user-facing exclusions)

| Excluded item | Reason | Deferred to |
|---------------|--------|-------------|
| A dashboard for audit data | The roadmap routes findings to the GitHub Security tab, not a separate dashboard | Never (by this roadmap) |
| Automatic edits to a user's Claude Code settings | The plugin never edits a settings file (`rules/assist-plugin-rule.md:400`) | Never |
| Compliance certification or legal determination | Adopter responsibility | Never |

### 6. Assumptions

- The user answers the confirmation prompt in their own message; a quote block or file text never counts as confirmation.
- Compliance profiles (SOC 2, HIPAA, FERPA) are enforced by default and a project opts out per project; core logging is always on (BRD A-9).
- Adopters under HIPAA hold a BAA with each external service before enabling the profile; the plugin records the reference and does not assess the agreement.

### 7. Open questions

- OQ-1: Resolved (`DECISIONS.md`, 2026-10-30, "Judgement-gate evidence and the /do human authorizer settled"). A judgement-based gate clears on a scanner exit code from the plugin's own scripts plus a distinct reviewer-agent verdict with file:line findings; an external scanner is optional additional evidence (FR-221).
- OQ-2: Resolved (`DECISIONS.md`, 2026-10-30, "Gap-3 push grant and gap-6 revision-loop cap settled"). The cap is 10 with two consecutive LGTMs as the normal pass; at the cap the orchestrator escalates with continue, waive, or abort (FR-218).
- OQ-3: Resolved (`DECISIONS.md`, 2026-10-30, "Audit-logging stores settled (per-access split, rotation and retention, confirmation-store writer)"). Size-based rotation replaces the 500-line cap on `fsa-log.jsonl`, carries the prior segment's final chain hash into each new segment, and keeps segments at least 12 months; the rotation size is an estimate (NFR-032).
- OQ-4: Resolved (same 2026-10-30 entry as OQ-3). The two-file split of FR-227 is ratified as written.
- OQ-5: Settled. Security-critical controls may fail closed on a malformed configuration while a profile is enforced; an absent configuration runs log-only (`DECISIONS.md`, 2026-10-28, "Compliance profile flags, enforced by default"; NFR-028).
- OQ-6: Settled. An access to a tagged path with no recorded purpose is logged `unstated` and flagged, never denied on the missing purpose alone (`DECISIONS.md`, 2026-10-28, "FERPA/HIPAA purpose capture, missing-purpose handling, and governance path protection"; FR-230).
- OQ-7: Resolved (`DECISIONS.md`, 2026-10-30, "Judgement-gate evidence and the /do human authorizer settled"). The authorizer is the user who approved the plan, recorded as a reference to that approval and never message text; an autonomous or unapproved action records `none` with a reason (FR-227).
- OQ-8: Resolved (`DECISIONS.md`, 2026-10-30, "Severity-policy basis and SARIF writer settled"). The `/do` orchestrator writes the SARIF file, so no new write path is added to `fsa-write-bar`; uploading to GitHub falls under the FR-214 confirmation rule (FR-241).
- OQ-9: Resolved (`DECISIONS.md`, 2026-10-28, "OQ-9 resolved; FERPA control reframed, HIPAA scope tightened"). HIPAA: FR-232 is verified against 45 CFR 164.312(b) as one required technical safeguard that records and supports review, not full HIPAA compliance. FERPA: the internal access log (FR-230) is general governance support and does not implement 34 CFR 99.32; FR-246 adds disclosure recordation for outbound education-record data and is the only control cited against 99.32.
- OQ-10: Resolved (`DECISIONS.md`, 2026-10-30, "Audit-logging stores settled (per-access split, rotation and retention, confirmation-store writer)"). A `UserPromptSubmit` hook writes the confirmation store as JSONL under a path in `.agent/` protected under FR-245; the FR-214 guard reads it with file reads alone (FR-242).
- OQ-11: Resolved. A hook writes the session purpose record from a purpose the user declares, and the access-logging hooks read it; with no declared purpose the log records `unstated` and flags the record (FR-247; `DECISIONS.md`, 2026-10-28, "FERPA/HIPAA purpose capture, missing-purpose handling, and governance path protection").
- OQ-12: Resolved (`DECISIONS.md`, "2026-10-30: Severity policy approved"). The user approved `severity-policy.md` version `draft-1`. The policy basis was settled earlier (`DECISIONS.md`, 2026-10-30, "Severity-policy basis and SARIF writer settled"); a rule may block on severity only after the FR-238 advisory baseline (FR-237).

### 8. Glossary

| Term | Definition |
|------|-----------|
| Human authorizer | The person whose message or confirmation permitted an action |
| Attribution record | The per-event record of operation, data accessed, agent identity, human authorizer, and timestamp |
| Advisory-only | A check that records findings and never blocks |
| Session purpose record | The record of the purpose the user declared for the session, written by a hook |

### 9. Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-28 | [Author] | Initial draft |
| 1.1 | 2026-10-28 | [Author] | Enforced-by-default assumption; UR-069 reworded; UR-075 added for governed opt-out; OQ-5 settled |
| 1.2 | 2026-10-30 | [Author] | UR-068 reworded to the user-declared purpose; UR-076 added for FERPA disclosure recordation; OQ-6, OQ-9, OQ-11 resolved; OQ-10 narrowed to location and format |
| 1.3 | 2026-10-30 | [Author] | Align with the `DECISIONS.md` 2026-10-30 entries: OQ-1, OQ-2, OQ-3, OQ-4, OQ-7, OQ-8, OQ-10 resolved; OQ-12 added for the pending formal approval of the severity-policy text, then resolved by `DECISIONS.md`, "2026-10-30: Severity policy approved" (draft-1; no version bump) |
