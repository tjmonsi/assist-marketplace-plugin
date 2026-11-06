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

// [FR-186] The only files task-planner may write: a task-plan file directly under docs/task-plans/ of the session's
// git root, three path segments relative to that root (agents/task-planner.md, "Write scope"). It is matched
// exactly as written, also when the write bar has no root and judges a plain relative path.
const TASK_PLAN_GLOB = "docs/task-plans/task-plan-*.md";

// [FR-245] The confirmation store (lib/confirmation-store.js) is one directory with two files and two write rules.
// confirmations.jsonl is written only by the UserPromptSubmit confirmation hook, with fs, so no tool caller may write
// it (ALL_CALLER_GLOBS). pending.jsonl is written by the main-session /do orchestrator, so only a subagent may not.
const CONFIRMATIONS_GLOB = "**/.agent/governance/confirmations/confirmations.jsonl";
const PENDING_GLOB = "**/.agent/governance/confirmations/pending.jsonl";

// [FR-245] The governance audit store (lib/audit-chain.js): audit.jsonl, its rotated segments, and its lock file, all
// below one directory. The audit hook and the guard runtime write it with fs, so the tool-level deny of fsa-write-bar
// does not stop them; no subagent may write it.
const AUDIT_GLOB = "**/.agent/logs/governance/**";

// Paths no subagent may write: the /do plan files (they hold sign-off and waiver state), the confirmation store, the
// audit store, and the decision log. Only the user, through the main conversation, changes the plan files and the decision log.
const PROTECTED_GLOBS = ["**/.agent/main-plan/**", CONFIRMATIONS_GLOB, PENDING_GLOB, AUDIT_GLOB];
// [FR-242] The part of PROTECTED_GLOBS that holds for every tool caller, the main session included.
const ALL_CALLER_GLOBS = [CONFIRMATIONS_GLOB];
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

