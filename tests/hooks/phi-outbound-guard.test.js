// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the PHI outbound guard and its BAA rule (harness-governance Tranche 3, Step 30): the
// command entry plugins/assist-plugin/hooks/phi-outbound-guard.js, run as a PreToolUse hook with one JSON document on
// stdin. The guard implementation is never read or imported here.
//
// Sources: docs/requirements/FR-NFR-harness-governance.md section 2.20 (FR-233: PHI pattern in a PR comment, Clean
// payload), section 2.21 (FR-234: BAA recorded, BAA missing), section 3.2 (NFR-028 fail closed, an absent profile.json
// runs log-only), NFR-026 (a denial is logged), NFR-031 (no PHI value in a log or a denial), NFR-033, NFR-035;
// specs/spec-hooks-compliance.md, "Requirement: PHI outbound guard" and "Requirement: BAA reference and profile
// readiness"; plugins/assist-plugin/rules/assist-plugin-rule.md, "Outbound data guards" (the covered calls, the documented
// profile.json keys phi_patterns, data_classes, external_systems, baa_references, the profile states, the rule ids) and
// "Hook Fail-Open Rule". Task plan: docs/task-plans/task-plan-harness-governance-20261028-0759.md, Steps 27, 28, 30.
//
// Traceability format: [AC-N | Requirement | spec-hooks-compliance | FR-nnn | UR-069 | BR-020 | related ids]. The spec
// carries no SPEC-NNN id, so it is cited by file name. AC-N is the position of the Scenario inside its Requirement:
//   PHI outbound guard: AC-1 PHI pattern in a PR comment, AC-2 Clean payload
//   BAA reference and profile readiness: AC-1 BAA recorded, AC-2 BAA missing
//
// Contract used (documented configuration; the guard implementation is never read):
//   - The guard covers a WebFetch call (its `url` and `prompt`) and a `gh pr` or `bkt pr` command that posts (create,
//     edit, comment, review, merge, close, approve, decline, update, reply). The payload is the body, title, and text
//     options, a --body-file file, and a heredoc. Any other call is not judged.
//   - `phi_patterns` in .agent/governance/profile.json is a list of regular expression sources or {name, pattern}
//     objects, matched case-insensitively. `data_classes.PHI` lists the PHI-tagged path globs.
//   - A call whose payload matches a pattern, or whose --body-file is under a PHI-tagged path, is denied. The denial
//     names the rule or pattern and the class, never the matched value.
//   - BAA rule (rule id phi-outbound.baa): `external_systems` [{name, hosts}] and `baa_references` [{system, identifier,
//     counterparty, date}]. A covered call to a listed system with no reference is denied. The system of a call is the
//     host of the WebFetch url, or the platform default host of the PR post (gh is github.com). A host that no listed
//     system names is not judged. A bad value under either key is an unusable configuration (phi-outbound.config).
//   - No profile.json: log-only, never denies. A malformed profile.json while HIPAA is enforced: every covered call is
//     denied until the file is fixed. HIPAA opted out in the committed .claude/settings.json: every call is allowed.
//   - A deny is the PreToolUse deny JSON on stdout with exit 0. The deny is logged to the governance audit log as a
//     decision record (`decision: "deny"`).
//   - Fail closed (NFR-028): an error after the input was parsed denies a covered call; `ls`, reads, and every other
//     call still pass.
//
// Every project is a temp directory with a .git directory, so the hook finds it as the git root of the input `cwd`.
// Fault injection uses a preload script (node --require) in a temp folder; no repository file is edited.
//
// Run: node --test tests/hooks/phi-outbound-guard.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const ENTRY = path.join(fx.PLUGIN, "hooks", "phi-outbound-guard.js");
const FLAG = "ASSIST_PLUGIN_COMPLIANCE_OPT_OUT";

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MRN = "MRN-1234567";
const MRN_DIGITS = "1234567";
const SSN = "123-45-6789";
const MARKER = "PAYLOAD-MARKER-3c9a";

