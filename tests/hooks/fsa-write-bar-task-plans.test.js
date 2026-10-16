// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box contract tests for the task-planner write scope of fsa-write-bar,
// release 1.11.1 (plugins/assist-plugin/hooks/impl/fsa-write-bar.js, `evaluate(input, options)`).
//
// Sources: specs/spec-hooks-fsa-write-bar.md (Requirement: Task-planner write scope in
// docs/task-plans/; Requirement: Deny reasons; Requirement: Protected paths for every subagent;
// Requirement: Calls the bar judges; Requirement: Path limits) and
// docs/requirements/FR-NFR-assist-plugin.md (FR-186, FR-110, FR-074).
//
// Traceability format: [Scenario title | spec section | FR ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited. "Table case N" is the row
// number of the self-test table in the Task-planner write scope requirement.
//
// Contract used:
//   - evaluate(input, options) returns an object whose `deny` field is the boolean true to
//     deny; any other result allows (specs/spec-hooks-platform.md, Guard decision and deny output).
//   - options.findGitRoot is a function from an absolute directory to the directory that holds
//     `.git`, or null. It replaces the file system walk. With no such option the hook walks the
//     real file system (the temp-tree tests at the end).
//   - The session root R is the git root of the input `cwd` (or the `cwd` when there is none).
//     CLAUDE_PROJECT_DIR plays no part. Without a usable `cwd` (missing, empty, or not absolute by
//     the string rule: starts with "/" or with a drive letter, ":" and a slash) there is no R.
//   - Deny reasons are matched loosely: C-plan-outside holds "path is outside"; C-plan-scope does
//     not and names task-plan-*.md. The exact wording is proposed text in the spec.
//
// All paths are made-up paths that do not exist, except in the temp-tree tests at the end.
//
// Run: node --test tests/hooks/fsa-write-bar-task-plans.test.js

"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const bar = require(path.join(REPO, "plugins", "assist-plugin", "hooks", "impl", "fsa-write-bar.js"));

const PLANNER = "assist-plugin:task-planner";
const R = "/assist-selftest/project"; // FSA_ROOT of the spec's self-test table
const WT = R + "/.claude/worktrees/w";
const PLAN = "docs/task-plans/task-plan-x.md";

// ---------------------------------------------------------------------------
// Environment isolation and the temp tree for the real-walk tests
// ---------------------------------------------------------------------------

const savedEnv = {};
let TMP;
let REPO_DIR; // holds a .git directory
let REPO_SRC; // no .git
let WORKTREE; // holds a .git file
let SUBMODULE; // holds a .git file inside REPO_DIR
let SUBMODULE_LIB;
let SCRATCH; // no .git here or (checked) above
let SCRATCH_OK = false;

function hasGitAbove(dir) {
  let d = dir;
  for (;;) {
    if (fs.existsSync(path.join(d, ".git"))) return true;
    const up = path.dirname(d);
    if (up === d) return false;
    d = up;
  }
}

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

before(() => {
  ["CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA"].forEach((k) => {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  });
  TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wb-task-plans-")));
  REPO_DIR = path.join(TMP, "repo");
  mkdirp(path.join(REPO_DIR, ".git"));
  fs.writeFileSync(path.join(REPO_DIR, ".git", "HEAD"), "ref: refs/heads/main\n");
  REPO_SRC = path.join(REPO_DIR, "src");
  mkdirp(REPO_SRC);
  mkdirp(path.join(REPO_DIR, "docs", "task-plans"));
  WORKTREE = path.join(REPO_DIR, ".claude", "worktrees", "feature-a");
  mkdirp(WORKTREE);
  fs.writeFileSync(path.join(WORKTREE, ".git"), "gitdir: " + path.join(REPO_DIR, ".git", "worktrees", "feature-a") + "\n");
  SUBMODULE = path.join(REPO_DIR, "backend");
  SUBMODULE_LIB = path.join(SUBMODULE, "lib");
  mkdirp(SUBMODULE_LIB);
  fs.writeFileSync(path.join(SUBMODULE, ".git"), "gitdir: ../.git/modules/backend\n");
  SCRATCH = path.join(TMP, "scratch", "work");
  mkdirp(SCRATCH);
  SCRATCH_OK = !hasGitAbove(SCRATCH);
});

