// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Finds the writing-standard tells that one Write, Edit, MultiEdit, or NotebookEdit call adds to a prose file.
// Shared by prose-gate (PreToolUse, block tier) and prose-advisor (PostToolUse, advisory tier).
//
// Only text the call adds is judged, so a file that already holds tells can still be edited:
//   1. The call becomes (before, after) text pairs. When the whole file is known the pair is the whole file
//      before and after the call, so fences, quotes, and other exempt regions are judged in context. When it
//      is not (file unreadable, old_string not found in it) each edit becomes an old_string/new_string pair.
//   2. Lines of "after" with no equal line left in "before" are added lines; lines of "before" with no equal
//      line left in "after" are removed lines (a multiset match, so moved lines count as unchanged).
//   3. prose-rules scan() runs on the whole of each text; only hits on added (after) and removed (before)
//      lines count. Per rule, added = max(0, hits on added lines - hits on removed lines), so rewording a line
//      that already held a tell does not count that tell again.
//   4. When only some hits of a rule are new, the reported ones are those whose surrounding text does not
//      appear in the removed lines.
//
// Pure apart from reading the target file, which callers can replace through options.readFile.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const rules = require("./prose-rules.js");

const EDIT_TOOLS = ["Write", "Edit", "MultiEdit", "NotebookEdit"];
const MAX_TEXT = 1000000; // characters; a larger text is not judged (the call proceeds unjudged)
const MAX_FILE_BYTES = 4 * MAX_TEXT;
const ALL_HITS = 1000000000;
const CONTEXT = 12; // characters on each side of a hit used to tell a kept tell from a new one
const SNIPPET = 20; // characters on each side of a hit shown in messages
const MAX_SCORED = 100; // past this many hits of one rule, the first ones are reported without the kept-text check
const TOO_LARGE = { tooLarge: true };
const ALLOWLIST_FILE = "prose-gate-allowlist.json";
const ALLOW_ALL = "*"; // an allowlist entry that exempts every path
const MAX_ALLOWLIST_ENTRIES = 200;
const MAX_ALLOWLIST_ENTRY_LENGTH = 500;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// File contents as a string, null when missing or unreadable, or TOO_LARGE.
function readText(file) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return null;
    if (stat.size > MAX_FILE_BYTES) return TOO_LARGE;
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    return null;
  }
}

// Path substrings from ${CLAUDE_PLUGIN_DATA}/prose-gate-allowlist.json; [] when absent or malformed.
// The file is separate from hooks-disabled.json, so a passing self-test never changes it.
function loadAllowlist() {
  const dir = process.env.CLAUDE_PLUGIN_DATA;
  if (!dir) return [];
  try {
    const data = JSON.parse(fs.readFileSync(path.join(dir, ALLOWLIST_FILE), "utf8"));
    if (!Array.isArray(data)) return [];
    return data
      .filter((entry) => typeof entry === "string" && entry.length > 0 && entry.length <= MAX_ALLOWLIST_ENTRY_LENGTH)
      .slice(0, MAX_ALLOWLIST_ENTRIES);
  } catch (err) {
    return [];
  }
}

function comparable(file) {
  return process.platform === "win32" ? file.toLowerCase() : file;
}

// True when file sits inside dir (both resolved; the match ends at a path.sep boundary).
function isUnder(file, dir) {
  if (typeof dir !== "string" || dir.length === 0) return false;
  const root = comparable(path.resolve(dir));
  const target = comparable(path.resolve(file));
  const prefix = root.charAt(root.length - 1) === path.sep ? root : root + path.sep;
  return target.indexOf(prefix) === 0;
}

function tmpdirs(options) {
  if (typeof options.tmpdir === "string") return [options.tmpdir];
  const dirs = [os.tmpdir()];
  try {
    dirs.push(fs.realpathSync(dirs[0])); // /tmp may be a link (macOS /var -> /private/var)
  } catch (err) {
    // an unresolvable tmpdir only means the plain path is compared
  }
  return dirs;
}

