# Task Plan: Strict JSON parser, release-check runner, CLAUDE.md release checklist, and .agent hygiene section

**Target Language:** JavaScript (Node, CommonJS, no dependencies; ES5 for `strict-json.js` per the Node 6 floor of NFR-017, ES2015 elsewhere as in the neighboring scripts)  
**Target Framework:** none (Node built-in test runner: `node --test`)  
**Generated:** 2026-11-20 03:14:00 (regenerated from the corrected specs; fix pass 1 aligned the plan to the broadened `Change Log: 2026-11-20` entries of both specs)

---

## Specification Summary

- **Spec ID:** `specs/spec-hooks-strict-json.md` (parent `spec-hooks-platform.md`) and `specs/spec-release-check.md` (parent `spec-skills-manifests-docs.md`). Neither spec carries a `SPEC-NNN` ID, so `Satisfies` lines cite the spec file and its `Requirement N` (written `strict-json R5`, `release-check R4`). Each spec holds a `Change Log: 2026-11-20` entry whose `Now` text this plan follows: strict-json R7 (1 MiB `readRecords` cap) and R8 (syntax error labeled apart from a strict-parse failure), and release-check R7 (four negation sources). The `Change Log: 2026-11-20` entry of `specs/spec-skills-manifests-docs.md` (MODIFIED Requirements "Manifest versions agree at release" and "Release checklist names every file that carries the version") adds the CLAUDE.md step.
- **Linked Requirements:** FR-248, FR-249, FR-250, FR-251, FR-252, FR-253, FR-173, FR-194, FR-201, FR-217 (harness-governance, secret scan), FR-231, NFR-016, NFR-017, NFR-028, NFR-031, UR-044, UR-046, UR-051, UR-059, UR-068, UR-069, UR-071, UR-075
- **Use Cases:** none defined in either spec

Item 2 adds a dependency-free strict JSON parser and wires it into three governance readers. Item 1 adds a release-check runner with independent sections and a six-place version-agreement section, and updates the CLAUDE.md release checklist to name the root `CHANGELOG.md` as the sixth version place. Item 3 adds the `.agent` hygiene section to that runner. Build order: item 2, then item 1 with the CLAUDE.md edit, then item 3. Each item has its implementation steps first and its `developer-tester` steps after.

---