const BASE_PROFILE = {
  phi_patterns: [{ name: "mrn", pattern: "MRN[-: ]?\\d{6,10}" }, "\\b\\d{3}-\\d{2}-\\d{4}\\b"],
  data_classes: { PHI: ["data/patients*.csv"] },
};
const GITHUB_SYSTEM = { name: "github", hosts: ["github.com"] };
const MODEL_SYSTEM = { name: "model-provider", hosts: ["api.anthropic.com"] };
const GITHUB_BAA = { system: "github", identifier: "BAA-2026-020", counterparty: "Example Host Inc.", date: "2026-04-15" };
const MODEL_BAA = { system: "model-provider", identifier: "BAA-2026-014", counterparty: "Example Provider Inc.", date: "2026-03-01" };

function profileWith(extra) {
  return Object.assign({}, JSON.parse(JSON.stringify(BASE_PROFILE)), extra || {});
}

function writeFile(root, relative, text) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof text === "string" ? text : JSON.stringify(text));
  return file;
}

// options: {profile: object | string | null (absent), settings: object | string, localSettings: object | string}.
// An undefined profile writes BASE_PROFILE.
function makeRoot(options) {
  const opts = options || {};
  const root = fx.tempRoot("phi-guard-");
  if (opts.profile !== null) writeFile(root, ".agent/governance/profile.json", opts.profile === undefined ? BASE_PROFILE : opts.profile);
  if (opts.settings !== undefined) writeFile(root, ".claude/settings.json", opts.settings);
  if (opts.localSettings !== undefined) writeFile(root, ".claude/settings.local.json", opts.localSettings);
  return root;
}

function optOut(value) {
  const env = {};
  env[FLAG] = value;
  return { env: env };
}

function preToolUse(root, tool, toolInput, extra) {
  return Object.assign({ hook_event_name: "PreToolUse", session_id: "sess-phi-1", tool_name: tool, tool_input: toolInput, cwd: root }, extra || {});
}

let outboxCounter = 0;

function webFetchPrompt(root, text) {
  return preToolUse(root, "WebFetch", { url: "https://docs.example.test/page", prompt: text });
}

function webFetchUrl(root, text) {
  return preToolUse(root, "WebFetch", { url: "https://docs.example.test/page?note=" + encodeURIComponent(text), prompt: "Summarize the page" });
}

function ghBody(root, text) {
  return preToolUse(root, "Bash", { command: "gh pr comment 42 --body '" + text + "'" });
}

function ghTitle(root, text) {
  return preToolUse(root, "Bash", { command: "gh pr create --title '" + text + "' --body 'Routine change'" });
}

function ghEditTitle(root, text) {
  return preToolUse(root, "Bash", { command: "gh pr edit 42 --title '" + text + "'" });
}

function ghBodyFile(root, text) {
  outboxCounter += 1;
  const file = writeFile(root, "outbox/post-" + outboxCounter + ".txt", text);
  return preToolUse(root, "Bash", { command: "gh pr comment 42 --body-file " + file });
}

function bktText(root, text) {
  return preToolUse(root, "Bash", { command: "bkt pr comment 42 --text '" + text + "'" });
}

// The covered transports; each takes (root, text) and returns the hook input document.
const TRANSPORTS = [
  ["WebFetch prompt", webFetchPrompt],
  ["WebFetch url", webFetchUrl],
  ["gh pr comment --body", ghBody],
  ["gh pr create --title", ghTitle],
  ["gh pr edit --title", ghEditTitle],
  ["gh pr comment --body-file", ghBodyFile],
  ["bkt pr comment --text", bktText],
];

function run(doc, options) {
  return fx.runHook("phi-outbound-guard", doc, options);
}

function assertExitZero(res) {
  assert.strictEqual(res.error, undefined, "spawn error: " + (res.error && res.error.message));
  assert.strictEqual(res.status, 0, "exit status 0; stderr: " + res.stderr);
}

function isDeny(res) {
  const out = res.stdout.trim();
  if (out === "") return false;
  try {
    const parsed = JSON.parse(out);
    return !!(parsed.hookSpecificOutput && parsed.hookSpecificOutput.permissionDecision === "deny");
  } catch (err) {
    return false;
  }
}

