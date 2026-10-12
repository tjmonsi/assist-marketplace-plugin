---
name: health
description: >-
  Check assist-plugin hook health: Node version, guard and injection-filter
  self-tests, recent hook failures, disabled guards.
effort: low
allowed-tools:
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/hooks/health-check.js" --data-dir "${CLAUDE_PLUGIN_DATA}")
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/hooks/health-check.js" --data-dir "${CLAUDE_PLUGIN_DATA}" --clear)
  - Read
argument-hint: "[--clear]"
---

# Health

Report whether the assist-plugin PreToolUse guards (`sa-mermaid-only`, `doc-cli-guard`) and the `injection-filter` are working. All of them fail open: a hook bug never blocks a command or a tool result; it lets the command or content through and records the failure. The `injection-filter` replaces prompt-injection sentences in web, MCP, and subagent output with a visible marker; its self-test checks a fixed corpus of known injections (must be flagged) and benign text (must stay unchanged). This skill shows those records.

## Steps

1. Run the check (add `--clear` only when the user passed `--clear`):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/hooks/health-check.js" --data-dir "${CLAUDE_PLUGIN_DATA}"
   node "${CLAUDE_PLUGIN_ROOT}/hooks/health-check.js" --data-dir "${CLAUDE_PLUGIN_DATA}" --clear
   ```

   The report lists the Node version, each guard's self-test result, disabled guards, and the recent entries of `hook-health.jsonl`. With `--clear` the script shows the log first, then truncates `${CLAUDE_PLUGIN_DATA}/hook-health.jsonl`.

2. If the script prints `{"systemMessage": ...}` instead of a report, the health check itself failed or Node is unsupported. Treat the message as the finding and use the matching row below.

3. Summarize in a few lines: overall status (healthy or needs attention), then one entry per finding with its fix. Report a healthy result in one line.

## Findings and fixes

| Finding | Meaning | Fix |
|---|---|---|
| `unsupported-node` | Node is older than the minimum shown in the message, so guards pass every command unchecked | Install or upgrade Node to the minimum version or newer, then run `/assist-plugin:health` again |
| `node: command not found` (hook error notice) | Node is missing, so guards cannot run and commands proceed unchecked | Install Node (see the Node row in README.md), then run `/assist-plugin:health` again |
| Guard self-test FAIL, "known-safe command was DENIED" | The guard has a bug; it was auto-disabled and passes commands with a warning | Report the bug (include the report output) at https://github.com/tjmonsi/assist-marketplace-plugin/issues. After a plugin update, run `/assist-plugin:health` again; a passing self-test re-enables the guard |
| Guard self-test FAIL, "known-prohibited command was ALLOWED" | The guard misses a case it should block; it stays enabled but protection is weak | Report the bug with the report output |
| Guard self-test FAIL, "case threw" | The guard raised an error on a fixed case | Report the bug with the report output |
| `injection-filter` self-test FAIL, "benign sample was ALTERED" or "injection sample was MISSED" | The filter is unreliable; it was auto-disabled and tool results pass through unfiltered with a one-time warning | Report the bug (include the report output; it lists sample labels, not sample text). A passing self-test after a plugin update re-enables it |
| Disabled guards listed | The guard was turned off by a failed self-test and every command it covers passes unchecked | Fix the cause, then run `/assist-plugin:health`; a passing self-test removes the entry |
| Log kinds `exception`, `uncaught-exception`, `unhandled-rejection`, `launch-error` | A guard crashed at runtime; the command ran unchecked | Report the bug with the log line (it holds no command text) |
| Log kind `malformed-input` or `stdin-error` | Claude Code sent input the guard could not read | Report the bug if it repeats |
| Log kind `timeout` | A guard did not answer within 3 seconds (the health check's own limit is 8 seconds) | Check for a stalled disk or overloaded machine; report if it repeats |
| `CLAUDE_PLUGIN_DATA` not set | Failures cannot be logged and guards cannot be auto-disabled | Run through Claude Code with the plugin installed; the variable is set automatically |

After fixing a cause, run `/assist-plugin:health` again to confirm; a clean report prints `PASS` for both guards and the `injection-filter` and `Disabled guards: none`. Run `/assist-plugin:health --clear` once the log entries have been handled.

## Privacy

The health log holds only timestamp, hook name, Node version, failure kind, and a short message. It never holds command text, arguments, environment values, or hook input.
