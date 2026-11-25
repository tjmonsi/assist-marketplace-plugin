# Task Plan: Evaluation benchmark harness (Group A)

**Target Language:** JavaScript (Node, CommonJS, no dependencies, ES2015 syntax as in `plugins/assist-plugin/scripts/release-check.js`)  
**Target Framework:** none (Node built-in test runner: `node --test`; the existing runner `claude plugin eval` is reused, not wrapped in a new one)  
**Generated:** 2026-11-25 07:17:00

---

## Specification Summary

- **Spec ID:** `specs/spec-evaluation-harness.md` (Architecture, Status `Draft`; its diagrams are `specs/spec-evaluation-harness-flow.mmd` and `specs/spec-evaluation-harness-topology.mmd`). The spec carries no `SPEC-NNN` ID, so `Satisfies` lines cite the spec's nine `### Requirement:` blocks by the short names below.
- **Linked Requirements:** FR-254 to FR-287, NFR-037, NFR-038, NFR-039 (`docs/requirements/FR-NFR-harness-governance.md`, Group A, DRAFT); the FR-250 benchmark-scoreboard statement (`docs/requirements/FR-NFR-assist-plugin.md:5346`); UR-077 to UR-080, BR-023, SC-023 to SC-025; decisions D-15, D-16; open question OQ-14 (estimates to confirm); OQ-13 settled (D-15); OQ-17 provisional values (the FR-286 judge-agreement floor, `FR-NFR-harness-governance.md` section 5 "Provisional values"); OQ-15 and OQ-16 as recorded in ASM-1 and ASM-4; assumptions A-12 to A-14
- **Use Cases:** none defined in the spec

Spec requirement short names used in `Satisfies` lines:

| Short name | Spec Requirement block | Scenarios |
|---|---|---|
| R1 | Golden-task contents and case validation | 7 |
| R2 | Contamination controls on golden tasks | 4 |
| R3 | Reference-solution admission | 2 |
| R4 | Private oracle resolution and withholding | 5 |
| R5 | Coding run scoring by execution and pass@1 | 6 |
| R6 | Flaky hidden-suite tests reported, not silenced | 2 |
| R7 | Spec structural scoring | 7 |
| R8 | Spec judge grading, separation, and bias mitigations | 15 |
| R9 | Benchmark section and release-over-release comparison | 20 |

The harness measures the `developer`, `requirements-gatherer`, and `solutions-architect` agents on in-house golden tasks release over release: code is graded by a hidden suite's exit code, specs by a deterministic checklist plus an optional same-family judge kept as a separate score, and the benchmark runs on request only. Git mechanics (branch, commit, tag) and the release bump belong to the orchestrator and are not plan steps.

### Intake validation

`### Requirement:` blocks: 9. `#### Scenario:` blocks: 68 (77 matching lines minus 9 requirement lines, from a count over the spec). Every requirement holds at least one scenario, so the gate passes. Status is `Draft`, not `Approved`; this plan follows the approved direction named in the request and does not change the spec or requirement status.

Requirements without a testable acceptance criterion in the spec's Requirement blocks: none. Four acceptance criteria are found only in the requirements document or are stated as a design review, and this plan cites them as such and invents none:

| Item | Where the criterion lives | Gap |
|---|---|---|
| FR-282 (same-family judge bias mitigations) | Requirements doc scenarios `FR-NFR-harness-governance.md:1573-1590` (mitigations present; mitigation missing fails validation; no labeled sample states no figure exists) | The spec's traceability row reads "Design review" and its Requirement blocks hold no scenario for recording the judge and agent family or for a missing-randomization validation failure |
| NFR-038 (cost and elapsed time recorded) | Requirements doc scenario `FR-NFR-harness-governance.md:2423`; the spec row says "Test: a completed run result holds total cost and elapsed time" | No `#### Scenario:` in the spec |
| NFR-039 (scoreboard holds scores only) | Requirements doc scenario `FR-NFR-harness-governance.md:2429`; spec scenario "Per-case scores stored for a release" covers the per-case half | No spec scenario for the aggregate row |
| FR-263 first scenario (case listed by `claude plugin eval`) | Requirements doc `FR-NFR-harness-governance.md:1203` | No spec scenario; the spec row names a runner listing that this plan cannot verify without the runner (ASM-7) |

---

## Assumptions and blocked items

ASM-2 records a settled decision, and ASM-3 records one provisional value (the judge-agreement floor) beside the estimates that stay open. Every other item is recorded as open. None is resolved by this plan.

