// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the user-run labeller of the advisory baseline of harness-governance Tranche 4
// (plugins/assist-plugin/scripts/label-findings.js), task plan Step 37.
//
// Sources: specs/spec-hooks-code-scan.md (Requirement: Advisory baseline and precision from user labels, scenarios
// Unlabelled finding is not counted and Precision from the user's labels; Change Log 2026-11-13 (Tranche 4 as-built
// reconciliation), the labelOf rule: a label is a real boolean), docs/requirements/FR-NFR-harness-governance.md (FR-238,
// NFR-034: the user labels each baseline finding true or false), and the usage header of the script (the command line,
// the rewrite rules, and the exit codes). The spec carries no SPEC-NNN id, so it is cited by file name.
//
// Reviewer machinery addition (task plan docs/task-plans/task-plan-reviewer-machinery-20261125-0717.md, Step 22):
// specs/spec-reviewer-machinery.md Requirement 20 (Record a disposition only from the user's label; scenario User label
// recorded), FR-309, NFR-034. The labeller also accepts a third label, deferred, and writes `labelled_by: "user"` with each
// label. A deferred record still reads as unlabelled to labelOf of hooks/lib/severity.js, so baseline-report.js and
// promote-rule.js precision does not change.
//
// Traceability format: [AC-N | spec-hooks-code-scan.md Requirement | FR/NFR ids]. AC-N is the position of the Scenario
// inside the Requirement: "Unlabelled finding is not counted" is AC-1 and "Precision from the user's labels" is AC-2. The
// reviewer-machinery cases use [AC-1 | spec-reviewer-machinery Requirement 20 | FR-309 | NFR-034], AC-1 being "User label
// recorded".
//
// Contract used (documented behavior; the script body is never read):
//   node scripts/label-findings.js --list [--rule RULE_ID] [--root DIR]
//   node scripts/label-findings.js <finding-id> true|false|deferred [--root DIR]
//   --list prints the unlabelled findings (id, rule, severity, confidence, file, line); a deferred finding holds no true or
//   false label, so it is listed again. The second form sets `label` (a boolean, or the string "deferred"), `labelled_by`
//   ("user"), and `labelled_at` (the time, UTC) on the one record with that id in .agent/governance/review-findings.jsonl,
//   replacing an earlier label. The rewrite changes only the named record: every other line, a line that is not a valid
//   finding included, is kept as written. The file is replaced through a temporary file in the same directory and a rename.
//   Exit 0 listed or set; exit 1 refused (the id is unknown or appears on more than one line); exit 2 cannot run (bad
//   arguments, an unknown project root, an unreadable or unwritable store).
//
// Every project root is a temp directory with a .git directory and fixture files only.
//
// Run: node --test tests/scripts/label-findings.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");
const severity = require(path.join(fx.PLUGIN, "hooks", "lib", "severity.js"));
const reviewLabels = require(path.join(fx.PLUGIN, "hooks", "lib", "review-labels.js"));

const SCRIPT = path.join(fx.PLUGIN, "scripts", "label-findings.js");
const SPEC = "spec-hooks-code-scan.md";
const BASELINE = SPEC + " Requirement: Advisory baseline and precision from user labels";
const MACHINERY = "spec-reviewer-machinery Requirement 20";
const RULE = "sql-from-input";
const OTHER = "shell-from-variable";

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------

function record(id, over) {
  return Object.assign(
    { id: id, rule_id: RULE, severity: "HIGH", confidence: "High", file: "src/" + id + ".js", line: 3, timestamp: "2026-11-13T09:30:00.000Z", review_id: "rev-" + id },
    over || {}
  );
}

function storePath(root) {
  return path.join(root, ".agent", "governance", "review-findings.jsonl");
}

// lines: an array of strings, written one per line with a final newline.
function makeRoot(lines) {
  const root = fx.tempRoot("label-");
  if (lines !== null) {
    fs.mkdirSync(path.dirname(storePath(root)), { recursive: true });
    fs.writeFileSync(storePath(root), lines.join("\n") + "\n");
  }
  return root;
}

function j(r) {
  return JSON.stringify(r);
}

