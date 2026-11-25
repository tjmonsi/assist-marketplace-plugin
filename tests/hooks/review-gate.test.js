// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the gate counting library of the reviewer machinery
// (plugins/assist-plugin/hooks/lib/review-gate.js), task plan
// docs/task-plans/task-plan-reviewer-machinery-20261125-0717.md, Step 21.
//
// Sources: specs/spec-reviewer-machinery.md (Requirement 4: Dispatch lane reviews concurrently and record the dispatch count;
// Requirement 9: Do not count a verdict against a changed artifact; Requirement 12: Run a design pass after repeated
// fix-induced findings; Requirement 13: Stop early on a finding that stays open; Requirement 14: Show the per-round history at
// an escalation; the OQ-17 provisional count of two), docs/requirements/FR-NFR-harness-governance.md (FR-292, FR-297, FR-300,
// FR-301, FR-302, NFR-041, FR-218), and the public interface:
//   countApprovals(rounds, currentRevision) -> {count, required, ended, stale}   two consecutive approved on the current
//                                                revision end a gate; a verdict on another revision does not count
//   dispatchLimit(running, ready)           -> {start, hold, record}             at most three reviewer dispatches at once
//   roundHistory(rounds)                    -> one row per round {round, new, fixed, open, withdrawn, fixInduced,
//                                              noStatusData}; fixed, open, and withdrawn are null when the round held no
//                                              statuses
//   loopGuard(rounds, config)               -> {designPass, earlyStop, fixInducedRun, openRun, openFindings, thresholds,
//                                              defaultsApplied}; config {fixInducedCount, openCount}; each count falls back
//                                              to a provisional default of 2
//   PROVISIONAL_GUARD_DEFAULTS, APPROVALS_REQUIRED, MAX_CONCURRENT_DISPATCHES
//   Round {verdict, revision, findings: [{id, status}], statuses: [{id, status, new_evidence?}]}
// The spec carries no SPEC-NNN id, so it is cited by file name. The library body is never read.
//
// Traceability format: [AC-N | spec-reviewer-machinery | FR-nnn]. AC-N is the position of the Scenario inside its Requirement.
//
// Run: node --test tests/hooks/review-gate.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const gate = require(path.join(REPO, "plugins", "assist-plugin", "hooks", "lib", "review-gate.js"));

const SPEC = "spec-reviewer-machinery";
function tag(ac, fr) {
  return "[AC-" + ac + " | " + SPEC + " | " + fr + "]";
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.keys(value).forEach((k) => deepFreeze(value[k]));
  }
  return value;
}

function nw(id) {
  return { id: id, status: "new" };
}
function fi(id) {
  return { id: id, status: "fix-induced" };
}
function st(id, status, newEvidence) {
  const s = { id: id, status: status };
  if (newEvidence !== undefined) s.new_evidence = newEvidence;
  return s;
}
function round(findings, statuses, over) {
  return Object.assign({ verdict: "returned", revision: "A", findings: findings || [], statuses: statuses || [] }, over || {});
}
function approved(revision) {
  return { verdict: "approved", revision: revision, findings: [], statuses: [] };
}

// ---------------------------------------------------------------------------
// Constants of the interface
// ---------------------------------------------------------------------------

test(tag(1, "FR-297") + " two consecutive approvals end a gate: the required count is two", () => {
  assert.strictEqual(gate.APPROVALS_REQUIRED, 2);
});

test(tag(2, "FR-292") + " at most three reviewer dispatches run at once, the number of lanes", () => {
  assert.strictEqual(gate.MAX_CONCURRENT_DISPATCHES, 3);
});

test(tag(1, "FR-300") + " the guard defaults are declared in one named provisional constant: two for each count (OQ-17)", () => {
  assert.ok(gate.PROVISIONAL_GUARD_DEFAULTS, "no PROVISIONAL_GUARD_DEFAULTS export");
  assert.deepStrictEqual(Object.assign({}, gate.PROVISIONAL_GUARD_DEFAULTS), { fixInducedCount: 2, openCount: 2 });
  assert.ok(Object.isFrozen(gate.PROVISIONAL_GUARD_DEFAULTS), "the defaults are not changed at run time");
});