| ID | Item | Effect on the plan |
|---|---|---|
| ASM-1 | **Private oracle precondition.** Reference solutions and hidden test suites live in a separate private repository or a configured private path (settled: OQ-15, D-16). They are never committed to this public repo. The concrete location and its access control are user configuration values (spec "Out-of-scope dependencies") | Steps 2, 3, 5, and 12 read the oracle at run time and carry this precondition. No step creates oracle content. Tests build synthetic stand-in oracles in temp directories only. Blocked step B1 covers authoring the first tasks |
| ASM-2 | **Benchmark runs on request only (settled: OQ-13, D-15).** A default release-check run reports the last stored scoreboard and never runs the suite; an on-request run goes through the Group A harness and adds no second runner (FR-250 benchmark statement, FR-273, FR-274, D-15; `specs/spec-evaluation-harness.md` Design decisions, "When the benchmark runs (OQ-13)") | Step 13 wires a default run that reads the stored scoreboard and starts no suite; only an explicit request starts the harness. No step treats the default-run behavior as open |
| ASM-3 | **Configured numeric values.** Two groups. (a) **Estimates to confirm (OQ-14, A-14):** the run count k (FR-271), the regression margin (FR-277), the reference validation run count (FR-259), the judge run count (FR-285), and the new golden tasks per release (FR-281) have no settled value. The spec's "recommended defaults" (5, 0.05, 3, 3, and 1 per suite) are estimates to confirm by measurement, not settled figures, and OQ-17 does not set them. (b) **Provisional value (OQ-17):** the FR-286 judge-agreement floor is Spearman rho at least 0.7, or Cohen kappa at least 0.6, labeled "provisional, no empirical basis yet" and still overridable (`FR-NFR-harness-governance.md` section 5 "Provisional values"; `specs/spec-evaluation-harness.md` Requirement 8). The other OQ-17 provisional values (the escalation counts of FR-300 and FR-301, the precision floor and minimum labeled findings of FR-313, and the later Group B counts) belong to Group B and no Group A step uses one | Step 1 stores each OQ-14 value as a required configuration field with no default in code; the loader errors naming a missing field. The values written into `harness.config.json` for those fields are a user decision (B4). Step 1 stores the judge-agreement floor as a configured value that ships with the provisional setting (rho 0.7, kappa 0.6) and a provisional label; the user may override it, and Step 8 repeats the label wherever it reports the floor. No step hard-codes a number outside that configured, labeled floor, and no step picks an escalation count |
| ASM-4 | **Same-family judge now.** The judge runs in the agent's model family with the three FR-282 bias mitigations; a different-family judge is a future enhancement, not part of this version (settled; OQ-16) | Step 8 builds no cross-family path. It records the judge family and the agent family in the result |
| ASM-5 | **Names and locations this plan chooses, not fixed by the spec:** the `plugins/assist-plugin/scripts/eval-harness/` module folder, `task.json` (per-task metadata), `rubric.json` (spec-task rubric), `plugins/assist-plugin/evals/harness.config.json`, `plugins/assist-plugin/evals/scoreboard.json` (the version-controlled scoreboard), the `--benchmark` release-check flag for the "benchmark request", and a harness-version constant for FR-272 (the spec does not say whether it equals the plugin version) | The user confirms or renames these before the developer starts; every step cites them as proposals |
| ASM-6 | **Hidden-suite format.** The spec names Node `--test` programmatic `run()` or the `run-test` language command as the technology and requires the `[AC-n \| spec \| FR-n]` test-name form. How a non-Node hidden suite exposes test names is not defined | Step 3 and Step 5 support Node `--test` suites; other languages are out of scope until the user decides |
| ASM-7 | **Runner behavior not verified in this repository.** (a) How the harness detects a missing sandbox backend: `evals/README.md:40` says the runner refuses the shell grant, but no refusal signal is documented. (b) The config schema of the runner's LLM-judge grader type: `evals/README.md:35` says no current case uses one. (c) How an ordinary `claude plugin eval` run excludes a held-out case: the README documents only `--eval-dir` and `--case`. (d) How to list cases without a paid run | B3 confirms each against the runner's documentation before Steps 5, 8, and 12 are finalized. Until then those steps keep the behavior behind a small adapter function and state the assumption in code comments |
| ASM-8 | **Reference "error path" identification.** FR-267 requires that each requirement identifier, scenario, and error path of the reference appear in the output. The spec does not define how a deterministic check recognizes an error path in a reference | Step 7 reads a declared list of reference items (identifiers, scenarios, error paths) from the task rubric metadata and checks presence; it does no free-text inference. The user confirms the approach |
| ASM-9 | **FR-282 versus FR-284 wording.** FR-282 and its scenario say "randomize the candidate order"; FR-284 and the spec say run both orders and average. These are different mechanisms | Step 8 implements FR-284 (both orders, mean) and records the order handling in the result so the FR-282 validation can check it. The user confirms that both orders satisfies FR-282's randomization wording |
| ASM-10 | **Published package list.** The spec validates "the list of files in a published plugin package" but names no source for the list. A default release-check run must stay informational and report no finding for this section (`specs/spec-release-check.md` change log 2026-11-25, Requirement 9) | Step 4 is a pure function over a file list and a CLI that takes a list on stdin or a path. Only an on-request benchmark run calls it. Making it a default-run finding needs a change to `spec-release-check.md` and is not planned here |

Blocked steps, listed after the implementation steps: B1 (author the first golden tasks), B2 (human-labeled judge sample), B3 (runner behavior check), B4 (configuration values).

---

## Acceptance Criteria

