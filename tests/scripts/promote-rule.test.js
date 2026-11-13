// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the promotion gate of harness-governance Tranche 4
// (plugins/assist-plugin/scripts/promote-rule.js), task plan Step 37.
//
// Sources: specs/spec-hooks-code-scan.md (Requirement: Promotion gate, scenarios Policy missing refuses the switch, No
// baseline refuses the switch, Low precision refuses the switch; Change Log 2026-11-13 (Tranche 4 as-built reconciliation),
// MODIFIED Requirement: Promotion gate, scenarios Unreadable store refuses the switch and Exactly 90% passes; Requirement:
// Promotion is a user-run operation and this release enables no blocking), docs/requirements/FR-NFR-harness-governance.md
// (FR-237, FR-238, NFR-034), and the usage header of the script (the command line and the exit codes). The spec carries no
// SPEC-NNN id, so it is cited by file name.
//
// Traceability format: [AC-N | spec-hooks-code-scan.md Requirement | FR/NFR ids]. AC-N is the position of the Scenario
// inside its Requirement; the Scenarios the Change Log adds to the Promotion gate follow the three original ones, so
// "Unreadable store" is AC-4 and "Exactly 90%" is AC-5.
//
// Contract used (documented behavior; the script body is never read):
//   node scripts/promote-rule.js <rule-id> [--root DIR]
//   Refusal order: store-unreadable (an existing rule-mode store that is not a JSON object), missing-policy (no DECISIONS.md
//   entry whose heading matches ^## [0-9]{4}-[0-9]{2}-[0-9]{2}: Severity policy approved$ and whose body names
//   rules/severity-policy.md and the policy file's current version), missing-baseline (no finding for the rule, a window
//   still open, or no user label), precision (user-label precision under 90%, the value printed). The window is complete at
//   14 days AND 20 distinct review ids. The 90% bar is an integer comparison, so exactly 90% passes.
//   Exit 0 the rule is blocking; exit 1 refused, reason printed; exit 2 cannot run. A refusal writes nothing.
//   On success .agent/governance/rule-modes.json maps the rule id to "blocking".
//
// Every project root is a temp directory with a .git directory and fixture files only; no real baseline and no real
// DECISIONS.md is read. The policy version comes from the "Policy version" line of rules/severity-policy.md, the file the
// script compares against.
//
// Run: node --test tests/scripts/promote-rule.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const SCRIPT = path.join(fx.PLUGIN, "scripts", "promote-rule.js");
const SPEC = "spec-hooks-code-scan.md";
const GATE = SPEC + " Requirement: Promotion gate";
const RELEASE = SPEC + " Requirement: Promotion is a user-run operation and this release enables no blocking";
const RULE = "sql-from-input";
const DAY = 24 * 60 * 60 * 1000;

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// The version the script compares with: the "Policy version" line of the policy file.
function currentVersion() {
  const text = fs.readFileSync(path.join(fx.PLUGIN, "rules", "severity-policy.md"), "utf8");
  const m = /^\*\*Policy version:\*\*\s*(\S+)/m.exec(text);
  assert.ok(m, "rules/severity-policy.md has no Policy version line");
  return m[1];
}

const VERSION = currentVersion();
const STALE = "draft-1";

function approval(date, version) {
  return "## " + date + ": Severity policy approved\n\nThe user approves plugins/assist-plugin/rules/severity-policy.md at policy version " + version + ".\n";
}

function decisions() {
  return "# Decisions\n\n" + Array.prototype.slice.call(arguments).join("\n");
}

function writeFile(root, relative, text) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
}

function isoDaysAgo(days) {
  return new Date(Date.now() - days * DAY).toISOString();
}

