// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box decision tests for the pr-post-ask hook, follow-up to release 1.12.0
// (plugins/assist-plugin/hooks/impl/pr-post-ask.js, evaluate(input)).
// Task plan step 19 (docs/task-plans/task-plan-post-1-12-0-followups-20261022-143806.md).
//
// Sources: specs/spec-hooks-pr-post-ask.md (Requirements 1 to 9, the 27-case self-test table of
// Requirement 8, with every Scenario cited by title below), docs/requirements/FR-NFR-assist-plugin.md
// (FR-206 posting ask hook, FR-198 program-name detection, FR-088 decision function), DECISIONS.md
// lines 223-241 (ask scope, bkt api unknown options) and lines 253-261 (closed bypass forms, the
// best-effort scope, the listed known gaps).
//
// Traceability format: [Scenario title | spec section | requirement ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited. Table-driven tests put the chain in
// the test title, so a failure line names the Scenario and the requirement.
//
// Contract used:
//   evaluate({tool_name, tool_input: {command}, agent_type?}) returns an object
//   {ask: boolean, deny: boolean, reason: string}. ask === true is a request to prompt the user.
//   The empty decision is {ask: false, deny: false, reason: ""}. The hook never returns deny: true.
//   tool_name Bash or PowerShell is judged; every other tool gets the empty decision.
//   agent_type and agent_id are not read: every session and every agent is covered.
//
// Reason text (spec Requirement 7): it names the command family and holds no other command text:
//   assist-plugin pr-post-ask: this command runs <family>, which posts to, merges, or closes a pull
//   request. Allow it only if you meant to post it now.
//   <family> is "gh pr <subcommand>", "bkt pr <subcommand>", or "bkt api"; for an unlisted bkt
//   option before the subcommand it is "bkt with an option the hook does not recognize" and the
//   sentence reads "which may post to, merge, or close a pull request".
//
// Known gaps (Requirement 9, DECISIONS.md:253-261) are listed in their own section below. The forms
// the approved decision names are pinned as "no decision" and labeled as listed gaps. A gap form
// that the spec words as MAY is only checked for never denying, so closing it later breaks nothing.
//
// Substitution depth (DECISIONS.md:258-261): the hook scans nested substitutions only through
// assignment words and the program word (`x=$(a=$(b=$(c=$(echo hi))))`). A substitution nested
// through the arguments of another program (`x=$(echo $(echo ...))`) is the listed gap "a posting
// command inside a command substitution of another program" and is not judged.
//
// The no-method, no-body bkt api read passes because the build-time read of bkt v0.34.0 confirmed
// that bkt api sends GET with no method and no body (task plan step 1 V1, DECISIONS.md 2026-10-22
// "step 1 research results"). bkt api takes no repository flags (V4: no), so --workspace and --repo
// after api ask as unknown options.
//
// Run: node --test tests/hooks/pr-post-ask.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const IMPL_FILE = path.join(PLUGIN, "hooks", "impl", "pr-post-ask.js");
const hook = require(IMPL_FILE);

const SPEC = "spec-hooks-pr-post-ask.md";
const DECISIONS = "DECISIONS.md:253-261";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Every decision returned in this file, so the last test can check that none carries deny: true.
const ALL_RESULTS = [];

function run(tool, command, extra) {
  const input = Object.assign(
    { hook_event_name: "PreToolUse", tool_name: tool, tool_input: { command: command } },
    extra || {}
  );
  const result = hook.evaluate(input);
  ALL_RESULTS.push({ tool: tool, command: command, result: result });
  return result;
}

function asks(result) {
  return result !== null && result !== undefined && result.ask === true;
}

function shown(tool, command, result) {
  return tool + ": " + JSON.stringify(command) + (result ? " (reason: " + result.reason + ")" : "");
}

const ASK = true;
const PASS = false;

// Table-driven cases. Each row is [tool, command, expectAsk] and becomes one test whose title
// carries the traceability chain [Scenario | spec section | requirement ids].
function table(scenario, section, ids, rows, spec) {
  rows.forEach((row) => {
    const tool = row[0], command = row[1], expectAsk = row[2];
    const verdict = expectAsk ? "asks" : "returns no decision";
    test("[" + scenario + " | " + (spec || SPEC) + " " + section + " | " + ids + "] " + tool + " " + JSON.stringify(command) + " " + verdict, () => {
      const result = run(tool, command);
      if (expectAsk) {
        assert.ok(asks(result), "expected an ask decision for " + shown(tool, command, result));
        assert.strictEqual(typeof result.reason, "string");
        assert.ok(result.reason.length > 0, "an ask decision carries a reason");
      } else {
        assert.ok(!asks(result), "expected no decision for " + shown(tool, command, result));
      }
      assert.ok(!(result && result.deny === true), "the hook never denies: " + shown(tool, command, result));
    });
  });
}

const EMPTY = { ask: false, deny: false, reason: "" };

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.keys(value).forEach((k) => deepFreeze(value[k]));
  }
  return value;
}

// ---------------------------------------------------------------------------
// Module interface
// ---------------------------------------------------------------------------

test("[Requirement 7 | " + SPEC + " Ask output and reason | FR-206 FR-088] the module exports NAME pr-post-ask, evaluate, and main", () => {
  assert.strictEqual(hook.NAME, "pr-post-ask");
  assert.strictEqual(typeof hook.evaluate, "function");
  assert.strictEqual(typeof hook.main, "function");
});

// ---------------------------------------------------------------------------
// Requirement 1: judge only Bash and PowerShell, in every session
// ---------------------------------------------------------------------------

test("[Scenario: Subagent call | " + SPEC + " Requirement 1 | FR-206 UR-055] an agent of type other-plugin:worker running gh pr merge 123 through Bash gets an ask decision", () => {
  const result = run("Bash", "gh pr merge 123", { agent_type: "other-plugin:worker", agent_id: "agent-1" });
  assert.ok(asks(result), shown("Bash", "gh pr merge 123", result));
});

