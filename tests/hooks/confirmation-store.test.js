// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the confirmation store library (harness-governance Tranche 1, Step 2):
// plugins/assist-plugin/hooks/lib/confirmation-store.js.
//
// Sources: docs/requirements/FR-NFR-harness-governance.md, section 2.29 (FR-242: User confirmation recorded,
// Affirmative without the token rejected, Expired or reused token rejected, Pending record is not a
// confirmation, Forged confirmation rejected), section 2.32 (FR-245), NFR-031 (no token or message text in
// records). Task plan: docs/task-plans/task-plan-harness-governance-20261028-0759.md, Step 2 and Step 9.
//
// Traceability format: [FR-ids | AC section | Scenario title]. The requirement document uses numbered
// acceptance sections and carries no SPEC-NNN id for this feature, so none is cited.
//
// Public interface used (module exports):
//   STORE_DIR, CONFIRMATIONS_FILE, PENDING_FILE, PENDING_EXPIRY_MS, TOKEN_PATTERN, StoreError
//   createPending({pr, verdict, sessionId}, options)      -> pending record {pr, verdict, token, session_id, created_at}
//   findPending(token, sessionId, options)                -> record or null
//   markPendingUsed(record, options)                      -> true when a record was marked, false otherwise
//   recordConfirmation({pr, verdict, userMessageRef}, options)
//   readConfirmations(options) -> records; findConfirmation(pr, verdict, options) -> record or null
//   options: {root, now, expiryMs, log}; `root` is the absolute project root, `now` a function returning ms.
//
// Every store lives in a temp directory.
//
// Run: node --test tests/hooks/confirmation-store.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const store = require(path.join(REPO, "plugins", "assist-plugin", "hooks", "lib", "confirmation-store.js"));

const T0 = 1700000000000;
const scratch = [];

after(() => {
  scratch.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function tempRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "confirmation-store-"));
  scratch.push(dir);
  return dir;
}

function storePath(root, name) {
  return path.join(root, ".agent", "governance", "confirmations", name);
}

function lines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter((l) => l.trim() !== "");
}

function at(ms) {
  return function () {
    return ms;
  };
}

function pending(root, extra) {
  const opts = Object.assign({ root: root, now: at(T0) }, (extra && extra.options) || {});
  return store.createPending(Object.assign({ pr: 42, verdict: "approve", sessionId: "sess-1" }, (extra && extra.fields) || {}), opts);
}

// ---------------------------------------------------------------------------
// Layout and constants
// ---------------------------------------------------------------------------

test("[FR-242 | 2.29 | Pending record is not a confirmation] the store is the directory .agent/governance/confirmations with two named files", () => {
  assert.strictEqual(store.STORE_DIR, path.join(".agent", "governance", "confirmations"));
  assert.strictEqual(store.CONFIRMATIONS_FILE, "confirmations.jsonl");
  assert.strictEqual(store.PENDING_FILE, "pending.jsonl");
});

test("[FR-242 | 2.29 | Expired or reused token rejected] the expiry window is short: more than zero and at most an hour", () => {
  assert.strictEqual(typeof store.PENDING_EXPIRY_MS, "number");
  assert.ok(store.PENDING_EXPIRY_MS > 0);
  assert.ok(store.PENDING_EXPIRY_MS <= 60 * 60 * 1000, "on the order of minutes, not hours: " + store.PENDING_EXPIRY_MS);
});

test("[FR-242 | 2.29 | User confirmation recorded] a created token is short, typable, and free of I and O", () => {
  const root = tempRoot();
  const rec = pending(root);
  assert.match(rec.token, store.TOKEN_PATTERN);
  assert.strictEqual(rec.token.length, 6);
  assert.ok(!/[IO01]/.test(rec.token.replace(/[^A-Z0-9]/g, "")) || !/[IO]/.test(rec.token), "no I or O");
});

// ---------------------------------------------------------------------------
// createPending
// ---------------------------------------------------------------------------

test("[FR-242 | 2.29 | User confirmation recorded] createPending writes the pending record to pending.jsonl and nothing to confirmations.jsonl", () => {
  const root = tempRoot();
  const rec = pending(root);
  assert.strictEqual(String(rec.pr), "42");
  assert.strictEqual(rec.verdict, "approve");
  assert.strictEqual(rec.session_id, "sess-1");
  assert.ok(rec.created_at !== undefined && rec.created_at !== null, "a creation timestamp");
  const stored = lines(storePath(root, "pending.jsonl"));
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(JSON.parse(stored[0]).token, rec.token);
  assert.ok(!fs.existsSync(storePath(root, "confirmations.jsonl")), "confirmations.jsonl is the hook's file alone");
});

