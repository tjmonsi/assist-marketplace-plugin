// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the governance profile reader and the data-class tags (harness-governance Tranche 3,
// Step 30): plugins/assist-plugin/hooks/lib/data-class.js, with hook-level checks through the data-access-log hook, the
// PHI outbound guard, and the session-start check.
//
// Sources: docs/requirements/FR-NFR-harness-governance.md section 2.18 (FR-231: Path matches a tag, Flag absent,
// Malformed profile.json), section 2.30 (FR-243: Opt-out in committed settings, Personal settings cannot disable),
// section 2.31 (FR-244: Disablement logged), section 2.21 (FR-234: BAA recorded, BAA missing), section 3.2 (NFR-028 fail
// closed on a malformed profile.json; an absent profile.json runs log-only); specs/spec-hooks-compliance.md
// (Requirements: Profile state from the committed settings file, Data-class tagging, BAA reference and profile readiness,
// Profile disablement is logged and recorded); plugins/assist-plugin/rules/assist-plugin-rule.md, "Governance profiles"
// and "Outbound data guards" (the flag name, its value format, the documented keys of profile.json, the BAA rule).
// Task plan: docs/task-plans/task-plan-harness-governance-20261028-0759.md, Steps 23, 28, and 30.
//
// Traceability format: [AC-N | Requirement | spec-hooks-compliance | FR-nnn | UR-nnn | BR-020 | NFR-028]. The spec
// carries no SPEC-NNN id, so it is cited by file name. AC-N is the position of the Scenario inside its Requirement:
//   Profile state from the committed settings file: AC-1 Flag absent, AC-2 Opt-out in committed settings, AC-3 Personal
//     settings cannot disable
//   Data-class tagging: AC-1 Path matches a tag, AC-2 Absent configuration runs log-only, AC-3 Malformed configuration
//     denies
//   BAA reference and profile readiness: AC-1 BAA recorded, AC-2 BAA missing
//   Profile disablement is logged and recorded: AC-1 Disablement logged
//
// Public interface used (the header contract of lib/data-class.js; the library never reads process.env):
//   FLAG_NAME                     the env variable ASSIST_PLUGIN_COMPLIANCE_OPT_OUT, a comma-separated list of the
//                                 profiles to turn OFF (soc2, hipaa, ferpa), read from <root>/.claude/settings.json
//   profileState({root})          -> {soc2, hipaa, ferpa, optedOut, unknown, problem}; true means enforced
//   localOverride({root})         -> {ignored, problem}; the profiles that only .claude/settings.local.json names
//   loadProfile({root})           -> {status: "absent" | "valid" | "malformed", profile, problem}
//   classify(file, {root})        -> "student-record" | "PHI" | "none" | "untagged"
//   deniesTaggedOps({root})       -> true when a tagged-path control must deny (profile.json malformed, HIPAA or FERPA on)
//   baaSettings(loaded)           -> {status: "ok", systems, references} | {status: "invalid", problem}
//   hasBaa(settings, name), systemsWithoutBaa(settings)
// Hooks: hooks/data-access-log.js and hooks/phi-outbound-guard.js (PreToolUse), hooks/health-check.js --session-start.
//   Session start appends one "profile-disabled" event (field `profile`; the log adds `ts`) for each profile the committed
//   settings turn off, once per project while it stays off. The dedupe is kept in health-state.json in the plugin data
//   directory, so the same data directory must serve the sessions of one project.
//
// Every project root is a temp directory with a .git directory; every data directory is a temp directory.
//
// Run: node --test tests/hooks/data-class.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const PLUGIN = fx.PLUGIN;
const dataClass = require(path.join(PLUGIN, "hooks", "lib", "data-class.js"));
const FLAG = dataClass.FLAG_NAME;

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TAGS = { data_classes: { "student-record": ["records/**"], PHI: ["data/patients*.csv"] } };

function writeFile(root, relative, text) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof text === "string" ? text : JSON.stringify(text));
  return file;
}

