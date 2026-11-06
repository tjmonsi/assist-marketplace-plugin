// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Contract tests for evidence-backed review gates (harness-governance Tranche 2, Steps 17 and 18): the FR-221 rule as
// stated in plugins/assist-plugin/rules/assist-plugin-rule.md ("Evidence for Gate Approvals (FR-221)"),
// skills/do/references/review-protocol.md ("Evidence for every gate (FR-221)", the Testing and judgement Gate sections),
// skills/do/references/plan-format.md ("Review Gates" and "Gate Record (FR-221)"), and agents/qa.md ("Gate evidence").
//
// Sources: specs/spec-orchestration-review-gates.md (Change Log 2026-11-06: Requirement 14: Clear each gate only on
// recorded evidence, with the fixed gate-to-scanner table; Scenarios Coverage gate with evidence, Sign-off string alone,
// Judgement gate with scanner exit and non-producer verdict, Producer verdict does not clear a judgement gate, No external
// scanner required, Pre-Test gate clears on a non-producer verdict; MODIFIED Requirement 9, Scenarios Coverage reported
// as evidence, qa string without a record) and docs/requirements/FR-NFR-harness-governance.md v1.3 (FR-221, FR-222,
// NFR-026, NFR-027, NFR-031, NFR-035, NFR-036). Task plan: docs/task-plans/task-plan-harness-governance-20261028-0759.md,
// Steps 17, 18, and 20.
//
// Traceability format: [AC-N | spec file | FR/NFR ids | UR/BR ids]. The spec has no SPEC-NNN id, so it is cited by
// file name. AC-N is the position of the Scenario inside Requirement 14 in the Change Log 2026-11-06 of
// spec-orchestration-review-gates.md:
//   AC-1 Coverage gate with evidence, AC-2 Sign-off string alone, AC-3 Judgement gate with scanner exit and non-producer
//   verdict, AC-4 Producer verdict does not clear a judgement gate, AC-5 No external scanner required.
// A test about a Scenario of another Requirement, or about no Scenario, carries the Requirement name instead.
//
// Each documentation test reads a file and asserts a binding phrase (whitespace folded, so a line wrap does not matter).
// The hook-alignment tests call the public classifier of the gate-evidence hook, so the commands the documents tell qa
// and /do to rely on are the commands the hook records.
//
// Known state (deferred Tranche 2 follow-up): the gate-evidence allowlist records only check-fsa-tables.js and
// sync-writing-standard.js as scanners. The FR-217 scanner and the health self-tests are named by the mapping as required
// evidence but are not recorded yet, so those gates cannot auto-clear. The tests for them assert the fail-safe that holds
// today (an unrecorded scanner leaves the gate open) and stay valid when the allowlist is extended.
//
// Run: node --test tests/skills/contracts-gate-evidence.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const lib = require(path.join(PLUGIN, "hooks", "lib", "gate-evidence.js"));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function read(rel) {
  return fs.readFileSync(path.join(PLUGIN, rel), "utf8");
}

function fold(text) {
  return text.replace(/\s+/g, " ");
}

function assertHas(text, phrase, label) {
  assert.ok(fold(text).indexOf(fold(phrase)) !== -1, label + " lacks: " + phrase);
}

function linesOf(text) {
  return text.split("\n");
}

// The text between the first heading line that matches `headingRe` and the next heading of the same or higher level.
function section(text, headingRe) {
  const lines = linesOf(text);
  const start = lines.findIndex((l) => headingRe.test(l));
  assert.ok(start >= 0, "heading not found: " + headingRe);
  const level = /^#+/.exec(lines[start])[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const m = /^(#+) /.exec(lines[i]);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n");
}

