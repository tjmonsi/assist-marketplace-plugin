// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the governance audit chain library (harness-governance Tranche 2, Step 11):
// plugins/assist-plugin/hooks/lib/audit-chain.js.
//
// Sources: specs/spec-hooks-audit.md (Requirements: Hash-chained append, Failed append leaves the chain intact,
// Size-based rotation with retention, Chain verification, Privacy of the audit record, Protected store) and
// docs/requirements/FR-NFR-harness-governance.md v1.3 (FR-224, FR-225, NFR-029, NFR-030, NFR-031, NFR-032).
// Task plan: docs/task-plans/task-plan-harness-governance-20261028-0759.md, Steps 11 and 20.
//
// Traceability format: [AC-N | spec file | FR/NFR ids | UR/BR ids]. The spec has no SPEC-NNN id, so it is cited by
// file name. AC-N is the position of the Scenario inside its Requirement in the spec:
//   Hash-chained append: AC-1 Append extends the chain, AC-2 First line uses the genesis value
//   Failed append leaves the chain intact: AC-1
//   Size-based rotation with retention: AC-1 Rotation keeps the chain
//   Chain verification: AC-1 Intact chain, AC-2 Edited line, AC-3 Tamper detection
//   Privacy of the audit record: AC-1 Secret kept out of the log
// A test with no Scenario in the spec carries the Requirement name in place of an AC number.
//
// Public interface used (module exports; documented in the library header):
//   LOG_DIR, CURRENT_FILE, GENESIS_HASH, ROTATION_BYTES, RETENTION_MS, AuditError
//   logPath(root)                -> absolute path of the current segment
//   append(record, options)      -> {ok: true, hash, segment, rotated} | {ok: false, code, message};
//                                   throws an AuditError for a bad root, a bad record, or a privacy violation
//   rotate(options)              -> {ok: true, rotated, segment, pruned} | {ok: false, code, message}
//   verify(location, options)    -> {ok: true, lines, segments} | {ok: false, lines, segments, firstBreak}
//                                   | {ok: false, error}
//   options: {root, now, rotationBytes, retentionMs, lockTimeoutMs, log}
//
// Every log lives in a temp directory. The 100,000-line log is generated at test time (tests/fixtures/audit/).
// Numbers marked "estimate" are targets that the spec labels as estimates until measured.
//
// Run: node --test tests/hooks/audit-chain.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const audit = fx.auditChain;
const DAY = 24 * 60 * 60 * 1000;

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ctx(extra) {
  const root = fx.tempRoot("audit-chain-");
  return { root: root, opts: Object.assign({ root: root }, extra || {}) };
}

function add(c, fields, extra) {
  return audit.append(Object.assign({ event: "test-event" }, fields || {}), Object.assign({}, c.opts, extra || {}));
}

function addMany(c, count, extra) {
  const results = [];
  for (let i = 1; i <= count; i += 1) {
    results.push(add(c, { rule_id: "rule-" + i, n: i }, extra));
  }
  return results;
}

function logFile(c) {
  return audit.logPath(c.root);
}

function allLines(c) {
  return fx.readAllLines(c.root);
}

// Every line's prev equals the SHA-256 of the exact text of the line before it; the first holds the genesis value.
function assertChain(lineTexts) {
  for (let i = 0; i < lineTexts.length; i += 1) {
    const record = JSON.parse(lineTexts[i]);
    const expected = i === 0 ? audit.GENESIS_HASH : fx.sha256Hex(lineTexts[i - 1]);
    assert.strictEqual(record.prev, expected, "prev of line " + (i + 1));
  }
}

function verifyRoot(c) {
  return audit.verify(audit.logPath(c.root), { root: c.root });
}

// A fresh root that holds the given lines as its current segment.
function planted(lineTexts, options) {
  const c = ctx();
  fx.plantLines(c.root, lineTexts, options);
  return c;
}

function tryAppend(c, record) {
  return audit.append(record, c.opts);
}

function threw(fn) {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return null;
}

// Replaces the write calls of fs for the duration of work(), acting only on a write whose data holds a chained line
// (it carries a "prev" field). Modes:
//   "count": passes every write through and counts the writes of a line
//   "throw": writes half of the line, then fails with ENOSPC (a disk that fills mid-write)
//   "short": writes half of the line and reports the short count without an error (writeSync only)
// state.hits is 0 when the library's write path did not go through these functions; the caller then skips.
function injectWriteFailure(mode, work) {
  const original = { writeSync: fs.writeSync, appendFileSync: fs.appendFileSync, writeFileSync: fs.writeFileSync };
  const state = { hits: 0 };

  function textOf(data) {
    if (typeof data === "string") return data;
    if (Buffer.isBuffer(data)) return data.toString("utf8");
    if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
    return "";
  }

  function isLine(data) {
    return textOf(data).indexOf('"prev"') !== -1;
  }

  function enospc() {
    const err = new Error("ENOSPC: no space left on device, write");
    err.code = "ENOSPC";
    err.errno = -28;
    err.syscall = "write";
    return err;
  }

  function halfOf(data) {
    if (typeof data === "string") return data.slice(0, Math.floor(data.length / 2));
    return Buffer.from(data).subarray(0, Math.floor(data.length / 2));
  }

  fs.writeSync = function (fd, data) {
    if (!isLine(data)) return original.writeSync.apply(fs, arguments);
    state.hits += 1;
    if (mode === "count") return original.writeSync.apply(fs, arguments);
    const args = Array.prototype.slice.call(arguments);
    let written = 0;
    if (typeof data === "string") {
      args[1] = halfOf(data);
      written = original.writeSync.apply(fs, args);
    } else {
      const offset = typeof args[2] === "number" ? args[2] : 0;
      const length = typeof args[3] === "number" ? args[3] : data.length - offset;
      args[2] = offset;
      args[3] = Math.floor(length / 2);
      written = original.writeSync.apply(fs, args);
    }
    if (mode === "throw") throw enospc();
    return written;
  };

  function wrapWholeFileWrite(name) {
    fs[name] = function (file, data) {
      if (!isLine(data) || mode === "short") return original[name].apply(fs, arguments);
      state.hits += 1;
      if (mode === "count") return original[name].apply(fs, arguments);
      const args = Array.prototype.slice.call(arguments);
      args[1] = halfOf(data);
      original[name].apply(fs, args);
      throw enospc();
    };
  }
  wrapWholeFileWrite("appendFileSync");
  wrapWholeFileWrite("writeFileSync");

  try {
    return { state: state, value: work() };
  } finally {
    fs.writeSync = original.writeSync;
    fs.appendFileSync = original.appendFileSync;
    fs.writeFileSync = original.writeFileSync;
  }
}

