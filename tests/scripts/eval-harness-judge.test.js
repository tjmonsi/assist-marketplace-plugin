// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the spec judge grader of the evaluation harness (Group A, Step 16):
// plugins/assist-plugin/scripts/eval-harness/judge.js (`judgeCase(request)`, `validateJudgeResult(result)`,
// `reportAgreement(config)`, `loadLabeledSample`, `spearmanRho`, `cohenKappa`, `mean`, `ORDERS`, `STATUS_JUDGED`,
// `STATUS_ABSENT`).
//
// Sources: specs/spec-evaluation-harness.md (Requirement: Spec judge grading, separation, and bias mitigations, all
// Scenarios), and docs/task-plans/task-plan-evaluation-harness-20261125-0717.md (ASM-3b, ASM-4, ASM-7b, ASM-9, Step 8,
// Step 16, and the Intake gap for FR-282). Requirement text: docs/requirements/FR-NFR-harness-governance.md (FR-268 to
// FR-270, FR-282 to FR-286, UR-078, UR-080; FR-282 mitigation scenarios at lines 1573 to 1590).
//
// Traceability format: [AC-N | spec file | FR/NFR ids | UR ids]. The spec has no SPEC-NNN id, so it is cited by file
// name. AC-N is the position of the Scenario inside Requirement "Spec judge grading, separation, and bias mitigations"
// (R8): AC-1 Judge off, AC-2 Judge on, AC-3 Cleared case judged, AC-4 Uncleared case not judged, AC-5 Two separate
// values, AC-6 Combined field rejected, AC-7 Per-item scores, AC-8 One overall score rejected, AC-9 Both comparison orders
// averaged, AC-10 One order only rejected, AC-11 Judge score is a mean over runs, AC-12 Judge run count not stated, AC-13
// Result records the judge family and the agent family, AC-14 Labeled sample reported, AC-15 No labeled sample, AC-16
// Judge unavailable. FR-282 mitigation scenarios cite the requirements document, which holds them (the spec rows hold a
// design review only).
//
// Contract used:
//   - The judge model sits behind an adapter: { family, isAvailable(), score(call) -> { ok: true, score } | { ok: false } }.
//     A call is { itemId, itemText, anchors, first, second, order, run }. Every test stubs the adapter; no test makes a
//     model call.
//   - The judge runs only on a case that cleared the structural checklist, in the agent's own model family. An uncleared
//     case, an unconfigured judge, or an unavailable judge gives a judge score of null with the structural score kept.
//   - judgeCase returns { status, structuralScore, judgeScore, judgeRuns, itemScores, judgeFamily, agentFamily,
//     mitigations, agreement, advisory, ... }. Structural and judge are two separate values, never combined.
//   - validateJudgeResult returns { ok, errors: [{ field, message }] }.
//   - reportAgreement(config) reports Spearman rho or Cohen kappa beside the configured floor and its provisional label,
//     or states that no agreement figure exists. The judge stays advisory.
//   - The numbers in the fixtures are test examples, not defaults (A-14).
//
// Run: node --test tests/scripts/eval-harness-judge.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLUGIN = path.join(__dirname, "..", "..", "plugins", "assist-plugin");
const judge = require(path.join(PLUGIN, "scripts", "eval-harness", "judge.js"));
const configModule = require(path.join(PLUGIN, "scripts", "eval-harness", "config.js"));

const FAMILY = "family-alpha";
const FLOOR_LABEL = "provisional, no empirical basis yet";