test(tag(1, "FR-218") + " the cap of 10 iterations is not a parameter or an export of this library", () => {
  const keys = Object.keys(gate);
  assert.deepStrictEqual(keys.filter((k) => /CAP|ITERATION|MAX_ROUNDS/i.test(k)), []);
});

// ---------------------------------------------------------------------------
// Requirement 9: approvals tied to the current revision
// ---------------------------------------------------------------------------

test(tag(1, "FR-297") + " two consecutive approved reports that name the same current revision end the gate approved", () => {
  const res = gate.countApprovals([approved("A"), approved("A")], "A");
  assert.strictEqual(res.ended, true);
  assert.strictEqual(res.count, 2);
  assert.strictEqual(res.required, 2);
  assert.strictEqual(res.stale, 0);
});

test(tag(2, "FR-297") + " an approved report on revision A does not count once the artifact is revision B", () => {
  const res = gate.countApprovals([approved("A")], "B");
  assert.strictEqual(res.count, 0);
  assert.strictEqual(res.ended, false);
  assert.strictEqual(res.stale, 1);
});

test(tag(2, "FR-297") + " two approvals that both name revision A do not end the gate when the current revision is B", () => {
  const res = gate.countApprovals([approved("A"), approved("A")], "B");
  assert.strictEqual(res.ended, false);
  assert.strictEqual(res.count, 0);
  assert.strictEqual(res.stale, 2);
});

test(tag(2, "FR-297") + " approvals on two different revisions do not add up: the older one is stale and one counted approval does not end the gate", () => {
  const res = gate.countApprovals([approved("A"), approved("B")], "B");
  assert.strictEqual(res.count, 1);
  assert.strictEqual(res.ended, false);
  assert.strictEqual(res.stale, 1);
});

test(tag(1, "FR-297") + " one approved report on the current revision is not enough", () => {
  const res = gate.countApprovals([approved("A")], "A");
  assert.strictEqual(res.count, 1);
  assert.strictEqual(res.ended, false);
});

test(tag(1, "FR-297") + " the approvals must be consecutive: a returned round between two approvals leaves one counted approval", () => {
  const res = gate.countApprovals([approved("A"), round([nw("F-1")], [], { revision: "A" }), approved("A")], "A");
  assert.strictEqual(res.count, 1);
  assert.strictEqual(res.ended, false);
});

test(tag(1, "FR-297") + " a returned round before two approvals does not block them", () => {
  const res = gate.countApprovals([round([nw("F-1")], [], { revision: "A" }), approved("A"), approved("A")], "A");
  assert.strictEqual(res.ended, true);
});

test(tag(1, "FR-297") + " a gate with no round, or only returned rounds, has no approval", () => {
  assert.strictEqual(gate.countApprovals([], "A").count, 0);
  assert.strictEqual(gate.countApprovals([], "A").ended, false);
  assert.strictEqual(gate.countApprovals([round([nw("F-1")])], "A").count, 0);
});

test(tag(2, "FR-297") + " with no current revision (unknown, empty, or not a string) nothing counts and the gate stays open", () => {
  // Null/empty and type-mismatch: the safe answer when the revision cannot be recomputed.
  [undefined, null, "", 0, 7, {}, []].forEach((cur) => {
    const res = gate.countApprovals([approved("A"), approved("A")], cur);
    assert.strictEqual(res.ended, false, "current revision " + JSON.stringify(cur));
    assert.strictEqual(res.count, 0, "current revision " + JSON.stringify(cur));
  });
});

test(tag(2, "FR-297") + " the revision comparison is exact: a different case, a prefix, or surrounding space is another revision", () => {
  ["a", "ABC", "9f2c1ab0", " 9f2c1ab04d7e", "9f2c1ab04d7e "].forEach((named) => {
    const res = gate.countApprovals([approved(named), approved(named)], "9f2c1ab04d7e");
    assert.strictEqual(res.ended, false, "named " + JSON.stringify(named));
  });
  assert.strictEqual(gate.countApprovals([approved("9f2c1ab04d7e"), approved("9f2c1ab04d7e")], "9f2c1ab04d7e").ended, true);
});

