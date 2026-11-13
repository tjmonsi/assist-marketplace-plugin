// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-241] SARIF 2.1.0 converter: the review findings of a reviewer or code-reviewer become a SARIF document, as pure
// functions. Spec: specs/spec-orchestration-dispatch.md (Change Log 2026-11-13 (Tranche 4), Requirement 16) and
// specs/spec-orchestration-review-gates.md (Requirement 16). Level map: rules/severity-policy.md, "SARIF level mapping".
// No I/O, no state, no model, no network. The /do orchestrator calls convert() and writes the file itself with the Write
// tool at <root>/.agent/reviews/review-<slug>.sarif; this library writes nothing and the reviewers stay read-only.
// [FR-214] This library never uploads. Uploading the file to GitHub is a posting action under the FR-214 confirmation
// rule (skills/do/references/pr-review-flow.md); nothing here enforces that rule.
//
// Input to convert(input, options): either
//   - an array of findings, or
//   - a SARIF document (an object with a "runs" array) that a reviewer returned. Its results are read back as findings
//     (severity from properties.severity, never from the level), so a document is rebuilt through the same level map
//     and a reviewer-built level is never trusted.
// Finding fields (all read defensively; none of them is trusted):
//   file        string          path of the file the finding is in, relative to the root (an absolute path under
//                               options.root is made relative; any other absolute path, or a path with "..", is left out)
//   line        integer         1-based line number (a string of digits is accepted)
//   severity    string          CRITICAL, HIGH, MEDIUM, or LOW (case is folded); no other value maps to a level
//   problem     string          the result message (the field "message" is read when "problem" is absent)
//   fix         string          optional; travels in properties.fix
//   confidence  string          optional; High, Medium, or Low, travels in properties.confidence
//   routing     string          optional; block-merge, inline-comment, or log-only, travels in properties.routing
//   rule_id     string          optional; becomes the result ruleId (default "review-finding")
//   id          string          optional; travels in properties.id
//
// convert() returns {ok, error, document, text, exported, notExported, report}:
//   ok           false only when the input is neither a findings array nor a SARIF document; document and text are null
//   document     the SARIF 2.1.0 object; text is JSON.stringify(document, null, 2) plus a newline, ready to write
//   exported     the number of results in the document
//   notExported  one {index, summary, reason} per finding left out: index is the 1-based position in the input, summary
//                is the first 120 characters of the finding's problem on one line (or ""), reason says why
//   report       the notExported entries as lines "not exported: finding N (summary): reason", or "" for none
// A finding with no file and line is left out and listed with a reason; so are a finding with a path that cannot be a
// relative location and a finding whose severity is missing or unknown (no level can be chosen without guessing).
// convert() never throws. CommonJS, ES2015 syntax, no dependencies; it runs from Node 6.
"use strict";

const SARIF_VERSION = "2.1.0";
const SCHEMA_URI = "https://json.schemastore.org/sarif-2.1.0.json";
const DEFAULT_TOOL_NAME = "assist-plugin-review";
const DEFAULT_RULE_ID = "review-finding";
const SRCROOT_ID = "%SRCROOT%";

// [FR-241] Severity to SARIF result level. CRITICAL and HIGH share "error"; the severity name travels in properties.
const LEVELS = Object.freeze({ CRITICAL: "error", HIGH: "error", MEDIUM: "warning", LOW: "note" });
const CONFIDENCES = ["High", "Medium", "Low"];
const ROUTINGS = ["block-merge", "inline-comment", "log-only"];

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const MAX_FINDINGS = 5000;
const MAX_FILE_CHARS = 4096;
const MAX_TEXT_CHARS = 2000;
const MAX_SUMMARY_CHARS = 120;
const MAX_NAME_CHARS = 64;

