// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the advisory baseline report of harness-governance Tranche 4
// (plugins/assist-plugin/scripts/baseline-report.js), task plan Step 37.
//
// Sources: specs/spec-hooks-code-scan.md (Requirement: Advisory baseline and precision from user labels, scenarios
// Unlabelled finding is not counted and Precision from the user's labels; Change Log 2026-11-13 (Tranche 4 as-built
// reconciliation), the labelOf rule), docs/requirements/FR-NFR-harness-governance.md (FR-238, NFR-034, NFR-031, scenario
// Agent self-judgment does not set precision), and the usage header of the script (the command line, the window, and the
// exit codes). The spec carries no SPEC-NNN id, so it is cited by file name.
//
// Traceability format: [AC-N | spec-hooks-code-scan.md Requirement | FR/NFR ids]. AC-N is the position of the Scenario
// inside the Requirement: "Unlabelled finding is not counted" is AC-1 and "Precision from the user's labels" is AC-2.
//
// Contract used (documented behavior; the script body is never read):
//   node scripts/baseline-report.js [--rule RULE_ID] [--root DIR]
//   Reads .agent/governance/review-findings.jsonl and prints, per rule, the finding counts and the precision of the user's
//   labels: true labels over labelled findings. A finding with no boolean label is shown as unlabelled and is never counted.
//   With no labelled finding the precision is "not computable". The window is complete when 14 days have passed since the
//   rule's first finding AND the findings name at least 20 distinct review ids; an open window is marked OPEN.
//   Exit 0 a report was printed (an absent store included); exit 2 cannot report (bad arguments, an unknown root, an
//   unreadable store). The script writes nothing and prints no file path and no finding text.
//
// The report text is not specified to the character, so the assertions read numbers and words: a percentage on a line that
// names the precision, a count next to the word unlabelled, and the marker OPEN.
//
// Run: node --test tests/scripts/baseline-report.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const SCRIPT = path.join(fx.PLUGIN, "scripts", "baseline-report.js");
const SPEC = "spec-hooks-code-scan.md";
const BASELINE = SPEC + " Requirement: Advisory baseline and precision from user labels";
const DAY = 24 * 60 * 60 * 1000;
const RULE = "sql-from-input";
const OTHER = "shell-from-variable";

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------

function isoDaysAgo(days) {
  return new Date(Date.now() - days * DAY).toISOString();
}

// One finding. options: {i, rule, label (true, false, "true", or undefined), review, days, extra}.
function finding(o) {
  const record = {
    id: "f-" + o.rule + "-" + o.i,
    rule_id: o.rule,
    severity: "HIGH",
    confidence: "High",
    file: o.file || "src/db.js",
    line: o.i + 1,
    timestamp: isoDaysAgo(o.days === undefined ? 30 : o.days),
  };
  if (o.review !== null) record.review_id = o.review === undefined ? "rev-" + o.i : o.review;
  if (o.label !== undefined) record.label = o.label;
  return Object.assign(record, o.extra || {});
}

// n findings of a rule with distinct review ids, the first labelled as given. labels: an array of true, false, "true",
// or undefined, one per finding.
function labelled(rule, labels, options) {
  return labels.map((label, i) => finding(Object.assign({ i: i, rule: rule, label: label }, options || {})));
}

function repeat(value, n) {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(value);
  return out;
}

function makeRoot(records, extraLines) {
  const root = fx.tempRoot("baseline-");
  if (records !== null) {
    const dir = path.join(root, ".agent", "governance");
    fs.mkdirSync(dir, { recursive: true });
    const lines = records.map((r) => JSON.stringify(r)).concat(extraLines || []);
    fs.writeFileSync(path.join(dir, "review-findings.jsonl"), lines.join("\n") + "\n");
  }
  return root;
}

function run(root, extraArgs) {
  const args = [SCRIPT];
  if (root !== null) args.push("--root", root);
  const result = childProcess.spawnSync(process.execPath, args.concat(extraArgs || []), {
    cwd: fx.tempDir("baseline-cwd-"),
    env: fx.cleanEnv(),
    encoding: "utf8",
    timeout: 60000,
  });
  assert.strictEqual(result.error, undefined, "spawn error: " + (result.error && result.error.message));
  result.out = (result.stdout || "") + (result.stderr || "");
  return result;
}

