// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for sa-mermaid-only absolute paths, release 1.12.0
// (plugins/assist-plugin/hooks/impl/sa-mermaid-only.js, evaluate(input, options)).
//
// Sources: specs/spec-hooks-bash-guards.md (Requirement: Mermaid guard scope, command forms,
// paths, metacharacters, deny reason; Change Log 2026-10-16 Requirement: Mermaid guard paths,
// rules 1 to 8 and the proposed self-test table; Requirement: Mermaid guard deny reason; Change
// Log 2026-10-17 Scenario "Git root at a drive root") and docs/requirements/FR-NFR-assist-plugin.md
// (FR-093, FR-092). Decisions: DECISIONS.md lines 148-151, 158-161, 173-176.
// Task plan step 32.
//
// Traceability format: [Scenario title | spec section | FR ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// Contract used:
//   evaluate(input, options) returns an object whose `deny` field is the boolean true, with a
//   string `reason`, to deny; any other result allows with no output. input carries tool_name
//   "Bash", agent_type, cwd, and tool_input.command. options.findGitRoot is a function from an
//   absolute directory to the git root or null and replaces the .git walk; any other value counts
//   as absent. The hook calls it at most once per call, only for a command that passed every other
//   check and holds an absolute -i or -o value, and only when cwd is a non-empty absolute string.
//
// The "Self-test case without a git-root stub" Scenario belongs to the health-check test (step 33).
//
// Run: node --test tests/hooks/sa-mermaid-only.test.js

"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const guard = require(path.join(REPO, "plugins", "assist-plugin", "hooks", "impl", "sa-mermaid-only.js"));

const SPEC = "spec-hooks-bash-guards.md";
const AGENT = "solutions-architect";
const R = "/assist-selftest/project";
const BOTH_FORMS = "as a relative path or as an absolute path under the git root";
const INSTALL = "npm install -g @mermaid-js/mermaid-cli";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function input(command, cwd, agentType) {
  const i = { hook_event_name: "PreToolUse", tool_name: "Bash", agent_type: agentType === undefined ? AGENT : agentType, tool_input: { command: command } };
  if (cwd !== undefined) i.cwd = cwd;
  return i;
}

// A findGitRoot stub that records its calls; `answer` is a value or a function of the directory.
function recorder(answer) {
  const calls = [];
  const f = function (dir) {
    calls.push(dir);
    return typeof answer === "function" ? answer(dir) : answer;
  };
  f.calls = calls;
  return f;
}

function isDenied(result) {
  return result !== null && result !== undefined && result.deny === true;
}

function evalWith(command, cwd, rootAnswer) {
  const stub = recorder(rootAnswer);
  const result = guard.evaluate(input(command, cwd), { findGitRoot: stub });
  return { result: result, stub: stub };
}

function expectAllow(command, cwd, rootAnswer, label) {
  const r = evalWith(command, cwd, rootAnswer);
  assert.ok(!isDenied(r.result), (label || "") + " expected allow, got deny (" + (r.result && r.result.reason) + "): " + command);
  return r;
}

function expectDeny(command, cwd, rootAnswer, label) {
  const r = evalWith(command, cwd, rootAnswer);
  assert.ok(isDenied(r.result), (label || "") + " expected deny: " + command);
  return r;
}

function mmdc(inFile, outFile) {
  return "mmdc -i " + inFile + " -o " + outFile;
}

function slashes(p) {
  return String(p).replace(/\\/g, "/");
}

function hasGitAbove(dir) {
  let cur = dir;
  for (;;) {
    if (fs.existsSync(path.join(cur, ".git"))) return true;
    const parent = path.dirname(cur);
    if (parent === cur) return false;
    cur = parent;
  }
}

