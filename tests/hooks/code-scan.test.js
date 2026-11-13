// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the insecure generated-code scan of harness-governance Tranche 4: the command entry
// plugins/assist-plugin/hooks/code-scan.js, run as a PreToolUse hook with one JSON document on stdin, and the advisory
// baseline records it appends to .agent/governance/review-findings.jsonl. Task plan Step 37.
//
// Sources: specs/spec-hooks-code-scan.md (Requirement: Advisory scan of a code-file write, Requirement: Code-file class and
// no overlap with prose-gate, Requirement: Rule-mode store governs advisory versus blocking, Requirement: Promotion is a
// user-run operation and this release enables no blocking, Requirement: Fail-closed class is defined and dormant while
// advisory; Change Log 2026-11-13 (Tranche 4 as-built reconciliation): the sixteen extensions and the finding record),
// docs/requirements/FR-NFR-harness-governance.md (FR-220, FR-238, NFR-028, NFR-029, NFR-031), and the header of hooks/lib/
// severity.js (the finding record). The spec carries no SPEC-NNN id, so it is cited by file name.
//
// Traceability format: [AC-N | spec-hooks-code-scan.md Requirement | FR/NFR ids]. AC-N is the position of the Scenario
// inside its Requirement.
//
// Contract used (documented behavior; the hook implementation is never read):
//   - Hook input {hook_event_name: "PreToolUse", session_id, tool_name: Write|Edit|MultiEdit, tool_input, cwd}.
//   - A write to a code file (js, mjs, cjs, ts, tsx, jsx, py, sh, bash, sql, go, java, rb, php, pl, ps1) is scanned. A write
//     to .md, .json, .yaml, .yml, .txt, or any path under docs/ is not judged.
//   - While the rule is advisory (the default; an absent, unreadable, or malformed .agent/governance/rule-modes.json, a rule
//     the store does not name, and any value but the exact string "blocking" all mean advisory) a match appends one
//     finding record {id, rule_id, severity, confidence, file, line, timestamp, review_id} to the baseline store and the hook
//     prints nothing and allows the write. The record holds the path relative to the project root, never the matched or
//     written text. review_id is the session id. The hook sets no label.
//   - The hook exits 0 and prints no deny for malformed input or an unreadable store (fail open while advisory). The shared
//     fail-open path may print a systemMessage notice on stdout for malformed input; the contract is exit 0, no deny
//     decision, and no finding appended.
//   - The ES5 entry file prints a launch-error systemMessage and exits 0 when the launcher throws or cannot be loaded.
//   - A finding that routes block-merge for a rule the store marks "blocking" is denied, naming the rule id and the line.
//
// Every project root is a temp directory with a .git directory.
//
// Run: node --test tests/hooks/code-scan.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");
const severity = require(path.join(fx.PLUGIN, "hooks", "lib", "severity.js"));

const SPEC = "spec-hooks-code-scan.md";
const ADVISORY = SPEC + " Requirement: Advisory scan of a code-file write";
const CLASS = SPEC + " Requirement: Code-file class and no overlap with prose-gate";
const STORE = SPEC + " Requirement: Rule-mode store governs advisory versus blocking";
const RELEASE = SPEC + " Requirement: Promotion is a user-run operation and this release enables no blocking";
const FAILURE = SPEC + " Requirement: Fail-closed class is defined and dormant while advisory";
const SESSION = "sess-code-scan-1";
const MARKER = "marker-4c1e9a-do-not-store";

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Samples
// ---------------------------------------------------------------------------

// A write whose line 3 builds an SQL string from request input. The marker rides on the matched line so a record that held
// the matched text would hold the marker.
const SQL_CONCAT = '"use strict";\n\nconst q = "SELECT * FROM users WHERE id = \'" + req.query.id + "\'"; // ' + MARKER + "\nmodule.exports = q;\n";
const SQL_TEMPLATE = '"use strict";\n\nconst q = `SELECT * FROM users WHERE name = \'${req.body.name}\'`; // ' + MARKER + "\nmodule.exports = q;\n";
// A parameterized query: the value travels apart from the statement.
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

