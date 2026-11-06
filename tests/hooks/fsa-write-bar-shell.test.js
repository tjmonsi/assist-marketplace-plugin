// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the shell write path of the write bar (harness-governance Tranche 2, Step 15):
// plugins/assist-plugin/hooks/fsa-write-bar.js (command entry) and plugins/assist-plugin/hooks/impl/fsa-write-bar.js
// (`evaluate(input, options)`, `guardedClass(input)`), registered for the Bash tool.
//
// Sources: specs/spec-hooks-fsa-write-bar.md (Change Log 2026-11-06: Requirement: Shell write path to protected paths,
// Scenarios Shell append to DECISIONS.md, Shell read allowed, Shell write to the governance audit log, Shell write to
// the confirmation store, Shell write to an unprotected path, Variable-built command not caught; MODIFIED Requirement:
// Scope of the bar, Scenario Bash write to a non-protected path by a role-limited agent), specs/spec-orchestration.md
// (Change Log 2026-11-06, Scenario Producer self-approval blocked), and docs/requirements/FR-NFR-harness-governance.md
// v1.3 (FR-223, FR-245, FR-222, UR-064, UR-075, NFR-028, NFR-036). Task plan: docs/task-plans/task-plan-harness-
// governance-20261028-0759.md, Steps 15 and 20.
//
// Traceability format: [AC-N | spec file | FR/NFR ids | UR/BR ids]. The spec has no SPEC-NNN id, so it is cited by
// file name. AC-N is the position of the Scenario inside Requirement: Shell write path to protected paths:
//   AC-1 Shell append to DECISIONS.md, AC-2 Shell read allowed, AC-3 Shell write to the governance audit log,
//   AC-4 Shell write to the confirmation store, AC-5 Shell write to an unprotected path, AC-6 Variable-built command
//   not caught.
//
// Contract used:
//   evaluate(input, options) returns an object whose `deny` field is the boolean true to deny; any other result allows.
//   options.roots (array of absolute directories) replaces the cwd and CLAUDE_PROJECT_DIR roots; options.findGitRoot is
//   a stub. A call with a non-empty agent_id is a subagent call; a call with no agent_id is the main session.
//   The Bash route judges a subagent Bash command: it denies a command that writes a protected path through
//   redirection (>, >>, >|, N>), tee, sed -i, cp, mv, or rm, and allows a read. Protected: **/.agent/main-plan/**,
//   DECISIONS.md, **/.agent/logs/governance/**, and the confirmation store .agent/governance/confirmations/ (both files).
//   Each lexed part of a chained command is judged on its own. The route covers the main session never.
//   NFR-028: when the Bash judge fails on a command that names a protected path, the runtime denies (exit 0, deny JSON);
//   a call outside that class proceeds.
//   Known limits, recorded and not closed (so the tests below assert they are NOT claimed covered): a command built from
//   a variable, a command string run by another program, symlinks, and PowerShell write verbs.
//
// Paths in the evaluate tests are made-up paths that do not exist, except where a test says it uses the file system.
//
// Run: node --test tests/hooks/fsa-write-bar-shell.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const PLUGIN = fx.PLUGIN;
const bar = require(path.join(PLUGIN, "hooks", "impl", "fsa-write-bar.js"));
const shellWrites = require(path.join(PLUGIN, "hooks", "lib", "shell-writes.js"));

const R = "/assist-selftest/project";

const PROTECTED = [
  "DECISIONS.md",
  ".agent/main-plan/plan-x.md",
  ".agent/logs/governance/audit.jsonl",
  ".agent/governance/confirmations/confirmations.jsonl",
  ".agent/governance/confirmations/pending.jsonl",
];

const SUBAGENT_TYPES = [
  "assist-plugin:developer",
  "assist-plugin:developer-tester",
  "assist-plugin:worker",
  "assist-plugin:qa",
  "assist-plugin:devops",
  "general-purpose",
  "other-plugin:custom-agent",
];

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sub(agentType) {
  return { agent_id: "agent-" + String(agentType).replace(/[^a-z]/g, "") + "-1", agent_type: agentType };
}

