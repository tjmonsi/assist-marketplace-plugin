# API Endpoint Template

Use when the requirement defines an HTTP endpoint, webhook receiver, or RPC method that receives requests and returns responses.

Unique to this template: the **Endpoint contract** block and the OpenAPI 3.1 fragment derived from it. After filling the contract, parameters, request body, and responses, generate the fragment per [../openapi-output.md](../openapi-output.md) rather than hand-writing the schema twice.

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
| **Feature type** | API endpoint |
| **Status** | Draft |

Status values: Draft, Review, Approved, Implemented.

## Description

[2-4 sentences: what this endpoint does, who or what calls it, and why it exists.]

## Triggered by

| Trigger type | Source | Condition |
|---|---|---|
| [API call / Webhook / Scheduled / Called by feature] | [Client app, external service, cron, parent feature] | [When or under what condition] |

## Endpoint contract

| Field | Value |
|---|---|
| **Method** | [GET / POST / PUT / PATCH / DELETE] |
| **Path** | [/api/v1/resource/:id] |
| **Authentication** | [Required / Optional / None, with mechanism: JWT, API key, OAuth] |
| **Authorization** | [Required roles or permissions, or "None"] |
| **Rate limit** | [Requests per window, or "None"] |
| **Idempotent** | [Yes / No] |

### Path parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| [name] | [type] | [yes/no] | [description] |

### Query parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| [name] | [type] | [yes/no] | [default or "—"] | [description] |

### Request headers

| Header | Required | Description |
|---|---|---|
| [header name] | [yes/no] | [purpose, e.g. Content-Type, Authorization, X-Request-ID] |

### Request body

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| [field name] | [type] | [yes/no] | [min/max, regex, enum values] | [description] |

**Example request body:**

```json
{
  "field": "value"
}
```

## Required data

| Data | Source | Type | Notes |
|---|---|---|---|
| [Data element name] | [Request, database, config, upstream service] | [Data type] | [Constraints, validation rules, defaults] |

## Behavior

Each distinct behavior of the endpoint is a Requirement with Scenarios, covering the success path and every documented error path.

### Requirement: [Primary behavior, e.g. Create an order from a validated request]

The endpoint SHALL [action] [object] and return [status] with [response shape] when [condition].

#### Scenario: Valid request accepted

- **GIVEN** [the caller is authenticated and authorized]
- **AND** [the request body satisfies every constraint above]
- **WHEN** the caller sends [METHOD] [path]
- **THEN** the endpoint SHALL return [2xx status] with [response fields]
- **AND** the endpoint SHALL [persist the record / emit the event]

#### Scenario: Validation failure

- **GIVEN** [the caller is authenticated]
- **WHEN** the caller sends a request where [field] violates [constraint]
- **THEN** the endpoint SHALL return 400 with error code [error_code]
- **AND** the endpoint SHALL NOT [create, mutate, or emit anything]

#### Scenario: Unauthorized caller

- **GIVEN** the request carries no valid credential
- **WHEN** the caller sends [METHOD] [path]
- **THEN** the endpoint SHALL return 401 with error code `unauthorized`

#### Scenario: [Conflict, not found, or rate-limited case]

- **GIVEN** [the state that produces the conflict]
- **WHEN** the caller sends [METHOD] [path]
- **THEN** the endpoint SHALL return [409 / 404 / 429] with error code [error_code]
- **AND** the endpoint SHALL leave [resource state] unchanged

Repeat per behavior when the endpoint serves more than one (for example, a PATCH that both updates and transitions state).

## Algorithmic steps

Numbered processing logic from request received to response sent. Each step maps to a Scenario above.

1. Validate request [parameters / body / headers]
2. Authenticate and authorize the caller
3. [Core processing step]
4. [Core processing step]
5. Construct and return the response

## Response — Success

| Status | Content-Type | Body |
|---|---|---|
| [HTTP status code] | [application/json] | [Structure description] |

**Example success response:**

```json
{
  "id": "123",
  "status": "created"
}
```

## Response — Errors

| Status | Code | Message | When |
|---|---|---|---|
| 400 | [error_code] | [Human-readable message] | [Invalid input — name which validations] |
| 401 | unauthorized | Unauthorized | [Missing or invalid authentication] |
| 403 | forbidden | Forbidden | [Authenticated but insufficient permissions] |
| 404 | not_found | Resource not found | [Resource does not exist] |
| 409 | conflict | Conflict | [State conflict, e.g. duplicate, stale version] |
| 422 | validation_error | Validation failed | [Business rule violation — name which] |
| 429 | rate_limited | Too many requests | [Rate limit exceeded; include Retry-After] |
| 500 | internal_error | Internal server error | [Unexpected failure] |

**Example error response:**

```json
{
  "error": "error_code",
  "message": "Human-readable message",
  "details": {}
}
```

## Error handling

| Error condition | Handling strategy | Outcome |
|---|---|---|
| [Validation failure] | [Reject before any side effect] | [400 with field-level details; no state change] |
| [Rate limit exceeded] | [Reject with Retry-After] | [429; caller backs off] |
| [Downstream timeout] | [Retry with budget, then fail] | [504 or 502; no partial write] |
| [Downstream error] | [Map to a stable error code, log with correlation ID] | [5xx; operator alerted] |

## Events emitted

| Event name | Payload | Consumer(s) | When emitted |
|---|---|---|---|
| [event.name] | [Key fields in the payload] | [Which features or systems consume this] | [After which step or condition] |

## Output / Outcome

| Output | Type | Description |
|---|---|---|
| [Response to caller] | [HTTP response] | [What the caller receives on success] |
| [Side effects] | [Database write, cache update, event, notification] | [What else changes as a result] |

## OpenAPI fragment

Derived from the endpoint contract above. Generate per [../openapi-output.md](../openapi-output.md); keep it consistent with the tables rather than editing it independently.

```json
{
  "paths": {
    "/api/v1/resource/{id}": {
      "post": {
        "operationId": "createResource",
        "responses": {}
      }
    }
  }
}
```

## Traceability

| Requirement | Spec section | Verified by |
|---|---|---|
| [FR-NNN] | [Requirement: [primary behavior]] | [Contract test, integration test, or acceptance reference] |
| [NFR-NNN] | [Endpoint contract — rate limit / auth] | [Security review or load test reference] |
````
