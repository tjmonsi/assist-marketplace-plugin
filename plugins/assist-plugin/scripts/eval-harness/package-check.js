#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-261|NFR-039] Published-package oracle-path check for the evaluation benchmark harness (Group A). It takes the list of
// files in a published plugin package and fails when any path sits under a directory the harness uses for oracle
// material in the private layout ("reference" and "hidden", see oracle.js). It names each offending path. It reads only
// paths, never file content, and a default release-check run does not call it.
//
// Usage:
//   node scripts/eval-harness/package-check.js [--list FILE]
// The list holds one path per line, from FILE or from stdin when --list is not given.
//
// Output: "clean" when the package holds no oracle path, else one "oracle path in package: <path>" line per offending path.
// Exit codes: 0 clean, 1 at least one offending path, 2 an operational error (an unknown flag or an unreadable list).
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");

const { ORACLE_DIR_NAMES } = require("./oracle.js");

const EXIT_CLEAN = 0;
const EXIT_FINDING = 1;
const EXIT_ERROR = 2;

const MAX_LIST_BYTES = 16 * 1024 * 1024;
const USAGE = "Usage: node scripts/eval-harness/package-check.js [--list FILE]";

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

function normalize(entry) {
  return entry.trim().replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
}

// A path is oracle material when a directory in it is named like the private layout. The file name is not a directory,
// so a file called "reference" does not count; a listed directory (a trailing slash) does.
function oracleDirectoryIn(normalized) {
  const segments = normalized.split("/").filter((segment) => segment !== "");
  const directories = normalized.endsWith("/") ? segments : segments.slice(0, -1);
  return directories.some((segment) => ORACLE_DIR_NAMES.indexOf(segment.toLowerCase()) !== -1);
}

// [FR-261] checkPackageFiles(files) returns { ok, offending, error }. `offending` lists each oracle path found, in list
// order. `error` is a fixed reason when the list is not a list of paths, and then ok is false and nothing was judged.
function checkPackageFiles(files) {
  if (!Array.isArray(files) || files.some((entry) => typeof entry !== "string")) {
    return { ok: false, offending: [], error: "package list must be a list of path strings" };
  }
  const offending = files
    .map(normalize)
    .filter((entry) => entry !== "" && oracleDirectoryIn(entry));
  return { ok: offending.length === 0, offending, error: null };
}

function parseArgs(argv) {
  const options = { list: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--list") {
      i += 1;
      if (i >= argv.length || argv[i] === "") {
        throw new UsageError("--list needs a file");
      }
      options.list = path.resolve(argv[i]);
    } else {
      throw new UsageError("unknown argument " + JSON.stringify(argv[i]));
    }
  }
  return options;
}

function readList(listPath) {
  let text;
  try {
    if (listPath !== null && fs.statSync(listPath).size > MAX_LIST_BYTES) {
      throw new Error("too large");
    }
    text = fs.readFileSync(listPath === null ? 0 : listPath, "utf8");
  } catch (error) {
    throw new UsageError("package list could not be read");
  }
  if (text.length > MAX_LIST_BYTES) {
    throw new UsageError("package list could not be read");
  }
  return text.split(/\r?\n|\0/).filter((line) => line.trim() !== "");
}

function fail(error) {
  const reason = error instanceof UsageError ? error.message : "script error (" + (error && error.name ? error.name : "Error") + ")";
  console.error("package-check: " + reason);
  if (error instanceof UsageError) {
    console.error(USAGE);
  }
  process.exitCode = EXIT_ERROR;
}

function main(argv) {
  try {
    const result = checkPackageFiles(readList(parseArgs(argv).list));
    if (result.ok) {
      console.log("clean");
      process.exitCode = EXIT_CLEAN;
      return;
    }
    result.offending.forEach((entry) => console.log("oracle path in package: " + entry));
    process.exitCode = EXIT_FINDING;
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

module.exports = { checkPackageFiles };
