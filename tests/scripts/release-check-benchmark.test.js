// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the benchmark scoreboard section of release-check (Group A, Step 17):
// plugins/assist-plugin/scripts/release/benchmark-scoreboard.js (`check(root, { benchmark, harnessEntry, scoreboardPath })`,
// `DEFAULT_HARNESS_ENTRY`) and its wiring in plugins/assist-plugin/scripts/release-check.js (`run({ root, benchmark,
// sections })`, `defaultSections()`).
//
// Sources: specs/spec-evaluation-harness.md (Requirement: Benchmark section and release-over-release comparison, Scenarios
// Plain release check does not run the suites, Requested run, Scoreboard row missing), the FR-250 benchmark scoreboard
// statement in docs/requirements/FR-NFR-assist-plugin.md (line 5346), specs/spec-release-check.md (Change Log 2026-11-25,
// Requirement 9), and docs/task-plans/task-plan-evaluation-harness-20261125-0717.md (ASM-2, ASM-5, Step 13, Step 17).
// Requirement text: FR-250, FR-273, FR-274, FR-276, FR-277, UR-044, UR-051, UR-079, D-15, OQ-13 (settled).
//
// Traceability format: [AC-N | spec file | FR/NFR ids | UR ids]. The spec has no SPEC-NNN id, so it is cited by file
// name. AC-N is the position of the Scenario inside Requirement "Benchmark section and release-over-release comparison"
// (R9): AC-3 Plain release check does not run the suites, AC-4 Requested run, AC-8 Scoreboard row missing. The three
// FR-250 scenarios (Default run reports the stored scoreboard, No stored scoreboard, Suite run requested) belong to
// spec-release-check Requirement 9 and carry the label SRC-R9.
//
// Contract used:
//   - check returns { outcome: "clean" | "finding" | "error", details: [lines] }.
//   - A default run (no benchmark request) reads the stored scoreboard, prints its latest rows, returns clean, and starts no
//     suite. With no stored scoreboard it prints that none is stored, returns clean, and starts no suite.
//   - A benchmark request starts the Group A harness entry and no other runner. It returns finding when the harness exits
//     1 (a regression) or when the completed run left no scoreboard row for the version it recorded, and error with a
//     fixed reason (never raw stderr) for an operational failure.
//   - release-check.js keeps its run({ sections }) injection and sets context.benchmark from the --benchmark request.
//   - The harness entry is a stub script written under os.tmpdir(): no test runs a real benchmark or spends model cost.
//     release-check.run sets process.exitCode, so every exit-code case runs in a child process.
//
// Run: node --test tests/scripts/release-check-benchmark.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLUGIN = path.join(__dirname, "..", "..", "plugins", "assist-plugin");
const RELEASE_CHECK = path.join(PLUGIN, "scripts", "release-check.js");
const SECTION = path.join(PLUGIN, "scripts", "release", "benchmark-scoreboard.js");
const section = require(SECTION);
const releaseCheck = require(RELEASE_CHECK);
const scoreboardModule = require(path.join(PLUGIN, "scripts", "eval-harness", "scoreboard.js"));

const created = [];
after(() => {
  created.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "release-check-benchmark-test-"));
  created.push(dir);
  return dir;
}

// A stub harness entry. It records its arguments in a marker file, prints `stdout` and `stderr`, and exits with `exitCode`.
function makeStub(options) {
  const settings = Object.assign({ exitCode: 0, stdout: "", stderr: "" }, options || {});
  const dir = tmpDir();
  const marker = path.join(dir, "marker.txt");
  const script = path.join(dir, "stub-harness.js");
  const source =
    'const fs = require("fs");\n' +
    "fs.writeFileSync(" + JSON.stringify(marker) + ', process.argv.slice(2).join(" "));\n' +
    (settings.stdout ? "process.stdout.write(" + JSON.stringify(settings.stdout) + ");\n" : "") +
    (settings.stderr ? "process.stderr.write(" + JSON.stringify(settings.stderr) + ");\n" : "") +
    "process.exitCode = " + settings.exitCode + ";\n";
  fs.writeFileSync(script, source);
  return { script, marker };
}

const COMPLETED_RUN_LINES = "benchmark-version: 1.14.7\nbenchmark-suites: dev,spec\n";

