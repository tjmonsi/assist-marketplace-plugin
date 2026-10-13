# FSA Template

Shared template for finite-state automata (FSAs) in assist-plugin agents and skills, and for the terminal block every dispatched agent ends with. `/do` is the Communicator FSA and uses this template in [../SKILL.md](../SKILL.md). Each agent or skill that adopts an FSA writes a `## States` table in its own file and links here.

Claude Code does not force a model to follow its states in order. The tables state the intended sequence. `/do` and the hooks check what is visible from outside: the terminal block, the plan file, and the files written.

## Rules

| # | Rule | Form |
|---|---|---|
| T1 | Transitions read structured fields only | Every `model` state ends with one line `Outcome: <value>`. The next state comes from the state's outcome table, never from prose. |
| T2 | Guards are exclusive and exhaustive | Each state's outcome list names every outcome once, with exactly one next state each. |
| T3 | Checks run before model work | The first state is `Intake`, of kind `check`: read, compare, count, with no judgment. |
| T4 | Every loop is bounded | Each back-edge names its counter, its maximum, and its exhausted target. |
| T5 | An ambiguous input stops the agent | The agent ends in `NeedsInput` with numbered questions and `resume_at`. `/do` asks the user and resumes the same agent with `SendMessage`. |
| T6 | Agents never pick the next agent | An agent ends and returns. `/do` decides the next step. |
| T7 | Error is a fixed record | The `Error` block carries a class from the closed list below and no recap. |
| T8 | A skip is marked, never a pass | Markers such as `not-run (skipped)` and `review: skipped` go in `skipped:`. |
| T9 | Done names its artifact | `artifact:` holds a path, or `inline` when the reply is the artifact. |

## State kinds

| Kind | Meaning |
|---|---|
| `check` | Deterministic work: read files, test conditions, count, compare. |
| `model` | Judgment or drafting. Ends with an `Outcome:` line. |
| `call` | Dispatch an agent. Only `/do` has this kind. |
| `ask` | Ask the user. Only `/do` has this kind, because `AskUserQuestion` is removed from every subagent. |
| terminal | `Done`, `NeedsInput`, or `Error` for agents. `/do` has its own five (Complete, Partial, Paused, Cancelled, Error). |

## States table format

The FSA lives in the skill when a skill carries the method (for example create-test, gather-requirements, task-plan, run-test). It lives in the agent file when no skill exists. It is a `## States` section with this table:

| State | Kind | Does | Outcome -> next state |
|---|---|---|---|

Rules for filling it in:

- List `Intake` first (T3). List the terminal states last.
- Write each outcome as `outcome` -> next state. Join the outcomes of one state with semicolons.
- Write a bounded loop as `outcome` with `<counter> < <max>` -> back-edge state; `outcome` with `<counter> = <max>` -> the exhausted target, usually `Error(budget-exhausted)`.
- Write an error exit as `Error(<class>)`.
- Write a user question exit as `NeedsInput`, and name the state to resume at in `resume_at`.

## Terminal block

The final message of every dispatched agent ends with one fenced block in this form. The fence keeps it out of the prose hooks, and a hook can parse it.

```fsa
fsa: <agent>/<version>
state: Done | NeedsInput | Error
trace: Intake > ... > <terminal>
artifact: <path, comma-separated> | inline | none
verdict: <closed enum for this agent> | none
skipped: <marker list> | none
out_of_scope: <comma-separated items> | none
error_class: missing-input | precondition-failed | policy-rejection | budget-exhausted | tool-missing | tool-failed | out-of-scope | none
questions: <numbered list> | none
resume_at: <state> | none
```

| Field | Content |
|---|---|
| `fsa` | Agent name and the version of its `## States` table. |
| `state` | The terminal state the agent reached. |
| `trace` | The states visited, in order, joined with `>`. |
| `artifact` | Paths written, or `inline` when the reply is the artifact, or `none`. |
| `verdict` | A value from the closed enum the agent's file defines (for example `approved` or `returned` for a reviewer), or `none`. |
| `skipped` | Markers for work not done, such as `compile not-run (skipped)`, or `none`. |
| `out_of_scope` | Work the agent found but may not do, as comma-separated items, or `none`. `/do` records each item as a new request. |
| `error_class` | One value from the closed list in the block. `none` unless `state` is `Error`. |
| `questions` | Numbered questions for the user when `state` is `NeedsInput`, else `none`. |
| `resume_at` | The state to resume at once the user answers, else `none`. |

