// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the audit chain verification command (harness-governance Tranche 2, Step 14):
// plugins/assist-plugin/scripts/verify-audit-chain.js, and the `--verify-audit` mode of
// plugins/assist-plugin/hooks/health-check.js that calls the same module.
//
// Sources: specs/spec-hooks-audit.md (Requirement: Chain verification: AC-1 Intact chain, AC-2 Edited line, AC-3
// Tamper detection), specs/spec-hooks-health-check.md (Change Log 2026-11-06, Requirement: Verify the governance audit
// chain: Intact chain, Broken chain), specs/spec-skills-health.md (Change Log 2026-11-06), and
// docs/requirements/FR-NFR-harness-governance.md v1.3 (FR-225, FR-224, NFR-030, NFR-031, NFR-032). Task plan:
// docs/task-plans/task-plan-harness-governance-20261028-0759.md, Steps 14 and 20.
//
// Traceability format: [AC-N | spec file | FR/NFR ids | UR/BR ids]. The spec has no SPEC-NNN id, so it is cited by
// file name.
//
// Contract used (script header):
//   node scripts/verify-audit-chain.js [root]
//   `root` is the project root that holds .agent/. Without it the script uses CLAUDE_PROJECT_DIR, else the working
//   directory, then its git root.
//   Exit 0: the chain is intact; a missing or empty log verifies as zero lines. Prints the verified line count.
//   Exit 1: the chain is broken. Prints the first broken line with its segment and its line in the segment.
//   Exit 2: cannot verify (the project root is unknown or a segment is unreadable). Prints on stderr.
//   Output holds counts, line numbers, a segment name, and a fixed reason; never a record value (NFR-031).
//   Known limit (NFR-030): the chain runs backward, so the final line and lines removed from the end are not detectable
//   without a head anchor; the output says so when the chain is intact.
//   A partial last line (a crash) is reported with a non-alarming message; any other break says the log was changed.
//   Module exports: EXIT_INTACT, EXIT_BROKEN, EXIT_CANNOT_VERIFY, describe(result), check(root), report(outcome).
//
// The logs are generated into temp directories (tests/fixtures/audit/). The 100,000-line log is generated at test time
// and never committed. Time limits are the spec's estimate targets.
//
// Run: node --test tests/scripts/verify-audit-chain.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const SCRIPT = path.join(fx.PLUGIN, "scripts", "verify-audit-chain.js");
const verifier = require(SCRIPT);

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cli(root, options) {
  const opts = options || {};
  return childProcess.spawnSync(process.execPath, [SCRIPT].concat(root === undefined ? [] : [root]), {
    cwd: opts.cwd || fx.tempDir("verify-cwd-"),
    env: fx.cleanEnv(opts.env),
    encoding: "utf8",
    timeout: opts.timeout || 60000,
  });
}

// A project root that holds a generated chain with the given segment sizes.
function chainRoot(segmentCounts) {
  const root = fx.tempRoot("verify-chain-");
  fx.writeChain(root, segmentCounts);
  return root;
}

function breakLine(res) {
  const match = /at line (\d+)/.exec(res.stdout);
  assert.ok(match, "the output names a broken line: " + res.stdout);
  return Number(match[1]);
}

const HEX64 = /[0-9a-f]{64}/;

// ---------------------------------------------------------------------------
// Exit 0: intact
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-audit | FR-225 | NFR-030 | UR-065] an unmodified log of 500 lines exits 0 and reports 500 lines verified", () => {
  const root = chainRoot([500]);
  const res = cli(root);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/\b500 lines\b/.test(res.stdout), res.stdout);
  assert.ok(/intact|verified/i.test(res.stdout), res.stdout);
  assert.strictEqual(res.stderr, "");
});

test("[AC-1 | spec-hooks-audit | FR-225 | NFR-032] an unmodified log of 500 lines across rotated segments exits 0 and reports 500 lines", () => {
  const root = chainRoot([200, 200, 100]);
  const res = cli(root);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/\b500 lines\b/.test(res.stdout), res.stdout);
  assert.ok(/\b3 segments\b/.test(res.stdout), res.stdout);
});

test("[AC-1 | spec-hooks-audit | FR-225 | NFR-032] a rotated pair of segments (the committed-fixture shape) verifies across the cut", () => {
  const root = fx.tempRoot("verify-pair-");
  fx.rotatedPair(root, 50);
  const res = cli(root);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/\b100 lines\b/.test(res.stdout), res.stdout);
});

test("[AC-1 | spec-hooks-audit | FR-225] a log of only the genesis line exits 0 with one line", () => {
  const root = chainRoot([1]);
  const res = cli(root);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/\b1 line\b/.test(res.stdout), res.stdout);
});

