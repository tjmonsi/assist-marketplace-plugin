// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the template filter of the harness case list (benchmark-run build, Step 4b):
// plugins/assist-plugin/scripts/eval-harness/run-benchmark.js (`listCases({ evalsDir, benchmark, suite, caseId })`).
//
// Sources: specs/spec-evaluation-harness.md, the 2026-11-26 Change Log delta (ADDED Requirement: Worked-sample task as the
// golden-task template, the sentence "The sample SHALL be marked a template and SHALL NOT be counted as a production
// benchmark task", and Scenario 2 "Sample marked a template"; Requirement: Benchmark section and release-over-release
// comparison, the held-out Scenarios); docs/task-plans/task-plan-eval-benchmark-run-20261126-1442.md (Step 4b and its
// acceptance criteria). Requirement text: docs/requirements/FR-NFR-harness-governance.md (FR-280, FR-281).
//
// Traceability format: [AC-N | spec file | FR ids]. The spec has no SPEC-NNN id, so it is cited by file name.
//   AC-2  is R-B Scenario 2, "Sample marked a template". The exclusion tests derive from the SHALL NOT sentence in that
//         Requirement; the spec states no separate Scenario for it, so AC-2 is the nearest Scenario and the task plan's
//         Acceptance Criteria table row "Template excluded from an unfiltered benchmark run" is the derivation.
//   AC-16 and AC-17 are the existing held-out Scenario labels used in eval-harness-run-benchmark.test.js (ordinary list
//         leaves out a held-out case; a benchmark request includes it).
//
// Contract used (listCases):
//   - Lists the golden tasks under evals/dev/<case>/ and evals/spec/<case>/ as entries { suite, caseId, heldOut }.
//   - A task whose task.json holds `"template": true` is left out of every list that names no case, including a benchmark
//     list. It is listed when `caseId` names it. Only the boolean true marks a template: a string "true", a number, or false
//     does not.
//   - A task flagged `held_out` is left out of an ordinary list and included when `benchmark` is true (unchanged).
//   - The two filters are independent: a case that is both a template and held out follows both rules.
//
// Run: node --test tests/scripts/eval-harness-list-template.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLUGIN = path.join(__dirname, "..", "..", "plugins", "assist-plugin");
const benchmark = require(path.join(PLUGIN, "scripts", "eval-harness", "run-benchmark.js"));

const BASE_META = { provenance: "in-house", creation_date: "2026-11-01", valid_against_cutoff: "2026-06-30" };

const created = [];
after(() => {
  created.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-list-template-test-"));
  created.push(dir);
  return dir;
}

function put(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

// Writes one golden-task folder with a minimal valid task.json plus the flags in extra.
function addCase(evalsDir, suite, caseId, extra) {
  const taskDir = path.join(evalsDir, suite, caseId);
  put(path.join(taskDir, "prompt.md"), "Do the task.\n");
  put(path.join(taskDir, "graders", "grader.json"), "{}\n");
  put(path.join(taskDir, "task.json"), JSON.stringify(Object.assign({}, BASE_META, extra || {})));
}

// The fixture of the task plan: a normal, a template, a held-out, and a string-template case in dev; a template case in
// spec. Extra cases cover the strictness (template false and a number) and the template-and-held-out overlap.
function buildEvals() {
  const evalsDir = path.join(tmpDir(), "evals");
  addCase(evalsDir, "dev", "normal-case");
  addCase(evalsDir, "dev", "template-case", { template: true });
  addCase(evalsDir, "dev", "held-case", { held_out: true });
  addCase(evalsDir, "dev", "string-template", { template: "true" });
  addCase(evalsDir, "dev", "false-template", { template: false });
  addCase(evalsDir, "dev", "numeric-template", { template: 1 });
  addCase(evalsDir, "dev", "held-template", { template: true, held_out: true });
  addCase(evalsDir, "spec", "spec-normal");
  addCase(evalsDir, "spec", "spec-template", { template: true });
  return evalsDir;
}

function ids(listed) {
  return listed.map((entry) => entry.suite + "/" + entry.caseId).sort();
}

// ---------------------------------------------------------------------------
// An unfiltered list omits templates and keeps normal cases
// ---------------------------------------------------------------------------

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] an unfiltered benchmark list omits the template case in dev and in spec and includes the normal cases", () => {
  const listed = ids(benchmark.listCases({ evalsDir: buildEvals(), benchmark: true }));
  assert.ok(!listed.includes("dev/template-case"), "the dev template was listed: " + listed.join(", "));
  assert.ok(!listed.includes("spec/spec-template"), "the spec template was listed: " + listed.join(", "));
  assert.ok(listed.includes("dev/normal-case"), "the normal dev case is missing: " + listed.join(", "));
  assert.ok(listed.includes("spec/spec-normal"), "the normal spec case is missing: " + listed.join(", "));
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] an unfiltered benchmark list holds exactly the production cases", () => {
  const listed = ids(benchmark.listCases({ evalsDir: buildEvals(), benchmark: true }));
  assert.deepStrictEqual(listed, [
    "dev/false-template",
    "dev/held-case",
    "dev/normal-case",
    "dev/numeric-template",
    "dev/string-template",
    "spec/spec-normal",
  ]);
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] an ordinary list (benchmark false) omits the template cases and the held-out case and includes the normal case", () => {
  const listed = ids(benchmark.listCases({ evalsDir: buildEvals(), benchmark: false }));
  assert.ok(!listed.includes("dev/template-case"));
  assert.ok(!listed.includes("spec/spec-template"));
  assert.ok(!listed.includes("dev/held-case"));
  assert.ok(listed.includes("dev/normal-case"));
  assert.ok(listed.includes("spec/spec-normal"));
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a list with no options besides the folder omits the template cases", () => {
  // Null/empty: no benchmark and no case id.
  const listed = ids(benchmark.listCases({ evalsDir: buildEvals() }));
  assert.ok(!listed.includes("dev/template-case"));
  assert.ok(!listed.includes("spec/spec-template"));
  assert.ok(listed.includes("dev/normal-case"));
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a benchmark list limited to one suite still omits that suite's template case", () => {
  const evalsDir = buildEvals();
  const dev = ids(benchmark.listCases({ evalsDir, benchmark: true, suite: "dev" }));
  const spec = ids(benchmark.listCases({ evalsDir, benchmark: true, suite: "spec" }));
  assert.ok(!dev.includes("dev/template-case"));
  assert.ok(dev.includes("dev/normal-case"));
  assert.deepStrictEqual(spec, ["spec/spec-normal"]);
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a suite whose only case is a template lists no case when no case id is given", () => {
  // Boundary: the only task in the suite is the template.
  const evalsDir = path.join(tmpDir(), "evals");
  addCase(evalsDir, "dev", "only-template", { template: true });
  assert.deepStrictEqual(benchmark.listCases({ evalsDir, benchmark: true }), []);
  assert.deepStrictEqual(benchmark.listCases({ evalsDir, benchmark: false }), []);
});

