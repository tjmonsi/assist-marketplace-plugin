// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for pass@1 aggregation and flaky-test reporting in the evaluation harness (Group A, Step 16):
// plugins/assist-plugin/scripts/eval-harness/aggregate.js (`passAtOne`, `validatePassAtOne`, `flakyTests`, `aggregateCase`,
// `runCountFromConfig`, `HARNESS_VERSION`, `KNOWN_STATUSES`).
//
// Sources: specs/spec-evaluation-harness.md (Requirement: Coding run scoring by execution and pass@1, Scenarios Three of
// five pass, No completed run, Result without a harness version; Requirement: Flaky hidden-suite tests reported, not
// silenced, Scenario Flaky test flagged), and docs/task-plans/task-plan-evaluation-harness-20261125-0717.md (ASM-3, ASM-5,
// Step 6, Step 16). Requirement text: docs/requirements/FR-NFR-harness-governance.md (FR-271, FR-272, FR-287, UR-078,
// UR-080, SC-023).
//
// Traceability format: [AC-N | spec file | FR/NFR ids | UR/SC ids]. The spec has no SPEC-NNN id, so it is cited by file
// name. AC-N is the position of the Scenario inside its Requirement block:
//   Coding run scoring by execution and pass@1 (R5): AC-4 Three of five pass, AC-5 No completed run, AC-6 Result
//   without a harness version.
//   Flaky hidden-suite tests reported, not silenced (R6): AC-1 Flaky test flagged.
//
// Contract used:
//   - passAtOne(runs) returns { value, k, c, harnessVersion, ... }: k counts completed runs (pass or fail), c counts
//     passes, value is c / k, and a not-run or error run counts in neither. With k = 0 the value is null (absent), never 0.
//     k, c, and the harness version sit beside every value.
//   - validatePassAtOne(entry) returns { ok, errors: [{ field, message }] }: a value with no harness version fails.
//   - flakyTests(runs) compares per-test results across repeated runs of one candidate: a test whose status differs is
//     listed as flaky and stays in the result; nothing is skipped or retried.
//
// Run: node --test tests/scripts/eval-harness-aggregate.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLUGIN = path.join(__dirname, "..", "..", "plugins", "assist-plugin");
const aggregate = require(path.join(PLUGIN, "scripts", "eval-harness", "aggregate.js"));

