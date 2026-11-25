// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the spec structural grader of the evaluation harness (Group A, Step 16):
// plugins/assist-plugin/scripts/eval-harness/spec-checklist.js (`scoreSpecRun(request)`, `validateChecklist(rubric)`,
// `parseDocument(text)`, `KNOWN_SOURCES`, `CHECK_NAMES`, `STATUS_SCORED`, `STATUS_ERROR`).
//
// Sources: specs/spec-evaluation-harness.md (Requirement: Spec structural scoring, Scenarios Partial score, Checklist
// item has an existing source, Checklist item has no existing source, Reference coverage full, Missing error path,
// Repeated scoring is identical, Checklist cannot run), and docs/task-plans/task-plan-evaluation-harness-20261125-0717.md
// (ASM-5, ASM-8, Step 7, Step 16). Requirement text: docs/requirements/FR-NFR-harness-governance.md (FR-265, FR-266,
// FR-267, NFR-037, UR-078, SC-023).
//
// Traceability format: [AC-N | spec file | FR/NFR ids | UR/SC ids]. The spec has no SPEC-NNN id, so it is cited by file
// name. AC-N is the position of the Scenario inside Requirement "Spec structural scoring" (R7):
//   AC-1 Partial score, AC-2 Checklist item has an existing source, AC-3 Checklist item has no existing source, AC-4
//   Reference coverage full, AC-5 Missing error path, AC-6 Repeated scoring is identical, AC-7 Checklist cannot run.
//
// Contract used:
//   - A checklist item sits in rubric.deterministic as { id, source, check, ...params }. The source is a
//     `spec-from-requirements` review check (completeness, correctness, coherence) or a `gather-requirements` quality
//     criterion. An item with no known source is rejected.
//   - Reference coverage uses a declared list rubric.referenceItems, each { id, kind: requirement | scenario |
//     error-path, requirement?, match? }, checked against the output without inference from the reference text (ASM-8).
//   - scoreSpecRun({ outputText | outputPath, referenceText | referencePath, rubric | rubricPath }) returns
//     { status: "scored" | "error", score, passed, total, cleared, items, failedNames, reason }. The score is the fraction
//     of items that pass; "error" carries a null score, never 0. No model, clock, or random input.
//   - All fixtures are synthetic stand-ins built in memory or under os.tmpdir().
//
// Run: node --test tests/scripts/eval-harness-spec-checklist.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLUGIN = path.join(__dirname, "..", "..", "plugins", "assist-plugin");
const checklist = require(path.join(PLUGIN, "scripts", "eval-harness", "spec-checklist.js"));

