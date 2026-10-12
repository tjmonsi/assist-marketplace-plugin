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
//   - transform() runs a PostToolUse / PreToolUse / UserPromptSubmit filter. It emits output only when the
//     filter positively returns {stdout}; every failure path above prints nothing or a systemMessage and exits 0.
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

// Record the failure, warn, and exit 0 so the command proceeds. Never throws, never exits non-zero.
// detail must be a fixed string from our own code (never user input); err is described, not copied.
// options: {suffix: sentence tail for the warning}
function failOpen(hook, kind, detail, err, options) {
  if (finished) return;
  finished = true;
  options = options || {};
  var message = sanitize((detail || "") + (err ? (detail ? ": " : "") + describeError(err) : ""));
  try {
    appendLog({
      ts: new Date().toISOString(),
      hook: hook,
      node: nodeVersion(),
      kind: kind,
      message: message
    });
  } catch (logError) {
    // health-log write failure must not change the outcome
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

// Runs a PreToolUse guard. evaluate(input) returns {deny: boolean, reason: string}.
// The command is blocked only when evaluate positively returns deny === true.
function guard(name, evaluate) {
  installHandlers(name);
  startWatchdog(name, WATCHDOG_MS);
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
    var decision;
    try {
      decision = evaluate(input);
    } catch (evalError) {
      failOpen(name, "exception", "guard logic failed", evalError);
      return;
    }
    if (decision && decision.deny === true) {
      finished = true;
      var reason = typeof decision.reason === "string" && decision.reason ? decision.reason : "blocked by assist-plugin guard " + name;
      writeStdout(JSON.stringify(denyOutput(reason)));
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
  exitZero: exitZero
};
