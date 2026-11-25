// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the benchmark entry of the evaluation harness (Group A, Step 17):
// plugins/assist-plugin/scripts/eval-harness/run-benchmark.js (`runBenchmark(options)`, `listCases(options)`,
// `collectOutputText(workspaceDir, before)`, `loadSettings(configPath)`, `gitPackageFiles(repoRoot, pluginRoot)`).
//
// Sources: specs/spec-evaluation-harness.md (Requirement: Benchmark section and release-over-release comparison, Scenarios
// Requested run, Held-out case excluded from an ordinary eval run, Held-out case included in the release benchmark;
// Requirement: Private oracle resolution and withholding; Error handling), and
// docs/task-plans/task-plan-evaluation-harness-20261125-0717.md (ASM-1, ASM-2, ASM-7, Step 12, Step 17). Requirement text:
// docs/requirements/FR-NFR-harness-governance.md (FR-259, FR-260, FR-261, FR-263, FR-274, FR-277, FR-280, NFR-038, NFR-039,
// UR-079, UR-080).
//
// Traceability format: [AC-N | spec file | FR/NFR ids | UR ids]. The spec has no SPEC-NNN id, so it is cited by file
// name. AC-N is the position of the Scenario inside its Requirement block:
//   Benchmark section and release-over-release comparison (R9): AC-4 Requested run, AC-9 Drop beyond the margin, AC-16
//   Held-out case excluded from an ordinary eval run, AC-17 Held-out case included in the release benchmark.
//   Private oracle resolution and withholding (R4): AC-1 Agent workspace holds no oracle, AC-2 Leak detected before the
//   run, AC-4 Oracle path in the published package, AC-5 Private oracle location unreachable.
//   Coding run scoring (R5): AC-3 Sandbox backend absent.
//
// Contract used:
//   - runBenchmark runs the whole benchmark through injected adapters (runner, sandboxProbe, listPackageFiles,
//     judgeAdapter, agentFamily) and returns { exitCode, findings, notes }: 0 no finding, 1 a finding (a regression, or an
//     oracle path in the package), 2 an operational error (an unset configuration number, an unreachable oracle, a
//     leak, a refused task). It prints the run count and the case count before the first run and the estimated cost.
//   - A task flagged held_out in task.json is left out of an ordinary list (listCases with benchmark false) and included on
//     a benchmark request. The benchmark entry itself is a benchmark request.
//   - The runner is `claude plugin eval`, which is unverified here (B3), so every test injects a stub runner: no test starts
//     the real runner, makes a model call, or spends model cost. Held-out exclusion by the real runner and the real
//     sandbox-absent signal are pending B3 and are driven through the harness's own list function and the sandboxProbe
//     adapter.
//   - All fixtures (a plugin tree of golden tasks, a private location, a configuration) are synthetic stand-ins built
//     under os.tmpdir(). No real oracle content is committed (ASM-1).
//
// Run: node --test tests/scripts/eval-harness-run-benchmark.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLUGIN = path.join(__dirname, "..", "..", "plugins", "assist-plugin");
const benchmark = require(path.join(PLUGIN, "scripts", "eval-harness", "run-benchmark.js"));
const scoreboardModule = require(path.join(PLUGIN, "scripts", "eval-harness", "scoreboard.js"));

const SENTINEL = "ORACLE-SENTINEL-4409-DO-NOT-STORE";
const PASSING_SOLUTION = "module.exports = { add: function (a, b) { return a + b; } };\n";
const FAILING_SOLUTION = "module.exports = { add: function (a, b) { return a - b; } };\n";
const SPEC_OUTPUT = [
  "### Requirement: Login",
  "The system SHALL let a registered user log in.",
  "",
  "#### Scenario: Valid login",
  "- **GIVEN** a registered user",
  "- **WHEN** the user submits valid credentials",
  "- **THEN** the system SHALL open a session",
  "",
].join("\n");

