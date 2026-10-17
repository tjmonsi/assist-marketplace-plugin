// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Text contract tests for the rules and documents changed in release 1.12.0 (lane 5d):
// rules/assist-plugin-rule.md, rules/llm-security-checklist.md, CLAUDE.md,
// plugins/assist-plugin/Claude.md, README.md, MARKETPLACE.md, docs/SPECIFICATION.md,
// docs/ARCHITECTURE.md, and the agent registry. Each test reads a documented file and asserts a
// binding string (a path set, a table row, a hint string, a stated rule). No test asserts wording
// the specs mark as proposed.
//
// Sources: specs/spec-skills.md (NFR-011 path set, "Token budget" and "Checklist trigger names the
// wide glob" Scenarios), specs/spec-skills-manifests-docs.md (FR-194, FR-201, NFR-020),
// specs/spec-skills-git.md (FR-138 catalog copy), specs/spec-skills-docs-review.md (FR-148),
// specs/spec-hooks-platform.md (FR-088, FR-091), specs/spec-hooks-bash-guards.md (FR-093 docs),
// specs/spec-orchestration-review-gates.md (FR-061), and
// docs/requirements/FR-NFR-assist-plugin.md (version 1.2).
//
// Traceability format: [Scenario title | spec section | FR/NFR ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// The version-consistency checks stay in tests/docs/plugin-changelog.test.js and
// tests/docs/self-hosted-layout.test.js. This file reads the version from no file.
//
// Run: node --test tests/docs/contracts-docs-1-12-0.test.js

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

function normalize(text) {
  return text.replace(/\s+/g, " ");
}

