// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the catalog-fixed severity of the reviewer machinery (the catalog additions to
// plugins/assist-plugin/hooks/lib/severity.js and the data file plugins/assist-plugin/rules/severity-catalog.yaml), task plan
// docs/task-plans/task-plan-reviewer-machinery-20261125-0717.md, Step 26 (implementation: Step 25).
//
// Sources: specs/spec-reviewer-machinery.md (Requirement 18: Take severity from the catalog, scenarios Catalog severity
// applied and Unmapped high finding; Requirement 19: Keep a critic or filtering score out of severity and inclusion),
// docs/requirements/FR-NFR-harness-governance.md (FR-237, FR-239, FR-240, FR-306, FR-307, FR-308), the routing table of
// plugins/assist-plugin/rules/severity-policy.md, the format comments of rules/severity-catalog.yaml, and the public interface:
//   parseCatalog(text)              -> a rule-id map of {severity, basis}, or null; strict and fail-closed: a malformed file is
//                                      discarded whole, so the caller keeps each reviewer's severity as written
//   catalogEntry(catalog, ruleId)   -> the {severity, basis} entry, or null
//   resolveSeverity(finding, catalog) -> {rule_id, source, severity, reviewer_severity, catalog_severity, differs, basis,
//                                      unmapped, note}; a rule id in the catalog sets the severity from the catalog and notes
//                                      the difference; a finding with no catalog rule id and no CWE id reads unmapped
//   routeWithCatalog(finding, catalog) -> the resolved severity plus the routing; an unmapped finding routes no higher than
//                                      inline-comment; a null catalog leaves the existing behavior
//   route(finding)                  -> unchanged: reads only severity and confidence
// The spec carries no SPEC-NNN id, so it is cited by file name. The library body is never read. The unit tests use synthetic
// catalogs; the shipped catalog file is read as data.
//
// Traceability format: [AC-N | spec-reviewer-machinery | FR-nnn]. AC-N is the position of the Scenario inside its Requirement
// (Requirement 18: Catalog severity applied is AC-1, Unmapped high finding is AC-2; Requirement 19: AC-1 and AC-2).
//
// Run: node --test tests/hooks/severity-catalog.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const severity = require(path.join(PLUGIN, "hooks", "lib", "severity.js"));

const SPEC = "spec-reviewer-machinery";
function tag(ac, fr) {
  return "[AC-" + ac + " | " + SPEC + " | " + fr + "]";
}

const SHIPPED_CATALOG = fs.readFileSync(path.join(PLUGIN, "rules", "severity-catalog.yaml"), "utf8");
const SHIPPED_REGISTER = fs.readFileSync(path.join(PLUGIN, "rules", "reviewer-checklists.md"), "utf8");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function catalogText(entries, head) {
  const lines = [head === undefined ? "# synthetic catalog" : head, ""];
  entries.forEach((e) => {
    lines.push(e[0] + ":", "  severity: " + e[1], "  basis: " + e[2]);
  });
  return lines.join("\n") + "\n";
}

const ENTRIES = [
  ["DD-01", "MEDIUM", "CWE-400"],
  ["DD-04", "HIGH", "CWE-182"],
  ["DD-09", "LOW", "measured-precision"],
  ["AS-01", "HIGH", "CWE-284"],
];

function catalog() {
  const parsed = severity.parseCatalog(catalogText(ENTRIES));
  assert.ok(parsed, "the synthetic catalog must parse");
  return parsed;
}

function finding(over) {
  return Object.assign({ id: "F-1", rule_id: "DD-01", severity: "HIGH", confidence: "High", file: "src/parse.js", line: 12 }, over || {});
}

function routingOf(result) {
  if (typeof result === "string") return result;
  return result && (result.routing !== undefined ? result.routing : result.route);
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.keys(value).forEach((k) => deepFreeze(value[k]));
  }
  return value;
}

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const CONFIDENCES = ["High", "Medium", "Low"];

// ---------------------------------------------------------------------------
// The interface
// ---------------------------------------------------------------------------

test(tag(1, "FR-306") + " the module exports the catalog functions and keeps route and labelOf", () => {
  ["parseCatalog", "catalogEntry", "resolveSeverity", "routeWithCatalog", "route", "applyMode", "labelOf", "checkFinding"].forEach((name) => {
    assert.strictEqual(typeof severity[name], "function", name);
  });
  assert.strictEqual(typeof severity.MAX_CATALOG_CHARS, "number");
});