test("[AC-1 | spec-hooks-audit | FR-225] an empty log file exits 0 with zero lines", () => {
  // Null/empty boundary.
  const root = fx.tempRoot("verify-empty-");
  fx.plantLines(root, []);
  const res = cli(root);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/\b0 lines\b/.test(res.stdout), res.stdout);
});

test("[AC-1 | spec-hooks-audit | FR-225] a project with no log at all exits 0 with zero lines", () => {
  const root = fx.tempRoot("verify-none-");
  const res = cli(root);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/\b0 lines\b/.test(res.stdout), res.stdout);
});

test("[AC-1 | spec-hooks-audit | FR-225] a root directory that does not exist verifies as zero lines", () => {
  const res = cli(path.join(fx.tempDir("verify-missing-"), "does-not-exist"));
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/\b0 lines\b/.test(res.stdout), res.stdout);
});

test("[AC-1 | spec-hooks-audit | FR-225] with no argument the root is CLAUDE_PROJECT_DIR", () => {
  const root = chainRoot([30]);
  const res = cli(undefined, { env: { CLAUDE_PROJECT_DIR: root } });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/\b30 lines\b/.test(res.stdout), res.stdout);
});

test("[AC-1 | spec-hooks-audit | FR-225] a relative root argument is resolved against the working directory", () => {
  const parent = fx.tempDir("verify-parent-");
  const root = path.join(parent, "project");
  fs.mkdirSync(path.join(root, ".git"), { recursive: true });
  fx.writeChain(root, [12]);
  const res = cli("project", { cwd: parent });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/\b12 lines\b/.test(res.stdout), res.stdout);
});

test("[AC-1 | spec-hooks-audit | FR-225 | NFR-031] a root path with spaces and shell metacharacters is read as one path and runs nothing", () => {
  // Security-adjacent: the argument is never passed to a shell.
  const parent = fx.tempDir("verify-meta-");
  const root = path.join(parent, "my root; touch pwned; $(touch pwned2)");
  fs.mkdirSync(path.join(root, ".git"), { recursive: true });
  fx.writeChain(root, [9]);
  const res = cli(root, { cwd: parent });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/\b9 lines\b/.test(res.stdout), res.stdout);
  assert.ok(!fs.existsSync(path.join(parent, "pwned")) && !fs.existsSync(path.join(parent, "pwned2")));
});

test("[AC-1 | spec-hooks-audit | FR-225] verification only reads: the log bytes are unchanged after a run", () => {
  const root = chainRoot([40, 40]);
  const before = fx.rawLog(root);
  const res = cli(root);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.strictEqual(fx.rawLog(root), before);
  const names = fs.readdirSync(fx.logDir(root)).sort();
  assert.deepStrictEqual(names, ["audit-000001.jsonl", "audit.jsonl"], "no lock or scratch file is left behind");
});

// ---------------------------------------------------------------------------
// Exit 1: broken, naming the first broken line
// ---------------------------------------------------------------------------

test("[AC-2 | spec-hooks-audit | FR-225 | NFR-030 | UR-065] line 7 edited after writing: exit 1 and the output names line 7 as the first break", () => {
  const root = chainRoot([500]);
  fx.editLine(fx.currentLog(root), 7);
  const res = cli(root);
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  assert.strictEqual(breakLine(res), 7);
  assert.ok(/BROKEN/i.test(res.stdout), res.stdout);
});

test("[AC-3 | spec-hooks-audit | FR-225 | NFR-030] a deleted line is detected: exit 1 and a line next to the deletion is named", () => {
  const root = chainRoot([500]);
  fx.deleteLine(fx.currentLog(root), 7);
  const res = cli(root);
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  const named = breakLine(res);
  assert.ok(named >= 6 && named <= 8, "named line " + named);
});

test("[AC-3 | spec-hooks-audit | FR-225 | NFR-030] a reordered line is detected: exit 1 and a line next to the swap is named", () => {
  const root = chainRoot([500]);
  fx.swapLines(fx.currentLog(root), 7, 8);
  const res = cli(root);
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  const named = breakLine(res);
  assert.ok(named >= 6 && named <= 8, "named line " + named);
});

test("[AC-3 | spec-hooks-audit | FR-225 | NFR-030] the three-variant corpus (edited, deleted, reordered) is detected on every variant", () => {
  const variants = {
    edited: (file) => fx.editLine(file, 7),
    deleted: (file) => fx.deleteLine(file, 7),
    reordered: (file) => fx.swapLines(file, 7, 8),
  };
  Object.keys(variants).forEach((name) => {
    const root = chainRoot([40]);
    variants[name](fx.currentLog(root));
    const res = cli(root);
    assert.strictEqual(res.status, 1, name + " went undetected: " + res.stdout + res.stderr);
  });
});