test("[Scenario: Subagent call (any agent_type) | " + SPEC + " Requirement 1 | FR-206] the decision does not depend on agent_type or agent_id", () => {
  // Boundary: the hook reads neither field, so the main session, plugin agents, other plugins, empty
  // strings, and a non-string value all get the same decision.
  [undefined, "", "assist-plugin:reviewer", "assist-plugin:explore", "other-plugin:worker", "general-purpose", 42].forEach((agentType) => {
    const extra = agentType === undefined ? {} : { agent_type: agentType, agent_id: "id-" + String(agentType) };
    assert.ok(asks(run("Bash", "gh pr merge 123", extra)), "agent_type " + String(agentType));
    assert.ok(asks(run("PowerShell", "gh pr merge 123", extra)), "PowerShell agent_type " + String(agentType));
    assert.ok(!asks(run("Bash", "gh pr view 123", extra)), "read command, agent_type " + String(agentType));
  });
});

test("[Scenario: Other tool | " + SPEC + " Requirement 1 | FR-206] a Write call whose content holds gh pr merge 123 returns no ask decision", () => {
  const result = hook.evaluate({
    hook_event_name: "PreToolUse",
    tool_name: "Write",
    tool_input: { file_path: "/tmp/notes.md", content: "gh pr merge 123" },
  });
  ALL_RESULTS.push({ tool: "Write", command: "gh pr merge 123", result: result });
  assert.ok(!asks(result));
  assert.deepStrictEqual(result, EMPTY);
});

test("[Requirement 1: any other tool gets the empty decision | " + SPEC + " Requirement 1 | FR-206] tools other than Bash and PowerShell return the empty decision, even for a posting command", () => {
  // Invalid: tool filter. The tool_input.command key is present so only tool_name can explain a pass.
  ["Write", "Edit", "MultiEdit", "NotebookEdit", "Read", "Grep", "Glob", "Agent", "Task", "WebFetch", "WebSearch", "mcp__x__y"].forEach((tool) => {
    const result = hook.evaluate({ tool_name: tool, tool_input: { command: "gh pr merge 123", content: "gh pr merge 123" } });
    ALL_RESULTS.push({ tool: tool, command: "gh pr merge 123", result: result });
    assert.deepStrictEqual(result, EMPTY, tool);
  });
});

test("[Section: Error handling, no tool_name | " + SPEC + " Required data | FR-206] an input with no tool_name or no input returns the empty decision", () => {
  // Null and empty.
  [{}, { tool_input: { command: "gh pr merge 123" } }, { tool_name: "" , tool_input: { command: "gh pr merge 123" } }].forEach((input) => {
    const result = hook.evaluate(input);
    ALL_RESULTS.push({ tool: "(none)", command: JSON.stringify(input), result: result });
    assert.deepStrictEqual(result, EMPTY, JSON.stringify(input));
  });
});

test("[Section: Error handling, 'Command is not a string' | " + SPEC + " Error handling | FR-206] a missing, null, empty, or non-string command is the empty string and returns the empty decision", () => {
  // Null/empty and type mismatch.
  ["Bash", "PowerShell"].forEach((tool) => {
    const inputs = [
      { tool_name: tool },
      { tool_name: tool, tool_input: {} },
      { tool_name: tool, tool_input: { command: null } },
      { tool_name: tool, tool_input: { command: "" } },
      { tool_name: tool, tool_input: { command: "   " } },
      { tool_name: tool, tool_input: { command: 42 } },
      { tool_name: tool, tool_input: { command: true } },
      { tool_name: tool, tool_input: { command: ["gh", "pr", "merge", "1"] } },
      { tool_name: tool, tool_input: { command: { text: "gh pr merge 1" } } },
    ];
    inputs.forEach((input) => {
      const result = hook.evaluate(input);
      ALL_RESULTS.push({ tool: tool, command: JSON.stringify(input.tool_input), result: result });
      assert.deepStrictEqual(result, EMPTY, tool + " " + JSON.stringify(input.tool_input));
    });
  });
});

// ---------------------------------------------------------------------------
// Requirement 2: split the command into parts, quote-aware
// ---------------------------------------------------------------------------

table("Quoted argument is not a command", "Requirement 2", "FR-206 FR-198", [
  ["Bash", 'git commit -m "docs: explain gh pr review and bkt pr approve"', PASS],
  ["Bash", 'echo "gh pr merge 1"', PASS],
  ["Bash", "echo 'gh pr merge 1'", PASS],
  ["Bash", 'echo "a; gh pr merge 1"', PASS],
  ["Bash", "echo 'a && bkt pr approve 1'", PASS],
  ["Bash", 'printf "%s" "gh pr review 1 --approve"', PASS],
  ["Bash", 'gh pr create --title t --body "Notes: gh pr merge 1 later | then retry"', PASS],
  ["PowerShell", 'Write-Output "gh pr merge 1"', PASS],
  ["PowerShell", 'git commit -m "run gh pr merge 1"', PASS],
]);

table("Chained command", "Requirement 2", "FR-206", [
  ["Bash", "echo done && gh pr close 123", ASK],
  ["Bash", "echo a; gh pr merge 1", ASK],
  ["Bash", "echo a;gh pr merge 1", ASK],
  ["Bash", "false || gh pr merge 1", ASK],
  ["Bash", "echo a | gh pr comment 1 --body-file -", ASK],
  ["Bash", "echo a & gh pr merge 1", ASK],
  ["Bash", "echo a\ngh pr merge 1", ASK],
  ["Bash", "(gh pr merge 1)", ASK],
  ["Bash", "{ gh pr merge 1; }", ASK],
  ["Bash", "gh pr merge 1 | tee out.txt", ASK],
  ["Bash", "cd repo && git status && bkt pr approve 1 --workspace a --repo r", ASK],
]);

table("Heredoc body", "Requirement 2", "FR-206", [
  ["Bash", "cat <<'EOF'\ngh pr merge 123\nEOF", PASS],
  ["Bash", "cat <<EOF\ngh pr merge 123\nEOF", PASS],
  ["Bash", "git commit -F - <<'EOF'\nrun gh pr merge 1 now\nEOF", PASS],
  ["Bash", "git commit -F - <<'EOF'\nnotes; gh pr merge 1\nEOF\nls", PASS],
  ["Bash", "cat <<'EOF'\nbkt pr approve 1\nEOF", PASS],
  // Command after a heredoc is a part of its own.
  ["Bash", "cat <<EOF\nhello\nEOF\ngh pr merge 1", ASK],
  ["Bash", "cat <<'EOF'\nhello\nEOF\nbkt pr approve 1", ASK],
]);