function writeFile(root, relative, text) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
}

function readFindings(root) {
  const file = findingsFile(root);
  if (!fs.existsSync(file)) return [];
  return fx.splitLines(fs.readFileSync(file, "utf8")).map((line) => JSON.parse(line));
}

function doc(root, tool, toolInput, extra) {
  return Object.assign({ hook_event_name: "PreToolUse", session_id: SESSION, tool_name: tool, tool_input: toolInput, cwd: root }, extra || {});
}

function writeDoc(root, relative, content) {
  return doc(root, "Write", { file_path: path.join(root, relative), content: content });
}

function run(input, options) {
  return fx.runHook("code-scan", input, options);
}

function isDeny(res) {
  const out = res.stdout.trim();
  if (out === "") return false;
  try {
    const parsed = JSON.parse(out);
    return !!(parsed.hookSpecificOutput && parsed.hookSpecificOutput.permissionDecision === "deny") || parsed.decision === "block";
  } catch (err) {
    return false;
  }
}

function assertAllowed(res) {
  assert.strictEqual(res.error, undefined, "spawn error: " + (res.error && res.error.message));
  assert.strictEqual(res.status, 0, "exit 0; stderr: " + res.stderr);
  assert.ok(!isDeny(res), "the write is allowed; stdout: " + res.stdout);
}

function scan(relative, content, setup) {
  const root = fx.tempRoot("code-scan-");
  if (setup) setup(root);
  const res = run(writeDoc(root, relative, content));
  return { root: root, res: res, findings: readFindings(root) };
}

// The record of the SQL concat sample, for rule id, severity, and confidence.
function sqlRecord() {
  const r = scan("src/db.js", SQL_CONCAT);
  assertAllowed(r.res);
  assert.strictEqual(r.findings.length, 1, "the SQL sample records one finding");
  return r.findings[0];
}

// ---------------------------------------------------------------------------
// AC-1: injection-prone code is recorded and allowed (advisory)
// ---------------------------------------------------------------------------

test("[AC-1 | " + ADVISORY + " | FR-220 | FR-238] a Write that builds an SQL string from request input records a would-deny finding naming the rule id and the line, and allows", () => {
  const r = scan("src/db.js", SQL_CONCAT);
  assertAllowed(r.res);
  assert.strictEqual(r.findings.length, 1, "one finding is recorded");
  const f = r.findings[0];
  assert.strictEqual(typeof f.rule_id, "string");
  assert.ok(f.rule_id.length > 0, "the finding names the rule id");
  assert.strictEqual(f.line, 3, "the finding names the line of the SQL string");
  assert.strictEqual(f.file.replace(/\\/g, "/"), "src/db.js", "the path is relative to the project root");
});

test("[AC-1 | " + ADVISORY + " | FR-220 | FR-238] the advisory hook prints nothing and exits 0", () => {
  const r = scan("src/db.js", SQL_CONCAT);
  assert.strictEqual(r.res.status, 0, r.res.stderr);
  assert.strictEqual(r.res.stdout.trim(), "", "no stdout while advisory");
});

test("[AC-1 | " + ADVISORY + " | FR-220] a template-literal SQL string built from request input is recorded too", () => {
  const r = scan("src/db.js", SQL_TEMPLATE);
  assertAllowed(r.res);
  assert.strictEqual(r.findings.length, 1);
  assert.strictEqual(r.findings[0].line, 3);
});