// Skip reasons are decided when the tests are registered, so they are computed here, not in before().
const POSIX_ONLY = process.platform === "win32" ? "POSIX path form" : false;
const TMP_HAS_GIT = hasGitAbove(fs.realpathSync(os.tmpdir())) ? "a parent of the temp directory holds a .git entry" : false;
const MADE_UP_PATH_HAS_GIT = hasGitAbove("/assist-selftest/nogit") ? "the file-system root holds a .git entry" : false;

// ---------------------------------------------------------------------------
// The 15 cases of the proposed self-test table (R = /assist-selftest/project)
// ---------------------------------------------------------------------------

// [#, expect, cwd (undefined = none), findGitRoot returns (undefined = not called), command]
const TABLE = [
  [1, "allow", R + "/src", R, mmdc(R + "/specs/a.mmd", R + "/specs/a.png")],
  [2, "allow", R, R, mmdc("specs/a.mmd", R + "/specs/diagrams/a.svg")],
  [3, "allow", R + "/.claude/worktrees/w", R + "/.claude/worktrees/w", mmdc(R + "/.claude/worktrees/w/specs/a.mmd", R + "/.claude/worktrees/w/specs/a.png")],
  [4, "allow", "C:/proj", "C:\\proj", mmdc("c:/proj/specs/a.mmd", "C:/proj/specs/a.pdf")],
  [5, "allow", "/assist-selftest/nogit", null, mmdc("specs/a.mmd", "specs/a.png")],
  [6, "deny", R, R, mmdc(R + "/specs/a.mmd", R + "/CLAUDE.md")],
  [7, "allow", R + "/src", R, mmdc(R + "/backend/specs/a.mmd", R + "/backend/specs/a.png")],
  [8, "deny", R, R, mmdc(R + "/specs/../src/a.mmd", R + "/specs/a.png")],
  [9, "deny", R, R, mmdc(R + "/.hidden/specs/a.mmd", R + "/specs/a.png")],
  [10, "deny", R, R, mmdc("/tmp/specs/a.mmd", "/tmp/specs/a.png")],
  [11, "deny", "/assist-selftest/nogit", null, mmdc("/assist-selftest/nogit/specs/a.mmd", "/assist-selftest/nogit/specs/a.png")],
  [12, "deny", undefined, undefined, mmdc(R + "/specs/a.mmd", R + "/specs/a.png")],
  [13, "deny", R, R, "mmdc -i " + R + "/specs/a.mmd -o " + R + "/specs/"],
  [14, "deny", R, R, mmdc(R + "/a/b/specs/a.mmd", R + "/specs/a.png")],
  [15, "deny", R, R, mmdc(R + "/backend/.cache/specs/a.mmd", R + "/backend/specs/a.png")],
];

TABLE.forEach((row) => {
  const n = row[0], expect = row[1], cwd = row[2], root = row[3], command = row[4];
  test("[Requirement: Mermaid guard paths, proposed self-test case " + n + " | " + SPEC + " (Change Log 2026-10-16) | FR-093] " + expect + ": " + command, () => {
    const r = evalWith(command, cwd, root);
    if (expect === "allow") assert.ok(!isDenied(r.result), "expected allow, got " + (r.result && r.result.reason));
    else assert.ok(isDenied(r.result), "expected deny");
    if (cwd === undefined) assert.strictEqual(r.stub.calls.length, 0, "no cwd: findGitRoot is not called");
  });
});

// ---------------------------------------------------------------------------
// Scenarios of Requirement: Mermaid guard paths (2026-10-16)
// ---------------------------------------------------------------------------

test("[Scenario: Absolute path under the git root from a subdirectory session | " + SPEC + " Mermaid guard paths | FR-093] allowed with no output", () => {
  const r = expectAllow(mmdc(R + "/specs/a.mmd", R + "/specs/a.png"), R + "/src", R);
  assert.ok(!r.result || r.result.deny !== true);
});

