// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-220|FR-238] PreToolUse hook (matcher Write|Edit|MultiEdit) that scans the text a call writes to a code file for
// insecure patterns and records each match as a would-deny finding in the advisory baseline store
// .agent/governance/review-findings.jsonl (task plan Tranche 4, Step 35; specs/spec-hooks-code-scan.md).
//
// ADVISORY ONLY (FR-238, advisory phase). Every rule is advisory unless .agent/governance/rule-modes.json names it
// "blocking", and an absent, unreadable, or malformed store means advisory for every rule (lib/severity.js parseRuleModes),
// so a store defect never turns a rule blocking. In advisory mode the hook records the finding and allows the write: it
// prints nothing. The deny that names the rule id and line applies only to a finding that route() sends to "block-merge"
// for a rule the store marks "blocking", and only the user-run scripts/promote-rule.js (task plan Step 36) writes that
// mode, so this release enables no blocking.
//
// [NFR-028] FAIL-CLOSED CLASS, DORMANT. The guarded class is a write of a code file (lib/code-rules.js CODE_EXTENSIONS).
// failClosedFor() defines it. It is exported and not wired in: this hook runs on the filter runtime (health.transform), which
// has no fail-closed branch, so an evaluation error, a timeout, or an unreadable store lets the write proceed and the
// failure is noted in hook-health.jsonl. At promotion the hook becomes a guard (health.guard) that passes failClosedFor, and
// the fail-closed deny of a code-file write activates there; that change is Step 36 and is not built here.
//
// [NFR-029] RULE-BASED, NO MODEL, NO NETWORK. The scan is a pattern match over the written text (lib/code-rules.js). This
// module imports no model client, makes no network request, and spawns no process. A write to a file outside the code set
// returns before any scan, and a code write with no match returns before the store is read, so the common write costs the
// path check and one pass over the text. [NFR-027] The hook holds no write tool: its one side effect is the append of a
// finding line to the baseline store, which it writes with fs, as the audit-log writer does.
//
// A finding record is {id, rule_id, severity, confidence, file, line, timestamp, review_id} (lib/severity.js checkFinding).
// [NFR-031] It holds the rule id, the severity and confidence, the path relative to the project root, and the line number;
// never the matched text, the written text, or a prompt. review_id is the session id, so the baseline counts a session as
// one review. No label is set: only the user-run scripts/label-findings.js sets one [NFR-034].
//
// Its self-test is report-only (impl/health-check.js): a failure is reported and never disables it, because disabling the
// recorder would leave no baseline for the promotion decision.
"use strict";

const fs = require("fs");
const path = require("path");
const health = require("../lib/health.js");
const severity = require("../lib/severity.js");
const codeRules = require("../lib/code-rules.js");

const NAME = "code-scan";
const WRITE_TOOLS = ["Write", "Edit", "MultiEdit"];
const STORE_DIR = path.join(".agent", "governance");
const FINDINGS_FILE = "review-findings.jsonl";
const MODES_FILE = "rule-modes.json";
const MAX_EDITS = 200;
const MAX_FILE_READ = 2000000;
const ALLOW = Object.freeze({ deny: false, findings: Object.freeze([]), reason: "" });

let counter = 0;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// The code file a Write, Edit, or MultiEdit targets, or null when the call is not one of the three or names no usable path.
function targetOf(input) {
  if (!isObject(input) || WRITE_TOOLS.indexOf(input.tool_name) === -1 || !isObject(input.tool_input)) return null;
  const file = input.tool_input.file_path;
  return typeof file === "string" && file.length > 0 ? file : null;
}

// [NFR-028] True when the call writes a code file: the class the fail-closed deny would guard after promotion. Cheap, never
// throws. Dormant: nothing passes it to a runner in this release.
function failClosedFor(input) {
  try {
    const file = targetOf(input);
    return file !== null && codeRules.isCodeFile(file, null);
  } catch (err) {
    return false;
  }
}

