// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box tests for the self-hosted repository layout and the documentation wording of 1.13.1
// (task plan steps 29 of 1.11.1 and 13 of 1.13.1).
//
//   FR-174  requirements in docs/requirements/, task plans in docs/task-plans/, specs under specs/
//   FR-178  version agreement between the manifests and the newest root CHANGELOG heading
//   FR-104  the prose hooks exempt only the system temp directory and allowlisted paths
//   FR-213  files under docs/tts/ are judged like other prose, with fenced blocks exempt
//   FR-211  a saved voice script holds no em dash (the skill side of the same rule)
//   FR-166  the /health overview names the temp-directory and allowlist exemptions
//   NFR-020 agent and skill counts agree between the documents and the directories
//
// FR-181 (the docs/tts/ project-root and session-directory exemption, built in 1.11.1) is retired
// in 1.13.1, and no assertion here depends on it.
//
// Sources: specs/spec-skills-manifests-docs.md (Requirement: Self-hosted requirements, specs, and
// plans; Requirement: Manifest versions agree at release; Requirement: Agent and skill counts agree
// in eight files), specs/spec-skills.md (Change Log 2026-10-23: Requirement: Documents describe
// voice scripts as gated prose, rules 1 to 5 and F1 to F5, with its six scenarios),
// specs/spec-skills-health.md (Change Log 2026-10-23: Requirement: Short summary with a fix per
// finding, Scenario: Overview names no docs/tts skip), and docs/requirements/FR-NFR-assist-plugin.md.
// Upstream ids: UR-058 (voice scripts without em dashes), UR-016, BR-008.
//
// Traceability format: [Scenario | spec section | requirement ids | upstream ids]. The specs use
// named requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// The tests assert the specified end state. The version is read from plugin.json and never pinned.
// The counts are read from the agents/ and skills/ directories and never pinned. This file holds
// none of the banned characters; the one regex that needs a curly apostrophe spells it as an escape.
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
// FR-104, FR-213, FR-211: documents describe voice scripts as gated prose
// (spec-skills.md Change Log 2026-10-23, Requirement: Documents describe voice scripts as gated prose)
// ---------------------------------------------------------------------------