const SUB = sub("general-purpose");
const MAIN = {}; // the main session: no agent_id, no agent_type

function bash(command, caller, extra) {
  return Object.assign(
    { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: command }, cwd: R },
    caller || {},
    extra || {}
  );
}

function run(command, caller, extra, options) {
  return bar.evaluate(bash(command, caller, extra), Object.assign({ roots: [R], findGitRoot: () => R }, options || {}));
}

function denied(result) {
  return result !== null && result !== undefined && result.deny === true;
}

function text(result) {
  return result === null || result === undefined ? "" : JSON.stringify(result);
}

// The caller defaults to a subagent. Pass MAIN for the main session.
function assertDenied(command, caller, extra, options) {
  const result = run(command, caller === undefined ? SUB : caller, extra, options);
  assert.ok(denied(result), "expected deny for: " + command + " -> " + text(result));
  return result;
}

function assertAllowed(command, caller, extra, options) {
  const result = run(command, caller === undefined ? SUB : caller, extra, options);
  assert.ok(!denied(result), "expected allow for: " + command + " -> " + text(result));
}

// ---------------------------------------------------------------------------
// Spec scenarios, as written
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-fsa-write-bar | FR-223 | FR-245 | UR-064 | NFR-036] shell append to DECISIONS.md by a subagent is denied", () => {
  const result = assertDenied('echo "approved" >> DECISIONS.md');
  assert.ok(/DECISIONS\.md/.test(text(result)), "the reason names the path: " + text(result));
});

test("[AC-2 | spec-hooks-fsa-write-bar | FR-223 | FR-245] shell read of DECISIONS.md by a subagent is allowed", () => {
  assertAllowed("cat DECISIONS.md");
});

[
  ["sed -i", "sed -i 's/deny/allow/' .agent/logs/governance/audit.jsonl"],
  ["tee -a with no source word", "tee -a .agent/logs/governance/audit.jsonl"],
  ["tee -a after a pipe", "echo forged | tee -a .agent/logs/governance/audit.jsonl"],
  ["rm", "rm .agent/logs/governance/audit.jsonl"],
].forEach((row) => {
  test("[AC-3 | spec-hooks-fsa-write-bar | FR-223 | FR-245 | UR-065 | NFR-036] shell write to the governance audit log is denied: " + row[0], () => {
    assertDenied(row[1]);
  });
});

[
  ["cp", "cp /tmp/forged .agent/governance/confirmations/confirmations.jsonl"],
  ["mv", "mv x .agent/governance/confirmations/pending.jsonl"],
].forEach((row) => {
  test("[AC-4 | spec-hooks-fsa-write-bar | FR-223 | FR-245 | UR-075 | NFR-036] shell write to the confirmation store is denied: " + row[0], () => {
    assertDenied(row[1]);
  });
});

test("[AC-5 | spec-hooks-fsa-write-bar | FR-223 | FR-245] shell write to an unprotected path is allowed", () => {
  assertAllowed("echo x >> src/notes.txt");
});

test("[AC-6 | spec-hooks-fsa-write-bar | FR-223 | NFR-028] known limit, not claimed covered: a command built from a variable is allowed", () => {
  // Recorded in FR-NFR-harness-governance.md section 4. The write target is built from a variable at run time.
  assertAllowed('F=DECISIONS.md; echo x >> "$F"');
});

// ---------------------------------------------------------------------------
// Every write form against every protected path (subagent)
// ---------------------------------------------------------------------------

const WRITE_FORMS = [
  ["redirection >", (t) => "echo x > " + t],
  ["append >>", (t) => "echo x >> " + t],
  ["clobber >|", (t) => "echo x >| " + t],
  ["fd redirection 2>", (t) => "ls missing 2> " + t],
  ["fd append 1>>", (t) => "printf y 1>> " + t],
  ["tee", (t) => "echo x | tee " + t],
  ["tee -a", (t) => "echo x | tee -a " + t],
  ["sed -i", (t) => "sed -i 's/a/b/' " + t],
  ["sed -i with a backup suffix", (t) => "sed -i.bak 's/a/b/' " + t],
  ["cp", (t) => "cp /tmp/forged " + t],
  ["mv", (t) => "mv /tmp/forged " + t],
  ["rm", (t) => "rm " + t],
  ["rm -f", (t) => "rm -f " + t],
];

