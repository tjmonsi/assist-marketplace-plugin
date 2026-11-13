#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-237|FR-238|NFR-034|FR-245] The promotion gate. It switches one named rule from advisory to blocking in the rule-mode
// store .agent/governance/rule-modes.json, and only when every check passes. Otherwise it refuses, writes nothing, and prints
// the reason. Spec: specs/spec-hooks-code-scan.md (Requirement: Promotion gate). This script is the only writer of a
// blocking mode, and the user runs it: no hook, agent, or orchestrator does. The write bar denies a subagent a write of the
// store, and the main session and this script are not judged by it (hooks/lib/fsa-paths.js, RULE_MODES_GLOB).
//
// Usage:
//   node scripts/promote-rule.js <rule-id> [--root DIR]
// --root is the project root that holds .agent/ and DECISIONS.md (default: CLAUDE_PROJECT_DIR, else the working directory,
// then its git root).
//
// Checks, in this order; the first that fails refuses the switch:
//   missing-policy    DECISIONS.md holds no entry whose heading matches ^## [0-9]{4}-[0-9]{2}-[0-9]{2}: Severity policy approved$
//                     and whose body names rules/severity-policy.md and the policy file's current version (the
//                     "Policy version" line of that file; draft-2 at this writing). When several entries match, the
//                     latest by date (then by position in the file) is the one read. An edit to the policy raises its
//                     version, so an older approval no longer covers it.
//   missing-baseline  the rule has no baseline: no finding recorded for it, the baseline window (14 days or 20 reviews,
//                     whichever is later) is still open, or no finding has a user label. See baseline-report.js.
//   precision         the precision of the user's labels is under 90% (an estimate, BRD A-6); the refusal prints the value.
// An existing store that is not valid JSON also refuses: writing over it would destroy it, and an unreadable store already
// means advisory for every rule.
//
// Exit codes:
//   0  the rule is blocking (switched now, or already blocking)
//   1  refused: the reason is printed
//   2  cannot run: bad arguments, a project root that does not exist or cannot be read, or an unreadable or unwritable file
//
// The store is replaced through a temporary file in the same directory and a rename. The script prints the rule id, the
// reason, and the precision; it prints no finding text. No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");

const baseline = require(path.join(__dirname, "baseline-report.js"));
const severity = require(path.join(__dirname, "..", "hooks", "lib", "severity.js"));

const EXIT_PROMOTED = 0;
const EXIT_REFUSED = 1;
const EXIT_CANNOT = 2;

const STORE_PATH = path.join(".agent", "governance", "rule-modes.json");
const DECISIONS_NAME = "DECISIONS.md";
const POLICY_FILE = path.join(__dirname, "..", "rules", "severity-policy.md");
const POLICY_NAME = "severity-policy.md";
const MAX_FILE_BYTES = 16 * 1024 * 1024;

