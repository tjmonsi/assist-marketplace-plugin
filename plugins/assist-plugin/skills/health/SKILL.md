---
name: health
description: >-
  Check assist-plugin hook health: Node version, guard, injection-filter,
  prose-hook, and FSA-hook self-tests, recent hook failures, subagent reports
  with terminal-block problems, disabled guards, Claude Code attribution settings.
effort: low
allowed-tools:
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/hooks/health-check.js" --data-dir "${CLAUDE_PLUGIN_DATA}")
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/hooks/health-check.js" --data-dir "${CLAUDE_PLUGIN_DATA}" --clear)
  - Read
argument-hint: "[--clear]"
---

# Health

Report whether the assist-plugin hooks are working: the PreToolUse guards (`sa-mermaid-only`, `doc-cli-guard`, `commit-attribution-guard`, `pr-post-ask`, `prose-gate`, `fsa-write-bar`), the `injection-filter`, the `prose-advisor`, and `writing-context`. All of them fail open: a hook bug never blocks a command, write, or tool result; it lets the command or content through and records the failure. The `injection-filter` replaces prompt-injection sentences in web, MCP, and subagent output with a visible marker; its self-test checks a fixed corpus of known injections (must be flagged) and benign text (must stay unchanged). The `prose-gate` denies writes to prose files that add block-tier writing-standard tells (em dashes, curly quotes, chatbot residue). The `prose-advisor` reports advisory tells after a write without blocking it. Both prose hooks skip files under the system temp directory and paths listed in `${CLAUDE_PLUGIN_DATA}/prose-gate-allowlist.json` (a JSON array of path substrings; the entry `"*"` disables the gate and the advisor for all paths; a malformed file means no allowlist). Files under `docs/tts/` are judged like other prose, with fenced blocks exempt. The allowlist is separate from `hooks-disabled.json`: a passing self-test never changes it, and the self-tests ignore it. The `commit-attribution-guard` denies a `git commit`, `git merge`, `gh pr create`, or `gh pr edit` command whose commit message or pull request body holds an AI attribution line: a Co-Authored-By trailer naming an AI tool or vendor (human co-authors pass, but a co-author named only Claude or Devin, or whose name contains a tool name, counts as the tool), a "Generated with/by" footer naming an AI tool, an Assisted-by or Generated-by trailer naming an AI tool, or a `*-Session:` trailer or bare session link at an AI host. Lines inside a closed code fence are skipped. It never rewrites the command, does not cover `git tag` or `gh pr merge --subject/--body` (the squash commit message), and cannot see a message built from a variable or piped through stdin; its self-test checks fixed deny and allow cases. The `pr-post-ask` guard asks the user before `gh pr review`, `merge`, `comment`, and `close`, `bkt pr approve`, `comment`, `decline`, `close`, and `merge`, and a `bkt api` call that may write (an option it does not recognize counts as a possible write), in every session. It asks and never denies, and it fails open. It is best-effort, and a bypass form found later is added to this list. Its known gaps, and no others: a program word taken from a variable or an expression (`G=gh; $G pr merge 1`, PowerShell `& (Get-Command gh) pr merge 1`), and PowerShell splatting; `gh api` with any method, `gh pr edit`, `gh pr ready`, `gh pr reopen`, a `gh` alias or extension that expands to a posting command, and `bkt pr` subcommands other than `approve`, `comment`, `decline`, `close`, and `merge`; a command string run by another program (`bash -c`, `sh -c`, `pwsh -Command`, `cmd /c`, `eval`, `Invoke-Expression`, `iex`, `Start-Process`, `xargs`, `find -exec`, `watch`, `npx -c`, `node -e`, a script file, a shell function, a coprocess), and argv wrappers outside the wrapper list (`setsid`, `doas`, `ionice`, `stdbuf --output 0 gh ...`); a posting command inside a command substitution in another program's argument (`echo $(gh pr merge 1)`), while a substitution in the program word or in an assignment value before it is judged and asks; a Bash program name in another case (`GH`), `.cmd`, `.bat`, and `.ps1` shims, shell aliases, and renamed or linked binaries; an option with a separate value ahead of the verb that the option lists do not name (`gh --body x pr comment 1`, `gh pr --body x comment 1`, `gh pr -b x comment 1`, `gh pr --body-file f review 1 --approve`, `bkt pr --text x comment 1`); a redirection the shared lexer splits into separate parts (`gh 2>&1 pr merge 1`, `gh >&2 pr merge 1`, `gh &>/dev/null pr merge 1`, `gh >| out pr merge 1`, `bkt 2>&1 pr approve 1`, `gh < <(true) pr merge 1`); a PowerShell array or script block in the verb position (`gh pr @('merge') 1`, `gh pr {merge} 1`), and a PowerShell comment that hides an opening parenthesis; the quoting forms `$"gh"` and `$'g\x68'`, brace expansion (`{gh,pr,merge,1}`), a glob in the program word (`/usr/bin/g[h]`), `(( x = 1 << 2 ))` read as a heredoc so the next line is hidden, and `sudo --user root gh ...` (the shared-parser forms `doc-cli-guard` lists); the PowerShell forms listed for `doc-cli-guard` (typographic quotes, block comments, the dot-source operator, typed, scoped, and compound assignments), and a redirection before the program (`2>/dev/null gh pr merge 1`); a REST request through `curl`, another HTTP client, or an MCP tool. It has no `bkt api` gap, because an unrecognized `bkt api` option asks. With several PreToolUse hooks, a deny from another hook beats this ask. The ask prompts in default and acceptEdits modes and forces a prompt in auto mode; in a non-interactive `-p` run with no one to answer, the call is denied. Unverified: whether the ask prompts in bypassPermissions mode or plan mode, and whether an installed mod can approve a call the hook would prompt for. `writing-context` adds the compact writing standard to the session and to each subagent; its self-test checks that the standard is readable. A failure is reported and never disables the hook, so a failed self-test leaves it enabled and it never appears under disabled guards. The two FSA hooks enforce and check the agent state machines. The `fsa-write-bar` guard keeps `developer-tester` to test paths and keeps `developer` out of them (the globs are under "Write scope" in `agents/developer-tester.md`), limits `task-planner` to `docs/task-plans/task-plan-*.md` under the session's git root, bars `developer-tester`, `task-planner`, `requirements-gatherer`, and `solutions-architect` from dot paths, `CLAUDE.md`, `CLAUDE.local.md`, and `AGENTS.md`, and denies every subagent `.agent/main-plan/**` and `DECISIONS.md`. The `fsa-log` hook runs on `SubagentStop`, on the `SubagentHandback` tool, and on `Agent` results: it parses the last `fsa` terminal block of each report from `developer-tester`, `reviewer`, `code-reviewer`, `developer`, `qa`, `intake-reviewer`, and `task-planner`, checks it against the agent's transition table, and appends one line to `${CLAUDE_PLUGIN_DATA}/fsa-log.jsonl` (newest 500 lines). It runs in warn mode: a report with problems shows a one-line notice to the user and is never blocked or sent back. Its self-test runs a fixed set of clean and broken reports; a miss in either direction disables it like the filter. This skill shows those records.

