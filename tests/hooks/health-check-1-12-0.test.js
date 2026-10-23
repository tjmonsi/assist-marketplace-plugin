// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the health check changes of release 1.12.0
// (plugins/assist-plugin/hooks/impl/health-check.js and the command
// plugins/assist-plugin/hooks/health-check.js), plus the guard test options of
// specs/spec-hooks-platform.md (Requirement: Guard decision and deny output).
//
// Sources: specs/spec-hooks-health-check.md (Change Log 2026-10-16 and 2026-10-17: Requirement:
// Self-tests, Auto-disable and re-enable, Session-start notice, with every Scenario cited by
// title below), specs/spec-hooks-writing-context.md (Change Log 2026-10-16, Requirement:
// Self-test coverage), specs/spec-hooks-platform.md (Change Log 2026-10-16, Requirement: Guard
// decision and deny output, Scenarios "Reads a test can replace" and "Git walk replaced in a
// test"), specs/spec-hooks-bash-guards.md (Scenario "Self-test case without a git-root stub"),
// docs/requirements/FR-NFR-assist-plugin.md (FR-118, FR-091, FR-088, FR-107). Decisions:
// DECISIONS.md lines 168-171 and 198-201.
// Task plan step 33. The Scenario "Wording in the rule file" belongs to step 37 (docs tests).
// Follow-up to 1.12.0 (task plan step 22): the GUARDS list test names ten hooks, with pr-post-ask
// added (specs/spec-hooks-health-check.md, Change Log 2026-10-22, Requirement: Self-tests). The
// pr-post-ask self-test itself is covered in tests/hooks/health-check-pr-post-ask.test.js.
//
// Traceability format: [Scenario title | spec section | FR ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// Public interface used:
//   module exports of impl/health-check.js: GUARDS (array of {name, evaluate(input), allow[],
//     deny[], reportOnly?}), WRITING_CONTEXT_SILENT, WRITING_CONTEXT_CONTEXT, selfTest(guard) ->
//     {ok, falseDeny[], falseAllow[], errors[], allowCount, denyCount}, main()
//   module exports of impl/writing-context.js: HEADER, evaluate(input, options)
//   commit-attribution-guard evaluate(input, {readFile}) and fsa-write-bar evaluate(input,
//     {roots, findGitRoot}) from the platform spec
//   the command `node hooks/health-check.js [--session-start] [--data-dir DIR]` and its output:
//     session start prints {"systemMessage": "assist-plugin health: <problems joined by '; '>.
//     Run /assist-plugin:health for details."} or nothing; report mode prints plain text.
//   injection-filter corpus entries are wrappers {tool_name: "InjectionFilter", label, hook: {...}}
//     for the end-to-end cases; the hook input sits under `.hook`.
//
// Child-process cases run in a scratch copy of plugins/assist-plugin (as
// tests/scripts/check-fsa-tables.test.js does), always with a temporary CLAUDE_PLUGIN_DATA and
// with CLAUDE_PLUGIN_ROOT either unset or set to the copy, so writing-context reads the copy and
// not an installed plugin. Fault injection edits no hook file: it mutates the exported GUARDS in
// a wrapper script, or replaces the exported writing-context evaluate inside this process.
//
// Run: node --test tests/hooks/health-check-1-12-0.test.js

"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const IMPL = path.join(PLUGIN, "hooks", "impl");
const hc = require(path.join(IMPL, "health-check.js"));
const writingContext = require(path.join(IMPL, "writing-context.js"));
const commitGuard = require(path.join(IMPL, "commit-attribution-guard.js"));
const writeBar = require(path.join(IMPL, "fsa-write-bar.js"));

const SPEC = "spec-hooks-health-check.md";
const PLATFORM = "spec-hooks-platform.md";
const STANDARD = path.join("rules", "writing-standard-compact.md");
const NOTICE_TAIL = ". Run /assist-plugin:health for details.";

// ---------------------------------------------------------------------------
// Environment isolation and scratch space
// ---------------------------------------------------------------------------

const savedEnv = {};
const scratch = [];
let pristineCopy = null; // scratch copy of the plugin, untouched
let noStandardCopy = null; // scratch copy without rules/writing-standard-compact.md
let wrapperDir = null;

function tempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

function copyPlugin(into) {
  const dest = path.join(into, "assist-plugin");
  fs.cpSync(PLUGIN, dest, {
    recursive: true,
    filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src),
  });
  return dest;
}

