# Task Plan: Reviewer Machinery (lanes, iteration record, guards, feedback loop)

**Target Language:** JavaScript (Node, CommonJS) for libraries and scripts; Markdown for rules, agents, and skill references
**Target Framework:** none (plugin harness; code follows `rules/assist-plugin-rule.md`, "Hook Fail-Open Rule")
**Generated:** 2026-11-25 07:17:00

---

## Specification Summary

- **Spec ID:** none. `specs/spec-reviewer-machinery.md` (Functionality, Draft) carries no SPEC-NNN id, so steps cite it by file name and Requirement number, as earlier plans in this repo do for specs without an id. Diagrams: `specs/spec-reviewer-machinery-flow.mmd` and `specs/spec-reviewer-feedback-loop.mmd`.
- **Linked Requirements:** FR-288 to FR-316, NFR-040 to NFR-042 (Group B of `docs/requirements/FR-NFR-harness-governance.md`, sections 2.71 to 2.99 and section 3), under BR-018, BR-019, BR-022, BR-024, UR-081 to UR-086, SC-026 to SC-028.
- **Parent spec:** `specs/spec-orchestration-review-gates.md` (Requirements 2, 4, 6, 7, and the Change Log 2026-11-06 Requirement 14). This plan adds no gate, no cap, and no reviewer tool.
- **Use Cases:** none defined in the spec.

The feature gives `reviewer` and `code-reviewer` three named checklists, keeps a finding-level iteration record across review rounds, ties approvals to the reviewed revision and the PR post to the current head, and turns the user's own finding labels into checklist-change reports the user approves. Reviewers stay read-only; the `/do` orchestrator writes every record.

**Status gate.** Every behavior in the spec is Planned (harness-governance Group B, DRAFT). Nothing here ships before the user approves Group B (`spec-reviewer-machinery.md` line 16). Writing the code and text is allowed now; merging it waits on that approval.

### Validation (Intake)

- The spec holds 25 `### Requirement N:` blocks and 58 `#### Scenario:` blocks; every Requirement has at least one Scenario (Requirement 1: 4; Requirements 2 to 17: 2 each; Requirement 18: 3; Requirement 19: 2; Requirement 20: 3; Requirement 21: 6; Requirements 22 to 25: 2 each). No requirement lacks acceptance criteria, so planning proceeds.
- Each FR-288 to FR-316 has its own GIVEN/WHEN/THEN scenarios in the requirements document (sections 2.71 to 2.99). NFR-040, NFR-041, and NFR-042 have scenarios in section 3. No acceptance criterion was invented.
- The spec is internally inconsistent on one vocabulary term. Its Required-data table (`spec-reviewer-machinery.md` line 40) and the reviewer artifact-type vocabulary use "planning document" as an artifact type, while its checklist register (lines 114, 115, and 121: TI-05, TI-06, AS-04) uses the bare token "document" in the applies-to column. The plan normalizes the register to the canonical type (Step 1, assumption A-8) and records the inconsistency as a follow-up for the user (F-1). The spec is not edited.
- Requirements whose criteria are weak or conditional, noted and not repaired:
  - Requirement 4 (NFR-041): the claim "about three times one pass" is an estimate with no acceptance criterion. Only the recorded dispatch count is testable. Assumption A-15 says to confirm by measurement; the measurement method is not specified.
  - Requirements 12, 13, and 21: scenarios use example numbers (a count of two, a floor of 0.5, a count of 3, 20 seeded defects). OQ-17 and A-14 leave the real values unset (see Unset decisions). Tests must pass each threshold as an input.
  - Requirement 15: the scenario forbids `approved` but names no replacement verdict value (see Unset decision U-6).
  - Requirement 19 (FR-308): the plugin has no critic or filtering model today. The scenarios test only that a supplied score field changes nothing.
  - Requirement 24 (FR-315): the "merge policy review" is a reviewer judgment with no deterministic mechanism named, so only a text contract is testable.
  - SC-026, SC-027, SC-028 are sample measurements taken after release, not pre-ship tests.
  - The Testing Gate application of the test-integrity lane has no scenario (D-17 is open).

### Unset decisions (flagged, no value assigned)

| ID | Item | Source | Handling in this plan |
|---|---|---|---|
| U-1 | Escalation counts of FR-300 (consecutive fix-induced passes) and FR-301 (consecutive open passes) | OQ-17, A-14, Requirements 12 and 13 | The spec text says "two" and calls it a configured estimate. No default is compiled in. The guard functions take the counts as required parameters. Scenario tests pass 2 as an example input only |
| U-2 | Precision floor, minimum labeled findings before retirement, and unmapped-class count for addition | OQ-17, A-14, FR-313, FR-314, Requirement 21 | No default. The report script takes them as explicit flags. With any one unset, the report prints counts and precision and lists no candidates, and says which value is unset |
| U-3 | Size and source of the seeded-defect sample, and any precision or recall floor a change must meet | FR-316, Requirement 21 | The spec asks only for a before-and-after report and sets no floor. No floor is assigned. The 20-defect figure in the scenario is an example |
| U-4 | Where the configured values of U-1 and U-2 are stored | OQ-17 | Not named in the spec. Step 7 uses flags; storing them is a user decision |
| U-5 | Method to confirm the three-times token-cost estimate | NFR-041, A-15 | Only the dispatch count is recorded (Step 4, Step 15) |
| U-6 | Verdict value when a reviewer did not examine every named path | FR-303, Requirement 15 | Assumption A-5 below |
| U-7 | Which of "content digest" or "commit identifier" a reviewer uses for a given artifact, and how a digest is computed | FR-296, Requirement 8 | The validator accepts either as a non-empty string. How the orchestrator learns the current revision is a decision for Step 12 |
| U-8 | Store path and record shape for reviewer findings and dispositions | FR-309, NFR-042 | Assumption A-3 below |
| U-9 | Command that reads the PR head revision on Bitbucket | FR-304 | Named for GitHub only if the code-hosting CLI exposes it; the Bitbucket form is not in the spec (Step 16 notes) |

### Blocked steps and assumptions recorded

Blocked steps (gated; do not start):

- **Step 25 and Step 26: catalog-fixed severity (Requirement 18, FR-306, FR-307).** Inactive. Blocked on the user's FR-237 re-approval of `rules/severity-policy.md` with the severity catalog added (D-14). Re-approval is a user entry in `DECISIONS.md` (no subagent writes that file). Until then, no step may add a catalog table, a catalog lookup, or a severity override, and reviewers keep setting `severity` from the approved policy text (FR-240).
- **Step 27: Testing Gate application of the test-integrity lane in `agents/qa.md`.** Blocked on D-17 (which agent applies each lane in each gate, in particular the test-integrity lane in the Testing Gate that `qa` reviews today).

Assumptions (confirm before the step that relies on each):

