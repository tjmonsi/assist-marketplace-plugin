// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-248] Strict JSON parser for the governance files the plugin trusts. Spec: specs/spec-hooks-strict-json.md.
// parse(text) returns the value JSON.parse returns, and throws StrictJsonError for what JSON.parse accepts but a trusted
// file must not hold:
//   - an object that holds the same key twice, at any nesting depth (keys compare after escapes are decoded, per object);
//   - nesting deeper than MAX_DEPTH levels (objects and arrays both count; depth 32 passes, depth 33 is rejected);
// and for text JSON.parse would reject as well (reason "syntax").
// The parser makes one scan of the text, then returns JSON.parse(text) when the scan passes.
// The error holds an integer `position` (a character index into the text) and a fixed `reason` code, and its message is
// built from fixed strings and the position alone, so a rejection never quotes the input, which can hold a secret
// ([NFR-016]). The position and the message never come from a JSON.parse error, which can quote the input.
// ES5 only, no dependency, no process spawn: the module runs on the Node 6 floor [NFR-017].
"use strict";

var MAX_DEPTH = 32;
var REASONS = { duplicateKey: "duplicate-key", depth: "depth", syntax: "syntax" };
var WHITESPACE = { " ": true, "\t": true, "\n": true, "\r": true };
var SIMPLE_ESCAPES = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
var LITERALS = ["true", "false", "null"];

// The rejection error: `reason` is one of REASONS, `position` the index of the offending character.
function StrictJsonError(reason, position) {
  this.name = "StrictJsonError";
  this.message = "strict JSON rejected: " + reason + " at position " + position;
  this.reason = reason;
  this.position = position;
  if (typeof Error.captureStackTrace === "function") Error.captureStackTrace(this, StrictJsonError);
  else this.stack = new Error(this.message).stack;
}
StrictJsonError.prototype = Object.create(Error.prototype, {
  constructor: { value: StrictJsonError, writable: true, configurable: true },
});
StrictJsonError.REASONS = REASONS;

function isDigit(ch) {
  return ch >= "0" && ch <= "9";
}

function isHex(ch) {
  return isDigit(ch) || (ch >= "a" && ch <= "f") || (ch >= "A" && ch <= "F");
}

// One scan over `text`. The functions share `pos`, the index of the next unread character.
function scan(text) {
  var pos = 0;

  function fail(reason, at) {
    throw new StrictJsonError(reason, at === undefined ? pos : at);
  }

  function skipWhitespace() {
    while (pos < text.length && WHITESPACE[text.charAt(pos)] === true) pos++;
  }

  // Reads a string whose opening quote is at `pos`; returns its decoded value and leaves `pos` after the closing quote.
  function readString() {
    pos++;
    var out = "";
    var start = pos;
    for (;;) {
      if (pos >= text.length) fail(REASONS.syntax);
      var ch = text.charAt(pos);
      if (ch === '"') {
        out += text.slice(start, pos);
        pos++;
        return out;
      }
      if (ch < " ") fail(REASONS.syntax);
      if (ch !== "\\") {
        pos++;
        continue;
      }
      out += text.slice(start, pos);
      pos++;
      var escape = text.charAt(pos);
      if (Object.prototype.hasOwnProperty.call(SIMPLE_ESCAPES, escape)) {
        out += SIMPLE_ESCAPES[escape];
        pos++;
      } else if (escape === "u") {
        var digits = text.slice(pos + 1, pos + 5);
        for (var i = 0; i < 4; i++) {
          if (i >= digits.length || !isHex(digits.charAt(i))) fail(REASONS.syntax, pos + 1 + i);
        }
        out += String.fromCharCode(parseInt(digits, 16));
        pos += 5;
      } else {
        fail(REASONS.syntax);
      }
      start = pos;
    }
  }

  function skipDigits() {
    var begin = pos;
    while (pos < text.length && isDigit(text.charAt(pos))) pos++;
    if (pos === begin) fail(REASONS.syntax);
  }

  function readNumber() {
    if (text.charAt(pos) === "-") pos++;
    if (text.charAt(pos) === "0") pos++;
    else skipDigits();
    if (text.charAt(pos) === ".") {
      pos++;
      skipDigits();
    }
    if (text.charAt(pos) === "e" || text.charAt(pos) === "E") {
      pos++;
      if (text.charAt(pos) === "+" || text.charAt(pos) === "-") pos++;
      skipDigits();
    }
  }

  function readLiteral() {
    for (var i = 0; i < LITERALS.length; i++) {
      if (text.substr(pos, LITERALS[i].length) === LITERALS[i]) {
        pos += LITERALS[i].length;
        return;
      }
    }
    fail(REASONS.syntax);
  }

  function readObject(depth) {
    var seen = {};
    pos++;
    skipWhitespace();
    if (text.charAt(pos) === "}") {
      pos++;
      return;
    }
    for (;;) {
      skipWhitespace();
      if (text.charAt(pos) !== '"') fail(REASONS.syntax);
      var keyStart = pos;
      // The "$" prefix keeps a key such as "__proto__" an ordinary own property of `seen`.
      var key = "$" + readString();
      if (Object.prototype.hasOwnProperty.call(seen, key)) fail(REASONS.duplicateKey, keyStart);
      seen[key] = true;
      skipWhitespace();
      if (text.charAt(pos) !== ":") fail(REASONS.syntax);
      pos++;
      readValue(depth);
      skipWhitespace();
      var next = text.charAt(pos);
      pos++;
      if (next === "}") return;
      if (next !== ",") fail(REASONS.syntax, pos - 1);
    }
  }

  function readArray(depth) {
    pos++;
    skipWhitespace();
    if (text.charAt(pos) === "]") {
      pos++;
      return;
    }
    for (;;) {
      readValue(depth);
      skipWhitespace();
      var next = text.charAt(pos);
      pos++;
      if (next === "]") return;
      if (next !== ",") fail(REASONS.syntax, pos - 1);
    }
  }

  // `depth` is the number of containers around the value about to be read.
  function readValue(depth) {
    skipWhitespace();
    var ch = text.charAt(pos);
    if (ch === "{" || ch === "[") {
      if (depth + 1 > MAX_DEPTH) fail(REASONS.depth);
      if (ch === "{") readObject(depth + 1);
      else readArray(depth + 1);
    } else if (ch === '"') {
      readString();
    } else if (ch === "-" || isDigit(ch)) {
      readNumber();
    } else {
      readLiteral();
    }
  }

  readValue(0);
  skipWhitespace();
  if (pos < text.length) fail(REASONS.syntax);
}

// The parsed value of `text`, deep-equal to JSON.parse(text). Throws StrictJsonError for a duplicate key at any depth,
// nesting over MAX_DEPTH levels, or text that is not valid JSON; a non-string `text` is a "syntax" rejection at position 0.
function parse(text) {
  if (typeof text !== "string") throw new StrictJsonError(REASONS.syntax, 0);
  scan(text);
  return JSON.parse(text);
}

module.exports = { MAX_DEPTH: MAX_DEPTH, REASONS: REASONS, StrictJsonError: StrictJsonError, parse: parse };
