# assist-plugin evals

Suites for `claude plugin eval`. Each case is a directory with a `prompt.md` and a `graders/` folder. The runner finds them under `evals/` (its default eval dir, so `plugin.json` needs no field).

| Suite | Case | What it checks |
|---|---|---|
| `do/` | `01-trigger-route` | A plain "route this task to the best subagent" request fires the `do` skill; the answer names `reviewer` and shows a step table |
| `do/` | `02-build-doc-chain` | `/do` on a build request lists requirements, spec, and task plan steps before the build step, and asks for approval |
| `do/` | `03-read-only-direct` | A read-only question routes to `ask` or `explore` as a `read` step |
| `code/` | `01-trigger-standards` | The `code` skill fires when asked for the coding standards; the answer lists the five log levels and the masking rule |
| `code/` | `02-traceability-chain` | The full-chain comment `[SPEC-003 -> FR-045 -> UC-012 -> AC-2]` |
| `code/` | `03-no-invented-ids` | With no requirement IDs supplied, generated code carries no invented ID |
| `debug/` | `01-trigger-rca` | A "structured root cause analysis" request fires the `debug` skill and states a root cause |
| `debug/` | `02-analyze-empty-cart` | An analysis names the missing `reduce` initial value |

## Run

From the repository root:

```
claude plugin eval plugins/assist-plugin --trust-plugin --no-publish
claude plugin eval plugins/assist-plugin --trust-plugin --case '*trigger*'
claude plugin eval plugins/assist-plugin --trust-plugin --runs 1 -j 4
```

Per suite, filter by case name (`--case '01-*'`) or point `--eval-dir` at a subfolder name below the plugin (for example `--eval-dir evals/debug`).

Each case runs `runs: 2` times in two arms, with the plugin and a no-plugin baseline, so the report shows the score delta. Results land in `evals/results/` (git-ignored). A full run (8 cases, 2 runs, both arms) took about 3 minutes and cost about $4.90 in the recorded run (`costUsd` in the run JSON).

## Grading

- `skill-fired` (`tool_used: Skill`, with-only) is a plugin-fired indicator. The runner reports it and leaves it out of the score. Every case that has one also has regex graders that check the answer.
- All outcome graders are regexes over the last message. No case uses the LLM judge, so scoring is deterministic given the model output.
- Cases allow only `Read`, `Glob`, `Grep`, and `Skill`. Nothing dispatches an agent or writes a file.

## Benchmark harness

The benchmark scores the plugin on two task suites: `dev/` (coding tasks scored by test exit code) and `spec/` (spec-writing tasks scored by a source-checked checklist). It is separate from the `claude plugin eval` suites above and lives under `scripts/eval-harness/`.

- **Public and private split.** This repo holds only the public parts of a task: `prompt.md`, `graders/`, `task.json`, and `rubric.json` under `evals/dev/<case>/` and `evals/spec/<case>/`. The oracle (reference solutions and hidden suites) lives in a separate private location and never in a committed file. The harness finds that location from, in order: the environment variable `ASSIST_EVAL_ORACLE_DIR`, then the `oracleLocation` key of the uncommitted override file `evals/harness.config.local.json`, then the committed `oracleLocation` in `evals/harness.config.json`. The committed value is `null`, a placeholder that holds no machine path and no private URL; a real path is never committed. A relative path in the override file resolves against the override file's directory. When none of the three resolves, a `--benchmark` request stops with an error that says the oracle location is unset and scores nothing. A local directory uses the layout `<location>/<suite>/<case>/reference/` and `hidden/`; `evals/oracle-local/` is a git-ignored place for one. The harness withholds the oracle from the agent workspace and aborts the run, naming the path, if it finds oracle content there. An unreachable private location is an error, not a score.
- **On request only.** The benchmark runs when asked. A default `node plugins/assist-plugin/scripts/release-check.js` run reports the last stored scoreboard, or states that none is stored, and never runs the suite.
- **The `--benchmark` request.** `node plugins/assist-plugin/scripts/release-check.js --benchmark` starts the Group A harness (`scripts/eval-harness/run-benchmark.js`) and no second runner.
- **Held-out cases.** A task marked `held_out` in its `task.json` is left out of an ordinary case list and included on a `--benchmark` request.
- **Scoreboard.** Results are stored by plugin version in `plugins/assist-plugin/evals/scoreboard.json`, created by the first stored run. A row holds the version, the suite, and scores only. Full per-run output goes to `evals/results/` (git-ignored). `release-check.js` compares the new scores with the stored ones and reports a regression when a score drops by more than the configured margin.
- **Cost.** A full run is estimated at $25 to $75 (an estimate, not a measured figure). Every stored result records its own cost and elapsed time.

