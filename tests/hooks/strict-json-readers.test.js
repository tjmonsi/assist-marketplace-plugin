// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the three readers that use the strict JSON parser (item 2, task plan step 7):
// parseRuleModes in plugins/assist-plugin/hooks/lib/severity.js (rule-modes.json), the profile reader in
// plugins/assist-plugin/hooks/lib/data-class.js (profile.json), and the record reader in
// plugins/assist-plugin/hooks/lib/confirmation-store.js (confirmations.jsonl), plus the regression that every
// other reader keeps JSON.parse, plus the 1 MiB read cap of the record reader.
//
// Sources: specs/spec-hooks-strict-json.md (Requirement 5: The rule-mode reader routes a rejection to
// all-advisory; Requirement 6: The profile reader denies guarded operations on a rejection; Requirement 7: The
// confirmation-store reader drops a rejected record, and its Change Log 2026-11-20 entry, which adds the 1 MiB
// cap and the Scenarios "Confirmation store over the size cap" and "Confirmation store at or under the cap
// unchanged"; Requirement 9: Other JSON.parse readers keep JSON.parse this release; RULE-004),
// docs/requirements/FR-NFR-harness-governance.md (FR-248, FR-249, FR-231, NFR-028),
// docs/requirements/URD-harness-governance.md (UR-059, UR-068, UR-069, UR-071). Task plan:
// docs/task-plans/task-plan-assist-pi-backport-20261120-0314.md, Steps 2, 3, 4, and 7.
//
// Traceability format: [AC-N | spec-hooks-strict-json R<n> | FR-nnn | UR-nnn | NFR-nnn]. The spec carries no
// SPEC-NNN id, so it is cited by file name. AC-N is the position of the Scenario inside its Requirement, counting
// the body Scenarios first and the Change Log 2026-11-20 Scenarios after them:
//   R5: AC-1 Duplicate key in rule-modes.json, AC-2 Valid rule-modes.json unchanged
//   R6: AC-1 Duplicate key in profile.json
//   R7: AC-1 Rejected confirmation record, AC-2 Confirmation store over the size cap,
//       AC-3 Confirmation store at or under the cap unchanged
//   R9: AC-1 Other readers untouched
// A case that goes beyond a named Scenario (a boundary the plan implies) carries the Requirement and no AC-N.
//
// Public interface used (module exports; the task plan, Steps 2 to 5, and the header contracts of the libraries):
//   severity.parseRuleModes(text) -> a rule-mode map; severity.modeOf(modes, ruleId) -> "advisory" | "blocking"
//   ruleModeStore.status(root)    -> {state: "absent" | "valid" | "rejected" | "unreadable", reason}; never throws
//   dataClass.loadProfile({root}) -> {status: "absent" | "valid" | "malformed", profile, problem}; a strict
//     duplicate-key or depth rejection gives status "malformed" and problem "profile-strict-parse"; a plain syntax
//     error keeps problem "profile-malformed"
//   dataClass.deniesTaggedOps({root}), dataClass.classify(file, {root}), dataClass.profileState({root})
//   confirmationStore.recordConfirmation({pr, verdict, userMessageRef}, {root, now}),
//     readConfirmations({root}) -> records, findConfirmation(pr, verdict, {root}) -> record or null,
//     createPending({pr, verdict, sessionId}, {root, now}) -> record, findPending(token, sessionId, {root, now})
//   hooks/impl/pr-verdict-guard.js evaluate(input, {root}) -> {deny, reason}; `deny === true` blocks
//     (as tests/hooks/pr-verdict-guard.test.js drives it), and the command `node hooks/pr-verdict-guard.js`
//     (PreToolUse JSON on stdin, deny JSON on stdout, exit 0)
//   hooks/phi-outbound-guard.js (PreToolUse) run as a process through tests/fixtures/audit/chain-fixture.js
//
// Every project root is a temp directory with a .git directory. The oversize confirmation files are built at run
// time (blank-line padding around valid records) and are never committed.
//
// Run: node --test tests/hooks/strict-json-readers.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const PLUGIN = fx.PLUGIN;
const severity = require(path.join(PLUGIN, "hooks", "lib", "severity.js"));
const ruleModeStore = require(path.join(PLUGIN, "hooks", "lib", "rule-mode-store.js"));
const dataClass = require(path.join(PLUGIN, "hooks", "lib", "data-class.js"));
const confirmationStore = require(path.join(PLUGIN, "hooks", "lib", "confirmation-store.js"));
const guard = require(path.join(PLUGIN, "hooks", "impl", "pr-verdict-guard.js"));

const FLAG = dataClass.FLAG_NAME;
const T0 = 1700000000000;

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nestArrays(n) {
  return "[".repeat(n) + "]".repeat(n);
}

function writeFile(root, relative, text) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof text === "string" ? text : JSON.stringify(text));
  return file;
}

function at(ms) {
  return function () {
    return ms;
  };
}