after(() => {
  Object.keys(savedEnv).forEach((k) => {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  });
  if (TMP) fs.rmSync(TMP, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Builders and verdict helpers
// ---------------------------------------------------------------------------

function planInput(target, cwd, extra) {
  const input = {
    hook_event_name: "PreToolUse",
    tool_name: "Write",
    agent_type: PLANNER,
    agent_id: "agent-task-planner-1",
    tool_input: { file_path: target, content: "# plan\n" },
  };
  if (cwd !== undefined) input.cwd = cwd;
  return Object.assign(input, extra || {});
}

// A findGitRoot stub that records its calls. `root` is a value or a function of the directory.
function stub(root) {
  const f = function (dir) {
    f.calls.push(dir);
    return typeof root === "function" ? root(dir) : root;
  };
  f.calls = [];
  return f;
}

function run(target, cwd, root, extra) {
  const s = stub(root);
  const result = bar.evaluate(planInput(target, cwd, extra), { findGitRoot: s });
  return { result: result, stub: s, target: target, cwd: cwd };
}

function denied(result) {
  return result !== null && result !== undefined && result.deny === true;
}

function text(result) {
  return result === null || result === undefined ? "" : JSON.stringify(result);
}

const OUTSIDE = /path is outside/i;

function describe(o) {
  return o.target + " (cwd " + o.cwd + ")";
}

function expectAllow(o) {
  assert.ok(!denied(o.result), "expected allow, got deny for " + describe(o) + ": " + text(o.result));
}

function expectDeny(o) {
  assert.ok(denied(o.result), "expected deny, got allow for " + describe(o));
}

function expectDenyScope(o) {
  expectDeny(o);
  const t = text(o.result);
  assert.ok(!OUTSIDE.test(t), "C-plan-scope expected, got an outside reason for " + describe(o) + ": " + t);
  assert.ok(/task-plan-\*\.md/.test(t), "C-plan-scope reason should name task-plan-*.md for " + describe(o) + ": " + t);
}

function expectDenyOutside(o) {
  expectDeny(o);
  const t = text(o.result);
  assert.ok(OUTSIDE.test(t), "C-plan-outside expected for " + describe(o) + ": " + t);
}

function expectDenyHidden(o) {
  expectDeny(o);
  const t = text(o.result);
  assert.ok(/hidden|starts with a dot/i.test(t), "C-hidden expected for " + describe(o) + ": " + t);
}

// ---------------------------------------------------------------------------
// The self-test table (cases 1 to 21), run against the hook with a stub
// ---------------------------------------------------------------------------

// [n, expect, cwd, findGitRoot returns, target, reason kind]
const TABLE = [
  [1, "allow", R, R, R + "/docs/task-plans/task-plan-auth-20261016-1000.md", ""],
  [2, "allow", R, R, "docs/task-plans/task-plan-x.md", ""],
  [3, "allow", R + "/src", R, R + "/docs/task-plans/task-plan-x.md", ""],
  [4, "deny", R + "/src", R, R + "/src/docs/task-plans/task-plan-x.md", "scope"],
  [5, "deny", R + "/src", R, "docs/task-plans/task-plan-x.md", "scope"],
  [6, "allow", WT, WT, WT + "/docs/task-plans/task-plan-x.md", ""],
  [7, "deny", WT, WT, R + "/docs/task-plans/task-plan-x.md", "outside"],
  [8, "allow", "/assist-selftest/nogit", null, "/assist-selftest/nogit/docs/task-plans/task-plan-x.md", ""],
  [9, "deny", R, R, R + "/task-plan-x.md", "scope"],
  [10, "deny", R, R, R + "/docs/task-plans/sub/task-plan-x.md", "scope"],
  [11, "deny", R, R, R + "/docs/task-plans/plan-x.md", "scope"],
  [12, "deny", R, R, "/elsewhere/docs/task-plans/task-plan-x.md", "outside"],
  [13, "deny", R, R, R + "/.claude/docs/task-plans/task-plan-x.md", "hidden"],
  [14, "allow", "C:\\proj", "C:\\proj", "c:\\proj\\docs\\task-plans\\task-plan-x.md", ""],
  [15, "allow", "C:\\proj", "C:\\proj", "docs\\task-plans\\task-plan-x.md", ""],
  [16, "allow", undefined, "unused", "docs/task-plans/task-plan-x.md", ""],
  [17, "deny", undefined, "unused", "/elsewhere/docs/task-plans/task-plan-x.md", "outside"],
  [18, "deny", undefined, "unused", "../outside/docs/task-plans/task-plan-x.md", "outside"],
  [19, "deny", undefined, "unused", "~/docs/task-plans/task-plan-x.md", "outside"],
  [20, "deny", undefined, "unused", "C:docs/task-plans/task-plan-a.md", "outside"],
  [21, "deny", undefined, "unused", "x/docs/task-plans/task-plan-x.md", "scope"],
];

TABLE.forEach((row) => {
  const n = row[0], expect = row[1], cwd = row[2], root = row[3], target = row[4], kind = row[5];
  test("spec table case " + n + ": " + expect + " " + target + (cwd === undefined ? " (no cwd)" : " (cwd " + cwd + ")"), () => {
    // [Scenario: New location, Subdirectory session, Worktree session, Outside a git repository,
    //  Root-level task plan, Nested folder, Other names in the folder, Outside the session root,
    //  Hidden folder, No usable cwd, Drive-letter paths on a non-Windows host
    //  | spec-hooks-fsa-write-bar.md "Task-planner write scope in docs/task-plans/" self-test table | FR-186 | FR-110]
    const o = run(target, cwd, root === "unused" ? null : root);
    if (expect === "allow") expectAllow(o);
    else if (kind === "scope") expectDenyScope(o);
    else if (kind === "outside") expectDenyOutside(o);
    else if (kind === "hidden") expectDenyHidden(o);
    else expectDeny(o);
    if (cwd === undefined) {
      assert.strictEqual(o.stub.calls.length, 0, "findGitRoot must not be called without a usable cwd (case " + n + ")");
    } else {
      assert.ok(o.stub.calls.length >= 1, "findGitRoot must be called for a usable cwd (case " + n + ")");
    }
  });
});

// ---------------------------------------------------------------------------
// Scenarios with a stub
// ---------------------------------------------------------------------------

test("new location: a plan directly under docs/task-plans of the git root is allowed", () => {
  // [Scenario: New location | spec-hooks-fsa-write-bar.md "Task-planner write scope in docs/task-plans/" | FR-186 | FR-110]
  expectAllow(run(R + "/docs/task-plans/task-plan-auth-20261016-1000.md", R, R));
});

test("root-level task plan is denied with the scope reason, whatever DECISIONS.md says", () => {
  // [Scenario: Root-level task plan | same requirement | FR-186]
  expectDenyScope(run(R + "/task-plan-auth-20261016-1000.md", R, R));
});

test("rework of a legacy root-level plan: first write in docs/task-plans is allowed, root-level overwrite is denied", () => {
  // [Scenario: Rework of a legacy root-level plan | same requirement | FR-186 | FR-074]
  expectAllow(run(R + "/docs/task-plans/task-plan-shop-20261016-1000.md", R, R));
  expectDenyScope(run(R + "/task-plan-shop-20261001-0900.md", R, R));
});

test("nested folder under docs/task-plans is denied (four segments relative to the root)", () => {
  // [Scenario: Nested folder | same requirement | FR-186]
  expectDenyScope(run(R + "/docs/task-plans/sub/task-plan-x.md", R, R));
  // Boundary: a folder that merely looks like a plan name.
  expectDenyScope(run(R + "/docs/task-plans/task-plan-a/b.md", R, R));
});

test("other names in the folder are denied: wrong prefix, wrong suffix, no dash, wrong case", () => {
  // [Scenario: Other names in the folder | same requirement | FR-186]
  expectDenyScope(run(R + "/docs/task-plans/plan-x.md", R, R));
  expectDenyScope(run(R + "/docs/task-plans/task-plan-x.txt", R, R));
  expectDenyScope(run(R + "/docs/task-plans/task-plan.md", R, R));
  expectDenyScope(run(R + "/Docs/task-plans/task-plan-x.md", R, R));
  // Boundary: the match is case-sensitive.
  expectDenyScope(run(R + "/docs/task-plans/Task-Plan-x.md", R, R));
  expectDenyScope(run(R + "/docs/task-plans/task-plan-x.MD", R, R));
  expectDenyScope(run(R + "/docs/Task-Plans/task-plan-x.md", R, R));
});

test("subdirectory session: the git root path is allowed, the path under the session directory is denied", () => {
  // [Scenario: Subdirectory session | same requirement | FR-186]
  expectAllow(run(R + "/docs/task-plans/task-plan-auth-20261016-1000.md", R + "/src", R));
  expectDenyScope(run(R + "/src/docs/task-plans/task-plan-auth-20261016-1000.md", R + "/src", R));
});

test("relative target in a subdirectory session resolves under the session directory and is denied", () => {
  // [Scenario: Relative target in a subdirectory session | same requirement | FR-186]
  expectDenyScope(run("docs/task-plans/task-plan-x.md", R + "/src", R));
});

test("relative target that climbs back to the git root is allowed after dot-segment normalization", () => {
  // Boundary: the target is joined to the cwd, then normalized. [Scenario: Relative target ... | same requirement | FR-186]
  expectAllow(run("../docs/task-plans/task-plan-x.md", R + "/src", R));
  // Climbing above the root is outside.
  expectDenyOutside(run("../../other-x/docs/task-plans/task-plan-x.md", R + "/src", R));
});

test("worktree session: the worktree's own root is allowed, the main checkout is outside", () => {
  // [Scenario: Worktree session | same requirement | FR-186]
  expectAllow(run(WT + "/docs/task-plans/task-plan-auth.md", WT, WT));
  expectDenyOutside(run(R + "/docs/task-plans/task-plan-auth.md", WT, WT));
});

test("outside a git repository the cwd is the session root", () => {
  // [Scenario: Outside a git repository | same requirement | FR-186]
  expectAllow(run("/work/scratch/docs/task-plans/task-plan-x.md", "/work/scratch", null));
  expectDenyScope(run("/work/scratch/task-plan-x.md", "/work/scratch", null));
  expectDenyOutside(run("/work/other-x/docs/task-plans/task-plan-x.md", "/work/scratch", null));
});

test("CLAUDE_PROJECT_DIR is ignored: the session root comes from the cwd alone", () => {
  // [Scenario: Project directory variable ignored | same requirement | FR-186]
  process.env.CLAUDE_PROJECT_DIR = "/other/project";
  try {
    expectAllow(run(R + "/docs/task-plans/task-plan-x.md", R + "/src", R));
    // The variable does not widen the scope either.
    expectDenyOutside(run("/other/project/docs/task-plans/task-plan-x.md", R + "/src", R));
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
  }
});

test("CLAUDE_PROJECT_DIR does not stand in for a missing cwd", () => {
  // [Scenario: No usable cwd, target outside | same requirement | FR-186]
  process.env.CLAUDE_PROJECT_DIR = "/other/project";
  try {
    expectDenyOutside(run("/other/project/docs/task-plans/task-plan-x.md", undefined, null));
    expectAllow(run("docs/task-plans/task-plan-x.md", undefined, null));
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
  }
});

test("outside the session root: an absolute path elsewhere is denied with the outside reason", () => {
  // [Scenario: Outside the session root | same requirement | FR-186]
  expectDenyOutside(run("/elsewhere/docs/task-plans/task-plan-x.md", R, R));
});

test("a sibling directory that shares the root name prefix is outside (separator boundary)", () => {
  // Boundary: /assist-selftest/project-evil is not below /assist-selftest/project.
  expectDenyOutside(run(R + "-evil/docs/task-plans/task-plan-x.md", R, R));
});

test("dot segments that leave the root are outside; those that stay inside are judged by the remaining form", () => {
  // Injection-shaped: path traversal. [Scenario: Outside the session root | same requirement | FR-186]
  expectDenyOutside(run(R + "/../other-x/docs/task-plans/task-plan-x.md", R, R));
  expectDenyScope(run(R + "/docs/task-plans/../task-plan-x.md", R, R)); // normalizes to docs/task-plan-x.md
  expectAllow(run(R + "/docs/../docs/task-plans/task-plan-x.md", R, R));
  expectAllow(run(R + "/docs/task-plans/./task-plan-x.md", R, R));
});

test("hidden folder is denied as a hidden path, also for a hidden file name", () => {
  // [Scenario: Hidden folder | same requirement | FR-186]
  expectDenyHidden(run(R + "/.claude/docs/task-plans/task-plan-x.md", R, R));
  expectDenyHidden(run(R + "/docs/.task-plans/task-plan-x.md", R, R));
});

test("auto-loaded names are denied under the task-plan folder and at the root", () => {
  // Existing deny cases keep their result once they carry a cwd and the stub.
  // [Requirement: Task-planner write scope (auto-loaded names) | spec-hooks-fsa-write-bar.md | FR-186 | FR-110]
  ["CLAUDE.md", "CLAUDE.local.md", "AGENTS.md", "claude.md", "Agents.MD"].forEach((name) => {
    expectDeny(run(R + "/docs/task-plans/" + name, R, R));
    expectDeny(run(R + "/" + name, R, R));
  });
});

test("protected paths stay denied for the task-planner: DECISIONS.md and the /do plan files", () => {
  // [Requirement: Protected paths for every subagent | spec-hooks-fsa-write-bar.md | FR-112 | FR-186]
  expectDeny(run(R + "/DECISIONS.md", R, R));
  expectDeny(run(R + "/docs/task-plans/DECISIONS.md", R, R));
  expectDeny(run(R + "/.agent/main-plan/plan-x.md", R, R));
  expectDeny(run(R + "/docs/task-plans/decisions.md.", R, R)); // trailing dot folds away
});

test("path limits stay denied: NUL character and a path over 4096 characters", () => {
  // Null/empty and boundary input. [Requirement: Path limits | spec-hooks-fsa-write-bar.md | FR-113 | FR-186]
  expectDeny(run(R + "/docs/task-plans/task-plan-x\u0000.md", R, R));
  expectDeny(run(R + "/docs/task-plans/task-plan-" + new Array(4100).join("a") + ".md", R, R));
});

test("an empty file path is not judged and is allowed with no output", () => {
  // Null/empty. [Requirement: Calls the bar judges, precondition: the path is a non-empty string | FR-113]
  const o = run("", R, R);
  expectAllow(o);
});

test("Edit and NotebookEdit calls are judged by the same scope", () => {
  // [Requirement: Task-planner write scope (tool_name) | spec-hooks-fsa-write-bar.md "Required data" | FR-186]
  const edit = bar.evaluate(planInput(R + "/task-plan-x.md", R, { tool_name: "Edit" }), { findGitRoot: stub(R) });
  assert.ok(denied(edit), "Edit of a root-level plan should be denied");
  const nb = bar.evaluate(
    { hook_event_name: "PreToolUse", tool_name: "NotebookEdit", agent_type: PLANNER, agent_id: "a1", cwd: R, tool_input: { notebook_path: R + "/task-plan-x.md" } },
    { findGitRoot: stub(R) }
  );
  assert.ok(denied(nb), "NotebookEdit of a root-level plan should be denied");
  const nbOk = bar.evaluate(
    { hook_event_name: "PreToolUse", tool_name: "NotebookEdit", agent_type: PLANNER, agent_id: "a1", cwd: R, tool_input: { notebook_path: R + "/docs/task-plans/task-plan-x.md" } },
    { findGitRoot: stub(R) }
  );
  assert.ok(!denied(nbOk), "NotebookEdit inside the scope should be allowed");
});

test("a Read of a root-level plan is never judged", () => {
  // [Requirement: Task-planner write scope: "A Read of a root-level plan is not a write and is never judged" | FR-186]
  const r = bar.evaluate(
    { hook_event_name: "PreToolUse", tool_name: "Read", agent_type: PLANNER, agent_id: "a1", cwd: R, tool_input: { file_path: R + "/task-plan-x.md" } },
    { findGitRoot: stub(R) }
  );
  assert.ok(!denied(r));
});

test("calls the bar does not judge pass: the main session with no agent type and no agent id", () => {
  // [Requirement: Calls the bar judges | spec-hooks-fsa-write-bar.md | FR-113]
  const input = { hook_event_name: "PreToolUse", tool_name: "Write", cwd: R, tool_input: { file_path: R + "/task-plan-x.md", content: "x" } };
  assert.ok(!denied(bar.evaluate(input, { findGitRoot: stub(R) })));
});

test("other agents keep their own rules: developer and requirements-gatherer may write a root-level plan name or a requirements document", () => {
  // Regression: FR-186 narrows the task-planner only. [Requirement: Developer stays out of test paths; Chain agents | FR-109 | FR-111]
  const dev = bar.evaluate(planInput(R + "/task-plan-x.md", R, { agent_type: "assist-plugin:developer" }), { findGitRoot: stub(R) });
  assert.ok(!denied(dev), "developer is not limited by the task-planner scope");
  const rg = bar.evaluate(planInput(R + "/docs/requirements/BRD-x.md", R, { agent_type: "assist-plugin:requirements-gatherer" }), { findGitRoot: stub(R) });
  assert.ok(!denied(rg), "requirements-gatherer may write docs/requirements/");
});

// ---------------------------------------------------------------------------
// No usable cwd (missing, empty, relative)
// ---------------------------------------------------------------------------

const UNUSABLE_CWDS = [undefined, "", "proj/src", "./proj", "~/proj", "C:proj"];

UNUSABLE_CWDS.forEach((cwd) => {
  const label = cwd === undefined ? "missing" : JSON.stringify(cwd);
  test("no usable cwd (" + label + "): plain relative target is allowed, the stub is never called", () => {
    // [Scenario: No usable cwd, plain relative target | same requirement | FR-186]
    const o = run("docs/task-plans/task-plan-x.md", cwd, R);
    expectAllow(o);
    assert.strictEqual(o.stub.calls.length, 0);
  });

  test("no usable cwd (" + label + "): absolute, home, drive-relative, and climbing targets are denied as outside", () => {
    // [Scenario: No usable cwd, target outside | same requirement | FR-186]
    [
      "/tmp/docs/task-plans/task-plan-a.md",
      "~/docs/task-plans/task-plan-a.md",
      "C:docs/task-plans/task-plan-a.md",
      "../docs/task-plans/task-plan-a.md",
      "..",
      "C:/proj/docs/task-plans/task-plan-a.md",
      "C:\\proj\\docs\\task-plans\\task-plan-a.md",
    ].forEach((target) => {
      const o = run(target, cwd, R);
      expectDenyOutside(o);
      assert.strictEqual(o.stub.calls.length, 0);
    });
  });

  test("no usable cwd (" + label + "): any other relative form is denied with the scope reason", () => {
    // Exact three-segment form only, no "**/" prefix. [Scenario: No usable cwd, plain relative target | same requirement | FR-186]
    [
      "task-plan-x.md",
      "x/docs/task-plans/task-plan-x.md",
      "docs/task-plans/sub/task-plan-x.md",
      "docs/task-plans/plan-x.md",
      "Docs/task-plans/task-plan-x.md",
    ].forEach((target) => {
      const o = run(target, cwd, R);
      expectDenyScope(o);
      assert.strictEqual(o.stub.calls.length, 0);
    });
  });

  test("no usable cwd (" + label + "): hidden and auto-loaded plain relative targets are denied", () => {
    // [Requirement: Task-planner write scope, step 4 | FR-186]
    expectDeny(run(".claude/docs/task-plans/task-plan-x.md", cwd, R));
    expectDeny(run("docs/task-plans/CLAUDE.md", cwd, R));
    expectDeny(run("DECISIONS.md", cwd, R));
  });
});

test("usable cwd: the stub receives the session cwd", () => {
  // [Requirement: Task-planner write scope, step 1 | FR-186]
  const o = run(R + "/docs/task-plans/task-plan-x.md", R + "/src", R);
  assert.strictEqual(o.stub.calls[0], R + "/src");
});

// ---------------------------------------------------------------------------
// Drive-letter paths on any host
// ---------------------------------------------------------------------------

test("drive-letter paths: absolute by the string rule, root compared without case", () => {
  // [Scenario: Drive-letter paths on a non-Windows host | same requirement | FR-186]
  expectAllow(run("c:\\proj\\docs\\task-plans\\task-plan-x.md", "C:\\proj", "C:\\proj"));
  expectAllow(run("C:\\PROJ\\docs\\task-plans\\task-plan-x.md", "C:\\proj", "C:\\proj"));
  expectAllow(run("C:/proj/docs/task-plans/task-plan-x.md", "C:/proj", "C:/proj"));
  // The finder may report the root in another case than the cwd.
  expectAllow(run("C:\\proj\\docs\\task-plans\\task-plan-x.md", "C:\\proj\\src", "c:\\proj"));
});

test("drive-letter paths: other drive, sibling prefix, root-level, nested, and src-level plans are denied", () => {
  // [Scenario: Drive-letter paths on a non-Windows host | same requirement | FR-186]
  expectDenyOutside(run("D:\\other\\docs\\task-plans\\task-plan-x.md", "C:\\proj", "C:\\proj"));
  expectDenyOutside(run("C:\\proj-evil\\docs\\task-plans\\task-plan-x.md", "C:\\proj", "C:\\proj"));
  expectDenyScope(run("C:\\proj\\task-plan-x.md", "C:\\proj", "C:\\proj"));
  expectDenyScope(run("C:\\proj\\docs\\task-plans\\sub\\task-plan-x.md", "C:\\proj", "C:\\proj"));
  expectDenyScope(run("C:\\proj\\src\\docs\\task-plans\\task-plan-x.md", "C:\\proj\\src", "C:\\proj"));
});

test("drive-letter cwd with a relative target is joined to the cwd and judged against the root", () => {
  // [Scenario: Drive-letter paths on a non-Windows host (relative target, table case 15) | FR-186]
  expectAllow(run("docs/task-plans/task-plan-x.md", "C:\\proj", "C:\\proj"));
  expectDenyScope(run("docs/task-plans/task-plan-x.md", "C:\\proj\\src", "C:\\proj"));
});

// ---------------------------------------------------------------------------
// The real walk over a temp tree (no findGitRoot option)
// ---------------------------------------------------------------------------

function walk(target, cwd, extra) {
  return { result: bar.evaluate(planInput(target, cwd, extra), {}), target: target, cwd: cwd };
}

test("real walk, new location: cwd is a repository root with a .git directory", () => {
  // [Scenario: New location | same requirement | FR-186]
  expectAllow(walk(path.join(REPO_DIR, "docs", "task-plans", "task-plan-auth-20261016-1000.md"), REPO_DIR));
  expectDenyScope(walk(path.join(REPO_DIR, "task-plan-auth-20261016-1000.md"), REPO_DIR));
});

test("real walk, subdirectory session: the root above the cwd is the session root", () => {
  // [Scenario: Subdirectory session; Relative target in a subdirectory session | same requirement | FR-186]
  expectAllow(walk(path.join(REPO_DIR, "docs", "task-plans", "task-plan-auth.md"), REPO_SRC));
  expectDenyScope(walk(path.join(REPO_SRC, "docs", "task-plans", "task-plan-auth.md"), REPO_SRC));
  expectDenyScope(walk("docs/task-plans/task-plan-x.md", REPO_SRC));
});

test("real walk, worktree session: a .git file makes the worktree its own root", () => {
  // [Scenario: Worktree session | same requirement | FR-186]
  expectAllow(walk(path.join(WORKTREE, "docs", "task-plans", "task-plan-auth.md"), WORKTREE));
  expectDenyOutside(walk(path.join(REPO_DIR, "docs", "task-plans", "task-plan-auth.md"), WORKTREE));
});

test("real walk, submodule: the nearest .git file wins over the outer repository", () => {
  // Boundary: nested roots. [Requirement: Task-planner write scope, step 1 ("a directory, or a file") | FR-186]
  expectAllow(walk(path.join(SUBMODULE, "docs", "task-plans", "task-plan-x.md"), SUBMODULE_LIB));
  expectDenyOutside(walk(path.join(REPO_DIR, "docs", "task-plans", "task-plan-x.md"), SUBMODULE_LIB));
});

test("real walk, project directory variable ignored", () => {
  // [Scenario: Project directory variable ignored | same requirement | FR-186]
  process.env.CLAUDE_PROJECT_DIR = "/other/project";
  try {
    expectAllow(walk(path.join(REPO_DIR, "docs", "task-plans", "task-plan-x.md"), REPO_SRC));
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
  }
});

test("real walk, outside a git repository: the cwd is the root", { skip: false }, (t) => {
  // [Scenario: Outside a git repository | same requirement | FR-186]
  if (!SCRATCH_OK) {
    t.skip("a parent of the temp directory holds .git");
    return;
  }
  expectAllow(walk(path.join(SCRATCH, "docs", "task-plans", "task-plan-x.md"), SCRATCH));
  expectDenyScope(walk(path.join(SCRATCH, "task-plan-x.md"), SCRATCH));
});

test("real walk, unreadable parent: a permission error on the cwd does not stop the walk or fail the hook", (t) => {
  // [Scenario: Unreadable parent during the walk | same requirement | FR-186]
  if (process.platform === "win32" || (typeof process.getuid === "function" && process.getuid() === 0)) {
    t.skip("directory permissions are not enforced here (Windows or root)");
    return;
  }
  const locked = path.join(REPO_DIR, "locked");
  mkdirp(locked);
  fs.chmodSync(locked, 0o000);
  try {
    expectAllow(walk(path.join(REPO_DIR, "docs", "task-plans", "task-plan-x.md"), locked));
    // The walk continued to the repository, so the path under the locked directory is not the root.
    expectDenyScope(walk(path.join(locked, "docs", "task-plans", "task-plan-x.md"), locked));
  } finally {
    fs.chmodSync(locked, 0o755);
  }
});

test("real walk, a nonexistent cwd does not throw and falls back to a deterministic verdict", () => {
  // Null/missing input. The walk never throws. [Requirement: Task-planner write scope, step 1 | FR-186 | FR-181]
  const cwd = path.join(TMP, "does", "not", "exist");
  assert.doesNotThrow(() => walk(path.join(cwd, "docs", "task-plans", "task-plan-x.md"), cwd));
});