// [FR-186] True when `file`, the path relative to the session's git root, is a task-plan file: exactly
// docs/task-plans/task-plan-*.md (the task-planner write scope). An absolute path never matches.
function isTaskPlanFile(file) {
  const clean = normalize(file);
  return clean.length > 0 && clean.charAt(0) !== "/" && matchGlob(TASK_PLAN_GLOB, clean);
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

// The path segments of `file` as a case-insensitive file system sees them, or [] for a value that is not a usable path.
function foldedSegments(file) {
  const clean = normalize(file);
  return clean ? clean.split("/").map(foldSegment).filter((part) => part.length > 0) : [];
}

// [FR-242] The glob in ALL_CALLER_GLOBS that makes `file` off limits to every tool caller, the main session included, or
// null. It folds the name as protectedRule does.
function allCallerRule(file) {
  const folded = foldedSegments(file).join("/");
  if (!folded) return null;
  for (let i = 0; i < ALL_CALLER_GLOBS.length; i++) {
    if (matchGlob(ALL_CALLER_GLOBS[i], folded)) return ALL_CALLER_GLOBS[i];
  }
  return null;
}

// The rule that makes `file` off limits to every assist-plugin subagent (a glob, or the file name), or null.
function protectedRule(file) {
  const folded = foldedSegments(file);
  if (folded.length === 0) return null;
  for (let i = 0; i < PROTECTED_FILES.length; i++) {
    if (folded[folded.length - 1] === PROTECTED_FILES[i].toUpperCase().toLowerCase()) return PROTECTED_FILES[i];
  }
  for (let i = 0; i < PROTECTED_GLOBS.length; i++) {
    if (matchGlob(PROTECTED_GLOBS[i], folded.join("/"))) return PROTECTED_GLOBS[i];
  }
  return null;
}

// [FR-223] Shell write targets. A shell command names a target as text that the shell expands later: a glob it matches
// against files, or a variable or substitution it fills in. lib/shell-writes.js keeps the glob characters (`*`, `?`,
// `[...]`) as written and replaces each variable, substitution, and brace group with ANY, which stands for any text,
// slashes included. The two functions below ask whether such a target could be a protected path, with the same glob
// lists and the same case folding as protectedRule. A target without a wildcard is judged by protectedRule itself.
const ANY = "\u0001";
const WILD = /[*?[\u0001]/;

function isAnySegment(segment) {
  return segment.length > 0 && segment.replace(/\u0001/g, "").length === 0;
}

// The regular expression for one folded pattern segment. `*` and ANY match any run without a slash, `?` one
// character, `[...]` a character class (a POSIX class such as [:upper:] matches any character, a superset). A
// pattern that does not compile matches any run, which can only widen the judgement.
function segmentExpression(segment) {
  try {
    let source = "";
    for (let i = 0; i < segment.length; i++) {
      const ch = segment.charAt(i);
      if (ch === "*" || ch === ANY) {
        source += "[^/]*";
      } else if (ch === "?") {
        source += "[^/]";
      } else if (ch === "[") {
        let j = i + 1;
        if (segment.charAt(j) === "!" || segment.charAt(j) === "^") j++;
        if (segment.charAt(j) === "]") j++;
        while (j < segment.length && segment.charAt(j) !== "]") {
          const posixEnd = segment.substr(j, 2) === "[:" ? segment.indexOf(":]", j + 2) : -1;
          j = posixEnd === -1 ? j + 1 : posixEnd + 2;
        }
        if (j >= segment.length) {
          source += "\\[";
        } else {
          let body = segment.slice(i + 1, j);
          const negated = body.charAt(0) === "!" || body.charAt(0) === "^";
          if (negated) body = body.slice(1);
          body = body.replace(/\[:[a-z]+:\]/g, "\u0002").replace(/[\\\]\[]/g, "\\$&").replace(/\u0002/g, "\\s\\S");
          source += "[" + (negated ? "^" : "") + body + "]";
          i = j;
        }
      } else {
        source += ch.replace(/[\\^$.|+(){}\]/-]/g, "\\$&");
      }
    }
    return new RegExp("^" + source + "$");
  } catch (err) {
    return /^[^/]*$/;
  }
}

// True when the folded target segment can name the protected glob segment `literal`. As in a shell without dotglob, a
// leading glob character does not match a name that starts with a dot.
function segmentOverlaps(segment, literal) {
  if (literal.indexOf("*") !== -1) return true;
  if (!WILD.test(segment)) return segment === literal;
  if (/^[*?[]/.test(segment) && literal.charAt(0) === ".") return false;
  return segmentExpression(segment).test(literal);
}

// True when the folded target segment holds at least one character that is neither a wildcard nor ANY.
function hasLiteral(segment) {
  return segment.replace(/[\u0001*?[\]]/g, "").length > 0;
}

// True when some path that the target segments could name matches `glob` (segments, `**` allowed) and at least one
// matching target segment holds a literal character. That anchor keeps `src/$X/a.js` and `rm -rf build/*` from counting
// as writes of `.agent/main-plan/a.js` and `DECISIONS.md`, which the variable or the star could spell but nothing in the
// command names. A segment made of ANY alone stands for zero or more path segments. A trailing `**` needs at least one
// more segment, as in matchGlob.
function looseMatch(segments, glob) {
  const seen = new Map();
  function go(si, gi, anchored) {
    const key = (si * 1024 + gi) * 2 + (anchored ? 1 : 0);
    if (seen.has(key)) return seen.get(key);
    seen.set(key, false);
    let result = false;
    if (gi === glob.length) {
      result = anchored && segments.slice(si).every(isAnySegment);
    } else if (glob[gi] === "**") {
      if (gi === glob.length - 1) {
        result = anchored && si < segments.length;
      } else {
        for (let skip = si; skip <= segments.length && !result; skip++) result = go(skip, gi + 1, anchored);
      }
    } else if (si < segments.length) {
      if (isAnySegment(segments[si])) result = go(si + 1, gi, anchored) || go(si, gi + 1, anchored) || go(si + 1, gi + 1, anchored);
      else result = segmentOverlaps(segments[si], glob[gi]) && go(si + 1, gi + 1, anchored || hasLiteral(segments[si]));
    }
    seen.set(key, result);
    return result;
  }
  return go(0, 0, false);
}

// The folded segments of a shell target, or null when it is not judged: an empty path, or a target with a variable or
// substitution and no literal character at all (`$OUT`, `$DIR/*`), which is the variable-built command that FR-223
// records as a known limit.
function targetSegments(file) {
  const clean = normalize(file);
  if (!clean) return null;
  const segments = clean.split("/").map(foldSegment).filter((part) => part.length > 0);
  if (segments.length === 0 || segments.length > MAX_SEGMENTS) return null;
  const unresolved = segments.some((part) => part.indexOf(ANY) !== -1);
  if (unresolved && !segments.some(hasLiteral)) return null;
  return segments;
}

// [FR-223] True when a shell target cannot be judged at all: it is not a usable path (over 4096 characters or a NUL
// character) or it has more segments than the matcher reads. The write bar denies such a target, as it does for the write tools.
function unjudgeableTarget(file) {
  const clean = normalize(file);
  return !clean || clean.split("/").filter((part) => part.length > 0).length > MAX_SEGMENTS;
}

// [FR-223] The rule that a shell target could write, or null. A target with no wildcard goes to protectedRule.
function protectedPatternRule(file) {
  const segments = targetSegments(file);
  if (segments === null) return null;
  if (!segments.some((part) => WILD.test(part))) return protectedRule(file);
  for (let i = 0; i < PROTECTED_FILES.length; i++) {
    if (looseMatch(segments, ["**", PROTECTED_FILES[i].toUpperCase().toLowerCase()])) return PROTECTED_FILES[i];
  }
  for (let i = 0; i < PROTECTED_GLOBS.length; i++) {
    if (looseMatch(segments, PROTECTED_GLOBS[i].toUpperCase().toLowerCase().split("/"))) return PROTECTED_GLOBS[i];
  }
  return null;
}

// The directory chains that lead to a protected path: for `**/.agent/main-plan/**` they are `**/.agent` and
// `**/.agent/main-plan`. Removing or moving one of them takes the protected files with it.
function directoryChains() {
  const chains = [];
  PROTECTED_GLOBS.forEach((glob) => {
    const parts = glob.toUpperCase().toLowerCase().split("/").slice(0, -1);
    for (let m = 1; m <= parts.length; m++) {
      if (parts[m - 1] !== "**") chains.push({ glob, parts: parts.slice(0, m) });
    }
  });
  return chains;
}

// [FR-223] The protected glob whose directory the target is (or could be), or null: the target of `rm -rf .agent` or
// `mv .agent/main-plan elsewhere`. Used for the targets a command removes or moves away.
function protectedAncestorRule(file) {
  const segments = targetSegments(file);
  if (segments === null) return null;
  const chains = directoryChains();
  for (let i = 0; i < chains.length; i++) {
    if (looseMatch(segments, chains[i].parts)) return chains[i].glob;
  }
  return null;
}

// [FR-223] The protected glob whose directory `file` is (or could be), or null: `.agent/governance/confirmations` for the
// two files of the confirmation store. Used for the directory that a copy or move writes into: the store directory holds
// nothing a subagent may add, whatever the new file is called.
function protectedDirectoryRule(file) {
  const segments = targetSegments(file);
  if (segments === null) return null;
  for (let i = 0; i < PROTECTED_GLOBS.length; i++) {
    const parts = PROTECTED_GLOBS[i].toUpperCase().toLowerCase().split("/").slice(0, -1);
    if (parts.length > 0 && parts[parts.length - 1] !== "**" && looseMatch(segments, parts)) return PROTECTED_GLOBS[i];
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

module.exports = { TEST_GLOBS, TASK_PLAN_GLOB, PROTECTED_GLOBS, ALL_CALLER_GLOBS, PROTECTED_FILES, AUTO_LOADED, MAX_PATH_CHARS, ANY, normalize, matchGlob, isTaskPlanFile, protectedRule, unjudgeableTarget, protectedPatternRule, protectedAncestorRule, protectedDirectoryRule, allCallerRule, outsideRoots, testGlobFor, testerDenial, relativeTo, relativeForms };