// ---------------------------------------------------------------------------
// An explicit case id lists the template
// ---------------------------------------------------------------------------

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a case id that names the dev template lists it, with benchmark true", () => {
  const listed = benchmark.listCases({ evalsDir: buildEvals(), benchmark: true, caseId: "template-case" });
  assert.deepStrictEqual(ids(listed), ["dev/template-case"]);
  assert.strictEqual(listed[0].heldOut, false);
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a case id that names the dev template lists it, with benchmark false", () => {
  const listed = benchmark.listCases({ evalsDir: buildEvals(), benchmark: false, caseId: "template-case" });
  assert.deepStrictEqual(ids(listed), ["dev/template-case"]);
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a case id that names the dev template lists it when no benchmark option is given", () => {
  // Null/empty: no benchmark option.
  const listed = benchmark.listCases({ evalsDir: buildEvals(), caseId: "template-case" });
  assert.deepStrictEqual(ids(listed), ["dev/template-case"]);
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a case id that names the spec template lists it, with and without benchmark true", () => {
  const evalsDir = buildEvals();
  assert.deepStrictEqual(ids(benchmark.listCases({ evalsDir, benchmark: true, caseId: "spec-template" })), ["spec/spec-template"]);
  assert.deepStrictEqual(ids(benchmark.listCases({ evalsDir, benchmark: false, caseId: "spec-template" })), ["spec/spec-template"]);
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a case id together with the matching suite lists the template", () => {
  const evalsDir = buildEvals();
  assert.deepStrictEqual(ids(benchmark.listCases({ evalsDir, benchmark: true, suite: "dev", caseId: "template-case" })), ["dev/template-case"]);
  assert.deepStrictEqual(ids(benchmark.listCases({ evalsDir, benchmark: true, suite: "spec", caseId: "spec-template" })), ["spec/spec-template"]);
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a case id that names a template in the other suite lists nothing", () => {
  // Invalid: the id exists, but not in the requested suite.
  const listed = benchmark.listCases({ evalsDir: buildEvals(), benchmark: true, suite: "spec", caseId: "template-case" });
  assert.deepStrictEqual(listed, []);
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a case id that names a normal case still lists only that case", () => {
  const listed = benchmark.listCases({ evalsDir: buildEvals(), benchmark: true, caseId: "normal-case" });
  assert.deepStrictEqual(ids(listed), ["dev/normal-case"]);
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a case id that names no case lists nothing, so a template is not listed by a near match", () => {
  // Invalid: an id that only resembles the template's id.
  const evalsDir = buildEvals();
  assert.deepStrictEqual(benchmark.listCases({ evalsDir, benchmark: true, caseId: "template" }), []);
  assert.deepStrictEqual(benchmark.listCases({ evalsDir, benchmark: true, caseId: "template-case-2" }), []);
  assert.deepStrictEqual(benchmark.listCases({ evalsDir, benchmark: true, caseId: "TEMPLATE-CASE" }), []);
});

// ---------------------------------------------------------------------------
// Held-out behavior is unchanged
// ---------------------------------------------------------------------------

