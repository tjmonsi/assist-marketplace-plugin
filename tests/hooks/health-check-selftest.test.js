// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box contract tests for the self-test corpora and wrappers of the health check,
// release 1.13.1 (plugins/assist-plugin/hooks/impl/health-check.js).
//
// Sources: specs/spec-hooks-health-check.md (Change Log 2026-10-23: Requirement: Self-tests, the
// case table, Rules, and the scenarios Docs/tts self-test cases after the skip is removed, Stale
// docs/tts allow case, Advisor case in docs/tts uses an advisory tell, and Fenced em dash in
// docs/tts), specs/spec-hooks-prose-hooks.md (Change Log 2026-10-23: Requirement: Self-test
// isolation for the project root, scenarios Real project variable during SessionStart and Case
// without the project-root keys), specs/spec-hooks-fsa-write-bar.md (Requirement: Task-planner write
// scope in docs/task-plans/, self-test table and Scenario: Self-test case without a git-root stub),
// and docs/requirements/FR-NFR-assist-plugin.md (FR-118, FR-091, FR-104, FR-213, FR-186; FR-181 is
// retired history and no assertion depends on it). Upstream ids: UR-018, UR-058.
//
// Traceability format: [Scenario title | spec section | FR ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// Public interface used (module exports of impl/health-check.js):
//   GUARDS            array of { name, evaluate(input), allow[], deny[], filter? }
//   PROSE_GATE_ALLOW, PROSE_GATE_DENY, PROSE_ADVISOR_CLEAN, PROSE_ADVISOR_FLAGGED,
//   FSA_WRITE_ALLOW, FSA_WRITE_DENY   arrays of self-test inputs
//   selfTest(guard)   returns { ok, falseDeny[], falseAllow[], errors[], allowCount, denyCount }
//                     ("errors" are the cases listed under "case threw")
//   main()            the entry point behind the HEALTH command and --session-start
// and the HEALTH command (node plugins/assist-plugin/hooks/health-check.js), whose report is
// public output. The command runs with CLAUDE_PLUGIN_DATA unset, so it writes nothing. The
// session-start tests give it a fresh data folder, a fresh working directory, and a fresh
// CLAUDE_CONFIG_DIR, so nothing of the user's changes the result and nothing outside the temp
// folders is written.
//
// Run: node --test tests/hooks/health-check-selftest.test.js

"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const hc = require(path.join(PLUGIN, "hooks", "impl", "health-check.js"));

const TTS_ROOT = "/assist-selftest/project";
const FSA_ROOT = "/assist-selftest/project";
const PLANNER = "assist-plugin:task-planner";
const EM = String.fromCharCode(0x2014); // U+2014, built from an escape so this file holds none

// ---------------------------------------------------------------------------
// Environment isolation and scratch space
// ---------------------------------------------------------------------------

const savedEnv = {};
const scratch = [];

function tempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

before(() => {
  ["CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA", "CLAUDE_PLUGIN_ROOT"].forEach((k) => {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  });
});

