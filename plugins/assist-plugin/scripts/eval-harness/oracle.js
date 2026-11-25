// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Oracle handling for the evaluation benchmark harness (Group A): resolve the private oracle location, admit a
// reference solution, prepare an agent workspace with the oracle withheld, and leak-check that workspace.
//
// The oracle is each reference solution and hidden test suite. It lives in a private location named by
// evals/harness.config.json (decision D-16) and is read here at run time. This module copies oracle files only into
// transient temp directories, writes no oracle content into the repository, and never logs file contents. A log line
// holds an event name, a case id, a run number, or a path, and nothing else.
//
// Private layout this module reads (a plan choice, ASM-5):
//   <location>/<suite>/<case>/reference/   reference solution (coding) or reference requirements set or spec (spec)
//   <location>/<suite>/<case>/hidden/      hidden test suite (coding), Node --test files (ASM-6)
// where <suite> is "dev" or "spec".
//
// Every function returns a result object with a fixed reason and never throws for an expected condition. A reason
// never holds raw stderr or file content.
// No dependencies; ES2015 syntax only.
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ORACLE_DIR_REFERENCE = "reference";
const ORACLE_DIR_HIDDEN = "hidden";
const ORACLE_DIR_NAMES = [ORACLE_DIR_REFERENCE, ORACLE_DIR_HIDDEN];
const SUITES = ["dev", "spec"];
const CASE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Public task files an agent workspace never receives: the graders and the task metadata and rubric are for scoring.
// This list is a plan choice (an assumption, not fixed by the spec).
const WITHHELD_PUBLIC_NAMES = ["graders", "task.json", "rubric.json"];

const SUITE_TIMEOUT_MS = 120 * 1000;
const MAX_FILES = 50000;
const MAX_DEPTH = 32;

const CODE_NOT_CONFIGURED = "oracle-not-configured";
const CODE_UNREACHABLE = "oracle-unreachable";
const CODE_BAD_CASE = "oracle-bad-case";

function jsonLogger(level, message, fields) {
  const record = Object.assign({ timestamp: new Date().toISOString(), level, message }, fields || {});
  process.stderr.write(JSON.stringify(record) + "\n");
}

// A logger is a function (level, message, fields). The default writes one JSON line to stderr.
function loggerOf(options) {
  return options && typeof options.logger === "function" ? options.logger : jsonLogger;
}

function toPosix(relative) {
  return relative.split(path.sep).join("/");
}

function isReadableDirectory(target) {
  try {
    if (!fs.statSync(target).isDirectory()) {
      return false;
    }
    fs.readdirSync(target);
    return true;
  } catch (error) {
    return false;
  }
}

function hasEntries(directory) {
  try {
    return fs.readdirSync(directory).length > 0;
  } catch (error) {
    return false;
  }
}

// Lists every file under a directory as { relative, absolute, symlink }, sorted by relative path. A symbolic link is
// listed and never followed. Returns { ok: true, files } or { ok: false, reason }.
function listFiles(directory) {
  const files = [];
  let overflow = false;
  function walk(current, depth) {
    fs.readdirSync(current).sort().forEach((name) => {
      if (overflow) {
        return;
      }
      const absolute = path.join(current, name);
      const stat = fs.lstatSync(absolute);
      if (stat.isDirectory()) {
        if (depth >= MAX_DEPTH) {
          overflow = true;
        } else {
          walk(absolute, depth + 1);
        }
        return;
      }
      files.push({ relative: toPosix(path.relative(directory, absolute)), absolute, symlink: stat.isSymbolicLink() });
      if (files.length > MAX_FILES) {
        overflow = true;
      }
    });
  }
  try {
    walk(directory, 0);
  } catch (error) {
    return { ok: false, reason: "directory could not be read" };
  }
  if (overflow) {
    return { ok: false, reason: "directory holds too many files or is nested too deeply" };
  }
  return { ok: true, files };
}

function sha256(absolute) {
  return crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex");
}

