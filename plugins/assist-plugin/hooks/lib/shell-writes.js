// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-223] Shell write targets for fsa-write-bar. writeTargets(command) reads a Bash command and returns the paths
// it would write, so the bar can judge each one against the protected paths (lib/fsa-paths.js). Pure: no I/O.
//
// Forms read as writes: output redirection (`>`, `>>`, `>|`, `N>`, `>&FILE`, a here-document or here-string that feeds a
// redirected command), `tee`, `sed -i` and `perl -i`, `cp`, `mv` (its sources too, because it removes them), `rm`, and
// a few siblings that write or remove a named file the same way: `unlink`, `rmdir`, `shred`, `truncate`, `touch`, `dd of=`,
// `install`, `ln`, `curl -o`, and `wget -O`. Pure reads (`cat`, `grep`, `<` input redirection) yield no target. A target
// that is a directory the command removes or moves is marked `removes`, so the bar can also catch `rm -rf .agent`.
//
// Built on lib/shell-lex.js (segments at `;`, `&`, `|`, parentheses, and line breaks) and lib/shell-program.js (the
// program word after VAR=value words, keywords, and wrappers). Each segment is judged on its own, as the other Bash guards
// do. The lexer resolves quotes and so hides which `>` was quoted; each segment's raw text is therefore tokenized again
// here. Variables, command substitutions, and brace groups in a target are replaced with ANY (lib/fsa-paths.js); glob
// characters stay. `cd DIR` with a literal DIR moves the directory that later relative targets are read against.
// The text of a `$( )` substitution or a backtick pair is judged as a command of its own, and so is the string given to
// `eval` and to `sh -c`, `bash -c`, and the like, and the body of a here-document that feeds a shell.
//
// A `cp`, `mv`, `install`, or `ln` destination is a directory after -t, with a trailing slash, as `.` or `..`, or when it
// exists as one on disk (the bar checks); the source's name inside it is then a write target of its own.
//
// Fail-closed choices: a glob, a brace group, or a variable inside a target is kept as a pattern and judged by whether it
// could name a protected path; a `>` that sits in the middle of a word is a redirection; `>&FILE` is a redirection to FILE.
// A command that is too long or nests substitutions or shells too deeply to read is reported as `unjudgeable`, and the
// bar denies it.
//
// Known limits, recorded and not closed (FR-NFR-harness-governance.md section 4):
//   - a command built at run time: a program word or a target taken from a variable (`$CMD x`, `> "$OUT"`, where nothing
//     literal remains), `eval "$X"`, `bash -c "$X"`, and a script file the command runs;
//   - a command string passed to any other program (`python -c`, `node -e`, `awk`, `find -exec`, `xargs` fed from a
//     pipe, `git checkout -- FILE`, `rsync`, and every other program that writes a file), and a script piped into a
//     shell (`echo "..." | bash`);
//   - symlinks and other aliases of a protected path are not resolved;
//   - the main session: the shell route judges a subagent call only (FR-223, FR-245);
//   - a directory above a protected path that the command names only as `.` or a variable (`rm -rf .`), and a target made
//     only of wildcards (`rm -rf *`);
//   - PowerShell write verbs (`Set-Content`, `Out-File`, `Move-Item`): the bar is registered for Bash only.
"use strict";

const lexer = require("./shell-lex.js");
const program = require("./shell-program.js");

const ANY = "\u0001";
const MAX_COMMAND_CHARS = 200000;
const MAX_DEPTH = 4;
const SHELLS = ["sh", "bash", "zsh", "dash", "ksh", "ash"];
// Wrappers on top of the defaults of shell-program.js: sudo and exec (as the Bash guards define them) and xargs. `eval`
// is left out on purpose: it is read below as a command string.
const WRAPPERS = new Map([
  ["sudo", program.EXTRA_WRAPPERS.get("sudo")],
  ["exec", program.EXTRA_WRAPPERS.get("exec")],
  ["xargs", new Set(["-I", "-n", "-d", "-P", "-L", "-s", "-E", "-a", "-J"])],
]);
const COPY_OPTIONS = ["-t", "--target-directory", "-S", "--suffix", "-m", "--mode", "-o", "--owner", "-g", "--group"];
const REMOVE_VERBS = { rm: [], unlink: [], rmdir: [], shred: ["-n", "--iterations", "-s", "--size", "--random-source"] };
const FILE_VERBS = { truncate: ["-s", "--size", "-r", "--reference"], touch: ["-d", "--date", "-t", "-r", "--reference"] };
const COPY_VERBS = { cp: true, mv: true, install: true, ln: true };

