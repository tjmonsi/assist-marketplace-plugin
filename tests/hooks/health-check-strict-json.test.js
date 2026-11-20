// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the health check report of a strict-parse rejection (item 2, task plan step 8):
// the governance part of the report that `node plugins/assist-plugin/hooks/health-check.js` prints.
//
// Sources: specs/spec-hooks-strict-json.md (Requirement 8: The health check reports a rejected rule-modes.json
// or profile.json; Scenarios "Health check surfaces a rejection" and "No rejection, no finding"; its Change Log
// 2026-11-20 entry, which adds the Scenarios "Syntax error labeled apart from a strict-parse failure" and
// "Duplicate-key rejection labeled as a strict-parse failure"; RULE-003),
// docs/requirements/FR-NFR-harness-governance.md (FR-249, NFR-016, NFR-028), docs/requirements/URD-harness-governance.md
// (UR-069). Task plan: docs/task-plans/task-plan-assist-pi-backport-20261120-0314.md, Steps 5 and 8.
//
// Traceability format: [AC-N | spec-hooks-strict-json R8 | FR-249 | UR-069 | NFR-nnn]. The spec carries no SPEC-NNN
// id, so it is cited by file name. AC-N is the position of the Scenario inside Requirement 8, counting the body
// Scenarios first and the Change Log 2026-11-20 Scenarios after them:
//   AC-1 Health check surfaces a rejection, AC-2 No rejection, no finding,
//   AC-3 Syntax error labeled apart from a strict-parse failure,
//   AC-4 Duplicate-key rejection labeled as a strict-parse failure
// A case that goes beyond a named Scenario (a boundary the plan implies) carries the Requirement and no AC-N.
//
// Public interface used:
//   the command `node hooks/health-check.js` (report mode): plain text on stdout, exit 0. The project directory
//     comes from CLAUDE_PROJECT_DIR and the process directory; the plugin data and config directories are temp
//     directories. This follows tests/hooks/health-check-push-grant.test.js, which drives the same command.
//   Contract of the task plan, Step 5: a rejected `.agent/governance/rule-modes.json` adds one finding that names
//     the file and the strict-parse failure code; a rejected `.agent/governance/profile.json` shows in the existing
//     profile line, which names the file and says "strict-parse failure"; nothing is added for an absent or valid
//     file; the report never holds a parser message or any input slice.
//   Label contract (spec Requirement 8, Change Log 2026-11-20; task plan Step 5): a plain JSON syntax error in
//     either file is reported as "malformed JSON (syntax)" and never as "strict-parse failure"; a duplicate-key
//     rejection or a depth rejection (nesting over 32 levels) is reported as "strict-parse failure". Each label is
//     checked against the lines that name the one file (the file name is on the same line as its label), so a label
//     on the other file cannot satisfy it.
//
// Every project root is a temp directory with a .git directory.
//
// Run: node --test tests/hooks/health-check-strict-json.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const PLUGIN = fx.PLUGIN;

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_RULE_MODES = '{"sql-from-input":"blocking","other-rule":"advisory"}';
const VALID_PROFILE = '{"data_classes":{"student-record":["records/**"],"PHI":["data/patients*.csv"]}}';
const DUPLICATE_RULE_MODES = '{"rule_key_ZQX":"blocking","rule_key_ZQX":"advisory"}';
const DUPLICATE_PROFILE = '{"profile_key_ZQX":"value-ZQX-1","profile_key_ZQX":"value-ZQX-2"}';
const STRICT_PARSE = /strict-parse/i;
const STRICT_LABEL = /strict-parse failure/i;
const SYNTAX_LABEL = /malformed JSON \(syntax\)/i;

// files: {ruleModes, profile} -> text, or undefined for an absent file.
function projectWith(files) {
  const root = fx.tempRoot("health-strict-");
  if (files.ruleModes !== undefined) {
    fs.mkdirSync(path.join(root, ".agent", "governance"), { recursive: true });
    fs.writeFileSync(path.join(root, ".agent", "governance", "rule-modes.json"), files.ruleModes);
  }
  if (files.profile !== undefined) {
    fs.mkdirSync(path.join(root, ".agent", "governance"), { recursive: true });
    fs.writeFileSync(path.join(root, ".agent", "governance", "profile.json"), files.profile);
  }
  return root;
}

