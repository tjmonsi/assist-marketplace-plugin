// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// PostToolUse advisor for Write, Edit, MultiEdit, and NotebookEdit on prose files. After the write it looks for
// advisory-tier tells from lib/prose-rules.js (hedges, intensifiers, AI vocabulary, throat-clearing, binary
// contrast, en dashes, prose arrows, spaced double hyphens) in the text the call added, and returns them to
// Claude as additionalContext: each family once, with one example and its fix, at most 10 lines. Silent when
// the added text is clean. Text already in the file is not judged (see lib/prose-diff.js).
// Fail-open: it never blocks or changes the write; any failure emits nothing but a systemMessage (see
// ../lib/health.js). Never exits 2.
"use strict";

const path = require("path");
const diff = require("../lib/prose-diff.js");

const NAME = "prose-advisor";
const MAX_LINES = 10;
const MAX_EXAMPLE = 60;
const MIN_PHRASE = 4; // a shorter match (a dash, an arrow) is shown with the text around it

function example(finding) {
  const text = finding.excerpt.length >= MIN_PHRASE ? finding.excerpt.replace(/[\u0000-\u001f\u007f-\u009f\s]+/g, " ") : finding.snippet;
  return "\"" + (text.length > MAX_EXAMPLE ? text.slice(0, MAX_EXAMPLE - 3) + "..." : text) + "\"";
}

function describe(file, findings) {
  const lines = [
    "assist-plugin prose-advisor: the text just written to " + path.basename(file) +
      " has advisory writing-standard tells (the write was not blocked; see rules/writing-standard.md):",
  ];
  diff.byFamily(findings).slice(0, MAX_LINES - 1).forEach((group) => {
    const first = group.findings[0];
    lines.push("- " + group.family + " (" + group.findings.length + "): " + example(first) + " on " + first.where + ". " + first.fix);
  });
  return lines.join("\n");
}

// Pure decision apart from reading the written file. Returns null (emit nothing) or {stdout}.
// options: {readFile, allowlist, tmpdir} replace the disk read and the exemptions (tests and the health check).
// Temp-directory and allowlisted paths (the prose-gate allowlist) get no advice.
function evaluate(input, options) {
  if (!input || input.hook_event_name !== "PostToolUse") return null;
  const opts = options || {};
  const change = diff.changes(input, { phase: "post", readFile: opts.readFile, allowlist: opts.allowlist, tmpdir: opts.tmpdir });
  if (!change) return null;
  const findings = diff.addedFindings(change, "advise");
  if (findings.length === 0) return null;
  return {
    stdout: {
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: describe(change.file, findings),
      },
    },
  };
}

function main() {
  require("../lib/health.js").transform(NAME, evaluate, { suffix: "this write was not reviewed" });
}

module.exports = { NAME, MAX_LINES, evaluate, main };

if (require.main === module) main();
