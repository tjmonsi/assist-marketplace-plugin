// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the harness-governance Tranche 5 fail-closed activation of the code-scan hook
// (plugins/assist-plugin/hooks/code-scan.js, the ES5 command entry, run as a PreToolUse hook with one JSON document on
// stdin). The hook implementation is never read; its observable output is checked: stdout, the exit code, the baseline
// store .agent/governance/review-findings.jsonl, and hook-health.jsonl.
//
// Sources: specs/spec-hooks-code-scan.md (Change Log 2026-11-13 (Tranche 5): Requirement: Fail-closed activation when the
// rule is promoted to blocking; Requirement: Advisory scan of a code-file write; Requirement: Rule-mode store governs
// advisory versus blocking; Requirement: Fail-closed class is defined and dormant while advisory; Requirement: Code-file
// class and no overlap with prose-gate), docs/requirements/FR-NFR-harness-governance.md v1.3 (FR-220, FR-238, FR-239,
// NFR-028), DECISIONS.md 2026-11-13 ("Harness-governance Tranche 5 (control register) approved for build", choice 3), and
// the rule promotion runbook plugins/assist-plugin/docs/PROMOTION_RUNBOOK.md ("While at least one code rule is blocking,
// the code-file write class is fail-closed (NFR-028) ... With no rule blocking, the hook fails open."). The spec carries no
// SPEC-NNN id, so it is cited by file name. The public interfaces used: hooks/lib/severity.js (`route`, `checkFinding`)
// and the `scan` and `RULES` exports of hooks/lib/code-rules.js (a finding is {rule_id, severity, confidence, line, fix}).
//
// Traceability format: [AC-N | spec file Requirement | FR/NFR ids]. AC-N is the position of the Scenario inside its
// Requirement in the spec. A case with no Scenario of its own carries the Requirement name in place of an AC number.
//
// Contract used:
//   - Advisory (the default; an absent, malformed, or non-"blocking" store): a match appends one finding to the baseline
//     store, the hook prints nothing and allows the write, and an evaluation error lets the write proceed (fail open).
//   - A rule the store marks exactly "blocking" denies a code-file write whose finding routes block-merge (confidence High and
//     severity HIGH or CRITICAL), naming the rule id and the line, with exit 0.
//   - While a code rule is blocking, an evaluation error on a write of a code file denies the write (fail closed, NFR-028).
//     With no code rule blocking, the same error lets the write proceed.
//   - A write of a non-code file (.md, .json, .yaml, .yml, .txt, or any path under docs/) is never judged.
//
// Every project root is a temp directory with a .git directory. The evaluation error is injected by a small wrapper that
// replaces the pattern scan with a function that throws, then runs the hook's main(); the hook files are never edited. A
// control run in advisory mode proves the injected error reached the scan (a throwing scan records no finding for a write
// that otherwise records one); when it did not, the fault cases are skipped, never passed.
//
// Run: node --test tests/hooks/code-scan-failclosed.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");
const severity = require(path.join(fx.PLUGIN, "hooks", "lib", "severity.js"));
const codeRules = require(path.join(fx.PLUGIN, "hooks", "lib", "code-rules.js"));

const SPEC = "spec-hooks-code-scan.md";
const ACTIVATION = SPEC + " Requirement: Fail-closed activation when the rule is promoted to blocking";
const ADVISORY = SPEC + " Requirement: Advisory scan of a code-file write";
const STORE = SPEC + " Requirement: Rule-mode store governs advisory versus blocking";
const DORMANT = SPEC + " Requirement: Fail-closed class is defined and dormant while advisory";
const CLASS = SPEC + " Requirement: Code-file class and no overlap with prose-gate";

const SESSION = "sess-code-scan-t5";
const MARKER = "marker-7d2f1c-do-not-store";

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Samples
// ---------------------------------------------------------------------------

