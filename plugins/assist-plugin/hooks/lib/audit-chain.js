// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-224|UR-065] The governance audit log: an append-only, hash-chained JSONL store at
// <root>/.agent/logs/governance/audit.jsonl. Spec: specs/spec-hooks-audit.md.
//
// Chain. Each line is one JSON object {ts, prev, event, ...fields}. `prev` is the SHA-256 (hex) of the exact stored
// text of the prior line, without its newline. The first line of the first segment holds GENESIS_HASH. A later reader
// recomputes the hashes, so an edit, a deletion, or a reordering shows as a line whose successor disagrees with it.
//
// Segments. The current segment is audit.jsonl. [NFR-032] When it reaches the rotation size, rotate() renames it to
// audit-NNNNNN.jsonl (a rising sequence number) and the next append starts a new audit.jsonl. The new segment's first
// line holds the old segment's final chain hash in `prev`, so the chain verifies across the cut. Rotation never needs a
// separate genesis record: the prior hash comes from the newest rotated segment whenever the current segment is empty
// or missing, which also repairs a crash between the rename and the next append. A rotated segment is kept at least
// RETENTION_MS (12 months, a floor that a caller cannot lower); rotate() deletes only the oldest segments, in order,
// after that age, and never the newest rotated segment, so the remaining chain still has its anchor.
//
// Append. One write call per line. A failed or short write truncates the file back to its prior size and returns a
// failure for the caller to log in hook-health.jsonl (no partial line). A partial last line left by a crash is
// truncated back to the last complete line before the next append. Appends and rotations run under an exclusive lock
// file (audit.lock, created with O_EXCL) so two parallel subagents cannot interleave; a lock older than
// STALE_LOCK_MS is taken over (a crashed holder). The prior hash comes from a tail read, never a whole-file read.
//
// Privacy. [NFR-031] A record that would carry prompt text, file contents, command text, or a secret throws an
// AuditError and nothing is written. The check rejects a field named like such content, a string longer than
// MAX_STRING_CHARS or with a control character, a string that a secret rule matches (lib/secret-rules.js), a value
// that is not plain data (a class instance, an object with a toJSON method or a getter, or a non-Object prototype), and
// a serialized line over MAX_LINE_BYTES. The record is copied once while it is checked, and only the copy is written,
// so the bytes on disk are the bytes that were checked; the serialized line is scanned again for control characters
// and secret rules. An error message names the field (or its position, for an odd key) and the rule, never the value.
// This is a heuristic guard, not a full sanitizer: a short free-text value or a number can still carry personal data,
// so callers must pass only the structured schema (rule id, decision, tool name, path with its data-class tag).
//
// Known limits, stated and not fixed here.
//   - The chain runs backward, so it cannot confirm the final retained line, and it cannot detect that trailing lines
//     were truncated, without an external head anchor (NFR-030 last-line limit). A head anchor is deferred to a later
//     step's decision.
//   - The chain is unkeyed SHA-256. Against a writer that has access to the store, tamper evidence rests on the FR-245
//     write bar (lib/fsa-paths.js), not on the chain alone.
//   - verify() takes no lock. A rotation that runs during the walk can make it report a spurious break; run it again.
//
// Identity. [FR-226] This library never reads a hook input or decides who acted. A caller sets the record's agent_type
// agent_id, and plugin_version from lib/identity.js (main-session and unidentified are values it returns, never blank), and
// the privacy check below treats them as ordinary short strings. plugin_version is a version token such as 1.13.1.
//
// Attribution. [FR-227|NFR-031] A record that carries an `operation` field is an attributed access event and must hold
// all five attribution fields: the operation, the data accessed (`path` and a `data_class` tag, never content), the agent
// identity (`agent_type`, `agent_id` for a subagent, `plugin_version`), the human authorizer (`authorizer`, and `authorizer_reason` when it
// reads "none"), and the timestamp (`ts`, set here). attribute() builds such a record; append() refuses one that is
// incomplete. The authorizer is a reference to the plan approval or the approval message id (lib/authorizer.js), never
// message text. The field is never omitted: "none" plus a reason stands for an autonomous action or one with no approved
// plan. Records with no `operation` (guard decisions, guard-disabled events, fsa-log rows) are not attributed events and
// pass through unchanged. audit.jsonl holds the per-access attribution; fsa-log.jsonl adds only identity and authorizer to
// one row per subagent report and carries no operation and no data-accessed field.
//
// Stores. [FR-227|NFR-032] The same chain, rotation, and retention serve a second store. options.dir (an absolute
// directory) replaces <root>/.agent/logs/governance, and options.name (default "audit") names the files: <name>.jsonl,
// <name>-NNNNNN.jsonl, and <name>.lock. impl/fsa-log.js uses name "fsa-log" under the plugin data directory, so its rows
// rotate by size with the prior segment's final hash carried into the new segment, with no line cap.
//
// Callers pass options: {root, dir, name, now, rotationBytes, retentionMs, lockTimeoutMs, log}. `root` is the absolute
// project root (not needed when `dir` is given). `now` is a function that returns milliseconds (tests). `log` receives one structured entry
// {level, event, ...fields} per problem; entries never hold record values. append() and rotate() return
// {ok: true, ...} or {ok: false, code, message} for an I/O problem, and throw an AuditError for a bad root, a bad
// record, or a privacy violation. verify() never throws for an I/O problem on the log: it returns the result.
// Paths are used as given: symlinks are not resolved. CommonJS, ES2015 syntax, no dependencies.
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const secretRules = require("./secret-rules");

