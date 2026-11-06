// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the FERPA disclosure-recordation guard (harness-governance Tranche 3, Step 27b):
// the command entry plugins/assist-plugin/hooks/ferpa-disclosure-guard.js, run as a PreToolUse hook with one JSON
// document on stdin. The guard implementation is never read or imported here.
//
// Sources: specs/spec-hooks-compliance.md, "Requirement: FERPA disclosure recordation" (Scenarios: Disclosure recorded,
// Missing party or interest, Party not on the allowlist, Exception applies); docs/requirements/FR-NFR-harness-governance.md
// section 2.33 (FR-246), section 3.2 (NFR-028 fail closed), NFR-026 (a decision leaves a log record), NFR-031 (no
// education-record content in a log), NFR-033 (status stays "to verify"); plugins/assist-plugin/rules/assist-plugin-rule.md,
// "Governance profiles" and "Outbound data guards" (the documented configuration keys, declaration form, decision
// order, and known limits). Task plan: docs/task-plans/task-plan-harness-governance-20261028-0759.md, Step 27b.
//
// Traceability format: [AC-N | FR-246 | 2.33 | spec-hooks-compliance | related ids]. The spec carries no SPEC-NNN id, so
// it is cited by file name. AC-N is the position of the Scenario inside the Requirement:
//   AC-1 Disclosure recorded, AC-2 Missing party or interest, AC-3 Party not on the allowlist, AC-4 Exception applies.
// A test that covers the profile flag, the fail-closed posture, or the documented limit carries no AC number and cites
// the rule section instead.
//
// Contract used (documented configuration and payload form, never the implementation):
//   - The guard covers a WebFetch call (url and prompt) and a gh/bkt pr post command. Any other call is not judged.
//   - A call carries education-record data when its payload matches an entry of `student_record_patterns`, or names a
//     path (a --body-file here) that `data_classes` tags `student-record`.
//   - The payload declares `Receiving-Party: <id>` and `Legitimate-Interest: <label>`, one line each.
//   - `.agent/governance/profile.json` holds `ferpa_receiving_parties` (the allowlist) and `ferpa_exceptions` (the 34 CFR
//     99.32(d) list). The allowlist, not the payload, decides which parties pass.
//   - The profile flag is ASSIST_PLUGIN_COMPLIANCE_OPT_OUT in the env block of the committed <root>/.claude/settings.json.
//   - A deny is the PreToolUse deny JSON on stdout with exit 0. An allowed call prints no deny.
//   - A recorded disclosure is one `ferpa-disclosure` event in .agent/logs/governance/audit.jsonl holding the receiving
//     party and the legitimate interest (fields `receiving_party`, `legitimate_interest`).
//
// Every project is a temp directory with a .git directory, so the hook finds it as the git root of the input `cwd`.
// Every child process runs with a temporary CLAUDE_PLUGIN_DATA. No repository file is edited: fault injection loads a
// preload script (node --require) from a temp folder.
//
// Run: node --test tests/hooks/ferpa-disclosure-guard.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const PLUGIN = fx.PLUGIN;
const audit = fx.auditChain;
const dataClass = require(path.join(PLUGIN, "hooks", "lib", "data-class.js"));
const ENTRY = path.join(PLUGIN, "hooks", "ferpa-disclosure-guard.js");

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STUDENT_ID = "S12345678";
const BODY_MARKER = "PAYLOAD-MARKER-5d1e";
const ALLOWED_PARTY = "district-registrar";
const OTHER_ALLOWED_PARTY = "state-education-agency";
const EXCEPTION_PARTY = "parent-guardian";
const OFF_LIST_PARTY = "unlisted-vendor";
const INTEREST = "accreditation-review";

const BASE_PROFILE = {
  student_record_patterns: [{ name: "sid", pattern: "\\bS\\d{8}\\b" }],
  ferpa_receiving_parties: [ALLOWED_PARTY, OTHER_ALLOWED_PARTY],
  ferpa_exceptions: [{ party: EXCEPTION_PARTY, exception: "99.32(d)(1)" }],
  data_classes: { "student-record": ["records/**"] },
};

function profileCopy(change) {
  const copy = JSON.parse(JSON.stringify(BASE_PROFILE));
  return change ? change(copy) || copy : copy;
}

function writeFile(root, relative, text) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof text === "string" ? text : JSON.stringify(text));
  return file;
}

// options: {profile: object | string | null (absent), settings: object | string, localSettings: object | string}.
// An undefined profile writes BASE_PROFILE.
function makeRoot(options) {
  const opts = options || {};
  const root = fx.tempRoot("ferpa-guard-");
  if (opts.profile !== null) {
    writeFile(root, ".agent/governance/profile.json", opts.profile === undefined ? BASE_PROFILE : opts.profile);
  }
  if (opts.settings !== undefined) writeFile(root, ".claude/settings.json", opts.settings);
  if (opts.localSettings !== undefined) writeFile(root, ".claude/settings.local.json", opts.localSettings);
  fs.mkdirSync(path.join(root, "records"), { recursive: true });
  return root;
}

function optOut(value) {
  return { env: { ASSIST_PLUGIN_COMPLIANCE_OPT_OUT: value } };
}

// A declaration block. A null party or interest leaves that line out.
function declaration(party, interest) {
  const lines = [];
  if (party !== null) lines.push("Receiving-Party: " + party);
  if (interest !== null) lines.push("Legitimate-Interest: " + interest);
  return lines.join("\n");
}

// A payload that matches the student-record pattern, with the declaration below it.
function studentBody(party, interest) {
  return [BODY_MARKER + " grade report for " + STUDENT_ID, declaration(party, interest)].filter(Boolean).join("\n");
}

function preToolUse(root, tool, toolInput) {
  return { hook_event_name: "PreToolUse", session_id: "s-ferpa-1", tool_name: tool, tool_input: toolInput, cwd: root };
}

let outboxCounter = 0;

// Three transports that carry the same payload text. Each takes (root, text) and returns the hook input document.
function webFetchDoc(root, text) {
  return preToolUse(root, "WebFetch", { url: "https://sis.example.test/export", prompt: text });
}

