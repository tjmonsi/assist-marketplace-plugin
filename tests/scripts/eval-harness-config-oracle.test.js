// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the oracle-location resolution and the provisional OQ-14 values of the evaluation harness
// (benchmark-run build, Step 3): plugins/assist-plugin/scripts/eval-harness/config.js
// (`loadConfig(filePath, { require, requireOracle, env })`) and run-benchmark.js (`loadSettings(configPath)`,
// `runBenchmark(options)`).
//
// Sources: specs/spec-evaluation-harness.md, the 2026-11-26 Change Log delta (ADDED Requirement: Oracle-location resolution
// from an uncommitted override, Scenarios 1 to 5; MODIFIED Requirement: Configured values settled provisionally (OQ-14));
// docs/task-plans/task-plan-eval-benchmark-run-20261126-1442.md (Step 1, Step 2, Step 3). Requirement text:
// docs/requirements/FR-NFR-harness-governance.md (FR-259, FR-260, FR-261, FR-271, FR-277, FR-281, FR-285, FR-287, NFR-039).
//
// Traceability format: [AC-N | spec file | FR/NFR ids]. The spec has no SPEC-NNN id, so it is cited by file name.
// AC-N is the position of the Scenario inside its Requirement block (the oracle-resolution block):
//   AC-1 Environment variable resolves the location
//   AC-2 Uncommitted override resolves the location
//   AC-3 Override preferred over the committed placeholder
//   AC-4 No override and no usable committed location
//   AC-5 Committed config holds no machine path
// The MODIFIED OQ-14 requirement carries no Scenario block, so its tests carry the plan short name R-C in place of an AC
// number. The retry-setting test reuses the existing AC-2 label of the retry-until-pass Scenario (FR-287) from
// eval-harness-config.test.js.
//
// Contract used:
//   - Resolution order for the oracle location: environment variable ASSIST_EVAL_ORACLE_DIR, then the `oracleLocation`
//     key of the uncommitted override file harness.config.local.json beside the config file, then the committed
//     `oracleLocation` (shipped as the placeholder null). A blank environment value counts as unset.
//   - loadConfig returns { ok, config, errors }. A loaded config carries `oracleLocation` and `oracleLocationSource`
//     ("env", "override", "committed", or null).
//   - `requireOracle: true` makes an unresolved location an error that names oracleLocation, states it is unset, and holds
//     no path. Without it (default), the committed placeholder null loads.
//   - An error is fixed text and never echoes the rejected value.
//
// Isolation: ASSIST_EVAL_ORACLE_DIR is removed from process.env for the whole file and restored afterwards, so a variable
// exported on a developer machine cannot change a result. Tests that need the variable set it with withProcessEnv or pass
// the `env` option. Tests that load the shipped config load a copy in a fresh directory, so a real
// evals/harness.config.local.json on the maintainer machine cannot change a result.
//
// Run: node --test tests/scripts/eval-harness-config-oracle.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLUGIN = path.join(__dirname, "..", "..", "plugins", "assist-plugin");
const config = require(path.join(PLUGIN, "scripts", "eval-harness", "config.js"));
const benchmark = require(path.join(PLUGIN, "scripts", "eval-harness", "run-benchmark.js"));
const SHIPPED_CONFIG = path.join(PLUGIN, "evals", "harness.config.json");

const ORACLE_ENV = "ASSIST_EVAL_ORACLE_DIR";
const OVERRIDE_NAME = "harness.config.local.json";
const OQ14_KEYS = ["runCount", "regressionMargin", "referenceValidationRuns", "judgeRuns", "newTasksPerRelease"];

// Isolation: remember the caller's value, clear it for every test, put it back when the file ends.
const originalEnvValue = process.env[ORACLE_ENV];
delete process.env[ORACLE_ENV];

const created = [];
after(() => {
  created.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
  if (originalEnvValue === undefined) {
    delete process.env[ORACLE_ENV];
  } else {
    process.env[ORACLE_ENV] = originalEnvValue;
  }
});

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-oracle-test-"));
  created.push(dir);
  return dir;
}

