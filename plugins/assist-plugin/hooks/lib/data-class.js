// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-231|FR-243|NFR-028] The governance profile reader: which compliance profiles a project enforces, and which data
// class a path belongs to. Specs: specs/spec-hooks-compliance.md (Requirements: Profile state from the committed
// settings file, Data-class tagging) and specs/spec-hooks-fsa-write-bar.md (the two files are protected from subagent
// writes). Every later control that reads a profile flag or a data class reads it here, never from process.env.
//
// Configuration points (stated in rules/assist-plugin-rule.md, "Governance profiles"):
//   1. The profile flag is the env variable ASSIST_PLUGIN_COMPLIANCE_OPT_OUT in the `env` block of the committed project
//      file <root>/.claude/settings.json. Its value is a comma-separated list of the profiles to turn OFF, from `soc2`,
//      `hipaa`, and `ferpa` (case and spaces are ignored). An absent flag, an empty value, or a token that names no
//      profile turns nothing off, so all three profiles are enforced by default. An unknown token is reported in
//      `unknown` and never switches anything off, so a typo cannot silently disable a control.
//   2. The data file is <root>/.agent/governance/profile.json. This module reads its `data_classes` key:
//      {"data_classes": {"student-record": ["records/**"], "PHI": ["data/patients*.csv"]}}. The other keys (PHI
//      patterns, BAA references) belong to the controls that read them and are not judged here beyond the file being a
//      JSON object. [FR-246] The FERPA disclosure guard's three keys are read by ferpaSettings() below:
//      {"student_record_patterns": [{"name": "sid", "pattern": "\\bS\\d{8}\\b"}],
//       "ferpa_receiving_parties": ["district-registrar", "state-education-agency"],
//       "ferpa_exceptions": [{"party": "parent-guardian", "exception": "99.32(d)(1)"}]}
//      A bad value of those keys does not make the file malformed for the other controls; the FERPA guard reports it.
//      [FR-234] The BAA keys are read by baaSettings() below: the external systems that may receive data, each with the
//      hosts it is reached at, and one BAA reference per system (identifier, counterparty, date). The plugin checks that a
//      reference is present; it never reads or assesses the agreement text.
//      {"external_systems": [{"name": "model-provider", "hosts": ["api.anthropic.com"]},
//                            {"name": "github", "hosts": ["github.com"]}],
//       "baa_references": [{"system": "model-provider", "identifier": "BAA-2026-014",
//                           "counterparty": "Example Provider Inc.", "date": "2026-03-01"}]}
//      A bad value of those keys does not make the file malformed for the other controls; the health check and the PHI
//      outbound guard report it.
//
// Why a direct parse (FR-243, D-1). Claude Code places .claude/settings.local.json above the project file, so the merged
// process environment would let a personal local override turn enforcement off. This module therefore parses the
// committed file itself, never reads process.env, and never lets .claude/settings.local.json change a result.
// localOverride() reads the local file only so the health check can report a profile it names as ignored.
//
// Failure posture [NFR-028]:
//   - An absent profile.json is the safe default: nothing is tagged, no control hard-denies, and classify() returns
//     "none". The tagged-path controls run log-only.
//   - A malformed, unreadable, or oversized profile.json is the fail-closed case. loadProfile() reports status
//     "malformed" with a problem code, classify() returns "untagged" (the class cannot be known), and
//     deniesTaggedOps() is true while the HIPAA or FERPA profile is enforced, so the controls deny their guarded
//     operations until the file is fixed. SOC 2 holds no tagged-path control, so it does not trigger the deny.
//   - A settings.json that is missing, unreadable, or not JSON leaves all three profiles enforced and sets `problem`.
//
// Classification. classify() matches the path against the globs with matchGlob from lib/fsa-paths.js, after making it
// relative to the project root. Case is folded on both sides (a case-insensitive file system names the same file with
// another spelling, and a tag that over-matches is the safe error). A path that matches both classes is PHI. A
// directory is tagged only when a glob matches the directory path itself: a Grep or Glob over a parent directory of
// a tagged path is classified by that directory alone.
//
// File reads only, each bounded (MAX_FILE_BYTES), and the paths are never resolved through symlinks. ES5 syntax, so
// lib/health.js can load it on any Node version; lib/fsa-paths.js and lib/git-root.js use newer syntax and are loaded
// lazily inside a try. No dependencies. Nothing here throws, and nothing it returns holds file contents beyond the
// closed profile names and short problem codes.
"use strict";

