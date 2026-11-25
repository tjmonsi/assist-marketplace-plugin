## assist-plugin Harness Governance: Functional and Non-Functional Requirements

**Version:** 1.4
**Date:** 2026-11-24
**Author:** [Author]
**Status:** Approved (Themes 1 to 4); DRAFT (Theme 5, Group A, and Theme 6, Group B)

---

### 1. Introduction

**Purpose:** This document specifies the behaviors and quality attributes of the assist-plugin harness roadmap in four themes: harness security, integrity, governance and compliance profiles, and shift-left severity routing. Version 1.4 adds two clearly separated requirement groups: Group A (Theme 5), an evaluation benchmark harness for the coding and spec-writing agents, and Group B (Theme 6), reviewer and review-machinery capabilities. Both groups are DRAFT until the user approves them.

**Relationship to URD:** This document derives from `URD-harness-governance.md`. Every functional requirement traces to at least one user requirement. IDs continue `FR-NFR-assist-plugin.md` (FR-200 to FR-213, NFR-001 to NFR-025 are taken there; FR-250 to FR-253 are also taken there, so the IDs added in 1.4 start at FR-254 and NFR-037 and leave FR-250 to FR-253 untouched).

**Relationship to BRD:** Non-functional requirements trace to business requirements in `BRD-harness-governance.md` when they originate from compliance or policy.

**Binding language:** `MUST` = mandatory, `SHOULD` = recommended, `MAY` = optional (RFC 2119). The keyword appears in uppercase in every FR and NFR statement.

**Source reliability:** Compliance and shift-left sources are mostly vendor blogs and give direction, not authority. FR-232 is verified against 45 CFR 164.312(b) and FR-246 cites 34 CFR 99.32 (see NFR-033); FR-230 carries no 99.32 citation. Group A rests on the repository's own research report, `docs/research/research-eval-benchmarks-coding-spec-20261124.md`, which cites public evaluation methods by URL; its cost and effort figures are estimates, not measurements on this repository (`:112-116`). Group B extends the repository's existing review controls and cites only them.

### 2. Functional requirements

| ID | Requirement | Traces to | Priority | Acceptance criteria |
|----|-------------|-----------|----------|---------------------|
| FR-214 | The PR-posting guard MUST deny a PR verdict command when no recorded user confirmation exists for that PR and verdict. | UR-059 | Must | 2.1 |
| FR-215 | The commit workflow MUST stage only explicitly named paths. | UR-060 | Must | 2.2 |
| FR-216 | The plugin MUST recommend a push grant scoped to a named remote (more than one allowed) and check for a wildcard or unscoped push grant. | UR-060 | Must | 2.3 |
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
| FR-248 | The plugin MUST provide a dependency-free strict JSON parser that rejects a duplicate key at any depth and nesting deeper than 32 levels, with an error that carries a position and no slice of the input. | UR-071, UR-075 | Must | 2.35 |
| FR-249 | The strict parser MUST be wired into exactly three readers (rule-modes.json, profile.json, the confirmation store), route a rejection through each reader's existing malformed-file path, and be reported by the health check. | UR-059, UR-068, UR-069, UR-071 | Must | 2.36 |
| FR-254 | Each coding golden task MUST hold a task prompt, a reference solution, and a hidden test suite. | UR-077 | Must | 2.37 |
| FR-255 | Each spec golden task MUST hold a task prompt, a reference requirements set or reference spec, and a rubric that lists its deterministic checklist items apart from its subjective items. | UR-077 | Must | 2.38 |
| FR-256 | Each test in a hidden test suite MUST carry the identifier of the acceptance-criteria scenario it checks, in the `[AC-n \| spec \| FR-n]` naming form that the repository's own tests use. | UR-077 | Must | 2.39 |
| FR-257 | Each golden task MUST record its provenance (in-house or private repository), its creation date, and the model cutoff date it is valid against. | UR-080 | Must | 2.40 |
| FR-258 | A golden task MUST NOT be derived from a public benchmark dataset. | UR-080 | Must | 2.41 |
| FR-259 | The benchmark harness MUST admit a coding golden task only after its reference solution passes its hidden test suite in each of a configured number of consecutive runs. | UR-080 | Must | 2.42 |
| FR-260 | The benchmark harness MUST withhold the reference solution and the hidden test suite from the agent under test. | UR-080 | Must | 2.43 |
| FR-261 | The benchmark harness MUST keep each reference solution and hidden test suite out of every published artifact. | UR-080 | Must | 2.44 |
| FR-262 | The benchmark harness MUST score a coding run as pass when the hidden test suite exits 0 and as fail when it exits non-zero, with no model call in the scoring. | UR-078 | Must | 2.45 |
| FR-263 | The benchmark harness MUST run each golden task as a case in the existing `claude plugin eval` layout (a `prompt.md` and a `graders/` folder under `evals/`). | UR-078 | Must | 2.46 |
| FR-264 | The benchmark harness MUST report a coding run as not-run, never as pass or fail, when the sandbox backend that the run's Write, Edit, and Bash grant requires is unavailable. | UR-078 | Must | 2.47 |
| FR-265 | The benchmark harness MUST score a spec run as the fraction of its deterministic checklist items that pass, with no model call in the scoring. | UR-078 | Must | 2.48 |
| FR-266 | The deterministic checklist MUST be built from the checks that `spec-from-requirements` review mode and the `gather-requirements` quality criteria already define. | UR-078 | Must | 2.49 |
| FR-267 | The deterministic checklist MUST confirm that each requirement identifier, scenario, and error path of the reference appears in the output. | UR-078 | Must | 2.50 |
| FR-268 | The benchmark harness MAY score the subjective rubric items of a spec case with an LLM-as-judge grader. | UR-078 | May | 2.51 |
| FR-269 | The benchmark harness MUST run the judge grader only on a spec case that cleared the structural checklist. | UR-078 | Must | 2.52 |
| FR-270 | The benchmark harness MUST report the structural score and the judge score as two separate values and MUST NOT combine them into one number. | UR-078 | Must | 2.53 |
| FR-271 | The benchmark harness MUST report pass@1 for a coding case as c divided by k, where k is the number of completed runs of that case and c is the number of those runs that pass. | UR-078 | Must | 2.54 |
| FR-272 | The benchmark result MUST state k, c, and the benchmark harness version beside each pass@1 value. | UR-078 | Must | 2.55 |
| FR-273 | The release-check runner MUST provide a benchmark section that runs the coding and spec suites and compares the scores of each suite with the scores stored for the previous release. | UR-079 | Must | 2.56 |
| FR-274 | The benchmark section MUST run only when the user requests it. | UR-079 | Must | 2.57 |
| FR-275 | The benchmark harness MUST key each stored result to the plugin version that the run result records. | UR-079 | Must | 2.58 |
| FR-276 | The repository MUST hold, under version control, a scoreboard that lists for each release and suite the version, pass@1, structural score, and judge score. | UR-079 | Must | 2.59 |
| FR-277 | The benchmark section MUST report a regression finding when the score of a suite is below the previous release's score for that suite by more than a configured margin. | UR-079 | Must | 2.60 |
| FR-278 | The release comparison MUST be computed over the cases present in both releases. | UR-079 | Must | 2.61 |
| FR-279 | The benchmark section MUST report a judge-score decline as advisory only. | UR-079 | Must | 2.62 |
| FR-280 | The benchmark harness MUST run its held-out cases only in the benchmark section of a release check. | UR-080 | Must | 2.63 |
| FR-281 | The benchmark harness SHOULD add at least one new golden task to each suite in each release that runs the benchmark section. | UR-080 | Should | 2.64 |
| FR-282 | WHEN the judge and the agent under test share a model family, the benchmark harness MUST apply three bias mitigations to the judge score (candidate-order randomization per FR-284, rubric anchoring per FR-283, and a human-agreement check at each benchmark release per FR-286) and MUST record the judge family and the agent family in the result. | UR-080 | Must | 2.65 |
| FR-283 | The judge MUST score each subjective rubric item separately against the text of that item. | UR-080 | Must | 2.66 |
| FR-284 | WHEN the judge compares two texts, the benchmark harness MUST run the comparison in both orders and average the two results. | UR-080 | Must | 2.67 |
| FR-285 | The benchmark result MUST report each judge score as the mean of a configured number of judge runs and MUST state that number. | UR-080 | Must | 2.68 |
| FR-286 | WHERE a human-labeled sample of spec outputs exists, the benchmark harness SHOULD report the judge's agreement with the human scores as Spearman rho or Cohen kappa. | UR-080 | Should | 2.69 |
| FR-287 | The benchmark harness MUST report a hidden-suite test that gives different results on repeated runs of the same candidate as flaky, without skipping or retrying it. | UR-080 | Must | 2.70 |
| FR-288 | The plugin MUST keep one reviewer checklist for each of three review lanes (defect-depth, test-integrity, and architecture-safety), and each checklist item MUST have an identifier, a check, and the evidence that clears it. | UR-081 | Should | 2.71 |
| FR-289 | The `reviewer` and `code-reviewer` agents MUST account for each checklist item that applies to the artifact type as evaluated or as skipped with a reason. | UR-081 | Should | 2.72 |
| FR-290 | A finding raised from a checklist item MUST carry that item's identifier as its rule identifier. | UR-081 | Should | 2.73 |
| FR-291 | Each lane checklist MUST be applied within the existing gates that the lane-to-gate table assigns. | UR-081 | Should | 2.74 |
| FR-292 | The orchestrator MAY dispatch the lane reviews of one gate concurrently, with at most three reviewer dispatches running at once. | UR-081 | May | 2.75 |
| FR-293 | WHEN lane reviews ran concurrently, the orchestrator MUST merge findings that share a file, a line, and a rule identifier into one finding that keeps the highest severity among them. | UR-081 | Should | 2.76 |
| FR-294 | Each finding MUST carry an identifier that stays the same in every round of one gate. | UR-082 | Should | 2.77 |
| FR-295 | On a re-review the reviewer MUST give each prior finding exactly one status of fixed, open, or withdrawn with a one-line reason, and MUST mark every other finding as new. | UR-082 | Should | 2.78 |
| FR-296 | Each review report MUST name the revision of the artifact it reviewed, as a content digest or a commit identifier. | UR-083 | Should | 2.79 |
| FR-297 | The orchestrator MUST NOT count a reviewer verdict toward a gate when the artifact has changed since the revision that the report names. | UR-083 | Should | 2.80 |
| FR-298 | On a re-review the dispatch MUST list the paths changed since the previous pass. | UR-082 | Should | 2.81 |
| FR-299 | On a re-review the reviewer MUST mark a finding as `fix-induced`, with the identifier of the prior finding, when a change made since the previous pass causes it. | UR-082 | Should | 2.82 |
| FR-300 | WHEN two consecutive re-reviews of one gate each return a fix-induced finding, the orchestrator SHOULD run one code-reviewer pass over the whole artifact before it dispatches another fix pass. | UR-082 | Should | 2.83 |
| FR-301 | WHEN two consecutive re-reviews of one gate report the same finding as open and the reviewer cites no new evidence, the orchestrator SHOULD stop that loop and offer the choices continue, waive, or abort. | UR-082 | Should | 2.84 |
| FR-302 | At an escalation under FR-218 or FR-301, the orchestrator MUST show, for each round, the number of new, fixed, open, and withdrawn findings. | UR-082 | Should | 2.85 |
| FR-303 | A reviewer MUST NOT return verdict `approved` when it did not examine every artifact path that the dispatch names. | UR-083 | Should | 2.86 |
| FR-304 | The PR-review workflow MUST NOT post a review that was drafted against a head revision other than the PR's current head revision, which the workflow reads immediately before it posts. | UR-085 | Should | 2.87 |
| FR-305 | WHEN a posting command ends with an unknown outcome, the PR-review workflow MUST read back the PR's reviews before any retry. | UR-085 | Should | 2.88 |
| FR-306 | A finding whose rule identifier is in the severity catalog MUST take its severity from that catalog entry. | UR-086 | Should | 2.89 |
| FR-307 | A finding with no rule identifier in the severity catalog and no CWE identifier MUST be marked `unmapped` and MUST route no higher than `inline-comment`. | UR-086 | Should | 2.90 |
| FR-308 | A score from a critic or filtering model MUST NOT set a finding's severity and MUST NOT remove a finding from the report. | UR-086 | Should | 2.91 |
| FR-309 | The plugin MUST record a disposition of true, false, or deferred for a reviewer finding only from the user's own label. | UR-084 | Should | 2.92 |
| FR-310 | The plugin MUST report, for each lane and each checklist item, the number of findings labeled true, labeled false, deferred, and unlabeled, and the precision over the labeled findings. | UR-084 | Should | 2.93 |
| FR-311 | The dispatch for a review MUST pass the user's false labels for the same checklist items on the same artifact as data. | UR-084 | Should | 2.94 |
| FR-312 | The reviewer MUST NOT re-raise a finding that the user labeled false for the same checklist item and location unless the reviewer cites new evidence. | UR-084 | Should | 2.95 |
| FR-313 | The plugin MUST list each checklist item whose precision is below a configured floor as a retirement candidate in a checklist-change report for the user. | UR-084 | Should | 2.96 |
| FR-314 | The plugin MUST list each finding class that was raised with no checklist item at least a configured number of times as an addition candidate in the checklist-change report. | UR-084 | Should | 2.97 |
| FR-315 | A reviewer checklist MUST change only through an edit that the user approves and that has a `DECISIONS.md` entry. | UR-084 | Must | 2.98 |
| FR-316 | Before a change to a lane checklist, the severity catalog, or a screening rule ships, the plugin SHOULD report finding precision and recall on a seeded-defect sample, before and after the change. | UR-084 | Should | 2.99 |

Acceptance criteria are the scenarios below, in GIVEN/WHEN/THEN form. FR-254 to FR-287 (sections 2.37 to 2.70) are Group A. FR-288 to FR-316 (sections 2.71 to 2.99) are Group B. Both groups are DRAFT.

#### Theme 1: Harness security

#### 2.1 FR-214: Deny unconfirmed PR verdict

**Statement:** The PR-posting guard MUST deny `gh pr review` and `bkt pr approve` or `decline` for a PR when no recorded user confirmation exists for that PR and that verdict (recording: FR-242). The guard is additive: the confirmation guard owns the deny decision for the posting action, and the `pr-post-ask` hook stays unchanged, so its prompt is not removed. After a recorded confirmation the user may still see the `pr-post-ask` prompt, so two prompts may appear; this is accepted as defense in depth. The ask for other posting commands stays.
**Traces to:** UR-059
**Priority:** Must
**Origin:** Gap 2, `plugins/assist-plugin/rules/llm-security-checklist.md:326`; LLM01 section, `:30-37`. Current control: the best-effort, fail-open `pr-post-ask` hook (`rules/assist-plugin-rule.md:409`).

##### Scenario: Confirmed verdict posts

- **GIVEN** the user confirmed "approve PR 42" and the confirmation is recorded
- **WHEN** the session runs `gh pr review 42 --approve`
- **THEN** the guard MUST allow the command
- **AND** the log MUST hold the confirmation reference
- **AND** the `pr-post-ask` hook MAY still prompt the user, because the guard does not replace it

##### Scenario: Additive guard leaves the pr-post-ask prompt in place

- **GIVEN** a recorded confirmation covers "approve PR 42"
- **WHEN** the session runs `gh pr review 42 --approve`
- **THEN** the `pr-post-ask` hook MUST remain unchanged and MUST still ask
- **AND** the confirmation guard MUST NOT suppress that prompt

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

#### 2.3 FR-216: Push grant scoped to named remotes