// A write whose line 3 builds an SQL string from request input; the spec's block-merge example.
const SQL_CONCAT = '"use strict";\n\nconst q = "SELECT * FROM users WHERE id = \'" + req.query.id + "\'"; // ' + MARKER + "\nmodule.exports = q;\n";
// The Python form: the finding is on line 1.
const SQL_PY = 'query = "SELECT * FROM users WHERE id = " + request.args["id"]\n';
// A parameterized query: no rule matches.
const SQL_SAFE = '"use strict";\n\npool.query("SELECT * FROM users WHERE id = $1", [userId]);\nmodule.exports = pool;\n';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findingsFile(root) {
  return path.join(root, ".agent", "governance", "review-findings.jsonl");
}

function modesFile(root) {
  return path.join(root, ".agent", "governance", "rule-modes.json");
}

function writeStore(root, content) {
  const file = modesFile(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content));
}

function projectRoot(store) {
  const root = fx.tempRoot("code-scan-t5-");
  if (store !== undefined) writeStore(root, store);
  return root;
}

function readFindings(root) {
  const file = findingsFile(root);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return [];
  return fx.splitLines(fs.readFileSync(file, "utf8")).map((line) => JSON.parse(line));
}

function writeDoc(root, relative, content, tool) {
  const toolName = tool || "Write";
  const target = path.join(root, relative);
  const input =
    toolName === "Write"
      ? { file_path: target, content: content }
      : toolName === "Edit"
        ? { file_path: target, old_string: "x", new_string: content }
        : { file_path: target, edits: [{ old_string: "a", new_string: "b" }, { old_string: "x", new_string: content }] };
  return { hook_event_name: "PreToolUse", session_id: SESSION, tool_name: toolName, tool_input: input, cwd: root };
}

function run(doc) {
  const res = fx.runHook("code-scan", doc);
  assert.strictEqual(res.error, undefined, "spawn error: " + (res.error && res.error.message));
  return res;
}

// The wrapper that makes the pattern scan throw, then runs the hook: the evaluation error of NFR-028.
const SCAN_FAULT_WRAPPER = [
  '"use strict";',
  'const path = require("path");',
  "const plugin = process.env.FX_PLUGIN;",
  'const rules = require(path.join(plugin, "hooks", "lib", "code-rules.js"));',
  'rules.scan = function () { throw new Error("injected scan failure"); };',
  'require(path.join(plugin, "hooks", "impl", "code-scan.js")).main();',
  "",
].join("\n");

function runFaulty(doc) {
  const res = fx.runWrapper(SCAN_FAULT_WRAPPER, doc);
  assert.strictEqual(res.error, undefined, "spawn error: " + (res.error && res.error.message));
  return res;
}

function parseOut(res) {
  const text = res.stdout.trim();
  if (text === "") return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    return { unparsed: text };
  }
}

function isDeny(res) {
  const out = parseOut(res);
  if (!out) return false;
  return !!(out.hookSpecificOutput && out.hookSpecificOutput.permissionDecision === "deny") || out.decision === "block";
}

function assertAllowed(res, label) {
  assert.strictEqual(res.status, 0, (label || "") + " exit 0; stderr: " + res.stderr);
  assert.ok(!isDeny(res), (label || "") + " the write is allowed; stdout: " + res.stdout);
}

// A denial: exit 0 and a PreToolUse permissionDecision of deny. Returns the reason text.
function assertDenied(res, label) {
  assert.strictEqual(res.status, 0, (label || "") + " a denial exits 0; stderr: " + res.stderr);
  const out = parseOut(res);
  assert.ok(out && out.hookSpecificOutput, (label || "") + " a hookSpecificOutput object; stdout: " + res.stdout);
  assert.strictEqual(out.hookSpecificOutput.hookEventName, "PreToolUse", label);
  assert.strictEqual(out.hookSpecificOutput.permissionDecision, "deny", (label || "") + " stdout: " + res.stdout);
  const reason = out.hookSpecificOutput.permissionDecisionReason;
  assert.strictEqual(typeof reason, "string", (label || "") + " a reason: " + res.stdout);
  assert.ok(reason.length > 0, (label || "") + " a non-empty reason");
  return reason;
}

function namesLine(text, line) {
  return new RegExp("(^|[^0-9])" + line + "([^0-9]|$)").test(text);
}

