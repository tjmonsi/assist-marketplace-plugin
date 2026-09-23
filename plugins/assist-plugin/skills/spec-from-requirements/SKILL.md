---
name: spec-from-requirements
description: >-
  Create and update technical specifications from requirements.
  Classify each requirement type (Architecture|API|Frontend|Functionality|UI-UX|General),
  write to specs/ folder, support delta specs for incremental changes (ADDED/MODIFIED/REMOVED).
  Modes: create (new spec), delta (incremental change), review (quality audit).
effort: high
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
argument-hint: "[create | delta | review] [feature-name | file-path]"
---

# Spec From Requirements

Turn requirements into specification files. Classify the requirement first, then write it with the matching template. One file per feature, every behavior expressed as a Requirement with GIVEN/WHEN/THEN scenarios, every spec traced to the requirement IDs it satisfies.

## Modes

Parse `$0` and route. If `$0` is empty, infer from state: no existing spec for the feature means `create`, an existing spec means `delta`.

| `$0` | Action |
|------|--------|
| `create` | New feature with no existing spec. Classify, pick the template, write the full spec file. |
| `delta` | Existing spec plus an incremental requirement change. Append a change log entry with ADDED/MODIFIED/REMOVED subsections instead of rewriting the file. See [references/delta-format.md](references/delta-format.md). |
| `review` | Audit an existing spec for completeness, correctness, and coherence. Read-only. |

## Classify first

Classify the requirement into exactly one of six types. **First match wins.** Never mix sections from two templates in one file.

| Type | Use when the requirement defines | Template |
|---|---|---|
| **Architecture** | System structure, component boundaries, service topology, data flow, infrastructure layout | [references/templates/architecture.md](references/templates/architecture.md) |
| **API endpoint** | An HTTP endpoint, webhook, or RPC method that receives requests and returns responses | [references/templates/api-endpoint.md](references/templates/api-endpoint.md) |
| **Frontend action** | A user-triggered interaction, UI flow, screen transition, form, or client-side behavior | [references/templates/frontend-action.md](references/templates/frontend-action.md) |
| **Functionality** | Backend business logic, data transformation, scheduled job, or event handler that is not an endpoint | [references/templates/functionality.md](references/templates/functionality.md) |
| **UI/UX design** | Visual hierarchy, layout, design system components, design tokens, accessibility, responsive behavior | [references/templates/ui-ux-design.md](references/templates/ui-ux-design.md) |
| **General** | Configuration, tooling, integration, policy, infrastructure-as-code, or anything the five above do not cover | [references/templates/general.md](references/templates/general.md) |

The decision tree and the tie-breakers for ambiguous cases are in [references/classification-guide.md](references/classification-guide.md). Read the matched template before writing.

## File naming and placement

```
spec-[feature-name].md
```

`feature-name` is lowercase kebab-case, descriptive enough to identify the feature without opening the file (`spec-user-authentication.md`, `spec-order-checkout.md`, `spec-webhook-dispatcher.md`).

| Feature scope | Placement |
|---|---|
| Main repo feature | `specs/spec-[feature-name].md` at the repository root |
| Sub-feature of a main feature | `specs/spec-[feature-name].md` at the repository root, linked to its parent in metadata |
| Submodule feature (frontend, backend, CLI, cloud function) | `[submodule]/specs/spec-[feature-name].md` |
| Sub-feature of a submodule feature | `[submodule]/specs/spec-[feature-name].md` |

Create `specs/` if it does not exist.

## Metadata block

Every spec opens with this block, whatever the template:

```markdown
## Metadata

| Field | Value |
|---|---|
| **Feature** | [Human-readable feature name] |
| **Parent feature** | [spec-[parent].md, or "None" if top-level] |
| **Sub-features** | [Comma-separated spec-[child].md files, or "None"] |
| **Requirement refs** | [BR-NNN, UR-NNN, FR-NNN, NFR-NNN — the IDs this spec satisfies] |
| **Feature type** | [Architecture / API endpoint / Frontend action / Functionality / UI/UX design / General] |
| **Status** | Draft |

Status values: Draft, Review, Approved, Implemented.
```

**Requirement refs** cites the IDs produced by the `gather-requirements` skill (`BR-NNN`, `UR-NNN`, `FR-NNN`, `NFR-NNN`) exactly as they appear in the BRD, URD, or FR-NFR document. Do not invent a parallel ID scheme. A spec with no requirement reference is not ready to write; go find the requirement or ask for it.