function run(args, root) {
  const argv = [SCRIPT].concat(args);
  if (root !== null && root !== undefined) argv.push("--root", root);
  const result = childProcess.spawnSync(process.execPath, argv, {
    cwd: fx.tempDir("label-cwd-"),
    env: fx.cleanEnv(),
    encoding: "utf8",
    timeout: 60000,
  });
  assert.strictEqual(result.error, undefined, "spawn error: " + (result.error && result.error.message));
  result.out = (result.stdout || "") + (result.stderr || "");
  return result;
}

function text(root) {
  return fs.readFileSync(storePath(root), "utf8");
}

function linesOf(root) {
  return text(root).split("\n").filter((l) => l !== "");
}

// ---------------------------------------------------------------------------
// --list
// ---------------------------------------------------------------------------

test("[AC-1 | " + BASELINE + " | FR-238 | NFR-034] --list prints each unlabelled finding with its id, rule, severity, confidence, file, and line, and exits 0", () => {
  const root = makeRoot([j(record("f-1")), j(record("f-2", { severity: "MEDIUM", confidence: "Low", line: 9 }))]);
  const res = run(["--list"], root);
  assert.strictEqual(res.status, 0, res.out);
  ["f-1", "f-2", RULE, "HIGH", "MEDIUM", "src/f-1.js", "src/f-2.js"].forEach((word) => {
    assert.ok(res.out.indexOf(word) !== -1, "the listing names " + word + "; output: " + res.out);
  });
  assert.ok(/\b9\b/.test(res.out), "the listing names the line of f-2; output: " + res.out);
});

test("[AC-1 | " + BASELINE + " | FR-238 | NFR-034] --list leaves out a finding that already holds a boolean label, and lists one whose label is a look-alike string", () => {
  const root = makeRoot([j(record("f-done-true", { label: true })), j(record("f-done-false", { label: false })), j(record("f-open")), j(record("f-string", { label: "true" }))]);
  const res = run(["--list"], root);
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(res.out.indexOf("f-open") !== -1, res.out);
  assert.ok(res.out.indexOf("f-done-true") === -1 && res.out.indexOf("f-done-false") === -1, "a labelled finding is listed; output: " + res.out);
  assert.ok(res.out.indexOf("f-string") !== -1, "a string label is no label, so the finding is still unlabelled; output: " + res.out);
});

test("[AC-1 | " + BASELINE + " | FR-238] --list with --rule limits the listing to one rule", () => {
  const root = makeRoot([j(record("f-sql")), j(record("f-shell", { rule_id: OTHER }))]);
  const res = run(["--list", "--rule", OTHER], root);
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(res.out.indexOf("f-shell") !== -1, res.out);
  assert.ok(res.out.indexOf("f-sql") === -1, "the other rule is listed; output: " + res.out);
});

test("[AC-1 | " + BASELINE + " | FR-238 | NFR-031] --list writes nothing: the store stays byte for byte as it was", () => {
  const root = makeRoot([j(record("f-1")), "{not json"]);
  const before = text(root);
  assert.strictEqual(run(["--list"], root).status, 0);
  assert.strictEqual(text(root), before);
});

// ---------------------------------------------------------------------------
// <finding-id> true|false
// ---------------------------------------------------------------------------

test("[AC-2 | " + BASELINE + " | FR-238 | NFR-034] a finding id with true sets the boolean label and a UTC labelled_at on that record", () => {
  const root = makeRoot([j(record("f-1")), j(record("f-2")), j(record("f-3"))]);
  const res = run(["f-2", "true"], root);
  assert.strictEqual(res.status, 0, res.out);
  const rows = linesOf(root).map((l) => JSON.parse(l));
  assert.strictEqual(rows.length, 3);
  assert.strictEqual(rows[1].id, "f-2");
  assert.strictEqual(rows[1].label, true, "the label is the boolean true, not a string");
  assert.strictEqual(severity.labelOf(rows[1]), true);
  assert.ok(Number.isFinite(Date.parse(rows[1].labelled_at)), "labelled_at is a time: " + rows[1].labelled_at);
  assert.ok(/Z$/.test(rows[1].labelled_at), "labelled_at is UTC: " + rows[1].labelled_at);
  assert.ok(severity.checkFinding(rows[1]), "the labelled record is still a valid finding");
});

