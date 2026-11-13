#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-235|FR-236] Validates rules/control-register.md. It reads the first table under the "## Register" heading and
// checks each row for four mapped fields: an ASI id (ASI01 to ASI10) or a reasoned "not applicable" (the text
// "not applicable" plus a non-empty reason in the same cell), a NIST AI RMF function of GOVERN, MEASURE, or MANAGE, a
// non-empty owner, and a non-empty review cadence. It also applies the fixed per-regulation checks [NFR-033]:
//   - the FERPA internal-log row (requirement IDs cell holds FR-230) fails when the row text holds 99.32;
//   - the HIPAA row (FR-232) fails when the row text lacks 164.312(b) or holds an affirmative full-HIPAA-compliance
//     claim. A claim is a listed phrase not preceded by the whole word "not" or "no", so a scope statement such as
//     "not full HIPAA compliance" passes and a hedge such as "not yet full HIPAA compliance" fails;
//   - the FERPA disclosure row (FR-246) with a status that reads "to verify" passes and prints a notice [FR-246].
// Every citation test is a literal indexOf match, never a regular expression built from the citation: 164.312(b) holds
// parentheses and both citations hold a dot. The citation checks assume their row exists. The script neither asserts
// the row count nor row presence; the tests in tests/scripts/check-control-register.test.js enforce the row set.
//
// Usage (from any directory):
//   node scripts/check-control-register.js                  print the report; exit 0
//   node scripts/check-control-register.js --check          print the report; exit 1 when any row has a problem
//   node scripts/check-control-register.js [--check] --root DIR
// `--root` names a plugin root that holds rules/control-register.md (default: the plugin that holds this script).
//
// Exit codes [NFR-035]: 0 no problems (or no --check), 1 a problem found by --check, 2 operational error (an unknown
// flag, a root that is not a directory, an unreadable register file, or no control table under "## Register").
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");

