// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box runtime and failure-path tests for the pr-post-ask hook and for the ask branch of the
// guard runtime, follow-up to release 1.12.0
// (plugins/assist-plugin/hooks/pr-post-ask.js, hooks/lib/health.js guard()).
// Task plan step 20 (docs/task-plans/task-plan-post-1-12-0-followups-20261022-143806.md).
//
// Sources: specs/spec-hooks-platform.md (Change Log 2026-10-22, Requirement: Guard decision and
// deny output, Scenarios "Ask output", "Deny wins over ask", "Truthy ask that is not true", and the
// built Requirements: Failure path, Watchdog, Disabled hooks pass through, Health log content,
// privacy, and cap), specs/spec-hooks-pr-post-ask.md (Requirement 7: ask output; Requirement 9:
// Scenarios "Hook failure" and "Health log privacy"), docs/requirements/FR-NFR-assist-plugin.md
// (FR-206, FR-088, FR-089, NFR-009, NFR-016).
//
// Traceability format: [Scenario title | spec section | requirement ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// Public interface used:
//   hooks/lib/health.js exports guard(name, evaluate): reads one PreToolUse JSON document from
//     stdin, runs evaluate(input), and prints either the deny JSON, the ask JSON, a systemMessage
//     warning, or nothing; it always exits 0. Stub guards below call it from a wrapper script.
//   the command `node hooks/pr-post-ask.js` with the hook input on stdin.
//   CLAUDE_PLUGIN_DATA: hook-health.jsonl and hooks-disabled.json live there.
//
// Fault injection edits no real file: a stub guard runs from a wrapper script written to a temp
// folder, the "evaluate throws" and "launcher fails" cases run against a scratch copy of the plugin
// whose files are replaced, and the "launcher fails in the real entry file" case runs the real
// hooks/pr-post-ask.js with a preload script (node --require) that makes the request for
// lib/launch.js throw, so the entry file's own fail-open fallback runs and is measured. Every child
// runs with a temporary CLAUDE_PLUGIN_DATA (or with it unset where the case says so).
// NODE_V8_COVERAGE is left in the child environment so a coverage run measures the child.
//
// Run: node --test tests/hooks/pr-post-ask-runtime.test.js

"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const ENTRY = path.join(PLUGIN, "hooks", "pr-post-ask.js");
const HEALTH_LIB = path.join(PLUGIN, "hooks", "lib", "health.js");

const PLATFORM = "spec-hooks-platform.md";
const SPEC = "spec-hooks-pr-post-ask.md";

const ASK_PREFIX = '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":';
const DENY_PREFIX = '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":';

// ---------------------------------------------------------------------------
// Scratch space and helpers
// ---------------------------------------------------------------------------

const scratch = [];
let wrapperDir = null;
let throwingCopy = null; // scratch copy whose pr-post-ask evaluate throws
let launcherFailCopy = null; // scratch copy whose lib/launch.js throws

function tempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

function copyPlugin(into) {
  const dest = path.join(into, "assist-plugin");
  fs.cpSync(PLUGIN, dest, {
    recursive: true,
    filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src),
  });
  return dest;
}

function cleanEnv(extra) {
  const env = Object.assign({}, process.env);
  ["CLAUDE_PLUGIN_ROOT", "CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA"].forEach((k) => delete env[k]);
  return Object.assign(env, extra || {});
}

// A stub guard: the wrapper hands health.guard a decision (or a thrown error) taken from the
// environment, so each test chooses what evaluate returns without editing any file.
const STUB_SOURCE = [
  '"use strict";',
  "const health = require(process.env.HEALTH_PATH);",
  'health.guard(process.env.STUB_NAME || "ask-stub", function () {',
  "  if (process.env.STUB_THROW) { throw new TypeError(process.env.STUB_THROW); }",
  "  return JSON.parse(process.env.STUB_RESULT);",
  "});",
  "",
].join("\n");

