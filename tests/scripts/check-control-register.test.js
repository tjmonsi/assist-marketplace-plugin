// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for plugins/assist-plugin/scripts/check-control-register.js, the validator of the
// governance control register plugins/assist-plugin/rules/control-register.md (harness-governance Tranche 5, task
// plan Steps 39 and 41).
//
// Sources: specs/spec-governance-control-register.md (Requirements: Register schema, Owner roles and escalation,
// Per-regulation status is fixed, Check script field validation, Check script regulation-citation validation, FERPA
// disclosure control to-verify passes with a notice, Check script CLI contract and exit codes),
// docs/requirements/FR-NFR-harness-governance.md v1.3 (FR-235, FR-236, FR-246, NFR-028, NFR-033, NFR-035), and the
// documented command line in CHANGELOG.md: `check-control-register.js [--check] [--root DIR]`. The script is never
// read; it is run as a child process against temporary plugin directories that hold rules/control-register.md.
//
// Traceability format: [AC-N | spec file Requirement | FR/NFR/UR ids]. The spec carries no SPEC-NNN id, so it is
// cited by file name. AC-N is the position of the Scenario inside its Requirement in the spec. A case with no
// Scenario of its own carries the Requirement name in place of an AC number.
//
// Contract used (documented behavior only):
//   - The register is the first table under the `## Register` heading, seven cells per row: id, Requirement IDs, ASI
//     mapping, NIST function, owner, cadence and escalation, status.
//   - `--check` exits 1 when any row lacks an ASI id (ASI01 to ASI10) or a reasoned "not applicable", has a NIST
//     function outside GOVERN, MEASURE, MANAGE, has no owner, or has no cadence, and names the control. A bare run
//     prints the problem and exits 0.
//   - The FR-230 row must not hold the literal 99.32. The FR-232 row must hold the literal 164.312(b) and must carry no
//     affirmative full-HIPAA-compliance claim, judged by a negation-aware phrase match. Citations match as exact
//     strings, never as patterns. A missing FR-230, FR-232, or FR-246 row is not a failure of `--check`.
//   - The FR-246 row with status "to verify" passes and the script prints a notice that it is unverified.
//   - Exit 2 for an operational error (unknown flag, bad or missing --root, unreadable register, no table under
//     `## Register`), printed to stderr with the prefix `check-control-register:`.
//
// Run: node --test tests/scripts/check-control-register.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const SCRIPT = path.join(PLUGIN, "scripts", "check-control-register.js");
const REAL_REGISTER = path.join(PLUGIN, "rules", "control-register.md");

const SPEC = "spec-governance-control-register.md";
const SCHEMA = SPEC + " Requirement: Register schema";
const OWNERS = SPEC + " Requirement: Owner roles and escalation";
const STATUS = SPEC + " Requirement: Per-regulation status is fixed";
const FIELDS = SPEC + " Requirement: Check script field validation";
const CITES = SPEC + " Requirement: Check script regulation-citation validation";
const TOVERIFY = SPEC + " Requirement: FERPA disclosure control to-verify passes with a notice";
const CLI = SPEC + " Requirement: Check script CLI contract and exit codes";

// The 31 control ids of the spec's row set. The check script does not enforce the set; the tests below only use it to
// confirm that the report enumerates every row of the real register.
const ROW_IDS = [
  "CTL-214", "CTL-215", "CTL-216", "CTL-217", "CTL-218", "CTL-219", "CTL-220", "CTL-221", "CTL-222", "CTL-223",
  "CTL-224", "CTL-225", "CTL-226", "CTL-227", "CTL-228", "CTL-229", "CTL-230", "CTL-231", "CTL-232", "CTL-233",
  "CTL-234", "CTL-235", "CTL-237", "CTL-238", "CTL-239", "CTL-242", "CTL-243", "CTL-244", "CTL-245", "CTL-246",
  "CTL-247",
];

const scratch = [];

