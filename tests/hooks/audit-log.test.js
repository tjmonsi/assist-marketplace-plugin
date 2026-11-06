// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the audit-writer hook and for decision logging in the guard runtime
// (harness-governance Tranche 2, Step 12): plugins/assist-plugin/hooks/audit-log.js (command entry),
// plugins/assist-plugin/hooks/impl/audit-log.js (`evaluate(input, options)`, `EVENT`), and the guard entries that
// append a decision record after a deny or an ask (fsa-write-bar.js, pr-post-ask.js).
//
// Sources: specs/spec-hooks-audit.md (Requirements: Decision logging in every guard, Logging from the first session
// and logged disablement, Privacy of the audit record, Protected store) and docs/requirements/FR-NFR-harness-governance.md
// v1.3 (NFR-026, NFR-028, NFR-031, FR-224, FR-228, FR-245). Task plan: docs/task-plans/task-plan-harness-governance-
// 20261028-0759.md, Steps 12 and 20.
//
// Traceability format: [AC-N | spec file | FR/NFR ids | UR/BR ids]. The spec has no SPEC-NNN id, so it is cited by
// file name. AC-N is the position of the Scenario inside its Requirement in the spec:
//   Decision logging in every guard: AC-1 Deny logged, AC-2 Logging fails open
//   Logging from the first session and logged disablement: AC-1 Fresh install
//   Privacy of the audit record: AC-1 Secret kept out of the log
//   Protected store: AC-1 Subagent write denied
//
// Contract used:
//   - The hook entries read one JSON document on stdin and exit 0 on every path. A project root is the git root of the
//     input `cwd`, else the `cwd`; an input with no absolute `cwd` has no root.
//   - A log record for a governed action is {event: "tool-access", tool, path?, data_class?, agent_type?, agent_id?}
//     plus the library's ts and prev. A decision record holds the decision ("deny" or "ask"), a rule id, the tool name,
//     and the agent identity. Neither holds command text, prompt text, file contents, a tool result, or a secret.
//   - Logging fails open: a failed or refused append is noted in ${CLAUDE_PLUGIN_DATA}/hook-health.jsonl and changes
//     no decision. With no project root the note kind is "audit-no-root". Fail-open output is either nothing or one
//     {"systemMessage": ...} warning with exit 0 (the platform convention); it is never a deny or a block.
//
// Every project root is a temp directory with a .git directory; every data directory is a temp directory.
//
// Run: node --test tests/hooks/audit-log.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const PLUGIN = fx.PLUGIN;
const audit = fx.auditChain;
const auditLog = require(path.join(PLUGIN, "hooks", "impl", "audit-log.js"));
const writeBar = require(path.join(PLUGIN, "hooks", "impl", "fsa-write-bar.js"));

const R = "/assist-selftest/project";

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function postToolUse(root, extra) {
  return Object.assign(
    {
      hook_event_name: "PostToolUse",
      session_id: "sess-1",
      tool_name: "Write",
      tool_input: { file_path: path.join(root, "src", "app.js"), content: "const x = 1;\n" },
      tool_response: { success: true },
      cwd: root,
    },
    extra || {}
  );
}

function preToolUse(root, tool, toolInput, extra) {
  return Object.assign({ hook_event_name: "PreToolUse", session_id: "sess-1", tool_name: tool, tool_input: toolInput, cwd: root }, extra || {});
}

function subagent(agentType, id) {
  return { agent_type: agentType, agent_id: id || "agent-test-1" };
}

function decisionOf(res) {
  if (res.stdout.trim() === "") return null;
  return JSON.parse(res.stdout).hookSpecificOutput.permissionDecision;
}

// Fail-open output: nothing, or one systemMessage warning object. Never a deny, an ask, or a block.
function assertFailOpenOutput(res) {
  if (res.stdout.trim() === "") return;
  const out = JSON.parse(res.stdout);
  assert.deepStrictEqual(Object.keys(out), ["systemMessage"], "only a systemMessage warning: " + res.stdout);
  assert.strictEqual(typeof out.systemMessage, "string");
}

function recordsWhere(root, test) {
  return fx.readRecords(root).filter(test);
}

function keysOf(record) {
  return Object.keys(record);
}

function assertNoContent(text, needles) {
  needles.forEach((needle) => {
    assert.ok(text.indexOf(needle) === -1, "found " + JSON.stringify(needle) + " in: " + text.slice(0, 400));
  });
}

// ---------------------------------------------------------------------------
// The record the writer builds (pure)
// ---------------------------------------------------------------------------