// Files the prose hooks never judge: scratch files under the system temp directory, and paths matching an
// allowlist entry ("*" matches every path). options: {allowlist, tmpdir} replace the defaults (tests).
function isExempt(file, options) {
  const opts = options || {};
  if (tmpdirs(opts).some((dir) => isUnder(file, dir))) return true;
  const allowlist = Array.isArray(opts.allowlist) ? opts.allowlist : loadAllowlist();
  const slashed = file.replace(/\\/g, "/");
  return allowlist.some((entry) => entry === ALLOW_ALL || file.indexOf(entry) !== -1 || slashed.indexOf(entry) !== -1);
}

function targetPath(input, key) {
  const raw = input.tool_input[key];
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (path.isAbsolute(raw) || typeof input.cwd !== "string" || input.cwd.length === 0) return raw;
  return path.resolve(input.cwd, raw);
}

// A notebook markdown cell is prose when the notebook path would be a prose file as .md.
function isProseNotebook(file) {
  return /\.ipynb$/i.test(file) && rules.isProseFile(file.replace(/\.ipynb$/i, ".md"));
}

function cellSource(cell) {
  if (typeof cell.source === "string") return cell.source;
  return Array.isArray(cell.source) ? cell.source.filter((part) => typeof part === "string").join("") : "";
}

function findCell(notebookText, cellId) {
  if (typeof notebookText !== "string" || typeof cellId !== "string") return null;
  try {
    const notebook = JSON.parse(notebookText);
    const cells = isObject(notebook) && Array.isArray(notebook.cells) ? notebook.cells : [];
    for (let i = 0; i < cells.length; i += 1) {
      if (isObject(cells[i]) && cells[i].id === cellId) return cells[i];
    }
  } catch (err) {
    // an unparseable notebook only means the old cell text is unknown
  }
  return null;
}

// Edit and MultiEdit edits as [{oldText, newText, all}], or null when any edit is malformed.
function editList(toolInput, tool) {
  const raw = tool === "MultiEdit" ? toolInput.edits : [toolInput];
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const edits = [];
  for (let i = 0; i < raw.length; i += 1) {
    const edit = raw[i];
    if (!isObject(edit) || typeof edit.old_string !== "string" || typeof edit.new_string !== "string") return null;
    edits.push({ oldText: edit.old_string, newText: edit.new_string, all: edit.replace_all === true });
  }
  return edits;
}

// Applies edits in order the way the Edit tool does; null when an old_string is not found. An empty old_string
// only applies to an empty file (the Edit tool creates the file that way).
function applyEdits(text, edits) {
  let out = text;
  for (let i = 0; i < edits.length; i += 1) {
    const edit = edits[i];
    if (edit.oldText === "") {
      if (out !== "") return null;
      out = edit.newText;
      continue;
    }
    const at = out.indexOf(edit.oldText);
    if (at === -1) return null;
    out = edit.all
      ? out.split(edit.oldText).join(edit.newText)
      : out.slice(0, at) + edit.newText + out.slice(at + edit.oldText.length);
  }
  return out;
}

function fragmentPairs(edits) {
  return edits.map((edit, k) => ({
    before: edit.oldText,
    after: edit.newText,
    where: edits.length > 1 ? "edit " + (k + 1) + ", line" : "new_string line",
  }));
}

function editPairs(input, tool, file, phase, readFile) {
  const edits = editList(input.tool_input, tool);
  if (!edits) return null;
  let before = null;
  let after = null;
  if (phase === "post") {
    const response = isObject(input.tool_response) ? input.tool_response : {};
    if (typeof response.originalFile === "string") {
      before = response.originalFile;
      after = applyEdits(before, edits);
      if (after === null) {
        const disk = readFile(file);
        after = typeof disk === "string" ? disk : null;
      }
    }
  } else {
    const disk = readFile(file);
    if (disk === TOO_LARGE) return [];
    before = typeof disk === "string" ? disk : edits.length === 1 && edits[0].oldText === "" ? "" : null;
    after = before === null ? null : applyEdits(before, edits);
  }
  if (typeof before === "string" && typeof after === "string") return [{ before, after, where: "line" }];
  return fragmentPairs(edits);
}