test("[AC-3 | spec-hooks-audit | FR-225 | NFR-030] an edit to every line but the last is found by the command, one line at a time (30-line corpus)", () => {
  for (let i = 1; i <= 29; i += 1) {
    const root = chainRoot([30]);
    fx.editLine(fx.currentLog(root), i);
    const res = cli(root);
    assert.strictEqual(res.status, 1, "edit of line " + i + " went undetected");
    assert.strictEqual(breakLine(res), i, "edit of line " + i);
  }
});

test("[AC-2 | spec-hooks-audit | FR-225 | NFR-032] an edit inside a rotated segment names the line across all segments and the line in its segment", () => {
  const root = chainRoot([10, 10, 10]);
  const rotated = fx.segmentFiles(root).rotated;
  fx.editLine(rotated[1], 5);
  const res = cli(root);
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  assert.strictEqual(breakLine(res), 15, "numbered from 1 across all segments");
  assert.ok(/audit-000002\.jsonl/.test(res.stdout), "the segment is named: " + res.stdout);
  assert.ok(/line 5 of that segment/.test(res.stdout), res.stdout);
});

test("[AC-3 | spec-hooks-audit | FR-225 | NFR-032] a missing middle segment breaks the chain at the cut: exit 1", () => {
  const root = chainRoot([10, 10, 10]);
  fs.unlinkSync(fx.segmentFiles(root).rotated[1]);
  const res = cli(root);
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  breakLine(res);
});

test("[AC-3 | spec-hooks-audit | FR-225 | NFR-032] a changed last line of a rotated segment breaks the chain at that line: the final hash is carried across the cut", () => {
  const root = chainRoot([10, 10]);
  const rotated = fx.segmentFiles(root).rotated;
  fx.editLine(rotated[0], 10);
  const res = cli(root);
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  assert.strictEqual(breakLine(res), 10);
});

test("[AC-3 | spec-hooks-audit | FR-225] a first line without the genesis value is reported at line 1", () => {
  const root = chainRoot([5]);
  const lineTexts = fx.readLines(fx.currentLog(root));
  const first = JSON.parse(lineTexts[0]);
  first.prev = "f".repeat(64);
  lineTexts[0] = JSON.stringify(first);
  fx.plantLines(root, lineTexts);
  const res = cli(root);
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  assert.strictEqual(breakLine(res), 1);
});

test("[AC-3 | spec-hooks-audit | FR-225] a line that is not a JSON record is reported next to that line", () => {
  const root = chainRoot([8]);
  const lineTexts = fx.readLines(fx.currentLog(root));
  lineTexts[4] = "this is not json";
  fx.plantLines(root, lineTexts);
  const res = cli(root);
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  const named = breakLine(res);
  assert.ok(named >= 4 && named <= 5, "named line " + named);
});

// ---------------------------------------------------------------------------
// The two messages: a partial last line versus a changed log
// ---------------------------------------------------------------------------

test("[AC-2 | spec-hooks-audit | FR-225] a partial last line exits 1 with the non-alarming message: a crash can leave it, and it is not necessarily tampering", () => {
  const root = chainRoot([10]);
  fx.appendPartial(fx.currentLog(root));
  const res = cli(root);
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  assert.strictEqual(breakLine(res), 11, "reported at the incomplete line itself");
  assert.ok(/incomplete/i.test(res.stdout), res.stdout);
  assert.ok(/not necessarily tampering/i.test(res.stdout), res.stdout);
  assert.ok(!/Do not edit it/i.test(res.stdout), "no tamper wording for a partial line: " + res.stdout);
});

test("[AC-2 | spec-hooks-audit | FR-225] an edited line exits 1 with the tamper message: the log was changed after it was written", () => {
  const root = chainRoot([10]);
  fx.editLine(fx.currentLog(root), 4);
  const res = cli(root);
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  assert.ok(/changed after it was written/i.test(res.stdout), res.stdout);
  assert.ok(/report the break/i.test(res.stdout), res.stdout);
  assert.ok(!/not necessarily tampering/i.test(res.stdout), "no crash wording for a tamper: " + res.stdout);
});

