// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Text contract tests for the reviewer finding format of harness-governance Tranche 4: the agents reviewer.md and
// code-reviewer.md, the Review Output Rules of skills/do/references/review-protocol.md, and the rejection handling of
// skills/do/SKILL.md. Task plan Step 37 (Steps 33 and 34).
//
// Sources: specs/spec-orchestration-review-gates.md (Change Log 2026-11-13 (Tranche 4), Requirement 15: Severity, confidence,
// and routing on each reviewer finding, scenarios Complete finding, Missing field rejected, Block-merge displayed, not
// enforced; Requirement 16: Reviewer returns SARIF content or findings), specs/spec-orchestration-dispatch.md (Change Log
// 2026-11-13 (Tranche 4), Requirement 17: Reject a reviewer report missing a severity field, scenario Reviewer report missing
// a field), the severity policy table (plugins/assist-plugin/rules/severity-policy.md), and
// docs/requirements/FR-NFR-harness-governance.md (FR-240, FR-239, FR-237, NFR-027, NFR-036). The specs carry no SPEC-NNN id,
// so they are cited by file name.
//
// Traceability format: [AC-N | spec Requirement | FR/NFR ids]. AC-N is the position of the Scenario inside its Requirement.
//
// The files are prompt text, so the tests read them as text and assert the binding strings: the field names, the routing
// table, the grants, and the rejection rule. The routing table in each agent is also checked against route() of
// hooks/lib/severity.js, the single routing authority the spec names.
//
// Run: node --test tests/skills/contracts-reviewer-severity.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const severity = require(path.join(PLUGIN, "hooks", "lib", "severity.js"));

const GATES = "spec-orchestration-review-gates.md Change Log 2026-11-13 (Tranche 4) Requirement 15";
const GATES16 = "spec-orchestration-review-gates.md Change Log 2026-11-13 (Tranche 4) Requirement 16";
const DISPATCH = "spec-orchestration-dispatch.md Change Log 2026-11-13 (Tranche 4) Requirement 17";

function read(rel) {
  return fs.readFileSync(path.join(PLUGIN, rel), "utf8");
}

function linesOf(text) {
  return text.split(/\r?\n/);
}

