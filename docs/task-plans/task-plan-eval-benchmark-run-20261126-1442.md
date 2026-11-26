# Task Plan: Benchmark-run enablement (oracle override, OQ-14 values, worked sample)

**Target Language:** JavaScript (Node, CommonJS, no dependencies, ES2015 syntax, as in `plugins/assist-plugin/scripts/eval-harness/config.js`)  
**Target Framework:** none (Node built-in test runner: `node --test`; the existing `claude plugin eval` runner is reused)  
**Generated:** 2026-11-26 14:42:00

---

## Specification Summary

- **Spec ID:** `specs/spec-evaluation-harness.md`, the 2026-11-26 Change Log delta (line 683 onward). The spec carries no `SPEC-NNN` ID, so `Satisfies` lines cite the delta's requirement blocks by the short names below.
- **Linked Requirements:** FR-258, FR-259, FR-260, FR-261, FR-271, FR-277, FR-281, FR-285, FR-287, NFR-039 (`docs/requirements/FR-NFR-harness-governance.md`; section 5 "Provisional values (OQ-14)" at line 2540; D-16 split at line 2524); OQ-14 and OQ-15 at `docs/requirements/URD-harness-governance.md:146-147`; `DECISIONS.md:630` ("Settle OQ-14 (provisional) and OQ-15 (local oracle via override) for the benchmark run")
- **Use Cases:** none defined in the spec

Spec requirement short names used in `Satisfies` lines:

| Short name | Delta requirement block | Scenarios |
|---|---|---|
| R-A | ADDED: Oracle-location resolution from an uncommitted override (spec lines 691-732) | 5 |
| R-B | ADDED: Worked-sample task as the golden-task template (spec lines 734-770) | 5 |
| R-C | MODIFIED: Configured values settled provisionally (OQ-14) (spec lines 774-778); carries Was/Now/Reason and no Scenario block, so its acceptance criteria are the OQ-14 table at `FR-NFR-harness-governance.md:2542-2548` and the FR scenarios it cites | 0 |

The build lets the maintainer run a real benchmark: the private oracle location resolves from an environment variable or an uncommitted override and errors clearly when unset; the five OQ-14 numbers ship as provisional values; one clearly-marked worked sample task, public parts committed and private parts in a gitignored local directory, serves as the template for the production golden tasks.

Intake result: the nine `### Requirement:` blocks of the spec each hold at least one `#### Scenario:`; the two ADDED delta blocks each hold five `##### Scenario:` blocks. Language: JavaScript (the harness and its tests are `.js`; no `tsconfig.json`).

---

