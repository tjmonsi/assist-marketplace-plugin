// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// PostToolUse hook that writes one access record per tool call to the governance audit log (task plan Tranche 2,
// Step 12; specs/spec-hooks-audit.md). The log is .agent/logs/governance/audit.jsonl under the project root, a
// hash-chained JSONL file that lib/audit-chain.js owns. This hook only builds the record and hands it over.
//
// The record is {event: "tool-access", tool, path?, data_class?, agent_type?, agent_id?}; the library adds the timestamp
// and the chain hash. `path` is the file or directory the tool named, relative to the project root when it is inside
// it, with a data_class tag ("untagged" until task plan Step 23 adds the classifier). A tool call that names no path
// (a Bash command, a web fetch) records the tool name alone. [NFR-031] The record never holds a command, a prompt, file
// contents, a tool result, or a secret: only the fields above are read from the input, and the library refuses a record
// that carries a secret-shaped value (the record is then dropped and the refusal is noted in hook-health.jsonl).
// The agent identity comes from the raw agent_type and agent_id of the input; lib/identity.js (Step 21) replaces that.
//
// Logging is always on (no opt-in, not gated by a profile flag). It fails open: a failed or refused append is noted in
// hook-health.jsonl and the tool call proceeds, since PostToolUse cannot block it anyway. The hook prints nothing.
// Its self-test is report-only (impl/health-check.js): a failure is reported and never disables it, because disabling
// the writer would stop the audit trail.
"use strict";

const health = require("../lib/health.js");

const NAME = "audit-log";
const EVENT = "tool-access";
const TOOL_EVENT = "PostToolUse";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// True for a PostToolUse input with a usable tool name: the only input this hook records.
function isRecordable(input) {
  return isObject(input) && input.hook_event_name === TOOL_EVENT && typeof input.tool_name === "string" && input.tool_name.length > 0;
}

// [NFR-026|FR-224] The audit record for one tool event, or null for an event this hook does not record. Pure: no I/O.
// options.root is the project root that the path is made relative to (null leaves the path as given).
function evaluate(input, options) {
  if (!isRecordable(input)) return null;
  const fields = health.auditFields(input, options ? options.root : null);
  if (typeof fields.tool !== "string") return null;
  return Object.assign({ event: EVENT }, fields);
}

// Builds the record for an event and passes it to the sink, which writes it. options: {root, sink} replace the git-root
// lookup and the audit-log write (the self-test, which reads and writes no real log). Returns the record, or null.
function run(input, options) {
  if (!isRecordable(input)) return null;
  const opts = options || {};
  const root = typeof opts.root === "string" ? opts.root : health.auditRoot(input);
  const record = evaluate(input, { root });
  if (record === null) return null;
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
    { suffix: "this action was not logged", disabledNote: "tool actions are not written to the audit log" }
  );
}

module.exports = { NAME, EVENT, evaluate, run, main };

if (require.main === module) main();
