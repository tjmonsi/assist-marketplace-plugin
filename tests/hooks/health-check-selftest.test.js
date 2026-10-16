// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box contract tests for the self-test corpora and wrappers of the health check,
// release 1.11.1 (plugins/assist-plugin/hooks/impl/health-check.js).
//
// Sources: specs/spec-hooks-prose-hooks.md (Requirement: Self-test isolation for the project
// root), specs/spec-hooks-fsa-write-bar.md (Requirement: Task-planner write scope in
// docs/task-plans/, self-test table and Scenario: Self-test case without a git-root stub),
// specs/spec-hooks-health-check.md (Requirement: Self-tests) and
// docs/requirements/FR-NFR-assist-plugin.md (FR-181, FR-186, FR-118, FR-091).
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
// and the HEALTH command (node plugins/assist-plugin/hooks/health-check.js), whose report is
// public output. The command runs with CLAUDE_PLUGIN_DATA unset, so it writes nothing.
//
// Run: node --test tests/hooks/health-check-selftest.test.js

"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const hc = require(path.join(PLUGIN, "hooks", "impl", "health-check.js"));

const TTS_ROOT = "/assist-selftest/project";
const FSA_ROOT = "/assist-selftest/project";
const PLANNER = "assist-plugin:task-planner";

// ---------------------------------------------------------------------------
// Environment isolation
// ---------------------------------------------------------------------------

const savedEnv = {};

before(() => {
  ["CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA"].forEach((k) => {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  });
});

