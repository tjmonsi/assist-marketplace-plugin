// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// PreToolUse guard: restrict the solutions-architect agent's Bash tool to mermaid-cli (mmdc).
// Other agents and the main session are untouched (allowed, no output).
// Fail-open: this module exports evaluate(input, options) -> {deny, reason}, a decision function whose only I/O
// is file reads that a test can replace; the command is blocked only when evaluate positively returns deny. Any
// failure (exception, malformed input, unsupported Node, disable flag) lets the command run and shows a
// systemMessage warning (see ../lib/health.js). It is a guardrail, not a security boundary.
//
// mmdc is accepted only with a fixed flag allowlist. -i/--input takes a `.mmd` file and -o/--output takes a
// `.svg`, `.png`, or `.pdf` file, each under `specs/` or `<dir>/specs/`: a relative path with no empty, "." or
// ".." segment and no segment that starts with a dot, or [FR-093] an absolute path under the git root of the
// hook input's cwd whose part below the git root meets that same rule. That keeps the diagram output out of
// CLAUDE.md, hidden directories, and any file a later session loads. The file system is read for one thing: the
// walk from cwd up to the git root (lib/git-root.js, no git process), at most once per call and only when the
// command passed every other check and holds an absolute -i or -o value; options.findGitRoot replaces the walk
// in tests and in the health check. No git root found means every absolute value is denied. No npx download
// forms are accepted: when mmdc is missing the agent shows the user the install command and never installs
// anything itself.
"use strict";

const gitRoot = require("../lib/git-root.js");

