// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Shared fail-open runtime and health log for assist-plugin hooks.
// ES5 syntax only so it parses on any Node version (the launcher loads it before the version gate).
//
// Contract:
//   - A hook blocks only when its evaluate() function positively returns {deny: true}. The deny
//     mechanism is the PreToolUse JSON below with exit 0. No code path exits with status 2.
//   - Every failure (thrown error, uncaught exception, unhandled rejection, stdin error,
//     malformed input, timeout, unsupported Node, disable flag) lets the command proceed:
//     print only {"systemMessage": ...} on stdout, exit 0. If writing fails, exit 0 silently.
//   - [NFR-028] Exception: a guard that passes a failClosedFor(input) classifier to guard() denies its own guarded
//     call class when evaluate throws, an uncaught exception, an unhandled rejection, or a timeout occurs after
//     the input was parsed. The deny is the same PreToolUse JSON with exit 0 (never a non-zero exit). A call the
//     classifier does not assign to the class, an input that could not be read or parsed, and a disabled guard
//     still proceed.
//   - transform() runs a PostToolUse / PreToolUse / UserPromptSubmit filter. It emits output only when the
//     filter positively returns {stdout}; every failure path above prints nothing or a systemMessage and exits 0.
//   - [NFR-026] After a deny or ask decision, guard() appends a decision record to the governance audit log
//     (.agent/logs/governance/audit.jsonl, through lib/audit-chain.js). The append runs after the decision output is
//     written and fails open: a failed or refused append is noted in the health log and never changes the decision.
//   - [FR-228] A guard or filter skipped because it is listed in hooks-disabled.json, and the session-start health check
//     (impl/health-check.js), append a "guard-disabled" event to the same log once per project while the guard stays
//     disabled (see "Logged disablement" below). That append fails open too and never changes the skip.
//   - The health log (${CLAUDE_PLUGIN_DATA}/hook-health.jsonl) holds {ts, hook, node, kind, message}.
//     It never holds command text, arguments, environment values, or stdin: error messages are not
//     copied (JSON.parse errors can quote the input); only the error name, code, and source line are.
"use strict";

var fs = require("fs");
var path = require("path");

var LOG_FILE = "hook-health.jsonl";
var DISABLED_FILE = "hooks-disabled.json";
var STATE_FILE = "health-state.json";
var MAX_LOG_LINES = 200;
var WATCHDOG_MS = 3000;
var DEFAULT_SUFFIX = "this command was not checked";

var TS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
var NAME_PATTERN = /^[a-z-]{1,40}$/;
var NODE_PATTERN = /^v\d+(\.\d+){0,2}$/;
var INVALID = "<invalid>";

var finished = false;

// ---------------------------------------------------------------------------------------------
// Plugin data files

function dataFile(name) {
  var dir = process.env.CLAUDE_PLUGIN_DATA;
  return dir ? path.join(dir, name) : null;
}

function ensureDir(dir) {
  if (fs.existsSync(dir)) return;
  var parent = path.dirname(dir);
  if (parent !== dir) ensureDir(parent);
  try {
    fs.mkdirSync(dir);
  } catch (err) {
    if (!err || err.code !== "EEXIST") throw err;
  }
}

function readJson(file) {
  if (!file) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    return null;
  }
}

