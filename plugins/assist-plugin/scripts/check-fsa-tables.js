#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Compares the transition tables in hooks/lib/fsa-tables.js with the `## States` tables in the agent and skill
// files, the test globs in hooks/lib/fsa-paths.js with the table under "## Write scope" in
// agents/developer-tester.md, and checks that every ```fsa example block in those files is a legal run of its
// table. An agent marked `tableless` in the JavaScript (qa) must have no `## States` section; only its example
// block is checked. The markdown is the source of truth: on drift, edit the JavaScript to match it.
//
// Usage (from any directory):
//   node scripts/check-fsa-tables.js           print the comparison; exit 0
//   node scripts/check-fsa-tables.js --check   print the comparison; exit 1 when anything differs
//
// Exit codes: 0 in sync (or no --check), 1 drift found by --check, 2 operational error (a file is unreadable).
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");

const PLUGIN_ROOT = path.resolve(__dirname, "..");
const tables = require(path.join(PLUGIN_ROOT, "hooks", "lib", "fsa-tables.js"));
const fsaPaths = require(path.join(PLUGIN_ROOT, "hooks", "lib", "fsa-paths.js"));

const TEMPLATE = "skills/do/references/fsa-template.md";
const WRITE_SCOPE_FILE = "agents/developer-tester.md";
const FENCE = /^[ \t]{0,3}(`{3,10}|~{3,10})/;
const NEXT_STATE = /^\s{0,4}([A-Z][A-Za-z]{0,30})(?:\(([a-z-]{1,30})\))?/;
const MAX_ROWS = 40;

function read(relative) {
  return fs.readFileSync(path.join(PLUGIN_ROOT, relative), "utf8").replace(/\r\n/g, "\n");
}

// Lines of the section that starts at `heading` (a "## " line) and runs to the next level-1 or level-2 heading
// outside a code fence.
function sectionLines(text, heading) {
  const lines = text.split("\n");
  const out = [];
  let inSection = false;
  let fence = null;
  lines.forEach((line) => {
    const mark = FENCE.exec(line);
    if (mark) {
      const kind = mark[1][0];
      fence = fence === kind ? null : fence || kind;
    }
    if (!fence && /^#{1,2} /.test(line)) {
      inSection = line.trim() === heading;
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

// Rows (arrays of cells) of the first table in `lines`, without the header and separator rows.
function firstTable(lines) {
  const rows = [];
  let started = false;
  for (let i = 0; i < lines.length && rows.length < MAX_ROWS; i++) {
    const isRow = /^\s*\|/.test(lines[i]);
    if (isRow) {
      started = true;
      rows.push(splitRow(lines[i]));
    } else if (started) {
      break;
    }
  }
  return rows.slice(2);
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

function main(argv) {
  const check = argv.indexOf("--check") !== -1;
  const results = tables.tableNames().map(checkTable);
  const files = unique(tables.tableNames().map((name) => tables.TABLES[name].source).concat([TEMPLATE]));
  files.forEach((file) => results.push(checkExamples(file)));
  results.push(checkGlobs());
  let drift = 0;
  results.forEach((result) => {
    console.log((result.problems.length ? "DRIFT " : "ok    ") + result.label);
    result.problems.forEach((problem) => console.log("      " + problem));
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
