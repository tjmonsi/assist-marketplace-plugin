// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the severity routing library of harness-governance Tranche 4
// (plugins/assist-plugin/hooks/lib/severity.js), task plan Step 37.
//
// Sources: specs/spec-hooks-code-scan.md (Requirement: Severity routing policy function, Requirement: Rule-mode store
// governs advisory versus blocking, Requirement: Advisory baseline and precision from user labels; Change Log 2026-11-13
// (Tranche 4 as-built reconciliation), MODIFIED Requirement: Severity routing policy function), the routing table of
// plugins/assist-plugin/rules/severity-policy.md (lines 83 and 87: a rule in advisory mode routes the block-merge row as
// inline-comment), and docs/requirements/FR-NFR-harness-governance.md (FR-237, FR-238, FR-239, NFR-034). The spec carries
// no SPEC-NNN id, so it is cited by file name.
//
// Traceability format: [AC-N | spec-hooks-code-scan.md Requirement | FR/NFR ids]. AC-N is the position of the Scenario
// inside its Requirement; a case with no Scenario of its own cites the Requirement and the as-built list of the
// Change Log.
//
// Public interface used (module exports of hooks/lib/severity.js, as the spec Change Log lists them):
//   route(finding)             -> "block-merge" | "inline-comment" | "log-only"; pure; reads severity and confidence only
//   applyMode(routing, mode)   -> the routing while mode is exactly "blocking"; in any other (advisory) mode a block-merge
//                                 becomes "inline-comment" and inline-comment and log-only stay as they are
//   parseRuleModes(text)       -> a rule-mode map read defensively from the text of the store
//   modeOf(modes, ruleId)      -> "advisory" | "blocking"; only the exact value "blocking" marks a rule blocking
//   labelOf(record)            -> true | false | null; a real boolean only
//   checkFinding(record)       -> the normalized record, or null
// A finding record is {id, rule_id, severity, confidence, file, line, timestamp, review_id?, label?} (the header of
// severity.js documents the character sets and the severity and confidence values).
//
// Run: node --test tests/hooks/severity.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const severity = require(path.join(REPO, "plugins", "assist-plugin", "hooks", "lib", "severity.js"));

const ROUTING = "spec-hooks-code-scan.md Requirement: Severity routing policy function";
const STORE = "spec-hooks-code-scan.md Requirement: Rule-mode store governs advisory versus blocking";
const BASELINE = "spec-hooks-code-scan.md Requirement: Advisory baseline and precision from user labels";
const AS_BUILT = "spec-hooks-code-scan.md Change Log 2026-11-13 (Tranche 4 as-built reconciliation)";

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.keys(value).forEach((k) => deepFreeze(value[k]));
  }
  return value;
}

// ---------------------------------------------------------------------------
// route(finding): the policy table
// ---------------------------------------------------------------------------

// severity-policy.md routing table. Block-merge only at confidence High and severity HIGH or CRITICAL.
const POLICY = [
  ["CRITICAL", "High", "block-merge"],
  ["HIGH", "High", "block-merge"],
  ["CRITICAL", "Medium", "inline-comment"],
  ["CRITICAL", "Low", "inline-comment"],
  ["HIGH", "Medium", "inline-comment"],
  ["HIGH", "Low", "inline-comment"],
  ["MEDIUM", "High", "inline-comment"],
  ["MEDIUM", "Medium", "inline-comment"],
  ["MEDIUM", "Low", "log-only"],
  ["LOW", "High", "log-only"],
  ["LOW", "Medium", "log-only"],
  ["LOW", "Low", "log-only"],
];

POLICY.forEach((row) => {
  test("[AC-1 | " + ROUTING + " | FR-239 | FR-237] route: " + row[0] + " at confidence " + row[1] + " gives " + row[2], () => {
    // Valid input: every cell of the severity by confidence table.
    assert.strictEqual(severity.route({ severity: row[0], confidence: row[1] }), row[2]);
  });
});

test("[AC-1 | " + ROUTING + " | FR-239] route: CRITICAL at High confidence is the block-merge example of the spec", () => {
  assert.strictEqual(severity.route({ severity: "CRITICAL", confidence: "High" }), "block-merge");
});