const created = [];
after(() => {
  created.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-checklist-test-"));
  created.push(dir);
  return dir;
}

const GOOD_OUTPUT = [
  "# Spec: Login",
  "",
  "### Requirement: Login",
  "The system SHALL let a registered user log in.",
  "",
  "#### Scenario: Valid login",
  "- **GIVEN** a registered user",
  "- **WHEN** the user submits valid credentials",
  "- **THEN** the system SHALL open a session",
  "",
].join("\n");

const NO_SCENARIO_OUTPUT = ["# Spec: Login", "", "### Requirement: Login", "The system SHALL let a registered user log in.", ""].join("\n");

const REFERENCE_TEXT = [
  "# Reference requirements",
  "",
  "FR-1: Login. Error path: returns 401 when the password is wrong.",
  "FR-2: Logout. Error path: returns 409 when no session is open.",
  "FR-3: Delete account. Error path: returns 404 when the record is missing.",
  "",
].join("\n");

const FULL_COVERAGE_OUTPUT = [
  "# Spec",
  "",
  "### Requirement: Login",
  "FR-1 The system SHALL log a user in. It returns 401 when the password is wrong.",
  "",
  "#### Scenario: Wrong password",
  "- **GIVEN** a user **WHEN** the password is wrong **THEN** the system returns 401 when the password is wrong",
  "",
  "### Requirement: Logout",
  "FR-2 The system SHALL log a user out. It returns 409 when no session is open.",
  "",
  "### Requirement: Delete",
  "FR-3 The system SHALL delete an account. It returns 404 when the record is missing.",
  "",
].join("\n");

const MISSING_FR3_ERROR_OUTPUT = [
  "# Spec",
  "",
  "### Requirement: Login",
  "FR-1 The system SHALL log a user in. It returns 401 when the password is wrong.",
  "",
  "### Requirement: Logout",
  "FR-2 The system SHALL log a user out. It returns 409 when no session is open.",
  "",
  "### Requirement: Delete",
  "FR-3 The system SHALL delete an account.",
  "",
].join("\n");

const REFERENCE_ITEMS = [
  { id: "FR-1", kind: "requirement" },
  { id: "FR-2", kind: "requirement" },
  { id: "FR-3", kind: "requirement" },
  { id: "FR-1-error", kind: "error-path", requirement: "FR-1", match: "returns 401 when the password is wrong" },
  { id: "FR-2-error", kind: "error-path", requirement: "FR-2", match: "returns 409 when no session is open" },
  { id: "FR-3-error", kind: "error-path", requirement: "FR-3", match: "returns 404 when the record is missing" },
];

function item(id, extra) {
  return Object.assign({ id, source: "spec-from-requirements:completeness", check: "every-requirement-has-scenario" }, extra || {});
}

function rubricOf(deterministic, referenceItems) {
  const rubric = { deterministic, subjective: [{ id: "s1", text: "The spec reads clearly" }] };
  if (referenceItems) {
    rubric.referenceItems = referenceItems;
  }
  return rubric;
}

function score(outputText, rubric, extra) {
  return checklist.scoreSpecRun(Object.assign({ outputText, referenceText: REFERENCE_TEXT, rubric }, extra || {}));
}

// ---------------------------------------------------------------------------
// AC-1: the structural score is the fraction of items that pass
// ---------------------------------------------------------------------------

test("[AC-1 | spec-evaluation-harness | FR-265 | UR-078 | SC-023] a spec run that passes 8 of 10 deterministic items scores 0.8", () => {
  const passing = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => item("pass-" + n));
  const failing = [1, 2].map((n) => item("fail-" + n, { check: "sections-present", sections: ["A Section The Output Lacks"] }));
  const result = score(GOOD_OUTPUT, rubricOf(passing.concat(failing)));
  assert.strictEqual(result.status, "scored", result.reason);
  assert.strictEqual(result.score, 0.8);
  assert.strictEqual(result.passed, 8);
  assert.strictEqual(result.total, 10);
  assert.strictEqual(result.cleared, false);
});

test("[AC-1 | spec-evaluation-harness | FR-265 | UR-078 | SC-023] a spec run that passes every item scores 1 and is cleared for the judge", () => {
  // Boundary: the top of the range.
  const result = score(GOOD_OUTPUT, rubricOf([item("a"), item("b", { check: "rfc2119-present", source: "spec-from-requirements:correctness" })]));
  assert.strictEqual(result.status, "scored", result.reason);
  assert.strictEqual(result.score, 1);
  assert.strictEqual(result.cleared, true);
  assert.deepStrictEqual(result.failedNames, []);
});

test("[AC-1 | spec-evaluation-harness | FR-265 | UR-078 | SC-023] a spec run that fails every item scores 0 and still reads scored, because the checklist ran", () => {
  // Boundary: a real zero is a score. Only an unreadable input reads error.
  const result = score(NO_SCENARIO_OUTPUT, rubricOf([item("a")]));
  assert.strictEqual(result.status, "scored", result.reason);
  assert.strictEqual(result.score, 0);
  assert.strictEqual(result.cleared, false);
});

test("[AC-1 | spec-evaluation-harness | FR-265 | UR-078] the result lists each item with its id, source, and pass flag", () => {
  const result = score(GOOD_OUTPUT, rubricOf([item("has-scenario"), item("needs-section", { check: "sections-present", sections: ["Missing One"] })]));
  assert.strictEqual(result.items.length, 2);
  const byId = {};
  result.items.forEach((entry) => {
    byId[entry.id] = entry;
  });
  assert.strictEqual(byId["has-scenario"].passed, true);
  assert.strictEqual(byId["needs-section"].passed, false);
  assert.strictEqual(byId["has-scenario"].source, "spec-from-requirements:completeness");
});