function headingLevel(line) {
  const m = /^(#{1,6})\s/.exec(line);
  return m ? m[1].length : 0;
}

// Lines under `heading` up to the next heading of the same or a higher level, outside code fences.
function section(text, heading, exact) {
  const lines = linesOf(text);
  const level = headingLevel(heading + " ");
  const useExact = exact === undefined ? true : exact;
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
        if (useExact ? t === heading : t.indexOf(heading) === 0) on = true;
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

// The NFR-011 path set, as the tokens a passage must name.
const SURFACE = [
  "`agents/`",
  "`skills/`",
  "`metadata.json`",
  "`rules/`",
  "`hooks/`",
  "repository root",
  "`plugins/<name>/`",
  "`.claude/`",
  "`CLAUDE.md`",
  "`CLAUDE.local.md`",
  "`AGENTS.md`",
  "`.claude/settings*.json`",
];

function assertSurface(passage, who) {
  const text = normalize(passage);
  SURFACE.forEach((s) => assert.ok(text.indexOf(s) !== -1, who + ": lacks " + s));
  assert.ok(/`skills\/`[\s\S]{0,70}any depth[\s\S]{0,70}`metadata\.json`/.test(text), who + ": must name skills/ at any depth with metadata.json");
  assert.ok(/`CLAUDE\.md`, `CLAUDE\.local\.md`, or `AGENTS\.md`[\s\S]{0,30}at any depth/.test(text), who + ": must name the instruction files at any depth");
  assert.ok(!/skills\/\*\*\/SKILL\.md/.test(text), who + ": still lists skills/**/SKILL.md as a skill glob");
  assert.ok(!/skills\/\*\*\/references\/\*\.md/.test(text), who + ": still lists skills/**/references/*.md as a skill glob");
}

function surfaceTokens(passage) {
  const text = normalize(passage);
  return SURFACE.filter((s) => text.indexOf(s) !== -1);
}

// ---------------------------------------------------------------------------
// rules/assist-plugin-rule.md: FR-061, NFR-011, FR-088, FR-091 (A8, A14, A37)
// ---------------------------------------------------------------------------

const RULE = read("rules/assist-plugin-rule.md");

function ruleTrigger() {
  const gate = section(RULE, "## LLM Security Review Gate");
  const line = gate.find((l) => /^\*\*When triggered:\*\*/.test(l));
  assert.ok(line, "no 'When triggered' line under ## LLM Security Review Gate");
  return line;
}

function ruleCheckbox() {
  const line = linesOf(RULE).find((l) => l.indexOf("- [ ] LLM security review: ✓ LLM Security Clear") === 0);
  assert.ok(line, "no LLM security checkbox in the Merge Policy");
  return line;
}

function ruleFastTrack() {
  const lines = section(RULE, "## Fast-Track Review");
  const start = lines.findIndex((l) => /^2\. \*\*LLM security gate:\*\*/.test(l));
  const end = lines.findIndex((l) => /^3\. \*\*Testing gate:\*\*/.test(l));
  assert.ok(start >= 0 && end > start, "no LLM security gate item in Fast-Track Review");
  return joined(lines.slice(start, end));
}

test("assist-plugin-rule.md LLM gate trigger names the NFR-011 path set", () => {
  // [Scenario: Nested reference file and metadata file; Instruction file at depth; Project-level Claude Code files; Application folder
  //  | spec-skills.md "LLM gate path set" | NFR-011 | FR-061]
  const t = ruleTrigger();
  assertSurface(t, "When triggered");
  assert.ok(/An application folder such as `src\/hooks\/` is not on the surface/.test(t));
});

test("assist-plugin-rule.md Merge Policy checkbox names the NFR-011 path set", () => {
  // [Scenario: Nested reference file and metadata file; Skill metadata file; Instruction file inside an application folder | spec-skills.md | NFR-011 | FR-061]
  assertSurface(ruleCheckbox(), "Merge Policy checkbox");
});

test("assist-plugin-rule.md Fast-Track item names the NFR-011 path set and cannot be skipped", () => {
  // [Scenario: Metadata file only; Project skill under .claude; Application folder named skills | spec-skills.md | NFR-011 | FR-061]
  const ft = ruleFastTrack();
  assertSurface(ft, "Fast-Track item 2");
  assert.ok(/Cannot be skipped/.test(ft));
  assert.ok(/not an application folder such as `src\/hooks\/`/.test(normalize(ft)));
});

test("assist-plugin-rule.md names the same surface in the trigger, the checkbox, and the Fast-Track item", () => {
  // [Scenario: Checklist trigger names the wide glob (rule file side) | spec-skills.md | NFR-011 | FR-061]
  const a = surfaceTokens(ruleTrigger());
  assert.deepStrictEqual(surfaceTokens(ruleCheckbox()), a);
  assert.deepStrictEqual(surfaceTokens(ruleFastTrack()), a);
});

test("assist-plugin-rule.md keeps the two-signature rule for agents, skills, and rules changes", () => {
  // [Scenario: LLM-surface change | spec-skills.md / spec-orchestration-review-gates.md | NFR-011 | FR-061]
  const text = normalize(RULE);
  assert.ok(/`✓ OWASP Clear` and `✓ LLM Security Clear` must both appear in the commit message or plan file/.test(text));
});

test("Hook Fail-Open Rule calls evaluate(input) a decision function, not pure", () => {
  // [Scenario: Wording in the rule file | spec-hooks-platform.md "Guard decision" | FR-088]
  const rule = section(RULE, "## Hook Fail-Open Rule");
  const line = rule.find((l) => l.indexOf("- Deny only through the `permissionDecision: \"deny\"` JSON") === 0);
  assert.ok(line, "the deny-through-JSON requirement is missing");
  assert.ok(/decision function `evaluate\(input\)`/.test(line));
  assert.ok(/whose only I\/O is file reads that a test can replace/.test(line));
  assert.ok(/never exit 2/.test(line));
  assert.ok(!/\bpure\b/i.test(joined(rule)), "the Hook Fail-Open Rule still calls a guard pure");
});

test("Hook Fail-Open Rule names the three filters and says a failed writing-context self-test is reported only", () => {
  // [Scenario: Writing-context failure never disables it; Entry for a hook without a self-test; Listed guard that now only misses a deny
  //  | spec-hooks-platform.md / spec-hooks-health-check.md | FR-091 | FR-118]
  const rule = section(RULE, "## Hook Fail-Open Rule");
  const line = rule.find((l) => l.indexOf("- A guard whose self-test denies a known-safe command") === 0);
  assert.ok(line, "the auto-disable requirement is missing");
  assert.ok(/a filter \(`injection-filter`, `prose-advisor`, `fsa-log`\) whose self-test fails in any way/.test(line));
  assert.ok(/stays listed until a later self-test passes every case/.test(line));
  assert.ok(/a guard that only misses a known-prohibited command keeps its state/.test(line));
  assert.ok(/a failed `writing-context` self-test is reported only/.test(line));
  assert.ok(line.indexOf("`/assist-plugin:health`") !== -1);
});

test("assist-plugin-rule.md keeps the four '## Write guard lists' tables", () => {
  // [Scenario: Tables present | spec-hooks-fsa-table-check.md "Write guard lists in the markdown" | FR-180 | FR-186]
  const guard = section(RULE, "## Write guard lists");
  assert.ok(guard.length > 0, "## Write guard lists is missing");
  ["### Protected globs", "### Protected files", "### Auto-loaded names", "### Task-plan glob"].forEach((h) => {
    const sub = section(joined(guard), h);
    assert.ok(sub.length > 0, h + " is missing");
    const rows = sub.filter((l) => l.trim().charAt(0) === "|");
    assert.ok(rows.length >= 3, h + " holds no table row (header, separator, and one data row expected)");
  });
});

// ---------------------------------------------------------------------------
// rules/llm-security-checklist.md: NFR-011, FR-061, FR-065, FR-067 (A8, A37)
// ---------------------------------------------------------------------------

const CHECKLIST = read("rules/llm-security-checklist.md");

function checklistTrigger() {
  const lines = linesOf(CHECKLIST);
  const start = lines.findIndex((l) => /^\*\*When triggered:\*\*/.test(l));
  const end = lines.findIndex((l) => /^\*\*Who reviews:\*\*/.test(l));
  assert.ok(start >= 0 && end > start, "no 'When triggered' paragraph in the checklist");
  return joined(lines.slice(start, end));
}

function checklistMergeGate() {
  const g = section(CHECKLIST, "## Merge Gate");
  assert.ok(g.length > 0, "no ## Merge Gate section in the checklist");
  return joined(g);
}

test("llm-security-checklist.md trigger names the NFR-011 path set and not the two narrow skill globs", () => {
  // [Scenario: Checklist trigger names the wide glob | spec-skills.md "LLM gate path set" | NFR-011 | FR-061]
  assertSurface(checklistTrigger(), "checklist trigger");
  assert.ok(/An application folder such as `src\/hooks\/` is not on the surface/.test(normalize(checklistTrigger())));
});

test("llm-security-checklist.md Merge Gate names the same set as the trigger", () => {
  // [Scenario: Checklist trigger names the wide glob | spec-skills.md | NFR-011 | FR-061]
  assertSurface(checklistMergeGate(), "checklist Merge Gate");
  assert.deepStrictEqual(surfaceTokens(checklistMergeGate()), surfaceTokens(checklistTrigger()));
  assert.ok(/not fast-trackable/.test(checklistMergeGate()));
});

test("llm-security-checklist.md and the rule file agree on the surface", () => {
  // [Scenario: Checklist trigger names the wide glob; Plugin path anchor | spec-skills.md | NFR-011 | FR-061]
  assert.deepStrictEqual(surfaceTokens(checklistTrigger()), surfaceTokens(ruleTrigger()));
});

test("llm-security-checklist.md no longer says 'No agent file declares' a tools: key", () => {
  // [Scenario: (stale claim fix) | FR-NFR section 9 "Source differences found" | FR-065 | FR-067]
  assert.strictEqual(CHECKLIST.indexOf("No agent file declares"), -1, "the stale claim is still in the checklist");
  assert.ok(!/No `tools:` frontmatter on any of the 12 agent files/.test(CHECKLIST));
});

test("llm-security-checklist.md states the current agent tools facts and they match the agent files", () => {
  // [Scenario: (stale claim fix) | FR-NFR section 9 "Source differences found" | FR-065 | FR-067]
  const dir = path.join(PLUGIN, "agents");
  const files = fs.readdirSync(dir).filter((n) => /\.md$/.test(n));
  const tools = {};
  files.forEach((n) => {
    const m = /^tools:\s*\[(.*)\]\s*$/m.exec(fs.readFileSync(path.join(dir, n), "utf8"));
    assert.ok(m, n + " declares no tools:");
    tools[n.replace(/\.md$/, "")] = m[1].split(",").map((s) => s.trim());
  });
  const n = files.length;
  assert.ok(new RegExp("All " + n + " (?:agent )?files(?: in `agents/`)? declare").test(CHECKLIST), "the checklist does not state that all " + n + " agent files declare tools:");
  assert.deepStrictEqual(tools.reviewer, ["Read", "Grep", "Glob", "LSP"]);
  assert.deepStrictEqual(tools["code-reviewer"], ["Read", "Grep", "Glob", "LSP"]);
  assert.deepStrictEqual(tools.explore, ["Read", "Grep", "Glob"]);
  assert.ok(/`reviewer` and `code-reviewer` hold `Read, Grep, Glob, LSP`/.test(CHECKLIST));
  assert.ok(/`explore` holds `Read, Grep, Glob`/.test(CHECKLIST));
});

// ---------------------------------------------------------------------------
// CLAUDE.md: FR-194, FR-138, NFR-011, NFR-020, FR-093, FR-118 (A30, A32, A19, A37, A14)
// ---------------------------------------------------------------------------

const CLAUDE = readRepo("CLAUDE.md");
const PLUGIN_CLAUDE = read("Claude.md");

test("CLAUDE.md release line names all five version files", () => {
  // [Scenario: Checklist complete | spec-skills-manifests-docs.md "Version checklist" | FR-194]
  const line = linesOf(CLAUDE).find((l) => l.indexOf("When releasing, update the version in") === 0);
  assert.ok(line, "no release line");
  [
    "`plugins/assist-plugin/.claude-plugin/plugin.json`",
    "`.claude-plugin/marketplace.json`",
    "`CLAUDE.md` (the Plugin line)",
    "`README.md` (the `### assist-plugin v` heading)",
    "`MARKETPLACE.md` (the heading and the Versioning sentence)",
  ].forEach((s) => assert.ok(line.indexOf(s) !== -1, "the release line lacks " + s));
  // Every listed file exists.
  ["plugins/assist-plugin/.claude-plugin/plugin.json", ".claude-plugin/marketplace.json", "CLAUDE.md", "README.md", "MARKETPLACE.md"].forEach((f) => {
    assert.ok(fs.existsSync(path.join(REPO, f)), f + " is missing");
  });
});

test("CLAUDE.md sync list says the registry is checked for the agent count only", () => {
  // [Scenario: Registry states no skill total | spec-skills-manifests-docs.md "Agent and skill counts agree in eight files" | NFR-020]
  const sync = joined(section(CLAUDE, "## Keeping counts in sync"));
  const line = linesOf(sync).find((l) => l.indexOf("skills/do/references/agent-registry.md") !== -1);
  assert.ok(line, "the registry is not in the sync list");
  assert.ok(/agent count only/.test(line));
  assert.ok(/states no skill total/.test(line));
});

test("CLAUDE.md /bump row hint equals the bump SKILL.md argument-hint (table pipes unescaped)", () => {
  // [Scenario: Argument hint | spec-skills-git.md "Bump argument hint" | FR-138]
  const hint = skillHint("bump");
  assert.strictEqual(catalogHint(CLAUDE, "bump"), hint);
  assert.ok(hint.indexOf("--no-changelog") !== -1);
  assert.ok(linesOf(CLAUDE).find((l) => l.indexOf("| **bump** |") === 0).indexOf("\\|") !== -1, "the table row escapes its pipes");
});

test("CLAUDE.md /technical-writing row hint equals the technical-writing SKILL.md argument-hint", () => {
  // [Scenario: Technical-writing subcommands | spec-skills-manifests-docs.md "Catalog copies" | FR-201]
  assert.strictEqual(catalogHint(CLAUDE, "technical-writing"), skillHint("technical-writing"));
});

test("CLAUDE.md sa-mermaid-only bullet names the absolute-path form", () => {
  // [Scenario: Absolute path under the git root from a subdirectory session | spec-hooks-bash-guards.md | FR-093]
  const line = linesOf(CLAUDE).find((l) => l.indexOf("- **sa-mermaid-only**") === 0);
  assert.ok(line, "no sa-mermaid-only bullet");
  assert.ok(/as a relative path or an absolute path under the git root/.test(line));
  assert.ok(/each under `specs\/` or `<dir>\/specs\/`/.test(line));
});

test("CLAUDE.md Governance names the LLM surface with the NFR-011 path set", () => {
  // [Scenario: Nested reference file and metadata file; Application folder | spec-skills.md | NFR-011 | FR-061]
  const line = linesOf(CLAUDE).find((l) => l.indexOf("- **LLM security:**") === 0);
  assert.ok(line, "no LLM security governance line");
  const text = normalize(line);
  ["`agents/`", "`skills/`", "`metadata.json`", "`rules/`", "`hooks/`", "`plugins/<name>/`", "`.claude/`", "`CLAUDE.md`", "`CLAUDE.local.md`", "`AGENTS.md`", "`.claude/settings*.json`", "`src/hooks/`"].forEach((s) => {
    assert.ok(text.indexOf(s) !== -1, "Governance line lacks " + s);
  });
});

test("CLAUDE.md, Claude.md, and README.md say the health check self-tests writing-context and a failure never disables it", () => {
  // [Scenario: Writing-context failure never disables it | spec-hooks-platform.md / spec-hooks-health-check.md (inferred doc edit) | FR-091 | FR-118]
  [
    ["CLAUDE.md", CLAUDE],
    ["plugins/assist-plugin/Claude.md", PLUGIN_CLAUDE],
    ["README.md", readRepo("README.md")],
  ].forEach((f) => {
    const line = linesOf(f[1]).find((l) => /\*\*`?writing-context`?\*\*/.test(l) && /SessionStart and SubagentStart/.test(l));
    assert.ok(line, f[0] + ": no writing-context bullet");
    assert.ok(/self-test/.test(line), f[0] + ": the bullet does not mention the self-test");
    assert.ok(/never disables it/.test(line), f[0] + ": the bullet does not say a failure never disables the hook");
  });
});

// ---------------------------------------------------------------------------
// plugins/assist-plugin/Claude.md, README.md, ARCHITECTURE.md, SPECIFICATION.md (A19, A25, A31, FR-093)
// ---------------------------------------------------------------------------

test("Claude.md /bump row hint equals the bump SKILL.md argument-hint and equals the CLAUDE.md hint", () => {
  // [Scenario: Argument hint | spec-skills-git.md "Bump argument hint" | FR-138]
  assert.strictEqual(catalogHint(PLUGIN_CLAUDE, "bump"), skillHint("bump"));
  assert.strictEqual(catalogHint(PLUGIN_CLAUDE, "bump"), catalogHint(CLAUDE, "bump"));
});

test("Claude.md /technical-writing row hint equals the technical-writing SKILL.md argument-hint", () => {
  // [Scenario: Technical-writing subcommands | spec-skills-manifests-docs.md | FR-201]
  assert.strictEqual(catalogHint(PLUGIN_CLAUDE, "technical-writing"), skillHint("technical-writing"));
});

test("Claude.md sa-mermaid-only bullet names the absolute-path form", () => {
  // [Scenario: Absolute path under the git root from a subdirectory session | spec-hooks-bash-guards.md | FR-093]
  const line = linesOf(PLUGIN_CLAUDE).find((l) => l.indexOf("- **sa-mermaid-only**") === 0);
  assert.ok(line, "no sa-mermaid-only bullet");
  assert.ok(/as a relative path or an absolute path under the git root/.test(line));
});

test("README.md and ARCHITECTURE.md and SPECIFICATION.md describe sa-mermaid-only with the absolute-path form", () => {
  // [Scenario: Absolute path under the git root from a subdirectory session | spec-hooks-bash-guards.md (docs) | FR-093]
  const files = [
    ["README.md", readRepo("README.md")],
    ["docs/ARCHITECTURE.md", read("docs/ARCHITECTURE.md")],
    ["docs/SPECIFICATION.md", read("docs/SPECIFICATION.md")],
  ];
  files.forEach((f) => {
    const lines = linesOf(f[1]).filter((l) => l.indexOf("sa-mermaid-only") !== -1 && /\.mmd/.test(l));
    assert.ok(lines.length >= 1, f[0] + ": no sa-mermaid-only description");
    assert.ok(lines.some((l) => /absolute path under the git root/.test(l)), f[0] + ": the description lacks 'absolute path under the git root'");
  });
});

test("SPECIFICATION.md technical-writing entry lists all four subcommands and equals the skill hint", () => {
  // [Scenario: Technical-writing subcommands | spec-skills-manifests-docs.md "Catalog copies" | FR-201]
  const text = read("docs/SPECIFICATION.md");
  const line = linesOf(text).find((l) => l.indexOf("**Command:** `/technical-writing") === 0);
  assert.ok(line, "no technical-writing command line");
  ["docs", "readme", "guide", "api"].forEach((s) => assert.ok(line.indexOf(s) !== -1, "the entry lacks the " + s + " subcommand"));
  const m = /`\/technical-writing (.*)`/.exec(line);
  assert.ok(m);
  assert.strictEqual(m[1], skillHint("technical-writing"));
});

test("SPECIFICATION.md review-md Automated line names ask and do only", () => {
  // [Scenario: Caller list; Catalog entry agrees | spec-skills-docs-review.md | FR-148 | FR-147]
  const sec = section(read("docs/SPECIFICATION.md"), "### review-md");
  const line = sec.find((l) => /^- Automated:/.test(l));
  assert.ok(line, "no Automated line under ### review-md");
  const names = (line.match(/`[a-z-]+`/g) || []).map((s) => s.slice(1, -1));
  assert.deepStrictEqual(names, ["ask", "do"], "callers named: " + JSON.stringify(names));
});

test("SPECIFICATION.md health entry says writing-context is self-tested and reported only", () => {
  // [Scenario: Writing-context failure never disables it | spec-hooks-platform.md (inferred doc edit) | FR-091 | FR-118]
  const text = read("docs/SPECIFICATION.md");
  const line = linesOf(text).find((l) => /Run `hooks\/health-check\.js`/.test(l));
  assert.ok(line, "no health-check step line");
  assert.ok(/`writing-context` against fixed silent and context cases, reporting only/.test(line));
});

// ---------------------------------------------------------------------------
// MARKETPLACE.md: FR-201 (A31)
// ---------------------------------------------------------------------------

const MARKETPLACE = readRepo("MARKETPLACE.md");

test("MARKETPLACE.md scripts line names every script in the scripts folder", () => {
  // [Scenario: Scripts listed | spec-skills-manifests-docs.md "Catalog copies" | FR-201]
  const line = linesOf(MARKETPLACE).find((l) => /scripts\/ \(/.test(l));
  assert.ok(line, "no scripts/ line in the structure tree");
  const scripts = fs.readdirSync(path.join(PLUGIN, "scripts")).filter((n) => /\.js$/.test(n));
  assert.ok(scripts.length >= 2);
  scripts.forEach((n) => assert.ok(line.indexOf(n) !== -1, "the scripts line lacks " + n));
  assert.ok(line.indexOf("sync-writing-standard.js") !== -1 && line.indexOf("check-fsa-tables.js") !== -1);
});

test("MARKETPLACE.md tag example uses the vX.Y.Z form and holds no 'assist-plugin--v' string", () => {
  // [Scenario: Tag form | spec-skills-manifests-docs.md "Catalog copies" | FR-201]
  assert.strictEqual(MARKETPLACE.indexOf("assist-plugin--v"), -1, "the old assist-plugin--v tag form is still in MARKETPLACE.md");
  const versioning = joined(section(MARKETPLACE, "## Versioning"));
  const tags = versioning.match(/`v\d+\.\d+\.\d+`/g) || [];
  assert.ok(tags.length >= 2, "the tag example does not show vX.Y.Z tags: " + JSON.stringify(tags));
  assert.ok(/versioning managed through git tags/.test(versioning));
});

test("no document under the repository root or the plugin docs holds 'assist-plugin--v'", () => {
  // [Scenario: Tag form; Drift left without a reason | spec-skills-manifests-docs.md | FR-201]
  ["README.md", "CLAUDE.md", "MARKETPLACE.md"].forEach((f) => {
    assert.strictEqual(readRepo(f).indexOf("assist-plugin--v"), -1, f + " holds assist-plugin--v");
  });
  ["Claude.md", "docs/SPECIFICATION.md", "docs/ARCHITECTURE.md"].forEach((f) => {
    assert.strictEqual(read(f).indexOf("assist-plugin--v"), -1, f + " holds assist-plugin--v");
  });
});

// ---------------------------------------------------------------------------
// NFR-020: the agent registry
// ---------------------------------------------------------------------------

test("agent-registry.md states the agent count of the agents folder and no skill total", () => {
  // [Scenario: Registry states no skill total; Registry agent count drifts | spec-skills-manifests-docs.md "Agent and skill counts agree in eight files" | NFR-020]
  const text = read("skills/do/references/agent-registry.md");
  const agents = fs.readdirSync(path.join(PLUGIN, "agents")).filter((n) => /\.md$/.test(n));
  const m = /^#{1,6}\s+All Agents \((\d+)\)/m.exec(text);
  assert.ok(m, "no 'All Agents (N)' heading");
  assert.strictEqual(Number(m[1]), agents.length, "the registry states " + m[1] + " agents; agents/ holds " + agents.length);
  const rows = section(text, "## All Agents (" + m[1] + ")").filter((l) => /^\| \*\*[a-z-]+\*\* \|/.test(l));
  assert.strictEqual(rows.length, agents.length, "the registry table lists " + rows.length + " agents");
  agents.forEach((n) => {
    const name = n.replace(/\.md$/, "");
    assert.ok(rows.some((r) => r.indexOf("| **" + name + "** |") === 0), "the registry lacks a row for " + name);
  });
  assert.ok(!/\b\d+\s+(user-invocable\s+)?skills?\b/i.test(text), "the registry states a skill total");
});
