// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-239|FR-237|FR-238] Severity routing: the policy of rules/severity-policy.md (version draft-2) as pure functions.
// Spec: specs/spec-hooks-code-scan.md. No I/O, no state, no model, no network; every function here is safe to call from
// a hook, a script, or the /do orchestrator.
//
// route(finding) reads only the finding's severity and confidence and returns one of ROUTES. It applies no mode. The
// caller applies the mode with applyMode(): while a rule is advisory it downgrades only "block-merge" to "inline-comment"
// and leaves every other routing as it is, so this release blocks nothing (FR-238). An unreadable finding routes
// "log-only", never "block-merge".
//
// Finding record shape. One JSON object per line in .agent/governance/review-findings.jsonl, the advisory baseline store
// (not an FR-245 protected path). checkFinding() is the one validator that every reader and writer shares:
//   id          string   unique finding id, 1 to 64 characters of A-Z a-z 0-9 . _ : -, starting with a letter or digit
//   rule_id     string   the rule that matched, same character set as id
//   severity    string   CRITICAL, HIGH, MEDIUM, or LOW
//   confidence  string   High, Medium, or Low
//   file        string   path of the file the finding is in (not the file content)
//   line        number   1-based line number
//   timestamp   string   UTC time the finding was recorded, ISO 8601 (for example 2026-11-13T09:30:00Z)
//   review_id   string   optional; the review or session that produced the finding, same character set as id. The
//                        baseline counts distinct review ids as reviews. A finding with no review_id counts toward the
//                        14-day arm of the window only
//   label       boolean  optional; set only by the user-run scripts/label-findings.js (PN-3). true means a real
//                        finding, false means a false positive. Absent means unlabelled. An agent's own judgment is
//                        never a label [NFR-034]
//   labelled_at string   optional; the time the user set the label
//
// Rule-mode store. .agent/governance/rule-modes.json holds one JSON object that maps a rule id to "advisory" or
// "blocking". parseRuleModes() and modeOf() read it defensively: an absent, malformed, or oddly shaped store, and a rule
// it does not name or names with any other value, mean "advisory". A defect in the store never turns a rule blocking [FR-238].
// CommonJS, ES2015 syntax, no dependencies; it runs from Node 6.
"use strict";

const ROUTES = { block: "block-merge", inline: "inline-comment", log: "log-only" };
const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const CONFIDENCES = ["High", "Medium", "Low"];
const MODES = { advisory: "advisory", blocking: "blocking" };

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MAX_FILE_CHARS = 4096;
const MAX_STORE_CHARS = 65536;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// The severity of `value` as one of SEVERITIES, or null. Case is folded, so "high" and "HIGH" are the same level.
function severityOf(value) {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  return SEVERITIES.indexOf(upper) === -1 ? null : upper;
}

// The confidence of `value` as one of CONFIDENCES, or null. Case is folded.
function confidenceOf(value) {
  if (typeof value !== "string") return null;
  const wanted = value.trim().toLowerCase();
  for (let i = 0; i < CONFIDENCES.length; i++) {
    if (CONFIDENCES[i].toLowerCase() === wanted) return CONFIDENCES[i];
  }
  return null;
}

// [FR-239] The routing for a finding {severity, confidence}, under the table in rules/severity-policy.md:
//   CRITICAL or HIGH at High confidence      block-merge
//   CRITICAL or HIGH at Medium or Low        inline-comment (a CRITICAL at Medium confidence routes here)
//   MEDIUM at High or Medium                 inline-comment
//   MEDIUM at Low                            log-only
//   LOW at any confidence                    log-only
// Only the first row blocks. A finding that is not an object, or whose severity or confidence is unknown, routes log-only.
function route(finding) {
  if (!isRecord(finding)) return ROUTES.log;
  const severity = severityOf(finding.severity);
  const confidence = confidenceOf(finding.confidence);
  if (severity === null || confidence === null) return ROUTES.log;
  if (severity === "CRITICAL" || severity === "HIGH") return confidence === "High" ? ROUTES.block : ROUTES.inline;
  if (severity === "MEDIUM") return confidence === "Low" ? ROUTES.log : ROUTES.inline;
  return ROUTES.log;
}

