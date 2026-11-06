// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// The session purpose record: one JSON file, .agent/governance/session-purpose.json under the project root.
// Record: {purpose, writer: "hook", session_id, timestamp}. It holds the purpose the user declared and the writer, plus
// the session and the time it was written for. It never holds the surrounding prompt text [NFR-031].
//   Write API  recordPurpose(fields, options): used only by the UserPromptSubmit purpose-capture hook, the sole writer
//              [FR-247]. It writes with fs, so the tool-level deny of fsa-write-bar (every caller, the main session
//              included) does not stop it, and no model output or PR, web, or file text can create or alter the record.
//   Read API   readPurposeRecord(options) and currentPurpose(options): used by the access-logging hooks [FR-230]
//              [FR-232]. currentPurpose returns the purpose or "unstated" when there is no usable record. The reads never
//              throw. A missing, unreadable, malformed, or not hook-written record is no record, so the access log shows
//              "unstated" and flags it; a missing purpose never denies an access.
// A record is bound to the session that wrote it. When options.sessionId is given, a record of another session is no
// record, so a purpose declared yesterday does not label today's access. One project holds one record: two sessions on
// one project overwrite each other, and the older one then reads "unstated" (a recorded limit, the safe direction).
// Callers pass options: {root, sessionId, now, log}. `root` is the absolute project root that holds .agent/. `now` is a
// function that returns milliseconds (tests). `log` receives one structured entry {level, event, ...fields} per problem;
// an entry never holds the purpose or any prompt text. Paths are used as given: symlinks are not resolved.
// CommonJS, ES2015 syntax, no dependencies; it runs from Node 6.
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const RECORD_DIR = path.join(".agent", "governance");
const RECORD_FILE = "session-purpose.json";
// The record path relative to the project root, with forward slashes (the form the write guard lists use).
const RECORD_PATH = ".agent/governance/" + RECORD_FILE;

const UNSTATED = "unstated";
const WRITER = "hook";
const MAX_PURPOSE_CHARS = 200;
const MAX_RECORD_BYTES = 4096;

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
// A session id is a short identifier with no whitespace, so prompt text does not fit in one.
const SESSION_PATTERN = /^[A-Za-z0-9._:#/-]{1,128}$/;

class PurposeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PurposeError";
    this.code = code;
  }
}

// Reports one problem to options.log. A failing logger must never break the record.
function note(options, level, event, fields) {
  try {
    if (options && typeof options.log === "function") options.log(Object.assign({ level, event }, fields));
  } catch (err) {
    // The logger failed; the record code carries on.
  }
}

function errorCode(err) {
  return err && typeof err.code === "string" ? err.code : "unknown";
}

function rootOf(options) {
  const root = options && options.root;
  if (typeof root !== "string" || root.length === 0 || !path.isAbsolute(root)) {
    throw new PurposeError("bad-root", "options.root must be an absolute path");
  }
  return root;
}