test("[FR-242 | 2.29 | Affirmative without the token rejected] tokens are unguessable in practice: 100 pending records give 100 distinct tokens", () => {
  const root = tempRoot();
  const seen = new Set();
  for (let i = 0; i < 100; i += 1) {
    seen.add(pending(root, { fields: { pr: 100 + i } }).token);
  }
  assert.strictEqual(seen.size, 100);
});

test("[FR-242 | 2.29 | User confirmation recorded] a PR given as owner/repo#N round-trips as text", () => {
  const root = tempRoot();
  const rec = pending(root, { fields: { pr: "acme/shop#42" } });
  assert.strictEqual(String(rec.pr), "acme/shop#42");
  const found = store.findPending(rec.token, "sess-1", { root: root, now: at(T0 + 1000) });
  assert.ok(found);
  assert.strictEqual(String(found.pr), "acme/shop#42");
});

// ---------------------------------------------------------------------------
// findPending: the match and every no-match
// ---------------------------------------------------------------------------

test("[FR-242 | 2.29 | User confirmation recorded] findPending returns the record for its token and session while it is unused and fresh", () => {
  const root = tempRoot();
  const rec = pending(root);
  const found = store.findPending(rec.token, "sess-1", { root: root, now: at(T0 + 30 * 1000) });
  assert.ok(found, "a match");
  assert.strictEqual(found.token, rec.token);
  assert.strictEqual(String(found.pr), "42");
  assert.strictEqual(found.verdict, "approve");
});

[
  ["empty string", ""],
  ["too short", "ABC"],
  ["five characters", "ABCDE"],
  ["seven characters", "ABCDEFG"],
  ["letter I", "IIIIII"],
  ["letter O", "OOOOOO"],
  ["digits 0 and 1", "010101"],
  ["inner space", "AB CDE"],
  ["punctuation", "AB-CD!"],
  ["shell metacharacters", "$(id);"],
  ["SQL-shaped", "' OR 1"],
  ["null", null],
  ["undefined", undefined],
  ["number", 123456],
  ["object", {}],
  ["array", ["ABCDEF"]],
].forEach((row) => {
  test("[FR-242 | 2.29 | Affirmative without the token rejected] findPending returns no match for a malformed token: " + row[0], () => {
    const root = tempRoot();
    pending(root);
    let result;
    assert.doesNotThrow(() => {
      result = store.findPending(row[1], "sess-1", { root: root, now: at(T0 + 1000) });
    });
    assert.ok(result === null || result === undefined, "no match for " + row[0]);
  });
});

test("[FR-242 | 2.29 | Affirmative without the token rejected] findPending returns no match for an unknown token of the right shape", () => {
  const root = tempRoot();
  const rec = pending(root);
  const other = rec.token === "ZZZZZZ" ? "222222" : "ZZZZZZ";
  assert.ok(!store.findPending(other, "sess-1", { root: root, now: at(T0 + 1000) }));
});

test("[FR-242 | 2.29 | Affirmative without the token rejected] findPending returns no match when there is no store at all", () => {
  const root = tempRoot();
  assert.ok(!store.findPending("ABCDEF", "sess-1", { root: root, now: at(T0) }));
});

test("[FR-242 | 2.29 | Affirmative without the token rejected] findPending returns no match for a token that belongs to another session", () => {
  const root = tempRoot();
  const rec = pending(root);
  assert.ok(!store.findPending(rec.token, "sess-2", { root: root, now: at(T0 + 1000) }));
  assert.ok(!store.findPending(rec.token, "", { root: root, now: at(T0 + 1000) }));
  assert.ok(!store.findPending(rec.token, undefined, { root: root, now: at(T0 + 1000) }));
  assert.ok(!store.findPending(rec.token, null, { root: root, now: at(T0 + 1000) }));
  assert.ok(store.findPending(rec.token, "sess-1", { root: root, now: at(T0 + 1000) }), "the right session still matches");
});

