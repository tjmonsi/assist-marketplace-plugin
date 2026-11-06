// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the FERPA internal access log and the HIPAA agent-level audit log (harness-governance
// Tranche 3, Step 30): the command entry plugins/assist-plugin/hooks/data-access-log.js, run as a PreToolUse hook with
// one JSON document on stdin, and the attributed records it appends to .agent/logs/governance/audit.jsonl.
//
// Sources: docs/requirements/FR-NFR-harness-governance.md section 2.17 (FR-230: Access with purpose, Access without
// purpose), section 2.19 (FR-232: Agent action logged, Unidentified actor), section 2.14 (FR-227: the five attribution
// fields), NFR-026, NFR-028, NFR-031, NFR-033; specs/spec-hooks-compliance.md, "Requirement: FERPA internal access log" and
// "Requirement: HIPAA agent-level audit log"; plugins/assist-plugin/rules/assist-plugin-rule.md, "Governance profiles"
// and "Session purpose". Task plan: docs/task-plans/task-plan-harness-governance-20261028-0759.md, Steps 25, 26, and 30.
//
// Traceability format: [AC-N | Requirement | spec-hooks-compliance | FR-nnn | UR-nnn | BR-020]. The spec carries no
// SPEC-NNN id, so it is cited by file name. AC-N is the position of the Scenario inside its Requirement:
//   FERPA internal access log: AC-1 Access with purpose, AC-2 Access without purpose
//   HIPAA agent-level audit log: AC-1 Agent action logged, AC-2 Unidentified actor
//
// Contract used (documented behavior; the hook implementation is never read):
//   - Hook input {hook_event_name: "PreToolUse", session_id, tool_name, tool_input, cwd, agent_type?, agent_id?}. The
//     hook covers Read, Grep, Glob, Write, Edit, MultiEdit, and NotebookEdit. It exits 0 and never denies.
//   - An access to a path that .agent/governance/profile.json tags `student-record` (while FERPA is enforced) or `PHI`
//     (while HIPAA is enforced) appends one attributed record to the audit log: the operation, the path and the data
//     class tag (`data_class`), the agent identity (`agent_type`, `agent_id`), the human authorizer (`authorizer`, plus
//     `authorizer_reason` for none), the timestamp (`ts`), and the purpose, which is the declared purpose of the session
//     purpose record or `unstated`, and a review flag when the purpose is `unstated`. A record that carries an
//     `operation` field is an attributed access record.
//   - An access to an untagged path, a shell read, a PostToolUse event, and an access while the profile is opted out in
//     the committed settings append nothing. With no profile.json nothing is tagged.
//   - The log holds a path and a tag only, never file contents, prompt text, or a secret (NFR-031).
//
// Every project root is a temp directory with a .git directory.
//
// Run: node --test tests/hooks/data-access-log.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const SESSION = "sess-access-1";
const FLAG = "ASSIST_PLUGIN_COMPLIANCE_OPT_OUT";
const PURPOSE = "review grading anomalies";

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROFILE = { data_classes: { "student-record": ["records/**"], PHI: ["data/patients*.csv"] } };

function writeFile(root, relative, text) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof text === "string" ? text : JSON.stringify(text));
  return file;
}

// options: {profile: object | string | null (absent), settings: object, purpose: string | null}.
function makeRoot(options) {
  const opts = options || {};
  const root = fx.tempRoot("data-access-");
  if (opts.profile !== null) writeFile(root, ".agent/governance/profile.json", opts.profile === undefined ? PROFILE : opts.profile);
  if (opts.settings !== undefined) writeFile(root, ".claude/settings.json", opts.settings);
  if (opts.purpose) {
    // The user declares the purpose in their own message; the purpose-capture hook is the only writer of the record.
    const res = fx.runHook("purpose-capture", { hook_event_name: "UserPromptSubmit", session_id: SESSION, prompt: "Purpose: " + opts.purpose, cwd: root });
    assert.strictEqual(res.status, 0, res.stderr);
  }
  return root;
}

function optOut(value) {
  const env = {};
  env[FLAG] = value;
  return { env: env };
}