## Acceptance Criteria

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Duplicate key at the top level | top-level object holds key `a` twice | strict parser reads it | rejected; error carries a character position |
| Duplicate key in a nested object | duplicate key inside an object at depth 5 | strict parser reads it | rejected |
| Depth over 32 | text nested 33 levels | strict parser reads it | rejected |
| Depth at 32 | duplicate-free text nested exactly 32 levels | strict parser reads it | accepted |
| Error holds no input | rejected text holds the string `secret-value` | error is read | error holds no slice of the input and holds a character position |
| Valid input unchanged | valid JSON, no duplicate key, depth 32 or less | strict parser reads it | value deep-equals the `JSON.parse` result |
| Duplicate key in rule-modes.json | `rule-modes.json` holds a duplicate key | a hook reads the rule-mode store | every rule runs advisory; the failure is reported to the health check |
| Valid rule-modes.json unchanged | valid duplicate-free `rule-modes.json`, depth 32 or less | a hook reads the store | result equals the pre-change result |
| Duplicate key in profile.json | `profile.json` holds a duplicate key and a profile is enforced | a hook loads it | guarded tagged-path operations denied until fixed (NFR-028); failure reported to the health check |
| Rejected confirmation record | `confirmations.jsonl` holds one duplicate-key record and one valid record | PR-posting guard reads the store | rejected record ignored; valid record read as before |
| Confirmation store over the size cap | `confirmations.jsonl` is larger than 1 MiB | PR-verdict guard reads the store | `readRecords` yields no records; the guard finds no confirmation for the PR and verdict and denies the verdict post (NFR-028 direction) |
| Confirmation store at or under the cap | `confirmations.jsonl` is 1 MiB or smaller with one duplicate-key record and one valid record | PR-verdict guard reads the store | rejected record ignored; valid record read as before |
| Health check surfaces a rejection | `rule-modes.json` or `profile.json` rejected by the strict parser | `/assist-plugin:health` runs | report names the file and the strict-parse failure |
| No rejection, no finding | both files parse cleanly | `/assist-plugin:health` runs | no strict-parse finding for either file |
| Syntax error labeled apart | `profile.json` holds a plain JSON syntax error, no duplicate key, nesting 32 levels or less | `/assist-plugin:health` runs | report labels it "malformed JSON (syntax)" and does not label it "strict-parse failure" |
| Duplicate-key rejection labeled | `profile.json` or `rule-modes.json` holds a duplicate key | `/assist-plugin:health` runs | report names the file and labels it "strict-parse failure" |
| Other readers untouched | a reader of any other JSON file | this change is applied | that reader keeps `JSON.parse` |
| All sections clean | every section passes | `release-check.js` runs | each section reported clean; exit 0 |
| One failing section does not hide another | `check-fsa-tables.js --check` exits 1 and the version section finds a mismatch | `release-check.js` runs | both findings reported; exit 1 |
| A section that cannot start | a section script cannot start | `release-check.js` runs | remaining sections still run; exit 2 |
| Findings only | at least one finding, no operational error | `release-check.js` runs | exit 1 |
| Operational error only | at least one operational error, no finding | `release-check.js` runs | exit 2 |
| Finding and operational error together | one finding and one operational error in the same run | `release-check.js` runs | both reported; exit 2 |
| Six places agree | all six places read the same version | version section runs | clean |
| Manifest mismatch | `plugin.json` and `marketplace.json` differ | version section runs | finding |
| Absent heading, no release | root `CHANGELOG.md` holds no versioned heading, no `--release` | version section runs | no finding for `CHANGELOG.md` |
| Only older headings, no release | manifests 1.14.4, newest heading 1.14.3, no `--release` | version section runs | no finding for `CHANGELOG.md` |
| Newest heading differs, release | manifests 1.14.4, newest heading 1.14.3, `--release` | version section runs | finding that names `CHANGELOG.md` |
| Absent heading, release | no versioned heading, `--release` | version section runs | finding that names `CHANGELOG.md` |
| Nothing staged | empty index | secret-scan section runs | clean |
| Secret staged | staged change holds a detectable secret pattern | secret-scan section runs | finding |
| Hygiene clean | `.gitignore` ignores `.agent/`, nothing under it tracked, no negated rule in any of the four sources | hygiene section runs | clean |
| Not ignored | no rule ignores `.agent/` | hygiene section runs | finding |
| Tracked file | `.agent/logs/notes.md` is tracked | hygiene section runs | finding that names the path |
| Negated rule reopens a path | root `.gitignore` holds `.agent/*` then `!.agent/governance/` | hygiene section runs | finding for the negated rule, naming the root `.gitignore` |
| Negated rule in a nested .gitignore | a nested `.gitignore` under the repository holds a negated rule that targets `.agent` or a path under it | hygiene section runs | finding that names the nested `.gitignore` and the rule |
| Negated rule in .git/info/exclude | `.git/info/exclude` holds `!.agent/governance/` | hygiene section runs | finding that names `.git/info/exclude` and the rule |
| Negated rule in the global excludes file | the global `core.excludesFile` (resolved via `git config core.excludesFile`) holds `!.agent/governance/` | hygiene section runs | finding that names the global excludes file and the rule; the result is machine-dependent |
| Outside a git repository | working directory is not in a git repository | hygiene section runs | operational error; command exits 2 |
| Sixth file in the checklist | the CLAUDE.md release line after the change | a maintainer reads it | it names both manifests, `CLAUDE.md`, `README.md`, `MARKETPLACE.md` (both places), and the root `CHANGELOG.md` newest heading |
| Stale changelog heading at release | a release whose newest `CHANGELOG.md` heading reads the prior version | the maintainer works the checklist or runs the runner with `--release` | `CHANGELOG.md` flagged as out of date |

---

## Implementation Steps

Paths start at the repository root. Hook and script paths sit under `plugins/assist-plugin/`; tests sit under the repository-root `tests/` (there is no `plugins/assist-plugin/tests/`).

### Item 2: Strict JSON parser and its three readers (build first)

### Step 1: Strict JSON parser module

- **Files:** `plugins/assist-plugin/hooks/lib/strict-json.js` (create)
- **Satisfies:** [strict-json R1 -> FR-248 -> UR-071], [strict-json R2 -> FR-248 -> UR-075], [strict-json R3 -> FR-248 -> NFR-016], [strict-json R4 -> FR-248], [NFR-017]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** Export `parse(text)` and `StrictJsonError`. `parse` returns a value deep-equal to `JSON.parse(text)` for valid, duplicate-free text of depth 32 or less. It throws `StrictJsonError` for a duplicate key at any depth, for nesting over 32 levels (32 accepts, 33 rejects; objects and arrays both count), and for text `JSON.parse` would also reject. The error carries an integer `position` and a fixed `reason` code (`duplicate-key`, `depth`, `syntax`). Its message is built from fixed strings and the position and never holds a slice of the input (NFR-016). Use one scan with its own position tracking; never take a position or message from a `JSON.parse` error, which can quote input. After the scan passes, return `JSON.parse(text)` so value identity holds. Compare keys after decoding escapes (`"a"` and `"a"` are the same key) and track keys per object scope, so the same key in sibling objects is not a duplicate. ES5 only, no `require` of any package, no process spawn (spec Preconditions).