const LOG_DIR = path.join(".agent", "logs", "governance");
const CURRENT_FILE = "audit.jsonl";
const DEFAULT_NAME = "audit";
const NAME_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

// [FR-224] The prior-hash of the first line of the first segment.
const GENESIS_HASH = "0".repeat(64);

// [NFR-032] The rotation size is a configured implementation value. 5 MiB (about 25,000 lines at 200 bytes a line) is an
// estimate, not a measured figure, until it is set against the NFR-030 verification-time target; a caller overrides it
// with options.rotationBytes.
const ROTATION_BYTES = 5 * 1024 * 1024;
// [NFR-032] Segments are kept at least 12 months (BRD A-1). A caller can lengthen this, never shorten it.
const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

const LOCK_TIMEOUT_MS = 2000;
const STALE_LOCK_MS = 30 * 1000;
const LOCK_POLL_MS = 5;

const TAIL_CHUNK_BYTES = 4096;
const MAX_TAIL_BYTES = 1024 * 1024;

// [NFR-031] Bounds that keep file contents and prompt text out of a record.
const MAX_LINE_BYTES = 8192;
const MAX_STRING_CHARS = 256;
const MAX_DEPTH = 4;
const MAX_ITEMS = 64;
const EVENT_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
// A short credential assignment such as token=abc123, which the vendor-shaped rules of secret-rules.js do not match.
const ASSIGNMENT_PATTERN = /(?:api[_-]?key|secret|passwd|password|token|authorization|bearer)\w{0,20}["']?\s{0,3}[:=]/i;
// A key short enough and plain enough to name in an error message once it has passed the key checks.
const SAFE_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;
// A field with one of these names holds content, not an identifier, a decision, or a path.
const FORBIDDEN_KEYS = /^(prompt|command|cmd|content|contents|text|body|message|input|output|stdin|stdout|stderr|diff|secret|password|passwd|token|api_?key|authorization|credentials?)$/i;
const RESERVED_KEYS = ["ts", "prev"];

// [FR-227] The attributed event schema.
const DATA_CLASSES = ["student-record", "PHI", "none", "untagged"];
const AUTHORIZER_NONE = "none";
const OPERATION_PATTERN = /^[a-z][a-z0-9_.:-]{0,63}$/;
const AGENT_TYPE_PATTERN = /^[A-Za-z0-9:_-]{1,60}$/;
const AGENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
// [FR-226] The plugin version of lib/identity.js: a plain version token such as 1.13.1, or "unknown".
const PLUGIN_VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/;
const REASON_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
// A reference to the plan approval ("plan-approval:<plan file>@<minute>") or to the approval message ("approval-message:<id>").
const AUTHORIZER_REF_PATTERN = /^(?:plan-approval|approval-message):[A-Za-z0-9._-]{1,120}(?:@\d{4}-\d{2}-\d{2}T\d{2}:\d{2})?$/;

class AuditError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AuditError";
    this.code = code;
  }
}

// Reports one problem to options.log. A failing logger must never break the log.
function note(options, level, event, fields) {
  try {
    if (options && typeof options.log === "function") options.log(Object.assign({ level, event }, fields));
  } catch (err) {
    // The logger failed; the log carries on.
  }
}

function errorCode(err) {
  return err && typeof err.code === "string" ? err.code : "unknown";
}

function rootOf(options) {
  const root = options && options.root;
  if (typeof root !== "string" || root.length === 0 || !path.isAbsolute(root)) {
    throw new AuditError("bad-root", "options.root must be an absolute path");
  }
  return root;
}