// ---------------------------------------------------------------------------------------------
// Tokenizer for the raw text of one segment

// Index just past the `)` that closes the `(` at `open`, skipping quoted text. The end of the text when unclosed.
function balancedEnd(text, open) {
  let depth = 0;
  let i = open;
  while (i < text.length) {
    const ch = text.charAt(i);
    if (ch === "\\") {
      i += 2;
    } else if (ch === "'") {
      const close = text.indexOf("'", i + 1);
      i = close === -1 ? text.length : close + 1;
    } else if (ch === "\"") {
      i++;
      while (i < text.length && text.charAt(i) !== "\"") i += text.charAt(i) === "\\" ? 2 : 1;
      i++;
    } else {
      if (ch === "(") depth++;
      if (ch === ")") {
        depth--;
        if (depth === 0) return i + 1;
      }
      i++;
    }
  }
  return text.length;
}

// Decodes the body of an ANSI-C quote ($'...'), so $'\x44ECISIONS.md' reads as DECISIONS.md. Returns {text, next}.
function ansiC(raw, start) {
  let text = "";
  let i = start;
  const simple = { n: "\n", t: "\t", r: "\r", a: "\u0007", b: "\b", e: "\u001b", E: "\u001b", f: "\f", v: "\v" };
  while (i < raw.length && raw.charAt(i) !== "'") {
    const ch = raw.charAt(i);
    if (ch !== "\\" || i + 1 >= raw.length) {
      text += ch;
      i++;
      continue;
    }
    const next = raw.charAt(i + 1);
    let match;
    if (Object.prototype.hasOwnProperty.call(simple, next)) {
      text += simple[next];
      i += 2;
    } else if ((match = /^x([0-9A-Fa-f]{1,2})/.exec(raw.slice(i + 1, i + 4)))) {
      text += String.fromCharCode(parseInt(match[1], 16));
      i += 1 + match[0].length;
    } else if ((match = /^u([0-9A-Fa-f]{1,4})/.exec(raw.slice(i + 1, i + 6))) || (match = /^U([0-9A-Fa-f]{1,8})/.exec(raw.slice(i + 1, i + 10)))) {
      const code = parseInt(match[1], 16);
      text += code <= 0x10ffff ? String.fromCodePoint(code) : "";
      i += 1 + match[0].length;
    } else if ((match = /^([0-7]{1,3})/.exec(raw.slice(i + 1, i + 4)))) {
      text += String.fromCharCode(parseInt(match[1], 8));
      i += 1 + match[0].length;
    } else {
      text += next;
      i += 2;
    }
  }
  return { text, next: Math.min(i + 1, raw.length) };
}

