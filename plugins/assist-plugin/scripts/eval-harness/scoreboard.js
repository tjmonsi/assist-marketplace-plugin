// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Version-controlled scoreboard for the evaluation benchmark harness (Group A). The file is evals/scoreboard.json. It holds
// scores, identifiers, and versions only, so no reference solution, hidden-suite text, or agent output text can enter it
// (NFR-039). The first stored benchmark run creates the file; this module never ships one.
//
// Two kinds of entry (the field lists are a minimum, not a cap, FR-276; key names are a plan choice, ASM-5):
//   aggregate row   one per release and suite    version, suite, harnessVersion, passAtOne, structuralScore, judgeScore, caseCount
//   per-case record one per release, suite, case version, suite, caseId, harnessVersion, passAtOne, k, c, structuralScore,
//                                                judgeScore, runCount
// The writer takes an allowlist of fields and refuses any other key. It also refuses a string value that does not match an
// identifier or a version pattern, a number outside its range, and any nested value, so a long text cannot ride in a
// permitted field. A refusal names the field and never echoes the value.
//
// The reader serves the release comparison (compare.js) and the release-check section. checkRowsPresent() reports a finding
// that names the version when a completed section left no row for a suite (FR-276).
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");

const resultsModule = require("./results.js");

const DEFAULT_SCOREBOARD_PATH = path.join(__dirname, "..", "..", "evals", "scoreboard.json");
const SCHEMA_VERSION = 1;
const SUITES = resultsModule.SUITES;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_COUNT = 1000000;

// Each allowed field and the one value kind it accepts.
const AGGREGATE_FIELDS = {
  version: "version",
  suite: "suite",
  harnessVersion: "version",
  passAtOne: "score",
  structuralScore: "score",
  judgeScore: "score",
  caseCount: "count",
};
const CASE_FIELDS = {
  version: "version",
  suite: "suite",
  caseId: "identifier",
  harnessVersion: "version",
  passAtOne: "score",
  k: "count",
  c: "count",
  structuralScore: "score",
  judgeScore: "score",
  runCount: "count",
};
const AGGREGATE_REQUIRED = ["version", "suite"];
const CASE_REQUIRED = ["version", "suite", "caseId"];

const REASON_UNREADABLE = "scoreboard could not be read";
const REASON_NOT_VALID = "scoreboard is not a valid scoreboard file";
const REASON_NOT_WRITTEN = "scoreboard could not be written";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function problem(field, message) {
  return { field, message };
}

// Returns the reason a value fails its kind, or null when it passes. Never returns the value.
function kindProblem(kind, value) {
  if (kind === "version") {
    return typeof value === "string" && resultsModule.VERSION_PATTERN.test(value) ? null : "must be a version number";
  }
  if (kind === "identifier") {
    return typeof value === "string" && resultsModule.IDENTIFIER_PATTERN.test(value) ? null : "must be an identifier";
  }
  if (kind === "suite") {
    return typeof value === "string" && SUITES.indexOf(value) !== -1 ? null : "must be dev or spec";
  }
  if (kind === "score") {
    return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1) ? null : "must be a number between 0 and 1, or null when absent";
  }
  return Number.isInteger(value) && value >= 0 && value <= MAX_COUNT ? null : "must be a whole number";
}

// [NFR-039] validateEntry("aggregate" | "case", entry) fails an entry that holds a field outside the allowlist, lacks a
// required field, or holds a value outside its kind. Returns { ok, errors: [{ field, message }] }.
function validateEntry(type, entry) {
  const allowed = type === "aggregate" ? AGGREGATE_FIELDS : CASE_FIELDS;
  const required = type === "aggregate" ? AGGREGATE_REQUIRED : CASE_REQUIRED;
  if (!isObject(entry)) {
    return { ok: false, errors: [problem(type, "entry must be an object")] };
  }
  const errors = [];
  Object.keys(entry).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(allowed, key)) {
      errors.push(problem(key, "is not an allowed scoreboard field"));
      return;
    }
    const reason = kindProblem(allowed[key], entry[key]);
    if (reason) {
      errors.push(problem(key, reason));
    }
  });
  required.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(entry, key)) {
      errors.push(problem(key, "is required"));
    }
  });
  return { ok: errors.length === 0, errors };
}