const APPROVAL_HEADING = /^## ([0-9]{4}-[0-9]{2}-[0-9]{2}): Severity policy approved$/;
const VERSION_LINE = /^\*\*Policy version:\*\*[ \t]*(\S+)[ \t]*$/m;
const FENCE = /^\s*(```|~~~)/;

const USAGE = "Usage: node scripts/promote-rule.js <rule-id> [--root DIR]";

function errorCode(err) {
  return err && typeof err.code === "string" ? err.code : "unknown";
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Reads a text file under the size limit. Returns null when the file does not exist; throws on any other error.
function readText(file) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) {
      const err = new Error("not a regular file under the size limit");
      err.code = "EINVAL";
      throw err;
    }
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    if (errorCode(err) === "ENOENT") return null;
    throw err;
  }
}

// ---- Policy approval -------------------------------------------------------------------------------------------------

// The policy version in the text of rules/severity-policy.md (the "Policy version" line), or null.
function policyVersion(policyText) {
  const match = typeof policyText === "string" ? VERSION_LINE.exec(policyText) : null;
  return match ? match[1] : null;
}

// True when `body` names the policy file and the whole version token (draft-2 does not match draft-20 or draft-2-b).
function namesPolicy(body, version) {
  if (body.indexOf(POLICY_NAME) === -1) return false;
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(?:^|[^A-Za-z0-9.-])" + escaped + "(?![A-Za-z0-9-])").test(body);
}

// The approval entries of the DECISIONS.md text: [{date, position, body}] for each heading that matches the approval
// pattern exactly. A heading inside a fenced block is an example, not an entry. An entry runs to the next `## ` heading.
function approvalEntries(decisionsText) {
  const entries = [];
  let fenced = false;
  let current = null;
  decisionsText.split("\n").forEach((rawLine, position) => {
    const line = rawLine.replace(/\r$/, "");
    if (FENCE.test(line)) fenced = !fenced;
    if (!fenced && line.indexOf("## ") === 0) {
      const match = APPROVAL_HEADING.exec(line);
      current = match ? { date: match[1], position, body: "" } : null;
      if (current) entries.push(current);
      return;
    }
    if (current) current.body += line + "\n";
  });
  return entries;
}

// The latest approval entry that names the policy file at `version`, or null: the latest date wins, a later position breaks a tie.
function latestApproval(decisionsText, version) {
  let best = null;
  approvalEntries(decisionsText).forEach((entry) => {
    if (!namesPolicy(entry.body, version)) return;
    if (best === null || entry.date > best.date || (entry.date === best.date && entry.position > best.position)) best = entry;
  });
  return best;
}

// ---- The gate --------------------------------------------------------------------------------------------------------

function refusal(reason, detail) {
  return { code: EXIT_REFUSED, reason, lines: ["Refused (" + reason + "): " + detail] };
}

function percent(ratio) {
  return baseline.percent(ratio);
}

// Judges the promotion of `ruleId` from the inputs {decisionsText, policyText, findings, nowMs}. Returns null when every
// check passes, else {code, reason, lines} for the first failed check. Pure: no file is read or written.
function judge(ruleId, inputs) {
  const version = policyVersion(inputs.policyText);
  if (version === null) return refusal("missing-policy", "the policy file holds no \"Policy version\" line, so no approval can name its current version.");
  if (typeof inputs.decisionsText !== "string") return refusal("missing-policy", DECISIONS_NAME + " does not exist, so no entry approves " + POLICY_NAME + " at " + version + ".");
  const approval = latestApproval(inputs.decisionsText, version);
  if (approval === null) {
    return refusal("missing-policy", DECISIONS_NAME + " holds no \"## <YYYY-MM-DD>: Severity policy approved\" entry that names " + POLICY_NAME + " at version " + version + ". Record the approval for the current version first.");
  }
  const base = baseline.baselineFor(inputs.findings, ruleId, inputs.nowMs);
  if (base.total === 0) return refusal("missing-baseline", "no advisory finding is recorded for rule " + ruleId + ", so no baseline report exists. Run the rule in advisory mode first.");
  if (!base.window.complete) {
    return refusal("missing-baseline", "the baseline window for rule " + ruleId + " is still open (14 days and 20 reviews, whichever is later; estimate, BRD A-5), so no baseline report is complete. Run baseline-report.js --rule " + ruleId + " to see what is missing.");
  }
  if (base.precision === null) {
    return refusal("missing-baseline", "no finding of rule " + ruleId + " has a user label, so the baseline holds no precision. Label findings with label-findings.js.");
  }
  // Integer comparison, so a precision of exactly 90% passes and no rounding moves a value across the bar.
  if ((base.labelledTrue * 10) < ((base.labelledTrue + base.labelledFalse) * 9)) {
    return refusal("precision", "the precision of rule " + ruleId + " is " + percent(base.precision) + " (" + base.labelledTrue + " true of " + (base.labelledTrue + base.labelledFalse) + " labelled), under the 90% bar (estimate, BRD A-6).");
  }
  return null;
}

// Creates `dir` and its missing parents one by one, because fs.mkdirSync(dir, {recursive: true}) needs Node 10.12 and the
// plugin's other writers run from Node 6.
function makeDirs(dir) {
  if (fs.existsSync(dir)) return;
  const parent = path.dirname(dir);
  if (parent !== dir) makeDirs(parent);
  try {
    fs.mkdirSync(dir, 0o755);
  } catch (err) {
    if (errorCode(err) !== "EEXIST") throw err;
  }
}

// Writes `modes` as the rule-mode store of the project at `root`, through a temporary file and a rename.
function writeStore(root, modes) {
  const file = path.join(root, STORE_PATH);
  makeDirs(path.dirname(file));
  const temp = file + "." + process.pid + ".tmp";
  try {
    fs.writeFileSync(temp, JSON.stringify(modes, null, 2) + "\n", { encoding: "utf8", mode: 0o644 });
    fs.renameSync(temp, file);
  } catch (err) {
    try {
      fs.unlinkSync(temp);
    } catch (cleanupErr) {
      // The temporary file was never created, or is already gone.
    }
    throw err;
  }
}

function cannot(message) {
  return { code: EXIT_CANNOT, lines: ["Cannot promote: " + message] };
}

// Runs the gate for options {rule, root, policyFile} and switches the rule when every check passes. `now` is a function that
// returns milliseconds (tests). Returns {code, lines} (and `reason` on a refusal). Never throws.
function promote(options, now) {
  try {
    const opts = options && typeof options === "object" ? options : {};
    if (opts.root === null) return cannot("--root needs a directory. " + USAGE);
    if (typeof opts.rule !== "string" || !severity.ID_PATTERN.test(opts.rule)) return cannot("give one rule id of letters, digits, and . _ : - only. " + USAGE);
    const root = typeof opts.root === "string" && opts.root.length > 0 ? path.resolve(opts.root) : baseline.defaultRoot();
    if (!root) return cannot("the project root is unknown.");
    // A root that does not exist or cannot be read is "cannot run" (exit 2), judged before any policy or baseline check.
    const problem = baseline.rootProblem(root);
    if (problem) return cannot(problem);
    const nowMs = typeof now === "function" && Number.isFinite(now()) ? now() : Date.now();

    const storeText = readText(path.join(root, STORE_PATH));
    let stored = {};
    if (storeText !== null && storeText.trim().length > 0) {
      try {
        stored = JSON.parse(storeText);
      } catch (err) {
        stored = null;
      }
      if (!isRecord(stored)) return refusal("store-unreadable", "the rule-mode store is not a JSON object, and writing over it would destroy it. Repair or remove " + STORE_PATH.replace(/\\/g, "/") + ", then run again.");
    }
    if (severity.modeOf(severity.parseRuleModes(storeText), opts.rule) === severity.MODES.blocking) {
      return { code: EXIT_PROMOTED, lines: ["Rule " + opts.rule + " is already blocking. Nothing changed."] };
    }

    const refused = judge(opts.rule, {
      decisionsText: readText(path.join(root, DECISIONS_NAME)),
      policyText: readText(typeof opts.policyFile === "string" ? opts.policyFile : POLICY_FILE),
      findings: baseline.readFindings(root).findings,
      nowMs,
    });
    if (refused) return refused;

    stored[opts.rule] = severity.MODES.blocking;
    writeStore(root, stored);
    return { code: EXIT_PROMOTED, lines: ["Rule " + opts.rule + " is now blocking: the policy is approved for its current version, the baseline is complete, and precision meets the 90% bar (estimate, BRD A-6).", "Wrote " + STORE_PATH.replace(/\\/g, "/") + "."] };
  } catch (err) {
    return cannot("a file could not be read or written (" + errorCode(err) + ").");
  }
}

function parseArgs(argv) {
  const list = Array.isArray(argv) ? argv : [];
  const root = baseline.flagValue(list, "--root");
  const index = list.indexOf("--root");
  const words = index === -1 ? list : list.filter((word, i) => i !== index && i !== index + 1);
  return { rule: words[0], root };
}

function report(outcome) {
  const stream = outcome.code === EXIT_CANNOT ? process.stderr : process.stdout;
  stream.write(outcome.lines.join("\n") + "\n");
}

function main() {
  try {
    const outcome = promote(parseArgs(process.argv.slice(2)));
    report(outcome);
    process.exitCode = outcome.code;
  } catch (err) {
    process.stderr.write("Cannot promote: unexpected error (" + errorCode(err) + ").\n");
    process.exitCode = EXIT_CANNOT;
  }
}

module.exports = { EXIT_PROMOTED, EXIT_REFUSED, EXIT_CANNOT, STORE_PATH, policyVersion, approvalEntries, latestApproval, judge, parseArgs, promote, report };

if (require.main === module) main();
