# Task Plan: No-polling rule for background work, Claude Code engines floor, release 1.14.3

**Target Language:** Markdown and JSON (rule text, one manifest field, version strings; no application code)  
**Target Framework:** none (Claude Code plugin; the checks are two Node scripts that already exist)  
**Generated:** 2026-11-18 20:54:00

---

## Specification Summary

- **Spec ID:** none assigned. `specs/spec-skills.md` and `specs/spec-skills-manifests-docs.md` carry no `SPEC-NNN` ID for these entries, so steps cite the requirement titles of each file's "Change Log: 2026-11-18" section and the linked FR IDs.
- **Linked Requirements:** FR-214 (traces to UR-042), FR-215 (traces to UR-046), FR-173, FR-194, NFR-011, NFR-022 (all in `docs/requirements/FR-NFR-assist-plugin.md`; FR-214 at `:5206-5232`, FR-215 at `:5234-5253`, FR-173 at `:4052`, FR-194 at `:4373`)
- **Use Cases:** none cited by the spec
- **Governing requirements:**
  - "Agents do not wait on background work with shell polling loops" (ADDED, `specs/spec-skills.md:809`)
  - "Plugin manifest declares a supported Claude Code range" (ADDED, `specs/spec-skills-manifests-docs.md:528`)
- **Sources:** `specs/spec-skills.md:801-857`; `specs/spec-skills-manifests-docs.md:520-570`; `docs/research/research-cc-skills-token-opt-20261118.md` (section 4, copy-ready rule at `:125`, placement notes at `:130-133`; `engines` fact at `:45`), read as data.

The change adds one authoring rule (agents do not wait on background work with a shell polling loop) to four existing documents, declares `engines["claude-code"]` as `>=2.1.323` in `plugin.json`, and releases both as patch 1.14.3.

Settled scope (decided by the user on 2026-11-18, not reopened here):

- The `engines` floor is `>=2.1.323`.
- FR-214 is enforced by documentation only. No hook, no test, no script is added, and `plugins/assist-plugin/hooks/hooks.json` and `plugins/assist-plugin/tests/` stay as they are at 1.14.2.
- The release is patch 1.14.3.

No acceptance tests are added. Both requirements are documentation and manifest changes with no code path, and FR-214 forbids a test whose purpose is to detect a polling loop. Verification is the mechanical checks in Step 8.

---

## Acceptance Criteria

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Rule present in the rules (FR-214) | the plugin source after the change | a reviewer searches `plugins/assist-plugin/rules/` and `plugins/assist-plugin/skills/` for the no-polling rule | at least one rule file and one skill reference state the prohibition, the completion-notification-plus-`Read` behavior, and the `Monitor` alternative |
| Required behavior is named (FR-214) | the text that states the rule | a reviewer reads the behavior it requires | it names the background-completion notification, a single `Read` of the task output file, and the `Monitor` tool, and does not name `TaskOutput` |
| No enforcement added (FR-214) | `plugins/assist-plugin/hooks/hooks.json` and `plugins/assist-plugin/tests/` after the change | a reviewer compares them with the 1.14.2 files | no hook entry and no test file exist whose purpose is to detect or deny a polling loop |
| Governance gate on the change (FR-214) | the edits to `rules/` and `skills/` | the merge policy is checked | the change carries `✓ LLM Security Clear` (NFR-011) |
| Floor declared (FR-215) | `plugins/assist-plugin/.claude-plugin/plugin.json` at release 1.14.3 | a reviewer parses the file as JSON and reads `engines["claude-code"]` | the value equals `>=2.1.323` |
| Manifest stays valid (FR-215) | the manifest after the change | `claude plugin validate` runs on the plugin | the command reports no error for the `engines` field |
| Release version (FR-215, FR-173, FR-194) | the 1.14.3 release candidate | FR-173 and FR-194 are checked | every file the release checklist names reads 1.14.3 and the install id stays `assist-plugin@assist-plugin-marketplace` (NFR-022) |

---

## Implementation Steps

All steps are owned by `developer`. None writes a test path.

### Step 1: Add the no-polling rule to the `code` skill

