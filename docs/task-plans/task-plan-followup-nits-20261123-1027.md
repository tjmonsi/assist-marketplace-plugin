# Task Plan: confirmation-store hardening, README nit, and 1.14.6 release doc-sync

**Target Language:** JavaScript (Node, CommonJS, no dependencies; the store hooks run from the Node 6 floor of NFR-017, so keep ES5-safe syntax in `confirmation-store.js` as the file already does)  
**Target Framework:** none (Node built-in test runner: `node --test`)  
**Generated:** 2026-11-23 10:27:00

---

## Specification Summary

- **Spec ID:** `specs/spec-hooks-strict-json.md` (parent `spec-hooks-platform.md`), section `Change Log: 2026-11-23`. The spec carries no `SPEC-NNN` ID, so `Satisfies` lines cite the spec file and its `Requirement N` (written `strict-json R7`, `strict-json R10`). Status stays `Review` (delta rule 6).
- **Linked Requirements:** FR-249 (the three PLANNED (1.14.6) statements in `docs/requirements/FR-NFR-harness-governance.md`, section 2.36: read cap, over-cap refusal, diagnostic fields), NFR-028 (fail closed), NFR-016 (no OS message or absolute path in diagnostics), UR-059, UR-068, UR-069, UR-071
- **Use Cases:** none defined in the spec

The 1 MiB read cap now covers the read inside `markPendingUsed`, an over-cap store file is refused fail-closed, and the `store-read-failed` and `store-write-failed` diagnostics drop the OS error message. The release 1.14.5 to 1.14.6 carries this change plus one README typography fix. Git mechanics (branch, commit, tag) belong to the orchestrator and are not plan steps.

---

## Acceptance Criteria

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Over-cap store file in markPendingUsed | a confirmation-store file larger than 1 MiB | `markPendingUsed` reads it | the read is refused; `markPendingUsed` marks nothing and returns `false` |
| At-cap store file in markPendingUsed unchanged | a valid confirmation-store file of 1 MiB or smaller | `markPendingUsed` reads it | it behaves as before this change |
| Store diagnostic holds no OS message | a store read or write fails with an OS error whose message holds an absolute path | the `store-read-failed` or `store-write-failed` diagnostic is recorded | it holds the store file basename and the errno code, and holds no OS error message or absolute path |
| Rejected confirmation record (regression) | `confirmations.jsonl` holds one duplicate-key record and one valid record | the PR-posting guard reads the store | the rejected record is ignored; the valid record is read as before |

The rejected-confirmation-record regression needs no new test. This change does not touch `parseLines`, and the existing tests in `tests/hooks/strict-json-readers.test.js` already cover it (lines 389 to 408: the duplicate-key record is ignored and the valid record is read; the order does not matter; a rejected record drops like an unparseable line). Step 3 keeps those tests passing and adds no test for this scenario.

---

## Implementation Steps

Paths start at the repository root. The hook path sits under `plugins/assist-plugin/`; tests sit under the repository-root `tests/` (there is no `plugins/assist-plugin/tests/`).

### Step 1: Cap the markPendingUsed read at 1 MiB

- **Files:** `plugins/assist-plugin/hooks/lib/confirmation-store.js` (modify; the read at line 299 inside `markPendingUsed`)
- **Satisfies:** [strict-json R7 (Change Log 2026-11-23) -> FR-249 (read cap, over-cap refusal) -> NFR-028]
- **Code references:** `languages/javascript.md`
- **Notes:** Before the `fs.readFileSync(file, "utf8")` at line 299, call `fs.statSync(file).size` and compare it with the existing `MAX_FILE_BYTES` (line 50), the same check `readRecords` makes at line 141. On over-cap, call `note(options, "error", "store-too-large", { file: PENDING_FILE })` (the basename, as line 142 does) and `return false` before any parse or write, so nothing is marked and the file is left as it is. Keep the `ENOENT` branch returning `false` for a missing file, so a `statSync` that throws `ENOENT` must take that same branch. Any other stat or read error keeps its current path (rethrow to the outer catch, `store-write-failed`, `StoreError("write-failed", ...)`). Valid files at or under the cap behave as before. Add `[FR-249]` and `[NFR-028]` traceability markers at the new cap check, matching the marker the existing `readRecords` cap carries and the Step 2 markers, per `skills/code/references/traceability-comment-format.md`. Update the comment above `markPendingUsed` (lines 289 to 292) to state the cap and the `false` return for an over-cap file.