// The wrapper requires the copy's health-check.js, injects one fault into the exported GUARDS, sets
// the arguments, and calls main(). It is written to a separate temp directory, never into the copy.
const WRAPPER_SOURCE = [
  '"use strict";',
  "const hc = require(process.env.HC_PATH);",
  "const guard = hc.GUARDS.find((g) => g.name === process.env.FAULT_GUARD);",
  'if (!guard) { console.error("no guard named " + process.env.FAULT_GUARD); process.exit(3); }',
  '(process.env.FAULT_KINDS || "").split(",").filter(Boolean).forEach((kind) => {',
  '  if (kind === "false-allow") {',
  "    // a known-safe command placed in the deny corpus: the guard allows it, so it is a false allow",
  '    guard.deny.push({ tool_name: "Bash", label: "fault: known-safe command listed as prohibited", tool_input: { command: "git status" } });',
  '  } else if (kind === "throw") {',
  "    // reading tool_input throws inside evaluate; the label keeps the self-test from reading the getter",
  '    guard.deny.push({ tool_name: "Bash", label: "fault: throwing case", get tool_input() { throw new Error("fault: tool_input read"); } });',
  '  } else if (kind === "silent-flagged") {',
  "    // a context case placed in the silent corpus: the hook answers with context, so it is a false deny",
  "    guard.allow.push(guard.deny[0]);",
  '  } else if (kind === "stubless") {',
  "    // a cwd without a findGitRoot function",
  '    guard.allow.push({ tool_name: "Bash", agent_type: "solutions-architect", cwd: "/assist-selftest/project", label: "fault: stubless absolute path", tool_input: { command: "mmdc -i /assist-selftest/project/specs/a.mmd -o /assist-selftest/project/specs/a.png" } });',
  "  }",
  "});",
  'process.argv = [process.argv[0], process.argv[1]].concat(process.env.FAULT_ARGS ? process.env.FAULT_ARGS.split(" ") : []);',
  "hc.main();",
  "",
].join("\n");

