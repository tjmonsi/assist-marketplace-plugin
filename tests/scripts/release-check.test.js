// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the release-check runner:
// plugins/assist-plugin/scripts/release-check.js (item 1, task plan Step 13).
//
// Sources: specs/spec-release-check.md (Requirements 1, 2, 3, 6) and the interface contract in
// docs/task-plans/task-plan-assist-pi-backport-20261120-0314.md, Step 10.
//
// Traceability format: [spec-release-check Rn -> FR-ids | Scenario title]. The spec carries no SPEC-NNN id,
// so the spec file name and its Requirement number stand in for it (the convention of the task plan).
//
// Contract used (task plan Step 10, the documented interface):
//   CLI       node release-check.js [--root DIR] [--release]
//             an unknown argument is an operational error, exit 2
//   module    exports run(options) with {root, release, sections}, scriptSection(name, scriptPath, args),
//             and exitCodeOf(outcomes)
//             sections is an optional injected list of {name, run(context)} that return {outcome, details}
//             with outcome one of "clean", "finding", "error"
//   report    each section prints one line "<clean|finding|error>: <section name>" followed by indented detail lines
//   exit      2 when any section is "error" (outranks a finding), else 1 when any is "finding", else 0
//   scriptSection maps a spawned script: status 0 clean, status 1 finding; a spawn error, a signal, a timeout,
//             a missing script, or a status above 1 is error. The script runs with cwd = root.
//
// The module sets process.exitCode, so every in-process contract case runs inside a child process (a small
// driver written to a scratch directory) and the test reads the child's exit status and output. That keeps the
// test process's own exit status untouched and does not depend on what run() returns.
//
// Secret-shaped strings are assembled at run time from pieces, so this file holds no scannable credential.
// Git-backed cases build throw-away repositories under a scrubbed environment.
//
// Run: node --test tests/scripts/release-check.test.js

"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const RUNNER = path.join(REPO, "plugins", "assist-plugin", "scripts", "release-check.js");

// Credential-shaped value, assembled at run time.
const AWS_KEY = "AK" + "IA" + "Z7Q2K9M4X8P3R5T6";

const hasGit = childProcess.spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;

const scratch = [];
let homeDir = null;
let driverPath = null;

function gitEnv(extra) {
  const env = Object.assign({}, process.env);
  Object.keys(env).forEach((k) => {
    if (/^GIT_/.test(k)) delete env[k];
  });
  Object.assign(env, {
    HOME: homeDir,
    XDG_CONFIG_HOME: homeDir,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_TERMINAL_PROMPT: "0",
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@example.com",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@example.com",
  });
  return Object.assign(env, extra || {});
}

function git(cwd, args) {
  const res = childProcess.spawnSync("git", args, { cwd: cwd, env: gitEnv(), encoding: "utf8" });
  assert.strictEqual(res.status, 0, "git " + args.join(" ") + " failed: " + res.stderr);
  return res.stdout;
}

function mkdtemp(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  scratch.push(dir);
  return dir;
}