// Run fn with ASSIST_EVAL_ORACLE_DIR set to value (or removed when value is undefined), then clear it again.
function withProcessEnv(value, fn) {
  if (value === undefined) {
    delete process.env[ORACLE_ENV];
  } else {
    process.env[ORACLE_ENV] = value;
  }
  try {
    return fn();
  } finally {
    delete process.env[ORACLE_ENV];
  }
}

// Test-example numbers (not the shipped provisional values), so a resolution test never depends on them.
function baseConfig() {
  return {
    oracleLocation: null,
    runCount: 4,
    regressionMargin: 0.1,
    referenceValidationRuns: 2,
    judgeRuns: 6,
    newTasksPerRelease: 2,
    retryOnFailure: 0,
    judgeEnabled: false,
    judgeAgreementFloor: { spearmanRho: 0.7, cohenKappa: 0.6, label: "provisional, no empirical basis yet" },
    labeledSamplePath: null,
  };
}

// Writes harness.config.json into dir and returns its path.
function writeConfigIn(dir, mutate) {
  const value = baseConfig();
  if (mutate) {
    mutate(value);
  }
  const file = path.join(dir, "harness.config.json");
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
  return file;
}

// Writes the uncommitted override file beside the config in dir. A string is written as given (to build a malformed file).
function writeOverrideIn(dir, body) {
  const text = typeof body === "string" ? body : JSON.stringify(body, null, 2);
  fs.writeFileSync(path.join(dir, OVERRIDE_NAME), text);
}

function makeDir(parent, name) {
  const dir = path.join(parent, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// A copy of the committed config in a fresh directory: no override file sits beside it.
function copyShippedConfig() {
  const dir = tmpDir();
  const file = path.join(dir, "harness.config.json");
  fs.copyFileSync(SHIPPED_CONFIG, file);
  return { dir, file };
}

function mentions(errors, text) {
  return errors.some((entry) => entry.indexOf(text) !== -1);
}

// A token that reads as a filesystem path: an absolute path, a home shorthand, or a drive letter.
const PATH_LIKE = /(?:^|[\s"'(=])(?:\/[\w.~-]|~|[A-Za-z]:[\\/])/;

// ---------------------------------------------------------------------------
// AC-1: environment variable resolves the location
// ---------------------------------------------------------------------------

test("[AC-1 | spec-evaluation-harness | FR-260 | FR-261] the environment variable names the oracle location and the source is env", () => {
  const dir = tmpDir();
  const oracle = makeDir(dir, "oracle-from-env");
  const file = writeConfigIn(dir);
  const result = withProcessEnv(oracle, () => config.loadConfig(file));
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.config.oracleLocation, oracle);
  assert.strictEqual(result.config.oracleLocationSource, "env");
});

test("[AC-1 | spec-evaluation-harness | FR-260 | FR-261] the environment variable wins over an override file and a committed value", () => {
  const dir = tmpDir();
  const envOracle = makeDir(dir, "oracle-from-env");
  const overrideOracle = makeDir(dir, "oracle-from-override");
  const committedOracle = makeDir(dir, "oracle-committed");
  const file = writeConfigIn(dir, (value) => {
    value.oracleLocation = committedOracle;
  });
  writeOverrideIn(dir, { oracleLocation: overrideOracle });
  const result = withProcessEnv(envOracle, () => config.loadConfig(file, { requireOracle: true }));
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.config.oracleLocation, envOracle);
  assert.strictEqual(result.config.oracleLocationSource, "env");
});

test("[AC-1 | spec-evaluation-harness | FR-260 | FR-261] an environment mapping passed as the env option names the location", () => {
  // The env option stands in for process.env, so a caller can pin the environment without touching the process.
  const dir = tmpDir();
  const oracle = makeDir(dir, "oracle-from-env-option");
  const file = writeConfigIn(dir);
  const env = {};
  env[ORACLE_ENV] = oracle;
  const result = config.loadConfig(file, { env, requireOracle: true });
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.config.oracleLocation, oracle);
  assert.strictEqual(result.config.oracleLocationSource, "env");
});

test("[AC-1 | spec-evaluation-harness | FR-260 | FR-261] an empty env option hides a variable exported in the process", () => {
  // Isolation contract: the explicit env decides, not the machine that runs the test.
  const dir = tmpDir();
  const exported = makeDir(dir, "exported-oracle");
  const file = writeConfigIn(dir);
  const result = withProcessEnv(exported, () => config.loadConfig(file, { env: {}, requireOracle: true }));
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "oracleLocation"), JSON.stringify(result.errors));
});

