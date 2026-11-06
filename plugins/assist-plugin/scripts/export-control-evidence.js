#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-229|NFR-030] Exports control evidence for a date range from the plugin's own hooks. It reads the governance audit log
// (<root>/.agent/logs/governance/audit.jsonl and its rotated audit-NNNNNN.jsonl segments) and fsa-log.jsonl (with its
// rotated segments, under the plugin data directory), then counts and lists the control events by type: denies, asks, gate
// evidence, approvals (records that cite a plan approval), disclosures, and logged disablements. It also reports the chain
// verification result. The evidence comes from the plugin's own hooks; it is not a vendor SOC 2 report.
// The `/assist-plugin:health --export-evidence` mode (hooks/impl/health-check.js) calls check() below, so both entry points agree.
//
// Usage:
//   node scripts/export-control-evidence.js --from YYYY-MM-DD --to YYYY-MM-DD [--root DIR] [--data-dir DIR]
// The range is inclusive and read in UTC. `--root` is the project root that holds .agent/ (default: CLAUDE_PROJECT_DIR, else
// the working directory, then its git root). `--data-dir` is the plugin data directory that holds fsa-log.jsonl (default:
// CLAUDE_PLUGIN_DATA; without it the fsa-log part is reported as not available).
//
// Chain. Both stores are verified through verify() in hooks/lib/audit-chain.js, which walks every retained segment (rotated
// segments are kept at least 12 months) in order and follows the chain hash across each cut, the same walk that
// scripts/verify-audit-chain.js uses. When the chain breaks at or before the end of the range, the range is marked UNVERIFIED
// and the first bad line is named with its segment and its line in the segment. verify() stops at the first break, so lines
// after it are not confirmed; a break after the end of the range leaves the range verified.
//
// Exit codes:
//   0  the range is verified (a missing or empty log verifies as zero lines)
//   1  the range is unverified: the chain breaks at or before the end of the range
//   2  cannot export: bad arguments, an unknown project root, or an unreadable segment
//
// Read only: the script never writes a file and never throws. The records hold no prompt text, command text, file contents,
// or secret (NFR-031), and the report adds none: it prints counts, timestamps, segment names and line numbers, and short
// identifiers (a rule id, a tool name, an agent type, a gate kind, a plan approval reference, a receiving party and its
// interest label). Every printed value is checked against a plain-identifier pattern, and anything else prints as <invalid>.
// It prints no path.
// Known limit (NFR-030): the chain runs backward, so the final retained line and lines removed from the end of a log are not
// confirmed by the chain alone; the report says so when a chain is intact.
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");

const auditChain = require(path.join(__dirname, "..", "hooks", "lib", "audit-chain.js"));
const { findGitRoot } = require(path.join(__dirname, "..", "hooks", "lib", "git-root.js"));
const verifyAuditChain = require(path.join(__dirname, "verify-audit-chain.js"));

const EXIT_VERIFIED = 0;
const EXIT_UNVERIFIED = 1;
const EXIT_CANNOT_EXPORT = 2;

const AUDIT_NAME = "audit";
const FSA_LOG_NAME = "fsa-log";
const MAX_LISTED = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
// A value that is safe to print: a short plain identifier.
const SAFE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@\/-]{0,119}$/;
const APPROVAL_PATTERN = /^(?:plan-approval|approval-message):/;
const FSA_REPORT_EVENTS = ["subagent-stop", "handback", "agent-result"];

const USAGE = "Usage: node scripts/export-control-evidence.js --from YYYY-MM-DD --to YYYY-MM-DD [--root DIR] [--data-dir DIR]";
const TITLE = "Control evidence export (evidence from the plugin's own hooks; not a vendor SOC 2 report)";

// The event types of the report, in print order. `listed` types print each event (up to MAX_LISTED); the others print counts only.
const TYPES = [
  { id: "deny", label: "Denies", listed: true },
  { id: "ask", label: "Asks", listed: true },
  { id: "gate", label: "Gate evidence", listed: true },
  { id: "approval", label: "Approvals (records that cite a plan approval or an approval message)", listed: false },
  { id: "disclosure", label: "Disclosures", listed: true },
  { id: "disablement", label: "Logged disablements", listed: true },
];

function errorCode(err) {
  return err && typeof err.code === "string" ? err.code : "unknown";
}

function plural(count, word) {
  return count + " " + word + (count === 1 ? "" : "s");
}

// ---- Arguments -------------------------------------------------------------------------------------------------------

// Reads the value after `flag` in argv. Returns undefined when the flag is absent, null when it has no usable value.
function flagValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return typeof value === "string" && value.length > 0 && value.indexOf("--") !== 0 ? value : null;
}