const PLUGIN_ROOT = path.resolve(__dirname, "..");
const REGISTER_FILE = "rules/control-register.md";
const REGISTER_HEADING = "## Register";
const USAGE = "Usage: node scripts/check-control-register.js [--check] [--root DIR]";
const FENCE = /^[ \t]{0,3}(`{3,10}|~{3,10})/;

// Cell positions of the seven register fields, in schema order [FR-236].
const ID = 0;
const REQUIREMENTS = 1;
const ASI = 2;
const NIST = 3;
const OWNER = 4;
const CADENCE = 5;
const STATUS = 6;
const FIELD_COUNT = 7;

const ASI_ID = /^ASI(?:0[1-9]|10)\b/;
const NIST_FUNCTIONS = ["GOVERN", "MEASURE", "MANAGE"];
const NOT_APPLICABLE = "not applicable";
// Punctuation that may sit between "not applicable" and its reason, or around the reason: "(reason)", ": reason".
const REASON_PADDING = /^[\s:;,.()\-]+|[\s:;,.()\-]+$/g;

const FERPA_ROW = "FR-230";
const HIPAA_ROW = "FR-232";
const DISCLOSURE_ROW = "FR-246";
const FERPA_DISCLOSURE_CITATION = "99.32";
const HIPAA_CITATION = "164.312(b)";
const TO_VERIFY = "to verify";
// Lowercase phrases that read as a full-HIPAA-compliance claim.
const CLAIM_PHRASES = ["full hipaa compliance", "fully hipaa compliant", "complete hipaa compliance", "fully compliant with hipaa", "hipaa compliant"];
// The text before a claim phrase ends with the whole word "not" or "no" plus whitespace.
const NEGATION_BEFORE = /(?:^|[^a-z0-9])(?:not|no)\s+$/;

// Reads --check and --root. Any other argument is an operational error, so a typo never passes as a clean run.
function parseArgs(argv) {
  const options = { check: false, root: PLUGIN_ROOT };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--check") {
      options.check = true;
    } else if (argv[i] === "--root") {
      const value = argv[i + 1];
      if (!value || value.indexOf("--") === 0) throw new Error("--root needs a directory. " + USAGE);
      options.root = path.resolve(value);
      i++;
    } else {
      throw new Error("unknown argument " + JSON.stringify(argv[i]) + ". " + USAGE);
    }
  }
  return options;
}

// Lines under the first "## Register" heading, up to the next level-1 or level-2 heading, outside a code fence.
function registerLines(text) {
  const out = [];
  let inSection = false;
  let fence = null;
  text.split("\n").forEach((line) => {
    const mark = FENCE.exec(line);
    if (mark) {
      const kind = mark[1][0];
      fence = fence === kind ? null : fence || kind;
    }
    if (!fence && /^#{1,2} /.test(line)) {
      inSection = line.trim() === REGISTER_HEADING;
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

// Data rows (arrays of cells) of the first table in `lines`, without the header and separator rows.
function firstTableRows(lines) {
  const raw = [];
  let started = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\|/.test(lines[i])) {
      started = true;
      raw.push(splitRow(lines[i]));
    } else if (started) {
      break;
    }
  }
  return raw.slice(2);
}

// True when the cell is "not applicable" followed by a reason that holds a letter or digit.
function isReasonedNotApplicable(cell) {
  if (cell.toLowerCase().indexOf(NOT_APPLICABLE) !== 0) return false;
  const reason = cell.slice(NOT_APPLICABLE.length).replace(REASON_PADDING, "");
  return /[A-Za-z0-9]/.test(reason);
}

// Problems with the four mapped fields of one row [FR-235] [FR-236].
function fieldProblems(cells) {
  const problems = [];
  const asi = cells[ASI];
  if (!asi) problems.push("ASI field is empty");
  else if (!ASI_ID.test(asi) && !isReasonedNotApplicable(asi)) problems.push("ASI field is neither an ASI01 to ASI10 id nor a reasoned not applicable");
  if (!cells[NIST]) problems.push("NIST function is empty");
  else if (NIST_FUNCTIONS.indexOf(cells[NIST]) === -1) problems.push("NIST function " + cells[NIST] + " is not GOVERN, MEASURE, or MANAGE");
  if (!cells[OWNER]) problems.push("owner is empty");
  if (!cells[CADENCE]) problems.push("review cadence is empty");
  return problems;
}

// Listed full-compliance phrases that the row text claims. Hits that overlap are judged once, at the earliest start
// (so "fully hipaa compliant" is one hit, not also its tail "hipaa compliant"). A hit is a claim unless the whole word
// before it is "not" or "no". The check errs toward failing: "not yet full HIPAA compliance" is a claim.
function affirmativeClaims(rowText) {
  const text = rowText.toLowerCase();
  const hits = [];
  CLAIM_PHRASES.forEach((phrase) => {
    for (let at = text.indexOf(phrase); at !== -1; at = text.indexOf(phrase, at + 1)) {
      hits.push({ start: at, end: at + phrase.length, phrase: phrase });
    }
  });
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const claims = [];
  let judgedUpTo = 0;
  hits.forEach((hit) => {
    if (hit.start < judgedUpTo) return;
    judgedUpTo = hit.end;
    if (!NEGATION_BEFORE.test(text.slice(0, hit.start))) claims.push(hit.phrase);
  });
  return claims;
}

// True when the requirement IDs cell lists `requirementId` as a whole entry (FR-230 does not match FR-2301).
function namesRequirement(cells, requirementId) {
  return cells[REQUIREMENTS].split(/[\s,;]+/).indexOf(requirementId) !== -1;
}

// [NFR-033] Per-regulation problems of one row; `notices` collects the FR-246 unverified notice.
function regulationProblems(cells, notices) {
  const problems = [];
  const rowText = cells.join(" | ");
  if (namesRequirement(cells, FERPA_ROW) && rowText.indexOf(FERPA_DISCLOSURE_CITATION) !== -1) {
    problems.push(FERPA_ROW + " row cites 34 CFR " + FERPA_DISCLOSURE_CITATION + "; only " + DISCLOSURE_ROW + " carries that citation");
  }
  if (namesRequirement(cells, HIPAA_ROW)) {
    if (rowText.indexOf(HIPAA_CITATION) === -1) problems.push(HIPAA_ROW + " row omits 45 CFR " + HIPAA_CITATION);
    affirmativeClaims(rowText).forEach((phrase) => problems.push(HIPAA_ROW + " row makes a full-compliance claim: " + JSON.stringify(phrase)));
  }
  if (namesRequirement(cells, DISCLOSURE_ROW) && cells[STATUS].toLowerCase().indexOf(TO_VERIFY) !== -1) {
    notices.push("Notice: " + (cells[ID] || DISCLOSURE_ROW) + " (" + DISCLOSURE_ROW + ") is to verify against 34 CFR " + FERPA_DISCLOSURE_CITATION + "; the check passes it and the control stays unverified.");
  }
  return problems;
}

// One report entry per row: the label, and the named problems.
function inspectRow(cells, index, notices) {
  const label = (cells[ID] || "row " + (index + 1)) + (cells[REQUIREMENTS] ? " (" + cells[REQUIREMENTS] + ")" : "");
  if (cells.length !== FIELD_COUNT) return { label: label, problems: ["row has " + cells.length + " cells, expected " + FIELD_COUNT] };
  return { label: label, problems: fieldProblems(cells).concat(regulationProblems(cells, notices)) };
}

function readRegister(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error("root " + root + " is not a directory");
  const file = path.join(root, REGISTER_FILE);
  let text;
  try {
    text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  } catch (err) {
    throw new Error("cannot read " + file + ": " + err.message);
  }
  const rows = firstTableRows(registerLines(text));
  if (rows.length === 0) throw new Error(file + " has no control table under " + REGISTER_HEADING);
  return rows;
}

function main(argv) {
  const options = parseArgs(argv);
  const notices = [];
  const results = readRegister(options.root).map((cells, index) => inspectRow(cells, index, notices));
  let problems = 0;
  results.forEach((result) => {
    console.log((result.problems.length ? "DRIFT " : "ok    ") + result.label + (result.problems.length ? ": " + result.problems.join("; ") : ""));
    problems += result.problems.length;
  });
  notices.forEach((notice) => console.log(notice));
  console.log(problems === 0 ? "Control register: " + results.length + " row(s), no problems." : "Control register: " + problems + " problem(s) in " + results.length + " row(s).");
  return options.check && problems > 0 ? 1 : 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  console.error("check-control-register: " + (err && err.message ? err.message : String(err)));
  process.exitCode = 2;
}
