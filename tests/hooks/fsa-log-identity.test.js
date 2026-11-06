// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the subagent log fsa-log.jsonl (harness-governance Tranche 3, Step 30): the rows carry
// the agent identity and the human authorizer and no operation or data-accessed field, and the 500-line cap is replaced by
// size-based rotation that carries the prior segment's final chain hash. The command entry is
// plugins/assist-plugin/hooks/fsa-log.js, run as a SubagentStop or PostToolUse hook with one JSON document on stdin.
//
// Sources: docs/requirements/FR-NFR-harness-governance.md section 2.14 (FR-227: Complete record, the fsa-log.jsonl row
// holds identity and authorizer only), NFR-031, NFR-032; specs/spec-hooks-audit.md, Change Log 2026-11-06 (Tranche 3),
// "Requirement: Subagent log carries identity and authorizer" (Scenarios: Report row carries identity and authorizer,
// Size-based rotation replaces the line cap) and "Requirement: Size-based rotation with retention"; specs/spec-hooks-fsa-log.md
// (the report sources, the record fields, the privacy rule). Task plan: docs/task-plans/task-plan-harness-governance-
// 20261028-0759.md, Steps 22 and 30.
//
// Traceability format: [AC-N | Requirement | spec-hooks-audit | FR-227 | NFR-032 | NFR-031 | UR-066 | BR-020]. The spec
// carries no SPEC-NNN id. AC-N is the position of the Scenario inside its Requirement:
//   Subagent log carries identity and authorizer: AC-1 Report row carries identity and authorizer, AC-2 Size-based
//   rotation replaces the line cap
//
// Contract used (the spec and the library header; the hook implementation is never read):
//   - A real subagent event names its agent with the plugin prefix: agent_type "assist-plugin:developer-tester". The hook
//     maps that name to the agent's transition table; an unprefixed name maps to no agent and writes no row.
//   - SubagentStop input {hook_event_name, session_id, agent_type, agent_id, last_assistant_message, cwd}; a
//     SubagentHandback PostToolUse input carries the report in tool_input.message. The hook checks the last `fsa` terminal
//     block of the report and appends one chained row to ${CLAUDE_PLUGIN_DATA}/fsa-log.jsonl.
//   - The row adds `agent_type`, `agent_id` (the agent identity) and `authorizer` (plus `authorizer_reason` when it reads
//     none). It holds no operation and no data-accessed field, and never the report text.
//   - The authorizer resolves the newest plan under <root>/.agent/main-plan/ whose "**Status:**" line reads Approved or
//     In Progress and whose "## User Decisions" section holds a "- Approved: YYYY-MM-DD HH:mm" bullet, as a reference
//     "plan-approval:<plan file>@<time>".
//   - The log is a chained store named fsa-log under the plugin data directory: rotated segments are fsa-log-NNNNNN.jsonl.
//     When the current segment reaches the rotation size (ROTATION_BYTES of lib/audit-chain.js) a new segment starts whose
//     first line holds the old segment's final chain hash in `prev` (the SHA-256 of the exact text of its last line).
//     There is no line cap. Segments younger than 12 months (RETENTION_MS) are never deleted.
//
// Every data directory and project root is a temp directory.
//
// Run: node --test tests/hooks/fsa-log-identity.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const audit = fx.auditChain;
const DAY = 24 * 60 * 60 * 1000;
const PLAN_NAME = "plan-fsa-identity-20261106";
const SENTINEL = "SENTINEL-7731";
const AGENT_TYPE = "assist-plugin:developer-tester";

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function report(extra) {
  const fields = Object.assign(
    {
      fsa: "developer-tester/1",
      state: "Done",
      trace: "Intake > AssembleContext > PlanCoverage > CheckCoverage > WriteTests > SelfCheck > Done",
      artifact: "tests/auth/login.test.ts",
      verdict: "covered=7 uncovered=1",
      skipped: "compile not-run (skipped)",
      out_of_scope: "none",
      error_class: "none",
      questions: "none",
      resume_at: "none",
    },
    extra || {}
  );
  const block = Object.keys(fields).map((key) => key + ": " + fields[key]);
  return ["Tests written for the login feature. " + SENTINEL + " is the report marker.", "", "```fsa"].concat(block, ["```", ""]).join("\n");
}

