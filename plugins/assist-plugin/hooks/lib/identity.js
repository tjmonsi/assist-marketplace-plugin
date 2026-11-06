// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-226|UR-066] The per-agent identity helper: who acted on a hook event. Spec: specs/spec-hooks-audit.md, Requirement:
// Per-agent identity helper. The guard runtime (lib/health.js) and the audit-log hook (impl/audit-log.js) take the agent
// identity of a record from here instead of reading agent_type and agent_id off the raw hook input.
//
// resolve(input) returns {kind, agent_type, agent_id, plugin_version}:
//   kind "subagent"      agent_type is the subagent's type, or "unidentified" when the id is valid but the type is missing
//                        or unusable. agent_id is its id, kept in both cases.
//   kind "main-session"  no subagent acted. agent_type is "main-session" and agent_id is null.
//   kind "unidentified"  the "no agent id and not the main session" case: neither a subagent nor the main session can be
//                        established. agent_type is "unidentified" and agent_id is null.
// agent_type is never blank, whichever kind applies. A blank identity is a defect (FR-226), so every failure path ends in
// "unidentified" and nothing here throws.
//
// The rule that tells the three apart reads agent_type and agent_id the way impl/fsa-write-bar.js does (its header, and
// the `subagent` constant in evaluate): agent_id is present only when the hook fires inside a subagent, and agent_type
// alone can come from a main session started with --agent. So:
//   1. A non-empty agent_id means a subagent acted. Its agent_type names it; a missing or malformed agent_type under a
//      valid agent_id is recorded as agent_type "unidentified" under kind "subagent" (a subagent of unknown type; the
//      actor has an id, so it is not the kind "unidentified" case), with the id kept.
//   2. No agent_id means the main session acted, whatever agent_type holds (a --agent session has an agent_type and no
//      agent_id).
//   3. [FR-226] "No agent id and not the main session" is the unidentified case. The input gives no way to establish a
//      main session when it is not an object, or when an agent field is present but unusable (an agent_id that is not
//      a plain identifier string, or an agent_type that is not a plain type string). Absent, null, and "" count as
//      absent, as in the write bar.
//
// The plugin version is read at run time from the manifest plugins/assist-plugin/.claude-plugin/plugin.json (the
// directory above hooks/), never a constant. An unreadable manifest gives "unknown", never a blank. Values are the
// plain tokens the audit log accepts (lib/audit-chain.js): no prompt text, file text, command text, or secret.
// ES5 syntax, so lib/health.js can load it on any Node version. No dependencies. Fails open: no error leaves this module.
"use strict";

var fs = require("fs");
var path = require("path");

var MAIN_SESSION = "main-session";
var UNIDENTIFIED = "unidentified";
var UNKNOWN_VERSION = "unknown";
var MANIFEST = path.join(__dirname, "..", "..", ".claude-plugin", "plugin.json");
var AGENT_TYPE_PATTERN = /^[A-Za-z0-9:_-]{1,60}$/;
var AGENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
var VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/;

var cachedVersion = null;

// Reports one problem to options.log. A failing logger must never break the caller.
function note(options, event, code) {
  try {
    if (options && typeof options.log === "function") options.log({ level: "warn", event: event, code: code });
  } catch (err) {
    // The logger failed; the identity still resolves.
  }
}

// The version string of the manifest at `file`, or UNKNOWN_VERSION when it cannot be read or is not a plain token.
function readVersion(file, options) {
  try {
    var manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    var version = manifest && typeof manifest.version === "string" ? manifest.version : "";
    if (VERSION_PATTERN.test(version)) return version;
    note(options, "identity-version-invalid", "bad-version");
  } catch (err) {
    note(options, "identity-version-unreadable", err && typeof err.code === "string" ? err.code : "unknown");
  }
  return UNKNOWN_VERSION;
}

// [FR-226] The plugin version from the manifest, read once per process. options.manifestPath reads another manifest
// and skips the cache (tests).
function pluginVersion(options) {
  var override = options && typeof options.manifestPath === "string" && options.manifestPath.length > 0 ? options.manifestPath : null;
  if (!override && cachedVersion !== null) return cachedVersion;
  var version = readVersion(override || MANIFEST, options);
  if (!override && version !== UNKNOWN_VERSION) cachedVersion = version;
  return version;
}

// Absent as the write bar reads it: undefined, null, and the empty string.
function absent(value) {
  return value === undefined || value === null || value === "";
}

function usable(value, pattern) {
  return typeof value === "string" && pattern.test(value);
}

function identity(kind, type, id, version) {
  return { kind: kind, agent_type: type, agent_id: id, plugin_version: version };
}

// [FR-226|UR-066] Who acted on this hook event. See the rule in the header. Never throws and never returns a blank
// agent_type.
function resolve(input, options) {
  var version = UNKNOWN_VERSION;
  try {
    version = pluginVersion(options);
    if (!input || typeof input !== "object" || Array.isArray(input)) return identity("unidentified", UNIDENTIFIED, null, version);
    var rawId = input.agent_id;
    var rawType = input.agent_type;
    if (!absent(rawId)) {
      // Rule 1: a subagent acted. An id that is not a plain identifier cannot be recorded, so the actor is unidentified.
      if (!usable(rawId, AGENT_ID_PATTERN)) return identity("unidentified", UNIDENTIFIED, null, version);
      return identity("subagent", !absent(rawType) && usable(rawType, AGENT_TYPE_PATTERN) ? rawType : UNIDENTIFIED, rawId, version);
    }
    // Rule 3: an agent_type that cannot be read leaves the main session unestablished.
    if (!absent(rawType) && !usable(rawType, AGENT_TYPE_PATTERN)) return identity("unidentified", UNIDENTIFIED, null, version);
    // Rule 2: no agent_id means the main session acted.
    return identity("main-session", MAIN_SESSION, null, version);
  } catch (err) {
    return identity("unidentified", UNIDENTIFIED, null, version);
  }
}

// [FR-226] The identity fields of an audit record: {agent_type, agent_id?, plugin_version}. agent_type is always set and
// never blank; agent_id is set only for an actor that has one; plugin_version is the manifest version, or "unknown".
function fields(input, options) {
  var who = resolve(input, options);
  var out = { agent_type: who.agent_type };
  if (who.agent_id !== null) out.agent_id = who.agent_id;
  out.plugin_version = who.plugin_version;
  return out;
}

module.exports = {
  MAIN_SESSION: MAIN_SESSION,
  UNIDENTIFIED: UNIDENTIFIED,
  UNKNOWN_VERSION: UNKNOWN_VERSION,
  MANIFEST: MANIFEST,
  pluginVersion: pluginVersion,
  resolve: resolve,
  fields: fields
};
