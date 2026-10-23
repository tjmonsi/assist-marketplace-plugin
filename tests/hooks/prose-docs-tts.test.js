// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box tests for voice scripts under docs/tts/ as the prose hooks judge them, release 1.13.1
// (plugins/assist-plugin/hooks/impl/prose-gate.js and prose-advisor.js, `evaluate(input, options)`).
//
// Sources: specs/spec-hooks-prose-hooks.md (Change Log 2026-10-23: Requirement: Voice scripts
// judged like other prose files; Requirement: Path exemptions as built; Requirement: Self-test
// isolation for the project root; REMOVED Requirement: Voice-script exemption under the project
// root and the session directory), specs/spec-hooks-platform.md (Change Log 2026-10-23:
// Requirement: Guard decision and deny output, Scenario: Prose-gate reads only the target file and
// the allowlist), and docs/requirements/FR-NFR-assist-plugin.md (FR-213, FR-104, FR-105, FR-088,
// NFR-019; FR-181 appears only as retired history: built in 1.11.1, retired in 1.13.1).
// Upstream ids: UR-058 (voice scripts without em dashes), UR-016 (prose hooks), BR-008.
//
// Traceability format: [Scenario title | spec section | FR ids]. The specs use named
// requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// End state asserted here: neither hook exempts any docs/tts/ path. A voice script is judged like
// any prose file: the header and the notes are judged, and fenced blocks stay exempt (FR-105).
// Only the system temp directory and a prose-gate-allowlist.json entry exempt a path. The test
// option keys projectDir and findGitRoot have no effect, and CLAUDE_PROJECT_DIR gives no exemption.
//
// Contract used (specs/spec-hooks-platform.md and spec-hooks-prose-hooks.md):
//   - prose-gate evaluate(input, options) returns an object whose `deny` field is the boolean
//     true to deny, with a string `reason`; anything else allows.
//   - prose-advisor evaluate(input, options) returns null when it has nothing to say and an
//     object (the advisory note) when the added text holds an advisory-tier tell.
//   - options keys: `readFile` (a function from a path to the file text, or null), `allowlist`
//     (an array of path substrings), `tmpdir` (the directory that counts as the system temp dir).
// "Judged" below means: prose-gate denies the em dash and prose-advisor returns a note for the
// advisory tell, for the same target. "Exempt" means neither hook says anything.
//
// The banned characters are built from code-point escapes, so this file holds none of them.
// All paths below are made-up POSIX paths that do not exist.
//
// Run: node --test tests/hooks/prose-docs-tts.test.js

"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const HOOKS = path.join(REPO, "plugins", "assist-plugin", "hooks", "impl");
const gate = require(path.join(HOOKS, "prose-gate.js"));
const advisor = require(path.join(HOOKS, "prose-advisor.js"));

const EM = String.fromCharCode(0x2014); // U+2014 em dash, a block-tier tell
const BAR = String.fromCharCode(0x2015); // U+2015 horizontal bar, a block-tier tell
const CURLY = [0x2018, 0x2019, 0x201c, 0x201d].map((c) => String.fromCharCode(c)); // block-tier tells

const GATE_TEXT = "A " + EM + " B.\n"; // plain prose with one em dash
const ADVISOR_TEXT = "This is very robust.\n"; // an intensifier and an AI-vocabulary word (advisory tier)
const DENY_PREFIX = "assist-plugin prose-gate denied this write";

const P = "/assist-test/project";
const TMP = "/assist-test/tmp";
const VOICE = "voice-intro-20261012-0900.md";

// ---------------------------------------------------------------------------
// Environment isolation: the real variables must not change a case's result
// ---------------------------------------------------------------------------

const savedEnv = {};

before(() => {
  ["CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA"].forEach((k) => {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  });
});

after(() => {
  Object.keys(savedEnv).forEach((k) => {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  });
});

// ---------------------------------------------------------------------------
// Builders and verdict helpers
// ---------------------------------------------------------------------------

function options(extra) {
  return Object.assign({ readFile: () => null, allowlist: [], tmpdir: TMP }, extra);
}

function gateInput(cwd, target, content) {
  const input = {
    hook_event_name: "PreToolUse",
    tool_name: "Write",
    tool_input: { file_path: target, content: content === undefined ? GATE_TEXT : content },
  };
  if (cwd !== undefined) input.cwd = cwd;
  return input;
}

