// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-181] Finds the git root of a directory without starting a git process. Shared by the prose hooks
// (voice-script exemption, lib/prose-diff.js) and fsa-write-bar (task-plan scope, FR-186), so both find a
// git root the same way.
//
// findGitRoot(dir): from dir, check each directory up to the file-system root for an entry named .git (a
// directory, or a file as in a linked worktree or a submodule). Returns the first directory that holds one,
// else null. It never throws: a stat error counts as "no .git here" and the walk continues upward. It never
// reads the hook process's working directory: a missing, empty, non-string, or relative dir returns null.
"use strict";

const fs = require("fs");
const path = require("path");

const ENTRY = ".git";

function holdsGit(dir) {
  try {
    fs.statSync(path.join(dir, ENTRY));
    return true;
  } catch (err) {
    return false; // missing, unreadable, or a dangling link: not a git root, keep walking
  }
}

function findGitRoot(dir) {
  if (typeof dir !== "string" || dir.length === 0 || !path.isAbsolute(dir)) return null;
  let current = path.resolve(dir);
  for (;;) {
    if (holdsGit(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

module.exports = { findGitRoot };
