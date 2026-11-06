// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-221|NFR-026] PostToolUse and PostToolUseFailure hook (matcher Bash) that records the result of an allowlisted test,
// coverage, or in-plugin scanner command as a "gate-evidence" event in the governance audit log (task plan Tranche 2,
// Step 17; specs/spec-orchestration-review-gates.md, Requirement 14). A deterministic gate (Coverage >=70%, a test-runner
// exit) clears only on this record. A hook writes it, so a model cannot forge it with a sign-off string.
//
// The record is {event: "gate-evidence", tool, agent_type?, agent_id?, tool_event, gate_kind, gate_command, exit_code,
// value?, parser?, tool_use_id?}; the library adds the timestamp and the chain hash. lib/gate-evidence.js decides what a
// command and an event mean: a PostToolUse success event reads as exit 0, a PostToolUseFailure event takes the exit status
// from the "Exit code N" that begins its `error` field. [NFR-031] The record holds the allowlist's fixed identifier for
// the command, the exit code, and a coverage number. It never holds the command text typed, arguments, output text, a
// prompt, or a secret, and a command off the allowlist yields no record at all.
//
// Logging is always on. It fails open: a failed or refused append is noted in hook-health.jsonl and the tool call
// proceeds (a PostToolUse hook cannot block it anyway). With no record the gate stays open, which is the safe side. The
// hook prints nothing. Its self-test is report-only (impl/health-check.js): a failure is reported and never disables it,
// because disabling the writer would leave a gate with no evidence to read.
"use strict";

const evidence = require("../lib/gate-evidence.js");
const health = require("../lib/health.js");

const NAME = "gate-evidence";
const EVENT = "gate-evidence";
const TOOL_USE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// [FR-221|NFR-031] The audit record for one Bash event, or null for an event this hook does not record. Pure: no I/O.
function evaluate(input) {
  const result = evidence.analyze(input);
  if (result === null) return null;
  // The agent identity and tool name come from the same reader as every audit record; Bash names no path.
  const fields = health.auditFields(input, null);
  const record = { event: EVENT };
  ["tool", "agent_type", "agent_id"].forEach((key) => {
    if (fields[key] !== undefined) record[key] = fields[key];
  });
  Object.keys(result).forEach((key) => {
    record[key] = result[key];
  });
  if (typeof input.tool_use_id === "string" && TOOL_USE_ID_PATTERN.test(input.tool_use_id)) record.tool_use_id = input.tool_use_id;
  return record;
}

// Builds the record for an event and passes it to the sink, which writes it. options: {root, sink} replace the git-root
// lookup and the audit-log write (the self-test, which reads and writes no real log). Returns the record, or null.
function run(input, options) {
  if (!isObject(input)) return null;
  const record = evaluate(input);
  if (record === null) return null;
  const opts = options || {};
  const root = typeof opts.root === "string" ? opts.root : health.auditRoot(input);
  const sink = typeof opts.sink === "function" ? opts.sink : (entry) => health.auditAppend(NAME, root, entry);
  sink(record);
  return record;
}

function main() {
  health.transform(
    NAME,
    (input) => {
      run(input);
      return null;
    },
    { suffix: "this result was not recorded as gate evidence", disabledNote: "test and coverage results are not recorded as gate evidence" }
  );
}

module.exports = { NAME, EVENT, evaluate, run, main };

if (require.main === module) main();