function runWorker(root, label, count) {
  return new Promise((resolve) => {
    const child = childProcess.spawn(process.execPath, [fx.WORKER, root, label, String(count)], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("close", (code) => {
      resolve({ code: code, out: out, err: err });
    });
  });
}

// ---------------------------------------------------------------------------
// Constants and location
// ---------------------------------------------------------------------------

test("[Requirement: Hash-chained append | spec-hooks-audit | FR-224 | UR-065] the log is .agent/logs/governance/audit.jsonl under the project root", () => {
  const root = fx.tempRoot("audit-chain-");
  assert.strictEqual(audit.CURRENT_FILE, "audit.jsonl");
  assert.strictEqual(audit.logPath(root), path.join(root, ".agent", "logs", "governance", "audit.jsonl"));
});

test("[Requirement: Hash-chained append | spec-hooks-audit | FR-224] a defined genesis value exists", () => {
  assert.strictEqual(typeof audit.GENESIS_HASH, "string");
  assert.ok(audit.GENESIS_HASH.length > 0);
});

// ---------------------------------------------------------------------------
// Append extends the chain
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-audit | FR-224 | UR-065] an append extends the chain: the new line's prev is the SHA-256 of line N", () => {
  const c = ctx();
  const results = addMany(c, 6);
  results.forEach((res) => assert.strictEqual(res.ok, true, JSON.stringify(res)));
  const lineTexts = allLines(c);
  assert.strictEqual(lineTexts.length, 6);
  assertChain(lineTexts);
  const last = results[results.length - 1];
  assert.strictEqual(last.hash, fx.sha256Hex(lineTexts[5]), "the returned hash is the chain hash of the new line");
});

test("[AC-2 | spec-hooks-audit | FR-224 | UR-065] the first line of an empty log holds the genesis value", () => {
  const c = ctx();
  const res = add(c, { rule_id: "rule-1" });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  const lineTexts = allLines(c);
  assert.strictEqual(lineTexts.length, 1);
  assert.strictEqual(JSON.parse(lineTexts[0]).prev, audit.GENESIS_HASH);
});

test("[AC-1 | spec-hooks-audit | FR-224] one JSON line per event with a timestamp, the prev hash, the event, and the payload", () => {
  const c = ctx({ now: () => Date.UTC(2026, 5, 1, 12, 0, 0) });
  add(c, { rule_id: "rule-1", decision: "deny", tool: "Bash" });
  const text = fs.readFileSync(logFile(c), "utf8");
  assert.ok(text.endsWith("\n"), "the file ends with an end of line");
  const lineTexts = fx.splitLines(text);
  assert.strictEqual(lineTexts.length, 1);
  const record = JSON.parse(lineTexts[0]);
  assert.ok(String(record.ts).indexOf("2026-06-01T12:00:00") === 0, "ts comes from the injected clock: " + record.ts);
  assert.strictEqual(record.event, "test-event");
  assert.strictEqual(record.rule_id, "rule-1");
  assert.strictEqual(record.decision, "deny");
  assert.strictEqual(record.tool, "Bash");
  assert.ok(Number.isFinite(Date.parse(record.ts)));
});

test("[AC-1 | spec-hooks-audit | FR-224] the hash input is the exact stored text of the prior line, not a re-serialization of it", () => {
  // Boundary: a prior line whose spacing differs from JSON.stringify output.
  const spaced = '{"ts": "2026-01-01T00:00:00.000Z",  "prev": "' + audit.GENESIS_HASH + '", "event": "seed-event"}';
  const c = planted([spaced]);
  const res = add(c, { rule_id: "rule-1" });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  const lineTexts = allLines(c);
  assert.strictEqual(lineTexts.length, 2);
  assert.strictEqual(lineTexts[0], spaced, "the stored prior line is untouched");
  assert.strictEqual(JSON.parse(lineTexts[1]).prev, fx.sha256Hex(spaced));
  assert.strictEqual(verifyRoot(c).ok, true);
});

test("[AC-1 | spec-hooks-audit | FR-224] each line is written in a single write call", (t) => {
  const c = ctx();
  const out = injectWriteFailure("count", () => add(c, { rule_id: "rule-1" }));
  if (out.state.hits === 0) {
    t.skip("the write path did not go through fs.writeSync, appendFileSync, or writeFileSync; confirm the single-write rule by review");
    return;
  }
  assert.strictEqual(out.value.ok, true, JSON.stringify(out.value));
  assert.strictEqual(out.state.hits, 1, "one write call carried the whole line");
});

// ---------------------------------------------------------------------------
// Input space of append: bad roots and bad records
// ---------------------------------------------------------------------------

[
  ["undefined", undefined],
  ["empty string", ""],
  ["relative path", "relative/project"],
  ["a number", 42],
  ["null", null],
].forEach((row) => {
  test("[Requirement: Hash-chained append | spec-hooks-audit | FR-224] a root that is not an absolute path is refused with an AuditError: " + row[0], () => {
    // Invalid input: the root names where the log lives, so a bad one writes nothing.
    const err = threw(() => audit.append({ event: "test-event" }, { root: row[1] }));
    assert.ok(err, "expected a throw");
    assert.strictEqual(err.name, "AuditError");
    assert.strictEqual(typeof err.code, "string");
  });
});