function bodyFileDoc(root, text) {
  outboxCounter += 1;
  const file = writeFile(root, "outbox/post-" + outboxCounter + ".txt", text);
  return preToolUse(root, "Bash", { command: "gh pr comment 42 --body-file " + file });
}

function inlineDoc(root, text) {
  return preToolUse(root, "Bash", { command: "gh pr comment 42 --body '" + text + "'" });
}

const TRANSPORTS = [
  ["WebFetch prompt", webFetchDoc],
  ["gh pr comment --body-file", bodyFileDoc],
  ["gh pr comment --body (inline)", inlineDoc],
];

function run(doc, options) {
  return fx.runHook("ferpa-disclosure-guard", doc, options);
}

function assertExitZero(res) {
  assert.strictEqual(res.error, undefined, "spawn error: " + (res.error && res.error.message));
  assert.strictEqual(res.status, 0, "exit status 0; stderr: " + res.stderr);
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

function assertDenied(res, label) {
  assertExitZero(res);
  assert.ok(isDeny(res), (label || "expected the deny JSON") + "; got stdout: " + res.stdout);
}

function assertAllowed(res, label) {
  assertExitZero(res);
  assert.ok(!isDeny(res), (label || "expected no deny") + "; got stdout: " + res.stdout);
}

function ferpaRecords(root) {
  return fx.readRecords(root).filter((record) => record.event === "ferpa-disclosure");
}

// The rule id is named either in the deny reason or in the decision record of the log.
function assertRuleNamed(res, root, ruleId) {
  const seen = res.stdout.indexOf(ruleId) !== -1 || fx.rawLog(root).indexOf(ruleId) !== -1;
  assert.ok(seen, "expected rule id " + ruleId + " in the denial or the log; stdout: " + res.stdout);
}

// NFR-031 / FR-246: the denial and the log never hold `unstated` for the receiving party or the legitimate interest, and
// never repeat the payload.
function assertNoUnstated(res, root) {
  assert.ok(res.stdout.indexOf("unstated") === -1, "the denial holds `unstated`: " + res.stdout);
  fx.readRecords(root).forEach((record) => {
    ["receiving_party", "legitimate_interest"].forEach((key) => {
      if (record[key] !== undefined) {
        assert.notStrictEqual(String(record[key]).toLowerCase(), "unstated", "record holds unstated for " + key);
      }
    });
  });
}

function assertNoPayloadEcho(res) {
  assert.ok(res.stdout.indexOf(STUDENT_ID) === -1, "the denial repeats the student id: " + res.stdout);
  assert.ok(res.stdout.indexOf(BODY_MARKER) === -1, "the denial repeats the payload: " + res.stdout);
}

// ---------------------------------------------------------------------------
// AC-2: missing attribution is denied (Scenario: Missing party or interest)
// ---------------------------------------------------------------------------

TRANSPORTS.forEach((transport) => {
  test("[AC-2 | FR-246 | 2.33 | spec-hooks-compliance | NFR-031] " + transport[0] + ": student-record payload with a party and NO legitimate interest is denied, with no `unstated` in the denial or the log", () => {
    const root = makeRoot();
    const res = run(transport[1](root, studentBody(ALLOWED_PARTY, null)));
    assertDenied(res);
    assertRuleNamed(res, root, "ferpa-disclosure.missing-interest");
    assertNoUnstated(res, root);
    assertNoPayloadEcho(res);
    assert.strictEqual(ferpaRecords(root).length, 0, "a denied call leaves no disclosure entry");
  });

  test("[AC-2 | FR-246 | 2.33 | spec-hooks-compliance | NFR-031] " + transport[0] + ": student-record payload with an interest and NO receiving party is denied, with no `unstated` in the denial or the log", () => {
    const root = makeRoot();
    const res = run(transport[1](root, studentBody(null, INTEREST)));
    assertDenied(res);
    assertRuleNamed(res, root, "ferpa-disclosure.missing-party");
    assertNoUnstated(res, root);
    assertNoPayloadEcho(res);
    assert.strictEqual(ferpaRecords(root).length, 0);
  });

  test("[AC-2 | FR-246 | 2.33 | spec-hooks-compliance] " + transport[0] + ": student-record payload with neither field is denied", () => {
    const root = makeRoot();
    const res = run(transport[1](root, studentBody(null, null)));
    assertDenied(res);
    assertNoUnstated(res, root);
    assertNoPayloadEcho(res);
    assert.strictEqual(ferpaRecords(root).length, 0);
  });
});

// Invalid input: a placeholder stands for "no value" and counts as a missing field (rule section, decision steps 3 and 4).
["unstated", "none", "tbd", "unknown"].forEach((placeholder) => {
  test("[AC-2 | FR-246 | 2.33 | spec-hooks-compliance] the placeholder `" + placeholder + "` as the legitimate interest counts as missing and is denied", () => {
    const root = makeRoot();
    const res = run(webFetchDoc(root, studentBody(ALLOWED_PARTY, placeholder)));
    assertDenied(res);
    assertNoUnstated(res, root);
    assert.strictEqual(ferpaRecords(root).length, 0);
  });

  test("[AC-2 | FR-246 | 2.33 | spec-hooks-compliance] the placeholder `" + placeholder + "` as the receiving party counts as missing and is denied", () => {
    const root = makeRoot();
    const res = run(webFetchDoc(root, studentBody(placeholder, INTEREST)));
    assertDenied(res);
    assertNoUnstated(res, root);
    assert.strictEqual(ferpaRecords(root).length, 0);
  });
});

test("[AC-2 | FR-246 | 2.33 | spec-hooks-compliance] a body file under a student-record-tagged path, with no legitimate interest, is denied", () => {
  // Path-tagged trigger: the payload holds no pattern match; the tag comes from data_classes (records/**).
  const root = makeRoot();
  const file = writeFile(root, "records/transcript.txt", declaration(ALLOWED_PARTY, null));
  const res = run(preToolUse(root, "Bash", { command: "gh pr comment 42 --body-file " + file }));
  assertDenied(res);
  assertNoUnstated(res, root);
  assert.strictEqual(ferpaRecords(root).length, 0);
});

test("[AC-2 | FR-246 | 2.33 | spec-hooks-compliance] two different receiving parties in one payload are ambiguous and denied", () => {
  const root = makeRoot();
  const text = [BODY_MARKER + " " + STUDENT_ID, declaration(ALLOWED_PARTY, INTEREST), declaration(OTHER_ALLOWED_PARTY, null)].join("\n");
  const res = run(webFetchDoc(root, text));
  assertDenied(res);
  assert.strictEqual(ferpaRecords(root).length, 0);
});

test("[AC-2 | FR-246 | 2.33 | spec-hooks-compliance] two different legitimate interests in one payload are ambiguous and denied", () => {
  const root = makeRoot();
  const text = [BODY_MARKER + " " + STUDENT_ID, declaration(ALLOWED_PARTY, INTEREST), declaration(null, "audit")].join("\n");
  const res = run(webFetchDoc(root, text));
  assertDenied(res);
  assert.strictEqual(ferpaRecords(root).length, 0);
});

// Boundary: a call that carries no education-record data is not judged and leaves no entry.
test("[FR-246 | 2.33 | spec-hooks-compliance] a WebFetch with no student-record data and no declaration is allowed and leaves no entry", () => {
  const root = makeRoot();
  const res = run(preToolUse(root, "WebFetch", { url: "https://docs.example.test/page", prompt: "Summarize the page" }));
  assertAllowed(res);
  assert.strictEqual(ferpaRecords(root).length, 0);
});

test("[FR-246 | 2.33 | spec-hooks-compliance] a PR comment with no student-record data and no declaration is allowed and leaves no entry", () => {
  const root = makeRoot();
  const res = run(inlineDoc(root, "Looks good to me after the rename"));
  assertAllowed(res);
  assert.strictEqual(ferpaRecords(root).length, 0);
});

// Null, empty, and type-mismatch input space: the hook exits 0 and prints nothing or one JSON document.
[
  ["tool_input absent", () => ({ hook_event_name: "PreToolUse", tool_name: "WebFetch" })],
  ["tool_input null", (root) => preToolUse(root, "WebFetch", null)],
  ["url a number and prompt null", (root) => preToolUse(root, "WebFetch", { url: 42, prompt: null })],
  ["command an object", (root) => preToolUse(root, "Bash", { command: { a: 1 } })],
  ["command empty", (root) => preToolUse(root, "Bash", { command: "" })],
].forEach((row) => {
  test("[FR-246 | 2.33 | spec-hooks-compliance | NFR-028] odd input (" + row[0] + ") exits 0 and prints nothing or one JSON document", () => {
    const root = makeRoot();
    const res = run(row[1](root));
    assertExitZero(res);
    if (res.stdout.trim() !== "") JSON.parse(res.stdout);
  });
});

// ---------------------------------------------------------------------------
// AC-1: a recorded disclosure (Scenario: Disclosure recorded)
// ---------------------------------------------------------------------------

TRANSPORTS.forEach((transport) => {
  test("[AC-1 | FR-246 | 2.33 | spec-hooks-compliance | NFR-026] " + transport[0] + ": both fields declared and the party on the allowlist is allowed, and the log holds the party and the interest", () => {
    const root = makeRoot();
    const res = run(transport[1](root, studentBody(ALLOWED_PARTY, INTEREST)));
    assertAllowed(res);
    const records = ferpaRecords(root);
    assert.strictEqual(records.length, 1, "exactly one disclosure entry");
    assert.strictEqual(records[0].receiving_party, ALLOWED_PARTY);
    assert.strictEqual(records[0].legitimate_interest, INTEREST);
  });
});

test("[AC-1 | FR-246 | 2.33 | spec-hooks-compliance] a body file under a student-record-tagged path with both fields declared is allowed and the entry names the class and the path", () => {
  const root = makeRoot();
  const file = writeFile(root, "records/transcript.txt", declaration(ALLOWED_PARTY, INTEREST));
  const res = run(preToolUse(root, "Bash", { command: "gh pr comment 42 --body-file " + file }));
  assertAllowed(res);
  const records = ferpaRecords(root);
  assert.strictEqual(records.length, 1);
  assert.strictEqual(records[0].receiving_party, ALLOWED_PARTY);
  assert.strictEqual(records[0].legitimate_interest, INTEREST);
  const text = JSON.stringify(records[0]);
  assert.ok(text.indexOf("student-record") !== -1, "the entry carries the class tag: " + text);
  assert.ok(text.indexOf("records/transcript.txt") !== -1, "the entry carries the tagged path: " + text);
});

[ALLOWED_PARTY, OTHER_ALLOWED_PARTY].forEach((party) => {
  test("[AC-1 | FR-246 | 2.33 | spec-hooks-compliance] every allowlist entry passes: `" + party + "`", () => {
    const root = makeRoot();
    const res = run(webFetchDoc(root, studentBody(party, INTEREST)));
    assertAllowed(res);
    const records = ferpaRecords(root);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].receiving_party, party);
  });
});