PROTECTED.forEach((target) => {
  WRITE_FORMS.forEach((form) => {
    test("[AC-1 | spec-hooks-fsa-write-bar | FR-223 | FR-245 | NFR-036] a subagent is denied " + form[0] + " into " + target, () => {
      assertDenied(form[1](target));
    });
  });
});

SUBAGENT_TYPES.forEach((agentType) => {
  test("[AC-1 | spec-hooks-fsa-write-bar | FR-223 | UR-064] every kind of subagent is denied a shell append to DECISIONS.md: " + agentType, () => {
    assertDenied("echo approved >> DECISIONS.md", sub(agentType));
  });
});

test("[AC-1 | spec-hooks-fsa-write-bar | FR-222 | UR-064] producer self-approval is blocked on the shell route: a developer appends an approval line to the plan file", () => {
  // spec-orchestration.md Scenario "Producer self-approval blocked", through the Step 15 Bash route.
  assertDenied('echo "- Approved: 2026-11-06 10:00 Writer: developer" >> .agent/main-plan/plan-x.md', sub("assist-plugin:developer"));
});

// ---------------------------------------------------------------------------
// Targets in other shapes: chaining, paths, quoting, nesting
// ---------------------------------------------------------------------------

[
  ["after &&", "ls && echo x >> DECISIONS.md"],
  ["after ;", "true; rm DECISIONS.md"],
  ["after ||", "false || echo x > DECISIONS.md"],
  ["behind a pipe", "cat notes.txt | tee DECISIONS.md"],
  ["inside a subshell", "(echo x >> DECISIONS.md)"],
  ["inside an if", "if true; then echo x > DECISIONS.md; fi"],
  ["on a second line", "ls\necho x >> DECISIONS.md"],
  ["as an absolute path", "echo x >> " + R + "/DECISIONS.md"],
  ["through a dot-dot segment", "echo x >> src/../DECISIONS.md"],
  ["with a leading ./", "echo x >> ./DECISIONS.md"],
  ["with a double-quoted target", 'echo x >> "DECISIONS.md"'],
  ["with a single-quoted target", "echo x >> 'DECISIONS.md'"],
  ["in another case", "echo x >> Decisions.MD"],
  ["as a DECISIONS.md in a subdirectory", "echo x >> docs/DECISIONS.md"],
  ["through a here-document", "cat > DECISIONS.md <<'EOF'\napproved\nEOF"],
  ["after an environment word", "LC_ALL=C sed -i s/a/b/ DECISIONS.md"],
  ["after cd into the protected directory", "cd .agent/main-plan && echo x > plan-x.md"],
  ["to any file under main-plan", "echo x > .agent/main-plan/other-file.md"],
  ["to any file under the governance log directory", "echo x > .agent/logs/governance/audit-000001.jsonl"],
  ["to a glob under main-plan", "echo x > .agent/main-plan/*"],
  ["to a variable name under main-plan", "echo x > .agent/main-plan/$NAME"],
  ["inside bash -c", "bash -c 'echo x >> DECISIONS.md'"],
  ["inside sh -c", 'sh -c "rm DECISIONS.md"'],
  ["inside a command substitution", "echo $(echo x >> DECISIONS.md)"],
  ["through sudo", "sudo tee DECISIONS.md"],
].forEach((row) => {
  test("[AC-1 | spec-hooks-fsa-write-bar | FR-223 | FR-245] a protected target is found " + row[0], () => {
    assertDenied(row[1]);
  });
});

// ---------------------------------------------------------------------------
// cp and mv into a directory, mv of a protected source, rm of a protected ancestor
// ---------------------------------------------------------------------------