### Step 2: Wire the rule-mode reader

- **Files:** `plugins/assist-plugin/hooks/lib/severity.js` (modify `parseRuleModes`)
- **Satisfies:** [strict-json R5 -> FR-249 -> UR-068], [strict-json R9 -> FR-249]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** Replace `JSON.parse(text)` with `require("./strict-json.js").parse(text)` inside the existing `try`. The existing `catch` already returns `ruleModesOf(null)` (every rule advisory), so a rejection adds no state. `parseRuleModes` stays non-throwing and its result for valid input stays identical. Touch no other `JSON.parse` in `hooks/lib/` except the readers in Steps 3 and 4.

### Step 3: Wire the profile reader

- **Files:** `plugins/assist-plugin/hooks/lib/data-class.js` (modify `readJson` and `loadProfile`)
- **Satisfies:** [strict-json R6 -> FR-249 -> FR-231 -> NFR-028], [strict-json R9 -> FR-249]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** `readJson` is shared with the settings reader `readFlag`, which keeps `JSON.parse` (R9). Give `readJson` an optional second argument `strict` and pass it only from `loadProfile` for `profile.json`. With `strict` set, a rejection with reason `duplicate-key` or `depth` returns `{status: "malformed", strict: true}`; a `syntax` rejection returns `{status: "malformed"}` exactly as before, so the existing `profile-malformed` code is unchanged for plain bad JSON. `loadProfile` maps `strict: true` to problem code `profile-strict-parse`. Add no new status: the result stays `status: "malformed"`, so `deniesTaggedOps` still denies (FR-231, NFR-028). The `StrictJsonError` is never copied into the result. A Grep of `plugins/assist-plugin/` and `tests/` for `profile-malformed` found only the comment above `loadProfile`, so no consumer breaks; that comment lists `profile-strict-parse`. The `profile-malformed` and `profile-strict-parse` codes are what Step 5 turns into the two distinct health labels.

### Step 4: Wire the confirmation-store record reader and cap the read

- **Files:** `plugins/assist-plugin/hooks/lib/confirmation-store.js` (modify `parseLines` and `readRecords`)
- **Satisfies:** [strict-json R7 -> FR-249 -> UR-059], [strict-json R7 -> FR-249 -> NFR-028], [strict-json R9 -> FR-249]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** Two changes. (1) `parseLines` parses each line with the strict parser. A rejected line takes the existing unparseable-line branch (`skipped++`) and the loop continues, so a valid record on another line is still read. (2) `readRecords` caps the read at 1 MiB, the value of `MAX_FILE_BYTES` in `hooks/lib/data-class.js` (`1024 * 1024`). Define a local constant with that value in `confirmation-store.js`; do not import from or change `data-class.js`. Check the size (`fs.statSync` or `fs.fstatSync` before the read) and treat a file with `size > cap` as yielding no records: return `[]` and log one note through the existing `note` helper with a fixed code (for example `store-too-large`) and the file name, never file content. A file of exactly 1 MiB is read. With no records, `readConfirmations` and `findConfirmation` find no confirmation for the PR and verdict, so `pr-verdict-guard.js` denies the verdict post (the NFR-028 fail-closed direction); no guard change is needed. `readRecords` also serves `pending.jsonl`, so an over-cap pending file yields no open tokens, which is the same fail-closed direction. Leave the `JSON.parse` of the pending-record update (the `value = JSON.parse(line)` in the pending-update function) unchanged. `parseLines` and `readRecords` are the record reader of R7 and not a fourth reader module.

### Step 5: Health-check reporting of a rejected rule-modes.json or profile.json

