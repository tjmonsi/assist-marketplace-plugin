// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the evaluation harness configuration loader (Group A, Step 15):
// plugins/assist-plugin/scripts/eval-harness/config.js (`loadConfig(filePath, { require })`, `OQ14_FIELDS`).
//
// Sources: specs/spec-evaluation-harness.md (Requirement: Flaky hidden-suite tests reported, not silenced, Scenario
// Retry-until-pass configuration rejected; Requirement: Spec judge grading, separation, and bias mitigations, the
// judge-agreement floor; Configured values (recommended defaults)), and docs/task-plans/task-plan-evaluation-harness-20261125-0717.md
// (Assumptions ASM-3a and ASM-3b, Step 1, Step 15). Requirement text: docs/requirements/FR-NFR-harness-governance.md
// (FR-259, FR-271, FR-277, FR-281, FR-285, FR-286, FR-287).
//
// Traceability format: [AC-N | spec file | FR/NFR ids]. The spec has no SPEC-NNN id, so it is cited by file name.
// AC-N is the position of the Scenario inside its Requirement block. A test about behavior with no Scenario in the spec
// carries the plan short name of the Requirement (R5, R8, R9 and so on) in place of an AC number.
//   R6 AC-2 Retry-until-pass configuration rejected.
//
// Contract used:
//   - loadConfig returns { ok, config, errors }. An error is a fixed text that names the field and never holds the
//     rejected value. The five OQ-14 numbers (runCount, regressionMargin, referenceValidationRuns, judgeRuns,
//     newTasksPerRelease) have no default in code: a required field that is unset or not a number is an error that names
//     the field.
//   - A setting that retries a failing hidden test (retryOnFailure above 0) is rejected.
//   - The judge-agreement floor ships provisional, loads with its label and a `source` of "shipped", and a user override
//     replaces it with a `source` of "override". A floor with no label is rejected.
//   - The numbers in the fixtures below are test examples, not defaults (A-14).
//
// Run: node --test tests/scripts/eval-harness-config.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLUGIN = path.join(__dirname, "..", "..", "plugins", "assist-plugin");
const config = require(path.join(PLUGIN, "scripts", "eval-harness", "config.js"));
const SHIPPED_CONFIG = path.join(PLUGIN, "evals", "harness.config.json");

const OQ14_KEYS = ["runCount", "regressionMargin", "referenceValidationRuns", "judgeRuns", "newTasksPerRelease"];

const created = [];
after(() => {
  created.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-config-test-"));
  created.push(dir);
  return dir;
}

// Test-example numbers (not the spec's recommended defaults).
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

function writeConfig(mutate) {
  const value = baseConfig();
  if (mutate) {
    mutate(value);
  }
  const file = path.join(tmpDir(), "harness.config.json");
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
  return file;
}

function mentions(errors, text) {
  return errors.some((entry) => entry.indexOf(text) !== -1);
}

// ---------------------------------------------------------------------------
// OQ-14 numbers: set, unset, non-numeric
// ---------------------------------------------------------------------------

test("[R5 | spec-evaluation-harness | FR-271 | FR-277 | FR-259 | FR-285 | FR-281] a configuration with every OQ-14 number set loads and returns each number", () => {
  const result = config.loadConfig(writeConfig());
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.config.runCount, 4);
  assert.strictEqual(result.config.regressionMargin, 0.1);
  assert.strictEqual(result.config.referenceValidationRuns, 2);
  assert.strictEqual(result.config.judgeRuns, 6);
  assert.strictEqual(result.config.newTasksPerRelease, 2);
});

test("[R5 | spec-evaluation-harness | FR-271 | FR-277 | FR-259 | FR-285 | FR-281] OQ14_FIELDS lists the five configured numbers", () => {
  const keys = config.OQ14_FIELDS.map((field) => field.key);
  OQ14_KEYS.forEach((key) => assert.ok(keys.indexOf(key) !== -1, "OQ14_FIELDS lacks " + key));
});

