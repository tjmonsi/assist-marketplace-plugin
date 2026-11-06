// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Contract tests for the sole writer of approval status (harness-governance Tranche 2, Step 16): the FR-222 rule as
// stated in plugins/assist-plugin/rules/assist-plugin-rule.md ("Approval Status Writer (FR-222)"),
// skills/do/references/plan-format.md (the Writer field and the Approved line), skills/do/references/review-protocol.md
// ("Sole writer of approval status (FR-222)" and "Approval Tracking"), agents/reviewer.md, agents/code-reviewer.md, and
// skills/do/SKILL.md (the never-list), and the write bar that enforces it.
//
// Sources: specs/spec-orchestration.md (Change Log 2026-11-06: MODIFIED Requirement: Plan and decision records flow only
// through /do: Scenario Orchestrator records the verdict, Scenario Producer self-approval blocked),
// specs/spec-orchestration-review-gates.md (Change Log 2026-11-06, Requirement 14: the gate record marks
// `Writer: orchestrator`; reviewers stay read-only), specs/spec-hooks-fsa-write-bar.md (Change Log 2026-11-06), and
// docs/requirements/FR-NFR-harness-governance.md v1.3 (FR-222, FR-221, FR-223, UR-064, NFR-027, NFR-036). Task plan:
// docs/task-plans/task-plan-harness-governance-20261028-0759.md, Steps 16 and 20.
//
// Traceability format: [AC-N | spec file | FR/NFR ids | UR/BR ids]. The spec has no SPEC-NNN id, so it is cited by
// file name. AC-N is the position of the Scenario inside Requirement: Plan and decision records flow only through /do
// in the Change Log 2026-11-06 of spec-orchestration.md: AC-1 Orchestrator records the verdict, AC-2 Producer
// self-approval blocked.
//
// Each documentation test reads a file and asserts a binding phrase (whitespace folded, so a line wrap does not matter).
// The enforcement tests call the write bar the documents name, so the stated rule and the enforced rule agree.
//
// Run: node --test tests/skills/contracts-approval-writer.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const PLUGIN = fx.PLUGIN;
const bar = require(path.join(PLUGIN, "hooks", "impl", "fsa-write-bar.js"));

after(() => {
  fx.cleanup();
});

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

