#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Compares the transition tables in hooks/lib/fsa-tables.js with the `## States` tables in the agent and skill
// files, the test globs in hooks/lib/fsa-paths.js with the table under "## Write scope" in
// agents/developer-tester.md, and checks that every ```fsa example block in those files is a legal run of its
// table. An agent marked `tableless` in the JavaScript (qa) must have no `## States` section; only its example
// block is checked. It also compares:
//   - verdictByStep (fsa-tables.js) with the verdicts in the Decide and Verify rows of the intake-reviewer
//     `## States` table [FR-126];
//   - PROTECTED_GLOBS, PROTECTED_FILES, and AUTO_LOADED (fsa-paths.js) with the tables under `## Write guard
//     lists` in rules/assist-plugin-rule.md [FR-128] [FR-129] [FR-180];
//   - TASK_PLAN_GLOB (fsa-paths.js) with the Task-plan glob table in that rule file and the one-row table under
//     "## Write scope" in agents/task-planner.md [FR-127] [FR-180].
// The markdown is the source of truth: on drift, edit the JavaScript to match it. A write guard value that exists
// only in the JavaScript, and any TASK_PLAN_GLOB difference, also prints a line saying the change needs a user
// decision recorded in DECISIONS.md first; the script never reads DECISIONS.md. A write guard heading that
// appears more than once, or a table longer than the row cap, is drift.
//
// Usage (from any directory):
//   node scripts/check-fsa-tables.js           print the comparison; exit 0
//   node scripts/check-fsa-tables.js --check   print the comparison; exit 1 when anything differs
//
// Exit codes: 0 in sync (or no --check), 1 drift found by --check (a missing or malformed write guard table is
// drift), 2 operational error (a file is unreadable or a `## States` table is missing).
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");

const PLUGIN_ROOT = path.resolve(__dirname, "..");
const tables = require(path.join(PLUGIN_ROOT, "hooks", "lib", "fsa-tables.js"));
const fsaPaths = require(path.join(PLUGIN_ROOT, "hooks", "lib", "fsa-paths.js"));