test(tag(2, "FR-297") + " an approved round that names no revision never counts", () => {
  const noRev = { verdict: "approved", findings: [], statuses: [] };
  const res = gate.countApprovals([noRev, noRev], "A");
  assert.strictEqual(res.ended, false);
  assert.strictEqual(res.count, 0);
});

test(tag(2, "FR-297") + " a verdict word other than approved never counts as an approval", () => {
  ["Approved", "APPROVED", "approve", "lgtm", "", null, undefined, true].forEach((verdict) => {
    const r = { verdict: verdict, revision: "A", findings: [], statuses: [] };
    assert.strictEqual(gate.countApprovals([r, r], "A").ended, false, "verdict " + JSON.stringify(verdict));
  });
});

test(tag(2, "FR-297") + " countApprovals does not throw for rounds of the wrong type and keeps the gate open", () => {
  [undefined, null, 0, "approved", {}, [null], [undefined, 5, "x"], [[]]].forEach((rounds) => {
    let res;
    assert.doesNotThrow(() => {
      res = gate.countApprovals(rounds, "A");
    }, JSON.stringify(rounds));
    assert.strictEqual(res.ended, false);
    assert.strictEqual(res.count, 0);
  });
});

test(tag(1, "FR-297") + " countApprovals does not change a frozen input", () => {
  const rounds = deepFreeze([approved("A"), approved("A")]);
  assert.doesNotThrow(() => gate.countApprovals(rounds, "A"));
});

// ---------------------------------------------------------------------------
// Requirement 4: the dispatch cap and the dispatch count
// ---------------------------------------------------------------------------

test(tag(1, "NFR-041") + " a gate with three lane reviews ready and none running may start all three, and the gate outcome records three dispatches", () => {
  const res = gate.dispatchLimit(0, 3);
  assert.strictEqual(res.start, 3);
  assert.strictEqual(res.hold, 0);
  assert.strictEqual(res.record, 3);
});

test(tag(2, "FR-292") + " three dispatches running and a fourth ready: the fourth is held until one ends", () => {
  const res = gate.dispatchLimit(3, 1);
  assert.strictEqual(res.start, 0);
  assert.strictEqual(res.hold, 1);
});

test(tag(2, "FR-292") + " the cap leaves room for the dispatches that fit: two running and three ready start one and hold two", () => {
  const res = gate.dispatchLimit(2, 3);
  assert.strictEqual(res.start, 1);
  assert.strictEqual(res.hold, 2);
});

test(tag(2, "FR-292") + " more ready than the cap starts three and holds the rest", () => {
  const res = gate.dispatchLimit(0, 5);
  assert.strictEqual(res.start, 3);
  assert.strictEqual(res.hold, 2);
});

test(tag(1, "FR-292") + " nothing ready starts nothing", () => {
  const res = gate.dispatchLimit(1, 0);
  assert.strictEqual(res.start, 0);
  assert.strictEqual(res.hold, 0);
  assert.strictEqual(res.record, 0);
});

test(tag(2, "FR-292") + " a running count above the cap starts nothing and holds every ready dispatch", () => {
  // Boundary and over-boundary: the cap is three, so four running is already over it.
  const res = gate.dispatchLimit(4, 2);
  assert.strictEqual(res.start, 0);
  assert.strictEqual(res.hold, 2);
});

test(tag(2, "FR-292") + " over every combination of running (0 to 5) and ready (0 to 6), no more than three run at once and every ready dispatch is either started or held", () => {
  for (let running = 0; running <= 5; running += 1) {
    for (let ready = 0; ready <= 6; ready += 1) {
      const res = gate.dispatchLimit(running, ready);
      const label = "running " + running + " ready " + ready;
      assert.ok(res.start >= 0 && res.hold >= 0, label);
      assert.ok(res.start <= ready, label);
      assert.strictEqual(res.start + res.hold, ready, label);
      if (running <= 3) assert.ok(running + res.start <= 3, label + ": the cap of three");
      else assert.strictEqual(res.start, 0, label);
    }
  }
});

