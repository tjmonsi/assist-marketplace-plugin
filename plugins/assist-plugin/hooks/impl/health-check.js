// Health check for the assist-plugin PreToolUse guards.
//
// Self-tests each guard's evaluate() with fixed known-allow and known-deny commands:
//   - known-allow denied  -> the guard is buggy: write it to ${CLAUDE_PLUGIN_DATA}/hooks-disabled.json
//                            (it then passes commands through with a warning) and report it
//   - known-deny allowed  -> report that protection is weak (the guard stays enabled)
//   - all cases correct   -> remove the guard from hooks-disabled.json
//
// Modes:
//   --session-start  SessionStart hook. Prints {"systemMessage": ...} ONLY when something is wrong
//                    (failed self-test, disabled guard, hook failures newer than the last notice);
//                    silent when healthy. Never prints plain text (it would enter Claude's context).
//   (default)        Prints a readable report to stdout (used by /assist-plugin:health).
//   --clear          With the default mode, truncate hook-health.jsonl after showing it.
//   --data-dir DIR   Use DIR instead of $CLAUDE_PLUGIN_DATA (the skill passes the substituted path
//                    because a Bash tool call may not inherit the variable). Empty DIR is ignored.
//
// Fail-open: any error prints a systemMessage and exits 0. It never exits 2.
"use strict";

const NAME = "health-check";
const WATCHDOG_MS = 8000;
const REPORT_LOG_ROWS = 20;

const health = require("../lib/health.js");
const launch = require("../lib/launch.js");
const docCliGuard = require("./doc-cli-guard.js");
const saMermaidOnly = require("./sa-mermaid-only.js");

const SOLUTIONS_ARCHITECT = "solutions-architect";

function bash(command, agentType) {
  return { tool_name: "Bash", agent_type: agentType || "", tool_input: { command } };
}

// Fixed self-test cases (command text here is test data, never user input).
const GUARDS = [
  {
    name: docCliGuard.NAME,
    evaluate: docCliGuard.evaluate,
    allow: [
      bash("git status"),
      bash("firecrawl scrape https://x --only-main-content"),
      bash("ctx7 library react --json"),
      bash("firecrawl search \"q\" --json", "dev"),
      bash("timeout 30 firecrawl scrape https://x --only-main-content"),
      bash("env NO_COLOR=1 firecrawl search \"react hooks\" --json"),
      bash("FOO=bar ctx7 library react --json"),
      bash("nice -n 5 firecrawl scrape https://x --only-main-content"),
      bash("firecrawl search \"it's fine\" --json"),
      { tool_name: "Read", tool_input: { file_path: "x" } },
    ],
    deny: [
      bash("firecrawl scrape https://x -o /tmp/a --only-main-content"),
      bash("ctx7 docs /a/b \"t\" --base-url http://e --json"),
      bash("ctx7 docs /a/b \"t\" --json; rm x"),
      bash("firecrawl env"),
      bash("ctx7 setup"),
      bash("ctx7 login"),
      bash("firecrawl search \"$(id)\" --json"),
      bash("firecrawl scrape https://x --output=a --only-main-content"),
      bash("firecrawl scrape https://x -Xo f --only-main-content"),
      bash("firecrawl search q --api-url https://e --json"),
      bash("timeout 30 firecrawl scrape https://x -o a --only-main-content"),
      bash("FIRECRAWL_API_URL=https://e firecrawl search q --json"),
      bash("env CONTEXT7_BASE_URL=http://e ctx7 library react --json"),
      bash("command firecrawl search q --output=a"),
    ],
  },
  {
    name: saMermaidOnly.NAME,
    evaluate: saMermaidOnly.evaluate,
    allow: [
      bash("which mmdc", SOLUTIONS_ARCHITECT),
      bash("where mmdc", SOLUTIONS_ARCHITECT),
      bash("mmdc --version", SOLUTIONS_ARCHITECT),
      bash("mmdc -i a.mmd -o a.svg", SOLUTIONS_ARCHITECT),
      bash("mmdc -i docs/a.mmd -o docs/a.png -t dark -b transparent -w 800 -H 600 -s 2", SOLUTIONS_ARCHITECT),
      bash("mmdc --input a.mmd --output a.svg --theme dark --width 800", SOLUTIONS_ARCHITECT),
      bash("mmdc -i a.mmd -o \"my dir/a.svg\"", "plugin:assist:solutions-architect"),
      bash("mmdc -i a.mmd -o a.svg", "dev"),
      bash("rm -rf /", "dev"),
      bash("rm -rf /"),
    ],
    deny: [
      bash("mmdc -i a.mmd -o ../x.md", SOLUTIONS_ARCHITECT),
      bash("mmdc -i a.mmd -p cfg.json", SOLUTIONS_ARCHITECT),
      bash("mmdc -i a.mmd -o $HOME/x", SOLUTIONS_ARCHITECT),
      bash("npx @mermaid-js/mermaid-cli -i a", SOLUTIONS_ARCHITECT),
      bash("npx -y @mermaid-js/mermaid-cli -i a", SOLUTIONS_ARCHITECT),
      bash("mmdc -i a.mmd -o /etc/x", SOLUTIONS_ARCHITECT),
      bash("mmdc -i a.mmd; rm -rf x", SOLUTIONS_ARCHITECT),
      bash("rm -rf /", SOLUTIONS_ARCHITECT),
      bash("mmdc -i {a,b}.mmd", SOLUTIONS_ARCHITECT),
    ],
  },
];