- **Files:** `plugins/assist-plugin/hooks/lib/rule-mode-store.js` (modify: add and export `status(root)`), `plugins/assist-plugin/hooks/impl/health-check.js` (modify: `profileFileLine` and `governanceReport`)
- **Satisfies:** [strict-json R8 -> FR-249 -> UR-069], [strict-json R5 -> FR-249], [strict-json R6 -> FR-249 -> NFR-028]
- **Code references:** `languages/javascript.md`, `logging-standards.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** The report is built in `hooks/impl/health-check.js`; `hooks/lib/health.js` is the shared hook runtime and is not changed. `rule-mode-store.status(root)` returns `{state, reason}` with `state` one of `absent`, `valid`, `rejected` (the strict parser threw; `reason` is its fixed code `duplicate-key`, `depth`, or `syntax`), or `unreadable` (I/O error or a file over `MAX_STORE_BYTES`), and never throws. `read(root)` keeps its all-advisory behavior and is not changed. Label wording (R8, Change Log 2026-11-20): a plain JSON syntax error reads "malformed JSON (syntax)", and "strict-parse failure" is reserved for a duplicate-key or depth rejection. Apply it to both files. For `profile.json`, `profileFileLine` prints "malformed JSON (syntax)" when `loaded.problem` is `profile-malformed` and "strict-parse failure" when it is `profile-strict-parse`; other problem codes (`profile-too-large`, `profile-unreadable`, `profile-not-object`, `data-classes-...`) print as they do today. The enforced and not-enforced message branches keep their fix text, with the syntax branch telling the maintainer to fix the JSON. For `rule-modes.json`, in `governanceReport` add one finding when `status` is `rejected`, naming `.agent/governance/rule-modes.json`; label it "strict-parse failure" with the reason when `reason` is `duplicate-key` or `depth`, and "malformed JSON (syntax)" when `reason` is `syntax`; either way say that every rule runs advisory until the file is fixed. Add no line or finding when the file is `absent` or `valid`. Never print a parser message, a key name, a value, or any input slice (NFR-016). `baaReadiness` also prints `loaded.problem`; leave it as is. Run the existing `tests/hooks/health-check-*.test.js` files after the edit; the file has a self-test corpus that must stay green.

### Step 6: Strict parser tests

- **Owner:** `developer-tester`
- **Files:** `tests/hooks/strict-json.test.js` (create)
- **Satisfies:** [strict-json R1 -> FR-248], [strict-json R2 -> FR-248], [strict-json R3 -> FR-248 -> NFR-016], [strict-json R4 -> FR-248]
- **Code references:** `languages/javascript.md`
- **Notes:** Black-box tests from the scenarios. Duplicate key at the top level and at depth 5 reject. Depth 33 rejects and depth 32 accepts, for nested objects and for nested arrays. The error holds an integer position and none of `secret-value` or any other input slice (check `message` and `String(error)`). Valid input deep-equals `JSON.parse`. Boundary cases the spec implies: an escaped duplicate key (`"a"` and `"a"`), the same key in two sibling objects (accepted), and malformed text that `JSON.parse` also rejects (rejected with a position). Run: `node --test tests/hooks/strict-json.test.js`.

### Step 7: Reader behavior tests

- **Owner:** `developer-tester`
- **Files:** `tests/hooks/strict-json-readers.test.js` (create)
- **Satisfies:** [strict-json R5 -> FR-249], [strict-json R6 -> FR-249 -> FR-231 -> NFR-028], [strict-json R7 -> FR-249 -> NFR-028], [strict-json R9 -> FR-249]
- **Code references:** `languages/javascript.md`
- **Notes:** Use temp project roots, as `tests/hooks/data-class.test.js`, `tests/hooks/confirmation-store.test.js`, and `tests/hooks/severity.test.js` do. Cases: a duplicate-key `rule-modes.json` gives every rule advisory; a valid `rule-modes.json` gives the pre-change result; a duplicate-key `profile.json` with a profile enforced denies the guarded tagged-path operations and `loadProfile` reports `profile-strict-parse`; a plain-syntax-error `profile.json` still reports `profile-malformed`; a `confirmations.jsonl` with one duplicate-key record and one valid record ignores the first and reads the second; a duplicate key in `.claude/settings.json` is still read by `JSON.parse` semantics (R9 regression: last value wins, no rejection). Size-cap cases (strict-json R7, Change Log 2026-11-20): (a) over the cap: a `confirmations.jsonl` of 1 MiB plus 1 byte that holds one valid confirmation record (pad with blank lines so the record is valid and only the size is over the cap) gives no records from `readConfirmations`, `findConfirmation` finds no confirmation for that PR and verdict, and the PR-verdict guard denies the verdict post (drive the guard as `tests/hooks/pr-verdict-guard.test.js` does); (b) at or under the cap: a `confirmations.jsonl` of exactly 1 MiB (1024 * 1024 bytes, padded with blank lines) that holds one duplicate-key record and one valid record ignores the first, reads the second, and the guard accepts the matching verdict. Build both large files at run time in the temp root. Run: `node --test tests/hooks/strict-json-readers.test.js`.

### Step 8: Health-check tests

- **Owner:** `developer-tester`
- **Files:** `tests/hooks/health-check-strict-json.test.js` (create)
- **Satisfies:** [strict-json R8 -> FR-249 -> UR-069]
- **Code references:** `languages/javascript.md`
- **Notes:** Cases: a rejected `rule-modes.json` and a rejected `profile.json` are each named in the `governanceReport` output with the strict-parse failure; both files clean gives no strict-parse finding for either; an absent `rule-modes.json` gives no finding; the report never holds a key name or value from the rejected file. Label distinction (strict-json R8, Change Log 2026-11-20): a `profile.json` with a plain JSON syntax error (no duplicate key, nesting 32 levels or less) is labeled "malformed JSON (syntax)" and the report does not hold "strict-parse failure" for that file; a `profile.json` with a duplicate key and a `profile.json` nested 33 levels are each labeled "strict-parse failure"; a `rule-modes.json` with a plain syntax error is labeled "malformed JSON (syntax)" and not "strict-parse failure", and a `rule-modes.json` with a duplicate key is labeled "strict-parse failure". Check each label against the one file's own line or finding so a label on the other file cannot satisfy it. Follow the setup style of `tests/hooks/health-check-1-12-0.test.js`. Run: `node --test tests/hooks/health-check-strict-json.test.js`.

### Item 1: Release-check runner and the CLAUDE.md checklist (build second)

### Step 9: Version-agreement section module

- **Files:** `plugins/assist-plugin/scripts/release/version-agreement.js` (create)
- **Satisfies:** [release-check R4 -> FR-251 -> FR-173 -> FR-194 -> UR-046], [release-check R5 -> FR-251]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** Export `check(root, options)` returning `{outcome, details}`, `outcome` one of `clean`, `finding`, `error`, with one detail line per disagreeing place naming the file. Read six places under `root`: `plugins/assist-plugin/.claude-plugin/plugin.json` (`version`); the entry named `assist-plugin` in `.claude-plugin/marketplace.json` (`version`); the `CLAUDE.md` Plugin line (`- **Plugin:** ... (vX.Y.Z)`); the `README.md` heading `### assist-plugin vX.Y.Z`; the `MARKETPLACE.md` heading of the same form and its Versioning sentence (`Version X.Y.Z is available`); and the newest versioned heading of the root `CHANGELOG.md`, which is the first line in file order matching `## [X.Y.Z]` (the file lists newest first; `## [Unreleased]` is not a versioned heading). The reference version is the `plugin.json` version, and every other place is compared with it, so a `plugin.json` and `marketplace.json` mismatch is a finding. A missing or unparseable file among the first five places is an `error` outcome (the section could not complete), not a finding. For `CHANGELOG.md`, apply the settled rule with `options.release` (set by `--release`): without it, never a finding, whether the heading is absent (no versioned heading at all, or the file is missing), older, or equal. With it, a finding that names `CHANGELOG.md` when the newest heading is absent or differs from the manifest version.

