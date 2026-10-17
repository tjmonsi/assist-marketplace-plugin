// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Acceptance tests for the skill metadata mirror, release 1.12.0: each
// plugins/assist-plugin/skills/<name>/metadata.json mirrors the frontmatter of its SKILL.md,
// which is the source.
//
// Sources: specs/spec-skills-manifests-docs.md (Change Log 2026-10-16, Requirement: Skill
// metadata mirrors the SKILL.md frontmatter, with its Scenarios by title), specs/spec-skills-git.md
// (FR-196, the commit skill's model field), docs/requirements/FR-NFR-assist-plugin.md (FR-193,
// FR-196, UR-053, BR-016). Decisions: DECISIONS.md lines 128-131 (metadata.json mirrors the
// frontmatter), 143-146 (/commit runs on Haiku), 168-171 (frontmatter is the source; debug gains
// effort: high).
// Task plan step 34.
//
// Traceability format: [Scenario title | spec section | FR ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// Contract used:
//   Fields compared: name, description, effort, allowed-tools, argument-hint, model. A field
//   present on one side only fails; a field present on both sides with different values fails;
//   a field absent on both sides passes. A failure names the skill and the field. A skill with no
//   metadata.json is listed by name and never fails the test.
//   SKILL.md frontmatter forms read: plain scalars, quoted strings, YAML folded scalars (> and >-)
//   joined by single spaces, and block list items ("- item").
//
// The failing branches ("Field differs", "Field on one side only") run against temp fixtures, not
// against the real tree.
//
// Run: node --test tests/skills/metadata-mirror.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const SKILLS = path.join(REPO, "plugins", "assist-plugin", "skills");

const SPEC = "spec-skills-manifests-docs.md";
const FIELDS = ["name", "description", "effort", "allowed-tools", "argument-hint", "model"];
const WITHOUT_METADATA = ["task-plan", "create-test", "code", "pentest", "integrated-test", "run-test"];

// ---------------------------------------------------------------------------
// Frontmatter reader and comparison (the test's own checker)
// ---------------------------------------------------------------------------

function unquote(raw) {
  const s = raw.trim();
  if (s.length >= 2 && s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') {
    try {
      return JSON.parse(s);
    } catch (err) {
      return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
  }
  if (s.length >= 2 && s.charAt(0) === "'" && s.charAt(s.length - 1) === "'") {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

function foldLines(lines) {
  // YAML folded scalar: lines join with one space, a blank line starts a new paragraph.
  const paragraphs = [];
  let current = [];
  lines.forEach((line) => {
    if (line === "") {
      if (current.length) paragraphs.push(current.join(" "));
      current = [];
    } else {
      current.push(line);
    }
  });
  if (current.length) paragraphs.push(current.join(" "));
  return paragraphs.join("\n");
}

function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!m) throw new Error("no frontmatter block");
  const lines = m[1].split(/\r?\n/);
  const out = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || /^\s*#/.test(line)) {
      i++;
      continue;
    }
    const kv = /^([A-Za-z][A-Za-z0-9_-]*):(?:[ \t]+(.*))?$/.exec(line);
    if (!kv) {
      i++;
      continue;
    }
    const key = kv[1];
    const rest = kv[2] === undefined ? "" : kv[2].trim();
    i++;
    if (/^[>|][+-]?$/.test(rest)) {
      const body = [];
      while (i < lines.length && (lines[i].trim() === "" || /^\s/.test(lines[i]))) {
        body.push(lines[i].trim());
        i++;
      }
      while (body.length && body[body.length - 1] === "") body.pop();
      out[key] = rest.charAt(0) === ">" ? foldLines(body) : body.join("\n");
    } else if (rest === "") {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(unquote(lines[i].replace(/^\s*-\s+/, "")));
        i++;
      }
      out[key] = items;
    } else {
      out[key] = unquote(rest);
    }
  }
  return out;
}

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function sameValue(a, b) {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch (err) {
    return false;
  }
}

// Returns [{skill, field, kind}] for one skill; kind is "only-in-frontmatter", "only-in-metadata", or "differs".
function compareSkill(skill, frontmatter, metadata) {
  const problems = [];
  FIELDS.forEach((field) => {
    const inFm = has(frontmatter, field);
    const inMd = has(metadata, field);
    if (inFm && !inMd) problems.push({ skill: skill, field: field, kind: "only-in-frontmatter" });
    else if (!inFm && inMd) problems.push({ skill: skill, field: field, kind: "only-in-metadata" });
    else if (inFm && inMd && !sameValue(frontmatter[field], metadata[field])) problems.push({ skill: skill, field: field, kind: "differs" });
  });
  return problems;
}