// ---------------------------------------------------------------------------
// parseCatalog: the strict format
// ---------------------------------------------------------------------------

test(tag(1, "FR-306") + " a catalog in the documented format parses, and each entry holds its severity and basis", () => {
  const parsed = severity.parseCatalog(catalogText(ENTRIES));
  assert.ok(parsed);
  assert.strictEqual(severity.catalogEntry(parsed, "DD-01").severity, "MEDIUM");
  assert.strictEqual(severity.catalogEntry(parsed, "DD-01").basis, "CWE-400");
  assert.strictEqual(severity.catalogEntry(parsed, "DD-09").severity, "LOW");
  assert.strictEqual(severity.catalogEntry(parsed, "DD-09").basis, "measured-precision");
  assert.strictEqual(severity.catalogEntry(parsed, "AS-01").severity, "HIGH");
});

test(tag(1, "FR-306") + " comment lines and blank lines are skipped", () => {
  const text = "# one\n\n   # an indented comment\nDD-01:\n  severity: MEDIUM\n  basis: CWE-400\n\n# between\nDD-02:\n  severity: LOW\n  basis: measured-precision\n";
  const parsed = severity.parseCatalog(text);
  assert.ok(parsed);
  assert.strictEqual(severity.catalogEntry(parsed, "DD-02").severity, "LOW");
});

test(tag(1, "FR-306") + " each of the four severities is accepted", () => {
  SEVERITIES.forEach((sev) => {
    const parsed = severity.parseCatalog(catalogText([["X-01", sev, "CWE-20"]]));
    assert.ok(parsed, sev);
    assert.strictEqual(severity.catalogEntry(parsed, "X-01").severity, sev);
  });
});

test(tag(1, "FR-306") + " a malformed catalog is discarded whole: one bad entry in an otherwise good file yields no map at all", () => {
  const good = catalogText(ENTRIES);
  const malformed = {
    "a duplicate rule id": good + "DD-01:\n  severity: LOW\n  basis: CWE-400\n",
    "an unknown field": good + "DD-20:\n  severity: LOW\n  basis: CWE-20\n  owner: someone\n",
    "a missing basis": good + "DD-20:\n  severity: LOW\n",
    "a missing severity": good + "DD-20:\n  basis: CWE-20\n",
    "a lower-case severity": good + "DD-20:\n  severity: high\n  basis: CWE-20\n",
    "an unknown severity": good + "DD-20:\n  severity: SEVERE\n  basis: CWE-20\n",
    "an empty severity": good + "DD-20:\n  severity:\n  basis: CWE-20\n",
    "a tab in a line": good + "DD-20:\n\tseverity: LOW\n  basis: CWE-20\n",
    "a four-space indent": good + "DD-20:\n    severity: LOW\n  basis: CWE-20\n",
    "a one-space indent": good + "DD-20:\n severity: LOW\n  basis: CWE-20\n",
    "a comment after a value": good + "DD-20:\n  severity: LOW # provisional\n  basis: CWE-20\n",
    "a value on the id line": good + "DD-20: LOW\n  severity: LOW\n  basis: CWE-20\n",
    "a repeated field": good + "DD-20:\n  severity: LOW\n  severity: HIGH\n  basis: CWE-20\n",
    "a NUL character": good + "DD-20:\n  severity: LOW\u0000\n  basis: CWE-20\n",
    "a stray line": good + "this line fits no shape\n",
    "a field before any entry": "  severity: LOW\n" + good,
    "a six-digit CWE basis": good + "DD-20:\n  severity: LOW\n  basis: CWE-123456\n",
    "an upper-case token basis": good + "DD-20:\n  severity: LOW\n  basis: MEASURED\n",
    "a basis with spaces": good + "DD-20:\n  severity: LOW\n  basis: some words here\n",
  };
  Object.keys(malformed).forEach((why) => {
    assert.strictEqual(severity.parseCatalog(malformed[why]), null, why);
  });
});

