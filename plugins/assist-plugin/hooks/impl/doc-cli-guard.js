// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// PreToolUse guard for Bash and PowerShell: guard the documentation CLIs (firecrawl, ctx7) for every agent.
// The skill allowed-tools rules use "*" wildcards, which match any characters including flags
// and shell operators, so this hook denies the dangerous forms the wildcards would let through:
//   - output/endpoint flags: any short flag cluster containing o (-o, -Xo), --output, --base-url, --api-url
//   - endpoint overrides: FIRECRAWL_API_URL=... and CONTEXT7_*URL*=... assignments (in PowerShell also
//     $env:FIRECRAWL_API_URL = ... and $env:CONTEXT7_*URL* = ..., without regard to case)
//   - shell metacharacters: ; & | ` $ > < \ { } and newlines (in PowerShell also ( and ))
//   - quotes inside a word (quotes are allowed only around whole words)
//   - config/credential subcommands: firecrawl env, ctx7 setup, ctx7 login
// [FR-094|FR-198] The command is split into parts with the quote-aware lexer in ../lib/shell-lex.js (at ; & | ( )
// and line breaks outside quotes and heredoc bodies, and in PowerShell also at braces), and each part is judged
// on its own: a separator or "ctx7" inside a quoted string or a heredoc body (a commit message, a pull request
// body) makes no part. A part is guarded when its program, found on its quote-resolved words or on its raw words,
// is firecrawl or ctx7. The program is found after skipping leading VAR=value words, shell keywords, the
// wrappers env, command, timeout, nice, nohup, stdbuf, time, sudo, exec, and eval, the package runners npx,
// npm exec, pnpx, pnpm dlx, yarn dlx, bunx, bun x, and node with their options, and in PowerShell a call
// operator, a leading assignment, and an opening ( or $(. The program word is reduced to a name (no directory
// part, @version, or .exe); PowerShell names are compared without regard to case, Bash names with case. Any
// other command is allowed (no output), so the normal permission flow continues.
// Best-effort guard: spec-hooks-bash-guards.md (Requirement: Documentation CLI program detection, rule 9) lists
// the forms known to pass it, such as a program taken from a variable, a command string given to "bash -c" or
// "npx -c", and a documentation CLI run inside a command substitution of another program. Bypass forms found
// later join that list rather than changing this code: PowerShell typographic quotes, block comments, the
// dot-source operator, typed, scoped, and compound assignments, leading redirections, and sudo --user
// (DECISIONS.md, 2026-10-17, "/do PR flow hardening after the security gate").
// Fail-open: this module exports evaluate(input) -> {deny, reason}, a decision function whose only I/O is
// file reads that a test can replace (this one reads no file); the command is blocked only when evaluate
// positively returns deny. Any failure (exception, malformed input, unsupported Node, disable flag) lets the
// command run and shows a systemMessage warning (see ../lib/health.js).
// It is a guardrail, not a security boundary.
"use strict";

const shellProgram = require("../lib/shell-program.js");
const { lex } = require("../lib/shell-lex.js");

const NAME = "doc-cli-guard";
const ALLOW = { deny: false, reason: "" };
const GUARDED_COMMANDS = new Set(["firecrawl", "ctx7"]);
const SHELL_METACHARACTERS = /[;&|`$><\\{}\n\r]/;
// PowerShell runs a parenthesized pipeline placed in an argument, so ( and ) join its metacharacters.
const POWERSHELL_METACHARACTERS = /[;&|`$><\\{}()\n\r]/;
const ENDPOINT_VARIABLE = /^(FIRECRAWL_API_URL|CONTEXT7_[A-Za-z0-9_]*URL[A-Za-z0-9_]*)=/;
const ENDPOINT_VARIABLE_ANYWHERE = /(^|[^A-Za-z0-9_])(FIRECRAWL_API_URL|CONTEXT7_[A-Za-z0-9_]*URL[A-Za-z0-9_]*)=/;
// PowerShell only: a part that starts with an assignment to $env:FIRECRAWL_API_URL or $env:CONTEXT7_*URL*.
const POWERSHELL_ENDPOINT_ASSIGNMENT = /^\s*\$env:(FIRECRAWL_API_URL|CONTEXT7_[A-Za-z0-9_]*URL[A-Za-z0-9_]*)\s*=/i;
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
// whether an endpoint variable was assigned on the way, or -1 when no program is found. Kept as built: it
// takes no runner or PowerShell option (injection-filter reads findProgram from ../lib/shell-program.js).
function findProgram(words) {
  return shellProgram.findProgram(words, { isEndpoint: (word) => ENDPOINT_VARIABLE.test(word) });
}

// Options for ../lib/shell-program.js findProgram in this guard.
function programOptions(powershell) {
  return {
    runners: true,
    powershell,
    keywords: shellProgram.KEYWORDS,
    wrappers: shellProgram.EXTRA_WRAPPERS,
    isEndpoint: (word) => ENDPOINT_VARIABLE.test(word),
  };
}