test(tag(2, "FR-292") + " a running or ready count that is not a whole number of zero or more starts nothing", () => {
  // Invalid and type-mismatch inputs take the safe value.
  [[-1, 2], [1.5, 1], [NaN, 1], ["1", 1], [null, 1], [undefined, 1], [Infinity, 1], [0, -1], [0, 1.5], [0, NaN], [0, "2"], [0, null]].forEach((pair) => {
    const res = gate.dispatchLimit(pair[0], pair[1]);
    assert.strictEqual(res.start, 0, JSON.stringify(pair));
    assert.strictEqual(res.record, 0, JSON.stringify(pair));
  });
});

// ---------------------------------------------------------------------------
// Requirement 14: the per-round history
// ---------------------------------------------------------------------------

test(tag(1, "FR-302") + " an escalation after four rounds gives four rows, each with counts of new, fixed, open, and withdrawn findings", () => {
  const rounds = [
    round([nw("F-1"), nw("F-2"), nw("F-3")]),
    round([nw("F-4")], [st("F-1", "fixed"), st("F-2", "open"), st("F-3", "withdrawn")]),
    round([fi("F-5")], [st("F-2", "open"), st("F-4", "fixed")]),
    round([], [st("F-2", "open"), st("F-5", "fixed")]),
  ];
  const rows = gate.roundHistory(rounds);
  assert.strictEqual(rows.length, 4);
  rows.forEach((row) => {
    ["new", "fixed", "open", "withdrawn"].forEach((k) => assert.ok(k in row, "row has " + k));
  });
  const numbers = rows.map((r) => r.round);
  for (let i = 1; i < numbers.length; i += 1) assert.ok(numbers[i] > numbers[i - 1], "rounds are in order: " + numbers.join(","));
});

test(tag(1, "FR-302") + " the counts of a round with statuses are the counts of its findings and statuses", () => {
  const rows = gate.roundHistory([round([nw("F-1"), nw("F-2"), nw("F-3")]), round([nw("F-4")], [st("F-1", "fixed"), st("F-2", "open"), st("F-3", "withdrawn")])]);
  assert.strictEqual(rows[1].new, 1);
  assert.strictEqual(rows[1].fixed, 1);
  assert.strictEqual(rows[1].open, 1);
  assert.strictEqual(rows[1].withdrawn, 1);
  assert.strictEqual(rows[1].noStatusData, false);
});

test(tag(1, "FR-302") + " new counts a fix-induced finding, and fixInduced counts the fix-induced ones alone", () => {
  const rows = gate.roundHistory([round([nw("F-1")]), round([fi("F-2"), nw("F-3")], [st("F-1", "fixed")])]);
  assert.strictEqual(rows[1].new, 2);
  assert.strictEqual(rows[1].fixInduced, 1);
});

test(tag(1, "FR-302") + " a round with statuses but none of one kind reports 0 for it, not no data", () => {
  const rows = gate.roundHistory([round([nw("F-1")]), round([], [st("F-1", "fixed")])]);
  assert.strictEqual(rows[1].fixed, 1);
  assert.strictEqual(rows[1].open, 0);
  assert.strictEqual(rows[1].withdrawn, 0);
  assert.strictEqual(rows[1].noStatusData, false);
});

test(tag(2, "FR-302") + " a round whose report held no statuses is marked as having no status data, never as zero", () => {
  [round([nw("F-1")], []), round([nw("F-1")], undefined), { verdict: "returned", revision: "A", findings: [nw("F-1")] }, round([nw("F-1")], null)].forEach((r, i) => {
    const rows = gate.roundHistory([r]);
    assert.strictEqual(rows.length, 1, "case " + i);
    assert.strictEqual(rows[0].noStatusData, true, "case " + i);
    assert.strictEqual(rows[0].fixed, null, "case " + i);
    assert.strictEqual(rows[0].open, null, "case " + i);
    assert.strictEqual(rows[0].withdrawn, null, "case " + i);
  });
});

test(tag(2, "FR-302") + " one status-less round among four is the only row marked as having no status data", () => {
  const rounds = [
    round([nw("F-1")]),
    round([], [st("F-1", "open")]),
    round([nw("F-2")]),
    round([], [st("F-1", "fixed"), st("F-2", "open")]),
  ];
  const rows = gate.roundHistory(rounds);
  assert.deepStrictEqual(rows.map((r) => r.noStatusData), [true, false, true, false]);
});

