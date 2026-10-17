// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box tests for the hook registration file, release 1.12.0
// (plugins/assist-plugin/hooks/hooks.json).
//
// Sources: specs/spec-hooks-platform.md (Requirement: Hook registration, registration table
// and Scenarios "Registration count" and "Timeouts"; Change Log 2026-10-16, Requirement: Hook
// registration, Scenarios "Documentation guard matcher" and "Count unchanged") and
// docs/requirements/FR-NFR-assist-plugin.md (FR-086, FR-094, NFR-007).
// Task plan step 29.
//
// Traceability format: [Scenario title | spec section | FR/NFR ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// The registration table of 1.12.0 (row 2 moves to the matcher Bash|PowerShell):
//   event        matcher                                   script                    timeout
//   PreToolUse   Bash                                      sa-mermaid-only           5
//   PreToolUse   Bash|PowerShell                           doc-cli-guard             5
//   PreToolUse   Bash|PowerShell                           commit-attribution-guard  5
//   PreToolUse   Agent                                     injection-filter          5
//   PreToolUse   Write|Edit|MultiEdit|NotebookEdit         prose-gate                5
//   PreToolUse   Write|Edit|MultiEdit|NotebookEdit         fsa-write-bar             5
//   PostToolUse  .*                                        injection-filter          5
//   PostToolUse  Write|Edit|MultiEdit|NotebookEdit         prose-advisor             5
//   PostToolUse  Agent                                     fsa-log                   5
//   PostToolUse  SubagentHandback                          fsa-log                   5
//   UserPromptSubmit  (none)                               injection-filter          5
//   SessionStart startup|resume                            health-check --session-start  10
//   SessionStart startup|resume|clear|compact              writing-context           5
//   SubagentStart .*                                       writing-context           5
//   SubagentStop .*                                        fsa-log                   5
//
// Run: node --test tests/hooks/hooks-registration.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const HOOKS_JSON = path.join(REPO, "plugins", "assist-plugin", "hooks", "hooks.json");

const config = JSON.parse(fs.readFileSync(HOOKS_JSON, "utf8"));

// Flatten to one record per command entry: {event, matcher, script, args, timeout, type, command}.
function entries() {
  const out = [];
  Object.keys(config.hooks).forEach((event) => {
    config.hooks[event].forEach((group) => {
      (group.hooks || []).forEach((h) => {
        const m = /\/hooks\/([a-z-]+)\.js"(?:\s+(.*))?$/.exec(String(h.command));
        out.push({
          event: event,
          matcher: group.matcher === undefined ? null : group.matcher,
          script: m ? m[1] : null,
          args: m && m[2] ? m[2] : null,
          timeout: h.timeout,
          type: h.type,
          command: h.command,
        });
      });
    });
  });
  return out;
}

const ALL = entries();
const COMMANDS = ALL.filter((e) => e.type === "command");

const WRITE_TOOLS = "Write|Edit|MultiEdit|NotebookEdit";

const EXPECTED = [
  ["PreToolUse", "Bash", "sa-mermaid-only", null, 5],
  ["PreToolUse", "Bash|PowerShell", "doc-cli-guard", null, 5],
  ["PreToolUse", "Bash|PowerShell", "commit-attribution-guard", null, 5],
  ["PreToolUse", "Agent", "injection-filter", null, 5],
  ["PreToolUse", WRITE_TOOLS, "prose-gate", null, 5],
  ["PreToolUse", WRITE_TOOLS, "fsa-write-bar", null, 5],
  ["PostToolUse", ".*", "injection-filter", null, 5],
  ["PostToolUse", WRITE_TOOLS, "prose-advisor", null, 5],
  ["PostToolUse", "Agent", "fsa-log", null, 5],
  ["PostToolUse", "SubagentHandback", "fsa-log", null, 5],
  ["UserPromptSubmit", null, "injection-filter", null, 5],
  ["SessionStart", "startup|resume", "health-check", "--session-start", 10],
  ["SessionStart", "startup|resume|clear|compact", "writing-context", null, 5],
  ["SubagentStart", ".*", "writing-context", null, 5],
  ["SubagentStop", ".*", "fsa-log", null, 5],
];

function key(row) {
  return row.join("\u0001");
}

// ---------------------------------------------------------------------------
// Documentation guard matcher
// ---------------------------------------------------------------------------

