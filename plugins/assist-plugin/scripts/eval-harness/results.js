// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Run result schema, validation, and version-keyed storage for the evaluation benchmark harness (Group A).
//
// One run result holds every graded case of one benchmark run, keyed to the plugin version the runner recorded. It is
// written to evals/results/ (git-ignored, evals/.gitignore). That folder may hold agent output text and hidden-suite test
// names, so nothing here reaches the version-controlled scoreboard (scoreboard.js holds scores, identifiers, and versions
// only, NFR-039).
//
// The plugin version, the total cost in USD, and the elapsed seconds come from the aggregate JSON of the existing
// `claude plugin eval` runner (suite.plugins[].version, costUsd, durationSeconds). A result with no plugin version is
// refused (FR-275). Cost and elapsed time sit in every result (NFR-038).
//
// validateRunResult() is the one place that holds every "validation SHALL fail" rule of the scoring steps, and each problem
// names the offending field:
//   - no harness version, or a pass@1 value that is not c / k              (FR-272, through aggregate.validatePassAtOne)
//   - a field that combines the structural and the judge score             (FR-270)
//   - a judge score with no item scores, with one comparison order only, with no judge run count, or a same-family result
//     with no recorded mitigation                                           (FR-282 to FR-285, through judge.validateJudgeResult)
//
// Result shape (key names are a plan choice, ASM-5):
//   { schemaVersion, pluginVersion, harnessVersion, startedAt, costUsd, elapsedSeconds, cases: [case] }
//   dev case:  { suite: "dev",  caseId, heldOut, runs: [{ run, status, reason }], passAtOne, flakyTests: [name] }
//   spec case: { suite: "spec", caseId, heldOut, runs: [{ run, status, reason, structural, judge }],
//                structuralScore, judgeScore, runCount }
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");

const aggregateModule = require("./aggregate.js");
const judgeModule = require("./judge.js");

const DEFAULT_RESULTS_DIR = path.join(__dirname, "..", "..", "evals", "results");
const SCHEMA_VERSION = 1;

// A plugin version names the stored file, so it must be a plain version number and never a path.
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const SUITES = ["dev", "spec"];
const SPEC_RUN_STATUSES = ["scored", "not-run", "error"];

// [FR-270] Field names that say a field combines two scores. Same rule as judge.js, which does not export it.
const COMBINED_NAME = /combined|composite|blend|merged|weighted|average|mean/i;

