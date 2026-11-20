// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the `.agent` hygiene section of the release-check runner (item 3).
//
// Sources: specs/spec-release-check.md, Requirement 7 (`.agent` is ignored as a whole and nothing under it is
// tracked) and its Change Log 2026-11-20 entry (the negation check scans four sources: the root `.gitignore`,
// every nested `.gitignore`, `.git/info/exclude`, and the global `core.excludesFile`), Requirement 8 (outside a
// git repository is an operational error), Requirement 3 (an operational error outranks a finding);
// docs/requirements/FR-NFR-assist-plugin.md, FR-253 (and FR-250 for the exit code).
// Task plan: docs/task-plans/task-plan-assist-pi-backport-20261120-0314.md, Steps 15 and 16.
//
// Traceability format: [spec-release-check R<n> -> FR-ids -> UR-ids | Scenario: <title>]. The spec carries no
// SPEC-NNN id, so the spec file and its Requirement number stand in for it. The spec and the plan give no AC-N
// index, so none is cited.
//
// Contract used (taken from the spec and the plan's interface contract, never from the implementation):
//   module    plugins/assist-plugin/scripts/release/agent-hygiene.js exports check(root)
//             returning { outcome, details }; outcome is "clean", "finding", or "error"; details is a list of
//             text lines (a finding names the offending path or the negated rule; an error holds only a fixed
//             reason and never raw git stderr)
//   CLI       node plugins/assist-plugin/scripts/release-check.js [--root DIR] [--release]
//             prints "<clean|finding|error>: <section name>" per section; the section is named "agent-hygiene"
//             and runs after "version-agreement"
//   exit      0 every section clean, 1 a finding and no operational error, 2 any operational error
//             (an operational error outranks a finding)
//   negation  (plan Step 15) each negated rule whose pattern, after a leading `/` or `**/` is removed, equals
//             `.agent` or starts with `.agent/` is one finding line that names its source and the rule. The
//             sources are the root `.gitignore`, a nested `.gitignore` (named by its path relative to the root),
//             `.git/info/exclude`, and the global `core.excludesFile` (named with its resolved path). A finding
//             from the global source carries the fixed suffix "(machine-dependent)". A source file that does not
//             exist adds no finding. An unset `core.excludesFile` is no source and no error.
//
// Each test builds a throw-away directory (a git repository unless the test needs one outside any repository)
// with a scrubbed git environment: no user or system configuration, no global ignore file. The tests for the
// global excludes source set HOME to a fresh temp directory that holds its own `.gitconfig`, set
// GIT_CONFIG_NOSYSTEM=1, and remove XDG_CONFIG_HOME and GIT_CONFIG_GLOBAL, so the maintainer's own git
// configuration is never read.
//
// Run: node --test tests/scripts/release-check-agent-hygiene.test.js

"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const RUNNER = path.join(REPO, "plugins", "assist-plugin", "scripts", "release-check.js");
const HYGIENE = path.join(REPO, "plugins", "assist-plugin", "scripts", "release", "agent-hygiene.js");

const hasGit = childProcess.spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;

const scratch = [];
let homeDir = null;
let ceilingDir = null;

function gitEnv(extra) {
  const env = Object.assign({}, process.env);
  Object.keys(env).forEach((k) => {
    if (/^GIT_/.test(k)) delete env[k];
  });
  Object.assign(env, {
    HOME: homeDir,
    XDG_CONFIG_HOME: homeDir,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_TERMINAL_PROMPT: "0",
    // Stop git from finding a repository above the temp folder, so "outside a repository" holds everywhere.
    GIT_CEILING_DIRECTORIES: ceilingDir,
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@example.com",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@example.com",
  });
  return Object.assign(env, extra || {});
}

function git(cwd, args) {
  const res = childProcess.spawnSync("git", args, { cwd: cwd, env: gitEnv(), encoding: "utf8" });
  assert.strictEqual(res.status, 0, "git " + args.join(" ") + " failed: " + res.stderr);
  return res.stdout;
}

before(() => {
  homeDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "agent-hygiene-home-")));
  scratch.push(homeDir);
  ceilingDir = fs.realpathSync(os.tmpdir());
});

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

// A new git repository. `gitignore` is the text of the root .gitignore, or null for no file.
function newRepo(gitignore) {
  const dir = mkdtemp("agent-hygiene-repo-");
  git(dir, ["init", "-q"]);
  if (gitignore !== null && gitignore !== undefined) put(dir, ".gitignore", gitignore);
  return dir;
}

// A directory that is not inside any git repository.
function newPlainDir() {
  return mkdtemp("agent-hygiene-plain-");
}

// Runs the hygiene section's check(root) with the scrubbed git environment applied to this process, because
// check(root) takes no environment argument. `env` replaces the default scrubbed environment.
function runCheck(root, env) {
  const saved = Object.assign({}, process.env);
  Object.keys(process.env).forEach((k) => {
    delete process.env[k];
  });
  Object.assign(process.env, env || gitEnv());
  try {
    const section = require(HYGIENE);
    return section.check(root);
  } finally {
    Object.keys(process.env).forEach((k) => {
      delete process.env[k];
    });
    Object.assign(process.env, saved);
  }
}

function detailText(res) {
  return [].concat((res && res.details) || []).join("\n");
}

// Writes the six version places so every non-hygiene section has the files it reads. `readme` overrides the
// README heading version (used to force a version finding).
function writeVersionFiles(dir, readme) {
  const v = "1.14.4";
  put(dir, "plugins/assist-plugin/.claude-plugin/plugin.json", JSON.stringify({ name: "assist-plugin", version: v }));
  put(
    dir,
    ".claude-plugin/marketplace.json",
    JSON.stringify({ name: "assist-plugin-marketplace", plugins: [{ name: "assist-plugin", version: v }] })
  );
  put(dir, "CLAUDE.md", "# Project\n\n- **Plugin:** `plugins/assist-plugin` (v" + v + ")\n");
  put(dir, "README.md", "# Readme\n\n### assist-plugin v" + (readme || v) + "\n");
  put(
    dir,
    "MARKETPLACE.md",
    "# Marketplace\n\n### assist-plugin v" + v + "\n\nEach plugin follows semantic versioning. Version " + v + " is available in `plugins/assist-plugin/`.\n"
  );
  put(dir, "CHANGELOG.md", "# Changelog\n\n## [" + v + "] - 2026-11-20\n\n- release\n");
}