table("PowerShell script block", "Requirement 2", "FR-206", [
  ["PowerShell", "if ($ok) { gh pr merge 123 }", ASK],
  ["PowerShell", "try { gh pr merge 1 } catch { }", ASK],
  ["PowerShell", "1..3 | % { gh pr close $_ }", ASK],
  ["PowerShell", "foreach ($n in 1..3) { gh pr close $n }", ASK],
  ["PowerShell", "if ($ok) { Write-Host fine }", PASS],
]);

// ---------------------------------------------------------------------------
// Requirement 3: find the program as FR-198 defines it
// ---------------------------------------------------------------------------

table("Wrapped and Windows program names", "Requirement 3", "FR-206 FR-198", [
  ["Bash", "env GH_PROMPT_DISABLED=1 gh pr review 1 --approve", ASK],
  ["PowerShell", "GH.EXE pr review 1 --approve", ASK],
  ["PowerShell", "& gh pr merge 1", ASK],
  ["Bash", "FOO=bar gh pr merge 1", ASK],
  ["Bash", "env FOO=bar gh pr merge 1", ASK],
  ["Bash", "command gh pr merge 1", ASK],
  ["Bash", "timeout 30 gh pr merge 1", ASK],
  ["Bash", "nice -n 5 gh pr merge 1", ASK],
  ["Bash", "nohup gh pr merge 1", ASK],
  ["Bash", "time gh pr merge 1", ASK],
  ["Bash", "sudo -u root gh pr merge 1", ASK],
  ["Bash", "exec gh pr merge 1", ASK],
  ["Bash", "eval gh pr merge 1", ASK],
  ["Bash", "npx --yes bkt pr approve 1 --workspace a --repo r", ASK],
  ["Bash", "/usr/bin/gh pr merge 1", ASK],
  ["Bash", "/usr/local/bin/bkt pr approve 1", ASK],
  ["Bash", "! gh pr merge 1", ASK],
  ["Bash", "if true; then gh pr merge 1; fi", ASK],
  ["Bash", "while gh pr merge 1; do :; done", ASK],
  ["Bash", "for n in 1 2; do gh pr close $n; done", ASK],
  ["PowerShell", "gh.exe pr merge 1", ASK],
  ["PowerShell", "C:\\tools\\gh.exe pr merge 1", ASK],
  ["PowerShell", "bkt.exe pr approve 1", ASK],
  ["PowerShell", "BKT.EXE api /x --method POST", ASK],
  ["PowerShell", "$r = gh pr merge 1", ASK],
  ["PowerShell", "$env:X = 'y'; gh pr merge 1", ASK],
]);

table("Program that only looks like gh or bkt", "Requirement 3", "FR-206 FR-198", [
  ["Bash", "ghost pr merge 1", PASS],
  ["Bash", "my-gh pr merge 1", PASS],
  ["Bash", "bkt2 pr approve 1", PASS],
  ["Bash", "echo gh pr merge 1", PASS],
  ["Bash", "ls gh", PASS],
  ["Bash", "man gh", PASS],
  ["Bash", "which bkt", PASS],
  ["Bash", "git status", PASS],
  ["Bash", "/usr/bin/env true", PASS],
]);

table("Name hidden by quotes", "Requirement 3", "FR-206 FR-198", [
  ["Bash", 'g"h" pr merge 1', ASK],
  ["Bash", '"g"h pr merge 1', ASK],
  ["Bash", 'b"k"t pr approve 1', ASK],
]);

table("Bash name in capitals (listed known gap)", "Requirement 3 and 9", "FR-206 FR-198", [
  ["Bash", "GH pr merge 1", PASS],
  ["Bash", "BKT pr approve 1", PASS],
  ["Bash", "Gh pr merge 1", PASS],
]);

table("PowerShell name in capitals", "Requirement 3", "FR-206 FR-198", [
  ["PowerShell", "GH pr merge 1", ASK],
  ["PowerShell", "Gh pr merge 1", ASK],
  ["PowerShell", "BKT pr approve 1", ASK],
  ["PowerShell", "C:\\Tools\\GH.EXE pr merge 1", ASK],
  ["PowerShell", "GH.EXE pr view 1", PASS],
]);

table("Resolved words ask, raw words do not", "Requirement 3", "FR-206 FR-198", [
  ['Bash', 'gh pr me"rge" 1', ASK],
  ["Bash", "gh pr 'merge' 1", ASK],
  ["Bash", 'gh "pr" "merge" 1', ASK],
]);

table("Raw words ask, resolved words do not", "Requirement 3", "FR-206 FR-198", [
  // The prompt on this read is the cost of the either-list rule; it is never a self-test no-ask case.
  ["Bash", "bkt api /x --jq '.a | .b'", ASK],
  // Counter-case: a quoted jq value with no space reads the same on both lists.
  ["Bash", "bkt api /x --jq '.a'", PASS],
  ["Bash", "bkt api /x --jq .a", PASS],
]);

// ---------------------------------------------------------------------------
// Requirement 4: gh posting subcommands
// ---------------------------------------------------------------------------

table("Posting command asks", "Requirement 4", "FR-206 UR-055", [
  ["Bash", "gh pr review '123' --repo 'github.com/acme/shop' --approve --body-file '/r/.agent/pr-review/pr-123-review.body'", ASK],
  ["Bash", "gh pr review 1 --approve", ASK],
  ["Bash", "gh pr review 1 --request-changes --body x", ASK],
  ["Bash", "gh pr comment 1 --body-file b.txt", ASK],
  ["Bash", "gh pr close 123", ASK],
  ["Bash", "gh pr close 123 --comment bye", ASK],
]);

table("Merge asks", "Requirement 4", "FR-206", [
  ["Bash", "gh pr merge 123", ASK],
  ["Bash", "gh pr merge", ASK],
  ["Bash", "gh pr merge 123 --squash --delete-branch", ASK],
]);

table("Repository options before and between the words", "Requirement 4", "FR-206", [
  ["Bash", "gh -R acme/shop pr merge 1", ASK],
  ["Bash", "gh --repo acme/shop pr merge 1", ASK],
  ["Bash", "gh --repo=acme/shop pr merge 1", ASK],
  ["Bash", "gh pr -R acme/shop merge 1", ASK],
  ["Bash", "gh pr --repo acme/shop comment 1 --body x", ASK],
  ["Bash", "gh pr merge 1 --repo acme/shop", ASK],
]);