test("[AC-2 | " + ROUTING + " | FR-239] route: HIGH severity at Low confidence never returns block-merge (inline-comment or log-only)", () => {
  const routing = severity.route({ severity: "HIGH", confidence: "Low" });
  assert.notStrictEqual(routing, "block-merge");
  assert.ok(routing === "inline-comment" || routing === "log-only", "unexpected routing " + routing);
});

test("[AC-1 | " + ROUTING + " | FR-239] route: block-merge is returned for no combination except HIGH or CRITICAL at High confidence", () => {
  const severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const confidences = ["High", "Medium", "Low"];
  severities.forEach((s) => {
    confidences.forEach((c) => {
      const blocks = severity.route({ severity: s, confidence: c }) === "block-merge";
      assert.strictEqual(blocks, (s === "CRITICAL" || s === "HIGH") && c === "High", s + " at " + c);
    });
  });
});

test("[AC-1 | " + ROUTING + " | FR-239] route: MEDIUM routes to inline-comment or log-only and LOW routes to log-only at every confidence", () => {
  ["High", "Medium", "Low"].forEach((c) => {
    const medium = severity.route({ severity: "MEDIUM", confidence: c });
    assert.ok(medium === "inline-comment" || medium === "log-only", "MEDIUM at " + c + " gave " + medium);
    assert.strictEqual(severity.route({ severity: "LOW", confidence: c }), "log-only", "LOW at " + c);
  });
});

test("[AC-1 | " + ROUTING + " | FR-239] route: a finding that is not a record routes log-only, never block-merge", () => {
  // Null, empty, and type-mismatch inputs.
  [null, undefined, "CRITICAL", 42, true, [], {}, [{ severity: "CRITICAL", confidence: "High" }], function () {}].forEach((bad) => {
    assert.strictEqual(severity.route(bad), "log-only", "input " + String(bad));
  });
});

test("[AC-1 | " + ROUTING + " | FR-239] route: an unknown severity, an unknown confidence, or a missing field never routes block-merge", () => {
  const cases = [
    { severity: "SEVERE", confidence: "High" },
    { severity: "CRITICAL", confidence: "Certain" },
    { severity: "CRITICAL" },
    { confidence: "High" },
    { severity: 5, confidence: "High" },
    { severity: "CRITICAL", confidence: 1 },
    { severity: null, confidence: null },
    { severity: "", confidence: "" },
  ];
  cases.forEach((c) => {
    assert.notStrictEqual(severity.route(c), "block-merge", JSON.stringify(c));
  });
});

test("[AC-1 | " + ROUTING + " | FR-239] route is pure: it reads only severity and confidence, applies no mode, and leaves a frozen input untouched", () => {
  const finding = deepFreeze({ severity: "CRITICAL", confidence: "High", mode: "advisory", rule_id: "x", file: "a.js", line: 1 });
  assert.strictEqual(severity.route(finding), "block-merge", "a mode field on the finding does not change the routing");
  assert.strictEqual(severity.route(finding), severity.route(finding), "the same input gives the same routing");
  assert.deepStrictEqual(finding, { severity: "CRITICAL", confidence: "High", mode: "advisory", rule_id: "x", file: "a.js", line: 1 });
});

// ---------------------------------------------------------------------------
// applyMode(routing, mode): outside the exact mode "blocking" a block-merge becomes inline-comment (severity-policy.md)
// ---------------------------------------------------------------------------

test("[AC-3 | " + ROUTING + " | FR-239 | FR-238] applyMode: an advisory rule routes block-merge as inline-comment and keeps inline-comment and log-only", () => {
  assert.strictEqual(severity.applyMode("block-merge", "advisory"), "inline-comment");
  assert.strictEqual(severity.applyMode("inline-comment", "advisory"), "inline-comment");
  assert.strictEqual(severity.applyMode("log-only", "advisory"), "log-only");
});

test("[AC-3 | " + ROUTING + " | FR-239 | FR-238] applyMode: a blocking rule keeps the routing it is given", () => {
  assert.strictEqual(severity.applyMode("block-merge", "blocking"), "block-merge");
  assert.strictEqual(severity.applyMode("inline-comment", "blocking"), "inline-comment");
  assert.strictEqual(severity.applyMode("log-only", "blocking"), "log-only");
});

