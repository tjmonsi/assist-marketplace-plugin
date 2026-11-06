// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-219|FR-238] PostToolUse hook (matcher WebFetch|WebSearch|mcp__.*) that checks a tool result for text that tries to
// redirect the agent away from the user's goal, and records a "goal-guard" event in the governance audit log: a would-deny
// event when a hijack rule matches, a pass event when none does (task plan Tranche 2, Step 19; specs/spec-hooks-goal-guard.md).
//
// ADVISORY ONLY (FR-238, advisory phase). The hook records and nothing else: it prints nothing, rewrites nothing, and
// withholds nothing, so the result reaches the agent unchanged. Promotion to blocking is a later tranche (task plan
// Step 36) and is not built here. A PostToolUse hook cannot block the tool call that already ran.
//
// RULE-BASED, NO MODEL, NO NETWORK (decision D-13, NFR-027). The rules are deterministic and live in
// ../lib/hijack-rules.js. The input is attacker-controlled text, so a model-evaluating hook would itself be an
// injection surface. This module requires only the rule library and lib/health.js; it imports no model client, makes
// no network request, spawns no process, and holds no write tool. Its one side effect is the audit-log append that
// health.auditAppend performs, the same writer every logging hook uses.
//
// A would-deny record is {event: "goal-guard", decision: "would-deny", mode: "advisory", rule_id, family, rule_count, tool,
// agent_type?, agent_id?}; the library adds the timestamp and the chain hash. A pass record is {event: "goal-guard",
// decision: "pass", mode: "advisory", tool, agent_type?, agent_id?}: no rule matched, so it names no rule id (the spec's
// record-fields table gives a pass the tool name alone). [NFR-031] Neither record holds the tool result, a URL, a search
// query, a prompt, a path, or a secret: rule_id is the first matching rule (a fixed identifier), family is its fixed
// category, and rule_count is a number. A pass is recorded only for a governed result (a PostToolUse event of WebFetch,
// WebSearch, or an MCP tool); any other tool or event leaves no record.
//
// Known gap: the check is not given the user's stated goal. How the goal reaches a PostToolUse hook (the UserPromptSubmit
// hook is the only place that sees it) is a build-time confirmation of the task plan, and advisory mode needs none, so
// the rules look for goal-redirecting phrasing alone.
//
// It fails open: a failed or refused append is noted in hook-health.jsonl and the result proceeds; a thrown error is
// handled by health.transform (a warning, exit 0). Its self-test is report-only (impl/health-check.js): a failure is
// reported and never disables it, because disabling the recorder would leave no baseline for the promotion decision.
"use strict";

const rules = require("../lib/hijack-rules.js");
const health = require("../lib/health.js");

const NAME = "goal-guard";
const EVENT = "goal-guard";
const DECISION = "would-deny";
const PASS = "pass";
const MODE = "advisory";
const TOOL_EVENT = "PostToolUse";
const MCP_PREFIX = "mcp__";
const EXTERNAL_TOOLS = new Set(["WebFetch", "WebSearch"]);
const MAX_DEPTH = 6;
const MAX_ITEMS = 500;
const MAX_COLLECTED = 2000000; // characters read from one result before the rule library caps the text itself

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// True for a tool whose result is untrusted outside text: WebFetch, WebSearch, or an MCP tool.
function isExternalTool(name) {
  return typeof name === "string" && (EXTERNAL_TOOLS.has(name) || name.indexOf(MCP_PREFIX) === 0);
}

// Every string in a tool result, in order, joined by line breaks. Reads only own enumerable data, to a fixed depth and
// size, so a deep or huge result cannot stall the hook. Returns "" for a result with no text.
function collectText(response) {
  const parts = [];
  let total = 0;
  const walk = (value, depth) => {
    if (total >= MAX_COLLECTED) return;
    if (typeof value === "string") {
      parts.push(value);
      total += value.length;
      return;
    }
    if (depth >= MAX_DEPTH || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.slice(0, MAX_ITEMS).forEach((item) => walk(item, depth + 1));
      return;
    }
    Object.keys(value)
      .slice(0, MAX_ITEMS)
      .forEach((key) => walk(value[key], depth + 1));
  };
  walk(response, 0);
  return parts.join("\n");
}

// [FR-219|FR-238] The audit record for one tool result: a would-deny record when a rule matches, a pass record when none
// does, or null when the event or tool is out of scope. Pure: no I/O, and it never changes its input.
function evaluate(input) {
  if (!isObject(input) || input.hook_event_name !== TOOL_EVENT || !isExternalTool(input.tool_name)) return null;
  const result = rules.analyze(collectText(input.tool_response));
  // Only the tool name and the agent identity: auditFields would also copy a path from an MCP tool's input, and a
  // goal-guard record names no path.
  const fields = health.auditFields(input, null);
  let record;
  if (result.findings.length === 0) {
    record = { event: EVENT, decision: PASS, mode: MODE };
  } else {
    const first = result.findings[0];
    record = { event: EVENT, decision: DECISION, mode: MODE, rule_id: first.id, family: first.family, rule_count: result.findings.length };
  }
  ["tool", "agent_type", "agent_id"].forEach((key) => {
    if (fields[key] !== undefined) record[key] = fields[key];
  });
  return record;
}

// Builds the record (would-deny or pass) for a result and passes it to the sink, which writes it. options: {root, sink} replace the git-root
// lookup and the audit-log write (the self-test, which reads and writes no real log). Returns the record, or null.
function run(input, options) {
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
    { suffix: "this result was not checked for goal hijack", disabledNote: "tool results are not checked for goal hijack" }
  );
}

module.exports = { NAME, EVENT, DECISION, PASS, MODE, collectText, evaluate, run, main };

if (require.main === module) main();