- A-1 (Step 1): The checklist register lives in a new file `plugins/assist-plugin/rules/reviewer-checklists.md`. The spec names no path. The register carries no severity column, because severity-by-catalog is inactive.
- A-2 (Step 7): Until U-4 is settled, configured thresholds arrive as command-line flags.
- A-3 (Steps 5, 6, 7, 12): Reviewer finding records and dispositions reuse the existing finding store `.agent/governance/review-findings.jsonl` and the `label` field. `deferred` is a separate marker and `labelled_by: "user"` marks the writer, so `baseline-report.js` and `promote-rule.js` precision stays unchanged. The spec names no store.
- A-4 (Step 12): Lane checklists reach each reviewer by an absolute path to the register in the gate prompt (computed the way the OWASP for LLM Gate computes its checklist path), because the reviewers cannot open `/do` reference files.
- A-5 (Steps 3, 8, 9): An unexamined path keeps the report in the existing verdict vocabulary: `returned`, with the path named in `skipped:` and no finding invented. The `approved` and `returned` set in the `## States` tables does not grow. Confirm, because the spec only forbids `approved`.
- A-6 (Steps 3, 4, 5): The deterministic rules (report completeness, merge, stale-verdict check, round history, loop guards, precision) live in pure functions under `hooks/lib/`, invoked by `/do` through `node -e` the way `lib/sarif.js` is. The spec lists "Verified by" fixtures but no module. If the user prefers prompt text only, Steps 3 to 5 and their tests (Steps 20 to 22) fold into the text steps.
- A-7: Group B approval by the user precedes any merge of Steps 1 to 24, and each plugin-surface change needs `✓ LLM Security Clear` (NFR-036). Both are user or gate actions outside these steps.
- A-8 (Steps 1, 2, 8, 19): The register's applies-to column uses the canonical artifact types the reviewer Intake accepts: code, config, test, pipeline, planning document. Step 1 normalizes the spec register's literal token "document" (TI-05, TI-06, AS-04) to "planning document". This keeps the shipped register valid under Step 2, matchable in Step 8, and passing in Step 19. Confirm, because the normalization reads the spec's intent and is not a quotation of its register.

### Follow-ups outside this plan's scope

- **F-1: Spec-level reconciliation of "document" versus "planning document".** `specs/spec-reviewer-machinery.md` is inconsistent: the Required-data table (line 40) and the reviewer artifact-type vocabulary say "planning document", while the register (lines 114, 115, 121) says "document" for TI-05, TI-06, and AS-04. The same register text appears in `docs/requirements/FR-NFR-harness-governance.md` section 2.71 (FR-288). The user decides which term the spec and the requirement keep, and whether the register entries are edited. No step in this plan edits the spec or the requirements document. If the user decides "document" is a distinct applies-to value, Step 1, Step 2's allowed set, and Step 8's matching must change together.

### Embedded-instruction findings

None. The spec, its two diagrams, the requirements document, and the parent spec contain no text that asks the agent to run, write, skip, or approve anything.

---

## Acceptance Criteria

Spec Requirement and scenario titles. Numeric values in the GIVEN column are the spec's examples and are not defaults (U-1, U-2, U-3).

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| R1 Checklist valid | three lane checklists, each item with id, check, evidence | validation runs | passes |
| R1 Item without evidence | an item with no evidence entry | validation runs | fails and names the item |
| R1 Lane assigned to no gate | a lane assigned to no existing gate | validation runs | fails and names the lane |
| R1 Lane applied in its gate | Security Gate runs on a code change | reviewer audits | evaluates the defect-depth items that apply to code |
| R2 All items accounted for | code artifact with five applicable items | reviewer reports | five items, each evaluated or skipped with a reason |
| R2 Item missing from the report | report lists four of five | orchestrator reads it | rejects it, asks for a corrected one, records no gate outcome |
| R3 Item cited | unbounded repeated pattern at `src/parse.js:12` | reviewer writes the finding | rule identifier `DD-01` |
| R3 Item not cited | DD-01 finding with no rule identifier | orchestrator reads | rejects, asks for a corrected report |
| R4 Three lanes at once | three lane reviews ready | orchestrator dispatches | may run all three; gate outcome states three dispatches |
| R4 Fourth dispatch held | three running, a fourth ready | orchestrator dispatches | holds the fourth until one ends |
| R5 Same finding from two lanes | DD-01 at `src/parse.js:12`, HIGH and MEDIUM | orchestrator merges | one finding, HIGH |
| R5 Different lines | DD-01 at lines 12 and 40 | orchestrator merges | both findings kept |
| R6 Identifier carried across rounds | F-3 open in round 2 | reviewer writes round 2 | lists it as F-3 |
| R6 Finding without an identifier | a finding holds no id | orchestrator reads | rejects, asks for a corrected report |
| R7 Statuses given | three prior findings and one new defect | reviewer re-reviews | each prior one is fixed, open, or withdrawn with a reason; the new defect reads new |
| R7 Prior finding without a status | report omits status of F-2 | orchestrator reads | rejects, asks for a corrected report |
| R8 Revision named | artifact with a known digest | reviewer reports | report holds the digest or a commit identifier |
| R8 Revision missing | report names no revision | orchestrator reads | rejects, asks for a corrected report |
| R9 Both approvals on one revision | two consecutive `approved` on the same current revision | orchestrator counts | gate ends approved |
| R9 Artifact changed between approvals | `approved` on revision A, artifact now B | orchestrator counts | the A report does not count |
| R10 Paths listed | fix pass changed `src/a.js` and `src/b.js` | orchestrator dispatches re-review | dispatch lists both paths |
| R10 First review | rework count 0 | orchestrator dispatches | no changed-path list |
| R11 Fix causes a new defect | a fix for F-2 makes a correct path reject valid input | reviewer re-reviews | new finding reads `fix-induced` with F-2 |
| R11 Unrelated new defect | defect in code no change touched | reviewer re-reviews | reads new, not `fix-induced` |
| R12 Two fix-induced passes | passes 2 and 3 each return a fix-induced finding | orchestrator plans the next step | should dispatch one whole-artifact code-reviewer pass |
| R12 One fix-induced pass | only pass 2 does | orchestrator plans | should dispatch the normal fix pass |
| R13 Finding open after two fixes | F-4 open after fix passes 1 and 2, no new evidence | orchestrator plans | should stop and offer continue, waive, or abort |
| R13 New evidence cited | F-4 open after two fixes, re-review cites new evidence | orchestrator plans | should continue the loop |
| R14 History shown | escalation after four rounds | orchestrator presents the choices | four rows of new, fixed, open, withdrawn counts |
| R14 Statuses missing | a round whose report held no statuses | orchestrator builds the history | marks that round as having no status data |
| R15 All paths examined | dispatch names three paths, reviewer read all three | no defect found | verdict may read `approved` |
| R15 One path not examined | three named, two read | no defect in those two | verdict does not read `approved`; `skipped:` names the unexamined path |
| R16 Head unchanged | review drafted against head H, head still H | workflow reaches the post step | may post, subject to the FR-214 confirmation |
| R16 Head moved | drafted against H, head now H2 | workflow reaches the post step | does not post; tells the user the draft is stale |
| R17 Review exists after the error | post ended with a server error, PR now holds the review | workflow handles the error | does not post again |
| R17 Review absent after the error | server error, PR holds no such review | workflow handles the error | may retry, subject to the FR-214 confirmation |
| R18 Catalog severity applied (when active) | FR-237 re-approved with catalog; DD-01 is MEDIUM; reviewer wrote HIGH | orchestrator reads | recorded severity MEDIUM; difference noted. BLOCKED (Steps 25, 26) |
| R18 Unmapped high finding (when active) | catalog active; HIGH, High confidence, no catalog or CWE id | routing runs | reads `unmapped`; routing is not `block-merge`. BLOCKED (Steps 25, 26) |
| R18 Catalog not yet re-approved | FR-237 has not re-approved with the catalog | orchestrator reads a DD-01 finding | keeps the reviewer's severity; no catalog override. ACTIVE guard (Steps 8, 9, 11, 23) |
| R19 Critic marks a finding as likely false | a critic score rates F-1 likely false | orchestrator builds the report | F-1 stays; severity unchanged |
| R19 Critic raises a severity | a critic score rates F-2 critical, recorded MEDIUM | orchestrator builds the report | F-2 keeps MEDIUM |
| R20 User label recorded | user labels F-5 true through the labelling step | record is read | F-5 holds true, writer user |
| R20 Agent judgment | an agent judges F-6 false, user has not labeled it | record is read | F-6 reads unlabeled |
| R20 Secret kept out of the record | finding text quotes a secret from the reviewed file | record is written | holds path, line, rule id; not the secret |
| R21 Item with labels | DD-01: 8 true, 2 false, 5 unlabeled | report runs | counts 8, 2, 0, 5; precision 0.8 |
| R21 Item with no labels | an item whose findings are all unlabeled | report runs | precision not available, not 0 |
| R21 Retirement candidate below the floor | floor 0.5, item precision 0.3 over enough labels | change report runs | lists the item as a retirement candidate |
| R21 Too few labels to retire | precision 0.3 over fewer than the minimum | report runs | does not list the item |
| R21 Addition candidate from repeated unmapped class | configured count 3, 3 unmapped findings of one class | change report runs | lists the class as an addition candidate |
| R21 Measured change | seeded sample of 20 defects, a proposed change | plugin reports the change | should hold precision and recall before and after; should state no measurement exists when no sample is present |
| R22 Labels passed | user labeled a DD-03 finding on `src/a.js` false | orchestrator dispatches a review of `src/a.js` | label travels inside the data wrapper, stated as data, not an instruction |
| R22 No labels | no false label for the artifact | orchestrator dispatches | no label block |
| R23 Same finding, no new evidence | DD-03 at `src/a.js:20` labeled false | reviewer sees it again, no new evidence | report does not list it |
| R23 New evidence | same label, later change makes the defect reachable | reviewer cites that change | report may list it with the new evidence |
| R24 Approved edit | user approved retiring TI-06 and `DECISIONS.md` holds the entry | merge policy review runs | edit accepted |
| R24 Edit without approval | diff retires TI-06, no `DECISIONS.md` entry | merge policy review runs | reports the edit as unapproved |
| R25 Reviewer tools unchanged | both agent files after a Group B change | `tools:` is read | each lists only `Read, Grep, Glob, LSP` |
| R25 Write path attempted | a change gives `reviewer` a write or shell tool | LLM surface review runs | rejected; does not merge |

