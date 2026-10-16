// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box tests for FR-178: plugins/assist-plugin/CHANGELOG.md is a short pointer to the
// root CHANGELOG.md, the only release log.
//
// Sources: specs/spec-skills-manifests-docs.md (Requirement: Plugin changelog is a pointer)
// and docs/requirements/FR-NFR-assist-plugin.md (FR-178, UR-052, BR-017).
//
// Traceability format: [Scenario title | spec section | FR ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// Per the task plan (step 6) the release-heading assertion reads the version from
// plugins/assist-plugin/.claude-plugin/plugin.json and never pins 1.11.1.
//
// Run: node --test tests/docs/plugin-changelog.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const ROOT_CHANGELOG = path.join(REPO, "CHANGELOG.md");
const PLUGIN_CHANGELOG = path.join(REPO, "plugins", "assist-plugin", "CHANGELOG.md");
const PLUGIN_JSON = path.join(REPO, "plugins", "assist-plugin", ".claude-plugin", "plugin.json");

const RELEASE_HEADING = /^## \[\d+\.\d+\.\d+\]/m;
const SEMVER_HEADING = /^## \[(\d+\.\d+\.\d+)\]/m;

function read(file) {
  return fs.readFileSync(file, "utf8");
}

// Link targets in the text: inline `[text](target)` and reference definitions `[id]: target`.
// An anchor (`#...`) or a title after the target is dropped.
function linkTargets(text) {
  const targets = [];
  const inline = /\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
  let m;
  while ((m = inline.exec(text)) !== null) targets.push(m[1]);
  const ref = /^\s{0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s+.*)?$/gm;
  while ((m = ref.exec(text)) !== null) targets.push(m[1]);
  return targets.map((t) => decodeURI(t.split("#")[0])).filter((t) => t !== "");
}

// ---------------------------------------------------------------------------
// Scenario: Pointer only
// ---------------------------------------------------------------------------

test("plugin changelog links to the root CHANGELOG.md", () => {
  // [Scenario: Pointer only | spec-skills-manifests-docs.md "Plugin changelog is a pointer" | FR-178 | UR-052 | BR-017]
  const text = read(PLUGIN_CHANGELOG);
  const resolved = linkTargets(text).map((t) => path.resolve(path.dirname(PLUGIN_CHANGELOG), t));
  assert.ok(
    resolved.indexOf(ROOT_CHANGELOG) !== -1,
    "no link in plugins/assist-plugin/CHANGELOG.md resolves to the root CHANGELOG.md; link targets: " +
      JSON.stringify(linkTargets(text))
  );
});

test("plugin changelog holds no '## [x.y.z]' release heading", () => {
  // [Scenario: Pointer only | spec-skills-manifests-docs.md "Plugin changelog is a pointer" | FR-178 | UR-052 | BR-017]
  const text = read(PLUGIN_CHANGELOG);
  assert.doesNotMatch(text, RELEASE_HEADING);
});

test("plugin changelog holds no release heading of any level or bracket-less form", () => {
  // [Scenario: Pointer only | spec-skills-manifests-docs.md "Plugin changelog is a pointer" | FR-178 | UR-052 | BR-017]
  // Boundary: a release entry could be written as '### [1.2.3]' or '## 1.2.3 - date'.
  const text = read(PLUGIN_CHANGELOG);
  assert.doesNotMatch(text, /^#{1,6}\s*\[?v?\d+\.\d+\.\d+/m);
});

test("plugin changelog is a short, non-empty pointer", () => {
  // [Scenario: Pointer only | spec-skills-manifests-docs.md "Plugin changelog is a pointer" | FR-178 | UR-052 | BR-017]
  // Boundary: the requirement says 'short pointer'; 40 non-blank lines is a generous upper bound.
  const text = read(PLUGIN_CHANGELOG);
  const nonBlank = text.split("\n").filter((l) => l.trim() !== "");
  assert.ok(nonBlank.length >= 1, "the pointer file is empty");
  assert.ok(nonBlank.length <= 40, "the pointer file has " + nonBlank.length + " non-blank lines; expected a short pointer");
});

// ---------------------------------------------------------------------------
// Scenario: New release
// ---------------------------------------------------------------------------

test("the newest release heading of the root CHANGELOG.md equals the plugin.json version", () => {
  // [Scenario: New release | spec-skills-manifests-docs.md "Plugin changelog is a pointer" | FR-178 | UR-052 | BR-017]
  const version = JSON.parse(read(PLUGIN_JSON)).version;
  assert.match(String(version), /^\d+\.\d+\.\d+$/, "plugin.json version is not x.y.z");
  const m = SEMVER_HEADING.exec(read(ROOT_CHANGELOG));
  assert.ok(m, "the root CHANGELOG.md has no '## [x.y.z]' heading");
  assert.strictEqual(m[1], version, "newest root CHANGELOG.md heading is " + m[1] + ", plugin.json says " + version);
});

test("the root CHANGELOG.md release headings carry a date after the version", () => {
  // [Scenario: New release | spec-skills-manifests-docs.md "Output / Outcome" (## [X.Y.Z] - YYYY-MM-DD) | FR-178]
  const m = /^## \[\d+\.\d+\.\d+\] - (\d{4}-\d{2}-\d{2})\s*$/m.exec(read(ROOT_CHANGELOG));
  assert.ok(m, "the first '## [x.y.z]' heading has no ' - YYYY-MM-DD' date");
});

test("the root CHANGELOG.md keeps the 1.1.0, 1.2.0, and 1.3.0 entries that left the plugin file", () => {
  // [Scenario: Release entry in the plugin file | spec-skills-manifests-docs.md "Plugin changelog is a pointer" | FR-178 | UR-052 | BR-017]
  // Plan step 5: the removed plugin entries lose no history while the root file holds them.
  const root = read(ROOT_CHANGELOG);
  ["1.1.0", "1.2.0", "1.3.0"].forEach((v) => {
    assert.ok(root.indexOf("## [" + v + "]") !== -1, "root CHANGELOG.md lacks the entry for " + v);
  });
});

// ---------------------------------------------------------------------------
// Scenario: Release entry in the plugin file (regression guard)
// ---------------------------------------------------------------------------

test("the plugin changelog never carries an entry for the current plugin.json version", () => {
  // [Scenario: Release entry in the plugin file | spec-skills-manifests-docs.md "Plugin changelog is a pointer" | FR-178 | UR-052 | BR-017]
  // Regression guard: a release entry written into the plugin file must move to the root file.
  const version = JSON.parse(read(PLUGIN_JSON)).version;
  const text = read(PLUGIN_CHANGELOG);
  const escaped = String(version).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.doesNotMatch(text, new RegExp("^#{1,6}.*\\b" + escaped + "\\b", "m"));
});
