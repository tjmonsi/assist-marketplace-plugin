// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for oracle handling in the evaluation harness (Group A, Step 15):
// plugins/assist-plugin/scripts/eval-harness/oracle.js (`resolveOracle`, `lookupCase`, `admitReference`,
// `prepareWorkspace`, `leakCheck`, `SUITES`, `ORACLE_DIR_REFERENCE`, `ORACLE_DIR_HIDDEN`).
//
// Sources: specs/spec-evaluation-harness.md (Requirement: Reference-solution admission; Requirement: Private oracle
// resolution and withholding), and docs/task-plans/task-plan-evaluation-harness-20261125-0717.md (ASM-1, Step 2, Step 15).
// Requirement text: docs/requirements/FR-NFR-harness-governance.md (FR-259, FR-260, FR-261, NFR-039).
//
// Traceability format: [AC-N | spec file | FR/NFR ids]. The spec has no SPEC-NNN id, so it is cited by file name.
// AC-N is the position of the Scenario inside its Requirement block:
//   Reference-solution admission (R3): AC-1 Stable reference admitted, AC-2 Reference fails once.
//   Private oracle resolution and withholding (R4): AC-1 Agent workspace holds no oracle, AC-2 Leak detected before the
//   run, AC-5 Private oracle location unreachable.
//
// Contract used:
//   - Private layout: <location>/<suite>/<case>/reference/ and <location>/<suite>/<case>/hidden/, suite "dev" or "spec".
//   - resolveOracle(location) returns { ok: true, ... } for a readable directory and { ok: false, code, location, message }
//     for an unset, absent, or unreadable location; the message names the location and the result holds no score.
//   - admitReference({ oracle, suite, caseId, runs }) returns { admitted, failingRun, runs, reason }. The hidden suite is
//     a Node --test suite (ASM-6). `runs` has no default.
//   - prepareWorkspace(publicDir, { workspaceDir }) builds a workspace of public task material, with the reference and the
//     hidden suite withheld. leakCheck(workspaceDir, oracleDirs) returns { ok, abort, leakedPath, ... }.
//   - No oracle file content reaches a log line.
//   - All fixtures are synthetic stand-ins built under os.tmpdir(). No real oracle content is committed (ASM-1).
//
// Run: node --test tests/scripts/eval-harness-oracle.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLUGIN = path.join(__dirname, "..", "..", "plugins", "assist-plugin");
const oracle = require(path.join(PLUGIN, "scripts", "eval-harness", "oracle.js"));

const SENTINEL = "ORACLE-SENTINEL-7731-DO-NOT-LOG";
const SOLUTION_SOURCE = "module.exports = { add: function (a, b) { return a + b; } };\n";
const BROKEN_SOLUTION_SOURCE = "module.exports = { add: function (a, b) { return a - b; } };\n";