function advisorInput(cwd, target, content) {
  const input = {
    hook_event_name: "PostToolUse",
    tool_name: "Write",
    tool_input: { file_path: target, content: content === undefined ? ADVISOR_TEXT : content },
    tool_response: { type: "create" },
  };
  if (cwd !== undefined) input.cwd = cwd;
  return input;
}

function denied(result) {
  return result !== null && result !== undefined && result.deny === true;
}

function noted(result) {
  return result !== null && result !== undefined && typeof result === "object";
}

// A saved voice script in the shape of the output template: a header, a Notes list, and one fenced
// text block. `header` is the prose between the title and the Notes list; `notes` is a list of items;
// `fence` is the text inside the block.
function voiceScript(parts) {
  const p = Object.assign(
    {
      title: "# Voice script: Intro",
      header: "Pause here, then go on.",
      notes: ["Em dashes replaced: 0 (U+2014 and U+2015, draft, header, and composed text)."],
      fence: "Hello there, and welcome.",
    },
    parts
  );
  return (
    p.title + "\n\n" + p.header + "\n\n## Notes\n\n" + p.notes.map((n) => "- " + n).join("\n") + "\n\n## Script\n\n```text\n" + p.fence + "\n```\n"
  );
}

// Runs both hooks on one scenario with the same options. Gate content holds an em dash and advisor
// content holds an advisory tell, so a judged target is denied and noted; an exempt target is not.
function check(s) {
  const opts = options(s.options);
  const g = gate.evaluate(gateInput(s.cwd, s.target), opts);
  const a = advisor.evaluate(advisorInput(s.cwd, s.target), opts);
  const where = s.target + " (cwd " + s.cwd + ")";
  if (s.exempt) {
    assert.ok(!denied(g), "prose-gate denied an exempt target: " + where);
    assert.ok(!noted(a), "prose-advisor flagged an exempt target: " + where);
  } else {
    assert.ok(denied(g), "prose-gate allowed a judged target: " + where);
    assert.ok(noted(a), "prose-advisor stayed silent on a judged target: " + where);
  }
}

// ---------------------------------------------------------------------------
// Requirement: Voice scripts judged like other prose files
// ---------------------------------------------------------------------------

test("voice script header with an em dash is denied with rule em-dash/char and the standard deny reason", () => {
  // [Scenario: Voice script header with an em dash | spec-hooks-prose-hooks.md Change Log 2026-10-23, Requirement: Voice scripts judged like other prose files | FR-213 | FR-104 | UR-058]
  // Valid input: cwd is the project root, relative target, em dash in the header outside the fence.
  const content = voiceScript({ header: "Calm " + EM + " warm delivery." });
  const result = gate.evaluate(gateInput(P, "docs/tts/" + VOICE, content), options());
  assert.ok(denied(result), "prose-gate must deny an em dash in a voice-script header");
  assert.strictEqual(typeof result.reason, "string");
  assert.ok(result.reason.indexOf(DENY_PREFIX) === 0, "deny reason starts with the standard text: " + result.reason);
  assert.ok(result.reason.indexOf("em-dash/char") !== -1, "deny reason lists rule id em-dash/char: " + result.reason);
});

test("voice script header with an em dash is denied from an absolute target too", () => {
  // [Scenario: Voice script header with an em dash (absolute target) | spec-hooks-prose-hooks.md Requirement: Voice scripts judged like other prose files | FR-213 | FR-104]
  const content = voiceScript({ title: "# Intro " + EM + " part one" });
  assert.ok(denied(gate.evaluate(gateInput(P, P + "/docs/tts/" + VOICE, content), options())));
});

test("voice script without a tell, session in a subdirectory, is allowed with no output", () => {
  // [Scenario: Voice script without a tell | spec-hooks-prose-hooks.md Requirement: Voice scripts judged like other prose files | FR-213 | FR-104]
  const content = voiceScript({});
  const g = gate.evaluate(gateInput(P + "/src", P + "/docs/tts/" + VOICE, content), options());
  assert.ok(!denied(g), "a clean voice script passes prose-gate");
  const a = advisor.evaluate(advisorInput(P + "/src", P + "/docs/tts/" + VOICE, content), options());
  assert.ok(!noted(a), "a clean voice script draws no advisory note");
});

