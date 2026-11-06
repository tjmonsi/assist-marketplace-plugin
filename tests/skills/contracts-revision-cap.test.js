// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Contract tests for the revision-loop cap and the human escalation (harness-governance Tranche 1, Step 8):
// plugins/assist-plugin/skills/do/references/review-protocol.md ("Exhausting a gate" and every gate's exit
// condition), plugins/assist-plugin/rules/assist-plugin-rule.md, plugins/assist-plugin/skills/do/SKILL.md
// (Loops table, Review gates), plugins/assist-plugin/agents/code-reviewer.md, and the do references that
// repeat the cap (fix-phase-rules.md, planning-review-agents.md, reviewer-adversarial-reflection.md,
// agent-registry.md).
//
// Sources: docs/requirements/FR-NFR-harness-governance.md, section 2.5 (FR-218: Approval inside the cap, Cap
// reached): one cap of 10 iterations with two consecutive LGTMs as the normal pass; at the cap no further
// developer or reviewer round, the unresolved findings go to the user with the choices continue, waive, or
// abort; a waive is recorded in the plan file by the orchestrator. At the cap FR-218 wins over the older "one
// binding code-reviewer pass at the bound" of "Exhausting a gate". Task plan:
// docs/task-plans/task-plan-harness-governance-20261028-0759.md, Steps 8 and 9.
//
// Traceability format: [FR-ids | AC section | Scenario title]. The requirement document uses numbered
// acceptance sections and carries no SPEC-NNN id for this feature, so none is cited.
//
// Each test reads a documented file and asserts a binding string (a cap, a choice, a table row, a stated
// rule). A negative test confirms that the replaced rule is gone. The Report Quality Gate keeps its own loop
// of 3 iterations (review-md and the producing agent hold it) and the relay counts in /do SKILL.md are other
// loops, so the "no second cap" test leaves both out.
//
// Run: node --test tests/skills/contracts-revision-cap.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");

function read(rel) {
  return fs.readFileSync(path.join(PLUGIN, rel), "utf8");
}

function linesOf(text) {
  return text.split("\n");
}

// The text between the first heading line that matches `headingRe` and the next heading of the same or higher
// level.
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

const FILES = {
  protocol: "skills/do/references/review-protocol.md",
  rule: "rules/assist-plugin-rule.md",
  doSkill: "skills/do/SKILL.md",
  codeReviewer: "agents/code-reviewer.md",
  fixPhase: "skills/do/references/fix-phase-rules.md",
  planning: "skills/do/references/planning-review-agents.md",
  reflection: "skills/do/references/reviewer-adversarial-reflection.md",
  registry: "skills/do/references/agent-registry.md",
};

const TEXT = {};
Object.keys(FILES).forEach((k) => {
  TEXT[k] = read(FILES[k]);
});

