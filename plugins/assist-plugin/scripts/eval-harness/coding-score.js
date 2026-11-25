// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Coding grader for the evaluation benchmark harness (Group A). After the agent run ends, it copies the hidden suite from
// the private oracle location into a grading directory OUTSIDE the agent workspace, runs the suite with Node --test, and
// reads the exit code: 0 is "pass", non-zero is "fail". The scoring makes no model call.
//
// Four states, and only these four:
//   pass      the hidden suite exited 0
//   fail      the hidden suite exited non-zero
//   not-run   the sandbox backend the run's shell grant needs is unavailable; the run counts in neither c nor k
//   error     the oracle is unreadable, or the suite could not start or finish; the run counts in neither c nor k
//
// The grader never skips and never retries a test. It records one entry per test result (name and status) so the
// aggregation step can flag a test that gives different results across repeated runs of one candidate. Test names come
// from the hidden suite, so a caller keeps them in the git-ignored run result and never writes them to a log or to the
// scoreboard (NFR-039). This module logs paths and identifiers only.
//
// Sandbox detection (ASM-7a, confirm in B3): how the runner signals a missing sandbox backend is not documented in this
// repository. The signal sits behind the adapter `sandboxProbe(run)`. The default adapter reads two fields of the run
// record: `needsShellGrant === true` and `sandboxAvailable === false` together mean unavailable.
//
// Result: { suite, caseId, status, exitCode, reason, tests, testsParsed }. A reason is fixed text and never holds raw
// stderr or suite output. `tests` is [{ name, status }] with status "pass", "fail", "skip", or "todo".
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const oracleModule = require("./oracle.js");

const STATUS_PASS = "pass";
const STATUS_FAIL = "fail";
const STATUS_NOT_RUN = "not-run";
const STATUS_ERROR = "error";

// [FR-256] The same file pattern the task validator reads test names from, so both steps see the same suite.
const HIDDEN_TEST_FILE = /\.test\.(?:js|mjs|cjs)$/;

const SUITE_TIMEOUT_MS = 120 * 1000;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const TAP_INDENT = 4;

// A grading process receives a small environment. The solution under test is agent-written code, so it must not see the
// credentials of the session that grades it.
const ENV_KEYS = ["PATH", "SystemRoot", "TMPDIR", "TEMP", "TMP"];

function gradingEnvironment() {
  const env = { NODE_ENV: "test" };
  ENV_KEYS.forEach((key) => {
    if (typeof process.env[key] === "string") {
      env[key] = process.env[key];
    }
  });
  return env;
}

function outcome(settings, status, reason, extra) {
  return Object.assign(
    { suite: settings.suite || null, caseId: settings.caseId || null, status, exitCode: null, reason, tests: [], testsParsed: false },
    extra || {}
  );
}

// [FR-264] Default sandbox adapter (ASM-7a). Returns true when the backend the run needs is available.
function defaultSandboxProbe(run) {
  return !(run && run.needsShellGrant === true && run.sandboxAvailable === false);
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

function realPathOrNull(target) {
  try {
    return fs.realpathSync(target);
  } catch (error) {
    return null;
  }
}

function isInsideOrSame(child, parent) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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

function removeQuietly(directory) {
  if (!directory) {
    return;
  }
  try {
    fs.rmSync(directory, { recursive: true, force: true });
  } catch (error) {
    // A leftover grading directory holds copies of the candidate and of the hidden suite, both outside the repository.
  }
}

// [FR-287] Reads the TAP stream of `node --test` into one entry per test result, nested tests named "parent > child".
// Returns null when the text holds no TAP header, so the caller can tell "no tests" from "not parsed". Diagnostic blocks
// between "---" and "..." are skipped so a message line cannot pass for a result.
function parseTapResults(text) {
  if (typeof text !== "string" || !/^TAP version \d+/m.test(text)) {
    return null;
  }
  const results = [];
  const stack = [];
  let inDiagnostic = false;
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (inDiagnostic) {
      inDiagnostic = trimmed !== "...";
      return;
    }
    if (trimmed === "---") {
      inDiagnostic = true;
      return;
    }
    const indent = line.length - line.replace(/^ +/, "").length;
    if (indent % TAP_INDENT !== 0) {
      return;
    }
    const level = indent / TAP_INDENT;
    const subtest = /^# Subtest: (.*)$/.exec(line.slice(indent));
    if (subtest) {
      stack.length = level;
      stack[level] = subtest[1];
      return;
    }
    const entry = /^(not ok|ok) \d+ - (.*)$/.exec(line.slice(indent));
    if (!entry) {
      return;
    }
    let status = entry[1] === "ok" ? STATUS_PASS : STATUS_FAIL;
    if (status === STATUS_PASS && /\s#\s*SKIP\b/i.test(entry[2])) {
      status = "skip";
    } else if (status === STATUS_PASS && /\s#\s*TODO\b/i.test(entry[2])) {
      status = "todo";
    }
    const names = stack.slice(0, level);
    names.push(typeof stack[level] === "string" ? stack[level] : entry[2]);
    results.push({ name: names.join(" > "), status });
    stack.length = level;
  });
  return results;
}

