// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Configuration loader for the evaluation benchmark harness (Group A). It reads evals/harness.config.json, checks it,
// and returns the values every later harness step uses.
//
// The OQ-14 numbers (run count k, regression margin, reference validation run count, judge run count, new tasks per
// release) ship UNSET. This loader errors naming a field that is missing or not numeric and never substitutes a default
// number for one. The judge-agreement floor is the one configured value that ships with a number: the provisional
// setting, returned together with its label, replaced by an override when the file holds one.
//
// The private oracle location resolves from three sources, first present wins (FR-260, FR-261): the environment variable
// ASSIST_EVAL_ORACLE_DIR, then the `oracleLocation` key of the uncommitted override file harness.config.local.json beside the
// config file, then the committed `oracleLocation`, which ships as the placeholder null. `requireOracle` makes a run that
// resolves none of them an error; no default location is ever substituted.
//
// Result shape: { ok: true, config, errors: [] } or { ok: false, config: null, errors: ["<field>: <fixed reason>", ...] }.
// A reason is fixed text. It never holds raw parser output or the value that failed the check.
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_CONFIG_PATH = path.join(__dirname, "..", "..", "evals", "harness.config.json");

// [FR-271|FR-277|FR-259|FR-285|FR-281] The OQ-14 estimates to confirm. The key names are a plan choice (ASM-5).
const OQ14_FIELDS = [
  { key: "runCount", requirement: "FR-271", kind: "positive-integer" },
  { key: "regressionMargin", requirement: "FR-277", kind: "fraction" },
  { key: "referenceValidationRuns", requirement: "FR-259", kind: "positive-integer" },
  { key: "judgeRuns", requirement: "FR-285", kind: "positive-integer" },
  { key: "newTasksPerRelease", requirement: "FR-281", kind: "non-negative-integer" },
];

// [FR-287] The setting that retries a failing hidden test. The first key is the canonical one; the others are rejected
// when set so a differently named retry setting cannot hide flakiness.
const RETRY_KEY = "retryOnFailure";
const RETRY_ALIAS_KEYS = ["retries", "retry", "maxRetries", "rerunOnFailure", "retryUntilPass"];

// [FR-260|FR-261] Where the private oracle location can come from, besides the committed config value.
const ORACLE_ENV_KEY = "ASSIST_EVAL_ORACLE_DIR";
const OVERRIDE_FILE_NAME = "harness.config.local.json";

const MAX_LOCATION_LENGTH = 4096;
const URL_CREDENTIALS = /^[a-z][a-z0-9+.-]*:\/\/[^/@]*@/i;

const REASON_NOT_READABLE = "config file could not be read";
const REASON_NOT_JSON = "config file is not valid JSON";
const REASON_NOT_OBJECT = "config file must hold a JSON object";
const REASON_NOT_SET = "is not set";
const REASON_NOT_NUMBER = "is not a number";
const REASON_ORACLE_UNSET = "oracle location is unset; set " + ORACLE_ENV_KEY + " or the uncommitted override file";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isUnset(value) {
  return value === undefined || value === null;
}

function isPlainNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

// Returns the reason a numeric value fails its kind, or null when it passes. Never returns the value.
function numberProblem(value, kind) {
  if (!isPlainNumber(value)) {
    return REASON_NOT_NUMBER;
  }
  if (kind === "positive-integer" && !(Number.isInteger(value) && value >= 1)) {
    return "must be a whole number of at least 1";
  }
  if (kind === "non-negative-integer" && !(Number.isInteger(value) && value >= 0)) {
    return "must be a whole number of at least 0";
  }
  if (kind === "fraction" && !(value >= 0 && value <= 1)) {
    return "must be between 0 and 1";
  }
  return null;
}

// [FR-271|FR-277|FR-259|FR-285|FR-281] A required OQ-14 field that is missing or non-numeric is an error that names the
// field. A field that is not required may stay unset; it then reads null and never a default number.
function checkOq14(raw, required, errors) {
  const values = {};
  OQ14_FIELDS.forEach((field) => {
    const value = raw[field.key];
    const mustHave = required.indexOf(field.key) !== -1;
    if (isUnset(value)) {
      values[field.key] = null;
      if (mustHave) {
        errors.push(field.key + " (" + field.requirement + "): " + REASON_NOT_SET);
      }
      return;
    }
    const problem = numberProblem(value, field.kind);
    if (problem) {
      errors.push(field.key + " (" + field.requirement + "): " + problem);
      values[field.key] = null;
      return;
    }
    values[field.key] = value;
  });
  return values;
}

