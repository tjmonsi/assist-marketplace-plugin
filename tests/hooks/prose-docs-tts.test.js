// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box tests for the docs/tts voice-script exemption of the prose hooks
// (plugins/assist-plugin/hooks/impl/prose-gate.js and prose-advisor.js, `evaluate(input,
// options)`), release 1.11.1.
//
// Sources: specs/spec-hooks-prose-hooks.md (Requirement: Voice-script exemption under the
// project root and the session directory; Requirement: Path exemptions as built) and
// docs/requirements/FR-NFR-assist-plugin.md (FR-181, FR-104).
//
// Traceability format: [Scenario title | spec section | FR ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// Contract used (specs/spec-hooks-platform.md and spec-hooks-prose-hooks.md):
//   - prose-gate evaluate(input, options) returns an object whose `deny` field is the
//     boolean true to deny; anything else allows.
//   - prose-advisor evaluate(input, options) returns null when it has nothing to say and an
//     object (the advisory note) when the added text holds an advisory tell.
//   - options keys `projectDir` (a string, or null for "unset"; absent or undefined means
//     read CLAUDE_PROJECT_DIR) and `findGitRoot` (a function from an absolute directory to
//     the directory that holds .git, or null; a non-function counts as absent).
// "Exempt" below means: prose-gate does not deny and prose-advisor returns nothing, for the
// same input. "Gated" means: prose-gate denies and prose-advisor returns a note.
//
// All paths below are made-up POSIX paths that do not exist, except in the real-walk cases
// at the end, which build a temp tree.
//
// Run: node --test tests/hooks/prose-docs-tts.test.js

"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const HOOKS = path.join(REPO, "plugins", "assist-plugin", "hooks", "impl");
const gate = require(path.join(HOOKS, "prose-gate.js"));
const advisor = require(path.join(HOOKS, "prose-advisor.js"));

const EM = String.fromCharCode(0x2014); // em dash, a block-tier tell
const GATE_TEXT = "A " + EM + " B.\n";
const ADVISOR_TEXT = "This is very robust.\n"; // an intensifier and an AI-vocabulary word

const P = "/assist-test/project";
const VOICE = "voice-intro-20261012-0900.md";

// ---------------------------------------------------------------------------
// Environment isolation: the real variables must not change a case's result
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
// Builders and verdict helpers
// ---------------------------------------------------------------------------

function gateInput(cwd, target) {
  const input = {
    hook_event_name: "PreToolUse",
    tool_name: "Write",
    tool_input: { file_path: target, content: GATE_TEXT },
  };
  if (cwd !== undefined) input.cwd = cwd;
  return input;
}

function advisorInput(cwd, target) {
  const input = {
    hook_event_name: "PostToolUse",
    tool_name: "Write",
    tool_input: { file_path: target, content: ADVISOR_TEXT },
    tool_response: { type: "create" },
  };
  if (cwd !== undefined) input.cwd = cwd;
  return input;
}

function denied(result) {
  return result !== null && result !== undefined && result.deny === true;
}

function noted(result) {
  return result !== null && result !== undefined && typeof result === "object";
}

function recorder(answer) {
  const calls = [];
  const f = function (dir) {
    calls.push(dir);
    return answer ? answer(dir) : null;
  };
  f.calls = calls;
  return f;
}

const NO_ROOT = function () {
  return null;
};

// Runs both hooks on the same scenario and checks they agree with `exempt`.
function check(s) {
  const options = function () {
    return { projectDir: s.projectDir === undefined ? null : s.projectDir, findGitRoot: s.findGitRoot || NO_ROOT };
  };
  const g = gate.evaluate(gateInput(s.cwd, s.target), options());
  const a = advisor.evaluate(advisorInput(s.cwd, s.target), options());
  if (s.exempt) {
    assert.ok(!denied(g), "prose-gate denied an exempt target: " + s.target + " (cwd " + s.cwd + ")");
    assert.ok(!noted(a), "prose-advisor flagged an exempt target: " + s.target + " (cwd " + s.cwd + ")");
  } else {
    assert.ok(denied(g), "prose-gate allowed a gated target: " + s.target + " (cwd " + s.cwd + ")");
    assert.ok(noted(a), "prose-advisor stayed silent on a gated target: " + s.target + " (cwd " + s.cwd + ")");
  }
}

