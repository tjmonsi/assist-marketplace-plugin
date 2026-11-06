// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Terminal-block log for the assist-plugin agent FSAs, in warn mode.
//
// Events handled (the event comes from hook_event_name and tool_name in the hook input):
//   SubagentStop                    a subagent ended; its last message is last_assistant_message.
//   PostToolUse SubagentHandback    in auto mode a subagent's report travels as tool_input.message.
//   PostToolUse Agent               the main loop received a subagent's result.
// For each report from an assist-plugin agent that has an FSA table (lib/fsa-tables.js), the hook parses the
// last ```fsa block, checks it with checkTrace(), and appends one JSON line to ${CLAUDE_PLUGIN_DATA}/fsa-log.jsonl:
// ts, session_id, event, agent_type, agent_id, plugin_version, the human authorizer, the block fields state, verdict, error_class, and
// trace, and the list of problems. Message text, prompts, and file contents are never stored; block fields are copied
// only after they match a closed list or pattern.
//
// [FR-227|NFR-032] One row per subagent report. A row adds only the agent identity and the human authorizer to the
// report fields: it holds no operation and no data-accessed field, because one report cannot name a single operation or
// path (per-access attribution lives in audit.jsonl). The agent identity comes from lib/identity.js for a stop or a
// handback, where the hook input names the subagent; an agent result is sent to the main session, so its identity is the
// reporting subagent that the tool input and result name. [FR-226] It is never blank. The authorizer comes from
// lib/authorizer.js: a reference to the plan approval, or "none" with authorizer_reason; the field is never omitted and
// never holds message text (NFR-031).
//
// There is no line cap. The file rotates by size through lib/audit-chain.js (name "fsa-log"): each row is a chained
// line {ts, prev, ...}, a new segment starts with the prior segment's final chain hash in `prev`, and segments are kept
// at least 12 months (NFR-032).
//
// Warn mode: when SubagentStop or SubagentHandback finds problems, the only output is a systemMessage for the
// user. The hook never blocks and never returns additionalContext or a decision, because either would make
// the subagent continue. The Agent result is logged but does not warn, since SubagentStop reports the same
// message. A SubagentStop is compared only with the newest record for its agent_id. When that record is a
// handback, the stop is not checked again (the handback is the report) and a marker record (event
// stop-after-handback, no block fields) is written in its place. The marker becomes the newest record, so a
// resumed run that stops without a handback is checked and logged like any other stop.
// Fail-open: any failure lets the run continue (see ../lib/health.js). Never exits 2.
"use strict";

const path = require("path");
const health = require("../lib/health.js");
const fsa = require("../lib/fsa-tables.js");
const chain = require("../lib/audit-chain.js");
const identity = require("../lib/identity.js");
const authorizer = require("../lib/authorizer.js");

const NAME = "fsa-log";
const LOG_NAME = "fsa-log";
const LOG_FILE = LOG_NAME + ".jsonl";
// [NFR-032] Rotation size in bytes: 1 MiB (about 2,500 rows at 400 bytes a row) is an estimate, not a measured figure.
// The hook reads the current segment on a stop, so the size stays small.
const ROTATION_BYTES = 1024 * 1024;
const LOCK_TIMEOUT_MS = 1000;
// The audit-chain privacy check refuses a string over 256 characters; a trace is cut at a state boundary below that.
const MAX_TRACE_CHARS = 240;
const MAX_TEXT_CHARS = 400000;
const MAX_DEPTH = 4;
const TEXT_KEYS = ["content", "text", "result", "output", "message"];
const IDENTIFIER = /^[A-Za-z0-9_-]{1,64}$/;
const TYPE_NAME = /^[A-Za-z0-9:_-]{1,60}$/;
const TS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const MARKER_EVENT = "stop-after-handback";
const EVENTS = ["subagent-stop", "handback", "agent-result", MARKER_EVENT];
const WARNING_EVENTS = ["subagent-stop", "handback"];
const SHOWN_PROBLEMS = 3;
const INVALID = "<invalid>";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function identifier(value) {
  return typeof value === "string" && IDENTIFIER.test(value) ? value : null;
}

