---
name: gather-requirements
description: >-
  Gather and document business, user, and technical requirements using
  IEEE 29148 templates and OpenSpec Scenario/RFC 2119 format.
  Subcommands: elicit (interactive), document (structured output), review (quality audit).
effort: high
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
argument-hint: "[elicit | document | review] [topic | file]"
---

# Gather Requirements

Gather, categorize, and document project requirements using IEEE 29148, BABOK, and INCOSE practice. Acceptance criteria are written as GIVEN/WHEN/THEN scenarios so QA and the `spec-from-requirements` skill can consume them without rewriting.

## Routing

Parse `$0` (first argument) and route to the matching subcommand. If `$0` is empty, default to `elicit`.

| `$0` | Action | Reference |
|------|--------|-----------|
| `elicit` | Interactively gather requirements through batched, structured questions | [references/elicitation-methodology.md](references/elicitation-methodology.md) |
| `document` | Categorize input into BR/UR/FR/NFR and write the three output files | [references/document-workflow.md](references/document-workflow.md) |
| `review` | Audit existing requirements for quality, completeness, traceability | [references/review.md](references/review.md) |

## Traceability chain

Every requirement carries a unique ID and links upward:

```
BR-NNN  (business outcome)
  └─ UR-NNN  (what a role needs to accomplish)
       └─ FR-NNN  (what the system does to satisfy it)
NFR-NNN (quality attribute; traces to FR, UR, or BR depending on origin)
```

- Every FR traces to at least one UR. Every UR traces to at least one BR.
- An NFR traces to whichever level it originates from (regulatory NFRs usually trace straight to a BR).
- A requirement with no parent link is an orphan. Flag it; do not silently drop it.

These are the IDs the rest of the plugin cites: `spec-from-requirements` puts them in each spec's **Requirement refs** field, and code comments cite them per [docs/TRACING_MARKERS.md](../../docs/TRACING_MARKERS.md).

## Requirement sentence templates

**Business requirement:**
> To [achieve organizational goal], the business must [deliver/accomplish] [strategic outcome].

**User requirement (shall-statement):**
> The [user/role] shall be able to [accomplish goal] [qualifying condition].

**User requirement (user story, alternative):**
> As a [role], I want to [goal] so that [business value].

**Functional requirement:**
> The [system] shall [action verb] [object] [qualifying conditions].
> When [condition], the [system/component] shall [action] [object] [performance measure].

**Non-functional requirement:**
> The [system/component] SHALL [quality attribute] [measurable threshold] [under conditions].

### Binding language (RFC 2119)

| Keyword | Meaning | Priority column |
|---|---|---|
| `SHALL` / `MUST` | Mandatory | Must |
| `SHOULD` | Recommended; deviation needs a documented reason | Should |
| `MAY` | Optional | May |

Use the keyword in uppercase inside FR and NFR statements so the binding level survives copy-paste into a spec. Never mix two keywords in one requirement.

## Acceptance criteria as scenarios

Every FR needs at least one scenario. Write each as:

```markdown
#### Scenario: Successful submission
- **GIVEN** the user is authenticated and the form passes client validation
- **WHEN** the user submits the form
- **THEN** the system SHALL persist the record and return its identifier
```

At minimum, cover one happy path and one failure path per FR. `AND` continuation lines are allowed under any of the three keywords.

## Quality criteria

Every requirement must be **Necessary**, **Unambiguous**, **Testable**, **Feasible**, **Complete**, **Consistent**, **Singular**, **Implementation-free**, and **Traceable**. The full test-and-fix table plus the banned-words list is in [references/quality-checklist.md](references/quality-checklist.md).

## Output

`document` writes three Markdown files to the working directory:

| File | Template |
|---|---|
| `BRD-<project-slug>.md` | [references/brd-template.md](references/brd-template.md) |
| `URD-<project-slug>.md` | [references/urd-template.md](references/urd-template.md) |
| `FR-NFR-<project-slug>.md` | [references/fr-nfr-template.md](references/fr-nfr-template.md) |

With `--json`, also emit `requirements-<project-slug>.json` using the schema in [references/json-output-format.md](references/json-output-format.md). The JSON is a projection of the same requirements, not a second source of truth.

## Out-of-scope handling

Each excluded item appears in the relevant document with three fields: the item, the reason, and **Deferred to** (phase, version, or never). Business-level exclusions go in the BRD, user-facing ones in the URD, system-level ones in FR-NFR.

## Constraints

- Do not invent requirements. Elicit them from the user or from existing artifacts.
- Do not mix solution design into requirements; keep them implementation-free.
- Assign unique sequential IDs: `BR-NNN`, `UR-NNN`, `FR-NNN`, `NFR-NNN`. Never renumber an issued ID.
- Every FR traces to at least one UR; every UR traces to at least one BR.
- Never hardcode an author name in an output document. Read it from `git config user.name`, or leave `[Author]`.
- `review` is read-only: report findings, do not edit the document under review.

## Report Writing Standard

- Lead with the most important finding; never write "this is the more important of the two."
- Every finding has three parts: what happened, why it matters, what to do next.
- State each conclusion once. One optional summary line at the end for multi-finding reports; never repeat findings there.
- Use active voice, important subject before the verb ("Validation is skipped" not "The validation was skipped by...").
- Cut hedges ("it should be noted," "arguably") and contrastive filler ("This is X, not Y" — state what it is).
- No meta-headers about the act of writing ("What follows," "Key takeaway," "In conclusion").
- No em-dashes; use a period, comma, parentheses, or semicolon.
- No severity badges, remediation blocks, or summary sections unless the reader would be lost without them.
- Never restate the user's prompt or an assumption as fact; report the tested result.
- The first sentence of every paragraph must add new information.