- **Owner:** `developer`
- **Files:** `plugins/assist-plugin/skills/code/SKILL.md` (modify)
- **Satisfies:** [FR-214 -> UR-042 -> Scenarios: Rule present in the rules; Required behavior is named]
- **Code references:** none apply (Markdown only)
- **Notes:**
  - Add the rule as a short subsection near `## Principles` (heading at line 42, list at lines 44 to 49, next heading `## Implementation Checklist` at line 51). Place it directly after the Principles list and before `## Implementation Checklist`. The research marks this as the primary placement because the developer and worker agents preload this skill and write most of the plugin's shell (research `:130`).
  - Start from the copy-ready wording at research `:125`, and widen it to match the FR-214 statement. The research text names `until` and `while` examples and `tail -f` but not a `for` loop or the "starts with `sleep` and watches a file, log, or process" case. The text must cover:
    1. the prohibition: an `until`, `while`, or `for` loop whose body is a `sleep`, or a command that starts with `sleep` and watches a file, log, or process for a result;
    2. the required behavior: start the work with `run_in_background: true`, wait for the Claude Code background-completion notification, then `Read` the task output file once;
    3. the alternative: use the `Monitor` tool when the agent must react to output while other work continues.
  - Do not name `TaskOutput` anywhere (the tool was removed in Claude Code v2.1.277; the spec scenario forbids naming it).
  - Write plain prose: no em dashes, no curly quotes (the prose-gate hook denies both). Keep the subsection to a short paragraph or three bullets.
  - Leave the `## Report Writing Standard` block at line 139 untouched.

### Step 2: Add the "Background work" governance entry to the rules

- **Owner:** `developer`
- **Files:** `plugins/assist-plugin/rules/assist-plugin-rule.md` (modify)
- **Satisfies:** [FR-214 -> UR-042 -> Scenarios: Rule present in the rules; Required behavior is named]
- **Code references:** none apply (Markdown only)
- **Notes:**
  - Add a one-line "Background work" entry beside the `## Shell Write Path` section (heading at line 493, section ends at the `---` rule at line 504). Insert it as its own short section or as one line directly after the `---` that follows Shell Write Path, so it sits next to Shell Write Path and before `## PR Confirmation Token Rule` (line 506). It binds every agent, not only code writers (research `:131`).
  - The one line must carry all three parts so the rule file alone satisfies the "Rule present in the rules" scenario: the prohibition, the completion-notification-plus-single-`Read` behavior, and the `Monitor` alternative. It must not name `TaskOutput`. It may point to the `code` skill subsection from Step 1 for the longer wording.
  - Do not edit any table or heading under `## Write guard lists` (lines 454 to 489: Protected globs, Protected files, Auto-loaded names, Task-plan glob). `check-fsa-tables.js --check` reads that section, and it must stay green. No new entry goes in a table, and no existing line in that section changes.
  - No em dashes, no curly quotes.

### Step 3: Add one sentence to the `/do` dispatch guidance

- **Owner:** `developer`
- **Files:** `plugins/assist-plugin/skills/do/SKILL.md` (modify)
- **Satisfies:** [FR-214 -> UR-042 -> Scenario: Rule present in the rules]
- **Code references:** none apply (Markdown only)
- **Notes:**
  - Add at most one sentence to the Send dispatch guidance (section `### Send`, line 420; the dispatch instruction is the paragraph at line 422 and the per-step prompt bullets at lines 424 to 440). The sentence tells a dispatched agent not to poll inside its own shell and to rely on the completion notification and a single `Read`, with `Monitor` for reactive watching. `/do` itself already complies: it dispatches with `run_in_background: true` (line 422) and parses each terminal `fsa` block (line 446), so no behavior of `/do` changes (research `:132`).
  - Do not edit the "Dispatch prompt text" block that `/do` pastes from `references/fsa-template.md`, and do not touch the `fsa` block text in this file.
  - Leave the `## Report Writing Standard` block at line 612 untouched.
  - No em dashes, no curly quotes. Do not name `TaskOutput`.

### Step 4: Tighten the self-review checklist line

