#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-274|FR-263|FR-260|FR-261|NFR-038] Benchmark entry script of the evaluation benchmark harness (Group A). It runs ONLY
// on request: a default release check never starts it (ASM-2, D-15). It adds no second runner: each case runs through the
// existing `claude plugin eval` runner (evals/README.md).
//
// Flow (specs/spec-evaluation-harness.md):
//   1. load the harness configuration           the OQ-14 numbers must be set; no default number stands in for one
//   2. resolve the private oracle location       unreachable: report an error and score nothing (FR-260, FR-261)
//   3. published-package check                   an oracle path in the package fails the run before it starts (FR-261)
//   4. list the public catalog                   held-out cases are included on this request (FR-280)
//   5. validate each task, admit each coding task (task-validator.js, oracle.js)
//   6. for each admitted case, k times: prepare the workspace, leak-check it (abort on a leak, FR-260), run the case through
//      the runner, then grade it (coding-score.js, spec-checklist.js, judge.js)
//   7. aggregate (aggregate.js), write the run result (results.js), update the scoreboard (scoreboard.js), compare with the
//      previous release (compare.js)
//
// Usage:
//   node scripts/eval-harness/run-benchmark.js [--root DIR] [--config FILE] [--scoreboard FILE] [--suite dev|spec] [--case ID]
//   node scripts/eval-harness/run-benchmark.js --list [--benchmark] [--suite dev|spec] [--case ID]
// `--root` names the repository root (default: the current directory). `--list` prints the harness's own case list and starts
// nothing; a held-out case is listed only with `--benchmark`, which is what the ordinary list leaves out (FR-280).
//
// Output: plain lines on stdout. The run count and case count print before the first run, with the estimated cost of a full
// run ($25 to $75, an estimate and not a measurement, BRD A-12). Lines read "error: <fixed reason>", "finding: <text>",
// "advisory: <text>", or a score line. After a stored run it prints "benchmark-version: <version>" and
// "benchmark-suites: <suite,suite>" so the release-check section can verify the scoreboard. A reason is fixed text and never
// raw stderr of a child process.
//
// Exit codes: 0 no finding, 1 at least one finding (a regression, or an oracle path in the package), 2 an operational error
// (a bad flag, an unset configuration number, an unreachable oracle location, a leak, a runner or write failure).
//
// Unverified runner behavior (ASM-7, confirm in B3) sits in ONE adapter, defaultRunner(): where the runner leaves the agent's
// files, how it signals a missing sandbox backend, and how an ordinary `claude plugin eval` run skips a held-out case. The
// held-out filter lives here, in listCases(); this script does not edit the runner. No network or model call is made outside
// the runner and the judge adapter. The judge adapter and the agent model family come from the caller (runBenchmark options);
// the command line supplies neither, so a command-line run reports the judge score as absent.
// No dependencies; ES2015 syntax only.
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const aggregateModule = require("./aggregate.js");
const codingScore = require("./coding-score.js");
const compareModule = require("./compare.js");
const configModule = require("./config.js");
const judgeModule = require("./judge.js");
const oracleModule = require("./oracle.js");
const packageCheck = require("./package-check.js");
const resultsModule = require("./results.js");
const scoreboardModule = require("./scoreboard.js");
const specChecklist = require("./spec-checklist.js");
const taskValidator = require("./task-validator.js");

const EXIT_CLEAN = 0;
const EXIT_FINDING = 1;
const EXIT_ERROR = 2;

const PLUGIN_ROOT = path.join(__dirname, "..", "..");
const DEFAULT_PLUGIN_NAME = "assist-plugin";
const SUITES = oracleModule.SUITES;

const RUNNER_TIMEOUT_MS = 15 * 60 * 1000;
const GIT_TIMEOUT_MS = 30 * 1000;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_JSON_BYTES = 64 * 1024 * 1024;
const USAGE =
  "Usage: node scripts/eval-harness/run-benchmark.js [--root DIR] [--config FILE] [--scoreboard FILE] [--suite dev|spec] [--case ID]\n" +
  "       node scripts/eval-harness/run-benchmark.js --list [--benchmark] [--suite dev|spec] [--case ID]";

