// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Transition tables and terminal-block checks for the assist-plugin agent FSAs.
//
// TABLES mirrors the `## States` tables in the agent and skill files (listed in SOURCES). The markdown is the
// source of truth: scripts/check-fsa-tables.js --check parses those tables and fails on any drift from this
// file. Each table lists a state and the states it can move to, in table order. `Error(<class>)` and the
// exits to `NeedsInput` count as transitions to the terminal states `Error` and `NeedsInput`. An agent with no
// `## States` table (qa) has `tableless: true`: its block is valid when it is closed, names the agent, and ends
// in Done, NeedsInput, or Error with a verdict from the agent's list; its trace is not checked.
//
// parseTerminalBlock() reads the last ```fsa block of a final message. checkTrace() compares the block with the
// agent's table and returns a list of problems. Both are pure and bounded; callers decide what to do with the
// result (the hooks only warn). ES2015 syntax, no dependencies.
"use strict";

const TERMINALS = ["Done", "NeedsInput", "Error"];

// Closed list from skills/do/references/fsa-template.md. `none` is the value outside an Error.
const ERROR_CLASSES = [
  "missing-input", "precondition-failed", "policy-rejection", "budget-exhausted",
  "tool-missing", "tool-failed", "out-of-scope",
];

// One entry per FSA. `agent` is true when /do dispatches it as `assist-plugin:<name>`. `source` is the file that
// holds the `## States` table (for a tableless agent, the file with its example block), relative to the plugin
// root. `verdict` is the pattern of the block's verdict on Done. `alsoEmits` names tables the agent may report
// under another `fsa:` name.
const TABLES = {
  "developer-tester": {
    version: 1,
    source: "skills/create-test/SKILL.md",
    agent: true,
    verdict: /^covered=\d{1,6} uncovered=\d{1,6}$/,
    transitions: {
      Intake: ["AssembleContext", "NeedsInput", "Error"],
      AssembleContext: ["PlanCoverage", "NeedsInput"],
      PlanCoverage: ["CheckCoverage"],
      CheckCoverage: ["WriteTests", "PlanCoverage", "Error"],
      WriteTests: ["SelfCheck", "Error"],
      SelfCheck: ["Done", "WriteTests", "Error"],
    },
  },
  qa: {
    version: 1,
    source: "agents/qa.md",
    agent: true,
    tableless: true,
    verdict: /^(approved|returned|none)$/,
    transitions: {},
  },
  reviewer: {
    version: 1,
    source: "agents/reviewer.md",
    agent: true,
    verdict: /^(approved|returned)$/,
    transitions: {
      Intake: ["AssembleContext", "Error", "NeedsInput"],
      AssembleContext: ["Review", "Error"],
      Review: ["Decide"],
      Decide: ["Done"],
    },
  },
  "code-reviewer": {
    version: 1,
    source: "agents/code-reviewer.md",
    agent: true,
    verdict: /^(approved|returned)$/,
    transitions: {
      Intake: ["AssembleContext", "Error", "NeedsInput"],
      AssembleContext: ["Review", "Error"],
      Review: ["Decide"],
      Decide: ["Done"],
    },
  },
  "intake-reviewer": {
    version: 1,
    source: "agents/intake-reviewer.md",
    agent: true,
    verdict: /^(accepted|needs-changes)$/,
    transitions: {
      Intake: ["Review", "Error", "NeedsInput"],
      Review: ["Decide"],
      Decide: ["Done"],
    },
  },
  developer: {
    version: 1,
    source: "agents/developer.md",
    agent: true,
    alsoEmits: ["task-plan"],
    verdict: /^self-check=(pass|fail|not-run)$/,
    transitions: {
      Intake: ["AssembleContext", "Error", "NeedsInput"],
      AssembleContext: ["Plan", "Error", "NeedsInput"],
      Plan: ["ProduceEdit", "NeedsInput"],
      ProduceEdit: ["SelfCheck"],
      SelfCheck: ["Done", "ProduceEdit"],
    },
  },
  // A skill, not an agent: the developer agent reports it when task-plan is the whole step.
  "task-plan": {
    version: 1,
    source: "skills/task-plan/SKILL.md",
    agent: false,
    verdict: /^steps=\d{1,6}$/,
    transitions: {
      Intake: ["ClassifyContext", "NeedsInput", "Error"],
      ClassifyContext: ["ExtractRequirements", "NeedsInput"],
      ExtractRequirements: ["PlanSteps"],
      PlanSteps: ["CheckPlan"],
      CheckPlan: ["WritePlan", "PlanSteps", "Error"],
      WritePlan: ["Done"],
    },
  },
};