// The advisory record of a sample write: the rule id, severity, confidence, and line the hook reports for it.
function advisoryRecord(relative, content) {
  const root = projectRoot();
  const res = run(writeDoc(root, relative, content));
  assertAllowed(res, "advisory run of " + relative);
  const findings = readFindings(root);
  assert.strictEqual(findings.length, 1, "the sample records one finding: " + JSON.stringify(findings));
  return findings[0];
}

// A real rule id of the catalog that differs from `ruleId`.
function otherRuleId(ruleId) {
  const other = (codeRules.RULES || []).map((r) => r.id).find((id) => id !== ruleId);
  assert.ok(other, "the rule catalog holds a second rule");
  return other;
}

// Skips the calling test (returns false) when the injected error does not reach the scan.
function faultReachesTheScan(t) {
  const root = projectRoot();
  const res = runFaulty(writeDoc(root, "src/db.js", SQL_CONCAT));
  if (readFindings(root).length > 0) {
    t.skip("the injected failure did not reach the pattern scan (a finding was recorded); confirm the error path by review");
    return false;
  }
  assert.strictEqual(res.status, 0, "the advisory control exits 0: " + res.stderr);
  return true;
}

// ---------------------------------------------------------------------------
// Advisory default: record a would-deny finding and allow
// ---------------------------------------------------------------------------

test("[AC-1 | " + ADVISORY + " | FR-220 | FR-238] advisory default: an SQL string built from request input records a would-deny finding naming the rule id and the line, and the write is allowed", () => {
  const root = projectRoot();
  const res = run(writeDoc(root, "src/db.js", SQL_CONCAT));
  assertAllowed(res);
  assert.strictEqual(res.stdout.trim(), "", "the advisory hook prints nothing");
  const findings = readFindings(root);
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(typeof findings[0].rule_id, "string");
  assert.ok(findings[0].rule_id.length > 0);
  assert.strictEqual(findings[0].line, 3);
  assert.ok(severity.checkFinding(findings[0]), "a valid baseline record: " + JSON.stringify(findings[0]));
});

test("[AC-1 | " + ADVISORY + " | FR-220 | NFR-031] the advisory finding holds no matched text and no written text", () => {
  const root = projectRoot();
  run(writeDoc(root, "src/db.js", SQL_CONCAT));
  const raw = fs.readFileSync(findingsFile(root), "utf8");
  [MARKER, "SELECT", "req.query", "users WHERE", "module.exports"].forEach((needle) => {
    assert.ok(raw.indexOf(needle) === -1, "the finding holds " + JSON.stringify(needle) + ": " + raw);
  });
});

test("[AC-2 | " + ADVISORY + " | FR-220] safe code records no finding and is allowed", () => {
  const root = projectRoot();
  const res = run(writeDoc(root, "src/db.js", SQL_SAFE));
  assertAllowed(res);
  assert.deepStrictEqual(readFindings(root), []);
  assert.strictEqual(res.stdout.trim(), "");
});

test("[AC-1 | " + ADVISORY + " | FR-220 | FR-238 | FR-239] the SQL-from-input sample routes block-merge under the severity policy: the precondition of every denial below", () => {
  // The spec's denial scenario is a write 'whose SQL-from-input finding routes block-merge'. Derive the routing from the
  // severity and confidence the hook reports, through the public routing function.
  const f = advisoryRecord("src/db.js", SQL_CONCAT);
  assert.strictEqual(severity.route({ severity: f.severity, confidence: f.confidence }), "block-merge", f.severity + " / " + f.confidence);
});

// ---------------------------------------------------------------------------
// Blocking rule: a block-merge finding denies, naming the rule id and the line
// ---------------------------------------------------------------------------

test("[AC-1 | " + ACTIVATION + " | FR-220 | FR-238 | NFR-028] a rule the store marks blocking denies a write whose finding routes block-merge, naming the rule id and the line", () => {
  const f = advisoryRecord("src/db.js", SQL_CONCAT);
  const root = projectRoot({ [f.rule_id]: "blocking" });
  const res = run(writeDoc(root, "src/db.js", SQL_CONCAT));
  const reason = assertDenied(res, "block-merge");
  assert.ok(reason.indexOf(f.rule_id) !== -1, "the denial names the rule id " + f.rule_id + ": " + reason);
  assert.ok(namesLine(reason, f.line), "the denial names line " + f.line + ": " + reason);
});

