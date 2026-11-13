// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Text contract tests for the governance control register plugins/assist-plugin/rules/control-register.md
// (harness-governance Tranche 5, task plan Steps 38 and 41).
//
// Sources: specs/spec-governance-control-register.md (Requirements: Control-ID row set and inclusion rule, Register
// schema, Owner roles and escalation, Per-regulation status is fixed) and docs/requirements/FR-NFR-harness-governance.md
// v1.3 (FR-235, FR-236, FR-219, FR-220, FR-230, FR-232, FR-246, NFR-028, NFR-033, NFR-035). The spec fixes the 31-row
// set and, per row, the requirement ids, the NIST function, and the owner role; the ASI letters are directional
// (NFR-033), so the tests check an ASI cell for shape and for the pairing of an id with its published name, not for the
// letter the reviewer chose. The check script does not enforce the row set (the spec says the Step 41 tests do), so this
// file does.
//
// Traceability format: [AC-N | spec file Requirement | FR/NFR/UR ids]. The spec carries no SPEC-NNN id, so it is cited by
// file name. AC-N is the position of the Scenario inside its Requirement in the spec. A case with no Scenario of its own
// carries the Requirement name in place of an AC number.
//
// Run: node --test tests/docs/contracts-docs-governance.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");

const SPEC = "spec-governance-control-register.md";
const ROWSET = SPEC + " Requirement: Control-ID row set and inclusion rule";
const SCHEMA = SPEC + " Requirement: Register schema";
const OWNERS = SPEC + " Requirement: Owner roles and escalation";
const STATUS = SPEC + " Requirement: Per-regulation status is fixed";

// ---------------------------------------------------------------------------
// Reading the register
// ---------------------------------------------------------------------------

const REGISTER_TEXT = fs.readFileSync(path.join(PLUGIN, "rules", "control-register.md"), "utf8");

function linesOf(text) {
  return text.split(/\r?\n/);
}

// Lines under `heading` up to the next level-2 heading, outside code fences.
function section(text, heading) {
  const lines = linesOf(text);
  const out = [];
  let on = false;
  let fence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (!fence && /^## /.test(line)) {
      if (on) break;
      if (line.trim() === heading) on = true;
      continue;
    }
    if (on) out.push(line);
  }
  return out;
}