// Rule 1. A sentence ends at a line break, and at . ! or ? followed by white space and a capital
// letter, a backtick, a star, an opening parenthesis, or an opening bracket.
function sentencesOf(text) {
  const units = [];
  text.replace(/\r\n/g, "\n").split("\n").forEach(function (line) {
    line.split(/(?<=[.!?])\s+(?=[A-Z`*(\[])/).forEach(function (s) {
      units.push(s);
    });
  });
  return units;
}

// Every match below is without regard to case.
const PROJECT_ROOT_RE = /project root/i;
// "the session's working directory" (straight or curly apostrophe), "session working directory",
// or "session directory". The curly apostrophe is the regex escape of U+2019 (a double backslash
// in the string, so the source holds no curly quote).
const SESSION_DIR_RE = new RegExp("session(?:'|\\u2019)s working directory|session working directory|session directory", "i");

function namesTts(s) {
  return s.toLowerCase().indexOf("docs/tts/") !== -1;
}

// The forbidden-sentence rules. F4 applies to the five hook-description files only; F5 is the
// voice-script skill's rule, and the plan's STALE-WORDING check applies it to all six files.
const RULES = {
  F1: function (s) {
    return namesTts(s) && /skip/i.test(s);
  },
  F2: function (s) {
    return namesTts(s) && /exempt/i.test(s) && !/fenced/i.test(s);
  },
  F3: function (s) {
    return /may use em dashes|may hold em dashes/i.test(s);
  },
  F4: function (s) {
    return namesTts(s) && (PROJECT_ROOT_RE.test(s) || SESSION_DIR_RE.test(s));
  },
  F5: function (s) {
    return /prose-hook exemption/i.test(s);
  },
};

const HOOK_RULES = ["F1", "F2", "F3", "F4", "F5"];
const VOICE_RULES = ["F1", "F2", "F3", "F5"]; // F4 does not apply to skills/voice-script/SKILL.md

function metRules(s, ruleNames) {
  return ruleNames.filter(function (name) {
    return RULES[name](s);
  });
}

// Rule 2. A required sentence holds docs/tts/, "like other prose", and "fenced", and is no forbidden sentence.
function isRequired(s, ruleNames) {
  return namesTts(s) && /like other prose/i.test(s) && /fenced/i.test(s) && metRules(s, ruleNames).length === 0;
}

// The result of the rules over one document text.
function judge(text, ruleNames) {
  const forbidden = [];
  let required = 0;
  sentencesOf(text).forEach(function (s) {
    const met = metRules(s, ruleNames);
    if (met.length > 0) forbidden.push({ rules: met, sentence: s });
    else if (isRequired(s, ruleNames)) required += 1;
  });
  return { forbidden: forbidden, required: required };
}

function describeForbidden(list) {
  return JSON.stringify(
    list.map(function (f) {
      return f.rules.join("+") + ": " + f.sentence.slice(0, 200);
    })
  );
}

const HOOK_DESCRIPTION_FILES = [
  "CLAUDE.md",
  "plugins/assist-plugin/Claude.md",
  "README.md",
  "plugins/assist-plugin/skills/health/SKILL.md",
  "plugins/assist-plugin/docs/SPECIFICATION.md",
];

const VOICE_SKILL = "plugins/assist-plugin/skills/voice-script/SKILL.md";
const REQUIRED_SENTENCE = "Files under `docs/tts/` are judged like other prose, with fenced blocks exempt.";

HOOK_DESCRIPTION_FILES.forEach(function (rel) {
  test(rel + ": the phrase 'not the git root' is gone", () => {
    // [Scenario: Hook descriptions name no docs/tts skip (rule 5) | spec-skills.md Change Log 2026-10-23, Requirement: Documents describe voice scripts as gated prose | FR-104 | FR-213 | UR-058 | BR-008]
    // Invalid (stale wording): the 1.13.0 text said the hooks use the hook's working directory, not the git root.
    assert.doesNotMatch(read(repoPath(rel)), /not the git root/i);
  });

  test(rel + ": no sentence meets F1, F2, F3, F4, or F5", () => {
    // [Scenario: Hook descriptions name no docs/tts skip | spec-skills.md Change Log 2026-10-23, Requirement: Documents describe voice scripts as gated prose | FR-104 | FR-213 | UR-058 | BR-008]
    // Invalid (stale wording): a sentence that names docs/tts/ with "skip", an "exempt" without "fenced",
    // the 1.13.0 em-dash phrases, or a project-root or session-directory phrase.
    const result = judge(read(repoPath(rel)), HOOK_RULES);
    assert.deepStrictEqual(result.forbidden, [], rel + " holds a forbidden sentence: " + describeForbidden(result.forbidden));
  });

  test(rel + ": at least one required sentence (docs/tts/, 'like other prose', 'fenced') stands as its own sentence", () => {
    // [Scenario: Hook descriptions name no docs/tts skip (required sentence) | spec-skills.md Change Log 2026-10-23, Requirement: Documents describe voice scripts as gated prose | FR-104 | FR-213 | UR-058 | BR-008]
    // Null case: deleting the description would pass the "no forbidden sentence" test, so require the sentence.
    const result = judge(read(repoPath(rel)), HOOK_RULES);
    assert.ok(
      result.required >= 1,
      rel + ": no required sentence; sentences that name docs/tts/: " +
        JSON.stringify(
          sentencesOf(read(repoPath(rel)))
            .filter(namesTts)
            .map(function (s) { return s.slice(0, 160); })
        )
    );
  });
});

test("skills/health/SKILL.md: the overview names the temp-directory and allowlist exemptions in a sentence without docs/tts/", () => {
  // [Scenario: Overview names no docs/tts skip (first half) | spec-skills-health.md Change Log 2026-10-23, Requirement: Short summary with a fix per finding | FR-166 | FR-104 | FR-213 | UR-018]
  // Valid (end state): one sentence holds "system temp directory" and "prose-gate-allowlist.json" and no docs/tts/.
  const text = read(repoPath("plugins/assist-plugin/skills/health/SKILL.md"));
  const hits = sentencesOf(text).filter(function (s) {
    return /system temp directory/i.test(s) && /prose-gate-allowlist\.json/i.test(s) && !namesTts(s);
  });
  assert.ok(hits.length >= 1, "no sentence names the system temp directory and prose-gate-allowlist.json without docs/tts/");
});

test("skills/health/SKILL.md: the required docs/tts/ sentence is its own sentence, apart from the temp-directory sentence", () => {
  // [Scenario: Overview names no docs/tts skip (second half) | spec-skills-health.md Change Log 2026-10-23, Requirement: Short summary with a fix per finding | FR-166 | FR-104 | FR-213 | UR-018]
  const text = read(repoPath("plugins/assist-plugin/skills/health/SKILL.md"));
  const required = sentencesOf(text).filter(function (s) {
    return isRequired(s, HOOK_RULES);
  });
  assert.ok(required.length >= 1, "no required sentence in skills/health/SKILL.md");
  required.forEach(function (s) {
    assert.ok(!/system temp directory/i.test(s) && !/allowlist/i.test(s), "the required sentence is joined to the temp-directory or allowlist clause: " + s.slice(0, 200));
  });
});

test("skills/voice-script/SKILL.md: no sentence meets F1, F2, F3, or F5", () => {
  // [Scenario: Voice-script save sentence stays | spec-skills.md Change Log 2026-10-23, Requirement: Documents describe voice scripts as gated prose | FR-104 | FR-213 | FR-211 | UR-058 | BR-008]
  // Invalid (stale wording): the 1.13.0 Pauses rule, the writing-standard sentence, and the prose-hook exemption sentence.
  const result = judge(read(path.join(REPO, VOICE_SKILL)), VOICE_RULES);
  assert.deepStrictEqual(result.forbidden, [], VOICE_SKILL + " holds a forbidden sentence: " + describeForbidden(result.forbidden));
});

test("skills/voice-script/SKILL.md: the save-path sentence is present and passes, because F4 does not apply", () => {
  // [Scenario: Voice-script save sentence stays | spec-skills.md Change Log 2026-10-23, Requirement: Documents describe voice scripts as gated prose | FR-163 | FR-213 | UR-058 | BR-008]
  // Valid (end state): the sentence W7 names. It holds docs/tts/ and the session's working directory.
  const w7 = "Path: `docs/tts/voice-<slug>-<stamp>.md` under the session's working directory";
  const hits = sentencesOf(read(path.join(REPO, VOICE_SKILL))).filter(function (s) {
    return s.toLowerCase().indexOf(w7.toLowerCase()) !== -1;
  });
  assert.ok(hits.length >= 1, "the save-path sentence is missing from " + VOICE_SKILL);
  hits.forEach(function (s) {
    assert.deepStrictEqual(metRules(s, VOICE_RULES), [], "the save-path sentence meets a forbidden rule: " + s.slice(0, 200));
  });
});

// ---------------------------------------------------------------------------
// The scenarios of the requirement, as pure string fixtures of the sentence rules
// ---------------------------------------------------------------------------

test("fixture, Fenced exemption sentence passes: the required sentence counts and does not meet F2", () => {
  // [Scenario: Fenced exemption sentence passes | spec-skills.md Change Log 2026-10-23, Requirement: Documents describe voice scripts as gated prose | FR-104 | FR-213 | UR-058 | BR-008]
  const result = judge(REQUIRED_SENTENCE, HOOK_RULES);
  assert.strictEqual(result.required, 1);
  assert.deepStrictEqual(result.forbidden, []);
  assert.ok(!RULES.F2(REQUIRED_SENTENCE), "the sentence holds 'fenced', so F2 does not apply");
});

test("fixture, Required wording joined to the skip clause: the sentence meets F1 and no required sentence is left", () => {
  // [Scenario: Required wording joined to the skip clause | spec-skills.md Change Log 2026-10-23, Requirement: Documents describe voice scripts as gated prose | FR-104 | FR-213 | UR-058 | BR-008]
  const joined =
    "Both per-write hooks skip files under the system temp directory, and files under `docs/tts/` are judged like other prose, with fenced blocks exempt.";
  const result = judge(joined, HOOK_RULES);
  assert.ok(RULES.F1(joined), "the joined sentence meets F1");
  assert.strictEqual(result.forbidden.length, 1);
  assert.strictEqual(result.required, 0, "a forbidden sentence never counts as required");
});

test("fixture, Stale two-root sentence: the sentence meets F1, F3, and F4, with a straight or a curly apostrophe", () => {
  // [Scenario: Stale two-root sentence | spec-skills.md Change Log 2026-10-23, Requirement: Documents describe voice scripts as gated prose | FR-104 | FR-213 | UR-058 | BR-008]
  // Boundary: both apostrophe forms of "session's working directory" are caught by F4.
  [String.fromCharCode(39), String.fromCharCode(0x2019)].forEach(function (apostrophe) {
    const stale =
      "Both per-write hooks skip files under the system temp directory, files under `docs/tts/` in the project root and in the session" +
      apostrophe +
      "s working directory when that directory is inside the project (voice scripts may use em dashes as pause marks), and paths listed in `prose-gate-allowlist.json`.";
    const met = metRules(stale, HOOK_RULES);
    ["F1", "F3", "F4"].forEach(function (name) {
      assert.ok(met.indexOf(name) !== -1, "the stale sentence should meet " + name + " (apostrophe code " + apostrophe.charCodeAt(0) + ")");
    });
    assert.strictEqual(judge(stale, HOOK_RULES).required, 0);
  });
});

test("fixture, the session-directory phrase alone meets F4 with either apostrophe", () => {
  // [Scenario: Stale two-root sentence (F4 phrases) | spec-skills.md Change Log 2026-10-23, Requirement: Documents describe voice scripts as gated prose | FR-104 | FR-213 | UR-058]
  [String.fromCharCode(39), String.fromCharCode(0x2019)].forEach(function (apostrophe) {
    const s = "Files under `docs/tts/` in the session" + apostrophe + "s working directory are judged like other prose, with fenced blocks exempt.";
    assert.ok(RULES.F4(s), "F4 should match the session phrase with apostrophe code " + apostrophe.charCodeAt(0));
  });
  assert.ok(RULES.F4("Files under `docs/tts/` in the session working directory."));
  assert.ok(RULES.F4("Files under `docs/tts/` in the Session Directory."));
  assert.ok(!RULES.F4("Files in the session directory."), "F4 needs docs/tts/ in the sentence");
});

test("fixture, Stale Pauses rule: the 1.13.0 sentence meets F3, with and without docs/tts/", () => {
  // [Scenario: Stale Pauses rule | spec-skills.md Change Log 2026-10-23, Requirement: Documents describe voice scripts as gated prose | FR-211 | FR-213 | UR-058 | BR-008]
  const stalePauses = "The script text may use em dashes, ellipses, and line breaks as pause marks.";
  const staleNotes = "The script text may hold em dashes, ellipses, and line breaks as pause marks.";
  assert.deepStrictEqual(metRules(stalePauses, VOICE_RULES), ["F3"]);
  assert.deepStrictEqual(metRules(staleNotes, VOICE_RULES), ["F3"]);
  // Case-insensitive: the match ignores case.
  assert.ok(RULES.F3("It MAY USE EM DASHES here."));
});

test("fixture, Voice-script save sentence stays: it names docs/tts/ and the session's working directory and passes F1, F2, F3, and F5", () => {
  // [Scenario: Voice-script save sentence stays | spec-skills.md Change Log 2026-10-23, Requirement: Documents describe voice scripts as gated prose | FR-163 | FR-213 | UR-058 | BR-008]
  const save =
    "Path: `docs/tts/voice-<slug>-<stamp>.md` under the session's working directory (the primary working directory, not the git root).";
  assert.deepStrictEqual(metRules(save, VOICE_RULES), []);
  // F4 would catch the same sentence in a hook-description file, which is why it does not apply to this one.
  assert.deepStrictEqual(metRules(save, HOOK_RULES), ["F4"]);
});

test("fixture, the prose-hook exemption sentence meets F5 and the new fenced wording passes F2", () => {
  // [Scenario: Voice-script save sentence stays (F5 and F2) | spec-skills.md Change Log 2026-10-23, Requirement: Documents describe voice scripts as gated prose | FR-104 | FR-213 | UR-058]
  assert.deepStrictEqual(metRules("The prose-hook exemption covers this folder.", VOICE_RULES), ["F5"]);
  const hooks = "The prose hooks judge this file like other prose, with the fenced script blocks exempt.";
  assert.deepStrictEqual(metRules(hooks, VOICE_RULES), []);
  // F2 without "fenced" is forbidden when the sentence names docs/tts/.
  assert.deepStrictEqual(metRules("Files under `docs/tts/` are exempt.", VOICE_RULES), ["F2"]);
});

test("fixture, rule 1 sentence splitting: a line break ends a sentence, and so does a period before a capital letter", () => {
  // [Requirement: Documents describe voice scripts as gated prose, rule 1 | spec-skills.md Change Log 2026-10-23 | FR-104 | FR-213]
  assert.strictEqual(sentencesOf("One sentence.\nTwo sentence.").length, 2);
  assert.strictEqual(sentencesOf("First. Second.").length, 2);
  assert.strictEqual(sentencesOf("First. `Code` second.").length, 2);
  assert.strictEqual(sentencesOf("See `docs/tts/voice-x.md` here.").length, 1, "a period inside a file name does not end a sentence");
  assert.strictEqual(sentencesOf("a few words. lowercase continues.").length, 1, "a lowercase letter after the period does not end a sentence");
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
