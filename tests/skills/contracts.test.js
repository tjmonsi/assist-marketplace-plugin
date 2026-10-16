// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Text contract tests for the skills, agents, rules, and /do references changed in release
// 1.11.1. Each test reads a documented file and asserts the promise the spec makes about its
// text (headings, grants, tables, output folders, locations). No test asserts wording the specs
// mark as proposed; they assert the binding strings (paths, globs, headings, field names) and
// the stated behavior.
//
// Sources: specs/spec-skills-untrusted-input.md (FR-175, FR-176, FR-177),
// specs/spec-skills-requirements-specs.md (FR-182, FR-183), specs/spec-skills-plan-test.md
// (FR-184, FR-185), specs/spec-skills.md (NFR-013 grants), specs/spec-hooks-fsa-table-check.md
// (FR-180), specs/spec-orchestration-agents.md (FR-189, FR-074),
// specs/spec-orchestration-spec-first.md (FR-187, FR-188, FR-190, FR-191),
// specs/spec-orchestration-chain-signoff.md (FR-192, FR-190), and
// docs/requirements/FR-NFR-assist-plugin.md.
//
// Traceability format: [Scenario title | spec section | FR ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// Run: node --test tests/skills/contracts.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const fsaPaths = require(path.join(PLUGIN, "hooks", "lib", "fsa-paths.js"));

// ---------------------------------------------------------------------------
// Readers and markdown helpers
// ---------------------------------------------------------------------------

function read(rel) {
  return fs.readFileSync(path.join(PLUGIN, rel), "utf8");
}

function linesOf(text) {
  return text.split(/\r?\n/);
}

function headingLevel(line) {
  const m = /^(#{1,6})\s/.exec(line);
  return m ? m[1].length : 0;
}

// Lines under `heading` up to the next heading of the same or a higher level, outside code
// fences. `exact` compares the trimmed line; otherwise the line may start with the heading text.
function sectionIn(lines, heading, exact) {
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
        if (exact ? t === heading : t.indexOf(heading) === 0) on = true;
        continue;
      }
      const lv = headingLevel(line);
      if (lv > 0 && lv <= level) break;
    }
    if (on) out.push(line);
  }
  return out;
}

function section(text, heading, exact) {
  return sectionIn(linesOf(text), heading, exact === undefined ? true : exact);
}

function splitRow(line) {
  let s = line.trim();
  if (s.charAt(0) === "|") s = s.slice(1);
  if (s.charAt(s.length - 1) === "|") s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim());
}

// The first table in `lines`: { header, rows } where rows are the data rows (cells).
function firstTable(lines) {
  let i = 0;
  while (i < lines.length && lines[i].trim().charAt(0) !== "|") i++;
  if (i >= lines.length) return null;
  const block = [];
  while (i < lines.length && lines[i].trim().charAt(0) === "|") block.push(lines[i++]);
  if (block.length < 2) return null;
  return { header: splitRow(block[0]), rows: block.slice(2).map(splitRow) };
}