table("Read commands pass", "Requirement 4", "FR-206", [
  ["Bash", "gh pr view 123", PASS],
  ["Bash", "gh pr diff 123 --repo 'github.com/acme/shop'", PASS],
  ["Bash", "gh pr list", PASS],
  ["Bash", "gh pr status", PASS],
  ["Bash", "gh pr checks 1", PASS],
  ["Bash", "gh pr checkout 1", PASS],
  ["Bash", "gh -R acme/shop pr view 1", PASS],
  ["Bash", "gh issue comment 1 --body x", PASS],
  ["Bash", "gh repo view", PASS],
  ["Bash", "gh auth status", PASS],
  ["Bash", "gh --version", PASS],
  ["Bash", "gh pr", PASS],
  ["Bash", "gh", PASS],
  ["PowerShell", "gh pr view 1", PASS],
]);

table("Subcommands are compared as written", "Requirement 4", "FR-206", [
  ["Bash", "gh pr Merge 1", PASS],
  ["Bash", "gh pr REVIEW 1 --approve", PASS],
  ["Bash", "gh PR merge 1", PASS],
]);

table("Not one of the four verbs", "Requirement 4", "FR-206", [
  ["Bash", 'gh pr create --title t --body "x"', PASS],
  ["Bash", "gh pr reviews 1", PASS],
  ["Bash", "gh pr merged 1", PASS],
]);

// ---------------------------------------------------------------------------
// Requirement 5: bkt pr subcommands and unlisted options
// ---------------------------------------------------------------------------

table("Bitbucket commands ask", "Requirement 5", "FR-206 UR-055", [
  ["Bash", "bkt pr approve 123 --workspace acme --repo repo", ASK],
  ["Bash", "bkt --context cloud-prod pr decline 1 --project PROJ --repo repo", ASK],
  ["Bash", "bkt pr comment 1 --text x", ASK],
  ["Bash", "bkt pr close 1 --workspace acme --repo repo", ASK],
  ["Bash", "bkt pr merge 1 --workspace acme --repo repo", ASK],
  ["Bash", "bkt pr decline 1 --project PROJ --repo repo", ASK],
  ["Bash", "bkt -c cloud-prod pr merge 1", ASK],
  ["Bash", "bkt --context=cloud-prod pr merge 1", ASK],
  ["Bash", "bkt --json pr approve 1", ASK],
  ["Bash", "bkt --yaml pr approve 1", ASK],
  ["Bash", "bkt --format json pr approve 1", ASK],
  ["Bash", "bkt --context cloud-prod pr approve 123 --workspace acme --repo repo", ASK],
]);

table("Repository flags between pr and the verb", "Requirement 5", "FR-206", [
  ["Bash", "bkt pr --workspace acme approve 1", ASK],
  ["Bash", "bkt pr --workspace acme --repo repo comment 1 --text x", ASK],
  ["Bash", "bkt pr --project PROJ --repo repo decline 1", ASK],
  ["Bash", "bkt pr -c prod approve 1", ASK],
  ["Bash", "bkt pr --workspace acme view 1", PASS],
]);

table("/do comment command with its hash check", "Requirement 5", "FR-206", [
  [
    "Bash",
    "printf '%s  %s\\n' '<hash>' '/r/.agent/pr-review/pr-1-review.body' | sha256sum -c --strict - && bkt pr comment '1' --context 'c' --workspace 'acme' --repo 'shop' --text=\"$(cat -- '/r/.agent/pr-review/pr-1-review.body')\"",
    ASK,
  ],
]);

table("Read commands pass (bkt)", "Requirement 5", "FR-206", [
  ["Bash", "bkt pr view 123 --workspace acme --repo repo", PASS],
  ["Bash", "bkt pr comments 1 --workspace acme --repo repo --json", PASS],
  ["Bash", "bkt pr diff 1 --project PROJ --repo repo", PASS],
  ["Bash", "bkt pr list --workspace acme --repo repo", PASS],
  ["Bash", "bkt --version", PASS],
  ["Bash", "bkt auth status --json", PASS],
  ["Bash", "bkt pr", PASS],
  ["Bash", "bkt", PASS],
  ["Bash", "bkt pr Approve 1", PASS],
]);

table("Unlisted option before the subcommand asks", "Requirement 5", "FR-206 DECISIONS.md:238-241", [
  ["Bash", "bkt --method=POST api /x", ASK],
  ["Bash", "bkt --field=content.raw=x api /x", ASK],
  ["Bash", "bkt --input='{}' api /x", ASK],
  ["Bash", "bkt --field a=b api /x", ASK],
  ["Bash", "bkt --workspace acme pr view 1", ASK],
]);

table("Unlisted option ahead of a pr command asks", "Requirement 5", "FR-206", [
  ["Bash", "bkt --text x pr comment 1", ASK],
  ["Bash", "bkt --method POST api /x", ASK],
]);

table("Listed global options pass", "Requirement 5", "FR-206", [
  ["Bash", "bkt --context cloud-prod pr view 1 --workspace acme --repo repo", PASS],
  ["Bash", "bkt --json pr list --workspace acme --repo repo", PASS],
  ["Bash", "bkt -c cloud-prod --jq '.a' auth status", PASS],
  ["Bash", "bkt --yaml pr list --workspace acme --repo repo", PASS],
  ["Bash", "bkt --format json pr view 1", PASS],
  ["Bash", "bkt --context=prod pr view 1", PASS],
  ["Bash", "bkt --context prod pr view 1", PASS],
]);

table("Option with no subcommand after it", "Requirement 5", "FR-206", [
  ["Bash", "bkt --version", PASS],
  ["Bash", "bkt --help", PASS],
]);

// ---------------------------------------------------------------------------
// Requirement 6: bkt api
// ---------------------------------------------------------------------------

table("Raw API write asks", "Requirement 6", "FR-206 DECISIONS.md:223-226", [
  ["Bash", "bkt api /repositories/acme/repo/pullrequests/123/request-changes --method POST", ASK],
  ["Bash", "bkt api /x --method POST", ASK],
  ["Bash", "bkt api /x --method PUT", ASK],
  ["Bash", "bkt api /x --method PATCH", ASK],
  ["Bash", "bkt api /x --method DELETE", ASK],
  ["Bash", "bkt api --method POST /x", ASK],
  ["Bash", "bkt api /x --method=POST", ASK],
]);

table("Method in lower case", "Requirement 6", "FR-206", [
  ["Bash", "bkt api /x --method=delete", ASK],
  ["Bash", "bkt api /x --method post", ASK],
  ["Bash", "bkt api /x --method=Put", ASK],
]);

