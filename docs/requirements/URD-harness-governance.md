## assist-plugin Harness Governance: User Requirements Document

**Version:** 1.4
**Date:** 2026-11-24
**Author:** [Author]
**Status:** Approved (Themes 1 to 4); DRAFT (Theme 5, Group A, and Theme 6, Group B)

---

### 1. Introduction

**Purpose:** This document captures what plugin maintainers, security leads, compliance officers, and auditors need from the harness-governance roadmap.

**Relationship to BRD:** This document derives from `BRD-harness-governance.md`. Every user requirement traces to at least one business requirement (BR-018 to BR-024). IDs continue `URD-assist-plugin.md` (UR-001 to UR-058; UR-059 to UR-086 are used here). Version 1.4 adds two DRAFT groups: Group A (UR-077 to UR-080), an evaluation benchmark harness, and Group B (UR-081 to UR-086), reviewer and review-machinery capabilities.

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
| UR-077 | Group A. The maintainer shall be able to define in-house golden tasks for coding and for spec writing, each with a reference and a way to grade it. | Plugin maintainer | BR-023 | Should |
| UR-078 | Group A. The maintainer shall be able to read, for each suite, a pass@1 value for coding and a structural score and a separate judge score for specs. | Plugin maintainer | BR-023 | Should |
| UR-079 | Group A. The maintainer shall be able to see at release time whether the score of a suite fell compared with the previous release. | Plugin maintainer | BR-023 | Should |
| UR-080 | Group A. The maintainer shall be able to rely on benchmark scores not being inflated by training-data contamination, overfitting to the cases, judge bias, or flaky tests. | Plugin maintainer | BR-023 | Should |
| UR-081 | Group B. The plugin user shall be able to rely on every review checking the recurring defect classes of a named checklist, with each unchecked item shown. | Plugin user | BR-024 | Should |
| UR-082 | Group B. The maintainer shall be able to see, for each review round, which findings are new, fixed, open, or withdrawn, and to rely on the loop escalating when fixes keep producing new findings. | Plugin maintainer | BR-024 | Should |
| UR-083 | Group B. The security lead shall be able to rely on an approval only when the reviewer examined every path it was sent, against the revision that is current at the gate. | Security lead | BR-019, BR-024 | Should |
| UR-084 | Group B. The maintainer shall be able to see, for each reviewer lane and checklist item, how many findings the user judged true or false, and to approve the checklist changes that follow. | Plugin maintainer | BR-022, BR-024 | Should |
| UR-085 | Group B. The plugin user shall be able to rely on a PR review being posted only against the head revision it reviewed, and on a posting retry never duplicating a review. | Plugin user | BR-018, BR-024 | Should |
| UR-086 | Group B. The maintainer shall be able to rely on a finding's severity coming from a fixed catalog entry and not from the reviewer's free text. | Plugin maintainer | BR-022, BR-024 | Should |

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

#### UC-004: Measure a release against the previous one (Group A)

- **Primary actor:** Plugin maintainer
- **Precondition:** Golden tasks exist and the previous release's scores are stored
- **Success guarantee:** The maintainer sees, per suite, the current and previous scores and any regression finding, and the scoreboard holds a row for the release
- **Main scenario:** The maintainer requests the benchmark section in the release check; the harness runs each coding case k times and scores it from the hidden suite exit code; it scores each spec case by the structural checklist and, when a judge is configured, by the judge; it compares the scores over the cases both releases hold
- **Key extensions:** No sandbox backend, so coding cases read not-run; no previous release, so the section reports no baseline; a judge-score decline alone is advisory

#### UC-005: Re-review after a fix round (Group B)

