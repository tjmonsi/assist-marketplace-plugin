// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the six-place version-agreement section of the release-check runner
// (item 1, task plan Step 13): plugins/assist-plugin/scripts/release/version-agreement.js, and its wiring behind
// the --release flag of plugins/assist-plugin/scripts/release-check.js.
//
// Sources: specs/spec-release-check.md (Requirements 4 and 5) and the interface contract in
// docs/task-plans/task-plan-assist-pi-backport-20261120-0314.md, Step 9 and Step 10.
//
// Traceability format: [spec-release-check Rn -> FR-ids | Scenario title]. The spec carries no SPEC-NNN id,
// so the spec file name and its Requirement number stand in for it (the convention of the task plan).
//
// Contract used (task plan Step 9):
//   check(root, options) returns {outcome, details}
//     outcome  "clean", "finding", or "error"
//     details  one line per disagreeing place, each naming the file
//   six places under root:
//     plugins/assist-plugin/.claude-plugin/plugin.json   "version" (the reference version)
//     .claude-plugin/marketplace.json                    "version" of the plugins entry named "assist-plugin"
//     CLAUDE.md                                          the "- **Plugin:** ... (vX.Y.Z)" line
//     README.md                                          the "### assist-plugin vX.Y.Z" heading
//     MARKETPLACE.md                                     the same heading and the "Version X.Y.Z is available" sentence
//     CHANGELOG.md                                       the newest "## [X.Y.Z]" heading (first in file order;
//                                                        "## [Unreleased]" is not a versioned heading)
//   a missing or unparseable file among the first five places is an operational error ("error"), not a finding
//   options.release (set by --release):
//     off  the CHANGELOG.md heading is never a finding (absent, older, newer, or equal); a missing file is absent
//     on   a finding that names CHANGELOG.md when the newest heading is absent or differs from the manifest version
//
// Run: node --test tests/scripts/release-check-version.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const RUNNER = path.join(REPO, "plugins", "assist-plugin", "scripts", "release-check.js");
const SECTION = path.join(REPO, "plugins", "assist-plugin", "scripts", "release", "version-agreement.js");

const scratch = [];