// The directory of the store: options.dir when given, else the governance log directory under options.root.
function logDir(options) {
  const dir = options && options.dir;
  if (dir !== undefined) {
    if (typeof dir !== "string" || dir.length === 0 || !path.isAbsolute(dir)) throw new AuditError("bad-root", "options.dir must be an absolute path");
    return dir;
  }
  return path.join(rootOf(options), LOG_DIR);
}

// The file names of the store: <name>.jsonl, <name>.lock, and the rotated pattern <name>-NNNNNN.jsonl.
function namesOf(options) {
  const name = options && options.name !== undefined ? options.name : DEFAULT_NAME;
  if (typeof name !== "string" || !NAME_PATTERN.test(name)) throw new AuditError("bad-name", "options.name must be a short lowercase name");
  return { name, current: name + ".jsonl", lock: name + ".lock", pattern: new RegExp("^" + name + "-(\\d{6,})\\.jsonl$") };
}

// The path of the current segment for a project root.
function logPath(root) {
  return path.join(logDir({ root }), CURRENT_FILE);
}

function nowMs(options) {
  const value = options && typeof options.now === "function" ? options.now() : Date.now();
  // A value Date cannot hold (past 8.64e15 ms) would make toISOString throw, so it falls back like a non-number.
  return Number.isFinite(value) && Math.abs(value) <= 8.64e15 ? value : Date.now();
}

function positiveNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function rotationBytes(options) {
  return positiveNumber(options && options.rotationBytes, ROTATION_BYTES);
}

function retentionMs(options) {
  return Math.max(RETENTION_MS, positiveNumber(options && options.retentionMs, RETENTION_MS));
}

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function isObjectLike(value) {
  return value !== null && typeof value === "object";
}

// [NFR-031] True for an object whose prototype is Object.prototype or null (the shape JSON.parse and a literal give).
// A class instance, or an object that inherits toJSON, fails.
function isPlainObject(value) {
  if (!isObjectLike(value) || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// The value of an own data property. A getter or setter would run code at serialization, so it is refused.
function readOwn(holder, key, where) {
  const descriptor = Object.getOwnPropertyDescriptor(holder, key);
  if (!descriptor || typeof descriptor.get === "function" || typeof descriptor.set === "function") {
    throw new AuditError("bad-record", "field " + where + " is not a plain data property");
  }
  return descriptor.value;
}

// ---- Privacy check [NFR-031] -------------------------------------------------------------------------------------

function checkString(value, where) {
  if (value.length > MAX_STRING_CHARS) throw new AuditError("privacy", "field " + where + " is longer than " + MAX_STRING_CHARS + " characters");
  if (/[\u0000-\u001f\u007f-\u009f]/.test(value)) throw new AuditError("privacy", "field " + where + " holds a control character");
  const rules = secretRules.matchRules(value);
  if (rules.length > 0) throw new AuditError("privacy", "field " + where + " matches secret rule " + rules[0]);
  if (ASSIGNMENT_PATTERN.test(value)) throw new AuditError("privacy", "field " + where + " holds a credential assignment");
}

// Checks the keys and values of a plain object and returns a copy made of plain data only (null prototype, each
// property read once). `where` names the object in an error message.
function cleanObject(value, where, depth) {
  if (!isPlainObject(value)) throw new AuditError("bad-record", "field " + where + " is not a plain object");
  const keys = Object.keys(value);
  if (keys.length > MAX_ITEMS) throw new AuditError("privacy", "field " + where + " holds more than " + MAX_ITEMS + " keys");
  const copy = Object.create(null);
  keys.forEach((key, index) => {
    // A key is checked under its position, so an error never echoes a key that may be a secret.
    const position = where + " key " + (index + 1);
    checkString(key, position);
    if (FORBIDDEN_KEYS.test(key)) throw new AuditError("privacy", "field " + where + "." + key + " is named like content");
    const child = SAFE_KEY_PATTERN.test(key) ? where + "." + key : position;
    copy[key] = cleanValue(readOwn(value, key, child), child, depth + 1);
  });
  return copy;
}

function cleanValue(value, where, depth) {
  if (depth > MAX_DEPTH) throw new AuditError("bad-record", "field " + where + " nests deeper than " + MAX_DEPTH);
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new AuditError("bad-record", "field " + where + " is not a finite number");
    return value;
  }
  if (typeof value === "string") {
    checkString(value, where);
    return value;
  }
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) throw new AuditError("bad-record", "field " + where + " is not a plain array");
    if (value.length > MAX_ITEMS) throw new AuditError("privacy", "field " + where + " holds more than " + MAX_ITEMS + " items");
    const copy = [];
    for (let i = 0; i < value.length; i++) copy.push(cleanValue(readOwn(value, i, where + "[" + i + "]"), where + "[" + i + "]", depth + 1));
    return copy;
  }
  if (isPlainObject(value)) return cleanObject(value, where, depth);
  throw new AuditError("bad-record", "field " + where + " is not JSON data");
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