function describeCase(input) {
  const command = input.tool_input && (input.tool_input.command || input.tool_input.file_path);
  return `${input.tool_name}${input.agent_type ? ` [${input.agent_type}]` : ""}: ${command}`;
}

// Runs one guard's cases. Returns the failures by kind plus the case counts.
function selfTest(guard) {
  const result = { name: guard.name, falseDeny: [], falseAllow: [], errors: [], allowCount: guard.allow.length, denyCount: guard.deny.length };
  const check = (input, expectDeny, failures) => {
    let decision;
    try {
      decision = guard.evaluate(input);
    } catch (err) {
      result.errors.push(`${describeCase(input)} (${health.describeError(err)})`);
      return;
    }
    const denied = !!(decision && decision.deny === true);
    if (denied !== expectDeny) failures.push(describeCase(input));
  };
  guard.allow.forEach((input) => check(input, false, result.falseDeny));
  guard.deny.forEach((input) => check(input, true, result.falseAllow));
  result.ok = result.falseDeny.length === 0 && result.falseAllow.length === 0 && result.errors.length === 0;
  return result;
}

// Applies self-test results to hooks-disabled.json (only when it can be persisted).
// Returns notes for the report and whether the file contents changed.
function updateDisabled(results, disabled, canPersist) {
  const notes = [];
  let changed = false;
  results.forEach((result) => {
    const listed = Object.prototype.hasOwnProperty.call(disabled, result.name);
    if (result.falseDeny.length > 0 && canPersist) {
      const reason = `self-test: known-safe command denied (${result.falseDeny.length} case${result.falseDeny.length === 1 ? "" : "s"})`;
      disabled[result.name] = { reason, ts: new Date().toISOString() };
      result.disabledNow = true;
      changed = true;
      notes.push(`${result.name} disabled: ${reason}`);
    } else if (result.ok && listed) {
      delete disabled[result.name];
      changed = true;
      notes.push(`${result.name} re-enabled: all self-tests pass`);
    }
  });
  return { notes, changed };
}

function failureLabel(result) {
  const parts = [];
  if (result.falseDeny.length) parts.push(`${result.falseDeny.length} known-safe command(s) denied`);
  if (result.falseAllow.length) parts.push(`${result.falseAllow.length} known-prohibited command(s) allowed`);
  if (result.errors.length) parts.push(`${result.errors.length} case(s) threw`);
  return parts.join(", ");
}

function buildProblems(results, disabled, newEntries) {
  const problems = [];
  results.forEach((result) => {
    if (result.ok) return;
    let text = `${result.name} self-test failed (${failureLabel(result)})`;
    if (result.disabledNow) text += "; guard disabled until a later check passes";
    else if (result.falseDeny.length) text += "; could not disable it (CLAUDE_PLUGIN_DATA is not set)";
    problems.push(text);
  });
  Object.keys(disabled).forEach((name) => {
    const failedNow = results.some((result) => result.name === name && !result.ok);
    if (!failedNow) problems.push(`${name} guard is disabled (protection is off)`);
  });
  if (newEntries.length > 0) {
    const latest = newEntries[newEntries.length - 1];
    problems.push(`${newEntries.length} hook failure(s) logged since the last notice (latest: ${latest.hook} ${latest.kind})`);
  }
  return problems;
}