test("[AC-16 | spec-evaluation-harness | FR-280 | UR-080] an ordinary list leaves out the held-out case and a benchmark list includes it", () => {
  const evalsDir = buildEvals();
  const ordinary = ids(benchmark.listCases({ evalsDir, benchmark: false }));
  assert.ok(!ordinary.includes("dev/held-case"), "the held-out case was listed in an ordinary run");
  const benchmarkList = benchmark.listCases({ evalsDir, benchmark: true });
  const held = benchmarkList.find((entry) => entry.caseId === "held-case");
  assert.ok(held, "the held-out case is missing from a benchmark list");
  assert.strictEqual(held.suite, "dev");
  assert.strictEqual(held.heldOut, true);
});

test("[AC-17 | spec-evaluation-harness | FR-280 | UR-080] a normal case is not marked held-out in the benchmark list", () => {
  const listed = benchmark.listCases({ evalsDir: buildEvals(), benchmark: true });
  assert.strictEqual(listed.find((entry) => entry.caseId === "normal-case").heldOut, false);
});

test("[AC-16 | spec-evaluation-harness | FR-280 | UR-080] a case id that names the held-out case lists it only on a benchmark request", () => {
  const evalsDir = buildEvals();
  assert.deepStrictEqual(ids(benchmark.listCases({ evalsDir, benchmark: true, caseId: "held-case" })), ["dev/held-case"]);
  assert.deepStrictEqual(benchmark.listCases({ evalsDir, benchmark: false, caseId: "held-case" }), []);
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a case that is both a template and held out is omitted from an unfiltered benchmark list", () => {
  // The two filters are independent: the template rule applies even when held-out cases are included.
  const listed = ids(benchmark.listCases({ evalsDir: buildEvals(), benchmark: true }));
  assert.ok(!listed.includes("dev/held-template"), listed.join(", "));
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a case that is both a template and held out is listed by case id on a benchmark request and marked held-out", () => {
  const listed = benchmark.listCases({ evalsDir: buildEvals(), benchmark: true, caseId: "held-template" });
  assert.deepStrictEqual(ids(listed), ["dev/held-template"]);
  assert.strictEqual(listed[0].heldOut, true);
});

test("[AC-16 | spec-evaluation-harness | FR-280 | UR-080] a case that is both a template and held out stays out of an ordinary list even with its case id", () => {
  // The held-out rule still applies: an explicit case id bypasses only the template filter.
  const listed = benchmark.listCases({ evalsDir: buildEvals(), benchmark: false, caseId: "held-template" });
  assert.deepStrictEqual(listed, []);
});

// ---------------------------------------------------------------------------
// Only the boolean true marks a template
// ---------------------------------------------------------------------------

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a task.json template value of the string true is not a template and the case stays listed", () => {
  // Type mismatch: a string where a boolean belongs.
  const evalsDir = buildEvals();
  const listed = ids(benchmark.listCases({ evalsDir, benchmark: true }));
  assert.ok(listed.includes("dev/string-template"), "the string-true case was treated as a template: " + listed.join(", "));
  assert.ok(ids(benchmark.listCases({ evalsDir, benchmark: false })).includes("dev/string-template"));
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a task.json template value of false is not a template", () => {
  const listed = ids(benchmark.listCases({ evalsDir: buildEvals(), benchmark: true }));
  assert.ok(listed.includes("dev/false-template"), listed.join(", "));
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a task.json template value of the number 1 is not a template", () => {
  // Type mismatch: a truthy number.
  const listed = ids(benchmark.listCases({ evalsDir: buildEvals(), benchmark: true }));
  assert.ok(listed.includes("dev/numeric-template"), listed.join(", "));
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a task.json with no template key is not a template", () => {
  // Null/empty: the key is absent.
  const listed = ids(benchmark.listCases({ evalsDir: buildEvals(), benchmark: false }));
  assert.ok(listed.includes("dev/normal-case"));
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a task.json with template null is not a template", () => {
  // Null/empty: an explicit null.
  const evalsDir = path.join(tmpDir(), "evals");
  addCase(evalsDir, "dev", "null-template", { template: null });
  assert.deepStrictEqual(ids(benchmark.listCases({ evalsDir, benchmark: true })), ["dev/null-template"]);
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a template flag in the prompt text rather than task.json does not make a template", () => {
  // The marker is the task.json field; prose that says template is not a marker.
  const evalsDir = path.join(tmpDir(), "evals");
  addCase(evalsDir, "dev", "prose-template");
  put(path.join(evalsDir, "dev", "prose-template", "prompt.md"), "This is a template. \"template\": true\n");
  assert.deepStrictEqual(ids(benchmark.listCases({ evalsDir, benchmark: true })), ["dev/prose-template"]);
});

test("[AC-2 | spec-evaluation-harness | FR-280 | FR-281] a list of a folder with no tasks is empty", () => {
  // Null/empty.
  assert.deepStrictEqual(benchmark.listCases({ evalsDir: path.join(tmpDir(), "none"), benchmark: true }), []);
});