function put(root, rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

before(() => {
  homeDir = mkdtemp("release-check-home-");

  // Driver: loads the runner module, builds the sections from a JSON spec, and calls run(). It never sets an
  // exit code itself, so the child's exit status is whatever run() set on process.exitCode.
  const dir = mkdtemp("release-check-driver-");
  driverPath = put(
    dir,
    "driver.js",
    [
      '"use strict";',
      'const fs = require("fs");',
      "const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));",
      "const rc = require(spec.module);",
      "const sections = spec.sections.map(function (s) {",
      "  if (s.kind === 'script') return rc.scriptSection(s.name, s.path, s.args || []);",
      "  return {",
      "    name: s.name,",
      "    run: function () {",
      "      fs.appendFileSync(spec.trace, s.name + '\\n');",
      "      return { outcome: s.outcome, details: s.details || [] };",
      "    },",
      "  };",
      "});",
      "Promise.resolve(rc.run({ root: spec.root, release: !!spec.release, sections: sections }))",
      "  .then(function () {}, function () { process.stderr.write('driver: run threw\\n'); process.exitCode = 70; });",
    ].join("\n")
  );
});

after(() => {
  scratch.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

// Runs run() in a child process with the given sections. Each section is either
//   {name, outcome, details}                an injected section that returns that outcome, or
//   {kind: "script", name, path, args}      a section built by scriptSection(name, path, args).
// Returns {status, out, ran} where ran lists the injected sections that were invoked, in order.
function runSections(sections, extra) {
  const dir = mkdtemp("release-check-run-");
  const trace = path.join(dir, "trace.txt");
  fs.writeFileSync(trace, "");
  const root = (extra && extra.root) || dir;
  const spec = Object.assign({ module: RUNNER, root: root, release: false, sections: sections, trace: trace }, extra || {});
  const specFile = put(dir, "spec.json", JSON.stringify(spec));
  const res = childProcess.spawnSync(process.execPath, [driverPath, specFile], {
    cwd: dir,
    encoding: "utf8",
    timeout: 60000,
  });
  return {
    status: res.status,
    out: String(res.stdout) + "\n" + String(res.stderr),
    ran: fs.readFileSync(trace, "utf8").split("\n").filter(Boolean),
  };
}

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineFor(out, outcome, name) {
  return new RegExp("^" + outcome + ": " + escapeRe(name) + "\\s*$", "m").test(out);
}

function sectionLine(out, name) {
  const m = new RegExp("^(clean|finding|error): " + escapeRe(name) + "\\s*$", "m").exec(out);
  return m ? m[1] : null;
}

function cli(args, cwd, extraEnv) {
  return childProcess.spawnSync(process.execPath, [RUNNER].concat(args), {
    cwd: cwd,
    env: gitEnv(extraEnv),
    encoding: "utf8",
    timeout: 120000,
  });
}

function everything(res) {
  return String(res.stdout) + "\n" + String(res.stderr);
}

// No window of 8 or more characters of the value appears anywhere in the output.
function assertValueAbsent(out, value) {
  for (let i = 0; i + 8 <= value.length; i += 1) {
    assert.ok(out.indexOf(value.slice(i, i + 8)) === -1, "the output holds part of the secret value: " + value.slice(i, i + 8));
  }
}

// ---------------------------------------------------------------------------------------------------------
// Requirement 1 and 3: exit-code reduction over injected sections
// ---------------------------------------------------------------------------------------------------------

// [spec-release-check R1 -> FR-250 -> UR-044 | Scenario: All sections clean]
// Valid input: every section clean. Expect each reported clean on its own line and exit 0.
test("run_allSectionsClean_reportsEachCleanAndExits0", () => {
  const res = runSections([
    { name: "alpha", outcome: "clean" },
    { name: "beta", outcome: "clean" },
    { name: "gamma", outcome: "clean" },
  ]);
  assert.strictEqual(res.status, 0, res.out);
  ["alpha", "beta", "gamma"].forEach((n) => {
    assert.ok(lineFor(res.out, "clean", n), "missing 'clean: " + n + "' line in:\n" + res.out);
  });
});

// [spec-release-check R1 -> FR-250 | Scenario: All sections clean]
// Valid input: the ordered list. Sections run in list order and the report lists them in that order.
test("run_sections_runInTheGivenOrder", () => {
  const res = runSections([
    { name: "first", outcome: "clean" },
    { name: "second", outcome: "clean" },
    { name: "third", outcome: "clean" },
  ]);
  assert.deepStrictEqual(res.ran, ["first", "second", "third"]);
  const at = ["first", "second", "third"].map((n) => res.out.indexOf(": " + n));
  assert.ok(at[0] >= 0 && at[0] < at[1] && at[1] < at[2], "report order differs from run order:\n" + res.out);
});

// [spec-release-check R3 -> FR-250 | Scenario: Findings only]
// Valid input: one finding and the rest clean. Exit 1.
test("run_oneFindingNoError_exits1", () => {
  const res = runSections([
    { name: "alpha", outcome: "clean" },
    { name: "beta", outcome: "finding", details: ["beta detail line"] },
  ]);
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(lineFor(res.out, "finding", "beta"), res.out);
  assert.ok(lineFor(res.out, "clean", "alpha"), res.out);
});

// [spec-release-check R2 -> FR-250 -> UR-051 | Scenario: One failing section does not hide another]
// Valid input: two sections report findings (the check-fsa-tables finding and a version mismatch). Both are
// reported and the exit is 1.
test("run_twoFindings_bothReportedAndExits1", () => {
  const res = runSections([
    { name: "check-fsa-tables", outcome: "finding", details: ["fsa tables differ"] },
    { name: "version-agreement", outcome: "finding", details: ["README.md reads 1.0.0"] },
  ]);
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(lineFor(res.out, "finding", "check-fsa-tables"), res.out);
  assert.ok(lineFor(res.out, "finding", "version-agreement"), res.out);
  assert.deepStrictEqual(res.ran, ["check-fsa-tables", "version-agreement"]);
});

// [spec-release-check R3 -> FR-250 | Scenario: Operational error only]
// Valid input: one section errors, none reports a finding. Exit 2.
test("run_oneErrorNoFinding_exits2", () => {
  const res = runSections([
    { name: "alpha", outcome: "clean" },
    { name: "beta", outcome: "error", details: ["could not start"] },
  ]);
  assert.strictEqual(res.status, 2, res.out);
  assert.ok(lineFor(res.out, "error", "beta"), res.out);
});

// [spec-release-check R3 -> FR-250 | Scenario: Finding and operational error together]
// Boundary: the operational error follows the finding. Both are reported, exit 2.
test("run_findingThenError_bothReportedAndExits2", () => {
  const res = runSections([
    { name: "alpha", outcome: "finding", details: ["a detail"] },
    { name: "beta", outcome: "error", details: ["exit status 3"] },
  ]);
  assert.strictEqual(res.status, 2, res.out);
  assert.ok(lineFor(res.out, "finding", "alpha"), res.out);
  assert.ok(lineFor(res.out, "error", "beta"), res.out);
});

// [spec-release-check R3 -> FR-250 | Scenario: Finding and operational error together]
// Boundary: the operational error precedes the finding. The precedence does not depend on order. Exit 2.
test("run_errorThenFinding_bothReportedAndExits2", () => {
  const res = runSections([
    { name: "alpha", outcome: "error" },
    { name: "beta", outcome: "finding", details: ["b detail"] },
  ]);
  assert.strictEqual(res.status, 2, res.out);
  assert.ok(lineFor(res.out, "error", "alpha"), res.out);
  assert.ok(lineFor(res.out, "finding", "beta"), res.out);
});

// [spec-release-check R3 -> FR-250 | Scenario: Finding and operational error together]
// Boundary: errors and findings mixed with clean sections across more than two positions. Exit 2.
test("run_manyMixedOutcomesWithOneError_exits2", () => {
  const res = runSections([
    { name: "s1", outcome: "clean" },
    { name: "s2", outcome: "finding" },
    { name: "s3", outcome: "clean" },
    { name: "s4", outcome: "finding" },
    { name: "s5", outcome: "error" },
    { name: "s6", outcome: "clean" },
  ]);
  assert.strictEqual(res.status, 2, res.out);
  assert.strictEqual(sectionLine(res.out, "s1"), "clean");
  assert.strictEqual(sectionLine(res.out, "s2"), "finding");
  assert.strictEqual(sectionLine(res.out, "s5"), "error");
  assert.strictEqual(sectionLine(res.out, "s6"), "clean");
});

// [spec-release-check R3 -> FR-250 | Scenario: Operational error only]
// Boundary: every section errors. Exit 2, and every section is still reported.
test("run_everySectionErrors_exits2AndReportsAll", () => {
  const res = runSections([
    { name: "e1", outcome: "error" },
    { name: "e2", outcome: "error" },
  ]);
  assert.strictEqual(res.status, 2, res.out);
  assert.strictEqual(sectionLine(res.out, "e1"), "error");
  assert.strictEqual(sectionLine(res.out, "e2"), "error");
});

// [spec-release-check R1 -> FR-250 | Scenario: All sections clean]
// Boundary: a single clean section is the smallest non-empty list. Exit 0.
test("run_singleCleanSection_exits0", () => {
  const res = runSections([{ name: "only", outcome: "clean" }]);
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(lineFor(res.out, "clean", "only"), res.out);
});

// ---------------------------------------------------------------------------------------------------------
// Requirement 2: independence
// ---------------------------------------------------------------------------------------------------------

// [spec-release-check R2 -> FR-250 -> UR-051 | Scenario: One failing section does not hide another]
// Valid input: an early finding does not stop later sections from running.
test("run_earlyFinding_laterSectionsStillRun", () => {
  const res = runSections([
    { name: "early", outcome: "finding" },
    { name: "middle", outcome: "clean" },
    { name: "late", outcome: "finding" },
  ]);
  assert.deepStrictEqual(res.ran, ["early", "middle", "late"]);
  assert.strictEqual(sectionLine(res.out, "late"), "finding");
});

// [spec-release-check R2 -> FR-250 -> UR-051 | Scenario: A section that cannot start does not stop the run]
// Valid input: an early operational error does not stop later sections from running. Exit 2.
test("run_earlyError_laterSectionsStillRunAndExit2", () => {
  const res = runSections([
    { name: "early", outcome: "error", details: ["could not start"] },
    { name: "middle", outcome: "clean" },
    { name: "late", outcome: "finding" },
  ]);
  assert.deepStrictEqual(res.ran, ["early", "middle", "late"]);
  assert.strictEqual(res.status, 2, res.out);
  assert.strictEqual(sectionLine(res.out, "middle"), "clean");
  assert.strictEqual(sectionLine(res.out, "late"), "finding");
});

// [spec-release-check R2 -> FR-250 | RULE-001: outcomes reported per section]
// Valid input: detail lines belong to their section and print indented below its outcome line.
test("run_detailLines_printIndentedBelowTheirSection", () => {
  const res = runSections([
    { name: "alpha", outcome: "finding", details: ["alpha-detail-one", "alpha-detail-two"] },
    { name: "beta", outcome: "clean" },
  ]);
  const lines = res.out.split("\n");
  const head = lines.findIndex((l) => /^finding: alpha\s*$/.test(l));
  assert.ok(head >= 0, res.out);
  assert.match(lines[head + 1], /^[ \t]+alpha-detail-one/, res.out);
  assert.match(lines[head + 2], /^[ \t]+alpha-detail-two/, res.out);
});

// ---------------------------------------------------------------------------------------------------------
// scriptSection: mapping of a spawned script to an outcome (task plan Step 10)
// ---------------------------------------------------------------------------------------------------------

function scriptWith(body, name) {
  const dir = mkdtemp("release-check-script-");
  return put(dir, name || "section.js", body);
}

// [spec-release-check R2 -> FR-250 | Scenario: A section that cannot start does not stop the run]
// Invalid input: a script path that does not exist. The section is an operational error, the remaining
// sections still run, exit 2.
test("scriptSection_missingScript_isErrorAndRestStillRun", () => {
  const missing = path.join(os.tmpdir(), "release-check-no-such-script-" + process.pid + ".js");
  const res = runSections([
    { kind: "script", name: "ghost", path: missing, args: ["--check"] },
    { name: "after-one", outcome: "clean" },
    { name: "after-two", outcome: "finding" },
  ]);
  assert.strictEqual(res.status, 2, res.out);
  assert.strictEqual(sectionLine(res.out, "ghost"), "error", res.out);
  assert.deepStrictEqual(res.ran, ["after-one", "after-two"]);
  assert.strictEqual(sectionLine(res.out, "after-two"), "finding");
  // The runner prints a fixed reason, never the raw stderr of the spawned process.
  assert.ok(res.out.indexOf("Cannot find module") === -1, "raw stderr leaked:\n" + res.out);
});

// [spec-release-check R3 -> FR-250 | Scenario: Findings only]
// Valid input: a script that exits 0 is clean.
test("scriptSection_exitStatus0_isClean", () => {
  const script = scriptWith("process.exitCode = 0;");
  const res = runSections([{ kind: "script", name: "zero", path: script, args: [] }]);
  assert.strictEqual(res.status, 0, res.out);
  assert.strictEqual(sectionLine(res.out, "zero"), "clean");
});

// [spec-release-check R3 -> FR-250 | Scenario: Findings only]
// Valid input: a script that exits 1 is a finding, not an operational error.
test("scriptSection_exitStatus1_isFinding", () => {
  const script = scriptWith("process.exitCode = 1;");
  const res = runSections([{ kind: "script", name: "one", path: script, args: [] }]);
  assert.strictEqual(res.status, 1, res.out);
  assert.strictEqual(sectionLine(res.out, "one"), "finding");
});

// [spec-release-check R3 -> FR-250 | Scenario: Operational error only]
// Boundary: status 2 is the first status above 1. It is an operational error.
test("scriptSection_exitStatus2_isError", () => {
  const script = scriptWith("process.exitCode = 2;");
  const res = runSections([{ kind: "script", name: "two", path: script, args: [] }]);
  assert.strictEqual(res.status, 2, res.out);
  assert.strictEqual(sectionLine(res.out, "two"), "error");
});

// [spec-release-check R3 -> FR-250 | Scenario: Operational error only]
// Boundary: a larger status (3) is also an operational error.
test("scriptSection_exitStatusAbove2_isError", () => {
  const script = scriptWith("process.exitCode = 3;");
  const res = runSections([{ kind: "script", name: "three", path: script, args: [] }]);
  assert.strictEqual(res.status, 2, res.out);
  assert.strictEqual(sectionLine(res.out, "three"), "error");
});

// [spec-release-check R3 -> FR-250 | Scenario: Operational error only]
// Boundary: a script killed by a signal has no exit status. It is an operational error.
test("scriptSection_killedBySignal_isError", { skip: process.platform === "win32" }, () => {
  const script = scriptWith("process.kill(process.pid, 'SIGKILL');");
  const res = runSections([{ kind: "script", name: "killed", path: script, args: [] }]);
  assert.strictEqual(res.status, 2, res.out);
  assert.strictEqual(sectionLine(res.out, "killed"), "error");
});

// [spec-release-check R2 -> FR-250 | Scenario: One failing section does not hide another]
// Valid input: a finding section and an error section built by scriptSection, followed by an injected clean
// section. All three are reported and exit is 2.
test("scriptSection_findingThenErrorThenClean_allReportedExit2", () => {
  const finding = scriptWith("process.exitCode = 1;", "finding.js");
  const broken = scriptWith("process.exitCode = 7;", "broken.js");
  const res = runSections([
    { kind: "script", name: "scripted-finding", path: finding, args: [] },
    { kind: "script", name: "scripted-error", path: broken, args: [] },
    { name: "tail", outcome: "clean" },
  ]);
  assert.strictEqual(res.status, 2, res.out);
  assert.strictEqual(sectionLine(res.out, "scripted-finding"), "finding");
  assert.strictEqual(sectionLine(res.out, "scripted-error"), "error");
  assert.strictEqual(sectionLine(res.out, "tail"), "clean");
});

// [spec-release-check R1 -> FR-250 -> UR-044 | Scenario: All sections clean]
// Valid input: the args given to scriptSection reach the script (for example "--check").
test("scriptSection_args_arePassedToTheScript", () => {
  const out = mkdtemp("release-check-args-");
  const marker = path.join(out, "argv.json");
  const script = scriptWith(
    "require('fs').writeFileSync(" + JSON.stringify(marker) + ", JSON.stringify(process.argv.slice(2)));"
  );
  const res = runSections([{ kind: "script", name: "args", path: script, args: ["--check"] }]);
  assert.strictEqual(res.status, 0, res.out);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(marker, "utf8")), ["--check"]);
});

// [spec-release-check R1 -> FR-250 | Data: the section scripts run from the root being checked]
// Valid input: the script runs with its working directory set to the run root.
test("scriptSection_cwd_isTheRunRoot", () => {
  const rootDir = mkdtemp("release-check-cwd-root-");
  const out = mkdtemp("release-check-cwd-out-");
  const marker = path.join(out, "cwd.txt");
  const script = scriptWith(
    "require('fs').writeFileSync(" + JSON.stringify(marker) + ", require('fs').realpathSync(process.cwd()));"
  );
  const res = runSections([{ kind: "script", name: "cwd", path: script, args: [] }], { root: rootDir });
  assert.strictEqual(res.status, 0, res.out);
  assert.strictEqual(fs.readFileSync(marker, "utf8"), rootDir);
});

// [spec-release-check R2 -> FR-250 | NFR-031: no raw stderr]
// Security-adjacent: a failing script writes a secret-looking string to stderr. The report holds a fixed
// reason, never the raw stderr text.
test("scriptSection_errorStderr_isNotEchoedInTheReport", () => {
  const script = scriptWith(
    "process.stderr.write(" + JSON.stringify("token=" + AWS_KEY + "\n") + "); process.exitCode = 2;"
  );
  const res = runSections([{ kind: "script", name: "noisy", path: script, args: [] }]);
  assert.strictEqual(res.status, 2, res.out);
  assert.strictEqual(sectionLine(res.out, "noisy"), "error");
  assertValueAbsent(res.out, AWS_KEY);
});

// ---------------------------------------------------------------------------------------------------------
// exitCodeOf: the reduction rule on its own (task plan Step 10)
// ---------------------------------------------------------------------------------------------------------

// The task plan names exitCodeOf(outcomes) without fixing whether each element is the outcome string or the
// {outcome, details} object a section returns. The test accepts either representation, but one representation
// must satisfy every case.
const EXIT_CASES = [
  [[], 0],
  [["clean"], 0],
  [["clean", "clean"], 0],
  [["finding"], 1],
  [["clean", "finding", "finding"], 1],
  [["error"], 2],
  [["clean", "error"], 2],
  [["finding", "error"], 2],
  [["error", "finding"], 2],
  [["finding", "clean", "error", "finding"], 2],
];

function exitCodeCasesPass(exitCodeOf, wrap) {
  return EXIT_CASES.every((c) => {
    try {
      return exitCodeOf(c[0].map(wrap)) === c[1];
    } catch (e) {
      return false;
    }
  });
}

// [spec-release-check R3 -> FR-250 | RULE-002: exit 0 clean, 1 finding, 2 error; error outranks finding]
// Valid and boundary inputs: the empty list, single outcomes, and every ordering of a finding with an error.
test("exitCodeOf_reducesOutcomesWithErrorOutrankingFinding", () => {
  const rc = require(RUNNER);
  assert.strictEqual(typeof rc.exitCodeOf, "function", "release-check.js must export exitCodeOf");
  const asStrings = exitCodeCasesPass(rc.exitCodeOf, (o) => o);
  const asObjects = exitCodeCasesPass(rc.exitCodeOf, (o) => ({ outcome: o, details: [] }));
  assert.ok(asStrings || asObjects, "exitCodeOf did not return 0/1/2 as specified for either outcome representation");
});

// ---------------------------------------------------------------------------------------------------------
// CLI: argument handling
// ---------------------------------------------------------------------------------------------------------

// [spec-release-check R3 -> FR-250 | Interface: an unknown argument is an operational error]
// Invalid input: an unknown flag. Exit 2.
test("cli_unknownArgument_exits2", () => {
  const res = cli(["--definitely-not-a-flag"], mkdtemp("release-check-cli-"));
  assert.strictEqual(res.status, 2, everything(res));
});

// [spec-release-check R3 -> FR-250 | Interface: an unknown argument is an operational error]
// Invalid input: an unknown positional argument next to a valid flag. Exit 2.
test("cli_unknownPositionalArgument_exits2", () => {
  const root = mkdtemp("release-check-cli-");
  const res = cli(["--root", root, "stray-argument"], root);
  assert.strictEqual(res.status, 2, everything(res));
});

// [spec-release-check R3 -> FR-250 | Interface: an unknown argument is an operational error]
// Security-adjacent: a shell-metacharacter argument is rejected as unknown, not interpreted.
test("cli_shellMetacharacterArgument_exits2AndRunsNothing", () => {
  const root = mkdtemp("release-check-cli-");
  const marker = path.join(root, "pwned");
  const res = cli(["; touch " + marker], root);
  assert.strictEqual(res.status, 2, everything(res));
  assert.ok(!fs.existsSync(marker), "the argument was interpreted by a shell");
});

// ---------------------------------------------------------------------------------------------------------
// CLI: the real ordered section list, and the secret-scan section (Requirements 1 and 6)
// ---------------------------------------------------------------------------------------------------------

const REAL_SECTIONS = [
  "sync-writing-standard",
  "check-fsa-tables",
  "check-control-register",
  "scan-staged-secrets",
  "version-agreement",
];

// Builds a throw-away git repository whose six version places agree, so the version-agreement section does
// not add an operational error to the run. Nothing is staged.
function newRepoWithVersionFiles() {
  const dir = mkdtemp("release-check-repo-");
  git(dir, ["init", "-q"]);
  const v = "1.14.4";
  put(dir, "plugins/assist-plugin/.claude-plugin/plugin.json", JSON.stringify({ name: "assist-plugin", version: v }));
  put(
    dir,
    ".claude-plugin/marketplace.json",
    JSON.stringify({ name: "assist-plugin-marketplace", plugins: [{ name: "assist-plugin", version: v }] })
  );
  put(dir, "CLAUDE.md", "# Project\n\n- **Plugin:** `plugins/assist-plugin` (v" + v + ")\n");
  put(dir, "README.md", "# Readme\n\n### assist-plugin v" + v + "\n");
  put(
    dir,
    "MARKETPLACE.md",
    "# Marketplace\n\n### assist-plugin v" + v + "\n\nEach plugin follows semantic versioning. Version " + v + " is available in `plugins/assist-plugin/`.\n"
  );
  put(dir, "CHANGELOG.md", "# Changelog\n\n## [" + v + "] - 2026-11-20\n\n- release\n");
  return dir;
}

// [spec-release-check R1 -> FR-250 -> UR-044 | Scenario: All sections clean]
// Valid input: the CLI runs the five named sections in the documented order and reports each on its own line,
// whatever each outcome is.
test("cli_realSections_areReportedInTheDocumentedOrder", { skip: !hasGit }, () => {
  const repo = newRepoWithVersionFiles();
  const res = cli(["--root", repo], repo);
  const out = everything(res);
  const positions = REAL_SECTIONS.map((name) => {
    const m = new RegExp("^(clean|finding|error): .*" + name + ".*$", "m").exec(out);
    assert.ok(m, "no report line for section " + name + " in:\n" + out);
    return m.index;
  });
  for (let i = 1; i < positions.length; i += 1) {
    assert.ok(positions[i - 1] < positions[i], "sections are out of order: " + REAL_SECTIONS[i - 1] + " before " + REAL_SECTIONS[i]);
  }
  assert.ok([0, 1, 2].indexOf(res.status) !== -1, "exit status outside 0/1/2: " + res.status);
});

// [spec-release-check R6 -> FR-252 -> FR-217 | Scenario: Nothing staged]
// Boundary: an empty index. The secret-scan section is clean.
test("cli_secretScan_emptyIndex_reportsClean", { skip: !hasGit }, () => {
  const repo = newRepoWithVersionFiles();
  const res = cli(["--root", repo], repo);
  const out = everything(res);
  assert.match(out, /^clean: .*scan-staged-secrets.*$/m, out);
});

// [spec-release-check R6 -> FR-252 -> FR-217 | Scenario: Secret staged]
// Valid input: a staged change holds a detectable secret pattern. The section is a finding, the run does not
// exit 0, the staged path is named, and the secret value never appears in the output (NFR-031).
test("cli_secretScan_stagedSecret_reportsFindingWithoutTheValue", { skip: !hasGit }, () => {
  const repo = newRepoWithVersionFiles();
  put(repo, "settings/cloud.conf", "aws_access_key_id = " + AWS_KEY + "\n");
  git(repo, ["add", "--", "settings/cloud.conf"]);
  const res = cli(["--root", repo], repo);
  const out = everything(res);
  assert.match(out, /^finding: .*scan-staged-secrets.*$/m, out);
  assert.notStrictEqual(res.status, 0, out);
  assert.ok(out.indexOf("settings/cloud.conf") !== -1, "the finding does not name the staged path:\n" + out);
  assertValueAbsent(out, AWS_KEY);
});

// [spec-release-check R6 -> FR-252 | Scenario: Nothing staged]
// Boundary: a secret sits in the working tree but is not staged. The scan covers the index only, so the
// section is clean.
test("cli_secretScan_unstagedSecret_reportsClean", { skip: !hasGit }, () => {
  const repo = newRepoWithVersionFiles();
  put(repo, "settings/cloud.conf", "aws_access_key_id = " + AWS_KEY + "\n");
  const res = cli(["--root", repo], repo);
  const out = everything(res);
  assert.match(out, /^clean: .*scan-staged-secrets.*$/m, out);
  assertValueAbsent(out, AWS_KEY);
});

// [spec-release-check R2 -> FR-250 -> UR-051 | Scenario: One failing section does not hide another]
// Valid input: a staged secret (secret-scan finding) and a stale README heading (version finding) in one
// real run. Both sections are reported as findings.
test("cli_secretFindingAndVersionFinding_bothReported", { skip: !hasGit }, () => {
  const repo = newRepoWithVersionFiles();
  put(repo, "README.md", "# Readme\n\n### assist-plugin v1.0.0\n");
  put(repo, "settings/cloud.conf", "aws_access_key_id = " + AWS_KEY + "\n");
  git(repo, ["add", "--", "settings/cloud.conf"]);
  const res = cli(["--root", repo], repo);
  const out = everything(res);
  assert.match(out, /^finding: .*scan-staged-secrets.*$/m, out);
  assert.match(out, /^finding: .*version-agreement.*$/m, out);
  assert.ok(out.indexOf("README.md") !== -1, out);
});
