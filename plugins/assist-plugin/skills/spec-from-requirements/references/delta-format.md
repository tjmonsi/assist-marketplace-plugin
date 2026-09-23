# Delta Format

`delta` mode records an incremental change to an existing spec without rewriting the file. It uses the ADDED/MODIFIED/REMOVED convention.

## When to use delta instead of create

| Situation | Mode |
|---|---|
| New feature, no spec file exists | `create` |
| Existing spec, a requirement changed or was added | `delta` |
| Existing spec, the feature was redesigned end to end | `create` (overwrite), keeping prior change log entries as history |
| Existing spec, only the Status field changes | Direct edit; no delta needed |
| Existing spec, a typo or wording fix with no behavior change | Direct edit; no delta needed |

A delta records a change in **behavior**. Editorial changes do not earn a change log entry.

## Where the delta goes

This plugin keeps specs flat in `specs/spec-[feature-name].md`. There is no separate `changes/` tree. A delta is appended to the bottom of the same spec file as a change log section:

```markdown
## Change Log — 2026-09-24

**Source:** [FR-052 added, FR-045 revised in FR-NFR-order-checkout.md v1.2]

### ADDED Requirements

#### Requirement: Guest checkout without an account

The checkout service SHALL accept an order from an unauthenticated session when a valid email address is supplied.

##### Scenario: Guest order accepted

- **GIVEN** an unauthenticated session with a cart containing at least one item
- **WHEN** the shopper submits the order with a valid email address
- **THEN** the checkout service SHALL create the order AND return its identifier

##### Scenario: Invalid email rejected

- **GIVEN** an unauthenticated session with a cart containing at least one item
- **WHEN** the shopper submits the order with an email that fails RFC 5322 validation
- **THEN** the checkout service SHALL reject the order with a validation error
- **AND** the checkout service SHALL leave the cart unchanged

### MODIFIED Requirements

#### Requirement: Order submission latency

**Was:** The checkout service SHALL complete order submission within 1200ms at p95.
**Now:** The checkout service SHALL complete order submission within 800ms at p95 under 500 concurrent sessions.
**Reason:** NFR-001 tightened in FR-NFR-order-checkout.md v1.2.

##### Scenario: Submission under load

- **GIVEN** 500 concurrent checkout sessions
- **WHEN** a shopper submits an order
- **THEN** the checkout service SHALL return a response within 800ms at p95

### REMOVED Requirements

#### Requirement: Saved payment methods for guests

**Reason:** Deferred to phase 2; guest checkout stores no account data.
**Requirement ref:** FR-048, marked out of scope in FR-NFR-order-checkout.md v1.2.
**Migration:** [What happens to existing data or callers, or "None — never implemented"]
```

## Rules

1. **Date the section.** `## Change Log — YYYY-MM-DD`. One section per change event; do not merge two unrelated changes under one date.
2. **Name the source.** Cite the requirement IDs (`BR/UR/FR/NFR-NNN`) and the document version that triggered the change. A delta with no requirement source is a design change in disguise; get it approved as a requirement first.
3. **Use the same Scenario format** as the main body: `#### Requirement:` with `##### Scenario:` GIVEN/WHEN/THEN blocks, one heading level deeper than the main body's Requirements so the change log nests under its own section.
4. **MODIFIED shows both sides.** `Was:` and `Now:` plus a one-line reason. A modification without the old text is unreviewable.
5. **REMOVED states the consequence.** Reason, the requirement ref that retired it, and what happens to existing data or callers.
6. **Update Status.** A spec receiving a delta returns to `Review` unless the user approves the change in the same turn.
7. **Update Requirement refs.** Add newly satisfied IDs to the metadata block; keep removed ones with a `(removed YYYY-MM-DD)` note rather than deleting the trace.
8. **Do not silently edit the main body** in delta mode. The delta is the record of what changed.

## Folding a delta into the main body

On the next `create` pass over the same feature:

1. Apply every ADDED Requirement into the matching template section.
2. Replace the modified statements and scenarios with their `Now:` versions.
3. Delete the removed Requirements from the body.
4. **Keep the change log sections in place.** They are the file's history. Add a line at the top of each folded section: `Folded into the main body on YYYY-MM-DD.`
5. Bump the spec's Status to `Draft` and re-run `review`.

## Multiple deltas before a fold

Change log sections accumulate newest-last. When two deltas touch the same Requirement, the later one wins, and its `Was:` text must match the earlier delta's `Now:` text. A mismatch means one delta was written against stale content; reconcile before folding.