const TEMPLATE = "skills/do/references/fsa-template.md";
const WRITE_SCOPE_FILE = "agents/developer-tester.md";
const EXAMPLE_FILES = [TEMPLATE, "agents/developer-tester.md", "agents/task-planner.md"];
const FENCE = /^[ \t]{0,3}(`{3,10}|~{3,10})/;
const NEXT_STATE = /^\s{0,4}([A-Z][A-Za-z]{0,30})(?:\(([a-z-]{1,30})\))?/;
const MAX_ROWS = 40;
const RULE_FILE = "rules/assist-plugin-rule.md";
const GUARD_SECTION = "## Write guard lists";
const TASK_PLANNER_FILE = "agents/task-planner.md";
const INTAKE_REVIEWER = "intake-reviewer";
const DECISION_NOTE = "this write guard change needs a user decision recorded in DECISIONS.md before lib/fsa-paths.js follows the markdown";
// A write guard cell: one code span and nothing else. The value is the text inside the backticks.
const ONE_CODE_SPAN = /^`([^`]+)`$/;
// A verdictByStep pattern source of the form ^(a|b-c)$.
const PLAIN_VERDICT_LIST = /^\^\(([a-z]+(?:-[a-z]+)*(?:\|[a-z]+(?:-[a-z]+)*)*)\)\$$/;
const DONE_WITH_VERDICT = /^Done with verdict\s+`([^`]+)`/;
const MAX_CELL_CHARS = 80;

function read(relative) {
  return fs.readFileSync(path.join(PLUGIN_ROOT, relative), "utf8").replace(/\r\n/g, "\n");
}

// Scans for the heading line whose trimmed text equals `heading`, at level 1 to `maxLevel`, outside a code fence.
// Returns the lines under every such heading, each up to the next heading of level 1 to `maxLevel` (a repeated
// heading merges its sections), and `count`, the number of matching heading lines.
function scanSection(text, heading, maxLevel) {
  const lines = text.split("\n");
  const headingLine = new RegExp("^#{1," + maxLevel + "} ");
  const out = [];
  let count = 0;
  let inSection = false;
  let fence = null;
  lines.forEach((line) => {
    const mark = FENCE.exec(line);
    if (mark) {
      const kind = mark[1][0];
      fence = fence === kind ? null : fence || kind;
    }
    if (!fence && headingLine.test(line)) {
      inSection = line.trim() === heading;
      if (inSection) count++;
      return;
    }
    if (inSection) out.push(line);
  });
  return { lines: out, count };
}

// Lines of the section that starts at `heading` (a "## " line) and runs to the next level-1 or level-2 heading
// outside a code fence.
function sectionLines(text, heading) {
  return scanSection(text, heading, 2).lines;
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

// The first table in `lines`: `rows` are its data rows (arrays of cells) without the header and separator rows,
// `found` is true when any line starts with "|", and `truncated` is true when the MAX_ROWS cap stopped the read
// while the next line was still a table row.
function tableRows(lines) {
  const raw = [];
  let started = false;
  let i = 0;
  for (; i < lines.length && raw.length < MAX_ROWS; i++) {
    if (/^\s*\|/.test(lines[i])) {
      started = true;
      raw.push(splitRow(lines[i]));
    } else if (started) {
      break;
    }
  }
  return { rows: raw.slice(2), found: started, truncated: raw.length >= MAX_ROWS && i < lines.length && /^\s*\|/.test(lines[i]) };
}

// Rows (arrays of cells) of the first table in `lines`, without the header and separator rows.
function firstTable(lines) {
  return tableRows(lines).rows;
}

const unique = (list) => list.filter((item, index) => list.indexOf(item) === index);
const sorted = (list) => unique(list).sort();

// {states: [...], transitions: {state: [next...]}, terminals: [...], classes: [...]} from a States table.
function parseStates(relative) {
  const rows = firstTable(sectionLines(read(relative), "## States"));
  if (rows.length === 0) throw new Error(relative + " has no ## States table");
  const parsed = { states: [], transitions: {}, terminals: [], classes: [] };
  rows.forEach((row) => {
    const state = row[0];
    if (row[1] === "terminal") {
      parsed.terminals = state.split(",").map((name) => name.trim());
      return;
    }
    parsed.states.push(state);
    parsed.transitions[state] = [];
    (row[3] || "").split(";").forEach((segment) => {
      const cut = segment.indexOf("->");
      const arrow = cut === -1 ? null : NEXT_STATE.exec(segment.slice(cut + 2));
      if (!arrow) return;
      parsed.transitions[state].push(arrow[1]);
      if (arrow[2]) parsed.classes.push(arrow[2]);
    });
  });
  return parsed;
}

const TABLES_FILE = "lib/fsa-tables.js";
const PATHS_FILE = "lib/fsa-paths.js";

function diffSets(label, fromMarkdown, fromCode, problems, codeFile) {
  fromMarkdown.filter((item) => fromCode.indexOf(item) === -1).forEach((item) => problems.push(label + ": " + item + " is in the markdown only"));
  fromCode.filter((item) => fromMarkdown.indexOf(item) === -1).forEach((item) => problems.push(label + ": " + item + " is in " + (codeFile || TABLES_FILE) + " only"));
}

function checkTable(name) {
  const table = tables.TABLES[name];
  const problems = [];
  if (tables.isTableless(name)) {
    if (/^## States$/m.test(read(table.source))) problems.push(table.source + " has a ## States section but " + name + " is tableless in " + TABLES_FILE);
    return { label: name + " (" + table.source + "): no States table; any closed block is valid", problems };
  }
  const md = parseStates(table.source);
  const codeStates = tables.statesOf(name);
  if (md.states[0] !== tables.INITIAL) problems.push("first state is " + md.states[0] + ", expected " + tables.INITIAL);
  diffSets("state", sorted(md.states), sorted(codeStates), problems);
  diffSets("terminals", sorted(md.terminals), sorted(tables.TERMINALS), problems);
  md.classes.filter((cls) => tables.ERROR_CLASSES.indexOf(cls) === -1).forEach((cls) => problems.push("error class " + cls + " is not in the closed list"));
  codeStates.forEach((state) => {
    if (!md.transitions[state]) return;
    diffSets("transition from " + state, sorted(md.transitions[state]), sorted(table.transitions[state]), problems);
  });
  const edges = md.states.reduce((sum, state) => sum + sorted(md.transitions[state]).length, 0);
  return { label: name + " (" + table.source + "): " + md.states.length + " states, " + edges + " transitions", problems };
}

// Every ```fsa block in the file, as the text of the block.
function fsaBlocks(text) {
  const lines = text.split("\n");
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^[ \t]{0,3}`{3,10}fsa[ \t]*$/.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && !/^[ \t]{0,3}`{3,10}[ \t]*$/.test(lines[j])) j++;
    blocks.push(lines.slice(i, j + 1).join("\n"));
    i = j;
  }
  return blocks;
}