Condensed from the spec's 68 scenarios, one row per cluster. The spec lines and the requirements-document scenarios are the full source. Figures in scenarios are examples, not defaults (A-14).

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| R1 complete coding task accepted; missing hidden suite rejected | A coding task with prompt, reference, and hidden suite; or with no hidden suite | The harness loads it | Accept; or reject and name the missing hidden test suite |
| R1 rubric groups separated or mixed | A spec task rubric with separate structural and subjective groups; or one mixed list | The harness loads it | Accept; or reject |
| R1 hidden test carries its identifier | A hidden test named `[AC-2 \| spec-foo \| FR-045] rejects an empty name`; or a name with no identifier | The harness loads the suite | Accept the test; or reject the task and name the test |
| R1 task without `graders/` | A task directory with `prompt.md` and no `graders/` | The harness loads it | Reject |
| R2 provenance, cutoff, and public dataset | Metadata with provenance, creation date, valid-against cutoff; or no cutoff; or provenance naming a public benchmark dataset | The harness loads it | Accept; or reject; or reject |
| R3 reference admission | Configured count 3; reference passes 3 consecutive runs; or fails run 2 | The harness validates the task | Admit; or do not admit and name the failing run |
| R4 workspace holds no oracle; leak aborts | A prepared workspace; or one holding an oracle file | The harness prepares and checks it | No oracle file; or abort the run and name the leaked path |
| R4 package holds no oracle path | A published package list; or one holding a reference or hidden-suite path | The harness validates the list | Search finds none; or validation fails and names the path |
| R4 private location unreachable (spec elaboration of FR-260 and FR-261) | The configured private location is absent or unreadable | The harness resolves the oracle | Report an error, score nothing, name the location, never read as a score |
| R5 suite exit code | A coding run whose hidden suite exits 0; or non-zero | The harness scores it | Pass with no model call; or fail |
| R5 sandbox absent | A coding case needing a shell grant and no sandbox backend | The harness runs the case | Not-run; counts in neither c nor k |
| R5 pass@1 | 5 runs with 3 passes; or every run not-run; or a result with no harness version | The harness reports or validates | 0.6 with k = 5, c = 3, and the harness version; or absent, never 0; or validation fails |
| R6 flaky test | A hidden test passing on run 1 and failing on run 2 for one candidate; or a config retrying until pass | The harness reports or loads | Listed flaky and still counted; or the config is rejected |
| R7 structural score | A spec run passing 8 of 10 deterministic items; or 10 repeated scorings of one output | The harness scores it | 0.8; or all 10 scores equal (NFR-037) |
| R7 checklist sources and reference coverage | An item defined by a review-mode check or quality criterion; or by none; an output missing the error path of FR-3 | The harness validates and runs the checklist | Accept the item; or reject it; the item fails and the result names FR-3 |
| R7 checklist cannot run | A spec run whose reference file is unreadable | The harness scores it | Run reads error; structural score is not 0 |
| R8 judge off, on, cleared, uncleared | No judge configured; or a judge configured; the case cleared or not | The harness scores the case | Structural only and judge absent; or both scores; judge runs only on a cleared case |
| R8 two separate scores | Structural 0.9 and judge 0.6; or a combined field | The result is written or validated | Two values; or validation fails and names the field |
| R8 per-item, both orders, mean over runs | A 3-item rubric; a comparison against the reference; judge runs 0.6, 0.7, 0.8 with count 3 | The judge scores | 3 item scores; both orders run and averaged; judge score 0.7 with 3 runs stated. A single overall score, a one-order result, or a missing run count fails validation |
| R8 labeled sample and judge unavailable | A 20-output labeled sample; or none; or the judge model unavailable | The harness reports the judge | Spearman rho or Cohen kappa, shown beside the configured judge-agreement floor labeled provisional; or states no agreement figure exists; or judge absent with structural score kept |
| R9 benchmark request | A release check with no benchmark request; or with one | The runner runs its sections | Section does not run the suites and other sections behave as before; or it runs them |
| R9 comparison | Stored previous scores and a request; or none | The section runs | Current and previous per suite; or no baseline and no regression finding |
| R9 version key and scoreboard | A result recording plugin version 1.14.7; or none; a completed run with or without a scoreboard row | The harness stores the result | Keyed to 1.14.7; or refused; a row per suite; or a finding naming the version |
| R9 regression margin | Margin 0.05, previous 0.80, current 0.70; or current 0.78 | The section compares | Regression finding; or none |
| R9 judge decline advisory | Judge down 0.2 with structural within the margin; or structural down beyond it | The section compares | Advisory note and no finding; or a regression finding for the structural score |
| R9 shared cases and per-case records | Per-case records for c1 and c2; a case added or removed between releases | The scoreboard is written and compared | Per-case records hold scores only; added and removed cases enter neither score |
| R9 held-out and new cases | A held-out case in an ordinary run; or in a benchmark request; a suite with or without a new case | The runner lists cases or the section runs | Excluded; or included; a new case found; or an advisory note naming the suite |
| R9 empty suite | A suite with no admitted case, or whose every run read not-run | The section computes the suite score | Absent; no regression finding from an absent score |
| FR-282 mitigations (requirements doc) | A same-family judge; a result recording no candidate-order randomization; no labeled sample | The judge runs, the result is validated, the agreement check runs | Mitigations applied and judge and agent family named; validation fails; the report states no agreement figure exists |
| NFR-038, NFR-039 (requirements doc) | A completed benchmark run; a scoreboard row | The result or row is read | Total cost and elapsed time present; version, suite, and scores only, no hidden-suite text |
| FR-250 benchmark statement and `spec-release-check` Requirement 9 (OQ-13 settled) | A stored scoreboard and a default run; no scoreboard and a default run; a requested suite run | The benchmark scoreboard section runs | Reports stored values and starts no suite; reports none is stored and starts no suite; starts the Group A harness and no second runner |

---

## Implementation Steps

Paths start at the repository root. New harness modules go under `plugins/assist-plugin/scripts/eval-harness/` (ASM-5). Tests go under the repository-root `tests/scripts/`. Every module is dependency-free CommonJS with `"use strict"`, returns fixed reasons and never raw stderr (the pattern `release-check.js` follows), and carries traceability markers per `traceability-comment-format.md`. Code references below are relative to `plugins/assist-plugin/skills/code/references/`.

### Step 1: Harness configuration loader and oracle-location pointer