### Step 10: Runner with independent sections and exit-code precedence

- **Files:** `plugins/assist-plugin/scripts/release-check.js` (create)
- **Satisfies:** [release-check R1 -> FR-250 -> UR-044], [release-check R2 -> FR-250 -> UR-051], [release-check R3 -> FR-250], [release-check R4 -> FR-251], [release-check R6 -> FR-252 -> FR-217]
- **Code references:** `languages/javascript.md`, `logging-standards.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** Interface contract (the developer-tester relies on it): `node plugins/assist-plugin/scripts/release-check.js [--root DIR] [--release]`. `--root` defaults to `process.cwd()` (the git queries and the six version places resolve there); the section scripts are located from the runner's own folder. An unknown argument is an operational error with exit 2, as in `check-control-register.js`. The module exports `run(options)` with `{root, release, sections}`, `scriptSection(name, scriptPath, args)`, and `exitCodeOf(outcomes)`; `sections` is an optional injected list of `{name, run(context)}` returning `{outcome, details}`, and the CLI uses the real list. Real order: `sync-writing-standard` (`--check`), `check-fsa-tables` (`--check`), `check-control-register` (`--check`), `scan-staged-secrets`, `version-agreement` (Step 9, called with `{release}`). Step 15 appends the hygiene section. `scriptSection` runs `spawnSync(process.execPath, [script, ...args], {cwd: root, timeout})` and maps the status: 0 is `clean`; 1 is `finding`; a spawn error, a signal, a timeout, a missing script, or any status above 1 is `error`. Every section runs whatever an earlier section returned, and each prints on its own line as `<clean|finding|error>: <section name>` followed by indented detail lines. The staged-secret section passes the scanner's own `<path>: <rule>` lines through and never prints a matched value (NFR-031). For a section that errors, print a fixed reason (`could not start`, `timed out`, `exit status N`), never raw stderr. The exit code is 2 when any section is `error` (this outranks a finding), else 1 when any section is `finding`, else 0. The module sets `process.exitCode`, never calls `process.exit` mid-run, and runs `main` only under `require.main === module`. R6 is met by this wrapper: an empty index makes `scan-staged-secrets.js` exit 0 (clean) and a detected secret makes it exit 1 (finding).

### Step 11: MARKETPLACE.md scripts line

- **Files:** `MARKETPLACE.md` (modify the `scripts/ (...)` line in the structure tree, line 50: append `release-check.js`)
- **Satisfies:** [FR-201], [release-check R1 -> FR-250]
- **Code references:** `traceability-comment-format.md`
- **Notes:** `tests/docs/contracts-docs-1-12-0.test.js:463` fails when a top-level `scripts/*.js` file is missing from that line, so adding `release-check.js` in Step 10 requires this edit. The helper modules sit in `scripts/release/` (a subfolder) and are not listed by that test. Write no em dash (the prose gate denies it). Run `node --test tests/docs/contracts-docs-1-12-0.test.js` after the edit.

### Step 12: CLAUDE.md release checklist names the root CHANGELOG as the sixth version place

- **Files:** `CLAUDE.md` (modify only the line that starts `When releasing, update the version in`, line 146)
- **Satisfies:** [FR-194 -> UR-046], [FR-173 -> UR-046], [release-check R4 -> FR-251]
- **Code references:** `traceability-comment-format.md`
- **Notes:** Append a sixth item to the existing list: the newest `## [X.Y.Z]` heading of the root `CHANGELOG.md`, which must read the release version, so a stale heading is out of date. Keep the line starting with `When releasing, update the version in` and keep each of the five existing items exactly as written (`plugins/assist-plugin/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CLAUDE.md` (the Plugin line), `README.md` (the `### assist-plugin v` heading), `MARKETPLACE.md` (the heading and the Versioning sentence)), because `tests/docs/contracts-docs-1-12-0.test.js:322` matches those strings. This is a prose edit limited to that version-file list; do not change the Keeping counts in sync list, the counts, or any other line, and do not add release-check.js code or a `--release` explanation here. Write no em dash. OWASP-for-LLM gate: `CLAUDE.md` is an LLM surface (Governance in `CLAUDE.md`), so this step takes the gate; the edit adds no instruction text, only a file name to a list.

### Step 13: Runner, version-section, and secret-scan tests

- **Owner:** `developer-tester`
- **Files:** `tests/scripts/release-check.test.js` (create), `tests/scripts/release-check-version.test.js` (create)
- **Satisfies:** [release-check R1 -> FR-250], [release-check R2 -> FR-250], [release-check R3 -> FR-250], [release-check R4 -> FR-251], [release-check R5 -> FR-251], [release-check R6 -> FR-252]
- **Code references:** `languages/javascript.md`
- **Notes:** `release-check.test.js` drives `run` with injected sections for the precedence cases: all clean exits 0 and reports each section clean; two findings exit 1 and both are reported; a section that errors still lets the remaining sections run and exits 2; a finding plus an operational error in one run exits 2 with both reported; an unknown CLI argument exits 2. It drives `scriptSection` with a missing script path (operational error, rest still run). It also runs the CLI against a throw-away git repository (scrubbed environment, as in `tests/scripts/scan-staged-secrets.test.js`) for the secret-scan section: an empty index is clean; a staged secret, assembled at run time from pieces so no secret literal sits in the test file, is a finding and the output never holds the secret value. `release-check-version.test.js` builds six-place fixtures: all agree is clean; `plugin.json` and `marketplace.json` mismatch is a finding; a stale `README.md` heading names `README.md`; a stale `MARKETPLACE.md` Versioning sentence names `MARKETPLACE.md`; manifests at 1.14.4 with newest `CHANGELOG.md` heading 1.14.3 passes without `--release` and is a finding that names `CHANGELOG.md` with it; a `CHANGELOG.md` with no versioned heading (or no file) passes without `--release` and is a finding with it; a missing manifest is an operational error. Run: `node --test tests/scripts/release-check.test.js tests/scripts/release-check-version.test.js`.

### Step 14: CLAUDE.md checklist test

- **Owner:** `developer-tester`
- **Files:** `tests/docs/claude-md-release-checklist.test.js` (create)
- **Satisfies:** [FR-194 -> UR-046], [FR-173 -> UR-046]
- **Code references:** `languages/javascript.md`
- **Notes:** Read `CLAUDE.md` and find the line that starts `When releasing, update the version in`. Assert it names the two manifests, `CLAUDE.md`, `README.md`, `MARKETPLACE.md`, and the root `CHANGELOG.md` newest heading (six places). Assert the line holds no em dash. Leave `tests/docs/contracts-docs-1-12-0.test.js` as it is; its five-place assertions still hold. Run: `node --test tests/docs/claude-md-release-checklist.test.js tests/docs/contracts-docs-1-12-0.test.js`.

### Item 3: `.agent` hygiene section (build third)

### Step 15: Hygiene section and its registration in the runner

- **Files:** `plugins/assist-plugin/scripts/release/agent-hygiene.js` (create), `plugins/assist-plugin/scripts/release-check.js` (modify: append the `agent-hygiene` section after `version-agreement`)
- **Satisfies:** [release-check R7 -> FR-253 -> UR-044], [release-check R8 -> FR-253], [release-check R1 -> FR-250]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`
- **Notes:** Export `check(root)` returning `{outcome, details}`. Three checks. (1) Ignored as a whole: `git check-ignore -q --no-index .agent/` run in `root`; status 0 is ignored, status 1 is a finding, any other status (git exits 128 outside a repository) is an `error`. (2) Untracked: `git ls-files -z -- .agent`; each listed path is a finding line that names the path; a failing command is an `error`. (3) Negation, across four sources (release-check R7, Change Log 2026-11-20): (a) the root `.gitignore` at `<root>/.gitignore`; (b) every nested `.gitignore` under the repository, enumerated with fixed git arguments (`git ls-files -z --cached --others --exclude-standard -- ':(glob)**/.gitignore'`, which also lists the root file, so skip a duplicate of source (a)); (c) `.git/info/exclude`, located with `git rev-parse --git-path info/exclude` so a linked worktree resolves to the shared git directory; (d) the global excludes file, located with `git config --path --get core.excludesFile` (status 1 means the key is unset, so there is no global source and no finding; any other nonzero status is an `error`). In each source file, report each `!` rule whose pattern, after removing a leading `/` or `**/`, equals `.agent` or starts with `.agent/` (for example `!.agent/governance/`). Apply the same pattern test to every source; a nested `.gitignore` rule is matched by its pattern text and not resolved against that file's folder, so a negated `.agent` rule in a nested folder is reported (the spec words the check by pattern). Each negation finding line names its source (`.gitignore`, the nested file path relative to `root`, `.git/info/exclude`, or `global core.excludesFile` followed by its resolved path) and the rule. A finding from the global source carries the fixed suffix `(machine-dependent)`, because the global excludes file is not part of the repository and the same commit can pass on one machine and fail on another (the accepted trade-off in the spec). A source file that does not exist adds no finding; a source file that exists but cannot be read is an `error`. A missing root `.gitignore` adds no negation finding; check (1) already reports not-ignored. Use fixed git arguments with `spawnSync`, no shell, and never print git stderr. Outside a git repository the section returns `error`, and the runner's precedence rule gives exit 2 whether or not another section reports a finding. This is distinct from the FR-245 write protection of `.agent` paths, which this step does not touch.