const AGENT_PATTERN = /(^|:)solutions-architect$/;
// Shell metacharacters, variable/brace expansion, globbing, and history/home expansion.
const UNSAFE_CHARACTERS = /[;&|`<>\n\r$\{\\*?\[\]()~!]/;
const EXACT_COMMANDS = new Set(["which mmdc", "where mmdc", "mmdc --version"]);

const INPUT_PATH = "input-path";
const OUTPUT_PATH = "output-path";
const WORD_VALUE = /^#?[A-Za-z0-9_-]+$/;
const NUMBER_VALUE = /^\d+(\.\d+)?$/;
const ALLOWED_FLAGS = new Map([
  ["-i", INPUT_PATH], ["--input", INPUT_PATH],
  ["-o", OUTPUT_PATH], ["--output", OUTPUT_PATH],
  ["-t", WORD_VALUE], ["--theme", WORD_VALUE],
  ["-b", WORD_VALUE], ["--backgroundColor", WORD_VALUE],
  ["-w", NUMBER_VALUE], ["--width", NUMBER_VALUE],
  ["-H", NUMBER_VALUE], ["--height", NUMBER_VALUE],
  ["-s", NUMBER_VALUE], ["--scale", NUMBER_VALUE],
]);

const NAME = "sa-mermaid-only";
const DENY_REASON =
  "solutions-architect may only run mermaid-cli (mmdc) with -i/-o/-t/-b/-w/-H/-s, a .mmd input, and a .svg, .png, or .pdf output, " +
  "each under specs/ or <dir>/specs/, as a relative path or as an absolute path under the git root, " +
  "with no empty, . or .. segment and no segment starting with a dot. " +
  "If mmdc is missing, show the user: npm install -g @mermaid-js/mermaid-cli";
const ALLOW = { deny: false, reason: "" };

// Split into words, honoring whole-word "double" or 'single' quotes. A quote inside a bare word is rejected.
function tokenize(cmd) {
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = re.exec(cmd)) !== null) {
    if (match[3] !== undefined && /["']/.test(match[3])) return null;
    tokens.push(match[1] !== undefined ? match[1] : match[2] !== undefined ? match[2] : match[3]);
  }
  return tokens;
}

// A relative path of the form specs/<...>/<file> or <dir>/specs/<...>/<file> whose file name matches `extension`.
function isSpecsPath(value, extension) {
  if (!value || value.startsWith("-") || value.startsWith("/") || /^[A-Za-z]:/.test(value)) return false;
  const segments = value.split("/");
  if (segments.some((part) => part.length === 0 || part.charAt(0) === ".")) return false;
  const root = segments[0] === "specs" ? 0 : segments[1] === "specs" ? 1 : -1;
  return root !== -1 && segments.length > root + 1 && extension.test(segments[segments.length - 1]);
}

// True when `value` is absolute by the string rule fsa-write-bar uses (hooks/impl/fsa-write-bar.js): it starts
// with `/`, or with a drive letter, `:`, and `/`. A backslash never gets here (a metacharacter denies it first),
// and a drive-relative value such as `C:specs/a.mmd` is not absolute. The host platform is not asked, so a Linux
// host reads `C:/proj` as absolute too.
function isAbsolute(value) {
  return /^(\/|[A-Za-z]:\/)/.test(value);
}

// True when absolute `value` sits below the git root and the part below it meets the relative rule. R is the git
// root with backslashes turned into slashes and no trailing slash; the prefix compares with case, except that a
// drive-letter R compares without case. The part below R is not normalized first.
function isUnderRoot(value, root, extension) {
  const base = root.replace(/\\/g, "/").replace(/\/+$/, "");
  const prefix = base + "/";
  const head = value.slice(0, prefix.length);
  const same = /^[A-Za-z]:/.test(base) ? head.toLowerCase() === prefix.toLowerCase() : head === prefix;
  return same && isSpecsPath(value.slice(prefix.length), extension);
}

// Checks one flag value. An absolute path with the right extension is queued in `absolutes` and judged after the
// whole command passed (isUnderRoot), so the file system is read at most once and only when it matters.
function isValidValue(spec, value, absolutes) {
  const extension = spec === INPUT_PATH ? /\.mmd$/i : spec === OUTPUT_PATH ? /\.(svg|png|pdf)$/i : null;
  if (extension === null) return spec.test(value);
  if (!isAbsolute(value)) return isSpecsPath(value, extension);
  if (!extension.test(value)) return false;
  absolutes.push({ value, extension });
  return true;
}

function isAllowedMmdc(tokens, absolutes) {
  const args = tokens.slice(1);
  for (let i = 0; i < args.length; i++) {
    let flag = args[i];
    let value;
    const eq = flag.indexOf("=");
    if (flag.startsWith("--") && eq !== -1) {
      value = flag.slice(eq + 1);
      flag = flag.slice(0, eq);
    }
    const spec = ALLOWED_FLAGS.get(flag);
    if (spec === undefined) return false;
    if (value === undefined) value = args[++i];
    if (value === undefined || !isValidValue(spec, value, absolutes)) return false;
  }
  return true;
}

// The git root of the hook input's cwd, or null: no usable cwd (not a non-empty string that is absolute by the
// string rule), or no .git found. Called at most once per command. options.findGitRoot replaces the walk when it
// is a function; any other value counts as absent.
function findRoot(cwd, options) {
  if (typeof cwd !== "string" || cwd.length === 0 || !isAbsolute(cwd.replace(/\\/g, "/"))) return null;
  const find = options && typeof options.findGitRoot === "function" ? options.findGitRoot : gitRoot.findGitRoot;
  const found = find(cwd);
  return typeof found === "string" && found.length > 0 ? found : null;
}

function isAllowed(command, cwd, options) {
  const cmd = (command === undefined || command === null ? "" : String(command)).trim();
  if (UNSAFE_CHARACTERS.test(cmd)) return false;
  if (EXACT_COMMANDS.has(cmd)) return true;
  const tokens = tokenize(cmd);
  const absolutes = [];
  if (tokens === null || tokens[0] !== "mmdc" || !isAllowedMmdc(tokens, absolutes)) return false;
  if (absolutes.length === 0) return true;
  const root = findRoot(cwd, options);
  return root !== null && absolutes.every((entry) => isUnderRoot(entry.value, root, entry.extension));
}

// Decision function: its only I/O is the git-root walk for an absolute path (see the header). options:
// {findGitRoot} replaces the walk in tests.
function evaluate(input, options) {
  const agentType = input && input.agent_type !== undefined && input.agent_type !== null ? input.agent_type : "";
  if (!input || input.tool_name !== "Bash" || !AGENT_PATTERN.test(String(agentType))) return ALLOW;
  if (isAllowed(input.tool_input && input.tool_input.command, input.cwd, options)) return ALLOW;
  return { deny: true, reason: DENY_REASON };
}

function main() {
  require("../lib/health.js").guard(NAME, evaluate);
}

module.exports = { NAME, evaluate, main };

if (require.main === module) main();