## Requirement and Scenario format

Every section that describes system behavior uses a Requirement header followed by one or more Scenario blocks. Prose paragraphs describe context; Requirements describe behavior.

```markdown
### Requirement: Message routing from producer to consumer

The system SHALL route each message from its producer to the registered consumer
with at-least-once delivery.

#### Scenario: Successful delivery

- **GIVEN** a consumer is registered and healthy
- **WHEN** a producer publishes a message to the topic
- **THEN** the system SHALL deliver the message to the consumer within 5 seconds
- **AND** the system SHALL record the delivery acknowledgement

#### Scenario: Consumer unavailable

- **GIVEN** the registered consumer returns a 503 response
- **WHEN** the system attempts delivery
- **THEN** the system SHALL retry with exponential backoff up to 5 attempts
- **AND** the system SHALL move the message to the dead-letter topic after the final attempt
```

Rules:

- The requirement statement carries exactly one RFC 2119 keyword: `SHALL`/`MUST` (mandatory), `SHOULD` (recommended), `MAY` (optional).
- Every Requirement has at least one Scenario. Every Requirement that can fail has a failure Scenario.
- `GIVEN` is state, `WHEN` is a single trigger, `THEN` is observable. Use `AND` continuation lines for extra clauses.
- A Scenario a QA agent cannot execute is not finished. Name the observable, not the intent.

## Traceability

Every spec ends with a traceability table, and every row cites a requirement ID from `gather-requirements` output:

| Requirement | Spec section | Verified by |
|---|---|---|
| FR-045 | Requirement: Message routing from producer to consumer | Integration test: routing suite |
| NFR-012 | Requirement: Delivery latency budget | Load test report |

Each spec must trace to at least one `BR-NNN`, `UR-NNN`, `FR-NNN`, or `NFR-NNN`. A spec's own Requirement headers are numbered per file (`REQ-spec-001` in JSON output) and are not globally unique; the traced requirement IDs are the stable identifiers.

## Machine-readable output

With `--json`, emit the spec as JSON alongside the Markdown using [references/json-output-format.md](references/json-output-format.md). For an API endpoint spec, also derive the OpenAPI 3.1 path-item fragment from the endpoint contract per [references/openapi-output.md](references/openapi-output.md). Both are projections of the Markdown, not separate sources of truth.

## Review mode

`review` reports findings and changes nothing. Check in this order:

| Check | What it verifies | Finding level when it fails |
|---|---|---|
| Completeness | Every Requirement has at least one Scenario; every template section is present or explicitly marked "Not applicable"; error handling covers more than the happy path | CRITICAL |
| Correctness | Requirement refs point at IDs that exist in the requirements documents; the traceability table has no orphan rows; RFC 2119 keywords are present and singular | CRITICAL |
| Coherence | The file uses one template's sections only; the Feature type matches the classification; parent and sub-feature links resolve to real files | WARNING |
| Style | Scenario names describe the case, statements name observables, no pseudo-code outside the gate | SUGGESTION |

Report CRITICAL, WARNING, and SUGGESTION findings. Review is non-blocking: it does not change the spec's Status.

## Cloud architecture

For specs involving cloud infrastructure, consult [references/cloud-patterns.md](references/cloud-patterns.md) for service selection and the five cloud-boundary rules.

## Rules

1. **One file per feature.** Do not combine features into one spec.
2. **Classify then write.** First match wins; never mix template sections.
3. **Trace everything.** Every spec references at least one requirement ID; every requirement maps to at least one spec.
4. **Parent-child linking.** Parent specs list children in metadata; child specs name their parent.
5. **Submodules stay high-level.** A submodule entry in a root spec describes capabilities; detailed specs live in the submodule's own `specs/` folder.
6. **Scenarios are independently testable.** A developer or QA agent can verify each one without reading the rest of the file.
7. **Error handling is explicit.** Every spec defines what happens when things go wrong.
8. **Events are documented on both sides.** If a feature emits or consumes an event, document producer and consumer contracts.
9. **Status tracking.** New specs start as Draft. Update Status as they move through review and implementation.
10. **No source code.** Pseudo-code only under the gate in [references/pseudo-code-gate.md](references/pseudo-code-gate.md).

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
