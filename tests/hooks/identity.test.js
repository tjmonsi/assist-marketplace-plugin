// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the per-agent identity helper (harness-governance Tranche 3, Step 30):
// plugins/assist-plugin/hooks/lib/identity.js, and the records the hooks write with it.
//
// Sources: docs/requirements/FR-NFR-harness-governance.md section 2.13 (FR-226: Subagent event, Main-session event),
// section 2.19 (FR-232 Scenario: Unidentified actor), NFR-026, NFR-031; specs/spec-hooks-audit.md, Change Log
// 2026-11-06 (Tranche 3), "Requirement: Per-agent identity helper" (Scenarios: Subagent event, Main-session event,
// Unidentified actor); specs/spec-hooks-compliance.md, "Requirement: HIPAA agent-level audit log" (Unidentified actor).
// Task plan: docs/task-plans/task-plan-harness-governance-20261028-0759.md, Steps 21 and 30.
//
// Traceability format: [AC-N | spec-hooks-audit | FR-226 | UR-066 | BR-020]. The spec carries no SPEC-NNN id, so it is
// cited by file name. AC-N is the position of the Scenario inside the Requirement:
//   AC-1 Subagent event, AC-2 Main-session event, AC-3 Unidentified actor.
// A test with no Scenario cites the Requirement text instead of an AC number.
//
// Public interface used (module exports and the header contract of lib/identity.js):
//   resolve(input, options)   -> {agent_type, agent_id, plugin_version, ...}; never throws, never blank
//   fields(input, options)    -> {agent_type, agent_id?}; the identity slot of an audit record
//   pluginVersion(options)    -> the manifest version; options.manifestPath reads another manifest and skips the cache
//   MAIN_SESSION, UNIDENTIFIED, UNKNOWN_VERSION  string constants
// The hook input fields are `agent_id` (present only inside a subagent) and `agent_type`.
//
// Every project root is a temp directory with a .git directory; every data directory is a temp directory.
//
// Run: node --test tests/hooks/identity.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const PLUGIN = fx.PLUGIN;
const identity = require(path.join(PLUGIN, "hooks", "lib", "identity.js"));
const MANIFEST_VERSION = JSON.parse(fs.readFileSync(path.join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")).version;
const VERIFIER = path.join(PLUGIN, "scripts", "verify-audit-chain.js");

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertNeverBlank(who) {
  assert.strictEqual(typeof who.agent_type, "string", "agent_type is a string");
  assert.ok(who.agent_type.trim().length > 0, "agent_type is not blank");
  assert.strictEqual(typeof who.plugin_version, "string", "plugin_version is a string");
  assert.ok(who.plugin_version.trim().length > 0, "plugin_version is not blank");
}

function postToolUse(root, extra) {
  return Object.assign(
    {
      hook_event_name: "PostToolUse",
      session_id: "sess-id-1",
      tool_name: "Write",
      tool_input: { file_path: path.join(root, "src", "app.js"), content: "const x = 1;\n" },
      tool_response: { success: true },
      cwd: root,
    },
    extra || {}
  );
}

function preToolUse(root, tool, toolInput, extra) {
  return Object.assign({ hook_event_name: "PreToolUse", session_id: "sess-id-1", tool_name: tool, tool_input: toolInput, cwd: root }, extra || {});
}

function writeManifest(version) {
  const file = path.join(fx.tempDir("identity-manifest-"), "plugin.json");
  fs.writeFileSync(file, typeof version === "string" && version.charAt(0) === "{" ? version : JSON.stringify({ name: "fixture", version: version }));
  return file;
}

// ---------------------------------------------------------------------------
// AC-1: Subagent event (FR-226)
// ---------------------------------------------------------------------------

[
  ["developer", "agent-dev-1"],
  ["assist-plugin:developer-tester", "a1b2c3d4"],
  ["reviewer", "agent_rev_9"],
  ["qa", "Z"],
].forEach((row) => {
  test("[AC-1 | spec-hooks-audit | FR-226 | UR-066 | BR-020] a subagent input (" + row[0] + ") resolves to its agent type, its agent id, and the manifest plugin version", () => {
    const who = identity.resolve({ agent_type: row[0], agent_id: row[1] });
    assert.strictEqual(who.agent_type, row[0]);
    assert.strictEqual(who.agent_id, row[1]);
    assert.strictEqual(who.plugin_version, MANIFEST_VERSION);
    assertNeverBlank(who);
  });
});

test("[AC-1 | spec-hooks-audit | FR-226 | UR-066] fields() of a subagent holds the agent type and the agent id", () => {
  const slot = identity.fields({ agent_type: "developer", agent_id: "agent-dev-1" });
  assert.strictEqual(slot.agent_type, "developer");
  assert.strictEqual(slot.agent_id, "agent-dev-1");
});

test("[AC-1 | spec-hooks-audit | FR-226 | UR-066] a subagent with an id and no readable type is never recorded as the main session", () => {
  // Boundary: agent_id present, agent_type absent. The id proves a subagent acted, so the identity cannot read main-session.
  const who = identity.resolve({ agent_id: "agent-x-1" });
  assert.notStrictEqual(who.agent_type, identity.MAIN_SESSION);
  assertNeverBlank(who);
  assert.strictEqual(who.agent_id, "agent-x-1");
});

// ---------------------------------------------------------------------------
// AC-2: Main-session event (FR-226)
// ---------------------------------------------------------------------------

[
  ["an empty object", {}],
  ["a tool event with no agent fields", { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" } }],
  ["agent_id null", { agent_id: null }],
  ["agent_id the empty string", { agent_id: "" }],
  ["agent_id and agent_type both empty", { agent_id: "", agent_type: "" }],
  ["agent_type alone (a main session started with --agent)", { agent_type: "developer" }],
].forEach((row) => {
  test("[AC-2 | spec-hooks-audit | FR-226 | UR-066 | BR-020] " + row[0] + " resolves to main-session, not blank, with the plugin version", () => {
    const who = identity.resolve(row[1]);
    assert.strictEqual(who.agent_type, "main-session");
    assert.strictEqual(identity.MAIN_SESSION, "main-session");
    assert.ok(who.agent_id === undefined || who.agent_id === null, "a main session has no agent id");
    assert.strictEqual(who.plugin_version, MANIFEST_VERSION);
    assertNeverBlank(who);
  });
});

test("[AC-2 | spec-hooks-audit | FR-226 | UR-066] fields() of a main-session event reads main-session and holds no agent id", () => {
  const slot = identity.fields({});
  assert.strictEqual(slot.agent_type, "main-session");
  assert.ok(slot.agent_id === undefined || slot.agent_id === null);
});

// ---------------------------------------------------------------------------
// AC-3: Unidentified actor (FR-226, FR-232)
// ---------------------------------------------------------------------------

[
  ["null", null],
  ["undefined", undefined],
  ["a string", "PreToolUse"],
  ["a number", 42],
  ["a boolean", true],
  ["an array", [{ agent_id: "agent-1" }]],
  ["agent_id an object", { agent_id: { id: "agent-1" }, agent_type: "developer" }],
  ["agent_id a number", { agent_id: 7, agent_type: "developer" }],
  ["agent_id an array", { agent_id: ["agent-1"] }],
  ["agent_type an object with no agent_id", { agent_type: { name: "developer" } }],
  ["agent_type a number with no agent_id", { agent_type: 5 }],
].forEach((row) => {
  test("[AC-3 | spec-hooks-audit | FR-226 | FR-232 | UR-066] input of the wrong shape (" + row[0] + ") resolves to unidentified, never blank, and does not throw", () => {
    // Type-mismatch and null input space.
    let who;
    assert.doesNotThrow(() => {
      who = identity.resolve(row[1]);
    });
    assert.strictEqual(who.agent_type, "unidentified");
    assert.strictEqual(identity.UNIDENTIFIED, "unidentified");
    assertNeverBlank(who);
  });
});

test("[AC-3 | spec-hooks-audit | FR-226 | FR-232] fields() of an unidentified actor reads unidentified", () => {
  assert.strictEqual(identity.fields(null).agent_type, "unidentified");
  assert.strictEqual(identity.fields({ agent_id: { bad: true } }).agent_type, "unidentified");
});

// ---------------------------------------------------------------------------
// The identity is never blank (Requirement: Per-agent identity helper)
// ---------------------------------------------------------------------------

test("[Requirement: Per-agent identity helper | spec-hooks-audit | FR-226 | UR-066] a battery of hostile and odd inputs never produces a blank identity or a throw", () => {
  const battery = [
    undefined,
    null,
    {},
    [],
    "",
    0,
    { agent_id: "   " },
    { agent_id: "a b c" },
    { agent_id: "x\ny" },
    { agent_id: "$(rm -rf /)" },
    { agent_id: "../../etc/passwd" },
    { agent_id: "a".repeat(5000), agent_type: "developer" },
    { agent_id: "agent-1", agent_type: "x".repeat(5000) },
    { agent_id: "agent-1", agent_type: "dev eloper" },
    { agent_id: "agent-1", agent_type: "" },
    { agent_id: "agent-1", agent_type: null },
    { agent_id: "agent-1", agent_type: "<script>alert(1)</script>" },
    { agent_id: "agent-1", agent_type: "'; DROP TABLE users; --" },
    { agent_type: "dev eloper" },
    { agent_type: "a".repeat(5000) },
  ];
  battery.forEach((input) => {
    let who;
    assert.doesNotThrow(() => {
      who = identity.resolve(input);
    }, "resolve threw for " + JSON.stringify(input));
    assertNeverBlank(who);
    const slot = identity.fields(input);
    assert.strictEqual(typeof slot.agent_type, "string");
    assert.ok(slot.agent_type.trim().length > 0, "fields() agent_type is not blank for " + JSON.stringify(input));
  });
});

test("[Requirement: Per-agent identity helper | spec-hooks-audit | FR-226 | NFR-031] an id or type that is not a plain identifier is never copied into the identity", () => {
  // Security-adjacent: free text and shell or markup metacharacters must not reach a log record through the identity.
  const hostile = ["$(rm -rf /)", "x\ny", "<script>alert(1)</script>", "'; DROP TABLE users; --", "a b c"];
  hostile.forEach((value) => {
    const who = identity.resolve({ agent_id: value, agent_type: "developer" });
    assert.ok(who.agent_id !== value, "the hostile id was copied: " + JSON.stringify(value));
    const typed = identity.resolve({ agent_id: "agent-1", agent_type: value });
    assert.ok(typed.agent_type !== value, "the hostile type was copied: " + JSON.stringify(value));
  });
});

// ---------------------------------------------------------------------------
// The plugin version comes from the manifest at run time (Requirement: Per-agent identity helper)
// ---------------------------------------------------------------------------

test("[Requirement: Per-agent identity helper | spec-hooks-audit | FR-226 | UR-066] pluginVersion() reads the version of plugins/assist-plugin/.claude-plugin/plugin.json", () => {
  assert.strictEqual(identity.pluginVersion(), MANIFEST_VERSION);
  assert.ok(/^\d+\.\d+\.\d+/.test(MANIFEST_VERSION), "the manifest holds a semantic version: " + MANIFEST_VERSION);
});

test("[Requirement: Per-agent identity helper | spec-hooks-audit | FR-226] the version follows the manifest it reads: another manifest gives another version, not a constant", () => {
  const first = identity.pluginVersion({ manifestPath: writeManifest("9.8.7") });
  const second = identity.pluginVersion({ manifestPath: writeManifest("1.2.3") });
  assert.strictEqual(first, "9.8.7");
  assert.strictEqual(second, "1.2.3");
  assert.strictEqual(identity.pluginVersion(), MANIFEST_VERSION, "a test manifest does not replace the real version");
});

[
  ["a manifest that does not exist", () => path.join(fx.tempDir("identity-nomanifest-"), "missing.json")],
  ["a manifest that is not JSON", () => writeManifest("{ not json")],
  ["a manifest with no version", () => writeManifest("{\"name\":\"fixture\"}")],
  ["a manifest whose version is a number", () => writeManifest("{\"version\":5}")],
  ["a manifest whose version holds free text", () => writeManifest("{\"version\":\"1.0.0 ; rm -rf /\"}")],
].forEach((row) => {
  test("[Requirement: Per-agent identity helper | spec-hooks-audit | FR-226] " + row[0] + " yields a non-blank placeholder version, never an empty string or a throw", () => {
    let version;
    assert.doesNotThrow(() => {
      version = identity.pluginVersion({ manifestPath: row[1]() });
    });
    assert.strictEqual(typeof version, "string");
    assert.ok(version.trim().length > 0, "the version is not blank");
    assert.strictEqual(version, identity.UNKNOWN_VERSION);
    assert.ok(version.indexOf("rm -rf") === -1);
  });
});

// ---------------------------------------------------------------------------
// Records the hooks write carry the identity (FR-226: "each logged event")
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-audit | FR-226 | UR-066 | NFR-026] a subagent's tool event is logged with its agent type, its agent id, and the plugin version", () => {
  const root = fx.tempRoot("identity-hook-");
  const res = fx.runHook("audit-log", postToolUse(root, { agent_type: "developer", agent_id: "agent-dev-9" }));
  assert.strictEqual(res.status, 0, res.stderr);
  const records = fx.readRecords(root);
  assert.strictEqual(records.length, 1, JSON.stringify(records));
  assert.strictEqual(records[0].agent_type, "developer");
  assert.strictEqual(records[0].agent_id, "agent-dev-9");
  assert.ok(JSON.stringify(records[0]).indexOf(MANIFEST_VERSION) !== -1, "the record holds the plugin version " + MANIFEST_VERSION + ": " + JSON.stringify(records[0]));
});

test("[AC-2 | spec-hooks-audit | FR-226 | UR-066 | NFR-026] a main-session tool event is logged as main-session, not blank, with the plugin version", () => {
  const root = fx.tempRoot("identity-hook-");
  const res = fx.runHook("audit-log", postToolUse(root));
  assert.strictEqual(res.status, 0, res.stderr);
  const records = fx.readRecords(root);
  assert.strictEqual(records.length, 1);
  assert.strictEqual(records[0].agent_type, "main-session");
  assert.ok(records[0].agent_id === undefined || records[0].agent_id === null);
  assert.ok(JSON.stringify(records[0]).indexOf(MANIFEST_VERSION) !== -1, "the record holds the plugin version: " + JSON.stringify(records[0]));
});

test("[AC-3 | spec-hooks-audit | FR-226 | FR-232 | UR-066] a tool event whose actor cannot be established is logged as unidentified", () => {
  const root = fx.tempRoot("identity-hook-");
  const res = fx.runHook("audit-log", postToolUse(root, { agent_id: { not: "a string" }, agent_type: "developer" }));
  assert.strictEqual(res.status, 0, res.stderr);
  const records = fx.readRecords(root);
  assert.strictEqual(records.length, 1);
  assert.strictEqual(records[0].agent_type, "unidentified");
});

test("[AC-3 | spec-hooks-audit | FR-232 | UR-066] chain verification flags an unidentified record and still reads the chain as intact", () => {
  const root = fx.tempRoot("identity-verify-");
  fx.runHook("audit-log", postToolUse(root));
  fx.runHook("audit-log", postToolUse(root, { agent_id: { not: "a string" } }));
  const res = require("node:child_process").spawnSync(process.execPath, [VERIFIER, root], {
    cwd: fx.tempDir("identity-verify-cwd-"),
    env: fx.cleanEnv(),
    encoding: "utf8",
    timeout: 60000,
  });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/unidentified/i.test(res.stdout), "the output flags the unidentified record: " + res.stdout);
});