- **Files:** `plugins/assist-plugin/scripts/eval-harness/config.js` (create), `plugins/assist-plugin/evals/harness.config.json` (create)
- **Satisfies:** [R6 -> FR-287 -> Scenario "Retry-until-pass configuration rejected"], [R3 -> FR-259], [R5 -> FR-271], [R8 -> FR-285], [R8 -> FR-286 (provisional judge-agreement floor)], [R9 -> FR-277], [R4 -> FR-260 -> FR-261 -> NFR-039 (pointer only)]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** `harness.config.json` holds the oracle-location pointer, the configured numbers, the judge setting, the judge-agreement floor, and the labeled-sample path (B2). The pointer is a location, never a secret and never oracle content; commit the file with the pointer and the OQ-14 numbers (k, regression margin, reference validation run count, judge run count, and any new-tasks-per-release count) unset (ASM-3a, B4). The judge-agreement floor is the exception: it ships with the provisional setting from `FR-NFR-harness-governance.md` section 5 (Spearman rho at least 0.7, or Cohen kappa at least 0.6) and a label field reading provisional, so it is a configured, overridable value and not an unset decision (ASM-3b); the key names are a plan choice. `config.js` loads and validates the file: it errors naming a missing or non-numeric OQ-14 field and never substitutes a default number for one; it returns the floor together with its provisional label and applies a user override when the file holds one; it rejects a floor with no label. It rejects any configuration that retries a failing hidden test until it passes (a retry or rerun-on-failure setting greater than zero); the setting's key name is a plan choice. Precondition ASM-1: the pointer resolves to the private location, which this plan does not create.

### Step 2: Oracle resolver, admission, workspace preparation, and leak check

- **Files:** `plugins/assist-plugin/scripts/eval-harness/oracle.js` (create)
- **Satisfies:** [R4 -> FR-260 -> Scenarios "Agent workspace holds no oracle", "Leak detected before the run", "Private oracle location unreachable"], [R3 -> FR-259 -> Scenarios "Stable reference admitted", "Reference fails once"], [R4 -> FR-261 -> NFR-039]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `logging-standards.md`, `traceability-comment-format.md`
- **Notes:** Precondition ASM-1: this step reads reference solutions and hidden suites from the private location named by `config.js` at run time. It writes no oracle content into the repository and no oracle path into any published artifact. Four functions. (a) Resolve: read the configured location; when absent or unreadable return an error naming the location and score nothing (the spec adds this case; neither FR-260 nor FR-261 states it). (b) Admission: run the reference against the hidden suite N consecutive times, N from config (ASM-3), and return the failing run number when any run fails. (c) Prepare the agent workspace holding only public task material, with the reference and hidden suite withheld. (d) Leak check: before the run, compare the workspace file list and file hashes with the oracle files and abort naming the leaked path. The hidden suite is copied into a separate grading directory only after the agent run ends (Step 5). Never log oracle file contents; log paths and identifiers only.

### Step 3: Golden-task validator

- **Files:** `plugins/assist-plugin/scripts/eval-harness/task-validator.js` (create)
- **Satisfies:** [R1 -> FR-254 -> UR-077], [R1 -> FR-255 -> UR-077], [R1 -> FR-256 -> UR-077], [R1 -> FR-263 -> Scenario "Task without a graders folder"], [R2 -> FR-257 -> UR-080 -> SC-025], [R2 -> FR-258 -> UR-080 -> SC-025]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** Precondition ASM-1 for the oracle-side checks (reference and hidden suite present). Loads a public task directory under `evals/dev/<case>/` or `evals/spec/<case>/` and returns accept or reject with the missing or offending part named. Checks: `prompt.md` and a `graders/` folder exist; a coding task has a reference solution and a hidden suite (looked up through Step 2); a spec task has a reference requirements set or reference spec and a `rubric.json` whose deterministic items and subjective items sit in separate groups, with a mixed list rejected. Each hidden test name must match the `[AC-n | spec | FR-n]` form (`tests/hooks/gate-evidence.test.js:161` shows the form); reject the task and name the first offending test (ASM-6: Node `--test` suites). `task.json` holds provenance, creation date, valid-against cutoff, and a `held_out` flag (Step 12). Reject missing cutoff, and reject provenance naming a public benchmark dataset by allowing only the two values the spec names, `in-house` and `private-repository`. Do not choose a cutoff date.

### Step 4: Published-package oracle-path check

- **Files:** `plugins/assist-plugin/scripts/eval-harness/package-check.js` (create)
- **Satisfies:** [R4 -> FR-261 -> NFR-039 -> Scenarios "Published package holds no oracle material", "Oracle path in the published package"]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** A pure function over a list of file paths that fails and names each reference-solution or hidden-suite path found, plus a small CLI that reads the list from a path or stdin (ASM-10). The match rule keys on the directory names the harness uses for oracle material in the private layout; it contains no oracle content. The on-request run in Step 12 calls it. It is not a default release-check finding (ASM-10).

### Step 5: Coding grader with pass, fail, not-run, and error states

- **Files:** `plugins/assist-plugin/scripts/eval-harness/coding-score.js` (create)
- **Satisfies:** [R5 -> FR-262 -> UR-078 -> SC-023 -> Scenarios "Suite passes", "Suite fails"], [R5 -> FR-264 -> UR-078 -> Scenario "Sandbox backend absent"], [R4 -> FR-260 (suite runs outside the agent workspace)]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `logging-standards.md`, `traceability-comment-format.md`
- **Notes:** Precondition ASM-1: the hidden suite comes from the private location through Step 2. After the agent run ends, copy the suite into a grading directory outside the agent workspace and run it with Node `--test` (programmatic `run()`, or the `run-test` language command at `skills/run-test/SKILL.md:60-67`). Exit 0 reads pass, non-zero reads fail, and the scoring makes no model call. A run whose sandbox backend is unavailable reads not-run and is never pass or fail; the detection signal is behind an adapter function until B3 confirms it (ASM-7a). Unreadable oracle or a suite that cannot start reads error. Record per-test results so Step 6 can flag flakiness. Never skip or retry a test.

### Step 6: pass@1 aggregation and flaky-test reporting

