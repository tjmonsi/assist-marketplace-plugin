// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// SessionStart and SubagentStart hook: adds the compact writing standard (rules/writing-standard-compact.md)
// to the context of the main session and of every subagent, so all output follows it. SessionStart re-fires
// after /clear and compaction, and SubagentStart context is re-injected after a subagent compacts.
// The file is read at run time from ${CLAUDE_PLUGIN_ROOT}, so editing it changes the next session.
// Fail-open: a missing, unreadable, or empty file emits nothing and writes a health-log entry; any other
// failure emits only a systemMessage (see ../lib/health.js). Never exits 2.
"use strict";

const fs = require("fs");
const path = require("path");

const NAME = "writing-context";
const STANDARD = path.join("rules", "writing-standard-compact.md");
const HEADER = "assist-plugin writing standard for prose you write (reports, docs, replies, comments). " +
  "It does not apply to code, data, or quoted text; project and user instructions take precedence:";
const MAX_CONTEXT = 10000; // Claude Code's additionalContext cap
const EVENTS = ["SessionStart", "SubagentStart"];

function pluginRoot(env) {
  return env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, "..", "..");
}

function readStandard(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    return null;
  }
}

// Keeps whole lines within the cap.
function fit(text) {
  if (text.length <= MAX_CONTEXT) return { text, cut: false };
  const end = text.lastIndexOf("\n", MAX_CONTEXT);
  return { text: text.slice(0, end > 0 ? end : MAX_CONTEXT), cut: true };
}

// Returns null (emit nothing), a log-only result, or {stdout}. options: {env, readFile} for tests.
function evaluate(input, options) {
  const opts = options || {};
  if (!input || EVENTS.indexOf(input.hook_event_name) === -1) return null;
  const read = typeof opts.readFile === "function" ? opts.readFile : readStandard;
  const raw = read(path.join(pluginRoot(opts.env || process.env), STANDARD));
  if (typeof raw !== "string") {
    return { logKind: "missing-standard", message: "rules/writing-standard-compact.md could not be read; no writing context added" };
  }
  const body = raw.replace(/\s+$/, "");
  if (body.length === 0) {
    return { logKind: "empty-standard", message: "rules/writing-standard-compact.md is empty; no writing context added" };
  }
  const context = fit(HEADER + "\n" + body);
  const result = {
    stdout: { hookSpecificOutput: { hookEventName: input.hook_event_name, additionalContext: context.text } },
  };
  if (context.cut) {
    result.logKind = "standard-truncated";
    result.message = "rules/writing-standard-compact.md exceeds " + MAX_CONTEXT + " characters with the header; the tail was cut";
  }
  return result;
}

function main() {
  require("../lib/health.js").transform(NAME, evaluate, { suffix: "the writing standard was not loaded" });
}

module.exports = { NAME, HEADER, MAX_CONTEXT, evaluate, main };

if (require.main === module) main();
