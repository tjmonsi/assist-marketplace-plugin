// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// PreToolUse guard for Write, Edit, MultiEdit, and NotebookEdit: the write bar between the agents.
//   assist-plugin:developer-tester  may write only test paths (agents/developer-tester.md, "Write scope"), and
//                                   never a hidden path (a segment starting with "."), CLAUDE.md,
//                                   CLAUDE.local.md, AGENTS.md, a path over 4096 characters, or a path with a
//                                   NUL character.
//   assist-plugin:developer         may not write test paths (agents/developer.md, "Write scope").
//   assist-plugin:task-planner      may write only a task-plan-*.md file directly under docs/task-plans/ of the
//                                   session's git root (agents/task-planner.md, "Write scope"), and never a hidden
//                                   path, CLAUDE.md, CLAUDE.local.md, AGENTS.md, a path over 4096 characters, or a
//                                   path with a NUL character. The root is the git root of the input cwd (found
//                                   with lib/git-root.js; the cwd itself outside a git repository). Without a usable
//                                   cwd only a plain relative docs/task-plans/task-plan-*.md passes.
//   assist-plugin:requirements-gatherer and assist-plugin:solutions-architect
//                                   read untrusted documents before the user signs off, so they may not write a
//                                   hidden path or CLAUDE.md, CLAUDE.local.md, or AGENTS.md. Other plugin agents
//                                   (devops, worker, qa, general-purpose, and so on) are not held to this: they
//                                   must write .github/, .gitlab-ci.yml, and similar dot paths.
//   every assist-plugin:* agent     may not write a path over 4096 characters or with a NUL character.
//   every subagent (a call with a non-empty agent_id, any agent_type: other plugins and built-ins included)
//                                   may not write .agent/main-plan/** (the /do plan files, which hold sign-off and
//                                   waiver state) or a file named DECISIONS.md, in any directory. These names
//                                   match without regard to case, trailing dots or spaces, or a `:stream` suffix.
//                                   An over-long or NUL path is denied for them too, so it cannot hide one.
// The main session is untouched (allowed, no output), and so are other agents for every other rule. A call with
// an agent_type but no agent_id (a main session started with --agent) is a main-session call, except for
// assist-plugin:* agent types, whose rules key on agent_type alone. The test globs are in lib/fsa-paths.js and
// are checked against the Write scope table by scripts/check-fsa-tables.js.
// A path inside the session's working directory (or CLAUDE_PROJECT_DIR) is judged relative to it, so a project
// that lives under a directory named `tests` is not all test paths. When both roots contain the path, every
// relative form counts for the test globs: developer is denied if any form matches a test glob; developer-tester
// needs a form that matches. The hidden-path and auto-loaded-file denials apply to the innermost
// form only, the path relative to the longest root that contains it, so a worktree under .claude/worktrees is
// not hidden from its own tests directory.
// Scope: the tools above only. A Bash command can write any path and is not covered. Paths are judged as
// written (symlinks and Windows 8.3 short names such as CLAUDE~1 for .claude are not resolved). Test globs and the
// task-plan glob match case-sensitively; the protected names and the CLAUDE.md and AGENTS.md denials fold case
// (see lib/fsa-paths.js).
// Fail-open: evaluate(input) -> {deny, reason}; a call is blocked only when it positively returns deny. Any
// failure (exception, malformed input, unsupported Node, disable flag) lets the write proceed with a
// systemMessage warning (see ../lib/health.js). It is a guardrail, not a security boundary.
"use strict";

const paths = require("../lib/fsa-paths.js");
const gitRoot = require("../lib/git-root.js");

const NAME = "fsa-write-bar";
const TESTER = "assist-plugin:developer-tester";
const DEVELOPER = "assist-plugin:developer";
const PLANNER = "assist-plugin:task-planner";
const PLUGIN_PREFIX = "assist-plugin:";
// Chain agents that read untrusted documents before sign-off: no hidden paths, no auto-loaded files.
const CHAIN_AGENTS = ["assist-plugin:requirements-gatherer", "assist-plugin:solutions-architect"];
const FILE_KEYS = { Write: "file_path", Edit: "file_path", MultiEdit: "file_path", NotebookEdit: "notebook_path" };
const ALLOW = { deny: false, reason: "" };

function shown(file) {
  return String(file).slice(0, 400).replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").slice(0, 200);
}

function denialCause(who, why) {
  const causes = {
    limit: "the path is empty, longer than 4096 characters, or holds a NUL character",
    hidden: "a segment of the path starts with a dot, and " + who + " never writes hidden paths",
    "auto-loaded": "CLAUDE.md, CLAUDE.local.md, and AGENTS.md load into later sessions, and " + who + " never writes them",
  };
  return causes[why];
}