- **Files:** `plugins/assist-plugin/scripts/eval-harness/aggregate.js` (create)
- **Satisfies:** [R5 -> FR-271 -> UR-078 -> SC-023 -> Scenarios "Three of five pass", "No completed run"], [R5 -> FR-272 -> Scenario "Result without a harness version"], [R6 -> FR-287 -> UR-080 -> Scenario "Flaky test flagged"]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** pass@1 is c divided by k, where k counts completed runs (pass or fail) and c counts passes; a not-run or error run counts in neither. When k is 0 the value is absent, not 0, and the division never runs. State k, c, and the harness version beside every pass@1 value; a value with no harness version fails validation (the version constant is a plan choice, ASM-5). Flag a hidden test whose result differs across repeated runs of the same candidate as flaky; the flagged test stays in the suite result and is never skipped or retried. The run count k comes from `config.js` (ASM-3).

### Step 7: Spec checklist and structural grader

- **Files:** `plugins/assist-plugin/scripts/eval-harness/spec-checklist.js` (create)
- **Satisfies:** [R7 -> FR-265 -> UR-078 -> SC-023 -> NFR-037 -> Scenarios "Partial score", "Repeated scoring is identical", "Checklist cannot run"], [R7 -> FR-266 -> UR-078 -> Scenarios "Checklist item has an existing source", "Checklist item has no existing source"], [R7 -> FR-267 -> UR-078 -> Scenarios "Reference coverage full", "Missing error path"]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** The structural score is the fraction of deterministic checklist items that pass, with no model call and no clock or random input, so ten scorings of one output are equal. Every checklist item declares a source: a `spec-from-requirements` review check (`skills/spec-from-requirements/SKILL.md:140-149`: Completeness, Correctness, Coherence, Style) or a `gather-requirements` quality criterion (`skills/gather-requirements/SKILL.md:99-101`). Reject an item with no known source. Use only the mechanically checkable parts of those checks (for example "every Requirement has a Scenario", "refs point at IDs that exist", "RFC 2119 keywords present"); the Style check and other judgment items are subjective and belong to the judge rubric, so the user confirms the split when the first rubric is written. Reference coverage checks each requirement identifier, scenario, and error path of the reference against the output, using a declared item list in the rubric metadata (ASM-8). A missing item fails and the result names it (for example FR-3). An unreadable reference reads error and the score is not 0.

### Step 8: Judge grader, separation, and bias mitigations

- **Files:** `plugins/assist-plugin/scripts/eval-harness/judge.js` (create)
- **Satisfies:** [R8 -> FR-268 -> UR-078], [R8 -> FR-269 -> UR-078], [R8 -> FR-270 -> UR-078], [R8 -> FR-282 -> UR-080 (see Intake gap)], [R8 -> FR-283 -> UR-080], [R8 -> FR-284 -> UR-080], [R8 -> FR-285 -> UR-080], [R8 -> FR-286 -> UR-080]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `logging-standards.md`, `traceability-comment-format.md`
- **Notes:** Same-family judge only; no cross-family path (ASM-4). The judge runs only on a case whose deterministic items all passed (A-13); an uncleared case, an unconfigured judge, or an unavailable judge model gives judge score absent while the structural score is still reported. Score each subjective rubric item separately against that item's own text; a result with one overall score and no item scores fails validation. For a comparison, run output-then-reference and reference-then-output and report the mean; a one-order result fails validation (ASM-9). Each judge score is the mean of J runs, J from `config.js` (ASM-3), with J stated; a judge score with no run count fails validation. The result holds the structural score and the judge score as two values; a field that combines them fails validation and names the field. The result records the judge family and the agent family, and records the order handling so a same-family result with no mitigation fails validation (FR-282). WHERE a labeled sample exists (path from config, B2), report Spearman rho or Cohen kappa beside the judge-agreement floor read from `config.js` (provisional: rho at least 0.7, or kappa at least 0.6; ASM-3b), and print the label "provisional, no empirical basis yet" with the floor; with no sample, state that no agreement figure exists. The floor is a configured, overridable provisional value (OQ-17), so this step hard-codes neither threshold; the judge stays advisory (FR-279), and this plan adds no gate or action keyed to the floor. The runner's judge-grader config schema is unverified (ASM-7b, B3); keep the model call behind an adapter.

### Step 9: Run result schema, validation, and version-keyed storage

- **Files:** `plugins/assist-plugin/scripts/eval-harness/results.js` (create)
- **Satisfies:** [R9 -> FR-275 -> UR-079 -> Scenarios "Result keyed to the plugin version", "Result without a plugin version refused"], [R9 -> NFR-038 (requirements doc scenario "Cost recorded")], [R5 -> FR-272 -> Scenario "Result without a harness version"], [R8 -> FR-270 -> Scenario "Combined field rejected"], [R8 -> FR-283, FR-284, FR-285, FR-282 (validation rules)]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** Build one run result per run into `plugins/assist-plugin/evals/results/` (git-ignored by `evals/.gitignore`). Read the plugin version, total cost in USD, and elapsed seconds from the runner's aggregate JSON (`evals/results/2026-11-19T17-48-14-215Z/aggregate-result.json` shows `suite.plugins[].version`, `costUsd`, and `durationSeconds`). Refuse to store a result with no plugin version. Record total cost and elapsed time in every result (NFR-038). One validator holds every "validation SHALL fail" rule from Steps 6 and 8 (no harness version, combined field, no item scores, one order only, no judge run count, same-family result with no mitigation) and names the offending field. Agent output text stays in the git-ignored run JSON and never reaches the scoreboard (Step 10).

### Step 10: Version-controlled scoreboard writer with content guard