test(tag(1, "FR-302") + " a gate with no round has no history row", () => {
  assert.deepStrictEqual(gate.roundHistory([]), []);
});

test(tag(2, "FR-302") + " roundHistory returns a list and does not throw for rounds of the wrong type", () => {
  [undefined, null, 0, "x", {}, [null], [undefined, 5], [{}], [{ findings: "x", statuses: 5 }]].forEach((bad) => {
    let rows;
    assert.doesNotThrow(() => {
      rows = gate.roundHistory(bad);
    }, JSON.stringify(bad));
    assert.ok(Array.isArray(rows), JSON.stringify(bad));
  });
});

test(tag(1, "FR-302") + " roundHistory does not change a frozen input", () => {
  const rounds = deepFreeze([round([nw("F-1")]), round([], [st("F-1", "fixed")])]);
  assert.doesNotThrow(() => gate.roundHistory(rounds));
});

// ---------------------------------------------------------------------------
// Requirement 12: the design-pass signal
// ---------------------------------------------------------------------------

test(tag(1, "FR-300") + " passes 2 and 3 each return a fix-induced finding: with no count passed, the provisional default of two signals a design pass", () => {
  const rounds = [round([nw("F-1")]), round([fi("F-2")], [st("F-1", "fixed")]), round([fi("F-3")], [st("F-2", "fixed")])];
  const res = gate.loopGuard(rounds);
  assert.strictEqual(res.designPass, true);
  assert.strictEqual(res.fixInducedRun, 2);
});

test(tag(2, "FR-300") + " only pass 2 returns a fix-induced finding: no design pass, the normal fix pass runs", () => {
  const rounds = [round([nw("F-1")]), round([fi("F-2")], [st("F-1", "fixed")])];
  const res = gate.loopGuard(rounds);
  assert.strictEqual(res.designPass, false);
  assert.strictEqual(res.fixInducedRun, 1);
});

test(tag(2, "FR-300") + " a fix-induced pass followed by a pass with none does not signal, and a gap between two fix-induced passes does not signal", () => {
  assert.strictEqual(gate.loopGuard([round([fi("F-1")]), round([nw("F-2")])]).designPass, false);
  assert.strictEqual(gate.loopGuard([round([fi("F-1")]), round([nw("F-2")]), round([fi("F-3")])]).designPass, false);
});

test(tag(1, "FR-300") + " three consecutive fix-induced passes still signal with the default of two, and the run is three", () => {
  const rounds = [round([fi("F-1")]), round([fi("F-2")]), round([fi("F-3")])];
  const res = gate.loopGuard(rounds, {});
  assert.strictEqual(res.designPass, true);
  assert.strictEqual(res.fixInducedRun, 3);
});

test(tag(2, "FR-300") + " an explicit count of 3 overrides the default: two fix-induced passes do not signal, three do", () => {
  const two = [round([fi("F-1")]), round([fi("F-2")])];
  const three = two.concat([round([fi("F-3")])]);
  assert.strictEqual(gate.loopGuard(two, { fixInducedCount: 3 }).designPass, false);
  assert.strictEqual(gate.loopGuard(three, { fixInducedCount: 3 }).designPass, true);
});

test(tag(2, "FR-300") + " an explicit count of 1 signals on a single fix-induced pass", () => {
  assert.strictEqual(gate.loopGuard([round([fi("F-1")])], { fixInducedCount: 1 }).designPass, true);
});

test(tag(2, "FR-300") + " the thresholds in the result show the count used, and the defaults applied name each count that took its provisional default", () => {
  const byDefault = gate.loopGuard([]);
  assert.strictEqual(byDefault.thresholds.fixInducedCount, 2);
  assert.strictEqual(byDefault.thresholds.openCount, 2);
  const names = JSON.stringify(byDefault.defaultsApplied);
  assert.ok(names.indexOf("fixInducedCount") !== -1 && names.indexOf("openCount") !== -1, "both counts are named: " + names);

  const explicit = gate.loopGuard([], { fixInducedCount: 4, openCount: 5 });
  assert.strictEqual(explicit.thresholds.fixInducedCount, 4);
  assert.strictEqual(explicit.thresholds.openCount, 5);
  const none = JSON.stringify(explicit.defaultsApplied);
  assert.ok(none.indexOf("fixInducedCount") === -1 && none.indexOf("openCount") === -1, "no default applied: " + none);

  const partial = gate.loopGuard([], { fixInducedCount: 4 });
  assert.strictEqual(partial.thresholds.fixInducedCount, 4);
  assert.strictEqual(partial.thresholds.openCount, 2);
  const mixed = JSON.stringify(partial.defaultsApplied);
  assert.ok(mixed.indexOf("openCount") !== -1 && mixed.indexOf("fixInducedCount") === -1, "only openCount took its default: " + mixed);
});