### Step 2: Drop the OS error message from the store diagnostics

- **Files:** `plugins/assist-plugin/hooks/lib/confirmation-store.js` (modify; the five `note()` calls at lines 147, 171, 204, 268, and 322)
- **Satisfies:** [strict-json R10 (Change Log 2026-11-23, ADDED) -> FR-249 (diagnostic fields) -> NFR-016]
- **Code references:** `languages/javascript.md`
- **Notes:** In each of the five `store-read-failed` and `store-write-failed` calls, remove the `message: err && err.message` property and keep `file` (basename) and `code: errorCode(err)`. The lines are 147 (`readRecords`, `store-read-failed`), 171 (`readConfirmations`), 204 (`appendLine`, `store-write-failed`), 268 (`findPending`), and 322 (`markPendingUsed`, `store-write-failed`). The `StoreError` messages at lines 205 and 323 already carry only the basename and errno code; leave them. Do these edits after Step 1, or re-read the file first, because Step 1 shifts the line numbers. Add `[FR-249]` and `[NFR-016]` traceability markers to the changed calls per `skills/code/references/traceability-comment-format.md`.

### Step 3: Tests for the over-cap markPendingUsed path and the message-free diagnostics

- **Files:** `tests/hooks/strict-json-readers.test.js` (modify; over-cap section near line 462, next to the existing `pending.jsonl` cap test at line 593), `tests/hooks/confirmation-store.test.js` (modify; diagnostics, next to the log-callback tests near lines 390 to 415)
- **Owner:** `developer-tester`. List test paths only; the `developer` does not write them.
- **Satisfies:** [strict-json R7 (Change Log 2026-11-23) -> FR-249 -> NFR-028 -> Scenario "Over-cap store file in markPendingUsed"], [strict-json R7 (Change Log 2026-11-23) -> FR-249 -> Scenario "At-cap store file in markPendingUsed unchanged"], [strict-json R10 -> FR-249 -> NFR-016 -> Scenario "Store diagnostic holds no OS message"]
- **Code references:** `languages/javascript.md`
- **Notes:** Black-box tests from the acceptance criteria above. (a) Over-cap: write a `pending.jsonl` of 1 MiB plus one byte that holds one valid unused record, call `markPendingUsed` with that record, assert it returns `false`, the file bytes are unchanged, and a `log` callback received `store-too-large` with the basename and no path. (b) At-cap: at exactly 1 MiB the same valid record is marked and `true` returns, matching the existing one-byte boundary style at line 552. (c) Diagnostics: force a non-`ENOENT` failure (for example, make `pending.jsonl` a directory so the read or the append throws `EISDIR`, whose Node message holds the absolute path), collect the `log` records, and assert each `store-read-failed` or `store-write-failed` record has `file` equal to the basename, `code` equal to the errno string, and no `message` key, and that the serialized record holds neither the temp root path nor any `/` path segment. Cover each of the five call sites that a test can reach (`readRecords`, `findPending`, `appendLine`, `markPendingUsed`; `readConfirmations` fires only on a throw from `readRecords`, so cover it if reachable and otherwise record it as not reachable). The "Rejected confirmation record (regression)" scenario gets no new test: the existing tests at `tests/hooks/strict-json-readers.test.js` lines 389 to 408 cover it, and this change does not touch `parseLines`; the tester confirms they still pass. Testing Gate: at least 70% coverage on the changed code, run through `node --test tests/hooks/`.

### Step 4: Replace the en dash in the README savings line

- **Files:** `README.md` (modify; line 88, "~65-70%" currently written with U+2013 between 65 and 70)
- **Satisfies:** [no spec requirement; doc typography nit from the 1.14.6 follow-up list]; the writing standard in `plugins/assist-plugin/rules/writing-standard.md` is the rule it follows
- **Code references:** none (documentation edit)
- **Notes:** Replace the single U+2013 character in `**~65-70% savings** on design and architecture workflows` with a plain hyphen-minus (U+002D). Change nothing else on the line, including the two trailing spaces. No requirement ID covers this nit; the Satisfies line omits one rather than invent it.