## Steps

1. Run the check (add `--clear` only when the user passed `--clear`):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/hooks/health-check.js" --data-dir "${CLAUDE_PLUGIN_DATA}"
   node "${CLAUDE_PLUGIN_ROOT}/hooks/health-check.js" --data-dir "${CLAUDE_PLUGIN_DATA}" --clear
   ```

   The report lists the Node version, each guard's self-test result, disabled guards, the recent entries of `hook-health.jsonl`, the recent problem rows of `fsa-log.jsonl` with the count since the last report, and an attribution-settings section. With `--clear` the script shows the logs first, then truncates `${CLAUDE_PLUGIN_DATA}/hook-health.jsonl`. It never truncates `fsa-log.jsonl`, which the 500-line cap keeps small.

   The attribution-settings section is read-only. It reads the user settings file (`$CLAUDE_CONFIG_DIR/settings.json`, else `~/.claude/settings.json`), the project `.claude/settings.json`, and `.claude/settings.local.json`, and reports when `attribution.commit` or `attribution.pr` is unset or not `""`. It names the file and key to change and never writes a settings file. Source: https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts

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
| `fsa-write-bar` self-test FAIL, "known-safe write was DENIED" | The write bar has a bug; it was auto-disabled and no agent write limit applies | Report the bug (include the report output). A passing self-test after a plugin update re-enables it |
| `fsa-write-bar` self-test FAIL, "known-prohibited write was ALLOWED" | The bar misses a path it should block; it stays enabled but protection is weak | Report the bug with the report output |
| `fsa-write-bar` denies a write you expect | The path does not match the test globs (`developer-tester`), does match one (`developer`), is not `docs/task-plans/task-plan-*.md` under the session's git root (`task-planner`), is `.agent/main-plan/**` or `DECISIONS.md` (any subagent), or is a dot path, `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md` (`developer-tester`, `task-planner`, `requirements-gatherer`, `solutions-architect`) | Check the glob table under "Write scope" in `agents/developer-tester.md` and the "Write scope" in `agents/task-planner.md`. If the path is a test path, route the work to `developer-tester`; if it is not, let `developer` write it. Only the user changes `.agent/main-plan/**` and `DECISIONS.md` |
| `fsa-log` self-test FAIL, "clean report was FLAGGED" or "broken report was MISSED" | The report checker is unreliable; it was auto-disabled and subagent reports are not logged or checked | Report the bug with the report output. A passing self-test after a plugin update re-enables it |
| FSA report log rows (`fsa-log.jsonl`) | A subagent's final message did not match its transition table. The row shows the event (`subagent-stop`, `handback`, or `agent-result`; a `stop-after-handback` marker row means a stop was not checked twice and never carries problems), the agent, the state, and the problem codes below | Read the problem code, then check the agent's `## States` table. Repeated rows for one agent mean the table or the agent file needs a fix; report it |
| `pr-post-ask` self-test FAIL, "known-safe command was ASKED" | The hook has a bug; it was auto-disabled, so PR posting commands run with no prompt from it and only the calling flow's own confirmation applies | Report the bug (include the report output). After a plugin update, run `/assist-plugin:health` again; a passing self-test re-enables it |
| `pr-post-ask` self-test FAIL, "known posting command was NOT ASKED" | The hook misses a posting command it should ask about; it stays enabled but protection is weak | Report the bug with the report output |
| `commit-attribution-guard` self-test FAIL, "known-safe command was DENIED" | The guard has a bug; it was auto-disabled and commit messages and PR bodies pass unchecked | Report the bug (include the report output). A passing self-test after a plugin update re-enables it |
| `commit-attribution-guard` self-test FAIL, "known-prohibited command was ALLOWED" | The guard misses an attribution line it should block; it stays enabled but protection is weak | Report the bug with the report output |
| `commit-attribution-guard` denies a command you expect to pass | The message or body holds a line that starts with an AI attribution trailer or footer | Remove the listed lines and run the command again. If a listed line names a person, tell the user instead of removing it (a full name such as Claude Dupont passes). The guard passes a sentence that mentions a trailer and a line inside a closed code fence; use these only for text that documents the trailer, never to keep an attribution line |
| Attribution settings: `attribution.commit` or `attribution.pr` unset or not `""` | Claude Code's instructions ask the model to end commit messages with a Co-Authored-By trailer or a session link, and PR bodies with a footer; the guard then denies the command that carries it | Tell the user to set both keys to `""` in the settings file the report names: `{"attribution": {"commit": "", "pr": ""}}`. Never edit a settings file yourself; the check never edits settings |
| Disabled guards listed | The guard was turned off by a failed self-test and every command it covers passes unchecked | Fix the cause, then run `/assist-plugin:health`; a passing self-test removes the entry |
| Log kinds `exception`, `uncaught-exception`, `unhandled-rejection`, `launch-error` | A hook crashed at runtime; the command, write, or content ran unchecked | Report the bug with the log line (it holds no command text) |
| `writing-context` self-test FAIL | The hook stays enabled, and sessions and subagents may start without the writing standard | Restore `rules/writing-standard-compact.md` by reinstalling or updating the plugin, then run `/assist-plugin:health` again. Report the bug if the plugin files are unmodified. `writing-context` never appears under disabled guards |
| Log kind `missing-standard` | `writing-context` could not read `rules/writing-standard-compact.md`, so the session or subagent started without the writing standard | Restore the file by reinstalling or updating the plugin, then start a new session |
| Log kind `empty-standard` | `rules/writing-standard-compact.md` is empty, so `writing-context` added nothing | Restore the file by reinstalling or updating the plugin, then start a new session |
| Log kind `standard-truncated` | `rules/writing-standard-compact.md` with its header exceeds 10000 characters, so `writing-context` cut the tail | Shorten the file to fit; report the bug if the plugin files are unmodified |
| Log kind `log-write-error` | `fsa-log` could not append to `fsa-log.jsonl` (full disk or unwritable data directory), so that report was not logged | Free disk space or fix the permissions of the data directory |
| Log kind `malformed-input` or `stdin-error` | Claude Code sent input the guard could not read | Report the bug if it repeats |
| Log kind `timeout` | A guard did not answer within 3 seconds (the health check's own limit is 8 seconds) | Check for a stalled disk or overloaded machine; report if it repeats |
| `CLAUDE_PLUGIN_DATA` not set | Failures cannot be logged and guards cannot be auto-disabled | Run through Claude Code with the plugin installed; the variable is set automatically |

### FSA problem codes

`fsa-log` stores these short codes in `problems`. Each is checked against the agent's table in `hooks/lib/fsa-tables.js`.

| Code | Meaning |
|---|---|
| `no-block` | The final report has no complete `fsa` block |
| `fsa-mismatch` | The `fsa:` line is not `<agent>/<version>` for this agent (for example `task-planner/1` from `task-planner`) |
| `bad-state` | `state` is not `Done`, `NeedsInput`, or `Error` |
| `missing-field` | A required field (`trace`) is absent |
| `trace-too-long` | `trace` has more than 40 states |
| `unknown-state` | `trace` names a state that is not in the table |
| `bad-start` | `trace` does not begin at `Intake` |
| `illegal-transition: A>B` | The table has no edge from A to B |
| `trace-not-terminal` | `trace` does not end in `Done`, `NeedsInput`, or `Error` |
| `terminal-mismatch` | `trace` ends in a different terminal state than `state` |
| `bad-error-class` | `error_class` is outside the closed list, `none` on an `Error`, or set on a state other than `Error` |
| `bad-verdict` | `verdict` does not match the agent's pattern, or is `none` on a `Done` |
| `bad-resume-at` | A `NeedsInput` has no `resume_at` naming a state of the table |

After fixing a cause, run `/assist-plugin:health` again to confirm; a clean report prints `PASS` for every hook listed and `Disabled guards: none`. Run `/assist-plugin:health --clear` once the log entries have been handled.

## Privacy

The health log holds only timestamp, hook name, Node version, failure kind, and a short message. It never holds command text, arguments, environment values, or hook input.

`fsa-log.jsonl` holds, per report: timestamp, session id, event, agent type, agent id, and the block fields `fsa`, `state`, `verdict`, `error_class`, and `trace`, each copied only when it matches a closed list or pattern (anything else is stored as `<invalid>`), plus the problem codes. It never holds prompts, report text, artifact paths, questions, or file contents.
