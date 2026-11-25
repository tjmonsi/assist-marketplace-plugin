// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the coding grader of the evaluation harness (Group A, Step 16):
// plugins/assist-plugin/scripts/eval-harness/coding-score.js (`scoreCodingRun(request)`, `parseTapResults`,
// `defaultSandboxProbe`, `STATUS_*`).
//
// Sources: specs/spec-evaluation-harness.md (Requirement: Coding run scoring by execution and pass@1, Scenarios Suite
// passes, Suite fails, Sandbox backend absent; Requirement: Flaky hidden-suite tests reported, not silenced), and
// docs/task-plans/task-plan-evaluation-harness-20261125-0717.md (ASM-1, ASM-7a, ASM-6, Step 5, Step 16). Requirement text:
// docs/requirements/FR-NFR-harness-governance.md (FR-260, FR-262, FR-264, FR-271, FR-287, UR-078, SC-023).
//
// Traceability format: [AC-N | spec file | FR/NFR ids | UR/SC ids]. The spec has no SPEC-NNN id, so it is cited by file
// name. AC-N is the position of the Scenario inside Requirement "Coding run scoring by execution and pass@1" (R5):
//   AC-1 Suite passes, AC-2 Suite fails, AC-3 Sandbox backend absent.
//
// Contract used:
//   - scoreCodingRun({ suite, caseId, oracle, workspaceDir, run, sandboxProbe, gradingRoot, logger }) returns
//     { status, exitCode, reason, tests, testsParsed, ... } with status "pass" (hidden suite exit 0), "fail" (non-zero
//     exit), "not-run" (the sandbox adapter reports no backend), or "error" (the oracle is unreadable or the suite cannot
//     start). Only these four.
//   - The scoring makes no model call: its one adapter is the sandbox probe. It never skips and never retries a test.
//   - The hidden suite runs in a grading directory outside the agent workspace and is never copied into the workspace.
//   - `tests` holds one { name, status } per test result with status pass, fail, skip, or todo.
//   - Hidden suites are Node --test files (ASM-6). The sandbox-absent signal of the real runner is unverified (B3), so the
//     tests drive it through the injectable adapter and through the documented fields of the default adapter.
//   - All fixtures are synthetic stand-ins built under os.tmpdir(). No real oracle content is committed (ASM-1).
//
// Run: node --test tests/scripts/eval-harness-coding-score.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLUGIN = path.join(__dirname, "..", "..", "plugins", "assist-plugin");
const coding = require(path.join(PLUGIN, "scripts", "eval-harness", "coding-score.js"));
const oracle = require(path.join(PLUGIN, "scripts", "eval-harness", "oracle.js"));
const aggregate = require(path.join(PLUGIN, "scripts", "eval-harness", "aggregate.js"));

const PASSING_SOLUTION = "module.exports = { add: function (a, b) { return a + b; } };\n";
const FAILING_SOLUTION = "module.exports = { add: function (a, b) { return a - b; } };\n";

