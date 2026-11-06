// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// UserPromptSubmit hook that records the user's confirmation of a PR verdict post (FR-242, task plan Tranche 1 Step 3).
//   1. /do (or /pr-review) writes a pending-action record {pr, verdict, token, session_id, created_at} to
//      pending.jsonl when it shows the draft, and shows the token. The orchestrator never writes confirmations.jsonl.
//   2. The user confirms by typing the token in their own message. This hook reads only input.prompt, the message the
//      user typed, and input.session_id. It finds a token in that text and matches it to an unused, unexpired pending
//      record of the same session with findPending (../lib/confirmation-store.js).
//   3. Only on a match the hook writes the confirmation record to confirmations.jsonl (recordConfirmation) and then
//      consumes the token (markPendingUsed), so the token confirms once. The PR-verdict guard of FR-214 reads
//      confirmations.jsonl and nothing else.
// Fail-closed for the confirmation: an affirmative with no token, a token that is unknown, used, expired, or from
// another session, text that sits in a quote line or a code fence, a prompt that carries two matching tokens, and
// any failure to read or write the store all write no record. The user's message is never blocked or changed.
// The record holds the PR, the verdict, a timestamp, a reference (session_id and a millisecond clock reading), and the
// writer "hook". It never holds the message text and never the token [NFR-031]; this hook logs no token, PR, or text.
// Residual limit: the token is the only signal. The hook does not parse "yes" or "no", so a message that holds the
// token confirms; the flow text tells the user to leave the token out to decline.
// Fail-open for the prompt: any failure shows a systemMessage and lets the message through (see ../lib/health.js).
// It is a record writer, not a security boundary on its own: a shell command can still reach the store until Step 15.
"use strict";

const health = require("../lib/health.js");
const gitRoot = require("../lib/git-root.js");
const store = require("../lib/confirmation-store.js");

const NAME = "confirmation-record";

// The prompt is scanned up to this many characters, and at most this many distinct token-shaped words are looked up.
const MAX_PROMPT_CHARS = 100000;
const MAX_CANDIDATES = 20;
const FENCE = /^\s*(```|~~~)/;
const QUOTE_LINE = /^\s*>/;
const WORD = /[A-Za-z0-9]+/g;

const NOTICE_PREFIX = "assist-plugin confirmation-record: ";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// [FR-242] The text the user typed as their own words: lines of a fenced code block and lines that start with ">" (a
// quote of the draft, a PR, or a file) are dropped, so a pasted copy of the token never counts.
function ownText(prompt) {
  const kept = [];
  let fenced = false;
  prompt.slice(0, MAX_PROMPT_CHARS).split(/\r?\n/).forEach((line) => {
    if (FENCE.test(line)) {
      fenced = !fenced;
      return;
    }
    if (!fenced && !QUOTE_LINE.test(line)) kept.push(line);
  });
  return kept.join("\n");
}

// Token-shaped words of the text, upper-cased (the user may type the token in lower case), each once.
function candidates(text) {
  const found = [];
  const words = text.match(WORD) || [];
  for (let i = 0; i < words.length && found.length < MAX_CANDIDATES; i++) {
    const word = words[i].toUpperCase();
    if (store.TOKEN_PATTERN.test(word) && found.indexOf(word) === -1) found.push(word);
  }
  return found;
}

// The store options for this event. The root is the git root of the session's cwd, else the cwd itself; options.root
// replaces it in tests. Returns null when no absolute root is known.
function storeOptions(input, options) {
  const given = options || {};
  let root = given.root;
  if (typeof root !== "string" || root.length === 0) {
    const cwd = typeof input.cwd === "string" ? input.cwd : "";
    root = gitRoot.findGitRoot(cwd) || cwd;
  }
  if (typeof root !== "string" || root.length === 0) return null;
  return {
    root,
    now: given.now,
    expiryMs: given.expiryMs,
    log: typeof given.log === "function" ? given.log : (entry) => health.logEvent(NAME, entry.event, `${entry.file} ${entry.code || ""}`),
  };
}

function notice(text, logKind) {
  const result = { stdout: { systemMessage: NOTICE_PREFIX + text } };
  if (logKind) {
    result.logKind = logKind;
    result.message = text;
  }
  return result;
}

// Writes the confirmation for one matched pending record, then consumes the token. A store failure is reported and
// leaves no confirmation (write failed) or an unconsumed token (consume failed).
function confirm(pending, input, opts) {
  const nowMs = typeof opts.now === "function" ? opts.now() : Date.now();
  const ref = `${input.session_id}#${nowMs}`;
  try {
    store.recordConfirmation({ pr: pending.pr, verdict: pending.verdict, userMessageRef: ref }, opts);
  } catch (err) {
    return notice("your confirmation was not recorded (the confirmation store could not be written), so the post stays blocked.", "write-failed");
  }
  try {
    store.markPendingUsed(pending, opts);
  } catch (err) {
    return notice("your confirmation was recorded, but its token could not be marked used and may confirm again until it expires.", "consume-failed");
  }
  return notice(`confirmation recorded for PR ${pending.pr}, verdict ${pending.verdict}.`);
}

// [FR-242] Decision function. Returns null (emit nothing) or {stdout, logKind?, message?} for health.transform.
// options: {root, now, expiryMs, log} for tests and the self-test. The only I/O is the store's reads and writes and the
// .git walk of lib/git-root.js.
function evaluate(input, options) {
  if (!isObject(input) || input.hook_event_name !== "UserPromptSubmit") return null;
  if (typeof input.prompt !== "string" || typeof input.session_id !== "string" || input.session_id.length === 0) return null;
  const tokens = candidates(ownText(input.prompt));
  if (tokens.length === 0) return null;
  const opts = storeOptions(input, options);
  if (!opts) return null;
  const matched = tokens.map((token) => store.findPending(token, input.session_id, opts)).filter((record) => record !== null);
  if (matched.length === 0) return null;
  if (matched.length > 1) return notice("your message carries more than one confirmation token, so nothing was recorded. Send one token.");
  return confirm(matched[0], input, opts);
}

function main() {
  health.transform(NAME, evaluate, {
    suffix: "your confirmation was not recorded, so the post stays blocked",
    disabledNote: "confirmations are not recorded, so a PR verdict post stays blocked",
  });
}

module.exports = { NAME, evaluate, ownText, candidates, main };

if (require.main === module) main();