function assertDenied(res, label) {
  assertExitZero(res);
  assert.ok(isDeny(res), (label || "expected the deny JSON") + "; got stdout: " + res.stdout);
}

function assertAllowed(res, label) {
  assertExitZero(res);
  assert.ok(!isDeny(res), (label || "expected no deny") + "; got stdout: " + res.stdout);
}

function denyRecords(root) {
  return fx.readRecords(root).filter((record) => record.decision === "deny");
}

// NFR-031: neither the denial nor the log holds a PHI value or the payload.
function assertNoPhiValue(res, root) {
  const seen = res.stdout + "\n" + fx.rawLog(root);
  [MRN, MRN_DIGITS, SSN, MARKER, "John Doe"].forEach((needle) => {
    assert.ok(seen.indexOf(needle) === -1, "found " + JSON.stringify(needle) + " in the denial or the log: " + seen.slice(0, 500));
  });
}

// ---------------------------------------------------------------------------
// FR-233 AC-1: a PHI pattern in the payload is denied, on every transport
// ---------------------------------------------------------------------------

TRANSPORTS.forEach((transport) => {
  test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | UR-069 | BR-020] " + transport[0] + ": a payload that matches a configured PHI pattern is denied, the denial is logged, and it holds no PHI value", () => {
    const root = makeRoot();
    const res = run(transport[1](root, MARKER + " patient record " + MRN + " is attached"));
    assertDenied(res);
    assert.ok(denyRecords(root).length >= 1, "the denial is logged: " + JSON.stringify(fx.readRecords(root)));
    assertNoPhiValue(res, root);
  });
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | UR-069] the post body, not only the title, is judged: a clean title with a PHI body is denied", () => {
  const root = makeRoot();
  const res = run(preToolUse(root, "Bash", { command: "gh pr create --title 'Routine change' --body 'Patient " + MRN + " was admitted'" }));
  assertDenied(res);
  assertNoPhiValue(res, root);
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | UR-069] the title is judged: a PHI title with a clean body is denied", () => {
  const root = makeRoot();
  const res = run(preToolUse(root, "Bash", { command: "gh pr create --title 'Fix for " + MRN + "' --body 'Routine change'" }));
  assertDenied(res);
  assertNoPhiValue(res, root);
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | UR-069] the denial names the rule or pattern and the class, never the value", () => {
  const root = makeRoot();
  const res = run(ghBody(root, "see " + MRN));
  assertDenied(res);
  const seen = (res.stdout + fx.rawLog(root)).toLowerCase();
  assert.ok(seen.indexOf("mrn") !== -1 || seen.indexOf("phi-outbound") !== -1, "the denial or the log names the pattern: " + res.stdout);
  assert.ok((res.stdout + fx.rawLog(root)).indexOf(MRN) === -1);
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | UR-069] an unnamed pattern in the profile is enforced too", () => {
  const root = makeRoot();
  const res = run(ghBody(root, "SSN on file " + SSN));
  assertDenied(res);
  assertNoPhiValue(res, root);
});