[
  ["null", null],
  ["undefined", undefined],
  ["a string", "just text"],
  ["a number", 7],
  ["an array", [{ event: "test-event" }]],
  ["no event", {}],
  ["an empty event name", { event: "" }],
  ["an event name with spaces and shell characters", { event: "bad event; rm -rf /" }],
  ["a non-string event", { event: 12 }],
].forEach((row) => {
  test("[Requirement: Hash-chained append | spec-hooks-audit | FR-224] a bad record is refused and writes nothing: " + row[0], () => {
    const c = ctx();
    const err = threw(() => tryAppend(c, row[1]));
    assert.ok(err, "expected a throw");
    assert.strictEqual(err.name, "AuditError");
    assert.ok(!fs.existsSync(logFile(c)) || fs.readFileSync(logFile(c), "utf8") === "", "nothing was written");
  });
});

[
  ["prev", { event: "test-event", prev: "0".repeat(64) }],
  ["ts", { event: "test-event", ts: "1999-01-01T00:00:00.000Z" }],
].forEach((row) => {
  test("[AC-1 | spec-hooks-audit | FR-224] a caller cannot set the " + row[0] + " field: the library sets it", () => {
    // Security-adjacent: a forged prev or ts would let a caller steer the chain.
    const c = ctx();
    addMany(c, 2);
    const before = allLines(c);
    const err = threw(() => tryAppend(c, row[1]));
    if (err === null) {
      const after = allLines(c);
      const stored = JSON.parse(after[after.length - 1]);
      assert.strictEqual(stored.prev, fx.sha256Hex(before[before.length - 1]), "a stored prev is always the real chain hash");
      if (row[0] === "ts") assert.notStrictEqual(stored.ts, row[1].ts, "the library timestamp wins");
    } else {
      assert.strictEqual(err.name, "AuditError");
      assert.deepStrictEqual(allLines(c), before, "a refused record writes nothing");
    }
  });
});

// ---------------------------------------------------------------------------
// Failed append leaves the chain intact
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-audit | FR-224 | NFR-032 | UR-065] a disk that fills mid-write leaves no partial line, the append reports failure, and the chain carries on", (t) => {
  const c = ctx();
  addMany(c, 3);
  const before = fs.readFileSync(logFile(c), "utf8");
  const out = injectWriteFailure("throw", () => {
    try {
      return add(c, { rule_id: "rule-fail", n: 99 });
    } catch (err) {
      return { threw: err };
    }
  });
  if (out.state.hits === 0) {
    t.skip("the write path did not go through fs.writeSync, appendFileSync, or writeFileSync; failure injection did not reach it");
    return;
  }
  assert.ok(!out.value.threw, "append returns failure for the caller to log; it does not throw on a write error");
  assert.strictEqual(out.value.ok, false, JSON.stringify(out.value));
  assert.strictEqual(typeof out.value.code, "string", "a failure carries a code for hook-health.jsonl");
  assert.strictEqual(typeof out.value.message, "string");
  assert.strictEqual(fs.readFileSync(logFile(c), "utf8"), before, "the file is back at its prior size and content");
  const next = add(c, { rule_id: "rule-next", n: 100 });
  assert.strictEqual(next.ok, true, JSON.stringify(next));
  const lineTexts = allLines(c);
  assert.strictEqual(lineTexts.length, 4);
  assertChain(lineTexts);
  assert.strictEqual(verifyRoot(c).ok, true);
});

test("[AC-1 | spec-hooks-audit | FR-224 | UR-065] a short write never leaves a partial line: the file is either unchanged or ends in one complete chained line", (t) => {
  const c = ctx();
  addMany(c, 3);
  const before = fs.readFileSync(logFile(c), "utf8");
  const out = injectWriteFailure("short", () => {
    try {
      return add(c, { rule_id: "rule-short", n: 99 });
    } catch (err) {
      return { threw: err };
    }
  });
  if (out.state.hits === 0) {
    t.skip("the write path did not go through fs.writeSync; a short write could not be injected");
    return;
  }
  assert.ok(!out.value.threw, "no throw on a write problem");
  const after = fs.readFileSync(logFile(c), "utf8");
  if (out.value.ok === false) {
    assert.strictEqual(after, before, "a failed append leaves the file as it was");
  } else {
    assert.ok(after.startsWith(before), "a completed append only extends the file");
    assert.ok(after.endsWith("\n"));
    assert.strictEqual(fx.splitLines(after).length, 4);
  }
  assertChain(allLines(c));
  assert.strictEqual(verifyRoot(c).ok, true);
});

test("[AC-1 | spec-hooks-audit | FR-224] an unwritable log directory returns a failure and creates no log", () => {
  // Invalid environment: .agent is a regular file, so the log directory cannot be created.
  const c = ctx();
  fs.writeFileSync(path.join(c.root, ".agent"), "not a directory");
  let res;
  const err = threw(() => {
    res = add(c, { rule_id: "rule-1" });
  });
  assert.strictEqual(err, null, "an I/O problem is a returned failure, not a throw");
  assert.strictEqual(res.ok, false);
  assert.strictEqual(typeof res.code, "string");
  assert.ok(!fs.existsSync(fx.logDir(c.root)));
});

test("[AC-1 | spec-hooks-audit | FR-224] a read-only log file returns a failure and keeps its content", (t) => {
  if (process.platform === "win32" || (typeof process.getuid === "function" && process.getuid() === 0)) {
    t.skip("file permissions do not stop this user (root or Windows)");
    return;
  }
  const c = ctx();
  addMany(c, 2);
  const before = fs.readFileSync(logFile(c), "utf8");
  fs.chmodSync(logFile(c), 0o444);
  try {
    const res = add(c, { rule_id: "rule-late" });
    assert.strictEqual(res.ok, false, JSON.stringify(res));
  } finally {
    fs.chmodSync(logFile(c), 0o644);
  }
  assert.strictEqual(fs.readFileSync(logFile(c), "utf8"), before);
});