// Reads the raw text of one segment into tokens: {word} for a word with quotes resolved, and {redirect, target} for an
// output redirection and its target word. Input redirections and their operands are dropped. Substitution bodies are
// pushed on `subs`. Sets tokens.dangling when the text ends in an output operator whose target is in the next segment
// (the lexer splits at `&` and `|`, so `>&FILE` and `>|FILE` arrive as two segments).
function tokenize(raw, subs) {
  const tokens = [];
  let word = null;
  let plain = true; // the word so far holds no quote or expansion
  let skipOperand = false; // the next word is the operand of an input redirection
  let pending = null; // the output operator waiting for its target word
  let i = 0;

  function append(text, quoted) {
    word = (word === null ? "" : word) + text;
    if (quoted) plain = false;
  }
  function flush() {
    if (word === null) return;
    const text = word;
    word = null;
    plain = true;
    if (skipOperand) {
      skipOperand = false;
    } else if (pending !== null) {
      const operator = pending;
      pending = null;
      // `>&2` and `>&-` duplicate or close a descriptor; they name no file.
      if (!(operator === ">&" && /^(\d+|-)$/.test(text))) tokens.push({ redirect: operator, target: text });
    } else {
      tokens.push({ word: text });
    }
  }
  // An unquoted run of digits right before an operator names a file descriptor, not an argument.
  function beforeOperator() {
    if (word !== null && plain && /^\d+$/.test(word)) {
      word = null;
    } else {
      flush();
    }
  }
  function readDollar(at, inDouble) {
    const next = raw.charAt(at + 1);
    if (next === "(") {
      const end = balancedEnd(raw, at + 1);
      subs.push(raw.slice(at + 2, raw.charAt(end - 1) === ")" ? end - 1 : end));
      append(ANY, true);
      return end;
    }
    if (next === "{") {
      const close = raw.indexOf("}", at + 2);
      append(ANY, true);
      return close === -1 ? raw.length : close + 1;
    }
    if (next === "'" && !inDouble) {
      const decoded = ansiC(raw, at + 2);
      append(decoded.text, true);
      return decoded.next;
    }
    if (next === "\"" && !inDouble) return at + 1;
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(raw.slice(at + 1, at + 200));
    if (name) {
      append(ANY, true);
      return at + 1 + name[0].length;
    }
    if (next !== "" && "0123456789@*#?$!-".indexOf(next) !== -1) {
      append(ANY, true);
      return at + 2;
    }
    append("$", false);
    return at + 1;
  }
  function readBacktick(at) {
    let j = at + 1;
    while (j < raw.length && raw.charAt(j) !== "`") j += raw.charAt(j) === "\\" ? 2 : 1;
    subs.push(raw.slice(at + 1, j));
    append(ANY, true);
    return Math.min(j + 1, raw.length);
  }
  function readDouble(at) {
    append("", true);
    let j = at + 1;
    while (j < raw.length && raw.charAt(j) !== "\"") {
      const ch = raw.charAt(j);
      if (ch === "\\" && j + 1 < raw.length) {
        const next = raw.charAt(j + 1);
        if (next !== "\n") append("\"\\$`".indexOf(next) !== -1 ? next : ch + next, true);
        j += 2;
      } else if (ch === "$") {
        j = readDollar(j, true);
      } else if (ch === "`") {
        j = readBacktick(j);
      } else {
        append(ch, true);
        j++;
      }
    }
    return Math.min(j + 1, raw.length);
  }
  // A brace group with a comma or a range (`{a,b}`, `{1..3}`) expands to several words; it counts as ANY.
  function braceEnd(at) {
    let depth = 0;
    for (let j = at; j < raw.length; j++) {
      const ch = raw.charAt(j);
      if (/\s/.test(ch)) return -1;
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) return /[,]|\.\./.test(raw.slice(at, j)) ? j + 1 : -1;
      }
    }
    return -1;
  }

  while (i < raw.length) {
    const c = raw.charAt(i);
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      flush();
      i++;
    } else if (c === "\\") {
      if (i + 1 >= raw.length) {
        i++;
      } else {
        if (raw.charAt(i + 1) !== "\n") append(raw.charAt(i + 1), true);
        i += 2;
      }
    } else if (c === "#" && word === null) {
      break;
    } else if (c === "'") {
      const close = raw.indexOf("'", i + 1);
      append(raw.slice(i + 1, close === -1 ? raw.length : close), true);
      i = close === -1 ? raw.length : close + 1;
    } else if (c === "\"") {
      i = readDouble(i);
    } else if (c === "$") {
      i = readDollar(i, false);
    } else if (c === "`") {
      i = readBacktick(i);
    } else if (c === "{" && braceEnd(i) !== -1) {
      append(ANY, true);
      i = braceEnd(i);
    } else if (c === ">") {
      beforeOperator();
      let operator = ">";
      i++;
      const after = raw.charAt(i);
      if (after === ">" || after === "|" || after === "&") {
        operator += after;
        i++;
      }
      pending = operator;
    } else if (c === "<") {
      beforeOperator();
      i++;
      while ("<-&>".indexOf(raw.charAt(i)) !== -1 && raw.charAt(i) !== "") i++;
      skipOperand = true;
    } else {
      append(c, false);
      i++;
    }
  }
  flush();
  tokens.dangling = pending !== null;
  return tokens;
}

// ---------------------------------------------------------------------------------------------
// Argument helpers

// Splits a verb's arguments into operands and the values of the options named in `valueOptions`. "--" ends the options.
// Long options take `=value` or the next word; a short option takes the rest of its cluster or the next word.
function parseArgs(args, valueOptions) {
  const operands = [];
  const values = [];
  const takes = (name) => valueOptions.indexOf(name) !== -1;
  let past = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (past || arg.length < 2 || arg.charAt(0) !== "-") {
      operands.push(arg);
    } else if (arg === "--") {
      past = true;
    } else if (arg.charAt(1) === "-") {
      const eq = arg.indexOf("=");
      const name = eq === -1 ? arg : arg.slice(0, eq);
      if (takes(name)) {
        if (eq !== -1) values.push({ option: name, value: arg.slice(eq + 1) });
        else if (i + 1 < args.length) values.push({ option: name, value: args[++i] });
      }
    } else {
      for (let k = 1; k < arg.length; k++) {
        const name = "-" + arg.charAt(k);
        if (!takes(name)) continue;
        if (k + 1 < arg.length) values.push({ option: name, value: arg.slice(k + 1) });
        else if (i + 1 < args.length) values.push({ option: name, value: args[++i] });
        break;
      }
    }
  }
  return { operands, values };
}

