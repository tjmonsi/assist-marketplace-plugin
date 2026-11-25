// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-250|FR-273|FR-274] Benchmark scoreboard section of scripts/release-check.js, the seventh section after agent-hygiene.
//
// A DEFAULT run (no benchmark request) reads the stored scoreboard (evals/scoreboard.json), prints its latest rows as detail
// lines, and returns "clean". It starts no suite. With no stored scoreboard it prints that none is stored, returns "clean",
// and starts no suite (ASM-2, D-15). A default run is informational and reports no finding, so the exit-code precedence of
// release-check.js is unchanged.
//
// A benchmark request (`release-check.js --benchmark`, ASM-5) starts the Group A harness entry, eval-harness/run-benchmark.js,
// and no second runner. The section returns "finding" when the harness reports a finding (a regression beyond the configured
// margin, or an oracle path in the package) or when the completed run left no scoreboard row for the version it recorded
// (FR-276), and "error" with a fixed reason for an operational failure. It never prints a child process's stderr.
//
// check(root, { benchmark, harnessEntry, scoreboardPath }) -> { outcome, details }. `harnessEntry` and `scoreboardPath` name
// the harness entry script and the scoreboard file; both default to the files that sit beside this script's own folder, and a
// caller (a test) may replace them.
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const scoreboardModule = require(path.join(__dirname, "..", "eval-harness", "scoreboard.js"));

const OUTCOME_CLEAN = "clean";
const OUTCOME_FINDING = "finding";
const OUTCOME_ERROR = "error";

const DEFAULT_HARNESS_ENTRY = path.join(__dirname, "..", "eval-harness", "run-benchmark.js");

// A full benchmark run is slow and costs money (estimated $25 to $75), so its limit is far above the 3 minutes of a script
// section.
const BENCHMARK_TIMEOUT_MS = 4 * 60 * 60 * 1000;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

const VERSION_LINE = /^benchmark-version: (\S+)$/;
const SUITES_LINE = /^benchmark-suites: (\S+)$/;
const ERROR_LINE = /^error: /;

// Fixed reasons printed for an error outcome. Never raw stderr.
const REASON_NOT_STARTED = "benchmark harness could not start";
const REASON_TIMED_OUT = "benchmark harness timed out";
const REASON_SIGNAL = "benchmark harness terminated by signal";
const REASON_FAILED = "benchmark harness failed";
const REASON_NO_VERSION = "benchmark run reported no version";
const REASON_SCOREBOARD = "benchmark scoreboard could not be read";
const NONE_STORED = "no benchmark scoreboard is stored";

function outputLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
}

// [FR-250] Default run: report the stored scoreboard and start nothing.
function reportStored(scoreboardPath) {
  const stored = scoreboardModule.readScoreboard(scoreboardPath);
  if (!stored.ok) {
    return { outcome: OUTCOME_ERROR, details: [REASON_SCOREBOARD] };
  }
  const rows = scoreboardModule.latestRows(stored.scoreboard);
  if (!stored.exists || rows.length === 0) {
    return { outcome: OUTCOME_CLEAN, details: [NONE_STORED] };
  }
  return { outcome: OUTCOME_CLEAN, details: rows.map(scoreboardModule.describeRow) };
}

// [FR-276] After a completed run, the scoreboard holds a row for the recorded version in every suite the run reported. A
// missing row is a finding that names the version.
function verifyRows(lines, scoreboardPath) {
  const versionLine = lines.map((line) => VERSION_LINE.exec(line)).find(Boolean);
  const suitesLine = lines.map((line) => SUITES_LINE.exec(line)).find(Boolean);
  if (!versionLine || !suitesLine || !scoreboardModule.VERSION_PATTERN.test(versionLine[1])) {
    return { outcome: OUTCOME_ERROR, details: [REASON_NO_VERSION] };
  }
  const stored = scoreboardModule.readScoreboard(scoreboardPath);
  if (!stored.ok) {
    return { outcome: OUTCOME_ERROR, details: [REASON_SCOREBOARD] };
  }
  const suites = suitesLine[1].split(",").filter((suite) => scoreboardModule.SUITES.indexOf(suite) !== -1);
  const rows = scoreboardModule.checkRowsPresent(stored.scoreboard, versionLine[1], suites);
  if (!rows.ok) {
    return { outcome: OUTCOME_FINDING, details: lines.concat(rows.findings) };
  }
  return { outcome: OUTCOME_CLEAN, details: lines };
}

// [FR-274] A requested run starts the Group A harness entry, and no other runner.
function runRequested(root, harnessEntry, scoreboardPath, customScoreboard) {
  if (!fs.existsSync(harnessEntry)) {
    return { outcome: OUTCOME_ERROR, details: [REASON_NOT_STARTED] };
  }
  // The harness entry writes the scoreboard the section then reads, so both name the same file.
  const args = [harnessEntry, "--root", root].concat(customScoreboard ? ["--scoreboard", scoreboardPath] : []);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: BENCHMARK_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  if (result.error) {
    return { outcome: OUTCOME_ERROR, details: [result.error.code === "ETIMEDOUT" ? REASON_TIMED_OUT : REASON_NOT_STARTED] };
  }
  if (result.signal) {
    return { outcome: OUTCOME_ERROR, details: [REASON_SIGNAL] };
  }
  const lines = outputLines(result.stdout);
  if (result.status === 0) {
    return verifyRows(lines, scoreboardPath);
  }
  if (result.status === 1) {
    return { outcome: OUTCOME_FINDING, details: lines };
  }
  // The harness prints its own fixed "error: <reason>" lines on stdout; nothing of a child's stderr is passed on.
  return { outcome: OUTCOME_ERROR, details: [REASON_FAILED + " (exit status " + result.status + ")"].concat(lines.filter((line) => ERROR_LINE.test(line))) };
}

// check(root, options) -> { outcome, details }.
function check(root, options) {
  const settings = options || {};
  const customScoreboard = typeof settings.scoreboardPath === "string";
  const scoreboardPath = customScoreboard ? settings.scoreboardPath : scoreboardModule.DEFAULT_SCOREBOARD_PATH;
  if (settings.benchmark === true) {
    return runRequested(root, typeof settings.harnessEntry === "string" ? settings.harnessEntry : DEFAULT_HARNESS_ENTRY, scoreboardPath, customScoreboard);
  }
  return reportStored(scoreboardPath);
}

module.exports = { check, DEFAULT_HARNESS_ENTRY };
