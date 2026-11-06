// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for first-session logging and logged disablement (harness-governance Tranche 2,
// Step 13): the `--session-start` path of plugins/assist-plugin/hooks/health-check.js.
//
// Sources: specs/spec-hooks-audit.md (Requirement: Logging from the first session and logged disablement: AC-1
// Fresh install, AC-2 Guard disabled), specs/spec-hooks-health-check.md (Change Log 2026-11-06, Requirement:
// Disablement logging at session start: Scenario "Disabled guard logged once"), and
// docs/requirements/FR-NFR-harness-governance.md v1.3 (FR-228, NFR-026, NFR-032, NFR-031). Task plan:
// docs/task-plans/task-plan-harness-governance-20261028-0759.md, Steps 13 and 20.
//
// Traceability format: [AC-N | spec file | FR/NFR ids | UR/BR ids]. The spec has no SPEC-NNN id, so it is cited by
// file name.
//
// Contract used:
//   - `node hooks/health-check.js --session-start` runs at session start. With the project root in CLAUDE_PROJECT_DIR
//     (else the git root of the working directory) it makes sure the governance audit log exists (a first-session
//     "audit-initialized" event when the log is absent) and appends one "guard-disabled" event per guard listed in
//     ${CLAUDE_PLUGIN_DATA}/hooks-disabled.json. The event names the guard; the record's `ts` is the time. The format
//     of hooks-disabled.json is {<hook>: {reason, ts}}.
//   - Disablement is logged once per guard while it stays disabled: a later session adds no duplicate. A guard that
//     leaves the list and returns is a new disablement and is logged again. The audit log is per project, so each
//     project's log gets its own event.
//   - Recording fails open: it never changes whether a guard is disabled, and the next session retries after a failure.
//   - The event never holds the disable reason, a command, a path, or a working directory.
//
// The guard names below ("retired-hook", "legacy-guard") have no self-test, so the session-start check leaves their
// entries alone (tests/hooks/health-check-1-12-0.test.js relies on the same property).
//
// Run: node --test tests/hooks/audit-log-disablement.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const audit = fx.auditChain;
const TS_A = "2026-10-16T00:00:00.000Z";
const TS_B = "2026-11-01T00:00:00.000Z";
const REASON = "test fixture: disabled by the user";

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function entries(names, ts, reason) {
  const out = {};
  names.forEach((name) => {
    out[name] = { reason: reason || REASON, ts: ts || TS_A };
  });
  return out;
}

function writeDisabled(dataDir, value) {
  fs.writeFileSync(path.join(dataDir, "hooks-disabled.json"), typeof value === "string" ? value : JSON.stringify(value));
}

function sessionStart(root, dataDir) {
  return fx.runHook("health-check", undefined, {
    args: ["--session-start"],
    cwd: root,
    dataDir: dataDir,
    env: { CLAUDE_PROJECT_DIR: root },
  });
}

// A session start must exit 0 and print nothing or one valid JSON notice.
function assertSessionOk(res) {
  assert.strictEqual(res.status, 0, "exit 0; stderr: " + res.stderr);
  if (res.stdout.trim() !== "") {
    const out = JSON.parse(res.stdout);
    assert.strictEqual(typeof out.systemMessage, "string");
  }
}

function disablementEvents(root, guard) {
  if (!fs.existsSync(fx.logDir(root))) return [];
  return fx.readRecords(root).filter((r) => r.event === "guard-disabled" && (guard === undefined || r.guard === guard));
}

function initEvents(root) {
  if (!fs.existsSync(fx.logDir(root))) return [];
  return fx.readRecords(root).filter((r) => r.event === "audit-initialized");
}

// ---------------------------------------------------------------------------
// Fresh install
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-audit | FR-228 | UR-067 | NFR-032] fresh install: the first session start creates the log with one audit-initialized event at the genesis value, with no configuration", () => {
  const root = fx.tempRoot("disablement-");
  const dataDir = fx.tempDir("disablement-data-");
  assert.ok(!fs.existsSync(fx.logDir(root)), "set-up: no log yet");
  assertSessionOk(sessionStart(root, dataDir));
  const records = fx.readRecords(root);
  assert.ok(records.length >= 1, "the log exists after the first session");
  assert.strictEqual(records[0].event, "audit-initialized");
  assert.strictEqual(records[0].prev, audit.GENESIS_HASH);
  assert.ok(Number.isFinite(Date.parse(records[0].ts)), "a timestamp: " + records[0].ts);
  assert.strictEqual(initEvents(root).length, 1);
});

