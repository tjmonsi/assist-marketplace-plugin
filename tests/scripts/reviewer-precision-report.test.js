// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the user-run precision and checklist-change report
// (plugins/assist-plugin/scripts/reviewer-precision-report.js), task plan
// docs/task-plans/task-plan-reviewer-machinery-20261125-0717.md, Step 22 (script of Step 7).
//
// Sources: specs/spec-reviewer-machinery.md (Requirement 21: Report precision per lane and item, and drive checklist changes,
// scenarios Item with labels, Item with no labels, Retirement candidate below the floor, Too few labels to retire, Addition
// candidate from repeated unmapped class, Measured change; Requirement 20: only the user's label counts; Requirement 24: a
// report applies no edit), docs/requirements/FR-NFR-harness-governance.md (FR-310, FR-313, FR-314, FR-315, FR-316, NFR-034,
// SC-028, OQ-17), and the documented command line of the script:
//   node scripts/reviewer-precision-report.js [--floor N] [--min-labeled N] [--unmapped-count N]
//                                             [--before FILE --after FILE] [--root DIR]
//   --floor is a precision from 0 to 1; --min-labeled and --unmapped-count are whole numbers of 1 or more; each overrides a
//   PROVISIONAL default (floor 0.5, 10 labeled findings, count 3). A seeded-sample file is one JSON object
//   {"true_positive": N, "false_positive": N, "false_negative": N}; the sample size is true_positive plus false_negative, the
//   provisional size is 20, and a sample of another size is accepted. No precision or recall floor is applied.
//   Exit 0 a report was printed (also for an empty or missing store); exit 2 cannot report (an unknown flag, a flag with no
//   value or an unusable one, --before without --after, a root that does not exist, an unreadable sample file).
//   The report is read only and prints ids, counts, lane names, rule ids of unmapped classes, and sample sizes, never
//   finding text, a file path, or a store line.
// The spec carries no SPEC-NNN id, so it is cited by file name. The script body is never read; the output format is not
// documented beyond that, so the assertions look for the documented values on the line or in the section they belong to.
//
// Traceability format: [AC-N | spec-reviewer-machinery | FR-nnn]. AC-N is the position of the Scenario inside Requirement 21.
//
// Every project root is a temp directory with a .git directory and synthetic fixture files only.
//
// Run: node --test tests/scripts/reviewer-precision-report.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const SCRIPT = path.join(PLUGIN, "scripts", "reviewer-precision-report.js");

const SPEC = "spec-reviewer-machinery";
function tag(ac, fr) {
  return "[AC-" + ac + " | " + SPEC + " | " + fr + "]";
}

const scratch = [];

after(() => {
  while (scratch.length > 0) fs.rmSync(scratch.pop(), { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------

function tempDir(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  scratch.push(dir);
  return dir;
}

function storePath(root) {
  return path.join(root, ".agent", "governance", "review-findings.jsonl");
}

let counter = 0;
function rec(ruleId, over) {
  counter += 1;
  return Object.assign(
    {
      id: "f-" + counter,
      rule_id: ruleId,
      severity: "HIGH",
      confidence: "High",
      file: "src/file" + counter + ".js",
      line: 3,
      timestamp: "2026-11-25T09:30:00.000Z",
      review_id: "rev-1",
      source: "reviewer",
      writer: "orchestrator",
    },
    over || {}
  );
}

const USER = { labelled_by: "user", labelled_at: "2026-11-25T10:00:00Z" };

function many(ruleId, n, over) {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(rec(ruleId, over));
  return out;
}

// rows: [rule, trueN, falseN, deferredN, unlabeledN]
function store(rows) {
  let all = [];
  rows.forEach((r) => {
    all = all.concat(
      many(r[0], r[1], Object.assign({ label: true }, USER)),
      many(r[0], r[2], Object.assign({ label: false }, USER)),
      many(r[0], r[3], Object.assign({ label: "deferred" }, USER)),
      many(r[0], r[4])
    );
  });
  return all;
}

function makeRoot(records, extraLines) {
  const root = tempDir("rev-precision-");
  fs.mkdirSync(path.join(root, ".git"));
  if (records !== null) {
    fs.mkdirSync(path.dirname(storePath(root)), { recursive: true });
    const lines = records.map((r) => JSON.stringify(r)).concat(extraLines || []);
    fs.writeFileSync(storePath(root), lines.join("\n") + "\n");
  }
  return root;
}

function run(args, root) {
  const argv = [SCRIPT].concat(args);
  if (root !== null && root !== undefined) argv.push("--root", root);
  const result = childProcess.spawnSync(process.execPath, argv, { cwd: tempDir("rev-precision-cwd-"), encoding: "utf8", timeout: 60000 });
  assert.strictEqual(result.error, undefined, "spawn error: " + (result.error && result.error.message));
  result.out = (result.stdout || "") + (result.stderr || "");
  return result;
}

function linesWith(out, text) {
  return out.split("\n").filter((l) => l.indexOf(text) !== -1);
}

// The text from the first line that opens a part of the checklist-change report.
function sectionFrom(out, pattern) {
  const lines = out.split("\n");
  const idx = lines.findIndex((l) => pattern.test(l));
  return idx < 0 ? "" : lines.slice(idx).join("\n");
}

// A value as the report may write it: 0.8, 0.80, or 80%.
function valueRegex(v) {
  const dec = String(Math.round(v * 1000) / 1000);
  const pct = String(Math.round(v * 1000) / 10);
  const esc = (s) => s.replace(/\./g, "\\.");
  return new RegExp("(^|[^0-9.])" + esc(dec) + "0*(?![0-9])|(^|[^0-9.])" + esc(pct) + "(\\.0+)?\\s*%");
}

function tree(root) {
  const out = {};
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(root, p)] = crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
    });
  })(root);
  return out;
}