table("Raw API read passes", "Requirement 6", "FR-206", [
  ["Bash", "bkt api /repositories/acme/repo/pullrequests/123 --method GET", PASS],
  ["Bash", "bkt api /repositories/acme/repo/pullrequests/123 --method HEAD", PASS],
  // The no-method, no-body form: bkt api sends GET (step 1 V1 confirmed).
  ["Bash", "bkt api /repositories/acme/repo/pullrequests/123", PASS],
  ["Bash", "bkt api /repositories/a/r/pullrequests/1", PASS],
  // Methods are compared without case.
  ["Bash", "bkt api /x --method=get", PASS],
  ["Bash", "bkt api /x --method head", PASS],
  ["Bash", "bkt api /x --method GET --method HEAD", PASS],
]);

table("Listed global option before api passes", "Requirement 6", "FR-206", [
  ["Bash", "bkt --context cloud-prod api /x --method GET", PASS],
  ["Bash", "bkt -c cloud-prod api /x", PASS],
  ["Bash", "bkt --json api /x", PASS],
]);

table("Known read-only options after api pass", "Requirement 6", "FR-206", [
  ["Bash", "bkt api /x --context cloud-prod", PASS],
  ["Bash", "bkt api /x --context=cloud-prod", PASS],
  ["Bash", "bkt api /x -c cloud-prod", PASS],
  ["Bash", "bkt api /x --jq .a", PASS],
  ["Bash", "bkt api /x --jq=.a", PASS],
  ["Bash", "bkt api /x --template t", PASS],
  ["Bash", "bkt api /x --format json", PASS],
  ["Bash", "bkt api /x --json", PASS],
  ["Bash", "bkt api /x --yaml", PASS],
  ["Bash", "bkt api /x --method GET --jq .a --json", PASS],
]);

table("Two method options", "Requirement 6", "FR-206", [
  ["Bash", "bkt api /x --method GET --method POST", ASK],
  ["Bash", "bkt api /x --method POST --method GET", ASK],
]);

table("Raw API body option without a method asks", "Requirement 6", "FR-206 DECISIONS.md:228-231", [
  ["Bash", "bkt api /repositories/acme/repo/pullrequests/123/comments --field content.raw=hello", ASK],
  ["Bash", "bkt api /x --field=a=b", ASK],
  ["Bash", "bkt api /x --input '{\"a\":1}'", ASK],
  ["Bash", "bkt api /x --input=body.json", ASK],
]);

table("Body option with GET asks", "Requirement 6", "FR-206", [
  ["Bash", "bkt api /x --method GET --input '{\"a\":1}'", ASK],
  ["Bash", "bkt api /x --method HEAD --field a=b", ASK],
]);

table("Unknown option asks", "Requirement 6", "FR-206 DECISIONS.md:238-241", [
  ["Bash", "bkt api /x -X POST", ASK],
  ["Bash", "bkt api /x -X GET", ASK],
  ["Bash", "bkt api /x --unknown", ASK],
  ["Bash", "bkt api /x --method GET --unknown", ASK],
  // bkt api takes no repository flags (V4: no), so they are unknown options.
  ["Bash", "bkt api /x --workspace acme --repo repo", ASK],
  ["Bash", "bkt api /x --project PROJ", ASK],
]);

table("Extra word asks", "Requirement 6", "FR-206", [
  ["Bash", "bkt api /x /y", ASK],
  ["Bash", "bkt api /x --method GET extra", ASK],
]);

// ---------------------------------------------------------------------------
// The 27-case self-test table of Requirement 8
// ---------------------------------------------------------------------------

// [number, expectAsk, tool, command]
const SELF_TEST = [
  [1, ASK, "Bash", "gh pr review 1 --approve"],
  [2, ASK, "Bash", "bkt pr comment 1 --text x"],
  [3, ASK, "Bash", "bkt api /x --method POST"],
  [4, ASK, "Bash", "gh pr merge 123"],
  [5, ASK, "Bash", "echo done && gh pr close 123"],
  [6, ASK, "Bash", "bkt --context cloud-prod pr approve 123 --workspace acme --repo repo"],
  [7, ASK, "Bash", "bkt api /repositories/acme/repo/pullrequests/123/comments --field content.raw=hello"],
  [8, ASK, "Bash", "bkt api /x --method=delete"],
  [9, ASK, "PowerShell", "GH.EXE pr comment 1 --body-file b.txt"],
  [10, ASK, "Bash", "bkt pr decline 1 --project PROJ --repo repo"],
  [
    11,
    ASK,
    "Bash",
    "printf '%s  %s\\n' 'h' 'f' | sha256sum -c --strict - && bkt pr comment '1' --context 'c' --workspace 'acme' --repo 'shop' --text=\"$(cat -- 'f')\"",
  ],
  [12, ASK, "Bash", "bkt api /x -X POST"],
  [13, PASS, "Bash", "gh pr view 1"],
  [14, PASS, "Bash", "bkt api /x --method GET"],
  [15, PASS, "Bash", 'git commit -m "docs: explain gh pr review"'],
  [16, PASS, "Bash", "bkt pr comments 1 --workspace acme --repo repo --json"],
  [17, PASS, "Bash", "bkt pr view 123 --workspace acme --repo repo"],
  [18, PASS, "Bash", "bkt api /repositories/acme/repo/pullrequests/123"],
  [19, PASS, "Bash", "gh pr diff 1 --repo 'github.com/acme/shop'"],
  [20, PASS, "Bash", "git status"],
  [21, PASS, "Bash", 'echo "gh pr merge 1"'],
  [22, PASS, "PowerShell", "gh pr view 1"],
  [23, PASS, "Bash", "bkt auth status --json"],
  [24, PASS, "Bash", "bkt api /x --method HEAD"],
  [25, ASK, "Bash", "bkt --method=POST api /x"],
  [26, ASK, "Bash", "bkt --method POST api /x"],
  [27, PASS, "Bash", "bkt --context cloud-prod pr view 1 --workspace acme --repo repo"],
];

