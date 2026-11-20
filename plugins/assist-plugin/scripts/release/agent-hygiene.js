// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-253|UR-044] .agent hygiene section of scripts/release-check.js. Three checks run under a repository root:
//   1. .agent/ is git-ignored as a whole           git check-ignore -q --no-index .agent/
//   2. nothing under .agent/ is tracked            git ls-files -z -- .agent
//   3. no negated rule reopens .agent or a path under it, in any of four sources: the root .gitignore, every
//      nested .gitignore, .git/info/exclude, and the global core.excludesFile
// This is the ignore-and-track hygiene of the .agent folder. It is distinct from the FR-245 write protection of
// .agent paths, which this section does not touch.
// Outcomes: "clean", "finding" (a violation, each detail line names the path or the source and the rule), "error"
// (git could not run or ran outside a repository, or a source file could not be read, so the section could not
// complete). A finding from the global core.excludesFile carries a "(machine-dependent)" marker: that file is not
// part of the repository, so the same commit can pass on one machine and fail on another. A git failure is reported with a fixed reason
// and never git's stderr. Git runs through spawnSync with an argument array and no shell.
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const OUTCOME_CLEAN = "clean";
const OUTCOME_FINDING = "finding";
const OUTCOME_ERROR = "error";

const AGENT_DIR = ".agent";
const GITIGNORE = ".gitignore";
const GIT_TIMEOUT_MS = 30 * 1000;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

// Fixed reasons for an error outcome. Never git's stderr.
const REASON_GIT_NOT_STARTED = "git could not start";
const REASON_GIT_TIMED_OUT = "git timed out";
const REASON_NOT_REPOSITORY = "not a git repository or git failed";
const REASON_GIT_CONFIG_FAILED = "git config failed";
const REASON_SOURCE_UNREADABLE = "a negation source file could not be read";

const GLOBAL_LABEL = "global core.excludesFile";
const MACHINE_DEPENDENT = "(machine-dependent)";

// Runs git with fixed arguments in root. Returns { status } on exit, or { reason } when git did not complete.
function git(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  if (result.error) {
    return { reason: result.error.code === "ETIMEDOUT" ? REASON_GIT_TIMED_OUT : REASON_GIT_NOT_STARTED };
  }
  if (result.signal || typeof result.status !== "number") {
    return { reason: REASON_NOT_REPOSITORY };
  }
  return { status: result.status, stdout: result.stdout || "" };
}

// Check 1: .agent/ is ignored as a whole. Status 0 ignored, 1 not ignored, anything else (128 outside a repository)
// means the check could not complete.
function checkIgnored(root) {
  const result = git(root, ["check-ignore", "-q", "--no-index", AGENT_DIR + "/"]);
  if (result.reason) {
    return { error: result.reason };
  }
  if (result.status === 0) {
    return { details: [] };
  }
  if (result.status === 1) {
    return { details: [AGENT_DIR + "/: not git-ignored as a whole"] };
  }
  return { error: REASON_NOT_REPOSITORY };
}

// Check 2: every tracked path under .agent is a finding line that names the path.
function checkTracked(root) {
  const result = git(root, ["ls-files", "-z", "--", AGENT_DIR]);
  if (result.reason) {
    return { error: result.reason };
  }
  if (result.status !== 0) {
    return { error: REASON_NOT_REPOSITORY };
  }
  const tracked = result.stdout.split("\0").filter((entry) => entry !== "");
  return { details: tracked.map((entry) => entry + ": tracked under " + AGENT_DIR + "/") };
}