### Step 16: Hygiene section tests

- **Owner:** `developer-tester`
- **Files:** `tests/scripts/release-check-agent-hygiene.test.js` (create)
- **Satisfies:** [release-check R7 -> FR-253], [release-check R8 -> FR-253], [release-check R3 -> FR-250]
- **Code references:** `languages/javascript.md`
- **Notes:** Throw-away git repositories with a scrubbed environment: set `HOME` to a temp directory, set `GIT_CONFIG_NOSYSTEM=1`, and remove `XDG_CONFIG_HOME` and `GIT_CONFIG_GLOBAL`, so the global source is deterministic and the test never reads the maintainer's own git configuration. Cases: `.gitignore` holds `.agent/` and nothing is tracked, and no source holds a negation (clean); no ignore rule (finding); `.agent/logs/notes.md` force-added (finding that names the path); root `.gitignore` holds `.agent/*` then `!.agent/governance/` (finding for the negated rule that names `.gitignore`); a nested `.gitignore` (for example `sub/.gitignore`) holds `!.agent/governance/` (finding that names `sub/.gitignore` and the rule); `.git/info/exclude` holds `!.agent/governance/` (finding that names `.git/info/exclude` and the rule); a global excludes file, set by writing `core.excludesFile` into the temp `HOME/.gitconfig`, holds `!.agent/governance/` (finding that names the global excludes file and the rule and carries `(machine-dependent)`); an unrelated negation such as `!keep.txt` in each source gives no finding; `core.excludesFile` unset gives no global finding and no error; a temp directory outside any repository (operational error from `check`, and the CLI run with `--root <that directory>` exits 2 even though other sections also report findings, which proves the operational error outranks a finding). Run: `node --test tests/scripts/release-check-agent-hygiene.test.js`.