test(tag(1, "FR-306") + " the entry count has a boundary: 512 entries parse and 513 entries are discarded", () => {
  function many(n) {
    const entries = [];
    for (let i = 1; i <= n; i += 1) entries.push(["R-" + String(i).padStart(4, "0"), "LOW", "measured-precision"]);
    return catalogText(entries);
  }
  assert.ok(severity.parseCatalog(many(512)), "512 entries");
  assert.strictEqual(severity.parseCatalog(many(513)), null, "513 entries");
});

test(tag(1, "FR-306") + " a catalog text longer than the documented maximum is discarded", () => {
  const long = "# " + "x".repeat(severity.MAX_CATALOG_CHARS + 10) + "\n" + catalogText(ENTRIES);
  assert.ok(long.length > severity.MAX_CATALOG_CHARS);
  assert.strictEqual(severity.parseCatalog(long), null);
});

test(tag(1, "FR-306") + " text that is absent or not a string yields no catalog and no throw", () => {
  [undefined, null, 0, 5, true, {}, [], ["DD-01:"]].forEach((bad) => {
    let out;
    assert.doesNotThrow(() => {
      out = severity.parseCatalog(bad);
    }, JSON.stringify(bad));
    assert.strictEqual(out, null, JSON.stringify(bad));
  });
});

test(tag(1, "FR-306") + " the entry of a rule the catalog does not name is null, and inherited property names never map", () => {
  const parsed = catalog();
  ["DD-99", "", "dd-01", " DD-01", "DD-01 ", "__proto__", "constructor", "toString", "hasOwnProperty", "prototype"].forEach((id) => {
    assert.strictEqual(severity.catalogEntry(parsed, id), null, JSON.stringify(id));
  });
  [undefined, null, 5, {}, [], true].forEach((id) => {
    assert.strictEqual(severity.catalogEntry(parsed, id), null, JSON.stringify(id));
  });
  [null, undefined, "x", 5].forEach((bad) => {
    assert.strictEqual(severity.catalogEntry(bad, "DD-01"), null, JSON.stringify(bad));
  });
});

test(tag(1, "FR-306") + " a hostile rule id in the catalog file never pollutes Object.prototype or maps an inherited name", () => {
  // Security-adjacent: prototype names as rule ids.
  ["__proto__", "constructor", "prototype"].forEach((id) => {
    const parsed = severity.parseCatalog(catalogText([[id, "HIGH", "CWE-20"]]));
    assert.strictEqual(({}).severity, undefined, "Object.prototype.severity after parsing " + id);
    assert.strictEqual(({}).basis, undefined, "Object.prototype.basis after parsing " + id);
    if (parsed !== null) assert.strictEqual(severity.catalogEntry(parsed, "toString"), null);
  });
});

// ---------------------------------------------------------------------------
// The shipped catalog
// ---------------------------------------------------------------------------

test(tag(1, "FR-306") + " the shipped catalog file parses and maps DD-01 to MEDIUM", () => {
  const parsed = severity.parseCatalog(SHIPPED_CATALOG);
  assert.ok(parsed, "rules/severity-catalog.yaml does not follow its own strict format");
  assert.strictEqual(severity.catalogEntry(parsed, "DD-01").severity, "MEDIUM");
});

test(tag(1, "FR-306") + " the shipped catalog maps every one of the 23 checklist items of the register to a valid severity and a basis", () => {
  const parsed = severity.parseCatalog(SHIPPED_CATALOG);
  assert.ok(parsed);
  const ids = [];
  const re = /^\| ((?:DD|TI|AS)-\d{2}) \|/gm;
  let m;
  while ((m = re.exec(SHIPPED_REGISTER)) !== null) ids.push(m[1]);
  assert.strictEqual(ids.length, 23);
  ids.forEach((id) => {
    const entry = severity.catalogEntry(parsed, id);
    assert.ok(entry, "the catalog has no entry for " + id);
    assert.ok(SEVERITIES.indexOf(entry.severity) !== -1, id + " severity " + entry.severity);
    assert.ok(typeof entry.basis === "string" && entry.basis.length > 0, id + " basis");
  });
});

test(tag(1, "FR-306") + " the checklist register holds no severity column: the catalog is the one place severity is fixed", () => {
  const header = SHIPPED_REGISTER.split("\n").find((l) => /^\| ID \| Lane \|/.test(l));
  assert.ok(header && !/severity/i.test(header), header);
});