// Findings of one rule. options: {count, reviews (distinct review ids; 0 means no review_id), ageDays (age of the first
// finding), trueCount, falseCount (labelled), stringTrue (findings whose label is the string "true"), rule}.
function findings(options) {
  const o = Object.assign({ count: 20, reviews: 20, ageDays: 30, trueCount: 0, falseCount: 0, stringTrue: 0, rule: RULE }, options || {});
  const out = [];
  for (let i = 0; i < o.count; i += 1) {
    const days = o.count === 1 ? o.ageDays : o.ageDays - ((o.ageDays - 1) * i) / (o.count - 1);
    const record = {
      id: "f-" + o.rule + "-" + i,
      rule_id: o.rule,
      severity: "HIGH",
      confidence: "High",
      file: "src/db.js",
      line: i + 1,
      timestamp: isoDaysAgo(Math.max(days, 0.01)),
    };
    if (o.reviews > 0) record.review_id = "rev-" + (i % o.reviews);
    if (i < o.trueCount) record.label = true;
    else if (i < o.trueCount + o.falseCount) record.label = false;
    else if (i < o.trueCount + o.falseCount + o.stringTrue) record.label = "true";
    out.push(record);
  }
  return out;
}

function writeFindings(root, records, extraLines) {
  const lines = records.map((r) => JSON.stringify(r)).concat(extraLines || []);
  return writeFile(root, ".agent/governance/review-findings.jsonl", lines.join("\n") + "\n");
}

function storePath(root) {
  return path.join(root, ".agent", "governance", "rule-modes.json");
}

// A root with an approved policy for the current version and a complete baseline at the given precision mix.
function readyRoot(options) {
  const root = fx.tempRoot("promote-");
  writeFile(root, "DECISIONS.md", decisions(approval("2026-10-31", VERSION)));
  writeFindings(root, findings(options || { trueCount: 20 }));
  return root;
}

function run(root, ruleId, extraArgs) {
  const args = [SCRIPT];
  if (ruleId !== null) args.push(ruleId);
  if (root !== null) args.push("--root", root);
  const result = childProcess.spawnSync(process.execPath, args.concat(extraArgs || []), {
    cwd: fx.tempDir("promote-cwd-"),
    env: fx.cleanEnv(),
    encoding: "utf8",
    timeout: 60000,
  });
  assert.strictEqual(result.error, undefined, "spawn error: " + (result.error && result.error.message));
  result.out = (result.stdout || "") + (result.stderr || "");
  return result;
}

function storeText(root) {
  return fs.existsSync(storePath(root)) ? fs.readFileSync(storePath(root), "utf8") : null;
}

function assertRefused(res, reason, root) {
  assert.strictEqual(res.status, 1, "exit 1 (refused); output: " + res.out);
  assert.ok(new RegExp(reason).test(res.out), "the refusal names " + reason + "; output: " + res.out);
  if (root) assert.strictEqual(storeText(root), null, "a refusal writes no store");
}

function assertPromoted(res, root, ruleId) {
  assert.strictEqual(res.status, 0, "exit 0 (blocking); output: " + res.out);
  const store = JSON.parse(storeText(root));
  assert.strictEqual(store[ruleId || RULE], "blocking");
  return store;
}

test("the policy file names a version, and the stale version used below differs from it", () => {
  // Precondition of the draft-1 fixtures: the policy file is no longer at the version the older approval named.
  assert.ok(/^\S+$/.test(VERSION));
  assert.notStrictEqual(VERSION, STALE, "the stale-approval fixtures need a current version other than " + STALE);
});

// ---------------------------------------------------------------------------
// missing-policy
// ---------------------------------------------------------------------------

test("[AC-1 | " + GATE + " | FR-237 | NFR-034] a DECISIONS.md with no approval entry refuses with missing-policy and writes no store", () => {
  const root = fx.tempRoot("promote-");
  writeFile(root, "DECISIONS.md", decisions("## 2026-10-30: Something else\n\nNo approval here.\n"));
  writeFindings(root, findings({ trueCount: 20 }));
  assertRefused(run(root, RULE), "missing-policy", root);
});

test("[AC-1 | " + GATE + " | FR-237] an absent DECISIONS.md refuses with missing-policy", () => {
  const root = fx.tempRoot("promote-");
  writeFindings(root, findings({ trueCount: 20 }));
  assertRefused(run(root, RULE), "missing-policy", root);
});

test("[AC-1 | " + GATE + " | FR-237] a fixture DECISIONS.md holding only a draft-1 approval is refused as missing-policy while the policy file is at the current version", () => {
  // The old approval no longer covers the policy once its version has been raised.
  const root = fx.tempRoot("promote-");
  writeFile(root, "DECISIONS.md", decisions(approval("2026-10-30", STALE)));
  writeFindings(root, findings({ trueCount: 20 }));
  assertRefused(run(root, RULE), "missing-policy", root);
});