// The text from the line that matches `startRe` up to the line that matches `endRe`. Used where a code block inside the
// section holds comment lines that start with "# " and so look like top-level headings.
function between(text, startRe, endRe) {
  const lines = linesOf(text);
  const start = lines.findIndex((l) => startRe.test(l));
  assert.ok(start >= 0, "start heading not found: " + startRe);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (endRe.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n");
}

const GATES = ["OWASP for LLM Clear", "Code Security / OWASP Clear", "Coverage >=70%", "Approved for merge"];

// The gate-to-scanner table: {gate: [scanner cell, plus cell]}.
function mappingRows(text) {
  const rows = {};
  linesOf(text).forEach((line) => {
    const match = /^\| (OWASP for LLM Clear|Code Security \/ OWASP Clear|Coverage >=70%|Approved for merge) \| (.+) \| (.+) \|$/.exec(line);
    if (match) rows[match[1]] = [match[2].trim(), match[3].trim()];
  });
  return rows;
}

const FILES = {
  rule: "rules/assist-plugin-rule.md",
  protocol: "skills/do/references/review-protocol.md",
  planFormat: "skills/do/references/plan-format.md",
  qa: "agents/qa.md",
};

const TEXT = {};
Object.keys(FILES).forEach((key) => {
  TEXT[key] = read(FILES[key]);
});

const RULE_SECTION = section(TEXT.rule, /^## Evidence for Gate Approvals \(FR-221\)$/);
const GATE_RECORD = section(TEXT.planFormat, /^### Gate Record \(FR-221\)$/);

// ---------------------------------------------------------------------------
// The evidence-backed gate rule: a sign-off string never clears a gate
// ---------------------------------------------------------------------------

test("[AC-2 | spec-orchestration-review-gates | FR-221 | UR-063] the rule file says a gate clears only with an evidence reference, and a model sign-off string never clears it", () => {
  assertHas(RULE_SECTION, "`/do` records a gate as cleared only with an evidence reference.", FILES.rule);
  assertHas(RULE_SECTION, "A sign-off string that a model emits, such as `✓ Coverage >=70%`, never clears a gate.", FILES.rule);
});

test("[AC-2 | spec-orchestration-review-gates | FR-221] with no evidence reference the gate stays open and the merge check blocks (all three documents)", () => {
  assertHas(RULE_SECTION, "With no evidence reference the gate stays open and the merge check blocks.", FILES.rule);
  assertHas(TEXT.protocol, "a gate with no evidence reference stays open so the merge check blocks", FILES.protocol);
  assertHas(GATE_RECORD, "a gate with no evidence reference stays open so the merge check blocks", FILES.planFormat);
});

test("[AC-2 | spec-orchestration-review-gates | FR-221] review-protocol.md says a checkmark line or a sign-off string that a model emits never clears a gate", () => {
  assertHas(TEXT.protocol, "a `✓` line or a sign-off string that a model emits never clears a gate", FILES.protocol);
});

test("[AC-2 | spec-orchestration-review-gates | FR-221] plan-format.md says a sign-off string that a model emits never clears a gate", () => {
  assertHas(GATE_RECORD, "A gate is cleared only with an evidence reference; a sign-off string that a model emits never clears it", FILES.planFormat);
});

test("[AC-2 | spec-orchestration-review-gates | FR-221] a model sign-off string, from a reviewer or any other agent, never supplies either piece of judgement evidence", () => {
  assertHas(RULE_SECTION, "A model sign-off string, from a reviewer or any other agent, never supplies either piece.", FILES.rule);
  assertHas(TEXT.protocol, "A model sign-off string never supplies either piece.", FILES.protocol);
});

// ---------------------------------------------------------------------------
// A deterministic gate clears on a recorded gate-evidence exit
// ---------------------------------------------------------------------------

test("[AC-1 | spec-orchestration-review-gates | FR-221 | NFR-026] a deterministic gate clears only on a gate-evidence record in the audit log that holds the command identifier, the exit code, and the measured value", () => {
  assertHas(RULE_SECTION, "It clears only on a `gate-evidence` record in the governance audit log (`.agent/logs/governance/audit.jsonl`) that holds the command identifier, the exit code, and the measured value.", FILES.rule);
  assertHas(RULE_SECTION, "The `gate-evidence` hook writes that record, so the model cannot forge it.", FILES.rule);
});

test("[AC-1 | spec-orchestration-review-gates | FR-221] the hook reads a PostToolUse success as exit 0 and takes the exit status of a PostToolUseFailure from its error field", () => {
  assertHas(RULE_SECTION, "`PostToolUse` (a success event, read as exit 0)", FILES.rule);
  assertHas(RULE_SECTION, "`PostToolUseFailure` (the exit status is the N of the `error` field's leading \"Exit code N\")", FILES.rule);
  assertHas(TEXT.protocol, "The hook reads a `PostToolUse` success event as exit 0 and takes the exit status of a `PostToolUseFailure` event from the \"Exit code N\" that begins its `error` field.", FILES.protocol);
});

test("[AC-2 | spec-orchestration-review-gates | FR-221 | NFR-031] a command off the allowlist, a chained or piped command, or a run with no known exit status leaves no record, so its gate stays open", () => {
  assertHas(RULE_SECTION, "A command off the allowlist, a chained or piped command, or a run with no known exit status leaves no record, so its gate stays open.", FILES.rule);
});

test("[AC-1 | spec-orchestration-review-gates | FR-221 | NFR-031] the record holds the allowlist's fixed identifier, never the command text typed, arguments, output, or a secret", () => {
  assertHas(RULE_SECTION, "never the command text typed, arguments, output, or a secret (NFR-031)", FILES.rule);
});

test("[Requirement 9 | spec-orchestration-review-gates | FR-221 | NFR-024] the Testing Gate clears on the gate-evidence record for the run, not on the qa verdict string", () => {
  const testing = section(TEXT.protocol, /^### Testing Gate/);
  assertHas(testing, "the gate clears on the `gate-evidence` record for the run, not on the qa verdict string", FILES.protocol);
  assertHas(testing, "With no record for the run, or a value below 70, the gate stays open whatever qa wrote.", FILES.protocol);
  assertHas(testing, "`✓ Coverage >=70%`, which `/do` records only on that `gate-evidence` record (command, exit code 0, value >=70) and never on a qa sign-off string.", FILES.protocol);
});

test("[Requirement 9 | spec-orchestration-review-gates | FR-221] the rule file's Testing Coverage Gate says a qa-authored sign-off string never clears it", () => {
  // The Coverage Validation block holds comment lines that start with "# ", so the section is cut by heading text.
  const testing = between(TEXT.rule, /^## Testing Coverage Gate/, /^## Code Review Gate/);
  assertHas(testing, "only on a `gate-evidence` record that holds the command, the exit code, and the value", FILES.rule);
  assertHas(testing, "A qa-authored sign-off string never clears it.", FILES.rule);
});

test("[Requirement 9 | spec-orchestration-review-gates | FR-221] plan-format.md lists the Testing gate as clearing only on the hook's record of the run", () => {
  assertHas(TEXT.planFormat, "The gate clears only on the `gate-evidence` hook's record of the run (command, exit code, value), never on a qa sign-off string", FILES.planFormat);
});

test("[AC-2 | spec-orchestration-review-gates | FR-221] qa quotes the command, exit code, and value, and a verdict approved without a recorded run leaves the gate open", () => {
  assertHas(TEXT.qa, "**Gate evidence (FR-221):** The Coverage and test gates clear on the `gate-evidence` hook's recorded evidence of the run (command, exit code, value), not on a string qa writes.", FILES.qa);
  assertHas(TEXT.qa, "A `verdict: approved` without a recorded run leaves the gate open.", FILES.qa);
});

test("[AC-1 | spec-orchestration-review-gates | FR-221] the gate record has the fields command, exit code, value, and evidence reference, and a reviewer verdict for judgement gates", () => {
  ["**command:**", "**exit code:**", "**value:**", "**evidence reference:**", "**reviewer verdict (judgement gates only):**"].forEach((field) => {
    assert.ok(GATE_RECORD.indexOf(field) !== -1, "plan-format.md lacks the gate record field " + field);
  });
  assertHas(TEXT.protocol, "The gate record fields are `command`, `exit code`, `value`, and `evidence reference`", FILES.protocol);
});

test("[AC-1 | spec-orchestration-review-gates | FR-221 | NFR-031] the evidence reference is the audit-log event with its tool_use_id, or a CI artifact identifier and never its contents", () => {
  assertHas(GATE_RECORD, "the `gate-evidence` event in the governance audit log (`.agent/logs/governance/audit.jsonl`, with its `tool_use_id`), or a CI artifact identifier (never its contents)", FILES.planFormat);
  assertHas(RULE_SECTION, "A CI artifact is an alternative evidence reference; the gate record holds its identifier, not its contents.", FILES.rule);
});

// ---------------------------------------------------------------------------
// Reader-side dedupe: prefer the failure
// ---------------------------------------------------------------------------

test("[AC-2 | spec-orchestration-review-gates | FR-221] review-protocol.md requires the orchestrator to dedupe gate-evidence records that share a tool_use_id and prefer the failure", () => {
  assertHas(TEXT.protocol, "it MUST dedupe the records that share a `tool_use_id` and prefer the failure", FILES.protocol);
  assertHas(TEXT.protocol, "if any record for that `tool_use_id` reports a non-zero exit code, or comes from a `PostToolUseFailure` event, the gate does not clear, whatever an exit-0 sibling says", FILES.protocol);
  assertHas(TEXT.protocol, "Only an unambiguous success (exit 0 and no failure sibling) clears.", FILES.protocol);
});

test("[AC-2 | spec-orchestration-review-gates | FR-221] plan-format.md states the same dedupe rule", () => {
  assertHas(GATE_RECORD, "The orchestrator dedupes the records that share a `tool_use_id` and prefers the failure", FILES.planFormat);
  assertHas(GATE_RECORD, "only an unambiguous success (exit 0, no failure sibling) clears", FILES.planFormat);
});

// ---------------------------------------------------------------------------
// A judgement gate needs a scanner exit and a non-producer reviewer verdict
// ---------------------------------------------------------------------------

test("[AC-3 | spec-orchestration-review-gates | FR-221 | FR-222] a judgement gate clears only on an in-plugin scanner exit code together with a verdict from a reviewer other than the producer, carrying file:line findings", () => {
  assertHas(RULE_SECTION, "It clears only on an in-plugin scanner exit code together with a verdict from a reviewer other than the producer, carrying `file:line` findings.", FILES.rule);
  assertHas(TEXT.protocol, "A judgement gate (OWASP Clear, LLM Security Clear, Approved for merge) clears only on an in-plugin scanner exit code together with a verdict from a reviewer other than the producer, carrying `file:line` findings.", FILES.protocol);
});

test("[AC-3 | spec-orchestration-review-gates | FR-221] neither piece alone is enough: both must exist", () => {
  assertHas(RULE_SECTION, "A judgement gate clears only when both pieces exist, and neither alone is enough:", FILES.rule);
  assertHas(TEXT.protocol, "A judgement gate clears only on both pieces together", FILES.protocol);
});

test("[AC-3 | spec-orchestration-review-gates | FR-221] a scanner run with no record, or a non-zero exit, gives no evidence and leaves the gate open", () => {
  assertHas(RULE_SECTION, "A scanner run with no record, or a non-zero exit, gives no evidence and the gate stays open.", FILES.rule);
  assertHas(GATE_RECORD, "The gate stays open when any scanner run lacks a record or exited non-zero, or when the reviewer verdict is missing, comes from the producer, or is a sign-off string alone.", FILES.planFormat);
});

test("[AC-4 | spec-orchestration-review-gates | FR-221 | FR-222] a verdict from the producer does not count, and a verdict whose findings name no file and line does not count", () => {
  assertHas(RULE_SECTION, "A verdict from the producer does not count, and a returned verdict whose findings name no file and line does not count.", FILES.rule);
  assertHas(TEXT.protocol, "A verdict from the producer does not count, so `/do` dispatches a reviewer other than the producer.", FILES.protocol);
});

test("[AC-4 | spec-orchestration-review-gates | FR-221] the Security gate in plan-format.md is reviewed by a reviewer or code-reviewer, never the producer, and clears on the scanner's recorded exit plus the verdict", () => {
  assertHas(TEXT.planFormat, "reviewed by `reviewer` or `code-reviewer`, never the producer", FILES.planFormat);
  assertHas(TEXT.planFormat, "The gate clears on the FR-217 scanner's recorded exit plus that reviewer's verdict with `file:line` findings, not on a sign-off string", FILES.planFormat);
});

test("[AC-3 | spec-orchestration-review-gates | FR-221] the OWASP for LLM Gate clears on the four scanner exits plus a non-producer verdict, and the reviewer's checkmark line alone never clears it", () => {
  const gate = section(TEXT.protocol, /^### OWASP for LLM Gate$/);
  assertHas(gate, "the gate clears on the recorded exits of `check-fsa-tables.js --check`, `sync-writing-standard.js --check`, the health self-tests, and the FR-217 scanner, plus a verdict from a reviewer that did not produce the artifact, carrying `file:line` findings. The reviewer's `✓` line alone never clears it.", FILES.protocol);
});

test("[AC-3 | spec-orchestration-review-gates | FR-221] Approved for merge clears on the recorded exits of the other gates plus a verdict from a code-reviewer that did not produce the artifact", () => {
  assertHas(TEXT.protocol, "the gate clears on the recorded exits of the other gates plus a `code-reviewer` verdict, from a `code-reviewer` that did not produce the artifact, carrying `file:line` findings. The sign-off string alone never clears it.", FILES.protocol);
});

test("[AC-3 | spec-orchestration-review-gates | FR-221 | FR-222 | NFR-027] the orchestrator writes the gate record as Writer: orchestrator, naming the scanner command, its exit code, the evidence reference, and the reviewer verdict; reviewers stay read-only", () => {
  assertHas(RULE_SECTION, "`/do` writes the gate record with `Writer: orchestrator`, naming the scanner command, its exit code, the evidence reference, and the reviewer verdict", FILES.rule);
  assertHas(RULE_SECTION, "The reviewers (`reviewer`, `code-reviewer`) stay read-only (`tools: [Read, Grep, Glob, LSP]`)", FILES.rule);
  assertHas(TEXT.protocol, "Reviewers stay read-only (`tools: [Read, Grep, Glob, LSP]`)", FILES.protocol);
});

// ---------------------------------------------------------------------------
// No external scanner required
// ---------------------------------------------------------------------------

test("[AC-5 | spec-orchestration-review-gates | FR-221] no gate depends on an external scanner being installed; semgrep and CodeQL are optional extra evidence (all three documents)", () => {
  assertHas(RULE_SECTION, "so no gate depends on an external scanner being installed", FILES.rule);
  assertHas(RULE_SECTION, "an external scanner (semgrep, CodeQL) is optional extra evidence", FILES.rule);
  assertHas(TEXT.protocol, "no gate needs an external scanner installed", FILES.protocol);
  assertHas(TEXT.protocol, "An external scanner (semgrep, CodeQL) is optional extra evidence and a gate never depends on one.", FILES.protocol);
  assertHas(GATE_RECORD, "No gate needs an external scanner installed.", FILES.planFormat);
});

// ---------------------------------------------------------------------------
// The fixed gate-to-scanner mapping
// ---------------------------------------------------------------------------

[
  ["the rule file", "rule"],
  ["review-protocol.md", "protocol"],
].forEach((row) => {
  const key = row[1];

  test("[AC-3 | spec-orchestration-review-gates | FR-221] " + row[0] + " holds the fixed gate-to-scanner table with exactly the four FR-221 gates", () => {
    const rows = mappingRows(TEXT[key]);
    assert.deepStrictEqual(Object.keys(rows).sort(), GATES.slice().sort());
  });

  test("[AC-3 | spec-orchestration-review-gates | FR-221] " + row[0] + " maps OWASP for LLM Clear to check-fsa-tables.js, sync-writing-standard.js, the health self-tests, and the FR-217 scanner, plus a non-producer verdict", () => {
    const cells = mappingRows(TEXT[key])["OWASP for LLM Clear"];
    ["`check-fsa-tables.js`", "`sync-writing-standard.js`", "the health self-tests", "FR-217 pattern and secret scanner"].forEach((part) => {
      assert.ok(cells[0].indexOf(part) !== -1, "scanner cell lacks " + part + ": " + cells[0]);
    });
    assert.ok(/non-producer reviewer verdict/.test(cells[1]) && /file:line/.test(cells[1]), cells[1]);
  });

  test("[AC-3 | spec-orchestration-review-gates | FR-221] " + row[0] + " maps Code Security / OWASP Clear to the FR-217 scanner, plus a non-producer verdict", () => {
    const cells = mappingRows(TEXT[key])["Code Security / OWASP Clear"];
    assert.ok(/FR-217 pattern and secret scanner/.test(cells[0]), cells[0]);
    assert.ok(/non-producer reviewer verdict/.test(cells[1]) && /file:line/.test(cells[1]), cells[1]);
  });

  test("[AC-1 | spec-orchestration-review-gates | FR-221] " + row[0] + " maps Coverage >=70% to the test runner's coverage exit (the gate-evidence record), plus the parsed coverage value", () => {
    const cells = mappingRows(TEXT[key])["Coverage >=70%"];
    assert.ok(/coverage exit/.test(cells[0]) && /`gate-evidence` record/.test(cells[0]), cells[0]);
    assert.ok(/parsed coverage value/.test(cells[1]), cells[1]);
  });

  test("[AC-3 | spec-orchestration-review-gates | FR-221] " + row[0] + " maps Approved for merge to the aggregate of those exits, plus a verdict from a code-reviewer other than the producer", () => {
    const cells = mappingRows(TEXT[key])["Approved for merge"];
    assert.ok(/aggregate of those exits/.test(cells[0]), cells[0]);
    assert.ok(/`code-reviewer` other than the producer/.test(cells[1]), cells[1]);
  });

  test("[Requirement 14 | spec-orchestration-review-gates | FR-221] " + row[0] + " lists no Pre-Test row: that gate clears on a non-producer verdict alone", () => {
    assert.ok(!/^\| Pre-Test/m.test(TEXT[key]));
  });
});

test("[AC-3 | spec-orchestration-review-gates | FR-221] the rule file and review-protocol.md hold the same mapping, cell for cell", () => {
  const fromRule = mappingRows(TEXT.rule);
  const fromProtocol = mappingRows(TEXT.protocol);
  GATES.forEach((gate) => {
    assert.deepStrictEqual(fromProtocol[gate], fromRule[gate], gate);
  });
});

test("[AC-3 | spec-orchestration-review-gates | FR-221] plan-format.md states the same mapping in words", () => {
  assertHas(
    GATE_RECORD,
    "The mapping is fixed: OWASP for LLM Clear rests on `check-fsa-tables.js`, `sync-writing-standard.js`, and the health self-tests, with the FR-217 pattern and secret scanner; Code Security / OWASP Clear on the FR-217 scanner; Coverage >=70% on the test runner's coverage exit; Approved for merge on the aggregate of those exits plus a `code-reviewer` verdict.",
    FILES.planFormat
  );
});

// ---------------------------------------------------------------------------
// The documents and the hook agree on which commands are recorded
// ---------------------------------------------------------------------------

test("[AC-1 | spec-orchestration-review-gates | FR-221 | NFR-031] qa runs each test and coverage command as one plain command, and the hook records exactly those", () => {
  assertHas(TEXT.qa, "Run each test and coverage command as one plain command (no pipe, chain, or quoted argument) so the hook records it", FILES.qa);
  ["npm test", "npm run test:coverage", "node --test"].forEach((command) => {
    const entry = lib.classify(command);
    assert.ok(entry, "the hook records the plain command: " + command);
    assert.strictEqual(entry.kind, "test");
  });
  ["npm test | tee out.log", "npm test && echo done", "npm test -- --grep 'a b'", "npm test > out.txt", "npm test $(id)"].forEach((command) => {
    assert.ok(!lib.classify(command), "the hook records no evidence for: " + command);
  });
});

test("[AC-3 | spec-orchestration-review-gates | FR-221 | NFR-035] the two table-sync scanners the mapping names are recordable as scanner evidence", () => {
  [
    "node plugins/assist-plugin/scripts/check-fsa-tables.js --check",
    "node plugins/assist-plugin/scripts/sync-writing-standard.js --check",
  ].forEach((command) => {
    const entry = lib.classify(command);
    assert.ok(entry, "the hook records: " + command);
    assert.strictEqual(entry.kind, lib.KIND_SCANNER);
  });
});

test("[AC-3 | spec-orchestration-review-gates | FR-221 | FR-217] the FR-217 secret scanner is named as required evidence, and an unrecorded scanner run leaves the gate open (fail-safe until the allowlist is extended)", () => {
  // Deferred Tranche 2 follow-up: the allowlist records only the two table-sync scanners. The mapping still names the
  // FR-217 scanner for Code Security / OWASP Clear and OWASP for LLM Clear, and a scanner run with no record gives no
  // evidence, so those gates cannot auto-clear yet. This test holds both before and after the allowlist is extended.
  const rows = mappingRows(TEXT.rule);
  assert.ok(/FR-217 pattern and secret scanner/.test(rows["Code Security / OWASP Clear"][0]), "the mapping names the FR-217 scanner for Code Security / OWASP Clear");
  assert.ok(/FR-217 pattern and secret scanner/.test(rows["OWASP for LLM Clear"][0]), "the mapping names the FR-217 scanner for OWASP for LLM Clear");
  assertHas(RULE_SECTION, "A scanner run with no record, or a non-zero exit, gives no evidence and the gate stays open.", FILES.rule);
  const entry = lib.classify("node plugins/assist-plugin/scripts/scan-staged-secrets.js");
  assert.ok(entry === null || entry === undefined || entry.kind === lib.KIND_SCANNER, "an unrecorded command yields no entry; a recorded one is scanner evidence");
});

test("[AC-3 | spec-orchestration-review-gates | FR-221 | NFR-035] the health self-tests are named as required evidence, and an unrecorded run leaves the gate open (fail-safe until the allowlist is extended)", () => {
  const rows = mappingRows(TEXT.rule);
  assert.ok(/the health self-tests/.test(rows["OWASP for LLM Clear"][0]), "the mapping names the health self-tests for OWASP for LLM Clear");
  assertHas(RULE_SECTION, "A scanner run with no record, or a non-zero exit, gives no evidence and the gate stays open.", FILES.rule);
  assertHas(GATE_RECORD, "The gate stays open when any scanner run lacks a record or exited non-zero", FILES.planFormat);
  const entry = lib.classify("node plugins/assist-plugin/hooks/health-check.js");
  assert.ok(entry === null || entry === undefined || entry.kind === lib.KIND_SCANNER, "an unrecorded command yields no entry; a recorded one is scanner evidence");
});

// ---------------------------------------------------------------------------
// The Pre-Test gate and other gates
// ---------------------------------------------------------------------------

test("[Requirement 14 | spec-orchestration-review-gates | FR-221 | FR-222] every gate Approval line in review-protocol.md says it is recorded on evidence, never a producer's string", () => {
  const approvals = linesOf(TEXT.protocol).filter((l) => /^\*\*Approval:\*\*/.test(l) && l.indexOf("which `/do` records") !== -1);
  assert.ok(approvals.length >= 4, "OWASP, LLM Security, Coverage, and Approved for merge: " + approvals.length);
  approvals.forEach((line) => {
    assert.ok(/only on that|only on that evidence|evidence/.test(line), line.slice(0, 200));
  });
});
