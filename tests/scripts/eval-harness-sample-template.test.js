// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box structure tests for the COMMITTED parts of the worked-sample template task of the evaluation harness:
// plugins/assist-plugin/evals/dev/sample-template-slugify/ (prompt.md, task.json, rubric.json, graders/, README.md).
// They read committed files only. They never read the private oracle (evals/oracle-local/), so they run in CI and give the
// same result on a checkout that has no oracle-local directory and on one that has it.
//
// Sources: specs/spec-evaluation-harness.md, the 2026-11-26 Change Log delta, Requirement "Worked-sample task as the
// golden-task template" (R-B), and docs/task-plans/task-plan-eval-benchmark-run-20261126-1442.md (Step 4, Step 4b, Step 7).
// Requirement text: docs/requirements/FR-NFR-harness-governance.md (FR-258, FR-261, FR-280, NFR-039).
//
// Traceability format: [AC-N | spec file | FR/NFR ids]. The spec has no SPEC-NNN id, so it is cited by file name.
// AC-N is the position of the Scenario inside Requirement "Worked-sample task as the golden-task template":
//   AC-1 Public parts committed, private parts gitignored    AC-2 Sample marked a template
//   AC-3 Sample public parts pass the package check          AC-5 Production set authored from the sample (task.json fields)
// AC-4 (reference passes its hidden suite) needs the private oracle and is outside this file.
//
// Public API used:
//   - package-check.js: checkPackageFiles(list) returns { ok, offending, error }; the command line prints "clean" or one
//     "oracle path in package: <path>" line per offending path and exits 0 or 1.
//   - task-validator.js: PROVENANCE_VALUES, the provenance values a task may hold.
//   - run-benchmark.js: listCases({ evalsDir, benchmark, suite, caseId }) lists golden tasks; a task whose task.json holds
//     "template": true is left out of a list that names no case and is listed when caseId names it.
//
// Run: node --test tests/scripts/eval-harness-sample-template.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..", "..");
const PLUGIN = path.join(REPO_ROOT, "plugins", "assist-plugin");
const EVALS = path.join(PLUGIN, "evals");
const SAMPLE_ID = "sample-template-slugify";
const SAMPLE = path.join(EVALS, "dev", SAMPLE_ID);
const PACKAGE_CHECK = path.join(PLUGIN, "scripts", "eval-harness", "package-check.js");

const { checkPackageFiles } = require(PACKAGE_CHECK);
const { PROVENANCE_VALUES } = require(path.join(PLUGIN, "scripts", "eval-harness", "task-validator.js"));
const { listCases } = require(path.join(PLUGIN, "scripts", "eval-harness", "run-benchmark.js"));

