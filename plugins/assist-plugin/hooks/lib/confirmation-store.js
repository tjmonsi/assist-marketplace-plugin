// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// The confirmation store: the directory .agent/governance/confirmations/ with two JSONL files, one record per line.
//   confirmations.jsonl  the user's PR-verdict confirmations. Written only by the UserPromptSubmit confirmation hook
//                        (recordConfirmation), with fs, so the tool-level deny of fsa-write-bar does not stop it. The
//                        FR-214 PR-verdict guard reads this file and no other (readConfirmations, findConfirmation).
//                        Record: {pr, verdict, timestamp, user_message_ref, writer: "hook"}. It holds a reference to
//                        the user's message, never the message text [NFR-031].
//   pending.jsonl        the pending PR-verdict actions that the main-session /do orchestrator creates (createPending).
//                        Record: {pr, verdict, token, session_id, created_at}, plus {used: true, used_at} once the token
//                        is consumed. A pending record carries no authority: only a confirmation record does.
// A confirmation is bound to one pending action by its token. findPending(token, sessionId) returns the pending record
// only while it is unused and younger than the expiry window; an expired, used, unknown, or other-session token is no
// match. The hook then writes the confirmation and calls markPendingUsed. The used record stays in the file for audit.
// Callers pass options: {root, now, expiryMs, log}. `root` is the absolute project root that holds .agent/. `now` is
// a function that returns milliseconds (tests). `log` receives one structured entry {level, event, ...fields} per
// problem; entries never hold a token, a PR, or a message. The reads never throw: a missing, unreadable, or malformed
// file yields no records, which the guard treats as no confirmation (fail closed). The writes throw a StoreError.
// Paths are used as given: symlinks are not resolved. CommonJS, ES2015 syntax, no dependencies.
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const STORE_DIR = path.join(".agent", "governance", "confirmations");
const CONFIRMATIONS_FILE = "confirmations.jsonl";
const PENDING_FILE = "pending.jsonl";

// [FR-242] How long a pending action stays confirmable. 5 minutes is an estimate, not a measured figure, until it is
// set against the NFR budget; a caller overrides it with options.expiryMs.
const PENDING_EXPIRY_MS = 5 * 60 * 1000;

// [FR-242] Token format: 6 characters from a 32-symbol alphabet without I and O, so the user can type it from the
// draft that /do shows. 32 divides 256, so a random byte maps to a symbol without bias. Only an unguessable value
// binds a confirmation to one action, which is why the value comes from crypto.randomBytes.
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TOKEN_LENGTH = 6;
const TOKEN_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

// [NFR-031] A reference is a short identifier with no whitespace, so message text does not fit in one.
const REFERENCE_PATTERN = /^[A-Za-z0-9._:#/-]{1,128}$/;
const VERDICT_PATTERN = /^[a-z][a-z-]{0,31}$/;
const MAX_PR_CHARS = 200;
const TOKEN_ATTEMPTS = 5;
const WRITER = "hook";

class StoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StoreError";
    this.code = code;
  }
}

// Reports one problem to options.log. A failing logger must never break the store.
function note(options, level, event, fields) {
  try {
    if (options && typeof options.log === "function") options.log(Object.assign({ level, event }, fields));
  } catch (err) {
    // The logger failed; the store carries on.
  }
}

function errorCode(err) {
  return err && typeof err.code === "string" ? err.code : "unknown";
}

function rootOf(options) {
  const root = options && options.root;
  if (typeof root !== "string" || root.length === 0 || !path.isAbsolute(root)) {
    throw new StoreError("bad-root", "options.root must be an absolute path");
  }
  return root;
}

function storeDir(options) {
  return path.join(rootOf(options), STORE_DIR);
}

function nowMs(options) {
  const value = options && typeof options.now === "function" ? options.now() : Date.now();
  return Number.isFinite(value) ? value : Date.now();
}

function expiryMs(options) {
  const value = options && options.expiryMs;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : PENDING_EXPIRY_MS;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validPr(value) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_PR_CHARS && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
}

// A PR given as a number (42) or a string ("owner/repo#42") is stored as a string.
function prText(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value) : value;
}

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function requireField(ok, name) {
  if (!ok) throw new StoreError("bad-field", "invalid " + name);
}