function cellsOf(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

// The first table under `## Register`: header, separator, then one entry per data row.
function registerRows() {
  const lines = section(REGISTER_TEXT, "## Register").filter((l) => l.trim().charAt(0) === "|");
  assert.ok(lines.length >= 3, "the register holds a header, a separator, and rows");
  return lines.slice(2).map((line) => ({ line: line, cells: cellsOf(line) }));
}

const ROWS = registerRows();

function row(id) {
  const found = ROWS.find((r) => r.cells[0] === id);
  assert.ok(found, "the register has a row " + id);
  return found;
}

// The bullet of the Per-regulation status section that opens with the given control marker, for example
// "CTL-246 (FR-246)". A bullet that merely mentions the control in passing does not match.
function statusBullet(marker) {
  const lines = section(REGISTER_TEXT, "## Per-regulation status");
  assert.ok(lines.length > 0, "the Per-regulation status section exists");
  const bullet = lines.find((l) => /^- \*\*/.test(l) && l.indexOf(marker) !== -1);
  assert.ok(bullet, "a Per-regulation status bullet for " + marker);
  return bullet;
}

// The spec's row set: id -> {reqs, nist, owner}. The ASI letter is directional and not pinned here.
const EXPECTED = {
  "CTL-214": { reqs: ["FR-214"], nist: "MANAGE", owner: "security lead" },
  "CTL-215": { reqs: ["FR-215"], nist: "MANAGE", owner: "plugin maintainer" },
  "CTL-216": { reqs: ["FR-216"], nist: "MEASURE", owner: "plugin maintainer" },
  "CTL-217": { reqs: ["FR-217"], nist: "MANAGE", owner: "plugin maintainer" },
  "CTL-218": { reqs: ["FR-218"], nist: "MANAGE", owner: "plugin maintainer" },
  "CTL-219": { reqs: ["FR-219"], nist: "MANAGE", owner: "security lead" },
  "CTL-220": { reqs: ["FR-220"], nist: "MANAGE", owner: "security lead" },
  "CTL-221": { reqs: ["FR-221"], nist: "GOVERN", owner: "plugin maintainer" },
  "CTL-222": { reqs: ["FR-222"], nist: "GOVERN", owner: "plugin maintainer" },
  "CTL-223": { reqs: ["FR-223"], nist: "MANAGE", owner: "security lead" },
  "CTL-224": { reqs: ["FR-224"], nist: "MEASURE", owner: "auditor" },
  "CTL-225": { reqs: ["FR-225"], nist: "MEASURE", owner: "auditor" },
  "CTL-226": { reqs: ["FR-226"], nist: "MEASURE", owner: "compliance officer" },
  "CTL-227": { reqs: ["FR-227"], nist: "MEASURE", owner: "compliance officer" },
  "CTL-228": { reqs: ["FR-228"], nist: "MEASURE", owner: "compliance officer" },
  "CTL-229": { reqs: ["FR-229"], nist: "MEASURE", owner: "compliance officer" },
  "CTL-230": { reqs: ["FR-230"], nist: "MEASURE", owner: "compliance officer" },
  "CTL-231": { reqs: ["FR-231"], nist: "GOVERN", owner: "compliance officer" },
  "CTL-232": { reqs: ["FR-232"], nist: "MEASURE", owner: "compliance officer" },
  "CTL-233": { reqs: ["FR-233"], nist: "MANAGE", owner: "compliance officer" },
  "CTL-234": { reqs: ["FR-234"], nist: "GOVERN", owner: "compliance officer" },
  "CTL-235": { reqs: ["FR-235", "FR-236"], nist: "GOVERN", owner: "security lead" },
  "CTL-237": { reqs: ["FR-237"], nist: "GOVERN", owner: "plugin maintainer" },
  "CTL-238": { reqs: ["FR-238"], nist: "GOVERN", owner: "plugin maintainer" },
  "CTL-239": { reqs: ["FR-239", "FR-240", "FR-241"], nist: "MANAGE", owner: "plugin maintainer" },
  "CTL-242": { reqs: ["FR-242"], nist: "MEASURE", owner: "security lead" },
  "CTL-243": { reqs: ["FR-243"], nist: "GOVERN", owner: "compliance officer" },
  "CTL-244": { reqs: ["FR-244"], nist: "MEASURE", owner: "compliance officer" },
  "CTL-245": { reqs: ["FR-245"], nist: "MANAGE", owner: "security lead" },
  "CTL-246": { reqs: ["FR-246"], nist: "MANAGE", owner: "compliance officer" },
  "CTL-247": { reqs: ["FR-247"], nist: "MEASURE", owner: "compliance officer" },
};

const EXPECTED_IDS = Object.keys(EXPECTED);

const ASI_NAMES = {
  ASI01: "Agent Goal Hijack",
  ASI02: "Tool Misuse & Exploitation",
  ASI03: "Identity and Privilege Abuse",
  ASI04: "Agentic Supply Chain Vulnerabilities",
  ASI05: "Unexpected Code Execution",
  ASI06: "Memory & Context Poisoning",
  ASI07: "Insecure Inter-Agent Communication",
  ASI08: "Cascading Failures",
  ASI09: "Human-Agent Trust Exploitation",
  ASI10: "Rogue Agents",
};

const URD_ROLES = ["plugin maintainer", "plugin user", "security lead", "compliance officer", "auditor"];
const FULL_COMPLIANCE_PHRASES = ["full hipaa compliance", "fully hipaa compliant", "complete hipaa compliance", "fully compliant with hipaa", "hipaa compliant"];

function reqIdsOf(r) {
  return r.cells[1].split(",").map((s) => s.trim());
}

// ---------------------------------------------------------------------------
// FERPA disclosure control (FR-246): to verify
// ---------------------------------------------------------------------------

test("[AC-3 | " + STATUS + " | NFR-033 | FR-246] the FERPA disclosure control (FR-246, CTL-246) status reads 'to verify'", () => {
  const status = row("CTL-246").cells[6];
  assert.ok(/^to verify\b/i.test(status), "the FR-246 status begins 'to verify': " + status);
});

test("[AC-3 | " + STATUS + " | NFR-033 | FR-246] the FERPA disclosure control row does not read 'complete'", () => {
  const text = row("CTL-246").line;
  assert.ok(!/\bcomplete\b/i.test(text), "the FR-246 row reads complete: " + text);
});

test("[AC-3 | " + STATUS + " | NFR-033 | NFR-028 | FR-246] the FR-246 row is the control cited against 34 CFR 99.32 and states its fail-closed basis", () => {
  const cells = row("CTL-246").cells;
  assert.ok(cells[6].indexOf("34 CFR 99.32") !== -1, "the FR-246 status cites 34 CFR 99.32: " + cells[6]);
  assert.ok(cells[6].indexOf("NFR-028") !== -1, "the FR-246 status names NFR-028: " + cells[6]);
});

test("[AC-3 | " + STATUS + " | NFR-033 | FR-246] the Per-regulation status section keeps FR-246 'to verify' and names it the only control cited against 99.32", () => {
  const bullet = statusBullet("CTL-246 (FR-246)");
  assert.ok(/to verify/i.test(bullet), "the CTL-246 bullet reads to verify: " + bullet);
  assert.ok(/only control cited against 34 CFR 99\.32/i.test(bullet), "the only control cited against 99.32: " + bullet);
});

// ---------------------------------------------------------------------------
// FERPA internal log (FR-230): no 34 CFR 99.32
// ---------------------------------------------------------------------------

test("[AC-2 | " + STATUS + " | NFR-033 | FR-230] the FERPA internal-log row (FR-230, CTL-230) cites no 34 CFR 99.32", () => {
  const text = row("CTL-230").line;
  assert.ok(text.indexOf("99.32") === -1, "the FR-230 row holds 99.32: " + text);
  assert.ok(!/34 CFR 99/.test(text), "the FR-230 row cites a 34 CFR 99 section: " + text);
});

test("[AC-2 | " + STATUS + " | NFR-033 | FR-230] the FR-230 row reads as general FERPA governance support", () => {
  const status = row("CTL-230").cells[6];
  assert.ok(/general FERPA governance support/i.test(status), "the FR-230 status: " + status);
});

test("[AC-2 | " + STATUS + " | NFR-033 | FR-230] no control row other than FR-246 cites 34 CFR 99.32", () => {
  const citing = ROWS.filter((r) => r.line.indexOf("99.32") !== -1).map((r) => r.cells[0]);
  assert.deepStrictEqual(citing, ["CTL-246"]);
});

// ---------------------------------------------------------------------------
// HIPAA audit log (FR-232): one safeguard, no compliance claim
// ---------------------------------------------------------------------------

test("[AC-1 | " + STATUS + " | NFR-033 | FR-232] the HIPAA row (FR-232, CTL-232) cites 45 CFR 164.312(b) as one required technical safeguard", () => {
  const status = row("CTL-232").cells[6];
  assert.ok(status.indexOf("45 CFR 164.312(b)") !== -1, "the FR-232 status cites 45 CFR 164.312(b): " + status);
  assert.ok(/one required technical safeguard only/.test(status), "the FR-232 status says one safeguard only: " + status);
});

test("[AC-1 | " + STATUS + " | NFR-033 | FR-232] the HIPAA row makes no full-HIPAA-compliance claim: no listed claim phrase appears, and it says it asserts none", () => {
  const text = row("CTL-232").line.toLowerCase();
  FULL_COMPLIANCE_PHRASES.forEach((phrase) => {
    assert.ok(text.indexOf(phrase) === -1, "the FR-232 row holds the claim phrase " + JSON.stringify(phrase) + ": " + text);
  });
  assert.ok(text.indexOf("asserts no hipaa compliance") !== -1, "the FR-232 row states it asserts no HIPAA compliance");
});

test("[AC-1 | " + STATUS + " | NFR-033 | FR-232] the Per-regulation status section states the HIPAA scope as one safeguard and asserts no compliance", () => {
  const bullet = statusBullet("CTL-232 (FR-232)");
  assert.ok(bullet.indexOf("164.312(b)") !== -1, "the bullet cites 164.312(b): " + bullet);
  assert.ok(/asserts no HIPAA compliance/i.test(bullet), "the bullet asserts no compliance: " + bullet);
  FULL_COMPLIANCE_PHRASES.forEach((phrase) => {
    assert.ok(bullet.toLowerCase().indexOf(phrase) === -1, "the bullet holds the claim phrase " + phrase);
  });
});

// ---------------------------------------------------------------------------
// Goal-guard and code-scan rows: advisory until promotion, fail-closed in blocking mode
// ---------------------------------------------------------------------------

test("[AC-4 | " + STATUS + " | NFR-028 | FR-219] the goal-guard row (CTL-219) reads advisory until a user-run promotion", () => {
  const status = row("CTL-219").cells[6];
  assert.ok(/advisory until promotion/i.test(status), "the CTL-219 status: " + status);
  assert.ok(/user-run promotion/i.test(status), "the CTL-219 status names a user-run promotion: " + status);
});

test("[AC-4 | " + STATUS + " | NFR-028 | FR-219] the goal-guard row states it fails closed in blocking mode per NFR-028 and fails open in advisory mode", () => {
  const status = row("CTL-219").cells[6];
  assert.ok(/fails closed in blocking mode per NFR-028/i.test(status), "the CTL-219 status: " + status);
  assert.ok(/fails open in advisory mode/i.test(status), "the CTL-219 status: " + status);
});

test("[AC-4 | " + STATUS + " | NFR-028 | FR-220] the code-scan row (CTL-220) reads advisory and states the same blocking-mode fail-closed and advisory fail-open behavior", () => {
  const status = row("CTL-220").cells[6];
  assert.ok(/advisory/i.test(status), "the CTL-220 status reads advisory: " + status);
  assert.ok(/fails closed in blocking mode per NFR-028/i.test(status), "the CTL-220 status: " + status);
  assert.ok(/fails open in advisory mode/i.test(status), "the CTL-220 status: " + status);
});

test("[AC-1 | " + STATUS + " | NFR-028 | FR-233] the PHI outbound guard row (CTL-233) names the NFR-028 fail-closed behavior", () => {
  assert.ok(row("CTL-233").cells[6].indexOf("NFR-028") !== -1, row("CTL-233").cells[6]);
});

test("[Requirement: per-regulation status | " + STATUS + " | FR-237 | FR-238 | FR-239] the severity-routing controls (FR-219, FR-220, FR-237, FR-238, FR-239) read advisory, and every one except CTL-238 cites severity-policy draft-2", () => {
  ["CTL-219", "CTL-220", "CTL-237", "CTL-238", "CTL-239"].forEach((id) => {
    assert.ok(/advisory/i.test(row(id).cells[6]), id + " reads advisory: " + row(id).cells[6]);
  });
  ["CTL-219", "CTL-220", "CTL-237", "CTL-239"].forEach((id) => {
    assert.ok(row(id).cells[6].indexOf("draft-2") !== -1, id + " cites draft-2: " + row(id).cells[6]);
  });
  ["CTL-237", "CTL-238", "CTL-239"].forEach((id) => {
    assert.ok(/^approved/i.test(row(id).cells[6]), id + " reads approved: " + row(id).cells[6]);
  });
});

test("[Requirement: per-regulation status | " + STATUS + " | FR-238] the Per-regulation status section names the five severity-routing controls and severity policy draft-2", () => {
  const bullet = statusBullet("Severity-routing controls");
  ["CTL-219", "CTL-220", "CTL-237", "CTL-238", "CTL-239"].forEach((id) => {
    assert.ok(bullet.indexOf(id) !== -1, "the bullet names " + id);
  });
  assert.ok(bullet.indexOf("draft-2") !== -1, "the bullet cites draft-2");
  assert.ok(/fail closed in blocking mode per NFR-028 and fail open in advisory mode/i.test(bullet), "the bullet states the CTL-219 and CTL-220 modes: " + bullet);
});

// ---------------------------------------------------------------------------
// The 31-row set
// ---------------------------------------------------------------------------

test("[AC-1 | " + ROWSET + " | FR-235 | FR-236] the register holds 31 control rows", () => {
  assert.strictEqual(ROWS.length, 31, "row ids: " + ROWS.map((r) => r.cells[0]).join(", "));
});

test("[AC-1 | " + ROWSET + " | FR-235 | FR-236] the register's row ids are exactly the spec's 31-row set, with no duplicate and no extra", () => {
  const ids = ROWS.map((r) => r.cells[0]);
  assert.strictEqual(new Set(ids).size, ids.length, "a duplicate id: " + ids.join(", "));
  assert.deepStrictEqual(ids.slice().sort(), EXPECTED_IDS.slice().sort());
});

test("[AC-1 | " + ROWSET + " | FR-240 | FR-241] the register holds no row CTL-236, CTL-240, or CTL-241, and no row for an NFR", () => {
  const ids = ROWS.map((r) => r.cells[0]);
  ["CTL-236", "CTL-240", "CTL-241"].forEach((id) => {
    assert.ok(ids.indexOf(id) === -1, "the register holds " + id);
  });
  ids.forEach((id) => {
    assert.ok(/^CTL-\d{3}$/.test(id), "an id of the form CTL-NNN: " + id);
  });
  ROWS.forEach((r) => {
    assert.ok(!/^NFR-/.test(r.cells[0]) && !/^NFR-/.test(r.cells[1]), "an NFR row: " + r.cells[0]);
  });
});

test("[AC-2 | " + ROWSET + " | FR-241] neither the SARIF output (FR-241) nor the log rotation size (NFR-032) is a row of its own: FR-241 sits on CTL-239 and NFR-032 inside CTL-224", () => {
  assert.ok(reqIdsOf(row("CTL-239")).indexOf("FR-241") !== -1, "CTL-239 names FR-241");
  assert.ok(row("CTL-224").line.indexOf("NFR-032") !== -1, "CTL-224 cites NFR-032");
  ROWS.forEach((r) => {
    assert.ok(r.cells[1] !== "FR-241" && r.cells[1] !== "NFR-032", "a row of its own for " + r.cells[1]);
  });
});

test("[AC-3 | " + ROWSET + " | FR-240 | FR-241] the CTL-239 row names FR-239, FR-240, and FR-241 in its Requirement IDs field", () => {
  assert.deepStrictEqual(reqIdsOf(row("CTL-239")), ["FR-239", "FR-240", "FR-241"]);
});

test("[AC-3 | " + ROWSET + " | FR-235 | FR-236] the CTL-235 row names FR-235 and FR-236 and is the register itself", () => {
  assert.deepStrictEqual(reqIdsOf(row("CTL-235")), ["FR-235", "FR-236"]);
});

test("[AC-3 | " + ROWSET + " | FR-235] every FR id from FR-214 to FR-247 appears in the Requirement IDs field of exactly one row", () => {
  const seen = {};
  ROWS.forEach((r) => {
    reqIdsOf(r).forEach((req) => {
      seen[req] = (seen[req] || []).concat(r.cells[0]);
    });
  });
  for (let n = 214; n <= 247; n += 1) {
    const req = "FR-" + n;
    assert.ok(seen[req], req + " appears in no row");
    assert.strictEqual(seen[req].length, 1, req + " appears in " + seen[req].join(", "));
  }
  Object.keys(seen).forEach((req) => {
    const n = Number(req.slice(3));
    assert.ok(n >= 214 && n <= 247, "a requirement id outside FR-214 to FR-247: " + req);
  });
});

test("[AC-1 | " + SCHEMA + " | FR-235] each row id is CTL-NNN where NNN is the primary FR number of the row", () => {
  ROWS.forEach((r) => {
    const first = reqIdsOf(r)[0];
    assert.strictEqual(r.cells[0], "CTL-" + first.slice(3), r.cells[0] + " covers " + r.cells[1]);
  });
});

test("[AC-1 | " + ROWSET + " | FR-235] each row's Requirement IDs match the spec's row set", () => {
  EXPECTED_IDS.forEach((id) => {
    assert.deepStrictEqual(reqIdsOf(row(id)), EXPECTED[id].reqs, id);
  });
});

test("[AC-1 | " + ROWSET + " | FR-235 | FR-236] the Control names list gives each of the 31 ids a name", () => {
  const names = section(REGISTER_TEXT, "## Control names").filter((l) => /^- CTL-\d{3}:/.test(l));
  assert.strictEqual(names.length, 31);
  EXPECTED_IDS.forEach((id) => {
    const line = names.find((l) => l.indexOf("- " + id + ":") === 0);
    assert.ok(line, "no control name for " + id);
    assert.ok(line.slice(id.length + 3).trim().length > 0, "an empty name for " + id);
  });
});

// ---------------------------------------------------------------------------
// Schema: seven fields, ASI mapping, NIST function, owner, cadence
// ---------------------------------------------------------------------------

test("[AC-1 | " + SCHEMA + " | FR-235 | FR-236] each row carries seven non-empty fields", () => {
  ROWS.forEach((r) => {
    assert.strictEqual(r.cells.length, 7, r.cells[0] + " holds " + r.cells.length + " cells");
    r.cells.forEach((cell, i) => {
      assert.ok(cell.length > 0, r.cells[0] + " has an empty cell " + (i + 1));
    });
  });
});

test("[AC-1 | " + SCHEMA + " | FR-235] each ASI cell holds an ASI01 to ASI10 id with the :2026 suffix and its published name, or 'not applicable' with a reason", () => {
  ROWS.forEach((r) => {
    const asi = r.cells[2];
    const m = /^(ASI(?:0[1-9]|10)):2026 (.+)$/.exec(asi);
    if (m) {
      assert.strictEqual(m[2], ASI_NAMES[m[1]], r.cells[0] + " pairs " + m[1] + " with the wrong name: " + asi);
      return;
    }
    assert.ok(/^not applicable \(.{10,}\)$/.test(asi), r.cells[0] + " has neither an ASI id nor a reasoned not applicable: " + asi);
  });
});

test("[AC-1 | " + SCHEMA + " | FR-235] exactly the governance and process controls (CTL-229, CTL-235, CTL-237, CTL-238) carry a reasoned 'not applicable'", () => {
  const na = ROWS.filter((r) => /^not applicable/.test(r.cells[2])).map((r) => r.cells[0]).sort();
  assert.deepStrictEqual(na, ["CTL-229", "CTL-235", "CTL-237", "CTL-238"]);
});

test("[AC-2 | " + SCHEMA + " | FR-236] each NIST function is GOVERN, MEASURE, or MANAGE, and none is MAP", () => {
  ROWS.forEach((r) => {
    assert.ok(["GOVERN", "MEASURE", "MANAGE"].indexOf(r.cells[3]) !== -1, r.cells[0] + " NIST function: " + r.cells[3]);
  });
  assert.ok(ROWS.every((r) => r.cells[3] !== "MAP"));
});

test("[AC-1 | " + SCHEMA + " | FR-236] each row's NIST function matches the spec's row set", () => {
  EXPECTED_IDS.forEach((id) => {
    assert.strictEqual(row(id).cells[3], EXPECTED[id].nist, id);
  });
});

test("[AC-1 | " + OWNERS + " | FR-236 | UR-070] each owner is one URD role", () => {
  ROWS.forEach((r) => {
    assert.ok(URD_ROLES.indexOf(r.cells[4]) !== -1, r.cells[0] + " owner: " + r.cells[4]);
  });
});

test("[AC-1 | " + OWNERS + " | FR-236 | UR-070] each row's owner matches the spec's row set", () => {
  EXPECTED_IDS.forEach((id) => {
    assert.strictEqual(row(id).cells[4], EXPECTED[id].owner, id);
  });
});

test("[AC-1 | " + OWNERS + " | FR-236 | UR-070] each row's review cadence is quarterly (an estimate) and its escalation path reads 'owner, then security lead'", () => {
  ROWS.forEach((r) => {
    assert.ok(/^Quarterly \(estimate\)/.test(r.cells[5]), r.cells[0] + " cadence: " + r.cells[5]);
    assert.ok(r.cells[5].indexOf("escalation: owner, then security lead") !== -1, r.cells[0] + " escalation: " + r.cells[5]);
  });
});

// ---------------------------------------------------------------------------
// Reference data and confidence
// ---------------------------------------------------------------------------

test("[Requirement: schema | " + SCHEMA + " | NFR-033] the register labels the ASI mapping directional and names the NIST AI RMF source and its four functions", () => {
  const text = section(REGISTER_TEXT, "## Reference data and confidence").join("\n");
  assert.ok(text.length > 0, "the Reference data and confidence section exists");
  assert.ok(/ASI mapping is directional \(NFR-033\)/.test(text), "the ASI mapping is labeled directional");
  assert.ok(text.indexOf("NIST.AI.100-1") !== -1, "names NIST.AI.100-1");
  ["GOVERN", "MAP", "MEASURE", "MANAGE"].forEach((fn) => {
    assert.ok(text.indexOf(fn) !== -1, "names the NIST function " + fn);
  });
  assert.ok(/MAP \(context framing\) is covered by the requirements/.test(text), "explains why MAP has no row");
});

test("[Requirement: schema | " + SCHEMA + " | NFR-033] the register names all ten ASI items with their :2026 identifiers in its reference data", () => {
  const text = section(REGISTER_TEXT, "## Reference data and confidence").join("\n");
  Object.keys(ASI_NAMES).forEach((id) => {
    assert.ok(text.indexOf(id + " " + ASI_NAMES[id]) !== -1, "the reference data names " + id + " " + ASI_NAMES[id]);
  });
});

// ---------------------------------------------------------------------------
// The standing check in CLAUDE.md (NFR-035)
// ---------------------------------------------------------------------------

test("[AC-1 | " + SPEC + " Requirement: Check script CLI contract and exit codes | NFR-035] the CLAUDE.md 'Keeping counts in sync' list holds a check-control-register.js --check line mirroring check-fsa-tables.js", () => {
  const text = fs.readFileSync(path.join(REPO, "CLAUDE.md"), "utf8");
  const list = section(text, "## Keeping counts in sync").join("\n");
  assert.ok(list.length > 0, "the sync list exists");
  assert.ok(list.indexOf("node plugins/assist-plugin/scripts/check-control-register.js --check") !== -1, "the check-control-register.js line");
  assert.ok(list.indexOf("node plugins/assist-plugin/scripts/check-fsa-tables.js --check") !== -1, "the check-fsa-tables.js line it mirrors");
});