## Limits and skills that need care

- **Benchmark oracle.** The run settings in `evals/harness.config.json` ship as provisional values with no empirical basis: run count 5, regression margin 0.05, reference validation runs 3, judge runs 3, new tasks per release 1. Replace them once measured data exists. The private oracle location is yours to set through `ASSIST_EVAL_ORACLE_DIR` or `evals/harness.config.local.json`; a `--benchmark` request cannot run until it resolves. A task marked `"template": true` in its `task.json` is a worked sample, left out of the case list unless `--case` names it. Production golden tasks are still yours to author. A judge-agreement floor ships as a provisional value with no empirical basis; replace it once labeled samples exist.
- **`code` trigger.** The skill is `user-invocable: false` and is meant to be preloaded by the `developer` agent. The Skill tool can still load it when a prompt asks for it by name, so `code/01-trigger-standards` names the skill in the prompt. A prompt that only asks for code ("write a function that parses a file") does not fire it in an eval; the `developer` agent preload path has no eval because cases cannot dispatch agents.
- **`do` trigger.** A prompt that starts with `/do` or `/debug` is expanded as a slash command and never calls the Skill tool, so `skill-fired` would read false for those cases (`do/02-build-doc-chain`, `do/03-read-only-direct`, `debug/02-analyze-empty-cart`). They carry no `skill-fired` grader. `01-trigger-route` uses plain phrasing so the Skill tool call is observable.
- **`debug` task cases for `fix` and the RCA template are not shipped.** `debug/SKILL.md` runs `!git branch --show-current`, `!git log`, and `!git status` when it loads. The eval runner refuses a shell grant when it cannot confine the shell, and this machine lacks the sandbox backend (`socat`, `bubblewrap`). With no shell, the skill load fails with "Shell command permission check failed ... Permission to use Bash has been denied", the skill body never reaches the model, and the model answers on its own. The skill still fires (the trigger case reads true), but any grader that tests skill content (the `fix` gate message "Fix requires an approved RCA", the RCA headings "Suggested Fix" and "Risk Level") fails in both arms. The two debug cases that ship grade what the model does without the skill body. Once `socat` and `bubblewrap` are installed, add `Bash(git branch:*)`, `Bash(git log:*)`, and `Bash(git status:*)` to `allowed_tools`, pass the same patterns to `--allow-tools`, and add cases for the fix gate and the RCA template.
- **Known flake.** `code/02-traceability-chain` passed 1 of 2 with-plugin runs once, when its graders pinned one literal chain (`SPEC-003 -> FR-045 -> UC-012 -> AC-2`) and `// [SPEC-003`. Both graders now match the chain shape: `full-chain` needs `SPEC`, `FR`, `UC`, `AC` ids joined by `->` (or the arrow character), and `line-comment` needs a bracketed id after a `//`, `/*`, or `#` comment marker. Both passed 8 of 8 single-arm runs. The cause of the original miss was not captured, so a rare miss is still possible.
- **Model variance.** `runs: 2` and `--threshold` 1.0 (the runner default) mean one failed run in a case drops its score below the threshold and exits 1. Pass `--threshold 0.5` for a smoke run.