test("fenced script block stays exempt: the only em dash sits inside the fenced text block", () => {
  // [Scenario: Fenced script block stays exempt | spec-hooks-prose-hooks.md Requirement: Voice scripts judged like other prose files | FR-213 | FR-105 | NFR-019]
  const content = voiceScript({ fence: "Pause here " + EM + " then go on." });
  assert.ok(!denied(gate.evaluate(gateInput(P, "docs/tts/" + VOICE, content), options())));
});

test("fenced script block stays exempt for U+2015 and for every curly quote inside the fence", () => {
  // [Scenario: Fenced script block stays exempt (all block-tier characters) | spec-hooks-prose-hooks.md Requirement: Voice scripts judged like other prose files | FR-213 | FR-105]
  // Boundary: each banned character, alone in the fence, passes; the skill, not the gate, controls the fence.
  [BAR].concat(CURLY).forEach((ch) => {
    const content = voiceScript({ fence: "It" + ch + "s a test." });
    assert.ok(!denied(gate.evaluate(gateInput(P, "docs/tts/" + VOICE, content), options())), "U+" + ch.charCodeAt(0).toString(16));
  });
});

test("header outside the fence: U+2015 and each curly quote are denied", () => {
  // [Scenario: Voice script header with an em dash (other block-tier characters) | spec-hooks-prose-hooks.md Requirement: Block-tier judgment and deny reason | FR-213 | NFR-019]
  // Boundary: the block-tier characters other than U+2014, one per header.
  [BAR].concat(CURLY).forEach((ch) => {
    const content = voiceScript({ header: "It" + ch + "s calm." });
    const result = gate.evaluate(gateInput(P, "docs/tts/" + VOICE, content), options());
    assert.ok(denied(result), "U+" + ch.charCodeAt(0).toString(16) + " in a header must be denied");
    const rule = ch === BAR ? "em-dash/char" : "curly-quote/char";
    assert.ok(result.reason.indexOf(rule) !== -1, "reason lists " + rule + ": " + result.reason);
  });
});

test("inline code in the header is exempt in the same way as a fence", () => {
  // [Scenario: Voice script without a tell (model id in backticks) | spec-hooks-prose-hooks.md Requirement: Voice scripts judged like other prose files | FR-213 | FR-105]
  // The model id sits in backticks in the header table; an inline code span is an exempt region.
  const content = voiceScript({ header: "Model: `vendor/model" + EM + "x`." });
  assert.ok(!denied(gate.evaluate(gateInput(P, "docs/tts/" + VOICE, content), options())));
});

test("empty content for a voice script path is allowed", () => {
  // [Scenario: Voice script without a tell (empty content) | spec-hooks-prose-hooks.md Requirement: Voice scripts judged like other prose files | FR-213]
  // Null/empty category.
  assert.ok(!denied(gate.evaluate(gateInput(P, "docs/tts/" + VOICE, ""), options())));
  assert.ok(!noted(advisor.evaluate(advisorInput(P, "docs/tts/" + VOICE, ""), options())));
});

test("no built-in exemption from a subdirectory session: docs/tts below the session directory is denied", () => {
  // [Scenario: No built-in exemption from a subdirectory session | spec-hooks-prose-hooks.md Requirement: Voice scripts judged like other prose files | FR-213 | FR-104]
  const content = voiceScript({ header: "Calm " + EM + " warm." });
  const target = P + "/src/docs/tts/" + VOICE;
  assert.ok(denied(gate.evaluate(gateInput(P + "/src", target, content), options())));
  assert.ok(denied(gate.evaluate(gateInput(P + "/src", "docs/tts/" + VOICE, content), options())), "relative target against the session directory");
});

test("worktree session: docs/tts in the worktree directory is denied", () => {
  // [Scenario: Worktree session | spec-hooks-prose-hooks.md Requirement: Voice scripts judged like other prose files | FR-213 | FR-104]
  const wt = P + "/.claude/worktrees/feature-a";
  const content = voiceScript({ header: "Calm " + EM + " warm." });
  assert.ok(denied(gate.evaluate(gateInput(wt, wt + "/docs/tts/voice-x.md", content), options())));
  assert.ok(denied(gate.evaluate(gateInput(wt, "docs/tts/voice-x.md", content), options())));
});

