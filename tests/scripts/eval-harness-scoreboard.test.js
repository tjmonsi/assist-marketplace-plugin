// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the version-controlled scoreboard of the evaluation harness (Group A, Step 17):
// plugins/assist-plugin/scripts/eval-harness/scoreboard.js (`validateEntry`, `writeEntries`, `readScoreboard`,
// `latestRows`, `casesFor`, `previousVersion`, `checkRowsPresent`, `describeRow`, `formatScore`, `compareVersions`,
// `SUITES`, `IDENTIFIER_PATTERN`, `VERSION_PATTERN`).
//
// Sources: specs/spec-evaluation-harness.md (Requirement: Benchmark section and release-over-release comparison,
// Scenarios Scoreboard row added for a release, Scoreboard row missing, Per-case scores stored for a release; Non-functional
// requirements addressed, NFR-039), and docs/task-plans/task-plan-evaluation-harness-20261125-0717.md (Step 10, Step 17).
// Requirement text: docs/requirements/FR-NFR-harness-governance.md (FR-276, FR-278, NFR-039, UR-079, SC-024; NFR-039
// scenario at line 2429).
//
// Traceability format: [AC-N | spec file | FR/NFR ids | UR/SC ids]. The spec has no SPEC-NNN id, so it is cited by file
// name. AC-N is the position of the Scenario inside Requirement "Benchmark section and release-over-release comparison"
// (R9): AC-7 Scoreboard row added for a release, AC-8 Scoreboard row missing, AC-13 Per-case scores stored for a release.
// NFR-039 has no Scenario in the spec for the aggregate row; its test cites the requirements document scenario.
//
// Contract used:
//   - An aggregate row holds version, suite, harnessVersion, passAtOne, structuralScore, judgeScore, caseCount. A
//     per-case record holds version, suite, caseId, harnessVersion, passAtOne, k, c, structuralScore, judgeScore,
//     runCount. The writer accepts an allowlist of fields and refuses any other key, and it refuses a string value that
//     does not match an identifier or version pattern, so no reference solution, hidden-suite text, or agent output text
//     can enter the file (NFR-039).
//   - validateEntry(type, entry) returns { ok, errors: [{ field, message }] } and never echoes a value.
//   - writeEntries({ scoreboardPath, aggregates, cases }) writes nothing when any entry is refused.
//   - checkRowsPresent(scoreboard, version, suites) returns a finding that names the version for each suite with no row.
//   - The numbers in the fixtures are test examples.
//
// Run: node --test tests/scripts/eval-harness-scoreboard.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLUGIN = path.join(__dirname, "..", "..", "plugins", "assist-plugin");
const scoreboard = require(path.join(PLUGIN, "scripts", "eval-harness", "scoreboard.js"));

const created = [];
after(() => {
  created.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-scoreboard-test-"));
  created.push(dir);
  return path.join(dir, "scoreboard.json");
}

const HIDDEN_TEXT = "[AC-1 | spec-demo | FR-1] adds two numbers and returns the sum";
const OUTPUT_TEXT = "def add(a, b): return a + b  # agent output text";

function aggregateRow(version, suite, extra) {
  const base = { version, suite, harnessVersion: "1.0.0", caseCount: 2 };
  if (suite === "dev") {
    base.passAtOne = 0.6;
  } else {
    base.structuralScore = 0.9;
    base.judgeScore = 0.7;
  }
  return Object.assign(base, extra || {});
}

function caseRecord(version, suite, caseId, extra) {
  const base = { version, suite, caseId, harnessVersion: "1.0.0", runCount: 5 };
  if (suite === "dev") {
    Object.assign(base, { passAtOne: 0.6, k: 5, c: 3 });
  } else {
    Object.assign(base, { structuralScore: 0.9, judgeScore: 0.7 });
  }
  return Object.assign(base, extra || {});
}

function fieldsOf(validation) {
  return validation.errors.map((entry) => entry.field);
}

function stringValues(value, out) {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((entry) => stringValues(entry, out));
  } else if (value && typeof value === "object") {
    Object.keys(value).forEach((key) => stringValues(value[key], out));
  }
  return out;
}

// ---------------------------------------------------------------------------
// NFR-039: the allowlist and the content guard
// ---------------------------------------------------------------------------