// Fixed reasons. Never raw parser output and never a value taken from an input.
const REASON_NO_AGGREGATE = "runner aggregate is not a JSON object";
const REASON_NO_VERSION = "runner aggregate records no plugin version";
const REASON_BAD_VERSION = "runner aggregate records a plugin version that is not a version number";
const REASON_NO_COST = "runner aggregate records no total cost";
const REASON_NO_ELAPSED = "runner aggregate records no elapsed time";
const REASON_MIXED_VERSIONS = "runner aggregates record different plugin versions";
const REASON_NO_AGGREGATES = "no runner aggregate to read";
const REASON_NOT_WRITTEN = "run result could not be written";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isScore(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function problem(field, message) {
  return { field, message };
}

// ---------------------------------------------------------------------------------------------------------------------
// Runner aggregate
// ---------------------------------------------------------------------------------------------------------------------

// [FR-275|NFR-038] readAggregateInfo(aggregate, { pluginName }) reads the plugin version, total cost, and elapsed seconds
// of ONE runner aggregate. `pluginName` picks the entry of suite.plugins[]; without it the first entry is read.
// Returns { ok: true, pluginVersion, costUsd, elapsedSeconds } or { ok: false, reason } with fixed text.
function readAggregateInfo(aggregate, options) {
  if (!isObject(aggregate)) {
    return { ok: false, reason: REASON_NO_AGGREGATE };
  }
  const suite = isObject(aggregate.suite) ? aggregate.suite : {};
  const plugins = Array.isArray(suite.plugins) ? suite.plugins.filter(isObject) : [];
  const name = options && options.pluginName;
  const plugin = name ? plugins.find((entry) => entry.name === name) : plugins[0];
  if (!plugin || !isNonEmptyString(plugin.version)) {
    return { ok: false, reason: REASON_NO_VERSION };
  }
  if (!VERSION_PATTERN.test(plugin.version)) {
    return { ok: false, reason: REASON_BAD_VERSION };
  }
  if (!isNonNegativeNumber(aggregate.costUsd)) {
    return { ok: false, reason: REASON_NO_COST };
  }
  if (!isNonNegativeNumber(aggregate.durationSeconds)) {
    return { ok: false, reason: REASON_NO_ELAPSED };
  }
  return { ok: true, pluginVersion: plugin.version, costUsd: aggregate.costUsd, elapsedSeconds: aggregate.durationSeconds };
}

// [FR-275|NFR-038] combineAggregateInfo(infos) folds the info of every runner aggregate of one benchmark run into one:
// the shared plugin version, the summed cost, and the summed elapsed seconds. Every entry must be a readable info and
// all must name one plugin version.
function combineAggregateInfo(infos) {
  const list = Array.isArray(infos) ? infos : [];
  if (list.length === 0) {
    return { ok: false, reason: REASON_NO_AGGREGATES };
  }
  const failed = list.find((entry) => !isObject(entry) || entry.ok !== true);
  if (failed) {
    return { ok: false, reason: isObject(failed) && isNonEmptyString(failed.reason) ? failed.reason : REASON_NO_AGGREGATE };
  }
  if (list.some((entry) => entry.pluginVersion !== list[0].pluginVersion)) {
    return { ok: false, reason: REASON_MIXED_VERSIONS };
  }
  return {
    ok: true,
    pluginVersion: list[0].pluginVersion,
    costUsd: list.reduce((sum, entry) => sum + entry.costUsd, 0),
    elapsedSeconds: list.reduce((sum, entry) => sum + entry.elapsedSeconds, 0),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------------------------------------------------

// buildRunResult({ info, harnessVersion, startedAt, cases }) assembles a result. It does not judge it: a missing version
// reads null here, and validateRunResult() refuses it.
function buildRunResult(request) {
  const settings = request || {};
  const info = isObject(settings.info) ? settings.info : {};
  return {
    schemaVersion: SCHEMA_VERSION,
    pluginVersion: typeof info.pluginVersion === "string" ? info.pluginVersion : null,
    harnessVersion: isNonEmptyString(settings.harnessVersion) ? settings.harnessVersion : aggregateModule.HARNESS_VERSION,
    startedAt: isNonEmptyString(settings.startedAt) ? settings.startedAt : null,
    costUsd: typeof info.costUsd === "number" ? info.costUsd : null,
    elapsedSeconds: typeof info.elapsedSeconds === "number" ? info.elapsedSeconds : null,
    cases: Array.isArray(settings.cases) ? settings.cases : [],
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------------------------------------------------

// [FR-270] A key that names a combination of the two scores fails and is named.
function combinedProblems(object, prefix, errors) {
  Object.keys(object).forEach((key) => {
    if (COMBINED_NAME.test(key)) {
      errors.push(problem(prefix + key, "result must not combine the structural score and the judge score into one field"));
    }
  });
}

function prefixed(prefix, errors, target) {
  errors.forEach((entry) => target.push(problem(prefix + entry.field, entry.message)));
}

function runProblems(entry, field, statuses, errors) {
  if (!isObject(entry)) {
    errors.push(problem(field, "run must be an object"));
    return false;
  }
  if (statuses.indexOf(entry.status) === -1) {
    errors.push(problem(field + ".status", "run status must be one of " + statuses.join(", ")));
  }
  return true;
}

// [FR-272] A coding case holds one pass@1 value that states k, c, and the harness version.
function codingCaseProblems(entry, field, errors) {
  if (!Array.isArray(entry.runs) || entry.runs.length === 0) {
    errors.push(problem(field + ".runs", "coding case must list its runs"));
  } else {
    entry.runs.forEach((run, index) => runProblems(run, field + ".runs[" + index + "]", aggregateModule.KNOWN_STATUSES, errors));
  }
  const validation = aggregateModule.validatePassAtOne(entry.passAtOne);
  if (!validation.ok) {
    prefixed(field + ".passAtOne.", validation.errors, errors);
  }
}

// [FR-270|FR-282|FR-283|FR-284|FR-285] A spec case holds the structural score and the judge score as two separate values;
// every judge result in it passes the judge validator.
function specCaseProblems(entry, field, errors) {
  ["structuralScore", "judgeScore"].forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(entry, key)) {
      errors.push(problem(field + "." + key, "case must hold the structural score and the judge score as two values"));
    } else if (entry[key] !== null && !isScore(entry[key])) {
      errors.push(problem(field + "." + key, "must be a number between 0 and 1, or null when absent"));
    }
  });
  if (!Array.isArray(entry.runs) || entry.runs.length === 0) {
    errors.push(problem(field + ".runs", "spec case must list its runs"));
    return;
  }
  entry.runs.forEach((run, index) => {
    const runField = field + ".runs[" + index + "]";
    if (!runProblems(run, runField, SPEC_RUN_STATUSES, errors)) {
      return;
    }
    combinedProblems(run, runField + ".", errors);
    if (isObject(run.judge)) {
      prefixed(runField + ".judge.", judgeModule.validateJudgeResult(run.judge).errors, errors);
    }
  });
}

function caseProblems(entry, index, errors) {
  const field = "cases[" + index + "]";
  if (!isObject(entry)) {
    errors.push(problem(field, "case must be an object"));
    return;
  }
  if (SUITES.indexOf(entry.suite) === -1) {
    errors.push(problem(field + ".suite", "suite must be dev or spec"));
  }
  if (typeof entry.caseId !== "string" || !IDENTIFIER_PATTERN.test(entry.caseId)) {
    errors.push(problem(field + ".caseId", "case id must be an identifier"));
  }
  combinedProblems(entry, field + ".", errors);
  if (entry.suite === "dev") {
    codingCaseProblems(entry, field, errors);
  } else if (entry.suite === "spec") {
    specCaseProblems(entry, field, errors);
  }
}

// [FR-275|FR-272|FR-270|FR-282|FR-283|FR-284|FR-285|NFR-038] validateRunResult(result) returns { ok, errors: [{ field,
// message }] }. A result is stored only when it passes.
function validateRunResult(result) {
  if (!isObject(result)) {
    return { ok: false, errors: [problem("result", "must be an object")] };
  }
  const errors = [];
  // [FR-275] A result with no plugin version is refused.
  if (!isNonEmptyString(result.pluginVersion)) {
    errors.push(problem("pluginVersion", "run result records no plugin version"));
  } else if (!VERSION_PATTERN.test(result.pluginVersion)) {
    errors.push(problem("pluginVersion", "plugin version must be a version number"));
  }
  // [FR-272] The harness version sits in the result beside every pass@1 value.
  if (!isNonEmptyString(result.harnessVersion)) {
    errors.push(problem("harnessVersion", "run result records no harness version"));
  }
  // [NFR-038] Total cost and elapsed time are recorded in every result.
  if (!isNonNegativeNumber(result.costUsd)) {
    errors.push(problem("costUsd", "run result records no total cost in USD"));
  }
  if (!isNonNegativeNumber(result.elapsedSeconds)) {
    errors.push(problem("elapsedSeconds", "run result records no elapsed time in seconds"));
  }
  combinedProblems(result, "", errors);
  if (!Array.isArray(result.cases) || result.cases.length === 0) {
    errors.push(problem("cases", "run result must hold at least one case"));
  } else {
    result.cases.forEach((entry, index) => caseProblems(entry, index, errors));
  }
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------------------------------------------------

// [FR-275] storeRunResult(result, { resultsDir, now }) validates the result and writes it to
// <resultsDir>/benchmark-<plugin version>-<timestamp>.json, so the stored file is keyed to the version. An invalid result
// is not written. A file that already exists is never overwritten.
// Returns { ok: true, path, pluginVersion } or { ok: false, path: null, errors: [{ field, message }] }.
function storeRunResult(result, options) {
  const settings = options || {};
  const validation = validateRunResult(result);
  if (!validation.ok) {
    return { ok: false, path: null, errors: validation.errors };
  }
  const dir = typeof settings.resultsDir === "string" ? settings.resultsDir : DEFAULT_RESULTS_DIR;
  const stamp = (settings.now instanceof Date ? settings.now : new Date()).toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, "benchmark-" + result.pluginVersion + "-" + stamp + ".json");
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(result, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  } catch (error) {
    return { ok: false, path: null, errors: [problem("path", REASON_NOT_WRITTEN)] };
  }
  return { ok: true, path: file, pluginVersion: result.pluginVersion };
}

module.exports = {
  readAggregateInfo,
  combineAggregateInfo,
  buildRunResult,
  validateRunResult,
  storeRunResult,
  DEFAULT_RESULTS_DIR,
  VERSION_PATTERN,
  IDENTIFIER_PATTERN,
  SUITES,
};
