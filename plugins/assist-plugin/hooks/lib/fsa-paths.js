// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Test-path globs and a small glob matcher for the fsa-write-bar hook.
//
// TEST_GLOBS mirrors the table under "## Write scope" in agents/developer-tester.md (the markdown is the
// source of truth; scripts/check-fsa-tables.js --check fails on drift). Glob forms used:
//   `**/`   zero or more directories
//   `/**`   at the end: one or more path segments below the directory
//   `*`     any run of characters inside one path segment
// The matcher works on path segments, not on a regular expression built from user input, so a long path
// cannot cause runaway backtracking. testerDenial() lists the paths developer-tester may not write even when a
// glob matches (agents/developer-tester.md, "Write scope"). Paths are judged as written: symlinks are not
// resolved. Glob matching is case-sensitive; the protected-name checks (protectedRule, the CLAUDE.md and AGENTS.md
// denial) fold case, trailing dots and spaces, and a `:stream` suffix first, because Windows and macOS file
// systems treat those spellings as the same file. ES2015 syntax, no dependencies.
"use strict";

const path = require("path");

const TEST_GLOBS = [
  "**/test/**",
  "**/tests/**",
  "**/__tests__/**",
  "**/*.test.*",
  "**/*_test.*",
  "**/*.spec.*",
  "**/test_*.py",
  "**/*Test.kt",
  "**/*_test.go",
];

// The only files task-planner may write: a task-plan file at the project root, one path segment relative to the
// root (agents/task-planner.md, "Write scope"). With no known root the write bar falls back to "**/" + this glob.
const TASK_PLAN_GLOB = "task-plan-*.md";

// Paths no subagent may write: the /do plan files (they hold sign-off and waiver state) and the decision log.
// Only the user, through the main conversation, changes them.
const PROTECTED_GLOBS = ["**/.agent/main-plan/**"];
const PROTECTED_FILES = ["DECISIONS.md"];

// Files Claude Code loads into later sessions. A write there plants instructions, so developer-tester,
// task-planner, requirements-gatherer, and solutions-architect may not write them, whatever directory they sit in.
const AUTO_LOADED = ["CLAUDE.md", "CLAUDE.local.md", "AGENTS.md"];

const MAX_PATH_CHARS = 4096;
const MAX_SEGMENTS = 128;

// Matches one path segment against a pattern whose only wildcard is `*`.
function matchSegment(pattern, text) {
  let p = 0;
  let t = 0;
  let star = -1;
  let mark = 0;
  while (t < text.length) {
    if (p < pattern.length && pattern[p] === "*") {
      star = p++;
      mark = t;
    } else if (p < pattern.length && pattern[p] === text[t]) {
      p++;
      t++;
    } else if (star !== -1) {
      p = star + 1;
      t = ++mark;
    } else {
      return false;
    }
  }
  while (p < pattern.length && pattern[p] === "*") p++;
  return p === pattern.length;
}

function matchSegments(glob, gi, segments, si) {
  if (gi === glob.length) return si === segments.length;
  const part = glob[gi];
  if (part === "**") {
    if (gi === glob.length - 1) return si < segments.length; // trailing `**`: at least one segment
    for (let skip = si; skip <= segments.length; skip++) {
      if (matchSegments(glob, gi + 1, segments, skip)) return true;
    }
    return false;
  }
  return si < segments.length && matchSegment(part, segments[si]) && matchSegments(glob, gi + 1, segments, si + 1);
}

// Normalizes separators and dot segments; returns "" for a value that is not a usable path.
function normalize(file) {
  if (typeof file !== "string" || file.length === 0 || file.length > MAX_PATH_CHARS || file.indexOf("\0") !== -1) return "";
  return path.posix.normalize(file.replace(/\\/g, "/"));
}

// True when `file` matches `glob`. Returns false for a path past the bounds.
function matchGlob(glob, file) {
  const clean = normalize(file);
  if (!clean) return false;
  const segments = clean.split("/").filter((part) => part.length > 0);
  if (segments.length > MAX_SEGMENTS) return false;
  return matchSegments(glob.split("/"), 0, segments, 0);
}

// Why a restricted agent (developer-tester, task-planner, requirements-gatherer, solutions-architect) may not
// write `file`, or null. Reasons: "limit" (empty, over 4096 characters, or a NUL character), "hidden" (a segment
// starts with "."), "auto-loaded" (CLAUDE.md, CLAUDE.local.md, or AGENTS.md as the file name).
function testerDenial(file) {
  if (typeof file !== "string" || file.length === 0 || file.length > MAX_PATH_CHARS || file.indexOf("\0") !== -1) return "limit";
  const segments = file.replace(/\\/g, "/").split("/").filter((part) => part.length > 0 && part !== ".");
  if (segments.some((part) => part.charAt(0) === ".")) return "hidden";
  if (segments.length > 0 && AUTO_LOADED.some((name) => foldSegment(segments[segments.length - 1]) === name.toUpperCase().toLowerCase())) return "auto-loaded";
  return null;
}