test("[FR-242 | 2.29 | Expired or reused token rejected] findPending returns no match once the default window has passed", () => {
  const root = tempRoot();
  const rec = pending(root);
  assert.ok(store.findPending(rec.token, "sess-1", { root: root, now: at(T0 + store.PENDING_EXPIRY_MS - 5000) }), "inside the window");
  assert.ok(!store.findPending(rec.token, "sess-1", { root: root, now: at(T0 + store.PENDING_EXPIRY_MS + 5000) }), "outside the window");
});

test("[FR-242 | 2.29 | Expired or reused token rejected] a caller-set expiryMs shortens the window; a never-used token still expires", () => {
  const root = tempRoot();
  const rec = pending(root);
  assert.ok(store.findPending(rec.token, "sess-1", { root: root, now: at(T0 + 5000), expiryMs: 10000 }));
  assert.ok(!store.findPending(rec.token, "sess-1", { root: root, now: at(T0 + 20000), expiryMs: 10000 }));
});

test("[FR-242 | 2.29 | Expired or reused token rejected] findPending returns no match for a creation timestamp in the future", () => {
  const root = tempRoot();
  const rec = store.createPending({ pr: 42, verdict: "approve", sessionId: "sess-1" }, { root: root, now: at(T0 + 3600 * 1000) });
  assert.ok(!store.findPending(rec.token, "sess-1", { root: root, now: at(T0) }));
});

test("[FR-242 | 2.29 | Expired or reused token rejected] a pending line with a missing or unreadable creation timestamp is no match", () => {
  const root = tempRoot();
  fs.mkdirSync(path.dirname(storePath(root, "pending.jsonl")), { recursive: true });
  fs.writeFileSync(
    storePath(root, "pending.jsonl"),
    [
      JSON.stringify({ pr: "42", verdict: "approve", token: "ABCDEF", session_id: "sess-1" }),
      JSON.stringify({ pr: "42", verdict: "approve", token: "GHJKLM", session_id: "sess-1", created_at: "not a time" }),
    ].join("\n") + "\n"
  );
  assert.ok(!store.findPending("ABCDEF", "sess-1", { root: root, now: at(T0) }));
  assert.ok(!store.findPending("GHJKLM", "sess-1", { root: root, now: at(T0) }));
});

test("[FR-242 | 2.29 | Expired or reused token rejected] garbage lines in pending.jsonl never throw and do not hide a good record", () => {
  const root = tempRoot();
  const rec = pending(root);
  fs.appendFileSync(storePath(root, "pending.jsonl"), "garbage\n{broken\n\n[1,2]\n");
  let found;
  assert.doesNotThrow(() => {
    found = store.findPending(rec.token, "sess-1", { root: root, now: at(T0 + 1000) });
  });
  assert.ok(found);
});

// ---------------------------------------------------------------------------
// markPendingUsed: consume once, keep the record
// ---------------------------------------------------------------------------

test("[FR-242 | 2.29 | Expired or reused token rejected] markPendingUsed consumes the token once: the next findPending is no match", () => {
  const root = tempRoot();
  const rec = pending(root);
  const opts = { root: root, now: at(T0 + 1000) };
  const found = store.findPending(rec.token, "sess-1", opts);
  assert.ok(found);
  assert.strictEqual(store.markPendingUsed(found, opts), true);
  assert.ok(!store.findPending(rec.token, "sess-1", opts), "a repeat of the same token confirms nothing");
  assert.strictEqual(store.markPendingUsed(found, opts), false, "a second consume marks nothing");
});

test("[FR-242 | 2.29 | Expired or reused token rejected] markPendingUsed keeps the used record in pending.jsonl for audit", () => {
  const root = tempRoot();
  const rec = pending(root);
  const opts = { root: root, now: at(T0 + 1000) };
  store.markPendingUsed(store.findPending(rec.token, "sess-1", opts), opts);
  const stored = lines(storePath(root, "pending.jsonl")).map((l) => JSON.parse(l));
  assert.strictEqual(stored.length, 1, "the record is kept, not removed");
  assert.strictEqual(stored[0].token, rec.token);
  assert.strictEqual(stored[0].used, true);
});

test("[FR-242 | 2.29 | Expired or reused token rejected] markPendingUsed leaves other pending records and unparseable lines as they were", () => {
  const root = tempRoot();
  const first = pending(root, { fields: { pr: 1 } });
  const second = pending(root, { fields: { pr: 2 } });
  fs.appendFileSync(storePath(root, "pending.jsonl"), "garbage line\n");
  const opts = { root: root, now: at(T0 + 1000) };
  assert.strictEqual(store.markPendingUsed(store.findPending(first.token, "sess-1", opts), opts), true);
  assert.ok(store.findPending(second.token, "sess-1", opts), "the second token is still usable");
  assert.ok(lines(storePath(root, "pending.jsonl")).indexOf("garbage line") !== -1, "the unparseable line stays");
  assert.strictEqual(lines(storePath(root, "pending.jsonl")).length, 3);
});