// [FR-227|NFR-031] Checks the five attribution fields of a plain-data copy that carries an `operation`. The timestamp is
// not checked here because serialize() sets it. An error names the field and the rule, never the value.
// The data-accessed field is the `data_class` tag plus an optional `path`. A path is present for a file-path operation
// and absent otherwise (for example an outbound post), so the five-field property holds through `data_class`, which is
// always required.
function checkAttribution(copy) {
  if (typeof copy.operation !== "string" || !OPERATION_PATTERN.test(copy.operation)) throw new AuditError("bad-record", "record.operation must be a short lowercase identifier");
  if (copy.data_class === undefined || DATA_CLASSES.indexOf(copy.data_class) === -1) {
    throw new AuditError("bad-record", "record.data_class must be one of " + DATA_CLASSES.join(", "));
  }
  if (copy.path !== undefined && !isNonEmptyString(copy.path)) throw new AuditError("bad-record", "record.path must be a non-empty string when present");
  if (typeof copy.agent_type !== "string" || !AGENT_TYPE_PATTERN.test(copy.agent_type)) throw new AuditError("bad-record", "record.agent_type must be a plain type name, never blank");
  if (copy.agent_id !== undefined && (typeof copy.agent_id !== "string" || !AGENT_ID_PATTERN.test(copy.agent_id))) throw new AuditError("bad-record", "record.agent_id must be a plain identifier when present");
  if (copy.plugin_version !== undefined && (typeof copy.plugin_version !== "string" || !PLUGIN_VERSION_PATTERN.test(copy.plugin_version))) {
    throw new AuditError("bad-record", "record.plugin_version must be a plain version string when present");
  }
  if (!isNonEmptyString(copy.authorizer)) throw new AuditError("bad-record", "record.authorizer is required and is never omitted");
  if (copy.authorizer === AUTHORIZER_NONE) {
    if (typeof copy.authorizer_reason !== "string" || !REASON_PATTERN.test(copy.authorizer_reason)) {
      throw new AuditError("bad-record", "record.authorizer_reason is required when the authorizer is none");
    }
  } else if (!AUTHORIZER_REF_PATTERN.test(copy.authorizer)) {
    throw new AuditError("privacy", "record.authorizer must be a reference to the plan approval, never message text");
  } else if (copy.authorizer_reason !== undefined) {
    throw new AuditError("bad-record", "record.authorizer_reason applies only when the authorizer is none");
  }
}

// Validates a caller record and returns a plain-data copy of it. Throws an AuditError and writes nothing on a bad record.
function cleanRecord(record) {
  if (!isPlainObject(record)) throw new AuditError("bad-record", "record must be a plain object");
  const copy = cleanObject(record, "record", 0);
  if (typeof copy.event !== "string" || !EVENT_PATTERN.test(copy.event)) throw new AuditError("bad-record", "record.event must be a short lowercase identifier");
  RESERVED_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(copy, key)) throw new AuditError("bad-record", "record must not set " + key);
  });
  // [FR-227] An attributed access event is complete or it is refused.
  if (copy.operation !== undefined) checkAttribution(copy);
  return copy;
}