// A block whose `fsa:` value names a table must be a legal run of it. Placeholder blocks are skipped.
function checkExamples(relative) {
  const problems = [];
  let checked = 0;
  fsaBlocks(read(relative)).forEach((text) => {
    const block = tables.parseTerminalBlock(text);
    const named = block && typeof block.fsa === "string" ? block.fsa.split("/")[0] : "";
    if (!Object.prototype.hasOwnProperty.call(tables.TABLES, named)) return;
    checked++;
    const agent = tables.TABLES[named].agent ? named : "developer";
    tables.checkTrace(agent, block).forEach((problem) => problems.push("example block " + named + ": " + problem));
  });
  return { label: relative + ": " + checked + " example block(s)", problems };
}

function checkGlobs() {
  const rows = firstTable(sectionLines(read(WRITE_SCOPE_FILE), "## Write scope"));
  const markdown = rows.map((row) => row[0].replace(/`/g, ""));
  const problems = [];
  diffSets("test glob", sorted(markdown), sorted(fsaPaths.TEST_GLOBS), problems, PATHS_FILE);
  return { label: "test globs (" + WRITE_SCOPE_FILE + "): " + markdown.length + " globs", problems };
}

// Verdicts named in the Outcome cells of a `## States` table: a segment `-> Done with verdict` plus one code span
// names a verdict for its row's state. Returns {state: [verdict...]} for each state with at least one.
function parseVerdictPairs(relative) {
  const rows = firstTable(sectionLines(read(relative), "## States"));
  if (rows.length === 0) throw new Error(relative + " has no ## States table");
  const pairs = {};
  rows.forEach((row) => {
    if (row[1] === "terminal") return;
    (row[3] || "").split(";").forEach((segment) => {
      const cut = segment.indexOf("->");
      const done = cut === -1 ? null : DONE_WITH_VERDICT.exec(segment.slice(cut + 2).trim());
      if (!done) return;
      pairs[row[0]] = (pairs[row[0]] || []).concat(done[1]);
    });
  });
  return pairs;
}

// [FR-126] verdictByStep in lib/fsa-tables.js against the verdicts in the intake-reviewer Decide and Verify rows.
function checkVerdictPairing() {
  const table = tables.TABLES[INTAKE_REVIEWER] || {};
  const source = table.source || "agents/intake-reviewer.md";
  const md = parseVerdictPairs(source);
  const code = table.verdictByStep || {};
  const problems = [];
  const codeVerdicts = {};
  Object.keys(code).forEach((state) => {
    const plain = code[state] instanceof RegExp ? PLAIN_VERDICT_LIST.exec(code[state].source) : null;
    if (plain) codeVerdicts[state] = plain[1].split("|");
    else problems.push("verdictByStep." + state + " is not a plain list of verdicts");
  });
  const mdSteps = sorted(Object.keys(md));
  const codeSteps = sorted(Object.keys(code));
  mdSteps.filter((state) => codeSteps.indexOf(state) === -1).forEach((state) => problems.push("verdict step " + state + " is in the markdown only"));
  codeSteps.filter((state) => mdSteps.indexOf(state) === -1).forEach((state) => problems.push("verdict step " + state + " is in " + TABLES_FILE + " only"));
  mdSteps.filter((state) => codeVerdicts[state]).forEach((state) => {
    diffSets("verdict after " + state, sorted(md[state]), sorted(codeVerdicts[state]), problems);
  });
  return { label: "verdict pairing (" + source + "): " + mdSteps.length + " steps", problems, notes: [] };
}

// [FR-180] The first table in `lines` as write guard rows. Each data row must start with exactly one code span; its
// value is the text inside the backticks. `missing` is true when the lines hold no "|" line at all (a table with a
// header and no data rows is not missing; it has 0 rows). `comparable` is false when the table is missing, a cell
// is malformed, or the row cap cut the table short, so the caller reports the problem and skips the value comparison.
function readGuardTable(file, heading, lines) {
  const found = tableRows(lines);
  const rows = found.rows;
  const table = { rows: rows.length, values: [], problems: [], missing: !found.found, comparable: found.found };
  if (table.missing) {
    table.problems.push(file + ": no table under " + heading);
    return table;
  }
  if (found.truncated) {
    table.comparable = false;
    table.problems.push(file + ", " + heading + ": more than " + (MAX_ROWS - 2) + " data rows; the rest are not read");
  }
  rows.forEach((row, index) => {
    const span = ONE_CODE_SPAN.exec(row[0]);
    if (span) {
      table.values.push(span[1]);
      return;
    }
    table.comparable = false;
    table.problems.push(file + ", " + heading + ", row " + (index + 1) + ": first cell " + row[0].slice(0, MAX_CELL_CHARS) + " is not one code span");
  });
  unique(table.values).filter((value) => table.values.indexOf(value) !== table.values.lastIndexOf(value))
    .forEach((value) => table.problems.push(file + ", " + heading + ": " + value + " is listed twice"));
  return table;
}

// A heading that appears more than once merges its sections, so only the first table is compared: drift.
function headingRepeats(file, heading, count) {
  return count > 1 ? [file + ": " + heading + " appears " + count + " times"] : [];
}

// The lines of a "###" subsection of the Write guard lists section (`guard` is its scanSection result), with the
// repeated-heading problems of the section and of the subsection.
function guardSubsection(guard, heading) {
  const sub = scanSection(guard.lines.join("\n"), heading, 3);
  return { lines: sub.lines, repeats: headingRepeats(RULE_FILE, GUARD_SECTION, guard.count).concat(headingRepeats(RULE_FILE, heading, sub.count)) };
}

const outside = (list, other) => list.filter((item) => other.indexOf(item) === -1);

// [FR-128] [FR-129] A write guard list in lib/fsa-paths.js against its table in the rule file. A value only in the
// JavaScript would drop a protection the hook enforces today, so that case prints the decision line.
function checkGuardList(name, heading, codeList, guard) {
  const scope = guardSubsection(guard, heading);
  const table = readGuardTable(RULE_FILE, heading, scope.lines);
  const markdown = sorted(table.values);
  const problems = scope.repeats.concat(table.problems);
  const notes = [];
  if (table.comparable) {
    diffSets(name, markdown, sorted(codeList), problems, PATHS_FILE);
    if (outside(codeList, markdown).length > 0) notes.push(DECISION_NOTE);
  }
  return { label: "write guard list " + name + " (" + RULE_FILE + ", " + heading + "): " + markdown.length + " entries", problems, notes };
}

// [FR-127] TASK_PLAN_GLOB against a one-row table. Any value difference widens or narrows what task-planner may
// write, so it prints the decision line; a row-count problem alone does not.
function checkTaskPlanGlob(file, heading, scope) {
  const table = readGuardTable(file, heading, scope.lines);
  const markdown = sorted(table.values);
  const code = [fsaPaths.TASK_PLAN_GLOB];
  const problems = scope.repeats.concat(table.problems);
  const notes = [];
  if (!table.missing && table.rows !== 1) problems.push(file + ", " + heading + ": " + table.rows + " rows; expected 1");
  if (table.comparable) {
    diffSets("TASK_PLAN_GLOB", markdown, code, problems, PATHS_FILE);
    if (outside(code, markdown).length > 0 || outside(markdown, code).length > 0) notes.push(DECISION_NOTE);
  }
  return { label: "TASK_PLAN_GLOB (" + file + ", " + heading + ")", problems, notes };
}

function main(argv) {
  const check = argv.indexOf("--check") !== -1;
  const results = tables.tableNames().map(checkTable);
  const files = unique(tables.tableNames().map((name) => tables.TABLES[name].source).concat(EXAMPLE_FILES));
  files.forEach((file) => results.push(checkExamples(file)));
  results.push(checkGlobs());
  results.push(checkVerdictPairing());
  const guard = scanSection(read(RULE_FILE), GUARD_SECTION, 2);
  results.push(checkGuardList("PROTECTED_GLOBS", "### Protected globs", fsaPaths.PROTECTED_GLOBS, guard));
  results.push(checkGuardList("PROTECTED_FILES", "### Protected files", fsaPaths.PROTECTED_FILES, guard));
  results.push(checkGuardList("AUTO_LOADED", "### Auto-loaded names", fsaPaths.AUTO_LOADED, guard));
  results.push(checkTaskPlanGlob(RULE_FILE, "### Task-plan glob", guardSubsection(guard, "### Task-plan glob")));
  const writeScope = scanSection(read(TASK_PLANNER_FILE), "## Write scope", 2);
  results.push(checkTaskPlanGlob(TASK_PLANNER_FILE, "## Write scope", { lines: writeScope.lines, repeats: headingRepeats(TASK_PLANNER_FILE, "## Write scope", writeScope.count) }));
  let drift = 0;
  results.forEach((result) => {
    console.log((result.problems.length ? "DRIFT " : "ok    ") + result.label);
    result.problems.forEach((problem) => console.log("      " + problem));
    (result.notes || []).forEach((note) => console.log("      " + note));
    drift += result.problems.length;
  });
  console.log(drift === 0 ? "FSA tables match the markdown." : drift + " difference(s) between lib and the markdown. The markdown is the source of truth.");
  return check && drift > 0 ? 1 : 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  console.error("check-fsa-tables: " + (err && err.message ? err.message : String(err)));
  process.exitCode = 2;
}