function aggregateRow(version, suite) {
  const row = { version, suite, harnessVersion: "1.0.0", caseCount: 2 };
  if (suite === "dev") {
    row.passAtOne = 0.6;
  } else {
    row.structuralScore = 0.9;
    row.judgeScore = 0.7;
  }
  return row;
}

function storeRows(rows) {
  const file = path.join(tmpDir(), "scoreboard.json");
  const written = scoreboardModule.writeEntries({ scoreboardPath: file, aggregates: rows, cases: [] });
  assert.strictEqual(written.ok, true, JSON.stringify(written));
  return file;
}

function absentScoreboard() {
  return path.join(tmpDir(), "no-scoreboard.json");
}

function allDetails(result) {
  return result.details.join("\n");
}

// ---------------------------------------------------------------------------
// SRC-R9: a default run reports the stored scoreboard and starts no suite
// ---------------------------------------------------------------------------

test("[SRC-R9 | spec-evaluation-harness | FR-250 | FR-274 | UR-044] a default run with a stored scoreboard reports its latest rows, returns clean, and starts no suite", () => {
  const stub = makeStub({ stdout: COMPLETED_RUN_LINES });
  const file = storeRows([aggregateRow("1.14.6", "dev"), aggregateRow("1.14.7", "dev"), aggregateRow("1.14.7", "spec")]);
  const result = section.check(tmpDir(), { scoreboardPath: file, harnessEntry: stub.script });
  assert.strictEqual(result.outcome, "clean");
  assert.ok(allDetails(result).includes("1.14.7"), "the latest version is reported: " + allDetails(result));
  assert.ok(allDetails(result).includes("dev") && allDetails(result).includes("spec"), allDetails(result));
  assert.ok(!allDetails(result).includes("1.14.6"), "only the latest row of each suite is reported");
  assert.strictEqual(fs.existsSync(stub.marker), false, "a default run must not start the harness");
});

test("[SRC-R9 | spec-evaluation-harness | FR-250 | FR-274 | UR-044] a default run reports the stored scores", () => {
  const file = storeRows([aggregateRow("1.14.7", "dev"), aggregateRow("1.14.7", "spec")]);
  const result = section.check(tmpDir(), { scoreboardPath: file });
  assert.ok(allDetails(result).includes("0.6"), allDetails(result));
  assert.ok(allDetails(result).includes("0.9"), allDetails(result));
});

test("[SRC-R9 | spec-evaluation-harness | FR-250 | FR-274 | UR-044] a default run with no stored scoreboard says none is stored, returns clean, and starts no suite", () => {
  const stub = makeStub({ stdout: COMPLETED_RUN_LINES });
  const result = section.check(tmpDir(), { scoreboardPath: absentScoreboard(), harnessEntry: stub.script });
  assert.strictEqual(result.outcome, "clean");
  assert.ok(/stored/i.test(allDetails(result)) && /no |none/i.test(allDetails(result)), allDetails(result));
  assert.strictEqual(fs.existsSync(stub.marker), false, "a default run must not start the harness");
});

test("[SRC-R9 | spec-evaluation-harness | FR-250 | UR-044] a scoreboard file that holds no row reads the same as none stored", () => {
  // Null/empty.
  const stub = makeStub();
  const file = storeRows([]);
  const result = section.check(tmpDir(), { scoreboardPath: file, harnessEntry: stub.script });
  assert.strictEqual(result.outcome, "clean");
  assert.ok(/stored/i.test(allDetails(result)));
  assert.strictEqual(fs.existsSync(stub.marker), false);
});

test("[SRC-R9 | spec-evaluation-harness | FR-250 | UR-044] a default run reports no finding even when the stored scores are low", () => {
  const file = storeRows([Object.assign(aggregateRow("1.14.7", "dev"), { passAtOne: 0 })]);
  const result = section.check(tmpDir(), { scoreboardPath: file });
  assert.strictEqual(result.outcome, "clean", "a default run is informational and reports no finding");
});

test("[SRC-R9 | spec-evaluation-harness | FR-250 | NFR-039] a stored scoreboard that cannot be read is an error with a fixed reason and the file text is not echoed", () => {
  const file = path.join(tmpDir(), "scoreboard.json");
  fs.writeFileSync(file, "{ SENTINEL-RAW-FILE-TEXT ");
  const result = section.check(tmpDir(), { scoreboardPath: file });
  assert.strictEqual(result.outcome, "error");
  assert.ok(!allDetails(result).includes("SENTINEL-RAW-FILE-TEXT"));
  assert.ok(result.details.length >= 1);
});

