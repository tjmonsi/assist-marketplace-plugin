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

const NAME = "commit-attribution-guard";
const ALLOW = { deny: false, reason: "" };
const MAX_FILE_BYTES = 64 * 1024;
const MAX_NESTING = 2;
const UNC_PATH = /^[\\/]{2}/;
const GIT_SUBCOMMANDS = ["commit", "merge"];
const MENTIONS_COMMAND = /(^|[^a-z0-9_])(git|gh)(\.exe)?([^a-z0-9_]|$)/i;
const SHELLS = ["sh", "bash", "zsh", "dash", "ksh"];
const WORD_BREAK = /[\s;&|()<>]/;

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
// Shell lexer. Splits a command into segments (at ; & | ( ) and newlines) of words with quotes resolved.
// Quoted text is kept verbatim, including $( ... ) substitutions, which are only scanned to find their end.
// Not a full shell: it exists to find message arguments, and anything it cannot read is skipped.

// Reads one heredoc body from index start (the first character after the newline). Returns {body, next}.
function readHeredoc(cmd, start, delim, strip) {
  const lines = [];
  let i = start;
  while (i < cmd.length) {
    let end = cmd.indexOf("\n", i);
    if (end === -1) end = cmd.length;
    let line = cmd.slice(i, end);
    if (line.charAt(line.length - 1) === "\r") line = line.slice(0, -1);
    i = Math.min(end + 1, cmd.length);
    if ((strip ? line.replace(/^\t+/, "") : line) === delim) return { body: lines.join("\n"), next: i };
    lines.push(line);
  }
  return { body: lines.join("\n"), next: cmd.length };
}

// Parses a heredoc operator at index i ("<<", "<<-", then the delimiter). Returns {delim, strip, next} or null.
function parseHeredocStart(cmd, i) {
  if (cmd.substr(i, 2) !== "<<" || cmd.charAt(i + 2) === "<") return null;
  let j = i + 2;
  const strip = cmd.charAt(j) === "-";
  if (strip) j++;
  while (cmd.charAt(j) === " " || cmd.charAt(j) === "\t") j++;
  let delim = "";
  while (j < cmd.length) {
    const ch = cmd.charAt(j);
    if (ch === "'" || ch === "\"") {
      const close = cmd.indexOf(ch, j + 1);
      if (close === -1) return null;
      delim += cmd.slice(j + 1, close);
      j = close + 1;
    } else if (ch === "\\" && j + 1 < cmd.length) {
      delim += cmd.charAt(j + 1);
      j += 2;
    } else if (WORD_BREAK.test(ch)) {
      break;
    } else {
      delim += ch;
      j++;
    }
  }
  return delim ? { delim, strip, next: j } : null;
}

// Index just past a double-quoted string that starts at i (the opening quote), honoring $( ) inside it.
function skipDouble(cmd, i) {
  let j = i + 1;
  while (j < cmd.length) {
    const ch = cmd.charAt(j);
    if (ch === "\\") j += 2;
    else if (ch === "\"") return j + 1;
    else if (ch === "$" && cmd.charAt(j + 1) === "(") j = skipSubstitution(cmd, j);
    else j++;
  }
  return cmd.length;
}

// Index just past a $( ... ) substitution that starts at i (the dollar sign). Quotes, nested substitutions, and
// heredoc bodies inside it are skipped, so an apostrophe in a heredoc does not end the scan early.
function skipSubstitution(cmd, i) {
  let j = i + 2;
  let depth = 1;
  const pending = [];
  while (j < cmd.length) {
    const ch = cmd.charAt(j);
    if (ch === "\\") {
      j += 2;
    } else if (ch === "'") {
      const close = cmd.indexOf("'", j + 1);
      j = close === -1 ? cmd.length : close + 1;
    } else if (ch === "\"") {
      j = skipDouble(cmd, j);
    } else if (ch === "`") {
      const close = cmd.indexOf("`", j + 1);
      j = close === -1 ? cmd.length : close + 1;
    } else if (ch === "(") {
      depth++;
      j++;
    } else if (ch === ")") {
      depth--;
      j++;
      if (depth === 0) return j;
    } else if (ch === "<" && cmd.charAt(j + 1) === "<") {
      const start = parseHeredocStart(cmd, j);
      if (start) {
        pending.push(start);
        j = start.next;
      } else {
        j += cmd.charAt(j + 2) === "<" ? 3 : 2;
      }
    } else if (ch === "\n") {
      j++;
      while (pending.length > 0) {
        const doc = pending.shift();
        j = readHeredoc(cmd, j, doc.delim, doc.strip).next;
      }
    } else {
      j++;
    }
  }
  return cmd.length;
}

const ANSI_ESCAPES = { n: "\n", t: "\t", r: "\r", "\\": "\\", "'": "'", "\"": "\"" };