test("[AC-1 | " + ACTIVATION + " | FR-220 | FR-238] the denial of a blocking rule names the line of the finding, not a fixed line: a Python write names line 1", () => {
  const f = advisoryRecord("src/app.py", SQL_PY);
  assert.strictEqual(f.line, 1);
  const root = projectRoot({ [f.rule_id]: "blocking" });
  const reason = assertDenied(run(writeDoc(root, "src/app.py", SQL_PY)), "python");
  assert.ok(reason.indexOf(f.rule_id) !== -1, reason);
  assert.ok(namesLine(reason, 1), reason);
});

test("[AC-1 | " + ACTIVATION + " | FR-220 | FR-238] a blocking rule denies an Edit and a MultiEdit that add the SQL string, as it denies a Write", () => {
  const f = advisoryRecord("src/db.js", SQL_CONCAT);
  ["Edit", "MultiEdit"].forEach((tool) => {
    const root = projectRoot({ [f.rule_id]: "blocking" });
    assertDenied(run(writeDoc(root, "src/db.js", SQL_CONCAT, tool)), tool);
  });
});

test("[AC-1 | " + ACTIVATION + " | FR-220 | NFR-031] the denial never repeats the matched or written text", () => {
  const f = advisoryRecord("src/db.js", SQL_CONCAT);
  const root = projectRoot({ [f.rule_id]: "blocking" });
  const res = run(writeDoc(root, "src/db.js", SQL_CONCAT));
  assertDenied(res);
  assert.ok(res.stdout.indexOf(MARKER) === -1, "the denial holds the marker from the written line: " + res.stdout);
});

test("[AC-1 | " + ACTIVATION + " | FR-220 | FR-238] a blocking rule allows safe code: no finding, no denial, nothing printed", () => {
  const f = advisoryRecord("src/db.js", SQL_CONCAT);
  const root = projectRoot({ [f.rule_id]: "blocking" });
  const res = run(writeDoc(root, "src/db.js", SQL_SAFE));
  assertAllowed(res);
  assert.strictEqual(res.stdout.trim(), "");
});

test("[AC-1 | " + CLASS + " | FR-220 | NFR-028] a blocking rule never judges a non-code write: the same SQL text in a .md, .json, .txt, or a path under docs/ is allowed", () => {
  const f = advisoryRecord("src/db.js", SQL_CONCAT);
  ["docs/guide.md", "config/data.json", "notes/todo.txt", "ci/pipeline.yml", "docs/examples/db.js"].forEach((relative) => {
    const root = projectRoot({ [f.rule_id]: "blocking" });
    assertAllowed(run(writeDoc(root, relative, SQL_CONCAT)), relative);
  });
});

test("[AC-1 | " + ACTIVATION + " | FR-220 | FR-238] a rule that is not the matched rule being blocking leaves the matched rule advisory: its finding is recorded and the write is allowed", () => {
  const f = advisoryRecord("src/db.js", SQL_CONCAT);
  const root = projectRoot({ [otherRuleId(f.rule_id)]: "blocking" });
  const res = run(writeDoc(root, "src/db.js", SQL_CONCAT));
  assertAllowed(res);
  assert.strictEqual(readFindings(root).length, 1, "the advisory rule still records its finding");
});

// ---------------------------------------------------------------------------
// A non-promoting store keeps the hook advisory
// ---------------------------------------------------------------------------

function nonPromotingStores(ruleId) {
  return [
    ["no store at all", undefined],
    ["an empty object", "{}"],
    ["the rule marked advisory", JSON.stringify({ [ruleId]: "advisory" })],
    ["the rule marked 'Blocking' with a capital", JSON.stringify({ [ruleId]: "Blocking" })],
    ["the rule marked true", JSON.stringify({ [ruleId]: true })],
    ["the rule marked 'block'", JSON.stringify({ [ruleId]: "block" })],
    ["malformed JSON", "{not json"],
    ["a JSON array", "[]"],
    ["JSON null", "null"],
    ["a NUL byte", "\u0000"],
  ];
}