const created = [];
after(() => {
  created.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-oracle-test-"));
  created.push(dir);
  return dir;
}

function put(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function hiddenSuiteSource(name) {
  return (
    "// " + SENTINEL + "\n" +
    'const { test } = require("node:test");\n' +
    'const assert = require("node:assert");\n' +
    'const { add } = require("./solution.js");\n' +
    "test(" + JSON.stringify(name) + ", () => { assert.strictEqual(add(2, 3), 5); });\n"
  );
}

// A hidden suite that fails on its Nth execution, counted in a file outside the private location.
function countingHiddenSource(counterFile, failOn) {
  return (
    'const fs = require("fs");\n' +
    'const { test } = require("node:test");\n' +
    'const assert = require("node:assert");\n' +
    "const counter = " + JSON.stringify(counterFile) + ";\n" +
    "let n = 0;\n" +
    'try { n = Number(fs.readFileSync(counter, "utf8")); } catch (error) { n = 0; }\n' +
    "n += 1;\n" +
    "fs.writeFileSync(counter, String(n));\n" +
    'test("[AC-1 | spec-demo | FR-1] counts its own runs", () => { assert.notStrictEqual(n, ' + failOn + "); });\n"
  );
}

// Builds a synthetic private location with one coding case. Returns { location, referenceDir, hiddenDir }.
function makePrivate(options) {
  const settings = options || {};
  const location = tmpDir();
  const caseId = settings.caseId || "case-a";
  const referenceDir = path.join(location, "dev", caseId, "reference");
  const hiddenDir = path.join(location, "dev", caseId, "hidden");
  if (settings.reference !== false) {
    put(path.join(referenceDir, "solution.js"), settings.referenceSource || SOLUTION_SOURCE);
  }
  if (settings.hidden !== false) {
    put(path.join(hiddenDir, "solution.test.js"), settings.hiddenSource || hiddenSuiteSource("[AC-1 | spec-demo | FR-1] adds two numbers"));
  }
  return { location, referenceDir, hiddenDir, caseId };
}

function quietLogger() {
  const lines = [];
  const logger = (level, message, fields) => {
    lines.push(JSON.stringify({ level, message, fields: fields || {} }));
  };
  logger.lines = lines;
  return logger;
}

// ---------------------------------------------------------------------------
// Private oracle location unreachable (R4 AC-5)
// ---------------------------------------------------------------------------

test("[AC-5 | spec-evaluation-harness | FR-260 | FR-261] SUITES names the dev and spec suites and the oracle directory names are reference and hidden", () => {
  assert.deepStrictEqual(oracle.SUITES, ["dev", "spec"]);
  assert.strictEqual(oracle.ORACLE_DIR_REFERENCE, "reference");
  assert.strictEqual(oracle.ORACLE_DIR_HIDDEN, "hidden");
});

test("[AC-5 | spec-evaluation-harness | FR-260 | FR-261] a readable private location resolves ok", () => {
  const fixture = makePrivate();
  const result = oracle.resolveOracle(fixture.location, { logger: quietLogger() });
  assert.strictEqual(result.ok, true);
});

test("[AC-5 | spec-evaluation-harness | FR-260 | FR-261] an absent private location is an error that names the location and carries no score", () => {
  const missing = path.join(tmpDir(), "no-such-private-location");
  const result = oracle.resolveOracle(missing, { logger: quietLogger() });
  assert.strictEqual(result.ok, false);
  assert.ok(result.code, "the error carries a code");
  assert.strictEqual(result.location, missing);
  assert.ok(String(result.message).includes(missing), "the message names the unreachable location");
  assert.ok(!Object.prototype.hasOwnProperty.call(result, "score"), "an unreachable location must not read as a score");
  assert.ok(!Object.prototype.hasOwnProperty.call(result, "status"), "an unreachable location must not read as pass or fail");
});

test("[AC-5 | spec-evaluation-harness | FR-260 | FR-261] a private location that is a file, not a directory, is unreachable", () => {
  // Type mismatch: a file where a directory is expected.
  const file = path.join(tmpDir(), "not-a-directory");
  put(file, "x");
  const result = oracle.resolveOracle(file, { logger: quietLogger() });
  assert.strictEqual(result.ok, false);
  assert.ok(String(result.message).includes(file));
});

[undefined, null, "", "   "].forEach((value) => {
  // Null/empty: no location configured.
  test("[AC-5 | spec-evaluation-harness | FR-260 | FR-261] an unset private location (" + JSON.stringify(value) + ") is an error and never a score", () => {
    const result = oracle.resolveOracle(value, { logger: quietLogger() });
    assert.strictEqual(result.ok, false);
    assert.ok(result.code);
    assert.ok(!Object.prototype.hasOwnProperty.call(result, "score"));
  });
});

test("[AC-5 | spec-evaluation-harness | FR-260 | FR-261] an unreachable oracle blocks admission, and the result is not an admission", () => {
  const missing = path.join(tmpDir(), "gone");
  const resolved = oracle.resolveOracle(missing, { logger: quietLogger() });
  const result = oracle.admitReference({ oracle: resolved, suite: "dev", caseId: "case-a", runs: 3, logger: quietLogger() });
  assert.strictEqual(result.admitted, false);
  assert.strictEqual(result.failingRun, null);
});

// ---------------------------------------------------------------------------
// Case lookup
// ---------------------------------------------------------------------------

test("[R4 | spec-evaluation-harness | FR-260] lookupCase finds the reference and hidden directories of a populated case", () => {
  const fixture = makePrivate();
  const resolved = oracle.resolveOracle(fixture.location, { logger: quietLogger() });
  const found = oracle.lookupCase(resolved, "dev", fixture.caseId);
  assert.strictEqual(found.ok, true);
  assert.ok(found.referenceDir);
  assert.ok(found.hiddenDir);
});

test("[R4 | spec-evaluation-harness | FR-260] lookupCase reads a missing hidden suite as null so the caller can name it", () => {
  const fixture = makePrivate({ hidden: false });
  const resolved = oracle.resolveOracle(fixture.location, { logger: quietLogger() });
  const found = oracle.lookupCase(resolved, "dev", fixture.caseId);
  assert.strictEqual(found.ok, true);
  assert.strictEqual(found.hiddenDir, null);
  assert.ok(found.referenceDir);
});

test("[R4 | spec-evaluation-harness | FR-260] lookupCase refuses a suite that is not dev or spec", () => {
  const fixture = makePrivate();
  const resolved = oracle.resolveOracle(fixture.location, { logger: quietLogger() });
  assert.strictEqual(oracle.lookupCase(resolved, "prod", fixture.caseId).ok, false);
});

["../escape", "a/b", "..", ""].forEach((caseId) => {
  test("[R4 | spec-evaluation-harness | FR-260] lookupCase refuses the case id " + JSON.stringify(caseId) + " (path traversal)", () => {
    // Security-adjacent: a case id must not leave the private location.
    const fixture = makePrivate();
    const resolved = oracle.resolveOracle(fixture.location, { logger: quietLogger() });
    assert.strictEqual(oracle.lookupCase(resolved, "dev", caseId).ok, false);
  });
});

test("[R4 | spec-evaluation-harness | FR-260] lookupCase on an unreachable oracle passes the error on", () => {
  const resolved = oracle.resolveOracle(path.join(tmpDir(), "gone"), { logger: quietLogger() });
  const found = oracle.lookupCase(resolved, "dev", "case-a");
  assert.strictEqual(found.ok, false);
  assert.ok(found.code);
});

// ---------------------------------------------------------------------------
// Reference-solution admission (R3)
// ---------------------------------------------------------------------------

test("[AC-1 | spec-evaluation-harness | FR-259] a reference that passes the hidden suite on 3 consecutive runs is admitted", () => {
  const fixture = makePrivate();
  const resolved = oracle.resolveOracle(fixture.location, { logger: quietLogger() });
  const result = oracle.admitReference({ oracle: resolved, suite: "dev", caseId: fixture.caseId, runs: 3, logger: quietLogger() });
  assert.strictEqual(result.admitted, true, JSON.stringify(result));
  assert.strictEqual(result.failingRun, null);
  assert.strictEqual(result.runs, 3);
});

test("[AC-2 | spec-evaluation-harness | FR-259] a reference that fails the hidden suite on run 2 of 3 is not admitted and the report names run 2", () => {
  const counterFile = path.join(tmpDir(), "counter.txt");
  const fixture = makePrivate({ hiddenSource: countingHiddenSource(counterFile, 2) });
  const resolved = oracle.resolveOracle(fixture.location, { logger: quietLogger() });
  const result = oracle.admitReference({ oracle: resolved, suite: "dev", caseId: fixture.caseId, runs: 3, logger: quietLogger() });
  assert.strictEqual(result.admitted, false);
  assert.strictEqual(result.failingRun, 2);
  assert.ok(String(result.reason).includes("2"), "the reason names the failing run: " + result.reason);
});

test("[AC-2 | spec-evaluation-harness | FR-259] a reference that fails the hidden suite on its first run names run 1", () => {
  // Boundary: the first run fails.
  const fixture = makePrivate({ referenceSource: BROKEN_SOLUTION_SOURCE });
  const resolved = oracle.resolveOracle(fixture.location, { logger: quietLogger() });
  const result = oracle.admitReference({ oracle: resolved, suite: "dev", caseId: fixture.caseId, runs: 3, logger: quietLogger() });
  assert.strictEqual(result.admitted, false);
  assert.strictEqual(result.failingRun, 1);
});

test("[AC-1 | spec-evaluation-harness | FR-259] a configured count of 1 admits a passing reference after one run", () => {
  // Boundary: the smallest valid count.
  const counterFile = path.join(tmpDir(), "counter.txt");
  const fixture = makePrivate({ hiddenSource: countingHiddenSource(counterFile, 99) });
  const resolved = oracle.resolveOracle(fixture.location, { logger: quietLogger() });
  const result = oracle.admitReference({ oracle: resolved, suite: "dev", caseId: fixture.caseId, runs: 1, logger: quietLogger() });
  assert.strictEqual(result.admitted, true, JSON.stringify(result));
  assert.strictEqual(fs.readFileSync(counterFile, "utf8"), "1", "the reference ran exactly the configured number of times");
});

test("[AC-1 | spec-evaluation-harness | FR-259] a configured count of 3 runs the reference exactly 3 times for a stable reference", () => {
  const counterFile = path.join(tmpDir(), "counter.txt");
  const fixture = makePrivate({ hiddenSource: countingHiddenSource(counterFile, 99) });
  const resolved = oracle.resolveOracle(fixture.location, { logger: quietLogger() });
  const result = oracle.admitReference({ oracle: resolved, suite: "dev", caseId: fixture.caseId, runs: 3, logger: quietLogger() });
  assert.strictEqual(result.admitted, true);
  assert.strictEqual(fs.readFileSync(counterFile, "utf8"), "3");
});

[undefined, null, 0, -1, 2.5, "3"].forEach((runs) => {
  test("[AC-1 | spec-evaluation-harness | FR-259] a validation run count of " + JSON.stringify(runs) + " admits nothing, because the count has no default", () => {
    // Null/empty, boundary, and type mismatch for the configured count.
    const fixture = makePrivate();
    const resolved = oracle.resolveOracle(fixture.location, { logger: quietLogger() });
    const result = oracle.admitReference({ oracle: resolved, suite: "dev", caseId: fixture.caseId, runs, logger: quietLogger() });
    assert.strictEqual(result.admitted, false);
  });
});

test("[AC-2 | spec-evaluation-harness | FR-259] a coding case with no hidden suite is not admitted and the reason names the hidden suite", () => {
  const fixture = makePrivate({ hidden: false });
  const resolved = oracle.resolveOracle(fixture.location, { logger: quietLogger() });
  const result = oracle.admitReference({ oracle: resolved, suite: "dev", caseId: fixture.caseId, runs: 3, logger: quietLogger() });
  assert.strictEqual(result.admitted, false);
  assert.match(String(result.reason), /hidden/i);
});

test("[AC-2 | spec-evaluation-harness | FR-259] a coding case with no reference solution is not admitted and the reason names the reference", () => {
  const fixture = makePrivate({ reference: false });
  const resolved = oracle.resolveOracle(fixture.location, { logger: quietLogger() });
  const result = oracle.admitReference({ oracle: resolved, suite: "dev", caseId: fixture.caseId, runs: 3, logger: quietLogger() });
  assert.strictEqual(result.admitted, false);
  assert.match(String(result.reason), /reference/i);
});

test("[AC-1 | spec-evaluation-harness | FR-259 | NFR-039] admission logs hold no oracle file content", () => {
  const fixture = makePrivate();
  const resolved = oracle.resolveOracle(fixture.location, { logger: quietLogger() });
  const logger = quietLogger();
  oracle.admitReference({ oracle: resolved, suite: "dev", caseId: fixture.caseId, runs: 2, logger });
  assert.ok(logger.lines.length > 0, "admission logs its progress");
  assert.ok(!logger.lines.join("\n").includes(SENTINEL), "a log line held oracle file content");
});

// ---------------------------------------------------------------------------
// Agent workspace holds no oracle (R4 AC-1)
// ---------------------------------------------------------------------------

function makePublicTask(extra) {
  const publicDir = path.join(tmpDir(), "dev", "case-a");
  put(path.join(publicDir, "prompt.md"), "Write an add function.\n");
  put(path.join(publicDir, "graders", "grader.json"), "{}\n");
  put(path.join(publicDir, "task.json"), "{}\n");
  put(path.join(publicDir, "src", "starter.js"), "// starter\n");
  if (extra) {
    extra(publicDir);
  }
  return publicDir;
}

test("[AC-1 | spec-evaluation-harness | FR-260] a prepared workspace holds the public task material and no oracle file", () => {
  const fixture = makePrivate();
  const publicDir = makePublicTask();
  const prepared = oracle.prepareWorkspace(publicDir, { logger: quietLogger() });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  created.push(prepared.workspaceDir);
  assert.ok(prepared.files.indexOf("prompt.md") !== -1, "the prompt is in the workspace");
  assert.ok(prepared.files.indexOf("src/starter.js") !== -1, "public starter code is in the workspace");
  const leak = oracle.leakCheck(prepared.workspaceDir, [fixture.referenceDir, fixture.hiddenDir], { logger: quietLogger() });
  assert.strictEqual(leak.ok, true, JSON.stringify(leak));
  assert.strictEqual(leak.abort, false);
});

test("[AC-1 | spec-evaluation-harness | FR-260] a prepared workspace leaves out a reference or hidden directory that sits in the public material", () => {
  const publicDir = makePublicTask((dir) => {
    put(path.join(dir, "reference", "answer.js"), SOLUTION_SOURCE);
    put(path.join(dir, "hidden", "answer.test.js"), hiddenSuiteSource("[AC-1 | spec-demo | FR-1] x"));
  });
  const prepared = oracle.prepareWorkspace(publicDir, { logger: quietLogger() });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  created.push(prepared.workspaceDir);
  prepared.files.forEach((file) => {
    assert.ok(!/(^|\/)(reference|hidden)(\/|$)/i.test(file), "the workspace holds an oracle-named path: " + file);
  });
  assert.ok(!fs.existsSync(path.join(prepared.workspaceDir, "reference")));
  assert.ok(!fs.existsSync(path.join(prepared.workspaceDir, "hidden")));
});

test("[AC-1 | spec-evaluation-harness | FR-260] a workspace prepared into a named empty directory fills that directory", () => {
  const publicDir = makePublicTask();
  const target = path.join(tmpDir(), "workspace");
  const prepared = oracle.prepareWorkspace(publicDir, { workspaceDir: target, logger: quietLogger() });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  assert.strictEqual(prepared.workspaceDir, target);
  assert.ok(fs.existsSync(path.join(target, "prompt.md")));
});

test("[AC-1 | spec-evaluation-harness | FR-260] a workspace directory that already holds files is refused", () => {
  const publicDir = makePublicTask();
  const target = tmpDir();
  put(path.join(target, "stale.txt"), "left over");
  const prepared = oracle.prepareWorkspace(publicDir, { workspaceDir: target, logger: quietLogger() });
  assert.strictEqual(prepared.ok, false);
  assert.ok(fs.existsSync(path.join(target, "stale.txt")), "the existing file stays untouched");
});

test("[AC-1 | spec-evaluation-harness | FR-260] an unreadable public task directory is a failed preparation", () => {
  const prepared = oracle.prepareWorkspace(path.join(tmpDir(), "no-such-task"), { logger: quietLogger() });
  assert.strictEqual(prepared.ok, false);
});

// ---------------------------------------------------------------------------
// Leak detected before the run (R4 AC-2)
// ---------------------------------------------------------------------------

test("[AC-2 | spec-evaluation-harness | FR-260] a workspace that holds a copy of a hidden-suite file aborts the run and names the leaked path", () => {
  const fixture = makePrivate();
  const workspace = tmpDir();
  put(path.join(workspace, "prompt.md"), "Write an add function.\n");
  // The leaked file has the content of an oracle file under an innocent name.
  put(path.join(workspace, "notes", "copy.js"), fs.readFileSync(path.join(fixture.hiddenDir, "solution.test.js"), "utf8"));
  const leak = oracle.leakCheck(workspace, [fixture.referenceDir, fixture.hiddenDir], { logger: quietLogger() });
  assert.strictEqual(leak.ok, false);
  assert.strictEqual(leak.abort, true);
  assert.strictEqual(leak.leakedPath, "notes/copy.js");
});

test("[AC-2 | spec-evaluation-harness | FR-260] a workspace that holds a copy of the reference solution aborts the run and names the leaked path", () => {
  const fixture = makePrivate();
  const workspace = tmpDir();
  put(path.join(workspace, "solution-backup.js"), fs.readFileSync(path.join(fixture.referenceDir, "solution.js"), "utf8"));
  const leak = oracle.leakCheck(workspace, [fixture.referenceDir, fixture.hiddenDir], { logger: quietLogger() });
  assert.strictEqual(leak.abort, true);
  assert.strictEqual(leak.leakedPath, "solution-backup.js");
});

test("[AC-2 | spec-evaluation-harness | FR-260] a workspace file under a directory named hidden aborts the run and names the path", () => {
  const fixture = makePrivate();
  const workspace = tmpDir();
  put(path.join(workspace, "hidden", "extra.txt"), "different content, oracle-named directory");
  const leak = oracle.leakCheck(workspace, [fixture.referenceDir, fixture.hiddenDir], { logger: quietLogger() });
  assert.strictEqual(leak.ok, false);
  assert.strictEqual(leak.abort, true);
  assert.strictEqual(leak.leakedPath, "hidden/extra.txt");
});

test("[AC-2 | spec-evaluation-harness | FR-260] a leak check that cannot read the oracle directories aborts rather than passing", () => {
  // The check fails closed: no oracle listing means no proof of a clean workspace.
  const workspace = tmpDir();
  put(path.join(workspace, "prompt.md"), "x");
  const leak = oracle.leakCheck(workspace, [path.join(tmpDir(), "no-such-oracle-dir")], { logger: quietLogger() });
  assert.strictEqual(leak.ok, false);
  assert.strictEqual(leak.abort, true);
});

test("[AC-2 | spec-evaluation-harness | FR-260] a clean workspace passes the leak check", () => {
  const fixture = makePrivate();
  const workspace = tmpDir();
  put(path.join(workspace, "prompt.md"), "Write an add function.\n");
  put(path.join(workspace, "src", "main.js"), "// the agent starts here\n");
  const leak = oracle.leakCheck(workspace, [fixture.referenceDir, fixture.hiddenDir], { logger: quietLogger() });
  assert.strictEqual(leak.ok, true);
  assert.strictEqual(leak.abort, false);
  assert.strictEqual(leak.leakedPath, null);
});

test("[AC-2 | spec-evaluation-harness | FR-260 | NFR-039] the leak report and its log hold the leaked path and never the oracle file content", () => {
  const fixture = makePrivate();
  const workspace = tmpDir();
  put(path.join(workspace, "notes", "copy.js"), fs.readFileSync(path.join(fixture.hiddenDir, "solution.test.js"), "utf8"));
  const logger = quietLogger();
  const leak = oracle.leakCheck(workspace, [fixture.referenceDir, fixture.hiddenDir], { logger });
  assert.strictEqual(leak.abort, true);
  assert.ok(!JSON.stringify(leak).includes(SENTINEL), "the leak result held oracle content");
  assert.ok(!logger.lines.join("\n").includes(SENTINEL), "a log line held oracle content");
});