function describeProblems(problems) {
  return problems.map((p) => "skill " + p.skill + ", field " + p.field + " (" + p.kind + ")").join("; ");
}

// Reads every skills/<name> directory under `root`; returns {compared: [{skill, problems}], without: [name]}.
function checkTree(root) {
  const compared = [];
  const without = [];
  fs.readdirSync(root).sort().forEach((name) => {
    const dir = path.join(root, name);
    if (!fs.statSync(dir).isDirectory()) return;
    const skillFile = path.join(dir, "SKILL.md");
    if (!fs.existsSync(skillFile)) return;
    const metadataFile = path.join(dir, "metadata.json");
    if (!fs.existsSync(metadataFile)) {
      without.push(name);
      return;
    }
    const frontmatter = parseFrontmatter(fs.readFileSync(skillFile, "utf8"));
    const metadata = JSON.parse(fs.readFileSync(metadataFile, "utf8"));
    compared.push({ skill: name, problems: compareSkill(name, frontmatter, metadata) });
  });
  return { compared: compared, without: without };
}

// ---------------------------------------------------------------------------
// Temp fixtures
// ---------------------------------------------------------------------------

const made = [];

function fixtureRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "metadata-mirror-"));
  made.push(dir);
  return dir;
}

function addSkill(root, name, frontmatterLines, metadata) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), "---\n" + frontmatterLines.join("\n") + "\n---\n\n# " + name + "\n");
  if (metadata !== null) fs.writeFileSync(path.join(dir, "metadata.json"), JSON.stringify(metadata, null, 2) + "\n");
}