test("[AC-1 | " + GATE + " | FR-237] an approval whose heading does not match the exact pattern is not an approval", () => {
  // Boundary and injection-shaped variants of the heading line.
  const body = "\n\nThe user approves plugins/assist-plugin/rules/severity-policy.md at policy version " + VERSION + ".\n";
  const headings = [
    "## 2026-10-31: Severity policy approved (draft)",
    "### 2026-10-31: Severity policy approved",
    "# 2026-10-31: Severity policy approved",
    "## 2026-10-31 Severity policy approved",
    "## 2026-1-31: Severity policy approved",
    "## 20261031: Severity policy approved",
    "## 2026-10-31: severity policy approved",
    "## 2026-10-31: Severity policy approval",
    "## Severity policy approved",
  ];
  headings.forEach((heading) => {
    const root = fx.tempRoot("promote-");
    writeFile(root, "DECISIONS.md", decisions(heading + body));
    writeFindings(root, findings({ trueCount: 20 }));
    assertRefused(run(root, RULE), "missing-policy", root);
  });
});

test("[AC-1 | " + GATE + " | FR-237] a version named under a different heading does not approve the policy", () => {
  const root = fx.tempRoot("promote-");
  writeFile(root, "DECISIONS.md", decisions("## 2026-10-31: Severity policy reviewed\n\nplugins/assist-plugin/rules/severity-policy.md " + VERSION + "\n"));
  writeFindings(root, findings({ trueCount: 20 }));
  assertRefused(run(root, RULE), "missing-policy", root);
});

test("[AC-1 | " + GATE + " | FR-237] a current-version approval passes the policy check even when an older draft-1 approval sits above it", () => {
  const root = fx.tempRoot("promote-");
  writeFile(root, "DECISIONS.md", decisions(approval("2026-10-30", STALE), approval("2026-10-31", VERSION)));
  writeFindings(root, findings({ trueCount: 20 }));
  assertPromoted(run(root, RULE), root);
});

// ---------------------------------------------------------------------------
// missing-baseline
// ---------------------------------------------------------------------------

test("[AC-2 | " + GATE + " | FR-238 | NFR-034] no findings store at all refuses with missing-baseline", () => {
  const root = fx.tempRoot("promote-");
  writeFile(root, "DECISIONS.md", decisions(approval("2026-10-31", VERSION)));
  assertRefused(run(root, RULE), "missing-baseline", root);
});

test("[AC-2 | " + GATE + " | FR-238] findings that belong to another rule leave this rule with no baseline", () => {
  const root = fx.tempRoot("promote-");
  writeFile(root, "DECISIONS.md", decisions(approval("2026-10-31", VERSION)));
  writeFindings(root, findings({ trueCount: 20, rule: "some-other-rule" }));
  assertRefused(run(root, RULE), "missing-baseline", root);
});

test("[AC-2 | " + SPEC + " Change Log 2026-11-13 MODIFIED Requirement: Promotion gate | FR-238 | NFR-034] a window with 19 distinct review ids is still open, even after 30 days", () => {
  // Boundary: one review short of 20.
  const root = readyRoot({ count: 19, reviews: 19, ageDays: 30, trueCount: 19 });
  assertRefused(run(root, RULE), "missing-baseline", root);
});

test("[AC-2 | " + SPEC + " Change Log 2026-11-13 MODIFIED Requirement: Promotion gate | FR-238 | NFR-034] a window of 20 review ids is still open until 14 days have passed since the first finding", () => {
  // The window ends at the later of the two moments: 20 reviews is not enough on day 5.
  const root = readyRoot({ count: 20, reviews: 20, ageDays: 5, trueCount: 20 });
  assertRefused(run(root, RULE), "missing-baseline", root);
});

test("[AC-2 | " + SPEC + " Change Log 2026-11-13 MODIFIED Requirement: Promotion gate | FR-238] many findings from one review id do not make 20 reviews", () => {
  const root = readyRoot({ count: 25, reviews: 1, ageDays: 30, trueCount: 25 });
  assertRefused(run(root, RULE), "missing-baseline", root);
});