test("[AC-7 | spec-evaluation-harness | FR-276 | NFR-039 | SC-024] an aggregate row of version, suite, and scores is accepted", () => {
  assert.strictEqual(scoreboard.validateEntry("aggregate", aggregateRow("1.14.7", "dev")).ok, true);
  assert.strictEqual(scoreboard.validateEntry("aggregate", aggregateRow("1.14.7", "spec")).ok, true);
});

test("[AC-13 | spec-evaluation-harness | FR-278 | NFR-039] a per-case record of version, suite, case id, scores, and run count is accepted", () => {
  assert.strictEqual(scoreboard.validateEntry("case", caseRecord("1.14.7", "dev", "case-a")).ok, true);
  assert.strictEqual(scoreboard.validateEntry("case", caseRecord("1.14.7", "spec", "case-s")).ok, true);
});

test("[AC-7 | spec-evaluation-harness | NFR-039] an aggregate row with a key outside the allowlist is refused and the key is named", () => {
  const validation = scoreboard.validateEntry("aggregate", aggregateRow("1.14.7", "dev", { output: "anything" }));
  assert.strictEqual(validation.ok, false);
  assert.ok(fieldsOf(validation).indexOf("output") !== -1, JSON.stringify(validation.errors));
});

[
  ["hiddenSuite", HIDDEN_TEXT],
  ["referenceSolution", "module.exports = {}"],
  ["agentOutput", OUTPUT_TEXT],
  ["notes", "a free-text note"],
].forEach((pair) => {
  test("[AC-13 | spec-evaluation-harness | FR-278 | NFR-039] a per-case record that carries a planted " + pair[0] + " key is refused and the planted text is not echoed", () => {
    // Security-adjacent: oracle text and agent output text must never enter the file.
    const entry = caseRecord("1.14.7", "dev", "case-a");
    entry[pair[0]] = pair[1];
    const validation = scoreboard.validateEntry("case", entry);
    assert.strictEqual(validation.ok, false);
    assert.ok(fieldsOf(validation).indexOf(pair[0]) !== -1);
    assert.ok(!JSON.stringify(validation.errors).includes(pair[1]), "the refusal echoed the planted text");
  });
});

[
  ["caseId", HIDDEN_TEXT],
  ["caseId", OUTPUT_TEXT],
  ["caseId", "case with spaces"],
  ["caseId", "../escape"],
  ["caseId", "x".repeat(65)],
  ["version", "release one"],
  ["version", "1.14"],
  ["harnessVersion", HIDDEN_TEXT],
  ["suite", "prod"],
  ["suite", OUTPUT_TEXT],
].forEach((pair) => {
  test("[AC-13 | spec-evaluation-harness | FR-278 | NFR-039] a per-case record whose " + pair[0] + " reads " + JSON.stringify(pair[1].slice(0, 24)) + " is refused, because the value is not an identifier or version", () => {
    // Invalid, boundary, and injection-shaped string values in permitted fields.
    const entry = caseRecord("1.14.7", "dev", "case-a");
    entry[pair[0]] = pair[1];
    const validation = scoreboard.validateEntry("case", entry);
    assert.strictEqual(validation.ok, false);
    assert.ok(fieldsOf(validation).indexOf(pair[0]) !== -1);
    assert.ok(!JSON.stringify(validation.errors).includes(pair[1]), "the refusal echoed the value");
  });
});

test("[AC-13 | spec-evaluation-harness | FR-278 | NFR-039] a nested object or list in a permitted field is refused", () => {
  // Type mismatch: a long text cannot ride in a nested value.
  const nested = scoreboard.validateEntry("case", caseRecord("1.14.7", "dev", "case-a", { passAtOne: { text: HIDDEN_TEXT } }));
  assert.strictEqual(nested.ok, false);
  const list = scoreboard.validateEntry("case", caseRecord("1.14.7", "dev", "case-a", { k: [HIDDEN_TEXT] }));
  assert.strictEqual(list.ok, false);
});