test("[AC-1 | FR-246 | 2.33 | spec-hooks-compliance] the allowlist match ignores case in the declared party", () => {
  const root = makeRoot();
  const res = run(webFetchDoc(root, studentBody("District-Registrar", INTEREST)));
  assertAllowed(res);
  const records = ferpaRecords(root);
  assert.strictEqual(records.length, 1);
  assert.strictEqual(String(records[0].receiving_party).toLowerCase(), ALLOWED_PARTY);
});

// Valid-input variants of the declaration form (rule section: any case, words joined by - _ space or nothing, = for :).
[
  ["lower case with hyphens", "receiving-party: " + ALLOWED_PARTY + "\nlegitimate-interest: " + INTEREST],
  ["underscores", "receiving_party: " + ALLOWED_PARTY + "\nlegitimate_interest: " + INTEREST],
  ["spaces and upper case", "RECEIVING PARTY: " + ALLOWED_PARTY + "\nLEGITIMATE INTEREST: " + INTEREST],
  ["words joined", "ReceivingParty: " + ALLOWED_PARTY + "\nLegitimateInterest: " + INTEREST],
  ["equals sign", "Receiving-Party=" + ALLOWED_PARTY + "\nLegitimate-Interest=" + INTEREST],
].forEach((row) => {
  test("[AC-1 | FR-246 | 2.33 | spec-hooks-compliance] declaration form accepted (" + row[0] + ")", () => {
    const root = makeRoot();
    const res = run(webFetchDoc(root, BODY_MARKER + " " + STUDENT_ID + "\n" + row[1]));
    assertAllowed(res);
    const records = ferpaRecords(root);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].receiving_party, ALLOWED_PARTY);
    assert.strictEqual(records[0].legitimate_interest, INTEREST);
  });
});

