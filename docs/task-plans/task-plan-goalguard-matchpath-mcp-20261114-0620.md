# Task Plan: goal-guard blocking-match MCP discriminator and key-name hardening

**Target Language:** JavaScript (Node, CommonJS; `plugins/assist-plugin/hooks/impl/goal-guard.js` uses `"use strict"` and `require`)  
**Target Framework:** none (a Claude Code PostToolUse hook; tests use `node:test` in `tests/hooks/`)  
**Generated:** 2026-11-14 06:20:00

---

## Specification Summary

- **Spec ID:** none assigned. `specs/spec-hooks-goal-guard.md` carries no `SPEC-NNN` ID, so steps cite the requirement and scenario titles of its newest section, "Change Log: 2026-11-14 (goal-guard blocking-match MCP discriminator and key-name hardening)" (line 741), and the linked FR and NFR IDs.
- **Linked Requirements:** FR-219, NFR-028, NFR-031 (all in `docs/requirements/FR-NFR-harness-governance.md`)
- **Use Cases:** none cited by the spec
- **Governing requirement:** MODIFIED "Depth- and breadth-bounded shape-preserving withhold clone" (spec line 767)
- **Sources:** the newest section of `specs/spec-hooks-goal-guard.md` (lines 741 to 834: scenarios at lines 779 to 816, the two test edits the build must make at line 834); `plugins/assist-plugin/hooks/impl/goal-guard.js`; `tests/hooks/goal-guard-blocking.test.js`

On a blocking hijack match for an `mcp__*` tool, the withhold clone also blanks the `type`, `mimeType`, and `role` values and renames the object key names (the existing `blankedKey` rename), in addition to the existing whole-string replacement of a matched string value. A matched ordinary string is replaced wholesale with the notice; an unmatched short structural string (title, url, id) is kept verbatim. `WebFetch`, `WebSearch`, and a missing or non-string `tool_name` keep the verbatim carve-out. The fail-closed path is unchanged.

Scope bounds from the request: one production file (`plugins/assist-plugin/hooks/impl/goal-guard.js`); reuse `blankedKey` and `SHAPE_KEYS`, add no new scheme; do not extend `collectText`; no change to advisory mode, audit-log records, finding-store records, no-finding-on-fail-closed, the depth cap (`MAX_DEPTH`), the item cap (`MAX_ITEMS`), or `CLAUDE.md`. The release sync (1.14.1 to 1.14.2) is a separate step.

---

## Acceptance Criteria

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Hijack in an MCP discriminator value is blanked on a blocking match | blocking; an `mcp__*` result with hijack text the scanner matches in a `type`, `mimeType`, or `role` value (a discriminator value is a scanned string value, so it triggers the match on its own, with or without a second hijack elsewhere) | the hook withholds through `updatedToolOutput` on the match | each discriminator value is the safe notice; no `type`, `mimeType`, or `role` value carries attacker text; array lengths and object key counts are kept |
| Hijack in an MCP object key name is renamed on a blocking match | blocking; an `mcp__*` result with hijack text as an object key name, and a hijack matched in an ordinary string elsewhere | the hook withholds on the match | that key is renamed by the position-based rename (position 0 the notice, position n the notice plus ` #n`); no original key name survives at any level; key count kept |
| Ordinary MCP string values on a match: matched values replaced, unmatched values kept | blocking; an `mcp__*` result with a matched (hijack-bearing) ordinary string and a separate short, unmatched structural string (a title, a url, an id) | the hook withholds on the match | the matched ordinary string is replaced wholesale with the safe notice (no benign remainder of that string is kept); the unmatched short structural string is kept verbatim; ordinary strings are not all blanked (blank-all is the fail-closed path only) |
| WebFetch and WebSearch keep discriminators and key names verbatim on a match | blocking; a `WebFetch` or `WebSearch` result with a matched hijack in its body | the hook withholds on the match | `type`, `mimeType`, `role` values and every key name are verbatim; the result keeps its tool shape |
| Known limit, a hijack only in an MCP object key name is not withheld on a match | blocking; an `mcp__*` result whose only hijack text is in an object key name, nothing matching in any string value | the result reaches the hook | no match, no withhold on the match path, because `collectText` does not read key names (it is not extended); recorded as open for the Step 36 reassessment (FR-238) |
| Depth and breadth caps hold on the match path (existing, unchanged) | blocking; an `mcp__*` result wider than 500 items or nested deeper than 6 levels, with a matched hijack | the hook withholds on the match | arrays keep their original length, items past the cap are the notice, nothing from below depth 6 survives |
| Advisory mode withholds nothing (existing, unchanged) | advisory mode; an `mcp__*` result with a match | the hook runs | empty stdout; the result passes unchanged |
| Records unchanged (NFR-031) | blocking; an `mcp__*` match | the hook runs | one finding is written and one deny audit record; neither holds result text, URL, query, discriminator value, or key name; a fail-closed withhold still writes no finding |

