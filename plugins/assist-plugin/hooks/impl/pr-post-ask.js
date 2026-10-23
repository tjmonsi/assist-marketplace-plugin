// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// PreToolUse guard for Bash and PowerShell: ask the user before a command that posts to, merges, or closes a
// pull request, in every session and for every agent (spec-hooks-pr-post-ask.md, Requirements 1 to 9).
//   - gh: gh pr review, merge, comment, or close
//   - bkt: bkt pr approve, comment, decline, close, or merge; bkt api that may write (a method other than GET or
//     HEAD, a body option, an option the hook does not recognize, or a second word after the path); and any
//     option before the subcommand that is not a listed global option, when a word that is not an option follows it
// [FR-206|FR-198] The command is split into parts with the quote-aware lexer in ../lib/shell-lex.js, and each part
// is judged on its own: "gh pr merge" inside a quoted string or a heredoc body makes no part. The program is found
// on the part's quote-resolved words and on its raw words (see ../lib/shell-program.js); every list that finds gh or
// bkt is judged, and the part asks when either judgment asks. Bash names keep their case; PowerShell names are
// compared without regard to case.
// Best-effort guardrail that fails open and never denies: evaluate(input) returns {ask, deny: false, reason} and
// ../lib/health.js guard() prints the ask JSON; the user's prompt decides.
// Forms it also catches, beyond the plain commands: every command substitution ($(...) or backticks) in the
// program word and in each word before it (assignment values, wrapper words, runner words), found with a
// quote-aware and heredoc-aware scan and judged as its own command; an ask (never a pass) when the substitutions
// nest deeper than 3 levels; a word expanded at run time ($ or a backtick, or in PowerShell an opening
// parenthesis) in any word the walk reads before the verb, option values and the words of an unlisted bkt option
// included, in the pr, verb, or bkt subcommand position, and in any word after bkt api; and redirection words
// between the program and the verb.
// Known gaps, listed in spec-hooks-pr-post-ask.md (Requirement 9) and not closed here:
//   - a program word taken from a variable or an expression, and PowerShell splatting
//   - gh api, gh pr edit, ready, and reopen, a gh alias or extension, and bkt pr subcommands other than the five
//   - a command string run by another program (bash -c, eval, Invoke-Expression, xargs, find -exec, and similar)
//     and argv wrappers outside the wrapper list (setsid, doas, ionice, stdbuf --output)
//   - a command substitution inside another program's argument (echo $(gh pr merge 1))
//   - a Bash GH in capitals, .cmd, .bat, and .ps1 shims, shell aliases, and renamed or linked binaries
//   - an option with a separate value ahead of the verb that the option lists do not name (gh --body x pr comment 1,
//     bkt pr --text x comment 1)
//   - a redirection the shared lexer splits into separate parts (gh 2>&1 pr merge 1, gh >&2 pr merge 1,
//     gh &>/dev/null pr merge 1, gh >| out pr merge 1, bkt 2>&1 pr approve 1, gh < <(true) pr merge 1)
//   - a PowerShell array or script block in the verb position (gh pr @('merge') 1, gh pr {merge} 1), and a
//     PowerShell comment that hides an opening parenthesis
//   - the quoting forms $"gh" and $'g\x68', brace expansion, a glob in the program word, "(( x = 1 << 2 ))" read as
//     a heredoc, and sudo --user with a separate value (the shared-parser forms doc-cli-guard lists)
//   - the PowerShell forms listed for doc-cli-guard, and a redirection before the program
//   - REST calls through curl, another HTTP client, or an MCP tool
// Fail-open: this module reads no file and starts no process. Any failure (exception, malformed input,
// unsupported Node, disable flag) lets the command run and shows a systemMessage warning (see ../lib/health.js).
// It is a guardrail, not a security boundary.
"use strict";

const shellProgram = require("../lib/shell-program.js");
const { lex } = require("../lib/shell-lex.js");
const { looseWords } = require("./doc-cli-guard.js");

const NAME = "pr-post-ask";

const GH_POSTING = new Set(["review", "merge", "comment", "close"]);
const GH_VALUE_OPTIONS = new Set(["-R", "--repo"]);