// The replacement decision module for the "evaluate throws" copy. It keeps the exports the launcher
// needs (main) and throws a TypeError whose message holds the whole input, command text included.
const THROWING_IMPL = [
  '"use strict";',
  'const NAME = "pr-post-ask";',
  "function evaluate(input) { throw new TypeError(\"fault: \" + JSON.stringify(input)); }",
  'function main() { require("../lib/health.js").guard(NAME, evaluate); }',
  "module.exports = { NAME: NAME, evaluate: evaluate, main: main };",
  "",
].join("\n");

const FAILING_LAUNCH = [
  '"use strict";',
  'module.exports = { launch: function () { throw new Error("fault: launcher failed"); } };',
  "",
].join("\n");

// A preload (node --require) that makes any request for lib/launch.js throw. The real entry file
// then reaches its own catch fallback, which prints the fixed launch-error warning.
const BREAK_LAUNCH_PRELOAD = [
  '"use strict";',
  'const Module = require("module");',
  "const originalLoad = Module._load;",
  "Module._load = function (request) {",
  '  if (/launch(\\.js)?$/.test(String(request))) { throw new Error("fault: launcher request failed"); }',
  "  return originalLoad.apply(this, arguments);",
  "};",
  "",
].join("\n");

before(() => {
  wrapperDir = tempDir("pr-post-ask-wrapper-");
  fs.writeFileSync(path.join(wrapperDir, "stub-guard.js"), STUB_SOURCE);
  fs.writeFileSync(path.join(wrapperDir, "break-launch.js"), BREAK_LAUNCH_PRELOAD);
  throwingCopy = copyPlugin(tempDir("pr-post-ask-throwing-"));
  fs.writeFileSync(path.join(throwingCopy, "hooks", "impl", "pr-post-ask.js"), THROWING_IMPL);
  launcherFailCopy = copyPlugin(tempDir("pr-post-ask-launcher-"));
  fs.writeFileSync(path.join(launcherFailCopy, "hooks", "lib", "launch.js"), FAILING_LAUNCH);
});