test(tag(1, "FR-306") + " the catalog applied to the shipped catalog: a reviewer's HIGH for DD-01 is recorded as the catalog severity MEDIUM with the difference noted", () => {
  const parsed = severity.parseCatalog(SHIPPED_CATALOG);
  const r = severity.resolveSeverity(finding({ rule_id: "DD-01", severity: "HIGH" }), parsed);
  assert.strictEqual(r.severity, "MEDIUM");
  assert.strictEqual(r.differs, true);
});

// ---------------------------------------------------------------------------
// Requirement 18, Catalog severity applied
// ---------------------------------------------------------------------------

test(tag(1, "FR-306") + " catalog entry DD-01 is MEDIUM and the reviewer wrote HIGH: the recorded severity reads MEDIUM", () => {
  const r = severity.resolveSeverity(finding({ rule_id: "DD-01", severity: "HIGH" }), catalog());
  assert.strictEqual(r.severity, "MEDIUM");
  assert.strictEqual(r.catalog_severity, "MEDIUM");
  assert.strictEqual(r.reviewer_severity, "HIGH");
  assert.strictEqual(r.source, "catalog");
  assert.strictEqual(r.unmapped, false);
  assert.strictEqual(r.rule_id, "DD-01");
});

test(tag(1, "FR-306") + " the report notes the difference: the note names both severities", () => {
  const r = severity.resolveSeverity(finding({ rule_id: "DD-01", severity: "HIGH" }), catalog());
  assert.strictEqual(r.differs, true);
  assert.strictEqual(typeof r.note, "string");
  assert.ok(r.note.indexOf("HIGH") !== -1 && r.note.indexOf("MEDIUM") !== -1, "note: " + r.note);
});

test(tag(1, "FR-306") + " the note holds rule ids and severity names only, never the finding's text", () => {
  const r = severity.resolveSeverity(finding({ rule_id: "DD-01", severity: "HIGH", problem: "quotes the secret sk-live-QQQ111", text: "sk-live-QQQ111" }), catalog());
  assert.ok(JSON.stringify(r).indexOf("sk-live") === -1, JSON.stringify(r));
});

test(tag(1, "FR-306") + " when the reviewer and the catalog agree, nothing differs", () => {
  const r = severity.resolveSeverity(finding({ rule_id: "DD-01", severity: "MEDIUM" }), catalog());
  assert.strictEqual(r.severity, "MEDIUM");
  assert.strictEqual(r.differs, false);
});

test(tag(1, "FR-306") + " the catalog wins in both directions: a LOW from the reviewer for a HIGH entry reads HIGH, and a HIGH for a LOW entry reads LOW", () => {
  const up = severity.resolveSeverity(finding({ rule_id: "AS-01", severity: "LOW" }), catalog());
  assert.strictEqual(up.severity, "HIGH");
  assert.strictEqual(up.differs, true);
  const down = severity.resolveSeverity(finding({ rule_id: "DD-09", severity: "HIGH" }), catalog());
  assert.strictEqual(down.severity, "LOW");
  assert.strictEqual(down.differs, true);
});

test(tag(1, "FR-306") + " a rule id in the catalog takes the catalog severity even when the finding also carries a CWE id", () => {
  const r = severity.resolveSeverity(finding({ rule_id: "DD-01", severity: "HIGH", cwe: "CWE-89" }), catalog());
  assert.strictEqual(r.severity, "MEDIUM");
  assert.strictEqual(r.source, "catalog");
  assert.strictEqual(r.unmapped, false);
});

test(tag(1, "FR-306") + " the finding is not dropped: the result names its rule id, and the input is not changed", () => {
  const input = deepFreeze(finding({ rule_id: "DD-01", severity: "HIGH" }));
  const r = severity.resolveSeverity(input, catalog());
  assert.strictEqual(r.rule_id, "DD-01");
  assert.strictEqual(input.severity, "HIGH");
});

test(tag(1, "FR-306") + " the catalog severity sets the routing: a reviewer HIGH at High confidence for DD-01 (MEDIUM) routes inline-comment, not block-merge", () => {
  const f = finding({ rule_id: "DD-01", severity: "HIGH", confidence: "High" });
  assert.strictEqual(severity.route(f), "block-merge", "the reviewer's own severity would block");
  assert.strictEqual(routingOf(severity.routeWithCatalog(f, catalog())), "inline-comment");
});

