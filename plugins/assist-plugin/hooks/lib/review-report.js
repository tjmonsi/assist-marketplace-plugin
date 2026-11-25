// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [spec-reviewer-machinery Req 2 -> FR-289] The deterministic checks the /do orchestrator runs on a reviewer report: the
// protocol-error list (validateReport) and the merge of concurrent lane reports (mergeFindings). Both are pure functions:
// no I/O, no state, no model, no network. Neither throws; a value they cannot read is reported as an error or passed through.
// Spec: specs/spec-reviewer-machinery.md. The orchestrator calls them through `node -e`, the way it calls lib/sarif.js.
// Following lib/severity.js: CommonJS, ES2015 syntax, no dependencies beyond lib/severity.js.
//
// Report shape (the orchestrator builds it from the reviewer's text; a reviewer writes no record):
//   items      [{id, status: "evaluated"|"skipped", reason}]     one entry per checklist item the reviewer accounts for
//   findings   [{id, item?, rule_id?, file, line, severity, confidence, status?, prior_id?, ...}]
//                `item` is the checklist item the finding was raised from; `status` is "new" or "fix-induced"
//   statuses   [{id, status: "fixed"|"open"|"withdrawn", reason}]   re-review only: one entry per prior finding
//   revision   string                                            the reviewed revision, a content digest or a commit id
//   verdict    string                                            "approved" or "returned"
//   examined   [path]                                            the dispatch paths the reviewer read
//   skipped    [path]                                            the `skipped:` field of the terminal block
// Context shape: {applicableItems: [id], priorFindings: [id], namedPaths: [path]}. A non-empty `priorFindings` makes the
// report a re-review.
//
// An error is {code, ref}. `ref` is an item id, a finding id, or a path, so the list holds identifiers only: it never
// echoes finding text. The library changes no text of a finding; it holds identifiers and counts only.
"use strict";

const severity = require("./severity.js");

// The protocol-error codes validateReport can return.
const ERRORS = {
  malformed: "report-malformed",
  itemMissing: "item-missing", // [FR-289] an applicable item is not accounted for
  itemStatusInvalid: "item-status-invalid",
  itemSkipNoReason: "item-skip-reason-missing",
  findingMalformed: "finding-malformed",
  findingNoId: "finding-no-id", // [FR-294]
  findingNoRuleId: "finding-no-rule-id", // [FR-290]
  findingRuleIdMismatch: "finding-rule-id-mismatch", // [FR-290] the rule id differs from the item the finding came from
  findingStatusMissing: "finding-status-missing", // [FR-295] a re-review finding that is neither new nor fix-induced
  fixInducedNoPrior: "fix-induced-no-prior", // [FR-299]
  priorStatusMissing: "prior-status-missing", // [FR-295]
  priorStatusDuplicate: "prior-status-duplicate",
  priorStatusInvalid: "prior-status-invalid",
  priorReasonMissing: "prior-reason-missing",
  revisionMissing: "revision-missing", // [FR-296]
  approvedUnexaminedPath: "approved-with-unexamined-path", // [FR-303]
  unexaminedNotSkipped: "unexamined-path-not-in-skipped", // [FR-303]
};

const ITEM_STATUSES = ["evaluated", "skipped"];
const PRIOR_STATUSES = ["fixed", "open", "withdrawn"];
const RE_REVIEW_FINDING_STATUSES = ["new", "fix-induced"];
const APPROVED = "approved";
const MAX_REF_CHARS = 512;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFilled(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function listOf(value) {
  return Array.isArray(value) ? value : [];
}

function error(code, ref) {
  return { code, ref };
}

// A reference for an id: the id itself when it has the shape of an id, else its position, so a hostile value is never echoed.
function idRef(value, label, index) {
  return typeof value === "string" && severity.ID_PATTERN.test(value) ? value : label + "[" + index + "]";
}

// A reference for a path: the path when it is a short string with no control character, else its position.
function pathRef(value, index) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_REF_CHARS && !/[\u0000-\u001f\u007f]/.test(value) ? value : "path[" + index + "]";
}

