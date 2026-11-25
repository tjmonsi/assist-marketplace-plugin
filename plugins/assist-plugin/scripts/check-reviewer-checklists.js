#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-288] Validates rules/reviewer-checklists.md. It reads the first table under the "## Register" heading and checks
// each item row for an id, a check, an evidence entry, a lane among the three review lanes, and an applies-to list made
// only of the five canonical artifact types (code, config, test, pipeline, planning document).
// [FR-291] It reads the first table under the "## Lane-to-gate table" heading and checks that each of the three lanes is
// assigned to at least one existing gate, and that each lane holds at least one checklist item.
//
// Output holds item ids, lane names, and fixed reasons only. It never prints row text, a cell value, or a raw error
// message, so a hostile register row cannot reach the console or a log.
//
// Usage (from any directory):
//   node scripts/check-reviewer-checklists.js                  print the report; exit 0
//   node scripts/check-reviewer-checklists.js --check          print the report; exit 1 when any problem is found
//   node scripts/check-reviewer-checklists.js [--check] --root DIR
// `--root` names a plugin root that holds rules/reviewer-checklists.md (default: the plugin that holds this script).
//
// Exit codes: 0 no problems (or no --check), 1 a problem found by --check, 2 operational error (an unknown flag, a root
// that is not a directory, an unreadable checklist file, or a missing or malformed table).
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");

const PLUGIN_ROOT = path.resolve(__dirname, "..");
const CHECKLIST_FILE = "rules/reviewer-checklists.md";
const REGISTER_HEADING = "## Register";
const GATE_HEADING = "## Lane-to-gate table";
const USAGE = "Usage: node scripts/check-reviewer-checklists.js [--check] [--root DIR]";
const FENCE = /^[ \t]{0,3}(`{3,10}|~{3,10})/;

// Required header names of each table. Header names are matched exactly; their order is free.
const REGISTER_COLUMNS = { id: "ID", lane: "Lane", check: "Check", evidence: "Evidence that clears it", appliesTo: "Applies to" };
const GATE_COLUMNS = { lane: "Lane", gates: "Existing gates that apply it" };

// [FR-288] The three review lanes.
const LANES = ["defect-depth", "test-integrity", "architecture-safety"];
// [FR-288] The five canonical artifact types the reviewer Intake accepts; no other applies-to value is valid.
const ARTIFACT_TYPES = ["code", "config", "test", "pipeline", "planning document"];
// [FR-291] The existing review gates a lane may be assigned to. No gate is added by this file.
const EXISTING_GATES = ["Pre-Test Code Review Gate", "Security Gate", "Testing Gate", "Code Review Gate", "Planning Document Review Gate", "OWASP for LLM Gate"];
// An item id echoed in the report must have this shape; anything else is reported as "row N".
const ITEM_ID = /^[A-Z]{2}-\d{2}$/;

// Operational failures carry a fixed reason. Anything else that reaches the top level is reported as "unexpected error".
class OperationalError extends Error {}

// Reads --check and --root. Any other argument is an operational error, so a typo never passes as a clean run.
function parseArgs(argv) {
  const options = { check: false, root: PLUGIN_ROOT };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--check") {
      options.check = true;
    } else if (argv[i] === "--root") {
      const value = argv[i + 1];
      if (!value || value.indexOf("--") === 0) throw new OperationalError("--root needs a directory. " + USAGE);
      options.root = path.resolve(value);
      i++;
    } else {
      throw new OperationalError("unknown argument. " + USAGE);
    }
  }
  return options;
}

// Lines under the first `heading`, up to the next level-1 or level-2 heading, outside a code fence.
function sectionLines(text, heading) {
  const out = [];
  let inSection = false;
  let seen = false;
  let fence = null;
  text.split("\n").forEach((line) => {
    const mark = FENCE.exec(line);
    if (mark) {
      const kind = mark[1][0];
      fence = fence === kind ? null : fence || kind;
    }
    if (!fence && /^#{1,2} /.test(line)) {
      inSection = !seen && line.trim() === heading;
      if (inSection) seen = true;
      return;
    }
    if (inSection) out.push(line);
  });
  return out;
}

// Splits a table row on "|" outside backtick code spans.
function splitRow(line) {
  const cells = [];
  let cell = "";
  let code = false;
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "`") code = !code;
    if (ch === "|" && !code) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells;
}

// The first table in `lines` as { header, rows }, where rows exclude the header and separator rows. Null when none.
function firstTable(lines) {
  const raw = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\|/.test(lines[i])) {
      raw.push(splitRow(lines[i]));
    } else if (raw.length > 0) {
      break;
    }
  }
  if (raw.length < 2) return null;
  return { header: raw[0], rows: raw.slice(2) };
}

// Maps each key of `columns` to its cell position in `header`. A missing required column is an operational error.
function columnIndexes(header, columns, heading) {
  const indexes = {};
  Object.keys(columns).forEach((key) => {
    const at = header.indexOf(columns[key]);
    if (at === -1) throw new OperationalError("the table under " + heading + " lacks the column " + columns[key]);
    indexes[key] = at;
  });
  return indexes;
}