[
  ["cp into main-plan with a trailing slash", "cp /tmp/x .agent/main-plan/"],
  ["mv into the governance log directory with a trailing slash", "mv x .agent/logs/governance/"],
  ["cp -t into main-plan", "cp -t .agent/main-plan/ /tmp/x"],
  ["cp several sources into the confirmation store", "cp a b .agent/governance/confirmations/"],
  ["mv several sources into the confirmation store", "mv a b .agent/governance/confirmations/"],
  ["cp of a file named DECISIONS.md into .", "cp docs/DECISIONS.md ."],
  ["cp of a file named DECISIONS.md into ./", "cp /tmp/DECISIONS.md ./"],
  ["mv of a file named DECISIONS.md into the project root", "mv /tmp/DECISIONS.md ./"],
].forEach((row) => {
  test("[AC-4 | spec-hooks-fsa-write-bar | FR-223 | FR-245] the destination directory is judged: " + row[0], () => {
    assertDenied(row[1]);
  });
});

[
  ["mv of DECISIONS.md away", "mv DECISIONS.md /tmp/gone"],
  ["mv of a plan file away", "mv .agent/main-plan/plan-x.md /tmp/"],
  ["mv of the audit log away", "mv .agent/logs/governance/audit.jsonl /tmp/audit.bak"],
].forEach((row) => {
  test("[AC-3 | spec-hooks-fsa-write-bar | FR-223 | FR-245] a move removes its source, so a protected source is a write: " + row[0], () => {
    assertDenied(row[1]);
  });
});

[
  ["rm -rf .agent", "rm -rf .agent"],
  ["rm -rf .agent/", "rm -rf .agent/"],
  ["rm -rf ./.agent", "rm -rf ./.agent"],
  ["rm -r .agent/logs", "rm -r .agent/logs"],
  ["rm -rf .agent/logs/governance", "rm -rf .agent/logs/governance"],
  ["rm -rf .agent/governance", "rm -rf .agent/governance"],
  ["rm -rf .agent/governance/confirmations", "rm -rf .agent/governance/confirmations"],
  ["rm -rf .agent/main-plan", "rm -rf .agent/main-plan"],
  ["rm -rf the absolute .agent", "rm -rf " + R + "/.agent"],
].forEach((row) => {
  test("[AC-3 | spec-hooks-fsa-write-bar | FR-223 | FR-245] removing a directory that holds protected paths is a write: " + row[0], () => {
    assertDenied(row[1]);
  });
});

test("[AC-4 | spec-hooks-fsa-write-bar | FR-223 | FR-245] the destination check reads the file system: cp into an existing protected directory without a trailing slash is denied", () => {
  const root = fx.tempDir("shell-fs-");
  fs.mkdirSync(path.join(root, ".agent", "main-plan"), { recursive: true });
  fs.mkdirSync(path.join(root, ".agent", "logs", "governance"), { recursive: true });
  ["cp /tmp/x .agent/main-plan", "mv x .agent/logs/governance"].forEach((command) => {
    const result = bar.evaluate(bash(command, SUB, { cwd: root }), { roots: [root], findGitRoot: () => root });
    assert.ok(denied(result), "expected deny for: " + command + " -> " + text(result));
  });
});

test("[AC-5 | spec-hooks-fsa-write-bar | FR-223] cp into an existing unprotected directory is allowed", () => {
  const root = fx.tempDir("shell-fs-");
  fs.mkdirSync(path.join(root, "build"), { recursive: true });
  const result = bar.evaluate(bash("cp /tmp/x build", SUB, { cwd: root }), { roots: [root], findGitRoot: () => root });
  assert.ok(!denied(result), text(result));
});

// ---------------------------------------------------------------------------
// Reads and writes to other paths are allowed
// ---------------------------------------------------------------------------

