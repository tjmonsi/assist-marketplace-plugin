// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Shared by the shell guards and the injection filter: finds the program word of a split command after leading
// VAR=value words, shell keywords, wrappers (env, command, timeout, nice, nohup, stdbuf, time, and the extra
// ones a caller passes), and, when asked, package runners (npx, npm exec, pnpx, pnpm dlx, yarn dlx, bunx,
// bun x, node <path>) with their options, and in PowerShell a call operator and an opening ( or $(.
// Also exports programName (the program word reduced to a name) and stripAssignment (the leading PowerShell
// assignment of a part). Without the options runners and powershell, findProgram behaves as at 1.11.1, so
// commit-attribution-guard, which passes neither, is unchanged. Pure: no I/O.
// [FR-094|FR-198|FR-099]
"use strict";

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const DURATION = /^\d+(\.\d+)?[smhd]?$/;
// Wrappers on top of WRAPPERS that the Bash guards pass through the wrappers option (doc-cli-guard,
// injection-filter): sudo and exec with the options that take a value (as commit-attribution-guard defines
// them), and eval with none. They are not in the default WRAPPERS, so a caller that passes no wrappers option
// behaves as at 1.11.1.
const EXTRA_WRAPPERS = new Map([
  ["sudo", new Set(["-u", "-g", "-h", "-p", "-C", "-D", "-R", "-T", "-U"])],
  ["exec", new Set(["-a"])],
  ["eval", new Set()],
]);