// True when `file` is a task-plan file at the root of the path as given (the task-planner write scope). Pass the
// path relative to the project root. `anyDirectory` accepts the file name in any directory (no root known).
function isTaskPlanFile(file, anyDirectory) {
  return matchGlob(anyDirectory ? "**/" + TASK_PLAN_GLOB : TASK_PLAN_GLOB, file);
}

// One path segment as a case-insensitive file system sees it: lower case, no `:stream` suffix (NTFS alternate
// data streams), no trailing dots or spaces.
function foldSegment(segment) {
  const colon = segment.indexOf(":");
  const base = colon === -1 ? segment : segment.slice(0, colon);
  // Upper then lower folds characters such as U+017F (long s) and U+0131 (dotless i) the way a case-insensitive
  // file system compares them.
  return base.toUpperCase().toLowerCase().replace(/[. ]+$/, "");
}

// The rule that makes `file` off limits to every assist-plugin subagent (a glob, or the file name), or null.
function protectedRule(file) {
  const clean = normalize(file);
  if (!clean) return null;
  const folded = clean.split("/").map(foldSegment).filter((part) => part.length > 0);
  if (folded.length === 0) return null;
  for (let i = 0; i < PROTECTED_FILES.length; i++) {
    if (folded[folded.length - 1] === PROTECTED_FILES[i].toUpperCase().toLowerCase()) return PROTECTED_FILES[i];
  }
  for (let i = 0; i < PROTECTED_GLOBS.length; i++) {
    if (matchGlob(PROTECTED_GLOBS[i], folded.join("/"))) return PROTECTED_GLOBS[i];
  }
  return null;
}

// True when the normalized `clean` path sits below the normalized `base` root. A root that starts with a drive
// letter compares without regard to case, as Windows does.
function underRoot(clean, base) {
  if (/^[A-Za-z]:\//.test(base)) return clean.slice(0, base.length + 1).toLowerCase() === (base + "/").toLowerCase();
  return clean.indexOf(base + "/") === 0;
}

// True when `file` is absolute, home-relative (`~`), drive-relative (`C:name`), or climbs out with `..`, and no root
// contains it. False when there are no roots or the path is relative to the working directory.
function outsideRoots(file, roots) {
  const clean = normalize(file);
  if (!clean || !Array.isArray(roots) || roots.length === 0) return false;
  const inside = roots.some((root) => {
    const base = typeof root === "string" ? normalize(root).replace(/\/+$/, "") : "";
    return base.length > 0 && underRoot(clean, base);
  });
  if (inside) return false;
  return clean.charAt(0) === "/" || clean.charAt(0) === "~" || /^[A-Za-z]:/.test(clean) || clean === ".." || clean.indexOf("../") === 0;
}

// The first test glob that `file` matches, or null.
function testGlobFor(file) {
  for (let i = 0; i < TEST_GLOBS.length; i++) {
    if (matchGlob(TEST_GLOBS[i], file)) return TEST_GLOBS[i];
  }
  return null;
}

// Strips the longest root that contains `file` (the innermost form), so a project that lives under a directory
// named `tests` or `test` does not make every file in it a test path. Roots that do not contain the file are
// ignored. The write bar applies testerDenial to this form only.
function relativeTo(file, roots) {
  const clean = normalize(file);
  let best = "";
  (roots || []).forEach((root) => {
    const base = normalize(root).replace(/\/+$/, "");
    if (base && base.length > best.length && underRoot(clean, base)) best = base;
  });
  return best ? clean.slice(best.length + 1) : clean;
}

// Every form of `file` the bar judges: its path relative to each root that contains it, or the normalized path
// alone when no root contains it. Empty for a value that is not a usable path. A project that is opened from a
// parent directory and from its own directory has two roots, so two forms.
function relativeForms(file, roots) {
  const clean = normalize(file);
  if (!clean) return [];
  const forms = [];
  (roots || []).forEach((root) => {
    const base = typeof root === "string" ? normalize(root).replace(/\/+$/, "") : "";
    if (!base || !underRoot(clean, base)) return;
    const form = clean.slice(base.length + 1);
    if (form && forms.indexOf(form) === -1) forms.push(form);
  });
  return forms.length > 0 ? forms : [clean];
}

module.exports = { TEST_GLOBS, TASK_PLAN_GLOB, PROTECTED_GLOBS, PROTECTED_FILES, AUTO_LOADED, MAX_PATH_CHARS, normalize, matchGlob, isTaskPlanFile, protectedRule, outsideRoots, testGlobFor, testerDenial, relativeTo, relativeForms };