test("[AC-1 | spec-evaluation-harness | FR-260 | FR-261] a blank environment value counts as unset and the override file decides", () => {
  // Boundary: empty and white-space-only values.
  const dir = tmpDir();
  const overrideOracle = makeDir(dir, "oracle-from-override");
  const file = writeConfigIn(dir);
  writeOverrideIn(dir, { oracleLocation: overrideOracle });
  ["", "   "].forEach((blank) => {
    const result = withProcessEnv(blank, () => config.loadConfig(file, { requireOracle: true }));
    assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
    assert.strictEqual(result.config.oracleLocation, overrideOracle);
    assert.strictEqual(result.config.oracleLocationSource, "override");
  });
});

test("[AC-1 | spec-evaluation-harness | FR-260 | FR-261] a blank environment value with no override or committed location is an unset error", () => {
  // Null/empty.
  const file = writeConfigIn(tmpDir());
  ["", "   "].forEach((blank) => {
    const result = withProcessEnv(blank, () => config.loadConfig(file, { requireOracle: true }));
    assert.strictEqual(result.ok, false);
    assert.ok(mentions(result.errors, "oracleLocation"), JSON.stringify(result.errors));
  });
});

// ---------------------------------------------------------------------------
// AC-2: uncommitted override resolves the location
// ---------------------------------------------------------------------------

test("[AC-2 | spec-evaluation-harness | FR-260 | FR-261] with no environment variable an override file beside the config names the location and the source is override", () => {
  const dir = tmpDir();
  const oracle = makeDir(dir, "oracle-from-override");
  const file = writeConfigIn(dir);
  writeOverrideIn(dir, { oracleLocation: oracle });
  const result = config.loadConfig(file, { requireOracle: true });
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.config.oracleLocation, oracle);
  assert.strictEqual(result.config.oracleLocationSource, "override");
});

test("[AC-2 | spec-evaluation-harness | FR-260 | FR-261] a relative override path resolves against the override file's directory", () => {
  const dir = tmpDir();
  makeDir(dir, "oracle-local");
  const file = writeConfigIn(dir);
  writeOverrideIn(dir, { oracleLocation: "oracle-local" });
  // The working directory of the test process is the repository, not dir, so only a correct base yields this value.
  const result = config.loadConfig(file, { requireOracle: true });
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.config.oracleLocation, path.join(dir, "oracle-local"));
  assert.strictEqual(result.config.oracleLocationSource, "override");
});

test("[AC-2 | spec-evaluation-harness | FR-260] an override file in some other directory does not apply to the config being loaded", () => {
  // The override sits beside the config file being loaded, not beside any other file.
  const configDir = tmpDir();
  const strayDir = tmpDir();
  const oracle = makeDir(strayDir, "oracle-stray");
  const file = writeConfigIn(configDir);
  writeOverrideIn(strayDir, { oracleLocation: oracle });
  const result = config.loadConfig(file, { requireOracle: true });
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "oracleLocation"), JSON.stringify(result.errors));
});

