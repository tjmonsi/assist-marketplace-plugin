# Architecture Template

Use when the requirement defines system structure, component boundaries, service topology, data flows, or infrastructure layout.

Unique to this template: the **Design decisions** section (Decision / Options considered / Chosen / Rationale) and the **Topology** diagram. Consult [../cloud-patterns.md](../cloud-patterns.md) when the architecture involves GCP or AWS services.

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
| **Feature type** | Architecture |
| **Status** | Draft |

Status values: Draft, Review, Approved, Implemented.

## Description

[2-4 sentences: what architectural concern this addresses, why this structure was chosen, and which quality attributes it supports.]

## Components

| Component | Responsibility | Owns data | Technology |
|---|---|---|---|
| [Component name] | [What it does — single responsibility] | [Which data entities it owns] | [Language, framework, runtime] |

## Component boundaries

| Boundary | What crosses it | Protocol | Auth |
|---|---|---|---|
| [Component A → Component B] | [Data or commands that flow across] | [REST, gRPC, event bus, direct call] | [How the caller authenticates] |

## Data flow

Each flow is a Requirement with Scenarios. Cover the primary path, the retry path, and the failure path.

### Requirement: [Flow name, e.g. Message routing from producer to consumer]

The system SHALL [route/transform/persist] [data] from [source] to [destination] with [delivery or consistency guarantee].

#### Scenario: Successful path

- **GIVEN** [initial state: components healthy, consumer registered, data valid]
- **WHEN** [the producer emits the data / the trigger fires]
- **THEN** the system SHALL [deliver or process it, naming the observable result]
- **AND** the system SHALL [record, acknowledge, or emit the downstream signal]

#### Scenario: Retry after transient failure

- **GIVEN** [the destination is temporarily unavailable]
- **WHEN** [the system attempts the operation]
- **THEN** the system SHALL retry [N] times with [backoff strategy]
- **AND** the system SHALL [preserve the message / hold the transaction] until the retries are exhausted

#### Scenario: Permanent failure

- **GIVEN** [the retries are exhausted or the data is invalid]
- **WHEN** [the final attempt fails]
- **THEN** the system SHALL [dead-letter, reject, compensate]
- **AND** the system SHALL [alert, log with correlation ID, surface the failure to the operator]

Repeat per distinct flow.

## Topology

[ASCII diagram or structured description showing how components connect, with direction of data flow.]

```
[Component A] --REST--> [API Gateway] --gRPC--> [Component B]
                                      --event--> [Event Bus] --> [Component C]
```

## Cloud boundaries

Use when components span more than one cloud or more than one region. Name which components live where and why.

| Component | Cloud / Region | Reason |
|---|---|---|
| [Component name] | [GCP us-central1 / AWS eu-west-1] | [Trigger, consumer, data residency, or cost driver that pins it here] |

## Failure modes

| Failure | Impact | Detection | Mitigation |
|---|---|---|---|
| [What fails — component, network, dependency] | [What breaks downstream] | [Health check, timeout, alert] | [Retry, fallback, circuit breaker, graceful degradation] |

## Non-functional requirements addressed

| NFR | Target | How this architecture achieves it |
|---|---|---|
| [NFR-NNN — scalability / availability / latency / security] | [Measurable target, e.g. 99.9% uptime, under 200ms p95] | [Which architectural decision supports this] |

## Design decisions

| Decision | Options considered | Chosen | Rationale |
|---|---|---|---|
| [Decision topic] | [Option A, Option B, Option C] | [Which one] | [Trade-offs, constraints, requirements that decided it] |

## Sub-feature breakdown

Use when the architecture decomposes into feature-level specs.

| Sub-feature | Spec file | Description |
|---|---|---|
| [Name] | [spec-[sub-feature].md] | [One-line summary] |

## Submodule scope

Use when the architecture spans submodules. Each submodule gets a high-level capability description here; detailed specs live in the submodule's own `specs/` folder.

| Submodule | Capabilities | Spec location |
|---|---|---|
| [Submodule name] | [High-level capabilities] | [submodule/specs/] |

## Error handling

| Error condition | Handling strategy | Outcome |
|---|---|---|
| [What can go wrong at the architectural level] | [How the system responds] | [What the end user or upstream caller sees] |

## Events

| Event name | Producer | Consumer(s) | Payload summary | Guarantee |
|---|---|---|---|---|
| [event.name] | [Which component emits it] | [Which components consume it] | [Key fields] | [At-least-once, exactly-once, best-effort] |

## Traceability

| Requirement | Spec section | Verified by |
|---|---|---|
| [FR-NNN] | [Requirement: [flow name]] | [Integration test, design review, or acceptance criteria reference] |
| [NFR-NNN] | [Non-functional requirements addressed] | [Load test, chaos test, or audit reference] |
````