test("[AC-3 | " + ACTIVATION + " | FR-220 | FR-238 | NFR-028] a store that does not mark the rule blocking keeps the hook advisory: the finding is recorded and the write is allowed", () => {
  const f = advisoryRecord("src/db.js", SQL_CONCAT);
  nonPromotingStores(f.rule_id).forEach((row) => {
    const root = projectRoot(row[1]);
    const res = run(writeDoc(root, "src/db.js", SQL_CONCAT));
    assertAllowed(res, row[0]);
    assert.strictEqual(readFindings(root).length, 1, row[0]);
  });
});

test("[AC-3 | " + STORE + " | FR-238 | NFR-028] an unreadable store (a directory where the file belongs) keeps the hook advisory", () => {
  const root = projectRoot();
  fs.mkdirSync(modesFile(root), { recursive: true });
  assertAllowed(run(writeDoc(root, "src/db.js", SQL_CONCAT)));
  assert.strictEqual(readFindings(root).length, 1);
});

// ---------------------------------------------------------------------------
// Fail closed while a code rule is blocking; fail open while none is
// ---------------------------------------------------------------------------

test("[AC-2 | " + ACTIVATION + " | NFR-028 | FR-220] fail closed: while a code rule is blocking, an evaluation error on a code-file write denies the write", (t) => {
  if (!faultReachesTheScan(t)) return;
  const f = advisoryRecord("src/db.js", SQL_CONCAT);
  const root = projectRoot({ [f.rule_id]: "blocking" });
  // A safe sample: the denial comes from the failed evaluation, not from a finding.
  assertDenied(runFaulty(writeDoc(root, "src/app.py", SQL_SAFE)), "fail closed");
});

test("[AC-2 | " + ACTIVATION + " | NFR-028 | FR-220] fail closed holds for each code-file extension in the class and for Edit and MultiEdit", (t) => {
  if (!faultReachesTheScan(t)) return;
  const f = advisoryRecord("src/db.js", SQL_CONCAT);
  ["src/a.js", "src/a.ts", "src/a.py", "src/a.sh", "src/a.go", "src/a.sql", "src/a.jsx"].forEach((relative) => {
    const root = projectRoot({ [f.rule_id]: "blocking" });
    assertDenied(runFaulty(writeDoc(root, relative, SQL_SAFE)), relative);
  });
  ["Edit", "MultiEdit"].forEach((tool) => {
    const root = projectRoot({ [f.rule_id]: "blocking" });
    assertDenied(runFaulty(writeDoc(root, "src/a.js", SQL_SAFE, tool)), tool);
  });
});

test("[AC-2 | " + ACTIVATION + " | NFR-028 | FR-220] fail closed applies while any code rule is blocking: another rule blocking denies a write on an evaluation error", (t) => {
  if (!faultReachesTheScan(t)) return;
  const f = advisoryRecord("src/db.js", SQL_CONCAT);
  const root = projectRoot({ [otherRuleId(f.rule_id)]: "blocking" });
  assertDenied(runFaulty(writeDoc(root, "src/db.js", SQL_SAFE)), "another rule blocking");
});

test("[AC-2 | " + ACTIVATION + " | NFR-028 | FR-220] the fail-closed class is the code-file write: an evaluation error on a non-code write is allowed even while a rule is blocking", (t) => {
  if (!faultReachesTheScan(t)) return;
  const f = advisoryRecord("src/db.js", SQL_CONCAT);
  ["docs/guide.md", "config/data.json", "notes/todo.txt", "docs/examples/db.js", "src/Makefile"].forEach((relative) => {
    const root = projectRoot({ [f.rule_id]: "blocking" });
    assertAllowed(runFaulty(writeDoc(root, relative, SQL_SAFE)), relative);
  });
});

test("[AC-3 | " + ACTIVATION + " | NFR-028 | FR-220] fail open: with no store, an evaluation error lets the code-file write proceed and the failure is surfaced", (t) => {
  if (!faultReachesTheScan(t)) return;
  const root = projectRoot();
  const res = runFaulty(writeDoc(root, "src/db.js", SQL_CONCAT));
  assertAllowed(res);
  const surfaced = fx.readHealthLog(res.dataDir).some((e) => e.hook === "code-scan") || res.stdout.trim() !== "";
  assert.ok(surfaced, "the failure is recorded in hook-health.jsonl or warned about: " + JSON.stringify(fx.readHealthLog(res.dataDir)));
  assert.deepStrictEqual(readFindings(root), [], "a failed scan records no finding");
});

