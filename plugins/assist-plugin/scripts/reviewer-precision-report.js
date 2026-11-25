#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [spec-reviewer-machinery Req 21 -> FR-310] The user-run precision and checklist-change report of the reviewer checklists. It
// reads the finding store .agent/governance/review-findings.jsonl and the register rules/reviewer-checklists.md, and prints
// the counts of findings labeled true, labeled false, deferred, and unlabeled and the precision per lane and per item
// (hooks/lib/review-labels.js). Only a label the user wrote counts: a record needs `labelled_by: "user"`, set by
// scripts/label-findings.js [NFR-034, SC-028].
// [spec-reviewer-machinery Req 21 -> FR-313|FR-314] It then prints the checklist-change report: the items below the precision
// floor over enough labeled findings (retirement candidates) and the unmapped finding classes raised often enough (addition
// candidates).
// [spec-reviewer-machinery Req 21 -> FR-316] With a --before and an --after seeded-sample result it prints precision and recall
// before and after a proposed change and the sample size; without them it states that no measurement exists.
// [spec-reviewer-machinery Req 24 -> FR-315] The script applies no checklist edit and writes no file. A checklist change
// needs the user's approval, a DECISIONS.md entry, and LLM Security Clear.
//
// Usage:
//   node scripts/reviewer-precision-report.js [--floor N] [--min-labeled N] [--unmapped-count N]
//                                             [--before FILE --after FILE] [--root DIR]
// --floor is a precision from 0 to 1. --min-labeled and --unmapped-count are whole numbers of 1 or more. Each overrides a
// PROVISIONAL default (floor 0.5, 10 labeled findings, count 3; OQ-17, to be revised with data), and the report labels each
// value it used as provisional or as set by the flag. --root is the project root that holds .agent/ (default:
// CLAUDE_PROJECT_DIR, else the working directory, then its git root).
//
// Seeded-sample result file (--before, --after): one JSON object {"true_positive": N, "false_positive": N, "false_negative": N},
// each a whole number of 0 or more. The sample size is the seeded defects, true_positive plus false_negative; it must be at
// least 1. The provisional size is 20 defects (U-3); a sample of another size is accepted and its size is printed. No precision
// or recall floor is applied, because the spec sets none (U-3).
//
// Exit codes:
//   0  a report was printed (also for an empty or missing store)
//   2  cannot report: bad arguments (an unknown flag, a flag with no value or an unusable one, --before without --after), a
//      project root that does not exist or cannot be read, an unreadable store or register, or an unreadable sample file
//
// Read only. The report prints counts, lane names, item ids, rule ids of unmapped classes, and sample sizes: no finding text,
// no file path, and no store line. A store line that is not a valid finding is counted as skipped, not parsed further.
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");

const baseline = require(path.join(__dirname, "baseline-report.js"));
const labels = require(path.join(__dirname, "..", "hooks", "lib", "review-labels.js"));
const severity = require(path.join(__dirname, "..", "hooks", "lib", "severity.js"));

const EXIT_OK = 0;
const EXIT_CANNOT = 2;

const PLUGIN_ROOT = path.resolve(__dirname, "..");
const REGISTER_FILE = path.join("rules", "reviewer-checklists.md");
const REGISTER_HEADING = "## Register";
const ITEM_ID = /^[A-Z]{2}-\d{2}$/;
const MAX_STORE_BYTES = 64 * 1024 * 1024;
const MAX_SAMPLE_BYTES = 1024 * 1024;
// PROVISIONAL (U-3): the size of the seeded-defect sample of FR-316, to be revised with data. A sample of another size is accepted.
const PROVISIONAL_SAMPLE_SIZE = 20;

const USAGE = "Usage: node scripts/reviewer-precision-report.js [--floor N] [--min-labeled N] [--unmapped-count N] [--before FILE --after FILE] [--root DIR]";

// Flags that take a value, and the options they set.
const VALUE_FLAGS = ["--floor", "--min-labeled", "--unmapped-count", "--before", "--after", "--root"];

function errorCode(err) {
  return err && typeof err.code === "string" ? err.code : "unknown";
}

function cannotReport(message) {
  return { code: EXIT_CANNOT, lines: ["Cannot report reviewer precision: " + message] };
}

// ---- Reading ---------------------------------------------------------------------------------------------------------

// The raw finding records of the store at `root` that pass the shared finding validator (hooks/lib/severity.js), with the count
// of lines skipped. The raw record is kept because the normalized one drops `labelled_by`, `source`, and the "deferred" label.
// A missing store holds no records. Throws on any other read error; check() catches it.
function readRecords(root) {
  const file = path.join(root, baseline.FINDINGS_PATH);
  let text;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_STORE_BYTES) {
      const err = new Error("the finding store is not a regular file under the size limit");
      err.code = "EINVAL";
      throw err;
    }
    text = fs.readFileSync(file, "utf8");
  } catch (err) {
    if (errorCode(err) === "ENOENT") return { records: [], skipped: 0 };
    throw err;
  }
  const records = [];
  let skipped = 0;
  text.split("\n").forEach((line) => {
    if (line.trim().length === 0) return;
    let parsed = null;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      parsed = null;
    }
    if (severity.checkFinding(parsed)) records.push(parsed);
    else skipped++;
  });
  return { records, skipped };
}