// Atomic replace so a concurrent reader never sees a partial file.
function writeFileAtomic(file, text) {
  ensureDir(path.dirname(file));
  var tmp = file + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function writeJson(file, value) {
  writeFileAtomic(file, JSON.stringify(value, null, 2) + "\n");
}

// ---------------------------------------------------------------------------------------------
// Validation of data read from the plugin data directory. Files there are not trusted: every field
// is checked before it is printed (report, systemMessage) and invalid values become "<invalid>".

function sanitize(text) {
  return String(text).replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").slice(0, 200);
}

// process.version reduced to vN[.N[.N]]; anything else is recorded as "<invalid>".
function nodeVersion() {
  var match = /^v\d+(\.\d+){0,2}/.exec(String(process.version));
  return match ? match[0] : INVALID;
}

function validField(value, pattern) {
  return typeof value === "string" && pattern.test(value) ? value : INVALID;
}

// Returns a log entry with validated fields, or null when the timestamp is invalid.
function cleanLogEntry(entry) {
  if (!entry || typeof entry !== "object" || !TS_PATTERN.test(String(entry.ts))) return null;
  return {
    ts: entry.ts,
    hook: validField(entry.hook, NAME_PATTERN),
    node: validField(entry.node, NODE_PATTERN),
    kind: validField(entry.kind, NAME_PATTERN),
    message: typeof entry.message === "string" ? sanitize(entry.message) : INVALID
  };
}

// Keeps only entries keyed by a valid hook name; reason and ts are validated.
function cleanDisabled(data) {
  var out = {};
  Object.keys(data).forEach(function (name) {
    if (!NAME_PATTERN.test(name)) return;
    var entry = data[name] && typeof data[name] === "object" ? data[name] : {};
    out[name] = {
      reason: typeof entry.reason === "string" ? sanitize(entry.reason) : INVALID,
      ts: validField(entry.ts, TS_PATTERN)
    };
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Disable flag and notice state

function readDisabled() {
  var data = readJson(dataFile(DISABLED_FILE));
  return data && typeof data === "object" && !Array.isArray(data) ? cleanDisabled(data) : {};
}

// Returns the flag entry, or null when the hook is not listed (or the flag file is absent, unreadable,
// or malformed, in which case the hook runs normally).
function disabledEntry(hook) {
  var data = readDisabled();
  return Object.prototype.hasOwnProperty.call(data, hook) ? data[hook] || {} : null;
}

function writeDisabled(data) {
  var file = dataFile(DISABLED_FILE);
  if (!file) throw new Error("CLAUDE_PLUGIN_DATA is not set");
  if (Object.keys(data).length === 0) {
    try {
      fs.unlinkSync(file);
    } catch (err) {
      if (!err || err.code !== "ENOENT") throw err;
    }
    return;
  }
  writeJson(file, data);
}

function readState() {
  var data = readJson(dataFile(STATE_FILE));
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

function writeState(state) {
  var file = dataFile(STATE_FILE);
  if (!file) return;
  writeJson(file, state);
}

// ---------------------------------------------------------------------------------------------
// Health log

// Parsed objects of a JSON-lines file in the plugin data directory; a corrupt line is skipped. Values are
// not validated here: callers check every field before use.
function readJsonl(name) {
  var file = dataFile(name);
  if (!file) return [];
  var text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (err) {
    return [];
  }
  var records = [];
  var lines = text.split("\n");
  for (var i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    try {
      records.push(JSON.parse(lines[i]));
    } catch (err) {
      // skip a corrupt line
    }
  }
  return records;
}

function readLog() {
  var entries = [];
  readJsonl(LOG_FILE).forEach(function (record) {
    var entry = cleanLogEntry(record);
    if (entry) entries.push(entry);
  });
  return entries;
}

// Appends one record to a JSON-lines file in the plugin data directory and keeps the newest maxLines lines.
function appendJsonl(name, record, maxLines) {
  var file = dataFile(name);
  if (!file) return;
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, JSON.stringify(record) + "\n");
  var lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  if (lines.length > maxLines) {
    writeFileAtomic(file, lines.slice(lines.length - maxLines).join("\n") + "\n");
  }
}

function appendLog(record) {
  appendJsonl(LOG_FILE, record, MAX_LOG_LINES);
}

// Truncates the log; returns the number of entries removed.
function clearLog() {
  var file = dataFile(LOG_FILE);
  if (!file) return 0;
  var count = readLog().length;
  try {
    fs.writeFileSync(file, "");
  } catch (err) {
    if (!err || err.code !== "ENOENT") throw err;
  }
  return count;
}

// Appends a validated record to the health log. Never throws. kind must match NAME_PATTERN.
function logEvent(hook, kind, message) {
  try {
    appendLog({
      ts: new Date().toISOString(),
      hook: hook,
      node: nodeVersion(),
      kind: kind,
      message: sanitize(message || "")
    });
  } catch (err) {
    // health-log write failure must not change the outcome
  }
}

// Describes an error without copying its message: name, code, and the first hook source line.
function describeError(err) {
  var name = err && typeof err.name === "string" && /^[A-Za-z]{1,40}$/.test(err.name) ? err.name : "Error";
  var text = name;
  if (err && typeof err.code === "string" && /^[A-Z0-9_]{1,30}$/.test(err.code)) text += " " + err.code;
  var stack = err && typeof err.stack === "string" ? err.stack.split("\n") : [];
  for (var i = 0; i < stack.length; i++) {
    var match = /^\s+at .*?([A-Za-z0-9_-]+\.js):(\d+):\d+\)?\s*$/.exec(stack[i]);
    if (match) {
      text += " at " + match[1] + ":" + match[2];
      break;
    }
  }
  return text;
}

// ---------------------------------------------------------------------------------------------
// Output and exit

function writeStdout(text) {
  try {
    fs.writeSync(1, text);
    return;
  } catch (err) {
    // fall through to the stream
  }
  try {
    process.stdout.write(text);
  } catch (err2) {
    // nothing more can be done
  }
}

// Writes a possibly large payload (a whole tool result) and calls done() once it is flushed.
// fs.writeSync can write partially or throw EAGAIN on a full pipe, so the remainder goes to the stream.
function writeStdoutFlushed(text, done) {
  var buf;
  try {
    buf = Buffer.from(text, "utf8");
  } catch (err) {
    done();
    return;
  }
  var offset = 0;
  while (offset < buf.length) {
    try {
      offset += fs.writeSync(1, buf, offset, buf.length - offset);
    } catch (err2) {
      break;
    }
  }
  if (offset >= buf.length) {
    done();
    return;
  }
  try {
    process.stdout.write(buf.slice(offset), function () {
      done();
    });
  } catch (err3) {
    done();
  }
}

function exitZero() {
  try {
    process.exit(0);
  } catch (err) {
    // ignore
  }
}

function warn(text) {
  writeStdout(JSON.stringify({ systemMessage: text }));
}

// Evaluates an optional classifier without letting it throw or hang the failure path. Returns true only when the
// classifier positively returns true; a missing classifier, a throw, or any other value means "not in the class".
function inGuardedClass(classify) {
  if (typeof classify !== "function") return false;
  try {
    return classify() === true;
  } catch (err) {
    return false;
  }
}

// [NFR-028] Record the failure, warn, and exit 0 so the command proceeds. Never throws, never exits non-zero.
// detail must be a fixed string from our own code (never user input); err is described, not copied.
// options: {suffix: sentence tail for the warning,
//           failClosedNow: function returning true when the failing call belongs to a security-critical guarded
//           class (NFR-028); the call is then denied with permissionDecision "deny" and exit 0 instead of proceeding}
function failOpen(hook, kind, detail, err, options) {
  if (finished) return;
  finished = true;
  options = options || {};
  var message = sanitize((detail || "") + (err ? (detail ? ": " : "") + describeError(err) : ""));
  var closed = inGuardedClass(options.failClosedNow);
  try {
    appendLog({
      ts: new Date().toISOString(),
      hook: hook,
      node: nodeVersion(),
      kind: kind,
      message: closed ? sanitize("fail-closed" + (message ? ": " + message : "")) : message
    });
  } catch (logError) {
    // health-log write failure must not change the outcome
  }
  if (closed) {
    writeStdout(
      JSON.stringify(
        denyOutput(
          "assist-plugin " + hook + " guard failed (" + kind + (message ? ": " + message : "") + "); this call is in the guard's " +
            "security-critical class and is denied until the guard works. Run /assist-plugin:health for details."
        )
      )
    );
    if (typeof options.onFailClosed === "function") {
      try {
        options.onFailClosed();
      } catch (auditError) {
        // audit logging fails open: the deny stands
      }
    }
    exitZero();
    return;
  }
  var suffix = options.suffix || DEFAULT_SUFFIX;
  warn("assist-plugin " + hook + " hook failed (" + kind + (message ? ": " + message : "") + "); " + suffix);
  exitZero();
}

function installHandlers(hook, options) {
  process.on("uncaughtException", function (err) {
    failOpen(hook, "uncaught-exception", "", err, options);
  });
  process.on("unhandledRejection", function (reason) {
    failOpen(hook, "unhandled-rejection", "", reason, options);
  });
}

// A hung hook would stall the command until the Claude Code timeout; give up first.
function startWatchdog(hook, ms, options) {
  var timer = setTimeout(function () {
    failOpen(hook, "timeout", "no result within " + ms + " ms", null, options);
  }, ms);
  // unref: if nothing else keeps the process alive it exits 0 on its own (still fail-open).
  if (timer && typeof timer.unref === "function") timer.unref();
}

function readStdin(callback) {
  var raw = "";
  var called = false;
  function done(err) {
    if (called) return;
    called = true;
    callback(err, raw);
  }
  try {
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", function (chunk) {
      raw += chunk;
    });
    process.stdin.on("end", function () {
      done(null);
    });
    process.stdin.on("error", function (err) {
      done(err);
    });
  } catch (err) {
    done(err);
  }
}

// ---------------------------------------------------------------------------------------------
// Governance audit log [NFR-026|FR-224|NFR-031]
//
// The guard runner and the audit-log hook append structured records to <root>/.agent/logs/governance/audit.jsonl
// through lib/audit-chain.js. audit-chain.js uses ES2015 syntax, so it is required inside the functions below and a
// load failure on an old Node is caught like any other failure. Logging fails open: a failed or refused append is
// noted in hook-health.jsonl (a code or a fixed phrase, never a record value) and never changes a guard decision or
// blocks a tool call.
//
// The record is plain data only: event, decision, rule_id, tool, path, data_class, agent_type, agent_id. It never holds
// a command, a prompt, file contents, or a secret (audit-chain.js refuses such a record and writes nothing). The
// agent identity is read from the raw hook input; lib/identity.js (task plan Step 21) replaces that later.

var AUDIT_LOCK_TIMEOUT_MS = 500;
var AUDIT_DECISION_EVENT = "guard-decision";
var AUDIT_UNTAGGED = "untagged";
var AUDIT_MAIN_AGENT = "main";
var AUDIT_PATH_KEYS = ["file_path", "notebook_path", "path"];
var AUDIT_TOOL_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/;
var AUDIT_RULE_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/;
var AUDIT_AGENT_TYPE_PATTERN = /^[A-Za-z0-9:_-]{1,60}$/;
var AUDIT_AGENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
var AUDIT_CODE_PATTERN = /^[A-Za-z0-9_-]{1,30}$/;

// Logs a health event unless the newest entry is the same event, so a persistent audit failure (a read-only disk) adds
// one line instead of pushing every other failure out of the 200-line log.
function logEventOnce(hook, kind, message) {
  try {
    var last = readLog().pop();
    if (last && last.hook === hook && last.kind === kind && last.message === sanitize(message || "")) return;
  } catch (err) {
    // an unreadable log only means the event may repeat
  }
  logEvent(hook, kind, message);
}

// The project root of a hook input: the git root of its cwd, else the cwd itself. Returns null for no absolute cwd.
function auditRoot(input) {
  var cwd = input && typeof input.cwd === "string" ? input.cwd : "";
  var found = null;
  try {
    found = require("./git-root.js").findGitRoot(cwd);
  } catch (err) {
    found = null;
  }
  return found || (cwd && path.isAbsolute(cwd) ? cwd : null);
}

// The path as the record names it: relative to the project root with forward slashes when it is inside the root, else
// as given.
function auditRelative(root, file) {
  if (!root || !path.isAbsolute(file)) return file;
  var relative = path.relative(root, file);
  if (relative === "") return ".";
  if (relative === ".." || relative.indexOf(".." + path.sep) === 0 || path.isAbsolute(relative)) return file;
  return relative.split(path.sep).join("/");
}

// The audit fields of a hook input, only the ones present and well-formed: tool, path with its data_class tag,
// agent_type, agent_id. A call with neither agent field is the main session. Every data class is "untagged" until
// task plan Step 23 adds the classifier. Never holds command text, a prompt, or file contents.
function auditFields(input, root) {
  var fields = {};
  if (!input || typeof input !== "object") return fields;
  if (typeof input.tool_name === "string" && AUDIT_TOOL_PATTERN.test(input.tool_name)) fields.tool = input.tool_name;
  var toolInput = input.tool_input && typeof input.tool_input === "object" ? input.tool_input : {};
  for (var i = 0; i < AUDIT_PATH_KEYS.length; i++) {
    var file = toolInput[AUDIT_PATH_KEYS[i]];
    if (typeof file === "string" && file.length > 0) {
      fields.path = auditRelative(root, file);
      fields.data_class = AUDIT_UNTAGGED;
      break;
    }
  }
  var type = typeof input.agent_type === "string" && AUDIT_AGENT_TYPE_PATTERN.test(input.agent_type) ? input.agent_type : null;
  var id = typeof input.agent_id === "string" && AUDIT_AGENT_ID_PATTERN.test(input.agent_id) ? input.agent_id : null;
  if (type) fields.agent_type = type;
  else if (!id) fields.agent_type = AUDIT_MAIN_AGENT;
  if (id) fields.agent_id = id;
  return fields;
}

// Maps one audit-chain log entry to a health-log event. Only the error code is copied.
function auditNote(hook, entry) {
  var kind = entry && typeof entry.event === "string" && NAME_PATTERN.test(entry.event) ? entry.event : "audit-note";
  var code = entry && typeof entry.code === "string" && AUDIT_CODE_PATTERN.test(entry.code) ? entry.code : "";
  logEventOnce(hook, kind, code ? "code " + code : "");
}

// The record without its path, for the one retry when the path (a long name, a control character, a secret-shaped name)
// is what the privacy check refused. The audit trail then keeps the access and says the path was withheld.
function withoutPath(record) {
  var copy = {};
  Object.keys(record).forEach(function (key) {
    if (key !== "path" && key !== "data_class") copy[key] = record[key];
  });
  copy.path_withheld = true;
  return copy;
}

// Appends one record to the governance audit log under `root`. Returns true when the line was written. Never throws.
// A refusal by the privacy check (an AuditError) drops the record and logs the refusal's code and field name, which
// audit-chain.js words without any value; a path-only refusal is retried once without the path.
function auditAppend(hook, root, record) {
  try {
    // [NFR-026] An input without an absolute cwd has no project to log for. The skip leaves one deduped code-only
    // health note (no cwd value, no record value), so the missing record has a trace.
    if (!root) {
      logEventOnce(hook, "audit-no-root", "no project root");
      return false;
    }
    var chain = require("./audit-chain.js");
    var options = {
      root: root,
      lockTimeoutMs: AUDIT_LOCK_TIMEOUT_MS,
      log: function (entry) {
        auditNote(hook, entry);
      }
    };
    var toWrite = record;
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        // A failed write is noted by audit-chain.js through options.log.
        return chain.append(toWrite, options).ok === true;
      } catch (err) {
        var refused = err && err.name === "AuditError";
        if (refused && attempt === 0 && toWrite.path !== undefined && /record\.path/.test(String(err.message))) {
          toWrite = withoutPath(toWrite);
          continue;
        }
        logEventOnce(hook, "audit-dropped", refused ? "refused: " + sanitize(err.code || "") + " " + sanitize(err.message || "") : describeError(err));
        return false;
      }
    }
    return false;
  } catch (outer) {
    logEventOnce(hook, "audit-error", describeError(outer));
    return false;
  }
}