const INITIAL = "Intake";
const INVALID = "<invalid>";
const MAX_SCAN_CHARS = 200000; // only the tail of a final message is searched for the block
const MAX_BLOCK_LINES = 30;
const MAX_VALUE_CHARS = 400;
const MAX_TRACE_STATES = 40;
const MAX_PROBLEMS = 8;
const AGENT_PREFIX = "assist-plugin:";

const OPEN_FENCE = /^[ \t]{0,3}`{3,10}[ \t]{0,8}fsa[ \t]{0,8}$/;
const CLOSE_FENCE = /^[ \t]{0,3}`{3,10}[ \t]{0,8}$/;
const FIELD_LINE = /^([a-z_]{1,20}):[ \t]{0,8}(.{0,400})$/;
const STATE_NAME = /^[A-Za-z]{1,30}$/;

function has(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function tableNames() {
  return Object.keys(TABLES);
}

function isTableless(name) {
  return has(TABLES, name) && TABLES[name].tableless === true;
}

function statesOf(name) {
  return has(TABLES, name) ? Object.keys(TABLES[name].transitions) : [];
}

// Short agent name for an `assist-plugin:<name>` agent_type (or the bare name when lenient), else null.
// Only agents with `agent: true` match: task-plan is a skill.
function agentFromType(agentType, lenient) {
  if (typeof agentType !== "string" || agentType.length > 80) return null;
  let name = agentType;
  if (name.indexOf(AGENT_PREFIX) === 0) name = name.slice(AGENT_PREFIX.length);
  else if (!lenient) return null;
  return has(TABLES, name) && TABLES[name].agent ? name : null;
}

// The last complete ```fsa block in `text` as {key: value}, or null. Values are trimmed single-line strings;
// lines that are not `key: value` and lines past the bound are ignored. An unclosed block does not count.
function parseTerminalBlock(text) {
  if (typeof text !== "string" || text.length === 0) return null;
  const tail = text.length > MAX_SCAN_CHARS ? text.slice(text.length - MAX_SCAN_CHARS) : text;
  const lines = tail.split("\n");
  let found = null;
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");
    if (open === null) {
      if (OPEN_FENCE.test(line)) open = {};
      continue;
    }
    if (CLOSE_FENCE.test(line)) {
      found = open;
      open = null;
      continue;
    }
    const count = Object.keys(open).length;
    const match = count < MAX_BLOCK_LINES ? FIELD_LINE.exec(line) : null;
    if (match) open[match[1]] = match[2].replace(/\s+$/, "");
  }
  return found;
}

// A value from the model echoed in a problem only when it is one of the known `allowed` values. Anything else
// becomes "<invalid>", so problems (which reach the log and the user) never hold text the model chose.
function safe(value, allowed) {
  return typeof value === "string" && allowed.indexOf(value) !== -1 ? value : INVALID;
}

function splitTrace(trace) {
  return trace.split(">").map((part) => part.trim());
}

// Which table applies: the one the block names when this agent may report it, else the agent's own.
function pickTable(agent, block) {
  const own = has(TABLES, agent) ? TABLES[agent] : null;
  if (!own) return null;
  const named = typeof block.fsa === "string" ? block.fsa.split("/")[0] : "";
  const allowed = [agent].concat(own.alsoEmits || []);
  return allowed.indexOf(named) !== -1 ? named : agent;
}

// Problems as short strings: `code` or `code: detail`. An empty list means the block is a legal run of the table.
function checkTrace(agent, block) {
  if (!has(TABLES, agent)) return ["unknown-agent"];
  if (!block || typeof block !== "object") return ["no-block"];
  const problems = [];
  const name = pickTable(agent, block);
  const table = TABLES[name];
  const expectedFsa = name + "/" + table.version;
  if (block.fsa !== expectedFsa) problems.push("fsa-mismatch: " + safe(block.fsa, tableNames().map((key) => key + "/" + TABLES[key].version)));

  const state = block.state;
  if (TERMINALS.indexOf(state) === -1) problems.push("bad-state: " + safe(state, Object.keys(table.transitions)));

  if (table.tableless) {
    // No States table: the trace is free text, so it is not checked.
  } else if (typeof block.trace !== "string" || block.trace.length === 0) {
    problems.push("missing-field: trace");
  } else {
    const trace = splitTrace(block.trace);
    if (trace.length > MAX_TRACE_STATES) {
      problems.push("trace-too-long");
    } else {
      checkPath(table, trace, state, problems);
    }
  }

  checkError(block.error_class, state, problems);
  checkVerdict(table, block.verdict, state, problems);
  if (state === "NeedsInput" && !table.tableless && statesOf(name).indexOf(block.resume_at) === -1) {
    problems.push("bad-resume-at");
  }
  return problems.slice(0, MAX_PROBLEMS);
}