[1.01, -0.01, "0.5", NaN, Infinity].forEach((value) => {
  test("[AC-13 | spec-evaluation-harness | FR-278 | NFR-039] a pass@1 value of " + String(value) + " is refused", () => {
    // Boundary and type mismatch: a score is a number from 0 to 1, or null when absent.
    const validation = scoreboard.validateEntry("case", caseRecord("1.14.7", "dev", "case-a", { passAtOne: value }));
    assert.strictEqual(validation.ok, false);
    assert.ok(fieldsOf(validation).indexOf("passAtOne") !== -1);
  });
});

test("[AC-13 | spec-evaluation-harness | FR-278] the boundary scores 0 and 1 and an absent score (null) are accepted", () => {
  [0, 1, null].forEach((value) => {
    assert.strictEqual(scoreboard.validateEntry("case", caseRecord("1.14.7", "dev", "case-a", { passAtOne: value })).ok, true, String(value));
  });
});

[-1, 1.5, "3", 1e9].forEach((value) => {
  test("[AC-13 | spec-evaluation-harness | FR-278] a run count of " + JSON.stringify(value) + " is refused", () => {
    // Boundary and type mismatch: a count is a whole number from 0 up.
    const validation = scoreboard.validateEntry("case", caseRecord("1.14.7", "dev", "case-a", { runCount: value }));
    assert.strictEqual(validation.ok, false);
  });
});

test("[AC-13 | spec-evaluation-harness | FR-278] a per-case record with no case id is refused and names the case id", () => {
  const entry = caseRecord("1.14.7", "dev", "case-a");
  delete entry.caseId;
  const validation = scoreboard.validateEntry("case", entry);
  assert.strictEqual(validation.ok, false);
  assert.ok(fieldsOf(validation).indexOf("caseId") !== -1);
});

test("[AC-7 | spec-evaluation-harness | FR-276] an aggregate row with no version is refused and names the version", () => {
  const entry = aggregateRow("1.14.7", "dev");
  delete entry.version;
  const validation = scoreboard.validateEntry("aggregate", entry);
  assert.strictEqual(validation.ok, false);
  assert.ok(fieldsOf(validation).indexOf("version") !== -1);
});

[null, undefined, "entry", 7, []].forEach((value) => {
  test("[AC-7 | spec-evaluation-harness | NFR-039] the non-object entry " + JSON.stringify(value) + " is refused", () => {
    // Type mismatch.
    assert.strictEqual(scoreboard.validateEntry("aggregate", value).ok, false);
    assert.strictEqual(scoreboard.validateEntry("case", value).ok, false);
  });
});

// ---------------------------------------------------------------------------
// AC-7 and AC-13: rows and per-case records written for a release
// ---------------------------------------------------------------------------

test("[AC-7 | spec-evaluation-harness | FR-276 | UR-079 | SC-024] a completed benchmark for version 1.14.7 leaves one row for 1.14.7 in each suite run", () => {
  const file = tmpFile();
  const written = scoreboard.writeEntries({
    scoreboardPath: file,
    aggregates: [aggregateRow("1.14.7", "dev"), aggregateRow("1.14.7", "spec")],
    cases: [caseRecord("1.14.7", "dev", "c1"), caseRecord("1.14.7", "spec", "c2")],
  });
  assert.strictEqual(written.ok, true, JSON.stringify(written));
  const read = scoreboard.readScoreboard(file);
  assert.strictEqual(read.ok, true);
  assert.strictEqual(read.exists, true);
  ["dev", "spec"].forEach((suite) => {
    const rows = read.scoreboard.aggregates.filter((row) => row.version === "1.14.7" && row.suite === suite);
    assert.strictEqual(rows.length, 1, "no single row for 1.14.7 " + suite);
  });
});

test("[AC-13 | spec-evaluation-harness | FR-278 | NFR-039 | UR-079] a suite with cases c1 and c2 leaves a per-case record for c1 and for c2 keyed to the release version", () => {
  const file = tmpFile();
  scoreboard.writeEntries({
    scoreboardPath: file,
    aggregates: [aggregateRow("1.14.7", "dev")],
    cases: [caseRecord("1.14.7", "dev", "c1"), caseRecord("1.14.7", "dev", "c2")],
  });
  const read = scoreboard.readScoreboard(file);
  const records = scoreboard.casesFor(read.scoreboard, "1.14.7", "dev");
  assert.deepStrictEqual(records.map((entry) => entry.caseId).sort(), ["c1", "c2"]);
  records.forEach((entry) => assert.strictEqual(entry.version, "1.14.7"));
});

