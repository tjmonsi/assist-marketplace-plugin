// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the published-package oracle-path check of the evaluation harness (Group A, Step 15):
// plugins/assist-plugin/scripts/eval-harness/package-check.js (`checkPackageFiles(list)` and the command line
// `node package-check.js [--list FILE]`, or a list on stdin).
//
// Sources: specs/spec-evaluation-harness.md (Requirement: Private oracle resolution and withholding, Scenarios Published
// package holds no oracle material and Oracle path in the published package), and
// docs/task-plans/task-plan-evaluation-harness-20261125-0717.md (ASM-10, Step 4, Step 15). Requirement text:
// docs/requirements/FR-NFR-harness-governance.md (FR-261, NFR-039).
//
// Traceability format: [AC-N | spec file | FR/NFR ids]. The spec has no SPEC-NNN id, so it is cited by file name.
// AC-N is the position of the Scenario inside Requirement "Private oracle resolution and withholding" (R4):
//   AC-3 Published package holds no oracle material, AC-4 Oracle path in the published package.
//
// Contract used:
//   - checkPackageFiles(list) returns { ok, offending, error }. A path with a directory segment named reference or hidden
//     is oracle material and is listed in `offending`. `error` is set (and ok false) when the list is not a list of
//     path strings.
//   - The command line reads one path per line from --list FILE or stdin, prints "clean" or one line per offending path,
//     and exits 0 (clean), 1 (an offending path), or 2 (an unknown flag or an unreadable list).
//
// Run: node --test tests/scripts/eval-harness-package-check.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLUGIN = path.join(__dirname, "..", "..", "plugins", "assist-plugin");
const SCRIPT = path.join(PLUGIN, "scripts", "eval-harness", "package-check.js");
const packageCheck = require(SCRIPT);

const created = [];
after(() => {
  created.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-package-test-"));
  created.push(dir);
  return dir;
}

function runCli(args, input) {
  const result = childProcess.spawnSync(process.execPath, [SCRIPT].concat(args), {
    encoding: "utf8",
    input: input === undefined ? "" : input,
    timeout: 30000,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const CLEAN_LIST = [
  "plugins/assist-plugin/agents/developer.md",
  "plugins/assist-plugin/evals/dev/case-a/prompt.md",
  "plugins/assist-plugin/evals/dev/case-a/graders/grader.json",
  "plugins/assist-plugin/evals/dev/case-a/task.json",
  "plugins/assist-plugin/scripts/eval-harness/oracle.js",
];

// ---------------------------------------------------------------------------
// checkPackageFiles
// ---------------------------------------------------------------------------

test("[AC-3 | spec-evaluation-harness | FR-261 | NFR-039] a package list with no reference or hidden-suite path is clean", () => {
  const result = packageCheck.checkPackageFiles(CLEAN_LIST);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.offending, []);
  assert.strictEqual(result.error, null);
});

test("[AC-3 | spec-evaluation-harness | FR-261 | NFR-039] an empty package list is clean", () => {
  // Null/empty.
  const result = packageCheck.checkPackageFiles([]);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.offending, []);
});

test("[AC-4 | spec-evaluation-harness | FR-261 | NFR-039] a package list holding a reference-solution path fails and names the path", () => {
  const list = CLEAN_LIST.concat(["plugins/assist-plugin/evals/dev/case-a/reference/solution.js"]);
  const result = packageCheck.checkPackageFiles(list);
  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(result.offending, ["plugins/assist-plugin/evals/dev/case-a/reference/solution.js"]);
});

test("[AC-4 | spec-evaluation-harness | FR-261 | NFR-039] a package list holding a hidden-suite path fails and names the path", () => {
  const list = CLEAN_LIST.concat(["plugins/assist-plugin/evals/dev/case-a/hidden/solution.test.js"]);
  const result = packageCheck.checkPackageFiles(list);
  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(result.offending, ["plugins/assist-plugin/evals/dev/case-a/hidden/solution.test.js"]);
});

test("[AC-4 | spec-evaluation-harness | FR-261 | NFR-039] a package list with several oracle paths names every one of them in list order", () => {
  const list = ["a/reference/x.js", "docs/readme.md", "b/hidden/y.test.js", "c/hidden/z.test.js"];
  const result = packageCheck.checkPackageFiles(list);
  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(result.offending, ["a/reference/x.js", "b/hidden/y.test.js", "c/hidden/z.test.js"]);
});

test("[AC-4 | spec-evaluation-harness | FR-261 | NFR-039] an oracle directory is found at the first path segment", () => {
  // Boundary: the oracle directory is the top segment.
  const result = packageCheck.checkPackageFiles(["reference/solution.js"]);
  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(result.offending, ["reference/solution.js"]);
});

test("[AC-4 | spec-evaluation-harness | FR-261 | NFR-039] an oracle directory in upper or mixed case is still found", () => {
  const result = packageCheck.checkPackageFiles(["evals/dev/case-a/Reference/solution.js", "evals/dev/case-a/HIDDEN/suite.test.js"]);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.offending.length, 2);
});

test("[AC-4 | spec-evaluation-harness | FR-261 | NFR-039] a path written with backslashes is still found and reported", () => {
  // Type mismatch in shape: a Windows-style separator.
  const result = packageCheck.checkPackageFiles(["evals\\dev\\case-a\\hidden\\suite.test.js"]);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.offending.length, 1);
  assert.match(result.offending[0], /hidden/);
});