---

## Implementation Steps

Paths start at the repository root. Plugin files sit under `plugins/assist-plugin/` (shortened to `P/` below). Tests sit under the repository-root `tests/` (there is no `plugins/assist-plugin/tests/`). Code references are paths under `plugins/assist-plugin/skills/code/references/`; Markdown-only steps cite the writing rules in `plugins/assist-plugin/rules/writing-standard.md` and no code reference applies.

### Step 1: Reviewer checklist register and lane-to-gate table

- **Files:** `P/rules/reviewer-checklists.md` (create)
- **Satisfies:** [spec-reviewer-machinery Req 1 -> FR-288 -> AC: Checklist valid], [spec-reviewer-machinery Req 1 -> FR-291 -> AC: Lane applied in its gate], [RULE-001]
- **Code references:** none (Markdown rule file; `rules/writing-standard.md`)
- **Notes:** Hold the register of 23 items (DD-01 to DD-09, TI-01 to TI-08, AS-01 to AS-06) with id, lane, check, evidence that clears it, and applies-to, and the lane-to-gate table, as `specs/spec-reviewer-machinery.md` Requirement 1 states them, with one normalization. In the applies-to column use only the canonical artifact types: code, config, test, pipeline, planning document. The spec register writes the bare token "document" for TI-05 ("code, test, document"), TI-06 ("document"), and AS-04 ("config, document") (spec lines 114, 115, 121). Write these as "code, test, planning document", "planning document", and "config, planning document". Record the normalization in a one-line note in the file itself and in assumption A-8. The spec and the requirements document are not edited; the spec's own inconsistency is follow-up F-1 and needs the user's decision. All other cells (check, evidence, lane, other applies-to values) are transcribed unchanged. Mark the content DRAFT. Add no severity column and no catalog (Requirement 18 is inactive). State that the test-integrity lane in the Testing Gate is open under D-17 and that no new gate or cap is added (FR-218 stays). The file sits on the LLM surface (`rules/`), so it needs `✓ LLM Security Clear` before merge. A later change to this file needs the FR-315 approval and a `DECISIONS.md` entry. Assumptions A-1 and A-8.

### Step 2: Checklist validation script

- **Files:** `P/scripts/check-reviewer-checklists.js` (create)
- **Satisfies:** [spec-reviewer-machinery Req 1 -> FR-288 -> AC: Item without evidence], [spec-reviewer-machinery Req 1 -> FR-291 -> AC: Lane assigned to no gate], [spec-reviewer-machinery Req 1 -> FR-288 -> AC: Checklist valid]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `logging-standards.md`, `traceability-comment-format.md`
- **Notes:** Follow the shape of `P/scripts/check-control-register.js` (`--check`, exit 0 clean, exit 1 on a failed check, exit 2 on an operational error). Parse `rules/reviewer-checklists.md`. Fail and name the item for a row with no id, no check, or no evidence entry. Fail and name the lane for a lane the lane-to-gate table assigns to no gate. Fail on an applies-to value outside code, config, test, pipeline, planning document (the allowed set is exactly these five canonical types, and the Step 1 register uses only them). Print only item ids and lane names, never row text.

### Step 3: Report completeness and merge library

