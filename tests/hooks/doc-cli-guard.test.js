// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for doc-cli-guard, release 1.12.0
// (plugins/assist-plugin/hooks/impl/doc-cli-guard.js, evaluate(input)).
//
// Sources: specs/spec-hooks-bash-guards.md (Change Log 2026-10-16 and 2026-10-17: Requirement:
// Documentation CLI program detection, rules 1 to 9, and Requirement: Documentation CLI denial
// rules, with every Scenario cited by title below) and docs/requirements/FR-NFR-assist-plugin.md
// (FR-094 PowerShell coverage, per-part judging, endpoint rule; FR-198 package runners, Windows
// names, wrappers). Decisions: DECISIONS.md lines 138-141, 188-201, 213-216.
// Task plan step 30.
//
// Traceability format: [Scenario title | spec section | FR ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited. The table-driven tests put the
// chain in the test title, so a failure line names the Scenario and the requirement.
//
// Contract used:
//   evaluate({tool_name, tool_input: {command}}) returns an object whose `deny` field is the
//   boolean true, with a string `reason`, to deny; any other result allows with no output.
//   tool_name Bash or PowerShell is judged; every other tool is allowed.
//
// Reason texts (spec table R1 to R6, `<p>` is the program name, `<sub>` the subcommand):
//   R1   FIRECRAWL_API_URL and CONTEXT7_*URL* overrides are not allowed
//   R2   <p>: shell operators (; & | ` $ > < \ { }) and newlines are not allowed
//   R2P  <p>: shell operators (; & | ` $ > < \ { } ( )) and newlines are not allowed   (PowerShell)
//   R3   <p>: FIRECRAWL_API_URL and CONTEXT7_*URL* overrides are not allowed
//   R4   <p>: quotes are allowed only around whole words
//   R5   <p> <sub> writes config or credentials; ask the user to run it themselves
//   R6   <p>: -o, --output, --base-url, and --api-url are not allowed
//
// Known gaps (rule 9, Change Log 2026-10-17, DECISIONS.md:198-201 and :213-216) are NOT pinned
// here: a program word from a variable, brace expansion, a glob, xargs or find -exec, eval of a
// quoted string, env -S, PowerShell typographic quotes, block comments, the dot-source operator,
// typed or scoped or compound assignments, leading redirections, and `sudo --user root`. No test
// below asserts that any of those forms is allowed or denied.
//
// Run: node --test tests/hooks/doc-cli-guard.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const guard = require(path.join(REPO, "plugins", "assist-plugin", "hooks", "impl", "doc-cli-guard.js"));

const SPEC = "spec-hooks-bash-guards.md";

// ---------------------------------------------------------------------------
// Reasons and expectations
// ---------------------------------------------------------------------------

const R1 = "FIRECRAWL_API_URL and CONTEXT7_*URL* overrides are not allowed";
const R2_BODY = "shell operators (; & | ` $ > < \\ { }) and newlines are not allowed";
const R2P_BODY = "shell operators (; & | ` $ > < \\ { } ( )) and newlines are not allowed";
const R4_BODY = "quotes are allowed only around whole words";
const R6_BODY = "-o, --output, --base-url, and --api-url are not allowed";

const allow = () => ({ kind: "allow" });
const r1 = () => ({ kind: "deny", reason: R1 });
const r2 = (p) => ({ kind: "deny", reason: p + ": " + R2_BODY });
const r2p = (p) => ({ kind: "deny", reason: p + ": " + R2P_BODY });
const r3 = (p) => ({ kind: "deny", reason: p + ": " + R1 });
const r4 = (p) => ({ kind: "deny", reason: p + ": " + R4_BODY });
const r5 = (p, sub) => ({ kind: "deny", reason: p + " " + sub + " writes config or credentials; ask the user to run it themselves" });
const r6 = (p) => ({ kind: "deny", reason: p + ": " + R6_BODY });