function preToolUse(root, tool, toolInput) {
  return { hook_event_name: "PreToolUse", session_id: "sess-sj-1", tool_name: tool, tool_input: toolInput, cwd: root };
}

function isDeny(res) {
  const out = res.stdout.trim();
  if (out === "") return false;
  try {
    const parsed = JSON.parse(out);
    return !!(parsed.hookSpecificOutput && parsed.hookSpecificOutput.permissionDecision === "deny");
  } catch (err) {
    return false;
  }
}

function withProcessEnv(value, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, FLAG);
  const previous = process.env[FLAG];
  if (value === undefined) delete process.env[FLAG];
  else process.env[FLAG] = value;
  try {
    return fn();
  } finally {
    if (had) process.env[FLAG] = previous;
    else delete process.env[FLAG];
  }
}

// ---------------------------------------------------------------------------
// Requirement 5: the rule-mode reader routes a rejection to all-advisory
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-strict-json R5 | FR-249 | UR-068] a rule-modes text with a duplicate key gives every rule advisory, including a rule marked blocking elsewhere in the text", () => {
  // Without the strict parser, JSON.parse would let the later "blocking" win for r1 and keep r2 blocking.
  const text = '{"r1":"advisory","r2":"blocking","r1":"blocking"}';
  const modes = severity.parseRuleModes(text);
  ["r1", "r2", "r3", "not-in-store"].forEach((rule) => {
    assert.strictEqual(severity.modeOf(modes, rule), "advisory", "rule " + rule);
  });
});

test("[AC-1 | spec-hooks-strict-json R5 | FR-249 | UR-068] a duplicate key repeated with the same value still gives every rule advisory", () => {
  const modes = severity.parseRuleModes('{"r1":"blocking","r1":"blocking","r2":"blocking"}');
  ["r1", "r2"].forEach((rule) => assert.strictEqual(severity.modeOf(modes, rule), "advisory", rule));
});

test("[AC-1 | spec-hooks-strict-json R5 | FR-249 | UR-068] a duplicate key in a nested object of the text gives every rule advisory", () => {
  const modes = severity.parseRuleModes('{"r1":"blocking","meta":{"a":1,"a":2}}');
  assert.strictEqual(severity.modeOf(modes, "r1"), "advisory");
});

test("[AC-1 | spec-hooks-strict-json R5 | FR-249 | UR-068] a rule-modes text nested over 32 levels gives every rule advisory", () => {
  const modes = severity.parseRuleModes('{"r1":"blocking","extra":' + nestArrays(32) + "}");
  assert.strictEqual(severity.modeOf(modes, "r1"), "advisory");
});

test("[AC-1 | spec-hooks-strict-json R5 | FR-249 | UR-068] parseRuleModes never throws on a rejected text and adds no new state: the map still answers modeOf", () => {
  ['{"r1":"blocking","r1":"blocking"}', '{"a":1,"a":2}', nestArrays(40), '{"r1":"blocking"'].forEach((text) => {
    let modes;
    assert.doesNotThrow(() => {
      modes = severity.parseRuleModes(text);
    }, "text " + text.slice(0, 40));
    assert.strictEqual(severity.modeOf(modes, "r1"), "advisory");
  });
});

test("[AC-1 | spec-hooks-strict-json R5 | FR-249 | UR-068] the all-advisory result for a duplicate key matches the result for any other malformed text", () => {
  const rejected = severity.parseRuleModes('{"r1":"blocking","r1":"blocking"}');
  const malformed = severity.parseRuleModes('{"r1":"blocking"');
  ["r1", "r2", "anything"].forEach((rule) => {
    assert.strictEqual(severity.modeOf(rejected, rule), severity.modeOf(malformed, rule), rule);
  });
});

test("[AC-2 | spec-hooks-strict-json R5 | FR-249 | UR-068] a valid duplicate-free rule-modes text reads as before: blocking stays blocking, advisory stays advisory", () => {
  const modes = severity.parseRuleModes('{"sql-from-input":"blocking","other-rule":"advisory"}');
  assert.strictEqual(severity.modeOf(modes, "sql-from-input"), "blocking");
  assert.strictEqual(severity.modeOf(modes, "other-rule"), "advisory");
  assert.strictEqual(severity.modeOf(modes, "not-in-store"), "advisory");
});

test("[AC-2 | spec-hooks-strict-json R5 | FR-249 | UR-068] a valid rule-modes text with whitespace and many rules reads as before", () => {
  const rules = {};
  for (let i = 0; i < 200; i++) rules["rule-" + i] = i % 2 === 0 ? "blocking" : "advisory";
  const modes = severity.parseRuleModes(JSON.stringify(rules, null, 2));
  for (let i = 0; i < 200; i++) {
    assert.strictEqual(severity.modeOf(modes, "rule-" + i), i % 2 === 0 ? "blocking" : "advisory", "rule-" + i);
  }
});