after(() => {
  while (scratch.length > 0) fs.rmSync(scratch.pop(), { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function tempDir(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix || "ctl-register-")));
  scratch.push(dir);
  return dir;
}

const HEADER =
  "| id | Requirement IDs | OWASP Agentic (ASI, directional) | NIST AI RMF | Owner role | Review cadence and escalation | Status |\n" +
  "|---|---|---|---|---|---|---|";

const CADENCE = "Quarterly (estimate); escalation: owner, then security lead";
const ASI03 = "ASI03:2026 Identity and Privilege Abuse";

// A small, well-formed register that holds the three rows the regulation checks look for.
function baseRows() {
  return [
    { id: "CTL-223", req: "FR-223", asi: ASI03, nist: "MANAGE", owner: "security lead", cadence: CADENCE, status: "Active" },
    {
      id: "CTL-229",
      req: "FR-229",
      asi: "not applicable (compliance-evidence export over the plugin's own hook logs; it mitigates no specific agentic threat of its own)",
      nist: "MEASURE",
      owner: "compliance officer",
      cadence: CADENCE,
      status: "Active",
    },
    {
      id: "CTL-230",
      req: "FR-230",
      asi: ASI03,
      nist: "MEASURE",
      owner: "compliance officer",
      cadence: CADENCE,
      status: "Active, general FERPA governance support on the purpose dimension; cites no disclosure-recordation rule (directional, NFR-033)",
    },
    {
      id: "CTL-232",
      req: "FR-232",
      asi: ASI03,
      nist: "MEASURE",
      owner: "compliance officer",
      cadence: CADENCE,
      status: "Verified against 45 CFR 164.312(b) as one required technical safeguard only; asserts no HIPAA compliance",
    },
    {
      id: "CTL-246",
      req: "FR-246",
      asi: "ASI02:2026 Tool Misuse & Exploitation",
      nist: "MANAGE",
      owner: "compliance officer",
      cadence: CADENCE,
      status: "To verify (34 CFR 99.32; NFR-028 fail-closed; exception handling pending review)",
    },
  ];
}

// Applies per-row cell overrides: changes = {"CTL-230": {status: "..."}}. A row can be replaced by a raw table line
// with {raw: "| ... |"}.
function withChanges(changes) {
  const given = changes || {};
  return baseRows().map((row) => Object.assign({}, row, given[row.id] || {}));
}

function renderRow(row) {
  if (row.raw !== undefined) return row.raw;
  return "| " + [row.id, row.req, row.asi, row.nist, row.owner, row.cadence, row.status].join(" | ") + " |";
}

function rowLine(id) {
  return renderRow(baseRows().find((r) => r.id === id));
}

function registerText(rows, extras) {
  const o = extras || {};
  return [
    "# Control Register: fixture",
    "",
    "## Reference data and confidence",
    "",
    "Prose before the register.",
    "",
    "## Register",
    "",
    o.beforeTable === undefined ? "" : o.beforeTable,
    HEADER,
    rows.map(renderRow).join("\n"),
    "",
    o.afterTable === undefined ? "" : o.afterTable,
    "## Maintenance",
    "",
    "Prose after the register.",
    "",
  ].join("\n");
}

// A temporary plugin directory that holds rules/control-register.md with `text`. Returns the directory.
function pluginWith(text) {
  const dir = tempDir("ctl-register-plugin-");
  fs.mkdirSync(path.join(dir, "rules"), { recursive: true });
  fs.writeFileSync(path.join(dir, "rules", "control-register.md"), text);
  return dir;
}

function run(args, options) {
  const opts = options || {};
  const res = childProcess.spawnSync(process.execPath, [SCRIPT].concat(args), {
    cwd: opts.cwd || tempDir("ctl-register-cwd-"),
    encoding: "utf8",
    timeout: 30000,
  });
  assert.strictEqual(res.error, undefined, "spawn failed: " + (res.error && res.error.message));
  res.out = (res.stdout || "") + "\n" + (res.stderr || "");
  return res;
}

function check(text) {
  return run(["--check", "--root", pluginWith(text)]);
}

function bare(text) {
  return run(["--root", pluginWith(text)]);
}

function checkRows(changes) {
  return check(registerText(withChanges(changes)));
}

// The control is named in the output by its CTL id or by its requirement id.
function names(res, id, req) {
  return res.out.indexOf(id) !== -1 || (req !== undefined && res.out.indexOf(req) !== -1);
}

function assertPasses(res, label) {
  assert.strictEqual(res.status, 0, (label || "expected exit 0") + "\nstdout: " + res.stdout + "\nstderr: " + res.stderr);
}

function assertFails(res, id, req, label) {
  assert.strictEqual(res.status, 1, (label || "expected exit 1") + "\nstdout: " + res.stdout + "\nstderr: " + res.stderr);
  assert.ok(names(res, id, req), (label || "") + " the output names " + id + (req ? " or " + req : "") + "\n" + res.out);
}

function assertOperationalError(res, label) {
  assert.strictEqual(res.status, 2, (label || "expected exit 2") + "\nstdout: " + res.stdout + "\nstderr: " + res.stderr);
  assert.ok(res.stderr.trim().length > 0, "the error goes to stderr: " + label);
}

// The real register as text, with a helper that rewrites one row by id.
function realRegister() {
  return fs.readFileSync(REAL_REGISTER, "utf8");
}

function mutateRealRow(id, fn) {
  const lines = realRegister().split("\n");
  const at = lines.findIndex((l) => l.indexOf("| " + id + " |") === 0);
  assert.ok(at >= 0, "the real register has no row " + id);
  lines[at] = fn(lines[at]);
  return lines.join("\n");
}

function cellsOf(line) {
  return line.split("|").slice(1, -1).map((c) => c.trim());
}

function rowOf(cells) {
  return "| " + cells.join(" | ") + " |";
}

// ---------------------------------------------------------------------------
// The real register and the register as specified
// ---------------------------------------------------------------------------

test("[AC-3 | " + FIELDS + " | FR-235 | FR-236 | NFR-035] the real register passes --check: exit 0 from any working directory", () => {
  // Valid input: the shipped register, run with no --root from an unrelated directory.
  const res = run(["--check"]);
  assertPasses(res, "the shipped register passes its own check");
});

test("[AC-6 | " + CITES + " | NFR-033 | NFR-035] the real register passes --check with --root pointing at the plugin directory", () => {
  const res = run(["--check", "--root", PLUGIN]);
  assertPasses(res);
});

test("[AC-6 | " + CITES + " | NFR-033] the real register report enumerates every control row and reports the FR-232 row as ok", () => {
  const res = run(["--check", "--root", PLUGIN]);
  assertPasses(res);
  ROW_IDS.forEach((id) => {
    assert.ok(res.stdout.indexOf(id) !== -1, "the report lists " + id + "\n" + res.stdout);
  });
  const line = res.stdout.split("\n").find((l) => /CTL-232|FR-232/.test(l));
  assert.ok(line, "a report line for the FR-232 row\n" + res.stdout);
  assert.ok(/\bok\b/i.test(line), "the FR-232 line reads ok: " + line);
});

test("[AC-1 | " + TOVERIFY + " | NFR-033 | FR-246] the real register passes and the report carries the FR-246 unverified notice", () => {
  const res = run(["--check", "--root", PLUGIN]);
  assertPasses(res);
  assert.ok(/FR-246/.test(res.stdout), "the notice names FR-246\n" + res.stdout);
  assert.ok(/unverified|to verify/i.test(res.stdout), "the notice says the control is unverified\n" + res.stdout);
});

test("[AC-3 | " + FIELDS + " | FR-235 | FR-236] a copy of the real register in a temporary plugin directory passes", () => {
  const res = run(["--check", "--root", pluginWith(realRegister())]);
  assertPasses(res);
});

test("[AC-3 | " + FIELDS + " | FR-235 | FR-236 | NFR-035] a well-formed temporary register passes --check and the report lists each of its rows", () => {
  const res = check(registerText(baseRows()));
  assertPasses(res);
  baseRows().forEach((row) => {
    assert.ok(res.stdout.indexOf(row.id) !== -1, "the report lists " + row.id + "\n" + res.stdout);
  });
});

test("[AC-1 | " + CLI + " | NFR-035] the option order is free: --root before --check gives the same result", () => {
  const dir = pluginWith(registerText(baseRows()));
  assertPasses(run(["--root", dir, "--check"]));
  assertPasses(run(["--check", "--root", dir]));
});

// ---------------------------------------------------------------------------
// Field validation: ASI mapping
// ---------------------------------------------------------------------------

test("[AC-1 | " + FIELDS + " | FR-235] a row with an empty ASI cell fails --check with exit 1 and names the control", () => {
  // Null/empty: the ASI cell is empty while NIST, owner, and cadence are present.
  assertFails(checkRows({ "CTL-223": { asi: "" } }), "CTL-223", "FR-223");
});

test("[AC-2 | " + FIELDS + " | FR-235] a row whose ASI cell reads 'not applicable' with no reason fails and names the control", () => {
  ["not applicable", "Not applicable", "not applicable   "].forEach((asi) => {
    assertFails(checkRows({ "CTL-223": { asi: asi } }), "CTL-223", "FR-223", JSON.stringify(asi));
  });
});

test("[AC-3 | " + FIELDS + " | FR-235] a row whose ASI cell reads 'not applicable' with a reason passes", () => {
  [
    "not applicable (a governance mapping, not a runtime mitigation)",
    "not applicable (it mitigates no specific agentic threat)",
  ].forEach((asi) => {
    assertPasses(checkRows({ "CTL-223": { asi: asi } }), JSON.stringify(asi));
  });
});

test("[AC-1 | " + FIELDS + " | FR-235] an ASI cell that holds neither an ASI id nor a reasoned not-applicable fails: free text, a placeholder, and an id outside ASI01 to ASI10", () => {
  // Invalid and boundary: the ids one past each end of the range, and text that is not an id.
  ["TBD", "n/a", "none", "ASI00:2026 Nothing", "ASI11:2026 Beyond the list", "OWASP"].forEach((asi) => {
    assertFails(checkRows({ "CTL-223": { asi: asi } }), "CTL-223", "FR-223", JSON.stringify(asi));
  });
});

test("[AC-1 | " + SCHEMA + " | FR-235 | FR-236] every ASI id from ASI01 to ASI10 passes, with and without the :2026 suffix", () => {
  // Boundary and valid: the first and last ids and every id between.
  for (let n = 1; n <= 10; n += 1) {
    const id = "ASI" + (n < 10 ? "0" : "") + n;
    assertPasses(checkRows({ "CTL-223": { asi: id } }), id);
    assertPasses(checkRows({ "CTL-223": { asi: id + ":2026 Named Item" } }), id + ":2026");
  }
});

// ---------------------------------------------------------------------------
// Field validation: NIST function
// ---------------------------------------------------------------------------

test("[AC-2 | " + SCHEMA + " | FR-236] a NIST function of MAP fails --check and names the control, because the register uses GOVERN, MEASURE, or MANAGE only", () => {
  assertFails(checkRows({ "CTL-223": { nist: "MAP" } }), "CTL-223", "FR-223");
});

test("[AC-1 | " + FIELDS + " | FR-236] a missing or unknown NIST function fails: empty, a placeholder, and a name outside the set", () => {
  ["", "TBD", "PROTECT", "RESPOND", "IDENTIFY"].forEach((nist) => {
    assertFails(checkRows({ "CTL-223": { nist: nist } }), "CTL-223", "FR-223", JSON.stringify(nist));
  });
});

test("[AC-1 | " + SCHEMA + " | FR-236] GOVERN, MEASURE, and MANAGE each pass", () => {
  ["GOVERN", "MEASURE", "MANAGE"].forEach((nist) => {
    assertPasses(checkRows({ "CTL-223": { nist: nist } }), nist);
  });
});

// ---------------------------------------------------------------------------
// Field validation: owner and cadence
// ---------------------------------------------------------------------------

test("[AC-2 | " + OWNERS + " | FR-236 | UR-070] a row with no owner fails --check and names the control", () => {
  assertFails(checkRows({ "CTL-223": { owner: "" } }), "CTL-223", "FR-223");
});

test("[AC-1 | " + OWNERS + " | FR-236 | UR-070] each URD role is accepted as an owner", () => {
  ["plugin maintainer", "plugin user", "security lead", "compliance officer", "auditor"].forEach((owner) => {
    assertPasses(checkRows({ "CTL-223": { owner: owner } }), owner);
  });
});

test("[AC-1 | " + FIELDS + " | FR-236] a row with no review cadence fails --check and names the control", () => {
  assertFails(checkRows({ "CTL-223": { cadence: "" } }), "CTL-223", "FR-223");
});

test("[AC-1 | " + FIELDS + " | FR-235 | FR-236] two broken rows are both named in one run", () => {
  const res = checkRows({ "CTL-223": { owner: "" }, "CTL-229": { nist: "MAP" } });
  assert.strictEqual(res.status, 1, res.out);
  assert.ok(names(res, "CTL-223", "FR-223"), res.out);
  assert.ok(names(res, "CTL-229", "FR-229"), res.out);
});

// ---------------------------------------------------------------------------
// Row shape: seven cells
// ---------------------------------------------------------------------------

test("[AC-1 | " + SCHEMA + " | FR-235 | FR-236] a row with six cells (the status cell missing) fails --check", () => {
  const six = "| CTL-223 | FR-223 | " + ASI03 + " | MANAGE | security lead | " + CADENCE + " |";
  const res = check(registerText(withChanges({ "CTL-223": { raw: six } })));
  assert.strictEqual(res.status, 1, res.out);
});

test("[AC-1 | " + SCHEMA + " | FR-235 | FR-236] a row with eight cells fails --check", () => {
  const eight = "| CTL-223 | FR-223 | " + ASI03 + " | MANAGE | security lead | " + CADENCE + " | Active | extra |";
  const res = check(registerText(withChanges({ "CTL-223": { raw: eight } })));
  assert.strictEqual(res.status, 1, res.out);
});

test("[AC-1 | " + SCHEMA + " | FR-235 | FR-236] a row with only the id and the requirement ids fails --check", () => {
  const two = "| CTL-223 | FR-223 |";
  const res = check(registerText(withChanges({ "CTL-223": { raw: two } })));
  assert.strictEqual(res.status, 1, res.out);
});

// ---------------------------------------------------------------------------
// Per-regulation citations: FR-230 (FERPA internal log)
// ---------------------------------------------------------------------------

test("[AC-1 | " + CITES + " | NFR-033 | FR-235] the FR-230 row that cites 34 CFR 99.32 fails --check and names FR-230", () => {
  assertFails(
    checkRows({ "CTL-230": { status: "Active, recorded under 34 CFR 99.32 for disclosures" } }),
    "CTL-230",
    "FR-230"
  );
});

test("[AC-1 | " + CITES + " | NFR-033] the bare substring 99.32 anywhere in the FR-230 row fails, even inside a negation", () => {
  ["Active, no 99.32 citation", "Active (see 99.32(d))", "Active; 34 CFR 99.32"].forEach((status) => {
    assertFails(checkRows({ "CTL-230": { status: status } }), "CTL-230", "FR-230", status);
  });
  // The citation in a cell other than the status cell still counts: the check reads the whole row.
  assertFails(checkRows({ "CTL-230": { cadence: CADENCE + " (99.32)" } }), "CTL-230", "FR-230", "cadence cell");
});

test("[AC-5 | " + CITES + " | NFR-033] citations match as exact strings: 99x32 and 9932 in the FR-230 row pass", () => {
  // Injection-shaped boundary: a dot is a literal dot, never a wildcard.
  ["Active, 99x32 is not a citation", "Active, 9932 is not a citation", "Active, 99-32"].forEach((status) => {
    assertPasses(checkRows({ "CTL-230": { status: status } }), status);
  });
});

test("[AC-2 | " + STATUS + " | NFR-033] the FR-230 row as specified (general FERPA governance support, no citation) passes", () => {
  assertPasses(checkRows({}));
});

test("[AC-2 | " + STATUS + " | NFR-033] the FR-246 row is allowed to cite 34 CFR 99.32: the 99.32 check applies to FR-230 only", () => {
  const res = checkRows({ "CTL-246": { status: "To verify (34 CFR 99.32(d) exception handling pending review)" } });
  assertPasses(res);
});

test("[AC-1 | " + CITES + " | NFR-033] a real register whose FR-230 row gains 34 CFR 99.32 fails --check", () => {
  const text = mutateRealRow("CTL-230", (line) => {
    const cells = cellsOf(line);
    cells[6] = cells[6] + "; 34 CFR 99.32";
    return rowOf(cells);
  });
  assertFails(run(["--check", "--root", pluginWith(text)]), "CTL-230", "FR-230");
});

// ---------------------------------------------------------------------------
// Per-regulation citations: FR-232 (HIPAA audit log)
// ---------------------------------------------------------------------------

test("[AC-2 | " + CITES + " | NFR-033] the FR-232 row without 164.312(b) fails --check and names FR-232", () => {
  assertFails(
    checkRows({ "CTL-232": { status: "Verified as one required technical safeguard only; asserts no HIPAA compliance" } }),
    "CTL-232",
    "FR-232"
  );
});

test("[AC-5 | " + CITES + " | NFR-033] citations match as exact strings: 164.312b, 164x312(b), 164.312, and 164.312(c) each fail the FR-232 row", () => {
  // One near-miss per register. None holds the literal 164.312(b).
  [
    "Verified against 45 CFR 164.312b as one required technical safeguard only",
    "Verified against 45 CFR 164x312(b) as one required technical safeguard only",
    "Verified against 45 CFR 164.312 as one required technical safeguard only",
    "Verified against 45 CFR 164.312(c) as one required technical safeguard only",
  ].forEach((status) => {
    assertFails(checkRows({ "CTL-232": { status: status } }), "CTL-232", "FR-232", status);
  });
});

test("[AC-1 | " + STATUS + " | NFR-033] the FR-232 row cites 45 CFR 164.312(b) as one safeguard and asserts no HIPAA compliance: it passes", () => {
  assertPasses(checkRows({ "CTL-232": { status: "Verified against 45 CFR 164.312(b) as one required technical safeguard only; asserts no HIPAA compliance" } }));
});

test("[AC-3 | " + CITES + " | NFR-033] an affirmative full-HIPAA-compliance claim in the FR-232 row fails --check and names FR-232", () => {
  // One representative per phrase of the fixed list, each beside the required citation.
  [
    "Verified against 45 CFR 164.312(b); full HIPAA compliance",
    "Verified against 45 CFR 164.312(b); fully HIPAA compliant",
    "Verified against 45 CFR 164.312(b); complete HIPAA compliance",
    "Verified against 45 CFR 164.312(b); fully compliant with HIPAA",
    "Verified against 45 CFR 164.312(b); this control is HIPAA compliant",
  ].forEach((status) => {
    assertFails(checkRows({ "CTL-232": { status: status } }), "CTL-232", "FR-232", status);
  });
});

test("[AC-3 | " + CITES + " | NFR-033] the claim match is case-insensitive", () => {
  ["FULL HIPAA COMPLIANCE", "Full Hipaa Compliance", "fUlLy HiPaA cOmPlIaNt"].forEach((claim) => {
    assertFails(checkRows({ "CTL-232": { status: "Verified against 45 CFR 164.312(b); " + claim } }), "CTL-232", "FR-232", claim);
  });
});

test("[AC-4 | " + CITES + " | NFR-033] a negated scope statement passes: the whole word before the phrase is not or no", () => {
  [
    "Verified against 45 CFR 164.312(b); not full HIPAA compliance",
    "Verified against 45 CFR 164.312(b); no full HIPAA compliance",
    "Verified against 45 CFR 164.312(b); not HIPAA compliant",
    "Verified against 45 CFR 164.312(b); this is NOT full HIPAA compliance",
    "Verified against 45 CFR 164.312(b); not fully HIPAA compliant",
    "Verified against 45 CFR 164.312(b); not complete HIPAA compliance",
    "Verified against 45 CFR 164.312(b); not fully compliant with HIPAA",
  ].forEach((status) => {
    assertPasses(checkRows({ "CTL-232": { status: status } }), status);
  });
});

test("[AC-4 | " + CITES + " | NFR-033] a bare 'HIPAA compliance' is not a listed phrase, so a scope statement that names it without claiming it passes", () => {
  [
    "Verified against 45 CFR 164.312(b) as one required technical safeguard only; asserts no HIPAA compliance",
    "Verified against 45 CFR 164.312(b); HIPAA compliance needs the other safeguards",
    "Verified against 45 CFR 164.312(b) as one required technical safeguard",
  ].forEach((status) => {
    assertPasses(checkRows({ "CTL-232": { status: status } }), status);
  });
});

test("[AC-3 | " + CITES + " | NFR-033] a hedge such as 'not yet full HIPAA compliance' still fails: the word before the phrase is yet", () => {
  assertFails(
    checkRows({ "CTL-232": { status: "Verified against 45 CFR 164.312(b); not yet full HIPAA compliance" } }),
    "CTL-232",
    "FR-232"
  );
});

test("[AC-3 | " + CITES + " | NFR-033] one negated and one affirmative claim in the same row fails on the affirmative one", () => {
  assertFails(
    checkRows({ "CTL-232": { status: "Verified against 45 CFR 164.312(b); not full HIPAA compliance, but fully HIPAA compliant for audit logs" } }),
    "CTL-232",
    "FR-232"
  );
});

test("[AC-3 | " + CITES + " | NFR-033] a claim in another cell of the FR-232 row counts: the check reads the whole row", () => {
  assertFails(checkRows({ "CTL-232": { cadence: CADENCE + "; full HIPAA compliance" } }), "CTL-232", "FR-232");
});

test("[AC-3 | " + CITES + " | NFR-033] a real register whose FR-232 row claims full HIPAA compliance fails --check", () => {
  const text = mutateRealRow("CTL-232", (line) => line.replace("asserts no HIPAA compliance", "provides full HIPAA compliance"));
  assertFails(run(["--check", "--root", pluginWith(text)]), "CTL-232", "FR-232");
});

test("[AC-2 | " + CITES + " | NFR-033] a real register whose FR-232 row drops 164.312(b) fails --check", () => {
  const text = mutateRealRow("CTL-232", (line) => line.replace("45 CFR 164.312(b)", "45 CFR 164"));
  assertFails(run(["--check", "--root", pluginWith(text)]), "CTL-232", "FR-232");
});

test("[AC-4 | " + CITES + " | NFR-033] a real register whose FR-232 row says 'not full HIPAA compliance' passes", () => {
  const text = mutateRealRow("CTL-232", (line) => line.replace("asserts no HIPAA compliance", "not full HIPAA compliance"));
  assertPasses(run(["--check", "--root", pluginWith(text)]));
});

// ---------------------------------------------------------------------------
// Row presence is not enforced by --check
// ---------------------------------------------------------------------------

test("[Requirement: citation validation | " + CITES + " | NFR-033] a register with no FR-230, FR-232, or FR-246 row does not fail --check: row presence is the tests' job, not the script's", () => {
  const rows = withChanges({}).filter((r) => ["CTL-223", "CTL-229"].indexOf(r.id) !== -1);
  assertPasses(check(registerText(rows)));
});

test("[Requirement: citation validation | " + CITES + " | NFR-033] the regulation checks locate a row by its requirement ids cell, not its control id", () => {
  // An FR-232 row filed under another control id is still the HIPAA row and is still checked.
  const res = checkRows({ "CTL-232": { id: "CTL-999", status: "Verified as one safeguard only" } });
  assert.strictEqual(res.status, 1, res.out);
});

// ---------------------------------------------------------------------------
// FR-246: to verify passes with a notice
// ---------------------------------------------------------------------------

test("[AC-1 | " + TOVERIFY + " | NFR-033 | FR-246] the FR-246 row with status 'to verify' passes --check and the script prints a notice that FR-246 is unverified", () => {
  const res = checkRows({});
  assertPasses(res);
  assert.ok(/FR-246/.test(res.stdout), "the notice names FR-246\n" + res.stdout);
  assert.ok(/unverified|to verify/i.test(res.stdout), "the notice says unverified\n" + res.stdout);
});

test("[AC-1 | " + TOVERIFY + " | NFR-033 | FR-246] the to-verify notice never raises the exit code, with or without --check", () => {
  const dir = pluginWith(registerText(baseRows()));
  assertPasses(run(["--check", "--root", dir]));
  assertPasses(run(["--root", dir]));
});

test("[Requirement: to-verify passes | " + TOVERIFY + " | FR-246] the FR-246 row still fails when it lacks a mapped field: to verify does not excuse a missing owner or ASI mapping", () => {
  assertFails(checkRows({ "CTL-246": { owner: "" } }), "CTL-246", "FR-246");
  assertFails(checkRows({ "CTL-246": { asi: "" } }), "CTL-246", "FR-246");
});

// ---------------------------------------------------------------------------
// CLI contract: bare run, check run, exit codes
// ---------------------------------------------------------------------------

test("[AC-1 | " + CLI + " | NFR-035] a bare run on a register with a field problem prints the problem and exits 0", () => {
  const res = bare(registerText(withChanges({ "CTL-223": { owner: "" } })));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(names(res, "CTL-223", "FR-223"), "the problem is printed and names the control\n" + res.out);
});

test("[AC-1 | " + CLI + " | NFR-035] a bare run on a register with a regulation problem prints the problem and exits 0", () => {
  const res = bare(registerText(withChanges({ "CTL-230": { status: "Active, 34 CFR 99.32" } })));
  assert.strictEqual(res.status, 0, res.out);
  assert.ok(names(res, "CTL-230", "FR-230"), res.out);
});

test("[AC-2 | " + CLI + " | NFR-035] --check on a register with a field problem exits 1", () => {
  assertFails(checkRows({ "CTL-223": { cadence: "" } }), "CTL-223", "FR-223");
});

test("[AC-2 | " + CLI + " | NFR-035] --check on a register with a regulation problem exits 1", () => {
  assertFails(checkRows({ "CTL-230": { status: "Active, 34 CFR 99.32" } }), "CTL-230", "FR-230");
});

test("[AC-1 | " + CLI + " | NFR-035] a clean bare run exits 0 and prints a report", () => {
  const res = bare(registerText(baseRows()));
  assertPasses(res);
  assert.ok(res.stdout.trim().length > 0, "a report is printed");
});

test("[AC-3 | " + CLI + " | NFR-035] an unknown flag is an operational error: exit 2 with a message on stderr", () => {
  const dir = pluginWith(registerText(baseRows()));
  ["--bogus", "--chek", "-x"].forEach((flag) => {
    assertOperationalError(run([flag, "--root", dir]), flag);
  });
});

test("[AC-3 | " + CLI + " | NFR-035] an unknown flag beside --check is still exit 2, not exit 1", () => {
  const dir = pluginWith(registerText(withChanges({ "CTL-223": { owner: "" } })));
  assertOperationalError(run(["--check", "--bogus", "--root", dir]), "--check --bogus");
});

test("[AC-3 | " + CLI + " | NFR-035] --root with no value is an operational error: exit 2", () => {
  assertOperationalError(run(["--check", "--root"]), "--root as the last argument");
});

test("[AC-3 | " + CLI + " | NFR-035] --root pointing at a directory that does not exist is an operational error: exit 2 with the script prefix on stderr", () => {
  const missing = path.join(tempDir("ctl-register-missing-"), "no", "such", "plugin");
  const res = run(["--check", "--root", missing]);
  assertOperationalError(res, "missing --root");
  assert.ok(res.stderr.indexOf("check-control-register:") !== -1, "the prefix: " + res.stderr);
});

test("[AC-3 | " + CLI + " | NFR-035] --root pointing at a directory with no rules/control-register.md is an operational error: exit 2", () => {
  const empty = tempDir("ctl-register-empty-");
  const res = run(["--check", "--root", empty]);
  assertOperationalError(res, "no register file");
  assert.ok(res.stderr.indexOf("check-control-register:") !== -1, "the prefix: " + res.stderr);
});

test("[AC-3 | " + CLI + " | NFR-035] an unreadable register (a directory where the file belongs) is an operational error: exit 2, even without --check", () => {
  // Reading a directory fails for every user, root included.
  const dir = tempDir("ctl-register-unreadable-");
  fs.mkdirSync(path.join(dir, "rules", "control-register.md"), { recursive: true });
  const checked = run(["--check", "--root", dir]);
  assertOperationalError(checked, "--check");
  assert.ok(checked.stderr.indexOf("check-control-register:") !== -1, "the prefix: " + checked.stderr);
  assertOperationalError(run(["--root", dir]), "bare run");
});

test("[AC-3 | " + CLI + " | NFR-035] a register with no table under '## Register' is an operational error: exit 2", () => {
  const noTable = ["# Control Register", "", "## Register", "", "The rows have not been written yet.", "", "## Maintenance", "", "Prose.", ""].join("\n");
  const checked = run(["--check", "--root", pluginWith(noTable)]);
  assertOperationalError(checked, "--check");
  assert.ok(checked.stderr.indexOf("check-control-register:") !== -1, "the prefix: " + checked.stderr);
  assertOperationalError(run(["--root", pluginWith(noTable)]), "bare run");
});

test("[AC-3 | " + CLI + " | NFR-035] an empty register file and a file with no '## Register' heading are operational errors: exit 2", () => {
  // Null/empty input and a missing section.
  assertOperationalError(run(["--check", "--root", pluginWith("")]), "empty file");
  assertOperationalError(run(["--check", "--root", pluginWith("# Control Register\n\nJust prose, no heading for the table.\n")]), "no heading");
});

test("[AC-3 | " + CLI + " | NFR-035] a table that sits under another heading does not stand in for the register: exit 2", () => {
  const other = [
    "# Control Register",
    "",
    "## Schema",
    "",
    HEADER,
    rowLine("CTL-223"),
    "",
    "## Register",
    "",
    "Rows to come.",
    "",
  ].join("\n");
  assertOperationalError(run(["--check", "--root", pluginWith(other)]), "table under another heading");
});

test("[Requirement: schema | " + SCHEMA + " | FR-235] only the first control table under '## Register' is read: a second table with a broken row does not fail the check", () => {
  const second = ["Second table, not the register:", "", HEADER, "| CTL-998 | FR-998 |  | MAP |  |  |  |", ""].join("\n");
  assertPasses(check(registerText(baseRows(), { afterTable: second })));
});

test("[Requirement: schema | " + SCHEMA + " | FR-235] prose between the heading and the table is skipped: the table is still found", () => {
  assertPasses(check(registerText(baseRows(), { beforeTable: "Some explanation that precedes the table.\n" })));
});

// ---------------------------------------------------------------------------
// Working directory, idempotence, and no writes
// ---------------------------------------------------------------------------

test("[AC-1 | " + CLI + " | NFR-035] the result does not depend on the working directory", () => {
  const dir = pluginWith(registerText(baseRows()));
  const here = run(["--check", "--root", dir], { cwd: REPO });
  const there = run(["--check", "--root", dir], { cwd: os.tmpdir() });
  assert.strictEqual(here.status, there.status);
  assert.strictEqual(here.stdout, there.stdout);
});

test("[AC-1 | " + CLI + " | NFR-035] two runs on the same register print the same report", () => {
  const dir = pluginWith(registerText(baseRows()));
  const first = run(["--check", "--root", dir]);
  const second = run(["--check", "--root", dir]);
  assert.strictEqual(first.status, 0);
  assert.strictEqual(first.stdout, second.stdout);
});

test("[Requirement: CLI contract | " + CLI + " | NFR-035] the script only reports: the register file is unchanged after a failing --check", () => {
  const text = registerText(withChanges({ "CTL-223": { owner: "" } }));
  const dir = pluginWith(text);
  run(["--check", "--root", dir]);
  assert.strictEqual(fs.readFileSync(path.join(dir, "rules", "control-register.md"), "utf8"), text);
});
