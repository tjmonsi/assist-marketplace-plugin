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

// ---------------------------------------------------------------------------
// The real FERPA disclosure guard is a security-critical guard (FR-246, harness-governance Tranche 3, Step 27b)
//
// Sources: specs/spec-hooks-compliance.md, "Requirement: FERPA disclosure recordation"; docs/requirements/
// FR-NFR-harness-governance.md section 2.33 (FR-246) and section 3.2 (NFR-028); plugins/assist-plugin/rules/
// assist-plugin-rule.md, "Outbound data guards" (the guarded class is a WebFetch call and a gh/bkt pr post command; an
// error, timeout, or unreadable configuration after the input was parsed denies a covered call; ls and every other
// call still pass; an absent profile.json is log-only; a malformed profile.json under an enforced profile denies until
// fixed; the hook prints the deny JSON and exits 0). The guard implementation is not read.
//
// Traceability format: [FR-246 | 2.33 | NFR-028 | spec-hooks-compliance | Scenario or rule]. The spec has no SPEC-NNN id,
// so it is cited by file name.
//
// Fault injection: a preload script (node --require) makes the FERPA settings reader of lib/data-class.js throw. It
// edits no repository file. Each project is a temp directory with a .git directory and a profile.json.
// ---------------------------------------------------------------------------

const FERPA_ENTRY = path.join(PLUGIN, "hooks", "ferpa-disclosure-guard.js");

const FERPA_PROFILE = {
  student_record_patterns: [{ name: "sid", pattern: "\\bS\\d{8}\\b" }],
  ferpa_receiving_parties: ["district-registrar", "state-education-agency"],
  ferpa_exceptions: [{ party: "parent-guardian", exception: "99.32(d)(1)" }],
  data_classes: { "student-record": ["records/**"] },
};

const FERPA_PAYLOAD_MARKER = "FERPA-PAYLOAD-MARKER-91ac";
const FERPA_COMPLETE_TEXT = FERPA_PAYLOAD_MARKER + " grade report for S12345678\nReceiving-Party: district-registrar\nLegitimate-Interest: accreditation-review";
const FERPA_NO_DECLARATION_TEXT = FERPA_PAYLOAD_MARKER + " grade report for S12345678";

// Makes the FERPA settings reader of lib/data-class.js throw whenever it is called.
const BREAK_FERPA_SETTINGS_PRELOAD = [
  '"use strict";',
  'const Module = require("module");',
  "const originalLoad = Module._load;",
  "Module._load = function (request) {",
  "  const loaded = originalLoad.apply(this, arguments);",
  "  if (/data-class(\\.js)?$/.test(String(request)) && loaded && typeof loaded.ferpaSettings === \"function\" && !loaded.__ferpaBroken) {",
  '    loaded.ferpaSettings = function () { throw new Error("fault: ferpa settings reader failed"); };',
  "    loaded.__ferpaBroken = true;",
  "  }",
  "  return loaded;",
  "};",
  "",
].join("\n");

let ferpaPreloadFile = null;

function ferpaPreload() {
  if (!ferpaPreloadFile) {
    ferpaPreloadFile = path.join(tempDir("guard-fail-closed-ferpa-preload-"), "break-ferpa-settings.js");
    fs.writeFileSync(ferpaPreloadFile, BREAK_FERPA_SETTINGS_PRELOAD);
  }
  return ferpaPreloadFile;
}

// A project root with a .git directory. profile: an object or string for profile.json, or null for an absent file.
function ferpaRoot(profile) {
  const root = fs.realpathSync(tempDir("guard-fail-closed-ferpa-root-"));
  fs.mkdirSync(path.join(root, ".git"));
  if (profile !== null) {
    const dir = path.join(root, ".agent", "governance");
    fs.mkdirSync(dir, { recursive: true });
    const text = profile === undefined ? JSON.stringify(FERPA_PROFILE) : typeof profile === "string" ? profile : JSON.stringify(profile);
    fs.writeFileSync(path.join(dir, "profile.json"), text);
  }
  return root;
}

function ferpaInput(root, tool, toolInput) {
  return JSON.stringify({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: toolInput, cwd: root, session_id: "s-ferpa-fc-1" });
}

function ferpaWebFetch(root, text) {
  return ferpaInput(root, "WebFetch", { url: "https://sis.example.test/export", prompt: text });
}

function ferpaBashPost(root, text, tool) {
  return ferpaInput(root, tool || "Bash", { command: "gh pr comment 42 --body '" + text + "'" });
}

// options: {fault: boolean, dataDir: string | null (unset)}.
function runFerpa(stdin, root, options) {
  const opts = options || {};
  const env = { CLAUDE_CONFIG_DIR: tempDir("guard-fail-closed-ferpa-claude-") };
  if (opts.dataDir !== null) env.CLAUDE_PLUGIN_DATA = opts.dataDir || tempDir("guard-fail-closed-data-");
  const nodeArgs = opts.fault ? ["--require", ferpaPreload()] : [];
  return childProcess.spawnSync(process.execPath, nodeArgs.concat([FERPA_ENTRY]), {
    cwd: root || tempDir("guard-fail-closed-cwd-"),
    env: cleanEnv(env),
    input: stdin,
    encoding: "utf8",
    timeout: 30000,
  });
}