test("[Scenario: Walk starts at the cwd | " + SPEC + " Mermaid guard paths | FR-093] findGitRoot is called once with the input cwd", () => {
  const r = expectAllow(mmdc(R + "/specs/a.mmd", R + "/specs/a.png"), R + "/src", R);
  assert.deepStrictEqual(r.stub.calls, [R + "/src"]);
});

test("[Scenario: Walk starts at the cwd (rule 6, at most one walk) | " + SPEC + " Mermaid guard paths | FR-093] two absolute values still cause one walk", () => {
  const r = expectAllow(mmdc(R + "/specs/a.mmd", R + "/specs/b.png"), R + "/src", R);
  assert.strictEqual(r.stub.calls.length, 1);
});

test("[Scenario: Absolute path outside the git root's specs folder | " + SPEC + " Mermaid guard paths | FR-093] CLAUDE.md under the root and /tmp/specs are both denied", () => {
  expectDeny(mmdc(R + "/specs/a.mmd", R + "/CLAUDE.md"), R, R, "output into an auto-loaded file");
  expectDeny(mmdc("/tmp/specs/a.mmd", "/tmp/specs/a.png"), R, R, "outside the root");
});

test("[Scenario: Absolute path under a submodule specs folder | " + SPEC + " Mermaid guard paths | FR-093] <root>/backend/specs is allowed, and so is the relative backend/specs form", () => {
  expectAllow(mmdc(R + "/backend/specs/a.mmd", R + "/backend/specs/a.png"), R + "/src", R);
  const relative = expectAllow(mmdc("backend/specs/a.mmd", "backend/specs/a.png"), R + "/src", R);
  assert.strictEqual(relative.stub.calls.length, 0, "the relative form needs no walk");
});

test("[Scenario: Absolute path two levels down | " + SPEC + " Mermaid guard paths | FR-093] <root>/a/b/specs is denied, as is the relative a/b/specs", () => {
  expectDeny(mmdc(R + "/a/b/specs/a.mmd", R + "/specs/a.png"), R, R);
  expectDeny(mmdc("a/b/specs/a.mmd", "specs/a.png"), R, R);
});

test("[Scenario: No .git found | " + SPEC + " Mermaid guard paths | FR-093] with no git root an absolute value is denied and the relative form is still allowed", () => {
  expectDeny(mmdc("/work/proj/specs/a.mmd", "/work/proj/specs/a.png"), "/work/proj", null);
  expectAllow(mmdc("specs/a.mmd", "specs/a.png"), "/work/proj", null);
});

test("[Scenario: Absolute path with a dot-dot segment | " + SPEC + " Mermaid guard paths | FR-093] <root>/specs/../src/a.mmd is denied", () => {
  expectDeny(mmdc(R + "/specs/../src/a.mmd", R + "/specs/a.png"), R, R);
  expectDeny(mmdc(R + "/specs/a.mmd", R + "/specs/../CLAUDE.md"), R, R);
});

test("[Scenario: Absolute path with a dot-led folder below the git root | " + SPEC + " Mermaid guard paths | FR-093] <root>/.hidden/specs/a.mmd is denied", () => {
  expectDeny(mmdc(R + "/.hidden/specs/a.mmd", R + "/specs/a.png"), R, R);
  expectDeny(mmdc(R + "/specs/a.mmd", R + "/specs/.hidden/a.png"), R, R);
});

test("[Scenario: No usable cwd | " + SPEC + " Mermaid guard paths | FR-093] with no cwd an absolute value is denied without calling findGitRoot", () => {
  const r = expectDeny(mmdc("/work/repo/specs/a.mmd", "/work/repo/specs/a.png"), undefined, "/work/repo");
  assert.strictEqual(r.stub.calls.length, 0);
});