test("[AC-1 | FR-246 | 2.33 | spec-hooks-compliance] a WebFetch query string declares both fields", () => {
  const root = makeRoot();
  const url = "https://sis.example.test/export?receiving_party=" + ALLOWED_PARTY + "&legitimate_interest=" + INTEREST;
  const res = run(preToolUse(root, "WebFetch", { url: url, prompt: BODY_MARKER + " " + STUDENT_ID }));
  assertAllowed(res);
  const records = ferpaRecords(root);
  assert.strictEqual(records.length, 1);
  assert.strictEqual(records[0].receiving_party, ALLOWED_PARTY);
  assert.strictEqual(records[0].legitimate_interest, INTEREST);
});

test("[AC-1 | FR-246 | 2.33 | spec-hooks-compliance] a PowerShell gh pr comment is judged like a Bash one", () => {
  const root = makeRoot();
  const missing = bodyFileDoc(root, studentBody(ALLOWED_PARTY, null));
  missing.tool_name = "PowerShell";
  assertDenied(run(missing));
  const complete = bodyFileDoc(root, studentBody(ALLOWED_PARTY, INTEREST));
  complete.tool_name = "PowerShell";
  assertAllowed(run(complete));
  assert.strictEqual(ferpaRecords(root).length, 1);
});

test("[AC-1 | FR-246 | 2.33 | spec-hooks-compliance | NFR-031] the disclosure entry holds no education-record content and no payload text", () => {
  const root = makeRoot();
  const res = run(webFetchDoc(root, studentBody(ALLOWED_PARTY, INTEREST)));
  assertAllowed(res);
  const records = ferpaRecords(root);
  assert.strictEqual(records.length, 1);
  const raw = fx.rawLog(root);
  assert.ok(raw.indexOf(STUDENT_ID) === -1, "student id found in the log");
  assert.ok(raw.indexOf(BODY_MARKER) === -1, "payload text found in the log");
  assert.ok(raw.indexOf("grade report") === -1, "payload text found in the log");
  Object.keys(records[0]).forEach((key) => {
    assert.ok(!/command|content|prompt|body|payload|text|input|output|response|stdout|stderr|secret/i.test(key), "unexpected field: " + key);
  });
});

test("[AC-1 | FR-246 | 2.33 | spec-hooks-compliance] two recorded disclosures leave two entries", () => {
  const root = makeRoot();
  assertAllowed(run(webFetchDoc(root, studentBody(ALLOWED_PARTY, INTEREST))));
  assertAllowed(run(webFetchDoc(root, studentBody(OTHER_ALLOWED_PARTY, "audit"))));
  const records = ferpaRecords(root);
  assert.strictEqual(records.length, 2);
  assert.deepStrictEqual(records.map((r) => r.receiving_party), [ALLOWED_PARTY, OTHER_ALLOWED_PARTY]);
});

// ---------------------------------------------------------------------------
// AC-3: a party off the allowlist is denied (Scenario: Party not on the allowlist)
// ---------------------------------------------------------------------------

TRANSPORTS.forEach((transport) => {
  test("[AC-3 | FR-246 | 2.33 | spec-hooks-compliance] " + transport[0] + ": both fields declared but the party is NOT on the allowlist: denied, and the log holds no disclosure entry for it", () => {
    const root = makeRoot();
    const res = run(transport[1](root, studentBody(OFF_LIST_PARTY, INTEREST)));
    assertDenied(res);
    assertRuleNamed(res, root, "ferpa-disclosure.party-not-allowed");
    assertNoPayloadEcho(res);
    assert.strictEqual(ferpaRecords(root).length, 0);
    fx.readRecords(root).forEach((record) => {
      assert.notStrictEqual(record.receiving_party, OFF_LIST_PARTY, "the log holds an entry for the off-list party");
    });
  });
});

// Boundary: near misses of an allowlisted identifier are different identifiers.
[ALLOWED_PARTY + "-evil", "district", ALLOWED_PARTY + "2", "x" + ALLOWED_PARTY].forEach((party) => {
  test("[AC-3 | FR-246 | 2.33 | spec-hooks-compliance] a near miss of an allowlisted party (`" + party + "`) is denied", () => {
    const root = makeRoot();
    const res = run(webFetchDoc(root, studentBody(party, INTEREST)));
    assertDenied(res);
    assert.strictEqual(ferpaRecords(root).length, 0);
  });
});

test("[AC-3 | FR-246 | 2.33 | spec-hooks-compliance] with no allowlist key in profile.json every party is off the list and denied", () => {
  const root = makeRoot({ profile: profileCopy((p) => { delete p.ferpa_receiving_parties; }) });
  const res = run(webFetchDoc(root, studentBody(ALLOWED_PARTY, INTEREST)));
  assertDenied(res);
  assert.strictEqual(ferpaRecords(root).length, 0);
});