// `env` replaces the default scrubbed environment.
function cli(args, cwd, env) {
  const res = childProcess.spawnSync(process.execPath, [RUNNER].concat(args), {
    cwd: cwd,
    env: env || gitEnv(),
    encoding: "utf8",
    timeout: 120000,
  });
  return res;
}

function everything(res) {
  return String(res.stdout || "") + "\n" + String(res.stderr || "");
}

function assertShape(res) {
  assert.ok(res && typeof res === "object", "check(root) returned no object");
  assert.ok(["clean", "finding", "error"].indexOf(res.outcome) !== -1, "unknown outcome: " + JSON.stringify(res.outcome));
}

// Raw git stderr for a non-repository: "fatal: not a git repository (or any of the parent directories): .git".
function assertNoRawGitStderr(text) {
  assert.ok(!/fatal:/i.test(text), "raw git stderr (fatal:) leaked:\n" + text);
  assert.ok(text.indexOf("(or any of the parent directories)") === -1, "raw git stderr leaked:\n" + text);
  assert.ok(!/usage: git/i.test(text), "raw git usage text leaked:\n" + text);
  assert.ok(!/bad config/i.test(text), "raw git config stderr leaked:\n" + text);
}

// ---------------------------------------------------------------------------------------------------------------
// Requirement 7, clean cases
// ---------------------------------------------------------------------------------------------------------------