after(() => {
  Object.keys(savedEnv).forEach((k) => {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  });
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

const PROSE_CORPORA = [
  ["PROSE_GATE_ALLOW", hc.PROSE_GATE_ALLOW],
  ["PROSE_GATE_DENY", hc.PROSE_GATE_DENY],
  ["PROSE_ADVISOR_CLEAN", hc.PROSE_ADVISOR_CLEAN],
  ["PROSE_ADVISOR_FLAGGED", hc.PROSE_ADVISOR_FLAGGED],
];

// ---------------------------------------------------------------------------
// FR-181: every prose case carries both keys
// ---------------------------------------------------------------------------

PROSE_CORPORA.forEach((pair) => {
  const name = pair[0], corpus = pair[1];

  test(name + " is an exported, non-empty array", () => {
    // [Scenario: Every prose case carries both keys | spec-hooks-prose-hooks.md "Self-test isolation for the project root" | FR-181 | FR-118]
    assert.ok(Array.isArray(corpus), name + " must be exported as an array");
    assert.ok(corpus.length > 0);
  });

  test(name + ": every case has an own projectDir (string or null) and a function findGitRoot", () => {
    // [Scenario: Every prose case carries both keys | same requirement | FR-181 | FR-091]
    corpus.forEach((c, i) => {
      const who = name + " case " + labelOf(c, i);
      assert.ok(has(c, "projectDir"), who + " lacks an own projectDir property");
      assert.ok(c.projectDir === null || typeof c.projectDir === "string", who + ": projectDir must be a string or null");
      assert.ok(has(c, "findGitRoot"), who + " lacks an own findGitRoot property");
      assert.strictEqual(typeof c.findGitRoot, "function", who + ": findGitRoot must be a function");
    });
  });

  test(name + ": every findGitRoot returns a string or null for a directory and never throws", () => {
    // Null/type boundary of the stub itself. [Scenario: Every prose case carries both keys | same requirement | FR-181]
    corpus.forEach((c, i) => {
      const who = name + " case " + labelOf(c, i);
      [TTS_ROOT, TTS_ROOT + "/src", "/assist-selftest/other"].forEach((dir) => {
        let out;
        assert.doesNotThrow(() => {
          out = c.findGitRoot(dir);
        }, who);
        assert.ok(out === null || typeof out === "string", who + ": findGitRoot must return a string or null");
      });
    });
  });
});

test("prose corpora sizes follow the plan: prose-gate 32 allow and 31 deny, prose-advisor 11 clean and 10 flagged", () => {
  // Built sizes (27, 26, 10, 8) plus the 13 added cases (5 allow, 5 deny; 1 clean, 2 flagged).
  // [Requirement: Self-test isolation for the project root, cases to add | spec-hooks-prose-hooks.md | FR-181 | FR-118]
  assert.strictEqual(hc.PROSE_GATE_ALLOW.length, 32);
  assert.strictEqual(hc.PROSE_GATE_DENY.length, 31);
  assert.strictEqual(hc.PROSE_ADVISOR_CLEAN.length, 11);
  assert.strictEqual(hc.PROSE_ADVISOR_FLAGGED.length, 10);
});

// The 13 added cases: [#, corpus, projectDir, finder result ("null" or a root), cwd (undefined = none), target]
const TTS_TABLE = [
  [1, "PROSE_GATE_ALLOW", TTS_ROOT, null, TTS_ROOT + "/src", TTS_ROOT + "/docs/tts/a.md"],
  [2, "PROSE_GATE_ALLOW", TTS_ROOT, null, TTS_ROOT + "/src", "../docs/tts/a.md"],
  [3, "PROSE_GATE_ALLOW", TTS_ROOT, null, TTS_ROOT + "/src", TTS_ROOT + "/src/docs/tts/a.md"],
  [4, "PROSE_GATE_ALLOW", TTS_ROOT, null, TTS_ROOT + "/.claude/worktrees/w", TTS_ROOT + "/.claude/worktrees/w/docs/tts/a.md"],
  [5, "PROSE_GATE_ALLOW", null, TTS_ROOT, TTS_ROOT + "/src", TTS_ROOT + "/docs/tts/a.md"],
  [6, "PROSE_GATE_DENY", TTS_ROOT, null, TTS_ROOT, TTS_ROOT + "/src/docs/tts/a.md"],
  [7, "PROSE_GATE_DENY", TTS_ROOT, null, "/assist-selftest/other", "/assist-selftest/other/docs/tts/a.md"],
  [8, "PROSE_GATE_DENY", TTS_ROOT, null, TTS_ROOT + "/src", TTS_ROOT + "/docs/guide.md"],
  [9, "PROSE_GATE_DENY", TTS_ROOT, null, undefined, "docs/tts/a.md"],
  [10, "PROSE_GATE_DENY", "app", null, undefined, "docs/tts/a.md"],
  [11, "PROSE_ADVISOR_CLEAN", TTS_ROOT, null, TTS_ROOT + "/src", TTS_ROOT + "/src/docs/tts/a.md"],
  [12, "PROSE_ADVISOR_FLAGGED", TTS_ROOT, null, TTS_ROOT, TTS_ROOT + "/src/docs/tts/a.md"],
  [13, "PROSE_ADVISOR_FLAGGED", TTS_ROOT, null, "/assist-selftest/other", "/assist-selftest/other/docs/tts/a.md"],
];

TTS_TABLE.forEach((row) => {
  const n = row[0], corpusName = row[1], projectDir = row[2], finder = row[3], cwd = row[4], target = row[5];
  test("prose corpus holds table case " + n + " (" + corpusName + ", target " + target + ")", () => {
    // [Requirement: Self-test isolation for the project root, cases to add | spec-hooks-prose-hooks.md | FR-181 | FR-118]
    const corpus = hc[corpusName];
    const found = corpus.some((c) => {
      if (c.projectDir !== projectDir) return false;
      if (targetOf(c) !== target) return false;
      if (cwd === undefined ? !!c.cwd : c.cwd !== cwd) return false;
      if (typeof c.findGitRoot !== "function") return false;
      const answer = c.findGitRoot(cwd || TTS_ROOT);
      return finder === null ? answer === null : answer === finder;
    });
    assert.ok(found, "no case in " + corpusName + " matches table case " + n);
  });
});

// ---------------------------------------------------------------------------
// FR-181: the wrapper throws for a case without the keys
// ---------------------------------------------------------------------------

[
  ["prose-gate", hc.PROSE_GATE_ALLOW],
  ["prose-advisor", hc.PROSE_ADVISOR_CLEAN],
].forEach((pair) => {
  const name = pair[0], corpus = pair[1];

  test(name + ": a case without projectDir makes the wrapper throw", () => {
    // [Scenario: Case built without the keys | spec-hooks-prose-hooks.md "Self-test isolation for the project root" | FR-181 | FR-118]
    const bad = copyWithout(corpus[0], "projectDir");
    assert.throws(() => guard(name).evaluate(bad));
  });

  test(name + ": a case without findGitRoot makes the wrapper throw", () => {
    // [Scenario: Case built without the keys | same requirement | FR-181]
    const bad = copyWithout(corpus[0], "findGitRoot");
    assert.throws(() => guard(name).evaluate(bad));
  });

  test(name + ": a case whose findGitRoot is not a function makes the wrapper throw", () => {
    // Type mismatch. [Scenario: Case built without the keys | same requirement | FR-181]
    const bad = Object.assign({}, corpus[0], { findGitRoot: "/assist-selftest/project" });
    assert.throws(() => guard(name).evaluate(bad));
  });

  test(name + ": the thrown error names the case label when the case has one", () => {
    // [Requirement: Self-test isolation for the project root, diskReader | FR-181]
    const labelled = corpus.find((c) => typeof c.label === "string" && c.label.length > 0);
    if (!labelled) return; // cases without labels are named by their tool and path instead
    const bad = copyWithout(labelled, "findGitRoot");
    assert.throws(() => guard(name).evaluate(bad), (err) => err instanceof Error && err.message.indexOf(labelled.label) !== -1);
  });

  test(name + ": selfTest lists the keyless case under 'case threw' and the hook's result is FAIL", () => {
    // [Scenario: Case built without the keys | same requirement | FR-181]
    const bad = copyWithout(corpus[0], "findGitRoot");
    const result = hc.selfTest(onlyCases(guard(name), [bad], []));
    assert.strictEqual(result.errors.length, 1);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.falseDeny.length, 0);
    assert.strictEqual(result.falseAllow.length, 0);
  });
});

// ---------------------------------------------------------------------------
// FR-186: the write-bar wrapper requires a findGitRoot stub for task-planner cases
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
  // [Scenario: All pass; Requirement: Self-tests | spec-hooks-health-check.md | FR-118 | FR-181 | FR-186]
  delete process.env.CLAUDE_PROJECT_DIR;
  assertAllGuardsPass();
});