before(() => {
  ["CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA", "CLAUDE_PLUGIN_ROOT"].forEach((k) => {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  });
  pristineCopy = copyPlugin(tempDir("hc-1-12-0-pristine-"));
  noStandardCopy = copyPlugin(tempDir("hc-1-12-0-nostd-"));
  fs.rmSync(path.join(noStandardCopy, STANDARD), { force: true });
  wrapperDir = tempDir("hc-1-12-0-wrapper-");
  fs.writeFileSync(path.join(wrapperDir, "fault-run.js"), WRAPPER_SOURCE);
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

function onlyCases(g, allow, deny) {
  return Object.assign({}, g, { allow: allow, deny: deny });
}

function describeError(e) {
  if (typeof e === "string") return e;
  const parts = [String(e)];
  if (e && typeof e === "object") {
    ["label", "case", "name", "message", "error", "reason"].forEach((k) => {
      if (e[k] !== undefined) parts.push(e[k] && e[k].message ? e[k].message : String(e[k]));
    });
    try {
      parts.push(JSON.stringify(e));
    } catch (err) {
      /* a circular value adds nothing */
    }
  }
  return parts.join(" | ");
}

function cleanEnv(extra) {
  const env = Object.assign({}, process.env);
  ["CLAUDE_PLUGIN_ROOT", "CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA"].forEach((k) => delete env[k]);
  return Object.assign(env, extra || {});
}

// Runs the copy's (or the real tree's) health-check command.
function runHealth(pluginDir, args, extraEnv) {
  return childProcess.spawnSync(process.execPath, [path.join(pluginDir, "hooks", "health-check.js")].concat(args), {
    cwd: tempDir("hc-1-12-0-cwd-"),
    env: cleanEnv(Object.assign({ CLAUDE_CONFIG_DIR: tempDir("hc-1-12-0-claude-") }, extraEnv)),
    encoding: "utf8",
    timeout: 60000,
  });
}

// Runs the wrapper against the copy's health-check.js module.
function runFault(pluginDir, guardName, kinds, args, extraEnv) {
  return childProcess.spawnSync(process.execPath, [path.join(wrapperDir, "fault-run.js")], {
    cwd: tempDir("hc-1-12-0-cwd-"),
    env: cleanEnv(
      Object.assign(
        {
          HC_PATH: path.join(pluginDir, "hooks", "impl", "health-check.js"),
          FAULT_GUARD: guardName,
          FAULT_KINDS: kinds.join(","),
          FAULT_ARGS: args || "",
          CLAUDE_CONFIG_DIR: tempDir("hc-1-12-0-claude-"),
        },
        extraEnv
      )
    ),
    encoding: "utf8",
    timeout: 60000,
  });
}

function writeDisabled(dataDir, names) {
  const entries = {};
  names.forEach((n) => {
    entries[n] = { reason: "self-test: test fixture", ts: "2026-10-16T00:00:00.000Z" };
  });
  fs.writeFileSync(path.join(dataDir, "hooks-disabled.json"), JSON.stringify(entries));
}

function readDisabled(dataDir) {
  const file = path.join(dataDir, "hooks-disabled.json");
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function notice(res) {
  assert.strictEqual(res.status, 0, "exit 0; stderr: " + res.stderr);
  assert.notStrictEqual(res.stdout.trim(), "", "a session-start notice was printed");
  const out = JSON.parse(res.stdout);
  assert.strictEqual(typeof out.systemMessage, "string");
  return out.systemMessage;
}

function slashes(p) {
  return String(p).replace(/\\/g, "/");
}

// ---------------------------------------------------------------------------
// Corpus sizes
// ---------------------------------------------------------------------------

const SIZES = [
  ["doc-cli-guard", 16, 23],
  ["sa-mermaid-only", 16, 28],
  ["injection-filter", 23, 36],
  ["writing-context", 3, 3],
  ["commit-attribution-guard", 17, 22],
  ["prose-gate", 32, 31],
  ["prose-advisor", 11, 10],
  ["fsa-write-bar", 51, 106],
];

test("[Scenario: All pass (ten self-tested hooks) | " + SPEC + " Self-tests (Change Log 2026-10-16 and 2026-10-22) | FR-118 FR-206] GUARDS lists the ten hooks, the nine of 1.12.0 and pr-post-ask", () => {
  const names = hc.GUARDS.map((g) => g.name).sort();
  assert.deepStrictEqual(names, [
    "commit-attribution-guard",
    "doc-cli-guard",
    "fsa-log",
    "fsa-write-bar",
    "injection-filter",
    "pr-post-ask",
    "prose-advisor",
    "prose-gate",
    "sa-mermaid-only",
    "writing-context",
  ]);
});

SIZES.forEach((row) => {
  const name = row[0], allowCount = row[1], denyCount = row[2];
  test("[Requirement: Self-tests, corpus sizes | " + SPEC + " (Change Log 2026-10-16 and 2026-10-17) | FR-118 FR-093 FR-094 FR-099] " + name + " has " + allowCount + " allow and " + denyCount + " deny cases", () => {
    const g = guard(name);
    assert.strictEqual(g.allow.length, allowCount, name + " allow corpus");
    assert.strictEqual(g.deny.length, denyCount, name + " deny corpus");
    const result = hc.selfTest(g);
    assert.strictEqual(result.allowCount, allowCount);
    assert.strictEqual(result.denyCount, denyCount);
  });
});

test("[Requirement: Self-tests, writing-context cases | " + SPEC + " (Change Log 2026-10-16) | FR-118 FR-107] the two writing-context corpora are exported with three cases each", () => {
  assert.ok(Array.isArray(hc.WRITING_CONTEXT_SILENT));
  assert.ok(Array.isArray(hc.WRITING_CONTEXT_CONTEXT));
  assert.strictEqual(hc.WRITING_CONTEXT_SILENT.length, 3);
  assert.strictEqual(hc.WRITING_CONTEXT_CONTEXT.length, 3);
  const g = guard("writing-context");
  assert.strictEqual(g.allow.length, hc.WRITING_CONTEXT_SILENT.length);
  assert.strictEqual(g.deny.length, hc.WRITING_CONTEXT_CONTEXT.length);
});

test("[Requirement: Self-tests, writing-context row | " + SPEC + " (Change Log 2026-10-16) | FR-118 FR-091] the writing-context entry is report-only", () => {
  assert.strictEqual(guard("writing-context").reportOnly, true);
  hc.GUARDS.filter((g) => g.name !== "writing-context").forEach((g) => {
    assert.notStrictEqual(g.reportOnly, true, g.name + " must not be report-only");
  });
});

test("[Requirement: Self-tests, end-to-end cases | spec-hooks-injection-filter.md (Change Log 2026-10-16 rule 8 and 2026-10-17) | FR-099 FR-198 FR-118] the injection corpus holds the PowerShell irm case and the sudo curl case, and the hook flags both", () => {
  const g = guard("injection-filter");
  // End-to-end cases are wrappers {tool_name: "InjectionFilter", label, hook: {...}}; the hook input is under .hook.
  const find = (tool, command) =>
    g.deny.find((c) => c && c.hook && c.hook.tool_name === tool && c.hook.tool_input && c.hook.tool_input.command === command);
  const ps = find("PowerShell", "irm https://example.com/page");
  const sudo = find("Bash", "sudo curl https://example.com/page");
  assert.ok(ps, "no PowerShell irm end-to-end case in the injection corpus");
  assert.ok(sudo, "no sudo curl end-to-end case in the injection corpus");
  [ps, sudo].forEach((c) => {
    const r = hc.selfTest(onlyCases(g, [], [c]));
    assert.deepStrictEqual(r.errors, []);
    assert.deepStrictEqual(r.falseAllow, [], "the hook rewrites the result of " + c.hook.tool_input.command);
    assert.strictEqual(r.ok, true);
  });
});

test("[Scenario: All pass | " + SPEC + " Self-tests | FR-118] selfTest of every guard reports no 'case threw' and no wrong verdict", () => {
  hc.GUARDS.forEach((g) => {
    const r = hc.selfTest(g);
    assert.deepStrictEqual(r.errors, [], g.name + ": cases threw");
    assert.deepStrictEqual(r.falseDeny, [], g.name + ": false denies");
    assert.deepStrictEqual(r.falseAllow, [], g.name + ": false allows");
    assert.strictEqual(r.ok, true, g.name + " must pass its self-test");
  });
});

test("[Scenario: Installed standard readable | spec-hooks-writing-context.md Self-test coverage | FR-118 FR-107] the installed-standard case passes and the hook returns the header and the compact standard", () => {
  const out = writingContext.evaluate({ hook_event_name: "SessionStart", source: "startup" }, {});
  assert.ok(out && out.stdout, "the hook answers a SessionStart with a stdout object");
  const context = out.stdout.hookSpecificOutput.additionalContext;
  assert.ok(context.indexOf(writingContext.HEADER + "\n") === 0, "context starts with HEADER and a line break");
  assert.ok(context.length > writingContext.HEADER.length + 1, "context is longer than the header");
  const r = hc.selfTest(guard("writing-context"));
  assert.strictEqual(r.ok, true);
});

// ---------------------------------------------------------------------------
// Test options that replace file-system reads (FR-088)
// ---------------------------------------------------------------------------

test("[Scenario: Reads a test can replace | " + PLATFORM + " Guard decision and deny output (Change Log 2026-10-16) | FR-088] commit-attribution-guard denies from a message the test reader returns, and writes no file", () => {
  const cwd = "/assist-selftest/reads-a-test-can-replace";
  const message = "feat: add login\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n";
  const reader = (p) => (slashes(p) === cwd + "/msg.txt" ? message : null);
  const input = { hook_event_name: "PreToolUse", tool_name: "Bash", cwd: cwd, tool_input: { command: "git commit -F msg.txt" } };
  const result = commitGuard.evaluate(input, { readFile: reader });
  assert.ok(result && result.deny === true, "the reader's text is judged and denied");
  assert.ok(!fs.existsSync(cwd), "evaluate wrote no file under the made-up cwd");
});

test("[Scenario: Reads a test can replace (counter-case) | " + PLATFORM + " Guard decision and deny output (Change Log 2026-10-16) | FR-088] a reader that returns a message without attribution does not deny", () => {
  const cwd = "/assist-selftest/reads-a-test-can-replace";
  const reader = (p) => (slashes(p) === cwd + "/msg.txt" ? "feat: add login\n" : null);
  const input = { hook_event_name: "PreToolUse", tool_name: "Bash", cwd: cwd, tool_input: { command: "git commit -F msg.txt" } };
  const result = commitGuard.evaluate(input, { readFile: reader });
  assert.ok(!(result && result.deny === true));
});

test("[Scenario: Git walk replaced in a test | " + PLATFORM + " Guard decision and deny output (Change Log 2026-10-16) | FR-088 FR-186] fsa-write-bar allows a task-plan write when the test finder returns the repo, with neither directory on disk", () => {
  const repo = "/assist-selftest/git-walk-replaced";
  const input = {
    hook_event_name: "PreToolUse",
    tool_name: "Write",
    agent_type: "assist-plugin:task-planner",
    cwd: repo + "/src",
    tool_input: { file_path: repo + "/docs/task-plans/task-plan-x.md", content: "x" },
  };
  const result = writeBar.evaluate(input, { roots: [repo + "/src"], findGitRoot: () => repo });
  assert.ok(!(result && result.deny === true), "allowed through the stub root");
  assert.ok(!fs.existsSync(repo), "no directory was created");
  // Control: the same write is outside a root that the finder places at the session directory.
  const outside = writeBar.evaluate(input, { roots: [repo + "/src"], findGitRoot: () => repo + "/src" });
  assert.ok(outside && outside.deny === true, "the finder decides the root");
});

// ---------------------------------------------------------------------------
// sa-mermaid-only: a case with a cwd and no findGitRoot function throws
// ---------------------------------------------------------------------------

const SA_ROOT = "/assist-selftest/project";
const SA_COMMAND = "mmdc -i " + SA_ROOT + "/specs/a.mmd -o " + SA_ROOT + "/specs/a.png";

function saCase(over) {
  return Object.assign(
    { tool_name: "Bash", agent_type: "solutions-architect", cwd: SA_ROOT, label: "test: absolute path with a cwd", tool_input: { command: SA_COMMAND } },
    over || {}
  );
}

test("[Scenario: Self-test case without a git-root stub | spec-hooks-bash-guards.md Mermaid guard paths (Change Log 2026-10-16) | FR-093 FR-118 FR-088] the sa-mermaid-only wrapper throws, naming the case, for a cwd with no findGitRoot function", () => {
  const bad = saCase();
  assert.throws(
    () => guard("sa-mermaid-only").evaluate(bad),
    (err) => err instanceof Error && err.message.indexOf("test: absolute path with a cwd") !== -1
  );
});

test("[Scenario: Self-test case without a git-root stub | spec-hooks-bash-guards.md Mermaid guard paths (Change Log 2026-10-16) | FR-093 FR-118] a findGitRoot that is not a function also makes the wrapper throw", () => {
  assert.throws(() => guard("sa-mermaid-only").evaluate(saCase({ findGitRoot: SA_ROOT })));
});

test("[Scenario: Self-test case without a git-root stub | spec-hooks-bash-guards.md Mermaid guard paths (Change Log 2026-10-16) | FR-093 FR-118 FR-091] selfTest lists the stub-less case under 'case threw', FAIL, with no false deny and no false allow", () => {
  const r = hc.selfTest(onlyCases(guard("sa-mermaid-only"), [saCase()], []));
  assert.strictEqual(r.errors.length, 1);
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(r.falseDeny, [], "a thrown case is not a false deny");
  assert.deepStrictEqual(r.falseAllow, []);
});

test("[Scenario: Self-test case without a git-root stub (counter-case) | spec-hooks-bash-guards.md Mermaid guard paths (Change Log 2026-10-16) | FR-093 FR-118] the same case with a stub function is judged, and a case with no cwd needs no stub", () => {
  const g = guard("sa-mermaid-only");
  let decision;
  assert.doesNotThrow(() => {
    decision = g.evaluate(saCase({ findGitRoot: () => SA_ROOT }));
  });
  assert.ok(!(decision && decision.deny === true), "the absolute path under the stub root is allowed");
  const noCwd = saCase();
  delete noCwd.cwd;
  assert.doesNotThrow(() => {
    decision = g.evaluate(noCwd);
  });
  assert.strictEqual(decision && decision.deny, true, "an absolute path with no cwd is denied");
});

test("[Scenario: Self-test case without a git-root stub | spec-hooks-bash-guards.md Mermaid guard paths (Change Log 2026-10-16) | FR-093 FR-118] every sa-mermaid-only corpus case that has a cwd carries a findGitRoot function", () => {
  const g = guard("sa-mermaid-only");
  g.allow.concat(g.deny).forEach((c, i) => {
    if (c && c.cwd !== undefined) assert.strictEqual(typeof c.findGitRoot, "function", "case " + (c.label || "#" + i) + " has a cwd and no findGitRoot function");
  });
});

// ---------------------------------------------------------------------------
// writing-context: wrong content throws with the condition named
// ---------------------------------------------------------------------------

function withPatchedWritingContext(make, fn) {
  const original = writingContext.evaluate;
  writingContext.evaluate = make(original);
  try {
    return fn();
  } finally {
    writingContext.evaluate = original;
  }
}

test("[Scenario: Right stdout presence, wrong content | " + SPEC + " Self-tests (Change Log 2026-10-16) | FR-118 FR-107] a SubagentStart answer with hookEventName SessionStart throws an Error naming the case and the condition hookEventName SubagentStart", () => {
  const faulty = (original) =>
    function (input, options) {
      if (input && input.hook_event_name === "SubagentStart") {
        return original(Object.assign({}, input, { hook_event_name: "SessionStart" }), options);
      }
      return original(input, options);
    };
  withPatchedWritingContext(faulty, () => {
    const g = guard("writing-context");
    const subagent = g.deny.find((c) => c && c.label === "SubagentStart");
    assert.ok(subagent, "the writing-context context corpus has a case labelled SubagentStart");
    assert.throws(
      () => g.evaluate(subagent),
      (err) => err instanceof Error && err.message.indexOf("SubagentStart") !== -1 && err.message.indexOf("hookEventName SubagentStart") !== -1
    );
    const r = hc.selfTest(g);
    assert.ok(r.errors.length >= 1, "the report lists the case under 'case threw'");
    assert.ok(r.errors.some((e) => describeError(e).indexOf("hookEventName SubagentStart") !== -1), "the thrown error names the condition");
    assert.strictEqual(r.ok, false);
    assert.deepStrictEqual(r.falseDeny, []);
    assert.deepStrictEqual(r.falseAllow, []);
  });
});

test("[Scenario: Writing-context case throws | " + SPEC + " Self-tests (Change Log 2026-10-16) | FR-118 FR-107] a context longer than 10,000 characters makes the over-the-cap case throw and the self-test FAIL", () => {
  const faulty = (original) =>
    function (input, options) {
      const result = original(input, options);
      const context = result && result.stdout && result.stdout.hookSpecificOutput && result.stdout.hookSpecificOutput.additionalContext;
      if (typeof context === "string" && context.length > 5000) {
        const copy = JSON.parse(JSON.stringify(result));
        copy.stdout.hookSpecificOutput.additionalContext = context + new Array(10002).join("x");
        return copy;
      }
      return result;
    };
  withPatchedWritingContext(faulty, () => {
    const r = hc.selfTest(guard("writing-context"));
    assert.ok(r.errors.length >= 1, "at least one case threw");
    assert.ok(r.errors.some((e) => describeError(e).indexOf("over the cap") !== -1), "the over-the-cap case is listed under 'case threw'");
    assert.strictEqual(r.ok, false);
    assert.deepStrictEqual(r.falseDeny, [], "a thrown case is not a false deny");
  });
});

// ---------------------------------------------------------------------------
// writing-context: the report line and the installed standard (real tree)
// ---------------------------------------------------------------------------

test("[Scenario: Writing-context self-test passes | " + SPEC + " Self-tests (Change Log 2026-10-16) | FR-118] the report line reads writing-context: PASS (3 silent cases, 3 context cases) and every hook passes with its corpus sizes", () => {
  const dataDir = tempDir("hc-1-12-0-data-");
  const res = runHealth(PLUGIN, [], { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(res.status, 0, res.stderr);
  const out = res.stdout;
  assert.ok(!/case threw/.test(out), "no 'case threw' entry:\n" + out);
  assert.ok(!/: FAIL\b/.test(out), "no failing hook:\n" + out);
  assert.ok(out.indexOf("  writing-context: PASS (3 silent cases, 3 context cases)") !== -1, "writing-context line:\n" + out);
  SIZES.forEach((row) => {
    const re = new RegExp("^\\s+" + row[0] + ": PASS \\(" + row[1] + " [^,]+, " + row[2] + " [^)]+\\)", "m");
    assert.ok(re.test(out), row[0] + " line with " + row[1] + " and " + row[2] + " cases:\n" + out);
  });
});

// ---------------------------------------------------------------------------
// Child process: compact standard unreadable (scratch copy without the file)
// ---------------------------------------------------------------------------

[
  ["CLAUDE_PLUGIN_ROOT unset", false],
  ["CLAUDE_PLUGIN_ROOT set to the copy", true],
].forEach((variant) => {
  test("[Scenario: Compact standard unreadable | " + SPEC + " Self-tests (Change Log 2026-10-16) | FR-118 FR-091 FR-107] --session-start prints the failure with no suffix and writes no writing-context entry (" + variant[0] + ")", () => {
    const dataDir = tempDir("hc-1-12-0-data-");
    const extra = { CLAUDE_PLUGIN_DATA: dataDir };
    if (variant[1]) extra.CLAUDE_PLUGIN_ROOT = noStandardCopy;
    const res = runHealth(noStandardCopy, ["--session-start"], extra);
    const message = notice(res);
    assert.strictEqual(message, "assist-plugin health: writing-context self-test failed (1 context case(s) missed)" + NOTICE_TAIL);
    assert.ok(!("writing-context" in readDisabled(dataDir)), "hooks-disabled.json holds no writing-context entry");
  });
});

test("[Scenario: Installed standard missing | spec-hooks-writing-context.md Self-test coverage | FR-118 FR-107 FR-091] the notice names writing-context and the hook is not disabled", () => {
  const dataDir = tempDir("hc-1-12-0-data-");
  const message = notice(runHealth(noStandardCopy, ["--session-start"], { CLAUDE_PLUGIN_DATA: dataDir }));
  assert.ok(message.indexOf("writing-context") !== -1);
  assert.deepStrictEqual(Object.keys(readDisabled(dataDir)), []);
});

test("[Scenario: Writing-context failure never disables it | " + SPEC + " Auto-disable and re-enable (Change Log 2026-10-16) | FR-091 FR-118] report mode shows FAIL and the missed context case and leaves hooks-disabled.json without writing-context", () => {
  const dataDir = tempDir("hc-1-12-0-data-");
  const res = runHealth(noStandardCopy, [], { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(/^\s+writing-context: FAIL\b/m.test(res.stdout), "writing-context FAIL line:\n" + res.stdout);
  assert.ok(res.stdout.indexOf("context case was MISSED") !== -1, "the missed context case is listed:\n" + res.stdout);
  assert.ok(!("writing-context" in readDisabled(dataDir)));
  assert.ok(!/Changes made:[\s\S]*writing-context/.test(res.stdout), "no change is recorded for writing-context");
});

// ---------------------------------------------------------------------------
// Child process: re-enable and orphan entries
// ---------------------------------------------------------------------------

test("[Scenario: Hand-added writing-context entry and a full pass | " + SPEC + " Auto-disable and re-enable (Change Log 2026-10-16) | FR-091 FR-118] report mode removes the entry and prints writing-context re-enabled: all self-tests pass", () => {
  const dataDir = tempDir("hc-1-12-0-data-");
  writeDisabled(dataDir, ["writing-context"]);
  const res = runHealth(PLUGIN, [], { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.indexOf("writing-context re-enabled: all self-tests pass") !== -1, "re-enabled note:\n" + res.stdout);
  assert.ok(!("writing-context" in readDisabled(dataDir)), "the entry is gone from hooks-disabled.json");
});

test("[Scenario: Entry for a hook without a self-test | " + SPEC + " Auto-disable and re-enable (Change Log 2026-10-16) | FR-091 FR-118] an entry for retired-hook is named at --session-start and again at every later session start", () => {
  const dataDir = tempDir("hc-1-12-0-data-");
  writeDisabled(dataDir, ["retired-hook"]);
  const first = notice(runHealth(PLUGIN, ["--session-start"], { CLAUDE_PLUGIN_DATA: dataDir }));
  assert.ok(first.indexOf("retired-hook guard is disabled (protection is off)") !== -1, first);
  const second = notice(runHealth(PLUGIN, ["--session-start"], { CLAUDE_PLUGIN_DATA: dataDir }));
  assert.ok(second.indexOf("retired-hook guard is disabled (protection is off)") !== -1, second);
  assert.ok("retired-hook" in readDisabled(dataDir), "the entry stays");
});

// ---------------------------------------------------------------------------
// Child process with fault injection: weak protection
// ---------------------------------------------------------------------------

test("[Scenario: Weak guard | " + SPEC + " Session-start notice (Change Log 2026-10-16) | FR-118] a doc-cli-guard that allows a known-prohibited case reads protection is weak and stays enabled", () => {
  const dataDir = tempDir("hc-1-12-0-data-");
  const res = runFault(pristineCopy, "doc-cli-guard", ["false-allow"], "--session-start", { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(
    notice(res),
    "assist-plugin health: doc-cli-guard self-test failed (1 known-prohibited command(s) allowed); protection is weak" + NOTICE_TAIL
  );
  assert.ok(!("doc-cli-guard" in readDisabled(dataDir)), "the guard stays enabled");
});

test("[Scenario: Weak guard with a thrown case | " + SPEC + " Session-start notice (Change Log 2026-10-16) | FR-118] one false allow and one thrown case read (1 known-prohibited command(s) allowed, 1 case(s) threw); protection is weak", () => {
  const dataDir = tempDir("hc-1-12-0-data-");
  const res = runFault(pristineCopy, "doc-cli-guard", ["false-allow", "throw"], "--session-start", { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(
    notice(res),
    "assist-plugin health: doc-cli-guard self-test failed (1 known-prohibited command(s) allowed, 1 case(s) threw); protection is weak" + NOTICE_TAIL
  );
  assert.ok(!("doc-cli-guard" in readDisabled(dataDir)), "a thrown case never disables a guard");
});

test("[Scenario: Listed guard that only misses | " + SPEC + " Session-start notice (Change Log 2026-10-16) | FR-118 FR-091] an earlier hooks-disabled.json entry for doc-cli-guard gets the same ending and the entry stays", () => {
  const dataDir = tempDir("hc-1-12-0-data-");
  writeDisabled(dataDir, ["doc-cli-guard"]);
  const res = runFault(pristineCopy, "doc-cli-guard", ["false-allow"], "--session-start", { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(
    notice(res),
    "assist-plugin health: doc-cli-guard self-test failed (1 known-prohibited command(s) allowed); protection is weak" + NOTICE_TAIL
  );
  assert.ok("doc-cli-guard" in readDisabled(dataDir), "an entry leaves the list only after a full pass");
});

test("[Scenario: Listed guard that now only misses a deny | " + SPEC + " Auto-disable and re-enable (Change Log 2026-10-16) | FR-091 FR-118] report mode keeps the listed guard in hooks-disabled.json and prints no re-enabled note for it", () => {
  const dataDir = tempDir("hc-1-12-0-data-");
  writeDisabled(dataDir, ["doc-cli-guard"]);
  const res = runFault(pristineCopy, "doc-cli-guard", ["false-allow"], "", { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok("doc-cli-guard" in readDisabled(dataDir), "the entry stays");
  assert.ok(res.stdout.indexOf("doc-cli-guard re-enabled") === -1, "no re-enable for a guard that still fails:\n" + res.stdout);
});

test("[Scenario: Self-test case without a git-root stub | spec-hooks-bash-guards.md Mermaid guard paths (Change Log 2026-10-16) | FR-093 FR-118 FR-091] report mode lists the stub-less sa-mermaid-only case under 'case threw', shows FAIL, and leaves the guard out of hooks-disabled.json", () => {
  const dataDir = tempDir("hc-1-12-0-data-");
  const res = runFault(pristineCopy, "sa-mermaid-only", ["stubless"], "", { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(/^\s+sa-mermaid-only: FAIL\b/m.test(res.stdout), "FAIL line:\n" + res.stdout);
  assert.ok(/case threw: fault: stubless absolute path/.test(res.stdout), "case threw entry:\n" + res.stdout);
  assert.ok(!("sa-mermaid-only" in readDisabled(dataDir)), "a thrown case never disables a guard");
});

// ---------------------------------------------------------------------------
// Child process with fault injection: writing-context is report-only
// ---------------------------------------------------------------------------

test("[Scenario: Writing-context failure never disables it | " + SPEC + " Auto-disable and re-enable (Change Log 2026-10-16) | FR-091 FR-118] a false deny in the writing-context self-test is reported with no suffix and adds no entry (CLAUDE_PLUGIN_DATA set)", () => {
  const dataDir = tempDir("hc-1-12-0-data-");
  const res = runFault(pristineCopy, "writing-context", ["silent-flagged"], "--session-start", { CLAUDE_PLUGIN_DATA: dataDir });
  const message = notice(res);
  // The counts hold parentheses (for example "1 silent case(s) injected"), so match to the last ")" before the closing sentence.
  assert.ok(/writing-context self-test failed \(.*\)\. Run \/assist-plugin:health/.test(message), "no suffix of any kind: " + message);
  assert.ok(message.indexOf("could not disable it") === -1, message);
  assert.ok(message.indexOf("disabled until a later check passes") === -1, message);
  assert.ok(message.indexOf("protection is weak") === -1, message);
  assert.ok(!("writing-context" in readDisabled(dataDir)), "writing-context is never added");
});

test("[Scenario: Writing-context failure never disables it | " + SPEC + " Session-start notice (Change Log 2026-10-16) | FR-118 FR-091] with CLAUDE_PLUGIN_DATA unset the notice has neither 'could not disable it' nor 'protection is weak' for writing-context", () => {
  const res = runFault(pristineCopy, "writing-context", ["silent-flagged"], "--session-start", {});
  const message = notice(res);
  assert.ok(message.indexOf("writing-context self-test failed") !== -1, message);
  assert.ok(message.indexOf("could not disable it") === -1, message);
  assert.ok(message.indexOf("protection is weak") === -1, message);
  assert.ok(message.indexOf("disabled until a later check passes") === -1, message);
});