// Parses the flags of the CLI and of the health check's --export-evidence mode. Returns {from, to, root, dataDir}; a flag
// that is absent or has no value is undefined. It does not validate the dates: check() does.
function parseArgs(argv) {
  const list = Array.isArray(argv) ? argv : [];
  const pick = (flag) => {
    const value = flagValue(list, flag);
    return value === null ? undefined : value;
  };
  return { from: pick("--from"), to: pick("--to"), root: pick("--root"), dataDir: pick("--data-dir") };
}

// Milliseconds of the start (or the end) of the UTC day named by `text` (YYYY-MM-DD), or null for text that is not a real date.
function dayMs(text, endOfDay) {
  if (typeof text !== "string" || !DATE_PATTERN.test(text)) return null;
  const parts = text.split("-").map((part) => parseInt(part, 10));
  const start = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== text) return null;
  return endOfDay ? start + DAY_MS - 1 : start;
}

// The date window of the options as {from, to, fromMs, toMs}, or {error} with a fixed message.
function windowOf(options) {
  const fromMs = dayMs(options.from, false);
  const toMs = dayMs(options.to, true);
  if (fromMs === null || toMs === null) return { error: "the range needs --from and --to as real dates in the form YYYY-MM-DD. " + USAGE };
  if (fromMs > toMs) return { error: "--from is after --to." };
  return { from: options.from, to: options.to, fromMs, toMs };
}

// The default project root: CLAUDE_PROJECT_DIR else the working directory, then its git root. Null when neither is absolute.
function defaultRoot() {
  const start = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return findGitRoot(start) || (path.isAbsolute(start) ? start : null);
}

// ---- Reading the segments --------------------------------------------------------------------------------------------

// The segment file names of a store in walk order: rotated segments by rising sequence, then the current segment.
// A missing directory holds no segments.
function segmentNames(dir, name) {
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (err) {
    if (errorCode(err) === "ENOENT") return [];
    throw err;
  }
  const rotated = new RegExp("^" + name + "-(\\d{6,})\\.jsonl$");
  const names = files
    .map((file) => ({ file, match: rotated.exec(file) }))
    .filter((entry) => entry.match !== null)
    .map((entry) => ({ file: entry.file, seq: parseInt(entry.match[1], 10) }))
    .sort((a, b) => a.seq - b.seq)
    .map((entry) => entry.file);
  if (files.indexOf(name + ".jsonl") !== -1) names.push(name + ".jsonl");
  return names;
}

// The timestamp (ms) of line `segmentLine` (from 1) of a segment file, or NaN when it cannot be read.
function lineTimeMs(file, segmentLine) {
  try {
    const record = JSON.parse(fs.readFileSync(file, "utf8").split("\n")[segmentLine - 1]);
    return record !== null && typeof record === "object" && TS_PATTERN.test(String(record.ts)) ? Date.parse(record.ts) : NaN;
  } catch (err) {
    return NaN;
  }
}

// ---- Counting --------------------------------------------------------------------------------------------------------

// A value that is safe to print, else "<invalid>". Log values are not trusted: a tampered line must not reach the report as text.
function safe(value) {
  return typeof value === "string" && SAFE_PATTERN.test(value) ? value : "<invalid>";
}

function newCollector() {
  const types = {};
  TYPES.forEach((type) => {
    types[type.id] = { count: 0, by: Object.create(null), listed: [] };
  });
  return { types, unapproved: { count: 0, by: Object.create(null) }, reports: { rows: 0, withProblems: 0 }, skipped: 0, inRange: 0 };
}

// Adds one event to a type: its count, its per-key count with first and last time, and (for a listed type) its entry.
function addEvent(collector, typeId, key, ts, where, detail) {
  const slot = collector.types[typeId];
  slot.count++;
  const by = slot.by[key] || (slot.by[key] = { count: 0, first: ts, last: ts });
  by.count++;
  if (ts < by.first) by.first = ts;
  if (ts > by.last) by.last = ts;
  if (slot.listed.length < MAX_LISTED) slot.listed.push({ ts, where, detail });
}