// [NFR-026] Appends the decision record of one guard decision: decision ("deny" or "ask"), the rule id, and the audit
// fields of the input. Never throws, and a failed append leaves the decision as it was.
function logDecision(hook, decision, ruleId, input) {
  try {
    var root = auditRoot(input);
    var record = { event: AUDIT_DECISION_EVENT, decision: decision, rule_id: ruleId };
    var fields = auditFields(input, root);
    Object.keys(fields).forEach(function (key) {
      record[key] = fields[key];
    });
    auditAppend(hook, root, record);
  } catch (err) {
    logEventOnce(hook, "audit-error", describeError(err));
  }
}

// The rule id of a decision: the evaluate result's own `rule` when it is a short lowercase identifier, else the guard name.
function decisionRuleId(hook, decision) {
  return decision && typeof decision.rule === "string" && AUDIT_RULE_PATTERN.test(decision.rule) ? decision.rule : hook;
}

// ---------------------------------------------------------------------------------------------
// Logged disablement [FR-228|NFR-032|NFR-026]
//
// A guard listed in hooks-disabled.json is off, so its calls pass unchecked. Each listed guard yields one
// "guard-disabled" event in the governance audit log: {event, guard}, with the timestamp and chain hash added by
// audit-chain.js. The event names the guard and never holds the disable reason, a command, a path, or a cwd.
//
// Dedup spans sessions. health-state.json holds `disabledAudited`: { <guard>: { ts, roots } }, where `ts` is the
// disable timestamp of the hooks-disabled.json entry and `roots` lists the short hashes of the project roots whose log
// already holds the event. The audit log is per project and the data directory is shared by all projects, so a guard
// is logged once per project, then not again while its entry keeps the same `ts`. A guard that leaves the list and
// returns gets a new `ts` (and session start prunes the entry), so it is logged again. The state file is dedup
// bookkeeping, not an audit record, and holds no path (a root is stored as a truncated SHA-256 only).
//
// Recording fails open: an append that fails or is refused leaves the guard's state unrecorded (the next session
// retries) and is noted in hook-health.jsonl by auditAppend. Nothing here changes whether a guard is disabled.

