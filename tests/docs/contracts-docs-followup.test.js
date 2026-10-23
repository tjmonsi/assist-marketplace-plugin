// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Text contract tests for the rules and documents changed by the follow-up to release 1.12.0 (task
// plan steps 14, 15, 17, 18, and 26): the open-gap row 2 and the LLM01 and LLM05 bullets of
// rules/llm-security-checklist.md, the Hook Fail-Open Rule wording of rules/assist-plugin-rule.md,
// the pr-post-ask bullets of CLAUDE.md and plugins/assist-plugin/Claude.md, the README section "PR
// posting prompt" and its Bitbucket sign-in lines, docs/SPECIFICATION.md, docs/ARCHITECTURE.md,
// docs/TOKEN_OPTIMIZATION.md, and the 11-script, 16-command counts in hooks/hooks.json, FR-086,
// and the BRD scope list.
//
// Sources: specs/spec-skills-pr-review.md (Requirement "LLM checklist states the direct-run PR
// gap"), specs/spec-hooks-platform.md (Change Log 2026-10-22: Hook registration, Guard decision and
// deny output), specs/spec-hooks-health-check.md (Auto-disable and re-enable),
// specs/spec-hooks-pr-post-ask.md (Requirement 9), docs/requirements/FR-NFR-assist-plugin.md
// (FR-086, FR-088, FR-091, FR-118, FR-206, FR-210, NFR-011), and the approved changes recorded in
// DECISIONS.md (2026-10-22):
//   - Row 2 of the open-gap table follows the FR-210 wording; the LLM01 bullet no longer claims a
//     confirmation gate; LLM05 names the --text="$(cat -- ...)" form and no --message-file.
//   - The Hook Fail-Open Rule has the ask clause; "## Write guard lists" is unchanged.
//   - CLAUDE.md and Claude.md carry a pr-post-ask bullet (best-effort, known gaps, fails open, deny
//     beats ask, unverified modes). TOKEN_OPTIMIZATION.md reads 11 scripts registered as 16
//     commands. README says bkt auth status lists contexts but does not test the token, exactly one
//     context whose host matches the remote, and a pin before any bkt pr or bkt api call.
//     SPECIFICATION.md says "may ask". The README known-gap list holds the 11 items of the header
//     comment of hooks/impl/pr-post-ask.js and names no bkt api gap.
//   - FR-086 (Statement line) and the BRD scope list read 11 hook scripts and 16 commands, built
//     for 1.13.0 (the requirements fold flipped them from PLANNED to Built). The Unverified
//     sentence reads "and whether an installed mod can approve a call the hook would prompt for".
//
// Traceability format: [Ax | Scenario title | spec section | FR/NFR ids]. Ax is the acceptance row
// of the task plan docs/task-plans/task-plan-post-1-12-0-followups-20261022-143806.md. The specs
// use named requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// The version-consistency checks stay in tests/docs/plugin-changelog.test.js and
// tests/docs/self-hosted-layout.test.js. This file reads the version from no file. Registration
// count tests of hooks.json itself live in tests/hooks/hooks-registration.test.js; this file only
// checks that the documents agree with the counts it computes from hooks.json.
//
// Run: node --test tests/docs/contracts-docs-followup.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");

// ---------------------------------------------------------------------------
// Readers and markdown helpers
// ---------------------------------------------------------------------------

function readRepo(rel) {
  return fs.readFileSync(path.join(REPO, rel), "utf8");
}

function read(rel) {
  return fs.readFileSync(path.join(PLUGIN, rel), "utf8");
}

function linesOf(text) {
  return text.split(/\r?\n/);
}

function joined(lines) {
  return lines.join("\n");
}

// Collapse every run of white space to one space.
function squash(text) {
  return text.replace(/\s+/g, " ");
}

