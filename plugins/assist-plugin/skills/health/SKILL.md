---
name: health
description: >-
  Check assist-plugin hook health: Node version, guard, injection-filter, and
  prose-hook self-tests, recent hook failures, disabled guards.
effort: low
allowed-tools:
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/hooks/health-check.js" --data-dir "${CLAUDE_PLUGIN_DATA}")
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/hooks/health-check.js" --data-dir "${CLAUDE_PLUGIN_DATA}" --clear)
  - Read
argument-hint: "[--clear]"
---

# Health

Report whether the assist-plugin hooks are working: the PreToolUse guards (`sa-mermaid-only`, `doc-cli-guard`, `prose-gate`), the `injection-filter`, the `prose-advisor`, and `writing-context`. All of them fail open: a hook bug never blocks a command, write, or tool result; it lets the command or content through and records the failure. The `injection-filter` replaces prompt-injection sentences in web, MCP, and subagent output with a visible marker; its self-test checks a fixed corpus of known injections (must be flagged) and benign text (must stay unchanged). The `prose-gate` denies writes to prose files that add block-tier writing-standard tells (em dashes, curly quotes, chatbot residue). The `prose-advisor` reports advisory tells after a write without blocking it. Both prose hooks skip files under the system temp directory and paths listed in `${CLAUDE_PLUGIN_DATA}/prose-gate-allowlist.json` (a JSON array of path substrings; the entry `"*"` disables the gate and the advisor for all paths; a malformed file means no allowlist). The allowlist is separate from `hooks-disabled.json`: a passing self-test never changes it, and the self-tests ignore it. `writing-context` adds the compact writing standard to the session and to each subagent; it has no self-test, so its failures show only in the log. This skill shows those records.

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
| `prose-gate` self-test FAIL, "known-safe write was DENIED" | The gate has a bug; it was auto-disabled and writes pass with a warning | Report the bug (include the report output). A passing self-test after a plugin update re-enables it |
| `prose-gate` self-test FAIL, "known tell was ALLOWED" | The gate misses a tell it should block; it stays enabled but protection is weak | Report the bug with the report output |
| `prose-advisor` self-test FAIL, "clean sample was ADVISED" or "advisory sample was MISSED" | The advisor is unreliable; it was auto-disabled and writes get no advice | Report the bug with the report output. A passing self-test after a plugin update re-enables it |
| `injection-filter` self-test FAIL, "benign sample was ALTERED" or "injection sample was MISSED" | The filter is unreliable; it was auto-disabled and tool results pass through unfiltered with a one-time warning | Report the bug (include the report output; it lists sample labels, not sample text). A passing self-test after a plugin update re-enables it |
| Disabled guards listed | The guard was turned off by a failed self-test and every command it covers passes unchecked | Fix the cause, then run `/assist-plugin:health`; a passing self-test removes the entry |
| Log kinds `exception`, `uncaught-exception`, `unhandled-rejection`, `launch-error` | A hook crashed at runtime; the command, write, or content ran unchecked | Report the bug with the log line (it holds no command text) |
| Log kind `missing-standard` | `writing-context` could not read `rules/writing-standard-compact.md`, so the session or subagent started without the writing standard | Restore the file by reinstalling or updating the plugin, then start a new session |
| Log kind `empty-standard` | `rules/writing-standard-compact.md` is empty, so `writing-context` added nothing | Restore the file by reinstalling or updating the plugin, then start a new session |
| Log kind `standard-truncated` | `rules/writing-standard-compact.md` with its header exceeds 10000 characters, so `writing-context` cut the tail | Shorten the file to fit; report the bug if the plugin files are unmodified |
| Log kind `malformed-input` or `stdin-error` | Claude Code sent input the guard could not read | Report the bug if it repeats |
| Log kind `timeout` | A guard did not answer within 3 seconds (the health check's own limit is 8 seconds) | Check for a stalled disk or overloaded machine; report if it repeats |
| `CLAUDE_PLUGIN_DATA` not set | Failures cannot be logged and guards cannot be auto-disabled | Run through Claude Code with the plugin installed; the variable is set automatically |

After fixing a cause, run `/assist-plugin:health` again to confirm; a clean report prints `PASS` for every hook listed and `Disabled guards: none`. Run `/assist-plugin:health --clear` once the log entries have been handled.

## Privacy

The health log holds only timestamp, hook name, Node version, failure kind, and a short message. It never holds command text, arguments, environment values, or hook input.