[
  ["lower case", "mrn:1234567 was seen"],
  ["upper case", "MRN 1234567 was seen"],
  ["no separator", "mrn1234567 was seen"],
  ["the shortest match (6 digits)", "MRN-123456 was seen"],
  ["the longest match (10 digits)", "MRN-1234567890 was seen"],
].forEach((row) => {
  test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | UR-069] the pattern matches case-insensitively and at its boundaries (" + row[0] + ")", () => {
    // Boundary input space for MRN[-: ]?\d{6,10}.
    const root = makeRoot();
    assertDenied(run(ghBody(root, row[1])));
  });
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | UR-069] a body file under a PHI-tagged path is denied even when its text matches no pattern", () => {
  const root = makeRoot();
  const file = writeFile(root, "data/patients-2026.csv", "name,visit\nJane,2026-01-01\n");
  const res = run(preToolUse(root, "Bash", { command: "gh pr comment 42 --body-file " + file }));
  assertDenied(res);
  assert.ok(res.stdout.indexOf("Jane") === -1);
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | UR-069] the denial is logged as a decision record with the tool name and a rule id, and the log still verifies", () => {
  const root = makeRoot();
  fx.writeChain(root, [2]);
  const res = run(ghBody(root, "see " + MRN));
  assertDenied(res);
  const denies = denyRecords(root);
  assert.strictEqual(denies.length, 1, JSON.stringify(fx.readRecords(root)));
  assert.strictEqual(typeof denies[0].rule_id, "string");
  assert.ok(denies[0].rule_id.length > 0);
  assert.strictEqual(denies[0].agent_type, "main-session");
  assert.strictEqual(fx.auditChain.verify(fx.auditChain.logPath(root), { root: root }).ok, true);
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | UR-069] a subagent's post is denied and the record names the subagent", () => {
  const root = makeRoot();
  const doc = ghBody(root, "see " + MRN);
  doc.agent_type = "developer";
  doc.agent_id = "agent-dev-5";
  assertDenied(run(doc));
  const denies = denyRecords(root);
  assert.strictEqual(denies.length, 1);
  assert.strictEqual(denies[0].agent_id, "agent-dev-5");
});

// ---------------------------------------------------------------------------
// FR-233 AC-2: a clean payload is allowed
// ---------------------------------------------------------------------------

TRANSPORTS.forEach((transport) => {
  test("[AC-2 | PHI outbound guard | spec-hooks-compliance | FR-233 | UR-069] " + transport[0] + ": a payload that matches no pattern and names no PHI-tagged path is allowed, and nothing is denied in the log", () => {
    const root = makeRoot();
    const res = run(transport[1](root, "Looks good after the rename"));
    assertAllowed(res);
    assert.strictEqual(denyRecords(root).length, 0);
  });
});

[
  ["a 5-digit number after MRN (one digit short of the pattern)", "MRN-12345 is not a record number"],
  ["a number with no MRN prefix", "order 1234567 shipped"],
  ["a date", "released 2026-11-06"],
  ["a version", "bump to 1.12.0"],
  ["an empty body", ""],
].forEach((row) => {
  test("[AC-2 | PHI outbound guard | spec-hooks-compliance | FR-233] near-miss input is allowed (" + row[0] + ")", () => {
    // Boundary and null/empty input space.
    const root = makeRoot();
    assertAllowed(run(ghBody(root, row[1])));
  });
});

test("[AC-2 | PHI outbound guard | spec-hooks-compliance | FR-233] a body file outside the PHI-tagged globs is allowed", () => {
  const root = makeRoot();
  const file = writeFile(root, "data/notes.txt", "Routine notes");
  assertAllowed(run(preToolUse(root, "Bash", { command: "gh pr comment 42 --body-file " + file })));
  const near = writeFile(root, "data/patients.csv.bak", "Routine notes");
  assertAllowed(run(preToolUse(root, "Bash", { command: "gh pr comment 42 --body-file " + near })));
});

["ls", "git status", "echo MRN-1234567", "gh pr view 42", "cat data/patients.csv"].forEach((command) => {
  test("[AC-2 | PHI outbound guard | spec-hooks-compliance | FR-233] `" + command + "` is not a post and is not judged", () => {
    const root = makeRoot();
    assertAllowed(run(preToolUse(root, "Bash", { command: command })));
  });
});

test("[AC-2 | PHI outbound guard | spec-hooks-compliance | FR-233] a Read call is not judged", () => {
  const root = makeRoot();
  assertAllowed(run(preToolUse(root, "Read", { file_path: path.join(root, "data", "patients.csv") })));
});

// Null, empty, and type-mismatch input space: the hook exits 0 and prints nothing or one JSON document.
[
  ["tool_input absent", () => ({ hook_event_name: "PreToolUse", tool_name: "WebFetch" })],
  ["tool_input null", (root) => preToolUse(root, "WebFetch", null)],
  ["url a number and prompt null", (root) => preToolUse(root, "WebFetch", { url: 42, prompt: null })],
  ["command an object", (root) => preToolUse(root, "Bash", { command: { a: 1 } })],
  ["command empty", (root) => preToolUse(root, "Bash", { command: "" })],
].forEach((row) => {
  test("[AC-2 | PHI outbound guard | spec-hooks-compliance | FR-233 | NFR-028] odd input (" + row[0] + ") exits 0 and prints nothing or one JSON document", () => {
    const root = makeRoot();
    const res = run(row[1](root));
    assertExitZero(res);
    if (res.stdout.trim() !== "") JSON.parse(res.stdout);
  });
});