// Lines under a heading up to the next heading of the same or a higher level, outside code fences.
function section(text, heading) {
  const lines = linesOf(text);
  const level = /^(#+)/.exec(heading)[1].length;
  const out = [];
  let on = false;
  let fence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    if (!on) {
      if (!fence && l.trim() === heading) on = true;
      continue;
    }
    if (!fence) {
      const m = /^(#+)\s/.exec(l);
      if (m && m[1].length <= level) break;
    }
    out.push(l);
  }
  assert.ok(on, "heading not found: " + heading);
  return out.join("\n");
}

function frontMatterTools(text) {
  const m = /^tools:\s*\[(.*)\]\s*$/m.exec(text);
  assert.ok(m, "no tools: line in the front matter");
  return m[1].split(",").map((s) => s.trim());
}

const AGENTS = ["agents/reviewer.md", "agents/code-reviewer.md"];

// ---------------------------------------------------------------------------
// Both reviewers: every finding carries severity, confidence, and routing
// ---------------------------------------------------------------------------

AGENTS.forEach((rel) => {
  const text = read(rel);
  const format = section(text, "## Finding Format");

  test("[AC-1 | " + GATES + " | FR-240 | FR-239] " + rel + " Finding Format: every finding carries six fields, location, problem, fix, severity, confidence, and routing", () => {
    assert.ok(/Every finding carries six fields: location \(`file:line`\), problem, fix, `severity`, `confidence`, and `routing`/.test(format));
    assert.ok(/`severity`: CRITICAL, HIGH, MEDIUM, or LOW/.test(format));
    assert.ok(/`confidence`: High, Medium, or Low/.test(format));
    assert.ok(/`routing`: the value `route\(finding\)` in `hooks\/lib\/severity\.js` returns for the severity and confidence/.test(format));
    assert.ok(format.indexOf("rules/severity-policy.md") !== -1, "the values come from the severity policy");
  });

  test("[AC-1 | " + GATES + " | FR-240] " + rel + " Finding Format: the example finding shows all three fields", () => {
    assert.ok(format.indexOf("Example: `src/a.js:10 | user input reaches a shell string | pass an argument array | severity: HIGH | confidence: High | routing: block-merge`.") !== -1);
  });

  test("[AC-1 | " + GATES + " | FR-239 | FR-237] " + rel + " routing table equals route() of hooks/lib/severity.js for every row", () => {
    const rows = linesOf(format).filter((l) => /^\| (CRITICAL or HIGH|MEDIUM|LOW) \|/.test(l));
    assert.strictEqual(rows.length, 5, "the table holds five rows");
    const severitiesOf = (cell) => (cell === "CRITICAL or HIGH" ? ["CRITICAL", "HIGH"] : [cell]);
    const confidencesOf = (cell) => (cell === "any" ? ["High", "Medium", "Low"] : cell.split(" or "));
    rows.forEach((row) => {
      const cells = row.split("|").map((c) => c.trim());
      const routing = /`([a-z-]+)`/.exec(cells[3])[1];
      severitiesOf(cells[1]).forEach((s) => {
        confidencesOf(cells[2]).forEach((c) => {
          assert.strictEqual(severity.route({ severity: s, confidence: c }), routing, s + " at " + c + " in " + rel);
        });
      });
    });
  });

  test("[AC-3 | " + GATES + " | FR-240 | FR-237] " + rel + ": block-merge is displayed and recorded, not enforced this release; a rule blocks only after a user-run promotion", () => {
    assert.ok(/`block-merge` is displayed and recorded in the gate outcome and does not block the merge this release/.test(format));
    assert.ok(/a rule blocks only after a user-run promotion/.test(format));
  });

  test("[AC-2 | " + GATES + " | FR-240] " + rel + ": a report with a finding that lacks any of the three fields is a protocol error that /do rejects", () => {
    assert.ok(/A report with a finding that lacks any of the three fields is a protocol error: `\/do` rejects it and asks for a corrected report/.test(format));
  });

  test("[AC-1 | " + GATES + " | FR-240] " + rel + ": the Review state writes each finding with the six fields", () => {
    const row = linesOf(text).find((l) => /^\| Review \| model \|/.test(l));
    assert.ok(row, "no Review state row");
    assert.ok(/Write each finding as `file:line`, problem, fix, `severity`, `confidence`, `routing` \(see Finding Format\)/.test(row));
  });

  test("[AC-1 | " + GATES16 + " | FR-241 | NFR-027] " + rel + ": the agent returns findings in the reply and writes no file, and a finding with no location is listed at Low confidence at most", () => {
    assert.ok(/The agent returns findings in the reply and writes no file/.test(format));
    assert.ok(/List a finding with no file and line too, at Low confidence at most/.test(format));
    assert.ok(/A finding with no file and line is Low at most/.test(format));
  });

  test("[AC-1 | " + GATES + " | NFR-027] " + rel + " keeps tools Read, Grep, Glob, LSP and holds no write or shell tool", () => {
    const tools = frontMatterTools(text);
    assert.deepStrictEqual(tools, ["Read", "Grep", "Glob", "LSP"]);
    ["Write", "Edit", "MultiEdit", "NotebookEdit", "Bash", "PowerShell"].forEach((t) => assert.ok(tools.indexOf(t) === -1, rel + " holds " + t));
    assert.ok(/\*\*Tools:\*\* Read, Grep, Glob, LSP \(no write access, no shell\)/.test(text), "the Tools line says no write access and no shell");
  });
});

test("[AC-1 | " + GATES + " | FR-240] the two reviewers carry the same Finding Format section", () => {
  assert.strictEqual(section(read("agents/reviewer.md"), "## Finding Format"), section(read("agents/code-reviewer.md"), "## Finding Format"));
});

// ---------------------------------------------------------------------------
// review-protocol.md: Review Output Rules
// ---------------------------------------------------------------------------

const PROTOCOL = read("skills/do/references/review-protocol.md");
const RULES = section(PROTOCOL, "## Review Output Rules");

test("[AC-1 | " + GATES + " | FR-240 | FR-239] review-protocol.md Review Output Rules: each finding is location, problem, fix, plus severity, confidence, and routing", () => {
  assert.ok(/Each finding is location \(`file:line`\), problem, fix, plus `severity`, `confidence`, and `routing`/.test(RULES));
  const give = linesOf(RULES).find((l) => l.indexOf("- **Give each finding its severity, confidence, and routing.**") === 0);
  assert.ok(give, "no bullet that gives the field values");
  assert.ok(/`severity` is CRITICAL, HIGH, MEDIUM, or LOW/.test(give));
  assert.ok(/`confidence` is High, Medium, or Low/.test(give));
  assert.ok(/`routing` is `block-merge`, `inline-comment`, or `log-only`/.test(give));
  assert.ok(/`block-merge` only at confidence High and severity HIGH or CRITICAL/.test(give));
  assert.ok(give.indexOf("rules/severity-policy.md") !== -1);
});

test("[AC-2 | " + DISPATCH + " | FR-240] review-protocol.md Review Output Rules: an incomplete report is rejected and a corrected one is requested, as for a missing terminal block", () => {
  const reject = linesOf(RULES).find((l) => l.indexOf("- **Reject an incomplete report.**") === 0);
  assert.ok(reject, "no rejection bullet");
  assert.ok(/`\/do` rejects a `reviewer` or `code-reviewer` report in which any finding lacks `severity`, `confidence`, or `routing`, and asks for a corrected one/.test(reject));
  assert.ok(/as it does for a reply with no terminal block \(`no-terminal-block`\)/.test(reject));
  assert.ok(/It dispatches no fix and records no gate outcome from the incomplete report/.test(reject));
});

test("[AC-3 | " + GATES + " | FR-240 | FR-237] review-protocol.md Review Output Rules: block-merge does not block the merge this release", () => {
  assert.ok(/`block-merge` is displayed and recorded in the gate outcome and does not block the merge this release \(advisory only\)/.test(RULES));
});

// ---------------------------------------------------------------------------
// do/SKILL.md: rejection handling
// ---------------------------------------------------------------------------

const DO = read("skills/do/SKILL.md");
const REJECT = linesOf(DO).find((l) => l.indexOf("- **Incomplete reviewer report:**") === 0);

test("[AC-1 | " + DISPATCH + " | FR-240] do/SKILL.md has an Incomplete reviewer report bullet beside the no-terminal-block rule", () => {
  assert.ok(REJECT, "no Incomplete reviewer report bullet");
  const lines = linesOf(DO);
  const noBlock = lines.findIndex((l) => l.indexOf("- **No valid block:**") === 0);
  const incomplete = lines.indexOf(REJECT);
  assert.ok(noBlock >= 0 && incomplete > noBlock && incomplete - noBlock <= 2, "the rejection rule follows the no-valid-block rule");
});

test("[AC-1 | " + DISPATCH + " | FR-240] do/SKILL.md rejects a reviewer or code-reviewer report whose finding lacks severity, confidence, or routing", () => {
  assert.ok(/a `reviewer` or `code-reviewer` report in which any finding lacks `severity`, `confidence`, or `routing` is a protocol error/.test(REJECT));
  ["`severity`", "`confidence`", "`routing`"].forEach((field) => assert.ok(REJECT.indexOf(field) !== -1, "the rule names " + field));
});

test("[AC-1 | " + DISPATCH + " | FR-240] do/SKILL.md sends one SendMessage asking for a corrected report with all three fields on every finding, pasting the dispatch prompt text", () => {
  assert.ok(/send one SendMessage asking the agent for a corrected report with all three fields on every finding, pasting the "Dispatch prompt text"/.test(REJECT));
});

test("[AC-1 | " + DISPATCH + " | FR-240] do/SKILL.md dispatches no fix and records no gate outcome from the rejected report, and fails the step if the corrected report is still incomplete", () => {
  assert.ok(/Dispatch no fix and record no gate outcome from the rejected report/.test(REJECT));
  assert.ok(/If the corrected report is still incomplete, the step fails/.test(REJECT));
});

test("[AC-1 | " + DISPATCH + " | FR-240] do/SKILL.md applies the check to the report's shape, whether or not any rule is promoted to blocking", () => {
  assert.ok(/This check runs on the report's shape and applies whether or not any rule is promoted to blocking/.test(REJECT));
});

test("[AC-3 | " + GATES + " | FR-240 | FR-237] do/SKILL.md displays and records a block-merge routing in the step's Review field and does not block the merge this release", () => {
  assert.ok(/A `block-merge` routing in a complete report is displayed and recorded in the step's \*\*Review\*\* field and does not block the merge this release/.test(REJECT));
});

// ---------------------------------------------------------------------------
// The SARIF output of the reviewers (FR-241)
// ---------------------------------------------------------------------------

AGENTS.forEach((rel) => {
  test("[AC-1 | " + GATES16 + " | FR-241 | NFR-027] " + rel + " SARIF Output: the findings or a SARIF document are returned, no file is written, and /do converts and writes", () => {
    const out = section(read(rel), "## SARIF Output");
    assert.ok(/The report includes the findings with their file and line \(the `file:line` field of each finding\), or a SARIF 2\.1\.0 document built from them, in the reply/.test(out));
    assert.ok(/The agent returns it and writes no file/.test(out));
    assert.ok(/`\/do` orchestrator converts the content through `hooks\/lib\/sarif\.js` and writes `<root>\/\.agent\/reviews\/review-<slug>\.sarif`/.test(out));
    assert.ok(/A finding with no file and line goes in the report too and stays out of the SARIF, listed by `\/do` as not exported with the reason/.test(out));
  });
});

test("[AC-1 | " + GATES16 + " | FR-241] the level map the reviewers state matches the one in do/SKILL.md", () => {
  const sarif = section(DO, "### SARIF file");
  const rows = linesOf(sarif).filter((l) => /^\| (CRITICAL|HIGH|MEDIUM|LOW) \|/.test(l));
  assert.strictEqual(rows.length, 4);
  const map = {};
  rows.forEach((row) => {
    const cells = row.split("|").map((c) => c.trim());
    map[cells[1]] = /`([a-z]+)`/.exec(cells[2])[1];
  });
  assert.deepStrictEqual(map, { CRITICAL: "error", HIGH: "error", MEDIUM: "warning", LOW: "note" });
  AGENTS.forEach((rel) => {
    assert.ok(/CRITICAL and HIGH are `error`, MEDIUM is `warning`, LOW is `note`/.test(section(read(rel), "## SARIF Output")), rel);
  });
});
