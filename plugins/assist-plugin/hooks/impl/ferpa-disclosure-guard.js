// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// PreToolUse guard for WebFetch and for Bash and PowerShell PR-post commands: when an outbound call carries education-record
// data, require a declared receiving party and a legitimate interest, check the party against the allowlist in
// .agent/governance/profile.json, record the disclosure, and deny the call otherwise (task plan Tranche 3, Step 27a;
// specs/spec-hooks-compliance.md, Requirement: FERPA disclosure recordation). It is the FERPA analogue of the PHI outbound
// guard (impl/phi-outbound-guard.js) and judges the same outbound surface.
//
// [FR-246|NFR-033] This is the only control cited against 34 CFR 99.32, which governs recording disclosures of education-record
// data to outside parties and makes the legitimate interest mandatory (99.32(a)(3)(ii)). Its status is "to verify" until the
// exception handling is reviewed. It is not marked complete and is not full 34 CFR 99 compliance: it records and gates an
// outbound call that this hook can see, and nothing else.
//
// Covered calls (the PHI guard's surface; the payload extraction is lib/pr-verdict.js postPayloads(), shared and not copied):
//   - WebFetch: the url and the prompt of the tool input
//   - gh pr and bkt pr commands that post (create, edit, comment, review, merge, close, approve, decline, update, reply): the
//     body, title, and text options and the --body-file, -F, and --text-file files, a heredoc fed to -F -, and the sh -c
//     string of a part. A body file is read from the hook input's cwd (a file read, which a guard may do), at most MAX_TEXT_CHARS.
//
// Carries education-record data. A call carries it when a payload text matches a `student_record_patterns` entry, or a token of
// it (or one of its path suffixes) or a body-file path classifies as "student-record" in lib/data-class.js. Any other call is
// allowed with no entry.
//
// Declaration source (PN-9). A subagent assembles the payload, so the payload text never decides which parties pass: the
// allowlist in the protected profile.json does. The payload only names the party and the interest, one line each:
//     Receiving-Party: district-registrar
//     Legitimate-Interest: accreditation-review
// The labels match case-insensitively with "-", "_", " ", or nothing between the words, and ":" or "=" before the value, so a
// WebFetch query string (?receiving_party=...&legitimate_interest=...) works too. The value is one token: the identifier
// the allowlist holds (letters, digits, ".", "_", "@", ":", "-") and a lowercase label of the same characters for the interest.
// Decision, in order:
//   1. More than one distinct party or interest declared: deny (ferpa-disclosure.ambiguous).
//   2. The party is covered by a `ferpa_exceptions` entry (34 CFR 99.32(d)): allow, record nothing.
//   3. No party, or a placeholder (unstated, none, n/a, ...): deny (ferpa-disclosure.missing-party).
//   4. No interest, or a placeholder: deny (ferpa-disclosure.missing-interest).
//   5. The party is not in `ferpa_receiving_parties`: deny (ferpa-disclosure.party-not-allowed). Nothing is logged.
//   6. Otherwise append one "ferpa-disclosure" event and allow the call. If the event cannot be appended the call is denied
//      (ferpa-disclosure.log-failed): a disclosure that cannot be recorded is not allowed.
// The log never holds `unstated` or any payload text for either field: the party is the allowlist's own identifier and the
// interest is a validated label.
//
// Configuration (lib/data-class.js ferpaSettings()). FERPA is enforced by default; the flag is read through lib/data-class.js,
// which parses the committed .claude/settings.json and never reads process.env. The profile.json keys:
//   "student_record_patterns": [{"name": "sid", "pattern": "\\bS\\d{8}\\b"}, "regex source"]   what marks a payload as education data
//   "ferpa_receiving_parties": ["district-registrar", "state-education-agency"]                the receiving-party allowlist
//   "ferpa_exceptions": [{"party": "parent-guardian", "exception": "99.32(d)(1)"}]            parties covered by a 99.32(d) exception
//   "data_classes": {"student-record": ["records/**"]}                                          paths that mark a payload as education data
//   - No profile.json: nothing is tagged and no pattern exists, so the guard runs log-only. It records nothing and never denies.
//   - A malformed profile.json, or a bad value under one of the keys above, while the FERPA profile is enforced: the guard
//     denies every covered call until the file is fixed. A project root that cannot be found counts as an unreadable configuration.
//   - FERPA opted out in the committed settings: the guard allows every call (the governed opt-out of FR-243 and FR-244).
//   - Neither a pattern nor a student-record glob is configured: nothing can mark a payload, so the guard allows every call.
//
// [NFR-028] Security-critical guard: main() passes guardedClass (the PHI guard's classifier, the same surface) to guard() in
// ../lib/health.js, so an evaluate error, an uncaught exception, or a timeout after the input was parsed denies a WebFetch call
// or a PR-post command, and the failure is logged. Reads and other tool calls still pass. Not covered, by the shared runtime: an
// input that cannot be read or parsed, a disabled guard (hooks-disabled.json), and a failure of the launcher before this module
// runs; each lets the call proceed with a systemMessage. The deny is the PreToolUse JSON with exit 0, never a non-zero exit.
// [NFR-026] A deny is logged by guard() as a decision record in the governance audit log, under the rule id of the decision. A
// recorded disclosure is an attributed event (operation "disclose", data_class "student-record", agent identity from
// lib/identity.js, human authorizer from lib/authorizer.js) with the tool, the receiving party, the legitimate interest, and the
// path when a tagged path was named.
// [NFR-031] The denial message, the decision record, and the disclosure event hold rule names, field names, the allowlist
// identifier, the label, the path, and the class tag, never education-record content or payload text.
//
// Known limits, recorded and not closed (FR-NFR-harness-governance.md section 4):
//   - Detection is imperfect: a paraphrase of education-record data escapes a pattern, because the guard matches text, not meaning.
//   - The guard judges one call at a time and keeps no session state. It cannot tell that a payload carries content read earlier
//     from a student-record path; session-level taint tracking is out of scope.
//   - The guard cannot tell whether the declared party is the real destination or whether the interest is legitimate. The
//     allowlist limits which names pass; it does not verify who receives the call.
//   - A path tagged both PHI and student-record is classified PHI (lib/data-class.js), so the PHI guard judges it, not this one.
//   - A payload built at run time (a variable, a pipe, a script that fetches or posts on its own), gh api, bkt api, a REST call, a
//     shell alias, and any other program that sends data are not covered. The bkt option names are best effort.
//   - A recorded disclosure is written before the call runs, so a call that another hook denies is still recorded as an attempt.
//   - A pattern is user supplied: a pattern with catastrophic backtracking blocks the process until the hook timeout; profile.json
//     is protected from subagent writes (FR-245), and its author owns the pattern cost.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const health = require("../lib/health.js");
const dataClass = require("../lib/data-class.js");
const identity = require("../lib/identity.js");
const prVerdict = require("../lib/pr-verdict.js");
const phiOutboundGuard = require("./phi-outbound-guard.js");