test("[Scenario: No usable cwd (rule 3: empty, relative, or non-string cwd) | " + SPEC + " Mermaid guard paths | FR-093] an unusable cwd gives no git root and no walk", () => {
  ["", "src", "./src", 42, null, {}].forEach((cwd) => {
    const stub = recorder("/work/repo");
    const i = input(mmdc("/work/repo/specs/a.mmd", "/work/repo/specs/a.png"));
    i.cwd = cwd;
    const result = guard.evaluate(i, { findGitRoot: stub });
    assert.ok(isDenied(result), "cwd " + JSON.stringify(cwd) + " must deny an absolute value");
    assert.strictEqual(stub.calls.length, 0, "cwd " + JSON.stringify(cwd) + " must not walk");
  });
});

test("[Scenario: Worktree root under a hidden folder | " + SPEC + " Mermaid guard paths | FR-093] the segment rule applies only below the git root", () => {
  const wt = R + "/.claude/worktrees/w";
  expectAllow(mmdc(wt + "/specs/a.mmd", wt + "/specs/a.png"), wt, wt);
});

test("[Scenario: Relative command needs no walk | " + SPEC + " Mermaid guard paths | FR-093] a relative command allows and never calls findGitRoot", () => {
  const r = expectAllow("mmdc --input pkg/specs/a.mmd --output pkg/specs/a.pdf --theme dark --width 800", R + "/src", R);
  assert.strictEqual(r.stub.calls.length, 0);
});

test("[Scenario: Relative command needs no walk (rule 6: walk only when needed) | " + SPEC + " Mermaid guard paths | FR-093] commands that fail another check never walk, even with an absolute value", () => {
  [
    "mmdc -i " + R + "/specs/a.mmd -p cfg.json", // unknown flag
    "mmdc -i " + R + "/specs/a.mmd -o " + R + "/specs/x.md", // wrong extension
    "mmdc -i " + R + "/specs/a.mmd; rm -rf x", // metacharacter
    "npx mmdc -i " + R + "/specs/a.mmd -o " + R + "/specs/a.png", // download form
    "ls " + R + "/specs",
  ].forEach((command) => {
    const r = expectDeny(command, R, R);
    assert.strictEqual(r.stub.calls.length, 0, "no walk for: " + command);
  });
});

test("[Scenario: Reason names both path forms; Reason names the install command | " + SPEC + " Mermaid guard deny reason | FR-093 FR-092] every denial carries both path forms and ends with the install command", () => {
  const denied = [
    mmdc(R + "/specs/a.mmd", R + "/CLAUDE.md"),
    mmdc("/tmp/specs/a.mmd", "/tmp/specs/a.png"),
    mmdc(R + "/a/b/specs/a.mmd", R + "/specs/a.png"),
    "mmdc -i specs/a.mmd -p cfg.json",
    "npx mmdc -i specs/a.mmd -o specs/a.png",
    "rm -rf build",
    "mmdc -i a.mmd; rm -rf x",
    "",
  ];
  denied.forEach((command) => {
    const r = expectDeny(command, R, R);
    assert.strictEqual(typeof r.result.reason, "string");
    assert.ok(r.result.reason.indexOf(BOTH_FORMS) !== -1, "reason names both path forms for: " + command + " -> " + r.result.reason);
    assert.ok(r.result.reason.endsWith(INSTALL), "reason ends with the install command for: " + command);
  });
});

test("[Scenario: No rewrite | " + SPEC + " Mermaid guard deny reason | FR-092] a denial carries no updatedInput", () => {
  const r = expectDeny("rm -rf build", R, R);
  assert.ok(!Object.prototype.hasOwnProperty.call(r.result, "updatedInput"));
});

// ---------------------------------------------------------------------------
// Prefix test (rule 4): negatives and case rules
// ---------------------------------------------------------------------------

test("[Requirement: Mermaid guard paths, rule 4 prefix test | " + SPEC + " (Change Log 2026-10-16) | FR-093] a sibling directory that shares the root's prefix is denied", () => {
  expectDeny(mmdc(R + "2/specs/a.mmd", R + "/specs/a.png"), R, R, "project2");
  expectDeny(mmdc(R + "/specs/a.mmd", R + "-x/specs/a.png"), R, R, "project-x");
});

