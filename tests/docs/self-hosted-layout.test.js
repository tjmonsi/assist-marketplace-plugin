// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box tests for the self-hosted repository layout and the documentation wording of 1.11.1
// (task plan step 29).
//
//   FR-174  requirements in docs/requirements/, task plans in docs/task-plans/, specs under specs/
//   FR-178  version agreement between the manifests and the newest root CHANGELOG heading
//   FR-181  the docs/tts/ exemption wording in the hook descriptions (and OP-2 for three Area C files)
//   NFR-020 agent and skill counts agree between the documents and the directories
//
// Sources: specs/spec-skills-manifests-docs.md (Requirement: Self-hosted requirements, specs, and
// plans; Requirement: Manifest versions agree at release; Requirement: Agent and skill counts agree
// in eight files), specs/spec-hooks-prose-hooks.md (Requirement: Voice-script exemption under the
// project root and the session directory, "Documents that describe the built rule"),
// specs/spec-skills.md (OP-2), and docs/requirements/FR-NFR-assist-plugin.md.
//
// Traceability format: [Scenario | spec section | requirement ids | upstream ids]. The specs use
// named requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// The tests assert the specified end state. The version is read from plugin.json and never pinned.
// The counts are read from the agents/ and skills/ directories and never pinned.
//
// Run: node --test tests/docs/self-hosted-layout.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function repoPath(rel) {
  return path.join(REPO, rel);
}

// Names in `dir` that match `prefix*suffix`. A missing directory yields an empty list.
function globNames(dir, prefix, suffix) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch (e) {
    return [];
  }
  return names.filter(function (n) {
    return n.length >= prefix.length + suffix.length && n.indexOf(prefix) === 0 && n.slice(n.length - suffix.length) === suffix;
  });
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Scenario: Repository layout after the documents are committed
// ---------------------------------------------------------------------------

const REQUIREMENT_PATTERNS = [
  { prefix: "BRD-", suffix: ".md", label: "BRD-*.md" },
  { prefix: "URD-", suffix: ".md", label: "URD-*.md" },
  { prefix: "FR-NFR-", suffix: ".md", label: "FR-NFR-*.md" },
];

REQUIREMENT_PATTERNS.forEach(function (p) {
  test("docs/requirements/" + p.label + " matches at least one file", () => {
    // [Scenario: Repository layout after the documents are committed | spec-skills-manifests-docs.md "Self-hosted requirements, specs, and plans" | FR-174 | FR-182 | UR-048 | BR-014]
    // Valid: each of the three requirement patterns under docs/requirements/ has a file.
    const hits = globNames(repoPath("docs/requirements"), p.prefix, p.suffix);
    assert.ok(hits.length >= 1, "no file matches ./docs/requirements/" + p.label);
  });
});

test("specs/spec-*.md matches at least one file", () => {
  // [Scenario: Repository layout after the documents are committed | spec-skills-manifests-docs.md "Self-hosted requirements, specs, and plans" | FR-174 | UR-048 | BR-014]
  // Valid: the spec pattern under specs/ has a file.
  const hits = globNames(repoPath("specs"), "spec-", ".md");
  assert.ok(hits.length >= 1, "no file matches ./specs/spec-*.md");
});

test("docs/task-plans/task-plan-*.md matches at least one file", () => {
  // [Task plan folder holds the plan | spec-skills-manifests-docs.md "Self-hosted requirements, specs, and plans" (task plans in docs/task-plans/) | FR-174 | FR-184 | UR-048 | BR-014]
  // Valid: the approved 1.11.1 task plan lives in the task-plans folder.
  const hits = globNames(repoPath("docs/task-plans"), "task-plan-", ".md");
  assert.ok(hits.length >= 1, "no file matches ./docs/task-plans/task-plan-*.md");
});