test("[AC-1 | spec-hooks-audit | FR-228] a later session start does not initialize the log again and appends nothing when nothing is disabled", () => {
  const root = fx.tempRoot("disablement-");
  const dataDir = fx.tempDir("disablement-data-");
  assertSessionOk(sessionStart(root, dataDir));
  const afterFirst = fx.readAllLines(root).length;
  assertSessionOk(sessionStart(root, dataDir));
  assert.strictEqual(initEvents(root).length, 1);
  assert.strictEqual(fx.readAllLines(root).length, afterFirst, "a healthy second session appends nothing");
});

test("[AC-1 | spec-hooks-audit | FR-228 | NFR-030] the first-session log verifies", () => {
  const root = fx.tempRoot("disablement-");
  assertSessionOk(sessionStart(root, fx.tempDir("disablement-data-")));
  const result = audit.verify(audit.logPath(root), { root: root });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.ok(result.lines >= 1);
});

test("[AC-1 | spec-hooks-audit | FR-228] a session started in a subdirectory logs to the project's git root, not to the subdirectory", () => {
  const root = fx.tempRoot("disablement-");
  const sub = path.join(root, "packages", "app");
  fs.mkdirSync(sub, { recursive: true });
  const res = fx.runHook("health-check", undefined, { args: ["--session-start"], cwd: sub, dataDir: fx.tempDir("disablement-data-") });
  assertSessionOk(res);
  assert.ok(fx.readRecords(root).length >= 1, "the log is under the git root");
  assert.ok(!fs.existsSync(path.join(sub, ".agent")), "no second log under the subdirectory");
});

// ---------------------------------------------------------------------------
// One event per disabled guard
// ---------------------------------------------------------------------------

test("[AC-2 | spec-hooks-audit | FR-228 | NFR-026 | NFR-032] a guard added to hooks-disabled.json yields a disablement event naming the guard and the time at the next session start", () => {
  const root = fx.tempRoot("disablement-");
  const dataDir = fx.tempDir("disablement-data-");
  writeDisabled(dataDir, entries(["retired-hook"]));
  const before = Date.now();
  assertSessionOk(sessionStart(root, dataDir));
  const events = disablementEvents(root, "retired-hook");
  assert.strictEqual(events.length, 1, JSON.stringify(fx.readRecords(root)));
  const stamp = Date.parse(events[0].ts);
  assert.ok(Number.isFinite(stamp), "a time: " + events[0].ts);
  assert.ok(stamp >= before - 5 * 60 * 1000 && stamp <= Date.now() + 5 * 60 * 1000, "the time is the time of the event: " + events[0].ts);
});

test("[AC-2 | spec-hooks-audit | FR-228] each disabled guard gets its own event: two guards, two events, each naming its guard", () => {
  const root = fx.tempRoot("disablement-");
  const dataDir = fx.tempDir("disablement-data-");
  writeDisabled(dataDir, entries(["retired-hook", "legacy-guard"]));
  assertSessionOk(sessionStart(root, dataDir));
  assert.strictEqual(disablementEvents(root, "retired-hook").length, 1);
  assert.strictEqual(disablementEvents(root, "legacy-guard").length, 1);
  assert.strictEqual(disablementEvents(root).length, 2);
  const result = audit.verify(audit.logPath(root), { root: root });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
});

test("[AC-2 | spec-hooks-audit | FR-228] a second and a third session add no duplicate event for a guard that stays disabled", () => {
  const root = fx.tempRoot("disablement-");
  const dataDir = fx.tempDir("disablement-data-");
  writeDisabled(dataDir, entries(["retired-hook", "legacy-guard"]));
  assertSessionOk(sessionStart(root, dataDir));
  const afterFirst = fx.readAllLines(root).length;
  assertSessionOk(sessionStart(root, dataDir));
  assertSessionOk(sessionStart(root, dataDir));
  assert.strictEqual(disablementEvents(root, "retired-hook").length, 1);
  assert.strictEqual(disablementEvents(root, "legacy-guard").length, 1);
  assert.strictEqual(fx.readAllLines(root).length, afterFirst, "no line was added by the later sessions");
});