function checkPath(table, trace, state, problems) {
  const known = Object.keys(table.transitions).concat(TERMINALS);
  const unknown = trace.filter((step) => known.indexOf(step) === -1);
  if (unknown.length > 0) problems.push("unknown-state");
  if (trace[0] !== INITIAL) problems.push("bad-start: " + safe(trace[0], known));
  let illegal = 0;
  for (let i = 0; i + 1 < trace.length && illegal < 3; i++) {
    const from = trace[i];
    const to = trace[i + 1];
    if (known.indexOf(from) === -1 || known.indexOf(to) === -1) continue;
    const allowed = has(table.transitions, from) ? table.transitions[from] : [];
    if (allowed.indexOf(to) === -1) {
      illegal++;
      problems.push("illegal-transition: " + from + ">" + to);
    }
  }
  const last = trace[trace.length - 1];
  if (TERMINALS.indexOf(last) === -1) problems.push("trace-not-terminal: " + safe(last, known));
  else if (last !== state && TERMINALS.indexOf(state) !== -1) problems.push("terminal-mismatch: " + last + " vs " + state);
}

function checkError(errorClass, state, problems) {
  const known = ERROR_CLASSES.indexOf(errorClass) !== -1;
  const values = ERROR_CLASSES.concat(["none"]);
  if (state === "Error") {
    if (!known) problems.push("bad-error-class: " + safe(errorClass, values) + " on Error");
  } else if (errorClass !== "none") {
    problems.push("bad-error-class: " + safe(errorClass, values) + " on " + safe(state, TERMINALS));
  }
}

function checkVerdict(table, verdict, state, problems) {
  if (verdict === "none" && state !== "Done") return;
  if (typeof verdict !== "string" || !table.verdict.test(verdict)) problems.push("bad-verdict");
}

// Number of items in the block's `out_of_scope` field: 0 for `none` or a missing field, else the count of
// comma-separated items (at most MAX_COUNT). The items are free text and are never stored; only the count is.
const MAX_COUNT = 99;
function outOfScopeCount(value) {
  if (typeof value !== "string") return 0;
  const text = value.trim();
  if (text === "" || text === "none") return 0;
  return Math.min(text.split(",").filter((item) => item.trim().length > 0).length, MAX_COUNT);
}

// The block fields that are safe to store: each is checked against its closed list or pattern, and anything else
// becomes "<invalid>". Free-text fields (artifact, skipped, questions, out_of_scope) are never copied;
// out_of_scope is stored as a count only.
function summarize(agent, block) {
  const name = pickTable(agent, block);
  if (!name || !block || typeof block !== "object") return {};
  const table = TABLES[name];
  const known = Object.keys(table.transitions).concat(TERMINALS);
  const out = {};
  out.fsa = typeof block.fsa === "string" && /^[a-z-]{1,30}\/\d{1,3}$/.test(block.fsa) ? block.fsa : INVALID;
  out.state = TERMINALS.indexOf(block.state) !== -1 ? block.state : INVALID;
  out.verdict = block.verdict === "none" || (typeof block.verdict === "string" && table.verdict.test(block.verdict)) ? block.verdict : INVALID;
  out.error_class = block.error_class === "none" || ERROR_CLASSES.indexOf(block.error_class) !== -1 ? block.error_class : INVALID;
  out.out_of_scope_count = outOfScopeCount(block.out_of_scope);
  if (typeof block.trace === "string" && !table.tableless) {
    out.trace = splitTrace(block.trace).slice(0, MAX_TRACE_STATES).map((step) => (known.indexOf(step) !== -1 ? step : INVALID)).join(">");
  }
  return out;
}

module.exports = {
  TERMINALS,
  ERROR_CLASSES,
  TABLES,
  INITIAL,
  tableNames,
  isTableless,
  statesOf,
  outOfScopeCount,
  agentFromType,
  parseTerminalBlock,
  checkTrace,
  summarize,
  safe,
};
