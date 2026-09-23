# JSON Output Format

Machine-readable projection of the requirements produced by `/gather-requirements document --json`. Written to `requirements-<project-slug>.json`.

The Markdown documents remain the source of truth. The JSON carries the same requirement IDs, statements, traceability links, and scenarios so that downstream tools (test generators, spec writers, ticket importers) do not have to parse prose.

## Schema

```json
{
  "project_name": "...",
  "version": "1.0",
  "date": "YYYY-MM-DD",
  "status": "draft|review|approved",
  "requirements": [
    {
      "id": "BR-001",
      "type": "business|user|functional|nonfunctional",
      "text": "To [achieve goal], the business must [outcome]",
      "priority": "must|should|may",
      "category": "performance|security|reliability|usability|scalability|compliance|null",
      "stakeholder": "role or group, or null",
      "traces_to": ["BR-001"],
      "scenarios": [
        {
          "name": "Happy path / error case",
          "given": "...",
          "when": "...",
          "then": "..."
        }
      ]
    }
  ],
  "traceability": [
    {
      "requirement_id": "FR-001",
      "traces_to": ["UR-001", "BR-001"],
      "verified_by": "acceptance test / review / requirements doc section"
    }
  ],
  "out_of_scope": [
    {
      "item": "...",
      "reason": "...",
      "deferred_to": "phase/version/never"
    }
  ],
  "open_questions": ["..."]
}
```

## Field rules

| Field | Rule |
|---|---|
| `id` | Matches `^(BR\|UR\|FR\|NFR)-\d{3,}$`. Unique across the file. |
| `type` | Must agree with the `id` prefix: `BR` → `business`, `UR` → `user`, `FR` → `functional`, `NFR` → `nonfunctional`. |
| `text` | The full requirement sentence, RFC 2119 keyword included in uppercase for `functional` and `nonfunctional` entries. |
| `priority` | Derived from the keyword: `SHALL`/`MUST` → `must`, `SHOULD` → `should`, `MAY` → `may`. |
| `category` | Required for `nonfunctional`; `null` otherwise. |
| `stakeholder` | Required for `user`; `null` otherwise. |
| `traces_to` | Empty array only for `business` requirements. A non-business requirement with an empty array is an orphan and must also appear in the review report. |
| `scenarios` | At least one entry for every `functional` requirement. `given`/`when`/`then` are single strings; join multi-clause conditions with " AND ". |
| `verified_by` | Names the artifact that proves the requirement, not the requirement itself. |

## Example

```json
{
  "project_name": "Order Checkout",
  "version": "1.0",
  "date": "2026-09-24",
  "status": "draft",
  "requirements": [
    {
      "id": "BR-001",
      "type": "business",
      "text": "To reduce cart abandonment, the business must offer guest checkout.",
      "priority": "must",
      "category": null,
      "stakeholder": null,
      "traces_to": [],
      "scenarios": []
    },
    {
      "id": "UR-001",
      "type": "user",
      "text": "The shopper shall be able to complete a purchase without creating an account.",
      "priority": "must",
      "category": null,
      "stakeholder": "Shopper",
      "traces_to": ["BR-001"],
      "scenarios": []
    },
    {
      "id": "FR-001",
      "type": "functional",
      "text": "The checkout service SHALL accept an order from an unauthenticated session when a valid email address is supplied.",
      "priority": "must",
      "category": null,
      "stakeholder": null,
      "traces_to": ["UR-001"],
      "scenarios": [
        {
          "name": "Guest order accepted",
          "given": "an unauthenticated session with a cart containing at least one item",
          "when": "the shopper submits the order with a valid email address",
          "then": "the checkout service SHALL create the order AND return its identifier"
        },
        {
          "name": "Invalid email rejected",
          "given": "an unauthenticated session with a cart containing at least one item",
          "when": "the shopper submits the order with an email address that fails RFC 5322 validation",
          "then": "the checkout service SHALL reject the order with a validation error AND leave the cart unchanged"
        }
      ]
    },
    {
      "id": "NFR-001",
      "type": "nonfunctional",
      "text": "The checkout service SHALL complete order submission within 800ms at p95 under 500 concurrent sessions.",
      "priority": "must",
      "category": "performance",
      "stakeholder": null,
      "traces_to": ["FR-001"],
      "scenarios": []
    }
  ],
  "traceability": [
    {
      "requirement_id": "FR-001",
      "traces_to": ["UR-001", "BR-001"],
      "verified_by": "acceptance test: guest checkout suite"
    },
    {
      "requirement_id": "NFR-001",
      "traces_to": ["FR-001"],
      "verified_by": "load test report"
    }
  ],
  "out_of_scope": [
    {
      "item": "Saved payment methods for guests",
      "reason": "Requires account storage, which guest checkout avoids",
      "deferred_to": "phase 2"
    }
  ],
  "open_questions": [
    "Does guest checkout need to support promotional codes at launch?"
  ]
}
```

## Constraints

- Regenerate the JSON whenever the Markdown changes. Never edit one without the other.
- Do not add requirements to the JSON that are absent from the Markdown.
- Keep IDs stable across regenerations; the JSON is what downstream tools key on.