function doc(root, tool, toolInput, extra) {
  return Object.assign({ hook_event_name: "PreToolUse", session_id: SESSION, tool_name: tool, tool_input: toolInput, cwd: root }, extra || {});
}

function readDoc(root, relative, extra) {
  return doc(root, "Read", { file_path: path.join(root, relative) }, extra);
}

const SUBAGENT = { agent_type: "developer", agent_id: "agent-dev-1" };

function run(input) {
  return fx.runHook("data-access-log", input);
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

function assertNeverDenies(res) {
  assert.strictEqual(res.error, undefined, "spawn error: " + (res.error && res.error.message));
  assert.strictEqual(res.status, 0, "exit 0; stderr: " + res.stderr);
  assert.ok(!isDeny(res), "the access log never denies; stdout: " + res.stdout);
}

function accessRecords(root) {
  return fx.readRecords(root).filter((record) => record.operation !== undefined);
}

function textOf(record) {
  return JSON.stringify(record);
}

// The review flag: some field named for a flag or a review holds a truthy value.
function isFlagged(record) {
  return Object.keys(record).some((key) => /flag|review/i.test(key) && record[key]);
}

function assertFiveFields(record) {
  assert.strictEqual(typeof record.operation, "string", "operation");
  assert.ok(record.operation.length > 0);
  assert.strictEqual(typeof record.path, "string", "path");
  assert.strictEqual(typeof record.data_class, "string", "data-class tag");
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
// FR-230 AC-1: a student-record access with a purpose
// ---------------------------------------------------------------------------

test("[AC-1 | FERPA internal access log | spec-hooks-compliance | FR-230 | UR-068 | BR-020] a read of a student-record-tagged path logs the five attribution fields and the purpose from the session purpose record", () => {
  const root = makeRoot({ purpose: PURPOSE });
  const res = run(readDoc(root, "records/grades.csv", SUBAGENT));
  assertNeverDenies(res);
  const stored = accessRecords(root);
  assert.strictEqual(stored.length, 1, JSON.stringify(fx.readRecords(root)));
  assertFiveFields(stored[0]);
  assert.ok(stored[0].path.endsWith("records/grades.csv"), stored[0].path);
  assert.strictEqual(stored[0].data_class, "student-record");
  assert.strictEqual(stored[0].agent_type, "developer");
  assert.strictEqual(stored[0].agent_id, "agent-dev-1");
  assert.ok(textOf(stored[0]).indexOf(PURPOSE) !== -1, "the record holds the declared purpose: " + textOf(stored[0]));
  assert.ok(textOf(stored[0]).indexOf("unstated") === -1);
  assert.ok(!isFlagged(stored[0]), "a record with a stated purpose needs no review flag: " + textOf(stored[0]));
});

["Read", "Write", "Edit", "MultiEdit"].forEach((tool) => {
  test("[AC-1 | FERPA internal access log | spec-hooks-compliance | FR-230 | UR-068] a " + tool + " of a student-record path is logged with an operation, the path, and the tag", () => {
    const root = makeRoot({ purpose: PURPOSE });
    const res = run(doc(root, tool, { file_path: path.join(root, "records", "grades.csv"), content: "x", old_string: "a", new_string: "b", edits: [] }, SUBAGENT));
    assertNeverDenies(res);
    const stored = accessRecords(root);
    assert.strictEqual(stored.length, 1, tool + ": " + JSON.stringify(fx.readRecords(root)));
    assertFiveFields(stored[0]);
    assert.strictEqual(stored[0].data_class, "student-record");
  });
});

test("[AC-1 | FERPA internal access log | spec-hooks-compliance | FR-230] a NotebookEdit of a student-record path is logged", () => {
  const root = makeRoot({ purpose: PURPOSE });
  const res = run(doc(root, "NotebookEdit", { notebook_path: path.join(root, "records", "analysis.ipynb"), new_source: "x" }, SUBAGENT));
  assertNeverDenies(res);
  const stored = accessRecords(root);
  assert.strictEqual(stored.length, 1, JSON.stringify(fx.readRecords(root)));
  assert.strictEqual(stored[0].data_class, "student-record");
});

test("[AC-1 | FERPA internal access log | spec-hooks-compliance | FR-230] a Grep of a student-record-tagged directory is logged", () => {
  const root = makeRoot({ purpose: PURPOSE });
  const res = run(doc(root, "Grep", { pattern: "grade", path: path.join(root, "records", "term1") }, SUBAGENT));
  assertNeverDenies(res);
  assert.strictEqual(accessRecords(root).length, 1, JSON.stringify(fx.readRecords(root)));
});

test("[AC-1 | FERPA internal access log | spec-hooks-compliance | FR-230 | BR-020] a main-session access is logged with the identity main-session", () => {
  const root = makeRoot({ purpose: PURPOSE });
  assertNeverDenies(run(readDoc(root, "records/grades.csv")));
  const stored = accessRecords(root);
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].agent_type, "main-session");
});

