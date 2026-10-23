// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// PreToolUse guard for Write, Edit, MultiEdit, and NotebookEdit on prose files (.md, .mdx, .txt, .rst, .adoc,
// and markdown notebook cells). It denies a call only when the text the call adds holds a block-tier tell from
// lib/prose-rules.js: an em dash, chatbot residue, a curly quote, or a summary label. Advisory tells never
// deny (prose-advisor reports them after the write). Text already in the file is not judged (see
// lib/prose-diff.js), so files with old tells stay editable. The deny reason lists each hit with its line, rule
// id, and fix so the next attempt rewrites only the flagged text. Files under the system temp directory and
// paths in ${CLAUDE_PLUGIN_DATA}/prose-gate-allowlist.json ("*" = every path) are never judged. A voice script
// under docs/tts/ is judged like any prose file, with fenced blocks exempt (FR-105, FR-213).
// Fail-open: evaluate(input) -> {deny, reason}; any failure lets the write proceed (see ../lib/health.js).
// It never rewrites the write itself and never exits 2.
"use strict";

const path = require("path");
const diff = require("../lib/prose-diff.js");

const NAME = "prose-gate";
const ALLOW = { deny: false, reason: "" };
const MAX_PER_FAMILY = 6;
const STANDARD = path.join(process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, "..", ".."), "rules", "writing-standard.md");
const CLOSING = "Rewrite only the flagged text; the standard is at " + STANDARD + ".";
const VERBATIM = "Text that must stay verbatim (a quotation, the user's own words, a title) passes inside double quotes, " +
  "a blockquote, or a code span; or ask the user to add the path to prose-gate-allowlist.json.";

function plural(count, word) {
  return count + " " + word + (count === 1 ? "" : "s");
}

function describe(file, findings) {
  const lines = [
    "assist-plugin prose-gate denied this write to " + path.basename(file) +
      ": the added text has tells that are not allowed in prose by the writing standard.",
  ];
  diff.byFamily(findings).forEach((group) => {
    lines.push(group.family + ", " + plural(group.findings.length, "hit") + ":");
    const fixed = new Set();
    group.findings.slice(0, MAX_PER_FAMILY).forEach((finding) => {
      let text = "- " + finding.where + " (" + finding.id + ") at \"" + finding.snippet + "\"";
      if (!fixed.has(finding.id)) {
        fixed.add(finding.id);
        text += ": " + finding.fix;
      }
      lines.push(text);
    });
    const rest = group.findings.length - MAX_PER_FAMILY;
    if (rest > 0) lines.push("- " + plural(rest, "more " + group.family + " hit") + " in the added text.");
  });
  lines.push(CLOSING, VERBATIM);
  return lines.join("\n");
}

// Decision function. options: {readFile, allowlist, tmpdir} replace the disk read and the exemptions (tests
// and the health check); a missing or undefined key falls back to the environment and the file system.
function evaluate(input, options) {
  const opts = options || {};
  const change = diff.changes(input, {
    phase: "pre",
    readFile: opts.readFile,
    allowlist: opts.allowlist,
    tmpdir: opts.tmpdir,
  });
  if (!change) return ALLOW;
  const findings = diff.addedFindings(change, "block");
  return findings.length > 0 ? { deny: true, reason: describe(change.file, findings) } : ALLOW;
}

function main() {
  require("../lib/health.js").guard(NAME, evaluate);
}

module.exports = { NAME, evaluate, main };

if (require.main === module) main();