---

## Implementation Steps

### Step 1: Apply the MCP shape blanking on the blocking-match path

- **Owner:** `developer`
- **Files:** `plugins/assist-plugin/hooks/impl/goal-guard.js` (modify)
- **Satisfies:** [FR-219, NFR-028 -> Requirement: Depth- and breadth-bounded shape-preserving withhold clone (MODIFIED) -> Scenarios: Hijack in an MCP discriminator value is blanked on a blocking match; Hijack in an MCP object key name is renamed on a blocking match; Ordinary MCP string values on a match: matched values replaced, unmatched values kept; WebFetch and WebSearch keep discriminators and key names verbatim on a match], [NFR-031 -> same Requirement -> records unchanged]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:**
  - `withheldOutput` (line 405): set `blankShape` from the tool class alone, `isObject(input) && isMcpTool(input.tool_name)`, on both paths. Drop the `blank &&` condition. A missing or non-string `tool_name` still gives `false` (carve-out kept). Keep `blankAll` as the explicit caller parameter.
  - `cloneWithNotice` (line 327): `blankShape` is no longer always paired with `blankAll`. Today `blankShape` is false on the match path, so the keep-branch at line 347 (`isShapeValue(key, child) && !policy.blankShape`) keeps a `SHAPE_KEYS` string verbatim even when a rule flags it; it never reaches the ordinary-string branch. Once `blankShape` is true on the match path, that keep-branch is skipped for an `mcp__*` tool and the string would fall to the ordinary-string branch, where an unflagged discriminator value survives. Under `blankShape`, make a `SHAPE_KEYS` string value the notice unconditionally (add a branch before the recursive call, next to the keep-branch), matching spec lines 783 to 784. Leave the ordinary-string branch alone: with `blankAll` false it replaces a text-bearing or flagged string wholesale (lines 329 to 330) and keeps an unmatched short structural string verbatim.
  - Keep the rename as is: `blankedKey(notice, index)` for every key under `blankShape`, with `TEXT_KEYS.has(key)` still read from the original key name (the `textual` flag is computed before the rename), so the text-bearing strings are still replaced. Keep the `Object.defineProperty` copy (`__proto__`-safe) and the item cap on the value of keys past `MAX_ITEMS`.
  - `clearResidue` (line 381): its final fallback (line 388) calls `cloneWithNotice` with a literal `blankShape: false`, on `current`, which is already a blanked clone for an MCP result, so the fallback cannot restore verbatim discriminators or key names. Pass the policy's `blankShape` through anyway (add a parameter, or pass the policy) as a defensive, idempotent pass-through: `blankedKey` is positional, so a second rename gives the same names. `matches(collectText(...))` reads values only, so the renamed keys do not change residue detection.
  - `longestString` (line 358) skips `SHAPE_KEYS` values by key name. After the rename an MCP clone holds no `type`, `mimeType`, or `role` key, and the former discriminator values are already the notice, so no change is expected. Confirm this in the code and leave the function as is for WebFetch and WebSearch.
  - Do not change `collectText`, `MAX_DEPTH`, `MAX_ITEMS`, `SHAPE_KEYS` membership, `blankedKey`, `closedOutput` (the fail-closed call keeps `blankAll` true), `run`, `evaluate`, `findingOf`, `recordFinding`, `recordFailClosed`, `failClosedFor`, the advisory path, or any audit or finding field.

### Step 2: Update the in-file documentation to match the new behavior