// [FR-287] Reject any setting that retries a failing hidden test. Absent, 0, and false all mean no retry.
function checkRetry(raw, errors) {
  RETRY_ALIAS_KEYS.concat([RETRY_KEY]).forEach((key) => {
    const value = raw[key];
    if (isUnset(value) || value === 0 || value === false) {
      return;
    }
    if (key === RETRY_KEY && !isPlainNumber(value)) {
      errors.push(key + " (FR-287): " + REASON_NOT_NUMBER);
      return;
    }
    errors.push(key + " (FR-287): retrying a failing hidden test until it passes is not allowed");
  });
  return 0;
}

// [FR-286] A floor needs a numeric rho, a numeric kappa, and a label. A floor with no label is rejected.
function checkFloor(candidate, name, source, errors) {
  if (!isObject(candidate)) {
    errors.push(name + " (FR-286): " + REASON_NOT_SET);
    return null;
  }
  const before = errors.length;
  ["spearmanRho", "cohenKappa"].forEach((key) => {
    const value = candidate[key];
    if (!isPlainNumber(value)) {
      errors.push(name + "." + key + " (FR-286): " + REASON_NOT_NUMBER);
    } else if (!(value > 0 && value <= 1)) {
      errors.push(name + "." + key + " (FR-286): must be above 0 and at most 1");
    }
  });
  if (typeof candidate.label !== "string" || candidate.label.trim() === "") {
    errors.push(name + " (FR-286): has no label");
  }
  if (errors.length > before) {
    return null;
  }
  return {
    spearmanRho: candidate.spearmanRho,
    cohenKappa: candidate.cohenKappa,
    label: candidate.label.trim(),
    source,
  };
}

// [FR-286] The floor that applies: the user override when the file holds one, else the shipped provisional floor.
function resolveFloor(raw, errors) {
  const shipped = checkFloor(raw.judgeAgreementFloor, "judgeAgreementFloor", "shipped", errors);
  if (isUnset(raw.judgeAgreementFloorOverride)) {
    return shipped;
  }
  const override = checkFloor(raw.judgeAgreementFloorOverride, "judgeAgreementFloorOverride", "override", errors);
  return override || shipped;
}

// [FR-260|FR-261|FR-286|NFR-039] A location field is a location string only. It stays null until the user sets it, and
// it must not embed credentials. `tags` names the requirement that owns the field: { type, cred } holds the tag for the
// wrong-type error and the tag for the embedded-credentials error.
function checkLocation(value, name, errors, tags) {
  if (isUnset(value)) {
    return null;
  }
  if (typeof value !== "string" || value.trim() === "" || value.length > MAX_LOCATION_LENGTH || value.indexOf("\u0000") !== -1) {
    errors.push(name + " (" + tags.type + "): must be a location string");
    return null;
  }
  if (URL_CREDENTIALS.test(value)) {
    errors.push(name + " (" + tags.cred + "): must not embed credentials");
    return null;
  }
  return value;
}

function isBlank(value) {
  return typeof value === "string" && value.trim() === "";
}

// [FR-260|FR-261] Reads the uncommitted override file. An absent file is no override. A file that exists but cannot be read
// or parsed is an error, never silently ignored, so a mistyped override cannot fall back to the committed value unseen.
function readOverrideFile(overridePath) {
  try {
    fs.statSync(overridePath);
  } catch (error) {
    return error && error.code === "ENOENT" ? { absent: true } : { reason: REASON_NOT_READABLE };
  }
  return readJson(overridePath);
}