test(tag(2, "FR-300") + " a count that is not a whole number of 1 or more falls back to the provisional default of two", () => {
  // Invalid and type-mismatch counts: zero, negative, fractional, text, not-a-number, null, and an object.
  const rounds = [round([fi("F-1")]), round([fi("F-2")])];
  [0, -1, 1.5, "2", NaN, null, {}, [], Infinity].forEach((bad) => {
    const res = gate.loopGuard(rounds, { fixInducedCount: bad, openCount: bad });
    assert.strictEqual(res.thresholds.fixInducedCount, 2, "count " + JSON.stringify(bad));
    assert.strictEqual(res.thresholds.openCount, 2, "count " + JSON.stringify(bad));
    assert.strictEqual(res.designPass, true, "count " + JSON.stringify(bad));
  });
});

test(tag(2, "FR-300") + " a config that is not an object leaves the defaults in place", () => {
  const rounds = [round([fi("F-1")]), round([fi("F-2")])];
  [undefined, null, "x", 5, [], true].forEach((cfg) => {
    assert.strictEqual(gate.loopGuard(rounds, cfg).designPass, true, "config " + JSON.stringify(cfg));
  });
});

test(tag(2, "FR-300") + " the provisional defaults are not changed by a call that overrides them", () => {
  gate.loopGuard([round([fi("F-1")])], { fixInducedCount: 1, openCount: 9 });
  assert.deepStrictEqual(Object.assign({}, gate.PROVISIONAL_GUARD_DEFAULTS), { fixInducedCount: 2, openCount: 2 });
});

// ---------------------------------------------------------------------------
// Requirement 13: the early-stop signal
// ---------------------------------------------------------------------------

test(tag(1, "FR-301") + " F-4 stays open after fix passes 1 and 2 with no new evidence: the default of two signals an early stop that names F-4", () => {
  const rounds = [round([nw("F-4")]), round([], [st("F-4", "open", false)]), round([], [st("F-4", "open", false)])];
  const res = gate.loopGuard(rounds);
  assert.strictEqual(res.earlyStop, true);
  assert.deepStrictEqual(res.openFindings.slice().sort(), ["F-4"]);
  assert.strictEqual(res.openRun, 2);
});

test(tag(1, "FR-301") + " an open status with no new_evidence field counts as no new evidence", () => {
  const rounds = [round([nw("F-4")]), round([], [st("F-4", "open")]), round([], [st("F-4", "open")])];
  assert.strictEqual(gate.loopGuard(rounds).earlyStop, true);
});

test(tag(2, "FR-301") + " the re-review cites new evidence for F-4: the loop continues", () => {
  const rounds = [round([nw("F-4")]), round([], [st("F-4", "open", false)]), round([], [st("F-4", "open", true)])];
  const res = gate.loopGuard(rounds);
  assert.strictEqual(res.earlyStop, false);
  assert.deepStrictEqual(res.openFindings, []);
});

test(tag(2, "FR-301") + " new evidence on the earlier of the two open passes leaves a run of one, so the loop continues", () => {
  const rounds = [round([nw("F-4")]), round([], [st("F-4", "open", true)]), round([], [st("F-4", "open", false)])];
  const res = gate.loopGuard(rounds);
  assert.strictEqual(res.earlyStop, false);
  assert.strictEqual(res.openRun, 1);
});

test(tag(2, "FR-301") + " a finding open in one pass only does not stop the loop", () => {
  const res = gate.loopGuard([round([nw("F-4")]), round([], [st("F-4", "open")])]);
  assert.strictEqual(res.earlyStop, false);
});