// Every percentage printed on a line that names the precision. A fraction (0.75) is read as a percentage too.
function precisions(out) {
  const values = [];
  out.split("\n").forEach((line) => {
    if (!/precision/i.test(line)) return;
    const re = /(\d+(?:\.\d+)?)\s*%/g;
    let m;
    while ((m = re.exec(line)) !== null) values.push(Number(m[1]));
  });
  return values;
}

function hasPrecision(out, expected) {
  return precisions(out).some((v) => Math.abs(v - expected) < 0.06 || Math.abs(v * 100 - expected) < 0.06);
}

// Counts printed next to the word unlabelled (or unlabeled).
function unlabelledCounts(out) {
  const values = [];
  let m;
  const before = /(\d+)\s+unlabell?ed/gi;
  while ((m = before.exec(out)) !== null) values.push(Number(m[1]));
  const after = /unlabell?ed[^\n\d]{0,24}(\d+)/gi;
  while ((m = after.exec(out)) !== null) values.push(Number(m[1]));
  return values;
}

function snapshot(root) {
  const out = {};
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[path.relative(root, full)] = fs.readFileSync(full, "utf8");
    });
  })(path.join(root, ".agent"));
  return out;
}

// ---------------------------------------------------------------------------
// Precision from the user's labels only
// ---------------------------------------------------------------------------

test("[AC-2 | " + BASELINE + " | FR-238 | NFR-034] precision is the true labels over the labelled findings: 3 true and 1 false give 75%", () => {
  const root = makeRoot(labelled(RULE, [true, true, true, false]));
  const res = run(root);
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(hasPrecision(res.out, 75), "a precision of 75% is reported; output: " + res.out);
});

test("[AC-2 | " + BASELINE + " | FR-238 | NFR-034] a false label is a label: 1 true and 1 false give 50%, and 0 true of 4 labelled give 0%", () => {
  assert.ok(hasPrecision(run(makeRoot(labelled(RULE, [true, false]))).out, 50));
  const zero = run(makeRoot(labelled(RULE, [false, false, false, false])));
  assert.strictEqual(zero.status, 0, zero.out);
  assert.ok(hasPrecision(zero.out, 0), "a precision of 0% is reported; output: " + zero.out);
});

test("[AC-2 | " + BASELINE + " | FR-238 | NFR-034] precision of all-true labels is 100%", () => {
  assert.ok(hasPrecision(run(makeRoot(labelled(RULE, repeat(true, 5)))).out, 100));
});

test("[AC-1 | " + BASELINE + " | FR-238 | NFR-034] an unlabelled finding is shown as unlabelled and never counted, whatever an agent says about it", () => {
  // 3 true, 1 false (75%), plus 2 unlabelled findings that carry an agent's own verdict in an extra field.
  const records = labelled(RULE, [true, true, true, false]).concat([
    finding({ i: 4, rule: RULE, extra: { agent_verdict: true, agent_judgment: "true", judged_true: true } }),
    finding({ i: 5, rule: RULE, extra: { agent_verdict: true } }),
  ]);
  const res = run(makeRoot(records));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(/unlabell?ed/i.test(res.out), "the report shows unlabelled findings; output: " + res.out);
  assert.ok(unlabelledCounts(res.out).indexOf(2) !== -1, "the report counts 2 unlabelled findings; output: " + res.out);
  assert.ok(hasPrecision(res.out, 75), "precision stays 75% from the user's labels; output: " + res.out);
  [(5 / 6) * 100, (3 / 5) * 100, (4 / 6) * 100].forEach((wrong) => {
    assert.ok(!hasPrecision(res.out, wrong), "an agent verdict was counted (" + wrong.toFixed(1) + "%); output: " + res.out);
  });
});