test("[AC-13 | spec-evaluation-harness | FR-278 | NFR-039] every string in the stored file is an identifier or a version, so no hidden-suite or output text is present", () => {
  const file = tmpFile();
  scoreboard.writeEntries({
    scoreboardPath: file,
    aggregates: [aggregateRow("1.14.7", "dev"), aggregateRow("1.14.7", "spec")],
    cases: [caseRecord("1.14.7", "dev", "c1"), caseRecord("1.14.7", "spec", "c2")],
  });
  const strings = stringValues(JSON.parse(fs.readFileSync(file, "utf8")), []);
  assert.ok(strings.length > 0);
  strings.forEach((text) => {
    assert.ok(/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(text), "the stored file holds a string that is not an identifier: " + text);
  });
});

test("[AC-13 | spec-evaluation-harness | FR-278 | NFR-039] a write that holds one refused entry writes nothing, not even the valid entries", () => {
  const file = tmpFile();
  const written = scoreboard.writeEntries({
    scoreboardPath: file,
    aggregates: [aggregateRow("1.14.7", "dev")],
    cases: [caseRecord("1.14.7", "dev", "c1"), caseRecord("1.14.7", "dev", "c2", { agentOutput: OUTPUT_TEXT })],
  });
  assert.strictEqual(written.ok, false);
  assert.ok(written.errors.length >= 1);
  assert.ok(!JSON.stringify(written.errors).includes(OUTPUT_TEXT));
  assert.strictEqual(fs.existsSync(file), false, "no scoreboard file may be created by a refused write");
});

test("[AC-13 | spec-evaluation-harness | FR-278 | NFR-039] a refused write leaves an existing scoreboard unchanged", () => {
  const file = tmpFile();
  scoreboard.writeEntries({ scoreboardPath: file, aggregates: [aggregateRow("1.14.6", "dev")], cases: [caseRecord("1.14.6", "dev", "c1")] });
  const before = fs.readFileSync(file, "utf8");
  const refused = scoreboard.writeEntries({ scoreboardPath: file, aggregates: [aggregateRow("1.14.7", "dev", { note: "x" })], cases: [] });
  assert.strictEqual(refused.ok, false);
  assert.strictEqual(fs.readFileSync(file, "utf8"), before);
});

test("[AC-7 | spec-evaluation-harness | FR-276 | SC-024] a rerun of one release replaces its rows and records instead of duplicating them", () => {
  const file = tmpFile();
  const request = { scoreboardPath: file, aggregates: [aggregateRow("1.14.7", "dev")], cases: [caseRecord("1.14.7", "dev", "c1")] };
  scoreboard.writeEntries(request);
  scoreboard.writeEntries(request);
  const read = scoreboard.readScoreboard(file);
  assert.strictEqual(read.scoreboard.aggregates.length, 1);
  assert.strictEqual(read.scoreboard.cases.length, 1);
});

test("[AC-7 | spec-evaluation-harness | FR-276 | SC-024] a later release adds its rows beside the earlier release rows", () => {
  const file = tmpFile();
  scoreboard.writeEntries({ scoreboardPath: file, aggregates: [aggregateRow("1.14.6", "dev")], cases: [caseRecord("1.14.6", "dev", "c1")] });
  scoreboard.writeEntries({ scoreboardPath: file, aggregates: [aggregateRow("1.14.7", "dev")], cases: [caseRecord("1.14.7", "dev", "c1")] });
  const read = scoreboard.readScoreboard(file);
  assert.deepStrictEqual(read.scoreboard.aggregates.map((row) => row.version).sort(), ["1.14.6", "1.14.7"]);
  assert.strictEqual(read.scoreboard.cases.length, 2);
});

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

test("[AC-8 | spec-evaluation-harness | FR-276 | UR-079] a scoreboard file that does not exist reads as no scoreboard stored, not as an error", () => {
  const read = scoreboard.readScoreboard(path.join(path.dirname(tmpFile()), "absent.json"));
  assert.strictEqual(read.ok, true);
  assert.strictEqual(read.exists, false);
  assert.deepStrictEqual(read.scoreboard.aggregates, []);
  assert.deepStrictEqual(read.scoreboard.cases, []);
});