- **Files:** `plugins/assist-plugin/scripts/eval-harness/scoreboard.js` (create); `plugins/assist-plugin/evals/scoreboard.json` is created by the first stored run and is not created by this plan (ASM-5)
- **Satisfies:** [R9 -> FR-276 -> UR-079 -> SC-024 -> Scenarios "Scoreboard row added for a release", "Scoreboard row missing"], [R9 -> FR-278 -> UR-079 -> Scenario "Per-case scores stored for a release"], [R9 -> NFR-039 -> FR-261]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** Write one aggregate row per release and suite (version, pass@1, structural score, judge score) and one per-case score record per release, suite, and case (version, suite, case id, pass/fail or numeric score, run count). The writer accepts an allowlist of fields and refuses any other key, and it rejects string values that do not match an identifier or version pattern, so no reference solution, hidden-suite text, or agent output text can enter the file (NFR-039). The FR-276 field list is a minimum, not a cap. Provide a reader the comparison and the release-check section use, and a check that reports a finding naming the version when a completed section left no row for that version.

### Step 11: Release-over-release comparison

- **Files:** `plugins/assist-plugin/scripts/eval-harness/compare.js` (create)
- **Satisfies:** [R9 -> FR-273 -> UR-079 -> Scenarios "Comparison reported", "No previous release"], [R9 -> FR-277 -> UR-079 -> Scenarios "Drop beyond the margin", "Drop within the margin"], [R9 -> FR-278 -> UR-079 -> Scenarios "Added case excluded from the comparison", "Removed case excluded from the comparison"], [R9 -> FR-279 -> UR-079 -> Scenarios "Judge decline alone is advisory", "Structural score drops too"], [R9 -> FR-281 -> UR-080 -> Scenarios "New task added", "No new task"], [R9 -> Scenario "Empty suite"]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** Compute each suite score (mean pass@1 for a coding suite, mean structural score for a spec suite) from the stored per-case records of the two releases, restricted to the case ids present in both, so an added or removed case enters neither score. Report the current and previous score per suite. With no previous release, report no baseline and no regression finding. A regression finding is a structural or pass@1 score below the previous release's by more than the configured margin (`config.js`, ASM-3, B4); do not hard-code a margin. A judge-score decline alone is an advisory note. A suite with no admitted case, or whose every run read not-run, has score absent and raises no regression finding from the absent score. A suite with no case new since the previous release gets an advisory note naming the suite (FR-281 is SHOULD).

### Step 12: Benchmark entry script and held-out case handling

- **Files:** `plugins/assist-plugin/scripts/eval-harness/run-benchmark.js` (create)
- **Satisfies:** [R9 -> FR-274 -> UR-079 -> Scenario "Requested run"], [R9 -> FR-280 -> UR-080 -> Scenarios "Held-out case excluded from an ordinary eval run", "Held-out case included in the release benchmark"], [R1 -> FR-263 -> UR-078 (reuse of the existing runner; no second runner)], [R9 -> NFR-038], [R4 -> FR-260, FR-261]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `logging-standards.md`, `traceability-comment-format.md`
- **Notes:** Precondition ASM-1 (private oracle location reachable) and ASM-2 (runs on request only, settled; this script never starts from a default release check). The script follows the spec's flow: load the public catalog, resolve the oracle, validate each task (Step 3), admit each coding task (Step 2), prepare and leak-check the workspace (Step 2), run each case k times through `claude plugin eval` (the existing runner, `evals/README.md:3`, `:21-28`), grade (Steps 5 to 8), write run results (Step 9), update the scoreboard (Step 10), then compare (Step 11). Call the package check (Step 4) before the run. When the oracle location is unreachable, report an error and score nothing. A task flagged `held_out` in `task.json` is excluded from the case list of an ordinary run and included when the benchmark section requests it; how the ordinary `claude plugin eval` listing excludes it is unverified (ASM-7c, B3), so keep the filter in the harness's own list function and do not edit the runner. A full run is estimated at $25 to $75 (BRD A-12; an estimate, not measured), so print the run count and case count before starting and make no network or model call outside the runner and the judge adapter.

### Step 13: Release-check benchmark scoreboard section

- **Files:** `plugins/assist-plugin/scripts/release/benchmark-scoreboard.js` (create), `plugins/assist-plugin/scripts/release-check.js` (modify: the header comment section list at lines 7 to 13, the `USAGE` string at line 47, `defaultSections()` at lines 113 to 123, `parseArgs()` at lines 174 to 200, and `run()` context at line 161)
- **Satisfies:** [FR-250 benchmark statement (`FR-NFR-assist-plugin.md:5346`) -> UR-044 -> UR-051], [spec-release-check Requirement 9 (Change Log 2026-11-25) -> FR-250 -> Scenarios "Default run reports the stored scoreboard", "No stored scoreboard", "Suite run requested"], [R9 -> FR-273 -> FR-274 -> D-15 -> Scenario "Plain release check does not run the suites"], [R9 -> FR-277 (exit 1 on a regression finding)]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** Append the section as the seventh section after `agent-hygiene`, named `benchmark-scoreboard` (order per Requirement 1 of the 2026-11-25 change log). Per the settled OQ-13 resolution (ASM-2, D-15): a default run reads the stored scoreboard, prints its latest rows as detail lines, returns `clean`, and starts no suite; with no stored scoreboard it prints that none is stored, returns `clean`, and starts no suite. The default run is informational and reports no finding, so the exit-code precedence of Requirement 3 stays unchanged and every other section behaves as before. A `--benchmark` flag (ASM-5) sets `context.benchmark`; on that request the section starts `run-benchmark.js` (Step 12), starts no second runner, and returns `finding` for a regression finding or a missing scoreboard row (exit 1). An unreachable oracle location or another operational failure returns `error` with a fixed reason, never raw stderr (mapping to `error` is a plan choice, so the user confirms it). Keep `release-check.js` ES2015 and dependency-free. The existing `run({ sections })` injection stays, so the existing tests keep working.