const REASONS = Object.freeze({
  noFile: "no file",
  noLine: "no line",
  noFileAndLine: "no file and line",
  badPath: "the file path is not a valid location",
  absolute: "the file path is absolute and outside the root",
  escapes: "the file path leaves the root",
  noSeverity: "the severity is missing or not CRITICAL, HIGH, MEDIUM, or LOW, so no level can be chosen",
  notObject: "the finding is not an object",
  overCap: "the input holds more than " + MAX_FINDINGS + " findings",
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// The severity of `value` as one of the keys of LEVELS, or null. Case is folded.
function severityOf(value) {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, upper) ? upper : null;
}

// [FR-241] The SARIF result level for a severity, or null when the severity is not one of the four.
function levelOf(severity) {
  const key = severityOf(severity);
  return key === null ? null : LEVELS[key];
}

function canonical(value, allowed) {
  if (typeof value !== "string") return null;
  const wanted = value.trim().toLowerCase();
  for (let i = 0; i < allowed.length; i++) {
    if (allowed[i].toLowerCase() === wanted) return allowed[i];
  }
  return null;
}

// A trimmed non-empty string of at most `max` characters (longer text is cut), or null.
function textOf(value, max) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

// The line number as a positive integer, or null. A string of digits is accepted; nothing else is.
function lineOf(value) {
  if (typeof value === "number") return Number.isInteger(value) && value >= 1 ? value : null;
  if (typeof value === "string" && /^[0-9]{1,9}$/.test(value.trim())) {
    const parsed = parseInt(value.trim(), 10);
    return parsed >= 1 ? parsed : null;
  }
  return null;
}

// The one-line summary of a finding for the not-exported list: its problem text with control characters turned into
// spaces and cut to MAX_SUMMARY_CHARS. The summary only helps the reader find the finding; it never reaches the SARIF.
function summaryOf(finding) {
  if (!isRecord(finding)) return "";
  const text = textOf(finding.problem, MAX_TEXT_CHARS) || textOf(finding.message, MAX_TEXT_CHARS);
  if (text === null) return "";
  // eslint-disable-next-line no-control-regex
  const flat = text.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  return flat.length > MAX_SUMMARY_CHARS ? flat.slice(0, MAX_SUMMARY_CHARS) : flat;
}

// The relative location URI of `file`, or a reason. `root` is an optional absolute directory; a path under it is made
// relative to it. The URI is the path with each segment percent-encoded, as SARIF requires, with no "." or ".." segment.
function uriOf(file, root) {
  if (file.length > MAX_FILE_CHARS || file.indexOf("\0") !== -1) return { reason: REASONS.badPath };
  let path = file.replace(/\\/g, "/");
  if (typeof root === "string" && root.length > 0) {
    const base = root.replace(/\\/g, "/").replace(/\/+$/, "");
    if (base.length > 0 && path.indexOf(base + "/") === 0) path = path.slice(base.length + 1);
  }
  if (path.charAt(0) === "/" || /^[A-Za-z]:\//.test(path)) return { reason: REASONS.absolute };
  const segments = [];
  const parts = path.split("/");
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "" || parts[i] === ".") continue;
    if (parts[i] === "..") return { reason: REASONS.escapes };
    segments.push(parts[i]);
  }
  if (segments.length === 0) return { reason: REASONS.noFile };
  try {
    return { uri: segments.map(encodeURIComponent).join("/") };
  } catch (err) {
    // encodeURIComponent throws a URIError on a lone surrogate.
    return { reason: REASONS.badPath };
  }
}

// [FR-241] One finding as a SARIF result plus its rule id, or {reason} when it cannot be exported.
function resultOf(finding, root) {
  if (!isRecord(finding)) return { reason: REASONS.notObject };
  const file = textOf(finding.file, MAX_FILE_CHARS + 1);
  const line = lineOf(finding.line);
  if (file === null && line === null) return { reason: REASONS.noFileAndLine };
  if (file === null) return { reason: REASONS.noFile };
  if (line === null) return { reason: REASONS.noLine };
  const location = uriOf(file, root);
  if (location.reason) return { reason: location.reason };
  const severity = severityOf(finding.severity);
  if (severity === null) return { reason: REASONS.noSeverity };

  const ruleId = typeof finding.rule_id === "string" && ID_PATTERN.test(finding.rule_id) ? finding.rule_id : DEFAULT_RULE_ID;
  const properties = { severity };
  const confidence = canonical(finding.confidence, CONFIDENCES);
  if (confidence !== null) properties.confidence = confidence;
  const routing = canonical(finding.routing, ROUTINGS);
  if (routing !== null) properties.routing = routing;
  const fix = textOf(finding.fix, MAX_TEXT_CHARS);
  if (fix !== null) properties.fix = fix;
  if (typeof finding.id === "string" && ID_PATTERN.test(finding.id)) properties.id = finding.id;

  return {
    ruleId,
    result: {
      ruleId,
      level: LEVELS[severity],
      message: { text: textOf(finding.problem, MAX_TEXT_CHARS) || textOf(finding.message, MAX_TEXT_CHARS) || "No description given." },
      locations: [{ physicalLocation: { artifactLocation: { uri: location.uri, uriBaseId: SRCROOT_ID }, region: { startLine: line } } }],
      properties,
    },
  };
}