test("[AC-8 | spec-evaluation-harness | FR-276 | NFR-039] a scoreboard file that is not valid JSON is an error and the file text is not echoed", () => {
  const file = tmpFile();
  fs.writeFileSync(file, "{ SENTINEL-RAW-FILE-TEXT ");
  const read = scoreboard.readScoreboard(file);
  assert.strictEqual(read.ok, false);
  assert.ok(!JSON.stringify(read).includes("SENTINEL-RAW-FILE-TEXT"));
});

test("[AC-8 | spec-evaluation-harness | FR-276 | NFR-039] a scoreboard file that holds an entry the writer would refuse is not trusted", () => {
  const file = tmpFile();
  fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, aggregates: [aggregateRow("1.14.7", "dev", { leaked: HIDDEN_TEXT })], cases: [] }));
  const read = scoreboard.readScoreboard(file);
  assert.strictEqual(read.ok, false);
  assert.ok(!JSON.stringify(read).includes(HIDDEN_TEXT));
});

test("[AC-8 | spec-evaluation-harness | FR-276] a scoreboard file that is not an object of two lists is an error", () => {
  // Type mismatch.
  const file = tmpFile();
  fs.writeFileSync(file, JSON.stringify([1, 2, 3]));
  assert.strictEqual(scoreboard.readScoreboard(file).ok, false);
});

// ---------------------------------------------------------------------------
// AC-8: a missing row is a finding that names the version
// ---------------------------------------------------------------------------

test("[AC-8 | spec-evaluation-harness | FR-276 | UR-079 | SC-024] a completed section with a scoreboard that holds no row for the version is a finding that names the version", () => {
  const board = { schemaVersion: 1, aggregates: [aggregateRow("1.14.6", "dev")], cases: [] };
  const check = scoreboard.checkRowsPresent(board, "1.14.7", ["dev"]);
  assert.strictEqual(check.ok, false);
  assert.strictEqual(check.findings.length, 1);
  assert.ok(check.findings[0].includes("1.14.7"), check.findings[0]);
  assert.ok(check.findings[0].includes("dev"), check.findings[0]);
});

test("[AC-8 | spec-evaluation-harness | FR-276 | SC-024] a scoreboard that lacks the row of one suite only names that suite", () => {
  const board = { schemaVersion: 1, aggregates: [aggregateRow("1.14.7", "dev")], cases: [] };
  const check = scoreboard.checkRowsPresent(board, "1.14.7", ["dev", "spec"]);
  assert.strictEqual(check.ok, false);
  assert.strictEqual(check.findings.length, 1);
  assert.ok(check.findings[0].includes("spec"));
  assert.ok(check.findings[0].includes("1.14.7"));
});

test("[AC-7 | spec-evaluation-harness | FR-276 | SC-024] a scoreboard that holds a row for the version in every suite run has no finding", () => {
  const board = { schemaVersion: 1, aggregates: [aggregateRow("1.14.7", "dev"), aggregateRow("1.14.7", "spec")], cases: [] };
  const check = scoreboard.checkRowsPresent(board, "1.14.7", ["dev", "spec"]);
  assert.strictEqual(check.ok, true);
  assert.deepStrictEqual(check.findings, []);
});

test("[AC-8 | spec-evaluation-harness | FR-276 | SC-024] an empty scoreboard has no row for any suite and each missing suite is a finding", () => {
  // Null/empty.
  const check = scoreboard.checkRowsPresent({ schemaVersion: 1, aggregates: [], cases: [] }, "1.14.7", ["dev", "spec"]);
  assert.strictEqual(check.ok, false);
  assert.strictEqual(check.findings.length, 2);
});

test("[AC-8 | spec-evaluation-harness | FR-276 | SC-024] a row for another version does not stand in for the row of the version asked for", () => {
  const board = { schemaVersion: 1, aggregates: [aggregateRow("1.14.70", "dev")], cases: [] };
  assert.strictEqual(scoreboard.checkRowsPresent(board, "1.14.7", ["dev"]).ok, false);
});

test("[AC-8 | spec-evaluation-harness | FR-276 | SC-024] no suites asked for means nothing missing", () => {
  assert.strictEqual(scoreboard.checkRowsPresent({ schemaVersion: 1, aggregates: [], cases: [] }, "1.14.7", []).ok, true);
});