test("[AC-2 | spec-evaluation-harness | FR-260 | FR-261] an override file with an oracle location of the wrong type is rejected", () => {
  // Type mismatch.
  const dir = tmpDir();
  const file = writeConfigIn(dir);
  writeOverrideIn(dir, { oracleLocation: 42 });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "oracleLocation"), JSON.stringify(result.errors));
});

test("[AC-2 | spec-evaluation-harness | FR-260 | FR-261] a malformed override file is an error with fixed text and never echoes the file", () => {
  // Invalid input: an override that exists but is not valid JSON is never silently ignored.
  const dir = tmpDir();
  const file = writeConfigIn(dir);
  writeOverrideIn(dir, "{ oracleLocation: SENTINEL-RAW-OVERRIDE-TEXT ");
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.length >= 1);
  assert.ok(!JSON.stringify(result.errors).includes("SENTINEL-RAW-OVERRIDE-TEXT"), "an error echoed the override text");
});

test("[AC-2 | spec-evaluation-harness | FR-260 | FR-261] an unreadable override file is an error, not an absent override", () => {
  // Boundary: a directory sits where the override file belongs, so reading it fails.
  const dir = tmpDir();
  const file = writeConfigIn(dir);
  fs.mkdirSync(path.join(dir, OVERRIDE_NAME));
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.length >= 1);
});

test("[AC-2 | spec-evaluation-harness | FR-260 | FR-261 | NFR-039] an override that embeds credentials is rejected and the secret is not echoed", () => {
  // Security-adjacent: the location is a pointer, never a secret.
  const dir = tmpDir();
  const file = writeConfigIn(dir);
  writeOverrideIn(dir, { oracleLocation: "https://deploy-user:hunter2-secret@example.invalid/private/oracle.git" });
  const result = config.loadConfig(file, { requireOracle: true });
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "oracleLocation"), JSON.stringify(result.errors));
  assert.ok(!JSON.stringify(result.errors).includes("hunter2-secret"), "an error echoed the credential");
});

// ---------------------------------------------------------------------------
// AC-3: override preferred over the committed placeholder
// ---------------------------------------------------------------------------

test("[AC-3 | spec-evaluation-harness | FR-260 | FR-261] an override wins over a committed value that looks like a real location", () => {
  const dir = tmpDir();
  const overrideOracle = makeDir(dir, "oracle-from-override");
  const file = writeConfigIn(dir, (value) => {
    value.oracleLocation = "/srv/looks-real/eval-oracle";
  });
  writeOverrideIn(dir, { oracleLocation: overrideOracle });
  const result = config.loadConfig(file, { requireOracle: true });
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.config.oracleLocation, overrideOracle);
  assert.strictEqual(result.config.oracleLocationSource, "override");
  assert.notStrictEqual(result.config.oracleLocation, "/srv/looks-real/eval-oracle");
});

test("[AC-3 | spec-evaluation-harness | FR-260 | FR-261] a committed location is used, with source committed, when no environment variable or override exists", () => {
  const dir = tmpDir();
  const committedOracle = makeDir(dir, "oracle-committed");
  const file = writeConfigIn(dir, (value) => {
    value.oracleLocation = committedOracle;
  });
  const result = config.loadConfig(file, { requireOracle: true });
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.config.oracleLocation, committedOracle);
  assert.strictEqual(result.config.oracleLocationSource, "committed");
});

test("[AC-3 | spec-evaluation-harness | FR-260 | FR-261] the committed placeholder null never reads as a real path when an override names one", () => {
  const dir = tmpDir();
  const overrideOracle = makeDir(dir, "oracle-from-override");
  const file = writeConfigIn(dir);
  writeOverrideIn(dir, { oracleLocation: overrideOracle });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.config.oracleLocation, overrideOracle);
});

// ---------------------------------------------------------------------------
// AC-4: no override and no usable committed location
// ---------------------------------------------------------------------------