test("[AC-1 | spec-hooks-audit | FR-224] a partial last line left by a crash is cut back before the next append, so the log holds no partial line", () => {
  const c = ctx();
  addMany(c, 3);
  const complete = allLines(c);
  fx.appendPartial(logFile(c));
  const res = add(c, { rule_id: "rule-after-crash" });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  const text = fs.readFileSync(logFile(c), "utf8");
  assert.ok(text.endsWith("\n"));
  const lineTexts = fx.splitLines(text);
  assert.strictEqual(lineTexts.length, 4);
  lineTexts.forEach((line) => assert.doesNotThrow(() => JSON.parse(line)));
  assert.strictEqual(JSON.parse(lineTexts[3]).prev, fx.sha256Hex(complete[2]), "the new line chains to the last complete line");
  assert.strictEqual(verifyRoot(c).ok, true);
});

// ---------------------------------------------------------------------------
// Rotation and retention
// ---------------------------------------------------------------------------

test("[Requirement: Size-based rotation with retention | spec-hooks-audit | NFR-032] the rotation size is a positive configured value", () => {
  // The default is an estimate until it is measured against the NFR-030 time target.
  assert.strictEqual(typeof audit.ROTATION_BYTES, "number");
  assert.ok(audit.ROTATION_BYTES > 0);
});

test("[Requirement: Size-based rotation with retention | spec-hooks-audit | NFR-032] the retention floor is at least 12 months", () => {
  assert.ok(audit.RETENTION_MS >= 365 * DAY, "retention " + audit.RETENTION_MS + " ms is under 12 months");
});

test("[AC-1 | spec-hooks-audit | NFR-032 | FR-224 | UR-065] rotation keeps the chain: each new segment's first line holds the final hash of the old one, and verification passes across the cuts", () => {
  const c = ctx({ rotationBytes: 1200 });
  const results = addMany(c, 30);
  results.forEach((res) => assert.strictEqual(res.ok, true, JSON.stringify(res)));
  const segs = fx.segmentFiles(c.root);
  assert.ok(segs.rotated.length >= 2, "the log rotated at least twice: " + segs.rotated.length);
  assert.ok(
    results.some((res) => res.rotated === true),
    "a result reports that a rotation happened"
  );
  const lineTexts = allLines(c);
  assert.strictEqual(lineTexts.length, 30, "no line was lost across the cuts");
  assertChain(lineTexts);

  // The first line of every segment after the first holds the final line's hash of the segment before it.
  for (let i = 1; i < segs.ordered.length; i += 1) {
    const earlier = fx.readLines(segs.ordered[i - 1]);
    const later = fx.readLines(segs.ordered[i]);
    if (earlier.length === 0 || later.length === 0) continue;
    assert.strictEqual(JSON.parse(later[0]).prev, fx.sha256Hex(earlier[earlier.length - 1]), "cut before " + path.basename(segs.ordered[i]));
  }

  const result = verifyRoot(c);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.lines, 30);
  assert.ok(result.segments >= 2);
});

test("[AC-1 | spec-hooks-audit | NFR-032] rotate() cuts the current segment; the next line carries the old final hash and verification passes", () => {
  const c = ctx();
  addMany(c, 3);
  const beforeCut = allLines(c);
  const cut = audit.rotate(c.opts);
  assert.strictEqual(cut.ok, true, JSON.stringify(cut));
  assert.strictEqual(cut.rotated, true);
  const segs = fx.segmentFiles(c.root);
  assert.strictEqual(segs.rotated.length, 1);
  const next = add(c, { rule_id: "rule-after-cut" });
  assert.strictEqual(next.ok, true, JSON.stringify(next));
  const current = fx.readLines(audit.logPath(c.root));
  assert.strictEqual(current.length, 1);
  assert.strictEqual(JSON.parse(current[0]).prev, fx.sha256Hex(beforeCut[beforeCut.length - 1]));
  const result = verifyRoot(c);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.lines, 4);
});

test("[AC-1 | spec-hooks-audit | NFR-032] rotate() on a missing or empty log cuts nothing", () => {
  // Null/empty boundary.
  const c = ctx();
  const res = audit.rotate(c.opts);
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(res.rotated, false);
  assert.strictEqual(fx.segmentFiles(c.root).rotated.length, 0);
});

[
  ["retentionMs of 1", { retentionMs: 1 }],
  ["retentionMs of 1000", { retentionMs: 1000 }],
  ["retentionMs of 0", { retentionMs: 0 }],
  ["a negative retentionMs", { retentionMs: -5 }],
  ["a non-number retentionMs", { retentionMs: "1" }],
  ["no retentionMs", {}],
].forEach((row) => {
  test("[AC-1 | spec-hooks-audit | NFR-032 | UR-065] no segment younger than 12 months is pruned and no content is lost, whatever the caller asks for (" + row[0] + ")", () => {
    // rotate() may rename the current audit.jsonl to a rotated segment; that is a cut, not a deletion. The guarantee is
    // that nothing younger than 12 months is pruned and that every line is still in the chain.
    const c = ctx({ rotationBytes: 600 });
    addMany(c, 20);
    const segmentsBefore = fx.segmentFiles(c.root).ordered.length;
    assert.ok(segmentsBefore >= 3, "set-up: several segments exist");
    [30 * DAY, 200 * DAY, 364 * DAY].forEach((offset) => {
      const res = audit.rotate(Object.assign({}, c.opts, row[1], { now: () => Date.now() + offset }));
      assert.strictEqual(res.ok, true, JSON.stringify(res));
      assert.ok(Array.isArray(res.pruned), "rotate reports the pruned segments");
      assert.deepStrictEqual(res.pruned, [], "no segment younger than 12 months is pruned at " + offset / DAY + " days");
      assert.ok(fx.segmentFiles(c.root).ordered.length >= segmentsBefore, "no segment file is lost at " + offset / DAY + " days");
      const result = verifyRoot(c);
      assert.strictEqual(result.ok, true, JSON.stringify(result));
      assert.strictEqual(result.lines, 20, "every line is still in the chain at " + offset / DAY + " days");
    });
    assert.strictEqual(allLines(c).length, 20);
  });
});