// Strings found under the usual text keys of a tool result, joined; bounded in depth and size.
function collectText(value, depth, parts, size) {
  if (size.chars > MAX_TEXT_CHARS) return;
  if (typeof value === "string") {
    parts.push(value);
    size.chars += value.length;
  } else if (Array.isArray(value) && depth < MAX_DEPTH) {
    value.forEach((item) => collectText(item, depth + 1, parts, size));
  } else if (isObject(value) && depth < MAX_DEPTH) {
    TEXT_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) collectText(value[key], depth + 1, parts, size);
    });
  }
}

function responseText(response) {
  const parts = [];
  collectText(response, 0, parts, { chars: 0 });
  return parts.join("\n");
}

// What each event carries: the agent type, the agent id, the message text, and whether to look for a block.
// Returns null for an event this hook does not read.
function source(input) {
  const toolInput = isObject(input.tool_input) ? input.tool_input : {};
  if (input.hook_event_name === "SubagentStop") {
    return { event: "subagent-stop", type: input.agent_type, id: input.agent_id, message: input.last_assistant_message, lenient: false };
  }
  if (input.hook_event_name !== "PostToolUse") return null;
  if (input.tool_name === "SubagentHandback") {
    return { event: "handback", type: input.agent_type, id: input.agent_id, message: toolInput.message, lenient: false };
  }
  if (input.tool_name === "Agent") {
    const response = input.tool_response;
    // A launch that has not finished carries a status other than completed; there is no report yet.
    if (isObject(response) && typeof response.status === "string" && response.status !== "completed") return null;
    const id = isObject(response) ? response.agentId : undefined;
    return { event: "agent-result", type: toolInput.subagent_type, id, message: responseText(response), lenient: true };
  }
  return null;
}

// [FR-226] The identity of the agent a report belongs to: {agent_type, agent_id, plugin_version}. For a stop or a handback the hook input
// names the subagent, and lib/identity.js reads it. For an agent result, and for an input the helper cannot tie to a
// subagent, the event's own report fields are used. agent_type is never blank; agent_id is INVALID when none is usable.
function identityOf(input, from) {
  const who = identity.resolve(input);
  if (from.event !== "agent-result" && who.kind === "subagent") return { agent_type: who.agent_type, agent_id: who.agent_id, plugin_version: who.plugin_version };
  return {
    agent_type: typeof from.type === "string" && TYPE_NAME.test(from.type) ? from.type : identity.UNIDENTIFIED,
    agent_id: identifier(from.id) || INVALID,
    plugin_version: who.plugin_version,
  };
}

// A trace cut at a state boundary so that the row stays inside the audit-chain string bound.
function fitTrace(trace) {
  if (trace.length <= MAX_TRACE_CHARS) return trace;
  const cut = trace.lastIndexOf(">", MAX_TRACE_CHARS);
  return cut > 0 ? trace.slice(0, cut) : trace.slice(0, MAX_TRACE_CHARS);
}

function summaryOf(problems) {
  if (problems[0] === "no-block") return "has no fsa terminal block";
  const shown = problems.slice(0, SHOWN_PROBLEMS).join(", ");
  const more = problems.length - SHOWN_PROBLEMS;
  return "has terminal block problems: " + shown + (more > 0 ? " and " + more + " more" : "");
}

// The log record for one hook input, or null when the input is not a report this hook checks. Returns {record, agent,
// warn}. The only I/O is the clock and the authorizer lookup (file reads); options.authorizer replaces that lookup with
// a function (input) => {authorizer, authorizer_reason?} (tests and the health check).
function inspect(input, options) {
  if (!isObject(input)) return null;
  const from = source(input);
  if (!from) return null;
  const agent = fsa.agentFromType(from.type, from.lenient);
  if (!agent || typeof from.message !== "string" || (from.event === "agent-result" && from.message.length === 0)) return null;
  const block = fsa.parseTerminalBlock(from.message);
  const problems = block ? fsa.checkTrace(agent, block) : ["no-block"];
  const lookup = options && typeof options.authorizer === "function" ? options.authorizer : authorizer.fields;
  const record = Object.assign(
    {
      ts: new Date().toISOString(),
      session_id: identifier(input.session_id) || INVALID,
      event: from.event,
    },
    identityOf(input, from),
    lookup(input)
  );
  const fields = block ? fsa.summarize(agent, block) : {};
  Object.keys(fields).forEach((key) => {
    record[key] = key === "trace" && typeof fields[key] === "string" ? fitTrace(fields[key]) : fields[key];
  });
  record.problems = problems;
  return { record, agent, warn: problems.length > 0 && WARNING_EVENTS.indexOf(from.event) !== -1 };
}

