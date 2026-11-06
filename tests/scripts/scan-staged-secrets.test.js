// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the staged-secret scanner (harness-governance Tranche 1, Step 6):
// plugins/assist-plugin/scripts/scan-staged-secrets.js.
//
// Sources: docs/requirements/FR-NFR-harness-governance.md, section 2.4 (FR-217: Clean scan commits, Staged
// secret stops the commit, Scanner unavailable) and section 3.2 (NFR-031: Secret value kept out of the log;
// NFR-028 fail closed). Task plan: docs/task-plans/task-plan-harness-governance-20261028-0759.md, Step 6 and
// Step 9.
//
// Traceability format: [FR-ids | AC section | Scenario title]. The requirement document uses numbered
// acceptance sections and carries no SPEC-NNN id for this feature, so none is cited.
//
// Contract used (the three outcomes of FR-217):
//   command   node scripts/scan-staged-secrets.js, run from inside the repository whose staged changes it scans
//   exit 0    clean: no staged line matched a rule
//   exit 1    findings: each finding is printed as "<path>: <rule name>"; the matched value, the matching line,
//             and a line number are never printed (NFR-031)
//   exit 2    cannot run: git is missing, the directory is not a repository, or the script failed
//
// Secret-shaped strings are assembled at run time from pieces, so this file holds no scannable credential and
// the commit workflow can stage it. Each test builds a throw-away git repository in a temp directory with a
// scrubbed environment (no user or system git configuration).
//
// Run: node --test tests/scripts/scan-staged-secrets.test.js

"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const SCRIPT = path.join(REPO, "plugins", "assist-plugin", "scripts", "scan-staged-secrets.js");

// Credential-shaped values, assembled at run time.
const AWS_KEY = "AK" + "IA" + "Z7Q2K9M4X8P3R5T6";
const GITHUB_TOKEN = "gh" + "p_" + "aB3dE5gH7jK9mN2pQ4sT6vW8yZ1bC3dE5fG7";
const PEM_HEADER = "-----BEGIN " + "RSA PRIVATE KEY-----";

const scratch = [];
let homeDir = null;
let hasGit = false;

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
  homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "scan-secrets-home-"));
  scratch.push(homeDir);
  const probe = childProcess.spawnSync("git", ["--version"], { encoding: "utf8" });
  hasGit = probe.status === 0;
});

after(() => {
  scratch.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function newRepo() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "scan-secrets-repo-")));
  scratch.push(dir);
  git(dir, ["init", "-q"]);
  return dir;
}

function put(repo, rel, content) {
  const file = path.join(repo, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function stage(repo, rels) {
  git(repo, ["add", "--"].concat(rels));
}

function scan(cwd, extraEnv) {
  return childProcess.spawnSync(process.execPath, [SCRIPT], {
    cwd: cwd,
    env: gitEnv(extraEnv),
    encoding: "utf8",
    timeout: 60000,
  });
}

function everything(res) {
  return String(res.stdout) + "\n" + String(res.stderr);
}

// No window of 8 or more characters of the value appears anywhere in the output.
function assertValueAbsent(res, value) {
  const out = everything(res);
  for (let i = 0; i + 8 <= value.length; i += 1) {
    assert.ok(out.indexOf(value.slice(i, i + 8)) === -1, "the output holds part of the secret value: " + value.slice(i, i + 8));
  }
}

const gitOpt = () => ({ skip: !hasGit && "git is not installed" });

// ---------------------------------------------------------------------------
// FR-217: clean scan (exit 0)
// ---------------------------------------------------------------------------

test("[FR-217 | 2.4 | Clean scan commits] a staged file with no secret pattern exits 0 and names no file", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  const repo = newRepo();
  put(repo, "src/app.js", "const answer = 42;\nconsole.log('hello');\n");
  stage(repo, ["src/app.js"]);
  const res = scan(repo);
  assert.strictEqual(res.status, 0, everything(res));
  assert.ok(everything(res).indexOf("app.js") === -1, "a clean scan reports no finding");
});

test("[FR-217 | 2.4 | Clean scan commits] nothing staged exits 0 (boundary: empty index)", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  const repo = newRepo();
  const res = scan(repo);
  assert.strictEqual(res.status, 0, everything(res));
});

test("[FR-217 | 2.4 | Clean scan commits] a secret in an unstaged file is not a finding: only staged changes are scanned", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  const repo = newRepo();
  put(repo, "ok.txt", "plain text\n");
  put(repo, "unstaged.js", "const key = \"" + AWS_KEY + "\";\n");
  stage(repo, ["ok.txt"]);
  const res = scan(repo);
  assert.strictEqual(res.status, 0, everything(res));
});

test("[FR-217 | 2.4 | Clean scan commits] a placeholder that is not a credential shape exits 0", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  const repo = newRepo();
  put(repo, "README.md", "Set API_KEY to your key, for example `export API_KEY=<your key here>`.\nAKIA is the prefix of an AWS key id.\n");
  stage(repo, ["README.md"]);
  const res = scan(repo);
  assert.strictEqual(res.status, 0, everything(res));
});