[
  ["cat of DECISIONS.md", "cat DECISIONS.md"],
  ["cat of a plan file", "cat .agent/main-plan/plan-x.md"],
  ["grep in DECISIONS.md", "grep -n approved DECISIONS.md"],
  ["head of the audit log", "head -5 .agent/logs/governance/audit.jsonl"],
  ["tail -f of the audit log", "tail -f .agent/logs/governance/audit.jsonl"],
  ["ls of the governance log directory", "ls -la .agent/logs/governance/"],
  ["wc of DECISIONS.md", "wc -l DECISIONS.md"],
  ["sed without -i", "sed -n '1,5p' DECISIONS.md"],
  ["jq of the confirmation store", "jq . .agent/governance/confirmations/confirmations.jsonl"],
  ["diff of DECISIONS.md", "diff DECISIONS.md /tmp/old.md"],
  ["input redirection from DECISIONS.md", "wc -l < DECISIONS.md"],
  ["cp with DECISIONS.md as the source", "cp DECISIONS.md /tmp/backup.md"],
  ["output of a read sent to an unprotected file", "cat DECISIONS.md > /tmp/out.txt"],
  ["output of a read piped to tee of an unprotected file", "cat DECISIONS.md | tee /tmp/out.txt"],
  ["grep piped into an unprotected file", "grep approved DECISIONS.md | sort > notes.txt"],
].forEach((row) => {
  test("[AC-2 | spec-hooks-fsa-write-bar | FR-223 | FR-245] a read of a protected path is allowed: " + row[0], () => {
    assertAllowed(row[1]);
  });
});

[
  ["redirection to a source file", "echo x > src/app.js"],
  ["append to a notes file", "echo x >> src/notes.txt"],
  ["tee to a build log", "npm test | tee build.log"],
  ["sed -i on a source file", "sed -i 's/a/b/' src/app.js"],
  ["cp of one file", "cp a.txt b.txt"],
  ["mv of one file", "mv a.txt b.txt"],
  ["rm of a temp file", "rm tmp.txt"],
  ["rm -rf node_modules", "rm -rf node_modules"],
  ["rm -rf a build directory", "rm -rf build"],
  ["rm -rf .agent/clarify", "rm -rf .agent/clarify"],
  ["a name that only resembles main-plan", "echo x > .agent/main-plan.md"],
  ["a name that only resembles DECISIONS.md", "echo x >> docs/DECISIONS.md.bak"],
  ["a name that contains DECISIONS", "echo x >> NOT-DECISIONS.md"],
  ["a log directory beside governance", "echo x >> .agent/logs/other/app.log"],
  ["a near-miss confirmation path", "echo x > .agent/governance/confirmations.jsonl"],
  ["the protected name only inside an echoed string", 'echo "DECISIONS.md" > notes.txt'],
  ["the protected name as an argument of echo", "echo DECISIONS.md"],
  ["a redirection written inside a quoted string", 'echo "x >> DECISIONS.md" > notes.txt'],
  ["git status", "git status"],
  ["npm test", "npm test"],
  ["an empty command", ""],
  ["a blank command", "   "],
].forEach((row) => {
  test("[AC-5 | spec-hooks-fsa-write-bar | FR-223 | FR-245] a command that writes no protected path is allowed: " + row[0], () => {
    assertAllowed(row[1]);
  });
});

// ---------------------------------------------------------------------------
// Scope: main session, role limits, other tools
// ---------------------------------------------------------------------------

WRITE_FORMS.forEach((form) => {
  test("[Requirement: Scope of the bar | spec-hooks-fsa-write-bar | FR-223 | FR-245] the main session is not judged on the shell route: " + form[0] + " into DECISIONS.md", () => {
    assertAllowed(form[1]("DECISIONS.md"), MAIN);
  });
});

test("[Requirement: Scope of the bar | spec-hooks-fsa-write-bar | FR-112 | FR-223] a main session started with a non-plugin --agent (agent_type, no agent_id) is a main session on the shell route", () => {
  assertAllowed("echo x >> DECISIONS.md", { agent_type: "my-main-agent" });
});