test("[AC-4 | spec-evaluation-harness | FR-260 | FR-261] with nothing resolved and requireOracle true the load fails and the error names oracleLocation and says it is unset", () => {
  const dir = tmpDir();
  const file = writeConfigIn(dir);
  const result = config.loadConfig(file, { requireOracle: true });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.config, null, "a failed load must not hand back a config with a substituted location");
  assert.ok(mentions(result.errors, "oracleLocation"), JSON.stringify(result.errors));
  assert.ok(result.errors.some((entry) => /unset/i.test(entry)), "no error states the location is unset: " + JSON.stringify(result.errors));
});

test("[AC-4 | spec-evaluation-harness | FR-260 | FR-261 | NFR-039] the unset error holds no filesystem path", () => {
  const dir = tmpDir();
  const file = writeConfigIn(dir);
  const result = config.loadConfig(file, { requireOracle: true });
  assert.strictEqual(result.ok, false);
  const text = result.errors.join("\n");
  assert.ok(!text.includes(dir), "the error holds the config directory");
  assert.ok(!text.includes(os.tmpdir()), "the error holds a temp path");
  assert.ok(!text.includes(os.homedir()), "the error holds the home directory");
  assert.ok(!PATH_LIKE.test(text), "the error holds a path-like token: " + text);
});

test("[AC-4 | spec-evaluation-harness | FR-260] with nothing resolved and requireOracle left off the load succeeds with a null location and no source", () => {
  // Existing callers that load a config with no oracle are unchanged.
  const file = writeConfigIn(tmpDir());
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.config.oracleLocation, null);
  assert.strictEqual(result.config.oracleLocationSource, null);
});

test("[AC-4 | spec-evaluation-harness | FR-260] requireOracle false loads the same as the default", () => {
  const file = writeConfigIn(tmpDir());
  const result = config.loadConfig(file, { requireOracle: false });
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.config.oracleLocation, null);
});

test("[AC-4 | spec-evaluation-harness | FR-260] no default location is substituted for an unset location", () => {
  const file = writeConfigIn(tmpDir());
  const withoutRequire = config.loadConfig(file);
  assert.strictEqual(withoutRequire.config.oracleLocation, null);
  const withRequire = config.loadConfig(file, { requireOracle: true });
  assert.strictEqual(withRequire.config, null);
});

test("[AC-4 | spec-evaluation-harness | FR-260] an empty-string committed location with requireOracle is an error that names oracleLocation", () => {
  // Null/empty: an empty string is not a location.
  const file = writeConfigIn(tmpDir(), (value) => {
    value.oracleLocation = "";
  });
  const result = config.loadConfig(file, { requireOracle: true });
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "oracleLocation"), JSON.stringify(result.errors));
});

test("[AC-4 | spec-evaluation-harness | FR-260 | FR-261] an environment value that embeds credentials is rejected and the secret is not echoed", () => {
  // Security-adjacent.
  const file = writeConfigIn(tmpDir());
  const result = withProcessEnv("https://deploy-user:hunter2-secret@example.invalid/private/oracle.git", () => config.loadConfig(file, { requireOracle: true }));
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "oracleLocation"), JSON.stringify(result.errors));
  assert.ok(!JSON.stringify(result.errors).includes("hunter2-secret"), "an error echoed the credential");
});

test("[AC-4 | spec-evaluation-harness | FR-260 | FR-261] an environment value with a NUL character is rejected", () => {
  // Security-adjacent: passed through the env option because a process environment cannot hold a NUL.
  const file = writeConfigIn(tmpDir());
  const env = {};
  env[ORACLE_ENV] = "/srv/oracle\u0000/extra";
  const result = config.loadConfig(file, { env, requireOracle: true });
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "oracleLocation"), JSON.stringify(result.errors));
});

test("[AC-4 | spec-evaluation-harness | FR-260 | FR-261] an environment value of more than 4096 characters is rejected", () => {
  // Boundary: past the longest accepted location.
  const file = writeConfigIn(tmpDir());
  const env = {};
  env[ORACLE_ENV] = "/" + "a".repeat(4096);
  const result = config.loadConfig(file, { env, requireOracle: true });
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "oracleLocation"), JSON.stringify(result.errors));
});