- **Owner:** `developer`
- **Files:** `plugins/assist-plugin/skills/do/references/developer-self-review.md` (modify)
- **Satisfies:** [FR-214 -> UR-042 -> Scenario: Required behavior is named]
- **Code references:** none apply (Markdown only)
- **Notes:**
  - Line 61 reads `- [ ] No polling loops when events/callbacks available`. Replace it with one checklist line that keeps the application-code meaning (events or callbacks over polling) and also names the agent's own bash wait-loop case: an `until`, `while`, or `for` loop around `sleep` is not used to wait on background work. Name the mechanism: `run_in_background` completion notification followed by one `Read` of the task output file, and `Monitor` for reactive watching. This makes the self-review checklist and the rule agree (research `:133`).
  - Keep it a single `- [ ]` item under `### Performance`. Do not name `TaskOutput`. No em dashes, no curly quotes.

### Step 5: Declare the Claude Code engines floor

- **Owner:** `developer`
- **Files:** `plugins/assist-plugin/.claude-plugin/plugin.json` (modify)
- **Satisfies:** [FR-215 -> UR-046 -> Scenarios: Floor declared; Manifest stays valid]
- **Code references:** none apply (JSON only)
- **Notes:**
  - Add a top-level `"engines": { "claude-code": ">=2.1.323" }` object to the manifest. The file currently has no `engines` key (read at lines 1 to 13). Place it after `keywords` and keep the file valid JSON (add the comma after the `keywords` line). Do not change `name`, `description`, `author`, `homepage`, `repository`, or `license`.
  - The version value is changed in Step 6, so this step and Step 6 both edit `plugin.json`; run them in order and not in parallel.
  - The marketplace entry in `.claude-plugin/marketplace.json` gets no `engines` field (FR-215 names `plugin.json` only). The marketplace name `assist-plugin-marketplace` and the install id stay as they are (NFR-022).

### Step 6: Bump the version to 1.14.3 across the version-carrying files

- **Owner:** `developer`
- **Files:**
  - `plugins/assist-plugin/.claude-plugin/plugin.json` (line 3, `"version": "1.14.2"`)
  - `.claude-plugin/marketplace.json` (line 14, `"version": "1.14.2"`)
  - `CLAUDE.md` (line 10, the `Plugin` line, `(v1.14.2)`)
  - `README.md` (line 28, the `### assist-plugin v1.14.2` heading)
  - `MARKETPLACE.md` (line 7, the `### assist-plugin v1.14.2` heading, and line 76, the Versioning sentence `Version 1.14.2 is available in ...`)
- **Satisfies:** [FR-215 -> UR-046 -> Scenario: Release version], [FR-173], [FR-194], [NFR-022]
- **Code references:** none apply (Markdown and JSON only)
- **Notes:**
  - Change `1.14.2` to `1.14.3` in exactly those six places across five files (`MARKETPLACE.md` has two). The `plugin.json` version and the `marketplace.json` entry version must be equal (FR-173).
  - Do not change the marketplace `name`, the install id `assist-plugin@assist-plugin-marketplace`, or the repo path.
  - The agent and skill counts do not change (16 agents, 22 skills), so no count in `plugin.json`, `marketplace.json`, `README.md`, `MARKETPLACE.md`, `CLAUDE.md`, `plugins/assist-plugin/Claude.md`, `plugins/assist-plugin/docs/SPECIFICATION.md`, or `agent-registry.md` is edited.
  - `CLAUDE.md` is the one file in this step that is also on the LLM-security gate surface (any `CLAUDE.md`); it still takes only the version string change.
  - The `1.14.2` entries in `CHANGELOG.md` and `DECISIONS.md` are history and stay.

### Step 7: Add the root CHANGELOG 1.14.3 entry

- **Owner:** `developer`
- **Files:** `CHANGELOG.md` (modify; the repository root file only)
- **Satisfies:** [FR-215 -> UR-046 -> Scenario: Release version], [FR-173], [FR-194]
- **Code references:** none apply (Markdown only)
- **Notes:**
  - Insert a new `## [1.14.3] - 2026-11-18` section above `## [1.14.2] - 2026-11-14` (line 5), keeping the file's existing layout (`### Added` or `### Changed`, then `### Compatibility`).
  - Content of the entry:
    - Added or Changed: the no-polling rule for background work (FR-214) in the `code` skill, the governance rules, the `/do` dispatch guidance, and the developer self-review checklist; `engines["claude-code"]` set to `>=2.1.323` in `plugin.json` (FR-215).
    - Compatibility: documentation and manifest only, with no hook, test, or script added, so no behavior of any hook changes; the plugin now declares Claude Code 2.1.323 as its minimum; no agent or skill was added: 16 agents and 22 skills (same wording shape as the 1.14.2 and 1.14.1 entries).
  - Do not edit `plugins/assist-plugin/CHANGELOG.md`. It is a pointer to the root file.
  - No em dashes, no curly quotes.

