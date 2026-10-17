// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// PreToolUse guard for Bash and PowerShell: deny a git or gh command whose commit message or pull request
// body carries AI attribution (see ../lib/attribution-rules.js for what counts). Covered commands:
//   - git commit (including --amend) and git merge, with -m, --message, -F, --file, and --trailer; the heredoc
//     form -m "$(cat <<'EOF' ... EOF)", a heredoc fed to -F -, and a here-string (<<<) are read from the
//     command text
//   - gh pr create and gh pr edit, with --body, -b, --body-file, and -F
// Not covered: git tag and every other command. git revert and git cherry-pick take their message from the
// editor or the default text (their -m is --mainline), so the command line holds nothing to check.
// Chained commands (&&, ||, ;, |, newlines) and sh -c strings are split and each part is judged.
// A message file named by -F, --file, or --body-file is read from the hook input's cwd, at most 64 KB, and
// only when it is a regular file; "-" (stdin), a missing file, and a variable path are skipped. A message
// built from a variable or a pipe cannot be seen, so it passes.
// The deny reason names the offending line. The command is never rewritten (updatedInput would skip the
// user's permission prompt).
// Fail-open: this module exports evaluate(input, options) -> {deny, reason}; the command is blocked only
// when evaluate positively returns deny. Any failure (exception, malformed input, unsupported Node, disable
// flag) lets the command run and shows a systemMessage warning (see ../lib/health.js). It is a guardrail, not
// a security boundary: a message assembled at run time passes.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const rules = require("../lib/attribution-rules.js");
const shellProgram = require("../lib/shell-program.js");
const { lex } = require("../lib/shell-lex.js");

const NAME = "commit-attribution-guard";
const ALLOW = { deny: false, reason: "" };
const MAX_FILE_BYTES = 64 * 1024;
const MAX_NESTING = 2;
const UNC_PATH = /^[\\/]{2}/;
const GIT_SUBCOMMANDS = ["commit", "merge"];
const MENTIONS_COMMAND = /(^|[^a-z0-9_])(git|gh)(\.exe)?([^a-z0-9_]|$)/i;
const SHELLS = ["sh", "bash", "zsh", "dash", "ksh"];

// Wrappers that may precede the program, on top of the ones in ../lib/shell-program.js, and the shell keywords
// to skip. Each wrapper lists the options that take a value.
const EXTRA_WRAPPERS = new Map([
  ["sudo", new Set(["-u", "-g", "-h", "-p", "-C", "-D", "-R", "-T", "-U"])],
  ["exec", new Set(["-a"])],
]);
const KEYWORDS = ["!", "if", "then", "else", "elif", "do", "while", "until", "{"];

// Options that take a separate value, so the value is never mistaken for a subcommand.
const GIT_GLOBAL_VALUE = ["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--super-prefix", "--config-env"];
const GH_GLOBAL_VALUE = ["-R", "--repo"];

// Message options per command. text/file: long names (without --); trailer: long names whose value is a
// "Key: value" or "Key=value" trailer line; shortText/shortFile: one-letter flags; shortOther: one-letter flags
// with a value that is not a message; stop: letters that end a flag cluster (an optional value follows them in
// the same word); eqShort: a short flag may take its value as -b=value (gh).
const GIT_SPEC = {
  text: ["message"], trailer: ["trailer"], file: ["file"], shortText: "m", shortFile: "F", stop: "Su",
};
const GIT_OTHER = { commit: "Cct", merge: "sX" };
const GH_SPEC = {
  text: ["body"], trailer: [], file: ["body-file"], shortText: "b", shortFile: "F", shortOther: "tBHRalmpr", stop: "", eqShort: true,
};

// ---------------------------------------------------------------------------------------------
// Command analysis

// Program name for comparisons: no directory, no .exe, lower case (PowerShell runs "Git" as git).
function baseName(word) {
  return word.split(/[\\/]/).pop().replace(/\.exe$/i, "").toLowerCase();
}

