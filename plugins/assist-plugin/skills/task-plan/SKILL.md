---
name: task-plan
description: >-
  Validates specifications have acceptance criteria, then outputs ordered coding
  steps with file names, requirement IDs, and code skill references for the
  developer to implement.
effort: medium
allowed-tools:
  - Read
  - Grep
  - Glob
  - Edit(./task-plan-*.md)
argument-hint: "<spec-file-or-prompt> [target-language]"
---

# Task Plan

Plan the implementation of a feature by validating its specification and producing an ordered list of coding steps. Each step names the files to create/modify, the requirements it satisfies, and which `code` skill references apply.

## Routing

Parse input: target spec file path, optional target language (detected from codebase if omitted). A rework (a fix pass) also gives an existing task-plan file path; WritePlan then overwrites that file instead of creating a new one.

`/do` runs this skill through the [task-planner](../../agents/task-planner.md) agent, which has no Bash, Edit, or PowerShell tool and can write only a `task-plan-*.md` file at the project root.

Write scope: the skill pre-approves edits only to `./task-plan-*.md` in the working directory; a write to any other path asks the user first.

## States

`task-plan` is a finite-state automaton (rules T1 to T9 in [fsa-template.md](../do/references/fsa-template.md)). Follow the states in this order and do not skip one. Every `model` state ends with one line `Outcome: <value>`, and that value picks the next state. The Workflow steps below are the states, in order. Its output is the input of the `developer` agent (see [developer States](../../agents/developer.md#states)); the `task-planner` agent runs this table (see [task-planner](../../agents/task-planner.md#states)).

| State | Kind | Does | Outcome -> next state |
|---|---|---|---|
| Intake | check | Spec path present and readable; it holds at least one `### Requirement:`; every one has a `#### Scenario:`. Record the list of requirement IDs. This is the validation gate | `ok` -> ClassifyContext; `no-spec` -> NeedsInput; `scenario-missing` or `no-requirements` -> Error(precondition-failed) |
| ClassifyContext | check | Detect the target language from the argument, codebase files, the spec's tech-context field, or the prompt | `detected` -> ExtractRequirements; `undetected` -> NeedsInput |
| ExtractRequirements | check | List each `SPEC-NNN` ID, each linked `FR-NNN` or `NFR-NNN`, and each Scenario title | `listed` -> PlanSteps |
| PlanSteps | model | Write the ordered coding steps: files, `Satisfies` IDs, `code` skill references | `planned` -> CheckPlan |
| CheckPlan | check | Every Intake requirement appears in some step's `Satisfies`. Every cited ID exists in the spec or its requirement documents (Grep). Every cited code reference exists in the `code` skill (Glob). Every file path a step modifies exists | `complete` -> WritePlan; `gaps` with rounds < 2 -> PlanSteps; `gaps` with rounds = 2 -> Error(budget-exhausted) |
| WritePlan | model | Write the plan file from the template. A rework overwrites the task-plan file whose path the prompt gives; a first run creates a new timestamped file | `written` -> Done; `denied` (the write bar refused the path) -> Error(policy-rejection) |
| Done, NeedsInput, Error | terminal | End with the terminal block below | none |

`rounds` counts PlanSteps passes after a CheckPlan `gaps`. `NeedsInput` carries numbered questions and `resume_at` (`Intake` for `no-spec`, `ClassifyContext` for `undetected`).

### Terminal block

When `task-plan` runs inside the `task-planner` agent, the final message ends with this block ([fsa-template.md](../do/references/fsa-template.md#terminal-block)). `verdict` is `steps=N`, the number of coding steps in the plan. `artifact` is the plan file path. When a `developer` run applies only task-plan's validation as its own Intake, the block is the developer's.

```fsa
fsa: task-planner/1
state: Done
trace: Intake > ClassifyContext > ExtractRequirements > PlanSteps > CheckPlan > WritePlan > Done
artifact: task-plan-user-api-20261012-101500.md
verdict: steps=6
skipped: none
out_of_scope: none
error_class: none
questions: none
resume_at: none
```

## Workflow

### 1. Validate Specification (state: Intake)

Read the target spec file and check every `### Requirement:` block for at least one `#### Scenario:` subsection. If any requirement lacks scenarios (acceptance criteria), halt and report:

```
Specification incomplete: [Requirement block] has no scenarios.
Complete the acceptance criteria before planning.
File: [path]
Line: [N]
```

Put this report in the prose above the terminal block, then end in `Error(precondition-failed)`. Do not proceed to planning.

Reference: [references/validation-rules.md](references/validation-rules.md)

### 2. Classify Technology Context (state: ClassifyContext)

Detect the target language from:
1. Explicit argument (if provided)
2. Codebase files (`.py`, `.ts`, `.go`, `.rs`, `.kt`, `.cpp`, etc.)
3. Spec's tech-context field (if present)
4. Prompt context

| Language | Signal |
|---|---|
| Python | `.py`, `pyproject.toml`, `uv.lock` |
| TypeScript | `.ts`, `tsconfig.json`, `.tsx` |
| JavaScript | `.js`, `package.json` (no TS) |
| Go | `.go`, `go.mod` |
| Rust | `.rs`, `Cargo.toml` |
| Kotlin | `.kt`, `build.gradle.kts` |
| C++ | `.cpp`, `.cc`, `CMakeLists.txt` |

### 3. Extract Requirements and Acceptance Criteria (state: ExtractRequirements)

From the spec, list:
- Each `SPEC-NNN` ID
- Each requirement's `FR-NNN`/`NFR-NNN` refs (if linked)
- Each `#### Scenario:` block's title

### 4. Plan Coding Steps (states: PlanSteps, CheckPlan)

For each requirement, generate one or more steps. Each step:
- Names the file(s) to create or modify (relative paths, as they exist in the codebase)
- Cites the requirement IDs the step satisfies: `[SPEC-NNN]` or `[FR-NNN -> UC-NNN -> AC-N]` (full chain when applicable)
- Lists which `code` skill references apply: language, framework (if any), activity (if any), or pattern names

Example:
```markdown
### Step 1: User API endpoint
- **Files:** `src/api/users.ts`
- **Satisfies:** [SPEC-003 -> FR-045 -> UC-012 -> AC-1]
- **Code references:** `languages/typescript.md`, `frameworks/fastify.md`, `patterns/typescript/rest-crud-endpoint.md`
- **Notes:** Implement GET /users/:id with validation per the spec.
```

Order steps so:
- Core domain models and types are defined first
- API/interface definitions precede implementations
- Database setup precedes service code
- Services precede handlers/controllers
- Tests follow implementations (or align with them per TDD approach noted in the spec). A test step names `developer-tester` as its owner and lists test paths only; the `developer` never writes test paths

### 5. Output (state: WritePlan)

Write `task-plan-[feature-slug]-[timestamp].md` using the template at [references/task-plan-template.md](references/task-plan-template.md). When the prompt gives the path of an existing task-plan file to rework, overwrite that file and keep its name.

The file is ready for the `developer` agent to follow: each step becomes one implementation task.

## Constraints

- Never invent acceptance criteria or requirement IDs
- Every code reference cited must exist in the `code` skill
- File paths must match the target codebase structure (use Glob to verify before citing)
- Do not estimate effort or timeline; steps are ordered, not sized
- Do not propose refactoring or cleanup steps; focus on the feature's requirements

## Report Writing Standard

- Put the answer or the most important finding first. No preamble, no restating the question, no closing recap.
- Let content set the length. Report a clean check in one line.
- Give each finding three parts: what happened, why it matters, what to do next.
- State each conclusion once. Open every paragraph with new information.
- Use active voice; put the important subject before the verb.
- Use plain words ("use" for "utilize"). Cut hedges, intensifiers, throat-clearing, buzzwords, and "not X but Y" framing; state what it is.
- Name headings after their content. Skip summary labels ("In conclusion", "Key takeaways"), severity badges, and summary sections unless the reader needs them.
- Write no em dashes (use a period, comma, colon, parentheses, or semicolon), no curly quotes, and no chatbot sign-offs or offers.
- Back every claim with evidence (file and line, log, test result, URL) and every number with a source; label estimates as estimates.
- Report tested results; never present the prompt or an assumption as fact.
- Quote exactly; never reword a quotation.
- Keep ticket ids and internal blame out of user-facing text.
