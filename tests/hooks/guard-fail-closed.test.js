// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the fail-closed option of security-critical guards (harness-governance
// Tranche 1, Step 1): plugins/assist-plugin/hooks/lib/health.js `guard(name, evaluate, {failClosedFor})`,
// and its use by plugins/assist-plugin/hooks/pr-verdict-guard.js.
//
// Sources: docs/requirements/FR-NFR-harness-governance.md, section 3.2 (NFR-028: Fail-closed on error; the
// class is the guarded operation class, a call outside the class still proceeds) and NFR-026 (a decision
// leaves a log record); plugins/assist-plugin/rules/assist-plugin-rule.md, "Hook Fail-Open Rule" (Exception
// for security-critical guards: the classifier must be cheap and must not throw; a stdin error, malformed
// input, a classifier that throws, a guard disabled by hooks-disabled.json, and a guard without a classifier
// still proceed; the exception never exits non-zero). Task plan: docs/task-plans/task-plan-harness-governance-20261028-0759.md,
// Step 1 and Step 9.
//
// Traceability format: [NFR-ids | requirement section | Scenario title]. The requirement document carries no
// SPEC-NNN id for this feature, so none is cited.
//
// Public interface used:
//   lib/health.js  guard(name, evaluate, options): reads one PreToolUse JSON document from stdin, runs
//                  evaluate(input), prints the deny JSON, an ask JSON, a systemMessage warning, or nothing;
//                  it always exits 0. options.failClosedFor(input) is the classifier of the guarded class.
//   impl/pr-verdict-guard.js  guardedClass(input) -> boolean, the classifier of the PR verdict guard.
//   the command `node hooks/pr-verdict-guard.js` with the hook input on stdin.
//
// Fault injection edits no repository file: a stub guard runs from a wrapper script in a temp folder, and a
// preload script (node --require) makes the confirmation reader of the real guard throw. Every child runs with
// a temporary CLAUDE_PLUGIN_DATA. A timeout after the input was parsed is not covered: guard() evaluates
// synchronously, so a black-box test cannot make evaluate hang without blocking the watchdog it tests.
//
// Run: node --test tests/hooks/guard-fail-closed.test.js

"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const HEALTH_LIB = path.join(PLUGIN, "hooks", "lib", "health.js");
const VERDICT_ENTRY = path.join(PLUGIN, "hooks", "pr-verdict-guard.js");
const verdictGuard = require(path.join(PLUGIN, "hooks", "impl", "pr-verdict-guard.js"));
const store = require(path.join(PLUGIN, "hooks", "lib", "confirmation-store.js"));

const STUB_SOURCE = [
  '"use strict";',
  "const health = require(process.env.HEALTH_PATH);",
  "const mode = process.env.STUB_MODE;",
  "function classifier(input) {",
  '  if (process.env.STUB_CLASSIFIER === "throw") { throw new Error("classifier fault"); }',
  "  const c = input && input.tool_input && input.tool_input.command;",
  '  return typeof c === "string" && /\\bgh pr review\\b/.test(c);',
  "}",
  'const options = process.env.STUB_CLASSIFIER === "none" ? undefined : { failClosedFor: classifier };',
  'health.guard("stub-critical", function () {',
  '  if (mode === "throw") { throw new TypeError("fault: evaluate failed"); }',
  '  if (mode === "deny") { return { deny: true, reason: "stub denial" }; }',
  "  return { deny: false };",
  "}, options);",
  "",
].join("\n");

// Makes the confirmation reader of the real PR verdict guard throw whenever it is called.
const BREAK_STORE_PRELOAD = [
  '"use strict";',
  'const Module = require("module");',
  "const originalLoad = Module._load;",
  "Module._load = function (request) {",
  "  const loaded = originalLoad.apply(this, arguments);",
  "  if (/confirmation-store(\\.js)?$/.test(String(request)) && loaded && typeof loaded.findConfirmation === \"function\" && !loaded.__broken) {",
  '    loaded.findConfirmation = function () { throw new Error("fault: store reader failed"); };',
  "    loaded.__broken = true;",
  "  }",
  "  return loaded;",
  "};",
  "",
].join("\n");

const scratch = [];
let wrapperDir = null;

function tempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