// [FR-262] scoreCodingRun(request) grades one finished coding run.
//   request.suite, request.caseId   the case, as in the oracle layout
//   request.oracle                  the result of resolveOracle(), already checked by the caller
//   request.workspaceDir            the agent workspace after the run ended; read only, never written
//   request.run                     the runner's record of the run, read by the sandbox adapter
//   request.sandboxProbe            optional adapter (run) => boolean; default reads the run record (ASM-7a)
//   request.gradingRoot             optional directory to create the grading directory in; default is the OS temp folder
//   request.timeoutMs, request.logger   optional
function scoreCodingRun(request) {
  const settings = request || {};
  const log = oracleModule.loggerOf(settings);
  const probe = typeof settings.sandboxProbe === "function" ? settings.sandboxProbe : defaultSandboxProbe;

  // [FR-264] Sandbox first: a run that could not get its backend is not-run and is never read as a pass or a fail.
  let available;
  try {
    available = probe(settings.run);
  } catch (error) {
    log("error", "coding-score.sandbox", { suite: settings.suite, caseId: settings.caseId, reason: "sandbox check failed" });
    return outcome(settings, STATUS_ERROR, "sandbox backend check failed");
  }
  if (available === false) {
    log("warn", "coding-score.run", { suite: settings.suite, caseId: settings.caseId, status: STATUS_NOT_RUN });
    return outcome(settings, STATUS_NOT_RUN, "sandbox backend is unavailable");
  }

  if (typeof settings.workspaceDir !== "string" || !isReadableDirectory(settings.workspaceDir)) {
    return outcome(settings, STATUS_ERROR, "agent workspace could not be read");
  }

  // [FR-260|FR-261] The oracle comes from the private location. An unreadable location reads error, never fail.
  const found = oracleModule.lookupCase(settings.oracle, settings.suite, settings.caseId);
  if (!found.ok) {
    log("error", "coding-score.oracle", { suite: settings.suite, caseId: settings.caseId, code: found.code, location: found.location });
    return outcome(settings, STATUS_ERROR, found.message);
  }
  if (!found.hiddenDir) {
    return outcome(settings, STATUS_ERROR, "missing hidden test suite");
  }

  const solution = oracleModule.listFiles(settings.workspaceDir);
  const hidden = oracleModule.listFiles(found.hiddenDir);
  if (!solution.ok || !hidden.ok) {
    return outcome(settings, STATUS_ERROR, "files could not be read");
  }
  const testFiles = hidden.files.filter((file) => !file.symlink && HIDDEN_TEST_FILE.test(file.relative)).map((file) => file.relative);
  if (testFiles.length === 0) {
    return outcome(settings, STATUS_ERROR, "hidden test suite holds no test file");
  }

  let gradingDir = null;
  try {
    // [FR-260] The grading directory is created outside the agent workspace, and only after the agent run has ended.
    const root = typeof settings.gradingRoot === "string" ? settings.gradingRoot : os.tmpdir();
    const realWorkspace = realPathOrNull(settings.workspaceDir);
    const realRoot = realPathOrNull(root);
    if (realWorkspace === null || realRoot === null || isInsideOrSame(realRoot, realWorkspace)) {
      return outcome(settings, STATUS_ERROR, "grading directory must sit outside the agent workspace");
    }
    gradingDir = fs.mkdtempSync(path.join(realRoot, "eval-harness-grade-"));
    copyFiles(solution.files, gradingDir);
    copyFiles(hidden.files, gradingDir);

    // Only the hidden test files are named, so a test file the agent wrote cannot change the exit code. The "./" prefix
    // keeps a file name from reading as an option.
    const args = ["--test", "--test-reporter=tap"].concat(testFiles.map((file) => "./" + file));
    const result = spawnSync(process.execPath, args, {
      cwd: gradingDir,
      env: gradingEnvironment(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: settings.timeoutMs || SUITE_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
    });
    if (result.error) {
      const reason = result.error.code === "ETIMEDOUT" ? "hidden suite timed out" : result.error.code === "ENOBUFS" ? "hidden suite output was too large" : "hidden suite could not start";
      log("error", "coding-score.run", { suite: settings.suite, caseId: settings.caseId, status: STATUS_ERROR, reason });
      return outcome(settings, STATUS_ERROR, reason);
    }
    if (result.signal || typeof result.status !== "number") {
      log("error", "coding-score.run", { suite: settings.suite, caseId: settings.caseId, status: STATUS_ERROR, reason: "terminated" });
      return outcome(settings, STATUS_ERROR, "hidden suite was terminated");
    }
    // [FR-262] The exit code is the whole score: 0 reads pass, anything else reads fail.
    const status = result.status === 0 ? STATUS_PASS : STATUS_FAIL;
    const tests = parseTapResults(result.stdout);
    log(status === STATUS_PASS ? "info" : "warn", "coding-score.run", { suite: settings.suite, caseId: settings.caseId, status, exitCode: result.status });
    return outcome(settings, status, null, { exitCode: result.status, tests: tests || [], testsParsed: tests !== null });
  } catch (error) {
    log("error", "coding-score.run", { suite: settings.suite, caseId: settings.caseId, status: STATUS_ERROR, reason: "grading failed" });
    return outcome(settings, STATUS_ERROR, "hidden suite could not run");
  } finally {
    removeQuietly(gradingDir);
  }
}

module.exports = {
  scoreCodingRun,
  parseTapResults,
  defaultSandboxProbe,
  STATUS_PASS,
  STATUS_FAIL,
  STATUS_NOT_RUN,
  STATUS_ERROR,
};