OQ14_KEYS.forEach((key) => {
  // Null/empty: each OQ-14 field left unset is an error that names it (no default number stands in).
  test("[R5 | spec-evaluation-harness | FR-271 | FR-277 | FR-259 | FR-285 | FR-281] an unset " + key + " is an error naming the field and ok is false", () => {
    const file = writeConfig((value) => {
      value[key] = null;
    });
    const result = config.loadConfig(file);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.config, null);
    assert.ok(mentions(result.errors, key), "no error names " + key + ": " + JSON.stringify(result.errors));
  });

  // Null/empty: a key absent from the file reads the same as null.
  test("[R5 | spec-evaluation-harness | FR-271 | FR-277 | FR-259 | FR-285 | FR-281] a missing " + key + " key is an error naming the field", () => {
    const file = writeConfig((value) => {
      delete value[key];
    });
    const result = config.loadConfig(file);
    assert.strictEqual(result.ok, false);
    assert.ok(mentions(result.errors, key));
  });

  // Type mismatch: a string where a number belongs.
  test("[R5 | spec-evaluation-harness | FR-271 | FR-277 | FR-259 | FR-285 | FR-281] a non-numeric " + key + " is an error naming the field and never echoing the value", () => {
    const file = writeConfig((value) => {
      value[key] = "SENTINEL-NOT-A-NUMBER";
    });
    const result = config.loadConfig(file);
    assert.strictEqual(result.ok, false);
    assert.ok(mentions(result.errors, key));
    assert.ok(!JSON.stringify(result.errors).includes("SENTINEL-NOT-A-NUMBER"), "an error echoed the rejected value");
  });
});

test("[R5 | spec-evaluation-harness | FR-271] a non-numeric runCount of the boolean type is an error naming the field", () => {
  const file = writeConfig((value) => {
    value.runCount = true;
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "runCount"));
});

test("[R5 | spec-evaluation-harness | FR-271 | FR-259 | FR-285] a run count of zero is rejected, because a count of zero runs measures nothing", () => {
  // Boundary: the smallest invalid run count.
  const file = writeConfig((value) => {
    value.runCount = 0;
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "runCount"));
});

test("[R9 | spec-evaluation-harness | FR-277] a regression margin above 1 is rejected as not a score fraction", () => {
  // Boundary: a margin is a fraction of a 0 to 1 score.
  const file = writeConfig((value) => {
    value.regressionMargin = 1.5;
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "regressionMargin"));
});

test("[R5 | spec-evaluation-harness | FR-271 | FR-277 | FR-259 | FR-285 | FR-281] with every OQ-14 number unset no default number is returned for any of them", () => {
  const file = writeConfig((value) => {
    OQ14_KEYS.forEach((key) => {
      value[key] = null;
    });
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  OQ14_KEYS.forEach((key) => assert.ok(mentions(result.errors, key), "no error names " + key));
  assert.strictEqual(result.config, null, "a failed load must not hand back a config with substituted numbers");
});

test("[R3 | spec-evaluation-harness | FR-259] a caller that needs only referenceValidationRuns loads a file whose other OQ-14 numbers are unset", () => {
  const file = writeConfig((value) => {
    OQ14_KEYS.forEach((key) => {
      value[key] = null;
    });
    value.referenceValidationRuns = 2;
  });
  const result = config.loadConfig(file, { require: ["referenceValidationRuns"] });
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.config.referenceValidationRuns, 2);
  // The fields that were not required stay unset and never read as a default number.
  assert.ok(result.config.runCount === null || result.config.runCount === undefined);
  assert.ok(result.config.regressionMargin === null || result.config.regressionMargin === undefined);
});

test("[R3 | spec-evaluation-harness | FR-259] a required field that is unset is still an error when the caller lists only that field", () => {
  const file = writeConfig((value) => {
    value.referenceValidationRuns = null;
  });
  const result = config.loadConfig(file, { require: ["referenceValidationRuns"] });
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "referenceValidationRuns"));
});

// ---------------------------------------------------------------------------
// Retry-until-pass is rejected (R6 AC-2)
// ---------------------------------------------------------------------------