test("[AC-3 | " + AS_BUILT + " | FR-238 | FR-239] applyMode: every mode other than the exact string blocking never returns block-merge", () => {
  // Invalid, null, type-mismatch, case, and whitespace variants: only the exact value "blocking" keeps a block-merge.
  const notBlocking = [undefined, null, "", "advisory", "Blocking", "BLOCKING", " blocking", "blocking ", "block", "enforce", "true", true, 1, 0, {}, [], ["blocking"], { mode: "blocking" }];
  notBlocking.forEach((mode) => {
    assert.strictEqual(severity.applyMode("block-merge", mode), "inline-comment", "block-merge under " + JSON.stringify(mode));
    assert.strictEqual(severity.applyMode("inline-comment", mode), "inline-comment", "inline-comment under " + JSON.stringify(mode));
    assert.strictEqual(severity.applyMode("log-only", mode), "log-only", "log-only under " + JSON.stringify(mode));
  });
});

test("[AC-3 | " + ROUTING + " | FR-239 | FR-238] applyMode composes with route: an advisory CRITICAL at High confidence is recorded as inline-comment, a blocking one as block-merge", () => {
  const routed = severity.route({ severity: "CRITICAL", confidence: "High" });
  assert.strictEqual(routed, "block-merge");
  assert.strictEqual(severity.applyMode(routed, "advisory"), "inline-comment");
  assert.strictEqual(severity.applyMode(routed, "blocking"), "block-merge");
});

// ---------------------------------------------------------------------------
// parseRuleModes(text) and modeOf(modes, ruleId): advisory unless the exact value "blocking"
// ---------------------------------------------------------------------------

test("[AC-1 | " + STORE + " | FR-238 | FR-245] modeOf: a flat store maps a rule id to advisory or blocking, and an unnamed rule is advisory", () => {
  const modes = severity.parseRuleModes('{"sql-from-input":"blocking","other-rule":"advisory"}');
  assert.strictEqual(severity.modeOf(modes, "sql-from-input"), "blocking");
  assert.strictEqual(severity.modeOf(modes, "other-rule"), "advisory");
  assert.strictEqual(severity.modeOf(modes, "not-in-store"), "advisory");
});

test("[AC-1 | " + STORE + " | FR-238] modeOf: an absent store (no text, no map) reads advisory for every rule", () => {
  // Null and empty inputs: the store file does not exist.
  [undefined, null, ""].forEach((text) => {
    const modes = severity.parseRuleModes(text);
    assert.strictEqual(severity.modeOf(modes, "sql-from-input"), "advisory", "text " + JSON.stringify(text));
  });
  [undefined, null].forEach((modes) => {
    assert.strictEqual(severity.modeOf(modes, "sql-from-input"), "advisory", "modes " + String(modes));
  });
});

test("[AC-2 | " + STORE + " | FR-238] parseRuleModes: malformed or oddly shaped text reads advisory and never throws", () => {
  const malformed = ["{", "not json", '{"r1":', '{"r1":"blocking"', "}{", "null", "[]", '["blocking"]', '"blocking"', "42", "true", '{"r1":"blocking"}}', "\u0000", "<xml/>"];
  malformed.forEach((text) => {
    let modes;
    assert.doesNotThrow(() => {
      modes = severity.parseRuleModes(text);
    }, "parse " + JSON.stringify(text));
    assert.notStrictEqual(severity.modeOf(modes, "r1"), "blocking", "store " + JSON.stringify(text) + " must not mark r1 blocking");
    assert.strictEqual(severity.modeOf(modes, "r1"), "advisory", "store " + JSON.stringify(text));
  });
});

test("[AC-2 | " + AS_BUILT + " | FR-238] modeOf: any value other than the exact string blocking reads advisory", () => {
  const values = ["BLOCKING", "Blocking", " blocking", "blocking ", "block", "enforce", "", true, 1, null, ["blocking"], { mode: "blocking" }];
  values.forEach((value) => {
    const modes = severity.parseRuleModes(JSON.stringify({ r1: value }));
    assert.strictEqual(severity.modeOf(modes, "r1"), "advisory", "value " + JSON.stringify(value));
  });
});