// options: {profile: object | string | null (absent), settings: object | string, localSettings: object | string}.
// An undefined profile writes TAGS.
function makeRoot(options) {
  const opts = options || {};
  const root = fx.tempRoot("data-class-");
  if (opts.profile !== null) writeFile(root, ".agent/governance/profile.json", opts.profile === undefined ? TAGS : opts.profile);
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
  return Object.assign({ hook_event_name: "PreToolUse", session_id: "sess-dc-1", tool_name: tool, tool_input: toolInput, cwd: root }, extra || {});
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

function accessRecords(root) {
  return fx.readRecords(root).filter((record) => record.operation !== undefined);
}

// Runs fn with process.env[FLAG] set to `value` (undefined removes it), then restores the previous value.
function withProcessEnv(value, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, FLAG);
  const previous = process.env[FLAG];
  if (value === undefined) delete process.env[FLAG];
  else process.env[FLAG] = value;
  try {
    return fn();
  } finally {
    if (had) process.env[FLAG] = previous;
    else delete process.env[FLAG];
  }
}

function allEnforced(state) {
  return state.soc2 === true && state.hipaa === true && state.ferpa === true;
}

// ---------------------------------------------------------------------------
// FR-231 / FR-243: the profile flag is read from the committed settings file
// ---------------------------------------------------------------------------

test("[AC-1 | Profile state from the committed settings file | spec-hooks-compliance | FR-231 | UR-068 | UR-069 | BR-020] the flag name is ASSIST_PLUGIN_COMPLIANCE_OPT_OUT", () => {
  assert.strictEqual(FLAG, "ASSIST_PLUGIN_COMPLIANCE_OPT_OUT");
});

test("[AC-1 | Profile state from the committed settings file | spec-hooks-compliance | FR-231 | UR-068 | UR-069 | BR-020] with no settings file at all SOC 2, HIPAA, and FERPA are all enforced", () => {
  const root = makeRoot();
  assert.ok(!fs.existsSync(path.join(root, ".claude")), "set-up: no .claude directory");
  const state = withProcessEnv(undefined, () => dataClass.profileState({ root: root }));
  assert.ok(allEnforced(state), JSON.stringify(state));
  assert.deepStrictEqual(state.optedOut, []);
});

[
  ["an empty object", {}],
  ["an env block with other variables only", { env: { OTHER: "x" } }],
  ["an empty env block", { env: {} }],
  ["an empty flag", optOut("")],
  ["a flag of only spaces", optOut("   ")],
  ["a flag of only commas", optOut(",,,")],
  ["a typo that names no profile", optOut("ferp")],
  ["a word that names no profile", optOut("none")],
].forEach((row) => {
  test("[AC-1 | Profile state from the committed settings file | spec-hooks-compliance | FR-231 | UR-068 | BR-020] flag absent or empty (" + row[0] + "): all three profiles stay enforced", () => {
    // Null/empty and typo input space: a mistake never switches a control off.
    const root = makeRoot({ settings: row[1] });
    const state = withProcessEnv(undefined, () => dataClass.profileState({ root: root }));
    assert.ok(allEnforced(state), JSON.stringify(state));
  });
});

[
  ["ferpa", { ferpa: false, hipaa: true, soc2: true }],
  ["hipaa", { ferpa: true, hipaa: false, soc2: true }],
  ["soc2", { ferpa: true, hipaa: true, soc2: false }],
  [" FERPA ", { ferpa: false, hipaa: true, soc2: true }],
  ["Hipaa,SOC2", { ferpa: true, hipaa: false, soc2: false }],
  ["ferpa, hipaa , soc2", { ferpa: false, hipaa: false, soc2: false }],
].forEach((row) => {
  test("[AC-2 | Profile state from the committed settings file | spec-hooks-compliance | FR-243 | UR-075 | BR-020] the committed flag `" + row[0] + "` turns off exactly the profiles it names", () => {
    const root = makeRoot({ settings: optOut(row[0]) });
    const state = withProcessEnv(undefined, () => dataClass.profileState({ root: root }));
    assert.strictEqual(state.ferpa, row[1].ferpa, JSON.stringify(state));
    assert.strictEqual(state.hipaa, row[1].hipaa, JSON.stringify(state));
    assert.strictEqual(state.soc2, row[1].soc2, JSON.stringify(state));
  });
});

test("[AC-2 | Profile state from the committed settings file | spec-hooks-compliance | FR-243 | UR-075] opting FERPA out leaves SOC 2 and HIPAA enforced and lists ferpa as opted out", () => {
  const root = makeRoot({ settings: optOut("ferpa") });
  const state = dataClass.profileState({ root: root });
  assert.strictEqual(state.ferpa, false);
  assert.strictEqual(state.soc2, true);
  assert.strictEqual(state.hipaa, true);
  assert.deepStrictEqual(state.optedOut, ["ferpa"]);
});

