// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box tests for the hook registration file, release 1.12.0 plus the pr-post-ask follow-up
// (plugins/assist-plugin/hooks/hooks.json).
//
// Sources: specs/spec-hooks-platform.md (Requirement: Hook registration, registration table
// and Scenarios "Registration count" and "Timeouts"; Change Log 2026-10-16, Requirement: Hook
// registration, Scenarios "Documentation guard matcher" and "Count unchanged"; Change Log
// 2026-10-22, Requirement: Hook registration, Scenarios "Registration count after the ask hook" and
// "Timeouts with the ask hook") and docs/requirements/FR-NFR-assist-plugin.md (FR-086, FR-094,
// FR-206, NFR-007). Task plan steps 29 (1.12.0) and 22 (pr-post-ask follow-up).
//
// Traceability format: [Scenario title | spec section | FR/NFR ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// The registration table after the follow-up (16 command entries from 11 scripts; row 16 is new):
//   event        matcher                                   script                    timeout
//   PreToolUse   Bash                                      sa-mermaid-only           5
//   PreToolUse   Bash|PowerShell                           doc-cli-guard             5
//   PreToolUse   Bash|PowerShell                           commit-attribution-guard  5
//   PreToolUse   Bash|PowerShell                           pr-post-ask               5   (row 16, after doc-cli-guard)
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
// The Scenario "Count holds until the hook is built" (15 entries from 10 scripts) no longer applies
// and has no test.
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
  ["PreToolUse", "Bash|PowerShell", "pr-post-ask", null, 5],
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

// The PreToolUse group (matcher and hooks array) that holds the command of a script.
function preToolUseGroupOf(script) {
  return config.hooks.PreToolUse.find((group) =>
    (group.hooks || []).some((h) => new RegExp("/hooks/" + script + "\\.js\"").test(String(h.command)))
  );
}

function scriptsOfGroup(group) {
  return (group.hooks || []).map((h) => {
    const m = /\/hooks\/([a-z-]+)\.js"/.exec(String(h.command));
    return m ? m[1] : null;
  });
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
// The pr-post-ask hook
// ---------------------------------------------------------------------------

test("the PreToolUse entry that runs pr-post-ask.js sits in a group whose matcher is Bash|PowerShell", () => {
  // [Scenario: Registration count after the ask hook (AND clause) | spec-hooks-platform.md "Hook registration" (Change Log 2026-10-22) | FR-086 FR-206 | NFR-007]
  const pre = ALL.filter((e) => e.event === "PreToolUse" && e.script === "pr-post-ask");
  assert.strictEqual(pre.length, 1, "exactly one PreToolUse entry runs pr-post-ask.js");
  assert.strictEqual(pre[0].matcher, "Bash|PowerShell");
});

test("pr-post-ask.js is registered once in the whole file, under PreToolUse only, in no Bash-only group", () => {
  // Negative: one registration, no other event, and not the sa-mermaid-only Bash group. [Scenario: Registration count after the ask hook | spec-hooks-platform.md "Hook registration" (Change Log 2026-10-22) | FR-086 FR-206]
  const all = ALL.filter((e) => e.script === "pr-post-ask");
  assert.strictEqual(all.length, 1);
  assert.strictEqual(all[0].event, "PreToolUse");
  assert.notStrictEqual(all[0].matcher, "Bash");
  assert.strictEqual(all[0].args, null, "no extra argument");
});

test("pr-post-ask.js joins the Bash|PowerShell group of doc-cli-guard and commit-attribution-guard, after doc-cli-guard", () => {
  // [Requirement: Hook registration, row 16 placement | spec-hooks-platform.md (Change Log 2026-10-22) | FR-086 FR-206]
  const group = preToolUseGroupOf("pr-post-ask");
  assert.ok(group, "a PreToolUse group holds pr-post-ask.js");
  assert.strictEqual(group.matcher, "Bash|PowerShell");
  const scripts = scriptsOfGroup(group);
  assert.ok(scripts.indexOf("doc-cli-guard") !== -1, "the group holds doc-cli-guard");
  assert.ok(scripts.indexOf("commit-attribution-guard") !== -1, "the group holds commit-attribution-guard");
  assert.ok(scripts.indexOf("pr-post-ask") > scripts.indexOf("doc-cli-guard"), "pr-post-ask follows doc-cli-guard");
  assert.strictEqual(scripts.filter((s) => s === "pr-post-ask").length, 1);
  assert.strictEqual(group, preToolUseGroupOf("doc-cli-guard"), "one group for both");
});

test("every entry that runs pr-post-ask.js has the standard command form and timeout 5", () => {
  // [Scenario: Timeouts with the ask hook | spec-hooks-platform.md "Hook registration" (Change Log 2026-10-22) | FR-086 NFR-007]
  const e = COMMANDS.filter((x) => x.script === "pr-post-ask");
  assert.strictEqual(e.length, 1);
  assert.strictEqual(e[0].type, "command");
  assert.strictEqual(e[0].timeout, 5);
  assert.strictEqual(
    e[0].command,
    'cd "${CLAUDE_PLUGIN_ROOT}" 2>/dev/null || true; node "${CLAUDE_PLUGIN_ROOT}/hooks/pr-post-ask.js"'
  );
});

// ---------------------------------------------------------------------------
// Count, scripts, timeouts
// ---------------------------------------------------------------------------

test("hooks.json parses and holds exactly 16 entries whose type is command", () => {
  // [Scenario: Registration count after the ask hook | spec-hooks-platform.md "Hook registration" (Change Log 2026-10-22) | FR-086 FR-206 | NFR-007]
  assert.strictEqual(COMMANDS.length, 16);
  assert.strictEqual(ALL.length, 16, "no entry of another type");
});

test("the 16 entries are built from 11 scripts", () => {
  // [Scenario: Registration count after the ask hook | spec-hooks-platform.md "Hook registration" (Change Log 2026-10-22) | FR-086 FR-206 | NFR-007]
  const names = Array.from(new Set(COMMANDS.map((e) => e.script))).sort();
  assert.deepStrictEqual(names, [
    "commit-attribution-guard",
    "doc-cli-guard",
    "fsa-log",
    "fsa-write-bar",
    "health-check",
    "injection-filter",
    "pr-post-ask",
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

test("every timeout is 5, pr-post-ask included, except the SessionStart health-check.js entry, which is 10", () => {
  // [Scenario: Timeouts with the ask hook | spec-hooks-platform.md "Hook registration" (Change Log 2026-10-22) | FR-086 FR-206 | NFR-007]
  COMMANDS.forEach((e) => {
    const expected = e.script === "health-check" ? 10 : 5;
    assert.strictEqual(e.timeout, expected, e.event + " " + e.script + " timeout");
  });
  const health = COMMANDS.filter((e) => e.script === "health-check");
  assert.strictEqual(health.length, 1);
  assert.strictEqual(health[0].event, "SessionStart");
  assert.strictEqual(health[0].args, "--session-start");
});

test("the file matches the 16-row registration table (event, matcher, script, argument, timeout)", () => {
  // [Scenario: Registration count after the ask hook (every row as in the registration table) | spec-hooks-platform.md "Hook registration" (Change Log 2026-10-22) | FR-086 FR-206 | NFR-007]
  const actual = COMMANDS.map((e) => key([e.event, e.matcher, e.script, e.args, e.timeout])).sort();
  const expected = EXPECTED.map(key).sort();
  assert.strictEqual(EXPECTED.length, 16);
  assert.deepStrictEqual(actual, expected);
});