test("[AC-1 | " + ADVISORY + " | FR-220 | FR-238] the finding record is a valid baseline record with a severity, a confidence, the session as review_id, and no label", () => {
  const f = sqlRecord();
  assert.ok(severity.checkFinding(f), "the record passes the shared validator: " + JSON.stringify(f));
  assert.ok(["CRITICAL", "HIGH", "MEDIUM", "LOW"].indexOf(f.severity) !== -1, f.severity);
  assert.ok(["High", "Medium", "Low"].indexOf(f.confidence) !== -1, f.confidence);
  assert.strictEqual(f.review_id, SESSION, "review_id is the session id");
  assert.strictEqual(typeof f.id, "string");
  assert.ok(Number.isFinite(Date.parse(f.timestamp)), "timestamp: " + f.timestamp);
  assert.strictEqual(severity.labelOf(f), null, "only the user sets a label");
  assert.ok(!("label" in f), "the hook sets no label");
});

test("[AC-1 | " + ADVISORY + " | FR-220 | NFR-031] the finding record holds no matched text, no written text, and no marker from the file", () => {
  const f = sqlRecord();
  const text = JSON.stringify(f);
  [MARKER, "SELECT", "req.query", "users WHERE", "module.exports"].forEach((needle) => {
    assert.ok(text.indexOf(needle) === -1, "found " + JSON.stringify(needle) + " in the record: " + text);
  });
  const allowed = ["id", "rule_id", "severity", "confidence", "file", "line", "timestamp", "review_id"];
  Object.keys(f).forEach((key) => {
    assert.ok(allowed.indexOf(key) !== -1, "unexpected field " + key + " in the baseline record");
  });
});

test("[AC-1 | " + ADVISORY + " | FR-238] two scans append two records with distinct ids to the same store", () => {
  const root = fx.tempRoot("code-scan-");
  assertAllowed(run(writeDoc(root, "src/a.js", SQL_CONCAT)));
  assertAllowed(run(writeDoc(root, "src/b.js", SQL_CONCAT)));
  const found = readFindings(root);
  assert.strictEqual(found.length, 2);
  assert.notStrictEqual(found[0].id, found[1].id);
  assert.deepStrictEqual(found.map((f) => f.file.replace(/\\/g, "/")).sort(), ["src/a.js", "src/b.js"]);
});

test("[AC-1 | " + ADVISORY + " | FR-220] an Edit and a MultiEdit that add an SQL string built from request input are scanned and allowed", () => {
  const edit = fx.tempRoot("code-scan-");
  const editRes = run(doc(edit, "Edit", { file_path: path.join(edit, "src/db.js"), old_string: "x", new_string: SQL_CONCAT }));
  assertAllowed(editRes);
  assert.strictEqual(readFindings(edit).length, 1, "the Edit is scanned");
  const multi = fx.tempRoot("code-scan-");
  const multiRes = run(doc(multi, "MultiEdit", { file_path: path.join(multi, "src/db.js"), edits: [{ old_string: "a", new_string: "b" }, { old_string: "x", new_string: SQL_CONCAT }] }));
  assertAllowed(multiRes);
  assert.strictEqual(readFindings(multi).length, 1, "the MultiEdit is scanned");
});

// ---------------------------------------------------------------------------
// AC-2: safe code passes
// ---------------------------------------------------------------------------

test("[AC-2 | " + ADVISORY + " | FR-220] a parameterized query matches no rule: no finding is recorded and the write is allowed", () => {
  const r = scan("src/db.js", SQL_SAFE);
  assertAllowed(r.res);
  assert.deepStrictEqual(r.findings, []);
  assert.strictEqual(fs.existsSync(findingsFile(r.root)), false, "no store file is created for a clean write");
  assert.strictEqual(r.res.stdout.trim(), "");
});

test("[AC-2 | " + ADVISORY + " | FR-220] empty and plain code content records nothing", () => {
  // Null and empty inputs.
  ["", "\n", "const a = 1;\nconsole.log(a);\n"].forEach((content) => {
    const r = scan("src/a.js", content);
    assertAllowed(r.res);
    assert.deepStrictEqual(r.findings, [], JSON.stringify(content));
  });
});

