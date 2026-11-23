// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the 1.14.6 confirmation-store hardening:
// plugins/assist-plugin/hooks/lib/confirmation-store.js.
//
// Sources: specs/spec-hooks-strict-json.md, Change Log 2026-11-23 (MODIFIED Requirement 7: the 1 MiB read cap also
// covers the read inside markPendingUsed; ADDED Requirement 10: the store-read-failed and store-write-failed
// diagnostics hold the file basename and the errno code only), docs/requirements/FR-NFR-harness-governance.md
// (FR-249, NFR-028, NFR-016). Task plan: docs/task-plans/task-plan-followup-nits-20261123-1027.md, Step 3.
//
// Traceability format: [strict-json R<n> | FR-nnn | NFR-nnn | Scenario title]. The spec carries no SPEC-NNN id, so
// it is cited by file stem and requirement number ("strict-json R7").
//
// Scenarios covered:
//   R7  Over-cap store file in markPendingUsed       (over-cap tests)
//   R7  At-cap store file in markPendingUsed unchanged (at-cap tests)
//   R10 Store diagnostic holds no OS message         (diagnostics tests)
// The Scenario "Rejected confirmation record (regression)" gets no test here: parseLines is unchanged and the tests in
// tests/hooks/strict-json-readers.test.js (Requirement 7, AC-1 and AC-3) already cover it.
//
// Public interface used (module exports and the documented options of the library header):
//   STORE_DIR, PENDING_FILE, CONFIRMATIONS_FILE, StoreError
//   createPending({pr, verdict, sessionId}, options) -> record {pr, verdict, token, session_id, created_at}
//   findPending(token, sessionId, options)           -> record or null
//   markPendingUsed(record, options)                 -> true when a record was marked, false otherwise
//   recordConfirmation({pr, verdict, userMessageRef}, options); readConfirmations(options) -> records
//   options: {root, now, log}; `log` receives one entry {level, event, ...fields} per problem.
//
// Every store lives in a temp directory. Oversize files are built at run time (valid record plus blank-line padding)
// and are never committed.
//
// Run: node --test tests/hooks/confirmation-store-hardening.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const store = require(path.join(REPO, "plugins", "assist-plugin", "hooks", "lib", "confirmation-store.js"));

const T0 = 1700000000000;
const CAP = 1024 * 1024;
// Bytes of room left under the cap for the "used" and "used_at" fields that markPendingUsed adds to the record
// (about 50 bytes); the margin keeps the file at or under the cap after the mark.
const MARK_HEADROOM = 512;
const scratch = [];