// Reads and parses one table of the checklist text; an absent table is an operational error.
function readTable(text, heading, columns) {
  const table = firstTable(sectionLines(text, heading));
  if (!table || table.rows.length === 0) throw new OperationalError(CHECKLIST_FILE + " has no table under " + heading);
  return { cols: columnIndexes(table.header, columns, heading), width: table.header.length, rows: table.rows };
}

// Splits a list cell on `separator` into trimmed, non-empty entries.
function listOf(cell, separator) {
  return (cell || "").split(separator).map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

// [FR-288] Problems of one register row. `label` is the item id, or "row N" when the id is missing or malformed.
function itemProblems(cells, label, table) {
  const problems = [];
  if (!ITEM_ID.test(cells[table.cols.id] || "")) problems.push(label + ": no id");
  if (cells.length !== table.width) problems.push(label + ": wrong number of cells");
  if (!cells[table.cols.check]) problems.push(label + ": no check");
  if (!cells[table.cols.evidence]) problems.push(label + ": no evidence entry");
  if (LANES.indexOf(cells[table.cols.lane]) === -1) problems.push(label + ": lane is not one of the three review lanes");
  const types = listOf(cells[table.cols.appliesTo], ",");
  if (types.length === 0 || types.some((type) => ARTIFACT_TYPES.indexOf(type) === -1)) {
    problems.push(label + ": applies-to is empty or holds a value outside the five canonical artifact types");
  }
  return problems;
}

// [FR-288] Register problems, and the set of lanes that hold at least one item.
function registerProblems(table) {
  const problems = [];
  const lanesWithItems = {};
  table.rows.forEach((cells, index) => {
    const id = cells[table.cols.id] || "";
    const label = ITEM_ID.test(id) ? id : "row " + (index + 1);
    if (LANES.indexOf(cells[table.cols.lane]) !== -1) lanesWithItems[cells[table.cols.lane]] = true;
    itemProblems(cells, label, table).forEach((problem) => problems.push(problem));
  });
  return { problems: problems, lanesWithItems: lanesWithItems };
}

// True when `entry` is exactly a gate name, or starts with it followed by a space (a note such as "(applied by qa)").
function namesExistingGate(entry) {
  return EXISTING_GATES.some((gate) => entry === gate || entry.indexOf(gate + " ") === 0);
}

// [FR-291] Lane problems: each lane has items, has a row in the gate table, and every gate the row lists exists.
function laneProblems(gateTable, lanesWithItems) {
  const problems = [];
  const gatesByLane = {};
  gateTable.rows.forEach((cells) => {
    const lane = cells[gateTable.cols.lane];
    if (LANES.indexOf(lane) === -1) {
      problems.push("lane-to-gate table: a row names a lane outside the three review lanes");
      return;
    }
    gatesByLane[lane] = (gatesByLane[lane] || []).concat(listOf(cells[gateTable.cols.gates], ";"));
  });
  LANES.forEach((lane) => {
    if (!lanesWithItems[lane]) problems.push("lane " + lane + ": no checklist items");
    const gates = gatesByLane[lane] || [];
    if (gates.length === 0) problems.push("lane " + lane + ": assigned to no gate");
    else if (!gates.every(namesExistingGate)) problems.push("lane " + lane + ": assigned to a gate that does not exist");
  });
  return problems;
}

function readChecklists(root) {
  let isDirectory = false;
  try {
    isDirectory = fs.statSync(root).isDirectory();
  } catch (err) {
    isDirectory = false;
  }
  if (!isDirectory) throw new OperationalError("root is not a directory");
  let text;
  try {
    text = fs.readFileSync(path.join(root, CHECKLIST_FILE), "utf8").replace(/\r\n/g, "\n");
  } catch (err) {
    throw new OperationalError("cannot read " + CHECKLIST_FILE);
  }
  return {
    register: readTable(text, REGISTER_HEADING, REGISTER_COLUMNS),
    gates: readTable(text, GATE_HEADING, GATE_COLUMNS)
  };
}

function main(argv) {
  const options = parseArgs(argv);
  const checklists = readChecklists(options.root);
  const register = registerProblems(checklists.register);
  const problems = register.problems.concat(laneProblems(checklists.gates, register.lanesWithItems));
  problems.forEach((problem) => console.log("FAIL  " + problem));
  const items = checklists.register.rows.length;
  console.log(problems.length === 0 ? "Reviewer checklists: " + items + " item(s), no problems." : "Reviewer checklists: " + problems.length + " problem(s) in " + items + " item(s).");
  return options.check && problems.length > 0 ? 1 : 0;
}

// Process-level handlers keep one bad input from ending the run with an unclassified code or a raw stack on stderr.
process.on("uncaughtException", () => {
  console.error("check-reviewer-checklists: unexpected error");
  process.exit(2);
});

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  console.error("check-reviewer-checklists: " + (err instanceof OperationalError ? err.message : "unexpected error"));
  process.exitCode = 2;
}
