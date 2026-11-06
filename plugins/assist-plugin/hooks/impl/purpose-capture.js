// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// UserPromptSubmit hook that writes the session purpose record (FR-247, task plan Tranche 3 Step 24).
//   The writer is this hook, not the orchestrator: it writes with fs (../lib/purpose-record.js), the same trust model as
//   the confirmation store. It reads only input.prompt, the message the user typed, and input.session_id. It never reads
//   model output, a tool result, a subagent report, or the text of a PR, web page, or file as a purpose, and the write
//   bar denies every tool caller a write of the record, so no other path creates or alters it.
// Declaration form (one form, stated in rules/assist-plugin-rule.md, "Session purpose"): the first non-blank line of the
//   user's message starts with "Purpose:" (any case), then the purpose on that same line, 1 to 200 characters.
//   Example: "Purpose: review grading anomalies". Only the first non-blank line counts, so a "Purpose:" line in pasted PR
//   or file text further down, in a quote line (">"), or in a code fence is not a declaration.
// No declaration: the hook writes no record and prints nothing. The access-logging hooks then log the purpose as
//   "unstated" and flag the record; this hook adds no deny on a missing purpose [FR-230].
// A declaration that cannot be recorded (empty, over 200 characters, a control character, or a write failure) leaves the
//   old record as it was and shows a systemMessage; the message is never blocked or changed.
// The record holds the purpose, the writer "hook", the session, and a timestamp. It never holds the rest of the prompt
//   text [NFR-031]. This hook logs no purpose and no prompt text; the health log gets an event name only.
// Fail-open for the prompt: any failure shows a systemMessage and lets the message through (see ../lib/health.js).
"use strict";

const health = require("../lib/health.js");
const record = require("../lib/purpose-record.js");

const NAME = "purpose-capture";

// Only this much of the prompt is scanned; a first line longer than the cap is over the purpose limit anyway.
const MAX_SCAN_CHARS = 4096;
const DECLARATION = /^purpose[ \t]*:[ \t]*(.*)$/i;

const NOTICE_PREFIX = "assist-plugin purpose-capture: ";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// [FR-247] The declaration on the first non-blank line of the user's message: {text} for a "Purpose:" line (the text may
// be empty or unusable), or null when the line is not a declaration. A line that starts with ">" or a code fence is not
// one, because "Purpose:" must be the first thing on the line.
function declaration(prompt) {
  const lines = prompt.slice(0, MAX_SCAN_CHARS).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length === 0) continue;
    const match = DECLARATION.exec(lines[i]);
    return match ? { text: match[1].trim() } : null;
  }
  return null;
}

function notice(text, logKind) {
  const result = { stdout: { systemMessage: NOTICE_PREFIX + text } };
  if (logKind) {
    result.logKind = logKind;
    result.message = text;
  }
  return result;
}

// The record options for this event. The root is the git root of the session's cwd, else the cwd itself (health.auditRoot,
// as the access-logging hooks resolve it); options.root replaces it in tests. Returns null when no absolute root is known.
function recordOptions(input, given) {
  const opts = given || {};
  const root = typeof opts.root === "string" && opts.root.length > 0 ? opts.root : health.auditRoot(input);
  if (!root) return null;
  return {
    root,
    now: opts.now,
    log: typeof opts.log === "function" ? opts.log : (entry) => health.logEvent(NAME, entry.event, entry.code || ""),
  };
}

// [FR-247] Decision function. Returns null (emit nothing) or {stdout, logKind?, message?} for health.transform.
// options: {root, now, log} for tests and the self-test. The only I/O is the record write and the .git walk of
// lib/git-root.js.
function evaluate(input, options) {
  if (!isObject(input) || input.hook_event_name !== "UserPromptSubmit") return null;
  if (typeof input.prompt !== "string" || typeof input.session_id !== "string" || input.session_id.length === 0) return null;
  const declared = declaration(input.prompt);
  if (declared === null) return null;
  if (!record.validPurpose(declared.text)) {
    return notice("your purpose was not recorded. Write it on the first line as \"Purpose: <text>\", 1 to " + record.MAX_PURPOSE_CHARS + " characters on one line.");
  }
  const opts = recordOptions(input, options);
  if (!opts) return notice("your purpose was not recorded (no project directory is known).", "no-root");
  try {
    record.recordPurpose({ purpose: declared.text, sessionId: input.session_id }, opts);
  } catch (err) {
    return notice("your purpose was not recorded (the record could not be written), so access logs show it as unstated.", "write-failed");
  }
  return notice("session purpose recorded: " + declared.text);
}

function main() {
  health.transform(NAME, evaluate, {
    suffix: "your session purpose was not recorded",
    disabledNote: "the session purpose is not recorded, so access logs show it as unstated",
  });
}

module.exports = { NAME, evaluate, declaration, main };

if (require.main === module) main();