// ---------------------------------------------------------------------------
// HIPAA profile state (FR-233: while the HIPAA profile is enforced)
// ---------------------------------------------------------------------------

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | FR-243] default: with no committed settings file the HIPAA profile is enforced and a PHI post is denied", () => {
  const root = makeRoot();
  assert.ok(!fs.existsSync(path.join(root, ".claude")));
  assertDenied(run(ghBody(root, "see " + MRN)));
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | FR-243] the committed flag `hipaa` opts HIPAA out: the guard allows a post it would deny", () => {
  const root = makeRoot({ settings: optOut("hipaa") });
  assertAllowed(run(ghBody(root, "see " + MRN)));
  assert.strictEqual(denyRecords(root).length, 0);
});

["soc2", "ferpa", "soc2,ferpa", "ferp"].forEach((value) => {
  test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | FR-243] a committed opt-out of other profiles or a typo (`" + value + "`) leaves HIPAA enforced", () => {
    const root = makeRoot({ settings: optOut(value) });
    assertDenied(run(ghBody(root, "see " + MRN)));
  });
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | FR-243] a HIPAA opt-out only in settings.local.json is ignored, even with the same opt-out in the process environment", () => {
  const root = makeRoot({ localSettings: optOut("hipaa") });
  const res = run(ghBody(root, "see " + MRN), { env: { [FLAG]: "hipaa,ferpa,soc2" } });
  assertDenied(res, "a local-only flag must not turn the guard off");
});

// ---------------------------------------------------------------------------
// NFR-028: absent and malformed profile.json
// ---------------------------------------------------------------------------

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | NFR-028] an absent profile.json runs log-only: a PHI-looking post is allowed and nothing is denied", () => {
  const root = makeRoot({ profile: null });
  assert.ok(!fs.existsSync(path.join(root, ".agent", "governance", "profile.json")));
  TRANSPORTS.forEach((transport) => {
    assertAllowed(run(transport[1](root, "see " + MRN)), transport[0]);
  });
  assert.strictEqual(denyRecords(root).length, 0);
});

const MALFORMED_PROFILES = [
  ["text that is not JSON", "{ not json"],
  ["an empty file", ""],
  ["a JSON array", "[]"],
  ["a JSON string", '"text"'],
  ["data_classes of the wrong shape", { data_classes: 5 }],
  ["phi_patterns that is not a list", { phi_patterns: "MRN" }],
  ["a PHI pattern that does not compile", { phi_patterns: ["("] }],
  ["a PHI pattern that matches the empty string", { phi_patterns: ["x*"] }],
  ["a PHI pattern object with no pattern", { phi_patterns: [{ name: "mrn" }] }],
];