test("[Requirement: Mermaid guard paths, rule 4 prefix test | " + SPEC + " (Change Log 2026-10-16) | FR-093] a POSIX case change in the root is denied, because only a drive-letter root compares without case", () => {
  expectDeny(mmdc("/Assist-selftest/project/specs/a.mmd", R + "/specs/a.png"), R, R);
});

test("[Requirement: Mermaid guard paths, rule 4 prefix test | " + SPEC + " (Change Log 2026-10-16) | FR-093] a drive-letter root compares without case (c:/proj against C:\\proj)", () => {
  expectAllow(mmdc("c:/proj/specs/a.mmd", "C:/proj/specs/a.pdf"), "C:/proj", "C:\\proj");
  expectAllow(mmdc("C:/PROJ/specs/a.mmd", "c:/proj/specs/a.png"), "C:/proj", "C:\\proj");
});

test("[Requirement: Mermaid guard paths, rule 4 prefix test | " + SPEC + " (Change Log 2026-10-16) | FR-093] a root with a trailing slash still matches and a different drive does not", () => {
  expectAllow(mmdc(R + "/specs/a.mmd", R + "/specs/a.png"), R, R + "/");
  expectDeny(mmdc("D:/proj/specs/a.mmd", "C:/proj/specs/a.png"), "C:/proj", "C:\\proj");
});

test("[Requirement: Mermaid guard paths, rule 4 prefix test | " + SPEC + " (Change Log 2026-10-16) | FR-093] the extension check ignores case below the root", () => {
  expectAllow(mmdc(R + "/specs/A.MMD", R + "/specs/a.PNG"), R, R);
});

// ---------------------------------------------------------------------------
// Git root at a drive root and at the file-system root
// ---------------------------------------------------------------------------

test("[Scenario: Git root at a drive root | " + SPEC + " Mermaid guard paths (Change Log 2026-10-17) | FR-093] c:/specs/a.mmd to C:/specs/a.png is allowed with the root C:\\", () => {
  expectAllow("mmdc -i c:/specs/a.mmd -o C:/specs/a.png", "C:/work", "C:\\");
  expectAllow("mmdc -i c:/specs/a.mmd -o C:/backend/specs/a.png", "C:/work", "C:\\");
});

test("[Scenario: Git root at a drive root | " + SPEC + " Mermaid guard paths (Change Log 2026-10-17) | FR-093] a value on another drive or outside specs/ is denied", () => {
  expectDeny("mmdc -i D:/specs/a.mmd -o C:/specs/a.png", "C:/work", "C:\\");
  expectDeny("mmdc -i C:/src/a.mmd -o C:/specs/a.png", "C:/work", "C:\\");
});

test("[Requirement: Mermaid guard paths, rule 4 (file-system root) | " + SPEC + " (Change Log 2026-10-16) | FR-093] with the root / the value /specs/a.mmd is allowed and /src/a.mmd is denied", () => {
  expectAllow("mmdc -i /specs/a.mmd -o /specs/a.png", "/work", "/");
  expectDeny("mmdc -i /src/a.mmd -o /specs/a.png", "/work", "/");
});

test("[Requirement: Mermaid guard paths, rule 4 (file-system root) | " + SPEC + " (Change Log 2026-10-16) | FR-093] with the root / the value /Specs/a.mmd is denied, because the case rule applies only to a drive-letter root", () => {
  expectDeny("mmdc -i /Specs/a.mmd -o /specs/a.png", "/work", "/");
});

// ---------------------------------------------------------------------------
// Test option, scope, and the built forms
// ---------------------------------------------------------------------------