test("[AC-3 | " + ACTIVATION + " | NFR-028 | FR-220] fail open: when no rule is blocking, an evaluation error lets the write proceed, whatever the store", (t) => {
  if (!faultReachesTheScan(t)) return;
  const f = advisoryRecord("src/db.js", SQL_CONCAT);
  nonPromotingStores(f.rule_id).forEach((row) => {
    const root = projectRoot(row[1]);
    assertAllowed(runFaulty(writeDoc(root, "src/db.js", SQL_CONCAT)), row[0]);
  });
});

test("[AC-1 | " + DORMANT + " | NFR-028 | FR-220] fail open: a goal-guard promotion alone does not make the code scan fail closed, because no code rule is blocking", (t) => {
  // The goal-guard key is a rule of another check (FR-219); with no code rule blocking the code-file class stays fail-open.
  if (!faultReachesTheScan(t)) return;
  const root = projectRoot({ "goal-guard": "blocking" });
  assertAllowed(runFaulty(writeDoc(root, "src/db.js", SQL_CONCAT)));
});

test("[AC-2 | " + ACTIVATION + " | NFR-028 | FR-220] fail closed does not need a finding: the same evaluation error is a denial with a blocking rule and an allow without one", (t) => {
  if (!faultReachesTheScan(t)) return;
  const f = advisoryRecord("src/db.js", SQL_CONCAT);
  const blocking = runFaulty(writeDoc(projectRoot({ [f.rule_id]: "blocking" }), "src/db.js", SQL_CONCAT));
  const advisory = runFaulty(writeDoc(projectRoot(), "src/db.js", SQL_CONCAT));
  assertDenied(blocking, "blocking");
  assertAllowed(advisory, "advisory");
});

// ---------------------------------------------------------------------------
// The activation changes no other behavior
// ---------------------------------------------------------------------------

test("[AC-1 | " + ACTIVATION + " | NFR-028 | FR-220] an event that is not a Write, Edit, or MultiEdit is not judged, even with a blocking rule", () => {
  const f = advisoryRecord("src/db.js", SQL_CONCAT);
  const root = projectRoot({ [f.rule_id]: "blocking" });
  ["Read", "Bash", "NotebookEdit", "Grep"].forEach((tool) => {
    const doc = writeDoc(root, "src/db.js", SQL_CONCAT);
    doc.tool_name = tool;
    doc.tool_input = { file_path: path.join(root, "src/db.js"), content: SQL_CONCAT, command: SQL_CONCAT };
    assertAllowed(run(doc), tool);
  });
  assert.deepStrictEqual(readFindings(root), []);
});

test("[AC-1 | " + ACTIVATION + " | NFR-028 | FR-220] malformed hook input is allowed, exit 0, no denial, even beside a blocking store", () => {
  const f = advisoryRecord("src/db.js", SQL_CONCAT);
  const root = projectRoot({ [f.rule_id]: "blocking" });
  [
    "",
    "not json",
    "{",
    "[]",
    "{}",
    JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: null, cwd: root }),
    JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: 42, content: SQL_CONCAT }, cwd: root }),
    JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: path.join(root, "src/db.js") }, cwd: root }),
  ].forEach((doc) => {
    const res = run(doc);
    assert.strictEqual(res.status, 0, JSON.stringify(String(doc).slice(0, 60)) + " exit 0; stderr: " + res.stderr);
    assert.ok(!isDeny(res), JSON.stringify(String(doc).slice(0, 60)) + " no denial; stdout: " + res.stdout);
  });
});

test("[AC-1 | " + ACTIVATION + " | NFR-028 | FR-220] a very large safe write beside a blocking rule completes and is allowed", () => {
  const f = advisoryRecord("src/db.js", SQL_CONCAT);
  const root = projectRoot({ [f.rule_id]: "blocking" });
  const big = SQL_SAFE + "const filler = 1;\n".repeat(120000);
  assertAllowed(run(writeDoc(root, "src/big.js", big)));
});