test("advisor on a voice script header: an advisory tell outside the fence draws a note", () => {
  // [Scenario: Advisor on a voice script header | spec-hooks-prose-hooks.md Requirement: Voice scripts judged like other prose files | FR-213 | FR-104]
  const content = voiceScript({ header: ADVISOR_TEXT.trim() });
  assert.ok(noted(advisor.evaluate(advisorInput(P, "docs/tts/" + VOICE, content), options())));
});

test("advisory tell only inside the fence: the advisor emits nothing", () => {
  // [Scenario: Advisory tell only inside the fence | spec-hooks-prose-hooks.md Requirement: Voice scripts judged like other prose files | FR-213 | FR-105]
  const content = voiceScript({ fence: ADVISOR_TEXT.trim() });
  assert.ok(!noted(advisor.evaluate(advisorInput(P, "docs/tts/" + VOICE, content), options())));
});

test("a voice script saved before 1.13.1 stays editable: an Edit that adds no new tell passes", () => {
  // [Scenario: Voice script without a tell (existing file, only added text is judged) | spec-hooks-prose-hooks.md Requirement: Voice scripts judged like other prose files, context paragraph | FR-213 | FR-104]
  // The stored file holds an em dash in its header (saved by 1.11.1 to 1.13.0). The edit adds a clean line.
  const target = P + "/docs/tts/" + VOICE;
  const existing = voiceScript({ header: "Calm " + EM + " warm." });
  const input = {
    hook_event_name: "PreToolUse",
    tool_name: "Edit",
    cwd: P,
    tool_input: { file_path: target, old_string: "Hello there, and welcome.", new_string: "Hello there, and welcome.\nOne more line." },
  };
  const result = gate.evaluate(input, options({ readFile: (p) => (p === target ? existing : null) }));
  assert.ok(!denied(result), "an Edit that adds no tell must pass");
  // Control: an Edit that adds an em dash to the header is denied.
  const bad = {
    hook_event_name: "PreToolUse",
    tool_name: "Edit",
    cwd: P,
    tool_input: { file_path: target, old_string: "Pause here", new_string: "Pause here " + EM },
  };
  const clean = voiceScript({});
  const control = gate.evaluate(bad, options({ readFile: (p) => (p === target ? clean : null) }));
  assert.ok(denied(control), "control: an Edit that adds an em dash is denied");
});

// ---------------------------------------------------------------------------
// Requirement: Path exemptions as built (MODIFIED)
// ---------------------------------------------------------------------------

test("voice script from the project root is denied (no root exemption)", () => {
  // [Scenario: Voice script from the project root | spec-hooks-prose-hooks.md Change Log 2026-10-23, Requirement: Path exemptions as built | FR-104 | UR-016]
  check({ cwd: P, target: "docs/tts/" + VOICE, exempt: false });
  check({ cwd: P, target: P + "/docs/tts/" + VOICE, exempt: false });
});

test("voice script from a session started in a subdirectory with CLAUDE_PROJECT_DIR set is denied", () => {
  // [Scenario: Voice script from a session started in a subdirectory | spec-hooks-prose-hooks.md Change Log 2026-10-23, Requirement: Path exemptions as built | FR-104 | FR-213 | UR-016]
  // The environment variable gives no exemption: the project root no longer matters.
  process.env.CLAUDE_PROJECT_DIR = P;
  try {
    check({ cwd: P + "/src", target: P + "/docs/tts/" + VOICE, exempt: false });
    check({ cwd: P + "/src", target: "../docs/tts/" + VOICE, exempt: false });
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
  }
});

test("hook called with no options and CLAUDE_PROJECT_DIR set: the docs/tts target is judged", () => {
  // [Scenario: Voice script from a session started in a subdirectory (no options) | spec-hooks-prose-hooks.md Change Log 2026-10-23, Requirement: Path exemptions as built | FR-104 | FR-213 | UR-016]
  // Shape boundary: evaluate is called with the input alone, as the live hook does; the environment is the only context.
  process.env.CLAUDE_PROJECT_DIR = "/assist-test/solo";
  try {
    assert.ok(denied(gate.evaluate(gateInput("/assist-test/solo/src", "/assist-test/solo/docs/tts/a.md"))), "prose-gate judges the target");
    assert.ok(noted(advisor.evaluate(advisorInput("/assist-test/solo/src", "/assist-test/solo/docs/tts/a.md"))), "prose-advisor judges the target");
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
  }
});

