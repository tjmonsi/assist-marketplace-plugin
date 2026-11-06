// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// PreToolUse guard for WebFetch and for Bash and PowerShell PR-post commands: deny an outbound call whose payload matches a
// configured PHI pattern or names a PHI-tagged path (task plan Tranche 3, Step 27; specs/spec-hooks-compliance.md,
// Requirement: PHI outbound guard).
// [FR-233|NFR-028|NFR-035|NFR-026|NFR-031] Covered calls:
//   - WebFetch: the url and the prompt of the tool input
//   - gh pr and bkt pr commands that post (create, edit, comment, review, merge, close, approve, decline, update, reply): the
//     --body, -b, --body-file, and -F payload, the title (gh -t and --title on create and edit, gh -t and --subject on merge;
//     gh pr close also reads -c and --comment), and for bkt the --text, --description, --title, and --text-file options. The payload comes from ../lib/pr-verdict.js postPayloads(). A --body-file is read from the hook
//     input's cwd (a file read, which a guard may do), at most MAX_TEXT_CHARS; a heredoc fed to -F - is read from the command
//     text. The sh -c string and eval argument of a part are walked too (two levels).
//
// Configuration. HIPAA is enforced by default; the flag is read through ../lib/data-class.js, which parses the committed
// .claude/settings.json and never reads process.env. The PHI patterns and the PHI path globs come from
// .agent/governance/profile.json, loaded by data-class.js loadProfile() and classify():
//   {"phi_patterns": [{"name": "mrn", "pattern": "MRN[-: ]?\\d{6,10}"}, "\\b\\d{3}-\\d{2}-\\d{4}\\b"],
//    "data_classes": {"PHI": ["data/patients*.csv"]}}
// `phi_patterns` is a list; each entry is a regular expression source, or an object {name, pattern}. A name is 1 to 40 of
// letters, digits, ".", "_", "-" (an unnamed pattern is "pattern-N"). Matching is case-insensitive. At most MAX_PATTERNS
// patterns of MAX_PATTERN_CHARS each; a pattern that does not compile or matches the empty string makes the profile unusable.
//   - No profile.json: nothing is tagged and no pattern exists, so the guard runs log-only. It records nothing and never denies.
//   - A malformed profile.json, or a bad `phi_patterns` value, while the HIPAA profile is enforced: the guard denies every
//     covered call until the file is fixed. A project root that cannot be found counts as an unreadable configuration.
//   - HIPAA opted out in the committed settings: the guard allows every call (the governed opt-out of FR-243 and FR-244).
//
// [FR-234] BAA rule (task plan Step 28; specs/spec-hooks-compliance.md, Requirement: BAA reference and profile readiness). While
// HIPAA is enforced, a covered call to an external system that profile.json lists but holds no BAA reference for is denied
// (rule phi-outbound.baa), after the PHI checks below pass. The profile lists the systems and their hosts, and one reference per
// system, in two more keys (read by data-class.js baaSettings()):
//   {"external_systems": [{"name": "github", "hosts": ["github.com"]}],
//    "baa_references": [{"system": "model-provider", "identifier": "BAA-2026-014", "counterparty": "Example Inc.", "date": "2026-03-01"}]}
// The system of a call is the host of the WebFetch url, or the platform of a PR-post command (gh is github.com, bkt is
// bitbucket.org). A host that no listed system names is not judged: the guard cannot tell what it is, and an unconfigured
// project runs log-only (NFR-028). A bad value under either key is an unusable configuration and denies like a bad phi_patterns
// value. The guard checks that a reference is present and never reads or assesses the agreement text. Known limit: a GitHub
// Enterprise or self-hosted Bitbucket host reached through gh or bkt is judged as the default platform host.
//
// Matching. A payload is denied when it matches a pattern (rule phi-outbound.pattern.<name>) or when a token of it, or one of
// its path suffixes, classifies as "PHI" (rule phi-outbound.path). A --body-file path is classified too (also through its
// real path), and its content is scanned. When a payload cannot be read from the command text (a value expanded at run time,
// stdin from a pipe), the whole command text is scanned, so $(cat data/patients.csv) is caught by the path it names. A payload
// over MAX_TEXT_CHARS, or a scan that outruns SCAN_BUDGET_MS, cannot be judged and is denied (rules phi-outbound.oversize and
// phi-outbound.timeout).
//
// [NFR-028] Security-critical guard: main() passes the classifier guardedClass to guard() in ../lib/health.js, so an evaluate
// error, an uncaught exception, or a timeout after the input was parsed denies a WebFetch call or a PR-post command, and the
// failure is logged. Reads and other tool calls still pass. Not covered, by the shared runtime: an input that cannot be read or
// parsed, a disabled guard (hooks-disabled.json), and a failure of the launcher before this module runs (an unsupported Node or
// a module that does not load); each lets the call proceed with a systemMessage. The deny is the PreToolUse JSON with exit 0,
// never a non-zero exit.
// [NFR-026] A deny is logged by guard() as a decision record in the governance audit log, under the rule id of the decision.
// [NFR-031] The denial message, the decision record, and every log line hold the rule or pattern name and the data class, never
// the matched PHI value, the payload, or a path.
//
// Known limits, recorded and not closed (FR-NFR-harness-governance.md section 4):
//   - A paraphrase of PHI escapes a pattern: the guard matches text, not meaning.
//   - The guard judges one call at a time and keeps no session state. It cannot tell that a payload carries content read earlier
//     from a PHI-tagged path; session-level taint tracking is out of scope.
//   - A payload built at run time (a variable, a pipe, a script that fetches or posts on its own), gh api, bkt api, a REST call, a
//     shell alias, and any other program that sends data are not covered.
//   - The bkt option names are best effort: the CLI is not installed where this was written, so a short bkt option that is not
//     listed above (for example a short title flag) is not read as payload text.
//   - A pattern is user supplied: a pattern with catastrophic backtracking blocks the process until the hook timeout; profile.json
//     is protected from subagent writes (FR-245), and its author owns the pattern cost.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const health = require("../lib/health.js");
const dataClass = require("../lib/data-class.js");
const prVerdict = require("../lib/pr-verdict.js");

