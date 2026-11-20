#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-250] Unified release check. It runs an ordered list of independent sections and reports each outcome on its own
// line, so one failing section never hides another. Every section runs whatever an earlier section returned.
//
// Sections, in order:
//   sync-writing-standard     scripts/sync-writing-standard.js --check
//   check-fsa-tables          scripts/check-fsa-tables.js --check
//   check-control-register    scripts/check-control-register.js --check
//   scan-staged-secrets       scripts/scan-staged-secrets.js (clean when nothing is staged) [FR-252|FR-217]
//   version-agreement         scripts/release/version-agreement.js, the six-place version check [FR-251]
//   agent-hygiene             scripts/release/agent-hygiene.js, .agent ignored, untracked, and not reopened [FR-253]
//
// Usage:
//   node scripts/release-check.js [--root DIR] [--release]
// `--root` names the repository root for the git queries and the version places (default: the current directory).
// The section scripts are always located from this script's own folder. `--release` makes the root CHANGELOG.md newest
// heading a version place that must agree [FR-251].
//
// Output: one "<clean|finding|error>: <section name>" line per section, followed by indented detail lines. A section
// script that errors prints a fixed reason, never its stderr. A secret scan finding prints the scanner's own
// "<path>: <rule>" lines and never a matched value [NFR-031].
//
// Exit codes [FR-250]: 0 every section clean, 1 at least one finding and no error, 2 at least one section error or an
// operational error in this script (an unknown flag or a root that is not a directory). Exit 2 outranks a finding.
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const versionAgreement = require(path.join(__dirname, "release", "version-agreement.js"));
const agentHygiene = require(path.join(__dirname, "release", "agent-hygiene.js"));

const OUTCOME_CLEAN = "clean";
const OUTCOME_FINDING = "finding";
const OUTCOME_ERROR = "error";

const EXIT_CLEAN = 0;
const EXIT_FINDING = 1;
const EXIT_ERROR = 2;

const SECTION_TIMEOUT_MS = 180 * 1000;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const USAGE = "Usage: node scripts/release-check.js [--root DIR] [--release]";

// Reasons printed for a section that errors. Fixed text, never raw stderr.
const REASON_NOT_STARTED = "could not start";
const REASON_TIMED_OUT = "timed out";
const REASON_SIGNAL = "terminated by signal";

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

// Section built from a script that exits 0 (clean), 1 (finding), or anything else (error) [FR-250].
function scriptSection(name, scriptPath, args) {
  return {
    name,
    run: (context) => {
      if (!fs.existsSync(scriptPath)) {
        return { outcome: OUTCOME_ERROR, details: [REASON_NOT_STARTED] };
      }
      const result = spawnSync(process.execPath, [scriptPath].concat(args || []), {
        cwd: context.root,
        encoding: "utf8",
        timeout: SECTION_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES,
      });
      if (result.error) {
        return { outcome: OUTCOME_ERROR, details: [result.error.code === "ETIMEDOUT" ? REASON_TIMED_OUT : REASON_NOT_STARTED] };
      }
      if (result.signal) {
        return { outcome: OUTCOME_ERROR, details: [REASON_SIGNAL] };
      }
      if (result.status === 0) {
        return { outcome: OUTCOME_CLEAN, details: [] };
      }
      if (result.status === 1) {
        return { outcome: OUTCOME_FINDING, details: outputLines(result.stdout) };
      }
      return { outcome: OUTCOME_ERROR, details: ["exit status " + result.status] };
    },
  };
}

function outputLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
}

function versionSection() {
  return {
    name: "version-agreement",
    run: (context) => versionAgreement.check(context.root, { release: context.release }),
  };
}

function hygieneSection() {
  return {
    name: "agent-hygiene",
    run: (context) => agentHygiene.check(context.root),
  };
}

// The real, ordered section list.
function defaultSections() {
  const script = (file) => path.join(__dirname, file);
  return [
    scriptSection("sync-writing-standard", script("sync-writing-standard.js"), ["--check"]),
    scriptSection("check-fsa-tables", script("check-fsa-tables.js"), ["--check"]),
    scriptSection("check-control-register", script("check-control-register.js"), ["--check"]),
    scriptSection("scan-staged-secrets", script("scan-staged-secrets.js"), []),
    versionSection(),
    hygieneSection(),
  ];
}

// 2 when any section errors (outranks a finding), else 1 when any section finds, else 0 [FR-250].
function exitCodeOf(outcomes) {
  const list = outcomes || [];
  if (list.some((entry) => entry.outcome === OUTCOME_ERROR)) {
    return EXIT_ERROR;
  }
  if (list.some((entry) => entry.outcome === OUTCOME_FINDING)) {
    return EXIT_FINDING;
  }
  return EXIT_CLEAN;
}

// A section that throws or returns something unusable is an error; it never stops the run.
function runSection(section, context) {
  let result;
  try {
    result = section.run(context);
  } catch (error) {
    return { name: section.name, outcome: OUTCOME_ERROR, details: [REASON_NOT_STARTED] };
  }
  const known = result && (result.outcome === OUTCOME_CLEAN || result.outcome === OUTCOME_FINDING || result.outcome === OUTCOME_ERROR);
  if (!known) {
    return { name: section.name, outcome: OUTCOME_ERROR, details: [REASON_NOT_STARTED] };
  }
  return { name: section.name, outcome: result.outcome, details: Array.isArray(result.details) ? result.details : [] };
}

function report(entry) {
  console.log(entry.outcome + ": " + entry.name);
  entry.details.forEach((line) => console.log("  " + line));
}

// run({ root, release, sections }) runs every section in order, prints each outcome, and returns
// { outcomes, exitCode }. It also sets process.exitCode to that exit code.
function run(options) {
  const settings = options || {};
  const context = { root: settings.root || process.cwd(), release: Boolean(settings.release) };
  const sections = settings.sections || defaultSections();
  const outcomes = [];
  sections.forEach((section) => {
    const entry = runSection(section, context);
    outcomes.push(entry);
    report(entry);
  });
  const exitCode = exitCodeOf(outcomes);
  process.exitCode = exitCode;
  return { outcomes, exitCode };
}

function parseArgs(argv) {
  const options = { root: process.cwd(), release: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--release") {
      options.release = true;
    } else if (arg === "--root") {
      i += 1;
      if (i >= argv.length || argv[i] === "") {
        throw new UsageError("--root needs a directory");
      }
      options.root = path.resolve(argv[i]);
    } else {
      throw new UsageError("unknown argument " + JSON.stringify(arg));
    }
  }
  let isDirectory = false;
  try {
    isDirectory = fs.statSync(options.root).isDirectory();
  } catch (error) {
    isDirectory = false;
  }
  if (!isDirectory) {
    throw new UsageError("root is not a directory");
  }
  return options;
}

function fail(error) {
  const reason = error instanceof UsageError ? error.message : "script error (" + (error && error.name ? error.name : "Error") + ")";
  console.error("release-check: " + reason);
  if (error instanceof UsageError) {
    console.error(USAGE);
  }
  process.exitCode = EXIT_ERROR;
}

function main(argv) {
  try {
    run(parseArgs(argv));
  } catch (error) {
    fail(error);
  }
}

if (require.main === module) {
  process.on("uncaughtException", (error) => {
    fail(error);
    process.exit(EXIT_ERROR);
  });
  main(process.argv.slice(2));
}

module.exports = { run, scriptSection, exitCodeOf, defaultSections };