Work the agent found but may not do goes in `out_of_scope`, one item per entry (a test path the agent may not write is one such item). `/do` records each item as a new request at Display; a test path becomes a developer-tester request. `questions` is for `NeedsInput` only. The error class `out-of-scope` is for a run that cannot continue because the only work left is work the agent may not do.

### Valid block

A block is valid when it is closed (the fence ends), carries all ten fields, and its `state` is `Done`, `NeedsInput`, or `Error`. For an agent with a `## States` table, `/do` also expects a `trace` that follows the table. For an agent without a table, `/do` accepts any `trace` and does not check it.

When a dispatched agent's final message has no valid block, `/do` reads it as `Error` with class `no-terminal-block`. `/do` sends one `SendMessage` retry asking for the block, then fails the step.

### Dispatch prompt text

Agents run in their own context and cannot open this file: a path relative to `/do` does not resolve for them. Every dispatch prompt, resume message, and retry prompt `/do` writes therefore carries this text, with the block copied in full:

````text
End your final message with this block, filled in. Use state Done, NeedsInput, or Error. error_class is one of missing-input, precondition-failed, policy-rejection, budget-exhausted, tool-missing, tool-failed, out-of-scope, or none, and none unless state is Error. Put the questions for the user in questions and the state to resume at in resume_at; both are none otherwise. Put work you found but may not do in out_of_scope, and none otherwise.

```fsa
fsa: <agent>/<version>
state: Done | NeedsInput | Error
trace: Intake > ... > <terminal>
artifact: <path, comma-separated> | inline | none
verdict: <closed enum for this agent> | none
skipped: <marker list> | none
out_of_scope: <comma-separated items> | none
error_class: missing-input | precondition-failed | policy-rejection | budget-exhausted | tool-missing | tool-failed | out-of-scope | none
questions: <numbered list> | none
resume_at: <state> | none
```
````

## Worked example: developer-tester with create-test

The agent has no Bash, so the compile step becomes a static check and the compile itself is marked skipped.

| State | Kind | Does | Outcome -> next state |
|---|---|---|---|
| Intake | check | Spec path present and readable; every `### Requirement:` has a `#### Scenario:`; record the list of source IDs | `ok` -> AssembleContext; `no-spec` -> NeedsInput; `scenario-missing` -> Error(precondition-failed) |
| AssembleContext | check | Read Scenarios, requirement docs, and public signatures only; pick the framework reference | `ready` -> PlanCoverage; `interface-undocumented` or `framework-unknown` -> NeedsInput |
| PlanCoverage | model | Map each source ID to planned tests, or list it as uncovered | `mapped` -> CheckCoverage |
| CheckCoverage | check | Every Intake ID appears in the map | `complete` -> WriteTests; `gaps` with rounds < 2 -> PlanCoverage; `gaps` with rounds = 2 -> Error(budget-exhausted) |
| WriteTests | model | Write test files under test locations only | `written` -> SelfCheck; `needs-non-test-path` -> Error(policy-rejection) |
| SelfCheck | check | Re-read each file: every test has a traceability comment, and every cited ID exists (Grep); compile and run are `not-run (skipped)` | `clean` -> Done; `issues` with fixes < 2 -> WriteTests; `issues` with fixes = 2 -> Error(budget-exhausted) |

A run that reaches `Done` ends with:

```fsa
fsa: developer-tester/1
state: Done
trace: Intake > AssembleContext > PlanCoverage > CheckCoverage > WriteTests > SelfCheck > Done
artifact: tests/auth/login.test.ts
verdict: covered=7 uncovered=1
skipped: compile not-run (skipped)
out_of_scope: none
error_class: none
questions: none
resume_at: none
```