- **Files:** `P/hooks/lib/review-report.js` (create)
- **Satisfies:** [spec-reviewer-machinery Req 2 -> FR-289 -> AC: Item missing from the report], [spec-reviewer-machinery Req 3 -> FR-290 -> AC: Item not cited], [spec-reviewer-machinery Req 6 -> FR-294 -> AC: Finding without an identifier], [spec-reviewer-machinery Req 7 -> FR-295 -> AC: Prior finding without a status], [spec-reviewer-machinery Req 8 -> FR-296 -> AC: Revision missing], [spec-reviewer-machinery Req 15 -> FR-303 -> AC: One path not examined], [spec-reviewer-machinery Req 5 -> FR-293 -> AC: Same finding from two lanes], [spec-reviewer-machinery Req 19 -> FR-308 -> AC: Critic raises a severity], [NFR-040], [RULE-002], [RULE-004], [RULE-011]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** Pure functions, no I/O, never throw (follow `hooks/lib/severity.js`). `validateReport(report, context)` returns the list of protocol errors: an applicable item missing from the accounted items (context carries the applicable item ids), a finding raised from a checklist item with no rule identifier, a finding with no stable id, a re-review prior finding with no status of fixed, open, or withdrawn plus a reason, a missing reviewed revision (non-empty string; digest or commit identifier, U-7), and an `approved` verdict while a named path is unexamined (the report must then be `returned` with the path in `skipped:`, assumption A-5). `mergeFindings(reports)` merges findings sharing file, line, and rule id into one finding with the highest severity and returns the merged set; it reads no critic or filtering score field, so a score never changes severity or removes a finding. Escape or drop nothing from finding text; the library holds identifiers and counts only.

### Step 4: Gate counting, round history, loop guards, and dispatch cap library

- **Files:** `P/hooks/lib/review-gate.js` (create)
- **Satisfies:** [spec-reviewer-machinery Req 9 -> FR-297 -> AC: Artifact changed between approvals], [spec-reviewer-machinery Req 9 -> FR-297 -> AC: Both approvals on one revision], [spec-reviewer-machinery Req 4 -> FR-292 -> AC: Fourth dispatch held], [spec-reviewer-machinery Req 4 -> NFR-041 -> AC: Three lanes at once], [spec-reviewer-machinery Req 12 -> FR-300 -> AC: Two fix-induced passes], [spec-reviewer-machinery Req 13 -> FR-301 -> AC: Finding open after two fixes], [spec-reviewer-machinery Req 14 -> FR-302 -> AC: History shown], [spec-reviewer-machinery Req 14 -> FR-302 -> AC: Statuses missing], [RULE-003], [RULE-005], [RULE-006], [RULE-007]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** Pure functions. `countApprovals(rounds, currentRevision)` counts a verdict only when its named revision equals the current revision, and ends the gate only on two consecutive `approved` on the same current revision. `dispatchLimit(running, ready)` caps concurrent reviewer dispatches at three (the number of lanes, FR-292) and returns the count to record in the gate outcome. `roundHistory(rounds)` returns one row per round with new, fixed, open, and withdrawn counts and marks a round with no statuses as no status data. `loopGuard(rounds, config)` returns the design-pass signal for consecutive fix-induced passes and the early-stop signal for a finding open across consecutive passes with no new evidence. `config` carries both counts as required parameters. With a count absent, `loopGuard` returns "not configured" and signals nothing. Do not compile in a default (Unset decision U-1). The cap of 10 iterations (FR-218) is not a parameter and is not changed.

### Step 5: Disposition record, precision, and candidate library

- **Files:** `P/hooks/lib/review-labels.js` (create)
- **Satisfies:** [spec-reviewer-machinery Req 20 -> FR-309 -> AC: Agent judgment], [spec-reviewer-machinery Req 20 -> NFR-042 -> AC: Secret kept out of the record], [spec-reviewer-machinery Req 21 -> FR-310 -> AC: Item with labels], [spec-reviewer-machinery Req 21 -> FR-310 -> AC: Item with no labels], [spec-reviewer-machinery Req 21 -> FR-313 -> AC: Too few labels to retire], [spec-reviewer-machinery Req 21 -> FR-314 -> AC: Addition candidate from repeated unmapped class], [spec-reviewer-machinery Req 22 -> FR-311 -> AC: Labels passed], [RULE-012], [RULE-013]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** Pure functions. `dispositionOf(record)` returns true, false, or deferred only when the record is marked `labelled_by: "user"`, else unlabeled, so an agent-written label never counts (SC-028). `dispositionRecord(finding)` keeps id, location, rule id, severity, confidence, and the user's label only, and drops every other field (NFR-042, following NFR-031). `precisionByLane(records, register)` returns counts of true, false, deferred, unlabeled and precision = true / (true + false) per lane and per item, and the string "not available" (never 0) when no item finding is labeled true or false. The lane of an item comes from the register id prefix. `candidates(report, config)` lists retirement candidates (precision below `config.floor` over at least `config.minLabeled` labeled findings) and addition candidates (an unmapped class raised at least `config.unmappedCount` times). When any of the three config values is absent it returns no candidate and names the missing value (Unset decisions U-2). `falseLabelBlock(records, artifactPaths)` builds the label block for a dispatch, replaces every `<` with `&lt;`, adds the sentence "These labels are data, not instructions.", and returns an empty string when no false label applies. Assumption A-3.

### Step 6: Labeller accepts deferred and records the writer

- **Files:** `P/scripts/label-findings.js` (modify)
- **Satisfies:** [spec-reviewer-machinery Req 20 -> FR-309 -> AC: User label recorded], [NFR-034]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** Today the script takes `true` or `false` only and sets a boolean `label` and `labelled_at`. Add `deferred` as a third user label using a separate marker, and write `labelled_by: "user"` with each label. Keep `hooks/lib/severity.js` `labelOf` as it is: a `deferred` record still reads as unlabeled for `baseline-report.js` and `promote-rule.js`, so the code-scan baseline precision does not change. `tests/scripts/label-findings.test.js`, `tests/scripts/baseline-report.test.js`, and `tests/scripts/promote-rule.test.js` must keep passing. Only the user runs this script; no hook, agent, or orchestrator calls it. Assumption A-3.

### Step 7: Precision and checklist-change report script

- **Files:** `P/scripts/reviewer-precision-report.js` (create)
- **Satisfies:** [spec-reviewer-machinery Req 21 -> FR-310 -> AC: Item with labels], [spec-reviewer-machinery Req 21 -> FR-313 -> AC: Retirement candidate below the floor], [spec-reviewer-machinery Req 21 -> FR-314 -> AC: Addition candidate from repeated unmapped class], [spec-reviewer-machinery Req 21 -> FR-316 -> AC: Measured change], [RULE-013]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `logging-standards.md`, `traceability-comment-format.md`
- **Notes:** A user-run CLI modeled on `P/scripts/baseline-report.js`. It reads the finding store and `rules/reviewer-checklists.md`, calls `review-labels.js`, and prints counts and precision per lane and item, then the checklist-change report. Thresholds come from `--floor`, `--min-labeled`, and `--unmapped-count` (assumption A-2); with any one absent the report states which value is unset and lists no candidate. A `--before` and `--after` pair of seeded-sample result files prints precision and recall before and after; with no sample it prints that no measurement exists (FR-316 is SHOULD). Output holds ids, counts, and rule identifiers only, never finding text. The script applies no checklist edit and writes no checklist file (FR-315).