test("[FR-217 | 2.4 | Clean scan commits] a secret only in a removed line is not a finding (only added lines are scanned)", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  const repo = newRepo();
  put(repo, "config.js", "const key = \"" + AWS_KEY + "\";\nmodule.exports = {};\n");
  git(repo, ["add", "--", "config.js"]);
  git(repo, ["commit", "-q", "-m", "seed"]);
  put(repo, "config.js", "module.exports = {};\n");
  stage(repo, ["config.js"]);
  const res = scan(repo);
  assert.strictEqual(res.status, 0, everything(res));
});

test("[FR-217 | 2.4 | Clean scan commits] a large clean staged file scans and exits 0", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  const repo = newRepo();
  const body = [];
  for (let i = 0; i < 20000; i += 1) body.push("line " + i + " of ordinary text without any credential");
  put(repo, "big.txt", body.join("\n") + "\n");
  stage(repo, ["big.txt"]);
  const res = scan(repo);
  assert.strictEqual(res.status, 0, everything(res));
});

// ---------------------------------------------------------------------------
// FR-217 / NFR-031: staged secret (exit 1), path and rule name only
// ---------------------------------------------------------------------------

test("[FR-217 | NFR-031 | 2.4 | Staged secret stops the commit] a staged AWS key exits 1 and the output names the path and a rule, never the value", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  const repo = newRepo();
  put(repo, "src/config.js", "// settings\nconst key = \"" + AWS_KEY + "\";\n");
  stage(repo, ["src/config.js"]);
  const res = scan(repo);
  assert.strictEqual(res.status, 1, everything(res));
  assert.ok(/src\/config\.js: \S+/.test(res.stdout), "the finding line is `<path>: <rule name>`: " + res.stdout);
  assertValueAbsent(res, AWS_KEY);
  assert.ok(everything(res).indexOf("const key") === -1, "the matching line is not printed");
});

test("[FR-217 | NFR-031 | 2.4 | Staged secret stops the commit] the output holds no line number and no diff text", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  const repo = newRepo();
  put(repo, "a.js", "line one\nline two\nconst key = \"" + AWS_KEY + "\";\n");
  stage(repo, ["a.js"]);
  const res = scan(repo);
  assert.strictEqual(res.status, 1, everything(res));
  const out = everything(res);
  assert.ok(!/^.*a\.js:\d+/m.test(out), "a path:line form is a line number: " + out);
  assert.ok(!/^[+-]{3} /m.test(out) && !/^@@/m.test(out), "no diff header: " + out);
  assert.ok(out.indexOf("line two") === -1, "no context line");
});

test("[FR-217 | NFR-031 | 2.4 | Staged secret stops the commit] a GitHub token and a private-key header each exit 1 without their value", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  const repoToken = newRepo();
  put(repoToken, "ci/deploy.sh", "export TOKEN=" + GITHUB_TOKEN + "\n");
  stage(repoToken, ["ci/deploy.sh"]);
  const token = scan(repoToken);
  assert.strictEqual(token.status, 1, everything(token));
  assert.ok(/ci\/deploy\.sh: \S+/.test(token.stdout), token.stdout);
  assertValueAbsent(token, GITHUB_TOKEN);

  const repoPem = newRepo();
  put(repoPem, "keys/id_rsa", PEM_HEADER + "\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----\n");
  stage(repoPem, ["keys/id_rsa"]);
  const pem = scan(repoPem);
  assert.strictEqual(pem.status, 1, everything(pem));
  assert.ok(/keys\/id_rsa: \S+/.test(pem.stdout), pem.stdout);
  assert.ok(everything(pem).indexOf("MIIEowIBAAKCAQEA") === -1, "key body not printed");
});

test("[FR-217 | 2.4 | Staged secret stops the commit] a finding in one of several staged files names that file and not the clean ones", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  const repo = newRepo();
  put(repo, "clean-one.txt", "nothing here\n");
  put(repo, "secret-file.txt", "key=" + AWS_KEY + "\n");
  put(repo, "clean-two.txt", "nothing here either\n");
  stage(repo, ["clean-one.txt", "secret-file.txt", "clean-two.txt"]);
  const res = scan(repo);
  assert.strictEqual(res.status, 1, everything(res));
  assert.ok(res.stdout.indexOf("secret-file.txt") !== -1, res.stdout);
  assert.ok(res.stdout.indexOf("clean-one.txt") === -1, res.stdout);
  assert.ok(res.stdout.indexOf("clean-two.txt") === -1, res.stdout);
});

test("[FR-217 | 2.4 | Staged secret stops the commit] two files with findings are both named", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  const repo = newRepo();
  put(repo, "one.env", "A=" + AWS_KEY + "\n");
  put(repo, "two.env", "B=" + GITHUB_TOKEN + "\n");
  stage(repo, ["one.env", "two.env"]);
  const res = scan(repo);
  assert.strictEqual(res.status, 1, everything(res));
  assert.ok(/one\.env: \S+/.test(res.stdout), res.stdout);
  assert.ok(/two\.env: \S+/.test(res.stdout), res.stdout);
  assertValueAbsent(res, AWS_KEY);
  assertValueAbsent(res, GITHUB_TOKEN);
});