function sampleFile(tp, fp, fn) {
  const dir = tempDir("rev-precision-sample-");
  const file = path.join(dir, "sample.json");
  fs.writeFileSync(file, JSON.stringify({ true_positive: tp, false_positive: fp, false_negative: fn }));
  return file;
}

// ---------------------------------------------------------------------------
// Counts and precision per item (Item with labels, Item with no labels)
// ---------------------------------------------------------------------------

test(tag(1, "FR-310") + " DD-01 with 8 findings labeled true, 2 labeled false, and 5 unlabeled: the report shows counts 8, 2, 0, and 5 and precision 0.8", () => {
  const root = makeRoot(store([["DD-01", 8, 2, 0, 5]]));
  const res = run([], root);
  assert.strictEqual(res.status, 0, res.out);
  const dd01 = linesWith(res.out, "DD-01");
  assert.ok(dd01.length > 0, "no line names DD-01; output: " + res.out);
  assert.ok(dd01.some((l) => /\b8\b[^\n]*\b2\b[^\n]*\b0\b[^\n]*\b5\b/.test(l)), "no DD-01 line holds the counts 8, 2, 0, 5 in order; lines: " + dd01.join(" | "));
  assert.ok(dd01.some((l) => valueRegex(0.8).test(l)), "no DD-01 line holds the precision 0.8; lines: " + dd01.join(" | "));
});

test(tag(2, "FR-310") + " an item whose findings are all unlabeled reports precision not available", () => {
  const root = makeRoot(store([["DD-02", 0, 0, 0, 5]]));
  const res = run([], root);
  assert.strictEqual(res.status, 0, res.out);
  const dd02 = linesWith(res.out, "DD-02");
  assert.ok(dd02.length > 0, res.out);
  assert.ok(dd02.some((l) => /not available/i.test(l)), "the DD-02 line reads not available; lines: " + dd02.join(" | "));
});

test(tag(1, "FR-310") + " the report lists the three lanes and the register items", () => {
  const root = makeRoot(store([["DD-01", 1, 0, 0, 0]]));
  const res = run([], root);
  assert.strictEqual(res.status, 0, res.out);
  ["defect-depth", "test-integrity", "architecture-safety"].forEach((lane) => assert.ok(res.out.indexOf(lane) !== -1, lane + " in " + res.out));
  ["DD-01", "DD-09", "TI-01", "TI-08", "AS-01", "AS-06"].forEach((id) => assert.ok(res.out.indexOf(id) !== -1, id + " in " + res.out));
});

test(tag(1, "FR-309") + " no agent-set label is counted: findings an agent labeled read as unlabeled and give precision not available (SC-028)", () => {
  const records = many("DD-04", 5, { label: true }).concat(many("DD-04", 3, { label: false, labelled_by: "agent" }));
  const res = run([], makeRoot(records));
  assert.strictEqual(res.status, 0, res.out);
  const dd04 = linesWith(res.out, "DD-04");
  assert.ok(dd04.some((l) => /not available/i.test(l)), "lines: " + dd04.join(" | "));
});

