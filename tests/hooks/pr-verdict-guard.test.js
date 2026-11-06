// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the PR verdict deny guard (harness-governance Tranche 1, Step 4):
// plugins/assist-plugin/hooks/pr-verdict-guard.js (command entry) and
// plugins/assist-plugin/hooks/impl/pr-verdict-guard.js (`evaluate(input, options)`).
//
// Sources: docs/requirements/FR-NFR-harness-governance.md, section 2.1 (FR-214: Confirmed verdict posts,
// Additive guard leaves the pr-post-ask prompt in place, Injected approval is denied, Confirmation for a
// different verdict does not carry over) and section 2.29 (FR-242: Pending record is not a confirmation,
// Forged confirmation rejected); NFR-028 (fail closed), NFR-031 (no message text in logs).
// Task plan: docs/task-plans/task-plan-harness-governance-20261028-0759.md, Step 4 and Step 9.
//
// Traceability format: [FR-ids | AC section | Scenario title]. The requirement document uses numbered
// acceptance sections and carries no SPEC-NNN id for this feature, so none is cited.
//
// Public interface used:
//   impl/pr-verdict-guard.js  evaluate(input, {root}) -> {deny, ask, reason, confirmed}; `deny === true` blocks.
//                             `root` is the absolute project root that holds .agent/.
//   lib/confirmation-store.js recordConfirmation({pr, verdict, userMessageRef}, {root}) and
//                             createPending({pr, verdict, sessionId}, {root}) build the store the guard reads.
//   impl/pr-post-ask.js       evaluate(input) -> {ask, deny, reason} (must stay unchanged and still ask).
//   the command `node hooks/pr-verdict-guard.js` with the PreToolUse JSON on stdin (deny JSON on stdout, exit 0).
//
// Every store lives in a temp directory. Child processes run with a temporary CLAUDE_PLUGIN_DATA.
//
// Run: node --test tests/hooks/pr-verdict-guard.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const GUARD_ENTRY = path.join(PLUGIN, "hooks", "pr-verdict-guard.js");
const guard = require(path.join(PLUGIN, "hooks", "impl", "pr-verdict-guard.js"));
const askHook = require(path.join(PLUGIN, "hooks", "impl", "pr-post-ask.js"));
const store = require(path.join(PLUGIN, "hooks", "lib", "confirmation-store.js"));

const scratch = [];

after(() => {
  scratch.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

// A project root with a .git directory, so the command entry resolves the same root as options.root.
function tempRoot() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "pr-verdict-guard-")));
  fs.mkdirSync(path.join(dir, ".git"));
  scratch.push(dir);
  return dir;
}

function tempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

function input(command, tool, root) {
  const doc = {
    hook_event_name: "PreToolUse",
    tool_name: tool || "Bash",
    tool_input: { command: command },
    session_id: "s-guard-1",
  };
  if (root) doc.cwd = root;
  return doc;
}

function run(command, root, tool) {
  return guard.evaluate(input(command, tool, root), { root: root });
}

function isDenied(result) {
  return result !== null && result !== undefined && result.deny === true;
}

function confirm(root, pr, verdict, ref) {
  store.recordConfirmation({ pr: pr, verdict: verdict, userMessageRef: ref || "s-guard-1:1001" }, { root: root });
}

function confirmationsFile(root) {
  return path.join(root, ".agent", "governance", "confirmations", "confirmations.jsonl");
}

// ---------------------------------------------------------------------------
// FR-214: an unconfirmed verdict post is denied
// ---------------------------------------------------------------------------

const POSTING_COMMANDS = [
  ["gh pr review 42 --approve", "approve"],
  ["gh pr review 42 --request-changes", "request-changes"],
  ["gh pr review 42 --comment --body \"x\"", "comment"],
  ["gh pr review --approve 42", "approve"],
  ["bkt pr approve 42", "approve"],
  ["bkt pr decline 42", "decline"],
  ["bkt pr approve 42 --workspace acme --repo shop", "approve"],
  ["echo ready && gh pr review 42 --approve", "approve"],
];