test("[Requirement: Logging from the first session | spec-hooks-audit | FR-224 | FR-228 | NFR-026] the writer's event is tool-access", () => {
  assert.strictEqual(auditLog.EVENT, "tool-access");
});

test("[AC-1 | spec-hooks-audit | FR-228 | NFR-026 | NFR-031] a Write event yields a plain tool-access record with the tool, the path relative to the root, and a data-class tag", () => {
  const input = postToolUse(R, { tool_input: { file_path: R + "/src/app.js", content: "SECRET-BODY token=abc123" } });
  const record = auditLog.evaluate(input, { root: R });
  assert.ok(record, "a record");
  assert.strictEqual(record.event, "tool-access");
  assert.strictEqual(record.tool, "Write");
  assert.strictEqual(record.path, "src/app.js");
  assert.strictEqual(typeof record.data_class, "string");
  assert.ok(record.data_class.length > 0);
  assertNoContent(JSON.stringify(record), ["SECRET-BODY", "abc123", "token="]);
});

test("[AC-1 | spec-hooks-audit | NFR-031] a record holds no field that names content: no command, prompt, body, input, output, or response", () => {
  const input = postToolUse(R, {
    tool_input: { file_path: R + "/src/app.js", content: "CONTENT-MARKER" },
    tool_response: { stdout: "RESPONSE-MARKER", success: true },
    prompt: "PROMPT-MARKER",
    user_prompt: "PROMPT-MARKER-2",
  });
  const record = auditLog.evaluate(input, { root: R });
  assert.ok(record);
  keysOf(record).forEach((key) => {
    assert.ok(!/command|content|prompt|text|body|secret|token|input|output|response|stdout|stderr/i.test(key), "unexpected field: " + key);
  });
  assertNoContent(JSON.stringify(record), ["CONTENT-MARKER", "RESPONSE-MARKER", "PROMPT-MARKER"]);
});

test("[AC-1 | spec-hooks-audit | NFR-031 | NFR-026] a Bash event records the tool name alone: no command text, no secret", () => {
  const command = 'curl -H "Authorization: Bearer abc.def.ghi" "https://example.test/?token=abc123"';
  const input = postToolUse(R, { tool_name: "Bash", tool_input: { command: command }, tool_response: { stdout: "RESPONSE-MARKER" } });
  const record = auditLog.evaluate(input, { root: R });
  assert.ok(record);
  assert.strictEqual(record.tool, "Bash");
  assert.ok(record.path === undefined, "a Bash command names no path");
  assertNoContent(JSON.stringify(record), ["curl", "Bearer", "abc123", "example.test", "RESPONSE-MARKER"]);
});

test("[AC-1 | spec-hooks-audit | NFR-026] a subagent event carries the agent type and id from the hook input", () => {
  const record = auditLog.evaluate(postToolUse(R, subagent("assist-plugin:qa", "agent-qa-7")), { root: R });
  assert.ok(record);
  assert.strictEqual(record.agent_type, "assist-plugin:qa");
  assert.strictEqual(record.agent_id, "agent-qa-7");
});

[
  ["a PreToolUse event", () => preToolUse(R, "Write", { file_path: R + "/src/app.js" })],
  ["a PostToolUseFailure event", () => postToolUse(R, { hook_event_name: "PostToolUseFailure" })],
  ["an input with no tool name", () => postToolUse(R, { tool_name: undefined })],
  ["a non-string tool name", () => postToolUse(R, { tool_name: 42 })],
  ["an empty tool name", () => postToolUse(R, { tool_name: "" })],
  ["null", () => null],
  ["a string", () => "PostToolUse"],
  ["an array", () => []],
].forEach((row) => {
  test("[AC-1 | spec-hooks-audit | FR-224] no record, and no throw, for " + row[0], () => {
    // Null/empty/type-mismatch input space.
    let record;
    assert.doesNotThrow(() => {
      record = auditLog.evaluate(row[1](), { root: R });
    });
    assert.ok(record === null || record === undefined);
  });
});

test("[AC-1 | spec-hooks-audit | NFR-031] a hostile tool name is not copied into a record as a command", () => {
  const record = auditLog.evaluate(postToolUse(R, { tool_name: "Bash; rm -rf /" }), { root: R });
  assert.ok(record === null || record === undefined || JSON.stringify(record).indexOf("rm -rf") === -1);
});