test("[AC-4 | spec-evaluation-harness | FR-261 | NFR-039] a path with a leading ./ is still found", () => {
  const result = packageCheck.checkPackageFiles(["./evals/dev/case-a/reference/solution.js"]);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.offending.length, 1);
});

test("[AC-3 | spec-evaluation-harness | FR-261 | NFR-039] a file that only shares a name prefix with an oracle directory is not oracle material", () => {
  // Boundary: reference.md and hidden-gems are not a reference or hidden directory.
  const result = packageCheck.checkPackageFiles(["docs/reference.md", "src/hidden-gems/a.js", "docs/references/list.md"]);
  assert.strictEqual(result.ok, true, JSON.stringify(result.offending));
});

test("[AC-4 | spec-evaluation-harness | FR-261 | NFR-039] a path that holds shell metacharacters or path traversal is judged by its segments only", () => {
  // Security-adjacent: the check reads paths, never runs them.
  const result = packageCheck.checkPackageFiles(["../../etc/passwd", "a/$(rm -rf x)/b.js", "a;b/reference/c.js"]);
  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(result.offending, ["a;b/reference/c.js"]);
});

[null, undefined, "plugins/a.js", 42, { 0: "a" }].forEach((value) => {
  test("[AC-3 | spec-evaluation-harness | FR-261 | NFR-039] a package list of the wrong type " + JSON.stringify(value) + " is an error with nothing judged", () => {
    // Type mismatch: the argument is not a list.
    const result = packageCheck.checkPackageFiles(value);
    assert.strictEqual(result.ok, false);
    assert.ok(result.error, "an error reason is set");
    assert.deepStrictEqual(result.offending, []);
  });
});

test("[AC-3 | spec-evaluation-harness | FR-261 | NFR-039] a package list that holds a non-string entry is an error with nothing judged", () => {
  const result = packageCheck.checkPackageFiles(["a/b.js", 7, "c/reference/d.js"]);
  assert.strictEqual(result.ok, false);
  assert.ok(result.error);
  assert.deepStrictEqual(result.offending, []);
});

test("[AC-3 | spec-evaluation-harness | FR-261 | NFR-039] the check reads only the paths and never touches the files", () => {
  // Paths that do not exist on disk are judged the same as paths that do.
  const result = packageCheck.checkPackageFiles(["/definitely/not/on/disk/hidden/suite.test.js"]);
  assert.strictEqual(result.ok, false);
});

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

test("[AC-3 | spec-evaluation-harness | FR-261 | NFR-039] the command line prints clean and exits 0 for a clean list read from a file", () => {
  const file = path.join(tmpDir(), "list.txt");
  fs.writeFileSync(file, CLEAN_LIST.join("\n") + "\n");
  const result = runCli(["--list", file]);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(result.stdout.trim(), "clean");
});

test("[AC-4 | spec-evaluation-harness | FR-261 | NFR-039] the command line names the oracle path and exits 1 for a list read from a file", () => {
  const file = path.join(tmpDir(), "list.txt");
  fs.writeFileSync(file, CLEAN_LIST.concat(["evals/dev/case-a/reference/solution.js"]).join("\n") + "\n");
  const result = runCli(["--list", file]);
  assert.strictEqual(result.status, 1, result.stderr);
  assert.ok(result.stdout.includes("evals/dev/case-a/reference/solution.js"), result.stdout);
});

test("[AC-4 | spec-evaluation-harness | FR-261 | NFR-039] the command line reads the list from stdin when no file is given", () => {
  const result = runCli([], CLEAN_LIST.concat(["evals/dev/case-b/hidden/suite.test.js"]).join("\n") + "\n");
  assert.strictEqual(result.status, 1, result.stderr);
  assert.ok(result.stdout.includes("evals/dev/case-b/hidden/suite.test.js"), result.stdout);
});

test("[AC-3 | spec-evaluation-harness | FR-261 | NFR-039] the command line exits 0 for a clean list on stdin", () => {
  const result = runCli([], CLEAN_LIST.join("\n") + "\n");
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(result.stdout.trim(), "clean");
});

test("[AC-3 | spec-evaluation-harness | FR-261 | NFR-039] the command line accepts a list with Windows line endings and blank lines", () => {
  const result = runCli([], CLEAN_LIST.join("\r\n") + "\r\n\r\n");
  assert.strictEqual(result.status, 0, result.stderr);
});

test("[AC-3 | spec-evaluation-harness | FR-261 | NFR-039] the command line exits 2 for an unknown flag", () => {
  const result = runCli(["--frobnicate"]);
  assert.strictEqual(result.status, 2);
});

test("[AC-3 | spec-evaluation-harness | FR-261 | NFR-039] the command line exits 2 when --list names a file that cannot be read", () => {
  const result = runCli(["--list", path.join(tmpDir(), "no-such-list.txt")]);
  assert.strictEqual(result.status, 2);
  assert.ok(!result.stdout.includes("clean"), "an unreadable list must never read clean");
});

test("[AC-3 | spec-evaluation-harness | FR-261 | NFR-039] the command line exits 2 when --list has no value", () => {
  // Null/empty argument.
  const result = runCli(["--list"]);
  assert.strictEqual(result.status, 2);
});
