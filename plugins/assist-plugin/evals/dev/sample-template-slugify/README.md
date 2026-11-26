# sample-template-slugify (template)

This directory is a **template**: a worked example to copy when you author production golden tasks. It is not a production benchmark task and is excluded from production benchmark scoring. `task.json` holds `"template": true`, so an unfiltered benchmark run leaves it out; it runs only when you name it with `--case sample-template-slugify`.

## Parts of a golden task

Public parts, committed in this directory:

- `prompt.md`: the task the agent receives, with run settings in the front matter.
- `task.json`: provenance, creation date, valid-against cutoff, and the optional `held_out` flag. Only this sample carries `"template": true`.
- `rubric.json`: separate `deterministic` and `subjective` groups.
- `graders/`: one grader file per check, in the `claude plugin eval` format.
- `README.md`: this file. A task you author does not need one.

Private parts (the correct solution and the hidden test suite) live outside git and outside this directory. See `evals/README.md` for where they go and how the harness finds them. The agent workspace gets every public file here except `graders/`, `task.json`, and `rubric.json`, so keep the prompt and any README free of solution code, test text, and private paths.

## Authoring checklist

1. Write the task yourself. Use no public benchmark dataset or problem set (FR-258). Set `provenance` to `in-house` or `private-repository`.
2. Keep each suite (`dev`, `spec`) to 1 to 3 in-house tasks, and keep at least one per suite held out (`"held_out": true`).
3. Set `creation_date` and `valid_against_cutoff` to real dates in `YYYY-MM-DD` form. `valid_against_cutoff` is the training cutoff of the model under test.
4. Put enough detail in the prompt that a test author can write the hidden suite from the prompt alone.
5. Start every hidden test name with a scenario identifier in the form `[AC-n | spec | FR-n]`.
6. Keep hidden tests deterministic: no clock, randomness, network, or retry (FR-287).
7. Confirm the reference solution passes the hidden suite on the configured number of consecutive runs before the harness admits the task (FR-259).
8. Add at least one new task per release (FR-281).
9. Never commit the reference or the hidden suite. A published package must hold no `reference` or `hidden` directory (FR-261).