// ---------------------------------------------------------------------------
// The hook entry: fresh install, secrets, chain
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-audit | FR-228 | FR-224 | NFR-026] fresh install: the first governed action creates the log with a record for that action, and the hook prints nothing", () => {
  const root = fx.tempRoot("audit-log-");
  assert.ok(!fs.existsSync(fx.logDir(root)), "set-up: no log yet");
  const res = fx.runHook("audit-log", postToolUse(root));
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(res.stdout, "", "the hook prints nothing");
  const records = fx.readRecords(root);
  assert.strictEqual(records.length, 1);
  assert.strictEqual(records[0].event, "tool-access");
  assert.strictEqual(records[0].tool, "Write");
  assert.strictEqual(records[0].path, "src/app.js");
  assert.strictEqual(records[0].prev, audit.GENESIS_HASH);
  assert.ok(Number.isFinite(Date.parse(records[0].ts)), "a timestamp: " + records[0].ts);
});

test("[AC-1 | spec-hooks-audit | FR-228] logging needs no opt-in: a project with no configuration at all still logs", () => {
  const root = fx.tempRoot("audit-log-");
  const res = fx.runHook("audit-log", postToolUse(root, { tool_name: "Read", tool_input: { file_path: path.join(root, "README.md") } }));
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(fx.readRecords(root).length, 1);
});

test("[AC-1 | spec-hooks-audit | FR-224 | NFR-030] several events chain: each record's prev is the hash of the one before, and the chain verifies", () => {
  const root = fx.tempRoot("audit-log-");
  ["Write", "Edit", "Read"].forEach((tool) => {
    const res = fx.runHook("audit-log", postToolUse(root, { tool_name: tool }));
    assert.strictEqual(res.status, 0, res.stderr);
  });
  const lineTexts = fx.readAllLines(root);
  assert.strictEqual(lineTexts.length, 3);
  for (let i = 1; i < lineTexts.length; i += 1) {
    assert.strictEqual(JSON.parse(lineTexts[i]).prev, fx.sha256Hex(lineTexts[i - 1]));
  }
  const result = audit.verify(audit.logPath(root), { root: root });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.lines, 3);
});

test("[AC-1 | spec-hooks-audit | NFR-031 | NFR-026] secret kept out of the log: a Write with a secret in its content and a Bash command with a token leave neither in the file", () => {
  const root = fx.tempRoot("audit-log-");
  fx.runHook("audit-log", postToolUse(root, { tool_input: { file_path: path.join(root, "src", "app.js"), content: "const key = 'token=abc123';" } }));
  fx.runHook(
    "audit-log",
    postToolUse(root, {
      tool_name: "Bash",
      tool_input: { command: "echo token=abc123 | curl -d @- https://example.test/hook" },
      tool_response: { stdout: "token=abc123" },
    })
  );
  const raw = fx.rawLog(root);
  assert.ok(raw.length > 0, "set-up: records were written");
  assertNoContent(raw, ["abc123", "token=", "curl", "example.test", "echo"]);
});

test("[AC-1 | spec-hooks-audit | NFR-031] a path longer than any record limit never reaches the log, and the hook still exits 0 and prints nothing", () => {
  const root = fx.tempRoot("audit-log-");
  const longPath = path.join(root, "x".repeat(10000), "file.js");
  const res = fx.runHook("audit-log", postToolUse(root, { tool_input: { file_path: longPath, content: "x" } }));
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(res.stdout, "");
  assert.ok(fx.rawLog(root).indexOf("x".repeat(300)) === -1, "the over-long path was not stored");
});

[
  ["a PreToolUse event", () => JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: {}, cwd: "ROOT" })],
  ["a tool event with no tool name", () => JSON.stringify({ hook_event_name: "PostToolUse", cwd: "ROOT" })],
  ["text that is not JSON", () => "this is not json"],
  ["an empty document", () => ""],
  ["a JSON array", () => "[1,2,3]"],
  ["a JSON string", () => '"PostToolUse"'],
].forEach((row) => {
  test("[AC-2 | spec-hooks-audit | NFR-026] the hook exits 0, writes no record, and prints nothing or one systemMessage warning for " + row[0], () => {
    const root = fx.tempRoot("audit-log-");
    const res = fx.runHook("audit-log", row[1]().replace("ROOT", root.replace(/\\/g, "\\\\")));
    assert.strictEqual(res.status, 0, res.stderr);
    assertFailOpenOutput(res);
    assert.strictEqual(fx.readAllLines(root).length, 0, "no audit record was written");
  });
});