const created = [];
after(() => {
  created.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function statuses(list) {
  return list.map((status) => ({ status }));
}

// ---------------------------------------------------------------------------
// pass@1 = c / k
// ---------------------------------------------------------------------------

test("[AC-4 | spec-evaluation-harness | FR-271 | FR-272 | UR-078 | SC-023] a case run 5 times with 3 passes reads 0.6 and states k = 5, c = 3, and the harness version", () => {
  const result = aggregate.passAtOne(statuses(["pass", "fail", "pass", "fail", "pass"]));
  assert.strictEqual(result.value, 0.6);
  assert.strictEqual(result.k, 5);
  assert.strictEqual(result.c, 3);
  assert.strictEqual(typeof result.harnessVersion, "string");
  assert.strictEqual(result.harnessVersion, aggregate.HARNESS_VERSION);
});

test("[AC-4 | spec-evaluation-harness | FR-271 | UR-078 | SC-023] HARNESS_VERSION is a non-empty text value", () => {
  assert.strictEqual(typeof aggregate.HARNESS_VERSION, "string");
  assert.ok(aggregate.HARNESS_VERSION.trim() !== "");
});

test("[AC-4 | spec-evaluation-harness | FR-271 | UR-078] a case whose every run passes reads 1 with k = c", () => {
  // Boundary: the top of the range.
  const result = aggregate.passAtOne(statuses(["pass", "pass", "pass"]));
  assert.strictEqual(result.value, 1);
  assert.strictEqual(result.k, 3);
  assert.strictEqual(result.c, 3);
});

test("[AC-4 | spec-evaluation-harness | FR-271 | UR-078] a case whose every completed run fails reads 0 with k above 0", () => {
  // Boundary: a real zero is not an absent value.
  const result = aggregate.passAtOne(statuses(["fail", "fail"]));
  assert.strictEqual(result.value, 0);
  assert.strictEqual(result.k, 2);
  assert.strictEqual(result.c, 0);
});

test("[AC-4 | spec-evaluation-harness | FR-271 | UR-078] a single passing run reads 1 with k = 1", () => {
  // Boundary: k at its smallest completed value.
  const result = aggregate.passAtOne(statuses(["pass"]));
  assert.strictEqual(result.value, 1);
  assert.strictEqual(result.k, 1);
});

test("[AC-4 | spec-evaluation-harness | FR-264 | FR-271 | UR-078] not-run and error runs count in neither c nor k", () => {
  const result = aggregate.passAtOne(statuses(["pass", "pass", "fail", "not-run", "error", "not-run"]));
  assert.strictEqual(result.k, 3);
  assert.strictEqual(result.c, 2);
  assert.strictEqual(result.value, 2 / 3);
});

test("[AC-5 | spec-evaluation-harness | FR-271 | UR-078 | SC-023] a case whose every run read not-run reads absent, never 0", () => {
  const result = aggregate.passAtOne(statuses(["not-run", "not-run", "not-run", "not-run", "not-run"]));
  assert.strictEqual(result.value, null);
  assert.notStrictEqual(result.value, 0);
  assert.strictEqual(result.k, 0);
  assert.strictEqual(result.c, 0);
});

test("[AC-5 | spec-evaluation-harness | FR-271 | UR-078 | SC-023] a case whose every run read error reads absent, never 0", () => {
  const result = aggregate.passAtOne(statuses(["error", "error"]));
  assert.strictEqual(result.value, null);
  assert.strictEqual(result.k, 0);
});

test("[AC-5 | spec-evaluation-harness | FR-271 | UR-078] a case with no run at all reads absent and the division never runs", () => {
  // Null/empty.
  const result = aggregate.passAtOne([]);
  assert.strictEqual(result.value, null);
  assert.strictEqual(result.k, 0);
  assert.ok(!Number.isNaN(result.value), "an empty case must not read NaN");
});

[null, undefined, "pass", 7, {}].forEach((value) => {
  test("[AC-5 | spec-evaluation-harness | FR-271 | UR-078] a run list of the wrong type " + JSON.stringify(value) + " reads absent and does not throw", () => {
    // Type mismatch.
    const result = aggregate.passAtOne(value);
    assert.strictEqual(result.value, null);
    assert.strictEqual(result.k, 0);
  });
});

test("[AC-5 | spec-evaluation-harness | FR-271 | UR-078] a run with an unknown status counts in neither c nor k", () => {
  const result = aggregate.passAtOne(statuses(["pass", "bogus", "skipped"]));
  assert.strictEqual(result.k, 1);
  assert.strictEqual(result.c, 1);
});

test("[AC-4 | spec-evaluation-harness | FR-272 | UR-078] a harness version passed in is the one stated beside the value", () => {
  const result = aggregate.passAtOne(statuses(["pass"]), { harnessVersion: "9.9.9-test" });
  assert.strictEqual(result.harnessVersion, "9.9.9-test");
});

test("[AC-4 | spec-evaluation-harness | FR-271 | UR-078] KNOWN_STATUSES lists pass, fail, not-run, and error", () => {
  assert.deepStrictEqual(aggregate.KNOWN_STATUSES.slice().sort(), ["error", "fail", "not-run", "pass"]);
});

// ---------------------------------------------------------------------------
// AC-6: a value with no harness version fails validation
// ---------------------------------------------------------------------------

test("[AC-6 | spec-evaluation-harness | FR-272 | UR-078] a pass@1 value with k, c, and a harness version passes validation", () => {
  const entry = aggregate.passAtOne(statuses(["pass", "fail", "pass", "fail", "pass"]));
  const result = aggregate.validatePassAtOne(entry);
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.deepStrictEqual(result.errors, []);
});

test("[AC-6 | spec-evaluation-harness | FR-272 | UR-078] a pass@1 value with no harness version fails validation and names the field", () => {
  const result = aggregate.validatePassAtOne({ value: 0.6, k: 5, c: 3 });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.field === "harnessVersion"), JSON.stringify(result.errors));
});

test("[AC-6 | spec-evaluation-harness | FR-272 | UR-078] a pass@1 value with an empty harness version fails validation", () => {
  // Null/empty.
  const result = aggregate.validatePassAtOne({ value: 0.6, k: 5, c: 3, harnessVersion: "  " });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.field === "harnessVersion"));
});

test("[AC-6 | spec-evaluation-harness | FR-272 | UR-078] a pass@1 value that states no k fails validation and names k", () => {
  const result = aggregate.validatePassAtOne({ value: 0.6, c: 3, harnessVersion: "1.0.0" });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.field === "k"));
});

test("[AC-6 | spec-evaluation-harness | FR-272 | UR-078] a pass@1 value that states no c fails validation and names c", () => {
  const result = aggregate.validatePassAtOne({ value: 0.6, k: 5, harnessVersion: "1.0.0" });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.field === "c"));
});

test("[AC-6 | spec-evaluation-harness | FR-271 | UR-078] a pass@1 value that is not c divided by k fails validation and names the value", () => {
  const result = aggregate.validatePassAtOne({ value: 0.9, k: 5, c: 3, harnessVersion: "1.0.0" });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.field === "value"));
});