### Step 5: Bump the version 1.14.5 to 1.14.6 in the six version places

- **Files:** `plugins/assist-plugin/.claude-plugin/plugin.json` (the `version` field, line 3), `.claude-plugin/marketplace.json` (the `version` field, line 14), `CLAUDE.md` (the Plugin line, line 10: `(v1.14.5)`), `README.md` (the `### assist-plugin v1.14.5` heading, line 28), `MARKETPLACE.md` (the `### assist-plugin v1.14.5` heading at line 7 and the Versioning sentence at line 76: `Version 1.14.5 is available in ...`)
- **Satisfies:** [no spec requirement; release doc-sync governed by the release paragraph of "Keeping counts in sync" in `CLAUDE.md`]
- **Code references:** none (documentation and manifest edit)
- **Notes:** Change only the version string in each place. Counts stay unchanged (16 agents, 22 skills), so no count list needs an edit. The root `CHANGELOG.md` is the sixth place and is Step 6. Edit `README.md` after Step 4 so the two edits do not collide. After the edits, `node plugins/assist-plugin/scripts/release-check.js --release` (version-agreement section) is the check; the orchestrator runs it.

### Step 6: Add the CHANGELOG 1.14.6 entry

- **Files:** `CHANGELOG.md` (modify; insert a `## [1.14.6] - 2026-11-23` section above the `## [1.14.5]` heading at line 5)
- **Satisfies:** [strict-json R7 (Change Log 2026-11-23) -> FR-249 -> NFR-028], [strict-json R10 -> FR-249 -> NFR-016]
- **Code references:** none (documentation edit)
- **Notes:** Follow the 1.14.5 layout (`### Changed`, `### Fixed`, `### Compatibility`). `### Changed`: the confirmation-store 1 MiB read cap now also covers the read inside `markPendingUsed`; an over-cap store file is refused, marks nothing, and returns `false` (fail closed); the `store-read-failed` and `store-write-failed` diagnostics record the file basename and errno code only and no longer carry the OS error message. `### Fixed`: the README savings line now uses a plain hyphen in "~65-70%". `### Compatibility`: no agent or skill was added: 16 agents and 22 skills. Write it without em dashes, en dashes, or curly quotes (the prose gate blocks added block-tier tells). The newest heading must read `1.14.6` so the release-check version section finds no `CHANGELOG.md` mismatch.

---

## Ordering Rationale

- **Step 1-2:** Hook code change, cap first, then diagnostics (Step 2 re-reads the file because Step 1 shifts line numbers)
- **Step 3:** Tests (unit and integration), owned by `developer-tester`; test paths only (the developer never writes test paths)
- **Step 4:** README nit, before the version bump so both README edits stay separate
- **Step 5-6:** Release doc-sync, last so the version and changelog describe the finished change

Each subsequent step can depend on previous steps' outputs.

---

## Notes for Developer

- Reference the `code` skill for language conventions before implementing each step
- Load traceability comments per [references/traceability-comment-format.md](../../code/references/traceability-comment-format.md)
- Run code quality gates (linting, testing, security audit) at task completion. The OWASP for LLM gate in `CLAUDE.md` Governance applies to two triggers in this plan. First, Steps 1 and 2 edit `hooks/lib/confirmation-store.js`, which sits under `hooks/`. Second, Step 5 edits the root `CLAUDE.md` (the Plugin line), and the Governance rule covers "any `CLAUDE.md` at any depth". Step 5's other files do not trigger the gate: `plugins/assist-plugin/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` sit under `.claude-plugin/`, which is not a gated folder, and `README.md`, `MARKETPLACE.md`, and `CHANGELOG.md` (Steps 4, 5, 6) are documents that fall under the Report Quality Gate. Among the Step 5 and Step 6 files, only `CLAUDE.md` triggers the LLM gate.
- `FR-NFR-harness-governance.md` section 2.36 still marks the three statements PLANNED (1.14.6). Changing that marker to as-built, and promoting the spec Status, is a documentation decision outside this task; this plan does not edit either file.
- Run `node plugins/assist-plugin/scripts/release-check.js` after Step 6 (orchestrator).
