// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Contract tests for the commit workflow's staging and secret-scan rules (harness-governance Tranche 1,
// Steps 5 and 6): plugins/assist-plugin/skills/commit/SKILL.md, and the bump release flow that stages files
// (plugins/assist-plugin/skills/bump/references/bump-strategy.md).
//
// Sources: docs/requirements/FR-NFR-harness-governance.md, section 2.2 (FR-215: Named paths staged, Request
// to stage everything) and section 2.4 (FR-217: Clean scan commits, Staged secret stops the commit, Scanner
// unavailable; NFR-031). Task plan: docs/task-plans/task-plan-harness-governance-20261028-0759.md, Steps 5, 6,
// and 9.
//
// Traceability format: [FR-ids | AC section | Scenario title]. The requirement document uses numbered
// acceptance sections and carries no SPEC-NNN id for this feature, so none is cited.
//
// Each test reads a documented file and asserts a binding string (a command form, a stated rule, a table row,
// an order of steps). No test asserts prose wording beyond the quoted rule.
//
// Run: node --test tests/skills/contracts-commit-staging.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");

function read(rel) {
  return fs.readFileSync(path.join(PLUGIN, rel), "utf8");
}

const SKILL = read("skills/commit/SKILL.md");
const BUMP = read("skills/bump/references/bump-strategy.md");

function linesOf(text) {
  return text.split("\n");
}