test("[AC-1 | spec-hooks-audit | NFR-032] segments older than 12 months may be pruned, never the newest rotated one, and the remaining chain still verifies", () => {
  const old = Date.now() - 400 * DAY;
  const c = ctx({ rotationBytes: 600, now: () => old });
  addMany(c, 20);
  fx.segmentFiles(c.root).ordered.forEach((file) => {
    const when = new Date(old);
    fs.utimesSync(file, when, when);
  });
  const res = audit.rotate({ root: c.root });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.ok(Array.isArray(res.pruned), "rotate reports the pruned segments");
  const after = fx.segmentFiles(c.root);
  assert.ok(after.rotated.length >= 1, "the newest rotated segment is kept as the chain anchor");
  const result = verifyRoot(c);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
});

// ---------------------------------------------------------------------------
// Race: parallel appenders
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-audit | FR-224 | UR-065] parallel appenders keep one consistent chain with no lost or interleaved line", async () => {
  // Two parallel subagents can append at once (spec Requirement: Hash-chained append). Five processes here.
  const c = ctx();
  const workers = 5;
  const per = 20;
  const runs = await Promise.all(
    Array.from({ length: workers }, (unused, i) => runWorker(c.root, "w" + i, per))
  );
  let succeeded = 0;
  runs.forEach((run, i) => {
    assert.strictEqual(run.code, 0, "worker " + i + " exit code; stdout: " + run.out + " stderr: " + run.err);
    succeeded += JSON.parse(run.out.trim()).ok;
  });
  assert.strictEqual(succeeded, workers * per);
  const lineTexts = allLines(c);
  assert.strictEqual(lineTexts.length, workers * per, "one line per successful append");
  lineTexts.forEach((line) => assert.doesNotThrow(() => JSON.parse(line), "no interleaved or partial line"));
  assertChain(lineTexts);
  const records = lineTexts.map((line) => JSON.parse(line));
  for (let i = 0; i < workers; i += 1) {
    const mine = records.filter((r) => r.rule_id === "worker-w" + i).map((r) => r.n);
    assert.deepStrictEqual(
      mine,
      Array.from({ length: per }, (unused, k) => k + 1),
      "worker " + i + " lines appear in its own order"
    );
  }
  const result = verifyRoot(c);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.lines, workers * per);
});

// ---------------------------------------------------------------------------
// Privacy of the audit record (NFR-031)
// ---------------------------------------------------------------------------

function nestedGetter() {
  const holder = {};
  Object.defineProperty(holder, "value", {
    enumerable: true,
    get: function () {
      return "computed at read time";
    },
  });
  return holder;
}

function topLevelGetter() {
  const record = { event: "test-event" };
  Object.defineProperty(record, "rule_id", {
    enumerable: true,
    get: function () {
      return "rule-from-getter";
    },
  });
  return record;
}

function inheritedToJson() {
  return Object.create({
    toJSON: function () {
      return { leak: "x" };
    },
  });
}

class Holder {
  constructor() {
    this.value = 1;
  }
}

[
  ["a nested object with a toJSON method", () => ({ event: "test-event", meta: { toJSON: function () { return { a: 1 }; } } })],
  ["the record itself with a toJSON method", () => ({ event: "test-event", toJSON: function () { return {}; } })],
  ["a nested object with a getter", () => ({ event: "test-event", meta: nestedGetter() })],
  ["the record itself with a getter", () => topLevelGetter()],
  ["a class instance", () => ({ event: "test-event", meta: new Holder() })],
  ["a Date", () => ({ event: "test-event", meta: new Date() })],
  ["a Map", () => ({ event: "test-event", meta: new Map([["a", 1]]) })],
  ["a Buffer", () => ({ event: "test-event", meta: Buffer.from("secret bytes") })],
  ["an object that inherits toJSON", () => ({ event: "test-event", meta: inheritedToJson() })],
  ["an array that holds a class instance", () => ({ event: "test-event", list: [new Holder()] })],
  ["a function value", () => ({ event: "test-event", meta: function () { return 1; } })],
].forEach((row) => {
  test("[AC-1 | spec-hooks-audit | NFR-031 | NFR-026] a value that is not plain data is refused and nothing is written: " + row[0], () => {
    // Type mismatch: serialization-time code (toJSON, getters, classes) could change what is stored after the check.
    const c = ctx();
    const err = threw(() => tryAppend(c, row[1]()));
    assert.ok(err, "expected a throw");
    assert.strictEqual(err.name, "AuditError");
    assert.ok(err.code === "privacy" || err.code === "bad-record", "code: " + err.code);
    assert.ok(!fs.existsSync(logFile(c)) || fs.readFileSync(logFile(c), "utf8") === "");
  });
});

[
  ["the spec example token=abc123", "token=abc123"],
  ["a password assignment", "password=hunter2"],
  ["an api key assignment", "api_key=abcdef123456"],
  ["a bearer header", "Authorization: Bearer abc.def.ghi"],
  ["an AWS access key id", "AKIAIOSFODNN7EXAMPLE"],
  ["a GitHub token", "ghp_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8"],
  ["a private key header", "-----BEGIN RSA PRIVATE KEY-----"],
].forEach((row) => {
  test("[AC-1 | spec-hooks-audit | NFR-031 | NFR-026] a secret value is refused, written nowhere, and never echoed in the error: " + row[0], () => {
    // Security-adjacent: the record may carry a rule id, a decision, a tool, and a path, never a secret value.
    const c = ctx();
    const entries = [];
    c.opts.log = (entry) => entries.push(entry);
    const err = threw(() => tryAppend(c, { event: "test-event", rule_id: "rule-1", detail: row[1] }));
    assert.ok(err, "expected a throw");
    assert.strictEqual(err.name, "AuditError");
    assert.ok(String(err.message).indexOf(row[1]) === -1, "the error message holds the secret: " + err.message);
    assert.ok(JSON.stringify(entries).indexOf(row[1]) === -1, "the log callback received the secret");
    assert.ok(!fs.existsSync(logFile(c)) || fs.readFileSync(logFile(c), "utf8") === "");
  });
});