// True when a gitignore pattern, once a leading "/" or "**/" is removed, is .agent or a path under it.
function targetsAgent(pattern) {
  const bare = pattern.replace(/^\//, "").replace(/^\*\*\//, "");
  return bare === AGENT_DIR || bare.startsWith(AGENT_DIR + "/");
}

// Resolves a path git printed against root. An absolute path stays as it is.
function resolveFromRoot(root, printed) {
  return path.resolve(root, printed);
}

// Source (b): every nested .gitignore, tracked or untracked and not ignored. The glob also lists the root file, which
// is source (a), so it is skipped here.
function nestedGitignores(root) {
  const result = git(root, [
    "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ":(glob)**/" + GITIGNORE,
  ]);
  if (result.reason) {
    return { error: result.reason };
  }
  if (result.status !== 0) {
    return { error: REASON_NOT_REPOSITORY };
  }
  const found = result.stdout.split("\0").filter((entry) => entry !== "" && entry !== GITIGNORE);
  return { sources: found.map((entry) => ({ label: entry, file: path.join(root, entry) })) };
}

// Source (c): .git/info/exclude. rev-parse --git-path resolves a linked worktree to the shared git directory.
function infoExclude(root) {
  const result = git(root, ["rev-parse", "--git-path", "info/exclude"]);
  if (result.reason) {
    return { error: result.reason };
  }
  const printed = result.stdout.replace(/\r?\n$/, "");
  if (result.status !== 0 || printed === "") {
    return { error: REASON_NOT_REPOSITORY };
  }
  return { sources: [{ label: ".git/info/exclude", file: resolveFromRoot(root, printed) }] };
}

// Source (d): the global core.excludesFile. Status 1 means the key is unset: no global source, not an error.
function globalExcludes(root) {
  const result = git(root, ["config", "--path", "--get", "core.excludesFile"]);
  if (result.reason) {
    return { error: result.reason };
  }
  if (result.status === 1) {
    return { sources: [] };
  }
  const printed = result.stdout.replace(/\r?\n$/, "");
  if (result.status !== 0) {
    return { error: REASON_GIT_CONFIG_FAILED };
  }
  if (printed === "") {
    return { sources: [] };
  }
  const file = resolveFromRoot(root, printed);
  return { sources: [{ label: GLOBAL_LABEL + " " + file, file, suffix: " " + MACHINE_DEPENDENT }] };
}

// Reads one source and returns a finding line for each negated rule that reopens .agent or a path under it. A source
// file that does not exist adds no finding; one that exists but cannot be read makes the check an error.
function scanSource(source) {
  let text;
  try {
    text = fs.readFileSync(source.file, "utf8");
  } catch (error) {
    if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
      return { details: [] };
    }
    return { error: REASON_SOURCE_UNREADABLE };
  }
  const details = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const rule = line.replace(/[ \t]+$/, "");
    if (rule.startsWith("!") && targetsAgent(rule.slice(1))) {
      details.push(
        source.label + ":" + (index + 1) + ": negated rule " + rule + " reopens " + AGENT_DIR + "/" + (source.suffix || "")
      );
    }
  });
  return { details };
}

// Check 3: each negated rule that reopens .agent or a path under it, in the root .gitignore, a nested .gitignore,
// .git/info/exclude, or the global core.excludesFile, is a finding line that names its source and the rule. A missing
// root .gitignore adds no finding here; check 1 already reports a not-ignored .agent.
function checkNegation(root) {
  const lookups = [nestedGitignores(root), infoExclude(root), globalExcludes(root)];
  const errors = lookups.filter((entry) => entry.error).map((entry) => entry.error);
  const sources = [{ label: GITIGNORE, file: path.join(root, GITIGNORE) }];
  lookups.forEach((entry) => {
    if (entry.sources) {
      sources.push(...entry.sources);
    }
  });
  const details = [];
  sources.forEach((source) => {
    const scanned = scanSource(source);
    if (scanned.error) {
      errors.push(scanned.error);
    } else {
      details.push(...scanned.details);
    }
  });
  return errors.length > 0 ? { errors } : { details };
}

// check(root) -> { outcome, details }. Every check runs; any check that cannot complete makes the outcome "error".
function check(root) {
  const results = [checkIgnored(root), checkTracked(root), checkNegation(root)];
  const errors = results.reduce((all, entry) => all.concat(entry.errors || (entry.error ? [entry.error] : [])), []);
  if (errors.length > 0) {
    return { outcome: OUTCOME_ERROR, details: errors.filter((reason, index) => errors.indexOf(reason) === index) };
  }
  const details = results.reduce((all, entry) => all.concat(entry.details), []);
  return { outcome: details.length === 0 ? OUTCOME_CLEAN : OUTCOME_FINDING, details };
}

module.exports = { check, OUTCOME_CLEAN, OUTCOME_FINDING, OUTCOME_ERROR };