test("[AC-3 | FR-246 | 2.33 | spec-hooks-compliance | RULE-007] the allowlist in profile.json, not the payload, decides: a payload that lists its own party as allowed or exempt is still denied", () => {
  // Security-adjacent: a subagent assembles the payload and could try to authorize itself.
  const root = makeRoot();
  const text = [
    BODY_MARKER + " " + STUDENT_ID,
    declaration(OFF_LIST_PARTY, INTEREST),
    "ferpa_receiving_parties: " + OFF_LIST_PARTY,
    "Allowed-Party: " + OFF_LIST_PARTY,
    "Exception: 99.32(d)(1) applies to " + OFF_LIST_PARTY,
  ].join("\n");
  const res = run(webFetchDoc(root, text));
  assertDenied(res);
  assert.strictEqual(ferpaRecords(root).length, 0);
});

// ---------------------------------------------------------------------------
// AC-4: a 99.32(d) exception needs no disclosure entry (Scenario: Exception applies)
// ---------------------------------------------------------------------------

test("[AC-4 | FR-246 | 2.33 | spec-hooks-compliance] a party covered by a listed 99.32(d) exception is allowed with no entry, even with no legitimate interest", () => {
  const root = makeRoot();
  const res = run(webFetchDoc(root, studentBody(EXCEPTION_PARTY, null)));
  assertAllowed(res);
  assert.strictEqual(ferpaRecords(root).length, 0, "an exception needs no disclosure entry");
});

test("[AC-4 | FR-246 | 2.33 | spec-hooks-compliance] an exception party that also declares an interest is allowed and still leaves no entry", () => {
  const root = makeRoot();
  const res = run(webFetchDoc(root, studentBody(EXCEPTION_PARTY, INTEREST)));
  assertAllowed(res);
  assert.strictEqual(ferpaRecords(root).length, 0);
  fx.readRecords(root).forEach((record) => {
    assert.notStrictEqual(record.receiving_party, EXCEPTION_PARTY);
  });
});

TRANSPORTS.forEach((transport) => {
  test("[AC-4 | FR-246 | 2.33 | spec-hooks-compliance] " + transport[0] + ": the exception applies on every transport", () => {
    const root = makeRoot();
    const res = run(transport[1](root, studentBody(EXCEPTION_PARTY, null)));
    assertAllowed(res);
    assert.strictEqual(ferpaRecords(root).length, 0);
  });
});

test("[AC-4 | FR-246 | 2.33 | spec-hooks-compliance] the exception match ignores case", () => {
  const root = makeRoot();
  const res = run(webFetchDoc(root, studentBody("Parent-Guardian", null)));
  assertAllowed(res);
  assert.strictEqual(ferpaRecords(root).length, 0);
});

test("[AC-4 | FR-246 | 2.33 | spec-hooks-compliance] an exception party need not be on the allowlist", () => {
  const root = makeRoot({ profile: profileCopy((p) => { p.ferpa_receiving_parties = [OTHER_ALLOWED_PARTY]; }) });
  const res = run(webFetchDoc(root, studentBody(EXCEPTION_PARTY, null)));
  assertAllowed(res);
  assert.strictEqual(ferpaRecords(root).length, 0);
});

test("[AC-4 | FR-246 | 2.33 | spec-hooks-compliance] a party that is on neither list is still denied while an exception is configured", () => {
  const root = makeRoot();
  const res = run(webFetchDoc(root, studentBody(OFF_LIST_PARTY, INTEREST)));
  assertDenied(res);
  assert.strictEqual(ferpaRecords(root).length, 0);
});

test("[AC-4 | FR-246 | 2.33 | spec-hooks-compliance] an exception party together with a second, unlisted party is ambiguous and denied", () => {
  const root = makeRoot();
  const text = [BODY_MARKER + " " + STUDENT_ID, declaration(EXCEPTION_PARTY, null), declaration(OFF_LIST_PARTY, INTEREST)].join("\n");
  const res = run(webFetchDoc(root, text));
  assertDenied(res);
  assert.strictEqual(ferpaRecords(root).length, 0);
});

test("[AC-4 | FR-246 | 2.33 | spec-hooks-compliance] a payload that cites an exception the profile.json does not list gets no exemption", () => {
  const root = makeRoot({ profile: profileCopy((p) => { p.ferpa_exceptions = []; }) });
  const res = run(webFetchDoc(root, studentBody(EXCEPTION_PARTY, null)));
  assertDenied(res);
  assert.strictEqual(ferpaRecords(root).length, 0);
});

// ---------------------------------------------------------------------------
// FERPA-profile enforcement (rule section: Governance profiles; FR-243 flag; spec Requirement scope "While the FERPA
// profile is enforced")
// ---------------------------------------------------------------------------

test("[FR-246 | 2.33 | spec-hooks-compliance | FR-243] default: with no committed settings file the FERPA profile is enforced and the guard denies a missing interest", () => {
  const root = makeRoot();
  assert.ok(!fs.existsSync(path.join(root, ".claude")), "no settings file exists");
  assert.strictEqual(dataClass.profileState({ root: root }).ferpa, true);
  assertDenied(run(webFetchDoc(root, studentBody(ALLOWED_PARTY, null))));
});

// Null, empty, and typo flag values turn nothing off, so a typo never disables a control.
[
  ["no env block", {}],
  ["flag absent from the env block", { env: { OTHER: "x" } }],
  ["empty flag", optOut("")],
  ["a typo that names no profile", optOut("ferp")],
  ["other profiles only", optOut("hipaa,soc2")],
].forEach((row) => {
  test("[FR-246 | 2.33 | spec-hooks-compliance | FR-243] the guard still runs when the committed flag is " + row[0], () => {
    const root = makeRoot({ settings: row[1] });
    assert.strictEqual(dataClass.profileState({ root: root }).ferpa, true);
    assertDenied(run(webFetchDoc(root, studentBody(ALLOWED_PARTY, null))));
  });
});

["ferpa", " FERPA ", "soc2, ferpa", "hipaa,ferpa,soc2"].forEach((value) => {
  test("[FR-246 | 2.33 | spec-hooks-compliance | FR-243] the committed flag `" + value + "` opts FERPA out: the guard allows a call it would deny", () => {
    const root = makeRoot({ settings: optOut(value) });
    assert.strictEqual(dataClass.profileState({ root: root }).ferpa, false);
    assertAllowed(run(webFetchDoc(root, studentBody(ALLOWED_PARTY, null))));
    assert.strictEqual(ferpaRecords(root).length, 0);
  });
});