function stopDoc(root, extra) {
  return Object.assign(
    {
      hook_event_name: "SubagentStop",
      session_id: "sess-fsa-1",
      agent_type: AGENT_TYPE,
      agent_id: "agent-dt-1",
      last_assistant_message: report(),
      cwd: root,
    },
    extra || {}
  );
}

function handbackDoc(root, extra) {
  return Object.assign(
    {
      hook_event_name: "PostToolUse",
      tool_name: "SubagentHandback",
      session_id: "sess-fsa-1",
      agent_type: AGENT_TYPE,
      agent_id: "agent-dt-2",
      tool_input: { message: report() },
      tool_response: {},
      cwd: root,
    },
    extra || {}
  );
}

function run(doc, dataDir) {
  const res = fx.runHook("fsa-log", doc, { dataDir: dataDir });
  assert.strictEqual(res.status, 0, "exit 0; stderr: " + res.stderr);
  return res;
}

function segmentFiles(dataDir) {
  const names = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter((name) => /^fsa-log(-\d{6})?\.jsonl$/.test(name)) : [];
  const rotated = names.filter((name) => name !== "fsa-log.jsonl").sort();
  const ordered = rotated.slice();
  if (names.indexOf("fsa-log.jsonl") !== -1) ordered.push("fsa-log.jsonl");
  return { rotated: rotated, ordered: ordered.map((name) => path.join(dataDir, name)) };
}

function allLines(dataDir) {
  let lines = [];
  segmentFiles(dataDir).ordered.forEach((file) => {
    lines = lines.concat(fx.readLines(file));
  });
  return lines;
}

function rows(dataDir) {
  return allLines(dataDir).map((line) => JSON.parse(line));
}

function writeFile(root, relative, text) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
}

// The plan /do writes at approval, in the format the authorizer reads: a Status line of Approved and, under the
// "## User Decisions" heading, the bullet "- Approved: YYYY-MM-DD HH:mm".
function approvedPlan(root) {
  return writeFile(
    root,
    ".agent/main-plan/" + PLAN_NAME + ".md",
    ["# Plan: fsa identity fixture", "", "**Status:** Approved", "", "## Summary", "", "Fixture plan.", "", "## User Decisions", "", "- Approved: 2026-11-06 13:05", ""].join("\n")
  );
}

// Walks the segments in order and checks that every line's prev is the SHA-256 of the exact text of the line before it,
// across each cut. The first line of the first segment holds the genesis value.
function chainIntact(dataDir) {
  let prev = audit.GENESIS_HASH;
  let count = 0;
  for (const line of allLines(dataDir)) {
    const record = JSON.parse(line);
    if (record.prev !== prev) return { ok: false, line: count + 1 };
    prev = fx.sha256Hex(line);
    count += 1;
  }
  return { ok: true, lines: count };
}

// Plants a chained fsa-log store in `dataDir`: one count per segment, the last being the current segment. Returns the hash
// that the next line must hold. options.padBytes pads each line so a segment reaches a size quickly.
function plantStore(dataDir, counts, options) {
  const opts = options || {};
  let prev = audit.GENESIS_HASH;
  let n = 1;
  counts.forEach((count, index) => {
    const isCurrent = index === counts.length - 1;
    const file = path.join(dataDir, isCurrent ? "fsa-log.jsonl" : "fsa-log-" + String(index + 1).padStart(6, "0") + ".jsonl");
    const lines = [];
    for (let i = 0; i < count; i += 1) {
      const body = { ts: new Date(Date.UTC(2026, 0, 1) + n * 1000).toISOString(), prev: prev, event: "fixture-event", n: n };
      if (opts.padBytes && isCurrent) body.pad = "x".repeat(opts.padBytes);
      const line = JSON.stringify(body);
      lines.push(line);
      prev = fx.sha256Hex(line);
      n += 1;
    }
    fs.writeFileSync(file, lines.length === 0 ? "" : lines.join("\n") + "\n");
  });
  return prev;
}