function testerReason(file, why) {
  const cause = why ? denialCause("developer-tester", why) + " (Write scope in agents/developer-tester.md)"
    : "developer-tester writes only test paths, and this path matches none of the test globs listed under Write scope in agents/developer-tester.md";
  return "assist-plugin fsa-write-bar denied this write to " + shown(file) + ": " + cause + ". " +
    "Do not write it. End in Error(policy-rejection) and name the path in the prose above the terminal block.";
}

function developerReason(file, glob) {
  return "assist-plugin fsa-write-bar denied this write to " + shown(file) + ": developer never writes test paths, " +
    "and this path matches the test glob " + glob + " (Write scope in agents/developer-tester.md, referenced from agents/developer.md). " +
    "Tests belong to developer-tester. Do not write it. List the path in the out_of_scope field of the terminal block, " +
    "name it in the prose above the block, and continue with the rest of the work.";
}

function plannerReason(file, why) {
  const scope = "task-planner writes only a task-plan-*.md file directly under docs/task-plans/ of the session's git root, " +
    "and writes a rework of a root-level plan as a new file there (Write scope in agents/task-planner.md)";
  let cause = scope;
  if (why === "outside") cause = "the path is outside the session's git root, and " + scope;
  else if (why) cause = denialCause("task-planner", why) + " (Write scope in agents/task-planner.md)";
  return "assist-plugin fsa-write-bar denied this write to " + shown(file) + ": " + cause + ". " +
    "Do not write it. If this is the task-plan file, end in Error(policy-rejection); otherwise list the path in the out_of_scope field of the terminal block and name it in the prose above the block.";
}

function chainReason(file, why, agentType) {
  const who = agentType.slice(PLUGIN_PREFIX.length);
  return "assist-plugin fsa-write-bar denied this write to " + shown(file) + ": " + denialCause(who, why) + ". " +
    "Do not write it. List the path in the out_of_scope field of the terminal block and name it in the prose above the block.";
}

function limitReason(file) {
  return "assist-plugin fsa-write-bar denied this write to " + shown(file) + ": " + denialCause("", "limit") + ". " +
    "Do not write it. List the path in the out_of_scope field of the terminal block (or end in Error(policy-rejection) if the task cannot continue) and name it in the prose above the block.";
}

function protectedReason(file, rule) {
  return "assist-plugin fsa-write-bar denied this write to " + shown(file) + ": no subagent writes " + rule +
    ". The /do plan files hold the user's sign-off and waivers, and DECISIONS.md holds the user's decisions; only the user changes them. " +
    "Do not write it. List the path in the out_of_scope field of the terminal block (or end in Error(policy-rejection) if the task cannot continue) and name it in the prose above the block.";
}

// Roots that make a path project-relative: the hook's cwd and CLAUDE_PROJECT_DIR. options.roots replaces them in tests.
function rootsFor(input, options) {
  if (options && Array.isArray(options.roots)) return options.roots;
  return [input.cwd, process.env.CLAUDE_PROJECT_DIR].filter((root) => typeof root === "string" && root.length > 0);
}

// [FR-186] True when `value` is absolute by the string rule, on every platform: it starts with `/`, or with a drive
// letter, `:`, and `/` (backslashes count as slashes). The hook does not ask the host platform (path.isAbsolute),
// because a Linux host would treat `C:/proj` as relative and resolve it against the plugin directory.
function absoluteByString(value) {
  return /^(\/|[A-Za-z]:\/)/.test(value.replace(/\\/g, "/"));
}

// [FR-186] The session root R: the git root of the hook input's cwd (options.findGitRoot replaces the walk in tests),
// else the cwd itself. CLAUDE_PROJECT_DIR plays no part. The walk never throws and starts no git process.
function sessionRoot(cwd, options) {
  const find = options && typeof options.findGitRoot === "function" ? options.findGitRoot : gitRoot.findGitRoot;
  const found = find(cwd);
  return typeof found === "string" && found.length > 0 ? found : cwd;
}

// The path of `target` below `base` ("" when they are the same directory), or null when `target` is neither.
// Both are normalized with forward slashes. A drive-letter base compares without regard to case, as Windows does:
// the cut is made on the original `target` and folded afterwards, as underRoot does in lib/fsa-paths.js, so a
// character whose lower case has a different length (U+0130) cannot shift it.
function belowRoot(target, base) {
  const drive = /^[A-Za-z]:(\/|$)/.test(base);
  const same = (head, expected) => (drive ? head.toLowerCase() === expected.toLowerCase() : head === expected);
  if (target.length === base.length && same(target, base)) return "";
  return same(target.slice(0, base.length + 1), base + "/") ? target.slice(base.length + 1) : null;
}