test("[AC-2 | " + BASELINE + " | FR-238 | NFR-034] a finding id with false sets the boolean false, which counts as a label", () => {
  const root = makeRoot([j(record("f-1"))]);
  assert.strictEqual(run(["f-1", "false"], root).status, 0);
  const row = JSON.parse(linesOf(root)[0]);
  assert.strictEqual(row.label, false);
  assert.strictEqual(severity.labelOf(row), false);
});

test("[AC-2 | " + BASELINE + " | FR-238] the label changes the named record only: every other line stays byte for byte, in the same order", () => {
  const original = [j(record("f-1")), j(record("f-2")), j(record("f-3", { label: true })), j(record("f-4", { rule_id: OTHER }))];
  const root = makeRoot(original);
  assert.strictEqual(run(["f-2", "false"], root).status, 0);
  const after_ = linesOf(root);
  assert.strictEqual(after_.length, 4);
  assert.strictEqual(after_[0], original[0]);
  assert.strictEqual(after_[2], original[2]);
  assert.strictEqual(after_[3], original[3]);
  assert.notStrictEqual(after_[1], original[1]);
  const row = JSON.parse(after_[1]);
  ["id", "rule_id", "severity", "confidence", "file", "line", "timestamp", "review_id"].forEach((key) => {
    assert.strictEqual(row[key], record("f-2")[key], key + " of the labelled record is unchanged");
  });
});

test("[AC-2 | " + BASELINE + " | FR-238] a later label replaces an earlier one", () => {
  const root = makeRoot([j(record("f-1", { label: true, labelled_at: "2026-11-01T00:00:00Z" }))]);
  assert.strictEqual(run(["f-1", "false"], root).status, 0);
  const rows = linesOf(root);
  assert.strictEqual(rows.length, 1, "no second record is added");
  const row = JSON.parse(rows[0]);
  assert.strictEqual(row.label, false);
  assert.notStrictEqual(row.labelled_at, "2026-11-01T00:00:00Z", "labelled_at is refreshed");
});

test("[AC-2 | " + BASELINE + " | FR-238] a labelled finding no longer appears in --list", () => {
  const root = makeRoot([j(record("f-1")), j(record("f-2"))]);
  assert.strictEqual(run(["f-1", "true"], root).status, 0);
  const res = run(["--list"], root);
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(res.out.indexOf("f-1") === -1 && res.out.indexOf("f-2") !== -1, res.out);
});

// ---------------------------------------------------------------------------
// Reviewer machinery: labelled_by on every label, and the deferred label
// ---------------------------------------------------------------------------

test("[AC-1 | " + MACHINERY + " | FR-309 | NFR-034] a true label records the writer as the user, and the disposition reads true", () => {
  const root = makeRoot([j(record("f-1")), j(record("f-2"))]);
  assert.strictEqual(run(["f-1", "true"], root).status, 0);
  const row = JSON.parse(linesOf(root)[0]);
  assert.strictEqual(row.label, true);
  assert.strictEqual(row.labelled_by, "user");
  assert.strictEqual(reviewLabels.dispositionOf(row), true);
});

test("[AC-1 | " + MACHINERY + " | FR-309 | NFR-034] a false label records the writer as the user, and the disposition reads false", () => {
  const root = makeRoot([j(record("f-1"))]);
  assert.strictEqual(run(["f-1", "false"], root).status, 0);
  const row = JSON.parse(linesOf(root)[0]);
  assert.strictEqual(row.label, false);
  assert.strictEqual(row.labelled_by, "user");
  assert.strictEqual(reviewLabels.dispositionOf(row), false);
});

test("[AC-1 | " + MACHINERY + " | FR-309 | NFR-034] a finding id with deferred sets the label deferred, the writer user, and a UTC labelled_at", () => {
  const root = makeRoot([j(record("f-1")), j(record("f-2")), j(record("f-3"))]);
  const res = run(["f-2", "deferred"], root);
  assert.strictEqual(res.status, 0, res.out);
  const rows = linesOf(root).map((l) => JSON.parse(l));
  assert.strictEqual(rows.length, 3);
  assert.strictEqual(rows[1].id, "f-2");
  assert.strictEqual(rows[1].label, "deferred");
  assert.strictEqual(rows[1].labelled_by, "user");
  assert.ok(Number.isFinite(Date.parse(rows[1].labelled_at)) && /Z$/.test(rows[1].labelled_at), "labelled_at is a UTC time: " + rows[1].labelled_at);
  assert.strictEqual(reviewLabels.dispositionOf(rows[1]), "deferred");
});

