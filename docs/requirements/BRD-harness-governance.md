## assist-plugin Harness Governance: Business Requirements Document

**Version:** 1.4
**Date:** 2026-11-24
**Author:** [Author]
**Status:** Approved (Themes 1 to 6; Theme 5 / Group A carries OQ-14 and OQ-15 as provisionally settled operational items, 2026-11-26)

---

### 1. Introduction

**Purpose:** This document states the business outcomes of a roadmap that hardens, verifies, and audits the assist-plugin harness itself: its hooks, gates, rules, agents, and skills. It is a companion to `BRD-assist-plugin.md`. IDs continue that document's numbering (BR-001 to BR-017, SC-001 to SC-015 are taken), so every ID here is unique across `docs/requirements/`.

**Project overview:** The "system" is the plugin's harness, gates, hooks, and audit surface under `plugins/assist-plugin/` (JS hooks in `hooks/`, markdown in `rules/`, `agents/`, `skills/`). It is not an application. The roadmap has four themes: (1) harness security, closing documented gaps first; (2) integrity, replacing model-attested gates with verified evidence; (3) governance and compliance profiles for SOC 2, HIPAA, and FERPA on one audit trail; (4) shift-left severity routing. Version 1.4 adds two clearly separated groups: Group A (theme 5, Approved 2026-11-26), an evaluation benchmark harness that measures the coding and spec-writing agents release over release, and Group B (theme 6, Approved 2026-11-26), reviewer and review-machinery capabilities that extend the existing review gates.

**Origin of the requirements:** The roadmap supplied with the task. Where a requirement closes a documented gap, the gap number and file line are cited. The gap table is `plugins/assist-plugin/rules/llm-security-checklist.md:323-333`. Group A (BR-023) comes from the repository's research report `docs/research/research-eval-benchmarks-coding-spec-20261124.md`. Group B (BR-024) extends the repository's existing reviewer agents, review protocol, and gate specs, and each requirement names the control it extends.

**Source reliability:** Most compliance and shift-left sources are vendor blogs and give direction, not authority. The HIPAA audit control is verified against 45 CFR 164.312(b) and implements that one required technical safeguard, not full HIPAA compliance. The FERPA internal access log has no authoritative source and is general governance support; only the FERPA disclosure-recordation control cites 34 CFR 99.32 (`DECISIONS.md`, 2026-10-28, "OQ-9 resolved; FERPA control reframed, HIPAA scope tightened"). The figures "under 50% mitigation" and "18% governance councils" are single-source and unverified; no requirement uses them as a threshold.

### 2. Stakeholders

| Role | Name/Group | Interest | Influence |
|------|-----------|----------|-----------|
| Plugin maintainer | Repo owner | Close the documented gaps; keep hook cost low; keep the plugin usable | High |
| Plugin user (developer) | People who run `/do`, `/commit`, `/pr-review` | Safe defaults without extra prompts on benign work | High |
| Security lead | Reviewer of the LLM surface | Gates that cannot be forged; controls mapped to OWASP and NIST | High |
| Compliance officer | Adopter in a SOC 2, HIPAA, or FERPA setting | Evidence from the plugin's own hooks | Medium |
| Auditor | External or internal | Tamper-evident, attributable records over a 6-to-12-month window | Medium |

### 3. Business requirements

| ID | Requirement | Priority | Success criteria |
|----|-------------|----------|-----------------|
| BR-018 | To stop the plugin's documented high and medium security gaps from being exploited, the business must close gaps 2, 3, and 6 of the LLM security checklist and add a blocking guardrail layer. | Must | SC-016 |
| BR-019 | To make governance sign-offs trustworthy, the business must back every gate and approval with verified evidence and keep a tamper-evident audit log. | Must | SC-017, SC-018 |
| BR-020 | To let adopters use the plugin under SOC 2, HIPAA, and FERPA, the business must provide compliance profiles built on one attributable audit trail. | Should | SC-019 |
| BR-021 | To assign ownership and review cadence for every control, the business must map controls to the OWASP Agentic AI Top 10 and the NIST AI RMF functions. | Should | SC-020 |
| BR-022 | To catch defects early without alert fatigue, the business must route findings by severity, blocking only high-confidence, high-severity ones. | Should | SC-021, SC-022 |
| BR-023 | To know whether each release makes the coding and spec-writing agents better or worse, the business must measure their output on in-house golden tasks, graded by execution for code and by checklist plus an optional separate judge for specs, and track the scores release over release. (Group A, Approved) | Should | SC-023, SC-024, SC-025 |
| BR-024 | To shorten review rounds and keep reviewer findings trustworthy, the business must give reviewers named checklists, a round-by-round iteration record, fixed-severity findings, and a feedback loop from the user's labels to checklist changes. (Group B, Approved) | Should | SC-026, SC-027, SC-028 |