// ---------------------------------------------------------------------------
// AC-5: the committed config holds no machine path
// ---------------------------------------------------------------------------

test("[AC-5 | spec-evaluation-harness | FR-261 | NFR-039] the committed oracleLocation is null or a placeholder with no machine path and no private URL", () => {
  const raw = JSON.parse(fs.readFileSync(SHIPPED_CONFIG, "utf8"));
  assert.ok("oracleLocation" in raw, "the committed config has no oracleLocation key");
  const value = raw.oracleLocation;
  if (value === null) {
    return;
  }
  assert.strictEqual(typeof value, "string");
  assert.ok(!/^\//.test(value), "absolute path");
  assert.ok(!/^~/.test(value), "home shorthand");
  assert.ok(!/^[A-Za-z]:[\\/]/.test(value), "drive letter");
  assert.ok(!/^\\\\/.test(value), "network share");
  assert.ok(!/:\/\//.test(value), "URL scheme");
  assert.ok(!/@/.test(value), "credential or private host marker");
});

test("[AC-5 | spec-evaluation-harness | FR-261 | NFR-039] no location field in the committed config holds a machine path, a URL, or an at sign", () => {
  const raw = JSON.parse(fs.readFileSync(SHIPPED_CONFIG, "utf8"));
  ["oracleLocation", "labeledSamplePath"].forEach((key) => {
    const value = raw[key];
    if (value === null || value === undefined) {
      return;
    }
    assert.ok(!/^[/~\\]|^[A-Za-z]:[\\/]|:\/\/|@/.test(String(value)), key + " holds a sensitive location");
  });
});

test("[AC-5 | spec-evaluation-harness | FR-261 | NFR-039] the committed config text holds neither the home directory of the machine nor a home path", () => {
  const text = fs.readFileSync(SHIPPED_CONFIG, "utf8");
  assert.ok(!text.includes(os.homedir()), "the committed config holds the home directory");
  assert.ok(!/\/home\/|\/Users\/|[A-Za-z]:\\\\/.test(text), "the committed config holds a home path");
});

test("[AC-5 | spec-evaluation-harness | FR-260 | FR-261] the committed config loads with no oracle required and reads a null location", () => {
  const shipped = copyShippedConfig();
  const result = config.loadConfig(shipped.file);
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.config.oracleLocation, null);
  assert.strictEqual(result.config.oracleLocationSource, null);
});

test("[AC-4 | spec-evaluation-harness | FR-260 | FR-261] the committed config with the oracle required and nothing else set is an unset error", () => {
  // Scenario: no environment variable, no override, committed oracleLocation is the placeholder.
  const shipped = copyShippedConfig();
  const result = config.loadConfig(shipped.file, { requireOracle: true });
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "oracleLocation"), JSON.stringify(result.errors));
  assert.ok(result.errors.some((entry) => /unset/i.test(entry)), JSON.stringify(result.errors));
  assert.ok(!PATH_LIKE.test(result.errors.join("\n")), "the error holds a path-like token");
});

test("[AC-2 | spec-evaluation-harness | FR-260 | FR-261] the committed config with an override file beside it resolves to the override", () => {
  const shipped = copyShippedConfig();
  const oracle = makeDir(shipped.dir, "oracle-local");
  writeOverrideIn(shipped.dir, { oracleLocation: oracle });
  const result = config.loadConfig(shipped.file, { requireOracle: true });
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.config.oracleLocation, oracle);
  assert.strictEqual(result.config.oracleLocationSource, "override");
});

test("[AC-1 | spec-evaluation-harness | FR-260 | FR-261] the committed config with the environment variable set resolves to the environment location", () => {
  const shipped = copyShippedConfig();
  const oracle = makeDir(shipped.dir, "oracle-env");
  const result = withProcessEnv(oracle, () => config.loadConfig(shipped.file, { requireOracle: true }));
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.config.oracleLocation, oracle);
  assert.strictEqual(result.config.oracleLocationSource, "env");
});