before(() => {
  wrapperDir = tempDir("guard-fail-closed-wrapper-");
  fs.writeFileSync(path.join(wrapperDir, "stub-guard.js"), STUB_SOURCE);
  fs.writeFileSync(path.join(wrapperDir, "break-store.js"), BREAK_STORE_PRELOAD);
});

after(() => {
  scratch.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function hookInput(command, tool, cwd) {
  const doc = { hook_event_name: "PreToolUse", tool_name: tool || "Bash", tool_input: { command: command } };
  if (cwd) doc.cwd = cwd;
  return JSON.stringify(doc);
}

function cleanEnv(extra) {
  const env = Object.assign({}, process.env);
  ["CLAUDE_PLUGIN_ROOT", "CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA"].forEach((k) => delete env[k]);
  return Object.assign(env, extra || {});
}

function runStub(stdin, dataDir, stub) {
  const env = { HEALTH_PATH: HEALTH_LIB, STUB_MODE: stub.mode || "allow" };
  if (stub.classifier) env.STUB_CLASSIFIER = stub.classifier;
  if (dataDir) env.CLAUDE_PLUGIN_DATA = dataDir;
  return childProcess.spawnSync(process.execPath, [path.join(wrapperDir, "stub-guard.js")], {
    cwd: tempDir("guard-fail-closed-cwd-"),
    env: cleanEnv(env),
    input: stdin,
    encoding: "utf8",
    timeout: 30000,
  });
}

function assertExitZero(res) {
  assert.strictEqual(res.error, undefined, "spawn error: " + (res.error && res.error.message));
  assert.strictEqual(res.status, 0, "exit status 0; stderr: " + res.stderr);
}

function isDenyOutput(res) {
  const out = res.stdout.trim();
  if (out === "") return false;
  try {
    const doc = JSON.parse(out);
    return !!(doc.hookSpecificOutput && doc.hookSpecificOutput.permissionDecision === "deny");
  } catch (err) {
    return false;
  }
}

function healthLines(dataDir) {
  const file = path.join(dataDir, "hook-health.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter((l) => l.trim() !== "");
}

const GUARDED = "gh pr review 42 --approve";

// ---------------------------------------------------------------------------
// NFR-028: a guard with a classifier denies its class when evaluate fails
// ---------------------------------------------------------------------------

test("[NFR-028 | 3.2 | Fail-closed on error] evaluate throws on a call in the guarded class: the hook prints the deny JSON and exits 0", () => {
  const res = runStub(hookInput(GUARDED), tempDir("guard-fail-closed-data-"), { mode: "throw" });
  assertExitZero(res);
  assert.ok(isDenyOutput(res), "expected the deny JSON, got: " + res.stdout);
  const doc = JSON.parse(res.stdout);
  assert.strictEqual(doc.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.strictEqual(typeof doc.hookSpecificOutput.permissionDecisionReason, "string");
  assert.ok(doc.hookSpecificOutput.permissionDecisionReason.length > 0, "a reason is given");
});

test("[NFR-028 | 3.2 | Fail-closed on error] evaluate throws on a PowerShell call in the guarded class: denied", () => {
  const res = runStub(hookInput(GUARDED, "PowerShell"), tempDir("guard-fail-closed-data-"), { mode: "throw" });
  assertExitZero(res);
  assert.ok(isDenyOutput(res), res.stdout);
});

test("[NFR-028 | 3.2 | Fail-closed on error] the denial text repeats no command text beyond what the guard's own reason holds", () => {
  const res = runStub(hookInput(GUARDED + " --body \"INJECTED-BODY-TEXT\""), tempDir("guard-fail-closed-data-"), { mode: "throw" });
  assertExitZero(res);
  assert.ok(isDenyOutput(res));
  assert.ok(res.stdout.indexOf("INJECTED-BODY-TEXT") === -1, "the deny output echoes the command: " + res.stdout);
});

test("[NFR-028 | NFR-026 | 3.2 | Fail-closed on error] the failure is logged to hook-health.jsonl without command text", () => {
  const dataDir = tempDir("guard-fail-closed-data-");
  const res = runStub(hookInput(GUARDED + " --body \"INJECTED-BODY-TEXT\""), dataDir, { mode: "throw" });
  assertExitZero(res);
  const lines = healthLines(dataDir);
  assert.ok(lines.length >= 1, "a health record exists");
  const joined = lines.join("\n");
  assert.ok(joined.indexOf("stub-critical") !== -1, "the record names the guard");
  assert.ok(joined.indexOf("INJECTED-BODY-TEXT") === -1, "no command text in the log");
  assert.ok(joined.indexOf("gh pr review") === -1, "no command text in the log");
});

test("[NFR-028 | 3.2 | Fail-closed on error] with CLAUDE_PLUGIN_DATA unset the guarded call is still denied and the hook exits 0", () => {
  const res = runStub(hookInput(GUARDED), null, { mode: "throw" });
  assertExitZero(res);
  assert.ok(isDenyOutput(res), res.stdout);
});

// ---------------------------------------------------------------------------
// NFR-028: everything outside the class still proceeds
// ---------------------------------------------------------------------------

["ls", "git status", "gh pr view 42", "echo hello"].forEach((command) => {
  test("[NFR-028 | 3.2 | Fail-closed on error] evaluate throws on `" + command + "` (outside the class): the command still proceeds with exit 0", () => {
    const res = runStub(hookInput(command), tempDir("guard-fail-closed-data-"), { mode: "throw" });
    assertExitZero(res);
    assert.ok(!isDenyOutput(res), "outside the class must not be denied: " + res.stdout);
  });
});

test("[NFR-028 | 3.2 | Fail-closed on error] a guard that declares no classifier still fails open, even for a call that looks guarded", () => {
  const res = runStub(hookInput(GUARDED), tempDir("guard-fail-closed-data-"), { mode: "throw", classifier: "none" });
  assertExitZero(res);
  assert.ok(!isDenyOutput(res), res.stdout);
});

test("[NFR-028 | 3.2 | Fail-closed on error] a classifier that throws counts as outside the class: the call proceeds", () => {
  const res = runStub(hookInput(GUARDED), tempDir("guard-fail-closed-data-"), { mode: "throw", classifier: "throw" });
  assertExitZero(res);
  assert.ok(!isDenyOutput(res), res.stdout);
});

test("[NFR-028 | 3.2 | Fail-closed on error] malformed stdin proceeds (no parsed input to classify) with exit 0", () => {
  ["this is not json", "", "{", "[1,2,3", "null"].forEach((stdin) => {
    const res = runStub(stdin, tempDir("guard-fail-closed-data-"), { mode: "throw" });
    assertExitZero(res);
    assert.ok(!isDenyOutput(res), "stdin " + JSON.stringify(stdin) + " gave: " + res.stdout);
  });
});

test("[NFR-028 | 3.2 | Fail-closed on error] a guard listed in hooks-disabled.json still proceeds", () => {
  const dataDir = tempDir("guard-fail-closed-data-");
  fs.writeFileSync(
    path.join(dataDir, "hooks-disabled.json"),
    JSON.stringify({ "stub-critical": { reason: "test fixture", ts: "2026-11-05T00:00:00.000Z" } })
  );
  const res = runStub(hookInput(GUARDED), dataDir, { mode: "throw" });
  assertExitZero(res);
  assert.ok(!isDenyOutput(res), res.stdout);
});

// ---------------------------------------------------------------------------
// The classifier changes nothing when evaluate works
// ---------------------------------------------------------------------------

test("[NFR-028 | 3.2 | Fail-closed on error] when evaluate allows a guarded call, nothing is denied", () => {
  const res = runStub(hookInput(GUARDED), tempDir("guard-fail-closed-data-"), { mode: "allow" });
  assertExitZero(res);
  assert.ok(!isDenyOutput(res), res.stdout);
});

test("[NFR-028 | 3.2 | Fail-closed on error] when evaluate denies, the deny JSON carries evaluate's own reason", () => {
  const res = runStub(hookInput("ls"), tempDir("guard-fail-closed-data-"), { mode: "deny" });
  assertExitZero(res);
  assert.ok(isDenyOutput(res), res.stdout);
  assert.strictEqual(JSON.parse(res.stdout).hookSpecificOutput.permissionDecisionReason, "stub denial");
});

test("[NFR-028 | 3.2 | Fail-closed on error] the guard never exits non-zero on any path above (exit status table)", () => {
  const cases = [
    ["throw guarded", hookInput(GUARDED), { mode: "throw" }],
    ["throw outside", hookInput("ls"), { mode: "throw" }],
    ["throw no classifier", hookInput(GUARDED), { mode: "throw", classifier: "none" }],
    ["throw classifier throws", hookInput(GUARDED), { mode: "throw", classifier: "throw" }],
    ["bad stdin", "nope", { mode: "throw" }],
    ["allow", hookInput(GUARDED), { mode: "allow" }],
    ["deny", hookInput(GUARDED), { mode: "deny" }],
  ];
  cases.forEach((c) => {
    const res = runStub(c[1], tempDir("guard-fail-closed-data-"), c[2]);
    assert.strictEqual(res.status, 0, c[0] + ": exit status " + res.status + "; stderr: " + res.stderr);
  });
});

// ---------------------------------------------------------------------------
// The real PR verdict guard is a security-critical guard
// ---------------------------------------------------------------------------

[
  "gh pr review 42 --approve",
  "gh pr review 42 --request-changes",
  "gh pr review 42 --comment --body x",
  "bkt pr approve 42",
  "bkt pr decline 42",
  "echo ok && gh pr review 42 --approve",
].forEach((command) => {
  test("[NFR-028 | FR-214 | 3.2 | Fail-closed on error] guardedClass is true for `" + command + "`", () => {
    assert.strictEqual(verdictGuard.guardedClass({ tool_name: "Bash", tool_input: { command: command } }), true);
  });
});

["ls", "git status", "echo hello", "gh pr view 42", "npm test", ""].forEach((command) => {
  test("[NFR-028 | FR-214 | 3.2 | Fail-closed on error] guardedClass is false for `" + command + "`", () => {
    assert.notStrictEqual(verdictGuard.guardedClass({ tool_name: "Bash", tool_input: { command: command } }), true);
  });
});

test("[NFR-028 | FR-214 | 3.2 | Fail-closed on error] guardedClass never throws on odd input", () => {
  [undefined, null, {}, { tool_name: "Bash" }, { tool_name: "Bash", tool_input: null }, { tool_name: "Bash", tool_input: { command: 42 } }, "text", 42].forEach((doc) => {
    assert.doesNotThrow(() => verdictGuard.guardedClass(doc));
  });
});

function runVerdictEntry(command, root, nodeArgs) {
  return childProcess.spawnSync(process.execPath, (nodeArgs || []).concat([VERDICT_ENTRY]), {
    cwd: root,
    env: cleanEnv({ CLAUDE_PLUGIN_DATA: tempDir("guard-fail-closed-data-") }),
    input: hookInput(command, undefined, root),
    encoding: "utf8",
    timeout: 30000,
  });
}

function confirmedRoot() {
  const root = fs.realpathSync(tempDir("guard-fail-closed-root-"));
  fs.mkdirSync(path.join(root, ".git"));
  store.recordConfirmation({ pr: 42, verdict: "approve", userMessageRef: "sess:1" }, { root: root });
  return root;
}

test("[NFR-028 | FR-214 | 3.2 | Fail-closed on error] baseline: with a recorded confirmation the real guard allows the post", () => {
  const res = runVerdictEntry(GUARDED, confirmedRoot());
  assertExitZero(res);
  assert.ok(!isDenyOutput(res), res.stdout);
});

test("[NFR-028 | FR-214 | 3.2 | Fail-closed on error] when the confirmation reader fails, the real guard denies the verdict post it would have allowed", () => {
  const res = runVerdictEntry(GUARDED, confirmedRoot(), ["--require", path.join(wrapperDir, "break-store.js")]);
  assertExitZero(res);
  assert.ok(isDenyOutput(res), "expected a deny when the reader fails, got: " + res.stdout);
});

test("[NFR-028 | FR-214 | 3.2 | Fail-closed on error] when the confirmation reader fails, a command outside the class (`ls`) still proceeds", () => {
  const res = runVerdictEntry("ls", confirmedRoot(), ["--require", path.join(wrapperDir, "break-store.js")]);
  assertExitZero(res);
  assert.ok(!isDenyOutput(res), res.stdout);
});
