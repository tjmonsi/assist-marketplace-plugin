#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Rewrites every "## Report Writing Standard" block in agents/*.md and skills/**/*.md from
// rules/writing-standard-compact.md, so the plugin carries one copy of the always-on writing rules.
//
// Usage (from any directory):
//   node scripts/sync-writing-standard.js           rewrite drifted blocks, print a summary
//   node scripts/sync-writing-standard.js --check   change nothing; exit 1 if any block differs
//
// A block is the heading line plus everything up to the next level-1 or level-2 heading outside a code fence,
// or the end of the file. The heading line itself is kept as written. A trailing horizontal rule before the next
// heading is kept. Exit codes: 0 in sync (or synced), 1 drift found by --check, 2 operational error.
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");

const PLUGIN_ROOT = path.resolve(__dirname, "..");
const COMPACT_FILE = path.join(PLUGIN_ROOT, "rules", "writing-standard-compact.md");
const HEADING = /^## Report Writing Standard\b/;
const BLOCK_END = /^#{1,2} /;
const FENCE = /^[ \t]{0,3}(`{3,40}|~{3,40})/;
const FENCE_CLOSE = /^[ \t]{0,3}[`~]{3,40}[ \t]{0,40}$/;
const RULE_LINE = /^[ \t]{0,3}(?:-{3,40}|\*{3,40}|_{3,40})[ \t]{0,40}$/;
const MAX_COMPACT_CHARS = 1400;

function relative(file) {
  return path.relative(PLUGIN_ROOT, file).split(path.sep).join("/");
}

// The compact file is used verbatim elsewhere, so it must be bullets only and stay under the size cap.
function loadCompact() {
  const text = fs.readFileSync(COMPACT_FILE, "utf8").replace(/\r\n/g, "\n").replace(/\s+$/, "");
  const lines = text.split("\n");
  const stray = lines.filter((line) => line.indexOf("- ") !== 0);
  if (lines.length === 0 || stray.length > 0) {
    throw new Error(relative(COMPACT_FILE) + " must contain only \"- \" bullet lines; found: " + JSON.stringify(stray[0] || ""));
  }
  if (text.length > MAX_COMPACT_CHARS) {
    throw new Error(relative(COMPACT_FILE) + " is " + text.length + " characters; the limit is " + MAX_COMPACT_CHARS);
  }
  return lines;
}

function listMarkdown(dir, recursive) {
  let found = [];
  fs.readdirSync(dir).sort().forEach((name) => {
    const full = path.join(dir, name);
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      if (recursive) found = found.concat(listMarkdown(full, true));
    } else if (stat.isFile() && /\.md$/i.test(name)) {
      found.push(full);
    }
  });
  return found;
}

function targetFiles() {
  return listMarkdown(path.join(PLUGIN_ROOT, "agents"), false)
    .concat(listMarkdown(path.join(PLUGIN_ROOT, "skills"), true));
}

// Returns [{ start, end }] line ranges: start is the heading line, end is one past the block's last line.
function findBlocks(lines) {
  const blocks = [];
  let fence = null;
  let open = null;
  lines.forEach((line, index) => {
    const marker = FENCE.exec(line);
    if (fence) {
      if (marker && marker[1].charAt(0) === fence.charAt(0) && marker[1].length >= fence.length && FENCE_CLOSE.test(line)) {
        fence = null;
      }
      return;
    }
    if (marker) {
      fence = marker[1];
      return;
    }
    if (open && BLOCK_END.test(line)) {
      blocks.push({ start: open, end: index });
      open = null;
    }
    if (HEADING.test(line)) open = index;
  });
  if (open !== null) blocks.push({ start: open, end: lines.length });
  return blocks;
}

function renderBlock(heading, oldBody, compact, atEnd) {
  const trimmed = oldBody.slice();
  while (trimmed.length && trimmed[trimmed.length - 1].trim() === "") trimmed.pop();
  const ruleLine = trimmed.length && RULE_LINE.test(trimmed[trimmed.length - 1]) ? trimmed[trimmed.length - 1] : null;
  let out = [heading, ""].concat(compact);
  if (!atEnd) {
    out.push("");
    if (ruleLine) out = out.concat([ruleLine, ""]);
  }
  return out;
}

// Returns { text, blocks, changed } for one file's contents.
function syncText(text, compact) {
  const eol = text.indexOf("\r\n") !== -1 ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const hadFinalNewline = lines.length > 1 && lines[lines.length - 1] === "";
  if (hadFinalNewline) lines.pop();
  const blocks = findBlocks(lines);
  // Rewrite from the last block back so earlier line indexes stay valid.
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    const atEnd = block.end === lines.length;
    const replacement = renderBlock(lines[block.start], lines.slice(block.start + 1, block.end), compact, atEnd);
    Array.prototype.splice.apply(lines, [block.start, block.end - block.start].concat(replacement));
  }
  const result = lines.join(eol) + (hadFinalNewline ? eol : "");
  return { text: result, blocks: blocks.length, changed: result !== text };
}

function run(argv) {
  const check = argv.indexOf("--check") !== -1;
  const compact = loadCompact();
  const drifted = [];
  let blockCount = 0;
  let fileCount = 0;
  targetFiles().forEach((file) => {
    const original = fs.readFileSync(file, "utf8");
    const synced = syncText(original, compact);
    if (synced.blocks === 0) return;
    fileCount += 1;
    blockCount += synced.blocks;
    if (!synced.changed) return;
    drifted.push(relative(file));
    if (!check) fs.writeFileSync(file, synced.text, "utf8");
  });

  if (blockCount === 0) {
    throw new Error("no \"## Report Writing Standard\" blocks found under agents/ or skills/");
  }
  const verb = check ? "differ from" : "rewritten from";
  console.log(blockCount + " block(s) in " + fileCount + " file(s); " + drifted.length + " " + verb + " " + relative(COMPACT_FILE) + ".");
  drifted.forEach((file) => console.log("  " + file));
  return check && drifted.length > 0 ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exitCode = run(process.argv.slice(2));
  } catch (error) {
    console.error("sync-writing-standard: " + (error && error.message ? error.message : String(error)));
    process.exitCode = 2;
  }
}

module.exports = { findBlocks, syncText, loadCompact, run };