test("[AC-2 | Profile state from the committed settings file | spec-hooks-compliance | FR-243 | UR-075] a token that names no profile is reported as unknown and turns nothing off", () => {
  const root = makeRoot({ settings: optOut("ferpa,bogus") });
  const state = dataClass.profileState({ root: root });
  assert.strictEqual(state.ferpa, false);
  assert.strictEqual(state.hipaa, true);
  assert.ok(state.unknown.indexOf("bogus") !== -1, JSON.stringify(state));
});

[
  ["settings.json that is not JSON", "{ not json", "settings-malformed"],
  ["an env block that is not an object", { env: "text" }, "settings-env-invalid"],
  ["a flag that is not a string", { env: { ASSIST_PLUGIN_COMPLIANCE_OPT_OUT: 5 } }, "flag-not-string"],
].forEach((row) => {
  test("[AC-1 | Profile state from the committed settings file | spec-hooks-compliance | FR-231 | NFR-028] " + row[0] + ": every profile stays enforced and the problem is named", () => {
    // Invalid input space: what the reader cannot read it leaves enforced.
    const root = makeRoot({ settings: row[1] });
    const state = dataClass.profileState({ root: root });
    assert.ok(allEnforced(state), JSON.stringify(state));
    assert.strictEqual(state.problem, row[2]);
  });
});

// ---------------------------------------------------------------------------
// FR-243: a flag only in settings.local.json does not disable a profile; the merged environment is ignored
// ---------------------------------------------------------------------------

test("[AC-3 | Profile state from the committed settings file | spec-hooks-compliance | FR-243 | UR-075 | BR-020] a flag set only in .claude/settings.local.json does not disable the HIPAA profile, and the health report can name it as ignored", () => {
  const root = makeRoot({ localSettings: optOut("hipaa") });
  const state = withProcessEnv(undefined, () => dataClass.profileState({ root: root }));
  assert.ok(allEnforced(state), JSON.stringify(state));
  const local = dataClass.localOverride({ root: root });
  assert.ok(local.ignored.indexOf("hipaa") !== -1, "the ignored personal flag is named: " + JSON.stringify(local));
});

test("[AC-3 | Profile state from the committed settings file | spec-hooks-compliance | FR-243 | UR-075 | BR-020] a differing process environment value does not change the result: the merged environment is ignored", () => {
  // The merged environment carries the local override. Here process.env opts all three profiles out, as a merged read of
  // settings.local.json would; the committed file opts nothing out, so a hook that read the merged environment would
  // switch all three profiles off. The result must still be all enforced.
  const root = makeRoot({ localSettings: optOut("ferpa,hipaa,soc2") });
  const state = withProcessEnv("ferpa,hipaa,soc2", () => dataClass.profileState({ root: root }));
  assert.ok(allEnforced(state), JSON.stringify(state));
});

test("[AC-3 | Profile state from the committed settings file | spec-hooks-compliance | FR-243 | UR-075] the committed file decides when the process environment says otherwise in either direction", () => {
  const committedOff = makeRoot({ settings: optOut("ferpa") });
  const offState = withProcessEnv("hipaa", () => dataClass.profileState({ root: committedOff }));
  assert.strictEqual(offState.ferpa, false, "the committed opt-out holds: " + JSON.stringify(offState));
  assert.strictEqual(offState.hipaa, true, "the process environment cannot add an opt-out: " + JSON.stringify(offState));
  const committedNone = makeRoot({ settings: {} });
  const noneState = withProcessEnv("ferpa", () => dataClass.profileState({ root: committedNone }));
  assert.ok(allEnforced(noneState), JSON.stringify(noneState));
});

test("[AC-3 | Profile state from the committed settings file | spec-hooks-compliance | FR-243 | UR-075] a local flag cannot add to a committed opt-out of another profile", () => {
  const root = makeRoot({ settings: optOut("soc2"), localSettings: optOut("ferpa") });
  const state = dataClass.profileState({ root: root });
  assert.strictEqual(state.soc2, false);
  assert.strictEqual(state.ferpa, true);
  assert.strictEqual(state.hipaa, true);
});