test(tag(1, "FR-306") + " a catalog entry that is HIGH keeps block-merge at High confidence, and one that is LOW routes log-only", () => {
  assert.strictEqual(routingOf(severity.routeWithCatalog(finding({ rule_id: "DD-04", severity: "HIGH", confidence: "High" }), catalog())), "block-merge");
  assert.strictEqual(routingOf(severity.routeWithCatalog(finding({ rule_id: "DD-09", severity: "HIGH", confidence: "High" }), catalog())), "log-only");
});

test(tag(1, "FR-306") + " a LOW the reviewer wrote for a HIGH entry routes as HIGH: block-merge at High confidence", () => {
  assert.strictEqual(routingOf(severity.routeWithCatalog(finding({ rule_id: "AS-01", severity: "LOW", confidence: "High" }), catalog())), "block-merge");
});

test(tag(1, "FR-306") + " the catalog routing still reads confidence: a HIGH entry at Low confidence routes inline-comment", () => {
  assert.strictEqual(routingOf(severity.routeWithCatalog(finding({ rule_id: "DD-04", severity: "MEDIUM", confidence: "Low" }), catalog())), "inline-comment");
});

// ---------------------------------------------------------------------------
// Requirement 18, Unmapped high finding
// ---------------------------------------------------------------------------

test(tag(2, "FR-307") + " a HIGH finding at High confidence with no catalog rule and no CWE id reads unmapped", () => {
  const r = severity.resolveSeverity(finding({ rule_id: "zz-unknown-class", severity: "HIGH", confidence: "High" }), catalog());
  assert.strictEqual(r.unmapped, true);
  assert.strictEqual(r.source, "unmapped");
  assert.strictEqual(r.severity, "HIGH", "the finding keeps the reviewer's severity; it is not dropped or lowered");
});

test(tag(2, "FR-307") + " the same finding does not route block-merge: it routes inline-comment", () => {
  const f = finding({ rule_id: "zz-unknown-class", severity: "HIGH", confidence: "High" });
  assert.strictEqual(severity.route(f), "block-merge", "route() alone would block");
  const routing = routingOf(severity.routeWithCatalog(f, catalog()));
  assert.notStrictEqual(routing, "block-merge");
  assert.strictEqual(routing, "inline-comment");
});

test(tag(2, "FR-307") + " no unmapped finding routes block-merge, at any severity and any confidence", () => {
  SEVERITIES.forEach((sev) => {
    CONFIDENCES.forEach((conf) => {
      const routing = routingOf(severity.routeWithCatalog(finding({ rule_id: "zz-unknown-class", severity: sev, confidence: conf }), catalog()));
      assert.notStrictEqual(routing, "block-merge", sev + " at " + conf);
      assert.ok(["inline-comment", "log-only"].indexOf(routing) !== -1, sev + " at " + conf + ": " + routing);
    });
  });
});

test(tag(2, "FR-307") + " the clamp lowers only block-merge: every lower routing of an unmapped finding stays as the policy gives it", () => {
  const cases = [
    ["CRITICAL", "Medium", "inline-comment"],
    ["HIGH", "Low", "inline-comment"],
    ["MEDIUM", "High", "inline-comment"],
    ["MEDIUM", "Medium", "inline-comment"],
    ["MEDIUM", "Low", "log-only"],
    ["LOW", "High", "log-only"],
    ["LOW", "Low", "log-only"],
  ];
  cases.forEach((c) => {
    const f = finding({ rule_id: "zz-unknown-class", severity: c[0], confidence: c[1] });
    assert.strictEqual(routingOf(severity.routeWithCatalog(f, catalog())), c[2], c[0] + " at " + c[1]);
  });
});

test(tag(2, "FR-307") + " a CRITICAL finding at High confidence with no catalog rule and no CWE id also routes no higher than inline-comment", () => {
  assert.strictEqual(routingOf(severity.routeWithCatalog(finding({ rule_id: "zz-unknown-class", severity: "CRITICAL", confidence: "High" }), catalog())), "inline-comment");
});