test("[AC-1 | spec-hooks-audit | NFR-031] a secret in a field name or inside a nested value or an array is refused too", () => {
  const c = ctx();
  const forms = [
    { event: "test-event", ["token=abc123"]: "x" },
    { event: "test-event", meta: { detail: "token=abc123" } },
    { event: "test-event", list: ["fine", "token=abc123"] },
  ];
  forms.forEach((record) => {
    const err = threw(() => tryAppend(c, record));
    assert.ok(err, "expected a throw for " + Object.keys(record).join(","));
    assert.strictEqual(err.name, "AuditError");
    assert.ok(String(err.message).indexOf("abc123") === -1, "the error message holds the secret: " + err.message);
  });
  assert.ok(!fs.existsSync(logFile(c)) || fs.readFileSync(logFile(c), "utf8") === "");
});

[
  ["a line feed", "line one\nline two"],
  ["a carriage return", "line one\rline two"],
  ["a NUL", "a\u0000b"],
  ["an escape sequence", "a\u001b[31mred"],
].forEach((row) => {
  test("[AC-1 | spec-hooks-audit | NFR-031] a string with a control character is refused: " + row[0], () => {
    const c = ctx();
    const err = threw(() => tryAppend(c, { event: "test-event", detail: row[1] }));
    assert.ok(err, "expected a throw");
    assert.strictEqual(err.name, "AuditError");
    assert.ok(!fs.existsSync(logFile(c)) || fs.readFileSync(logFile(c), "utf8") === "");
  });
});

[
  ["5,000 characters", 5000],
  ["100,000 characters", 100000],
].forEach((row) => {
  test("[AC-1 | spec-hooks-audit | NFR-031] an over-long string (file contents or prompt text in disguise) is refused: " + row[0], () => {
    // Boundary: a short identifier is accepted (next test); long free text is not.
    const c = ctx();
    const err = threw(() => tryAppend(c, { event: "test-event", detail: "x".repeat(row[1]) }));
    assert.ok(err, "expected a throw");
    assert.strictEqual(err.name, "AuditError");
    assert.ok(!fs.existsSync(logFile(c)) || fs.readFileSync(logFile(c), "utf8") === "");
  });
});

["prompt", "command", "content", "contents", "body", "stdout"].forEach((name) => {
  test("[AC-1 | spec-hooks-audit | NFR-031] a field that holds prompt text, command text, or file contents is refused by name: " + name, () => {
    const c = ctx();
    const err = threw(() => tryAppend(c, { event: "test-event", [name]: "harmless" }));
    assert.ok(err, "expected a throw");
    assert.strictEqual(err.name, "AuditError");
    assert.ok(!fs.existsSync(logFile(c)) || fs.readFileSync(logFile(c), "utf8") === "");
  });
});

[
  ["the decision record fields", { event: "test-event", rule_id: "fsa-write-bar.shell-write", decision: "deny", tool: "Bash", agent_type: "assist-plugin:developer", agent_id: "agent-1" }],
  ["a path with its data-class tag", { event: "test-event", path: ".agent/main-plan/plan-x.md", data_class: "untagged" }],
  ["numbers, booleans, and null", { event: "test-event", count: 3, flag: true, nothing: null }],
  ["a small nested object", { event: "test-event", meta: { a: "b" } }],
  ["an event name with a dot and a dash", { event: "guard-decision.v1" }],
].forEach((row) => {
  test("[AC-1 | spec-hooks-audit | NFR-031 | NFR-026] a structured record is accepted: " + row[0], () => {
    const c = ctx();
    const res = tryAppend(c, row[1]);
    assert.strictEqual(res.ok, true, JSON.stringify(res));
    const stored = JSON.parse(allLines(c)[0]);
    Object.keys(row[1]).forEach((key) => {
      assert.deepStrictEqual(stored[key], row[1][key], key);
    });
  });
});

test("[AC-1 | spec-hooks-audit | NFR-031] a refused record leaves the log as it was, and the next valid record still chains", () => {
  const c = ctx();
  addMany(c, 2);
  const before = allLines(c);
  assert.ok(threw(() => tryAppend(c, { event: "test-event", detail: "token=abc123" })));
  assert.deepStrictEqual(allLines(c), before);
  const res = add(c, { rule_id: "rule-after" });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assertChain(allLines(c));
});

// ---------------------------------------------------------------------------
// Verification: intact chains
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-audit | FR-225 | NFR-030] an unmodified log verifies and reports every line (500 lines)", () => {
  const c = ctx();
  const built = fx.writeChain(c.root, [500]);
  assert.strictEqual(built.total, 500);
  const result = verifyRoot(c);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.lines, 500);
});

[
  ["a missing log", () => ctx()],
  ["an empty log file", () => planted([])],
].forEach((row) => {
  test("[AC-1 | spec-hooks-audit | FR-225] " + row[0] + " verifies as zero lines (null/empty boundary)", () => {
    const c = row[1]();
    const result = verifyRoot(c);
    assert.strictEqual(result.ok, true, JSON.stringify(result));
    assert.strictEqual(result.lines, 0);
  });
});

test("[AC-1 | spec-hooks-audit | FR-225] a log of only the genesis line verifies as one line", () => {
  const c = ctx();
  add(c, { rule_id: "rule-1" });
  const result = verifyRoot(c);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.lines, 1);
});