MALFORMED_PROFILES.forEach((row) => {
  test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | NFR-028 | BR-020] a malformed profile.json (" + row[0] + ") under an enforced HIPAA profile denies a covered call, even a clean one", () => {
    const root = makeRoot({ profile: row[1] });
    assertDenied(run(webFetchPrompt(root, "Summarize the page")), "WebFetch");
    assertDenied(run(ghBody(root, "Looks good")), "gh pr comment");
    assertDenied(run(bktText(root, "Looks good")), "bkt pr comment");
  });
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | NFR-028] a profile.json that cannot be read (it is a directory) denies a covered call", () => {
  const root = makeRoot({ profile: null });
  fs.mkdirSync(path.join(root, ".agent", "governance", "profile.json"), { recursive: true });
  assertDenied(run(ghBody(root, "Looks good")));
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | NFR-028] a malformed profile.json still allows `ls`, git status, and a Read", () => {
  const root = makeRoot({ profile: "{ not json" });
  assertAllowed(run(preToolUse(root, "Bash", { command: "ls" })));
  assertAllowed(run(preToolUse(root, "Bash", { command: "git status" })));
  assertAllowed(run(preToolUse(root, "Read", { file_path: path.join(root, "README.md") })));
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | NFR-028] the denial for a malformed profile.json holds until the file is fixed, then the call passes", () => {
  const root = makeRoot({ profile: "{ not json" });
  const doc = ghBody(root, "Looks good");
  assertDenied(run(doc));
  assertDenied(run(doc));
  writeFile(root, ".agent/governance/profile.json", BASE_PROFILE);
  assertAllowed(run(doc));
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | NFR-028 | FR-243] a malformed profile.json does not deny once HIPAA is opted out in the committed settings", () => {
  const root = makeRoot({ profile: "{ not json", settings: optOut("hipaa") });
  assertAllowed(run(ghBody(root, "Looks good")));
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | NFR-028 | NFR-031] the denial for a malformed profile.json repeats no file text", () => {
  const root = makeRoot({ profile: '{ "phi_patterns": ["SECRET-PROFILE-TEXT-4"], broken' });
  const res = run(ghBody(root, "Looks good"));
  assertDenied(res);
  assert.ok((res.stdout + fx.rawLog(root)).indexOf("SECRET-PROFILE-TEXT-4") === -1);
});

[
  ["empty stdin", ""],
  ["text that is not JSON", "this is not json"],
  ["an unterminated object", "{"],
  ["JSON null", "null"],
].forEach((row) => {
  test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | NFR-028] unreadable stdin (" + row[0] + ") lets the call proceed and exits 0", () => {
    assertAllowed(run(row[1]));
  });
});

// ---------------------------------------------------------------------------
// NFR-028: fail closed on an evaluation error in the guarded class
// ---------------------------------------------------------------------------

// A preload script makes every read of a path that ends in profile.json throw, as an I/O fault inside the evaluation.
const FAULT_PRELOAD_SOURCE = [
  '"use strict";',
  'const fs = require("fs");',
  "const failing = function (file) { return typeof file === 'string' && /profile\\.json$/.test(file) && process.env.PHI_FAULT_MODE === 'profile-read'; };",
  "const readFileSync = fs.readFileSync;",
  "fs.readFileSync = function (file) { if (failing(file)) { const err = new Error('fault: read failed'); err.code = 'EIO'; throw err; } return readFileSync.apply(this, arguments); };",
  "const openSync = fs.openSync;",
  "fs.openSync = function (file) { if (failing(file)) { const err = new Error('fault: open failed'); err.code = 'EIO'; throw err; } return openSync.apply(this, arguments); };",
  "",
].join("\n");

let preloadPath = null;

function faultPreload() {
  if (!preloadPath) {
    preloadPath = path.join(fx.tempDir("phi-guard-preload-"), "fault-profile-read.js");
    fs.writeFileSync(preloadPath, FAULT_PRELOAD_SOURCE);
  }
  return preloadPath;
}

function runWithFault(doc, mode) {
  return childProcess.spawnSync(process.execPath, ["--require", faultPreload(), ENTRY], {
    cwd: fx.tempDir("phi-guard-cwd-"),
    env: fx.cleanEnv({
      CLAUDE_PLUGIN_DATA: fx.tempDir("phi-guard-data-"),
      CLAUDE_CONFIG_DIR: fx.tempDir("phi-guard-claude-"),
      PHI_FAULT_MODE: mode,
    }),
    input: JSON.stringify(doc),
    encoding: "utf8",
    timeout: 60000,
  });
}

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | NFR-028] baseline: the preload script alone changes nothing (a clean post is allowed)", () => {
  const root = makeRoot();
  assertAllowed(runWithFault(ghBody(root, "Looks good after the rename"), "none"));
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | NFR-028] an I/O error while reading the configuration denies a WebFetch call and the hook exits 0", () => {
  const root = makeRoot();
  const res = runWithFault(webFetchPrompt(root, "Summarize the page"), "profile-read");
  assertDenied(res, "expected a fail-closed deny");
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | NFR-028] an I/O error while reading the configuration denies a gh pr post and repeats no payload text", () => {
  const root = makeRoot();
  const res = runWithFault(ghBody(root, MARKER + " Looks good"), "profile-read");
  assertDenied(res, "expected a fail-closed deny");
  assert.ok(res.stdout.indexOf(MARKER) === -1);
});