### Step 14: Document the benchmark in the evals README

- **Files:** `plugins/assist-plugin/evals/README.md` (modify; add a "Benchmark harness" section after "Grading" and extend the "Limits" list)
- **Satisfies:** [R4 -> FR-260 -> FR-261 -> NFR-039 (public/private split)], [R9 -> FR-274 -> D-15 (on request only)], [R9 -> FR-280 (held-out cases)]
- **Code references:** none (documentation edit)
- **Notes:** State in plain terms: the oracle lives in a separate private location and never in this repo; the benchmark runs on request only and a default `release-check.js` reports the last stored scoreboard and never runs the suite; the `--benchmark` request; held-out cases; the scoreboard path; the estimated $25 to $75 full-run cost labeled as an estimate. Write without em dashes, en dashes, or curly quotes (the prose gate blocks them). Do not add a count to `CLAUDE.md`: no agent or skill is added, so the counts stay at 16 agents and 22 skills.

### Step 15: Tests for configuration, oracle handling, task validation, and package check

- **Files:** `tests/scripts/eval-harness-config.test.js` (create), `tests/scripts/eval-harness-oracle.test.js` (create), `tests/scripts/eval-harness-task-validator.test.js` (create), `tests/scripts/eval-harness-package-check.test.js` (create)
- **Owner:** `developer-tester`. List test paths only; the `developer` does not write them.
- **Satisfies:** [R1 -> FR-254, FR-255, FR-256, FR-263], [R2 -> FR-257, FR-258 -> SC-025], [R3 -> FR-259], [R4 -> FR-260, FR-261 -> NFR-039], [R6 -> FR-287 -> Scenario "Retry-until-pass configuration rejected"], [R8 -> FR-286 (provisional floor loads from configuration)]
- **Code references:** `languages/javascript.md`, `traceability-comment-format.md`
- **Notes:** Black-box tests from the Acceptance Criteria table. Name each test `[AC-n | spec-evaluation-harness | FR-nnn] ...` as `tests/hooks/gate-evidence.test.js:161` does. Fixtures are synthetic stand-in tasks and a synthetic "private location" built in `os.tmpdir()` per test; no real oracle content, reference solution, or hidden suite is committed (ASM-1). Cover each accept and reject scenario in R1 to R4, the unreachable-location error that is not a score, the leak abort naming the path, and the retry config rejection. Cover the judge-agreement floor in the configuration loader: the shipped provisional setting loads with its provisional label, a user override replaces it, and a floor with no label is rejected. The configured numbers in fixtures are test examples (A-14), not defaults.

### Step 16: Tests for scoring, aggregation, the spec checklist, and the judge

- **Files:** `tests/scripts/eval-harness-coding-score.test.js` (create), `tests/scripts/eval-harness-aggregate.test.js` (create), `tests/scripts/eval-harness-spec-checklist.test.js` (create), `tests/scripts/eval-harness-judge.test.js` (create)
- **Owner:** `developer-tester`. List test paths only; the `developer` does not write them.
- **Satisfies:** [R5 -> FR-262, FR-264, FR-271, FR-272 -> SC-023], [R6 -> FR-287], [R7 -> FR-265, FR-266, FR-267 -> NFR-037], [R8 -> FR-268, FR-269, FR-270, FR-282, FR-283, FR-284, FR-285, FR-286]
- **Code references:** `languages/javascript.md`, `traceability-comment-format.md`
- **Notes:** Cover exit 0 and non-zero, not-run, 3 of 5 equals 0.6 with k, c, and version stated, all-not-run reads absent, flaky flagged and still counted, 8 of 10 reads 0.8, ten repeated scorings equal (NFR-037), an unreadable reference reads error and not 0, a source-less checklist item rejected, a missing error path naming FR-3, the judge gated on a cleared case, the judge absent when unavailable, two separate scores and a combined field rejected, per-item scores, both orders averaged, a mean of 0.6, 0.7, and 0.8 reading 0.7 with 3 runs stated, the FR-282 validation failure, and the agreement report showing the figure beside the configured floor with the provisional label (and a changed floor from configuration showing instead of the shipped one). The judge model call is stubbed behind the adapter; no test makes a model call. A test for the FR-282 criteria cites the requirements document scenarios (see Intake gap). A test for the sandbox-absent detection waits on B3.

### Step 17: Tests for results, scoreboard, comparison, the benchmark entry, and the release-check section

- **Files:** `tests/scripts/eval-harness-results.test.js` (create), `tests/scripts/eval-harness-scoreboard.test.js` (create), `tests/scripts/eval-harness-compare.test.js` (create), `tests/scripts/eval-harness-run-benchmark.test.js` (create), `tests/scripts/release-check-benchmark.test.js` (create); the existing `tests/scripts/release-check.test.js`, `tests/scripts/release-check-version.test.js`, and `tests/scripts/release-check-agent-hygiene.test.js` stay and must pass unchanged
- **Owner:** `developer-tester`. List test paths only; the `developer` does not write them.
- **Satisfies:** [R9 -> FR-273 to FR-281 -> UR-079 -> UR-080 -> SC-024], [NFR-038], [NFR-039], [FR-250 benchmark statement -> spec-release-check Requirement 9]
- **Code references:** `languages/javascript.md`, `traceability-comment-format.md`
- **Notes:** Cover version-keyed storage and the refusal with no version, cost and elapsed time present in every result (NFR-038), the NFR-039 content test (a scoreboard row holds version, suite, and scores only; a planted hidden-suite string or output string is refused), a row per suite for a release, a missing row naming the version, the margin cases (0.80 to 0.70 regresses; 0.80 to 0.78 does not, with a test margin of 0.05 as an example), judge decline advisory, structural drop a finding, added and removed cases excluded from both scores, an empty suite reading absent with no finding, a new case found, no new case an advisory note, held-out cases excluded from an ordinary list and included on a benchmark request, a default release check that starts no suite and reports the stored scoreboard or that none is stored (the settled OQ-13 behavior), a `--benchmark` request that starts the harness and no second runner, and exit code 1 on a regression finding. The suite-start check uses a stubbed harness entry; no test runs a real benchmark or spends model cost. Testing Gate: at least 70% coverage on the new code, run through `node --test tests/scripts/`. The real-run test of `release-check.js` in a clean tree must still exit 0 with the new section present.

