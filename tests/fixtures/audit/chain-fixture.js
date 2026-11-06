// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Shared fixtures and helpers for the harness-governance Tranche 2 (Integrity) acceptance tests.
//
// Sources: specs/spec-hooks-audit.md (chain, rotation, verification), docs/requirements/FR-NFR-harness-governance.md
// v1.3 (FR-224, FR-225, NFR-030, NFR-032). Task plan: docs/task-plans/task-plan-harness-governance-20261028-0759.md,
// Step 20 (`tests/fixtures/audit/`: intact, edited, deleted, reordered, a rotated pair of segments, and a
// 100,000-line corpus generator).
//
// Nothing here commits a large data file. Every log is generated into a temp directory at test time:
//   buildChainLines(count, options)       -> {lines, lastHash}   a valid chain of `count` JSON lines
//   writeChain(root, segmentCounts)       -> {files, total, lastHash}
//                                            one count per segment; the last count is the current segment
//                                            (audit.jsonl), earlier ones are rotated segments (audit-NNNNNN.jsonl)
//   generateLargeChain(root, total, n)    -> writeChain with `total` lines split over `n` segments
//                                            (the 100,000-line corpus of NFR-030 is generated, never committed)
//   rotatedPair(root, perSegment)         -> a rotated pair: one rotated segment plus the current segment
//   editLine / deleteLine / swapLines / dropTail / appendPartial   the tamper corpus helpers
//
// The chain format follows the spec: one JSON object per line, `prev` holds the SHA-256 (hex) of the exact stored
// text of the prior line without its newline, and the first line of the first segment holds the genesis value that
// the audit library exports. The first line of each later segment holds the final hash of the segment before it.
//
// Test helpers (temp roots, hook launchers, log readers) live here as well so the Tranche 2 test files share them.
// Run nothing from this file directly: it is required by the *.test.js files.

"use strict";

const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const auditChain = require(path.join(PLUGIN, "hooks", "lib", "audit-chain.js"));

const MARKER = "fixture-marker-7f3a9c";
const WORKER = path.join(__dirname, "append-worker.js");
const scratch = [];

// ---------------------------------------------------------------------------
// Scratch space
// ---------------------------------------------------------------------------

function cleanup() {
  while (scratch.length > 0) {
    fs.rmSync(scratch.pop(), { recursive: true, force: true });
  }
}

function tempDir(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix || "tranche2-")));
  scratch.push(dir);
  return dir;
}

// A project root: a temp directory that holds a .git directory, so the hooks find it as the git root.
function tempRoot(prefix) {
  const dir = tempDir(prefix || "tranche2-root-");
  fs.mkdirSync(path.join(dir, ".git"));
  return dir;
}

// ---------------------------------------------------------------------------
// Chain basics
// ---------------------------------------------------------------------------