test("[AC-2 | spec-hooks-strict-json R5 | FR-249 | UR-068] an absent or empty rule-modes text reads advisory as before", () => {
  [undefined, null, ""].forEach((text) => {
    assert.strictEqual(severity.modeOf(severity.parseRuleModes(text), "r1"), "advisory", String(text));
  });
});

// The store status feeds the health check (Requirement 8); the file route is the same malformed-file path.

function ruleModesRoot(text) {
  const root = fx.tempRoot("strict-readers-rm-");
  if (text !== undefined) writeFile(root, ".agent/governance/rule-modes.json", text);
  return root;
}

test("[AC-1 | spec-hooks-strict-json R5 and R8 | FR-249 | UR-068 | UR-069] the rule-mode store status of a duplicate-key file is rejected with the fixed reason duplicate-key", () => {
  const root = ruleModesRoot('{"api_key_ZQX":"blocking","api_key_ZQX":"advisory"}');
  const status = ruleModeStore.status(root);
  assert.strictEqual(status.state, "rejected", JSON.stringify(status));
  assert.strictEqual(status.reason, "duplicate-key");
  assert.ok(JSON.stringify(status).indexOf("api_key_ZQX") === -1, "the status holds no key name: " + JSON.stringify(status));
});

test("[AC-1 | spec-hooks-strict-json R5 and R8 | FR-249 | UR-068 | UR-069] the rule-mode store status of a file nested over 32 levels is rejected with the fixed reason depth", () => {
  const status = ruleModeStore.status(ruleModesRoot('{"r1":"blocking","extra":' + nestArrays(32) + "}"));
  assert.strictEqual(status.state, "rejected", JSON.stringify(status));
  assert.strictEqual(status.reason, "depth");
});

test("[AC-1 | spec-hooks-strict-json R5 and R8 | FR-249 | UR-069] the rule-mode store status of a file with a syntax error is rejected", () => {
  const status = ruleModeStore.status(ruleModesRoot("{ not json SECRET-RM-TEXT"));
  assert.strictEqual(status.state, "rejected", JSON.stringify(status));
  assert.ok(JSON.stringify(status).indexOf("SECRET-RM-TEXT") === -1, JSON.stringify(status));
});

test("[AC-2 | spec-hooks-strict-json R5 and R8 | FR-249 | UR-069] the rule-mode store status of a valid duplicate-free file is valid", () => {
  const status = ruleModeStore.status(ruleModesRoot('{"sql-from-input":"blocking","other-rule":"advisory"}'));
  assert.strictEqual(status.state, "valid", JSON.stringify(status));
});

test("[AC-2 | spec-hooks-strict-json R5 and R8 | FR-249 | UR-069] the rule-mode store status of an absent file is absent, not rejected", () => {
  const status = ruleModeStore.status(ruleModesRoot(undefined));
  assert.strictEqual(status.state, "absent", JSON.stringify(status));
});

test("[spec-hooks-strict-json R5 and R8 | FR-249 | UR-069] the rule-mode store status never throws, even when the file is a directory", () => {
  const root = ruleModesRoot(undefined);
  fs.mkdirSync(path.join(root, ".agent", "governance", "rule-modes.json"), { recursive: true });
  let status;
  assert.doesNotThrow(() => {
    status = ruleModeStore.status(root);
  });
  assert.notStrictEqual(status.state, "valid");
  assert.notStrictEqual(status.state, "rejected", "an unreadable file is not a strict-parse rejection: " + JSON.stringify(status));
});

// ---------------------------------------------------------------------------
// Requirement 6: the profile reader denies guarded operations on a rejection
// ---------------------------------------------------------------------------

const TAGS = { data_classes: { "student-record": ["records/**"], PHI: ["data/patients*.csv"] } };

function profileRoot(profile, settings) {
  const root = fx.tempRoot("strict-readers-profile-");
  if (profile !== undefined) writeFile(root, ".agent/governance/profile.json", profile);
  if (settings !== undefined) writeFile(root, ".claude/settings.json", settings);
  return root;
}

[
  ["a duplicate key at the top level", '{"data_classes":{"student-record":["records/**"]},"data_classes":{"PHI":["data/p*.csv"]}}'],
  ["a duplicate key inside data_classes", '{"data_classes":{"PHI":["data/a*.csv"],"PHI":["data/b*.csv"]}}'],
  ["a duplicate key in an unrelated nested object", '{"data_classes":{"PHI":["data/a*.csv"]},"note":{"a":1,"a":2}}'],
  ["nesting over 32 levels", '{"data_classes":{"PHI":["data/a*.csv"]},"note":' + nestArrays(32) + "}"],
].forEach((row) => {
  test("[AC-1 | spec-hooks-strict-json R6 | FR-249 | FR-231 | UR-068 | UR-069 | NFR-028] profile.json with " + row[0] + ": loadProfile is malformed with the problem profile-strict-parse and the guarded tagged-path operations deny", () => {
    const root = profileRoot(row[1]);
    const loaded = dataClass.loadProfile({ root: root });
    assert.strictEqual(loaded.status, "malformed", JSON.stringify(loaded));
    assert.strictEqual(loaded.problem, "profile-strict-parse", JSON.stringify(loaded));
    assert.strictEqual(dataClass.deniesTaggedOps({ root: root }), true);
    assert.strictEqual(dataClass.classify("data/a1.csv", { root: root }), "untagged");
  });
});