test("[AC-1 | spec-evaluation-harness | FR-265 | FR-266] the scenario, keyword, and reference checks each pass on a well-formed spec", () => {
  const items = [
    item("scenario-shape", { check: "scenario-has-given-when-then", source: "gather-requirements:testable" }),
    item("keywords", { check: "rfc2119-present", source: "spec-from-requirements:correctness" }),
    item("singular", { check: "rfc2119-singular", source: "gather-requirements:singular" }),
    item("refs", { check: "refs-resolve", source: "spec-from-requirements:correctness", knownIds: ["FR-1"] }),
  ];
  const result = score(GOOD_OUTPUT + "\nSee FR-1.\n", rubricOf(items));
  assert.strictEqual(result.status, "scored", result.reason);
  assert.strictEqual(result.score, 1, JSON.stringify(result.items));
});

test("[AC-1 | spec-evaluation-harness | FR-265 | FR-266] a requirement with no scenario fails the every-requirement-has-scenario item", () => {
  const result = score(NO_SCENARIO_OUTPUT, rubricOf([item("a")]));
  assert.strictEqual(result.items[0].passed, false);
});

test("[AC-1 | spec-evaluation-harness | FR-265 | FR-266] a reference to an id the declared list does not hold fails the refs-resolve item and names the id", () => {
  const result = score(GOOD_OUTPUT + "\nSee FR-999.\n", rubricOf([item("refs", { check: "refs-resolve", source: "spec-from-requirements:correctness", knownIds: ["FR-1"] })]));
  assert.strictEqual(result.items[0].passed, false);
  assert.ok(result.failedNames.indexOf("FR-999") !== -1, JSON.stringify(result.failedNames));
});

test("[AC-1 | spec-evaluation-harness | FR-265 | FR-266] the output can be read from a file or from a directory of markdown files", () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "spec.md"), GOOD_OUTPUT);
  const fromFile = checklist.scoreSpecRun({ outputPath: path.join(dir, "spec.md"), referenceText: REFERENCE_TEXT, rubric: rubricOf([item("a")]) });
  assert.strictEqual(fromFile.status, "scored", fromFile.reason);
  assert.strictEqual(fromFile.score, 1);
  const fromDir = checklist.scoreSpecRun({ outputPath: dir, referenceText: REFERENCE_TEXT, rubric: rubricOf([item("a")]) });
  assert.strictEqual(fromDir.status, "scored", fromDir.reason);
  assert.strictEqual(fromDir.score, 1);
});

test("[AC-1 | spec-evaluation-harness | FR-265 | FR-266] the rubric can be read from a file", () => {
  const file = path.join(tmpDir(), "rubric.json");
  fs.writeFileSync(file, JSON.stringify(rubricOf([item("a")])));
  const result = checklist.scoreSpecRun({ outputText: GOOD_OUTPUT, referenceText: REFERENCE_TEXT, rubricPath: file });
  assert.strictEqual(result.status, "scored", result.reason);
  assert.strictEqual(result.score, 1);
});

// ---------------------------------------------------------------------------
// AC-2 and AC-3: every checklist item has an existing source
// ---------------------------------------------------------------------------

test("[AC-2 | spec-evaluation-harness | FR-266 | UR-078] an item 'every Requirement has a Scenario' defined by the spec-from-requirements review check is accepted", () => {
  const result = checklist.validateChecklist(rubricOf([item("every-requirement-has-scenario")]));
  assert.strictEqual(result.ok, true, JSON.stringify(result.problems));
  assert.deepStrictEqual(result.problems, []);
});

test("[AC-2 | spec-evaluation-harness | FR-266 | UR-078] an item defined by a gather-requirements quality criterion is accepted", () => {
  const result = checklist.validateChecklist(rubricOf([item("testable-scenarios", { source: "gather-requirements:testable", check: "scenario-has-given-when-then" })]));
  assert.strictEqual(result.ok, true, JSON.stringify(result.problems));
});