test(tag(2, "FR-307") + " a finding with no rule id at all, and no CWE id, reads unmapped", () => {
  const f = finding({ severity: "HIGH", confidence: "High" });
  delete f.rule_id;
  const r = severity.resolveSeverity(f, catalog());
  assert.strictEqual(r.unmapped, true);
  assert.notStrictEqual(routingOf(severity.routeWithCatalog(f, catalog())), "block-merge");
});

test(tag(2, "FR-307") + " a finding with a CWE id and no catalog entry is not unmapped: it keeps the reviewer's severity and its normal routing", () => {
  const f = finding({ rule_id: "zz-unknown-class", severity: "HIGH", confidence: "High", cwe: "CWE-89" });
  const r = severity.resolveSeverity(f, catalog());
  assert.strictEqual(r.unmapped, false);
  assert.strictEqual(r.source, "cwe");
  assert.strictEqual(r.severity, "HIGH");
  assert.strictEqual(routingOf(severity.routeWithCatalog(f, catalog())), "block-merge");
});

test(tag(2, "FR-307") + " a CWE id is read with its case folded, and a value that is not a CWE id does not count as one", () => {
  assert.strictEqual(severity.resolveSeverity(finding({ rule_id: "zz-x", cwe: "cwe-89" }), catalog()).unmapped, false);
  // Invalid and injection-shaped inputs: none is a CWE id, so each finding reads unmapped.
  ["CWE-", "CWE", "89", "CWE-abc", "CWE-1234567", "CWE-89; DROP TABLE x", "<script>", "", "  ", null, 89, {}, ["CWE-89"]].forEach((bad) => {
    const r = severity.resolveSeverity(finding({ rule_id: "zz-x", cwe: bad }), catalog());
    assert.strictEqual(r.unmapped, true, "cwe " + JSON.stringify(bad));
  });
});

test(tag(2, "FR-307") + " an inherited property name or a hostile rule id never maps a catalog entry", () => {
  ["__proto__", "constructor", "toString", "hasOwnProperty", "DD-01\n", " DD-01", "dd-01"].forEach((id) => {
    const r = severity.resolveSeverity(finding({ rule_id: id, severity: "HIGH" }), catalog());
    assert.strictEqual(r.source !== "catalog", true, JSON.stringify(id));
    assert.strictEqual(r.unmapped, true, JSON.stringify(id));
  });
});

// ---------------------------------------------------------------------------
// No catalog: the existing behavior
// ---------------------------------------------------------------------------

test(tag(1, "FR-240") + " with no usable catalog the reviewer's severity stands, nothing differs, and nothing reads unmapped", () => {
  [null, undefined].forEach((none) => {
    const r = severity.resolveSeverity(finding({ rule_id: "DD-01", severity: "HIGH" }), none);
    assert.strictEqual(r.severity, "HIGH");
    assert.strictEqual(r.differs, false);
    assert.strictEqual(r.unmapped, false);
    assert.strictEqual(r.source, "no-catalog");
  });
});

test(tag(1, "FR-240") + " with no catalog, routeWithCatalog equals route() for every severity and confidence, an unmapped-looking finding included", () => {
  SEVERITIES.forEach((sev) => {
    CONFIDENCES.forEach((conf) => {
      const f = finding({ rule_id: "zz-unknown-class", severity: sev, confidence: conf });
      assert.strictEqual(routingOf(severity.routeWithCatalog(f, null)), severity.route(f), sev + " at " + conf);
    });
  });
});

test(tag(1, "FR-240") + " a malformed catalog text reads as no catalog: the reviewer's severity stands and nothing reads unmapped", () => {
  const bad = severity.parseCatalog(catalogText(ENTRIES) + "stray line\n");
  assert.strictEqual(bad, null);
  const r = severity.resolveSeverity(finding({ rule_id: "DD-01", severity: "HIGH" }), bad);
  assert.strictEqual(r.severity, "HIGH");
  assert.strictEqual(r.unmapped, false);
});

// ---------------------------------------------------------------------------
// Requirement 19: a critic or filtering score changes nothing
// ---------------------------------------------------------------------------

