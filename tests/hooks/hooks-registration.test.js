// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box tests for the hook registration file, release 1.12.0 plus the pr-post-ask follow-up and the
// harness-governance Tranche 1 hooks (plugins/assist-plugin/hooks/hooks.json).
//
// Sources: specs/spec-hooks-platform.md (Requirement: Hook registration, registration table
// and Scenarios "Registration count" and "Timeouts"; Change Log 2026-10-16, Requirement: Hook
// registration, Scenarios "Documentation guard matcher" and "Count unchanged"; Change Log
// 2026-10-22, Requirement: Hook registration, Scenarios "Registration count after the ask hook" and
// "Timeouts with the ask hook") and docs/requirements/FR-NFR-assist-plugin.md (FR-086, FR-094,
// FR-206, NFR-007). Task plan steps 29 (1.12.0) and 22 (pr-post-ask follow-up).
// Harness governance Tranche 1: docs/requirements/FR-NFR-harness-governance.md (FR-214 PR verdict guard,
// FR-242 confirmation-recording hook, NFR-035 timeout and ES5 entry); docs/task-plans/task-plan-harness-governance-20261028-0759.md,
// Steps 3 and 4.
//
// Traceability format: [Scenario title | spec section | FR/NFR ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// The registration table after Tranche 1 (18 command entries from 13 scripts; rows 17 and 18 are new):
//   event        matcher                                   script                    timeout
//   PreToolUse   Bash                                      sa-mermaid-only           5
//   PreToolUse   Bash|PowerShell                           doc-cli-guard             5
//   PreToolUse   Bash|PowerShell                           commit-attribution-guard  5
//   PreToolUse   Bash|PowerShell                           pr-post-ask               5   (row 16, after doc-cli-guard)
//   PreToolUse   Bash|PowerShell                           pr-verdict-guard          5   (row 17, after pr-post-ask)
//   PreToolUse   Agent                                     injection-filter          5
//   PreToolUse   Write|Edit|MultiEdit|NotebookEdit         prose-gate                5
//   PreToolUse   Write|Edit|MultiEdit|NotebookEdit         fsa-write-bar             5
//   PostToolUse  .*                                        injection-filter          5
//   PostToolUse  Write|Edit|MultiEdit|NotebookEdit         prose-advisor             5
//   PostToolUse  Agent                                     fsa-log                   5
//   PostToolUse  SubagentHandback                          fsa-log                   5
//   UserPromptSubmit  (none)                               injection-filter          5
//   UserPromptSubmit  (none)                               confirmation-record       5   (row 18)
//   SessionStart startup|resume                            health-check --session-start  10
//   SessionStart startup|resume|clear|compact              writing-context           5
//   SubagentStart .*                                       writing-context           5
//   SubagentStop .*                                        fsa-log                   5
//
// The Scenario "Count holds until the hook is built" (15 entries from 10 scripts) and the 16-entry
// count of the pr-post-ask follow-up no longer apply and have no test.
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
  ["PreToolUse", "Bash|PowerShell", "pr-verdict-guard", null, 5],
  ["PreToolUse", "Agent", "injection-filter", null, 5],
  ["PreToolUse", WRITE_TOOLS, "prose-gate", null, 5],
  ["PreToolUse", WRITE_TOOLS, "fsa-write-bar", null, 5],
  ["PostToolUse", ".*", "injection-filter", null, 5],
  ["PostToolUse", WRITE_TOOLS, "prose-advisor", null, 5],
  ["PostToolUse", "Agent", "fsa-log", null, 5],
  ["PostToolUse", "SubagentHandback", "fsa-log", null, 5],
  ["UserPromptSubmit", null, "injection-filter", null, 5],
  ["UserPromptSubmit", null, "confirmation-record", null, 5],
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
// The pr-verdict-guard hook (FR-214)
// ---------------------------------------------------------------------------

test("[FR-214 | NFR-035] pr-verdict-guard.js is registered once, under PreToolUse, in a group whose matcher is Bash|PowerShell", () => {
  const all = ALL.filter((e) => e.script === "pr-verdict-guard");
  assert.strictEqual(all.length, 1, "exactly one registration");
  assert.strictEqual(all[0].event, "PreToolUse");
  assert.strictEqual(all[0].matcher, "Bash|PowerShell");
  assert.strictEqual(all[0].args, null, "no extra argument");
});

test("[FR-214 | PN-5] pr-verdict-guard.js joins the Bash|PowerShell group after pr-post-ask, and pr-post-ask stays registered", () => {
  // The guard is additive: pr-post-ask keeps its entry and its place. A deny from the guard wins over the ask.
  const group = preToolUseGroupOf("pr-verdict-guard");
  assert.ok(group, "a PreToolUse group holds pr-verdict-guard.js");
  assert.strictEqual(group.matcher, "Bash|PowerShell");
  const scripts = scriptsOfGroup(group);
  assert.ok(scripts.indexOf("pr-post-ask") !== -1, "pr-post-ask is still in the group");
  assert.ok(scripts.indexOf("pr-verdict-guard") > scripts.indexOf("pr-post-ask"), "pr-verdict-guard follows pr-post-ask");
  assert.strictEqual(scripts.filter((s) => s === "pr-verdict-guard").length, 1);
  assert.strictEqual(group, preToolUseGroupOf("pr-post-ask"), "one group for both");
});