// ---------------------------------------------------------------------------
// Code-file class: only a code write is judged
// ---------------------------------------------------------------------------

test("[AC-2 | " + CLASS + " | FR-220 | NFR-029] a .md write holding an SQL example is not judged: nothing is recorded and prose-gate alone owns it", () => {
  const r = scan("docs/guide.md", SQL_CONCAT);
  assertAllowed(r.res);
  assert.deepStrictEqual(r.findings, []);
  assert.strictEqual(r.res.stdout.trim(), "", "code-scan adds no decision for a prose file");
});

test("[AC-2 | " + CLASS + " | FR-220] the excluded prose and data extensions are never scanned (.md, .json, .yaml, .yml, .txt)", () => {
  ["README.md", "config/data.json", "ci/pipeline.yaml", "ci/pipeline.yml", "notes/todo.txt"].forEach((relative) => {
    const r = scan(relative, SQL_CONCAT);
    assertAllowed(r.res);
    assert.deepStrictEqual(r.findings, [], relative);
  });
});

test("[AC-2 | " + CLASS + " | FR-220] a code file under docs/ is outside the class and is not scanned", () => {
  const r = scan("docs/examples/db.js", SQL_CONCAT);
  assertAllowed(r.res);
  assert.deepStrictEqual(r.findings, []);
});

test("[AC-1 | " + CLASS + " | FR-220] a file with no extension, or an unknown extension, is not a code file and is not scanned", () => {
  ["src/Makefile", "src/db", "src/db.unknownext", "src/db.js.bak"].forEach((relative) => {
    const r = scan(relative, SQL_CONCAT);
    assertAllowed(r.res);
    assert.deepStrictEqual(r.findings, [], relative);
  });
});

test("[AC-1 | " + CLASS + " | FR-220 | NFR-028] a code file with a TypeScript or Python extension is scanned like a JavaScript one", () => {
  // Valid representatives of the extension set beyond .js: the pattern scan runs because the extension is in the code set.
  const py = scan("src/app.py", 'query = "SELECT * FROM users WHERE id = " + request.args["id"]\n');
  assertAllowed(py.res);
  assert.strictEqual(py.findings.length, 1, "a .py write is scanned");
  assert.strictEqual(py.findings[0].line, 1);
  const ts = scan("src/db.ts", SQL_CONCAT);
  assertAllowed(ts.res);
  assert.strictEqual(ts.findings.length, 1, "a .ts write is scanned");
});

// ---------------------------------------------------------------------------
// Rule-mode store: absent, malformed, unreadable, or not "blocking" means advisory
// ---------------------------------------------------------------------------

test("[AC-1 | " + STORE + " | FR-238 | FR-245] a fresh install with no rule-mode store records the finding and allows the write", () => {
  const r = scan("src/db.js", SQL_CONCAT);
  assertAllowed(r.res);
  assert.strictEqual(r.findings.length, 1);
  assert.strictEqual(fs.existsSync(modesFile(r.root)), false, "the hook never creates the rule-mode store");
});

test("[AC-2 | " + STORE + " | FR-238] a malformed rule-mode store means advisory: the finding is recorded and the write is allowed", () => {
  ["{not json", "[]", "null", "42", '{"r":', "\u0000"].forEach((content) => {
    const r = scan("src/db.js", SQL_CONCAT, (root) => writeFile(root, ".agent/governance/rule-modes.json", content));
    assertAllowed(r.res);
    assert.strictEqual(r.findings.length, 1, "store " + JSON.stringify(content));
  });
});

test("[AC-1 | " + FAILURE + " | NFR-028 | FR-238] an unreadable rule-mode store (a directory where the file belongs) fails open: the write proceeds", () => {
  const r = scan("src/db.js", SQL_CONCAT, (root) => fs.mkdirSync(modesFile(root), { recursive: true }));
  assertAllowed(r.res);
  assert.strictEqual(r.res.stdout.trim(), "", "no deny and no output");
});