test("[FR-246 | 2.33 | spec-hooks-compliance | FR-243] opting FERPA out leaves SOC 2 and HIPAA enforced", () => {
  const root = makeRoot({ settings: optOut("ferpa") });
  const state = dataClass.profileState({ root: root });
  assert.strictEqual(state.ferpa, false);
  assert.strictEqual(state.soc2, true);
  assert.strictEqual(state.hipaa, true);
});

test("[FR-246 | 2.33 | spec-hooks-compliance | FR-243 | FR-233] with FERPA opted out, the HIPAA PHI outbound guard still enforces, and it stops only when HIPAA is opted out too", () => {
  // Black-box check on a second guard: a malformed profile.json is denied by the PHI guard while HIPAA is enforced.
  const malformed = "{ not json";
  const hipaaOn = makeRoot({ profile: malformed, settings: optOut("ferpa") });
  const phiDoc = (root) => preToolUse(root, "WebFetch", { url: "https://docs.example.test/page", prompt: "Summarize the page" });
  assertDenied(fx.runHook("phi-outbound-guard", phiDoc(hipaaOn)), "HIPAA stays enforced");
  // And the FERPA guard, opted out in the same project, allows.
  assertAllowed(run(webFetchDoc(hipaaOn, studentBody(ALLOWED_PARTY, null))));
  const bothOff = makeRoot({ profile: malformed, settings: optOut("ferpa,hipaa") });
  assertAllowed(fx.runHook("phi-outbound-guard", phiDoc(bothOff)));
});

test("[FR-246 | 2.33 | spec-hooks-compliance | FR-243] a flag set ONLY in .claude/settings.local.json is ignored, even when the process environment carries the same opt-out", () => {
  // The process.env value differs from the committed state (which opts nothing out). A merged-environment read would
  // turn FERPA off; the hook parses the committed file and must still enforce.
  const root = makeRoot({ localSettings: optOut("ferpa") });
  assert.strictEqual(dataClass.profileState({ root: root }).ferpa, true);
  assert.ok(dataClass.localOverride({ root: root }).ignored.indexOf("ferpa") !== -1, "the local file names ferpa and is ignored");
  const res = run(webFetchDoc(root, studentBody(ALLOWED_PARTY, null)), {
    env: { ASSIST_PLUGIN_COMPLIANCE_OPT_OUT: "ferpa,hipaa,soc2" },
  });
  assertDenied(res, "a local-only flag must not turn the guard off");
  assert.strictEqual(ferpaRecords(root).length, 0);
});

test("[FR-246 | 2.33 | spec-hooks-compliance | FR-243] a process-environment flag alone does not turn the guard off", () => {
  const root = makeRoot();
  const res = run(webFetchDoc(root, studentBody(ALLOWED_PARTY, null)), { env: { ASSIST_PLUGIN_COMPLIANCE_OPT_OUT: "ferpa" } });
  assertDenied(res);
});

test("[FR-246 | 2.33 | spec-hooks-compliance | FR-243] a committed file that opts out a different profile plus a local file that names ferpa still enforces FERPA", () => {
  const root = makeRoot({ settings: optOut("soc2"), localSettings: optOut("ferpa") });
  assert.strictEqual(dataClass.profileState({ root: root }).ferpa, true);
  assertDenied(run(webFetchDoc(root, studentBody(ALLOWED_PARTY, null))));
});

// ---------------------------------------------------------------------------
// Fail-closed posture (NFR-028; rule section: Outbound data guards)
// ---------------------------------------------------------------------------

const BREAK_PRELOAD_SOURCE = [
  '"use strict";',
  'const Module = require("module");',
  "const originalLoad = Module._load;",
  "Module._load = function (request) {",
  "  const loaded = originalLoad.apply(this, arguments);",
  "  const mode = process.env.FERPA_FAULT_MODE;",
  '  if (mode === "settings" && /data-class(\\.js)?$/.test(String(request)) && loaded && typeof loaded.ferpaSettings === "function" && !loaded.__ferpaBroken) {',
  '    loaded.ferpaSettings = function () { throw new Error("fault: ferpa settings reader failed"); };',
  "    loaded.__ferpaBroken = true;",
  "  }",
  '  if ((mode === "append-throw" || mode === "append-refuse") && /audit-chain(\\.js)?$/.test(String(request)) && loaded && typeof loaded.append === "function" && !loaded.__appendBroken) {',
  "    loaded.append = function () {",
  '      if (mode === "append-throw") { throw new Error("fault: append failed"); }',
  '      return { ok: false, code: "fault", message: "fault: append refused" };',
  "    };",
  "    loaded.__appendBroken = true;",
  "  }",
  "  return loaded;",
  "};",
  "",
].join("\n");

let preloadPath = null;

function breakPreload() {
  if (!preloadPath) {
    preloadPath = path.join(fx.tempDir("ferpa-guard-preload-"), "break-ferpa.js");
    fs.writeFileSync(preloadPath, BREAK_PRELOAD_SOURCE);
  }
  return preloadPath;
}

function runWithFault(doc, mode) {
  return childProcess.spawnSync(process.execPath, ["--require", breakPreload(), ENTRY], {
    cwd: fx.tempDir("ferpa-guard-cwd-"),
    env: fx.cleanEnv({
      CLAUDE_PLUGIN_DATA: fx.tempDir("ferpa-guard-data-"),
      CLAUDE_CONFIG_DIR: fx.tempDir("ferpa-guard-claude-"),
      FERPA_FAULT_MODE: mode,
    }),
    input: JSON.stringify(doc),
    encoding: "utf8",
    timeout: 60000,
  });
}