test("[Requirement: Scope of the bar | spec-hooks-fsa-write-bar | FR-223] a role-limited agent's Bash write to a non-protected path is allowed: the test-path limit judges the four write tools only", () => {
  assertAllowed("echo x > src/app.ts", sub("assist-plugin:developer-tester"));
  assertAllowed("echo x > tests/a.test.js", sub("assist-plugin:developer"));
  assertAllowed("echo x > README.md", sub("assist-plugin:task-planner"));
  assertAllowed("echo x > .claude/settings.local.json", sub("assist-plugin:requirements-gatherer"));
});

test("[AC-5 | spec-hooks-fsa-write-bar | FR-223] only the Bash tool is judged on this route: other tools carrying a command field are not", () => {
  ["Read", "Grep", "Glob", "Task", "WebFetch"].forEach((tool) => {
    const result = bar.evaluate(
      Object.assign(bash("echo x >> DECISIONS.md", SUB), { tool_name: tool }),
      { roots: [R], findGitRoot: () => R }
    );
    assert.ok(!denied(result), tool + " -> " + text(result));
  });
});

// ---------------------------------------------------------------------------
// Known limits, recorded and not closed: asserted as NOT claimed covered
// ---------------------------------------------------------------------------

[
  ["a command string run by python", "python3 -c \"open('DECISIONS.md', 'a').write('x')\""],
  ["a command string run by node", "node -e \"require('fs').appendFileSync('DECISIONS.md', 'x')\""],
  ["a command string run by awk", "awk 'BEGIN { print \"x\" > \"DECISIONS.md\" }'"],
  ["git checkout of the file", "git checkout -- DECISIONS.md"],
  ["rsync onto the file", "rsync -a /tmp/forged DECISIONS.md"],
  ["a command built from a variable in the program position", "CMD=rm; $CMD DECISIONS.md"],
  ["a target taken only from a variable", 'OUT=DECISIONS.md; echo x > "$OUT"'],
].forEach((row) => {
  test("[AC-6 | spec-hooks-fsa-write-bar | FR-223 | NFR-028] known limit, not claimed covered: " + row[0], () => {
    // These forms are recorded in FR-NFR-harness-governance.md section 4 as not closed. The test pins the stated
    // boundary so that nobody reads this route as a guarantee. A later tranche that closes one of them changes this test.
    assertAllowed(row[1]);
  });
});

[
  ["Set-Content", "Set-Content -Path DECISIONS.md -Value x"],
  ["Out-File", "'x' | Out-File -FilePath .agent/main-plan/plan-x.md"],
  ["Move-Item", "Move-Item x DECISIONS.md"],
  ["Add-Content", "Add-Content .agent/logs/governance/audit.jsonl y"],
].forEach((row) => {
  test("[AC-6 | spec-hooks-fsa-write-bar | FR-223] known limit, not claimed covered: the PowerShell write verb " + row[0] + " is not seen", () => {
    const result = bar.evaluate(
      Object.assign(bash(row[1], SUB), { tool_name: "PowerShell" }),
      { roots: [R], findGitRoot: () => R }
    );
    assert.ok(!denied(result), text(result));
  });
});

test("[AC-6 | spec-hooks-fsa-write-bar | FR-223 | FR-245] known limit, not claimed covered: a symlink to a protected file is not resolved", (t) => {
  const root = fx.tempDir("shell-symlink-");
  fs.writeFileSync(path.join(root, "DECISIONS.md"), "# decisions\n");
  try {
    fs.symlinkSync(path.join(root, "DECISIONS.md"), path.join(root, "shortcut.md"));
  } catch (err) {
    t.skip("symlinks cannot be created here");
    return;
  }
  const result = bar.evaluate(bash("echo x >> shortcut.md", SUB, { cwd: root }), { roots: [root], findGitRoot: () => root });
  assert.ok(!denied(result), text(result));
});

// ---------------------------------------------------------------------------
// Fail closed (NFR-028): guardedClass and the command entry
// ---------------------------------------------------------------------------