- **Primary actor:** Plugin maintainer
- **Precondition:** A gate returned findings and a fix pass changed the artifact
- **Success guarantee:** The re-review gives a status for every prior finding, marks any finding the fix caused, and names the revision it reviewed
- **Main scenario:** The orchestrator dispatches the re-review with the prior findings, the user's false labels, and the changed paths; the reviewer evaluates the checklist items that apply and reports each prior finding as fixed, open, or withdrawn; the orchestrator counts the gate only on a verdict for the current revision
- **Key extensions:** A fix causes a new finding, so it reads fix-induced; the same finding stays open after two fix passes, so the orchestrator offers continue, waive, or abort with the round history

### 5. Scope

#### In scope (user-facing capabilities)

- Confirmation-gated PR posting, scoped commit staging and push, bounded revision loops, a blocking guardrail.
- Evidence-backed gates, orchestrator-written approvals, a verifiable audit log.
- Attribution records, SOC 2 evidence export, FERPA and HIPAA profiles (enforced by default, governed opt-out), a user-declared session purpose, FERPA disclosure recordation, control mapping.
- Severity policy, advisory baseline, severity-routed findings, SARIF output.
- Group A (DRAFT): golden tasks, execution and checklist grading, an optional separate judge score, pass@1 over k runs, release-over-release regression, and controls for contamination, overfitting, judge bias, and flakiness.
- Group B (DRAFT): reviewer checklists by lane, a per-round iteration record, stale-verdict and head-revision guards, catalog-fixed severity, and a feedback loop from the user's labels to checklist changes.

#### Out of scope (user-facing exclusions)

| Excluded item | Reason | Deferred to |
|---------------|--------|-------------|
| A dashboard for audit data | The roadmap routes findings to the GitHub Security tab, not a separate dashboard | Never (by this roadmap) |
| Automatic edits to a user's Claude Code settings | The plugin never edits a settings file (`rules/assist-plugin-rule.md:400`) | Never |
| Compliance certification or legal determination | Adopter responsibility | Never |
| A public leaderboard or a score comparison with outside models (Group A) | Only in-house runs on one harness version compare | Never |
| A dashboard for benchmark or reviewer-precision data (Groups A and B) | The scoreboard and the checklist-change report are files in the repository | Never (by this roadmap) |
| A merge gate that blocks on a judge score or a critic score (Groups A and B) | Both are advisory signals | Future roadmap |

### 6. Assumptions

- The user answers the confirmation prompt in their own message; a quote block or file text never counts as confirmation.
- Compliance profiles (SOC 2, HIPAA, FERPA) are enforced by default and a project opts out per project; core logging is always on (BRD A-9).
- Adopters under HIPAA hold a BAA with each external service before enabling the profile; the plugin records the reference and does not assess the agreement.
- Group A: the maintainer authors the golden tasks and the hidden suites in-house. A full benchmark run costs an estimated $25 to $75, so the maintainer requests it for a release and does not run it on every change (BRD A-12).
- Group B: the user labels reviewer findings through a user-run step. An agent's judgment of a finding is never a label (NFR-034, FR-309).

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
- OQ-12: Resolved (`DECISIONS.md`, "2026-10-30: Severity policy approved", re-approved by "2026-10-31: Severity policy approved"). The user approved `severity-policy.md` version `draft-2` (first approved at `draft-1`, superseded). The policy basis was settled earlier (`DECISIONS.md`, 2026-10-30, "Severity-policy basis and SARIF writer settled"); a rule may block on severity only after the FR-238 advisory baseline (FR-237).
- OQ-13: Settled (Group A; `DECISIONS.md`, 2026-11-25). A default release-check run reports the last stored evaluation scoreboard and never runs the suite; an on-request run goes through the Group A harness (FR-273, FR-274). The question of a default full run is answered no. A full run is an estimated $25 to $75 (BRD A-12). The FR-250 delta in `FR-NFR-assist-plugin.md` is applied (D-15). The Group A "benchmark section" is the suite runner; the FR-250 "benchmark scoreboard section" is the reporting view.
- OQ-14: Open (Group A). No default is settled for the run count k, the regression margin (FR-277), the validation run count (FR-259), or the judge run count (FR-285); each is a configured value.
- OQ-15: Open (Group A). Where do reference solutions and hidden suites live? The marketplace repository is published, and the research report's layout puts `reference/` under the shipped plugin tree, which conflicts with FR-261 (D-16).
- OQ-16: Settled (Group A). The judge is of the same model family as the agent now, with candidate-order randomization, rubric anchoring, and a human-agreement check at each benchmark release (FR-282). A judge of a different family is a future enhancement, not a current requirement.
- OQ-17: Provisionally settled (Group B; `DECISIONS.md`, 2026-11-25), not closed. Each value is provisional and to be revised with data: escalation count 2 for FR-300 and FR-301; FR-313 retirement floor 0.5 and minimum 10 labeled findings; FR-314 addition count 3; judge-agreement floor Spearman rho at least 0.7 or Cohen kappa at least 0.6; seeded-defect sample 20; reviewer precision floor 0.7 and recall floor 0.5. Values with no figure already in the requirements are labeled "provisional, no empirical basis yet" (table in `FR-NFR-harness-governance.md`, section 5).
- OQ-18: Settled (Group B; `DECISIONS.md`, 2026-11-25). The `qa` agent applies the test-integrity lane in the Testing Gate (FR-291, D-17).
- OQ-19: Settled (Group B; `DECISIONS.md`, 2026-11-25). The user re-approved FR-237 with the severity catalog added, so FR-306 and FR-307 are approved and active (D-14). This authorizes the capability and does not implement it.