test("[FR-246 | 2.33 | spec-hooks-compliance | NFR-028] baseline: the preload script alone changes nothing (a complete, allowlisted disclosure is allowed)", () => {
  const root = makeRoot();
  const res = runWithFault(webFetchDoc(root, studentBody(ALLOWED_PARTY, INTEREST)), "none");
  assertAllowed(res);
  assert.strictEqual(ferpaRecords(root).length, 1);
});

test("[FR-246 | 2.33 | spec-hooks-compliance | NFR-028] an evaluation error inside the guarded class denies a WebFetch and the hook exits 0", () => {
  const root = makeRoot();
  const res = runWithFault(webFetchDoc(root, studentBody(ALLOWED_PARTY, INTEREST)), "settings");
  assertDenied(res, "expected a fail-closed deny");
  assertNoPayloadEcho(res);
  assert.strictEqual(ferpaRecords(root).length, 0);
});

test("[FR-246 | 2.33 | spec-hooks-compliance | NFR-028] an evaluation error inside the guarded class denies a gh pr comment", () => {
  const root = makeRoot();
  const res = runWithFault(bodyFileDoc(root, studentBody(ALLOWED_PARTY, INTEREST)), "settings");
  assertDenied(res, "expected a fail-closed deny");
  assertNoPayloadEcho(res);
});

["ls", "git status", "echo hello", "gh pr view 42"].forEach((command) => {
  test("[FR-246 | 2.33 | spec-hooks-compliance | NFR-028] after an evaluation error, `" + command + "` (outside the guarded class) is still allowed", () => {
    const root = makeRoot();
    const res = runWithFault(preToolUse(root, "Bash", { command: command }), "settings");
    assertAllowed(res);
  });
});

test("[FR-246 | 2.33 | spec-hooks-compliance | NFR-028] after an evaluation error, a Read call (outside the guarded class) is still allowed", () => {
  const root = makeRoot();
  const res = runWithFault(preToolUse(root, "Read", { file_path: path.join(root, "README.md") }), "settings");
  assertAllowed(res);
});

["append-throw", "append-refuse"].forEach((mode) => {
  test("[FR-246 | 2.33 | spec-hooks-compliance | NFR-028 | NFR-026] when the disclosure cannot be appended (" + mode + "), the call is denied: a disclosure that cannot be recorded is not allowed", () => {
    const root = makeRoot();
    const res = runWithFault(webFetchDoc(root, studentBody(ALLOWED_PARTY, INTEREST)), mode);
    assertDenied(res, "expected a deny when the append fails");
    assert.strictEqual(ferpaRecords(root).length, 0);
  });
});

test("[FR-246 | 2.33 | spec-hooks-compliance | NFR-028] an absent profile.json runs log-only: a student-looking payload with no declaration is allowed and nothing is recorded", () => {
  const root = makeRoot({ profile: null });
  assert.ok(!fs.existsSync(path.join(root, ".agent", "governance", "profile.json")));
  TRANSPORTS.forEach((transport) => {
    assertAllowed(run(transport[1](root, studentBody(null, null))), transport[0]);
  });
  assert.strictEqual(ferpaRecords(root).length, 0);
});

test("[FR-246 | 2.33 | spec-hooks-compliance | NFR-028] an absent profile.json never denies, even for a complete declaration, and records nothing", () => {
  const root = makeRoot({ profile: null });
  assertAllowed(run(webFetchDoc(root, studentBody(ALLOWED_PARTY, INTEREST))));
  assert.strictEqual(ferpaRecords(root).length, 0);
});

const MALFORMED_PROFILES = [
  ["text that is not JSON", "{ not json"],
  ["an empty file", ""],
  ["a JSON array", "[]"],
  ["a JSON string", '"text"'],
  ["data_classes of the wrong shape", { data_classes: 5 }],
  ["data_classes naming an unknown class", { data_classes: { secret: ["x/**"] } }],
  ["an allowlist that is not a list", { ferpa_receiving_parties: ALLOWED_PARTY }],
  ["an allowlist that holds a placeholder", { ferpa_receiving_parties: ["unstated"] }],
  ["a student-record pattern that does not compile", { student_record_patterns: ["("] }],
  ["an exception with a bad citation", { ferpa_exceptions: [{ party: EXCEPTION_PARTY, exception: "not-a-citation" }] }],
];

MALFORMED_PROFILES.forEach((row) => {
  test("[FR-246 | 2.33 | spec-hooks-compliance | NFR-028] a malformed profile.json (" + row[0] + ") under an enforced FERPA profile denies a covered call", () => {
    const root = makeRoot({ profile: row[1] });
    const complete = run(webFetchDoc(root, studentBody(ALLOWED_PARTY, INTEREST)));
    assertDenied(complete, "WebFetch with a complete declaration");
    assertNoPayloadEcho(complete);
    assertDenied(run(inlineDoc(root, studentBody(ALLOWED_PARTY, INTEREST))), "gh pr comment with a complete declaration");
    assert.strictEqual(ferpaRecords(root).length, 0);
  });
});

test("[FR-246 | 2.33 | spec-hooks-compliance | NFR-028] a malformed profile.json denies every covered call, including one with no student-record data", () => {
  const root = makeRoot({ profile: "{ not json" });
  assertDenied(run(preToolUse(root, "WebFetch", { url: "https://docs.example.test/page", prompt: "Summarize" })));
  assertDenied(run(inlineDoc(root, "Looks good to me")));
});

test("[FR-246 | 2.33 | spec-hooks-compliance | NFR-028] a malformed profile.json still allows `ls`, git status, and a Read", () => {
  const root = makeRoot({ profile: "{ not json" });
  assertAllowed(run(preToolUse(root, "Bash", { command: "ls" })));
  assertAllowed(run(preToolUse(root, "Bash", { command: "git status" })));
  assertAllowed(run(preToolUse(root, "Read", { file_path: path.join(root, "README.md") })));
});

test("[FR-246 | 2.33 | spec-hooks-compliance | NFR-028] the denial for a malformed profile.json holds until the file is fixed, then the call passes", () => {
  const root = makeRoot({ profile: "{ not json" });
  const doc = webFetchDoc(root, studentBody(ALLOWED_PARTY, INTEREST));
  assertDenied(run(doc));
  assertDenied(run(doc));
  writeFile(root, ".agent/governance/profile.json", BASE_PROFILE);
  assertAllowed(run(doc));
  assert.strictEqual(ferpaRecords(root).length, 1);
});