test(tag(1, "FR-310") + " a deferred finding is counted apart from the labeled ones: 1 true, 1 false, and 3 deferred give precision 0.5", () => {
  const res = run([], makeRoot(store([["DD-05", 1, 1, 3, 0]])));
  assert.strictEqual(res.status, 0, res.out);
  const dd05 = linesWith(res.out, "DD-05");
  assert.ok(dd05.some((l) => valueRegex(0.5).test(l) && /\b3\b/.test(l)), "lines: " + dd05.join(" | "));
});

// ---------------------------------------------------------------------------
// Provisional defaults and overrides (Retirement candidate, Too few labels, Addition candidate)
// ---------------------------------------------------------------------------

test(tag(3, "FR-313") + " with no threshold flag the report uses the provisional defaults (0.5, 10, 3) and labels them provisional", () => {
  const res = run([], makeRoot(store([["DD-01", 1, 0, 0, 0]])));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(/provisional/i.test(res.out), "no provisional label; output: " + res.out);
  assert.ok(res.out.indexOf("0.5") !== -1, "the floor 0.5; output: " + res.out);
  assert.ok(/\b10\b/.test(res.out), "the minimum 10; output: " + res.out);
  assert.ok(/\b3\b/.test(res.out), "the addition count 3; output: " + res.out);
});

test(tag(3, "FR-313") + " an item with precision 0.3 over 10 labeled findings is listed as a retirement candidate at the default floor of 0.5", () => {
  const res = run([], makeRoot(store([["TI-03", 3, 7, 0, 0]])));
  assert.strictEqual(res.status, 0, res.out);
  const part = sectionFrom(res.out, /retirement candidate/i);
  assert.ok(part !== "", "the report has no retirement section; output: " + res.out);
  assert.ok(part.indexOf("TI-03") !== -1, "TI-03 is a retirement candidate; section: " + part);
});

test(tag(4, "FR-313") + " an item with precision 0.3 over fewer labeled findings than the minimum is not listed as a retirement candidate", () => {
  // 9 labeled findings at 0.33 and 4 at 0.25 are below the minimum of 10; TI-06 on the minimum is listed.
  const res = run([], makeRoot(store([["TI-04", 1, 3, 0, 0], ["TI-05", 3, 6, 0, 0], ["TI-06", 3, 7, 0, 0]])));
  assert.strictEqual(res.status, 0, res.out);
  const part = sectionFrom(res.out, /retirement candidate/i);
  assert.ok(part.indexOf("TI-06") !== -1, "TI-06 on the minimum is listed; section: " + part);
  assert.ok(part.indexOf("TI-04") === -1, "TI-04 (4 labeled) must not be listed; section: " + part);
  assert.ok(part.indexOf("TI-05") === -1, "TI-05 (9 labeled) must not be listed; section: " + part);
});

test(tag(3, "FR-313") + " an item above the floor and an item with no labeled finding are not listed as retirement candidates", () => {
  const res = run([], makeRoot(store([["DD-01", 8, 2, 0, 0], ["DD-03", 0, 0, 0, 30]])));
  assert.strictEqual(res.status, 0, res.out);
  const part = sectionFrom(res.out, /retirement candidate/i);
  assert.ok(part.indexOf("DD-01") === -1 && part.indexOf("DD-03") === -1, "section: " + part);
});

test(tag(3, "FR-313") + " --floor overrides the default floor: at 0.2 the 0.3 item is no longer a retirement candidate", () => {
  const res = run(["--floor", "0.2"], makeRoot(store([["TI-03", 3, 7, 0, 0]])));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(res.out.indexOf("0.2") !== -1, "the report prints the floor it used; output: " + res.out);
  const part = sectionFrom(res.out, /retirement candidate/i);
  assert.ok(part.indexOf("TI-03") === -1, "section: " + part);
});

test(tag(3, "FR-313") + " --min-labeled overrides the default minimum: at 4 the 0.25 item over 4 labeled findings is listed", () => {
  const res = run(["--min-labeled", "4"], makeRoot(store([["TI-04", 1, 3, 0, 0]])));
  assert.strictEqual(res.status, 0, res.out);
  const part = sectionFrom(res.out, /retirement candidate/i);
  assert.ok(part.indexOf("TI-04") !== -1, "section: " + part);
});

test(tag(5, "FR-314") + " three unmapped findings of one class make it an addition candidate at the default count of 3, and two do not", () => {
  const records = many("novel-class-a", 3).concat(many("novel-class-b", 2));
  const res = run([], makeRoot(records));
  assert.strictEqual(res.status, 0, res.out);
  const part = sectionFrom(res.out, /addition candidate/i);
  assert.ok(part !== "", "the report has no addition section; output: " + res.out);
  assert.ok(part.indexOf("novel-class-a") !== -1, "section: " + part);
  assert.ok(part.indexOf("novel-class-b") === -1, "section: " + part);
});