// Drop the backticks, then collapse white space: lets a key form match across code spans.
function plain(text) {
  return squash(text.replace(/`/g, ""));
}

function headingLevel(line) {
  const m = /^(#{1,6})\s/.exec(line);
  return m ? m[1].length : 0;
}

// Lines under `heading` up to the next heading of the same or a higher level, outside code fences.
// The heading is compared as a trimmed line, or as a line prefix when `prefix` is true.
function section(text, heading, prefix) {
  const lines = linesOf(text);
  const level = headingLevel(heading + " ");
  const out = [];
  let inFence = false;
  let on = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      if (on) out.push(line);
      continue;
    }
    if (!inFence) {
      const t = line.trim();
      if (!on) {
        if (prefix ? t.indexOf(heading) === 0 : t === heading) on = true;
        continue;
      }
      const lv = headingLevel(line);
      if (lv > 0 && lv <= level) break;
    }
    if (on) out.push(line);
  }
  return out;
}

function splitRow(line) {
  let s = line.trim();
  if (s.charAt(0) === "|") s = s.slice(1);
  if (s.charAt(s.length - 1) === "|") s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim());
}

function has(text, key) {
  return key instanceof RegExp ? key.test(text) : text.indexOf(key) !== -1;
}

function assertHas(text, key, who) {
  assert.ok(has(text, key), who + ": missing " + String(key));
}

function assertLacks(text, key, who) {
  assert.ok(!has(text, key), who + ": still holds " + String(key));
}

// The argument-hint scalar of a SKILL.md front matter.
function skillHint(name) {
  const text = read("skills/" + name + "/SKILL.md");
  const m = /^argument-hint:\s*"(.*)"\s*$/m.exec(text);
  assert.ok(m, "skills/" + name + "/SKILL.md has no quoted argument-hint");
  return m[1];
}

// The hint of a catalog table row: the code span `/<name> <hint>` of the row for `**name**`, with the
// escaped pipes of the table cell turned back into pipes.
function catalogHint(text, name) {
  const row = linesOf(text).find((l) => l.indexOf("| **" + name + "** |") === 0);
  assert.ok(row, "no catalog row for " + name);
  const cell = splitRow(row)[1];
  const m = /^`\/[a-z-]+ (.*)`$/.exec(cell);
  assert.ok(m, "the command cell of " + name + " is not one code span: " + cell);
  return m[1].replace(/\\\|/g, "|");
}

// ---------------------------------------------------------------------------
// rules/llm-security-checklist.md (A19 | spec-skills-pr-review.md | FR-210, NFR-011)
// ---------------------------------------------------------------------------

const CHECKLIST = read("rules/llm-security-checklist.md");

function gapRows() {
  const rows = section(CHECKLIST, "## Open Gaps Found in This Audit")
    .filter((l) => /^\|\s*\d+\s*\|/.test(l))
    .map(splitRow);
  assert.ok(rows.length > 0, "the open-gap table holds no numbered row");
  return rows;
}

function row2() {
  const row = gapRows().find((cells) => cells[0] === "2");
  assert.ok(row, "no row 2 in the open-gap table");
  assert.strictEqual(row.length, 4, "a gap row has four cells: number, severity, category, gap");
  return row;
}

test("checklist open-gap row 2 keeps severity High and category LLM01", () => {
  // [A19 | Row 2 wording | spec-skills-pr-review.md "LLM checklist states the direct-run PR gap" | FR-210]
  const row = row2();
  assert.strictEqual(row[1], "High");
  assert.strictEqual(row[2], "LLM01");
});

test("checklist open-gap row 2 says the confirmation is a written rule only and unscoped Bash runs with no prompt", () => {
  // [A19 | Row 2 wording | spec-skills-pr-review.md | FR-210, NFR-013]
  const t = squash(row2()[3]);
  assertHas(t, "In a direct `/pr-review` run, attacker-controlled PR text reaches a session that can run the posting commands", "row 2");
  assertHas(t, "The confirmation before a verdict is a written rule only", "row 2");
  assertHas(t, "the skill holds unscoped Bash (an NFR-013 exception) that runs with no prompt", "row 2");
});

test("checklist open-gap row 2 does not describe the confirmation as a control that holds on its own", () => {
  // [A19 | Row 2 wording | spec-skills-pr-review.md | FR-210]
  const t = row2()[3];
  assertLacks(t, /confirmation gate/i, "row 2");
  assertLacks(t, /behind the/i, "row 2");
  assertLacks(CHECKLIST, "behind the confirmation gate", "llm-security-checklist.md");
});

test("checklist open-gap row 2 names pr-post-ask as a best-effort, fail-open control with listed gaps", () => {
  // [A19 | Row 2 wording | spec-skills-pr-review.md | FR-210, FR-206]
  const t = squash(row2()[3]);
  assertHas(t, "The `pr-post-ask` hook asks before `gh pr review`, `merge`, `comment`, and `close`, `bkt pr approve`, `comment`, `decline`, `close`, and `merge`, and a `bkt api` call that may write", "row 2");
  assertHas(t, "best-effort, fail-open control that does not rely on the model", "row 2");
  assertHas(t, "known gaps that FR-206 lists", "row 2");
});

test("checklist open-gap row 2 keeps the /do sentence and states the three facts in order", () => {
  // [A19 | Under /do | spec-skills-pr-review.md | FR-210]
  const t = squash(row2()[3]);
  assertHas(t, "Under `/do` the PR text goes to a file only the read-only `reviewer` reads, and `/do` posts only after the user confirms", "row 2");
  const a = t.indexOf("written rule only");
  const b = t.indexOf("unscoped Bash");
  const c = t.indexOf("pr-post-ask");
  const d = t.indexOf("Under `/do`");
  assert.ok(a >= 0 && a < b && b < c && c < d, "row 2 must state the written rule, the unscoped Bash, the hook, then the /do sentence");
});

test("checklist changes no other open-gap row: nine rows with the same severity and category", () => {
  // [A19 | Row 2 wording (change no other row) | spec-skills-pr-review.md | FR-210]
  const got = gapRows().map((cells) => [cells[0], cells[1], cells[2]]);
  assert.deepStrictEqual(got, [
    ["1", "Closed (was High)", "LLM06"],
    ["2", "High", "LLM01"],
    ["3", "High", "LLM02"],
    ["4", "Medium", "LLM09"],
    ["5", "Medium", "LLM09"],
    ["6", "Medium", "LLM10"],
    ["7", "Medium", "LLM04"],
    ["8", "Low", "LLM03"],
    ["9", "Low", "LLM05"],
  ]);
  // Row 7 is about writes to auto-loaded files and keeps its own 'confirmation gate' wording.
  assertHas(gapRows().find((c) => c[0] === "7")[3], "No confirmation gate on writes to auto-loaded `CLAUDE.md` / `rules/` files", "row 7");
});

test("checklist LLM01 pr-review bullet no longer claims a confirmation gate", () => {
  // [A19 | Row 2 wording | spec-skills-pr-review.md | FR-210; approved change: the :35 line states a written rule only]
  const text = squash(joined(section(CHECKLIST, "## LLM01: Prompt Injection")));
  const s = text.indexOf("- `skills/pr-review/SKILL.md`:");
  const e = text.indexOf("- `agents/researcher.md`:");
  assert.ok(s >= 0 && e > s, "the pr-review bullet of LLM01 is missing");
  const bullet = text.slice(s, e);
  assertHas(bullet, "the confirmation before a verdict is a written rule only", "LLM01 pr-review bullet");
  assertHas(bullet, "the best-effort, fail-open `pr-post-ask` hook asks before the posting command", "LLM01 pr-review bullet");
  assertHas(bullet, "Under `/do` the PR text goes to a scratch file that only the read-only `reviewer` reads, and `/do` posts only after the user confirms", "LLM01 pr-review bullet");
  assertLacks(bullet, /confirmation gate/i, "LLM01 pr-review bullet");
  assertLacks(bullet, /behind the/i, "LLM01 pr-review bullet");
});

test("checklist LLM05 names the --text=\"$(cat -- ...)\" form and no --message-file", () => {
  // [A19 | Row 2 wording (stale form) | spec-skills-pr-review.md; BKT forms | FR-203, FR-205, FR-210; approved change: LLM05 text]
  const text = squash(joined(section(CHECKLIST, "## LLM05: Improper Output Handling")));
  assert.ok(text.length > 0, "no LLM05 section");
  assertHas(text, "`gh pr review ... --body-file`", "LLM05");
  assertHas(text, "`bkt pr comment ... --text=\"$(cat -- '<run folder>/body.txt')\"`", "LLM05");
  assertLacks(CHECKLIST, "--message-file", "llm-security-checklist.md");
});