test("session directory outside the project: its docs/tts and the project's docs/tts are both judged", () => {
  // [Scenario: No built-in exemption from a subdirectory session (other directory) | spec-hooks-prose-hooks.md Requirement: Voice scripts judged like other prose files | FR-213 | FR-104]
  check({ cwd: "/assist-test/other", target: "/assist-test/other/docs/tts/a.md", exempt: false });
  check({ cwd: "/assist-test/other", target: P + "/docs/tts/a.md", exempt: false });
});

test("listed path stays exempt: an allowlist entry for docs/tts/ silences both hooks", () => {
  // [Scenario: Listed path stays exempt | spec-hooks-prose-hooks.md Change Log 2026-10-23, Requirement: Path exemptions as built | FR-104 | UR-016]
  const opts = { allowlist: ["docs/tts/"] };
  check({ cwd: P, target: P + "/docs/tts/a.md", exempt: true, options: opts });
  check({ cwd: P + "/src", target: P + "/docs/tts/a.md", exempt: true, options: opts });
  // Control: the entry does not reach another docs path.
  check({ cwd: P, target: P + "/docs/guide.md", exempt: false, options: opts });
});

test("allowlist entry star exempts every path, docs/tts included", () => {
  // [Scenario: Allowlist entry star (unchanged) | spec-hooks-prose-hooks.md Requirement: Path exemptions as built | FR-104 | UR-016]
  const opts = { allowlist: ["*"] };
  check({ cwd: P, target: P + "/docs/tts/a.md", exempt: true, options: opts });
  check({ cwd: P, target: P + "/docs/guide.md", exempt: true, options: opts });
});

test("the system temp directory stays unjudged, and the same relative path outside it is judged", () => {
  // [Scenario: Path exemptions as built (system temp directory) | spec-hooks-prose-hooks.md Requirement: Path exemptions as built | FR-104 | UR-016]
  check({ cwd: TMP + "/work", target: TMP + "/work/docs/tts/a.md", exempt: true });
  check({ cwd: P, target: TMP + "/docs/tts/a.md", exempt: true });
  // Control: the same relative path outside the temp directory is judged.
  check({ cwd: P, target: P + "/docs/tts/a.md", exempt: false });
});

test("other docs path stays gated in a subdirectory session and at the project root", () => {
  // [Scenario: Other docs path (unchanged) | spec-hooks-prose-hooks.md Requirement: Path exemptions as built | FR-104 | UR-016]
  check({ cwd: P + "/src", target: P + "/docs/guide.md", exempt: false });
  check({ cwd: P, target: "docs/guide.md", exempt: false });
});

test("a path that climbs out of docs/tts stays gated", () => {
  // [Scenario: Path that climbs out (unchanged) | spec-hooks-prose-hooks.md Requirement: Path exemptions as built | FR-104 | UR-016]
  // Boundary: dot segments are normalized before the comparison.
  check({ cwd: P, target: "docs/tts/../README.md", exempt: false });
  check({ cwd: P + "/src", target: P + "/docs/tts/../README.md", exempt: false });
});

test("a sibling directory that only starts with 'tts' is judged like any prose path", () => {
  // [Scenario: Path exemptions as built (nothing special about docs/tts) | spec-hooks-prose-hooks.md | FR-104 | FR-213]
  check({ cwd: P, target: P + "/docs/tts-notes/a.md", exempt: false });
  check({ cwd: P, target: P + "/docs/ttsfile.md", exempt: false });
});

test("a relative target with a missing, empty, or relative cwd is still judged", () => {
  // [Scenario: Path exemptions as built (relative target without a usable cwd) | spec-hooks-prose-hooks.md | FR-104 | FR-213]
  // Null/empty and boundary: no cwd value gives an exemption.
  [undefined, "", "src", "."].forEach((cwd) => {
    check({ cwd: cwd, target: "docs/tts/a.md", exempt: false });
  });
});