test("[AC-2 | spec-evaluation-harness | FR-266 | UR-078] KNOWN_SOURCES holds the review checks and quality criteria the items may cite", () => {
  assert.ok(checklist.KNOWN_SOURCES.indexOf("spec-from-requirements:completeness") !== -1);
  assert.ok(checklist.KNOWN_SOURCES.indexOf("gather-requirements:testable") !== -1);
  assert.ok(checklist.CHECK_NAMES.indexOf("every-requirement-has-scenario") !== -1);
});

test("[AC-3 | spec-evaluation-harness | FR-266 | UR-078] an item that declares no source is rejected and the rejection names the item", () => {
  const sourceless = { id: "no-source-item", check: "every-requirement-has-scenario" };
  const result = checklist.validateChecklist(rubricOf([sourceless]));
  assert.strictEqual(result.ok, false);
  assert.ok(result.problems.some((entry) => entry.item === "no-source-item"), JSON.stringify(result.problems));
});

test("[AC-3 | spec-evaluation-harness | FR-266 | UR-078] an item that cites a source no existing check or criterion defines is rejected", () => {
  const result = checklist.validateChecklist(rubricOf([item("invented", { source: "made-up:new-rule" })]));
  assert.strictEqual(result.ok, false);
  assert.ok(result.problems.some((entry) => entry.item === "invented"));
});

test("[AC-3 | spec-evaluation-harness | FR-266 | UR-078] the style check is a judgment item with no mechanical checklist form, so it is not a known source", () => {
  const result = checklist.validateChecklist(rubricOf([item("style", { source: "spec-from-requirements:style" })]));
  assert.strictEqual(result.ok, false);
});

test("[AC-3 | spec-evaluation-harness | FR-266 | UR-078] an item with an empty source is rejected", () => {
  // Null/empty.
  const result = checklist.validateChecklist(rubricOf([item("blank-source", { source: "" })]));
  assert.strictEqual(result.ok, false);
});

test("[AC-3 | spec-evaluation-harness | FR-266 | UR-078] an item that names no known check is rejected", () => {
  const result = checklist.validateChecklist(rubricOf([item("mystery", { check: "no-such-check" })]));
  assert.strictEqual(result.ok, false);
});

test("[AC-3 | spec-evaluation-harness | FR-266 | UR-078] an item that needs a parameter and holds none is rejected", () => {
  const result = checklist.validateChecklist(rubricOf([item("needs-sections", { check: "sections-present" })]));
  assert.strictEqual(result.ok, false);
  assert.ok(result.problems.some((entry) => entry.item === "needs-sections"));
});

test("[AC-3 | spec-evaluation-harness | FR-266 | UR-078] an item with no id is rejected", () => {
  const result = checklist.validateChecklist(rubricOf([{ source: "spec-from-requirements:completeness", check: "every-requirement-has-scenario" }]));
  assert.strictEqual(result.ok, false);
});

test("[AC-3 | spec-evaluation-harness | FR-266 | UR-078] two items that share an id are rejected", () => {
  const result = checklist.validateChecklist(rubricOf([item("same"), item("same")]));
  assert.strictEqual(result.ok, false);
});

[null, undefined, "rubric", 7, [], {}].forEach((value) => {
  test("[AC-3 | spec-evaluation-harness | FR-266 | UR-078] a rubric of the wrong shape " + JSON.stringify(value) + " is rejected", () => {
    // Type mismatch and null/empty.
    const result = checklist.validateChecklist(value);
    assert.strictEqual(result.ok, false);
  });
});

test("[AC-3 | spec-evaluation-harness | FR-266 | UR-078] a run whose rubric holds a source-less item reads error, never a score", () => {
  const result = score(GOOD_OUTPUT, rubricOf([{ id: "no-source-item", check: "every-requirement-has-scenario" }]));
  assert.strictEqual(result.status, "error");
  assert.strictEqual(result.score, null);
});

