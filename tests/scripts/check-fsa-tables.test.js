// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box tests for plugins/assist-plugin/scripts/check-fsa-tables.js
// (drift checks added in 1.11.1).
//
// Sources: specs/spec-hooks-fsa-table-check.md (Requirements: Write guard lists in the
// markdown, Write guard list parsing, Protected path drift check, Auto-loaded file drift
// check, Task-plan glob drift check, Verdict pairing drift check) and
// docs/requirements/FR-NFR-assist-plugin.md (FR-126, FR-127, FR-128, FR-129, FR-180,
// NFR-021).
//
// Traceability format: [Scenario title | spec section | FR/NFR ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// Fixture rules (task plan, step 4): the script resolves its plugin root from __dirname,
// so every case runs a scratch copy of plugins/assist-plugin. The test rewrites four files
// of the copy and never touches the real tree:
//   - rules/assist-plugin-rule.md: the `## Write guard lists` section is replaced (or
//     deleted for the missing-section case);
//   - agents/task-planner.md: the table under `## Write scope` is replaced;
//   - hooks/lib/fsa-paths.js and hooks/lib/fsa-tables.js: the code-side values are
//     overridden by code appended to the copy, so each case states its own code values.
// Cases run one after another (node:test default), and every case rebuilds the four files.
//
// Run: node --test tests/scripts/check-fsa-tables.test.js

"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const childProcess = require("node:child_process");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");

const NEW_GLOB = "docs/task-plans/task-plan-*.md";
const OLD_GLOB = "task-plan-*.md";
const DECISION =
  "this write guard change needs a user decision recorded in DECISIONS.md before lib/fsa-paths.js follows the markdown";
const TRUTH_LINE = /^\d+ difference\(s\) between lib and the markdown\. The markdown is the source of truth\.$/;

const RULE_FILE = "rules/assist-plugin-rule.md";
const PLANNER_FILE = "agents/task-planner.md";
const PATHS_FILE = "hooks/lib/fsa-paths.js";
const TABLES_FILE = "hooks/lib/fsa-tables.js";

const LABEL_GLOBS = "write guard list PROTECTED_GLOBS (rules/assist-plugin-rule.md, ### Protected globs)";
const LABEL_FILES = "write guard list PROTECTED_FILES (rules/assist-plugin-rule.md, ### Protected files)";
const LABEL_AUTO = "write guard list AUTO_LOADED (rules/assist-plugin-rule.md, ### Auto-loaded names)";
const LABEL_TP_RULE = "TASK_PLAN_GLOB (rules/assist-plugin-rule.md, ### Task-plan glob)";
const LABEL_TP_PLANNER = "TASK_PLAN_GLOB (agents/task-planner.md, ## Write scope)";
const LABEL_VERDICT = "verdict pairing (agents/intake-reviewer.md)";

// ---------------------------------------------------------------------------
// Scratch copy of the plugin
// ---------------------------------------------------------------------------

let scratchRoot;
let copy; // path of the scratch plugin copy

const pristine = {};
[RULE_FILE, PLANNER_FILE, PATHS_FILE, TABLES_FILE].forEach((rel) => {
  pristine[rel] = fs.readFileSync(path.join(PLUGIN, rel), "utf8");
});

before(() => {
  scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fsa-check-"));
  copy = path.join(scratchRoot, "assist-plugin");
  fs.cpSync(PLUGIN, copy, {
    recursive: true,
    filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src),
  });
});