// ---------------------------------------------------------------------------
// Project variable set (step 1(a)) and the session root (step 2)
// ---------------------------------------------------------------------------

test("subdirectory session: voice script at the project root is exempt", () => {
  // [Scenario: Subdirectory session, voice script at the project root | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181 | FR-104]
  check({ projectDir: P, cwd: P + "/src", target: P + "/docs/tts/" + VOICE, exempt: true });
});

test("subdirectory session: voice script in the session directory is exempt", () => {
  // [Scenario: Subdirectory session, voice script in the session directory | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181]
  check({ projectDir: P, cwd: P + "/src", target: P + "/src/docs/tts/voice-intro-20261016-0900.md", exempt: true });
});

test("subdirectory session: a relative docs/tts target resolves against the session directory and is exempt", () => {
  // [Scenario: Subdirectory session, voice script in the session directory | spec-hooks-prose-hooks.md target resolution | FR-181]
  check({ projectDir: P, cwd: P + "/src", target: "docs/tts/" + VOICE, exempt: true });
});

test("worktree session: docs/tts inside the worktree directory is exempt", () => {
  // [Scenario: Worktree session | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181]
  const wt = P + "/.claude/worktrees/w";
  check({ projectDir: P, cwd: wt, target: wt + "/docs/tts/a-selftest.md", exempt: true });
});

test("a file nested deeper under docs/tts is exempt", () => {
  // [Scenario: Voice script from the project root | spec-hooks-prose-hooks.md "Path exemptions as built" | FR-104 | FR-181]
  check({ projectDir: P, cwd: P, target: P + "/docs/tts/sub/dir/a-selftest.md", exempt: true });
});

test("session directory outside the project: its docs/tts is gated", () => {
  // [Scenario: Session directory outside the project | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181]
  check({
    projectDir: P,
    cwd: "/assist-test/other",
    target: "/assist-test/other/docs/tts/a-selftest.md",
    exempt: false,
  });
});

test("session directory outside the project: the project's docs/tts is still exempt", () => {
  // [Scenario: Session directory outside the project | spec-hooks-prose-hooks.md "Voice-script exemption..." step 3 | FR-181]
  check({ projectDir: P, cwd: "/assist-test/other", target: P + "/docs/tts/a-selftest.md", exempt: true });
});

test("other docs path stays gated in a subdirectory session", () => {
  // [Scenario: Other docs path stays gated | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181 | FR-104]
  check({ projectDir: P, cwd: P + "/src", target: P + "/docs/guide.md", exempt: false });
});

test("other docs path stays gated in a session at the project root", () => {
  // [Scenario: Other docs path | spec-hooks-prose-hooks.md "Path exemptions as built" | FR-104]
  check({ projectDir: P, cwd: P, target: "docs/guide.md", exempt: false });
});

test("docs/tts under neither root is gated", () => {
  // [Scenario: docs/tts under neither root | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181]
  check({ projectDir: P, cwd: P, target: P + "/src/docs/tts/a-selftest.md", exempt: false });
});

test("a path that climbs out of docs/tts is gated", () => {
  // [Scenario: Path that climbs out | spec-hooks-prose-hooks.md "Path exemptions as built" | FR-104]
  // Boundary: dot segments are normalized before the comparison.
  check({ projectDir: P, cwd: P, target: "docs/tts/../README.md", exempt: false });
  check({ projectDir: P, cwd: P + "/src", target: P + "/docs/tts/../README.md", exempt: false });
});

test("a sibling directory that only starts with 'tts' is gated", () => {
  // [Scenario: Path exemptions as built (separator boundary) | spec-hooks-prose-hooks.md | FR-104 | FR-181]
  // Boundary: compared at a path-separator boundary.
  check({ projectDir: P, cwd: P, target: P + "/docs/tts-notes/a-selftest.md", exempt: false });
  check({ projectDir: P, cwd: P, target: P + "/docs/ttsfile.md", exempt: false });
});

test("CLAUDE_PROJECT_DIR takes priority over the git root", () => {
  // [Scenario: Subdirectory session / Session directory outside the project | spec-hooks-prose-hooks.md step 1(a) | FR-181]
  // The finder would answer "/assist-test/other-root", but the variable names the project.
  const finder = recorder(() => "/assist-test/other-root");
  check({
    projectDir: P,
    findGitRoot: finder,
    cwd: "/assist-test/other-root/src",
    target: "/assist-test/other-root/docs/tts/a-selftest.md",
    exempt: false,
  });
});