// The text between a heading line and the next heading of the same or higher level.
function section(text, heading) {
  const level = /^#+/.exec(heading)[0].length;
  const lines = linesOf(text);
  const start = lines.findIndex((l) => l.trim() === heading);
  assert.ok(start >= 0, "heading not found: " + heading);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const m = /^(#+) /.exec(lines[i]);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n");
}

const WORKFLOW = section(SKILL, "## Workflow");
const CONSTRAINTS = section(SKILL, "## Constraints");
const SCAN = section(SKILL, "## Secret Scan");

function workflowStep(n) {
  const re = new RegExp("^" + n + "\\. ");
  const line = linesOf(WORKFLOW).find((l) => re.test(l));
  assert.ok(line, "workflow step " + n + " not found");
  return line;
}

// ---------------------------------------------------------------------------
// FR-215: stage only named paths
// ---------------------------------------------------------------------------

test("[FR-215 | 2.2 | Named paths staged] workflow step 1 lists changes with git status --porcelain, asks which to stage, and stages exactly those with git add -- <named paths>", () => {
  const step = workflowStep(1);
  assert.ok(step.indexOf("`git status --porcelain`") !== -1, step);
  assert.ok(/ask which to stage/.test(step), step);
  assert.ok(step.indexOf("`git add -- <named paths>`") !== -1, step);
  assert.ok(/exactly those/.test(step), step);
});

test("[FR-215 | 2.2 | Request to stage everything] a request to commit everything lists the paths, asks, and stages nothing until paths are named", () => {
  const step = workflowStep(1);
  assert.ok(/"commit everything"/.test(step), "the commit-everything request is named: " + step);
  assert.ok(/lists the paths and asks/.test(step), step);
  assert.ok(/stages nothing until paths are named/.test(step), step);
});

test("[FR-215 | 2.2 | Request to stage everything] the Constraints section bars git add ., git add -A, and git add --all", () => {
  assert.ok(CONSTRAINTS.indexOf("Never run `git add .`, `git add -A`, or `git add --all`") !== -1, CONSTRAINTS);
  assert.ok(/Stage only paths the user named or accepted from the listed changes/.test(CONSTRAINTS), CONSTRAINTS);
});

test("[FR-215 | 2.2 | Request to stage everything] outside the prohibition, no line of the skill runs a blanket git add form", () => {
  // Negative scan: every `git add` mention is either the named-path form or the prohibition itself.
  const offenders = [];
  linesOf(SKILL).forEach((line, i) => {
    if (!/git add/.test(line)) return;
    const isNamedForm = /git add -- /.test(line);
    const isProhibition = /\bNever\b|\bnever\b|\bbars?\b|must not|MUST NOT/.test(line);
    if (!isNamedForm && !isProhibition) offenders.push("line " + (i + 1) + ": " + line);
  });
  assert.deepStrictEqual(offenders, []);
});

test("[FR-215 | 2.2 | Named paths staged] the skill never tells the user to commit with -a, --all, or -am (a commit flag that stages tracked files)", () => {
  assert.ok(!/git commit\b[^\n`]*\s(-a|-am|--all)\b/.test(SKILL), "git commit -a form found");
  assert.ok(!/git commit -[a-z]*a[a-z]*\b/.test(SKILL.replace(/git commit -m\b/g, "")), "a combined short flag with a");
});

test("[FR-215 | 2.2 | Named paths staged] the bump flow stages named release files only (git add -- <files>)", () => {
  const adds = linesOf(BUMP).filter((l) => /git add/.test(l));
  assert.ok(adds.length >= 1, "bump-strategy.md has a staging line");
  adds.forEach((l) => {
    assert.ok(/git add -- \S+/.test(l), "bump staging is not path-scoped: " + l);
    assert.ok(!/git add (\.|-A|--all)(\s|$)/.test(l), "blanket staging in bump: " + l);
  });
});

// ---------------------------------------------------------------------------
// Order: stage, then scan, then commit
// ---------------------------------------------------------------------------

test("[FR-215 | FR-217 | 2.2 | 2.4 | Clean scan commits] the workflow order is stage (1), scan (2), then the commit steps", () => {
  const stage = workflowStep(1);
  const scanStep = workflowStep(2);
  const run = workflowStep(3);
  assert.ok(/stage/i.test(stage));
  assert.ok(/Scan the staged changes for secrets/.test(scanStep), scanStep);
  assert.ok(/Stop on exit 1 or exit 2; create no commit/.test(scanStep), scanStep);
  assert.ok(/`\/commit`/.test(run), run);
  const order = linesOf(WORKFLOW);
  assert.ok(order.indexOf(stage) < order.indexOf(scanStep) && order.indexOf(scanStep) < order.indexOf(run));
});

// ---------------------------------------------------------------------------
// FR-217: the secret scan's three outcomes
// ---------------------------------------------------------------------------

test("[FR-217 | 2.4 | Clean scan commits] the scan step runs the in-plugin script from the plugin root", () => {
  assert.ok(SCAN.indexOf("node \"${CLAUDE_PLUGIN_ROOT}/scripts/scan-staged-secrets.js\"") !== -1, SCAN);
  assert.ok(fs.existsSync(path.join(PLUGIN, "scripts", "scan-staged-secrets.js")), "the script ships with the plugin");
});

test("[FR-217 | 2.4 | Clean scan commits | Staged secret stops the commit | Scanner unavailable] the outcome table maps exit 0 to continue, exit 1 to stop, and exit 2 to stop", () => {
  const rows = linesOf(SCAN).filter((l) => /^\| [012] \|/.test(l));
  assert.strictEqual(rows.length, 3, "three exit rows: " + rows.join("\n"));
  const byExit = {};
  rows.forEach((r) => {
    byExit[/^\| ([012]) \|/.exec(r)[1]] = r;
  });
  assert.ok(/clean/.test(byExit[0]) && /Continue to the commit step/.test(byExit[0]), byExit[0]);
  assert.ok(/findings/.test(byExit[1]) && /Stop with no commit/.test(byExit[1]), byExit[1]);
  assert.ok(/cannot run/.test(byExit[2]) && /Stop with no commit/.test(byExit[2]), byExit[2]);
});

test("[FR-217 | 2.4 | Scanner unavailable] exit 2 tells the user the scan did not run and never assumes it would have passed", () => {
  const row = linesOf(SCAN).find((l) => /^\| 2 \|/.test(l));
  assert.ok(/Tell the user the scan did not run/.test(row), row);
  assert.ok(/Never commit on the assumption that the scan would have passed/.test(row), row);
});

test("[FR-217 | 2.4 | Staged secret stops the commit] a finding is reported by path and rule name; the value, the matching line, and the diff text are never shown", () => {
  assert.ok(/Report each printed path and rule name/.test(SCAN), SCAN);
  assert.ok(/Report only the file path and rule name \[NFR-031\]/.test(SCAN), SCAN);
  assert.ok(/Never show, quote, or log the matched value, the matching line, or the diff text/.test(SCAN), SCAN);
  assert.ok(/Do not run `git diff --cached` to look for the value/.test(SCAN), SCAN);
});

test("[FR-217 | 2.4 | Staged secret stops the commit] the Constraints section forbids a commit after a finding or a scan that cannot run", () => {
  assert.ok(/Never commit when the secret scan reports a finding \(exit 1\) or cannot run \(exit 2\)/.test(CONSTRAINTS), CONSTRAINTS);
});

test("[FR-217 | 2.4 | Scanner unavailable] a substituted external scanner keeps the same three outcomes, and one that is not installed counts as cannot-run", () => {
  assert.ok(/gitleaks or trufflehog/.test(SCAN), SCAN);
  assert.ok(/same three outcomes: clean \(0\), findings \(1\), cannot run \(2\)/.test(SCAN), SCAN);
  assert.ok(/A scanner that is not installed is cannot run/.test(SCAN), SCAN);
});

test("[FR-217 | 2.4 | Clean scan commits] the scan adds no tool grant beyond the skill's existing Bash grant", () => {
  assert.ok(/runs under this skill's `Bash` grant; add no other grant/.test(SCAN), SCAN);
  const fm = SKILL.split("---")[1] || "";
  const tools = linesOf(fm).find((l) => /^allowed-tools:|^tools:/.test(l)) || "";
  assert.ok(!/Bash\(\*\)|Bash\(git add/.test(tools), "no wildcard git add grant in frontmatter: " + tools);
});

test("[FR-217 | 2.4 | Clean scan commits] the scan script and its rules file exist in the plugin", () => {
  assert.ok(fs.existsSync(path.join(PLUGIN, "scripts", "scan-staged-secrets.js")));
  assert.ok(fs.existsSync(path.join(PLUGIN, "hooks", "lib", "secret-rules.js")));
});