const BKT_POSTING = new Set(["approve", "comment", "decline", "close", "merge"]);
// Global options of bkt (root.go): these take the next word as their value unless the word holds "=".
const BKT_GLOBAL_VALUE = new Set(["-c", "--context", "--format", "--jq", "--template"]);
const BKT_GLOBAL_FLAG = new Set(["--json", "--yaml"]);
// After "pr", the repository flags also take a value.
const BKT_PR_VALUE = new Set(["-c", "--context", "--format", "--jq", "--template", "--workspace", "--project", "--repo"]);
const API_METHOD = "--method";
// Methods that read. Any other value, in any case, makes the call a write.
const API_READ_METHODS = new Set(["GET", "HEAD"]);

const FAMILY_API = "bkt api";
const FAMILY_UNLISTED_OPTION = "bkt with an option the hook does not recognize";
const FAMILY_GH_EXPANDED = "gh with a word that is expanded at run time";
const FAMILY_BKT_EXPANDED = "bkt with a word that is expanded at run time";
const FAMILY_DEEP_SUBSTITUTION = "a command substitution nested too deep for the hook to read";
// Families whose reason says "may post": the hook cannot read the command well enough to say it does.
const MAYBE_FAMILIES = new Set([FAMILY_UNLISTED_OPTION, FAMILY_GH_EXPANDED, FAMILY_BKT_EXPANDED, FAMILY_DEEP_SUBSTITUTION]);
// How deep a command substitution inside a command substitution is judged.
const MAX_DEPTH = 3;
// The lexer splits a command at &, so a redirection with & in it (2>&1, &>file) never reaches the walk.
const REDIRECTION = /^\d*(>>?|<)(.*)$/;

function noAsk() {
  return { ask: false, deny: false, reason: "" };
}

function isOption(word) {
  return word.charAt(0) === "-";
}

// The option text before its first "=".
function optionName(word) {
  const at = word.indexOf("=");
  return at === -1 ? word : word.slice(0, at);
}

// True when the option takes the next word as its value: it is in valueOptions and its word holds no "=".
function takesNextWord(word, valueOptions) {
  return word.indexOf("=") === -1 && valueOptions.has(optionName(word));
}

// Words a redirection takes: 0 when the word is no redirection, 1 when the operator carries its target (2>/dev/null),
// 2 when it stands alone and the next word is the target (> file).
function redirectionLength(word) {
  const match = REDIRECTION.exec(word);
  if (match === null) return 0;
  return match[2] === "" ? 2 : 1;
}

// Walks the options, their values, and redirections from start. Returns {index, expanded}: index of the first word
// that is not an option, the value of an option in valueOptions, or a redirection (a redirection can stand between
// the program and the verb: gh 2>/dev/null pr merge 1), and whether any option or value walked past holds $ or a
// backtick, because its run-time expansion can move the verb. A redirection target is not tested.
function skipOptions(args, start, valueOptions) {
  let i = start;
  let expanded = false;
  while (i < args.length) {
    const redirection = redirectionLength(args[i]);
    if (redirection > 0) {
      i += redirection;
    } else if (isOption(args[i])) {
      const width = takesNextWord(args[i], valueOptions) ? 2 : 1;
      expanded = expanded || args.slice(i, i + width).some(isExpanded);
      i += width;
    } else {
      break;
    }
  }
  return { index: i, expanded };
}

// A word the shell expands at run time, so the hook cannot read it: a variable, a substitution, a backtick.
function isExpanded(word) {
  return word.indexOf("$") !== -1 || word.indexOf("`") !== -1;
}

// True when the word stands where the walk needs a plain word and cannot be read: it holds $ or a backtick, or it is
// missing because a PowerShell part ended at an opening parenthesis (gh pr ('merge') 1).
function unreadable(word, open) {
  return word === undefined ? open : isExpanded(word);
}