function validateEntries(aggregates, cases) {
  const errors = [];
  const check = (type, list, name) => {
    list.forEach((entry, index) => {
      validateEntry(type, entry).errors.forEach((error) => errors.push(problem(name + "[" + index + "]." + error.field, error.message)));
    });
  };
  check("aggregate", aggregates, "aggregates");
  check("case", cases, "cases");
  return errors;
}

// ---------------------------------------------------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------------------------------------------------

function parseVersion(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+](.*))?$/.exec(text);
  return { parts: [Number(match[1]), Number(match[2]), Number(match[3])], tail: match[4] === undefined ? null : match[4] };
}

// compareVersions(a, b) is negative when a is older than b. A version with a pre-release tail sorts before the same
// version without one. Both arguments must match the version pattern.
function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let index = 0; index < 3; index += 1) {
    if (left.parts[index] !== right.parts[index]) {
      return left.parts[index] - right.parts[index];
    }
  }
  if (left.tail === right.tail) {
    return 0;
  }
  if (left.tail === null) {
    return 1;
  }
  if (right.tail === null) {
    return -1;
  }
  return left.tail < right.tail ? -1 : 1;
}

function orderOf(a, b) {
  const byVersion = compareVersions(a.version, b.version);
  if (byVersion !== 0) {
    return byVersion;
  }
  if (a.suite !== b.suite) {
    return SUITES.indexOf(a.suite) - SUITES.indexOf(b.suite);
  }
  if (a.caseId === undefined || a.caseId === b.caseId) {
    return 0;
  }
  return a.caseId < b.caseId ? -1 : 1;
}

// ---------------------------------------------------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------------------------------------------------

function emptyScoreboard() {
  return { schemaVersion: SCHEMA_VERSION, aggregates: [], cases: [] };
}

// [FR-276|FR-278] readScoreboard(scoreboardPath) returns { ok, exists, scoreboard, reason }. A file that is absent reads as
// { ok: true, exists: false } with an empty scoreboard. A file that cannot be read, or that holds an entry the writer would
// refuse, reads { ok: false } with a fixed reason; it is never trusted.
function readScoreboard(scoreboardPath) {
  const target = typeof scoreboardPath === "string" ? scoreboardPath : DEFAULT_SCOREBOARD_PATH;
  let text;
  try {
    if (fs.statSync(target).size > MAX_BYTES) {
      return { ok: false, exists: true, scoreboard: null, reason: REASON_UNREADABLE };
    }
    text = fs.readFileSync(target, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { ok: true, exists: false, scoreboard: emptyScoreboard(), reason: null };
    }
    return { ok: false, exists: true, scoreboard: null, reason: REASON_UNREADABLE };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, exists: true, scoreboard: null, reason: REASON_NOT_VALID };
  }
  if (!isObject(parsed) || !Array.isArray(parsed.aggregates) || !Array.isArray(parsed.cases)) {
    return { ok: false, exists: true, scoreboard: null, reason: REASON_NOT_VALID };
  }
  const errors = validateEntries(parsed.aggregates, parsed.cases);
  if (errors.length > 0) {
    return { ok: false, exists: true, scoreboard: null, reason: REASON_NOT_VALID + " (" + errors[0].field + ")" };
  }
  return { ok: true, exists: true, scoreboard: { schemaVersion: SCHEMA_VERSION, aggregates: parsed.aggregates, cases: parsed.cases }, reason: null };
}

// The latest aggregate row of each suite, in suite order. These are the rows a default release check prints.
function latestRows(scoreboard) {
  const rows = scoreboard && Array.isArray(scoreboard.aggregates) ? scoreboard.aggregates : [];
  const latest = [];
  SUITES.forEach((suite) => {
    const inSuite = rows.filter((row) => row.suite === suite).sort(orderOf);
    if (inSuite.length > 0) {
      latest.push(inSuite[inSuite.length - 1]);
    }
  });
  return latest;
}

function casesFor(scoreboard, version, suite) {
  return scoreboard.cases.filter((entry) => entry.version === version && entry.suite === suite);
}