// ---------------------------------------------------------------------------
// No project variable: the git root of the cwd (step 1(b)), then the cwd (step 1(c))
// ---------------------------------------------------------------------------

test("no project variable, git root above the cwd: the git root is the project root", () => {
  // [Scenario: No project directory variable | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181]
  const repo = "/assist-test/repo";
  const finder = recorder((dir) => (dir.indexOf(repo) === 0 ? repo : null));
  check({ projectDir: null, findGitRoot: finder, cwd: repo + "/src", target: repo + "/docs/tts/a-selftest.md", exempt: true });
  assert.ok(finder.calls.length >= 1, "the git-root finder was never asked");
  finder.calls.forEach((dir) => assert.ok(path.isAbsolute(dir), "finder called with a non-absolute directory: " + dir));
  assert.strictEqual(finder.calls[0], repo + "/src", "the walk starts at the hook input cwd");
});

test("no project variable, git root above the cwd: other docs paths stay gated", () => {
  // [Scenario: Other docs path stays gated | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181]
  const repo = "/assist-test/repo";
  const finder = recorder((dir) => (dir.indexOf(repo) === 0 ? repo : null));
  check({ projectDir: null, findGitRoot: finder, cwd: repo + "/src", target: repo + "/docs/guide.md", exempt: false });
});

test("linked worktree without the variable: the directory with the .git file is the project root", () => {
  // [Scenario: Linked worktree without the variable | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181]
  const wt = "/assist-test/wt";
  const finder = recorder((dir) => (dir.indexOf(wt) === 0 ? wt : null));
  check({ projectDir: null, findGitRoot: finder, cwd: wt + "/lib", target: wt + "/docs/tts/a-selftest.md", exempt: true });
});

test("neither variable nor git root: the cwd is the project root", () => {
  // [Scenario: Neither available | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181]
  check({ projectDir: null, findGitRoot: NO_ROOT, cwd: "/assist-test/nogit", target: "docs/tts/voice-x.md", exempt: true });
});

test("session at the project root with no variable: relative docs/tts target is exempt", () => {
  // [Scenario: Voice script from the project root | spec-hooks-prose-hooks.md "Path exemptions as built" | FR-104 | FR-181]
  check({ projectDir: null, findGitRoot: NO_ROOT, cwd: P, target: "docs/tts/" + VOICE, exempt: true });
});

test("neither available: docs/tts in a subdirectory of the cwd is gated", () => {
  // [Scenario: docs/tts under neither root | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181]
  check({ projectDir: null, findGitRoot: NO_ROOT, cwd: "/assist-test/nogit", target: "src/docs/tts/a-selftest.md", exempt: false });
});

// ---------------------------------------------------------------------------
// Unusable cwd and unusable project variable
// ---------------------------------------------------------------------------

test("relative target without a cwd is gated even when the project variable is set", () => {
  // [Scenario: Relative target without a usable cwd | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181]
  check({ projectDir: P, cwd: undefined, target: "docs/tts/a-selftest.md", exempt: false });
});

test("relative target with an empty or relative cwd is gated even when the project variable is set", () => {
  // [Scenario: Relative target without a usable cwd | spec-hooks-prose-hooks.md "Voice-script exemption..." further rules | FR-181]
  // Null/empty and boundary: '' and 'src' are not usable roots.
  check({ projectDir: P, cwd: "", target: "docs/tts/a-selftest.md", exempt: false });
  check({ projectDir: P, cwd: "src", target: "docs/tts/a-selftest.md", exempt: false });
  check({ projectDir: P, cwd: ".", target: "docs/tts/a-selftest.md", exempt: false });
});

test("the git-root finder is never called when the input cwd is missing, empty, or relative", () => {
  // [Scenario: Relative target without a usable cwd | spec-hooks-prose-hooks.md "Voice-script exemption..." step 1(b) and further rules | FR-181]
  const finder = recorder(() => P);
  [undefined, "", "src", "./src", ".."].forEach((cwd) => {
    check({ projectDir: null, findGitRoot: finder, cwd: cwd, target: "docs/tts/a-selftest.md", exempt: false });
    check({ projectDir: null, findGitRoot: finder, cwd: cwd, target: P + "/docs/tts/a-selftest.md", exempt: false });
  });
  assert.deepStrictEqual(finder.calls, [], "the finder was called with: " + JSON.stringify(finder.calls));
});

