// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box tests for plugins/assist-plugin/hooks/lib/git-root.js, export findGitRoot(dir).
//
// Contract (task plan step 7 notes, restated in the step 10 test notes; specs
// spec-hooks-prose-hooks.md "Voice-script exemption under the project root and the session
// directory" step 1(b) and its further rules, and spec-hooks-fsa-write-bar.md for the
// shared walk):
//   - from `dir`, check each directory up to the file-system root for an entry named `.git`
//     (a directory, or a file as in a linked worktree or a submodule); return the first
//     directory that holds one, else null;
//   - never throw: an error while checking one directory counts as "no .git here" and the
//     walk continues upward;
//   - start no `git` process;
//   - return null for a non-string, empty, or non-absolute `dir`, so a relative path never
//     walks from the process directory.
//
// Requirement ids: FR-181 (docs/requirements/FR-NFR-assist-plugin.md), FR-104, NFR-008.
// Traceability format: [Scenario title | spec section | FR/NFR ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// Run: node --test tests/hooks/git-root.test.js

"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const { findGitRoot } = require(path.join(REPO, "plugins", "assist-plugin", "hooks", "lib", "git-root.js"));

let base; // scratch tree root
let skipNoGitCases = false;

function mkdirs(...parts) {
  const p = path.join(base, ...parts);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function hasGitAbove(dir) {
  let cur = dir;
  for (;;) {
    if (fs.existsSync(path.join(cur, ".git"))) return true;
    const parent = path.dirname(cur);
    if (parent === cur) return false;
    cur = parent;
  }
}

function same(actual, expected, message) {
  assert.strictEqual(typeof actual, "string", message || "expected a string, got " + JSON.stringify(actual));
  assert.strictEqual(path.resolve(actual), path.resolve(expected), message);
}

before(() => {
  base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "git-root-")));

  // repo: normal clone, `.git` is a directory
  mkdirs("repo", ".git");
  fs.writeFileSync(path.join(base, "repo", ".git", "HEAD"), "ref: refs/heads/main\n");
  mkdirs("repo", "src", "deep");
  // repo/sub: nested module whose `.git` is a file (submodule)
  mkdirs("repo", "sub", "lib");
  fs.writeFileSync(path.join(base, "repo", "sub", ".git"), "gitdir: ../.git/modules/sub\n");
  // wt: linked worktree, `.git` is a file
  mkdirs("wt", "lib");
  fs.writeFileSync(path.join(base, "wt", ".git"), "gitdir: /elsewhere/.git/worktrees/wt\n");
  // plain: no `.git` anywhere in the tree
  mkdirs("plain", "dir", "inner");

  skipNoGitCases = hasGitAbove(path.join(base, "plain"));
});

