// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// PreToolUse hook that keeps the access log for tagged data: the FERPA internal access log for student-record paths (task
// plan Tranche 3, Step 25; specs/spec-hooks-compliance.md, Requirement: FERPA internal access log) and the HIPAA
// agent-level audit log for PHI paths (Step 26, Requirement: HIPAA agent-level audit log). The FERPA part is general
// governance support on the purpose dimension and is labeled directional [NFR-033]: it records who touched a tagged path and
// for what stated purpose, and it makes no claim about any disclosure rule. It is a log control, never a deny control.
//
// [FR-232|NFR-033] The HIPAA part is verified against 45 CFR 164.312(b), which requires mechanisms that record and examine
// activity. Each record is readable for review: path, agent identity, and timestamp per line. It implements that one required
// technical safeguard. It is not full HIPAA compliance: access control, integrity, authentication, transmission security,
// and the administrative and physical safeguards are separate controls that this hook does not provide.
//
// [FR-230|FR-232] For each Read, Grep, Glob, Write, Edit, MultiEdit, or NotebookEdit of a path that lib/data-class.js tags
// "student-record" (FERPA enforced) or "PHI" (HIPAA enforced), the hook appends one "data-access" record to the governance audit log (.agent/logs/governance/audit.jsonl,
// owned by lib/audit-chain.js). The record is the five attribution fields built by audit-chain.attribute(), the same slots
// the audit-log hook fills: the operation, the data accessed (`path` relative to the project root, and the `data_class` tag),
// the agent identity (lib/identity.js), the human authorizer (lib/authorizer.js), and the timestamp the library adds. Added
// beside them: the tool name and the `purpose`. The record is per agent action: one tool call, one record, never one per
// session or per inference call. [FR-226] An action with no agent id that is not the main session carries the identity
// "unidentified" (lib/identity.js), and scripts/verify-audit-chain.js flags those records.
// [FR-247] The purpose comes only from the session purpose record that the purpose-capture hook writes, read through
// lib/purpose-record.js with this event's session_id, so a record of another session never labels this access. It never
// comes from model output or file text. When there is no usable record (none declared, another session's, or no session_id on
// the event), the purpose is "unstated" and the record carries flagged_for_review: true. A missing purpose never denies an
// access: this hook prints nothing and always exits 0. A purpose the audit log refuses (a secret-shaped string) is replaced
// by "withheld" so the access is still recorded, flagged for review.
// [NFR-031] The record holds the path and the class tag only: never file content, the tool input, a command, or a prompt.
//
// [NFR-029|FR-243] Cost and opt-out. The hook returns before any profile.json read when the event is not a file-path tool
// call, when no project root is known, or when the committed .claude/settings.json opts both FERPA and HIPAA out. A class is
// logged only while its own profile is enforced. The HIPAA profile is enforced by default and stops only through the governed
// opt-out. The flag is read through lib/data-class.js, which parses the committed file and never reads process.env, so a
// personal .claude/settings.local.json cannot turn the log off. A path outside the logged classes costs one profile.json read
// and no log write.
// [NFR-028] With no profile.json nothing is tagged, so the hook records nothing and never denies. A malformed profile.json
// tags nothing either ("untagged"); the guards that deny on it are other hooks.
//
// Known gap: a shell read such as `cat records/grades.csv` is not seen. The hook handles file-path tools only and does not
// parse shell commands. For the same reason the "send" action (a PR post or WebFetch that carries PHI) is not logged here: it
// names no file path, and the outbound surface is the PHI outbound guard's (FR-233). A Grep or Glob without a path argument names no path, so it is not classified. PreToolUse hooks run
// side by side, so an access that another hook denies is still logged as an attempt.
//
// Logging is on by default, fails open, and is report-only in its self-test (impl/health-check.js): a failure is reported and
// never disables it, because disabling the writer would stop the access trail.
"use strict";

const health = require("../lib/health.js");
const dataClass = require("../lib/data-class.js");
const purposeRecord = require("../lib/purpose-record.js");

const NAME = "data-access-log";
const EVENT = "data-access";
const TOOL_EVENT = "PreToolUse";
// [FR-230|FR-232] The classes this hook logs, each with the profile that has to be enforced for it.
const LOGGED_CLASSES = {};
LOGGED_CLASSES[dataClass.CLASS_STUDENT] = "ferpa";
LOGGED_CLASSES[dataClass.CLASS_PHI] = "hipaa";
// Shown in place of a purpose that the audit log refuses to store.
const PURPOSE_WITHHELD = "withheld";