test("project variable alone, with no cwd, exempts an absolute docs/tts target under it", () => {
  // [Scenario: Subdirectory session, voice script at the project root | spec-hooks-prose-hooks.md step 1(a) and step 3 | FR-181]
  check({ projectDir: P, cwd: undefined, target: P + "/docs/tts/a-selftest.md", exempt: true });
});

test("relative project variable is ignored and the absolute cwd becomes the project root", () => {
  // [Scenario: Relative project variable | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181]
  const cwd = "/assist-test/solo/dir";
  check({ projectDir: "app", findGitRoot: NO_ROOT, cwd: cwd, target: cwd + "/docs/tts/a-selftest.md", exempt: true });
});

test("relative project variable with no cwd leaves a relative target gated", () => {
  // [Scenario: Relative project variable (self-test case 10) | spec-hooks-prose-hooks.md "Self-test isolation..." table | FR-181]
  check({ projectDir: "app", findGitRoot: NO_ROOT, cwd: undefined, target: "docs/tts/a-selftest.md", exempt: false });
});

test("empty project variable is ignored", () => {
  // [Scenario: Relative project variable (empty string, null/empty category) | spec-hooks-prose-hooks.md step 1(a) | FR-181]
  const cwd = "/assist-test/solo/dir";
  check({ projectDir: "", findGitRoot: NO_ROOT, cwd: cwd, target: cwd + "/docs/tts/a-selftest.md", exempt: true });
});

// ---------------------------------------------------------------------------
// Options: no options, null, undefined, non-function
// ---------------------------------------------------------------------------

test("hook called with no options honours CLAUDE_PROJECT_DIR, gate and advisor", () => {
  // [Scenario: Hook called with no options honours CLAUDE_PROJECT_DIR | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181]
  process.env.CLAUDE_PROJECT_DIR = "/p";
  try {
    const exemptTarget = "/p/docs/tts/a-selftest.md";
    const gatedTarget = "/p/docs/guide.md";

    assert.ok(!denied(gate.evaluate(gateInput("/p/src", exemptTarget))), "prose-gate denied an exempt target");
    assert.ok(!noted(advisor.evaluate(advisorInput("/p/src", exemptTarget))), "prose-advisor flagged an exempt target");

    // Controls: the same call shape still judges a non-exempt target.
    assert.ok(denied(gate.evaluate(gateInput("/p/src", gatedTarget))), "control: prose-gate did not deny docs/guide.md");
    assert.ok(noted(advisor.evaluate(advisorInput("/p/src", gatedTarget))), "control: prose-advisor did not flag docs/guide.md");
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
  }
});

test("projectDir null overrides the environment: the target is gated", () => {
  // [Scenario: Null project directory overrides the environment | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181]
  process.env.CLAUDE_PROJECT_DIR = "/p";
  try {
    const options = { projectDir: null, findGitRoot: () => null };
    assert.ok(denied(gate.evaluate(gateInput("/p/src", "/p/docs/tts/a-selftest.md"), options)));
    assert.ok(noted(advisor.evaluate(advisorInput("/p/src", "/p/docs/tts/a-selftest.md"), options)));
    // The cwd itself becomes the project root, so its own docs/tts stays exempt.
    assert.ok(!denied(gate.evaluate(gateInput("/p/src", "/p/src/docs/tts/a-selftest.md"), options)));
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
  }
});

test("projectDir undefined counts as absent and reads the environment", () => {
  // [Scenario: Hook called with no options honours CLAUDE_PROJECT_DIR (undefined keys) | spec-hooks-prose-hooks.md "Test option keys" | FR-181]
  process.env.CLAUDE_PROJECT_DIR = "/p";
  try {
    const options = { projectDir: undefined, findGitRoot: () => null };
    assert.ok(!denied(gate.evaluate(gateInput("/p/src", "/p/docs/tts/a-selftest.md"), options)));
    assert.ok(!noted(advisor.evaluate(advisorInput("/p/src", "/p/docs/tts/a-selftest.md"), options)));
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
  }
});