test("docs/requirements/BRD-assist-plugin.md exists and is found by the BRD pattern", () => {
  // [Scenario: SpecGate search | spec-skills-manifests-docs.md "Self-hosted requirements, specs, and plans" | FR-174 | UR-048 | BR-014]
  // Valid: the file named in the GIVEN clause exists and a glob of docs/requirements/BRD-*.md lists it.
  assert.ok(fs.existsSync(repoPath("docs/requirements/BRD-assist-plugin.md")), "docs/requirements/BRD-assist-plugin.md is missing");
  const hits = globNames(repoPath("docs/requirements"), "BRD-", ".md");
  assert.ok(hits.indexOf("BRD-assist-plugin.md") !== -1, "BRD-assist-plugin.md is not matched by docs/requirements/BRD-*.md");
});

test("docs/requirements/ holds the URD and the FR-NFR document for the plugin", () => {
  // [Scenario: Scope of documents | spec-skills-manifests-docs.md "Self-hosted requirements, specs, and plans" (state table, Requirements row) | FR-174 | UR-048 | BR-014]
  // Valid: the three requirement documents of the whole plugin sit together.
  ["URD-assist-plugin.md", "FR-NFR-assist-plugin.md"].forEach(function (name) {
    assert.ok(fs.existsSync(repoPath("docs/requirements/" + name)), "docs/requirements/" + name + " is missing");
  });
});

const ROOT_PATTERNS = [
  { prefix: "BRD-", suffix: ".md", label: "./BRD-*.md" },
  { prefix: "URD-", suffix: ".md", label: "./URD-*.md" },
  { prefix: "FR-NFR-", suffix: ".md", label: "./FR-NFR-*.md" },
  { prefix: "requirements-", suffix: ".json", label: "./requirements-*.json" },
  { prefix: "task-plan-", suffix: ".md", label: "./task-plan-*.md" },
];

ROOT_PATTERNS.forEach(function (p) {
  test("no root-level file matches " + p.label, () => {
    // [Scenario: Repository layout after the documents are committed | spec-skills-manifests-docs.md "Self-hosted requirements, specs, and plans" | FR-174 | FR-182 | FR-184 | UR-048 | BR-014]
    // Invalid location: this repository keeps no legacy root-level documents (DECISIONS.md, 2026-10-16).
    const hits = globNames(REPO, p.prefix, p.suffix);
    assert.deepStrictEqual(hits, [], "root-level file(s) match " + p.label + ": " + JSON.stringify(hits));
  });
});

test("no task-plan-*.md sits directly in docs/", () => {
  // [Scenario: Task plan outside the task-plans folder | spec-skills-manifests-docs.md "Self-hosted requirements, specs, and plans" | FR-174 | UR-048 | BR-014]
  // Invalid location: docs/task-plan-auth.md style files are outside the SpecGate pattern.
  const hits = globNames(repoPath("docs"), "task-plan-", ".md");
  assert.deepStrictEqual(hits, [], "task plan(s) directly in docs/: " + JSON.stringify(hits));
});

test("docs/requirements/ holds no task-plan-*.md and docs/task-plans/ holds no requirements document", () => {
  // [Scenario: Scope of documents | spec-skills-manifests-docs.md "Self-hosted requirements, specs, and plans" | FR-174 | FR-182 | FR-184 | UR-048 | BR-014]
  // Invalid location: each document type stays in its own folder.
  assert.deepStrictEqual(globNames(repoPath("docs/requirements"), "task-plan-", ".md"), []);
  REQUIREMENT_PATTERNS.forEach(function (p) {
    assert.deepStrictEqual(globNames(repoPath("docs/task-plans"), p.prefix, p.suffix), [], "docs/task-plans/ holds " + p.label);
  });
});

// ---------------------------------------------------------------------------
// FR-181 and OP-2: the docs/tts/ exemption wording
// ---------------------------------------------------------------------------