test("selfTest of every guard is unchanged under a real CLAUDE_PROJECT_DIR (HEALTH-PROJ)", () => {
  // [Scenario: Real project variable during SessionStart | spec-hooks-prose-hooks.md "Self-test isolation for the project root" | FR-181 | FR-091]
  process.env.CLAUDE_PROJECT_DIR = "/home/u/app";
  try {
    assertAllGuardsPass();
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
  }
});

test("prose-gate keeps the tts relative-path allow case under a real CLAUDE_PROJECT_DIR", () => {
  // The case that would be denied without the isolation keys, which would auto-disable prose-gate.
  // [Scenario: Real project variable during SessionStart | same requirement | FR-181 | FR-091]
  process.env.CLAUDE_PROJECT_DIR = "/home/u/app";
  try {
    const tts = hc.PROSE_GATE_ALLOW.filter((c) => /docs[\\/]tts[\\/]/.test(String(targetOf(c))));
    assert.ok(tts.length >= 1, "the prose-gate allow corpus should hold docs/tts cases");
    const g = guard("prose-gate");
    tts.forEach((c, i) => {
      const d = g.evaluate(c);
      assert.ok(!(d && d.deny === true), "docs/tts allow case denied: " + labelOf(c, i));
    });
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
  assert.ok(/^\s+prose-gate: PASS \(32 [^,]+, 31 [^)]+\)/m.test(out), "prose-gate corpus sizes 32 and 31:\n" + out);
  assert.ok(/^\s+prose-advisor: PASS \(11 [^,]+, 10 [^)]+\)/m.test(out), "prose-advisor corpus sizes 11 and 10:\n" + out);
}

test("HEALTH: the report lists every hook as passing with no 'case threw' (project variable unset)", () => {
  // [Scenario: All pass | spec-hooks-health-check.md "Self-tests" | FR-118 | FR-181 | FR-186]
  assertHealthyReport(runHealth(null));
});

test("HEALTH-PROJ: the same result under CLAUDE_PROJECT_DIR=/home/u/app", () => {
  // [Scenario: Real project variable during SessionStart | spec-hooks-prose-hooks.md "Self-test isolation for the project root" | FR-181 | FR-091]
  assertHealthyReport(runHealth("/home/u/app"));
});