after(() => {
  scratch.forEach((dir) => {
    try {
      fs.chmodSync(path.join(dir, store.STORE_DIR), 0o755);
    } catch (e) {
      // The directory may not exist or may already be writable.
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tempRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "confirmation-store-hardening-"));
  scratch.push(dir);
  return dir;
}

function storeFile(root, name) {
  return path.join(root, store.STORE_DIR, name);
}

function at(ms) {
  return function () {
    return ms;
  };
}

function collector() {
  const entries = [];
  return {
    entries: entries,
    log: function (entry) {
      entries.push(entry);
    },
  };
}

function createRecord(root) {
  return store.createPending({ pr: 42, verdict: "approve", sessionId: "sess-1" }, { root: root, now: at(T0) });
}

function recordLines(file) {
  return fs.readFileSync(file, "utf8").split("\n").filter((l) => l.trim() !== "");
}

// Rewrites `file` so it holds exactly `size` bytes: `lines` plus blank-line padding, after the records or before them.
function writeSized(file, lines, size, padFirst) {
  const body = lines.join("\n") + "\n";
  const bodyBytes = Buffer.byteLength(body);
  assert.ok(bodyBytes <= size, "set-up: the records (" + bodyBytes + " bytes) fit in " + size + " bytes");
  const pad = "\n".repeat(size - bodyBytes);
  fs.writeFileSync(file, padFirst ? pad + body : body + pad);
  assert.strictEqual(fs.statSync(file).size, size, "set-up: the file holds exactly " + size + " bytes");
}

// A pending file of `size` bytes that holds the one valid unused record of `rec`.
function sizedPendingRoot(size, padFirst) {
  const root = tempRoot();
  const rec = createRecord(root);
  const file = storeFile(root, store.PENDING_FILE);
  writeSized(file, recordLines(file), size, padFirst);
  return { root: root, rec: rec, file: file };
}

// Asserts the Requirement 10 contract on one diagnostic entry.
function assertMessageFree(entry, root, expectedFile, codePattern) {
  const label = JSON.stringify(entry);
  assert.strictEqual(entry.file, expectedFile, "file is the basename: " + label);
  assert.ok(!Object.prototype.hasOwnProperty.call(entry, "message"), "no message key: " + label);
  assert.match(String(entry.code), codePattern, "an errno code: " + label);
  Object.keys(entry).forEach((key) => {
    const value = typeof entry[key] === "string" ? entry[key] : JSON.stringify(entry[key]);
    assert.ok(value.indexOf(root) === -1, "key " + key + " holds the temp root: " + label);
    assert.ok(value.indexOf(path.basename(root)) === -1, "key " + key + " holds a temp directory name: " + label);
    assert.ok(value.indexOf(os.tmpdir()) === -1, "key " + key + " holds the temp dir path: " + label);
    assert.ok(!/[\\/]/.test(value), "key " + key + " holds a path separator: " + label);
  });
}

function failures(entries) {
  return entries.filter((e) => e && /^store-(read|write)-failed$/.test(e.event));
}

// Makes the store file a directory so a read or an append throws EISDIR.
function fileAsDirectory(root, name) {
  fs.mkdirSync(storeFile(root, name), { recursive: true });
}

// Set-up check: a raw OS error for a path under this store file carries the absolute path in its message, so the
// message-free assertions below are not vacuous. The read of a directory itself gives an EISDIR message with no path on
// some Node versions, so the check reads a missing child of that directory: the ENOENT message embeds the path.
function assertOsMessageHoldsPath(root, name) {
  const missing = path.join(storeFile(root, name), "no-such-child");
  let caught = null;
  try {
    fs.readFileSync(missing, "utf8");
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, "set-up: reading a missing path fails");
  assert.strictEqual(caught.code, "ENOENT");
  assert.ok(String(caught.message).indexOf(root) !== -1, "set-up: the OS message holds the absolute path: " + caught.message);
}

// ---------------------------------------------------------------------------
// Requirement 7, Scenario "Over-cap store file in markPendingUsed"
// ---------------------------------------------------------------------------

[CAP + 1, CAP + 4096, 2 * CAP].forEach((size) => {
  [false, true].forEach((padFirst) => {
    test(
      "[strict-json R7 | FR-249 | NFR-028 | Over-cap store file in markPendingUsed] a pending.jsonl of " +
        size +
        " bytes (" +
        (size - CAP) +
        " over 1 MiB, padding " +
        (padFirst ? "before" : "after") +
        " one valid record): markPendingUsed returns false, leaves the file unchanged, and logs store-too-large with the basename",
      () => {
        const ctx = sizedPendingRoot(size, padFirst);
        const before = fs.readFileSync(ctx.file);
        const sink = collector();
        let result;
        assert.doesNotThrow(() => {
          result = store.markPendingUsed(ctx.rec, { root: ctx.root, now: at(T0 + 1000), log: sink.log });
        });
        assert.strictEqual(result, false, "an over-cap store file marks nothing");
        assert.ok(before.equals(fs.readFileSync(ctx.file)), "the file bytes are unchanged");
        assert.strictEqual(fs.statSync(ctx.file).size, size, "the file size is unchanged");

        const tooLarge = sink.entries.filter((e) => e && e.event === "store-too-large");
        assert.ok(tooLarge.length >= 1, "a store-too-large record was logged: " + JSON.stringify(sink.entries));
        tooLarge.forEach((entry) => {
          assert.strictEqual(entry.file, store.PENDING_FILE, "the record carries the basename: " + JSON.stringify(entry));
          assert.ok(!Object.prototype.hasOwnProperty.call(entry, "message"), "no OS message: " + JSON.stringify(entry));
        });
        const serialized = JSON.stringify(sink.entries);
        assert.ok(serialized.indexOf(ctx.root) === -1, "no absolute path in the log: " + serialized);
        assert.ok(serialized.indexOf(path.basename(ctx.root)) === -1, "no temp directory name in the log: " + serialized);
        assert.ok(serialized.indexOf(ctx.rec.token) === -1, "no token in the log: " + serialized);
      }
    );
  });
});

test("[strict-json R7 | FR-249 | NFR-028 | Over-cap store file in markPendingUsed] an over-cap pending.jsonl refuses the mark with no log callback given, and the token stays unconsumed on disk", () => {
  const ctx = sizedPendingRoot(CAP + 1, false);
  const before = fs.readFileSync(ctx.file);
  let result;
  assert.doesNotThrow(() => {
    result = store.markPendingUsed(ctx.rec, { root: ctx.root, now: at(T0 + 1000) });
  });
  assert.strictEqual(result, false);
  assert.ok(before.equals(fs.readFileSync(ctx.file)), "the file bytes are unchanged");
  // Boundary: once the file is back at the cap, the same record is markable, so the refusal was the size alone.
  writeSized(ctx.file, recordLines(ctx.file), CAP, false);
  assert.strictEqual(store.markPendingUsed(ctx.rec, { root: ctx.root, now: at(T0 + 1000) }), true);
});

test("[strict-json R7 | FR-249 | NFR-028 | Over-cap store file in markPendingUsed] an over-cap pending.jsonl that holds a matching record and another record marks neither", () => {
  const root = tempRoot();
  const first = store.createPending({ pr: 1, verdict: "approve", sessionId: "sess-1" }, { root: root, now: at(T0) });
  const second = store.createPending({ pr: 2, verdict: "decline", sessionId: "sess-1" }, { root: root, now: at(T0) });
  const file = storeFile(root, store.PENDING_FILE);
  writeSized(file, recordLines(file), CAP + 1, true);
  const before = fs.readFileSync(file);
  assert.strictEqual(store.markPendingUsed(first, { root: root, now: at(T0 + 1000) }), false);
  assert.strictEqual(store.markPendingUsed(second, { root: root, now: at(T0 + 1000) }), false);
  assert.ok(before.equals(fs.readFileSync(file)), "the file bytes are unchanged");
});

// ---------------------------------------------------------------------------
// Requirement 7, Scenario "At-cap store file in markPendingUsed unchanged"
//
// The mark rewrites the record with "used" and "used_at" added, which grows the file. The files below are built a
// little under 1 MiB so the file stays at or under 1 MiB after the mark; the test asserts that, so every later read in
// the test is a read of an at-or-under-cap file. The exact-1-MiB read is covered by the boundary check in the over-cap
// test above (a file of exactly CAP bytes is markable).
// ---------------------------------------------------------------------------

[CAP - MARK_HEADROOM, CAP - MARK_HEADROOM - 1].forEach((size) => {
  [false, true].forEach((padFirst) => {
    test(
      "[strict-json R7 | FR-249 | NFR-028 | At-cap store file in markPendingUsed unchanged] a pending.jsonl of " +
        size +
        " bytes (" +
        MARK_HEADROOM +
        (size === CAP - MARK_HEADROOM ? "" : " plus one") +
        " bytes under 1 MiB, padding " +
        (padFirst ? "before" : "after") +
        " one valid record): the record is marked used, the file stays at or under 1 MiB, and true returns, as before",
      () => {
        const ctx = sizedPendingRoot(size, padFirst);
        const sink = collector();
        const opts = { root: ctx.root, now: at(T0 + 1000), log: sink.log };
        const found = store.findPending(ctx.rec.token, "sess-1", opts);
        assert.ok(found, "set-up: the token is found below the cap");
        assert.strictEqual(store.markPendingUsed(found, opts), true);
        const after = fs.statSync(ctx.file).size;
        assert.ok(after <= CAP, "the file is at or under 1 MiB after the mark (" + after + " bytes), so the cap is not crossed");
        const stored = recordLines(ctx.file).map((l) => JSON.parse(l));
        const mine = stored.filter((r) => r.token === ctx.rec.token);
        assert.strictEqual(mine.length, 1, "the record is kept for audit");
        assert.strictEqual(mine[0].used, true, "the record is marked used");
        assert.ok(!store.findPending(ctx.rec.token, "sess-1", opts), "the used token no longer matches");
        assert.strictEqual(
          sink.entries.filter((e) => e && e.event === "store-too-large").length,
          0,
          "no store-too-large record for a file at or under the cap: " + JSON.stringify(sink.entries)
        );
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Requirement 10, Scenario "Store diagnostic holds no OS message"
// ---------------------------------------------------------------------------

test("[strict-json R10 | FR-249 | NFR-016 | Store diagnostic holds no OS message] a read failure of confirmations.jsonl (a directory in its place) logs store-read-failed with the basename and errno code, no message, no path", () => {
  const root = tempRoot();
  fileAsDirectory(root, store.CONFIRMATIONS_FILE);
  assertOsMessageHoldsPath(root, store.CONFIRMATIONS_FILE);
  const sink = collector();
  let records;
  assert.doesNotThrow(() => {
    records = store.readConfirmations({ root: root, log: sink.log });
  });
  assert.deepStrictEqual(records, [], "a read failure yields no records");
  const reads = sink.entries.filter((e) => e && e.event === "store-read-failed");
  assert.ok(reads.length >= 1, "a store-read-failed record: " + JSON.stringify(sink.entries));
  failures(sink.entries).forEach((entry) => assertMessageFree(entry, root, store.CONFIRMATIONS_FILE, /^EISDIR$/));
});

test("[strict-json R10 | FR-249 | NFR-016 | Store diagnostic holds no OS message] a read failure of pending.jsonl in findPending logs store-read-failed with the basename and errno code, no message, no path", () => {
  const root = tempRoot();
  fileAsDirectory(root, store.PENDING_FILE);
  assertOsMessageHoldsPath(root, store.PENDING_FILE);
  const sink = collector();
  let found;
  assert.doesNotThrow(() => {
    found = store.findPending("ABCDEF", "sess-1", { root: root, now: at(T0), log: sink.log });
  });
  assert.ok(!found, "a read failure finds no token");
  const reads = sink.entries.filter((e) => e && e.event === "store-read-failed");
  assert.ok(reads.length >= 1, "a store-read-failed record: " + JSON.stringify(sink.entries));
  failures(sink.entries).forEach((entry) => assertMessageFree(entry, root, store.PENDING_FILE, /^EISDIR$/));
});

test("[strict-json R10 | FR-249 | NFR-016 | Store diagnostic holds no OS message] a write failure of confirmations.jsonl in recordConfirmation logs store-write-failed with the basename and errno code, no message, no path", () => {
  const root = tempRoot();
  fileAsDirectory(root, store.CONFIRMATIONS_FILE);
  assertOsMessageHoldsPath(root, store.CONFIRMATIONS_FILE);
  const sink = collector();
  assert.throws(
    () => store.recordConfirmation({ pr: 42, verdict: "approve", userMessageRef: "sess-1:1" }, { root: root, now: at(T0), log: sink.log }),
    (err) => err instanceof Error,
    "a write failure throws"
  );
  const writes = sink.entries.filter((e) => e && e.event === "store-write-failed");
  assert.ok(writes.length >= 1, "a store-write-failed record: " + JSON.stringify(sink.entries));
  failures(sink.entries).forEach((entry) => assertMessageFree(entry, root, store.CONFIRMATIONS_FILE, /^EISDIR$/));
});

test("[strict-json R10 | FR-249 | NFR-016 | Store diagnostic holds no OS message] a write failure of pending.jsonl in createPending logs store-write-failed with the basename and errno code, no message, no path", () => {
  const root = tempRoot();
  fileAsDirectory(root, store.PENDING_FILE);
  assertOsMessageHoldsPath(root, store.PENDING_FILE);
  const sink = collector();
  assert.throws(
    () => store.createPending({ pr: 42, verdict: "approve", sessionId: "sess-1" }, { root: root, now: at(T0), log: sink.log }),
    (err) => err instanceof Error,
    "a write failure throws"
  );
  const writes = sink.entries.filter((e) => e && e.event === "store-write-failed");
  assert.ok(writes.length >= 1, "a store-write-failed record: " + JSON.stringify(sink.entries));
  failures(sink.entries).forEach((entry) => assertMessageFree(entry, root, store.PENDING_FILE, /^EISDIR$/));
});

test("[strict-json R10 | FR-249 | NFR-016 | Store diagnostic holds no OS message] a failed read inside markPendingUsed (a directory in place of pending.jsonl) logs only message-free diagnostics", () => {
  const root = tempRoot();
  fileAsDirectory(root, store.PENDING_FILE);
  assertOsMessageHoldsPath(root, store.PENDING_FILE);
  const sink = collector();
  const ghost = { pr: "42", verdict: "approve", token: "ABCDEF", session_id: "sess-1", created_at: new Date(T0).toISOString() };
  let result = null;
  try {
    result = store.markPendingUsed(ghost, { root: root, now: at(T0 + 1000), log: sink.log });
  } catch (err) {
    // The write-side contract of the store: a failure throws a StoreError. Either outcome is acceptable here.
    assert.ok(err instanceof Error);
  }
  assert.ok(result === null || result === false, "nothing is marked");
  const all = failures(sink.entries);
  assert.ok(all.length >= 1, "a store-read-failed or store-write-failed record: " + JSON.stringify(sink.entries));
  all.forEach((entry) => assertMessageFree(entry, root, store.PENDING_FILE, /^EISDIR$/));
});

test("[strict-json R10 | FR-249 | NFR-016 | Store diagnostic holds no OS message] a write failure inside markPendingUsed (read-only store) logs store-write-failed with the basename and errno code, no message, no path", (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX permission bits are not enforced on Windows");
    return;
  }
  const root = tempRoot();
  const rec = createRecord(root);
  const dir = path.join(root, store.STORE_DIR);
  const file = storeFile(root, store.PENDING_FILE);
  fs.chmodSync(file, 0o444);
  fs.chmodSync(dir, 0o555);
  try {
    let writable = false;
    try {
      fs.writeFileSync(path.join(dir, ".probe"), "");
      fs.rmSync(path.join(dir, ".probe"), { force: true });
      writable = true;
    } catch (e) {
      writable = false;
    }
    try {
      fs.accessSync(file, fs.constants.W_OK);
      writable = true;
    } catch (e) {
      // Not writable, as set up.
    }
    if (writable) {
      t.skip("the process can write through read-only permissions (for example, it runs as root)");
      return;
    }
    const sink = collector();
    let result = null;
    try {
      result = store.markPendingUsed(rec, { root: root, now: at(T0 + 1000), log: sink.log });
    } catch (err) {
      assert.ok(err instanceof Error, "a write failure throws");
    }
    assert.ok(result === null || result === false, "nothing is marked when the write fails");
    const writes = sink.entries.filter((e) => e && e.event === "store-write-failed");
    assert.ok(writes.length >= 1, "a store-write-failed record: " + JSON.stringify(sink.entries));
    failures(sink.entries).forEach((entry) => assertMessageFree(entry, root, store.PENDING_FILE, /^E[A-Z]+$/));
  } finally {
    fs.chmodSync(dir, 0o755);
    fs.chmodSync(file, 0o644);
  }
});