test("[AC-6 | spec-evaluation-harness | FR-271 | UR-078] a pass@1 value of 0 with k = 0 fails validation, because an empty case reads absent", () => {
  const result = aggregate.validatePassAtOne({ value: 0, k: 0, c: 0, harnessVersion: "1.0.0" });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.field === "value"));
});

test("[AC-5 | spec-evaluation-harness | FR-271 | UR-078] an absent pass@1 value with k = 0 and a harness version passes validation", () => {
  const result = aggregate.validatePassAtOne({ value: null, k: 0, c: 0, harnessVersion: "1.0.0" });
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
});

test("[AC-6 | spec-evaluation-harness | FR-271 | UR-078] a pass@1 value with more passes than completed runs fails validation", () => {
  // Boundary: c above k.
  const result = aggregate.validatePassAtOne({ value: 1, k: 2, c: 3, harnessVersion: "1.0.0" });
  assert.strictEqual(result.ok, false);
});

[null, undefined, "0.6", 0.6, []].forEach((value) => {
  test("[AC-6 | spec-evaluation-harness | FR-272 | UR-078] the non-object pass@1 entry " + JSON.stringify(value) + " fails validation", () => {
    // Type mismatch.
    const result = aggregate.validatePassAtOne(value);
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.length >= 1);
  });
});

// ---------------------------------------------------------------------------
// Flaky hidden-suite tests (R6 AC-1)
// ---------------------------------------------------------------------------

function parsedRun(status, tests) {
  return { status, testsParsed: true, tests };
}

test("[AC-1 | spec-evaluation-harness | FR-287 | UR-080] a hidden test that passes on run 1 and fails on run 2 for one candidate is listed as flaky", () => {
  const run1 = parsedRun("pass", [
    { name: "[AC-1 | spec-demo | FR-1] unstable", status: "pass" },
    { name: "[AC-2 | spec-demo | FR-1] steady", status: "pass" },
  ]);
  const run2 = parsedRun("fail", [
    { name: "[AC-1 | spec-demo | FR-1] unstable", status: "fail" },
    { name: "[AC-2 | spec-demo | FR-1] steady", status: "pass" },
  ]);
  const report = aggregate.flakyTests([run1, run2]);
  assert.deepStrictEqual(report.flaky.map((entry) => entry.name), ["[AC-1 | spec-demo | FR-1] unstable"]);
  assert.strictEqual(report.comparedRuns, 2);
});

test("[AC-1 | spec-evaluation-harness | FR-287 | UR-080] a flaky test still counts in the suite result and is not skipped or retried", () => {
  const run1 = parsedRun("pass", [{ name: "t-unstable", status: "pass" }, { name: "t-steady", status: "pass" }]);
  const run2 = parsedRun("fail", [{ name: "t-unstable", status: "fail" }, { name: "t-steady", status: "pass" }]);
  const report = aggregate.flakyTests([run1, run2]);
  const names = report.tests.map((entry) => entry.name);
  assert.deepStrictEqual(names, ["t-unstable", "t-steady"], "both tests stay in the result");
  const unstable = report.tests.find((entry) => entry.name === "t-unstable");
  assert.strictEqual(unstable.flaky, true);
  assert.strictEqual(unstable.runs, 2, "the flaky test still counts in every run");
  const steady = report.tests.find((entry) => entry.name === "t-steady");
  assert.strictEqual(steady.flaky, false);
});

test("[AC-1 | spec-evaluation-harness | FR-287 | UR-080] a case's pass@1 still counts both runs when one of its tests is flaky", () => {
  const run1 = parsedRun("pass", [{ name: "t", status: "pass" }]);
  const run2 = parsedRun("fail", [{ name: "t", status: "fail" }]);
  const summary = aggregate.aggregateCase([run1, run2]);
  assert.strictEqual(summary.passAtOne.k, 2);
  assert.strictEqual(summary.passAtOne.c, 1);
  assert.strictEqual(summary.passAtOne.value, 0.5);
  assert.strictEqual(summary.flakiness.flaky.length, 1);
});

test("[AC-1 | spec-evaluation-harness | FR-287 | UR-080] tests that give the same result on every run are not flagged", () => {
  const run = (status) => parsedRun(status, [{ name: "a", status: "pass" }, { name: "b", status: "fail" }]);
  const report = aggregate.flakyTests([run("fail"), run("fail"), run("fail")]);
  assert.deepStrictEqual(report.flaky, []);
  assert.strictEqual(report.tests.length, 2);
});

test("[AC-1 | spec-evaluation-harness | FR-287 | UR-080] a single run has nothing to compare, so nothing is flagged", () => {
  // Boundary: one run.
  const report = aggregate.flakyTests([parsedRun("pass", [{ name: "a", status: "pass" }])]);
  assert.deepStrictEqual(report.flaky, []);
  assert.strictEqual(report.comparedRuns, 1);
});

