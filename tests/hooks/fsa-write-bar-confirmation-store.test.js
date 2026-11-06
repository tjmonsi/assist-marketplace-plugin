// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the write bar rules on the confirmation store (harness-governance Tranche 1,
// Step 2): plugins/assist-plugin/hooks/fsa-write-bar.js (command entry) and
// plugins/assist-plugin/hooks/impl/fsa-write-bar.js (`evaluate(input, options)`).
//
// Sources: docs/requirements/FR-NFR-harness-governance.md, section 2.29 (FR-242: Pending record is not a
// confirmation, Forged confirmation rejected; the store is a directory of two files with different write
// rules) and section 2.32 (FR-245: Evidence and toggle stores denied). Rule table:
// plugins/assist-plugin/rules/assist-plugin-rule.md, "Write guard lists" (Protected globs).
// Task plan: docs/task-plans/task-plan-harness-governance-20261028-0759.md, Step 2 and Step 9.
//
// Traceability format: [FR-ids | AC section | Scenario title]. The requirement document uses numbered
// acceptance sections and carries no SPEC-NNN id for this feature, so none is cited.
//
// Contract used:
//   evaluate(input, options) returns an object whose `deny` field is the boolean true to deny; any other
//   result allows. options.roots (array of absolute directories) replaces the cwd and CLAUDE_PROJECT_DIR roots.
//   A call with a non-empty agent_id is a subagent call; a call with no agent_id is the main session.
//   confirmations.jsonl: denied to every caller (the main session included).
//   pending.jsonl:       allowed to the main session, denied to every subagent.
//
// All paths are made-up paths that do not exist, except in the command-entry tests at the end.
//
// Run: node --test tests/hooks/fsa-write-bar-confirmation-store.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const bar = require(path.join(PLUGIN, "hooks", "impl", "fsa-write-bar.js"));

const R = "/assist-selftest/project";
const CONFIRMATIONS = ".agent/governance/confirmations/confirmations.jsonl";
const PENDING = ".agent/governance/confirmations/pending.jsonl";

const SUBAGENTS = [
  "assist-plugin:developer",
  "assist-plugin:developer-tester",
  "assist-plugin:worker",
  "assist-plugin:qa",
  "assist-plugin:task-planner",
  "assist-plugin:requirements-gatherer",
  "general-purpose",
  "other-plugin:custom-agent",
];

const WRITE_TOOLS = ["Write", "Edit", "MultiEdit"];

const scratch = [];