test("[AC-1 | " + SPEC + " Change Log 2026-11-13 (Tranche 4 as-built reconciliation), labelOf | FR-238 | NFR-034] a label that is the string true is unlabelled and never counted", () => {
  // Type-mismatch: 2 true and 2 false labels (50%) plus 3 records whose label is the string "true".
  const res = run(makeRoot(labelled(RULE, [true, true, false, false, "true", "true", "true"])));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(hasPrecision(res.out, 50), "precision stays 50%; output: " + res.out);
  assert.ok(!hasPrecision(res.out, (5 / 7) * 100), "a string label was counted as true; output: " + res.out);
  assert.ok(unlabelledCounts(res.out).indexOf(3) !== -1, "the 3 string-labelled findings show as unlabelled; output: " + res.out);
});

test("[AC-1 | " + BASELINE + " | FR-238 | NFR-034] with no labelled finding the precision is not computable and no percentage is invented", () => {
  const res = run(makeRoot(labelled(RULE, repeat(undefined, 4))));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(/not computable/i.test(res.out), "the report says the precision is not computable; output: " + res.out);
  assert.deepStrictEqual(precisions(res.out), [], "no precision percentage is printed; output: " + res.out);
  assert.ok(unlabelledCounts(res.out).indexOf(4) !== -1, "the 4 unlabelled findings are counted; output: " + res.out);
});

test("[AC-2 | " + BASELINE + " | FR-238] the report lists the finding counts of the rule", () => {
  const res = run(makeRoot(labelled(RULE, [true, false, true, undefined, undefined])));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(res.out.indexOf(RULE) !== -1, "the rule id is named; output: " + res.out);
  assert.ok(/\b5\b/.test(res.out), "the total of 5 findings is listed; output: " + res.out);
});

// ---------------------------------------------------------------------------
// Rules: one section each, or one with --rule
// ---------------------------------------------------------------------------

test("[AC-2 | " + BASELINE + " | FR-238] without --rule every rule of the store is reported, and --rule limits the report to one", () => {
  const root = makeRoot(labelled(RULE, [true, true]).concat(labelled(OTHER, [false, false])));
  const all = run(root);
  assert.strictEqual(all.status, 0, all.out);
  assert.ok(all.out.indexOf(RULE) !== -1 && all.out.indexOf(OTHER) !== -1, "both rules are named; output: " + all.out);
  const one = run(root, ["--rule", RULE]);
  assert.strictEqual(one.status, 0, one.out);
  assert.ok(one.out.indexOf(RULE) !== -1, "the chosen rule is named; output: " + one.out);
  assert.ok(one.out.indexOf(OTHER) === -1, "the other rule is left out; output: " + one.out);
  assert.ok(hasPrecision(one.out, 100) && !hasPrecision(one.out, 0), "the precision is the chosen rule's; output: " + one.out);
});

// ---------------------------------------------------------------------------
// The window: complete only at 14 days AND 20 distinct review ids
// ---------------------------------------------------------------------------

function windowRoot(count, reviews, ageDays) {
  const records = [];
  for (let i = 0; i < count; i += 1) {
    const days = count === 1 ? ageDays : ageDays - ((ageDays - 1) * i) / (count - 1);
    records.push(finding({ i: i, rule: RULE, label: true, review: reviews === 0 ? null : "rev-" + (i % reviews), days: Math.max(days, 0.01) }));
  }
  return makeRoot(records);
}

test("[AC-2 | " + BASELINE + " | FR-238] a window with 20 distinct review ids and 30 days is complete: no OPEN marker", () => {
  const res = run(windowRoot(20, 20, 30));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(!/\bOPEN\b/.test(res.out), "a complete window is not marked OPEN; output: " + res.out);
});

test("[AC-2 | " + BASELINE + " | FR-238] 19 distinct review ids after 30 days is an open window, still reported with its precision", () => {
  // Boundary: one review short.
  const res = run(windowRoot(19, 19, 30));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(/\bOPEN\b/.test(res.out), "marked OPEN; output: " + res.out);
  assert.ok(hasPrecision(res.out, 100), "an open window still prints the precision; output: " + res.out);
});

test("[AC-2 | " + BASELINE + " | FR-238] 20 distinct review ids after 5 days is an open window: the later of the two moments ends it", () => {
  const res = run(windowRoot(20, 20, 5));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(/\bOPEN\b/.test(res.out), "marked OPEN; output: " + res.out);
});