test("[AC-1 | FERPA internal access log | spec-hooks-compliance | FR-230 | NFR-026] the access records chain, and the chain verifies", () => {
  const root = makeRoot({ purpose: PURPOSE });
  for (let i = 0; i < 4; i += 1) assertNeverDenies(run(readDoc(root, "records/grades-" + i + ".csv", SUBAGENT)));
  assert.strictEqual(accessRecords(root).length, 4);
  const result = fx.auditChain.verify(fx.auditChain.logPath(root), { root: root });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
});

// ---------------------------------------------------------------------------
// FR-230 AC-2: a student-record access without a purpose is unstated, flagged, and not denied
// ---------------------------------------------------------------------------

test("[AC-2 | FERPA internal access log | spec-hooks-compliance | FR-230 | UR-068 | BR-020] with no session purpose record the access logs unstated, the record is flagged, and the read is not denied", () => {
  const root = makeRoot();
  const res = run(readDoc(root, "records/grades.csv", SUBAGENT));
  assertNeverDenies(res);
  const stored = accessRecords(root);
  assert.strictEqual(stored.length, 1, JSON.stringify(fx.readRecords(root)));
  assertFiveFields(stored[0]);
  assert.ok(textOf(stored[0]).indexOf("unstated") !== -1, "the purpose reads unstated: " + textOf(stored[0]));
  assert.ok(isFlagged(stored[0]), "the record is flagged for review: " + textOf(stored[0]));
});

test("[AC-2 | FERPA internal access log | spec-hooks-compliance | FR-230 | UR-068] a missing purpose is never a reason to deny: every covered tool is allowed", () => {
  const root = makeRoot();
  [
    doc(root, "Read", { file_path: path.join(root, "records", "grades.csv") }),
    doc(root, "Write", { file_path: path.join(root, "records", "out.csv"), content: "x" }),
    doc(root, "Edit", { file_path: path.join(root, "records", "grades.csv"), old_string: "a", new_string: "b" }),
    doc(root, "Grep", { pattern: "x", path: path.join(root, "records") }),
    doc(root, "Glob", { pattern: "**/*.csv", path: path.join(root, "records") }),
  ].forEach((input) => assertNeverDenies(run(input)));
});

test("[AC-2 | FERPA internal access log | spec-hooks-compliance | FR-230] a purpose recorded for another session reads unstated for this one", () => {
  const root = makeRoot({ purpose: PURPOSE });
  const res = run(readDoc(root, "records/grades.csv", Object.assign({}, SUBAGENT, { session_id: "sess-other-9" })));
  assertNeverDenies(res);
  const stored = accessRecords(root);
  assert.strictEqual(stored.length, 1);
  assert.ok(textOf(stored[0]).indexOf(PURPOSE) === -1, "another session's purpose labeled this access: " + textOf(stored[0]));
  assert.ok(textOf(stored[0]).indexOf("unstated") !== -1);
  assert.ok(isFlagged(stored[0]));
});

test("[AC-2 | FERPA internal access log | spec-hooks-compliance | FR-230 | FR-247] a purpose file made by hand (not written by the hook) is no purpose: the access logs unstated", () => {
  const root = makeRoot();
  writeFile(root, ".agent/governance/session-purpose.json", { purpose: "approved audit", writer: "model", session_id: SESSION, timestamp: "2026-11-06T09:30:00.000Z" });
  assertNeverDenies(run(readDoc(root, "records/grades.csv", SUBAGENT)));
  const stored = accessRecords(root);
  assert.strictEqual(stored.length, 1);
  assert.ok(textOf(stored[0]).indexOf("approved audit") === -1, "a forged purpose reached the log: " + textOf(stored[0]));
  assert.ok(textOf(stored[0]).indexOf("unstated") !== -1);
});