after(() => {
  scratch.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function hookInput(tool, command, extra) {
  return JSON.stringify(
    Object.assign({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: { command: command } }, extra || {})
  );
}

// Runs a script with the given stdin text and a temp cwd. dataDir may be null to leave
// CLAUDE_PLUGIN_DATA unset. nodeArgs go before the script (for example --require).
function runScript(script, stdin, dataDir, extraEnv, nodeArgs) {
  const env = cleanEnv(extraEnv);
  if (dataDir) env.CLAUDE_PLUGIN_DATA = dataDir;
  return childProcess.spawnSync(process.execPath, (nodeArgs || []).concat([script]), {
    cwd: tempDir("pr-post-ask-cwd-"),
    env: env,
    input: stdin,
    encoding: "utf8",
    timeout: 30000,
  });
}

function runStub(stdin, dataDir, stub) {
  const env = {
    HEALTH_PATH: HEALTH_LIB,
    STUB_NAME: stub.name || "ask-stub",
  };
  if (stub.result !== undefined) env.STUB_RESULT = stub.result;
  if (stub.throws !== undefined) env.STUB_THROW = stub.throws;
  return runScript(path.join(wrapperDir, "stub-guard.js"), stdin, dataDir, env);
}

const OK_INPUT = hookInput("Bash", "echo hi");

function logLines(dataDir) {
  const file = path.join(dataDir, "hook-health.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "");
}

function writeDisabled(dataDir, entries) {
  fs.writeFileSync(path.join(dataDir, "hooks-disabled.json"), typeof entries === "string" ? entries : JSON.stringify(entries));
}

function assertExitZero(res) {
  assert.strictEqual(res.error, undefined, "spawn error: " + (res.error && res.error.message));
  assert.strictEqual(res.status, 0, "exit status 0; stderr: " + res.stderr);
}

function parseOut(res) {
  assert.notStrictEqual(res.stdout.trim(), "", "expected one JSON document on stdout");
  return JSON.parse(res.stdout);
}

function fixedMessage(hook, kindAndDetail) {
  return "assist-plugin " + hook + " hook failed (" + kindAndDetail + "); this command was not checked";
}

// ---------------------------------------------------------------------------
// guard() runtime with stub guards: the ask branch
// ---------------------------------------------------------------------------

test("[Scenario: Ask output | " + PLATFORM + " Guard decision and deny output (Change Log 2026-10-22) | FR-206 FR-088 NFR-009] a guard that returns {deny:false, ask:true, reason:\"r\"} prints exactly the ask JSON and exits 0", () => {
  const dataDir = tempDir("pr-post-ask-data-");
  const res = runStub(OK_INPUT, dataDir, { result: '{"deny": false, "ask": true, "reason": "r"}' });
  assertExitZero(res);
  assert.strictEqual(res.stdout.trim(), ASK_PREFIX + '"r"}}');
  assert.strictEqual(res.stdout.trim().split("\n").length, 1, "one JSON document");
  assert.deepStrictEqual(JSON.parse(res.stdout), {
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: "r" },
  });
});

test("[Scenario: Ask output (no deny key) | " + PLATFORM + " Guard decision and deny output (Change Log 2026-10-22) | FR-206] a guard that returns only {ask:true, reason} asks the same way", () => {
  const dataDir = tempDir("pr-post-ask-data-");
  const res = runStub(OK_INPUT, dataDir, { result: '{"ask": true, "reason": "only ask"}' });
  assertExitZero(res);
  assert.strictEqual(res.stdout.trim(), ASK_PREFIX + '"only ask"}}');
});

test("[Rule: the ask path writes no hook-health.jsonl record | " + PLATFORM + " Guard decision and deny output (Change Log 2026-10-22) | FR-206 NFR-009] after an ask the data folder holds no health log", () => {
  const dataDir = tempDir("pr-post-ask-data-");
  const res = runStub(OK_INPUT, dataDir, { result: '{"deny": false, "ask": true, "reason": "r"}' });
  assertExitZero(res);
  assert.ok(res.stdout.indexOf('"permissionDecision":"ask"') !== -1, "the ask JSON was printed");
  assert.deepStrictEqual(logLines(dataDir), [], "an ask is a decision, not a failure");
});

test("[Scenario: Ask output (CLAUDE_PLUGIN_DATA unset) | " + PLATFORM + " Guard decision and deny output (Change Log 2026-10-22) | FR-206 NFR-009] the ask JSON prints when the data folder is unset", () => {
  const res = runStub(OK_INPUT, null, { result: '{"ask": true, "reason": "r"}' });
  assertExitZero(res);
  assert.strictEqual(res.stdout.trim(), ASK_PREFIX + '"r"}}');
});

test("[Scenario: Deny wins over ask | " + PLATFORM + " Guard decision and deny output (Change Log 2026-10-22) | FR-206 FR-088] {deny:true, ask:true} prints the deny JSON and no ask JSON", () => {
  const dataDir = tempDir("pr-post-ask-data-");
  const res = runStub(OK_INPUT, dataDir, { result: '{"deny": true, "ask": true, "reason": "r"}' });
  assertExitZero(res);
  assert.strictEqual(res.stdout.trim(), DENY_PREFIX + '"r"}}');
  assert.ok(res.stdout.indexOf('"permissionDecision":"ask"') === -1, "no ask JSON");
  assert.strictEqual(res.stdout.trim().split("\n").length, 1, "one JSON document");
});

test("[Scenario: Deny wins over ask (unchanged deny path) | " + PLATFORM + " Guard decision and deny output | FR-088] {deny:true} alone still prints the deny JSON", () => {
  const res = runStub(OK_INPUT, tempDir("pr-post-ask-data-"), { result: '{"deny": true, "reason": "blocked"}' });
  assertExitZero(res);
  assert.strictEqual(res.stdout.trim(), DENY_PREFIX + '"blocked"}}');
});

[
  ['{"ask": "yes"}', "the string yes"],
  ['{"ask": "true"}', "the string true"],
  ['{"ask": 1}', "the number 1"],
  ['{"ask": {}}', "an object"],
  ['{"ask": [true]}', "an array"],
  ['{"ask": "yes", "reason": "r"}', "the string yes with a reason"],
].forEach((row) => {
  test("[Scenario: Truthy ask that is not true | " + PLATFORM + " Guard decision and deny output (Change Log 2026-10-22) | FR-206 NFR-009] a guard that returns " + row[0] + " (" + row[1] + ") prints nothing and exits 0", () => {
    // Type mismatch: only the boolean true asks.
    const dataDir = tempDir("pr-post-ask-data-");
    const res = runStub(OK_INPUT, dataDir, { result: row[0] });
    assertExitZero(res);
    assert.strictEqual(res.stdout, "");
    assert.deepStrictEqual(logLines(dataDir), []);
  });
});

[
  ['{"ask": false, "reason": "r"}', "ask false"],
  ['{"deny": false}', "deny false only"],
  ["{}", "an empty object"],
  ["null", "null"],
].forEach((row) => {
  test("[Scenario: No match | " + PLATFORM + " Guard decision and deny output | FR-206 NFR-009] a guard that returns " + row[1] + " prints nothing and exits 0", () => {
    const res = runStub(OK_INPUT, tempDir("pr-post-ask-data-"), { result: row[0] });
    assertExitZero(res);
    assert.strictEqual(res.stdout, "");
  });
});

test("[Scenario: Truthy value that is not true (deny) with ask true | " + PLATFORM + " Guard decision and deny output (Change Log 2026-10-22) | FR-206] {deny:\"yes\", ask:true} does not deny and asks, because the deny field is not true", () => {
  const res = runStub(OK_INPUT, tempDir("pr-post-ask-data-"), { result: '{"deny": "yes", "ask": true, "reason": "r"}' });
  assertExitZero(res);
  assert.strictEqual(res.stdout.trim(), ASK_PREFIX + '"r"}}');
});

[
  ['{"ask": true}', "no reason"],
  ['{"ask": true, "reason": ""}', "an empty reason"],
  ['{"ask": true, "reason": 42}', "a number as reason"],
  ['{"ask": true, "reason": null}', "a null reason"],
  ['{"ask": true, "reason": ["r"]}', "an array as reason"],
].forEach((row) => {
  test("[Rule: empty or non-string reason on the ask path | " + PLATFORM + " Guard decision and deny output (Change Log 2026-10-22) | FR-206] " + row[1] + " becomes the fixed text", () => {
    // Null/empty and type mismatch.
    const res = runStub(OK_INPUT, tempDir("pr-post-ask-data-"), { result: row[0], name: "ask-stub" });
    assertExitZero(res);
    assert.strictEqual(res.stdout.trim(), ASK_PREFIX + '"assist-plugin guard ask-stub asks before this command"}}');
  });
});

test("[Rule: the fixed reason names the guard | " + PLATFORM + " Guard decision and deny output (Change Log 2026-10-22) | FR-206] the fallback reason carries the guard's own name", () => {
  const res = runStub(OK_INPUT, tempDir("pr-post-ask-data-"), { result: '{"ask": true}', name: "other-guard" });
  assertExitZero(res);
  assert.strictEqual(res.stdout.trim(), ASK_PREFIX + '"assist-plugin guard other-guard asks before this command"}}');
});

test("[Scenario: Disabled guard (ask stub) | " + PLATFORM + " Disabled hooks pass through | FR-091 FR-206 NFR-009] a listed guard prints the guard warning and no ask JSON", () => {
  const dataDir = tempDir("pr-post-ask-data-");
  writeDisabled(dataDir, { "ask-stub": { reason: "self-test: known-safe command asked (1 case)", ts: "2026-10-22T09:00:00.000Z" } });
  const res = runStub(OK_INPUT, dataDir, { result: '{"ask": true, "reason": "r"}' });
  assertExitZero(res);
  const out = parseOut(res);
  assert.strictEqual(
    out.systemMessage,
    "assist-plugin ask-stub guard is disabled (self-test: known-safe command asked (1 case)); protection is off and this command was not checked. Run /assist-plugin:health for details."
  );
  assert.ok(!("hookSpecificOutput" in out), "no decision is printed for a disabled guard");
});

test("[Scenario: Guard logic throws (ask stub) | " + PLATFORM + " Failure path | FR-089 NFR-009 NFR-016] a throwing evaluate prints only the exception warning, exits 0, and logs no command text", () => {
  const dataDir = tempDir("pr-post-ask-data-");
  const res = runStub(OK_INPUT, dataDir, { throws: "boom token=abc123" });
  assertExitZero(res);
  const out = parseOut(res);
  assert.deepStrictEqual(Object.keys(out), ["systemMessage"], "only the warning is printed");
  assert.ok(/^assist-plugin ask-stub hook failed \(exception[:)]/.test(out.systemMessage), out.systemMessage);
  assert.ok(out.systemMessage.endsWith("; this command was not checked"), out.systemMessage);
  const lines = logLines(dataDir);
  assert.strictEqual(lines.length, 1, "one health-log record");
  const record = JSON.parse(lines[0]);
  assert.strictEqual(record.hook, "ask-stub");
  assert.strictEqual(record.kind, "exception");
  assert.ok(fs.readFileSync(path.join(dataDir, "hook-health.jsonl"), "utf8").indexOf("abc123") === -1, "the error message text is never copied");
});

// ---------------------------------------------------------------------------
// The real hook: node hooks/pr-post-ask.js on stdin
// ---------------------------------------------------------------------------

test("[Scenario: Merge asks (runtime) | " + SPEC + " Requirement 4 and 7 | FR-206 UR-055] gh pr merge 123 on stdin prints one ask JSON whose reason contains gh pr merge, and exits 0", () => {
  const dataDir = tempDir("pr-post-ask-data-");
  const res = runScript(ENTRY, hookInput("Bash", "gh pr merge 123"), dataDir);
  assertExitZero(res);
  assert.strictEqual(res.stdout.trim().split("\n").length, 1, "one JSON document");
  const out = parseOut(res);
  assert.deepStrictEqual(Object.keys(out), ["hookSpecificOutput"]);
  assert.deepStrictEqual(Object.keys(out.hookSpecificOutput).sort(), ["hookEventName", "permissionDecision", "permissionDecisionReason"]);
  assert.strictEqual(out.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.strictEqual(out.hookSpecificOutput.permissionDecision, "ask");
  assert.strictEqual(typeof out.hookSpecificOutput.permissionDecisionReason, "string");
  assert.ok(out.hookSpecificOutput.permissionDecisionReason.indexOf("gh pr merge") !== -1, out.hookSpecificOutput.permissionDecisionReason);
  assert.ok(res.stdout.indexOf('"permissionDecision":"deny"') === -1, "the call is never denied");
  assert.deepStrictEqual(logLines(dataDir), [], "an ask writes no health-log record");
});

test("[Scenario: Subagent call (runtime) | " + SPEC + " Requirement 1 | FR-206] a subagent of another plugin gets the same ask JSON", () => {
  const res = runScript(ENTRY, hookInput("Bash", "gh pr merge 123", { agent_type: "other-plugin:worker", agent_id: "a1" }), tempDir("pr-post-ask-data-"));
  assertExitZero(res);
  assert.strictEqual(parseOut(res).hookSpecificOutput.permissionDecision, "ask");
});

test("[Scenario: Windows program names (runtime) | " + SPEC + " Requirement 3 | FR-206 FR-198] a PowerShell call GH.EXE pr review 1 --approve asks", () => {
  const res = runScript(ENTRY, hookInput("PowerShell", "GH.EXE pr review 1 --approve"), tempDir("pr-post-ask-data-"));
  assertExitZero(res);
  const out = parseOut(res);
  assert.strictEqual(out.hookSpecificOutput.permissionDecision, "ask");
  assert.ok(out.hookSpecificOutput.permissionDecisionReason.indexOf("gh pr review") !== -1);
});

test("[Scenario: Reason names the family (runtime) | " + SPEC + " Requirement 7 | FR-206 NFR-016] the ask reason for bkt pr approve holds no workspace name", () => {
  const res = runScript(ENTRY, hookInput("Bash", "bkt pr approve 1 --workspace acme --repo repo"), tempDir("pr-post-ask-data-"));
  assertExitZero(res);
  const reason = parseOut(res).hookSpecificOutput.permissionDecisionReason;
  assert.ok(reason.indexOf("bkt pr approve") !== -1, reason);
  assert.ok(reason.indexOf("acme") === -1, reason);
});

[
  ["Bash", "git status"],
  ["Bash", "gh pr view 123"],
  ["Bash", "bkt api /x --method GET"],
  ["Bash", 'git commit -m "docs: explain gh pr review"'],
  ["PowerShell", "gh pr view 1"],
  ["Write", "gh pr merge 123"],
].forEach((row) => {
  test("[Scenario: Read commands pass (runtime) | " + SPEC + " Requirements 1, 4, 5, 6 | FR-206] " + row[0] + " " + JSON.stringify(row[1]) + " prints nothing and exits 0", () => {
    const dataDir = tempDir("pr-post-ask-data-");
    const res = runScript(ENTRY, hookInput(row[0], row[1]), dataDir);
    assertExitZero(res);
    assert.strictEqual(res.stdout, "");
    assert.deepStrictEqual(logLines(dataDir), []);
  });
});

[
  ["not json", "text that is not JSON"],
  ['{"tool_name": ', "truncated JSON"],
].forEach((row) => {
  test("[Scenario: Hook failure (malformed input) | " + SPEC + " Requirement 9 | FR-089 NFR-009] " + row[1] + " prints only the systemMessage ending this command was not checked, exits 0, and logs one malformed-input record", () => {
    const dataDir = tempDir("pr-post-ask-data-");
    const res = runScript(ENTRY, row[0], dataDir);
    assertExitZero(res);
    const out = parseOut(res);
    assert.deepStrictEqual(Object.keys(out), ["systemMessage"], "only the warning is printed");
    assert.strictEqual(out.systemMessage, fixedMessage("pr-post-ask", "malformed-input: hook input is not valid JSON"));
    const lines = logLines(dataDir);
    assert.strictEqual(lines.length, 1);
    const record = JSON.parse(lines[0]);
    assert.strictEqual(record.hook, "pr-post-ask");
    assert.strictEqual(record.kind, "malformed-input");
  });
});

test("[Scenario: Data directory unset | " + PLATFORM + " Health log content, privacy, and cap | FR-089 NFR-009] malformed input with CLAUDE_PLUGIN_DATA unset prints the warning, exits 0, and creates no log file in the working folder", () => {
  const cwd = tempDir("pr-post-ask-cwd-unset-");
  const res = childProcess.spawnSync(process.execPath, [ENTRY], { cwd: cwd, env: cleanEnv(), input: "not json", encoding: "utf8", timeout: 30000 });
  assertExitZero(res);
  assert.strictEqual(parseOut(res).systemMessage, fixedMessage("pr-post-ask", "malformed-input: hook input is not valid JSON"));
  assert.deepStrictEqual(fs.readdirSync(cwd), [], "no file was created");
});

test("[Scenario: Disabled guard | " + PLATFORM + " Disabled hooks pass through | FR-091 FR-206 NFR-009] a hook listed in hooks-disabled.json prints the guard warning and no ask", () => {
  const dataDir = tempDir("pr-post-ask-data-");
  writeDisabled(dataDir, { "pr-post-ask": { reason: "self-test: known-safe command asked (1 case)", ts: "2026-10-22T09:00:00.000Z" } });
  const res = runScript(ENTRY, hookInput("Bash", "gh pr merge 123"), dataDir);
  assertExitZero(res);
  const out = parseOut(res);
  assert.strictEqual(
    out.systemMessage,
    "assist-plugin pr-post-ask guard is disabled (self-test: known-safe command asked (1 case)); protection is off and this command was not checked. Run /assist-plugin:health for details."
  );
  assert.ok(!("hookSpecificOutput" in out), "no ask is printed for a disabled hook");
});

test("[Scenario: Disabled guard (another hook listed) | " + PLATFORM + " Disabled hooks pass through | FR-091 FR-206] an entry for doc-cli-guard does not disable pr-post-ask", () => {
  const dataDir = tempDir("pr-post-ask-data-");
  writeDisabled(dataDir, { "doc-cli-guard": { reason: "self-test: known-safe command denied (1 case)", ts: "2026-10-22T09:00:00.000Z" } });
  const res = runScript(ENTRY, hookInput("Bash", "gh pr merge 123"), dataDir);
  assertExitZero(res);
  assert.strictEqual(parseOut(res).hookSpecificOutput.permissionDecision, "ask");
});

test("[Scenario: Corrupt flag file | " + PLATFORM + " Disabled hooks pass through | FR-206 NFR-009] a hooks-disabled.json that holds [1, 2] leaves the hook running its normal logic", () => {
  const dataDir = tempDir("pr-post-ask-data-");
  writeDisabled(dataDir, "[1, 2]");
  const res = runScript(ENTRY, hookInput("Bash", "gh pr merge 123"), dataDir);
  assertExitZero(res);
  assert.strictEqual(parseOut(res).hookSpecificOutput.permissionDecision, "ask");
});

test("[Scenario: Health log privacy | " + SPEC + " Requirement 9 | FR-089 NFR-016 NFR-009] an evaluate that throws on bkt api /x --field token=abc123 leaves abc123 out of hook-health.jsonl and prints only the warning", () => {
  const dataDir = tempDir("pr-post-ask-data-");
  const res = runScript(path.join(throwingCopy, "hooks", "pr-post-ask.js"), hookInput("Bash", "bkt api /x --field token=abc123"), dataDir);
  assertExitZero(res);
  const out = parseOut(res);
  assert.deepStrictEqual(Object.keys(out), ["systemMessage"], "no ask and no deny is printed");
  assert.ok(out.systemMessage.indexOf("pr-post-ask hook failed (exception") !== -1, out.systemMessage);
  assert.ok(out.systemMessage.endsWith("; this command was not checked"), out.systemMessage);
  assert.ok(out.systemMessage.indexOf("abc123") === -1, "the warning holds no command text: " + out.systemMessage);
  const lines = logLines(dataDir);
  assert.strictEqual(lines.length, 1, "one health-log record");
  const record = JSON.parse(lines[0]);
  assert.strictEqual(record.hook, "pr-post-ask");
  assert.strictEqual(record.kind, "exception");
  assert.ok(String(record.message).indexOf("guard logic failed") !== -1, record.message);
  const raw = fs.readFileSync(path.join(dataDir, "hook-health.jsonl"), "utf8");
  assert.ok(raw.indexOf("abc123") === -1, "hook-health.jsonl must not hold the token");
  assert.ok(raw.indexOf("token=") === -1, "hook-health.jsonl must not hold the command text");
});

test("[Scenario: Hook failure (throw, gh pr merge 1) | " + SPEC + " Requirement 9 | FR-089 NFR-009] when evaluate throws, a call gh pr merge 1 gets only the warning and proceeds with no prompt from this hook", () => {
  const res = runScript(path.join(throwingCopy, "hooks", "pr-post-ask.js"), hookInput("Bash", "gh pr merge 1"), tempDir("pr-post-ask-data-"));
  assertExitZero(res);
  const out = parseOut(res);
  assert.ok(!("hookSpecificOutput" in out), "no decision is printed");
  assert.ok(out.systemMessage.endsWith("this command was not checked"), out.systemMessage);
});

test("[Scenario: Hook failure (launcher fails) | " + SPEC + " Requirement 9 | FR-089 NFR-009] when the launcher throws, the entry file prints the fixed launch-error warning and exits 0", () => {
  const res = runScript(path.join(launcherFailCopy, "hooks", "pr-post-ask.js"), hookInput("Bash", "gh pr merge 1"), tempDir("pr-post-ask-data-"));
  assertExitZero(res);
  const out = parseOut(res);
  assert.deepStrictEqual(out, { systemMessage: fixedMessage("pr-post-ask", "launch-error") });
});

test("[Scenario: Hook failure (launcher request fails in the real entry file) | " + SPEC + " Requirement 9 | FR-089 NFR-009] the real hooks/pr-post-ask.js, with the request for lib/launch.js made to throw by a preload, prints the fixed launch-error warning, no decision, and exits 0", () => {
  const dataDir = tempDir("pr-post-ask-data-");
  const res = runScript(
    ENTRY,
    hookInput("Bash", "gh pr merge 1"),
    dataDir,
    {},
    ["--require", path.join(wrapperDir, "break-launch.js")]
  );
  assertExitZero(res);
  const out = parseOut(res);
  assert.deepStrictEqual(out, { systemMessage: fixedMessage("pr-post-ask", "launch-error") });
  assert.ok(!("hookSpecificOutput" in out), "the call proceeds with no prompt from this hook");
  assert.strictEqual(res.stdout.trim().split("\n").length, 1, "one JSON document");
});

test("[Scenario: Hook failure (timeout) | " + SPEC + " Requirement 9; " + PLATFORM + " Watchdog | FR-089 NFR-007 NFR-009] when stdin never closes, the hook prints the timeout warning after about 3000 ms, exits 0, and logs a timeout record", async () => {
  const dataDir = tempDir("pr-post-ask-data-");
  const env = cleanEnv({ CLAUDE_PLUGIN_DATA: dataDir });
  const child = childProcess.spawn(process.execPath, [ENTRY], { cwd: tempDir("pr-post-ask-cwd-"), env: env, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (d) => {
    stdout += d;
  });
  const started = Date.now();
  const outcome = await new Promise((resolve) => {
    const killer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 20000);
    child.on("close", (code, signal) => {
      clearTimeout(killer);
      resolve({ code: code, signal: signal });
    });
  });
  const elapsed = Date.now() - started;
  assert.strictEqual(outcome.signal, null, "the hook exited on its own at the watchdog");
  assert.strictEqual(outcome.code, 0);
  assert.ok(elapsed < 5000, "finished before the registered 5 s timeout (" + elapsed + " ms)");
  assert.strictEqual(JSON.parse(stdout).systemMessage, fixedMessage("pr-post-ask", "timeout: no result within 3000 ms"));
  const lines = logLines(dataDir);
  assert.strictEqual(lines.length, 1);
  assert.strictEqual(JSON.parse(lines[0]).kind, "timeout");
  assert.strictEqual(JSON.parse(lines[0]).hook, "pr-post-ask");
});

// ---------------------------------------------------------------------------
// The entry file is ES5 and follows the launcher pattern
// ---------------------------------------------------------------------------

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function stripStrings(source) {
  return source.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
}

test("[Traceability row NFR-017 | " + SPEC + " Triggered by | FR-206 NFR-017] the entry file hooks/pr-post-ask.js uses only ES5 syntax", () => {
  const code = stripComments(fs.readFileSync(ENTRY, "utf8"));
  assert.ok(code.indexOf("`") === -1, "no template literal");
  const bare = stripStrings(code);
  assert.ok(!/\bconst\b/.test(bare), "no const");
  assert.ok(!/\blet\b/.test(bare), "no let");
  assert.ok(!/=>/.test(bare), "no arrow function");
  assert.ok(!/\b(async|await|class|yield)\b/.test(bare), "no async, await, class, or yield");
  assert.ok(!/\.\.\./.test(bare), "no spread or rest");
});

test("[Traceability row FR-089 | " + SPEC + " Triggered by | FR-206 FR-089] the entry file starts with the SPDX header and starts the hook through the launcher with the name pr-post-ask", () => {
  const source = fs.readFileSync(ENTRY, "utf8");
  assert.ok(source.indexOf("// SPDX-License-Identifier: AGPL-3.0-or-later") === 0, "SPDX header on the first line");
  assert.ok(/launch\(\s*["']pr-post-ask["']\s*,\s*["']impl\/pr-post-ask\.js["']/.test(source), "launch(\"pr-post-ask\", \"impl/pr-post-ask.js\", ...)");
  assert.ok(source.indexOf("this command was not checked") !== -1, "the fail-open warning ends with this command was not checked");
  assert.ok(fs.existsSync(path.join(PLUGIN, "hooks", "impl", "pr-post-ask.js")), "the decision module exists beside the other hook modules");
});
