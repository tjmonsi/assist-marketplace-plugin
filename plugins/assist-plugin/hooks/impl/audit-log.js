// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// PostToolUse hook that writes one access record per tool call to the governance audit log (task plan Tranche 2,
// Step 12; specs/spec-hooks-audit.md). The log is .agent/logs/governance/audit.jsonl under the project root, a
// hash-chained JSONL file that lib/audit-chain.js owns. This hook only builds the record and hands it over.
//
// [FR-227] The record is an attributed access event built by audit-chain.attribute(): {event: "tool-access", operation, tool,
// path?, data_class, agent_type, agent_id?, authorizer, authorizer_reason?}; the library adds the timestamp and the chain
// hash. That is the five attribution fields: the operation, the data accessed (`path`, relative to the project root when it
// is inside it, and a `data_class` tag, never content), the agent identity, the human authorizer, and the timestamp. The
// operation is the kind of the tool call (read, write, execute, fetch, search, delegate, or call for any other tool); the
// tool name stays beside it. A tool call that names no path (a Bash command, a web fetch) records no path and the class
// "none". [NFR-031] The record never holds a command, a prompt, file contents, a tool result, or a secret: only the
// fields above are read from the input, and the library refuses a record that carries a secret-shaped value (a refused
// path is dropped and the record is marked path_withheld; any other refusal fails the hook open, drops the record, and
// is noted in hook-health.jsonl).
// [FR-226] The agent identity (agent_type, agent_id) comes from lib/identity.js: the subagent's type and id, "main-session"
// when no subagent acted, or "unidentified" when neither can be established. It is never blank.
// [FR-231] The data_class tag comes from lib/data-class.js: "student-record", "PHI", "none", or "untagged" when the class
// cannot be known (a malformed profile.json). This hook only tags; it never denies on a class.
// [FR-227] The authorizer comes from lib/authorizer.js: a reference to the plan approval, or "none" with a reason. It is
// never omitted.
//
// Logging is always on (no opt-in, not gated by a profile flag). It fails open: a failed or refused append is noted in
// hook-health.jsonl and the tool call proceeds, since PostToolUse cannot block it anyway. The hook prints nothing.
// Its self-test is report-only (impl/health-check.js): a failure is reported and never disables it, because disabling
// the writer would stop the audit trail.
"use strict";

const health = require("../lib/health.js");
const identity = require("../lib/identity.js");

const NAME = "audit-log";
const EVENT = "tool-access";
const TOOL_EVENT = "PostToolUse";

// [FR-227] The operation of a tool call: what kind of access it is. A tool not listed is "call"; the tool name is
// recorded beside it, so nothing is lost.
const OPERATIONS = {
  Read: "read",
  Grep: "read",
  Glob: "read",
  NotebookRead: "read",
  Write: "write",
  Edit: "write",
  MultiEdit: "write",
  NotebookEdit: "write",
  Bash: "execute",
  PowerShell: "execute",
  WebFetch: "fetch",
  WebSearch: "search",
  Agent: "delegate",
  Task: "delegate",
};
const DEFAULT_OPERATION = "call";

function operationOf(tool) {
  return Object.prototype.hasOwnProperty.call(OPERATIONS, tool) ? OPERATIONS[tool] : DEFAULT_OPERATION;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// True for a PostToolUse input with a usable tool name: the only input this hook records.
function isRecordable(input) {
  return isObject(input) && input.hook_event_name === TOOL_EVENT && typeof input.tool_name === "string" && input.tool_name.length > 0;
}

// [NFR-029] Measured 2026-11-06 on one Linux machine, Node, 200 hook processes per case, median wall time of
// `node hooks/audit-log.js` from spawn to exit, against a project with 25 approved plans of about 15 KiB each and a valid
// profile.json (the worst case the authorizer reads): 78.6 ms for the pre-attribution hook (git HEAD), 86.9 ms for this
// one, so the added cost is about 8 ms (second run: 80.8 and 87.0 ms, about 6 ms). In-process, the whole evaluate-and-append path takes a
// median 0.64 ms over 100 calls. That is inside the 30 ms per-hook budget; the figures are single-machine estimates.
// [NFR-026|FR-224|FR-227] The attributed audit record for one tool event, or null for an event this hook does not record.
// Reads the profile.json globs (the data-class tag) and the plan directory (the authorizer), both by file reads only, and
// writes nothing. options.root is the project root that the path is made relative to (null leaves the path as given).
function evaluate(input, options) {
  if (!isRecordable(input)) return null;
  const root = options ? options.root : null;
  const fields = health.auditFields(input, root);
  if (typeof fields.tool !== "string") return null;
  // [FR-226] The identity slot is set by the helper, whatever health.auditFields copied.
  const parts = Object.assign({ event: EVENT, operation: operationOf(fields.tool) }, fields, identity.fields(input), health.auditAuthorizer(input, root));
  const record = health.auditAttribute(parts);
  // attribute() copies the five attribution fields only; the tool name is added back beside the operation.
  return Object.assign({ event: record.event, operation: record.operation, tool: fields.tool }, record);
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
