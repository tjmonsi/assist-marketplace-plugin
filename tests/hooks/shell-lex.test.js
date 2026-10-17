// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box tests for the shared shell lexer, release 1.12.0
// (plugins/assist-plugin/hooks/lib/shell-lex.js, export lex(command, powershell, raw)).
//
// Sources: specs/spec-hooks-bash-guards.md (Change Log 2026-10-16, Requirement:
// Documentation CLI denial rules, order of the checks step 1, and Scenario "Moved lexer
// keeps the commit guard's results"; Requirement: Documentation CLI program detection,
// rule 2) and docs/requirements/FR-NFR-assist-plugin.md (FR-094, FR-198).
// Task plan step 29 (docs/task-plans/task-plan-deferred-decisions-20261016-161827.md).
//
// Traceability format: [Scenario title | spec section | FR ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// Public interface used:
//   lex(command, powershell, raw) -> [{words, heredocs}]; with raw true each segment also
//     carries `raw`, the part's text as written and trimmed, and PowerShell segments also
//     end at "{" and "}" outside quotes.
//   require(".../hooks/impl/commit-attribution-guard.js").lex   re-export of the same function
//   require(".../hooks/impl/health-check.js")                    COMMIT_GUARD_ALLOW,
//     COMMIT_GUARD_DENY, GUARDS, selfTest(guard) -> {ok, falseDeny, falseAllow, errors,
//     allowCount, denyCount}
//
// The 1.11.1 lexer comes from `git archive 41034c1 plugins/assist-plugin/hooks` unpacked
// into a temp directory. When git, tar, or the commit is missing, the parity tests are
// skipped with a visible reason (sign-off item S14); they are not counted as passed.
//
// Run: node --test tests/hooks/shell-lex.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const HOOKS = path.join(REPO, "plugins", "assist-plugin", "hooks");
const lexModule = require(path.join(HOOKS, "lib", "shell-lex.js"));
const commitGuard = require(path.join(HOOKS, "impl", "commit-attribution-guard.js"));
const hc = require(path.join(HOOKS, "impl", "health-check.js"));

const lex = lexModule.lex;
const BASELINE_COMMIT = "41034c1";

// ---------------------------------------------------------------------------
// The 1.11.1 lexer, extracted once
// ---------------------------------------------------------------------------

let baselineDir = null;
let baselineLex = null;
let baselineSkip = null;