### 8. Glossary

| Term | Definition |
|------|-----------|
| Human authorizer | The person whose message or confirmation permitted an action |
| Attribution record | The per-event record of operation, data accessed, agent identity, human authorizer, and timestamp |
| Advisory-only | A check that records findings and never blocks |
| Session purpose record | The record of the purpose the user declared for the session, written by a hook |
| Golden task | A task with a reference and a way to grade it, written in-house (Group A) |
| pass@1 | The probability that one run of a coding case passes, estimated as passes over completed runs (Group A) |
| Structural score | The fraction of a spec case's deterministic checklist items that pass; a floor, not a measure of quality (Group A) |
| Judge score | The mean score an LLM-as-judge gives the subjective rubric items of a spec case; advisory (Group A) |
| Review lane | A review focus with its own checklist: defect-depth, test-integrity, or architecture-safety (Group B) |
| Fix-induced finding | A finding that a change made since the previous review pass causes (Group B) |
| Disposition | The user's label of a reviewer finding as true, false, or deferred (Group B) |

### 9. Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-28 | [Author] | Initial draft |
| 1.1 | 2026-10-28 | [Author] | Enforced-by-default assumption; UR-069 reworded; UR-075 added for governed opt-out; OQ-5 settled |
| 1.2 | 2026-10-30 | [Author] | UR-068 reworded to the user-declared purpose; UR-076 added for FERPA disclosure recordation; OQ-6, OQ-9, OQ-11 resolved; OQ-10 narrowed to location and format |
| 1.3 | 2026-10-30 | [Author] | Align with the `DECISIONS.md` 2026-10-30 entries: OQ-1, OQ-2, OQ-3, OQ-4, OQ-7, OQ-8, OQ-10 resolved; OQ-12 added for the pending formal approval of the severity-policy text, then resolved by `DECISIONS.md`, "2026-10-30: Severity policy approved" (draft-1; no version bump) |
| 1.4 | 2026-11-24 | [Author] | UR-077 to UR-080 (Group A, evaluation benchmark harness) and UR-081 to UR-086 (Group B, reviewer and review machinery) added as DRAFT; UC-004 and UC-005, scope, assumptions, glossary terms, and OQ-13 to OQ-19 added. Existing entries unchanged |
| 1.4 (note) | 2026-11-25 | [Author] | Status header aligned with `FR-NFR-harness-governance.md`. OQ-13, OQ-18, and OQ-19 settled and OQ-17 provisionally settled per `DECISIONS.md`, 2026-11-25. No version bump |