[
  "echo x >> DECISIONS.md",
  "sed -i 's/a/b/' .agent/main-plan/plan-x.md",
  "tee -a .agent/logs/governance/audit.jsonl",
  "cp /tmp/forged .agent/governance/confirmations/confirmations.jsonl",
  "mv x .agent/governance/confirmations/pending.jsonl",
].forEach((command) => {
  test("[AC-1 | spec-hooks-fsa-write-bar | NFR-028 | FR-223] guardedClass puts a subagent Bash command that names a protected path in the guarded class: " + command, () => {
    assert.strictEqual(bar.guardedClass(bash(command, SUB)), true);
  });
});

[
  ["the main session", () => bash("echo x >> DECISIONS.md", MAIN)],
  ["a Write tool call", () => Object.assign(bash("echo x >> DECISIONS.md", SUB), { tool_name: "Write" })],
  ["a command that names no protected path", () => bash("ls -la", SUB)],
  ["a build command", () => bash("npm test", SUB)],
  ["a missing command", () => ({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {}, cwd: R, agent_id: "a-1" })],
  ["a numeric command", () => bash(12345, SUB)],
  ["a null command", () => bash(null, SUB)],
  ["an object command", () => bash({ nested: "DECISIONS.md" }, SUB)],
  ["null input", () => null],
  ["undefined input", () => undefined],
  ["a string input", () => "Bash"],
].forEach((row) => {
  test("[AC-5 | spec-hooks-fsa-write-bar | NFR-028] guardedClass leaves " + row[0] + " outside the guarded class and never throws", () => {
    let value;
    assert.doesNotThrow(() => {
      value = bar.guardedClass(row[1]());
    });
    assert.strictEqual(value, false);
  });
});

function entryDoc(root, command, caller) {
  return Object.assign(
    { hook_event_name: "PreToolUse", session_id: "sess-1", tool_name: "Bash", tool_input: { command: command }, cwd: root },
    caller || {}
  );
}

function entryDecision(res) {
  if (res.stdout.trim() === "") return null;
  const out = JSON.parse(res.stdout);
  return out.hookSpecificOutput;
}

test("[AC-1 | spec-hooks-fsa-write-bar | FR-223 | NFR-028] the command entry denies a subagent shell append to DECISIONS.md with the deny JSON and exit 0", () => {
  const root = fx.tempRoot("shell-entry-");
  const res = fx.runHook("fsa-write-bar", entryDoc(root, 'echo "approved" >> DECISIONS.md', SUB));
  assert.strictEqual(res.status, 0, res.stderr);
  const decision = entryDecision(res);
  assert.ok(decision, "a decision was printed");
  assert.strictEqual(decision.hookEventName, "PreToolUse");
  assert.strictEqual(decision.permissionDecision, "deny");
  assert.ok(/DECISIONS\.md/.test(decision.permissionDecisionReason), decision.permissionDecisionReason);
});

test("[AC-2 | spec-hooks-fsa-write-bar | FR-223] the command entry prints nothing for a subagent shell read of DECISIONS.md", () => {
  const root = fx.tempRoot("shell-entry-");
  const res = fx.runHook("fsa-write-bar", entryDoc(root, "cat DECISIONS.md", SUB));
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(res.stdout, "");
});

test("[AC-5 | spec-hooks-fsa-write-bar | FR-223] the command entry prints nothing for the main session's shell append to DECISIONS.md", () => {
  const root = fx.tempRoot("shell-entry-");
  const res = fx.runHook("fsa-write-bar", entryDoc(root, "echo x >> DECISIONS.md", MAIN));
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(res.stdout, "");
});

test("[AC-3 | spec-hooks-fsa-write-bar | FR-245 | UR-065] the command entry denies a subagent shell write to the audit log", () => {
  const root = fx.tempRoot("shell-entry-");
  const res = fx.runHook("fsa-write-bar", entryDoc(root, "rm .agent/logs/governance/audit.jsonl", sub("assist-plugin:qa")));
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(entryDecision(res).permissionDecision, "deny");
});

