// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-221|NFR-026|NFR-031] Gate evidence: what the gate-evidence hook (impl/gate-evidence.js) records for a test,
// coverage, or in-plugin scanner command. Pure and dependency-free: no I/O, no require. Spec: specs/spec-orchestration-review-gates.md
// (Change Log 2026-11-06, Requirement 14); task plan Step 17.
//
// Events. The hook reads two Claude Code events for the Bash tool, and only these fields of them:
//   - PostToolUse: tool_name, tool_input.command, tool_response.{stdout, stderr, interrupted, backgroundTaskId}, tool_use_id.
//     The event fires only when the command succeeded and its payload carries no exit code, so a success event is read
//     as exit 0. An interrupted or backgrounded command has no known exit status and yields no record.
//   - PostToolUseFailure: tool_name, tool_input.command, error, is_interrupt, tool_use_id. The exit status is the N of the
//     "Exit code N" that begins `error`; an `error` that does not begin that way (a timeout, an abort) yields no record.
//
// What is recorded. analyze() returns plain data for an allowlisted command and null for any other:
//   {tool_event, gate_kind, gate_command, exit_code, value?, parser?}
// gate_command is the allowlist's own fixed identifier for the command (for example "npm run test:coverage"), never the
// text the caller typed, so arguments, environment values, and paths never reach the log [NFR-031]. value is a coverage
// percentage parsed from the output, a number only; no output text is kept. The key names avoid the words that
// lib/audit-chain.js refuses as content (command, output, message, and similar).
//
// Allowlist. A command is judged only when it is one simple command made of letters, digits, and `_@%+=:,./ -`, so
// quotes, `$`, globs, substitutions, redirections (except a trailing `2>&1`), pipes, and chains never match: the exit
// status of a pipeline or chain is not the exit status of its test runner. Leading NAME=value words are dropped.
// Limit, stated and not closed: a hook sees that an allowlisted command ran and how it ended, not that the project's own
// test script tests anything. The evidence is a fact about the run, and the reviewer reads what the run covered.
// ES2015 syntax only (the launcher gate runs first); no dependencies.
"use strict";

const SUCCESS_EVENT = "PostToolUse";
const FAILURE_EVENT = "PostToolUseFailure";
const KIND_TEST = "test";
const KIND_SCANNER = "scanner";

const MAX_COMMAND_CHARS = 300;
// The output tail searched for a coverage figure: summaries print last, and a bound keeps the parse cheap.
const MAX_OUTPUT_CHARS = 200000;
const SAFE_COMMAND = /^[A-Za-z0-9_@%+=:,./ -]+$/;
const TRAILING_MERGE = /\s+2>&1$/;
const ENV_WORD = /^[A-Za-z_][A-Za-z0-9_]{0,40}=[A-Za-z0-9_@%+=:,./-]{0,100}$/;
const MAX_ENV_WORDS = 5;
const EXIT_STATUS = /^\s*Exit code (\d{1,3})(?!\d)/;

const NODE_PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"];
const NODE_TEST_SCRIPTS = ["test", "test:coverage", "test:cov", "test:ci", "coverage", "cover"];
const NODE_TEST_RUNNERS = ["jest", "vitest"];
const MAKE_TARGETS = ["test", "coverage", "cover", "check", "test-coverage"];
const SCANNER_SCRIPTS = ["check-fsa-tables.js", "sync-writing-standard.js"];

function entry(id, kind) {
  return { id, kind };
}

function isFlag(token) {
  return token.length > 2 && token.slice(0, 2) === "--";
}

// The index of the first token after consecutive `--flag` words that start at `index`.
function skipFlags(tokens, index) {
  let i = index;
  while (i < tokens.length && isFlag(tokens[i])) i++;
  return i;
}

function matchNode(tokens) {
  const first = tokens[0];
  if (NODE_PACKAGE_MANAGERS.indexOf(first) !== -1) {
    const second = tokens[1];
    if (second === "test" || (first === "npm" && second === "t")) return entry(first + " test", KIND_TEST);
    if (second === "run" && NODE_TEST_SCRIPTS.indexOf(tokens[2]) !== -1) return entry(first + " run " + tokens[2], KIND_TEST);
    // pnpm and yarn run a package script without `run`.
    if ((first === "pnpm" || first === "yarn") && NODE_TEST_SCRIPTS.indexOf(second) !== -1) return entry(first + " " + second, KIND_TEST);
    if (first === "pnpm" && (second === "exec" || second === "dlx") && NODE_TEST_RUNNERS.indexOf(tokens[2]) !== -1) return entry(tokens[2], KIND_TEST);
    return null;
  }
  if (first === "npx") {
    const runner = tokens[1] === "--no-install" || tokens[1] === "--yes" ? tokens[2] : tokens[1];
    return NODE_TEST_RUNNERS.indexOf(runner) !== -1 ? entry(runner, KIND_TEST) : null;
  }
  if (NODE_TEST_RUNNERS.indexOf(first) !== -1) return entry(first, KIND_TEST);
  if (first === "node") {
    // `node [--flags] --test [files]`, the built-in runner; its --experimental-test-coverage flag prints a coverage table.
    for (let i = 1; i < tokens.length && isFlag(tokens[i]); i++) {
      if (tokens[i] === "--test") return entry("node --test", KIND_TEST);
    }
  }
  return null;
}