---

## Requirement Coverage

The table lists every step whose `Satisfies` line cites the requirement, implementation steps first and test steps after.

| Requirement | Steps |
|---|---|
| strict-json R1, R2, R3, R4 | 1 (implement), 6 (test) |
| strict-json R5 | 2, 5 (implement), 7 (test) |
| strict-json R6 | 3, 5 (implement), 7 (test) |
| strict-json R7 (strict parse of each record, and the 1 MiB `readRecords` cap) | 4 (implement), 7 (test) |
| strict-json R8 (health report, and the syntax versus strict-parse labels) | 5 (implement), 8 (test) |
| strict-json R9 | 2, 3, 4 (implement), 7 (test) |
| release-check R1 | 10, 11, 15 (implement), 13 (test) |
| release-check R2 | 10 (implement), 13 (test) |
| release-check R3 | 10 (implement), 13, 16 (test) |
| release-check R4 | 9, 10, 12 (implement), 13 (test) |
| release-check R5 | 9 (implement), 13 (test) |
| release-check R6 | 10 (implement), 13 (test) |
| release-check R7 (ignored as a whole, tracked paths, and negation in four sources: root `.gitignore`, nested `.gitignore` files, `.git/info/exclude`, global `core.excludesFile`) | 15 (implement), 16 (test) |
| release-check R8 | 15 (implement), 16 (test) |
| FR-194, FR-173 (six-place checklist) | 12 (implement), 14 (test) |
| FR-201 (repository documents match the scripts) | 11 (implement; its test is the existing `tests/docs/contracts-docs-1-12-0.test.js`, run in Step 11 and Step 14) |