// [spec-reviewer-machinery Req 2 -> FR-289] Each applicable item is accounted for as evaluated, or as skipped with a reason.
function itemErrors(report, context) {
  const entries = Object.create(null);
  listOf(report.items).forEach((entry) => {
    if (isRecord(entry) && typeof entry.id === "string" && entries[entry.id] === undefined) entries[entry.id] = entry;
  });
  const errors = [];
  listOf(context.applicableItems).forEach((id, index) => {
    if (typeof id !== "string") return;
    const ref = idRef(id, "item", index);
    const entry = entries[id];
    if (entry === undefined) errors.push(error(ERRORS.itemMissing, ref));
    else if (ITEM_STATUSES.indexOf(entry.status) === -1) errors.push(error(ERRORS.itemStatusInvalid, ref));
    else if (entry.status === "skipped" && !isFilled(entry.reason)) errors.push(error(ERRORS.itemSkipNoReason, ref));
  });
  return errors;
}

// [spec-reviewer-machinery Req 3 -> FR-290] [spec-reviewer-machinery Req 6 -> FR-294] Each finding holds a stable id, and a
// finding raised from a checklist item carries that item's id as its rule id. [spec-reviewer-machinery Req 7 -> FR-295]
// On a re-review a finding that is not a prior one reads new or fix-induced. [spec-reviewer-machinery Req 11 -> FR-299]
// A fix-induced finding names the prior finding.
function findingErrors(report, context, reReview) {
  const priorIds = listOf(context.priorFindings);
  const errors = [];
  listOf(report.findings).forEach((finding, index) => {
    if (!isRecord(finding)) {
      errors.push(error(ERRORS.findingMalformed, "finding[" + index + "]"));
      return;
    }
    const hasId = isFilled(finding.id);
    const ref = hasId ? idRef(finding.id, "finding", index) : "finding[" + index + "]";
    if (!hasId) errors.push(error(ERRORS.findingNoId, ref));
    if (isFilled(finding.item)) {
      if (!isFilled(finding.rule_id)) errors.push(error(ERRORS.findingNoRuleId, ref));
      else if (finding.rule_id !== finding.item) errors.push(error(ERRORS.findingRuleIdMismatch, ref));
    }
    if (finding.status === "fix-induced" && !isFilled(finding.prior_id)) errors.push(error(ERRORS.fixInducedNoPrior, ref));
    const isPrior = hasId && priorIds.indexOf(finding.id) !== -1;
    if (reReview && !isPrior && RE_REVIEW_FINDING_STATUSES.indexOf(finding.status) === -1) errors.push(error(ERRORS.findingStatusMissing, ref));
  });
  return errors;
}

// [spec-reviewer-machinery Req 7 -> FR-295] On a re-review each prior finding holds exactly one of fixed, open, or withdrawn,
// with a reason.
function priorStatusErrors(report, context) {
  const statuses = listOf(report.statuses).filter(isRecord);
  const errors = [];
  listOf(context.priorFindings).forEach((id, index) => {
    if (typeof id !== "string") return;
    const ref = idRef(id, "prior", index);
    const own = statuses.filter((entry) => entry.id === id);
    if (own.length === 0) errors.push(error(ERRORS.priorStatusMissing, ref));
    else if (own.length > 1) errors.push(error(ERRORS.priorStatusDuplicate, ref));
    else if (PRIOR_STATUSES.indexOf(own[0].status) === -1) errors.push(error(ERRORS.priorStatusInvalid, ref));
    else if (!isFilled(own[0].reason)) errors.push(error(ERRORS.priorReasonMissing, ref));
  });
  return errors;
}

