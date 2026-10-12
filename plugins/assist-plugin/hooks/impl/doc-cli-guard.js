// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// PreToolUse guard: guard the documentation CLIs (firecrawl, ctx7) for every agent.
// The skill allowed-tools rules use "*" wildcards, which match any characters including flags
// and shell operators, so this hook denies the dangerous forms the wildcards would let through:
//   - output/endpoint flags: any short flag cluster containing o (-o, -Xo), --output, --base-url, --api-url
//   - endpoint overrides: FIRECRAWL_API_URL=... and CONTEXT7_*URL*=... assignments
//   - shell metacharacters: ; & | ` $ > < \ { } and newlines
//   - quotes inside a word (quotes are allowed only around whole words)
//   - config/credential subcommands: firecrawl env, ctx7 setup, ctx7 login
// The program is found after skipping leading VAR=value words and the wrappers env, command,
// timeout, nice, nohup, stdbuf, and time. Any other command is allowed (no output), so the normal
// permission flow continues.
// Fail-open: this module exports a pure evaluate(input) -> {deny, reason}; the command is blocked only
// when evaluate positively returns deny. Any failure (exception, malformed input, unsupported Node,
// disable flag) lets the command run and shows a systemMessage warning (see ../lib/health.js).
// It is a guardrail, not a security boundary.
"use strict";

const shellProgram = require("../lib/shell-program.js");

const NAME = "doc-cli-guard";
const ALLOW = { deny: false, reason: "" };
const GUARDED_COMMANDS = new Set(["firecrawl", "ctx7"]);
const SHELL_METACHARACTERS = /[;&|`$><\\{}\n\r]/;
const ENDPOINT_VARIABLE = /^(FIRECRAWL_API_URL|CONTEXT7_[A-Za-z0-9_]*URL[A-Za-z0-9_]*)=/;
const ENDPOINT_VARIABLE_ANYWHERE = /(^|[^A-Za-z0-9_])(FIRECRAWL_API_URL|CONTEXT7_[A-Za-z0-9_]*URL[A-Za-z0-9_]*)=/;
// Any short flag cluster containing o (-o, -Xo, -ofile); long flags that redirect output or the endpoint.
const SHORT_OUTPUT_FLAG = /^-[A-Za-z]*o/;
const LONG_FORBIDDEN_FLAG = /^--(output|base-url|api-url)(=|$)/;
const FORBIDDEN_SUBCOMMANDS = new Set(["firecrawl env", "ctx7 setup", "ctx7 login"]);

// Split into words, honoring whole-word "double" or 'single' quotes. A quote inside a bare word is rejected (null).
function tokenize(cmd) {
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = re.exec(cmd)) !== null) {
    if (match[3] !== undefined && /["']/.test(match[3])) return null;
    tokens.push(match[1] !== undefined ? match[1] : match[2] !== undefined ? match[2] : match[3]);
  }
  return tokens;
}

// Lenient split used only to locate the program: whitespace-separated words with outer quotes stripped.
function looseWords(cmd) {
  return cmd.split(/\s+/).filter(Boolean).map((word) => word.replace(/^(["'])(.*)\1$/, "$2"));
}

// Skips VAR=value words and wrappers (see ../lib/shell-program.js). Returns the index of the program word,
// whether an endpoint variable was assigned on the way, or -1 when no program is found.
function findProgram(words) {
  return shellProgram.findProgram(words, { isEndpoint: (word) => ENDPOINT_VARIABLE.test(word) });
}

// Returns a deny reason, or null when the command is not guarded or is acceptable.
function check(command) {
  const cmd = (command === undefined || command === null ? "" : String(command)).trim();
  const words = looseWords(cmd);
  const { index, endpointAssigned } = findProgram(words);
  if (endpointAssigned) {
    return "FIRECRAWL_API_URL and CONTEXT7_*URL* overrides are not allowed";
  }
  if (index === -1) return null;
  const program = words[index].split("/").pop();
  if (!GUARDED_COMMANDS.has(program)) return null;

  if (SHELL_METACHARACTERS.test(cmd)) {
    return `${program}: shell operators (; & | \` $ > < \\ { }) and newlines are not allowed`;
  }
  if (ENDPOINT_VARIABLE_ANYWHERE.test(cmd)) {
    return `${program}: FIRECRAWL_API_URL and CONTEXT7_*URL* overrides are not allowed`;
  }
  const tokens = tokenize(cmd);
  if (tokens === null) {
    return `${program}: quotes are allowed only around whole words`;
  }
  const args = tokens.slice(tokens.indexOf(words[index]) + 1);
  const subcommand = args.find((arg) => !arg.startsWith("-"));
  if (FORBIDDEN_SUBCOMMANDS.has(`${program} ${subcommand}`)) {
    return `${program} ${subcommand} writes config or credentials; ask the user to run it themselves`;
  }
  if (args.some((arg) => SHORT_OUTPUT_FLAG.test(arg) || LONG_FORBIDDEN_FLAG.test(arg))) {
    return `${program}: -o, --output, --base-url, and --api-url are not allowed`;
  }
  return null;
}

// Pure decision function: no I/O, no process access.
function evaluate(input) {
  if (!input || input.tool_name !== "Bash") return ALLOW;
  const reason = check(input.tool_input && input.tool_input.command);
  return reason ? { deny: true, reason } : ALLOW;
}

function main() {
  require("../lib/health.js").guard(NAME, evaluate);
}

module.exports = { NAME, evaluate, main, findProgram, looseWords };

if (require.main === module) main();