["ls", "git status", "echo hello", "gh pr view 42"].forEach((command) => {
  test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | NFR-028] after an evaluation error, `" + command + "` (outside the guarded class) is still allowed", () => {
    const root = makeRoot();
    assertAllowed(runWithFault(preToolUse(root, "Bash", { command: command }), "profile-read"));
  });
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | NFR-028] after an evaluation error, a Read call (outside the guarded class) is still allowed", () => {
  const root = makeRoot();
  assertAllowed(runWithFault(preToolUse(root, "Read", { file_path: path.join(root, "README.md") }), "profile-read"));
});

test("[AC-1 | PHI outbound guard | spec-hooks-compliance | FR-233 | NFR-028] the hook never exits non-zero to block: every denial above is the deny JSON with exit 0", () => {
  const root = makeRoot();
  const res = runWithFault(ghBody(root, "Looks good"), "profile-read");
  assert.strictEqual(res.status, 0, "exit status: " + res.status + "; stderr: " + res.stderr);
  assert.ok(isDeny(res));
});

// ---------------------------------------------------------------------------
// FR-234: the BAA rule
// ---------------------------------------------------------------------------

function baaRoot(systems, references, extra) {
  return makeRoot({ profile: profileWith(Object.assign({ external_systems: systems, baa_references: references }, extra || {})) });
}

test("[AC-2 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | UR-069 | BR-020] a gh pr post to a listed system with no BAA reference is denied, and the denial names the rule and the system, not the payload", () => {
  const root = baaRoot([GITHUB_SYSTEM], []);
  const res = run(ghBody(root, MARKER + " Looks good after the rename"));
  assertDenied(res);
  const seen = res.stdout + fx.rawLog(root);
  assert.ok(seen.indexOf("phi-outbound.baa") !== -1 || seen.toLowerCase().indexOf("baa") !== -1, "the denial or the log names the BAA rule: " + res.stdout);
  assert.ok(seen.toLowerCase().indexOf("github") !== -1, "the denial or the log names the system: " + res.stdout);
  assert.ok(seen.indexOf(MARKER) === -1, "the denial repeats the payload");
  assert.ok(denyRecords(root).length >= 1, "the denial is logged");
});

test("[AC-1 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | UR-069] the same post is allowed once the BAA reference is recorded", () => {
  const root = baaRoot([GITHUB_SYSTEM], [GITHUB_BAA]);
  assertAllowed(run(ghBody(root, "Looks good after the rename")));
});

test("[AC-1 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | UR-069] a WebFetch to the model provider is allowed with its BAA recorded", () => {
  const root = baaRoot([GITHUB_SYSTEM, MODEL_SYSTEM], [MODEL_BAA]);
  assertAllowed(run(preToolUse(root, "WebFetch", { url: "https://api.anthropic.com/v1/models", prompt: "List the models" })));
});

[
  ["the listed host", "https://github.com/org/repo"],
  ["a subdomain of the listed host", "https://api.github.com/repos/org/repo"],
  ["the host with a trailing dot", "https://github.com./org/repo"],
  ["the host in upper case", "https://GITHUB.COM/org/repo"],
].forEach((row) => {
  test("[AC-2 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | UR-069] a WebFetch to " + row[0] + " of a system with no BAA reference is denied", () => {
    const root = baaRoot([GITHUB_SYSTEM, MODEL_SYSTEM], [MODEL_BAA]);
    const res = run(preToolUse(root, "WebFetch", { url: row[1], prompt: "Summarize" }));
    assertDenied(res);
    assert.ok(res.stdout.indexOf("secret-path-9") === -1);
  });
});