function runReport(root) {
  const env = fx.cleanEnv({
    CLAUDE_PROJECT_DIR: root,
    CLAUDE_PLUGIN_DATA: fx.tempDir("health-strict-data-"),
    CLAUDE_CONFIG_DIR: fx.tempDir("health-strict-user-"),
  });
  const result = childProcess.spawnSync(process.execPath, [path.join(PLUGIN, "hooks", "health-check.js")], {
    cwd: root,
    env: env,
    encoding: "utf8",
    timeout: 120000,
  });
  assert.strictEqual(result.status, 0, "the report command exits 0: " + result.stderr);
  return result.stdout;
}

// The report lines that name one file.
function linesNaming(out, fileName) {
  return out.split("\n").filter((line) => line.indexOf(fileName) !== -1);
}

// The lines that name `fileName` must exist, at least one must carry the `wanted` label, and none may carry the
// `unwanted` label.
function assertFileLabel(out, fileName, wanted, unwanted) {
  const own = linesNaming(out, fileName);
  assert.ok(own.length > 0, "no report line names " + fileName + ":\n" + out);
  assert.ok(own.some((line) => wanted.test(line)), "no line naming " + fileName + " carries " + wanted + ":\n" + own.join("\n"));
  own.forEach((line) => {
    assert.ok(!unwanted.test(line), "a line naming " + fileName + " carries " + unwanted + ": " + line);
  });
}

// ---------------------------------------------------------------------------
// AC-1: the report names a rejected file and the strict-parse failure
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-strict-json R8 | FR-249 | UR-069] a rule-modes.json rejected for a duplicate key is named in the report with the strict-parse failure", () => {
  const out = runReport(projectWith({ ruleModes: DUPLICATE_RULE_MODES }));
  assert.ok(out.indexOf("rule-modes.json") !== -1, "the file is named: " + out);
  assert.ok(STRICT_PARSE.test(out), "the strict-parse failure is named: " + out);
});

test("[AC-1 | spec-hooks-strict-json R8 | FR-249 | UR-069] the finding for a rejected rule-modes.json names the path under .agent/governance and the fixed reason code", () => {
  const out = runReport(projectWith({ ruleModes: DUPLICATE_RULE_MODES }));
  assert.ok(out.indexOf(".agent/governance/rule-modes.json") !== -1 || out.indexOf(path.join(".agent", "governance", "rule-modes.json")) !== -1, out);
  assert.ok(out.indexOf("duplicate-key") !== -1, "the fixed reason code is in the report: " + out);
});

test("[AC-1 | spec-hooks-strict-json R8 | FR-249 | UR-069] a rule-modes.json nested over 32 levels is named in the report with the strict-parse failure and the reason depth", () => {
  const deep = '{"r1":"blocking","extra":' + "[".repeat(32) + "]".repeat(32) + "}";
  const out = runReport(projectWith({ ruleModes: deep }));
  assert.ok(out.indexOf("rule-modes.json") !== -1, out);
  assert.ok(STRICT_PARSE.test(out), out);
  assert.ok(out.indexOf("depth") !== -1, out);
});

test("[AC-1 | spec-hooks-strict-json R8 | FR-249 | UR-069] the rule-modes.json finding says every rule runs advisory until the file is fixed", () => {
  const out = runReport(projectWith({ ruleModes: DUPLICATE_RULE_MODES }));
  assert.ok(/advisory/i.test(out), "the report says what the rejection does: " + out);
});

test("[AC-1 | spec-hooks-strict-json R8 | FR-249 | UR-069 | NFR-028] a profile.json rejected for a duplicate key is named in the report with the strict-parse failure", () => {
  const out = runReport(projectWith({ profile: DUPLICATE_PROFILE }));
  assert.ok(out.indexOf("profile.json") !== -1, "the file is named: " + out);
  assert.ok(STRICT_PARSE.test(out), "the strict-parse failure is named: " + out);
});

test("[AC-1 | spec-hooks-strict-json R8 | FR-249 | UR-069 | NFR-028] a profile.json nested over 32 levels is named in the report with the strict-parse failure", () => {
  const deep = '{"data_classes":{},"extra":' + "[".repeat(32) + "]".repeat(32) + "}";
  const out = runReport(projectWith({ profile: deep }));
  assert.ok(out.indexOf("profile.json") !== -1, out);
  assert.ok(STRICT_PARSE.test(out), out);
});