test(tag(5, "FR-314") + " --unmapped-count overrides the default count: at 2 the two-finding class is listed", () => {
  const res = run(["--unmapped-count", "2"], makeRoot(many("novel-class-b", 2)));
  assert.strictEqual(res.status, 0, res.out);
  const part = sectionFrom(res.out, /addition candidate/i);
  assert.ok(part.indexOf("novel-class-b") !== -1, "section: " + part);
});

test(tag(5, "FR-314") + " a code-scan record with no reviewer source never becomes an addition candidate", () => {
  const records = many("sql-string-concat", 5);
  records.forEach((r) => delete r.source);
  const res = run([], makeRoot(records));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(sectionFrom(res.out, /addition candidate/i).indexOf("sql-string-concat") === -1, res.out);
});

test(tag(3, "FR-315") + " the report applies no checklist edit: the project tree and the register are byte for byte as they were", () => {
  const root = makeRoot(store([["TI-03", 3, 7, 0, 0]]).concat(many("novel-class-a", 4)));
  const before = tree(root);
  const registerPath = path.join(PLUGIN, "rules", "reviewer-checklists.md");
  const registerBefore = crypto.createHash("sha256").update(fs.readFileSync(registerPath)).digest("hex");
  assert.strictEqual(run([], root).status, 0);
  assert.deepStrictEqual(tree(root), before, "the run wrote or changed a file under the project root");
  assert.strictEqual(crypto.createHash("sha256").update(fs.readFileSync(registerPath)).digest("hex"), registerBefore, "the register changed");
});

// ---------------------------------------------------------------------------
// Measured change (Requirement 21, Measured change)
// ---------------------------------------------------------------------------

test(tag(6, "FR-316") + " a seeded sample of 20 defects before and after a change: the report holds precision and recall before and after and the size", () => {
  // Before: tp 8, fp 2, fn 12 -> precision 0.8, recall 0.4, size 20. After: tp 18, fp 6, fn 2 -> precision 0.75, recall 0.9.
  const res = run(["--before", sampleFile(8, 2, 12), "--after", sampleFile(18, 6, 2)], makeRoot(store([["DD-01", 1, 0, 0, 0]])));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(/\b20\b/.test(res.out), "the sample size 20; output: " + res.out);
  [0.8, 0.4, 0.75, 0.9].forEach((v) => assert.ok(valueRegex(v).test(res.out), "the value " + v + "; output: " + res.out));
  assert.ok(!/no measurement/i.test(res.out), "a sample is present, so the report must not say no measurement exists; output: " + res.out);
});

test(tag(6, "FR-316") + " a sample of another size than the provisional 20 is accepted, and its size is printed", () => {
  // tp 3, fp 1, fn 2 -> a sample of 5 defects.
  const res = run(["--before", sampleFile(3, 1, 2), "--after", sampleFile(4, 1, 1)], makeRoot(store([["DD-01", 1, 0, 0, 0]])));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(/\b5\b/.test(res.out), "the size 5; output: " + res.out);
  assert.ok(/\b20\b/.test(res.out) && /provisional/i.test(res.out), "the provisional size of 20 is noted; output: " + res.out);
});

test(tag(6, "FR-316") + " with no seeded sample the report states that no measurement exists", () => {
  const res = run([], makeRoot(store([["DD-01", 1, 0, 0, 0]])));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(/no measurement/i.test(res.out), "output: " + res.out);
});

test(tag(6, "FR-316") + " no precision or recall floor is applied: an after result worse than the before result still prints with exit 0", () => {
  const res = run(["--before", sampleFile(18, 2, 2), "--after", sampleFile(2, 18, 18)], makeRoot(store([["DD-01", 1, 0, 0, 0]])));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(!/\b(FAIL|FAILED|rejected)\b/.test(res.out), "output: " + res.out);
});

// ---------------------------------------------------------------------------
// Empty and damaged stores
// ---------------------------------------------------------------------------

test(tag(1, "FR-310") + " a project with no finding store prints a report and exits 0", () => {
  const res = run([], makeRoot(null));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(res.out.indexOf("DD-01") !== -1, res.out);
});

test(tag(1, "FR-310") + " an empty store prints a report and exits 0", () => {
  const res = run([], makeRoot([]));
  assert.strictEqual(res.status, 0, res.out);
});