test("[AC-2 | spec-hooks-audit | FR-226 | NFR-026] a guard decision by the main session logs main-session as the actor", () => {
  // The confirmation store is denied to every caller, the main session included, so this deny has no agent id.
  const root = fx.tempRoot("identity-deny-");
  const doc = preToolUse(root, "Write", { file_path: path.join(root, ".agent", "governance", "confirmations", "confirmations.jsonl"), content: "x" });
  const res = fx.runHook("fsa-write-bar", doc);
  assert.strictEqual(res.status, 0, res.stderr);
  const denies = fx.readRecords(root).filter((r) => r.decision === "deny");
  assert.strictEqual(denies.length, 1, JSON.stringify(fx.readRecords(root)));
  assert.strictEqual(denies[0].agent_type, "main-session");
});

test("[AC-1 | spec-hooks-audit | FR-226 | NFR-026] a guard decision by a subagent logs its agent type and agent id", () => {
  const root = fx.tempRoot("identity-deny-");
  const doc = preToolUse(root, "Write", { file_path: path.join(root, "DECISIONS.md"), content: "x" }, { agent_type: "assist-plugin:developer", agent_id: "agent-dev-4" });
  const res = fx.runHook("fsa-write-bar", doc);
  assert.strictEqual(res.status, 0, res.stderr);
  const denies = fx.readRecords(root).filter((r) => r.decision === "deny");
  assert.strictEqual(denies.length, 1);
  assert.strictEqual(denies[0].agent_type, "assist-plugin:developer");
  assert.strictEqual(denies[0].agent_id, "agent-dev-4");
});

test("[Requirement: Per-agent identity helper | spec-hooks-audit | FR-226 | NFR-031] an identity record holds no prompt text, command text, or file contents", () => {
  const root = fx.tempRoot("identity-privacy-");
  fx.runHook(
    "audit-log",
    postToolUse(root, {
      agent_type: "developer",
      agent_id: "agent-dev-2",
      prompt: "PROMPT-MARKER-id",
      tool_input: { file_path: path.join(root, "src", "app.js"), content: "CONTENT-MARKER-id token=abc123" },
    })
  );
  const raw = fx.rawLog(root);
  assert.ok(raw.length > 0, "set-up: a record was written");
  ["PROMPT-MARKER-id", "CONTENT-MARKER-id", "abc123", "token="].forEach((needle) => {
    assert.ok(raw.indexOf(needle) === -1, "found " + JSON.stringify(needle) + " in the log");
  });
});