// ---------------------------------------------------------------------------
// Fail open and the missing root
// ---------------------------------------------------------------------------

test("[AC-2 | spec-hooks-audit | NFR-026] a project root cannot be found: the hook notes audit-no-root in hook-health.jsonl, prints nothing, exits 0, and writes no log", () => {
  const cwdDir = fx.tempDir("audit-log-cwd-");
  const input = postToolUse("/unused");
  delete input.cwd;
  const res = fx.runHook("audit-log", input, { cwd: cwdDir });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(res.stdout, "");
  const notes = fx.readHealthLog(res.dataDir).filter((entry) => entry.kind === "audit-no-root");
  assert.ok(notes.length >= 1, "an audit-no-root note: " + JSON.stringify(fx.readHealthLog(res.dataDir)));
  assert.strictEqual(notes[0].hook, "audit-log");
  assert.ok(!fs.existsSync(path.join(cwdDir, ".agent")), "the process directory was not used as a root");
});

test("[AC-2 | spec-hooks-audit | NFR-026] a relative cwd is no root either: the same note, no log", () => {
  const cwdDir = fx.tempDir("audit-log-cwd-");
  const res = fx.runHook("audit-log", postToolUse("/unused", { cwd: "relative/dir" }), { cwd: cwdDir });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(res.stdout, "");
  assert.ok(fx.readHealthLog(res.dataDir).some((entry) => entry.kind === "audit-no-root"));
  assert.ok(!fs.existsSync(path.join(cwdDir, ".agent")));
});

test("[AC-2 | spec-hooks-audit | NFR-026] logging fails open: an unwritable log directory is noted in hook-health.jsonl, the hook prints nothing, exits 0, and the tool call is not blocked", () => {
  const root = fx.tempRoot("audit-log-");
  fs.writeFileSync(path.join(root, ".agent"), "not a directory");
  const res = fx.runHook("audit-log", postToolUse(root));
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(res.stdout, "");
  const notes = fx.readHealthLog(res.dataDir).filter((entry) => entry.hook === "audit-log");
  assert.ok(notes.length >= 1, "the failure is recorded in hook-health.jsonl: " + JSON.stringify(fx.readHealthLog(res.dataDir)));
});

test("[AC-2 | spec-hooks-audit | NFR-026 | NFR-031] a health-log note holds no command, secret, or path of the failed record", () => {
  const root = fx.tempRoot("audit-log-");
  fs.writeFileSync(path.join(root, ".agent"), "not a directory");
  const res = fx.runHook(
    "audit-log",
    postToolUse(root, { tool_name: "Bash", tool_input: { command: "echo token=abc123 > /tmp/secret-target-9" } })
  );
  assert.strictEqual(res.status, 0, res.stderr);
  const text = JSON.stringify(fx.readHealthLog(res.dataDir));
  assertNoContent(text, ["abc123", "secret-target-9", "echo"]);
});

// ---------------------------------------------------------------------------
// Decision logging in every guard (guard runtime)
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-audit | NFR-026 | FR-224 | UR-065] deny logged: a guard deny appends a decision record with a timestamp, the agent identity, the decision deny, and the rule id", () => {
  const root = fx.tempRoot("audit-guard-");
  const doc = preToolUse(root, "Write", { file_path: path.join(root, "DECISIONS.md"), content: "x" }, subagent("assist-plugin:developer", "agent-dev-1"));
  const res = fx.runHook("fsa-write-bar", doc);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(decisionOf(res), "deny");
  const denies = recordsWhere(root, (r) => r.decision === "deny");
  assert.strictEqual(denies.length, 1, JSON.stringify(fx.readRecords(root)));
  const record = denies[0];
  assert.ok(Number.isFinite(Date.parse(record.ts)), "timestamp: " + record.ts);
  assert.strictEqual(record.agent_id, "agent-dev-1");
  assert.strictEqual(record.agent_type, "assist-plugin:developer");
  assert.strictEqual(record.tool, "Write");
  assert.strictEqual(typeof record.rule_id, "string");
  assert.ok(record.rule_id.length > 0, "a rule id");
  assert.strictEqual(record.prev, audit.GENESIS_HASH);
});

test("[AC-1 | spec-hooks-audit | NFR-026 | NFR-031] a deny record names the path, not the file contents", () => {
  const root = fx.tempRoot("audit-guard-");
  const doc = preToolUse(root, "Write", { file_path: path.join(root, "DECISIONS.md"), content: "CONTENT-MARKER token=abc123" }, subagent("assist-plugin:developer"));
  const res = fx.runHook("fsa-write-bar", doc);
  assert.strictEqual(decisionOf(res), "deny");
  const raw = fx.rawLog(root);
  assert.ok(raw.length > 0);
  assertNoContent(raw, ["CONTENT-MARKER", "abc123"]);
});