const NAME = "phi-outbound-guard";
const RULE_PREFIX = "phi-outbound";
const PATTERNS_KEY = "phi_patterns";
const MAX_PATTERNS = 200;
const MAX_PATTERN_CHARS = 512;
const MAX_TEXT_CHARS = 1000000;
const SCAN_BUDGET_MS = 1500;
const MAX_TOKENS = 2000;
const MAX_TOKEN_CHARS = 500;
const MAX_SUFFIXES = 6;
const NAME_PATTERN = /^[A-Za-z0-9_.-]{1,40}$/;
const UNC_PATH = /^[\\/]{2}/;
// A candidate path inside free text: a run of characters that holds no space, quote, bracket, or separator.
const TOKEN_PATTERN = /[^\s"'`<>()[\]{},;|&*?=!]+/g;
// [FR-234] The host a PR-post command reaches by default, by CLI family.
const FAMILY_HOSTS = { gh: "github.com", bkt: "bitbucket.org" };
const BAA_RULE = `${RULE_PREFIX}.baa`;
const POST_VERBS = ["create", "edit", "comment", "review", "merge", "close", "approve", "decline", "update", "reply"];
// Words, in order, that mark a command as possibly posting to a PR: gh or bkt, then pr, then a post verb. The classifier reads
// the words loosely (a superset of what the parser accepts) because it runs only after the parser or the runtime failed.
const CLASS_STAGES = [["gh", "bkt"], ["pr"], POST_VERBS];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isShellTool(input) {
  return isObject(input) && (input.tool_name === "Bash" || input.tool_name === "PowerShell");
}

function commandOf(input) {
  return isObject(input.tool_input) && typeof input.tool_input.command === "string" ? input.tool_input.command : "";
}

function allow() {
  return { deny: false, reason: "" };
}

function deny(rule, detail) {
  return {
    deny: true,
    rule,
    reason: `assist-plugin ${NAME} denied this call: ${detail} Remove the PHI from the payload, or ask the user to review the PHI settings in .agent/governance/profile.json.`,
  };
}

function configDeny(problem) {
  return {
    deny: true,
    rule: `${RULE_PREFIX}.config`,
    reason: `assist-plugin ${NAME} denied this call: the HIPAA profile is enforced and the PHI configuration cannot be used (${problem}). ` +
      "Outbound calls stay denied until the user fixes .agent/governance/profile.json (run /assist-plugin:health for details).",
  };
}

// [FR-234] Denial for a call to an external system that has no BAA reference. Names the system, never a URL or a payload.
function baaDeny(system) {
  return {
    deny: true,
    rule: BAA_RULE,
    reason: `assist-plugin ${NAME} denied this call: the HIPAA profile is enforced and the external system "${system}" has no BAA reference ` +
      "(identifier, counterparty, date) under baa_references in .agent/governance/profile.json. Ask the user to record the reference, " +
      "or send nothing to that system (run /assist-plugin:health for the readiness report).",
  };
}

// ---- Configuration --------------------------------------------------------------------------------------------------

// {patterns: [{name, regex}]} or {problem} for the `phi_patterns` value of a loaded profile.
function compilePatterns(value) {
  if (value === undefined) return { patterns: [] };
  if (!Array.isArray(value) || value.length > MAX_PATTERNS) return { problem: "phi-patterns-bad-list" };
  const patterns = [];
  for (let i = 0; i < value.length; i++) {
    const entry = value[i];
    const source = isObject(entry) ? entry.pattern : entry;
    let name = `pattern-${i + 1}`;
    if (isObject(entry) && entry.name !== undefined) {
      if (typeof entry.name !== "string" || !NAME_PATTERN.test(entry.name)) return { problem: "phi-patterns-bad-name" };
      name = entry.name;
    }
    if (typeof source !== "string" || source.length === 0 || source.length > MAX_PATTERN_CHARS) return { problem: "phi-patterns-bad-pattern" };
    let regex;
    try {
      regex = new RegExp(source, "i");
    } catch (err) {
      return { problem: "phi-patterns-bad-pattern" };
    }
    if (regex.test("")) return { problem: "phi-patterns-bad-pattern" };
    patterns.push({ name, regex });
  }
  return { patterns };
}

// [FR-234] The host of a WebFetch url, lower-cased, or null when the url is not an absolute URL.
function hostOfUrl(url) {
  try {
    return typeof url === "string" ? new URL(url).hostname.toLowerCase() || null : null;
  } catch (err) {
    return null;
  }
}

// [FR-234] The hosts the covered call reaches: the WebFetch url host, or the default host of each PR-post platform.
function callHosts(input, targets) {
  if (input.tool_name === "WebFetch") {
    const host = hostOfUrl(isObject(input.tool_input) ? input.tool_input.url : undefined);
    return host === null ? [] : [host];
  }
  return targets.map((target) => FAMILY_HOSTS[target.family]).filter((host) => typeof host === "string");
}

// [FR-234] The first listed external system among `hosts` that has no BAA reference, or null.
function systemWithoutBaa(baa, hosts) {
  for (let i = 0; i < hosts.length; i++) {
    const missing = dataClass.systemsForHost(baa, hosts[i]).filter((name) => !dataClass.hasBaa(baa, name));
    if (missing.length > 0) return missing[0];
  }
  return null;
}

function hasPhiGlobs(profile) {
  const classes = isObject(profile.data_classes) ? profile.data_classes : {};
  return Array.isArray(classes[dataClass.CLASS_PHI]) && classes[dataClass.CLASS_PHI].length > 0;
}

// ---- Matching -------------------------------------------------------------------------------------------------------

// A scan budget shared by one evaluation. expired() is true once the deadline passes.
function makeBudget(now) {
  const clock = typeof now === "function" ? now : Date.now;
  const deadline = clock() + SCAN_BUDGET_MS;
  return { expired: () => clock() > deadline };
}

// The path forms of a token: the token and the suffixes that start after each "/" (so a/data/x.csv and a path from another
// checkout still meet a root-relative glob), at most MAX_SUFFIXES of them.
function pathForms(token) {
  const clean = token.replace(/^[@:.]+(?=[^./\\])/, "").replace(/[.:]+$/, "").replace(/\\/g, "/");
  if (clean.length === 0) return [];
  const forms = [clean];
  let at = clean.indexOf("/");
  while (at !== -1 && forms.length <= MAX_SUFFIXES) {
    if (at + 1 < clean.length) forms.push(clean.slice(at + 1));
    at = clean.indexOf("/", at + 1);
  }
  return forms;
}

// Returns the rule of the first hit for `text`, "timeout" when the budget ran out, or null. context: {patterns, loaded, root,
// budget, classify}.
function scanText(text, context) {
  for (let i = 0; i < context.patterns.length; i++) {
    if (context.budget.expired()) return { rule: `${RULE_PREFIX}.timeout`, kind: "timeout" };
    if (context.patterns[i].regex.test(text)) {
      return { rule: `${RULE_PREFIX}.pattern.${context.patterns[i].name.toLowerCase()}`, kind: "pattern", name: context.patterns[i].name };
    }
  }
  if (!context.hasGlobs) return null;
  const seen = new Set();
  const tokens = text.match(TOKEN_PATTERN) || [];
  for (let t = 0; t < tokens.length && seen.size < MAX_TOKENS; t++) {
    const token = tokens[t];
    if (token.length > MAX_TOKEN_CHARS || (token.indexOf("/") === -1 && token.indexOf("\\") === -1 && token.indexOf(".") === -1) || seen.has(token)) continue;
    seen.add(token);
    const forms = pathForms(token);
    for (let f = 0; f < forms.length; f++) {
      if (context.budget.expired()) return { rule: `${RULE_PREFIX}.timeout`, kind: "timeout" };
      if (context.classify(forms[f]) === dataClass.CLASS_PHI) return { rule: `${RULE_PREFIX}.path`, kind: "path" };
    }
  }
  return null;
}

// Reads a body file: a regular file only, at most MAX_TEXT_CHARS bytes. Returns {text, oversize} or null when the file cannot be
// read (a missing file means the post fails on its own).
function readBodyFile(file) {
  let fd = null;
  try {
    if (!fs.statSync(file).isFile()) return null;
    fd = fs.openSync(file, "r");
    const buffer = Buffer.alloc(MAX_TEXT_CHARS + 1);
    const count = fs.readSync(fd, buffer, 0, MAX_TEXT_CHARS + 1, 0);
    return { text: buffer.toString("utf8", 0, Math.min(count, MAX_TEXT_CHARS)), oversize: count > MAX_TEXT_CHARS };
  } catch (err) {
    return null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (closeError) {
        // nothing to release
      }
    }
  }
}