// The text each part of the call writes: [{text, before}]. `before` is the text it replaces ("" for a Write), used only to
// place an edit's line numbers in the file.
function writtenParts(input) {
  const toolInput = input.tool_input;
  if (input.tool_name === "Write") return typeof toolInput.content === "string" ? [{ text: toolInput.content, before: "" }] : [];
  if (input.tool_name === "Edit") {
    return typeof toolInput.new_string === "string" ? [{ text: toolInput.new_string, before: typeof toolInput.old_string === "string" ? toolInput.old_string : "" }] : [];
  }
  const edits = Array.isArray(toolInput.edits) ? toolInput.edits.slice(0, MAX_EDITS) : [];
  const parts = [];
  edits.forEach((edit) => {
    if (isObject(edit) && typeof edit.new_string === "string") {
      parts.push({ text: edit.new_string, before: typeof edit.old_string === "string" ? edit.old_string : "" });
    }
  });
  return parts;
}

function readText(file) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_FILE_READ) return null;
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    return null;
  }
}

// The number of lines in the file before the text an edit replaces, so a finding in an edit reports its line in the file. 0
// when the file or the replaced text cannot be found; the line then counts from the start of the written text.
function lineBase(file, before, readFile) {
  if (before.length === 0) return 0;
  const content = readFile(file);
  if (typeof content !== "string") return 0;
  const at = content.indexOf(before);
  if (at === -1) return 0;
  let lines = 0;
  for (let i = content.indexOf("\n"); i !== -1 && i < at; i = content.indexOf("\n", i + 1)) lines++;
  return lines;
}

// [FR-220] The findings in the text a call writes: [{rule_id, severity, confidence, line, fix}] in order of line, or [] for a
// call outside the code-file class. options: {root, readFile} replace the project-root lookup and the file read (the
// self-test). Reads a file only when a match needs its line placed. Pure otherwise.
function scanCall(input, options) {
  const file = targetOf(input);
  if (file === null || !codeRules.isCodeFile(file, options.root)) return [];
  const readFile = typeof options.readFile === "function" ? options.readFile : readText;
  const found = [];
  writtenParts(input).forEach((part) => {
    const hits = codeRules.scan(part.text);
    if (hits.length === 0) return;
    const base = input.tool_name === "Write" ? 0 : lineBase(file, part.before, readFile);
    hits.forEach((hit) => found.push(Object.assign({}, hit, { line: hit.line + base })));
  });
  found.sort((a, b) => a.line - b.line);
  return found.slice(0, codeRules.MAX_FINDINGS);
}

// The rule modes of the project: the store parsed defensively, or an empty map (every rule advisory) when it is absent,
// unreadable, or malformed [FR-238].
function readModes(root) {
  if (typeof root !== "string" || root.length === 0) return severity.parseRuleModes(null);
  try {
    return severity.parseRuleModes(fs.readFileSync(path.join(root, STORE_DIR, MODES_FILE), "utf8"));
  } catch (err) {
    return severity.parseRuleModes(null);
  }
}

// The path as the record names it: relative to the project root with forward slashes when inside it, else as given.
function recordPath(root, file) {
  if (typeof root !== "string" || root.length === 0 || !path.isAbsolute(file)) return file;
  const relative = path.relative(root, file);
  if (relative === "" || relative === ".." || relative.indexOf(".." + path.sep) === 0 || path.isAbsolute(relative)) return file;
  return relative.split(path.sep).join("/");
}

function findingId() {
  counter += 1;
  return "cs-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1679616).toString(36) + "-" + counter;
}

// [FR-238] The baseline record of one finding, or null when it does not pass severity.checkFinding (a path with a control
// character, say). No label: only the user sets one.
function recordOf(input, root, hit) {
  const record = {
    id: findingId(),
    rule_id: hit.rule_id,
    severity: hit.severity,
    confidence: hit.confidence,
    file: recordPath(root, input.tool_input.file_path),
    line: hit.line,
    timestamp: new Date().toISOString(),
  };
  if (typeof input.session_id === "string" && severity.ID_PATTERN.test(input.session_id)) record.review_id = input.session_id;
  return severity.checkFinding(record) === null ? null : record;
}