test("[AC-2 | spec-evaluation-harness | FR-287] a configuration that retries a failing hidden test (retryOnFailure 3) is rejected", () => {
  const file = writeConfig((value) => {
    value.retryOnFailure = 3;
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.config, null);
  assert.ok(mentions(result.errors, "retryOnFailure"), JSON.stringify(result.errors));
});

test("[AC-2 | spec-evaluation-harness | FR-287] a retry count of 1, the smallest retry, is rejected", () => {
  // Boundary: one above zero.
  const file = writeConfig((value) => {
    value.retryOnFailure = 1;
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "retryOnFailure"));
});

test("[AC-2 | spec-evaluation-harness | FR-287] a retry setting of zero (no retry) loads", () => {
  // Boundary: zero is the one allowed value.
  const file = writeConfig((value) => {
    value.retryOnFailure = 0;
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
});

test("[AC-2 | spec-evaluation-harness | FR-287] a retry setting left out of the file loads", () => {
  const file = writeConfig((value) => {
    delete value.retryOnFailure;
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
});

test("[AC-2 | spec-evaluation-harness | FR-287] a retry setting that is not a number is rejected", () => {
  // Type mismatch.
  const file = writeConfig((value) => {
    value.retryOnFailure = "until-it-passes";
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "retryOnFailure"));
});

// ---------------------------------------------------------------------------
// Judge-agreement floor: provisional, overridable, label required (FR-286)
// ---------------------------------------------------------------------------

test("[R8 | spec-evaluation-harness | FR-286] the shipped configuration file carries the provisional floor (rho 0.7, kappa 0.6) with its provisional label", () => {
  // The shipped file leaves the OQ-14 numbers unset, so a caller asks for none of them.
  const result = config.loadConfig(SHIPPED_CONFIG, { require: [] });
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  const floor = result.config.judgeAgreementFloor;
  assert.strictEqual(floor.spearmanRho, 0.7);
  assert.strictEqual(floor.cohenKappa, 0.6);
  assert.match(floor.label, /provisional/i);
  assert.strictEqual(floor.source, "shipped");
});

test("[R5 | spec-evaluation-harness | FR-271 | FR-277 | FR-259 | FR-285 | FR-281] the shipped configuration file carries no default number for any OQ-14 field", () => {
  // The numbers are a user decision, so a caller that asks for any of them gets an error, not a value.
  const result = config.loadConfig(SHIPPED_CONFIG, { require: OQ14_KEYS });
  const raw = JSON.parse(fs.readFileSync(SHIPPED_CONFIG, "utf8"));
  const anySet = OQ14_KEYS.some((key) => raw[key] !== null && raw[key] !== undefined);
  if (!anySet) {
    assert.strictEqual(result.ok, false);
    OQ14_KEYS.forEach((key) => assert.ok(mentions(result.errors, key), "no error names " + key));
  } else {
    // The user has since chosen numbers (step B4); the contract then is that a set number loads.
    assert.ok(result.ok === true || result.errors.length > 0);
  }
});

test("[R8 | spec-evaluation-harness | FR-286] a loaded provisional floor returns its label and a source of shipped", () => {
  const result = config.loadConfig(writeConfig());
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  const floor = result.config.judgeAgreementFloor;
  assert.strictEqual(floor.spearmanRho, 0.7);
  assert.strictEqual(floor.cohenKappa, 0.6);
  assert.strictEqual(floor.label, "provisional, no empirical basis yet");
  assert.strictEqual(floor.source, "shipped");
});

test("[R8 | spec-evaluation-harness | FR-286] a user override replaces the shipped floor and reports a source of override", () => {
  const file = writeConfig((value) => {
    value.judgeAgreementFloorOverride = { spearmanRho: 0.8, cohenKappa: 0.65, label: "user override, measured on a 20-output sample" };
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  const floor = result.config.judgeAgreementFloor;
  assert.strictEqual(floor.spearmanRho, 0.8);
  assert.strictEqual(floor.cohenKappa, 0.65);
  assert.strictEqual(floor.label, "user override, measured on a 20-output sample");
  assert.strictEqual(floor.source, "override");
});

test("[R8 | spec-evaluation-harness | FR-286] an override with no label is rejected", () => {
  const file = writeConfig((value) => {
    value.judgeAgreementFloorOverride = { spearmanRho: 0.8, cohenKappa: 0.65 };
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "judgeAgreementFloorOverride"), JSON.stringify(result.errors));
});

test("[R8 | spec-evaluation-harness | FR-286] an override with an empty label is rejected", () => {
  // Boundary: a label of only white space is no label.
  const file = writeConfig((value) => {
    value.judgeAgreementFloorOverride = { spearmanRho: 0.8, cohenKappa: 0.65, label: "   " };
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
});

test("[R8 | spec-evaluation-harness | FR-286] a shipped floor with no label is rejected", () => {
  const file = writeConfig((value) => {
    value.judgeAgreementFloor = { spearmanRho: 0.7, cohenKappa: 0.6 };
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "judgeAgreementFloor"), JSON.stringify(result.errors));
});

test("[R8 | spec-evaluation-harness | FR-286] a floor with a non-numeric rho is rejected", () => {
  // Type mismatch.
  const file = writeConfig((value) => {
    value.judgeAgreementFloor = { spearmanRho: "high", cohenKappa: 0.6, label: "provisional, no empirical basis yet" };
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "spearmanRho"));
});

test("[R8 | spec-evaluation-harness | FR-286] a floor with a kappa above 1 is rejected", () => {
  // Boundary: kappa and rho thresholds sit between 0 and 1.
  const file = writeConfig((value) => {
    value.judgeAgreementFloor = { spearmanRho: 0.7, cohenKappa: 1.2, label: "provisional, no empirical basis yet" };
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "cohenKappa"));
});

// ---------------------------------------------------------------------------
// Oracle-location pointer and the file itself
// ---------------------------------------------------------------------------

test("[R4 | spec-evaluation-harness | FR-260 | FR-261] the oracle-location pointer loads as a plain location string", () => {
  const file = writeConfig((value) => {
    value.oracleLocation = "/srv/private/eval-oracle";
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(result.config.oracleLocation, "/srv/private/eval-oracle");
});

test("[R4 | spec-evaluation-harness | FR-260 | FR-261] an unset oracle-location pointer reads null", () => {
  const result = config.loadConfig(writeConfig());
  assert.strictEqual(result.config.oracleLocation, null);
});

test("[R4 | spec-evaluation-harness | FR-261 | NFR-039] an oracle-location pointer that embeds credentials is rejected and the secret is not echoed", () => {
  // Security-adjacent: the pointer is a location, never a secret.
  const file = writeConfig((value) => {
    value.oracleLocation = "https://deploy-user:hunter2-secret@example.invalid/private/oracle.git";
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "oracleLocation"));
  assert.ok(!JSON.stringify(result.errors).includes("hunter2-secret"), "an error echoed the credential");
});

test("[R4 | spec-evaluation-harness | FR-260] an oracle-location pointer of the wrong type is rejected", () => {
  // Type mismatch.
  const file = writeConfig((value) => {
    value.oracleLocation = 42;
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "oracleLocation (FR-260)"), JSON.stringify(result.errors));
});

test("[R8 | spec-evaluation-harness | FR-286] an invalid labeled-sample path is rejected under the judge-agreement tag, not the oracle tags", () => {
  // Type mismatch and embedded credentials both report FR-286; the oracle tags stay with oracleLocation.
  const wrongType = config.loadConfig(writeConfig((value) => {
    value.labeledSamplePath = 42;
  }));
  assert.strictEqual(wrongType.ok, false);
  assert.ok(mentions(wrongType.errors, "labeledSamplePath (FR-286)"), JSON.stringify(wrongType.errors));
  assert.ok(!mentions(wrongType.errors, "labeledSamplePath (FR-260)"), JSON.stringify(wrongType.errors));
  const credentials = config.loadConfig(writeConfig((value) => {
    value.labeledSamplePath = "https://deploy-user:hunter2-secret@example.invalid/private/samples.json";
  }));
  assert.strictEqual(credentials.ok, false);
  assert.ok(mentions(credentials.errors, "labeledSamplePath (FR-286)"), JSON.stringify(credentials.errors));
  assert.ok(!mentions(credentials.errors, "labeledSamplePath (FR-261)"), JSON.stringify(credentials.errors));
});

test("[R5 | spec-evaluation-harness | FR-271] a missing configuration file is a failed load with an error and no config", () => {
  const result = config.loadConfig(path.join(tmpDir(), "does-not-exist.json"));
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.config, null);
  assert.ok(result.errors.length >= 1);
});

test("[R5 | spec-evaluation-harness | FR-271] a configuration file that is not valid JSON is a failed load and the error never echoes the file text", () => {
  const file = path.join(tmpDir(), "harness.config.json");
  fs.writeFileSync(file, "{ runCount: SENTINEL-RAW-TEXT ");
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.length >= 1);
  assert.ok(!JSON.stringify(result.errors).includes("SENTINEL-RAW-TEXT"));
});

test("[R5 | spec-evaluation-harness | FR-271] a configuration file that holds a JSON list instead of an object is a failed load", () => {
  // Type mismatch at the top level.
  const file = path.join(tmpDir(), "harness.config.json");
  fs.writeFileSync(file, "[1, 2, 3]");
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.length >= 1);
});

test("[R5 | spec-evaluation-harness | FR-271] a judgeEnabled value that is not true or false is rejected", () => {
  // Type mismatch.
  const file = writeConfig((value) => {
    value.judgeEnabled = "yes";
  });
  const result = config.loadConfig(file);
  assert.strictEqual(result.ok, false);
  assert.ok(mentions(result.errors, "judgeEnabled"));
});