test("[AC-2 | " + SPEC + " Change Log 2026-11-13 MODIFIED Requirement: Promotion gate | FR-238] findings with no review id count toward the days only, so 20 of them leave the window open", () => {
  const root = readyRoot({ count: 20, reviews: 0, ageDays: 30, trueCount: 20 });
  assertRefused(run(root, RULE), "missing-baseline", root);
});

test("[AC-2 | " + SPEC + " Change Log 2026-11-13 MODIFIED Requirement: Promotion gate | FR-238 | NFR-034] a complete window with no user label is no baseline", () => {
  const root = readyRoot({ count: 20, reviews: 20, ageDays: 30 });
  assertRefused(run(root, RULE), "missing-baseline", root);
});

test("[AC-2 | " + GATE + " | FR-238] a window at exactly 14 days and 20 review ids is complete (boundary)", () => {
  const root = readyRoot({ count: 20, reviews: 20, ageDays: 15, trueCount: 20 });
  assertPromoted(run(root, RULE), root);
});

// ---------------------------------------------------------------------------
// precision
// ---------------------------------------------------------------------------

test("[AC-3 | " + GATE + " | FR-238 | NFR-034] a baseline precision of 70% refuses and prints the precision value", () => {
  const root = readyRoot({ trueCount: 14, falseCount: 6 });
  const res = run(root, RULE);
  assertRefused(res, "precision", root);
  assert.ok(/70/.test(res.out), "the refusal prints the value 70; output: " + res.out);
});

test("[AC-3 | " + SPEC + " Change Log 2026-11-13 MODIFIED Requirement: Promotion gate | NFR-034] a precision just under 90% (8 true, 1 false) refuses", () => {
  // Boundary: 88.9%. The bar is an integer comparison, so no rounding carries it over.
  const root = readyRoot({ trueCount: 8, falseCount: 1 });
  assertRefused(run(root, RULE), "precision", root);
});

test("[AC-3 | " + GATE + " | NFR-034] a precision of 0% (every label false) refuses", () => {
  const root = readyRoot({ trueCount: 0, falseCount: 20 });
  assertRefused(run(root, RULE), "precision", root);
});

test("[AC-3 | " + SPEC + " Change Log 2026-11-13 MODIFIED Requirement: Promotion gate | NFR-034] a label that is the string true is no label: 8 true and 1 false plus 20 string-true records still refuses", () => {
  // Type-mismatch: counted as labels, the 20 string values would lift precision to 28 of 29.
  const root = readyRoot({ count: 29, reviews: 29, trueCount: 8, falseCount: 1, stringTrue: 20 });
  assertRefused(run(root, RULE), "precision", root);
});

// ---------------------------------------------------------------------------
// success, including the exact-90% boundary
// ---------------------------------------------------------------------------

test("[AC-5 | " + SPEC + " Change Log 2026-11-13 MODIFIED Requirement: Promotion gate | FR-238 | NFR-034] exactly 90% (18 true, 2 false) passes and the store marks the rule blocking", () => {
  const root = readyRoot({ trueCount: 18, falseCount: 2 });
  const res = run(root, RULE);
  assertPromoted(res, root);
});

test("[AC-5 | " + SPEC + " Change Log 2026-11-13 MODIFIED Requirement: Promotion gate | NFR-034] exactly 90% passes when only 10 of 20 findings are labelled (9 true, 1 false, 10 unlabelled)", () => {
  // An unlabelled finding is not counted, so the 10 unlabelled findings change nothing.
  const root = readyRoot({ trueCount: 9, falseCount: 1 });
  assertPromoted(run(root, RULE), root);
});

test("[AC-3 | " + RELEASE + " | FR-238] promotes at or above 90% with a current-version approval: 100% passes", () => {
  const root = readyRoot({ trueCount: 20 });
  assertPromoted(run(root, RULE), root);
});