after(() => {
  scratch.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function mkdtemp(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  scratch.push(dir);
  return dir;
}

function put(root, rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

// Writes the six places. Every version defaults to `base`; `over` replaces one or more.
//   plugin, marketplace, claude, readme, marketHeading, marketSentence   version strings
//   changelog   null for no CHANGELOG.md file, otherwise the full file text
//   skip        list of file keys to leave out
function build(over) {
  const o = Object.assign(
    {
      base: "1.14.4",
      plugin: null,
      marketplace: null,
      claude: null,
      readme: null,
      marketHeading: null,
      marketSentence: null,
      changelog: undefined,
      skip: [],
    },
    over || {}
  );
  const pick = (k) => (o[k] === null ? o.base : o[k]);
  const root = mkdtemp("release-version-");
  const skip = (k) => o.skip.indexOf(k) !== -1;
  if (!skip("plugin")) {
    put(root, "plugins/assist-plugin/.claude-plugin/plugin.json", JSON.stringify({ name: "assist-plugin", version: pick("plugin") }, null, 2));
  }
  if (!skip("marketplace")) {
    put(
      root,
      ".claude-plugin/marketplace.json",
      JSON.stringify(
        { name: "assist-plugin-marketplace", plugins: [{ name: "assist-plugin", version: pick("marketplace") }] },
        null,
        2
      )
    );
  }
  if (!skip("claude")) {
    put(root, "CLAUDE.md", "# Project\n\n- **Plugin:** `plugins/assist-plugin` (v" + pick("claude") + ")\n");
  }
  if (!skip("readme")) {
    put(root, "README.md", "# Readme\n\n### assist-plugin v" + pick("readme") + "\n\nText.\n");
  }
  if (!skip("marketmd")) {
    put(
      root,
      "MARKETPLACE.md",
      "# Marketplace\n\n### assist-plugin v" +
        pick("marketHeading") +
        "\n\nEach plugin follows semantic versioning. Version " +
        pick("marketSentence") +
        " is available in `plugins/assist-plugin/`.\n"
    );
  }
  if (o.changelog === undefined) {
    put(root, "CHANGELOG.md", changelogOf([o.base]));
  } else if (o.changelog !== null) {
    put(root, "CHANGELOG.md", o.changelog);
  }
  return root;
}

// A CHANGELOG.md whose versioned headings appear newest first, as the repository's file does.
function changelogOf(versions) {
  const headings = versions.map((v) => "## [" + v + "] - 2026-11-19\n\n- change\n").join("\n");
  return "# Changelog\n\nAll notable changes.\n\n" + headings;
}

function detailText(res) {
  return [].concat(res.details || []).join("\n");
}

function loadCheck() {
  const mod = require(SECTION);
  assert.strictEqual(typeof mod.check, "function", "version-agreement.js must export check(root, options)");
  return mod.check;
}

// ---------------------------------------------------------------------------------------------------------
// Requirement 4: six places agree
// ---------------------------------------------------------------------------------------------------------

// [spec-release-check R4 -> FR-251 -> FR-173 -> FR-194 -> UR-046 | Scenario: Six places agree]
// Valid input: all six places read 1.14.4. Clean, with no detail lines naming a disagreeing file.
test("check_sixPlacesAgree_isClean", () => {
  const res = loadCheck()(build(), {});
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R4 -> FR-251 -> UR-046 | Scenario: Six places agree]
// Valid input: with --release, six agreeing places (including the CHANGELOG.md heading) are clean.
test("check_sixPlacesAgree_withRelease_isClean", () => {
  const res = loadCheck()(build(), { release: true });
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R4 -> FR-251 -> UR-046 | Scenario: Six places agree]
// Boundary: the CHANGELOG.md heading is the first versioned heading, so older headings below it do not matter.
test("check_changelogNewestEqualsManifest_olderHeadingsBelow_isCleanWithRelease", () => {
  const root = build({ changelog: changelogOf(["1.14.4", "1.14.3", "1.13.0"]) });
  const res = loadCheck()(root, { release: true });
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R4 -> FR-251 -> UR-046 | Scenario: Six places agree]
// Valid input: a marketplace.json holding another plugin entry first. The entry named assist-plugin decides.
test("check_marketplaceWithOtherEntryFirst_usesTheAssistPluginEntry", () => {
  const root = build();
  put(
    root,
    ".claude-plugin/marketplace.json",
    JSON.stringify({
      name: "assist-plugin-marketplace",
      plugins: [
        { name: "some-other-plugin", version: "0.0.1" },
        { name: "assist-plugin", version: "1.14.4" },
      ],
    })
  );
  const res = loadCheck()(root, {});
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R4 -> FR-251 -> UR-046 | Scenario: Manifest mismatch]
// Valid input: plugin.json and marketplace.json read different versions. A finding that names marketplace.json.
test("check_manifestMismatch_isFindingNamingTheMarketplaceFile", () => {
  const res = loadCheck()(build({ marketplace: "1.14.3" }), {});
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.match(detailText(res), /marketplace\.json/);
});

// [spec-release-check R4 -> FR-251 -> UR-046 | Scenario: Manifest mismatch]
// Valid input: the mismatch runs the other way (plugin.json is the stale one). Still a finding.
test("check_pluginJsonBehindMarketplace_isFinding", () => {
  const res = loadCheck()(build({ plugin: "1.14.3" }), {});
  assert.strictEqual(res.outcome, "finding", detailText(res));
});

// [spec-release-check R4 -> FR-251 -> FR-173 -> UR-046 | RULE-003: README heading that disagrees is a finding]
// Valid input: a stale README.md heading. A finding that names README.md.
test("check_readmeHeadingStale_isFindingNamingReadme", () => {
  const res = loadCheck()(build({ readme: "1.14.3" }), {});
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.match(detailText(res), /README\.md/);
});

// [spec-release-check R4 -> FR-251 -> FR-194 -> UR-046 | RULE-003]
// Valid input: a stale MARKETPLACE.md heading. A finding that names MARKETPLACE.md.
test("check_marketplaceMdHeadingStale_isFindingNamingMarketplaceMd", () => {
  const res = loadCheck()(build({ marketHeading: "1.14.3" }), {});
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.match(detailText(res), /MARKETPLACE\.md/);
});

// [spec-release-check R4 -> FR-251 -> FR-194 -> UR-046 | RULE-003]
// Valid input: the MARKETPLACE.md heading agrees but its Versioning sentence is stale. A finding that names
// MARKETPLACE.md (the section checks the heading and the sentence).
test("check_marketplaceMdVersioningSentenceStale_isFindingNamingMarketplaceMd", () => {
  const res = loadCheck()(build({ marketSentence: "1.14.3" }), {});
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.match(detailText(res), /MARKETPLACE\.md/);
});

// [spec-release-check R4 -> FR-251 -> FR-173 -> UR-046 | RULE-003]
// Valid input: a stale CLAUDE.md Plugin line. A finding that names CLAUDE.md.
test("check_claudeMdPluginLineStale_isFindingNamingClaudeMd", () => {
  const res = loadCheck()(build({ claude: "1.14.3" }), {});
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.match(detailText(res), /CLAUDE\.md/);
});

// [spec-release-check R4 -> FR-251 -> UR-046 | Scenario: Manifest mismatch]
// Boundary: a version that shares a prefix with the reference (1.14.40 against 1.14.4) is a different version.
test("check_versionSharingAPrefix_isFinding", () => {
  const res = loadCheck()(build({ readme: "1.14.40" }), {});
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.match(detailText(res), /README\.md/);
});

// [spec-release-check R4 -> FR-251 -> UR-046 | Scenario: Manifest mismatch]
// Boundary: a newer version in one place than the manifests (1.15.0 against 1.14.4) is still a disagreement.
test("check_placeAheadOfManifest_isFinding", () => {
  const res = loadCheck()(build({ readme: "1.15.0" }), {});
  assert.strictEqual(res.outcome, "finding", detailText(res));
});

// [spec-release-check R2 -> FR-251 | RULE-001: each disagreeing place is reported]
// Valid input: two places disagree. Both files are named in one result.
test("check_twoPlacesDisagree_bothAreNamed", () => {
  const res = loadCheck()(build({ readme: "1.14.3", marketHeading: "1.14.2" }), {});
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.match(detailText(res), /README\.md/);
  assert.match(detailText(res), /MARKETPLACE\.md/);
});

// ---------------------------------------------------------------------------------------------------------
// Requirement 4: operational errors (a place that cannot be read)
// ---------------------------------------------------------------------------------------------------------

// [spec-release-check R4 -> FR-251 -> UR-046 | Task plan Step 9: a missing file among the first five is an error]
// Null/empty: plugin.json is missing. The section could not complete, so the outcome is an operational error.
test("check_missingPluginJson_isOperationalError", () => {
  const res = loadCheck()(build({ skip: ["plugin"] }), {});
  assert.strictEqual(res.outcome, "error", detailText(res));
});

// [spec-release-check R4 -> FR-251 -> UR-046 | Task plan Step 9]
// Null/empty: marketplace.json is missing. Operational error.
test("check_missingMarketplaceJson_isOperationalError", () => {
  const res = loadCheck()(build({ skip: ["marketplace"] }), {});
  assert.strictEqual(res.outcome, "error", detailText(res));
});

// [spec-release-check R4 -> FR-251 -> UR-046 | Task plan Step 9]
// Null/empty: README.md is missing. Operational error.
test("check_missingReadme_isOperationalError", () => {
  const res = loadCheck()(build({ skip: ["readme"] }), {});
  assert.strictEqual(res.outcome, "error", detailText(res));
});

// [spec-release-check R4 -> FR-251 -> UR-046 | Task plan Step 9]
// Null/empty: MARKETPLACE.md is missing. Operational error.
test("check_missingMarketplaceMd_isOperationalError", () => {
  const res = loadCheck()(build({ skip: ["marketmd"] }), {});
  assert.strictEqual(res.outcome, "error", detailText(res));
});

// [spec-release-check R4 -> FR-251 -> UR-046 | Task plan Step 9]
// Null/empty: CLAUDE.md is missing. Operational error.
test("check_missingClaudeMd_isOperationalError", () => {
  const res = loadCheck()(build({ skip: ["claude"] }), {});
  assert.strictEqual(res.outcome, "error", detailText(res));
});

// [spec-release-check R4 -> FR-251 -> UR-046 | Task plan Step 9]
// Type mismatch: plugin.json holds text that is not JSON. Operational error, not a finding.
test("check_unparseablePluginJson_isOperationalError", () => {
  const root = build();
  put(root, "plugins/assist-plugin/.claude-plugin/plugin.json", "{ not json");
  const res = loadCheck()(root, {});
  assert.strictEqual(res.outcome, "error", detailText(res));
});

// [spec-release-check R4 -> FR-251 -> UR-046 | Task plan Step 9]
// Type mismatch: marketplace.json parses but holds no assist-plugin entry. The place cannot be read, so the
// section does not report clean.
test("check_marketplaceWithoutAssistPluginEntry_isNotClean", () => {
  const root = build();
  put(root, ".claude-plugin/marketplace.json", JSON.stringify({ name: "assist-plugin-marketplace", plugins: [] }));
  const res = loadCheck()(root, {});
  assert.notStrictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R4 -> FR-251 -> UR-046 | Task plan Step 9]
// Null/empty: an empty README.md holds no assist-plugin heading. The place cannot agree, so it is not clean.
test("check_emptyReadme_isNotClean", () => {
  const root = build();
  put(root, "README.md", "");
  const res = loadCheck()(root, {});
  assert.notStrictEqual(res.outcome, "clean", detailText(res));
});

// ---------------------------------------------------------------------------------------------------------
// Requirement 5: the CHANGELOG.md heading is optional when no release is requested
// ---------------------------------------------------------------------------------------------------------

// [spec-release-check R5 -> FR-251 | Scenario: Absent heading, no release requested]
// Null/empty: CHANGELOG.md holds no versioned heading at all, no release. No finding for CHANGELOG.md.
test("check_changelogHasNoVersionedHeading_noRelease_isClean", () => {
  const root = build({ changelog: "# Changelog\n\nNothing released yet.\n" });
  const res = loadCheck()(root, {});
  assert.strictEqual(res.outcome, "clean", detailText(res));
  assert.ok(!/CHANGELOG\.md/.test(detailText(res)), detailText(res));
});

// [spec-release-check R5 -> FR-251 | Scenario: Absent heading, no release requested]
// Boundary: only "## [Unreleased]" is present, which is not a versioned heading. No release: no finding.
test("check_changelogOnlyUnreleasedHeading_noRelease_isClean", () => {
  const root = build({ changelog: "# Changelog\n\n## [Unreleased]\n\n- pending\n" });
  const res = loadCheck()(root, { release: false });
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R5 -> FR-251 | Scenario: Absent heading, no release requested]
// Null/empty: the root CHANGELOG.md file does not exist, no release. Absent heading, no finding.
test("check_changelogFileMissing_noRelease_isClean", () => {
  const root = build({ changelog: null });
  const res = loadCheck()(root, {});
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R5 -> FR-251 | Scenario: Only older headings, no release requested]
// Valid input: manifests 1.14.4, newest heading 1.14.3, no release. No finding for CHANGELOG.md.
test("check_changelogNewestOlderThanManifest_noRelease_isClean", () => {
  const root = build({ changelog: changelogOf(["1.14.3", "1.14.2"]) });
  const res = loadCheck()(root, {});
  assert.strictEqual(res.outcome, "clean", detailText(res));
  assert.ok(!/CHANGELOG\.md/.test(detailText(res)), detailText(res));
});

// [spec-release-check R5 -> FR-251 | RULE-004: with no --release the heading is never a finding]
// Boundary: a heading newer than the manifests, no release. Still never a finding.
test("check_changelogNewestNewerThanManifest_noRelease_isClean", () => {
  const root = build({ changelog: changelogOf(["1.15.0", "1.14.4"]) });
  const res = loadCheck()(root, { release: false });
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R5 -> FR-251 | RULE-004]
// Boundary: a stale CHANGELOG.md plus a stale README.md, no release. The finding names README.md and does not
// name CHANGELOG.md.
test("check_staleChangelogAndStaleReadme_noRelease_namesOnlyReadme", () => {
  const root = build({ readme: "1.14.3", changelog: changelogOf(["1.14.3"]) });
  const res = loadCheck()(root, {});
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.match(detailText(res), /README\.md/);
  assert.ok(!/CHANGELOG\.md/.test(detailText(res)), detailText(res));
});

// [spec-release-check R5 -> FR-251 | Scenario: Newest heading differs, release requested]
// Valid input: manifests 1.14.4, newest heading 1.14.3, release requested. A finding that names CHANGELOG.md.
test("check_changelogNewestOlderThanManifest_release_isFindingNamingChangelog", () => {
  const root = build({ changelog: changelogOf(["1.14.3", "1.14.2"]) });
  const res = loadCheck()(root, { release: true });
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.match(detailText(res), /CHANGELOG\.md/);
});

// [spec-release-check R5 -> FR-251 | Scenario: Newest heading differs, release requested]
// Boundary: a heading newer than the manifests differs from the manifest version. Finding under --release.
test("check_changelogNewestNewerThanManifest_release_isFindingNamingChangelog", () => {
  const root = build({ changelog: changelogOf(["1.15.0", "1.14.4"]) });
  const res = loadCheck()(root, { release: true });
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.match(detailText(res), /CHANGELOG\.md/);
});

// [spec-release-check R5 -> FR-251 | Scenario: Absent heading, release requested]
// Null/empty: no versioned heading at all, release requested. A finding that names CHANGELOG.md.
test("check_changelogHasNoVersionedHeading_release_isFindingNamingChangelog", () => {
  const root = build({ changelog: "# Changelog\n\nNothing released yet.\n" });
  const res = loadCheck()(root, { release: true });
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.match(detailText(res), /CHANGELOG\.md/);
});

// [spec-release-check R5 -> FR-251 | Scenario: Absent heading, release requested]
// Boundary: only "## [Unreleased]" present, release requested. No versioned heading, so a finding.
test("check_changelogOnlyUnreleasedHeading_release_isFindingNamingChangelog", () => {
  const root = build({ changelog: "# Changelog\n\n## [Unreleased]\n\n- pending\n" });
  const res = loadCheck()(root, { release: true });
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.match(detailText(res), /CHANGELOG\.md/);
});

// [spec-release-check R5 -> FR-251 | Scenario: Absent heading, release requested]
// Null/empty: the CHANGELOG.md file does not exist, release requested. An absent heading, so a finding that
// names CHANGELOG.md (not an operational error).
test("check_changelogFileMissing_release_isFindingNamingChangelog", () => {
  const root = build({ changelog: null });
  const res = loadCheck()(root, { release: true });
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.match(detailText(res), /CHANGELOG\.md/);
});

// [spec-release-check R5 -> FR-251 | Scenario: Newest heading differs, release requested]
// Boundary: a version that shares a prefix with the manifest version in the newest heading (1.14.40 against
// 1.14.4) differs. Finding under --release.
test("check_changelogNewestSharesPrefix_release_isFinding", () => {
  const root = build({ changelog: changelogOf(["1.14.40"]) });
  const res = loadCheck()(root, { release: true });
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.match(detailText(res), /CHANGELOG\.md/);
});

// ---------------------------------------------------------------------------------------------------------
// CLI wiring of --release
// ---------------------------------------------------------------------------------------------------------

function cli(args, cwd) {
  return childProcess.spawnSync(process.execPath, [RUNNER].concat(args), {
    cwd: cwd,
    encoding: "utf8",
    timeout: 120000,
  });
}

function versionLine(res) {
  const out = String(res.stdout) + "\n" + String(res.stderr);
  const m = /^(clean|finding|error): .*version-agreement.*$/m.exec(out);
  return { outcome: m ? m[1] : null, out: out };
}

// [spec-release-check R5 -> FR-251 | Scenario: Only older headings, no release requested]
// Valid input: through the CLI, an older newest heading and no --release. The version section reports clean.
test("cli_olderChangelogHeading_withoutReleaseFlag_versionSectionClean", () => {
  const root = build({ changelog: changelogOf(["1.14.3"]) });
  const res = cli(["--root", root], root);
  const line = versionLine(res);
  assert.strictEqual(line.outcome, "clean", line.out);
});

// [spec-release-check R5 -> FR-251 | Scenario: Newest heading differs, release requested]
// Valid input: through the CLI, the same fixture with --release. The version section reports a finding that
// names CHANGELOG.md, and the run exits 1 or 2 (never 0).
test("cli_olderChangelogHeading_withReleaseFlag_versionSectionFindsChangelog", () => {
  const root = build({ changelog: changelogOf(["1.14.3"]) });
  const res = cli(["--root", root, "--release"], root);
  const line = versionLine(res);
  assert.strictEqual(line.outcome, "finding", line.out);
  assert.ok(line.out.indexOf("CHANGELOG.md") !== -1, line.out);
  assert.notStrictEqual(res.status, 0, line.out);
});

// [spec-release-check R5 -> FR-251 | Scenario: Absent heading, release requested]
// Null/empty: through the CLI, no versioned heading and --release. A finding that names CHANGELOG.md.
test("cli_absentChangelogHeading_withReleaseFlag_versionSectionFindsChangelog", () => {
  const root = build({ changelog: "# Changelog\n\nNothing yet.\n" });
  const res = cli(["--root", root, "--release"], root);
  const line = versionLine(res);
  assert.strictEqual(line.outcome, "finding", line.out);
  assert.ok(line.out.indexOf("CHANGELOG.md") !== -1, line.out);
});

// [spec-release-check R5 -> FR-251 | Scenario: Absent heading, no release requested]
// Null/empty: through the CLI, no versioned heading and no --release. The version section reports clean.
test("cli_absentChangelogHeading_withoutReleaseFlag_versionSectionClean", () => {
  const root = build({ changelog: "# Changelog\n\nNothing yet.\n" });
  const res = cli(["--root", root], root);
  const line = versionLine(res);
  assert.strictEqual(line.outcome, "clean", line.out);
});

// [spec-release-check R4 -> FR-251 -> UR-046 | Scenario: Manifest mismatch]
// Valid input: through the CLI, a manifest mismatch. The version section reports a finding.
test("cli_manifestMismatch_versionSectionFinding", () => {
  const root = build({ marketplace: "1.14.3" });
  const res = cli(["--root", root], root);
  const line = versionLine(res);
  assert.strictEqual(line.outcome, "finding", line.out);
});

// [spec-release-check R4 -> FR-251 -> UR-046 | Task plan Step 9: a missing manifest is an operational error]
// Null/empty: through the CLI, plugin.json is missing. The version section is an error and the run exits 2.
test("cli_missingPluginJson_versionSectionErrorAndExit2", () => {
  const root = build({ skip: ["plugin"] });
  const res = cli(["--root", root], root);
  const line = versionLine(res);
  assert.strictEqual(line.outcome, "error", line.out);
  assert.strictEqual(res.status, 2, line.out);
});
