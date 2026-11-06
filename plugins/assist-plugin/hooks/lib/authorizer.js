// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-227|UR-066] The human-authorizer resolver: which user approval stands behind an action. Spec:
// specs/spec-hooks-audit.md, Requirement: Human authorizer resolution. The attribution record
// (lib/audit-chain.js attribute()) and the subagent log (impl/fsa-log.js) take the authorizer slot from here.
//
// resolve(input, options) returns {authorizer, authorizer_reason?}:
//   reference  authorizer is a reference string and authorizer_reason is absent. The reference is one of
//                plan-approval:<plan file name>@<YYYY-MM-DDTHH:mm>   the plan's "Approved" decision that the orchestrator
//                                                                   wrote under <root>/.agent/main-plan/, or
//                approval-message:<id>                              the approval message id, when the caller has it.
//   none       authorizer is "none" and authorizer_reason names why, from a closed list:
//                autonomous-action   the caller marks the action as taken with no user action (options.autonomous)
//                no-project-root     the input names no project root to look in
//                no-approved-plan    no plan under .agent/main-plan/ is in an approved state
//                no-user-approval    the newest approved-state plan has no "Approved: <time>" decision (an approval skipped
//                                    for a single read-only step reads "None (single read-only step, approval skipped)")
//                plan-unreadable     the plan directory or file could not be read
// The field is never omitted and never blank. The reference holds a file name and a minute only. The message text, the
// plan body, and every other decision stay unread by this module's output: [NFR-031] nothing the user typed leaves it.
//
// Reads are file reads only (a directory listing, a stat per plan, and a bounded read of each plan head, at most 25 plans). The plan directory is
// protected from subagent writes (lib/fsa-paths.js, "**/.agent/main-plan/**"), so only the orchestrator writes the
// decision this module reads. A plan is in an approved state when its Status line reads "Approved" or "In Progress";
// the newest such plan by modification time is the one that authorizes the action.
//
// ES5 syntax, so lib/health.js can load it lazily on any Node version. No dependencies. Fails open: nothing throws.
"use strict";

var fs = require("fs");
var path = require("path");

var NONE = "none";
var PLAN_DIR = path.join(".agent", "main-plan");
var PLAN_FILE_PATTERN = /^plan-[A-Za-z0-9._-]{1,110}\.md$/;
var MESSAGE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
var STATUS_PATTERN = /^\*\*Status:\*\*[ \t]*(.+?)[ \t]*$/m;
var DECISIONS_PATTERN = /^##[ \t]+User Decisions[ \t]*$/m;
var NEXT_HEADING_PATTERN = /^##[ \t]/m;
var APPROVED_PATTERN = /^[ \t]*-[ \t]+Approved:[ \t]+(\d{4}-\d{2}-\d{2})[ \t]+(\d{2}:\d{2})(?![\d:])/m;
var APPROVED_STATUSES = ["Approved", "In Progress"];
var HEAD_BYTES = 16 * 1024;
var MAX_PLANS = 25;

// Reports one problem to options.log. A failing logger must never break the caller.
function note(options, code) {
  try {
    if (options && typeof options.log === "function") options.log({ level: "warn", event: "authorizer-unreadable", code: code });
  } catch (err) {
    // The logger failed; the authorizer still resolves.
  }
}

function errorCode(err) {
  return err && typeof err.code === "string" ? err.code : "unknown";
}

function none(reason) {
  return { authorizer: NONE, authorizer_reason: reason };
}

// The first HEAD_BYTES of a file as text. The Status line and the User Decisions section sit at the top of a plan.
function readHead(file) {
  var fd = fs.openSync(file, "r");
  try {
    var buffer = Buffer.alloc(HEAD_BYTES);
    var count = fs.readSync(fd, buffer, 0, HEAD_BYTES, 0);
    return buffer.toString("utf8", 0, count);
  } finally {
    fs.closeSync(fd);
  }
}