---

## Ordering Rationale

- **Step 1:** The parser has no dependency and every reader needs it.
- **Steps 2-4:** The three readers, each a one-reader edit that uses the Step 1 module; Step 4 also adds the `readRecords` size cap.
- **Step 5:** Health reporting needs the Step 3 problem codes and a rule-mode status function.
- **Steps 6-8:** Item 2 tests, owned by `developer-tester`; test paths only.
- **Step 9:** The version section is a pure module the runner calls.
- **Step 10:** The runner assembles the sections and fixes the exit-code rule.
- **Step 11:** The scripts-line edit follows the runner, which adds the first new top-level script.
- **Step 12:** The CLAUDE.md checklist edit sits with the item 1 work, after the runner and the version section that check the same six places.
- **Steps 13-14:** Item 1 tests, owned by `developer-tester`.
- **Step 15:** The hygiene section reuses the Step 10 section contract, so it follows the runner.
- **Step 16:** Item 3 tests, owned by `developer-tester`.

Each subsequent step can depend on previous steps' outputs.

---

## Notes for Developer

- Reference the `code` skill for language conventions before implementing each step.
- Load traceability comments per [references/traceability-comment-format.md](../../code/references/traceability-comment-format.md).
- Run code quality gates (linting, testing, security audit) at task completion. New code needs 70% coverage or more; measure with `node --test --experimental-test-coverage` over the new test files. The repository has no `package.json`, so there is no npm test script.
- **Settled decisions (from the user, do not reopen).** A release is requested by a `--release` flag on `release-check.js`. An operational error always exits 2 and outranks a finding; exit 1 only with a finding and no operational error; exit 0 with neither. With no `--release`, the newest `CHANGELOG.md` heading is never a finding (absent, older, or equal); with `--release`, an absent or disagreeing newest heading is a finding. Tests live under `tests/hooks/` and `tests/scripts/` (and `tests/docs/` for the CLAUDE.md check). The health report lives in `hooks/impl/health-check.js`. The profile reader's strict flag applies only to `profile.json`; the `.claude/settings.json` reader stays on `JSON.parse`. The confirmation-store change covers `parseLines` (strict parse of each line) and `readRecords` (the 1 MiB cap; an over-cap file yields no records, so the PR-verdict guard denies). The hygiene negation check scans four sources (root `.gitignore`, nested `.gitignore` files, `.git/info/exclude`, global `core.excludesFile`), each finding names its source, and the global source is machine-dependent by accepted trade-off.
- **LLM-security gate.** Steps 1 to 5 change files under `plugins/assist-plugin/hooks/`, and Step 12 changes `CLAUDE.md`. Both surfaces take the OWASP-for-LLM gate in `CLAUDE.md` (Governance). The scripts in `plugins/assist-plugin/scripts/` are outside the gate's path list.
- **Prose gate.** Steps 11 and 12 edit Markdown. The prose gate denies an added em dash, curly quote, or chatbot phrase; write plain ASCII punctuation.
- **Design choices inside the spec.** A strict `syntax` rejection in `readJson` keeps the old `profile-malformed` code (Step 3), so only a duplicate key or excess depth shows as `profile-strict-parse`. The health report labels a syntax error "malformed JSON (syntax)" and a duplicate-key or depth rejection "strict-parse failure", for both files (Step 5). For `rule-modes.json`, any strict-parser rejection is `rejected` in `status(root)` with its fixed reason code, and the report label follows that code (Step 5). A missing root `CHANGELOG.md` counts as an absent heading, not an operational error (Step 9). The `readRecords` cap reuses the 1 MiB value of data-class `MAX_FILE_BYTES` as a local constant, not an import (Step 4). A nested `.gitignore` negation is matched by pattern text, not resolved against the file's folder (Step 15).
- **Not planned.** The CLAUDE.md "Keeping counts in sync" list does not gain a `release-check.js` line, and no doc other than `MARKETPLACE.md` and the CLAUDE.md version-file list is edited; neither spec requires it. Strict parsing for any other `JSON.parse` reader is the follow-up in section 4 of `FR-NFR-harness-governance.md` (strict-json R9).