test("[FR-246 | 2.33 | NFR-028 | spec-hooks-compliance | Disclosure recorded] baseline: with a valid profile.json and a complete allowlisted disclosure the real guard allows the call", () => {
  const root = ferpaRoot();
  const res = runFerpa(ferpaWebFetch(root, FERPA_COMPLETE_TEXT), root);
  assertExitZero(res);
  assert.ok(!isDenyOutput(res), res.stdout);
});

test("[FR-246 | 2.33 | NFR-028 | spec-hooks-compliance] when the FERPA settings reader fails, the real guard denies a WebFetch it would have allowed, and exits 0", () => {
  const root = ferpaRoot();
  const res = runFerpa(ferpaWebFetch(root, FERPA_COMPLETE_TEXT), root, { fault: true });
  assertExitZero(res);
  assert.ok(isDenyOutput(res), "expected a deny when the reader fails, got: " + res.stdout);
  const doc = JSON.parse(res.stdout);
  assert.strictEqual(doc.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.ok(String(doc.hookSpecificOutput.permissionDecisionReason).length > 0, "a reason is given");
});

[
  ["gh pr comment", "Bash", (text) => "gh pr comment 42 --body '" + text + "'"],
  ["gh pr comment (PowerShell)", "PowerShell", (text) => "gh pr comment 42 --body '" + text + "'"],
  ["gh pr edit", "Bash", (text) => "gh pr edit 42 --body '" + text + "'"],
  ["gh pr review --comment", "Bash", (text) => "gh pr review 42 --comment --body '" + text + "'"],
  ["bkt pr comment", "Bash", (text) => "bkt pr comment 42 --text '" + text + "'"],
].forEach((row) => {
  test("[FR-246 | 2.33 | NFR-028 | spec-hooks-compliance] when the FERPA settings reader fails, the real guard denies `" + row[0] + "` (a PR post in the guarded class)", () => {
    const root = ferpaRoot();
    const stdin = ferpaInput(root, row[1], { command: row[2](FERPA_COMPLETE_TEXT) });
    const res = runFerpa(stdin, root, { fault: true });
    assertExitZero(res);
    assert.ok(isDenyOutput(res), "expected a deny when the reader fails, got: " + res.stdout);
  });
});

test("[FR-246 | 2.33 | NFR-028 | NFR-031 | spec-hooks-compliance] the fail-closed denial repeats no payload text", () => {
  const root = ferpaRoot();
  const res = runFerpa(ferpaWebFetch(root, FERPA_COMPLETE_TEXT), root, { fault: true });
  assertExitZero(res);
  assert.ok(isDenyOutput(res));
  assert.ok(res.stdout.indexOf(FERPA_PAYLOAD_MARKER) === -1, "the deny output echoes the payload: " + res.stdout);
  assert.ok(res.stdout.indexOf("S12345678") === -1, "the deny output echoes the student id: " + res.stdout);
});

test("[FR-246 | 2.33 | NFR-028 | spec-hooks-compliance] with CLAUDE_PLUGIN_DATA unset the covered call is still denied when the reader fails, and the hook exits 0", () => {
  const root = ferpaRoot();
  const res = runFerpa(ferpaWebFetch(root, FERPA_COMPLETE_TEXT), root, { fault: true, dataDir: null });
  assertExitZero(res);
  assert.ok(isDenyOutput(res), res.stdout);
});

["ls", "git status", "gh pr view 42", "echo hello", "npm test"].forEach((command) => {
  test("[FR-246 | 2.33 | NFR-028 | spec-hooks-compliance] when the FERPA settings reader fails, `" + command + "` (outside the guarded class) still proceeds with exit 0", () => {
    const root = ferpaRoot();
    const res = runFerpa(ferpaInput(root, "Bash", { command: command }), root, { fault: true });
    assertExitZero(res);
    assert.ok(!isDenyOutput(res), "outside the class must not be denied: " + res.stdout);
  });
});

test("[FR-246 | 2.33 | NFR-028 | spec-hooks-compliance] when the FERPA settings reader fails, a Read call still proceeds", () => {
  const root = ferpaRoot();
  const res = runFerpa(ferpaInput(root, "Read", { file_path: path.join(root, "README.md") }), root, { fault: true });
  assertExitZero(res);
  assert.ok(!isDenyOutput(res), res.stdout);
});

test("[FR-246 | 2.33 | NFR-028 | spec-hooks-compliance] malformed stdin proceeds (no parsed input to classify) with exit 0, even when the reader would fail", () => {
  ["this is not json", "", "{", "[1,2,3", "null"].forEach((stdin) => {
    const res = runFerpa(stdin, ferpaRoot(), { fault: true });
    assertExitZero(res);
    assert.ok(!isDenyOutput(res), "stdin " + JSON.stringify(stdin) + " gave: " + res.stdout);
  });
});

test("[FR-246 | 2.33 | NFR-028 | spec-hooks-compliance] the FERPA guard listed in hooks-disabled.json still proceeds", () => {
  const dataDir = tempDir("guard-fail-closed-data-");
  fs.writeFileSync(
    path.join(dataDir, "hooks-disabled.json"),
    JSON.stringify({ "ferpa-disclosure-guard": { reason: "test fixture", ts: "2026-11-05T00:00:00.000Z" } })
  );
  const root = ferpaRoot();
  const res = runFerpa(ferpaWebFetch(root, FERPA_COMPLETE_TEXT), root, { fault: true, dataDir: dataDir });
  assertExitZero(res);
  assert.ok(!isDenyOutput(res), res.stdout);
});

test("[FR-246 | 2.33 | NFR-028 | spec-hooks-compliance] an absent profile.json runs log-only: a student-looking payload with no declaration is not denied", () => {
  const root = ferpaRoot(null);
  assert.ok(!fs.existsSync(path.join(root, ".agent", "governance", "profile.json")));
  const web = runFerpa(ferpaWebFetch(root, FERPA_NO_DECLARATION_TEXT), root);
  const post = runFerpa(ferpaBashPost(root, FERPA_NO_DECLARATION_TEXT), root);
  assertExitZero(web);
  assertExitZero(post);
  assert.ok(!isDenyOutput(web), web.stdout);
  assert.ok(!isDenyOutput(post), post.stdout);
});

[
  ["text that is not JSON", "{ not json"],
  ["an empty file", ""],
  ["a JSON array", "[]"],
  ["data_classes of the wrong shape", { data_classes: 5 }],
  ["an allowlist that is not a list", { ferpa_receiving_parties: "district-registrar" }],
].forEach((row) => {
  test("[FR-246 | 2.33 | NFR-028 | spec-hooks-compliance] a malformed profile.json (" + row[0] + ") under an enforced FERPA profile denies a covered call and still lets `ls` pass", () => {
    const root = ferpaRoot(row[1]);
    const web = runFerpa(ferpaWebFetch(root, FERPA_COMPLETE_TEXT), root);
    const post = runFerpa(ferpaBashPost(root, FERPA_COMPLETE_TEXT), root);
    const ls = runFerpa(ferpaInput(root, "Bash", { command: "ls" }), root);
    assertExitZero(web);
    assertExitZero(post);
    assertExitZero(ls);
    assert.ok(isDenyOutput(web), "WebFetch should be denied: " + web.stdout);
    assert.ok(isDenyOutput(post), "gh pr comment should be denied: " + post.stdout);
    assert.ok(!isDenyOutput(ls), "ls must still proceed: " + ls.stdout);
  });
});

test("[FR-246 | 2.33 | NFR-028 | spec-hooks-compliance] the denial for a malformed profile.json holds until the file is fixed, then the call passes", () => {
  const root = ferpaRoot("{ not json");
  const stdin = ferpaWebFetch(root, FERPA_COMPLETE_TEXT);
  assert.ok(isDenyOutput(runFerpa(stdin, root)), "denied while malformed");
  fs.writeFileSync(path.join(root, ".agent", "governance", "profile.json"), JSON.stringify(FERPA_PROFILE));
  const fixed = runFerpa(stdin, root);
  assertExitZero(fixed);
  assert.ok(!isDenyOutput(fixed), "allowed once fixed: " + fixed.stdout);
});

test("[FR-246 | 2.33 | NFR-028 | spec-hooks-compliance] the FERPA guard never exits non-zero on any path above (exit status table)", () => {
  const root = ferpaRoot();
  const cases = [
    ["fault, WebFetch", ferpaWebFetch(root, FERPA_COMPLETE_TEXT), { fault: true }],
    ["fault, gh pr comment", ferpaBashPost(root, FERPA_COMPLETE_TEXT), { fault: true }],
    ["fault, ls", ferpaInput(root, "Bash", { command: "ls" }), { fault: true }],
    ["fault, bad stdin", "nope", { fault: true }],
    ["no fault, complete disclosure", ferpaWebFetch(root, FERPA_COMPLETE_TEXT), {}],
    ["no fault, missing interest", ferpaWebFetch(root, FERPA_NO_DECLARATION_TEXT), {}],
    ["no fault, bad stdin", "nope", {}],
    ["no fault, data dir unset", ferpaWebFetch(root, FERPA_COMPLETE_TEXT), { dataDir: null }],
  ];
  cases.forEach((c) => {
    const res = runFerpa(c[1], root, c[2]);
    assert.strictEqual(res.status, 0, c[0] + ": exit status " + res.status + "; stderr: " + res.stderr);
  });
});