test("[AC-1 | " + MACHINERY + " | FR-309 | NFR-034] a deferred record reads as unlabelled to labelOf, so the code-scan baseline never counts it", () => {
  const root = makeRoot([j(record("f-1"))]);
  assert.strictEqual(run(["f-1", "deferred"], root).status, 0);
  const row = JSON.parse(linesOf(root)[0]);
  assert.strictEqual(severity.labelOf(row), null);
});

test("[AC-1 | " + MACHINERY + " | FR-309] a deferred label changes the named record only: every other line stays byte for byte", () => {
  const original = [j(record("f-1")), j(record("f-2")), j(record("f-3", { label: true })), "{not json", j(record("f-4", { rule_id: OTHER }))];
  const root = makeRoot(original);
  assert.strictEqual(run(["f-2", "deferred"], root).status, 0);
  const lines = text(root).split("\n");
  assert.strictEqual(lines[0], original[0]);
  assert.strictEqual(lines[2], original[2]);
  assert.strictEqual(lines[3], original[3]);
  assert.strictEqual(lines[4], original[4]);
  assert.notStrictEqual(lines[1], original[1]);
  const row = JSON.parse(lines[1]);
  ["id", "rule_id", "severity", "confidence", "file", "line", "timestamp", "review_id"].forEach((key) => {
    assert.strictEqual(row[key], record("f-2")[key], key + " of the labelled record is unchanged");
  });
});

test("[AC-1 | " + MACHINERY + " | FR-309] a deferred finding is listed again by --list, because it holds no true or false label", () => {
  const root = makeRoot([j(record("f-1")), j(record("f-2"))]);
  assert.strictEqual(run(["f-1", "deferred"], root).status, 0);
  const res = run(["--list"], root);
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(res.out.indexOf("f-1") !== -1 && res.out.indexOf("f-2") !== -1, "a deferred finding is listed again; output: " + res.out);
});

test("[AC-1 | " + MACHINERY + " | FR-309] a later true or false label replaces a deferred one, and deferred replaces an earlier true", () => {
  const root = makeRoot([j(record("f-1"))]);
  assert.strictEqual(run(["f-1", "deferred"], root).status, 0);
  assert.strictEqual(run(["f-1", "true"], root).status, 0);
  let rows = linesOf(root);
  assert.strictEqual(rows.length, 1, "no second record is added");
  assert.strictEqual(JSON.parse(rows[0]).label, true);
  assert.strictEqual(JSON.parse(rows[0]).labelled_by, "user");

  assert.strictEqual(run(["f-1", "deferred"], root).status, 0);
  rows = linesOf(root);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(JSON.parse(rows[0]).label, "deferred");
  assert.strictEqual(severity.labelOf(JSON.parse(rows[0])), null, "deferred over true leaves the finding unlabelled for the baseline");
});

test("[AC-1 | " + MACHINERY + " | FR-309] a deferred label on an unknown id is refused with exit 1, and on an id that appears twice the store is left unchanged", () => {
  const root = makeRoot([j(record("f-dup")), j(record("f-dup", { line: 99 })), j(record("f-1"))]);
  const before = text(root);
  assert.strictEqual(run(["f-nope", "deferred"], root).status, 1);
  assert.strictEqual(run(["f-dup", "deferred"], root).status, 1);
  assert.strictEqual(text(root), before);
});

test("[AC-1 | " + MACHINERY + " | FR-309] a label word other than true, false, or deferred exits 2 and changes nothing", () => {
  const root = makeRoot([j(record("f-1"))]);
  const before = text(root);
  [["f-1", "defer"], ["f-1", "postponed"], ["f-1", "later"], ["f-1", "deferred", "extra"], ["f-1", "true,deferred"]].forEach((args) => {
    const res = run(args, root);
    assert.notStrictEqual(res.status, 0, "args " + JSON.stringify(args) + " must not succeed; output: " + res.out);
    assert.ok(res.status === 1 || res.status === 2, "args " + JSON.stringify(args) + "; status " + res.status);
    assert.strictEqual(text(root), before, "args " + JSON.stringify(args));
  });
  assert.strictEqual(run(["f-1", "defer"], root).status, 2);
});

