// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the CLAUDE.md release checklist (item 1, task plan Step 14).
//
// Sources: specs/spec-skills-manifests-docs.md (Change Log 2026-11-20: the MODIFIED requirements "Manifest
// versions agree at release" and "Release checklist names every file that carries the version"),
// specs/spec-release-check.md (Requirements 4 and 5), and the task plan acceptance row "Sixth file in the
// checklist" in docs/task-plans/task-plan-assist-pi-backport-20261120-0314.md (Step 12 and Step 14).
//
// Traceability format: [spec-skills-manifests-docs "<requirement>" | FR-ids | UR-ids]. The specs carry no
// SPEC-NNN id, so the spec file name and the requirement title stand in for it (the convention of the task plan).
//
// Contract used: CLAUDE.md holds one line that starts "When releasing, update the version in". After the
// change that line names six version places: the two manifests, the CLAUDE.md Plugin line, the README.md
// heading, the MARKETPLACE.md heading and Versioning sentence, and the newest version heading of the root
// CHANGELOG.md. The five existing items keep their exact wording, because
// tests/docs/contracts-docs-1-12-0.test.js matches those strings.
//
// Run: node --test tests/docs/claude-md-release-checklist.test.js tests/docs/contracts-docs-1-12-0.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const CLAUDE_MD = path.join(REPO, "CLAUDE.md");
const LINE_START = "When releasing, update the version in";

// The five items that existed before the change, exactly as written in the checklist.
const FIVE_EXISTING = [
  "`plugins/assist-plugin/.claude-plugin/plugin.json`",
  "`.claude-plugin/marketplace.json`",
  "`CLAUDE.md` (the Plugin line)",
  "`README.md` (the `### assist-plugin v` heading)",
  "`MARKETPLACE.md` (the heading and the Versioning sentence)",
];

function releaseLines() {
  return fs
    .readFileSync(CLAUDE_MD, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.indexOf(LINE_START) === 0);
}

function releaseLine() {
  const lines = releaseLines();
  assert.strictEqual(lines.length, 1, "expected exactly one line that starts '" + LINE_START + "', found " + lines.length);
  return lines[0];
}

// [spec-skills-manifests-docs "Release checklist names every file that carries the version" | FR-194 | FR-173 | UR-046]
// Valid input: the line exists exactly once in CLAUDE.md.
test("releaseChecklist_lineStartingWhenReleasing_existsOnce", () => {
  assert.strictEqual(releaseLines().length, 1);
});

// [spec-skills-manifests-docs "Release checklist names every file that carries the version" | FR-194 | FR-173 | UR-046]
// Valid input: each of the five existing items is still named, exactly as before the change.
FIVE_EXISTING.forEach((item) => {
  test("releaseChecklist_stillNamesExistingItem_" + item.replace(/[^A-Za-z0-9]+/g, "_"), () => {
    assert.ok(releaseLine().indexOf(item) !== -1, "the release line no longer names " + item);
  });
});

// [spec-skills-manifests-docs "Release checklist names every file that carries the version" | FR-194 | FR-173 | UR-046]
// Valid input: the sixth place, the root CHANGELOG.md newest version heading, is named.
test("releaseChecklist_namesRootChangelog", () => {
  assert.match(releaseLine(), /root\s+`?CHANGELOG\.md/, "the release line does not name the root CHANGELOG.md");
});

// [spec-skills-manifests-docs "Manifest versions agree at release" | FR-194 | FR-173 | UR-046]
// Valid input: the CHANGELOG.md item says the newest heading is what carries the version, not the whole file.
test("releaseChecklist_changelogItemNamesTheNewestHeading", () => {
  const line = releaseLine();
  const at = line.indexOf("CHANGELOG.md");
  assert.ok(at !== -1, "CHANGELOG.md is not named");
  const tail = line.slice(at);
  assert.match(tail, /newest/i, "the CHANGELOG.md item does not say 'newest'");
  assert.match(tail, /heading/i, "the CHANGELOG.md item does not say 'heading'");
});

// [spec-skills-manifests-docs "Release checklist names every file that carries the version" | FR-194 | FR-173 | UR-046]
// Boundary: six places in all. Each of the six file names appears, and CHANGELOG.md appears once (one item,
// not a duplicate).
test("releaseChecklist_namesSixDistinctPlaces", () => {
  const line = releaseLine();
  const places = [
    "plugins/assist-plugin/.claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "`CLAUDE.md`",
    "`README.md`",
    "`MARKETPLACE.md`",
    "`CHANGELOG.md`",
  ];
  places.forEach((p) => assert.ok(line.indexOf(p) !== -1, "the release line does not name " + p));
  assert.strictEqual(line.split("CHANGELOG.md").length - 1, 1, "CHANGELOG.md should be named exactly once");
});

// [spec-skills-manifests-docs "Release checklist names every file that carries the version" | FR-194 | FR-173 | UR-046]
// Boundary: the five existing items keep their relative order, so the new item is added and none is reordered
// or removed.
test("releaseChecklist_existingItemsKeepTheirOrder", () => {
  const line = releaseLine();
  const positions = FIVE_EXISTING.map((item) => line.indexOf(item));
  positions.forEach((p, i) => assert.ok(p !== -1, "missing " + FIVE_EXISTING[i]));
  for (let i = 1; i < positions.length; i += 1) {
    assert.ok(positions[i - 1] < positions[i], FIVE_EXISTING[i - 1] + " must come before " + FIVE_EXISTING[i]);
  }
});

// [spec-skills-manifests-docs "Release checklist names every file that carries the version" | FR-194 | FR-173 | UR-046]
// Boundary: the line is one Markdown line, and the new item sits on it (not on a separate line below it).
test("releaseChecklist_changelogItemIsOnTheSameLineAsTheFiveExistingItems", () => {
  const line = releaseLine();
  assert.ok(line.indexOf("CHANGELOG.md") !== -1 && line.indexOf("MARKETPLACE.md") !== -1);
});

// [spec-skills-manifests-docs "Release checklist names every file that carries the version" | FR-194 | UR-046]
// Security-adjacent (prose gate): the line holds no em dash and no curly quote, which the prose gate denies.
test("releaseChecklist_lineHoldsNoEmDashOrCurlyQuote", () => {
  const line = releaseLine();
  assert.ok(line.indexOf("—") === -1, "the release line holds an em dash");
  assert.ok(!/[‘’“”]/.test(line), "the release line holds a curly quote");
});

// [spec-skills-manifests-docs "Release checklist names every file that carries the version" | FR-194 | UR-046]
// Boundary: the edit is limited to the version-file line. The "Keeping counts in sync" heading and the
// checklist line that runs the writing-standard sync are still present.
test("claudeMd_keepingCountsInSyncSection_isStillPresent", () => {
  const text = fs.readFileSync(CLAUDE_MD, "utf8");
  assert.ok(text.indexOf("## Keeping counts in sync") !== -1);
  assert.ok(text.indexOf("sync-writing-standard.js --check") !== -1);
});