// [ASM-7a] Grants the runner receives per suite. A coding case writes and runs code, so it needs the shell grant the runner
// refuses without a sandbox backend; a spec case only writes documents. Confirm in B3.
const ALLOW_TOOLS = { dev: ["Write", "Edit", "Bash"], spec: ["Write", "Edit"] };
// [ASM-7a] A run error that reads like this means the runner refused for want of a sandbox backend.
const SANDBOX_ERROR = /sandbox|shell grant|confine/i;
const MARKDOWN_FILE = /\.md$/i;

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJsonFile(file) {
  try {
    if (fs.statSync(file).size > MAX_JSON_BYTES) {
      return null;
    }
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return null;
  }
}

function removeQuietly(directory) {
  if (!directory) {
    return;
  }
  try {
    fs.rmSync(directory, { recursive: true, force: true });
  } catch (error) {
    // A leftover temp directory holds a copy of public task files and of the agent's output, outside the repository.
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Case list (the harness's own list function, FR-280)
// ---------------------------------------------------------------------------------------------------------------------

function isHeldOut(taskDir) {
  const meta = readJsonFile(path.join(taskDir, "task.json"));
  return isObject(meta) && meta.held_out === true;
}

// [FR-280|ASM-7c] listCases({ evalsDir, benchmark, suite, caseId }) lists the golden tasks under evals/dev/<case>/ and
// evals/spec/<case>/. A task flagged `held_out` in task.json is left out of an ordinary list and included when `benchmark`
// is true. The filter is here and not in the runner, which this script does not edit.
function listCases(options) {
  const settings = options || {};
  const evalsDir = typeof settings.evalsDir === "string" ? settings.evalsDir : path.join(PLUGIN_ROOT, "evals");
  const cases = [];
  SUITES.forEach((suite) => {
    if (settings.suite && settings.suite !== suite) {
      return;
    }
    let names = [];
    try {
      names = fs.readdirSync(path.join(evalsDir, suite)).sort();
    } catch (error) {
      names = [];
    }
    names.forEach((name) => {
      const taskDir = path.join(evalsDir, suite, name);
      let isDirectory = false;
      try {
        isDirectory = fs.statSync(taskDir).isDirectory();
      } catch (error) {
        isDirectory = false;
      }
      if (!isDirectory || !scoreboardModule.IDENTIFIER_PATTERN.test(name) || (settings.caseId && settings.caseId !== name)) {
        return;
      }
      const heldOut = isHeldOut(taskDir);
      if (heldOut && settings.benchmark !== true) {
        return;
      }
      cases.push({ suite, caseId: name, taskDir, heldOut });
    });
  });
  return cases;
}

// ---------------------------------------------------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------------------------------------------------

function sandboxAvailableFor(aggregate) {
  const arms = [];
  (Array.isArray(aggregate.cases) ? aggregate.cases : []).forEach((entry) => {
    if (isObject(entry) && isObject(entry.arms)) {
      Object.keys(entry.arms).forEach((arm) => arms.push(entry.arms[arm]));
    }
  });
  const runs = arms.reduce((all, list) => all.concat(Array.isArray(list) ? list : []), []);
  return !runs.some((run) => isObject(run) && typeof run.error === "string" && SANDBOX_ERROR.test(run.error));
}

// [FR-263|ASM-7] defaultRunner(request) runs ONE case once through `claude plugin eval` and returns
// { ok: true, aggregate, run: { needsShellGrant, sandboxAvailable } } or { ok: false, reason } with fixed text.
// request: { pluginRoot, suite, caseId, workspaceDir, timeoutMs }
// Assumptions to confirm in B3: the agent's files land in the prepared workspace (the runner starts in it), the runner reads
// the case from evals/<suite>/, and a refused shell grant shows in a run's `error` text. The runner's own output is
// discarded, so no case text can reach a log.
function defaultRunner(request) {
  let outputDir = null;
  try {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-harness-runner-"));
    const args = [
      "plugin", "eval", request.pluginRoot,
      "--trust-plugin", "--no-publish", "--ablation", "none", "--runs", "1", "--threshold", "0",
      "--eval-dir", "evals/" + request.suite, "--case", request.caseId, "--output-dir", outputDir,
      "--allow-tools",
    ].concat(ALLOW_TOOLS[request.suite]);
    const result = spawnSync("claude", args, {
      cwd: request.workspaceDir,
      stdio: ["ignore", "ignore", "ignore"],
      timeout: request.timeoutMs || RUNNER_TIMEOUT_MS,
    });
    if (result.error) {
      return { ok: false, reason: result.error.code === "ETIMEDOUT" ? "runner timed out" : "runner could not start" };
    }
    if (result.signal || (result.status !== 0 && result.status !== 1)) {
      return { ok: false, reason: "runner did not finish" };
    }
    const aggregate = readJsonFile(path.join(outputDir, "aggregate-result.json"));
    if (!isObject(aggregate)) {
      return { ok: false, reason: "runner left no readable aggregate result" };
    }
    return { ok: true, aggregate, run: { needsShellGrant: request.suite === "dev", sandboxAvailable: sandboxAvailableFor(aggregate) } };
  } catch (error) {
    return { ok: false, reason: "runner could not run" };
  } finally {
    removeQuietly(outputDir);
  }
}

// [ASM-10|FR-261] gitPackageFiles(repoRoot, pluginRoot) lists the files git tracks, or would add, under the plugin folder:
// the files a published copy of the plugin holds. Returns { ok: true, files } or { ok: false, reason }.
function gitPackageFiles(repoRoot, pluginRoot) {
  const relative = path.relative(repoRoot, pluginRoot);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    return { ok: false, reason: "plugin folder is not inside the repository root" };
  }
  const result = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", relative], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  if (result.error || result.signal || result.status !== 0) {
    return { ok: false, reason: "package file list could not be read" };
  }
  return { ok: true, files: String(result.stdout || "").split("\0").filter((entry) => entry !== "") };
}

// ---------------------------------------------------------------------------------------------------------------------
// Agent output
// ---------------------------------------------------------------------------------------------------------------------

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

// Hash of every regular file of a prepared workspace, taken before the run, so the run's own files can be told apart.
function fileHashes(directory) {
  const listing = oracleModule.listFiles(directory);
  const hashes = {};
  if (!listing.ok) {
    return hashes;
  }
  listing.files.forEach((file) => {
    if (!file.symlink) {
      hashes[file.relative] = sha256(file.absolute);
    }
  });
  return hashes;
}

function readTextFile(file) {
  try {
    return fs.statSync(file).size > MAX_FILE_BYTES ? null : fs.readFileSync(file, "utf8");
  } catch (error) {
    return null;
  }
}

// [FR-265] The spec output is the markdown the agent added or changed in its workspace, in sorted path order. Null when the
// agent left none, which reads as an unreadable output and never as a score of 0.
function collectOutputText(workspaceDir, before) {
  const listing = oracleModule.listFiles(workspaceDir);
  if (!listing.ok) {
    return null;
  }
  const parts = [];
  listing.files.forEach((file) => {
    if (file.symlink || !MARKDOWN_FILE.test(file.relative) || before[file.relative] === sha256(file.absolute)) {
      return;
    }
    const text = readTextFile(file.absolute);
    if (text !== null) {
      parts.push(text);
    }
  });
  return parts.length === 0 ? null : parts.join("\n\n");
}

// The reference requirements set or reference spec of a spec case: every markdown file, in sorted path order. Held in memory
// for the judge and never written anywhere.
function readReferenceText(referenceDir) {
  const listing = referenceDir ? oracleModule.listFiles(referenceDir) : { ok: false };
  if (!listing.ok) {
    return null;
  }
  const parts = [];
  listing.files.forEach((file) => {
    const text = file.symlink || !MARKDOWN_FILE.test(file.relative) ? null : readTextFile(file.absolute);
    if (text !== null) {
      parts.push(text);
    }
  });
  return parts.length === 0 ? null : parts.join("\n\n");
}

// ---------------------------------------------------------------------------------------------------------------------
// One run
// ---------------------------------------------------------------------------------------------------------------------

function errorStructural(reason) {
  return { status: "error", score: null, passed: null, total: null, cleared: false, items: [], failedNames: [], reason };
}

// [FR-265|FR-268] Grades one finished spec run: the structural score first, then the judge on a cleared case.
function gradeSpecRun(entry, workspaceDir, before, context) {
  const outputText = collectOutputText(workspaceDir, before);
  const rubric = readJsonFile(path.join(entry.taskDir, "rubric.json"));
  const referenceText = readReferenceText(entry.referenceDir);
  const structural =
    outputText === null
      ? errorStructural("output could not be read")
      : specChecklist.scoreSpecRun({ rubric, outputText, referenceText: referenceText === null ? undefined : referenceText, referencePath: entry.referenceDir });
  const judge = judgeModule.judgeCase({
    caseId: entry.caseId,
    agentFamily: context.agentFamily,
    structural,
    rubric,
    outputText,
    referenceText,
    config: context.config,
    adapter: context.judgeAdapter,
    agreement: context.agreement,
    logger: context.logger,
  });
  return { status: structural.status === "scored" ? "scored" : "error", reason: structural.reason, structural, judge };
}

// Prepares, leak-checks, runs, and grades ONE run of one case. Returns { abort: true, reason } when the whole benchmark
// must stop (a leak, or a runner aggregate with no plugin version); otherwise { grade, info } where `grade` holds the run's
// status.
function executeRun(entry, context) {
  const prepared = oracleModule.prepareWorkspace(entry.taskDir, { logger: context.logger });
  if (!prepared.ok) {
    return { grade: { status: "error", reason: prepared.reason } };
  }
  try {
    // [FR-260] The workspace holds no oracle file before the run, or the run does not start.
    const leak = oracleModule.leakCheck(prepared.workspaceDir, [entry.referenceDir, entry.hiddenDir].filter(Boolean), { logger: context.logger });
    if (leak.abort) {
      return { abort: true, reason: leak.reason };
    }
    const before = fileHashes(prepared.workspaceDir);
    const launched = context.runner({
      pluginRoot: context.pluginRoot,
      suite: entry.suite,
      caseId: entry.caseId,
      workspaceDir: prepared.workspaceDir,
      timeoutMs: context.runnerTimeoutMs,
    });
    if (!launched || launched.ok !== true) {
      return { grade: { status: "error", reason: launched && launched.reason ? launched.reason : "runner did not finish" } };
    }
    // [FR-275|NFR-038] The plugin version, cost, and elapsed time come from the runner's own aggregate.
    const info = resultsModule.readAggregateInfo(launched.aggregate, { pluginName: context.pluginName });
    if (!info.ok) {
      return { abort: true, reason: info.reason };
    }
    if (entry.suite === "dev") {
      const graded = codingScore.scoreCodingRun({
        suite: entry.suite,
        caseId: entry.caseId,
        oracle: context.oracle,
        workspaceDir: prepared.workspaceDir,
        run: launched.run,
        sandboxProbe: context.sandboxProbe,
        logger: context.logger,
      });
      return { info, grade: graded };
    }
    return { info, grade: gradeSpecRun(entry, prepared.workspaceDir, before, context) };
  } finally {
    removeQuietly(prepared.workspaceDir);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Case records
// ---------------------------------------------------------------------------------------------------------------------

// [FR-271|FR-272|FR-287] The stored record of a coding case: its runs, pass@1 with k, c, and the harness version, and the
// names of its flaky hidden tests (the run result is git-ignored, so the names may sit there).
function codingCaseRecord(entry, grades, runCount) {
  const aggregated = aggregateModule.aggregateCase(grades, { runCount });
  return {
    suite: "dev",
    caseId: entry.caseId,
    heldOut: entry.heldOut,
    runs: grades.map((grade, index) => ({ run: index + 1, status: grade.status, reason: grade.reason || null })),
    passAtOne: aggregated.passAtOne,
    flakyTests: aggregated.flakiness.flaky.map((test) => test.name),
  };
}

// [FR-265|FR-270] The stored record of a spec case: the structural score and the judge score as two separate values, each
// the mean over the runs that produced one.
function specCaseRecord(entry, grades) {
  const scored = grades.filter((grade) => grade.status === "scored");
  return {
    suite: "spec",
    caseId: entry.caseId,
    heldOut: entry.heldOut,
    runs: grades.map((grade, index) => ({
      run: index + 1,
      status: grade.status,
      reason: grade.reason || null,
      structural: grade.structural || null,
      judge: grade.judge || null,
    })),
    structuralScore: judgeModule.mean(scored.map((grade) => grade.structural.score)),
    judgeScore: judgeModule.mean(grades.filter((grade) => grade.judge && grade.judge.judgeScore !== null).map((grade) => grade.judge.judgeScore)),
    runCount: scored.length,
  };
}

function meanOfField(records, pick) {
  return judgeModule.mean(records.map(pick).filter((value) => value !== null && value !== undefined));
}

// [FR-276|FR-278|NFR-039] Scoreboard entries from the case records of one run: one aggregate row per suite that had a case
// listed, and one per-case record per case. They hold scores, identifiers, and versions only.
function scoreboardEntries(version, harnessVersion, suites, records) {
  const aggregates = suites.map((suite) => {
    const inSuite = records.filter((record) => record.suite === suite);
    return {
      version,
      suite,
      harnessVersion,
      passAtOne: suite === "dev" ? meanOfField(inSuite, (record) => record.passAtOne.value) : null,
      structuralScore: suite === "spec" ? meanOfField(inSuite, (record) => record.structuralScore) : null,
      judgeScore: suite === "spec" ? meanOfField(inSuite, (record) => record.judgeScore) : null,
      caseCount: inSuite.length,
    };
  });
  const cases = records.map((record) => {
    if (record.suite === "dev") {
      return {
        version,
        suite: "dev",
        caseId: record.caseId,
        harnessVersion: record.passAtOne.harnessVersion,
        passAtOne: record.passAtOne.value,
        k: record.passAtOne.k,
        c: record.passAtOne.c,
        runCount: record.runs.length,
      };
    }
    return {
      version,
      suite: "spec",
      caseId: record.caseId,
      harnessVersion,
      structuralScore: record.structuralScore,
      judgeScore: record.judgeScore,
      runCount: record.runs.length,
    };
  });
  return { aggregates, cases };
}

function describeCase(record) {
  const id = record.suite + "/" + record.caseId;
  if (record.suite === "dev") {
    const value = record.passAtOne;
    return id + ": pass@1 " + scoreboardModule.formatScore(value.value) + " (k=" + value.k + ", c=" + value.c + ", harness " + value.harnessVersion + ")" +
      (record.flakyTests.length > 0 ? ", " + record.flakyTests.length + " flaky hidden test(s)" : "");
  }
  return id + ": structural " + scoreboardModule.formatScore(record.structuralScore) + ", judge " + scoreboardModule.formatScore(record.judgeScore);
}

// ---------------------------------------------------------------------------------------------------------------------
// The benchmark
// ---------------------------------------------------------------------------------------------------------------------

// [FR-271|FR-259|FR-277|FR-285] The OQ-14 numbers every run needs. The judge run count is needed only when the judge is on.
function loadSettings(configPath) {
  const required = ["runCount", "regressionMargin", "referenceValidationRuns"];
  const loaded = configModule.loadConfig(configPath, { require: required });
  if (loaded.ok && loaded.config.judgeEnabled) {
    return configModule.loadConfig(configPath, { require: required.concat(["judgeRuns"]) });
  }
  return loaded;
}

// [FR-254|FR-259] Validates each listed task and admits each coding task. Returns { admitted, lines } where `lines` name each
// task that was not taken.
function admitCases(listed, context) {
  const admitted = [];
  const lines = [];
  listed.forEach((entry) => {
    const id = entry.suite + "/" + entry.caseId;
    const validation = taskValidator.validateTask(entry.taskDir, { oracle: context.oracle, suite: entry.suite, logger: context.logger });
    if (validation.status === "error") {
      lines.push("error: " + id + ": " + validation.error.message);
      return;
    }
    if (validation.status === "rejected") {
      validation.problems.forEach((entryProblem) => lines.push("rejected: " + id + ": " + entryProblem.message));
      return;
    }
    const found = oracleModule.lookupCase(context.oracle, entry.suite, entry.caseId);
    if (entry.suite === "dev") {
      const admission = oracleModule.admitReference({
        oracle: context.oracle,
        suite: entry.suite,
        caseId: entry.caseId,
        runs: context.config.referenceValidationRuns,
        logger: context.logger,
      });
      if (!admission.admitted) {
        lines.push("not admitted: " + id + ": " + admission.reason);
        return;
      }
    }
    admitted.push(Object.assign({}, entry, { referenceDir: found.referenceDir, hiddenDir: found.hiddenDir }));
  });
  return { admitted, lines };
}

// runBenchmark(options) runs the whole benchmark and returns { exitCode, findings, notes }. Options: repoRoot, pluginRoot,
// configPath, scoreboardPath, resultsDir, suite, caseId, out (a line sink), logger, now, and the adapters runner,
// sandboxProbe, listPackageFiles, judgeAdapter, and agentFamily.
function runBenchmark(options) {
  const settings = options || {};
  const say = typeof settings.out === "function" ? settings.out : (line) => console.log(line);
  const pluginRoot = settings.pluginRoot || PLUGIN_ROOT;
  const repoRoot = settings.repoRoot || process.cwd();
  const stop = (reason) => {
    say("error: " + reason);
    return { exitCode: EXIT_ERROR, findings: [], notes: [] };
  };

  const loaded = loadSettings(settings.configPath);
  if (!loaded.ok) {
    loaded.errors.forEach((message) => say("error: configuration " + message));
    return { exitCode: EXIT_ERROR, findings: [], notes: [] };
  }
  const config = loaded.config;

  // [FR-260|FR-261] An unreachable private location scores nothing and is never read as a score.
  const oracle = oracleModule.resolveOracle(config.oracleLocation, settings);
  if (!oracle.ok) {
    return stop(oracle.message);
  }

  // [FR-261] The package list is checked before the run, so no oracle path ships with the plugin.
  const listing = (settings.listPackageFiles || gitPackageFiles)(repoRoot, pluginRoot);
  if (!listing.ok) {
    return stop(listing.reason);
  }
  const packaged = packageCheck.checkPackageFiles(listing.files);
  if (packaged.error) {
    return stop(packaged.error);
  }
  if (!packaged.ok) {
    const findings = packaged.offending.map((entry) => "oracle path in package: " + entry);
    findings.forEach((line) => say("finding: " + line));
    return { exitCode: EXIT_FINDING, findings, notes: [] };
  }

  const context = {
    config,
    oracle,
    pluginRoot,
    pluginName: settings.pluginName || DEFAULT_PLUGIN_NAME,
    runner: settings.runner || defaultRunner,
    runnerTimeoutMs: settings.runnerTimeoutMs,
    sandboxProbe: settings.sandboxProbe,
    judgeAdapter: settings.judgeAdapter || null,
    agentFamily: settings.agentFamily || null,
    logger: settings.logger,
    agreement: judgeModule.reportAgreement(config),
  };

  // [FR-280] This is a benchmark request, so held-out cases are included.
  const listed = listCases({ evalsDir: path.join(pluginRoot, "evals"), benchmark: true, suite: settings.suite, caseId: settings.caseId });
  if (listed.length === 0) {
    return stop("no golden task found under evals/dev or evals/spec");
  }
  const admission = admitCases(listed, context);
  admission.lines.forEach(say);
  if (admission.admitted.length === 0) {
    return stop("no golden task was admitted, so nothing was scored");
  }

  const runCount = config.runCount;
  say("benchmark: " + admission.admitted.length + " case(s), " + runCount + " run(s) each, " + admission.admitted.length * runCount + " run(s) in total");
  say("estimate: a full run costs about $25 to $75 (an estimate, not measured)");

  const startedAt = (settings.now instanceof Date ? settings.now : new Date()).toISOString();
  const records = [];
  const infos = [];
  for (let at = 0; at < admission.admitted.length; at += 1) {
    const entry = admission.admitted[at];
    const grades = [];
    for (let run = 1; run <= runCount; run += 1) {
      const executed = executeRun(entry, context);
      if (executed.abort) {
        return stop(entry.suite + "/" + entry.caseId + ": " + executed.reason);
      }
      if (executed.info) {
        infos.push(executed.info);
      }
      grades.push(executed.grade);
    }
    const record = entry.suite === "dev" ? codingCaseRecord(entry, grades, runCount) : specCaseRecord(entry, grades);
    records.push(record);
    say(describeCase(record));
  }

  // [FR-275|NFR-038] One plugin version, the summed cost, and the summed elapsed time of every runner aggregate.
  const info = resultsModule.combineAggregateInfo(infos);
  if (!info.ok) {
    return stop(info.reason);
  }
  const result = resultsModule.buildRunResult({ info, harnessVersion: aggregateModule.HARNESS_VERSION, startedAt, cases: records });
  const stored = resultsModule.storeRunResult(result, { resultsDir: settings.resultsDir, now: settings.now });
  if (!stored.ok) {
    stored.errors.forEach((entryProblem) => say("error: run result refused: " + entryProblem.field + ": " + entryProblem.message));
    return { exitCode: EXIT_ERROR, findings: [], notes: [] };
  }
  say("result: " + stored.path + " (cost USD " + Number(result.costUsd.toFixed(4)) + ", elapsed " + result.elapsedSeconds + " s)");

  // [FR-276|FR-278] One aggregate row per suite and one per-case record per case, scores only.
  const suitesRan = SUITES.filter((suite) => listed.some((entry) => entry.suite === suite));
  const entries = scoreboardEntries(info.pluginVersion, aggregateModule.HARNESS_VERSION, suitesRan, records);
  const written = scoreboardModule.writeEntries({ scoreboardPath: settings.scoreboardPath, aggregates: entries.aggregates, cases: entries.cases });
  if (!written.ok) {
    written.errors.forEach((entryProblem) => say("error: scoreboard refused: " + entryProblem.field + ": " + entryProblem.message));
    return { exitCode: EXIT_ERROR, findings: [], notes: [] };
  }

  // [FR-273|FR-277|FR-279|FR-281] Compare with the previous release.
  const board = scoreboardModule.readScoreboard(settings.scoreboardPath);
  const comparison = board.ok
    ? compareModule.compareReleases({ scoreboard: board.scoreboard, version: info.pluginVersion, margin: config.regressionMargin, suites: suitesRan })
    : { ok: false, reason: board.reason };
  if (!comparison.ok) {
    return stop(comparison.reason);
  }
  compareModule.reportLines(comparison).forEach(say);
  comparison.notes.forEach((note) => say(note.indexOf("advisory:") === 0 ? note : "advisory: " + note));
  comparison.findings.forEach((finding) => say("finding: " + finding));
  say("benchmark-version: " + info.pluginVersion);
  say("benchmark-suites: " + suitesRan.join(","));
  return { exitCode: comparison.findings.length > 0 ? EXIT_FINDING : EXIT_CLEAN, findings: comparison.findings, notes: comparison.notes };
}

// ---------------------------------------------------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const options = { repoRoot: process.cwd(), configPath: undefined, scoreboardPath: undefined, suite: undefined, caseId: undefined, list: false, benchmark: false };
  const needsValue = (index, flag) => {
    if (index >= argv.length || argv[index] === "") {
      throw new UsageError(flag + " needs a value");
    }
    return argv[index];
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--list") {
      options.list = true;
    } else if (arg === "--benchmark") {
      options.benchmark = true;
    } else if (arg === "--root") {
      i += 1;
      options.repoRoot = path.resolve(needsValue(i, arg));
    } else if (arg === "--config") {
      i += 1;
      options.configPath = path.resolve(needsValue(i, arg));
    } else if (arg === "--scoreboard") {
      i += 1;
      options.scoreboardPath = path.resolve(needsValue(i, arg));
    } else if (arg === "--suite") {
      i += 1;
      options.suite = needsValue(i, arg);
      if (SUITES.indexOf(options.suite) === -1) {
        throw new UsageError("--suite must be dev or spec");
      }
    } else if (arg === "--case") {
      i += 1;
      options.caseId = needsValue(i, arg);
      if (!scoreboardModule.IDENTIFIER_PATTERN.test(options.caseId)) {
        throw new UsageError("--case must be a case id");
      }
    } else {
      throw new UsageError("unknown argument " + JSON.stringify(arg));
    }
  }
  let isDirectory = false;
  try {
    isDirectory = fs.statSync(options.repoRoot).isDirectory();
  } catch (error) {
    isDirectory = false;
  }
  if (!isDirectory) {
    throw new UsageError("root is not a directory");
  }
  return options;
}

function fail(error) {
  const reason = error instanceof UsageError ? error.message : "script error (" + (error && error.name ? error.name : "Error") + ")";
  console.error("run-benchmark: " + reason);
  if (error instanceof UsageError) {
    console.error(USAGE);
  }
  process.exitCode = EXIT_ERROR;
}

function main(argv) {
  try {
    const options = parseArgs(argv);
    if (options.list) {
      listCases({ benchmark: options.benchmark, suite: options.suite, caseId: options.caseId }).forEach((entry) => {
        console.log(entry.suite + "/" + entry.caseId + (entry.heldOut ? " (held-out)" : ""));
      });
      process.exitCode = EXIT_CLEAN;
      return;
    }
    process.exitCode = runBenchmark(options).exitCode;
  } catch (error) {
    fail(error);
  }
}

if (require.main === module) {
  process.on("uncaughtException", (error) => {
    fail(error);
    process.exit(EXIT_ERROR);
  });
  main(process.argv.slice(2));
}

module.exports = { runBenchmark, listCases, defaultRunner, gitPackageFiles, collectOutputText, loadSettings };