test("[AC-3 | " + RELEASE + " | FR-238] a promotion keeps the other rules of an existing store and leaves no temporary file beside it", () => {
  const root = readyRoot({ trueCount: 20 });
  writeFile(root, ".agent/governance/rule-modes.json", JSON.stringify({ "other-rule": "advisory", "third-rule": "blocking" }));
  assertPromoted(run(root, RULE), root);
  const store = JSON.parse(storeText(root));
  assert.strictEqual(store["other-rule"], "advisory");
  assert.strictEqual(store["third-rule"], "blocking");
  assert.deepStrictEqual(fs.readdirSync(path.join(root, ".agent", "governance")).sort(), ["review-findings.jsonl", "rule-modes.json"]);
});

test("[AC-3 | " + RELEASE + " | FR-238] a rule that is already blocking exits 0 and stays blocking", () => {
  const root = readyRoot({ trueCount: 20 });
  writeFile(root, ".agent/governance/rule-modes.json", JSON.stringify({ [RULE]: "blocking" }));
  assertPromoted(run(root, RULE), root);
});

test("[AC-3 | " + RELEASE + " | FR-238] a refusal leaves an existing store byte for byte as it was", () => {
  const root = readyRoot({ trueCount: 14, falseCount: 6 });
  const original = JSON.stringify({ "other-rule": "advisory" });
  writeFile(root, ".agent/governance/rule-modes.json", original);
  assert.strictEqual(run(root, RULE).status, 1);
  assert.strictEqual(storeText(root), original);
});

// ---------------------------------------------------------------------------
// store-unreadable (ahead of the other three refusals)
// ---------------------------------------------------------------------------

test("[AC-4 | " + SPEC + " Change Log 2026-11-13 MODIFIED Requirement: Promotion gate | FR-238 | FR-245] a store that is not a JSON object refuses with store-unreadable and is left unchanged", () => {
  // Approved policy and a complete baseline above 90%: only the store can refuse.
  ["{not json", "[1,2]", "42", "{"].forEach((content) => {
    const root = readyRoot({ trueCount: 20 });
    writeFile(root, ".agent/governance/rule-modes.json", content);
    const res = run(root, RULE);
    assert.strictEqual(res.status, 1, "exit 1 for store " + JSON.stringify(content) + "; output: " + res.out);
    assert.ok(/store-unreadable/.test(res.out), "names store-unreadable; output: " + res.out);
    assert.strictEqual(storeText(root), content, "the unreadable store is not overwritten");
  });
});

test("[AC-4 | " + SPEC + " Change Log 2026-11-13 MODIFIED Requirement: Promotion gate | FR-238] store-unreadable is checked ahead of missing-policy, missing-baseline, and precision", () => {
  const root = fx.tempRoot("promote-");
  writeFile(root, ".agent/governance/rule-modes.json", "{not json");
  const res = run(root, RULE);
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(/store-unreadable/.test(res.out), res.out);
  assert.ok(!/missing-policy|missing-baseline/.test(res.out), "no later reason is named first; output: " + res.out);
});

// ---------------------------------------------------------------------------
// exit 2: the script cannot run
// ---------------------------------------------------------------------------

test("[AC-1 | " + RELEASE + " | FR-238] no rule id exits 2 and writes no store", () => {
  const root = readyRoot({ trueCount: 20 });
  const res = run(root, null);
  assert.strictEqual(res.status, 2, res.out);
  assert.strictEqual(storeText(root), null);
});

test("[AC-1 | " + RELEASE + " | FR-238] a project root that does not exist exits 2", () => {
  const res = run(path.join(fx.tempDir("promote-missing-"), "no-such-root"), RULE);
  assert.strictEqual(res.status, 2, res.out);
});

test("[AC-1 | " + RELEASE + " | FR-238 | NFR-027] a rule id shaped like a path or a command never promotes anything", () => {
  // Security-adjacent: the id is a key of the store, not a path or a command.
  ["../../x", "a b", "x;rm -rf /", "x$(id)", "'; DROP TABLE t;--"].forEach((bad) => {
    const root = readyRoot({ trueCount: 20 });
    const res = run(root, bad);
    assert.notStrictEqual(res.status, 0, "id " + bad + " must not promote; output: " + res.out);
    assert.strictEqual(storeText(root), null, "id " + bad + " writes no store");
  });
});