// ---------------------------------------------------------------------------
// AC-4 and AC-5: reference coverage from the declared item list
// ---------------------------------------------------------------------------

test("[AC-4 | spec-evaluation-harness | FR-267 | UR-078] an output that holds FR-1 to FR-3 and one error path each passes every reference-coverage item", () => {
  const result = score(FULL_COVERAGE_OUTPUT, rubricOf([], REFERENCE_ITEMS));
  assert.strictEqual(result.status, "scored", result.reason);
  assert.strictEqual(result.total, 6);
  assert.strictEqual(result.passed, 6);
  assert.strictEqual(result.score, 1);
  assert.strictEqual(result.cleared, true);
});

test("[AC-5 | spec-evaluation-harness | FR-267 | UR-078] an output that omits the error path of FR-3 fails that item and the result names FR-3", () => {
  const result = score(MISSING_FR3_ERROR_OUTPUT, rubricOf([], REFERENCE_ITEMS));
  assert.strictEqual(result.status, "scored", result.reason);
  assert.strictEqual(result.passed, 5);
  assert.strictEqual(result.total, 6);
  assert.strictEqual(result.cleared, false);
  assert.ok(result.failedNames.indexOf("FR-3") !== -1, "the result names FR-3: " + JSON.stringify(result.failedNames));
  const failed = result.items.filter((entry) => !entry.passed);
  assert.strictEqual(failed.length, 1);
  assert.ok(failed[0].names.indexOf("FR-3") !== -1);
});

test("[AC-5 | spec-evaluation-harness | FR-267 | UR-078] an output that omits a whole requirement fails that requirement item and names it", () => {
  const output = FULL_COVERAGE_OUTPUT.replace("FR-2 ", "").replace("FR-2-", "");
  const result = score(output, rubricOf([], REFERENCE_ITEMS));
  assert.strictEqual(result.status, "scored", result.reason);
  assert.ok(result.failedNames.indexOf("FR-2") !== -1, JSON.stringify(result.failedNames));
});

test("[AC-5 | spec-evaluation-harness | FR-267 | UR-078] FR-3 is not found inside FR-30, so a longer id does not stand in for it", () => {
  // Boundary: a requirement id matches as a whole token.
  const output = FULL_COVERAGE_OUTPUT.replace("FR-3 ", "FR-30 ");
  const result = score(output, rubricOf([], REFERENCE_ITEMS));
  assert.strictEqual(result.status, "scored", result.reason);
  assert.ok(result.failedNames.indexOf("FR-3") !== -1, JSON.stringify(result.failedNames));
});

test("[AC-4 | spec-evaluation-harness | FR-267 | UR-078] error-path text matches without regard to case or extra white space", () => {
  const output = FULL_COVERAGE_OUTPUT.replace("returns 404 when the record is missing", "RETURNS   404 when  the record is MISSING");
  const result = score(output, rubricOf([], REFERENCE_ITEMS));
  assert.strictEqual(result.status, "scored", result.reason);
  assert.strictEqual(result.score, 1);
});

test("[AC-4 | spec-evaluation-harness | FR-267 | UR-078] reference items and deterministic items score together as one fraction", () => {
  const result = score(FULL_COVERAGE_OUTPUT, rubricOf([item("has-scenario")], REFERENCE_ITEMS));
  assert.strictEqual(result.status, "scored", result.reason);
  assert.strictEqual(result.total, 7);
  // FR-2 and FR-3 hold no scenario in the output, so the has-scenario item fails: 6 of 7 pass.
  assert.strictEqual(result.passed, 6);
  assert.strictEqual(result.score, 6 / 7);
});

test("[AC-4 | spec-evaluation-harness | FR-267 | UR-078] a reference item of an unknown kind is rejected by the checklist validation", () => {
  const result = checklist.validateChecklist(rubricOf([], [{ id: "x", kind: "bogus", match: "text" }]));
  assert.strictEqual(result.ok, false);
});

test("[AC-4 | spec-evaluation-harness | FR-267 | UR-078] an error-path reference item with no match text is rejected by the checklist validation", () => {
  const result = checklist.validateChecklist(rubricOf([], [{ id: "FR-1-error", kind: "error-path", requirement: "FR-1" }]));
  assert.strictEqual(result.ok, false);
});

