// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the release-over-release comparison of the evaluation harness (Group A, Step 17):
// plugins/assist-plugin/scripts/eval-harness/compare.js (`compareReleases(request)`, `reportLines(comparison)`,
// `loadMargin(configPath)`, `SUITE_FIELD`, `SUITE_LABEL`).
//
// Sources: specs/spec-evaluation-harness.md (Requirement: Benchmark section and release-over-release comparison, Scenarios
// Comparison reported, No previous release, Drop beyond the margin, Drop within the margin, Judge decline alone is
// advisory, Structural score drops too, Added case excluded from the comparison, Removed case excluded from the
// comparison, New task added, No new task, Empty suite), and
// docs/task-plans/task-plan-evaluation-harness-20261125-0717.md (ASM-3, Step 11, Step 17). Requirement text:
// docs/requirements/FR-NFR-harness-governance.md (FR-273, FR-277, FR-278, FR-279, FR-281, UR-079, UR-080).
//
// Traceability format: [AC-N | spec file | FR/NFR ids | UR ids]. The spec has no SPEC-NNN id, so it is cited by file
// name. AC-N is the position of the Scenario inside Requirement "Benchmark section and release-over-release comparison"
// (R9): AC-1 Comparison reported, AC-2 No previous release, AC-9 Drop beyond the margin, AC-10 Drop within the margin,
// AC-11 Judge decline alone is advisory, AC-12 Structural score drops too, AC-14 Added case excluded, AC-15 Removed case
// excluded, AC-18 New task added, AC-19 No new task, AC-20 Empty suite.
//
// Contract used:
//   - compareReleases({ scoreboard, version, margin, suites }) returns { ok, suites: [...], findings, notes }. Each suite
//     entry holds suite, version, previousVersion, baseline, current, previous, judgeCurrent, judgePrevious, sharedCases,
//     newCases, findings, notes.
//   - A suite score is the mean pass@1 (dev) or the mean structural score (spec) of the per-case records, restricted to
//     the case ids present in both releases. A regression finding is a drop in that score by more than the margin. A
//     judge-score decline is an advisory note only. An absent score raises no finding. No previous release means no
//     baseline and no finding. The margin has no default.
//   - The numbers in the fixtures (margin 0.05 and the scores) are test examples, not defaults (A-14).
//
// Run: node --test tests/scripts/eval-harness-compare.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLUGIN = path.join(__dirname, "..", "..", "plugins", "assist-plugin");
const compare = require(path.join(PLUGIN, "scripts", "eval-harness", "compare.js"));

const MARGIN = 0.05;

