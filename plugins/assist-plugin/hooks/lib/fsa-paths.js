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
// resolved and the comparison is case-sensitive. ES2015 syntax, no dependencies.
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

// Files Claude Code loads into later sessions. A write there plants instructions, so developer-tester may not
// write them, whatever directory they sit in.
const AUTO_LOADED = ["CLAUDE.md", "AGENTS.md"];

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

// Why developer-tester may not write `file` even when a test glob matches, or null. Reasons: "limit" (empty,
// over 4096 characters, or a NUL character), "hidden" (a segment starts with "."), "auto-loaded" (CLAUDE.md or
// AGENTS.md as the file name).
function testerDenial(file) {
  if (typeof file !== "string" || file.length === 0 || file.length > MAX_PATH_CHARS || file.indexOf("\0") !== -1) return "limit";
  const segments = file.replace(/\\/g, "/").split("/").filter((part) => part.length > 0 && part !== ".");
  if (segments.some((part) => part.charAt(0) === ".")) return "hidden";
  if (segments.length > 0 && AUTO_LOADED.indexOf(segments[segments.length - 1]) !== -1) return "auto-loaded";
  return null;
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
    if (base && base.length > best.length && clean.indexOf(base + "/") === 0) best = base;
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
    if (!base || clean.indexOf(base + "/") !== 0) return;
    const form = clean.slice(base.length + 1);
    if (form && forms.indexOf(form) === -1) forms.push(form);
  });
  return forms.length > 0 ? forms : [clean];
}

module.exports = { TEST_GLOBS, AUTO_LOADED, MAX_PATH_CHARS, normalize, matchGlob, testGlobFor, testerDenial, relativeTo, relativeForms };