SELF_TEST.forEach((row) => {
  const number = row[0], expectAsk = row[1], tool = row[2], command = row[3];
  test("[Scenario: Self-test cases (case " + number + ") | " + SPEC + " Requirement 8 | FR-206 FR-118] " + tool + " " + JSON.stringify(command) + (expectAsk ? " asks" : " returns no decision"), () => {
    const result = run(tool, command);
    assert.strictEqual(asks(result), expectAsk, shown(tool, command, result));
    assert.ok(!(result && result.deny === true));
  });
});

test("[Scenario: Self-test cases | " + SPEC + " Requirement 8 | FR-206] the table holds 14 ask cases and 13 no-ask cases", () => {
  assert.strictEqual(SELF_TEST.length, 27);
  assert.strictEqual(SELF_TEST.filter((r) => r[1] === ASK).length, 14);
  assert.strictEqual(SELF_TEST.filter((r) => r[1] === PASS).length, 13);
});

test("[Scenario: Never denies | " + SPEC + " Requirement 7 | FR-206 FR-088] no result of the 27 self-test cases carries deny: true", () => {
  SELF_TEST.forEach((row) => {
    const result = hook.evaluate({ tool_name: row[2], tool_input: { command: row[3] } });
    assert.notStrictEqual(result && result.deny, true, "case " + row[0]);
  });
});

// ---------------------------------------------------------------------------
// Closed bypass forms (DECISIONS.md:253-261): substitutions, variables, redirections
// ---------------------------------------------------------------------------

table("Command substitution in the program word or an assignment value", "Closed forms (" + DECISIONS + ")", "FR-206", [
  ["Bash", 'out="x $(gh pr merge 1)"', ASK],
  ["Bash", "out=$(true)$(gh pr merge 1)", ASK],
  ["Bash", "$(gh pr merge 1)/usr/bin/env true", ASK],
  ["Bash", "out=$(gh pr merge 1)", ASK],
  ["Bash", "$(gh pr merge 1)", ASK],
  ["Bash", "`gh pr merge 1`", ASK],
  ["Bash", "out=`gh pr merge 1`", ASK],
  ["Bash", "X=1 Y=$(gh pr merge 1) true", ASK],
  ["Bash", "out=$(bkt pr approve 1)", ASK],
  ["Bash", "out=$(bkt api /x --method POST)", ASK],
]);

table("Command substitution with a quoted parenthesis or a heredoc line", "Closed forms (" + DECISIONS + ")", "FR-206", [
  ["Bash", "out=$(printf ')'; gh pr merge 1)", ASK],
  ["Bash", "out=$(cat <<'EOF'\n)\nEOF\ngh pr merge 1)", ASK],
]);

table("Substitutions nested deeper than the limit ask", "Closed forms (" + DECISIONS + ")", "FR-206", [
  // Depth 4 and 5 through assignment words: past the limit of 3 (DECISIONS.md:258-261) the scan
  // cannot judge them, so the hook asks ("nested too deep" family). Nesting through the arguments of
  // another program (`echo $(echo ...)`) is the listed gap and is not asserted.
  ["Bash", "x=$(a=$(b=$(c=$(echo hi))))", ASK],
  ["Bash", "x=$(a=$(b=$(c=$(d=$(echo hi)))))", ASK],
]);

table("A dollar sign or backtick in the pr, verb, or subcommand word", "Closed forms (" + DECISIONS + ")", "FR-206", [
  ["Bash", "gh pr $v 1", ASK],
  ["Bash", 'gh pr "$v" 1', ASK],
  ["Bash", "gh $p merge 1", ASK],
  ["Bash", "gh pr `echo merge` 1", ASK],
  ["Bash", "bkt pr $v 1", ASK],
  ["Bash", "bkt $s approve 1", ASK],
  ["Bash", "bkt pr `echo approve` 1", ASK],
]);

table("A dollar sign in an option word or option value before the verb", "Closed forms (" + DECISIONS + ")", "FR-206", [
  ["Bash", "gh -R $x pr view 1", ASK],
  ["Bash", "gh --repo $x pr view 1", ASK],
  ["Bash", "gh --repo=$x pr view 1", ASK],
  ["Bash", 'gh -R "$R" pr view 1', ASK],
  ["Bash", "bkt --context $x pr view 1", ASK],
  ["Bash", 'bkt -c "$ctx" pr view 1', ASK],
  ["Bash", "bkt pr --workspace $x view 1", ASK],
  ["Bash", "gh pr --body=$x view 1", ASK],
  ["Bash", "bkt --$y pr view 1", ASK],
]);

table("A dollar sign or backtick word after bkt api", "Closed forms (" + DECISIONS + ")", "FR-206", [
  ["Bash", "bkt api $p", ASK],
  ["Bash", "bkt api /x --jq $q", ASK],
  ["Bash", 'bkt api "$p"', ASK],
  ["Bash", "bkt api `echo /x`", ASK],
]);

table("A redirection word between the program and the verb", "Closed forms (" + DECISIONS + ")", "FR-206", [
  ["Bash", "gh 2>/dev/null pr merge 1", ASK],
  ["Bash", "gh pr >/dev/null merge 1", ASK],
  ["Bash", "gh >/dev/null pr merge 1", ASK],
  ["Bash", "gh pr merge 1 2>/dev/null", ASK],
]);

table("PowerShell parenthesized verb", "Closed forms (" + DECISIONS + ")", "FR-206", [
  ["PowerShell", "gh pr ('merge') 1", ASK],
]);

table("No-ask controls next to the closed forms", "Closed forms (" + DECISIONS + ")", "FR-206", [
  ["Bash", "x=$(git status)", PASS],
  ["Bash", "gh pr view $N", PASS],
  ["Bash", "gh pr view --repo $R 1", PASS],
  ["Bash", "out=$(gh pr view 1)", PASS],
  ["Bash", "bkt --context prod pr view 1", PASS],
  ["Bash", "bkt api /repositories/a/r/pullrequests/1", PASS],
  ["Bash", "bkt --version", PASS],
  [
    "Bash",
    "bkt auth status --json --jq '[.contexts[]? as $c | .hosts[]? | select(.key == $c.host) | {name: $c.name, kind: .kind, base_url: .base_url}]'",
    PASS,
  ],
  ["Bash", "/usr/bin/env true", PASS],
  ["Bash", "git status", PASS],
  ["Bash", "x=$(a=$(echo hi))", PASS],
  ["Bash", "gh 2>/dev/null pr view 1", PASS],
  ["Bash", "gh pr view 1 2>/dev/null", PASS],
  ["Bash", 'bkt pr view 1 --workspace "$ws" --repo "$r"', PASS],
]);

