// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// PreToolUse guard for Bash and PowerShell: deny a command that posts a PR verdict unless a hook-recorded user
// confirmation exists for that PR and that verdict (FR-214, task plan Tranche 1 Step 4).
//   - gh pr review <n> with --approve, --request-changes, or --comment (parsed by ../lib/pr-verdict.js)
//   - bkt pr approve <n> and bkt pr decline <n>
// It does not cover gh pr merge, close, or comment, bkt pr comment, any bkt api call, or a SARIF upload; those keep the
// ask of pr-post-ask and the confirmation flow of the skills.
// The guard reads confirmations.jsonl, through findConfirmation of ../lib/confirmation-store.js, and nothing else. It
// never reads pending.jsonl: a pending-action record is no confirmation, and an affirmative without the token records
// nothing, so the guard keeps denying (FR-242). Its only I/O is those file reads and the .git walk of ../lib/git-root.js,
// both replaceable in a test (options.findConfirmation, options.root).
// Additive (PN-5): pr-post-ask is unchanged and still asks for a review, approve, or decline. A deny from this guard wins
// over that ask; after a recorded confirmation the user may still see the pr-post-ask prompt (two prompts).
// [NFR-028] Security-critical guard: main() passes the classifier guardedClass to guard() in ../lib/health.js, so an
// evaluate error, an uncaught exception, or a timeout after the input was parsed denies a command that looks like a PR
// verdict post, and the failure is logged. Not covered, by the shared runtime: an input that cannot be read or parsed, a
// disabled guard (hooks-disabled.json), and a failure of the launcher before this module runs (an unsupported Node or a
// module that does not load); each lets the command proceed with a systemMessage.
// On allow, main() appends one record per confirmed verdict (PR, verdict, the confirmation's message reference) to
// pr-verdict-log.jsonl in the plugin data directory (FR-214). The record holds no command text and no message text.
// The denial names the missing confirmation and repeats no command text beyond a numeric PR and the verdict.
"use strict";

const health = require("../lib/health.js");
const gitRoot = require("../lib/git-root.js");
const store = require("../lib/confirmation-store.js");
const prVerdict = require("../lib/pr-verdict.js");

const NAME = "pr-verdict-guard";
const LOG_FILE = "pr-verdict-log.jsonl";
const MAX_LOG_LINES = 200;
const NUMERIC_PR = /^\d{1,10}$/;
// Words, in order, that mark a command as possibly posting a PR verdict: gh or bkt, then pr, then one of the verbs.
const CLASS_STAGES = [["gh", "bkt"], ["pr"], ["review", "approve", "decline"]];

function isShellTool(input) {
  return input !== null && typeof input === "object" && (input.tool_name === "Bash" || input.tool_name === "PowerShell");
}

function commandOf(input) {
  return input.tool_input && typeof input.tool_input.command === "string" ? input.tool_input.command : "";
}

function allow(confirmed) {
  return { ask: false, deny: false, reason: "", confirmed: confirmed || [] };
}

function deny(reason) {
  return { ask: false, deny: true, reason, confirmed: [] };
}

// The PR as the denial may show it: a number, or a plain note, never the text of the command.
function prLabel(pr) {
  return typeof pr === "string" && NUMERIC_PR.test(pr) ? pr : "(not given as a number)";
}

function missingReason(target) {
  return `assist-plugin ${NAME}: no recorded user confirmation for PR ${prLabel(target.pr)}, verdict ${target.verdict}. ` +
    "Posting this verdict is denied until the user confirms it with the per-action token in their own message " +
    "(PR Confirmation Token Rule). Ask the user, then run the command again.";
}

function unreadableReason() {
  return `assist-plugin ${NAME}: this command posts a PR verdict, but its PR or its verdict cannot be read, so no recorded ` +
    "user confirmation can be matched to it. Give the PR number and one verdict flag as plain words.";
}

// The store lookup for this call: findConfirmation(pr, verdict) -> record or null. The store root is options.root, else
// the git root of the session's cwd, else the cwd (as confirmation-record does). With no root every lookup finds none,
// which denies.
function lookupFor(input, options) {
  if (typeof options.findConfirmation === "function") return options.findConfirmation;
  let root = options.root;
  if (typeof root !== "string" || root.length === 0) {
    const cwd = typeof input.cwd === "string" ? input.cwd : "";
    root = gitRoot.findGitRoot(cwd) || cwd;
  }
  if (typeof root !== "string" || root.length === 0) return () => null;
  return (pr, verdict) => store.findConfirmation(pr, verdict, { root, log: options.log });
}

// [FR-214] Decision function. Returns {ask: false, deny, reason, confirmed}: confirmed lists {pr, verdict, reference} of
// each verdict the command posts when all have a recorded confirmation. options (tests and the self-test):
// {findConfirmation(pr, verdict), root, log}. It reads neither agent_type nor agent_id: the rule binds every caller.
function evaluate(input, options) {
  if (!isShellTool(input)) return allow();
  const opts = options || {};
  const targets = prVerdict.parse(commandOf(input), input.tool_name === "PowerShell");
  if (targets.length === 0) return allow();
  const lookup = lookupFor(input, opts);
  const confirmed = [];
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    if (target.pr === null || target.verdict === null) return deny(unreadableReason());
    const record = lookup(target.pr, target.verdict);
    if (!record) return deny(missingReason(target));
    confirmed.push({ pr: target.pr, verdict: target.verdict, reference: record.user_message_ref });
  }
  return allow(confirmed);
}

// [NFR-028] Cheap, non-throwing classifier for the fail-closed path: true when the command holds the words gh or bkt,
// then pr, then review, approve, or decline. It reads the words loosely on purpose (a superset of what the parser
// accepts), because it runs only after the parser or the runtime failed.
function guardedClass(input) {
  try {
    if (!isShellTool(input)) return false;
    const words = commandOf(input).toLowerCase().split(/[^a-z0-9]+/);
    let stage = 0;
    for (let i = 0; i < words.length && stage < CLASS_STAGES.length; i++) {
      if (CLASS_STAGES[stage].indexOf(words[i]) !== -1) stage += 1;
    }
    return stage === CLASS_STAGES.length;
  } catch (err) {
    return false;
  }
}

// Appends one allow record per confirmed verdict. A log failure never changes the decision.
function recordAllowed(decision) {
  decision.confirmed.forEach((entry) => {
    try {
      health.appendJsonl(LOG_FILE, {
        ts: new Date().toISOString(),
        hook: NAME,
        event: "verdict-allowed",
        pr: entry.pr,
        verdict: entry.verdict,
        confirmation_ref: entry.reference,
      }, MAX_LOG_LINES);
    } catch (err) {
      // the allow stands without its log record
    }
  });
}

// A store problem goes to the hook-health log without the PR, the verdict, or any message text.
function logStoreProblem(entry) {
  health.logEvent(NAME, entry.event, `${entry.file} ${entry.code || ""}`);
}

function main() {
  health.guard(NAME, (input) => {
    const decision = evaluate(input, { log: logStoreProblem });
    recordAllowed(decision);
    return decision;
  }, { failClosedFor: guardedClass });
}

module.exports = { NAME, evaluate, guardedClass, main };

if (require.main === module) main();