test("[AC-3 | Profile state from the committed settings file | spec-hooks-compliance | FR-243 | UR-075] a hook ignores a local-only opt-out and a differing process environment: the access is still logged", () => {
  // Hook-level check of the same rule: data-access-log logs a student-record access while FERPA is enforced.
  const root = makeRoot({ localSettings: optOut("ferpa") });
  const res = fx.runHook("data-access-log", preToolUse(root, "Read", { file_path: path.join(root, "records", "grades.csv") }), {
    env: { [FLAG]: "ferpa,hipaa,soc2" },
  });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(accessRecords(root).length, 1, JSON.stringify(fx.readRecords(root)));
});

test("[AC-3 | Profile state from the committed settings file | spec-hooks-compliance | FR-243 | UR-075] a hook honors the committed opt-out: no student-record access is logged, and a PHI access still is", () => {
  const root = makeRoot({ settings: optOut("ferpa") });
  fx.runHook("data-access-log", preToolUse(root, "Read", { file_path: path.join(root, "records", "grades.csv") }));
  assert.strictEqual(accessRecords(root).length, 0, "FERPA is off, so a student-record access is not logged");
  fx.runHook("data-access-log", preToolUse(root, "Read", { file_path: path.join(root, "data", "patients.csv") }));
  const stored = accessRecords(root);
  assert.strictEqual(stored.length, 1, "HIPAA stays on, so a PHI access is logged: " + JSON.stringify(fx.readRecords(root)));
  assert.strictEqual(stored[0].data_class, "PHI");
});

test("[AC-3 | Profile state from the committed settings file | spec-hooks-compliance | FR-243 | UR-075] the plugin writes no settings file when it reads the profile state", () => {
  const root = makeRoot({ settings: optOut("ferpa"), localSettings: optOut("hipaa") });
  const settings = path.join(root, ".claude", "settings.json");
  const local = path.join(root, ".claude", "settings.local.json");
  const before = [fs.readFileSync(settings, "utf8"), fs.readFileSync(local, "utf8")];
  dataClass.profileState({ root: root });
  dataClass.localOverride({ root: root });
  fx.runHook("data-access-log", preToolUse(root, "Read", { file_path: path.join(root, "records", "grades.csv") }));
  assert.deepStrictEqual([fs.readFileSync(settings, "utf8"), fs.readFileSync(local, "utf8")], before);
});

// ---------------------------------------------------------------------------
// FR-231: data-class tags
// ---------------------------------------------------------------------------

[
  ["records/grades.csv", "student-record"],
  ["records/2026/term1/grades.csv", "student-record"],
  ["data/patients.csv", "PHI"],
  ["data/patients-2026.csv", "PHI"],
  ["src/app.js", "none"],
  ["records-old/grades.csv", "none"],
  ["data/patients.csv.bak", "none"],
  ["README.md", "none"],
].forEach((row) => {
  test("[AC-1 | Data-class tagging | spec-hooks-compliance | FR-231 | UR-068 | UR-069 | BR-020] " + row[0] + " is classified " + row[1], () => {
    const root = makeRoot();
    assert.strictEqual(dataClass.classify(row[0], { root: root }), row[1]);
    assert.strictEqual(dataClass.classify(path.join(root, row[0]), { root: root }), row[1], "an absolute path gives the same class");
  });
});

test("[AC-1 | Data-class tagging | spec-hooks-compliance | FR-231] a path that matches both classes is PHI", () => {
  const root = makeRoot({ profile: { data_classes: { "student-record": ["shared/**"], PHI: ["shared/*.csv"] } } });
  assert.strictEqual(dataClass.classify("shared/x.csv", { root: root }), "PHI");
  assert.strictEqual(dataClass.classify("shared/x.txt", { root: root }), "student-record");
});

test("[AC-1 | Data-class tagging | spec-hooks-compliance | FR-231] a file system that folds case names the same file: the tag still applies", () => {
  const root = makeRoot();
  assert.strictEqual(dataClass.classify("Records/Grades.CSV", { root: root }), "student-record");
});

[
  ["null", null],
  ["a number", 42],
  ["an object", { path: "records/grades.csv" }],
].forEach((row) => {
  test("[AC-1 | Data-class tagging | spec-hooks-compliance | FR-231 | NFR-028] a path of the wrong type (" + row[0] + ") is untagged, not an error", () => {
    // Type-mismatch input space.
    const root = makeRoot();
    let value;
    assert.doesNotThrow(() => {
      value = dataClass.classify(row[1], { root: root });
    });
    assert.strictEqual(value, "untagged");
  });
});