// The approval minute ("YYYY-MM-DDTHH:mm") of a plan head that is in an approved state, or null. Only the first
// "Approved: <time>" bullet inside the User Decisions section counts.
function approvalOf(head) {
  var status = STATUS_PATTERN.exec(head);
  if (!status || APPROVED_STATUSES.indexOf(status[1]) === -1) return { approved: false, minute: null };
  var section = DECISIONS_PATTERN.exec(head);
  if (!section) return { approved: true, minute: null };
  var rest = head.slice(section.index + section[0].length);
  var next = NEXT_HEADING_PATTERN.exec(rest);
  var body = next ? rest.slice(0, next.index) : rest;
  var decision = APPROVED_PATTERN.exec(body);
  return { approved: true, minute: decision ? decision[1] + "T" + decision[2] : null };
}

// The plan files of `dir` as [{name, mtime}], newest first, at most MAX_PLANS.
function newestPlans(dir) {
  var plans = [];
  fs.readdirSync(dir).forEach(function (name) {
    if (!PLAN_FILE_PATTERN.test(name)) return;
    try {
      var stat = fs.statSync(path.join(dir, name));
      if (stat.isFile()) plans.push({ name: name, mtime: stat.mtimeMs });
    } catch (err) {
      // A file that vanished between the listing and the stat is skipped.
    }
  });
  plans.sort(function (a, b) {
    return b.mtime - a.mtime || (a.name < b.name ? -1 : 1);
  });
  return plans.slice(0, MAX_PLANS);
}

// The project root of the input: options.root, else the git root of input.cwd, else an absolute cwd, else null.
function rootOf(input, options) {
  if (options && typeof options.root === "string" && path.isAbsolute(options.root)) return options.root;
  var cwd = input && typeof input === "object" && typeof input.cwd === "string" ? input.cwd : "";
  if (!cwd || !path.isAbsolute(cwd)) return null;
  try {
    return require("./git-root.js").findGitRoot(cwd) || cwd;
  } catch (err) {
    return cwd;
  }
}

// [FR-227|UR-066] The human authorizer of an action. options: {root, autonomous, messageId, log}. `root` is the absolute
// project root (else it comes from input.cwd), `autonomous` marks an action with no user action, `messageId` is the id
// of the user's approval message when the caller has it, and `log` receives one {level, event, code} entry per read
// problem. Never throws and never omits the authorizer.
function resolve(input, options) {
  try {
    if (options && options.autonomous === true) return none("autonomous-action");
    if (options && typeof options.messageId === "string" && MESSAGE_ID_PATTERN.test(options.messageId)) {
      return { authorizer: "approval-message:" + options.messageId };
    }
    var root = rootOf(input, options);
    if (!root) return none("no-project-root");
    var dir = path.join(root, PLAN_DIR);
    var plans;
    try {
      plans = newestPlans(dir);
    } catch (err) {
      if (errorCode(err) === "ENOENT" || errorCode(err) === "ENOTDIR") return none("no-approved-plan");
      note(options, errorCode(err));
      return none("plan-unreadable");
    }
    var unread = false;
    for (var i = 0; i < plans.length; i++) {
      var found;
      try {
        found = approvalOf(readHead(path.join(dir, plans[i].name)));
      } catch (err) {
        note(options, errorCode(err));
        unread = true;
        continue;
      }
      if (!found.approved) continue;
      // The newest approved-state plan decides alone: an older plan's approval never stands in for it.
      if (found.minute) return { authorizer: "plan-approval:" + plans[i].name + "@" + found.minute };
      return none("no-user-approval");
    }
    return none(unread ? "plan-unreadable" : "no-approved-plan");
  } catch (err) {
    note(options, errorCode(err));
    return none("plan-unreadable");
  }
}

// The authorizer slot of a record: {authorizer, authorizer_reason?}. Always has `authorizer`.
function fields(input, options) {
  var who = resolve(input, options);
  var out = { authorizer: who.authorizer };
  if (who.authorizer_reason !== undefined) out.authorizer_reason = who.authorizer_reason;
  return out;
}

module.exports = {
  NONE: NONE,
  PLAN_DIR: PLAN_DIR,
  resolve: resolve,
  fields: fields
};
