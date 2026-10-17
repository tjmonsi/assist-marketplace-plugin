// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-094] Shell lexer shared by commit-attribution-guard and doc-cli-guard. Splits a Bash or PowerShell command
// into segments (at ; & | ( ) and line breaks) of words with quotes resolved. Quoted text is kept verbatim,
// including $( ... ) substitutions, which are only scanned to find their end. Heredoc (<<, <<-), here-string
// (<<<, PowerShell @' '@ and @" "@) bodies attach to their segment as stdin text and are never words.
// Not a full shell: it exists to find message arguments and program words, and anything it cannot read is
// skipped. Pure: no I/O, no dependencies.
//
// lex(command, powershell, raw) -> [{words, heredocs}]. With raw off (the default) the segments are exactly
// those of 1.11.1. With raw true, each segment also carries raw, the part's text as written, trimmed of
// surrounding blanks: it starts where the lexer reads the segment's first character (after the separator and
// after any heredoc bodies consumed there) and ends at the next separator. A heredoc body is never part of any
// raw; the heredoc operator stays in the raw of the part that opened it. A comment stays in raw. With raw true,
// PowerShell segments also end at { and } outside quotes, so a script block body is a part of its own.
"use strict";

const WORD_BREAK = /[\s;&|()<>]/;

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

function lex(cmd, powershell, raw) {
  const segments = [];
  const pending = [];
  const withRaw = raw === true;
  let seg = { words: [], heredocs: [] };
  let word = null;
  let hereString = null; // the segment whose here-string (<<<) word is still to come
  let segBegin = 0; // index where the current segment's text starts (used when raw is on)
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
  // end is the index just past the segment's text (the separator's index).
  function endSegment(end) {
    endWord();
    hereString = null;
    if (seg.words.length > 0) {
      if (withRaw) seg.raw = cmd.slice(segBegin, end).trim();
      segments.push(seg);
    }
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
      endSegment(i);
      i++;
      while (pending.length > 0) {
        const doc = pending.shift();
        const read = readHeredoc(cmd, i, doc.delim, doc.strip);
        doc.owner.heredocs.push(read.body);
        i = read.next;
      }
      segBegin = i;
    } else if (c === "#" && word === null) {
      while (i < cmd.length && cmd.charAt(i) !== "\n") i++;
    } else if (c === ";" || c === "|" || c === "&" || c === "(" || c === ")" || (withRaw && powershell && (c === "{" || c === "}"))) {
      endSegment(i);
      i++;
      segBegin = i;
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
      const body = cmd.slice(i + 1, closed ? end - 1 : end);
      append(powershell ? unescapePowershell(body) : unescapeDouble(body));
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
  endSegment(cmd.length);
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

function unescapePowershell(text) {
  return text.replace(/`(.)|""/g, function (match, ch) {
    if (match === "\"\"") return "\"";
    return ch === "n" ? "\n" : ch === "t" ? "\t" : ch === "r" ? "\r" : ch;
  });
}

// Inside bash double quotes a backslash only escapes " \ $ ` and a newline; $( ) text stays as written.
function unescapeDouble(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text.charAt(i);
    if (ch === "$" && text.charAt(i + 1) === "(") {
      const end = skipSubstitution(text, i);
      out += text.slice(i, end);
      i = end;
    } else if (ch === "\\" && i + 1 < text.length) {
      const next = text.charAt(i + 1);
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

module.exports = { lex };