const created = [];
after(() => {
  created.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-coding-test-"));
  created.push(dir);
  return dir;
}

function put(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function quietLogger() {
  return () => {};
}

const ADD_HIDDEN_SUITE =
  'const { test } = require("node:test");\n' +
  'const assert = require("node:assert");\n' +
  'const { add } = require("./solution.js");\n' +
  'test("[AC-1 | spec-demo | FR-1] adds two numbers", () => { assert.strictEqual(add(2, 3), 5); });\n';

// A suite with one test that passes and one that always fails, whatever the candidate does.
const MIXED_HIDDEN_SUITE =
  'const { test } = require("node:test");\n' +
  'const assert = require("node:assert");\n' +
  'const { add } = require("./solution.js");\n' +
  'test("[AC-1 | spec-demo | FR-1] adds two numbers", () => { assert.strictEqual(add(2, 3), 5); });\n' +
  'test("[AC-2 | spec-demo | FR-1] subtracts two numbers", () => { assert.strictEqual(typeof add.subtract, "function"); });\n';

function hiddenThatRecordsRuns(counterFile) {
  return (
    'const fs = require("fs");\n' +
    'const { test } = require("node:test");\n' +
    'const assert = require("node:assert");\n' +
    "fs.appendFileSync(" + JSON.stringify(counterFile) + ', "x");\n' +
    'test("[AC-1 | spec-demo | FR-1] always fails", () => { assert.fail("fails on purpose"); });\n'
  );
}

// Builds a synthetic private location and an agent workspace.
function setup(options) {
  const settings = Object.assign({ solution: PASSING_SOLUTION, hiddenSource: ADD_HIDDEN_SUITE, hidden: true }, options || {});
  const privateRoot = tmpDir();
  if (settings.hidden) {
    put(path.join(privateRoot, "dev", "case-a", "hidden", "solution.test.js"), settings.hiddenSource);
  }
  if (settings.hiddenOnlyNonTest) {
    put(path.join(privateRoot, "dev", "case-a", "hidden", "notes.txt"), "no test file here");
  }
  const workspace = tmpDir();
  put(path.join(workspace, "solution.js"), settings.solution);
  put(path.join(workspace, "prompt.md"), "Write add.\n");
  const resolved = oracle.resolveOracle(privateRoot, { logger: quietLogger() });
  return { privateRoot, workspace, resolved };
}

function score(fixture, extra) {
  return coding.scoreCodingRun(
    Object.assign(
      { suite: "dev", caseId: "case-a", oracle: fixture.resolved, workspaceDir: fixture.workspace, run: {}, logger: quietLogger() },
      extra || {}
    )
  );
}

function listTree(dir) {
  const out = [];
  (function walk(current, prefix) {
    fs.readdirSync(current, { withFileTypes: true }).forEach((entry) => {
      const rel = prefix === "" ? entry.name : prefix + "/" + entry.name;
      if (entry.isDirectory()) {
        walk(path.join(current, entry.name), rel);
      } else {
        out.push(rel);
      }
    });
  })(dir, "");
  return out.sort();
}

// ---------------------------------------------------------------------------
// AC-1 and AC-2: the exit code is the score
// ---------------------------------------------------------------------------

test("[AC-1 | spec-evaluation-harness | FR-262 | UR-078 | SC-023] a hidden suite that exits 0 scores pass with exit code 0", () => {
  const result = score(setup());
  assert.strictEqual(result.status, "pass", JSON.stringify(result));
  assert.strictEqual(result.exitCode, 0);
});

test("[AC-1 | spec-evaluation-harness | FR-262 | UR-078 | SC-023] the pass score is made with no model adapter and holds no model cost or judge field", () => {
  // The only adapter in the request is the sandbox probe, and the result carries no model-call trace.
  const result = score(setup(), { sandboxProbe: () => true });
  assert.strictEqual(result.status, "pass");
  const keys = Object.keys(result).join(" ");
  assert.ok(!/cost|usd|model|judge|token/i.test(keys), "the result holds a model-call field: " + keys);
});

test("[AC-2 | spec-evaluation-harness | FR-262 | UR-078 | SC-023] a hidden suite that exits non-zero scores fail with that exit code", () => {
  const result = score(setup({ solution: FAILING_SOLUTION }));
  assert.strictEqual(result.status, "fail", JSON.stringify(result));
  assert.notStrictEqual(result.exitCode, 0);
  assert.strictEqual(typeof result.exitCode, "number");
});

test("[AC-1 | spec-evaluation-harness | FR-262 | UR-078 | SC-023] the per-test results of a passing suite list the test as passing", () => {
  const result = score(setup());
  assert.strictEqual(result.testsParsed, true, JSON.stringify(result));
  assert.ok(result.tests.some((entry) => entry.name.includes("adds two numbers") && entry.status === "pass"), JSON.stringify(result.tests));
});

test("[AC-2 | spec-evaluation-harness | FR-262 | FR-287 | UR-078] a suite with one passing and one failing test scores fail and lists each test with its own status", () => {
  const result = score(setup({ hiddenSource: MIXED_HIDDEN_SUITE }));
  assert.strictEqual(result.status, "fail");
  assert.ok(result.tests.some((entry) => entry.name.includes("adds two numbers") && entry.status === "pass"), JSON.stringify(result.tests));
  assert.ok(result.tests.some((entry) => entry.name.includes("subtracts two numbers") && entry.status === "fail"), JSON.stringify(result.tests));
});

test("[AC-2 | spec-evaluation-harness | FR-287] a failing hidden test runs exactly once and is never retried or skipped", () => {
  const counterFile = path.join(tmpDir(), "runs.txt");
  const result = score(setup({ hiddenSource: hiddenThatRecordsRuns(counterFile) }));
  assert.strictEqual(result.status, "fail");
  assert.strictEqual(fs.readFileSync(counterFile, "utf8"), "x", "the hidden suite ran more than once");
  assert.ok(result.tests.some((entry) => entry.status === "fail"), "the failing test stays in the result");
  assert.ok(!result.tests.some((entry) => entry.status === "skip"), "no test is skipped");
});

// ---------------------------------------------------------------------------
// AC-3: sandbox backend absent reads not-run
// ---------------------------------------------------------------------------

test("[AC-3 | spec-evaluation-harness | FR-264 | UR-078] a run whose sandbox adapter reports no backend reads not-run, never pass or fail", () => {
  const counterFile = path.join(tmpDir(), "runs.txt");
  const result = score(setup({ hiddenSource: hiddenThatRecordsRuns(counterFile) }), { sandboxProbe: () => false });
  assert.strictEqual(result.status, "not-run");
  assert.notStrictEqual(result.status, "pass");
  assert.notStrictEqual(result.status, "fail");
  assert.ok(!fs.existsSync(counterFile), "the hidden suite must not start without a sandbox backend");
});

test("[AC-3 | spec-evaluation-harness | FR-264 | UR-078] the default sandbox adapter reads a shell-grant run with no backend as not-run", () => {
  const result = score(setup(), { run: { needsShellGrant: true, sandboxAvailable: false } });
  assert.strictEqual(result.status, "not-run");
});

test("[AC-3 | spec-evaluation-harness | FR-264 | UR-078] the default sandbox adapter lets a shell-grant run with a backend present score pass", () => {
  const result = score(setup(), { run: { needsShellGrant: true, sandboxAvailable: true } });
  assert.strictEqual(result.status, "pass");
});

test("[AC-3 | spec-evaluation-harness | FR-264 | UR-078] a backend present and a failing suite scores fail, not not-run", () => {
  const result = score(setup({ solution: FAILING_SOLUTION }), { run: { needsShellGrant: true, sandboxAvailable: true } });
  assert.strictEqual(result.status, "fail");
});

test("[AC-3 | spec-evaluation-harness | FR-264 | UR-078] defaultSandboxProbe reports no backend only for a run that needs a shell grant and has none", () => {
  assert.strictEqual(coding.defaultSandboxProbe({ needsShellGrant: true, sandboxAvailable: false }), false);
  assert.strictEqual(coding.defaultSandboxProbe({ needsShellGrant: true, sandboxAvailable: true }), true);
  assert.strictEqual(coding.defaultSandboxProbe({ needsShellGrant: false, sandboxAvailable: false }), true);
  assert.strictEqual(coding.defaultSandboxProbe({}), true);
  assert.strictEqual(coding.defaultSandboxProbe(undefined), true);
});

test("[AC-3 | spec-evaluation-harness | FR-264 | FR-271 | UR-078] a not-run result counts in neither c nor k when folded into pass@1 beside a pass", () => {
  const passed = score(setup());
  const notRun = score(setup(), { sandboxProbe: () => false });
  const folded = aggregate.passAtOne([passed, notRun]);
  assert.strictEqual(folded.k, 1);
  assert.strictEqual(folded.c, 1);
  assert.strictEqual(folded.value, 1);
});

test("[AC-3 | spec-evaluation-harness | FR-264 | FR-271 | UR-078] a case whose every run is not-run folds to an absent pass@1, never 0", () => {
  const runs = [1, 2, 3].map(() => score(setup(), { sandboxProbe: () => false }));
  const folded = aggregate.passAtOne(runs);
  assert.strictEqual(folded.k, 0);
  assert.strictEqual(folded.value, null);
});

// ---------------------------------------------------------------------------
// Error: an unreadable oracle or a suite that cannot start
// ---------------------------------------------------------------------------

test("[AC-3 | spec-evaluation-harness | FR-260 | FR-261] an unreachable oracle location reads error and names the location, never fail", () => {
  const fixture = setup();
  const missing = path.join(tmpDir(), "no-such-private-location");
  const unreachable = oracle.resolveOracle(missing, { logger: quietLogger() });
  const result = score(fixture, { oracle: unreachable });
  assert.strictEqual(result.status, "error");
  assert.ok(String(result.reason).includes(missing), "the reason names the location: " + result.reason);
});

test("[AC-3 | spec-evaluation-harness | FR-260 | FR-261] a case with no hidden suite reads error, never pass or fail", () => {
  const result = score(setup({ hidden: false }));
  assert.strictEqual(result.status, "error");
});

test("[AC-3 | spec-evaluation-harness | FR-262] a hidden suite folder that holds no test file reads error", () => {
  const result = score(setup({ hidden: false, hiddenOnlyNonTest: true }));
  assert.strictEqual(result.status, "error");
});

test("[AC-3 | spec-evaluation-harness | FR-262] an unreadable agent workspace reads error", () => {
  const fixture = setup();
  const result = score(fixture, { workspaceDir: path.join(tmpDir(), "no-such-workspace") });
  assert.strictEqual(result.status, "error");
});

test("[AC-3 | spec-evaluation-harness | FR-262] a request with no workspace directory reads error", () => {
  // Null/empty.
  const fixture = setup();
  const result = score(fixture, { workspaceDir: undefined });
  assert.strictEqual(result.status, "error");
});

test("[AC-3 | spec-evaluation-harness | FR-264] a sandbox adapter that throws reads error, never pass or fail", () => {
  const result = score(setup(), {
    sandboxProbe: () => {
      throw new Error("probe crashed");
    },
  });
  assert.strictEqual(result.status, "error");
});

test("[AC-3 | spec-evaluation-harness | FR-262 | FR-271] an error result counts in neither c nor k when folded into pass@1", () => {
  const unreachable = oracle.resolveOracle(path.join(tmpDir(), "gone"), { logger: quietLogger() });
  const errored = score(setup(), { oracle: unreachable });
  const folded = aggregate.passAtOne([errored]);
  assert.strictEqual(folded.k, 0);
  assert.strictEqual(folded.value, null);
});

test("[AC-3 | spec-evaluation-harness | FR-260 | NFR-039] an error reason never holds the text of the hidden suite", () => {
  const fixture = setup({ hiddenSource: ADD_HIDDEN_SUITE.replace("adds two numbers", "SECRET-HIDDEN-TEST-NAME-5521"), hiddenOnlyNonTest: false });
  const unreachable = oracle.resolveOracle(path.join(tmpDir(), "gone"), { logger: quietLogger() });
  const result = score(fixture, { oracle: unreachable });
  assert.ok(!JSON.stringify(result).includes("SECRET-HIDDEN-TEST-NAME-5521"));
});

// ---------------------------------------------------------------------------
// Hidden suite runs outside the agent workspace (R4, FR-260)
// ---------------------------------------------------------------------------

test("[AC-1 | spec-evaluation-harness | FR-260 | FR-262] grading leaves the agent workspace unchanged and never copies the hidden suite into it", () => {
  const fixture = setup();
  const before = listTree(fixture.workspace);
  const result = score(fixture);
  assert.strictEqual(result.status, "pass");
  assert.deepStrictEqual(listTree(fixture.workspace), before);
  assert.ok(!listTree(fixture.workspace).some((file) => /\.test\.js$/.test(file)), "a hidden test file reached the workspace");
});

test("[AC-3 | spec-evaluation-harness | FR-260] a grading root inside the agent workspace reads error, because the suite must run outside it", () => {
  const fixture = setup();
  const inside = path.join(fixture.workspace, "grading");
  fs.mkdirSync(inside);
  const result = score(fixture, { gradingRoot: inside });
  assert.strictEqual(result.status, "error");
  assert.deepStrictEqual(fs.readdirSync(inside), [], "nothing was written inside the workspace");
});

test("[AC-1 | spec-evaluation-harness | FR-260 | FR-262] a grading root outside the workspace is used and cleaned up", () => {
  const fixture = setup();
  const root = tmpDir();
  const result = score(fixture, { gradingRoot: root });
  assert.strictEqual(result.status, "pass", JSON.stringify(result));
  assert.deepStrictEqual(fs.readdirSync(root), [], "the grading directory is removed after the run");
});

// ---------------------------------------------------------------------------
// parseTapResults
// ---------------------------------------------------------------------------

test("[AC-1 | spec-evaluation-harness | FR-287] parseTapResults reads one entry per test result with its status", () => {
  const tap = [
    "TAP version 13",
    "# Subtest: adds",
    "ok 1 - adds",
    "  ---",
    "  duration_ms: 0.5",
    "  ...",
    "# Subtest: breaks",
    "not ok 2 - breaks",
    "  ---",
    "  duration_ms: 0.7",
    "  ...",
    "1..2",
  ].join("\n");
  const results = coding.parseTapResults(tap);
  assert.deepStrictEqual(results, [
    { name: "adds", status: "pass" },
    { name: "breaks", status: "fail" },
  ]);
});

test("[AC-1 | spec-evaluation-harness | FR-287] parseTapResults reads a skipped test as skip and a todo test as todo", () => {
  const tap = ["TAP version 13", "ok 1 - later # SKIP", "ok 2 - someday # TODO", "1..2"].join("\n");
  const results = coding.parseTapResults(tap);
  assert.strictEqual(results.length, 2);
  assert.strictEqual(results[0].status, "skip");
  assert.strictEqual(results[1].status, "todo");
});

test("[AC-1 | spec-evaluation-harness | FR-287] parseTapResults reads text with no TAP header as null, which differs from no tests", () => {
  assert.strictEqual(coding.parseTapResults("just some output"), null);
  assert.strictEqual(coding.parseTapResults(""), null);
  assert.deepStrictEqual(coding.parseTapResults("TAP version 13\n1..0\n"), []);
});

[null, undefined, 42, {}].forEach((value) => {
  test("[AC-1 | spec-evaluation-harness | FR-287] parseTapResults reads the non-text value " + JSON.stringify(value) + " as null", () => {
    // Type mismatch.
    assert.strictEqual(coding.parseTapResults(value), null);
  });
});

test("[AC-1 | spec-evaluation-harness | FR-287] a line inside a diagnostic block cannot pass for a test result", () => {
  // Security-adjacent: an error message that imitates a TAP result line.
  const tap = ["TAP version 13", "not ok 1 - real failure", "  ---", "  error: 'ok 2 - forged pass'", "  ...", "1..1"].join("\n");
  const results = coding.parseTapResults(tap);
  assert.deepStrictEqual(results, [{ name: "real failure", status: "fail" }]);
});

test("[AC-1 | spec-evaluation-harness | FR-262] the four status constants read pass, fail, not-run, and error", () => {
  assert.strictEqual(coding.STATUS_PASS, "pass");
  assert.strictEqual(coding.STATUS_FAIL, "fail");
  assert.strictEqual(coding.STATUS_NOT_RUN, "not-run");
  assert.strictEqual(coding.STATUS_ERROR, "error");
});