test("[AC-1 | spec-hooks-strict-json R6 | FR-249 | FR-231 | NFR-028] a duplicate-key profile.json with HIPAA and FERPA enforced makes the PHI outbound guard deny a covered call, and ls still passes", () => {
  const root = profileRoot('{"data_classes":{"PHI":["data/a*.csv"]},"data_classes":{"PHI":["data/b*.csv"]}}');
  const post = fx.runHook("phi-outbound-guard", preToolUse(root, "Bash", { command: "gh pr comment 42 --body 'Looks good'" }));
  assert.strictEqual(post.status, 0, post.stderr);
  assert.ok(isDeny(post), "expected a deny; stdout: " + post.stdout);
  const ls = fx.runHook("phi-outbound-guard", preToolUse(root, "Bash", { command: "ls" }));
  assert.ok(!isDeny(ls), ls.stdout);
});

test("[AC-1 | spec-hooks-strict-json R6 | FR-249 | FR-231 | NFR-028] the deny of a duplicate-key profile.json lasts until the file is fixed, then tagging resumes", () => {
  const root = profileRoot('{"data_classes":{"PHI":["x/**"]},"data_classes":{"PHI":["y/**"]}}');
  assert.strictEqual(dataClass.deniesTaggedOps({ root: root }), true);
  writeFile(root, ".agent/governance/profile.json", TAGS);
  assert.strictEqual(dataClass.deniesTaggedOps({ root: root }), false);
  assert.strictEqual(dataClass.loadProfile({ root: root }).status, "valid");
  assert.strictEqual(dataClass.classify("records/grades.csv", { root: root }), "student-record");
});

test("[AC-1 | spec-hooks-strict-json R6 | FR-249 | FR-231 | NFR-028] a duplicate-key profile.json does not deny when no profile is enforced (FERPA and HIPAA both opted out)", () => {
  const settings = { env: {} };
  settings.env[FLAG] = "ferpa,hipaa";
  const root = profileRoot('{"data_classes":{"PHI":["x/**"]},"data_classes":{"PHI":["y/**"]}}', settings);
  withProcessEnv(undefined, () => {
    assert.strictEqual(dataClass.deniesTaggedOps({ root: root }), false);
  });
});

test("[AC-1 | spec-hooks-strict-json R6 | FR-249 | NFR-016 | NFR-028] the loadProfile result of a rejected profile.json holds no key name or value from the file", () => {
  const root = profileRoot('{"phi_patterns":["SECRET-PROFILE-VALUE-7"],"phi_patterns":["SECRET-PROFILE-VALUE-8"],"secret_key_name_7":1}');
  const loaded = dataClass.loadProfile({ root: root });
  assert.strictEqual(loaded.status, "malformed");
  const shown = JSON.stringify(loaded);
  ["SECRET-PROFILE-VALUE", "phi_patterns", "secret_key_name_7"].forEach((token) => {
    assert.ok(shown.indexOf(token) === -1, token + " in " + shown);
  });
});

test("[AC-1 | spec-hooks-strict-json R6 | FR-249 | FR-231] a rejected profile.json adds no new status: the status stays the existing malformed", () => {
  const root = profileRoot('{"a":1,"a":2}');
  const loaded = dataClass.loadProfile({ root: root });
  assert.ok(["absent", "valid", "malformed"].indexOf(loaded.status) !== -1);
  assert.strictEqual(loaded.status, "malformed");
});

test("[spec-hooks-strict-json R6 | FR-249 | FR-231 | NFR-028] a plain syntax error in profile.json keeps the existing problem profile-malformed and still denies", () => {
  const root = profileRoot("{ not json");
  const loaded = dataClass.loadProfile({ root: root });
  assert.strictEqual(loaded.status, "malformed");
  assert.strictEqual(loaded.problem, "profile-malformed", JSON.stringify(loaded));
  assert.strictEqual(dataClass.deniesTaggedOps({ root: root }), true);
});

test("[spec-hooks-strict-json R6 | FR-249 | FR-231 | NFR-028] other plain syntax errors in profile.json (empty file, trailing comma, unclosed object) keep problem profile-malformed", () => {
  ["", '{"data_classes":{},}', '{"data_classes":'].forEach((text) => {
    const loaded = dataClass.loadProfile({ root: profileRoot(text) });
    assert.strictEqual(loaded.status, "malformed", JSON.stringify(text));
    assert.strictEqual(loaded.problem, "profile-malformed", JSON.stringify(text));
  });
});