test("[FR-246 | 2.33 | spec-hooks-compliance | NFR-028 | FR-243] a malformed profile.json does not deny once FERPA is opted out in the committed settings", () => {
  const root = makeRoot({ profile: "{ not json", settings: optOut("ferpa") });
  assertAllowed(run(webFetchDoc(root, studentBody(ALLOWED_PARTY, INTEREST))));
  assert.strictEqual(ferpaRecords(root).length, 0);
});

[
  ["empty stdin", ""],
  ["text that is not JSON", "this is not json"],
  ["an unterminated object", "{"],
  ["JSON null", "null"],
].forEach((row) => {
  test("[FR-246 | 2.33 | spec-hooks-compliance | NFR-028] unreadable stdin (" + row[0] + ") lets the call proceed and exits 0", () => {
    const res = run(row[1]);
    assertAllowed(res);
  });
});

// ---------------------------------------------------------------------------
// Documented limit (rule section: Outbound data guards, "Known limits"; BRD A-11)
// ---------------------------------------------------------------------------

test(
  "[FR-246 | 2.33 | spec-hooks-compliance | BRD A-11] KNOWN GAP: a paraphrase of education-record data escapes detection",
  {
    skip:
      "KNOWN GAP, recorded and not closed (rule section, Outbound data guards, Known limits; FR-NFR section 4): the guard matches text, not meaning, " +
      "so a paraphrase of education-record data (for example, 'the third-year pupil whose id is s-one-two-three...') matches no student_record_patterns " +
      "entry and names no tagged path, and the guard does not judge it. Detection is imperfect (BRD A-11). Session-level taint tracking is out of scope. " +
      "This test asserts neither a deny nor an allow; it records the limit.",
  },
  () => {
    // Intentionally empty: documenting the limit, not asserting a denial.
  }
);

// ---------------------------------------------------------------------------
// Real-append integration (review request): the entry reaches the audit log through the real chain, not a stub sink
// ---------------------------------------------------------------------------

test("[AC-1 | FR-246 | 2.33 | spec-hooks-compliance | NFR-026 | NFR-031] the real hook appends the `ferpa-disclosure` event to the audit log on disk, linked into the existing chain", () => {
  const root = makeRoot();
  const planted = fx.writeChain(root, [3]);
  const before = fx.readAllLines(root);
  assert.strictEqual(before.length, 3);

  const res = run(webFetchDoc(root, studentBody(ALLOWED_PARTY, INTEREST)));
  assertAllowed(res);

  const lines = fx.readAllLines(root);
  assert.ok(lines.length >= 4, "the log grew: " + lines.length);
  assert.deepStrictEqual(lines.slice(0, 3), before, "the existing lines are untouched");

  const index = lines.findIndex((line) => JSON.parse(line).event === "ferpa-disclosure");
  assert.ok(index >= 3, "a ferpa-disclosure line was appended after the existing lines");
  const record = JSON.parse(lines[index]);
  assert.strictEqual(record.receiving_party, ALLOWED_PARTY);
  assert.strictEqual(record.legitimate_interest, INTEREST);
  assert.strictEqual(typeof record.ts, "string");
  assert.strictEqual(record.prev, fx.sha256Hex(lines[index - 1]), "prev links to the hash of the line before it");
  if (index === 3) assert.strictEqual(record.prev, planted.lastHash);

  const verified = audit.verify(audit.logPath(root), { root: root });
  assert.strictEqual(verified.ok, true, "the chain verifies after the append: " + JSON.stringify(verified));
  assert.strictEqual(verified.lines, lines.length);
});

test("[AC-1 | FR-246 | 2.33 | spec-hooks-compliance | NFR-026] the first disclosure on a fresh project creates the log and starts the chain at the genesis value", () => {
  const root = makeRoot();
  assert.ok(!fs.existsSync(fx.currentLog(root)), "no log yet");
  assertAllowed(run(webFetchDoc(root, studentBody(ALLOWED_PARTY, INTEREST))));
  const lines = fx.readAllLines(root);
  const index = lines.findIndex((line) => JSON.parse(line).event === "ferpa-disclosure");
  assert.ok(index >= 0, "the disclosure line exists");
  if (index === 0) assert.strictEqual(JSON.parse(lines[0]).prev, audit.GENESIS_HASH);
  assert.strictEqual(audit.verify(audit.logPath(root), { root: root }).ok, true);
});

test("[AC-1 | FR-246 | 2.33 | spec-hooks-compliance | NFR-031] the appended record names the operation and the class, and holds no education-record content or payload text", () => {
  const root = makeRoot();
  assertAllowed(run(webFetchDoc(root, studentBody(ALLOWED_PARTY, INTEREST))));
  const records = ferpaRecords(root);
  assert.strictEqual(records.length, 1);
  const text = JSON.stringify(records[0]);
  assert.ok(text.indexOf("disclose") !== -1, "the operation is named: " + text);
  assert.ok(text.indexOf("student-record") !== -1, "the class tag is named: " + text);
  [STUDENT_ID, BODY_MARKER, "grade report", "Receiving-Party", "Legitimate-Interest"].forEach((needle) => {
    assert.ok(text.indexOf(needle) === -1, "found " + JSON.stringify(needle) + " in the record: " + text);
  });
});

test("[AC-3 | FR-246 | 2.33 | spec-hooks-compliance | NFR-026] a denied disclosure leaves a log that still verifies and holds no ferpa-disclosure line", () => {
  const root = makeRoot();
  fx.writeChain(root, [2]);
  assertDenied(run(webFetchDoc(root, studentBody(OFF_LIST_PARTY, INTEREST))));
  assert.strictEqual(ferpaRecords(root).length, 0);
  assert.strictEqual(audit.verify(audit.logPath(root), { root: root }).ok, true);
});