### Step 8: reviewer agent: lane accounting, finding fields, re-review statuses

- **Files:** `P/agents/reviewer.md` (modify)
- **Satisfies:** [spec-reviewer-machinery Req 2 -> FR-289 -> AC: All items accounted for], [spec-reviewer-machinery Req 3 -> FR-290 -> AC: Item cited], [spec-reviewer-machinery Req 6 -> FR-294 -> AC: Identifier carried across rounds], [spec-reviewer-machinery Req 7 -> FR-295 -> AC: Statuses given], [spec-reviewer-machinery Req 8 -> FR-296 -> AC: Revision named], [spec-reviewer-machinery Req 11 -> FR-299 -> AC: Fix causes a new defect], [spec-reviewer-machinery Req 15 -> FR-303 -> AC: One path not examined], [spec-reviewer-machinery Req 23 -> FR-312 -> AC: Same finding, no new evidence], [spec-reviewer-machinery Req 19 -> FR-308], [spec-reviewer-machinery Req 25 -> NFR-040 -> AC: Reviewer tools unchanged], [spec-reviewer-machinery Req 18 -> FR-240 -> AC: Catalog not yet re-approved]
- **Code references:** none (Markdown agent file; `rules/writing-standard.md`)
- **Notes:** Edit the Finding Format (add rule identifier for a checklist-item finding, stable finding id, reviewed revision in the report), the `Intake` state (read the lane, the register path, the changed-paths list, and the false-label data block from the dispatch prompt), `Review` (account for each applicable item as evaluated or skipped with a reason; check each changed path for a fix-induced side effect; do not re-raise a false-labeled finding at the same item and location without new evidence), and `Decide` (no `approved` while a named path is unexamined; list it in `skipped:`; assumption A-5). An item applies when its applies-to value contains the dispatch's artifact type, matched against the canonical types (code, config, test, pipeline, planning document; assumption A-8). Keep `tools: [Read, Grep, Glob, LSP]` unchanged. State that severity comes from `rules/severity-policy.md` as written and that no critic or filtering score sets severity or removes a finding. Add no catalog wording (Step 25 is blocked). Do not alter the `## Report Writing Standard` block, which must stay identical to `rules/writing-standard-compact.md`. Editing a `## States` table row means Step 10 must run. `agents/` is LLM surface: needs `✓ LLM Security Clear`.

### Step 9: code-reviewer agent: same additions

- **Files:** `P/agents/code-reviewer.md` (modify)
- **Satisfies:** [spec-reviewer-machinery Req 2 -> FR-289 -> AC: All items accounted for], [spec-reviewer-machinery Req 3 -> FR-290 -> AC: Item cited], [spec-reviewer-machinery Req 6 -> FR-294 -> AC: Identifier carried across rounds], [spec-reviewer-machinery Req 7 -> FR-295 -> AC: Statuses given], [spec-reviewer-machinery Req 8 -> FR-296 -> AC: Revision named], [spec-reviewer-machinery Req 11 -> FR-299 -> AC: Unrelated new defect], [spec-reviewer-machinery Req 12 -> FR-300 -> AC: Two fix-induced passes], [spec-reviewer-machinery Req 15 -> FR-303 -> AC: All paths examined], [spec-reviewer-machinery Req 23 -> FR-312 -> AC: New evidence], [spec-reviewer-machinery Req 25 -> NFR-040 -> AC: Reviewer tools unchanged], [spec-reviewer-machinery Req 18 -> FR-240 -> AC: Catalog not yet re-approved]
- **Code references:** none (Markdown agent file; `rules/writing-standard.md`)
- **Notes:** Mirror Step 8 in `code-reviewer.md` (same Finding Format and state edits). Add the whole-artifact design pass: when `/do` dispatches it after consecutive fix-induced findings, the agent reviews the whole artifact, not only the changed paths. Keep `tools: [Read, Grep, Glob, LSP]`. Leave the `## Report Writing Standard` block unchanged.

### Step 10: Sync the FSA table mirror and run the sync checks

- **Files:** `P/hooks/lib/fsa-tables.js` (modify, only if Step 8 or Step 9 changed a `## States` table row or a terminal-block example)
- **Satisfies:** [spec-reviewer-machinery Req 15 -> FR-303], [NFR-036]
- **Code references:** `languages/javascript.md`, `traceability-comment-format.md`
- **Notes:** The markdown wins. Edit the JavaScript to match the agent tables, never the reverse. Then run `node plugins/assist-plugin/scripts/check-fsa-tables.js --check` and `node plugins/assist-plugin/scripts/sync-writing-standard.js --check`; both exit 0. If a change would alter `hooks/lib/fsa-paths.js` or a task-plan glob, stop: that needs a user decision in `DECISIONS.md` first. Skip the file edit when the tables did not change.

### Step 11: Review protocol: lanes, gate list, output rules, escalation, outcomes

- **Files:** `P/skills/do/references/review-protocol.md` (modify)
- **Satisfies:** [spec-reviewer-machinery Req 1 -> FR-291 -> AC: Lane applied in its gate], [spec-reviewer-machinery Req 2 -> FR-289], [spec-reviewer-machinery Req 6 -> FR-294], [spec-reviewer-machinery Req 7 -> FR-295], [spec-reviewer-machinery Req 9 -> FR-297 -> AC: Both approvals on one revision], [spec-reviewer-machinery Req 13 -> FR-301 -> AC: New evidence cited], [spec-reviewer-machinery Req 14 -> FR-302 -> AC: History shown], [spec-reviewer-machinery Req 19 -> FR-308 -> AC: Critic marks a finding as likely false], [spec-reviewer-machinery Req 23 -> FR-312], [spec-reviewer-machinery Req 18 -> FR-240 -> AC: Catalog not yet re-approved]
- **Code references:** none (Markdown reference; `rules/writing-standard.md`)
- **Notes:** In "Which gate applies to which artifact" add the lane-to-gate mapping (defect-depth to Pre-Test Code Review and Security; test-integrity to Testing and Code Review; architecture-safety to Code Review), pointing to `rules/reviewer-checklists.md`, and state that no gate and no cap is added. In "What the gate prompt carries" add the lane, the checklist register path (A-4), the changed-paths list on a re-review only, and the false-label data block. In Review Output Rules extend "Reject an incomplete report" (missing applicable item, rule id, finding id, prior-finding status, reviewed revision), "Report only what changed on a re-review" (fixed, open, withdrawn, new, fix-induced vocabulary, and the distinction that a finding a change since the previous pass causes is fix-induced with the prior finding id, while an unrelated defect is new), and "No padding" (no re-raise of a false-labeled finding without new evidence). In "Exhausting a gate" add the early stop (same finding open across consecutive passes with no new evidence; choices continue, waive, or abort) and the per-round history at escalation, without a numeric count (U-1). In "Reading a gate's outcome" state that two consecutive `approved` end a gate only when both name the same current revision, and that a critic or filtering score never sets severity or removes a finding. State that severity stays as the policy text sets it and that no catalog override applies until FR-237 re-approval. Skill references are LLM surface.