**Statement:** The plugin documentation MUST recommend scoping each push grant to a named remote (for example `Bash(git push origin *)`, and a second grant such as `Bash(git push <mirror-name> *)` for a mirror) in place of `Bash(git push *)`, and `/assist-plugin:health` MUST report a wildcard or unscoped push grant (`Bash(git push *)`, `Bash(git push:*)`) when it reads one. The health check MUST NOT report a push grant that names a specific remote, including a second named remote.
**Traces to:** UR-060
**Priority:** Must
**Origin:** Gap 3, `llm-security-checklist.md:327`; LLM02 section, `:71-73`. The plugin never edits a settings file (`rules/assist-plugin-rule.md:400`), so the user applies the change to `.claude/settings.local.json` or the committed `.claude/settings.json` (dependency D-3). The first grant `Bash(git push origin *)` was settled by `DECISIONS.md`, 2026-10-30, "Gap-3 push grant and gap-6 revision-loop cap settled". `DECISIONS.md`, 2026-10-30, "Push grant scoped per named remote, not origin-only (D-3 refined)" widens it for a multi-remote workflow: each trusted remote is enumerated by name, and no wildcard auto-approves an arbitrary remote that an injected instruction could add. The health check and the documentation recommendation ship regardless; gap 3 closes only after the user's settings hold named-remote push grants and no wildcard.

##### Scenario: Named grant passes the check

- **GIVEN** the settings hold `Bash(git push origin *)` and no wildcard or unscoped push grant
- **WHEN** the health check runs
- **THEN** the report MUST show no push-grant finding

##### Scenario: Second named remote passes the check

- **GIVEN** the settings hold `Bash(git push origin *)` and `Bash(git push mirror *)` and no wildcard or unscoped push grant
- **WHEN** the health check runs
- **THEN** the report MUST show no push-grant finding

##### Scenario: Wildcard grant reported

- **GIVEN** the settings hold `Bash(git push *)` or `Bash(git push:*)`
- **WHEN** the health check runs
- **THEN** the report MUST list the wildcard push grant
- **AND** the report MUST NOT edit the settings file

#### 2.4 FR-217: Secret scan before commit

**Statement:** The commit workflow MUST run a secret scan on the staged changes before creating a commit, using the in-plugin pattern-scanner script as the default scan tool, and MUST stop with no commit when the scan reports a finding or cannot run. The script ships with the plugin, so the default scan has no external dependency. A project MAY substitute an external scanner (for example gitleaks or trufflehog) by replacing the script call, provided the substitute keeps the same three outcomes: clean, findings, and cannot-run.
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

- **GIVEN** the in-plugin pattern-scanner script cannot run, or a substituted external scanner is not installed
- **WHEN** the commit workflow reaches the commit step
- **THEN** the workflow MUST treat the outcome as cannot-run, stop with no commit, and tell the user the scan did not run

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

