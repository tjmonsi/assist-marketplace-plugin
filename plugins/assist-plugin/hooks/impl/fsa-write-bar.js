// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// PreToolUse guard for Write, Edit, MultiEdit, and NotebookEdit: the write bar between the two coding agents.
//   assist-plugin:developer-tester  may write only test paths (agents/developer-tester.md, "Write scope"), and
//                                   never a hidden path (a segment starting with "."), CLAUDE.md, AGENTS.md, a
//                                   path over 4096 characters, or a path with a NUL character.
//   assist-plugin:developer         may not write test paths (agents/developer.md, "Write scope").
// Other agents and the main session are untouched (allowed, no output). The globs are in lib/fsa-paths.js and
// are checked against the Write scope table by scripts/check-fsa-tables.js.
// A path inside the session's working directory (or CLAUDE_PROJECT_DIR) is judged relative to it, so a project
// that lives under a directory named `tests` is not all test paths. When both roots contain the path, every
// relative form counts for the test globs: developer is denied if any form matches a test glob; developer-tester
// needs a form that matches. developer-tester's denials (hidden, CLAUDE.md, AGENTS.md) apply to the innermost
// form only, the path relative to the longest root that contains it, so a worktree under .claude/worktrees is
// not hidden from its own tests directory.
// Scope: the tools above only. A Bash command can write any path and is not covered. Paths are judged as
// written (symlinks are not resolved) and the match is case-sensitive.
// Fail-open: evaluate(input) -> {deny, reason}; a call is blocked only when it positively returns deny. Any
// failure (exception, malformed input, unsupported Node, disable flag) lets the write proceed with a
// systemMessage warning (see ../lib/health.js). It is a guardrail, not a security boundary.
"use strict";

const paths = require("../lib/fsa-paths.js");

const NAME = "fsa-write-bar";
const TESTER = "assist-plugin:developer-tester";
const DEVELOPER = "assist-plugin:developer";
const FILE_KEYS = { Write: "file_path", Edit: "file_path", MultiEdit: "file_path", NotebookEdit: "notebook_path" };
const ALLOW = { deny: false, reason: "" };

function shown(file) {
  return String(file).slice(0, 400).replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").slice(0, 200);
}

const TESTER_DENIALS = {
  limit: "the path is empty, longer than 4096 characters, or holds a NUL character",
  hidden: "a segment of the path starts with a dot, and developer-tester never writes hidden paths",
  "auto-loaded": "CLAUDE.md and AGENTS.md load into later sessions, and developer-tester never writes them",
};

function testerReason(file, why) {
  const cause = why ? TESTER_DENIALS[why] + " (Write scope in agents/developer-tester.md)"
    : "developer-tester writes only test paths, and this path matches none of the test globs listed under Write scope in agents/developer-tester.md";
  return "assist-plugin fsa-write-bar denied this write to " + shown(file) + ": " + cause + ". " +
    "Do not write it. End in Error(policy-rejection) and name the path in the prose above the terminal block.";
}

function developerReason(file, glob) {
  return "assist-plugin fsa-write-bar denied this write to " + shown(file) + ": developer never writes test paths, " +
    "and this path matches the test glob " + glob + " (Write scope in agents/developer-tester.md, referenced from agents/developer.md). " +
    "Tests belong to developer-tester. Do not write it. List the path in the out_of_scope field of the terminal block, " +
    "name it in the prose above the block, and continue with the rest of the work.";
}

// Roots that make a path project-relative: the hook's cwd and CLAUDE_PROJECT_DIR. options.roots replaces them in tests.
function rootsFor(input, options) {
  if (options && Array.isArray(options.roots)) return options.roots;
  return [input.cwd, process.env.CLAUDE_PROJECT_DIR].filter((root) => typeof root === "string" && root.length > 0);
}

// Pure decision function: no I/O. options: {roots} for tests.
function evaluate(input, options) {
  if (!input || typeof input !== "object" || !input.tool_input || typeof input.tool_input !== "object") return ALLOW;
  if (input.agent_type !== TESTER && input.agent_type !== DEVELOPER) return ALLOW;
  const key = Object.prototype.hasOwnProperty.call(FILE_KEYS, input.tool_name) ? FILE_KEYS[input.tool_name] : null;
  const file = key ? input.tool_input[key] : null;
  if (typeof file !== "string" || file.length === 0) return ALLOW;
  const tester = input.agent_type === TESTER;
  if (tester && paths.testerDenial(file) === "limit") return { deny: true, reason: testerReason(file, "limit") };
  if (file.length > paths.MAX_PATH_CHARS) return ALLOW;
  const forms = paths.relativeForms(file, rootsFor(input, options));
  if (forms.length === 0) return ALLOW;
  if (!tester) {
    for (let i = 0; i < forms.length; i++) {
      const glob = paths.testGlobFor(forms[i]);
      if (glob) return { deny: true, reason: developerReason(forms[i], glob) };
    }
    return ALLOW;
  }
  // Denials judge the innermost form only: a worktree under <root>/.claude/worktrees/ is hidden relative to
  // the outer root but not relative to its own root.
  const inner = paths.relativeTo(file, rootsFor(input, options));
  const why = paths.testerDenial(inner);
  if (why) return { deny: true, reason: testerReason(inner, why) };
  const matched = forms.some((form) => paths.testGlobFor(form) !== null);
  return matched ? ALLOW : { deny: true, reason: testerReason(forms[0]) };
}

function main() {
  require("../lib/health.js").guard(NAME, evaluate);
}

module.exports = { NAME, TESTER, DEVELOPER, evaluate, main };

if (require.main === module) main();