const created = [];
after(() => {
  created.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-sample-template-test-"));
  created.push(dir);
  return dir;
}

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function isRealDate(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// The ignore entries of evals/.gitignore that name a top-level directory or file. A walk that skips them mirrors the file
// list git gives for a package (git ignores oracle-local/, results/, and the override file).
function ignoredTopLevelNames() {
  return readText(path.join(EVALS, ".gitignore"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#") && !line.startsWith("!"))
    .map((line) => line.replace(/\/$/, ""));
}

// Every file under a directory as a path relative to `base`, in posix form, sorted. Symbolic links are listed, never followed.
function walk(directory, base, skipTopLevel) {
  const found = [];
  function visit(current, top) {
    fs.readdirSync(current).sort().forEach((name) => {
      if (top && skipTopLevel.indexOf(name) !== -1) {
        return;
      }
      const absolute = path.join(current, name);
      if (fs.lstatSync(absolute).isDirectory()) {
        visit(absolute, false);
        return;
      }
      found.push(path.relative(base, absolute).split(path.sep).join("/"));
    });
  }
  visit(directory, true);
  return found;
}

function committedEvalsFiles() {
  return walk(EVALS, PLUGIN, ignoredTopLevelNames()).map((relative) => "plugins/assist-plugin/" + relative);
}

function sampleFiles() {
  return walk(SAMPLE, SAMPLE, []);
}

function frontMatterOf(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  return match ? { block: match[1], body: text.slice(match[0].length) } : null;
}

function runPackageCheck(input) {
  const result = childProcess.spawnSync(process.execPath, [PACKAGE_CHECK], { encoding: "utf8", input, timeout: 30000 });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const PUBLIC_FILES = ["prompt.md", "task.json", "rubric.json", "README.md"];

// [AC-1 | spec-evaluation-harness | FR-258] The four public parts exist under evals/<suite>/<sample>/.
test("[AC-1 | spec-evaluation-harness | FR-258] the sample directory holds prompt.md, task.json, rubric.json, and README.md", () => {
  PUBLIC_FILES.forEach((name) => {
    const file = path.join(SAMPLE, name);
    assert.ok(fs.statSync(file).isFile(), name + " must be a file");
    assert.ok(readText(file).trim().length > 0, name + " must not be empty");
  });
});

test("[AC-1 | spec-evaluation-harness | FR-258] the sample holds a graders folder with at least one grader file", () => {
  const graders = path.join(SAMPLE, "graders");
  assert.ok(fs.statSync(graders).isDirectory(), "graders/ must be a directory");
  const files = fs.readdirSync(graders).filter((name) => fs.statSync(path.join(graders, name)).isFile());
  assert.ok(files.length >= 1, "graders/ must hold at least one file");
  files.forEach((name) => assert.ok(readText(path.join(graders, name)).trim().length > 0, name + " must not be empty"));
});

test("[AC-1 | spec-evaluation-harness | FR-258] the sample sits under the dev suite and its case id is a plain identifier", () => {
  assert.equal(path.basename(path.dirname(SAMPLE)), "dev");
  assert.match(SAMPLE_ID, /^[A-Za-z0-9][A-Za-z0-9._-]*$/);
});

test("[AC-1 | spec-evaluation-harness | FR-261] the sample directory holds no directory named reference or hidden", () => {
  const directories = [];
  (function visit(current) {
    fs.readdirSync(current).forEach((name) => {
      const absolute = path.join(current, name);
      if (fs.lstatSync(absolute).isDirectory()) {
        directories.push(name.toLowerCase());
        visit(absolute);
      }
    });
  })(SAMPLE);
  assert.equal(directories.indexOf("reference"), -1);
  assert.equal(directories.indexOf("hidden"), -1);
});

test("[AC-1 | spec-evaluation-harness | FR-261] evals/.gitignore ignores oracle-local and the uncommitted override file", () => {
  const entries = ignoredTopLevelNames();
  assert.ok(entries.indexOf("oracle-local") !== -1, "oracle-local/ must be ignored");
  assert.ok(entries.indexOf("harness.config.local.json") !== -1, "harness.config.local.json must be ignored");
});

// [AC-5 | spec-evaluation-harness | FR-258] task.json carries the required keys, in-house provenance, and the template marker.
test("[AC-5 | spec-evaluation-harness | FR-258] task.json is a JSON object with the required keys", () => {
  const meta = readJson(path.join(SAMPLE, "task.json"));
  assert.ok(meta !== null && typeof meta === "object" && !Array.isArray(meta));
  ["description", "provenance", "creation_date", "valid_against_cutoff", "held_out", "template"].forEach((key) => {
    assert.ok(Object.prototype.hasOwnProperty.call(meta, key), "task.json must hold " + key);
  });
  assert.equal(typeof meta.description, "string");
  assert.ok(meta.description.trim().length > 0);
});

test("[AC-5 | spec-evaluation-harness | FR-258] task.json provenance is in-house and an allowed provenance value", () => {
  const meta = readJson(path.join(SAMPLE, "task.json"));
  assert.strictEqual(meta.provenance, "in-house");
  assert.ok(PROVENANCE_VALUES.indexOf(meta.provenance) !== -1);
});

test("[AC-5 | spec-evaluation-harness | FR-258] task.json holds real YYYY-MM-DD dates for creation and cutoff", () => {
  const meta = readJson(path.join(SAMPLE, "task.json"));
  assert.ok(isRealDate(meta.creation_date), "creation_date must be a real YYYY-MM-DD date");
  assert.ok(isRealDate(meta.valid_against_cutoff), "valid_against_cutoff must be a real YYYY-MM-DD date");
});

test("[AC-2 | spec-evaluation-harness | FR-258] task.json marks the sample a template with the boolean true", () => {
  const meta = readJson(path.join(SAMPLE, "task.json"));
  assert.strictEqual(meta.template, true);
});

test("[AC-5 | spec-evaluation-harness | FR-258] task.json holds a boolean held_out flag and leaves the sample unheld", () => {
  const meta = readJson(path.join(SAMPLE, "task.json"));
  assert.strictEqual(typeof meta.held_out, "boolean");
  assert.strictEqual(meta.held_out, false);
});

// [AC-1 | spec-evaluation-harness | FR-258] rubric.json keeps the two groups apart.
test("[AC-1 | spec-evaluation-harness | FR-258] rubric.json holds separate deterministic and subjective arrays", () => {
  const rubric = readJson(path.join(SAMPLE, "rubric.json"));
  assert.ok(Array.isArray(rubric.deterministic), "deterministic must be an array");
  assert.ok(Array.isArray(rubric.subjective), "subjective must be an array");
  assert.equal(Object.prototype.hasOwnProperty.call(rubric, "items"), false, "no mixed items list");
});

test("[AC-1 | spec-evaluation-harness | FR-258] rubric.json deterministic items each carry an id and a description", () => {
  const rubric = readJson(path.join(SAMPLE, "rubric.json"));
  assert.ok(rubric.deterministic.length >= 1);
  rubric.deterministic.forEach((item) => {
    assert.equal(typeof item.id, "string");
    assert.ok(item.id.length > 0);
    assert.equal(typeof item.description, "string");
    assert.ok(item.description.length > 0);
    assert.ok(item.kind !== "subjective" && item.type !== "subjective", "no subjective item in the deterministic group");
  });
  rubric.subjective.forEach((item) => {
    assert.ok(item.kind !== "deterministic" && item.type !== "deterministic", "no deterministic item in the subjective group");
  });
});

// [AC-1 | spec-evaluation-harness | FR-258] prompt.md keeps the claude plugin eval case layout.
test("[AC-1 | spec-evaluation-harness | FR-258] prompt.md has front matter with the run settings and a non-empty body", () => {
  const parsed = frontMatterOf(readText(path.join(SAMPLE, "prompt.md")));
  assert.ok(parsed !== null, "prompt.md must open with front matter");
  ["max_turns", "timeout_seconds", "allowed_tools", "runs"].forEach((key) => {
    assert.match(parsed.block, new RegExp("^" + key + ":", "m"), "front matter must hold " + key);
  });
  assert.ok(parsed.body.trim().length > 0);
});

test("[AC-1 | spec-evaluation-harness | FR-258] prompt.md names the file the candidate creates", () => {
  const body = readText(path.join(SAMPLE, "prompt.md"));
  assert.ok(body.indexOf("slugify.js") !== -1);
});

test("[AC-1 | spec-evaluation-harness | FR-258] every grader file has front matter with a type and a pattern that compiles", () => {
  const graders = path.join(SAMPLE, "graders");
  fs.readdirSync(graders).forEach((name) => {
    const parsed = frontMatterOf(readText(path.join(graders, name)));
    assert.ok(parsed !== null, name + " must open with front matter");
    assert.match(parsed.block, /^type:\s*\S+/m, name + " must name a grader type");
    if (/^type:\s*regex\s*$/m.test(parsed.block)) {
      const pattern = parsed.body.trim();
      assert.ok(pattern.length > 0, name + " must hold a pattern");
      assert.doesNotThrow(() => new RegExp(pattern), name + " pattern must compile");
    }
  });
});

test("[AC-1 | spec-evaluation-harness | FR-258] the smoke grader accepts a final message that names slugify.js", () => {
  const parsed = frontMatterOf(readText(path.join(SAMPLE, "graders", "names-slugify-file.md")));
  assert.ok(parsed !== null);
  const pattern = new RegExp(parsed.body.trim());
  assert.ok(pattern.test("I created the file slugify.js in the working directory."));
  assert.equal(pattern.test("I made a helper."), false);
});

// [AC-2 | spec-evaluation-harness | FR-258] The README marks the sample a template excluded from production scoring.
test("[AC-2 | spec-evaluation-harness | FR-258] README.md marks the sample a template", () => {
  const readme = readText(path.join(SAMPLE, "README.md"));
  assert.match(readme, /\btemplate\b/i);
});

test("[AC-2 | spec-evaluation-harness | FR-258] README.md states the sample is excluded from production benchmark scoring", () => {
  const readme = readText(path.join(SAMPLE, "README.md")).replace(/\s+/g, " ");
  assert.match(readme, /excluded from production benchmark scoring/i);
});

test("[AC-5 | spec-evaluation-harness | FR-258] README.md holds the authoring checklist items for the production set", () => {
  const readme = readText(path.join(SAMPLE, "README.md")).replace(/\s+/g, " ");
  assert.match(readme, /1 to 3 in-house tasks/i);
  assert.match(readme, /held out/i);
});

// [AC-3 | spec-evaluation-harness | FR-261] The committed public parts pass the package check.
test("[AC-3 | spec-evaluation-harness | FR-261] checkPackageFiles reports clean for the sample's public files", () => {
  const list = sampleFiles().map((relative) => "plugins/assist-plugin/evals/dev/" + SAMPLE_ID + "/" + relative);
  assert.ok(list.length >= 5, "the sample holds at least its five public files");
  const result = checkPackageFiles(list);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.offending, []);
  assert.equal(result.error, null);
});

test("[AC-3 | spec-evaluation-harness | FR-261] the sample's five public files are in the committed evals file list", () => {
  const files = committedEvalsFiles();
  [
    "prompt.md",
    "task.json",
    "rubric.json",
    "README.md",
    "graders/names-slugify-file.md",
  ].forEach((relative) => {
    assert.ok(files.indexOf("plugins/assist-plugin/evals/dev/" + SAMPLE_ID + "/" + relative) !== -1, relative + " must be listed");
  });
});

test("[AC-3 | spec-evaluation-harness | NFR-039] the committed evals file list holds no oracle-local path", () => {
  const offending = committedEvalsFiles().filter((entry) => entry.split("/").indexOf("oracle-local") !== -1);
  assert.deepStrictEqual(offending, []);
});

test("[AC-3 | spec-evaluation-harness | FR-261] checkPackageFiles reports clean for the whole committed evals file list", () => {
  const result = checkPackageFiles(committedEvalsFiles());
  assert.deepStrictEqual(result.offending, []);
  assert.strictEqual(result.ok, true);
});

test("[AC-3 | spec-evaluation-harness | FR-261] package-check.js prints clean and exits 0 for the sample's public files", () => {
  const list = sampleFiles().map((relative) => "plugins/assist-plugin/evals/dev/" + SAMPLE_ID + "/" + relative);
  const result = runPackageCheck(list.join("\n") + "\n");
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout.trim(), "clean");
});

test("[AC-3 | spec-evaluation-harness | FR-261] package-check.js names the reference and hidden paths when the oracle paths are listed", () => {
  const base = "plugins/assist-plugin/evals/oracle-local/dev/" + SAMPLE_ID;
  const oracle = [base + "/reference/slugify.js", base + "/hidden/slugify.test.js"];
  const publicList = sampleFiles().map((relative) => "plugins/assist-plugin/evals/dev/" + SAMPLE_ID + "/" + relative);
  const result = runPackageCheck(publicList.concat(oracle).join("\n") + "\n");
  assert.strictEqual(result.status, 1);
  oracle.forEach((entry) => assert.ok(result.stdout.indexOf(entry) !== -1, entry + " must be named"));
});

test("[AC-3 | spec-evaluation-harness | FR-261] checkPackageFiles flags oracle paths added to the sample's public list", () => {
  const publicList = sampleFiles().map((relative) => "plugins/assist-plugin/evals/dev/" + SAMPLE_ID + "/" + relative);
  const leaked = "plugins/assist-plugin/evals/dev/" + SAMPLE_ID + "/hidden/slugify.test.js";
  const result = checkPackageFiles(publicList.concat([leaked]));
  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(result.offending, [leaked]);
});

// [AC-1 | spec-evaluation-harness | NFR-039] The committed sample holds no reference or hidden-suite content.
test("[AC-1 | spec-evaluation-harness | NFR-039] the sample holds no JavaScript or test file", () => {
  const code = sampleFiles().filter((relative) => /\.(?:js|mjs|cjs|ts)$/.test(relative) || /\.test\./.test(relative));
  assert.deepStrictEqual(code, []);
});

test("[AC-1 | spec-evaluation-harness | NFR-039] no committed sample file holds hidden-suite text", () => {
  sampleFiles().forEach((relative) => {
    const text = readText(path.join(SAMPLE, relative));
    assert.doesNotMatch(text, /require\(\s*["']\.\/slugify(?:\.js)?["']\s*\)/, relative + " must not load the candidate like a hidden test");
    assert.doesNotMatch(text, /node:test|node:assert/, relative + " must not hold test-runner code");
    assert.doesNotMatch(text, /\bassert\.(?:equal|strictEqual|throws|deepStrictEqual)\b/, relative + " must not hold assertions");
    assert.doesNotMatch(text, /\[AC-\d+ \| [A-Za-z0-9._-]+ \| (?:N?FR)-\d+/, relative + " must not hold a hidden test name");
  });
});

test("[AC-1 | spec-evaluation-harness | NFR-039] no committed sample file holds reference solution code", () => {
  sampleFiles().forEach((relative) => {
    const text = readText(path.join(SAMPLE, relative));
    assert.doesNotMatch(text, /function\s+slugify\s*\(/, relative + " must not define slugify");
    assert.doesNotMatch(text, /\bslugify\s*=\s*(?:function|\()/, relative + " must not define slugify");
    assert.doesNotMatch(text, /\.replace\(\s*\//, relative + " must not hold a replace call");
    assert.doesNotMatch(text, /\.toLowerCase\(\)/, relative + " must not hold solution code");
    assert.doesNotMatch(text, /\[\^a-z0-9\]/, relative + " must not hold the solution pattern");
  });
});

test("[AC-1 | spec-evaluation-harness | NFR-039] the prompt, which reaches the agent workspace, holds no private path", () => {
  const prompt = readText(path.join(SAMPLE, "prompt.md"));
  assert.doesNotMatch(prompt, /oracle-local/);
  assert.doesNotMatch(prompt, /ASSIST_EVAL_ORACLE_DIR/);
  assert.doesNotMatch(prompt, /harness\.config\.local/);
});

test("[AC-1 | spec-evaluation-harness | NFR-039] no committed sample file holds a machine path or a private URL", () => {
  sampleFiles().forEach((relative) => {
    const text = readText(path.join(SAMPLE, relative));
    assert.doesNotMatch(text, /(?:^|[\s"'(])\/(?:home|Users|root|tmp|var|mnt)\//, relative + " must hold no absolute machine path");
    assert.doesNotMatch(text, /[A-Za-z]:\\/, relative + " must hold no drive path");
    assert.doesNotMatch(text, /https?:\/\//i, relative + " must hold no URL");
  });
});

// [AC-2 | spec-evaluation-harness | FR-280] The harness list function leaves the template out of an unfiltered list.
test("[AC-2 | spec-evaluation-harness | FR-280] an unfiltered list leaves the sample out, with and without benchmark mode", () => {
  [{ evalsDir: EVALS }, { evalsDir: EVALS, benchmark: true }, { evalsDir: EVALS, suite: "dev" }, { evalsDir: EVALS, suite: "dev", benchmark: true }].forEach((options) => {
    const ids = listCases(options).map((entry) => entry.caseId);
    assert.equal(ids.indexOf(SAMPLE_ID), -1, "template listed for " + JSON.stringify(options));
  });
});

test("[AC-2 | spec-evaluation-harness | FR-280] naming the sample's case id lists it once, under the dev suite", () => {
  [{ evalsDir: EVALS, caseId: SAMPLE_ID }, { evalsDir: EVALS, caseId: SAMPLE_ID, benchmark: true }, { evalsDir: EVALS, caseId: SAMPLE_ID, suite: "dev" }].forEach((options) => {
    const found = listCases(options);
    assert.equal(found.length, 1, "expected one case for " + JSON.stringify(options));
    assert.equal(found[0].suite, "dev");
    assert.equal(found[0].caseId, SAMPLE_ID);
    assert.equal(path.resolve(found[0].taskDir), path.resolve(SAMPLE));
    assert.equal(found[0].heldOut, false);
  });
});

test("[AC-2 | spec-evaluation-harness | FR-280] the sample is the only template case under the committed evals directory", () => {
  const templates = [];
  ["dev", "spec"].forEach((suite) => {
    const suiteDir = path.join(EVALS, suite);
    if (!fs.existsSync(suiteDir)) {
      return;
    }
    fs.readdirSync(suiteDir).forEach((name) => {
      const file = path.join(suiteDir, name, "task.json");
      if (fs.existsSync(file) && readJson(file).template === true) {
        templates.push(suite + "/" + name);
      }
    });
  });
  assert.deepStrictEqual(templates, ["dev/" + SAMPLE_ID]);
});

// [AC-2 | spec-evaluation-harness | FR-280] Fixture control: the same list function excludes a template in a temporary evals tree.
test("[AC-2 | spec-evaluation-harness | FR-280] a copy of the sample's public files in a temporary tree is also left out of an unfiltered list", () => {
  const evalsDir = tmpDir();
  const target = path.join(evalsDir, "dev", SAMPLE_ID);
  fs.mkdirSync(target, { recursive: true });
  fs.copyFileSync(path.join(SAMPLE, "task.json"), path.join(target, "task.json"));
  fs.copyFileSync(path.join(SAMPLE, "prompt.md"), path.join(target, "prompt.md"));
  assert.deepStrictEqual(listCases({ evalsDir }), []);
  assert.deepStrictEqual(listCases({ evalsDir, benchmark: true }), []);
  assert.deepStrictEqual(listCases({ evalsDir, caseId: SAMPLE_ID }).map((entry) => entry.caseId), [SAMPLE_ID]);
});