table("The /commit message form passes", "Closed forms (" + DECISIONS + ")", "FR-206", [
  ["Bash", "git commit -m \"$(cat <<'EOF'\nfeat(hooks): add the ask hook\n\nBody line one.\nEOF\n)\"", PASS],
  ["Bash", "git commit -m \"$(cat <<'EOF'\nfeat(hooks): add the ask hook\n\nA body line follows.\n)\nThe next line follows a parenthesis line.\nEOF\n)\"", PASS],
]);

// ---------------------------------------------------------------------------
// Listed known gaps (Requirement 9, DECISIONS.md:253-261): pinned as "no decision" by design
// ---------------------------------------------------------------------------

table("Known gap passes (listed gap)", "Requirement 9", "FR-206 FR-NFR section 6", [
  // A posting command inside a command substitution of another program.
  ["Bash", "echo $(gh pr merge 1)", PASS],
  // A redirection the shared lexer splits.
  ["Bash", "gh 2>&1 pr merge 1", PASS],
  // A PowerShell array in the verb position.
  ["PowerShell", "gh pr @('merge') 1", PASS],
  // A program word taken from a variable.
  ["Bash", "G=gh; $G pr merge 1", PASS],
  // A command string run by another program.
  ["Bash", 'bash -c "gh pr merge 1"', PASS],
  // An option with a separate value ahead of the verb that the lists do not name.
  ["Bash", "gh pr --body x comment 1", PASS],
  // A Bash program name in another case (Scenario: Bash name in capitals).
  ["Bash", "GH pr merge 1", PASS],
]);

// Forms the spec words as MAY or lists without a pinned result: only the never-deny contract is
// checked, so a later fix that closes one of them breaks no test.
const GAP_FORMS = [
  ["Bash", "gh --body x pr comment 1"],
  ["Bash", "gh pr -b x comment 1"],
  ["Bash", "gh pr --body-file f review 1 --approve"],
  ["Bash", "bkt pr --text x comment 1"],
  ["Bash", "gh api -X POST repos/o/r/pulls/1/reviews"],
  ["Bash", "gh pr edit 1 --body x"],
  ["Bash", "gh pr ready 1"],
  ["Bash", "gh pr reopen 1"],
  ["Bash", "bkt pr reviewer-group list"],
  ["Bash", 'eval "gh pr merge 1"'],
  ["Bash", "xargs gh pr merge"],
  ["Bash", "find . -exec gh pr merge 1 ;"],
  ["Bash", "watch gh pr merge 1"],
  ["Bash", "sh -c 'gh pr merge 1'"],
  ["PowerShell", "& (Get-Command gh) pr merge 1"],
  ["PowerShell", "Invoke-Expression 'gh pr merge 1'"],
  ["PowerShell", "iex 'gh pr merge 1'"],
  ["PowerShell", "pwsh -Command \"gh pr merge 1\""],
];

GAP_FORMS.forEach((row) => {
  test("[Known gap (listed, result not pinned) | " + SPEC + " Requirement 9 | FR-206] " + row[0] + " " + JSON.stringify(row[1]) + " never denies", () => {
    const result = run(row[0], row[1]);
    assert.ok(!(result && result.deny === true), shown(row[0], row[1], result));
  });
});

// ---------------------------------------------------------------------------
// Requirement 7: ask output and reason
// ---------------------------------------------------------------------------

test("[Requirement 7: ask shape | " + SPEC + " Ask output and reason | FR-206 FR-088] an ask decision is {ask: true, deny: false, reason: <non-empty string>}", () => {
  const result = run("Bash", "gh pr merge 123");
  assert.strictEqual(result.ask, true);
  assert.strictEqual(result.deny, false);
  assert.strictEqual(typeof result.reason, "string");
  assert.ok(result.reason.length > 0);
});

test("[Requirement 7: empty decision shape | " + SPEC + " Ask output and reason | FR-206] a command that matches nothing returns {ask: false, deny: false, reason: \"\"}", () => {
  ["git status", "gh pr view 123", "bkt pr view 123 --workspace acme --repo repo", ""].forEach((command) => {
    assert.deepStrictEqual(run("Bash", command), EMPTY, JSON.stringify(command));
  });
  assert.deepStrictEqual(run("PowerShell", "gh pr view 1"), EMPTY);
});

test("[Requirement 7: pure function | " + SPEC + " Ask output and reason | FR-088] evaluate leaves a frozen input unchanged and returns the same decision twice", () => {
  const input = deepFreeze({
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    agent_type: "other-plugin:worker",
    tool_input: { command: "echo done && gh pr close 123" },
  });
  const first = hook.evaluate(input);
  const second = hook.evaluate(input);
  assert.deepStrictEqual(first, second);
  assert.strictEqual(first.ask, true);
  assert.deepStrictEqual(input, {
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    agent_type: "other-plugin:worker",
    tool_input: { command: "echo done && gh pr close 123" },
  });
});