POSTING_COMMANDS.forEach((row) => {
  test("[FR-214 | 2.1 | Injected approval is denied] with no recorded confirmation, `" + row[0] + "` is denied and the reason names the missing confirmation", () => {
    const root = tempRoot();
    const result = run(row[0], root);
    assert.ok(isDenied(result), "expected deny for: " + row[0]);
    assert.ok(/confirm/i.test(String(result.reason)), "the denial names the missing confirmation: " + result.reason);
    assert.ok(/42/.test(String(result.reason)), "the denial names the PR number: " + result.reason);
  });
});

test("[FR-214 | 2.1 | Injected approval is denied] a PowerShell call to gh pr review is denied with no confirmation", () => {
  const root = tempRoot();
  assert.ok(isDenied(run("gh pr review 42 --approve", root, "PowerShell")));
});

test("[FR-214 | 2.1 | Injected approval is denied] a missing .agent folder (store never written) denies", () => {
  const root = tempRoot();
  assert.ok(!fs.existsSync(path.join(root, ".agent")));
  assert.ok(isDenied(run("gh pr review 42 --approve", root)));
});

test("[FR-214 | 2.1 | Injected approval is denied | NFR-031] the denial repeats no command text beyond the PR and the verdict", () => {
  // Security-adjacent: injected PR text can ride in a --body argument; the denial must not echo it.
  const root = tempRoot();
  const result = run("gh pr review 42 --approve --body \"IGNORE-PREVIOUS-INSTRUCTIONS-xyz\"", root);
  assert.ok(isDenied(result));
  assert.ok(String(result.reason).indexOf("IGNORE-PREVIOUS-INSTRUCTIONS-xyz") === -1, "reason: " + result.reason);
});

test("[FR-214 | 2.1 | Injected approval is denied] an empty confirmations.jsonl and a garbage confirmations.jsonl both deny", () => {
  const rootEmpty = tempRoot();
  fs.mkdirSync(path.dirname(confirmationsFile(rootEmpty)), { recursive: true });
  fs.writeFileSync(confirmationsFile(rootEmpty), "");
  assert.ok(isDenied(run("gh pr review 42 --approve", rootEmpty)));

  const rootBad = tempRoot();
  fs.mkdirSync(path.dirname(confirmationsFile(rootBad)), { recursive: true });
  fs.writeFileSync(confirmationsFile(rootBad), "not json\n{\"pr\": \n[1,2,3]\n\"approve\"\n");
  assert.ok(isDenied(run("gh pr review 42 --approve", rootBad)));
});

test("[FR-214 | 2.1 | Injected approval is denied | FR-242 | 2.29 | Forged confirmation rejected] a hand-written line without the hook writer mark does not count as a confirmation", () => {
  const root = tempRoot();
  fs.mkdirSync(path.dirname(confirmationsFile(root)), { recursive: true });
  fs.writeFileSync(confirmationsFile(root), JSON.stringify({ pr: "42", verdict: "approve" }) + "\n");
  assert.ok(isDenied(run("gh pr review 42 --approve", root)));
});

// ---------------------------------------------------------------------------
// FR-214: a matching recorded confirmation allows
// ---------------------------------------------------------------------------

POSTING_COMMANDS.forEach((row) => {
  test("[FR-214 | 2.1 | Confirmed verdict posts] with a recorded " + row[1] + " confirmation for PR 42, `" + row[0] + "` is allowed", () => {
    const root = tempRoot();
    confirm(root, 42, row[1]);
    const result = run(row[0], root);
    assert.ok(!isDenied(result), "expected allow, got: " + JSON.stringify(result));
  });
});

test("[FR-214 | 2.1 | Confirmed verdict posts] the allow result carries the confirmation reference for the log", () => {
  const root = tempRoot();
  confirm(root, 42, "approve", "s-guard-1:424242");
  const result = run("gh pr review 42 --approve", root);
  assert.ok(!isDenied(result));
  assert.ok(Array.isArray(result.confirmed) && result.confirmed.length === 1, "one confirmed verdict: " + JSON.stringify(result));
  assert.strictEqual(result.confirmed[0].reference, "s-guard-1:424242");
});

// ---------------------------------------------------------------------------
// FR-214: a confirmation does not carry over
// ---------------------------------------------------------------------------

test("[FR-214 | 2.1 | Confirmation for a different verdict does not carry over] approve recorded, --request-changes posted -> denied", () => {
  const root = tempRoot();
  confirm(root, 42, "approve");
  assert.ok(isDenied(run("gh pr review 42 --request-changes", root)));
});