// [FR-227|NFR-031] Builds an attributed access record from its parts, ready for append(): {event, operation, path?,
// data_class, agent_type, agent_id?, plugin_version?, authorizer, authorizer_reason?}; append() adds the timestamp. `parts`
// takes the identity slot of lib/identity.js (agent_type, agent_id, plugin_version) and the authorizer slot of lib/authorizer.js (authorizer,
// authorizer_reason) as plain fields. A missing data_class becomes "none" and a missing authorizer becomes "none" with
// the reason "unresolved", so the authorizer is never omitted. Only these fields are copied: anything else in `parts`
// (a prompt, a command, content) is dropped. Throws an AuditError for an incomplete or malformed record.
function attribute(parts) {
  if (!isPlainObject(parts)) throw new AuditError("bad-record", "attribution parts must be a plain object");
  const take = (key) => (Object.prototype.hasOwnProperty.call(parts, key) ? readOwn(parts, key, "parts." + key) : undefined);
  const out = { event: take("event"), operation: take("operation") };
  const dataClass = take("data_class");
  const accessed = take("path");
  const agentId = take("agent_id");
  const pluginVersion = take("plugin_version");
  const authorizer = take("authorizer");
  const reason = take("authorizer_reason");
  if (accessed !== undefined) out.path = accessed;
  out.data_class = dataClass === undefined ? "none" : dataClass;
  out.agent_type = take("agent_type");
  if (agentId !== undefined && agentId !== null) out.agent_id = agentId;
  if (pluginVersion !== undefined && pluginVersion !== null) out.plugin_version = pluginVersion;
  if (authorizer === undefined || authorizer === null || authorizer === "") {
    out.authorizer = AUTHORIZER_NONE;
    out.authorizer_reason = "unresolved";
  } else {
    out.authorizer = authorizer;
    if (reason !== undefined && reason !== null) out.authorizer_reason = reason;
  }
  const copy = cleanObject(out, "record", 0);
  if (typeof copy.event !== "string" || !EVENT_PATTERN.test(copy.event)) throw new AuditError("bad-record", "record.event must be a short lowercase identifier");
  checkAttribution(copy);
  return copy;
}

// Serializes the checked copy as one line: ts, prev, then the record fields. The serialized text is scanned again for
// control characters and secret rules, and its size is bounded, so what is written is what was checked.
function serialize(copy, ts, prev) {
  const out = Object.create(null);
  out.ts = ts;
  out.prev = prev;
  Object.keys(copy).forEach((key) => {
    out[key] = copy[key];
  });
  const line = JSON.stringify(out);
  if (Buffer.byteLength(line, "utf8") > MAX_LINE_BYTES) throw new AuditError("privacy", "record is longer than " + MAX_LINE_BYTES + " bytes");
  if (/[\u0000-\u001f\u007f-\u009f]/.test(line)) throw new AuditError("privacy", "serialized record holds a control character");
  const rules = secretRules.matchRules(line);
  if (rules.length > 0) throw new AuditError("privacy", "serialized record matches secret rule " + rules[0]);
  return line;
}

// ---- File helpers ------------------------------------------------------------------------------------------------

// Creates `dir` and its missing parents (mode 0700), one by one, as confirmation-store.js does for Node 6.
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

function sleep(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (err) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      // No Atomics.wait on this Node version: spin for the few milliseconds.
    }
  }
}

function readLockOwner(lock) {
  try {
    return fs.readFileSync(lock, "utf8");
  } catch (err) {
    return null;
  }
}

// Removes a lock that has outlived STALE_LOCK_MS, once. The lock is renamed to a name of its own and the renamed file
// is checked: it must hold the owner text and the age that were judged stale, so a lock that another process created
// in between is put back (link fails when the name is taken again) and is never deleted as if it were the stale one.
// A second contender that loses the rename gets ENOENT and tries again. Returns true when it removed a stale lock.
function breakStaleLock(lock, options) {
  let judged;
  try {
    const stat = fs.statSync(lock);
    if (Date.now() - stat.mtimeMs <= STALE_LOCK_MS) return false;
    judged = readLockOwner(lock);
  } catch (err) {
    return false;
  }
  const aside = lock + ".break-" + process.pid + "-" + crypto.randomBytes(4).toString("hex");
  try {
    fs.renameSync(lock, aside);
  } catch (err) {
    return false;
  }
  try {
    const stale = readLockOwner(aside) === judged && Date.now() - fs.statSync(aside).mtimeMs > STALE_LOCK_MS;
    if (stale) {
      note(options, "warn", "audit-stale-lock-removed", {});
      return true;
    }
    note(options, "warn", "audit-live-lock-restored", {});
    try {
      fs.linkSync(aside, lock);
    } catch (err) {
      note(options, "error", "audit-lock-restore-failed", { code: errorCode(err) });
    }
    return false;
  } catch (err) {
    return false;
  } finally {
    try {
      fs.unlinkSync(aside);
    } catch (err) {
      // Already gone.
    }
  }
}