test("[SRC-R9 | spec-evaluation-harness | FR-250 | NFR-039] a stored scoreboard that holds a refused entry is an error, not a report", () => {
  const file = path.join(tmpDir(), "scoreboard.json");
  fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, aggregates: [Object.assign(aggregateRow("1.14.7", "dev"), { leaked: "hidden-suite text of some length" })], cases: [] }));
  const result = section.check(tmpDir(), { scoreboardPath: file });
  assert.strictEqual(result.outcome, "error");
  assert.ok(!allDetails(result).includes("hidden-suite text of some length"));
});

test("[AC-3 | spec-evaluation-harness | FR-274 | D-15] a check called with no options is a default run and starts no suite", () => {
  // Null/empty: no benchmark request. The default scoreboard path is read; the outcome is clean or an unreadable-file error,
  // and never a finding, because a default run is informational.
  const result = section.check(tmpDir());
  assert.notStrictEqual(result.outcome, "finding");
  assert.ok(Array.isArray(result.details));
});

test("[AC-3 | spec-evaluation-harness | FR-274 | D-15] a benchmark value that is not exactly true is not a benchmark request", () => {
  // Type mismatch: a truthy string must not start a paid suite run.
  const stub = makeStub({ stdout: COMPLETED_RUN_LINES });
  const result = section.check(tmpDir(), { benchmark: "yes", scoreboardPath: absentScoreboard(), harnessEntry: stub.script });
  assert.strictEqual(result.outcome, "clean");
  assert.strictEqual(fs.existsSync(stub.marker), false);
});

// ---------------------------------------------------------------------------
// AC-4 and SRC-R9: a benchmark request starts the Group A harness
// ---------------------------------------------------------------------------

test("[AC-4 | spec-evaluation-harness | FR-274 | UR-079 | D-15] a benchmark request starts the harness entry and returns clean when the run left its rows", () => {
  const stub = makeStub({ stdout: COMPLETED_RUN_LINES });
  const file = storeRows([aggregateRow("1.14.7", "dev"), aggregateRow("1.14.7", "spec")]);
  const root = tmpDir();
  const result = section.check(root, { benchmark: true, scoreboardPath: file, harnessEntry: stub.script });
  assert.strictEqual(fs.existsSync(stub.marker), true, "the harness entry was not started");
  assert.strictEqual(result.outcome, "clean", allDetails(result));
});

test("[AC-4 | spec-evaluation-harness | FR-274 | UR-079 | D-15] the harness entry receives the repository root and the scoreboard path", () => {
  const stub = makeStub({ stdout: COMPLETED_RUN_LINES });
  const file = storeRows([aggregateRow("1.14.7", "dev"), aggregateRow("1.14.7", "spec")]);
  const root = tmpDir();
  section.check(root, { benchmark: true, scoreboardPath: file, harnessEntry: stub.script });
  const args = fs.readFileSync(stub.marker, "utf8");
  assert.ok(args.includes("--root") && args.includes(root), args);
  assert.ok(args.includes("--scoreboard") && args.includes(file), args);
});

test("[AC-4 | spec-evaluation-harness | FR-274 | D-15] the default harness entry is the Group A run-benchmark script and it exists, so no second runner is started", () => {
  assert.strictEqual(path.basename(section.DEFAULT_HARNESS_ENTRY), "run-benchmark.js");
  assert.strictEqual(path.basename(path.dirname(section.DEFAULT_HARNESS_ENTRY)), "eval-harness");
  assert.ok(fs.existsSync(section.DEFAULT_HARNESS_ENTRY));
});

test("[AC-4 | spec-evaluation-harness | FR-277 | UR-079] a harness that exits 1 for a regression returns a finding that carries the harness lines", () => {
  const stub = makeStub({ exitCode: 1, stdout: "dev: pass@1 current 0.7 (1.14.7), previous 0.8 (1.14.6)\nfinding: regression: suite dev pass@1 fell from 0.8 (1.14.6) to 0.7 (1.14.7), beyond the margin 0.05\n" });
  const result = section.check(tmpDir(), { benchmark: true, scoreboardPath: absentScoreboard(), harnessEntry: stub.script });
  assert.strictEqual(result.outcome, "finding");
  assert.ok(allDetails(result).includes("regression"), allDetails(result));
});