### 4. Scope

#### In scope

- Theme 1, harness security: gap 2 (LLM01), gap 3 (LLM02), gap 6 (LLM10), and a blocking PostToolUse guardrail layer. Reference for the guardrail model: Meta LlamaFirewall (https://arxiv.org/pdf/2505.03574).
- Theme 2, integrity: evidence-backed gates, approval written only by a hook or the orchestrator, the Bash write path of gap 4, and a hash-chained governance audit log.
- Theme 3, governance and compliance: per-agent identity, a per-event attribution record, SOC 2 evidence, FERPA and HIPAA controls (all three profiles enforced by default, with a governed per-project opt-out), a hook-written session purpose record, a FERPA disclosure-recordation control on outbound education-record data, mapping to OWASP Agentic AI Top 10 (ASI01 to ASI10, published December 2025) and NIST AI RMF (GOVERN, MEASURE, MANAGE).
- Theme 4, shift-left severity routing: a severity policy, advisory-first baseline, blocking only on high confidence and high severity, severity and routing fields in reviewer output, and SARIF output.
- Theme 5, Group A (Approved), evaluation benchmark harness: golden tasks for coding and for spec writing, execution grading for code, a structural checklist score plus an optional separate judge score for specs, pass@1 over k runs, release-over-release regression through the release-check runner, and controls for contamination, overfitting, judge bias, and flaky tests.
- Theme 6, Group B (Approved), reviewer and review machinery: reviewer checklists by lane, a round-by-round iteration record, stale-verdict and head-revision guards, fixed-severity findings from a catalog, and a feedback loop from the user's labels to checklist changes.

#### Out of scope

| Excluded item | Reason | Deferred to |
|---------------|--------|-------------|
| Gap 5 (fast-track can be read to exempt `agents/` and `skills/` markdown, `llm-security-checklist.md:329`) | Not in the supplied roadmap | Future roadmap |
| Gap 7 (no confirmation gate on writes to auto-loaded `CLAUDE.md` and `rules/`, `llm-security-checklist.md:331`) | Not in the supplied roadmap | Future roadmap |
| Gap 8 (`Bash(claude plugin *)` pre-approved, no presence checks, `llm-security-checklist.md:332`) | Not in the supplied roadmap | Future roadmap |
| Gap 9 (skills grant bare `Bash`, `llm-security-checklist.md:333`) | Not in the supplied roadmap | Future roadmap |
| Gap 1 | Already closed (`llm-security-checklist.md:325`) | Not applicable |
| A vendor SOC 2 report, HIPAA attestation, or FERPA certification for the plugin | Evidence comes from the plugin's own hooks; certification is the adopter's process | Never (by this roadmap) |
| Legal advice on whether a given use of the plugin is HIPAA or FERPA compliant | Outside a requirements document; adopter counsel decides | Never |
| Comparing in-house benchmark scores with public leaderboard numbers (Group A) | Scores move with the scaffold, so only in-house runs on one harness version compare | Never |
| A merge gate that blocks on an LLM-judge score (Group A) | The judge is a noisy, advisory signal | Future roadmap, after judge-human agreement is measured |
| Benchmark coverage and traceability-marker metrics, and seed recording (Group A) | Named in the research report but by no user requirement | Follow-up release |
| Scanner-output ingestion, similarity-based suppression of repeated findings, and impact-graph context for the reviewer (Group B) | Each needs a new component or a measured threshold the plugin does not hold | Future roadmap |
| A reviewer or critic model that approves a gate, blocks a merge, or sets severity by its own score (Group B) | Gates clear on evidence (FR-221) | Never |
| Automatic application of a checklist change (Group B) | A checklist change alters the LLM surface and needs the user's approval | Never |

### 5. Constraints

- Governance: any change touching `agents/`, `skills/`, `rules/`, `hooks/`, instruction files, or `.claude/settings*.json` needs `✓ LLM Security Clear` before merge (`rules/assist-plugin-rule.md:335`, `:348-350`).
- Governance: removing or narrowing an entry in the Write guard lists, or changing the task-plan glob, needs a user decision recorded in `DECISIONS.md` first (`rules/assist-plugin-rule.md:422`).
- Technical: hook code denies only on a positive match and otherwise fails open (`rules/assist-plugin-rule.md:404-416`). Security-critical fail-closed behavior (NFR-028) is an exception to that rule. The user settled it in the `DECISIONS.md` entry dated 2026-10-28, "Compliance profile flags, enforced by default": an absent configuration runs log-only and never hard-denies; a malformed configuration while a profile is enforced fails closed.
- Technical: the plugin never edits a user's Claude Code settings file (`rules/assist-plugin-rule.md:400`). Narrowing the push grant (FR-216) therefore relies on documentation and a health report. The same rule makes the compliance opt-out a change the user applies to the committed `.claude/settings.json` (FR-243).
- Technical: the compliance configuration is two files. A flag in the `env` block of the committed `.claude/settings.json` turns profiles on or off, and hooks read that committed file directly, not the merged process environment, so a personal `.claude/settings.local.json` cannot disable enforcement. An absent flag leaves all three profiles enforced. `.agent/governance/profile.json` holds the PHI patterns, data-class path globs, and BAA references (FR-231).
- Governance: the confirmation store, `.agent/logs/governance/**`, the session purpose record, and the rule-mode store join the Write guard lists and are protected from every subagent write (FR-245; `DECISIONS.md`, 2026-10-28, "FERPA/HIPAA purpose capture, missing-purpose handling, and governance path protection").
- Technical: a hook, not the orchestrator, writes the session purpose record from a purpose the user declares, so model output or file and PR text cannot forge it. An access to a tagged path with no recorded purpose is logged `unstated` and flagged, never denied on that alone (FR-230, FR-247).
- Performance: existing per-write hooks cost about 80 to 110 ms per write (repo `CLAUDE.md`, hooks section).
- Technical (Group A): the benchmark harness reuses the `claude plugin eval` runner, the `evals/` case layout, and the `tests/` suite, and adds no second runner. Coding cases need a sandbox backend for their Write, Edit, and Bash grant (`plugins/assist-plugin/evals/README.md:40`).
- Governance (Group B): reviewers stay read-only with `Read, Grep, Glob, LSP`; the orchestrator writes every record; a change to a checklist, the severity catalog, or an agent file is a change to the LLM surface and needs `✓ LLM Security Clear` before merge and a user-approved `DECISIONS.md` entry (NFR-036, FR-315).

### 6. Assumptions

- A-1: The 12-month retention in NFR-032 covers the upper end of the 6-to-12-month SOC 2 Type II window the roadmap cites.
- A-2: "Per-agent identity" means a recorded agent type, agent id, and plugin version, not a credential.
- A-3: SHA-256 is the hash for the audit chain. The roadmap says only "hash chain".
- A-4: The revision-loop cap is 10 with two consecutive LGTMs as the normal pass, which replaces the earlier default of 3 from `llm-security-checklist.md:295` and agrees with the "max 10" at `rules/assist-plugin-rule.md:338` (`DECISIONS.md`, 2026-10-30, "Gap-3 push grant and gap-6 revision-loop cap settled"; OQ-2 resolved).
- A-5: Advisory baseline lasts 14 days or 20 reviews, whichever comes later. This is an estimate to confirm.
- A-6: A promotion to blocking needs at least 90% precision over the baseline (estimate).
- A-7: Added per-write hook cost targets in NFR-029 are estimates anchored to the existing 80 to 110 ms.
- A-8: `.agent/logs/governance/audit.jsonl` is named in `llm-security-checklist.md:78`, but a search of `plugins/assist-plugin/hooks/` found no code that writes it. This roadmap treats it as a log to create, not an existing one.
- A-9: The SOC 2, HIPAA, and FERPA profiles are all enforced by default; a project opts out per project, through the governed opt-out of FR-243 and FR-244. This replaces the earlier opt-in assumption for HIPAA and FERPA (`DECISIONS.md`, 2026-10-28, "Compliance profile flags, enforced by default"). Core logging (FR-228) stays always on.
- A-10: Compliance statements here reflect directional sources (Teleport, Probo, TianPan, Kiteworks, Security Boulevard, Modulos, helpmetest, GitLab, AutoRabit blogs). They are not legal or audit authority. The two regulation citations are the exception: 45 CFR 164.312(b) is verified for FR-232, and 34 CFR 99.32 is cited only by FR-246 and stays "to verify" (NFR-033).
- A-11: Outbound disclosure detection for education-record data is imperfect, as for PHI (FR-233): a paraphrase or a payload assembled from earlier reads can escape a pattern or path match. FR-246 reduces the risk and does not remove it.
- A-12: A full benchmark run costs an estimated $25 to $75 (10 coding and 10 spec cases at 5 runs each), derived from one recorded 8-case run of about $4.85 and not measured on this repository (`docs/research/research-eval-benchmarks-coding-spec-20261124.md:112-116`). The benchmark section therefore runs on request only (FR-274; OQ-13 settled: a default release-check run reports the last stored scoreboard and never runs the suite).
- A-13: A spec case "clears" the structural checklist when every deterministic item passes (FR-269). A looser level is a later choice.
- A-14: Numeric values left to configuration have no empirically settled default: the run count k, the regression margin, the validation run count (FR-259), the judge run count (FR-285), the escalation counts of FR-300 and FR-301, and the precision floor of FR-313 (OQ-14, OQ-17). Any figure shown in a scenario is an example. OQ-17 and OQ-14 are provisionally settled: the values in `FR-NFR-harness-governance.md` (section 5, provisional values) are provisional and to be revised with data. For OQ-14 (`DECISIONS.md`, 2026-11-26) the values are run count 5, regression margin 0.05, validation runs 3, judge runs 3, and 1 new golden task per release, to be revised with run-to-run variance data; none has an empirical basis yet.
- A-15: Concurrent lane review costs about three times one reviewer pass (estimate, not measured), and the plugin's existing cap on parallel agents (`plugins/assist-plugin/rules/llm-security-checklist.md:321-345`) sets at most three concurrent dispatches (FR-292).
- A-16: Group A is approved (2026-11-26), carrying OQ-14 and OQ-15 as open operational items that the user then provisionally settled the same day (`DECISIONS.md`, 2026-11-26): the benchmark numbers are provisional (A-14), and the reference solutions and hidden suites live in a local directory outside the published repository, reached through an uncommitted override or an environment variable, with a private git repository later (D-16: principle settled, concrete location provisional). Group B is approved (2026-11-26). Neither changes the status or the approved text of FR-214 to FR-249 or NFR-026 to NFR-036.

### 7. Success criteria

| ID | Criterion | Measurement | Target |
|----|-----------|-------------|--------|
| SC-016 | Gaps 2, 3, and 6 are closed and listed as Closed in the gap table. Gap 4 closes through FR-221 to FR-223 and is tracked by SC-017 and SC-018. | Gap table rows | 3 of 3 closed; gap 4 per SC-017 and SC-018 |
| SC-017 | No gate clears on a model-emitted string alone | Gate records with evidence reference | 100% of cleared gates carry a command, exit code, or CI artifact reference |
| SC-018 | Audit chain verification detects tampering | Test corpus of edit, delete, reorder cases | 100% detected |
| SC-019 | Each governed event carries the five attribution fields | Sample of logged events | 100% |
| SC-020 | Each control maps to an ASI id and an AI RMF function with an owner role | Control register check | 100% of controls |
| SC-021 | Severity policy approved before any rule blocks | DECISIONS.md entry precedes first blocking rule | Yes |
| SC-022 | Blocking findings come only from high-confidence, high-severity rules | Routing log review | 0 blocking findings from other rules |
| SC-023 | The deterministic scores are reproducible | Repeated scoring of one spec output and one coding run set | 100% identical structural scores over 10 repetitions; pass or fail of every coding run set by a suite exit code |
| SC-024 | Each release that runs the benchmark section leaves a version-keyed result | Scoreboard rows against benchmark releases | 100% of benchmark releases have a row per suite |
| SC-025 | Golden tasks resist contamination | Task metadata review | 100% of tasks record provenance, creation date, and cutoff; 0 tasks derived from a public dataset |
| SC-026 | Reviews account for the recurring defect classes | Sample of reviewer reports | 100% of reports list each applicable checklist item as evaluated or skipped with a reason |
| SC-027 | Re-reviews give a status for every prior finding | Sample of re-review reports | 100% of prior findings carry fixed, open, or withdrawn |
| SC-028 | Reviewer precision comes only from the user's labels | Precision report against the label record | 0 agent-set labels counted |

### 8. Glossary

| Term | Definition |
|------|-----------|
| Harness | The plugin's hooks, gates, rules, agents, and skills that constrain and record agent work |
| Gate | A merge-policy check such as OWASP Clear or Coverage >=70% (`rules/assist-plugin-rule.md:334-337`) |
| Positive-match deny | A hook decision that blocks only when the guard positively recognizes a prohibited command |
| Fail-closed | On an internal error, deny the guarded operation instead of allowing it |
| ASI01-ASI10 | The ten risk items in the OWASP Agentic AI Top 10 (December 2025) |
| NIST AI RMF | The NIST AI Risk Management Framework; functions used here are GOVERN, MEASURE, MANAGE |
| SARIF | Static Analysis Results Interchange Format, read by the GitHub Security tab |
| Opt-out | A project's governed choice to turn a compliance profile off; the user applies it to the committed `.claude/settings.json`, and it is logged and recorded in `DECISIONS.md` |
| Session purpose record | The record of the purpose the user declared for the session, written by a hook and read by the access-logging hooks |
| Disclosure recordation | The log of each disclosure of education-record data to an outside party, with the receiving party and legitimate interest (34 CFR 99.32) |
| PHI | Protected health information under HIPAA |
| BAA | Business Associate Agreement under HIPAA |
| Benchmark harness | The golden tasks, graders, and release-check section that measure the coding and spec-writing agents (Group A). Distinct from the "Harness" defined above |
| Golden task | A task with a reference and a way to grade it, written in-house |
| pass@1 | The probability that one run of a coding case passes, estimated as passes over completed runs |
| Review lane | A review focus with its own checklist: defect-depth, test-integrity, or architecture-safety (Group B) |

### 9. Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-28 | [Author] | Initial draft |
| 1.1 | 2026-10-28 | [Author] | Align with the `DECISIONS.md` 2026-10-28 entry: A-9 flipped to enforced-by-default with opt-out; NFR-028 conflict settled; two-file compliance configuration; governed opt-out |
| 1.2 | 2026-10-30 | [Author] | Align with the `DECISIONS.md` 2026-10-28 entries on purpose capture and OQ-9: source reliability and scope updated for the verified HIPAA control and the reframed FERPA controls; constraints for hook-written purpose and protected governance paths; A-10 narrowed, A-11 added |
| 1.3 | 2026-10-30 | [Author] | Align with the `DECISIONS.md` 2026-10-30 entry on the revision-loop cap: A-4 states the cap of 10 (OQ-2 resolved) |
| 1.4 | 2026-11-24 | [Author] | BR-023 (Group A, evaluation benchmark harness) and BR-024 (Group B, reviewer and review machinery) added as DRAFT with SC-023 to SC-028, scope, constraints, A-12 to A-16, and glossary terms. Existing entries unchanged |
| 1.4 (note) | 2026-11-25 | [Author] | Status header aligned with `FR-NFR-harness-governance.md`. A-15 line anchor corrected (`llm-security-checklist.md:321-345`). A-12 and A-14 updated for OQ-13 settled and OQ-17 provisionally settled (`DECISIONS.md`, 2026-11-25). No version bump |
| 1.4 (note 2) | 2026-11-26 | [Author] | Group B (BR-024, Theme 6) approved per `DECISIONS.md`, 2026-11-26, "Approve Group B (reviewer machinery), unblock Track B for merge". The Status labels flip from DRAFT to Approved in the document status, the overview, the BR-024 row, the Theme 6 scope line, and A-16. Group A (Theme 5) stays DRAFT. No requirement text changed, no version bump |
| 1.4 (note 3) | 2026-11-26 | [Author] | Group A (BR-023, Theme 5) approved, with OQ-14 and OQ-15 carried as open operational items. The Status labels flip from DRAFT to Approved in the document status, the overview, the BR-023 row, the Theme 5 scope line, and A-16. No requirement text changed, no version bump |
| 1.4 (note 4) | 2026-11-26 | [Author] | OQ-14 and OQ-15 provisionally settled per `DECISIONS.md`, 2026-11-26, "Settle OQ-14 (provisional) and OQ-15 (local oracle via override) for the benchmark run". The Status line, A-14, and A-16 are updated: OQ-14 values (5, 0.05, 3, 3, 1) are provisional and to be revised with run-to-run variance data; the oracle lives in a local directory outside the published repository for now, a private git repository later, and the committed public configuration holds only a placeholder. No requirement text changed, no version bump |