after(() => {
  made.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

const COMMIT_FM = [
  "name: commit",
  "description: >-",
  "  Create conventional commits with git. Stages files, composes messages using",
  "  conventional commits format, and supports squash/amend.",
  "effort: low",
  "model: haiku",
  "allowed-tools:",
  "  - Bash",
  'argument-hint: "[--squash] [--amend] [--scope SCOPE] [TYPE: message]"',
];

const COMMIT_MD = {
  name: "commit",
  description: "Create conventional commits with git. Stages files, composes messages using conventional commits format, and supports squash/amend.",
  effort: "low",
  model: "haiku",
  "allowed-tools": ["Bash"],
  "argument-hint": "[--squash] [--amend] [--scope SCOPE] [TYPE: message]",
};

// ---------------------------------------------------------------------------
// Reader behavior
// ---------------------------------------------------------------------------

test("[Scenario: Equal fields (reader) | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193] the reader joins a folded description with single spaces and reads quoted strings and list items", () => {
  const fm = parseFrontmatter("---\n" + COMMIT_FM.join("\n") + "\n---\n\n# commit\n");
  assert.strictEqual(fm.name, "commit");
  assert.strictEqual(fm.description, COMMIT_MD.description);
  assert.strictEqual(fm.effort, "low");
  assert.strictEqual(fm.model, "haiku");
  assert.deepStrictEqual(fm["allowed-tools"], ["Bash"]);
  assert.strictEqual(fm["argument-hint"], COMMIT_MD["argument-hint"]);
});

test("[Scenario: Equal fields (reader) | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193] a blank line after a folded scalar, an empty quoted string, and list items with parentheses and quotes read as written", () => {
  const text = [
    "---",
    "name: do",
    "description: >-",
    "  First line",
    "  second line.",
    "",
    "effort: xhigh",
    "allowed-tools:",
    "  - Read",
    '  - Bash(node "${CLAUDE_PLUGIN_ROOT}/hooks/health-check.js" --data-dir "${CLAUDE_PLUGIN_DATA}")',
    "  - Edit(./docs/tts/voice-*.md)",
    'argument-hint: ""',
    "---",
    "",
    "# Do",
    "",
  ].join("\n");
  const fm = parseFrontmatter(text);
  assert.strictEqual(fm.description, "First line second line.");
  assert.strictEqual(fm.effort, "xhigh");
  assert.deepStrictEqual(fm["allowed-tools"], [
    "Read",
    'Bash(node "${CLAUDE_PLUGIN_ROOT}/hooks/health-check.js" --data-dir "${CLAUDE_PLUGIN_DATA}")',
    "Edit(./docs/tts/voice-*.md)",
  ]);
  assert.strictEqual(fm["argument-hint"], "");
});

// ---------------------------------------------------------------------------
// Fixture scenarios (failing branches)
// ---------------------------------------------------------------------------

test("[Scenario: Equal fields | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193 UR-053 BR-016] a skill whose metadata holds the same values passes", () => {
  const root = fixtureRoot();
  addSkill(root, "commit", COMMIT_FM, COMMIT_MD);
  const result = checkTree(root);
  assert.strictEqual(result.compared.length, 1);
  assert.deepStrictEqual(result.compared[0].problems, []);
});

test("[Scenario: Field differs | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193] a differing description fails and names commit and description", () => {
  const root = fixtureRoot();
  addSkill(root, "commit", COMMIT_FM, Object.assign({}, COMMIT_MD, { description: "Create commits." }));
  const problems = checkTree(root).compared[0].problems;
  assert.deepStrictEqual(problems.map((p) => [p.skill, p.field, p.kind]), [["commit", "description", "differs"]]);
  const message = describeProblems(problems);
  assert.ok(message.indexOf("commit") !== -1 && message.indexOf("description") !== -1, message);
});

["name", "effort", "argument-hint", "model"].forEach((field) => {
  test("[Scenario: Field differs | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193] a differing " + field + " fails and names the field", () => {
    const root = fixtureRoot();
    const md = Object.assign({}, COMMIT_MD);
    md[field] = "something else";
    addSkill(root, "commit", COMMIT_FM, md);
    const problems = checkTree(root).compared[0].problems;
    assert.deepStrictEqual(problems.map((p) => [p.skill, p.field, p.kind]), [["commit", field, "differs"]]);
  });
});

test("[Scenario: Field differs | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193] a differing allowed-tools list (an element, the order, or the length) fails", () => {
  [["Read"], ["Bash", "Read"], []].forEach((tools) => {
    const root = fixtureRoot();
    addSkill(root, "commit", COMMIT_FM, Object.assign({}, COMMIT_MD, { "allowed-tools": tools }));
    const problems = checkTree(root).compared[0].problems;
    assert.deepStrictEqual(problems.map((p) => [p.field, p.kind]), [["allowed-tools", "differs"]], JSON.stringify(tools));
  });
  const root = fixtureRoot();
  addSkill(root, "multi", ["name: multi", "description: d", "effort: low", "allowed-tools:", "  - Read", "  - Grep", 'argument-hint: ""'], {
    name: "multi",
    description: "d",
    effort: "low",
    "allowed-tools": ["Grep", "Read"],
    "argument-hint": "",
  });
  assert.deepStrictEqual(checkTree(root).compared[0].problems.map((p) => p.field), ["allowed-tools"]);
});

test("[Scenario: Field on one side only | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193] metadata holds effort and the frontmatter has none: fails naming the skill and effort", () => {
  const root = fixtureRoot();
  const fm = COMMIT_FM.filter((line) => !/^effort:/.test(line));
  addSkill(root, "commit", fm, COMMIT_MD);
  const problems = checkTree(root).compared[0].problems;
  assert.deepStrictEqual(problems.map((p) => [p.skill, p.field, p.kind]), [["commit", "effort", "only-in-metadata"]]);
});

test("[Scenario: Field on one side only | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193] the frontmatter holds effort and the metadata has none: fails naming the skill and effort", () => {
  const root = fixtureRoot();
  const md = Object.assign({}, COMMIT_MD);
  delete md.effort;
  addSkill(root, "commit", COMMIT_FM, md);
  const problems = checkTree(root).compared[0].problems;
  assert.deepStrictEqual(problems.map((p) => [p.skill, p.field, p.kind]), [["commit", "effort", "only-in-frontmatter"]]);
});

test("[Scenario: Model field | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193 FR-196] the frontmatter sets model: haiku and the metadata lacks model: fails while it does not", () => {
  const root = fixtureRoot();
  const md = Object.assign({}, COMMIT_MD);
  delete md.model;
  addSkill(root, "commit", COMMIT_FM, md);
  const problems = checkTree(root).compared[0].problems;
  assert.deepStrictEqual(problems.map((p) => [p.field, p.kind]), [["model", "only-in-frontmatter"]]);
  const wrong = fixtureRoot();
  addSkill(wrong, "commit", COMMIT_FM, Object.assign({}, COMMIT_MD, { model: "sonnet" }));
  assert.deepStrictEqual(checkTree(wrong).compared[0].problems.map((p) => [p.field, p.kind]), [["model", "differs"]]);
});

test("[Scenario: Equal fields | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193] a field absent on both sides passes (a skill with no model)", () => {
  const root = fixtureRoot();
  const fm = COMMIT_FM.filter((line) => !/^model:/.test(line));
  const md = Object.assign({}, COMMIT_MD);
  delete md.model;
  addSkill(root, "commit", fm, md);
  assert.deepStrictEqual(checkTree(root).compared[0].problems, []);
});

test("[Scenario: Equal fields | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193] several mismatches are all reported, each naming its field", () => {
  const root = fixtureRoot();
  addSkill(root, "commit", COMMIT_FM, Object.assign({}, COMMIT_MD, { effort: "high", description: "x" }));
  const fields = checkTree(root).compared[0].problems.map((p) => p.field).sort();
  assert.deepStrictEqual(fields, ["description", "effort"]);
});

test("[Scenario: Skill without metadata | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193] a skill without metadata.json is listed by name and causes no problem", () => {
  const root = fixtureRoot();
  addSkill(root, "commit", COMMIT_FM, COMMIT_MD);
  addSkill(root, "code", ["name: code", "description: d", "allowed-tools:", "  - Read"], null);
  addSkill(root, "run-test", ["name: run-test", "description: d", "effort: high", "allowed-tools:", "  - Read"], null);
  const result = checkTree(root);
  assert.deepStrictEqual(result.without, ["code", "run-test"]);
  assert.strictEqual(result.compared.length, 1);
  assert.deepStrictEqual(result.compared[0].problems, []);
});

// ---------------------------------------------------------------------------
// The real tree
// ---------------------------------------------------------------------------

const real = checkTree(SKILLS);

test("[Scenario: Skill without metadata | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193] the six skills without metadata.json are listed by name and do not fail", (t) => {
  t.diagnostic("skills without metadata.json: " + real.without.join(", "));
  WITHOUT_METADATA.forEach((name) => {
    assert.ok(fs.existsSync(path.join(SKILLS, name, "SKILL.md")), name + " is a skill");
    assert.ok(real.without.indexOf(name) !== -1, name + " has no metadata.json and is listed");
  });
});

test("[Scenario: Equal fields | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193] every skill has a SKILL.md whose frontmatter name is its directory name", () => {
  fs.readdirSync(SKILLS).forEach((name) => {
    const dir = path.join(SKILLS, name);
    if (!fs.statSync(dir).isDirectory()) return;
    const fm = parseFrontmatter(fs.readFileSync(path.join(dir, "SKILL.md"), "utf8"));
    assert.strictEqual(fm.name, name, "frontmatter name of " + name);
  });
});

real.compared.forEach((entry) => {
  test("[Scenario: Equal fields | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193 UR-053 BR-016] skills/" + entry.skill + "/metadata.json mirrors its SKILL.md frontmatter", () => {
    assert.deepStrictEqual(entry.problems, [], describeProblems(entry.problems));
  });
});

test("[Scenario: Debug effort | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193] debug holds effort: high in the frontmatter and in metadata.json, and the effort field passes", () => {
  const fm = parseFrontmatter(fs.readFileSync(path.join(SKILLS, "debug", "SKILL.md"), "utf8"));
  const md = JSON.parse(fs.readFileSync(path.join(SKILLS, "debug", "metadata.json"), "utf8"));
  assert.strictEqual(fm.effort, "high");
  assert.strictEqual(md.effort, "high");
  const effort = compareSkill("debug", fm, md).filter((p) => p.field === "effort");
  assert.deepStrictEqual(effort, []);
});

test("[Scenario: Model field | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193 FR-196] commit holds model: haiku in the frontmatter and \"model\": \"haiku\" in metadata.json", () => {
  const fm = parseFrontmatter(fs.readFileSync(path.join(SKILLS, "commit", "SKILL.md"), "utf8"));
  const md = JSON.parse(fs.readFileSync(path.join(SKILLS, "commit", "metadata.json"), "utf8"));
  assert.strictEqual(fm.model, "haiku");
  assert.strictEqual(md.model, "haiku");
});

test("[Scenario: Equal fields | " + SPEC + " Skill metadata mirrors the SKILL.md frontmatter | FR-193] a skill with an empty argument-hint on both sides (map-project) passes", () => {
  const fm = parseFrontmatter(fs.readFileSync(path.join(SKILLS, "map-project", "SKILL.md"), "utf8"));
  const md = JSON.parse(fs.readFileSync(path.join(SKILLS, "map-project", "metadata.json"), "utf8"));
  assert.strictEqual(fm["argument-hint"], "");
  assert.strictEqual(md["argument-hint"], "");
  assert.deepStrictEqual(compareSkill("map-project", fm, md), []);
});
