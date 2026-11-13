// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-238|FR-219|FR-220] Reader of the rule-mode store .agent/governance/rule-modes.json for the hooks that act on a rule's
// mode (impl/goal-guard.js, impl/code-scan.js). The store maps a rule id to "advisory" or "blocking"; only the user-run
// scripts/promote-rule.js writes "blocking" into it. This module only reads, and it never throws: an absent, unreadable,
// oversized, or malformed store, a rule it does not name, and any value other than "blocking" all mean advisory, so a
// defect in the store never turns a rule blocking and never fails open into blocking (lib/severity.js parseRuleModes).
// CommonJS, ES2015 syntax, no dependencies beyond lib/severity.js.
"use strict";

const fs = require("fs");
const path = require("path");
const severity = require("./severity.js");

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

// True when the store marks at least one of `ruleIds` "blocking".
function anyBlocking(modes, ruleIds) {
  return ruleIds.some((ruleId) => severity.modeOf(modes, ruleId) === severity.MODES.blocking);
}

module.exports = { STORE_PATH, read, anyBlocking };