function assertNoContent(text, needles) {
  needles.forEach((needle) => {
    assert.ok(text.indexOf(needle) === -1, "found " + JSON.stringify(needle) + " in: " + text.slice(0, 400));
  });
}

// ---------------------------------------------------------------------------
// AC-1: a report row carries the agent identity and the human authorizer, and no operation or data-accessed field
// ---------------------------------------------------------------------------

test("[AC-1 | Subagent log carries identity and authorizer | spec-hooks-audit | FR-227 | UR-066 | BR-020] a subagent report row holds the agent identity and the human authorizer", () => {
  const root = fx.tempRoot("fsa-identity-");
  approvedPlan(root);
  const dataDir = fx.tempDir("fsa-identity-data-");
  run(stopDoc(root), dataDir);
  const stored = rows(dataDir);
  assert.strictEqual(stored.length, 1, JSON.stringify(stored));
  assert.strictEqual(stored[0].agent_type, AGENT_TYPE);
  assert.strictEqual(stored[0].agent_id, "agent-dt-1");
  assert.strictEqual(typeof stored[0].authorizer, "string");
  assert.ok(stored[0].authorizer.trim().length > 0, "the authorizer is not blank");
  assert.notStrictEqual(stored[0].authorizer, "none");
  assert.ok(stored[0].authorizer.indexOf(PLAN_NAME) !== -1, "the authorizer references the plan approval: " + stored[0].authorizer);
});

test("[AC-1 | Subagent log carries identity and authorizer | spec-hooks-audit | FR-227 | UR-066 | BR-020] the row holds no operation field and no data-accessed field", () => {
  const root = fx.tempRoot("fsa-identity-");
  approvedPlan(root);
  const dataDir = fx.tempDir("fsa-identity-data-");
  run(stopDoc(root), dataDir);
  const stored = rows(dataDir);
  assert.strictEqual(stored.length, 1);
  Object.keys(stored[0]).forEach((key) => {
    assert.ok(!/^(operation|op|path|file|files|data_class|data_accessed|dataAccessed|data)$/i.test(key), "the row holds a forbidden field: " + key);
    assert.ok(!/operation|data.?accessed|data.?class/i.test(key), "the row holds a forbidden field: " + key);
  });
  assert.ok(stored[0].operation === undefined);
  assert.ok(stored[0].data_class === undefined);
  assert.ok(stored[0].path === undefined);
});

test("[AC-1 | Subagent log carries identity and authorizer | spec-hooks-audit | FR-227 | UR-066] a report with no approved plan holds authorizer none with a reason, and the field is present", () => {
  const root = fx.tempRoot("fsa-identity-");
  const dataDir = fx.tempDir("fsa-identity-data-");
  run(stopDoc(root), dataDir);
  const stored = rows(dataDir);
  assert.strictEqual(stored.length, 1, JSON.stringify(stored));
  assert.ok(Object.prototype.hasOwnProperty.call(stored[0], "authorizer"), "the authorizer field is present");
  assert.strictEqual(stored[0].authorizer, "none");
  assert.ok(typeof stored[0].authorizer_reason === "string" && stored[0].authorizer_reason.trim().length > 0, JSON.stringify(stored[0]));
});