function matchPython(tokens) {
  const first = tokens[0];
  if (first === "pytest") return entry("pytest", KIND_TEST);
  if ((first === "python" || first === "python3") && tokens[1] === "-m" && tokens[2] === "pytest") return entry("pytest", KIND_TEST);
  if (first === "uv" && tokens[1] === "run") {
    const rest = skipFlags(tokens, 2);
    if (tokens[rest] === "pytest") return entry("pytest", KIND_TEST);
    if ((tokens[rest] === "python" || tokens[rest] === "python3") && tokens[rest + 1] === "-m" && tokens[rest + 2] === "pytest") return entry("pytest", KIND_TEST);
    return null;
  }
  if (first === "coverage" && tokens[1] === "report") return entry("coverage report", KIND_TEST);
  return null;
}

function matchOther(tokens) {
  const first = tokens[0];
  if (first === "go" && tokens[1] === "test") return entry("go test", KIND_TEST);
  if (first === "go" && tokens[1] === "tool" && tokens[2] === "cover") return entry("go tool cover", KIND_TEST);
  if (first === "cargo" && (tokens[1] === "test" || tokens[1] === "tarpaulin" || tokens[1] === "llvm-cov")) return entry("cargo " + tokens[1], KIND_TEST);
  if (first === "make" && MAKE_TARGETS.indexOf(tokens[1]) !== -1) return entry("make " + tokens[1], KIND_TEST);
  return null;
}

// The in-plugin scanners whose exit code evidences a judgement gate: `node <path>/scripts/<script> --check`.
function matchScanner(tokens) {
  if (tokens[0] !== "node" || tokens.length !== 3 || tokens[2] !== "--check") return null;
  const script = tokens[1];
  for (let i = 0; i < SCANNER_SCRIPTS.length; i++) {
    const name = SCANNER_SCRIPTS[i];
    if (script === "scripts/" + name || script.slice(-("/scripts/" + name).length) === "/scripts/" + name) return entry(name.replace(/\.js$/, "") + " --check", KIND_SCANNER);
  }
  return null;
}

// The allowlist entry {id, kind} for a Bash command, or null when the command is not on the allowlist. `id` is built from
// the allowlist's own words, never from the caller's arguments.
function classify(command) {
  if (typeof command !== "string") return null;
  let text = command.trim();
  if (text.length === 0 || text.length > MAX_COMMAND_CHARS) return null;
  text = text.replace(TRAILING_MERGE, "");
  if (!SAFE_COMMAND.test(text)) return null;
  const tokens = text.split(/\s+/);
  let skipped = 0;
  while (skipped < tokens.length && ENV_WORD.test(tokens[skipped])) skipped++;
  if (skipped > MAX_ENV_WORDS) return null;
  const words = tokens.slice(skipped);
  if (words.length === 0) return null;
  return matchScanner(words) || matchNode(words) || matchPython(words) || matchOther(words);
}

// The N of an `error` that begins "Exit code N" (a PostToolUseFailure event of the Bash tool), else null. "Exit code 0" is
// null too: a failure event that carries a passing exit contradicts itself, so it yields no record rather than a false pass.
function parseExitStatus(error) {
  if (typeof error !== "string") return null;
  const match = EXIT_STATUS.exec(error);
  if (!match) return null;
  const status = parseInt(match[1], 10);
  return status >= 1 && status <= 255 ? status : null;
}

// ---- Coverage parsers --------------------------------------------------------------------------------------------
// Each parser returns a percentage (a number from 0 to 100) or null. The first parser that finds one decides.

function percent(text) {
  const value = parseFloat(text);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value * 100) / 100 : null;
}

function splitColumns(line) {
  return line.split("|").map((cell) => cell.trim());
}

// c8 and Istanbul/nyc text table: `File | % Stmts | % Branch | % Funcs | % Lines | ...` and an `All files | ...` row.
function parseCoverageTable(text) {
  const row = /^[ \t]*All files[ \t]*\|[^\n]*$/m.exec(text);
  if (!row) return null;
  const header = /^[^\n]*%[ \t]*Lines[^\n]*\|[^\n]*$/m.exec(text);
  let column = 4;
  if (header) {
    const index = splitColumns(header[0]).findIndex((cell) => /^%\s*Lines$/i.test(cell));
    if (index > 0) column = index;
  }
  return percent(splitColumns(row[0])[column]);
}

// Node's built-in runner (--experimental-test-coverage): `# all files | 82.50 | 70.00 | 90.00 |`, line percentage first.
function parseNodeTest(text) {
  const match = /^[ \t]*#[ \t]*all files[ \t]*\|[ \t]*([0-9.]+)[ \t]*\|/im.exec(text);
  return match ? percent(match[1]) : null;
}