---

## Blocked steps

These need a user decision or a resource this plan cannot create. No step above depends on one finishing before it is written, but each blocks the first real benchmark run.

### Step B1: Author the first golden tasks (BLOCKED)

- **Files:** none created by this plan. Public parts (`prompt.md`, `graders/`, `task.json`, `rubric.json`) go under `plugins/assist-plugin/evals/dev/<case>/` and `plugins/assist-plugin/evals/spec/<case>/`; reference solutions and hidden suites go only in the private location.
- **Satisfies:** [R1 -> FR-254, FR-255 -> UR-077], [R2 -> FR-257, FR-258 -> SC-025], [R9 -> FR-281 -> UR-080]
- **Blocked on:** ASM-1. The maintainer must configure the private oracle location (B4) and design each task; an agent cannot author a trustworthy hidden suite from the public repo, and a task derived from a public dataset is rejected by FR-258. The plan creates no oracle content.

### Step B2: Human-labeled sample for the judge-agreement check (BLOCKED)

- **Files:** none. The spec names no location for the sample, and a sample holds spec output text, which NFR-039 keeps out of the scoreboard.
- **Satisfies:** [R8 -> FR-286 -> UR-080], [R8 -> FR-282 (human-agreement check)]
- **Blocked on:** a human who labels spec outputs and a decision on where the sample lives. Until then Step 8 reports that no agreement figure exists, which FR-282 and FR-286 allow.

### Step B3: Confirm the four unverified runner behaviors (BLOCKED)

- **Files:** none. Read the `claude plugin eval` documentation and a small paid or sandboxed trial run.
- **Satisfies:** [R5 -> FR-264], [R8 -> FR-268], [R9 -> FR-280], [R1 -> FR-263]
- **Blocked on:** ASM-7. Confirm (a) the signal for a missing sandbox backend, (b) the LLM-judge grader config schema, (c) how an ordinary run excludes a held-out case, and (d) how to list cases without a paid run. A held-out exclusion that only the harness list function enforces does not make `claude plugin eval` itself skip the case.

### Step B4: Choose the configured numbers and the private location (BLOCKED)

- **Files:** `plugins/assist-plugin/evals/harness.config.json` (modify after the decision)
- **Satisfies:** [R3 -> FR-259], [R5 -> FR-271], [R8 -> FR-285], [R9 -> FR-277], [R4 -> FR-260 -> FR-261]
- **Blocked on:** the user. The run count k, the regression margin, the reference validation run count, and the judge run count remain recommended-default estimates (A-14, OQ-14); the spec's 5, 0.05, 3, and 3 are estimates to confirm by measurement, and OQ-17 does not set them. The oracle-location pointer value is also the user's. The FR-286 judge-agreement floor is not part of this block: it ships as a provisional configured value (ASM-3b) that the user may override at any time. The other OQ-17 provisional values belong to Group B and no Group A step uses them.

---

## Ordering Rationale

- **Step 1:** Configuration first, because every later step reads the configured values, the judge-agreement floor, and the oracle pointer.
- **Steps 2 to 4:** Oracle handling and task admission, because validation, grading, and the run all depend on the resolver. The package check stands alone.
- **Steps 5 to 8:** Graders and scoring: coding execution and pass@1 first, then the spec checklist, then the judge, which runs only after the checklist clears.
- **Steps 9 to 11:** Result storage, the scoreboard, and the comparison, which consume the scores.
- **Step 12 to 13:** The benchmark entry script, then the release-check section that starts it on request.
- **Step 14:** Documentation after the behavior exists.
- **Steps 15 to 17:** Tests, owned by `developer-tester`; test paths only (the developer never writes test paths).
- **Steps B1 to B4:** Blocked items, listed last; none is a coding step.

Each subsequent step can depend on previous steps' outputs.

---

## Notes for Developer

- Reference the `code` skill for language conventions before implementing each step.
- Load traceability comments per [references/traceability-comment-format.md](../../code/references/traceability-comment-format.md). The spec has no `SPEC-NNN`, so cite `[FR-nnn]` and `[NFR-nnn]` chains from the requirements document; do not invent a spec ID.
- Run code quality gates (linting, testing, security audit) at task completion. The OWASP for LLM gate in `CLAUDE.md` Governance covers `agents/`, `skills/`, `rules/`, `hooks/`, and the `CLAUDE.md`, `CLAUDE.local.md`, and `AGENTS.md` files. This plan edits none of them: `scripts/`, `evals/`, and `tests/` are not gated folders. The `evals/README.md` edit in Step 14 falls under the Report Quality Gate.
- Do not commit anything under `plugins/assist-plugin/evals/results/` (git-ignored), any reference solution, or any hidden suite. The published marketplace repo holds prompts, graders, metadata, rubrics, the oracle-location pointer, and the scoreboard of scores, identifiers, and versions only.
- The requirements documents and the spec stay Draft. Changing their Status, and folding the 2026-11-25 change log into `specs/spec-release-check.md`, are documentation decisions outside this task.
- After Step 13, run `node plugins/assist-plugin/scripts/release-check.js` (orchestrator): a default run must report the new section as `clean` with no suite started.