function run(tool, command) {
  return guard.evaluate({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: { command: command } });
}

function isDenied(result) {
  return result !== null && result !== undefined && result.deny === true;
}

function verify(tool, command, expected) {
  const result = run(tool, command);
  const shown = tool + ": " + JSON.stringify(command);
  if (expected.kind === "allow") {
    assert.ok(!isDenied(result), "expected allow, got deny (" + (result && result.reason) + ") for " + shown);
    return;
  }
  assert.ok(isDenied(result), "expected deny for " + shown);
  assert.strictEqual(result.reason, expected.reason, "reason for " + shown);
}

// Table-driven cases. Each row is [tool, command, expected] and becomes one test whose title
// carries the traceability chain [Scenario | spec section | FR ids].
function table(scenario, section, ids, rows) {
  rows.forEach((row) => {
    const tool = row[0], command = row[1], expected = row[2];
    const verdict = expected.kind === "allow" ? "allowed" : "denied";
    test("[" + scenario + " | " + SPEC + " " + section + " | " + ids + "] " + tool + " " + JSON.stringify(command) + " is " + verdict, () => {
      verify(tool, command, expected);
    });
  });
}

// ---------------------------------------------------------------------------
// Built scenarios that the 1.12.0 change leaves unchanged
// ---------------------------------------------------------------------------

table("Wrapped program", "Documentation CLI program detection", "FR-094", [
  ["Bash", "timeout 30 firecrawl scrape https://x -o a --only-main-content", r6("firecrawl")],
  ["Bash", "env FOO=bar ctx7 login", r5("ctx7", "login")],
  ["Bash", "time ctx7 login", r5("ctx7", "login")],
  ["Bash", "nohup ctx7 login", r5("ctx7", "login")],
]);

table("Unguarded program", "Documentation CLI program detection", "FR-094", [
  ["Bash", "git status", allow()],
  ["Bash", "npm test", allow()],
  ["Bash", "npm run build", allow()],
  ["Bash", "ls -la", allow()],
]);

table("Output flag", "Documentation CLI denial rules", "FR-094", [
  ["Bash", "firecrawl scrape https://example.com -o out.md", r6("firecrawl")],
  ["Bash", "firecrawl scrape https://example.com --output out.md", r6("firecrawl")],
  ["Bash", "firecrawl scrape https://example.com --output=out.md", r6("firecrawl")],
  ["Bash", "ctx7 docs /a/b --base-url http://e", r6("ctx7")],
  ["Bash", "ctx7 docs /a/b --api-url=http://e", r6("ctx7")],
]);

table("Plain lookup", "Documentation CLI denial rules", "FR-094", [
  ["Bash", 'ctx7 docs /org/project "routing" --json', allow()],
  ["Bash", "firecrawl scrape https://example.com --only-main-content", allow()],
]);

table("Endpoint override before an unrelated program", "Documentation CLI denial rules", "FR-094", [
  ["Bash", "CONTEXT7_BASE_URL=http://e npm test", r1()],
  ["Bash", "FIRECRAWL_API_URL=http://e ls", r1()],
]);

table("Command substitution", "Documentation CLI denial rules", "FR-094", [
  ["Bash", 'firecrawl search "$(id)" --json', r2("firecrawl")],
]);

table("Credential subcommand", "Documentation CLI denial rules", "FR-094", [
  ["Bash", "ctx7 login", r5("ctx7", "login")],
  ["Bash", "ctx7 setup", r5("ctx7", "setup")],
  ["Bash", "firecrawl env", r5("firecrawl", "env")],
]);

// Rule 3: an endpoint variable anywhere in a command that has a guarded part.
table("Endpoint variable anywhere (rule 3)", "Documentation CLI denial rules", "FR-094", [
  ["Bash", "ctx7 docs x CONTEXT7_BASE_URL=http://e", r3("ctx7")],
]);