// Requirement 4. args are the words after the gh program word; open is true when a PowerShell part ended at an
// opening parenthesis. Returns the command family, or null.
function judgeGh(args, open) {
  const first = skipOptions(args, 0, GH_VALUE_OPTIONS);
  if (args[first.index] !== "pr") {
    return first.expanded || unreadable(args[first.index], open) ? FAMILY_GH_EXPANDED : null;
  }
  const second = skipOptions(args, first.index + 1, GH_VALUE_OPTIONS);
  const verb = args[second.index];
  if (GH_POSTING.has(verb)) return `gh pr ${verb}`;
  return first.expanded || second.expanded || unreadable(verb, open) ? FAMILY_GH_EXPANDED : null;
}

// Requirement 6. args are the words after "api". Returns FAMILY_API when the call may write, else null. The
// call passes only when every word is the one path, a method option that reads, or a known read-only option.
// A body option (--input, --field), every other option, "--" included, and any word holding $ or a backtick ask.
function judgeApi(args) {
  // A word expanded at run time can split into a method or body option.
  if (args.some(isExpanded)) return FAMILY_API;
  let paths = 0;
  let i = 0;
  while (i < args.length) {
    const word = args[i];
    if (!isOption(word)) {
      paths += 1;
      if (paths > 1) return FAMILY_API;
      i += 1;
    } else if (optionName(word) === API_METHOD) {
      const at = word.indexOf("=");
      const value = at === -1 ? args[i + 1] : word.slice(at + 1);
      if (typeof value !== "string" || !API_READ_METHODS.has(value.toUpperCase())) return FAMILY_API;
      i += at === -1 ? 2 : 1;
    } else if (BKT_GLOBAL_VALUE.has(optionName(word))) {
      i += takesNextWord(word, BKT_GLOBAL_VALUE) ? 2 : 1;
    } else if (BKT_GLOBAL_FLAG.has(optionName(word))) {
      i += 1;
    } else {
      return FAMILY_API;
    }
  }
  return null;
}

// Requirements 5 and 6. args are the words after the bkt program word; open is as for judgeGh. Returns the command
// family, or null.
function judgeBkt(args, open) {
  let i = 0;
  let expanded = false;
  while (i < args.length) {
    const redirection = redirectionLength(args[i]);
    if (redirection > 0) {
      i += redirection;
      continue;
    }
    if (!isOption(args[i])) break;
    const name = optionName(args[i]);
    const width = BKT_GLOBAL_VALUE.has(name) ? (takesNextWord(args[i], BKT_GLOBAL_VALUE) ? 2 : 1) : BKT_GLOBAL_FLAG.has(name) ? 1 : 0;
    if (width === 0) {
      // An unlisted option: a flag of the subcommand written ahead of it, or an option whose separate value hides
      // the subcommand. It asks when a word from here on is expanded at run time (it can supply the subcommand or
      // another option), or when any plain word follows (bkt --version asks nothing).
      if (expanded || args.slice(i).some(isExpanded)) return FAMILY_BKT_EXPANDED;
      const plain = (word) => !isOption(word) && redirectionLength(word) === 0;
      return args.slice(i + 1).some(plain) ? FAMILY_UNLISTED_OPTION : null;
    }
    expanded = expanded || args.slice(i, i + width).some(isExpanded);
    i += width;
  }
  const subcommand = args[i];
  if (subcommand === "api") {
    const api = judgeApi(args.slice(i + 1));
    return api !== null ? api : expanded ? FAMILY_BKT_EXPANDED : null;
  }
  if (subcommand !== "pr") return expanded || unreadable(subcommand, open) ? FAMILY_BKT_EXPANDED : null;
  const walked = skipOptions(args, i + 1, BKT_PR_VALUE);
  const verb = args[walked.index];
  if (BKT_POSTING.has(verb)) return `bkt pr ${verb}`;
  return expanded || walked.expanded || unreadable(verb, open) ? FAMILY_BKT_EXPANDED : null;
}

// Index just past the quoted text that starts at i (a quote character). A double-quoted span can hold $( ) and
// backticks, which are skipped as units.
function skipQuoted(text, i) {
  const quote = text.charAt(i);
  if (quote === "'") {
    const close = text.indexOf("'", i + 1);
    return close === -1 ? text.length : close + 1;
  }
  let j = i + 1;
  while (j < text.length) {
    const ch = text.charAt(j);
    if (ch === "\\") j += 2;
    else if (ch === "\"") return j + 1;
    else if (ch === "$" && text.charAt(j + 1) === "(") j = skipSubstitution(text, j);
    else if (ch === "`") j = skipBackticks(text, j);
    else j += 1;
  }
  return text.length;
}