test("[Requirement: Mermaid guard paths, rule 7 test option | " + SPEC + " (Change Log 2026-10-16) | FR-093 FR-088] a findGitRoot option that is not a function counts as absent (the real walk from a directory with no .git denies)", { skip: MADE_UP_PATH_HAS_GIT }, () => {
  const i = input(mmdc("/assist-selftest/nogit/specs/a.mmd", "/assist-selftest/nogit/specs/a.png"), "/assist-selftest/nogit");
  ["not a function", 42, null, {}].forEach((bad) => {
    assert.ok(isDenied(guard.evaluate(i, { findGitRoot: bad })), "option " + JSON.stringify(bad));
  });
});

test("[Scenario: Other agent | " + SPEC + " Mermaid guard scope | FR-092] assist-plugin:developer running rm -rf build is allowed", () => {
  assert.ok(!isDenied(guard.evaluate(input("rm -rf build", R, "assist-plugin:developer"), { findGitRoot: recorder(R) })));
});

test("[Scenario: Other agent (absolute paths) | " + SPEC + " Mermaid guard scope | FR-092 FR-093] an agent that is not solutions-architect is never judged or walked", () => {
  const stub = recorder(R);
  const result = guard.evaluate(input(mmdc("/tmp/specs/a.mmd", "/etc/passwd"), R, "assist-plugin:developer"), { findGitRoot: stub });
  assert.ok(!isDenied(result));
  assert.strictEqual(stub.calls.length, 0);
});

test("[Scenario: Main session | " + SPEC + " Mermaid guard scope | FR-092] the main session (no agent_type) running npx mmdc is allowed", () => {
  const i = input("npx mmdc -i a.mmd -o a.png", R);
  delete i.agent_type;
  assert.ok(!isDenied(guard.evaluate(i, { findGitRoot: recorder(R) })));
});

test("[Scenario: Same agent name from another plugin | " + SPEC + " Mermaid guard scope | FR-092] other-plugin:solutions-architect running ls is denied", () => {
  assert.ok(isDenied(guard.evaluate(input("ls", R, "other-plugin:solutions-architect"), { findGitRoot: recorder(R) })));
  assert.ok(isDenied(guard.evaluate(input("ls", R, "assist-plugin:solutions-architect"), { findGitRoot: recorder(R) })));
});

test("[Scenario: Lookup command; Full render command | " + SPEC + " Mermaid guard command forms | FR-092] which mmdc and the full relative render command stay allowed", () => {
  expectAllow("which mmdc", R, R);
  expectAllow("where mmdc", R, R);
  expectAllow("mmdc --version", R, R);
  expectAllow("mmdc -i specs/diagrams/a.mmd -o specs/diagrams/a.svg -t dark -b transparent -w 800 -H 600 -s 2", R, R);
});

test("[Scenario: Output into an auto-loaded file; Hidden or climbing paths; Specs one level down; Specs two levels down; Wrong extension | " + SPEC + " Mermaid guard paths | FR-093] the relative forms keep their built results", () => {
  expectDeny("mmdc -i specs/a.mmd -o CLAUDE.md", R, R);
  expectDeny("mmdc -i specs/a.mmd -o specs/.hidden/x.png", R, R);
  expectDeny("mmdc -i specs/a.mmd -o specs/../CLAUDE.md", R, R);
  expectAllow("mmdc --input pkg/specs/a.mmd --output pkg/specs/a.pdf --theme dark --width 800", R, R);
  expectDeny("mmdc -i specs/a.mmd -o a/b/specs/a.svg", R, R);
  expectDeny("mmdc -i specs/a.mmd -o specs/x.md", R, R);
});

test("[Scenario: Chained command; Brace expansion; Quoted path with a space | " + SPEC + " Mermaid guard metacharacters and quotes | FR-093] metacharacters deny before any path check, and a quoted path with a space is allowed", () => {
  expectDeny("mmdc -i a.mmd; rm -rf x", R, R);
  expectDeny("mmdc -i {a,b}.mmd", R, R);
  expectAllow('mmdc -i specs/a.mmd -o "specs/my dir/a.svg"', R, R);
});

