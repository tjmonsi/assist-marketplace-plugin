# Rule Promotion Runbook

How the user switches an advisory rule to blocking (FR-237, FR-238, NFR-034). This runbook describes the procedure and runs no promotion itself.

Promotion is a user-run operation. No hook, agent, or orchestrator runs `scripts/promote-rule.js`, and the plugin never promotes a rule on its own. Until the user runs it, every severity-routing rule is advisory. The [control register](../rules/control-register.md) marks which controls stay advisory until promotion (CTL-219, CTL-220, CTL-237, CTL-238, CTL-239).

All commands run from the project root. Each script reads the project root from `CLAUDE_PROJECT_DIR`, else the working directory and its git root; pass `--root DIR` to override it.

## Preconditions

`scripts/promote-rule.js` checks three conditions in this order. The first that fails refuses the switch, writes nothing, prints the reason, and exits 1.

| Order | Condition | Refusal reason | Source |
|---|---|---|---|
| 1 | The severity policy is approved at its current version. `DECISIONS.md` holds a `## <YYYY-MM-DD>: Severity policy approved` entry that names `severity-policy.md` and the version on the policy's `Policy version` line (`draft-2` now). The latest matching entry by date is the one read. | `missing-policy` | `rules/severity-policy.md`, `DECISIONS.md` |
| 2 | A baseline exists for the rule: at least one finding is recorded, the baseline window is complete, and at least one finding has a user label. | `missing-baseline` | `.agent/governance/review-findings.jsonl` |
| 3 | Precision is at or above 90% (NFR-034), computed from the user's labels only. The bar is an estimate. | `precision` (prints the value) | the same store |

Editing `severity-policy.md` raises its version, so an older approval no longer covers it. Record a fresh approval entry in `DECISIONS.md` first.

The baseline window starts at the first finding of the rule. It is complete after 14 days and 20 distinct review ids, whichever is later (an estimate). A review id is the session id the hook records with each finding. The precision check uses integer arithmetic: exactly 90% passes.

Two further refusals exist. `store-unreadable` (exit 1): the rule-mode store exists but is not a JSON object, and the script will not overwrite it. Exit 2: a bad argument, an unreadable project root, or an unreadable or unwritable file.

## Workflow

1. **Accrue findings.** Run the rule in advisory mode. Each finding appends to `.agent/governance/review-findings.jsonl`. No baseline exists until findings have accrued, so none exists on day one.

2. **Label each finding.** List the unlabelled findings, then mark each one true (a real finding) or false (a false positive). An agent's judgment is never a label.

   ```
   node plugins/assist-plugin/scripts/label-findings.js --list --rule <rule-id>
   node plugins/assist-plugin/scripts/label-findings.js <finding-id> true
   node plugins/assist-plugin/scripts/label-findings.js <finding-id> false
   ```

   Label while no review is running. A finding a hook appends between the labeller's read and its rename is lost.

3. **Check the baseline.** The report is read-only. It prints finding counts by severity and confidence, labelled and unlabelled counts, precision, and whether the window is COMPLETE or OPEN (with what it still waits for).

   ```
   node plugins/assist-plugin/scripts/baseline-report.js --rule <rule-id>
   ```

   Omit `--rule` to report every rule in the store.

4. **Promote.** When the window is COMPLETE and precision is at or above 90%, run the gate.

   ```
   node plugins/assist-plugin/scripts/promote-rule.js <rule-id>
   ```

   On success the script sets `"<rule-id>": "blocking"` in `.agent/governance/rule-modes.json`, keeping any rules already marked blocking, and exits 0. It reads the existing store, adds or updates that one entry, and writes the whole object through a temporary file and a rename. For example, after `sql-string-concat` and then `goal-guard` are promoted, the store holds both entries. A rule that is already blocking exits 0 with "Nothing changed". The write bar denies a subagent any write of the store (FR-245), and this script is its permitted writer.

5. **Verify.** Read `.agent/governance/rule-modes.json`. The rule is blocking only when the store names its id exactly `"blocking"`.

## Per-rule notes

### code-scan (FR-220)

Promote per code rule. The key is the id of the rule in `hooks/lib/code-rules.js`, for example `sql-string-concat`.

```
node plugins/assist-plugin/scripts/baseline-report.js --rule sql-string-concat
node plugins/assist-plugin/scripts/promote-rule.js sql-string-concat
```

A rule that is not marked `blocking` stays advisory: its findings are recorded and the write is allowed. A rule marked `blocking` denies a code-file write only for a finding that the severity policy routes to `block-merge` (confidence High and severity HIGH or CRITICAL). While at least one code rule is blocking, the code-file write class is fail-closed (NFR-028): an evaluation error or timeout on a code-file write denies the write. With no rule blocking, the hook fails open.

### goal-guard (FR-219)

`goal-guard` is promotable. Its rule-mode store key is the flat `goal-guard`.

```
node plugins/assist-plugin/scripts/baseline-report.js --rule goal-guard
node plugins/assist-plugin/scripts/promote-rule.js goal-guard
```

The last command adds the entry `"goal-guard": "blocking"` to the store and keeps any rules already marked blocking. The hook records each hijack match as an advisory finding with `rule_id` `goal-guard` in the same `review-findings.jsonl`, so the report and the gate find its baseline. The matching hijack rule is kept in the extra field `hijack_rule_id`. A finding holds the tool name and fixed severity and confidence; it never holds the result text, a URL, or a query.

Promotion needs the same baseline window and the same 90% precision bar as any other rule. No baseline can exist until advisory `goal-guard` findings accrue, and no finding exists on day one. Label them with `label-findings.js` as above.

In blocking mode the hook withholds a result that matches a hijack rule. It replaces the tool result with a short notice through the PostToolUse `updatedToolOutput` path and records a deny. It also fails closed (NFR-028): a governed `WebFetch`, `WebSearch`, or `mcp__*` result that the hook cannot finish checking is withheld the same way. In advisory mode the hook withholds nothing and fails open.

## Safety notes

- Only the user runs `promote-rule.js`. The plugin never auto-promotes, and `label-findings.js` is user-run for the same reason.
- An absent, unreadable, or malformed rule-mode store means advisory for every rule. A rule the store does not name, or names with any value other than `"blocking"`, is advisory. No store defect turns a rule blocking.
- Fail-closed behavior applies only in blocking mode. In advisory mode every hook fails open.
- To return a rule to advisory, the user edits `.agent/governance/rule-modes.json` directly, since no subagent may write it and the script only writes `blocking`. Deleting the rule's key from the store has the same effect as editing it to `advisory`, because an absent or non-`"blocking"` value resolves to advisory.
- Severity-routing controls stay advisory until promotion. See the [control register](../rules/control-register.md) and the Severity routing section of [assist-plugin-rule.md](../rules/assist-plugin-rule.md#severity-routing).
