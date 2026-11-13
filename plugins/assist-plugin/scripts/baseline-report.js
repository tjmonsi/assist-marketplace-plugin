#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-238|NFR-034] The advisory baseline report. It reads the finding store .agent/governance/review-findings.jsonl (record
// shape: hooks/lib/severity.js) and reports the finding counts and the precision of a rule's advisory findings over the
// baseline window: 14 days or 20 reviews, whichever is later (an estimate, BRD A-5). Spec: specs/spec-hooks-code-scan.md.
//
// Usage:
//   node scripts/baseline-report.js [--rule RULE_ID] [--root DIR]
// Without --rule the report covers every rule in the store, one section each. --root is the project root that holds
// .agent/ (default: CLAUDE_PROJECT_DIR, else the working directory, then its git root).
//
// Window. It starts at the first finding of the rule. It is complete when at least 14 days have passed since that finding
// and the findings name at least 20 distinct review ids; the later of the two moments ends it. A report on an open window
// still prints the counts and precision, marked OPEN, and promote-rule.js treats an open window as no baseline.
// Precision [NFR-034]. Precision is true findings over labelled findings, computed from the user-set `label` field only
// (hooks/lib/severity.js, labelOf): the user sets it with scripts/label-findings.js. A finding with no boolean label is
// shown as unlabelled and is never counted, whatever an agent says about it. With no labelled finding the precision is
// "not computable". The 90% bar (an estimate, BRD A-6) is checked by promote-rule.js, not here: this script only reports.
//
// Exit codes:
//   0  a report was printed (also for an empty or missing store)
//   2  cannot report: bad arguments (an unknown flag, a --rule or --root with no value), a project root that does not exist
//      or cannot be read, or an unreadable store
//
// Read only: the script never writes a file. The report prints counts, rule ids, finding ids, and times; it prints no file
// path and no finding text. A line of the store that is not a valid finding is counted as skipped, not parsed further.
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");

const { findGitRoot } = require(path.join(__dirname, "..", "hooks", "lib", "git-root.js"));
const severity = require(path.join(__dirname, "..", "hooks", "lib", "severity.js"));

const EXIT_OK = 0;
const EXIT_CANNOT = 2;

const FINDINGS_PATH = path.join(".agent", "governance", "review-findings.jsonl");
const MAX_STORE_BYTES = 64 * 1024 * 1024;
const MAX_LISTED = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 14;
const WINDOW_REVIEWS = 20;

const USAGE = "Usage: node scripts/baseline-report.js [--rule RULE_ID] [--root DIR]";

function errorCode(err) {
  return err && typeof err.code === "string" ? err.code : "unknown";
}

// ---- Arguments -------------------------------------------------------------------------------------------------------

// The value after `flag` in argv: undefined when the flag is absent, null when it has no usable value.
function flagValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return typeof value === "string" && value.length > 0 && value.indexOf("--") !== 0 ? value : null;
}

// The project root: CLAUDE_PROJECT_DIR else the working directory, then its git root. Null when neither is absolute.
function defaultRoot() {
  const start = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return findGitRoot(start) || (path.isAbsolute(start) ? start : null);
}

// Why `root` cannot serve as a project root, or null when it can: it is not an existing, readable directory. Callers exit 2
// (cannot run) on a message, so an unknown root is never mistaken for an empty store or a refusal.
function rootProblem(root) {
  try {
    if (!fs.statSync(root).isDirectory()) return "the project root " + path.basename(root) + " is not a directory.";
    fs.accessSync(root, fs.constants.R_OK);
    return null;
  } catch (err) {
    return "the project root cannot be read (" + errorCode(err) + ").";
  }
}

// ---- Reading the store -----------------------------------------------------------------------------------------------

// Reads the finding store of the project at `root`. Returns {findings, skipped, lines} where `findings` holds the
// normalized records (hooks/lib/severity.js, checkFinding) and `skipped` counts the lines that are not valid findings. A
// missing store holds no findings. Throws on any other read error; the entry points catch it.
function readFindings(root) {
  const file = path.join(root, FINDINGS_PATH);
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
    if (errorCode(err) === "ENOENT") return { findings: [], skipped: 0, lines: 0 };
    throw err;
  }
  const findings = [];
  let skipped = 0;
  let lines = 0;
  text.split("\n").forEach((line) => {
    if (line.trim().length === 0) return;
    lines++;
    let parsed = null;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      parsed = null;
    }
    const finding = severity.checkFinding(parsed);
    if (finding) findings.push(finding);
    else skipped++;
  });
  return { findings, skipped, lines };
}

// ---- Baseline --------------------------------------------------------------------------------------------------------