test("[AC-2 | " + MACHINERY + " | FR-309 | NFR-034] the baseline report ignores a deferred finding: one true and one deferred give precision 100%, not 50%", () => {
  const root = makeRoot([j(record("f-1")), j(record("f-2"))]);
  assert.strictEqual(run(["f-1", "true"], root).status, 0);
  assert.strictEqual(run(["f-2", "deferred"], root).status, 0);
  const report = childProcess.spawnSync(process.execPath, [path.join(fx.PLUGIN, "scripts", "baseline-report.js"), "--root", root], { cwd: fx.tempDir("label-cwd-"), env: fx.cleanEnv(), encoding: "utf8", timeout: 60000 });
  assert.strictEqual(report.status, 0, report.stdout + report.stderr);
  assert.ok(/100(\.0+)?\s*%/.test(report.stdout), "precision of 1 true and 0 false is 100%; output: " + report.stdout);
  assert.ok(!/(^|[^0-9.])50(\.0+)?\s*%/.test(report.stdout), "the deferred finding must not count as a false label; output: " + report.stdout);
});

test("[AC-1 | " + MACHINERY + " | FR-309] a labeller run never labels another record: only the id named gains labelled_by", () => {
  const root = makeRoot([j(record("f-1")), j(record("f-2")), j(record("f-3"))]);
  assert.strictEqual(run(["f-2", "deferred"], root).status, 0);
  const rows = linesOf(root).map((l) => JSON.parse(l));
  assert.strictEqual("labelled_by" in rows[0], false);
  assert.strictEqual("labelled_by" in rows[2], false);
  assert.strictEqual(reviewLabels.dispositionOf(rows[0]), "unlabeled");
});

// ---------------------------------------------------------------------------
// Refusals: an unknown or duplicate id
// ---------------------------------------------------------------------------

test("[AC-1 | " + BASELINE + " | FR-238 | NFR-034] an unknown id is refused with exit 1 and the store is left unchanged", () => {
  const root = makeRoot([j(record("f-1")), "{not json"]);
  const before = text(root);
  const res = run(["f-nope", "true"], root);
  assert.strictEqual(res.status, 1, res.out);
  assert.strictEqual(text(root), before);
});

test("[AC-1 | " + BASELINE + " | FR-238 | NFR-034] an id that appears on more than one line is refused with exit 1 and the store is left unchanged", () => {
  const root = makeRoot([j(record("f-dup")), j(record("f-1")), j(record("f-dup", { line: 99 }))]);
  const before = text(root);
  const res = run(["f-dup", "true"], root);
  assert.strictEqual(res.status, 1, res.out);
  assert.strictEqual(text(root), before);
  // The unique id of the same store still labels.
  assert.strictEqual(run(["f-1", "true"], root).status, 0);
});

test("[AC-1 | " + BASELINE + " | FR-238 | NFR-027] an id shaped like a path or a command never labels anything and never changes the store", () => {
  // Security-adjacent: the id is a key to look up, not a path or a command.
  const root = makeRoot([j(record("f-1"))]);
  const before = text(root);
  ["../../x", "f-1; touch PWNED", "$(touch PWNED)", "f-1\nf-2", "'; DROP TABLE t;--"].forEach((bad) => {
    const res = run([bad, "true"], root);
    assert.notStrictEqual(res.status, 0, "id " + JSON.stringify(bad) + " must not label; output: " + res.out);
    assert.strictEqual(text(root), before, "id " + JSON.stringify(bad));
  });
  assert.strictEqual(fs.existsSync(path.join(root, "PWNED")), false);
});

// ---------------------------------------------------------------------------
// Preserved lines and the atomic rewrite
// ---------------------------------------------------------------------------