// ---------------------------------------------------------------------------
// Exit 2: cannot verify
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-audit | FR-225] an unreadable current segment exits 2, with the problem on stderr and nothing on stdout", () => {
  // Invalid environment: the current segment path is a directory.
  const root = fx.tempRoot("verify-unreadable-");
  fs.mkdirSync(fx.currentLog(root), { recursive: true });
  const res = cli(root);
  assert.strictEqual(res.status, 2, res.stdout + res.stderr);
  assert.strictEqual(res.stdout, "");
  assert.ok(/cannot verify/i.test(res.stderr), res.stderr);
});

test("[AC-1 | spec-hooks-audit | FR-225 | NFR-032] an unreadable rotated segment exits 2 and never claims the chain is intact", () => {
  const root = chainRoot([10, 10]);
  const rotated = fx.segmentFiles(root).rotated[0];
  fs.rmSync(rotated);
  fs.mkdirSync(rotated);
  const res = cli(root);
  assert.strictEqual(res.status, 2, res.stdout + res.stderr);
  assert.ok(!/intact/i.test(res.stdout + res.stderr), res.stdout + res.stderr);
});

test("[AC-1 | spec-hooks-audit | FR-225] a segment with no read permission exits 2 (skipped when the user can read anything)", (t) => {
  if (process.platform === "win32" || (typeof process.getuid === "function" && process.getuid() === 0)) {
    t.skip("file permissions do not stop this user (root or Windows)");
    return;
  }
  const root = chainRoot([10]);
  const file = fx.currentLog(root);
  fs.chmodSync(file, 0o000);
  try {
    const res = cli(root);
    assert.strictEqual(res.status, 2, res.stdout + res.stderr);
  } finally {
    fs.chmodSync(file, 0o644);
  }
});

// ---------------------------------------------------------------------------
// Output holds no record content (NFR-031)
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-audit | NFR-031 | FR-225] the output of an intact run prints counts only: no record value, no hash, no timestamp", () => {
  const root = chainRoot([20, 20]);
  const res = cli(root);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  const all = res.stdout + res.stderr;
  assert.ok(all.indexOf(fx.MARKER) === -1, "a record value reached the output: " + all);
  assert.ok(!HEX64.test(all), "a hash reached the output: " + all);
  assert.ok(all.indexOf("2026-01-01T") === -1, "a record timestamp reached the output: " + all);
  assert.ok(all.indexOf("fixture-event") === -1, "an event name reached the output: " + all);
});

test("[AC-2 | spec-hooks-audit | NFR-031 | FR-225] the output of a broken run prints line numbers, a segment name, and a fixed reason only: no record value, no hash", () => {
  const root = chainRoot([20, 20]);
  fx.editLine(fx.segmentFiles(root).rotated[0], 6);
  const res = cli(root);
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  const all = res.stdout + res.stderr;
  assert.ok(all.indexOf(fx.MARKER) === -1, "a record value reached the output: " + all);
  assert.ok(!HEX64.test(all), "a hash reached the output: " + all);
  assert.ok(all.indexOf("yes") === -1 || !/edited/i.test(all), "the edited value reached the output: " + all);
  assert.ok(all.indexOf("fixture-event") === -1, "an event name reached the output: " + all);
});

// ---------------------------------------------------------------------------
// Documented limit (NFR-030): the final line and removed trailing lines
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-audit | NFR-030] an intact run states the limit: the final line and lines removed from the end are not confirmed", () => {
  const root = chainRoot([25]);
  const res = cli(root);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/final line/i.test(res.stdout), res.stdout);
  assert.ok(/removed from the end|head anchor/i.test(res.stdout), res.stdout);
});

test("[AC-2 | spec-hooks-audit | NFR-030] documented limit: an edit of the final line is not detected (exit 0); the limit is stated, not a defect", () => {
  const root = chainRoot([25]);
  fx.editLine(fx.currentLog(root), 25);
  const res = cli(root);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/\b25 lines\b/.test(res.stdout), res.stdout);
});

test("[AC-3 | spec-hooks-audit | NFR-030] documented limit: lines removed from the end leave a shorter chain that still verifies (exit 0)", () => {
  const root = chainRoot([25]);
  fx.dropTail(fx.currentLog(root), 5);
  const res = cli(root);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/\b20 lines\b/.test(res.stdout), res.stdout);
});

// ---------------------------------------------------------------------------
// Time target (estimate)
// ---------------------------------------------------------------------------