- **Owner:** `developer`
- **Files:** `plugins/assist-plugin/hooks/impl/goal-guard.js` (modify)
- **Satisfies:** [FR-219, NFR-028 -> Requirement: Depth- and breadth-bounded shape-preserving withhold clone (MODIFIED)], [FR-219 -> Scenario: Known limit, a hijack only in an MCP object key name is not withheld on a match]
- **Code references:** `traceability-comment-format.md`, `code-slop.md`
- **Notes:**
  - Rewrite the comments that now misstate behavior: the header (line 28, "keeps every object key", which is false for MCP after the change; lines 29 to 30, "strips the hijack span and keeps the bounded benign remainder", which misdescribes the whole-string replacement; lines 31 to 34 and 52 to 53, "kept on the blocking-match path for every tool" and the Known limit sentence; lines 42 to 48, which present the tool-class split as fail-closed only when it now holds on both paths), the `SHAPE_KEYS` comment (lines 113 to 119), the comments on `isShapeValue` (line 300), `cloneWithNotice` (lines 319 to 326, "`blankShape` is only ever set together with `blankAll`" and "the benign remainder stays"), `clearResidue` (lines 379 to 380, "a match that survives only there is left in place", which no longer holds for MCP), `withheldOutput` (lines 395 to 404, "strip the hijack span" and "blankShape is set only on the blank-all path"), the `main()` comment at line 456 ("a match strips the hijack span and keeps the bounded remainder", the same sub-string-stripping misdescription: a match replaces the matched string wholesale), and `closedOutput` if needed.
  - State the as-built rule: the carve-out is kept for WebFetch, WebSearch, and a missing or non-string tool name on both paths; an `mcp__*` result has its discriminator values blanked and its key names renamed on both paths; on the match path a matched ordinary string (and a text-bearing string) is replaced wholesale with the notice and an unmatched short structural string (title, url, id) is kept verbatim; every string is blanked only on the fail-closed path.
  - Record the known limit in the header: `collectText` does not read object key names, so a hijack only in an MCP key name is not matched and not withheld; the scanner extension is deferred to the Step 36 reassessment (FR-238). Cite FR-219, NFR-028, and NFR-031 only where the code enforces them.
  - Do not edit `CLAUDE.md` or any other file. Run the two existing hook test files, `tests/hooks/goal-guard.test.js` and `tests/hooks/goal-guard-blocking.test.js`. The prose-gate and prose-advisor hooks cover only `.md`, `.mdx`, `.txt`, `.rst`, and `.adoc` files (`hooks/lib/prose-rules.js`), so they do not apply to comments in a `.js` file; only the SubagentStart writing-context injection covers them. List the failures that encode the superseded MCP match-path behavior (Step 3 lists them) and hand them to Step 3. Do not edit test files in this step.

### Step 3: Black-box acceptance tests

- **Owner:** `developer-tester` (the `developer` does not write test paths)
- **Files:** `tests/hooks/goal-guard-blocking.test.js` (modify)
- **Satisfies:** [FR-219, NFR-028 -> Requirement: Depth- and breadth-bounded shape-preserving withhold clone (MODIFIED) -> all five Scenarios], [NFR-031 -> same Requirement -> a blocking match still writes one finding and a fail-closed withhold none; records hold no result, URL, query, or secret text]
- **Code references:** `languages/javascript.md`, `traceability-comment-format.md`
- **Notes:** Drive the hook as a process with a PostToolUse event on stdin and the rule-mode store set to blocking or advisory; assert only on stdout and on the audit and finding files. Reuse the file's helpers (`run`, `payload`, `assertWithheld`, `collectStrings`, `collectKeys`, `deepNest`, `wideBlocks`, `HIJACK`). New cases:
  - MCP discriminator: an `mcp__*` block array and a `{content, isError}` object with a hijack in `type`, `mimeType`, and `role` (each alone and all three), plus a matched hijack in `text`. Every discriminator value of the output is the withhold notice; no attacker text survives; array lengths and key counts equal the input's. After the key rename no `type`, `mimeType`, or `role` key exists in an MCP clone, so a literal `out.type` lookup returns `undefined`. Find the value one of two ways: assert on the value at the original key's position (the first key of the object keeps position 0, a later key is the nth entry of `Object.values`), or assert that none of the original discriminator strings appears in `collectStrings(output)`. The fail-closed test (starts at line 1327) at `tests/hooks/goal-guard-blocking.test.js:1340-1342` already uses the absence form (`collectStrings(mcpOut).indexOf(value) === -1`); follow it.
  - MCP key name: a matched hijack in `text` and hijack text as a key name. No input key name survives at any level (`collectKeys`); the key count is kept; the first key at each level is the notice and later keys are the notice plus ` #n`.
  - Whole-string replacement: an MCP ordinary string that matches is replaced wholesale with the notice (no benign remainder of that string survives); a separate short, unmatched structural string (a title, a url, an id) stays verbatim as input. This is not blank-all.
  - Carve-out: `WebFetch` and `WebSearch` blocking-match results keep `type`, `mimeType`, `role` and every key name verbatim. A missing or non-string `tool_name` is unreachable through the hook process: the hook's scope check already excludes it, so it prints nothing. The existing rows at `tests/hooks/goal-guard.test.js:304-325` (through `evaluate`) cover the missing and non-string `tool_name` cases (`""`, `undefined`, `42`); the existing test at `tests/hooks/goal-guard-blocking.test.js:687` covers the named out-of-scope tools (`Read`, `Bash`, `Grep`, `Task`, `Agent`). Add no new case.
  - Caps on the match path for an MCP result: an array wider than 500 keeps its original length with notices past the cap; content nested past depth 6 is absent.
  - Known limit: an MCP result whose only hijack is in an object key name, with nothing matching in any string value, is not withheld on the match path (empty stdout, pass record, no finding). This is the one residual.
  - Discriminator-value-only: include a case where the hijack sits only in a `type`, `mimeType`, or `role` value of an `mcp__*` result, with nothing else matching. Assert it IS matched and blanked on the match path (stdout carries the withheld output, every discriminator value is the notice, one finding and one deny record are written), because `collectText` reads string values and discriminator values are among them. This case is not a residual.
  - Records: an MCP blocking match appends one finding and one deny record, with no result text, URL, query, discriminator value, or key name in either; advisory mode prints nothing for the same input; a fail-closed withhold still writes no finding. The WebSearch records test at lines 1410 to 1419 is the template for the new MCP records case; do not revise it.
  - Revise the existing cases that encode the superseded MCP match-path behavior:
    - `[AC-1 | BLOCKING | FR-219] mcp__*: the replacement keeps the MCP result shape` (line 746): replace the same-key and `type === "text"` assertions (lines 752 to 763) and the `assertShapePreserved` call (line 749) for MCP. Line 758 also asserts `updated.isError === false`; that key name goes away after the rename, so replace it with a key-count check on the renamed object. Reword the title: the new title must describe the new MCP match-path behavior (discriminators blanked, key names renamed), so it no longer claims the MCP result shape is kept.
    - `any MCP server and tool name is governed and withheld with the same shape` (line 768): `assertShapePreserved` on blocks that now hold renamed keys. Reword the title: the new title must match the new MCP match-path behavior (discriminators blanked, key names renamed), so it no longer claims the same shape.
    - Well-formedness check for both cases above (lines 746 and 768): the `assertShapePreserved` call at line 749 carried the only top-level JSON-type check (`tag(output) === tag(input)`), and the spec's MODIFIED requirement says the emitted clone SHALL remain well-formed, with no acceptance row covering it for the match path. In each revised case, keep a top-level type check (`tag(updated) === tag(input)`) and assert that the output array length equals the input length (for the `{content, isError}` object shape, also that `content` is an array of the input's length).
    - `blocking-match path: MCP content past the scan depth ... keeps its type discriminator` (line 830): asserts `updated[0].type === "text"`. Reword the title: the new title must match the new MCP match-path behavior (discriminators blanked, key names renamed), so it no longer claims the type discriminator is kept.
    - The file-header comment at lines 43 to 44, "The blocking-match path keeps the discriminators and key names for every tool": reword so it holds only for `WebFetch` and `WebSearch` (spec line 834 names this edit and the line 837 assertion as the two the build must make).
    - Also check the MCP block-array case at line 852.
  - Keep each revised case's depth, length, and no-hijack assertions; replace the type and key-name assertions with the new behavior. Keep every other existing assertion, including the WebFetch and WebSearch ones.

