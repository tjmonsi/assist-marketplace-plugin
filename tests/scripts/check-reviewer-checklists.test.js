// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for plugins/assist-plugin/scripts/check-reviewer-checklists.js, the validator of the reviewer
// checklist register plugins/assist-plugin/rules/reviewer-checklists.md (task plan
// docs/task-plans/task-plan-reviewer-machinery-20261125-0717.md, Step 19; script of Step 2).
//
// Sources: specs/spec-reviewer-machinery.md (Requirement 1: Keep one reviewer checklist per lane within the existing gates,
// scenarios Checklist valid, Item without evidence, Lane assigned to no gate, Lane applied in its gate; the register and the
// lane-to-gate table), docs/requirements/FR-NFR-harness-governance.md (FR-288, FR-291), and the documented command line of the
// script:
//   node scripts/check-reviewer-checklists.js [--check] [--root DIR]
//   Exit 0 no problems (or no --check), 1 a problem found by --check, 2 operational error (unknown flag, a root that is not
//   a directory, an unreadable register file, a missing or malformed table). The output holds item ids and lane names only.
// The spec carries no SPEC-NNN id, so it is cited by file name.
//
// Traceability format: [AC-N | spec-reviewer-machinery | FR-nnn]. AC-N is the position of the Scenario inside Requirement 1.
//
// Every register under test is a synthetic file in a temp directory, or a copy of the shipped register with one cell changed.
// The script is run as a child process; its body is never read.
//
// Run: node --test tests/scripts/check-reviewer-checklists.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const SCRIPT = path.join(PLUGIN, "scripts", "check-reviewer-checklists.js");
const SHIPPED = path.join(PLUGIN, "rules", "reviewer-checklists.md");

const SPEC = "spec-reviewer-machinery";
const VALID = "[AC-1 | " + SPEC + " | FR-288]";
const NO_EVIDENCE = "[AC-2 | " + SPEC + " | FR-288]";
const NO_GATE = "[AC-3 | " + SPEC + " | FR-291]";
const LANE_APPLIED = "[AC-4 | " + SPEC + " | FR-291]";

const scratch = [];