// The parts of a command, each {raw, text, lists}: raw is the part's text as written; text is raw without a
// leading PowerShell assignment; lists holds the part's two word lists: the quote-resolved words from lex (for
// PowerShell, lexed again from text, so a hidden name such as $r = ct`x7 is resolved after the assignment is
// removed) and the raw words (looseWords on text).
function splitParts(cmd, powershell) {
  return lex(cmd, powershell, true).map((segment) => {
    const raw = segment.raw;
    const text = powershell ? shellProgram.stripAssignment(raw) : raw;
    let resolved = segment.words;
    if (powershell) {
      resolved = [];
      lex(text, true).forEach((again) => {
        resolved = resolved.concat(again.words);
      });
    }
    return { raw, text, lists: [resolved, looseWords(text)] };
  });
}

// Rules 4 to 6 for one guarded part, on one token list. program is the name the resolved words read.
function judgeGuardedPart(part, program, powershell, options) {
  const tokens = tokenize(part.text);
  if (tokens === null) return `${program}: quotes are allowed only around whole words`;
  const at = shellProgram.findProgram(tokens, options).index;
  // A name spelled with quotes or escapes that only the resolved words undo ("c"tx7 login) is rule 4.
  if (at === -1 || !GUARDED_COMMANDS.has(shellProgram.programName(tokens[at], { powershell }))) {
    return `${program}: quotes are allowed only around whole words`;
  }
  const name = shellProgram.programName(tokens[at], { powershell });
  const args = tokens.slice(at + 1);
  const subcommand = args.find((arg) => !arg.startsWith("-"));
  if (FORBIDDEN_SUBCOMMANDS.has(`${name} ${subcommand}`)) {
    return `${name} ${subcommand} writes config or credentials; ask the user to run it themselves`;
  }
  if (args.some((arg) => SHORT_OUTPUT_FLAG.test(arg) || LONG_FORBIDDEN_FLAG.test(arg))) {
    return `${name}: -o, --output, --base-url, and --api-url are not allowed`;
  }
  return null;
}

// Returns a deny reason, or null when the command is not guarded or is acceptable. Each part is judged on its
// own (rule 1, rule 1P in PowerShell, then rules 4 to 6 for a guarded part); the whole-command rules 2 and 3
// run only when some part is guarded.
function check(command, powershell) {
  const cmd = (command === undefined || command === null ? "" : String(command)).trim();
  const options = programOptions(powershell);
  let guarded = null;
  const parts = splitParts(cmd, powershell);
  for (let p = 0; p < parts.length; p++) {
    const part = parts[p];
    const found = part.lists.map((words) => shellProgram.findProgram(words, options));
    if (found.some((result) => result.endpointAssigned)) {
      return "FIRECRAWL_API_URL and CONTEXT7_*URL* overrides are not allowed";
    }
    if (powershell && POWERSHELL_ENDPOINT_ASSIGNMENT.test(part.raw)) {
      return "FIRECRAWL_API_URL and CONTEXT7_*URL* overrides are not allowed";
    }
    let program = null;
    for (let k = 0; k < found.length && program === null; k++) {
      if (found[k].index === -1) continue;
      const name = shellProgram.programName(part.lists[k][found[k].index], { powershell });
      if (GUARDED_COMMANDS.has(name)) program = name;
    }
    if (program === null) continue;
    if (guarded === null) guarded = program;
    const reason = judgeGuardedPart(part, program, powershell, options);
    if (reason) return reason;
  }
  if (guarded === null) return null;
  if ((powershell ? POWERSHELL_METACHARACTERS : SHELL_METACHARACTERS).test(cmd)) {
    return powershell
      ? `${guarded}: shell operators (; & | \` $ > < \\ { } ( )) and newlines are not allowed`
      : `${guarded}: shell operators (; & | \` $ > < \\ { }) and newlines are not allowed`;
  }
  if (ENDPOINT_VARIABLE_ANYWHERE.test(cmd)) {
    return `${guarded}: FIRECRAWL_API_URL and CONTEXT7_*URL* overrides are not allowed`;
  }
  return null;
}

// Decision function: no I/O, no process access. Judges the Bash and PowerShell tools; every other tool is allowed.
function evaluate(input) {
  if (!input || (input.tool_name !== "Bash" && input.tool_name !== "PowerShell")) return ALLOW;
  const reason = check(input.tool_input && input.tool_input.command, input.tool_name === "PowerShell");
  return reason ? { deny: true, reason } : ALLOW;
}

function main() {
  require("../lib/health.js").guard(NAME, evaluate);
}

module.exports = { NAME, evaluate, main, findProgram, looseWords };

if (require.main === module) main();
