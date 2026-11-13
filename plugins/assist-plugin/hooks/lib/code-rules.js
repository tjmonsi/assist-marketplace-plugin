// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-220|FR-238] Insecure generated-code rules and the code-file class for the code-scan hook (impl/code-scan.js). Spec:
// specs/spec-hooks-code-scan.md (Requirements: Advisory scan of a code-file write, Code-file class and no overlap with
// prose-gate).
//
// This is a HEURISTIC ADVISORY SIGNAL, not a security boundary and not a replacement for a SAST scanner. A match means one
// line has the shape of a known insecure pattern (a string-built SQL statement, a shell command built from a variable, a
// disabled TLS check); a miss proves nothing. Not covered: a statement built over several lines, a value tainted two
// assignments earlier, an obfuscated or encoded payload, and any language outside CODE_EXTENSIONS. Each rule carries the
// severity and confidence that lib/severity.js route() reads; the policy basis is rules/severity-policy.md. While a rule is
// advisory the hook records a would-deny finding and blocks nothing [FR-238].
//
// Rule-based by decision (DECISIONS.md, 2026-10-30, D-13): no model, no network, no I/O, no state. Pure functions.
//
// Per-write cost [NFR-029]:
//   - A rule names `needles`, lower-case words of which at least one must appear in the text before any line is tried
//     against the rule, so a file with no SQL word never runs a SQL pattern.
//   - Every quantifier is bounded, with no nested open-ended repetition, and a line is cut to MAX_LINE characters. The
//     text is capped to MAX_TEXT, and a scan stops at TIME_BUDGET_MS and reports what it found so far.
//   - No regular expression uses lookbehind, a named group, or the s flag, so the file parses from Node 6.
"use strict";

// [FR-220] The standard code-extension set: the guarded NFR-028 class (a write of a code file). `jsx` is included by the
// user's sign-off decision. Prose and data extensions (.md, .json, .yaml, .yml, .txt) are never in it, so code-scan never
// overlaps prose-gate (spec-hooks-prose-hooks.md).
const CODE_EXTENSIONS = Object.freeze(["js", "mjs", "cjs", "ts", "tsx", "jsx", "py", "sh", "bash", "sql", "go", "java", "rb", "php", "pl", "ps1"]);
const EXCLUDED_DIRECTORY = "docs";

const MAX_PATH = 4096;
const MAX_LINE = 1000;
const MAX_TEXT = 1000000;
const MAX_FINDINGS = 10;
const TIME_BUDGET_MS = 15;
const CLOCK_EVERY = 100; // lines between clock reads

// The file extension of `file` in lower case without the dot, or "" for none.
function extensionOf(file) {
  const base = String(file).split(/[\\/]/).pop();
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot + 1).toLowerCase();
}