// Resolves a body-file argument against the hook input's cwd. Returns null for stdin, a run-time value, or a network share.
function resolveFile(value, cwd) {
  if (!value || value === "-" || value.indexOf("$") !== -1 || value.indexOf("`") !== -1 || value.indexOf("\u0000") !== -1 || UNC_PATH.test(value)) return null;
  let file = null;
  if (value === "~" || value.slice(0, 2) === "~/") file = path.join(os.homedir(), value.slice(1));
  else if (path.isAbsolute(value)) file = value;
  else if (typeof cwd === "string" && path.isAbsolute(cwd)) file = path.resolve(cwd, value);
  return file === null || UNC_PATH.test(file) ? null : file;
}

// The real path of a file, or null.
function realPathOf(file) {
  try {
    return fs.realpathSync(file);
  } catch (err) {
    return null;
  }
}

// Judges one source of a PR-post payload: returns a hit (see scanText) or null. A body-file is classified (by name and by real
// path) and its content is scanned.
function judgeSource(source, context, input, readFile) {
  if (source.kind !== "file") return judgeText(source.value, context);
  const file = resolveFile(source.path, input.cwd);
  if (file === null) return null;
  const names = [file];
  const real = realPathOf(file);
  if (real !== null && real !== file) names.push(real);
  for (let i = 0; i < names.length; i++) {
    if (context.classify(names[i]) === dataClass.CLASS_PHI) return { rule: `${RULE_PREFIX}.path`, kind: "path" };
  }
  const read = readFile(file);
  if (read === null) return null;
  if (read.oversize) return { rule: `${RULE_PREFIX}.oversize`, kind: "oversize" };
  return judgeText(read.text, context);
}

