// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Judge grader for spec tasks in the evaluation benchmark harness (Group A). An LLM-as-judge scores the subjective rubric
// items of a spec case. The judge is advisory (FR-279): this module adds no gate and no action keyed to a score or to the
// judge-agreement floor.
//
// Rules this module enforces:
//   - Same-family judge only (ASM-4, OQ-16). A judge whose model family differs from the agent's has no path here.
//   - The judge runs only on a case that cleared the structural checklist (every deterministic item passed, A-13). An
//     uncleared case, an unconfigured judge, or an unavailable judge model gives a judge score of null (absent). The
//     structural score is still reported, and it is never folded into the judge score.
//   - Each subjective rubric item is scored separately, against that item's own text (FR-283).
//   - Each item is compared against the reference in BOTH orders, output-then-reference and reference-then-output, and the
//     two are averaged (FR-284). The order handling is recorded in the result. FR-282 is met by this both-orders mean; the
//     harness adds no per-run randomization of the candidate order (settled, ASM-9).
//   - Each judge score is the mean of J judge runs, J from the harness configuration, and J is stated (FR-285).
//   - The result holds the structural score and the judge score as two values. A field that combines them fails
//     validation and is named (FR-270).
//   - The result records the judge family and the agent family, and a same-family result with no recorded mitigation fails
//     validation (FR-282).
//
// The model call sits behind the adapter (ASM-7b, confirm in B3; the runner's judge-grader config schema is unverified):
//   adapter.family                     the judge model family, a non-empty string
//   adapter.isAvailable()              optional; false means the judge model is unavailable
//   adapter.score(call)                returns { ok: true, score } with score in [0, 1] for the OUTPUT, or { ok: false }
//   call = { itemId, itemText, anchors, first: { role, text }, second: { role, text }, order, run }
//          role is "output" or "reference"; `order` names which of the two comes first.
// Judge call texts are never logged. A log line holds an event name, a case id, and a fixed reason code.
//
// The human-agreement check (FR-286) reads the labeled sample at the configured path. Its format is a plan choice (B2):
// a JSON list of { "id", "human", "judge" } with numeric scores, and optional "humanLabel" and "judgeLabel" strings for
// Cohen kappa. The floor is read from the configuration with its label. This module hard-codes no threshold.
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");

const oracleModule = require("./oracle.js");

const ORDER_OUTPUT_FIRST = "output-then-reference";
const ORDER_REFERENCE_FIRST = "reference-then-output";
const ORDERS = [ORDER_OUTPUT_FIRST, ORDER_REFERENCE_FIRST];

// The values recorded for the three FR-282 mitigations.
const ORDER_HANDLING_BOTH = "both-orders-mean";
const RUBRIC_ANCHORING_PER_ITEM = "per-item-text";
const AGREEMENT_REPORTED = "reported";
const AGREEMENT_NO_SAMPLE = "no-sample";

const STATUS_JUDGED = "judged";
const STATUS_ABSENT = "absent";

const MAX_SAMPLE_BYTES = 1024 * 1024;
const PRECISION = 1e12;
const EPSILON = 1e-9;