// Index of the program word after VAR=value words, wrappers, and shell keywords; -1 when there is none.
function findProgram(words) {
  return shellProgram.findProgram(words, { wrappers: EXTRA_WRAPPERS, keywords: KEYWORDS, baseName }).index;
}

// Message sources in the arguments of a covered command: [{kind: "text"|"trailer"|"file", value}].
function collectSources(args, spec, otherShort) {
  const found = [];
  const valued = (spec.shortOther || "") + (otherShort || "");
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") break;
    if (arg.slice(0, 2) === "--") {
      const eq = arg.indexOf("=");
      const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
      const kind = spec.text.indexOf(name) !== -1 ? "text" : spec.trailer.indexOf(name) !== -1 ? "trailer" : spec.file.indexOf(name) !== -1 ? "file" : null;
      if (kind === null) continue;
      const value = eq === -1 ? args[i + 1] : arg.slice(eq + 1);
      if (eq === -1) i++;
      if (value !== undefined) found.push({ kind, value });
    } else if (arg.length > 1 && arg.charAt(0) === "-") {
      for (let j = 1; j < arg.length; j++) {
        const ch = arg.charAt(j);
        if (spec.stop.indexOf(ch) !== -1) break;
        const kind = ch === spec.shortText ? "text" : ch === spec.shortFile ? "file" : valued.indexOf(ch) !== -1 ? "other" : null;
        if (kind === null) continue;
        let value = arg.slice(j + 1);
        if (value === "") {
          value = args[i + 1];
          i++;
        } else if (spec.eqShort && value.charAt(0) === "=") {
          value = value.slice(1);
        }
        if (value !== undefined && kind !== "other") found.push({ kind, value });
        break;
      }
    }
  }
  return found;
}

// Returns {noun, sources} for a covered git or gh command (noun names the text in a deny reason), or null when
// the segment is not covered.
function coveredSources(words) {
  const at = findProgram(words);
  if (at === -1) return null;
  const program = baseName(words[at]);
  const args = words.slice(at + 1);
  if (program === "git") {
    let i = 0;
    while (i < args.length && args[i].charAt(0) === "-") i += GIT_GLOBAL_VALUE.indexOf(args[i]) !== -1 ? 2 : 1;
    const sub = args[i];
    if (GIT_SUBCOMMANDS.indexOf(sub) === -1) return null;
    return { noun: "the commit message", sources: collectSources(args.slice(i + 1), GIT_SPEC, GIT_OTHER[sub]) };
  }
  if (program === "gh") {
    let i = 0;
    while (i < args.length && args[i].charAt(0) === "-") i += GH_GLOBAL_VALUE.indexOf(args[i]) !== -1 ? 2 : 1;
    if (args[i] !== "pr" || (args[i + 1] !== "create" && args[i + 1] !== "edit")) return null;
    return { noun: "the pull request body", sources: collectSources(args.slice(i + 2), GH_SPEC) };
  }
  return null;
}

// The string after -c in "bash -c '...'" (also -lc, -ec), or the first argument of eval; null otherwise.
function nestedScript(words) {
  const at = findProgram(words);
  if (at === -1) return null;
  const program = baseName(words[at]);
  const args = words.slice(at + 1);
  if (program === "eval") return args.length > 0 ? args.join(" ") : null;
  if (SHELLS.indexOf(program) === -1) return null;
  for (let i = 0; i < args.length; i++) {
    if (/^-[a-z]*c$/.test(args[i])) return args[i + 1] === undefined ? null : args[i + 1];
    if (args[i].charAt(0) !== "-") return null;
  }
  return null;
}

// Reads a message file: a regular file only, at most MAX_FILE_BYTES, utf8. Returns null on any problem.
function readMessageFile(file) {
  let fd = null;
  try {
    if (!fs.statSync(file).isFile()) return null;
    fd = fs.openSync(file, "r");
    const buffer = Buffer.alloc(MAX_FILE_BYTES);
    const count = fs.readSync(fd, buffer, 0, MAX_FILE_BYTES, 0);
    return buffer.toString("utf8", 0, count);
  } catch (err) {
    return null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (closeError) {
        // nothing to release
      }
    }
  }
}

