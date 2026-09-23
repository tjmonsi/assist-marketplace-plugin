# JSON Output Format

Machine-readable projection of a spec file, emitted with `--json` to `specs/spec-[feature-name].json`. The Markdown spec stays the source of truth.

A spec's own Requirements are numbered per file as `REQ-spec-NNN`. **These IDs are local to the spec file and are not globally unique.** The stable, globally meaningful identifiers are the `BR-NNN`, `UR-NNN`, `FR-NNN`, and `NFR-NNN` IDs from `gather-requirements`, which appear in `metadata.requirement_refs` and in each `traceability[].traces_to` entry.

## Schema

```json
{
  "metadata": {
    "feature_name": "...",
    "parent_feature": "spec-[parent].md or null",
    "sub_features": ["spec-[child1].md"],
    "requirement_refs": ["BR-001", "FR-045"],
    "feature_type": "Architecture|API|Frontend|Functionality|UI-UX|General",
    "status": "Draft|Review|Approved|Implemented"
  },
  "requirements": [
    {
      "id": "REQ-spec-001",
      "title": "Message routing from producer to consumer",
      "statement": "The system SHALL route messages from producer to consumer with exactly-once semantics.",
      "priority": "must|should|may",
      "scenarios": [
        {
          "name": "Successful delivery",
          "given": "...",
          "when": "...",
          "then": "..."
        }
      ]
    }
  ],
  "traceability": [
    {
      "requirement_id": "REQ-spec-001",
      "traces_to": ["FR-045", "NFR-012"],
      "verified_by": "integration test / design review / acceptance"
    }
  ],
  "change_log": [
    {
      "date": "YYYY-MM-DD",
      "source": "FR-052 added in FR-NFR-[slug].md v1.2",
      "added": ["REQ-spec-004"],
      "modified": ["REQ-spec-002"],
      "removed": ["REQ-spec-003"]
    }
  ]
}
```

## Field rules

| Field | Rule |
|---|---|
| `metadata.requirement_refs` | At least one entry, each matching `^(BR\|UR\|FR\|NFR)-\d{3,}$`. An empty array is invalid. |
| `metadata.feature_type` | One of the six classification values. Must match the template the Markdown used. |
| `requirements[].id` | `REQ-spec-NNN`, sequential in document order. Local to this file. |
| `requirements[].statement` | Carries exactly one RFC 2119 keyword in uppercase. |
| `requirements[].priority` | Derived from the keyword: `SHALL`/`MUST` → `must`, `SHOULD` → `should`, `MAY` → `may`. |
| `requirements[].scenarios` | At least one entry per requirement. Join multi-clause conditions with " AND ". |
| `traceability[].requirement_id` | A `REQ-spec-NNN` from this file. |
| `traceability[].traces_to` | The requirement IDs from `gather-requirements` output. Every ID here also appears in `metadata.requirement_refs`. |
| `traceability[].verified_by` | Names the verifying artifact (test suite, review, audit), not the requirement. |
| `change_log` | Present only when the spec has change log sections. IDs reference `requirements[].id`. |

## Example

```json
{
  "metadata": {
    "feature_name": "Webhook dispatcher",
    "parent_feature": null,
    "sub_features": ["spec-webhook-retry-policy.md"],
    "requirement_refs": ["FR-045", "NFR-012"],
    "feature_type": "Architecture",
    "status": "Draft"
  },
  "requirements": [
    {
      "id": "REQ-spec-001",
      "title": "Message routing from producer to consumer",
      "statement": "The system SHALL route each message from its producer to the registered consumer with at-least-once delivery.",
      "priority": "must",
      "scenarios": [
        {
          "name": "Successful delivery",
          "given": "a consumer is registered and healthy",
          "when": "a producer publishes a message to the topic",
          "then": "the system SHALL deliver the message within 5 seconds AND record the acknowledgement"
        },
        {
          "name": "Consumer unavailable",
          "given": "the registered consumer returns a 503 response",
          "when": "the system attempts delivery",
          "then": "the system SHALL retry with exponential backoff up to 5 attempts AND move the message to the dead-letter topic after the final attempt"
        }
      ]
    }
  ],
  "traceability": [
    {
      "requirement_id": "REQ-spec-001",
      "traces_to": ["FR-045", "NFR-012"],
      "verified_by": "integration test: routing suite"
    }
  ]
}
```

## Constraints

- Regenerate the JSON whenever the Markdown changes.
- Do not add requirements to the JSON that are absent from the Markdown.
- Never renumber `REQ-spec-NNN` within a file's lifetime; a removed requirement leaves a gap.
- For API endpoint specs, the OpenAPI fragment in [openapi-output.md](openapi-output.md) is a separate artifact; do not embed it in this JSON.