function tally(findings, keyOf, keys) {
  const counts = {};
  keys.forEach((key) => {
    counts[key] = 0;
  });
  findings.forEach((finding) => {
    counts[keyOf(finding)]++;
  });
  return counts;
}

// The baseline window of a rule's findings at time `nowMs`: {start, reviews, daysEnd, reviewsEnd, end, complete}. Times are
// milliseconds, or null where they do not exist yet. `start` is the first finding. `daysEnd` is `start` plus 14 days.
// `reviewsEnd` is the moment the 20th distinct review id first appears (null with fewer than 20). `end` is the later of the
// two (null while `reviewsEnd` is null). `complete` is true once `end` has passed.
function windowOf(findings, nowMs) {
  if (findings.length === 0) return { start: null, reviews: 0, daysEnd: null, reviewsEnd: null, end: null, complete: false };
  const start = findings.reduce((least, finding) => Math.min(least, finding.time), Infinity);
  const firstSeen = {};
  findings.forEach((finding) => {
    if (finding.review_id === null) return;
    if (!Object.prototype.hasOwnProperty.call(firstSeen, finding.review_id) || finding.time < firstSeen[finding.review_id]) {
      firstSeen[finding.review_id] = finding.time;
    }
  });
  const seen = Object.keys(firstSeen).map((id) => firstSeen[id]).sort((a, b) => a - b);
  const daysEnd = start + WINDOW_DAYS * DAY_MS;
  const reviewsEnd = seen.length >= WINDOW_REVIEWS ? seen[WINDOW_REVIEWS - 1] : null;
  const end = reviewsEnd === null ? null : Math.max(daysEnd, reviewsEnd);
  return { start, reviews: seen.length, daysEnd, reviewsEnd, end, complete: end !== null && nowMs >= end };
}

// The baseline for one rule from the normalized findings of the store, at time `nowMs` (default: now). Returns
//   {ruleId, total, bySeverity, byConfidence, labelledTrue, labelledFalse, unlabelled, unlabelledIds, precision, window}
// where `precision` is a ratio from 0 to 1, or null when no finding has a user label, and `unlabelled` counts the findings
// with no boolean label. A rule with no finding reports total 0 and an empty window.
function baselineFor(findings, ruleId, nowMs) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  const own = findings.filter((finding) => finding.rule_id === ruleId);
  const labelledTrue = own.filter((finding) => finding.label === true).length;
  const labelledFalse = own.filter((finding) => finding.label === false).length;
  const unlabelled = own.filter((finding) => finding.label === null);
  const labelled = labelledTrue + labelledFalse;
  return {
    ruleId,
    total: own.length,
    bySeverity: tally(own, (finding) => finding.severity, severity.SEVERITIES),
    byConfidence: tally(own, (finding) => finding.confidence, severity.CONFIDENCES),
    labelledTrue,
    labelledFalse,
    unlabelled: unlabelled.length,
    unlabelledIds: unlabelled.slice(0, MAX_LISTED).map((finding) => finding.id),
    precision: labelled === 0 ? null : labelledTrue / labelled,
    window: windowOf(own, now),
  };
}

// The precision as text: a percentage rounded down to one decimal place, so a value under a bar never prints as the bar.
function percent(ratio) {
  return (Math.floor(ratio * 1000) / 10).toFixed(1) + "%";
}