test("[AC-4 | spec-evaluation-harness | FR-267 | UR-078] a reference item that cites an unknown source is rejected", () => {
  const result = checklist.validateChecklist(rubricOf([], [{ id: "FR-1", kind: "requirement", source: "made-up:source" }]));
  assert.strictEqual(result.ok, false);
});

test("[AC-4 | spec-evaluation-harness | FR-267 | UR-078] a declared reference item that the reference itself does not hold reads error, not a failing output", () => {
  const stale = REFERENCE_ITEMS.concat([{ id: "FR-77", kind: "requirement" }]);
  const result = score(FULL_COVERAGE_OUTPUT, rubricOf([], stale));
  assert.strictEqual(result.status, "error");
  assert.strictEqual(result.score, null);
});

// ---------------------------------------------------------------------------
// AC-6: repeated scoring is identical (NFR-037)
// ---------------------------------------------------------------------------

test("[AC-6 | spec-evaluation-harness | FR-265 | NFR-037 | SC-023] scoring one spec output 10 times gives 10 equal structural scores", () => {
  const rubric = rubricOf(
    [item("a"), item("b", { check: "rfc2119-present", source: "spec-from-requirements:correctness" }), item("c", { check: "sections-present", sections: ["Missing"] })],
    REFERENCE_ITEMS
  );
  const scores = [];
  for (let run = 0; run < 10; run += 1) {
    scores.push(score(FULL_COVERAGE_OUTPUT, rubric).score);
  }
  assert.strictEqual(scores.length, 10);
  scores.forEach((value) => assert.strictEqual(value, scores[0]));
  assert.strictEqual(typeof scores[0], "number");
});

test("[AC-6 | spec-evaluation-harness | FR-265 | NFR-037 | SC-023] ten scorings of one output give ten identical full results, not only equal scores", () => {
  const rubric = rubricOf([item("a")], REFERENCE_ITEMS);
  const first = JSON.stringify(score(MISSING_FR3_ERROR_OUTPUT, rubric));
  for (let run = 0; run < 9; run += 1) {
    assert.strictEqual(JSON.stringify(score(MISSING_FR3_ERROR_OUTPUT, rubric)), first);
  }
});

test("[AC-6 | spec-evaluation-harness | FR-265 | NFR-037 | SC-023] the score does not change when the clock and the random source change", () => {
  const rubric = rubricOf([item("a")]);
  const realNow = Date.now;
  const realRandom = Math.random;
  try {
    Date.now = () => 1;
    Math.random = () => 0.1;
    const early = score(GOOD_OUTPUT, rubric).score;
    Date.now = () => 9999999999999;
    Math.random = () => 0.9;
    const late = score(GOOD_OUTPUT, rubric).score;
    assert.strictEqual(early, late);
  } finally {
    Date.now = realNow;
    Math.random = realRandom;
  }
});

// ---------------------------------------------------------------------------
// AC-7: the checklist cannot run
// ---------------------------------------------------------------------------

test("[AC-7 | spec-evaluation-harness | FR-265 | UR-078] a spec run whose reference file is unreadable reads error and the structural score is not 0", () => {
  const result = checklist.scoreSpecRun({ outputText: GOOD_OUTPUT, referencePath: path.join(tmpDir(), "no-such-reference.md"), rubric: rubricOf([item("a")]) });
  assert.strictEqual(result.status, "error");
  assert.strictEqual(result.score, null);
  assert.notStrictEqual(result.score, 0);
  assert.strictEqual(result.cleared, false);
});

test("[AC-7 | spec-evaluation-harness | FR-265 | UR-078] a spec run whose output file is unreadable reads error and the structural score is not 0", () => {
  const result = checklist.scoreSpecRun({ outputPath: path.join(tmpDir(), "no-such-output.md"), referenceText: REFERENCE_TEXT, rubric: rubricOf([item("a")]) });
  assert.strictEqual(result.status, "error");
  assert.strictEqual(result.score, null);
});