// Jest, Vitest, and Istanbul text-summary: `Lines        : 82.5% ( 33/40 )`.
function parseSummaryLines(text) {
  const match = /^[ \t]*Lines[ \t]*:[ \t]*([0-9.]+)%/im.exec(text);
  return match ? percent(match[1]) : null;
}

// coverage.py and pytest-cov: `TOTAL    120     20    83%` (the percentage ends the row).
function parseTotalRow(text) {
  const match = /^TOTAL\b[^\n]*?([0-9]{1,3}(?:\.[0-9]+)?)%[ \t]*$/m.exec(text);
  return match ? percent(match[1]) : null;
}

// go tool cover -func: `total:    (statements)    82.5%`.
function parseGoTotal(text) {
  const match = /^total:[ \t]+\(statements\)[ \t]+([0-9.]+)%/m.exec(text);
  return match ? percent(match[1]) : null;
}

// go test -cover: `coverage: 82.5% of statements` once per package; the lowest one decides, so a weak package shows.
function parseGoPackages(text) {
  const pattern = /coverage:[ \t]+([0-9.]+)% of statements/g;
  let lowest = null;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const value = percent(match[1]);
    if (value !== null && (lowest === null || value < lowest)) lowest = value;
  }
  return lowest;
}

// cargo tarpaulin: `82.50% coverage, 33/40 lines covered`.
function parseTarpaulin(text) {
  const match = /^[ \t]*([0-9.]+)% coverage,/m.exec(text);
  return match ? percent(match[1]) : null;
}

const COVERAGE_PARSERS = [
  { id: "coverage-table", parse: parseCoverageTable },
  { id: "node-test", parse: parseNodeTest },
  { id: "summary-lines", parse: parseSummaryLines },
  { id: "total-row", parse: parseTotalRow },
  { id: "go-total", parse: parseGoTotal },
  { id: "go-packages", parse: parseGoPackages },
  { id: "tarpaulin", parse: parseTarpaulin },
];

// {value, parser} for the first coverage figure found in the output text, else null. Only the number leaves this function.
function parseCoverage(output) {
  if (typeof output !== "string" || output.length === 0) return null;
  const text = output.length > MAX_OUTPUT_CHARS ? output.slice(output.length - MAX_OUTPUT_CHARS) : output;
  for (let i = 0; i < COVERAGE_PARSERS.length; i++) {
    const value = COVERAGE_PARSERS[i].parse(text);
    if (value !== null) return { value, parser: COVERAGE_PARSERS[i].id };
  }
  return null;
}

// ---- Event reading -----------------------------------------------------------------------------------------------

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// The command's output as a PostToolUse event carries it: stdout and stderr of tool_response (a plain string in an older
// shape). Returns "" for anything else.
function successOutput(response) {
  if (typeof response === "string") return response;
  if (!isObject(response)) return "";
  return [response.stdout, response.stderr].filter((part) => typeof part === "string").join("\n");
}

// The output part of a PostToolUseFailure `error`: the text after its first line.
function failureOutput(error) {
  const text = typeof error === "string" ? error : "";
  const newline = text.indexOf("\n");
  return newline === -1 ? "" : text.slice(newline + 1);
}

// True when the success event describes a command whose exit status is unknown: interrupted, or still running as a
// background task.
function exitUnknown(response) {
  if (!isObject(response)) return false;
  return response.interrupted === true || (typeof response.backgroundTaskId === "string" && response.backgroundTaskId.length > 0);
}

// The evidence for one Bash event, or null when the event is not one this hook records (another tool or event, a command
// off the allowlist, or an exit status that cannot be known). Plain data only.
function analyze(input) {
  if (!isObject(input) || input.tool_name !== "Bash") return null;
  const eventName = input.hook_event_name;
  if (eventName !== SUCCESS_EVENT && eventName !== FAILURE_EVENT) return null;
  const match = classify(isObject(input.tool_input) ? input.tool_input.command : null);
  if (match === null) return null;
  let exitCode;
  let output;
  if (eventName === SUCCESS_EVENT) {
    if (exitUnknown(input.tool_response)) return null;
    exitCode = 0;
    output = successOutput(input.tool_response);
  } else {
    if (input.is_interrupt === true) return null;
    exitCode = parseExitStatus(input.error);
    if (exitCode === null) return null;
    output = failureOutput(input.error);
  }
  const result = { tool_event: eventName, gate_kind: match.kind, gate_command: match.id, exit_code: exitCode };
  const coverage = parseCoverage(output);
  if (coverage !== null) {
    result.value = coverage.value;
    result.parser = coverage.parser;
  }
  return result;
}

module.exports = {
  SUCCESS_EVENT,
  FAILURE_EVENT,
  KIND_TEST,
  KIND_SCANNER,
  classify,
  parseExitStatus,
  parseCoverage,
  analyze,
};