var AUDIT_DISABLEMENT_EVENT = "guard-disabled";
var AUDIT_INIT_EVENT = "audit-initialized";
var AUDITED_KEY = "disabledAudited";
var MAX_AUDITED_ROOTS = 100;

// The project root of this process: CLAUDE_PROJECT_DIR when set, else the working directory, then its git root.
function projectRoot() {
  try {
    return auditRoot({ cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd() });
  } catch (err) {
    return null;
  }
}

function rootId(root) {
  return require("crypto").createHash("sha256").update(root).digest("hex").slice(0, 16);
}

// [FR-228] Makes sure the audit log exists under `root`: when the current segment is absent, appends one
// "audit-initialized" event, which creates it. Returns true when the log exists afterwards. Never throws.
function ensureAuditLog(hook, root) {
  try {
    if (!root) return false;
    if (fs.existsSync(require("./audit-chain.js").logPath(root))) return true;
    return auditAppend(hook, root, { event: AUDIT_INIT_EVENT });
  } catch (err) {
    logEventOnce(hook, "audit-error", describeError(err));
    return false;
  }
}

// [FR-228] Appends one disablement event for each guard of `disabled` ({name: {reason, ts}}, as readDisabled returns)
// that the log of `root` does not yet hold for the current disable timestamp. With options.prune the dedup state keeps
// only these guards, so a guard that was re-enabled is logged again if it is disabled later; without it the state of
// other guards is kept. A root of null does nothing. Never throws.
function recordDisablements(hook, root, disabled, options) {
  try {
    if (!root || !disabled) return;
    var names = Object.keys(disabled);
    var state = readState();
    var audited = state[AUDITED_KEY] && typeof state[AUDITED_KEY] === "object" && !Array.isArray(state[AUDITED_KEY]) ? state[AUDITED_KEY] : {};
    var next = {};
    if (!(options && options.prune)) {
      Object.keys(audited).forEach(function (name) {
        next[name] = audited[name];
      });
    }
    var id = rootId(root);
    names.forEach(function (name) {
      var ts = disabled[name] && typeof disabled[name].ts === "string" ? disabled[name].ts : INVALID;
      var prior = Object.prototype.hasOwnProperty.call(audited, name) ? audited[name] : null;
      var roots = prior && prior.ts === ts && Array.isArray(prior.roots)
        ? prior.roots.filter(function (value) {
            return typeof value === "string";
          })
        : [];
      if (roots.indexOf(id) === -1 && auditAppend(hook, root, { event: AUDIT_DISABLEMENT_EVENT, guard: name })) roots.push(id);
      next[name] = { ts: ts, roots: roots.slice(-MAX_AUDITED_ROOTS) };
    });
    if (JSON.stringify(next) === JSON.stringify(audited)) return;
    state[AUDITED_KEY] = next;
    writeState(state);
  } catch (err) {
    logEventOnce(hook, "audit-error", describeError(err));
  }
}