// ---------------------------------------------------------------------------
// rules/assist-plugin-rule.md (A6, A7 | spec-hooks-platform.md, spec-hooks-health-check.md | FR-088, FR-091, FR-206, NFR-011)
// ---------------------------------------------------------------------------

const RULE = read("rules/assist-plugin-rule.md");

function failOpenRule() {
  const rule = section(RULE, "## Hook Fail-Open Rule");
  assert.ok(rule.length > 0, "no ## Hook Fail-Open Rule section");
  return rule;
}

test("Hook Fail-Open Rule line allows an ask only through the ask JSON with exit 0 when evaluate returns ask: true", () => {
  // [A6 | Ask output; Deny wins over ask; Truthy ask that is not true | spec-hooks-platform.md "Guard decision and deny output" | FR-088, FR-206]
  const line = failOpenRule().find((l) => l.indexOf("- Deny only through the `permissionDecision: \"deny\"` JSON") === 0);
  assert.ok(line, "the deny-through-JSON requirement is missing");
  assertHas(line, "with exit 0 returned by the decision function `evaluate(input)` of a guard, whose only I/O is file reads that a test can replace", "rule line");
  assertHas(line, "a guard asks only through the `permissionDecision: \"ask\"` JSON with exit 0 when `evaluate` returns `ask: true` (the PR posting ask hook)", "rule line");
  assertHas(line, "never exit 2 and never exit non-zero to block", "rule line");
  assert.ok(line.indexOf("permissionDecision: \"deny\"") < line.indexOf("permissionDecision: \"ask\""), "the deny clause must come before the ask clause");
});

test("Hook Fail-Open Rule auto-disable line keeps its start and treats an ask on a known-safe command like a false deny", () => {
  // [A7 | A no-ask case asks; False ask disables the hook | spec-hooks-health-check.md "Auto-disable and re-enable" | FR-091, FR-118, FR-206]
  const line = failOpenRule().find((l) => l.indexOf("- A guard whose self-test denies a known-safe command") === 0);
  assert.ok(line, "the auto-disable requirement is missing or no longer starts with '- A guard whose self-test denies a known-safe command'");
  assertHas(line, "a guard whose self-test asks on a known-safe command (the PR posting ask hook) is treated like one that denies it", "rule line");
  assertHas(line, "a guard that only misses a known-prohibited command keeps its state", "rule line");
  assertHas(line, "`/assist-plugin:health` shows the state", "rule line");
});

