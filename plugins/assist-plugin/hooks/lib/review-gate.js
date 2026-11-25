// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [spec-reviewer-machinery Req 9 -> FR-297] The deterministic gate rules the /do orchestrator applies between review rounds:
// the stale-verdict check (countApprovals), the concurrent dispatch cap (dispatchLimit), the per-round history shown at an
// escalation (roundHistory), and the two loop signals (loopGuard). Pure functions: no I/O, no state, no model, no network. None
// throws; an input they cannot read yields the safe answer (no approval counted, nothing dispatched, no signal).
// Spec: specs/spec-reviewer-machinery.md. The orchestrator calls them through `node -e`, the way it calls lib/sarif.js.
// CommonJS, ES2015 syntax, no dependencies.
//
// Round shape (the orchestrator builds one per review report it read):
//   verdict    "approved" or "returned"
//   revision   the revision the report named
//   findings   [{id, status}]            status "new" or "fix-induced" for a defect found in that round
//   statuses   [{id, status, new_evidence?}]   status "fixed", "open", or "withdrawn" for a prior finding;
//                                          new_evidence is true when the re-review cited new evidence for it
//
// The cap of 10 iterations of FR-218 is not a parameter and this library does not change it.
"use strict";

// [spec-reviewer-machinery Req 9 -> FR-297] Two consecutive `approved` verdicts end a gate (FR-218, spec-orchestration-review-gates
// Requirement 4). This value is fixed by the existing gate and is not provisional.
const APPROVALS_REQUIRED = 2;

// [spec-reviewer-machinery Req 4 -> FR-292] At most three reviewer dispatches run at once: one for each lane. Fixed by the spec.
const MAX_CONCURRENT_DISPATCHES = 3;

// PROVISIONAL (OQ-17, U-1): configured defaults for the two loop signals, to be revised with data. Each is the count of
// consecutive passes that raises the signal. A count in the `config` of loopGuard overrides its default.
//   fixInducedCount  [FR-300] consecutive re-reviews that each return a fix-induced finding before a design pass
//   openCount        [FR-301] consecutive re-reviews that report the same finding open, with no new evidence, before an early stop
const PROVISIONAL_GUARD_DEFAULTS = Object.freeze({ fixInducedCount: 2, openCount: 2 });

const STATUS_NEW = "new";
const STATUS_FIX_INDUCED = "fix-induced";
const PRIOR_STATUSES = ["fixed", "open", "withdrawn"];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function listOf(value) {
  return Array.isArray(value) ? value : [];
}

function isCount(value) {
  return Number.isInteger(value) && value >= 0;
}

function isApproved(round, revision) {
  return isRecord(round) && round.verdict === "approved" && round.revision === revision;
}

// [spec-reviewer-machinery Req 9 -> FR-297] [RULE-005] The approvals that count toward a gate. A verdict counts only when the
// revision it names equals `currentRevision`; a report on an earlier revision does not count and ends a run of approvals.
// The gate ends only when the last two rounds are both `approved` on the current revision. Returns
//   {count, required, ended, stale}
// where `count` is the run of counted approvals ending at the last round, `ended` is true at `required` (two), and `stale`
// is the number of `approved` rounds that name another revision. With no current revision nothing counts and the gate stays open.
function countApprovals(rounds, currentRevision) {
  const open = { count: 0, required: APPROVALS_REQUIRED, ended: false, stale: 0 };
  try {
    if (!Array.isArray(rounds) || typeof currentRevision !== "string" || currentRevision.length === 0) return open;
    const stale = rounds.filter((round) => isRecord(round) && round.verdict === "approved" && round.revision !== currentRevision).length;
    let count = 0;
    for (let i = rounds.length - 1; i >= 0 && isApproved(rounds[i], currentRevision); i--) count++;
    return { count, required: APPROVALS_REQUIRED, ended: count >= APPROVALS_REQUIRED, stale };
  } catch (err) {
    return open;
  }
}

// [spec-reviewer-machinery Req 4 -> FR-292] [NFR-041] [RULE-003] How many of `ready` reviewer dispatches may start while
// `running` are running, under the cap of three. Returns {start, hold, record}: `start` dispatches now, `hold` wait for one
// running dispatch to end, and `record` is the count to add to the dispatch count of the gate outcome. A count that is not a
// whole number of zero or more is treated as the safe value: running at the cap, nothing ready.
function dispatchLimit(running, ready) {
  const busy = isCount(running) ? running : MAX_CONCURRENT_DISPATCHES;
  const waiting = isCount(ready) ? ready : 0;
  const start = Math.min(waiting, Math.max(0, MAX_CONCURRENT_DISPATCHES - busy));
  return { start, hold: waiting - start, record: start };
}