const created = [];
after(() => {
  created.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function dev(version, caseId, passAtOne) {
  return { version, suite: "dev", caseId, harnessVersion: "1.0.0", passAtOne, k: 5, c: 3, runCount: 5 };
}

function spec(version, caseId, structuralScore, judgeScore) {
  return { version, suite: "spec", caseId, harnessVersion: "1.0.0", structuralScore, judgeScore: judgeScore === undefined ? null : judgeScore, runCount: 5 };
}

function board(cases) {
  return { schemaVersion: 1, aggregates: [], cases };
}

function run(scoreboard, extra) {
  return compare.compareReleases(Object.assign({ scoreboard, version: "1.14.7", margin: MARGIN }, extra || {}));
}

function suiteOf(comparison, suite) {
  return comparison.suites.find((entry) => entry.suite === suite);
}

function near(actual, expected) {
  assert.ok(typeof actual === "number" && Math.abs(actual - expected) < 1e-9, "expected " + expected + " but read " + actual);
}

function mentions(list, text) {
  return list.some((line) => line.indexOf(text) !== -1);
}

// ---------------------------------------------------------------------------
// AC-1 and AC-2: current and previous per suite, or no baseline
// ---------------------------------------------------------------------------

test("[AC-1 | spec-evaluation-harness | FR-273 | UR-079] with stored scores for the previous release the report holds the current and the previous score of each suite", () => {
  const scoreboard = board([dev("1.14.6", "c1", 0.8), dev("1.14.7", "c1", 0.8), spec("1.14.6", "s1", 0.9, 0.7), spec("1.14.7", "s1", 0.9, 0.7)]);
  const comparison = run(scoreboard);
  assert.strictEqual(comparison.ok, true, JSON.stringify(comparison));
  const devSuite = suiteOf(comparison, "dev");
  const specSuite = suiteOf(comparison, "spec");
  assert.strictEqual(devSuite.baseline, true);
  assert.strictEqual(devSuite.previousVersion, "1.14.6");
  near(devSuite.current, 0.8);
  near(devSuite.previous, 0.8);
  near(specSuite.current, 0.9);
  near(specSuite.previous, 0.9);
});

test("[AC-1 | spec-evaluation-harness | FR-273 | UR-079] the report lines name each suite with its current score, its previous score, and the previous version", () => {
  const scoreboard = board([dev("1.14.6", "c1", 0.8), dev("1.14.7", "c1", 0.7), spec("1.14.6", "s1", 0.9), spec("1.14.7", "s1", 0.9)]);
  const lines = compare.reportLines(run(scoreboard));
  assert.strictEqual(lines.length, 2);
  const devLine = lines.find((line) => line.indexOf("dev") === 0);
  assert.ok(devLine, JSON.stringify(lines));
  assert.ok(devLine.includes("0.7") && devLine.includes("0.8") && devLine.includes("1.14.6"), devLine);
});

test("[AC-1 | spec-evaluation-harness | FR-273 | UR-079] the comparison uses the newest earlier release that holds records for the suite", () => {
  const scoreboard = board([dev("1.14.5", "c1", 0.2), dev("1.14.6", "c1", 0.8), dev("1.14.7", "c1", 0.8)]);
  const devSuite = suiteOf(run(scoreboard), "dev");
  assert.strictEqual(devSuite.previousVersion, "1.14.6");
  near(devSuite.previous, 0.8);
});

test("[AC-1 | spec-evaluation-harness | FR-273 | UR-079] the suites option limits the comparison to the named suites", () => {
  const scoreboard = board([dev("1.14.6", "c1", 0.8), dev("1.14.7", "c1", 0.8), spec("1.14.6", "s1", 0.9), spec("1.14.7", "s1", 0.9)]);
  const comparison = run(scoreboard, { suites: ["spec"] });
  assert.deepStrictEqual(comparison.suites.map((entry) => entry.suite), ["spec"]);
});

test("[AC-2 | spec-evaluation-harness | FR-273 | UR-079] with no stored scores for a previous release the report states no baseline and no regression finding", () => {
  const scoreboard = board([dev("1.14.7", "c1", 0.4), spec("1.14.7", "s1", 0.5)]);
  const comparison = run(scoreboard);
  assert.strictEqual(comparison.ok, true);
  assert.deepStrictEqual(comparison.findings, []);
  comparison.suites.forEach((entry) => {
    assert.strictEqual(entry.baseline, false);
    assert.strictEqual(entry.previous, null);
    assert.deepStrictEqual(entry.findings, []);
  });
  assert.ok(compare.reportLines(comparison).every((line) => /no baseline/i.test(line)), JSON.stringify(compare.reportLines(comparison)));
});

test("[AC-2 | spec-evaluation-harness | FR-273 | UR-079] a scoreboard holding only later releases gives no baseline for an earlier one", () => {
  // Boundary: the stored release is newer than the one compared.
  const scoreboard = board([dev("1.14.8", "c1", 0.9), dev("1.14.7", "c1", 0.1)]);
  const devSuite = suiteOf(run(scoreboard), "dev");
  assert.strictEqual(devSuite.baseline, false);
  assert.deepStrictEqual(devSuite.findings, []);
});

test("[AC-2 | spec-evaluation-harness | FR-273 | UR-079] an empty scoreboard gives no suite to compare and no finding", () => {
  // Null/empty.
  const comparison = run(board([]));
  assert.strictEqual(comparison.ok, true);
  assert.deepStrictEqual(comparison.suites, []);
  assert.deepStrictEqual(comparison.findings, []);
});

// ---------------------------------------------------------------------------
// AC-9 and AC-10: the regression margin
// ---------------------------------------------------------------------------

test("[AC-9 | spec-evaluation-harness | FR-277 | UR-079] a margin of 0.05, a previous suite score of 0.80, and a current score of 0.70 is a regression finding for the suite", () => {
  const comparison = run(board([dev("1.14.6", "c1", 0.8), dev("1.14.7", "c1", 0.7)]));
  assert.strictEqual(comparison.findings.length, 1, JSON.stringify(comparison));
  assert.ok(mentions(comparison.findings, "dev"), comparison.findings[0]);
  assert.strictEqual(suiteOf(comparison, "dev").findings.length, 1);
});

test("[AC-10 | spec-evaluation-harness | FR-277 | UR-079] a margin of 0.05, a previous suite score of 0.80, and a current score of 0.78 is no regression finding", () => {
  const comparison = run(board([dev("1.14.6", "c1", 0.8), dev("1.14.7", "c1", 0.78)]));
  assert.deepStrictEqual(comparison.findings, []);
});

test("[AC-10 | spec-evaluation-harness | FR-277 | UR-079] a drop of exactly the margin (0.80 to 0.75) is not below the previous score by more than the margin", () => {
  // Boundary: the drop equals the margin.
  const comparison = run(board([dev("1.14.6", "c1", 0.8), dev("1.14.7", "c1", 0.75)]));
  assert.deepStrictEqual(comparison.findings, []);
});

test("[AC-9 | spec-evaluation-harness | FR-277 | UR-079] a drop just beyond the margin (0.80 to 0.74) is a regression finding", () => {
  // Boundary: one step past the margin.
  const comparison = run(board([dev("1.14.6", "c1", 0.8), dev("1.14.7", "c1", 0.74)]));
  assert.strictEqual(comparison.findings.length, 1);
});

test("[AC-10 | spec-evaluation-harness | FR-277 | UR-079] a score that rises is no finding", () => {
  const comparison = run(board([dev("1.14.6", "c1", 0.5), dev("1.14.7", "c1", 0.9)]));
  assert.deepStrictEqual(comparison.findings, []);
});

test("[AC-9 | spec-evaluation-harness | FR-277 | UR-079] a larger configured margin turns the same drop from a finding into no finding", () => {
  const scoreboard = board([dev("1.14.6", "c1", 0.8), dev("1.14.7", "c1", 0.7)]);
  assert.strictEqual(run(scoreboard, { margin: 0.05 }).findings.length, 1);
  assert.deepStrictEqual(run(scoreboard, { margin: 0.2 }).findings, []);
});

test("[AC-9 | spec-evaluation-harness | FR-277 | UR-079] each suite is judged on its own score, and only the suite that fell reports a finding", () => {
  const scoreboard = board([dev("1.14.6", "c1", 0.8), dev("1.14.7", "c1", 0.7), spec("1.14.6", "s1", 0.9), spec("1.14.7", "s1", 0.9)]);
  const comparison = run(scoreboard);
  assert.strictEqual(suiteOf(comparison, "dev").findings.length, 1);
  assert.strictEqual(suiteOf(comparison, "spec").findings.length, 0);
});

[undefined, null, "0.05", -0.1, 1.5, NaN].forEach((margin) => {
  test("[AC-9 | spec-evaluation-harness | FR-277 | UR-079] a regression margin of " + String(margin) + " is not a configured margin, so the comparison does not run and no default stands in", () => {
    // Null/empty, boundary, and type mismatch.
    const comparison = compare.compareReleases({ scoreboard: board([dev("1.14.6", "c1", 0.8), dev("1.14.7", "c1", 0.1)]), version: "1.14.7", margin });
    assert.strictEqual(comparison.ok, false);
    assert.ok(comparison.reason);
  });
});

test("[AC-9 | spec-evaluation-harness | FR-277] a margin of 0 is a configured value and any drop is a finding", () => {
  // Boundary: the smallest valid margin.
  const comparison = run(board([dev("1.14.6", "c1", 0.8), dev("1.14.7", "c1", 0.79)]), { margin: 0 });
  assert.strictEqual(comparison.ok, true);
  assert.strictEqual(comparison.findings.length, 1);
});

test("[AC-9 | spec-evaluation-harness | FR-277] the margin is read from the harness configuration with no default", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-compare-test-"));
  created.push(dir);
  const base = {
    oracleLocation: null,
    runCount: null,
    regressionMargin: 0.05,
    referenceValidationRuns: null,
    judgeRuns: null,
    newTasksPerRelease: null,
    retryOnFailure: 0,
    judgeEnabled: false,
    judgeAgreementFloor: { spearmanRho: 0.7, cohenKappa: 0.6, label: "provisional, no empirical basis yet" },
    labeledSamplePath: null,
  };
  const set = path.join(dir, "set.json");
  fs.writeFileSync(set, JSON.stringify(base));
  const unset = path.join(dir, "unset.json");
  fs.writeFileSync(unset, JSON.stringify(Object.assign({}, base, { regressionMargin: null })));
  const loaded = compare.loadMargin(set);
  assert.strictEqual(loaded.ok, true, JSON.stringify(loaded.errors));
  assert.strictEqual(loaded.margin, 0.05);
  const missing = compare.loadMargin(unset);
  assert.strictEqual(missing.ok, false);
  assert.strictEqual(missing.margin, null);
  assert.ok(missing.errors.some((entry) => entry.includes("regressionMargin")));
});

// ---------------------------------------------------------------------------
// AC-11 and AC-12: judge decline is advisory, structural drop is a finding
// ---------------------------------------------------------------------------

test("[AC-11 | spec-evaluation-harness | FR-279 | UR-079] a judge score down 0.2 with structural scores within the margin is an advisory note and no regression finding", () => {
  const scoreboard = board([spec("1.14.6", "s1", 0.9, 0.9), spec("1.14.7", "s1", 0.9, 0.7)]);
  const comparison = run(scoreboard);
  assert.deepStrictEqual(comparison.findings, []);
  assert.ok(mentions(comparison.notes, "judge"), "no advisory note about the judge: " + JSON.stringify(comparison.notes));
  const specSuite = suiteOf(comparison, "spec");
  near(specSuite.judgeCurrent, 0.7);
  near(specSuite.judgePrevious, 0.9);
});

test("[AC-11 | spec-evaluation-harness | FR-279 | UR-079] a judge score that rises or holds adds no judge note", () => {
  const scoreboard = board([spec("1.14.6", "s1", 0.9, 0.7), spec("1.14.7", "s1", 0.9, 0.9)]);
  const comparison = run(scoreboard);
  assert.ok(!mentions(comparison.notes, "judge score fell"), JSON.stringify(comparison.notes));
});

test("[AC-12 | spec-evaluation-harness | FR-279 | FR-277 | UR-079] a judge score down 0.2 and a structural score down beyond the margin is a regression finding for the structural score", () => {
  const scoreboard = board([spec("1.14.6", "s1", 0.9, 0.9), spec("1.14.7", "s1", 0.7, 0.7)]);
  const comparison = run(scoreboard);
  assert.strictEqual(comparison.findings.length, 1, JSON.stringify(comparison));
  assert.ok(mentions(comparison.findings, "spec"));
  assert.ok(/structural/i.test(comparison.findings[0]), comparison.findings[0]);
});

test("[AC-12 | spec-evaluation-harness | FR-279 | FR-277 | UR-079] the suite score of a spec suite is the structural score, and of a coding suite is pass@1", () => {
  assert.strictEqual(compare.SUITE_FIELD.spec, "structuralScore");
  assert.strictEqual(compare.SUITE_FIELD.dev, "passAtOne");
  assert.ok(compare.SUITE_LABEL.spec && compare.SUITE_LABEL.dev);
});

test("[AC-11 | spec-evaluation-harness | FR-279 | UR-079] a judge score of null in a release is left out and raises no judge note", () => {
  // Null/empty: the judge was off.
  const scoreboard = board([spec("1.14.6", "s1", 0.9, null), spec("1.14.7", "s1", 0.9, null)]);
  const comparison = run(scoreboard);
  assert.deepStrictEqual(comparison.findings, []);
  assert.ok(!mentions(comparison.notes, "judge score fell"));
});

// ---------------------------------------------------------------------------
// AC-14 and AC-15: only the cases present in both releases count
// ---------------------------------------------------------------------------

test("[AC-14 | spec-evaluation-harness | FR-278 | UR-079] a case added in the current release enters neither suite score", () => {
  const scoreboard = board([dev("1.14.6", "c1", 0.8), dev("1.14.6", "c2", 0.8), dev("1.14.7", "c1", 0.8), dev("1.14.7", "c2", 0.8), dev("1.14.7", "c3", 0.1)]);
  const devSuite = suiteOf(run(scoreboard), "dev");
  near(devSuite.current, 0.8);
  near(devSuite.previous, 0.8);
  assert.deepStrictEqual(devSuite.sharedCases, ["c1", "c2"]);
  assert.deepStrictEqual(devSuite.newCases, ["c3"]);
  assert.deepStrictEqual(devSuite.findings, [], "a low-scoring new case must not read as a regression");
});

test("[AC-15 | spec-evaluation-harness | FR-278 | UR-079] a case removed from the current release enters neither suite score", () => {
  const scoreboard = board([dev("1.14.6", "c1", 0.8), dev("1.14.6", "c2", 0.2), dev("1.14.7", "c1", 0.8)]);
  const devSuite = suiteOf(run(scoreboard), "dev");
  near(devSuite.current, 0.8);
  near(devSuite.previous, 0.8);
  assert.deepStrictEqual(devSuite.sharedCases, ["c1"]);
  assert.deepStrictEqual(devSuite.findings, [], "dropping a weak case must not read as a gain, nor a strong one as a loss");
});

test("[AC-14 | spec-evaluation-harness | FR-278 | UR-079] the suite scores are the mean over the shared cases only", () => {
  const scoreboard = board([dev("1.14.6", "c1", 1.0), dev("1.14.6", "c2", 0.5), dev("1.14.7", "c1", 0.9), dev("1.14.7", "c2", 0.5), dev("1.14.7", "c9", 0.0)]);
  const devSuite = suiteOf(run(scoreboard), "dev");
  near(devSuite.previous, 0.75);
  near(devSuite.current, 0.7);
});

test("[AC-14 | spec-evaluation-harness | FR-278 | UR-079] a case whose score is absent in either release is left out of both means", () => {
  // Null/empty: c2 has no completed run in the previous release.
  const scoreboard = board([dev("1.14.6", "c1", 0.8), dev("1.14.6", "c2", null), dev("1.14.7", "c1", 0.8), dev("1.14.7", "c2", 0.2)]);
  const devSuite = suiteOf(run(scoreboard), "dev");
  near(devSuite.current, 0.8);
  near(devSuite.previous, 0.8);
  assert.deepStrictEqual(devSuite.findings, []);
});

test("[AC-14 | spec-evaluation-harness | FR-278 | UR-079] a comparison of one suite does not read the cases of the other suite", () => {
  const scoreboard = board([dev("1.14.6", "c1", 0.8), spec("1.14.6", "c1", 0.2), dev("1.14.7", "c1", 0.8), spec("1.14.7", "c1", 0.2)]);
  const comparison = run(scoreboard);
  near(suiteOf(comparison, "dev").current, 0.8);
  near(suiteOf(comparison, "spec").current, 0.2);
});

// ---------------------------------------------------------------------------
// AC-18 and AC-19: new tasks per release
// ---------------------------------------------------------------------------

test("[AC-18 | spec-evaluation-harness | FR-281 | UR-080] a suite with one case not present in the previous release has a new case found and no no-new-task note", () => {
  const scoreboard = board([dev("1.14.6", "c1", 0.8), dev("1.14.7", "c1", 0.8), dev("1.14.7", "c2", 0.8)]);
  const devSuite = suiteOf(run(scoreboard), "dev");
  assert.deepStrictEqual(devSuite.newCases, ["c2"]);
  assert.ok(!mentions(devSuite.notes, "no case new"), JSON.stringify(devSuite.notes));
});

test("[AC-19 | spec-evaluation-harness | FR-281 | UR-080] a suite with no new case gets an advisory note that names the suite", () => {
  const scoreboard = board([dev("1.14.6", "c1", 0.8), dev("1.14.7", "c1", 0.8)]);
  const comparison = run(scoreboard);
  const devSuite = suiteOf(comparison, "dev");
  assert.deepStrictEqual(devSuite.newCases, []);
  const note = devSuite.notes.find((line) => /advisory/i.test(line) && line.indexOf("dev") !== -1);
  assert.ok(note, "no advisory note naming the suite: " + JSON.stringify(devSuite.notes));
  assert.deepStrictEqual(comparison.findings, [], "a missing new task is advisory, never a finding");
});

test("[AC-19 | spec-evaluation-harness | FR-281 | UR-080] the no-new-task note names each suite that lacks a new case", () => {
  const scoreboard = board([dev("1.14.6", "c1", 0.8), dev("1.14.7", "c1", 0.8), spec("1.14.6", "s1", 0.9), spec("1.14.7", "s1", 0.9)]);
  const comparison = run(scoreboard);
  assert.ok(comparison.notes.some((line) => /no case new/i.test(line) && line.indexOf("dev") !== -1));
  assert.ok(comparison.notes.some((line) => /no case new/i.test(line) && line.indexOf("spec") !== -1));
});

// ---------------------------------------------------------------------------
// AC-20: an empty suite reads absent and raises no finding
// ---------------------------------------------------------------------------

test("[AC-20 | spec-evaluation-harness | FR-273 | UR-079] a suite whose every run read not-run has an absent score and no regression finding", () => {
  const scoreboard = board([dev("1.14.6", "c1", 0.8), dev("1.14.7", "c1", null), dev("1.14.7", "c2", null)]);
  const comparison = run(scoreboard);
  const devSuite = suiteOf(comparison, "dev");
  assert.strictEqual(devSuite.current, null);
  assert.deepStrictEqual(comparison.findings, []);
  assert.ok(compare.reportLines(comparison).some((line) => line.indexOf("absent") !== -1), JSON.stringify(compare.reportLines(comparison)));
});

test("[AC-20 | spec-evaluation-harness | FR-273 | UR-079] a suite with no admitted case in the current release has an absent score and no regression finding", () => {
  // The suite still holds an aggregate row but no per-case record.
  const scoreboard = {
    schemaVersion: 1,
    aggregates: [{ version: "1.14.7", suite: "dev", harnessVersion: "1.0.0", passAtOne: null, caseCount: 0 }],
    cases: [dev("1.14.6", "c1", 0.8)],
  };
  const comparison = run(scoreboard);
  const devSuite = suiteOf(comparison, "dev");
  assert.strictEqual(devSuite.current, null);
  assert.deepStrictEqual(comparison.findings, []);
});

test("[AC-20 | spec-evaluation-harness | FR-273 | UR-079] a spec suite whose structural score is absent in the current release raises no finding", () => {
  const scoreboard = board([spec("1.14.6", "s1", 0.9, 0.9), spec("1.14.7", "s1", null, null)]);
  const comparison = run(scoreboard);
  assert.strictEqual(suiteOf(comparison, "spec").current, null);
  assert.deepStrictEqual(comparison.findings, []);
});

// ---------------------------------------------------------------------------
// Bad requests
// ---------------------------------------------------------------------------

test("[AC-1 | spec-evaluation-harness | FR-273 | UR-079] a request with no scoreboard does not run", () => {
  // Null/empty.
  assert.strictEqual(compare.compareReleases({ version: "1.14.7", margin: MARGIN }).ok, false);
  assert.strictEqual(compare.compareReleases(undefined).ok, false);
});

["", "latest", "1.14", "../1.14.7", 7, null].forEach((version) => {
  test("[AC-1 | spec-evaluation-harness | FR-273 | UR-079] a release version of " + JSON.stringify(version) + " is not a version number and the comparison does not run", () => {
    // Invalid, null/empty, and type mismatch.
    const comparison = compare.compareReleases({ scoreboard: board([dev("1.14.6", "c1", 0.8)]), version, margin: MARGIN });
    assert.strictEqual(comparison.ok, false);
  });
});

test("[AC-1 | spec-evaluation-harness | FR-273 | UR-079] reportLines of a failed comparison is empty", () => {
  assert.deepStrictEqual(compare.reportLines({ ok: false, reason: "x" }), []);
  assert.deepStrictEqual(compare.reportLines(undefined), []);
});