function codeSpan(cell) {
  const m = /^`([^`]+)`$/.exec(cell.trim());
  return m ? m[1] : null;
}

function frontMatter(text) {
  const lines = linesOf(text);
  assert.strictEqual(lines[0].trim(), "---", "file must start with front matter");
  const end = lines.indexOf("---", 1);
  assert.ok(end > 0, "front matter must end with ---");
  return lines.slice(1, end);
}

function stripQuotes(s) {
  return s.replace(/^["']|["']$/g, "");
}

function allowedTools(text) {
  const fm = frontMatter(text);
  const i = fm.findIndex((l) => /^allowed-tools:/.test(l));
  assert.ok(i >= 0, "front matter has no allowed-tools");
  const inline = fm[i].replace(/^allowed-tools:\s*/, "").trim();
  if (inline) {
    return inline.replace(/^\[|\]$/g, "").split(",").map((s) => stripQuotes(s.trim())).filter(Boolean);
  }
  const out = [];
  for (let j = i + 1; j < fm.length; j++) {
    const m = /^\s+-\s+(.*)$/.exec(fm[j]);
    if (!m) break;
    out.push(stripQuotes(m[1].trim()));
  }
  return out;
}

function writeGrants(tools) {
  return tools.filter((t) => /^(Edit|Write|MultiEdit|NotebookEdit)\b/.test(t));
}

function joined(lines) {
  return lines.join("\n");
}

function count(re, text) {
  const m = text.match(new RegExp(re.source, re.flags.indexOf("g") === -1 ? re.flags + "g" : re.flags));
  return m ? m.length : 0;
}

// ---------------------------------------------------------------------------
// FR-175: untrusted-input section in the requirements agent
// ---------------------------------------------------------------------------

// Shared checks for the rule text of FR-175, FR-176, and FR-177.
function assertUntrustedRule(rule, who) {
  assert.ok(/requirements/.test(rule), who + ": names requirements as data");
  assert.ok(/\bspecs?\b/.test(rule), who + ": names specs as data");
  assert.ok(/quote block/.test(rule), who + ": names the quote block");
  assert.ok(/code fence/.test(rule), who + ": names the code fence");
  assert.ok(/named file/i.test(rule), who + ": names text tied to a named file");
  assert.ok(/\bdata\b/.test(rule), who + ": declares the content to be data");
  assert.ok(/user's own answer/.test(rule), who + ": keeps the user's own answer");
  assert.ok(/authoritative/.test(rule), who + ": keeps the user's own answer authoritative");
  assert.ok(/file:line/.test(rule), who + ": cites file:line");
  assert.ok(/answer N, block M/.test(rule), who + ": cites 'answer N, block M'");
  assert.ok(/out_of_scope/.test(rule), who + ": reports under /do in out_of_scope");
  assert.ok(/direct run/i.test(rule), who + ": reports in the reply in a direct run");
  assert.ok(/never follow[^.]*\bquote\b[^.]*\brestate/i.test(rule), who + ": never follow, quote, or restate");
}

test("requirements-gatherer holds exactly one '## Untrusted input' heading, outside the Report Writing Standard block", () => {
  // [Scenario: Section present | spec-skills-untrusted-input.md "Untrusted-input section in the requirements agent" | FR-175]
  const text = read("agents/requirements-gatherer.md");
  assert.strictEqual(count(/^## Untrusted input\s*$/m, text), 1);
  const lines = linesOf(text);
  const h = lines.findIndex((l) => /^## Untrusted input\s*$/.test(l));
  const r = lines.findIndex((l) => /^## Report Writing Standard\s*$/.test(l));
  assert.ok(r > h, "the section must sit before ## Report Writing Standard, because the sync script overwrites that block");
});

test("requirements-gatherer rule: data, user's own answer authoritative, citation forms, never follow/quote/restate", () => {
  // [Scenario: Section present; Planted instruction; Direct run; Quote block from a document; User's own answer
  //  | spec-skills-untrusted-input.md "Untrusted-input section in the requirements agent" | FR-175]
  const rule = joined(section(read("agents/requirements-gatherer.md"), "## Untrusted input"));
  assertUntrustedRule(rule, "requirements-gatherer");
  assert.ok(!/## Report Writing Standard/.test(rule));
});

// ---------------------------------------------------------------------------
// FR-176 and FR-177: the rule in both skills
// ---------------------------------------------------------------------------

// The rule is the section when "Untrusted input" is a heading, else the bullet that names it.
function findRule(text) {
  const lines = linesOf(text);
  const i = lines.findIndex((l) => l.indexOf("Untrusted input") !== -1);
  assert.ok(i >= 0, "no Untrusted input rule found");
  if (/^#{1,6}\s/.test(lines[i])) return { start: i, text: joined(sectionIn(lines, lines[i].trim(), true)) };
  const out = [];
  for (let j = i; j < lines.length && lines[j].trim() !== ""; j++) out.push(lines[j]);
  return { start: i, text: joined(out) };
}

test("gather-requirements rule covers elicit, document, and review", () => {
  // [Scenario: Rule covers elicit and document | spec-skills-untrusted-input.md "Untrusted-input rule in gather-requirements" | FR-176]
  const text = read("skills/gather-requirements/SKILL.md");
  const rule = findRule(text);
  ["`elicit`", "`document`", "`review`"].forEach((m) => assert.ok(rule.text.indexOf(m) !== -1, "rule must name " + m));
  assertUntrustedRule(rule.text, "gather-requirements");
});

test("gather-requirements rule sits outside the Report Writing Standard block and review stays read-only", () => {
  // [Scenario: Rule covers elicit and document | same requirement | FR-176]
  const text = read("skills/gather-requirements/SKILL.md");
  const lines = linesOf(text);
  const r = lines.findIndex((l) => /^## Report Writing Standard\s*$/.test(l));
  assert.ok(findRule(text).start < r);
  assert.ok(/`review` is read-only/.test(text), "the read-only review rule must stay");
});

test("gather-requirements rule: pasted document text and the user's own answer", () => {
  // [Scenario: Pasted document text; User's own answer | same requirement | FR-176]
  const rule = findRule(read("skills/gather-requirements/SKILL.md")).text;
  assert.ok(/quality pass/.test(rule) || /skip/.test(rule), "the rule names what a planted request tries to change");
  assert.ok(/outside a quote block or code fence/.test(rule), "other typed text is defined by what it is outside of");
});

test("spec-from-requirements rule covers create, delta, and review", () => {
  // [Scenario: Rule present | spec-skills-untrusted-input.md "Untrusted-input rule in spec-from-requirements" | FR-177]
  const text = read("skills/spec-from-requirements/SKILL.md");
  const rule = findRule(text);
  ["`create`", "`delta`", "`review`"].forEach((m) => assert.ok(rule.text.indexOf(m) !== -1, "rule must name " + m));
  assertUntrustedRule(rule.text, "spec-from-requirements");
  assert.ok(/existing specs/.test(rule.text), "existing specs are in the data list");
});

test("spec-from-requirements rule: planted instruction leaves Status as it is and cites the spec path and line", () => {
  // [Scenario: Planted instruction in a spec; Quote block from a document; User's own answer
  //  | spec-skills-untrusted-input.md "Untrusted-input rule in spec-from-requirements" | FR-177]
  const text = read("skills/spec-from-requirements/SKILL.md");
  const rule = findRule(text).text;
  assert.ok(/Status/.test(rule), "the rule addresses Status");
  assert.ok(/leaves Status as it is/i.test(rule));
  assert.ok(/spec path|by its path|spec is cited/i.test(rule), "a spec is cited by its path and line");
  const lines = linesOf(text);
  const r = lines.findIndex((l) => /^## Report Writing Standard\s*$/.test(l));
  assert.ok(r === -1 || findRule(text).start < r, "the rule sits outside the Report Writing Standard block");
});

// ---------------------------------------------------------------------------
// FR-183, FR-185, NFR-013: write grants
// ---------------------------------------------------------------------------

test("gather-requirements front matter grants exactly the four docs/requirements paths", () => {
  // [Scenario: Granted path; JSON path | spec-skills-requirements-specs.md "Requirements write grant" | FR-183 | NFR-013]
  const tools = allowedTools(read("skills/gather-requirements/SKILL.md"));
  assert.deepStrictEqual(writeGrants(tools).slice().sort(), [
    "Edit(./docs/requirements/BRD-*.md)",
    "Edit(./docs/requirements/FR-NFR-*.md)",
    "Edit(./docs/requirements/URD-*.md)",
    "Edit(./docs/requirements/requirements-*.json)",
  ]);
});

test("gather-requirements adds no root-level grant and no Bash tool", () => {
  // [Scenario: Root-level path; In-place update of a legacy root-level file | same requirement | FR-183 | NFR-013]
  const tools = allowedTools(read("skills/gather-requirements/SKILL.md"));
  tools.forEach((t) => {
    assert.ok(!/^Edit\(\.\/(BRD|URD|FR-NFR|requirements)-/.test(t), "root-level grant: " + t);
    assert.ok(!/^(Bash|PowerShell)\b/.test(t), "shell tool: " + t);
    assert.ok(!/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(t), "bare write tool: " + t);
  });
  assert.ok(tools.every((t) => !/\*\*|\(\*\)/.test(t)), "no wildcard-wide grant");
});

test("gather-requirements metadata.json mirrors the front matter allowed-tools", () => {
  // [Requirement: Requirements write grant (metadata mirror) | spec-skills-requirements-specs.md | FR-183 | NFR-013]
  const meta = JSON.parse(read("skills/gather-requirements/metadata.json"));
  const tools = allowedTools(read("skills/gather-requirements/SKILL.md"));
  assert.deepStrictEqual(meta["allowed-tools"], tools);
});

test("task-plan front matter grants exactly ./docs/task-plans/task-plan-*.md, no root-level grant, no shell", () => {
  // [Scenario: Granted path; Root-level path; Path outside both folders | spec-skills-plan-test.md "Task-plan write grant" | FR-185 | NFR-013]
  const tools = allowedTools(read("skills/task-plan/SKILL.md"));
  assert.deepStrictEqual(writeGrants(tools), ["Edit(./docs/task-plans/task-plan-*.md)"]);
  tools.forEach((t) => assert.ok(!/^(Bash|PowerShell)\b/.test(t), "shell tool: " + t));
  assert.ok(tools.indexOf("Edit(./task-plan-*.md)") === -1, "the root-level grant of 4803a0d is gone");
});

test("spec-from-requirements grants stay unchanged (spec-skills.md: No change)", () => {
  // [Requirement: Scoped write grants for the document and log skills | spec-skills.md | NFR-013]
  const tools = allowedTools(read("skills/spec-from-requirements/SKILL.md"));
  assert.deepStrictEqual(writeGrants(tools).slice().sort(), [
    "Edit(./*/specs/spec-*.json)",
    "Edit(./*/specs/spec-*.md)",
    "Edit(./specs/openapi/*.json)",
    "Edit(./specs/openapi/*.yaml)",
    "Edit(./specs/spec-*.json)",
    "Edit(./specs/spec-*.md)",
  ]);
});

test("spec-from-requirements metadata.json mirrors its front matter grants", () => {
  // [Requirement: Scoped write grants for the document and log skills | spec-skills.md | NFR-013]
  const meta = JSON.parse(read("skills/spec-from-requirements/metadata.json"));
  const tools = allowedTools(read("skills/spec-from-requirements/SKILL.md"));
  assert.deepStrictEqual(meta["allowed-tools"], tools);
});

// ---------------------------------------------------------------------------
// FR-182: requirements output folder
// ---------------------------------------------------------------------------

test("gather-requirements Output: docs/requirements under the git root, folder created, worktree and no-git roots, JSON beside", () => {
  // [Scenario: Folder missing; JSON projection; Worktree session | spec-skills-requirements-specs.md "Requirements output folder" | FR-182]
  const out = joined(section(read("skills/gather-requirements/SKILL.md"), "## Output"));
  assert.ok(out.indexOf("docs/requirements/") !== -1);
  assert.ok(/git root of the session's working directory/.test(out));
  assert.ok(/creat\w+ the folder/i.test(out), "the folder is created when missing");
  assert.ok(/worktree uses its own root/i.test(out));
  assert.ok(/Outside a git repository, the working directory/i.test(out));
  ["BRD-<project-slug>.md", "URD-<project-slug>.md", "FR-NFR-<project-slug>.md"].forEach((f) => assert.ok(out.indexOf(f) !== -1, f));
  assert.ok(/--json/.test(out) && /requirements-<project-slug>\.json/.test(out) && /same folder/.test(out));
});

test("gather-requirements Output: a root-level document named for update is updated in place, never copied, and asks first", () => {
  // [Scenario: Legacy document updated in place | same requirement | FR-182 | FR-183]
  const out = joined(section(read("skills/gather-requirements/SKILL.md"), "## Output"));
  assert.ok(/root-level document/i.test(out));
  assert.ok(/updated in place/.test(out));
  assert.ok(/never copied/.test(out));
  assert.ok(/asks the user first/.test(out));
});

test("gather-requirements Output: a subdirectory session gets an intended write prompt", () => {
  // [Scenario: Subdirectory session | same requirement | FR-182 | FR-183]
  const out = joined(section(read("skills/gather-requirements/SKILL.md"), "## Output"));
  assert.ok(/subdirectory/.test(out));
  assert.ok(/asks the user first/.test(out));
  assert.ok(/intended/.test(out));
  assert.ok(/relative to the working directory|in the working directory/.test(out));
});

test("gather-requirements finds the git root without Bash: the /do prompt root first, then .git/HEAD or a .git file", () => {
  // [Requirement: Requirements output folder (no Bash tool) | spec-skills-requirements-specs.md | FR-182 | NFR-013]
  const fg = joined(section(read("skills/gather-requirements/SKILL.md"), "### Finding the git root"));
  assert.ok(/no Bash tool/.test(fg));
  assert.ok(/absolute output path/.test(fg));
  assert.ok(/\/do/.test(fg));
  assert.ok(fg.indexOf(".git/HEAD") !== -1);
  assert.ok(/file named `\.git`/.test(fg));
  assert.ok(/working directory/.test(fg));
});

test("gather-requirements references follow docs/requirements/ and still scan root-level files in an older project", () => {
  // [Requirement: Requirements output folder (references) | spec-skills-requirements-specs.md "Required data" | FR-182]
  ["skills/gather-requirements/references/document-workflow.md",
    "skills/gather-requirements/references/review.md",
    "skills/gather-requirements/references/elicitation-methodology.md"].forEach((rel) => {
    const t = read(rel);
    assert.ok(t.indexOf("docs/requirements/") !== -1, rel + " names docs/requirements/");
    assert.ok(/root-level|older project/.test(t), rel + " covers root-level files in an older project");
  });
  const wf = read("skills/gather-requirements/references/document-workflow.md");
  assert.ok(/creating the folder when it is missing/.test(wf));
  assert.ok(/updated in place and never copied/.test(wf));
});

// ---------------------------------------------------------------------------
// FR-184: task-plan output folder
// ---------------------------------------------------------------------------

test("task-plan Output: docs/task-plans under the git root, folder created, first run and rework", () => {
  // [Scenario: First run; Worktree session | spec-skills-plan-test.md "Task-plan output folder" | FR-184]
  const out = joined(section(read("skills/task-plan/SKILL.md"), "### 5. Output (state: WritePlan)"));
  assert.ok(out.indexOf("docs/task-plans/") !== -1);
  assert.ok(/git root of the session's working directory/.test(out));
  assert.ok(/Create the folder when it is missing/i.test(out));
  assert.ok(/worktree uses its own root/i.test(out));
  assert.ok(/Outside a git repository, the working directory/i.test(out));
  assert.ok(/first run and on a rework/.test(out));
});

test("task-plan Output: overwrite only a file already in docs/task-plans, a legacy root-level plan gets a new file", () => {
  // [Scenario: Fix pass on a legacy file; Rework of a plan in the task-plans folder | same requirement | FR-184]
  const out = joined(section(read("skills/task-plan/SKILL.md"), "### 5. Output (state: WritePlan)"));
  assert.ok(/only when it is already in `docs\/task-plans\/`/.test(out));
  assert.ok(/legacy root-level plan/.test(out));
  assert.ok(/new timestamped file in `docs\/task-plans\/`/.test(out));
  assert.ok(/root-level file unchanged/.test(out));
});

test("task-plan Output: the skill has no Bash and finds the root from the /do prompt or by probing .git/HEAD and a .git file", () => {
  // [Requirement: Task-plan output folder (no Bash tool) | spec-skills-plan-test.md | FR-184 | NFR-013]
  const out = joined(section(read("skills/task-plan/SKILL.md"), "### 5. Output (state: WritePlan)"));
  assert.ok(/no Bash tool/.test(out));
  assert.ok(/absolute output path/.test(out));
  assert.ok(out.indexOf(".git/HEAD") !== -1);
  assert.ok(/file named `\.git`/.test(out));
});

test("task-plan Routing: the write scope names ./docs/task-plans/task-plan-*.md and a subdirectory session asks first", () => {
  // [Scenario: Subdirectory session; Session in a subdirectory | spec-skills-plan-test.md "Task-plan write grant" | FR-184 | FR-185]
  const routing = joined(section(read("skills/task-plan/SKILL.md"), "## Routing"));
  assert.ok(routing.indexOf("./docs/task-plans/task-plan-*.md") !== -1);
  assert.ok(/subdirectory/.test(routing));
  assert.ok(/asks the user first/.test(routing));
  assert.ok(/directly under `docs\/task-plans\/`/.test(routing));
});

test("task-plan States table: WritePlan keeps its transitions and the example artifact is under docs/task-plans/", () => {
  // The FSA sees the same edges. [Requirement: Task-plan output folder | spec-skills-plan-test.md | FR-184 | FR-157]
  const text = read("skills/task-plan/SKILL.md");
  const row = linesOf(text).find((l) => /^\| WritePlan \|/.test(l));
  assert.ok(row, "WritePlan row");
  const cells = splitRow(row);
  assert.strictEqual(cells[1], "model");
  assert.ok(/`written` -> Done/.test(cells[3]));
  assert.ok(/`denied`[^;]*-> Error\(policy-rejection\)/.test(cells[3]));
  const artifact = linesOf(text).find((l) => /^artifact: /.test(l));
  assert.ok(artifact && /^artifact: docs\/task-plans\/task-plan-[^/]+\.md$/.test(artifact.trim()), "example artifact: " + artifact);
});

// ---------------------------------------------------------------------------
// FR-180: write guard tables (Scenario: Tables present)
// ---------------------------------------------------------------------------

const GUARD_HEADINGS = ["### Protected globs", "### Protected files", "### Auto-loaded names", "### Task-plan glob"];

function guardTable(heading) {
  const rule = read("rules/assist-plugin-rule.md");
  const guard = section(rule, "## Write guard lists");
  assert.ok(guard.length > 0, "rules/assist-plugin-rule.md has no ## Write guard lists section");
  return firstTable(sectionIn(guard, heading, true));
}

function values(table, who) {
  assert.ok(table, who + ": no table");
  return table.rows.map((cells, i) => {
    const v = codeSpan(cells[0]);
    assert.notStrictEqual(v, null, who + ", row " + (i + 1) + ": first cell " + cells[0].slice(0, 80) + " is not one code span");
    return v;
  });
}

test("rule file has one '## Write guard lists' section between Hook Fail-Open Rule and Governance Enforcement", () => {
  // [Scenario: Tables present | spec-hooks-fsa-table-check.md "Write guard lists in the markdown" | FR-180 | FR-186]
  const rule = read("rules/assist-plugin-rule.md");
  assert.strictEqual(count(/^## Write guard lists\s*$/m, rule), 1);
  const lines = linesOf(rule);
  const g = lines.findIndex((l) => l.trim() === "## Write guard lists");
  const before = lines.findIndex((l) => l.trim() === "## Hook Fail-Open Rule");
  const after = lines.findIndex((l) => l.trim() === "## Governance Enforcement");
  assert.ok(before >= 0 && before < g, "after ## Hook Fail-Open Rule");
  assert.ok(after > g, "before ## Governance Enforcement");
});

GUARD_HEADINGS.forEach((heading) => {
  test("rule file: " + heading + " holds a table whose first cells are single code spans, none listed twice", () => {
    // [Scenario: Tables present | spec-hooks-fsa-table-check.md "Write guard lists in the markdown" | FR-180]
    const table = guardTable(heading);
    assert.ok(table, "no table under " + heading);
    assert.ok(table.rows.length >= 1, heading + " has no data row");
    const vals = values(table, "rules/assist-plugin-rule.md, " + heading);
    assert.strictEqual(new Set(vals).size, vals.length, heading + " lists a value twice");
  });
});

test("rule file: the four subheadings appear once each under '## Write guard lists'", () => {
  // [Scenario: Tables present | same requirement | FR-180]
  const guard = section(read("rules/assist-plugin-rule.md"), "## Write guard lists");
  GUARD_HEADINGS.forEach((h) => assert.strictEqual(guard.filter((l) => l.trim() === h).length, 1, h));
});

test("rule file values equal the code lists in hooks/lib/fsa-paths.js", () => {
  // [Scenario: Values equal the code | same requirement | FR-180 | FR-128 | FR-129 | FR-127 | FR-186]
  const pairs = [
    ["### Protected globs", fsaPaths.PROTECTED_GLOBS],
    ["### Protected files", fsaPaths.PROTECTED_FILES],
    ["### Auto-loaded names", fsaPaths.AUTO_LOADED],
    ["### Task-plan glob", [].concat(fsaPaths.TASK_PLAN_GLOB)],
  ];
  pairs.forEach((p) => {
    const md = values(guardTable(p[0]), p[0]).slice().sort();
    assert.deepStrictEqual(md, p[1].slice().sort(), p[0] + " differs from the code");
  });
});

test("rule file binding strings: protected glob, protected file, auto-loaded names, and the task-plan glob", () => {
  // [Scenario: Tables present | same requirement | FR-180 | FR-186]
  assert.deepStrictEqual(values(guardTable("### Protected globs"), "globs"), ["**/.agent/main-plan/**"]);
  assert.deepStrictEqual(values(guardTable("### Protected files"), "files"), ["DECISIONS.md"]);
  assert.deepStrictEqual(values(guardTable("### Auto-loaded names"), "names").slice().sort(), ["AGENTS.md", "CLAUDE.local.md", "CLAUDE.md"]);
  assert.deepStrictEqual(values(guardTable("### Task-plan glob"), "glob"), ["docs/task-plans/task-plan-*.md"]);
});

test("task-planner.md holds a one-row table under '## Write scope' whose first cell is the single code span of the glob", () => {
  // [Scenario: Tables present | spec-hooks-fsa-table-check.md "Write guard lists in the markdown" | FR-180 | FR-186 | FR-127]
  const lines = section(read("agents/task-planner.md"), "## Write scope");
  const table = firstTable(lines);
  assert.ok(table, "agents/task-planner.md: no table under ## Write scope");
  assert.strictEqual(table.rows.length, 1, "expected 1 data row, got " + table.rows.length);
  assert.strictEqual(codeSpan(table.rows[0][0]), "docs/task-plans/task-plan-*.md");
  assert.deepStrictEqual(table.header.map((h) => h.toLowerCase()), ["glob", "where"]);
  // The table comes after the paragraph.
  const firstRow = lines.findIndex((l) => l.trim().charAt(0) === "|");
  assert.ok(lines.slice(0, firstRow).some((l) => l.trim() !== ""), "the paragraph precedes the table");
  // Both tables hold the same value, and the code holds it too.
  assert.strictEqual(codeSpan(table.rows[0][0]), values(guardTable("### Task-plan glob"), "glob")[0]);
  assert.deepStrictEqual([].concat(fsaPaths.TASK_PLAN_GLOB), ["docs/task-plans/task-plan-*.md"]);
});

// ---------------------------------------------------------------------------
// FR-186, FR-074, FR-184: task-planner.md text
// ---------------------------------------------------------------------------

test("task-planner.md fix-pass responsibility (line 19): overwrite only a file already in docs/task-plans, new file for a root-level plan", () => {
  // [Scenario: Fix pass / Rework of a root-level plan | spec-orchestration-agents.md "Task-planner writes only its task-plan file" | FR-074 | FR-184 | FR-186]
  const text = read("agents/task-planner.md");
  const lines = linesOf(text);
  const resp = lines.findIndex((l) => l.trim() === "**Responsibilities:**");
  const model = lines.findIndex((l) => l.indexOf("**Model:**") === 0);
  assert.ok(resp >= 0 && model > resp);
  const bullet = lines.slice(resp, model).find((l) => /^- On a fix pass/.test(l));
  assert.ok(bullet, "no '- On a fix pass' bullet among the responsibilities");
  assert.ok(/overwrite the task-plan file whose path the prompt gives/.test(bullet));
  assert.ok(/only when that file is already in `docs\/task-plans\/`/.test(bullet), "overwrite condition missing: " + bullet);
  assert.ok(/root-level plan/.test(bullet));
  assert.ok(/new timestamped file in `docs\/task-plans\/`/.test(bullet));
  assert.ok(/leave the root-level file as it is|root-level file (stays|unchanged)/.test(bullet));
});

test("task-planner.md Write scope paragraph: docs/task-plans of the git root, worktree, no git, overwrite condition, rework as a new file", () => {
  // [Scenario: New folder; Subdirectory session; Rework of a root-level plan | spec-orchestration-agents.md | FR-074 | FR-184 | FR-186]
  const para = joined(section(read("agents/task-planner.md"), "## Write scope").filter((l) => l.trim().charAt(0) !== "|"));
  assert.ok(/directly under `docs\/task-plans\/` of the git root of the session's working directory/.test(para));
  assert.ok(/worktree uses its own root/.test(para));
  assert.ok(/outside a git repository, the working directory/.test(para));
  assert.ok(/only when that file is already in `docs\/task-plans\/`/.test(para));
  assert.ok(/root-level plan/.test(para) && /new timestamped file/.test(para));
  assert.ok(/fsa-write-bar/.test(para) && /policy-rejection/.test(para));
  assert.ok(!/at the project root/i.test(para), "the 4803a0d root-level wording is gone");
});

test("task-planner.md description, opening paragraph, and Tools line name docs/task-plans/, not the project root", () => {
  // [Requirement: Task-planner writes only its task-plan file | spec-orchestration-agents.md | FR-074 | FR-186]
  const text = read("agents/task-planner.md");
  const fm = joined(frontMatter(text));
  assert.ok(/docs\/task-plans\//.test(fm));
  assert.ok(!/project root|repository root/i.test(fm), "front matter description still names the root");
  const lines = linesOf(text);
  const tools = lines.find((l) => l.indexOf("**Tools:**") === 0);
  assert.ok(tools && /docs\/task-plans\//.test(tools) && /no Edit, Bash, or PowerShell/.test(tools));
  const opening = lines.slice(lines.findIndex((l) => /^# /.test(l)) + 1, lines.findIndex((l) => l.trim() === "**Responsibilities:**")).join(" ");
  assert.ok(/docs\/task-plans\//.test(opening));
});

test("task-planner.md example terminal block puts the artifact under docs/task-plans/ and keeps the ten fields", () => {
  // [Requirement: Task-planner reports the step count | spec-orchestration-agents.md | FR-075 | FR-186]
  const text = read("agents/task-planner.md");
  const lines = linesOf(text);
  const start = lines.findIndex((l) => /^```fsa\s*$/.test(l));
  assert.ok(start >= 0);
  const block = lines.slice(start + 1, lines.indexOf("```", start + 1));
  const keys = block.map((l) => l.split(":")[0]);
  assert.deepStrictEqual(keys, ["fsa", "state", "trace", "artifact", "verdict", "skipped", "out_of_scope", "error_class", "questions", "resume_at"]);
  assert.ok(/^artifact: docs\/task-plans\/task-plan-[^/]+\.md$/.test(block[3]));
});