// ---------------------------------------------------------------------------
// FR-232 AC-1: a PHI-tagged path logs one record per agent action
// ---------------------------------------------------------------------------

test("[AC-1 | HIPAA agent-level audit log | spec-hooks-compliance | FR-232 | UR-069 | BR-020] a subagent's read of a PHI-tagged path logs a record that names the subagent, the path, and the purpose", () => {
  const root = makeRoot({ purpose: PURPOSE });
  const res = run(readDoc(root, "data/patients.csv", SUBAGENT));
  assertNeverDenies(res);
  const stored = accessRecords(root);
  assert.strictEqual(stored.length, 1, JSON.stringify(fx.readRecords(root)));
  assertFiveFields(stored[0]);
  assert.strictEqual(stored[0].data_class, "PHI");
  assert.strictEqual(stored[0].agent_type, "developer");
  assert.strictEqual(stored[0].agent_id, "agent-dev-1");
  assert.ok(stored[0].path.endsWith("data/patients.csv"), stored[0].path);
  assert.ok(textOf(stored[0]).indexOf(PURPOSE) !== -1, textOf(stored[0]));
});

test("[AC-1 | HIPAA agent-level audit log | spec-hooks-compliance | FR-232 | UR-069] with no purpose record a PHI access logs unstated and is flagged", () => {
  const root = makeRoot();
  assertNeverDenies(run(readDoc(root, "data/patients.csv", SUBAGENT)));
  const stored = accessRecords(root);
  assert.strictEqual(stored.length, 1);
  assert.ok(textOf(stored[0]).indexOf("unstated") !== -1);
  assert.ok(isFlagged(stored[0]), textOf(stored[0]));
});

test("[AC-1 | HIPAA agent-level audit log | spec-hooks-compliance | FR-232 | UR-069] one record per agent action: three actions leave three records, one action leaves one", () => {
  // Boundary: not per session, not per inference call, not duplicated.
  const root = makeRoot({ purpose: PURPOSE });
  assertNeverDenies(run(readDoc(root, "data/patients.csv", SUBAGENT)));
  assert.strictEqual(accessRecords(root).length, 1, "one action, one record");
  assertNeverDenies(run(readDoc(root, "data/patients.csv", SUBAGENT)));
  assertNeverDenies(run(doc(root, "Edit", { file_path: path.join(root, "data", "patients.csv"), old_string: "a", new_string: "b" }, SUBAGENT)));
  const stored = accessRecords(root);
  assert.strictEqual(stored.length, 3, "three actions, three records: " + JSON.stringify(stored));
  assert.deepStrictEqual(stored.map((r) => r.agent_id), ["agent-dev-1", "agent-dev-1", "agent-dev-1"]);
});

test("[AC-1 | HIPAA agent-level audit log | spec-hooks-compliance | FR-232 | UR-069] each record is readable for review: path, agent identity, and timestamp are present on the line", () => {
  const root = makeRoot({ purpose: PURPOSE });
  assertNeverDenies(run(readDoc(root, "data/patients.csv", SUBAGENT)));
  const lines = fx.readAllLines(root);
  const line = lines.filter((l) => JSON.parse(l).operation !== undefined)[0];
  const record = JSON.parse(line);
  assert.ok(record.path && record.agent_type && record.ts, line);
  assert.ok(!line.includes("\n"), "one record, one line");
});

test("[AC-1 | HIPAA agent-level audit log | spec-hooks-compliance | FR-232 | UR-069] a path that matches both classes is logged as PHI", () => {
  const root = makeRoot({ profile: { data_classes: { "student-record": ["shared/**"], PHI: ["shared/*.csv"] } } });
  assertNeverDenies(run(readDoc(root, "shared/both.csv", SUBAGENT)));
  const stored = accessRecords(root);
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].data_class, "PHI");
});