test("[AC-1 | Data-class tagging | spec-hooks-compliance | FR-231 | NFR-028] with no project root the class cannot be known: untagged", () => {
  assert.strictEqual(dataClass.classify("records/grades.csv", {}), "untagged");
});

// ---------------------------------------------------------------------------
// AC-2: absent profile.json runs log-only (NFR-028)
// ---------------------------------------------------------------------------

test("[AC-2 | Data-class tagging | spec-hooks-compliance | FR-231 | NFR-028] an absent profile.json: status absent, nothing tagged, and no tagged-path control denies", () => {
  const root = makeRoot({ profile: null });
  assert.ok(!fs.existsSync(path.join(root, ".agent", "governance", "profile.json")));
  const loaded = dataClass.loadProfile({ root: root });
  assert.strictEqual(loaded.status, "absent");
  assert.strictEqual(dataClass.classify("records/grades.csv", { root: root }), "none");
  assert.strictEqual(dataClass.classify("data/patients.csv", { root: root }), "none");
  assert.strictEqual(dataClass.deniesTaggedOps({ root: root }), false);
});

test("[AC-2 | Data-class tagging | spec-hooks-compliance | FR-231 | NFR-028] an absent profile.json runs log-only: the access hook never denies and logs no tagged access, and the PHI guard allows a PHI-looking post", () => {
  const root = makeRoot({ profile: null });
  const access = fx.runHook("data-access-log", preToolUse(root, "Read", { file_path: path.join(root, "records", "grades.csv") }));
  assert.strictEqual(access.status, 0, access.stderr);
  assert.ok(!isDeny(access), access.stdout);
  assert.strictEqual(accessRecords(root).length, 0, "nothing is tagged, so nothing is logged as a tagged access");
  const post = fx.runHook("phi-outbound-guard", preToolUse(root, "Bash", { command: "gh pr comment 42 --body 'MRN-1234567 is in this note'" }));
  assert.strictEqual(post.status, 0, post.stderr);
  assert.ok(!isDeny(post), post.stdout);
});

// ---------------------------------------------------------------------------
// AC-3: malformed profile.json denies the guarded operations while a profile is enforced (NFR-028)
// ---------------------------------------------------------------------------

[
  ["text that is not JSON", "{ not json"],
  ["an empty file", ""],
  ["a JSON array", "[]"],
  ["a JSON string", '"text"'],
  ["data_classes of the wrong shape", { data_classes: 5 }],
  ["data_classes naming an unknown class", { data_classes: { secret: ["x/**"] } }],
].forEach((row) => {
  test("[AC-3 | Data-class tagging | spec-hooks-compliance | FR-231 | NFR-028 | BR-020] a malformed profile.json (" + row[0] + ") is reported, leaves paths untagged, and makes the tagged-path controls deny", () => {
    const root = makeRoot({ profile: row[1] });
    const loaded = dataClass.loadProfile({ root: root });
    assert.strictEqual(loaded.status, "malformed", JSON.stringify(loaded));
    assert.strictEqual(typeof loaded.problem, "string", "a short problem code for the health check");
    assert.ok(loaded.problem.length > 0);
    assert.strictEqual(dataClass.classify("records/grades.csv", { root: root }), "untagged");
    assert.strictEqual(dataClass.deniesTaggedOps({ root: root }), true);
  });
});

test("[AC-3 | Data-class tagging | spec-hooks-compliance | FR-231 | NFR-028] a profile.json that cannot be read (it is a directory) is treated as malformed and denies", () => {
  const root = makeRoot({ profile: null });
  fs.mkdirSync(path.join(root, ".agent", "governance", "profile.json"), { recursive: true });
  assert.strictEqual(dataClass.loadProfile({ root: root }).status, "malformed");
  assert.strictEqual(dataClass.deniesTaggedOps({ root: root }), true);
});

test("[AC-3 | Data-class tagging | spec-hooks-compliance | FR-231 | NFR-028] the problem code never repeats the file text", () => {
  const root = makeRoot({ profile: '{ "phi_patterns": "SECRET-PROFILE-TEXT-9", broken' });
  const loaded = dataClass.loadProfile({ root: root });
  assert.strictEqual(loaded.status, "malformed");
  assert.ok(JSON.stringify(loaded).indexOf("SECRET-PROFILE-TEXT-9") === -1, JSON.stringify(loaded));
});