// ---------------------------------------------------------------------------
// FR-189: intake-reviewer conflict-check path list
// ---------------------------------------------------------------------------

test("intake-reviewer Conflict check lists the new locations for requirements, specs, task plans, and DECISIONS.md", () => {
  // [Scenario: Path in a new folder | spec-orchestration-agents.md "Conflict-check path list follows the document locations" | FR-189 | FR-187]
  const sec = joined(section(read("agents/intake-reviewer.md"), "## Conflict check"));
  [
    "docs/requirements/BRD-*.md",
    "URD-*.md",
    "FR-NFR-*.md",
    "requirements-*.json",
    "specs/spec-*.md",
    "<submodule>/specs/spec-*.md",
    "docs/task-plans/task-plan-*.md",
    "task-plan-*.md",
    "DECISIONS.md",
  ].forEach((s) => assert.ok(sec.indexOf(s) !== -1, "Conflict check names " + s));
  assert.ok(/git root of the session's working directory/.test(sec));
  assert.ok(/older project/.test(sec), "root-level names remain for an older project");
});

test("intake-reviewer Conflict check keeps the rule that an unlisted document is reached only through a Grep", () => {
  // [Scenario: Unlisted path | same requirement | FR-189]
  const sec = joined(section(read("agents/intake-reviewer.md"), "## Conflict check"));
  assert.ok(/not in the list/.test(sec));
  assert.ok(/Grep for the feature terms/.test(sec));
});

test("intake-reviewer States table still pairs Decide and Verify with their verdicts (FR-126 parses it)", () => {
  // [Requirement: Conflict-check path list ... (States table untouched) | spec-orchestration-agents.md | FR-189 | FR-126]
  const states = joined(section(read("agents/intake-reviewer.md"), "## States"));
  ["`accepted`", "`needs-changes`", "`clear`", "`needs-clarification`"].forEach((v) => assert.ok(states.indexOf(v) !== -1, v));
});

// ---------------------------------------------------------------------------
// /do SKILL.md: project root, SpecGate, Decompose, Send, root notes, Preflight, change check
// ---------------------------------------------------------------------------

const DO = read("skills/do/SKILL.md");

test("/do resolves the project root once per run with the hooks' .git entry test, not git rev-parse", () => {
  // [Scenario: Subdirectory session; Worktree session; Outside a git repository
  //  | spec-orchestration-spec-first.md "Search the new folders under the git root" | FR-187 | FR-192]
  const root = joined(section(DO, "### Project root"));
  assert.ok(/once per run/.test(root));
  assert.ok(/test -e/.test(root), "the walk tests each directory for the .git entry with test -e");
  assert.ok(/an entry named `\.git`/.test(root), "the root is the first directory that holds an entry named .git");
  assert.ok(/a directory, or a file in a linked worktree or submodule/.test(root), "a .git directory or a .git file both count");
  assert.ok(root.indexOf("hooks/lib/git-root.js") !== -1, "the walk is the same test the hooks apply");
  assert.ok(/worktree/.test(root));
  assert.ok(/working directory/.test(root), "the working directory is the root outside a git repository");
  linesOf(DO).filter((l) => l.indexOf("rev-parse") !== -1).forEach((l) => {
    assert.ok(/\b(not|never)\b/i.test(l), "rev-parse may be mentioned only to rule it out: " + l.slice(0, 120));
  });
});

test("/do uses the shared <root> in SpecGate, Decompose, Decision records, Preflight, and Send", () => {
  // [Scenario: Subdirectory session | spec-orchestration-spec-first.md / spec-orchestration-chain-signoff.md | FR-187 | FR-190 | FR-192]
  ["## SpecGate", "## Decompose", "### Decision records", "## Preflight", "### Send"].forEach((h) => {
    const sec = joined(section(DO, h, false));
    assert.ok(sec.indexOf("<root>") !== -1 || /SpecGate step 2|Project root/.test(sec), h + " refers to the shared root");
  });
});

test("/do single-quotes <root> in every git -C command", () => {
  // [Scenario: Session at the git root; Subdirectory session | spec-orchestration-chain-signoff.md | FR-192 | FR-032]
  assert.strictEqual(count(/git -C (?!'<root>')/, DO), 0, "an unquoted git -C <root> remains");
  assert.ok(/git -C '<root>'/.test(DO));
});

const REQ_PATTERNS = ["docs/requirements/BRD-*.md", "docs/requirements/URD-*.md", "docs/requirements/FR-NFR-*.md", "docs/requirements/requirements-*.json"];
const OLD_ROOT = ["./BRD-*.md", "./URD-*.md", "./FR-NFR-*.md", "./requirements-*.json", "./task-plan-*.md"];

test("SpecGate step 2 lists the new folders, the old root patterns, specs, DECISIONS.md, and user-named files", () => {
  // [Scenario: New folders; Old root patterns; Submodule specs | spec-orchestration-spec-first.md "Requirement 14" | FR-187]
  const sg = joined(section(DO, "## SpecGate"));
  REQ_PATTERNS.concat(OLD_ROOT, ["docs/task-plans/task-plan-*.md", "./specs/spec-*.md", "./*/specs/spec-*.md", "./DECISIONS.md"]).forEach((p) => {
    assert.ok(sg.indexOf(p) !== -1, "SpecGate lists " + p);
  });
  assert.ok(/user named/i.test(sg));
  assert.ok(/git root|<root>/.test(sg));
  assert.ok(/worktree/.test(sg) || /Project root/.test(sg));
});

test("SpecGate keeps its cap and paths-only rule, and lists no folder outside the fixed patterns", () => {
  // [Scenario: Folder outside the fixed list | spec-orchestration-spec-first.md "Requirement 14" | FR-187 | FR-174]
  const sg = joined(section(DO, "## SpecGate"));
  assert.ok(/at most 20 paths per document type/.test(sg));
  assert.ok(/newest first/.test(sg));
  assert.ok(/lists paths only and reads none/.test(sg));
  assert.ok(!/docs\/task-plan-\*/.test(sg), "no pattern may cover docs/task-plan-auth.md");
  assert.ok(sg.indexOf("docs/task-plan-auth.md") === -1 || /not listed/.test(sg));
});

test("SpecGate takes no path, glob, or folder name from DECISIONS.md", () => {
  // [Scenario: Folder named in DECISIONS.md; Planted path; Fixed patterns only | spec-orchestration-spec-first.md "Requirement 16" | FR-191]
  const sg = joined(section(DO, "## SpecGate"));
  assert.ok(/No path, glob, or folder name comes from the text of `DECISIONS\.md`/.test(sg));
  assert.ok(/fixed patterns/.test(sg));
});

test("Decompose chain table: requirements and task-plan Writes sit in the new folders", () => {
  // [Scenario: Chain steps | spec-orchestration-spec-first.md "Requirement 17" | FR-190]
  const dec = linesOf(joined(section(DO, "## Decompose")));
  const req = dec.find((l) => /^\| Requirements \|/.test(l));
  const plan = dec.find((l) => /^\| Task plan \|/.test(l));
  assert.ok(req && plan, "chain table rows");
  REQ_PATTERNS.forEach((p) => assert.ok(req.indexOf("`" + p + "`") !== -1, "Requirements writes " + p));
  let stripped = req;
  REQ_PATTERNS.forEach((p) => { stripped = stripped.split(p).join(""); });
  assert.ok(!/(BRD|URD|FR-NFR)-\*\.md|requirements-\*\.json/.test(stripped), "no root-level requirements pattern in Writes: " + req);
  assert.ok(plan.indexOf("`docs/task-plans/task-plan-<feature>-<timestamp>.md`") !== -1);
  assert.ok(plan.replace("docs/task-plans/task-plan-<feature>", "").indexOf("task-plan-<feature>") === -1, "no root-level task-plan Writes");
});

test("Decompose adds each existing document the step's prompt names for update to the Writes", () => {
  // [Scenario: Legacy document named for update | spec-orchestration-chain-signoff.md "Requirement 14" | FR-190 | FR-035]
  const dec = joined(section(DO, "## Decompose"));
  assert.ok(/existing document the step's prompt names for update/.test(dec));
  assert.ok(/root-level `\.\/FR-NFR-auth\.md`/.test(dec));
  assert.ok(/Prompts\.\*\*[^\n]*(documents it updates|names for update)/.test(dec), "the Prompts bullet carries the update paths");
});

test("Decompose resolves chain Writes against the shared root: <repo>/docs/..., never <repo>/src/docs/...", () => {
  // [Scenario: Subdirectory session | spec-orchestration-spec-first.md "Requirement 17" | FR-190 | FR-187]
  const dec = joined(section(DO, "## Decompose"));
  assert.ok(/<root>|SpecGate/.test(dec));
  assert.ok(dec.indexOf("<repo>/docs/requirements/") !== -1 && dec.indexOf("<repo>/docs/task-plans/") !== -1);
  assert.ok(/(never|not)[^.]{0,40}<repo>\/src\/docs\//.test(dec));
});

test("Decompose rework of a root-level plan: the prompt names a new path under docs/task-plans/, not the root-level file", () => {
  // [Scenario: Rework of a legacy task plan | spec-orchestration-spec-first.md "Requirement 17" | FR-190]
  const dec = joined(section(DO, "## Decompose"));
  assert.ok(/root-level plan[^.]*new path under `docs\/task-plans\/`[^.]*not the root-level file/.test(dec));
  assert.ok(/absolute output path/.test(dec), "each chain prompt also names the root and the absolute output path");
});

test("Send: chain prompts name the root and the absolute output path; a fix pass overwrites only a file in docs/task-plans", () => {
  // [Scenario: Chain steps; Subdirectory session; Rework of a legacy task plan
  //  | spec-orchestration-spec-first.md "Requirement 17" | FR-190 | FR-035 | FR-182 | FR-184]
  const send = joined(section(DO, "### Send"));
  const chain = linesOf(send).find((l) => l.indexOf("For a document-chain step") !== -1);
  assert.ok(chain, "document-chain bullet in Send");
  assert.ok(/names `<root>`|names the root/.test(chain));
  assert.ok(/absolute output path/.test(chain));
  assert.ok(chain.indexOf("<root>/docs/requirements/") !== -1 && chain.indexOf("<root>/docs/task-plans/") !== -1);
  assert.ok(/only when that file is already in `docs\/task-plans\/`/.test(chain));
  assert.ok(/new file path under `docs\/task-plans\/`/.test(chain));
  assert.ok(/reviews that new file/.test(chain));
});

test("root notes: both anchored title patterns, CRLF-tolerant, match count only, no Location line", () => {
  // [Scenario: Older project; Note already written; Heading text is data; Root-level task plan
  //  | spec-orchestration-spec-first.md "Requirement 15" | FR-188 | FR-191]
  const dr = joined(section(DO, "### Decision records", false));
  ["Requirements kept at the repository root", "Task plans kept at the repository root"].forEach((title) => {
    const m = new RegExp("`(\\^## [^`]*" + title + "[^`]*)`").exec(dr);
    assert.ok(m, "no pattern for " + title);
    const rx = new RegExp(m[1]); // the pattern as the Grep tool reads it, applied per line
    const head = "## 2026-10-16: " + title;
    assert.ok(rx.test(head), "matches the heading");
    assert.ok(rx.test(head + "\r"), "matches the heading with a CR line ending");
    assert.ok(!rx.test(head + " (moved)"), "anchored at the end");
    assert.ok(!rx.test(head + "\rx"), "no stray text after the CR");
    assert.ok(!rx.test("### 2026-10-16: " + title), "anchored at the start");
    assert.ok(!rx.test(" " + head), "anchored at the start (leading space)");
    assert.ok(!rx.test("## 2026-10-16: Other: " + title), "title must follow the date prefix directly");
    assert.ok(!rx.test("## 16-10-2026: " + title), "date prefix is YYYY-MM-DD");
  });
  assert.ok(/output mode `count`/.test(dr));
  assert.ok(/no heading text/.test(dr));
  assert.ok(/no `Location:` line/.test(dr));
  assert.ok(/cancelled or edited plan writes nothing/.test(dr));
  assert.ok(/does not move them unless the user asks/.test(dr));
});

test("root notes: a move happens only on request, as its own step at PlanApproval", () => {
  // [Scenario: Move on request | spec-orchestration-spec-first.md "Requirement 15" | FR-188]
  const dr = joined(section(DO, "### Decision records", false));
  assert.ok(/a move happens only when the user asks/.test(dr));
  assert.ok(/own step at PlanApproval/.test(dr));
});

test("Preflight takes the change-check baseline against <root> and hashes the five steering files", () => {
  // [Scenario: Subdirectory session; Worktree session; Session at the git root | spec-orchestration-chain-signoff.md | FR-192 | FR-032 | FR-033]
  const pf = joined(section(DO, "## Preflight"));
  assert.ok(pf.indexOf("<root>") !== -1);
  assert.ok(pf.indexOf("git -C '<root>'") !== -1);
  [".claude/settings*.json", "CLAUDE.md", "CLAUDE.local.md", "AGENTS.md", "DECISIONS.md"].forEach((f) => assert.ok(pf.indexOf(f) !== -1, f));
  assert.ok(/never looks for `<repo>\/src\/CLAUDE\.md`/.test(pf));
  assert.ok(pf.indexOf("skipped: change-check not-run (no git)") !== -1, "the non-git marker stays");
});

test("Change check: compare-before-write uses the same root and the task-planner scope reads docs/task-plans/", () => {
  // [Scenario: Subdirectory session | spec-orchestration-chain-signoff.md | FR-192 | FR-033]
  const cc = joined(section(DO, "### Change check"));
  assert.ok(/task-planner may write only a `task-plan-\*\.md` directly under `docs\/task-plans\/`/.test(cc));
  assert.ok(/<root>/.test(cc));
  assert.ok(/DECISIONS\.md/.test(cc));
});

test("DocSignOff example table uses docs/requirements/ and docs/task-plans/ paths", () => {
  // [Scenario: Chain steps | spec-orchestration-spec-first.md "Requirement 17" | FR-190]
  const ds = joined(section(DO, "## DocSignOff"));
  assert.ok(/\| Requirements \| `docs\/requirements\//.test(ds));
  assert.ok(/\| Task plan \| `docs\/task-plans\//.test(ds));
  assert.ok(!/\| (Requirements|Task plan) \| `(FR-NFR|BRD|URD|task-plan)-/.test(ds), "no root-level example row");
});

// ---------------------------------------------------------------------------
// /do references
// ---------------------------------------------------------------------------

test("plan-format.md holds no root-level FR-NFR-auth.md or task-plan-auth-*.md example", () => {
  // [Scenario: Chain steps | spec-orchestration-review-gates.md / spec-orchestration-spec-first.md | FR-190 | FR-184]
  const t = read("skills/do/references/plan-format.md");
  assert.strictEqual(count(/(?<!docs\/requirements\/)FR-NFR-auth\.md/, t), 0, "root-level FR-NFR-auth.md example");
  assert.strictEqual(count(/(?<!docs\/task-plans\/)task-plan-auth-/, t), 0, "root-level task-plan-auth example");
  assert.ok(t.indexOf("docs/requirements/FR-NFR-auth.md") !== -1);
  assert.ok(t.indexOf("docs/task-plans/task-plan-auth-*.md") !== -1);
});

test("plan-format.md: a fix pass overwrites the same task-plan file only when it is already in docs/task-plans/", () => {
  // [Scenario: Rework of a legacy task plan | spec-orchestration-spec-first.md "Requirement 17" | FR-190 | FR-184]
  const line = linesOf(read("skills/do/references/plan-format.md")).find((l) => /fix pass overwrites/.test(l));
  assert.ok(line, "no fix pass line");
  assert.ok(/only when it is already in `docs\/task-plans\/`/.test(line));
});

test("plan-format.md: Documents found paths resolve against the git root", () => {
  // [Scenario: Subdirectory session | spec-orchestration-spec-first.md "Requirement 14" | FR-187]
  const t = read("skills/do/references/plan-format.md");
  assert.ok(linesOf(t).some((l) => /Documents found/.test(l) && /git root|<root>/.test(l)));
});

test("fix-phase-rules.md: the task-plan fix overwrites only a file in docs/task-plans/ and a root-level plan gets a new file", () => {
  // [Scenario: Rework of a legacy task plan | spec-orchestration-review-gates.md | FR-190 | FR-184]
  const lines = linesOf(read("skills/do/references/fix-phase-rules.md")).filter((l) => /task-plan/.test(l) && /already in `docs\/task-plans\/`/.test(l));
  assert.ok(lines.length >= 2, "both the routing row and the checklist item carry the condition");
  lines.forEach((l) => assert.ok(/new file/.test(l) && /root-level/.test(l), "root-level plan gets a new file: " + l.slice(0, 100)));
});

test("agent-registry.md: both task-planner rows carry the docs/task-plans/ scope and the overwrite condition", () => {
  // [Requirement: Task-planner writes only its task-plan file | spec-orchestration-agents.md | FR-189 | FR-186 | FR-184]
  const rows = linesOf(read("skills/do/references/agent-registry.md")).filter((l) => l.indexOf("| **task-planner** |") === 0);
  assert.ok(rows.length >= 2, "the agent table (line 18) and the skill table (line 36) both list task-planner");
  rows.forEach((r) => {
    assert.ok(r.indexOf("docs/task-plans/task-plan-*.md") !== -1, "scope: " + r.slice(0, 80));
    assert.ok(/overwrites the same file only when it is already in `docs\/task-plans\/`/.test(r), "overwrite condition: " + r.slice(0, 80));
  });
});

test("agent-registry.md: the intake-reviewer conflict-check row names the new document locations", () => {
  // [Scenario: Path in a new folder | spec-orchestration-agents.md "Conflict-check path list follows the document locations" | FR-189]
  const row = linesOf(read("skills/do/references/agent-registry.md")).find((l) => l.indexOf("| **intake-reviewer** | `gather-requirements`") === 0);
  assert.ok(row, "intake-reviewer skill row");
  assert.ok(row.indexOf("docs/requirements/") !== -1 && row.indexOf("docs/task-plans/") !== -1);
  assert.ok(/git root/.test(row));
  assert.ok(/old root/.test(row));
});