// Appends one record line to the baseline store under `root`. Returns true when the line was written. Never throws.
function appendFinding(root, record) {
  if (typeof root !== "string" || root.length === 0) return false;
  try {
    const dir = path.join(root, STORE_DIR);
    mkdirs(dir);
    fs.appendFileSync(path.join(dir, FINDINGS_FILE), JSON.stringify(record) + "\n");
    return true;
  } catch (err) {
    return false;
  }
}

function mkdirs(dir) {
  if (fs.existsSync(dir)) return;
  const parent = path.dirname(dir);
  if (parent !== dir) mkdirs(parent);
  try {
    fs.mkdirSync(dir);
  } catch (err) {
    if (!err || err.code !== "EEXIST") throw err;
  }
}

function plural(count, word) {
  return count + " " + word + (count === 1 ? "" : "s");
}

// [FR-220] The deny reason: names the rule id and the line, and the remedy.
function denyReason(file, hit) {
  return "assist-plugin code-scan denied this write to " + path.basename(file) + ": rule " + hit.rule_id + " (" + hit.severity + ", " + hit.confidence +
    " confidence) matched at line " + hit.line + ". Fix: " + hit.fix + ".";
}

// Decision for one call. Returns {deny, reason, findings, recorded}: `findings` are the matches, `recorded` the records the
// sink accepted, `deny` true only for a "block-merge" finding of a rule the store marks "blocking" (never in this release,
// where the store is advisory). options: {root, modes, readFile, sink} replace the project-root lookup, the store read, the
// file read, and the baseline write (the self-test, which reads and writes nothing real). The sink gets a record and returns
// false when it could not store it; a failed append is noted in hook-health.jsonl and the write proceeds.
function run(input, options) {
  const opts = options || {};
  if (targetOf(input) === null) return ALLOW;
  const root = typeof opts.root === "string" ? opts.root : health.auditRoot(input);
  const findings = scanCall(input, { root, readFile: opts.readFile });
  if (findings.length === 0) return ALLOW;
  const modes = opts.modes && typeof opts.modes === "object" ? opts.modes : readModes(root);
  const sink = typeof opts.sink === "function" ? opts.sink : (record) => appendFinding(root, record);
  let denied = null;
  let failed = 0;
  const recorded = [];
  findings.forEach((hit) => {
    // [FR-239|FR-238] route() reads the finding; applyMode() downgrades "block-merge" to "inline-comment" for an advisory rule.
    // The hook denies only on "block-merge", so an advisory rule records the finding and allows the write.
    const routing = severity.applyMode(severity.route(hit), severity.modeOf(modes, hit.rule_id));
    if (routing === severity.ROUTES.block && denied === null) denied = hit;
    const record = recordOf(input, root, hit);
    if (record !== null && sink(record) !== false) recorded.push(record);
    else failed++;
  });
  if (failed > 0) health.logEvent(NAME, "baseline-append-failed", plural(failed, "finding") + " not stored");
  if (denied === null) return { deny: false, findings, recorded, reason: "" };
  return { deny: true, findings, recorded, reason: denyReason(input.tool_input.file_path, denied), rule: denied.rule_id };
}

function main() {
  health.transform(
    NAME,
    (input) => {
      const result = run(input);
      if (!result.deny) return null;
      health.logDecision(NAME, "deny", result.rule, input);
      return { stdout: { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: result.reason } } };
    },
    { suffix: "this write was not scanned for insecure code", disabledNote: "code writes are not scanned for insecure code" }
  );
}

module.exports = { NAME, failClosedFor, scanCall, readModes, run, main };

if (require.main === module) main();