// [FR-260|FR-261] The oracle location that applies, first present wins like resolveFloor: the environment variable, then the
// override file beside the config file, then the committed value. Every candidate passes checkLocation, so the type, length,
// NUL, and embedded-credentials rules hold for each source. A relative override path resolves against the override file's
// directory and an environment path against the working directory. Returns { location, source }; both are null when none
// resolves, and then `requireOracle` makes that an error with fixed text that holds no path.
function resolveOracleLocation(raw, configFile, settings, errors) {
  const tags = { type: "FR-260", cred: "FR-261" };
  const env = isObject(settings.env) ? settings.env : process.env;
  const before = errors.length;

  const fromEnv = env[ORACLE_ENV_KEY];
  if (!isUnset(fromEnv) && !isBlank(fromEnv)) {
    const location = checkLocation(fromEnv, "oracleLocation", errors, tags);
    return { location: location === null ? null : resolveAgainst(process.cwd(), location), source: location === null ? null : "env" };
  }

  const overridePath = path.join(path.dirname(configFile), OVERRIDE_FILE_NAME);
  const override = readOverrideFile(overridePath);
  if (override.reason) {
    errors.push(OVERRIDE_FILE_NAME + ": " + override.reason);
    return { location: null, source: null };
  }
  if (!override.absent) {
    if (!isObject(override.value)) {
      errors.push(OVERRIDE_FILE_NAME + ": " + REASON_NOT_OBJECT);
      return { location: null, source: null };
    }
    const location = checkLocation(override.value.oracleLocation, "oracleLocation", errors, tags);
    if (location !== null) {
      return { location: resolveAgainst(path.dirname(overridePath), location), source: "override" };
    }
    if (errors.length > before) {
      return { location: null, source: null };
    }
  }

  const committed = checkLocation(raw.oracleLocation, "oracleLocation", errors, tags);
  if (committed !== null) {
    return { location: committed, source: "committed" };
  }
  if (settings.requireOracle === true && errors.length === before) {
    errors.push("oracleLocation (FR-260): " + REASON_ORACLE_UNSET);
  }
  return { location: null, source: null };
}

// A URL stays as written; a path becomes absolute against `base`.
function resolveAgainst(base, location) {
  return location.indexOf("://") !== -1 ? location : path.resolve(base, location);
}

function checkBoolean(value, name, errors) {
  if (isUnset(value)) {
    return false;
  }
  if (typeof value !== "boolean") {
    errors.push(name + ": must be true or false");
    return false;
  }
  return value;
}

function readJson(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    return { reason: REASON_NOT_READABLE };
  }
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { reason: REASON_NOT_JSON };
  }
}

// loadConfig(filePath, { require, requireOracle, env }) reads and checks the harness configuration.
// `require` lists the OQ-14 keys the caller needs; it defaults to all five. A step that needs only some of them (the
// admission step needs referenceValidationRuns) passes a shorter list. A listed key that is unset is an error.
// `requireOracle` (default false, so a caller that never reads the oracle keeps loading) makes an unresolved oracle location
// an error. `env` (default process.env) is the environment the oracle variable is read from.
function loadConfig(filePath, options) {
  const settings = options || {};
  const file = filePath || DEFAULT_CONFIG_PATH;
  const required = Array.isArray(settings.require) ? settings.require : OQ14_FIELDS.map((field) => field.key);
  const parsed = readJson(file);
  if (parsed.reason) {
    return { ok: false, config: null, errors: [path.basename(file) + ": " + parsed.reason] };
  }
  if (!isObject(parsed.value)) {
    return { ok: false, config: null, errors: [path.basename(file) + ": " + REASON_NOT_OBJECT] };
  }
  const raw = parsed.value;
  const errors = [];
  const numbers = checkOq14(raw, required, errors);
  const oracle = resolveOracleLocation(raw, file, settings, errors);
  const config = Object.assign({}, numbers, {
    oracleLocation: oracle.location,
    oracleLocationSource: oracle.source,
    retryOnFailure: checkRetry(raw, errors),
    judgeEnabled: checkBoolean(raw.judgeEnabled, "judgeEnabled", errors),
    judgeAgreementFloor: resolveFloor(raw, errors),
    labeledSamplePath: checkLocation(raw.labeledSamplePath, "labeledSamplePath", errors, { type: "FR-286", cred: "FR-286" }),
  });
  if (errors.length > 0) {
    return { ok: false, config: null, errors };
  }
  return { ok: true, config, errors: [] };
}

module.exports = { loadConfig, DEFAULT_CONFIG_PATH, OQ14_FIELDS };
