// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-239|FR-237|FR-238] Severity routing: the policy of rules/severity-policy.md (version draft-3) as pure functions.
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
//
// Severity catalog [FR-306|FR-307]. rules/severity-catalog.yaml maps a rule id to a fixed severity and a recorded basis (a CWE
// id or a short token). It is data a maintainer edits with measurements, never text a model wrote. The caller reads the file
// and passes its text, as for the rule-mode store, so this module does no I/O. parseCatalog() is a strict reader with no
// dependency: it keeps the whole file or none of it, so a malformed catalog yields null and the caller keeps each reviewer's
// severity as written (the existing behavior). resolveSeverity() records the catalog severity for a finding and notes any
// difference from the reviewer's; routeWithCatalog() adds the routing. A finding with no catalog rule id and no CWE id reads
// "unmapped" and routes no higher than "inline-comment". Neither function drops a finding, and no critic or filtering score
// is an input to either, so a score never sets severity [FR-308].
// CommonJS, ES2015 syntax, no dependencies beyond lib/strict-json.js; it runs from Node 6.
"use strict";

const strictJson = require("./strict-json.js");

const ROUTES = { block: "block-merge", inline: "inline-comment", log: "log-only" };
const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const CONFIDENCES = ["High", "Medium", "Low"];
const MODES = { advisory: "advisory", blocking: "blocking" };

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MAX_FILE_CHARS = 4096;
const MAX_STORE_CHARS = 65536;
const MAX_CATALOG_CHARS = 65536;
const MAX_CATALOG_ENTRIES = 512;
const CATALOG_FIELDS = ["severity", "basis"];
// A basis is a CWE id (CWE-89) or a short lower-case token (measured-precision).
const BASIS_PATTERN = /^(?:CWE-[0-9]{1,5}|[a-z][a-z0-9-]{0,63})$/;
const CWE_PATTERN = /^CWE-[0-9]{1,5}$/;
// Where a resolved severity came from: the catalog entry, a CWE id on the finding, no mapping, no usable catalog, or an
// unreadable finding.
const SOURCES = { catalog: "catalog", cwe: "cwe", unmapped: "unmapped", none: "no-catalog", unreadable: "unreadable" };

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

// [FR-238|FR-249] The rule modes in the store text, or an empty map (every rule advisory) when the text is absent, too long,
// not valid JSON, or rejected by the strict parser (a duplicate key at any depth, or nesting over 32 levels). Never throws.
function parseRuleModes(text) {
  if (typeof text !== "string" || text.length === 0 || text.length > MAX_STORE_CHARS) return ruleModesOf(null);
  try {
    return ruleModesOf(strictJson.parse(text));
  } catch (err) {
    return ruleModesOf(null);
  }
}

// [FR-238] The mode of `ruleId`: "blocking" only when the map names the rule "blocking", else "advisory".
function modeOf(modes, ruleId) {
  if (!modes || typeof ruleId !== "string" || !ID_PATTERN.test(ruleId)) return MODES.advisory;
  return Object.prototype.hasOwnProperty.call(modes, ruleId) && modes[ruleId] === MODES.blocking ? MODES.blocking : MODES.advisory;
}

// [FR-306] True and stores the entry when a parsed catalog entry is complete and valid, else false. A duplicate rule id, a
// severity outside SEVERITIES (exact upper case, no folding), and a basis outside BASIS_PATTERN all refuse the entry.
function storeCatalogEntry(catalog, entry) {
  if (SEVERITIES.indexOf(entry.severity) === -1) return false;
  if (typeof entry.basis !== "string" || !BASIS_PATTERN.test(entry.basis)) return false;
  if (Object.prototype.hasOwnProperty.call(catalog, entry.id)) return false;
  catalog[entry.id] = Object.freeze({ severity: entry.severity, basis: entry.basis });
  return true;
}

// [FR-306] The rule-id-to-{severity, basis} map in the catalog text, or null when the text is absent, too long, or does not
// follow the strict format of rules/severity-catalog.yaml. The format: a "#" comment line or a blank line is skipped; an entry
// is a rule id at column 0 and a colon; its two fields, severity and basis, follow each on a line indented by exactly two
// spaces; a line is split at its first colon. A tab, a NUL, a line that fits neither shape, a duplicate id or field, an unknown
// field, a missing field, or more than MAX_CATALOG_ENTRIES entries discards the whole file, so a malformed catalog never maps
// a rule (the caller falls back to the reviewer's severity). Never throws.
function parseCatalog(text) {
  if (typeof text !== "string" || text.length === 0 || text.length > MAX_CATALOG_CHARS) return null;
  try {
    const catalog = Object.create(null);
    const lines = text.split("\n");
    let current = null;
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].charAt(lines[i].length - 1) === "\r" ? lines[i].slice(0, -1) : lines[i];
      if (line.indexOf("\t") !== -1 || line.indexOf("\0") !== -1) return null;
      if (/^\s*(?:#.*)?$/.test(line)) continue;
      const colon = line.indexOf(":");
      if (colon === -1) return null;
      const key = line.slice(0, colon);
      const value = line.slice(colon + 1).trim();
      if (key.charAt(0) !== " ") {
        if (!ID_PATTERN.test(key) || value !== "") return null;
        if (current !== null && !storeCatalogEntry(catalog, current)) return null;
        count += 1;
        if (count > MAX_CATALOG_ENTRIES) return null;
        current = { id: key, severity: null, basis: null };
      } else {
        const field = key.slice(2);
        if (current === null || key.slice(0, 2) !== "  " || CATALOG_FIELDS.indexOf(field) === -1) return null;
        if (current[field] !== null || value === "") return null;
        current[field] = value;
      }
    }
    if (current === null || !storeCatalogEntry(catalog, current)) return null;
    return Object.freeze(catalog);
  } catch (err) {
    return null;
  }
}