// Resolves a -F argument against the hook input's cwd. Returns null when it cannot be resolved.
function resolveFile(value, cwd) {
  if (!value || value === "-" || value.indexOf("$") !== -1 || value.indexOf("\u0000") !== -1) return null;
  // A UNC path (\\host\share) would open a network share before the user's permission prompt.
  if (UNC_PATH.test(value)) return null;
  let file = null;
  if (value === "~" || value.slice(0, 2) === "~/") file = path.join(os.homedir(), value.slice(1));
  else if (path.isAbsolute(value)) file = value;
  else if (typeof cwd === "string" && path.isAbsolute(cwd)) file = path.resolve(cwd, value);
  return file === null || UNC_PATH.test(file) ? null : file;
}

// "--trailer Key=value" is the same line as "Key: value".
function trailerLine(value) {
  return value.replace(/^\s*([A-Za-z][A-Za-z0-9-]*)\s*=/, "$1:");
}

// One deny reason for all hits: [{where, rule, line}].
function describeHits(hits) {
  const lines = ["assist-plugin " + NAME + " denied this command: it carries " + hits.length + " AI attribution line" + (hits.length === 1 ? "" : "s") + (hits.length >= rules.MAX_HITS ? " (listing stops at " + rules.MAX_HITS + ")" : "") + ":"];
  hits.forEach((hit) => lines.push("- " + hit.where + " has an " + hit.rule + ": \"" + hit.line + "\""));
  lines.push(
    "Remove " + (hits.length === 1 ? "that line" : "those lines") + " from the message or body and retry. Human co-authors are allowed. " +
      "Run /assist-plugin:health to check the Claude Code attribution settings that add these lines."
  );
  return lines.join("\n");
}

// Judges the covered commands of one lexed command and adds each hit ({where, rule, line}) to hits, at most
// MAX_HITS in all.
function judgeSegments(segments, cwd, readFile, depth, hits) {
  for (let s = 0; s < segments.length && hits.length < rules.MAX_HITS; s++) {
    const words = segments[s].words;
    const covered = coveredSources(words);
    if (covered === null) {
      const script = depth < MAX_NESTING ? nestedScript(words) : null;
      if (script !== null) judgeSegments(lex(script, false), cwd, readFile, depth + 1, hits);
      continue;
    }
    for (let k = 0; k < covered.sources.length && hits.length < rules.MAX_HITS; k++) {
      const source = covered.sources[k];
      let text = null;
      let where = covered.noun;
      if (source.kind === "file") {
        if (source.value === "-") {
          text = segments[s].heredocs.join("\n");
          where = covered.noun + " (stdin text)";
        } else {
          const file = resolveFile(source.value, cwd);
          text = file === null ? null : readFile(file);
          where = covered.noun + " file " + path.basename(source.value);
        }
      } else {
        text = source.kind === "trailer" ? trailerLine(source.value) : source.value;
      }
      if (typeof text !== "string" || text === "") continue;
      rules.judgeText(text).forEach((hit) => {
        if (hits.length < rules.MAX_HITS) hits.push({ where, rule: hit.rule, line: hit.line });
      });
    }
  }
}

// Decision function. options: {readFile} replaces the disk read (tests and the health check).
function evaluate(input, options) {
  if (!input || (input.tool_name !== "Bash" && input.tool_name !== "PowerShell")) return ALLOW;
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== "string" || !MENTIONS_COMMAND.test(command)) return ALLOW;
  const readFile = options && typeof options.readFile === "function" ? options.readFile : readMessageFile;
  const hits = [];
  judgeSegments(lex(command, input.tool_name === "PowerShell"), input.cwd, readFile, 0, hits);
  return hits.length > 0 ? { deny: true, reason: describeHits(hits) } : ALLOW;
}

function main() {
  require("../lib/health.js").guard(NAME, evaluate);
}

module.exports = { NAME, evaluate, main, lex };

if (require.main === module) main();
