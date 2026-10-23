// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the pr-post-ask self-test in the health check, follow-up to
// release 1.12.0 (plugins/assist-plugin/hooks/impl/health-check.js and the command
// plugins/assist-plugin/hooks/health-check.js).
// Task plan step 21 (docs/task-plans/task-plan-post-1-12-0-followups-20261022-143806.md).
//
// Sources: specs/spec-hooks-health-check.md (Change Log 2026-10-22: Requirement: Self-tests and
// Requirement: Auto-disable and re-enable, with every Scenario cited by title below),
// specs/spec-hooks-pr-post-ask.md (Requirement 8: the 27-case table, the Scenarios "Self-test
// cases", "False ask disables the hook", and "Missed ask is weak protection"),
// docs/requirements/FR-NFR-assist-plugin.md (FR-206, FR-091, FR-118), DECISIONS.md lines 238-241.
//
// Traceability format: [Scenario title | spec section | requirement ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// Public interface used (module exports of impl/health-check.js):
//   GUARDS            array of { name, evaluate(input), allow[], deny[], nouns?, filter?, reportOnly? }
//   selfTest(guard)   returns { ok, falseDeny[], falseAllow[], errors[], allowCount, denyCount }
//   main()            runs the report or, with --session-start, the notice
//   the command `node hooks/health-check.js [--session-start]`: session start prints
//     {"systemMessage": "assist-plugin health: <problems joined by '; '>. Run /assist-plugin:health
//     for details."} or nothing; report mode prints plain text.
//
// For the pr-post-ask entry the wrapper maps the hook's ask === true to the harness's deny === true,
// so an ask case is a "deny" case and a no-ask case is an "allow" case.
//
// Fault injection edits no hook file. A wrapper script requires a scratch copy of the plugin's
// health-check module, replaces the evaluate of the pr-post-ask GUARDS entry for one command of one
// tool (gh pr view 1 is in the corpus for both Bash and PowerShell, so the fault names the tool),
// and calls main(). Child processes run with a temporary CLAUDE_PLUGIN_DATA (or with it unset where
// the case says so) and with CLAUDE_PLUGIN_ROOT unset. NODE_V8_COVERAGE stays in the child
// environment.
//
// Run: node --test tests/hooks/health-check-pr-post-ask.test.js

"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const HC_FILE = path.join(PLUGIN, "hooks", "impl", "health-check.js");
const hc = require(HC_FILE);

const SPEC = "spec-hooks-health-check.md";
const ASK_SPEC = "spec-hooks-pr-post-ask.md";
const NOTICE_TAIL = ". Run /assist-plugin:health for details.";
const NAME = "pr-post-ask";

// ---------------------------------------------------------------------------
// Environment isolation and scratch space
// ---------------------------------------------------------------------------

const savedEnv = {};
const scratch = [];
let pristineCopy = null;
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

// The wrapper requires the copy's health-check.js, replaces the evaluate of the pr-post-ask entry for
// one command of one tool (a defect that asks on a known-safe command, or one that misses a posting
// command), sets the arguments, and calls main(). It is written to a separate temp folder, never into
// the copy. The tool is matched too: gh pr view 1 is a no-ask case for Bash (case 13) and for
// PowerShell (case 22), and a fault on one of them must count as one case.
const WRAPPER_SOURCE = [
  '"use strict";',
  "const hc = require(process.env.HC_PATH);",
  'const guard = hc.GUARDS.find((g) => g.name === "pr-post-ask");',
  'if (!guard) { console.error("no guard named pr-post-ask"); process.exit(3); }',
  "const original = guard.evaluate;",
  "guard.evaluate = function (input) {",
  "  const tool = input && input.tool_name;",
  "  const command = input && input.tool_input && input.tool_input.command;",
  "  // a hook defect that asks on a known-safe command: the wrapper maps ask to deny",
  '  if (process.env.FAULT_ASK_ON && tool === "Bash" && command === process.env.FAULT_ASK_ON) return { deny: true };',
  "  // a hook defect that returns no decision for a known posting command",
  '  if (process.env.FAULT_MISS_ON && tool === "Bash" && command === process.env.FAULT_MISS_ON) return { deny: false };',
  "  return original(input);",
  "};",
  'process.argv = [process.argv[0], process.argv[1]].concat(process.env.FAULT_ARGS ? process.env.FAULT_ARGS.split(" ") : []);',
  "hc.main();",
  "",
].join("\n");