test("assist-plugin-rule.md leaves '## Write guard lists' unchanged: four tables with their rows", () => {
  // [A6 | (Do not edit ## Write guard lists) | spec-hooks-platform.md Planned conformance | FR-088, FR-186]
  const guard = joined(section(RULE, "## Write guard lists"));
  assert.ok(guard.length > 0, "## Write guard lists is missing");
  const firstColumn = (heading) => section(guard, heading)
    .filter((l) => l.trim().charAt(0) === "|")
    .slice(2)
    .map((l) => splitRow(l)[0]);
  assert.deepStrictEqual(firstColumn("### Protected globs"), ["`**/.agent/main-plan/**`"]);
  assert.deepStrictEqual(firstColumn("### Protected files"), ["`DECISIONS.md`"]);
  assert.deepStrictEqual(firstColumn("### Auto-loaded names"), ["`CLAUDE.md`", "`CLAUDE.local.md`", "`AGENTS.md`"]);
  assert.deepStrictEqual(firstColumn("### Task-plan glob"), ["`docs/task-plans/task-plan-*.md`"]);
  assertHas(squash(guard), "`node plugins/assist-plugin/scripts/check-fsa-tables.js --check` exits 1 while the code differs", "Write guard lists intro");
  assertLacks(guard, "pr-post-ask", "Write guard lists");
});

// ---------------------------------------------------------------------------
// hooks/hooks.json and the counts in the documents (A9 | spec-hooks-platform.md "Hook registration" | FR-086, NFR-007)
// ---------------------------------------------------------------------------

const HOOKS = JSON.parse(read("hooks/hooks.json"));

function entries() {
  const out = [];
  Object.keys(HOOKS.hooks).forEach((event) => {
    HOOKS.hooks[event].forEach((group, gi) => {
      group.hooks.forEach((h, hi) => {
        const m = /hooks\/([a-z-]+)\.js"?(.*)$/.exec(h.command);
        out.push({
          event: event,
          matcher: group.matcher,
          group: event + "#" + gi,
          index: hi,
          type: h.type,
          timeout: h.timeout,
          script: m ? m[1] : null,
          arg: m ? m[2].trim() : "",
        });
      });
    });
  });
  return out;
}

function counts() {
  const all = entries();
  const scripts = {};
  all.forEach((e) => {
    assert.strictEqual(e.type, "command");
    assert.ok(e.script, "an entry runs no hooks/<script>.js");
    scripts[e.script] = true;
  });
  return { commands: all.length, scripts: Object.keys(scripts).length, names: Object.keys(scripts).sort() };
}

test("hooks.json registers 16 commands from 11 scripts with pr-post-ask in the Bash|PowerShell group after doc-cli-guard", () => {
  // [A9 | Registration count after the ask hook; Timeouts with the ask hook | spec-hooks-platform.md "Hook registration" | FR-086, FR-206, NFR-007]
  const c = counts();
  assert.strictEqual(c.commands, 16);
  assert.strictEqual(c.scripts, 11);
  assert.ok(c.names.indexOf("pr-post-ask") !== -1);
  const all = entries();
  const ask = all.filter((e) => e.script === "pr-post-ask");
  assert.strictEqual(ask.length, 1, "pr-post-ask must be registered once");
  assert.strictEqual(ask[0].event, "PreToolUse");
  assert.strictEqual(ask[0].matcher, "Bash|PowerShell");
  assert.strictEqual(ask[0].arg, "");
  const prev = all.find((e) => e.group === ask[0].group && e.index === ask[0].index - 1);
  assert.ok(prev && prev.script === "doc-cli-guard", "pr-post-ask must follow doc-cli-guard in its group");
  all.forEach((e) => {
    const expected = e.script === "health-check" && e.arg === "--session-start" ? 10 : 5;
    assert.strictEqual(e.timeout, expected, e.script + " timeout");
  });
});

test("TOKEN_OPTIMIZATION.md states the hooks.json counts and names pr-post-ask.js", () => {
  // [A9 | Registration count after the ask hook | spec-hooks-platform.md Planned conformance | FR-086, FR-206]
  const text = squash(read("docs/TOKEN_OPTIMIZATION.md"));
  const m = /(\d+) scripts registered as (\d+) commands in `hooks\/hooks\.json`/.exec(text);
  assert.ok(m, "no '<n> scripts registered as <m> commands in `hooks/hooks.json`' sentence");
  const c = counts();
  assert.strictEqual(m[1], String(c.scripts));
  assert.strictEqual(m[2], String(c.commands));
  assert.strictEqual(m[1] + "/" + m[2], "11/16");
  assertHas(text, "`pr-post-ask.js` asks, and never denies, before a `gh` or `bkt` command that posts to, merges, or closes a pull request", "TOKEN_OPTIMIZATION.md");
  assertLacks(text, /\b10 scripts\b/, "TOKEN_OPTIMIZATION.md");
  assertLacks(text, /\b15 commands\b/, "TOKEN_OPTIMIZATION.md");
});