// ---------------------------------------------------------------------------
// Windows names, case, runners
// ---------------------------------------------------------------------------

table("Windows path and suffix", "Documentation CLI program detection", "FR-198 FR-094", [
  ["Bash", "C:\\tools\\ctx7.exe login", r5("ctx7", "login")],
  ["PowerShell", "C:\\tools\\ctx7.exe login", r5("ctx7", "login")],
]);

table("Windows name from the path", "Documentation CLI program detection", "FR-198", [
  ["PowerShell", "ctx7.exe login", r5("ctx7", "login")],
  ["PowerShell", "firecrawl.exe env", r5("firecrawl", "env")],
]);

table("Windows program name in capitals", "Documentation CLI program detection", "FR-198", [
  ["PowerShell", "CTX7.EXE login", r5("ctx7", "login")],
  ["Bash", "CTX7 login", allow()],
]);

table("Case in Bash stays as built", "Documentation CLI program detection (Change Log 2026-10-16)", "FR-198", [
  ["Bash", "CTX7 login", allow()],
  ["Bash", "CTX7.EXE login", allow()],
]);

table("Case in PowerShell with a path", "Documentation CLI program detection", "FR-198", [
  ["PowerShell", "C:\\Tools\\CTX7.EXE login", r5("ctx7", "login")],
  ["PowerShell", "Ctx7 login", r5("ctx7", "login")],
]);

// Rule 6: arguments keep their case in both tools, so the subcommand test reads them as written.
table("Arguments keep their case (rule 6)", "Documentation CLI program detection", "FR-198", [
  ["PowerShell", "ctx7 Login", allow()],
  ["Bash", "ctx7 Login", allow()],
]);

table("Package runner with a version", "Documentation CLI program detection", "FR-198", [
  ["Bash", 'npx -y ctx7@latest docs /org/project "routing" -o out.md', r6("ctx7")],
  ["Bash", "ctx7@latest login", r5("ctx7", "login")],
  ["Bash", "npx --yes ctx7@latest login", r5("ctx7", "login")],
]);

table("Other runners", "Documentation CLI program detection", "FR-198", [
  ["Bash", "bunx firecrawl env", r5("firecrawl", "env")],
  ["Bash", "pnpm dlx ctx7 setup", r5("ctx7", "setup")],
  ["Bash", "node ./node_modules/.bin/ctx7 login", r5("ctx7", "login")],
  ["Bash", "npm exec ctx7 login", r5("ctx7", "login")],
  ["Bash", "pnpx ctx7 login", r5("ctx7", "login")],
  ["Bash", "yarn dlx firecrawl env", r5("firecrawl", "env")],
  ["Bash", "bun x ctx7 setup", r5("ctx7", "setup")],
]);

table("Lookup through a runner", "Documentation CLI program detection", "FR-198", [
  ["Bash", 'npx -y ctx7@latest docs /org/project "routing" --json', allow()],
  ["Bash", "node ./node_modules/.bin/ctx7 docs /a/b --json", allow()],
]);

table("Package option before the program", "Documentation CLI program detection", "FR-198", [
  ["Bash", "npx -p ctx7 ctx7 login", r5("ctx7", "login")],
  // Boundary: the program position never comes from the -p value, so a lookup stays allowed.
  ["Bash", "npx -p ctx7 ctx7 docs /a/b --json", allow()],
]);

table("Runner for another program", "Documentation CLI program detection", "FR-198", [
  ["Bash", "npx vite build", allow()],
  ["Bash", "npx @scope/tool@2 build", allow()],
  ["Bash", "node script.js", allow()],
]);

table("Runner given by a path or with a suffix", "Documentation CLI program detection", "FR-198", [
  ["Bash", "/usr/local/bin/npx ctx7 login", r5("ctx7", "login")],
  ["PowerShell", "npx.exe ctx7 login", r5("ctx7", "login")],
  ["PowerShell", "NPX CTX7 login", r5("ctx7", "login")],
]);