test("[AC-1 | Subagent log carries identity and authorizer | spec-hooks-audit | FR-227 | UR-066] a handback row carries the same two fields", () => {
  const root = fx.tempRoot("fsa-identity-");
  approvedPlan(root);
  const dataDir = fx.tempDir("fsa-identity-data-");
  run(handbackDoc(root), dataDir);
  const stored = rows(dataDir);
  assert.strictEqual(stored.length, 1, JSON.stringify(stored));
  assert.strictEqual(stored[0].agent_type, AGENT_TYPE);
  assert.strictEqual(stored[0].agent_id, "agent-dt-2");
  assert.ok(stored[0].authorizer.indexOf(PLAN_NAME) !== -1, stored[0].authorizer);
  assert.ok(stored[0].operation === undefined && stored[0].data_class === undefined);
});

test("[AC-1 | Subagent log carries identity and authorizer | spec-hooks-audit | FR-227 | NFR-031] the authorizer is never message text: the report and the prompt do not reach the row", () => {
  const root = fx.tempRoot("fsa-identity-");
  approvedPlan(root);
  const dataDir = fx.tempDir("fsa-identity-data-");
  run(stopDoc(root, { prompt: "PROMPT-MARKER-fsa please approve", artifact: SENTINEL }), dataDir);
  const raw = fs.readFileSync(path.join(dataDir, "fsa-log.jsonl"), "utf8");
  assertNoContent(raw, [SENTINEL, "PROMPT-MARKER-fsa", "Tests written for the login feature", "tests/auth/login.test.ts"]);
});

test("[AC-1 | Subagent log carries identity and authorizer | spec-hooks-audit | FR-227 | NFR-031] the row holds no field named for content", () => {
  const root = fx.tempRoot("fsa-identity-");
  const dataDir = fx.tempDir("fsa-identity-data-");
  run(stopDoc(root), dataDir);
  const stored = rows(dataDir);
  assert.strictEqual(stored.length, 1, JSON.stringify(stored));
  Object.keys(stored[0]).forEach((key) => {
    assert.ok(!/command|content|prompt|message|text|body|secret|token|input|output|response|stdout|stderr|artifact|questions/i.test(key), "unexpected field: " + key);
  });
});

test("[AC-1 | Subagent log carries identity and authorizer | spec-hooks-audit | FR-227 | NFR-026] several reports chain, and the chain verifies across the rows", () => {
  const root = fx.tempRoot("fsa-identity-");
  const dataDir = fx.tempDir("fsa-identity-data-");
  run(stopDoc(root, { agent_id: "agent-dt-1" }), dataDir);
  run(stopDoc(root, { agent_id: "agent-dt-2" }), dataDir);
  run(handbackDoc(root, { agent_id: "agent-dt-3" }), dataDir);
  const result = chainIntact(dataDir);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.ok(result.lines >= 3, JSON.stringify(result));
  assert.strictEqual(JSON.parse(allLines(dataDir)[0]).prev, audit.GENESIS_HASH);
});

[
  ["an agent id that is not a plain identifier", { agent_id: "bad id $(rm -rf /)" }],
  ["an agent id that is an object", { agent_id: { id: "x" } }],
].forEach((row) => {
  test("[AC-1 | Subagent log carries identity and authorizer | spec-hooks-audit | FR-227 | NFR-031] " + row[0] + " is never copied into the row", () => {
    // Security-adjacent input space: free text must not reach the log through the identity.
    const root = fx.tempRoot("fsa-identity-");
    const dataDir = fx.tempDir("fsa-identity-data-");
    run(stopDoc(root, row[1]), dataDir);
    const raw = fs.existsSync(path.join(dataDir, "fsa-log.jsonl")) ? fs.readFileSync(path.join(dataDir, "fsa-log.jsonl"), "utf8") : "";
    assertNoContent(raw, ["rm -rf", "$(", "bad id"]);
  });
});

// ---------------------------------------------------------------------------
// AC-2: the 500-line cap is gone; the log rotates by size and carries the prior segment's final hash
// ---------------------------------------------------------------------------