// The newest version below `version` that holds a per-case record for the suite, or null when there is none.
function previousVersion(scoreboard, version, suite) {
  const older = scoreboard.cases
    .filter((entry) => entry.suite === suite && compareVersions(entry.version, version) < 0)
    .map((entry) => entry.version)
    .sort(compareVersions);
  return older.length === 0 ? null : older[older.length - 1];
}

function formatScore(value) {
  return value === null || value === undefined ? "absent" : String(Number(value.toFixed(3)));
}

// One line that describes an aggregate row. It holds the version, the suite, and the scores only.
function describeRow(row) {
  const cases = typeof row.caseCount === "number" ? ", " + row.caseCount + (row.caseCount === 1 ? " case" : " cases") : "";
  if (row.suite === "dev") {
    const harness = row.harnessVersion ? ", harness " + row.harnessVersion : "";
    return row.version + " dev: pass@1 " + formatScore(row.passAtOne) + harness + cases;
  }
  return row.version + " spec: structural " + formatScore(row.structuralScore) + ", judge " + formatScore(row.judgeScore) + cases;
}

// [FR-276] checkRowsPresent(scoreboard, version, suites) reports a finding that names the version for each suite of a
// completed section that left no aggregate row.
function checkRowsPresent(scoreboard, version, suites) {
  const rows = scoreboard && Array.isArray(scoreboard.aggregates) ? scoreboard.aggregates : [];
  const findings = (Array.isArray(suites) ? suites : [])
    .filter((suite) => !rows.some((row) => row.version === version && row.suite === suite))
    .map((suite) => "no scoreboard row for version " + version + ", suite " + suite);
  return { ok: findings.length === 0, findings };
}

// ---------------------------------------------------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------------------------------------------------

function sameKey(a, b) {
  return a.version === b.version && a.suite === b.suite && a.caseId === b.caseId;
}

function writeFileAtomic(target, text) {
  const temporary = target + ".tmp-" + process.pid;
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(temporary, text, "utf8");
    fs.renameSync(temporary, target);
    return true;
  } catch (error) {
    try {
      fs.rmSync(temporary, { force: true });
    } catch (ignored) {
      // The temporary file holds scores only.
    }
    return false;
  }
}

// [FR-276|FR-278|NFR-039] writeEntries({ scoreboardPath, aggregates, cases }) adds aggregate rows and per-case records. An
// entry with the same key (version and suite, or those and the case id) replaces the stored one, so a rerun of a release
// does not duplicate. Every entry is validated first, and one refusal writes nothing.
// Returns { ok: true, path } or { ok: false, errors: [{ field, message }] }.
function writeEntries(request) {
  const settings = request || {};
  const target = typeof settings.scoreboardPath === "string" ? settings.scoreboardPath : DEFAULT_SCOREBOARD_PATH;
  const aggregates = Array.isArray(settings.aggregates) ? settings.aggregates : [];
  const cases = Array.isArray(settings.cases) ? settings.cases : [];
  const errors = validateEntries(aggregates, cases);
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  const stored = readScoreboard(target);
  if (!stored.ok) {
    return { ok: false, errors: [problem("scoreboard", stored.reason)] };
  }
  const merged = {
    schemaVersion: SCHEMA_VERSION,
    aggregates: stored.scoreboard.aggregates.filter((old) => !aggregates.some((entry) => sameKey(old, entry))).concat(aggregates).sort(orderOf),
    cases: stored.scoreboard.cases.filter((old) => !cases.some((entry) => sameKey(old, entry))).concat(cases).sort(orderOf),
  };
  if (!writeFileAtomic(target, JSON.stringify(merged, null, 2) + "\n")) {
    return { ok: false, errors: [problem("scoreboard", REASON_NOT_WRITTEN)] };
  }
  return { ok: true, path: target };
}

module.exports = {
  validateEntry,
  writeEntries,
  readScoreboard,
  latestRows,
  casesFor,
  previousVersion,
  checkRowsPresent,
  describeRow,
  formatScore,
  compareVersions,
  DEFAULT_SCOREBOARD_PATH,
  SUITES,
  IDENTIFIER_PATTERN: resultsModule.IDENTIFIER_PATTERN,
  VERSION_PATTERN: resultsModule.VERSION_PATTERN,
};