after(() => {
  scratch.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function writeInput(target, caller, tool) {
  const input = {
    hook_event_name: "PreToolUse",
    tool_name: tool || "Write",
    tool_input: { file_path: target, content: "{}\n" },
    cwd: R,
  };
  if (caller && caller.agentId) {
    input.agent_id = caller.agentId;
    input.agent_type = caller.agentType;
  } else if (caller && caller.agentType) {
    input.agent_type = caller.agentType; // a main session started with --agent
  }
  return input;
}

function run(target, caller, tool) {
  return bar.evaluate(writeInput(target, caller, tool), { roots: [R], findGitRoot: () => R });
}

function denied(result) {
  return result !== null && result !== undefined && result.deny === true;
}

function text(result) {
  return result === null || result === undefined ? "" : JSON.stringify(result);
}

const MAIN = null;
const MAIN_WITH_AGENT_TYPE = { agentType: "my-custom-main-agent" };
function sub(agentType) {
  return { agentId: "agent-" + agentType.replace(/[^a-z]/g, "") + "-1", agentType: agentType };
}

// ---------------------------------------------------------------------------
// confirmations.jsonl: denied to every caller
// ---------------------------------------------------------------------------

WRITE_TOOLS.forEach((tool) => {
  test("[FR-242 | FR-245 | 2.29 | Forged confirmation rejected] the main session is denied a " + tool + " of confirmations.jsonl", () => {
    const result = run(R + "/" + CONFIRMATIONS, MAIN, tool);
    assert.ok(denied(result), "expected deny: " + text(result));
    assert.ok(/confirmation/i.test(text(result)), "the reason names the confirmation store: " + text(result));
  });
});

test("[FR-242 | 2.29 | Forged confirmation rejected] a main session started with --agent (agent_type, no agent_id) is denied confirmations.jsonl", () => {
  assert.ok(denied(run(R + "/" + CONFIRMATIONS, MAIN_WITH_AGENT_TYPE)));
});

SUBAGENTS.forEach((agentType) => {
  test("[FR-245 | 2.32 | Evidence and toggle stores denied] subagent " + agentType + " is denied confirmations.jsonl", () => {
    const result = run(R + "/" + CONFIRMATIONS, sub(agentType));
    assert.ok(denied(result), "expected deny: " + text(result));
  });
});

test("[FR-242 | 2.29 | Forged confirmation rejected] a relative path to confirmations.jsonl is denied to the main session and to a subagent", () => {
  assert.ok(denied(run(CONFIRMATIONS, MAIN)));
  assert.ok(denied(run(CONFIRMATIONS, sub("general-purpose"))));
  assert.ok(denied(run("./" + CONFIRMATIONS, MAIN)));
});

test("[FR-242 | 2.29 | Forged confirmation rejected] a path that reaches confirmations.jsonl through .. is denied", () => {
  // Security-adjacent: path traversal to the protected file.
  assert.ok(denied(run(R + "/src/../" + CONFIRMATIONS, MAIN)));
  assert.ok(denied(run(R + "/src/../" + CONFIRMATIONS, sub("general-purpose"))));
});

test("[FR-242 | 2.29 | Forged confirmation rejected] a nested project or a worktree copy of the store is denied too", () => {
  assert.ok(denied(run(R + "/backend/" + CONFIRMATIONS, MAIN)));
  assert.ok(denied(run(R + "/.claude/worktrees/w/" + CONFIRMATIONS, MAIN)));
});

// ---------------------------------------------------------------------------
// pending.jsonl: main session allowed, every subagent denied
// ---------------------------------------------------------------------------

WRITE_TOOLS.forEach((tool) => {
  test("[FR-242 | 2.29 | Pending record is not a confirmation] the main session may " + tool + " pending.jsonl (the /do orchestrator writes it)", () => {
    const result = run(R + "/" + PENDING, MAIN, tool);
    assert.ok(!denied(result), "expected allow: " + text(result));
  });
});

test("[FR-242 | 2.29 | Pending record is not a confirmation] a main session started with --agent may write pending.jsonl", () => {
  assert.ok(!denied(run(R + "/" + PENDING, MAIN_WITH_AGENT_TYPE)));
});

test("[FR-242 | 2.29 | Pending record is not a confirmation] a relative path to pending.jsonl is allowed to the main session", () => {
  assert.ok(!denied(run(PENDING, MAIN)));
});

SUBAGENTS.forEach((agentType) => {
  test("[FR-242 | FR-245 | 2.29 | 2.32 | Pending record is not a confirmation] subagent " + agentType + " is denied pending.jsonl", () => {
    const result = run(R + "/" + PENDING, sub(agentType));
    assert.ok(denied(result), "expected deny: " + text(result));
  });
});

WRITE_TOOLS.forEach((tool) => {
  test("[FR-245 | 2.32 | Evidence and toggle stores denied] a subagent is denied a " + tool + " of pending.jsonl", () => {
    assert.ok(denied(run(R + "/" + PENDING, sub("general-purpose"), tool)));
  });
});

test("[FR-242 | 2.29 | Pending record is not a confirmation] a subagent is denied pending.jsonl through a .. path and a relative path", () => {
  assert.ok(denied(run(R + "/src/../" + PENDING, sub("general-purpose"))));
  assert.ok(denied(run(PENDING, sub("general-purpose"))));
});

// ---------------------------------------------------------------------------
// Boundaries: paths that are not the two store files
// ---------------------------------------------------------------------------

[
  R + "/src/confirmations.jsonl",
  R + "/docs/pending.jsonl",
  R + "/.agent/governance/confirmations.jsonl",
  R + "/.agent/governance/confirmations/notes.txt",
  R + "/.agent/governance/confirmations/confirmations.jsonl.bak",
  R + "/src/app.js",
].forEach((target) => {
  test("[FR-242 | 2.29 | Pending record is not a confirmation] the main session may write the near-miss path " + target.slice(R.length), () => {
    assert.ok(!denied(run(target, MAIN)), "a path outside the two store files is not protected from the main session");
  });
});

test("[FR-245 | 2.32 | Evidence and toggle stores denied] the older rules still hold: subagents are denied .agent/main-plan/** and DECISIONS.md; the main session is not", () => {
  const plan = R + "/.agent/main-plan/plan-x.md";
  const decisions = R + "/DECISIONS.md";
  assert.ok(denied(run(plan, sub("general-purpose"))));
  assert.ok(denied(run(decisions, sub("general-purpose"))));
  assert.ok(!denied(run(plan, MAIN)));
  assert.ok(!denied(run(decisions, MAIN)));
});

test("[FR-242 | 2.29 | Forged confirmation rejected] a read-only tool call is not judged", () => {
  const input = { hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: R + "/" + CONFIRMATIONS }, cwd: R };
  assert.ok(!denied(bar.evaluate(input, { roots: [R], findGitRoot: () => R })));
});

test("[FR-242 | 2.29 | Forged confirmation rejected] malformed input does not throw", () => {
  [{}, { tool_name: "Write" }, { tool_name: "Write", tool_input: {} }, { tool_name: "Write", tool_input: { file_path: 42 } }].forEach((doc) => {
    assert.doesNotThrow(() => bar.evaluate(doc, { roots: [R], findGitRoot: () => R }));
  });
});

// ---------------------------------------------------------------------------
// The command entry (stdin JSON in, deny JSON out, exit 0)
// ---------------------------------------------------------------------------

function realRoot() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "fsa-confirmation-store-")));
  fs.mkdirSync(path.join(dir, ".git"));
  scratch.push(dir);
  return dir;
}