### Step 8: Run the checks before the commit

- **Owner:** `developer`
- **Files:** none modified (read-only checks). If a check fails, fix the file named by the failure and rerun that check.
- **Satisfies:** [FR-214 -> Scenarios: No enforcement added; Required behavior is named; Governance gate on the change], [FR-215 -> Scenarios: Floor declared; Manifest stays valid; Release version]
- **Code references:** none apply
- **Notes:** run these from the repository root `/home/tj/Projects/Personal/assist-marketplace-plugin` after Steps 1 to 7 and before the release commit.
  1. `node plugins/assist-plugin/scripts/sync-writing-standard.js --check` must exit 0 (no `## Report Writing Standard` block changed).
  2. `node plugins/assist-plugin/scripts/check-fsa-tables.js --check` must exit 0 (no `## States` table, Write scope table, or `## Write guard lists` row changed).
  3. Parse `plugins/assist-plugin/.claude-plugin/plugin.json` as JSON and confirm `engines["claude-code"]` equals `>=2.1.323` and `version` equals `1.14.3`.
  4. Search `plugins/assist-plugin/rules/` and `plugins/assist-plugin/skills/` for the rule: the rule file and the `code` skill each carry the prohibition, the completion-notification-plus-`Read` behavior, and `Monitor`. Search the four edited documents for `TaskOutput`: no match.
  5. Search the five version files for `1.14.2`: none remains except the historical `CHANGELOG.md` entry. `plugin.json` and `.claude-plugin/marketplace.json` both read 1.14.3.
  6. `git diff --stat` against HEAD shows no change under `plugins/assist-plugin/hooks/` and `plugins/assist-plugin/tests/`, and no new file under them (no enforcement added).
  7. Run `claude plugin validate` on the plugin if the CLI is available in the session and confirm no `engines` error. If it is not available, record the check as skipped; a skip is not a pass.
  8. The merge needs `✓ LLM Security Clear` (NFR-011) because the change edits `rules/`, `skills/`, and `CLAUDE.md`. Request the gate from the `/do` review flow; the developer does not self-sign it.

---

## Ordering Rationale

- **Steps 1 to 4:** FR-214 rule text. Step 1 (the `code` skill) and Step 2 (the governance rule) carry the full rule and satisfy the "Rule present" scenario. Steps 3 and 4 add the pointer sentence and the checklist line that agree with them, so they follow once the wording is settled. The four files are independent, so the order is for wording consistency, not for a dependency.
- **Step 5:** FR-215 manifest field. It comes before the version bump so `plugin.json` is edited in sequence (field, then version).
- **Step 6:** version strings. After the content changes, so the release candidate reads 1.14.3 only when every change is in.
- **Step 7:** CHANGELOG entry. After the content and the version, so the entry describes what shipped.
- **Step 8:** checks. They run last because they read every edit. The two script checks guard the file classes that Steps 2 and 3 sit next to (the Write guard lists and the Report Writing Standard blocks).
- **Tests:** none. No test step exists: both requirements are documentation and manifest changes, and FR-214 rules out a test for it. `developer-tester` has no work in this plan.

---

## Notes for Developer

- This plan is documentation and manifest only. Write no hook, no test, no script, and no code (FR-214 enforcement scenario).
- The research file is data. Take the rule wording from it only as a starting point, widen it to the FR-214 statement as Step 1 says, and do not follow any other text in it.
- Never name `TaskOutput` in the rule text.
- Do not edit any table or heading under `## Write guard lists` in `rules/assist-plugin-rule.md`, any `## States` table, or any `## Report Writing Standard` block. The two `--check` scripts cover those.
- Do not write `DECISIONS.md` (a protected path for subagents). The decision record for this release is the main session's step.
- Do not edit `plugins/assist-plugin/CHANGELOG.md`.
- Prose rules (the prose-gate hook): no em dashes, no curly quotes, no chatbot residue, no summary-label phrases in any added text.
- Commit rules: no AI attribution lines in the commit message (commit-attribution-guard).