table("PowerShell call operator", "Documentation CLI program detection", "FR-198", [
  ["PowerShell", "& ctx7 login", r5("ctx7", "login")],
]);

// ---------------------------------------------------------------------------
// Loop and conditional bodies, keywords
// ---------------------------------------------------------------------------

table("Loop body", "Documentation CLI program detection", "FR-198", [
  ["Bash", "for lib in react vue; do ctx7 docs $lib -o out.md; done", r6("ctx7")],
]);

table("PowerShell conditional body", "Documentation CLI program detection", "FR-198", [
  ["PowerShell", "if ($true) { ctx7 login }", r5("ctx7", "login")],
]);

// Rule 3 keyword list: then, !, and while (task plan step 30).
table("Shell keywords then, !, and while (rule 3)", "Documentation CLI program detection", "FR-198", [
  ["Bash", "if true; then ctx7 login; fi", r5("ctx7", "login")],
  ["Bash", "! ctx7 login", r5("ctx7", "login")],
  ["Bash", "while ctx7 login; do :; done", r5("ctx7", "login")],
]);

// ---------------------------------------------------------------------------
// Names hidden by quotes or escapes
// ---------------------------------------------------------------------------

table("Quoting or escapes that hide the name", "Documentation CLI program detection", "FR-198 FR-094", [
  ["Bash", 'c"tx7" login', r4("ctx7")],
  ["Bash", '"c"tx7 login', r4("ctx7")],
  ["Bash", '"ct""x7" login', r4("ctx7")],
  ["Bash", "ct\\x7 login", r4("ctx7")],
  ["Bash", 'X="a b" ctx7 login', r4("ctx7")],
  ["PowerShell", "& 'C:\\Program Files\\ctx7\\ctx7.exe' login", r5("ctx7", "login")],
  ["PowerShell", "ct`x7 login", r4("ctx7")],
]);

table("Assignment before a hidden name in PowerShell", "Documentation CLI program detection", "FR-094 FR-198", [
  ["PowerShell", "$r = ct`x7 login", r4("ctx7")],
]);

// ---------------------------------------------------------------------------
// Wrappers sudo, exec, eval
// ---------------------------------------------------------------------------

table("sudo, exec, and eval as wrappers", "Documentation CLI program detection", "FR-198", [
  ["Bash", "exec ctx7 login", r5("ctx7", "login")],
  ["Bash", "sudo -u root ctx7 login", r5("ctx7", "login")],
  ["Bash", "eval ctx7 login", r5("ctx7", "login")],
  ["Bash", "sudo -u root ctx7 docs /a/b --json", allow()],
]);

table("Long sudo option with an attached value", "Documentation CLI program detection (Change Log 2026-10-17)", "FR-198 FR-094", [
  ["Bash", "sudo --user=root ctx7 login", r5("ctx7", "login")],
]);

table("Quoted text that looks like a flag", "Documentation CLI program detection", "FR-198", [
  ["Bash", 'ctx7 docs /a/b "use -o here" --json', allow()],
]);

// ---------------------------------------------------------------------------
// PowerShell assignments
// ---------------------------------------------------------------------------

table("PowerShell assignment before the program", "Documentation CLI program detection", "FR-198", [
  ["PowerShell", "$r=ctx7 login", r5("ctx7", "login")],
  ["PowerShell", "$r = ctx7 login", r5("ctx7", "login")],
  ["PowerShell", "$env:X = ctx7 login", r5("ctx7", "login")],
]);

table("PowerShell environment assignment", "Documentation CLI denial rules", "FR-094", [
  ["PowerShell", '$env:FIRECRAWL_API_URL = "http://e"; npm test', r1()],
  ["PowerShell", "$env:CONTEXT7_BASE_URL=http://e", r1()],
  ["PowerShell", '$env:NODE_ENV = "test"; npm test', allow()],
]);