function runEntry(doc, root) {
  const env = Object.assign({}, process.env);
  ["CLAUDE_PLUGIN_ROOT", "CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA"].forEach((k) => delete env[k]);
  env.CLAUDE_PLUGIN_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "fsa-confirmation-store-data-"));
  scratch.push(env.CLAUDE_PLUGIN_DATA);
  return childProcess.spawnSync(process.execPath, [path.join(PLUGIN, "hooks", "fsa-write-bar.js")], {
    cwd: root,
    env: env,
    input: JSON.stringify(doc),
    encoding: "utf8",
    timeout: 30000,
  });
}

function entryDoc(root, target, caller) {
  const doc = writeInput(target, caller);
  doc.cwd = root;
  return doc;
}

test("[FR-242 | 2.29 | Forged confirmation rejected] the command entry denies a main-session write of confirmations.jsonl with the deny JSON and exit 0", () => {
  const root = realRoot();
  const res = runEntry(entryDoc(root, path.join(root, CONFIRMATIONS), MAIN), root);
  assert.strictEqual(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.strictEqual(out.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.strictEqual(out.hookSpecificOutput.permissionDecision, "deny");
});

test("[FR-242 | 2.29 | Pending record is not a confirmation] the command entry lets the main session write pending.jsonl", () => {
  const root = realRoot();
  const res = runEntry(entryDoc(root, path.join(root, PENDING), MAIN), root);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.indexOf("\"deny\"") === -1, res.stdout);
});

test("[FR-245 | 2.32 | Evidence and toggle stores denied] the command entry denies a subagent write of pending.jsonl", () => {
  const root = realRoot();
  const res = runEntry(entryDoc(root, path.join(root, PENDING), sub("general-purpose")), root);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(JSON.parse(res.stdout).hookSpecificOutput.permissionDecision, "deny");
});