// ---------------------------------------------------------------------------
// Requirement: Self-test isolation for the project root (the options have no effect)
// ---------------------------------------------------------------------------

test("a caller that still passes projectDir and findGitRoot gets the same result as one that does not", () => {
  // [Scenario: Case without the project-root keys | spec-hooks-prose-hooks.md Change Log 2026-10-23, Requirement: Self-test isolation for the project root, and REMOVED Migration (Callers) | FR-118 | FR-091 | FR-104]
  // The keys have nothing left to replace: changes() copies its options and reads only the keys it uses.
  const targets = [
    { cwd: P + "/src", target: P + "/docs/tts/" + VOICE },
    { cwd: P, target: "docs/tts/" + VOICE },
    { cwd: "/assist-test/other", target: "/assist-test/other/docs/tts/a.md" },
    { cwd: P + "/src", target: P + "/docs/guide.md" },
  ];
  const extras = [
    { projectDir: P, findGitRoot: () => P },
    { projectDir: null, findGitRoot: () => null },
    { projectDir: undefined, findGitRoot: "not a function" },
  ];
  targets.forEach((t) => {
    const plainGate = gate.evaluate(gateInput(t.cwd, t.target), options());
    const plainAdvisor = advisor.evaluate(advisorInput(t.cwd, t.target), options());
    extras.forEach((extra) => {
      const g = gate.evaluate(gateInput(t.cwd, t.target), options(extra));
      const a = advisor.evaluate(advisorInput(t.cwd, t.target), options(extra));
      assert.deepStrictEqual(g, plainGate, "prose-gate result changed with " + JSON.stringify(Object.keys(extra)) + " for " + t.target);
      assert.deepStrictEqual(a, plainAdvisor, "prose-advisor result changed with " + JSON.stringify(Object.keys(extra)) + " for " + t.target);
    });
  });
});

test("a real CLAUDE_PROJECT_DIR does not change either hook's result", () => {
  // [Scenario: Real project variable during SessionStart | spec-hooks-prose-hooks.md Change Log 2026-10-23, Requirement: Self-test isolation for the project root | FR-118 | FR-091 | FR-104]
  const baseline = {
    gate: gate.evaluate(gateInput(P + "/src", P + "/docs/tts/" + VOICE), options()),
    advisor: advisor.evaluate(advisorInput(P + "/src", P + "/docs/tts/" + VOICE), options()),
  };
  process.env.CLAUDE_PROJECT_DIR = "/home/u/app";
  try {
    assert.deepStrictEqual(gate.evaluate(gateInput(P + "/src", P + "/docs/tts/" + VOICE), options()), baseline.gate);
    assert.deepStrictEqual(advisor.evaluate(advisorInput(P + "/src", P + "/docs/tts/" + VOICE), options()), baseline.advisor);
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
  }
});

// ---------------------------------------------------------------------------
// Requirement: Guard decision and deny output (platform spec)
// ---------------------------------------------------------------------------

test("prose-gate reads only the target file and the allowlist: no .git path is checked and the reader is the only read", (t) => {
  // [Scenario: Prose-gate reads only the target file and the allowlist | spec-hooks-platform.md Change Log 2026-10-23, Requirement: Guard decision and deny output | FR-088 | FR-104 | FR-213]
  process.env.CLAUDE_PROJECT_DIR = "/p";
  const readerCalls = [];
  const reader = (p) => {
    readerCalls.push(p);
    return null;
  };
  const probes = ["statSync", "lstatSync", "existsSync", "accessSync"].map((name) => t.mock.method(fs, name));
  let result;
  let advisorResult;
  try {
    result = gate.evaluate(gateInput("/p/src", "/p/docs/tts/a.md"), { readFile: reader, allowlist: [], tmpdir: "/t" });
    advisorResult = advisor.evaluate(advisorInput("/p/src", "/p/docs/tts/a.md"), { readFile: reader, allowlist: [], tmpdir: "/t" });
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
  }
  const gitChecks = [];
  probes.forEach((probe) => {
    probe.mock.calls.forEach((call) => {
      const first = call.arguments[0];
      if (typeof first === "string" && /(^|[\\/])\.git([\\/]|$)/.test(first)) gitChecks.push(first);
    });
    probe.mock.restore();
  });
  assert.ok(result && result.deny === true, "evaluate must return deny: true");
  assert.ok(noted(advisorResult), "prose-advisor must flag the docs/tts advisory tell");
  assert.deepStrictEqual(gitChecks, [], "no directory is checked for .git: " + JSON.stringify(gitChecks));
  readerCalls.forEach((p) => assert.strictEqual(p, "/p/docs/tts/a.md", "the reader reads only the target file"));
});

