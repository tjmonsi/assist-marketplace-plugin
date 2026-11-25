// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Release-over-release comparison for the evaluation benchmark harness (Group A).
//
// Each suite score is computed from the stored per-case records of the two releases (scoreboard.js), never from the stored
// aggregate rows: the mean pass@1 of a coding suite ("dev") and the mean structural score of a spec suite ("spec"). The
// mean runs only over the case ids present in both releases, so a case added or removed between releases enters neither
// score. A case whose score is absent in either release (every run read not-run, or the structural check could not run)
// is left out of both means too, so the two means describe the same cases.
//
// Findings and notes:
//   regression finding   the structural or pass@1 score is below the previous release by MORE than the configured margin.
//                        The margin comes from the harness configuration (loadMargin); this module holds no margin.
//   advisory note        a judge-score decline beyond the margin (FR-279); a suite with no case new since the previous
//                        release (FR-281); a suite whose score is absent; no baseline.
// No previous release means no baseline and no finding. An absent score raises no finding.
// No dependencies; ES2015 syntax only.
"use strict";

const configModule = require("./config.js");
const scoreboardModule = require("./scoreboard.js");

// The stored field each suite is scored on, and its label in reports.
const SUITE_FIELD = { dev: "passAtOne", spec: "structuralScore" };
const SUITE_LABEL = { dev: "pass@1", spec: "structural score" };

const PRECISION = 1e12;

function round(value) {
  return Math.round(value * PRECISION) / PRECISION;
}

