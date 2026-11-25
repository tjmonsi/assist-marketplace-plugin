// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the golden-task validator of the evaluation harness (Group A, Step 15):
// plugins/assist-plugin/scripts/eval-harness/task-validator.js (`validateTask(taskDir, { oracle | oracleLocation, suite })`).
//
// Sources: specs/spec-evaluation-harness.md (Requirement: Golden-task contents and case validation; Requirement:
// Contamination controls on golden tasks), and docs/task-plans/task-plan-evaluation-harness-20261125-0717.md (ASM-1, ASM-5,
// ASM-6, Step 3, Step 15). Requirement text: docs/requirements/FR-NFR-harness-governance.md (FR-254 to FR-258, FR-263,
// UR-077, UR-080, SC-025).
//
// Traceability format: [AC-N | spec file | FR/NFR ids | UR/SC ids]. The spec has no SPEC-NNN id, so it is cited by file
// name. AC-N is the position of the Scenario inside its Requirement block.
//   Golden-task contents and case validation (R1): AC-1 Complete coding task accepted, AC-2 Missing hidden suite
//   rejected, AC-3 Spec rubric separates its two item groups, AC-4 Spec rubric mixes the two item groups, AC-5 Hidden
//   test carries its scenario identifier, AC-6 Hidden test without a scenario identifier, AC-7 Task without a graders
//   folder.
//   Contamination controls on golden tasks (R2): AC-1 Complete provenance accepted, AC-2 Missing cutoff rejected, AC-3
//   In-house task accepted, AC-4 Public-dataset task rejected.
//
// Contract used:
//   - A public task directory holds prompt.md, a graders/ folder, task.json (provenance, creation_date,
//     valid_against_cutoff, an optional held_out flag) and, for a spec task, rubric.json with a "deterministic" and a
//     "subjective" group. The private location holds <suite>/<case>/reference/ and <suite>/<case>/hidden/.
//   - validateTask returns { status: "accepted" | "rejected" | "error", problems: [{ part, message }], heldOut, ... }.
//     A rejection names the missing or offending part. "error" means the oracle could not be reached, so nothing was
//     judged against it.
//   - provenance is one of "in-house" or "private-repository". Dates read YYYY-MM-DD. Each hidden test name starts with
//     the [AC-n | spec | FR-n] form.
//   - All fixtures are synthetic stand-ins built under os.tmpdir(). No real oracle content is committed (ASM-1).
//
// Run: node --test tests/scripts/eval-harness-task-validator.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLUGIN = path.join(__dirname, "..", "..", "plugins", "assist-plugin");
const validator = require(path.join(PLUGIN, "scripts", "eval-harness", "task-validator.js"));
const oracle = require(path.join(PLUGIN, "scripts", "eval-harness", "oracle.js"));