test("[FR-217 | 2.4 | Staged secret stops the commit] a secret added to an already tracked file is found", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  const repo = newRepo();
  put(repo, "settings.js", "module.exports = {};\n");
  git(repo, ["add", "--", "settings.js"]);
  git(repo, ["commit", "-q", "-m", "seed"]);
  put(repo, "settings.js", "module.exports = { key: \"" + AWS_KEY + "\" };\n");
  stage(repo, ["settings.js"]);
  const res = scan(repo);
  assert.strictEqual(res.status, 1, everything(res));
  assert.ok(/settings\.js: \S+/.test(res.stdout), res.stdout);
});

test("[FR-217 | 2.4 | Staged secret stops the commit] a path with a space is named in full", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  const repo = newRepo();
  put(repo, "my dir/key file.txt", AWS_KEY + "\n");
  stage(repo, ["my dir/key file.txt"]);
  const res = scan(repo);
  assert.strictEqual(res.status, 1, everything(res));
  assert.ok(res.stdout.indexOf("key file.txt") !== -1, res.stdout);
});

test("[FR-217 | NFR-031 | 2.4 | Staged secret stops the commit] a file name that holds a newline cannot forge a finding line", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  if (process.platform === "win32") return t.skip("file names cannot hold a newline on Windows");
  const repo = newRepo();
  const name = "a\nforged.js: aws-access-key-id";
  put(repo, name, AWS_KEY + "\n");
  git(repo, ["add", "--", name]);
  const res = scan(repo);
  assert.strictEqual(res.status, 1, everything(res));
  const lines = res.stdout.split("\n");
  assert.ok(!lines.some((l) => /^forged\.js:/.test(l)), "a forged finding line appeared: " + res.stdout);
});

test("[FR-217 | 2.4 | Staged secret stops the commit] the scan does not edit files or the index", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  const repo = newRepo();
  put(repo, "k.txt", AWS_KEY + "\n");
  put(repo, "ok.txt", "fine\n");
  stage(repo, ["k.txt", "ok.txt"]);
  const before = git(repo, ["status", "--porcelain"]);
  const contentBefore = fs.readFileSync(path.join(repo, "k.txt"), "utf8");
  const first = scan(repo);
  const second = scan(repo);
  assert.strictEqual(first.status, 1);
  assert.strictEqual(second.status, 1, "a second run gives the same outcome");
  assert.strictEqual(git(repo, ["status", "--porcelain"]), before);
  assert.strictEqual(fs.readFileSync(path.join(repo, "k.txt"), "utf8"), contentBefore);
});

// ---------------------------------------------------------------------------
// FR-217: scanner cannot run (exit 2)
// ---------------------------------------------------------------------------

test("[FR-217 | 2.4 | Scanner unavailable] a directory that is not a git repository exits 2 and reports no finding", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scan-secrets-norepo-"));
  scratch.push(dir);
  put(dir, "k.txt", AWS_KEY + "\n");
  const res = scan(dir, { GIT_CEILING_DIRECTORIES: path.dirname(dir) });
  assert.strictEqual(res.status, 2, everything(res));
  assert.ok(!/k\.txt: \S+/.test(res.stdout), "cannot-run is not a finding: " + res.stdout);
  assertValueAbsent(res, AWS_KEY);
});

test("[FR-217 | 2.4 | Scanner unavailable] git missing from PATH exits 2, never 0", () => {
  const emptyBin = fs.mkdtempSync(path.join(os.tmpdir(), "scan-secrets-nobin-"));
  scratch.push(emptyBin);
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scan-secrets-nogit-"));
  scratch.push(cwd);
  const res = scan(cwd, { PATH: emptyBin });
  assert.strictEqual(res.status, 2, everything(res));
});

test("[FR-217 | 2.4 | Scanner unavailable] a cannot-run exit prints none of git's own error text", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scan-secrets-norepo-"));
  scratch.push(dir);
  const res = scan(dir, { GIT_CEILING_DIRECTORIES: path.dirname(dir) });
  assert.strictEqual(res.status, 2, everything(res));
  assert.ok(!/fatal:/i.test(everything(res)), everything(res));
});

test("[FR-217 | NFR-028 | 2.4 | Scanner unavailable] the exit code is always one of 0, 1, or 2 (a missing working directory entry is not a crash)", (t) => {
  if (!hasGit) return t.skip("git is not installed");
  const repo = newRepo();
  put(repo, "ok.txt", "fine\n");
  stage(repo, ["ok.txt"]);
  fs.rmSync(path.join(repo, "ok.txt"));
  const res = scan(repo);
  assert.ok([0, 1, 2].indexOf(res.status) !== -1, "exit " + res.status + ": " + everything(res));
});