// Sorts one in-range record into the event types. Only the named fields are read, and each is checked by safe().
function classify(collector, store, record, ts, where) {
  const event = record.event;
  if (event === "guard-decision" && (record.decision === "deny" || record.decision === "ask")) {
    addEvent(collector, record.decision, safe(record.rule_id), ts, where, "rule " + safe(record.rule_id) + ", tool " + safe(record.tool) + ", agent " + safe(record.agent_type));
  } else if (event === "gate-evidence") {
    const exit = typeof record.exit_code === "number" && Number.isFinite(record.exit_code) ? String(record.exit_code) : "<invalid>";
    addEvent(collector, "gate", safe(record.gate_kind) + " exit " + exit, ts, where, "kind " + safe(record.gate_kind) + ", command " + safe(record.gate_command) + ", exit " + exit);
  } else if (event === "ferpa-disclosure") {
    addEvent(collector, "disclosure", safe(record.receiving_party) + " / " + safe(record.legitimate_interest), ts, where,
      "party " + safe(record.receiving_party) + ", interest " + safe(record.legitimate_interest) + ", class " + safe(record.data_class));
  } else if (event === "guard-disabled" || event === "profile-disabled") {
    const subject = event === "guard-disabled" ? record.guard : record.profile;
    addEvent(collector, "disablement", event + " " + safe(subject), ts, where, event + " " + safe(subject));
  }
  if (typeof record.authorizer === "string") {
    if (APPROVAL_PATTERN.test(record.authorizer)) {
      addEvent(collector, "approval", safe(record.authorizer), ts, where, "");
    } else if (record.authorizer === "none") {
      const reason = safe(record.authorizer_reason);
      collector.unapproved.by[reason] = (collector.unapproved.by[reason] || 0) + 1;
      collector.unapproved.count++;
    }
  }
  if (store === FSA_LOG_NAME && FSA_REPORT_EVENTS.indexOf(event) !== -1) {
    collector.reports.rows++;
    if (Array.isArray(record.problems) && record.problems.length > 0) collector.reports.withProblems++;
  }
}

// Reads every segment of a store and sorts the lines inside the window into `collector`. Returns an error code string
// when a segment cannot be read, else null. A line that is not a record or has no valid timestamp counts as skipped.
function scanStore(dir, name, win, collector) {
  let names;
  try {
    names = segmentNames(dir, name);
  } catch (err) {
    return errorCode(err);
  }
  for (let s = 0; s < names.length; s++) {
    let text;
    try {
      text = fs.readFileSync(path.join(dir, names[s]), "utf8");
    } catch (err) {
      return errorCode(err);
    }
    const lines = text.split("\n");
    for (let j = 0; j < lines.length; j++) {
      if (lines[j].length === 0) continue;
      let record = null;
      try {
        record = JSON.parse(lines[j]);
      } catch (err) {
        record = null;
      }
      if (record === null || typeof record !== "object" || Array.isArray(record) || !TS_PATTERN.test(String(record.ts))) {
        collector.skipped++;
        continue;
      }
      const ms = Date.parse(record.ts);
      if (ms < win.fromMs || ms > win.toMs) continue;
      collector.inRange++;
      classify(collector, name, record, record.ts, names[s] + ":" + (j + 1));
    }
  }
  return null;
}

// ---- Chain verification ----------------------------------------------------------------------------------------------

// Verifies one store and decides whether a break touches the range. Returns {result, unverified, lines}: `lines` is the
// wording for the report. A break is inside the range when the broken line is at or before the range end (or has no readable
// time); verify() stops there, so the lines after it are not confirmed. A result with an error is returned as is.
function verifyStore(label, dir, name, win) {
  const result = auditChain.verify(null, { dir, name });
  if (!result || typeof result !== "object") return { result: null, unverified: false, lines: [] };
  if (result.error) return { result, unverified: false, lines: [] };
  if (result.ok) {
    if (result.lines === 0) return { result, unverified: false, lines: [label + ": no lines to verify."] };
    return { result, unverified: false, lines: [label + ": chain intact, " + plural(result.lines, "line") + " verified across " + plural(result.segments, "segment") + "."] };
  }
  const brk = result.firstBreak || {};
  const brokenMs = lineTimeMs(path.join(dir, String(brk.segment)), brk.segmentLine);
  const inside = !Number.isFinite(brokenMs) || brokenMs <= win.toMs;
  if (!inside) {
    return { result, unverified: false, lines: [label + ": chain breaks at line " + brk.line + " (segment " + brk.segment + "), after the end of the range, so the range is not affected."] };
  }
  // The wording and reason text come from the --verify-audit script, so both name a break the same way.
  const described = verifyAuditChain.describe(result).lines.map((line) => label + ": " + line);
  return { result, unverified: true, lines: described };
}

// ---- Report ----------------------------------------------------------------------------------------------------------