table("PowerShell case and spacing", "Documentation CLI denial rules", "FR-094", [
  ["PowerShell", '$Env:Firecrawl_Api_Url="http://e"; npm test', r1()],
  ["PowerShell", '$ENV:context7_base_url   =   "http://e"; npm test', r1()],
]);

table("PowerShell assignment after the program", "Documentation CLI denial rules", "FR-094", [
  ["PowerShell", 'npm test; $env:CONTEXT7_BASE_URL = "http://e"', r1()],
]);

table("PowerShell command", "Documentation CLI denial rules", "FR-094", [
  ["PowerShell", "ctx7 login", r5("ctx7", "login")],
  ["PowerShell", 'ctx7 docs /org/project "routing" --json', allow()],
]);

table("PowerShell expression in an argument", "Documentation CLI denial rules", "FR-094", [
  ["PowerShell", "ctx7 docs /org/project (Get-Content .env) --json", r2p("ctx7")],
]);

table("Bash-form assignment in a PowerShell call", "Documentation CLI denial rules", "FR-094", [
  ["PowerShell", "FIRECRAWL_API_URL=http://e npm test", r1()],
]);

table("Quoted assignment text in PowerShell", "Documentation CLI denial rules", "FR-094", [
  ["PowerShell", 'git commit -m "set $env:CONTEXT7_BASE_URL=http://e in the docs"', allow()],
]);

table("PowerShell script blocks", "Documentation CLI denial rules", "FR-094", [
  ["PowerShell", "if ($a) { echo hi } else { ctx7 login }", r5("ctx7", "login")],
  ["PowerShell", "try { ctx7 login } catch { }", r5("ctx7", "login")],
  ["PowerShell", "1..3 | % { ctx7 docs $_ -o out.md }", r6("ctx7")],
  ["PowerShell", ". { ctx7 login }", r5("ctx7", "login")],
  ["PowerShell", "DO { ctx7 login } while ($x)", r5("ctx7", "login")],
  ["PowerShell", 'if ($true) { $env:CONTEXT7_BASE_URL = "http://e" }', r1()],
]);

// ---------------------------------------------------------------------------
// Chained commands and the whole-command rules
// ---------------------------------------------------------------------------

table("Chained command", "Documentation CLI denial rules", "FR-094", [
  ["Bash", "cd x; ctx7 login", r5("ctx7", "login")],
  ["PowerShell", '$env:NODE_ENV = "test"; ctx7 login', r5("ctx7", "login")],
  ["Bash", 'ctx7 docs /org/project "routing" --json | head', r2("ctx7")],
  ["Bash", "ctx7 docs x --json | tee out.md", r2("ctx7")],
  ["Bash", "firecrawl scrape https://x; rm -rf ~; echo --only-main-content", r2("firecrawl")],
]);

table("Metacharacter in a command with no documentation CLI", "Documentation CLI denial rules", "FR-094", [
  ["Bash", "cd x; npm test | head", allow()],
  ["Bash", "ls > out.txt", allow()],
]);

table("Endpoint variable in a later part", "Documentation CLI denial rules", "FR-094", [
  ["Bash", "cd x; CONTEXT7_BASE_URL=http://e npm test", r1()],
]);

table("Endpoint variable after a quoted assignment", "Documentation CLI denial rules", "FR-094", [
  ["Bash", 'X="a b" CONTEXT7_BASE_URL=http://e npm test', r1()],
]);

// ---------------------------------------------------------------------------
// Quoted separators and heredocs
// ---------------------------------------------------------------------------

table("Separator inside a quoted commit message", "Documentation CLI denial rules", "FR-094", [
  ["Bash", 'git commit -m "fix guard; ctx7 login is manual"', allow()],
]);

table("Heredoc commit message", "Documentation CLI denial rules", "FR-094", [
  ["Bash", "git commit -F - <<'EOF'\nfix guard; ctx7 login is manual\nEOF", allow()],
]);