test("[AC-1 | spec-hooks-audit | NFR-031 | NFR-026] secret kept out of the log: a denied command holding token=abc123 leaves a record with the rule id, decision, and tool name, and neither abc123 nor the command text", () => {
  const root = fx.tempRoot("audit-guard-");
  const command = 'echo "token=abc123" >> DECISIONS.md';
  const doc = preToolUse(root, "Bash", { command: command }, subagent("assist-plugin:developer", "agent-dev-2"));
  const res = fx.runHook("fsa-write-bar", doc);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(decisionOf(res), "deny");
  const denies = recordsWhere(root, (r) => r.decision === "deny");
  assert.strictEqual(denies.length, 1);
  assert.strictEqual(denies[0].tool, "Bash");
  assert.strictEqual(typeof denies[0].rule_id, "string");
  assertNoContent(fx.rawLog(root), ["abc123", "token=", "echo", ">> DECISIONS.md"]);
});

test("[AC-1 | spec-hooks-audit | NFR-026] an ask decision is logged too, with the decision ask, a rule id, and the tool name", () => {
  const root = fx.tempRoot("audit-guard-");
  const res = fx.runHook("pr-post-ask", preToolUse(root, "Bash", { command: "gh pr merge 42" }));
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(decisionOf(res), "ask");
  const asks = recordsWhere(root, (r) => r.decision === "ask");
  assert.strictEqual(asks.length, 1, JSON.stringify(fx.readRecords(root)));
  assert.strictEqual(asks[0].tool, "Bash");
  assert.strictEqual(typeof asks[0].rule_id, "string");
  assert.ok(asks[0].rule_id.length > 0);
  assertNoContent(fx.rawLog(root), ["gh pr merge", "42"]);
});

test("[AC-1 | spec-hooks-audit | NFR-026] an allow decision appends no decision record (only a deny or an ask is logged)", () => {
  const root = fx.tempRoot("audit-guard-");
  const doc = preToolUse(root, "Write", { file_path: path.join(root, "src", "app.js"), content: "x" }, subagent("assist-plugin:developer"));
  const res = fx.runHook("fsa-write-bar", doc);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(res.stdout, "");
  assert.strictEqual(recordsWhere(root, (r) => r.decision !== undefined).length, 0);
});

test("[AC-2 | spec-hooks-audit | NFR-026 | NFR-028] logging fails open: when the audit append fails, the deny stands unchanged and the failure goes to hook-health.jsonl", () => {
  const root = fx.tempRoot("audit-guard-");
  fs.writeFileSync(path.join(root, ".agent"), "not a directory");
  const doc = preToolUse(root, "Write", { file_path: path.join(root, "DECISIONS.md"), content: "x" }, subagent("assist-plugin:developer"));
  const res = fx.runHook("fsa-write-bar", doc);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(decisionOf(res), "deny", "the deny decision is unchanged");
  assert.ok(fx.readHealthLog(res.dataDir).length >= 1, "the failure is recorded in hook-health.jsonl");
});

test("[AC-2 | spec-hooks-audit | NFR-026] logging fails open: when the audit append fails, an ask decision stands unchanged", () => {
  const root = fx.tempRoot("audit-guard-");
  fs.writeFileSync(path.join(root, ".agent"), "not a directory");
  const res = fx.runHook("pr-post-ask", preToolUse(root, "Bash", { command: "gh pr merge 42" }));
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(decisionOf(res), "ask", "the ask decision is unchanged");
  assert.ok(fx.readHealthLog(res.dataDir).length >= 1, "the failure is recorded in hook-health.jsonl");
});

test("[AC-2 | spec-hooks-audit | NFR-026] a guard decision with no project root still stands, and the missing root is noted", () => {
  const doc = preToolUse("/unused", "Write", { file_path: "DECISIONS.md", content: "x" }, subagent("assist-plugin:developer"));
  delete doc.cwd;
  const res = fx.runHook("fsa-write-bar", doc);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(decisionOf(res), "deny");
  assert.ok(fx.readHealthLog(res.dataDir).some((entry) => entry.kind === "audit-no-root"), JSON.stringify(fx.readHealthLog(res.dataDir)));
});

