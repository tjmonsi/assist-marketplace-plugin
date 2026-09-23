# General Template

Use when the requirement does not fit architecture, API endpoint, frontend action, functionality, or UI/UX design. This covers configuration, infrastructure-as-code, tooling, integrations, policies, and cross-cutting concerns.

Unique to this template: the **Dependencies** table, and a **Feature type** field that names the specific category instead of a fixed value.

## Template

````markdown
# spec-[feature-name]

## Metadata

| Field | Value |
|---|---|
| **Feature** | [Human-readable feature name] |
| **Parent feature** | [spec-[parent].md, or "None" if top-level] |
| **Sub-features** | [Comma-separated spec-[child].md files, or "None"] |
| **Requirement refs** | [BR-NNN, UR-NNN, FR-NNN, NFR-NNN — the IDs this spec satisfies] |
| **Feature type** | [Configuration / Infrastructure / Integration / Policy / Tooling / Other: specify] |
| **Status** | Draft |

Status values: Draft, Review, Approved, Implemented.

## Description

[2-4 sentences: what this feature does, why it exists, and what triggers it or what it supports.]

## Triggered by

| Trigger type | Source | Condition |
|---|---|---|
| [User action, system event, configuration change, deployment, manual process] | [Source system or actor] | [When or under what condition] |

## Required data

| Data | Source | Type | Notes |
|---|---|---|---|
| [Data element name] | [Where it comes from] | [Data type] | [Constraints, validation rules, defaults] |

## Behavior

Express each verifiable behavior as a Requirement with Scenarios. Keep the numbered step list below for setup or ordering detail that is not itself testable.

### Requirement: [Behavior name, e.g. Secret rotation on schedule]

The [system/pipeline/policy] SHALL [action] [object] [under condition].

#### Scenario: [Expected case]

- **GIVEN** [starting state or configuration]
- **WHEN** [the trigger fires]
- **THEN** the [system] SHALL [observable outcome]
- **AND** [additional observable outcome]

#### Scenario: [Failure or exception case]

- **GIVEN** [the state that prevents success]
- **WHEN** [the trigger fires]
- **THEN** the [system] SHALL [fail safely, alert, or fall back]
- **AND** the [system] SHALL leave [state] unchanged

## Algorithmic steps

Numbered processing or setup logic, when ordering matters.

1. [Step description]
2. [Step description]
3. [Step description]

## Output / Outcome

| Output | Type | Description |
|---|---|---|
| [What is produced or changed] | [Artifact, state change, configuration, report] | [Details] |

## Error handling

| Error condition | Handling strategy | Outcome |
|---|---|---|
| [What can go wrong] | [How the system responds] | [What the user, caller, or operator sees] |

## Events emitted (if applicable)

| Event name | Payload | Consumer(s) | When emitted |
|---|---|---|---|
| [event.name] | [Key fields] | [Consumers] | [Condition] |

## Dependencies

| Dependency | Type | Required | Notes |
|---|---|---|---|
| [Service, library, config, or other feature] | [Runtime / Build-time / External] | [yes/no] | [Version, fallback, or alternative] |

## Sub-feature breakdown (if applicable)

| Sub-feature | Spec file | Description |
|---|---|---|
| [Name] | [spec-[sub-feature].md] | [One-line summary] |

## Submodule scope (if applicable)

| Submodule | Capabilities | Spec location |
|---|---|---|
| [Submodule name] | [High-level capabilities] | [submodule/specs/] |

## Traceability

| Requirement | Spec section | Verified by |
|---|---|---|
| [BR-NNN] | [Requirement: [behavior name]] | [Test, review, or acceptance criteria reference] |
| [NFR-NNN] | [Dependencies / Error handling] | [Audit or operational check reference] |
````