---

## Ordering Rationale

- **Step 1:** the behavior change, in one file. The three edits (tool-class policy, forced notice for discriminator values, residue-fallback pass-through) depend on each other.
- **Step 2:** comments after the behavior is fixed, so they state what was built.
- **Step 3:** tests, owned by `developer-tester`; test paths only, written after the implementation and without reading it.

Each subsequent step depends on the previous step's output.

---

## Notes for Developer

- Reference the `code` skill for language conventions before each step (`languages/javascript.md`, `error-handling-standards.md`).
- Edit only `plugins/assist-plugin/hooks/impl/goal-guard.js` in Steps 1 and 2. No version, changelog, `CLAUDE.md`, or doc change; the 1.14.2 release sync follows separately.
- The hook is under the `hooks/` LLM security gate in the repository governance (`CLAUDE.md`, "Governance"): the change needs reviewer and OWASP for LLM sign-off, and the tests meet the 70% coverage rule.
- Scanner scope, settled: `collectText` (lines 148 to 169) pushes every string value and recurses into object values, so it reads `type`, `mimeType`, and `role` values; it never reads object key names. A hijack in a discriminator value therefore matches, triggers the withhold, and is blanked on the MCP match path once `blankShape` applies there. A hijack only in an object key name, with nothing matching in any string value, does not match and is not withheld; that key-name-only case is the one residual, deferred to the Step 36 reassessment (FR-238). This follows `DECISIONS.md` (2026-11-14, "Correction to the match-path MCP residual scope (key names only, not discriminator values)") and the spec's newest section (the Known limit scenario, around line 810). Do not widen or narrow the scanner.
- Blocking mode is off by default this release; the vector goes live only at the user-run Step 36 promotion (`scripts/promote-rule.js`).
- Run code quality gates (linting, testing, security audit) at task completion.