function copyFiles(files, targetDir) {
  files.forEach((file) => {
    if (file.symlink) {
      return;
    }
    const destination = path.join(targetDir, file.relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(file.absolute, destination);
  });
}

// [FR-260|FR-261] resolveOracle(location) reads the configured private location. When it is not set, absent, or
// unreadable it returns an error that names the location. It scores nothing, and the caller never reads the error as a
// benchmark score. The location is a pointer, not oracle content, so it may appear in the error and the log.
function resolveOracle(location, options) {
  const log = loggerOf(options);
  if (typeof location !== "string" || location.trim() === "") {
    log("error", "oracle.resolve", { code: CODE_NOT_CONFIGURED });
    return { ok: false, code: CODE_NOT_CONFIGURED, location: null, message: "private oracle location is not configured" };
  }
  const root = path.resolve(location);
  if (!isReadableDirectory(root)) {
    log("error", "oracle.resolve", { code: CODE_UNREACHABLE, location });
    return { ok: false, code: CODE_UNREACHABLE, location, message: "private oracle location is unreachable: " + location };
  }
  log("info", "oracle.resolve", { location });
  return { ok: true, location, root };
}

// [FR-254|FR-255|FR-260] lookupCase(oracle, suite, caseId) finds the reference and hidden-suite directories of one case.
// A directory that is absent or empty reads null, so the caller can name the missing part.
function lookupCase(oracle, suite, caseId) {
  if (!oracle || !oracle.ok) {
    const code = oracle && oracle.code ? oracle.code : CODE_UNREACHABLE;
    const location = oracle && oracle.location ? oracle.location : null;
    const message = oracle && oracle.message ? oracle.message : "private oracle location is unreachable";
    return { ok: false, code, location, message };
  }
  if (SUITES.indexOf(suite) === -1 || typeof caseId !== "string" || !CASE_ID_PATTERN.test(caseId)) {
    return { ok: false, code: CODE_BAD_CASE, location: oracle.location, message: "suite or case id is not valid" };
  }
  const caseDir = path.join(oracle.root, suite, caseId);
  const referenceDir = path.join(caseDir, ORACLE_DIR_REFERENCE);
  const hiddenDir = path.join(caseDir, ORACLE_DIR_HIDDEN);
  return {
    ok: true,
    suite,
    caseId,
    referenceDir: hasEntries(referenceDir) ? referenceDir : null,
    hiddenDir: hasEntries(hiddenDir) ? hiddenDir : null,
  };
}

// Runs a hidden suite against a solution in a fresh temp directory with Node --test. The temp directory holds the
// solution files with the hidden files overlaid, and is removed afterward. Exit 0 reads "pass", a non-zero exit reads
// "fail", and a suite that could not run reads "error". Child output is discarded, so no suite text can reach a log.
function runHiddenSuite(solutionDir, hiddenDir, options) {
  const settings = options || {};
  const solution = listFiles(solutionDir);
  const hidden = listFiles(hiddenDir);
  if (!solution.ok || !hidden.ok) {
    return { status: "error", exitCode: null, reason: "oracle files could not be read" };
  }
  let workDir;
  try {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-harness-grade-"));
    copyFiles(solution.files, workDir);
    copyFiles(hidden.files, workDir);
    // A parent `node --test` run sets this variable, and a child that inherits it does not run as a normal test run.
    const env = Object.assign({}, process.env);
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ["--test"], {
      cwd: workDir,
      env,
      stdio: "ignore",
      timeout: settings.timeoutMs || SUITE_TIMEOUT_MS,
    });
    if (result.error) {
      return { status: "error", exitCode: null, reason: result.error.code === "ETIMEDOUT" ? "hidden suite timed out" : "hidden suite could not start" };
    }
    if (result.signal || typeof result.status !== "number") {
      return { status: "error", exitCode: null, reason: "hidden suite was terminated" };
    }
    return { status: result.status === 0 ? "pass" : "fail", exitCode: result.status, reason: null };
  } catch (error) {
    return { status: "error", exitCode: null, reason: "hidden suite could not run" };
  } finally {
    removeQuietly(workDir);
  }
}

function removeQuietly(directory) {
  if (!directory) {
    return;
  }
  try {
    fs.rmSync(directory, { recursive: true, force: true });
  } catch (error) {
    // A leftover temp directory holds only copies of files already in the private location.
  }
}

// [FR-259] admitReference({ oracle, suite, caseId, runs }) admits a coding task only when its reference solution passes
// its hidden suite on `runs` consecutive runs. `runs` comes from the configuration and has no default here. When a run
// does not pass, the result names that run number and the task is not admitted.
function admitReference(request) {
  const settings = request || {};
  const log = loggerOf(settings);
  const runs = settings.runs;
  if (!(Number.isInteger(runs) && runs >= 1)) {
    return { admitted: false, failingRun: null, runs: null, reason: "reference validation run count is not set" };
  }
  const found = lookupCase(settings.oracle, settings.suite, settings.caseId);
  if (!found.ok) {
    return { admitted: false, failingRun: null, runs, reason: found.message };
  }
  if (!found.referenceDir) {
    return { admitted: false, failingRun: null, runs, reason: "missing reference solution" };
  }
  if (!found.hiddenDir) {
    return { admitted: false, failingRun: null, runs, reason: "missing hidden test suite" };
  }
  for (let run = 1; run <= runs; run += 1) {
    const outcome = runHiddenSuite(found.referenceDir, found.hiddenDir, settings);
    log(outcome.status === "pass" ? "info" : "warn", "oracle.admission.run", {
      suite: settings.suite,
      caseId: settings.caseId,
      run,
      runs,
      status: outcome.status,
    });
    if (outcome.status !== "pass") {
      const detail = outcome.status === "fail" ? "reference failed the hidden suite" : outcome.reason;
      return { admitted: false, failingRun: run, runs, reason: detail + " on run " + run + " of " + runs };
    }
  }
  return { admitted: true, failingRun: null, runs, reason: null };
}