test("[Requirement: Chain verification | spec-hooks-audit | NFR-030 | FR-225] a generated 100,000-line log over 4 segments verifies in at most 10 seconds, command start included (estimate target)", () => {
  const root = fx.tempRoot("verify-large-");
  const built = fx.generateLargeChain(root, 100000, 4);
  assert.strictEqual(built.total, 100000);
  const started = Date.now();
  const res = cli(root, { timeout: 120000 });
  const seconds = (Date.now() - started) / 1000;
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/\b100000 lines\b/.test(res.stdout), res.stdout);
  assert.ok(seconds <= 10, "verification took " + seconds + " s against the 10 s target (an estimate until measured)");
});

test("[Requirement: Chain verification | spec-hooks-audit | NFR-030 | FR-225] a generated 100,000-line log with an edit near the start is still detected within the time target (estimate)", () => {
  const root = fx.tempRoot("verify-large-");
  fx.generateLargeChain(root, 100000, 4);
  fx.editLine(fx.segmentFiles(root).rotated[0], 7);
  const started = Date.now();
  const res = cli(root, { timeout: 120000 });
  const seconds = (Date.now() - started) / 1000;
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  assert.strictEqual(breakLine(res), 7);
  assert.ok(seconds <= 10, "took " + seconds + " s against the 10 s target (an estimate until measured)");
});

// ---------------------------------------------------------------------------
// Module interface: describe, check, report
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-audit | FR-225] the exit codes are 0 intact, 1 broken, 2 cannot verify", () => {
  assert.strictEqual(verifier.EXIT_INTACT, 0);
  assert.strictEqual(verifier.EXIT_BROKEN, 1);
  assert.strictEqual(verifier.EXIT_CANNOT_VERIFY, 2);
});

test("[AC-1 | spec-hooks-audit | FR-225] check(root) returns the code and the lines the command prints", () => {
  const root = chainRoot([15]);
  const outcome = verifier.check(root);
  assert.strictEqual(outcome.code, 0);
  assert.ok(Array.isArray(outcome.lines));
  assert.ok(/\b15 lines\b/.test(outcome.lines.join("\n")));
  fx.editLine(fx.currentLog(root), 3);
  assert.strictEqual(verifier.check(root).code, 1);
});

test("[AC-1 | spec-hooks-audit | FR-225] check never throws: a bad root is a cannot-verify or a zero-line verdict, not an exception", () => {
  [undefined, null, 42, {}, ""].forEach((value) => {
    let outcome;
    assert.doesNotThrow(() => {
      outcome = verifier.check(value);
    }, "check(" + JSON.stringify(value) + ")");
    assert.ok([0, 1, 2].indexOf(outcome.code) !== -1);
  });
});

test("[AC-1 | spec-hooks-audit | FR-225] describe maps a verifier result with an error, or no result, to exit 2", () => {
  assert.strictEqual(verifier.describe({ ok: false, error: { code: "EISDIR", message: "x" } }).code, 2);
  assert.strictEqual(verifier.describe(null).code, 2);
  assert.strictEqual(verifier.describe(undefined).code, 2);
  assert.strictEqual(verifier.describe("text").code, 2);
});

test("[AC-1 | spec-hooks-audit | FR-225] describe flags unidentified records and keeps the exit code", () => {
  // The flag is inert until the per-agent identity of Tranche 3 lands; the command passes it through.
  const intact = verifier.describe({ ok: true, lines: 3, segments: 1, unidentified: 2 });
  assert.strictEqual(intact.code, 0);
  assert.ok(/unidentified/i.test(intact.lines.join("\n")), intact.lines.join("\n"));
  const none = verifier.describe({ ok: true, lines: 3, segments: 1 });
  assert.ok(!/unidentified/i.test(none.lines.join("\n")), "no flag without a flagged record");
});

// ---------------------------------------------------------------------------
// The /assist-plugin:health --verify-audit mode calls the same module
// ---------------------------------------------------------------------------

function healthVerify(root) {
  return fx.runHook("health-check", undefined, {
    args: ["--data-dir", fx.tempDir("verify-data-"), "--verify-audit"],
    cwd: root,
    env: { CLAUDE_PROJECT_DIR: root },
  });
}

test("[AC-1 | spec-hooks-audit | FR-225 | NFR-030] health-check --verify-audit on an unmodified log of 500 lines exits 0 and prints the verified count", () => {
  const root = chainRoot([300, 200]);
  const res = healthVerify(root);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/\b500\b/.test(res.stdout), res.stdout);
});

test("[AC-2 | spec-hooks-audit | FR-225 | NFR-030] health-check --verify-audit with line 7 edited exits non-zero and names line 7 as the first break", () => {
  const root = chainRoot([500]);
  fx.editLine(fx.currentLog(root), 7);
  const res = healthVerify(root);
  assert.notStrictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/\b7\b/.test(res.stdout + res.stderr), res.stdout + res.stderr);
});