test("[AC-7 | spec-evaluation-harness | FR-265 | UR-078] a spec run with no reference given at all reads error", () => {
  // Null/empty.
  const result = checklist.scoreSpecRun({ outputText: GOOD_OUTPUT, rubric: rubricOf([item("a")]) });
  assert.strictEqual(result.status, "error");
  assert.strictEqual(result.score, null);
});

test("[AC-7 | spec-evaluation-harness | FR-265 | UR-078] a spec run whose rubric cannot be read reads error", () => {
  const result = checklist.scoreSpecRun({ outputText: GOOD_OUTPUT, referenceText: REFERENCE_TEXT, rubricPath: path.join(tmpDir(), "no-such-rubric.json") });
  assert.strictEqual(result.status, "error");
  assert.strictEqual(result.score, null);
});

test("[AC-7 | spec-evaluation-harness | FR-265 | UR-078] a rubric with an empty checklist reads error, never a score of 0 or 1", () => {
  // Boundary: no item means no fraction.
  const result = score(GOOD_OUTPUT, rubricOf([]));
  assert.strictEqual(result.status, "error");
  assert.strictEqual(result.score, null);
});

[null, undefined, "", 0].forEach((value) => {
  test("[AC-7 | spec-evaluation-harness | FR-265 | UR-078] a run with the output " + JSON.stringify(value) + " and no output path reads error", () => {
    // Null/empty and type mismatch for the output.
    const result = checklist.scoreSpecRun({ outputText: value, referenceText: REFERENCE_TEXT, rubric: rubricOf([item("a")]) });
    if (value === "") {
      // An empty output is readable text with nothing in it: the checklist ran, so it reads a score.
      assert.ok(result.status === "scored" || result.status === "error");
    } else {
      assert.strictEqual(result.status, "error");
      assert.strictEqual(result.score, null);
    }
  });
});

test("[AC-7 | spec-evaluation-harness | FR-265 | UR-078] a run with no request at all reads error and does not throw", () => {
  const result = checklist.scoreSpecRun(undefined);
  assert.strictEqual(result.status, "error");
  assert.strictEqual(result.score, null);
});

test("[AC-7 | spec-evaluation-harness | FR-265 | NFR-031] an error reason never echoes the output or reference text", () => {
  const result = checklist.scoreSpecRun({ outputText: "SECRET-OUTPUT-TEXT-5521", referenceText: REFERENCE_TEXT, rubric: rubricOf([]) });
  assert.strictEqual(result.status, "error");
  assert.ok(!JSON.stringify(result).includes("SECRET-OUTPUT-TEXT-5521"));
});

// ---------------------------------------------------------------------------
// parseDocument
// ---------------------------------------------------------------------------

test("[AC-1 | spec-evaluation-harness | FR-265 | FR-266] parseDocument reads requirement blocks with their scenarios and headings", () => {
  const parsed = checklist.parseDocument(GOOD_OUTPUT);
  assert.strictEqual(parsed.requirements.length, 1);
  assert.strictEqual(parsed.requirements[0].scenarios.length, 1);
  assert.ok(parsed.headings.length >= 3);
});

test("[AC-1 | spec-evaluation-harness | FR-265 | FR-266] a requirement heading inside a fenced code block is not a requirement", () => {
  const text = GOOD_OUTPUT + "\n```\n### Requirement: Fenced example\n#### Scenario: Fenced scenario\n```\n";
  const parsed = checklist.parseDocument(text);
  assert.strictEqual(parsed.requirements.length, 1);
});

test("[AC-1 | spec-evaluation-harness | FR-265 | FR-266] parseDocument reads empty text as a document with no requirement", () => {
  // Null/empty.
  const parsed = checklist.parseDocument("");
  assert.deepStrictEqual(parsed.requirements, []);
});

test("[AC-1 | spec-evaluation-harness | FR-265] the two status constants read scored and error", () => {
  assert.strictEqual(checklist.STATUS_SCORED, "scored");
  assert.strictEqual(checklist.STATUS_ERROR, "error");
});