test("[Scenario: Download form; Unknown flag; Program given by path | " + SPEC + " Mermaid guard command forms | FR-092] npx, an unknown flag, and an absolute program path are denied", () => {
  expectDeny("npx mmdc -i specs/a.mmd -o specs/a.png", R, R);
  expectDeny("mmdc -i specs/a.mmd -p cfg.json", R, R);
  expectDeny("/usr/local/bin/mmdc -i specs/a.mmd -o specs/a.png", R, R);
});

// ---------------------------------------------------------------------------
// Default wiring: the real .git walk (no options)
// ---------------------------------------------------------------------------

let base = null;

before(() => {
  base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "sa-mermaid-")));
  // repo: a normal clone (.git is a directory) with a src folder and a specs folder
  fs.mkdirSync(path.join(base, "repo", ".git"), { recursive: true });
  fs.mkdirSync(path.join(base, "repo", "src"), { recursive: true });
  fs.mkdirSync(path.join(base, "repo", "specs"), { recursive: true });
  // wt: a linked worktree (.git is a file)
  fs.mkdirSync(path.join(base, "wt", "sub"), { recursive: true });
  fs.writeFileSync(path.join(base, "wt", ".git"), "gitdir: /elsewhere/.git/worktrees/wt\n");
  // plain: no .git here (the skip reason above covers a .git in a parent of the temp directory)
  fs.mkdirSync(path.join(base, "plain", "dir"), { recursive: true });
});

after(() => {
  if (base) fs.rmSync(base, { recursive: true, force: true });
});

test("[Requirement: Mermaid guard paths, rule 3 default wiring | " + SPEC + " (Change Log 2026-10-16) | FR-093] evaluate(input) with no options walks the real file system from cwd and allows a path under the repo's specs folder", { skip: POSIX_ONLY }, () => {
  const repo = slashes(path.join(base, "repo"));
  const result = guard.evaluate(input(mmdc(repo + "/specs/a.mmd", repo + "/specs/a.png"), repo + "/src"));
  assert.ok(!isDenied(result), result && result.reason);
});

test("[Scenario: Walk starts at the cwd | " + SPEC + " Mermaid guard paths | FR-093] the real walk starts at cwd: a .git in the parent, none in cwd, and the command is allowed; a path outside the repo is denied", { skip: POSIX_ONLY }, () => {
  const repo = slashes(path.join(base, "repo"));
  assert.ok(!isDenied(guard.evaluate(input(mmdc(repo + "/specs/a.mmd", repo + "/specs/a.png"), repo + "/src"))));
  assert.ok(isDenied(guard.evaluate(input(mmdc(repo + "/specs/a.mmd", repo + "/CLAUDE.md"), repo + "/src"))));
  assert.ok(isDenied(guard.evaluate(input(mmdc("/tmp/specs/a.mmd", "/tmp/specs/a.png"), repo + "/src"))));
});

test("[Scenario: Worktree root under a hidden folder | " + SPEC + " Mermaid guard paths | FR-093] a .git file (linked worktree) marks the git root in the real walk", { skip: POSIX_ONLY }, () => {
  const wt = slashes(path.join(base, "wt"));
  const result = guard.evaluate(input(mmdc(wt + "/specs/a.mmd", wt + "/specs/a.png"), wt + "/sub"));
  assert.ok(!isDenied(result), result && result.reason);
});

test("[Scenario: No .git found | " + SPEC + " Mermaid guard paths | FR-093] evaluate(input) from a directory with no .git in it or in any parent denies an absolute path and allows the relative form", { skip: POSIX_ONLY || TMP_HAS_GIT }, () => {
  const plain = slashes(path.join(base, "plain", "dir"));
  assert.ok(isDenied(guard.evaluate(input(mmdc(plain + "/specs/a.mmd", plain + "/specs/a.png"), plain))));
  assert.ok(!isDenied(guard.evaluate(input(mmdc("specs/a.mmd", "specs/a.png"), plain))));
});