test(tag(1, "FR-308") + " a critic score that rates a finding likely false leaves its severity and routing as they are", () => {
  const plain = finding({ rule_id: "DD-04", severity: "HIGH", confidence: "High" });
  const scored = finding({ rule_id: "DD-04", severity: "HIGH", confidence: "High", critic_score: 0.99, likely_false: true, filtered: true, score: 0.01 });
  assert.deepStrictEqual(severity.resolveSeverity(scored, catalog()), severity.resolveSeverity(plain, catalog()));
  assert.deepStrictEqual(severity.routeWithCatalog(scored, catalog()), severity.routeWithCatalog(plain, catalog()));
});

test(tag(2, "FR-308") + " a critic score that rates a finding critical does not raise a catalog MEDIUM or an unmapped finding", () => {
  const f = finding({ rule_id: "DD-01", severity: "MEDIUM", critic_score: 1, critic_severity: "CRITICAL", critic: { score: 1, severity: "CRITICAL" } });
  assert.strictEqual(severity.resolveSeverity(f, catalog()).severity, "MEDIUM");
  const u = finding({ rule_id: "zz-unknown-class", severity: "MEDIUM", critic_severity: "CRITICAL", critic_score: 1 });
  const ru = severity.resolveSeverity(u, catalog());
  assert.strictEqual(ru.severity, "MEDIUM");
  assert.strictEqual(ru.unmapped, true);
  assert.notStrictEqual(routingOf(severity.routeWithCatalog(u, catalog())), "block-merge");
});

// ---------------------------------------------------------------------------
// Robustness and the unchanged routing function
// ---------------------------------------------------------------------------

test(tag(2, "FR-307") + " resolveSeverity and routeWithCatalog do not throw for a finding or a catalog of the wrong type, and never route block-merge for an unreadable finding", () => {
  [undefined, null, 0, "x", [], true, {}, { severity: "HIGH" }, { rule_id: 7, severity: {}, confidence: [] }].forEach((bad) => {
    [catalog(), null, undefined, "x", 5, {}].forEach((cat) => {
      assert.doesNotThrow(() => severity.resolveSeverity(bad, cat), JSON.stringify(bad));
      let routed;
      assert.doesNotThrow(() => {
        routed = severity.routeWithCatalog(bad, cat);
      }, JSON.stringify(bad));
      assert.notStrictEqual(routingOf(routed), "block-merge", "finding " + JSON.stringify(bad));
    });
  });
});

test(tag(1, "FR-239") + " route() is unchanged by the catalog work: it ignores rule_id, cwe, and any catalog field", () => {
  assert.strictEqual(severity.route({ severity: "HIGH", confidence: "High", rule_id: "DD-01" }), "block-merge");
  assert.strictEqual(severity.route({ severity: "HIGH", confidence: "High", rule_id: "zz-unknown", cwe: "CWE-89", catalog_severity: "LOW", unmapped: true }), "block-merge");
  assert.strictEqual(severity.route({ severity: "MEDIUM", confidence: "Low", rule_id: "AS-01" }), "log-only");
  assert.strictEqual(severity.route({ severity: "LOW", confidence: "High", rule_id: "AS-01" }), "log-only");
});

test(tag(1, "FR-239") + " the policy table holds for route(): only HIGH or CRITICAL at High confidence is block-merge", () => {
  SEVERITIES.forEach((sev) => {
    CONFIDENCES.forEach((conf) => {
      const expected = (sev === "HIGH" || sev === "CRITICAL") && conf === "High" ? "block-merge" : severity.route({ severity: sev, confidence: conf });
      assert.strictEqual(severity.route({ severity: sev, confidence: conf }), expected);
    });
  });
  assert.strictEqual(severity.route({ severity: "CRITICAL", confidence: "High" }), "block-merge");
  assert.strictEqual(severity.route({ severity: "HIGH", confidence: "Medium" }), "inline-comment");
});

test(tag(1, "FR-306") + " a labelled deferred record reads as unlabelled to labelOf, so the code-scan baseline is unchanged by the deferred label", () => {
  assert.strictEqual(severity.labelOf({ label: "deferred", labelled_by: "user" }), null);
  assert.strictEqual(severity.labelOf({ label: true, labelled_by: "user" }), true);
  assert.strictEqual(severity.labelOf({ label: false, labelled_by: "user" }), false);
});