after(() => {
  Object.keys(savedEnv).forEach((k) => {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  });
  scratch.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function guard(name) {
  const g = hc.GUARDS.find((x) => x.name === name);
  assert.ok(g, "GUARDS has no entry named " + name);
  return g;
}

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function labelOf(c, i) {
  return c && c.label ? c.label : "#" + i;
}

function targetOf(c) {
  const ti = c && c.tool_input;
  return ti ? ti.file_path || ti.notebook_path : undefined;
}

function slashes(s) {
  return String(s).replace(/\\/g, "/");
}

function copyWithout(c, key) {
  const copy = Object.assign({}, c);
  delete copy[key];
  return copy;
}

function onlyCases(g, allow, deny) {
  return Object.assign({}, g, { allow: allow, deny: deny });
}

function isPlanner(c) {
  return c && c.agent_type === PLANNER;
}

function withLabel(corpus, label) {
  return corpus.filter((c) => c && c.label === label);
}

function isDeny(decision) {
  return !!(decision && decision.deny === true);
}

const PROSE_CORPORA = [
  ["PROSE_GATE_ALLOW", hc.PROSE_GATE_ALLOW],
  ["PROSE_GATE_DENY", hc.PROSE_GATE_DENY],
  ["PROSE_ADVISOR_CLEAN", hc.PROSE_ADVISOR_CLEAN],
  ["PROSE_ADVISOR_FLAGGED", hc.PROSE_ADVISOR_FLAGGED],
];

// ---------------------------------------------------------------------------
// The prose cases carry no project-root keys
// ---------------------------------------------------------------------------

PROSE_CORPORA.forEach((pair) => {
  const name = pair[0], corpus = pair[1];

  test(name + " is an exported, non-empty array", () => {
    // [Scenario: Case without the project-root keys (corpus is exported) | spec-hooks-health-check.md Change Log 2026-10-23, Requirement: Self-tests | FR-118 | FR-091]
    assert.ok(Array.isArray(corpus), name + " must be exported as an array");
    assert.ok(corpus.length > 0);
  });

  test(name + ": no case carries a projectDir key or a findGitRoot key", () => {
    // [Scenario: Case without the project-root keys | spec-hooks-health-check.md Change Log 2026-10-23, Requirement: Self-tests (Isolation paragraph: the prose cases carry no projectDir or findGitRoot key) | FR-118 | FR-091 | FR-104]
    corpus.forEach((c, i) => {
      const who = name + " case " + labelOf(c, i);
      assert.ok(!has(c, "projectDir"), who + " still carries a projectDir key");
      assert.ok(!has(c, "findGitRoot"), who + " still carries a findGitRoot key");
    });
  });
});

// ---------------------------------------------------------------------------
// Corpus sizes and the case table of the Self-tests requirement
// ---------------------------------------------------------------------------

test("prose corpora sizes follow the 1.13.1 plan: prose-gate 24 allow and 38 deny, prose-advisor 10 clean and 12 flagged", () => {
  // 24 = 32 - 10 + 2; 38 = 31 - 2 + 9; 10 = 11 - 2 + 1; 12 = 10 + 2.
  // [Requirement: Self-tests, counts after the change | spec-hooks-health-check.md Change Log 2026-10-23 | FR-118 | FR-104 | FR-213]
  assert.strictEqual(hc.PROSE_GATE_ALLOW.length, 24);
  assert.strictEqual(hc.PROSE_GATE_DENY.length, 38);
  assert.strictEqual(hc.PROSE_ADVISOR_CLEAN.length, 10);
  assert.strictEqual(hc.PROSE_ADVISOR_FLAGGED.length, 12);
});

test("selfTest reports the same sizes as the corpora", () => {
  // [Requirement: Self-tests, counts after the change | spec-hooks-health-check.md Change Log 2026-10-23 | FR-118]
  const gate = hc.selfTest(guard("prose-gate"));
  assert.strictEqual(gate.allowCount, 24);
  assert.strictEqual(gate.denyCount, 38);
  const adv = hc.selfTest(guard("prose-advisor"));
  assert.strictEqual(adv.allowCount, 10);
  assert.strictEqual(adv.denyCount, 12);
});

// [case number, corpus, label after the change]. Cases 1 to 9 and 16 to 18 sit in PROSE_GATE_DENY, 13 and 14
// in PROSE_GATE_ALLOW, 11, 12, 21, and 22 in PROSE_ADVISOR_FLAGGED, and 15 in PROSE_ADVISOR_CLEAN.
const CASE_TABLE = [
  [1, "PROSE_GATE_DENY", "tts: em dash in docs/tts (relative path)"],
  [2, "PROSE_GATE_DENY", "tts: em dash in docs/tts (absolute path)"],
  [3, "PROSE_GATE_DENY", "tts: em dash in a docs/tts subdirectory"],
  [4, "PROSE_GATE_DENY", "tts: dot segments that stay inside docs/tts"],
  [5, "PROSE_GATE_DENY", "tts: notebook markdown cell in docs/tts"],
  [6, "PROSE_GATE_DENY", "tts: session in a subdirectory, docs/tts at the root"],
  [7, "PROSE_GATE_DENY", "tts: session in a subdirectory, relative path above the cwd"],
  [8, "PROSE_GATE_DENY", "tts: session in a subdirectory, docs/tts in the session directory"],
  [9, "PROSE_GATE_DENY", "tts: worktree session, docs/tts in the worktree"],
  [11, "PROSE_ADVISOR_FLAGGED", "tts: advisory tells in docs/tts"],
  [12, "PROSE_ADVISOR_FLAGGED", "tts: session in a subdirectory, docs/tts in the session directory"],
  [13, "PROSE_GATE_ALLOW", "tts: docs/tts without a tell"],
  [14, "PROSE_GATE_ALLOW", "tts: em dash only inside a fenced script block"],
  [15, "PROSE_ADVISOR_CLEAN", "tts: docs/tts without a tell"],
  [16, "PROSE_GATE_DENY", "tts: session at the root, docs/tts below a subdirectory"],
  [17, "PROSE_GATE_DENY", "tts: session in another directory, its docs/tts"],
  [18, "PROSE_GATE_DENY", "tts: session in a subdirectory, other docs path"],
  [21, "PROSE_ADVISOR_FLAGGED", "tts: session at the root, docs/tts below a subdirectory"],
  [22, "PROSE_ADVISOR_FLAGGED", "tts: session in another directory, its docs/tts"],
];

// The opposite side of each case: a moved case must leave its old corpus.
const OTHER_SIDE = {
  PROSE_GATE_DENY: "PROSE_GATE_ALLOW",
  PROSE_GATE_ALLOW: "PROSE_GATE_DENY",
  PROSE_ADVISOR_FLAGGED: "PROSE_ADVISOR_CLEAN",
  PROSE_ADVISOR_CLEAN: "PROSE_ADVISOR_FLAGGED",
};

CASE_TABLE.forEach((row) => {
  const n = row[0], corpusName = row[1], label = row[2];
  test("table case " + n + " sits in " + corpusName + " with the label '" + label + "' and not on the other side", () => {
    // [Scenario: Docs/tts self-test cases after the skip is removed | spec-hooks-health-check.md Change Log 2026-10-23, Requirement: Self-tests, case table | FR-118 | FR-091 | FR-104 | FR-213]
    assert.strictEqual(withLabel(hc[corpusName], label).length, 1, "expected exactly one case labeled '" + label + "' in " + corpusName);
    assert.strictEqual(withLabel(hc[OTHER_SIDE[corpusName]], label).length, 0, "'" + label + "' must not stay in " + OTHER_SIDE[corpusName]);
  });
});

test("the kept 'tts: no cwd, relative path' deny case survives with its label", () => {
  // The tts: deny cases of the 1.13.0 corpus keep their labels and their expected result, deny.
  // [Requirement: Self-tests, Rules | spec-hooks-health-check.md Change Log 2026-10-23 | FR-118 | FR-104]
  assert.strictEqual(withLabel(hc.PROSE_GATE_DENY, "tts: no cwd, relative path").length, 1);
  assert.strictEqual(withLabel(hc.PROSE_GATE_ALLOW, "tts: no cwd, relative path").length, 0);
});

// Labels at 1.13.0 of the dropped cases (10, 19, 20) and of the relabeled ones. None may remain anywhere.
const DROPPED_LABELS = [
  [10, "tts: no project variable, git root above the session directory"],
  [19, "tts: project variable, no cwd, relative path"],
  [20, "tts: relative project variable, no cwd, relative path"],
];
const OLD_LABELS = [
  [6, "tts: project variable, session in a subdirectory (project root)"],
  [7, "tts: project variable, session in a subdirectory (relative path above the cwd)"],
  [8, "tts: project variable, session in a subdirectory (session directory)"],
  [9, "tts: project variable, worktree session (session directory)"],
  [16, "tts: project variable, session in a subdirectory, session directory has no docs/tts"],
  [17, "tts: project variable, session in another project"],
  [18, "tts: project variable, other docs path"],
  [21, "tts: project variable, session at the root, docs/tts below a subdirectory"],
];

function allLabels() {
  const out = [];
  PROSE_CORPORA.forEach((pair) => pair[1].forEach((c) => out.push(c && c.label)));
  return out;
}

DROPPED_LABELS.forEach((row) => {
  test("dropped case " + row[0] + " ('" + row[1] + "') is in no corpus", () => {
    // [Scenario: Docs/tts self-test cases after the skip is removed (cases 10, 19, 20 duplicate another case) | spec-hooks-health-check.md Change Log 2026-10-23, Requirement: Self-tests, Rules | FR-118 | FR-091]
    assert.ok(allLabels().indexOf(row[1]) === -1, "case " + row[0] + " should be dropped");
  });
});

OLD_LABELS.forEach((row) => {
  test("relabeled case " + row[0] + " no longer carries its 1.13.0 label", () => {
    // [Requirement: Self-tests, case table (label after the change) | spec-hooks-health-check.md Change Log 2026-10-23 | FR-118]
    assert.ok(allLabels().indexOf(row[1]) === -1, "the old label '" + row[1] + "' is still in a corpus");
  });
});

test("no prose label names a project variable or a git root, and no tts label says a path is exempt or skipped", () => {
  // [Requirement: Self-tests, Rules (no label names a project variable or a git root, or says a docs/tts/ path is exempt) | spec-hooks-health-check.md Change Log 2026-10-23 | FR-118 | FR-104 | FR-213]
  PROSE_CORPORA.forEach((pair) => {
    pair[1].forEach((c, i) => {
      const label = String(labelOf(c, i));
      assert.ok(!/project variable|git root/i.test(label), pair[0] + " label names a project variable or a git root: " + label);
      if (/^tts:/.test(label)) assert.ok(!/exempt|skip/i.test(label), pair[0] + " label says a docs/tts path is exempt: " + label);
    });
  });
});

test("case 13: target docs/tts/a.md, session directory TTS_ROOT, content 'Pause here, then go on.'", () => {
  // [Scenario: Docs/tts self-test cases after the skip is removed (case 13 content) | spec-hooks-health-check.md Change Log 2026-10-23, Requirement: Self-tests, case table | FR-118 | FR-213]
  const c = withLabel(hc.PROSE_GATE_ALLOW, "tts: docs/tts without a tell")[0];
  assert.strictEqual(targetOf(c), "docs/tts/a.md");
  assert.strictEqual(c.cwd, TTS_ROOT);
  assert.strictEqual(c.tool_input.content, "Pause here, then go on.\n");
});

test("case 14: a ## Script heading and a fenced text block that holds the only em dash", () => {
  // [Scenario: Fenced em dash in docs/tts (case 14 content) | spec-hooks-health-check.md Change Log 2026-10-23, Requirement: Self-tests, case table | FR-118 | FR-105 | FR-213]
  const c = withLabel(hc.PROSE_GATE_ALLOW, "tts: em dash only inside a fenced script block")[0];
  assert.strictEqual(targetOf(c), "docs/tts/a.md");
  assert.strictEqual(c.cwd, TTS_ROOT);
  const lines = c.tool_input.content.split("\n");
  assert.ok(lines.indexOf("## Script") !== -1, "case 14 has a ## Script heading");
  let inFence = false;
  let emInsideFence = 0;
  let emOutsideFence = 0;
  lines.forEach((line) => {
    if (/^```/.test(line)) {
      inFence = !inFence;
      return;
    }
    const count = line.split(EM).length - 1;
    if (inFence) emInsideFence += count;
    else emOutsideFence += count;
  });
  assert.strictEqual(emOutsideFence, 0, "no em dash outside the fence");
  assert.ok(emInsideFence >= 1, "an em dash inside the fenced block");
  assert.ok(/Pause here/.test(c.tool_input.content) && /then go on\./.test(c.tool_input.content));
});

test("case 15: a PostToolUse Write of case 13's target, session directory, and content (tool_response.type create)", () => {
  // [Scenario: Docs/tts self-test cases after the skip is removed (case 15 content) | spec-hooks-health-check.md Change Log 2026-10-23, Requirement: Self-tests, case table | FR-118 | FR-213]
  const c = withLabel(hc.PROSE_ADVISOR_CLEAN, "tts: docs/tts without a tell")[0];
  assert.strictEqual(targetOf(c), "docs/tts/a.md");
  assert.strictEqual(c.cwd, TTS_ROOT);
  assert.strictEqual(c.tool_input.content, "Pause here, then go on.\n");
  assert.ok(c.tool_response && c.tool_response.type === "create", "tool_response.type is create");
});

// ---------------------------------------------------------------------------
// Scenarios: each docs/tts case gives its expected result
// ---------------------------------------------------------------------------

test("Docs/tts self-test cases after the skip is removed: both prose guards pass every case with no error and no wrong verdict", () => {
  // [Scenario: Docs/tts self-test cases after the skip is removed | spec-hooks-health-check.md Change Log 2026-10-23, Requirement: Self-tests | FR-118 | FR-091 | FR-104 | FR-213]
  ["prose-gate", "prose-advisor"].forEach((name) => {
    const r = hc.selfTest(guard(name));
    assert.deepStrictEqual(r.errors, [], name + ": cases threw");
    assert.deepStrictEqual(r.falseDeny, [], name + ": false denies");
    assert.deepStrictEqual(r.falseAllow, [], name + ": false allows");
    assert.strictEqual(r.ok, true, name + " must pass its self-test");
  });
});

CASE_TABLE.forEach((row) => {
  const n = row[0], corpusName = row[1], label = row[2];
  test("table case " + n + " alone gives its expected result through selfTest", () => {
    // [Scenario: Docs/tts self-test cases after the skip is removed (per case) | spec-hooks-health-check.md Change Log 2026-10-23, Requirement: Self-tests | FR-118 | FR-091]
    const gateGuard = guard("prose-gate");
    const advisorGuard = guard("prose-advisor");
    const c = withLabel(hc[corpusName], label)[0];
    const isAdvisor = corpusName.indexOf("ADVISOR") !== -1;
    const isAllowSide = corpusName === "PROSE_GATE_ALLOW" || corpusName === "PROSE_ADVISOR_CLEAN";
    const g = isAdvisor ? advisorGuard : gateGuard;
    const result = hc.selfTest(onlyCases(g, isAllowSide ? [c] : [], isAllowSide ? [] : [c]));
    assert.deepStrictEqual(result.errors, [], "case " + n + " threw");
    assert.deepStrictEqual(result.falseDeny, [], "case " + n + " is a false deny");
    assert.deepStrictEqual(result.falseAllow, [], "case " + n + " is a false allow");
    assert.strictEqual(result.ok, true);
  });
});

test("Advisor case in docs/tts uses an advisory tell: case 11 makes the advisor return output and the case is correct", () => {
  // [Scenario: Advisor case in docs/tts uses an advisory tell | spec-hooks-health-check.md Change Log 2026-10-23, Requirement: Self-tests | FR-118 | FR-213]
  const c = withLabel(hc.PROSE_ADVISOR_FLAGGED, "tts: advisory tells in docs/tts")[0];
  const flagged = hc.selfTest(onlyCases(guard("prose-advisor"), [], [c]));
  assert.strictEqual(flagged.ok, true);
  assert.deepStrictEqual(flagged.falseAllow, [], "the advisor must return output for case 11");
  // Control: the same case listed as clean is a wrong verdict, which proves the advisor does return output.
  const wrong = hc.selfTest(onlyCases(guard("prose-advisor"), [c], []));
  assert.strictEqual(wrong.ok, false);
  assert.strictEqual(wrong.falseDeny.length, 1);
});

test("Fenced em dash in docs/tts: case 14 is allowed by prose-gate and the case is correct", () => {
  // [Scenario: Fenced em dash in docs/tts | spec-hooks-health-check.md Change Log 2026-10-23, Requirement: Self-tests | FR-118 | FR-105 | FR-213]
  const c = withLabel(hc.PROSE_GATE_ALLOW, "tts: em dash only inside a fenced script block")[0];
  assert.ok(!isDeny(guard("prose-gate").evaluate(c)), "prose-gate must allow case 14");
  const result = hc.selfTest(onlyCases(guard("prose-gate"), [c], []));
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.falseDeny, []);
});

test("the docs/tts em-dash writes are in the deny corpus and each one is denied", () => {
  // [Scenario: Docs/tts self-test cases after the skip is removed (deny side) | spec-hooks-health-check.md Change Log 2026-10-23, Requirement: Self-tests, Rules | FR-118 | FR-104 | FR-213]
  const g = guard("prose-gate");
  const tts = hc.PROSE_GATE_DENY.filter((c) => /docs[\\/]tts[\\/]/.test(String(targetOf(c))));
  // Cases 1 to 9, 16, and 17 target a docs/tts path.
  assert.ok(tts.length >= 11, "expected at least 11 docs/tts deny cases, found " + tts.length);
  tts.forEach((c, i) => assert.ok(isDeny(g.evaluate(c)), "docs/tts deny case allowed: " + labelOf(c, i)));
});

// ---------------------------------------------------------------------------
// Scenario: Case without the project-root keys
// ---------------------------------------------------------------------------

[
  ["prose-gate", hc.PROSE_GATE_ALLOW, hc.PROSE_GATE_DENY],
  ["prose-advisor", hc.PROSE_ADVISOR_CLEAN, hc.PROSE_ADVISOR_FLAGGED],
].forEach((triple) => {
  const name = triple[0], allow = triple[1], deny = triple[2];

  test(name + ": a keyless case runs through the wrapper and gives its expected result (no throw)", () => {
    // [Scenario: Case without the project-root keys | spec-hooks-prose-hooks.md Change Log 2026-10-23, Requirement: Self-test isolation for the project root | FR-118 | FR-091]
    const keylessAllow = copyWithout(copyWithout(allow[0], "projectDir"), "findGitRoot");
    const keylessDeny = copyWithout(copyWithout(deny[0], "projectDir"), "findGitRoot");
    assert.doesNotThrow(() => guard(name).evaluate(keylessAllow));
    assert.doesNotThrow(() => guard(name).evaluate(keylessDeny));
    if (name === "prose-gate") {
      assert.ok(!isDeny(guard(name).evaluate(keylessAllow)), "the allow case is allowed");
      assert.ok(isDeny(guard(name).evaluate(keylessDeny)), "the deny case is denied");
    }
  });

  test(name + ": selfTest lists a keyless case under no 'case threw' and the hook passes", () => {
    // [Scenario: Case without the project-root keys (report) | spec-hooks-prose-hooks.md Change Log 2026-10-23, Requirement: Self-test isolation for the project root | FR-118 | FR-091]
    const keylessAllow = copyWithout(copyWithout(allow[0], "projectDir"), "findGitRoot");
    const keylessDeny = copyWithout(copyWithout(deny[0], "projectDir"), "findGitRoot");
    const result = hc.selfTest(onlyCases(guard(name), [keylessAllow], [keylessDeny]));
    assert.deepStrictEqual(result.errors, []);
    assert.deepStrictEqual(result.falseDeny, []);
    assert.deepStrictEqual(result.falseAllow, []);
    assert.strictEqual(result.ok, true);
  });

  test(name + ": a case that still carries stale project-root keys does not throw either", () => {
    // Type boundary: the wrapper no longer requires the keys, and a stale key of the wrong type is not an error.
    // [Scenario: Case without the project-root keys (stale keys have no effect) | spec-hooks-prose-hooks.md Change Log 2026-10-23, Requirement: Self-test isolation for the project root | FR-118 | FR-091]
    const stale = Object.assign({}, allow[0], { projectDir: 42, findGitRoot: "not a function" });
    assert.doesNotThrow(() => guard(name).evaluate(stale));
  });
});

// ---------------------------------------------------------------------------
// Scenario: Stale docs/tts allow case (FR-091 disables a guard that denies a known-safe case)
// ---------------------------------------------------------------------------

const STALE_LABEL = "tts: em dash in docs/tts (relative path)";

test("Stale docs/tts allow case: selfTest records one false deny for case 1 left in the allow corpus", () => {
  // [Scenario: Stale docs/tts allow case (unit half) | spec-hooks-health-check.md Change Log 2026-10-23, Requirement: Self-tests; Traceability FR-091 | FR-091 | FR-118 | FR-104]
  const stale = Object.assign({}, withLabel(hc.PROSE_GATE_DENY, STALE_LABEL)[0]);
  const result = hc.selfTest(onlyCases(guard("prose-gate"), [stale], []));
  assert.strictEqual(result.falseDeny.length, 1, "one falseDeny entry");
  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(result.errors, []);
  assert.deepStrictEqual(result.falseAllow, []);
});

// The wrapper requires the copy's health-check.js, pushes a copy of the relative-path docs/tts em-dash
// case into the allow array of the prose-gate entry (the case a build would leave behind if it removed the
// skip without moving the case), sets --session-start, and calls main(). It is written to a separate temp
// folder, never into the plugin copy.
const WRAPPER_SOURCE = [
  '"use strict";',
  "const hc = require(process.env.HC_PATH);",
  'const entry = hc.GUARDS.find((g) => g.name === "prose-gate");',
  'if (!entry) { console.error("no guard named prose-gate"); process.exit(3); }',
  "const stale = hc.PROSE_GATE_DENY.find((c) => c.label === process.env.STALE_LABEL);",
  'if (!stale) { console.error("no deny case labeled " + process.env.STALE_LABEL); process.exit(4); }',
  "entry.allow.push(Object.assign({}, stale));",
  'process.argv = [process.argv[0], process.argv[1], "--session-start"];',
  "hc.main();",
  "",
].join("\n");

function copyPlugin(into) {
  const dest = path.join(into, "assist-plugin");
  fs.cpSync(PLUGIN, dest, {
    recursive: true,
    filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src),
  });
  return dest;
}

function cleanEnv(extra) {
  const env = Object.assign({}, process.env);
  ["CLAUDE_PLUGIN_ROOT", "CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA"].forEach((k) => delete env[k]);
  return Object.assign(env, extra || {});
}

test("Stale docs/tts allow case: the session-start self-test adds prose-gate to hooks-disabled.json with the false-deny reason", () => {
  // [Scenario: Stale docs/tts allow case (hooks-disabled.json half) | spec-hooks-health-check.md Change Log 2026-10-23, Requirement: Self-tests; Traceability FR-091 | FR-091 | FR-118 | FR-104]
  const pluginCopy = copyPlugin(tempDir("hc-selftest-stale-copy-"));
  const wrapperDir = tempDir("hc-selftest-stale-wrapper-");
  fs.writeFileSync(path.join(wrapperDir, "stale-run.js"), WRAPPER_SOURCE);
  const dataDir = tempDir("hc-selftest-stale-data-");
  const res = childProcess.spawnSync(process.execPath, [path.join(wrapperDir, "stale-run.js")], {
    cwd: tempDir("hc-selftest-stale-cwd-"),
    env: cleanEnv({
      HC_PATH: path.join(pluginCopy, "hooks", "impl", "health-check.js"),
      STALE_LABEL: STALE_LABEL,
      CLAUDE_PLUGIN_DATA: dataDir,
      CLAUDE_CONFIG_DIR: tempDir("hc-selftest-stale-claude-"),
    }),
    encoding: "utf8",
    timeout: 60000,
  });
  assert.strictEqual(res.status, 0, "exit 0; stderr: " + res.stderr);
  const file = path.join(dataDir, "hooks-disabled.json");
  assert.ok(fs.existsSync(file), "hooks-disabled.json is written in the data folder");
  const disabled = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.deepStrictEqual(Object.keys(disabled), ["prose-gate"], "only prose-gate is added");
  assert.strictEqual(disabled["prose-gate"].reason, "self-test: known-safe write denied (1 case)");
  assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(disabled["prose-gate"].ts), "ts is an ISO time: " + disabled["prose-gate"].ts);
  assert.notStrictEqual(res.stdout.trim(), "", "a session-start notice was printed");
  const message = JSON.parse(res.stdout).systemMessage;
  assert.strictEqual(typeof message, "string");
  assert.ok(message.indexOf("prose-gate") !== -1, "the notice names prose-gate: " + message);
});

test("Docs/tts self-test cases after the skip is removed: a real session-start run adds neither prose hook to hooks-disabled.json", () => {
  // [Scenario: Docs/tts self-test cases after the skip is removed (session-start half) | spec-hooks-health-check.md Change Log 2026-10-23, Requirement: Self-tests | FR-091 | FR-118 | FR-104 | FR-213]
  const dataDir = tempDir("hc-selftest-session-data-");
  const res = childProcess.spawnSync(process.execPath, [path.join(PLUGIN, "hooks", "health-check.js"), "--session-start"], {
    cwd: tempDir("hc-selftest-session-cwd-"),
    env: cleanEnv({ CLAUDE_PLUGIN_DATA: dataDir, CLAUDE_CONFIG_DIR: tempDir("hc-selftest-session-claude-") }),
    encoding: "utf8",
    timeout: 60000,
  });
  assert.strictEqual(res.status, 0, "exit 0; stderr: " + res.stderr);
  assert.ok(res.stdout.indexOf("prose-gate") === -1, "the notice must not name prose-gate:\n" + res.stdout);
  assert.ok(res.stdout.indexOf("prose-advisor") === -1, "the notice must not name prose-advisor:\n" + res.stdout);
  const file = path.join(dataDir, "hooks-disabled.json");
  const disabled = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  assert.ok(!("prose-gate" in disabled), "prose-gate stays enabled");
  assert.ok(!("prose-advisor" in disabled), "prose-advisor stays enabled");
});

// ---------------------------------------------------------------------------
// FR-186: the write-bar wrapper requires a findGitRoot stub for task-planner cases (unchanged)
// ---------------------------------------------------------------------------

function case22() {
  // Table case 22: a task-planner case whose findGitRoot key is missing.
  return {
    tool_name: "Write",
    agent_type: PLANNER,
    cwd: FSA_ROOT,
    tool_input: { file_path: FSA_ROOT + "/docs/task-plans/task-plan-x.md", content: "x" },
  };
}

test("fsa-write-bar wrapper throws for a task-planner case without a function findGitRoot (table case 22)", () => {
  // [Scenario: Self-test case without a git-root stub | spec-hooks-fsa-write-bar.md "Task-planner write scope in docs/task-plans/" | FR-186 | FR-110]
  assert.throws(() => guard("fsa-write-bar").evaluate(case22()));
});

test("fsa-write-bar wrapper throws when findGitRoot is present but not a function", () => {
  // Type mismatch. [Scenario: Self-test case without a git-root stub | same requirement | FR-186]
  const bad = Object.assign(case22(), { findGitRoot: FSA_ROOT });
  assert.throws(() => guard("fsa-write-bar").evaluate(bad));
});

test("fsa-write-bar wrapper accepts a task-planner case that carries the stub", () => {
  // [Scenario: Self-test case without a git-root stub (counter-case) | same requirement | FR-186]
  const ok = Object.assign(case22(), { findGitRoot: () => FSA_ROOT });
  let decision;
  assert.doesNotThrow(() => {
    decision = guard("fsa-write-bar").evaluate(ok);
  });
  assert.ok(!(decision && decision.deny === true), "a plan in docs/task-plans of the root is allowed");
});

test("fsa-write-bar wrapper does not require the stub for other agents", () => {
  // Boundary: the rule is for task-planner cases only. [Requirement: Task-planner write scope in docs/task-plans/, :816 wrapper | FR-186]
  const dev = { tool_name: "Write", agent_type: "assist-plugin:developer", cwd: FSA_ROOT, tool_input: { file_path: FSA_ROOT + "/src/main.ts", content: "x" } };
  assert.doesNotThrow(() => guard("fsa-write-bar").evaluate(dev));
});

test("selfTest lists the stub-less task-planner case under 'case threw', fails the hook, and flags no false deny", () => {
  // The guard stays out of hooks-disabled.json because a thrown case is not a false deny.
  // [Scenario: Self-test case without a git-root stub | same requirement | FR-186 | FR-091]
  const result = hc.selfTest(onlyCases(guard("fsa-write-bar"), [case22()], []));
  assert.strictEqual(result.errors.length, 1);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.falseDeny.length, 0, "a thrown case must not count as a false deny");
  assert.strictEqual(result.falseAllow.length, 0);
});

test("case 22 never sits in FSA_WRITE_ALLOW or FSA_WRITE_DENY: every task-planner case carries a function findGitRoot", () => {
  // [Scenario: Self-test case without a git-root stub | same requirement | FR-186]
  [["FSA_WRITE_ALLOW", hc.FSA_WRITE_ALLOW], ["FSA_WRITE_DENY", hc.FSA_WRITE_DENY]].forEach((pair) => {
    pair[1].forEach((c, i) => {
      if (!isPlanner(c)) return;
      assert.strictEqual(typeof c.findGitRoot, "function", pair[0] + " task-planner case " + labelOf(c, i) + " lacks a findGitRoot function");
    });
  });
});

// The 21 listed cases: [#, expect, cwd (undefined = none), finder result, target]
const FSA_TABLE = [
  [1, "allow", FSA_ROOT, FSA_ROOT, FSA_ROOT + "/docs/task-plans/task-plan-auth-20261016-1000.md"],
  [2, "allow", FSA_ROOT, FSA_ROOT, "docs/task-plans/task-plan-x.md"],
  [3, "allow", FSA_ROOT + "/src", FSA_ROOT, FSA_ROOT + "/docs/task-plans/task-plan-x.md"],
  [4, "deny", FSA_ROOT + "/src", FSA_ROOT, FSA_ROOT + "/src/docs/task-plans/task-plan-x.md"],
  [5, "deny", FSA_ROOT + "/src", FSA_ROOT, "docs/task-plans/task-plan-x.md"],
  [6, "allow", FSA_ROOT + "/.claude/worktrees/w", FSA_ROOT + "/.claude/worktrees/w", FSA_ROOT + "/.claude/worktrees/w/docs/task-plans/task-plan-x.md"],
  [7, "deny", FSA_ROOT + "/.claude/worktrees/w", FSA_ROOT + "/.claude/worktrees/w", FSA_ROOT + "/docs/task-plans/task-plan-x.md"],
  [8, "allow", "/assist-selftest/nogit", null, "/assist-selftest/nogit/docs/task-plans/task-plan-x.md"],
  [9, "deny", FSA_ROOT, FSA_ROOT, FSA_ROOT + "/task-plan-x.md"],
  [10, "deny", FSA_ROOT, FSA_ROOT, FSA_ROOT + "/docs/task-plans/sub/task-plan-x.md"],
  [11, "deny", FSA_ROOT, FSA_ROOT, FSA_ROOT + "/docs/task-plans/plan-x.md"],
  [12, "deny", FSA_ROOT, FSA_ROOT, "/elsewhere/docs/task-plans/task-plan-x.md"],
  [13, "deny", FSA_ROOT, FSA_ROOT, FSA_ROOT + "/.claude/docs/task-plans/task-plan-x.md"],
  [14, "allow", "C:\\proj", "C:\\proj", "c:\\proj\\docs\\task-plans\\task-plan-x.md"],
  [15, "allow", "C:\\proj", "C:\\proj", "docs\\task-plans\\task-plan-x.md"],
  [16, "allow", undefined, undefined, "docs/task-plans/task-plan-x.md"],
  [17, "deny", undefined, undefined, "/elsewhere/docs/task-plans/task-plan-x.md"],
  [18, "deny", undefined, undefined, "../outside/docs/task-plans/task-plan-x.md"],
  [19, "deny", undefined, undefined, "~/docs/task-plans/task-plan-x.md"],
  [20, "deny", undefined, undefined, "C:docs/task-plans/task-plan-a.md"],
  [21, "deny", undefined, undefined, "x/docs/task-plans/task-plan-x.md"],
];

FSA_TABLE.forEach((row) => {
  const n = row[0], expect = row[1], cwd = row[2], finder = row[3], target = row[4];
  test("fsa-write-bar corpus holds table case " + n + " on the " + expect + " side (" + target + ")", () => {
    // [Requirement: Task-planner write scope in docs/task-plans/, self-test table | spec-hooks-fsa-write-bar.md | FR-186 | FR-110]
    const corpus = expect === "allow" ? hc.FSA_WRITE_ALLOW : hc.FSA_WRITE_DENY;
    const found = corpus.some((c) => {
      if (!isPlanner(c)) return false;
      if (slashes(targetOf(c)) !== slashes(target)) return false;
      if (cwd === undefined ? !!c.cwd : slashes(c.cwd) !== slashes(cwd)) return false;
      if (typeof c.findGitRoot !== "function") return false;
      if (cwd === undefined) return true; // never called without a usable cwd
      const answer = c.findGitRoot(c.cwd);
      return finder === null ? answer === null : slashes(answer) === slashes(finder);
    });
    assert.ok(found, "no task-planner case in the " + expect + " corpus matches table case " + n);
  });
});

test("existing task-planner deny cases survive: auto-loaded name, DECISIONS.md, plan file, NUL, over-long path", () => {
  // [Requirement: Task-planner write scope in docs/task-plans/, existing deny cases keep their result | FR-186 | FR-110 | FR-112 | FR-113]
  const denies = hc.FSA_WRITE_DENY.filter(isPlanner);
  const paths = denies.map((c) => String(targetOf(c)));
  const some = (pred) => paths.some(pred);
  assert.ok(some((p) => /(^|[\\/])CLAUDE\.md$/i.test(p)), "no task-planner deny case for CLAUDE.md");
  assert.ok(some((p) => /DECISIONS\.md/i.test(p)), "no task-planner deny case for DECISIONS.md");
  assert.ok(some((p) => /\.agent[\\/]main-plan/.test(p)), "no task-planner deny case for a /do plan file");
  assert.ok(some((p) => p.indexOf("\u0000") !== -1), "no task-planner deny case with a NUL character");
  assert.ok(some((p) => p.length > 4096), "no task-planner deny case over 4096 characters");
});

// ---------------------------------------------------------------------------
// Self-test run: no case threw, no false deny, no false allow
// ---------------------------------------------------------------------------

function assertAllGuardsPass() {
  hc.GUARDS.forEach((g) => {
    const r = hc.selfTest(g);
    assert.deepStrictEqual(r.errors, [], g.name + ": cases threw");
    assert.deepStrictEqual(r.falseDeny, [], g.name + ": false denies");
    assert.deepStrictEqual(r.falseAllow, [], g.name + ": false allows");
    assert.strictEqual(r.ok, true, g.name + " must pass its self-test");
  });
}

test("selfTest of every guard reports no 'case threw' and no wrong verdict (project variable unset)", () => {
  // [Scenario: Docs/tts self-test cases after the skip is removed; Requirement: Self-tests | spec-hooks-health-check.md Change Log 2026-10-23 | FR-118 | FR-091 | FR-186]
  delete process.env.CLAUDE_PROJECT_DIR;
  assertAllGuardsPass();
});

test("selfTest of every guard is unchanged under a real CLAUDE_PROJECT_DIR (HEALTH-PROJ)", () => {
  // [Scenario: Real project variable during SessionStart | spec-hooks-prose-hooks.md Change Log 2026-10-23, Requirement: Self-test isolation for the project root | FR-118 | FR-091]
  process.env.CLAUDE_PROJECT_DIR = "/home/u/app";
  try {
    assertAllGuardsPass();
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
  }
});

test("no prose-gate allow case holds an em dash outside a fence in a docs/tts target, under a real CLAUDE_PROJECT_DIR too", () => {
  // The allow corpus holds no docs/tts em-dash write; one left there would be a false deny that auto-disables prose-gate.
  // [Scenario: Stale docs/tts allow case (corpus end state) | spec-hooks-health-check.md Change Log 2026-10-23, Requirement: Self-tests, Rules | FR-118 | FR-091 | FR-104 | FR-213]
  process.env.CLAUDE_PROJECT_DIR = "/home/u/app";
  try {
    const g = guard("prose-gate");
    hc.PROSE_GATE_ALLOW.forEach((c, i) => {
      assert.ok(!isDeny(g.evaluate(c)), "allow case denied: " + labelOf(c, i));
    });
    const tts = hc.PROSE_GATE_ALLOW.filter((c) => /docs[\\/]tts[\\/]/.test(String(targetOf(c))));
    assert.ok(tts.length >= 2, "the allow corpus holds the docs/tts cases 13 and 14");
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
  }
});

// ---------------------------------------------------------------------------
// The HEALTH and HEALTH-PROJ commands (public report output)
// ---------------------------------------------------------------------------

function runHealth(projectDir) {
  const env = Object.assign({}, process.env);
  delete env.CLAUDE_PLUGIN_DATA;
  delete env.CLAUDE_PROJECT_DIR;
  if (projectDir) env.CLAUDE_PROJECT_DIR = projectDir;
  return childProcess.spawnSync(process.execPath, [path.join(PLUGIN, "hooks", "health-check.js")], {
    cwd: REPO,
    env: env,
    encoding: "utf8",
    timeout: 30000,
  });
}

function assertHealthyReport(res) {
  assert.strictEqual(res.status, 0, "health-check exits 0; stderr: " + res.stderr);
  const out = res.stdout;
  assert.ok(!/case threw/.test(out), "report lists a 'case threw' entry:\n" + out);
  assert.ok(!/: FAIL\b/.test(out), "report lists a failing hook:\n" + out);
  ["prose-gate", "prose-advisor", "fsa-write-bar"].forEach((name) => {
    assert.ok(new RegExp("^\\s+" + name + ": PASS \\(", "m").test(out), name + " must pass in the report:\n" + out);
  });
  assert.ok(/^ {2}prose-gate: PASS \(24 allow cases, 38 deny cases\)$/m.test(out), "prose-gate line with 24 and 38:\n" + out);
  assert.ok(/^ {2}prose-advisor: PASS \(10 clean samples, 12 advisory samples\)$/m.test(out), "prose-advisor line with 10 and 12:\n" + out);
}

test("HEALTH: the report lists every hook as passing with no 'case threw' and the 1.13.1 corpus sizes (project variable unset)", () => {
  // [Scenario: Docs/tts self-test cases after the skip is removed (HEALTH report) | spec-hooks-health-check.md Change Log 2026-10-23, Traceability added | FR-118 | FR-104 | FR-213 | FR-186]
  assertHealthyReport(runHealth(null));
});

test("HEALTH-PROJ: the same result under CLAUDE_PROJECT_DIR=/home/u/app", () => {
  // [Scenario: Real project variable during SessionStart | spec-hooks-prose-hooks.md Change Log 2026-10-23, Requirement: Self-test isolation for the project root | FR-118 | FR-091]
  assertHealthyReport(runHealth("/home/u/app"));
});