const created = [];
after(() => {
  created.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-benchmark-test-"));
  created.push(dir);
  return dir;
}

function put(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function hiddenSuiteSource() {
  return (
    "// " + SENTINEL + "\n" +
    'const { test } = require("node:test");\n' +
    'const assert = require("node:assert");\n' +
    'const { add } = require("./solution.js");\n' +
    'test("[AC-1 | spec-demo | FR-1] adds two numbers", () => { assert.strictEqual(add(2, 3), 5); });\n'
  );
}

const VALID_META = { provenance: "in-house", creation_date: "2026-11-01", valid_against_cutoff: "2026-06-30" };
const SPEC_RUBRIC = {
  deterministic: [{ id: "has-scenario", source: "spec-from-requirements:completeness", check: "every-requirement-has-scenario" }],
  subjective: [{ id: "clarity", text: "The spec reads clearly" }],
};

// Builds a synthetic repository: a plugin tree of public golden tasks, a private oracle location, a configuration file, and
// paths for the scoreboard and the results. Test-example numbers: 2 runs per case, margin 0.05, 1 reference run.
function buildWorld(options) {
  const settings = Object.assign(
    {
      devCases: ["case-a"],
      heldOutCases: ["case-h"],
      specCases: ["case-s"],
      meta: VALID_META,
      referenceSource: PASSING_SOLUTION,
      config: {},
      extraPublic: null,
    },
    options || {}
  );
  const root = tmpDir();
  const pluginRoot = path.join(root, "plugin");
  const privateRoot = path.join(root, "private-oracle");
  settings.devCases.concat(settings.heldOutCases).forEach((caseId) => {
    const held = settings.heldOutCases.indexOf(caseId) !== -1;
    const taskDir = path.join(pluginRoot, "evals", "dev", caseId);
    put(path.join(taskDir, "prompt.md"), "Do the task.\n");
    put(path.join(taskDir, "graders", "grader.json"), "{}\n");
    put(path.join(taskDir, "task.json"), JSON.stringify(Object.assign({}, settings.meta, held ? { held_out: true } : {})));
    put(path.join(privateRoot, "dev", caseId, "reference", "solution.js"), settings.referenceSource);
    put(path.join(privateRoot, "dev", caseId, "hidden", "solution.test.js"), hiddenSuiteSource());
    if (settings.extraPublic) {
      settings.extraPublic(taskDir);
    }
  });
  settings.specCases.forEach((caseId) => {
    const taskDir = path.join(pluginRoot, "evals", "spec", caseId);
    put(path.join(taskDir, "prompt.md"), "Do the task.\n");
    put(path.join(taskDir, "graders", "grader.json"), "{}\n");
    put(path.join(taskDir, "task.json"), JSON.stringify(settings.meta));
    put(path.join(taskDir, "rubric.json"), JSON.stringify(SPEC_RUBRIC));
    put(path.join(privateRoot, "spec", caseId, "reference", "ref.md"), "# Reference requirements\n");
  });
  fs.mkdirSync(pluginRoot, { recursive: true });
  const configPath = path.join(root, "harness.config.json");
  put(
    configPath,
    JSON.stringify(
      Object.assign(
        {
          oracleLocation: privateRoot,
          runCount: 2,
          regressionMargin: 0.05,
          referenceValidationRuns: 1,
          judgeRuns: 2,
          newTasksPerRelease: 1,
          retryOnFailure: 0,
          judgeEnabled: false,
          judgeAgreementFloor: { spearmanRho: 0.7, cohenKappa: 0.6, label: "provisional, no empirical basis yet" },
          labeledSamplePath: null,
        },
        settings.config
      )
    )
  );
  return {
    root,
    pluginRoot,
    privateRoot,
    configPath,
    scoreboardPath: path.join(root, "scoreboard.json"),
    resultsDir: path.join(root, "results"),
  };
}

function aggregateJson(version) {
  return { suite: { plugins: [{ name: "assist-plugin", version }] }, costUsd: 0.5, durationSeconds: 3, cases: [] };
}

// A stub of `claude plugin eval`: it writes the agent's output into the prepared workspace and returns an aggregate.
function makeRunner(options) {
  const settings = Object.assign({ solution: PASSING_SOLUTION, version: "1.14.7" }, options || {});
  const calls = [];
  const runner = (request) => {
    calls.push({ suite: request.suite, caseId: request.caseId, workspaceEntries: fs.readdirSync(request.workspaceDir) });
    if (request.suite === "dev") {
      fs.writeFileSync(path.join(request.workspaceDir, "solution.js"), settings.solution);
    } else {
      fs.writeFileSync(path.join(request.workspaceDir, "spec-output.md"), SPEC_OUTPUT);
    }
    return { ok: true, aggregate: aggregateJson(settings.version), run: { needsShellGrant: request.suite === "dev", sandboxAvailable: true } };
  };
  runner.calls = calls;
  return runner;
}

function go(world, extra) {
  const lines = [];
  const runner = (extra && extra.runner) || makeRunner();
  const result = benchmark.runBenchmark(
    Object.assign(
      {
        repoRoot: world.root,
        pluginRoot: world.pluginRoot,
        configPath: world.configPath,
        scoreboardPath: world.scoreboardPath,
        resultsDir: world.resultsDir,
        out: (line) => lines.push(line),
        logger: () => {},
        runner,
        listPackageFiles: () => ({ ok: true, files: ["plugin/agents/developer.md", "plugin/evals/dev/case-a/prompt.md"] }),
        now: new Date("2026-11-25T08:00:00.000Z"),
      },
      extra || {}
    )
  );
  return { result, lines, runner };
}

function readBoard(world) {
  const read = scoreboardModule.readScoreboard(world.scoreboardPath);
  assert.strictEqual(read.ok, true, JSON.stringify(read));
  return read.scoreboard;
}

function seedPrevious(world, passAtOne) {
  const written = scoreboardModule.writeEntries({
    scoreboardPath: world.scoreboardPath,
    aggregates: [{ version: "1.14.6", suite: "dev", harnessVersion: "1.0.0", passAtOne, caseCount: 1 }],
    cases: [{ version: "1.14.6", suite: "dev", caseId: "case-a", harnessVersion: "1.0.0", passAtOne, k: 2, c: 2, runCount: 2 }],
  });
  assert.strictEqual(written.ok, true, JSON.stringify(written));
}

// ---------------------------------------------------------------------------
// AC-16 and AC-17: held-out cases
// ---------------------------------------------------------------------------

test("[AC-16 | spec-evaluation-harness | FR-280 | UR-080] an ordinary case list leaves out a case flagged held-out", () => {
  const world = buildWorld();
  const listed = benchmark.listCases({ evalsDir: path.join(world.pluginRoot, "evals"), benchmark: false });
  const ids = listed.map((entry) => entry.suite + "/" + entry.caseId);
  assert.deepStrictEqual(ids, ["dev/case-a", "spec/case-s"]);
  assert.ok(!ids.includes("dev/case-h"), "the held-out case was listed in an ordinary run");
});

test("[AC-16 | spec-evaluation-harness | FR-280 | UR-080] a case list with no benchmark option is an ordinary list and leaves out the held-out case", () => {
  // Null/empty: no option at all reads as an ordinary list.
  const world = buildWorld();
  const listed = benchmark.listCases({ evalsDir: path.join(world.pluginRoot, "evals") });
  assert.ok(!listed.some((entry) => entry.caseId === "case-h"));
});

test("[AC-17 | spec-evaluation-harness | FR-280 | UR-080] a case list for a benchmark request includes the held-out case and marks it held-out", () => {
  const world = buildWorld();
  const listed = benchmark.listCases({ evalsDir: path.join(world.pluginRoot, "evals"), benchmark: true });
  const held = listed.find((entry) => entry.caseId === "case-h");
  assert.ok(held, "the held-out case is missing from a benchmark list");
  assert.strictEqual(held.suite, "dev");
  assert.strictEqual(held.heldOut, true);
  assert.strictEqual(listed.find((entry) => entry.caseId === "case-a").heldOut, false);
});

test("[AC-16 | spec-evaluation-harness | FR-280 | UR-080] the case list can be limited to one suite or one case", () => {
  const world = buildWorld();
  const evalsDir = path.join(world.pluginRoot, "evals");
  assert.deepStrictEqual(benchmark.listCases({ evalsDir, benchmark: true, suite: "spec" }).map((entry) => entry.caseId), ["case-s"]);
  assert.deepStrictEqual(benchmark.listCases({ evalsDir, benchmark: true, caseId: "case-h" }).map((entry) => entry.caseId), ["case-h"]);
});

test("[AC-16 | spec-evaluation-harness | FR-280 | UR-080] a case list of a folder with no tasks is empty", () => {
  // Null/empty.
  assert.deepStrictEqual(benchmark.listCases({ evalsDir: path.join(tmpDir(), "none"), benchmark: true }), []);
});

test("[AC-17 | spec-evaluation-harness | FR-280 | FR-274 | UR-080] the benchmark run includes the held-out case in the cases it runs and scores", () => {
  const world = buildWorld();
  const { result, runner } = go(world);
  assert.strictEqual(result.exitCode, 0, JSON.stringify(result));
  assert.ok(runner.calls.some((call) => call.caseId === "case-h"), "the runner never ran the held-out case");
  const stored = scoreboardModule.casesFor(readBoard(world), "1.14.7", "dev").map((entry) => entry.caseId).sort();
  assert.deepStrictEqual(stored, ["case-a", "case-h"]);
});

test("[AC-17 | spec-evaluation-harness | FR-280 | UR-080] a task with a held_out flag that is not true or false is not admitted to the run", () => {
  // Type mismatch: the task is rejected, so the run does not hold a half-flagged case.
  const world = buildWorld({ heldOutCases: [] });
  const taskJson = path.join(world.pluginRoot, "evals", "dev", "case-a", "task.json");
  put(taskJson, JSON.stringify(Object.assign({}, VALID_META, { held_out: "yes" })));
  const { runner, lines } = go(world);
  assert.ok(!runner.calls.some((call) => call.caseId === "case-a"));
  assert.ok(lines.some((line) => /^rejected: dev\/case-a/.test(line)), JSON.stringify(lines));
});

// ---------------------------------------------------------------------------
// AC-4: a requested run
// ---------------------------------------------------------------------------

test("[AC-4 | spec-evaluation-harness | FR-274 | FR-263 | UR-079] a requested run prints the case count and the run count before the first run", () => {
  const world = buildWorld();
  const { lines, runner } = go(world);
  const announce = lines.findIndex((line) => /3 case/.test(line) && /2 run/.test(line));
  assert.ok(announce !== -1, "no line states 3 cases and 2 runs: " + JSON.stringify(lines));
  assert.ok(lines.some((line) => /\$25 to \$75/.test(line) && /estimate/i.test(line)), "the estimated cost is not printed as an estimate");
  assert.ok(runner.calls.length > 0);
});

test("[AC-4 | spec-evaluation-harness | FR-274 | FR-263 | UR-079] every admitted case runs once per configured run through the injected runner and nothing else", () => {
  const world = buildWorld();
  const { runner } = go(world);
  // 3 cases (dev/case-a, dev/case-h, spec/case-s) at 2 runs each.
  assert.strictEqual(runner.calls.length, 6);
  ["dev/case-a", "dev/case-h", "spec/case-s"].forEach((id) => {
    assert.strictEqual(runner.calls.filter((call) => call.suite + "/" + call.caseId === id).length, 2, id);
  });
});

test("[AC-4 | spec-evaluation-harness | FR-274 | UR-079] a requested run writes the version-keyed result, the scoreboard rows, and reports the benchmark version and suites", () => {
  const world = buildWorld();
  const { result, lines } = go(world);
  assert.strictEqual(result.exitCode, 0, JSON.stringify(lines));
  assert.ok(lines.includes("benchmark-version: 1.14.7"), JSON.stringify(lines));
  assert.ok(lines.includes("benchmark-suites: dev,spec"), JSON.stringify(lines));
  const board = readBoard(world);
  ["dev", "spec"].forEach((suite) => {
    assert.strictEqual(board.aggregates.filter((row) => row.version === "1.14.7" && row.suite === suite).length, 1, suite);
  });
  const stored = fs.readdirSync(world.resultsDir);
  assert.strictEqual(stored.length, 1);
  assert.ok(stored[0].includes("1.14.7"), stored[0]);
});

test("[AC-4 | spec-evaluation-harness | FR-274 | NFR-038 | UR-079] the stored run result holds the summed cost and the summed elapsed time of every runner run", () => {
  const world = buildWorld();
  go(world);
  const file = path.join(world.resultsDir, fs.readdirSync(world.resultsDir)[0]);
  const stored = JSON.parse(fs.readFileSync(file, "utf8"));
  // 6 runner runs at 0.5 USD and 3 seconds each.
  assert.strictEqual(stored.costUsd, 3);
  assert.strictEqual(stored.elapsedSeconds, 18);
  assert.strictEqual(stored.pluginVersion, "1.14.7");
});

test("[AC-4 | spec-evaluation-harness | FR-271 | FR-272 | UR-078] a coding case that passes every run states pass@1 of 1 with k, c, and the harness version", () => {
  const world = buildWorld();
  const { lines } = go(world);
  const line = lines.find((entry) => entry.indexOf("dev/case-a:") === 0);
  assert.ok(line, JSON.stringify(lines));
  assert.ok(line.includes("pass@1 1"), line);
  assert.ok(/k=2/.test(line) && /c=2/.test(line) && /harness/.test(line), line);
});

test("[AC-4 | spec-evaluation-harness | FR-265 | FR-270 | UR-078] a spec case reports its structural score and a judge score that reads absent when no judge adapter is given", () => {
  const world = buildWorld();
  go(world);
  const spec = scoreboardModule.casesFor(readBoard(world), "1.14.7", "spec")[0];
  assert.strictEqual(spec.caseId, "case-s");
  assert.strictEqual(spec.structuralScore, 1);
  assert.strictEqual(spec.judgeScore, null);
});

test("[AC-4 | spec-evaluation-harness | FR-268 | FR-269 | UR-078] with the judge configured and a stub judge adapter the spec case holds the stub's judge score beside the structural score", () => {
  const world = buildWorld({ config: { judgeEnabled: true, judgeRuns: 2 } });
  const calls = [];
  const adapter = {
    family: "family-alpha",
    isAvailable: () => true,
    score: (call) => {
      calls.push(call);
      return { ok: true, score: 0.5 };
    },
  };
  const { result } = go(world, { judgeAdapter: adapter, agentFamily: "family-alpha" });
  assert.strictEqual(result.exitCode, 0, JSON.stringify(result));
  assert.ok(calls.length > 0, "the judge adapter was never called");
  const spec = scoreboardModule.casesFor(readBoard(world), "1.14.7", "spec")[0];
  assert.strictEqual(spec.structuralScore, 1);
  assert.strictEqual(spec.judgeScore, 0.5);
});

test("[AC-4 | spec-evaluation-harness | FR-268 | UR-078] with the judge configured and no judge adapter the spec case reads judge absent and the run still completes", () => {
  const world = buildWorld({ config: { judgeEnabled: true, judgeRuns: 2 } });
  const { result } = go(world);
  assert.strictEqual(result.exitCode, 0, JSON.stringify(result));
  const spec = scoreboardModule.casesFor(readBoard(world), "1.14.7", "spec")[0];
  assert.strictEqual(spec.judgeScore, null);
  assert.strictEqual(spec.structuralScore, 1);
});

// ---------------------------------------------------------------------------
// AC-1 and AC-2: workspace withholding and leak abort
// ---------------------------------------------------------------------------

test("[AC-1 | spec-evaluation-harness | FR-260 | UR-080] the agent workspace the runner receives holds no reference or hidden-suite entry", () => {
  const world = buildWorld();
  const { runner } = go(world);
  assert.ok(runner.calls.length > 0);
  runner.calls.forEach((call) => {
    call.workspaceEntries.forEach((entry) => {
      assert.ok(!/^(reference|hidden)$/i.test(entry), "the workspace held " + entry);
      assert.ok(!/\.test\.js$/.test(entry), "the workspace held a test file: " + entry);
    });
  });
});

test("[AC-2 | spec-evaluation-harness | FR-260 | UR-080] a prepared workspace that holds a copy of an oracle file aborts the run before it starts and names the leaked path", () => {
  const world = buildWorld({
    heldOutCases: [],
    specCases: [],
    extraPublic: (taskDir) => put(path.join(taskDir, "starter", "copy.test.js"), hiddenSuiteSource()),
  });
  const { result, lines, runner } = go(world);
  assert.strictEqual(result.exitCode, 2);
  assert.strictEqual(runner.calls.length, 0, "the runner must not start after a leak");
  assert.ok(lines.some((line) => /^error:/.test(line) && line.includes("starter/copy.test.js")), JSON.stringify(lines));
  assert.strictEqual(fs.existsSync(world.scoreboardPath), false, "an aborted run stores no score");
});

// ---------------------------------------------------------------------------
// AC-4 (R4): an oracle path in the published package
// ---------------------------------------------------------------------------

test("[AC-4 | spec-evaluation-harness | FR-261 | NFR-039] an oracle path in the published package fails the run before it starts and names the path", () => {
  const world = buildWorld();
  const path1 = "plugin/evals/dev/case-a/reference/solution.js";
  const { result, lines, runner } = go(world, { listPackageFiles: () => ({ ok: true, files: ["plugin/agents/developer.md", path1] }) });
  assert.strictEqual(result.exitCode, 1);
  assert.deepStrictEqual(result.findings, ["oracle path in package: " + path1]);
  assert.ok(lines.some((line) => line.indexOf("finding:") === 0 && line.includes(path1)));
  assert.strictEqual(runner.calls.length, 0);
  assert.strictEqual(fs.existsSync(world.scoreboardPath), false);
});

test("[AC-4 | spec-evaluation-harness | FR-261] a package file list that cannot be read is an operational error, not a clean package", () => {
  const world = buildWorld();
  const { result, lines, runner } = go(world, { listPackageFiles: () => ({ ok: false, reason: "package file list could not be read" }) });
  assert.strictEqual(result.exitCode, 2);
  assert.ok(lines.some((line) => /^error:/.test(line)));
  assert.strictEqual(runner.calls.length, 0);
});

test("[AC-4 | spec-evaluation-harness | FR-261] gitPackageFiles refuses a plugin folder that is not inside the repository root", () => {
  const listed = benchmark.gitPackageFiles(tmpDir(), path.join(tmpDir(), "elsewhere"));
  assert.strictEqual(listed.ok, false);
  assert.ok(listed.reason);
});

test("[AC-4 | spec-evaluation-harness | FR-261] gitPackageFiles refuses a plugin folder equal to the repository root", () => {
  // Boundary.
  const root = tmpDir();
  assert.strictEqual(benchmark.gitPackageFiles(root, root).ok, false);
});

// ---------------------------------------------------------------------------
// AC-5 (R4): the private oracle location is unreachable
// ---------------------------------------------------------------------------

test("[AC-5 | spec-evaluation-harness | FR-260 | FR-261] an unreachable private oracle location reports an error that names it, scores nothing, and starts no run", () => {
  const missing = path.join(tmpDir(), "no-such-private-location");
  const world = buildWorld({ config: { oracleLocation: missing } });
  const { result, lines, runner } = go(world);
  assert.strictEqual(result.exitCode, 2);
  assert.ok(lines.some((line) => /^error:/.test(line) && line.includes(missing)), JSON.stringify(lines));
  assert.strictEqual(runner.calls.length, 0);
  assert.strictEqual(fs.existsSync(world.scoreboardPath), false, "no score may be stored");
  assert.strictEqual(fs.existsSync(world.resultsDir), false, "no result may be stored");
  assert.ok(!lines.some((line) => /pass@1|structural/.test(line)), "an unreachable oracle must not read as a score");
});

test("[AC-5 | spec-evaluation-harness | FR-260 | FR-261] an unset oracle location reports an error and scores nothing", () => {
  // Null/empty.
  const world = buildWorld({ config: { oracleLocation: null } });
  const { result, runner } = go(world);
  assert.strictEqual(result.exitCode, 2);
  assert.strictEqual(runner.calls.length, 0);
  assert.strictEqual(fs.existsSync(world.scoreboardPath), false);
});

// ---------------------------------------------------------------------------
// Configuration: no default numbers
// ---------------------------------------------------------------------------

test("[AC-4 | spec-evaluation-harness | FR-271 | FR-277 | FR-259] an unset run count is a configuration error that names the field and starts no run", () => {
  const world = buildWorld({ config: { runCount: null } });
  const { result, lines, runner } = go(world);
  assert.strictEqual(result.exitCode, 2);
  assert.ok(lines.some((line) => /^error:/.test(line) && line.includes("runCount")), JSON.stringify(lines));
  assert.strictEqual(runner.calls.length, 0);
});

test("[AC-4 | spec-evaluation-harness | FR-277] an unset regression margin is a configuration error that names the field", () => {
  const world = buildWorld({ config: { regressionMargin: null } });
  const { result, lines } = go(world);
  assert.strictEqual(result.exitCode, 2);
  assert.ok(lines.some((line) => line.includes("regressionMargin")), JSON.stringify(lines));
});

test("[AC-4 | spec-evaluation-harness | FR-259] an unset reference validation run count is a configuration error that names the field", () => {
  const world = buildWorld({ config: { referenceValidationRuns: null } });
  const { result, lines } = go(world);
  assert.strictEqual(result.exitCode, 2);
  assert.ok(lines.some((line) => line.includes("referenceValidationRuns")), JSON.stringify(lines));
});

test("[AC-4 | spec-evaluation-harness | FR-287] a configuration that retries a failing hidden test stops the run", () => {
  const world = buildWorld({ config: { retryOnFailure: 3 } });
  const { result, runner } = go(world);
  assert.strictEqual(result.exitCode, 2);
  assert.strictEqual(runner.calls.length, 0);
});

test("[AC-4 | spec-evaluation-harness | FR-285] loadSettings needs the judge run count only when the judge is on", () => {
  const off = buildWorld({ config: { judgeEnabled: false, judgeRuns: null } });
  assert.strictEqual(benchmark.loadSettings(off.configPath).ok, true);
  const on = buildWorld({ config: { judgeEnabled: true, judgeRuns: null } });
  const loaded = benchmark.loadSettings(on.configPath);
  assert.strictEqual(loaded.ok, false);
  assert.ok(loaded.errors.some((entry) => entry.includes("judgeRuns")));
});

test("[AC-4 | spec-evaluation-harness | FR-271 | FR-277 | FR-259] loadSettings reports each of the three unset numbers", () => {
  const world = buildWorld({ config: { runCount: null, regressionMargin: null, referenceValidationRuns: null } });
  const loaded = benchmark.loadSettings(world.configPath);
  assert.strictEqual(loaded.ok, false);
  ["runCount", "regressionMargin", "referenceValidationRuns"].forEach((key) => {
    assert.ok(loaded.errors.some((entry) => entry.includes(key)), "no error names " + key);
  });
});

// ---------------------------------------------------------------------------
// Task admission end to end
// ---------------------------------------------------------------------------

test("[AC-4 | spec-evaluation-harness | FR-257 | UR-080 | SC-025] a task with no valid-against cutoff is rejected, named in the output, and never run", () => {
  const world = buildWorld({ heldOutCases: [], specCases: [], meta: { provenance: "in-house", creation_date: "2026-11-01" } });
  const { result, lines, runner } = go(world);
  assert.strictEqual(result.exitCode, 2, "nothing was admitted, so nothing was scored");
  assert.strictEqual(runner.calls.length, 0);
  assert.ok(lines.some((line) => /^rejected: dev\/case-a/.test(line) && /cutoff/i.test(line)), JSON.stringify(lines));
});

test("[AC-4 | spec-evaluation-harness | FR-259 | UR-080] a coding task whose reference fails the hidden suite is not admitted and never run", () => {
  const world = buildWorld({ heldOutCases: [], specCases: [], referenceSource: FAILING_SOLUTION });
  const { result, lines, runner } = go(world);
  assert.strictEqual(result.exitCode, 2);
  assert.strictEqual(runner.calls.length, 0);
  assert.ok(lines.some((line) => /^not admitted: dev\/case-a/.test(line)), JSON.stringify(lines));
});

test("[AC-4 | spec-evaluation-harness | FR-254 | FR-263] a plugin tree with no golden task stops the run with an error", () => {
  // Null/empty.
  const world = buildWorld({ devCases: [], heldOutCases: [], specCases: [] });
  const { result, runner } = go(world);
  assert.strictEqual(result.exitCode, 2);
  assert.strictEqual(runner.calls.length, 0);
});

test("[AC-4 | spec-evaluation-harness | FR-259] one rejected task does not stop the other admitted tasks from running", () => {
  const world = buildWorld({ heldOutCases: [], specCases: ["case-s"] });
  // Break the spec task's cutoff so only the dev task is admitted.
  put(path.join(world.pluginRoot, "evals", "spec", "case-s", "task.json"), JSON.stringify({ provenance: "in-house", creation_date: "2026-11-01" }));
  const { result, runner, lines } = go(world);
  assert.strictEqual(result.exitCode, 0, JSON.stringify(lines));
  assert.ok(runner.calls.length > 0);
  assert.ok(runner.calls.every((call) => call.suite === "dev"));
});

// ---------------------------------------------------------------------------
// AC-3 (R5): sandbox backend absent
// ---------------------------------------------------------------------------

test("[AC-3 | spec-evaluation-harness | FR-264 | FR-271 | UR-078] with no sandbox backend every coding run reads not-run, so pass@1 is absent, not 0, and raises no finding", () => {
  const world = buildWorld();
  const { result } = go(world, { sandboxProbe: () => false });
  assert.strictEqual(result.exitCode, 0, JSON.stringify(result));
  const board = readBoard(world);
  const devCases = scoreboardModule.casesFor(board, "1.14.7", "dev");
  assert.ok(devCases.length > 0);
  devCases.forEach((entry) => {
    assert.strictEqual(entry.passAtOne, null, entry.caseId + " read " + entry.passAtOne);
    assert.strictEqual(entry.k, 0);
  });
  const row = board.aggregates.find((entry) => entry.version === "1.14.7" && entry.suite === "dev");
  assert.strictEqual(row.passAtOne, null);
});

// ---------------------------------------------------------------------------
// AC-9: a regression is a finding and exit 1
// ---------------------------------------------------------------------------

test("[AC-9 | spec-evaluation-harness | FR-277 | FR-274 | UR-079] a coding case that fell from a previous pass@1 of 1 to 0 is a regression finding and the run exits 1", () => {
  const world = buildWorld({ heldOutCases: [], specCases: [] });
  seedPrevious(world, 1);
  const runner = makeRunner({ solution: FAILING_SOLUTION });
  const { result, lines } = go(world, { runner });
  assert.strictEqual(result.exitCode, 1, JSON.stringify(lines));
  assert.strictEqual(result.findings.length, 1);
  assert.ok(result.findings[0].includes("dev"), result.findings[0]);
  assert.ok(lines.some((line) => line.indexOf("finding:") === 0), JSON.stringify(lines));
});

test("[AC-9 | spec-evaluation-harness | FR-277 | UR-079] the same run with a passing candidate and a previous pass@1 of 1 reports no finding and exits 0", () => {
  const world = buildWorld({ heldOutCases: [], specCases: [] });
  seedPrevious(world, 1);
  const { result, lines } = go(world);
  assert.strictEqual(result.exitCode, 0, JSON.stringify(lines));
  assert.deepStrictEqual(result.findings, []);
});

test("[AC-9 | spec-evaluation-harness | FR-273 | UR-079] the first run with no previous release reports no baseline and no finding", () => {
  const world = buildWorld();
  const { result, lines } = go(world);
  assert.strictEqual(result.exitCode, 0);
  assert.ok(lines.some((line) => /no baseline/i.test(line)), JSON.stringify(lines));
});

// ---------------------------------------------------------------------------
// NFR-039: nothing from the oracle reaches the output, the scoreboard, or the results
// ---------------------------------------------------------------------------

test("[AC-4 | spec-evaluation-harness | NFR-039 | FR-261] no oracle text reaches the printed output, the scoreboard, or the stored result", () => {
  const world = buildWorld();
  const { lines } = go(world);
  assert.ok(!lines.join("\n").includes(SENTINEL), "the output held oracle text");
  assert.ok(!fs.readFileSync(world.scoreboardPath, "utf8").includes(SENTINEL), "the scoreboard held oracle text");
  fs.readdirSync(world.resultsDir).forEach((name) => {
    assert.ok(!fs.readFileSync(path.join(world.resultsDir, name), "utf8").includes(SENTINEL), "a stored result held oracle text");
  });
});

test("[AC-4 | spec-evaluation-harness | NFR-039] the scoreboard that a run writes holds only identifiers, versions, and numbers as values", () => {
  const world = buildWorld();
  go(world);
  const strings = [];
  (function walk(value) {
    if (typeof value === "string") {
      strings.push(value);
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === "object") {
      Object.keys(value).forEach((key) => walk(value[key]));
    }
  })(JSON.parse(fs.readFileSync(world.scoreboardPath, "utf8")));
  assert.ok(strings.length > 0);
  strings.forEach((text) => assert.ok(/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(text), "a stored value is not an identifier: " + text));
});

// ---------------------------------------------------------------------------
// collectOutputText: the spec output is the markdown the agent added or changed
// ---------------------------------------------------------------------------

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

test("[AC-4 | spec-evaluation-harness | FR-265] the spec output is the markdown the agent added or changed, and the unchanged public prompt is left out", () => {
  const workspace = tmpDir();
  put(path.join(workspace, "prompt.md"), "Do the task.\n");
  put(path.join(workspace, "notes", "draft.md"), "# Draft by the agent\n");
  put(path.join(workspace, "helper.js"), "// not markdown\n");
  const before = { "prompt.md": sha256("Do the task.\n") };
  const text = benchmark.collectOutputText(workspace, before);
  assert.ok(text.includes("# Draft by the agent"));
  assert.ok(!text.includes("Do the task."));
  assert.ok(!text.includes("not markdown"));
});

test("[AC-4 | spec-evaluation-harness | FR-265] a workspace where the agent added no markdown reads as no output, never as an empty score", () => {
  // Null/empty.
  const workspace = tmpDir();
  put(path.join(workspace, "prompt.md"), "Do the task.\n");
  assert.strictEqual(benchmark.collectOutputText(workspace, { "prompt.md": sha256("Do the task.\n") }), null);
});

test("[AC-4 | spec-evaluation-harness | FR-265] a workspace that cannot be read reads as no output", () => {
  assert.strictEqual(benchmark.collectOutputText(path.join(tmpDir(), "gone"), {}), null);
});

test("[AC-4 | spec-evaluation-harness | FR-265] a markdown file the agent changed is part of the output", () => {
  const workspace = tmpDir();
  put(path.join(workspace, "prompt.md"), "Do the task.\n\nAgent addition.\n");
  const text = benchmark.collectOutputText(workspace, { "prompt.md": sha256("Do the task.\n") });
  assert.ok(text.includes("Agent addition."));
});