test("[AC-8 | spec-evaluation-harness | FR-276 | UR-079 | SC-024] a completed run with no scoreboard row for its version is a finding that names the version", () => {
  const stub = makeStub({ stdout: COMPLETED_RUN_LINES });
  // The scoreboard holds a row for the dev suite only, and none for spec.
  const file = storeRows([aggregateRow("1.14.7", "dev")]);
  const result = section.check(tmpDir(), { benchmark: true, scoreboardPath: file, harnessEntry: stub.script });
  assert.strictEqual(result.outcome, "finding");
  assert.ok(allDetails(result).includes("1.14.7"), allDetails(result));
  assert.ok(/spec/.test(allDetails(result)), allDetails(result));
});

test("[AC-8 | spec-evaluation-harness | FR-276 | UR-079 | SC-024] a completed run whose scoreboard holds rows only for another version is a finding that names the version", () => {
  const stub = makeStub({ stdout: COMPLETED_RUN_LINES });
  const file = storeRows([aggregateRow("1.14.6", "dev"), aggregateRow("1.14.6", "spec")]);
  const result = section.check(tmpDir(), { benchmark: true, scoreboardPath: file, harnessEntry: stub.script });
  assert.strictEqual(result.outcome, "finding");
  assert.ok(allDetails(result).includes("1.14.7"));
});

test("[AC-8 | spec-evaluation-harness | FR-276 | UR-079 | SC-024] a completed run with no scoreboard at all is a finding that names the version", () => {
  // Null/empty.
  const stub = makeStub({ stdout: COMPLETED_RUN_LINES });
  const result = section.check(tmpDir(), { benchmark: true, scoreboardPath: absentScoreboard(), harnessEntry: stub.script });
  assert.strictEqual(result.outcome, "finding");
  assert.ok(allDetails(result).includes("1.14.7"));
});

// ---------------------------------------------------------------------------
// Operational failures: error with a fixed reason, never raw stderr
// ---------------------------------------------------------------------------

test("[AC-4 | spec-evaluation-harness | FR-274 | NFR-031] a harness that exits 2 returns error with a fixed reason and none of its stderr text", () => {
  const stub = makeStub({ exitCode: 2, stdout: "error: private oracle location is unreachable: /somewhere\n", stderr: "RAW-STDERR-SECRET-9917 at /home/user/.ssh\n" });
  const result = section.check(tmpDir(), { benchmark: true, scoreboardPath: absentScoreboard(), harnessEntry: stub.script });
  assert.strictEqual(result.outcome, "error");
  assert.ok(!allDetails(result).includes("RAW-STDERR-SECRET-9917"), "a child's stderr reached the report");
  assert.match(allDetails(result), /benchmark harness failed/);
});

test("[AC-4 | spec-evaluation-harness | FR-274] the harness's own error line (an unreachable oracle) is kept in the report", () => {
  const stub = makeStub({ exitCode: 2, stdout: "benchmark: 1 case(s)\nerror: private oracle location is unreachable: /somewhere\n" });
  const result = section.check(tmpDir(), { benchmark: true, scoreboardPath: absentScoreboard(), harnessEntry: stub.script });
  assert.strictEqual(result.outcome, "error");
  assert.ok(allDetails(result).includes("private oracle location is unreachable"), allDetails(result));
});

test("[AC-4 | spec-evaluation-harness | FR-274] a harness entry that does not exist returns error and starts nothing", () => {
  const result = section.check(tmpDir(), { benchmark: true, scoreboardPath: absentScoreboard(), harnessEntry: path.join(tmpDir(), "no-such-harness.js") });
  assert.strictEqual(result.outcome, "error");
  assert.ok(result.details.length >= 1);
});

test("[AC-4 | spec-evaluation-harness | FR-274] a harness that exits 0 but reports no benchmark version returns error", () => {
  const stub = makeStub({ stdout: "benchmark: 1 case(s)\n" });
  const result = section.check(tmpDir(), { benchmark: true, scoreboardPath: absentScoreboard(), harnessEntry: stub.script });
  assert.strictEqual(result.outcome, "error");
});