// [NFR-032] Appends one chained row to the size-rotated log in the plugin data directory. The chain sets the row's ts
// and prev; the record's own ts is dropped. Throws when the row is refused or not written, so evaluate() reports it.
function appendRecord(record) {
  const dir = process.env.CLAUDE_PLUGIN_DATA;
  if (!dir) return;
  const row = Object.assign({}, record);
  delete row.ts;
  const result = chain.append(row, { dir: path.resolve(dir), name: LOG_NAME, rotationBytes: ROTATION_BYTES, lockTimeoutMs: LOCK_TIMEOUT_MS });
  if (!result.ok) throw new Error("row not written (" + result.code + ")");
}

// The newest record in `recent` (oldest first) for this agent_id, or null. An agent-result record only notes
// that the main loop received the message, so it does not count as a run boundary.
function newestFor(recent, id) {
  for (let i = recent.length - 1; i >= 0; i--) {
    if (isObject(recent[i]) && recent[i].agent_id === id && recent[i].event !== "agent-result") return recent[i];
  }
  return null;
}

function followsHandback(recent, id) {
  const newest = newestFor(recent, id);
  return newest !== null && newest.event === "handback";
}

// The small record written when a stop is skipped: who stopped and when, and no block fields.
function markerFor(record) {
  const marker = {
    ts: record.ts,
    session_id: record.session_id,
    event: MARKER_EVENT,
    agent_type: record.agent_type,
    agent_id: record.agent_id,
    plugin_version: record.plugin_version,
    authorizer: record.authorizer,
  };
  if (record.authorizer_reason !== undefined) marker.authorizer_reason = record.authorizer_reason;
  marker.problems = [];
  return marker;
}

// Returns null (emit nothing), a log-only result, or {stdout: {systemMessage}}.
// options: {append, recent, authorizer} replace the log write, the log read, and the authorizer lookup (tests and the
// health check).
function evaluate(input, options) {
  const opts = options || {};
  const found = inspect(input, opts);
  if (!found) return null;
  let record = found.record;
  let warn = found.warn;
  if (record.event === "subagent-stop" && record.agent_id !== INVALID) {
    const recent = Array.isArray(opts.recent) ? opts.recent : health.readJsonl(LOG_FILE);
    if (followsHandback(recent, record.agent_id)) {
      record = markerFor(record);
      warn = false;
    }
  }
  const result = {};
  try {
    (typeof opts.append === "function" ? opts.append : appendRecord)(record);
  } catch (err) {
    result.logKind = "log-write-error";
    result.message = "fsa-log.jsonl could not be written: " + health.describeError(err);
  }
  if (warn) {
    result.stdout = {
      systemMessage: "assist-plugin fsa: " + found.agent + " final report " + summaryOf(record.problems) + "; see /assist-plugin:health",
    };
  }
  return result.stdout || result.logKind ? result : null;
}

// Validated entries of the log, oldest first. The file is not trusted: every field is checked.
function readEntries() {
  const entries = [];
  health.readJsonl(LOG_FILE).forEach((raw) => {
    if (!isObject(raw) || !TS_PATTERN.test(String(raw.ts)) || EVENTS.indexOf(raw.event) === -1) return;
    const problems = Array.isArray(raw.problems) ? raw.problems.slice(0, 8).filter((p) => typeof p === "string").map(health.sanitize) : [];
    entries.push({
      ts: raw.ts,
      event: raw.event,
      agent: typeof raw.agent_type === "string" && TYPE_NAME.test(raw.agent_type) ? raw.agent_type : INVALID,
      state: typeof raw.state === "string" && /^[A-Za-z<>]{1,30}$/.test(raw.state) ? raw.state : "none",
      problems,
    });
  });
  return entries;
}

function main() {
  health.transform(NAME, evaluate, { suffix: "this subagent report was not checked", disabledNote: "subagent reports are no longer logged or checked" });
}

module.exports = { NAME, LOG_FILE, ROTATION_BYTES, MARKER_EVENT, WARNING_EVENTS, inspect, evaluate, readEntries, main };

if (require.main === module) main();