// ---------------------------------------------------------------------------
// FR-232 AC-2: an actor that cannot be identified is logged as unidentified
// ---------------------------------------------------------------------------

test("[AC-2 | HIPAA agent-level audit log | spec-hooks-compliance | FR-232 | UR-069 | BR-020] an action whose actor cannot be established logs the identity unidentified", () => {
  const root = makeRoot({ purpose: PURPOSE });
  const res = run(readDoc(root, "data/patients.csv", { agent_id: { not: "a string" }, agent_type: "developer" }));
  assertNeverDenies(res);
  const stored = accessRecords(root);
  assert.strictEqual(stored.length, 1, JSON.stringify(fx.readRecords(root)));
  assert.strictEqual(stored[0].agent_type, "unidentified");
});

// ---------------------------------------------------------------------------
// No record: untagged, opted out, no profile, shell reads, wrong event
// ---------------------------------------------------------------------------

[
  ["a source file", "src/app.js"],
  ["a path next to a tagged directory", "records-old/grades.csv"],
  ["a file that only looks like a PHI file", "data/patients.csv.bak"],
  ["the profile itself", ".agent/governance/profile.json"],
].forEach((row) => {
  test("[AC-1 | FERPA internal access log | spec-hooks-compliance | FR-230 | FR-232] an access to an untagged path (" + row[0] + ") appends no access record", () => {
    const root = makeRoot({ purpose: PURPOSE });
    const res = run(readDoc(root, row[1], SUBAGENT));
    assertNeverDenies(res);
    assert.strictEqual(accessRecords(root).length, 0, JSON.stringify(fx.readRecords(root)));
  });
});

test("[AC-1 | FERPA internal access log | spec-hooks-compliance | FR-230 | NFR-028] with no profile.json nothing is tagged: no access record, and no deny", () => {
  const root = makeRoot({ profile: null, purpose: PURPOSE });
  const res = run(readDoc(root, "records/grades.csv", SUBAGENT));
  assertNeverDenies(res);
  assert.strictEqual(accessRecords(root).length, 0);
});

test("[AC-1 | FERPA internal access log | spec-hooks-compliance | FR-230 | FR-243] while FERPA is opted out in the committed settings a student-record access is not logged", () => {
  const root = makeRoot({ settings: optOut("ferpa"), purpose: PURPOSE });
  assertNeverDenies(run(readDoc(root, "records/grades.csv", SUBAGENT)));
  assert.strictEqual(accessRecords(root).length, 0);
});

test("[AC-1 | HIPAA agent-level audit log | spec-hooks-compliance | FR-232 | FR-243] while HIPAA is opted out in the committed settings a PHI access is not logged, and a student-record access still is", () => {
  const root = makeRoot({ settings: optOut("hipaa"), purpose: PURPOSE });
  assertNeverDenies(run(readDoc(root, "data/patients.csv", SUBAGENT)));
  assert.strictEqual(accessRecords(root).length, 0);
  assertNeverDenies(run(readDoc(root, "records/grades.csv", SUBAGENT)));
  assert.strictEqual(accessRecords(root).length, 1);
});

test("[AC-1 | FERPA internal access log | spec-hooks-compliance | FR-230] a shell read of a student-record path is not seen: no record (a recorded known limit)", () => {
  const root = makeRoot({ purpose: PURPOSE });
  const res = run(doc(root, "Bash", { command: "cat records/grades.csv" }, SUBAGENT));
  assertNeverDenies(res);
  assert.strictEqual(accessRecords(root).length, 0);
});

test("[AC-1 | FERPA internal access log | spec-hooks-compliance | FR-230] a PostToolUse event appends no access record: the log is written once, before the access", () => {
  const root = makeRoot({ purpose: PURPOSE });
  const input = readDoc(root, "records/grades.csv", SUBAGENT);
  input.hook_event_name = "PostToolUse";
  input.tool_response = { success: true };
  assertNeverDenies(run(input));
  assert.strictEqual(accessRecords(root).length, 0);
});

// ---------------------------------------------------------------------------
// Never denies; odd input
// ---------------------------------------------------------------------------