// The findings a reviewer-built SARIF document holds, one per result, in order. Fields a result does not carry stay
// absent, so resultOf() leaves the result out with a reason. The level is not read: only properties.severity counts.
function findingsOfDocument(document) {
  const findings = [];
  const runs = Array.isArray(document.runs) ? document.runs : [];
  for (let r = 0; r < runs.length && findings.length <= MAX_FINDINGS; r++) {
    const results = isRecord(runs[r]) && Array.isArray(runs[r].results) ? runs[r].results : [];
    for (let i = 0; i < results.length && findings.length <= MAX_FINDINGS; i++) {
      const result = results[i];
      if (!isRecord(result)) {
        findings.push(null);
        continue;
      }
      const physical = Array.isArray(result.locations) && isRecord(result.locations[0]) && isRecord(result.locations[0].physicalLocation) ? result.locations[0].physicalLocation : {};
      const artifact = isRecord(physical.artifactLocation) ? physical.artifactLocation : {};
      const properties = isRecord(result.properties) ? result.properties : {};
      let file = artifact.uri;
      try {
        if (typeof file === "string") file = decodeURIComponent(file);
      } catch (err) {
        file = null;
      }
      findings.push({
        file,
        line: isRecord(physical.region) ? physical.region.startLine : undefined,
        severity: properties.severity,
        confidence: properties.confidence,
        routing: properties.routing,
        fix: properties.fix,
        id: properties.id,
        rule_id: result.ruleId,
        problem: isRecord(result.message) ? result.message.text : undefined,
      });
    }
  }
  return findings;
}

function notOk(error) {
  return { ok: false, error, document: null, text: null, exported: 0, notExported: [], report: "" };
}

// [FR-241] Convert findings, or a reviewer-built SARIF document, to a SARIF 2.1.0 document. `options`:
//   root         absolute directory; a file path under it is made relative to it
//   toolName     the driver name, 1 to 64 characters of the ID set plus space (default "assist-plugin-review")
//   toolVersion  optional driver version, same length limit
// Never throws.
function convert(input, options) {
  try {
    const opts = isRecord(options) ? options : {};
    let findings;
    if (Array.isArray(input)) findings = input;
    else if (isRecord(input) && Array.isArray(input.runs)) findings = findingsOfDocument(input);
    else return notOk("input is neither a findings array nor a SARIF document");

    const results = [];
    const rules = [];
    const ruleIndex = Object.create(null);
    const notExported = [];
    for (let i = 0; i < findings.length; i++) {
      if (i >= MAX_FINDINGS) {
        notExported.push({ index: i + 1, summary: summaryOf(findings[i]), reason: REASONS.overCap });
        continue;
      }
      const made = resultOf(findings[i], opts.root);
      if (made.reason) {
        notExported.push({ index: i + 1, summary: summaryOf(findings[i]), reason: made.reason });
        continue;
      }
      if (ruleIndex[made.ruleId] === undefined) {
        ruleIndex[made.ruleId] = rules.length;
        rules.push({ id: made.ruleId });
      }
      made.result.ruleIndex = ruleIndex[made.ruleId];
      results.push(made.result);
    }

    const driver = { name: textOf(opts.toolName, MAX_NAME_CHARS) || DEFAULT_TOOL_NAME, rules };
    const toolVersion = textOf(opts.toolVersion, MAX_NAME_CHARS);
    if (toolVersion !== null) driver.version = toolVersion;
    const document = { $schema: SCHEMA_URI, version: SARIF_VERSION, runs: [{ tool: { driver }, results }] };

    const report = notExported
      .map((entry) => "not exported: finding " + entry.index + (entry.summary ? " (" + entry.summary + ")" : "") + ": " + entry.reason)
      .join("\n");
    return { ok: true, error: null, document, text: JSON.stringify(document, null, 2) + "\n", exported: results.length, notExported, report };
  } catch (err) {
    return notOk((err && err.name ? err.name : "Error") + ": " + (err && err.message ? err.message : "conversion failed"));
  }
}

module.exports = { SARIF_VERSION, SCHEMA_URI, LEVELS, DEFAULT_RULE_ID, MAX_FINDINGS, levelOf, convert };