var fs = require("fs");
var path = require("path");

var FLAG_NAME = "ASSIST_PLUGIN_COMPLIANCE_OPT_OUT";
var PROFILES = ["soc2", "hipaa", "ferpa"];
var PROFILE_LABELS = { soc2: "SOC 2", hipaa: "HIPAA", ferpa: "FERPA" };

var CLASS_STUDENT = "student-record";
var CLASS_PHI = "PHI";
var CLASS_NONE = "none";
var CLASS_UNTAGGED = "untagged";
// The order decides a path that matches both: PHI wins.
var CLASS_ORDER = [CLASS_PHI, CLASS_STUDENT];

var SETTINGS_FILE = path.join(".claude", "settings.json");
var LOCAL_SETTINGS_FILE = path.join(".claude", "settings.local.json");
var PROFILE_FILE = path.join(".agent", "governance", "profile.json");

// [FR-246] The profile.json keys of the FERPA disclosure guard (impl/ferpa-disclosure-guard.js).
var STUDENT_PATTERNS_KEY = "student_record_patterns";
var PARTIES_KEY = "ferpa_receiving_parties";
var EXCEPTIONS_KEY = "ferpa_exceptions";
var MAX_PATTERNS = 200;
var MAX_PATTERN_CHARS = 512;
var MAX_PARTIES = 500;
var PATTERN_NAME = /^[A-Za-z0-9_.-]{1,40}$/;
// A receiving-party identifier is a plain token: it is the value the audit log stores, never free text.
var PARTY_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._@:-]{0,62}[A-Za-z0-9])?$/;
// A 34 CFR 99.32(d) citation such as 99.32(d)(2) or 99.32(d)(5)(i).
var EXCEPTION_CITE = /^99\.32\(d\)(?:\([A-Za-z0-9]{1,4}\)){0,3}$/;
// Words that stand for "no value"; the audit log never accepts one as a receiving party or a legitimate interest.
var PLACEHOLDERS = ["unstated", "none", "n/a", "na", "unknown", "tbd", "todo", "null", "undefined"];

// [FR-234] The profile.json keys of the BAA record (readiness report and the PHI outbound guard's BAA rule).
var SYSTEMS_KEY = "external_systems";
var BAA_KEY = "baa_references";
var MAX_SYSTEMS = 100;
var MAX_HOSTS = 20;
var MAX_REFERENCES = 500;
var MAX_IDENTIFIER_CHARS = 80;
var MAX_COUNTERPARTY_CHARS = 120;
var SYSTEM_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;
var HOST_NAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
var ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
var CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

var MAX_FILE_BYTES = 1024 * 1024;
var MAX_GLOBS_PER_CLASS = 500;
var MAX_GLOB_CHARS = 512;
var MAX_UNKNOWN = 10;
var TOKEN_PATTERN = /^[a-z0-9_.-]{1,40}$/;