test("[AC-2 | " + STORE + " | FR-238] modeOf: a hostile rule id or inherited property name never reads blocking", () => {
  // Security-adjacent: names an object inherits, and non-string ids.
  const modes = severity.parseRuleModes('{"r1":"blocking"}');
  ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf", "", undefined, null, 42, {}, ["r1"]].forEach((id) => {
    assert.strictEqual(severity.modeOf(modes, id), "advisory", "rule id " + JSON.stringify(id));
  });
  const empty = severity.parseRuleModes("{}");
  ["constructor", "__proto__", "toString"].forEach((id) => {
    assert.strictEqual(severity.modeOf(empty, id), "advisory", "empty store, rule id " + id);
  });
});

test("[AC-1 | " + STORE + " | FR-238] parseRuleModes and modeOf never return blocking for any input in a mixed corpus of defective stores", () => {
  const corpus = [undefined, null, "", " ", "{", "[]", "null", "0", '{"r1":null}', '{"r1":false}', '{"r1":"Blocking"}', '{"R1":"blocking"}', '{"r1 ":"blocking"}', '{"r2":"blocking"}', 42, {}, [], true];
  corpus.forEach((text) => {
    let modes;
    assert.doesNotThrow(() => {
      modes = severity.parseRuleModes(text);
    });
    assert.notStrictEqual(severity.modeOf(modes, "r1"), "blocking", JSON.stringify(text));
  });
});

// ---------------------------------------------------------------------------
// labelOf(record): a real boolean only
// ---------------------------------------------------------------------------

test("[AC-2 | " + BASELINE + " | FR-238 | NFR-034] labelOf: a real boolean label is returned, and false is a label, not an absent one", () => {
  assert.strictEqual(severity.labelOf({ label: true }), true);
  assert.strictEqual(severity.labelOf({ label: false }), false);
});

test("[AC-1 | " + BASELINE + " | FR-238 | NFR-034] labelOf: an absent label is unlabelled (null)", () => {
  assert.strictEqual(severity.labelOf({}), null);
  assert.strictEqual(severity.labelOf({ id: "f1", severity: "HIGH" }), null);
});

test("[AC-1 | " + AS_BUILT + " | FR-238 | NFR-034] labelOf: the string true, a number, or any non-boolean value is unlabelled and never counted", () => {
  // Type-mismatch: an agent or a forged record cannot set a label with a look-alike value.
  const lookAlikes = ["true", "false", "True", "TRUE", "yes", "1", "0", 1, 0, -1, null, undefined, [], [true], {}, { value: true }, "", " true"];
  lookAlikes.forEach((value) => {
    assert.strictEqual(severity.labelOf({ label: value }), null, "label " + JSON.stringify(value));
  });
});

test("[AC-1 | " + BASELINE + " | FR-238 | NFR-034] labelOf: a value that is not a record is unlabelled", () => {
  [null, undefined, "x", 42, true, []].forEach((bad) => {
    assert.strictEqual(severity.labelOf(bad), null, "input " + JSON.stringify(bad));
  });
});

// ---------------------------------------------------------------------------
// checkFinding(record): the one validator every reader and writer shares
// ---------------------------------------------------------------------------

function validRecord(over) {
  return Object.assign(
    { id: "f-1", rule_id: "sql-from-input", severity: "HIGH", confidence: "High", file: "src/db.js", line: 3, timestamp: "2026-11-13T09:30:00Z", review_id: "sess-1" },
    over || {}
  );
}

test("[AC-1 | " + AS_BUILT + " | FR-238 | NFR-034] checkFinding: a complete record is accepted and its fields survive", () => {
  const result = severity.checkFinding(validRecord());
  assert.ok(result, "a valid record must not be rejected");
  ["id", "rule_id", "severity", "confidence", "file", "line", "timestamp", "review_id"].forEach((key) => {
    assert.strictEqual(result[key], validRecord()[key], key);
  });
});

test("[AC-1 | " + AS_BUILT + " | FR-238] checkFinding: review_id is optional and a user label travels through labelOf", () => {
  const withoutReview = validRecord();
  delete withoutReview.review_id;
  assert.ok(severity.checkFinding(withoutReview), "a record with no review_id is valid");
  assert.strictEqual(severity.labelOf(severity.checkFinding(validRecord({ label: true }))), true);
  assert.strictEqual(severity.labelOf(severity.checkFinding(validRecord({ label: false }))), false);
});