// The checklist items of the register file as [{id, lane}]: the rows of the first table under "## Register" whose first cell is
// an item id. A lane cell outside the three lanes leaves the lane to the id prefix (hooks/lib/review-labels.js). Throws when the
// file cannot be read; check() catches it.
function readRegister(file) {
  const items = [];
  let inRegister = false;
  fs.readFileSync(file, "utf8").split("\n").forEach((line) => {
    if (/^## /.test(line)) {
      inRegister = line.trim() === REGISTER_HEADING;
      return;
    }
    if (!inRegister || line.indexOf("|") !== 0) return;
    const cells = line.split("|").map((cell) => cell.trim());
    if (ITEM_ID.test(cells[1] || "")) items.push({ id: cells[1], lane: cells[2] });
  });
  return items;
}

// A seeded-sample result from the JSON file at `file`: {tp, fp, fn, size, precision, recall}, or {problem} with the reason it
// cannot be used. Precision and recall are numbers, or "not available" when their denominator is 0.
function readSample(file) {
  let parsed;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_SAMPLE_BYTES) return { problem: "a sample file is not a regular file under the size limit." };
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    return { problem: "a sample file cannot be read as JSON (" + errorCode(err) + ")." };
  }
  const fields = ["true_positive", "false_positive", "false_negative"];
  if (parsed === null || typeof parsed !== "object" || fields.some((name) => !Number.isInteger(parsed[name]) || parsed[name] < 0)) {
    return { problem: "a sample file needs true_positive, false_positive, and false_negative, each a whole number of 0 or more." };
  }
  const tp = parsed.true_positive;
  const fp = parsed.false_positive;
  const fn = parsed.false_negative;
  if (tp + fn < 1) return { problem: "a sample file holds no seeded defect (true_positive plus false_negative is 0)." };
  return { tp, fp, fn, size: tp + fn, precision: tp + fp === 0 ? labels.NOT_AVAILABLE : tp / (tp + fp), recall: tp / (tp + fn) };
}

// ---- Report text -----------------------------------------------------------------------------------------------------

function ratio(value) {
  return typeof value === "number" ? value.toFixed(2) : String(value);
}

function countsText(row) {
  return "true " + row.trueCount + ", false " + row.falseCount + ", deferred " + row.deferred + ", unlabeled " + row.unlabeled + "; precision " + ratio(row.precision);
}

function thresholdLines(found) {
  const names = { floor: "precision floor", minLabeled: "minimum labeled findings", unmappedCount: "unmapped-class count" };
  return ["Thresholds:"].concat(Object.keys(names).map((key) => {
    const source = found.defaultsApplied.indexOf(key) !== -1 ? "PROVISIONAL default, to be revised with data" : "set by flag";
    return "  " + names[key] + ": " + found.thresholds[key] + " (" + source + ")";
  }));
}

function changeLines(found) {
  const lines = ["Checklist-change report (proposals only; no checklist is edited, and a change needs the user's approval, a DECISIONS.md entry, and LLM Security Clear):"];
  thresholdLines(found).forEach((line) => lines.push(line));
  lines.push("Retirement candidates (precision below the floor over at least the minimum labeled findings): " + (found.retirement.length === 0 ? "none" : found.retirement.length));
  found.retirement.forEach((item) => lines.push("  " + item.id + " (" + item.lane + "): precision " + ratio(item.precision) + " over " + item.labeled + " labeled findings"));
  lines.push("Addition candidates (an unmapped class raised at least the count): " + (found.addition.length === 0 ? "none" : found.addition.length));
  found.addition.forEach((entry) => lines.push("  " + entry.class + ": " + entry.count + " findings"));
  return lines;
}

function sampleLines(before, after) {
  if (before === null || after === null) {
    return ["Seeded-sample measurement: no measurement exists (no --before and --after sample was given)."];
  }
  const lines = ["Seeded-sample measurement (provisional sample size " + PROVISIONAL_SAMPLE_SIZE + " defects; a sample of another size is accepted; no precision or recall floor is applied):"];
  [["before", before], ["after", after]].forEach((pair) => {
    const sample = pair[1];
    lines.push("  " + pair[0] + ": sample size " + sample.size + " defects; precision " + ratio(sample.precision) + "; recall " + ratio(sample.recall));
  });
  if (before.size !== after.size) lines.push("  The sample sizes differ, so the two results are not directly comparable.");
  return lines;
}

// ---- Entry points ----------------------------------------------------------------------------------------------------