function assertLacks(text, phrase, label) {
  assert.ok(fold(text).indexOf(fold(phrase)) === -1, label + " still holds: " + phrase);
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

// The value of the frontmatter `tools:` line as a list of tool names.
function frontmatterTools(text) {
  const match = /^tools:\s*\[(.*)\]\s*$/m.exec(text);
  assert.ok(match, "a tools line in the frontmatter");
  return match[1].split(",").map((name) => name.trim()).filter(Boolean);
}

const FILES = {
  rule: "rules/assist-plugin-rule.md",
  planFormat: "skills/do/references/plan-format.md",
  protocol: "skills/do/references/review-protocol.md",
  reviewer: "agents/reviewer.md",
  codeReviewer: "agents/code-reviewer.md",
  doSkill: "skills/do/SKILL.md",
};

const TEXT = {};
Object.keys(FILES).forEach((key) => {
  TEXT[key] = read(FILES[key]);
});

// ---------------------------------------------------------------------------
// rules/assist-plugin-rule.md
// ---------------------------------------------------------------------------

const RULE_SECTION = section(TEXT.rule, /^## Approval Status Writer \(FR-222\)$/);

test("[AC-1 | spec-orchestration | FR-222 | UR-064] the rule file states that a verdict or approval status is written only by the orchestrator or a hook, never by the producer", () => {
  assertHas(RULE_SECTION, "A review verdict or approval status is written only by the orchestrator (`/do`) or by a hook, never by the agent that produced the artifact under review.", FILES.rule);
});

test("[AC-1 | spec-orchestration | FR-222] the rule file says /do records each verdict and approval line in the plan file and marks the record Writer: orchestrator", () => {
  assertHas(RULE_SECTION, "`/do` records each verdict and approval line in the plan file and marks the record `Writer: orchestrator`", FILES.rule);
});

test("[AC-1 | spec-orchestration | FR-222 | FR-242] a hook that records an approval of its own marks it Writer: hook", () => {
  assertHas(RULE_SECTION, "A hook that records an approval of its own, such as the confirmation store, marks it `Writer: hook`.", FILES.rule);
});

test("[AC-1 | spec-orchestration | FR-222 | NFR-027] a reviewer reports its verdict in its terminal block and /do reads it and writes the record", () => {
  assertHas(RULE_SECTION, "A reviewer reports its verdict in its terminal block, and `/do` reads it and writes the record.", FILES.rule);
});

test("[AC-2 | spec-orchestration | FR-222 | FR-223 | FR-245] the rule file ties the stated rule to its enforcement: the protected glob for write tools and the Shell Write Path for Bash", () => {
  assertHas(RULE_SECTION, "A producer's write to `.agent/main-plan/**` is denied by the protected glob under [Write guard lists](#write-guard-lists), and a shell write by [Shell Write Path](#shell-write-path)", FILES.rule);
  assert.ok(/^## Shell Write Path|^### Shell Write Path/m.test(TEXT.rule), "the Shell Write Path section the rule points to exists");
  assert.ok(/^## Write guard lists|^### Write guard lists/m.test(TEXT.rule), "the Write guard lists section the rule points to exists");
});

test("[AC-1 | spec-orchestration | FR-222] every Approval line in the rule file that /do records names Writer: orchestrator", () => {
  const approvals = linesOf(TEXT.rule).filter((l) => /^\*\*Approval:\*\* `\/do` records/.test(l));
  assert.ok(approvals.length >= 4, "OWASP, LLM Security, Coverage, and Approved for merge: " + approvals.length);
  approvals.forEach((line) => {
    assert.ok(line.indexOf("`Writer: orchestrator`") !== -1, "an Approval line without the writer: " + line.slice(0, 160));
  });
});

test("[AC-1 | spec-orchestration | FR-222] the rule file says every Approval line names a status /do records", () => {
  assertHas(RULE_SECTION, "Every **Approval:** line below names a status `/do` records.", FILES.rule);
});

// ---------------------------------------------------------------------------
// skills/do/references/plan-format.md
// ---------------------------------------------------------------------------

test("[AC-1 | spec-orchestration | FR-222] the plan template records the Approved line with Writer: orchestrator", () => {
  assert.ok(/^- Approved: YYYY-MM-DD HH:mm Writer: orchestrator$/m.test(TEXT.planFormat), "the Approved line in the plan template");
});

test("[AC-1 | spec-orchestration | FR-222] the step template carries a Writer: orchestrator field", () => {
  assert.ok(/^\*\*Writer:\*\* orchestrator\s*$/m.test(TEXT.planFormat), "a **Writer:** orchestrator field in the step template");
});

test("[AC-1 | spec-orchestration | FR-222] plan-format.md defines the Writer field: always orchestrator, never a producer, and Writer: hook for a hook's own record", () => {
  assertHas(TEXT.planFormat, "**Writer:** Who recorded the Review outcome and the gate record, always `orchestrator`.", FILES.planFormat);
  assertHas(TEXT.planFormat, "A producer agent never writes the status of the artifact it produced, so no record names a producer as its writer.", FILES.planFormat);
  assertHas(TEXT.planFormat, "A hook may write an approval record of its own, such as the confirmation store, and marks it `Writer: hook`.", FILES.planFormat);
});

test("[AC-2 | spec-orchestration | FR-222 | FR-112] plan-format.md says the write bar already denies a subagent's write to the plan files", () => {
  assertHas(TEXT.planFormat, "The write bar already denies a subagent's write to `.agent/main-plan/**`", FILES.planFormat);
});

test("[AC-1 | spec-orchestration | FR-222] the Approved bullet under User Decisions is written at Approve by the orchestrator", () => {
  assertHas(TEXT.planFormat, "The first bullet is \"Approved: YYYY-MM-DD HH:mm\", written at Approve with the marker `Writer: orchestrator`", FILES.planFormat);
});

// ---------------------------------------------------------------------------
// skills/do/references/review-protocol.md
// ---------------------------------------------------------------------------

test("[AC-1 | spec-orchestration | FR-222 | UR-064] review-protocol.md names the orchestrator or a hook as the sole writer of approval status", () => {
  assertHas(TEXT.protocol, "**Sole writer of approval status (FR-222).** A review verdict or approval status is recorded only by the orchestrator (`/do`) or by a hook.", FILES.protocol);
  assertHas(TEXT.protocol, "The agent that produced the artifact under review never writes that artifact's status", FILES.protocol);
  assertHas(TEXT.protocol, "a reviewer's `✓` line is a finding that `/do` reads from the terminal block and then records", FILES.protocol);
});

test("[AC-2 | spec-orchestration | FR-222 | FR-223] review-protocol.md states that the write bar and the Shell Write Path already deny a producer's write to the plan files", () => {
  assertHas(TEXT.protocol, "A producer's write to `.agent/main-plan/**` is already denied by the `fsa-write-bar` protected glob and the Shell Write Path", FILES.protocol);
});

test("[AC-1 | spec-orchestration | FR-222] the Approval Tracking examples mark each review outcome Writer: orchestrator", () => {
  const tracking = section(TEXT.protocol, /^## Approval Tracking/);
  const writers = linesOf(tracking).filter((l) => /^\*\*Writer:\*\* orchestrator\s*$/.test(l));
  assert.ok(writers.length >= 3, "at least three examples carry the Writer field: " + writers.length);
});

test("[AC-1 | spec-orchestration | FR-222] review-protocol.md says a record that names a producer as its writer is not an approval", () => {
  assertHas(TEXT.protocol, "The orchestrator (or a hook) writes the review outcome and every approval line, and marks the record `Writer: orchestrator`.", FILES.protocol);
  assertHas(TEXT.protocol, "A record that names a producer as its writer is not an approval; `/do` writes the record itself from the reviewer's terminal block.", FILES.protocol);
});

test("[AC-1 | spec-orchestration | FR-222] the gate Approval lines in review-protocol.md name the status /do records, and the judgement gates name Writer: orchestrator", () => {
  const approvals = linesOf(TEXT.protocol).filter((l) => /^\*\*Approval:\*\*/.test(l) && l.indexOf("which `/do` records") !== -1);
  assert.ok(approvals.length >= 4, "OWASP, LLM Security, Coverage, and Approved for merge: " + approvals.length);
  const withWriter = approvals.filter((l) => l.indexOf("`Writer: orchestrator`") !== -1);
  assert.ok(withWriter.length >= 3, "OWASP, LLM Security, and Approved for merge name the writer: " + withWriter.length);
});

// ---------------------------------------------------------------------------
// skills/do/SKILL.md
// ---------------------------------------------------------------------------

test("[AC-1 | spec-orchestration | FR-222 | UR-064] the /do never-list forbids a producer writing the verdict or approval status of its own artifact", () => {
  assertHas(TEXT.doSkill, "Never let a producer agent write the review verdict or approval status of its own artifact. /do records it with `Writer: orchestrator`.", FILES.doSkill);
});

// ---------------------------------------------------------------------------
// agents/reviewer.md and agents/code-reviewer.md: read-only
// ---------------------------------------------------------------------------

[
  ["reviewer", "reviewer"],
  ["codeReviewer", "code-reviewer"],
].forEach((row) => {
  const key = row[0];
  const name = row[1];

  test("[AC-1 | spec-orchestration | FR-222 | NFR-027] " + name + " holds only read tools: Read, Grep, Glob, LSP", () => {
    assert.deepStrictEqual(frontmatterTools(TEXT[key]), ["Read", "Grep", "Glob", "LSP"]);
  });

  test("[AC-1 | spec-orchestration | FR-222 | NFR-027] " + name + " has no write access and no shell", () => {
    ["Write", "Edit", "MultiEdit", "NotebookEdit", "Bash", "PowerShell"].forEach((tool) => {
      assert.ok(frontmatterTools(TEXT[key]).indexOf(tool) === -1, name + " holds " + tool);
    });
    assertHas(TEXT[key], "**Tools:** Read, Grep, Glob, LSP (no write access, no shell)", FILES[key]);
  });

  test("[AC-1 | spec-orchestration | FR-222 | FR-221] " + name + " reports a verdict as evidence and never writes a gate status or an approval line", () => {
    assertHas(TEXT[key], "**Read-only evidence (FR-221).** The agent has no write or shell tool.", FILES[key]);
    assertHas(TEXT[key], "the orchestrator (`/do`) reads them and writes the gate record as `Writer: orchestrator`", FILES[key]);
    assertHas(TEXT[key], "The agent never writes a gate status or an approval line itself.", FILES[key]);
  });

  test("[AC-1 | spec-orchestration | FR-222 | FR-221] " + name + " does not review an artifact it produced, and a producer's verdict does not count", () => {
    assertHas(TEXT[key], "The agent does not review an artifact it produced: `/do` dispatches a reviewer other than the producer, and a verdict from the producer does not count toward a gate.", FILES[key]);
  });
});

// ---------------------------------------------------------------------------
// Enforcement: the stated rule is the enforced rule
// ---------------------------------------------------------------------------

const R = "/assist-selftest/project";
const PLAN_FILE = R + "/.agent/main-plan/plan-x.md";

function sub(agentType) {
  return { agent_id: "agent-" + String(agentType).replace(/[^a-z]/g, "") + "-1", agent_type: agentType };
}

function judge(tool, toolInput, caller) {
  const input = Object.assign({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: toolInput, cwd: R }, caller || {});
  return bar.evaluate(input, { roots: [R], findGitRoot: () => R });
}

function denied(result) {
  return result !== null && result !== undefined && result.deny === true;
}

const PRODUCERS = ["assist-plugin:developer", "assist-plugin:developer-tester", "assist-plugin:worker", "assist-plugin:qa", "assist-plugin:solutions-architect", "general-purpose"];

PRODUCERS.forEach((agentType) => {
  ["Write", "Edit", "MultiEdit"].forEach((tool) => {
    test("[AC-2 | spec-orchestration | FR-222 | FR-112 | UR-064] producer self-approval is blocked: " + agentType + " cannot " + tool + " the plan file", () => {
      const result = judge(tool, { file_path: PLAN_FILE, content: "- Approved: 2026-11-06 10:00 Writer: developer" }, sub(agentType));
      assert.ok(denied(result), JSON.stringify(result));
      assert.ok(String(result.reason).indexOf("**/.agent/main-plan/**") !== -1, "the reason names the rule: " + result.reason);
    });
  });
});

test("[AC-2 | spec-orchestration | FR-222 | FR-223] producer self-approval is blocked on the shell route too: a producer's Bash append to the plan file is denied", () => {
  PRODUCERS.forEach((agentType) => {
    const result = judge("Bash", { command: 'echo "- Approved: 2026-11-06 10:00" >> .agent/main-plan/plan-x.md' }, sub(agentType));
    assert.ok(denied(result), agentType + ": " + JSON.stringify(result));
  });
});

test("[AC-1 | spec-orchestration | FR-222] the orchestrator can record the verdict: the main session may write the plan file", () => {
  ["Write", "Edit", "MultiEdit"].forEach((tool) => {
    const result = judge(tool, { file_path: PLAN_FILE, content: "- Approved: 2026-11-06 10:00 Writer: orchestrator" }, {});
    assert.ok(!denied(result), tool + ": " + JSON.stringify(result));
  });
});

test("[AC-1 | spec-orchestration | FR-222] reviewers have no write tool to try: a reviewer-named subagent is denied the plan file all the same", () => {
  // The reviewer agents hold no write tool (asserted above); the bar still denies the path to any subagent.
  ["assist-plugin:reviewer", "assist-plugin:code-reviewer"].forEach((agentType) => {
    assert.ok(denied(judge("Write", { file_path: PLAN_FILE, content: "x" }, sub(agentType))), agentType);
  });
});

test("[AC-2 | spec-orchestration | FR-222 | NFR-026] the denied self-approval is logged to the governance audit log (the deny record needs the Step 12 logging)", () => {
  const root = fx.tempRoot("approval-writer-");
  const doc = {
    hook_event_name: "PreToolUse",
    session_id: "sess-1",
    tool_name: "Write",
    tool_input: { file_path: path.join(root, ".agent", "main-plan", "plan-x.md"), content: "- Approved: x" },
    cwd: root,
    agent_id: "agent-dev-1",
    agent_type: "assist-plugin:developer",
  };
  const res = fx.runHook("fsa-write-bar", doc);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(JSON.parse(res.stdout).hookSpecificOutput.permissionDecision, "deny");
  const denies = fx.readRecords(root).filter((r) => r.decision === "deny");
  assert.strictEqual(denies.length, 1, JSON.stringify(fx.readRecords(root)));
  assert.strictEqual(denies[0].agent_id, "agent-dev-1");
});