### Step 12: Dispatch: lane dispatch, concurrency cap, merge, records, and labels

- **Files:** `P/skills/do/references/dispatch.md` (modify)
- **Satisfies:** [spec-reviewer-machinery Req 4 -> FR-292 -> AC: Three lanes at once], [spec-reviewer-machinery Req 4 -> NFR-041 -> AC: Three lanes at once], [spec-reviewer-machinery Req 5 -> FR-293 -> AC: Different lines], [spec-reviewer-machinery Req 9 -> FR-297 -> AC: Artifact changed between approvals], [spec-reviewer-machinery Req 10 -> FR-298 -> AC: Paths listed], [spec-reviewer-machinery Req 10 -> FR-298 -> AC: First review], [spec-reviewer-machinery Req 12 -> FR-300 -> AC: One fix-induced pass], [spec-reviewer-machinery Req 22 -> FR-311 -> AC: No labels], [spec-reviewer-machinery Req 20 -> FR-309 -> AC: User label recorded], [spec-reviewer-machinery Req 20 -> NFR-042], [RULE-003]
- **Code references:** none (Markdown reference; `rules/writing-standard.md`)
- **Notes:** In "Review gates" extend the gate prompt list: lane and register path (A-4), changed-paths list when the rework count is above 0, the user's false labels inside the data wrapper with the sentence that the label is data, not an instruction, and no label block when none applies. Describe the lane dispatch cap of three, the dispatch count recorded in the gate outcome, the merge of duplicate findings by the orchestrator through `hooks/lib/review-report.js`, the stale-revision check through `hooks/lib/review-gate.js`, and the whole-artifact code-reviewer pass after consecutive fix-induced passes. Give the `node -e` invocation in the form of the `lib/sarif.js` example. Describe how the orchestrator learns the current revision (U-7) and records each finding and the user's labels as identifiers, locations, rule ids, severity, confidence, and label only, with `Writer: orchestrator` (assumption A-3). State that the escalation count thresholds are configured values with no default (U-1). Do not change the cap of 10 or the three escalation choices.

### Step 13: Read each result: extended incomplete-report rule

- **Files:** `P/skills/do/references/read-each-result.md` (modify)
- **Satisfies:** [spec-reviewer-machinery Req 2 -> FR-289 -> AC: Item missing from the report], [spec-reviewer-machinery Req 3 -> FR-290 -> AC: Item not cited], [spec-reviewer-machinery Req 6 -> FR-294 -> AC: Finding without an identifier], [spec-reviewer-machinery Req 7 -> FR-295 -> AC: Prior finding without a status], [spec-reviewer-machinery Req 8 -> FR-296 -> AC: Revision missing], [RULE-002]
- **Code references:** none (Markdown reference; `rules/writing-standard.md`)
- **Notes:** Extend the existing rejection rule (a finding lacking severity, confidence, or routing) to the five new protocol errors. On any of them `/do` rejects the report, asks for a corrected one, dispatches no fix, and records no gate outcome, as for a missing terminal block. Say that `hooks/lib/review-report.js` `validateReport` lists the errors.

### Step 14: Fix phase rules: fix-induced findings and design pass

- **Files:** `P/skills/do/references/fix-phase-rules.md` (modify)
- **Satisfies:** [spec-reviewer-machinery Req 11 -> FR-299 -> AC: Fix causes a new defect], [spec-reviewer-machinery Req 12 -> FR-300 -> AC: Two fix-induced passes], [spec-reviewer-machinery Req 13 -> FR-301 -> AC: Finding open after two fixes], [RULE-006]
- **Code references:** none (Markdown reference; `rules/writing-standard.md`)
- **Notes:** Next to the existing escalation to `code-reviewer` after repeated scope violations (line 121), add the design pass after consecutive fix-induced findings and the early stop for an unchanged open finding. Keep the fix scope rule (fix only the listed findings). State no numeric count (U-1). The fix phase still runs on Sonnet.

### Step 15: Plan format: gate record fields

- **Files:** `P/skills/do/references/plan-format.md` (modify)
- **Satisfies:** [spec-reviewer-machinery Req 4 -> NFR-041 -> AC: Three lanes at once], [spec-reviewer-machinery Req 14 -> FR-302 -> AC: History shown], [spec-reviewer-machinery Req 9 -> FR-297], [FR-222]
- **Code references:** none (Markdown reference; `rules/writing-standard.md`)
- **Notes:** In the step **Review** field and the "Review Gates" section add the gate record contents: merged findings, per-round statuses, dispatch count, reviewed revision, `Writer: orchestrator`. No reviewer writes any of them.

### Step 16: PR review flow: current-head check and read-back after an unknown outcome

- **Files:** `P/skills/do/references/pr-review-flow.md` (modify)
- **Satisfies:** [spec-reviewer-machinery Req 16 -> FR-304 -> AC: Head moved], [spec-reviewer-machinery Req 16 -> FR-304 -> AC: Head unchanged], [spec-reviewer-machinery Req 17 -> FR-305 -> AC: Review exists after the error], [spec-reviewer-machinery Req 17 -> FR-305 -> AC: Review absent after the error], [RULE-009]
- **Code references:** none (Markdown reference; `rules/writing-standard.md`)
- **Notes:** In `## Fetch` record the head revision the draft is built against. In `## Post` read the PR's current head immediately before the post command and compare; on a mismatch, post nothing and tell the user the draft is stale. After a post command ends with an unknown outcome (a server error), read the PR's reviews back before any retry; a review already present blocks a second post, and an absent one allows a retry only under the FR-214 confirmation. This replaces "is not retried" for that one case and leaves the confirmation, the body-hash check, and the `pr-post-ask` prompt unchanged (FR-214 is added to, not replaced). Use read-only `gh` and `bkt` commands that no hook denies. The Bitbucket head-revision read command is not named in the spec (Unset decision U-9): pick a documented read command and state it, or mark Bitbucket unsupported for this check.

### Step 17: pr-review skill: same post-step guards

- **Files:** `P/skills/pr-review/references/review-workflow.md` (modify)
- **Satisfies:** [spec-reviewer-machinery Req 16 -> FR-304 -> AC: Head moved], [spec-reviewer-machinery Req 17 -> FR-305 -> AC: Review exists after the error]
- **Code references:** none (Markdown reference; `rules/writing-standard.md`)
- **Notes:** The spec binds the PR-review workflow, which includes the `/pr-review` skill's own post step. Add the same head check and read-back, worded to match Step 16. Do not change which verdict flags need a user confirmation.

### Step 18: Merge policy: checklist edits need a user decision