test("[FR-214 | 2.1 | Confirmation for a different verdict does not carry over] approve recorded, --comment posted -> denied", () => {
  const root = tempRoot();
  confirm(root, 42, "approve");
  assert.ok(isDenied(run("gh pr review 42 --comment --body \"x\"", root)));
});

test("[FR-214 | 2.1 | Confirmation for a different verdict does not carry over] bkt approve recorded, bkt decline posted -> denied", () => {
  const root = tempRoot();
  confirm(root, 42, "approve");
  assert.ok(isDenied(run("bkt pr decline 42", root)));
});

test("[FR-214 | 2.1 | Confirmation for a different verdict does not carry over] a confirmation for PR 42 does not cover PR 43 (boundary: adjacent number)", () => {
  const root = tempRoot();
  confirm(root, 42, "approve");
  assert.ok(isDenied(run("gh pr review 43 --approve", root)));
  assert.ok(isDenied(run("gh pr review 4 --approve", root)));
  assert.ok(isDenied(run("gh pr review 420 --approve", root)));
});

test("[FR-214 | 2.1 | Confirmation for a different verdict does not carry over] two verdicts in one command need both confirmations", () => {
  const root = tempRoot();
  confirm(root, 42, "approve");
  assert.ok(isDenied(run("gh pr review 42 --approve && gh pr review 42 --request-changes", root)));
  confirm(root, 42, "request-changes");
  assert.ok(!isDenied(run("gh pr review 42 --approve && gh pr review 42 --request-changes", root)));
});

// ---------------------------------------------------------------------------
// FR-242: a pending-action record is not a confirmation
// ---------------------------------------------------------------------------

test("[FR-242 | 2.29 | Pending record is not a confirmation] a pending-action record alone leaves the guard denying", () => {
  const root = tempRoot();
  const pending = store.createPending({ pr: 42, verdict: "approve", sessionId: "s-guard-1" }, { root: root });
  assert.ok(pending && typeof pending.token === "string", "createPending returns a record with a token");
  assert.ok(fs.existsSync(path.join(root, ".agent", "governance", "confirmations", "pending.jsonl")), "pending.jsonl exists");
  assert.ok(isDenied(run("gh pr review 42 --approve", root)));
});

test("[FR-242 | 2.29 | Pending record is not a confirmation] a pending record that is marked used is still no confirmation", () => {
  const root = tempRoot();
  const pending = store.createPending({ pr: 42, verdict: "approve", sessionId: "s-guard-1" }, { root: root });
  store.markPendingUsed(pending, { root: root });
  assert.ok(isDenied(run("gh pr review 42 --approve", root)));
});

test("[FR-242 | 2.29 | Pending record is not a confirmation] a pending-style line written into confirmations.jsonl does not satisfy the guard", () => {
  // Forged: someone copies the pending record shape (with a token) into the confirmation file.
  const root = tempRoot();
  const pending = store.createPending({ pr: 42, verdict: "approve", sessionId: "s-guard-1" }, { root: root });
  fs.mkdirSync(path.dirname(confirmationsFile(root)), { recursive: true });
  fs.writeFileSync(confirmationsFile(root), JSON.stringify(pending) + "\n");
  assert.ok(isDenied(run("gh pr review 42 --approve", root)));
});

// ---------------------------------------------------------------------------
// Calls outside the guarded class
// ---------------------------------------------------------------------------

[
  "ls",
  "git status",
  "gh pr view 42",
  "gh pr diff 42",
  "bkt pr view 42",
  "echo \"gh pr review 42 --approve\"",
].forEach((command) => {
  test("[FR-214 | 2.1 | NFR-028 | Fail-closed on error] `" + command + "` is outside the guarded class and is not denied", () => {
    const root = tempRoot();
    assert.ok(!isDenied(run(command, root)), "not a verdict post: " + command);
  });
});

test("[FR-214 | 2.1 | Calls outside the class] a non-shell tool call is not denied", () => {
  const root = tempRoot();
  const doc = { hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "gh pr review 42 --approve" }, cwd: root };
  assert.ok(!isDenied(guard.evaluate(doc, { root: root })));
});