test(tag(1, "FR-310") + " a store line that is not a valid finding is skipped, and the valid findings still count", () => {
  const root = makeRoot(store([["DD-01", 8, 2, 0, 0]]), ["{not json", "[1,2,3]", "null", '{"id":"x","rule_id":"y","severity":"SEVERE"}']);
  const res = run([], root);
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(linesWith(res.out, "DD-01").some((l) => valueRegex(0.8).test(l)), res.out);
});

// ---------------------------------------------------------------------------
// Output holds no finding text, no path, and no store line
// ---------------------------------------------------------------------------

test(tag(1, "NFR-042") + " the report prints no file path and no store line, only ids, counts, and rule ids", () => {
  const records = store([["DD-01", 3, 1, 0, 1]]).map((r, i) => Object.assign({}, r, { file: "src/very-secret-dir/payload-" + i + ".js", problem: "quotes the secret sk-live-ZZZ999" }));
  const res = run([], makeRoot(records, ["{not json SECRETSTORELINE-77"]));
  assert.strictEqual(res.status, 0, res.out);
  ["very-secret-dir", "payload-", "sk-live", "SECRETSTORELINE"].forEach((leak) => assert.ok(res.out.indexOf(leak) === -1, leak + " reached the output: " + res.out));
});

test(tag(1, "NFR-042") + " the class of an unmapped finding is printed as a rule id and never a quoted text", () => {
  // A rule id of the shape the store allows; the report prints it as the class name.
  const res = run([], makeRoot(many("novel-class-a", 3, { problem: "quoted text must not travel" })));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(res.out.indexOf("novel-class-a") !== -1, res.out);
  assert.ok(res.out.indexOf("quoted text") === -1, res.out);
});

// ---------------------------------------------------------------------------
// Exit 2: the report cannot run
// ---------------------------------------------------------------------------

test(tag(3, "FR-313") + " an unknown flag exits 2", () => {
  assert.strictEqual(run(["--bogus"], makeRoot([])).status, 2);
  assert.strictEqual(run(["--floor", "0.5", "stray-word"], makeRoot([])).status, 2);
});

test(tag(3, "FR-313") + " a threshold flag with no value exits 2", () => {
  ["--floor", "--min-labeled", "--unmapped-count"].forEach((flag) => {
    const root = makeRoot([]);
    const res = childProcess.spawnSync(process.execPath, [SCRIPT, "--root", root, flag], { cwd: tempDir("rev-precision-cwd-"), encoding: "utf8", timeout: 60000 });
    assert.strictEqual(res.status, 2, flag + "; output: " + res.stdout + res.stderr);
  });
});

test(tag(3, "FR-313") + " a floor outside 0 to 1, or not a number, exits 2", () => {
  ["1.5", "-0.1", "abc", "", "NaN"].forEach((bad) => {
    assert.strictEqual(run(["--floor", bad], makeRoot([])).status, 2, "--floor " + JSON.stringify(bad));
  });
});

test(tag(3, "FR-313") + " a minimum or an addition count that is not a whole number of 1 or more exits 2", () => {
  ["0", "-3", "2.5", "ten", ""].forEach((bad) => {
    assert.strictEqual(run(["--min-labeled", bad], makeRoot([])).status, 2, "--min-labeled " + JSON.stringify(bad));
    assert.strictEqual(run(["--unmapped-count", bad], makeRoot([])).status, 2, "--unmapped-count " + JSON.stringify(bad));
  });
});

test(tag(6, "FR-316") + " --before without --after exits 2, and a sample file that cannot be read exits 2", () => {
  assert.strictEqual(run(["--before", sampleFile(8, 2, 12)], makeRoot([])).status, 2);
  const missing = path.join(tempDir("rev-precision-missing-"), "no-such.json");
  assert.strictEqual(run(["--before", missing, "--after", missing], makeRoot([])).status, 2);
});

test(tag(1, "FR-310") + " a project root that does not exist exits 2", () => {
  const res = run([], path.join(tempDir("rev-precision-missing-"), "no-such-root"));
  assert.strictEqual(res.status, 2, res.out);
});

test(tag(1, "FR-310") + " an option value shaped like a command is never run", () => {
  // Security-adjacent: shell metacharacters in a flag value and a path.
  const root = makeRoot([]);
  const res = run(["--floor", "0.5; touch PWNED", "--min-labeled", "$(touch PWNED)"], root);
  assert.strictEqual(res.status, 2, res.out);
  assert.strictEqual(fs.existsSync(path.join(root, "PWNED")), false);
});