test("[AC-1 | spec-hooks-strict-json R6 | FR-249 | FR-231] a valid duplicate-free profile.json reads as before: valid, tagged, and no deny", () => {
  const root = profileRoot(TAGS);
  const loaded = dataClass.loadProfile({ root: root });
  assert.strictEqual(loaded.status, "valid", JSON.stringify(loaded));
  assert.strictEqual(dataClass.classify("records/grades.csv", { root: root }), "student-record");
  assert.strictEqual(dataClass.classify("data/patients1.csv", { root: root }), "PHI");
  assert.strictEqual(dataClass.deniesTaggedOps({ root: root }), false);
});

test("[AC-1 | spec-hooks-strict-json R6 | FR-249 | FR-231] a valid profile.json whose sibling objects repeat the same keys reads as before", () => {
  // Keys are tracked per object scope: two systems that both hold the keys name and hosts are not duplicates.
  const profile = Object.assign({}, TAGS, {
    external_systems: [
      { name: "model-provider", hosts: ["api.anthropic.com"] },
      { name: "github", hosts: ["github.com"] },
    ],
  });
  const root = profileRoot(profile);
  assert.strictEqual(dataClass.loadProfile({ root: root }).status, "valid");
  assert.strictEqual(dataClass.deniesTaggedOps({ root: root }), false);
});

test("[spec-hooks-strict-json R6 | FR-249 | FR-231] an absent profile.json is still absent and does not deny", () => {
  const root = profileRoot(undefined);
  assert.strictEqual(dataClass.loadProfile({ root: root }).status, "absent");
  assert.strictEqual(dataClass.deniesTaggedOps({ root: root }), false);
});

// ---------------------------------------------------------------------------
// Requirement 7: the confirmation-store reader drops a rejected record
// ---------------------------------------------------------------------------

function confirmationsFile(root) {
  return path.join(root, ".agent", "governance", "confirmations", "confirmations.jsonl");
}

function pendingFile(root) {
  return path.join(root, ".agent", "governance", "confirmations", "pending.jsonl");
}

// The text of one valid confirmation line, written by the store itself in a scratch root.
function validLine(pr, verdict) {
  const scratch = fx.tempRoot("strict-readers-line-");
  confirmationStore.recordConfirmation({ pr: pr, verdict: verdict, userMessageRef: "sess-1:1700000000123" }, { root: scratch, now: at(T0) });
  const lines = fs.readFileSync(confirmationsFile(scratch), "utf8").split("\n").filter((l) => l.trim() !== "");
  assert.strictEqual(lines.length, 1);
  return lines[0];
}

// The same record with a repeated pr key added at the end: JSON.parse reads it, the strict parser rejects it.
function duplicateKeyLine(pr, verdict) {
  const line = validLine(pr, verdict);
  assert.ok(line.charAt(line.length - 1) === "}", "set-up: the stored line is one JSON object");
  return line.slice(0, -1) + ',"pr":' + JSON.stringify(pr) + "}";
}

function confirmationsRoot(lines) {
  const root = fx.tempRoot("strict-readers-conf-");
  fs.mkdirSync(path.dirname(confirmationsFile(root)), { recursive: true });
  fs.writeFileSync(confirmationsFile(root), lines.join("\n") + "\n");
  return root;
}

test("[AC-1 | spec-hooks-strict-json R7 | FR-249 | UR-059] a confirmations file with one duplicate-key record and one valid record: the rejected record is ignored and the valid record is read", () => {
  const root = confirmationsRoot([duplicateKeyLine(77, "approve"), validLine(5, "decline")]);
  assert.ok(!confirmationStore.findConfirmation(77, "approve", { root: root }), "the rejected record confirms nothing");
  assert.ok(confirmationStore.findConfirmation(5, "decline", { root: root }), "the valid record is still read");
  const all = confirmationStore.readConfirmations({ root: root });
  assert.deepStrictEqual(all.map((r) => String(r.pr)), ["5"]);
});

test("[AC-1 | spec-hooks-strict-json R7 | FR-249 | UR-059] the order does not matter: a valid record before the rejected record and another valid record after it are all read around it", () => {
  const root = confirmationsRoot([validLine(1, "approve"), duplicateKeyLine(77, "approve"), validLine(2, "decline")]);
  const all = confirmationStore.readConfirmations({ root: root });
  assert.deepStrictEqual(all.map((r) => String(r.pr)), ["1", "2"]);
  assert.ok(!confirmationStore.findConfirmation(77, "approve", { root: root }));
});

test("[AC-1 | spec-hooks-strict-json R7 | FR-249 | UR-059] a rejected record is dropped exactly as an unparseable line is dropped", () => {
  const withGarbage = confirmationsRoot(["{ not json", validLine(5, "decline")]);
  const withDuplicate = confirmationsRoot([duplicateKeyLine(77, "approve"), validLine(5, "decline")]);
  assert.deepStrictEqual(
    confirmationStore.readConfirmations({ root: withDuplicate }).map((r) => String(r.pr)),
    confirmationStore.readConfirmations({ root: withGarbage }).map((r) => String(r.pr))
  );
});

