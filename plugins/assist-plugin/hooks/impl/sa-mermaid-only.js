// PreToolUse guard: restrict the solutions-architect agent's Bash tool to mermaid-cli (mmdc).
// Other agents and the main session are untouched (allowed, no output).
// Fail-open: this module exports a pure evaluate(input) -> {deny, reason}; the command is blocked only
// when evaluate positively returns deny. Any failure (exception, malformed input, unsupported Node,
// disable flag) lets the command run and shows a systemMessage warning (see ../lib/health.js).
// It is a guardrail, not a security boundary.
//
// mmdc is accepted only with a fixed flag allowlist. Path arguments (-i, -o) must be relative
// and contain no ".." segment. No npx download forms are accepted: when mmdc is missing the
// agent shows the user the install command and never installs anything itself.
"use strict";

const AGENT_PATTERN = /(^|:)solutions-architect$/;
// Shell metacharacters, variable/brace expansion, globbing, and history/home expansion.
const UNSAFE_CHARACTERS = /[;&|`<>\n\r$\{\\*?\[\]()~!]/;
const EXACT_COMMANDS = new Set(["which mmdc", "where mmdc", "mmdc --version"]);

const PATH_VALUE = "path";
const WORD_VALUE = /^#?[A-Za-z0-9_-]+$/;
const NUMBER_VALUE = /^\d+(\.\d+)?$/;
const ALLOWED_FLAGS = new Map([
  ["-i", PATH_VALUE], ["--input", PATH_VALUE],
  ["-o", PATH_VALUE], ["--output", PATH_VALUE],
  ["-t", WORD_VALUE], ["--theme", WORD_VALUE],
  ["-b", WORD_VALUE], ["--backgroundColor", WORD_VALUE],
  ["-w", NUMBER_VALUE], ["--width", NUMBER_VALUE],
  ["-H", NUMBER_VALUE], ["--height", NUMBER_VALUE],
  ["-s", NUMBER_VALUE], ["--scale", NUMBER_VALUE],
]);

const NAME = "sa-mermaid-only";
const DENY_REASON =
  "solutions-architect may only run mermaid-cli (mmdc) with -i/-o/-t/-b/-w/-H/-s and relative paths. " +
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

function isSafeRelativePath(value) {
  if (!value || value.startsWith("-") || value.startsWith("/") || /^[A-Za-z]:/.test(value)) return false;
  return !value.split("/").includes("..");
}

function isValidValue(spec, value) {
  return spec === PATH_VALUE ? isSafeRelativePath(value) : spec.test(value);
}

function isAllowedMmdc(tokens) {
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
    if (value === undefined || !isValidValue(spec, value)) return false;
  }
  return true;
}

function isAllowed(command) {
  const cmd = (command === undefined || command === null ? "" : String(command)).trim();
  if (UNSAFE_CHARACTERS.test(cmd)) return false;
  if (EXACT_COMMANDS.has(cmd)) return true;
  const tokens = tokenize(cmd);
  return tokens !== null && tokens[0] === "mmdc" && isAllowedMmdc(tokens);
}

// Pure decision function: no I/O, no process access.
function evaluate(input) {
  const agentType = input && input.agent_type !== undefined && input.agent_type !== null ? input.agent_type : "";
  if (!input || input.tool_name !== "Bash" || !AGENT_PATTERN.test(String(agentType))) return ALLOW;
  if (isAllowed(input.tool_input && input.tool_input.command)) return ALLOW;
  return { deny: true, reason: DENY_REASON };
}

function main() {
  require("../lib/health.js").guard(NAME, evaluate);
}

module.exports = { NAME, evaluate, main };

if (require.main === module) main();