// The path with forward slashes, relative to `root` when it sits inside it.
function relativePath(file, root) {
  let text = String(file).replace(/\\/g, "/");
  if (typeof root === "string" && root.length > 0) {
    const base = root.replace(/\\/g, "/").replace(/\/+$/, "") + "/";
    if (text.indexOf(base) === 0) text = text.slice(base.length);
  }
  return text.replace(/^\.\//, "");
}

// [FR-220] True when `file` is a code file the hook judges: its extension is in CODE_EXTENSIONS and its path does not start
// with docs/ (relative to `root` when one is given). A path that is not a usable string is not a code file.
function isCodeFile(file, root) {
  if (typeof file !== "string" || file.length === 0 || file.length > MAX_PATH || file.indexOf("\0") !== -1) return false;
  if (CODE_EXTENSIONS.indexOf(extensionOf(file)) === -1) return false;
  return relativePath(file, root).split("/")[0].toLowerCase() !== EXCLUDED_DIRECTORY;
}

// ---- Rule catalog ----------------------------------------------------------------------------------------------------

// A SQL statement shape inside one quoted string: select..from, insert into, update..set, delete from. `skip` is the body
// of the negated character class that keeps each gap inside one literal and bounds it (the quote characters of the
// literal, plus the line break).
function sql(skip) {
  return "\\b(?:select\\b[^" + skip + "]{1,150}?\\bfrom\\b|insert\\s+into\\b|update\\b[^" + skip + "]{1,80}?\\bset\\b|delete\\s+from\\b)";
}
const SQL_NEEDLES = ["select", "insert", "update", "delete"];

// The start of a literal opened by quote `q` that holds a SQL statement shape, up to where a variable can enter it. The gaps
// stop at `q` and the line break only, so another quote kind inside the literal (WHERE name = ') is allowed, as it is in the
// most common string-built query.
function sqlOpen(q) {
  return q + "[^" + q + "\\n]{0,150}" + sql(q + "\\n") + "[^" + q + "\\n]{0,200}";
}

// A double- or single-quoted literal that holds a SQL statement shape, closing quote included.
function sqlLiteral() {
  return "(?:" + sqlOpen("\"") + "\"|" + sqlOpen("'") + "')";
}

// A rule is {id, severity, confidence, pattern, needles, fix}. `id` is a lower-case identifier (the audit log's rule id
// pattern and severity.js ID_PATTERN). severity is CRITICAL, HIGH, MEDIUM, or LOW; confidence is High, Medium, or Low.
// `pattern` runs on one line and has no g or y flag, so it holds no state between calls. `fix` is the one-line remedy a
// denial would show.
function rule(id, severity, confidence, source, needles, fix) {
  return Object.freeze({ id, severity, confidence, pattern: new RegExp(source, "i"), needles: Object.freeze(needles), fix });
}

const RULES = Object.freeze([
  // SQL built from a variable: the FR-220 target class (rules/severity-policy.md, HIGH example).
  rule(
    "sql-string-concat",
    "HIGH",
    "High",
    sqlLiteral() + "\\s*(?:\\+|\\|\\||\\.\\s*\\$)\\s*[A-Za-z_$(]",
    SQL_NEEDLES,
    "bind the value as a query parameter instead of concatenating it into the SQL string"
  ),
  rule(
    "sql-string-interpolation",
    "HIGH",
    "High",
    "(?:" + sqlOpen("`") + "\\$\\{|" + sqlOpen("\"") + "(?:\\$\\{|#\\{|\\$[A-Za-z_])|\\b[fF][rR]?(?:" + sqlOpen("\"") + "|" + sqlOpen("'") + ")\\{[^}\\n]{1,80}\\})",
    SQL_NEEDLES,
    "bind the value as a query parameter instead of interpolating it into the SQL string"
  ),
  rule(
    "sql-string-format",
    "HIGH",
    "High",
    "(?:" + sqlLiteral() + "\\s*(?:%\\s*[A-Za-z_(\\[]|\\.format\\s*\\()" +
      "|\\b(?:Sprintf|format)\\s*\\(\\s*(?:" + sqlOpen("\"") + "|" + sqlOpen("`") + ")%[sdvq])",
    SQL_NEEDLES,
    "bind the value as a query parameter instead of formatting it into the SQL string"
  ),
  // A shell command built from a variable.
  rule(
    "shell-exec-interpolation",
    "HIGH",
    "High",
    "\\b(?:exec|execSync)\\s*\\(\\s*(?:`[^`\\n]{0,200}\\$\\{|[\"'][^\"'\\n]{0,200}[\"']\\s*\\+\\s*[A-Za-z_$(])",
    ["exec"],
    "pass the command and its arguments as an array (execFile or spawn) instead of building a shell string"
  ),
  rule(
    "shell-os-command-from-input",
    "HIGH",
    "High",
    "\\bos\\.(?:system|popen)\\s*\\(\\s*(?:[fF][\"']|[\"'][^\"'\\n]{0,200}[\"']\\s*(?:\\+|%|\\.format\\s*\\()|[A-Za-z_]\\w{0,40}\\s*\\+)",
    ["os."],
    "call subprocess.run with an argument list and no shell instead of building a shell string"
  ),
  rule(
    "php-command-from-request",
    "HIGH",
    "High",
    "\\b(?:system|shell_exec|passthru|popen|proc_open|exec)\\s*\\([^)\\n]{0,100}\\$_(?:GET|POST|REQUEST|COOKIE)\\b",
    ["$_"],
    "never pass request data to a shell function; use escapeshellarg or avoid the shell"
  ),
  rule(
    "shell-eval-variable",
    "HIGH",
    "Medium",
    "(?:^|[\\s;&|(])eval\\s+[\"']?\\$[{A-Za-z_(]",
    ["eval"],
    "do not eval a variable; call the command directly with quoted arguments"
  ),
  rule(
    "subprocess-shell-true",
    "MEDIUM",
    "Medium",
    "\\bsubprocess\\.(?:run|call|Popen|check_output|check_call)\\s*\\([^\\n]{0,200}\\bshell\\s*=\\s*True\\b",
    ["shell"],
    "pass an argument list and leave shell off"
  ),
  rule(
    "code-eval-dynamic",
    "HIGH",
    "Medium",
    "(?:^|[^.\\w$])eval\\s*\\(\\s*[^\"'`\\s)]",
    ["eval"],
    "do not evaluate text built at run time; parse the data or call a fixed function"
  ),
  rule(
    "unsafe-deserialization",
    "HIGH",
    "Medium",
    "\\b(?:pickle|marshal|dill|cPickle)\\.loads?\\s*\\(|\\byaml\\.load\\s*\\((?![^)\\n]{0,120}Safe)|\\bunserialize\\s*\\(\\s*\\$_|\\bnew\\s+ObjectInputStream\\s*\\(",
    ["pickle", "marshal", "dill", "yaml", "unserialize", "objectinputstream"],
    "deserialize with a data-only format (JSON) or a safe loader, never untrusted input"
  ),
  rule(
    "tls-verification-disabled",
    "HIGH",
    "Medium",
    "\\brejectUnauthorized\\s*:\\s*false\\b|\\bverify\\s*=\\s*False\\b|\\bInsecureSkipVerify\\s*:\\s*true\\b|NODE_TLS_REJECT_UNAUTHORIZED\\s*=\\s*[\"']?0|CURLOPT_SSL_VERIFYPEER\\s*,\\s*(?:false|0)\\b",
    ["rejectunauthorized", "verify", "insecureskipverify", "node_tls_reject_unauthorized", "curlopt_ssl_verifypeer"],
    "keep certificate verification on; trust a private CA through the CA bundle instead"
  ),
  rule(
    "dom-xss-sink",
    "MEDIUM",
    "Medium",
    "\\.(?:innerHTML|outerHTML)\\s*\\+?=(?!=)(?!\\s*(?:\"\"|''|``)\\s*;?\\s*$)|\\bdangerouslySetInnerHTML\\b|\\bdocument\\.write(?:ln)?\\s*\\(",
    ["innerhtml", "outerhtml", "dangerouslysetinnerhtml", "document.write"],
    "set textContent, or sanitize the markup before it reaches the DOM"
  ),
  rule(
    "hardcoded-credential",
    "HIGH",
    "Medium",
    "(?:api[_-]?key|secret|passwd|password|token)\\w{0,20}[\"']?\\s{0,3}[:=]\\s{0,3}[\"'][A-Za-z0-9/+_.-]{20,255}[\"']|\\b(?:AKIA|ASIA)[0-9A-Z]{16}\\b",
    ["key", "secret", "passwd", "password", "token", "akia", "asia"],
    "read the credential from the environment or a secret store"
  ),
  rule(
    "weak-hash-algorithm",
    "MEDIUM",
    "Low",
    "\\bcreateHash\\s*\\(\\s*[\"'](?:md5|sha1)[\"']|\\bhashlib\\.(?:md5|sha1)\\s*\\(|\\bMessageDigest\\.getInstance\\s*\\(\\s*[\"'](?:md5|sha-?1)[\"']",
    ["md5", "sha1", "sha-1"],
    "use SHA-256 or stronger, and a password hash (bcrypt, scrypt, argon2) for passwords"
  ),
]);

const COMMENT_LINE = /^\s*(?:\/\/|#|\/\*|\*|--|<!--)/;

function clock() {
  return Date.now();
}

// [FR-220] The findings of `text`: [{rule_id, severity, confidence, line, fix}], ordered by line, at most one per rule and
// line, at most MAX_FINDINGS. `line` is 1-based within `text`. A comment line is not judged. Returns [] for a text that is
// not a string. A scan that runs past TIME_BUDGET_MS stops and returns what it has [NFR-029]. Pure: no I/O.
function scan(text) {
  if (typeof text !== "string" || text.length === 0) return [];
  const body = text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
  const lower = body.toLowerCase();
  const active = RULES.filter((entry) => entry.needles.some((needle) => lower.indexOf(needle) !== -1));
  if (active.length === 0) return [];
  const started = clock();
  const lines = body.split("\n");
  const found = [];
  for (let i = 0; i < lines.length && found.length < MAX_FINDINGS; i++) {
    if (i % CLOCK_EVERY === CLOCK_EVERY - 1 && clock() - started > TIME_BUDGET_MS) break;
    const line = lines[i].length > MAX_LINE ? lines[i].slice(0, MAX_LINE) : lines[i];
    if (COMMENT_LINE.test(line)) continue;
    for (let r = 0; r < active.length && found.length < MAX_FINDINGS; r++) {
      if (active[r].pattern.test(line)) {
        found.push({ rule_id: active[r].id, severity: active[r].severity, confidence: active[r].confidence, line: i + 1, fix: active[r].fix });
      }
    }
  }
  return found;
}

// The rule with this id, or null.
function ruleById(id) {
  for (let i = 0; i < RULES.length; i++) {
    if (RULES[i].id === id) return RULES[i];
  }
  return null;
}

module.exports = { CODE_EXTENSIONS, RULES, MAX_TEXT, MAX_FINDINGS, TIME_BUDGET_MS, extensionOf, isCodeFile, scan, ruleById };