test("[AC-1 | spec-hooks-strict-json R7 | FR-249 | UR-059] a record with a duplicate key inside a nested field is dropped", () => {
  const line = validLine(77, "approve");
  const nested = line.slice(0, -1) + ',"extra":{"a":1,"a":2}}';
  const root = confirmationsRoot([nested, validLine(5, "decline")]);
  assert.ok(!confirmationStore.findConfirmation(77, "approve", { root: root }));
  assert.ok(confirmationStore.findConfirmation(5, "decline", { root: root }));
});

test("[spec-hooks-strict-json R7 | FR-249 | UR-059] a record nested over 32 levels is dropped", () => {
  const line = validLine(77, "approve");
  const deep = line.slice(0, -1) + ',"extra":' + nestArrays(33) + "}";
  const root = confirmationsRoot([deep, validLine(5, "decline")]);
  assert.ok(!confirmationStore.findConfirmation(77, "approve", { root: root }));
  assert.ok(confirmationStore.findConfirmation(5, "decline", { root: root }));
});

test("[spec-hooks-strict-json R7 | FR-249 | UR-059] a file of only rejected records reads as no confirmation and does not throw", () => {
  const root = confirmationsRoot([duplicateKeyLine(77, "approve"), duplicateKeyLine(78, "decline")]);
  let all;
  assert.doesNotThrow(() => {
    all = confirmationStore.readConfirmations({ root: root });
  });
  assert.deepStrictEqual(all, []);
  assert.ok(!confirmationStore.findConfirmation(77, "approve", { root: root }));
  assert.ok(!confirmationStore.findConfirmation(78, "decline", { root: root }));
});

test("[AC-1 | spec-hooks-strict-json R7 | FR-249 | UR-059] valid confirmation records read as before when the file holds no duplicate key", () => {
  const root = fx.tempRoot("strict-readers-conf-ok-");
  confirmationStore.recordConfirmation({ pr: 1, verdict: "approve", userMessageRef: "s:1" }, { root: root, now: at(T0) });
  confirmationStore.recordConfirmation({ pr: 2, verdict: "decline", userMessageRef: "s:2" }, { root: root, now: at(T0 + 1000) });
  const all = confirmationStore.readConfirmations({ root: root });
  assert.deepStrictEqual(all.map((r) => String(r.pr)), ["1", "2"]);
  assert.ok(confirmationStore.findConfirmation(1, "approve", { root: root }));
  assert.ok(confirmationStore.findConfirmation(2, "decline", { root: root }));
});

test("[spec-hooks-strict-json R7 | FR-249 | UR-059] a pending record with a duplicate key is dropped like an unparseable line and is not found", () => {
  // The task plan (Step 4) puts the pending file inside the record reader: it shares the line parser.
  const root = fx.tempRoot("strict-readers-pending-");
  const rec = confirmationStore.createPending({ pr: 42, verdict: "approve", sessionId: "sess-1" }, { root: root, now: at(T0) });
  assert.ok(confirmationStore.findPending(rec.token, "sess-1", { root: root, now: at(T0 + 1000) }), "set-up: the valid pending record is found");
  const raw = fs.readFileSync(pendingFile(root), "utf8").split("\n").filter((l) => l.trim() !== "");
  assert.strictEqual(raw.length, 1);
  fs.writeFileSync(pendingFile(root), raw[0].slice(0, -1) + ',"pr":' + JSON.stringify(rec.pr) + "}\n");
  assert.ok(!confirmationStore.findPending(rec.token, "sess-1", { root: root, now: at(T0 + 1000) }));
});

// ---------------------------------------------------------------------------
// Requirement 7, Change Log 2026-11-20: the 1 MiB read cap (task plan Step 4 and Step 7)
//
// A confirmations.jsonl larger than 1 MiB (1024 * 1024 bytes) yields no records, so the fail-closed PR-verdict
// guard finds no confirmation for the PR and verdict and denies the verdict post. A file of 1 MiB or less is read
// as before. Every large file is built at run time: valid records plus blank-line padding, so only the size is
// over the cap and each record on its own is valid.
// ---------------------------------------------------------------------------

const CAP = 1024 * 1024;

// Writes `lines` and blank-line padding to `file` so the file holds exactly `size` bytes. The padding sits after
// the records, or before them when `padFirst` is true.
function writeSized(file, lines, size, padFirst) {
  const body = lines.join("\n") + "\n";
  const bodyBytes = Buffer.byteLength(body);
  assert.ok(bodyBytes <= size, "set-up: the records (" + bodyBytes + " bytes) fit in " + size + " bytes");
  const pad = "\n".repeat(size - bodyBytes);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, padFirst ? pad + body : body + pad);
  assert.strictEqual(fs.statSync(file).size, size, "set-up: the file holds exactly " + size + " bytes");
}

function sizedRoot(lines, size, padFirst) {
  const root = fx.tempRoot("strict-readers-cap-");
  writeSized(confirmationsFile(root), lines, size, padFirst);
  return root;
}