test("[AC-2 | " + BASELINE + " | FR-238] 25 findings from one review id after 30 days is an open window: reviews count distinct ids", () => {
  const res = run(windowRoot(25, 1, 30));
  assert.ok(/\bOPEN\b/.test(res.out), "marked OPEN; output: " + res.out);
});

test("[AC-2 | " + BASELINE + " | FR-238] findings with no review id count toward the days only, so 20 of them leave the window open", () => {
  const res = run(windowRoot(20, 0, 30));
  assert.ok(/\bOPEN\b/.test(res.out), "marked OPEN; output: " + res.out);
});

// ---------------------------------------------------------------------------
// Exit codes, safety, and read-only behavior
// ---------------------------------------------------------------------------

test("[AC-2 | " + BASELINE + " | FR-238] an absent findings store prints a report and exits 0", () => {
  const res = run(makeRoot(null));
  assert.strictEqual(res.status, 0, res.out);
});

test("[AC-2 | " + BASELINE + " | FR-238] an empty findings store prints a report and exits 0", () => {
  const res = run(makeRoot([]));
  assert.strictEqual(res.status, 0, res.out);
});

test("[AC-2 | " + BASELINE + " | FR-238] a line of the store that is not a valid finding is skipped and the rest is still reported", () => {
  // Invalid input: malformed JSON, a wrong shape, and a record with an unknown severity sit between valid ones.
  const bad = ["{not json", "[1,2,3]", "null", JSON.stringify({ id: "x", rule_id: RULE, severity: "SEVERE", confidence: "High", file: "a.js", line: 1, timestamp: isoDaysAgo(1) })];
  const res = run(makeRoot(labelled(RULE, [true, true, true, false]), bad));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(hasPrecision(res.out, 75), "the four valid findings give 75%; output: " + res.out);
});

test("[AC-2 | " + BASELINE + " | FR-238] bad arguments exit 2: an unknown flag, and a missing value for --rule", () => {
  const root = makeRoot(labelled(RULE, [true]));
  assert.strictEqual(run(root, ["--bogus"]).status, 2);
  assert.strictEqual(run(root, ["--rule"]).status, 2);
});

test("[AC-2 | " + BASELINE + " | FR-238] a project root that does not exist exits 2", () => {
  const res = run(path.join(fx.tempDir("baseline-missing-"), "no-such-root"));
  assert.strictEqual(res.status, 2, res.out);
});

test("[AC-2 | " + BASELINE + " | FR-238] a findings store that cannot be read as a file (a directory in its place) exits 2", () => {
  const root = fx.tempRoot("baseline-");
  fs.mkdirSync(path.join(root, ".agent", "governance", "review-findings.jsonl"), { recursive: true });
  const res = run(root);
  assert.strictEqual(res.status, 2, res.out);
});

test("[AC-2 | " + BASELINE + " | FR-238 | NFR-031] the report is read only: the store and every other file under .agent stay byte for byte as they were", () => {
  const root = makeRoot(labelled(RULE, [true, false, undefined]), ["{not json"]);
  fs.writeFileSync(path.join(root, ".agent", "governance", "rule-modes.json"), JSON.stringify({ [RULE]: "advisory" }));
  const before = snapshot(root);
  const res = run(root);
  assert.strictEqual(res.status, 0, res.out);
  assert.deepStrictEqual(snapshot(root), before);
});

test("[AC-2 | " + BASELINE + " | FR-238 | NFR-031] the report prints no file path and no finding text", () => {
  const marker = "secret-dir-7f3a9c";
  const records = labelled(RULE, [true, false, undefined], { file: "src/" + marker + "/db.js", extra: { problem: "leaky-text-4b2d", matched: "leaky-text-4b2d" } });
  const res = run(makeRoot(records));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(res.out.indexOf(marker) === -1, "a file path appears in the report; output: " + res.out);
  assert.ok(res.out.indexOf("src/") === -1 || res.out.indexOf("db.js") === -1, "a file name appears in the report; output: " + res.out);
  assert.ok(res.out.indexOf("leaky-text-4b2d") === -1, "finding text appears in the report; output: " + res.out);
});
