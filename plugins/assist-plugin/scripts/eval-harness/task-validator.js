// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Golden-task validator for the evaluation benchmark harness (Group A). It loads one public task directory
// (evals/dev/<case>/ or evals/spec/<case>/) and returns accepted or rejected with the missing or offending part named.
//
// Public checks (the task directory):
//   prompt.md           present and not empty
//   graders/            a directory (the existing `claude plugin eval` case layout)
//   task.json           provenance, creation date, valid-against cutoff, and an optional held_out flag
//   rubric.json         spec tasks only: separate "deterministic" and "subjective" groups
// Oracle checks (the private location, looked up through oracle.js):
//   coding task         a reference solution and a hidden test suite whose every test name carries [AC-n | spec | FR-n]
//   spec task           a reference requirements set or reference spec
// The key names in task.json and rubric.json are a plan choice (ASM-5). Hidden suites are Node --test files (ASM-6); the
// test names are read from the source text, so a name built at run time from a variable is not checked.
//
// Result: { status: "accepted" | "rejected" | "error", suite, caseId, heldOut, problems, error }. Each problem is
// { part, message }. "error" means the oracle could not be reached, so nothing was judged against it.
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");

const oracleModule = require("./oracle.js");

const STATUS_ACCEPTED = "accepted";
const STATUS_REJECTED = "rejected";
const STATUS_ERROR = "error";

// [FR-257|FR-258] The only provenance values allowed. Anything else, including a public benchmark dataset, is rejected.
const PROVENANCE_VALUES = ["in-house", "private-repository"];
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// [FR-256] The scenario identifier a hidden test name starts with: [AC-n | spec | FR-n], as in
// tests/hooks/gate-evidence.test.js. More than one requirement id may follow the spec name.
const SCENARIO_ID = /^\[AC-\d+ \| [A-Za-z0-9._-]+ \| (?:N?FR)-\d+(?: \| (?:N?FR)-\d+)*\]/;
const HIDDEN_TEST_FILE = /\.test\.(?:js|mjs|cjs)$/;
const TEST_CALL = /(?:^|[^.\w$])(?:test|it)(?:\.(?:only|skip|todo))?\s*\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
const MAX_JSON_BYTES = 1024 * 1024;
const MAX_TEST_FILE_BYTES = 4 * 1024 * 1024;
const MAX_NAME_LENGTH = 120;

function problem(part, message, extra) {
  return Object.assign({ part, message }, extra || {});
}

function readText(file, limit) {
  try {
    if (fs.statSync(file).size > limit) {
      return null;
    }
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    return null;
  }
}

function isFile(target) {
  try {
    return fs.statSync(target).isFile();
  } catch (error) {
    return false;
  }
}

function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch (error) {
    return false;
  }
}

function shorten(text) {
  const flat = String(text).replace(/\s+/g, " ").trim();
  return flat.length > MAX_NAME_LENGTH ? flat.slice(0, MAX_NAME_LENGTH) + "..." : flat;
}

function isRealDate(text) {
  const match = DATE_PATTERN.exec(text);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function readJson(file) {
  const text = readText(file, MAX_JSON_BYTES);
  if (text === null) {
    return { reason: "could not be read" };
  }
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { reason: "is not valid JSON" };
  }
}

// [FR-257|FR-258] task.json holds provenance, creation date, valid-against cutoff, and an optional held_out flag.
function checkMetadata(taskDir) {
  const file = path.join(taskDir, "task.json");
  if (!isFile(file)) {
    return { problems: [problem("task.json", "missing task.json (provenance, creation date, valid-against cutoff)")], heldOut: false };
  }
  const parsed = readJson(file);
  if (parsed.reason) {
    return { problems: [problem("task.json", "task.json " + parsed.reason)], heldOut: false };
  }
  const meta = parsed.value;
  if (meta === null || typeof meta !== "object" || Array.isArray(meta)) {
    return { problems: [problem("task.json", "task.json must hold a JSON object")], heldOut: false };
  }
  const problems = [];
  if (typeof meta.provenance !== "string" || meta.provenance === "") {
    problems.push(problem("provenance", "missing provenance (in-house or private-repository)"));
  } else if (PROVENANCE_VALUES.indexOf(meta.provenance) === -1) {
    problems.push(problem("provenance", "provenance " + JSON.stringify(shorten(meta.provenance)) + " is not allowed; use in-house or private-repository"));
  }
  [["creation_date", "creation date"], ["valid_against_cutoff", "valid-against cutoff"]].forEach((entry) => {
    const value = meta[entry[0]];
    if (value === undefined || value === null || value === "") {
      problems.push(problem(entry[0], "missing " + entry[1]));
    } else if (typeof value !== "string" || !isRealDate(value)) {
      problems.push(problem(entry[0], entry[1] + " must be a date in YYYY-MM-DD form"));
    }
  });
  if (meta.held_out !== undefined && typeof meta.held_out !== "boolean") {
    problems.push(problem("held_out", "held_out must be true or false"));
  }
  return { problems, heldOut: meta.held_out === true };
}