[
  ["tool_input absent", () => ({ hook_event_name: "PreToolUse", tool_name: "Read" })],
  ["tool_input null", (root) => doc(root, "Read", null)],
  ["file_path a number", (root) => doc(root, "Read", { file_path: 42 })],
  ["file_path an object", (root) => doc(root, "Read", { file_path: { a: 1 } })],
  ["file_path empty", (root) => doc(root, "Read", { file_path: "" })],
  ["a relative cwd", () => ({ hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "records/grades.csv" }, cwd: "relative/dir" })],
  ["tool name not a string", (root) => doc(root, 42, { file_path: path.join(root, "records", "grades.csv") })],
].forEach((row) => {
  test("[AC-1 | FERPA internal access log | spec-hooks-compliance | FR-230 | NFR-028] odd input (" + row[0] + ") exits 0, never denies, and prints nothing or one JSON document", () => {
    // Null, empty, and type-mismatch input space.
    const root = makeRoot();
    const res = run(row[1](root));
    assertNeverDenies(res);
    if (res.stdout.trim() !== "") JSON.parse(res.stdout);
  });
});

[
  ["empty stdin", ""],
  ["text that is not JSON", "this is not json"],
  ["an unterminated object", "{"],
  ["JSON null", "null"],
].forEach((row) => {
  test("[AC-1 | FERPA internal access log | spec-hooks-compliance | FR-230 | NFR-028] unreadable stdin (" + row[0] + ") lets the call proceed and exits 0", () => {
    assertNeverDenies(run(row[1]));
  });
});

test("[AC-2 | FERPA internal access log | spec-hooks-compliance | FR-230 | NFR-026] a log that cannot be written fails open: the access is not denied", () => {
  const root = makeRoot({ purpose: PURPOSE });
  // .agent/logs is a file, so the governance log directory cannot be created.
  writeFile(root, ".agent/logs", "not a directory");
  const res = run(readDoc(root, "records/grades.csv", SUBAGENT));
  assertNeverDenies(res);
});

// ---------------------------------------------------------------------------
// NFR-031: no file contents, prompt text, or secret in the log
// ---------------------------------------------------------------------------

test("[AC-1 | FERPA internal access log | spec-hooks-compliance | FR-230 | FR-232 | NFR-031] the log holds a path and a tag only: no file contents, prompt text, command text, or secret", () => {
  const root = makeRoot({ purpose: PURPOSE });
  writeFile(root, "records/grades.csv", "student,grade\nFILE-CONTENT-MARKER-al,A\n");
  const input = doc(
    root,
    "Write",
    { file_path: path.join(root, "records", "grades.csv"), content: "FILE-CONTENT-MARKER-al token=abc123 SECRET-BODY" },
    Object.assign({ prompt: "PROMPT-MARKER-al please read the grades", tool_response: "RESULT-MARKER-al" }, SUBAGENT)
  );
  assertNeverDenies(run(input));
  const raw = fx.rawLog(root);
  assert.ok(raw.length > 0, "set-up: a record was written");
  assertNoContent(raw, ["FILE-CONTENT-MARKER-al", "PROMPT-MARKER-al", "RESULT-MARKER-al", "abc123", "token=", "SECRET-BODY", "student,grade"]);
  accessRecords(root).forEach((record) => {
    Object.keys(record).forEach((key) => {
      assert.ok(!/command|content|prompt|text|body|secret|token|input|output|response|stdout|stderr/i.test(key), "unexpected field: " + key);
    });
  });
});

test("[AC-1 | HIPAA agent-level audit log | spec-hooks-compliance | FR-232 | NFR-031] a PHI value in a file name's neighbor or in the purpose line does not reach the log beyond the declared purpose", () => {
  const root = makeRoot();
  const res = fx.runHook("purpose-capture", { hook_event_name: "UserPromptSubmit", session_id: SESSION, prompt: "Purpose: " + PURPOSE + "\n\nPatient John Doe MRN-1234567 asked for the file", cwd: root });
  assert.strictEqual(res.status, 0, res.stderr);
  assertNeverDenies(run(readDoc(root, "data/patients.csv", SUBAGENT)));
  assertNoContent(fx.rawLog(root), ["John Doe", "MRN-1234567", "asked for the file"]);
});