// Splits JSONL text into parsed objects. Returns {records, skipped}: a blank line is ignored, an unparseable or
// non-object line counts as skipped.
function parseLines(text) {
  const records = [];
  let skipped = 0;
  text.split("\n").forEach((line) => {
    if (line.trim().length === 0) return;
    try {
      const value = JSON.parse(line);
      if (isRecord(value)) records.push(value);
      else skipped++;
    } catch (err) {
      skipped++;
    }
  });
  return { records, skipped };
}

// The parsed records of one store file, [] when the file is missing or unreadable.
function readRecords(options, name) {
  let text;
  try {
    text = fs.readFileSync(path.join(storeDir(options), name), "utf8");
  } catch (err) {
    if (errorCode(err) !== "ENOENT") note(options, "error", "store-read-failed", { file: name, code: errorCode(err), message: err && err.message });
    return [];
  }
  const parsed = parseLines(text);
  if (parsed.skipped > 0) note(options, "warn", "store-lines-skipped", { file: name, count: parsed.skipped });
  return parsed.records;
}

function validConfirmation(record) {
  return validPr(record.pr) && VERDICT_PATTERN.test(String(record.verdict)) && validTimestamp(record.timestamp) &&
    REFERENCE_PATTERN.test(String(record.user_message_ref)) && record.writer === WRITER;
}

function validPending(record) {
  return validPr(record.pr) && VERDICT_PATTERN.test(String(record.verdict)) && TOKEN_PATTERN.test(String(record.token)) &&
    REFERENCE_PATTERN.test(String(record.session_id)) && validTimestamp(record.created_at);
}

// [FR-214] [FR-242] Read API for the PR-verdict guard: the valid records of confirmations.jsonl, and nothing from
// pending.jsonl. A record that is not shaped like a hook-written confirmation is dropped.
function readConfirmations(options) {
  try {
    return readRecords(options, CONFIRMATIONS_FILE).filter(validConfirmation);
  } catch (err) {
    note(options, "error", "store-read-failed", { file: CONFIRMATIONS_FILE, code: errorCode(err), message: err && err.message });
    return [];
  }
}

// [FR-214] The newest confirmation for exactly this PR and verdict, or null.
function findConfirmation(pr, verdict, options) {
  const wanted = String(prText(pr));
  const found = readConfirmations(options).filter((record) => record.pr === wanted && record.verdict === verdict);
  return found.length > 0 ? found[found.length - 1] : null;
}

// Creates `dir` and its missing parents (mode 0700). fs.mkdirSync(dir, {recursive: true}) needs Node 10.12, and the
// hooks that write the store run from Node 6, so the parents are created one by one.
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

// Appends one JSON line, creating the store directory (mode 0700) and the file (mode 0600) on first use.
function appendLine(options, name, record) {
  try {
    const dir = storeDir(options);
    makeDirs(dir);
    fs.appendFileSync(path.join(dir, name), JSON.stringify(record) + "\n", { encoding: "utf8", mode: 0o600 });
  } catch (err) {
    if (err instanceof StoreError) throw err;
    note(options, "error", "store-write-failed", { file: name, code: errorCode(err), message: err && err.message });
    throw new StoreError("write-failed", "cannot write " + name + ": " + errorCode(err));
  }
}

// [FR-242] Write API for the UserPromptSubmit hook, the only writer of confirmations.jsonl. fields:
// {pr, verdict, userMessageRef}. The record holds a reference to the user's message, never its text [NFR-031].
function recordConfirmation(fields, options) {
  const input = isRecord(fields) ? fields : {};
  const pr = prText(input.pr);
  requireField(validPr(pr), "pr");
  requireField(typeof input.verdict === "string" && VERDICT_PATTERN.test(input.verdict), "verdict");
  requireField(typeof input.userMessageRef === "string" && REFERENCE_PATTERN.test(input.userMessageRef), "userMessageRef");
  const record = { pr, verdict: input.verdict, timestamp: new Date(nowMs(options)).toISOString(), user_message_ref: input.userMessageRef, writer: WRITER };
  appendLine(options, CONFIRMATIONS_FILE, record);
  return record;
}

// [FR-242] A fresh token: TOKEN_LENGTH symbols from crypto.randomBytes.
function newToken() {
  const bytes = crypto.randomBytes(TOKEN_LENGTH);
  let token = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) token += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  return token;
}