before(() => {
  ["CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA", "CLAUDE_PLUGIN_ROOT"].forEach((k) => {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  });
  pristineCopy = copyPlugin(tempDir("hc-pr-post-ask-pristine-"));
  wrapperDir = tempDir("hc-pr-post-ask-wrapper-");
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

function cleanEnv(extra) {
  const env = Object.assign({}, process.env);
  ["CLAUDE_PLUGIN_ROOT", "CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA"].forEach((k) => delete env[k]);
  return Object.assign(env, extra || {});
}

// Runs the health-check command of a plugin tree (the real tree or the scratch copy).
function runHealth(pluginDir, args, extraEnv) {
  return childProcess.spawnSync(process.execPath, [path.join(pluginDir, "hooks", "health-check.js")].concat(args), {
    cwd: tempDir("hc-pr-post-ask-cwd-"),
    env: cleanEnv(Object.assign({ CLAUDE_CONFIG_DIR: tempDir("hc-pr-post-ask-claude-") }, extraEnv)),
    encoding: "utf8",
    timeout: 60000,
  });
}

// Runs the wrapper against the scratch copy, with one injected defect.
function runFault(fault, args, extraEnv) {
  return childProcess.spawnSync(process.execPath, [path.join(wrapperDir, "fault-run.js")], {
    cwd: tempDir("hc-pr-post-ask-cwd-"),
    env: cleanEnv(
      Object.assign(
        {
          HC_PATH: path.join(pristineCopy, "hooks", "impl", "health-check.js"),
          FAULT_ASK_ON: fault.askOn || "",
          FAULT_MISS_ON: fault.missOn || "",
          FAULT_ARGS: args || "",
          CLAUDE_CONFIG_DIR: tempDir("hc-pr-post-ask-claude-"),
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
    entries[n] = { reason: "self-test: test fixture", ts: "2026-10-22T00:00:00.000Z" };
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

function toolOf(c) {
  return c.tool_name;
}

function commandOf(c) {
  return c.tool_input && c.tool_input.command;
}

function pair(c) {
  return toolOf(c) + "\u0001" + commandOf(c);
}

// ---------------------------------------------------------------------------
// The 27 cases of Requirement 8 (ASK_SPEC:354-382), by number
// ---------------------------------------------------------------------------

// [number, tool, command]
const ASK_CASES = [
  [1, "Bash", "gh pr review 1 --approve"],
  [2, "Bash", "bkt pr comment 1 --text x"],
  [3, "Bash", "bkt api /x --method POST"],
  [4, "Bash", "gh pr merge 123"],
  [5, "Bash", "echo done && gh pr close 123"],
  [6, "Bash", "bkt --context cloud-prod pr approve 123 --workspace acme --repo repo"],
  [7, "Bash", "bkt api /repositories/acme/repo/pullrequests/123/comments --field content.raw=hello"],
  [8, "Bash", "bkt api /x --method=delete"],
  [9, "PowerShell", "GH.EXE pr comment 1 --body-file b.txt"],
  [10, "Bash", "bkt pr decline 1 --project PROJ --repo repo"],
  [
    11,
    "Bash",
    "printf '%s  %s\\n' 'h' 'f' | sha256sum -c --strict - && bkt pr comment '1' --context 'c' --workspace 'acme' --repo 'shop' --text=\"$(cat -- 'f')\"",
  ],
  [12, "Bash", "bkt api /x -X POST"],
  [25, "Bash", "bkt --method=POST api /x"],
  [26, "Bash", "bkt --method POST api /x"],
];

const NO_ASK_CASES = [
  [13, "Bash", "gh pr view 1"],
  [14, "Bash", "bkt api /x --method GET"],
  [15, "Bash", 'git commit -m "docs: explain gh pr review"'],
  [16, "Bash", "bkt pr comments 1 --workspace acme --repo repo --json"],
  [17, "Bash", "bkt pr view 123 --workspace acme --repo repo"],
  [18, "Bash", "bkt api /repositories/acme/repo/pullrequests/123"],
  [19, "Bash", "gh pr diff 1 --repo 'github.com/acme/shop'"],
  [20, "Bash", "git status"],
  [21, "Bash", 'echo "gh pr merge 1"'],
  [22, "PowerShell", "gh pr view 1"],
  [23, "Bash", "bkt auth status --json"],
  [24, "Bash", "bkt api /x --method HEAD"],
  [27, "Bash", "bkt --context cloud-prod pr view 1 --workspace acme --repo repo"],
];

function keysOf(rows) {
  return rows.map((r) => r[1] + "\u0001" + r[2]).sort();
}

// ---------------------------------------------------------------------------
// The GUARDS entry
// ---------------------------------------------------------------------------

test("[Scenario: Ask-hook self-test passes (ten hooks) | " + SPEC + " Self-tests (Change Log 2026-10-22) | FR-118 FR-206] GUARDS lists ten hooks, the nine of 1.12.0 and pr-post-ask", () => {
  assert.strictEqual(hc.GUARDS.length, 10);
  assert.ok(hc.GUARDS.some((g) => g.name === NAME));
});

test("[Requirement: Self-tests, GUARDS entry | " + SPEC + " (Change Log 2026-10-22) | FR-118 FR-206] the pr-post-ask entry holds 13 allow cases and 14 deny cases", () => {
  const g = guard(NAME);
  assert.strictEqual(g.allow.length, 13);
  assert.strictEqual(g.deny.length, 14);
  const r = hc.selfTest(g);
  assert.strictEqual(r.allowCount, 13);
  assert.strictEqual(r.denyCount, 14);
});

test("[Requirement: Self-tests, GUARDS entry | " + SPEC + " (Change Log 2026-10-22) | FR-118 FR-091 FR-206] the entry is a guard: no filter flag and no reportOnly flag", () => {
  const g = guard(NAME);
  assert.ok(!g.filter, "no filter flag");
  assert.notStrictEqual(g.reportOnly, true, "not report-only");
});

test("[Requirement: Self-tests, GUARDS entry nouns | " + SPEC + " (Change Log 2026-10-22; Design choice 1) | FR-118 FR-206] the entry carries the six report nouns", () => {
  assert.deepStrictEqual(guard(NAME).nouns, {
    allow: "no-ask cases",
    deny: "ask cases",
    falseDeny: "known-safe command",
    falseAllow: "known posting command",
    altered: "ASKED",
    missed: "NOT ASKED",
  });
});

test("[Scenario: Self-test cases (ask cases) | " + ASK_SPEC + " Requirement 8 | FR-206 FR-118] the deny list holds the 14 ask commands of the table (cases 1 to 12, 25, 26)", () => {
  const actual = guard(NAME).deny.map(pair).sort();
  assert.deepStrictEqual(actual, keysOf(ASK_CASES));
});

test("[Scenario: Self-test cases (no-ask cases) | " + ASK_SPEC + " Requirement 8 | FR-206 FR-118] the allow list holds the 13 no-ask commands of the table (cases 13 to 24, 27)", () => {
  const actual = guard(NAME).allow.map(pair).sort();
  assert.deepStrictEqual(actual, keysOf(NO_ASK_CASES));
});

test("[Scenario: Self-test cases (PowerShell cases) | " + ASK_SPEC + " Requirement 8 | FR-206] only cases 9 and 22 use the PowerShell tool", () => {
  const g = guard(NAME);
  const powershell = g.allow.concat(g.deny).filter((c) => toolOf(c) === "PowerShell").map(commandOf).sort();
  assert.deepStrictEqual(powershell, ["GH.EXE pr comment 1 --body-file b.txt", "gh pr view 1"]);
  g.allow.concat(g.deny).forEach((c) => {
    assert.ok(toolOf(c) === "Bash" || toolOf(c) === "PowerShell", "unexpected tool " + toolOf(c));
  });
});

test("[Scenario: Self-test cases (FR-206 names six) | " + ASK_SPEC + " Requirement 8 | FR-206 FR-118] the six cases FR-206 names are present", () => {
  const g = guard(NAME);
  const denyCommands = g.deny.map(commandOf);
  const allowCommands = g.allow.map(commandOf);
  ["gh pr review 1 --approve", "bkt pr comment 1 --text x", "bkt api /x --method POST"].forEach((c) => {
    assert.ok(denyCommands.indexOf(c) !== -1, "ask case missing: " + c);
  });
  ["gh pr view 1", "bkt api /x --method GET", 'git commit -m "docs: explain gh pr review"'].forEach((c) => {
    assert.ok(allowCommands.indexOf(c) !== -1, "no-ask case missing: " + c);
  });
});

test("[Requirement 8: V4 result changes no case | " + ASK_SPEC + " Open question 2 | FR-206 DECISIONS.md:238-241] no case passes --workspace, --project, or --repo after api", () => {
  const g = guard(NAME);
  g.allow.concat(g.deny).forEach((c) => {
    const command = commandOf(c);
    command.split(/&&|\|/).forEach((segment) => {
      const words = segment.trim().split(/\s+/);
      const at = words.indexOf("api");
      if (at === -1) return;
      words.slice(at + 1).forEach((w) => {
        assert.ok(!/^--(workspace|project|repo)(=|$)/.test(w), "case " + command + " passes " + w + " after api");
      });
    });
  });
});

test("[Scenario: Self-test cases (wrapper maps ask to deny) | " + SPEC + " Self-tests (Change Log 2026-10-22) | FR-118 FR-206] the entry flags every ask case and no no-ask case", () => {
  const g = guard(NAME);
  g.deny.forEach((c) => {
    const d = g.evaluate(c);
    assert.strictEqual(d && d.deny, true, "ask case not flagged: " + commandOf(c));
  });
  g.allow.forEach((c) => {
    const d = g.evaluate(c);
    assert.ok(!(d && d.deny === true), "no-ask case flagged: " + commandOf(c));
  });
});

test("[Scenario: Ask-hook self-test passes | " + SPEC + " Self-tests (Change Log 2026-10-22) | FR-118 FR-206] selfTest of the entry reports ok with no false deny, no false allow, and no thrown case", () => {
  const r = hc.selfTest(guard(NAME));
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.falseDeny, []);
  assert.deepStrictEqual(r.falseAllow, []);
  assert.strictEqual(r.ok, true);
});

test("[Requirement: Self-tests, header comment | " + SPEC + " (Change Log 2026-10-22) | FR-118 FR-206] the header comment of health-check.js holds the pr-post-ask is a guard line", () => {
  // The text check reads the file's comment as data; it does not interpret any code.
  const text = fs
    .readFileSync(HC_FILE, "utf8")
    .split("\n")
    .map((line) => line.replace(/^\s*(\/\/|\/\*+|\*+\/?|\*)\s?/, ""))
    .join(" ")
    .replace(/\s+/g, " ");
  const expected =
    "The pr-post-ask is a guard: its corpus holds `gh` and `bkt` posting commands (must ask) and read commands, quoted mentions, and `bkt api` reads (must not ask); a false ask disables it like a false deny, and a missed ask reports weak protection.";
  assert.ok(text.indexOf(expected) !== -1, "header line not found");
});

// ---------------------------------------------------------------------------
// The other hooks keep their corpus sizes
// ---------------------------------------------------------------------------

[
  ["doc-cli-guard", 16, 23],
  ["sa-mermaid-only", 16, 28],
  ["injection-filter", 23, 36],
  ["writing-context", 3, 3],
  ["commit-attribution-guard", 17, 22],
  ["prose-gate", 32, 31],
  ["prose-advisor", 11, 10],
  ["fsa-write-bar", 51, 106],
].forEach((row) => {
  test("[Requirement: Self-tests, corpus sizes unchanged | " + SPEC + " (Change Log 2026-10-22) | FR-118] " + row[0] + " still has " + row[1] + " allow and " + row[2] + " deny cases", () => {
    const g = guard(row[0]);
    assert.strictEqual(g.allow.length, row[1]);
    assert.strictEqual(g.deny.length, row[2]);
  });
});

// ---------------------------------------------------------------------------
// In-process fault injection: false ask and missed ask in selfTest
// ---------------------------------------------------------------------------

function withEvaluate(g, replace) {
  const original = g.evaluate;
  return Object.assign({}, g, {
    evaluate: function (input) {
      const replaced = replace(input);
      return replaced === undefined ? original(input) : replaced;
    },
  });
}

test("[Scenario: A no-ask case asks | " + SPEC + " Self-tests (Change Log 2026-10-22) | FR-118 FR-091 FR-206] a defect that asks on gh pr view 1 gives one false deny, no false allow, and a failing self-test", () => {
  const defective = withEvaluate(guard(NAME), (input) => (commandOf(input) === "gh pr view 1" && toolOf(input) === "Bash" ? { deny: true } : undefined));
  const r = hc.selfTest(defective);
  assert.strictEqual(r.falseDeny.length, 1);
  assert.ok(JSON.stringify(r.falseDeny[0]).indexOf("gh pr view 1") !== -1, "the false ask names the command");
  assert.deepStrictEqual(r.falseAllow, []);
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.ok, false);
});

test("[Scenario: Missed ask is weak protection | " + ASK_SPEC + " Requirement 8 | FR-206 FR-091] a defect that returns no decision for gh pr merge 123 gives one false allow, no false deny, and a failing self-test", () => {
  const defective = withEvaluate(guard(NAME), (input) => (commandOf(input) === "gh pr merge 123" ? { deny: false } : undefined));
  const r = hc.selfTest(defective);
  assert.strictEqual(r.falseAllow.length, 1);
  assert.ok(JSON.stringify(r.falseAllow[0]).indexOf("gh pr merge 123") !== -1, "the miss names the command");
  assert.deepStrictEqual(r.falseDeny, []);
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.ok, false);
});

// ---------------------------------------------------------------------------
// Child process: the report and the notice on the real tree
// ---------------------------------------------------------------------------

test("[Scenario: Self-test cases | " + ASK_SPEC + " Requirement 8; " + SPEC + " Ask-hook self-test passes | FR-206 FR-118] the report reads pr-post-ask: PASS (13 no-ask cases, 14 ask cases) and shows no 'case threw' entry", () => {
  const dataDir = tempDir("hc-pr-post-ask-data-");
  const res = runHealth(PLUGIN, [], { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(/^ {2}pr-post-ask: PASS \(13 no-ask cases, 14 ask cases\)$/m.test(res.stdout), "PASS line:\n" + res.stdout);
  assert.ok(!/case threw/.test(res.stdout), "no 'case threw' entry:\n" + res.stdout);
  assert.ok(!/: FAIL\b/.test(res.stdout), "no failing hook:\n" + res.stdout);
  assert.deepStrictEqual(readDisabled(dataDir), {}, "a full pass disables nothing");
});

test("[Scenario: Ask-hook self-test passes | " + SPEC + " Self-tests (Change Log 2026-10-22) | FR-118 FR-206] the session-start notice does not name pr-post-ask on a full pass", () => {
  const dataDir = tempDir("hc-pr-post-ask-data-");
  const res = runHealth(PLUGIN, ["--session-start"], { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.indexOf(NAME) === -1, "stdout must not name pr-post-ask:\n" + res.stdout);
  assert.deepStrictEqual(readDisabled(dataDir), {});
});

// ---------------------------------------------------------------------------
// Child process with fault injection: false ask disables the hook
// ---------------------------------------------------------------------------

test("[Scenario: A no-ask case asks | " + SPEC + " Self-tests (Change Log 2026-10-22) | FR-118 FR-206] the report shows pr-post-ask: FAIL (13 no-ask cases, 14 ask cases) and the line known-safe command was ASKED: Bash: gh pr view 1", () => {
  const dataDir = tempDir("hc-pr-post-ask-data-");
  const res = runFault({ askOn: "gh pr view 1" }, "", { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(/^ {2}pr-post-ask: FAIL \(13 no-ask cases, 14 ask cases\)$/m.test(res.stdout), "FAIL line:\n" + res.stdout);
  assert.ok(/^ {4}known-safe command was ASKED: Bash: gh pr view 1$/m.test(res.stdout), "false-ask line:\n" + res.stdout);
});

test("[Scenario: False ask disables the hook | " + SPEC + " Auto-disable and re-enable (Change Log 2026-10-22) | FR-091 FR-206] a false ask adds pr-post-ask to hooks-disabled.json with the reason self-test: known-safe command asked (1 case) and reports it under Changes made", () => {
  const dataDir = tempDir("hc-pr-post-ask-data-");
  const res = runFault({ askOn: "gh pr view 1" }, "", { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(res.status, 0, res.stderr);
  const disabled = readDisabled(dataDir);
  assert.deepStrictEqual(Object.keys(disabled), [NAME], "only pr-post-ask is added");
  assert.strictEqual(disabled[NAME].reason, "self-test: known-safe command asked (1 case)");
  assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(disabled[NAME].ts), "ts is an ISO time: " + disabled[NAME].ts);
  assert.ok(
    /Changes made:[\s\S]*pr-post-ask disabled: self-test: known-safe command asked \(1 case\)/.test(res.stdout),
    "Changes made entry:\n" + res.stdout
  );
});

test("[Scenario: False ask disables the hook (notice) | " + SPEC + " Auto-disable and re-enable (Change Log 2026-10-22) | FR-091 FR-118 FR-206] the session-start notice ends the item with '; guard disabled until a later check passes'", () => {
  const dataDir = tempDir("hc-pr-post-ask-data-");
  const res = runFault({ askOn: "gh pr view 1" }, "--session-start", { CLAUDE_PLUGIN_DATA: dataDir });
  const message = notice(res);
  assert.ok(message.indexOf("assist-plugin health: ") === 0, message);
  assert.ok(message.endsWith(NOTICE_TAIL), message);
  assert.ok(/pr-post-ask self-test failed \(.*known-safe command.*\); guard disabled until a later check passes/.test(message), message);
  assert.ok("pr-post-ask" in readDisabled(dataDir), "the entry is written at session start");
});

test("[Scenario: False ask with no data folder | " + SPEC + " Session-start notice | FR-091 FR-118 FR-206] with CLAUDE_PLUGIN_DATA unset the notice reads could not disable it (CLAUDE_PLUGIN_DATA is not set) and writes no file", () => {
  const res = runFault({ askOn: "gh pr view 1" }, "--session-start", {});
  const message = notice(res);
  assert.ok(message.indexOf("pr-post-ask self-test failed (") !== -1, message);
  assert.ok(message.indexOf("could not disable it (CLAUDE_PLUGIN_DATA is not set)") !== -1, message);
  assert.ok(message.indexOf("guard disabled until a later check passes") === -1, message);
});

test("[Scenario: Re-enabled after a full pass | " + SPEC + " Auto-disable and re-enable (Change Log 2026-10-22) | FR-091 FR-206] a later full pass of all 27 cases removes the entry and reports pr-post-ask re-enabled: all self-tests pass", () => {
  const dataDir = tempDir("hc-pr-post-ask-data-");
  const first = runFault({ askOn: "gh pr view 1" }, "", { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(first.status, 0, first.stderr);
  assert.ok(NAME in readDisabled(dataDir), "the false ask listed the hook");
  const second = runHealth(PLUGIN, [], { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(second.status, 0, second.stderr);
  assert.ok(second.stdout.indexOf("pr-post-ask re-enabled: all self-tests pass") !== -1, "re-enabled note:\n" + second.stdout);
  assert.ok(!(NAME in readDisabled(dataDir)), "the entry is gone from hooks-disabled.json");
});

test("[Scenario: Re-enabled after a full pass (hand-added entry) | " + SPEC + " Auto-disable and re-enable (Change Log 2026-10-22) | FR-091 FR-206] a hand-added pr-post-ask entry is removed by a full pass", () => {
  const dataDir = tempDir("hc-pr-post-ask-data-");
  writeDisabled(dataDir, [NAME]);
  const res = runHealth(PLUGIN, [], { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.indexOf("pr-post-ask re-enabled: all self-tests pass") !== -1, res.stdout);
  assert.ok(!(NAME in readDisabled(dataDir)));
});

test("[Scenario: Listed hook that still asks on a known-safe case | " + SPEC + " Auto-disable and re-enable (Change Log 2026-10-22) | FR-091 FR-206] an earlier entry stays and no re-enabled note is printed while the false ask persists", () => {
  const dataDir = tempDir("hc-pr-post-ask-data-");
  writeDisabled(dataDir, [NAME]);
  const res = runFault({ askOn: "gh pr view 1" }, "", { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(NAME in readDisabled(dataDir), "the entry stays");
  assert.ok(res.stdout.indexOf("pr-post-ask re-enabled") === -1, res.stdout);
});

// ---------------------------------------------------------------------------
// Child process with fault injection: a missed ask is weak protection
// ---------------------------------------------------------------------------

test("[Scenario: Missed ask is weak protection | " + SPEC + " Auto-disable and re-enable (Change Log 2026-10-22) | FR-091 FR-118 FR-206] a hook that returns no decision for gh pr merge 123 reads 'pr-post-ask self-test failed (1 known posting command(s) not asked); protection is weak' and stays out of hooks-disabled.json", () => {
  const dataDir = tempDir("hc-pr-post-ask-data-");
  const res = runFault({ missOn: "gh pr merge 123" }, "--session-start", { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(
    notice(res),
    "assist-plugin health: pr-post-ask self-test failed (1 known posting command(s) not asked); protection is weak" + NOTICE_TAIL
  );
  assert.ok(!(NAME in readDisabled(dataDir)), "the hook stays enabled");
});

test("[Scenario: Missed ask is weak protection (listed before) | " + SPEC + " Auto-disable and re-enable (Change Log 2026-10-22) | FR-091 FR-206] an earlier entry stays listed when the hook only misses an ask, with the same notice", () => {
  const dataDir = tempDir("hc-pr-post-ask-data-");
  writeDisabled(dataDir, [NAME]);
  const res = runFault({ missOn: "gh pr merge 123" }, "--session-start", { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(
    notice(res),
    "assist-plugin health: pr-post-ask self-test failed (1 known posting command(s) not asked); protection is weak" + NOTICE_TAIL
  );
  assert.ok(NAME in readDisabled(dataDir), "an entry leaves the list only after a full pass");
});

test("[Scenario: Missed ask is weak protection (report) | " + SPEC + " Self-tests (Change Log 2026-10-22) | FR-118 FR-206] the report shows pr-post-ask: FAIL, names the miss as NOT ASKED, and adds no hooks-disabled.json entry", () => {
  const dataDir = tempDir("hc-pr-post-ask-data-");
  const res = runFault({ missOn: "gh pr merge 123" }, "", { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(/^ {2}pr-post-ask: FAIL \(13 no-ask cases, 14 ask cases\)$/m.test(res.stdout), "FAIL line:\n" + res.stdout);
  assert.ok(res.stdout.indexOf("known posting command was NOT ASKED") !== -1, res.stdout);
  assert.ok(res.stdout.indexOf("gh pr merge 123") !== -1, res.stdout);
  assert.ok(!(NAME in readDisabled(dataDir)), "a missed ask never disables the hook");
  assert.ok(!/Changes made:[\s\S]*pr-post-ask/.test(res.stdout), "no change is recorded for pr-post-ask");
});

test("[Scenario: Other hooks stay clean next to a pr-post-ask fault | " + SPEC + " Self-tests (Change Log 2026-10-22) | FR-118] a pr-post-ask fault fails only that hook's report line", () => {
  const dataDir = tempDir("hc-pr-post-ask-data-");
  const res = runFault({ askOn: "gh pr view 1" }, "", { CLAUDE_PLUGIN_DATA: dataDir });
  assert.strictEqual(res.status, 0, res.stderr);
  const failing = res.stdout.split("\n").filter((l) => /: FAIL\b/.test(l));
  assert.strictEqual(failing.length, 1, "exactly one failing hook:\n" + res.stdout);
  assert.ok(failing[0].indexOf(NAME) !== -1, failing[0]);
});
