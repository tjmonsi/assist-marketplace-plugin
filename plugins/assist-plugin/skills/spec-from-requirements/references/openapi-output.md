# OpenAPI Output

For an **API endpoint** spec, derive an OpenAPI 3.1 path-item fragment from the endpoint contract already filled in the template. The Markdown tables are the source of truth; the fragment is generated from them, never maintained in parallel.

## When to generate

- The classification is API endpoint, and
- `--json`/`--openapi` was requested, or the repo already keeps an OpenAPI document that this endpoint belongs in.

Emit the fragment inside the spec's **OpenAPI fragment** section, and to `specs/openapi/[feature-name].json` when the repo has an OpenAPI document to merge into.

## Field mapping

| Spec source | OpenAPI target |
|---|---|
| Endpoint contract → Method | The path-item key (`get`, `post`, `put`, `patch`, `delete`) |
| Endpoint contract → Path | The `paths` key, with `:id` rewritten to `{id}` |
| Endpoint contract → Authentication | `security`, referencing a scheme in `components.securitySchemes` |
| Endpoint contract → Rate limit | `x-rate-limit` extension, plus the 429 response |
| Endpoint contract → Idempotent | `x-idempotent` extension, plus the `Idempotency-Key` header when one is used |
| Path parameters table | `parameters` entries with `"in": "path"`, `required: true` |
| Query parameters table | `parameters` entries with `"in": "query"`, `required` and `schema.default` from the table |
| Request headers table | `parameters` entries with `"in": "header"` |
| Request body table | `requestBody.content["application/json"].schema` with `properties` and `required` |
| Request body constraints column | `minLength`, `maxLength`, `minimum`, `maximum`, `pattern`, `enum`, `format` |
| Example request body | `requestBody.content["application/json"].example` |
| Response — Success | The 2xx entry under `responses`, with the example attached |
| Response — Errors table | One `responses` entry per status, each referencing the shared error schema |
| Feature name | `operationId` in camelCase, and `summary` from the Description's first sentence |
| Requirement refs | `x-requirement-refs`, the array of `BR/UR/FR/NFR-NNN` IDs, so traceability survives into the generated artifact |

Every error row in the spec becomes a response entry. An endpoint whose spec lists a 409 but whose fragment omits it is a review CRITICAL finding.

## Example

Endpoint contract: `POST /api/v1/orders`, JWT required, rate limit 60/min, idempotent via `Idempotency-Key`.

```json
{
  "openapi": "3.1.0",
  "paths": {
    "/api/v1/orders": {
      "post": {
        "operationId": "createOrder",
        "summary": "Create an order from a validated cart",
        "x-requirement-refs": ["FR-001", "NFR-001"],
        "x-rate-limit": "60/minute",
        "x-idempotent": true,
        "security": [{ "bearerAuth": [] }],
        "parameters": [
          {
            "name": "Idempotency-Key",
            "in": "header",
            "required": false,
            "schema": { "type": "string", "format": "uuid" },
            "description": "Replays return the original response."
          },
          {
            "name": "expand",
            "in": "query",
            "required": false,
            "schema": { "type": "string", "enum": ["items", "customer"] },
            "description": "Expand a related object in the response."
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["cart_id", "email"],
                "properties": {
                  "cart_id": { "type": "string", "format": "uuid" },
                  "email": { "type": "string", "format": "email", "maxLength": 254 },
                  "note": { "type": "string", "maxLength": 500 }
                }
              },
              "example": {
                "cart_id": "9f1c2b0e-0f1a-4d3b-9e77-2a5c1d8e4f01",
                "email": "buyer@example.com"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Order created.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": ["id", "status"],
                  "properties": {
                    "id": { "type": "string" },
                    "status": { "type": "string", "enum": ["created"] }
                  }
                },
                "example": { "id": "123", "status": "created" }
              }
            }
          },
          "400": {
            "description": "Validation failed.",
            "content": {
              "application/json": { "schema": { "$ref": "#/components/schemas/Error" } }
            }
          },
          "401": {
            "description": "Missing or invalid credential.",
            "content": {
              "application/json": { "schema": { "$ref": "#/components/schemas/Error" } }
            }
          },
          "409": {
            "description": "Cart already converted to an order.",
            "content": {
              "application/json": { "schema": { "$ref": "#/components/schemas/Error" } }
            }
          },
          "429": {
            "description": "Rate limit exceeded.",
            "headers": {
              "Retry-After": { "schema": { "type": "integer" } }
            },
            "content": {
              "application/json": { "schema": { "$ref": "#/components/schemas/Error" } }
            }
          },
          "500": {
            "description": "Unexpected failure.",
            "content": {
              "application/json": { "schema": { "$ref": "#/components/schemas/Error" } }
            }
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearerAuth": { "type": "http", "scheme": "bearer", "bearerFormat": "JWT" }
    },
    "schemas": {
      "Error": {
        "type": "object",
        "required": ["error", "message"],
        "properties": {
          "error": { "type": "string" },
          "message": { "type": "string" },
          "details": { "type": "object", "additionalProperties": true }
        }
      }
    }
  }
}
```

## Constraints

- Do not invent fields absent from the spec tables. A gap in the fragment means a gap in the spec; fix the spec.
- Keep `components.schemas.Error` shared across endpoints in the same repo rather than redefining it per fragment.
- YAML is acceptable when the repo's existing OpenAPI document is YAML. Keep one format per repo.
- Regenerate the fragment whenever the contract tables change.