function formatReport(context) {
  const { version, results, disabled, entries, newEntries, notes, cleared, canPersist } = context;
  const lines = ["assist-plugin hook health", ""];
  lines.push(`Node: ${version} (minimum supported: ${launch.MIN_NODE_MAJOR}) OK`);
  lines.push(`Data directory: ${canPersist ? process.env.CLAUDE_PLUGIN_DATA : "NOT SET (failures cannot be logged and guards cannot be disabled)"}`);
  lines.push("", "Guard self-tests:");
  results.forEach((result) => {
    lines.push(`  ${result.name}: ${result.ok ? "PASS" : "FAIL"} (${result.allowCount} allow cases, ${result.denyCount} deny cases)`);
    result.falseDeny.forEach((c) => lines.push(`    known-safe command was DENIED: ${c}`));
    result.falseAllow.forEach((c) => lines.push(`    known-prohibited command was ALLOWED: ${c}`));
    result.errors.forEach((c) => lines.push(`    case threw: ${c}`));
  });
  if (notes.length) {
    lines.push("", "Changes made:");
    notes.forEach((note) => lines.push(`  ${note}`));
  }
  lines.push("", "Disabled guards:");
  const names = Object.keys(disabled);
  if (names.length === 0) lines.push("  none");
  names.forEach((name) => {
    const entry = disabled[name] || {};
    lines.push(`  ${name}: ${entry.reason || "no reason recorded"} (since ${entry.ts || "unknown"})`);
  });
  lines.push("", `Hook failure log (${entries.length} entr${entries.length === 1 ? "y" : "ies"}, newest ${REPORT_LOG_ROWS} shown, ${newEntries.length} new since the last report):`);
  if (entries.length === 0) lines.push("  none");
  entries.slice(-REPORT_LOG_ROWS).forEach((entry) => {
    lines.push(`  ${entry.ts}  ${entry.hook}  ${entry.node}  ${entry.kind}  ${entry.message}`);
  });
  if (cleared !== null) lines.push("", `Cleared ${cleared} log entr${cleared === 1 ? "y" : "ies"} from hook-health.jsonl.`);
  return lines.join("\n");
}

function run(argv) {
  const dirIndex = argv.indexOf("--data-dir");
  if (dirIndex !== -1 && argv[dirIndex + 1]) process.env.CLAUDE_PLUGIN_DATA = argv[dirIndex + 1];
  const sessionStart = argv.indexOf("--session-start") !== -1;
  const clear = argv.indexOf("--clear") !== -1;
  const canPersist = !!process.env.CLAUDE_PLUGIN_DATA;

  const results = GUARDS.map(selfTest);

  const disabled = health.readDisabled();
  const update = updateDisabled(results, disabled, canPersist);
  const notes = update.notes;
  if (update.changed) {
    try {
      health.writeDisabled(disabled);
    } catch (err) {
      notes.push(`could not update hooks-disabled.json (${health.describeError(err)})`);
    }
  }

  const entries = health.readLog();
  const state = health.readState();
  const lastNotified = typeof state.lastNotified === "string" ? state.lastNotified : "";
  const newEntries = entries.filter((entry) => entry.ts > lastNotified);

  const markNotified = () => {
    if (newEntries.length === 0 || !canPersist) return;
    try {
      state.lastNotified = newEntries[newEntries.length - 1].ts;
      health.writeState(state);
    } catch (err) {
      // a state write failure only means the notice may repeat
    }
  };

  if (sessionStart) {
    const problems = buildProblems(results, disabled, newEntries);
    if (problems.length > 0) {
      health.warn(`assist-plugin health: ${problems.join("; ")}. Run /assist-plugin:health for details.`);
    }
    markNotified();
    return;
  }

  let cleared = null;
  if (clear) cleared = health.clearLog();
  process.stdout.write(
    formatReport({ version: launch.nodeVersion(), results, disabled, entries, newEntries, notes, cleared, canPersist }) + "\n"
  );
  markNotified();
}

function main() {
  const options = { suffix: "the health check did not complete" };
  health.installHandlers(NAME, options);
  health.startWatchdog(NAME, WATCHDOG_MS, options);
  try {
    run(process.argv.slice(2));
  } catch (err) {
    health.failOpen(NAME, "exception", "health check failed", err, options);
    return;
  }
  // Exit naturally (exit code 0) so buffered stdout is flushed; the watchdog timer is unref'd.
}

module.exports = { NAME, GUARDS, selfTest, main };

if (require.main === module) main();
