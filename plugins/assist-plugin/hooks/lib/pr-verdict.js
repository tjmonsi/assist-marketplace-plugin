// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-214] Parser for the PR-verdict guard (impl/pr-verdict-guard.js). It reads a Bash or PowerShell command and returns
// one target {family, pr, verdict, repo} for each PR verdict the command posts:
//   - gh pr review <n> with --approve (-a), --request-changes (-r), or --comment (-c): verdict approve,
//     request-changes, or comment
//   - bkt pr approve <n> and bkt pr decline <n>: verdict approve or decline
// Nothing else is a target: gh pr merge, close, and comment, bkt pr comment, merge, and close, any bkt api call, and a
// SARIF upload stay with pr-post-ask and the flow rules. This is the narrow walk of pr-post-ask without its "may post"
// families: a command it cannot read as a verdict post is not a target. The command is split into parts with the
// quote-aware lexer of shell-lex.js, so "gh pr review 1 --approve" inside a quoted string or a heredoc body makes no
// part, and the program is found with shell-program.js (VAR=value words, wrappers, package runners, PowerShell call
// operator). Bash names keep their case; PowerShell names are compared without regard to case.
// A target field is null when the command names the field in a form this parser cannot read (a word expanded at run
// time, no PR argument, no verdict flag): the guard denies such a target, because no confirmation can match it.
// `pr` is the PR argument as written (leading zeros and a leading # removed; a PR URL reduced to its number), so a
// branch name stays a branch name and matches no confirmation. `repo` comes from -R/--repo, a PR URL, or
// --workspace/--project with --repo; it is informational: the confirmation store keys on PR and verdict alone.
// Known limits, not closed here (pr-post-ask asks about most of them): a command string run by another program
// (bash -c, eval, xargs), an option ahead of the verb that takes a separate value this parser does not list, a
// program word taken from a variable, a command substitution ($( ) or backticks, which the lexer keeps inside one word),
// shell aliases, and a REST call. Pure: no I/O.
"use strict";

const shellProgram = require("./shell-program.js");
const { lex } = require("./shell-lex.js");

const GH_VALUE_OPTIONS = new Set(["-b", "--body", "-F", "--body-file", "-R", "--repo"]);
const GH_VERDICT_FLAGS = new Map([
  ["--approve", "approve"], ["-a", "approve"],
  ["--request-changes", "request-changes"], ["-r", "request-changes"],
  ["--comment", "comment"], ["-c", "comment"],
]);

// bkt: the global options and the repository options that take the next word as their value.
const BKT_VALUE_OPTIONS = new Set(["-c", "--context", "--format", "--jq", "--template", "--workspace", "--project", "--repo"]);
const BKT_VERBS = new Set(["approve", "decline"]);

