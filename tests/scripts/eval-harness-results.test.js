// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for run results in the evaluation harness (Group A, Step 17):
// plugins/assist-plugin/scripts/eval-harness/results.js (`readAggregateInfo`, `combineAggregateInfo`, `buildRunResult`,
// `validateRunResult`, `storeRunResult`, `VERSION_PATTERN`, `IDENTIFIER_PATTERN`, `SUITES`).
//
// Sources: specs/spec-evaluation-harness.md (Requirement: Benchmark section and release-over-release comparison, Scenarios
// Result keyed to the plugin version and Result without a plugin version refused; Requirement: Coding run scoring by
// execution and pass@1, Scenario Result without a harness version; Requirement: Spec judge grading, separation, and bias
// mitigations; Non-functional requirements addressed, NFR-038), and
// docs/task-plans/task-plan-evaluation-harness-20261125-0717.md (Step 9, Step 17). Requirement text:
// docs/requirements/FR-NFR-harness-governance.md (FR-270, FR-272, FR-275, FR-282 to FR-285, NFR-038; scenario "Cost
// recorded" at line 2423).
//
// Traceability format: [AC-N | spec file | FR/NFR ids | UR ids]. The spec has no SPEC-NNN id, so it is cited by file
// name. AC-N is the position of the Scenario inside its Requirement block:
//   Benchmark section and release-over-release comparison (R9): AC-5 Result keyed to the plugin version, AC-6 Result
//   without a plugin version refused.
//   Coding run scoring by execution and pass@1 (R5): AC-6 Result without a harness version.
//   Spec judge grading (R8): AC-6 Combined field rejected, AC-8 One overall score rejected, AC-10 One order only
//   rejected, AC-12 Judge run count not stated.
//   NFR-038 has no Scenario in the spec; it cites the requirements document scenario "Cost recorded".
//
// Contract used:
//   - readAggregateInfo(aggregateJson, { pluginName }) reads suite.plugins[].version, costUsd, and durationSeconds of the
//     runner's aggregate and returns { ok: true, pluginVersion, costUsd, elapsedSeconds } or { ok: false, reason }.
//   - buildRunResult({ info, harnessVersion, startedAt, cases }) assembles a result; validateRunResult(result) is the one
//     validator that holds every "validation SHALL fail" rule and returns { ok, errors: [{ field, message }] }, each error
//     naming the offending field. storeRunResult(result, { resultsDir, now }) writes only a valid result, to a file keyed
//     to the plugin version.
//   - All fixtures are synthetic. The judge model is a stub; no test makes a model call. Results go to a temp folder.
//
// Run: node --test tests/scripts/eval-harness-results.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLUGIN = path.join(__dirname, "..", "..", "plugins", "assist-plugin");
const results = require(path.join(PLUGIN, "scripts", "eval-harness", "results.js"));
const judge = require(path.join(PLUGIN, "scripts", "eval-harness", "judge.js"));