// The file operands of `sed -i` or `perl -i`, or [] when the command does not edit in place. The first operand is the
// script unless -e or -f gave one. Over-reading a script as a file only adds a target that is not a protected path.
function inPlaceFiles(args) {
  let inPlace = false;
  let explicitScript = false;
  let past = false;
  const operands = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (past || arg.length < 2 || arg.charAt(0) !== "-") {
      operands.push(arg);
    } else if (arg === "--") {
      past = true;
    } else if (arg.charAt(1) === "-") {
      if (/^--in-place(=|$)/.test(arg)) inPlace = true;
      else if (/^--(expression|file)(=|$)/.test(arg)) {
        explicitScript = true;
        if (arg.indexOf("=") === -1) i++;
      }
    } else {
      for (let k = 1; k < arg.length; k++) {
        const ch = arg.charAt(k);
        if (ch === "i") {
          inPlace = true;
          break;
        }
        if (ch === "e" || ch === "f") {
          explicitScript = true;
          if (k === arg.length - 1) i++;
          break;
        }
      }
    }
  }
  if (!inPlace) return [];
  return explicitScript ? operands : operands.slice(1);
}

function lastSegment(file) {
  const parts = file.split("/").filter((part) => part.length > 0);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

// The command string of a shell command line (`bash -c STRING`, `sh -lc STRING`), or null when it has none.
function commandString(args) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") return null;
    if (/^-[A-Za-z]*c[A-Za-z]*$/.test(arg)) return i + 1 < args.length ? args[i + 1] : null;
    if (arg.charAt(0) !== "-" && arg.charAt(0) !== "+") return null;
  }
  return null;
}

// Shell text found inside a here-document or here-string body: command substitutions run even there.
function substitutionsIn(text) {
  const bodies = [];
  let i = 0;
  while (i < text.length) {
    if (text.charAt(i) === "\\") {
      i += 2;
    } else if (text.charAt(i) === "$" && text.charAt(i + 1) === "(") {
      const end = balancedEnd(text, i + 1);
      bodies.push(text.slice(i + 2, text.charAt(end - 1) === ")" ? end - 1 : end));
      i = end;
    } else if (text.charAt(i) === "`") {
      const close = text.indexOf("`", i + 1);
      bodies.push(text.slice(i + 1, close === -1 ? text.length : close));
      i = close === -1 ? text.length : close + 1;
    } else {
      i++;
    }
  }
  return bodies;
}

// ---------------------------------------------------------------------------------------------
// Analysis

// Joins a relative target to the directory a preceding `cd` moved to. Absolute, home, and ANY-led targets stand alone.
function inDirectory(dir, file) {
  if (dir === "" || file === "" || file.charAt(0) === "/" || file.charAt(0) === "~" || file.charAt(0) === ANY || /^[A-Za-z]:[\\/]/.test(file)) return file;
  return dir.replace(/\/+$/, "") + "/" + file;
}