// [FR-186] task-planner: only docs/task-plans/task-plan-*.md directly under the session root. Returns ALLOW or a deny.
function judgePlanner(file, cwd, options) {
  let relative;
  if (typeof cwd === "string" && absoluteByString(cwd)) {
    // The target counts as absolute by the same string rule; any other target is joined to the cwd.
    const target = paths.normalize(absoluteByString(file) ? file : cwd.replace(/\\/g, "/") + "/" + file.replace(/\\/g, "/"));
    const base = paths.normalize(sessionRoot(cwd, options)).replace(/\/+$/, "");
    relative = belowRoot(target, base);
    if (relative === null) return { deny: true, reason: plannerReason(file, "outside") };
  } else {
    // No usable cwd (tests and malformed input): never wider than a plain relative docs/task-plans/task-plan-*.md.
    const clean = paths.normalize(file);
    if (absoluteByString(clean) || clean.charAt(0) === "~" || /^[A-Za-z]:/.test(clean) || clean === ".." || clean.indexOf("../") === 0) {
      return { deny: true, reason: plannerReason(file, "outside") };
    }
    relative = clean;
  }
  if (relative.length === 0) return { deny: true, reason: plannerReason(file) };
  const why = paths.testerDenial(relative);
  if (why) return { deny: true, reason: plannerReason(relative, why) };
  return paths.isTaskPlanFile(relative) ? ALLOW : { deny: true, reason: plannerReason(relative) };
}

// Decision function. The only I/O is the .git walk of the task-planner branch (lib/git-root.js).
// options: {roots, findGitRoot} for tests.
function evaluate(input, options) {
  if (!input || typeof input !== "object" || !input.tool_input || typeof input.tool_input !== "object") return ALLOW;
  const agentType = typeof input.agent_type === "string" ? input.agent_type : "";
  const plugin = agentType.indexOf(PLUGIN_PREFIX) === 0;
  // agent_id is present only when the hook fires inside a subagent; agent_type alone can also come from a main
  // session started with --agent. assist-plugin:* rules key on agent_type; every other agent needs an agent_id.
  const subagent = typeof input.agent_id === "string" && input.agent_id.length > 0;
  if (!plugin && !subagent) return ALLOW;
  const key = Object.prototype.hasOwnProperty.call(FILE_KEYS, input.tool_name) ? FILE_KEYS[input.tool_name] : null;
  const file = key ? input.tool_input[key] : null;
  if (typeof file !== "string" || file.length === 0) return ALLOW;
  const tester = agentType === TESTER;
  const planner = agentType === PLANNER;
  const chain = CHAIN_AGENTS.indexOf(agentType) !== -1;
  // An unusable path (over 4096 characters or a NUL) is denied for every subagent: the protected-path check below
  // cannot judge it, so it must not be a way around that check.
  if (paths.testerDenial(file) === "limit") {
    if (tester) return { deny: true, reason: testerReason(file, "limit") };
    return { deny: true, reason: planner ? plannerReason(file, "limit") : limitReason(file) };
  }
  const roots = rootsFor(input, options);
  const forms = paths.relativeForms(file, roots);
  if (forms.length === 0) return ALLOW;
  // Every subagent: the plan files and the decision log are the user's to change.
  for (let i = 0; i < forms.length; i++) {
    const rule = paths.protectedRule(forms[i]);
    if (rule) return { deny: true, reason: protectedReason(forms[i], rule) };
  }
  if (!plugin) return ALLOW;
  if (chain) {
    // Judged on the innermost form: a worktree under <root>/.claude/worktrees/ is hidden relative to the outer root.
    const inner = paths.relativeTo(file, roots);
    const why = paths.testerDenial(inner);
    return why ? { deny: true, reason: chainReason(inner, why, agentType) } : ALLOW;
  }
  if (planner) return judgePlanner(file, input.cwd, options);
  if (!tester && agentType !== DEVELOPER) return ALLOW;
  if (!tester) {
    for (let i = 0; i < forms.length; i++) {
      const glob = paths.testGlobFor(forms[i]);
      if (glob) return { deny: true, reason: developerReason(forms[i], glob) };
    }
    return ALLOW;
  }
  // Denials judge the innermost form only: a worktree under <root>/.claude/worktrees/ is hidden relative to
  // the outer root but not relative to its own root.
  const inner = paths.relativeTo(file, roots);
  const why = paths.testerDenial(inner);
  if (why) return { deny: true, reason: testerReason(inner, why) };
  const matched = forms.some((form) => paths.testGlobFor(form) !== null);
  return matched ? ALLOW : { deny: true, reason: testerReason(forms[0]) };
}

function main() {
  require("../lib/health.js").guard(NAME, evaluate);
}

module.exports = { NAME, TESTER, DEVELOPER, PLANNER, evaluate, main };

if (require.main === module) main();