// Matches a pending record that has not been used and has not expired. A missing or unreadable creation timestamp,
// and one in the future, count as expired (fail closed).
function usable(record, options) {
  if (record.used === true) return false;
  const age = nowMs(options) - Date.parse(record.created_at);
  return age >= 0 && age < expiryMs(options);
}

// [FR-242] Write API for the main-session /do orchestrator. fields: {pr, verdict, sessionId}. Returns the pending
// record, whose token /do shows to the user next to the draft. A token that an unused, unexpired record of the same
// session already holds is not reused.
function createPending(fields, options) {
  const input = isRecord(fields) ? fields : {};
  const pr = prText(input.pr);
  requireField(validPr(pr), "pr");
  requireField(typeof input.verdict === "string" && VERDICT_PATTERN.test(input.verdict), "verdict");
  requireField(typeof input.sessionId === "string" && REFERENCE_PATTERN.test(input.sessionId), "sessionId");
  const open = readRecords(options, PENDING_FILE).filter((record) => validPending(record) && usable(record, options)).map((record) => record.token);
  let token = newToken();
  for (let attempt = 1; open.indexOf(token) !== -1; attempt++) {
    if (attempt >= TOKEN_ATTEMPTS) throw new StoreError("token-collision", "cannot draw an unused token");
    token = newToken();
  }
  const record = { pr, verdict: input.verdict, token, session_id: input.sessionId, created_at: new Date(nowMs(options)).toISOString() };
  appendLine(options, PENDING_FILE, record);
  return record;
}

// [FR-242] Matches a token and a session_id to a pending record. An expired token, a used token, an unknown token, a
// token of another session, and a malformed token all return null. Returns a copy of the record, or null.
function findPending(token, sessionId, options) {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null;
  if (typeof sessionId !== "string" || sessionId.length === 0) return null;
  try {
    const match = readRecords(options, PENDING_FILE)
      .filter((record) => validPending(record) && record.token === token && record.session_id === sessionId && usable(record, options));
    return match.length > 0 ? Object.assign({}, match[match.length - 1]) : null;
  } catch (err) {
    note(options, "error", "store-read-failed", { file: PENDING_FILE, code: errorCode(err), message: err && err.message });
    return null;
  }
}

// Writes `text` to `file` through a temporary file in the same directory, so a reader never sees half a file.
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

// [FR-242] Consumes a token: marks the matching pending record {used: true, used_at} and keeps it for audit. `record`
// is what findPending returned. Every other line, including a line that does not parse, stays as it is. Returns true
// when a record was marked, false when none matched (already used, or gone). Throws a StoreError when the file cannot
// be written; the caller then leaves the confirmation unrecorded or reports it, and does not post.
function markPendingUsed(record, options) {
  requireField(isRecord(record) && TOKEN_PATTERN.test(String(record.token)) && validTimestamp(record.created_at), "record");
  const file = path.join(storeDir(options), PENDING_FILE);
  try {
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch (err) {
      if (errorCode(err) === "ENOENT") return false;
      throw err;
    }
    const lines = text.split("\n");
    let marked = false;
    const out = lines.map((line) => {
      if (marked || line.trim().length === 0) return line;
      let value;
      try {
        value = JSON.parse(line);
      } catch (err) {
        return line;
      }
      if (!isRecord(value) || value.used === true || value.token !== record.token || value.session_id !== record.session_id || value.created_at !== record.created_at) return line;
      marked = true;
      return JSON.stringify(Object.assign({}, value, { used: true, used_at: new Date(nowMs(options)).toISOString() }));
    });
    if (marked) writeAtomic(file, out.join("\n"));
    return marked;
  } catch (err) {
    if (err instanceof StoreError) throw err;
    note(options, "error", "store-write-failed", { file: PENDING_FILE, code: errorCode(err), message: err && err.message });
    throw new StoreError("write-failed", "cannot update " + PENDING_FILE + ": " + errorCode(err));
  }
}

module.exports = {
  STORE_DIR, CONFIRMATIONS_FILE, PENDING_FILE, PENDING_EXPIRY_MS, TOKEN_PATTERN, StoreError,
  readConfirmations, findConfirmation, recordConfirmation, createPending, findPending, markPendingUsed, newToken,
};