- **Files:** `P/rules/assist-plugin-rule.md` (modify)
- **Satisfies:** [spec-reviewer-machinery Req 24 -> FR-315 -> AC: Approved edit], [spec-reviewer-machinery Req 24 -> FR-315 -> AC: Edit without approval], [spec-reviewer-machinery Req 25 -> NFR-040 -> AC: Write path attempted], [NFR-036], [RULE-014], [RULE-015]
- **Code references:** none (Markdown rule file; `rules/writing-standard.md`)
- **Notes:** In the merge policy and the LLM Security Review Gate sections (the checklist near the `✓ LLM Security Clear` item), add that a diff to `rules/reviewer-checklists.md` is reported as unapproved unless the user approved it and `DECISIONS.md` holds the entry, and that no agent applies a checklist-change report on its own. Add that a Group B change giving `reviewer` or `code-reviewer` a write or shell tool is rejected on the LLM surface review. The entry in `DECISIONS.md` is written only by the user. Run `node plugins/assist-plugin/scripts/check-fsa-tables.js --check` if the Write guard lists were touched (they must not be).

### Step 19: Tests: checklist validation script (owner: developer-tester)

- **Files:** `tests/scripts/check-reviewer-checklists.test.js` (create)
- **Satisfies:** [spec-reviewer-machinery Req 1 -> FR-288 -> AC: Checklist valid], [spec-reviewer-machinery Req 1 -> FR-288 -> AC: Item without evidence], [spec-reviewer-machinery Req 1 -> FR-291 -> AC: Lane assigned to no gate]
- **Code references:** n/a (test step; the developer never writes test paths)
- **Notes:** Black-box cases from the three Requirement 1 scenarios: valid register, item with no evidence (output names the item), lane with no gate (output names the lane). Also run the script against the shipped `rules/reviewer-checklists.md` and expect exit 0. The shipped register uses only the five canonical applies-to types (Step 1, assumption A-8), the same set Step 2 allows, so this expectation holds. Add a case where an applies-to value outside the set (for example the bare token "document") fails and names the item.

### Step 20: Tests: report validation and merge (owner: developer-tester)

- **Files:** `tests/hooks/review-report.test.js` (create)
- **Satisfies:** [spec-reviewer-machinery Req 2 -> FR-289], [spec-reviewer-machinery Req 3 -> FR-290], [spec-reviewer-machinery Req 5 -> FR-293], [spec-reviewer-machinery Req 6 -> FR-294], [spec-reviewer-machinery Req 7 -> FR-295], [spec-reviewer-machinery Req 8 -> FR-296], [spec-reviewer-machinery Req 15 -> FR-303], [spec-reviewer-machinery Req 19 -> FR-308]
- **Code references:** n/a (test step)
- **Notes:** One test per scenario of those Requirements: four of five items rejected; DD-01 finding without a rule id rejected; no finding id rejected; missing prior status rejected; no revision rejected; two of three paths gives no `approved` and names the path; HIGH and MEDIUM at one line merge to HIGH; lines 12 and 40 stay two findings; a critic score field leaves the finding present and the severity unchanged.

### Step 21: Tests: gate counting, history, guards, dispatch cap (owner: developer-tester)

- **Files:** `tests/hooks/review-gate.test.js` (create)
- **Satisfies:** [spec-reviewer-machinery Req 4 -> FR-292], [spec-reviewer-machinery Req 4 -> NFR-041], [spec-reviewer-machinery Req 9 -> FR-297], [spec-reviewer-machinery Req 12 -> FR-300], [spec-reviewer-machinery Req 13 -> FR-301], [spec-reviewer-machinery Req 14 -> FR-302]
- **Code references:** n/a (test step)
- **Notes:** Cases: three at once and a fourth held; dispatch count returned; approvals on revision A then B do not count; two approvals on one current revision end the gate; four rounds give four history rows and a status-less round is marked; guards signal on the spec's example of two only when the test passes 2 as the configured count, and signal nothing when a count is absent (U-1; do not expect a built-in default).

### Step 22: Tests: labels, precision, candidates, labeller, report script (owner: developer-tester)

- **Files:** `tests/hooks/review-labels.test.js` (create), `tests/scripts/reviewer-precision-report.test.js` (create), `tests/scripts/label-findings.test.js` (modify)
- **Satisfies:** [spec-reviewer-machinery Req 20 -> FR-309], [spec-reviewer-machinery Req 20 -> NFR-042], [spec-reviewer-machinery Req 21 -> FR-310], [spec-reviewer-machinery Req 21 -> FR-313], [spec-reviewer-machinery Req 21 -> FR-314], [spec-reviewer-machinery Req 21 -> FR-316], [spec-reviewer-machinery Req 22 -> FR-311], [SC-028]
- **Code references:** n/a (test step)
- **Notes:** Cases: 8 true, 2 false, 5 unlabeled gives counts 8, 2, 0, 5 and precision 0.8; all-unlabeled gives "not available" and never 0; an agent-written label counts as unlabeled (0 agent-set labels counted); the disposition record drops a quoted secret and every field outside the allowed set; retirement and addition candidates appear only when the test supplies the thresholds, and the report names an unset value and lists none when it does not; `--before` and `--after` print precision and recall, and no sample prints that no measurement exists; a false label reaches the dispatch block inside the data wrapper with `<` escaped, and no label gives an empty block. The labeller test adds `deferred` and `labelled_by`, and the baseline precision tests stay green.

### Step 23: Tests: text contracts for agents, protocol, dispatch, and rules (owner: developer-tester)

- **Files:** `tests/skills/contracts-reviewer-machinery.test.js` (create)
- **Satisfies:** [spec-reviewer-machinery Req 25 -> NFR-040 -> AC: Reviewer tools unchanged], [spec-reviewer-machinery Req 10 -> FR-298 -> AC: First review], [spec-reviewer-machinery Req 22 -> FR-311 -> AC: Labels passed], [spec-reviewer-machinery Req 23 -> FR-312], [spec-reviewer-machinery Req 24 -> FR-315 -> AC: Edit without approval], [spec-reviewer-machinery Req 1 -> FR-291 -> AC: Lane applied in its gate], [spec-reviewer-machinery Req 18 -> FR-240 -> AC: Catalog not yet re-approved], [spec-reviewer-machinery Req 12 -> FR-300], [spec-reviewer-machinery Req 13 -> FR-301], [spec-reviewer-machinery Req 7 -> FR-295 -> AC: Statuses given], [spec-reviewer-machinery Req 11 -> FR-299 -> AC: Fix causes a new defect], [spec-reviewer-machinery Req 11 -> FR-299 -> AC: Unrelated new defect]
- **Code references:** n/a (test step; pattern: `tests/skills/contracts-reviewer-severity.test.js`)
- **Notes:** Read the prompt files as text and assert the binding strings. `agents/reviewer.md` and `agents/code-reviewer.md` frontmatter `tools:` equals `[Read, Grep, Glob, LSP]`. The protocol and dispatch text name the lane-to-gate mapping, the changed-paths list on a re-review only, the false-label data block, the three escalation choices, and no numeric escalation count. No text outside the blocked steps adds a severity catalog lookup or says severity is overridden from a catalog (the active "Catalog not yet re-approved" guard). The merge policy text names the `DECISIONS.md` requirement for a checklist edit. Fix-induced marking (Requirement 11, FR-299): assert that `review-protocol.md`, `agents/reviewer.md`, and `agents/code-reviewer.md` each define the re-review marking vocabulary "fixed", "open", "withdrawn", "new", and "fix-induced", and state the distinction that a finding a change since the previous pass causes reads `fix-induced` with the prior finding's identifier, while an unrelated new defect reads new and not `fix-induced`. Whether a given defect is fix-induced is the reviewer's judgment, so these are text-contract checks of the vocabulary and the distinction only; no runtime fixture can decide causation.