test("[AC-2 | " + STORE + " | FR-238] a store that names another rule blocking, or names this rule with any value but the exact string blocking, leaves it advisory", () => {
  const rule = sqlRecord().rule_id;
  const stores = [{ "some-other-rule": "blocking" }, { [rule]: "Blocking" }, { [rule]: "BLOCKING" }, { [rule]: true }, { [rule]: 1 }, { [rule]: "block" }, { [rule]: " blocking" }, { [rule]: "advisory" }];
  stores.forEach((store) => {
    const r = scan("src/db.js", SQL_CONCAT, (root) => writeFile(root, ".agent/governance/rule-modes.json", JSON.stringify(store)));
    assertAllowed(r.res);
    assert.strictEqual(r.findings.length, 1, "store " + JSON.stringify(store));
  });
});

// ---------------------------------------------------------------------------
// Denial only when blocking (this release enables none)
// ---------------------------------------------------------------------------

test("[AC-3 | " + ADVISORY + " | FR-220 | FR-238] a rule the store marks blocking denies, naming the rule id and the line, exactly when its finding routes block-merge", () => {
  // The spec's denial is conditional on the routing: derive it from the recorded severity and confidence, then promote the
  // rule in a second project and check the hook agrees with route().
  const first = sqlRecord();
  const routing = severity.route({ severity: first.severity, confidence: first.confidence });
  const root = fx.tempRoot("code-scan-");
  writeFile(root, ".agent/governance/rule-modes.json", JSON.stringify({ [first.rule_id]: "blocking" }));
  const res = run(writeDoc(root, "src/db.js", SQL_CONCAT));
  assert.strictEqual(res.error, undefined);
  assert.strictEqual(res.status, 0, "exit 0 even when denying; stderr: " + res.stderr);
  if (routing === "block-merge") {
    assert.ok(isDeny(res), "a blocking rule with a block-merge finding denies; stdout: " + res.stdout);
    assert.ok(res.stdout.indexOf(first.rule_id) !== -1, "the denial names the rule id; stdout: " + res.stdout);
    assert.ok(new RegExp("\\b" + first.line + "\\b").test(res.stdout), "the denial names the line; stdout: " + res.stdout);
  } else {
    assert.ok(!isDeny(res), "the finding routes " + routing + ", so a blocking rule still allows; stdout: " + res.stdout);
  }
});

test("[AC-1 | " + RELEASE + " | FR-238 | FR-220] no rule is blocking without a user-run promotion: the same write is allowed in every default state", () => {
  [null, "{}", '{"unrelated":"advisory"}'].forEach((content) => {
    const r = scan("src/db.js", SQL_CONCAT, content === null ? null : (root) => writeFile(root, ".agent/governance/rule-modes.json", content));
    assertAllowed(r.res);
    assert.strictEqual(r.findings.length, 1);
  });
});

// ---------------------------------------------------------------------------
// Fail open: malformed input
// ---------------------------------------------------------------------------