// Runs fn(owned) while this process holds the exclusive lock file; throws an AuditError("lock-timeout") when it cannot
// get it. The lock file holds a nonce that only this holder knows. fn calls owned() just before it changes the log: it
// throws an AuditError("lock-lost") when the lock file no longer holds the nonce, so a holder whose lock was taken over
// writes nothing. The release removes the lock file only while it still holds the nonce.
function withLock(dir, names, options, fn) {
  const lock = path.join(dir, names.lock);
  const nonce = process.pid + ":" + crypto.randomBytes(8).toString("hex");
  const deadline = Date.now() + positiveNumber(options && options.lockTimeoutMs, LOCK_TIMEOUT_MS);
  for (;;) {
    try {
      const fd = fs.openSync(lock, "wx", 0o600);
      try {
        fs.writeSync(fd, nonce);
      } finally {
        fs.closeSync(fd);
      }
      break;
    } catch (err) {
      if (errorCode(err) !== "EEXIST") throw err;
      // Every pass through here either times out or waits, so a lock that appears and vanishes cannot spin the loop.
      if (Date.now() >= deadline) throw new AuditError("lock-timeout", "cannot get the audit lock");
      if (!breakStaleLock(lock, options)) sleep(LOCK_POLL_MS);
    }
  }
  const owned = () => {
    if (readLockOwner(lock) !== nonce) throw new AuditError("lock-lost", "the audit lock was taken over");
  };
  try {
    return fn(owned);
  } finally {
    if (readLockOwner(lock) === nonce) {
      try {
        fs.unlinkSync(lock);
      } catch (err) {
        // Already removed.
      }
    } else {
      note(options, "warn", "audit-lock-lost", {});
    }
  }
}

function readFully(fd, buffer, position) {
  let done = 0;
  while (done < buffer.length) {
    const count = fs.readSync(fd, buffer, done, buffer.length - done, position + done);
    if (count === 0) throw new AuditError("short-read", "unexpected end of file");
    done += count;
  }
}

// Reads the end of the file at `fd` (size `size`). Returns {line, goodEnd}: `line` is the text of the last complete
// line without its newline (null when there is none), `goodEnd` is the offset just after that line's newline. Bytes
// after goodEnd are a partial line. Reads backwards in chunks, so the cost does not grow with the file.
function readTail(fd, size) {
  if (size === 0) return { line: null, goodEnd: 0 };
  let acc = Buffer.alloc(0);
  let base = size;
  while (base > 0) {
    const want = Math.min(TAIL_CHUNK_BYTES, base);
    const chunk = Buffer.alloc(want);
    readFully(fd, chunk, base - want);
    acc = Buffer.concat([chunk, acc]);
    base -= want;
    const last = acc.lastIndexOf(10);
    if (last !== -1) {
      const before = last > 0 ? acc.lastIndexOf(10, last - 1) : -1;
      if (before !== -1 || base === 0) return { line: acc.toString("utf8", before + 1, last), goodEnd: base + last + 1 };
    }
    if (acc.length > MAX_TAIL_BYTES) throw new AuditError("tail-too-long", "the last line is longer than " + MAX_TAIL_BYTES + " bytes");
  }
  return { line: null, goodEnd: 0 };
}

// The rotated segments in `dir` as [{name, seq}], oldest first.
function listRotated(dir, names) {
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (err) {
    if (errorCode(err) === "ENOENT") return [];
    throw err;
  }
  return files
    .map((name) => ({ name, match: names.pattern.exec(name) }))
    .filter((entry) => entry.match !== null)
    .map((entry) => ({ name: entry.name, seq: parseInt(entry.match[1], 10) }))
    .sort((a, b) => a.seq - b.seq);
}

function segmentName(names, seq) {
  const digits = String(seq);
  return names.name + "-" + "0".repeat(Math.max(0, 6 - digits.length)) + digits + ".jsonl";
}

// The hash of the last complete line of the file at `file`, or null when the file is missing or holds no line.
function lastHashOf(file) {
  let fd;
  try {
    fd = fs.openSync(file, "r");
  } catch (err) {
    if (errorCode(err) === "ENOENT") return null;
    throw err;
  }
  try {
    const tail = readTail(fd, fs.fstatSync(fd).size);
    return tail.line === null ? null : sha256(tail.line);
  } finally {
    fs.closeSync(fd);
  }
}

// The chain hash that the next line must hold when the current segment is empty: the final hash of the newest rotated
// segment that has a line, else the genesis value.
function carriedHash(dir, names) {
  const rotated = listRotated(dir, names);
  for (let i = rotated.length - 1; i >= 0; i--) {
    const hash = lastHashOf(path.join(dir, rotated[i].name));
    if (hash !== null) return hash;
  }
  return GENESIS_HASH;
}