// Index just past the backtick pair that starts at i.
function skipBackticks(text, i) {
  const close = text.indexOf("`", i + 1);
  return close === -1 ? text.length : close + 1;
}

// Heredoc operator at index i ("<<", "<<-", then the delimiter), as the lexer reads it: {delim, strip, next} or null.
function parseHeredocStart(text, i) {
  if (text.substr(i, 2) !== "<<" || text.charAt(i + 2) === "<") return null;
  let j = i + 2;
  const strip = text.charAt(j) === "-";
  if (strip) j += 1;
  while (text.charAt(j) === " " || text.charAt(j) === "\t") j += 1;
  let delim = "";
  while (j < text.length) {
    const ch = text.charAt(j);
    if (ch === "'" || ch === "\"") {
      const close = text.indexOf(ch, j + 1);
      if (close === -1) return null;
      delim += text.slice(j + 1, close);
      j = close + 1;
    } else if (ch === "\\" && j + 1 < text.length) {
      delim += text.charAt(j + 1);
      j += 2;
    } else if (/[\s;&|()<>]/.test(ch)) {
      break;
    } else {
      delim += ch;
      j += 1;
    }
  }
  return delim ? { delim, strip, next: j } : null;
}

// Index just past the heredoc body that starts at index start (the first character after the newline).
function skipHeredocBody(text, start, doc) {
  let i = start;
  while (i < text.length) {
    let end = text.indexOf("\n", i);
    if (end === -1) end = text.length;
    let line = text.slice(i, end);
    if (line.charAt(line.length - 1) === "\r") line = line.slice(0, -1);
    i = Math.min(end + 1, text.length);
    if ((doc.strip ? line.replace(/^\t+/, "") : line) === doc.delim) return i;
  }
  return text.length;
}

// Index just past the $( ... ) that starts at i (the dollar sign), with the same rules as the lexer's scan: quotes,
// escapes, backticks, nested parentheses, and heredoc bodies are skipped as units, so ')' in a quoted string or on a
// line of a heredoc body does not end it.
function skipSubstitution(text, i) {
  let j = i + 2;
  let depth = 1;
  const pending = [];
  while (j < text.length) {
    const ch = text.charAt(j);
    if (ch === "\\") {
      j += 2;
    } else if (ch === "'" || ch === "\"") {
      j = skipQuoted(text, j);
    } else if (ch === "`") {
      j = skipBackticks(text, j);
    } else if (ch === "<" && text.charAt(j + 1) === "<") {
      const start = parseHeredocStart(text, j);
      if (start) {
        pending.push(start);
        j = start.next;
      } else {
        j += text.charAt(j + 2) === "<" ? 3 : 2;
      }
    } else if (ch === "\n") {
      j += 1;
      while (pending.length > 0) j = skipHeredocBody(text, j, pending.shift());
    } else {
      depth += ch === "(" ? 1 : ch === ")" ? -1 : 0;
      j += 1;
      if (depth === 0) return j;
    }
  }
  return text.length;
}

// The text inside every $(...) span, and in Bash every backtick pair, of a word. A PowerShell backtick is an escape,
// not a substitution, and the lexer never keeps it in a word.
function substitutionBodies(value, powershell) {
  const bodies = [];
  let i = 0;
  while (i < value.length) {
    if (value.charAt(i) === "$" && value.charAt(i + 1) === "(") {
      const end = skipSubstitution(value, i);
      bodies.push(value.slice(i + 2, value.charAt(end - 1) === ")" ? end - 1 : end));
      i = end;
    } else if (!powershell && value.charAt(i) === "`") {
      const end = skipBackticks(value, i);
      bodies.push(value.slice(i + 1, value.charAt(end - 1) === "`" && end > i + 1 ? end - 1 : end));
      i = end;
    } else {
      i += 1;
    }
  }
  return bodies;
}