// Sentences (and line pieces) that mention docs/tts/ and say the hooks skip or exempt it.
// A sentence ends at . ! or ? followed by white space and a capital letter, a backtick, a star,
// an opening parenthesis, or an opening bracket; a line break ends it too.
function exemptionSentences(text) {
  const units = [];
  text.replace(/\r\n/g, "\n").split("\n").forEach(function (line) {
    line.split(/(?<=[.!?])\s+(?=[A-Z`*(\[])/).forEach(function (s) {
      units.push(s);
    });
  });
  return units.filter(function (s) {
    return s.indexOf("docs/tts/") !== -1 && /skip|exempt/i.test(s);
  });
}

const PROJECT_ROOT_RE = /project root/i;
// "the session's working directory" (straight or curly apostrophe), "session working directory",
// or "session directory".
const SESSION_DIR_RE = /session(?:'|’)s working directory|session working directory|session directory/i;

const HOOK_DESCRIPTION_FILES = [
  "CLAUDE.md",
  "plugins/assist-plugin/Claude.md",
  "README.md",
  "plugins/assist-plugin/skills/health/SKILL.md",
  "plugins/assist-plugin/docs/SPECIFICATION.md",
];

HOOK_DESCRIPTION_FILES.forEach(function (rel) {
  test(rel + ": the phrase 'not the git root' is gone", () => {
    // [Scenario: Subdirectory session, voice script at the project root | spec-hooks-prose-hooks.md "Voice-script exemption under the project root and the session directory" (Documents that describe the built rule) | FR-181 | FR-104 | UR-016 | BR-008]
    // Invalid (stale wording): the built rule said the hooks use the hook's working directory, not the git root.
    assert.doesNotMatch(read(repoPath(rel)), /not the git root/i);
  });

  test(rel + ": the docs/tts/ exemption sentence is present", () => {
    // [Scenario: Subdirectory session, voice script at the project root | spec-hooks-prose-hooks.md "Voice-script exemption under the project root and the session directory" | FR-181 | FR-104 | UR-016 | BR-008]
    // Null case: a deleted description would pass the 'phrase is gone' test, so require the sentence.
    const sentences = exemptionSentences(read(repoPath(rel)));
    assert.ok(sentences.length >= 1, rel + " has no sentence that says the hooks skip or exempt docs/tts/");
  });

  test(rel + ": the exemption sentence names the project root and the session's working directory", () => {
    // [Scenario: Subdirectory session, voice script in the session directory | spec-hooks-prose-hooks.md "Voice-script exemption under the project root and the session directory" | FR-181 | FR-104 | UR-016 | BR-008]
    // Valid (end state): the description names both exempt roots in one sentence.
    const sentences = exemptionSentences(read(repoPath(rel)));
    const both = sentences.filter(function (s) {
      return PROJECT_ROOT_RE.test(s) && SESSION_DIR_RE.test(s);
    });
    assert.ok(
      both.length >= 1,
      rel + ": no docs/tts/ exemption sentence names both the project root and the session's working directory; sentences found: " +
        JSON.stringify(sentences.map(function (s) { return s.slice(0, 160); }))
    );
  });
});

test("skills/voice-script/SKILL.md: the prose-hook exemption sentence names the session directory and the project root", () => {
  // [Scenario: Subdirectory session, voice script in the session directory | spec-hooks-prose-hooks.md "Voice-script exemption under the project root and the session directory" ("/voice-script is unchanged"; OP-2 in spec-skills.md) | FR-181 | FR-163 | UR-016 | BR-008]
  // Valid (end state): only the exemption sentence is checked. The save-path wording ("not the git root"
  // describes where the script is saved) stays as it is and is not asserted here.
  const text = read(path.join(PLUGIN, "skills", "voice-script", "SKILL.md"));
  const sentences = [];
  text.replace(/\r\n/g, "\n").split("\n").forEach(function (line) {
    line.split(/(?<=[.!?])\s+(?=[A-Z`*(\[])/).forEach(function (s) {
      if (/prose-hook exemption/i.test(s)) sentences.push(s);
    });
  });
  assert.ok(sentences.length >= 1, "no sentence about the prose-hook exemption in skills/voice-script/SKILL.md");
  const ok = sentences.filter(function (s) {
    return (
      s.indexOf("docs/tts/") !== -1 &&
      PROJECT_ROOT_RE.test(s) &&
      /that directory|session(?:'|’)s working directory|session working directory|session directory|working directory/i.test(s)
    );
  });
  assert.ok(
    ok.length >= 1,
    "the prose-hook exemption sentence must name docs/tts/, the session directory, and the project root; found: " +
      JSON.stringify(sentences.map(function (s) { return s.slice(0, 200); }))
  );
});

test("the five hook descriptions agree: none lists the project root without the session directory", () => {
  // [Scenario: Other docs path stays gated | spec-hooks-prose-hooks.md "Voice-script exemption under the project root and the session directory" | FR-181 | UR-016 | BR-008]
  // Boundary: a description that names only one root contradicts the two-root rule. Every exemption
  // sentence that names one root must be matched by a sentence in the same file that names both.
  HOOK_DESCRIPTION_FILES.forEach(function (rel) {
    const sentences = exemptionSentences(read(repoPath(rel)));
    const onlyOne = sentences.filter(function (s) {
      return PROJECT_ROOT_RE.test(s) !== SESSION_DIR_RE.test(s);
    });
    const both = sentences.filter(function (s) {
      return PROJECT_ROOT_RE.test(s) && SESSION_DIR_RE.test(s);
    });
    if (onlyOne.length > 0) {
      assert.ok(both.length >= 1, rel + ": a docs/tts/ sentence names only one root and no sentence names both: " + JSON.stringify(onlyOne));
    }
  });
});

// ---------------------------------------------------------------------------
// Version agreement (Requirement: Manifest versions agree at release; FR-178 New release)
// ---------------------------------------------------------------------------

const PLUGIN_JSON = path.join(PLUGIN, ".claude-plugin", "plugin.json");
const MARKETPLACE_JSON = path.join(REPO, ".claude-plugin", "marketplace.json");
const ROOT_CHANGELOG = path.join(REPO, "CHANGELOG.md");

function marketplacePluginEntry() {
  const m = JSON.parse(read(MARKETPLACE_JSON));
  assert.ok(Array.isArray(m.plugins), "marketplace.json has no plugins array");
  const entry = m.plugins.filter(function (p) {
    return p && p.name === "assist-plugin";
  })[0];
  assert.ok(entry, "marketplace.json has no plugin entry named assist-plugin");
  return entry;
}

function newestChangelogVersion() {
  const m = /^## \[(\d+\.\d+\.\d+)\]/m.exec(read(ROOT_CHANGELOG));
  assert.ok(m, "the root CHANGELOG.md has no '## [x.y.z]' heading");
  return m[1];
}

test("plugin.json version is a x.y.z string", () => {
  // [Scenario: Equal | spec-skills-manifests-docs.md "Manifest versions agree at release" | FR-173 | UR-046 | BR-011]
  // Type check: the version is a string of three dot-separated integers.
  const v = JSON.parse(read(PLUGIN_JSON)).version;
  assert.strictEqual(typeof v, "string");
  assert.match(v, /^\d+\.\d+\.\d+$/);
});

test("plugin.json and the marketplace.json plugin entry carry the same version", () => {
  // [Scenario: Equal / Different | spec-skills-manifests-docs.md "Manifest versions agree at release" | FR-173 | UR-046 | BR-011]
  // Valid: the two manifests are equal at release.
  const pluginVersion = JSON.parse(read(PLUGIN_JSON)).version;
  const entryVersion = marketplacePluginEntry().version;
  assert.strictEqual(entryVersion, pluginVersion, "marketplace.json says " + entryVersion + ", plugin.json says " + pluginVersion);
});

test("the newest root CHANGELOG.md heading equals the plugin.json version", () => {
  // [Scenario: New release | spec-skills-manifests-docs.md "Plugin changelog is a pointer" | FR-178 | UR-052 | BR-017]
  // Valid: the release notes of the current version sit in the root CHANGELOG.md, newest first.
  const pluginVersion = JSON.parse(read(PLUGIN_JSON)).version;
  assert.strictEqual(newestChangelogVersion(), pluginVersion);
});

test("the newest root CHANGELOG.md heading equals the marketplace.json plugin entry version", () => {
  // [Scenario: New release | spec-skills-manifests-docs.md "Plugin changelog is a pointer" | FR-178 | FR-173 | UR-052 | BR-017]
  // Valid: all three version sources agree.
  assert.strictEqual(newestChangelogVersion(), marketplacePluginEntry().version);
});

test("the root CHANGELOG.md has exactly one heading for the current version", () => {
  // [Scenario: New release | spec-skills-manifests-docs.md "Plugin changelog is a pointer" | FR-178 | UR-052 | BR-017]
  // Boundary: a duplicate heading would mean a release entry was pasted twice.
  const v = JSON.parse(read(PLUGIN_JSON)).version;
  const count = (read(ROOT_CHANGELOG).match(new RegExp("^## \\[" + escapeRe(v) + "\\]", "gm")) || []).length;
  assert.strictEqual(count, 1, "root CHANGELOG.md has " + count + " headings for " + v);
});

test("marketplace name and plugin name stay unchanged", () => {
  // [Scenario: Release keeps the id | spec-skills-manifests-docs.md "Names stay stable across releases" | NFR-022 | BR-011 | FR-172]
  // Invalid (rename): a different name breaks existing installs.
  const m = JSON.parse(read(MARKETPLACE_JSON));
  assert.strictEqual(m.name, "assist-plugin-marketplace");
  assert.strictEqual(marketplacePluginEntry().name, "assist-plugin");
  assert.strictEqual(JSON.parse(read(PLUGIN_JSON)).name, "assist-plugin");
});

// ---------------------------------------------------------------------------
// NFR-020: agent and skill counts agree with the directories
// ---------------------------------------------------------------------------

function listAgents() {
  return globNames(path.join(PLUGIN, "agents"), "", ".md");
}

function listSkills() {
  const dir = path.join(PLUGIN, "skills");
  return fs.readdirSync(dir).filter(function (n) {
    return fs.existsSync(path.join(dir, n, "SKILL.md"));
  });
}

function isInternalSkill(name) {
  const text = read(path.join(PLUGIN, "skills", name, "SKILL.md"));
  const fm = /^---\n([\s\S]*?)\n---/.exec(text.replace(/\r\n/g, "\n"));
  return fm !== null && /^user-invocable:\s*false\s*$/m.test(fm[1]);
}

function counts() {
  const skills = listSkills();
  const internal = skills.filter(isInternalSkill).length;
  return { agents: listAgents().length, skills: skills.length, internal: internal, invocable: skills.length - internal };
}

// Every "<n> <word>" statement for the given words in `text`, as { n, word }.
function statedCounts(text, words) {
  const re = new RegExp("\\b(\\d+) (" + words.join("|") + ")\\b", "g");
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push({ n: Number(m[1]), word: m[2] });
  return out;
}

function expectedFor(word, c) {
  return { agents: c.agents, skills: c.skills, "user-invocable": c.invocable, internal: c.internal }[word];
}

test("the agents/ and skills/ directories are non-empty and the subtotals add up", () => {
  // [Scenario: Stated counts match the directories | spec-skills-manifests-docs.md "Agent and skill counts agree in eight files" | NFR-020 | UR-045 | BR-016 | FR-130]
  // Boundary: the reference counts come from the repository; they must be positive and consistent.
  const c = counts();
  assert.ok(c.agents > 0, "no agents/*.md files");
  assert.ok(c.skills > 0, "no skills/*/SKILL.md files");
  assert.strictEqual(c.invocable + c.internal, c.skills);
});

[
  { rel: ".claude-plugin/marketplace.json", field: "description" },
  { rel: "plugins/assist-plugin/.claude-plugin/plugin.json", field: "description" },
].forEach(function (f) {
  test(f.rel + " states the agent and skill counts that the directories hold", () => {
    // [Scenario: Stated counts match the directories | spec-skills-manifests-docs.md "Agent and skill counts agree in eight files" | NFR-020 | UR-045 | BR-016 | FR-130]
    // Valid: the description of the manifest carries '<n> agents' and '<n> skills'.
    const json = JSON.parse(read(repoPath(f.rel)));
    const text = f.rel.indexOf("marketplace.json") !== -1 ? marketplacePluginEntry().description : json.description;
    const c = counts();
    const stated = statedCounts(String(text), ["agents", "skills"]);
    const agents = stated.filter(function (s) { return s.word === "agents"; });
    const skills = stated.filter(function (s) { return s.word === "skills"; });
    assert.ok(agents.length >= 1, f.rel + " description states no agent count");
    assert.ok(skills.length >= 1, f.rel + " description states no skill count");
    agents.forEach(function (s) { assert.strictEqual(s.n, c.agents, f.rel + " states " + s.n + " agents; agents/ holds " + c.agents); });
    skills.forEach(function (s) { assert.strictEqual(s.n, c.skills, f.rel + " states " + s.n + " skills; skills/ holds " + c.skills); });
  });
});

[
  "CLAUDE.md",
  "plugins/assist-plugin/Claude.md",
  "plugins/assist-plugin/skills/do/references/agent-registry.md",
].forEach(function (rel) {
  test(rel + ": the 'Agents (N)' heading equals the number of agents/*.md files", () => {
    // [Scenario: Stated counts match the directories | spec-skills-manifests-docs.md "Agent and skill counts agree in eight files" | NFR-020 | UR-045 | BR-016 | FR-065]
    // Valid: the table heading states the count. agent-registry.md reads "All Agents (N)", so an
    // optional "All " prefix is accepted.
    const m = /^#{1,6}\s+(?:All )?Agents \((\d+)\)/m.exec(read(repoPath(rel)));
    assert.ok(m, rel + " has no 'Agents (N)' heading");
    assert.strictEqual(Number(m[1]), counts().agents);
  });
});

["CLAUDE.md", "plugins/assist-plugin/Claude.md"].forEach(function (rel) {
  test(rel + ": the 'Skills (N)' heading equals the number of skills/*/SKILL.md files", () => {
    // [Scenario: Stated counts match the directories | spec-skills-manifests-docs.md "Agent and skill counts agree in eight files" | NFR-020 | UR-045 | BR-016 | FR-130]
    // Valid: the table heading states the skill total.
    const m = /^#{1,6}\s+Skills \((\d+)\)/m.exec(read(repoPath(rel)));
    assert.ok(m, rel + " has no 'Skills (N)' heading");
    assert.strictEqual(Number(m[1]), counts().skills);
  });
});

test("CLAUDE.md: the 'User-invocable (N)' and 'Internal (N)' headings equal the file counts", () => {
  // [Scenario: Stated counts match the directories | spec-skills-manifests-docs.md "Agent and skill counts agree in eight files" | NFR-020 | UR-045 | BR-016 | FR-130]
  // Valid: the subtotals match the skill files with and without user-invocable: false.
  const text = read(repoPath("CLAUDE.md"));
  const c = counts();
  const inv = /^#{1,6}\s+User-invocable \((\d+)\)/m.exec(text);
  const intl = /^#{1,6}\s+Internal \((\d+)\)/m.exec(text);
  assert.ok(inv, "CLAUDE.md has no 'User-invocable (N)' heading");
  assert.ok(intl, "CLAUDE.md has no 'Internal (N)' heading");
  assert.strictEqual(Number(inv[1]), c.invocable);
  assert.strictEqual(Number(intl[1]), c.internal);
});

["MARKETPLACE.md", "README.md"].forEach(function (rel) {
  test(rel + ": every '<n> skills', '<n> user-invocable', '<n> internal', and '<n> agents' statement matches the directories", () => {
    // [Scenario: Stated counts match the directories | spec-skills-manifests-docs.md "Agent and skill counts agree in eight files" | NFR-020 | UR-045 | BR-016 | FR-130]
    // Valid: each stated count equals its reference count.
    const c = counts();
    const stated = statedCounts(read(repoPath(rel)), ["agents", "skills", "user-invocable", "internal"]);
    assert.ok(stated.length >= 1, rel + " states no agent or skill count");
    stated.forEach(function (s) {
      assert.strictEqual(s.n, expectedFor(s.word, c), rel + " states '" + s.n + " " + s.word + "'; the directories give " + expectedFor(s.word, c));
    });
  });
});