const EXHAUSTING = section(TEXT.protocol, /^### Exhausting a gate$/);

// ---------------------------------------------------------------------------
// FR-218: one cap of 10, two consecutive LGTMs as the normal pass
// ---------------------------------------------------------------------------

test("[FR-218 | 2.5 | Approval inside the cap] 'Exhausting a gate' declares one cap of 10 iterations with two consecutive LGTMs as the normal pass", () => {
  assert.ok(/one cap of 10 iterations/.test(EXHAUSTING), EXHAUSTING);
  assert.ok(/two consecutive LGTMs are the normal pass/.test(EXHAUSTING), EXHAUSTING);
  assert.ok(/Review passes and fix passes count toward the same cap/.test(EXHAUSTING), EXHAUSTING);
});

test("[FR-218 | 2.5 | Approval inside the cap] the gate table gives every gate row an exit by two consecutive approvals or an escalation at 10 iterations", () => {
  const rows = linesOf(TEXT.protocol).filter((l) => /^\| (Code \(source|Planning documents|Any LLM-surface file)/.test(l));
  assert.strictEqual(rows.length, 3, "code, planning, and LLM-surface rows: " + rows.join("\n"));
  rows.forEach((row) => {
    assert.ok(/2 consecutive (LGTMs|`approved`)/.test(row), "two consecutive approvals: " + row);
    assert.ok(/escalation to the user at 10 iterations/.test(row), "escalation at 10: " + row);
  });
});

test("[FR-218 | 2.5 | Approval inside the cap] the review-protocol overview and the rule file both state the one cap of 10", () => {
  assert.ok(/Every code, planning, and OWASP for LLM gate has one cap of 10 iterations, and two consecutive LGTMs are the normal pass/.test(TEXT.protocol));
  assert.ok(/Count iterations against the one cap of 10/.test(TEXT.rule));
  assert.ok(/Exit when: 2 consecutive LGTMs from reviewer OR the cap of 10 iterations/.test(TEXT.rule));
  assert.ok(/Exit when: 2 consecutive LGTMs from code-reviewer OR the cap of 10 iterations/.test(TEXT.rule));
});

test("[FR-218 | 2.5 | Approval inside the cap] the rule file lists two exit conditions for the planning loop: two consecutive LGTMs, or the cap", () => {
  assert.ok(/Exit condition #1: \*\*2 consecutive LGTMs\*\* from reviewer/.test(TEXT.rule));
  assert.ok(/Exit condition #2: \*\*10 iterations reached\*\*/.test(TEXT.rule));
});

test("[FR-218 | 2.5 | Approval inside the cap] approval at iteration 3 with two consecutive LGTMs is the documented normal exit (no escalation)", () => {
  assert.ok(/Tracked: cap of 10 iterations; exited at 3 \(2 consecutive LGTMs\)/.test(TEXT.protocol));
  assert.ok(/Final: ✓ Approved \(2 consecutive LGTMs\)/.test(TEXT.rule));
});

test("[FR-218 | 2.5 | Approval inside the cap] no revision-loop document names a second iteration cap (3, 5, 15, or 20 iterations)", () => {
  const withoutReportGate = TEXT.protocol.replace(section(TEXT.protocol, /^### Report Quality Gate/), "");
  const scanned = {
    protocol: withoutReportGate,
    rule: TEXT.rule,
    codeReviewer: TEXT.codeReviewer,
    fixPhase: TEXT.fixPhase,
    planning: TEXT.planning,
    reflection: TEXT.reflection,
    registry: TEXT.registry,
  };
  Object.keys(scanned).forEach((k) => {
    const found = scanned[k].match(/\b(3|5|15|20) (review )?iterations\b/g);
    assert.strictEqual(found, null, FILES[k] + " names another cap: " + found);
    assert.ok(!/\b(max|maximum|cap)( of)? (3|5|15|20)\b/i.test(scanned[k]), FILES[k] + " names another maximum");
  });
});

// ---------------------------------------------------------------------------
// FR-218: at the cap, escalate to the user
// ---------------------------------------------------------------------------

test("[FR-218 | 2.5 | Cap reached] at the cap /do runs no further developer or reviewer round, dispatches no code-reviewer pass, and never rewrites the artifact", () => {
  assert.ok(/A gate that reaches the cap without approval ends the loop/.test(EXHAUSTING), EXHAUSTING);
  assert.ok(/`\/do` runs no further developer or reviewer round/.test(EXHAUSTING), EXHAUSTING);
  assert.ok(/dispatches no `code-reviewer` pass/.test(EXHAUSTING), EXHAUSTING);
  assert.ok(/never rewrites the artifact itself/.test(EXHAUSTING), EXHAUSTING);
});

test("[FR-218 | 2.5 | Cap reached] the user receives the unresolved findings with three choices: continue, waive, or abort", () => {
  assert.ok(/escalates to the user, presenting the unresolved findings with three choices/.test(EXHAUSTING), EXHAUSTING);
  const rows = linesOf(EXHAUSTING).filter((l) => /^\| `(continue|waive|abort)` \|/.test(l));
  assert.deepStrictEqual(
    rows.map((r) => /^\| `(\w+)` \|/.exec(r)[1]),
    ["continue", "waive", "abort"]
  );
});

test("[FR-218 | 2.5 | Cap reached] continue resumes with more rounds, waive completes the step with the waiver recorded, abort fails the step", () => {
  const byChoice = {};
  linesOf(EXHAUSTING).forEach((l) => {
    const m = /^\| `(continue|waive|abort)` \|/.exec(l);
    if (m) byChoice[m[1]] = l;
  });
  assert.ok(/The user authorizes more rounds/.test(byChoice["continue"]), byChoice["continue"]);
  assert.ok(/escalates again each time it reaches the cap/.test(byChoice["continue"]), byChoice["continue"]);
  assert.ok(/The step is `completed`/.test(byChoice.waive), byChoice.waive);
  assert.ok(/The step is `failed`/.test(byChoice.abort), byChoice.abort);
});

test("[FR-218 | 2.5 | Cap reached] a waive is recorded in the plan file by the orchestrator under User Decisions, and only the user's answer picks a choice", () => {
  const waive = linesOf(EXHAUSTING).find((l) => /^\| `waive` \|/.test(l));
  assert.ok(/Gate waived: <gate>, step <n>, YYYY-MM-DD HH:mm/.test(waive), waive);
  assert.ok(/`## User Decisions`/.test(waive), waive);
  assert.ok(/\.agent\/main-plan\/\*\*/.test(waive) && /written by the orchestrator only/.test(waive), waive);
  assert.ok(/Only the user's answer picks a choice/.test(EXHAUSTING), EXHAUSTING);
  assert.ok(/A reviewer verdict, a producer reply, or a Clarify answer never waives a gate/.test(EXHAUSTING), EXHAUSTING);
});

test("[FR-218 | 2.5 | Cap reached] the replaced rule is gone: no file keeps 'one binding code-reviewer pass' or 'binding final pass' as a step at the cap", () => {
  Object.keys(TEXT).forEach((k) => {
    assert.ok(!/one binding `?code-reviewer`? pass/i.test(TEXT[k]), FILES[k] + " keeps the one binding pass");
    assert.ok(!/ends with one code-reviewer pass/.test(TEXT[k]), FILES[k] + " keeps the exhausted-gate pass");
    assert.ok(!/reaches this agent as the binding final pass/.test(TEXT[k]), FILES[k] + " keeps the binding final pass");
    assert.ok(!/binding pass at the bound/i.test(TEXT[k]), FILES[k] + " keeps the pass at the bound");
  });
});

// ---------------------------------------------------------------------------
// FR-218: every gate's exit and every repeat of the cap agree
// ---------------------------------------------------------------------------

test("[FR-218 | 2.5 | Cap reached] each gate's exit condition in review-protocol.md escalates at the cap with no further round", () => {
  const capLines = linesOf(TEXT.protocol).filter((l) => /10 iterations/.test(l) && /(reached|Exit|exit|escalat)/.test(l) && !/Tracked:/.test(l));
  assert.ok(capLines.length >= 8, "at least eight lines state a gate exit at the cap: " + capLines.length);
  capLines.forEach((l) => {
    assert.ok(/escalat/i.test(l), "a cap line without escalation: " + l);
  });
});

test("[FR-218 | 2.5 | Cap reached] the Security, Testing, OWASP for LLM, and Planning Document gates each point to 'Exhausting a gate' or state the escalation", () => {
  const lines = linesOf(TEXT.protocol);
  const gateStart = (re) => {
    const i = lines.findIndex((l) => re.test(l));
    assert.ok(i >= 0, "gate heading not found: " + re);
    return i;
  };
  // A gate's Exit Conditions sit after its heading and before the next gate heading ("### ... Gate").
  const gates = [
    [/^### Security Gate/, /^### Testing Gate/],
    [/^### Testing Gate/, /^### Code Review Gate|^## /],
    [/^### OWASP for LLM Gate/, /^### Testing Gate|^## /],
    [/^### Planning Document Review Gate/, /^## /],
  ];
  gates.forEach((pair) => {
    const from = gateStart(pair[0]);
    let to = lines.length;
    for (let i = from + 1; i < lines.length; i += 1) {
      if (pair[1].test(lines[i])) {
        to = i;
        break;
      }
    }
    const body = lines.slice(from, to).join("\n");
    assert.ok(/escalat/i.test(body), lines[from] + " does not state the cap escalation");
  });
  assert.ok((TEXT.protocol.match(/see "Exhausting a gate"/g) || []).length >= 5, "cross-references to 'Exhausting a gate'");
});

test("[FR-218 | 2.5 | Cap reached] the OWASP for LLM Gate exits on two consecutive approved verdicts or escalates at 10 iterations, with no binding pass", () => {
  const gate = section(TEXT.protocol, /^### OWASP for LLM Gate$/);
  assert.ok(/Exit on 2 consecutive `approved` verdicts, or at the cap of 10 iterations run no further round and escalate to the user with continue, waive, or abort/.test(gate), gate);
  assert.ok(!/binding/.test(gate), "no binding pass in the OWASP for LLM Gate: " + gate);
});

test("[FR-218 | 2.5 | Cap reached] the /do Loops row escalates to the user at the cap of 10 and names the three choices", () => {
  const row = linesOf(TEXT.doSkill).find((l) => /^\| Review gate \(code, planning, OWASP for LLM\)/.test(l));
  assert.ok(row, "Review gate loop row");
  assert.ok(/2 consecutive approvals, or the cap of 10 per gate/.test(row), row);
  assert.ok(/escalate to the user at the cap of 10 \(continue, waive, or abort; no further developer or reviewer round\)/.test(row), row);
  assert.ok(/`waive` completes the step with the waiver recorded/.test(row), row);
  assert.ok(/`abort` marks it `failed`/.test(row), row);
});

test("[FR-218 | 2.5 | Cap reached] /do Review gates: a gate at its cap runs no further round, dispatches no code-reviewer pass, and escalates with the unresolved findings", () => {
  const gates = section(TEXT.doSkill, /^### Review gates$/);
  assert.ok(/A gate that reaches its cap of 10 iterations without approval \(the OWASP for LLM Gate included\) runs no further developer or reviewer round and dispatches no code-reviewer pass/.test(gates), gates);
  assert.ok(/escalates to the user with the unresolved findings and the choices continue, waive, or abort/.test(gates), gates);
  assert.ok(/Only the user's answer picks a choice/.test(gates), gates);
  assert.ok(/The main agent never rewrites the artifact itself/.test(gates), gates);
});

test("[FR-218 | 2.5 | Cap reached] the rule file's escalation section lists no further round, no code-reviewer pass, the three choices, the plan-file waive, and the user's answer", () => {
  const esc = section(TEXT.rule, /^### Escalation$/);
  assert.ok(/Run no further creator or reviewer round, and dispatch no `code-reviewer` pass/.test(esc), esc);
  assert.ok(/continue, waive, or abort/.test(esc), esc);
  assert.ok(/records a waive in the plan file/.test(esc), esc);
  assert.ok(/Only the user's answer picks a choice/.test(esc), esc);
});

test("[FR-218 | 2.5 | Cap reached] code-reviewer.md: at the cap /do dispatches no further pass to this agent and escalates; it is no binding final pass", () => {
  assert.ok(/At the cap of 10 iterations `\/do` dispatches no further pass to this agent; it escalates to the user with continue, waive, or abort/.test(TEXT.codeReviewer));
  assert.ok(/`\/do` owns the one cap of 10 iterations and, at the cap, escalates to the user instead of dispatching another pass/.test(TEXT.codeReviewer));
});

test("[FR-218 | 2.5 | Cap reached] the agent registry row for code-reviewer says no further round and no binding final pass at the cap", () => {
  const row = linesOf(TEXT.registry).find((l) => /^\| \*\*code-reviewer\*\*/.test(l));
  assert.ok(row, "code-reviewer registry row");
  assert.ok(/at the cap of 10 iterations `\/do` escalates to the user: continue, waive, or abort; no further round and no binding final pass/.test(row), row);
});

test("[FR-218 | 2.5 | Cap reached] fix-phase-rules.md: a failed attempt counts toward the one cap, and a gate at the cap escalates with no further round", () => {
  assert.ok(/counts toward the gate's one cap of 10 iterations/.test(TEXT.fixPhase), "failed attempt counts toward the cap");
  assert.ok(/A gate that reaches the cap of 10 ends as review-protocol\.md describes: no further developer or reviewer round, and escalation to the user with continue, waive, or abort/.test(TEXT.fixPhase));
});

test("[FR-218 | 2.5 | Cap reached] planning-review-agents.md: at the cap no further round and no code-reviewer pass; escalate with the three choices; the orchestrator records a waive", () => {
  assert.ok(/If the one cap of 10 iterations is reached without consensus/.test(TEXT.planning));
  assert.ok(/Run no further creator or reviewer round, and dispatch no `code-reviewer` pass/.test(TEXT.planning));
  assert.ok(/choices continue, waive, or abort \(see "Exhausting a gate" in review-protocol\.md\)/.test(TEXT.planning));
  assert.ok(/The orchestrator records a waive in the plan file/.test(TEXT.planning));
});

test("[FR-218 | 2.5 | Cap reached] reviewer-adversarial-reflection.md: the loop exits on two consecutive LGTMs or the one cap of 10, with escalation and no further round", () => {
  assert.ok(/Exit when: 2 consecutive LGTMs OR the one cap of 10 iterations \(no further round; escalate to the user: continue, waive, or abort\)/.test(TEXT.reflection));
});