## Acceptance Criteria

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Environment variable resolves the location (R-A) | `ASSIST_EVAL_ORACLE_DIR` names a readable oracle directory | the harness resolves the oracle location | it uses the environment-variable location |
| Uncommitted override resolves the location (R-A) | no environment variable and an uncommitted local override naming a readable oracle directory | the harness resolves the oracle location | it uses the override location |
| Override preferred over the committed placeholder (R-A) | a committed `oracleLocation` placeholder and an override naming a real location | the harness resolves the oracle location | it uses the override and does not treat the placeholder as a real path |
| No override and no usable committed location (R-A) | no environment variable, no override, committed `oracleLocation` is the placeholder | the harness resolves the location for a run | it reports an error stating the location is unset, scores nothing, and substitutes no default |
| Committed config holds no machine path (R-A) | the committed `harness.config.json` | its `oracleLocation` is read | it is a non-sensitive placeholder with no machine path and no private URL |
| Public parts committed, private parts gitignored (R-B) | the worked-sample task | the repository is inspected | `prompt.md`, `task.json`, `rubric.json`, `graders/` are committed under `evals/<suite>/<sample>/`; reference and hidden suite sit only in the gitignored `evals/oracle-local/<suite>/<sample>/` |
| Sample marked a template (R-B) | the sample and its README | they are read | they mark the sample a template and state it is excluded from production benchmark scoring |
| Template excluded from an unfiltered benchmark run, runnable by explicit case (R-B; derived from the SHALL sentence "SHALL NOT be counted as a production benchmark task", not a spec Scenario) | a case whose `task.json` holds `"template": true` and a normal case | `listCases` runs with no case id, and again with the template's case id | the unfiltered list omits the template and includes the normal case; the explicit case id lists the template; held-out filtering behaves as before |
| Sample public parts pass the package check (R-B) | a published package file list holding the sample's public parts | `package-check.js` validates it | it finds no oracle path and reports clean |
| Sample reference passes its hidden suite (R-B) | the reference, the hidden suite, and the configured validation run count | the harness validates the sample | the reference passes on each consecutive run and the harness admits the sample |
| Production set authored from the sample (R-B) | the sample as the template | the maintainer authors production tasks | each suite holds 1 to 3 in-house tasks and at least one per suite is held out (documented in the sample README; authoring is the maintainer's, not part of this build) |
| OQ-14 values provisional (R-C) | the committed `harness.config.json` | it is loaded with all five OQ-14 keys required | runCount 5, regressionMargin 0.05, referenceValidationRuns 3, judgeRuns 3, newTasksPerRelease 1 load; retryOnFailure stays 0 |

---

## Implementation Steps

### Step 1: Oracle-location resolution from an env variable or an uncommitted override

- **Owner:** `developer`
- **Files:** `plugins/assist-plugin/scripts/eval-harness/config.js` (modify), `plugins/assist-plugin/scripts/eval-harness/run-benchmark.js` (modify, `loadSettings` at lines 484-491 only)
- **Satisfies:** [R-A -> FR-260, FR-261 -> NFR-039]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `logging-standards.md`, `traceability-comment-format.md`, `code-slop.md`
- **Notes:**
  - Add `resolveOracleLocation` beside `resolveFloor` (`config.js:143-151`) with the same override-wins shape. Order: environment variable `ASSIST_EVAL_ORACLE_DIR`, then the `oracleLocation` key of an uncommitted override file `harness.config.local.json` that sits beside the config file being loaded, then the committed `oracleLocation`. A blank environment variable counts as unset. An absent override file is no override; an override file that exists but is unreadable or not valid JSON is an error with a fixed reason (never silently ignored).
  - Run every candidate through the existing `checkLocation` (`config.js:156-169`) so the type, length, NUL, and embedded-credentials rules (FR-260, FR-261) apply to the env and override values too. A relative path in the override file resolves against the override file's directory; an environment value resolves against the working directory.
  - Replace the direct read at `config.js:214` with the resolved value. Return `oracleLocation` and `oracleLocationSource` (`"env"`, `"override"`, `"committed"`, or `null`), like the floor's `source`.
  - Add a `loadConfig` option `requireOracle` (default false) and an injectable `env` option (default `process.env`). When `requireOracle` is true and nothing resolves, push `oracleLocation (FR-260): oracle location is unset; set ASSIST_EVAL_ORACLE_DIR or the uncommitted override file` and return `ok: false`. The default stays false because `compare.js:52` and the existing tests load a config with no oracle (`tests/scripts/eval-harness-config.test.js:367-368`). No default location is ever substituted.
  - In `run-benchmark.js` `loadSettings`, pass `requireOracle: true` to both `loadConfig` calls. Leave `oracle.js` `resolveOracle` (`oracle.js:134-147`) unchanged: it still errors `oracle-not-configured` for a blank value and `oracle-unreachable` for an unreadable directory.
  - An error reason is fixed text and never holds the path, URL, or any env value (the loader's existing contract, `config.js:11-12`). Update the file header comment to describe the three sources.
- **Acceptance criteria:**
  - With the env variable set to a readable directory and an override file present, `loadConfig(..., { requireOracle: true })` returns that directory with source `env`.
  - With no env variable and an override file naming a directory, it returns the override with source `override`, even when the committed value is a real-looking string.
  - With no env variable, no override file, and committed `oracleLocation: null`, it returns `ok: false` and an error that names `oracleLocation` and states it is unset; the error text holds no path.
  - `loadConfig` called without `requireOracle` still returns `ok: true` with `oracleLocation: null` for that same input (existing callers unchanged).
  - A credential-bearing URL in the env or override value is rejected (`oracleLocation (FR-261): must not embed credentials`).
  - `run-benchmark.js` prints `error: configuration oracleLocation ...` and exits 2 with no runner call when the location is unset.

### Step 2: Provisional OQ-14 values, ignore rules, and the pointer description

- **Owner:** `developer`
- **Files:** `plugins/assist-plugin/evals/harness.config.json` (modify), `plugins/assist-plugin/evals/.gitignore` (modify), `plugins/assist-plugin/evals/README.md` (modify)
- **Satisfies:** [R-C -> FR-271, FR-277, FR-259, FR-285, FR-281], [R-A -> FR-261 -> NFR-039], [FR-287]
- **Code references:** `code-slop.md`
- **Notes:**
  - `harness.config.json`: set `runCount` 5, `regressionMargin` 0.05, `referenceValidationRuns` 3, `judgeRuns` 3, `newTasksPerRelease` 1 (values from `FR-NFR-harness-governance.md:2544-2548` and spec lines 588-594; each is provisional with no empirical basis). Leave `oracleLocation` as `null`, the committed non-sensitive placeholder (no machine path, no URL). Leave `retryOnFailure` 0 (FR-287: no retry-until-pass), `judgeEnabled` false, `labeledSamplePath` null, and the judge-agreement floor unchanged.
  - `.gitignore`: add `oracle-local/` and `harness.config.local.json` (the override file from Step 1) next to the existing `results/` line. The user asked for `oracle-local/`; the override-file entry follows from the override design and needs sign-off (see Notes for Developer).
  - `README.md`: in the Benchmark harness section, replace the bullet that says the oracle location is "named by `oracleLocation` in `evals/harness.config.json`" so it describes the resolution order (env variable, uncommitted override file, committed placeholder), the unset error, and the layout `evals/oracle-local/<suite>/<case>/reference/` and `hidden/`. Update the "Benchmark oracle" bullet under Limits: the OQ-14 values now ship as provisional values, and one sample template (Step 4) exists; production golden tasks are still the maintainer's to author. Keep prose free of em dashes and curly quotes (the prose gate denies them).
- **Acceptance criteria:**
  - `loadConfig(SHIPPED_CONFIG, { require: [all five OQ-14 keys] })` returns `ok: true` with 5, 0.05, 3, 3, 1.
  - The committed `oracleLocation` is `null`; no committed file under `evals/` matches an absolute path, `~`, a drive letter, `://`, or `@` in a location field (NFR-039, FR-261).
  - `git check-ignore -v` reports both `oracle-local/x` and `harness.config.local.json` as ignored by `evals/.gitignore`.
  - The README names the env variable, the override file, and the unset error, and states that values are provisional.

### Step 3: Config and resolution tests

- **Owner:** `developer-tester` (test paths only)
- **Files:** `tests/scripts/eval-harness-config.test.js` (modify), `tests/scripts/eval-harness-run-benchmark.test.js` (modify)
- **Satisfies:** [R-A -> FR-260, FR-261 -> NFR-039], [R-C -> FR-271, FR-277, FR-259, FR-285, FR-281], [FR-287]
- **Code references:** `languages/javascript.md`
- **Notes:** Name each test `[AC-n | spec-evaluation-harness | FR-n] ...` (`tests/hooks/gate-evidence.test.js:161` form). Isolate the environment: pass the injectable `env` option, or delete `ASSIST_EVAL_ORACLE_DIR` from `process.env` in setup and restore it after, so an exported variable on the maintainer's machine cannot change a result. Cases:
  - env set loads with source `env` and wins over an override and a committed value;
  - override file loads with source `override` and wins over the committed placeholder; a relative override path resolves against the override file's directory;
  - unset with `requireOracle: true` returns `ok: false`, names `oracleLocation`, says unset, and holds no path; unset without `requireOracle` still loads with `null`; a blank env value counts as unset;
  - a malformed override file errors with a fixed reason; a credential-bearing URL in env or override errors;
  - the committed config holds no sensitive path: `oracleLocation` is `null` or a placeholder with no absolute path, `~`, drive letter, URL scheme, or `@`;
  - the committed config carries 5, 0.05, 3, 3, 1, `retryOnFailure` 0, `judgeEnabled` false, `labeledSamplePath` null, and loads with all five keys required (replace the either/or assertion at `eval-harness-config.test.js:274-280`, which no longer needs its unset branch);
  - `run-benchmark.js` with an unset oracle exits 2, prints a configuration error that names `oracleLocation`, and starts no runner (extend `eval-harness-run-benchmark.test.js:461-468`).
- **Acceptance criteria:** `node --test tests/scripts/eval-harness-config.test.js tests/scripts/eval-harness-run-benchmark.test.js` exits 0, and the full eval-harness test set (`tests/scripts/eval-harness-*.test.js`) still exits 0.

### Step 4: Worked sample task, public parts and README template

- **Owner:** `developer`
- **Files:** `plugins/assist-plugin/evals/dev/sample-template-slugify/prompt.md` (create), `plugins/assist-plugin/evals/dev/sample-template-slugify/task.json` (create), `plugins/assist-plugin/evals/dev/sample-template-slugify/rubric.json` (create), `plugins/assist-plugin/evals/dev/sample-template-slugify/graders/names-slugify-file.md` (create), `plugins/assist-plugin/evals/dev/sample-template-slugify/README.md` (create)
- **Satisfies:** [R-B -> FR-258, FR-259, FR-281], [R-B -> FR-261 -> NFR-039], [FR-287]
- **Code references:** none (documents and JSON; the prose standard in `rules/writing-standard.md` applies)
- **Notes:**
  - Suite is `dev`, not `code`: the harness accepts only `dev` and `spec` (`oracle.js:30`, `run-benchmark.js:66`, `task-validator.js:250`), and `evals/code/` holds `claude plugin eval` skill cases with no `task.json` or oracle. The case id `sample-template-slugify` matches `IDENTIFIER_PATTERN` (`results.js:40`) and the oracle case-id pattern (`oracle.js:31`).
  - `prompt.md`: front matter as in `evals/code/03-no-invented-ids/prompt.md` (`max_turns`, `timeout_seconds`, `allowed_tools`, `runs`), with `allowed_tools` adding `Write`, `Edit`, `Bash` because a `dev` case receives that grant (`run-benchmark.js:79`). Body: a self-contained task. Create `slugify.js` in the working directory exporting `slugify(text)` through `module.exports = { slugify }`; lowercase the text; keep ASCII letters and digits; turn each run of any other characters into one hyphen; strip a leading and trailing hyphen; throw a `TypeError` for a non-string; return `""` when nothing is left; no I/O, no clock, no randomness. The prompt must hold enough to write the hidden suite from it alone.
  - `task.json`: `provenance` `"in-house"` (FR-258), `creation_date` `"2026-11-26"`, `valid_against_cutoff` (the training cutoff date of the agent model under test, in `YYYY-MM-DD` form; the plan does not fix it, the maintainer confirms it), `held_out` `false`, plus `"template": true` and a one-line description. `listCases` reads `template` after Step 4b; the field also marks the sample for readers.
  - `rubric.json`: the delta lists it as a public part. Hold two separate groups, `deterministic` (one item: the hidden suite exits 0) and `subjective` (empty list). The validator reads a rubric for `spec` tasks only (`task-validator.js:267`), so for this `dev` sample it is a template of the shape.
  - `graders/names-slugify-file.md`: a regex grader in the format of `evals/code/03-no-invented-ids/graders/has-function.md` (`type: regex`, `match: contains`, pattern `slugify\.js`). It is a smoke check on the final message; the score comes from the hidden suite exit code.
  - `README.md` (the template marker): states the sample is a template and is excluded from production benchmark scoring; lists the authoring checklist (1 to 3 in-house tasks per suite with at least one held out, FR-258 no public dataset, hidden test names in the `[AC-n | spec | FR-n]` form, deterministic hidden tests with no clock, randomness, or network, FR-287; reference passes the configured consecutive runs, FR-259; at least one new task per release, FR-281); shows where the private parts go and how to point the harness at them (env variable or override file). `prepareWorkspace` copies every public file except `graders/`, `task.json`, and `rubric.json` into the agent workspace (`oracle.js:33-35`, `:275-278`), so this README and `prompt.md` reach the agent: keep both free of reference code, test text, and the private path.
  - No directory under the sample is named `reference` or `hidden` (`package-check.js:43-47`, `oracle.js:259-262`).
- **Acceptance criteria:**
  - The five files exist and `task.json` parses with `provenance` `in-house`, real `YYYY-MM-DD` dates, `template` true.
  - `README.md` contains the words "template" and "excluded from production benchmark scoring" (or the same statement in plain form) and no oracle content.
  - `git status --porcelain` lists only these five files as new under `evals/dev/`.

### Step 4b: Enforce the template exclusion in `listCases`

- **Owner:** `developer` for `run-benchmark.js`; `developer-tester` for the test (test path only)
- **Files:** `plugins/assist-plugin/scripts/eval-harness/run-benchmark.js` (modify, `listCases` at lines 121-162 only), `tests/scripts/eval-harness-list-template.test.js` (create)
- **Satisfies:** [R-B -> "SHALL NOT be counted as a production benchmark task" (spec line 736; was documentation-only) -> FR-280, FR-281]
- **Code references:** `languages/javascript.md`, `traceability-comment-format.md`, `code-slop.md`
- **Notes:**
  - `run-benchmark.js`: add `isTemplate(taskDir)` beside `isHeldOut` (`run-benchmark.js:121-124`), reading `task.json` with the existing `readJsonFile` and returning true only for `template === true` (a string `"true"` or `false` is not a template, the same strictness as `held_out`). In `listCases`, skip a case when `isTemplate` is true and `settings.caseId` is not set. An explicit case id, which `--case` supplies (`runBenchmark` passes it at `run-benchmark.js:584`, and `--list` passes it at `:725`), bypasses the filter, so the template still lists and runs on request.
  - Leave the held-out filter exactly as it is (`run-benchmark.js:154-157`): a `held_out` case is omitted unless `benchmark` is true. The two filters are independent; a case that is both a template and held out follows both rules.
  - Update the comment above `listCases` and the header comment's `--list` line to state the template rule. `task-validator.js` needs no change: `checkMetadata` ignores keys it does not read, so `template` does not make a task invalid.
  - When the only case in a suite is the template, an unfiltered run reports the existing `no golden task found under evals/dev or evals/spec` error; the message is unchanged.
  - Test (`developer-tester`, black-box from this step's behavior description, without reading the implementation): a new file, so it does not collide with the Step 3 edits to `eval-harness-run-benchmark.test.js`. Build a temporary `evals/` fixture with `dev/normal-case`, `dev/template-case` (`"template": true`), `dev/held-case` (`"held_out": true`), and `dev/string-template` (`"template": "true"`), plus a `spec/` template case, each with a minimal `task.json`. Call the exported `listCases({ evalsDir, ... })`. Name each test `[AC-n | spec-evaluation-harness | FR-280] ...`.
- **Acceptance criteria:**
  - An unfiltered `listCases` (`benchmark: true`, no `caseId`) omits the `"template": true` case in `dev/` and in `spec/` and still includes the normal case.
  - `listCases` with `caseId` set to the template case's id (with and without `benchmark: true`) includes it.
  - Held-out behavior is unchanged: `held-case` is omitted from an ordinary list and included when `benchmark` is true; a template-false or string `"true"` case is not treated as a template.
  - `node --test tests/scripts/eval-harness-list-template.test.js` exits 0, and the existing `tests/scripts/eval-harness-run-benchmark.test.js` still exits 0.

### Step 5: Worked sample reference solution (private, gitignored)

- **Owner:** `developer`
- **Files:** `plugins/assist-plugin/evals/oracle-local/dev/sample-template-slugify/reference/slugify.js` (create; gitignored, never committed)
- **Satisfies:** [R-B -> FR-259, FR-260, FR-261 -> NFR-039], [FR-287]
- **Code references:** `languages/javascript.md`, `error-handling-standards.md`, `traceability-comment-format.md`, `code-slop.md`
- **Notes:** Create this only after Step 2 added `oracle-local/` to `evals/.gitignore`. A pure function: lowercases, collapses each run of non-`[a-z0-9]` characters to one hyphen, strips edge hyphens, throws `TypeError` for a non-string, returns `""` for an empty result. It must follow the Step 4 prompt exactly and be deterministic (FR-287). Same SPDX header as the harness scripts. The directory is the layout `oracle.js:11-14` reads: `<location>/<suite>/<case>/reference/`, with `<location>` being `plugins/assist-plugin/evals/oracle-local`.
- **Acceptance criteria:**
  - `git check-ignore -v plugins/assist-plugin/evals/oracle-local/dev/sample-template-slugify/reference/slugify.js` names the `oracle-local/` rule, and `git status --porcelain` lists nothing under `oracle-local/`.
  - `oracle.js` `lookupCase` for suite `dev` and the case id returns a non-null `referenceDir` once `ASSIST_EVAL_ORACLE_DIR` points at `evals/oracle-local`.

### Step 6: Worked sample hidden test suite (private, gitignored)

- **Owner:** `developer-tester` (test path; written black-box from `prompt.md` only, without reading the reference)
- **Files:** `plugins/assist-plugin/evals/oracle-local/dev/sample-template-slugify/hidden/slugify.test.js` (create; gitignored, never committed)
- **Satisfies:** [R-B -> FR-259, FR-260, FR-261 -> NFR-039], [FR-287], [FR-256]
- **Code references:** `languages/javascript.md`
- **Notes:** Node `--test` file (`oracle.js` and `coding-score.js` run it with `node --test`). It loads the candidate with `require("./slugify.js")`. Every test name starts with the scenario identifier `[AC-n | sample-template-slugify | FR-256]` (pattern `SCENARIO_ID`, `task-validator.js:37`; the test names a literal string, because the validator reads names from source text). Cover: lowercasing, run-collapsing, edge hyphen stripping, digits kept, non-string throws `TypeError`, empty result is `""`. Tests are deterministic: no clock, no randomness, no network, no file I/O, no retry (FR-287). The file name matches `HIDDEN_TEST_FILE` (`.test.js`).
- **Acceptance criteria:**
  - `validateTask` on `evals/dev/sample-template-slugify` with the local oracle returns `accepted` (every test name carries a scenario identifier; reference and hidden suite are present).
  - `git status --porcelain` lists nothing under `oracle-local/`.

### Step 7: Sample structure tests (committed parts only)

- **Owner:** `developer-tester` (test paths only)
- **Files:** `tests/scripts/eval-harness-sample-template.test.js` (create)
- **Satisfies:** [R-B -> FR-258, FR-261 -> NFR-039]
- **Code references:** `languages/javascript.md`
- **Notes:** These tests read committed files only and never need the private oracle, so they run in CI. Walk `plugins/assist-plugin/evals/` and skip `oracle-local/` (git ignores it; the walk mirrors git's package list). Cases: the sample directory holds `prompt.md`, `task.json`, `rubric.json`, `graders/`; `task.json` provenance is `in-house` with real dates and `template` true; `rubric.json` keeps `deterministic` and `subjective` as separate arrays; the sample README states template and excluded-from-production scoring; `checkPackageFiles` over the walked relative paths returns `ok` (no `reference` or `hidden` directory); `evals/.gitignore` holds `oracle-local/` and `harness.config.local.json`; the sample's public files contain no `require("./slugify.js")` hidden-test text and no `module.exports` reference code. Name tests in the `[AC-n | spec-evaluation-harness | FR-n]` form.
- **Acceptance criteria:** `node --test tests/scripts/eval-harness-sample-template.test.js` exits 0 on a checkout with no `oracle-local/` directory and on one that has it.

### Step 8: Validation, free checks (package check, listing, task admission)

- **Owner:** `developer` (commands only; no file changes)
- **Files:** none
- **Satisfies:** [R-B -> FR-261 -> NFR-039], [R-B -> FR-258], [R-A -> FR-260]
- **Code references:** none
- **Notes:** Run, from the repository root, with `ASSIST_EVAL_ORACLE_DIR` set to the absolute path of `plugins/assist-plugin/evals/oracle-local` for the commands that need it. None of these starts a model call.
  - Package check: `git ls-files -z --cached --others --exclude-standard -- plugins/assist-plugin | tr '\0' '\n' | node plugins/assist-plugin/scripts/eval-harness/package-check.js` prints `clean` and exits 0. Confirm the list holds the five public sample files and no `oracle-local/` path.
  - Negative control: the same listing with `--no-exclude-standard` in place of `--exclude-standard` holds the oracle-local paths, and `package-check.js` exits 1 naming the `reference` and `hidden` paths. This shows the gitignore rule is what keeps the oracle out of the package list.
  - `node plugins/assist-plugin/scripts/eval-harness/run-benchmark.js --list --benchmark --suite dev` omits `dev/sample-template-slugify` (Step 4b), and the same command with `--case sample-template-slugify` lists it.
  - `validateTask` on the sample returns `accepted`; run the same call with the env variable unset and an override file removed to confirm the unset error (Step 1).
- **Acceptance criteria:** package check clean (exit 0) and negative control exit 1 naming oracle paths; the unfiltered `dev` listing omits the sample and the `--case` listing includes it; the task validates as accepted with the oracle present and errors, scoring nothing, with it unset.

### Step 9: Validation, reference admission and stability

- **Owner:** `developer` (commands and a scratch copy outside the working tree; no repository file changes)
- **Files:** none
- **Satisfies:** [R-B -> FR-259], [FR-287], [R-B -> FR-260]
- **Code references:** none
- **Notes:** Use a small `node -e` call (or a scratch script under the session scratchpad, never inside the repository) against `oracle.js`.
  - Harness admission at the configured count: `admitReference({ oracle, suite: "dev", caseId: "sample-template-slugify", runs: <referenceValidationRuns from config, 3> })` returns `admitted: true`. This is the FR-259 gate.
  - Stability at the run count: call `runHiddenSuite(referenceDir, hiddenDir)` five times in a row (k = 5, the configured `runCount`); each returns `pass`. This is the stricter check the maintainer asked for; it is not the FR-259 count, which is 3.
  - Not vacuous: copy the reference to an OS temp directory, introduce one defect (for example skip the edge-hyphen strip), and run the hidden suite against it; it exits non-zero. Remove the copy.
  - Flakiness (FR-287): the five runs report the same per-test outcomes; no test is flagged flaky; the configuration holds no retry setting.
- **Acceptance criteria:** admission returns `admitted: true` on 3 of 3 runs; 5 of 5 consecutive direct runs pass; the mutated copy fails; no flaky test; `git status --porcelain` shows no change.

### Step 10: Validation, end-to-end run and the four runner behaviors

- **Owner:** `developer` (commands, then one README edit)
- **Files:** `plugins/assist-plugin/evals/README.md` (modify: record the confirmed behaviors under Limits)
- **Satisfies:** [R-A -> FR-260, FR-261 -> NFR-039], [R-B -> FR-259, FR-260], [FR-287]
- **Code references:** `code-slop.md`
- **Notes:**
  - Prerequisites. This step makes paid runner calls: one case at `runCount` 5 is five runner invocations. Cost is unmeasured here; the `$25 to $75` figure is the estimate for a full 20-case run (`evals/README.md:45`), not for this run. Get the user's go-ahead before running. The `claude` CLI must be on the path. This machine lacks the sandbox backend (`socat`, `bubblewrap`; `evals/README.md:52`), so a `dev` case reads `not-run` until the user installs them (a host change outside the working tree).
  - Create the uncommitted override `plugins/assist-plugin/evals/harness.config.local.json` with `oracleLocation` set to `oracle-local` (resolved against the override file's directory), with `ASSIST_EVAL_ORACLE_DIR` unset, so the run is override-pointed. The override file is gitignored.
  - Run `node plugins/assist-plugin/scripts/eval-harness/run-benchmark.js --suite dev --case sample-template-slugify --scoreboard <scratch path outside the repository>`. The scratch scoreboard keeps the committed `evals/scoreboard.json` untouched and keeps the template out of any stored production result.
  - Expected: with a sandbox backend, `dev/sample-template-slugify: pass@1 ... (k=5, c=..., harness ...)` and `benchmark-version` and `benchmark-suites` lines; without one, the runs read `not-run` and pass@1 is absent, never 0 (FR-264, FR-271). Either is a valid end-to-end result for this step; record which one occurred.
  - Confirm the four runner behaviors the harness assumes (ASM-7, `run-benchmark.js:34-38`), and write each outcome (confirmed, differs, or not exercisable) in `evals/README.md` under Limits, with the evidence source:
    - (a) the signal for a missing sandbox backend: read the stored runner `aggregate-result.json` shape (a prior one sits at `plugins/assist-plugin/evals/results/2026-11-19T17-48-14-215Z/aggregate-result.json`) and check that a refused shell grant shows in a run's `error` text matching `SANDBOX_ERROR` (`run-benchmark.js:81`);
    - (b) the LLM-judge grader config schema: read the runner documentation or `claude plugin eval --help`; the judge is off (`judgeEnabled` false) and the `dev` suite never uses it, so record "read, not exercised";
    - (c) how an ordinary run excludes a held-out case, and whether an ordinary `claude plugin eval plugins/assist-plugin` also picks up `evals/dev/` cases (README line 3 says the runner finds suites under `evals/`): a held-out exclusion enforced only in `listCases` (`run-benchmark.js:121-162`) does not make the runner skip the case, and the same holds for the template exclusion of Step 4b;
    - (d) how to list cases without a paid run: find the flag in the runner help and record it.
  - Also confirm the two `defaultRunner` assumptions (`run-benchmark.js:182-184`): the agent's files land in the prepared workspace, and the runner reads the case from `evals/<suite>/`. If either differs, report it; do not edit `run-benchmark.js` in this step.
  - NFR-039 and FR-261 check after the run: grep the scratch scoreboard and the stored run result for strings that appear only in the hidden suite and the reference (a distinctive test name fragment); the scoreboard holds none. `git status --porcelain` shows no oracle path and no `harness.config.local.json`.
- **Acceptance criteria:**
  - The run finishes without an exit-2 abort (no leak, no unreachable location, no configuration error) and prints a score line or a not-run line for the sample.
  - The four behaviors each have a recorded outcome in `evals/README.md`.
  - The scratch scoreboard holds scores, identifiers, and versions only; no reference or hidden-suite text anywhere in the working tree outside `oracle-local/`.

---

## Ordering Rationale

- **Step 1:** The loader change first; the sample runs and the validation depend on override resolution.
- **Step 2:** Config values, ignore rules, and docs next, because Step 5 must not create oracle files before `oracle-local/` is ignored.
- **Step 3:** Tests for Steps 1 and 2, owned by `developer-tester`; test paths only (the developer never writes test paths).
- **Steps 4 to 6:** The sample: public parts, then the private reference, then the private hidden suite. The hidden suite is a test path, so `developer-tester` writes it from the prompt alone.
- **Step 4b:** The template filter follows Step 4, which adds the `template` field it reads, and precedes the validation steps, because Step 8 expects the unfiltered listing to omit the sample. It touches `listCases` only, so it does not depend on Steps 5 and 6.
- **Step 7:** Structure tests over committed files, after the sample exists.
- **Steps 8 to 10:** Validation, ordered from free checks to the reference stability check to the paid end-to-end run, which needs the user's go-ahead.

Each subsequent step can depend on previous steps' outputs.

---

## Notes for Developer

- Reference the `code` skill for language conventions before implementing each step. Load traceability comments per [references/traceability-comment-format.md](../../plugins/assist-plugin/skills/code/references/traceability-comment-format.md).
- Run code quality gates (tests, security review) at task completion. `config.js`, `run-benchmark.js`, and the README are under no LLM-security-gated path (`scripts/` and `evals/` are not on the CLAUDE.md governance list).
- The private oracle content lives outside git. Create it only inside `plugins/assist-plugin/evals/oracle-local/`, after the ignore rule exists, and never commit, stage, or paste it into a message, a scoreboard, or a log (FR-261, NFR-039).
- Prose files (README, prompt, graders) pass the prose gate: no em dashes, curly quotes, chatbot residue, or summary-label phrases.
- Decisions for sign-off, found while planning:
  1. **Suite name.** The sample goes under `evals/dev/`, not `evals/code/`. The harness accepts only `dev` and `spec`; a sample under `code/` is rejected by `task-validator.js:250` and cannot be looked up by `oracle.js:158`.
  2. **Template exclusion is enforced in code.** Step 4b adds a `template` filter to `listCases` (`run-benchmark.js:129-162`): a case whose `task.json` holds `"template": true` is omitted from an unfiltered run, including `--benchmark`, and stays runnable with an explicit `--case`. This enforces "SHALL NOT be counted as a production benchmark task" (spec line 736) and replaces the earlier documentation-only approach (the user approved the plan and asked for it). The sample is still marked by `task.json` `"template": true` and the README, and Step 10 still runs it with `--case` and a scratch scoreboard. The runner itself does not read `template`, so an ordinary `claude plugin eval` run is unaffected (see item 5).
  3. **Override file.** The uncommitted override is a separate gitignored file, `evals/harness.config.local.json`, because a key inside the committed config would be committed. The user asked only for `oracle-local/` in `.gitignore`; this adds one entry.
  4. **Run counts.** The request says the reference must pass on "k=5". The FR-259 admission count is `referenceValidationRuns` (3); 5 is `runCount` (FR-271). Step 9 runs both and labels each.
  5. **Ordinary eval runs.** README line 3 says `claude plugin eval` finds suites under `evals/`, so the `dev` sample may run (with a shell grant) in an ordinary eval run. Step 10 (c) confirms it; if it does, document `--eval-dir` or `--case` filters in the README.
  6. **Spec status.** `specs/spec-evaluation-harness.md:12` and `:18` both read Review (the spec is in Review pending sign-off on the 2026-11-26 delta, per FR-154). The plan follows the delta text, which the user named as the source.