// The threshold options of the parsed flags as a config for candidates(): {floor, minLabeled, unmappedCount}, with a key left
// out when its flag was not given. Returns {config} or {problem}.
function thresholdConfig(opts) {
  const config = {};
  if (opts.floor !== undefined) {
    if (typeof opts.floor !== "string" || !/^(0|1|0?\.\d+|1\.0+)$/.test(opts.floor)) return { problem: "--floor needs a number from 0 to 1. " + USAGE };
    config.floor = Number(opts.floor);
  }
  const counts = [["minLabeled", "--min-labeled"], ["unmappedCount", "--unmapped-count"]];
  for (let i = 0; i < counts.length; i++) {
    const value = opts[counts[i][0]];
    if (value === undefined) continue;
    if (typeof value !== "string" || !/^[1-9]\d{0,8}$/.test(value)) return { problem: counts[i][1] + " needs a whole number of 1 or more. " + USAGE };
    config[counts[i][0]] = Number(value);
  }
  return { config };
}

// Builds the report for options {root, floor, minLabeled, unmappedCount, before, after, unknown}. `register` is the absolute
// path of the register file (the plugin's own when omitted; tests). Returns {code, lines}. Never throws.
function check(options, register) {
  try {
    const opts = options && typeof options === "object" ? options : {};
    if (Array.isArray(opts.unknown) && opts.unknown.length > 0) return cannotReport("unknown argument " + opts.unknown.map((word) => JSON.stringify(String(word).slice(0, 40))).join(", ") + ". " + USAGE);
    if (opts.root === null) return cannotReport("--root needs a directory. " + USAGE);
    if (opts.before === null || opts.after === null) return cannotReport("--before and --after each need a file. " + USAGE);
    if ((opts.before === undefined) !== (opts.after === undefined)) return cannotReport("give both --before and --after, or neither. " + USAGE);
    const thresholds = thresholdConfig(opts);
    if (thresholds.problem) return cannotReport(thresholds.problem);
    const root = typeof opts.root === "string" && opts.root.length > 0 ? path.resolve(opts.root) : baseline.defaultRoot();
    if (!root) return cannotReport("the project root is unknown.");
    const problem = baseline.rootProblem(root);
    if (problem) return cannotReport(problem);
    let before = null;
    let after = null;
    if (opts.before !== undefined) {
      before = readSample(path.resolve(opts.before));
      after = readSample(path.resolve(opts.after));
      if (before.problem || after.problem) return cannotReport(before.problem || after.problem);
    }
    const items = readRegister(typeof register === "string" ? register : path.join(PLUGIN_ROOT, REGISTER_FILE));
    if (items.length === 0) return cannotReport("the checklist register holds no item.");
    const store = readRecords(root);
    const report = labels.precisionByLane(store.records, items);
    const found = labels.candidates(report, thresholds.config);
    const lines = ["Reviewer precision report (precision from the user's labels only: true / (true + false); an agent's judgment is never a label)"];
    lines.push("Findings read: " + store.records.length + " valid, " + store.skipped + " skipped (not a valid finding).");
    lines.push("Per lane:");
    report.lanes.forEach((row) => lines.push("  " + row.lane + ": " + countsText(row)));
    lines.push("Per item:");
    report.items.forEach((row) => lines.push("  " + row.id + " (" + row.lane + "): " + countsText(row)));
    lines.push("Unmapped reviewer finding classes: " + (report.unmapped.length === 0 ? "none" : report.unmapped.map((entry) => entry.class + " " + entry.count).join(", ")));
    changeLines(found).forEach((line) => lines.push(line));
    sampleLines(before, after).forEach((line) => lines.push(line));
    return { code: EXIT_OK, lines };
  } catch (err) {
    return cannotReport("the finding store or the register could not be read (" + errorCode(err) + ").");
  }
}

// Parses the CLI flags into {floor, minLabeled, unmappedCount, before, after, root, unknown}. A flag that is absent is
// undefined; a flag with no value is null, which check() refuses. `unknown` lists every other word, which check() refuses.
function parseArgs(argv) {
  const list = Array.isArray(argv) ? argv : [];
  const unknown = [];
  for (let i = 0; i < list.length; i++) {
    if (VALUE_FLAGS.indexOf(list[i]) !== -1) {
      const next = list[i + 1];
      if (typeof next === "string" && next.indexOf("--") !== 0) i++;
    } else {
      unknown.push(list[i]);
    }
  }
  return {
    floor: baseline.flagValue(list, "--floor"),
    minLabeled: baseline.flagValue(list, "--min-labeled"),
    unmappedCount: baseline.flagValue(list, "--unmapped-count"),
    before: baseline.flagValue(list, "--before"),
    after: baseline.flagValue(list, "--after"),
    root: baseline.flagValue(list, "--root"),
    unknown,
  };
}

// Writes the lines of a check() result: stdout for a report, stderr when it could not be built.
function report(outcome) {
  const stream = outcome.code === EXIT_CANNOT ? process.stderr : process.stdout;
  stream.write(outcome.lines.join("\n") + "\n");
}

function main() {
  try {
    const outcome = check(parseArgs(process.argv.slice(2)));
    report(outcome);
    process.exitCode = outcome.code;
  } catch (err) {
    process.stderr.write("Cannot report reviewer precision: unexpected error (" + errorCode(err) + ").\n");
    process.exitCode = EXIT_CANNOT;
  }
}

module.exports = { EXIT_OK, EXIT_CANNOT, PROVISIONAL_SAMPLE_SIZE, readRecords, readRegister, readSample, parseArgs, check, report };

if (require.main === module) main();