// [spec-reviewer-machinery Req 15 -> FR-303] [A-5] A path the dispatch names and the reviewer did not examine blocks
// `approved`: the report reads `returned` and lists the path in `skipped:`.
function pathErrors(report, context) {
  const examined = listOf(report.examined);
  const skipped = listOf(report.skipped);
  const approved = typeof report.verdict === "string" && report.verdict.trim().toLowerCase() === APPROVED;
  const errors = [];
  listOf(context.namedPaths).forEach((named, index) => {
    if (typeof named !== "string" || examined.indexOf(named) !== -1) return;
    const ref = pathRef(named, index);
    if (approved) errors.push(error(ERRORS.approvedUnexaminedPath, ref));
    if (skipped.indexOf(named) === -1) errors.push(error(ERRORS.unexaminedNotSkipped, ref));
  });
  return errors;
}

// The protocol errors of a reviewer `report` under `context`, as a list of {code, ref}; an empty list means the report is
// complete. The orchestrator rejects a report with any error, asks for a corrected one, dispatches no fix, and records no gate
// outcome from it [RULE-002]. Never throws.
function validateReport(report, context) {
  try {
    if (!isRecord(report)) return [error(ERRORS.malformed, "report")];
    const ctx = isRecord(context) ? context : {};
    const reReview = listOf(ctx.priorFindings).length > 0;
    let errors = itemErrors(report, ctx).concat(findingErrors(report, ctx, reReview));
    if (reReview) errors = errors.concat(priorStatusErrors(report, ctx));
    // [spec-reviewer-machinery Req 8 -> FR-296] The report names the reviewed revision, a digest or a commit id (U-7: any
    // non-empty string).
    if (!isFilled(report.revision)) errors.push(error(ERRORS.revisionMissing, "report"));
    return errors.concat(pathErrors(report, ctx));
  } catch (err) {
    return [error(ERRORS.malformed, "report")];
  }
}

// The rank of a severity: a lower number is a higher severity. An unknown severity ranks below LOW.
function rankOf(value) {
  const index = typeof value === "string" ? severity.SEVERITIES.indexOf(value.trim().toUpperCase()) : -1;
  return index === -1 ? severity.SEVERITIES.length : index;
}

// The merge key of a finding: file, line, and rule id. Null when the finding lacks one of them, so it is never merged.
function mergeKey(finding) {
  if (!isRecord(finding) || !isFilled(finding.file) || !Number.isInteger(finding.line) || !isFilled(finding.rule_id)) return null;
  return JSON.stringify([finding.file, finding.line, finding.rule_id]);
}

// [spec-reviewer-machinery Req 5 -> FR-293] [RULE-004] The findings of concurrent lane `reports`, with findings that share a
// file, a line, and a rule id merged into one. The merged finding is the first finding of the highest severity among them, a
// copy with `merged_count` set to the number merged. A finding without a file, a line, or a rule id passes through unmerged.
// [spec-reviewer-machinery Req 19 -> FR-308] [RULE-011] Only `severity` decides which finding wins: a critic or filtering
// score field is never read, so a score never changes a severity and never drops a finding. The input is not changed.
function mergeFindings(reports) {
  try {
    const merged = [];
    const byKey = Object.create(null);
    listOf(reports).forEach((report) => {
      listOf(isRecord(report) ? report.findings : null).forEach((finding) => {
        if (!isRecord(finding)) return;
        const key = mergeKey(finding);
        if (key === null) {
          merged.push(Object.assign({}, finding));
          return;
        }
        const slot = byKey[key];
        if (slot === undefined) {
          byKey[key] = merged.length;
          merged.push(Object.assign({}, finding, { merged_count: 1 }));
          return;
        }
        const count = merged[slot].merged_count + 1;
        if (rankOf(finding.severity) < rankOf(merged[slot].severity)) merged[slot] = Object.assign({}, finding, { merged_count: count });
        else merged[slot].merged_count = count;
      });
    });
    return merged;
  } catch (err) {
    return [];
  }
}

module.exports = { ERRORS, validateReport, mergeFindings };