// ---------------------------------------------------------------------------
// Saved-file fixtures: a full voice script built from the output template
// ---------------------------------------------------------------------------

const FIXED_NOTES = [
  "Em dashes replaced: 3 (U+2014 and U+2015, draft, header, and composed text).",
  "Curly quotes straightened to ASCII quotes.",
  "Kept tell: chatbot-residue, draft line 4.",
  "Kept tell: summary-label, draft line 9.",
];

test("a saved voice script with the fixed notes of the header-notes rule passes prose-gate", () => {
  // [Scenario: Header under the standard | spec-skills-deslop-voice-clarify.md Change Log 2026-10-23, Requirement: Writing standard scope in the voice-script skill, and Requirement: Header notes for swaps and kept tells | FR-213 | FR-212 | NFR-019 | UR-058]
  // The count note, the curly-quote note, and two kept-tell flags name the tell by family and line, never its text.
  const content = voiceScript({ notes: FIXED_NOTES, fence: "Plain words, one pause, and an end." });
  assert.ok(!denied(gate.evaluate(gateInput(P, "docs/tts/" + VOICE, content), options())));
});

test("each fixed note passes prose-gate on its own", () => {
  // [Scenario: Header passes the prose gate | spec-skills-deslop-voice-clarify.md Requirement: One same-path retry after a header deny | FR-213 | FR-212 | FR-163]
  FIXED_NOTES.forEach((note) => {
    const content = voiceScript({ notes: [note] });
    assert.ok(!denied(gate.evaluate(gateInput(P, "docs/tts/" + VOICE, content), options())), note);
  });
});

test("a saved voice script is denied when its header adds an em dash or a curly quote", () => {
  // [Scenario: Header denied by the prose gate | spec-skills-deslop-voice-clarify.md Requirement: One same-path retry after a header deny | FR-213 | FR-163 | UR-058]
  [EM, BAR].concat(CURLY).forEach((ch) => {
    const content = voiceScript({ notes: FIXED_NOTES, title: "# Voice script: it" + ch + "s here" });
    const result = gate.evaluate(gateInput(P, "docs/tts/" + VOICE, content), options());
    assert.ok(denied(result), "U+" + ch.charCodeAt(0).toString(16) + " in the title must be denied");
    assert.ok(result.reason.indexOf(DENY_PREFIX) === 0, result.reason);
  });
});

test("a header deny names the flagged text so the skill can fix it, and the fixed header passes", () => {
  // [Scenario: Header denied by the prose gate (fix and retry) | spec-skills-deslop-voice-clarify.md Requirement: One same-path retry after a header deny | FR-163 | FR-213]
  const bad = voiceScript({ header: "Calm " + EM + " warm." });
  const first = gate.evaluate(gateInput(P, "docs/tts/" + VOICE, bad), options());
  assert.ok(denied(first));
  // The retry rewrites only the flagged text (a comma for the dash) on the same path.
  const fixed = voiceScript({ header: "Calm, warm." });
  assert.ok(!denied(gate.evaluate(gateInput(P, "docs/tts/" + VOICE, fixed), options())));
});

test("a PostToolUse advisor note on a saved header is not a deny", () => {
  // [Scenario: Advisor note after a saved file | spec-skills-deslop-voice-clarify.md Requirement: One same-path retry after a header deny | FR-163 | FR-213]
  const content = voiceScript({ header: ADVISOR_TEXT.trim() });
  assert.ok(!denied(gate.evaluate(gateInput(P, "docs/tts/" + VOICE, content), options())), "an advisory tell is not a block-tier tell");
  assert.ok(noted(advisor.evaluate(advisorInput(P, "docs/tts/" + VOICE, content), options())));
});