function nowMs(options) {
  const value = options && typeof options.now === "function" ? options.now() : Date.now();
  return Number.isFinite(value) ? value : Date.now();
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// [FR-247] A usable purpose: one line of 1 to 200 characters with no control character, trimmed, and not the word the
// access log uses for "none declared" (so "unstated" always means no purpose).
function validPurpose(value) {
  return typeof value === "string" && value === value.trim() && value.length > 0 && value.length <= MAX_PURPOSE_CHARS &&
    !CONTROL_CHARS.test(value) && value.toLowerCase() !== UNSTATED;
}

function validSession(value) {
  return typeof value === "string" && SESSION_PATTERN.test(value);
}

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

// A record is usable only when it has the shape recordPurpose writes, so a hand-made or altered file is no record.
function validRecord(record) {
  return isRecord(record) && validPurpose(record.purpose) && record.writer === WRITER && validSession(record.session_id) &&
    validTimestamp(record.timestamp);
}

// [FR-247] Read API: the record as {purpose, writer, session_id, timestamp}, or null. With options.sessionId, a record of
// another session is null. Never throws.
function readPurposeRecord(options) {
  try {
    const file = path.join(rootOf(options), RECORD_DIR, RECORD_FILE);
    let text;
    try {
      const stat = fs.statSync(file);
      if (!stat.isFile() || stat.size > MAX_RECORD_BYTES) {
        note(options, "warn", "purpose-record-unusable", { reason: "not a small file" });
        return null;
      }
      text = fs.readFileSync(file, "utf8");
    } catch (err) {
      if (errorCode(err) !== "ENOENT") note(options, "error", "purpose-read-failed", { code: errorCode(err), message: err && err.message });
      return null;
    }
    let record;
    try {
      record = JSON.parse(text);
    } catch (err) {
      note(options, "warn", "purpose-record-unusable", { reason: "not valid JSON" });
      return null;
    }
    if (!validRecord(record)) {
      note(options, "warn", "purpose-record-unusable", { reason: "not a hook-written record" });
      return null;
    }
    const wanted = options && options.sessionId;
    if (typeof wanted === "string" && record.session_id !== wanted) return null;
    return { purpose: record.purpose, writer: record.writer, session_id: record.session_id, timestamp: record.timestamp };
  } catch (err) {
    note(options, "error", "purpose-read-failed", { code: errorCode(err), message: err && err.message });
    return null;
  }
}

// [FR-230] [FR-232] Read API for the access-logging hooks: the declared purpose, or "unstated" when there is no usable
// record. The caller flags the access record when the result is UNSTATED, and never denies on it.
function currentPurpose(options) {
  const record = readPurposeRecord(options);
  return record ? record.purpose : UNSTATED;
}

// Creates `dir` and its missing parents (mode 0700). fs.mkdirSync(dir, {recursive: true}) needs Node 10.12 and this code
// runs from Node 6, so the parents are created one by one.
function makeDirs(dir) {
  if (fs.existsSync(dir)) return;
  const parent = path.dirname(dir);
  if (parent !== dir) makeDirs(parent);
  try {
    fs.mkdirSync(dir, 0o700);
  } catch (err) {
    if (errorCode(err) !== "EEXIST") throw err;
  }
}

// Writes `text` to `file` through a temporary file in the same directory, so a reader never sees half a record.
function writeAtomic(file, text) {
  const temp = file + "." + process.pid + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
  try {
    fs.writeFileSync(temp, text, { encoding: "utf8", mode: 0o600, flag: "wx" });
    fs.renameSync(temp, file);
  } catch (err) {
    try {
      fs.unlinkSync(temp);
    } catch (cleanup) {
      // The temporary file was never created, or is already gone.
    }
    throw err;
  }
}

// [FR-247] Write API for the UserPromptSubmit purpose-capture hook, the only writer of the record. fields:
// {purpose, sessionId}. The new record replaces the old one (the latest declaration of the project wins). Throws a
// PurposeError when a field is invalid or the file cannot be written; the caller then leaves the record as it was.
function recordPurpose(fields, options) {
  const input = isRecord(fields) ? fields : {};
  if (!validPurpose(input.purpose)) throw new PurposeError("bad-field", "invalid purpose");
  if (!validSession(input.sessionId)) throw new PurposeError("bad-field", "invalid sessionId");
  const record = { purpose: input.purpose, writer: WRITER, session_id: input.sessionId, timestamp: new Date(nowMs(options)).toISOString() };
  try {
    const dir = path.join(rootOf(options), RECORD_DIR);
    makeDirs(dir);
    writeAtomic(path.join(dir, RECORD_FILE), JSON.stringify(record) + "\n");
  } catch (err) {
    if (err instanceof PurposeError) throw err;
    note(options, "error", "purpose-write-failed", { code: errorCode(err), message: err && err.message });
    throw new PurposeError("write-failed", "cannot write " + RECORD_FILE + ": " + errorCode(err));
  }
  return record;
}

module.exports = {
  RECORD_DIR, RECORD_FILE, RECORD_PATH, UNSTATED, WRITER, MAX_PURPOSE_CHARS, PurposeError,
  validPurpose, readPurposeRecord, currentPurpose, recordPurpose,
};