// [spec-reviewer-machinery Req 14 -> FR-302] [RULE-007] One row for each round: {round, new, fixed, open, withdrawn, fixInduced,
// noStatusData}. `new` counts the findings the round tagged new or fix-induced, and `fixInduced` counts the second kind alone.
// A round whose report held no statuses is marked `noStatusData: true` and its fixed, open, and withdrawn counts are null, never 0.
function roundHistory(rounds) {
  return listOf(rounds).map((round, index) => {
    const own = isRecord(round) ? round : {};
    const findings = listOf(own.findings).filter(isRecord);
    const statuses = listOf(own.statuses).filter((entry) => isRecord(entry) && PRIOR_STATUSES.indexOf(entry.status) !== -1);
    const noStatusData = statuses.length === 0;
    const countOf = (status) => (noStatusData ? null : statuses.filter((entry) => entry.status === status).length);
    return {
      round: Number.isInteger(own.round) && own.round > 0 ? own.round : index + 1,
      new: findings.filter((finding) => finding.status === STATUS_NEW || finding.status === STATUS_FIX_INDUCED).length,
      fixed: countOf("fixed"),
      open: countOf("open"),
      withdrawn: countOf("withdrawn"),
      fixInduced: findings.filter((finding) => finding.status === STATUS_FIX_INDUCED).length,
      noStatusData,
    };
  });
}

// The guard counts of `config`, each falling back to its provisional default. Returns {thresholds, defaultsApplied}.
function guardThresholds(config) {
  const own = isRecord(config) ? config : {};
  const thresholds = {};
  const defaultsApplied = [];
  Object.keys(PROVISIONAL_GUARD_DEFAULTS).forEach((name) => {
    if (Number.isInteger(own[name]) && own[name] >= 1) {
      thresholds[name] = own[name];
    } else {
      thresholds[name] = PROVISIONAL_GUARD_DEFAULTS[name];
      defaultsApplied.push(name);
    }
  });
  return { thresholds, defaultsApplied };
}

// The length of the run of rounds that ends at the last round and holds a fix-induced finding.
function fixInducedRun(rounds) {
  let run = 0;
  for (let i = rounds.length - 1; i >= 0; i--) {
    const findings = isRecord(rounds[i]) ? listOf(rounds[i].findings) : [];
    if (!findings.some((finding) => isRecord(finding) && finding.status === STATUS_FIX_INDUCED)) break;
    run++;
  }
  return run;
}

// The number of rounds, ending at the last round, in which the prior finding `id` stays open with no new evidence.
function openRun(rounds, id) {
  let run = 0;
  for (let i = rounds.length - 1; i >= 0; i--) {
    const statuses = isRecord(rounds[i]) ? listOf(rounds[i].statuses) : [];
    if (!statuses.some((entry) => isRecord(entry) && entry.id === id && entry.status === "open" && entry.new_evidence !== true)) break;
    run++;
  }
  return run;
}

// [spec-reviewer-machinery Req 12 -> FR-300] [spec-reviewer-machinery Req 13 -> FR-301] [RULE-006] The two loop signals over
// the rounds of one gate. `config` is {fixInducedCount, openCount}; a count that is absent or not a whole number of 1 or more
// falls back to PROVISIONAL_GUARD_DEFAULTS (2 each). Returns
//   {designPass, earlyStop, fixInducedRun, openRun, openFindings, thresholds, defaultsApplied}
// `designPass` is true when the last `fixInducedCount` rounds each hold a fix-induced finding: the orchestrator should dispatch
// one code-reviewer pass over the whole artifact before another fix pass. `earlyStop` is true when a prior finding stays open,
// with no new evidence, in the last `openCount` rounds: the orchestrator should stop the loop and offer continue, waive, or
// abort. `openFindings` lists the ids behind `earlyStop`. `defaultsApplied` names each count that took its provisional default,
// so a caller can label it provisional.
function loopGuard(rounds, config) {
  const { thresholds, defaultsApplied } = guardThresholds(config);
  const quiet = { designPass: false, earlyStop: false, fixInducedRun: 0, openRun: 0, openFindings: [], thresholds, defaultsApplied };
  try {
    if (!Array.isArray(rounds) || rounds.length === 0) return quiet;
    const last = isRecord(rounds[rounds.length - 1]) ? rounds[rounds.length - 1] : {};
    const openIds = listOf(last.statuses)
      .filter((entry) => isRecord(entry) && entry.status === "open" && typeof entry.id === "string")
      .map((entry) => entry.id)
      .filter((id, index, all) => all.indexOf(id) === index);
    const runs = openIds.map((id) => ({ id, run: openRun(rounds, id) }));
    const longestOpen = runs.reduce((most, entry) => Math.max(most, entry.run), 0);
    const fixRun = fixInducedRun(rounds);
    return {
      designPass: fixRun >= thresholds.fixInducedCount,
      earlyStop: longestOpen >= thresholds.openCount,
      fixInducedRun: fixRun,
      openRun: longestOpen,
      openFindings: runs.filter((entry) => entry.run >= thresholds.openCount).map((entry) => entry.id),
      thresholds,
      defaultsApplied,
    };
  } catch (err) {
    return quiet;
  }
}

module.exports = { APPROVALS_REQUIRED, MAX_CONCURRENT_DISPATCHES, PROVISIONAL_GUARD_DEFAULTS, countApprovals, dispatchLimit, roundHistory, loopGuard };