function has(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorCode(err) {
  return err && typeof err.code === "string" ? err.code : "unknown";
}

// The project root: options.root when absolute, else the git root of options.cwd (else the cwd itself), else null. The
// hooks resolve their root this way (lib/health.js auditRoot).
function rootOf(options) {
  var opts = options || {};
  if (typeof opts.root === "string" && path.isAbsolute(opts.root)) return opts.root;
  if (typeof opts.cwd === "string" && path.isAbsolute(opts.cwd)) {
    try {
      return require("./git-root.js").findGitRoot(opts.cwd) || opts.cwd;
    } catch (err) {
      return opts.cwd;
    }
  }
  return null;
}

// Reads and parses one JSON file. Returns {status, value?, code?}: "ok" (value holds the parsed JSON), "absent" (no
// such file), "malformed" (not JSON, or empty), "too-large", or "unreadable" (a directory, a permission error, or any
// other I/O error; code names it). The parse error is never copied: it can quote the file.
function readJson(file) {
  var fd = -1;
  try {
    fd = fs.openSync(file, "r");
    var stat = fs.fstatSync(fd);
    if (!stat.isFile()) return { status: "unreadable", code: "not-a-file" };
    if (stat.size > MAX_FILE_BYTES) return { status: "too-large" };
    var text = fs.readFileSync(fd, "utf8").replace(/^﻿/, "");
    try {
      return { status: "ok", value: JSON.parse(text) };
    } catch (parseError) {
      return { status: "malformed" };
    }
  } catch (err) {
    var code = errorCode(err);
    if (code === "ENOENT" || code === "ENOTDIR") return { status: "absent" };
    return { status: "unreadable", code: code };
  } finally {
    if (fd >= 0) {
      try {
        fs.closeSync(fd);
      } catch (closeError) {
        // The descriptor is already released or unusable; the read result stands.
      }
    }
  }
}

// ---- Profile flag ---------------------------------------------------------------------------------------------------

// The profiles a flag value turns off: {listed, unknown, problem}. `listed` is in the order of PROFILES.
function parseFlag(value) {
  var result = { listed: [], unknown: [], problem: null };
  if (value === undefined) return result;
  if (typeof value !== "string") {
    result.problem = "flag-not-string";
    return result;
  }
  var tokens = value.split(",").map(function (raw) {
    return raw.replace(/^\s+|\s+$/g, "").toLowerCase();
  }).filter(function (token) {
    return token.length > 0;
  });
  result.listed = PROFILES.filter(function (name) {
    return tokens.indexOf(name) !== -1;
  });
  tokens.forEach(function (token) {
    if (PROFILES.indexOf(token) === -1 && result.unknown.length < MAX_UNKNOWN) result.unknown.push(TOKEN_PATTERN.test(token) ? token : "<invalid>");
  });
  return result;
}

// The flag of one settings file: {listed, unknown, problem}. A missing file reads as no flag and no problem; a file that
// cannot be read, parsed, or whose `env` is not an object reads as no flag with a problem code.
function readFlag(file) {
  var read = readJson(file);
  var none = { listed: [], unknown: [], problem: null };
  if (read.status === "absent") return none;
  if (read.status !== "ok") {
    none.problem = "settings-" + read.status;
    return none;
  }
  if (!isObject(read.value)) {
    none.problem = "settings-malformed";
    return none;
  }
  if (!has(read.value, "env")) return none;
  if (!isObject(read.value.env)) {
    none.problem = "settings-env-invalid";
    return none;
  }
  return parseFlag(has(read.value.env, FLAG_NAME) ? read.value.env[FLAG_NAME] : undefined);
}

// [FR-231|FR-243] Which profiles the project enforces, from the committed <root>/.claude/settings.json alone.
// Returns {soc2, hipaa, ferpa, optedOut, unknown, problem}: each profile boolean is true when enforced; `optedOut` lists
// the profiles the flag turns off; `unknown` lists tokens that name no profile (they turn nothing off); `problem` is
// null or a short code ("no-project-root", "settings-malformed", "settings-unreadable", "settings-too-large",
// "settings-env-invalid", "flag-not-string", "error"). Every problem leaves the profiles it cannot read as enforced.
// options: {root} or {cwd}.
function profileState(options) {
  var state = { soc2: true, hipaa: true, ferpa: true, optedOut: [], unknown: [], problem: null };
  try {
    var root = rootOf(options);
    if (!root) {
      state.problem = "no-project-root";
      return state;
    }
    var flag = readFlag(path.join(root, SETTINGS_FILE));
    flag.listed.forEach(function (name) {
      state[name] = false;
    });
    state.optedOut = flag.listed;
    state.unknown = flag.unknown;
    state.problem = flag.problem;
  } catch (err) {
    state.problem = "error";
  }
  return state;
}

// [FR-243] The profiles that <root>/.claude/settings.local.json names but the committed file does not: ignored, because
// a personal file cannot disable enforcement. Returns {ignored, problem}; `ignored` is in the order of PROFILES. This
// is the one read of the local file, and it changes no result of profileState.
function localOverride(options) {
  var result = { ignored: [], problem: null };
  try {
    var root = rootOf(options);
    if (!root) {
      result.problem = "no-project-root";
      return result;
    }
    var local = readFlag(path.join(root, LOCAL_SETTINGS_FILE));
    var committed = readFlag(path.join(root, SETTINGS_FILE));
    result.ignored = local.listed.filter(function (name) {
      return committed.listed.indexOf(name) === -1;
    });
    result.problem = local.problem;
  } catch (err) {
    result.problem = "error";
  }
  return result;
}

// ---- Data file ------------------------------------------------------------------------------------------------------

// The problem code for a `data_classes` value, or null when it is usable.
function classesProblem(value) {
  if (value === undefined) return null;
  if (!isObject(value)) return "data-classes-not-object";
  var keys = Object.keys(value);
  for (var i = 0; i < keys.length; i++) {
    if (CLASS_ORDER.indexOf(keys[i]) === -1) return "data-classes-unknown-class";
    var globs = value[keys[i]];
    if (!Array.isArray(globs) || globs.length > MAX_GLOBS_PER_CLASS) return "data-classes-bad-list";
    for (var j = 0; j < globs.length; j++) {
      var glob = globs[j];
      if (typeof glob !== "string" || glob.length === 0 || glob.length > MAX_GLOB_CHARS || glob.indexOf("\0") !== -1) return "data-classes-bad-glob";
    }
  }
  return null;
}

// [FR-231|NFR-028] Loads <root>/.agent/governance/profile.json. Returns {status, profile, problem}:
//   "absent"     no such file (or no project root); profile is null and nothing is tagged
//   "valid"      a JSON object whose `data_classes` key, when present, holds only the PHI and student-record glob lists
//   "malformed"  not JSON, not an object, too large, unreadable, or a bad `data_classes`; profile is null and
//                problem is a short code ("profile-malformed", "profile-too-large", "profile-unreadable",
//                "profile-not-object", or a "data-classes-..." code)
// options: {root} or {cwd}.
function loadProfile(options) {
  try {
    var root = rootOf(options);
    if (!root) return { status: "absent", profile: null, problem: "no-project-root" };
    var read = readJson(path.join(root, PROFILE_FILE));
    if (read.status === "absent") return { status: "absent", profile: null, problem: null };
    if (read.status !== "ok") return { status: "malformed", profile: null, problem: "profile-" + read.status };
    if (!isObject(read.value)) return { status: "malformed", profile: null, problem: "profile-not-object" };
    var problem = classesProblem(has(read.value, "data_classes") ? read.value.data_classes : undefined);
    if (problem) return { status: "malformed", profile: null, problem: problem };
    return { status: "valid", profile: read.value, problem: null };
  } catch (err) {
    return { status: "malformed", profile: null, problem: "profile-unreadable" };
  }
}

// ---- FERPA disclosure settings [FR-246] -----------------------------------------------------------------------------

// {patterns} or {problem} for the `student_record_patterns` value: a list of regular expression sources, each a string or
// {name, pattern}. A name is 1 to 40 of letters, digits, ".", "_", "-" (an unnamed pattern is "pattern-N"). Matching is
// case-insensitive. A pattern that does not compile or matches the empty string is a problem.
function compileStudentPatterns(value) {
  if (value === undefined) return { patterns: [] };
  if (!Array.isArray(value) || value.length > MAX_PATTERNS) return { problem: "student-patterns-bad-list" };
  var patterns = [];
  for (var i = 0; i < value.length; i++) {
    var entry = value[i];
    var source = isObject(entry) ? entry.pattern : entry;
    var name = "pattern-" + (i + 1);
    if (isObject(entry) && entry.name !== undefined) {
      if (typeof entry.name !== "string" || !PATTERN_NAME.test(entry.name)) return { problem: "student-patterns-bad-name" };
      name = entry.name;
    }
    if (typeof source !== "string" || source.length === 0 || source.length > MAX_PATTERN_CHARS) return { problem: "student-patterns-bad-pattern" };
    var regex;
    try {
      regex = new RegExp(source, "i");
    } catch (err) {
      return { problem: "student-patterns-bad-pattern" };
    }
    if (regex.test("")) return { problem: "student-patterns-bad-pattern" };
    patterns.push({ name: name, regex: regex });
  }
  return { patterns: patterns };
}

// True when `id` is a usable party identifier: a plain token that is not a placeholder.
function validPartyId(id) {
  return typeof id === "string" && PARTY_ID.test(id) && PLACEHOLDERS.indexOf(id.toLowerCase()) === -1;
}

// {parties} or {problem} for the `ferpa_receiving_parties` value: a list of party identifier strings.
function readParties(value) {
  if (value === undefined) return { parties: [] };
  if (!Array.isArray(value) || value.length > MAX_PARTIES) return { problem: "ferpa-parties-bad-list" };
  for (var i = 0; i < value.length; i++) {
    if (!validPartyId(value[i])) return { problem: "ferpa-parties-bad-id" };
  }
  return { parties: value.slice() };
}

// {exceptions} or {problem} for the `ferpa_exceptions` value: a list of {party, exception}, the party identifier and the
// 34 CFR 99.32(d) citation that covers it.
function readExceptions(value) {
  if (value === undefined) return { exceptions: [] };
  if (!Array.isArray(value) || value.length > MAX_PARTIES) return { problem: "ferpa-exceptions-bad-list" };
  var exceptions = [];
  for (var i = 0; i < value.length; i++) {
    var entry = value[i];
    if (!isObject(entry) || !validPartyId(entry.party)) return { problem: "ferpa-exceptions-bad-party" };
    if (typeof entry.exception !== "string" || !EXCEPTION_CITE.test(entry.exception)) return { problem: "ferpa-exceptions-bad-citation" };
    exceptions.push({ party: entry.party, exception: entry.exception });
  }
  return { exceptions: exceptions };
}

// [FR-246] The FERPA disclosure settings of a loadProfile() result: {status: "ok", patterns, parties, exceptions} or
// {status: "invalid", problem}. `patterns` is [{name, regex}], `parties` the receiving-party allowlist (identifiers), and
// `exceptions` the 99.32(d) list ([{party, exception}]). A key that is absent reads as an empty list. A result that is not
// "valid" (no file, or a malformed one) reads as invalid; the caller decides what an absent file means. Never throws.
function ferpaSettings(loaded) {
  try {
    if (!loaded || loaded.status !== "valid" || !isObject(loaded.profile)) return { status: "invalid", problem: "profile-unusable" };
    var profile = loaded.profile;
    var patterns = compileStudentPatterns(has(profile, STUDENT_PATTERNS_KEY) ? profile[STUDENT_PATTERNS_KEY] : undefined);
    if (patterns.problem) return { status: "invalid", problem: patterns.problem };
    var parties = readParties(has(profile, PARTIES_KEY) ? profile[PARTIES_KEY] : undefined);
    if (parties.problem) return { status: "invalid", problem: parties.problem };
    var exceptions = readExceptions(has(profile, EXCEPTIONS_KEY) ? profile[EXCEPTIONS_KEY] : undefined);
    if (exceptions.problem) return { status: "invalid", problem: exceptions.problem };
    return { status: "ok", patterns: patterns.patterns, parties: parties.parties, exceptions: exceptions.exceptions };
  } catch (err) {
    return { status: "invalid", problem: "ferpa-settings-error" };
  }
}

// ---- BAA references [FR-234] ----------------------------------------------------------------------------------------

// True when `value` is a usable free-text field: a string of 1 to `max` characters with no control character that is not a
// placeholder word.
function validText(value, max) {
  if (typeof value !== "string") return false;
  var text = value.replace(/^\s+|\s+$/g, "");
  return text.length > 0 && text.length <= max && !CONTROL_CHARS.test(text) && PLACEHOLDERS.indexOf(text.toLowerCase()) === -1;
}

// True when `value` is a real calendar date written YYYY-MM-DD.
function validDate(value) {
  var match = typeof value === "string" ? ISO_DATE.exec(value) : null;
  if (!match) return false;
  var year = Number(match[1]);
  var month = Number(match[2]);
  var day = Number(match[3]);
  var date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// {systems} or {problem} for the `external_systems` value: a list of {name, hosts}, the system name and the hostnames it is
// reached at (lower-cased; a call to a host or any of its subdomains is a call to the system).
function readSystems(value) {
  if (value === undefined) return { systems: [] };
  if (!Array.isArray(value) || value.length > MAX_SYSTEMS) return { problem: "baa-systems-bad-list" };
  var systems = [];
  var seen = {};
  for (var i = 0; i < value.length; i++) {
    var entry = value[i];
    if (!isObject(entry)) return { problem: "baa-systems-bad-entry" };
    if (typeof entry.name !== "string" || !SYSTEM_NAME.test(entry.name) || PLACEHOLDERS.indexOf(entry.name.toLowerCase()) !== -1) return { problem: "baa-systems-bad-name" };
    if (has(seen, entry.name)) return { problem: "baa-systems-duplicate" };
    seen[entry.name] = true;
    var hosts = entry.hosts === undefined ? [] : entry.hosts;
    if (!Array.isArray(hosts) || hosts.length > MAX_HOSTS) return { problem: "baa-systems-bad-hosts" };
    var folded = [];
    for (var j = 0; j < hosts.length; j++) {
      var host = typeof hosts[j] === "string" ? hosts[j].toLowerCase() : "";
      if (host.length > 253 || !HOST_NAME.test(host)) return { problem: "baa-systems-bad-hosts" };
      folded.push(host);
    }
    systems.push({ name: entry.name, hosts: folded });
  }
  return { systems: systems };
}

// {references} or {problem} for the `baa_references` value: a list of {system, identifier, counterparty, date}.
function readReferences(value) {
  if (value === undefined) return { references: [] };
  if (!Array.isArray(value) || value.length > MAX_REFERENCES) return { problem: "baa-references-bad-list" };
  var references = [];
  for (var i = 0; i < value.length; i++) {
    var entry = value[i];
    if (!isObject(entry)) return { problem: "baa-references-bad-entry" };
    if (typeof entry.system !== "string" || !SYSTEM_NAME.test(entry.system)) return { problem: "baa-references-bad-system" };
    if (!validText(entry.identifier, MAX_IDENTIFIER_CHARS)) return { problem: "baa-references-bad-identifier" };
    if (!validText(entry.counterparty, MAX_COUNTERPARTY_CHARS)) return { problem: "baa-references-bad-counterparty" };
    if (!validDate(entry.date)) return { problem: "baa-references-bad-date" };
    references.push({ system: entry.system, identifier: entry.identifier, counterparty: entry.counterparty, date: entry.date });
  }
  return { references: references };
}

// [FR-234] The BAA settings of a loadProfile() result: {status: "ok", systems, references} or {status: "invalid", problem}.
// `systems` is [{name, hosts}] (the external systems that may receive data), `references` is [{system, identifier,
// counterparty, date}]. A key that is absent reads as an empty list. A result that is not "valid" reads as invalid; the
// caller decides what an absent file means. The problem is a short code, never the file text. Never throws.
function baaSettings(loaded) {
  try {
    if (!loaded || loaded.status !== "valid" || !isObject(loaded.profile)) return { status: "invalid", problem: "profile-unusable" };
    var profile = loaded.profile;
    var systems = readSystems(has(profile, SYSTEMS_KEY) ? profile[SYSTEMS_KEY] : undefined);
    if (systems.problem) return { status: "invalid", problem: systems.problem };
    var references = readReferences(has(profile, BAA_KEY) ? profile[BAA_KEY] : undefined);
    if (references.problem) return { status: "invalid", problem: references.problem };
    return { status: "ok", systems: systems.systems, references: references.references };
  } catch (err) {
    return { status: "invalid", problem: "baa-settings-error" };
  }
}

// [FR-234] True when `settings` (an "ok" baaSettings() result) holds a BAA reference for the system named `name`. Only the
// presence of a reference counts; the agreement text is never read.
function hasBaa(settings, name) {
  if (!settings || settings.status !== "ok") return false;
  return settings.references.some(function (reference) {
    return reference.system === name;
  });
}

// [FR-234] The names of the external systems of `settings` that have no BAA reference, in list order.
function systemsWithoutBaa(settings) {
  if (!settings || settings.status !== "ok") return [];
  return settings.systems.filter(function (system) {
    return !hasBaa(settings, system.name);
  }).map(function (system) {
    return system.name;
  });
}

// [FR-234] The names of the external systems of `settings` that list `host` (or a parent domain of it) among their hosts.
// A trailing dot and case are ignored. A host that no system lists names no system.
function systemsForHost(settings, host) {
  if (!settings || settings.status !== "ok" || typeof host !== "string") return [];
  var wanted = host.toLowerCase().replace(/\.$/, "");
  if (wanted.length === 0) return [];
  return settings.systems.filter(function (system) {
    return system.hosts.some(function (listed) {
      return wanted === listed || (wanted.length > listed.length && wanted.slice(-(listed.length + 1)) === "." + listed);
    });
  }).map(function (system) {
    return system.name;
  });
}

function fold(text) {
  return text.toUpperCase().toLowerCase();
}

// [FR-231] The data class of `file`: "student-record", "PHI", "none" (no glob matches, or the file is absent so nothing
// is tagged), or "untagged" (the class cannot be known: no project root, an unusable path, or a malformed profile.json).
// `file` may be absolute or relative to the root. options: {root} or {cwd}, and `loaded`, a loadProfile() result the
// caller already holds (it saves one file read per path).
function classify(file, options) {
  try {
    if (typeof file !== "string" || file.length === 0) return CLASS_UNTAGGED;
    var root = rootOf(options);
    if (!root) return CLASS_UNTAGGED;
    var loaded = options && options.loaded ? options.loaded : loadProfile(options);
    if (loaded.status === "absent") return CLASS_NONE;
    if (loaded.status !== "valid" || !isObject(loaded.profile)) return CLASS_UNTAGGED;
    var classes = isObject(loaded.profile.data_classes) ? loaded.profile.data_classes : {};
    var paths = require("./fsa-paths.js");
    var forms = paths.relativeForms(file, [root]).map(fold);
    if (forms.length === 0) return CLASS_UNTAGGED;
    for (var i = 0; i < CLASS_ORDER.length; i++) {
      var globs = has(classes, CLASS_ORDER[i]) && Array.isArray(classes[CLASS_ORDER[i]]) ? classes[CLASS_ORDER[i]] : [];
      for (var j = 0; j < globs.length; j++) {
        var glob = fold(globs[j]);
        for (var k = 0; k < forms.length; k++) {
          if (paths.matchGlob(glob, forms[k])) return CLASS_ORDER[i];
        }
      }
    }
    return CLASS_NONE;
  } catch (err) {
    return CLASS_UNTAGGED;
  }
}

// [NFR-028] True when a tagged-path control must deny its guarded operations: profile.json is malformed and the HIPAA
// or FERPA profile is enforced. An absent file is never a deny. options: {root} or {cwd}.
function deniesTaggedOps(options) {
  try {
    var state = profileState(options);
    if (!state.hipaa && !state.ferpa) return false;
    return loadProfile(options).status === "malformed";
  } catch (err) {
    return true;
  }
}

module.exports = {
  FLAG_NAME: FLAG_NAME,
  PROFILES: PROFILES,
  PROFILE_LABELS: PROFILE_LABELS,
  SETTINGS_FILE: SETTINGS_FILE,
  LOCAL_SETTINGS_FILE: LOCAL_SETTINGS_FILE,
  PROFILE_FILE: PROFILE_FILE,
  CLASS_STUDENT: CLASS_STUDENT,
  CLASS_PHI: CLASS_PHI,
  CLASS_NONE: CLASS_NONE,
  CLASS_UNTAGGED: CLASS_UNTAGGED,
  rootOf: rootOf,
  profileState: profileState,
  localOverride: localOverride,
  loadProfile: loadProfile,
  ferpaSettings: ferpaSettings,
  baaSettings: baaSettings,
  hasBaa: hasBaa,
  systemsWithoutBaa: systemsWithoutBaa,
  systemsForHost: systemsForHost,
  SYSTEMS_KEY: SYSTEMS_KEY,
  BAA_KEY: BAA_KEY,
  STUDENT_PATTERNS_KEY: STUDENT_PATTERNS_KEY,
  PARTIES_KEY: PARTIES_KEY,
  EXCEPTIONS_KEY: EXCEPTIONS_KEY,
  PLACEHOLDERS: PLACEHOLDERS,
  classify: classify,
  deniesTaggedOps: deniesTaggedOps
};