const NAME = "ferpa-disclosure-guard";
const RULE_PREFIX = "ferpa-disclosure";
const EVENT = "ferpa-disclosure";
const OPERATION = "disclose";
const MAX_TEXT_CHARS = 1000000;
const SCAN_BUDGET_MS = 1500;
const MAX_TOKENS = 2000;
const MAX_TOKEN_CHARS = 500;
const MAX_SUFFIXES = 6;
const MAX_DECLARATIONS = 20;
const UNC_PATH = /^[\\/]{2}/;
// A candidate path inside free text: a run of characters that holds no space, quote, bracket, or separator.
const TOKEN_PATTERN = /[^\s"'`<>()[\]{},;|&*?=!]+/g;
// The verbs of gh pr and bkt pr that post. The PHI guard judges the same list; a verb such as `list` reads a branch from -b.
const POST_VERBS = ["create", "edit", "comment", "review", "merge", "close", "approve", "decline", "update", "reply"];
// A legitimate-interest label: lowercase, one token.
const INTEREST_LABEL = /^[a-z0-9][a-z0-9._:-]{0,63}$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isShellTool(input) {
  return isObject(input) && (input.tool_name === "Bash" || input.tool_name === "PowerShell");
}

function commandOf(input) {
  return isObject(input.tool_input) && typeof input.tool_input.command === "string" ? input.tool_input.command : "";
}

function allow(disclosure) {
  return disclosure ? { deny: false, reason: "", disclosure } : { deny: false, reason: "" };
}

const DECLARE_HINT =
  "Declare the receiving party and the legitimate interest in the payload as 'Receiving-Party: <id>' and 'Legitimate-Interest: <label>', " +
  "with the party listed under ferpa_receiving_parties in .agent/governance/profile.json.";

function deny(rule, detail, hint) {
  return { deny: true, rule: `${RULE_PREFIX}.${rule}`, reason: `assist-plugin ${NAME} denied this call: ${detail}${hint === false ? "" : ` ${DECLARE_HINT}`}` };
}

function configDeny(problem) {
  return {
    deny: true,
    rule: `${RULE_PREFIX}.config`,
    reason: `assist-plugin ${NAME} denied this call: the FERPA profile is enforced and the FERPA configuration cannot be used (${problem}). ` +
      "Outbound calls stay denied until the user fixes .agent/governance/profile.json (run /assist-plugin:health for details).",
  };
}

// ---- Matching -------------------------------------------------------------------------------------------------------

// A scan budget shared by one evaluation. expired() is true once the deadline passes.
function makeBudget(now) {
  const clock = typeof now === "function" ? now : Date.now;
  const deadline = clock() + SCAN_BUDGET_MS;
  return { expired: () => clock() > deadline };
}

// The path forms of a token: the token and the suffixes that start after each "/" (so a/records/x.csv and a path from another
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

// The path as the event names it: relative to the project root with forward slashes when it lies inside the root.
function rootRelative(root, file) {
  if (!path.isAbsolute(file)) return file;
  const relative = path.relative(root, file);
  if (relative === "" || relative === ".." || relative.indexOf(`..${path.sep}`) === 0 || path.isAbsolute(relative)) return file;
  return relative.split(path.sep).join("/");
}

// The first hit in `text`, or null: {kind: "pattern", name}, {kind: "path", path}, or {kind: "timeout"}. context: {patterns,
// hasGlobs, budget, classify}.
function scanText(text, context) {
  for (let i = 0; i < context.patterns.length; i++) {
    if (context.budget.expired()) return { kind: "timeout" };
    if (context.patterns[i].regex.test(text)) return { kind: "pattern", name: context.patterns[i].name };
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
      if (context.budget.expired()) return { kind: "timeout" };
      if (context.classify(forms[f]) === dataClass.CLASS_STUDENT) return { kind: "path", path: forms[f] };
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

// ---- Declaration ----------------------------------------------------------------------------------------------------

// A declaration line: the label, ":" or "=", then one token. A markdown emphasis mark or a quote around the label or the value
// is skipped.
function declarationPattern(label) {
  return new RegExp(`(?:^|[^A-Za-z0-9])${label}[*_"'\`]*[ \\t]*[:=][*_"'\`]*[ \\t]*["'\`]?([A-Za-z0-9][^\\s,;&"'\`<>*]{0,127})`, "gi");
}

const PARTY_DECLARATION = "receiving[-_ ]?party";
const INTEREST_DECLARATION = "legitimate[-_ ]?interest";

// The distinct values declared under `label` across `texts`, lowercased with trailing "." and ":" removed.
function declaredValues(texts, label) {
  const found = new Set();
  texts.forEach((text) => {
    const pattern = declarationPattern(label);
    let match = pattern.exec(text);
    for (let count = 0; match !== null && count < MAX_DECLARATIONS; count++) {
      found.add(match[1].replace(/[.:]+$/, "").toLowerCase());
      match = pattern.exec(text);
    }
  });
  return Array.from(found);
}

function isPlaceholder(value) {
  return dataClass.PLACEHOLDERS.indexOf(value) !== -1;
}

// The allowlist identifier that equals `party` ignoring case, or null.
function canonical(list, party) {
  for (let i = 0; i < list.length; i++) {
    if (list[i].toLowerCase() === party) return list[i];
  }
  return null;
}

// The decision for a payload that carries education-record data: texts are every payload text read, hit the first match.
function judgeDisclosure(texts, hit, settings, root) {
  const parties = declaredValues(texts, PARTY_DECLARATION);
  const interests = declaredValues(texts, INTEREST_DECLARATION);
  if (parties.length > 1 || interests.length > 1) {
    return deny("ambiguous", "the payload declares more than one receiving party or legitimate interest.");
  }
  const party = parties.length === 1 && !isPlaceholder(parties[0]) ? parties[0] : null;
  // [FR-246] A party covered by a 99.32(d) exception needs no disclosure entry.
  if (party !== null && settings.exceptions.some((entry) => entry.party.toLowerCase() === party)) return allow();
  if (party === null) return deny("missing-party", "its payload carries education-record data and declares no receiving party.");
  const interest = interests.length === 1 && !isPlaceholder(interests[0]) && INTEREST_LABEL.test(interests[0]) ? interests[0] : null;
  if (interest === null) return deny("missing-interest", "its payload carries education-record data and declares no legitimate interest.");
  const listed = canonical(settings.parties, party);
  if (listed === null) return deny("party-not-allowed", "the receiving party it declares is not on the allowlist in profile.json.");
  const disclosure = { party: listed, interest };
  if (hit.kind === "path") disclosure.path = rootRelative(root, hit.path);
  return allow(disclosure);
}

// ---- Decision -------------------------------------------------------------------------------------------------------

// The text sources of a WebFetch call.
function fetchTexts(input) {
  const toolInput = isObject(input.tool_input) ? input.tool_input : {};
  return [toolInput.url, toolInput.prompt].filter((value) => typeof value === "string");
}

// The gh pr and bkt pr commands of a shell input that post (their verb is a post verb), as {family, verb, sources, expanded}.
function postTargets(input) {
  return prVerdict.postPayloads(commandOf(input), input.tool_name === "PowerShell").filter((target) => POST_VERBS.indexOf(target.verb) !== -1);
}

// Reads every payload of the call. Returns {texts, hit} where `texts` is every payload text read and `hit` the first
// education-record match or null, or {deny} when a payload cannot be judged (too large, or the scan outran its budget).
function readPayloads(texts, files, context, input, readFile, root) {
  const all = [];
  let hit = null;
  const unjudgeable = (kind) => ({ deny: deny(kind, kind === "oversize" ? "its payload is too large to check." : "the payload check ran out of time.", false) });
  const take = (text) => {
    if (typeof text !== "string" || text.length === 0) return null;
    if (text.length > MAX_TEXT_CHARS) return unjudgeable("oversize");
    all.push(text);
    if (hit === null) {
      const found = scanText(text, context);
      if (found !== null && found.kind === "timeout") return unjudgeable("timeout");
      hit = found;
    }
    return null;
  };
  for (let i = 0; i < texts.length; i++) {
    const stop = take(texts[i]);
    if (stop !== null) return stop;
  }
  for (let i = 0; i < files.length; i++) {
    const file = resolveFile(files[i].path, input.cwd);
    if (file === null) continue;
    const names = [file];
    const real = realPathOf(file);
    if (real !== null && real !== file) names.push(real);
    if (hit === null) {
      for (let n = 0; n < names.length; n++) {
        if (context.classify(names[n]) === dataClass.CLASS_STUDENT) {
          hit = { kind: "path", path: rootRelative(root, names[n]) };
          break;
        }
      }
    }
    const read = readFile(file);
    if (read === null) continue;
    if (read.oversize) return unjudgeable("oversize");
    const stop = take(read.text);
    if (stop !== null) return stop;
  }
  return { texts: all, hit };
}

// [FR-246] Decision function. Returns {deny, reason, rule} and, for a call to record, `disclosure` {party, interest, path?}.
// options (tests and the self-test): {root, readFile, now}. It reads neither agent_type nor agent_id: the rule binds every
// caller. It writes nothing; run() records the disclosure.
function evaluate(input, options) {
  if (!isObject(input)) return allow();
  const opts = options || {};
  let texts = [];
  const files = [];
  let whole = false;
  if (input.tool_name === "WebFetch") {
    texts = fetchTexts(input);
  } else if (isShellTool(input)) {
    const targets = postTargets(input);
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
  if (state.ferpa !== true) return allow();
  const loaded = dataClass.loadProfile({ root });
  if (loaded.status === "malformed") return configDeny(loaded.problem);
  if (loaded.status === "absent") return loaded.problem === "no-project-root" ? configDeny(loaded.problem) : allow();
  const settings = dataClass.ferpaSettings(loaded);
  if (settings.status !== "ok") return configDeny(settings.problem);
  const classes = isObject(loaded.profile.data_classes) ? loaded.profile.data_classes : {};
  const hasGlobs = Array.isArray(classes[dataClass.CLASS_STUDENT]) && classes[dataClass.CLASS_STUDENT].length > 0;
  if (settings.patterns.length === 0 && !hasGlobs) return allow();

  const context = {
    patterns: settings.patterns,
    hasGlobs,
    budget: makeBudget(opts.now),
    classify: (file) => dataClass.classify(file, { root, loaded }),
  };
  const readFile = typeof opts.readFile === "function" ? opts.readFile : readBodyFile;
  if (whole) texts.push(commandOf(input));
  const read = readPayloads(texts, files, context, input, readFile, root);
  if (read.deny) return read.deny;
  if (read.hit === null) return allow();
  return judgeDisclosure(read.texts, read.hit, settings, root);
}

// ---- Record ---------------------------------------------------------------------------------------------------------

// [FR-246|NFR-031] The disclosure event: the five attribution fields (operation, path and data_class, agent identity, human
// authorizer, timestamp added at append), the tool, the receiving party, and the legitimate interest.
function disclosureRecord(input, root, disclosure) {
  const parts = Object.assign({ event: EVENT, operation: OPERATION, data_class: dataClass.CLASS_STUDENT }, identity.fields(input), health.auditAuthorizer(input, root));
  if (typeof disclosure.path === "string") parts.path = disclosure.path;
  const attributed = health.auditAttribute(parts);
  // attribute() copies the attribution fields only; the tool and the two disclosure fields are added beside them.
  return Object.assign({}, attributed, { tool: input.tool_name, receiving_party: disclosure.party, legitimate_interest: disclosure.interest });
}

// Appends the disclosure event. Returns true when it was written. options.sink replaces the audit-log write (tests and the
// self-test, which write no real log). Never throws.
function record(input, root, disclosure, options) {
  try {
    const entry = disclosureRecord(input, root, disclosure);
    const sink = options && typeof options.sink === "function" ? options.sink : (line) => health.auditAppend(NAME, root, line);
    return sink(entry) !== false;
  } catch (err) {
    health.logEvent(NAME, "disclosure-record-error", health.describeError(err));
    return false;
  }
}

// Decides a call and records its disclosure. A disclosure that cannot be recorded is denied. options: {root, sink, readFile, now}.
function run(input, options) {
  const opts = options || {};
  const decision = evaluate(input, opts);
  if (decision.deny === true || !decision.disclosure) return decision;
  const root = typeof opts.root === "string" ? opts.root : health.auditRoot(input);
  if (record(input, root, decision.disclosure, opts)) return decision;
  return deny("log-failed", "the disclosure could not be written to the audit log, so it is not recorded.");
}

function main() {
  health.guard(NAME, (input) => run(input), { failClosedFor: phiOutboundGuard.guardedClass });
}

module.exports = { NAME, EVENT, evaluate, run, record, guardedClass: phiOutboundGuard.guardedClass, main };

if (require.main === module) main();