// True when a relative path holds a segment named like oracle material.
function hasOracleSegment(relative) {
  return relative.split("/").some((segment) => ORACLE_DIR_NAMES.indexOf(segment.toLowerCase()) !== -1);
}

// [FR-260] prepareWorkspace(publicDir, { workspaceDir }) builds the agent workspace from public task material only. It
// leaves out the graders, the task metadata, the rubric, and anything under a directory named like oracle material.
// When no workspaceDir is given it makes a new temp directory. An existing workspaceDir must be empty.
function prepareWorkspace(publicDir, options) {
  const settings = options || {};
  const log = loggerOf(settings);
  const listing = listFiles(publicDir);
  if (!listing.ok) {
    log("error", "oracle.workspace", { reason: listing.reason });
    return { ok: false, reason: "public task directory could not be read" };
  }
  const included = listing.files.filter((file) => {
    const top = file.relative.split("/")[0];
    return WITHHELD_PUBLIC_NAMES.indexOf(top) === -1 && !hasOracleSegment(file.relative);
  });
  let workspaceDir = settings.workspaceDir;
  try {
    if (workspaceDir) {
      if (fs.existsSync(workspaceDir) && fs.readdirSync(workspaceDir).length > 0) {
        return { ok: false, reason: "workspace directory is not empty" };
      }
      fs.mkdirSync(workspaceDir, { recursive: true });
    } else {
      workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-harness-workspace-"));
    }
    copyFiles(included, workspaceDir);
  } catch (error) {
    log("error", "oracle.workspace", { reason: "workspace could not be prepared" });
    return { ok: false, reason: "workspace could not be prepared" };
  }
  const files = included.filter((file) => !file.symlink).map((file) => file.relative);
  log("info", "oracle.workspace", { workspaceDir, fileCount: files.length });
  return { ok: true, workspaceDir, files };
}

function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function realPathOrNull(target) {
  try {
    return fs.realpathSync(target);
  } catch (error) {
    return null;
  }
}

// [FR-260] leakCheck(workspaceDir, oracleDirs) compares the workspace with the oracle directories, by file hash and by
// link target. A workspace file whose content matches an oracle file, a link that resolves into an oracle directory,
// or a path under a directory named like oracle material is a leak. The result names each leaked path, relative to the
// workspace, and sets abort so the caller stops the run. A directory that cannot be read also aborts: the check fails
// closed. Empty files are skipped because an empty file holds no oracle content.
function leakCheck(workspaceDir, oracleDirs, options) {
  const log = loggerOf(options);
  const workspace = listFiles(workspaceDir);
  if (!workspace.ok) {
    return { ok: false, abort: true, leakedPath: null, leakedPaths: [], reason: "workspace could not be read" };
  }
  const oracleRoots = [];
  const oracleHashes = {};
  const dirs = Array.isArray(oracleDirs) ? oracleDirs : [];
  for (let index = 0; index < dirs.length; index += 1) {
    const listing = listFiles(dirs[index]);
    if (!listing.ok) {
      return { ok: false, abort: true, leakedPath: null, leakedPaths: [], reason: "oracle files could not be listed" };
    }
    const root = realPathOrNull(dirs[index]);
    if (root) {
      oracleRoots.push(root);
    }
    try {
      listing.files.forEach((file) => {
        if (!file.symlink && fs.statSync(file.absolute).size > 0) {
          oracleHashes[sha256(file.absolute)] = true;
        }
      });
    } catch (error) {
      return { ok: false, abort: true, leakedPath: null, leakedPaths: [], reason: "oracle files could not be listed" };
    }
  }
  const leaked = [];
  try {
    workspace.files.forEach((file) => {
      const resolved = realPathOrNull(file.absolute);
      const linksIntoOracle = file.symlink && resolved !== null && oracleRoots.some((root) => resolved === root || isInside(resolved, root));
      const stat = resolved === null ? null : fs.statSync(resolved);
      const sameContent = stat !== null && stat.isFile() && stat.size > 0 && oracleHashes[sha256(resolved)] === true;
      if (linksIntoOracle || sameContent || hasOracleSegment(file.relative)) {
        leaked.push(file.relative);
      }
    });
  } catch (error) {
    return { ok: false, abort: true, leakedPath: null, leakedPaths: [], reason: "workspace could not be read" };
  }
  if (leaked.length > 0) {
    log("error", "oracle.leak", { leakedPaths: leaked });
    return { ok: false, abort: true, leakedPath: leaked[0], leakedPaths: leaked, reason: "oracle file found in the workspace: " + leaked[0] };
  }
  return { ok: true, abort: false, leakedPath: null, leakedPaths: [], reason: null };
}

module.exports = {
  resolveOracle,
  lookupCase,
  admitReference,
  runHiddenSuite,
  prepareWorkspace,
  leakCheck,
  listFiles,
  loggerOf,
  ORACLE_DIR_NAMES,
  ORACLE_DIR_REFERENCE,
  ORACLE_DIR_HIDDEN,
  SUITES,
};