// ---------------------------------------------------------------------------
// R-C: the committed OQ-14 values (provisional)
// ---------------------------------------------------------------------------

test("[R-C | spec-evaluation-harness | FR-271 | FR-277 | FR-259 | FR-285 | FR-281] the committed config loads with all five OQ-14 keys required and returns 5, 0.05, 3, 3, 1", () => {
  const shipped = copyShippedConfig();
  const result = config.loadConfig(shipped.file, { require: OQ14_KEYS });
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.config.runCount, 5);
  assert.strictEqual(result.config.regressionMargin, 0.05);
  assert.strictEqual(result.config.referenceValidationRuns, 3);
  assert.strictEqual(result.config.judgeRuns, 3);
  assert.strictEqual(result.config.newTasksPerRelease, 1);
});

test("[R-C | spec-evaluation-harness | FR-271 | FR-277 | FR-259 | FR-285 | FR-281] the committed config file itself holds the five provisional numbers", () => {
  const raw = JSON.parse(fs.readFileSync(SHIPPED_CONFIG, "utf8"));
  assert.strictEqual(raw.runCount, 5);
  assert.strictEqual(raw.regressionMargin, 0.05);
  assert.strictEqual(raw.referenceValidationRuns, 3);
  assert.strictEqual(raw.judgeRuns, 3);
  assert.strictEqual(raw.newTasksPerRelease, 1);
});

test("[AC-2 | spec-evaluation-harness | FR-287] the committed config keeps retryOnFailure at 0 (no retry-until-pass)", () => {
  const shipped = copyShippedConfig();
  const result = config.loadConfig(shipped.file, { require: OQ14_KEYS });
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  const raw = JSON.parse(fs.readFileSync(SHIPPED_CONFIG, "utf8"));
  assert.strictEqual(raw.retryOnFailure, 0);
});

test("[R-C | spec-evaluation-harness | FR-285 | FR-286] the committed config keeps the judge off and no labeled sample path", () => {
  const raw = JSON.parse(fs.readFileSync(SHIPPED_CONFIG, "utf8"));
  assert.strictEqual(raw.judgeEnabled, false);
  assert.strictEqual(raw.labeledSamplePath, null);
  const shipped = copyShippedConfig();
  const result = config.loadConfig(shipped.file, { require: OQ14_KEYS });
  assert.strictEqual(result.config.judgeEnabled, false);
  assert.strictEqual(result.config.labeledSamplePath, null);
});

test("[R-C | spec-evaluation-harness | FR-286] the committed config keeps the provisional judge-agreement floor unchanged", () => {
  const shipped = copyShippedConfig();
  const result = config.loadConfig(shipped.file, { require: OQ14_KEYS });
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  const floor = result.config.judgeAgreementFloor;
  assert.strictEqual(floor.spearmanRho, 0.7);
  assert.strictEqual(floor.cohenKappa, 0.6);
  assert.match(floor.label, /provisional/i);
});

test("[R-C | spec-evaluation-harness | FR-271 | FR-277 | FR-259 | FR-285 | FR-281] the loader still errors on an unset OQ-14 number in the committed values and substitutes no default", () => {
  // Spec: "Each stays a configured value; the loader still errors on an unset or non-numeric field."
  const raw = JSON.parse(fs.readFileSync(SHIPPED_CONFIG, "utf8"));
  OQ14_KEYS.forEach((key) => {
    const copy = Object.assign({}, raw);
    copy[key] = null;
    const file = path.join(tmpDir(), "harness.config.json");
    fs.writeFileSync(file, JSON.stringify(copy));
    const result = config.loadConfig(file, { require: OQ14_KEYS });
    assert.strictEqual(result.ok, false, key);
    assert.ok(mentions(result.errors, key), "no error names " + key + ": " + JSON.stringify(result.errors));
    assert.strictEqual(result.config, null);
  });
});

