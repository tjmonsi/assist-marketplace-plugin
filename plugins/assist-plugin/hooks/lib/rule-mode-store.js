// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-238|FR-219|FR-220] Reader of the rule-mode store .agent/governance/rule-modes.json for the hooks that act on a rule's
// mode (impl/goal-guard.js, impl/code-scan.js). The store maps a rule id to "advisory" or "blocking"; only the user-run
// scripts/promote-rule.js writes "blocking" into it. This module only reads, and it never throws: an absent, unreadable,
// oversized, or malformed store, a rule it does not name, and any value other than "blocking" all mean advisory, so a
// defect in the store never turns a rule blocking and never fails open into blocking (lib/severity.js parseRuleModes).
// CommonJS, ES2015 syntax, no dependencies beyond lib/severity.js and lib/strict-json.js.
"use strict";

const fs = require("fs");
const path = require("path");
const severity = require("./severity.js");
const strictJson = require("./strict-json.js");

const STORE_PATH = path.join(".agent", "governance", "rule-modes.json");
const MAX_STORE_BYTES = 1048576; // a larger file is not read: parseRuleModes would refuse its text anyway

// The rule modes of the project at `root`: a map of rule id to mode, empty (every rule advisory) when the root is unknown
// or the store cannot be read.
function read(root) {
  if (typeof root !== "string" || root.length === 0) return severity.parseRuleModes(null);
  try {
    const file = path.join(root, STORE_PATH);
    if (fs.statSync(file).size > MAX_STORE_BYTES) return severity.parseRuleModes(null);
    return severity.parseRuleModes(fs.readFileSync(file, "utf8"));
  } catch (err) {
    return severity.parseRuleModes(null);
  }
}

// [FR-249] How the store at `root` reads, for the health check: {state, reason}. `state` is "absent" (no file),
// "valid" (the strict parser accepts the text), "rejected" (the strict parser threw; `reason` is its fixed code
// "duplicate-key", "depth", or "syntax", and read() runs every rule advisory), or "unreadable" (an I/O error, a root that
// is not a path, or a file over the size limit; `reason` is a fixed code). The result never holds file text, a key, or a
// parser message [NFR-016]. Never throws; read() is unchanged.
function status(root) {
  if (typeof root !== "string" || root.length === 0) return { state: "unreadable", reason: "no-root" };
  try {
    const file = path.join(root, STORE_PATH);
    if (fs.statSync(file).size > MAX_STORE_BYTES) return { state: "unreadable", reason: "too-large" };
    const text = fs.readFileSync(file, "utf8");
    if (text.length > severity.MAX_STORE_CHARS) return { state: "unreadable", reason: "too-large" };
    try {
      strictJson.parse(text);
      return { state: "valid", reason: null };
    } catch (parseError) {
      const reason = parseError instanceof strictJson.StrictJsonError ? parseError.reason : strictJson.REASONS.syntax;
      return { state: "rejected", reason };
    }
  } catch (err) {
    const code = err && typeof err.code === "string" ? err.code : "unknown";
    return code === "ENOENT" || code === "ENOTDIR" ? { state: "absent", reason: null } : { state: "unreadable", reason: "io-error" };
  }
}

// True when the store marks at least one of `ruleIds` "blocking".
function anyBlocking(modes, ruleIds) {
  return ruleIds.some((ruleId) => severity.modeOf(modes, ruleId) === severity.MODES.blocking);
}

module.exports = { STORE_PATH, read, status, anyBlocking };