// The skip point of a disabled guard or filter: logs its disablement for this project when the log lacks it, which
// covers a guard disabled in the middle of a session. Never throws.
function recordSkip(hook, entry) {
  try {
    var disabled = {};
    disabled[hook] = entry;
    recordDisablements(hook, projectRoot(), disabled, null);
  } catch (err) {
    // a failed record never changes the skip
  }
}

// ---------------------------------------------------------------------------------------------
// Guard runner

function denyOutput(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason
    }
  };
}

function askOutput(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: reason
    }
  };
}

// Runs a PreToolUse guard. evaluate(input) returns {deny, ask, reason}: deny and ask are booleans, reason a string.
// The command is blocked only when evaluate positively returns deny === true; deny wins over ask. The user is asked
// only when evaluate positively returns ask === true (and deny is not true). Only pr-post-ask returns ask: true;
// every other guard is unchanged. The ask path writes no hook-health record: it is a decision, not a failure.
//
// [NFR-026] A deny or ask also appends a decision record (logDecision) to the governance audit log, after the output is
// written. The rule id is evaluate's optional `rule` (a lowercase identifier) or else the guard name. An allow is not
// logged. A logging failure never changes the outcome.
//
// [NFR-028] options.failClosedFor(input) is an optional classifier for a security-critical guard. It must be cheap,
// must not throw, and returns true when the call belongs to the guard's guarded class. When evaluate throws, an
// uncaught exception, an unhandled rejection, or a timeout occurs after the input was parsed, and the classifier
// returns true, the call is denied (deny JSON, exit 0) and the failure is logged; any other call proceeds as before.
// An absent configuration file is not an error: the guard's evaluate decides log-only behavior itself. A classifier
// that throws counts as "not in the class". Stdin errors, malformed input, and a disabled guard still proceed.
function guard(name, evaluate, options) {
  var failClosedFor = options && typeof options.failClosedFor === "function" ? options.failClosedFor : null;
  var parsed = false;
  var parsedInput = null;
  var failure = {
    failClosedNow: failClosedFor
      ? function () {
          return parsed && failClosedFor(parsedInput) === true;
        }
      : null,
    // [NFR-026] The fail-closed deny is a deny decision too: it gets a decision record under the rule id <name>.fail-closed.
    onFailClosed: function () {
      logDecision(name, "deny", name + ".fail-closed", parsedInput);
    }
  };
  installHandlers(name, failure);
  startWatchdog(name, WATCHDOG_MS, failure);
  readStdin(function (stdinError, raw) {
    if (finished) return;
    if (stdinError) {
      failOpen(name, "stdin-error", "could not read hook input", stdinError);
      return;
    }
    var disabled = null;
    try {
      disabled = disabledEntry(name);
    } catch (err) {
      disabled = null;
    }
    if (disabled) {
      finished = true;
      recordSkip(name, disabled);
      var why = disabled.reason ? " (" + sanitize(disabled.reason) + ")" : "";
      warn(
        "assist-plugin " + name + " guard is disabled" + why + "; protection is off and this command was not checked. " +
          "Run /assist-plugin:health for details."
      );
      exitZero();
      return;
    }
    var input;
    try {
      input = JSON.parse(raw);
    } catch (parseError) {
      failOpen(name, "malformed-input", "hook input is not valid JSON", null);
      return;
    }
    parsedInput = input;
    parsed = true;
    var decision;
    try {
      decision = evaluate(input);
    } catch (evalError) {
      failOpen(name, "exception", "guard logic failed", evalError, failure);
      return;
    }
    if (decision && decision.deny === true) {
      finished = true;
      var reason = typeof decision.reason === "string" && decision.reason ? decision.reason : "blocked by assist-plugin guard " + name;
      writeStdout(JSON.stringify(denyOutput(reason)));
      // [NFR-026] The decision record follows the output, so a slow or failed append cannot delay or change the deny.
      logDecision(name, "deny", decisionRuleId(name, decision), input);
    } else if (decision && decision.ask === true) {
      finished = true;
      var askReason = typeof decision.reason === "string" && decision.reason ? decision.reason : "assist-plugin guard " + name + " asks before this command";
      writeStdout(JSON.stringify(askOutput(askReason)));
      logDecision(name, "ask", decisionRuleId(name, decision), input);
    }
    exitZero();
  });
}

