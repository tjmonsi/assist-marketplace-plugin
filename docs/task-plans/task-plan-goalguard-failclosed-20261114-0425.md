# Task Plan: goal-guard blocking-mode fail-closed hardening

**Target Language:** JavaScript (Node, CommonJS; `plugins/assist-plugin/hooks/impl/goal-guard.js` uses `"use strict"` and `require`)  
**Target Framework:** none (a Claude Code PostToolUse hook; tests run with the repository's existing `node --test` style in `tests/hooks/`)  
**Generated:** 2026-11-14 04:25:00

---

## Specification Summary

- **Spec ID:** none assigned. The spec `specs/spec-hooks-goal-guard.md` carries no `SPEC-NNN` ID, so steps cite the requirement titles of its newest section, "Change Log: 2026-11-14 (goal-guard blocking-mode fail-closed hardening)" (line 552), and the linked FR and NFR IDs.
- **Linked Requirements:** FR-219, NFR-028, NFR-031 (all in `docs/requirements/FR-NFR-harness-governance.md`)
- **Use Cases:** none cited by the spec
- **Governing requirements:** ADDED "Depth- and breadth-bounded shape-preserving withhold clone" (spec line 568); MODIFIED "Fail closed for the guarded class in blocking mode" (spec line 607)

In blocking mode, the withhold clone stops at the scan depth and the scan item cap on both the match path and the fail-closed path, and the fail-closed path blanks every attacker-controllable text string while keeping the result's shape.

Scope bounds from the request: one production file (`plugins/assist-plugin/hooks/impl/goal-guard.js`); advisory mode unchanged (fails open, withholds nothing); audit log and finding-store records unchanged (a fail-closed withhold still writes no finding); no `CLAUDE.md` edit; no release doc sync (a separate delivery step).

---

## Acceptance Criteria

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Result wider than the item cap stays bounded | `goal-guard` is blocking; a result holds an array with more items than the scan item cap (`MAX_ITEMS`, 500), one item a hijack | the hook builds the withheld result | the clone holds at most 500 cloned items per level; each item past the cap is the safe notice; the array keeps its original length; no array is shorter than the real output |
| Content past the scan depth does not survive a blocking match | blocking; a hijack rule matches a result that also carries content nested deeper than the scan depth (`MAX_DEPTH`, 6) | the hook rewrites or withholds through `updatedToolOutput` | the clone carries no content from below the scan depth; shape-discriminator keys (`type`, `mimeType`, `role`) stay unchanged |
| Content past the scan depth is blanked on a fail-closed withhold | blocking; the check throws or times out after reading a result with content nested deeper than the scan depth | the hook fails closed | the clone carries no content from below the scan depth; every text string the clone does carry is the safe notice |
| Real tool output validates after blanking | a real `WebFetch`, `WebSearch`, and MCP tool output | the hook blanks each through the withhold clone | each blanked result keeps its tool's output shape (same keys, same array lengths, discriminator keys unchanged), so Claude Code does not silently ignore the `updatedToolOutput` |
| Hijack in a short structural field is blanked on fail-closed | blocking; the check throws or times out; the result carries a hijack in a short title or url | the hook fails closed | the title, the url, and every other attacker-controllable text string are the safe notice; discriminator keys are kept; the withheld result carries no prompt text, file contents, or secret value |
| Evaluation error in blocking mode withholds (existing scenario, spec line 368) | blocking; an evaluation error | the hook runs | the result is withheld through `updatedToolOutput` (now blank-all-text) |
| Evaluation error in advisory mode passes through (existing scenario, spec line 375; unchanged) | advisory mode; an evaluation error | the hook runs | nothing is withheld and nothing is printed; the result passes |
| Fail-closed withhold writes no finding; records unchanged (NFR-031) | blocking; an evaluation failure | the hook fails closed | the deny record under rule id `goal-guard.fail-closed` is the only record; no finding is appended to the baseline store; audit and finding records hold no prompt, file, or secret text |

---

## Implementation Steps

### Step 1: Bound the withhold clone to the scan depth and item cap (both paths)

- **Files:** `plugins/assist-plugin/hooks/impl/goal-guard.js` (modify)
- **Satisfies:** [FR-219, NFR-028 -> Requirement: Depth- and breadth-bounded shape-preserving withhold clone -> Scenarios: Result wider than the item cap stays bounded; Content past the scan depth does not survive a blocking match; Content past the scan depth is blanked on a fail-closed withhold]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:**
  - In `cloneWithNotice` (line 271) and `longestString` (line 292), replace the depth bound `MAX_REPLACE_DEPTH` (32, line 96) with the scan bound `MAX_DEPTH` (6, line 101), using the same comparison `collectText` uses (line 126: a string at any depth is read; an object or array at depth >= `MAX_DEPTH` is not descended). The clone replaces such an object or array with the safe notice. Remove `MAX_REPLACE_DEPTH`, or define it as an alias of `MAX_DEPTH`, so the two bounds cannot drift apart again.
  - Add the per-level breadth cap `MAX_ITEMS` (line 102) to the clone. For an array, clone the first `MAX_ITEMS` items and replace every later item with the safe notice, so the array keeps its original length and is never shortened. For an object, the scan reads only the first `MAX_ITEMS` own keys (line 132): keep every key (shape), and give each key past the cap the safe notice as its value.
  - The cap and depth apply to `cloneWithNotice` calls from `withheldOutput` (match path), `clearResidue`'s final fallback (line 321), and the fail-closed path alike. This is a deliberate match-path behavior change; the match path still strips the hijack span and keeps the bounded benign remainder within the new bounds.
  - Keep the `__proto__`-safe `Object.defineProperty` copy (line 281). Keep non-string primitives (numbers, booleans, null) unchanged.
  - Keep each fixed-vocabulary shape-discriminator key (`type`, `mimeType`, `role`) unchanged on every path, including when the rule check flags its value. Define the set as one named constant next to `TEXT_KEYS`.

### Step 2: Blank every text string on the fail-closed path

- **Files:** `plugins/assist-plugin/hooks/impl/goal-guard.js` (modify)
- **Satisfies:** [NFR-028, FR-219 -> Requirement: Fail closed for the guarded class in blocking mode (MODIFIED) -> Scenarios: Hijack in a short structural field is blanked on fail-closed; Evaluation error in blocking mode withholds; Evaluation error in advisory mode passes through], [NFR-031 -> Requirement: Fail closed for the guarded class in blocking mode -> no finding on fail-closed]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:**
  - Give the clone a blank-all mode. In it, every string value in the cloned structure becomes the safe notice (a url, a title, a query, an id, a bare array item, the root string), except values under the fixed shape-discriminator keys from Step 1. Arrays keep their length and objects keep their keys.
  - Select the mode from `closedOutput` (line 345), which today calls `withheldOutput(input, notice)` with no rule check. The match path (`main`, line 374) calls it with the rule check and must keep the existing bounded strip-the-span behavior, not blank-all. Express the mode as an explicit parameter of `withheldOutput`, not as an inference from `matches` being absent.
  - Keep the `closedOutput` fallback: if building the shaped clone throws, the plain notice still replaces the result.
  - Do not change `run`, `evaluate`, `findingOf`, `recordFinding`, `recordFailClosed`, `failClosedFor`, `failClosedNotice`, `withholdNotice`, the advisory path, or any audit or finding record field. A fail-closed withhold must still write only the `goal-guard.fail-closed` deny record and no finding.

### Step 3: Update the in-file documentation to match the new behavior

- **Files:** `plugins/assist-plugin/hooks/impl/goal-guard.js` (modify)
- **Satisfies:** [FR-219, NFR-028 -> Requirement: Depth- and breadth-bounded shape-preserving withhold clone], [NFR-028, FR-219 -> Requirement: Fail closed for the guarded class in blocking mode]
- **Code references:** `traceability-comment-format.md`, `code-slop.md`
- **Notes:**
  - Rewrite the header comment (lines 20 to 36) and the `TEXT_KEYS` comment (lines 91 to 94), and the comments on `cloneWithNotice`, `clearResidue`, `withheldOutput`, and `closedOutput`, so each states the as-built behavior: clone bounded to scan depth and item cap, array lengths kept, blank-all-text on fail-closed only, strip-the-span on match, discriminator keys kept. Remove statements that the old text no longer supports (clone depth 32, "only the text-bearing strings are replaced" on fail-closed, "a url ... is kept").
  - Add traceability markers for FR-219, NFR-028, and NFR-031 only where the code enforces them; cite no other ID.
  - Do not edit `CLAUDE.md` or any other file in this step.
  - Run the hook's existing self-test path and the two existing test files to confirm the production change loads and the unchanged surfaces still pass. Existing assertions that encode the superseded behavior (a url or title surviving a fail-closed withhold, content between depth 6 and 32 surviving) are expected to fail; hand them to Step 4 and do not edit test files in this step.

### Step 4: Black-box acceptance tests

- **Owner:** `developer-tester` (the `developer` does not write test paths)
- **Files:** `tests/hooks/goal-guard-blocking.test.js` (modify), `tests/hooks/goal-guard.test.js` (modify only if an advisory-mode or record assertion needs it)
- **Satisfies:** [FR-219, NFR-028 -> Requirement: Depth- and breadth-bounded shape-preserving withhold clone -> all four Scenarios], [NFR-028, FR-219 -> Requirement: Fail closed for the guarded class in blocking mode -> Scenario: Hijack in a short structural field is blanked on fail-closed], [NFR-031 -> Requirement: Fail closed for the guarded class in blocking mode -> no finding on fail-closed; records hold no prompt, file, or secret text]
- **Code references:** `languages/javascript.md`, `traceability-comment-format.md`
- **Notes:** Drive the hook as a process with a PostToolUse event on stdin and the rule-mode store set to blocking or advisory; assert only on stdout and on the audit and finding files. Cases, one per Acceptance Criteria row:
  - Fail-closed withhold blanks a short title and a short url to the safe notice, and the output holds no input text.
  - Shape: for a `WebFetch`, a `WebSearch`, and an MCP content-block result, the blanked output has the same keys and array lengths as the input and keeps `type`, `mimeType`, and `role` values unchanged.
  - An array of more than 500 items with one hijack: the emitted array has the original length, items past index 499 are the safe notice, on both the match path and the fail-closed path.
  - Content nested deeper than 6 levels is absent from the output on both the match path and the fail-closed path, with discriminator keys kept.
  - Match path still keeps a benign remainder inside the bounds (the strip-the-span behavior is not blank-all).
  - Advisory mode (match and evaluation error): empty stdout, nothing withheld, still fails open.
  - A fail-closed withhold appends the `goal-guard.fail-closed` deny record, appends no finding, and neither the audit log nor the finding store holds result text.
  - Revise any existing assertion that contradicts the spec's Change Log 2026-11-14 (a short url or title surviving a fail-closed withhold, content below depth 6 surviving). Keep every other existing assertion.

---

## Ordering Rationale

- **Step 1:** shared clone bounds first, because both paths and Step 2's blank-all mode build on the same recursion.
- **Step 2:** the fail-closed blank-all mode on top of the bounded clone; it needs the discriminator-key constant from Step 1.
- **Step 3:** documentation and traceability comments after the behavior is fixed, plus a load and regression run.
- **Step 4:** tests (acceptance, black-box), owned by `developer-tester`; test paths only, written after the implementation.

Each subsequent step depends on the previous step's output.

---

## Notes for Developer

- Reference the `code` skill for language conventions before implementing each step (`languages/javascript.md`, `error-handling-standards.md`).
- Load traceability comments per `skills/code/references/traceability-comment-format.md`.
- Edit only `plugins/assist-plugin/hooks/impl/goal-guard.js`. A `hooks/lib/` helper only if the shared constant or clone cannot live in the file; none is expected.
- Stay inside the scope bounds in the Specification Summary: no advisory-mode change, no audit or finding record change, no `CLAUDE.md` edit, no release or version change.
- The hook is under the `hooks/` LLM security gate in the repository governance (`CLAUDE.md`, "Governance"); the code change needs reviewer and OWASP for LLM sign-off, and tests meet the 70% coverage rule.
- Open point for the developer to settle in code and record in the Step 3 comments: the spec says to keep discriminator keys unchanged and to cap items per level; it does not say what happens to a discriminator key that sits past key 500 of an object. Keep the key and its value unchanged (shape over cap) and state it in the comment.
- Run code quality gates (linting, testing, security audit) at task completion.