[
  ["a numeric command", { command: 12345 }],
  ["a null command", { command: null }],
  ["no command", {}],
  ["an array command", { command: ["echo", "x"] }],
].forEach((row) => {
  test("[AC-5 | spec-hooks-fsa-write-bar | NFR-028 | NFR-009] the command entry exits 0 and denies nothing for " + row[0], () => {
    const root = fx.tempRoot("shell-entry-");
    const doc = entryDoc(root, "unused", SUB);
    doc.tool_input = row[1];
    const res = fx.runHook("fsa-write-bar", doc);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(res.stdout.indexOf('"deny"') === -1, res.stdout);
  });
});

[
  ["text that is not JSON", "this is not json"],
  ["an empty document", ""],
].forEach((row) => {
  test("[AC-5 | spec-hooks-fsa-write-bar | NFR-028] an input that cannot be parsed proceeds: " + row[0], () => {
    // The fail-closed branch applies only after the input was parsed.
    const res = fx.runHook("fsa-write-bar", row[1]);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(res.stdout.indexOf('"deny"') === -1, res.stdout);
  });
});

test("[AC-1 | spec-hooks-fsa-write-bar | NFR-028 | FR-223] fail closed: when the Bash judge throws on a subagent command that names a protected path, the runtime denies with the deny JSON and exit 0", () => {
  const root = fx.tempRoot("shell-fault-");
  const res = fx.runWithShellFault(entryDoc(root, "echo x >> DECISIONS.md", SUB));
  assert.strictEqual(res.status, 0, "never a non-zero exit; stderr: " + res.stderr);
  const decision = entryDecision(res);
  assert.ok(decision, "a decision was printed: " + res.stdout);
  assert.strictEqual(decision.permissionDecision, "deny");
});

test("[AC-1 | spec-hooks-fsa-write-bar | NFR-028 | FR-223] fail closed applies to the audit log, the confirmation store, and the plan files too", () => {
  const root = fx.tempRoot("shell-fault-");
  [
    "tee -a .agent/logs/governance/audit.jsonl",
    "cp /tmp/forged .agent/governance/confirmations/confirmations.jsonl",
    "sed -i s/a/b/ .agent/main-plan/plan-x.md",
  ].forEach((command) => {
    const res = fx.runWithShellFault(entryDoc(root, command, SUB));
    assert.strictEqual(res.status, 0, res.stderr);
    assert.strictEqual(entryDecision(res).permissionDecision, "deny", command);
  });
});

test("[AC-5 | spec-hooks-fsa-write-bar | NFR-028] fail open outside the guarded class: when the Bash judge throws on a command that names no protected path, the command proceeds", () => {
  const root = fx.tempRoot("shell-fault-");
  const res = fx.runWithShellFault(entryDoc(root, "ls -la src", SUB));
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.indexOf('"deny"') === -1, res.stdout);
});

test("[AC-5 | spec-hooks-fsa-write-bar | NFR-028] fail open for the main session: a thrown judge does not deny the main session's command", () => {
  const root = fx.tempRoot("shell-fault-");
  const res = fx.runWithShellFault(entryDoc(root, "echo x >> DECISIONS.md", MAIN));
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.indexOf('"deny"') === -1, res.stdout);
});

test("[AC-1 | spec-hooks-fsa-write-bar | NFR-028 | FR-223] a command too long to read, and naming a protected path, is denied", () => {
  const limit = typeof shellWrites.MAX_COMMAND_CHARS === "number" ? shellWrites.MAX_COMMAND_CHARS : 100000;
  assertDenied("echo " + "a".repeat(limit + 10) + " >> DECISIONS.md");
});

test("[AC-1 | spec-hooks-fsa-write-bar | NFR-028 | FR-223] a command nested too deeply to read, and naming a protected path, is denied", () => {
  const depth = (typeof shellWrites.MAX_DEPTH === "number" ? shellWrites.MAX_DEPTH : 20) + 10;
  assertDenied("echo " + "$(echo ".repeat(depth) + "x" + ")".repeat(depth) + " >> DECISIONS.md");
});