test("[AC-2 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | NFR-031] the denial for a missing BAA names the system and repeats no URL path", () => {
  const root = baaRoot([GITHUB_SYSTEM], []);
  const res = run(preToolUse(root, "WebFetch", { url: "https://github.com/secret-path-9/page?token=abc123", prompt: "Summarize" }));
  assertDenied(res);
  const seen = res.stdout + fx.rawLog(root);
  assert.ok(seen.indexOf("secret-path-9") === -1, "the URL path reached the denial or the log");
  assert.ok(seen.indexOf("abc123") === -1, "a URL secret reached the denial or the log");
});

[
  ["a host that no listed system names", "https://docs.example.test/page"],
  ["a host that only ends like a listed host", "https://notgithub.com/page"],
  ["a listed host name used as a path segment", "https://docs.example.test/github.com/page"],
].forEach((row) => {
  test("[AC-1 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | UR-069] a WebFetch to " + row[0] + " is not judged by the BAA rule", () => {
    const root = baaRoot([GITHUB_SYSTEM], []);
    assertAllowed(run(preToolUse(root, "WebFetch", { url: row[1], prompt: "Summarize" })));
  });
});

test("[AC-2 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | UR-069] a reference for another system does not cover the system of the call", () => {
  const root = baaRoot([GITHUB_SYSTEM, MODEL_SYSTEM], [MODEL_BAA]);
  assertDenied(run(ghBody(root, "Looks good after the rename")));
});

test("[AC-2 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | UR-069] the PHI check still runs ahead of the BAA rule: a PHI post to a system with a BAA is denied", () => {
  const root = baaRoot([GITHUB_SYSTEM], [GITHUB_BAA]);
  assertDenied(run(ghBody(root, "see " + MRN)));
});

test("[AC-2 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | FR-243] while HIPAA is opted out the BAA rule does not run", () => {
  const root = makeRoot({ profile: profileWith({ external_systems: [GITHUB_SYSTEM], baa_references: [] }), settings: optOut("hipaa") });
  assertAllowed(run(ghBody(root, "Looks good after the rename")));
});

test("[AC-2 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | FR-243] a HIPAA opt-out only in settings.local.json does not switch the BAA rule off", () => {
  const root = makeRoot({ profile: profileWith({ external_systems: [GITHUB_SYSTEM], baa_references: [] }), localSettings: optOut("hipaa") });
  assertDenied(run(ghBody(root, "Looks good after the rename"), { env: { [FLAG]: "hipaa" } }));
});

test("[AC-1 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | NFR-028] a project with no profile.json runs the BAA rule log-only: nothing is denied", () => {
  const root = makeRoot({ profile: null });
  assertAllowed(run(ghBody(root, "Looks good after the rename")));
});

[
  ["a reference with no counterparty", Object.assign({}, GITHUB_BAA, { counterparty: undefined })],
  ["a reference with a date that is not a real calendar date", Object.assign({}, GITHUB_BAA, { date: "2026-02-30" })],
  ["a reference with a placeholder identifier", Object.assign({}, GITHUB_BAA, { identifier: "tbd" })],
].forEach((row) => {
  test("[AC-2 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | NFR-028] " + row[0] + " makes the configuration unusable: every covered call is denied", () => {
    const root = baaRoot([GITHUB_SYSTEM], [JSON.parse(JSON.stringify(row[1]))]);
    assertDenied(run(ghBody(root, "Looks good after the rename")));
    assertDenied(run(webFetchPrompt(root, "Summarize the page")));
  });
});

test("[AC-1 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | NFR-031] the plugin checks that a reference exists and never reads the agreement text: text in a reference is never repeated", () => {
  const reference = Object.assign({ agreement_text: "AGREEMENT-TEXT-MARKER-8 the parties agree" }, GITHUB_BAA);
  const root = baaRoot([GITHUB_SYSTEM, MODEL_SYSTEM], [reference]);
  const res = run(preToolUse(root, "WebFetch", { url: "https://api.anthropic.com/v1", prompt: "List" }));
  assertExitZero(res);
  assert.ok((res.stdout + fx.rawLog(root)).indexOf("AGREEMENT-TEXT-MARKER-8") === -1);
});