function frBlock(heading) {
  const lines = linesOf(readRepo("docs/requirements/FR-NFR-assist-plugin.md"));
  const at = lines.findIndex((l) => l.indexOf(heading) === 0);
  assert.ok(at >= 0, "no heading " + heading + " in FR-NFR");
  let end = lines.length;
  for (let i = at + 1; i < lines.length; i++) {
    if (/^### /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(at, end);
}

test("FR-086 Statement reads 11 hook scripts as 16 commands (built for 1.13.0) and agrees with hooks.json", () => {
  // [A9 | Registration count after the ask hook; Count in the BRD scope list | spec-hooks-platform.md "Hook registration" | FR-086]
  const block = frBlock("### FR-086");
  const statement = block.find((l) => l.indexOf("**Statement:**") === 0);
  assert.ok(statement, "FR-086 has no Statement line");
  const c = counts();
  const want = c.scripts + " hook scripts as " + c.commands + " commands";
  assert.strictEqual(want, "11 hook scripts as 16 commands");
  assertHas(statement, "The plugin SHALL register " + want + " in `hooks/hooks.json`", "FR-086 Statement");
  assertHas(statement, "built for 1.13.0", "FR-086 Statement");
  assertLacks(statement, "PLANNED", "FR-086 Statement");
  assertHas(joined(block), "the count SHALL be 16 across 11 scripts, the added script being the posting ask hook, and the BRD scope list SHALL state 11 scripts and 16 commands", "FR-086 scenario");
});

test("BRD scope list reads 11 hook scripts (16 hook commands), built in 1.13.0", () => {
  // [A9 | Count in the BRD scope list | spec-hooks-platform.md "Hook registration" | FR-086]
  const line = linesOf(readRepo("docs/requirements/BRD-assist-plugin.md")).find((l) => l.indexOf("hook scripts") !== -1 && l.indexOf("`hooks/hooks.json`") !== -1);
  assert.ok(line, "no hook scripts line in the BRD scope list");
  const c = counts();
  const want = "The " + c.scripts + " hook scripts (" + c.commands + " hook commands) in `hooks/hooks.json`";
  assert.strictEqual(want, "The 11 hook scripts (16 hook commands) in `hooks/hooks.json`");
  assertHas(line, want, "BRD scope list");
  assertHas(line, "Built, 1.13.0", "BRD scope list");
  assertLacks(line, "PLANNED", "BRD scope list");
});

test("CLAUDE.md, Claude.md, and README.md state no hook count", () => {
  // [A9 | Count in the BRD scope list (CLAUDE.md and README.md state no hook count) | spec-hooks-platform.md | FR-086]
  [["CLAUDE.md", readRepo("CLAUDE.md")], ["plugins/assist-plugin/Claude.md", read("Claude.md")], ["README.md", readRepo("README.md")]].forEach((pair) => {
    assertLacks(pair[1], /\b\d+ (hook )?(scripts|commands)\b/, pair[0]);
  });
});

// ---------------------------------------------------------------------------
// CLAUDE.md and plugins/assist-plugin/Claude.md (A9 | spec-hooks-platform.md | FR-086, FR-206, NFR-011)
// ---------------------------------------------------------------------------

const CLAUDE = readRepo("CLAUDE.md");
const PLUGIN_CLAUDE = read("Claude.md");

function askBullet(text, who) {
  const lines = linesOf(text);
  const at = lines.findIndex((l) => l.indexOf("- **pr-post-ask** ") === 0);
  assert.ok(at >= 0, who + " has no '- **pr-post-ask**' bullet");
  return { at: at, line: lines[at], lines: lines };
}

[["CLAUDE.md", CLAUDE], ["plugins/assist-plugin/Claude.md", PLUGIN_CLAUDE]].forEach((pair) => {
  test(pair[0] + " has a pr-post-ask bullet after doc-cli-guard", () => {
    // [A9 | Registration count after the ask hook (documents) | spec-hooks-platform.md | FR-206, FR-086]
    const b = askBullet(pair[1], pair[0]);
    assert.ok(b.lines[b.at - 1].indexOf("- **doc-cli-guard** ") === 0, "the pr-post-ask bullet must follow the doc-cli-guard bullet");
  });

  test(pair[0] + " pr-post-ask bullet states the scope, the commands, and the best-effort limits", () => {
    // [A6 | Never denies | spec-hooks-pr-post-ask.md Requirement 7 | FR-206, FR-088]
    const t = askBullet(pair[1], pair[0]).line;
    assertHas(t, "(PreToolUse on `Bash` and `PowerShell`, every session and every agent)", pair[0]);
    assertHas(t, "asks (never denies) before `gh pr review`, `merge`, `comment`, and `close`, `bkt pr approve`, `comment`, `decline`, `close`, and `merge`, and a `bkt api` call that may write", pair[0]);
    assertHas(t, "Best-effort, known gaps, fails open", pair[0]);
    assertHas(t, "The health check self-tests it as a guard", pair[0]);
  });

  test(pair[0] + " pr-post-ask bullet says a deny from another hook wins and lists the unverified modes", () => {
    // [A6 | Deny wins over ask | spec-hooks-platform.md "Guard decision and deny output"; DECISIONS.md unverified modes | FR-206, FR-088]
    const t = askBullet(pair[1], pair[0]).line;
    assertHas(t, "A deny from another hook wins over its ask", pair[0]);
    const at = t.indexOf("Unverified:");
    assert.ok(at >= 0, pair[0] + ": no 'Unverified:' sentence");
    assertHas(t.slice(at), "`bypassPermissions` mode or plan mode", pair[0]);
    assertHas(t.slice(at), "and whether an installed mod can approve a call the hook would prompt for", pair[0]);
  });

  test(pair[0] + " keeps 'All hooks fail open' and the /bump row hint equal to the bump argument-hint", () => {
    // [A9 | (existing bullets kept; /bump hint unchanged) | spec-hooks-platform.md; spec-skills-git.md | FR-086, FR-138]
    assertHas(pair[1], "- All hooks fail open.", pair[0]);
    const hint = skillHint("bump");
    assert.strictEqual(catalogHint(pair[1], "bump"), hint);
    assertHas(hint, "[--path PATH]", "bump argument-hint");
  });
});

test("CLAUDE.md and Claude.md carry the same pr-post-ask bullet", () => {
  // [A9 | (every known-gap statement kept equal) | DECISIONS.md 2026-10-22 | FR-206]
  assert.strictEqual(askBullet(CLAUDE, "CLAUDE.md").line, askBullet(PLUGIN_CLAUDE, "Claude.md").line);
});

// ---------------------------------------------------------------------------
// README.md (A9, A7 | spec-hooks-pr-post-ask.md Requirement 9 | FR-086, FR-202, FR-206)
// ---------------------------------------------------------------------------

const README = readRepo("README.md");

function prPostingSection() {
  const lines = section(README, "### PR posting prompt");
  assert.ok(lines.length > 0, "README.md has no '### PR posting prompt' section");
  return lines;
}

// Key forms per known gap, in the order of the hook header (see the same table in
// tests/skills/contracts-bump-health-followup.test.js). `all` must appear in the hook header item
// and in each documentation item; `docs` must appear in each documentation item only.
const KEY_FORMS = [
  { name: "program word from a variable or expression", all: ["program word taken from a variable or an expression", "PowerShell splatting"], docs: [] },
  { name: "gh api, gh pr edit, aliases, other bkt pr subcommands", all: ["gh api", "gh pr edit", "gh alias or extension", "subcommands other than"], docs: ["gh pr ready", "gh pr reopen"] },
  { name: "command string run by another program, argv wrappers", all: ["command string run by another program", "bash -c", "eval", "Invoke-Expression", "xargs", "find -exec", "argv wrappers outside the", "setsid", "doas", "ionice", "stdbuf --output"], docs: ["sh -c", "pwsh -Command", "cmd /c"] },
  { name: "substitution inside another program's argument", all: ["another program's argument", "echo $(gh pr merge 1)"], docs: [] },
  { name: "Bash program name in another case, shims, aliases, renamed binaries", all: [/\bGH\b/, ".cmd", ".bat", ".ps1", "shell aliases", "renamed or linked binaries"], docs: [] },
  { name: "option with a separate value ahead of the verb", all: ["separate value ahead of the verb", "gh --body x pr comment 1", "bkt pr --text x comment 1"], docs: ["gh pr --body x comment 1", "gh pr -b x comment 1", "gh pr --body-file f review 1 --approve"] },
  { name: "redirection the shared lexer splits", all: ["redirection the shared lexer splits into separate parts", "gh 2>&1 pr merge 1", "gh >&2 pr merge 1", "gh &>/dev/null pr merge 1", "gh >| out pr merge 1", "bkt 2>&1 pr approve 1", "gh < <(true) pr merge 1"], docs: [] },
  { name: "PowerShell array or script block in the verb position", all: ["PowerShell array or script block in the verb position", "gh pr @('merge') 1", "gh pr {merge} 1", "PowerShell comment that hides an opening parenthesis"], docs: [] },
  { name: "quoting forms, brace expansion, glob, arithmetic heredoc, sudo --user", all: ["$\"gh\"", "$'g\\x68'", "brace expansion", "glob in the program word", "(( x = 1 << 2 ))", "sudo --user"], docs: ["{gh,pr,merge,1}", "/usr/bin/g[h]"] },
  { name: "PowerShell forms of doc-cli-guard, redirection before the program", all: ["PowerShell forms listed for doc-cli-guard", "redirection before the program"], docs: ["2>/dev/null gh pr merge 1"] },
  { name: "REST request through curl, HTTP client, or MCP tool", all: ["REST", "curl", "another HTTP client, or an MCP tool"], docs: [] },
];

// The known-gap items of the header comment of hooks/impl/pr-post-ask.js: the lines that start with
// "//   - " after "// Known gaps", with continuation lines joined. Only the header is read.
function hookHeaderGaps() {
  const lines = linesOf(read("hooks/impl/pr-post-ask.js"));
  const end = lines.findIndex((l) => l.trim() === "\"use strict\";");
  assert.ok(end > 0, "hooks/impl/pr-post-ask.js has no \"use strict\" line after its header");
  const header = lines.slice(0, end);
  const start = header.findIndex((l) => /^\/\/ Known gaps/.test(l));
  assert.ok(start >= 0, "the header of pr-post-ask.js has no '// Known gaps' line");
  const items = [];
  for (let i = start + 1; i < header.length; i++) {
    if (/^\/\/ {3}- /.test(header[i])) {
      items.push(header[i].replace(/^\/\/ {3}- /, ""));
    } else if (/^\/\/ {5}\S/.test(header[i]) && items.length > 0) {
      items[items.length - 1] += " " + header[i].replace(/^\/\/\s+/, "");
    } else {
      break;
    }
  }
  return items.map(plain);
}

// Split on ";" outside parentheses.
function splitTopLevel(text) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === ";" && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function readmeGapBullet() {
  const bullet = prPostingSection().find((l) => l.indexOf("- **Known gaps") === 0);
  assert.ok(bullet, "the README section has no '- **Known gaps' bullet");
  return plain(bullet);
}

function readmeGapItems() {
  const t = readmeGapBullet();
  const at = t.indexOf("):** ");
  assert.ok(at >= 0, "the Known gaps label does not end with '):** '");
  return splitTopLevel(t.slice(at + 5).replace(/\.\s*$/, ""));
}

test("README 'PR posting prompt' section describes the hook, every session, and that it never denies", () => {
  // [A9 | Registration count after the ask hook (documents) | spec-hooks-platform.md | FR-206, FR-086]
  const intro = squash(joined(prPostingSection()));
  assertHas(intro, "The `pr-post-ask` hook (PreToolUse on `Bash` and `PowerShell`) asks you before a command that posts to, merges, or closes a pull request runs", "README");
  assertHas(intro, "It covers every session and every agent", "README");
  assertHas(intro, "It asks and never denies, and it fails open like the other hooks", "README");
});

test("README 'PR posting prompt' lists the commands it asks before and when a bkt api call passes", () => {
  // [A9 | Registration count after the ask hook (documents) | spec-hooks-pr-post-ask.md Requirements 4 to 6 | FR-206]
  const bullet = prPostingSection().find((l) => l.indexOf("- **Asks before:**") === 0);
  assert.ok(bullet, "no '- **Asks before:**' bullet");
  const t = squash(bullet);
  ["`gh pr review`", "`gh pr merge`", "`gh pr comment`", "`gh pr close`", "`bkt pr approve`", "`bkt pr comment`", "`bkt pr decline`", "`bkt pr close`", "`bkt pr merge`", "a `bkt api` call that may write"].forEach((k) => assertHas(t, k, "Asks before"));
  assertHas(t, "no body option, no option the hook does not recognize, and the method absent, GET, or HEAD", "Asks before");
});

test("README known-gap list holds the 11 items of the hook header, with each key form, and no bkt api gap", () => {
  // [A7 | Known gap passes | spec-hooks-pr-post-ask.md Requirement 9 | FR-206; approved change: the final 11-item list]
  const header = hookHeaderGaps();
  assert.strictEqual(header.length, 11, "the hook header lists " + header.length + " known gaps, expected 11");
  KEY_FORMS.forEach((kf, i) => {
    kf.all.forEach((k) => assertHas(header[i], k, "header item " + (i + 1) + " (" + kf.name + ")"));
  });
  const items = readmeGapItems();
  assert.strictEqual(items.length, 11, "the README lists " + items.length + " known gaps, expected 11");
  KEY_FORMS.forEach((kf, i) => {
    kf.all.concat(kf.docs).forEach((k) => assertHas(items[i], k, "README gap item " + (i + 1) + " (" + kf.name + ")"));
  });
  assert.ok(items.join(" ").indexOf("bkt api") === -1, "the README lists a bkt api gap");
  assert.ok(header.join(" ").indexOf("bkt api") === -1, "the hook header lists a bkt api gap");
});

test("README known-gap label says best-effort, not a security boundary, and that later-found forms are added", () => {
  // [A7 | Known gap passes | spec-hooks-pr-post-ask.md Requirement 9 | FR-206; DECISIONS.md 2026-10-22 best-effort guard]
  const t = readmeGapBullet();
  assertHas(t, "Known gaps (best-effort, not a security boundary; a bypass form found later is added to this list)", "Known gaps label");
});

test("README 'PR posting prompt' lists the unverified items and says a deny from another hook beats the ask", () => {
  // [A6 | Deny wins over ask | spec-hooks-platform.md "Guard decision and deny output"; DECISIONS.md unverified modes | FR-206, FR-088]
  const bullet = prPostingSection().find((l) => l.indexOf("- **Unverified gaps:**") === 0);
  assert.ok(bullet, "no '- **Unverified gaps:**' bullet");
  const t = squash(bullet);
  assertHas(t, "whether an ask prompts in `bypassPermissions` mode or plan mode", "Unverified gaps");
  assertHas(t, "whether an installed mod can approve a call the hook would prompt for", "Unverified gaps");
  assertHas(t, "A deny from another hook beats the ask", "Unverified gaps");
});

test("README 'PR posting prompt' describes the self-test: 27 cases, false ask disables, missed ask keeps it enabled", () => {
  // [A7 | Self-test cases; False ask disables the hook; Missed ask is weak protection | spec-hooks-pr-post-ask.md Requirement 8 | FR-206, FR-091, FR-118]
  const bullet = prPostingSection().find((l) => l.indexOf("- **Self-test:**") === 0);
  assert.ok(bullet, "no '- **Self-test:**' bullet");
  const t = squash(bullet);
  assertHas(t, "27 fixed cases", "Self-test");
  assertHas(t, "A known-safe command that asks disables the hook until a later self-test passes", "Self-test");
  assertHas(t, "a posting command that does not ask leaves it enabled and reports weak protection", "Self-test");
});

test("README 'Hook health' section says pr-post-ask never blocks and links to the prompt section", () => {
  // [A9 | Registration count after the ask hook (documents) | spec-hooks-platform.md | FR-206]
  const t = squash(joined(section(README, "## Hook health")));
  assertHas(t, "The `pr-post-ask` guard never blocks: it asks first (see [PR posting prompt](#pr-posting-prompt))", "Hook health");
});

test("README lists hooks/pr-post-ask.js in the file list and the tree", () => {
  // [A9 | Registration count after the ask hook (documents) | spec-hooks-platform.md | FR-086, FR-206]
  assertHas(README, "`hooks/pr-post-ask.js`", "README file list");
  assertHas(README, "pr-post-ask.js (entry: asks before PR posting commands)", "README tree");
  assertHas(README, "impl/ (guard, PR posting ask,", "README tree impl line");
  assert.ok(fs.existsSync(path.join(PLUGIN, "hooks", "pr-post-ask.js")), "hooks/pr-post-ask.js is missing");
});

test("README Bitbucket lines: auth status does not test the token, one matching context, a pin before any bkt pr or bkt api call", () => {
  // [A9 | (documents; FR-202 sign-in lines) | spec-skills-pr-review.md Bitbucket command forms, Bitbucket host pin | FR-202, FR-203]
  const t = squash(README);
  assertHas(t, "`bkt auth status` lists contexts but does not test the token", "README");
  assertHas(t, "`bkt auth login` creates no context, so for Bitbucket also run `bkt context create <name> --host <host> ... --set-active`", "README");
  assertHas(t, "need exactly one context whose host matches the remote", "README");
  assertHas(t, "pins the Bitbucket host to one `bkt` context before any `bkt pr` or `bkt api` call", "README");
  assertHas(t, "If you reject the `pr-post-ask` prompt for a post, the step reports the post as declined, not failed", "README");
});

// ---------------------------------------------------------------------------
// docs/SPECIFICATION.md and docs/ARCHITECTURE.md (A9 | spec-hooks-platform.md | FR-086, FR-206)
// ---------------------------------------------------------------------------

test("SPECIFICATION.md says pr-post-ask may ask, a rejected prompt is declined, and the PR files are removed", () => {
  // [A9 | (documents) | spec-orchestration-dispatch.md Requirement 14; spec-hooks-pr-post-ask.md | FR-206, FR-195]
  const text = squash(read("docs/SPECIFICATION.md"));
  assertHas(text, "`pr-post-ask` may ask before each post, a rejected prompt makes the post `declined`, not failed", "SPECIFICATION.md");
  assertHas(text, "host pinned to one `bkt` context before any `bkt pr` or `bkt api` call", "SPECIFICATION.md");
  assertHas(text, "the PR files under `.agent/pr-review/` are removed after use and at Cleanup", "SPECIFICATION.md");
});

test("SPECIFICATION.md lists pr-post-ask in the guard self-tests and keeps the fail-open and auto-disable statements", () => {
  // [A7 | False ask disables the hook; Missed ask is weak protection | spec-hooks-health-check.md | FR-091, FR-118, FR-206]
  const text = squash(read("docs/SPECIFICATION.md"));
  assertHas(text, "Run `hooks/health-check.js` (self-tests `sa-mermaid-only`, `doc-cli-guard`, `pr-post-ask`, `commit-attribution-guard`,", "SPECIFICATION.md self-test list");
  assertHas(text, "A guard whose self-test denies, or for `pr-post-ask` asks on, a known-safe command is disabled via `hooks-disabled.json` until a later self-test passes (an ask on a known-safe command counts as a false deny)", "SPECIFICATION.md auto-disable");
  assertHas(text, "A posting command that `pr-post-ask` does not ask on leaves it enabled and reports weak protection", "SPECIFICATION.md weak protection");
});

test("ARCHITECTURE.md has a PR posting ask bullet right after the Write guards bullet", () => {
  // [A9 | (documents) | spec-hooks-platform.md | FR-206, NFR-011]
  const lines = linesOf(read("docs/ARCHITECTURE.md"));
  const guards = lines.findIndex((l) => l.indexOf("- **Write guards:**") === 0);
  assert.ok(guards >= 0, "no Write guards bullet");
  const bullet = lines[guards + 1];
  assert.ok(bullet.indexOf("- **PR posting ask:**") === 0, "the bullet after Write guards is not '- **PR posting ask:**'");
  const t = squash(bullet);
  assertHas(t, "`pr-post-ask` (PreToolUse on `Bash` and `PowerShell`, every session and every agent) asks, and never denies, before `gh pr review`, `merge`, `comment`, and `close`, `bkt pr approve`, `comment`, `decline`, `close`, and `merge`, and a `bkt api` call that may write", "ARCHITECTURE.md");
  assertHas(t, "best-effort guardrail that fails open, lists its known gaps, and a deny from another hook wins over its ask", "ARCHITECTURE.md");
  assertHas(t, "Unverified: whether the prompt appears in `bypassPermissions` mode or plan mode, and whether an installed mod can approve a call the hook would prompt for", "ARCHITECTURE.md");
});