// [FR-238|FR-239|FR-240] The routing a caller acts on, given the rule's mode. rules/severity-policy.md line 83: the
// "block-merge" of the first row applies only to a rule whose mode is blocking; a rule in advisory mode routes that row as
// "inline-comment" (line 87). Rows 2 to 5 route the same in either mode (line 93: only the first row blocks), so only
// "block-merge" changes. Only a mode that is exactly "blocking" keeps "block-merge"; every other mode, including a value
// this module does not know, is advisory.
function applyMode(routing, mode) {
  if (mode !== MODES.blocking && routing === ROUTES.block) return ROUTES.inline;
  return routing;
}

// [FR-238] The rule ids and modes of a rule-mode store from its parsed JSON, as a plain object with no inherited keys.
// A value that is not an object, a rule id with a bad shape, and a mode other than "advisory" or "blocking" are dropped,
// so the result only ever names a rule the store names correctly. Never throws.
function ruleModesOf(parsed) {
  const modes = Object.create(null);
  if (!isRecord(parsed)) return modes;
  Object.keys(parsed).forEach((ruleId) => {
    const mode = parsed[ruleId];
    if (ID_PATTERN.test(ruleId) && (mode === MODES.advisory || mode === MODES.blocking)) modes[ruleId] = mode;
  });
  return modes;
}

// [FR-238] The rule modes in the store text, or an empty map (every rule advisory) when the text is absent, too long, or
// not valid JSON. Never throws.
function parseRuleModes(text) {
  if (typeof text !== "string" || text.length === 0 || text.length > MAX_STORE_CHARS) return ruleModesOf(null);
  try {
    return ruleModesOf(JSON.parse(text));
  } catch (err) {
    return ruleModesOf(null);
  }
}

// [FR-238] The mode of `ruleId`: "blocking" only when the map names the rule "blocking", else "advisory".
function modeOf(modes, ruleId) {
  if (!modes || typeof ruleId !== "string" || !ID_PATTERN.test(ruleId)) return MODES.advisory;
  return Object.prototype.hasOwnProperty.call(modes, ruleId) && modes[ruleId] === MODES.blocking ? MODES.blocking : MODES.advisory;
}

// The label of a finding record: true or false when the record holds a boolean label, else null (unlabelled). Any other
// value, such as the string "true" or a number, is not a user label and reads as unlabelled [NFR-034].
function labelOf(record) {
  return isRecord(record) && typeof record.label === "boolean" ? record.label : null;
}

// [FR-238] The finding record in its normalized form, or null when `record` does not have the shape described in the
// header. Severity and confidence come back in their canonical case, and the timestamp comes back with its time in
// milliseconds as `time`. `label` comes back as true, false, or null (unlabelled). Never throws.
function checkFinding(record) {
  if (!isRecord(record)) return null;
  const severity = severityOf(record.severity);
  const confidence = confidenceOf(record.confidence);
  if (severity === null || confidence === null) return null;
  if (typeof record.id !== "string" || !ID_PATTERN.test(record.id)) return null;
  if (typeof record.rule_id !== "string" || !ID_PATTERN.test(record.rule_id)) return null;
  if (typeof record.file !== "string" || record.file.length === 0 || record.file.length > MAX_FILE_CHARS || record.file.indexOf("\0") !== -1) return null;
  if (!Number.isInteger(record.line) || record.line < 1) return null;
  if (typeof record.timestamp !== "string" || !TIMESTAMP_PATTERN.test(record.timestamp)) return null;
  const time = Date.parse(record.timestamp);
  if (!Number.isFinite(time)) return null;
  if (record.review_id !== undefined && (typeof record.review_id !== "string" || !ID_PATTERN.test(record.review_id))) return null;
  return {
    id: record.id,
    rule_id: record.rule_id,
    severity,
    confidence,
    file: record.file,
    line: record.line,
    timestamp: record.timestamp,
    time,
    review_id: record.review_id === undefined ? null : record.review_id,
    label: labelOf(record),
  };
}

module.exports = { ROUTES, SEVERITIES, CONFIDENCES, MODES, ID_PATTERN, route, applyMode, parseRuleModes, modeOf, labelOf, checkFinding };