// One notice per disable event: remembered in health-state.json under the disable timestamp.
function disabledNoticeShown(name, entry) {
  try {
    var state = readState();
    var shown = state.disabledNotice && typeof state.disabledNotice === "object" ? state.disabledNotice : {};
    if (shown[name] && shown[name] === entry.ts) return true;
    shown[name] = entry.ts;
    state.disabledNotice = shown;
    writeState(state);
  } catch (err) {
    // a state write failure only means the notice may repeat
  }
  return false;
}

// Runs a filter hook (PostToolUse, PreToolUse, UserPromptSubmit). fn(input) returns null (emit
// nothing) or {stdout: object, logKind?: string, message?: string}. Nothing here blocks: the only
// stdout is the object fn returned, or a {"systemMessage"} warning. Always exits 0.
// options: {suffix: tail of the failure warning, disabledNote: tail of the one-time disabled notice}.
// A hook listed in hooks-disabled.json passes through with a one-time systemMessage.
function transform(name, fn, options) {
  options = options || {};
  var failure = { suffix: options.suffix || "this content was not filtered" };
  installHandlers(name, failure);
  startWatchdog(name, WATCHDOG_MS, failure);
  readStdin(function (stdinError, raw) {
    if (finished) return;
    if (stdinError) {
      failOpen(name, "stdin-error", "could not read hook input", stdinError, failure);
      return;
    }
    var disabled = null;
    try {
      disabled = disabledEntry(name);
    } catch (err) {
      disabled = null;
    }
    if (disabled) {
      finished = true;
      recordSkip(name, disabled);
      if (!disabledNoticeShown(name, disabled)) {
        var why = disabled.reason ? " (" + sanitize(disabled.reason) + ")" : "";
        warn(
          "assist-plugin " + name + " is disabled" + why + "; " + (options.disabledNote || "protection is off and this content was not filtered") + ". " +
            "Run /assist-plugin:health for details."
        );
      }
      exitZero();
      return;
    }
    var input;
    try {
      input = JSON.parse(raw);
    } catch (parseError) {
      failOpen(name, "malformed-input", "hook input is not valid JSON", null, failure);
      return;
    }
    var result;
    try {
      result = fn(input);
    } catch (evalError) {
      failOpen(name, "exception", "filter logic failed", evalError, failure);
      return;
    }
    if (result && typeof result.logKind === "string" && NAME_PATTERN.test(result.logKind)) {
      logEvent(name, result.logKind, typeof result.message === "string" ? result.message : "");
    }
    var text = null;
    if (result && result.stdout && typeof result.stdout === "object") {
      try {
        text = JSON.stringify(result.stdout);
      } catch (stringifyError) {
        failOpen(name, "exception", "filter output could not be serialized", stringifyError, failure);
        return;
      }
    }
    finished = true;
    if (text) {
      writeStdoutFlushed(text, exitZero);
      return;
    }
    exitZero();
  });
}

module.exports = {
  LOG_FILE: LOG_FILE,
  DISABLED_FILE: DISABLED_FILE,
  STATE_FILE: STATE_FILE,
  MAX_LOG_LINES: MAX_LOG_LINES,
  dataFile: dataFile,
  readDisabled: readDisabled,
  writeDisabled: writeDisabled,
  readState: readState,
  writeState: writeState,
  readLog: readLog,
  readJsonl: readJsonl,
  appendJsonl: appendJsonl,
  clearLog: clearLog,
  describeError: describeError,
  sanitize: sanitize,
  failOpen: failOpen,
  installHandlers: installHandlers,
  startWatchdog: startWatchdog,
  guard: guard,
  transform: transform,
  logEvent: logEvent,
  warn: warn,
  exitZero: exitZero,
  auditRoot: auditRoot,
  auditFields: auditFields,
  auditAppend: auditAppend,
  logDecision: logDecision,
  projectRoot: projectRoot,
  ensureAuditLog: ensureAuditLog,
  recordDisablements: recordDisablements
};