test("[FR-214 | NFR-035] every entry that runs pr-verdict-guard.js has the standard command form and timeout 5", () => {
  const e = COMMANDS.filter((x) => x.script === "pr-verdict-guard");
  assert.strictEqual(e.length, 1);
  assert.strictEqual(e[0].type, "command");
  assert.strictEqual(e[0].timeout, 5);
  assert.strictEqual(
    e[0].command,
    'cd "${CLAUDE_PLUGIN_ROOT}" 2>/dev/null || true; node "${CLAUDE_PLUGIN_ROOT}/hooks/pr-verdict-guard.js"'
  );
});

// ---------------------------------------------------------------------------
// The confirmation-record hook (FR-242)
// ---------------------------------------------------------------------------

test("[FR-242 | NFR-035] confirmation-record.js is registered once, under UserPromptSubmit, with no matcher", () => {
  const all = ALL.filter((e) => e.script === "confirmation-record");
  assert.strictEqual(all.length, 1, "exactly one registration");
  assert.strictEqual(all[0].event, "UserPromptSubmit");
  assert.strictEqual(all[0].matcher, null, "UserPromptSubmit takes no matcher");
  assert.strictEqual(all[0].args, null, "no extra argument");
});

test("[FR-242 | NFR-035] every entry that runs confirmation-record.js has the standard command form and an explicit timeout of 5", () => {
  const e = COMMANDS.filter((x) => x.script === "confirmation-record");
  assert.strictEqual(e.length, 1);
  assert.strictEqual(e[0].type, "command");
  assert.strictEqual(e[0].timeout, 5);
  assert.strictEqual(
    e[0].command,
    'cd "${CLAUDE_PLUGIN_ROOT}" 2>/dev/null || true; node "${CLAUDE_PLUGIN_ROOT}/hooks/confirmation-record.js"'
  );
});

test("[FR-242] UserPromptSubmit holds injection-filter and confirmation-record, and nothing else", () => {
  const scripts = ALL.filter((e) => e.event === "UserPromptSubmit").map((e) => e.script).sort();
  assert.deepStrictEqual(scripts, ["confirmation-record", "injection-filter"]);
});

test("[FR-242 | FR-245] no hook is registered for the confirmation store under a tool matcher (the store is written by fs from the UserPromptSubmit hook only)", () => {
  const recorders = ALL.filter((e) => e.script === "confirmation-record");
  recorders.forEach((e) => assert.strictEqual(e.event, "UserPromptSubmit"));
});

// ---------------------------------------------------------------------------
// Count, scripts, timeouts
// ---------------------------------------------------------------------------

test("hooks.json parses and holds exactly 18 entries whose type is command", () => {
  // [Scenario: Registration count after the ask hook | spec-hooks-platform.md "Hook registration" (Change Log 2026-10-22) | FR-086 FR-206 | NFR-007; two entries added by harness-governance Tranche 1 | FR-214 FR-242]
  assert.strictEqual(COMMANDS.length, 18);
  assert.strictEqual(ALL.length, 18, "no entry of another type");
});

test("the 18 entries are built from 13 scripts", () => {
  // [Scenario: Registration count after the ask hook | spec-hooks-platform.md "Hook registration" (Change Log 2026-10-22) | FR-086 FR-206 | NFR-007; Tranche 1 | FR-214 FR-242]
  const names = Array.from(new Set(COMMANDS.map((e) => e.script))).sort();
  assert.strictEqual(names.length, 13);
  assert.deepStrictEqual(names, [
    "commit-attribution-guard",
    "confirmation-record",
    "doc-cli-guard",
    "fsa-log",
    "fsa-write-bar",
    "health-check",
    "injection-filter",
    "pr-post-ask",
    "pr-verdict-guard",
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

test("every registered script has an ES5 entry file in hooks/ and an implementation in hooks/impl/", () => {
  // [Requirement: Hook registration, entry files | spec-hooks-platform.md | FR-086 | NFR-035]
  const hooksDir = path.join(REPO, "plugins", "assist-plugin", "hooks");
  Array.from(new Set(COMMANDS.map((e) => e.script))).forEach((name) => {
    assert.ok(fs.existsSync(path.join(hooksDir, name + ".js")), "entry file missing: hooks/" + name + ".js");
    assert.ok(fs.existsSync(path.join(hooksDir, "impl", name + ".js")), "implementation missing: hooks/impl/" + name + ".js");
  });
});

test("every timeout is 5, pr-post-ask, pr-verdict-guard, and confirmation-record included, except the SessionStart health-check.js entry, which is 10", () => {
  // [Scenario: Timeouts with the ask hook | spec-hooks-platform.md "Hook registration" (Change Log 2026-10-22) | FR-086 FR-206 NFR-007; Tranche 1 | NFR-035]
  COMMANDS.forEach((e) => {
    const expected = e.script === "health-check" ? 10 : 5;
    assert.strictEqual(e.timeout, expected, e.event + " " + e.script + " timeout");
  });
  const health = COMMANDS.filter((e) => e.script === "health-check");
  assert.strictEqual(health.length, 1);
  assert.strictEqual(health[0].event, "SessionStart");
  assert.strictEqual(health[0].args, "--session-start");
});

test("the file matches the 18-row registration table (event, matcher, script, argument, timeout)", () => {
  // [Scenario: Registration count after the ask hook (every row as in the registration table) | spec-hooks-platform.md "Hook registration" (Change Log 2026-10-22) | FR-086 FR-206 | NFR-007; Tranche 1 rows 17 and 18 | FR-214 FR-242]
  const actual = COMMANDS.map((e) => key([e.event, e.matcher, e.script, e.args, e.timeout])).sort();
  const expected = EXPECTED.map(key).sort();
  assert.strictEqual(EXPECTED.length, 18);
  assert.deepStrictEqual(actual, expected);
});