// [spec-release-check R7 -> FR-253 -> UR-044 | Scenario: Clean]
// Valid input: .gitignore ignores `.agent/`, nothing under it is tracked, no negated rule targets it.
test("check_agentIgnoredAndUntracked_reportsClean", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Clean]
// Valid input: the rule is written without the trailing slash. It still ignores the folder as a whole.
test("check_agentIgnoredWithoutTrailingSlash_reportsClean", { skip: !hasGit }, () => {
  const repo = newRepo(".agent\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Clean]
// Valid input: the rule is anchored to the repository root.
test("check_agentIgnoredWithLeadingSlash_reportsClean", { skip: !hasGit }, () => {
  const repo = newRepo("/.agent/\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Clean]
// Valid input: the folder exists on disk with untracked content, other files are tracked, and the ignore rule
// sits among unrelated rules. Untracked content under an ignored folder is clean.
test("check_agentFolderHasUntrackedContent_otherFilesTracked_reportsClean", { skip: !hasGit }, () => {
  const repo = newRepo("node_modules/\n.agent/\n*.log\n");
  put(repo, ".agent/logs/notes.md", "local note\n");
  put(repo, ".agent/governance/profile.json", "{}\n");
  put(repo, "src/app.js", "module.exports = 1;\n");
  git(repo, ["add", "--", "src/app.js", ".gitignore"]);
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Clean]
// Boundary: a negated rule that targets some other path is not a rule that reopens `.agent`.
test("check_unrelatedNegatedRule_reportsClean", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n*.md\n!README.md\n!docs/keep.md\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Clean]
// Boundary: a negated rule for a sibling whose name only starts with ".agent" (".agentx") does not target
// `.agent` or a path under it.
test("check_negatedRuleForSiblingWithSharedPrefix_reportsClean", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n!.agentx/\n!.agent-notes.md\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Clean]
// Boundary: a commented-out negation is not a rule.
test("check_commentedOutNegation_reportsClean", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n# !.agent/governance/\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Clean]
// Boundary: a tracked path that only shares the ".agent" prefix (".agentx/") is not under `.agent/`.
test("check_trackedSiblingWithSharedPrefix_reportsClean", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  put(repo, ".agentx/readme.md", "not the agent folder\n");
  git(repo, ["add", "--", ".agentx/readme.md"]);
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "clean", detailText(res));
  assert.ok(detailText(res).indexOf(".agentx") === -1, detailText(res));
});

// ---------------------------------------------------------------------------------------------------------------
// Requirement 7, not ignored
// ---------------------------------------------------------------------------------------------------------------

// [spec-release-check R7 -> FR-253 | Scenario: Not ignored]
// Null/empty: there is no .gitignore at all, so no rule ignores `.agent/`.
test("check_noGitignoreFile_reportsFinding", { skip: !hasGit }, () => {
  const repo = newRepo(null);
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Not ignored]
// Invalid input: .gitignore exists but holds no rule for `.agent/`.
test("check_gitignoreWithoutAgentRule_reportsFinding", { skip: !hasGit }, () => {
  const repo = newRepo("node_modules/\n*.log\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Not ignored]
// Boundary: an empty .gitignore file.
test("check_emptyGitignoreFile_reportsFinding", { skip: !hasGit }, () => {
  const repo = newRepo("");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Not ignored]
// Boundary: only a path under `.agent` is ignored, not the folder as a whole. `.agent/` is not ignored as a
// whole, which Requirement 7 reports as a finding.
test("check_onlyOnePathUnderAgentIgnored_reportsFinding", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/logs/\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Not ignored]
// Boundary: a rule for a sibling that only shares the prefix does not ignore `.agent/`.
test("check_ignoreRuleForSiblingWithSharedPrefix_reportsFinding", { skip: !hasGit }, () => {
  const repo = newRepo(".agentx/\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
});

// ---------------------------------------------------------------------------------------------------------------
// Requirement 7, tracked paths
// ---------------------------------------------------------------------------------------------------------------

// [spec-release-check R7 -> FR-253 | Scenario: Tracked file]
// Valid input: `.agent/logs/notes.md` is tracked (force-added past the ignore rule). The finding names the path.
test("check_trackedFileUnderAgent_reportsFindingNamingThePath", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  put(repo, ".agent/logs/notes.md", "tracked by mistake\n");
  git(repo, ["add", "-f", "--", ".agent/logs/notes.md"]);
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.ok(detailText(res).indexOf(".agent/logs/notes.md") !== -1, "the finding does not name the path:\n" + detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Tracked file]
// Valid input: each tracked path is its own finding line, so two tracked files are both named.
test("check_twoTrackedFilesUnderAgent_bothNamed", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  put(repo, ".agent/logs/notes.md", "a\n");
  put(repo, ".agent/governance/profile.json", "{}\n");
  git(repo, ["add", "-f", "--", ".agent/logs/notes.md", ".agent/governance/profile.json"]);
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
  const text = detailText(res);
  assert.ok(text.indexOf(".agent/logs/notes.md") !== -1, text);
  assert.ok(text.indexOf(".agent/governance/profile.json") !== -1, text);
});

// [spec-release-check R7 -> FR-253 | Scenario: Tracked file]
// Boundary: a file directly under `.agent/` (one level) is tracked.
test("check_trackedFileDirectlyUnderAgent_reportsFindingNamingThePath", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  put(repo, ".agent/state.json", "{}\n");
  git(repo, ["add", "-f", "--", ".agent/state.json"]);
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.ok(detailText(res).indexOf(".agent/state.json") !== -1, detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Tracked file]
// Boundary: a tracked path with a space in its name. The path is named whole, not truncated or quoted away.
test("check_trackedFileWithSpaceInName_namesTheWholePath", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  put(repo, ".agent/logs/my notes.md", "spaced\n");
  git(repo, ["add", "-f", "--", ".agent/logs/my notes.md"]);
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.ok(detailText(res).indexOf(".agent/logs/my notes.md") !== -1, detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Tracked file]
// Boundary: a tracked path with a non-ASCII name. The path is named as written, not as an escaped string.
test("check_trackedFileWithNonAsciiName_namesThePathAsWritten", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  const rel = ".agent/logs/résumé.md";
  put(repo, rel, "accent\n");
  git(repo, ["add", "-f", "--", rel]);
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.ok(detailText(res).indexOf(rel) !== -1, detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Tracked file]
// Valid input: a tracked file under `.agent/` and also no ignore rule. Both problems exist, and the tracked
// path is still named.
test("check_trackedFileAndNoIgnoreRule_stillNamesThePath", { skip: !hasGit }, () => {
  const repo = newRepo(null);
  put(repo, ".agent/logs/notes.md", "tracked\n");
  git(repo, ["add", "--", ".agent/logs/notes.md"]);
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.ok(detailText(res).indexOf(".agent/logs/notes.md") !== -1, detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Tracked file]
// Boundary: a path that is committed (not only staged) under `.agent/` is tracked too.
test("check_committedFileUnderAgent_reportsFindingNamingThePath", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  put(repo, ".agent/logs/notes.md", "committed\n");
  git(repo, ["add", "-f", "--", ".agent/logs/notes.md"]);
  git(repo, ["-c", "commit.gpgsign=false", "commit", "-q", "-m", "fixture"]);
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.ok(detailText(res).indexOf(".agent/logs/notes.md") !== -1, detailText(res));
});

// ---------------------------------------------------------------------------------------------------------------
// Requirement 7, negated rules
// ---------------------------------------------------------------------------------------------------------------

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule reopens a path]
// Valid input: `.agent/*` then `!.agent/governance/`. The finding names the negated rule.
test("check_negatedRuleReopensGovernance_reportsFindingNamingTheRule", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/*\n!.agent/governance/\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.ok(detailText(res).indexOf(".agent/governance/") !== -1, "the finding does not name the negated rule:\n" + detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule reopens a path]
// Valid input: the folder is ignored as a whole (`.agent/`) and a later negated rule reopens one file.
test("check_negatedRuleAfterWholeIgnore_reportsFindingNamingTheRule", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n!.agent/keep.md\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.ok(detailText(res).indexOf(".agent/keep.md") !== -1, detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule reopens a path]
// Boundary: the negated pattern is exactly `.agent` (no slash, no subpath).
test("check_negatedRuleExactlyAgent_reportsFinding", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n!.agent\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.ok(detailText(res).indexOf("!.agent") !== -1 || detailText(res).indexOf(".agent") !== -1, detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule reopens a path]
// Boundary: the negated pattern is anchored with a leading slash.
test("check_negatedRuleWithLeadingSlash_reportsFinding", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/*\n!/.agent/governance/\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.ok(detailText(res).indexOf(".agent/governance/") !== -1, detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule reopens a path]
// Boundary: the negated pattern uses a leading `**/` prefix.
test("check_negatedRuleWithDoubleStarPrefix_reportsFinding", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/*\n!**/.agent/governance/\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.ok(detailText(res).indexOf(".agent/governance/") !== -1, detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule reopens a path]
// Valid input: two negated rules each get a finding line.
test("check_twoNegatedRules_bothReported", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/*\n!.agent/governance/\n!.agent/specs/\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.ok(detailText(res).indexOf(".agent/governance/") !== -1, detailText(res));
  assert.ok(detailText(res).indexOf(".agent/specs/") !== -1, detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule reopens a path]
// Boundary: the negated rule is the only problem with `.agent` itself. The tree holds no tracked path and a
// whole-folder ignore rule, yet the negated rule alone still produces a finding.
test("check_negatedRuleIsTheOnlyProblem_stillReportsFinding", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n!.agent/logs/\n");
  put(repo, ".agent/logs/notes.md", "untracked\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule reopens a path]
// Security-adjacent: shell metacharacters in a negated pattern. The rule still counts as a finding and nothing
// is executed (no shell is involved), so no marker file appears.
test("check_negatedRuleWithShellMetacharacters_reportsFindingAndExecutesNothing", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n!.agent/$(touch pwned-by-hygiene)\n!.agent/`touch pwned-by-hygiene2`\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.ok(!fs.existsSync(path.join(repo, "pwned-by-hygiene")), "a command in a .gitignore pattern was executed");
  assert.ok(!fs.existsSync(path.join(repo, "pwned-by-hygiene2")), "a command in a .gitignore pattern was executed");
});

// ---------------------------------------------------------------------------------------------------------------
// Requirement 7, Change Log 2026-11-20: negation in a nested .gitignore, .git/info/exclude, and the global
// excludes file (task plan Step 15 and Step 16)
// ---------------------------------------------------------------------------------------------------------------

const MACHINE_DEPENDENT = "(machine-dependent)";
const GLOBAL_EXCLUDES_NAME = "global-agent-excludes";

// The scrubbed environment with the test's own global git configuration: HOME is `home`, XDG_CONFIG_HOME and
// GIT_CONFIG_GLOBAL are removed, the system file stays off.
function globalEnv(home) {
  const env = gitEnv();
  delete env.GIT_CONFIG_GLOBAL;
  delete env.XDG_CONFIG_HOME;
  env.HOME = home;
  return env;
}

// A fresh HOME with no git configuration at all: `core.excludesFile` is unset.
function homeWithoutConfig() {
  return mkdtemp("agent-hygiene-ghome-");
}

// A fresh HOME whose .gitconfig sets `core.excludesFile` to a file that holds `rules`. With `tilde` the setting
// is written as `~/<name>`. Returns { home, file, env }.
function homeWithGlobalExcludes(rules, tilde) {
  const home = mkdtemp("agent-hygiene-ghome-");
  const file = put(home, GLOBAL_EXCLUDES_NAME, rules);
  put(home, ".gitconfig", "[core]\n\texcludesFile = " + (tilde ? "~/" + GLOBAL_EXCLUDES_NAME : file) + "\n");
  return { home: home, file: file, env: globalEnv(home) };
}

// The detail lines that hold every one of `parts`.
function linesWith(res, parts) {
  return detailText(res)
    .split("\n")
    .filter((line) => parts.every((part) => line.indexOf(part) !== -1));
}

function assertFindingLine(res, parts, label) {
  assertShape(res);
  assert.strictEqual(res.outcome, "finding", detailText(res));
  assert.ok(linesWith(res, parts).length > 0, "no finding line holds " + JSON.stringify(parts) + " (" + label + "):\n" + detailText(res));
}

// --- nested .gitignore ---------------------------------------------------------------------------------------

// [spec-release-check R7 -> FR-253 -> UR-044 | Scenario: Negated rule in a nested .gitignore]
// Valid input: `sub/.gitignore` holds `!.agent/governance/`. The finding names the nested file and the rule.
test("check_negatedRuleInNestedGitignore_reportsFindingNamingFileAndRule", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  put(repo, "sub/.gitignore", "!.agent/governance/\n");
  const res = runCheck(repo);
  assertFindingLine(res, ["sub/.gitignore", ".agent/governance/"], "nested file and rule on one line");
  assert.ok(linesWith(res, ["sub/.gitignore"]).every((line) => line.indexOf(MACHINE_DEPENDENT) === -1), "only the global source is machine-dependent:\n" + detailText(res));
  assertNoRawGitStderr(detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule in a nested .gitignore]
// Boundary: a nested file several folders deep is named by its path relative to the root.
test("check_negatedRuleInDeeplyNestedGitignore_namesTheRelativePath", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  put(repo, "a/b/c/.gitignore", "!.agent/\n");
  const res = runCheck(repo);
  assertFindingLine(res, ["a/b/c/.gitignore", ".agent/"], "deep nested file and rule");
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule in a nested .gitignore]
// Boundary: the leading `/` and the leading `**/` forms are matched by the same pattern test as in the root file,
// each in its own nested file, and each file is named.
test("check_negatedRuleWithSlashAndDoubleStarInNestedFiles_bothNamed", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  put(repo, "one/.gitignore", "!/.agent/keep-one.md\n");
  put(repo, "two/.gitignore", "!**/.agent/keep-two.md\n");
  const res = runCheck(repo);
  assertFindingLine(res, ["one/.gitignore", ".agent/keep-one.md"], "leading slash form");
  assertFindingLine(res, ["two/.gitignore", ".agent/keep-two.md"], "double star form");
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule in a nested .gitignore]
// Boundary: the negated pattern is exactly `.agent` in a nested file.
test("check_negatedRuleExactlyAgentInNestedGitignore_reportsFinding", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  put(repo, "sub/.gitignore", "!.agent\n");
  const res = runCheck(repo);
  assertFindingLine(res, ["sub/.gitignore"], "nested exact .agent rule");
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule in a nested .gitignore]
// Valid input: a nested .gitignore that is tracked (staged) is scanned too.
test("check_negatedRuleInTrackedNestedGitignore_reportsFinding", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  put(repo, "sub/.gitignore", "!.agent/governance/\n");
  git(repo, ["add", "--", "sub/.gitignore"]);
  const res = runCheck(repo);
  assertFindingLine(res, ["sub/.gitignore", ".agent/governance/"], "tracked nested file and rule");
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule in a nested .gitignore]
// Valid input: a root negation and a nested negation are two findings. Each names its own source, and the root
// finding does not name the nested file.
test("check_rootAndNestedNegations_eachFindingNamesItsOwnSource", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n!.agent/root-rule/\n");
  put(repo, "sub/.gitignore", "!.agent/nested-rule/\n");
  const res = runCheck(repo);
  assertFindingLine(res, [".gitignore", "root-rule"], "root source");
  assertFindingLine(res, ["sub/.gitignore", "nested-rule"], "nested source");
  assert.ok(linesWith(res, ["root-rule"]).every((line) => line.indexOf("sub/") === -1), "the root finding names the nested file:\n" + detailText(res));
  assert.ok(linesWith(res, ["nested-rule"]).every((line) => line.indexOf("root-rule") === -1), detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Clean]
// Boundary: an unrelated negation, a sibling that shares the ".agent" prefix, and a commented-out negation in a
// nested .gitignore are no finding.
test("check_unrelatedNegationsInNestedGitignore_reportsClean", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  put(repo, "sub/.gitignore", "*.md\n!keep.txt\n!.agentx/\n!.agent-notes.md\n# !.agent/governance/\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// --- .git/info/exclude ---------------------------------------------------------------------------------------

// [spec-release-check R7 -> FR-253 -> UR-044 | Scenario: Negated rule in .git/info/exclude]
// Valid input: `.git/info/exclude` holds `!.agent/governance/`. The finding names `.git/info/exclude` and the
// rule.
test("check_negatedRuleInInfoExclude_reportsFindingNamingSourceAndRule", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  put(repo, ".git/info/exclude", "# local rules\n!.agent/governance/\n");
  const res = runCheck(repo);
  assertFindingLine(res, [".git/info/exclude", ".agent/governance/"], "info/exclude source and rule on one line");
  assert.ok(linesWith(res, [".git/info/exclude"]).every((line) => line.indexOf(MACHINE_DEPENDENT) === -1), "only the global source is machine-dependent:\n" + detailText(res));
  assertNoRawGitStderr(detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule in .git/info/exclude]
// Boundary: the negated rule is anchored with a leading slash.
test("check_negatedRuleWithLeadingSlashInInfoExclude_reportsFinding", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  put(repo, ".git/info/exclude", "!/.agent/logs/\n");
  const res = runCheck(repo);
  assertFindingLine(res, [".git/info/exclude", ".agent/logs/"], "info/exclude leading slash");
});

// [spec-release-check R7 -> FR-253 | Scenario: Clean]
// Boundary: an unrelated negation and comment lines in `.git/info/exclude` are no finding.
test("check_unrelatedNegationInInfoExclude_reportsClean", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  put(repo, ".git/info/exclude", "# comment\n*.swp\n!keep.txt\n!.agentx/\n# !.agent/governance/\n");
  const res = runCheck(repo);
  assertShape(res);
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule in .git/info/exclude]
// Valid input: from a linked worktree the shared `.git/info/exclude` of the main repository is the source (the
// plan locates it with `git rev-parse --git-path info/exclude`), so the negation is still found.
test("check_negatedRuleInSharedInfoExclude_foundFromLinkedWorktree", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  git(repo, ["add", "--", ".gitignore"]);
  git(repo, ["-c", "commit.gpgsign=false", "commit", "-q", "-m", "fixture"]);
  const worktree = path.join(mkdtemp("agent-hygiene-wt-"), "wt");
  git(repo, ["worktree", "add", "-q", "-b", "hygiene-wt", worktree]);
  put(repo, ".git/info/exclude", "!.agent/governance/\n");
  const res = runCheck(worktree);
  assertFindingLine(res, ["info/exclude", ".agent/governance/"], "linked worktree reads the shared exclude file");
});

// --- global core.excludesFile --------------------------------------------------------------------------------

// [spec-release-check R7 -> FR-253 -> UR-044 | Scenario: Negated rule in the global excludes file]
// Valid input: the global excludes file holds `!.agent/governance/`. The finding names the global excludes file
// and the rule and carries the fixed "(machine-dependent)" marker.
test("check_negatedRuleInGlobalExcludesFile_reportsMachineDependentFindingNamingFileAndRule", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  const g = homeWithGlobalExcludes("!.agent/governance/\n", false);
  const res = runCheck(repo, g.env);
  assertFindingLine(res, [GLOBAL_EXCLUDES_NAME, ".agent/governance/", MACHINE_DEPENDENT], "global source, rule, and marker on one line");
  assertNoRawGitStderr(detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule in the global excludes file]
// Boundary: `core.excludesFile` is written with a `~/` prefix. The path is expanded and the file is read.
test("check_negatedRuleInGlobalExcludesFileWrittenWithTilde_reportsFinding", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  const g = homeWithGlobalExcludes("!.agent/governance/\n", true);
  const res = runCheck(repo, g.env);
  assertFindingLine(res, [GLOBAL_EXCLUDES_NAME, ".agent/governance/", MACHINE_DEPENDENT], "tilde form");
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule in the global excludes file]
// Boundary: the global excludes file holds a comment, an ignore rule for `.agent/`, and then the negation.
test("check_globalExcludesFileWithCommentsAndIgnoreRuleAndNegation_reportsOneFindingForTheNegation", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  const g = homeWithGlobalExcludes("# global\n.agent/\n!.agent/specs/\n", false);
  const res = runCheck(repo, g.env);
  assertFindingLine(res, [GLOBAL_EXCLUDES_NAME, ".agent/specs/", MACHINE_DEPENDENT], "negation in a longer global file");
  assert.strictEqual(linesWith(res, [MACHINE_DEPENDENT]).length, 1, "one negation, one finding line:\n" + detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Clean]
// Boundary: an unrelated negation, a sibling that shares the prefix, and an `.agent/` ignore rule (no negation)
// in the global excludes file are no finding.
test("check_unrelatedNegationsInGlobalExcludesFile_reportsClean", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  const g = homeWithGlobalExcludes("*.swp\n!keep.txt\n!.agentx/\n.agent/\n", false);
  const res = runCheck(repo, g.env);
  assertShape(res);
  assert.strictEqual(res.outcome, "clean", detailText(res));
  assert.ok(detailText(res).indexOf(MACHINE_DEPENDENT) === -1, detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Clean]
// Null/empty: `core.excludesFile` is unset (the global git configuration has no such key). There is no global
// source: no finding and no error.
test("check_globalExcludesFileUnset_reportsCleanWithoutError", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  const res = runCheck(repo, globalEnv(homeWithoutConfig()));
  assertShape(res);
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Clean]
// Null/empty: the global configuration exists and holds other settings but no `core.excludesFile`.
test("check_globalConfigWithoutExcludesFileKey_reportsCleanWithoutError", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  const home = homeWithoutConfig();
  put(home, ".gitconfig", "[user]\n\tname = hygiene\n\temail = hygiene@example.com\n[core]\n\tautocrlf = false\n");
  const res = runCheck(repo, globalEnv(home));
  assertShape(res);
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Clean]
// Boundary: `core.excludesFile` names a file that does not exist. A source file that does not exist adds no
// finding and no error.
test("check_globalExcludesFileMissingOnDisk_reportsCleanWithoutError", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  const home = homeWithoutConfig();
  put(home, ".gitconfig", "[core]\n\texcludesFile = " + path.join(home, "does-not-exist") + "\n");
  const res = runCheck(repo, globalEnv(home));
  assertShape(res);
  assert.strictEqual(res.outcome, "clean", detailText(res));
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule in the global excludes file]
// Valid input: machine dependence. The same commit passes where the global excludes file holds no negation and
// fails where it holds one (the accepted trade-off of the spec).
test("check_sameRepositoryWithAndWithoutGlobalNegation_resultDependsOnTheMachine", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  const without = runCheck(repo, globalEnv(homeWithoutConfig()));
  assertShape(without);
  assert.strictEqual(without.outcome, "clean", detailText(without));
  const withNegation = runCheck(repo, homeWithGlobalExcludes("!.agent/governance/\n", false).env);
  assertShape(withNegation);
  assert.strictEqual(withNegation.outcome, "finding", detailText(withNegation));
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule in the global excludes file]
// Valid input: all four sources hold a distinct negated `.agent` rule. Each rule is reported once, on a line that
// names its own source, and only the line of the global source carries "(machine-dependent)".
test("check_negationInAllFourSources_eachFindingNamesItsSourceAndOnlyTheGlobalOneIsMachineDependent", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n!.agent/root-rule/\n");
  put(repo, "sub/.gitignore", "!.agent/nested-rule/\n");
  put(repo, ".git/info/exclude", "!.agent/exclude-rule/\n");
  const g = homeWithGlobalExcludes("!.agent/global-rule/\n", false);
  const res = runCheck(repo, g.env);
  assertFindingLine(res, [".gitignore", "root-rule"], "root source");
  assertFindingLine(res, ["sub/.gitignore", "nested-rule"], "nested source");
  assertFindingLine(res, [".git/info/exclude", "exclude-rule"], "info/exclude source");
  assertFindingLine(res, [GLOBAL_EXCLUDES_NAME, "global-rule", MACHINE_DEPENDENT], "global source");
  ["root-rule", "nested-rule", "exclude-rule"].forEach((rule) => {
    assert.ok(linesWith(res, [rule]).length >= 1, rule + " is reported");
    assert.ok(linesWith(res, [rule]).every((line) => line.indexOf(MACHINE_DEPENDENT) === -1), rule + " must not be marked machine-dependent:\n" + detailText(res));
  });
  const marked = linesWith(res, [MACHINE_DEPENDENT]);
  assert.ok(marked.length >= 1 && marked.every((line) => line.indexOf("global-rule") !== -1), "the marker sits only on the global finding:\n" + detailText(res));
});

// --- no raw git stderr, and the root outside a repository -----------------------------------------------------

// [spec-release-check R8 -> FR-253 | Scenario: Outside a git repository]
// Invalid input: the root is outside any repository while a global excludes file with a negation is configured.
// The outcome is an operational error, not a finding, and no raw git stderr is echoed.
test("check_outsideGitRepositoryWithGlobalNegation_reportsOperationalErrorNotFinding", { skip: !hasGit }, () => {
  const dir = newPlainDir();
  const g = homeWithGlobalExcludes("!.agent/governance/\n", false);
  const res = runCheck(dir, g.env);
  assertShape(res);
  assert.strictEqual(res.outcome, "error", detailText(res));
  assertNoRawGitStderr(detailText(res));
});

// [spec-release-check R8 -> FR-253 | Scenario: Outside a git repository]
// Security-adjacent: a global git configuration that git cannot parse makes a git query fail. The section ends
// in an operational error and echoes none of git's own message.
test("check_unparseableGlobalGitConfig_reportsOperationalErrorWithoutRawStderr", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  const home = homeWithoutConfig();
  put(home, ".gitconfig", "[core\n\texcludesFile = x\n");
  const res = runCheck(repo, globalEnv(home));
  assertShape(res);
  assert.strictEqual(res.outcome, "error", detailText(res));
  assertNoRawGitStderr(detailText(res));
});

// ---------------------------------------------------------------------------------------------------------------
// Requirement 8, outside a git repository
// ---------------------------------------------------------------------------------------------------------------

// [spec-release-check R8 -> FR-253 | Scenario: Outside a git repository]
// Invalid input: the root is a plain directory. The outcome is an operational error, not a finding.
test("check_outsideGitRepository_reportsOperationalError", { skip: !hasGit }, () => {
  const dir = newPlainDir();
  const res = runCheck(dir);
  assertShape(res);
  assert.strictEqual(res.outcome, "error", detailText(res));
});

// [spec-release-check R8 -> FR-253 | Scenario: Outside a git repository]
// Boundary: a .gitignore that would pass inside a repository does not rescue a directory outside one.
test("check_outsideGitRepositoryWithAgentIgnoreFile_stillReportsOperationalError", { skip: !hasGit }, () => {
  const dir = newPlainDir();
  put(dir, ".gitignore", ".agent/\n");
  const res = runCheck(dir);
  assertShape(res);
  assert.strictEqual(res.outcome, "error", detailText(res));
});

// [spec-release-check R8 -> FR-253 | Scenario: Outside a git repository]
// Invalid input: a directory named `.git` that holds no repository data. Git fails, which is an operational
// error as well.
test("check_brokenGitDirectory_reportsOperationalError", { skip: !hasGit }, () => {
  const dir = newPlainDir();
  fs.mkdirSync(path.join(dir, ".git"));
  const res = runCheck(dir);
  assertShape(res);
  assert.strictEqual(res.outcome, "error", detailText(res));
});

// [spec-release-check R8 -> FR-253 | Scenario: Outside a git repository]
// Type mismatch: the root names a directory that does not exist. The section cannot complete, so the outcome is
// an operational error and the call does not throw.
test("check_rootDirectoryMissing_reportsOperationalErrorWithoutThrowing", { skip: !hasGit }, () => {
  const dir = path.join(newPlainDir(), "does-not-exist");
  const res = runCheck(dir);
  assertShape(res);
  assert.strictEqual(res.outcome, "error", detailText(res));
});

// [spec-release-check R8 -> FR-253 | Scenario: Outside a git repository]
// Security-adjacent: the operational error never carries raw git stderr (the "fatal: not a git repository ..."
// text), whatever the cause.
test("check_operationalError_neverEchoesRawGitStderr", { skip: !hasGit }, () => {
  const plain = newPlainDir();
  const broken = newPlainDir();
  fs.mkdirSync(path.join(broken, ".git"));
  [plain, broken].forEach((dir) => {
    const res = runCheck(dir);
    assertShape(res);
    assert.strictEqual(res.outcome, "error", detailText(res));
    assertNoRawGitStderr(detailText(res));
  });
});

// [spec-release-check R8 -> FR-253 | Scenario: Outside a git repository]
// Security-adjacent: the root path holds shell metacharacters. The section still ends in an operational error
// and executes nothing.
test("check_rootPathWithShellMetacharacters_reportsOperationalErrorAndExecutesNothing", { skip: !hasGit }, () => {
  const base = newPlainDir();
  const dir = path.join(base, "dir $(touch pwned-by-root) `x` ;&");
  fs.mkdirSync(dir);
  const res = runCheck(dir);
  assertShape(res);
  assert.strictEqual(res.outcome, "error", detailText(res));
  assert.ok(!fs.existsSync(path.join(dir, "pwned-by-root")), "a command in the root path was executed");
  assert.ok(!fs.existsSync(path.join(base, "pwned-by-root")), "a command in the root path was executed");
});

// ---------------------------------------------------------------------------------------------------------------
// Runner: the section is registered and reports on its own line (Requirement 1, Requirement 3)
// ---------------------------------------------------------------------------------------------------------------

// [spec-release-check R1 -> FR-250 -> UR-044 | Scenario: All sections clean]
// Valid input: the CLI reports the hygiene section on its own line, after the version-agreement section, as
// clean for a tree with `.agent/` ignored and nothing tracked.
test("cli_cleanAgentTree_reportsHygieneSectionCleanAfterVersionSection", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  writeVersionFiles(repo);
  const res = cli(["--root", repo], repo);
  const out = everything(res);
  const version = /^(clean|finding|error): .*version-agreement.*$/m.exec(out);
  const hygiene = /^clean: .*agent-hygiene.*$/m.exec(out);
  assert.ok(version, "no version-agreement line in:\n" + out);
  assert.ok(hygiene, "no 'clean: agent-hygiene' line in:\n" + out);
  assert.ok(version.index < hygiene.index, "agent-hygiene is not reported after version-agreement:\n" + out);
  assert.ok([0, 1, 2].indexOf(res.status) !== -1, "exit status outside 0/1/2: " + res.status);
});

// [spec-release-check R7 -> FR-253 | Scenario: Tracked file]
// Valid input: a tracked `.agent` path makes the CLI report the hygiene section as a finding that names the
// path, and the run exits 1 or 2 (never 0).
test("cli_trackedAgentFile_reportsHygieneFindingNamingThePath", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  writeVersionFiles(repo);
  put(repo, ".agent/logs/notes.md", "tracked\n");
  git(repo, ["add", "-f", "--", ".agent/logs/notes.md"]);
  const res = cli(["--root", repo], repo);
  const out = everything(res);
  assert.match(out, /^finding: .*agent-hygiene.*$/m, out);
  assert.ok(!/^error: .*agent-hygiene.*$/m.test(out), out);
  assert.ok(out.indexOf(".agent/logs/notes.md") !== -1, "the report does not name the path:\n" + out);
  assert.notStrictEqual(res.status, 0, out);
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule reopens a path]
// Valid input: a negated rule makes the CLI report the hygiene section as a finding, not an error.
test("cli_negatedRule_reportsHygieneFinding", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/*\n!.agent/governance/\n");
  writeVersionFiles(repo);
  const res = cli(["--root", repo], repo);
  const out = everything(res);
  assert.match(out, /^finding: .*agent-hygiene.*$/m, out);
  assert.ok(!/^error: .*agent-hygiene.*$/m.test(out), out);
  assert.notStrictEqual(res.status, 0, out);
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule in a nested .gitignore; Negated rule in .git/info/exclude]
// Valid input: negations in a nested `.gitignore` and in `.git/info/exclude` make the CLI report the hygiene
// section as a finding that names both sources and both rules, not an error.
test("cli_negatedRuleInNestedGitignoreAndInfoExclude_reportsHygieneFindingNamingBothSources", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  writeVersionFiles(repo);
  put(repo, "sub/.gitignore", "!.agent/nested-rule/\n");
  put(repo, ".git/info/exclude", "!.agent/exclude-rule/\n");
  const res = cli(["--root", repo], repo);
  const out = everything(res);
  assert.match(out, /^finding: .*agent-hygiene.*$/m, out);
  assert.ok(!/^error: .*agent-hygiene.*$/m.test(out), out);
  assert.ok(/sub\/\.gitignore.*nested-rule|nested-rule.*sub\/\.gitignore/.test(out), "the nested finding is missing:\n" + out);
  assert.ok(/\.git\/info\/exclude.*exclude-rule|exclude-rule.*\.git\/info\/exclude/.test(out), "the info/exclude finding is missing:\n" + out);
  assert.notStrictEqual(res.status, 0, out);
});

// [spec-release-check R7 -> FR-253 | Scenario: Negated rule in the global excludes file]
// Valid input: a negation in the global excludes file makes the CLI report the hygiene section as a finding that
// carries the "(machine-dependent)" marker; the same repository run with no global configuration is clean.
test("cli_negatedRuleInGlobalExcludesFile_reportsMachineDependentHygieneFinding", { skip: !hasGit }, () => {
  const repo = newRepo(".agent/\n");
  writeVersionFiles(repo);
  const baseline = cli(["--root", repo], repo, globalEnv(homeWithoutConfig()));
  assert.match(everything(baseline), /^clean: .*agent-hygiene.*$/m, everything(baseline));
  const g = homeWithGlobalExcludes("!.agent/governance/\n", false);
  const res = cli(["--root", repo], repo, g.env);
  const out = everything(res);
  assert.match(out, /^finding: .*agent-hygiene.*$/m, out);
  assert.ok(!/^error: .*agent-hygiene.*$/m.test(out), out);
  assert.ok(out.split("\n").some((line) => line.indexOf(".agent/governance/") !== -1 && line.indexOf(MACHINE_DEPENDENT) !== -1), "no finding line holds the rule and the marker:\n" + out);
  assert.notStrictEqual(res.status, 0, out);
});

// [spec-release-check R8 -> FR-253 | Scenario: Outside a git repository]
// Invalid input: the CLI runs with --root at a directory outside any repository. The hygiene section is an
// operational error and the run exits 2.
test("cli_outsideGitRepository_reportsHygieneErrorAndExits2", { skip: !hasGit }, () => {
  const dir = newPlainDir();
  writeVersionFiles(dir);
  put(dir, ".gitignore", ".agent/\n");
  const res = cli(["--root", dir], dir);
  const out = everything(res);
  assert.match(out, /^error: .*agent-hygiene.*$/m, out);
  assert.strictEqual(res.status, 2, out);
});

// [spec-release-check R8 -> FR-253 | R3 -> FR-250 | Scenario: Outside a git repository; Finding and operational
// error together]
// Valid input: outside a repository another section also reports a finding (a stale README heading is a
// version-agreement finding). Both outcomes are reported, and the exit is 2 because the operational error
// outranks the finding.
test("cli_outsideGitRepositoryWithVersionFinding_exits2NotOne", { skip: !hasGit }, () => {
  const dir = newPlainDir();
  writeVersionFiles(dir, "1.0.0");
  const res = cli(["--root", dir], dir);
  const out = everything(res);
  assert.match(out, /^finding: .*version-agreement.*$/m, out);
  assert.match(out, /^error: .*agent-hygiene.*$/m, out);
  assert.strictEqual(res.status, 2, "the operational error must outrank the finding:\n" + out);
});

// [spec-release-check R8 -> FR-253 | R3 -> FR-250 -> UR-051 | Scenario: Outside a git repository; Finding and
// operational error together]
// Invalid input: the same outside-a-repository run with a global excludes file that holds a negation. The
// operational error still outranks the findings (exit 2), and no raw git stderr is echoed.
test("cli_outsideGitRepositoryWithGlobalNegationAndVersionFinding_exits2AndEchoesNoGitStderr", { skip: !hasGit }, () => {
  const dir = newPlainDir();
  writeVersionFiles(dir, "1.0.0");
  const g = homeWithGlobalExcludes("!.agent/governance/\n", false);
  const res = cli(["--root", dir], dir, g.env);
  const out = everything(res);
  assert.match(out, /^finding: .*version-agreement.*$/m, out);
  assert.match(out, /^error: .*agent-hygiene.*$/m, out);
  assertNoRawGitStderr(out);
  assert.strictEqual(res.status, 2, "the operational error must outrank the finding:\n" + out);
});

// [spec-release-check R8 -> FR-253 | Scenario: Outside a git repository]
// Security-adjacent: the CLI output never holds raw git stderr for the section, for a plain directory or a
// broken `.git` folder.
test("cli_outsideGitRepository_neverEchoesRawGitStderr", { skip: !hasGit }, () => {
  const plain = newPlainDir();
  writeVersionFiles(plain);
  const broken = newPlainDir();
  writeVersionFiles(broken);
  fs.mkdirSync(path.join(broken, ".git"));
  [plain, broken].forEach((dir) => {
    const res = cli(["--root", dir], dir);
    const out = everything(res);
    assert.match(out, /^error: .*agent-hygiene.*$/m, out);
    assertNoRawGitStderr(out);
    assert.strictEqual(res.status, 2, out);
  });
});

// [spec-release-check R3 -> FR-250 -> UR-051 | Scenario: Findings only]
// Boundary: in a repository the hygiene finding alone does not make an operational error. The hygiene line is
// a finding and never an error line, and the exit is 1 unless another section errors.
test("cli_hygieneFindingInsideRepository_isNotAnOperationalError", { skip: !hasGit }, () => {
  const repo = newRepo(null);
  writeVersionFiles(repo);
  const res = cli(["--root", repo], repo);
  const out = everything(res);
  assert.match(out, /^finding: .*agent-hygiene.*$/m, out);
  assert.ok(!/^error: .*agent-hygiene.*$/m.test(out), out);
  if (!/^error: /m.test(out)) {
    assert.strictEqual(res.status, 1, "a finding with no operational error must exit 1:\n" + out);
  }
});