[
  ["no opt-out", undefined, true],
  ["FERPA off, HIPAA on", "ferpa", true],
  ["HIPAA off, FERPA on", "hipaa", true],
  ["SOC 2 off only", "soc2", true],
  ["FERPA and HIPAA both off", "ferpa,hipaa", false],
  ["all three off", "ferpa,hipaa,soc2", false],
].forEach((row) => {
  test("[AC-3 | Data-class tagging | spec-hooks-compliance | FR-231 | FR-243 | NFR-028] a malformed profile.json with " + row[0] + ": deniesTaggedOps is " + row[2], () => {
    const settings = row[1] === undefined ? undefined : optOut(row[1]);
    const root = makeRoot({ profile: "{ not json", settings: settings });
    assert.strictEqual(dataClass.deniesTaggedOps({ root: root }), row[2]);
  });
});

test("[AC-3 | Data-class tagging | spec-hooks-compliance | FR-231 | NFR-028] the deny lasts until the file is fixed, then tagging resumes", () => {
  const root = makeRoot({ profile: "{ not json" });
  assert.strictEqual(dataClass.deniesTaggedOps({ root: root }), true);
  writeFile(root, ".agent/governance/profile.json", TAGS);
  assert.strictEqual(dataClass.deniesTaggedOps({ root: root }), false);
  assert.strictEqual(dataClass.classify("records/grades.csv", { root: root }), "student-record");
});

test("[AC-3 | Data-class tagging | spec-hooks-compliance | FR-231 | NFR-028 | UR-069] a malformed profile.json makes the PHI outbound guard deny a covered call while HIPAA is enforced, and `ls` still passes", () => {
  const root = makeRoot({ profile: "{ not json" });
  const post = fx.runHook("phi-outbound-guard", preToolUse(root, "Bash", { command: "gh pr comment 42 --body 'Looks good'" }));
  assert.strictEqual(post.status, 0, post.stderr);
  assert.ok(isDeny(post), "expected a deny; stdout: " + post.stdout);
  const ls = fx.runHook("phi-outbound-guard", preToolUse(root, "Bash", { command: "ls" }));
  assert.ok(!isDeny(ls), ls.stdout);
});

// ---------------------------------------------------------------------------
// FR-234: BAA reference and profile readiness
// ---------------------------------------------------------------------------

const MODEL_SYSTEM = { name: "model-provider", hosts: ["api.anthropic.com"] };
const GITHUB_SYSTEM = { name: "github", hosts: ["github.com"] };
const MODEL_BAA = { system: "model-provider", identifier: "BAA-2026-014", counterparty: "Example Provider Inc.", date: "2026-03-01" };
const GITHUB_BAA = { system: "github", identifier: "BAA-2026-020", counterparty: "Example Host Inc.", date: "2026-04-15" };

function baaOf(profile) {
  const root = makeRoot({ profile: Object.assign({}, TAGS, profile) });
  return dataClass.baaSettings(dataClass.loadProfile({ root: root }));
}

test("[AC-1 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | UR-069 | BR-020] a BAA reference for the model provider reads ready: no external system lacks one", () => {
  const settings = baaOf({ external_systems: [MODEL_SYSTEM], baa_references: [MODEL_BAA] });
  assert.strictEqual(settings.status, "ok", JSON.stringify(settings));
  assert.strictEqual(dataClass.hasBaa(settings, "model-provider"), true);
  assert.deepStrictEqual(dataClass.systemsWithoutBaa(settings), []);
});

test("[AC-1 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | UR-069] every listed system with a reference reads ready, whatever the order of the two lists", () => {
  const settings = baaOf({ external_systems: [GITHUB_SYSTEM, MODEL_SYSTEM], baa_references: [MODEL_BAA, GITHUB_BAA] });
  assert.strictEqual(settings.status, "ok", JSON.stringify(settings));
  assert.deepStrictEqual(dataClass.systemsWithoutBaa(settings), []);
});

test("[AC-1 | BAA reference and profile readiness | spec-hooks-compliance | FR-234] a profile that lists no external system has nothing to cover and reads ready", () => {
  const settings = baaOf({});
  assert.strictEqual(settings.status, "ok", JSON.stringify(settings));
  assert.deepStrictEqual(dataClass.systemsWithoutBaa(settings), []);
});