function writePairs(input, file, phase, readFile) {
  const content = input.tool_input.content;
  if (typeof content !== "string") return null;
  let before;
  if (phase === "post") {
    const response = isObject(input.tool_response) ? input.tool_response : {};
    if (typeof response.originalFile === "string") before = response.originalFile;
    else if (response.originalFile === null || response.type === "create") before = "";
    else return null; // the earlier contents are unknown, so the added text cannot be told apart
  } else {
    const disk = readFile(file);
    if (disk === TOO_LARGE) return [];
    before = typeof disk === "string" ? disk : "";
  }
  return [{ before, after: content, where: "line" }];
}

function notebookPairs(input, file, phase, readFile) {
  const toolInput = input.tool_input;
  if (toolInput.edit_mode === "delete" || typeof toolInput.new_source !== "string") return null;
  const disk = readFile(file);
  const cell = findCell(typeof disk === "string" ? disk : null, toolInput.cell_id);
  const cellType = typeof toolInput.cell_type === "string" ? toolInput.cell_type : cell && cell.cell_type;
  if (cellType !== "markdown") return null;
  // After the call the notebook already holds the new source, so the advisor judges the whole cell.
  const before = phase === "pre" && toolInput.edit_mode !== "insert" && cell ? cellSource(cell) : "";
  return [{ before, after: toolInput.new_source, where: "cell line" }];
}

// Returns null when the call writes no prose, else {file, pairs: [{before, after, where}]}.
// options: {phase: "pre" | "post", readFile(file) -> string | null, allowlist, tmpdir}; a call that targets
// a temp-directory or allowlisted path writes no judged prose (null).
function changes(input, options) {
  const opts = options || {};
  const phase = opts.phase === "post" ? "post" : "pre";
  const readFile = typeof opts.readFile === "function" ? opts.readFile : readText;
  if (!isObject(input) || !isObject(input.tool_input) || EDIT_TOOLS.indexOf(input.tool_name) === -1) return null;
  const tool = input.tool_name;
  if (tool === "NotebookEdit") {
    const notebook = targetPath(input, "notebook_path");
    if (!notebook || !isProseNotebook(notebook) || isExempt(notebook, opts)) return null;
    const cellPairs = notebookPairs(input, notebook, phase, readFile);
    return cellPairs ? { file: notebook, pairs: cellPairs } : null;
  }
  const file = targetPath(input, "file_path");
  if (!file || !rules.isProseFile(file) || isExempt(file, opts)) return null;
  const pairs = tool === "Write" ? writePairs(input, file, phase, readFile) : editPairs(input, tool, file, phase, readFile);
  return pairs ? { file, pairs } : null;
}

// ---------------------------------------------------------------------------------------------------------
// Added-text findings

function countLines(lines) {
  const pool = new Map();
  lines.forEach((line) => pool.set(line, (pool.get(line) || 0) + 1));
  return pool;
}

// Line numbers (1-based) present on one side only, matched as multisets.
function unmatchedLines(lines, otherLines) {
  const pool = countLines(otherLines);
  const numbers = new Set();
  const texts = [];
  lines.forEach((line, i) => {
    const left = pool.get(line) || 0;
    if (left > 0) {
      pool.set(line, left - 1);
    } else {
      numbers.add(i + 1);
      texts.push(line);
    }
  });
  return { numbers, text: texts.join("\n") };
}