test("[AC-1 | spec-hooks-audit | FR-225 | NFR-032] a fixture of rotated segments verifies across the cut", () => {
  const c = ctx();
  const built = fx.rotatedPair(c.root, 40);
  assert.strictEqual(built.files.length, 2);
  const result = verifyRoot(c);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.lines, 80);
  assert.strictEqual(result.segments, 2);
});

test("[AC-1 | spec-hooks-audit | FR-225] verify accepts the current segment path, its directory, or the root option", () => {
  const c = ctx();
  addMany(c, 8);
  const byFile = audit.verify(logFile(c), { root: c.root });
  const byDir = audit.verify(path.dirname(logFile(c)), { root: c.root });
  const byRoot = audit.verify(null, { root: c.root });
  [byFile, byDir, byRoot].forEach((result) => {
    assert.strictEqual(result.ok, true, JSON.stringify(result));
    assert.strictEqual(result.lines, 8);
  });
});

test("[AC-1 | spec-hooks-audit | FR-225] verify does not change the log", () => {
  const c = ctx();
  addMany(c, 8);
  const before = fx.rawLog(c.root);
  verifyRoot(c);
  assert.strictEqual(fx.rawLog(c.root), before);
});

// ---------------------------------------------------------------------------
// Verification: tamper detection (NFR-030)
// ---------------------------------------------------------------------------

test("[AC-2 | spec-hooks-audit | FR-225 | NFR-030 | UR-065] line 7 edited after writing: verification fails and names line 7 as the first break", () => {
  const c = ctx();
  addMany(c, 20);
  fx.editLine(logFile(c), 7);
  const result = verifyRoot(c);
  assert.strictEqual(result.ok, false, JSON.stringify(result));
  assert.ok(result.firstBreak, "a first break is reported");
  assert.strictEqual(result.firstBreak.line, 7);
});

test("[AC-3 | spec-hooks-audit | FR-225 | NFR-030] the three-variant corpus is detected: one edited line, one deleted line, one reordered line", () => {
  const base = (() => {
    const c = ctx();
    addMany(c, 20);
    return allLines(c);
  })();
  const variants = {
    edited: (file) => fx.editLine(file, 7),
    deleted: (file) => fx.deleteLine(file, 7),
    reordered: (file) => fx.swapLines(file, 7, 8),
  };
  Object.keys(variants).forEach((name) => {
    const c = planted(base);
    variants[name](logFile(c));
    const result = verifyRoot(c);
    assert.strictEqual(result.ok, false, name + " variant went undetected: " + JSON.stringify(result));
    assert.ok(result.firstBreak && result.firstBreak.line >= 6 && result.firstBreak.line <= 8, name + " break near the change: " + JSON.stringify(result.firstBreak));
  });
});

test("[AC-3 | spec-hooks-audit | FR-225 | NFR-030] every single-line edit, deletion, and reordering is detected in a 20-line corpus (100% of the test corpus, excluding the documented last-line limit)", () => {
  const base = (() => {
    const c = ctx();
    addMany(c, 20);
    return allLines(c);
  })();
  let checked = 0;
  for (let i = 1; i <= 19; i += 1) {
    const edited = planted(base);
    fx.editLine(logFile(edited), i);
    const editResult = verifyRoot(edited);
    assert.strictEqual(editResult.ok, false, "edit of line " + i + " went undetected");
    assert.strictEqual(editResult.firstBreak.line, i, "edit of line " + i + " named line " + editResult.firstBreak.line);

    const deleted = planted(base);
    fx.deleteLine(logFile(deleted), i);
    const deleteResult = verifyRoot(deleted);
    assert.strictEqual(deleteResult.ok, false, "deletion of line " + i + " went undetected");
    assert.ok(
      deleteResult.firstBreak.line >= Math.max(1, i - 1) && deleteResult.firstBreak.line <= i,
      "deletion of line " + i + " named line " + deleteResult.firstBreak.line
    );

    const swapped = planted(base);
    fx.swapLines(logFile(swapped), i, i + 1);
    const swapResult = verifyRoot(swapped);
    assert.strictEqual(swapResult.ok, false, "swap of lines " + i + " and " + (i + 1) + " went undetected");
    assert.ok(
      swapResult.firstBreak.line >= Math.max(1, i - 1) && swapResult.firstBreak.line <= i + 1,
      "swap of lines " + i + " and " + (i + 1) + " named line " + swapResult.firstBreak.line
    );
    checked += 3;
  }
  assert.strictEqual(checked, 57);
});

test("[AC-3 | spec-hooks-audit | FR-225 | NFR-030] a reordering of two distant lines is detected", () => {
  const c = ctx();
  addMany(c, 20);
  fx.swapLines(logFile(c), 3, 12);
  const result = verifyRoot(c);
  assert.strictEqual(result.ok, false, JSON.stringify(result));
  assert.ok(result.firstBreak.line >= 2 && result.firstBreak.line <= 4, JSON.stringify(result.firstBreak));
});

test("[AC-3 | spec-hooks-audit | FR-225 | NFR-030] a tamper inside a rotated segment is found, and the cut still carries the hash", () => {
  const c = ctx();
  fx.writeChain(c.root, [10, 10, 10]);
  const segs = fx.segmentFiles(c.root);
  assert.strictEqual(segs.rotated.length, 2);
  fx.editLine(segs.rotated[1], 5);
  const result = verifyRoot(c);
  assert.strictEqual(result.ok, false, JSON.stringify(result));
  assert.strictEqual(result.firstBreak.line, 15, "numbered from 1 across all segments");
});

test("[AC-3 | spec-hooks-audit | FR-225 | NFR-032] a missing middle segment breaks the chain at the cut", () => {
  const c = ctx();
  fx.writeChain(c.root, [10, 10, 10]);
  const segs = fx.segmentFiles(c.root);
  fs.unlinkSync(segs.rotated[1]);
  const result = verifyRoot(c);
  assert.strictEqual(result.ok, false, JSON.stringify(result));
});