test("[FR-242 | 2.29 | Expired or reused token rejected] markPendingUsed for a record that is not in the store marks nothing", () => {
  const root = tempRoot();
  pending(root);
  const ghost = { pr: "42", verdict: "approve", token: "ZZZZZZ", session_id: "sess-1", created_at: new Date(T0).toISOString() };
  assert.strictEqual(store.markPendingUsed(ghost, { root: root, now: at(T0 + 1000) }), false);
});

// ---------------------------------------------------------------------------
// recordConfirmation / readConfirmations / findConfirmation
// ---------------------------------------------------------------------------

test("[FR-242 | 2.29 | User confirmation recorded] recordConfirmation writes one JSONL record with the writer hook and a timestamp", () => {
  const root = tempRoot();
  store.recordConfirmation({ pr: 42, verdict: "approve", userMessageRef: "sess-1:1700000000123" }, { root: root, now: at(T0) });
  const stored = lines(storePath(root, "confirmations.jsonl"));
  assert.strictEqual(stored.length, 1);
  const rec = JSON.parse(stored[0]);
  assert.strictEqual(String(rec.pr), "42");
  assert.strictEqual(rec.verdict, "approve");
  assert.strictEqual(rec.writer, "hook");
  assert.ok(rec.timestamp !== undefined && rec.timestamp !== null, "a timestamp");
  assert.strictEqual(rec.user_message_ref, "sess-1:1700000000123");
  assert.ok(!fs.existsSync(storePath(root, "pending.jsonl")), "recordConfirmation does not touch pending.jsonl");
});

test("[FR-242 | NFR-031 | 2.29 | User confirmation recorded] a confirmation record holds no token and no message text", () => {
  const root = tempRoot();
  const rec = pending(root);
  store.recordConfirmation({ pr: 42, verdict: "approve", userMessageRef: "sess-1:1700000000123" }, { root: root, now: at(T0 + 1000) });
  const raw = fs.readFileSync(storePath(root, "confirmations.jsonl"), "utf8");
  assert.ok(raw.indexOf(rec.token) === -1, "the token is not in the confirmation file");
  const parsed = JSON.parse(lines(storePath(root, "confirmations.jsonl"))[0]);
  Object.keys(parsed).forEach((key) => {
    assert.ok(!/token|prompt|message$|text|body|content/i.test(key.replace(/user_message_ref/, "")), "unexpected field: " + key);
  });
});

test("[FR-242 | NFR-031 | 2.29 | Forged confirmation rejected] a message reference that holds text (spaces, a sentence, a long string) is refused and writes nothing", () => {
  const root = tempRoot();
  [
    "yes, approve PR 42 please",
    "line one\nline two",
    "x".repeat(5000),
    "",
  ].forEach((ref) => {
    assert.throws(
      () => store.recordConfirmation({ pr: 42, verdict: "approve", userMessageRef: ref }, { root: root, now: at(T0) }),
      (err) => err instanceof Error
    );
  });
  assert.deepStrictEqual(lines(storePath(root, "confirmations.jsonl")), []);
});

test("[FR-242 | 2.29 | Forged confirmation rejected] a confirmation for an invalid PR or a verdict with shell characters is refused", () => {
  const root = tempRoot();
  [
    { pr: "", verdict: "approve" },
    { pr: null, verdict: "approve" },
    { pr: { n: 42 }, verdict: "approve" },
    { pr: 42, verdict: "" },
    { pr: 42, verdict: "approve; rm -rf /" },
    { pr: 42, verdict: "APPROVE\n{\"writer\":\"hook\"}" },
  ].forEach((fields) => {
    assert.throws(() => store.recordConfirmation(Object.assign({ userMessageRef: "sess-1:1" }, fields), { root: root, now: at(T0) }));
  });
  assert.deepStrictEqual(lines(storePath(root, "confirmations.jsonl")), []);
});