// Up to `width` characters on each side of a hit, cut at line breaks. Reads only the window, so the cost per
// hit stays constant on very long lines.
function around(text, index, length, width) {
  const start = Math.max(0, index - width);
  const window = text.slice(start, Math.min(text.length, index + length + width));
  const at = index - start;
  const head = at > 0 ? window.lastIndexOf("\n", at - 1) : -1;
  const tail = window.indexOf("\n", at + length);
  return window.slice(head + 1, tail === -1 ? window.length : tail);
}

// One line of surrounding text for messages: control characters removed, whitespace collapsed.
function snippet(text, hit) {
  return around(text, hit.index, hit.excerpt.length, SNIPPET)
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function groupByRule(hits) {
  const groups = new Map();
  hits.forEach((hit) => {
    if (!groups.has(hit.id)) groups.set(hit.id, []);
    groups.get(hit.id).push(hit);
  });
  return groups;
}

function judgePair(pair, tier) {
  if (pair.before.length > MAX_TEXT || pair.after.length > MAX_TEXT) return [];
  const beforeLines = pair.before === "" ? [] : pair.before.split("\n");
  const afterLines = pair.after.split("\n");
  const added = unmatchedLines(afterLines, beforeLines);
  if (added.numbers.size === 0) return [];
  const newHits = rules.scan(pair.after, { tier, maxPerRule: ALL_HITS }).filter((hit) => added.numbers.has(hit.line));
  if (newHits.length === 0) return [];
  const removed = unmatchedLines(beforeLines, afterLines);
  const oldHits = removed.numbers.size === 0
    ? []
    : rules.scan(pair.before, { tier, maxPerRule: ALL_HITS }).filter((hit) => removed.numbers.has(hit.line));
  const oldCounts = new Map();
  oldHits.forEach((hit) => oldCounts.set(hit.id, (oldCounts.get(hit.id) || 0) + 1));

  const out = [];
  groupByRule(newHits).forEach((hits, id) => {
    const extra = hits.length - (oldCounts.get(id) || 0);
    if (extra <= 0) return;
    let chosen = hits.slice(0, extra);
    if (extra < hits.length && hits.length <= MAX_SCORED) {
      // Hits whose surroundings already appear in the removed lines are most likely kept, not added.
      const scored = hits.map((hit, order) => ({
        hit,
        order,
        kept: removed.text.indexOf(around(pair.after, hit.index, hit.excerpt.length, CONTEXT)) !== -1,
      }));
      scored.sort((a, b) => (a.kept === b.kept ? a.order - b.order : a.kept ? 1 : -1));
      chosen = scored.slice(0, extra).sort((a, b) => a.order - b.order).map((entry) => entry.hit);
    }
    chosen.forEach((hit) => {
      out.push({
        id: hit.id,
        family: hit.family,
        tier: hit.tier,
        line: hit.line,
        where: pair.where + " " + hit.line,
        excerpt: hit.excerpt,
        snippet: snippet(pair.after, hit),
        fix: hit.fix,
      });
    });
  });
  return out;
}

// Findings of one tier ("block" or "advise") in the text a call adds, in rule order per pair.
function addedFindings(change, tier) {
  if (!change || !Array.isArray(change.pairs)) return [];
  let out = [];
  change.pairs.forEach((pair) => {
    out = out.concat(judgePair(pair, tier));
  });
  return out;
}

// Groups findings by family in first-seen order: [{family, findings}].
function byFamily(findings) {
  const order = [];
  const groups = new Map();
  findings.forEach((finding) => {
    if (!groups.has(finding.family)) {
      groups.set(finding.family, []);
      order.push(finding.family);
    }
    groups.get(finding.family).push(finding);
  });
  return order.map((family) => ({ family, findings: groups.get(family) }));
}

module.exports = {
  EDIT_TOOLS,
  MAX_TEXT,
  ALLOWLIST_FILE,
  changes,
  isExempt,
  loadAllowlist,
  addedFindings,
  byFamily,
  applyEdits,
  readText,
};