function analyze(command, depth, startDir, found) {
  if (depth > MAX_DEPTH) {
    found.unjudgeable = true;
    return;
  }
  let dir = startDir;
  let carry = false;
  const add = (file, via, removes, child) => {
    if (typeof file !== "string" || file.length === 0 || file === "-") return;
    const target = { path: inDirectory(dir, file), via, removes: removes === true, child: child !== undefined };
    if (child !== undefined) {
      target.dest = inDirectory(dir, child.dest);
      target.certainDir = child.certain;
    }
    found.targets.push(target);
  };
  const recurse = (text) => analyze(text, depth + 1, dir, found);

  function dispatch(words, heredocs) {
    const index = program.findProgram(words, { wrappers: WRAPPERS, keywords: program.KEYWORDS }).index;
    if (index === -1) return;
    const name = program.programName(words[index]);
    const args = words.slice(index + 1);
    if (name === "cd" || name === "pushd") {
      const operand = parseArgs(args, []).operands[0];
      if (operand === undefined) dir = "~";
      else if (operand.indexOf(ANY) === -1 && !/[*?[]/.test(operand) && operand !== "-") dir = inDirectory(dir, operand);
    } else if (name === "tee") {
      parseArgs(args, []).operands.forEach((file) => add(file, "tee", false));
    } else if (Object.prototype.hasOwnProperty.call(REMOVE_VERBS, name)) {
      parseArgs(args, REMOVE_VERBS[name]).operands.forEach((file) => add(file, name, true));
    } else if (Object.prototype.hasOwnProperty.call(FILE_VERBS, name)) {
      parseArgs(args, FILE_VERBS[name]).operands.forEach((file) => add(file, name, false));
    } else if (name === "sed" || name === "perl") {
      inPlaceFiles(args).forEach((file) => add(file, name + " -i", false));
    } else if (Object.prototype.hasOwnProperty.call(COPY_VERBS, name)) {
      const parsed = parseArgs(args, COPY_OPTIONS);
      const dirs = parsed.values.filter((entry) => entry.option === "-t" || entry.option === "--target-directory").map((entry) => entry.value);
      let sources = parsed.operands;
      if (dirs.length === 0 && parsed.operands.length >= 2) {
        dirs.push(parsed.operands[parsed.operands.length - 1]);
        sources = parsed.operands.slice(0, -1);
      } else if (dirs.length === 0) {
        sources = [];
      }
      // The destination may be a file or a directory; as a directory it receives each source under the source's name.
      // It is certainly a directory after -t, with a trailing slash, or as `.` or `..`; otherwise the bar asks the file system.
      const byOption = parsed.values.some((entry) => entry.option === "-t" || entry.option === "--target-directory");
      dirs.forEach((destination) => {
        add(destination, name, false);
        const certain = byOption || /(^|\/)\.{0,2}\/*$/.test(destination);
        sources.forEach((source) => {
          const base = lastSegment(source);
          if (base !== "" && base !== ".." && base !== ".") add(destination.replace(/\/+$/, "") + "/" + base, name, false, { dest: destination, certain });
        });
      });
      if (name === "mv") sources.forEach((source) => add(source, "mv", true));
    } else if (name === "dd") {
      args.forEach((arg) => {
        if (arg.indexOf("of=") === 0) add(arg.slice(3), "dd", false);
      });
    } else if (name === "curl" || name === "wget") {
      const options = name === "curl" ? ["-o", "--output"] : ["-O", "--output-document"];
      parseArgs(args, options).values.forEach((entry) => add(entry.value, name, false));
    } else if (name === "eval") {
      recurse(args.join(" "));
    } else if (SHELLS.indexOf(name) !== -1) {
      const text = commandString(args);
      if (text !== null) recurse(text);
      else (heredocs || []).forEach(recurse);
    }
  }

  const segments = lexer.lex(command, false, true);
  segments.forEach((segment) => {
    const subs = [];
    const tokens = tokenize(typeof segment.raw === "string" ? segment.raw : segment.words.join(" "), subs);
    const words = tokens.filter((token) => token.word !== undefined).map((token) => token.word);
    // A target cut off by a separator (`>|FILE`, `>&FILE`) is the first word of the next segment. That word is also read
    // as the start of a command, so `>(tee FILE)` still reaches `tee`.
    if (carry && tokens.length > 0) {
      const first = tokens[0].word !== undefined ? tokens[0].word : tokens[0].target;
      if (first !== undefined) add(first, "redirection", false);
    }
    carry = tokens.dangling === true;
    tokens.forEach((token) => {
      if (token.redirect !== undefined) add(token.target, "redirection", false);
    });
    dispatch(words, segment.heredocs);
    subs.forEach(recurse);
    (segment.heredocs || []).forEach((body) => substitutionsIn(body).forEach(recurse));
  });
}

// [FR-223] The write targets of a Bash command: {targets: [{path, via, removes, child, dest, certainDir}], unjudgeable}. `path` is as written,
// with ANY for each variable, substitution, or brace group and a relative path joined to the literal `cd` directory before it.
// `via` names the construct. `removes` marks a path the command removes or moves away. `child` marks the path a source
// file would take if the destination of `cp`, `mv`, `install`, or `ln` is a directory (the destination plus the source's
// name); such a target also carries `dest` and `certainDir` (true when the destination is certainly a directory: after -t,
// with a trailing slash, or as `.` or `..`). `unjudgeable` is true for a command
// that is too long or too deeply nested to read. Throws a TypeError for a command that is not a string.
function writeTargets(command) {
  if (typeof command !== "string") throw new TypeError("shell command must be a string");
  const found = { targets: [], unjudgeable: false };
  if (command.length > MAX_COMMAND_CHARS) {
    found.unjudgeable = true;
    return found;
  }
  analyze(command, 0, "", found);
  const seen = new Set();
  found.targets = found.targets.filter((target) => {
    const key = target.path + "\u0000" + target.via + "\u0000" + target.removes + "\u0000" + target.child;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return found;
}

module.exports = { ANY, MAX_COMMAND_CHARS, MAX_DEPTH, writeTargets };