test("[AC-4 | spec-evaluation-harness | FR-274] a harness that reports a version that is not a version number returns error", () => {
  // Invalid and injection-shaped: the version names a scoreboard row.
  const stub = makeStub({ stdout: "benchmark-version: ../../etc\nbenchmark-suites: dev\n" });
  const result = section.check(tmpDir(), { benchmark: true, scoreboardPath: absentScoreboard(), harnessEntry: stub.script });
  assert.strictEqual(result.outcome, "error");
});

test("[AC-4 | spec-evaluation-harness | FR-274 | NFR-039] a completed run whose scoreboard cannot be read returns error with a fixed reason", () => {
  const stub = makeStub({ stdout: COMPLETED_RUN_LINES });
  const file = path.join(tmpDir(), "scoreboard.json");
  fs.writeFileSync(file, "{ SENTINEL-RAW-FILE-TEXT ");
  const result = section.check(tmpDir(), { benchmark: true, scoreboardPath: file, harnessEntry: stub.script });
  assert.strictEqual(result.outcome, "error");
  assert.ok(!allDetails(result).includes("SENTINEL-RAW-FILE-TEXT"));
});

// ---------------------------------------------------------------------------
// release-check.js: the section list, the --benchmark request, and the exit codes
// ---------------------------------------------------------------------------

// release-check.run sets process.exitCode, so each case runs in a child process through a small driver.
const DRIVER_SOURCE = [
  'const rc = require(process.argv[2]);',
  'const bs = require(process.argv[3]);',
  "const spec = JSON.parse(process.argv[4]);",
  "let sections;",
  'if (spec.mode === "default") {',
  '  sections = rc.defaultSections().filter(function (s) { return s.name === "benchmark-scoreboard"; });',
  '} else if (spec.mode === "probe") {',
  '  sections = [{ name: "probe", run: function (ctx) { return { outcome: "clean", details: ["benchmark=" + String(ctx.benchmark)] }; } }];',
  "} else {",
  '  sections = [{ name: "benchmark-scoreboard", run: function (ctx) { return bs.check(ctx.root, { benchmark: true, harnessEntry: spec.harnessEntry, scoreboardPath: spec.scoreboardPath }); } }];',
  "}",
  "rc.run({ root: spec.root, benchmark: spec.benchmark, sections: sections });",
].join("\n");

function runDriver(spec) {
  const dir = tmpDir();
  const driver = path.join(dir, "driver.js");
  fs.writeFileSync(driver, DRIVER_SOURCE);
  const result = childProcess.spawnSync(process.execPath, [driver, RELEASE_CHECK, SECTION, JSON.stringify(spec)], { encoding: "utf8", timeout: 60000 });
  return { status: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

test("[AC-3 | spec-evaluation-harness | FR-250 | FR-274 | D-15] the real section list has the benchmark scoreboard section seventh, after agent-hygiene", () => {
  const names = releaseCheck.defaultSections().map((entry) => entry.name);
  assert.strictEqual(names.length, 7, JSON.stringify(names));
  assert.strictEqual(names[5], "agent-hygiene");
  assert.strictEqual(names[6], "benchmark-scoreboard");
});

test("[AC-3 | spec-evaluation-harness | FR-250 | FR-274 | D-15] the six sections that came before the benchmark section are still in place and in order", () => {
  const names = releaseCheck.defaultSections().map((entry) => entry.name);
  assert.deepStrictEqual(names.slice(0, 6), ["sync-writing-standard", "check-fsa-tables", "check-control-register", "scan-staged-secrets", "version-agreement", "agent-hygiene"]);
});

test("[AC-3 | spec-evaluation-harness | FR-250 | FR-274 | D-15] a release check run with no benchmark request gives its benchmark section no benchmark request", () => {
  const result = runDriver({ mode: "probe", root: tmpDir(), benchmark: false });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.includes("benchmark=false"), result.stdout);
});

test("[AC-4 | spec-evaluation-harness | FR-250 | FR-274 | D-15] a release check run with the benchmark request passes it to its sections", () => {
  const result = runDriver({ mode: "probe", root: tmpDir(), benchmark: true });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.includes("benchmark=true"), result.stdout);
});