function countLines(type, slot) {
  const out = [type.label + ": " + slot.count];
  Object.keys(slot.by).sort().forEach((key) => {
    const by = slot.by[key];
    out.push("  " + key + ": " + by.count + " (first " + by.first + ", last " + by.last + ")");
  });
  if (type.listed && slot.listed.length > 0) {
    slot.listed.forEach((entry) => out.push("  - " + entry.ts + " " + entry.where + " " + entry.detail));
    if (slot.count > slot.listed.length) out.push("  ... " + (slot.count - slot.listed.length) + " more not listed; the log holds them.");
  }
  return out;
}

function reportLines(win, verified, verdicts, collector, notes) {
  const out = [TITLE, "Range: " + win.from + " to " + win.to + " (UTC, inclusive)"];
  out.push(verified ? "Chain verification: VERIFIED for this range." : "Chain verification: UNVERIFIED. Do not rely on the counts below as confirmed.");
  verdicts.forEach((verdict) => verdict.lines.forEach((line) => out.push("  " + line)));
  if (verified) out.push("  Not confirmed by the backward chain alone: the final line of each log, and any lines removed from the end of a log. A head anchor outside the log would confirm both; none is kept yet.");
  out.push("Records in range: " + collector.inRange);
  TYPES.forEach((type) => countLines(type, collector.types[type.id]).forEach((line) => out.push(line)));
  out.push("Records with no recorded approval (authorizer none): " + collector.unapproved.count);
  Object.keys(collector.unapproved.by).sort().forEach((reason) => out.push("  reason " + reason + ": " + collector.unapproved.by[reason]));
  out.push("Subagent report rows in fsa-log: " + collector.reports.rows + " (" + collector.reports.withProblems + " with terminal-block problems)");
  if (collector.skipped > 0) out.push("Lines skipped (not a record or no timestamp): " + collector.skipped);
  notes.forEach((note) => out.push(note));
  return out;
}

// ---- Entry points ----------------------------------------------------------------------------------------------------

function cannotExport(message) {
  return { code: EXIT_CANNOT_EXPORT, lines: ["Cannot export control evidence: " + message] };
}

// Exports the evidence for options {from, to, root, dataDir}. `from` and `to` are dates (YYYY-MM-DD, UTC, inclusive).
// `root` is the absolute project root (the default root when omitted); `dataDir` is the plugin data directory (CLAUDE_PLUGIN_DATA
// when omitted). Returns {code, lines}. Never throws.
function check(options) {
  try {
    const opts = options && typeof options === "object" ? options : {};
    const win = windowOf(opts);
    if (win.error) return cannotExport(win.error);
    const base = typeof opts.root === "string" && opts.root.length > 0 ? path.resolve(opts.root) : defaultRoot();
    if (!base) return cannotExport("the project root is unknown.");
    const dataDirText = typeof opts.dataDir === "string" && opts.dataDir.length > 0 ? opts.dataDir : process.env.CLAUDE_PLUGIN_DATA;
    const dataDir = dataDirText ? path.resolve(dataDirText) : null;

    const stores = [{ label: "Audit log", dir: path.join(base, auditChain.LOG_DIR), name: AUDIT_NAME }];
    const notes = [];
    if (dataDir) stores.push({ label: "fsa-log", dir: dataDir, name: FSA_LOG_NAME });
    else notes.push("fsa-log: not available (no plugin data directory); approvals and report rows come from the audit log only.");

    const collector = newCollector();
    const verdicts = [];
    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      const verdict = verifyStore(store.label, store.dir, store.name, win);
      if (verdict.result === null) return cannotExport("no result from the verifier.");
      if (verdict.result.error) return cannotExport("a segment of the " + store.label + " could not be read (" + errorCode(verdict.result.error) + ").");
      const failed = scanStore(store.dir, store.name, win, collector);
      if (failed !== null) return cannotExport("a segment of the " + store.label + " could not be read (" + failed + ").");
      verdicts.push(verdict);
    }
    const verified = !verdicts.some((verdict) => verdict.unverified);
    return { code: verified ? EXIT_VERIFIED : EXIT_UNVERIFIED, lines: reportLines(win, verified, verdicts, collector, notes) };
  } catch (err) {
    return cannotExport("the export failed (" + errorCode(err) + ").");
  }
}

// Writes the lines of a check() result: stdout for a verdict, stderr when the evidence could not be exported.
function report(outcome) {
  const stream = outcome.code === EXIT_CANNOT_EXPORT ? process.stderr : process.stdout;
  stream.write(outcome.lines.join("\n") + "\n");
}

function main() {
  const outcome = check(parseArgs(process.argv.slice(2)));
  report(outcome);
  process.exitCode = outcome.code;
}

module.exports = { EXIT_VERIFIED, EXIT_UNVERIFIED, EXIT_CANNOT_EXPORT, parseArgs, check, report };

if (require.main === module) main();