test("[AC-2 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | UR-069 | BR-020] an external system with no BAA reference reads not ready and is named", () => {
  const settings = baaOf({ external_systems: [MODEL_SYSTEM, GITHUB_SYSTEM], baa_references: [MODEL_BAA] });
  assert.strictEqual(settings.status, "ok", JSON.stringify(settings));
  assert.deepStrictEqual(dataClass.systemsWithoutBaa(settings), ["github"]);
  assert.strictEqual(dataClass.hasBaa(settings, "github"), false);
  assert.strictEqual(dataClass.hasBaa(settings, "model-provider"), true);
});

test("[AC-2 | BAA reference and profile readiness | spec-hooks-compliance | FR-234] with no BAA reference at all every listed system is missing one, in list order", () => {
  const settings = baaOf({ external_systems: [GITHUB_SYSTEM, MODEL_SYSTEM] });
  assert.deepStrictEqual(dataClass.systemsWithoutBaa(settings), ["github", "model-provider"]);
});

test("[AC-2 | BAA reference and profile readiness | spec-hooks-compliance | FR-234] a reference for one system does not cover another", () => {
  const settings = baaOf({ external_systems: [GITHUB_SYSTEM], baa_references: [MODEL_BAA] });
  assert.deepStrictEqual(dataClass.systemsWithoutBaa(settings), ["github"]);
  assert.strictEqual(dataClass.hasBaa(settings, "github"), false);
});

[
  ["a reference with no counterparty", Object.assign({}, MODEL_BAA, { counterparty: undefined })],
  ["a reference with no identifier", Object.assign({}, MODEL_BAA, { identifier: undefined })],
  ["a reference with no date", Object.assign({}, MODEL_BAA, { date: undefined })],
  ["a placeholder identifier", Object.assign({}, MODEL_BAA, { identifier: "tbd" })],
  ["a placeholder counterparty", Object.assign({}, MODEL_BAA, { counterparty: "unknown" })],
  ["a date that is not a real calendar date", Object.assign({}, MODEL_BAA, { date: "2026-02-30" })],
  ["a date in another format", Object.assign({}, MODEL_BAA, { date: "03/01/2026" })],
  ["a control character in the identifier", Object.assign({}, MODEL_BAA, { identifier: "BAA\n2026" })],
].forEach((row) => {
  test("[AC-1 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | UR-069] " + row[0] + " makes the BAA settings invalid, so it is never counted as a recorded reference", () => {
    // Invalid input space: identifier, counterparty, and date are all required, and a placeholder is no value.
    const reference = JSON.parse(JSON.stringify(row[1]));
    const settings = baaOf({ external_systems: [MODEL_SYSTEM], baa_references: [reference] });
    assert.strictEqual(settings.status, "invalid", JSON.stringify(settings));
    assert.strictEqual(typeof settings.problem, "string");
  });
});

test("[AC-1 | BAA reference and profile readiness | spec-hooks-compliance | FR-234] two systems with the same name make the BAA settings invalid", () => {
  const settings = baaOf({ external_systems: [MODEL_SYSTEM, { name: "model-provider", hosts: ["other.example.test"] }], baa_references: [MODEL_BAA] });
  assert.strictEqual(settings.status, "invalid", JSON.stringify(settings));
});

test("[AC-1 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | NFR-031] the plugin reads that a reference exists and never reads the agreement text", () => {
  const reference = Object.assign({ agreement_text: "AGREEMENT-TEXT-MARKER-5 the parties agree to protect PHI" }, MODEL_BAA);
  const settings = baaOf({ external_systems: [MODEL_SYSTEM], baa_references: [reference] });
  assert.ok(JSON.stringify(settings).indexOf("AGREEMENT-TEXT-MARKER-5") === -1, "the settings hold the agreement text: " + JSON.stringify(settings));
});

test("[AC-2 | BAA reference and profile readiness | spec-hooks-compliance | FR-234 | UR-069 | BR-020] the outbound guard denies a post to a listed system with no BAA reference, and allows it once the reference is recorded", () => {
  const missing = makeRoot({ profile: Object.assign({}, TAGS, { external_systems: [GITHUB_SYSTEM], baa_references: [] }) });
  const post = preToolUse(missing, "Bash", { command: "gh pr comment 42 --body 'Looks good after the rename'" });
  const denied = fx.runHook("phi-outbound-guard", post);
  assert.strictEqual(denied.status, 0, denied.stderr);
  assert.ok(isDeny(denied), "expected a deny for the system with no BAA; stdout: " + denied.stdout);
  const recorded = makeRoot({ profile: Object.assign({}, TAGS, { external_systems: [GITHUB_SYSTEM], baa_references: [GITHUB_BAA] }) });
  const allowed = fx.runHook("phi-outbound-guard", preToolUse(recorded, "Bash", { command: "gh pr comment 42 --body 'Looks good after the rename'" }));
  assert.strictEqual(allowed.status, 0, allowed.stderr);
  assert.ok(!isDeny(allowed), allowed.stdout);
});