(function loadBaseline() {
  try {
    const archive = childProcess.spawnSync("git", ["archive", BASELINE_COMMIT, "plugins/assist-plugin/hooks"], {
      cwd: REPO,
      maxBuffer: 128 * 1024 * 1024,
    });
    if (archive.error || archive.status !== 0) {
      baselineSkip = "git archive " + BASELINE_COMMIT + " failed (git or the commit is absent)";
      return;
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shell-lex-baseline-"));
    baselineDir = dir;
    const untar = childProcess.spawnSync("tar", ["-x", "-C", dir], { input: archive.stdout, maxBuffer: 128 * 1024 * 1024 });
    if (untar.error || untar.status !== 0) {
      baselineSkip = "tar could not unpack the archive of " + BASELINE_COMMIT;
      return;
    }
    const mod = require(path.join(dir, "plugins", "assist-plugin", "hooks", "impl", "commit-attribution-guard.js"));
    if (typeof mod.lex !== "function") {
      baselineSkip = "the 1.11.1 commit-attribution-guard.js does not export lex";
      return;
    }
    baselineLex = mod.lex;
  } catch (err) {
    baselineSkip = "could not load the 1.11.1 lexer: " + (err && err.message);
  }
})();

after(() => {
  if (baselineDir) fs.rmSync(baselineDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function commandOf(c) {
  if (typeof c === "string") return c;
  return c && c.tool_input ? c.tool_input.command : undefined;
}

function isPowerShell(c) {
  return !!c && typeof c === "object" && c.tool_name === "PowerShell";
}

function labelOf(c, i) {
  return c && c.label ? c.label : "#" + i;
}

function corpus(name, cases) {
  return cases.map((c, i) => ({
    corpus: name,
    label: labelOf(c, i),
    command: commandOf(c),
    powershell: isPowerShell(c),
  }));
}

const COMMANDS = corpus("COMMIT_GUARD_ALLOW", hc.COMMIT_GUARD_ALLOW).concat(corpus("COMMIT_GUARD_DENY", hc.COMMIT_GUARD_DENY));

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function raws(command, powershell) {
  return lex(command, !!powershell, true).map((s) => s.raw);
}

function nonEmpty(list) {
  return list.filter((r) => typeof r === "string" && r !== "");
}

function withoutRaw(segments) {
  return segments.map((s) => {
    const copy = Object.assign({}, s);
    delete copy.raw;
    return copy;
  });
}

// ---------------------------------------------------------------------------
// Moved lexer: same function, same results as 1.11.1
// ---------------------------------------------------------------------------

test("lex exported by hooks/lib/shell-lex.js is the same function commit-attribution-guard exports", () => {
  // [Scenario: Moved lexer keeps the commit guard's results | spec-hooks-bash-guards.md "Documentation CLI denial rules" | FR-094]
  assert.strictEqual(typeof lexModule.lex, "function");
  assert.strictEqual(commitGuard.lex, lexModule.lex);
});

test("the commit-guard corpora are exported with 17 allow and 22 deny commands, each a string", () => {
  // Shape guard for the parity tests below. [Scenario: Moved lexer keeps the commit guard's results | same requirement | FR-094]
  assert.strictEqual(hc.COMMIT_GUARD_ALLOW.length, 17);
  assert.strictEqual(hc.COMMIT_GUARD_DENY.length, 22);
  COMMANDS.forEach((c) => {
    assert.strictEqual(typeof c.command, "string", c.corpus + " case " + c.label + " has no command string");
  });
  assert.ok(COMMANDS.some((c) => c.powershell), "the corpora hold PowerShell cases");
});

test("lex(cmd, powershell) with no third argument equals the 1.11.1 lex for every commit-guard command", { skip: baselineSkip || false }, () => {
  // [Scenario: Moved lexer keeps the commit guard's results | spec-hooks-bash-guards.md "Documentation CLI denial rules" | FR-094 | FR-198]
  COMMANDS.forEach((c) => {
    assert.deepStrictEqual(lex(c.command, c.powershell), baselineLex(c.command, c.powershell), c.corpus + " case " + c.label);
  });
});

test("lex(cmd, powershell, undefined) equals the 1.11.1 lex too (raw is off by default)", { skip: baselineSkip || false }, () => {
  // Boundary: an explicit undefined third argument. [Scenario: Moved lexer keeps the commit guard's results | same requirement | FR-094]
  COMMANDS.forEach((c) => {
    assert.deepStrictEqual(lex(c.command, c.powershell, undefined), baselineLex(c.command, c.powershell), c.corpus + " case " + c.label);
  });
});

test("with no third argument no segment carries a raw field", () => {
  // [Scenario: Moved lexer keeps the commit guard's results | same requirement | FR-094]
  COMMANDS.forEach((c) => {
    lex(c.command, c.powershell).forEach((segment, i) => {
      assert.ok(!has(segment, "raw"), c.corpus + " case " + c.label + " segment " + i + " has a raw field");
    });
  });
});

test("the commit-attribution-guard self-test passes all 17 allow and 22 deny cases", () => {
  // [Scenario: Moved lexer keeps the commit guard's results (AND clause) | spec-hooks-bash-guards.md "Documentation CLI denial rules" | FR-094 | FR-118]
  const guard = hc.GUARDS.find((g) => g.name === "commit-attribution-guard");
  assert.ok(guard, "GUARDS has no commit-attribution-guard entry");
  const result = hc.selfTest(guard);
  assert.strictEqual(result.allowCount, 17);
  assert.strictEqual(result.denyCount, 22);
  assert.deepStrictEqual(result.errors, []);
  assert.deepStrictEqual(result.falseDeny, []);
  assert.deepStrictEqual(result.falseAllow, []);
  assert.strictEqual(result.ok, true);
});

// ---------------------------------------------------------------------------
// raw = true
// ---------------------------------------------------------------------------

test("raw true: a Bash command with the raw flag returns the same words and heredocs plus a raw field", () => {
  // Bash segments are the same as with raw off (only PowerShell segments split at braces).
  // [Requirement: Documentation CLI denial rules, order of the checks step 1 | spec-hooks-bash-guards.md | FR-094]
  COMMANDS.filter((c) => !c.powershell).forEach((c) => {
    const on = lex(c.command, false, true);
    const off = lex(c.command, false);
    assert.deepStrictEqual(withoutRaw(on), off, c.corpus + " case " + c.label);
    on.forEach((s, i) => assert.strictEqual(typeof s.raw, "string", c.corpus + " case " + c.label + " segment " + i + " raw"));
  });
});

test("raw true: parts carry their text as written, trimmed, split at ; && and |", () => {
  // [Requirement: Documentation CLI denial rules, order of the checks step 1 | spec-hooks-bash-guards.md | FR-094]
  assert.deepStrictEqual(nonEmpty(raws("git status; ctx7 login", false)), ["git status", "ctx7 login"]);
  assert.deepStrictEqual(nonEmpty(raws("cd x && ctx7 login | head", false)), ["cd x", "ctx7 login", "head"]);
  assert.deepStrictEqual(nonEmpty(raws("  ls   ", false)), ["ls"]);
});

test("raw true: a separator inside double quotes does not end the part", () => {
  // [Scenario: Separator inside a quoted commit message | spec-hooks-bash-guards.md "Documentation CLI denial rules" | FR-094]
  const cmd = 'git commit -m "fix guard; ctx7 login is manual"';
  assert.deepStrictEqual(nonEmpty(raws(cmd, false)), [cmd]);
  const pr = 'gh pr create --title t --body "Notes: run ctx7 login yourself | then retry"';
  assert.deepStrictEqual(nonEmpty(raws(pr, false)), [pr]);
});

test("raw true: a heredoc body is no part and the operator stays in the opener's raw", () => {
  // [Scenario: Heredoc commit message | spec-hooks-bash-guards.md "Documentation CLI denial rules" | FR-094]
  const cmd = "git commit -F - <<'EOF'\nfix guard; ctx7 login is manual\nEOF";
  const segments = lex(cmd, false, true);
  const list = nonEmpty(segments.map((s) => s.raw));
  assert.deepStrictEqual(list, ["git commit -F - <<'EOF'"]);
  list.forEach((r) => assert.ok(r.indexOf("ctx7 login is manual") === -1, "heredoc body leaked into raw: " + r));
  assert.ok(JSON.stringify(segments[0].heredocs).indexOf("ctx7 login is manual") !== -1, "the body is attached to its part as stdin text");
});

test("raw true: a heredoc body that names a documentation CLI is in no raw, and the next part's raw is the line after the terminator", () => {
  // [Scenario: Heredoc body that names a documentation CLI | spec-hooks-bash-guards.md "Documentation CLI denial rules" | FR-094]
  const cmd = "git commit -F - <<'EOF'\nctx7 setup notes\nEOF\nls";
  assert.deepStrictEqual(nonEmpty(raws(cmd, false)), ["git commit -F - <<'EOF'", "ls"]);
});

test("raw true: the part after a heredoc has the raw text of its own line", () => {
  // [Scenario: Command after a heredoc | spec-hooks-bash-guards.md "Documentation CLI denial rules" | FR-094]
  const cmd = "cat <<EOF\nhello\nEOF\nctx7 login";
  const list = nonEmpty(raws(cmd, false));
  assert.deepStrictEqual(list, ["cat <<EOF", "ctx7 login"]);
});

test("raw true: Bash braces do not split a part", () => {
  // Boundary: only PowerShell segments end at braces. [Requirement: Documentation CLI denial rules, order of the checks step 1 | spec-hooks-bash-guards.md | FR-094]
  assert.deepStrictEqual(nonEmpty(raws("echo {a,b}", false)), ["echo {a,b}"]);
});

test("raw true: PowerShell parts end at { and } (try { ctx7 login } catch { })", () => {
  // [Scenario: PowerShell script blocks | spec-hooks-bash-guards.md "Documentation CLI denial rules" | FR-094]
  const list = nonEmpty(raws("try { ctx7 login } catch { }", true));
  assert.deepStrictEqual(list, ["try", "ctx7 login", "catch"]);
  list.forEach((r) => assert.ok(!/[{}]/.test(r), "a brace stayed in raw: " + r));
});

test("raw true: PowerShell script block bodies are parts of their own (conditional, pipeline, dot-source)", () => {
  // [Scenario: PowerShell script blocks | same requirement | FR-094]
  assert.ok(nonEmpty(raws("if ($a) { echo hi } else { ctx7 login }", true)).indexOf("ctx7 login") !== -1);
  assert.ok(nonEmpty(raws("1..3 | % { ctx7 docs $_ -o out.md }", true)).indexOf("ctx7 docs $_ -o out.md") !== -1);
  assert.ok(nonEmpty(raws(". { ctx7 login }", true)).indexOf("ctx7 login") !== -1);
});

test("raw true: a PowerShell brace inside quotes does not end the part", () => {
  // Boundary: quoted braces. [Requirement: Documentation CLI denial rules, order of the checks step 1 | spec-hooks-bash-guards.md | FR-094]
  const cmd = 'git commit -m "use { and } here"';
  assert.deepStrictEqual(nonEmpty(raws(cmd, true)), [cmd]);
});

test("raw off: a PowerShell command with braces stays one segment, as at 1.11.1", () => {
  // [Scenario: Moved lexer keeps the commit guard's results | spec-hooks-bash-guards.md "Documentation CLI denial rules" | FR-094]
  assert.strictEqual(lex("try { ctx7 login } catch { }", true).length, 1);
});

// ---------------------------------------------------------------------------
// Resolved words (quotes and escapes the shell would resolve)
// ---------------------------------------------------------------------------

test("words: quotes and escapes that hide a program name resolve to the name", () => {
  // [Requirement: Documentation CLI program detection, rule 2 | spec-hooks-bash-guards.md | FR-198 | FR-094]
  assert.deepStrictEqual(lex('c"tx7" login', false)[0].words, ["ctx7", "login"]);
  assert.deepStrictEqual(lex('"c"tx7 login', false)[0].words, ["ctx7", "login"]);
  assert.deepStrictEqual(lex('"ct""x7" login', false)[0].words, ["ctx7", "login"]);
  assert.deepStrictEqual(lex("ct\\x7 login", false)[0].words, ["ctx7", "login"]);
});

test("words: a PowerShell backtick escape resolves inside a word", () => {
  // [Requirement: Documentation CLI program detection, rule 2 | spec-hooks-bash-guards.md | FR-198]
  assert.deepStrictEqual(lex("ct`x7 login", true)[0].words, ["ctx7", "login"]);
});

test("words: a quoted assignment value resolves to one word, and the raw text keeps the quotes", () => {
  // [Scenario: Endpoint variable after a quoted assignment | spec-hooks-bash-guards.md "Documentation CLI denial rules" | FR-094]
  const cmd = 'X="a b" CONTEXT7_BASE_URL=http://e npm test';
  const segments = lex(cmd, false, true);
  assert.strictEqual(segments.length, 1);
  assert.deepStrictEqual(segments[0].words, ["X=a b", "CONTEXT7_BASE_URL=http://e", "npm", "test"]);
  assert.strictEqual(segments[0].raw, cmd);
});

test("words: a Bash Windows path resolves its backslashes as escapes while raw keeps them as written", () => {
  // [Requirement: Documentation CLI denial rules, order of the checks step 1 | spec-hooks-bash-guards.md | FR-094 | FR-198]
  const cmd = "C:\\tools\\ctx7.exe login";
  const segments = lex(cmd, false, true);
  assert.strictEqual(segments[0].words[0], "C:toolsctx7.exe");
  assert.strictEqual(segments[0].raw, cmd);
});

test("words: a quoted argument stays one word", () => {
  // [Scenario: Quoted text that looks like a flag | spec-hooks-bash-guards.md "Documentation CLI program detection" | FR-198]
  assert.deepStrictEqual(lex('ctx7 docs /a/b "use -o here" --json', false)[0].words, ["ctx7", "docs", "/a/b", "use -o here", "--json"]);
});
