#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-217|NFR-031] Secret scan of the staged changes, run by the commit skill before it creates a commit. It reads
// `git diff --cached`, checks each added line against the rules in hooks/lib/secret-rules.js, and prints one
// "<path>: <rule-name>" line for each file and rule that matched. It never prints a matched value, a matching line,
// or a line number (NFR-031); git's own error text is not printed either.
//
// Usage (from inside the repository whose staged changes are scanned):
//   node scripts/scan-staged-secrets.js
//
// Exit codes (the three outcomes of FR-217; a substituted external scanner keeps the same three):
//   0  clean: no staged line matched a rule
//   1  findings: at least one staged line matched a rule; each finding is printed on stdout
//   2  cannot run: git is missing, the directory is not a repository, git failed, or the script failed
// The commit skill stops on 1 and on 2 [NFR-028]. Only added lines are scanned; a removed line is not a finding.
// No dependencies; ES2015 syntax only.
"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

const { RULES } = require(path.join(__dirname, "..", "hooks", "lib", "secret-rules.js"));

const EXIT_CLEAN = 0;
const EXIT_FINDINGS = 1;
const EXIT_CANNOT_RUN = 2;
const MAX_DIFF_BYTES = 256 * 1024 * 1024;
const GIT_TIMEOUT_MS = 60 * 1000;
const FILE_HEADER = "+++ ";
// Fixed git options: plain paths and fixed prefixes whatever the user's git config says, no external diff or
// textconv program, no color, no context lines, no rename detection.
const GIT_ARGS = [
  "-c", "core.quotePath=false",
  "diff", "--cached", "--no-color", "--no-ext-diff", "--no-textconv", "--no-renames", "-U0",
  "--src-prefix=a/", "--dst-prefix=b/"
];

class CannotRun extends Error {}

function readStagedDiff() {
  const result = spawnSync("git", GIT_ARGS, {
    encoding: "utf8",
    maxBuffer: MAX_DIFF_BYTES,
    timeout: GIT_TIMEOUT_MS,
    stdio: ["ignore", "pipe", "ignore"]
  });
  if (result.error) {
    throw new CannotRun(result.error.code === "ENOENT" ? "git is not installed" : "git did not finish (" + result.error.code + ")");
  }
  if (result.status !== 0) {
    throw new CannotRun("git diff --cached failed (exit " + result.status + "); is this a git repository?");
  }
  return result.stdout;
}

// The path from a "+++ " header line: "b/<path>", or /dev/null for a deleted file. A path git had to quote keeps its
// quotes and escapes; the control characters are removed below before the path is printed.
function headerPath(line) {
  let target = line.slice(FILE_HEADER.length).replace(/\t.*$/, "");
  if (target === "/dev/null") return null;
  if (target.length > 1 && target[0] === '"' && target[target.length - 1] === '"') target = target.slice(1, -1);
  return target.indexOf("b/") === 0 ? target.slice(2) : target;
}

// Path text safe to print: control characters (a newline in a file name could forge a finding line) become "?".
function printable(file) {
  return file.replace(/[\u0000-\u001f\u007f]/g, "?");
}

// Returns Map<path, Set<rule name>> for the added lines of a unified diff.
function scanDiff(diff) {
  const findings = new Map();
  let file = null;
  let inHeader = false;
  const lines = diff.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.indexOf("diff --git ") === 0) {
      file = null;
      inHeader = true;
    } else if (inHeader && line.indexOf(FILE_HEADER) === 0) {
      file = headerPath(line);
    } else if (line.indexOf("@@") === 0) {
      inHeader = false;
    } else if (file !== null && line[0] === "+") {
      const added = line.slice(1);
      for (let r = 0; r < RULES.length; r += 1) {
        if (!RULES[r].pattern.test(added)) continue;
        if (!findings.has(file)) findings.set(file, new Set());
        findings.get(file).add(RULES[r].name);
      }
    }
  }
  return findings;
}

function run() {
  const findings = scanDiff(readStagedDiff());
  if (findings.size === 0) {
    console.log("secret scan: clean");
    return EXIT_CLEAN;
  }
  findings.forEach((rules, file) => {
    rules.forEach((rule) => console.log(printable(file) + ": " + rule));
  });
  console.log("secret scan: findings in " + findings.size + " file(s); the commit must stop");
  return EXIT_FINDINGS;
}

function fail(error) {
  const reason = error instanceof CannotRun ? error.message : "script error (" + (error && error.name ? error.name : "Error") + ")";
  console.error("secret scan: cannot run: " + reason + "; the commit must stop");
  process.exitCode = EXIT_CANNOT_RUN;
}

if (require.main === module) {
  process.on("uncaughtException", (error) => {
    fail(error);
    process.exit(EXIT_CANNOT_RUN);
  });
  try {
    process.exitCode = run();
  } catch (error) {
    fail(error);
  }
}

module.exports = { scanDiff, headerPath, run, EXIT_CLEAN, EXIT_FINDINGS, EXIT_CANNOT_RUN };