function judgeText(text, context) {
  if (typeof text !== "string" || text.length === 0) return null;
  if (text.length > MAX_TEXT_CHARS) return { rule: `${RULE_PREFIX}.oversize`, kind: "oversize" };
  return scanText(text, context);
}

function describeHit(hit) {
  if (hit.kind === "pattern") return `its payload matches the PHI pattern "${hit.name}".`;
  if (hit.kind === "path") return "its payload names a PHI-tagged path.";
  if (hit.kind === "oversize") return "its payload is too large to check.";
  return "the payload check ran out of time.";
}

// ---- Decision -------------------------------------------------------------------------------------------------------

// The text sources of a WebFetch call, or null when the tool input is not an object.
function fetchTexts(input) {
  const toolInput = isObject(input.tool_input) ? input.tool_input : {};
  return [toolInput.url, toolInput.prompt].filter((value) => typeof value === "string");
}

// The gh pr and bkt pr commands of a shell input that post (their verb is a post verb), as {family, verb, sources, expanded}.
function postTargets(input) {
  return prVerdict.postPayloads(commandOf(input), input.tool_name === "PowerShell").filter((target) => POST_VERBS.indexOf(target.verb) !== -1);
}

// [FR-233] Decision function. Returns {deny, reason, rule}; options (tests and the self-test): {root, readFile, now}.
// It reads neither agent_type nor agent_id: the rule binds every caller.
function evaluate(input, options) {
  if (!isObject(input)) return allow();
  const opts = options || {};
  let texts = [];
  const files = [];
  let targets = [];
  let whole = false;
  if (input.tool_name === "WebFetch") {
    texts = fetchTexts(input);
  } else if (isShellTool(input)) {
    targets = postTargets(input);
    if (targets.length === 0) return allow();
    targets.forEach((target) => {
      target.sources.forEach((source) => {
        if (source.kind === "file") files.push(source);
        else texts.push(source.value);
      });
      whole = whole || target.expanded;
    });
  } else {
    return allow();
  }

  const root = typeof opts.root === "string" ? opts.root : health.auditRoot(input);
  const state = dataClass.profileState({ root });
  if (state.hipaa !== true) return allow();
  const loaded = dataClass.loadProfile({ root });
  if (loaded.status === "malformed") return configDeny(loaded.problem);
  if (loaded.status === "absent") return loaded.problem === "no-project-root" ? configDeny(loaded.problem) : allow();
  const compiled = compilePatterns(loaded.profile[PATTERNS_KEY]);
  if (compiled.problem) return configDeny(compiled.problem);
  const baa = dataClass.baaSettings(loaded);
  if (baa.status !== "ok") return configDeny(baa.problem);
  const hasGlobs = hasPhiGlobs(loaded.profile);
  // [FR-234] Additive to the PHI checks: they run first and are unchanged; the BAA rule judges the call's external system after.
  const baaDecision = () => {
    const system = systemWithoutBaa(baa, callHosts(input, targets));
    return system === null ? allow() : baaDeny(system);
  };
  if (compiled.patterns.length === 0 && !hasGlobs) return baaDecision();

  const context = {
    patterns: compiled.patterns,
    hasGlobs,
    budget: makeBudget(opts.now),
    classify: (file) => dataClass.classify(file, { root, loaded }),
  };
  const readFile = typeof opts.readFile === "function" ? opts.readFile : readBodyFile;
  if (whole) texts.push(commandOf(input));
  for (let i = 0; i < texts.length; i++) {
    const hit = judgeText(texts[i], context);
    if (hit !== null) return deny(hit.rule, describeHit(hit));
  }
  for (let i = 0; i < files.length; i++) {
    const hit = judgeSource(files[i], context, input, readFile);
    if (hit !== null) return deny(hit.rule, describeHit(hit));
  }
  return baaDecision();
}

// [NFR-028] Cheap, non-throwing classifier for the fail-closed path: true for a WebFetch call, and for a shell command that
// holds the words gh or bkt, then pr, then a post verb.
function guardedClass(input) {
  try {
    if (isObject(input) && input.tool_name === "WebFetch") return true;
    if (!isShellTool(input)) return false;
    const words = commandOf(input).toLowerCase().split(/[^a-z0-9]+/);
    let stage = 0;
    for (let i = 0; i < words.length && stage < CLASS_STAGES.length; i++) {
      if (CLASS_STAGES[stage].indexOf(words[i]) !== -1) stage += 1;
    }
    return stage === CLASS_STAGES.length;
  } catch (err) {
    return false;
  }
}

function main() {
  health.guard(NAME, (input) => evaluate(input), { failClosedFor: guardedClass });
}

module.exports = { NAME, PATTERNS_KEY, BAA_RULE, evaluate, guardedClass, main };

if (require.main === module) main();
