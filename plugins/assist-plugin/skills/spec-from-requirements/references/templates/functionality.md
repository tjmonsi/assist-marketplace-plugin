# Functionality Template

Use when the requirement defines a backend process, business logic, data transformation, scheduled job, event handler, or any processing that is not directly an API endpoint or a frontend interaction.

Unique to this template: the **Business rules** table (rules carry their own `RULE-NNN` identifiers, kept distinct from requirement IDs) and **Events consumed** alongside events emitted.

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
| **Feature type** | Functionality |
| **Status** | Draft |

Status values: Draft, Review, Approved, Implemented.

## Description

[2-4 sentences: what this functionality does, why it exists, and which business process it implements.]

## Triggered by

| Trigger type | Source | Condition |
|---|---|---|
| [Called by feature / Event / Schedule / Queue message / System startup] | [Parent feature, event bus, cron, message queue, init process] | [When this trigger fires] |

## Required data

| Data | Source | Type | Notes |
|---|---|---|---|
| [Data element name] | [Database, config, upstream feature, event payload, queue message] | [Data type] | [Constraints, validation rules, defaults] |

## Preconditions

| Condition | Check | If not met |
|---|---|---|
| [What must be true before this runs] | [How to verify: query, flag, state check] | [Reject, skip, queue for retry, raise error] |

## Algorithmic steps

Each step is a Requirement with Scenarios, numbered in execution order and independently testable. A step a QA agent cannot verify on its own is too coarse; split it.

### Requirement 1: [Step name, e.g. Validate the incoming payload]

The [component] SHALL [action] [object] before [the next step runs].

#### Scenario: Valid input

- **GIVEN** [the input satisfies every constraint in Required data]
- **WHEN** [the step executes]
- **THEN** the [component] SHALL [produce the named intermediate result]

#### Scenario: Invalid input

- **GIVEN** [the input violates [constraint]]
- **WHEN** [the step executes]
- **THEN** the [component] SHALL [reject with the named error] and SHALL NOT [produce side effects]

### Requirement 2: [Step name, e.g. Apply the pricing rules]

The [component] SHALL [transform / calculate / decide] per [RULE-NNN].

#### Scenario: [Rule applies]

- **GIVEN** [the state that makes the rule apply]
- **WHEN** [the step executes]
- **THEN** the [component] SHALL [produce the specific outcome, with the value or formula named]

#### Scenario: [Rule does not apply]

- **GIVEN** [the state that exempts the record]
- **WHEN** [the step executes]
- **THEN** the [component] SHALL [pass the record through unchanged]

### Requirement 3: [Persist results]

The [component] SHALL [write the result to the named store] atomically.

#### Scenario: Write succeeds

- **GIVEN** [the computed result and a healthy store]
- **WHEN** [the step executes]
- **THEN** the [component] SHALL persist [entity] with [fields]
- **AND** the [component] SHALL emit [event.name]

#### Scenario: Write fails

- **GIVEN** [the store rejects the write or times out]
- **WHEN** [the step executes]
- **THEN** the [component] SHALL [roll back / retry / dead-letter] and SHALL NOT emit [event.name]

Continue numbering per step (receive input, validate preconditions, process, persist, emit events, acknowledge completion).

## Business rules

Rule IDs are local to this spec (`RULE-NNN`) and are separate from requirement IDs (`BR-NNN`, `FR-NNN`). The **Traces to** column links the rule to the requirement that mandates it.

| Rule ID | Rule | Traces to | Applied at step | Example |
|---|---|---|---|---|
| RULE-001 | [Plain-language business rule] | [FR-NNN / BR-NNN] | [Requirement N] | [Concrete example of the rule in action] |

## Data transformations

| Input | Transformation | Output | Notes |
|---|---|---|---|
| [Source data shape] | [Map, filter, aggregate, enrich, format] | [Result data shape] | [Edge cases or special handling] |

## Output / Outcome

| Output | Type | Description |
|---|---|---|
| [What is produced] | [Database record, file, event, return value, notification] | [Structure, destination, format] |

## Error handling

| Error condition | Handling strategy | Outcome |
|---|---|---|
| [Invalid input data] | [Reject with a specific error] | [Caller receives the error; no side effects] |
| [External dependency failure] | [Retry N times with backoff, circuit breaker, or fallback] | [Degraded result or queued for retry] |
| [Business rule violation] | [Reject with the rule ID and explanation] | [Caller receives the rejection; state unchanged] |
| [Partial failure in a batch] | [Continue with remaining items, collect failures] | [Partial result plus a failure report] |
| [Unexpected error] | [Log with correlation ID, alert, fail safely] | [No corrupted state; error surfaced for investigation] |

## Events emitted

| Event name | Payload | Consumer(s) | When emitted |
|---|---|---|---|
| [event.name] | [Key fields in the payload] | [Which features or systems consume this] | [After which Requirement or condition] |

## Events consumed

| Event name | Producer | Payload used | Handling |
|---|---|---|---|
| [event.name] | [Which system or feature produces this] | [Which fields are used] | [What this functionality does when the event arrives] |

## Sub-feature breakdown

Use when the functionality decomposes into smaller units.

| Sub-feature | Spec file | Description |
|---|---|---|
| [Name] | [spec-[sub-feature].md] | [One-line summary] |

## Performance considerations

| Concern | Target | Approach |
|---|---|---|
| [Throughput, latency, memory, batch size] | [Measurable target, traced to NFR-NNN where one exists] | [How the design meets it] |

## Traceability

| Requirement | Spec section | Verified by |
|---|---|---|
| [FR-NNN] | [Requirement 2: [step name]] | [Unit test, integration test, or acceptance reference] |
| [NFR-NNN] | [Performance considerations] | [Benchmark or load test reference] |
````