// Shell keywords that may precede the program word (the body of a loop or a conditional).
const KEYWORDS = ["!", "if", "then", "else", "elif", "do", "while", "until", "{"];
// A PowerShell program word may start with ( or $( (a parenthesized or substituted pipeline).
const OPENING_PAREN = /^(\$?\()+/;
// A leading PowerShell assignment: $name = or $env:NAME = (env: without regard to case, spaces optional).
const LEADING_ASSIGNMENT = /^\s*\$(env:)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*/i;

// Wrappers that may precede the program. Each entry lists the options that consume a separate value.
const WRAPPERS = new Map([
  ["env", new Set(["-u", "--unset", "-C", "--chdir"])],
  ["command", new Set()],
  ["timeout", new Set(["-s", "--signal", "-k", "--kill-after"])],
  ["nice", new Set(["-n", "--adjustment"])],
  ["nohup", new Set()],
  ["stdbuf", new Set(["-i", "-o", "-e"])],
  ["time", new Set(["-f", "--format", "-o", "--output"])],
]);

// Package runners. Every word after the runner that starts with "-" is one of its options; an option listed
// here also takes the next word as its value; a long option may carry =value; "--" ends the options. The lists
// were checked at build time (1.12.0) against: npx-cli.js and "npm exec --help" of npm 11 (npx treats -p as
// --package, but npm exec reads -p as --parseable, a flag), the pnpm, Yarn, and Bun documentation (via ctx7),
// and "node --help" of Node 26. An option missing from a list is read as a flag, and its value would then be
// read as the program word.
const NPX_OPTIONS = new Set([
  "-p", "--package", "-c", "--call", "-n", "--node-arg", "--npm", "--cache", "--userconfig", "--shell",
  "--script-shell", "--registry", "--prefix", "--loglevel", "--allow-scripts",
]);
const NPM_EXEC_OPTIONS = new Set([
  "--package", "-c", "--call", "-w", "--workspace", "--cache", "--userconfig", "--script-shell", "--shell",
  "--registry", "--prefix", "--loglevel", "--allow-scripts",
]);
const PNPM_DLX_OPTIONS = new Set(["--package", "--allow-build"]);
const YARN_DLX_OPTIONS = new Set(["-p", "--package"]);
const BUN_X_OPTIONS = new Set(["-p", "--package"]);
const NODE_OPTIONS = new Set([
  "-r", "--require", "--import", "--loader", "--experimental-loader", "-C", "--conditions", "--env-file", "--env-file-if-exists",
]);

// One word is a whole runner: npx, pnpx (an alias of pnpm dlx), bunx, and node (its "argument" is the script path).
const WORD_RUNNERS = new Map([
  ["npx", NPX_OPTIONS],
  ["pnpx", PNPM_DLX_OPTIONS],
  ["bunx", BUN_X_OPTIONS],
  ["node", NODE_OPTIONS],
]);
// Two words make a runner: the package manager, then its subcommand. The package manager followed by any other
// word is a program (npm test judges npm). "npm x" is the alias of "npm exec".
const SUBCOMMAND_RUNNERS = new Map([
  ["npm", new Map([["exec", NPM_EXEC_OPTIONS], ["x", NPM_EXEC_OPTIONS]])],
  ["pnpm", new Map([["dlx", PNPM_DLX_OPTIONS]])],
  ["yarn", new Map([["dlx", YARN_DLX_OPTIONS]])],
  ["bun", new Map([["x", BUN_X_OPTIONS]])],
]);

function defaultBaseName(word) {
  return word.split("/").pop();
}

// The name of a program word: no directory part (up to the last / or \), no @version suffix (from the first @
// that is not the first character), no final .exe. With options.powershell the opening ( or $( is removed first
// and the name is lower-cased before the .exe test; in Bash the name keeps its case and only a lower-case .exe
// is removed. options (optional): {powershell: boolean}.
function programName(word, options) {
  const powershell = Boolean(options && options.powershell);
  let name = String(word);
  if (powershell) name = name.replace(OPENING_PAREN, "");
  name = name.split(/[\\/]/).pop();
  const at = name.indexOf("@", 1);
  if (at !== -1) name = name.slice(0, at);
  if (powershell) name = name.toLowerCase();
  return name.replace(/\.exe$/, "");
}

// Removes the leading PowerShell assignment ($name = or $env:NAME =, spaces optional) from a part's text.
function stripAssignment(text) {
  return String(text).replace(LEADING_ASSIGNMENT, "");
}

// Index just past the runner's options, starting at i. A word that starts with "-" is an option; an option in
// valueOptions takes the next word unless it carries =value; "--" ends the options and is skipped.
function skipRunnerOptions(words, start, valueOptions) {
  let i = start;
  while (i < words.length && words[i].charAt(0) === "-") {
    const word = words[i];
    if (word === "--") return i + 1;
    i += word.indexOf("=") === -1 && valueOptions.has(word) ? 2 : 1;
  }
  return i;
}

// {options, next} when words[i] (reduced to name) starts a package runner, else null.
function runnerAt(words, i, name, powershell) {
  const single = WORD_RUNNERS.get(name);
  if (single !== undefined) return { options: single, next: i + 1 };
  const subcommands = SUBCOMMAND_RUNNERS.get(name);
  if (subcommands !== undefined && i + 1 < words.length) {
    const sub = subcommands.get(powershell ? words[i + 1].toLowerCase() : words[i + 1]);
    if (sub !== undefined) return { options: sub, next: i + 2 };
  }
  return null;
}

// Skips VAR=value words, shell keywords, wrappers, and (with options.runners) package runners. Returns the index
// of the program word, whether an endpoint variable (a word matching options.isEndpoint, if given) was assigned
// on the way, or -1 when no program is found.
// options (all optional): {wrappers: Map of extra wrappers, keywords: words to skip, baseName: word -> name,
// isEndpoint: assignment word -> boolean, runners: boolean, powershell: boolean}. With runners or powershell,
// every wrapper and runner word is reduced with programName before it is compared (so /usr/local/bin/npx and
// npx.exe are runners) and baseName is not used. With powershell, a call operator & and an opening ( or $( are
// skipped, and keywords, wrappers, and runners are compared without regard to case.
function findProgram(words, options) {
  const opts = options || {};
  const powershell = Boolean(opts.powershell);
  const reduce = opts.runners || powershell
    ? (word) => programName(word, { powershell })
    : opts.baseName || defaultBaseName;
  const keywords = opts.keywords || [];
  const extra = opts.wrappers || new Map();
  let endpointAssigned = false;
  let i = 0;
  while (i < words.length) {
    let word = words[i];
    if (powershell) {
      if (word === "&") {
        i++;
        continue;
      }
      word = word.replace(OPENING_PAREN, "");
      if (word === "") {
        i++;
        continue;
      }
    }
    if (ENV_ASSIGNMENT.test(word)) {
      if (opts.isEndpoint && opts.isEndpoint(word)) endpointAssigned = true;
      i++;
      continue;
    }
    if (keywords.indexOf(powershell ? word.toLowerCase() : word) !== -1) {
      i++;
      continue;
    }
    const name = reduce(word);
    const wrapper = extra.get(name) || WRAPPERS.get(name);
    if (wrapper !== undefined) {
      i++;
      // Skip the wrapper's own options (and their values); a duration follows timeout's options.
      while (i < words.length && words[i].startsWith("-")) {
        if (words[i] === "--") {
          i++;
          break;
        }
        i += wrapper.has(words[i]) ? 2 : 1;
      }
      if (name === "timeout" && i < words.length && DURATION.test(words[i])) i++;
      continue;
    }
    const runner = opts.runners ? runnerAt(words, i, name, powershell) : null;
    if (runner === null) return { index: i, endpointAssigned };
    i = skipRunnerOptions(words, runner.next, runner.options);
  }
  return { index: -1, endpointAssigned };
}

module.exports = { ENV_ASSIGNMENT, EXTRA_WRAPPERS, KEYWORDS, WRAPPERS, findProgram, programName, stripAssignment };