function day(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function plural(count, word) {
  return count + " " + word + (count === 1 ? "" : "s");
}

function windowLines(win, nowMs) {
  if (win.start === null) return ["  Window: no findings yet."];
  const lines = [];
  const elapsed = Math.max(0, Math.floor((nowMs - win.start) / DAY_MS));
  lines.push("  Window start: " + day(win.start) + " (first finding); " + plural(elapsed, "day") + " elapsed; " + plural(win.reviews, "review") + " seen.");
  if (win.complete) {
    lines.push("  Window: COMPLETE (14 days and 20 reviews met on " + day(win.end) + "; estimate, BRD A-5).");
  } else {
    const needs = [];
    if (nowMs < win.daysEnd) needs.push("the 14-day mark on " + day(win.daysEnd));
    if (win.reviews < WINDOW_REVIEWS) needs.push(plural(WINDOW_REVIEWS - win.reviews, "more review") + " (20 needed)");
    else if (win.end !== null && nowMs < win.end) needs.push("the time of the 20th review, " + day(win.reviewsEnd));
    lines.push("  Window: OPEN (waiting for " + needs.join(" and ") + "; whichever is later, estimate, BRD A-5).");
  }
  return lines;
}

function ruleLines(base, nowMs) {
  const lines = ["Rule " + base.ruleId + ": " + plural(base.total, "finding")];
  lines.push("  By severity: " + severity.SEVERITIES.map((key) => key + " " + base.bySeverity[key]).join(", "));
  lines.push("  By confidence: " + severity.CONFIDENCES.map((key) => key + " " + base.byConfidence[key]).join(", "));
  lines.push("  Labelled by the user: " + base.labelledTrue + " true, " + base.labelledFalse + " false. Unlabelled: " + base.unlabelled + " (not counted; an agent's judgment is never a label).");
  if (base.unlabelledIds.length > 0) {
    const more = base.unlabelled > base.unlabelledIds.length ? " ... " + (base.unlabelled - base.unlabelledIds.length) + " more" : "";
    lines.push("  Unlabelled ids: " + base.unlabelledIds.join(", ") + more);
  }
  lines.push("  Precision: " + (base.precision === null ? "not computable (no finding has a user label)" : percent(base.precision) + " (" + base.labelledTrue + " of " + (base.labelledTrue + base.labelledFalse) + " labelled; estimate, BRD A-5)"));
  windowLines(base.window, nowMs).forEach((line) => lines.push(line));
  return lines;
}

// ---- Entry points ----------------------------------------------------------------------------------------------------

function cannotReport(message) {
  return { code: EXIT_CANNOT, lines: ["Cannot report the baseline: " + message] };
}

// Builds the report for options {root, rule, now}. `root` is the absolute project root (the default root when omitted),
// `rule` limits the report to one rule id, `now` is a function that returns milliseconds (tests). Returns {code, lines}.
// Never throws.
function check(options) {
  try {
    const opts = options && typeof options === "object" ? options : {};
    if (Array.isArray(opts.unknown) && opts.unknown.length > 0) return cannotReport("unknown argument " + opts.unknown.map((word) => JSON.stringify(String(word).slice(0, 40))).join(", ") + ". " + USAGE);
    if (opts.root === null) return cannotReport("--root needs a directory. " + USAGE);
    // A --rule flag with no value arrives as null and is refused like any other bad rule id.
    if (opts.rule !== undefined && (typeof opts.rule !== "string" || !severity.ID_PATTERN.test(opts.rule))) {
      return cannotReport("--rule needs a rule id of letters, digits, and . _ : - only. " + USAGE);
    }
    const root = typeof opts.root === "string" && opts.root.length > 0 ? path.resolve(opts.root) : defaultRoot();
    if (!root) return cannotReport("the project root is unknown.");
    const problem = rootProblem(root);
    if (problem) return cannotReport(problem);
    const nowMs = typeof opts.now === "function" && Number.isFinite(opts.now()) ? opts.now() : Date.now();
    const store = readFindings(root);
    const ruleIds = opts.rule !== undefined ? [opts.rule] : store.findings.map((finding) => finding.rule_id).filter((id, i, all) => all.indexOf(id) === i).sort();
    const lines = ["Advisory baseline report (precision from the user's labels only; the window and the bar are estimates)"];
    lines.push("Findings read: " + store.findings.length + " valid, " + store.skipped + " skipped (not a valid finding).");
    if (ruleIds.length === 0) lines.push("No findings recorded.");
    ruleIds.forEach((ruleId) => ruleLines(baselineFor(store.findings, ruleId, nowMs), nowMs).forEach((line) => lines.push(line)));
    return { code: EXIT_OK, lines };
  } catch (err) {
    return cannotReport("the finding store could not be read (" + errorCode(err) + ").");
  }
}

// Parses the CLI flags into {rule, root, unknown}. A flag that is absent is undefined; --rule or --root with no value is
// null, which check() refuses. `unknown` lists every other word (an unknown flag or a stray argument), which check() refuses.
function parseArgs(argv) {
  const list = Array.isArray(argv) ? argv : [];
  const unknown = [];
  for (let i = 0; i < list.length; i++) {
    if (list[i] === "--rule" || list[i] === "--root") {
      const next = list[i + 1];
      if (typeof next === "string" && next.indexOf("--") !== 0) i++;
    } else {
      unknown.push(list[i]);
    }
  }
  return { rule: flagValue(list, "--rule"), root: flagValue(list, "--root"), unknown };
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
    process.stderr.write("Cannot report the baseline: unexpected error (" + errorCode(err) + ").\n");
    process.exitCode = EXIT_CANNOT;
  }
}

module.exports = { FINDINGS_PATH, EXIT_OK, EXIT_CANNOT, WINDOW_DAYS, WINDOW_REVIEWS, flagValue, defaultRoot, rootProblem, readFindings, baselineFor, percent, parseArgs, check, report };

if (require.main === module) main();