// [NFR-032] Deletes rotated segments older than the retention age, oldest first, stopping at the first one that is not
// old enough, so the remaining segments stay contiguous. The newest rotated segment is never deleted. Returns the names.
function prune(dir, names, options) {
  const pruned = [];
  const rotated = listRotated(dir, names);
  const cutoff = nowMs(options) - retentionMs(options);
  for (let i = 0; i < rotated.length - 1; i++) {
    const file = path.join(dir, rotated[i].name);
    try {
      if (fs.statSync(file).mtimeMs >= cutoff) break;
      fs.unlinkSync(file);
      pruned.push(rotated[i].name);
    } catch (err) {
      note(options, "error", "audit-prune-failed", { segment: rotated[i].name, code: errorCode(err) });
      break;
    }
  }
  return pruned;
}

// Renames the current segment to the next rotated name. The caller holds the lock and has no descriptor open on it.
function rotateCurrent(dir, names, options) {
  const rotated = listRotated(dir, names);
  const next = segmentName(names, rotated.length > 0 ? rotated[rotated.length - 1].seq + 1 : 1);
  fs.renameSync(path.join(dir, names.current), path.join(dir, next));
  return { segment: next, pruned: prune(dir, names, options) };
}

// Opens the current segment for read and append, truncates a partial last line left by a crash, and returns
// {fd, size, tail}. The caller closes fd.
function openCurrent(dir, names, options) {
  const fd = fs.openSync(path.join(dir, names.current), "a+", 0o600);
  try {
    let size = fs.fstatSync(fd).size;
    const tail = readTail(fd, size);
    if (tail.goodEnd < size) {
      fs.ftruncateSync(fd, tail.goodEnd);
      note(options, "warn", "audit-partial-line-removed", { bytes: size - tail.goodEnd });
      size = tail.goodEnd;
    }
    return { fd, size, tail };
  } catch (err) {
    fs.closeSync(fd);
    throw err;
  }
}

// Runs fn(dir) under the lock and turns an I/O error into a failure result. An AuditError for a bad root is thrown
// before this runs.
function locked(options, fn) {
  const dir = logDir(options);
  const names = namesOf(options);
  try {
    makeDirs(dir);
    return withLock(dir, names, options, (owned) => fn(dir, names, owned));
  } catch (err) {
    const code = err instanceof AuditError ? err.code : errorCode(err);
    note(options, "error", "audit-write-failed", { code, message: err && err.message });
    return { ok: false, code, message: err && err.message };
  }
}

// ---- Public API --------------------------------------------------------------------------------------------------

// [FR-224|UR-065] Appends one chained line for `record` ({event, ...fields}; ts and prev are set here). Returns
// {ok: true, hash, segment, rotated} on success, where `hash` is the chain hash of the new line, or
// {ok: false, code, message} when the write fails; a failed write leaves no partial line. Throws an AuditError
// (code bad-root, bad-record, or privacy) before it writes anything.
function append(record, options) {
  logDir(options);
  namesOf(options);
  // Check the record once, before taking the lock; only the plain-data copy is serialized. The placeholder prev gives
  // the same line length as the real one.
  const copy = cleanRecord(record);
  serialize(copy, new Date(nowMs(options)).toISOString(), GENESIS_HASH);
  return locked(options, (dir, names, owned) => {
    let current = openCurrent(dir, names, options);
    let rotated = false;
    try {
      const prev = current.tail.line !== null ? sha256(current.tail.line) : carriedHash(dir, names);
      // [NFR-032] The prior hash is read before the cut, so the new segment's first line carries the old final hash.
      if (current.size > 0 && current.size >= rotationBytes(options)) {
        owned();
        fs.closeSync(current.fd);
        current.fd = -1;
        rotateCurrent(dir, names, options);
        rotated = true;
        current = openCurrent(dir, names, options);
      }
      const line = serialize(copy, new Date(nowMs(options)).toISOString(), prev);
      const bytes = Buffer.from(line + "\n", "utf8");
      owned();
      try {
        const written = fs.writeSync(current.fd, bytes, 0, bytes.length);
        if (written !== bytes.length) throw new AuditError("short-write", "wrote " + written + " of " + bytes.length + " bytes");
      } catch (err) {
        // [FR-224] Truncate back to the prior size: no partial line stays in the log.
        try {
          fs.ftruncateSync(current.fd, current.size);
        } catch (truncErr) {
          note(options, "error", "audit-truncate-failed", { code: errorCode(truncErr) });
        }
        throw err;
      }
      return { ok: true, hash: sha256(line), segment: names.current, rotated };
    } finally {
      if (current.fd >= 0) fs.closeSync(current.fd);
    }
  });
}