function sha256Hex(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function logDir(root) {
  return path.join(root, auditChain.LOG_DIR);
}

function currentLog(root) {
  return path.join(logDir(root), auditChain.CURRENT_FILE);
}

function segmentName(seq) {
  return "audit-" + String(seq).padStart(6, "0") + ".jsonl";
}

// The lines of a text without the empty piece that a final newline leaves. A last line with no newline is kept.
function splitLines(text) {
  if (text === "") return [];
  const parts = text.split("\n");
  if (parts[parts.length - 1] === "") parts.pop();
  return parts;
}

function readLines(file) {
  return splitLines(fs.readFileSync(file, "utf8"));
}

// The segment files of a root: rotated segments (oldest first, sorted by name), the current segment, and both in
// walk order.
function segmentFiles(root) {
  const dir = logDir(root);
  const result = { rotated: [], current: null, ordered: [] };
  if (!fs.existsSync(dir)) return result;
  const names = fs.readdirSync(dir).filter((name) => /^audit.*\.jsonl$/.test(name));
  result.rotated = names
    .filter((name) => name !== auditChain.CURRENT_FILE)
    .sort()
    .map((name) => path.join(dir, name));
  result.ordered = result.rotated.slice();
  if (names.indexOf(auditChain.CURRENT_FILE) !== -1) {
    result.current = path.join(dir, auditChain.CURRENT_FILE);
    result.ordered.push(result.current);
  }
  return result;
}

function readAllLines(root) {
  let all = [];
  segmentFiles(root).ordered.forEach((file) => {
    if (fs.statSync(file).isFile()) all = all.concat(readLines(file));
  });
  return all;
}

function readRecords(root) {
  return readAllLines(root).map((line) => JSON.parse(line));
}

function rawLog(root) {
  let text = "";
  segmentFiles(root).ordered.forEach((file) => {
    if (fs.statSync(file).isFile()) text += fs.readFileSync(file, "utf8");
  });
  return text;
}

// Writes `lines` as the current segment of `root` (a final newline is added unless options.finalNewline is false).
function plantLines(root, lines, options) {
  const opts = options || {};
  fs.mkdirSync(logDir(root), { recursive: true });
  const text = lines.length === 0 ? "" : lines.join("\n") + (opts.finalNewline === false ? "" : "\n");
  fs.writeFileSync(currentLog(root), text);
}

// ---------------------------------------------------------------------------
// Corpus generators
// ---------------------------------------------------------------------------

// A valid chain of `count` lines. options: {prev: the hash the first line carries (default genesis), start: the
// number of the first line (default 1)}.
function buildChainLines(count, options) {
  const opts = options || {};
  let prev = opts.prev || auditChain.GENESIS_HASH;
  const start = opts.start || 1;
  const base = Date.UTC(2026, 0, 1, 0, 0, 0);
  const lines = [];
  for (let i = 0; i < count; i += 1) {
    const n = start + i;
    const line = JSON.stringify({
      ts: new Date(base + n * 1000).toISOString(),
      prev: prev,
      event: "fixture-event",
      rule_id: MARKER,
      n: n,
    });
    lines.push(line);
    prev = sha256Hex(line);
  }
  return { lines: lines, lastHash: prev };
}

// One count per segment. The last count is the current segment (audit.jsonl); the counts before it are rotated
// segments audit-000001.jsonl, audit-000002.jsonl, and so on. Each segment's first line carries the final hash of the
// segment before it, so the chain verifies across every cut.
function writeChain(root, segmentCounts) {
  const dir = logDir(root);
  fs.mkdirSync(dir, { recursive: true });
  let prev = auditChain.GENESIS_HASH;
  let start = 1;
  let total = 0;
  const files = [];
  segmentCounts.forEach((count, index) => {
    const isCurrent = index === segmentCounts.length - 1;
    const file = path.join(dir, isCurrent ? auditChain.CURRENT_FILE : segmentName(index + 1));
    const built = buildChainLines(count, { prev: prev, start: start });
    fs.writeFileSync(file, count === 0 ? "" : built.lines.join("\n") + "\n");
    files.push(file);
    if (count > 0) prev = built.lastHash;
    start += count;
    total += count;
  });
  return { files: files, total: total, lastHash: prev };
}

// A rotated pair: one rotated segment of `perSegment` lines and the current segment of `perSegment` lines.
function rotatedPair(root, perSegment) {
  return writeChain(root, [perSegment, perSegment]);
}

// The NFR-030 corpus: `total` lines over `segments` segments (an estimate-sized log, generated at test time).
function generateLargeChain(root, total, segments) {
  const count = Math.max(1, segments || 1);
  const per = Math.floor(total / count);
  const counts = [];
  for (let i = 0; i < count; i += 1) counts.push(per);
  counts[count - 1] += total - per * count;
  return writeChain(root, counts);
}

// ---------------------------------------------------------------------------
// Tamper corpus (line numbers are 1-based within the file)
// ---------------------------------------------------------------------------

function rewriteLines(file, change) {
  const lines = splitLines(fs.readFileSync(file, "utf8"));
  const out = change(lines.slice());
  fs.writeFileSync(file, out.length === 0 ? "" : out.join("\n") + "\n");
}

// Edits one line after writing: the line stays valid JSON but no longer hashes to what its successor holds.
function editLine(file, lineNo) {
  rewriteLines(file, (lines) => {
    const record = JSON.parse(lines[lineNo - 1]);
    record.edited = "yes";
    lines[lineNo - 1] = JSON.stringify(record);
    return lines;
  });
}

function deleteLine(file, lineNo) {
  rewriteLines(file, (lines) => {
    lines.splice(lineNo - 1, 1);
    return lines;
  });
}

function swapLines(file, first, second) {
  rewriteLines(file, (lines) => {
    const held = lines[first - 1];
    lines[first - 1] = lines[second - 1];
    lines[second - 1] = held;
    return lines;
  });
}

function dropTail(file, count) {
  rewriteLines(file, (lines) => lines.slice(0, Math.max(0, lines.length - count)));
}

// Adds text with no end of line, the way a crash in the middle of a write leaves the file.
function appendPartial(file, text) {
  fs.appendFileSync(file, text || '{"ts":"2026-01-01T00:00:00.000Z","prev":"abc');
}

// ---------------------------------------------------------------------------
// Processes
// ---------------------------------------------------------------------------

function cleanEnv(extra) {
  const env = Object.assign({}, process.env);
  ["CLAUDE_PLUGIN_ROOT", "CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA", "CLAUDE_CONFIG_DIR"].forEach((key) => {
    delete env[key];
  });
  return Object.assign(env, extra || {});
}

// Runs `hooks/<name>.js` as Claude Code does: JSON on stdin. The process directory is a fresh temp directory with no
// .git, so a hook that fell back to the process directory could not write into this repository. options: {dataDir,
// cwd, env, args}.
function runHook(name, doc, options) {
  const opts = options || {};
  const dataDir = opts.dataDir || tempDir("tranche2-data-");
  const cwd = opts.cwd || tempDir("tranche2-cwd-");
  const result = childProcess.spawnSync(process.execPath, [path.join(PLUGIN, "hooks", name + ".js")].concat(opts.args || []), {
    cwd: cwd,
    env: cleanEnv(Object.assign({ CLAUDE_PLUGIN_DATA: dataDir, CLAUDE_CONFIG_DIR: tempDir("tranche2-claude-") }, opts.env || {})),
    input: doc === undefined ? "" : typeof doc === "string" ? doc : JSON.stringify(doc),
    encoding: "utf8",
    timeout: 60000,
  });
  result.dataDir = dataDir;
  return result;
}

// Runs a small wrapper script (fault injection: the wrapper replaces one library function with a thrower, then calls
// the hook's main()). The hook files themselves are never edited.
function runWrapper(source, doc, options) {
  const opts = options || {};
  const dataDir = opts.dataDir || tempDir("tranche2-data-");
  const dir = tempDir("tranche2-wrapper-");
  const file = path.join(dir, "wrapper.js");
  fs.writeFileSync(file, source);
  const result = childProcess.spawnSync(process.execPath, [file], {
    cwd: opts.cwd || tempDir("tranche2-cwd-"),
    env: cleanEnv(Object.assign({ FX_PLUGIN: PLUGIN, CLAUDE_PLUGIN_DATA: dataDir, CLAUDE_CONFIG_DIR: tempDir("tranche2-claude-") }, opts.env || {})),
    input: doc === undefined ? "" : typeof doc === "string" ? doc : JSON.stringify(doc),
    encoding: "utf8",
    timeout: 60000,
  });
  result.dataDir = dataDir;
  return result;
}

// fsa-write-bar with the shell write-target extractor made to throw: the fail-closed path (NFR-028) of the Bash judge.
const SHELL_FAULT_WRAPPER = [
  '"use strict";',
  'const path = require("path");',
  "const plugin = process.env.FX_PLUGIN;",
  'const shellWrites = require(path.join(plugin, "hooks", "lib", "shell-writes.js"));',
  'shellWrites.writeTargets = function () { throw new Error("injected parse failure"); };',
  'require(path.join(plugin, "hooks", "impl", "fsa-write-bar.js")).main();',
  "",
].join("\n");

function runWithShellFault(doc, options) {
  return runWrapper(SHELL_FAULT_WRAPPER, doc, options);
}

// goal-guard with the rule analysis made to throw: the check-error path, which must withhold nothing.
const HIJACK_FAULT_WRAPPER = [
  '"use strict";',
  'const path = require("path");',
  "const plugin = process.env.FX_PLUGIN;",
  'const rules = require(path.join(plugin, "hooks", "lib", "hijack-rules.js"));',
  'rules.analyze = function () { throw new Error("injected rule failure"); };',
  'rules.matchForm = function () { throw new Error("injected rule failure"); };',
  'require(path.join(plugin, "hooks", "impl", "goal-guard.js")).main();',
  "",
].join("\n");

function runWithHijackFault(doc, options) {
  return runWrapper(HIJACK_FAULT_WRAPPER, doc, options);
}

// The entries of ${CLAUDE_PLUGIN_DATA}/hook-health.jsonl.
function readHealthLog(dataDir) {
  const file = path.join(dataDir, "hook-health.jsonl");
  if (!fs.existsSync(file)) return [];
  return splitLines(fs.readFileSync(file, "utf8"))
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        return null;
      }
    })
    .filter(Boolean);
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

module.exports = {
  REPO,
  PLUGIN,
  WORKER,
  MARKER,
  auditChain,
  cleanup,
  tempDir,
  tempRoot,
  sha256Hex,
  logDir,
  currentLog,
  segmentName,
  splitLines,
  readLines,
  segmentFiles,
  readAllLines,
  readRecords,
  rawLog,
  plantLines,
  buildChainLines,
  writeChain,
  rotatedPair,
  generateLargeChain,
  editLine,
  deleteLine,
  swapLines,
  dropTail,
  appendPartial,
  cleanEnv,
  runHook,
  runWrapper,
  runWithShellFault,
  runWithHijackFault,
  readHealthLog,
  median,
};