// Keys this module writes. Any other key is checked for a combination of the two scores.
const KNOWN_KEYS = [
  "status",
  "reason",
  "caseId",
  "advisory",
  "structuralScore",
  "judgeScore",
  "judgeRuns",
  "itemScores",
  "judgeFamily",
  "agentFamily",
  "mitigations",
  "agreement",
];
const COMBINED_NAME = /combined|composite|blend|merged|weighted|average|mean/i;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isScore(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function round(value) {
  return Math.round(value * PRECISION) / PRECISION;
}

// Mean of a list of numbers, rounded so that 0.6, 0.7, and 0.8 read 0.7. An empty list reads null.
function mean(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

// ---------------------------------------------------------------------------------------------------------------------
// Agreement with human scores (FR-286)
// ---------------------------------------------------------------------------------------------------------------------

// Average ranks, so tied values share one rank.
function ranksOf(values) {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = new Array(values.length);
  let start = 0;
  while (start < order.length) {
    let end = start;
    while (end + 1 < order.length && order[end + 1].value === order[start].value) {
      end += 1;
    }
    const rank = (start + end) / 2 + 1;
    for (let at = start; at <= end; at += 1) {
      ranks[order[at].index] = rank;
    }
    start = end + 1;
  }
  return ranks;
}

function pearson(a, b) {
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  let cross = 0;
  let spreadA = 0;
  let spreadB = 0;
  for (let index = 0; index < a.length; index += 1) {
    cross += (a[index] - meanA) * (b[index] - meanB);
    spreadA += (a[index] - meanA) * (a[index] - meanA);
    spreadB += (b[index] - meanB) * (b[index] - meanB);
  }
  if (spreadA === 0 || spreadB === 0) {
    return null;
  }
  return cross / Math.sqrt(spreadA * spreadB);
}

// Spearman rank correlation of two equal-length numeric lists, or null when it is undefined (fewer than 2 pairs, or one
// side constant).
function spearmanRho(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length < 2) {
    return null;
  }
  const value = pearson(ranksOf(a), ranksOf(b));
  return value === null ? null : round(value);
}

// Cohen kappa of two equal-length label lists, or null when it is undefined (fewer than 2 pairs, or chance agreement 1).
function cohenKappa(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length < 2) {
    return null;
  }
  const total = a.length;
  const countA = {};
  const countB = {};
  let agree = 0;
  for (let index = 0; index < total; index += 1) {
    countA[a[index]] = (countA[a[index]] || 0) + 1;
    countB[b[index]] = (countB[b[index]] || 0) + 1;
    if (a[index] === b[index]) {
      agree += 1;
    }
  }
  let chance = 0;
  Object.keys(countA).forEach((name) => {
    chance += (countA[name] / total) * ((countB[name] || 0) / total);
  });
  if (chance === 1) {
    return null;
  }
  return round((agree / total - chance) / (1 - chance));
}

// Reads the labeled sample. Returns { ok: true, pairs } or { ok: false, reason } with fixed text.
function loadLabeledSample(samplePath) {
  let parsed;
  try {
    if (fs.statSync(samplePath).size > MAX_SAMPLE_BYTES) {
      return { ok: false, reason: "labeled sample is too large" };
    }
    parsed = JSON.parse(fs.readFileSync(samplePath, "utf8"));
  } catch (error) {
    return { ok: false, reason: "labeled sample could not be read" };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, reason: "labeled sample must be a list" };
  }
  const pairs = parsed.filter((entry) => isObject(entry) && Number.isFinite(entry.human) && Number.isFinite(entry.judge));
  if (pairs.length === 0) {
    return { ok: false, reason: "labeled sample holds no entry with a human score and a judge score" };
  }
  return { ok: true, pairs };
}

function floorSentence(floor) {
  if (!isObject(floor)) {
    return "no judge-agreement floor is configured";
  }
  return "Judge-agreement floor (" + floor.label + "): Spearman rho at least " + floor.spearmanRho + " or Cohen kappa at least " + floor.cohenKappa;
}

function figure(value) {
  return String(Number(value.toFixed(3)));
}