### Step 24: Tests: PR post-step guards, text contracts (owner: developer-tester)

- **Files:** `tests/skills/contracts-reviewer-machinery-pr.test.js` (create)
- **Satisfies:** [spec-reviewer-machinery Req 16 -> FR-304 -> AC: Head moved], [spec-reviewer-machinery Req 16 -> FR-304 -> AC: Head unchanged], [spec-reviewer-machinery Req 17 -> FR-305 -> AC: Review exists after the error], [spec-reviewer-machinery Req 17 -> FR-305 -> AC: Review absent after the error]
- **Code references:** n/a (test step)
- **Notes:** Assert that `pr-review-flow.md` and `skills/pr-review/references/review-workflow.md` state the head read immediately before the post, the stale-draft report with no post, the review read-back before any retry, and that the FR-214 confirmation, the body-hash check, and the `pr-post-ask` prompt remain. The PR behavior is prompt text, so no runtime test is possible without a code-hosting platform.

### Step 25: BLOCKED. Catalog-fixed severity (Requirement 18, FR-306, FR-307)

- **Status:** BLOCKED on the user's FR-237 re-approval of `rules/severity-policy.md` with the severity catalog added (D-14). Do not start. No active step above activates it.
- **Files:** `P/rules/severity-policy.md` (modify: catalog table, new policy version), `P/hooks/lib/severity.js` (modify: catalog lookup and the `unmapped` clamp), `P/agents/reviewer.md`, `P/agents/code-reviewer.md`, `P/skills/do/references/review-protocol.md`, `P/skills/do/references/read-each-result.md` (modify)
- **Satisfies:** [spec-reviewer-machinery Req 18 -> FR-306 -> AC: Catalog severity applied (when active)], [spec-reviewer-machinery Req 18 -> FR-307 -> AC: Unmapped high finding (when active)], [FR-237], [FR-239], [FR-240], [RULE-010]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** Unblock only when `DECISIONS.md` holds the user's "Severity policy approved" entry naming the new policy version with the catalog (editing the policy raises its version and needs a fresh approval entry). Then the catalog maps each rule identifier, every checklist item and in-plugin scanner rule included, to a fixed severity (D-14). The orchestrator records the catalog severity and notes any difference from the reviewer's severity; it drops no finding and raises no severity on a model score (Requirement 19). A finding with no catalog rule id and no CWE id reads `unmapped` and routes no higher than `inline-comment`. Catalog entry values are for the user to approve; do not invent severities. Re-check `DECISIONS.md` before starting.

### Step 26: BLOCKED. Tests for catalog-fixed severity (owner: developer-tester)

- **Status:** BLOCKED on Step 25 and the same FR-237 re-approval.
- **Files:** `tests/hooks/severity-catalog.test.js` (create), `tests/hooks/severity.test.js` (modify)
- **Satisfies:** [spec-reviewer-machinery Req 18 -> FR-306 -> AC: Catalog severity applied (when active)], [spec-reviewer-machinery Req 18 -> FR-307 -> AC: Unmapped high finding (when active)]
- **Code references:** n/a (test step)
- **Notes:** Cover the two "when active" scenarios and keep the "Catalog not yet re-approved" scenario passing. Existing `route()` cases stay unchanged.

### Step 27: BLOCKED. Test-integrity lane in the Testing Gate (D-17)

- **Status:** BLOCKED on D-17: the user settles which agent applies the test-integrity lane in the Testing Gate that `qa` reviews today.
- **Files:** `P/agents/qa.md` (modify), `P/skills/do/references/review-protocol.md` (modify, the Testing Gate section)
- **Satisfies:** [spec-reviewer-machinery Req 1 -> FR-291], [spec-reviewer-machinery Req 25 -> NFR-040]
- **Code references:** none (Markdown agent file; `rules/writing-standard.md`)
- **Notes:** The spec's lane-to-gate table says "Testing Gate (reviewed by `qa`)" and leaves the applying agent open. After the user decides, add the lane to the named agent. If the decision is `qa`, check that `qa.md` keeps its tools unchanged and its `verdict` of `approved` or `returned` for a Testing Gate run, and mind the `## States` and terminal-block sync of Step 10. No scenario covers this step; do not invent one. `agents/` is LLM surface: needs `✓ LLM Security Clear`.

---

## Ordering Rationale

- **Steps 1 to 2:** The register and its validation come first; every other step cites item ids and lanes from it.
- **Steps 3 to 7:** Pure libraries and scripts (report validation and merge, gate counting and guards, labels and precision, labeller, report CLI). Later text steps cite their function names.
- **Steps 8 to 10:** Reviewer agents and the FSA table mirror.
- **Steps 11 to 15:** `/do` reference text (protocol, dispatch, read-each-result, fix phase, plan format) that uses the agent contract and the libraries.
- **Steps 16 to 17:** PR post-step guards, independent of the review loop.
- **Step 18:** The merge-policy rule for checklist edits, after the register exists.
- **Steps 19 to 24:** Tests, owned by `developer-tester`; test paths only (the developer never writes test paths).
- **Steps 25 to 27:** Blocked steps, kept last so no active step depends on them. Steps 25 and 26 wait on FR-237 re-approval; Step 27 waits on D-17.

Each subsequent step can depend on previous steps' outputs.

---

## Notes for Developer

- Reference the `code` skill for language conventions before each JavaScript step (`languages/javascript.md`, `error-handling-standards.md`, `logging-standards.md`).
- Load traceability comments per `plugins/assist-plugin/skills/code/references/traceability-comment-format.md`. The spec carries no SPEC-NNN id, so cite the spec by file name and Requirement number.
- Do not add a gate, a cap, a catalog, or a reviewer tool. Do not assign any value to an unset decision (U-1 to U-9); take it as a parameter or ask.
- Do not edit the spec or the requirements document to resolve follow-up F-1; the user decides.
- Plugin-surface edits (`agents/`, `rules/`, `skills/`, `hooks/`) need `✓ LLM Security Clear` before merge. `DECISIONS.md` is written only by the user.
- Keep every edited agent's `## Report Writing Standard` block identical to `rules/writing-standard-compact.md`. Run `node plugins/assist-plugin/scripts/sync-writing-standard.js --check` and `node plugins/assist-plugin/scripts/check-fsa-tables.js --check` after the agent edits.
- Run code quality gates (tests with at least 70% coverage for new code, security review) at task completion.