test("[AC-2 | spec-hooks-audit | FR-228] a guard disabled later gets its event then, and the earlier guard keeps exactly one", () => {
  const root = fx.tempRoot("disablement-");
  const dataDir = fx.tempDir("disablement-data-");
  const first = entries(["retired-hook"], TS_A);
  writeDisabled(dataDir, first);
  assertSessionOk(sessionStart(root, dataDir));
  assert.strictEqual(disablementEvents(root, "retired-hook").length, 1);
  assert.strictEqual(disablementEvents(root, "legacy-guard").length, 0);

  writeDisabled(dataDir, Object.assign({}, first, entries(["legacy-guard"], TS_B)));
  assertSessionOk(sessionStart(root, dataDir));
  assert.strictEqual(disablementEvents(root, "retired-hook").length, 1);
  assert.strictEqual(disablementEvents(root, "legacy-guard").length, 1);
});

test("[AC-2 | spec-hooks-audit | FR-228] a guard that is re-enabled and then disabled again is a new disablement and gets a new event", () => {
  const root = fx.tempRoot("disablement-");
  const dataDir = fx.tempDir("disablement-data-");
  writeDisabled(dataDir, entries(["retired-hook"], TS_A));
  assertSessionOk(sessionStart(root, dataDir));
  assert.strictEqual(disablementEvents(root, "retired-hook").length, 1);

  writeDisabled(dataDir, {}); // re-enabled
  assertSessionOk(sessionStart(root, dataDir));
  assert.strictEqual(disablementEvents(root, "retired-hook").length, 1, "re-enabling adds no disablement event");

  writeDisabled(dataDir, entries(["retired-hook"], TS_B)); // disabled again, at a new time
  assertSessionOk(sessionStart(root, dataDir));
  assert.strictEqual(disablementEvents(root, "retired-hook").length, 2, "the second disablement is logged");

  assertSessionOk(sessionStart(root, dataDir));
  assert.strictEqual(disablementEvents(root, "retired-hook").length, 2, "and then not duplicated");
});

test("[AC-2 | spec-hooks-audit | FR-228 | NFR-032] each project's log gets its own event for the same disabled guard", () => {
  // The data directory is shared by all projects; the audit log is per project.
  const rootOne = fx.tempRoot("disablement-");
  const rootTwo = fx.tempRoot("disablement-");
  const dataDir = fx.tempDir("disablement-data-");
  writeDisabled(dataDir, entries(["retired-hook"]));
  assertSessionOk(sessionStart(rootOne, dataDir));
  assertSessionOk(sessionStart(rootTwo, dataDir));
  assert.strictEqual(disablementEvents(rootOne, "retired-hook").length, 1);
  assert.strictEqual(disablementEvents(rootTwo, "retired-hook").length, 1);
  assertSessionOk(sessionStart(rootOne, dataDir));
  assert.strictEqual(disablementEvents(rootOne, "retired-hook").length, 1, "still one in the first project");
});

test("[AC-2 | spec-hooks-audit | FR-228 | NFR-030] the disablement events are chained records: the log verifies", () => {
  const root = fx.tempRoot("disablement-");
  const dataDir = fx.tempDir("disablement-data-");
  writeDisabled(dataDir, entries(["retired-hook", "legacy-guard"]));
  assertSessionOk(sessionStart(root, dataDir));
  const lineTexts = fx.readAllLines(root);
  assert.ok(lineTexts.length >= 2);
  for (let i = 1; i < lineTexts.length; i += 1) {
    assert.strictEqual(JSON.parse(lineTexts[i]).prev, fx.sha256Hex(lineTexts[i - 1]), "line " + (i + 1));
  }
  assert.strictEqual(audit.verify(audit.logPath(root), { root: root }).ok, true);
});

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