test("[Traceability row FR-088 | " + SPEC + " Requirement 7 | FR-088] the module file requires neither fs, child_process, nor os, so evaluate reads no file and starts no process", () => {
  // The text check reads the file as data; it does not interpret how the decision is made.
  const source = fs.readFileSync(IMPL_FILE, "utf8");
  const banned = /require\(\s*["'](?:node:)?(?:fs|child_process|os)["']\s*\)|from\s+["'](?:node:)?(?:fs|child_process|os)["']/;
  assert.ok(!banned.test(source), "pr-post-ask.js must not require fs, child_process, or os");
});

const FAMILY_ROWS = [
  ["gh pr review", "Bash", "gh pr review 1 --approve"],
  ["gh pr merge", "Bash", "gh pr merge 123"],
  ["gh pr comment", "Bash", "gh pr comment 1 --body-file b.txt"],
  ["gh pr close", "Bash", "gh pr close 123"],
  ["bkt pr approve", "Bash", "bkt pr approve 1 --workspace acme --repo repo"],
  ["bkt pr comment", "Bash", "bkt pr comment 1 --text x"],
  ["bkt pr decline", "Bash", "bkt pr decline 1 --project PROJ --repo repo"],
  ["bkt pr close", "Bash", "bkt pr close 1"],
  ["bkt pr merge", "Bash", "bkt pr merge 1"],
  ["bkt api", "Bash", "bkt api /x --method POST"],
  ["bkt api", "Bash", "bkt api /x --field a=b"],
  ["bkt api", "Bash", "bkt api /x -X POST"],
  ["gh pr comment", "PowerShell", "GH.EXE pr comment 1 --body-file b.txt"],
  ["gh pr merge", "Bash", "env GH_PROMPT_DISABLED=1 gh pr merge 1"],
];

FAMILY_ROWS.forEach((row) => {
  test("[Scenario: Reason names the family | " + SPEC + " Requirement 7 | FR-206] " + row[1] + " " + JSON.stringify(row[2]) + " has a reason that names " + row[0], () => {
    const result = run(row[1], row[2]);
    assert.ok(asks(result), shown(row[1], row[2], result));
    assert.ok(result.reason.indexOf(row[0]) !== -1, "reason should contain " + row[0] + ": " + result.reason);
  });
});

test("[Scenario: Reason names the family (bkt without a recognized option) | " + SPEC + " Requirement 7 | FR-206] an unlisted bkt option before the subcommand names bkt with an option the hook does not recognize", () => {
  const result = run("Bash", "bkt --workspace acme pr view 1");
  assert.ok(asks(result));
  assert.ok(result.reason.indexOf("bkt with an option the hook does not recognize") !== -1, result.reason);
  assert.ok(result.reason.indexOf("acme") === -1, result.reason);
});

test("[Scenario: Reason names the family | " + SPEC + " Requirement 7 | FR-206] bkt pr approve 1 --workspace acme --repo repo contains bkt pr approve and does not contain acme", () => {
  const result = run("Bash", "bkt pr approve 1 --workspace acme --repo repo");
  assert.ok(result.reason.indexOf("bkt pr approve") !== -1);
  assert.ok(result.reason.indexOf("acme") === -1);
});

test("[Scenario: Posting command asks | " + SPEC + " Requirement 4 | FR-206] gh pr review with repo and body file names gh pr review and holds none of the repository, path, or number", () => {
  const command = "gh pr review '123' --repo 'github.com/acme/shop' --approve --body-file '/r/.agent/pr-review/pr-123-review.body'";
  const result = run("Bash", command);
  assert.ok(asks(result));
  assert.ok(result.reason.indexOf("gh pr review") !== -1, result.reason);
  assert.strictEqual(result.deny, false, "the call is never denied");
  ["acme", "shop", "github.com", ".body", "/r/", "123", "--approve", "--repo"].forEach((fragment) => {
    assert.ok(result.reason.indexOf(fragment) === -1, "reason leaks " + fragment + ": " + result.reason);
  });
});

test("[Requirement 7: reasons hold only fixed text | " + SPEC + " Ask output and reason | FR-206 NFR-016] no reason holds a repository name, a flag value, a token, or any text of the command", () => {
  const rows = [
    ["Bash", "bkt api /x --field token=abc123", ["abc123", "token", "--field", "/x"]],
    ["Bash", "bkt pr comment 7 --workspace acme-secret --repo shop-secret --text hunter2", ["acme-secret", "shop-secret", "hunter2", "--text"]],
    ["Bash", "gh pr merge 4242 --repo owner-x/repo-y --body sekret", ["owner-x", "repo-y", "sekret", "4242"]],
    ["Bash", 'out="x $(gh pr merge 1)"', ["out=", "x $("]],
    ["Bash", "gh -R $leaky pr view 1", ["$leaky", "leaky"]],
    ["Bash", "bkt api $secretpath", ["secretpath"]],
    ["Bash", "gh 2>/dev/null pr merge 1", ["/dev/null"]],
    ["Bash", "x=$(a=$(b=$(c=$(echo deepsecret))))", ["deepsecret"]],
  ];
  rows.forEach((row) => {
    const result = run(row[0], row[1]);
    assert.ok(asks(result), shown(row[0], row[1], result));
    row[2].forEach((fragment) => {
      assert.ok(result.reason.indexOf(fragment) === -1, "reason leaks " + JSON.stringify(fragment) + " for " + row[1] + ": " + result.reason);
    });
    assert.ok(result.reason.length < 300, "reason stays a short fixed sentence: " + result.reason);
  });
});

test("[Requirement 7: chained command | " + SPEC + " Ask output and reason | FR-206] the first matching part names the family", () => {
  const first = run("Bash", "gh pr close 1 && bkt pr approve 1 --workspace a --repo r");
  assert.ok(asks(first));
  assert.ok(first.reason.indexOf("gh pr close") !== -1, first.reason);
  assert.ok(first.reason.indexOf("bkt pr approve") === -1, first.reason);
  const second = run("Bash", "echo ok; bkt pr approve 1 --workspace a --repo r; gh pr close 1");
  assert.ok(asks(second));
  assert.ok(second.reason.indexOf("bkt pr approve") !== -1, second.reason);
  assert.ok(second.reason.indexOf("gh pr close") === -1, second.reason);
});

test("[Requirement 7: reason wording | " + SPEC + " Ask output and reason | FR-206] the proposed reason sentence for gh pr merge, bkt api, and an unlisted bkt option", () => {
  const tail = " Allow it only if you meant to post it now.";
  assert.strictEqual(
    run("Bash", "gh pr merge 123").reason,
    "assist-plugin pr-post-ask: this command runs gh pr merge, which posts to, merges, or closes a pull request." + tail
  );
  assert.strictEqual(
    run("Bash", "bkt api /x --method POST").reason,
    "assist-plugin pr-post-ask: this command runs bkt api, which posts to, merges, or closes a pull request." + tail
  );
  assert.strictEqual(
    run("Bash", "bkt --workspace acme pr view 1").reason,
    "assist-plugin pr-post-ask: this command runs bkt with an option the hook does not recognize, which may post to, merge, or close a pull request." + tail
  );
});

// ---------------------------------------------------------------------------
// Last: no result in this file carries deny: true
// ---------------------------------------------------------------------------

test("[Scenario: Never denies | " + SPEC + " Requirement 7 | FR-206 FR-088 RULE-001] no decision returned anywhere in this file carries deny: true", () => {
  assert.ok(ALL_RESULTS.length > 300, "the file made a broad set of calls (" + ALL_RESULTS.length + ")");
  const denied = ALL_RESULTS.filter((entry) => entry.result && entry.result.deny === true);
  assert.deepStrictEqual(
    denied.map((entry) => entry.tool + ": " + entry.command),
    []
  );
});
