# Requirements Quality Checklist

Evaluate each requirement against these criteria. Based on IEEE 29148, BABOK 3.0, and INCOSE guidelines.

## Per-requirement criteria

| # | Criterion | Test | Fail example | Fix |
|---|-----------|------|-------------|-----|
| 1 | **Necessary** | Does it trace to a business need? | "The system shall log all mouse movements" (no business justification) | Remove or justify with a traced BR |
| 2 | **Unambiguous** | Does it have exactly one interpretation? | "The system shall respond quickly" | "The system SHALL respond within 200ms at p95" |
| 3 | **Testable** | Can it be objectively verified? | "The system shall be user-friendly" | "95% of users SHALL complete onboarding in under 3 minutes" |
| 4 | **Feasible** | Can it be implemented within known constraints? | "The system shall achieve 100% uptime" | "The system SHALL achieve 99.9% uptime" |
| 5 | **Complete** | Are all conditions, exceptions, and ranges specified? | "The system shall validate input" (which input? what validation?) | "The system SHALL reject email inputs that do not match RFC 5322 format" |
| 6 | **Consistent** | Does it contradict any other requirement? | FR-003 says "JSON only" but FR-007 says "accept XML" | Resolve the contradiction, choose one |
| 7 | **Singular** | Does it state exactly one requirement? | "The system shall log events and send alerts" | Split into two: one for logging, one for alerts |
| 8 | **Implementation-free** | Does it describe what, not how? | "The system shall use PostgreSQL" | "The system SHALL persist data in a relational store" (unless the technology is a genuine constraint) |
| 9 | **Traceable** | Does it have a unique ID and links to parent/child requirements? | Unlabeled requirement in prose | Assign ID, link to parent UR/BR |

## Banned words

These words signal ambiguity. If found in a requirement, flag for revision:

| Word | Problem | Alternative |
|------|---------|-------------|
| fast, quick, slow | Not measurable | Specify time: "within N ms/s" |
| easy, simple, intuitive | Subjective | Specify task completion metric |
| efficient | Vague | Specify resource usage target |
| flexible, scalable | Undefined dimension | Specify what scales and to what limit |
| support | Ambiguous scope | Specify exact capability |
| appropriate, reasonable | Subjective judgment | Specify criteria |
| etc., and so on | Incomplete list | Enumerate all items or define the category |
| minimize, maximize | No target | Specify threshold |
| user-friendly | Subjective | Specify usability metric (task time, error rate) |

## Document-level criteria

| # | Criterion | Test |
|---|-----------|------|
| 1 | **Complete coverage** | Are BR, UR, FR, and NFR sections all present? |
| 2 | **Scope defined** | Are in-scope and out-of-scope sections present with rationale? |
| 3 | **Traceability** | Does every FR → UR → BR chain exist? Are there orphans? |
| 4 | **No contradictions** | Do any requirements conflict with each other? |
| 5 | **Sequential IDs** | Are requirement IDs sequential with no gaps or duplicates? |
| 6 | **Consistent language** | Is SHALL/SHOULD/MAY used consistently per binding level, in uppercase? |
| 7 | **Scenario coverage** | Does every FR have at least one GIVEN/WHEN/THEN scenario, including a failure path? |
| 8 | **Glossary present** | Are domain terms defined? |