**Statement:** A PostToolUse guardrail MUST be able to deny a tool result and halt the next action when an alignment check finds that the result tries to redirect the agent from the user's stated goal. The alignment check MUST be rule-based and run advisory-first under FR-238, and MUST NOT call a model.
**Traces to:** UR-062
**Priority:** Should
**Origin:** Gap in current control: the injection-filter replaces phrasing with a marker and never blocks (`rules/assist-plugin-rule.md:416`). Modeled on the alignment-auditor check in Meta LlamaFirewall (https://arxiv.org/pdf/2505.03574). The rule-based choice is settled by `DECISIONS.md`, 2026-10-30, "Build-time open items resolved (PN-1, PN-7, Step 18, Step 34, Step 3 binding)" (D-13): the check reads attacker-controlled text (PR, web, tool output), so a model-evaluating hook would itself be a prompt-injection surface. The choice is deliberate, not forced: current Claude Code documentation lists built-in `prompt`, `agent`, and `http` hook types that can call a model, a command hook has no documented offline sandbox, and its default timeout is 600 seconds (30 on `UserPromptSubmit`). These hook facts are directional (from the documentation, https://code.claude.com/docs/en/hooks, not re-verified in this repository). The choice may be revisited after the FR-238 baseline.

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
**Origin:** Roadmap theme 4. Reference: https://helpmetest.com/blog/devsecops-testing-pipeline/ (vendor blog, directional). The policy basis is settled by `DECISIONS.md`, 2026-10-30, "Severity-policy basis and SARIF writer settled" (D-4 basis): four levels aligned to a recognized rubric (OWASP risk rating or CVSS bands) with repo-specific examples drawn from this plugin's hook and LLM-surface risks, a per-finding confidence of High, Medium, or Low, and a SARIF mapping of CRITICAL and HIGH to error, MEDIUM to warning, and LOW to note. The user approved the concrete policy text, `severity-policy.md` version `draft-2`, in `DECISIONS.md` (first approved at `draft-1`, "2026-10-30: Severity policy approved"; re-approved at `draft-2` after the Status-line reconciliation, "2026-10-31: Severity policy approved"). A rule may now block on severity, but only after the advisory-baseline-first promotion gate of FR-238.

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

**Statement:** A hook on `UserPromptSubmit`, not the orchestrator, MUST write a record of the user's confirmation (PR, verdict, timestamp, a reference to the user message it came from, and the writer marked `hook`) as JSONL to a store under a path in `.agent/` that FR-245 already protects, and the PR-posting guard of FR-214 MUST read that store with file reads alone. A subagent and text from a PR, web page, or file MUST NOT create or alter a confirmation record. The confirmation store MUST be a directory, not a single file, holding two files with different write rules. `confirmations.jsonl` MUST be written only by the `UserPromptSubmit` hook and MUST be denied to every tool caller, the main session included. `pending.jsonl` holds the pending-action records and MUST be written by the main-session `/do` orchestrator (no agent_id) and denied to every subagent. The confirmation MUST be bound to its pending action by a per-action token: when `/do` shows the PR and verdict draft, it MUST write a pending-action record (PR, verdict, a short random token, `session_id`, and a creation timestamp) to `pending.jsonl`, and the hook MUST write a confirmation only when the user's prompt carries the matching token. The FR-214 guard MUST read `confirmations.jsonl` only and MUST NOT treat a pending-action record as a confirmation; a pending-action record carries no authority on its own. An affirmative without the matching token MUST NOT confirm. The token MUST be single-use and time-expiring. Single-use: the hook MUST consume the token when it records the confirmation (the pending record is marked used or removed), so a repeat of the same token confirms nothing, consistent with one confirmation covering one PR and verdict. Time-expiring: the hook MUST reject a token whose pending record is older than a configured short window, even when the token was never used. The expiry window is an implementation estimate (on the order of minutes) until measured, not a fixed figure.
**Traces to:** UR-059
**Priority:** Must
**Origin:** Token binding: `DECISIONS.md`, 2026-10-30, "Build-time open items resolved (PN-1, PN-7, Step 18, Step 34, Step 3 binding)". The hook sees only the prompt text and `session_id` (no documented correlation field; directional, from the hooks documentation, not re-verified in this repository), and a pasted or injected affirmative can look like a typed one, so the token fails closed. Gap 2, `llm-security-checklist.md:326`. FR-214 denies on a missing confirmation, so the store is security-relevant: a store any agent can write could be forged by the injected PR text the control defends against. The guard's only I/O is file reads that a test can replace (`rules/assist-plugin-rule.md:409`). The writer and form are settled (D-10, OQ-10 resolved) by `DECISIONS.md`, 2026-10-30, "Audit-logging stores settled (per-access split, rotation and retention, confirmation-store writer)": a hook's output cannot be forged by model text or by PR, web, or file content, the same trust model as the FR-247 purpose-capture hook. The hook ships with an ES5 entry file, a timeout, a self-test corpus (NFR-035), and the D-1 fail-closed behavior for its guarded class. The store path is protected from every subagent write under FR-245 (D-2 settled). The directory split and the token lifetime are settled by `DECISIONS.md`, 2026-10-30, "PN-10 pending-action store split and token lifetime settled": the hook is the only writer of `confirmations.jsonl`, so model or PR text cannot forge a confirmation, while `/do` needs a writable place for the pending action it creates, and a stale or replayed token must not confirm a later action.

##### Scenario: User confirmation recorded

- **GIVEN** `/do` showed the draft for PR 42 with verdict approve, wrote a pending-action record with token `K7Q2`, and the user answered yes with `K7Q2` in their own message
- **WHEN** the `UserPromptSubmit` hook runs
- **THEN** the store MUST hold a JSONL record for PR 42 and verdict approve with the timestamp
- **AND** the record MUST name the writer as `hook`

##### Scenario: Affirmative without the token rejected

- **GIVEN** `/do` wrote a pending-action record for PR 42 with token `K7Q2`
- **WHEN** a prompt holds an affirmative such as pasted or injected text without `K7Q2`
- **THEN** the hook MUST NOT write a confirmation record
- **AND** the guard of FR-214 MUST still deny the posting command

##### Scenario: Expired or reused token rejected

- **GIVEN** `/do` wrote a pending-action record for PR 42 with token `K7Q2`, and either the record is older than the configured expiry window or the token was already consumed by an earlier confirmation
- **WHEN** the user's prompt carries `K7Q2`
- **THEN** the hook MUST NOT write a confirmation record
- **AND** the guard of FR-214 MUST still deny the posting command

##### Scenario: Pending record is not a confirmation

- **GIVEN** `pending.jsonl` holds a pending-action record for PR 42 and `confirmations.jsonl` holds no record for it
- **WHEN** the guard of FR-214 checks the posting command
- **THEN** the guard MUST deny the command
- **AND** a tool call that writes `confirmations.jsonl` MUST be denied, and a subagent write to `pending.jsonl` MUST be denied

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

**Statement:** These six paths MUST be protected from writes by every subagent: `.claude/settings.json`, `.agent/governance/profile.json`, the confirmation store of FR-242, `.agent/logs/governance/**`, the session purpose record of FR-247, and the rule-mode store (the store that holds the advisory or blocking mode of each check, FR-238). A hook or the orchestrator remains the only writer of the last four. The confirmation store is the directory form of FR-242 and stays one path of the six. It holds `confirmations.jsonl`, written only by the `UserPromptSubmit` hook and protected from every tool caller, and `pending.jsonl`, writable by the main-session `/do` orchestrator and denied to every subagent. The FR-246 attribution decision adds no new store and no seventh path: the six protected paths are unchanged, and `.agent/governance/profile.json` (path 2) is the trust anchor for the FR-246 receiving-party allowlist.
**Traces to:** UR-075
**Priority:** Must
**Origin:** `DECISIONS.md`, 2026-10-28, "Compliance profile flags, enforced by default" (the first two paths, D-12) and "FERPA/HIPAA purpose capture, missing-purpose handling, and governance path protection" (the last four paths, D-2 settled). Adding these paths to the Write guard lists follows those records. The earlier `DECISIONS.md`, 2026-10-30, "Audit-logging stores settled (per-access split, rotation and retention, confirmation-store writer)" decision settled the JSONL format and the hook writer for the confirmation store (OQ-10 resolved, D-10). The later `DECISIONS.md`, 2026-10-30, "PN-10 pending-action store split and token lifetime settled" decision refined the store into a directory of two files under `.agent/`: `confirmations.jsonl` (hook-only writer) and `pending.jsonl` (main-session-writable). The `DECISIONS.md`, 2026-10-30, "Proposed governance file names and store paths approved (PN-8)" decision fixed the rule-mode store at `.agent/governance/rule-modes.json`, the sixth protected path. The Tranche 4 build approval (`DECISIONS.md`, 2026-11-13, "Harness-governance Tranche 4 (Shift-left severity routing) approved for build", design point 7) names `scripts/promote-rule.js`, run by the user, as a permitted writer of that store and denies every subagent. The baseline findings store `.agent/governance/review-findings.jsonl` (advisory findings and the user's true or false labels, FR-238 and NFR-034) is not an FR-245 path, so the six-path count stands.

##### Scenario: Subagent write denied

- **GIVEN** a subagent session
- **WHEN** it writes `.agent/governance/profile.json` or `.claude/settings.json`
- **THEN** the write bar MUST deny the write
- **AND** the log MUST hold a deny record

##### Scenario: Evidence and toggle stores denied

- **GIVEN** a subagent session
- **WHEN** it writes `confirmations.jsonl` or `pending.jsonl` in the confirmation store, a file under `.agent/logs/governance/`, the session purpose record, or the rule-mode store
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

#### 2.35 FR-248: Strict JSON parser

**Statement:** The plugin MUST provide a dependency-free strict JSON parser that rejects an object holding a duplicate key at any nesting depth and rejects nesting deeper than 32 levels. Its error MUST carry a position and MUST NOT carry any slice of the input.
**Traces to:** UR-071, UR-075
**Priority:** Must
**Origin:** The user's design decision for this change (as-built intent). The no-echo rule follows NFR-016 (`specs/spec-hooks-platform.md:458`, `:548`), which keeps `JSON.parse` error text out of the logs because it can quote input that holds secrets. A duplicate key lets a later value silently override an earlier one in a governance file that the plugin trusts; this requirement closes that gap for the readers named in FR-249.

##### Scenario: Duplicate key at the top level

- **GIVEN** a JSON text with the key `a` twice in the same object
- **WHEN** the strict parser reads it
- **THEN** the parser MUST reject it
- **AND** the error MUST carry a position

##### Scenario: Duplicate key in a nested object

- **GIVEN** a JSON text with a duplicate key inside an object nested at depth 5
- **WHEN** the strict parser reads it
- **THEN** the parser MUST reject it

##### Scenario: Depth over 32

- **GIVEN** a JSON text nested 33 levels deep
- **WHEN** the strict parser reads it
- **THEN** the parser MUST reject it

##### Scenario: Depth at 32

- **GIVEN** a JSON text nested exactly 32 levels deep with no duplicate key
- **WHEN** the strict parser reads it
- **THEN** the parser MUST accept it

##### Scenario: Error holds no input

- **GIVEN** a rejected JSON text that holds the string `secret-value`
- **WHEN** the error text is read
- **THEN** it MUST NOT hold `secret-value` or any other slice of the input

##### Scenario: Valid input unchanged

- **GIVEN** valid JSON with no duplicate key and depth of 32 or less
- **WHEN** the strict parser reads it
- **THEN** it MUST return the same value as `JSON.parse`

#### 2.36 FR-249: Strict parser wired into three governance readers

**Statement (wiring):** The strict parser (FR-248) MUST be the parser of exactly three readers: the rule-mode store reader (`parseRuleModes` in `hooks/lib/severity.js`, file `.agent/governance/rule-modes.json`), the profile reader (`hooks/lib/data-class.js`, file `.agent/governance/profile.json`), and the confirmation-store record reader (`hooks/lib/confirmation-store.js`).
**Statement (routing):** A strict-parse rejection MUST route through the existing malformed-file path of that reader and MUST NOT create a new state: a rejected `rule-modes.json` MUST fall to all-advisory, a rejected `profile.json` MUST deny the guarded operations (FR-231, NFR-028), and the confirmation store MUST drop a rejected record as it drops any unparseable line.
**Statement (health):** The health check MUST report a strict-parse failure of `rule-modes.json` or `profile.json`, so the rejection is not silent.
**Statement (unchanged):** Behavior for valid, duplicate-free JSON of depth 32 or less MUST be unchanged for all three readers.
**Statement (read cap, PLANNED (1.14.6)):** The confirmation-store read cap of 1 MiB (`MAX_FILE_BYTES` in `hooks/lib/confirmation-store.js`) MUST apply to every read of a store file, including the read inside `markPendingUsed`, not only the record reader.
**Statement (over-cap refusal, PLANNED (1.14.6)):** A read of an over-cap store file MUST be refused fail-closed (NFR-028), so `markPendingUsed` MUST mark nothing and return false, matching the record reader returning no records.
**Statement (diagnostic fields, PLANNED (1.14.6)):** The confirmation-store `store-read-failed` and `store-write-failed` diagnostics MUST record the store file basename and the errno code only, and MUST NOT record the OS error message.
**Traces to:** UR-059, UR-068, UR-069, UR-071
**Priority:** Must
**Origin:** The user's design decision for this change (as-built intent). The malformed-file behavior is the existing one in FR-231 (Scenario "Malformed profile.json") and NFR-028. FR-242 defines the confirmation store. The read-cap and diagnostic-field statements are defense-in-depth hardening for assist-plugin 1.14.6; no earlier text in this file or in `FR-NFR-assist-plugin.md` states the 1 MiB cap. Conformance note for NFR-016: the no-echo rule in NFR-016 (`FR-NFR-assist-plugin.md`, which lists `hook-health.jsonl` and `fsa-log.jsonl`) and FR-248 (no input slice in an error) already cover untrusted input and filesystem paths in diagnostic text in general; the diagnostic-fields statement applies that rule to the two store diagnostics, because the OS error message can embed an absolute path.

##### Scenario: Duplicate key in rule-modes.json

- **GIVEN** `.agent/governance/rule-modes.json` holds a duplicate key
- **WHEN** a hook reads the rule-mode store
- **THEN** every rule MUST run in advisory mode
- **AND** the health check MUST report the strict-parse failure

##### Scenario: Duplicate key in profile.json

- **GIVEN** `.agent/governance/profile.json` holds a duplicate key and a profile is enforced
- **WHEN** a hook loads it
- **THEN** the guarded operations MUST be denied until the file is fixed (NFR-028)
- **AND** the health check MUST report the strict-parse failure

##### Scenario: Rejected confirmation record

- **GIVEN** `confirmations.jsonl` holds one record with a duplicate key and one valid record
- **WHEN** the PR-posting guard reads the store
- **THEN** the guard MUST ignore the rejected record
- **AND** the guard MUST read the valid record as before

##### Scenario: Valid files unchanged

- **GIVEN** valid, duplicate-free `rule-modes.json` and `profile.json`
- **WHEN** the hooks read them
- **THEN** the result MUST equal the result before this change

##### Scenario: Over-cap store file in markPendingUsed (PLANNED (1.14.6))

- **GIVEN** a confirmation-store file larger than 1 MiB
- **WHEN** `markPendingUsed` reads it
- **THEN** the read MUST be refused
- **AND** `markPendingUsed` MUST mark nothing and return false

##### Scenario: At-cap store file unchanged (PLANNED (1.14.6))

- **GIVEN** a valid confirmation-store file of 1 MiB or less
- **WHEN** `markPendingUsed` reads it
- **THEN** it MUST behave as before this change

##### Scenario: Store diagnostic holds no OS message (PLANNED (1.14.6))

- **GIVEN** a store read or write fails with an OS error whose message holds an absolute path
- **WHEN** the `store-read-failed` or `store-write-failed` diagnostic is recorded
- **THEN** it MUST hold the store file basename and the errno code
- **AND** it MUST NOT hold the OS error message or any absolute path

##### Scenario: Other readers untouched

- **GIVEN** a reader of any other JSON file that uses `JSON.parse`
- **WHEN** this requirement is applied
- **THEN** that reader MUST keep `JSON.parse` this release (follow-up in section 4)

#### Theme 5, Group A: Evaluation benchmark harness

**Status:** DRAFT. **Source:** the repository's research report `docs/research/research-eval-benchmarks-coding-spec-20261124.md`, cited below as "Report" with a line number. **System:** the benchmark harness, a set of golden tasks, graders, and a release-check section that measures the `developer` agent (code from specs) and the `requirements-gatherer` and `solutions-architect` agents (requirements and specs). It is not the plugin's hook harness of Themes 1 to 4; the BRD glossary term "Harness" does not apply here. **Reuse:** the harness extends the `evals/` suites that `claude plugin eval` already runs (`plugins/assist-plugin/evals/README.md:3`, `:28`) and the `tests/` suite, and adds no second runner (Report:93; FR-218 in `FR-NFR-assist-plugin.md`). The recorded run graded 8 cases in 165 seconds for about $4.85 (Report:6), which anchors the cost estimates in NFR-038.

#### 2.37 FR-254: Coding golden task contents

**Statement:** Each coding golden task MUST hold a task prompt, a reference solution, and a hidden test suite.
**Traces to:** UR-077
**Priority:** Must
**Origin:** Report:57-60. The hidden suite is the oracle; the reference solution is for diffing and triage.

##### Scenario: Complete task

- **GIVEN** a coding golden task directory with a prompt, a reference solution, and a hidden test suite
- **WHEN** the benchmark harness loads it
- **THEN** the harness MUST accept the task

##### Scenario: Missing hidden suite

- **GIVEN** a task directory with a prompt and a reference solution and no hidden test suite
- **WHEN** the benchmark harness loads it
- **THEN** the harness MUST reject the task
- **AND** the rejection MUST name the missing part

#### 2.38 FR-255: Spec golden task contents

**Statement:** Each spec golden task MUST hold a task prompt, a reference requirements set or reference spec, and a rubric that lists its deterministic checklist items apart from its subjective items.
**Traces to:** UR-077
**Priority:** Must
**Origin:** Report:62-64.

##### Scenario: Rubric with two item groups

- **GIVEN** a spec task whose rubric lists structural items and subjective items in separate groups
- **WHEN** the benchmark harness loads it
- **THEN** the harness MUST accept the task

##### Scenario: Rubric with one mixed list

- **GIVEN** a spec task whose rubric mixes structural and subjective items in one list
- **WHEN** the benchmark harness loads it
- **THEN** the harness MUST reject the task

#### 2.39 FR-256: Acceptance-criteria naming in hidden tests

**Statement:** Each test in a hidden test suite MUST carry the identifier of the acceptance-criteria scenario it checks, in the `[AC-n | spec | FR-n]` naming form that the repository's own tests use.
**Traces to:** UR-077
**Priority:** Must
**Origin:** Report:59-60; the naming form appears at `tests/hooks/gate-evidence.test.js:161`. The same scenario block defines the agent's target and the grader.

##### Scenario: Named test

- **GIVEN** a hidden test named `[AC-2 | spec-foo | FR-045] rejects an empty name`
- **WHEN** the benchmark harness loads the suite
- **THEN** the harness MUST accept the test

##### Scenario: Unnamed test

- **GIVEN** a hidden test whose name holds no scenario identifier
- **WHEN** the benchmark harness loads the suite
- **THEN** the harness MUST reject the task
- **AND** the rejection MUST name the test

#### 2.40 FR-257: Golden task provenance and dating

**Statement:** Each golden task MUST record its provenance (in-house or private repository), its creation date, and the model cutoff date it is valid against.
**Traces to:** UR-080
**Priority:** Must
**Origin:** Report:103. A time-based defense against contamination: a task is scored only against models whose cutoff precedes it.

##### Scenario: Complete record

- **GIVEN** a golden task whose metadata holds provenance, creation date, and valid-against cutoff
- **WHEN** the benchmark harness loads it
- **THEN** the harness MUST accept the task

##### Scenario: Missing cutoff

- **GIVEN** a golden task whose metadata holds no valid-against cutoff
- **WHEN** the benchmark harness loads it
- **THEN** the harness MUST reject the task

#### 2.41 FR-258: No public-dataset tasks

**Statement:** A golden task MUST NOT be derived from a public benchmark dataset.
**Traces to:** UR-080
**Priority:** Must
**Origin:** Report:29, `:103`. Public tasks appear in model training data, so a high score may measure recall.

##### Scenario: In-house task

- **GIVEN** a golden task whose provenance reads in-house
- **WHEN** the benchmark harness loads it
- **THEN** the harness MUST accept the task

##### Scenario: Public-dataset task

- **GIVEN** a golden task whose provenance names a public benchmark dataset
- **WHEN** the benchmark harness loads it
- **THEN** the harness MUST reject the task

#### 2.42 FR-259: Reference solution validated before admission

**Statement:** The benchmark harness MUST admit a coding golden task only after its reference solution passes its hidden test suite in each of a configured number of consecutive runs.
**Traces to:** UR-080
**Priority:** Must
**Origin:** Report:106. A suite that fails on its own reference, or fails on some runs, scores noise. The run count is a configured value (OQ-14).

##### Scenario: Stable reference

- **GIVEN** the configured count is 3 and the reference solution passes the hidden suite on 3 consecutive runs
- **WHEN** the benchmark harness validates the task
- **THEN** the harness MUST admit the task

##### Scenario: Reference fails once

- **GIVEN** the configured count is 3 and the reference solution fails the hidden suite on run 2
- **WHEN** the benchmark harness validates the task
- **THEN** the harness MUST NOT admit the task
- **AND** the report MUST name the failing run

#### 2.43 FR-260: Reference and hidden suite withheld from the agent

**Statement:** The benchmark harness MUST withhold the reference solution and the hidden test suite from the agent under test.
**Traces to:** UR-080
**Priority:** Must
**Origin:** Report:59. The reference is "never shown to the agent".

##### Scenario: Agent workspace

- **GIVEN** a coding run for a golden task
- **WHEN** the benchmark harness prepares the agent's workspace
- **THEN** the workspace MUST hold no reference solution and no hidden test suite file

##### Scenario: Leak detected

- **GIVEN** a prepared workspace that holds a file from the reference directory
- **WHEN** the benchmark harness checks the workspace before the run
- **THEN** the harness MUST abort the run
- **AND** the report MUST name the leaked path

#### 2.44 FR-261: Reference material kept out of published artifacts

**Statement:** The benchmark harness MUST keep each reference solution and hidden test suite out of every published artifact.
**Traces to:** UR-080
**Priority:** Must
**Origin:** Report:103 (keep hidden suites out of any published docs). The report's layout (`:78-91`) places `reference/` beside each case under the plugin tree, which ships with the marketplace repository; where the material lives is open (OQ-15, D-16).

##### Scenario: Package without reference material

- **GIVEN** the list of files in a published plugin package
- **WHEN** the list is searched for golden-task reference and hidden-suite paths
- **THEN** the search MUST find none

##### Scenario: Reference path in the package

- **GIVEN** a published package list that holds a golden-task reference path
- **WHEN** the benchmark harness validates the package list
- **THEN** the validation MUST fail
- **AND** the result MUST name the path

#### 2.45 FR-262: Coding score from the suite exit code

**Statement:** The benchmark harness MUST score a coding run as pass when the hidden test suite exits 0 and as fail when it exits non-zero, with no model call in the scoring.
**Traces to:** UR-078
**Priority:** Must
**Origin:** Report:16, `:25`, `:73`. Execution is the grading principle of every current code benchmark; `run-test` and the `gate-evidence` hook already parse test exit codes.

##### Scenario: Suite passes

- **GIVEN** a coding run whose hidden suite exits 0
- **WHEN** the benchmark harness scores the run
- **THEN** the run MUST score pass
- **AND** the scoring MUST make no model call

##### Scenario: Suite fails

- **GIVEN** a coding run whose hidden suite exits 1
- **WHEN** the benchmark harness scores the run
- **THEN** the run MUST score fail

#### 2.46 FR-263: Golden tasks run as existing eval cases

**Statement:** The benchmark harness MUST run each golden task as a case in the existing `claude plugin eval` layout (a `prompt.md` and a `graders/` folder under `evals/`).
**Traces to:** UR-078
**Priority:** Must
**Origin:** The requester's reuse constraint; Report:53, `:93`; `plugins/assist-plugin/evals/README.md:3`. No parallel runner is added; FR-218 in `FR-NFR-assist-plugin.md` already ships suites that run this way.

##### Scenario: Case listed by the runner

- **GIVEN** a golden task directory with `prompt.md` and a `graders/` folder under `evals/`
- **WHEN** `claude plugin eval` lists the cases
- **THEN** the list MUST include the golden task

##### Scenario: Task without graders

- **GIVEN** a golden task directory with no `graders/` folder
- **WHEN** the benchmark harness loads it
- **THEN** the harness MUST reject the task

#### 2.47 FR-264: Not-run when the sandbox backend is missing

**Statement:** The benchmark harness MUST report a coding run as not-run, never as pass or fail, when the sandbox backend that the run's Write, Edit, and Bash grant requires is unavailable.
**Traces to:** UR-078
**Priority:** Must
**Origin:** `plugins/assist-plugin/evals/README.md:40` (the runner refuses a shell grant when it cannot confine the shell); Report:58, `:119`. A coding case needs Write, Edit, and Bash, which the current cases do not grant (`evals/README.md:34`).

##### Scenario: Backend absent

- **GIVEN** a coding case that needs a shell grant and a machine with no sandbox backend
- **WHEN** the benchmark harness runs the case
- **THEN** the run MUST read not-run
- **AND** the run MUST count in neither c nor k of FR-271

##### Scenario: Backend present

- **GIVEN** the same case and a machine with the sandbox backend
- **WHEN** the benchmark harness runs the case
- **THEN** the run MUST read pass or fail from the hidden suite

#### 2.48 FR-265: Structural score for spec runs

**Statement:** The benchmark harness MUST score a spec run as the fraction of its deterministic checklist items that pass, with no model call in the scoring.
**Traces to:** UR-078
**Priority:** Must
**Origin:** Report:47, `:69`, `:74`. A structural score is a floor: the artifact met the form, not that it is good (Report:38).

##### Scenario: Partial score

- **GIVEN** a spec run that passes 8 of 10 deterministic checklist items
- **WHEN** the benchmark harness scores the run
- **THEN** the structural score MUST read 0.8

##### Scenario: Checklist cannot run

- **GIVEN** a spec run whose reference file is unreadable
- **WHEN** the benchmark harness scores the run
- **THEN** the run MUST read error
- **AND** the structural score MUST NOT read 0

#### 2.49 FR-266: Checklist built from existing checks

**Statement:** The deterministic checklist MUST be built from the checks that `spec-from-requirements` review mode and the `gather-requirements` quality criteria already define.
**Traces to:** UR-078
**Priority:** Must
**Origin:** Report:9, `:47`; `plugins/assist-plugin/skills/spec-from-requirements/SKILL.md:140-149`; `plugins/assist-plugin/skills/gather-requirements/SKILL.md:99-101`.

##### Scenario: Item with a source

- **GIVEN** a checklist item "every Requirement has a Scenario"
- **WHEN** the harness validates the checklist
- **THEN** the harness MUST accept the item because `spec-from-requirements` review mode defines it

##### Scenario: Item with no source

- **GIVEN** a checklist item that no existing check or quality criterion defines
- **WHEN** the harness validates the checklist
- **THEN** the harness MUST reject the item

#### 2.50 FR-267: Reference coverage check

**Statement:** The deterministic checklist MUST confirm that each requirement identifier, scenario, and error path of the reference appears in the output.
**Traces to:** UR-078
**Priority:** Must
**Origin:** Report:40. Surface-overlap metrics correlate poorly with human judgment, so reference comparison reduces to checklist coverage over the plugin's traceability identifiers.

##### Scenario: Full coverage

- **GIVEN** a reference with FR-1 to FR-3 and one error path each, and an output that holds all of them
- **WHEN** the checklist runs
- **THEN** the reference-coverage items MUST pass

##### Scenario: Missing error path

- **GIVEN** an output that omits the error path of FR-3
- **WHEN** the checklist runs
- **THEN** the item for that error path MUST fail
- **AND** the result MUST name FR-3

#### 2.51 FR-268: Optional judge

**Statement:** The benchmark harness MAY score the subjective rubric items of a spec case with an LLM-as-judge grader.
**Traces to:** UR-078
**Priority:** May
**Origin:** Report:47, `:74`, `:105`. The judge is advisory; the deterministic checklist is the gate.

##### Scenario: Judge off

- **GIVEN** a spec case and no judge configured
- **WHEN** the benchmark harness scores the case
- **THEN** the result MUST hold a structural score
- **AND** the judge score MUST read absent

##### Scenario: Judge on

- **GIVEN** a spec case and a judge configured
- **WHEN** the benchmark harness scores the case
- **THEN** the result MUST hold both a structural score and a judge score

#### 2.52 FR-269: Judge runs after the checklist is cleared

**Statement:** The benchmark harness MUST run the judge grader only on a spec case that cleared the structural checklist. A case clears the checklist when every deterministic item passes (assumption A-13).
**Traces to:** UR-078
**Priority:** Must
**Origin:** Report:74 (pass two runs only on cases that cleared pass one). It keeps judge cost off artifacts that already fail the form.

##### Scenario: Cleared case judged

- **GIVEN** a spec case with every deterministic item passed and a judge configured
- **WHEN** the benchmark harness scores the case
- **THEN** the judge grader MUST run

##### Scenario: Uncleared case not judged

- **GIVEN** a spec case with one deterministic item failed and a judge configured
- **WHEN** the benchmark harness scores the case
- **THEN** the judge grader MUST NOT run
- **AND** the judge score MUST read absent

#### 2.53 FR-270: Two separate scores

**Statement:** The benchmark harness MUST report the structural score and the judge score as two separate values and MUST NOT combine them into one number.
**Traces to:** UR-078
**Priority:** Must
**Origin:** Report:69 (do not average a deterministic floor with a noisy judge).

##### Scenario: Separate values

- **GIVEN** a spec case with a structural score 0.9 and a judge score 0.6
- **WHEN** the result is written
- **THEN** the result MUST hold 0.9 and 0.6 as two values

##### Scenario: Combined field

- **GIVEN** a result that holds a field averaging the two scores
- **WHEN** the result is validated
- **THEN** the validation MUST fail and name the field

#### 2.54 FR-271: pass@1 over k runs

**Statement:** The benchmark harness MUST report pass@1 for a coding case as c divided by k, where k is the number of completed runs of that case and c is the number of those runs that pass.
**Traces to:** UR-078
**Priority:** Must
**Origin:** Report:22, `:26`, `:68`. For a sample of k runs, the unbiased pass@k estimator of the Codex paper (https://arxiv.org/pdf/2107.03374) at k = 1 equals c divided by k. A not-run or error run is not a completed run.

##### Scenario: Three of five pass

- **GIVEN** a coding case run 5 times with 3 passes
- **WHEN** the benchmark harness reports pass@1
- **THEN** the value MUST read 0.6

##### Scenario: No completed run

- **GIVEN** a coding case whose every run read not-run
- **WHEN** the benchmark harness reports pass@1
- **THEN** the value MUST read absent
- **AND** the value MUST NOT read 0

#### 2.55 FR-272: pass@1 stated with its basis

**Statement:** The benchmark result MUST state k, c, and the benchmark harness version beside each pass@1 value.
**Traces to:** UR-078
**Priority:** Must
**Origin:** Report:22, `:30`. pass@1 is not computed one way across labs, and an in-house score compares only with in-house runs on the same harness version.

##### Scenario: Full basis

- **GIVEN** a pass@1 value of 0.6
- **WHEN** the result is written
- **THEN** the result MUST hold k = 5, c = 3, and the harness version beside it

##### Scenario: Missing version

- **GIVEN** a result that holds a pass@1 value and no harness version
- **WHEN** the result is validated
- **THEN** the validation MUST fail

#### 2.56 FR-273: Benchmark section in the release check

**Statement:** The release-check runner MUST provide a benchmark section that runs the coding and spec suites and compares the scores of each suite with the scores stored for the previous release. The suite score is the mean pass@1 of a coding suite and the mean structural score of a spec suite.
**Traces to:** UR-079
**Priority:** Must
**Origin:** Report:97. `release-check.js` already runs an ordered list of independent sections and reports each on its own line (FR-250 in `FR-NFR-assist-plugin.md`; `plugins/assist-plugin/scripts/release-check.js:4-26`). The delta to FR-250 in that document is its statement (benchmark section): the section reports the last stored scoreboard, does not auto-run the suite, and runs the suite only on request through this harness (D-15; FR-274).

##### Scenario: Comparison reported

- **GIVEN** stored scores for the previous release and a benchmark request
- **WHEN** the benchmark section runs
- **THEN** the section MUST report, for each suite, the current score and the previous score

##### Scenario: No previous release

- **GIVEN** no stored scores for a previous release
- **WHEN** the benchmark section runs
- **THEN** the section MUST report no baseline
- **AND** the section MUST NOT report a regression finding

#### 2.57 FR-274: Benchmark section runs on request only

**Statement:** The benchmark section MUST run only when the user requests it.
**Traces to:** UR-079
**Priority:** Must
**Origin:** Report:114. A full benchmark run is estimated at $25 to $75, so it must not start with every release check (OQ-13).

##### Scenario: Plain release check

- **GIVEN** a release check started with no benchmark request
- **WHEN** the runner runs its sections
- **THEN** the benchmark section MUST NOT run
- **AND** every other section MUST behave as before

##### Scenario: Requested run

- **GIVEN** a release check started with the benchmark request
- **WHEN** the runner runs its sections
- **THEN** the benchmark section MUST run

#### 2.58 FR-275: Results keyed to the plugin version

**Statement:** The benchmark harness MUST key each stored result to the plugin version that the run result records.
**Traces to:** UR-079
**Priority:** Must
**Origin:** Report:97; the run JSON records `version` (`plugins/assist-plugin/evals/results/2026-11-19T17-48-14-215Z/aggregate-result.json:16`).

##### Scenario: Keyed result

- **GIVEN** a run result that records plugin version 1.14.7
- **WHEN** the harness stores the result
- **THEN** the stored result MUST be keyed to 1.14.7

##### Scenario: Result without a version

- **GIVEN** a run result that records no plugin version
- **WHEN** the harness stores the result
- **THEN** the harness MUST refuse to store it

#### 2.59 FR-276: Version-controlled scoreboard

**Statement:** The repository MUST hold, under version control, a scoreboard that lists for each release and suite the version, pass@1, structural score, and judge score.
**Traces to:** UR-079
**Priority:** Must
**Origin:** Report:97. The `evals/results/` folder is git-ignored (`plugins/assist-plugin/evals/.gitignore`), so the trend needs a tracked file.

##### Scenario: Row added for a release

- **GIVEN** a completed benchmark section for version 1.14.7
- **WHEN** the scoreboard is read
- **THEN** it MUST hold a row for 1.14.7 for each suite run

##### Scenario: Row missing

- **GIVEN** a completed benchmark section and a scoreboard with no row for that version
- **WHEN** the benchmark section ends
- **THEN** the section MUST report a finding that names the version

#### 2.60 FR-277: Regression finding beyond a margin

**Statement:** The benchmark section MUST report a regression finding when the score of a suite is below the previous release's score for that suite by more than a configured margin.
**Traces to:** UR-079
**Priority:** Must
**Origin:** Report:97. The margin is a configured value (OQ-14). A finding yields the existing release-check exit code 1 (FR-250 in `FR-NFR-assist-plugin.md`).

##### Scenario: Drop beyond the margin

- **GIVEN** a margin of 0.05, a previous suite score of 0.80, and a current score of 0.70
- **WHEN** the benchmark section compares them
- **THEN** the section MUST report a regression finding for that suite

##### Scenario: Drop within the margin

- **GIVEN** a margin of 0.05, a previous suite score of 0.80, and a current score of 0.78
- **WHEN** the benchmark section compares them
- **THEN** the section MUST report no regression finding

#### 2.61 FR-278: Comparison over shared cases

**Statement:** The release comparison MUST be computed over the cases present in both releases.
**Traces to:** UR-079
**Priority:** Must
**Origin:** Report:104 (rotating cases keeps the measured set from going static, so the two releases rarely hold the same set).

##### Scenario: Case added

- **GIVEN** the current release holds a case that the previous release lacks
- **WHEN** the benchmark section compares scores
- **THEN** the added case MUST NOT enter either score

##### Scenario: Case removed

- **GIVEN** the previous release holds a case that the current release lacks
- **WHEN** the benchmark section compares scores
- **THEN** the removed case MUST NOT enter either score

#### 2.62 FR-279: Judge decline is advisory

**Statement:** The benchmark section MUST report a judge-score decline as advisory only.
**Traces to:** UR-079
**Priority:** Must
**Origin:** Report:105 (treat the judge as advisory and the checklist as the gate, as `code-scan` and `goal-guard` are advisory until promoted).

##### Scenario: Judge drops alone

- **GIVEN** a judge score down 0.2 and structural scores within the margin
- **WHEN** the benchmark section compares releases
- **THEN** the section MUST report an advisory note
- **AND** the section MUST report no regression finding

##### Scenario: Structural score drops too

- **GIVEN** a judge score down 0.2 and a structural score down beyond the margin
- **WHEN** the benchmark section compares releases
- **THEN** the section MUST report a regression finding for the structural score

#### 2.63 FR-280: Held-out cases run at release only

**Statement:** The benchmark harness MUST run its held-out cases only in the benchmark section of a release check.
**Traces to:** UR-080
**Priority:** Must
**Origin:** Report:104. A slice that never runs between releases cannot inform a prompt or skill edit, so it resists overfitting.

##### Scenario: Ordinary eval run

- **GIVEN** a case flagged held-out
- **WHEN** an ordinary `claude plugin eval` run lists cases
- **THEN** the harness MUST exclude the held-out case from the run

##### Scenario: Release benchmark

- **GIVEN** a case flagged held-out and a benchmark request
- **WHEN** the benchmark section runs
- **THEN** the section MUST include the held-out case

#### 2.64 FR-281: New cases each release

**Statement:** The benchmark harness SHOULD add at least one new golden task to each suite in each release that runs the benchmark section.
**Traces to:** UR-080
**Priority:** Should
**Origin:** Report:104 (rotate in new cases each release). The count of one is an estimate to confirm.

##### Scenario: New task added

- **GIVEN** a release that runs the benchmark section and a suite with one case not present in the previous release
- **WHEN** the scoreboard is compared with the previous release
- **THEN** the check MUST find a new case in that suite

##### Scenario: No new task

- **GIVEN** a suite with no new case in a benchmark release
- **WHEN** the benchmark section runs
- **THEN** the section MUST report an advisory note that names the suite

#### 2.65 FR-282: Bias mitigations for a same-family judge

**Statement:** WHEN the judge and the agent under test share a model family, the benchmark harness MUST apply three bias mitigations to the judge score (candidate-order randomization per FR-284, rubric anchoring per FR-283, and a human-agreement check at each benchmark release per FR-286) and MUST record the judge family and the agent family in the result.
**Traces to:** UR-080
**Priority:** Must
**Origin:** Report:43, `:74`, `:105`. A judge rates its own family's text higher, so a same-family judge needs the mitigations. The user settled a same-family judge now, with these mitigations; the requirement applies only when a judge runs (FR-268). A judge from a different model family is a future enhancement and not a requirement of this version (section 4, OQ-16). Where no human-labeled sample exists, the check reports that no agreement figure exists (FR-286) and the judge score stays advisory (FR-279).

##### Scenario: Same family with mitigations

- **GIVEN** an agent under test and a judge of the same family, and a benchmark release with a human-labeled sample
- **WHEN** the judge grader runs
- **THEN** the harness MUST randomize the candidate order, MUST score each rubric item against its own text, and MUST report the human-agreement figure
- **AND** the result MUST name the judge family and the agent family

##### Scenario: Mitigation missing

- **GIVEN** a judge result for a same-family judge that records no candidate-order randomization
- **WHEN** the result is validated
- **THEN** the validation MUST fail

##### Scenario: No human-labeled sample

- **GIVEN** a same-family judge and no human-labeled sample at the benchmark release
- **WHEN** the human-agreement check runs
- **THEN** the report MUST state that no agreement figure exists

#### 2.66 FR-283: Judge scores each rubric item

**Statement:** The judge MUST score each subjective rubric item separately against the text of that item.
**Traces to:** UR-080
**Priority:** Must
**Origin:** Report:105 (anchor the judge to the explicit rubric, not an open "is this good", because style bias favors longer or more fluent text).

##### Scenario: Per-item scores

- **GIVEN** a rubric with 3 subjective items
- **WHEN** the judge scores a spec
- **THEN** the result MUST hold 3 item scores

##### Scenario: One overall score

- **GIVEN** a judge result that holds a single overall score and no item scores
- **WHEN** the result is validated
- **THEN** the validation MUST fail

#### 2.67 FR-284: Both comparison orders

**Statement:** WHEN the judge compares two texts, the benchmark harness MUST run the comparison in both orders and average the two results.
**Traces to:** UR-080
**Priority:** Must
**Origin:** Report:44, `:105` (position bias).

##### Scenario: Pairwise comparison

- **GIVEN** a judge comparison of an output against the reference
- **WHEN** the harness runs it
- **THEN** the harness MUST run output-then-reference and reference-then-output
- **AND** the reported result MUST be the mean of the two

##### Scenario: One order only

- **GIVEN** a comparison result built from one order
- **WHEN** the result is validated
- **THEN** the validation MUST fail

#### 2.68 FR-285: Judge score as a mean over runs

**Statement:** The benchmark result MUST report each judge score as the mean of a configured number of judge runs and MUST state that number.
**Traces to:** UR-080
**Priority:** Must
**Origin:** Report:45, `:106` (the judge is stochastic; a judge score reproduces only as an average over several runs). The number is a configured value (OQ-14).

##### Scenario: Mean of three

- **GIVEN** a configured count of 3 and judge runs scoring 0.6, 0.7, and 0.8
- **WHEN** the result is written
- **THEN** the judge score MUST read 0.7
- **AND** the result MUST state 3 runs

##### Scenario: Count not stated

- **GIVEN** a result that holds a judge score and no run count
- **WHEN** the result is validated
- **THEN** the validation MUST fail

#### 2.69 FR-286: Judge-human agreement

**Statement:** WHERE a human-labeled sample of spec outputs exists, the benchmark harness SHOULD report the judge's agreement with the human scores as Spearman rho or Cohen kappa.
**Traces to:** UR-080
**Priority:** Should
**Origin:** Report:45, `:105`. G-Eval reached Spearman 0.514 with human raters on summarization, so agreement is measured, not assumed.

##### Scenario: Labeled sample

- **GIVEN** a labeled sample of 20 spec outputs with human scores
- **WHEN** the benchmark harness reports the judge
- **THEN** the report SHOULD hold a Spearman rho or a Cohen kappa for the sample

##### Scenario: No sample

- **GIVEN** no labeled sample
- **WHEN** the benchmark harness reports the judge
- **THEN** the report SHOULD state that no agreement figure exists

#### 2.70 FR-287: Flaky tests reported, not silenced

**Statement:** The benchmark harness MUST report a hidden-suite test that gives different results on repeated runs of the same candidate as flaky, without skipping or retrying it.
**Traces to:** UR-080
**Priority:** Must
**Origin:** Report:106; `plugins/assist-plugin/skills/run-test/SKILL.md:162` forbids silencing a flaky test. The recorded eval flake is at `plugins/assist-plugin/evals/README.md:41`.

##### Scenario: Flaky test flagged

- **GIVEN** a hidden test that passes on run 1 and fails on run 2 for the same candidate
- **WHEN** the benchmark harness reports the suite
- **THEN** the report MUST list the test as flaky
- **AND** the test MUST still count in the suite result

##### Scenario: Retry-until-pass configured

- **GIVEN** a configuration that retries a failing hidden test until it passes
- **WHEN** the benchmark harness loads the configuration
- **THEN** the harness MUST reject the configuration

#### Theme 6, Group B: Reviewer and review machinery

**Status:** DRAFT. **System:** the `reviewer` and `code-reviewer` agents, the `/do` orchestrator's review gates, and the PR-review workflow. **Relationship to existing controls:** Group B extends and does not replace FR-218 (revision cap and escalation), FR-221 and FR-222 (evidence-backed gates, approval writer), FR-237 to FR-241 (severity policy, advisory baseline, routing, finding fields, SARIF), NFR-027 (fewest tools), NFR-034 (user-set labels), and NFR-036 (LLM Security Clear). The current controls are `plugins/assist-plugin/agents/reviewer.md`, `plugins/assist-plugin/agents/code-reviewer.md`, `plugins/assist-plugin/skills/do/references/review-protocol.md` (Review Output Rules, `:133-143`), `plugins/assist-plugin/skills/do/references/fix-phase-rules.md`, and `specs/spec-orchestration-review-gates.md` (Requirements 2, 4, 6, and 7). Each requirement below names the control it extends and the gap it closes. Reviewers stay read-only; the orchestrator writes every record (NFR-040). **Terms:** "lane" is a review focus with its own checklist; "rule identifier" is the identifier of a severity-catalog entry, and every checklist item is also a catalog entry (FR-306). Cost figures for concurrent lanes are estimates to confirm by measurement.

#### 2.71 FR-288: Reviewer checklists per lane

**Statement:** The plugin MUST keep one reviewer checklist for each of three review lanes (defect-depth, test-integrity, and architecture-safety), and each checklist item MUST have an identifier, a check, and the evidence that clears it.
**Traces to:** UR-081
**Priority:** Should
**Origin:** Extends `reviewer.md` and `code-reviewer.md`, which name gate categories (OWASP Top 10, five Code Review dimensions) but hold no itemized checklist for recurring defect classes such as unbounded input, tests that pass on a regression, or documentation that disagrees with code. The register below is the initial content; it is DRAFT.

**Reviewer checklist register (initial content):**

| ID | Lane | Check | Evidence that clears it | Applies to |
|----|------|-------|-------------------------|------------|
| DD-01 | defect-depth | Each loop, repeated pattern, or parse step over external text has an upper bound on input size or repeat count | The bound at file:line, or a finding that names the unbounded step | code |
| DD-02 | defect-depth | Parsed external data has an overall size bound in addition to any per-field or per-level cap | The bound at file:line | code |
| DD-03 | defect-depth | A cap that drops or cuts data rejects the input or marks the cut for the caller | The rejection or marker at file:line | code |
| DD-04 | defect-depth | Sanitizing runs on bounded input, and a cut cannot leave a split token that survives it | The order of bound and sanitize at file:line | code |
| DD-05 | defect-depth | Identifiers match ASCII-only classes, and URLs pass the project's existing safe-URL check, including userinfo and look-alike host forms | The check at file:line | code |
| DD-06 | defect-depth | A normalizer returns the same value when applied twice, and one input class has one error outcome | The code path or a test | code |
| DD-07 | defect-depth | Values that are compared or ordered share one time-zone treatment | The conversion at file:line | code |
| DD-08 | defect-depth | A schema change declares its lock limit and does not collide with another open change to the same revision sequence | The declaration at file:line | code, config |
| DD-09 | defect-depth | Pinned versions match the runtime that the build targets and the declared ranges of sibling packages | The manifest lines | config |
| TI-01 | test-integrity | Each assertion fails when the behavior it guards is reverted | The reverted case, or a test that fails on it | test |
| TI-02 | test-integrity | The boundary value and the value on each side of it have a case | The cases at file:line | test |
| TI-03 | test-integrity | No assertion passes when the guarded value is empty or removed | The assertion text | test |
| TI-04 | test-integrity | Each test reaches the branch or option it names, and no default setup hides it | The setup at file:line | test |
| TI-05 | test-integrity | Each behavior that a docstring, comment, or document claims matches the code and has a test | The claim and the test or code line | code, test, document |
| TI-06 | test-integrity | A count or list stated in prose is derived or checked, not hand-written | The check or the matching count | document |
| TI-07 | test-integrity | Validators and constraints agree with the contract that the code states for them | The two lines compared | code |
| TI-08 | test-integrity | A test that replaces a boundary with a recorder is not the only proof of that boundary's behavior | A test against the real boundary | test |
| AS-01 | architecture-safety | In a multi-owner data model, every table, unique key, and relation carries the owner key | The schema lines | code, config |
| AS-02 | architecture-safety | An access policy is scoped to the account and resource it serves | The policy lines | config |
| AS-03 | architecture-safety | A credential is not written to a location that outlives the job | The write at file:line | config, pipeline |
| AS-04 | architecture-safety | The author of a control change is not its only approver | The change record | config, document |
| AS-05 | architecture-safety | A failed privacy or permission check denies the operation | The failure path at file:line | code |
| AS-06 | architecture-safety | Untrusted text that reaches rendered output cannot create a live control or link | The escaping at file:line | code |

**Lane-to-gate table (FR-291; OQ-18):**

| Lane | Existing gates that apply it |
|------|------------------------------|
| defect-depth | Pre-Test Code Review Gate; Security Gate |
| test-integrity | Testing Gate (reviewed by `qa`); Code Review Gate |
| architecture-safety | Code Review Gate |

##### Scenario: Checklist valid

- **GIVEN** three lane checklists whose every item has an identifier, a check, and an evidence entry
- **WHEN** the checklist validation runs
- **THEN** the validation MUST pass

##### Scenario: Item without evidence

- **GIVEN** a checklist item with no evidence entry
- **WHEN** the checklist validation runs
- **THEN** the validation MUST fail
- **AND** the result MUST name the item

#### 2.72 FR-289: Every applicable item accounted for

**Statement:** The `reviewer` and `code-reviewer` agents MUST account for each checklist item that applies to the artifact type as evaluated or as skipped with a reason.
**Traces to:** UR-081
**Priority:** Should
**Origin:** Extends the Review Output Rules rule "Reject an incomplete report" (`review-protocol.md:142`) and the `skipped:` field of the terminal block. Gap: nothing shows which recurring classes a clean review did not look at.

##### Scenario: All items accounted for

- **GIVEN** a code artifact for which 5 checklist items apply
- **WHEN** the reviewer reports
- **THEN** the report MUST list 5 items as evaluated or skipped with a reason

##### Scenario: Item missing from the report

- **GIVEN** a report that lists 4 of the 5 applicable items
- **WHEN** the orchestrator reads it
- **THEN** the orchestrator MUST reject the report and ask for a corrected one

#### 2.73 FR-290: Finding carries its rule identifier

**Statement:** A finding raised from a checklist item MUST carry that item's identifier as its rule identifier.
**Traces to:** UR-081
**Priority:** Should
**Origin:** Extends the finding format of `reviewer.md` (location, problem, fix, `severity`, `confidence`, `routing`). The rule identifier is what lets FR-306, FR-310, and FR-312 act on a finding.

##### Scenario: Item cited

- **GIVEN** a reviewer finds an unbounded repeated pattern at `src/parse.js:12`
- **WHEN** the reviewer writes the finding
- **THEN** the finding MUST carry `DD-01` as its rule identifier

##### Scenario: Item not cited

- **GIVEN** a finding raised from checklist item DD-01 with no rule identifier
- **WHEN** the orchestrator reads the report
- **THEN** the orchestrator MUST reject the report and ask for a corrected one

#### 2.74 FR-291: Lanes applied within existing gates

**Statement:** Each lane checklist MUST be applied within the existing gates that the lane-to-gate table assigns.
**Traces to:** UR-081
**Priority:** Should
**Origin:** Extends `review-protocol.md` (gate list) and `specs/spec-orchestration-review-gates.md` Requirement 1. No gate is added, so the cap of FR-218 and the gate bounds stay unchanged. Which agent applies the test-integrity lane in the Testing Gate is open (OQ-18).

##### Scenario: Lane in an assigned gate

- **GIVEN** the Security Gate runs on a code change
- **WHEN** the reviewer audits it
- **THEN** the reviewer MUST evaluate the defect-depth items that apply

##### Scenario: Lane assigned to no gate

- **GIVEN** a lane that the lane-to-gate table assigns to no existing gate
- **WHEN** the checklist validation runs
- **THEN** the validation MUST fail and name the lane

#### 2.75 FR-292: Concurrent lane reviews

**Statement:** The orchestrator MAY dispatch the lane reviews of one gate concurrently, with at most three reviewer dispatches running at once.
**Traces to:** UR-081
**Priority:** May
**Origin:** Extends the gate dispatch of `specs/spec-orchestration-review-gates.md` Requirement 2 and the LLM10 control to cap parallel agents (`plugins/assist-plugin/rules/llm-security-checklist.md:321-345`). The cap equals the number of lanes. The token cost is an estimate of about three times one pass (NFR-041).

##### Scenario: Three lanes at once

- **GIVEN** a gate with three lane reviews ready
- **WHEN** the orchestrator dispatches them
- **THEN** the orchestrator MAY run all three at once

##### Scenario: Fourth dispatch held

- **GIVEN** three reviewer dispatches running
- **WHEN** a fourth reviewer dispatch is ready
- **THEN** the orchestrator MUST hold it until one dispatch ends

#### 2.76 FR-293: Merge of duplicate findings

**Statement:** WHEN lane reviews ran concurrently, the orchestrator MUST merge findings that share a file, a line, and a rule identifier into one finding that keeps the highest severity among them.
**Traces to:** UR-081
**Priority:** Should
**Origin:** Extends the "no padding" rule (`review-protocol.md:143`: one line of agreement when another reviewer already raised a point). Merging by the orchestrator keeps every reviewer read-only (NFR-040).

##### Scenario: Same finding from two lanes

- **GIVEN** two lanes report DD-01 at `src/parse.js:12`, one as HIGH and one as MEDIUM
- **WHEN** the orchestrator merges the reports
- **THEN** the merged report MUST hold one finding at `src/parse.js:12` with severity HIGH

##### Scenario: Different lines

- **GIVEN** two lanes report DD-01 at `src/parse.js:12` and `src/parse.js:40`
- **WHEN** the orchestrator merges the reports
- **THEN** the merged report MUST hold both findings

#### 2.77 FR-294: Stable finding identifier

**Statement:** Each finding MUST carry an identifier that stays the same in every round of one gate.
**Traces to:** UR-082
**Priority:** Should
**Origin:** Extends the prior-findings hand-off of `specs/spec-orchestration-review-gates.md` Requirement 2 (`<review-findings>`). Gap: a re-review cannot say which earlier finding a later one is, so rounds cannot be counted per finding.

##### Scenario: Identifier carried across rounds

- **GIVEN** finding F-3 in round 1 that is still open in round 2
- **WHEN** the reviewer writes the round-2 report
- **THEN** the report MUST list that finding as F-3

##### Scenario: Finding without an identifier

- **GIVEN** a report whose finding holds no identifier
- **WHEN** the orchestrator reads it
- **THEN** the orchestrator MUST reject the report and ask for a corrected one

#### 2.78 FR-295: Status of every prior finding

**Statement:** On a re-review the reviewer MUST give each prior finding exactly one status of fixed, open, or withdrawn with a one-line reason, and MUST mark every other finding as new.
**Traces to:** UR-082
**Priority:** Should
**Origin:** Extends the rule "Report only what changed on a re-review" (`review-protocol.md:140`), which lists resolved findings in one line and has no status vocabulary or withdrawn state.

##### Scenario: Statuses given

- **GIVEN** 3 prior findings and 1 new defect
- **WHEN** the reviewer writes the re-review report
- **THEN** each prior finding MUST hold one of fixed, open, or withdrawn with a reason
- **AND** the new defect MUST read new

##### Scenario: Prior finding without a status

- **GIVEN** a re-review report that omits the status of prior finding F-2
- **WHEN** the orchestrator reads it
- **THEN** the orchestrator MUST reject the report and ask for a corrected one

#### 2.79 FR-296: Reviewed revision named

**Statement:** Each review report MUST name the revision of the artifact it reviewed, as a content digest or a commit identifier.
**Traces to:** UR-083
**Priority:** Should
**Origin:** Extends FR-221 (a gate clears only on evidence). Gap: a verdict names no revision, so it cannot be tied to the artifact that exists at the gate.

##### Scenario: Revision named

- **GIVEN** a reviewer report for a task whose artifact has a known digest
- **WHEN** the reviewer writes the report
- **THEN** the report MUST hold that digest or a commit identifier

##### Scenario: Revision missing

- **GIVEN** a report with no revision
- **WHEN** the orchestrator reads it
- **THEN** the orchestrator MUST reject the report and ask for a corrected one

#### 2.80 FR-297: Stale verdict not counted

**Statement:** The orchestrator MUST NOT count a reviewer verdict toward a gate when the artifact has changed since the revision that the report names.
**Traces to:** UR-083
**Priority:** Should
**Origin:** Extends FR-218 and `specs/spec-orchestration-review-gates.md` Requirement 4 (two consecutive `approved` verdicts end a gate). Gap: both approvals may name different revisions.

##### Scenario: Both approvals on one revision

- **GIVEN** two consecutive `approved` reports that name the same revision, which is still current
- **WHEN** the orchestrator counts the gate
- **THEN** the gate MUST end approved

##### Scenario: Artifact changed between approvals

- **GIVEN** an `approved` report on revision A and a later artifact change to revision B
- **WHEN** the orchestrator counts the gate
- **THEN** the report on revision A MUST NOT count toward the gate

#### 2.81 FR-298: Changed paths listed on a re-review

**Statement:** On a re-review the dispatch MUST list the paths changed since the previous pass.
**Traces to:** UR-082
**Priority:** Should
**Origin:** Extends the gate prompt of `specs/spec-orchestration-review-gates.md` Requirement 2, which carries the rework count and prior findings and no list of changed paths. The list lets the reviewer check each fix (FR-299).

##### Scenario: Paths listed

- **GIVEN** a fix pass that changed `src/a.js` and `src/b.js`
- **WHEN** the orchestrator dispatches the re-review
- **THEN** the dispatch MUST list `src/a.js` and `src/b.js`

##### Scenario: First review

- **GIVEN** a gate at rework count 0
- **WHEN** the orchestrator dispatches the review
- **THEN** the dispatch MUST hold no changed-path list

#### 2.82 FR-299: Fix-induced findings marked

**Statement:** On a re-review the reviewer MUST mark a finding as `fix-induced`, with the identifier of the prior finding, when a change made since the previous pass causes it.
**Traces to:** UR-082
**Priority:** Should
**Origin:** Extends the fix-phase scope rules (`specs/spec-orchestration-review-gates.md` Requirement 7), which keep a fix to the listed findings but do not test a fix for side effects. Gap: each narrow fix can open the next finding.

##### Scenario: Fix causes a new defect

- **GIVEN** a fix for F-2 that makes a previously correct path reject valid input
- **WHEN** the reviewer re-reviews
- **THEN** the new finding MUST read `fix-induced` with the identifier F-2

##### Scenario: Unrelated new defect

- **GIVEN** a new defect in code that no change since the previous pass touched
- **WHEN** the reviewer re-reviews
- **THEN** the finding MUST read new and MUST NOT read `fix-induced`

#### 2.83 FR-300: Design pass after repeated fix-induced findings

**Statement:** WHEN two consecutive re-reviews of one gate each return a fix-induced finding, the orchestrator SHOULD run one code-reviewer pass over the whole artifact before it dispatches another fix pass.
**Traces to:** UR-082
**Priority:** Should
**Origin:** Parallels the escalation to `code-reviewer` after two scope violations (`specs/spec-orchestration-review-gates.md` Requirement 7). The count of two is an estimate (OQ-17).

##### Scenario: Two fix-induced passes

- **GIVEN** the re-reviews at pass 2 and pass 3 of one gate each return a fix-induced finding
- **WHEN** the orchestrator plans the next step
- **THEN** the orchestrator SHOULD dispatch one code-reviewer pass over the whole artifact

##### Scenario: One fix-induced pass

- **GIVEN** only the re-review at pass 2 returns a fix-induced finding
- **WHEN** the orchestrator plans the next step
- **THEN** the orchestrator SHOULD dispatch the normal fix pass

#### 2.84 FR-301: Early stop on a finding that stays open

**Statement:** WHEN two consecutive re-reviews of one gate report the same finding as open and the reviewer cites no new evidence, the orchestrator SHOULD stop that loop and offer the choices continue, waive, or abort.
**Traces to:** UR-082
**Priority:** Should
**Origin:** Extends FR-218, which escalates only at iteration 10. The count of two is an estimate (OQ-17). The choices are those of FR-218.

##### Scenario: Finding open after two fixes

- **GIVEN** finding F-4 reported open by two consecutive re-reviews, with no new evidence in the second re-review
- **WHEN** the orchestrator plans the next step
- **THEN** the orchestrator SHOULD stop the loop and offer continue, waive, or abort

##### Scenario: New evidence cited

- **GIVEN** finding F-4 reported open by two consecutive re-reviews and the second re-review cites new evidence
- **WHEN** the orchestrator plans the next step
- **THEN** the orchestrator SHOULD continue the loop

#### 2.85 FR-302: Round history at escalation

**Statement:** At an escalation under FR-218 or FR-301, the orchestrator MUST show, for each round, the number of new, fixed, open, and withdrawn findings.
**Traces to:** UR-082
**Priority:** Should
**Origin:** Extends FR-218, which shows the unresolved findings at the cap and no per-round history.

##### Scenario: History shown

- **GIVEN** an escalation after 4 rounds
- **WHEN** the orchestrator presents the choices
- **THEN** the presentation MUST list 4 rows with counts of new, fixed, open, and withdrawn findings

##### Scenario: Statuses missing

- **GIVEN** a round whose report held no statuses
- **WHEN** the orchestrator builds the history
- **THEN** the orchestrator MUST mark that round as having no status data

#### 2.86 FR-303: No approval over unexamined paths

**Statement:** A reviewer MUST NOT return verdict `approved` when it did not examine every artifact path that the dispatch names.
**Traces to:** UR-083
**Priority:** Should
**Origin:** Extends the `Decide` state of `reviewer.md` and `code-reviewer.md` (`none-left` leads to `approved`). Gap: a review that read only part of the artifact and found nothing reads as clean. The unexamined paths go in the `skipped:` field.

##### Scenario: All paths examined

- **GIVEN** a dispatch that names 3 paths and a reviewer that read all 3
- **WHEN** the reviewer finds no defect
- **THEN** the verdict MAY read `approved`

##### Scenario: One path not examined

- **GIVEN** a dispatch that names 3 paths and a reviewer that read 2
- **WHEN** the reviewer finds no defect in those 2
- **THEN** the verdict MUST NOT read `approved`
- **AND** the `skipped:` field MUST name the unexamined path

#### 2.87 FR-304: Review posted only against the current head

**Statement:** The PR-review workflow MUST NOT post a review that was drafted against a head revision other than the PR's current head revision, which the workflow reads immediately before it posts.
**Traces to:** UR-085
**Priority:** Should
**Origin:** Extends FR-195 and FR-214 (confirmation per PR and verdict) in `FR-NFR-assist-plugin.md`. Gap: a verdict confirmed for a PR can post after new commits arrive. This requirement adds to FR-214 and does not replace it.

##### Scenario: Head unchanged

- **GIVEN** a review drafted against head revision H and a PR whose head is still H
- **WHEN** the workflow reaches the post step
- **THEN** the workflow MAY post, subject to the FR-214 confirmation

##### Scenario: Head moved

- **GIVEN** a review drafted against head revision H and a PR whose head is now H2
- **WHEN** the workflow reaches the post step
- **THEN** the workflow MUST NOT post
- **AND** the workflow MUST tell the user the draft is stale

#### 2.88 FR-305: Read back after an unknown posting outcome

**Statement:** WHEN a posting command ends with an unknown outcome, the PR-review workflow MUST read back the PR's reviews before any retry.
**Traces to:** UR-085
**Priority:** Should
**Origin:** Extends FR-214 and FR-195. Gap: a server error during a post may or may not have created the review, and a blind retry can post twice.

##### Scenario: Review exists after the error

- **GIVEN** a posting command that ended with a server error and a PR that now holds the review
- **WHEN** the workflow handles the error
- **THEN** the workflow MUST NOT post again

##### Scenario: Review absent after the error

- **GIVEN** a posting command that ended with a server error and a PR that holds no such review
- **WHEN** the workflow handles the error
- **THEN** the workflow MAY retry, subject to the FR-214 confirmation

#### 2.89 FR-306: Severity taken from the catalog

**Statement:** A finding whose rule identifier is in the severity catalog MUST take its severity from that catalog entry. The severity catalog is a table, held with the severity policy, that maps each rule identifier to a fixed severity; every checklist item and every in-plugin scanner rule has an entry (D-14).
**Traces to:** UR-086
**Priority:** Should
**Origin:** Extends FR-237 and FR-240, where the reviewer sets `severity` from the policy text. Gap: the same defect class can carry different severities in different reviews. Adding a catalog changes the severity policy and needs the re-approval that FR-237 requires.

##### Scenario: Catalog severity applied

- **GIVEN** catalog entry DD-01 with severity MEDIUM and a finding with rule identifier DD-01 that the reviewer wrote as HIGH
- **WHEN** the orchestrator reads the report
- **THEN** the recorded severity MUST read MEDIUM
- **AND** the report MUST note the difference

##### Scenario: Rule identifier absent from the catalog

- **GIVEN** a finding whose rule identifier is not in the catalog
- **WHEN** the orchestrator reads the report
- **THEN** the finding MUST be handled under FR-307

#### 2.90 FR-307: Unmapped findings routed no higher than inline-comment

**Statement:** A finding with no rule identifier in the severity catalog and no CWE identifier MUST be marked `unmapped` and MUST route no higher than `inline-comment`.
**Traces to:** UR-086
**Priority:** Should
**Origin:** Extends FR-239 (only high-confidence, HIGH or CRITICAL findings route as blocking) with a further clamp for a finding that no fixed rule backs.

##### Scenario: Unmapped high finding

- **GIVEN** a finding with severity HIGH, confidence High, and no catalog rule or CWE identifier
- **WHEN** routing runs
- **THEN** the finding MUST read `unmapped`
- **AND** the routing MUST NOT read `block-merge`

##### Scenario: Mapped high finding

- **GIVEN** a finding with a catalog rule identifier, severity HIGH, and confidence High
- **WHEN** routing runs
- **THEN** the routing MUST follow FR-239

#### 2.91 FR-308: Critic scores never decide

**Statement:** A score from a critic or filtering model MUST NOT set a finding's severity and MUST NOT remove a finding from the report.
**Traces to:** UR-086
**Priority:** Should
**Origin:** Extends the reviewer rule that a model-emitted claim never raises confidence (`reviewer.md`, Finding Format) and the LLM09 control that a gate not rest on a model-emitted string (`plugins/assist-plugin/rules/llm-security-checklist.md:286-317`).

##### Scenario: Critic marks a finding as likely false

- **GIVEN** a critic score that rates finding F-1 as likely false
- **WHEN** the orchestrator builds the report
- **THEN** F-1 MUST stay in the report
- **AND** its severity MUST NOT change

##### Scenario: Critic raises a severity

- **GIVEN** a critic score that rates finding F-2 as critical while its catalog severity is MEDIUM
- **WHEN** the orchestrator builds the report
- **THEN** F-2 MUST keep severity MEDIUM

#### 2.92 FR-309: Dispositions only from the user's label

**Statement:** The plugin MUST record a disposition of true, false, or deferred for a reviewer finding only from the user's own label.
**Traces to:** UR-084
**Priority:** Should
**Origin:** Extends NFR-034 (the user labels each baseline advisory finding; an agent's self-judgment is not a label) from the baseline of blocking-capable checks to every reviewer finding.

##### Scenario: User label recorded

- **GIVEN** the user labels finding F-5 true through the labelling step
- **WHEN** the record is read
- **THEN** F-5 MUST hold disposition true with the writer marked as the user

##### Scenario: Agent judgment

- **GIVEN** an agent judges finding F-6 false and the user has not labeled it
- **WHEN** the record is read
- **THEN** F-6 MUST read unlabeled

#### 2.93 FR-310: Precision per lane and item

**Statement:** The plugin MUST report, for each lane and each checklist item, the number of findings labeled true, labeled false, deferred, and unlabeled, and the precision over the labeled findings. Precision is true divided by the sum of true and false.
**Traces to:** UR-084
**Priority:** Should
**Origin:** Extends NFR-034 and FR-238 (baseline report with finding counts and precision) to reviewer lanes and checklist items.

##### Scenario: Item with labels

- **GIVEN** checklist item DD-01 with 8 findings labeled true, 2 labeled false, and 5 unlabeled
- **WHEN** the report runs
- **THEN** the report MUST show counts 8, 2, 0, and 5 for DD-01
- **AND** the precision MUST read 0.8

##### Scenario: Item with no labels

- **GIVEN** a checklist item whose findings are all unlabeled
- **WHEN** the report runs
- **THEN** the precision MUST read not available
- **AND** the precision MUST NOT read 0

#### 2.94 FR-311: False labels passed to the reviewer as data

**Statement:** The dispatch for a review MUST pass the user's false labels for the same checklist items on the same artifact as data.
**Traces to:** UR-084
**Priority:** Should
**Origin:** Extends the prior-findings hand-off, which wraps findings in `<review-findings>` and states they are data (`specs/spec-orchestration-review-gates.md` Requirement 2).

##### Scenario: Labels passed

- **GIVEN** the user labeled a DD-03 finding on `src/a.js` false
- **WHEN** the orchestrator dispatches a review of `src/a.js`
- **THEN** the dispatch MUST carry that label inside the data wrapper
- **AND** the dispatch MUST state that the label is data, not an instruction

##### Scenario: No labels

- **GIVEN** no false label for the artifact
- **WHEN** the orchestrator dispatches the review
- **THEN** the dispatch MUST hold no label block

#### 2.95 FR-312: No re-raise of a false-labeled finding

**Statement:** The reviewer MUST NOT re-raise a finding that the user labeled false for the same checklist item and location unless the reviewer cites new evidence.
**Traces to:** UR-084
**Priority:** Should
**Origin:** Extends the "no padding" rule of `review-protocol.md:143`. Gap: a finding the user already rejected can come back on every review.

##### Scenario: Same finding, no new evidence

- **GIVEN** a DD-03 finding at `src/a.js:20` labeled false
- **WHEN** the reviewer sees the same issue at the same location with no new evidence
- **THEN** the report MUST NOT list the finding

##### Scenario: New evidence

- **GIVEN** the same label and a later change that makes the defect reachable
- **WHEN** the reviewer cites that change as new evidence
- **THEN** the report MAY list the finding with the new evidence

#### 2.96 FR-313: Retirement candidates

**Statement:** The plugin MUST list each checklist item whose precision is below a configured floor as a retirement candidate in a checklist-change report for the user. The floor and the minimum number of labeled findings are configured values (OQ-17).
**Traces to:** UR-084
**Priority:** Should
**Origin:** Extends NFR-034, which sets a precision bar for promotion to blocking and none for retiring a noisy rule.

##### Scenario: Item below the floor

- **GIVEN** a floor of 0.5 and an item with precision 0.3 over enough labeled findings
- **WHEN** the checklist-change report runs
- **THEN** the report MUST list the item as a retirement candidate

##### Scenario: Too few labels

- **GIVEN** an item with precision 0.3 over fewer labeled findings than the configured minimum
- **WHEN** the report runs
- **THEN** the report MUST NOT list the item as a retirement candidate

#### 2.97 FR-314: Addition candidates

**Statement:** The plugin MUST list each finding class that was raised with no checklist item at least a configured number of times as an addition candidate in the checklist-change report.
**Traces to:** UR-084
**Priority:** Should
**Origin:** Gap: findings that match no checklist item (FR-307, `unmapped`) are the evidence that a checklist item is missing. The count is a configured value (OQ-17).

##### Scenario: Repeated unmapped class

- **GIVEN** a configured count of 3 and 3 unmapped findings of one class
- **WHEN** the checklist-change report runs
- **THEN** the report MUST list the class as an addition candidate

##### Scenario: Below the count

- **GIVEN** a configured count of 3 and 2 unmapped findings of one class
- **WHEN** the report runs
- **THEN** the report MUST NOT list the class

#### 2.98 FR-315: Checklist changes only by user-approved edit

**Statement:** A reviewer checklist MUST change only through an edit that the user approves and that has a `DECISIONS.md` entry.
**Traces to:** UR-084
**Priority:** Must
**Origin:** Extends NFR-036 and FR-237. A checklist change alters the review surface, which is the LLM surface (`rules/` and `agents/`), so it needs `✓ LLM Security Clear` (NFR-036) and a recorded user decision, and no agent applies a change from the checklist-change report on its own.

##### Scenario: Approved edit

- **GIVEN** the user approved retiring item TI-06 and `DECISIONS.md` holds the entry
- **WHEN** the merge policy review runs
- **THEN** the checklist edit MUST be accepted

##### Scenario: Edit without approval

- **GIVEN** a diff that retires item TI-06 and no `DECISIONS.md` entry
- **WHEN** the merge policy review runs
- **THEN** the review MUST report the checklist edit as unapproved

#### 2.99 FR-316: Before and after measurement of reviewer changes

**Statement:** Before a change to a lane checklist, the severity catalog, or a screening rule ships, the plugin SHOULD report finding precision and recall on a seeded-defect sample, before and after the change.
**Traces to:** UR-084
**Priority:** Should
**Origin:** Extends FR-238 (advisory baseline before blocking). A screening or checklist change can lower false positives and recall together, so both are measured. A seeded-defect sample can be built as review tasks of the Group A benchmark harness (FR-254 to FR-287); that reuse is optional.

##### Scenario: Measured change

- **GIVEN** a seeded sample of 20 defects and a proposed checklist change
- **WHEN** the plugin reports the change
- **THEN** the report SHOULD hold precision and recall before and after

##### Scenario: No sample

- **GIVEN** no seeded-defect sample
- **WHEN** the plugin reports the change
- **THEN** the report SHOULD state that no measurement exists

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
| NFR-028 | A control marked security-critical (FR-214, FR-217, FR-219 in blocking mode only, FR-220, FR-223, FR-231, FR-233, FR-246) MUST deny its own guarded operation class when it cannot evaluate because of an error or timeout, or when `.agent/governance/profile.json` is malformed while a profile is enforced; the denial MUST last until the file is fixed. When `profile.json` is absent the controls MUST run in log-only mode and MUST NOT hard-deny, because nothing is tagged to match. | BR-018, BR-020 | Settled exception to the Hook Fail-Open Rule, `rules/assist-plugin-rule.md:404-416`, by `DECISIONS.md`, 2026-10-28, "Compliance profile flags, enforced by default" (D-1 settled); FR-246's membership in the set by `DECISIONS.md`, 2026-10-30, "FERPA disclosure control denies on missing attribution and is fail-closed"; FR-219's membership in blocking mode only (advisory mode still fails open per NFR-026) by `DECISIONS.md`, 2026-11-13, "FR-219 (goal-guard) joins the NFR-028 fail-closed set in blocking mode" |
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
| NFR-033 | A compliance control that rests on a vendor blog or an unverified citation MUST be labeled directional, and a control MUST NOT be marked complete before verification against the regulation text. Status: the HIPAA audit control (FR-232) is verified against 45 CFR 164.312(b), which requires mechanisms that record and examine activity, and the control implements that one required technical safeguard, not full HIPAA compliance. The FERPA internal access log (FR-230) carries no 34 CFR 99.32 citation and is general governance support, labeled directional. The FERPA disclosure-recordation control (FR-246) is the only control cited against 34 CFR 99.32; it stays "to verify" until its exception handling is reviewed. The exact log rotation size of NFR-032 is an estimate until measured against the NFR-030 verification-time target. The severity-policy basis (FR-237) is settled and the user approved the concrete policy text, `severity-policy.md` version `draft-2` (`DECISIONS.md`, "2026-10-31: Severity policy approved"; first approved at `draft-1`, "2026-10-30: Severity policy approved"); a rule may block on severity only after the FR-238 advisory baseline. The figures "under 50% mitigation" and "18% governance councils" MUST NOT serve as a threshold. | BR-020, BR-021 | 45 CFR 164.312(b) (FR-232, verified); 34 CFR 99.32 (FR-246 only, to verify) |
| NFR-034 | A rule MUST NOT move from advisory to blocking unless its baseline precision is at least 90% (estimate, BRD A-6). The user labels each baseline advisory finding true or false, and the baseline report computes precision from those user-set labels, not from an agent's self-judgment. | BR-022 | Alert-fatigue control; helpmetest and GitLab blogs (directional) |

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

- **GIVEN** a baseline precision of 70%, computed from the user's true or false labels on the baseline findings
- **WHEN** the rule is switched to blocking
- **THEN** the switch MUST be refused with the precision value

##### Scenario: Agent self-judgment does not set precision (NFR-034)

- **GIVEN** a baseline finding has no user label and an agent judges it true
- **WHEN** the baseline report computes precision
- **THEN** the report MUST NOT count the agent's judgment as a label
- **AND** the report MUST show the finding as unlabelled

#### 3.6 Group A: Evaluation benchmark harness (DRAFT)

| ID | Requirement | Traces to | Metric |
|----|-------------|-----------|--------|
| NFR-037 | Scoring the same spec output with the deterministic checklist MUST give an identical structural score on every repetition. | FR-265 | 100% identical over 10 repeated scorings of one output |
| NFR-038 | Each benchmark run result MUST record its total model cost in USD and its elapsed time. | BR-023 | Recorded in 100% of run results. Context (estimates, not a guaranteed budget): the single source run recorded in the research report, 8 cases, took about 165 seconds and about $4.85 (Report:6); a full run of 10 coding and 10 spec cases at 5 runs each is estimated at $25 to $75 (Report:114), not measured on this repository |
| NFR-039 | The scoreboard and the benchmark logs MUST hold scores, identifiers, and versions only, and MUST NOT hold reference solutions, hidden-suite text, or agent output text. | BR-023, FR-261 | Content test over the scoreboard and the logs: 0 reference or output strings |

##### Scenario: Repeated scoring (NFR-037)

- **GIVEN** one spec output and the deterministic checklist
- **WHEN** the harness scores it 10 times
- **THEN** all 10 structural scores MUST be equal

##### Scenario: Cost recorded (NFR-038)

- **GIVEN** a completed benchmark run
- **WHEN** the run result is read
- **THEN** the result MUST hold a total cost and an elapsed time

##### Scenario: Scoreboard content (NFR-039)

- **GIVEN** a scoreboard row for a release
- **WHEN** the row is read
- **THEN** it MUST hold the version, suite, and scores only
- **AND** it MUST NOT hold hidden-suite text

#### 3.7 Group B: Reviewer and review machinery (DRAFT)

| ID | Requirement | Traces to | Metric or standard |
|----|-------------|-----------|--------------------|
| NFR-040 | A capability of Group B MUST NOT add a write or shell tool to `reviewer` or `code-reviewer`, whose tools MUST stay `Read, Grep, Glob, LSP`. | BR-024 | NFR-027; OWASP LLM06; `tools:` frontmatter of both agents |
| NFR-041 | The gate outcome MUST record the number of reviewer dispatches used, so the extra cost of concurrent lane review is measurable. | BR-024, FR-292 | Recorded for 100% of gates. Concurrent lanes cost about three times one pass (estimate, to confirm by measurement) |
| NFR-042 | The disposition and finding records MUST hold identifiers, locations, rule identifiers, severity, confidence, and the user's label only, and MUST NOT hold file contents, secret values, or matched text. | BR-024, FR-309 | Data minimization; NFR-031 |

##### Scenario: Reviewer tools unchanged (NFR-040)

- **GIVEN** the `reviewer` and `code-reviewer` agent files after a Group B change
- **WHEN** the `tools:` frontmatter is read
- **THEN** each MUST list only `Read, Grep, Glob, LSP`

##### Scenario: Dispatch count recorded (NFR-041)

- **GIVEN** a gate that ran three lane reviews
- **WHEN** the gate outcome is read
- **THEN** it MUST state 3 reviewer dispatches

##### Scenario: Record content (NFR-042)

- **GIVEN** a finding whose text quotes a secret value from the reviewed file
- **WHEN** the finding record is written
- **THEN** the record MUST hold the path, line, and rule identifier
- **AND** the record MUST NOT hold the secret value

### 4. Scope

#### In scope (system behaviors)

- All behaviors FR-214 to FR-249 and NFR-026 to NFR-036.
- Group A (DRAFT): FR-254 to FR-287 and NFR-037 to NFR-039, the evaluation benchmark harness.
- Group B (DRAFT): FR-288 to FR-316 and NFR-040 to NFR-042, the reviewer and review-machinery capabilities.

#### Out of scope (system exclusions)

| Excluded item | Reason | Deferred to |
|---------------|--------|-------------|
| Gaps 5, 7, 8, 9 (`llm-security-checklist.md:329`, `:331-333`) | Not in the roadmap | Future roadmap |
| Cryptographic signing of the audit log with an external key | The roadmap asks for a hash chain only | Future roadmap |
| Content-level PHI detection beyond configured patterns and tagged paths | Paraphrase detection has no accepted method here | Future roadmap |
| Session-level taint tracking that denies a payload holding content earlier read from a PHI-tagged path or student-record path (FR-233, FR-246) | A per-call hook has no session state; no tracking mechanism is named | Future roadmap |
| Bash write coverage through symlinks and variable-built commands | Existing known limit of the write bar | Future roadmap |
| Strict JSON parsing for every other plain `JSON.parse` reader | Only three readers carry governance trust in this release (FR-249); the rest are a follow-up | Follow-up release |
| Comparing in-house scores with public leaderboard numbers (Group A) | A score moves with the scaffold and averaging method, so only in-house runs on the same harness version compare (Report:30) | Never |
| Grading a coding case by a single run (Group A) | The agent is non-deterministic; pass@1 needs k runs (FR-271) | Never |
| A merge gate that blocks on the judge score (Group A) | The judge is a noisy, advisory signal (FR-279) | Future roadmap, after judge-human agreement is measured (FR-286) |
| A judge from a model family different from the agent under test (Group A) | The user settled a same-family judge now with bias mitigations (FR-282); a second family is a future enhancement, not a current requirement (OQ-16) | Future roadmap |
| Reporting line coverage of new code and traceability-marker resolution as benchmark metrics (Group A) | Both appear in the report as metrics (Report:68) but no user requirement names them | Follow-up release |
| Recording the random seed of a randomized hidden-suite run for replay (Group A) | Useful for flake triage (Report:73, `:106`) but not needed to score | Follow-up release |
| Ingesting scanner output as structured findings for the reviewer (Group B) | The reviewers hold no shell; the orchestrator would need a new scanner-to-finding step | Future roadmap |
| Suppressing a repeated finding by similarity match to past false labels (Group B) | FR-311 and FR-312 cover exact checklist item and location; a similarity match needs a measured threshold | Future roadmap |
| Impact-graph or prior-pattern context for the reviewer (Group B) | Needs an index the plugin does not hold | Future roadmap |
| A reviewer or critic model that approves a gate, blocks a merge, or sets severity by its own score (Group B) | Excluded by FR-308 and FR-221 | Never |
| Automatic application of a checklist change (Group B) | Excluded by FR-315 | Never |

### 5. Constraints

- Hooks go through an ES5 entry file with a `timeout` in `hooks.json` and record failures in `hook-health.jsonl` (`rules/assist-plugin-rule.md:411-412`).
- Deny only through `permissionDecision: "deny"` with exit 0 (`rules/assist-plugin-rule.md:409`).
- Write guard values live in `hooks/lib/fsa-paths.js` and must match `rules/assist-plugin-rule.md:420-434`; run `node plugins/assist-plugin/scripts/check-fsa-tables.js --check` after an edit.
- Keep counts and lists in sync when an agent or skill is added (repo `CLAUDE.md`, "Keeping counts in sync").
- Group A reuses the `claude plugin eval` runner, the `evals/` case layout, and the `tests/` suite, and adds no second runner (FR-263). It adds one section to `release-check.js`, whose existing sections stay independent (FR-250 in `FR-NFR-assist-plugin.md`).
- Group A coding cases need a sandbox backend for their Write, Edit, and Bash grant (`plugins/assist-plugin/evals/README.md:40`); on a machine without one the case reads not-run (FR-264).
- Group B edits `agents/`, `rules/`, and `skills/` files, which form the LLM surface, so each change needs `✓ LLM Security Clear` before merge (NFR-036). Reviewers keep `Read, Grep, Glob, LSP` (NFR-040).
- Group B adds no write path for a subagent: the orchestrator writes every finding, status, label, and gate record (FR-222).

#### Dependencies that need a user decision in DECISIONS.md

| ID | Decision needed | Affects |
|----|-----------------|---------|
| D-1 | Settled (`DECISIONS.md`, 2026-10-28, "Compliance profile flags, enforced by default"): fail-closed on a malformed configuration while a profile is enforced; log-only when the configuration is absent. Exception to the Hook Fail-Open Rule (`rules/assist-plugin-rule.md:404-416`) | NFR-028, FR-214, FR-217, FR-220, FR-223, FR-231, FR-233, FR-246 |
| D-2 | Settled (`DECISIONS.md`, 2026-10-28, "FERPA/HIPAA purpose capture, missing-purpose handling, and governance path protection"): the confirmation store, `.agent/logs/governance/**`, the session purpose record, and the rule-mode store are added to the Write guard lists (`rules/assist-plugin-rule.md:420-434`) and protected from every subagent write; any later narrowing of an entry needs the same record first | FR-245, FR-223, FR-224 |
| D-3 | Settled and refined (`DECISIONS.md`, 2026-10-30, "Gap-3 push grant and gap-6 revision-loop cap settled", then "Push grant scoped per named remote, not origin-only (D-3 refined)"): replace `Bash(git push *)` with one grant per named remote (today `Bash(git push origin *)`; a mirror adds `Bash(git push <mirror-name> *)`) in `.claude/settings.local.json` or `.claude/settings.json`; the health check flags only a wildcard or unscoped grant; the user applies it because the plugin never edits settings, and gap 3 closes once the settings hold named-remote grants and no wildcard | FR-216 |
| D-4 | Settled (`DECISIONS.md`, 2026-10-30, "Severity-policy basis and SARIF writer settled", then "2026-10-30: Severity policy approved" at `draft-1`, re-approved by "2026-10-31: Severity policy approved"): the basis is settled and the user approved `severity-policy.md` version `draft-2` (the `draft-1` approval is superseded); a blocking rule still needs the FR-238 advisory baseline first | FR-237 |
| D-5 | Settled (`DECISIONS.md`, 2026-10-30, "Audit-logging stores settled (per-access split, rotation and retention, confirmation-store writer)"): identity and authorizer fields in `fsa-log.jsonl` rows, and `audit.jsonl` as the per-access store holding operation and data-accessed (path and class tag) | FR-226, FR-227, NFR-031 |
| D-6 | Settled (same 2026-10-30 entry): size-based rotation replaces the 500-line cap on `fsa-log.jsonl`, with the prior segment's final chain hash carried into each new segment and at least 12 months of retention | NFR-032, FR-228 |
| D-7 | Settled (`DECISIONS.md`, 2026-10-30, "Gap-3 push grant and gap-6 revision-loop cap settled"): cap of 10 with two consecutive LGTMs as the normal pass; escalation at the cap | FR-218 |
| D-8 | Settled (`DECISIONS.md`, 2026-10-30, "Judgement-gate evidence and the /do human authorizer settled"): in-plugin scanner exit code plus a distinct reviewer verdict (OQ-1) | FR-221 |
| D-9 | Settled (`DECISIONS.md`, 2026-10-30, "Severity-policy basis and SARIF writer settled"): the `/do` orchestrator writes the SARIF file; no subagent write path is added | FR-241 |
| D-10 | Settled (`DECISIONS.md`, 2026-10-30, "Audit-logging stores settled (per-access split, rotation and retention, confirmation-store writer)"): a `UserPromptSubmit` hook writes the confirmation store as JSONL under `.agent/`. Its protection from subagent writes is settled under D-2 and FR-245. The confirmation is bound to its pending action by a per-action token (`DECISIONS.md`, 2026-10-30, "Build-time open items resolved (PN-1, PN-7, Step 18, Step 34, Step 3 binding)"). The store is a directory of two files (`DECISIONS.md`, 2026-10-30, "PN-10 pending-action store split and token lifetime settled"): `confirmations.jsonl` is hook-only and denied to every tool caller, `pending.jsonl` is written by the main-session `/do` orchestrator and denied to every subagent; the token is single-use and time-expiring, with the window an estimate until measured | FR-214, FR-242, FR-245 |
| D-11 | Settled (`DECISIONS.md`, 2026-10-28, "FERPA/HIPAA purpose capture, missing-purpose handling, and governance path protection"): a hook writes the session purpose record from a user-declared purpose; a missing purpose is logged `unstated` and flagged, never denied on that alone (OQ-6 settled) | FR-230, FR-247 |
| D-12 | Settled (`DECISIONS.md`, 2026-10-28, "Compliance profile flags, enforced by default"): add `.claude/settings.json` and `.agent/governance/profile.json` to the protected paths that every subagent is denied (Write guard lists, `rules/assist-plugin-rule.md:420-434`) | FR-245, FR-231, FR-243 |
| D-13 | Settled (`DECISIONS.md`, 2026-10-30, "Build-time open items resolved (PN-1, PN-7, Step 18, Step 34, Step 3 binding)", PN-1): the FR-219 alignment check stays rule-based and advisory-first (FR-238), not a model-calling hook, because it reads attacker-controlled text | FR-219 |

| D-14 | Open (Group B): approve the severity catalog, a table that maps each rule identifier (every checklist item and in-plugin scanner rule) to a fixed severity and sits with `rules/severity-policy.md`. FR-237 requires the user to approve the severity policy before a rule blocks on severity, so a catalog added to it needs the same approval (OQ-19) | FR-306, FR-307 |
| D-15 | Applied (Group A): the benchmark section is added to the section list of FR-250 in `FR-NFR-assist-plugin.md` as its statement (benchmark section): the section reports the last stored scoreboard and does not auto-run the suite. Whether a default run should also run the suite stays OQ-13 | FR-273, FR-274 |
| D-16 | Open (Group A): decide where reference solutions and hidden suites live, because the marketplace repository is published and the report's layout (Report:78-91) puts `reference/` under the shipped plugin tree (OQ-15) | FR-260, FR-261, NFR-039 |
| D-17 | Open (Group B): settle which agent applies each lane in each gate, in particular who applies the test-integrity lane in the Testing Gate, which `qa` reviews today (OQ-18) | FR-291 |

Each later profile disablement (FR-244) needs its own `DECISIONS.md` entry when it happens; it is not a standing dependency.

### 6. Traceability matrix

| BR | UR | FR | NFR | Status |
|----|----|----|-----|--------|
| BR-018 | UR-059 | FR-214, FR-242 | NFR-026, NFR-027, NFR-028, NFR-029, NFR-035, NFR-036 | Approved |
| BR-018 | UR-060 | FR-215, FR-216, FR-217 | NFR-028, NFR-031 | Approved |
| BR-018 | UR-061 | FR-218 | NFR-036 | Approved |
| BR-018 | UR-062 | FR-219, FR-220 | NFR-027, NFR-028, NFR-035 | Approved |
| BR-019 | UR-063 | FR-221 | NFR-026 | Approved |
| BR-019 | UR-064 | FR-222, FR-223 | NFR-028, NFR-036 | Approved |
| BR-019, BR-020 | UR-065 | FR-224, FR-225 | NFR-030, NFR-032 | Approved |
| BR-020 | UR-066 | FR-226, FR-227 | NFR-026, NFR-031 | Approved |
| BR-020 | UR-067 | FR-228, FR-229 | NFR-032 | Approved |
| BR-020 | UR-068 | FR-230, FR-231, FR-247 | NFR-028, NFR-033 | Approved |
| BR-020 | UR-069 | FR-231, FR-232, FR-233, FR-234, FR-247 | NFR-028, NFR-033, NFR-035 | Approved |
| BR-020 | UR-075 | FR-243, FR-244, FR-245 | NFR-026, NFR-028, NFR-036 | Approved |
| BR-020 | UR-076 | FR-246 | NFR-026, NFR-028, NFR-031, NFR-033, NFR-035 | Approved |
| BR-021 | UR-070 | FR-235, FR-236 | NFR-033 | Approved |
| BR-022 | UR-071 | FR-237, FR-238 | NFR-034 | Approved |
| BR-022 | UR-072 | FR-239 | NFR-034 | Approved |
| BR-022 | UR-073 | FR-240 | | Approved |
| BR-022 | UR-074 | FR-241 | | Approved |
| BR-018, BR-019, BR-020, BR-022 | UR-059, UR-068, UR-069, UR-071, UR-075 | FR-248, FR-249 | NFR-016 (spec), NFR-028 | PLANNED |
| BR-023 | UR-077 | FR-254, FR-255, FR-256 | NFR-039 | DRAFT (Group A) |
| BR-023 | UR-078 | FR-262, FR-263, FR-264, FR-265, FR-266, FR-267, FR-268, FR-269, FR-270, FR-271, FR-272 | NFR-037, NFR-038 | DRAFT (Group A) |
| BR-023 | UR-079 | FR-273, FR-274, FR-275, FR-276, FR-277, FR-278, FR-279 | NFR-038 | DRAFT (Group A) |
| BR-023 | UR-080 | FR-257, FR-258, FR-259, FR-260, FR-261, FR-280, FR-281, FR-282, FR-283, FR-284, FR-285, FR-286, FR-287 | NFR-039 | DRAFT (Group A) |
| BR-024 | UR-081 | FR-288, FR-289, FR-290, FR-291, FR-292, FR-293 | NFR-040, NFR-041 | DRAFT (Group B) |
| BR-024 | UR-082 | FR-294, FR-295, FR-298, FR-299, FR-300, FR-301, FR-302 | NFR-040 | DRAFT (Group B) |
| BR-019, BR-024 | UR-083 | FR-296, FR-297, FR-303 | NFR-040 | DRAFT (Group B) |
| BR-022, BR-024 | UR-084 | FR-309, FR-310, FR-311, FR-312, FR-313, FR-314, FR-315, FR-316 | NFR-034, NFR-036, NFR-042 | DRAFT (Group B) |
| BR-018, BR-024 | UR-085 | FR-304, FR-305 | NFR-040 | DRAFT (Group B) |
| BR-022, BR-024 | UR-086 | FR-306, FR-307, FR-308 | NFR-040 | DRAFT (Group B) |

No orphans. No BR is a dead end. NFR-029 to NFR-036 trace to BR or FR as their origin requires; NFR-037 to NFR-042 trace to BR-023, BR-024, or the FR named in their row.

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
| Report | `docs/research/research-eval-benchmarks-coding-spec-20261124.md`, the source of Group A; "Report:N" cites line N |
| Benchmark harness | The golden tasks, graders, and release-check section that measure the coding and spec-writing agents (Group A). Distinct from the plugin's hook harness |
| Golden task | A task with a reference and a way to grade it: for coding, a prompt, a reference solution, and a hidden test suite; for specs, a prompt, a reference, and a rubric (FR-254, FR-255) |
| Hidden test suite | The reference tests that decide pass or fail for a coding task; the agent under test never sees them (FR-260) |
| pass@1 | The probability that one run of a coding case passes, estimated as c divided by k over k completed runs (FR-271) |
| Structural score | The fraction of a spec case's deterministic checklist items that pass (FR-265); a floor, not a measure of quality |
| Judge score | The mean score an LLM-as-judge gives the subjective rubric items of a spec case (FR-268, FR-285); advisory |
| Cleared (structural checklist) | Every deterministic item of the case passes (FR-269, assumption A-13) |
| Suite score | The mean pass@1 of a coding suite, or the mean structural score of a spec suite (FR-273) |
| Held-out case | A golden task that runs only in the release benchmark section (FR-280) |
| Scoreboard | The version-controlled table of per-release suite scores (FR-276) |
| Review lane | A review focus with its own checklist: defect-depth, test-integrity, or architecture-safety (FR-288) |
| Rule identifier | The identifier of a severity-catalog entry; every checklist item is one (FR-290, FR-306) |
| Severity catalog | A table that maps each rule identifier to a fixed severity and is held with the severity policy (FR-306, D-14) |
| Fix-induced finding | A finding that a change made since the previous pass causes (FR-299) |
| Disposition | The user's label of a reviewer finding as true, false, or deferred (FR-309) |
| Unmapped finding | A finding with no catalog rule identifier and no CWE identifier (FR-307) |

### 8. Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-28 | [Author] | Initial draft |
| 1.1 | 2026-10-28 | [Author] | Align with `DECISIONS.md` 2026-10-28: FR-231 names the two-file configuration; FR-230, FR-232, FR-233, FR-234 read as enforced-by-default with opt-out; NFR-028 records the settled fail-closed and log-only behavior (D-1 settled); FR-243 to FR-245 added for the governed opt-out; D-12 added |
| 1.2 | 2026-10-30 | [Author] | Align with `DECISIONS.md` 2026-10-28 entries on purpose capture and OQ-9: FR-247 added (purpose-capture hook; OQ-11, D-11 settled); FR-230 reframed as an internal log that denies nothing on a missing purpose (OQ-6 settled) and carries no 99.32 citation; FR-246 added (FERPA disclosure recordation, the only 99.32 control); FR-232 verified against 45 CFR 164.312(b) with tightened scope; FR-245 extended to six protected paths (D-2 settled); NFR-033 status updated; UR-076 traced. Also aligns with `DECISIONS.md` 2026-10-30, "FERPA disclosure control denies on missing attribution and is fail-closed": FR-246 gains the deny-on-missing-attribution clause; FR-246 added to the NFR-028 security-critical set. Also aligns with `DECISIONS.md` 2026-10-30, "FR-246 disclosure attribution comes from the payload, validated against a profile.json allowlist" (PN-9 settled; note at 1.2, no version bump): FR-246 states that the receiving party and legitimate interest are payload-declared and parsed by the guard, validated against a `profile.json` allowlist, and denied when missing or off the allowlist; FR-245 states that the six paths are unchanged and `profile.json` is the allowlist's trust anchor |
| 1.3 | 2026-10-30 | [Author] | Align with `DECISIONS.md` 2026-10-30, "Audit-logging stores settled (per-access split, rotation and retention, confirmation-store writer)": NFR-032 states size-based rotation with the prior segment's final chain hash carried across the cut and at least 12 months of retention (D-6, OQ-3 resolved); FR-242 names a `UserPromptSubmit` hook writing JSONL under a path protected by FR-245 (D-10, OQ-10 resolved); FR-227 two-file split ratified (D-5, OQ-4 resolved). "Gap-3 push grant and gap-6 revision-loop cap settled": FR-218 cap raised from 3 to 10 with two consecutive LGTMs as the normal pass and a continue/waive/abort escalation at the cap (D-7, OQ-2 resolved); FR-216 records the settled origin-only grant (D-3). "Judgement-gate evidence and the /do human authorizer settled": FR-221 takes the scanner exit code from the plugin's own scripts, with an external scanner optional (D-8, OQ-1 resolved); FR-227 names the plan approver as the authorizer, `none` with a reason otherwise (OQ-7 resolved). "Severity-policy basis and SARIF writer settled": FR-241 names the `/do` orchestrator as the SARIF writer (D-9, OQ-8 resolved); FR-237 and NFR-033 record the settled severity basis, with formal policy approval still pending (D-4 partial, FR-238 unchanged). Rotation size stays an estimate. No trace changes. Version bumped to 1.3 in lockstep with the BRD, URD, and JSON because the URD open-questions list and BRD A-4 changed |
| 1.3 (note) | 2026-10-30 | [Author] | Align with `DECISIONS.md` 2026-10-30, "Build-time open items resolved (PN-1, PN-7, Step 18, Step 34, Step 3 binding)": FR-219 states a rule-based, advisory-first check that does not call a model, with the corrected hook facts (default command-hook timeout 600 seconds, 30 on `UserPromptSubmit`; no documented offline sandbox; `prompt`, `agent`, and `http` hook types can call a model), labeled directional; D-13 added. FR-242 adds the per-action token binding; D-10 notes it. FR-221 and FR-241 already read consistently with the Step 18 and Step 34 decisions and are unchanged. "Push grant scoped per named remote, not origin-only (D-3 refined)": FR-216 recommends one grant per named remote and flags only a wildcard or unscoped grant; D-3 refined. Also closes the severity approval status per `DECISIONS.md`, "2026-10-30: Severity policy approved": D-4 settled, FR-237 Origin records the approval of `severity-policy.md` draft-1, and OQ-12 resolved in the JSON mirror and the URD; NFR-033 states the same approved status. No version bump: the BRD and URD are unchanged |
| 1.3 (note 2) | 2026-10-30 | [Author] | Align with `DECISIONS.md` 2026-10-30, "PN-10 pending-action store split and token lifetime settled": FR-242 states the confirmation store as a directory with `confirmations.jsonl` (hook-only, denied to every tool caller) and `pending.jsonl` (main-session `/do` writable, denied to every subagent), the guard reading `confirmations.jsonl` only, and a single-use, time-expiring token with the window an estimate until measured; an expired-or-reused-token scenario and a pending-record-is-not-a-confirmation scenario added. FR-245 notes the directory form, still one of the six paths (no seventh path); D-10 notes the split. No version bump: the BRD and URD are unchanged, since the decision was a build-time plan item the URD never tracked as an open question |
| 1.3 (note 3) | 2026-10-30 | [Author] | Align with `DECISIONS.md` 2026-10-30, "Baseline precision labeller settled (PN-3)": NFR-034 names the user as the labeller of each baseline advisory finding, with precision computed from those labels, and gains an unlabelled-finding scenario. "Secret-scan tool settled as the in-plugin pattern scanner (PN-4)": FR-217 names the in-plugin pattern-scanner script as the default scan tool, with an external scanner as a later substitute keeping the clean, findings, and cannot-run outcomes; the scanner-unavailable scenario reads to match. "Second pr-post-ask prompt kept after a recorded confirmation (PN-5)": FR-214 states the guard is additive, the `pr-post-ask` hook is unchanged, and two prompts may appear as defense in depth; a scenario added. "Proposed governance file names and store paths approved (PN-8)" is a task-plan naming decision with no requirements change: no FR-245 path added or renamed, the six-path count stands. No version bump: the BRD and URD are unchanged |
| 1.3 (note 4) | 2026-11-13 | [Author] | Tranche 5 documentation sync per `DECISIONS.md` 2026-11-05, "Harness-governance requirements and task plan approved for build" (the Status label flips from DRAFT to Approved in a later requirements sync) and 2026-11-13, "FR-219 (goal-guard) joins the NFR-028 fail-closed set in blocking mode": the Status label reads Approved, the section 6 traceability rows read Approved, and the NFR-028 enumeration adds FR-219 for blocking mode only (advisory mode still fails open per NFR-026). No version bump: no requirement statement other than the NFR-028 membership changed |
| 1.3 (note 5) | 2026-11-20 | [Author] | Strict JSON parser for governance-config readers, settled by the user, no new elicitation. FR-248 (strict parser: duplicate key at any depth, depth over 32, position-only error per NFR-016) and FR-249 (wired into the rule-modes, profile, and confirmation-store readers only; rejection uses the existing malformed-file path; health check reports it) added. Other plain `JSON.parse` readers recorded as a follow-up in section 4. No UR row names these requirements; they trace to the nearest rows. No version bump |
| 1.4 | 2026-11-24 | [Author] | Two DRAFT requirement groups added in place, existing entries unchanged. Group A (Theme 5): evaluation benchmark harness, FR-254 to FR-287 and NFR-037 to NFR-039, from `docs/research/research-eval-benchmarks-coding-spec-20261124.md` (golden tasks, execution grading, structural score and optional separate judge score, pass@1 over k runs, release-over-release regression through the release-check runner, and controls for contamination, overfitting, judge bias, and flakiness). Group B (Theme 6): reviewer and review-machinery capabilities, FR-288 to FR-316 and NFR-040 to NFR-042 (lane checklists, a round-by-round iteration record, a feedback loop from user labels to checklist changes, and review patterns that extend FR-218, FR-221, FR-222, and FR-237 to FR-241). IDs start at FR-254 and NFR-037 because FR-250 to FR-253 are taken in `FR-NFR-assist-plugin.md`. D-14 to D-17 and OQ-13 to OQ-19 added. Version bumped to 1.4 in lockstep with the BRD, URD, and JSON |
| 1.4 (note) | 2026-11-25 | [Author] | Cleanup and reconciliation, no renumbering. FR-308 reworded as MUST NOT; FR-300 and FR-301 use the same re-review count language; NFR-038 figures labeled as estimates; two checklist line anchors corrected (FR-292, FR-308) and the same anchor in BRD A-15; BRD and URD status headers aligned with this file. FR-282 now requires a same-family judge with three bias mitigations and records a different-family judge as a future enhancement (section 4; OQ-16 settled). FR-273 and D-15 record the FR-250 benchmark-section delta, now stated in `FR-NFR-assist-plugin.md`. No version bump |