test("a projectDir option wins over the environment", () => {
  // [Scenario: Subdirectory session | spec-hooks-prose-hooks.md "Test option keys" | FR-181]
  process.env.CLAUDE_PROJECT_DIR = "/other-project";
  try {
    const options = { projectDir: P, findGitRoot: () => null };
    assert.ok(!denied(gate.evaluate(gateInput(P + "/src", P + "/docs/tts/a-selftest.md"), options)));
    assert.ok(denied(gate.evaluate(gateInput(P + "/src", "/other-project/docs/tts/a-selftest.md"), options)));
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
  }
});

// ---------------------------------------------------------------------------
// Real file-system walk (no findGitRoot option), on a temp tree
// ---------------------------------------------------------------------------

function makeTree(kind) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "prose-tts-")));
  fs.mkdirSync(path.join(root, "src", "deep"), { recursive: true });
  if (kind === "dir") fs.mkdirSync(path.join(root, ".git"));
  else fs.writeFileSync(path.join(root, ".git"), "gitdir: /elsewhere/.git/worktrees/w\n");
  return root;
}

// The temp tree sits under the system temp directory, which both hooks never judge. The
// `tmpdir` option points the hooks at an unrelated directory; a control case checks that
// the option took effect before the walk assertions run.
function realWalkOptions(extra) {
  return Object.assign({ tmpdir: "/assist-test-tmp" }, extra);
}

function tmpOptionWorks(root) {
  try {
    const g = gate.evaluate(
      gateInput(root, root + "/docs/guide.md"),
      realWalkOptions({ projectDir: null, findGitRoot: NO_ROOT })
    );
    return denied(g);
  } catch (e) {
    return false;
  }
}

["dir", "file"].forEach((kind) => {
  test("real walk, .git as a " + kind + ": docs/tts under the git root is exempt from a subdirectory session", (t) => {
    // [Scenario: No project directory variable / Linked worktree without the variable | spec-hooks-prose-hooks.md "Voice-script exemption..." | FR-181]
    const root = makeTree(kind);
    try {
      if (!tmpOptionWorks(root)) {
        t.skip("the tmpdir option does not move the temp-directory exemption on this build");
        return;
      }
      const cwd = root + "/src/deep";
      // findGitRoot absent from the options: the hook walks the file system itself.
      const options = realWalkOptions({ projectDir: null });
      assert.ok(!denied(gate.evaluate(gateInput(cwd, root + "/docs/tts/a-selftest.md"), options)));
      assert.ok(!noted(advisor.evaluate(advisorInput(cwd, root + "/docs/tts/a-selftest.md"), options)));
      assert.ok(!denied(gate.evaluate(gateInput(cwd, "docs/tts/a-selftest.md"), options)), "session directory docs/tts");
      // Control: other docs paths in the same tree stay gated.
      assert.ok(denied(gate.evaluate(gateInput(cwd, root + "/docs/guide.md"), options)));
      assert.ok(noted(advisor.evaluate(advisorInput(cwd, root + "/docs/guide.md"), options)));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

test("a findGitRoot option that is not a function counts as absent", (t) => {
  // [Scenario: Hook called with no options honours CLAUDE_PROJECT_DIR (non-function key) | spec-hooks-prose-hooks.md "Test option keys" | FR-181]
  const root = makeTree("dir");
  try {
    if (!tmpOptionWorks(root)) {
      t.skip("the tmpdir option does not move the temp-directory exemption on this build");
      return;
    }
    const cwd = root + "/src";
    [42, "not a function", {}, true].forEach((bad) => {
      const options = realWalkOptions({ projectDir: null, findGitRoot: bad });
      let g;
      let a;
      assert.doesNotThrow(() => {
        g = gate.evaluate(gateInput(cwd, root + "/docs/tts/a-selftest.md"), options);
        a = advisor.evaluate(advisorInput(cwd, root + "/docs/tts/a-selftest.md"), options);
      }, "findGitRoot " + JSON.stringify(bad));
      assert.ok(!denied(g), "findGitRoot " + JSON.stringify(bad));
      assert.ok(!noted(a), "findGitRoot " + JSON.stringify(bad));
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