test("[AC-2 | Subagent log carries identity and authorizer | spec-hooks-audit | NFR-032 | FR-227 | UR-066] there is no 500-line cap: a log of 600 rows keeps every row and gains one", () => {
  const root = fx.tempRoot("fsa-cap-");
  const dataDir = fx.tempDir("fsa-cap-data-");
  plantStore(dataDir, [600]);
  const before = allLines(dataDir);
  assert.strictEqual(before.length, 600);
  run(stopDoc(root), dataDir);
  const after601 = allLines(dataDir);
  assert.strictEqual(after601.length, 601, "the old rows were trimmed to a cap: " + after601.length);
  assert.deepStrictEqual(after601.slice(0, 600), before, "the first 600 rows are untouched");
  assert.strictEqual(JSON.parse(after601[600]).prev, fx.sha256Hex(before[599]));
});

test("[AC-2 | Subagent log carries identity and authorizer | spec-hooks-audit | NFR-032 | FR-227] a log well over 500 rows stays whole across many reports", () => {
  const root = fx.tempRoot("fsa-cap-");
  const dataDir = fx.tempDir("fsa-cap-data-");
  plantStore(dataDir, [1200]);
  for (let i = 0; i < 3; i += 1) run(stopDoc(root, { agent_id: "agent-dt-" + i }), dataDir);
  assert.strictEqual(allLines(dataDir).length, 1203);
  assert.strictEqual(chainIntact(dataDir).ok, true);
});

test("[AC-2 | Subagent log carries identity and authorizer | spec-hooks-audit | NFR-032 | FR-227 | UR-066 | BR-020] when the current segment reaches the rotation size the next row starts a new segment that holds the prior segment's final chain hash", () => {
  const root = fx.tempRoot("fsa-rotate-");
  const dataDir = fx.tempDir("fsa-rotate-data-");
  // Lines of about 2 KB reach the rotation size in a few thousand rows.
  const count = Math.ceil(audit.ROTATION_BYTES / 2000) + 20;
  plantStore(dataDir, [count], { padBytes: 2000 });
  assert.ok(fs.statSync(path.join(dataDir, "fsa-log.jsonl")).size >= audit.ROTATION_BYTES, "set-up: the planted segment is at the rotation size");
  const plantedLines = allLines(dataDir);
  const finalHash = fx.sha256Hex(plantedLines[plantedLines.length - 1]);

  run(stopDoc(root), dataDir);

  const files = segmentFiles(dataDir);
  assert.strictEqual(files.rotated.length, 1, "one rotated segment: " + files.rotated.join(","));
  const rotatedLines = fx.readLines(path.join(dataDir, files.rotated[0]));
  assert.deepStrictEqual(rotatedLines, plantedLines, "the rotated segment is the old segment, unchanged");
  const currentLines = fx.readLines(path.join(dataDir, "fsa-log.jsonl"));
  assert.strictEqual(currentLines.length, 1, "the new segment holds the new row");
  assert.strictEqual(JSON.parse(currentLines[0]).prev, finalHash, "the first line of the new segment holds the prior segment's final chain hash");
  assert.strictEqual(JSON.parse(currentLines[0]).agent_type, AGENT_TYPE);
  assert.strictEqual(chainIntact(dataDir).ok, true, "the chain verifies across the cut");
});

test("[AC-2 | Subagent log carries identity and authorizer | spec-hooks-audit | NFR-032] below the rotation size nothing rotates", () => {
  const root = fx.tempRoot("fsa-norotate-");
  const dataDir = fx.tempDir("fsa-norotate-data-");
  plantStore(dataDir, [50]);
  run(stopDoc(root), dataDir);
  assert.deepStrictEqual(segmentFiles(dataDir).rotated, []);
  assert.strictEqual(allLines(dataDir).length, 51);
});