test("[AC-2 | spec-hooks-audit | NFR-031 | FR-228] no cwd, secret, or reason leaks: the event holds the guard name and the time, not the disable reason, the project path, or the data directory", () => {
  const root = fx.tempRoot("disablement-");
  const dataDir = fx.tempDir("disablement-data-");
  const reason = "disabled by token=abc123 from /home/someone/private/cwd after a false deny";
  writeDisabled(dataDir, entries(["retired-hook"], TS_A, reason));
  assertSessionOk(sessionStart(root, dataDir));
  const raw = fx.rawLog(root);
  assert.ok(raw.length > 0);
  ["abc123", "token=", "someone/private", "false deny", root, dataDir].forEach((needle) => {
    assert.ok(raw.indexOf(needle) === -1, "the log holds " + JSON.stringify(needle));
  });
  const events = disablementEvents(root, "retired-hook");
  assert.strictEqual(events.length, 1);
  Object.keys(events[0]).forEach((key) => {
    assert.ok(!/reason|cwd|path|command|dir|root|secret|token/i.test(key), "unexpected field: " + key);
  });
});

[
  ["a path-shaped name", "../../etc/passwd"],
  ["an upper-case name", "UPPER-CASE"],
  ["a name with a space", "a b"],
  ["a shell-shaped name", "x;rm -rf"],
  ["a name over 40 characters", "a".repeat(41)],
].forEach((row) => {
  test("[AC-2 | spec-hooks-audit | FR-228 | NFR-031] an entry key that is not a valid hook name is ignored and never written to the log: " + row[0], () => {
    // Security-adjacent: the key comes from a file the user edits.
    const root = fx.tempRoot("disablement-");
    const dataDir = fx.tempDir("disablement-data-");
    const value = {};
    value[row[1]] = { reason: "x", ts: TS_A };
    writeDisabled(dataDir, value);
    assertSessionOk(sessionStart(root, dataDir));
    assert.strictEqual(disablementEvents(root).length, 0);
    assert.ok(fx.rawLog(root).indexOf(row[1]) === -1);
  });
});

// ---------------------------------------------------------------------------
// Malformed configuration and fail open
// ---------------------------------------------------------------------------

[
  ["an array", "[1, 2]"],
  ["text that is not JSON", "not json at all"],
  ["an empty file", ""],
  ["JSON null", "null"],
].forEach((row) => {
  test("[AC-2 | spec-hooks-audit | FR-228 | NFR-026] a hooks-disabled.json holding " + row[0] + " logs no disablement and the session start still succeeds", () => {
    const root = fx.tempRoot("disablement-");
    const dataDir = fx.tempDir("disablement-data-");
    writeDisabled(dataDir, row[1]);
    assertSessionOk(sessionStart(root, dataDir));
    assert.strictEqual(disablementEvents(root).length, 0);
  });
});

test("[AC-2 | spec-hooks-audit | FR-228 | NFR-026] recording fails open: an unwritable log directory is noted, the guard stays disabled, and the session start exits 0", () => {
  const root = fx.tempRoot("disablement-");
  const dataDir = fx.tempDir("disablement-data-");
  fs.writeFileSync(path.join(root, ".agent"), "not a directory");
  writeDisabled(dataDir, entries(["retired-hook"]));
  const res = sessionStart(root, dataDir);
  assertSessionOk(res);
  const kept = JSON.parse(fs.readFileSync(path.join(dataDir, "hooks-disabled.json"), "utf8"));
  assert.ok(kept["retired-hook"], "the guard is still disabled: recording changes nothing about the disablement");
  assert.ok(fx.readHealthLog(dataDir).length >= 1, "the failure is noted in hook-health.jsonl");
});

test("[AC-2 | spec-hooks-audit | FR-228 | NFR-026] after a failed recording the next session retries and logs the event once", () => {
  const root = fx.tempRoot("disablement-");
  const dataDir = fx.tempDir("disablement-data-");
  fs.writeFileSync(path.join(root, ".agent"), "not a directory");
  writeDisabled(dataDir, entries(["retired-hook"]));
  assertSessionOk(sessionStart(root, dataDir));
  assert.strictEqual(disablementEvents(root, "retired-hook").length, 0, "nothing could be written");
  fs.rmSync(path.join(root, ".agent"), { force: true });
  assertSessionOk(sessionStart(root, dataDir));
  assert.strictEqual(disablementEvents(root, "retired-hook").length, 1);
  assertSessionOk(sessionStart(root, dataDir));
  assert.strictEqual(disablementEvents(root, "retired-hook").length, 1);
});
