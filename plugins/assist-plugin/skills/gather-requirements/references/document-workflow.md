# Document Workflow

Break gathered requirements into categorized documents. Produces three Markdown files, plus one JSON file when `--json` is passed. Used by `/gather-requirements document`.

## Inputs

- `$1+` — Path to an existing requirements summary, elicitation notes, prompt, or source documents
- If no argument: use the requirements gathered in the current conversation

## Prerequisite

Requirements must already exist (from `elicit`, from conversation, from documents, or from an existing artifact). Do not generate requirements from nothing. If no input exists, halt and redirect to `/gather-requirements elicit`.

## Workflow

### 1. Load and parse input

- File path given: read and parse it.
- Prompt or multiple documents: read all provided input.
- Elicitation happened in conversation: use those requirements.
- Read `CLAUDE.md` and any directory-structure doc for project context and naming conventions.

### 2. Extract requirement candidates

Identify every statement that expresses:

- A business goal, outcome, or strategic need → candidate BR
- A user need, capability, or workflow → candidate UR
- A system behavior, feature, or function → candidate FR
- A quality attribute, constraint, or performance target → candidate NFR
- An explicit exclusion or deferral → candidate out-of-scope item

### 3. Categorize and assign IDs

Assign unique sequential IDs per category: `BR-NNN`, `UR-NNN`, `FR-NNN`, `NFR-NNN`. Start at `001`. If the project already has requirement documents, continue their numbering instead of restarting.

### 4. Apply sentence templates

Rewrite each requirement using the canonical forms in [SKILL.md](../SKILL.md#requirement-sentence-templates). Use RFC 2119 keywords in uppercase for FR and NFR statements: `SHALL`/`MUST` mandatory, `SHOULD` recommended, `MAY` optional.

### 5. Write scenarios for every FR

Each FR gets at least one `#### Scenario:` block in GIVEN/WHEN/THEN form, covering one happy path and one failure path. A scenario that cannot be written is a sign the FR is not yet testable; send it back to elicitation rather than inventing an outcome.

### 6. Establish traceability

- Every FR traces to at least one UR.
- Every UR traces to at least one BR.
- An NFR traces to an FR, UR, or BR depending on where it originates.
- Flag orphans (no parent) and dead ends (a BR with no derived UR) in the traceability matrix.

### 7. Categorize out-of-scope items

| Exclusion type | Destination |
|---|---|
| Business-level | BRD out-of-scope section |
| User-facing | URD out-of-scope section |
| System or technical | FR-NFR out-of-scope section |

Each exclusion records: item, reason, deferred to (phase/version/never).

### 8. Write output files

| File | Template | Contains |
|---|---|---|
| `BRD-<project-slug>.md` | [brd-template.md](brd-template.md) | Business requirements, scope, constraints, assumptions, success criteria |
| `URD-<project-slug>.md` | [urd-template.md](urd-template.md) | User and stakeholder requirements, stakeholder map, use case summaries |
| `FR-NFR-<project-slug>.md` | [fr-nfr-template.md](fr-nfr-template.md) | Functional requirements with scenarios, non-functional requirements, traceability matrix |
| `requirements-<project-slug>.json` | [json-output-format.md](json-output-format.md) | Machine-readable projection; written only with `--json` |

Use the project name or topic in kebab-case as `<project-slug>`. Fill the **Author** field from `git config user.name`; if that fails, leave `[Author]`.

### 9. Quality pass

Run every requirement against [quality-checklist.md](quality-checklist.md). Record failures in the relevant document rather than silently rewriting a requirement the user supplied.

### 10. Present for approval

Report: count per category (BR/UR/FR/NFR), quality issues flagged, out-of-scope items, open questions, and the file paths created.

## Constraints

- Do not invent requirements absent from the input.
- Keep requirements implementation-free: what, not how.
- Every FR traces to at least one UR; every UR to at least one BR.
- Out-of-scope items must appear in the relevant document's exclusion section.
- Do not renumber existing IDs when updating a document; append new ones.