after(() => {
  if (!base) return;
  // restore permissions a test may have removed, then delete the tree
  const locked = path.join(base, "repo", "locked");
  try {
    fs.chmodSync(locked, 0o755);
  } catch (e) {
    // already gone or never created
  }
  fs.rmSync(base, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Walk: the first directory with a `.git` entry
// ---------------------------------------------------------------------------

test("findGitRoot is an exported function", () => {
  // [Scenario: No project directory variable | spec-hooks-prose-hooks.md "Voice-script exemption..." step 1(b) | FR-181]
  assert.strictEqual(typeof findGitRoot, "function");
});

test("the directory that holds a .git directory is its own root", () => {
  // [Scenario: No project directory variable | spec-hooks-prose-hooks.md "Voice-script exemption..." step 1(b) | FR-181]
  same(findGitRoot(path.join(base, "repo")), path.join(base, "repo"));
});

test("a nested directory walks up to the root that holds a .git directory", () => {
  // [Scenario: No project directory variable (cwd is <repo>/src) | spec-hooks-prose-hooks.md | FR-181]
  same(findGitRoot(path.join(base, "repo", "src")), path.join(base, "repo"));
  same(findGitRoot(path.join(base, "repo", "src", "deep")), path.join(base, "repo"));
});

test("a .git file marks a linked worktree root", () => {
  // [Scenario: Linked worktree without the variable | spec-hooks-prose-hooks.md | FR-181]
  same(findGitRoot(path.join(base, "wt")), path.join(base, "wt"));
  same(findGitRoot(path.join(base, "wt", "lib")), path.join(base, "wt"));
});

test("the nearest .git wins when a submodule .git file sits inside a repository", () => {
  // [Scenario: Linked worktree without the variable (.git file, nearest first) | spec-hooks-prose-hooks.md step 1(b) | FR-181]
  same(findGitRoot(path.join(base, "repo", "sub", "lib")), path.join(base, "repo", "sub"));
  same(findGitRoot(path.join(base, "repo", "sub")), path.join(base, "repo", "sub"));
});

test("a trailing separator does not change the answer", () => {
  // [Scenario: No project directory variable | spec-hooks-prose-hooks.md step 1(b) | FR-181]
  // Boundary: the same directory written with a trailing separator.
  same(findGitRoot(path.join(base, "repo", "src") + path.sep), path.join(base, "repo"));
});

test("a directory below the root that does not exist still walks up to the root", () => {
  // [Scenario: Unreadable parent directory (a failed check counts as no .git here) | spec-hooks-prose-hooks.md | FR-181]
  // Error case: a stat error on a missing directory is "no .git here"; the walk continues.
  same(findGitRoot(path.join(base, "repo", "missing", "deeper")), path.join(base, "repo"));
});

test("a dangling .git symlink counts as no .git here and the walk continues upward", () => {
  // [Scenario: Unreadable parent directory (a failed check counts as no .git here) | spec-hooks-prose-hooks.md | FR-181]
  const dangling = mkdirs("repo", "dangling");
  try {
    fs.symlinkSync(path.join(base, "does-not-exist"), path.join(dangling, ".git"));
  } catch (e) {
    return; // symlinks unavailable on this platform
  }
  same(findGitRoot(dangling), path.join(base, "repo"));
});

test("a tree with no .git returns null", { skip: false }, (t) => {
  // [Scenario: Neither available | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181]
  if (skipNoGitCases) {
    t.skip("an ancestor of the temp directory holds a .git entry");
    return;
  }
  assert.strictEqual(findGitRoot(path.join(base, "plain")), null);
  assert.strictEqual(findGitRoot(path.join(base, "plain", "dir", "inner")), null);
});

test("an unreadable directory in the chain is skipped and the walk continues", (t) => {
  // [Scenario: Unreadable parent directory | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181]
  if (process.platform === "win32" || (typeof process.getuid === "function" && process.getuid() === 0)) {
    t.skip("permission bits do not restrict this user");
    return;
  }
  const locked = mkdirs("repo", "locked");
  const inner = path.join(locked, "inner");
  fs.mkdirSync(inner, { recursive: true });
  fs.chmodSync(locked, 0o000);
  try {
    let restricted = false;
    try {
      fs.statSync(inner);
    } catch (e) {
      restricted = true;
    }
    if (!restricted) {
      t.skip("chmod 000 did not restrict access on this file system");
      return;
    }
    let result;
    assert.doesNotThrow(() => {
      result = findGitRoot(inner);
    });
    same(result, path.join(base, "repo"));
  } finally {
    fs.chmodSync(locked, 0o755);
  }
});

// ---------------------------------------------------------------------------
// Never throws, starts no git process
// ---------------------------------------------------------------------------

test("a path with a NUL character does not throw", () => {
  // [Scenario: Unreadable parent directory (never throws) | spec-hooks-prose-hooks.md further rules | FR-181 | NFR-008]
  // Security-adjacent: control character in a path.
  assert.doesNotThrow(() => findGitRoot(path.join(base, "repo", "src\u0000x")));
  assert.doesNotThrow(() => findGitRoot(path.sep + "\u0000"));
});

test("the walk works with no git executable on PATH", () => {
  // [Scenario: No project directory variable (no git process) | spec-hooks-prose-hooks.md RULE-006 | FR-181 | NFR-008]
  const saved = process.env.PATH;
  process.env.PATH = "";
  try {
    same(findGitRoot(path.join(base, "repo", "src")), path.join(base, "repo"));
  } finally {
    process.env.PATH = saved;
  }
});

// ---------------------------------------------------------------------------
// Invalid input returns null: non-string, empty, non-absolute
// ---------------------------------------------------------------------------

test("a non-string argument returns null", () => {
  // [Scenario: Relative target without a usable cwd (type mismatch) | spec-hooks-prose-hooks.md | FR-181]
  [undefined, null, 0, 42, true, {}, [], [path.join(base, "repo")], () => base].forEach((bad) => {
    assert.strictEqual(findGitRoot(bad), null, "input " + String(typeof bad) + " should give null");
  });
});

test("an empty string returns null", () => {
  // [Scenario: Relative target without a usable cwd (empty cwd) | spec-hooks-prose-hooks.md | FR-181]
  assert.strictEqual(findGitRoot(""), null);
});

test("a relative path returns null even when the process directory is inside a repository", () => {
  // [Scenario: Relative target without a usable cwd | spec-hooks-prose-hooks.md further rules | FR-181]
  // Boundary: a relative dir must never walk from the process directory.
  const saved = process.cwd();
  process.chdir(path.join(base, "repo", "src"));
  try {
    assert.strictEqual(findGitRoot("deep"), null);
    assert.strictEqual(findGitRoot("."), null);
    assert.strictEqual(findGitRoot(".."), null);
    assert.strictEqual(findGitRoot("./deep"), null);
    assert.strictEqual(findGitRoot("src/deep"), null);
  } finally {
    process.chdir(saved);
  }
});