// [NFR-032] Cuts the current segment now (when it holds a line) and deletes the segments past retention. Returns
// {ok: true, rotated, segment, pruned} or {ok: false, code, message}.
function rotate(options) {
  logDir(options);
  namesOf(options);
  return locked(options, (dir, names, owned) => {
    const current = openCurrent(dir, names, options);
    fs.closeSync(current.fd);
    owned();
    if (current.size === 0) return { ok: true, rotated: false, segment: null, pruned: prune(dir, names, options) };
    const result = rotateCurrent(dir, names, options);
    return { ok: true, rotated: true, segment: result.segment, pruned: result.pruned };
  });
}

// [FR-225|NFR-030] The line texts of one segment file. A last line with no newline comes back as {partial: true}.
function readSegmentLines(file) {
  const text = fs.readFileSync(file, "utf8");
  if (text.length === 0) return { lines: [], partial: false };
  const lines = text.split("\n");
  const partial = lines[lines.length - 1].length > 0;
  if (!partial) lines.pop();
  return { lines, partial };
}

function brokenAt(ref, reason, verified) {
  return { ok: false, lines: verified, firstBreak: { line: ref.line, segment: ref.segment, segmentLine: ref.segmentLine, reason } };
}

// [FR-225|NFR-030] Walks every segment in order, recomputing each line's hash and carrying the final hash across each
// cut. `location` is the path of the current segment (audit.jsonl) or of its directory; options.root is used when it
// is omitted. Returns {ok: true, lines, segments} when the chain is intact. Otherwise returns {ok: false, lines,
// segments, firstBreak: {line, segment, segmentLine, reason}}, where `lines` counts the lines verified before the
// break and `line` is the first line whose successor does not chain to it (for an edited or removed line, the last
// line the chain still confirms), numbered from 1 across all segments. A line that is not a record, a partial last
// line, and a wrong genesis value are reported at the line itself. An unreadable segment returns
// {ok: false, error: {code, message}}. A missing log verifies as zero lines. The chain cannot confirm the last line of
// the log, which has no successor.
function verify(location, options) {
  const names = namesOf(options);
  let file;
  if (typeof location === "string" && location.length > 0) file = /\.jsonl$/.test(location) ? location : path.join(location, names.current);
  else file = path.join(logDir(options), names.current);
  const dir = path.dirname(file);
  try {
    const segments = listRotated(dir, names).map((entry) => ({ name: entry.name, seq: entry.seq, file: path.join(dir, entry.name) }));
    if (fs.existsSync(file)) segments.push({ name: path.basename(file), seq: null, file });
    let total = 0;
    let prevHash = null;
    let prevRef = null;
    for (let s = 0; s < segments.length; s++) {
      const segment = segments[s];
      const read = readSegmentLines(segment.file);
      for (let j = 0; j < read.lines.length; j++) {
        const text = read.lines[j];
        const ref = { line: total + 1, segment: segment.name, segmentLine: j + 1 };
        const isPartial = read.partial && j === read.lines.length - 1;
        let record = null;
        if (!isPartial) {
          try {
            record = JSON.parse(text);
          } catch (err) {
            record = null;
          }
        }
        if (!isPlainObject(record) || typeof record.prev !== "string" || !HASH_PATTERN.test(record.prev)) {
          const result = brokenAt(ref, isPartial ? "partial-line" : "not-a-record", total);
          result.segments = segments.length;
          return result;
        }
        if (prevHash === null) {
          // The first line of the oldest kept segment. A segment after the first (seq above 1) means older ones were
          // deleted after retention, so its first prev is the anchor.
          const anchored = segment.seq !== null && segment.seq > 1;
          if (!anchored && record.prev !== GENESIS_HASH) {
            const result = brokenAt(ref, "genesis-mismatch", total);
            result.segments = segments.length;
            return result;
          }
        } else if (record.prev !== prevHash) {
          const result = brokenAt(prevRef, "prev-mismatch", total - 1);
          result.segments = segments.length;
          return result;
        }
        prevHash = sha256(text);
        prevRef = ref;
        total++;
      }
    }
    return { ok: true, lines: total, segments: segments.length };
  } catch (err) {
    note(options, "error", "audit-verify-failed", { code: errorCode(err), message: err && err.message });
    return { ok: false, lines: 0, segments: 0, error: { code: errorCode(err), message: err && err.message } };
  }
}

module.exports = {
  LOG_DIR, CURRENT_FILE, GENESIS_HASH, ROTATION_BYTES, RETENTION_MS, DATA_CLASSES, AUTHORIZER_NONE, AuditError,
  logPath, append, verify, rotate, attribute,
};