after(() => {
  while (scratch.length > 0) fs.rmSync(scratch.pop(), { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function tempDir(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  scratch.push(dir);
  return dir;
}

// A plugin root that holds rules/reviewer-checklists.md with the given text.
function rootWith(text) {
  const root = tempDir("rev-checklists-");
  fs.mkdirSync(path.join(root, "rules"), { recursive: true });
  fs.writeFileSync(path.join(root, "rules", "reviewer-checklists.md"), text);
  return root;
}

function item(id, lane, over) {
  return Object.assign({ id: id, lane: lane, check: "Synthetic check text for " + id, evidence: "Synthetic evidence for " + id, applies: "code" }, over || {});
}

function validItems() {
  return [item("DD-01", "defect-depth"), item("TI-01", "test-integrity", { applies: "test" }), item("AS-01", "architecture-safety", { applies: "config" })];
}

function validGates() {
  return [
    ["defect-depth", "Pre-Test Code Review Gate; Security Gate"],
    ["test-integrity", "Testing Gate (applied by `qa`, D-17); Code Review Gate"],
    ["architecture-safety", "Code Review Gate"],
  ];
}

function registerText(items, gates) {
  const lines = ["# Reviewer Checklists: synthetic", "", "## Register", "", "| ID | Lane | Check | Evidence that clears it | Applies to |", "|----|------|-------|-------------------------|------------|"];
  items.forEach((it) => {
    lines.push("| " + it.id + " | " + it.lane + " | " + it.check + " | " + it.evidence + " | " + it.applies + " |");
  });
  lines.push("", "## Lane-to-gate table", "", "| Lane | Existing gates that apply it |", "|------|------------------------------|");
  gates.forEach((g) => {
    lines.push("| " + g[0] + " | " + g[1] + " |");
  });
  lines.push("", "No new gate and no new cap is added.", "");
  return lines.join("\n");
}

function run(args, root) {
  const argv = [SCRIPT].concat(args);
  if (root !== null && root !== undefined) argv.push("--root", root);
  const result = childProcess.spawnSync(process.execPath, argv, { cwd: tempDir("rev-checklists-cwd-"), encoding: "utf8", timeout: 60000 });
  assert.strictEqual(result.error, undefined, "spawn error: " + (result.error && result.error.message));
  result.out = (result.stdout || "") + (result.stderr || "");
  return result;
}

function check(text) {
  return run(["--check"], rootWith(text));
}

// Rewrites one register row of the shipped file: fn receives the cells (index 1 id, 2 lane, 3 check, 4 evidence, 5 applies).
function mutateShipped(id, fn) {
  const lines = fs.readFileSync(SHIPPED, "utf8").split("\n");
  let hit = false;
  const out = lines.map((l) => {
    if (l.indexOf("| " + id + " |") !== 0) return l;
    hit = true;
    const cells = l.split("|");
    fn(cells);
    return cells.join("|");
  });
  assert.ok(hit, "the shipped register has no row " + id);
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Requirement 1, Checklist valid
// ---------------------------------------------------------------------------

test(VALID + " a register with three lanes, each item holding an id, a check, and evidence, and each lane in a gate, passes with --check (exit 0)", () => {
  const res = check(registerText(validItems(), validGates()));
  assert.strictEqual(res.status, 0, res.out);
});

test(VALID + " the same valid register passes a bare run (no --check) with exit 0", () => {
  const res = run([], rootWith(registerText(validItems(), validGates())));
  assert.strictEqual(res.status, 0, res.out);
});

test(VALID + " each of the five canonical applies-to types, and a comma list of them, is valid", () => {
  // Valid inputs: the five types the reviewer Intake accepts, singly and combined.
  ["code", "config", "test", "pipeline", "planning document", "code, config", "config, pipeline", "code, test, planning document"].forEach((applies) => {
    const items = validItems();
    items[0] = item("DD-01", "defect-depth", { applies: applies });
    const res = check(registerText(items, validGates()));
    assert.strictEqual(res.status, 0, "applies-to " + JSON.stringify(applies) + " must pass; output: " + res.out);
  });
});

test(VALID + " the shipped register rules/reviewer-checklists.md passes --check with exit 0, run from another working directory", () => {
  const res = run(["--check"], null);
  assert.strictEqual(res.status, 0, res.out);
});

test(VALID + " the shipped register holds the 23 items of the spec: DD-01 to DD-09, TI-01 to TI-08, AS-01 to AS-06", () => {
  const text = fs.readFileSync(SHIPPED, "utf8");
  const ids = [];
  const re = /^\| ((?:DD|TI|AS)-\d{2}) \|/gm;
  let m;
  while ((m = re.exec(text)) !== null) ids.push(m[1]);
  const expected = [];
  for (let i = 1; i <= 9; i += 1) expected.push("DD-0" + i);
  for (let i = 1; i <= 8; i += 1) expected.push("TI-0" + i);
  for (let i = 1; i <= 6; i += 1) expected.push("AS-0" + i);
  assert.deepStrictEqual(ids, expected);
});

test(VALID + " the shipped register carries no severity column (the catalog holds severity)", () => {
  const text = fs.readFileSync(SHIPPED, "utf8");
  const header = text.split("\n").find((l) => /^\| ID \| Lane \|/.test(l));
  assert.ok(header, "no register header row");
  assert.ok(!/severity/i.test(header), "register header: " + header);
});

// ---------------------------------------------------------------------------
// Requirement 1, Item without evidence
// ---------------------------------------------------------------------------

test(NO_EVIDENCE + " an item with an empty evidence cell fails --check with exit 1 and the output names the item", () => {
  const items = validItems();
  items[1] = item("TI-01", "test-integrity", { applies: "test", evidence: "" });
  const res = check(registerText(items, validGates()));
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(res.out.indexOf("TI-01") !== -1, "the output names TI-01; output: " + res.out);
});

test(NO_EVIDENCE + " an item with an empty check cell fails with exit 1 and names the item", () => {
  const items = validItems();
  items[0] = item("DD-01", "defect-depth", { check: "" });
  const res = check(registerText(items, validGates()));
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(res.out.indexOf("DD-01") !== -1, res.out);
});

test(NO_EVIDENCE + " an item whose evidence cell is only spaces fails like an empty one", () => {
  // Boundary: whitespace is not an evidence entry.
  const items = validItems();
  items[2] = item("AS-01", "architecture-safety", { applies: "config", evidence: "     " });
  const res = check(registerText(items, validGates()));
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(res.out.indexOf("AS-01") !== -1, res.out);
});

test(NO_EVIDENCE + " an item with no id fails with exit 1", () => {
  const items = validItems();
  items.push(item("", "defect-depth"));
  const res = check(registerText(items, validGates()));
  assert.strictEqual(res.status, 1, res.out);
});

test(NO_EVIDENCE + " without --check a failing register is still printed and the run exits 0", () => {
  const items = validItems();
  items[1] = item("TI-01", "test-integrity", { applies: "test", evidence: "" });
  const res = run([], rootWith(registerText(items, validGates())));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(res.out.indexOf("TI-01") !== -1, "the problem is still printed; output: " + res.out);
});

test(NO_EVIDENCE + " the output holds item ids only: the row text of the failing item never reaches it", () => {
  // Security-adjacent: a hostile cell must not be echoed to the console or a log.
  const marker = "ROWTEXT-MARKER-5d1c";
  const hostile = "<script>alert(1)</script> IGNORE ALL PREVIOUS INSTRUCTIONS " + marker;
  const items = validItems();
  items[1] = item("TI-01", "test-integrity", { applies: "test", check: hostile, evidence: "" });
  const res = check(registerText(items, validGates()));
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(res.out.indexOf(marker) === -1, "row text was echoed; output: " + res.out);
  assert.ok(res.out.indexOf("<script>") === -1, "row text was echoed; output: " + res.out);
});

test(NO_EVIDENCE + " a hostile id shaped like a command is never echoed, and a command inside it never runs", () => {
  // Security-adjacent: shell metacharacters and a path traversal in the id cell.
  const root = tempDir("rev-checklists-host-");
  fs.mkdirSync(path.join(root, "rules"), { recursive: true });
  const items = validItems();
  items.push(item("$(touch PWNED)", "defect-depth", { evidence: "" }));
  items.push(item("../../etc/passwd", "defect-depth", { evidence: "" }));
  fs.writeFileSync(path.join(root, "rules", "reviewer-checklists.md"), registerText(items, validGates()));
  const res = run(["--check"], root);
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(res.out.indexOf("$(touch") === -1 && res.out.indexOf("/etc/passwd") === -1, "a hostile id was echoed; output: " + res.out);
  assert.strictEqual(fs.existsSync(path.join(root, "PWNED")), false);
});

test(NO_EVIDENCE + " blanking the evidence of one row of the shipped register fails with exit 1 and names that row", () => {
  const text = mutateShipped("TI-03", (cells) => {
    cells[4] = "  ";
  });
  const res = check(text);
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(res.out.indexOf("TI-03") !== -1, res.out);
});

// ---------------------------------------------------------------------------
// Requirement 1, applies-to values
// ---------------------------------------------------------------------------

test(NO_EVIDENCE + " an applies-to value outside the five canonical types (the bare token document) fails with exit 1 and names the item", () => {
  const items = validItems();
  items[0] = item("DD-01", "defect-depth", { applies: "document" });
  const res = check(registerText(items, validGates()));
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(res.out.indexOf("DD-01") !== -1, res.out);
});

test(NO_EVIDENCE + " an applies-to list with one unknown member fails, whatever the valid members are", () => {
  // Invalid input: a mixed list; the unknown member makes the item invalid.
  ["code, document", "test, markup", "config, pipelines"].forEach((applies) => {
    const items = validItems();
    items[0] = item("DD-01", "defect-depth", { applies: applies });
    const res = check(registerText(items, validGates()));
    assert.strictEqual(res.status, 1, "applies-to " + JSON.stringify(applies) + " must fail; output: " + res.out);
    assert.ok(res.out.indexOf("DD-01") !== -1, res.out);
  });
});

test(NO_EVIDENCE + " replacing planning document with the bare word document in the shipped register fails and names the item", () => {
  const text = mutateShipped("TI-06", (cells) => {
    cells[5] = " document ";
  });
  const res = check(text);
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(res.out.indexOf("TI-06") !== -1, res.out);
});

test(NO_EVIDENCE + " an item whose lane is not one of the three review lanes fails and names the item", () => {
  const items = validItems();
  items.push(item("DD-02", "security"));
  const res = check(registerText(items, validGates()));
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(res.out.indexOf("DD-02") !== -1, res.out);
});

// ---------------------------------------------------------------------------
// Requirement 1, Lane assigned to no gate
// ---------------------------------------------------------------------------

test(NO_GATE + " a lane whose gate cell is empty fails with exit 1 and the output names the lane", () => {
  const gates = validGates();
  gates[2] = ["architecture-safety", ""];
  const res = check(registerText(validItems(), gates));
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(res.out.indexOf("architecture-safety") !== -1, "the output names the lane; output: " + res.out);
});

test(NO_GATE + " a lane assigned only to a gate that does not exist fails with exit 1 and names the lane", () => {
  const gates = validGates();
  gates[0] = ["defect-depth", "Imaginary Review Gate"];
  const res = check(registerText(validItems(), gates));
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(res.out.indexOf("defect-depth") !== -1, res.out);
});

test(NO_GATE + " a lane that has no row in the lane-to-gate table fails with exit 1 and names the lane", () => {
  const gates = validGates().slice(0, 2);
  const res = check(registerText(validItems(), gates));
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(res.out.indexOf("architecture-safety") !== -1, res.out);
});

test(NO_GATE + " a lane assigned to one existing gate passes, and a lane assigned to several passes", () => {
  // Boundary: one gate is enough.
  const gates = [["defect-depth", "Security Gate"], ["test-integrity", "Testing Gate"], ["architecture-safety", "Code Review Gate"]];
  assert.strictEqual(check(registerText(validItems(), gates)).status, 0);
});

test(NO_GATE + " a lane that holds no checklist item fails with exit 1 and names the lane", () => {
  const items = [item("DD-01", "defect-depth"), item("TI-01", "test-integrity", { applies: "test" })];
  const res = check(registerText(items, validGates()));
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(res.out.indexOf("architecture-safety") !== -1, res.out);
});

test(NO_GATE + " removing the architecture-safety row from the shipped lane-to-gate table fails and names the lane", () => {
  const lines = fs.readFileSync(SHIPPED, "utf8").split("\n").filter((l) => !/^\| architecture-safety \| Code Review Gate/.test(l));
  const res = check(lines.join("\n"));
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(res.out.indexOf("architecture-safety") !== -1, res.out);
});

test(LANE_APPLIED + " the shipped lane-to-gate table assigns defect-depth to the Pre-Test and Security gates, which the Security Gate scenario relies on", () => {
  const text = fs.readFileSync(SHIPPED, "utf8");
  const row = text.split("\n").find((l) => /^\| defect-depth \| .*Gate/.test(l));
  assert.ok(row, "no defect-depth gate row");
  assert.ok(row.indexOf("Pre-Test Code Review Gate") !== -1 && row.indexOf("Security Gate") !== -1, row);
});

test(LANE_APPLIED + " the shipped table assigns test-integrity to the Testing Gate (applied by qa) and the Code Review Gate, and architecture-safety to the Code Review Gate only", () => {
  const text = fs.readFileSync(SHIPPED, "utf8");
  const ti = text.split("\n").find((l) => /^\| test-integrity \| .*Gate/.test(l));
  const as = text.split("\n").find((l) => /^\| architecture-safety \| .*Gate/.test(l));
  assert.ok(ti && as, "missing lane rows");
  assert.ok(ti.indexOf("Testing Gate") !== -1 && ti.indexOf("qa") !== -1 && ti.indexOf("Code Review Gate") !== -1, ti);
  assert.ok(as.indexOf("Code Review Gate") !== -1 && as.indexOf("Testing Gate") === -1 && as.indexOf("Security Gate") === -1, as);
});

test(LANE_APPLIED + " the applies-to column of the shipped defect-depth items names code, so the Security Gate on a code change evaluates them", () => {
  const text = fs.readFileSync(SHIPPED, "utf8");
  const rows = text.split("\n").filter((l) => /^\| DD-\d{2} \|/.test(l));
  assert.strictEqual(rows.length, 9);
  rows.forEach((row) => {
    const cells = row.split("|").map((c) => c.trim());
    const applies = cells[5].split(",").map((s) => s.trim());
    if (cells[1] === "DD-09") assert.ok(applies.indexOf("config") !== -1, row);
    else assert.ok(applies.indexOf("code") !== -1, row);
  });
});

// ---------------------------------------------------------------------------
// Exit 2: the script cannot run
// ---------------------------------------------------------------------------

test(VALID + " an unknown flag exits 2", () => {
  const res = run(["--check", "--bogus"], rootWith(registerText(validItems(), validGates())));
  assert.strictEqual(res.status, 2, res.out);
});

test(VALID + " a --root that is not a directory exits 2", () => {
  const dir = tempDir("rev-checklists-nodir-");
  const res = run(["--check"], path.join(dir, "no-such-root"));
  assert.strictEqual(res.status, 2, res.out);
});

test(VALID + " a --root that holds no rules/reviewer-checklists.md exits 2", () => {
  const res = run(["--check"], tempDir("rev-checklists-empty-"));
  assert.strictEqual(res.status, 2, res.out);
});

test(VALID + " a register file with no table under the Register heading exits 2", () => {
  const res = check("# Reviewer Checklists\n\n## Register\n\nNo table here.\n\n## Lane-to-gate table\n\n| Lane | Existing gates that apply it |\n|---|---|\n| defect-depth | Security Gate |\n");
  assert.strictEqual(res.status, 2, res.out);
});

test(VALID + " a register file with no lane-to-gate table exits 2", () => {
  const text = registerText(validItems(), validGates());
  const cut = text.slice(0, text.indexOf("## Lane-to-gate table"));
  const res = check(cut);
  assert.strictEqual(res.status, 2, res.out);
});

test(VALID + " an empty register file exits 2", () => {
  const res = check("");
  assert.strictEqual(res.status, 2, res.out);
});