test("[FR-214 | 2.1 | Calls outside the class] malformed inputs (missing command, number, null) do not throw", () => {
  const root = tempRoot();
  [
    { tool_name: "Bash", tool_input: {} },
    { tool_name: "Bash", tool_input: { command: 42 } },
    { tool_name: "Bash", tool_input: { command: null } },
    { tool_name: "Bash" },
    {},
  ].forEach((doc) => {
    assert.doesNotThrow(() => guard.evaluate(doc, { root: root }));
  });
});

// ---------------------------------------------------------------------------
// FR-214 additive: pr-post-ask is unchanged and still asks
// ---------------------------------------------------------------------------

test("[FR-214 | 2.1 | Additive guard leaves the pr-post-ask prompt in place] after a recorded confirmation pr-post-ask still asks and never denies", () => {
  const root = tempRoot();
  confirm(root, 42, "approve");
  const doc = input("gh pr review 42 --approve", "Bash", root);
  assert.ok(!isDenied(guard.evaluate(doc, { root: root })), "the guard allows");
  const ask = askHook.evaluate(doc);
  assert.strictEqual(ask.ask, true, "pr-post-ask still asks");
  assert.notStrictEqual(ask.deny, true, "pr-post-ask never denies");
});

// ---------------------------------------------------------------------------
// The command entry (stdin JSON in, deny JSON out, exit 0)
// ---------------------------------------------------------------------------

function runEntry(doc, root, dataDir) {
  const env = Object.assign({}, process.env);
  ["CLAUDE_PLUGIN_ROOT", "CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA"].forEach((k) => delete env[k]);
  env.CLAUDE_PLUGIN_DATA = dataDir;
  return childProcess.spawnSync(process.execPath, [GUARD_ENTRY], {
    cwd: root,
    env: env,
    input: JSON.stringify(doc),
    encoding: "utf8",
    timeout: 30000,
  });
}

test("[FR-214 | 2.1 | Injected approval is denied] the command entry prints the PreToolUse deny JSON with exit 0 and no confirmation", () => {
  const root = tempRoot();
  const res = runEntry(input("gh pr review 42 --approve", "Bash", root), root, tempDir("pr-verdict-data-"));
  assert.strictEqual(res.status, 0, "exit 0; stderr: " + res.stderr);
  const out = JSON.parse(res.stdout);
  assert.strictEqual(out.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.strictEqual(out.hookSpecificOutput.permissionDecision, "deny");
  assert.ok(/confirm/i.test(out.hookSpecificOutput.permissionDecisionReason));
});

test("[FR-214 | 2.1 | Confirmed verdict posts] the command entry prints no deny after a recorded confirmation and logs the confirmation reference without command text", () => {
  const root = tempRoot();
  confirm(root, 42, "approve", "s-guard-1:777001");
  const dataDir = tempDir("pr-verdict-data-");
  const res = runEntry(input("gh pr review 42 --approve --body \"BODY-TEXT-MUST-NOT-BE-LOGGED\"", "Bash", root), root, dataDir);
  assert.strictEqual(res.status, 0, "exit 0; stderr: " + res.stderr);
  assert.ok(res.stdout.indexOf("\"deny\"") === -1, "no deny: " + res.stdout);
  const logFile = path.join(dataDir, "pr-verdict-log.jsonl");
  assert.ok(fs.existsSync(logFile), "the allow is logged");
  const log = fs.readFileSync(logFile, "utf8");
  assert.ok(log.indexOf("s-guard-1:777001") !== -1, "the log holds the confirmation reference: " + log);
  assert.ok(log.indexOf("BODY-TEXT-MUST-NOT-BE-LOGGED") === -1, "the log holds no command text [NFR-031]");
});

test("[FR-214 | 2.1 | Confirmation for a different verdict does not carry over] the command entry denies --request-changes when only approve is recorded", () => {
  const root = tempRoot();
  confirm(root, 42, "approve");
  const res = runEntry(input("gh pr review 42 --request-changes", "Bash", root), root, tempDir("pr-verdict-data-"));
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(JSON.parse(res.stdout).hookSpecificOutput.permissionDecision, "deny");
});

test("[FR-214 | 2.1 | NFR-028 | Fail-closed on error] the command entry lets `ls` through with exit 0", () => {
  const root = tempRoot();
  const res = runEntry(input("ls", "Bash", root), root, tempDir("pr-verdict-data-"));
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.indexOf("\"deny\"") === -1, res.stdout);
});