// ---------------------------------------------------------------------------
// FR-244: a profile opt-out writes a logged event that names the profile and the time
// ---------------------------------------------------------------------------

// One data directory serves every session of one project: it holds the dedupe state (health-state.json).
function sessionStart(root, dataDir) {
  const res = fx.runHook("health-check", undefined, {
    args: ["--session-start"],
    cwd: root,
    dataDir: dataDir,
    env: { CLAUDE_PROJECT_DIR: root },
  });
  assert.strictEqual(res.status, 0, "exit 0; stderr: " + res.stderr);
  return res;
}

function disablementEvents(root, profile) {
  if (!fs.existsSync(fx.logDir(root))) return [];
  return fx.readRecords(root).filter((record) => record.event === "profile-disabled" && (profile === undefined || record.profile === profile));
}

test("[AC-1 | Profile disablement is logged and recorded | spec-hooks-compliance | FR-244 | UR-075 | BR-020] the next session start after a committed HIPAA opt-out logs a profile-disabled event that names the profile and carries the time", () => {
  const root = makeRoot({ settings: optOut("hipaa") });
  sessionStart(root, fx.tempDir("data-class-data-"));
  const events = disablementEvents(root);
  assert.strictEqual(events.length, 1, JSON.stringify(fx.readRecords(root)));
  assert.strictEqual(events[0].profile, "hipaa");
  assert.ok(Number.isFinite(Date.parse(events[0].ts)), "the event carries a time: " + events[0].ts);
});

test("[AC-1 | Profile disablement is logged and recorded | spec-hooks-compliance | FR-244 | UR-075] one event is logged for each profile the committed settings turn off", () => {
  const root = makeRoot({ settings: optOut("ferpa,hipaa") });
  sessionStart(root, fx.tempDir("data-class-data-"));
  assert.strictEqual(disablementEvents(root, "ferpa").length, 1, JSON.stringify(fx.readRecords(root)));
  assert.strictEqual(disablementEvents(root, "hipaa").length, 1);
  assert.strictEqual(disablementEvents(root, "soc2").length, 0, "SOC 2 stays enforced, so it logs no event");
});

test("[AC-1 | Profile disablement is logged and recorded | spec-hooks-compliance | FR-244 | UR-075] the disablement is logged once per project while the profile stays off", () => {
  const root = makeRoot({ settings: optOut("hipaa") });
  const dataDir = fx.tempDir("data-class-data-");
  sessionStart(root, dataDir);
  sessionStart(root, dataDir);
  assert.strictEqual(disablementEvents(root, "hipaa").length, 1, JSON.stringify(fx.readRecords(root)));
});

test("[AC-1 | Profile disablement is logged and recorded | spec-hooks-compliance | FR-244 | UR-075] no event is logged when every profile is enforced, or when only settings.local.json names a profile", () => {
  const none = makeRoot({});
  sessionStart(none, fx.tempDir("data-class-data-"));
  assert.strictEqual(disablementEvents(none).length, 0);
  const localOnly = makeRoot({ localSettings: optOut("hipaa") });
  sessionStart(localOnly, fx.tempDir("data-class-data-"));
  assert.strictEqual(disablementEvents(localOnly).length, 0, "a personal flag disables nothing, so no disablement is logged");
});

test("[AC-1 | Profile disablement is logged and recorded | spec-hooks-compliance | FR-244 | NFR-031] the disablement event holds no settings text, path, or command", () => {
  const root = makeRoot({ settings: { env: { [FLAG]: "ferpa", SECRET_VALUE: "SETTINGS-SECRET-MARKER-3" } } });
  sessionStart(root, fx.tempDir("data-class-data-"));
  assert.strictEqual(disablementEvents(root, "ferpa").length, 1);
  const raw = fx.rawLog(root);
  assert.ok(raw.indexOf("SETTINGS-SECRET-MARKER-3") === -1, "the log repeats a settings value");
  assert.ok(raw.indexOf(root) === -1, "the log repeats a path");
});