const created = [];
after(() => {
  created.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-validator-test-"));
  created.push(dir);
  return dir;
}

function put(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function quietLogger() {
  return () => {};
}

const VALID_META = { provenance: "in-house", creation_date: "2026-11-01", valid_against_cutoff: "2026-06-30" };
const VALID_RUBRIC = {
  deterministic: [{ id: "d1", source: "spec-from-requirements:completeness", check: "every-requirement-has-scenario" }],
  subjective: [{ id: "s1", text: "The spec reads clearly to a new maintainer" }],
};

function hiddenSource(names) {
  const lines = ['const { test } = require("node:test");', 'const assert = require("node:assert");'];
  names.forEach((name) => {
    lines.push("test(" + JSON.stringify(name) + ", () => { assert.ok(true); });");
  });
  return lines.join("\n") + "\n";
}

// Builds a synthetic public task and a synthetic private location. Every part can be turned off or replaced.
//   options.suite     "dev" (default) or "spec"
//   options.meta      task.json object, or null to leave the file out, or a string for raw text
//   options.rubric    rubric.json object (spec tasks), or null to leave it out
//   options.hidden    list of hidden test names, or null to leave the hidden suite out
//   options.reference false to leave the reference out
function makeTask(options) {
  const settings = Object.assign({ suite: "dev", caseId: "case-a", meta: VALID_META, rubric: VALID_RUBRIC, hidden: ["[AC-1 | spec-demo | FR-1] adds two numbers"], reference: true, prompt: true, graders: true }, options || {});
  const publicRoot = tmpDir();
  const privateRoot = tmpDir();
  const taskDir = path.join(publicRoot, settings.suite, settings.caseId);
  fs.mkdirSync(taskDir, { recursive: true });
  if (settings.prompt) {
    put(path.join(taskDir, "prompt.md"), "Do the task.\n");
  }
  if (settings.graders) {
    put(path.join(taskDir, "graders", "grader.json"), "{}\n");
  }
  if (settings.meta !== null) {
    put(path.join(taskDir, "task.json"), typeof settings.meta === "string" ? settings.meta : JSON.stringify(settings.meta));
  }
  if (settings.suite === "spec" && settings.rubric !== null) {
    put(path.join(taskDir, "rubric.json"), JSON.stringify(settings.rubric));
  }
  const caseOracle = path.join(privateRoot, settings.suite, settings.caseId);
  if (settings.reference) {
    put(path.join(caseOracle, "reference", settings.suite === "dev" ? "solution.js" : "reference-spec.md"), settings.suite === "dev" ? "module.exports = {};\n" : "# Reference spec\n");
  }
  if (settings.suite === "dev" && settings.hidden !== null) {
    put(path.join(caseOracle, "hidden", "solution.test.js"), hiddenSource(settings.hidden));
  }
  return { taskDir, privateRoot, suite: settings.suite };
}

function validate(fixture, extra) {
  return validator.validateTask(fixture.taskDir, Object.assign({ oracleLocation: fixture.privateRoot, suite: fixture.suite, logger: quietLogger() }, extra || {}));
}

function problemText(result) {
  return result.problems.map((entry) => entry.part + " " + entry.message).join("\n");
}

// ---------------------------------------------------------------------------
// R1: golden-task contents and case validation
// ---------------------------------------------------------------------------

test("[AC-1 | spec-evaluation-harness | FR-254 | UR-077] a complete coding task (prompt, graders, metadata, reference, hidden suite) is accepted", () => {
  const result = validate(makeTask());
  assert.strictEqual(result.status, "accepted", JSON.stringify(result.problems));
  assert.deepStrictEqual(result.problems, []);
  assert.strictEqual(result.heldOut, false);
});

test("[AC-1 | spec-evaluation-harness | FR-254 | UR-077] a task directory whose suite is read from its parent folder name is accepted", () => {
  const fixture = makeTask();
  const result = validator.validateTask(fixture.taskDir, { oracleLocation: fixture.privateRoot, logger: quietLogger() });
  assert.strictEqual(result.status, "accepted", JSON.stringify(result.problems));
  assert.strictEqual(result.suite, "dev");
});

test("[AC-1 | spec-evaluation-harness | FR-254 | UR-077] a task validated against an already resolved oracle is accepted", () => {
  const fixture = makeTask();
  const resolved = oracle.resolveOracle(fixture.privateRoot, { logger: quietLogger() });
  const result = validator.validateTask(fixture.taskDir, { oracle: resolved, suite: "dev", logger: quietLogger() });
  assert.strictEqual(result.status, "accepted", JSON.stringify(result.problems));
});

test("[AC-2 | spec-evaluation-harness | FR-254 | UR-077] a coding task with no hidden test suite is rejected and the rejection names the hidden test suite", () => {
  const result = validate(makeTask({ hidden: null }));
  assert.strictEqual(result.status, "rejected");
  assert.match(problemText(result), /hidden/i);
});

test("[AC-2 | spec-evaluation-harness | FR-254 | UR-077] a coding task with no reference solution is rejected and the rejection names the reference", () => {
  const result = validate(makeTask({ reference: false }));
  assert.strictEqual(result.status, "rejected");
  assert.match(problemText(result), /reference/i);
});

test("[AC-2 | spec-evaluation-harness | FR-254 | UR-077] a coding task with no prompt is rejected and the rejection names the prompt", () => {
  const result = validate(makeTask({ prompt: false }));
  assert.strictEqual(result.status, "rejected");
  assert.match(problemText(result), /prompt/i);
});

test("[AC-3 | spec-evaluation-harness | FR-255 | UR-077] a spec task whose rubric lists deterministic and subjective items in separate groups is accepted", () => {
  const result = validate(makeTask({ suite: "spec", caseId: "case-s" }));
  assert.strictEqual(result.status, "accepted", JSON.stringify(result.problems));
});

test("[AC-4 | spec-evaluation-harness | FR-255 | UR-077] a spec task whose rubric mixes both kinds of item in one list is rejected", () => {
  const mixed = { items: [{ id: "d1", kind: "deterministic", check: "every-requirement-has-scenario" }, { id: "s1", kind: "subjective", text: "clear" }] };
  const result = validate(makeTask({ suite: "spec", caseId: "case-s", rubric: mixed }));
  assert.strictEqual(result.status, "rejected");
  assert.match(problemText(result), /rubric/i);
});

test("[AC-4 | spec-evaluation-harness | FR-255 | UR-077] a spec rubric that puts a subjective item inside the deterministic group is rejected", () => {
  const crossed = {
    deterministic: [{ id: "d1", kind: "deterministic", check: "every-requirement-has-scenario" }, { id: "s1", kind: "subjective", text: "clear" }],
    subjective: [{ id: "s2", text: "kind and tone" }],
  };
  const result = validate(makeTask({ suite: "spec", caseId: "case-s", rubric: crossed }));
  assert.strictEqual(result.status, "rejected");
});

test("[AC-4 | spec-evaluation-harness | FR-255 | UR-077] a spec rubric with no subjective group is rejected", () => {
  // Null/empty: one of the two groups is missing.
  const result = validate(makeTask({ suite: "spec", caseId: "case-s", rubric: { deterministic: VALID_RUBRIC.deterministic } }));
  assert.strictEqual(result.status, "rejected");
  assert.match(problemText(result), /subjective/i);
});

test("[AC-4 | spec-evaluation-harness | FR-255 | UR-077] a spec task with no rubric file is rejected", () => {
  const result = validate(makeTask({ suite: "spec", caseId: "case-s", rubric: null }));
  assert.strictEqual(result.status, "rejected");
  assert.match(problemText(result), /rubric/i);
});

test("[AC-4 | spec-evaluation-harness | FR-255 | UR-077] a spec task with no reference requirements set or reference spec is rejected", () => {
  const result = validate(makeTask({ suite: "spec", caseId: "case-s", reference: false }));
  assert.strictEqual(result.status, "rejected");
  assert.match(problemText(result), /reference/i);
});

test("[AC-5 | spec-evaluation-harness | FR-256 | UR-077] a hidden test named [AC-2 | spec-foo | FR-045] rejects an empty name is accepted", () => {
  const result = validate(makeTask({ hidden: ["[AC-2 | spec-foo | FR-045] rejects an empty name"] }));
  assert.strictEqual(result.status, "accepted", JSON.stringify(result.problems));
});

test("[AC-5 | spec-evaluation-harness | FR-256 | UR-077] a hidden test that cites more than one requirement id is accepted", () => {
  const result = validate(makeTask({ hidden: ["[AC-3 | spec-foo | FR-045 | NFR-012] handles two requirements"] }));
  assert.strictEqual(result.status, "accepted", JSON.stringify(result.problems));
});

test("[AC-6 | spec-evaluation-harness | FR-256 | UR-077] a hidden test with no scenario identifier rejects the task and the rejection names the test", () => {
  const result = validate(makeTask({ hidden: ["adds two numbers"] }));
  assert.strictEqual(result.status, "rejected");
  assert.ok(problemText(result).includes("adds two numbers"), "the rejection names the test: " + problemText(result));
});

test("[AC-6 | spec-evaluation-harness | FR-256 | UR-077] one unnamed test among identified tests rejects the task and names only that test", () => {
  const result = validate(makeTask({ hidden: ["[AC-1 | spec-demo | FR-1] first", "second has no identifier", "[AC-3 | spec-demo | FR-1] third"] }));
  assert.strictEqual(result.status, "rejected");
  assert.ok(problemText(result).includes("second has no identifier"));
});

[
  "AC-1 | spec-foo | FR-1 missing brackets",
  "[AC-1 | spec-foo] no requirement id",
  "[AC- | spec-foo | FR-1] no scenario number",
  "[AC-1 | spec-foo | FR-1x] bad requirement id",
  "",
].forEach((name) => {
  test("[AC-6 | spec-evaluation-harness | FR-256 | UR-077] a hidden test named " + JSON.stringify(name) + " does not carry the identifier form and rejects the task", () => {
    // Invalid and boundary: near-miss identifier forms.
    const result = validate(makeTask({ hidden: [name] }));
    assert.strictEqual(result.status, "rejected");
  });
});

test("[AC-6 | spec-evaluation-harness | FR-256 | UR-077] the exported scenario-identifier pattern accepts the spec form and rejects a bare name", () => {
  assert.ok(validator.SCENARIO_ID.test("[AC-2 | spec-foo | FR-045] rejects an empty name"));
  assert.ok(!validator.SCENARIO_ID.test("rejects an empty name"));
});

test("[AC-7 | spec-evaluation-harness | FR-263 | UR-077] a task directory with a prompt and no graders folder is rejected and the rejection names graders", () => {
  const result = validate(makeTask({ graders: false }));
  assert.strictEqual(result.status, "rejected");
  assert.match(problemText(result), /graders/i);
});

test("[AC-7 | spec-evaluation-harness | FR-263 | UR-077] a graders path that is a file, not a folder, is rejected", () => {
  // Type mismatch: a file where a folder belongs.
  const fixture = makeTask({ graders: false });
  put(path.join(fixture.taskDir, "graders"), "not a folder");
  const result = validate(fixture);
  assert.strictEqual(result.status, "rejected");
  assert.match(problemText(result), /graders/i);
});

test("[AC-7 | spec-evaluation-harness | FR-263 | UR-077] a missing task directory reads error, never accepted", () => {
  const result = validator.validateTask(path.join(tmpDir(), "dev", "no-such-case"), { oracleLocation: tmpDir(), suite: "dev", logger: quietLogger() });
  assert.strictEqual(result.status, "error");
});

// ---------------------------------------------------------------------------
// R2: contamination controls
// ---------------------------------------------------------------------------

test("[AC-1 | spec-evaluation-harness | FR-257 | UR-080 | SC-025] a task with provenance, creation date, and valid-against cutoff is accepted", () => {
  const result = validate(makeTask({ meta: { provenance: "in-house", creation_date: "2026-11-01", valid_against_cutoff: "2026-06-30" } }));
  assert.strictEqual(result.status, "accepted", JSON.stringify(result.problems));
});

test("[AC-2 | spec-evaluation-harness | FR-257 | UR-080 | SC-025] a task with no valid-against cutoff is rejected and the rejection names the cutoff", () => {
  const result = validate(makeTask({ meta: { provenance: "in-house", creation_date: "2026-11-01" } }));
  assert.strictEqual(result.status, "rejected");
  assert.match(problemText(result), /cutoff/i);
});

test("[AC-2 | spec-evaluation-harness | FR-257 | UR-080 | SC-025] a task with an empty valid-against cutoff is rejected", () => {
  // Null/empty.
  const result = validate(makeTask({ meta: { provenance: "in-house", creation_date: "2026-11-01", valid_against_cutoff: "" } }));
  assert.strictEqual(result.status, "rejected");
  assert.match(problemText(result), /cutoff/i);
});

test("[AC-2 | spec-evaluation-harness | FR-257 | UR-080 | SC-025] a task with no creation date is rejected and the rejection names the creation date", () => {
  const result = validate(makeTask({ meta: { provenance: "in-house", valid_against_cutoff: "2026-06-30" } }));
  assert.strictEqual(result.status, "rejected");
  assert.match(problemText(result), /creation/i);
});

test("[AC-2 | spec-evaluation-harness | FR-257 | UR-080 | SC-025] a task with no provenance is rejected and the rejection names the provenance", () => {
  const result = validate(makeTask({ meta: { creation_date: "2026-11-01", valid_against_cutoff: "2026-06-30" } }));
  assert.strictEqual(result.status, "rejected");
  assert.match(problemText(result), /provenance/i);
});

test("[AC-2 | spec-evaluation-harness | FR-257 | UR-080 | SC-025] a task with no metadata file is rejected", () => {
  const result = validate(makeTask({ meta: null }));
  assert.strictEqual(result.status, "rejected");
  assert.match(problemText(result), /task\.json|provenance|cutoff/i);
});

["2026/11/01", "11-01-2026", "2026-13-01", "2026-02-30", "yesterday", "20261101"].forEach((date) => {
  test("[AC-2 | spec-evaluation-harness | FR-257 | UR-080 | SC-025] a valid-against cutoff of " + JSON.stringify(date) + " is not a YYYY-MM-DD date and rejects the task", () => {
    // Invalid and boundary: malformed and impossible dates.
    const result = validate(makeTask({ meta: { provenance: "in-house", creation_date: "2026-11-01", valid_against_cutoff: date } }));
    assert.strictEqual(result.status, "rejected");
    assert.match(problemText(result), /cutoff/i);
  });
});

test("[AC-2 | spec-evaluation-harness | FR-257 | UR-080 | SC-025] a valid-against cutoff on a leap day is accepted", () => {
  // Boundary: a real date at the edge of February.
  const result = validate(makeTask({ meta: { provenance: "in-house", creation_date: "2028-02-29", valid_against_cutoff: "2028-02-29" } }));
  assert.strictEqual(result.status, "accepted", JSON.stringify(result.problems));
});

test("[AC-3 | spec-evaluation-harness | FR-258 | UR-080 | SC-025] a task whose provenance reads in-house is accepted", () => {
  const result = validate(makeTask({ meta: { provenance: "in-house", creation_date: "2026-11-01", valid_against_cutoff: "2026-06-30" } }));
  assert.strictEqual(result.status, "accepted", JSON.stringify(result.problems));
});

test("[AC-3 | spec-evaluation-harness | FR-258 | UR-080 | SC-025] a task whose provenance reads private-repository is accepted", () => {
  const result = validate(makeTask({ meta: { provenance: "private-repository", creation_date: "2026-11-01", valid_against_cutoff: "2026-06-30" } }));
  assert.strictEqual(result.status, "accepted", JSON.stringify(result.problems));
});

["SWE-bench", "HumanEval", "public-benchmark-dataset", "In-House", "in house", ""].forEach((provenance) => {
  test("[AC-4 | spec-evaluation-harness | FR-258 | UR-080 | SC-025] a task whose provenance reads " + JSON.stringify(provenance) + " is rejected and the rejection names the provenance", () => {
    // Invalid: a public benchmark dataset, near-miss spellings, and the empty string.
    const result = validate(makeTask({ meta: { provenance, creation_date: "2026-11-01", valid_against_cutoff: "2026-06-30" } }));
    assert.strictEqual(result.status, "rejected");
    assert.match(problemText(result), /provenance/i);
  });
});

test("[AC-4 | spec-evaluation-harness | FR-258 | UR-080 | SC-025] a task whose provenance is not text is rejected", () => {
  // Type mismatch.
  const result = validate(makeTask({ meta: { provenance: 7, creation_date: "2026-11-01", valid_against_cutoff: "2026-06-30" } }));
  assert.strictEqual(result.status, "rejected");
  assert.match(problemText(result), /provenance/i);
});

test("[AC-4 | spec-evaluation-harness | FR-258 | UR-080 | SC-025] PROVENANCE_VALUES lists exactly the two values the spec names", () => {
  assert.deepStrictEqual(validator.PROVENANCE_VALUES.slice().sort(), ["in-house", "private-repository"]);
});

test("[AC-2 | spec-evaluation-harness | FR-257 | UR-080 | SC-025] a metadata file that is not valid JSON rejects the task", () => {
  const result = validate(makeTask({ meta: "{ provenance: SENTINEL-RAW-TEXT " }));
  assert.strictEqual(result.status, "rejected");
  assert.ok(!problemText(result).includes("SENTINEL-RAW-TEXT"), "a rejection echoed the raw file text");
});

test("[AC-2 | spec-evaluation-harness | FR-257 | UR-080 | SC-025] a metadata file that holds a list instead of an object rejects the task", () => {
  // Type mismatch at the top level.
  const result = validate(makeTask({ meta: "[1, 2]" }));
  assert.strictEqual(result.status, "rejected");
});

// ---------------------------------------------------------------------------
// Held-out flag (read by the benchmark entry, FR-280)
// ---------------------------------------------------------------------------

test("[R9 | spec-evaluation-harness | FR-280] a task flagged held_out reads heldOut true and is still accepted", () => {
  const result = validate(makeTask({ meta: Object.assign({ held_out: true }, VALID_META) }));
  assert.strictEqual(result.status, "accepted", JSON.stringify(result.problems));
  assert.strictEqual(result.heldOut, true);
});

test("[R9 | spec-evaluation-harness | FR-280] a held_out flag that is not true or false rejects the task", () => {
  // Type mismatch.
  const result = validate(makeTask({ meta: Object.assign({ held_out: "yes" }, VALID_META) }));
  assert.strictEqual(result.status, "rejected");
  assert.match(problemText(result), /held_out/i);
});

// ---------------------------------------------------------------------------
// Oracle unreachable: an error, never an acceptance or a score (R4 AC-5)
// ---------------------------------------------------------------------------

test("[AC-5 | spec-evaluation-harness | FR-260 | FR-261] a validation against an unreachable private location reads error and names the location", () => {
  const fixture = makeTask();
  const missing = path.join(tmpDir(), "no-such-private-location");
  const result = validator.validateTask(fixture.taskDir, { oracleLocation: missing, suite: "dev", logger: quietLogger() });
  assert.strictEqual(result.status, "error");
  assert.ok(result.error, "the result carries the error");
  assert.ok(JSON.stringify(result.error).includes(missing), "the error names the location");
});

test("[AC-5 | spec-evaluation-harness | FR-260 | FR-261] a validation with no private location configured reads error, never accepted", () => {
  // Null/empty.
  const fixture = makeTask();
  const result = validator.validateTask(fixture.taskDir, { suite: "dev", logger: quietLogger() });
  assert.notStrictEqual(result.status, "accepted");
  assert.strictEqual(result.status, "error");
});