test(tag(2, "FR-301") + " a finding that was open and is now fixed or withdrawn does not stop the loop", () => {
  const fixed = gate.loopGuard([round([nw("F-4")]), round([], [st("F-4", "open")]), round([], [st("F-4", "fixed")])]);
  assert.strictEqual(fixed.earlyStop, false);
  const withdrawn = gate.loopGuard([round([nw("F-4")]), round([], [st("F-4", "open")]), round([], [st("F-4", "withdrawn")])]);
  assert.strictEqual(withdrawn.earlyStop, false);
});

test(tag(2, "FR-301") + " two different findings open in two passes are not the same finding: no early stop", () => {
  const res = gate.loopGuard([round([nw("F-4"), nw("F-5")]), round([], [st("F-4", "open")]), round([], [st("F-5", "open")])]);
  assert.strictEqual(res.earlyStop, false);
});

test(tag(1, "FR-301") + " every finding that stays open without new evidence is named, and one that moved on is not", () => {
  const rounds = [
    round([nw("F-4"), nw("F-5"), nw("F-6")]),
    round([], [st("F-4", "open"), st("F-5", "open"), st("F-6", "open")]),
    round([], [st("F-4", "open"), st("F-5", "open"), st("F-6", "fixed")]),
  ];
  const res = gate.loopGuard(rounds);
  assert.strictEqual(res.earlyStop, true);
  assert.deepStrictEqual(res.openFindings.slice().sort(), ["F-4", "F-5"]);
});

test(tag(2, "FR-301") + " an explicit open count of 3 overrides the default: two open passes do not stop the loop, three do", () => {
  const two = [round([nw("F-4")]), round([], [st("F-4", "open")]), round([], [st("F-4", "open")])];
  const three = two.concat([round([], [st("F-4", "open")])]);
  assert.strictEqual(gate.loopGuard(two, { openCount: 3 }).earlyStop, false);
  assert.strictEqual(gate.loopGuard(three, { openCount: 3 }).earlyStop, true);
  assert.strictEqual(gate.loopGuard(two, { openCount: 3 }).thresholds.openCount, 3);
});

test(tag(1, "FR-300") + " the two signals are independent: a design pass does not set an early stop, and an early stop does not set a design pass", () => {
  const design = gate.loopGuard([round([fi("F-1")]), round([fi("F-2")])]);
  assert.strictEqual(design.designPass, true);
  assert.strictEqual(design.earlyStop, false);
  const stop = gate.loopGuard([round([nw("F-4")]), round([], [st("F-4", "open")]), round([], [st("F-4", "open")])]);
  assert.strictEqual(stop.earlyStop, true);
  assert.strictEqual(stop.designPass, false);
});

test(tag(2, "FR-301") + " a long run of returned rounds with no finding and no status gives no signal: the library adds no cap of its own", () => {
  const rounds = [];
  for (let i = 0; i < 12; i += 1) rounds.push(round([], []));
  const res = gate.loopGuard(rounds, { cap: 1, maxIterations: 1, iterations: 12 });
  assert.strictEqual(res.designPass, false);
  assert.strictEqual(res.earlyStop, false);
});

test(tag(2, "FR-301") + " loopGuard gives no signal and does not throw for rounds of the wrong type", () => {
  [undefined, null, 0, "x", {}, [null], [undefined, 5, "x"], [{}], [{ findings: "x", statuses: 5 }], [[], []]].forEach((bad) => {
    let res;
    assert.doesNotThrow(() => {
      res = gate.loopGuard(bad, {});
    }, JSON.stringify(bad));
    assert.strictEqual(res.designPass, false, JSON.stringify(bad));
    assert.strictEqual(res.earlyStop, false, JSON.stringify(bad));
  });
});

test(tag(1, "FR-301") + " loopGuard does not change a frozen input", () => {
  const rounds = deepFreeze([round([nw("F-4")]), round([], [st("F-4", "open")]), round([], [st("F-4", "open")])]);
  const config = deepFreeze({ fixInducedCount: 2, openCount: 2 });
  assert.doesNotThrow(() => gate.loopGuard(rounds, config));
});