test("[AC-1 | spec-hooks-strict-json R8 | FR-249 | UR-069] when both files are rejected the report names both", () => {
  const out = runReport(projectWith({ ruleModes: DUPLICATE_RULE_MODES, profile: DUPLICATE_PROFILE }));
  assert.ok(out.indexOf("rule-modes.json") !== -1, out);
  assert.ok(out.indexOf("profile.json") !== -1, out);
  assert.ok(STRICT_PARSE.test(out), out);
});

test("[AC-1 | spec-hooks-strict-json R8 | FR-249 | UR-069] only the rejected file is named as a strict-parse failure: a rejected rule-modes.json with a clean profile.json does not blame the profile", () => {
  const out = runReport(projectWith({ ruleModes: DUPLICATE_RULE_MODES, profile: VALID_PROFILE }));
  assert.ok(out.indexOf("rule-modes.json") !== -1, out);
  out.split("\n").forEach((line) => {
    if (STRICT_PARSE.test(line)) {
      assert.ok(line.indexOf("profile.json") === -1, "a strict-parse line names profile.json: " + line);
    }
  });
});

test("[AC-1 | spec-hooks-strict-json R8 | FR-249 | UR-069] only the rejected file is named as a strict-parse failure: a rejected profile.json with a clean rule-modes.json does not blame the rule modes", () => {
  const out = runReport(projectWith({ ruleModes: VALID_RULE_MODES, profile: DUPLICATE_PROFILE }));
  assert.ok(out.indexOf("profile.json") !== -1, out);
  out.split("\n").forEach((line) => {
    if (STRICT_PARSE.test(line)) {
      assert.ok(line.indexOf("rule-modes.json") === -1, "a strict-parse line names rule-modes.json: " + line);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-2: no rejection, no finding
// ---------------------------------------------------------------------------

test("[AC-2 | spec-hooks-strict-json R8 | FR-249 | UR-069] both files parse cleanly: the report shows no strict-parse finding for either", () => {
  const out = runReport(projectWith({ ruleModes: VALID_RULE_MODES, profile: VALID_PROFILE }));
  assert.ok(!STRICT_PARSE.test(out), "unexpected strict-parse finding: " + out);
});

test("[AC-2 | spec-hooks-strict-json R8 | FR-249 | UR-069] an absent rule-modes.json gives no strict-parse finding", () => {
  const out = runReport(projectWith({ profile: VALID_PROFILE }));
  assert.ok(!STRICT_PARSE.test(out), "unexpected strict-parse finding: " + out);
});

test("[AC-2 | spec-hooks-strict-json R8 | FR-249 | UR-069] neither file present gives no strict-parse finding", () => {
  const out = runReport(projectWith({}));
  assert.ok(!STRICT_PARSE.test(out), "unexpected strict-parse finding: " + out);
});

test("[AC-2 | spec-hooks-strict-json R8 | FR-249 | UR-069] a valid rule-modes.json with sibling objects that repeat keys gives no strict-parse finding", () => {
  // Keys are tracked per object scope, so the same key in sibling objects is not a rejection.
  const out = runReport(projectWith({ ruleModes: '{"r1":"blocking","meta":{"a":1},"other":{"a":2}}', profile: VALID_PROFILE }));
  assert.ok(!STRICT_PARSE.test(out), "unexpected strict-parse finding: " + out);
});

test("[AC-2 | spec-hooks-strict-json R8 | FR-249 | UR-069] a plain syntax error in profile.json is not reported as a strict-parse failure", () => {
  // The existing profile-malformed code is unchanged for plain bad JSON (task plan, Step 3).
  const out = runReport(projectWith({ profile: "{ not json" }));
  assert.ok(out.indexOf("profile.json") !== -1, "the malformed file is still named: " + out);
  assert.ok(!STRICT_PARSE.test(out), "plain bad JSON must keep its own wording: " + out);
});

// ---------------------------------------------------------------------------
// AC-3 and AC-4: a syntax error is labeled apart from a strict-parse failure (Change Log 2026-11-20, Step 8)
// ---------------------------------------------------------------------------

// Plain JSON syntax errors: no duplicate key, nesting well under 33 levels.
const SYNTAX_ERRORS = [
  ["bare words", "{ not json"],
  ["a trailing comma", '{"data_classes":{},}'],
  ["an unclosed object", '{"data_classes":'],
  ["an unquoted value", '{"data_classes": notquoted}'],
  ["single quotes", "{'data_classes': {}}"],
];

// Rejections by the strict parser: a duplicate key at any depth, nesting over 32 levels (33 levels).
const STRICT_REJECTIONS = [
  ["a duplicate key at the top level", '{"data_classes":{},"data_classes":{}}'],
  ["a duplicate key in a nested object", '{"data_classes":{"a":1,"a":2}}'],
  ["nesting 33 levels deep (arrays)", "[".repeat(33) + "]".repeat(33)],
  ["nesting 33 levels deep (objects)", '{"a":'.repeat(32) + "{}" + "}".repeat(32)],
];

SYNTAX_ERRORS.forEach((row) => {
  test("[AC-3 | spec-hooks-strict-json R8 | FR-249 | UR-069] a profile.json with " + row[0] + " is labeled \"malformed JSON (syntax)\" on its own line and the report does not hold \"strict-parse failure\"", () => {
    const out = runReport(projectWith({ profile: row[1] }));
    assertFileLabel(out, "profile.json", SYNTAX_LABEL, STRICT_LABEL);
    assert.ok(!STRICT_LABEL.test(out), "the report holds the strict-parse label for a plain syntax error:\n" + out);
  });

  test("[AC-3 | spec-hooks-strict-json R8 | FR-249 | UR-069] a rule-modes.json with " + row[0] + " is labeled \"malformed JSON (syntax)\" on its own line, says every rule runs advisory, and the report does not hold \"strict-parse failure\"", () => {
    const out = runReport(projectWith({ ruleModes: row[1] }));
    assertFileLabel(out, "rule-modes.json", SYNTAX_LABEL, STRICT_LABEL);
    assert.ok(!STRICT_LABEL.test(out), "the report holds the strict-parse label for a plain syntax error:\n" + out);
    assert.ok(linesNaming(out, "rule-modes.json").some((line) => /advisory/i.test(line)), "the finding says what the rejection does:\n" + out);
  });
});

STRICT_REJECTIONS.forEach((row) => {
  test("[AC-4 | spec-hooks-strict-json R8 | FR-249 | UR-069] a profile.json with " + row[0] + " is labeled \"strict-parse failure\" on its own line and not \"malformed JSON (syntax)\"", () => {
    const out = runReport(projectWith({ profile: row[1] }));
    assertFileLabel(out, "profile.json", STRICT_LABEL, SYNTAX_LABEL);
  });

  test("[AC-4 | spec-hooks-strict-json R8 | FR-249 | UR-069] a rule-modes.json with " + row[0] + " is labeled \"strict-parse failure\" on its own line and not \"malformed JSON (syntax)\"", () => {
    const out = runReport(projectWith({ ruleModes: row[1] }));
    assertFileLabel(out, "rule-modes.json", STRICT_LABEL, SYNTAX_LABEL);
  });
});

test("[AC-3 and AC-4 | spec-hooks-strict-json R8 | FR-249 | UR-069] each file carries its own label: a profile.json syntax error next to a rule-modes.json duplicate key", () => {
  const out = runReport(projectWith({ profile: "{ not json", ruleModes: DUPLICATE_RULE_MODES }));
  assertFileLabel(out, "profile.json", SYNTAX_LABEL, STRICT_LABEL);
  assertFileLabel(out, "rule-modes.json", STRICT_LABEL, SYNTAX_LABEL);
});

test("[AC-3 and AC-4 | spec-hooks-strict-json R8 | FR-249 | UR-069] each file carries its own label: a profile.json duplicate key next to a rule-modes.json syntax error", () => {
  const out = runReport(projectWith({ profile: DUPLICATE_PROFILE, ruleModes: '{"r1":"blocking",}' }));
  assertFileLabel(out, "profile.json", STRICT_LABEL, SYNTAX_LABEL);
  assertFileLabel(out, "rule-modes.json", SYNTAX_LABEL, STRICT_LABEL);
});

test("[AC-3 | spec-hooks-strict-json R8 | FR-249 | UR-069] syntax errors in both files are both labeled \"malformed JSON (syntax)\" and the report holds no \"strict-parse failure\"", () => {
  const out = runReport(projectWith({ profile: "{ not json", ruleModes: "{ also not json" }));
  assertFileLabel(out, "profile.json", SYNTAX_LABEL, STRICT_LABEL);
  assertFileLabel(out, "rule-modes.json", SYNTAX_LABEL, STRICT_LABEL);
  assert.ok(!STRICT_LABEL.test(out), out);
});

test("[AC-4 | spec-hooks-strict-json R8 | FR-249 | UR-069] strict rejections of both files are both labeled \"strict-parse failure\" and neither is labeled \"malformed JSON (syntax)\"", () => {
  const out = runReport(projectWith({ profile: DUPLICATE_PROFILE, ruleModes: DUPLICATE_RULE_MODES }));
  assertFileLabel(out, "profile.json", STRICT_LABEL, SYNTAX_LABEL);
  assertFileLabel(out, "rule-modes.json", STRICT_LABEL, SYNTAX_LABEL);
  assert.ok(!SYNTAX_LABEL.test(out), out);
});

test("[AC-3 | spec-hooks-strict-json R8 | FR-249 | UR-069] a profile.json nested exactly 32 levels deep, with no duplicate key, is accepted by the parser: the report holds neither label", () => {
  const exactly32 = '{"a":'.repeat(31) + "{}" + "}".repeat(31);
  const out = runReport(projectWith({ profile: exactly32 }));
  assert.ok(!STRICT_LABEL.test(out), "depth 32 must not read as a strict-parse failure:\n" + out);
  assert.ok(!SYNTAX_LABEL.test(out), "depth 32 must not read as a syntax error:\n" + out);
});

test("[AC-3 | spec-hooks-strict-json R8 | FR-249 | UR-069] a rule-modes.json nested exactly 32 levels deep, with no duplicate key, is accepted by the parser: the report holds neither label", () => {
  const exactly32 = '{"a":'.repeat(31) + "{}" + "}".repeat(31);
  const out = runReport(projectWith({ ruleModes: exactly32 }));
  assert.ok(!STRICT_LABEL.test(out), "depth 32 must not read as a strict-parse failure:\n" + out);
  assert.ok(!SYNTAX_LABEL.test(out), "depth 32 must not read as a syntax error:\n" + out);
});

test("[AC-2 | spec-hooks-strict-json R8 | FR-249 | UR-069] clean files carry neither label", () => {
  const out = runReport(projectWith({ ruleModes: VALID_RULE_MODES, profile: VALID_PROFILE }));
  assert.ok(!STRICT_LABEL.test(out), out);
  assert.ok(!SYNTAX_LABEL.test(out), out);
});

test("[AC-3 | spec-hooks-strict-json R8 | FR-249 | UR-069] the syntax label clears once the file is fixed", () => {
  const root = projectWith({ profile: "{ not json", ruleModes: "{ not json" });
  const first = runReport(root);
  assert.ok(SYNTAX_LABEL.test(first), "set-up: the syntax error is reported:\n" + first);
  fs.writeFileSync(path.join(root, ".agent", "governance", "profile.json"), VALID_PROFILE);
  fs.writeFileSync(path.join(root, ".agent", "governance", "rule-modes.json"), VALID_RULE_MODES);
  const after = runReport(root);
  assert.ok(!SYNTAX_LABEL.test(after), "unexpected syntax label after the fix:\n" + after);
  assert.ok(!STRICT_LABEL.test(after), "unexpected strict-parse label after the fix:\n" + after);
});

// ---------------------------------------------------------------------------
// No echo of the rejected file (RULE-003, NFR-016)
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-strict-json R8 | FR-249 | NFR-016] the report holds no key name or value from a rejected rule-modes.json", () => {
  const out = runReport(projectWith({ ruleModes: '{"rule_key_ZQX":"secret-value-ZQX","rule_key_ZQX":"secret-value-ZQX-2"}' }));
  ["rule_key_ZQX", "secret-value-ZQX"].forEach((token) => {
    assert.ok(out.indexOf(token) === -1, token + " in the report: " + out);
  });
});

test("[AC-1 | spec-hooks-strict-json R8 | FR-249 | NFR-016] the report holds no key name or value from a rejected profile.json", () => {
  const out = runReport(projectWith({ profile: DUPLICATE_PROFILE }));
  ["profile_key_ZQX", "value-ZQX"].forEach((token) => {
    assert.ok(out.indexOf(token) === -1, token + " in the report: " + out);
  });
});

test("[AC-1 | spec-hooks-strict-json R8 | FR-249 | NFR-016] the report holds no input slice when a file is rejected for depth", () => {
  const deep = '{"secret_marker_ZQX":"secret-value-ZQX","extra":' + "[".repeat(32) + "]".repeat(32) + "}";
  const out = runReport(projectWith({ ruleModes: deep, profile: deep }));
  ["secret_marker_ZQX", "secret-value-ZQX"].forEach((token) => {
    assert.ok(out.indexOf(token) === -1, token + " in the report: " + out);
  });
});

test("[AC-1 | spec-hooks-strict-json R8 | FR-249 | NFR-016] the report holds no input slice when a file has a syntax error", () => {
  const out = runReport(projectWith({ ruleModes: '{"secret_marker_ZQX": secret-value-ZQX}', profile: '{"secret_marker_ZQX": secret-value-ZQX}' }));
  ["secret_marker_ZQX", "secret-value-ZQX"].forEach((token) => {
    assert.ok(out.indexOf(token) === -1, token + " in the report: " + out);
  });
});

// A parser message names a token, a position, or a quoted slice. Newer Node versions quote the input in the
// JSON.parse message, so these fragments are the leaks the report must never hold (NFR-016).
const PARSER_MESSAGE_FRAGMENTS = [
  /Unexpected (token|end|non-whitespace|character)/i,
  /not valid JSON/i,
  /JSON at position/i,
  /SyntaxError/,
  /JSON\.parse/,
  /at position \d+/i,
  /Expected (property|double|',')/i,
];

const LEAK_TOKENS = ["leak_key_QQ7", "leak_value_QQ7", "other_value_QQ7"];

const LEAK_TEXTS = [
  ["a trailing comma", '{"leak_key_QQ7":"leak_value_QQ7",}'],
  ["an unquoted value", '{"leak_key_QQ7": leak_value_QQ7}'],
  ["a duplicate key", '{"leak_key_QQ7":"leak_value_QQ7","leak_key_QQ7":"other_value_QQ7"}'],
  ["a depth rejection", '{"leak_key_QQ7":"leak_value_QQ7","x":' + "[".repeat(33) + "]".repeat(33) + "}"],
];

LEAK_TEXTS.forEach((row) => {
  ["profile", "ruleModes"].forEach((which) => {
    const fileName = which === "profile" ? "profile.json" : "rule-modes.json";
    test("[AC-3 and AC-4 | spec-hooks-strict-json R8 | FR-249 | UR-069 | NFR-016] a " + fileName + " rejected for " + row[0] + " leaks no key, value, or parser message into the report", () => {
      const files = {};
      files[which] = row[1];
      const out = runReport(projectWith(files));
      assert.ok(out.indexOf(fileName) !== -1, "the file is named:\n" + out);
      LEAK_TOKENS.forEach((token) => {
        assert.ok(out.indexOf(token) === -1, token + " in the report:\n" + out);
      });
      PARSER_MESSAGE_FRAGMENTS.forEach((fragment) => {
        assert.ok(!fragment.test(out), "parser message fragment " + fragment + " in the report:\n" + out);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// The report reads the files and changes nothing
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-strict-json R8 | FR-249 | UR-069] the report leaves a rejected rule-modes.json and profile.json as they were", () => {
  const root = projectWith({ ruleModes: DUPLICATE_RULE_MODES, profile: DUPLICATE_PROFILE });
  const ruleModesFile = path.join(root, ".agent", "governance", "rule-modes.json");
  const profileFile = path.join(root, ".agent", "governance", "profile.json");
  runReport(root);
  assert.strictEqual(fs.readFileSync(ruleModesFile, "utf8"), DUPLICATE_RULE_MODES);
  assert.strictEqual(fs.readFileSync(profileFile, "utf8"), DUPLICATE_PROFILE);
});

test("[AC-1 | spec-hooks-strict-json R8 | FR-249 | UR-069] the finding clears once the file is fixed", () => {
  const root = projectWith({ ruleModes: DUPLICATE_RULE_MODES });
  assert.ok(STRICT_PARSE.test(runReport(root)), "set-up: the rejection is reported");
  fs.writeFileSync(path.join(root, ".agent", "governance", "rule-modes.json"), VALID_RULE_MODES);
  const after = runReport(root);
  assert.ok(!STRICT_PARSE.test(after), "unexpected strict-parse finding after the fix: " + after);
});