test("[AC-1 | " + FAILURE + " | NFR-028 | FR-238] malformed hook input fails open: exit 0, no deny decision, and no finding appended (a systemMessage notice on stdout is allowed)", () => {
  const root = fx.tempRoot("code-scan-");
  const inputs = [
    "",
    "not json",
    "{",
    "null",
    "[]",
    "42",
    '"a string"',
    "{}",
    JSON.stringify({ hook_event_name: "PreToolUse" }),
    JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Write" }),
    JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: null, cwd: root }),
    JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: "text", cwd: root }),
    JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: 42, content: SQL_CONCAT }, cwd: root }),
    JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: path.join(root, "src/db.js"), content: 12345 }, cwd: root }),
    JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: path.join(root, "src/db.js") }, cwd: root }),
    JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "MultiEdit", tool_input: { file_path: path.join(root, "src/db.js"), edits: "none" }, cwd: root }),
    JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "MultiEdit", tool_input: { file_path: path.join(root, "src/db.js"), edits: [null, 7, {}] }, cwd: root }),
    JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: path.join(root, "src/db.js\u0000.md"), content: SQL_CONCAT }, cwd: root }),
  ];
  // Every input is checked; the failures are collected and reported together.
  const failures = [];
  inputs.forEach((input) => {
    const res = run(input);
    const label = JSON.stringify(String(input).slice(0, 70));
    if (res.error !== undefined) failures.push(label + ": spawn error " + res.error.message);
    else if (res.status !== 0) failures.push(label + ": exit " + res.status + "; stderr: " + res.stderr);
    else if (isDeny(res)) failures.push(label + ": a deny decision; stdout: " + res.stdout);
    else {
      const out = res.stdout.trim();
      if (out !== "") {
        let parsed = null;
        try {
          parsed = JSON.parse(out);
        } catch (err) {
          failures.push(label + ": stdout is not JSON: " + out.slice(0, 120));
        }
        if (parsed && parsed.hookSpecificOutput && parsed.hookSpecificOutput.permissionDecision === "deny") failures.push(label + ": permissionDecision deny");
      }
    }
  });
  assert.deepStrictEqual(failures, [], failures.join("\n"));
  assert.deepStrictEqual(readFindings(root), [], "malformed input records nothing");
});

test("[AC-1 | " + FAILURE + " | NFR-028] an event that is not a Write, Edit, or MultiEdit call is not judged", () => {
  const root = fx.tempRoot("code-scan-");
  ["Read", "Bash", "NotebookEdit", "Grep"].forEach((tool) => {
    const res = run(doc(root, tool, { file_path: path.join(root, "src/db.js"), content: SQL_CONCAT, command: SQL_CONCAT }));
    assertAllowed(res);
  });
  assert.deepStrictEqual(readFindings(root), []);
});

test("[AC-1 | " + FAILURE + " | NFR-028 | NFR-029] a very large write completes, exits 0, and is allowed", () => {
  // Boundary: a text well over the scan cap with a match near the start. The scan is bounded and never blocks the write.
  const big = SQL_CONCAT + "const filler = 1;\n".repeat(120000);
  const root = fx.tempRoot("code-scan-");
  const res = run(writeDoc(root, "src/big.js", big));
  assertAllowed(res);
});

test("[AC-1 | " + ADVISORY + " | NFR-027 | FR-220] the hook adds no file outside .agent/governance and never writes the written text anywhere", () => {
  const r = scan("src/db.js", SQL_CONCAT);
  assertAllowed(r.res);
  const names = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.name === ".git") return;
      if (entry.isDirectory()) walk(full);
      else names.push(path.relative(r.root, full).replace(/\\/g, "/"));
    });
  })(r.root);
  assert.deepStrictEqual(names, [".agent/governance/review-findings.jsonl"], "only the baseline store is written, and the target file is not created by the scan");
});

// ---------------------------------------------------------------------------
// The ES5 entry file: the launch-error fallback
// ---------------------------------------------------------------------------

// A scratch copy of the entry file with a lib/launch.js stub (or none), so the launcher throws or cannot be loaded.
function entryCopy(stubSource) {
  const dir = fx.tempDir("code-scan-entry-");
  fs.copyFileSync(path.join(fx.PLUGIN, "hooks", "code-scan.js"), path.join(dir, "code-scan.js"));
  if (stubSource !== null) {
    fs.mkdirSync(path.join(dir, "lib"));
    fs.writeFileSync(path.join(dir, "lib", "launch.js"), stubSource);
  }
  return dir;
}

function runEntry(dir, input) {
  return childProcess.spawnSync(process.execPath, [path.join(dir, "code-scan.js")], {
    cwd: fx.tempDir("code-scan-entry-cwd-"),
    env: fx.cleanEnv({ CLAUDE_PLUGIN_DATA: fx.tempDir("code-scan-entry-data-") }),
    input: input,
    encoding: "utf8",
    timeout: 60000,
  });
}