// [FR-286] reportAgreement(config) reports the judge's agreement with the human scores of the labeled sample, beside the
// configured floor and its label. With no sample it states that no agreement figure exists. It never compares the figure
// with the floor and never acts on it; the judge stays advisory (FR-279).
function reportAgreement(config) {
  const settings = config || {};
  const floor = settings.judgeAgreementFloor || null;
  const none = (why) => ({
    available: false,
    sampleSize: 0,
    spearmanRho: null,
    cohenKappa: null,
    floor,
    statement: "No agreement figure exists: " + why + ". " + floorSentence(floor),
  });
  if (!isNonEmptyString(settings.labeledSamplePath)) {
    return none("no human-labeled sample is configured");
  }
  const sample = loadLabeledSample(settings.labeledSamplePath);
  if (!sample.ok) {
    return none(sample.reason);
  }
  const rho = spearmanRho(sample.pairs.map((pair) => pair.human), sample.pairs.map((pair) => pair.judge));
  const labeled = sample.pairs.every((pair) => isNonEmptyString(pair.humanLabel) && isNonEmptyString(pair.judgeLabel));
  const kappa = labeled ? cohenKappa(sample.pairs.map((pair) => pair.humanLabel), sample.pairs.map((pair) => pair.judgeLabel)) : null;
  if (rho === null && kappa === null) {
    return none("the labeled sample gives no defined correlation or kappa");
  }
  const parts = [];
  if (rho !== null) {
    parts.push("Spearman rho " + figure(rho));
  }
  if (kappa !== null) {
    parts.push("Cohen kappa " + figure(kappa));
  }
  return {
    available: true,
    sampleSize: sample.pairs.length,
    spearmanRho: rho,
    cohenKappa: kappa,
    floor,
    statement: "Judge agreement with human scores over " + sample.pairs.length + " labeled outputs: " + parts.join(", ") + ". " + floorSentence(floor),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Judging
// ---------------------------------------------------------------------------------------------------------------------

function baseResult(settings, structural) {
  const adapter = settings.adapter;
  return {
    status: STATUS_ABSENT,
    reason: null,
    caseId: typeof settings.caseId === "string" ? settings.caseId : null,
    advisory: true,
    // [FR-265] A structural run that read error carries no score, so the value stays null and never 0.
    structuralScore: isObject(structural) && structural.status === "scored" && isScore(structural.score) ? structural.score : null,
    judgeScore: null,
    judgeRuns: null,
    itemScores: [],
    judgeFamily: adapter && isNonEmptyString(adapter.family) ? adapter.family : null,
    agentFamily: isNonEmptyString(settings.agentFamily) ? settings.agentFamily : null,
    mitigations: null,
    agreement: null,
  };
}

function absent(result, reason, log) {
  log("info", "judge.absent", { caseId: result.caseId, reason });
  return Object.assign(result, { status: STATUS_ABSENT, reason });
}

// Returns the subjective items, or null when any item lacks an id or a text, or an id is used twice.
function subjectiveItems(rubric) {
  if (!isObject(rubric) || !Array.isArray(rubric.subjective) || rubric.subjective.length === 0) {
    return null;
  }
  const seen = [];
  for (let index = 0; index < rubric.subjective.length; index += 1) {
    const item = rubric.subjective[index];
    if (!isObject(item) || !isNonEmptyString(item.id) || !isNonEmptyString(item.text) || seen.indexOf(item.id) !== -1) {
      return null;
    }
    seen.push(item.id);
  }
  return rubric.subjective;
}

function judgeIsAvailable(adapter) {
  if (typeof adapter.isAvailable !== "function") {
    return true;
  }
  try {
    return adapter.isAvailable() !== false;
  } catch (error) {
    return false;
  }
}

function pairFor(order, outputText, referenceText) {
  const output = { role: "output", text: outputText };
  const reference = { role: "reference", text: referenceText };
  return order === ORDER_OUTPUT_FIRST ? { first: output, second: reference } : { first: reference, second: output };
}

// [FR-268|FR-269|FR-270|FR-282|FR-283|FR-284|FR-285|FR-286] judgeCase(request) scores the subjective items of one spec case.
//   request.caseId, request.agentFamily
//   request.structural   the result of scoreSpecRun(); the judge runs only when it is scored and cleared
//   request.rubric       { subjective: [{ id, text, anchors? }] }
//   request.outputText, request.referenceText
//   request.config       the loaded harness configuration (judgeEnabled, judgeRuns, judgeAgreementFloor, labeledSamplePath)
//   request.adapter      the model adapter; see the header
//   request.agreement    optional report from reportAgreement(), computed once per release by the caller
//   request.logger       optional
// Returns the result object, which validateJudgeResult() accepts. An absent judge score carries a fixed `reason`.
function judgeCase(request) {
  const settings = request || {};
  const log = oracleModule.loggerOf(settings);
  const config = isObject(settings.config) ? settings.config : {};
  const adapter = isObject(settings.adapter) ? settings.adapter : null;
  const result = baseResult(Object.assign({}, settings, { adapter }), settings.structural);

  // [FR-268] No judge configured: structural only, judge absent.
  if (config.judgeEnabled !== true || adapter === null || typeof adapter.score !== "function") {
    return absent(result, "judge is not configured", log);
  }
  // [FR-269|A-13] The judge runs only on a case whose deterministic items all passed.
  if (!isObject(settings.structural) || settings.structural.status !== "scored" || settings.structural.cleared !== true) {
    return absent(result, "case did not clear the structural checklist", log);
  }
  // [FR-285] The run count comes from the configuration and has no default here.
  if (!Number.isInteger(config.judgeRuns) || config.judgeRuns < 1) {
    return absent(result, "judge run count is not configured", log);
  }
  // [FR-282] Both families are recorded. [ASM-4] Only a same-family judge runs.
  if (result.judgeFamily === null || result.agentFamily === null) {
    return absent(result, "judge family or agent family is not recorded", log);
  }
  if (result.judgeFamily !== result.agentFamily) {
    return absent(result, "only a same-family judge is supported", log);
  }
  const items = subjectiveItems(settings.rubric);
  if (items === null) {
    return absent(result, "rubric subjective items are missing or not valid", log);
  }
  if (!isNonEmptyString(settings.outputText) || !isNonEmptyString(settings.referenceText)) {
    return absent(result, "output or reference text is missing", log);
  }
  // [FR-270] An unavailable judge model gives an absent judge score; the structural score stands.
  if (!judgeIsAvailable(adapter)) {
    return absent(result, "judge model is unavailable", log);
  }

  const runs = config.judgeRuns;
  const itemScores = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const byOrder = {};
    ORDERS.forEach((order) => {
      byOrder[order] = [];
    });
    for (let run = 1; run <= runs; run += 1) {
      for (let at = 0; at < ORDERS.length; at += 1) {
        const order = ORDERS[at];
        const pair = pairFor(order, settings.outputText, settings.referenceText);
        let answer;
        try {
          answer = adapter.score({
            itemId: item.id,
            itemText: item.text,
            anchors: item.anchors === undefined ? null : item.anchors,
            first: pair.first,
            second: pair.second,
            order,
            run,
          });
        } catch (error) {
          return absent(result, "judge model is unavailable", log);
        }
        if (!isObject(answer) || answer.ok !== true) {
          return absent(result, "judge model is unavailable", log);
        }
        if (!isScore(answer.score)) {
          return absent(result, "judge returned a score outside 0 to 1", log);
        }
        byOrder[order].push(answer.score);
      }
    }
    // [FR-284] The run score is the mean of the two orders; [FR-285] the item score is the mean over the J runs.
    const runScores = [];
    for (let run = 0; run < runs; run += 1) {
      runScores.push(mean([byOrder[ORDER_OUTPUT_FIRST][run], byOrder[ORDER_REFERENCE_FIRST][run]]));
    }
    const orderScores = {};
    ORDERS.forEach((order) => {
      orderScores[order] = mean(byOrder[order]);
    });
    itemScores.push({ id: item.id, score: mean(runScores), runs, runScores, orderScores });
  }

  const agreement = isObject(settings.agreement) ? settings.agreement : reportAgreement(config);
  result.status = STATUS_JUDGED;
  result.judgeScore = mean(itemScores.map((entry) => entry.score));
  result.judgeRuns = runs;
  result.itemScores = itemScores;
  result.mitigations = {
    orderHandling: ORDER_HANDLING_BOTH,
    rubricAnchoring: RUBRIC_ANCHORING_PER_ITEM,
    humanAgreement: agreement.available === true ? AGREEMENT_REPORTED : AGREEMENT_NO_SAMPLE,
  };
  result.agreement = agreement;
  log("info", "judge.judged", { caseId: result.caseId, runs, items: itemScores.length });
  return result;
}

// ---------------------------------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------------------------------

function problem(field, message) {
  return { field, message };
}

// [FR-270] Names every field that combines the structural and the judge score: by a name that says so, or by a numeric
// value equal to their mean.
function combinedFields(result) {
  const structural = result.structuralScore;
  const judge = result.judgeScore;
  const midpoint = isScore(structural) && isScore(judge) ? (structural + judge) / 2 : null;
  return Object.keys(result).filter((key) => {
    if (KNOWN_KEYS.indexOf(key) !== -1) {
      return false;
    }
    const value = result[key];
    return COMBINED_NAME.test(key) || (midpoint !== null && typeof value === "number" && Math.abs(value - midpoint) < EPSILON);
  });
}

function itemProblems(entry, index, runs, errors) {
  const field = "itemScores[" + index + "]";
  if (!isObject(entry) || !isNonEmptyString(entry.id) || !isScore(entry.score)) {
    errors.push(problem(field, "each item score needs an id and a score between 0 and 1"));
    return;
  }
  // [FR-285] Each item score states the run count it is the mean of.
  if (!Number.isInteger(entry.runs) || entry.runs < 1 || entry.runs !== runs) {
    errors.push(problem(field + ".runs", "item score must state the judge run count"));
  }
  // [FR-284] A comparison holds both orders.
  const orders = isObject(entry.orderScores) ? entry.orderScores : {};
  ORDERS.forEach((order) => {
    if (!isScore(orders[order])) {
      errors.push(problem(field + ".orderScores", "comparison result is missing the " + order + " order"));
    }
  });
}

// [FR-270|FR-282|FR-283|FR-284|FR-285] validateJudgeResult(result) fails a result that combines the two scores (naming the
// field), holds a judge score with no item scores, with one comparison order, with no run count, or from a same-family judge
// with no recorded mitigation. Returns { ok, errors: [{ field, message }] }.
function validateJudgeResult(result) {
  if (!isObject(result)) {
    return { ok: false, errors: [problem("result", "must be an object")] };
  }
  const errors = [];
  ["structuralScore", "judgeScore"].forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(result, key)) {
      errors.push(problem(key, "result must hold the structural score and the judge score as two values"));
    } else if (result[key] !== null && !isScore(result[key])) {
      errors.push(problem(key, "must be a number between 0 and 1, or null when absent"));
    }
  });
  combinedFields(result).forEach((key) => {
    errors.push(problem(key, "result must not combine the structural score and the judge score into one field"));
  });
  if (result.judgeScore === null || result.judgeScore === undefined) {
    return { ok: errors.length === 0, errors };
  }

  if (!Number.isInteger(result.judgeRuns) || result.judgeRuns < 1) {
    errors.push(problem("judgeRuns", "judge score must state the number of judge runs"));
  }
  if (!Array.isArray(result.itemScores) || result.itemScores.length === 0) {
    errors.push(problem("itemScores", "judge result needs one score per subjective item, not a single overall score"));
  } else {
    result.itemScores.forEach((entry, index) => itemProblems(entry, index, result.judgeRuns, errors));
  }
  if (!isNonEmptyString(result.judgeFamily)) {
    errors.push(problem("judgeFamily", "result must record the judge model family"));
  }
  if (!isNonEmptyString(result.agentFamily)) {
    errors.push(problem("agentFamily", "result must record the agent model family"));
  }
  if (isNonEmptyString(result.judgeFamily) && isNonEmptyString(result.agentFamily)) {
    if (result.judgeFamily !== result.agentFamily) {
      errors.push(problem("judgeFamily", "only a same-family judge is supported"));
    } else {
      const mitigations = isObject(result.mitigations) ? result.mitigations : {};
      if (mitigations.orderHandling !== ORDER_HANDLING_BOTH) {
        errors.push(problem("mitigations.orderHandling", "same-family judge result records no both-orders handling"));
      }
      if (mitigations.rubricAnchoring !== RUBRIC_ANCHORING_PER_ITEM) {
        errors.push(problem("mitigations.rubricAnchoring", "same-family judge result records no per-item rubric anchoring"));
      }
      if (mitigations.humanAgreement !== AGREEMENT_REPORTED && mitigations.humanAgreement !== AGREEMENT_NO_SAMPLE) {
        errors.push(problem("mitigations.humanAgreement", "same-family judge result records no human-agreement check"));
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  judgeCase,
  validateJudgeResult,
  reportAgreement,
  loadLabeledSample,
  spearmanRho,
  cohenKappa,
  mean,
  ORDERS,
  STATUS_JUDGED,
  STATUS_ABSENT,
};