function isFraction(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function meanOf(values) {
  return values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function byCaseId(records) {
  const map = {};
  records.forEach((record) => {
    map[record.caseId] = record;
  });
  return map;
}

// [FR-277] loadMargin(configPath) reads the configured regression margin. An unset or invalid value is an error and no
// default number stands in for it.
function loadMargin(configPath) {
  const loaded = configModule.loadConfig(configPath, { require: ["regressionMargin"] });
  if (!loaded.ok) {
    return { ok: false, margin: null, errors: loaded.errors };
  }
  return { ok: true, margin: loaded.config.regressionMargin, errors: [] };
}

function present(record, field) {
  return record !== undefined && record[field] !== null && record[field] !== undefined;
}

// Mean of `field` over the ids that hold a score in both record sets, or null when no id does.
function pairedMeans(ids, currentById, previousById, field) {
  const usable = ids.filter((id) => present(currentById[id], field) && present(previousById[id], field));
  return {
    current: meanOf(usable.map((id) => currentById[id][field])),
    previous: meanOf(usable.map((id) => previousById[id][field])),
  };
}

function suiteResult(suite, version) {
  return {
    suite,
    version,
    previousVersion: null,
    baseline: false,
    current: null,
    previous: null,
    judgeCurrent: null,
    judgePrevious: null,
    sharedCases: [],
    newCases: [],
    findings: [],
    notes: [],
  };
}

// [FR-273|FR-277|FR-278|FR-279|FR-281] Compares one suite of `version` with the newest earlier release that holds
// per-case records for it.
function compareSuite(scoreboard, version, suite, margin) {
  const result = suiteResult(suite, version);
  const field = SUITE_FIELD[suite];
  const label = SUITE_LABEL[suite];
  const currentRecords = scoreboardModule.casesFor(scoreboard, version, suite);
  const previousVersion = scoreboardModule.previousVersion(scoreboard, version, suite);

  // [FR-273] No previous release: report the current score alone, no baseline, no finding.
  if (previousVersion === null) {
    result.current = meanOf(currentRecords.filter((record) => present(record, field)).map((record) => record[field]));
    result.notes.push("suite " + suite + ": no baseline, no previous release holds scores for this suite");
    return result;
  }

  result.previousVersion = previousVersion;
  result.baseline = true;
  const previousRecords = scoreboardModule.casesFor(scoreboard, previousVersion, suite);
  const currentById = byCaseId(currentRecords);
  const previousById = byCaseId(previousRecords);
  // [FR-278] Only the case ids present in both releases enter either score.
  result.sharedCases = Object.keys(currentById).filter((id) => Object.prototype.hasOwnProperty.call(previousById, id)).sort();
  result.newCases = Object.keys(currentById).filter((id) => !Object.prototype.hasOwnProperty.call(previousById, id)).sort();

  const scores = pairedMeans(result.sharedCases, currentById, previousById, field);
  result.current = scores.current;
  result.previous = scores.previous;

  // Empty suite: no admitted case, or every run read not-run. The score is absent and raises no finding.
  if (scores.current === null) {
    result.notes.push("suite " + suite + ": " + label + " is absent, no case holds a score in both releases");
  } else if (round(scores.previous - scores.current) > margin) {
    // [FR-277] A drop beyond the configured margin is a regression finding.
    result.findings.push(
      "regression: suite " + suite + " " + label + " fell from " + scoreboardModule.formatScore(scores.previous) + " (" + previousVersion + ") to " +
        scoreboardModule.formatScore(scores.current) + " (" + version + "), beyond the margin " + margin
    );
  }

  // [FR-279] A judge-score decline is advisory only.
  if (suite === "spec") {
    const judge = pairedMeans(result.sharedCases, currentById, previousById, "judgeScore");
    result.judgeCurrent = judge.current;
    result.judgePrevious = judge.previous;
    if (judge.current !== null && round(judge.previous - judge.current) > margin) {
      result.notes.push(
        "advisory: suite spec judge score fell from " + scoreboardModule.formatScore(judge.previous) + " (" + previousVersion + ") to " +
          scoreboardModule.formatScore(judge.current) + " (" + version + ")"
      );
    }
  }

  // [FR-281] A suite with cases and none new since the previous release gets an advisory note naming the suite.
  if (currentRecords.length > 0 && result.newCases.length === 0) {
    result.notes.push("advisory: suite " + suite + " has no case new since " + previousVersion);
  }
  return result;
}

// [FR-273|FR-277|FR-278|FR-279|FR-281] compareReleases({ scoreboard, version, margin, suites }) compares the release
// `version` with the previous release, per suite. `suites` defaults to the suites that hold a row or a record for
// `version`. Returns { ok: true, version, margin, suites, findings, notes } or { ok: false, reason } with fixed text.
function compareReleases(request) {
  const settings = request || {};
  const scoreboard = settings.scoreboard;
  if (!scoreboard || !Array.isArray(scoreboard.cases) || !Array.isArray(scoreboard.aggregates)) {
    return { ok: false, reason: "scoreboard is not available" };
  }
  if (typeof settings.version !== "string" || !scoreboardModule.VERSION_PATTERN.test(settings.version)) {
    return { ok: false, reason: "release version is not a version number" };
  }
  if (!isFraction(settings.margin)) {
    return { ok: false, reason: "regression margin is not set" };
  }
  const known = scoreboardModule.SUITES;
  const wanted = Array.isArray(settings.suites) ? settings.suites.filter((suite) => known.indexOf(suite) !== -1) : known;
  const suites = wanted.filter((suite) => {
    return scoreboard.aggregates.some((row) => row.version === settings.version && row.suite === suite) || scoreboardModule.casesFor(scoreboard, settings.version, suite).length > 0;
  });
  const results = suites.map((suite) => compareSuite(scoreboard, settings.version, suite, settings.margin));
  return {
    ok: true,
    version: settings.version,
    margin: settings.margin,
    suites: results,
    findings: results.reduce((all, entry) => all.concat(entry.findings), []),
    notes: results.reduce((all, entry) => all.concat(entry.notes), []),
  };
}

// [FR-273] The current and previous score of each suite, as report lines. Scores, versions, and suite names only.
function reportLines(comparison) {
  if (!comparison || !comparison.ok) {
    return [];
  }
  return comparison.suites.map((entry) => {
    const label = SUITE_LABEL[entry.suite];
    const previous = entry.baseline ? scoreboardModule.formatScore(entry.previous) + " (" + entry.previousVersion + ")" : "no baseline";
    let line = entry.suite + ": " + label + " current " + scoreboardModule.formatScore(entry.current) + " (" + entry.version + "), previous " + previous;
    if (entry.suite === "spec" && entry.baseline) {
      line += "; judge current " + scoreboardModule.formatScore(entry.judgeCurrent) + ", previous " + scoreboardModule.formatScore(entry.judgePrevious);
    }
    return line;
  });
}

module.exports = { compareReleases, reportLines, loadMargin, SUITE_FIELD, SUITE_LABEL };