function verdictDoc(root, command) {
  return { hook_event_name: "PreToolUse", session_id: "sess-cap-1", tool_name: "Bash", tool_input: { command: command }, cwd: root };
}

function guardResult(root, command) {
  return guard.evaluate(verdictDoc(root, command), { root: root });
}

function guardDenies(root, command) {
  const result = guardResult(root, command);
  return !!(result && result.deny === true);
}

// The command entry: PreToolUse JSON on stdin, deny JSON on stdout, exit 0.
function guardEntryDenies(root, command) {
  const res = fx.runHook("pr-verdict-guard", verdictDoc(root, command), { cwd: root });
  assert.strictEqual(res.status, 0, "exit 0; stderr: " + res.stderr);
  return isDeny(res);
}

function prList(root) {
  return confirmationStore.readConfirmations({ root: root }).map((r) => String(r.pr));
}

[CAP + 1, CAP + 4096, 2 * CAP].forEach((size) => {
  [false, true].forEach((padFirst) => {
    test("[AC-2 | spec-hooks-strict-json R7 | FR-249 | UR-059 | NFR-028] a confirmations.jsonl of " + size + " bytes (" + (size - CAP) + " over the 1 MiB cap, blank-line padding " + (padFirst ? "before" : "after") + " one valid record) yields no records, finds no confirmation, and the guard denies the verdict post", () => {
      const root = sizedRoot([validLine(42, "approve")], size, padFirst);
      let records;
      assert.doesNotThrow(() => {
        records = confirmationStore.readConfirmations({ root: root });
      });
      assert.deepStrictEqual(records, []);
      assert.ok(!confirmationStore.findConfirmation(42, "approve", { root: root }), "no confirmation is found for PR 42 and approve");
      const result = guardResult(root, "gh pr review 42 --approve");
      assert.strictEqual(result.deny, true, "expected a deny: " + JSON.stringify(result));
      assert.ok(/confirm/i.test(String(result.reason)), "the denial names the missing confirmation: " + result.reason);
      assert.strictEqual(fs.statSync(confirmationsFile(root)).size, size, "reading leaves the file as it was");
    });
  });
});

test("[AC-2 | spec-hooks-strict-json R7 | FR-249 | UR-059 | NFR-028] an over-cap store holding a duplicate-key record and a valid record yields no records, and the guard denies the verdict post of the valid record", () => {
  const root = sizedRoot([duplicateKeyLine(77, "approve"), validLine(5, "approve")], CAP + 1, false);
  assert.deepStrictEqual(confirmationStore.readConfirmations({ root: root }), []);
  assert.strictEqual(guardDenies(root, "gh pr review 5 --approve"), true);
  assert.strictEqual(guardDenies(root, "gh pr review 77 --approve"), true);
});

test("[AC-2 | spec-hooks-strict-json R7 | FR-249 | UR-059 | NFR-028] an over-cap store denies every verdict form: gh pr review with --request-changes and bkt pr decline for the recorded PR", () => {
  const root = sizedRoot([validLine(42, "approve"), validLine(42, "decline")], CAP + 1, false);
  assert.strictEqual(guardDenies(root, "gh pr review 42 --approve"), true);
  assert.strictEqual(guardDenies(root, "gh pr review 42 --request-changes"), true);
  assert.strictEqual(guardDenies(root, "bkt pr decline 42"), true);
});

test("[AC-2 | spec-hooks-strict-json R7 | FR-249 | UR-059 | NFR-028] the command entry of the PR-verdict guard prints the deny JSON for an over-cap store, and no deny for the same record inside the cap", () => {
  const record = validLine(42, "approve");
  assert.strictEqual(guardEntryDenies(sizedRoot([record], CAP + 1, false), "gh pr review 42 --approve"), true);
  assert.strictEqual(guardEntryDenies(sizedRoot([record], CAP, false), "gh pr review 42 --approve"), false);
});

test("[AC-2 and AC-3 | spec-hooks-strict-json R7 | FR-249 | UR-059 | NFR-028] one byte decides: the same valid record is read at 1 MiB minus one byte and at 1 MiB, ignored at 1 MiB plus one byte, and read again once the file is back at 1 MiB", () => {
  const root = fx.tempRoot("strict-readers-cap-edge-");
  const file = confirmationsFile(root);
  const record = validLine(42, "approve");
  writeSized(file, [record], CAP - 1, false);
  assert.deepStrictEqual(prList(root), ["42"], "1 MiB minus one byte is read");
  writeSized(file, [record], CAP, false);
  assert.deepStrictEqual(prList(root), ["42"], "exactly 1 MiB is read");
  assert.strictEqual(guardDenies(root, "gh pr review 42 --approve"), false, "exactly 1 MiB: the guard accepts the matching verdict");
  writeSized(file, [record], CAP + 1, false);
  assert.deepStrictEqual(prList(root), [], "1 MiB plus one byte yields no records");
  assert.strictEqual(guardDenies(root, "gh pr review 42 --approve"), true, "1 MiB plus one byte: the guard denies");
  writeSized(file, [record], CAP, false);
  assert.deepStrictEqual(prList(root), ["42"], "the denial lasts only while the file is over the cap");
  assert.strictEqual(guardDenies(root, "gh pr review 42 --approve"), false);
});