// ---------------------------------------------------------------------------
// Readers used by the comparison and the release-check section
// ---------------------------------------------------------------------------

test("[AC-7 | spec-evaluation-harness | FR-276 | UR-079] latestRows returns the newest row of each suite", () => {
  const board = {
    schemaVersion: 1,
    aggregates: [aggregateRow("1.14.6", "dev"), aggregateRow("1.14.7", "dev"), aggregateRow("1.9.0", "dev"), aggregateRow("1.14.6", "spec")],
    cases: [],
  };
  const rows = scoreboard.latestRows(board);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows.find((row) => row.suite === "dev").version, "1.14.7");
  assert.strictEqual(rows.find((row) => row.suite === "spec").version, "1.14.6");
});

test("[AC-7 | spec-evaluation-harness | FR-276 | UR-079] latestRows of an empty scoreboard is empty", () => {
  // Null/empty.
  assert.deepStrictEqual(scoreboard.latestRows({ schemaVersion: 1, aggregates: [], cases: [] }), []);
  assert.deepStrictEqual(scoreboard.latestRows(undefined), []);
});

test("[AC-7 | spec-evaluation-harness | FR-276 | UR-079] compareVersions orders by number, so 1.9.0 is older than 1.10.0 and 1.14.7 is newer than 1.14.6", () => {
  assert.ok(scoreboard.compareVersions("1.9.0", "1.10.0") < 0);
  assert.ok(scoreboard.compareVersions("1.14.7", "1.14.6") > 0);
  assert.strictEqual(scoreboard.compareVersions("1.14.7", "1.14.7"), 0);
  assert.ok(scoreboard.compareVersions("1.14.7-rc.1", "1.14.7") < 0, "a pre-release sorts before its release");
});

test("[AC-7 | spec-evaluation-harness | FR-278 | UR-079] previousVersion is the newest earlier release that holds per-case records for the suite, or null", () => {
  const board = {
    schemaVersion: 1,
    aggregates: [],
    cases: [caseRecord("1.14.5", "dev", "c1"), caseRecord("1.14.6", "dev", "c1"), caseRecord("1.14.8", "dev", "c1"), caseRecord("1.14.6", "spec", "c2")],
  };
  assert.strictEqual(scoreboard.previousVersion(board, "1.14.7", "dev"), "1.14.6");
  assert.strictEqual(scoreboard.previousVersion(board, "1.14.5", "dev"), null);
  assert.strictEqual(scoreboard.previousVersion(board, "1.14.7", "spec"), "1.14.6");
});

test("[AC-7 | spec-evaluation-harness | FR-276 | UR-079] describeRow holds the version, the suite, and the scores and no other text", () => {
  const dev = scoreboard.describeRow(aggregateRow("1.14.7", "dev"));
  assert.ok(dev.includes("1.14.7") && dev.includes("dev") && dev.includes("0.6"), dev);
  const spec = scoreboard.describeRow(aggregateRow("1.14.7", "spec"));
  assert.ok(spec.includes("1.14.7") && spec.includes("spec") && spec.includes("0.9") && spec.includes("0.7"), spec);
});

test("[AC-7 | spec-evaluation-harness | FR-276 | UR-079] a row with no score describes the score as absent", () => {
  const line = scoreboard.describeRow(aggregateRow("1.14.7", "dev", { passAtOne: null }));
  assert.match(line, /absent/);
  assert.strictEqual(scoreboard.formatScore(null), "absent");
  assert.strictEqual(scoreboard.formatScore(undefined), "absent");
  assert.strictEqual(scoreboard.formatScore(0.6), "0.6");
});

test("[AC-7 | spec-evaluation-harness | FR-276 | NFR-039] SUITES names dev and spec and the exported patterns refuse free text", () => {
  assert.deepStrictEqual(scoreboard.SUITES, ["dev", "spec"]);
  assert.ok(scoreboard.IDENTIFIER_PATTERN.test("case-a"));
  assert.ok(!scoreboard.IDENTIFIER_PATTERN.test(HIDDEN_TEXT));
  assert.ok(scoreboard.VERSION_PATTERN.test("1.14.7"));
  assert.ok(!scoreboard.VERSION_PATTERN.test("1.14.7 and more text"));
});
