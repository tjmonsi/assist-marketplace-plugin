// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-238|FR-219|FR-220] The writer of the advisory baseline store .agent/governance/review-findings.jsonl, shared by the
// hooks that record a finding (impl/code-scan.js and impl/goal-guard.js), so both write the one record format that
// lib/severity.js checkFinding validates and that scripts/baseline-report.js, scripts/label-findings.js, and
// scripts/promote-rule.js read. A finding record is {id, rule_id, severity, confidence, file, line, timestamp, review_id?}; a
// caller may add fixed-identifier fields the readers keep as written. A caller builds the record and checks it with
// severity.checkFinding; this module only mints ids and appends lines. It sets no label: only the user-run
// scripts/label-findings.js does [NFR-034]. [NFR-031] It never sees a prompt or file content: the caller passes the record.
// CommonJS, ES2015 syntax, no dependencies beyond lib/severity.js.
"use strict";

const fs = require("fs");
const path = require("path");
const severity = require("./severity.js");

const STORE_DIR = path.join(".agent", "governance");
const FINDINGS_FILE = "review-findings.jsonl";

let counter = 0;

// A new finding id: the caller's short prefix, the time, a random part, and a per-process counter. It matches
// severity.ID_PATTERN for a prefix of letters and a hyphen.
function nextId(prefix) {
  counter += 1;
  return prefix + "-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1679616).toString(36) + "-" + counter;
}

// The review id of a hook input: its session id when it has the shape of an id, else undefined. The baseline counts a session
// as one review.
function reviewIdOf(input) {
  const id = input !== null && typeof input === "object" ? input.session_id : undefined;
  return typeof id === "string" && severity.ID_PATTERN.test(id) ? id : undefined;
}

function mkdirs(dir) {
  if (fs.existsSync(dir)) return;
  const parent = path.dirname(dir);
  if (parent !== dir) mkdirs(parent);
  try {
    fs.mkdirSync(dir);
  } catch (err) {
    if (!err || err.code !== "EEXIST") throw err;
  }
}

// Appends one record line to the baseline store under `root`. Returns true when the line was written. Never throws.
function append(root, record) {
  if (typeof root !== "string" || root.length === 0) return false;
  try {
    const dir = path.join(root, STORE_DIR);
    mkdirs(dir);
    fs.appendFileSync(path.join(dir, FINDINGS_FILE), JSON.stringify(record) + "\n");
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = { STORE_DIR, FINDINGS_FILE, nextId, reviewIdOf, append };