const created = [];
after(() => {
  created.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-judge-test-"));
  created.push(dir);
  return dir;
}

function near(actual, expected) {
  assert.ok(typeof actual === "number" && Math.abs(actual - expected) < 1e-9, "expected " + expected + " but read " + actual);
}

function config(extra) {
  return Object.assign(
    {
      judgeEnabled: true,
      judgeRuns: 3,
      judgeAgreementFloor: { spearmanRho: 0.7, cohenKappa: 0.6, label: FLOOR_LABEL, source: "shipped" },
      labeledSamplePath: null,
    },
    extra || {}
  );
}

function structuralCleared(score) {
  return { status: "scored", score: score === undefined ? 1 : score, passed: 2, total: 2, cleared: true, items: [], failedNames: [], reason: null };
}

const RUBRIC = {
  subjective: [
    { id: "clarity", text: "The spec reads clearly to a new maintainer" },
    { id: "scope", text: "The scope of the feature is stated" },
    { id: "tone", text: "The tone is neutral", anchors: "1.0 means neutral throughout; 0.0 means loaded or promotional" },
  ],
};

// A stub adapter. `scoreFor(call)` returns the score for the OUTPUT; every call is recorded.
function makeAdapter(scoreFor, extra) {
  const calls = [];
  const adapter = Object.assign(
    {
      family: FAMILY,
      isAvailable: () => true,
      score: (call) => {
        calls.push(call);
        return { ok: true, score: scoreFor(call) };
      },
    },
    extra || {}
  );
  adapter.calls = calls;
  return adapter;
}

function request(extra) {
  return Object.assign(
    {
      caseId: "case-s",
      agentFamily: FAMILY,
      structural: structuralCleared(),
      rubric: RUBRIC,
      outputText: "OUTPUT TEXT OF THE AGENT",
      referenceText: "REFERENCE TEXT OF THE TASK",
      config: config(),
      adapter: makeAdapter(() => 0.6),
      logger: () => {},
    },
    extra || {}
  );
}

function fieldsOf(validation) {
  return validation.errors.map((entry) => entry.field);
}

function hasField(validation, text) {
  return fieldsOf(validation).some((field) => field.indexOf(text) !== -1);
}

function judged(extra) {
  const result = judge.judgeCase(request(extra));
  assert.strictEqual(result.status, judge.STATUS_JUDGED, "the fixture must judge: " + JSON.stringify(result.reason));
  return result;
}

// ---------------------------------------------------------------------------
// AC-1 and AC-2: judge off and judge on
// ---------------------------------------------------------------------------

test("[AC-1 | spec-evaluation-harness | FR-268 | UR-078] with no judge configured the result holds the structural score and the judge score reads absent", () => {
  const adapter = makeAdapter(() => 0.6);
  const result = judge.judgeCase(request({ config: config({ judgeEnabled: false }), adapter, structural: structuralCleared(0.9) }));
  assert.strictEqual(result.status, judge.STATUS_ABSENT);
  assert.strictEqual(result.structuralScore, 0.9);
  assert.strictEqual(result.judgeScore, null);
  assert.strictEqual(adapter.calls.length, 0, "an unconfigured judge makes no call");
});

test("[AC-1 | spec-evaluation-harness | FR-268 | UR-078] with no judge adapter the judge score reads absent and the structural score is kept", () => {
  // Null/empty.
  const result = judge.judgeCase(request({ adapter: null, structural: structuralCleared(0.9) }));
  assert.strictEqual(result.judgeScore, null);
  assert.strictEqual(result.structuralScore, 0.9);
});

test("[AC-1 | spec-evaluation-harness | FR-268 | UR-078] an adapter with no score function is no judge, and the judge score reads absent", () => {
  // Type mismatch.
  const result = judge.judgeCase(request({ adapter: { family: FAMILY } }));
  assert.strictEqual(result.judgeScore, null);
  assert.strictEqual(result.status, judge.STATUS_ABSENT);
});

test("[AC-1 | spec-evaluation-harness | FR-268 | UR-078] an absent-judge result is a valid result", () => {
  const result = judge.judgeCase(request({ config: config({ judgeEnabled: false }) }));
  const validation = judge.validateJudgeResult(result);
  assert.strictEqual(validation.ok, true, JSON.stringify(validation.errors));
});

test("[AC-2 | spec-evaluation-harness | FR-268 | UR-078] with a judge configured the result holds both a structural score and a judge score", () => {
  const result = judged({ structural: structuralCleared(0.9) });
  assert.strictEqual(result.structuralScore, 0.9);
  near(result.judgeScore, 0.6);
});

test("[AC-2 | spec-evaluation-harness | FR-268 | FR-279 | UR-078] a judged result is valid and marked advisory", () => {
  const result = judged();
  const validation = judge.validateJudgeResult(result);
  assert.strictEqual(validation.ok, true, JSON.stringify(validation.errors));
  assert.strictEqual(result.advisory, true);
});

// ---------------------------------------------------------------------------
// AC-3 and AC-4: the judge runs only on a cleared case
// ---------------------------------------------------------------------------

test("[AC-3 | spec-evaluation-harness | FR-269 | UR-078] a case with every deterministic item passed and a judge configured runs the judge grader", () => {
  const adapter = makeAdapter(() => 0.7);
  const result = judge.judgeCase(request({ adapter }));
  assert.strictEqual(result.status, judge.STATUS_JUDGED);
  assert.ok(adapter.calls.length > 0, "the judge adapter was called");
});

test("[AC-4 | spec-evaluation-harness | FR-269 | UR-078] a case with one deterministic item failed is not judged and the judge score reads absent", () => {
  const adapter = makeAdapter(() => 0.7);
  const uncleared = { status: "scored", score: 0.8, passed: 8, total: 10, cleared: false, items: [], failedNames: ["x"], reason: null };
  const result = judge.judgeCase(request({ adapter, structural: uncleared }));
  assert.strictEqual(result.status, judge.STATUS_ABSENT);
  assert.strictEqual(result.judgeScore, null);
  assert.strictEqual(result.structuralScore, 0.8, "the structural score is still reported");
  assert.strictEqual(adapter.calls.length, 0, "the judge grader did not run");
});

test("[AC-4 | spec-evaluation-harness | FR-269 | FR-265 | UR-078] a case whose structural run read error is not judged and the structural score reads null, not 0", () => {
  const adapter = makeAdapter(() => 0.7);
  const errored = { status: "error", score: null, passed: null, total: null, cleared: false, items: [], failedNames: [], reason: "reference could not be read" };
  const result = judge.judgeCase(request({ adapter, structural: errored }));
  assert.strictEqual(result.judgeScore, null);
  assert.strictEqual(result.structuralScore, null);
  assert.notStrictEqual(result.structuralScore, 0);
  assert.strictEqual(adapter.calls.length, 0);
});

test("[AC-4 | spec-evaluation-harness | FR-269 | UR-078] a request with no structural result is not judged", () => {
  // Null/empty.
  const adapter = makeAdapter(() => 0.7);
  const result = judge.judgeCase(request({ adapter, structural: undefined }));
  assert.strictEqual(result.judgeScore, null);
  assert.strictEqual(adapter.calls.length, 0);
});

// ---------------------------------------------------------------------------
// AC-5 and AC-6: two separate values
// ---------------------------------------------------------------------------

test("[AC-5 | spec-evaluation-harness | FR-270 | UR-078] a case with structural 0.9 and judge 0.6 holds 0.9 and 0.6 as two values and no field of their mean", () => {
  const result = judged({ structural: structuralCleared(0.9) });
  assert.strictEqual(result.structuralScore, 0.9);
  near(result.judgeScore, 0.6);
  Object.keys(result).forEach((key) => {
    if (typeof result[key] === "number" && key !== "judgeRuns") {
      assert.ok(Math.abs(result[key] - 0.75) > 1e-6, "field " + key + " holds the combined value");
    }
  });
});

test("[AC-6 | spec-evaluation-harness | FR-270 | UR-078] a result with a field that averages the two scores fails validation and names the field", () => {
  const result = judged({ structural: structuralCleared(0.9) });
  const validation = judge.validateJudgeResult(Object.assign({}, result, { overall: 0.75 }));
  assert.strictEqual(validation.ok, false);
  assert.ok(fieldsOf(validation).indexOf("overall") !== -1, JSON.stringify(validation.errors));
});

test("[AC-6 | spec-evaluation-harness | FR-270 | UR-078] a field named as a combination of the two scores fails validation and is named", () => {
  const result = judged();
  const validation = judge.validateJudgeResult(Object.assign({}, result, { combinedScore: 0.123 }));
  assert.strictEqual(validation.ok, false);
  assert.ok(fieldsOf(validation).indexOf("combinedScore") !== -1, JSON.stringify(validation.errors));
});

test("[AC-5 | spec-evaluation-harness | FR-270 | UR-078] a result that drops the structural score field fails validation and names it", () => {
  const result = judged();
  const copy = Object.assign({}, result);
  delete copy.structuralScore;
  const validation = judge.validateJudgeResult(copy);
  assert.strictEqual(validation.ok, false);
  assert.ok(fieldsOf(validation).indexOf("structuralScore") !== -1);
});

test("[AC-5 | spec-evaluation-harness | FR-270 | UR-078] a judge score outside 0 to 1 fails validation", () => {
  // Boundary: just above the top of the range.
  const result = judged();
  const validation = judge.validateJudgeResult(Object.assign({}, result, { judgeScore: 1.01 }));
  assert.strictEqual(validation.ok, false);
  assert.ok(fieldsOf(validation).indexOf("judgeScore") !== -1);
});

[null, undefined, "result", 7, []].forEach((value) => {
  test("[AC-6 | spec-evaluation-harness | FR-270 | UR-078] the non-object result " + JSON.stringify(value) + " fails validation", () => {
    // Type mismatch.
    assert.strictEqual(judge.validateJudgeResult(value).ok, false);
  });
});

// ---------------------------------------------------------------------------
// AC-7 and AC-8: per-item scores
// ---------------------------------------------------------------------------

test("[AC-7 | spec-evaluation-harness | FR-283 | UR-078] a rubric with 3 subjective items gives 3 item scores, one per item id", () => {
  const result = judged();
  assert.strictEqual(result.itemScores.length, 3);
  assert.deepStrictEqual(result.itemScores.map((entry) => entry.id), ["clarity", "scope", "tone"]);
  result.itemScores.forEach((entry) => near(entry.score, 0.6));
});

test("[AC-7 | spec-evaluation-harness | FR-283 | UR-078] each item is scored against that item's own text", () => {
  const adapter = makeAdapter(() => 0.6);
  judged({ adapter });
  RUBRIC.subjective.forEach((item) => {
    const calls = adapter.calls.filter((call) => call.itemId === item.id);
    assert.ok(calls.length > 0, "no call for item " + item.id);
    calls.forEach((call) => assert.strictEqual(call.itemText, item.text));
  });
});

test("[AC-7 | spec-evaluation-harness | FR-283 | UR-078] an item with anchors hands them to the judge call, and an item with none hands null", () => {
  const adapter = makeAdapter(() => 0.6);
  judged({ adapter });
  const anchored = adapter.calls.find((call) => call.itemId === "tone");
  const plain = adapter.calls.find((call) => call.itemId === "clarity");
  assert.strictEqual(anchored.anchors, RUBRIC.subjective[2].anchors);
  assert.strictEqual(plain.anchors, null);
});

test("[AC-7 | spec-evaluation-harness | FR-283 | UR-078] different item scores each reach their own item entry, and the judge score is their mean", () => {
  const byItem = { clarity: 0.9, scope: 0.6, tone: 0.3 };
  const result = judged({ adapter: makeAdapter((call) => byItem[call.itemId]) });
  near(result.itemScores[0].score, 0.9);
  near(result.itemScores[1].score, 0.6);
  near(result.itemScores[2].score, 0.3);
  near(result.judgeScore, 0.6);
});

test("[AC-8 | spec-evaluation-harness | FR-283 | UR-078] a judge result with a single overall score and no item scores fails validation", () => {
  const result = judged();
  const validation = judge.validateJudgeResult(Object.assign({}, result, { itemScores: [] }));
  assert.strictEqual(validation.ok, false);
  assert.ok(hasField(validation, "itemScores"), JSON.stringify(validation.errors));
});

test("[AC-8 | spec-evaluation-harness | FR-283 | UR-078] a judge result with the item scores field missing fails validation", () => {
  const copy = Object.assign({}, judged());
  delete copy.itemScores;
  const validation = judge.validateJudgeResult(copy);
  assert.strictEqual(validation.ok, false);
  assert.ok(hasField(validation, "itemScores"));
});

test("[AC-8 | spec-evaluation-harness | FR-283 | UR-078] a rubric with no subjective item gives no judge score", () => {
  // Null/empty.
  const result = judge.judgeCase(request({ rubric: { subjective: [] } }));
  assert.strictEqual(result.judgeScore, null);
  assert.strictEqual(result.status, judge.STATUS_ABSENT);
});

test("[AC-8 | spec-evaluation-harness | FR-283 | UR-078] a rubric whose item has no text gives no judge score", () => {
  const result = judge.judgeCase(request({ rubric: { subjective: [{ id: "clarity" }] } }));
  assert.strictEqual(result.judgeScore, null);
});

// ---------------------------------------------------------------------------
// AC-9 and AC-10: both comparison orders averaged
// ---------------------------------------------------------------------------

test("[AC-9 | spec-evaluation-harness | FR-284 | UR-078] the comparison runs output-then-reference and reference-then-output for every item", () => {
  const adapter = makeAdapter(() => 0.6);
  judged({ adapter });
  assert.strictEqual(judge.ORDERS.length, 2);
  RUBRIC.subjective.forEach((item) => {
    const orders = adapter.calls.filter((call) => call.itemId === item.id).map((call) => call.order);
    judge.ORDERS.forEach((order) => assert.ok(orders.indexOf(order) !== -1, "item " + item.id + " was not run in order " + order));
  });
});

test("[AC-9 | spec-evaluation-harness | FR-284 | UR-078] each order puts the output and the reference in the matching positions", () => {
  const adapter = makeAdapter(() => 0.6);
  judged({ adapter });
  adapter.calls.forEach((call) => {
    const outputFirst = call.order === judge.ORDERS[0];
    assert.strictEqual(call.first.role, outputFirst ? "output" : "reference");
    assert.strictEqual(call.second.role, outputFirst ? "reference" : "output");
    assert.strictEqual(call.first.text, outputFirst ? "OUTPUT TEXT OF THE AGENT" : "REFERENCE TEXT OF THE TASK");
  });
});

test("[AC-9 | spec-evaluation-harness | FR-284 | UR-078] the reported score is the mean of the two orders (0.8 and 0.4 read 0.6)", () => {
  const result = judged({ adapter: makeAdapter((call) => (call.order === judge.ORDERS[0] ? 0.8 : 0.4)) });
  near(result.judgeScore, 0.6);
  result.itemScores.forEach((entry) => {
    near(entry.orderScores[judge.ORDERS[0]], 0.8);
    near(entry.orderScores[judge.ORDERS[1]], 0.4);
    near(entry.score, 0.6);
  });
});

test("[AC-10 | spec-evaluation-harness | FR-284 | UR-078] a comparison result built from one order fails validation and names the order field", () => {
  const result = judged();
  const oneOrder = JSON.parse(JSON.stringify(result));
  oneOrder.itemScores[0].orderScores = { [judge.ORDERS[0]]: 0.8 };
  const validation = judge.validateJudgeResult(oneOrder);
  assert.strictEqual(validation.ok, false);
  assert.ok(hasField(validation, "orderScores"), JSON.stringify(validation.errors));
});

test("[AC-10 | spec-evaluation-harness | FR-284 | UR-078] a comparison result with no order scores at all fails validation", () => {
  // Null/empty.
  const result = judged();
  const none = JSON.parse(JSON.stringify(result));
  delete none.itemScores[1].orderScores;
  const validation = judge.validateJudgeResult(none);
  assert.strictEqual(validation.ok, false);
  assert.ok(hasField(validation, "orderScores"));
});

// ---------------------------------------------------------------------------
// AC-11 and AC-12: mean over runs, with the run count stated
// ---------------------------------------------------------------------------

test("[AC-11 | spec-evaluation-harness | FR-285 | UR-078] a configured count of 3 and judge runs scoring 0.6, 0.7, and 0.8 read 0.7 and state 3 runs", () => {
  const byRun = { 1: 0.6, 2: 0.7, 3: 0.8 };
  const result = judged({ adapter: makeAdapter((call) => byRun[call.run]) });
  near(result.judgeScore, 0.7);
  assert.strictEqual(result.judgeRuns, 3);
  result.itemScores.forEach((entry) => {
    near(entry.score, 0.7);
    assert.strictEqual(entry.runs, 3);
  });
});

test("[AC-11 | spec-evaluation-harness | FR-285 | UR-078] each item is judged once per configured run in each order", () => {
  const adapter = makeAdapter(() => 0.6);
  judged({ adapter });
  RUBRIC.subjective.forEach((item) => {
    const calls = adapter.calls.filter((call) => call.itemId === item.id);
    assert.strictEqual(calls.length, 3 * 2, "item " + item.id + " ran " + calls.length + " calls");
  });
});

test("[AC-11 | spec-evaluation-harness | FR-285 | UR-078] a configured count of 1, the smallest, judges once per order and states 1 run", () => {
  // Boundary.
  const adapter = makeAdapter(() => 0.5);
  const result = judged({ adapter, config: config({ judgeRuns: 1 }) });
  assert.strictEqual(result.judgeRuns, 1);
  assert.strictEqual(adapter.calls.length, 3 * 2);
});

[undefined, null, 0, -1, 2.5, "3"].forEach((runs) => {
  test("[AC-11 | spec-evaluation-harness | FR-285 | UR-078] a judge run count of " + JSON.stringify(runs) + " in the configuration gives no judge score and no call, because the count has no default", () => {
    // Null/empty, boundary, and type mismatch.
    const adapter = makeAdapter(() => 0.6);
    const result = judge.judgeCase(request({ adapter, config: config({ judgeRuns: runs }) }));
    assert.strictEqual(result.judgeScore, null);
    assert.strictEqual(adapter.calls.length, 0);
  });
});

test("[AC-12 | spec-evaluation-harness | FR-285 | UR-078] a result that holds a judge score and no run count fails validation and names the run count", () => {
  const copy = JSON.parse(JSON.stringify(judged()));
  delete copy.judgeRuns;
  const validation = judge.validateJudgeResult(copy);
  assert.strictEqual(validation.ok, false);
  assert.ok(fieldsOf(validation).indexOf("judgeRuns") !== -1, JSON.stringify(validation.errors));
});

test("[AC-12 | spec-evaluation-harness | FR-285 | UR-078] a judge run count of 0 in a result fails validation", () => {
  // Boundary.
  const copy = JSON.parse(JSON.stringify(judged()));
  copy.judgeRuns = 0;
  const validation = judge.validateJudgeResult(copy);
  assert.strictEqual(validation.ok, false);
});

test("[AC-12 | spec-evaluation-harness | FR-285 | UR-078] an item score that does not state the run count it averages fails validation", () => {
  const copy = JSON.parse(JSON.stringify(judged()));
  delete copy.itemScores[0].runs;
  const validation = judge.validateJudgeResult(copy);
  assert.strictEqual(validation.ok, false);
});

test("[AC-11 | spec-evaluation-harness | FR-285 | UR-078] the exported mean of 0.6, 0.7, and 0.8 reads 0.7 and the mean of nothing reads null", () => {
  assert.strictEqual(judge.mean([0.6, 0.7, 0.8]), 0.7);
  assert.strictEqual(judge.mean([]), null);
  assert.strictEqual(judge.mean(undefined), null);
});

// ---------------------------------------------------------------------------
// AC-13: judge family, agent family, and the FR-282 mitigations
// ---------------------------------------------------------------------------

test("[AC-13 | spec-evaluation-harness | FR-282 | UR-080] a same-family result records the judge family and the agent family", () => {
  const result = judged();
  assert.strictEqual(result.judgeFamily, FAMILY);
  assert.strictEqual(result.agentFamily, FAMILY);
});

test("[AC-13 | spec-evaluation-harness | FR-282 | UR-080] a same-family result records the bias mitigations that were applied", () => {
  const result = judged();
  assert.ok(result.mitigations && typeof result.mitigations === "object", "the result records the mitigations");
  assert.ok(Object.keys(result.mitigations).length >= 3, "order handling, rubric anchoring, and the human-agreement check are recorded");
});

test("[AC-13 | spec-evaluation-harness | FR-282 | UR-080] a result with the mitigations removed fails validation and names the mitigations field", () => {
  const copy = JSON.parse(JSON.stringify(judged()));
  delete copy.mitigations;
  const validation = judge.validateJudgeResult(copy);
  assert.strictEqual(validation.ok, false);
  assert.ok(hasField(validation, "mitigations"), JSON.stringify(validation.errors));
});

test("[AC-13 | spec-evaluation-harness | FR-282 | UR-080] a result that records no candidate-order handling fails validation and names the field", () => {
  const copy = JSON.parse(JSON.stringify(judged()));
  copy.mitigations.orderHandling = "none";
  const validation = judge.validateJudgeResult(copy);
  assert.strictEqual(validation.ok, false);
  assert.ok(hasField(validation, "orderHandling"), JSON.stringify(validation.errors));
});

test("[AC-13 | spec-evaluation-harness | FR-282 | UR-080] a result that records no agent family fails validation and names the field", () => {
  const copy = JSON.parse(JSON.stringify(judged()));
  delete copy.agentFamily;
  const validation = judge.validateJudgeResult(copy);
  assert.strictEqual(validation.ok, false);
  assert.ok(fieldsOf(validation).indexOf("agentFamily") !== -1);
});

test("[AC-13 | spec-evaluation-harness | FR-282 | UR-080] a result that records no judge family fails validation and names the field", () => {
  const copy = JSON.parse(JSON.stringify(judged()));
  copy.judgeFamily = "";
  const validation = judge.validateJudgeResult(copy);
  assert.strictEqual(validation.ok, false);
  assert.ok(fieldsOf(validation).indexOf("judgeFamily") !== -1);
});

test("[AC-13 | spec-evaluation-harness | FR-282 | UR-080] a judge from a different model family than the agent is not run, because only a same-family judge is supported", () => {
  const adapter = makeAdapter(() => 0.6, { family: "family-beta" });
  const result = judge.judgeCase(request({ adapter }));
  assert.strictEqual(result.judgeScore, null);
  assert.strictEqual(adapter.calls.length, 0);
});

test("[AC-13 | spec-evaluation-harness | FR-282 | UR-080] a request that names no agent family is not judged, because both families must be recorded", () => {
  // Null/empty.
  const adapter = makeAdapter(() => 0.6);
  const result = judge.judgeCase(request({ adapter, agentFamily: undefined }));
  assert.strictEqual(result.judgeScore, null);
  assert.strictEqual(adapter.calls.length, 0);
});

test("[AC-13 | spec-evaluation-harness | FR-282 | UR-080] a result built by hand with different families fails validation", () => {
  const copy = JSON.parse(JSON.stringify(judged()));
  copy.judgeFamily = "family-beta";
  const validation = judge.validateJudgeResult(copy);
  assert.strictEqual(validation.ok, false);
});

// ---------------------------------------------------------------------------
// AC-16: judge unavailable
// ---------------------------------------------------------------------------

test("[AC-16 | spec-evaluation-harness | FR-268 | FR-270 | UR-078] a cleared case with the judge model unavailable reads judge absent and still reports the structural score", () => {
  const adapter = makeAdapter(() => 0.6, { isAvailable: () => false });
  const result = judge.judgeCase(request({ adapter, structural: structuralCleared(0.9) }));
  assert.strictEqual(result.status, judge.STATUS_ABSENT);
  assert.strictEqual(result.judgeScore, null);
  assert.strictEqual(result.structuralScore, 0.9);
  assert.strictEqual(adapter.calls.length, 0);
});

test("[AC-16 | spec-evaluation-harness | FR-268 | FR-270 | UR-078] a judge call that fails reads judge absent and still reports the structural score", () => {
  const adapter = { family: FAMILY, isAvailable: () => true, score: () => ({ ok: false }) };
  const result = judge.judgeCase(request({ adapter, structural: structuralCleared(0.9) }));
  assert.strictEqual(result.judgeScore, null);
  assert.strictEqual(result.structuralScore, 0.9);
});

test("[AC-16 | spec-evaluation-harness | FR-268 | FR-270 | UR-078] a judge that fails part-way through reads absent, never a score from the calls that did succeed", () => {
  let calls = 0;
  const adapter = {
    family: FAMILY,
    isAvailable: () => true,
    score: () => {
      calls += 1;
      return calls <= 4 ? { ok: true, score: 0.9 } : { ok: false };
    },
  };
  const result = judge.judgeCase(request({ adapter }));
  assert.strictEqual(result.judgeScore, null);
  assert.deepStrictEqual(result.itemScores, []);
});

test("[AC-16 | spec-evaluation-harness | FR-268 | FR-270 | UR-078] a judge that returns a score outside 0 to 1 reads absent", () => {
  // Boundary: just above the range.
  const result = judge.judgeCase(request({ adapter: makeAdapter(() => 1.01) }));
  assert.strictEqual(result.judgeScore, null);
});

test("[AC-16 | spec-evaluation-harness | FR-268 | FR-270 | UR-078] a judge that returns the boundary scores 0 and 1 is accepted", () => {
  // Boundary: both ends of the range.
  const zero = judge.judgeCase(request({ adapter: makeAdapter(() => 0) }));
  const one = judge.judgeCase(request({ adapter: makeAdapter(() => 1) }));
  assert.strictEqual(zero.status, judge.STATUS_JUDGED);
  assert.strictEqual(zero.judgeScore, 0);
  assert.strictEqual(one.status, judge.STATUS_JUDGED);
  assert.strictEqual(one.judgeScore, 1);
});

test("[AC-16 | spec-evaluation-harness | FR-268 | UR-078] a case with no output text or no reference text is not judged", () => {
  // Null/empty.
  const adapter = makeAdapter(() => 0.6);
  assert.strictEqual(judge.judgeCase(request({ adapter, outputText: "" })).judgeScore, null);
  assert.strictEqual(judge.judgeCase(request({ adapter, referenceText: undefined })).judgeScore, null);
  assert.strictEqual(adapter.calls.length, 0);
});

test("[AC-16 | spec-evaluation-harness | NFR-031] the judge logs hold neither the output text nor the reference text", () => {
  const lines = [];
  const logger = (level, message, fields) => lines.push(JSON.stringify({ level, message, fields }));
  judge.judgeCase(request({ logger, outputText: "SENSITIVE-OUTPUT-TEXT-8841", referenceText: "SENSITIVE-REFERENCE-TEXT-8842" }));
  assert.ok(lines.length > 0, "the judge logs its progress");
  const all = lines.join("\n");
  assert.ok(!all.includes("SENSITIVE-OUTPUT-TEXT-8841"));
  assert.ok(!all.includes("SENSITIVE-REFERENCE-TEXT-8842"));
});

// ---------------------------------------------------------------------------
// AC-14 and AC-15: agreement with a labeled sample, beside the provisional floor
// ---------------------------------------------------------------------------

function writeSample(entries) {
  const file = path.join(tmpDir(), "labeled-sample.json");
  fs.writeFileSync(file, JSON.stringify(entries));
  return file;
}

function twentyOutputSample(withLabels) {
  const entries = [];
  for (let i = 1; i <= 20; i += 1) {
    const entry = { id: "output-" + i, human: i / 20, judge: (i / 20) * 0.9 };
    if (withLabels) {
      entry.humanLabel = i % 2 === 0 ? "good" : "poor";
      entry.judgeLabel = i % 2 === 0 ? "good" : "poor";
    }
    entries.push(entry);
  }
  return entries;
}

test("[AC-14 | spec-evaluation-harness | FR-286 | UR-080] a labeled sample of 20 outputs gives a Spearman rho beside the floor and its provisional label", () => {
  const report = judge.reportAgreement(config({ labeledSamplePath: writeSample(twentyOutputSample(false)) }));
  assert.strictEqual(report.available, true);
  assert.strictEqual(report.sampleSize, 20);
  near(report.spearmanRho, 1);
  assert.match(report.statement, /Spearman rho/);
  assert.ok(report.statement.includes(FLOOR_LABEL), "the statement carries the provisional label: " + report.statement);
  assert.ok(report.statement.includes("0.7") && report.statement.includes("0.6"), "the statement shows the floor: " + report.statement);
});

test("[AC-14 | spec-evaluation-harness | FR-286 | UR-080] a labeled sample with category labels gives a Cohen kappa", () => {
  const report = judge.reportAgreement(config({ labeledSamplePath: writeSample(twentyOutputSample(true)) }));
  assert.strictEqual(report.available, true);
  near(report.cohenKappa, 1);
  assert.match(report.statement, /Cohen kappa/);
});

test("[AC-14 | spec-evaluation-harness | FR-286 | UR-080] a sample with no category labels reports rho and leaves kappa null", () => {
  const report = judge.reportAgreement(config({ labeledSamplePath: writeSample(twentyOutputSample(false)) }));
  assert.strictEqual(report.cohenKappa, null);
});

test("[AC-14 | spec-evaluation-harness | FR-286 | FR-279 | UR-080] a figure below the floor is reported and changes nothing: the judge stays advisory", () => {
  const reversed = twentyOutputSample(false).map((entry) => Object.assign({}, entry, { judge: 1 - entry.judge }));
  const report = judge.reportAgreement(config({ labeledSamplePath: writeSample(reversed) }));
  assert.strictEqual(report.available, true);
  near(report.spearmanRho, -1);
  const result = judged({ agreement: report });
  assert.strictEqual(result.status, judge.STATUS_JUDGED, "a low agreement figure must not stop the judge");
  assert.strictEqual(result.advisory, true);
  assert.strictEqual(result.agreement.available, true);
});

test("[AC-14 | spec-evaluation-harness | FR-286 | UR-080] a floor changed in the configuration shows in the report instead of the shipped floor", () => {
  const dir = tmpDir();
  const file = path.join(dir, "harness.config.json");
  fs.writeFileSync(
    file,
    JSON.stringify({
      oracleLocation: null,
      runCount: null,
      regressionMargin: null,
      referenceValidationRuns: null,
      judgeRuns: 3,
      newTasksPerRelease: null,
      retryOnFailure: 0,
      judgeEnabled: true,
      judgeAgreementFloor: { spearmanRho: 0.7, cohenKappa: 0.6, label: FLOOR_LABEL },
      judgeAgreementFloorOverride: { spearmanRho: 0.85, cohenKappa: 0.75, label: "user override after a 40-output sample" },
      labeledSamplePath: writeSample(twentyOutputSample(false)),
    })
  );
  const loaded = configModule.loadConfig(file, { require: ["judgeRuns"] });
  assert.strictEqual(loaded.ok, true, JSON.stringify(loaded.errors));
  const report = judge.reportAgreement(loaded.config);
  assert.ok(report.statement.includes("user override after a 40-output sample"), report.statement);
  assert.ok(report.statement.includes("0.85") && report.statement.includes("0.75"), report.statement);
  assert.ok(!report.statement.includes(FLOOR_LABEL), "the shipped label must not show beside an override: " + report.statement);
});

test("[AC-15 | spec-evaluation-harness | FR-286 | UR-080] with no labeled sample the report states that no agreement figure exists and still shows the provisional floor", () => {
  const report = judge.reportAgreement(config({ labeledSamplePath: null }));
  assert.strictEqual(report.available, false);
  assert.strictEqual(report.spearmanRho, null);
  assert.strictEqual(report.cohenKappa, null);
  assert.match(report.statement, /no agreement figure exists/i);
  assert.ok(report.statement.includes(FLOOR_LABEL), report.statement);
});

test("[AC-15 | spec-evaluation-harness | FR-286 | UR-080] a labeled sample path that cannot be read states that no agreement figure exists", () => {
  const report = judge.reportAgreement(config({ labeledSamplePath: path.join(tmpDir(), "no-such-sample.json") }));
  assert.strictEqual(report.available, false);
  assert.match(report.statement, /no agreement figure exists/i);
});

test("[AC-15 | spec-evaluation-harness | FR-286 | UR-080] a labeled sample that is not a list states that no agreement figure exists", () => {
  // Type mismatch.
  const file = path.join(tmpDir(), "sample.json");
  fs.writeFileSync(file, JSON.stringify({ human: 1, judge: 1 }));
  const report = judge.reportAgreement(config({ labeledSamplePath: file }));
  assert.strictEqual(report.available, false);
});

test("[AC-15 | spec-evaluation-harness | FR-286 | UR-080] an empty labeled sample states that no agreement figure exists", () => {
  // Null/empty.
  const report = judge.reportAgreement(config({ labeledSamplePath: writeSample([]) }));
  assert.strictEqual(report.available, false);
  assert.match(report.statement, /no agreement figure exists/i);
});

test("[AC-15 | spec-evaluation-harness | FR-286 | UR-080] a report with no configuration at all states that no agreement figure exists", () => {
  const report = judge.reportAgreement(undefined);
  assert.strictEqual(report.available, false);
  assert.match(report.statement, /no agreement figure exists/i);
});

test("[AC-15 | spec-evaluation-harness | FR-286 | UR-080] a judged result carries the agreement report, and with no sample it records no figure", () => {
  const result = judged({ config: config({ labeledSamplePath: null }) });
  assert.ok(result.agreement, "the result carries the agreement report");
  assert.strictEqual(result.agreement.available, false);
  assert.match(result.agreement.statement, /no agreement figure exists/i);
});

test("[AC-14 | spec-evaluation-harness | FR-286 | UR-080] a judged result with a labeled sample carries the figure", () => {
  const result = judged({ config: config({ labeledSamplePath: writeSample(twentyOutputSample(false)) }) });
  assert.strictEqual(result.agreement.available, true);
  near(result.agreement.spearmanRho, 1);
});

test("[AC-14 | spec-evaluation-harness | FR-286 | UR-080] spearmanRho reads 1 for the same order, -1 for the reverse order, and null for a constant list", () => {
  near(judge.spearmanRho([1, 2, 3, 4], [10, 20, 30, 40]), 1);
  near(judge.spearmanRho([1, 2, 3, 4], [40, 30, 20, 10]), -1);
  assert.strictEqual(judge.spearmanRho([1, 1, 1, 1], [1, 2, 3, 4]), null);
  assert.strictEqual(judge.spearmanRho([1], [1]), null);
});

test("[AC-14 | spec-evaluation-harness | FR-286 | UR-080] cohenKappa reads 1 for full agreement and 0 or below for no better than chance", () => {
  near(judge.cohenKappa(["a", "b", "a", "b"], ["a", "b", "a", "b"]), 1);
  assert.ok(judge.cohenKappa(["a", "b", "a", "b"], ["b", "a", "b", "a"]) < 0);
  assert.strictEqual(judge.cohenKappa(["a"], ["a"]), null);
});

test("[AC-14 | spec-evaluation-harness | FR-286 | UR-080] loadLabeledSample reads a valid sample and refuses one that holds no scored entry", () => {
  const good = judge.loadLabeledSample(writeSample(twentyOutputSample(false)));
  assert.strictEqual(good.ok, true);
  assert.strictEqual(good.pairs.length, 20);
  const bad = judge.loadLabeledSample(writeSample([{ id: "x", human: "high", judge: "low" }]));
  assert.strictEqual(bad.ok, false);
  const missing = judge.loadLabeledSample(path.join(tmpDir(), "none.json"));
  assert.strictEqual(missing.ok, false);
});
