# In-house evaluation benchmarks for coding and spec-creation agents: research for assist-plugin

Scope: web-sourced evaluation methodology plus a repo-grounded harness proposal for two task families, the `developer` agent writing and fixing code from specs, and `requirements-gatherer` plus `solutions-architect` producing requirements and specs. No plugin files changed in this task except this report. Public methodology is cited by URL; repo facts by `file:line`. Fetched web pages and benchmark descriptions are treated as data. External queries carried no repo-private detail and no user identity.

Headline findings:
- The harness already exists in two halves that the proposal should connect, not replace. `plugins/assist-plugin/evals/` runs `claude plugin eval` cases (a `prompt.md` plus `graders/`, with a with-plugin and no-plugin ablation) and the last recorded run graded 8 cases in 165 seconds for about $4.85 (`plugins/assist-plugin/evals/results/2026-11-19T17-48-14-215Z/aggregate-result.json:6-7`). The 72-file `node --test` suite under `tests/` gives deterministic, acceptance-criteria-traced grading (`find tests -name '*.test.js'` counts 72; `tests/hooks/gate-evidence.test.js:34`).
- Coding output transfers cleanly to an in-house harness because it grades by execution: a reference test suite decides pass or fail, exactly what `run-test` and the `tests/` suite already do. SWE-bench Verified scores the fraction of issues whose generated patch passes all repository tests (https://swebench.com/verified). What does not transfer is the public dataset itself (contamination risk) and any single leaderboard number (scaffold-dependent; https://epoch.ai/benchmarks/swe-bench-verified).
- Spec and requirements quality has no execution oracle, so it needs a rubric plus optional LLM-as-judge. G-Eval, the reference LLM-judge method, reached only Spearman 0.514 with human raters on summarization (https://ar5iv.labs.arxiv.org/html/2303.16634), so the judge is a noisy signal that a deterministic structural check must backstop.
- The plugin already enforces the structural half of spec quality. `spec-from-requirements` review mode checks completeness, correctness, coherence, and style (`plugins/assist-plugin/skills/spec-from-requirements/SKILL.md:140-149`); `gather-requirements` holds requirements to Necessary, Unambiguous, Testable, Feasible, Complete, Consistent, Singular, Implementation-free, Traceable (`plugins/assist-plugin/skills/gather-requirements/SKILL.md:99-101`); `task-plan` Intake fails any `### Requirement:` with no `#### Scenario:` (`plugins/assist-plugin/skills/task-plan/SKILL.md:34`). These are deterministic gates an in-house harness can run as graders with no model call.
- Release-over-release regression tracking has a seam to hang on: the FR-250 `release-check.js` already runs an ordered set of gate sections at release, and `CLAUDE.md:146` lists the six version places a release touches. A benchmark run added as one more section, keyed to the version, measures drift per release.

---

## 1. How coding output is evaluated in practice

Execution-based grading is the method behind every current code benchmark: generate code, run a reference test suite, count the fraction that passes. The four benchmarks named differ in task shape, not in the grading principle.

- **HumanEval and MBPP** are function-synthesis sets. HumanEval has 164 hand-written problems, each a signature plus docstring plus hidden unit tests; the model's completion passes or fails on those tests (https://arxiv.org/pdf/2107.03374). MBPP is a larger set of short Python tasks (source counts vary from 974 in the original release to 1,401 for the full set; https://arxiv.org/pdf/2404.00599). EvalPlus (HumanEval+, MBPP+) adds roughly 80x and 35x more tests to catch code that passes the thin original suite (https://arxiv.org/pdf/2404.00599).
- **SWE-bench Verified** is a 500-instance human-filtered subset of SWE-bench. The model produces a patch for a real GitHub issue, the patch is applied, and the repository's own tests decide success; the primary metric is the fraction of issues whose patch passes all tests (https://swebench.com/verified). Epoch AI runs it in a network-blocked Docker container and prompts the model not to modify the tests, and estimates a 5 to 10 percent error rate on ambiguous samples (https://epoch.ai/benchmarks/swe-bench-verified).
- **LiveCodeBench** is competition problems tagged with a release date, so a model is scored only on problems released after its training cutoff, a time-based defense against contamination rather than a data filter (https://arxiv.org/html/2403.07974v2).

**pass@k** is the standard metric for stochastic generation. The unbiased estimator from the Codex paper draws n samples per problem, counts the c that pass, and computes the expected value of 1 minus C(n-c, k) / C(n, k); the naive 1 minus (1 minus p-hat)^k is biased (https://arxiv.org/pdf/2107.03374). pass@1 is not computed one way across labs: OpenAI's GPT-5 card averages 4 tries per instance, the o1 card averages per-instance pass rates over valid patches, so numbers only compare when the scaffold and averaging match (https://arxiv.org/pdf/2601.03267, https://arxiv.org/pdf/2412.16720).

What transfers to an in-house harness:
- The grading principle, directly. `developer` SelfCheck already runs the project's own test and lint commands as `run-test` lists them (`plugins/assist-plugin/agents/developer.md:55,66-71`), and the `gate-evidence` hook records each run's command id, exit code, and coverage value in the governance audit log (`plugins/assist-plugin/skills/run-test/SKILL.md:136-138`). A golden coding task is a SWE-bench instance in miniature: a repo state, a spec, and a hidden reference test suite whose pass or fail is the score.
- pass@k as the metric when the harness samples the agent more than once. The agent is non-deterministic, so a single run is a point estimate; report pass@1 over k runs with the unbiased estimator, which the existing `evals` runner already approximates by running each case `runs: 2` in two arms (`plugins/assist-plugin/evals/README.md:28`).

What does not transfer:
- The public datasets. HumanEval, MBPP, and SWE-bench instances are in model training data, so a high score may measure memorization, not capability (https://arxiv.org/html/2403.07974v2). An in-house harness must use tasks written in-house or drawn from private repos.
- Any single leaderboard number. SWE-bench results move with the scaffold; the bash-only leaderboard warns that 1.x and 2.x results are not comparable, and Epoch upgraded its scaffold in February 2026 (https://epoch.ai/benchmarks/swe-bench-verified). An in-house score is only comparable to other in-house runs on the same harness version.

---

## 2. How specification and requirements quality is evaluated

Spec quality has no execution oracle, so evaluation splits into a deterministic structural layer and a judgment layer, each with limits.

**Rubric and structural checks (deterministic).** The requirements-engineering literature converges on a small set of attributes: ambiguity, completeness, consistency, correctness, and testability or verifiability recur across standards and a review of 67 papers (https://link.springer.com/10.1007/s00766-021-00367-z). IEEE 29148:2018 defines a high-quality requirement as clear, correct, and verifiable, and INCOSE adds necessary, implementation-independent, unambiguous, and complete (https://link.springer.com/10.1007/s00766-021-00367-z). Per-requirement linguistic defects (an ambiguous word, a missing measurable threshold, two RFC 2119 keywords in one statement) are cheap to check with pattern rules; set-level completeness and consistency are the hard part and usually still need a human reviewer (https://link.springer.com/10.1007/s00766-021-00367-z). Limit: a metric suite risks being "arbitrary and rigid in the parameterization and combination of metrics" (https://link.springer.com/10.1007/s00766-021-00367-z), so a structural score must be read as a floor (did the artifact meet the form) not a ceiling (is it good).

**Reference-spec comparison.** Scoring an output spec against a known-good reference spec gives an objective target, but surface-overlap metrics (BLEU, ROUGE) correlate poorly with human judgment on open-ended text (https://ar5iv.labs.arxiv.org/html/2303.16634). For specs the usable form of reference comparison is checklist coverage: does the output cover each requirement ID, each scenario, and each error path that the reference covers. That reduces to a set-membership check the harness can run deterministically, and it reuses the plugin's traceability IDs.

**LLM-as-judge with a rubric.** G-Eval scores text by giving the judge a task definition, a rubric, and an auto-generated chain of thought, then reading a weighted score; it reached Spearman 0.514 with humans on summarization, better than BLEU/ROUGE but far from agreement (https://ar5iv.labs.arxiv.org/html/2303.16634). Limits, each documented:
- **Self-preference:** a judge rates its own family's text higher, which confounds model quality with self-favoritism (https://arxiv.org/pdf/2410.21819). Mitigation: judge with a different model family than the one under test.
- **Position and style bias:** a judge's verdict can flip when candidates are reordered, though a 2026 study found position bias small and style bias dominant (0.76 to 0.92 across models), meaning longer or more fluent specs can score higher regardless of substance (https://arxiv.org/html/2410.02736v2).
- **Non-determinism:** the judge is itself stochastic; one cited study used temperature 0.1 to cut variance (https://arxiv.org/html/2410.02736v2). A judge score is reproducible only as an average over several runs, and agreement with humans should be reported as Spearman rho, Kendall tau, or Cohen kappa (https://arxiv.org/pdf/2412.05579).

The plugin already owns the deterministic layer. `spec-from-requirements` review mode checks completeness (every Requirement has a Scenario), correctness (requirement refs resolve, no orphan traceability rows, RFC 2119 keywords present and singular), and coherence (`plugins/assist-plugin/skills/spec-from-requirements/SKILL.md:140-149`). `gather-requirements` enforces the nine quality criteria and a banned-words list (`plugins/assist-plugin/skills/gather-requirements/SKILL.md:99-101`). `task-plan` Intake is a hard gate that every `### Requirement:` carries a `#### Scenario:` (`plugins/assist-plugin/skills/task-plan/SKILL.md:34`). An in-house spec benchmark should run these as graders first and reserve the LLM judge for the subjective residue (is the design sound, is the error handling adequate).

---

## 3. Repo-grounded proposal

Build one benchmark harness with two task families, both expressed as `claude plugin eval` cases under `plugins/assist-plugin/evals/`, because that layout, runner, ablation, and results format already exist (`plugins/assist-plugin/evals/README.md:1-4,16-28`). Add deterministic graders that shell out to the `tests/` suite and the existing skill gates, and reserve LLM-judge graders for spec subjectivity.

### Golden-task construction

Coding family (`evals/dev/`), each case a directory:
- `prompt.md`: the task (a spec excerpt plus the file to change), with `allowed_tools` widened to the `developer` set and a `max_turns` budget. Today's cases allow only Read/Glob/Grep/Skill (`plugins/assist-plugin/evals/code/02-traceability-chain/prompt.md:4`); a coding case needs Write, Edit, and Bash, which the runner only grants under a sandbox backend, the same gap the README records for `debug` shell grants (`plugins/assist-plugin/evals/README.md:40`).
- A reference solution plus a hidden reference test suite written as a `node --test` (or language-native) file using the repo's acceptance-criteria test names, for example `[AC-2 | spec-foo | FR-045]` (`tests/hooks/gate-evidence.test.js:161`). The suite is the oracle; the reference solution is for diffing and triage, never shown to the agent.
- Acceptance criteria drawn from the spec's `#### Scenario:` blocks, so the same GIVEN/WHEN/THEN that `create-test` enumerates (`plugins/assist-plugin/skills/create-test/SKILL.md:45-57`) defines both the agent's target and the grader.

Spec family (`evals/spec/`), each case a directory:
- `prompt.md`: a requirements elicitation prompt (for `requirements-gatherer`) or a requirements document plus "write the spec" (for `solutions-architect`).
- A reference requirements set or reference spec, plus a rubric: the deterministic checklist (requirement IDs covered, scenarios per requirement, error paths, RFC 2119 singular keyword, traceability rows resolve) and the subjective rubric items for the judge (design soundness, completeness of error handling, testability of each scenario).

### Metrics

- Coding: pass@1 estimated over k runs with the unbiased estimator (https://arxiv.org/pdf/2107.03374); per-case pass or fail from the reference suite exit code; coverage of new code against the existing 70 percent bar (`plugins/assist-plugin/skills/run-test/SKILL.md:129`, `plugins/assist-plugin/agents/qa.md:48`); and traceability-marker correctness (every emitted `[FR|SPEC|AC]` marker resolves, none invented, per `plugins/assist-plugin/docs/TRACING_MARKERS.md:82-102`).
- Spec: a structural score (fraction of deterministic checks passed) and a rubric score (mean judge score over several runs, reported with a human-agreement figure when a labeled sample exists). Keep the two scores separate; do not average a deterministic floor with a noisy judge.

### Scoring design

- Coding is graded by execution, no judge. A grader script runs the hidden suite with the Node test runner's programmatic `run()` (fields `files`, `testNamePatterns`, `coverage`, `lineCoverage`, and a TAP or custom reporter; `run()` sets `process.exitCode` to 1 on any failure and `lineCoverage`/`branchCoverage` exit 1 below threshold, per https://nodejs.org/docs/latest-v24.x/api/test.html), or the language-native command from `run-test` for non-Node targets. The exit code is the case score. `randomSeed` makes a randomized run replayable, which matters for flakiness triage (same URL).
- Spec is graded in two passes. Pass one runs the deterministic checklist (reuse the `spec-from-requirements` review checks and the `gather-requirements` quality criteria as regex or small-script graders of the type the eval runner already supports; `plugins/assist-plugin/evals/README.md:30-34`). Pass two is an optional LLM-judge grader for the subjective rubric, run only on cases that cleared pass one, with a model family different from the agent under test (self-preference mitigation, https://arxiv.org/pdf/2410.21819).

### Harness layout

```
plugins/assist-plugin/evals/
  dev/                 # coding golden tasks (new)
    01-fix-from-spec/
      prompt.md
      reference/       # reference solution + hidden test suite (not shown to agent)
      graders/         # run-suite (exit code), coverage, traceability-resolves
  spec/                # spec/requirements golden tasks (new)
    01-spec-from-reqs/
      prompt.md
      reference/       # reference spec + rubric
      graders/         # structural checklist (deterministic) + judge (optional)
  results/             # git-ignored, already present (evals/.gitignore: results/)
```

This reuses the existing directory contract (a case is a `prompt.md` plus a `graders/` folder; `plugins/assist-plugin/evals/README.md:3`) and the git-ignored `results/` sink (`plugins/assist-plugin/evals/.gitignore`). It invents no parallel runner.

### Measuring regression release-over-release

Tie the benchmark to the release flow, not to ad-hoc runs. `release-check.js` already runs an ordered list of independent gate sections and reports each on its own line (FR-250, `plugins/assist-plugin/scripts/release-check.js:4-26`). Add a `benchmark` section (or a separate `--benchmark` invocation) that runs the `evals/dev` and `evals/spec` suites, writes the aggregate scores to `evals/results/`, and compares them to the previous release's stored scores. Key every stored result to the plugin version the run JSON already records (`version` in `aggregate-result.json:16`), and to the six version places a release updates (`CLAUDE.md:146`). A drop beyond a set margin is a regression the release surfaces, the same way the existing sections surface a version mismatch or a staged secret. Store a small per-release scoreboard (version, suite, pass@1, structural score, judge score) under version control so the trend survives the git-ignored `results/`.

---

## 4. Pitfalls and mitigations

- **Benchmark contamination.** Public tasks leak into training data, so the score measures recall (https://arxiv.org/html/2403.07974v2). Mitigation: author golden tasks in-house or draw from private repos, keep the hidden reference suites out of any published docs, and borrow LiveCodeBench's date tagging, stamp each case with a creation date and note the model cutoff it is valid against (https://arxiv.org/html/2403.07974v2).
- **Overfitting to the benchmark.** A fixed task set that drives prompt and skill edits rewards gaming the cases, not real capability; one study shows generic prompt improvements that help a benchmark can hurt the application (https://arxiv.org/pdf/2601.22025). Mitigation: keep a held-out slice of cases that never informs a prompt or skill edit and runs only at release, and rotate in new cases each release so the measured set is not static.
- **LLM-judge bias.** Self-preference, position bias, and style or verbosity bias move judge scores (https://arxiv.org/pdf/2410.21819, https://arxiv.org/html/2410.02736v2). Mitigation: use a judge from a different model family, randomize candidate order and average both orderings, anchor the judge to the explicit rubric rather than an open "is this good", and periodically check judge-human agreement on a labeled sample (Spearman rho or Cohen kappa; https://arxiv.org/pdf/2412.05579). Treat the judge as advisory, the deterministic checklist as the gate, mirroring how the plugin's own code-scan and goal-guard hooks are advisory until promoted.
- **Non-determinism and flakiness.** Both the agent and the judge are stochastic, and the repo already logged one eval flake where `code/02-traceability-chain` passed 1 of 2 runs (`plugins/assist-plugin/evals/README.md:41`). Mitigation: run each case k times and report pass@1 with the unbiased estimator (https://arxiv.org/pdf/2107.03374) rather than a single pass; set a sampling threshold below 1.0 for smoke runs (the README already suggests `--threshold 0.5`, `plugins/assist-plugin/evals/README.md:42`); set the judge temperature low and average several runs (https://arxiv.org/html/2410.02736v2); and use the test runner's `randomSeed` to replay a failing randomized order (https://nodejs.org/docs/latest-v24.x/api/test.html). Never silence a flaky reference test, which `run-test` already forbids (`plugins/assist-plugin/skills/run-test/SKILL.md:162`).

---

## 5. Cost and effort estimate, and a phased rollout

All figures below are estimates, derived from the one recorded eval run (8 cases, two arms, 165 seconds, about $4.85; `plugins/assist-plugin/evals/results/2026-11-19T17-48-14-215Z/aggregate-result.json:6-7`) and from the per-case shape of the existing suites. They are not measured for the new case types.

Per-run cost estimate: the recorded run averaged about $0.30 per case across two arms. Coding cases run the agent with Write and Bash over more turns, so estimate $0.50 to $1.50 per coding case per run, and $0.40 to $1.00 per spec case when an LLM judge runs. A k=5 run of 10 coding and 10 spec cases is therefore an estimated $25 to $75 per full benchmark run, dominated by agent turns, not grading.

Authoring effort estimate: a coding golden task (prompt, reference solution, hidden suite, graders) is an estimated 2 to 4 hours each; a spec golden task (prompt, reference spec, rubric, deterministic graders) is an estimated 2 to 3 hours each. The judge grader and the release-check wiring are one-time builds, an estimated 2 to 4 days total.

Phased rollout, smallest useful slice first:
1. **One coding case, deterministic only.** Add `evals/dev/01-fix-from-spec/` with a prompt, a hidden `node --test` suite, and a run-suite grader whose score is the suite exit code. This proves the sandbox grant path (the README's documented blocker, `plugins/assist-plugin/evals/README.md:40`) and the execution-grading loop with zero judge cost. Smallest useful first slice.
2. **One spec case, deterministic only.** Add `evals/spec/01-spec-from-reqs/` graded solely by the structural checklist reused from `spec-from-requirements` review and `gather-requirements` quality criteria. No judge yet, so the score is reproducible.
3. **Scale to about 10 cases per family and add pass@k.** Run each case k times, report pass@1 with the unbiased estimator, and tag each case with a creation date and valid-against cutoff.
4. **Add the LLM judge for spec subjectivity.** A different-family judge on the rubric residue, run only on cases that clear the deterministic checklist, with a labeled-sample agreement check.
5. **Wire into release.** Add the `benchmark` section to `release-check.js` keyed to the plugin version (`plugins/assist-plugin/scripts/release-check.js:4-26`, `aggregate-result.json:16`), store a version-keyed scoreboard under version control, and hold out a slice of cases that runs only at release to resist overfitting.

```fsa
fsa: researcher/1
state: Done
trace: Intake > Research > Draft > Report
artifact: /home/tj/Projects/Personal/assist-marketplace-plugin/docs/research/research-eval-benchmarks-coding-spec-20261124.md
verdict: none
skipped: none
out_of_scope: none
error_class: none
questions: none
resume_at: none
```