const created = [];
after(() => {
  created.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-results-test-"));
  created.push(dir);
  return dir;
}

function aggregateJson(version, cost, seconds) {
  return { suite: { plugins: [{ name: "assist-plugin", version }] }, costUsd: cost, durationSeconds: seconds, cases: [] };
}

function infoOf(version) {
  return { ok: true, pluginVersion: version, costUsd: 4.85, elapsedSeconds: 165 };
}

function devCase(caseId) {
  return {
    suite: "dev",
    caseId,
    heldOut: false,
    runs: [
      { run: 1, status: "pass", reason: null },
      { run: 2, status: "fail", reason: null },
    ],
    passAtOne: { value: 0.5, k: 2, c: 1, harnessVersion: "1.0.0" },
    flakyTests: [],
  };
}

function judgedResult() {
  const adapter = { family: "family-alpha", isAvailable: () => true, score: () => ({ ok: true, score: 0.6 }) };
  const result = judge.judgeCase({
    caseId: "case-s",
    agentFamily: "family-alpha",
    structural: { status: "scored", score: 0.9, passed: 9, total: 9, cleared: true, items: [], failedNames: [], reason: null },
    rubric: { subjective: [{ id: "clarity", text: "Reads clearly" }, { id: "scope", text: "States its scope" }] },
    outputText: "OUTPUT",
    referenceText: "REFERENCE",
    config: { judgeEnabled: true, judgeRuns: 3, judgeAgreementFloor: { spearmanRho: 0.7, cohenKappa: 0.6, label: "provisional, no empirical basis yet" }, labeledSamplePath: null },
    adapter,
    logger: () => {},
  });
  assert.strictEqual(result.status, "judged");
  return JSON.parse(JSON.stringify(result));
}

function specCase(caseId, judgeResult) {
  return {
    suite: "spec",
    caseId,
    heldOut: false,
    runs: [{ run: 1, status: "scored", reason: null, structural: { status: "scored", score: 0.9, cleared: true }, judge: judgeResult === undefined ? null : judgeResult }],
    structuralScore: 0.9,
    judgeScore: judgeResult ? judgeResult.judgeScore : null,
    runCount: 1,
  };
}

function resultOf(cases, version) {
  return results.buildRunResult({
    info: infoOf(version === undefined ? "1.14.7" : version),
    harnessVersion: "1.0.0",
    startedAt: "2026-11-25T08:00:00.000Z",
    cases,
  });
}

function validResult() {
  return resultOf([devCase("case-a"), specCase("case-s", judgedResult())]);
}

function fieldsOf(validation) {
  return validation.errors.map((entry) => entry.field);
}

function hasField(validation, text) {
  return fieldsOf(validation).some((field) => field.indexOf(text) !== -1);
}

const NOW = new Date("2026-11-25T08:00:00.000Z");

// ---------------------------------------------------------------------------
// The runner aggregate: plugin version, cost, elapsed time
// ---------------------------------------------------------------------------

test("[AC-5 | spec-evaluation-harness | FR-275 | NFR-038 | UR-079] the plugin version, total cost, and elapsed time are read from the runner aggregate", () => {
  const info = results.readAggregateInfo(aggregateJson("1.14.7", 4.85, 165), { pluginName: "assist-plugin" });
  assert.strictEqual(info.ok, true, JSON.stringify(info));
  assert.strictEqual(info.pluginVersion, "1.14.7");
  assert.strictEqual(info.costUsd, 4.85);
  assert.strictEqual(info.elapsedSeconds, 165);
});

test("[AC-5 | spec-evaluation-harness | FR-275 | UR-079] with no plugin name given the first plugin entry is read", () => {
  const info = results.readAggregateInfo(aggregateJson("1.14.7", 1, 2));
  assert.strictEqual(info.ok, true);
  assert.strictEqual(info.pluginVersion, "1.14.7");
});

test("[AC-5 | spec-evaluation-harness | FR-275 | UR-079] the plugin name picks the matching entry when the aggregate lists several plugins", () => {
  const aggregate = aggregateJson("1.14.7", 1, 2);
  aggregate.suite.plugins.unshift({ name: "other-plugin", version: "9.9.9" });
  const info = results.readAggregateInfo(aggregate, { pluginName: "assist-plugin" });
  assert.strictEqual(info.pluginVersion, "1.14.7");
});

test("[AC-6 | spec-evaluation-harness | FR-275 | UR-079] an aggregate that records no plugin version is not readable and the reason says so", () => {
  const aggregate = { suite: { plugins: [{ name: "assist-plugin" }] }, costUsd: 1, durationSeconds: 2 };
  const info = results.readAggregateInfo(aggregate, { pluginName: "assist-plugin" });
  assert.strictEqual(info.ok, false);
  assert.match(info.reason, /version/i);
});

test("[AC-6 | spec-evaluation-harness | FR-275 | UR-079] an aggregate with no plugin list is not readable", () => {
  // Null/empty.
  assert.strictEqual(results.readAggregateInfo({ costUsd: 1, durationSeconds: 2 }).ok, false);
  assert.strictEqual(results.readAggregateInfo({ suite: { plugins: [] }, costUsd: 1, durationSeconds: 2 }).ok, false);
});

["../../etc/passwd", "1.14", "v1.14.7", "1.14.7/../x", "latest"].forEach((version) => {
  test("[AC-6 | spec-evaluation-harness | FR-275 | UR-079] an aggregate that records the plugin version " + JSON.stringify(version) + " is not a version number and is refused", () => {
    // Invalid and security-adjacent: the version names the stored file, so it must be a plain version number.
    assert.strictEqual(results.readAggregateInfo(aggregateJson(version, 1, 2)).ok, false);
  });
});

test("[AC-5 | spec-evaluation-harness | FR-275 | NFR-038] an aggregate that records no total cost is not readable", () => {
  const aggregate = aggregateJson("1.14.7", undefined, 2);
  const info = results.readAggregateInfo(aggregate);
  assert.strictEqual(info.ok, false);
  assert.match(info.reason, /cost/i);
});

test("[AC-5 | spec-evaluation-harness | FR-275 | NFR-038] an aggregate that records no elapsed time is not readable", () => {
  const aggregate = aggregateJson("1.14.7", 1, undefined);
  const info = results.readAggregateInfo(aggregate);
  assert.strictEqual(info.ok, false);
  assert.match(info.reason, /elapsed|time/i);
});

test("[AC-5 | spec-evaluation-harness | FR-275 | NFR-038] a cost of 0 and an elapsed time of 0 are valid readings, not missing ones", () => {
  // Boundary: zero is a number.
  const info = results.readAggregateInfo(aggregateJson("1.14.7", 0, 0));
  assert.strictEqual(info.ok, true);
});

test("[AC-5 | spec-evaluation-harness | FR-275 | NFR-038] a negative cost is not readable", () => {
  // Boundary: below zero.
  assert.strictEqual(results.readAggregateInfo(aggregateJson("1.14.7", -0.01, 2)).ok, false);
});

[null, undefined, "aggregate", 5, []].forEach((value) => {
  test("[AC-6 | spec-evaluation-harness | FR-275 | UR-079] the non-object aggregate " + JSON.stringify(value) + " is not readable", () => {
    // Type mismatch.
    assert.strictEqual(results.readAggregateInfo(value).ok, false);
  });
});

test("[AC-5 | spec-evaluation-harness | FR-275 | NFR-038] the aggregates of one benchmark run combine into one version, the summed cost, and the summed elapsed time", () => {
  const first = results.readAggregateInfo(aggregateJson("1.14.7", 1.5, 10));
  const second = results.readAggregateInfo(aggregateJson("1.14.7", 2.5, 20));
  const combined = results.combineAggregateInfo([first, second]);
  assert.strictEqual(combined.ok, true, JSON.stringify(combined));
  assert.strictEqual(combined.pluginVersion, "1.14.7");
  assert.strictEqual(combined.costUsd, 4);
  assert.strictEqual(combined.elapsedSeconds, 30);
});

test("[AC-6 | spec-evaluation-harness | FR-275 | UR-079] aggregates that record different plugin versions do not combine", () => {
  const first = results.readAggregateInfo(aggregateJson("1.14.7", 1, 1));
  const second = results.readAggregateInfo(aggregateJson("1.14.8", 1, 1));
  assert.strictEqual(results.combineAggregateInfo([first, second]).ok, false);
});

test("[AC-6 | spec-evaluation-harness | FR-275 | UR-079] no aggregate at all does not combine", () => {
  // Null/empty.
  assert.strictEqual(results.combineAggregateInfo([]).ok, false);
  assert.strictEqual(results.combineAggregateInfo(undefined).ok, false);
});

test("[AC-6 | spec-evaluation-harness | FR-275 | UR-079] one unreadable aggregate among readable ones stops the combination", () => {
  const good = results.readAggregateInfo(aggregateJson("1.14.7", 1, 1));
  const bad = results.readAggregateInfo({ nothing: true });
  assert.strictEqual(results.combineAggregateInfo([good, bad]).ok, false);
});

// ---------------------------------------------------------------------------
// AC-5 and AC-6 of R9: keyed to the plugin version, refused with none
// ---------------------------------------------------------------------------

test("[AC-5 | spec-evaluation-harness | FR-275 | UR-079] a run result that records plugin version 1.14.7 is stored keyed to 1.14.7", () => {
  const dir = tmpDir();
  const stored = results.storeRunResult(validResult(), { resultsDir: dir, now: NOW });
  assert.strictEqual(stored.ok, true, JSON.stringify(stored));
  assert.strictEqual(stored.pluginVersion, "1.14.7");
  assert.ok(path.basename(stored.path).includes("1.14.7"), "the stored file name is keyed to the version: " + stored.path);
  assert.strictEqual(path.dirname(stored.path), dir);
  const onDisk = JSON.parse(fs.readFileSync(stored.path, "utf8"));
  assert.strictEqual(onDisk.pluginVersion, "1.14.7");
});

test("[AC-5 | spec-evaluation-harness | FR-275 | UR-079] a stored result is not written into the results folder of the repository unless asked", () => {
  assert.ok(results.DEFAULT_RESULTS_DIR.split(path.sep).join("/").endsWith("evals/results"));
});

test("[AC-6 | spec-evaluation-harness | FR-275 | UR-079] a run result that records no plugin version is refused and nothing is stored", () => {
  const dir = tmpDir();
  const result = resultOf([devCase("case-a")]);
  result.pluginVersion = null;
  const stored = results.storeRunResult(result, { resultsDir: dir, now: NOW });
  assert.strictEqual(stored.ok, false);
  assert.strictEqual(stored.path, null);
  assert.ok(stored.errors.some((entry) => entry.field === "pluginVersion"), JSON.stringify(stored.errors));
  assert.deepStrictEqual(fs.readdirSync(dir), [], "nothing was written");
});

test("[AC-6 | spec-evaluation-harness | FR-275 | UR-079] a result built from an unreadable aggregate carries no plugin version and is refused on validation", () => {
  const built = results.buildRunResult({ info: { ok: false, reason: "runner aggregate records no plugin version" }, harnessVersion: "1.0.0", startedAt: "2026-11-25T08:00:00.000Z", cases: [devCase("case-a")] });
  const validation = results.validateRunResult(built);
  assert.strictEqual(validation.ok, false);
  assert.ok(fieldsOf(validation).indexOf("pluginVersion") !== -1);
});

["", "   ", "../1.14.7", "1.14.7/../../x", "one.two.three"].forEach((version) => {
  test("[AC-6 | spec-evaluation-harness | FR-275 | UR-079] a run result that records the plugin version " + JSON.stringify(version) + " fails validation and names the field", () => {
    // Null/empty, invalid, and path traversal: the version keys a file name.
    const result = resultOf([devCase("case-a")]);
    result.pluginVersion = version;
    const validation = results.validateRunResult(result);
    assert.strictEqual(validation.ok, false);
    assert.ok(fieldsOf(validation).indexOf("pluginVersion") !== -1);
  });
});

test("[AC-5 | spec-evaluation-harness | FR-275 | UR-079] a pre-release plugin version such as 1.14.7-rc.1 is a valid key", () => {
  const validation = results.validateRunResult(resultOf([devCase("case-a")], "1.14.7-rc.1"));
  assert.strictEqual(validation.ok, true, JSON.stringify(validation.errors));
});

test("[AC-5 | spec-evaluation-harness | FR-275 | UR-079] a stored result is never overwritten by a second store of the same run", () => {
  const dir = tmpDir();
  const first = results.storeRunResult(validResult(), { resultsDir: dir, now: NOW });
  assert.strictEqual(first.ok, true);
  const second = results.storeRunResult(validResult(), { resultsDir: dir, now: NOW });
  assert.strictEqual(second.ok, false);
  assert.strictEqual(fs.readdirSync(dir).length, 1);
});

test("[AC-5 | spec-evaluation-harness | FR-275 | UR-079] two results for different versions are stored side by side, each keyed to its own version", () => {
  const dir = tmpDir();
  const a = results.storeRunResult(resultOf([devCase("case-a")], "1.14.6"), { resultsDir: dir, now: NOW });
  const b = results.storeRunResult(resultOf([devCase("case-a")], "1.14.7"), { resultsDir: dir, now: NOW });
  assert.strictEqual(a.ok, true);
  assert.strictEqual(b.ok, true);
  assert.notStrictEqual(a.path, b.path);
});

// ---------------------------------------------------------------------------
// NFR-038: cost and elapsed time in every result
// ---------------------------------------------------------------------------

test("[AC-5 | spec-evaluation-harness | NFR-038] a completed run result holds the total cost in USD and the elapsed time", () => {
  const result = validResult();
  assert.strictEqual(result.costUsd, 4.85);
  assert.strictEqual(result.elapsedSeconds, 165);
  const stored = results.storeRunResult(result, { resultsDir: tmpDir(), now: NOW });
  const onDisk = JSON.parse(fs.readFileSync(stored.path, "utf8"));
  assert.strictEqual(onDisk.costUsd, 4.85);
  assert.strictEqual(onDisk.elapsedSeconds, 165);
});

test("[AC-5 | spec-evaluation-harness | NFR-038] a result with no total cost fails validation and names costUsd", () => {
  const result = validResult();
  result.costUsd = null;
  const validation = results.validateRunResult(result);
  assert.strictEqual(validation.ok, false);
  assert.ok(fieldsOf(validation).indexOf("costUsd") !== -1);
});

test("[AC-5 | spec-evaluation-harness | NFR-038] a result with no elapsed time fails validation and names elapsedSeconds", () => {
  const result = validResult();
  delete result.elapsedSeconds;
  const validation = results.validateRunResult(result);
  assert.strictEqual(validation.ok, false);
  assert.ok(fieldsOf(validation).indexOf("elapsedSeconds") !== -1);
});

test("[AC-5 | spec-evaluation-harness | NFR-038] a result whose cost is text fails validation", () => {
  // Type mismatch.
  const result = validResult();
  result.costUsd = "4.85";
  assert.strictEqual(results.validateRunResult(result).ok, false);
});

test("[AC-5 | spec-evaluation-harness | NFR-038] a result with a cost of 0 and an elapsed time of 0 is valid", () => {
  // Boundary.
  const result = validResult();
  result.costUsd = 0;
  result.elapsedSeconds = 0;
  assert.strictEqual(results.validateRunResult(result).ok, true);
});

// ---------------------------------------------------------------------------
// One validator holds every "validation SHALL fail" rule
// ---------------------------------------------------------------------------

test("[AC-6 | spec-evaluation-harness | FR-272 | FR-270 | FR-282 | FR-283 | FR-284 | FR-285] a well-formed result with a dev case and a judged spec case passes validation", () => {
  const validation = results.validateRunResult(validResult());
  assert.strictEqual(validation.ok, true, JSON.stringify(validation.errors));
  assert.deepStrictEqual(validation.errors, []);
});

test("[AC-6 | spec-evaluation-harness | FR-272 | UR-078] a result with no harness version fails validation and names harnessVersion", () => {
  const result = validResult();
  delete result.harnessVersion;
  const validation = results.validateRunResult(result);
  assert.strictEqual(validation.ok, false);
  assert.ok(fieldsOf(validation).indexOf("harnessVersion") !== -1);
});

test("[AC-6 | spec-evaluation-harness | FR-272 | UR-078] a coding case whose pass@1 value states no harness version fails validation and names that field", () => {
  const result = validResult();
  delete result.cases[0].passAtOne.harnessVersion;
  const validation = results.validateRunResult(result);
  assert.strictEqual(validation.ok, false);
  assert.ok(hasField(validation, "harnessVersion"), JSON.stringify(validation.errors));
  assert.ok(hasField(validation, "cases[0]"), "the error names the case: " + JSON.stringify(validation.errors));
});

test("[AC-6 | spec-evaluation-harness | FR-272 | UR-078] a coding case whose pass@1 value is not c divided by k fails validation", () => {
  const result = validResult();
  result.cases[0].passAtOne.value = 0.9;
  const validation = results.validateRunResult(result);
  assert.strictEqual(validation.ok, false);
  assert.ok(hasField(validation, "value"));
});

test("[AC-6 | spec-evaluation-harness | FR-271 | UR-078] a coding case whose every run read not-run holds an absent pass@1 and passes validation", () => {
  const result = validResult();
  result.cases[0].runs = [{ run: 1, status: "not-run", reason: "sandbox backend is unavailable" }];
  result.cases[0].passAtOne = { value: null, k: 0, c: 0, harnessVersion: "1.0.0" };
  const validation = results.validateRunResult(result);
  assert.strictEqual(validation.ok, true, JSON.stringify(validation.errors));
});

test("[AC-6 | spec-evaluation-harness | FR-270 | UR-078] a spec case with a field that combines the two scores fails validation and names the field", () => {
  const result = validResult();
  result.cases[1].blendedScore = 0.75;
  const validation = results.validateRunResult(result);
  assert.strictEqual(validation.ok, false);
  assert.ok(hasField(validation, "blendedScore"), JSON.stringify(validation.errors));
});

test("[AC-6 | spec-evaluation-harness | FR-270 | UR-078] a result with a top-level field that combines the two scores fails validation and names the field", () => {
  const result = validResult();
  result.combinedScore = 0.75;
  const validation = results.validateRunResult(result);
  assert.strictEqual(validation.ok, false);
  assert.ok(fieldsOf(validation).indexOf("combinedScore") !== -1);
});

test("[AC-6 | spec-evaluation-harness | FR-270 | UR-078] a spec case that holds the structural score and no judge score field fails validation", () => {
  const result = validResult();
  delete result.cases[1].judgeScore;
  const validation = results.validateRunResult(result);
  assert.strictEqual(validation.ok, false);
  assert.ok(hasField(validation, "judgeScore"));
});

test("[AC-6 | spec-evaluation-harness | FR-270 | UR-078] a spec case with the structural score 0.9 and the judge score 0.6 as two values passes validation", () => {
  const result = validResult();
  assert.strictEqual(result.cases[1].structuralScore, 0.9);
  assert.strictEqual(result.cases[1].judgeScore, 0.6);
  assert.strictEqual(results.validateRunResult(result).ok, true);
});

test("[AC-8 | spec-evaluation-harness | FR-283 | UR-078] a judge result with a single overall score and no item scores fails validation", () => {
  const judgeResult = judgedResult();
  judgeResult.itemScores = [];
  const result = resultOf([specCase("case-s", judgeResult)]);
  const validation = results.validateRunResult(result);
  assert.strictEqual(validation.ok, false);
  assert.ok(hasField(validation, "itemScores"), JSON.stringify(validation.errors));
});

test("[AC-10 | spec-evaluation-harness | FR-284 | UR-078] a comparison result built from one order fails validation and names the order field", () => {
  const judgeResult = judgedResult();
  const firstOrder = judge.ORDERS[0];
  judgeResult.itemScores[0].orderScores = { [firstOrder]: 0.8 };
  const validation = results.validateRunResult(resultOf([specCase("case-s", judgeResult)]));
  assert.strictEqual(validation.ok, false);
  assert.ok(hasField(validation, "orderScores"), JSON.stringify(validation.errors));
});

test("[AC-12 | spec-evaluation-harness | FR-285 | UR-078] a judge score with no run count fails validation and names the field", () => {
  const judgeResult = judgedResult();
  delete judgeResult.judgeRuns;
  const validation = results.validateRunResult(resultOf([specCase("case-s", judgeResult)]));
  assert.strictEqual(validation.ok, false);
  assert.ok(hasField(validation, "judgeRuns"), JSON.stringify(validation.errors));
});

test("[AC-13 | spec-evaluation-harness | FR-282 | UR-080] a same-family judge result with no recorded mitigation fails validation and names the field", () => {
  const judgeResult = judgedResult();
  delete judgeResult.mitigations;
  const validation = results.validateRunResult(resultOf([specCase("case-s", judgeResult)]));
  assert.strictEqual(validation.ok, false);
  assert.ok(hasField(validation, "mitigations"), JSON.stringify(validation.errors));
});

test("[AC-13 | spec-evaluation-harness | FR-282 | UR-080] a judge result that records no judge family or agent family fails validation", () => {
  const judgeResult = judgedResult();
  delete judgeResult.judgeFamily;
  delete judgeResult.agentFamily;
  const validation = results.validateRunResult(resultOf([specCase("case-s", judgeResult)]));
  assert.strictEqual(validation.ok, false);
  assert.ok(hasField(validation, "judgeFamily"));
  assert.ok(hasField(validation, "agentFamily"));
});

test("[AC-6 | spec-evaluation-harness | FR-275 | FR-272 | FR-270 | NFR-038] one validator names every fault of a result with several, not only the first", () => {
  const result = validResult();
  result.pluginVersion = null;
  delete result.harnessVersion;
  result.costUsd = null;
  const validation = results.validateRunResult(result);
  assert.strictEqual(validation.ok, false);
  ["pluginVersion", "harnessVersion", "costUsd"].forEach((field) => {
    assert.ok(fieldsOf(validation).indexOf(field) !== -1, "no error names " + field + ": " + JSON.stringify(validation.errors));
  });
  validation.errors.forEach((entry) => {
    assert.strictEqual(typeof entry.field, "string");
    assert.strictEqual(typeof entry.message, "string");
  });
});

test("[AC-6 | spec-evaluation-harness | FR-275] a result with no case fails validation and names the cases field", () => {
  // Null/empty.
  const validation = results.validateRunResult(resultOf([]));
  assert.strictEqual(validation.ok, false);
  assert.ok(fieldsOf(validation).indexOf("cases") !== -1);
});

test("[AC-6 | spec-evaluation-harness | FR-275] a case with a suite other than dev or spec fails validation", () => {
  const result = validResult();
  result.cases[0].suite = "prod";
  const validation = results.validateRunResult(result);
  assert.strictEqual(validation.ok, false);
  assert.ok(hasField(validation, "suite"));
});

["../escape", "a b", "x".repeat(65), "", "case;rm"].forEach((caseId) => {
  test("[AC-6 | spec-evaluation-harness | NFR-039] a case id of " + JSON.stringify(caseId.slice(0, 20)) + " is not an identifier and fails validation", () => {
    // Invalid, boundary (65 characters), and injection-shaped identifiers.
    const result = validResult();
    result.cases[0].caseId = caseId;
    const validation = results.validateRunResult(result);
    assert.strictEqual(validation.ok, false);
    assert.ok(hasField(validation, "caseId"));
  });
});

test("[AC-6 | spec-evaluation-harness | FR-272] a coding case with a run of an unknown status fails validation", () => {
  const result = validResult();
  result.cases[0].runs[0].status = "mostly-passed";
  const validation = results.validateRunResult(result);
  assert.strictEqual(validation.ok, false);
  assert.ok(hasField(validation, "status"));
});

[null, undefined, "result", 3, []].forEach((value) => {
  test("[AC-6 | spec-evaluation-harness | FR-275] the non-object result " + JSON.stringify(value) + " fails validation and is not stored", () => {
    // Type mismatch.
    assert.strictEqual(results.validateRunResult(value).ok, false);
    const dir = tmpDir();
    assert.strictEqual(results.storeRunResult(value, { resultsDir: dir, now: NOW }).ok, false);
    assert.deepStrictEqual(fs.readdirSync(dir), []);
  });
});

test("[AC-6 | spec-evaluation-harness | FR-272] buildRunResult states a harness version of its own when the caller names none", () => {
  const built = results.buildRunResult({ info: infoOf("1.14.7"), startedAt: "2026-11-25T08:00:00.000Z", cases: [devCase("case-a")] });
  assert.strictEqual(typeof built.harnessVersion, "string");
  assert.ok(built.harnessVersion.length > 0);
});

test("[AC-5 | spec-evaluation-harness | FR-275] the exported patterns accept a version number and an identifier and refuse path text", () => {
  assert.ok(results.VERSION_PATTERN.test("1.14.7"));
  assert.ok(!results.VERSION_PATTERN.test("../1.14.7"));
  assert.ok(results.IDENTIFIER_PATTERN.test("case-a"));
  assert.ok(!results.IDENTIFIER_PATTERN.test("a/b"));
  assert.deepStrictEqual(results.SUITES, ["dev", "spec"]);
});