test("[AC-1 | spec-hooks-audit | NFR-026 | NFR-028] a fail-closed deny is logged: when the Bash judge throws on a command that names a protected path, the runtime denies and appends a deny record", () => {
  const root = fx.tempRoot("audit-guard-");
  const doc = preToolUse(root, "Bash", { command: "echo x >> DECISIONS.md" }, subagent("assist-plugin:developer", "agent-dev-3"));
  const res = fx.runWithShellFault(doc);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(decisionOf(res), "deny", "fail-closed for the guarded class: " + res.stdout);
  const denies = recordsWhere(root, (r) => r.decision === "deny");
  assert.strictEqual(denies.length, 1, JSON.stringify(fx.readRecords(root)));
  assert.strictEqual(denies[0].tool, "Bash");
  assert.strictEqual(denies[0].agent_id, "agent-dev-3");
  assert.strictEqual(typeof denies[0].rule_id, "string");
  assertNoContent(fx.rawLog(root), ["echo", "DECISIONS.md >>"]);
});

test("[AC-1 | spec-hooks-audit | NFR-026] decision records chain with the writer's access records in one log", () => {
  const root = fx.tempRoot("audit-guard-");
  fx.runHook("audit-log", postToolUse(root));
  fx.runHook("fsa-write-bar", preToolUse(root, "Write", { file_path: path.join(root, "DECISIONS.md"), content: "x" }, subagent("assist-plugin:developer")));
  fx.runHook("audit-log", postToolUse(root, { tool_name: "Read", tool_input: { file_path: path.join(root, "README.md") } }));
  const result = audit.verify(audit.logPath(root), { root: root });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.lines, 3);
});

// ---------------------------------------------------------------------------
// Protected store (FR-245): the write bar denies subagent writes to the audit log
// ---------------------------------------------------------------------------

function bar(tool, toolInput, caller) {
  const input = Object.assign({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: toolInput, cwd: R }, caller || {});
  return writeBar.evaluate(input, { roots: [R], findGitRoot: () => R });
}

function denied(result) {
  return result !== null && result !== undefined && result.deny === true;
}

["Write", "Edit", "MultiEdit"].forEach((tool) => {
  test("[AC-1 | spec-hooks-audit | FR-245 | UR-065] a subagent " + tool + " of the audit log is denied", () => {
    const result = bar(tool, { file_path: R + "/.agent/logs/governance/audit.jsonl", content: "{}" }, subagent("general-purpose"));
    assert.ok(denied(result), JSON.stringify(result));
  });
});

test("[AC-1 | spec-hooks-audit | FR-245 | UR-065] a subagent NotebookEdit of the audit log is denied", () => {
  const result = bar("NotebookEdit", { notebook_path: R + "/.agent/logs/governance/audit.jsonl" }, subagent("general-purpose"));
  assert.ok(denied(result), JSON.stringify(result));
});

[
  R + "/.agent/logs/governance/audit-000001.jsonl",
  R + "/.agent/logs/governance/audit.lock",
  R + "/src/../.agent/logs/governance/audit.jsonl",
  ".agent/logs/governance/audit.jsonl",
].forEach((target) => {
  test("[AC-1 | spec-hooks-audit | FR-245] a subagent write is denied anywhere under .agent/logs/governance/: " + target.replace(R, "<root>"), () => {
    const result = bar("Write", { file_path: target, content: "{}" }, subagent("assist-plugin:worker"));
    assert.ok(denied(result), JSON.stringify(result));
  });
});

test("[AC-1 | spec-hooks-audit | FR-245] a similar path outside the governance log directory is not protected by this rule", () => {
  const result = bar("Write", { file_path: R + "/.agent/logs/other/app.log", content: "x" }, subagent("assist-plugin:worker"));
  assert.ok(!denied(result), JSON.stringify(result));
});

test("[AC-1 | spec-hooks-audit | FR-245] a read of the audit log by a subagent is not judged", () => {
  const input = { hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: R + "/.agent/logs/governance/audit.jsonl" }, cwd: R };
  assert.ok(!denied(writeBar.evaluate(Object.assign(input, subagent("general-purpose")), { roots: [R], findGitRoot: () => R })));
});

test("[AC-1 | spec-hooks-audit | FR-245 | FR-224] the library writes the log with fs, so the tool-level deny does not stop the audit-writer hook", () => {
  const root = fx.tempRoot("audit-log-");
  const res = fx.runHook("audit-log", postToolUse(root, subagent("general-purpose")));
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(fx.readRecords(root).length, 1);
});