// ---------------------------------------------------------------------------
// loadSettings and runBenchmark: the run entry requires the oracle location
// ---------------------------------------------------------------------------

test("[AC-4 | spec-evaluation-harness | FR-260 | FR-261] loadSettings on a config with no resolved oracle location reports an error that names oracleLocation", () => {
  // loadSettings has no env option, so the process variable is cleared (file-level isolation).
  const shipped = copyShippedConfig();
  const loaded = withProcessEnv(undefined, () => benchmark.loadSettings(shipped.file));
  assert.strictEqual(loaded.ok, false);
  assert.ok(mentions(loaded.errors, "oracleLocation"), JSON.stringify(loaded.errors));
  assert.ok(!PATH_LIKE.test(loaded.errors.join("\n")), "the error holds a path-like token");
});

test("[AC-2 | spec-evaluation-harness | FR-260 | FR-261] loadSettings on the same config loads once an override file names the location", () => {
  const shipped = copyShippedConfig();
  const oracle = makeDir(shipped.dir, "oracle-local");
  writeOverrideIn(shipped.dir, { oracleLocation: oracle });
  const loaded = withProcessEnv(undefined, () => benchmark.loadSettings(shipped.file));
  assert.strictEqual(loaded.ok, true, JSON.stringify(loaded.errors));
});

test("[AC-1 | spec-evaluation-harness | FR-260 | FR-261] loadSettings on the same config loads once the environment variable names the location", () => {
  const shipped = copyShippedConfig();
  const oracle = makeDir(shipped.dir, "oracle-env");
  const loaded = withProcessEnv(oracle, () => benchmark.loadSettings(shipped.file));
  assert.strictEqual(loaded.ok, true, JSON.stringify(loaded.errors));
});

test("[AC-4 | spec-evaluation-harness | FR-260 | FR-261] runBenchmark with an unset oracle location exits 2, prints a configuration error naming oracleLocation, starts no runner, and stores no score", () => {
  const root = tmpDir();
  const pluginRoot = path.join(root, "plugin");
  const taskDir = path.join(pluginRoot, "evals", "dev", "case-a");
  fs.mkdirSync(path.join(taskDir, "graders"), { recursive: true });
  fs.writeFileSync(path.join(taskDir, "prompt.md"), "Do the task.\n");
  fs.writeFileSync(path.join(taskDir, "graders", "grader.json"), "{}\n");
  fs.writeFileSync(
    path.join(taskDir, "task.json"),
    JSON.stringify({ provenance: "in-house", creation_date: "2026-11-01", valid_against_cutoff: "2026-06-30" })
  );
  const configPath = writeConfigIn(root);
  const scoreboardPath = path.join(root, "scoreboard.json");
  const resultsDir = path.join(root, "results");
  const lines = [];
  const calls = [];
  const runner = (request) => {
    calls.push(request);
    return { ok: false };
  };
  const result = withProcessEnv(undefined, () =>
    benchmark.runBenchmark({
      repoRoot: root,
      pluginRoot,
      configPath,
      scoreboardPath,
      resultsDir,
      out: (line) => lines.push(line),
      logger: () => {},
      runner,
      listPackageFiles: () => ({ ok: true, files: ["plugin/evals/dev/case-a/prompt.md"] }),
      now: new Date("2026-11-26T08:00:00.000Z"),
    })
  );
  assert.strictEqual(result.exitCode, 2);
  assert.ok(lines.some((line) => /^error:/.test(line) && line.includes("oracleLocation")), JSON.stringify(lines));
  assert.strictEqual(calls.length, 0, "no runner may start");
  assert.strictEqual(fs.existsSync(scoreboardPath), false, "no score may be stored");
  assert.strictEqual(fs.existsSync(resultsDir), false, "no result may be stored");
  assert.ok(!lines.some((line) => /pass@1|structural/.test(line)), "an unset location must not read as a score");
});