const LAUNCH_FAILURES = [
  ["the launcher throws when it is called", 'exports.launch = function () { throw new Error("injected launch failure"); };\n'],
  ["the launcher module throws when it is loaded", 'throw new Error("injected load failure");\n'],
  ["the launcher module is missing", null],
];

LAUNCH_FAILURES.forEach((row) => {
  test("[AC-1 | " + FAILURE + " | NFR-028 | NFR-035] entry file: " + row[0] + ", so it prints the launch-error systemMessage, exits 0, and denies nothing", () => {
    const root = fx.tempRoot("code-scan-");
    const res = runEntry(entryCopy(row[1]), JSON.stringify(writeDoc(root, "src/db.js", SQL_CONCAT)));
    assert.strictEqual(res.error, undefined, "spawn error: " + (res.error && res.error.message));
    assert.strictEqual(res.status, 0, "exit 0; stderr: " + res.stderr);
    const out = JSON.parse(res.stdout.trim());
    assert.strictEqual(typeof out.systemMessage, "string");
    assert.ok(out.systemMessage.indexOf("code-scan hook failed (launch-error)") !== -1, out.systemMessage);
    assert.ok(out.systemMessage.indexOf("this write was not scanned for insecure code") !== -1, out.systemMessage);
    assert.ok(!out.hookSpecificOutput, "the fallback carries no permission decision");
    assert.deepStrictEqual(readFindings(root), [], "an unscanned write records nothing");
  });
});

test("[AC-1 | " + FAILURE + " | NFR-028 | NFR-035] the real entry file, loaded in this process with a launcher that throws, takes its catch path: launch-error systemMessage, exit 0, no deny", () => {
  // The real hooks/code-scan.js runs in-process so its top-level try/catch executes here. The launcher is replaced in
  // require.cache by a stub that throws; process.exit and the entry's fs.writeSync to fd 1 are captured and restored.
  const entryPath = path.join(fx.PLUGIN, "hooks", "code-scan.js");
  const launchPath = path.join(fx.PLUGIN, "hooks", "lib", "launch.js");
  const savedExit = process.exit;
  const savedWriteSync = fs.writeSync;
  const savedEntry = require.cache[entryPath];
  const hadLaunch = Object.prototype.hasOwnProperty.call(require.cache, launchPath);
  const savedLaunch = require.cache[launchPath];
  const exits = [];
  const writes = [];
  try {
    require.cache[launchPath] = {
      id: launchPath,
      filename: launchPath,
      loaded: true,
      children: [],
      paths: [],
      exports: {
        launch: function () {
          throw new Error("injected launch failure");
        },
      },
    };
    delete require.cache[entryPath];
    process.exit = function (code) {
      exits.push(code);
    };
    fs.writeSync = function (fd, data) {
      if (fd === 1 && typeof data === "string" && data.indexOf("systemMessage") !== -1) {
        writes.push(data);
        return data.length;
      }
      return savedWriteSync.apply(fs, arguments);
    };
    require(entryPath);
  } finally {
    process.exit = savedExit;
    fs.writeSync = savedWriteSync;
    delete require.cache[entryPath];
    if (savedEntry) require.cache[entryPath] = savedEntry;
    if (hadLaunch) require.cache[launchPath] = savedLaunch;
    else delete require.cache[launchPath];
  }
  assert.deepStrictEqual(exits, [0], "the fallback exits 0");
  assert.strictEqual(writes.length, 1, "the fallback prints one message");
  const out = JSON.parse(writes[0]);
  assert.ok(out.systemMessage.indexOf("code-scan hook failed (launch-error)") !== -1, out.systemMessage);
  assert.ok(out.systemMessage.indexOf("this write was not scanned for insecure code") !== -1, out.systemMessage);
  assert.ok(!out.hookSpecificOutput, "the fallback carries no permission decision");
});
