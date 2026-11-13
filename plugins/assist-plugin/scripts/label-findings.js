#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-238|NFR-034] The user-run labeller of the advisory baseline. The user marks each recorded finding true (a real
// finding) or false (a false positive), and baseline-report.js computes precision from those labels only. Spec:
// specs/spec-hooks-code-scan.md; the labeller is the PN-3 decision of DECISIONS.md (2026-10-30). No hook, agent, or
// orchestrator runs this script: the labels are the user's judgment, never an agent's.
//
// Usage:
//   node scripts/label-findings.js --list [--rule RULE_ID] [--root DIR]
//   node scripts/label-findings.js <finding-id> true|false [--root DIR]
// --list prints the unlabelled findings (id, rule, severity, confidence, file, line) so the user can review each one.
// The second form sets `label` (a boolean) and `labelled_at` (the time, UTC) on the one record with that id in
// .agent/governance/review-findings.jsonl, replacing an earlier label. --root is the project root that holds .agent/
// (default: CLAUDE_PROJECT_DIR, else the working directory, then its git root).
//
// The rewrite changes only the named record. Every other line, including a line that is not a valid finding, is kept as
// written. The file is replaced through a temporary file in the same directory and a rename, so an interrupted run leaves
// the old file whole. Known limit: a finding that a hook appends between the read and the rename is lost, so label while
// no review is running.
//
// Exit codes:
//   0  listed, or the label was set
//   1  refused: the id is unknown or appears on more than one line
//   2  cannot run: bad arguments (no id, no label, a label other than true or false, an unknown flag), a project root that
//      does not exist or cannot be read, or an unreadable or unwritable store
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");

const baseline = require(path.join(__dirname, "baseline-report.js"));
const severity = require(path.join(__dirname, "..", "hooks", "lib", "severity.js"));

const EXIT_OK = 0;
const EXIT_REFUSED = 1;
const EXIT_CANNOT = 2;

const USAGE = "Usage: node scripts/label-findings.js --list [--rule RULE_ID] [--root DIR]  |  node scripts/label-findings.js <finding-id> true|false [--root DIR]";

function errorCode(err) {
  return err && typeof err.code === "string" ? err.code : "unknown";
}

function cannot(message) {
  return { code: EXIT_CANNOT, lines: ["Cannot label findings: " + message] };
}

function rootOf(options) {
  return typeof options.root === "string" && options.root.length > 0 ? path.resolve(options.root) : baseline.defaultRoot();
}

// The project root of the options, or {problem} with the reason it cannot be used: unknown, not an existing directory, or
// unreadable. Judged before the store is touched, so a missing root is "cannot run" (exit 2), not an empty store or a refusal.
function usableRoot(options) {
  const root = rootOf(options);
  if (!root) return { problem: "the project root is unknown." };
  const problem = baseline.rootProblem(root);
  return problem ? { problem } : { root };
}

// Prints the unlabelled findings, optionally for one rule.
function list(options) {
  if (options.rule !== undefined && (typeof options.rule !== "string" || !severity.ID_PATTERN.test(options.rule))) {
    return cannot("--rule needs a rule id of letters, digits, and . _ : - only. " + USAGE);
  }
  const found = usableRoot(options);
  if (found.problem) return cannot(found.problem);
  const store = baseline.readFindings(found.root);
  const open = store.findings.filter((finding) => finding.label === null && (options.rule === undefined || finding.rule_id === options.rule));
  const lines = ["Unlabelled findings: " + open.length + " (label each true or false with: node scripts/label-findings.js <finding-id> true|false)"];
  open.forEach((finding) => lines.push("  " + finding.id + "  " + finding.rule_id + "  " + finding.severity + "/" + finding.confidence + "  " + finding.file + ":" + finding.line));
  return { code: EXIT_OK, lines };
}