test("[AC-2 | Subagent log carries identity and authorizer | spec-hooks-audit | NFR-032 | BR-020] no segment younger than 12 months is deleted when the log rotates", () => {
  const root = fx.tempRoot("fsa-retain-");
  const dataDir = fx.tempDir("fsa-retain-data-");
  const count = Math.ceil(audit.ROTATION_BYTES / 2000) + 20;
  plantStore(dataDir, [30, 30, count], { padBytes: 2000 });
  // Two rotated segments, written two months and one day ago, both well inside the 12-month floor.
  const oldTime = new Date(Date.now() - 60 * DAY);
  const newTime = new Date(Date.now() - 1 * DAY);
  fs.utimesSync(path.join(dataDir, "fsa-log-000001.jsonl"), oldTime, oldTime);
  fs.utimesSync(path.join(dataDir, "fsa-log-000002.jsonl"), newTime, newTime);
  run(stopDoc(root), dataDir);
  const files = segmentFiles(dataDir);
  assert.deepStrictEqual(files.rotated, ["fsa-log-000001.jsonl", "fsa-log-000002.jsonl", "fsa-log-000003.jsonl"]);
  assert.strictEqual(chainIntact(dataDir).ok, true);
});

test("[AC-2 | Subagent log carries identity and authorizer | spec-hooks-audit | NFR-032 | UR-066] the retention floor of the audit library is at least 12 months", () => {
  assert.ok(audit.RETENTION_MS >= 365 * DAY, "retention " + audit.RETENTION_MS + " ms is under 12 months");
  assert.ok(audit.ROTATION_BYTES > 0);
});

test("[AC-2 | Subagent log carries identity and authorizer | spec-hooks-audit | NFR-032 | NFR-026] a log that cannot be written fails open: the hook exits 0 and never blocks", () => {
  const root = fx.tempRoot("fsa-failopen-");
  const dataDir = fx.tempDir("fsa-failopen-data-");
  // The current segment path is a directory, so the append cannot succeed.
  fs.mkdirSync(path.join(dataDir, "fsa-log.jsonl"));
  const res = fx.runHook("fsa-log", stopDoc(root), { dataDir: dataDir });
  assert.strictEqual(res.status, 0, res.stderr);
  if (res.stdout.trim() !== "") {
    const out = JSON.parse(res.stdout);
    assert.ok(!(out.hookSpecificOutput && out.hookSpecificOutput.permissionDecision === "deny"), res.stdout);
    assert.ok(out.decision !== "block", res.stdout);
  }
});

// ---------------------------------------------------------------------------
// Null and out-of-scope input: no row, no throw
// ---------------------------------------------------------------------------

[
  ["an agent with no transition table", (root) => stopDoc(root, { agent_type: "assist-plugin:explore" })],
  ["a report that is not a string", (root) => stopDoc(root, { last_assistant_message: 42 })],
  ["no report", (root) => stopDoc(root, { last_assistant_message: undefined })],
  ["an event that is not a subagent report", (root) => ({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" }, cwd: root })],
].forEach((row) => {
  test("[AC-1 | Subagent log carries identity and authorizer | spec-hooks-audit | FR-227 | NFR-026] " + row[0] + " writes no row and exits 0", () => {
    // Null, empty, and out-of-scope input space.
    const root = fx.tempRoot("fsa-none-");
    const dataDir = fx.tempDir("fsa-none-data-");
    run(row[1](root), dataDir);
    assert.deepStrictEqual(rows(dataDir), []);
  });
});

[
  ["empty stdin", ""],
  ["text that is not JSON", "this is not json"],
  ["JSON null", "null"],
].forEach((row) => {
  test("[AC-1 | Subagent log carries identity and authorizer | spec-hooks-audit | FR-227] unreadable stdin (" + row[0] + ") exits 0 and writes no row", () => {
    const dataDir = fx.tempDir("fsa-stdin-data-");
    const res = fx.runHook("fsa-log", row[1], { dataDir: dataDir });
    assert.strictEqual(res.status, 0, res.stderr);
    assert.deepStrictEqual(rows(dataDir), []);
  });
});