// The parts of a command, each {lists, open}: lists holds the two word lists, the quote-resolved words from lex (for
// PowerShell, lexed again after the leading assignment is removed, as doc-cli-guard does) and the raw words
// (looseWords); open is true when a PowerShell part is followed by an opening parenthesis.
function splitParts(command, powershell) {
  let from = 0;
  return lex(command, powershell, true).map((segment) => {
    let open = false;
    if (powershell) {
      const at = command.indexOf(segment.raw, from);
      if (at !== -1) {
        from = at + segment.raw.length;
        open = /^\s*\(/.test(command.slice(from, from + 64));
      }
    }
    if (!powershell) return { lists: [segment.words, looseWords(segment.raw)], open };
    const text = shellProgram.stripAssignment(segment.raw);
    let resolved = [];
    lex(text, true).forEach((again) => {
      resolved = resolved.concat(again.words);
    });
    return { lists: [resolved, looseWords(text)], open };
  });
}

// Judges every command substitution in the program word and in each word before it (an assignment value, a wrapper
// or runner word: out=$(gh pr merge 1), $(gh pr merge 1), `gh pr merge 1`, out="x $(gh pr merge 1)",
// $(gh pr merge 1)/usr/bin/env true) as a command of its own. at is the program index, or -1. A substitution found past MAX_DEPTH levels is not read: it asks.
function judgeSubstitutions(words, at, powershell, depth) {
  const last = at === -1 ? words.length - 1 : at;
  for (let i = 0; i <= last; i++) {
    const assignment = shellProgram.ENV_ASSIGNMENT.test(words[i]);
    const value = assignment ? words[i].slice(words[i].indexOf("=") + 1) : words[i];
    const bodies = substitutionBodies(value, powershell);
    if (bodies.length > 0 && depth >= MAX_DEPTH) return FAMILY_DEEP_SUBSTITUTION;
    for (let b = 0; b < bodies.length; b++) {
      const family = findFamily(bodies[b], powershell, depth + 1);
      if (family !== null) return family;
    }
  }
  return null;
}

// The family of the first part that asks, or null. The resolved words are judged before the raw words, so they
// name the family when both ask. A substitution is judged last, on the resolved words.
function findFamily(command, powershell, depth) {
  const options = { runners: true, powershell, keywords: shellProgram.KEYWORDS, wrappers: shellProgram.EXTRA_WRAPPERS };
  const parts = splitParts(command, powershell);
  for (let p = 0; p < parts.length; p++) {
    const { lists, open } = parts[p];
    const found = lists.map((words) => shellProgram.findProgram(words, options).index);
    for (let k = 0; k < lists.length; k++) {
      if (found[k] === -1) continue;
      const program = shellProgram.programName(lists[k][found[k]], { powershell });
      const args = lists[k].slice(found[k] + 1);
      const family = program === "gh" ? judgeGh(args, open) : program === "bkt" ? judgeBkt(args, open) : null;
      if (family !== null) return family;
    }
    const inner = judgeSubstitutions(lists[0], found[0], powershell, depth);
    if (inner !== null) return inner;
  }
  return null;
}

// Requirement 7: the reason names the command family and holds no other command text.
function reasonFor(family) {
  const effect = MAYBE_FAMILIES.has(family) ? "may post to, merge, or close" : "posts to, merges, or closes";
  return `assist-plugin ${NAME}: this command runs ${family}, which ${effect} a pull request. Allow it only if you meant to post it now.`;
}

// Decision function: no I/O, no process access. Judges the Bash and PowerShell tools; every other tool gets no
// decision. It reads neither agent_type nor agent_id and never returns deny: true.
function evaluate(input) {
  if (!input || (input.tool_name !== "Bash" && input.tool_name !== "PowerShell")) return noAsk();
  const command = input.tool_input && typeof input.tool_input.command === "string" ? input.tool_input.command : "";
  const family = findFamily(command, input.tool_name === "PowerShell", 0);
  return family === null ? noAsk() : { ask: true, deny: false, reason: reasonFor(family) };
}

function main() {
  require("../lib/health.js").guard(NAME, evaluate);
}

module.exports = { NAME, evaluate, main };

if (require.main === module) main();