test("the PreToolUse entry that runs doc-cli-guard.js sits in a group with matcher Bash|PowerShell", () => {
  // [Scenario: Documentation guard matcher | spec-hooks-platform.md "Hook registration" (Change Log 2026-10-16) | FR-094 | FR-086]
  const pre = ALL.filter((e) => e.event === "PreToolUse" && e.script === "doc-cli-guard");
  assert.strictEqual(pre.length, 1, "exactly one PreToolUse entry runs doc-cli-guard.js");
  assert.strictEqual(pre[0].matcher, "Bash|PowerShell");
});

test("doc-cli-guard.js is registered once in the whole file and in no Bash-only group", () => {
  // Negative: the old Bash-only registration is gone. [Scenario: Documentation guard matcher | same requirement | FR-094]
  const all = ALL.filter((e) => e.script === "doc-cli-guard");
  assert.strictEqual(all.length, 1);
  assert.notStrictEqual(all[0].matcher, "Bash");
});

test("the entry that runs sa-mermaid-only.js sits in a group whose matcher is Bash", () => {
  // solutions-architect declares no PowerShell tool. [Scenario: Documentation guard matcher (AND clause) | spec-hooks-platform.md "Hook registration" | FR-094 | FR-093]
  const sa = ALL.filter((e) => e.script === "sa-mermaid-only");
  assert.strictEqual(sa.length, 1);
  assert.strictEqual(sa[0].event, "PreToolUse");
  assert.strictEqual(sa[0].matcher, "Bash");
});

test("the PostToolUse matcher .* still delivers PowerShell results to injection-filter", () => {
  // No registration change is needed for the filter. [Requirement: Hook registration | spec-hooks-platform.md (Change Log 2026-10-16) | FR-099 | FR-094]
  const post = ALL.filter((e) => e.event === "PostToolUse" && e.script === "injection-filter");
  assert.strictEqual(post.length, 1);
  assert.strictEqual(post[0].matcher, ".*");
});

// ---------------------------------------------------------------------------
// Count, scripts, timeouts
// ---------------------------------------------------------------------------

test("hooks.json parses and holds exactly 15 entries whose type is command", () => {
  // [Scenario: Count unchanged | spec-hooks-platform.md "Hook registration" (Change Log 2026-10-16) | FR-094 | NFR-007]
  assert.strictEqual(COMMANDS.length, 15);
  assert.strictEqual(ALL.length, 15, "no entry of another type");
});

test("the 15 entries are built from 10 scripts", () => {
  // [Scenario: Registration count | spec-hooks-platform.md "Hook registration" | FR-086 | NFR-007]
  const names = Array.from(new Set(COMMANDS.map((e) => e.script))).sort();
  assert.deepStrictEqual(names, [
    "commit-attribution-guard",
    "doc-cli-guard",
    "fsa-log",
    "fsa-write-bar",
    "health-check",
    "injection-filter",
    "prose-advisor",
    "prose-gate",
    "sa-mermaid-only",
    "writing-context",
  ]);
});

test("every command has the form cd CLAUDE_PLUGIN_ROOT || true; node CLAUDE_PLUGIN_ROOT/hooks/<script>.js", () => {
  // [Requirement: Hook registration, command form | spec-hooks-platform.md | FR-086]
  COMMANDS.forEach((e) => {
    const pattern = /^cd "\$\{CLAUDE_PLUGIN_ROOT\}" 2>\/dev\/null \|\| true; node "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/[a-z-]+\.js"( --session-start)?$/;
    assert.ok(pattern.test(e.command), "unexpected command form: " + e.command);
  });
});

test("every timeout is 5 except the SessionStart health-check.js entry, which is 10", () => {
  // [Scenario: Timeouts | spec-hooks-platform.md "Hook registration" | FR-086 | NFR-007]
  COMMANDS.forEach((e) => {
    const expected = e.script === "health-check" ? 10 : 5;
    assert.strictEqual(e.timeout, expected, e.event + " " + e.script + " timeout");
  });
  const health = COMMANDS.filter((e) => e.script === "health-check");
  assert.strictEqual(health.length, 1);
  assert.strictEqual(health[0].event, "SessionStart");
  assert.strictEqual(health[0].args, "--session-start");
});

test("the file matches the 15-row registration table of 1.12.0 (event, matcher, script, argument, timeout)", () => {
  // [Scenario: Count unchanged (every timeout as in the registration table) | spec-hooks-platform.md "Hook registration" | FR-094 | FR-086 | NFR-007]
  const actual = COMMANDS.map((e) => key([e.event, e.matcher, e.script, e.args, e.timeout])).sort();
  const expected = EXPECTED.map(key).sort();
  assert.deepStrictEqual(actual, expected);
});