function lex(cmd, powershell) {
  const segments = [];
  const pending = [];
  let seg = { words: [], heredocs: [] };
  let word = null;
  let hereString = null; // the segment whose here-string (<<<) word is still to come
  let i = 0;

  function endWord() {
    if (word !== null) {
      // The word after <<< is the command's stdin text, not an argument.
      if (hereString !== null) hereString.heredocs.push(word);
      else seg.words.push(word);
      hereString = null;
    }
    word = null;
  }
  function endSegment() {
    endWord();
    hereString = null;
    if (seg.words.length > 0) segments.push(seg);
    seg = { words: [], heredocs: [] };
  }
  function append(text) {
    word = (word === null ? "" : word) + text;
  }

  while (i < cmd.length) {
    const c = cmd.charAt(i);
    const heredoc = !powershell && c === "<" ? parseHeredocStart(cmd, i) : null;
    if (c === " " || c === "\t") {
      endWord();
      i++;
    } else if (c === "\r" && cmd.charAt(i + 1) === "\n") {
      i++;
    } else if (c === "\n" || c === "\r") {
      endSegment();
      i++;
      while (pending.length > 0) {
        const doc = pending.shift();
        const read = readHeredoc(cmd, i, doc.delim, doc.strip);
        doc.owner.heredocs.push(read.body);
        i = read.next;
      }
    } else if (c === "#" && word === null) {
      while (i < cmd.length && cmd.charAt(i) !== "\n") i++;
    } else if (c === ";" || c === "|" || c === "&" || c === "(" || c === ")") {
      endSegment();
      i++;
    } else if (!powershell && c === "<" && cmd.substr(i, 3) === "<<<") {
      endWord();
      hereString = seg;
      i += 3;
    } else if (heredoc) {
      endWord();
      pending.push({ delim: heredoc.delim, strip: heredoc.strip, owner: seg });
      i = heredoc.next;
    } else if ((powershell ? c === "`" : c === "\\") && i + 1 < cmd.length) {
      const next = cmd.charAt(i + 1);
      if (next === "\n") {
        i += 2;
      } else if (powershell) {
        append(next === "n" ? "\n" : next === "t" ? "\t" : next === "r" ? "\r" : next);
        i += 2;
      } else {
        append(next);
        i += 2;
      }
    } else if (c === "'") {
      let j = i + 1;
      let text = "";
      while (j < cmd.length) {
        if (cmd.charAt(j) === "'") {
          if (powershell && cmd.charAt(j + 1) === "'") {
            text += "'";
            j += 2;
            continue;
          }
          break;
        }
        text += cmd.charAt(j);
        j++;
      }
      append(text);
      i = j + 1;
    } else if (c === "\"") {
      const end = powershell ? skipPowershellDouble(cmd, i) : skipDouble(cmd, i);
      const closed = end - 1 > i && cmd.charAt(end - 1) === "\"";
      const raw = cmd.slice(i + 1, closed ? end - 1 : end);
      append(powershell ? unescapePowershell(raw) : unescapeDouble(raw));
      i = end;
    } else if (!powershell && c === "$" && cmd.charAt(i + 1) === "'") {
      let j = i + 2;
      let text = "";
      while (j < cmd.length && cmd.charAt(j) !== "'") {
        if (cmd.charAt(j) === "\\" && j + 1 < cmd.length) {
          const next = cmd.charAt(j + 1);
          text += Object.prototype.hasOwnProperty.call(ANSI_ESCAPES, next) ? ANSI_ESCAPES[next] : "\\" + next;
          j += 2;
        } else {
          text += cmd.charAt(j);
          j++;
        }
      }
      append(text);
      i = j + 1;
    } else if (c === "$" && cmd.charAt(i + 1) === "(") {
      const end = skipSubstitution(cmd, i);
      append(cmd.slice(i, end));
      i = end;
    } else if (!powershell && c === "`") {
      const close = cmd.indexOf("`", i + 1);
      const end = close === -1 ? cmd.length : close + 1;
      append(cmd.slice(i, end));
      i = end;
    } else if (powershell && c === "@" && word === null && (cmd.charAt(i + 1) === "'" || cmd.charAt(i + 1) === "\"") && /^[ \t]*\r?\n/.test(cmd.substr(i + 2, 64))) {
      const quote = cmd.charAt(i + 1);
      const bodyStart = cmd.indexOf("\n", i + 2) + 1;
      const close = cmd.indexOf("\n" + quote + "@", bodyStart - 1);
      const end = close === -1 ? cmd.length : close;
      append(cmd.slice(bodyStart, Math.max(bodyStart, end)).replace(/\r$/, ""));
      i = close === -1 ? cmd.length : close + 3;
    } else {
      append(c);
      i++;
    }
  }
  endSegment();
  return segments;
}

// PowerShell double quotes: a backtick escapes the next character and "" is a quote.
function skipPowershellDouble(cmd, i) {
  let j = i + 1;
  while (j < cmd.length) {
    const ch = cmd.charAt(j);
    if (ch === "`") j += 2;
    else if (ch === "\"" && cmd.charAt(j + 1) === "\"") j += 2;
    else if (ch === "\"") return j + 1;
    else j++;
  }
  return cmd.length;
}

function unescapePowershell(raw) {
  return raw.replace(/`(.)|""/g, function (match, ch) {
    if (match === "\"\"") return "\"";
    return ch === "n" ? "\n" : ch === "t" ? "\t" : ch === "r" ? "\r" : ch;
  });
}

// Inside bash double quotes a backslash only escapes " \ $ ` and a newline; $( ) text stays as written.
function unescapeDouble(raw) {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    const ch = raw.charAt(i);
    if (ch === "$" && raw.charAt(i + 1) === "(") {
      const end = skipSubstitution(raw, i);
      out += raw.slice(i, end);
      i = end;
    } else if (ch === "\\" && i + 1 < raw.length) {
      const next = raw.charAt(i + 1);
      if (next === "\n") out += "";
      else out += "\"\\$`".indexOf(next) !== -1 ? next : ch + next;
      i += 2;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

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