// [FR-230] The tools this hook logs, with the operation each one performs.
const OPERATIONS = {
  Read: "read",
  Grep: "read",
  Glob: "read",
  Write: "write",
  Edit: "write",
  MultiEdit: "write",
  NotebookEdit: "write",
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function operationOf(tool) {
  return Object.prototype.hasOwnProperty.call(OPERATIONS, tool) ? OPERATIONS[tool] : null;
}

// True for a PreToolUse input that names one of the logged tools: the only input this hook considers.
function isLoggable(input) {
  return isObject(input) && input.hook_event_name === TOOL_EVENT && typeof input.tool_name === "string" && operationOf(input.tool_name) !== null;
}

// [FR-230|FR-247] The purpose for this event: the declared purpose of this session, or "unstated". The session id is passed
// to the reader because the reader is session-scoped only when it gets one; an event without a usable session id reads no
// record at all, so another session's record cannot label this access.
function purposeOf(input, root) {
  if (typeof input.session_id !== "string" || input.session_id.length === 0) return purposeRecord.UNSTATED;
  return purposeRecord.currentPurpose({ root, sessionId: input.session_id });
}

// [FR-230|FR-232] The profile that must be enforced for a path of this data class, or null when the class is not logged.
function profileOf(tag) {
  return Object.prototype.hasOwnProperty.call(LOGGED_CLASSES, tag) ? LOGGED_CLASSES[tag] : null;
}

// [FR-230|FR-232] The access record for one event, or null when the event is not logged: not a file-path tool call, both
// profiles opted out, a path outside the student-record and PHI classes, or a class whose profile is opted out. Reads
// settings.json, profile.json, the purpose record, and the plan directory (the authorizer) by file reads only, and writes
// nothing. options.root is the project root.
function evaluate(input, options) {
  if (!isLoggable(input)) return null;
  const root = options ? options.root : null;
  if (typeof root !== "string" || root.length === 0) return null;
  // [NFR-029] [FR-243] Exit before any other read when the committed settings opt both profiles out.
  const state = dataClass.profileState({ root });
  if (state.ferpa !== true && state.hipaa !== true) return null;
  const fields = health.auditFields(input, root);
  if (typeof fields.path !== "string") return null;
  const profile = profileOf(fields.data_class);
  if (profile === null || state[profile] !== true) return null;
  const purpose = purposeOf(input, root);
  const parts = Object.assign({ event: EVENT, operation: operationOf(input.tool_name) }, fields, health.auditAuthorizer(input, root));
  const attributed = health.auditAttribute(parts);
  // attribute() copies the five attribution fields only; the tool and the purpose are added beside them.
  const record = Object.assign({}, attributed, { tool: input.tool_name, purpose });
  if (purpose === purposeRecord.UNSTATED) record.flagged_for_review = true;
  return record;
}

// The record again with the purpose replaced, for the one retry when the audit log refused the purpose text.
function withWithheldPurpose(record) {
  return Object.assign({}, record, { purpose: PURPOSE_WITHHELD, flagged_for_review: true });
}

// Builds the record for an event and passes it to the sink, which writes it. options: {root, sink} replace the git-root
// lookup and the audit-log write (the self-test, which reads and writes no real log). A sink returns false when it could not
// write the record; the hook then tries once more with the purpose withheld. Returns the record, or null.
function run(input, options) {
  if (!isLoggable(input)) return null;
  const opts = options || {};
  const root = typeof opts.root === "string" ? opts.root : health.auditRoot(input);
  const record = evaluate(input, { root });
  if (record === null) return null;
  const sink = typeof opts.sink === "function" ? opts.sink : (entry) => health.auditAppend(NAME, root, entry);
  if (sink(record) === false && record.purpose !== purposeRecord.UNSTATED) {
    const fallback = withWithheldPurpose(record);
    sink(fallback);
    return fallback;
  }
  return record;
}

function main() {
  health.transform(
    NAME,
    (input) => {
      run(input);
      return null;
    },
    { suffix: "this access was not logged", disabledNote: "student-record and PHI accesses are not written to the audit log" }
  );
}

module.exports = { NAME, EVENT, evaluate, run, main };

if (require.main === module) main();