// Sets the label of the finding `id` to the boolean `value`. `nowIso` is the time for `labelled_at`.
function setLabel(options, id, value, nowIso) {
  const found = usableRoot(options);
  if (found.problem) return cannot(found.problem);
  const file = path.join(found.root, baseline.FINDINGS_PATH);
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (err) {
    if (errorCode(err) === "ENOENT") return { code: EXIT_REFUSED, lines: ["Refused: no finding store exists, so there is no finding " + id + "."] };
    throw err;
  }
  const lines = text.split("\n");
  const matches = [];
  lines.forEach((line, index) => {
    if (line.trim().length === 0) return;
    try {
      const parsed = JSON.parse(line);
      if (severity.checkFinding(parsed) && parsed.id === id) matches.push({ index, parsed });
    } catch (err) {
      // A line that is not JSON is kept as written; it cannot be the finding.
    }
  });
  if (matches.length === 0) return { code: EXIT_REFUSED, lines: ["Refused: no finding with id " + id + ". List the open ones with --list."] };
  if (matches.length > 1) return { code: EXIT_REFUSED, lines: ["Refused: id " + id + " appears on " + matches.length + " lines, so the right record is unclear. Fix the duplicate ids in the store first."] };
  const record = matches[0].parsed;
  record.label = value;
  record.labelled_at = nowIso;
  lines[matches[0].index] = JSON.stringify(record);
  const temp = file + "." + process.pid + ".tmp";
  try {
    fs.writeFileSync(temp, lines.join("\n"), { encoding: "utf8", mode: fs.statSync(file).mode & 0o777 });
    fs.renameSync(temp, file);
  } catch (err) {
    try {
      fs.unlinkSync(temp);
    } catch (cleanupErr) {
      // The temporary file was never created, or is already gone.
    }
    throw err;
  }
  return { code: EXIT_OK, lines: ["Labelled finding " + id + " as " + (value ? "true (a real finding)" : "false (a false positive)") + "."] };
}

// Runs the labeller for parsed CLI input {list, rule, root, id, label}. Returns {code, lines}. Never throws. `now` is a
// function that returns milliseconds (tests).
function check(options, now) {
  try {
    const opts = options && typeof options === "object" ? options : {};
    if (Array.isArray(opts.unknown) && opts.unknown.length > 0) return cannot("unknown argument " + opts.unknown.map((word) => JSON.stringify(String(word).slice(0, 40))).join(", ") + ". " + USAGE);
    if (opts.root === null) return cannot("--root needs a directory. " + USAGE);
    if (opts.list) return list(opts);
    if (typeof opts.id !== "string" || !severity.ID_PATTERN.test(opts.id)) return cannot("give a finding id. " + USAGE);
    if (opts.label !== "true" && opts.label !== "false") return cannot("the label must be exactly true or false. " + USAGE);
    const ms = typeof now === "function" && Number.isFinite(now()) ? now() : Date.now();
    return setLabel(opts, opts.id, opts.label === "true", new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z"));
  } catch (err) {
    return cannot("the finding store could not be read or written (" + errorCode(err) + ").");
  }
}

// Parses the CLI arguments into {list, rule, root, id, label}.
function parseArgs(argv) {
  const list = Array.isArray(argv) ? argv : [];
  const root = baseline.flagValue(list, "--root");
  const flagged = new Set();
  ["--root", "--rule"].forEach((flag) => {
    const index = list.indexOf(flag);
    if (index !== -1) {
      flagged.add(index);
      flagged.add(index + 1);
    }
  });
  const words = list.filter((word, index) => !flagged.has(index) && word !== "--list");
  // A word past the id and the label, and any flag this script does not know, is a usage error that check() refuses.
  const unknown = words.slice(2).concat(words.slice(0, 2).filter((word) => word.indexOf("--") === 0));
  return { list: list.indexOf("--list") !== -1, rule: baseline.flagValue(list, "--rule"), root, id: words[0], label: words[1], unknown };
}

function report(outcome) {
  const stream = outcome.code === EXIT_OK ? process.stdout : process.stderr;
  stream.write(outcome.lines.join("\n") + "\n");
}

function main() {
  try {
    const outcome = check(parseArgs(process.argv.slice(2)));
    report(outcome);
    process.exitCode = outcome.code;
  } catch (err) {
    process.stderr.write("Cannot label findings: unexpected error (" + errorCode(err) + ").\n");
    process.exitCode = EXIT_CANNOT;
  }
}

module.exports = { EXIT_OK, EXIT_REFUSED, EXIT_CANNOT, parseArgs, check, report };

if (require.main === module) main();