// [FR-306] The {severity, basis} entry for `ruleId` in a parsed catalog, or null when the catalog or the rule is absent.
function catalogEntry(catalog, ruleId) {
  if (!catalog || typeof ruleId !== "string" || !ID_PATTERN.test(ruleId)) return null;
  return Object.prototype.hasOwnProperty.call(catalog, ruleId) ? catalog[ruleId] : null;
}

// The CWE id of `value` in its canonical form (CWE-89), or null. Case is folded. Only the form is checked: the id is the
// reviewer's claim and this module cannot confirm that the weakness fits.
function cweOf(value) {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  return CWE_PATTERN.test(upper) ? upper : null;
}

// [FR-306|FR-307|FR-240] The severity record for a finding under a parsed catalog (or null for no usable catalog):
//   {rule_id, source, severity, reviewer_severity, catalog_severity, differs, basis, unmapped, note}
// A rule id in the catalog sets `severity` to the catalog severity (source "catalog"); `differs` is true and `note` names both
// values when the reviewer's severity is not the same. A rule id not in the catalog with a CWE id on the finding keeps the
// reviewer's severity (source "cwe"). With neither, the finding is `unmapped` (FR-307) and keeps the reviewer's severity.
// With no catalog, the reviewer's severity stands unchanged and nothing is unmapped (source "no-catalog"), the behavior before
// the catalog. The note holds rule ids and severity names only. The finding is never dropped, and only the finding's own
// rule_id, cwe, and severity are read, so a model score cannot change the result [FR-308]. Never throws.
function resolveSeverity(finding, catalog) {
  const resolved = { rule_id: null, source: SOURCES.unreadable, severity: null, reviewer_severity: null, catalog_severity: null, differs: false, basis: null, unmapped: false, note: null };
  if (!isRecord(finding)) return resolved;
  resolved.reviewer_severity = severityOf(finding.severity);
  resolved.severity = resolved.reviewer_severity;
  resolved.rule_id = typeof finding.rule_id === "string" && ID_PATTERN.test(finding.rule_id) ? finding.rule_id : null;
  if (!catalog) {
    resolved.source = SOURCES.none;
    return resolved;
  }
  const entry = catalogEntry(catalog, resolved.rule_id);
  if (entry !== null) {
    resolved.source = SOURCES.catalog;
    resolved.catalog_severity = entry.severity;
    resolved.severity = entry.severity;
    resolved.basis = entry.basis;
    resolved.differs = resolved.reviewer_severity !== entry.severity;
    if (resolved.differs) {
      const written = resolved.reviewer_severity === null ? "no valid severity" : resolved.reviewer_severity;
      resolved.note = "catalog severity " + entry.severity + " for " + resolved.rule_id + " replaces the reviewer's " + written;
    }
    return resolved;
  }
  const cwe = cweOf(finding.cwe);
  if (cwe !== null) {
    resolved.source = SOURCES.cwe;
    resolved.basis = cwe;
    return resolved;
  }
  resolved.source = SOURCES.unmapped;
  resolved.unmapped = true;
  return resolved;
}

// [FR-307|FR-239] resolveSeverity() plus the routing under route(): the routing reads the resolved severity and the finding's
// confidence. A finding that reads `unmapped` routes no higher than "inline-comment", so "block-merge" becomes
// "inline-comment" for it and every lower routing stays. The caller still applies the rule mode with applyMode(). Never throws.
function routeWithCatalog(finding, catalog) {
  const resolved = resolveSeverity(finding, catalog);
  let routing = route({ severity: resolved.severity, confidence: isRecord(finding) ? finding.confidence : undefined });
  if (resolved.unmapped && routing === ROUTES.block) routing = ROUTES.inline;
  return Object.assign({}, resolved, { routing });
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

module.exports = { ROUTES, SEVERITIES, CONFIDENCES, MODES, SOURCES, ID_PATTERN, MAX_STORE_CHARS, MAX_CATALOG_CHARS, route, applyMode, parseRuleModes, modeOf, parseCatalog, catalogEntry, resolveSeverity, routeWithCatalog, labelOf, checkFinding };
