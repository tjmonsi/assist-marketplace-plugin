// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Aggregation for the evaluation benchmark harness (Group A): pass@1 for a coding case, and flaky-test reporting.
//
// pass@1 = c / k, where k counts the completed runs of the case (status "pass" or "fail") and c counts the passes. A
// "not-run" or "error" run counts in neither. When k is 0 the value is absent (null), never 0, and the division never
// runs. Every pass@1 value carries k, c, and the harness version beside it.
//
// A hidden test that gives different results across repeated runs of one candidate is flagged flaky. The flagged test
// stays in the suite result. This module never skips a test and never retries one.
//
// The run count k comes from the harness configuration (runCountFromConfig); it has no default in code. Test names come
// from the hidden suite, so the flaky list belongs in the git-ignored run result and never on the scoreboard (NFR-039).
// No dependencies; ES2015 syntax only.
"use strict";

const configModule = require("./config.js");

// [FR-272] The harness version stated beside every pass@1 value. Whether it equals the plugin version is a plan choice
// (ASM-5); the user confirms or renames it. Bump it when the scoring rules change so results stay comparable.
const HARNESS_VERSION = "1.0.0";

const STATUS_PASS = "pass";
const STATUS_FAIL = "fail";
const STATUS_NOT_RUN = "not-run";
const STATUS_ERROR = "error";
const KNOWN_STATUSES = [STATUS_PASS, STATUS_FAIL, STATUS_NOT_RUN, STATUS_ERROR];

// A test that is present in a completed run but missing from another reads "missing", which differs from "pass".
const TEST_MISSING = "missing";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function problem(field, message) {
  return { field, message };
}

// [FR-271] runCountFromConfig(configPath) reads the configured run count. A missing or non-numeric value is an error.
function runCountFromConfig(configPath) {
  const loaded = configModule.loadConfig(configPath, { require: ["runCount"] });
  if (!loaded.ok) {
    return { ok: false, runCount: null, errors: loaded.errors };
  }
  return { ok: true, runCount: loaded.config.runCount, errors: [] };
}

// [FR-271|FR-272] passAtOne(runs, options) computes c / k over the runs of one case.
//   runs                   [{ status }] with status "pass", "fail", "not-run", or "error"
//   options.harnessVersion optional; defaults to HARNESS_VERSION
//   options.runCount       optional configured run count, recorded as expectedRuns for the caller to compare
// A run with an unknown status counts in neither c nor k and is counted in `ignored`.
function passAtOne(runs, options) {
  const settings = options || {};
  const list = Array.isArray(runs) ? runs : [];
  let c = 0;
  let k = 0;
  let notRun = 0;
  let errored = 0;
  let ignored = 0;
  list.forEach((run) => {
    const status = isObject(run) ? run.status : null;
    if (status === STATUS_PASS) {
      c += 1;
      k += 1;
    } else if (status === STATUS_FAIL) {
      k += 1;
    } else if (status === STATUS_NOT_RUN) {
      notRun += 1;
    } else if (status === STATUS_ERROR) {
      errored += 1;
    } else {
      ignored += 1;
    }
  });
  return {
    // [FR-271] k = 0 reads absent, not 0, and the division is never reached.
    value: k === 0 ? null : c / k,
    k,
    c,
    harnessVersion: typeof settings.harnessVersion === "string" && settings.harnessVersion !== "" ? settings.harnessVersion : HARNESS_VERSION,
    notRun,
    errored,
    ignored,
    runsReported: list.length,
    expectedRuns: Number.isInteger(settings.runCount) ? settings.runCount : null,
  };
}

// [FR-272] validatePassAtOne(entry) fails a pass@1 value that lacks its harness version or its k and c, or whose value
// is not c / k. Every problem names its field.
function validatePassAtOne(entry) {
  if (!isObject(entry)) {
    return { ok: false, errors: [problem("passAtOne", "must be an object")] };
  }
  const errors = [];
  if (typeof entry.harnessVersion !== "string" || entry.harnessVersion.trim() === "") {
    errors.push(problem("harnessVersion", "pass@1 needs the harness version stated beside it"));
  }
  const kOk = Number.isInteger(entry.k) && entry.k >= 0;
  const cOk = Number.isInteger(entry.c) && entry.c >= 0;
  if (!kOk) {
    errors.push(problem("k", "pass@1 needs k stated as a whole number"));
  }
  if (!cOk) {
    errors.push(problem("c", "pass@1 needs c stated as a whole number"));
  }
  if (kOk && cOk) {
    if (entry.c > entry.k) {
      errors.push(problem("c", "c must not exceed k"));
    } else if (entry.k === 0 && entry.value !== null) {
      errors.push(problem("value", "pass@1 must be absent when k is 0"));
    } else if (entry.k > 0 && entry.value !== entry.c / entry.k) {
      errors.push(problem("value", "pass@1 must equal c divided by k"));
    }
  }
  return { ok: errors.length === 0, errors };
}

// Folds the entries of one test name inside one run into one status: fail outranks pass, and pass outranks skip.
function foldStatus(statuses) {
  if (statuses.indexOf(STATUS_FAIL) !== -1) {
    return STATUS_FAIL;
  }
  if (statuses.indexOf(STATUS_PASS) !== -1) {
    return STATUS_PASS;
  }
  return statuses[0];
}

// [FR-287] flakyTests(runs) compares the per-test results of repeated runs of ONE candidate. Only completed runs with a
// parsed test list take part. Every test seen stays in `tests`; a test whose status differs between runs also sits in
// `flaky`. Nothing is skipped or retried, and the order follows first appearance, so the output is deterministic.
function flakyTests(runs) {
  const list = Array.isArray(runs) ? runs : [];
  const comparable = list.filter((run) => {
    return isObject(run) && (run.status === STATUS_PASS || run.status === STATUS_FAIL) && run.testsParsed === true && Array.isArray(run.tests);
  });
  const order = [];
  const perRun = comparable.map((run) => {
    const byName = {};
    run.tests.forEach((test) => {
      if (!isObject(test) || typeof test.name !== "string") {
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(byName, test.name)) {
        byName[test.name] = [];
        if (order.indexOf(test.name) === -1) {
          order.push(test.name);
        }
      }
      byName[test.name].push(test.status);
    });
    return byName;
  });
  const tests = order.map((name) => {
    const statuses = perRun.map((byName) => (Object.prototype.hasOwnProperty.call(byName, name) ? foldStatus(byName[name]) : TEST_MISSING));
    const counts = {};
    statuses.forEach((status) => {
      counts[status] = (counts[status] || 0) + 1;
    });
    return { name, runs: statuses.length, counts, flaky: Object.keys(counts).length > 1 };
  });
  return { comparedRuns: comparable.length, tests, flaky: tests.filter((test) => test.flaky) };
}

// [FR-271|FR-272|FR-287] aggregateCase(runs, options) is the per-case summary: pass@1 with k, c, and the harness
// version, plus the flaky report over the same runs.
function aggregateCase(runs, options) {
  return { passAtOne: passAtOne(runs, options), flakiness: flakyTests(runs) };
}

module.exports = {
  passAtOne,
  validatePassAtOne,
  flakyTests,
  aggregateCase,
  runCountFromConfig,
  HARNESS_VERSION,
  KNOWN_STATUSES,
};