after(() => {
  if (scratchRoot) fs.rmSync(scratchRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Markdown fixture builders
// ---------------------------------------------------------------------------

function code(value) {
  return "`" + value + "`";
}

// Returns [start, end) of a level-2 section: from the heading line to the next level 1 or
// 2 heading outside a code fence. Returns null when the heading is absent.
function sectionBounds(lines, heading) {
  let fence = null;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const f = /^ {0,3}(`{3,10}|~{3,10})/.exec(line);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      continue;
    }
    if (f) {
      fence = f[1];
      continue;
    }
    if (start < 0) {
      if (line.trim() === heading) start = i;
    } else if (/^#{1,2} /.test(line)) {
      return [start, i];
    }
  }
  return start < 0 ? null : [start, lines.length];
}

function removeSection(text, heading) {
  const lines = text.split("\n");
  const b = sectionBounds(lines, heading);
  if (!b) return text;
  return lines.slice(0, b[0]).concat(lines.slice(b[1])).join("\n");
}

function ruleSection(o) {
  const out = [
    "## Write guard lists",
    "",
    "Fixture paragraph. The first column holds the exact code string.",
  ];
  const subs = [
    ["### Protected globs", o.protectedGlobs, "Glob"],
    ["### Protected files", o.protectedFiles, "File name"],
    ["### Auto-loaded names", o.autoLoaded, "File name"],
    ["### Task-plan glob", o.taskPlanRule, "Glob"],
  ];
  subs.forEach((sub) => {
    if (sub[1] === null) return; // subsection omitted
    out.push("", sub[0], "", "| " + sub[2] + " | Meaning |", "|---|---|");
    sub[1].forEach((cell) => out.push("| " + cell + " | Fixture meaning |"));
  });
  return out.join("\n") + "\n";
}

function buildRuleFile(o) {
  let text = removeSection(pristine[RULE_FILE], "## Write guard lists");
  if (!/\n$/.test(text)) text += "\n";
  if (o.rule === false) return text;
  return text + "\n" + ruleSection(o);
}

function buildPlannerFile(rows) {
  const lines = pristine[PLANNER_FILE].split("\n");
  const b = sectionBounds(lines, "## Write scope");
  let head;
  let section;
  let tail;
  if (b) {
    head = lines.slice(0, b[0]);
    section = lines.slice(b[0], b[1]);
    tail = lines.slice(b[1]);
  } else {
    head = lines.concat([""]);
    section = ["## Write scope", "", "The agent writes task plan files only."];
    tail = [];
  }
  section = section.filter((l) => !/^\s*\|/.test(l));
  while (section.length && section[section.length - 1].trim() === "") section.pop();
  if (rows) {
    section = section.concat(
      ["", "| Glob | Where |", "|---|---|"],
      rows.map((cell) => "| " + cell + " | Directly under docs/task-plans/ of the session git root |"),
      [""]
    );
  } else {
    section.push("");
  }
  return head.concat(section, tail).join("\n");
}

// ---------------------------------------------------------------------------
// Code-side overrides (appended to the copied modules)
// ---------------------------------------------------------------------------

function pathsOverride(codeValues) {
  return (
    "\n;(function () {\n" +
    "  var base = module.exports;\n" +
    "  module.exports = Object.assign({}, base, " +
    JSON.stringify(codeValues) +
    ");\n" +
    "})();\n"
  );
}

function tablesOverride(verdicts) {
  return (
    "\n;(function () {\n" +
    "  var base = module.exports;\n" +
    "  var spec = " +
    JSON.stringify(verdicts) +
    ";\n" +
    "  var verdictByStep = {};\n" +
    "  Object.keys(spec).forEach(function (k) { verdictByStep[k] = new RegExp(spec[k]); });\n" +
    "  var tables = Object.assign({}, base.TABLES);\n" +
    "  tables['intake-reviewer'] = Object.assign({}, tables['intake-reviewer'], { verdictByStep: verdictByStep });\n" +
    "  module.exports = Object.assign({}, base, { TABLES: tables });\n" +
    "})();\n"
  );
}

function defaults() {
  return {
    // markdown first-column cells (raw text, backticks included)
    protectedGlobs: [code("**/.agent/main-plan/**")],
    protectedFiles: [code("DECISIONS.md")],
    autoLoaded: [code("CLAUDE.md"), code("CLAUDE.local.md"), code("AGENTS.md")],
    taskPlanRule: [code(NEW_GLOB)],
    taskPlanner: [code(NEW_GLOB)],
    rule: true,
    // code-side values
    codePaths: {
      PROTECTED_GLOBS: ["**/.agent/main-plan/**"],
      PROTECTED_FILES: ["DECISIONS.md"],
      AUTO_LOADED: ["CLAUDE.md", "CLAUDE.local.md", "AGENTS.md"],
      TASK_PLAN_GLOB: NEW_GLOB,
    },
    verdicts: {
      Decide: "^(accepted|needs-changes)$",
      Verify: "^(clear|needs-clarification)$",
    },
  };
}

// Rebuilds the four fixture files of the scratch copy. `overrides.codePaths` merges into
// the defaults one key at a time; `overrides.verdicts` replaces the whole map when given.
function fixture(overrides) {
  const o = defaults();
  const given = overrides || {};
  Object.keys(given).forEach((k) => {
    if (k === "codePaths") o.codePaths = Object.assign(o.codePaths, given.codePaths);
    else o[k] = given[k];
  });

  const rulePath = path.join(copy, RULE_FILE);
  fs.rmSync(rulePath, { recursive: true, force: true }); // clears a directory left by an earlier case
  fs.writeFileSync(rulePath, buildRuleFile(o));
  fs.writeFileSync(path.join(copy, PLANNER_FILE), buildPlannerFile(o.taskPlanner));
  fs.writeFileSync(path.join(copy, PATHS_FILE), pristine[PATHS_FILE] + pathsOverride(o.codePaths));
  fs.writeFileSync(path.join(copy, TABLES_FILE), pristine[TABLES_FILE] + tablesOverride(o.verdicts));
}

// ---------------------------------------------------------------------------
// Running and reading the output
// ---------------------------------------------------------------------------

function run(args) {
  const r = childProcess.spawnSync(
    process.execPath,
    [path.join(copy, "scripts", "check-fsa-tables.js")].concat(args === undefined ? ["--check"] : args),
    { cwd: scratchRoot, encoding: "utf8", timeout: 60000 }
  );
  assert.strictEqual(r.error, undefined, "spawn failed: " + (r.error && r.error.message));
  const parsed = parse(r.stdout || "");
  return {
    status: r.status,
    stdout: r.stdout || "",
    stderr: r.stderr || "",
    blocks: parsed.blocks,
    rest: parsed.rest,
  };
}

// A comparison starts with "ok    <label>" or "DRIFT <label>"; its problems follow, indented
// by 6 spaces. Any other non-blank line is outside the comparisons (the total line).
function parse(stdout) {
  const blocks = [];
  const rest = [];
  let cur = null;
  stdout.split("\n").forEach((line) => {
    if (/^ok {4}/.test(line)) {
      cur = { status: "ok", label: line.slice(6), lines: [] };
      blocks.push(cur);
    } else if (/^DRIFT /.test(line)) {
      cur = { status: "DRIFT", label: line.slice(6), lines: [] };
      blocks.push(cur);
    } else if (/^ {6}\S/.test(line) && cur) {
      cur.lines.push(line.slice(6));
    } else if (line.trim() !== "") {
      cur = null;
      rest.push(line);
    }
  });
  return { blocks, rest };
}

function block(result, labelPart) {
  const found = result.blocks.filter((b) => b.label.indexOf(labelPart) !== -1);
  assert.ok(found.length >= 1, "no comparison line for: " + labelPart + "\n--- stdout ---\n" + result.stdout);
  return found[0];
}

function lastLine(stdout) {
  const lines = stdout.split("\n").filter((l) => l.trim() !== "");
  return lines[lines.length - 1];
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function assertDriftExit(result) {
  assert.strictEqual(result.status, 1, "expected exit 1\n" + result.stdout + result.stderr);
  assert.match(lastLine(result.stdout), TRUTH_LINE);
}

function assertInSync(result) {
  assert.strictEqual(result.status, 0, "expected exit 0\n" + result.stdout + result.stderr);
  assert.strictEqual(lastLine(result.stdout), "FSA tables match the markdown.");
  assert.ok(!result.blocks.some((b) => b.status === "DRIFT"), "unexpected DRIFT\n" + result.stdout);
}

// ---------------------------------------------------------------------------
// Baseline: Values equal the code (FR-180), Glob matches (FR-127), Paths match (FR-128),
// Names match (FR-129), Pairing matches (FR-126)
// ---------------------------------------------------------------------------

test("baseline: markdown tables equal the code values, exit 0 and the match line", () => {
  // [Scenario: Values equal the code | spec-hooks-fsa-table-check.md "Write guard lists in the markdown" | FR-180 | FR-186 | NFR-021]
  // [Scenario: Glob matches | "Task-plan glob drift check" | FR-127]
  // [Scenario: Paths match | "Protected path drift check" | FR-128]
  // [Scenario: Names match | "Auto-loaded file drift check" | FR-129]
  // [Scenario: Pairing matches | "Verdict pairing drift check" | FR-126]
  fixture();
  const r = run();
  assertInSync(r);
  assert.strictEqual(block(r, LABEL_GLOBS).status, "ok");
  assert.strictEqual(block(r, LABEL_FILES).status, "ok");
  assert.strictEqual(block(r, LABEL_AUTO).status, "ok");
  assert.strictEqual(block(r, LABEL_TP_RULE).status, "ok");
  assert.strictEqual(block(r, LABEL_TP_PLANNER).status, "ok");
  assert.strictEqual(block(r, LABEL_VERDICT).status, "ok");
});

test("baseline: result labels carry the entry counts and the step count", () => {
  // [Scenario: Paths match / Names match / Pairing matches | result labels in "Protected path drift check", "Auto-loaded file drift check", "Verdict pairing drift check" | FR-126 | FR-128 | FR-129]
  fixture();
  const r = run();
  assert.ok(r.stdout.indexOf("ok    " + LABEL_GLOBS + ": 1 entries") !== -1, r.stdout);
  assert.ok(r.stdout.indexOf("ok    " + LABEL_FILES + ": 1 entries") !== -1, r.stdout);
  assert.ok(r.stdout.indexOf("ok    " + LABEL_AUTO + ": 3 entries") !== -1, r.stdout);
  assert.ok(r.stdout.indexOf("ok    " + LABEL_VERDICT + ": 2 steps") !== -1, r.stdout);
});

test("run order: verdict pairing, then the three protection lists, then the two task-plan comparisons", () => {
  // [Scenario: Values equal the code | spec-hooks-fsa-table-check.md "Algorithmic steps" step 3 | FR-126 | FR-128 | FR-129 | FR-127]
  fixture();
  const r = run();
  const labels = r.blocks.map((b) => b.label);
  const idx = (part) => labels.findIndex((l) => l.indexOf(part) !== -1);
  const order = [
    idx(LABEL_VERDICT),
    idx(LABEL_GLOBS),
    idx(LABEL_FILES),
    idx(LABEL_AUTO),
    idx(LABEL_TP_RULE),
    idx(LABEL_TP_PLANNER),
  ];
  order.forEach((i) => assert.ok(i >= 0, "missing comparison\n" + r.stdout));
  for (let i = 1; i < order.length; i++) {
    assert.ok(order[i - 1] < order[i], "comparison out of order: " + labels.join(" | "));
  }
});

// ---------------------------------------------------------------------------
// Output and exit codes with the new tables
// ---------------------------------------------------------------------------

test("drift without --check prints DRIFT and exits 0", () => {
  // [Scenario: No flag | spec-hooks-fsa-table-check.md "Output and exit codes" | FR-122 | FR-127 | NFR-021]
  fixture({ codePaths: { TASK_PLAN_GLOB: "plan-*.md" } });
  const r = run([]);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.strictEqual(block(r, LABEL_TP_RULE).status, "DRIFT");
});

// ---------------------------------------------------------------------------
// Verdict pairing (FR-126)
// ---------------------------------------------------------------------------

test("pairing drifts: Verify also accepts 'accepted' in the code, exit 1 with the source-of-truth line", () => {
  // [Scenario: Pairing drifts | spec-hooks-fsa-table-check.md "Verdict pairing drift check" | FR-126 | UR-051 | NFR-021]
  fixture({
    verdicts: {
      Decide: "^(accepted|needs-changes)$",
      Verify: "^(accepted|clear|needs-clarification)$",
    },
  });
  const r = run();
  assertDriftExit(r);
  const b = block(r, LABEL_VERDICT);
  assert.strictEqual(b.status, "DRIFT");
  assert.ok(b.lines.indexOf("verdict after Verify: accepted is in lib/fsa-tables.js only") !== -1, r.stdout);
});

test("pairing drifts: a markdown verdict missing in the code is reported as markdown only", () => {
  // [Scenario: Pairing drifts (reverse direction) | "Verdict pairing drift check", problem texts | FR-126 | NFR-021]
  fixture({
    verdicts: {
      Decide: "^(accepted)$",
      Verify: "^(clear|needs-clarification)$",
    },
  });
  const r = run();
  assertDriftExit(r);
  assert.ok(r.stdout.indexOf("verdict after Decide: needs-changes is in the markdown only") !== -1, r.stdout);
});

test("pairing drifts: a verdict step missing in the code is reported as markdown only", () => {
  // [Scenario: Pairing drifts (state sets) | "Verdict pairing drift check", comparison | FR-126 | NFR-021]
  fixture({ verdicts: { Decide: "^(accepted|needs-changes)$" } });
  const r = run();
  assertDriftExit(r);
  assert.ok(r.stdout.indexOf("verdict step Verify is in the markdown only") !== -1, r.stdout);
});

test("pairing drifts: a verdict step only in the code is reported as code only", () => {
  // [Scenario: Pairing drifts (state sets) | "Verdict pairing drift check", comparison | FR-126 | NFR-021]
  fixture({
    verdicts: {
      Decide: "^(accepted|needs-changes)$",
      Verify: "^(clear|needs-clarification)$",
      Review: "^(approved|returned)$",
    },
  });
  const r = run();
  assertDriftExit(r);
  assert.ok(r.stdout.indexOf("verdict step Review is in lib/fsa-tables.js only") !== -1, r.stdout);
});

test("pattern not a plain list: Decide with a wildcard alternative is reported", () => {
  // [Scenario: Pattern not a plain list | spec-hooks-fsa-table-check.md "Verdict pairing drift check" | FR-126 | NFR-021]
  fixture({
    verdicts: {
      Decide: "^(accepted|needs-.*)$",
      Verify: "^(clear|needs-clarification)$",
    },
  });
  const r = run();
  assertDriftExit(r);
  assert.ok(r.stdout.indexOf("verdictByStep.Decide is not a plain list of verdicts") !== -1, r.stdout);
});

// ---------------------------------------------------------------------------
// Task-plan glob (FR-127)
// ---------------------------------------------------------------------------

test("glob drifts: code 'plan-*.md' gives two DRIFT lines naming TASK_PLAN_GLOB, each with the decision line", () => {
  // [Scenario: Glob drifts | spec-hooks-fsa-table-check.md "Task-plan glob drift check" | FR-127 | FR-186 | NFR-021]
  fixture({ codePaths: { TASK_PLAN_GLOB: "plan-*.md" } });
  const r = run();
  assertDriftExit(r);
  const drifts = r.blocks.filter((b) => b.status === "DRIFT" && b.label.indexOf("TASK_PLAN_GLOB") !== -1);
  assert.strictEqual(drifts.length, 2, r.stdout);
  drifts.forEach((b) => {
    assert.ok(b.lines.indexOf(DECISION) !== -1, "decision line missing under " + b.label + "\n" + r.stdout);
  });
  assert.strictEqual(count(r.stdout, DECISION), 2, r.stdout);
});

test("one table drifts: only the rule-file table is named and carries the decision line", () => {
  // [Scenario: One table drifts | spec-hooks-fsa-table-check.md "Task-plan glob drift check" | FR-127 | NFR-021]
  fixture({ taskPlanRule: [code(OLD_GLOB)] });
  const r = run();
  assertDriftExit(r);
  const rule = block(r, LABEL_TP_RULE);
  assert.strictEqual(rule.status, "DRIFT");
  assert.ok(rule.lines.indexOf(DECISION) !== -1, r.stdout);
  assert.ok(rule.lines.indexOf("TASK_PLAN_GLOB: " + OLD_GLOB + " is in the markdown only") !== -1, r.stdout);
  assert.ok(rule.lines.indexOf("TASK_PLAN_GLOB: " + NEW_GLOB + " is in lib/fsa-paths.js only") !== -1, r.stdout);
  assert.strictEqual(block(r, LABEL_TP_PLANNER).status, "ok");
  assert.ok(r.stdout.indexOf("ok    " + LABEL_TP_PLANNER) !== -1, r.stdout);
});

test("one table drifts: the task-planner table alone differs and is the only one named", () => {
  // [Scenario: One table drifts (other side) | "Task-plan glob drift check" | FR-127 | NFR-021]
  fixture({ taskPlanner: [code(OLD_GLOB)] });
  const r = run();
  assertDriftExit(r);
  assert.strictEqual(block(r, LABEL_TP_PLANNER).status, "DRIFT");
  assert.strictEqual(block(r, LABEL_TP_RULE).status, "ok");
});

test("wider glob '**/*.md' in both tables: both values reported for each table, decision line after each, fsa-paths.js unchanged", () => {
  // [Scenario: Wider glob in the markdown | spec-hooks-fsa-table-check.md "Task-plan glob drift check" | FR-127 | NFR-021]
  fixture({ taskPlanRule: [code("**/*.md")], taskPlanner: [code("**/*.md")] });
  const pathsFile = path.join(copy, PATHS_FILE);
  const beforeText = fs.readFileSync(pathsFile, "utf8");
  const r = run();
  assertDriftExit(r);
  [LABEL_TP_RULE, LABEL_TP_PLANNER].forEach((label) => {
    const b = block(r, label);
    assert.strictEqual(b.status, "DRIFT", label);
    assert.ok(b.lines.indexOf("TASK_PLAN_GLOB: **/*.md is in the markdown only") !== -1, r.stdout);
    assert.ok(b.lines.indexOf("TASK_PLAN_GLOB: " + NEW_GLOB + " is in lib/fsa-paths.js only") !== -1, r.stdout);
    assert.ok(b.lines.indexOf(DECISION) !== -1, "decision line missing under " + label);
  });
  assert.strictEqual(fs.readFileSync(pathsFile, "utf8"), beforeText, "the script must only report");
});

test("two rows in the task-planner table: row count reported, exit 1", () => {
  // [Scenario: Two rows | spec-hooks-fsa-table-check.md "Task-plan glob drift check" | FR-127 | NFR-021]
  fixture({ taskPlanner: [code(NEW_GLOB), code("docs/task-plans/other-*.md")] });
  const r = run();
  assertDriftExit(r);
  assert.ok(r.stdout.indexOf("agents/task-planner.md, ## Write scope: 2 rows; expected 1") !== -1, r.stdout);
});

test("tables added before the code moves: two DRIFT lines with the decision line, then ok after TASK_PLAN_GLOB follows", () => {
  // [Scenario: Tables added before the code moves | spec-hooks-fsa-table-check.md "Write guard lists in the markdown" | FR-180 | FR-186 | NFR-021]
  // [Scenario: Recorded move to docs/task-plans | "Task-plan glob drift check" | FR-127 | FR-186 | NFR-021]
  fixture({ codePaths: { TASK_PLAN_GLOB: OLD_GLOB } });
  const first = run();
  assertDriftExit(first);
  [LABEL_TP_RULE, LABEL_TP_PLANNER].forEach((label) => {
    const b = block(first, label);
    assert.strictEqual(b.status, "DRIFT", label);
    assert.ok(b.lines.indexOf("TASK_PLAN_GLOB: " + NEW_GLOB + " is in the markdown only") !== -1, first.stdout);
    assert.ok(b.lines.indexOf("TASK_PLAN_GLOB: " + OLD_GLOB + " is in lib/fsa-paths.js only") !== -1, first.stdout);
    assert.ok(b.lines.indexOf(DECISION) !== -1, "decision line missing under " + label);
  });

  // The maintainer sets TASK_PLAN_GLOB to the recorded value and runs --check again.
  fixture({ codePaths: { TASK_PLAN_GLOB: NEW_GLOB } });
  const second = run();
  assertInSync(second);
  assert.strictEqual(block(second, LABEL_TP_RULE).status, "ok");
  assert.strictEqual(block(second, LABEL_TP_PLANNER).status, "ok");
});

test("task-planner agent file without a table under '## Write scope' is drift, not an operational error", () => {
  // [Scenario: Section missing (task-planner side) | spec-hooks-fsa-table-check.md "Write guard list parsing" | FR-180 | FR-127 | NFR-021]
  fixture({ taskPlanner: null });
  const r = run();
  assertDriftExit(r);
  assert.ok(r.stdout.indexOf("agents/task-planner.md: no table under ## Write scope") !== -1, r.stdout);
});

// ---------------------------------------------------------------------------
// Protected globs and files (FR-128)
// ---------------------------------------------------------------------------

test("extra protected file in the code: named, decision line follows, exit 1", () => {
  // [Scenario: Extra protected file | spec-hooks-fsa-table-check.md "Protected path drift check" | FR-128 | UR-051 | NFR-021]
  fixture({ codePaths: { PROTECTED_FILES: ["DECISIONS.md", "ROADMAP.md"] } });
  const r = run();
  assertDriftExit(r);
  const b = block(r, LABEL_FILES);
  assert.strictEqual(b.status, "DRIFT");
  assert.ok(b.lines.indexOf("PROTECTED_FILES: ROADMAP.md is in lib/fsa-paths.js only") !== -1, r.stdout);
  assert.ok(b.lines.indexOf(DECISION) !== -1, r.stdout);
});

test("the decision line adds no problem to the difference count", () => {
  // [Scenario: Extra protected file (count) | "Protected path drift check", decision guard | FR-128 | NFR-021]
  fixture({ codePaths: { PROTECTED_FILES: ["DECISIONS.md", "ROADMAP.md"] } });
  const r = run();
  assert.strictEqual(r.status, 1);
  assert.match(lastLine(r.stdout), /^1 difference\(s\) between lib and the markdown\./);
});

test("different glob form in the markdown: both strings reported, decision line printed", () => {
  // [Scenario: Different glob form | spec-hooks-fsa-table-check.md "Protected path drift check" | FR-128 | UR-051 | NFR-021]
  fixture({ protectedGlobs: [code(".agent/main-plan/**")] });
  const r = run();
  assertDriftExit(r);
  const b = block(r, LABEL_GLOBS);
  assert.strictEqual(b.status, "DRIFT");
  assert.ok(b.lines.indexOf("PROTECTED_GLOBS: .agent/main-plan/** is in the markdown only") !== -1, r.stdout);
  assert.ok(b.lines.indexOf("PROTECTED_GLOBS: **/.agent/main-plan/** is in lib/fsa-paths.js only") !== -1, r.stdout);
  assert.ok(b.lines.indexOf(DECISION) !== -1, r.stdout);
});

test("new protected file in the markdown only: reported as markdown only, no decision line, exit 1", () => {
  // [Scenario: New protected file in the markdown | spec-hooks-fsa-table-check.md "Protected path drift check" | FR-128 | UR-051 | NFR-021]
  fixture({ protectedFiles: [code("DECISIONS.md"), code("ROADMAP.md")] });
  const r = run();
  assertDriftExit(r);
  const b = block(r, LABEL_FILES);
  assert.strictEqual(b.status, "DRIFT");
  assert.ok(b.lines.indexOf("PROTECTED_FILES: ROADMAP.md is in the markdown only") !== -1, r.stdout);
  assert.ok(b.lines.indexOf(DECISION) === -1, "decision line must not print\n" + r.stdout);
  assert.ok(r.stdout.indexOf(DECISION) === -1, "decision line must not print\n" + r.stdout);
});

// ---------------------------------------------------------------------------
// Auto-loaded names (FR-129)
// ---------------------------------------------------------------------------

test("name missing in the code: AUTO_LOADED without CLAUDE.local.md is markdown only, no decision line", () => {
  // [Scenario: Name missing in code | spec-hooks-fsa-table-check.md "Auto-loaded file drift check" | FR-129 | UR-051 | NFR-021]
  fixture({ codePaths: { AUTO_LOADED: ["CLAUDE.md", "AGENTS.md"] } });
  const r = run();
  assertDriftExit(r);
  const b = block(r, LABEL_AUTO);
  assert.strictEqual(b.status, "DRIFT");
  assert.ok(b.lines.indexOf("AUTO_LOADED: CLAUDE.local.md is in the markdown only") !== -1, r.stdout);
  assert.ok(b.lines.indexOf(DECISION) === -1, r.stdout);
});

test("name dropped from the markdown: AGENTS.md reported as code only with the decision line, exit 1", () => {
  // [Scenario: Name dropped from the markdown | spec-hooks-fsa-table-check.md "Auto-loaded file drift check" | FR-129 | UR-051 | NFR-021]
  fixture({ autoLoaded: [code("CLAUDE.md"), code("CLAUDE.local.md")] });
  const r = run();
  assertDriftExit(r);
  const b = block(r, LABEL_AUTO);
  assert.strictEqual(b.status, "DRIFT");
  assert.ok(b.lines.indexOf("AUTO_LOADED: AGENTS.md is in lib/fsa-paths.js only") !== -1, r.stdout);
  assert.ok(b.lines.indexOf(DECISION) !== -1, r.stdout);
});

test("auto-loaded comparison is case-sensitive", () => {
  // [Scenario: Names match (exact, case-sensitive) | spec-hooks-fsa-table-check.md "Auto-loaded file drift check" | FR-129 | NFR-021]
  fixture({ autoLoaded: [code("CLAUDE.md"), code("claude.local.md"), code("AGENTS.md")] });
  const r = run();
  assertDriftExit(r);
  const b = block(r, LABEL_AUTO);
  assert.ok(b.lines.indexOf("AUTO_LOADED: claude.local.md is in the markdown only") !== -1, r.stdout);
  assert.ok(b.lines.indexOf("AUTO_LOADED: CLAUDE.local.md is in lib/fsa-paths.js only") !== -1, r.stdout);
});

// ---------------------------------------------------------------------------
// Write guard list parsing (FR-180)
// ---------------------------------------------------------------------------

test("not in exact code form: a first cell without backticks is reported with file, heading, and row", () => {
  // [Scenario: Not in exact code form | spec-hooks-fsa-table-check.md "Write guard list parsing" | FR-180 | UR-051]
  fixture({ protectedFiles: ["DECISIONS.md"] });
  const r = run();
  assertDriftExit(r);
  assert.ok(
    r.stdout.indexOf(
      "rules/assist-plugin-rule.md, ### Protected files, row 1: first cell DECISIONS.md is not one code span"
    ) !== -1,
    r.stdout
  );
});

test("code span with extra text: '`CLAUDE.md` (root)' is reported with its row number", () => {
  // [Scenario: Code span with extra text | spec-hooks-fsa-table-check.md "Write guard list parsing" | FR-180 | UR-051]
  fixture({ autoLoaded: [code("CLAUDE.md") + " (root)", code("CLAUDE.local.md"), code("AGENTS.md")] });
  const r = run();
  assertDriftExit(r);
  assert.ok(
    r.stdout.indexOf(
      "rules/assist-plugin-rule.md, ### Auto-loaded names, row 1: first cell " +
        code("CLAUDE.md") +
        " (root) is not one code span"
    ) !== -1,
    r.stdout
  );
});

test("a bad cell in a later row is reported with that row's number", () => {
  // [Scenario: Not in exact code form (row number) | "Write guard list parsing" | FR-180]
  fixture({ autoLoaded: [code("CLAUDE.md"), code("CLAUDE.local.md"), "AGENTS.md"] });
  const r = run();
  assertDriftExit(r);
  assert.ok(
    r.stdout.indexOf(
      "rules/assist-plugin-rule.md, ### Auto-loaded names, row 3: first cell AGENTS.md is not one code span"
    ) !== -1,
    r.stdout
  );
});

test("a first cell longer than 80 characters is cut to 80 in the report", () => {
  // [Scenario: Not in exact code form (cell cut to 80 characters) | "Write guard list parsing" | FR-180]
  const longCell = "x".repeat(100);
  fixture({ protectedFiles: [code("DECISIONS.md"), longCell] });
  const r = run();
  assertDriftExit(r);
  assert.ok(r.stdout.indexOf("row 2: first cell " + "x".repeat(80) + " is not one code span") !== -1, r.stdout);
  assert.ok(r.stdout.indexOf("x".repeat(81)) === -1, "cell must be cut to 80 characters\n" + r.stdout);
});

test("a value listed twice in one table is drift", () => {
  // [Scenario: Not in exact code form (duplicate value) | "Write guard list parsing" | FR-180]
  fixture({ protectedFiles: [code("DECISIONS.md"), code("DECISIONS.md")] });
  const r = run();
  assertDriftExit(r);
  assert.ok(
    r.stdout.indexOf("rules/assist-plugin-rule.md, ### Protected files: DECISIONS.md is listed twice") !== -1,
    r.stdout
  );
});

test("section missing: four 'no table under' lines, drift (exit 1), not an operational error", () => {
  // [Scenario: Section missing | spec-hooks-fsa-table-check.md "Write guard list parsing" | FR-180 | UR-051]
  fixture({ rule: false });
  const r = run();
  assertDriftExit(r);
  ["### Protected globs", "### Protected files", "### Auto-loaded names", "### Task-plan glob"].forEach((h) => {
    assert.ok(r.stdout.indexOf("rules/assist-plugin-rule.md: no table under " + h) !== -1, h + "\n" + r.stdout);
  });
});

test("one subsection missing: only that heading is reported", () => {
  // [Scenario: Section missing (one subsection) | "Write guard list parsing" | FR-180]
  fixture({ protectedFiles: null });
  const r = run();
  assertDriftExit(r);
  assert.ok(r.stdout.indexOf("rules/assist-plugin-rule.md: no table under ### Protected files") !== -1, r.stdout);
  assert.ok(r.stdout.indexOf("no table under ### Protected globs") === -1, r.stdout);
  assert.ok(r.stdout.indexOf("no table under ### Auto-loaded names") === -1, r.stdout);
  assert.ok(r.stdout.indexOf("no table under ### Task-plan glob") === -1, r.stdout);
});

test("rule file unreadable: stderr message 'check-fsa-tables:' and exit 2", () => {
  // [Scenario: Rule file unreadable | spec-hooks-fsa-table-check.md "Write guard list parsing" | FR-180 | FR-122]
  fixture();
  const rulePath = path.join(copy, RULE_FILE);
  fs.rmSync(rulePath, { force: true });
  fs.mkdirSync(rulePath); // reading a directory fails for every user, root included
  const r = run();
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.ok(r.stderr.indexOf("check-fsa-tables:") !== -1, r.stderr);
});