test("[AC-3 | spec-evaluation-harness | FR-250 | FR-274 | D-15] the real benchmark section in a default release check run returns clean and the run exits 0", () => {
  const result = runDriver({ mode: "default", root: tmpDir(), benchmark: false });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(/clean: benchmark-scoreboard/.test(result.stdout), result.stdout);
});

test("[AC-4 | spec-evaluation-harness | FR-274 | FR-276 | D-15] a requested run that left every row exits 0 through the release check runner", () => {
  const stub = makeStub({ stdout: COMPLETED_RUN_LINES });
  const file = storeRows([aggregateRow("1.14.7", "dev"), aggregateRow("1.14.7", "spec")]);
  const result = runDriver({ mode: "stub", root: tmpDir(), benchmark: true, harnessEntry: stub.script, scoreboardPath: file });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.ok(/clean: benchmark-scoreboard/.test(result.stdout), result.stdout);
  assert.strictEqual(fs.existsSync(stub.marker), true);
});

test("[AC-9 | spec-evaluation-harness | FR-277 | FR-274 | UR-079] a regression finding makes the release check runner exit 1", () => {
  const stub = makeStub({ exitCode: 1, stdout: "finding: regression: suite dev pass@1 fell from 0.8 (1.14.6) to 0.7 (1.14.7), beyond the margin 0.05\n" });
  const result = runDriver({ mode: "stub", root: tmpDir(), benchmark: true, harnessEntry: stub.script, scoreboardPath: absentScoreboard() });
  assert.strictEqual(result.status, 1, result.stdout + result.stderr);
  assert.ok(/finding: benchmark-scoreboard/.test(result.stdout), result.stdout);
});

test("[AC-8 | spec-evaluation-harness | FR-276 | SC-024] a missing scoreboard row makes the release check runner exit 1 and print the version", () => {
  const stub = makeStub({ stdout: COMPLETED_RUN_LINES });
  const file = storeRows([aggregateRow("1.14.7", "dev")]);
  const result = runDriver({ mode: "stub", root: tmpDir(), benchmark: true, harnessEntry: stub.script, scoreboardPath: file });
  assert.strictEqual(result.status, 1, result.stdout + result.stderr);
  assert.ok(result.stdout.includes("1.14.7"), result.stdout);
});

test("[AC-4 | spec-evaluation-harness | FR-274 | NFR-031] an operational failure of the harness makes the release check runner exit 2 and print no raw stderr", () => {
  const stub = makeStub({ exitCode: 2, stdout: "error: configuration runCount (FR-271): is not set\n", stderr: "RAW-STDERR-SECRET-9917\n" });
  const result = runDriver({ mode: "stub", root: tmpDir(), benchmark: true, harnessEntry: stub.script, scoreboardPath: absentScoreboard() });
  assert.strictEqual(result.status, 2, result.stdout + result.stderr);
  assert.ok(!result.stdout.includes("RAW-STDERR-SECRET-9917"));
  assert.ok(!result.stderr.includes("RAW-STDERR-SECRET-9917"));
  assert.ok(/error: benchmark-scoreboard/.test(result.stdout), result.stdout);
});

test("[AC-3 | spec-evaluation-harness | FR-250] the run({ sections }) injection still runs the sections it is given and returns their outcomes", () => {
  // The injected sections run in a child process because run() sets process.exitCode.
  const result = runDriver({ mode: "probe", root: tmpDir(), benchmark: false });
  assert.ok(/clean: probe/.test(result.stdout), result.stdout);
});

test("[AC-3 | spec-evaluation-harness | FR-250] the exported surface of release-check.js still holds run, scriptSection, exitCodeOf, and defaultSections", () => {
  ["run", "scriptSection", "exitCodeOf", "defaultSections"].forEach((name) => {
    assert.strictEqual(typeof releaseCheck[name], "function", name);
  });
  assert.strictEqual(releaseCheck.exitCodeOf([{ outcome: "clean" }, { outcome: "finding" }]), 1);
  assert.strictEqual(releaseCheck.exitCodeOf([{ outcome: "finding" }, { outcome: "error" }]), 2);
  assert.strictEqual(releaseCheck.exitCodeOf([{ outcome: "clean" }]), 0);
});