table("Pull request body with such a line", "Documentation CLI denial rules", "FR-094", [
  ["Bash", 'gh pr create --title t --body "Notes: run ctx7 login yourself | then retry"', allow()],
]);

table("Heredoc body that names a documentation CLI", "Documentation CLI denial rules", "FR-094", [
  ["Bash", "git commit -F - <<'EOF'\nctx7 setup notes\nEOF\nls", allow()],
]);

table("Command after a heredoc", "Documentation CLI denial rules", "FR-094", [
  ["Bash", "cat <<EOF\nhello\nEOF\nctx7 login", r5("ctx7", "login")],
]);

// ---------------------------------------------------------------------------
// Tools and input boundaries
// ---------------------------------------------------------------------------

test("a tool other than Bash and PowerShell is allowed with no output, even for ctx7 login", () => {
  // Boundary: tool filter. [Requirement: Documentation CLI program detection, rule 1 | spec-hooks-bash-guards.md | FR-094]
  ["Read", "Write", "Agent", "WebFetch", "mcp__x__y"].forEach((tool) => {
    assert.ok(!isDenied(guard.evaluate({ tool_name: tool, tool_input: { command: "ctx7 login" } })), tool);
  });
});

test("an input with no tool_name is allowed", () => {
  // Null/empty. [Requirement: Documentation CLI program detection, rule 1 | spec-hooks-bash-guards.md | FR-094]
  assert.ok(!isDenied(guard.evaluate({})));
  assert.ok(!isDenied(guard.evaluate({ tool_input: { command: "ctx7 login" } })));
});

test("a missing, null, empty, or non-string command is treated as the empty string and allowed", () => {
  // Null/empty and type mismatch. [Section: Error handling, "Command is not a string" | spec-hooks-bash-guards.md | FR-094]
  ["Bash", "PowerShell"].forEach((tool) => {
    assert.ok(!isDenied(guard.evaluate({ tool_name: tool })), tool + " no tool_input");
    assert.ok(!isDenied(guard.evaluate({ tool_name: tool, tool_input: {} })), tool + " no command");
    assert.ok(!isDenied(guard.evaluate({ tool_name: tool, tool_input: { command: null } })), tool + " null");
    assert.ok(!isDenied(guard.evaluate({ tool_name: tool, tool_input: { command: "" } })), tool + " empty");
    assert.ok(!isDenied(guard.evaluate({ tool_name: tool, tool_input: { command: 42 } })), tool + " number");
    assert.ok(!isDenied(guard.evaluate({ tool_name: tool, tool_input: { command: ["ctx7", "login"] } })), tool + " array");
  });
});

test("a denial carries no updatedInput and a non-empty string reason", () => {
  // [Section: Output / Outcome, "Deny decision" | spec-hooks-bash-guards.md | FR-094]
  const result = run("Bash", "ctx7 login");
  assert.strictEqual(result.deny, true);
  assert.strictEqual(typeof result.reason, "string");
  assert.ok(result.reason.length > 0);
  assert.ok(!Object.prototype.hasOwnProperty.call(result, "updatedInput"));
});

test("an allowed command returns no deny flag", () => {
  // [Scenario: Plain lookup | spec-hooks-bash-guards.md "Documentation CLI denial rules" | FR-094]
  const result = run("Bash", "git status");
  assert.ok(result === null || result === undefined || result.deny !== true);
});

test("the same command reads the same in Bash and PowerShell where no tool-specific rule applies", () => {
  // Parity across the two tools. [Scenario: PowerShell command | spec-hooks-bash-guards.md "Documentation CLI denial rules" | FR-094]
  const commands = ["git status", 'ctx7 docs /org/project "routing" --json', "npx vite build"];
  commands.forEach((c) => {
    assert.strictEqual(isDenied(run("Bash", c)), isDenied(run("PowerShell", c)), c);
  });
});