// [FR-255] A spec rubric lists deterministic items apart from subjective items. A rubric with one mixed list, a missing
// group, or an item marked as the other kind is rejected.
function checkRubric(taskDir) {
  const file = path.join(taskDir, "rubric.json");
  if (!isFile(file)) {
    return [problem("rubric.json", "missing rubric.json")];
  }
  const parsed = readJson(file);
  if (parsed.reason) {
    return [problem("rubric.json", "rubric.json " + parsed.reason)];
  }
  const rubric = parsed.value;
  if (rubric === null || typeof rubric !== "object" || Array.isArray(rubric)) {
    return [problem("rubric.json", "rubric.json must hold a JSON object")];
  }
  const mixed = "rubric.json mixes deterministic and subjective items; list them in separate groups";
  if (Array.isArray(rubric.items)) {
    return [problem("rubric.json", mixed)];
  }
  const problems = [];
  ["deterministic", "subjective"].forEach((group) => {
    if (!Array.isArray(rubric[group])) {
      problems.push(problem("rubric.json", "rubric.json is missing the " + group + " group"));
      return;
    }
    const other = group === "deterministic" ? "subjective" : "deterministic";
    const crossed = rubric[group].some((item) => item !== null && typeof item === "object" && (item.kind === other || item.type === other));
    if (crossed) {
      problems.push(problem("rubric.json", mixed));
    }
  });
  return problems;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

// [FR-256] Returns the first hidden test whose name has no scenario identifier, or a problem when a suite file cannot
// be read or the suite holds no test. The result names the test and its file, relative to the hidden directory.
function checkHiddenTests(hiddenDir) {
  const listing = oracleModule.listFiles(hiddenDir);
  if (!listing.ok) {
    return [problem("hidden-suite", "hidden test suite could not be read")];
  }
  const testFiles = listing.files.filter((file) => !file.symlink && HIDDEN_TEST_FILE.test(file.relative));
  if (testFiles.length === 0) {
    return [problem("hidden-suite", "hidden test suite holds no test file")];
  }
  let found = 0;
  for (let index = 0; index < testFiles.length; index += 1) {
    const text = readText(testFiles[index].absolute, MAX_TEST_FILE_BYTES);
    if (text === null) {
      return [problem("hidden-suite", "hidden test file could not be read: " + testFiles[index].relative)];
    }
    const source = stripComments(text);
    const pattern = new RegExp(TEST_CALL.source, "g");
    let match = pattern.exec(source);
    while (match !== null) {
      found += 1;
      if (!SCENARIO_ID.test(match[2])) {
        const name = shorten(match[2]);
        return [problem("hidden-test", "hidden test has no scenario identifier: " + name, { test: name, file: testFiles[index].relative })];
      }
      match = pattern.exec(source);
    }
  }
  if (found === 0) {
    return [problem("hidden-suite", "hidden test suite holds no test with a literal name")];
  }
  return [];
}

// [FR-254|FR-255] Oracle-side checks. Returns { problems } or { error } when the oracle could not be reached.
function checkOracle(options, suite, caseId) {
  const oracle = options.oracle || oracleModule.resolveOracle(options.oracleLocation, options);
  const found = oracleModule.lookupCase(oracle, suite, caseId);
  if (!found.ok) {
    return { error: { code: found.code, location: found.location, message: found.message } };
  }
  const problems = [];
  if (suite === "dev") {
    if (!found.referenceDir) {
      problems.push(problem("reference", "missing reference solution"));
    }
    if (!found.hiddenDir) {
      problems.push(problem("hidden-suite", "missing hidden test suite"));
    } else {
      Array.prototype.push.apply(problems, checkHiddenTests(found.hiddenDir));
    }
  } else if (!found.referenceDir) {
    problems.push(problem("reference", "missing reference requirements set or reference spec"));
  }
  return { problems };
}

// validateTask(taskDir, { oracle | oracleLocation, suite, logger }) validates one public task directory. `suite` defaults
// to the name of the directory that holds the task ("dev" or "spec"). The oracle is a resolved oracle from
// oracle.resolveOracle, or a location string the validator resolves itself.
function validateTask(taskDir, options) {
  const settings = options || {};
  const log = oracleModule.loggerOf(settings);
  const caseId = path.basename(taskDir);
  const suite = settings.suite || path.basename(path.dirname(path.resolve(taskDir)));
  const result = { status: STATUS_REJECTED, suite, caseId, heldOut: false, problems: [], error: null };

  if (!isDirectory(taskDir)) {
    result.status = STATUS_ERROR;
    result.error = { code: "task-unreadable", location: null, message: "task directory could not be read" };
    log("error", "task.validate", { suite, caseId, status: result.status });
    return result;
  }
  if (oracleModule.SUITES.indexOf(suite) === -1) {
    result.problems.push(problem("suite", "task is not under a dev or spec suite directory"));
    log("warn", "task.validate", { suite, caseId, status: result.status });
    return result;
  }

  // [FR-263] Every case keeps the claude plugin eval layout: a prompt.md and a graders/ folder.
  const prompt = readText(path.join(taskDir, "prompt.md"), MAX_JSON_BYTES);
  if (prompt === null || prompt.trim() === "") {
    result.problems.push(problem("prompt.md", "missing prompt.md"));
  }
  if (!isDirectory(path.join(taskDir, "graders"))) {
    result.problems.push(problem("graders", "missing graders/ folder"));
  }
  const metadata = checkMetadata(taskDir);
  Array.prototype.push.apply(result.problems, metadata.problems);
  result.heldOut = metadata.heldOut;
  if (suite === "spec") {
    Array.prototype.push.apply(result.problems, checkRubric(taskDir));
  }

  const oracleResult = checkOracle(settings, suite, caseId);
  if (oracleResult.error) {
    result.status = STATUS_ERROR;
    result.error = oracleResult.error;
  } else {
    Array.prototype.push.apply(result.problems, oracleResult.problems);
    result.status = result.problems.length === 0 ? STATUS_ACCEPTED : STATUS_REJECTED;
  }
  log(result.status === STATUS_ACCEPTED ? "info" : "warn", "task.validate", {
    suite,
    caseId,
    status: result.status,
    parts: result.problems.map((entry) => entry.part),
  });
  return result;
}

module.exports = { validateTask, PROVENANCE_VALUES, SCENARIO_ID };