[CAP - 1, CAP].forEach((size) => {
  [false, true].forEach((padFirst) => {
    test("[AC-3 | spec-hooks-strict-json R7 | FR-249 | UR-059] a " + size + " byte confirmations.jsonl (" + (size === CAP ? "exactly the cap" : "one byte under the cap") + ", padding " + (padFirst ? "before" : "after") + " the records) with one duplicate-key record and one valid record: the rejected record is ignored and the valid record is read as before, and the guard accepts the matching verdict", () => {
      const root = sizedRoot([duplicateKeyLine(77, "approve"), validLine(5, "approve")], size, padFirst);
      assert.deepStrictEqual(prList(root), ["5"]);
      assert.ok(!confirmationStore.findConfirmation(77, "approve", { root: root }), "the rejected record confirms nothing");
      assert.ok(confirmationStore.findConfirmation(5, "approve", { root: root }), "the valid record is read");
      assert.strictEqual(guardDenies(root, "gh pr review 5 --approve"), false, "the matching verdict is accepted");
      assert.strictEqual(guardDenies(root, "gh pr review 77 --approve"), true, "the rejected record does not confirm PR 77");
    });
  });
});

[CAP - 1, CAP].forEach((size) => {
  [false, true].forEach((padFirst) => {
    test("[AC-3 | spec-hooks-strict-json R7 | FR-249 | UR-059] a " + size + " byte confirmations.jsonl with valid records only reads as before (padding " + (padFirst ? "before" : "after") + " the records)", () => {
      const root = sizedRoot([validLine(1, "approve"), validLine(2, "decline")], size, padFirst);
      assert.deepStrictEqual(prList(root), ["1", "2"]);
      assert.ok(confirmationStore.findConfirmation(1, "approve", { root: root }));
      assert.ok(confirmationStore.findConfirmation(2, "decline", { root: root }));
    });
  });
});

test("[spec-hooks-strict-json R7 | FR-249 | NFR-028] the task plan Step 4 note: an over-cap pending.jsonl yields no open token, the same fail-closed direction, and the token is found at the cap", () => {
  // readRecords also serves pending.jsonl, so the cap applies there too.
  const root = fx.tempRoot("strict-readers-pending-cap-");
  const rec = confirmationStore.createPending({ pr: 42, verdict: "approve", sessionId: "sess-1" }, { root: root, now: at(T0) });
  const file = pendingFile(root);
  const lines = fs.readFileSync(file, "utf8").split("\n").filter((l) => l.trim() !== "");
  assert.strictEqual(lines.length, 1);
  writeSized(file, lines, CAP, false);
  assert.ok(confirmationStore.findPending(rec.token, "sess-1", { root: root, now: at(T0 + 1000) }), "at the cap the pending record is found");
  writeSized(file, lines, CAP + 1, false);
  assert.ok(!confirmationStore.findPending(rec.token, "sess-1", { root: root, now: at(T0 + 1000) }), "over the cap no pending record is found");
});

// ---------------------------------------------------------------------------
// Requirement 9: other JSON.parse readers keep JSON.parse
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-strict-json R9 | FR-249] a duplicate key in .claude/settings.json is still read with JSON.parse semantics: the last value wins and nothing is rejected", () => {
  // The settings reader is not one of the three strict readers. The later opt-out value (all three profiles off)
  // wins over the earlier one (hipaa only). FERPA reading false proves the later value was used.
  const settingsText = '{"env":{"' + FLAG + '":"hipaa","' + FLAG + '":"ferpa,hipaa,soc2"}}';
  const root = profileRoot(TAGS, settingsText);
  const state = withProcessEnv(undefined, () => dataClass.profileState({ root: root }));
  assert.strictEqual(state.hipaa, false, JSON.stringify(state));
  assert.strictEqual(state.ferpa, false, JSON.stringify(state));
  assert.strictEqual(state.soc2, false, JSON.stringify(state));
  assert.ok(!state.problem, "no problem is reported for the settings file: " + JSON.stringify(state));
});

test("[AC-1 | spec-hooks-strict-json R9 | FR-249] a settings.json nested over 32 levels is still read with JSON.parse: the opt-out in it applies", () => {
  const settingsText = '{"deep":' + nestArrays(40) + ',"env":{"' + FLAG + '":"ferpa,hipaa"}}';
  const root = profileRoot(TAGS, settingsText);
  const state = withProcessEnv(undefined, () => dataClass.profileState({ root: root }));
  assert.strictEqual(state.ferpa, false, JSON.stringify(state));
  assert.strictEqual(state.hipaa, false, JSON.stringify(state));
});