test("[FR-214 | 2.1 | Confirmation for a different verdict does not carry over] findConfirmation matches the exact PR and verdict only", () => {
  const root = tempRoot();
  store.recordConfirmation({ pr: 42, verdict: "approve", userMessageRef: "sess-1:1" }, { root: root, now: at(T0) });
  assert.ok(store.findConfirmation(42, "approve", { root: root }), "same PR and verdict");
  assert.ok(store.findConfirmation("42", "approve", { root: root }), "the PR as text");
  assert.ok(!store.findConfirmation(42, "request-changes", { root: root }), "different verdict");
  assert.ok(!store.findConfirmation(43, "approve", { root: root }), "different PR");
  assert.ok(!store.findConfirmation(4, "approve", { root: root }), "prefix of the PR number");
  assert.ok(!store.findConfirmation(42, "approv", { root: root }), "prefix of the verdict");
});

test("[FR-242 | 2.29 | Pending record is not a confirmation] readConfirmations reads confirmations.jsonl and never pending.jsonl", () => {
  const root = tempRoot();
  pending(root);
  assert.deepStrictEqual(store.readConfirmations({ root: root }), []);
  assert.ok(!store.findConfirmation(42, "approve", { root: root }));
});

test("[FR-242 | 2.29 | Pending record is not a confirmation] readConfirmations returns the recorded confirmations in order", () => {
  const root = tempRoot();
  store.recordConfirmation({ pr: 1, verdict: "approve", userMessageRef: "s:1" }, { root: root, now: at(T0) });
  store.recordConfirmation({ pr: 2, verdict: "decline", userMessageRef: "s:2" }, { root: root, now: at(T0 + 1000) });
  const all = store.readConfirmations({ root: root });
  assert.strictEqual(all.length, 2);
  assert.deepStrictEqual(all.map((r) => String(r.pr)), ["1", "2"]);
});

test("[FR-214 | 2.1 | NFR-028 | Fail-closed on error] reads never throw: a missing root, a missing store, a directory in place of the file, and garbage all give no confirmation", () => {
  const missing = path.join(os.tmpdir(), "confirmation-store-does-not-exist-" + process.pid);
  assert.deepStrictEqual(store.readConfirmations({ root: missing }), []);
  assert.ok(!store.findConfirmation(42, "approve", { root: missing }));

  const asDir = tempRoot();
  fs.mkdirSync(storePath(asDir, "confirmations.jsonl"), { recursive: true });
  assert.deepStrictEqual(store.readConfirmations({ root: asDir }), []);
  assert.ok(!store.findConfirmation(42, "approve", { root: asDir }));

  const garbage = tempRoot();
  fs.mkdirSync(path.dirname(storePath(garbage, "confirmations.jsonl")), { recursive: true });
  fs.writeFileSync(storePath(garbage, "confirmations.jsonl"), "\u0000\u0001 not json\n{\"pr\":\n");
  assert.deepStrictEqual(store.readConfirmations({ root: garbage }), []);
  assert.ok(!store.findConfirmation(42, "approve", { root: garbage }));
});

test("[NFR-031 | Secret value kept out of the log] a log callback never receives a token, a PR, or a message reference", () => {
  const root = tempRoot();
  const entries = [];
  const log = (entry) => entries.push(entry);
  const rec = pending(root, { options: { log: log } });
  fs.appendFileSync(storePath(root, "pending.jsonl"), "garbage\n");
  const opts = { root: root, now: at(T0 + 1000), log: log };
  const found = store.findPending(rec.token, "sess-1", opts);
  store.markPendingUsed(found, opts);
  store.recordConfirmation({ pr: 4242, verdict: "approve", userMessageRef: "sess-1:ref-9" }, opts);
  store.readConfirmations(opts);
  const logged = JSON.stringify(entries);
  assert.ok(logged.indexOf(rec.token) === -1, "token in log: " + logged);
  assert.ok(logged.indexOf("4242") === -1, "PR in log: " + logged);
  assert.ok(logged.indexOf("ref-9") === -1, "reference in log: " + logged);
});

test("[NFR-031 | Secret value kept out of the log] a throwing log callback never breaks the store", () => {
  const root = tempRoot();
  const log = () => {
    throw new Error("logger fault");
  };
  fs.mkdirSync(path.dirname(storePath(root, "confirmations.jsonl")), { recursive: true });
  fs.writeFileSync(storePath(root, "confirmations.jsonl"), "garbage\n");
  assert.doesNotThrow(() => store.readConfirmations({ root: root, log: log }));
  assert.doesNotThrow(() => store.findPending("ABCDEF", "s", { root: root, log: log, now: at(T0) }));
});