test("[AC-2 | " + BASELINE + " | FR-238] a line that is not JSON, a JSON line that is not a finding, and a blank-looking line are kept exactly as written", () => {
  const junk = ["{not json", "[1,2,3]", "null", '{"id":"x","rule_id":"y","severity":"SEVERE"}', "plain text, not json", "  "];
  const root = makeRoot([junk[0], j(record("f-1")), junk[1], junk[2], junk[3], j(record("f-2")), junk[4]]);
  assert.strictEqual(run(["f-2", "true"], root).status, 0);
  const lines = text(root).split("\n");
  assert.strictEqual(lines[0], junk[0]);
  assert.strictEqual(lines[2], junk[1]);
  assert.strictEqual(lines[3], junk[2]);
  assert.strictEqual(lines[4], junk[3]);
  assert.strictEqual(lines[6], junk[4]);
  assert.strictEqual(lines[1], j(record("f-1")));
  assert.strictEqual(JSON.parse(lines[5]).label, true);
  assert.strictEqual(lines.length, 8, "seven lines plus the final newline");
});

test("[AC-2 | " + BASELINE + " | FR-238] the file is replaced whole: no temporary file is left beside it, and the store keeps its final newline", () => {
  const root = makeRoot([j(record("f-1")), j(record("f-2"))]);
  assert.strictEqual(run(["f-1", "true"], root).status, 0);
  assert.deepStrictEqual(fs.readdirSync(path.dirname(storePath(root))), ["review-findings.jsonl"]);
  assert.ok(/\n$/.test(text(root)), "the store ends with a newline");
  linesOf(root).forEach((l) => assert.doesNotThrow(() => JSON.parse(l)));
});

test("[AC-2 | " + BASELINE + " | FR-238] a refusal leaves no temporary file and no partial store behind", () => {
  const root = makeRoot([j(record("f-1"))]);
  assert.strictEqual(run(["f-nope", "false"], root).status, 1);
  assert.deepStrictEqual(fs.readdirSync(path.dirname(storePath(root))), ["review-findings.jsonl"]);
});

test("[AC-2 | " + BASELINE + " | FR-238] the labelled store feeds the report: a baseline-report run counts the new label", () => {
  const root = makeRoot([j(record("f-1")), j(record("f-2"))]);
  assert.strictEqual(run(["f-1", "true"], root).status, 0);
  assert.strictEqual(run(["f-2", "false"], root).status, 0);
  const report = childProcess.spawnSync(process.execPath, [path.join(fx.PLUGIN, "scripts", "baseline-report.js"), "--root", root], { cwd: fx.tempDir("label-cwd-"), env: fx.cleanEnv(), encoding: "utf8", timeout: 60000 });
  assert.strictEqual(report.status, 0, report.stdout + report.stderr);
  assert.ok(/50(\.0+)?\s*%/.test(report.stdout), "precision of 1 true and 1 false is 50%; output: " + report.stdout);
});

// ---------------------------------------------------------------------------
// Exit 2: the script cannot run
// ---------------------------------------------------------------------------

test("[AC-1 | " + BASELINE + " | FR-238] bad arguments exit 2 and change nothing: no arguments, a label that is not true or false, and a missing label", () => {
  const root = makeRoot([j(record("f-1"))]);
  const before = text(root);
  [[], ["f-1"], ["f-1", "maybe"], ["f-1", "yes"], ["f-1", "1"], ["f-1", ""], ["f-1", "true", "extra"], ["--bogus"]].forEach((args) => {
    const res = run(args, root);
    assert.ok(res.status === 2 || res.status === 1, "args " + JSON.stringify(args) + " must not succeed; status " + res.status + "; output: " + res.out);
    assert.notStrictEqual(res.status, 0, "args " + JSON.stringify(args));
    assert.strictEqual(text(root), before, "args " + JSON.stringify(args));
  });
  assert.strictEqual(run(["f-1", "maybe"], root).status, 2);
});

test("[AC-1 | " + BASELINE + " | FR-238] a project root that does not exist exits 2", () => {
  const res = run(["--list"], path.join(fx.tempDir("label-missing-"), "no-such-root"));
  assert.strictEqual(res.status, 2, res.out);
});

test("[AC-1 | " + BASELINE + " | FR-238] a store that cannot be read as a file (a directory in its place) exits 2", () => {
  const root = fx.tempRoot("label-");
  fs.mkdirSync(storePath(root), { recursive: true });
  assert.strictEqual(run(["--list"], root).status, 2);
  assert.strictEqual(run(["f-1", "true"], root).status, 2);
});