// The lexer splits a command at &, so a redirection with & in it never reaches the walk; these are the others.
const REDIRECTION = /^\d*(>>?|<)(.*)$/;
const PR_URL = /^https?:\/\/[^/\s]+\/([^/\s]+\/[^/\s]+)\/pull\/(\d+)(?:[/?#].*)?$/;
const PR_NUMBER = /^#?(\d+)$/;

// A word the shell expands at run time, so the parser cannot read it.
function isExpanded(word) {
  return word.indexOf("$") !== -1 || word.indexOf("`") !== -1;
}

// Words a redirection takes: 0 when the word is no redirection, 1 when the operator carries its target, 2 when the next
// word is the target.
function redirectionLength(word) {
  const match = REDIRECTION.exec(word);
  if (match === null) return 0;
  return match[2] === "" ? 2 : 1;
}

// Reads the option and positional words of args. Returns {positionals, flags, values, expandedOption}:
//   positionals     the words that are no option, no option value, and no redirection ("--" ends the options)
//   flags           the options that take no value, by name; a short cluster such as -ar is split into -a and -r
//   values          the value of each valueOptions option, by name as written; null when the value is expanded at run time
//   expandedOption  true when an option word that is no value holds $ or a backtick (it can supply a flag)
// An option in valueOptions takes the next word unless its word holds "="; in a short cluster the first value letter
// takes the rest of the word, or the next word.
function readWords(args, valueOptions) {
  const out = { positionals: [], flags: [], values: {}, expandedOption: false };
  const setValue = (name, value) => {
    out.values[name] = value === undefined || isExpanded(value) ? null : value;
  };
  let i = 0;
  let optionsEnded = false;
  while (i < args.length) {
    const word = args[i];
    const redirection = optionsEnded ? 0 : redirectionLength(word);
    if (redirection > 0) {
      i += redirection;
    } else if (!optionsEnded && word === "--") {
      optionsEnded = true;
      i += 1;
    } else if (optionsEnded || word.charAt(0) !== "-" || word === "-") {
      out.positionals.push(word);
      i += 1;
    } else if (word.indexOf("--") === 0) {
      const at = word.indexOf("=");
      const name = at === -1 ? word : word.slice(0, at);
      out.expandedOption = out.expandedOption || isExpanded(name);
      if (valueOptions.has(name)) {
        setValue(name, at === -1 ? args[i + 1] : word.slice(at + 1));
        i += at === -1 ? 2 : 1;
      } else {
        out.flags.push(name);
        i += 1;
      }
    } else {
      out.expandedOption = out.expandedOption || isExpanded(word);
      let consumed = 1;
      for (let c = 1; c < word.length; c++) {
        const letter = "-" + word.charAt(c);
        if (valueOptions.has(letter)) {
          const rest = word.slice(c + 1).replace(/^=/, "");
          if (rest.length > 0) {
            setValue(letter, rest);
          } else {
            setValue(letter, args[i + 1]);
            consumed = 2;
          }
          break;
        }
        out.flags.push(letter);
      }
      i += consumed;
    }
  }
  return out;
}

// {pr, repo} from the PR argument. A URL gives the number and the repository, a number may carry a leading # and zeros;
// any other word (a branch name) is kept as written; a missing or expanded word is null.
function readPr(word) {
  if (typeof word !== "string" || isExpanded(word)) return { pr: null, repo: null };
  const url = PR_URL.exec(word);
  if (url) return { pr: url[2].replace(/^0+(?=\d)/, ""), repo: url[1] };
  const number = PR_NUMBER.exec(word);
  return { pr: number ? number[1].replace(/^0+(?=\d)/, "") : word, repo: null };
}

function textOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// The targets of one gh command. args are the words after the gh program word.
function ghTargets(args) {
  const read = readWords(args, GH_VALUE_OPTIONS);
  if (read.positionals[0] !== "pr" || read.positionals[1] !== "review") return [];
  const { pr, repo } = readPr(read.positionals[2]);
  const verdicts = [];
  read.flags.forEach((flag) => {
    const verdict = GH_VERDICT_FLAGS.get(flag);
    if (verdict !== undefined && verdicts.indexOf(verdict) === -1) verdicts.push(verdict);
  });
  // A word expanded at run time past the PR argument can supply a verdict flag.
  if (verdicts.length === 0 || read.expandedOption || read.positionals.slice(3).some(isExpanded)) verdicts.push(null);
  const given = textOrNull(read.values["--repo"]) || textOrNull(read.values["-R"]);
  return verdicts.map((verdict) => ({ family: "gh", pr, verdict, repo: given || repo }));
}

// The targets of one bkt command. args are the words after the bkt program word.
function bktTargets(args) {
  const read = readWords(args, BKT_VALUE_OPTIONS);
  if (read.positionals[0] !== "pr" || !BKT_VERBS.has(read.positionals[1])) return [];
  const { pr } = readPr(read.positionals[2]);
  const slug = textOrNull(read.values["--repo"]);
  const owner = textOrNull(read.values["--workspace"]) || textOrNull(read.values["--project"]);
  const repo = slug === null ? null : owner === null ? slug : owner + "/" + slug;
  return [{ family: "bkt", pr, verdict: read.positionals[1], repo }];
}

// The parts of a command as word lists. For PowerShell each part is lexed again after its leading assignment is
// removed, as pr-post-ask does, so a hidden name such as $r = gh is resolved.
function wordLists(command, powershell) {
  return lex(command, powershell, true).map((segment) => {
    if (!powershell) return segment.words;
    let resolved = [];
    lex(shellProgram.stripAssignment(segment.raw), true).forEach((again) => {
      resolved = resolved.concat(again.words);
    });
    return resolved;
  });
}

// Every PR verdict the command posts, in order. Returns [] for a command that posts none.
function parse(command, powershell) {
  const options = { runners: true, powershell, keywords: shellProgram.KEYWORDS, wrappers: shellProgram.EXTRA_WRAPPERS };
  let targets = [];
  wordLists(String(command), powershell).forEach((words) => {
    const at = shellProgram.findProgram(words, options).index;
    if (at === -1) return;
    const program = shellProgram.programName(words[at], { powershell });
    const args = words.slice(at + 1);
    if (program === "gh") targets = targets.concat(ghTargets(args));
    else if (program === "bkt") targets = targets.concat(bktTargets(args));
  });
  return targets;
}

module.exports = { parse };