test("[AC-3 | spec-hooks-audit | FR-225] a first line that does not hold the genesis value breaks the chain at line 1", () => {
  const c = ctx();
  addMany(c, 5);
  const lineTexts = allLines(c);
  const first = JSON.parse(lineTexts[0]);
  first.prev = "f".repeat(64);
  lineTexts[0] = JSON.stringify(first);
  fx.plantLines(c.root, lineTexts);
  const result = verifyRoot(c);
  assert.strictEqual(result.ok, false, JSON.stringify(result));
  assert.strictEqual(result.firstBreak.line, 1);
});

test("[AC-3 | spec-hooks-audit | FR-225] a line that is not a JSON record breaks the chain at or next to that line", () => {
  // Type mismatch: a text line in a JSONL log.
  const c = ctx();
  addMany(c, 8);
  const lineTexts = allLines(c);
  lineTexts[4] = "this is not json";
  fx.plantLines(c.root, lineTexts);
  const result = verifyRoot(c);
  assert.strictEqual(result.ok, false, JSON.stringify(result));
  assert.ok(result.firstBreak.line >= 4 && result.firstBreak.line <= 5, JSON.stringify(result.firstBreak));
});

test("[AC-3 | spec-hooks-audit | FR-225] a partial last line is reported at that line with a partial-line reason", () => {
  const c = ctx();
  addMany(c, 5);
  fx.appendPartial(logFile(c));
  const result = verifyRoot(c);
  assert.strictEqual(result.ok, false, JSON.stringify(result));
  assert.strictEqual(result.firstBreak.line, 6);
  assert.ok(/partial/i.test(String(result.firstBreak.reason)), String(result.firstBreak.reason));
});

test("[AC-1 | spec-hooks-audit | FR-225] an unreadable segment returns an error result and never throws", () => {
  // Invalid environment: the current segment path is a directory.
  const c = ctx();
  fs.mkdirSync(logFile(c), { recursive: true });
  let result;
  assert.doesNotThrow(() => {
    result = verifyRoot(c);
  });
  assert.strictEqual(result.ok, false);
  assert.ok(result.error && typeof result.error.code === "string", JSON.stringify(result));
});

// ---------------------------------------------------------------------------
// Documented limit (NFR-030): the chain cannot confirm the last line or detect removed trailing lines
// ---------------------------------------------------------------------------

test("[AC-2 | spec-hooks-audit | NFR-030 | FR-225] documented limit: an edit of the final line is not detected without a head anchor", () => {
  // This test records the stated limit; it is not a defect. A line is confirmed by the line after it, and the last
  // line has no successor. A head anchor kept outside the log is deferred.
  const c = ctx();
  addMany(c, 10);
  fx.editLine(logFile(c), 10);
  const result = verifyRoot(c);
  assert.strictEqual(result.ok, true, "the final line cannot be confirmed by the backward chain: " + JSON.stringify(result));
  assert.strictEqual(result.lines, 10);
});

test("[AC-3 | spec-hooks-audit | NFR-030 | FR-225] documented limit: lines removed from the end leave a shorter chain that still verifies", () => {
  const c = ctx();
  addMany(c, 10);
  fx.dropTail(logFile(c), 3);
  const result = verifyRoot(c);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.lines, 7);
});

test("[AC-3 | spec-hooks-audit | NFR-030 | FR-225] documented limit: the edit that stays undetected is the last line only; the line before it is still caught", () => {
  const c = ctx();
  addMany(c, 10);
  fx.editLine(logFile(c), 9);
  const result = verifyRoot(c);
  assert.strictEqual(result.ok, false, JSON.stringify(result));
  assert.strictEqual(result.firstBreak.line, 9);
});

// ---------------------------------------------------------------------------
// Performance (estimates until measured)
// ---------------------------------------------------------------------------

test("[Requirement: Chain verification | spec-hooks-audit | NFR-030 | FR-225] a 100,000-line log verifies in at most 10 seconds (estimate target, in-process)", () => {
  const c = ctx();
  const built = fx.generateLargeChain(c.root, 100000, 4);
  assert.strictEqual(built.total, 100000);
  const started = Date.now();
  const result = verifyRoot(c);
  const seconds = (Date.now() - started) / 1000;
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.lines, 100000);
  assert.ok(seconds <= 10, "verification took " + seconds + " s against the 10 s target (an estimate until measured)");
});

test("[Requirement: Hash-chained append | spec-hooks-audit | NFR-029 | NFR-026] 100 appends stay within the 30 ms per-hook median budget (estimate until measured on target hardware)", () => {
  const c = ctx();
  const times = [];
  for (let i = 1; i <= 100; i += 1) {
    const started = process.hrtime.bigint();
    const res = add(c, { rule_id: "rule-" + i, n: i });
    times.push(Number(process.hrtime.bigint() - started) / 1e6);
    assert.strictEqual(res.ok, true, JSON.stringify(res));
  }
  const middle = fx.median(times);
  assert.ok(middle <= 30, "median append " + middle.toFixed(2) + " ms against the 30 ms budget (estimate)");
  assert.strictEqual(allLines(c).length, 100);
});

test("[Requirement: Hash-chained append | spec-hooks-audit | NFR-029] one append to a 100,000-line log reads the tail and stays within the 150 ms total budget (estimate)", () => {
  const c = ctx();
  const built = fx.generateLargeChain(c.root, 100000, 4);
  const started = Date.now();
  const res = add(c, { rule_id: "rule-after-large-log" });
  const elapsed = Date.now() - started;
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.ok(elapsed <= 150, "one append took " + elapsed + " ms against the 150 ms budget (estimate)");
  const lineTexts = allLines(c);
  const last = JSON.parse(lineTexts[lineTexts.length - 1]);
  assert.strictEqual(last.rule_id, "rule-after-large-log");
  assert.strictEqual(last.prev, built.lastHash, "the new line chains to the generated log's final hash");
});