test("[AC-1 | spec-evaluation-harness | FR-287 | UR-080] no runs at all gives an empty report", () => {
  // Null/empty.
  const report = aggregate.flakyTests([]);
  assert.deepStrictEqual(report.flaky, []);
  assert.deepStrictEqual(report.tests, []);
  assert.strictEqual(report.comparedRuns, 0);
});

test("[AC-1 | spec-evaluation-harness | FR-287 | UR-080] a not-run run takes no part in the flaky comparison", () => {
  const run1 = parsedRun("pass", [{ name: "a", status: "pass" }]);
  const notRun = { status: "not-run", testsParsed: false, tests: [] };
  const report = aggregate.flakyTests([run1, notRun]);
  assert.strictEqual(report.comparedRuns, 1);
  assert.deepStrictEqual(report.flaky, []);
});

test("[AC-1 | spec-evaluation-harness | FR-287 | UR-080] a run whose test results were not parsed takes no part in the flaky comparison", () => {
  const run1 = parsedRun("pass", [{ name: "a", status: "pass" }]);
  const unparsed = { status: "fail", testsParsed: false, tests: [] };
  const report = aggregate.flakyTests([run1, unparsed]);
  assert.strictEqual(report.comparedRuns, 1);
});

test("[AC-1 | spec-evaluation-harness | FR-287 | UR-080] a test present in one run and missing from another differs between runs and is flagged", () => {
  const run1 = parsedRun("pass", [{ name: "a", status: "pass" }, { name: "b", status: "pass" }]);
  const run2 = parsedRun("pass", [{ name: "a", status: "pass" }]);
  const report = aggregate.flakyTests([run1, run2]);
  assert.deepStrictEqual(report.flaky.map((entry) => entry.name), ["b"]);
});

[null, undefined, "runs", 3].forEach((value) => {
  test("[AC-1 | spec-evaluation-harness | FR-287 | UR-080] a run list of the wrong type " + JSON.stringify(value) + " gives an empty flaky report and does not throw", () => {
    // Type mismatch.
    const report = aggregate.flakyTests(value);
    assert.deepStrictEqual(report.flaky, []);
  });
});

test("[AC-1 | spec-evaluation-harness | FR-287 | UR-080] the flaky report is the same on repeated calls over the same runs", () => {
  const run1 = parsedRun("pass", [{ name: "x", status: "pass" }, { name: "y", status: "fail" }]);
  const run2 = parsedRun("fail", [{ name: "x", status: "fail" }, { name: "y", status: "fail" }]);
  const first = JSON.stringify(aggregate.flakyTests([run1, run2]));
  const second = JSON.stringify(aggregate.flakyTests([run1, run2]));
  assert.strictEqual(first, second);
});

// ---------------------------------------------------------------------------
// aggregateCase and the configured run count
// ---------------------------------------------------------------------------

test("[AC-4 | spec-evaluation-harness | FR-271 | FR-272 | FR-287] aggregateCase holds pass@1 with k, c, and the harness version beside the flaky report", () => {
  const summary = aggregate.aggregateCase(statuses(["pass", "pass", "fail"]));
  assert.strictEqual(summary.passAtOne.k, 3);
  assert.strictEqual(summary.passAtOne.c, 2);
  assert.strictEqual(summary.passAtOne.harnessVersion, aggregate.HARNESS_VERSION);
  assert.ok(summary.flakiness, "the summary carries the flaky report");
});

function writeConfig(runCount) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-aggregate-test-"));
  created.push(dir);
  const file = path.join(dir, "harness.config.json");
  fs.writeFileSync(
    file,
    JSON.stringify({
      oracleLocation: null,
      runCount,
      regressionMargin: null,
      referenceValidationRuns: null,
      judgeRuns: null,
      newTasksPerRelease: null,
      retryOnFailure: 0,
      judgeEnabled: false,
      judgeAgreementFloor: { spearmanRho: 0.7, cohenKappa: 0.6, label: "provisional, no empirical basis yet" },
      labeledSamplePath: null,
    })
  );
  return file;
}

test("[AC-4 | spec-evaluation-harness | FR-271] the run count k is read from the configuration", () => {
  const result = aggregate.runCountFromConfig(writeConfig(4));
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.runCount, 4);
});

test("[AC-4 | spec-evaluation-harness | FR-271] an unset run count is an error that names the field and carries no default number", () => {
  const result = aggregate.runCountFromConfig(writeConfig(null));
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.runCount, null);
  assert.ok(result.errors.some((entry) => entry.includes("runCount")));
});

test("[AC-4 | spec-evaluation-harness | FR-271] a non-numeric run count is an error that names the field", () => {
  // Type mismatch.
  const result = aggregate.runCountFromConfig(writeConfig("five"));
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.includes("runCount")));
});