test("[AC-1 | " + AS_BUILT + " | FR-238 | NFR-031] checkFinding: a file path holding a NUL character is rejected", () => {
  // Security-adjacent: a path with a NUL (the same class the write bar denies).
  assert.strictEqual(severity.checkFinding(validRecord({ file: "src/db.js\u0000.md" })), null);
  assert.strictEqual(severity.checkFinding(validRecord({ file: "\u0000" })), null);
  assert.strictEqual(severity.checkFinding(validRecord({ file: "src/\u0000/db.js" })), null);
});

test("[AC-1 | " + AS_BUILT + " | FR-238 | NFR-031] checkFinding: an over-long file path is rejected, and the 4096-character path is the boundary that still passes", () => {
  const atLimit = "a".repeat(4096);
  const overLimit = "a".repeat(4097);
  assert.ok(severity.checkFinding(validRecord({ file: atLimit })), "4096 characters is not over-long");
  assert.strictEqual(severity.checkFinding(validRecord({ file: overLimit })), null);
  assert.strictEqual(severity.checkFinding(validRecord({ file: "d/".repeat(60000) + "x.js" })), null);
});

test("[AC-1 | " + AS_BUILT + " | FR-238] checkFinding: a record that is not an object, or a required field that is missing, is rejected", () => {
  [null, undefined, "x", 42, true, [], [validRecord()]].forEach((bad) => {
    assert.strictEqual(severity.checkFinding(bad), null, "input " + JSON.stringify(bad));
  });
  ["id", "rule_id", "severity", "confidence", "file", "line", "timestamp"].forEach((key) => {
    const record = validRecord();
    delete record[key];
    assert.strictEqual(severity.checkFinding(record), null, "missing " + key);
  });
});

test("[AC-1 | " + AS_BUILT + " | FR-238] checkFinding: an id or rule id outside its character set or length is rejected", () => {
  // The header of severity.js: 1 to 64 characters of A-Z a-z 0-9 . _ : -, starting with a letter or digit.
  ["", " ", "has space", "-lead", ".lead", "a\nb", "a/b", "x'; DROP TABLE t;--", "a".repeat(65), "<script>", 7, null].forEach((bad) => {
    assert.strictEqual(severity.checkFinding(validRecord({ id: bad })), null, "id " + JSON.stringify(bad));
    assert.strictEqual(severity.checkFinding(validRecord({ rule_id: bad })), null, "rule_id " + JSON.stringify(bad));
  });
  assert.ok(severity.checkFinding(validRecord({ id: "a".repeat(64) })), "64 characters passes");
  assert.ok(severity.checkFinding(validRecord({ rule_id: "a.b_c:d-e" })), "the allowed punctuation passes");
});

test("[AC-1 | " + AS_BUILT + " | FR-238 | FR-239] checkFinding: an unknown severity or confidence is rejected", () => {
  ["SEVERE", "", "critical!", 3, null, {}].forEach((bad) => {
    assert.strictEqual(severity.checkFinding(validRecord({ severity: bad })), null, "severity " + JSON.stringify(bad));
  });
  ["Certain", "", "Highest", 3, null, {}].forEach((bad) => {
    assert.strictEqual(severity.checkFinding(validRecord({ confidence: bad })), null, "confidence " + JSON.stringify(bad));
  });
});

test("[AC-1 | " + AS_BUILT + " | FR-238] checkFinding: a line that is not a positive number, or a timestamp that is not an ISO time, is rejected", () => {
  [0, -1, "3", NaN, null, undefined, {}].forEach((bad) => {
    assert.strictEqual(severity.checkFinding(validRecord({ line: bad })), null, "line " + JSON.stringify(bad));
  });
  ["yesterday", "2026-11-13", "13/11/2026", "", 20261113, null].forEach((bad) => {
    assert.strictEqual(severity.checkFinding(validRecord({ timestamp: bad })), null, "timestamp " + JSON.stringify(bad));
  });
});

test("[AC-1 | " + AS_BUILT + " | FR-238] checkFinding does not change the record it is given", () => {
  const record = deepFreeze(validRecord({ label: true }));
  assert.doesNotThrow(() => severity.checkFinding(record));
  assert.deepStrictEqual(record, validRecord({ label: true }));
});
