# FR+NFR Template

Use this template when producing the combined functional and non-functional requirements output file via `/gather-requirements document`.

Fill **Author** from `git config user.name`. If that is unavailable, leave `[Author]` for the user to complete. Never hardcode a name.

---

## [Project Name] — Functional and Non-Functional Requirements

**Version:** [1.0]
**Date:** [YYYY-MM-DD]
**Author:** [Author]
**Status:** DRAFT | REVIEW | APPROVED

---

### 1. Introduction

**Purpose:** [What this document specifies — system behaviors and quality attributes]

**Relationship to URD:** This document derives from [URD-<project-slug>.md]. Every functional requirement traces to at least one user requirement.

**Relationship to BRD:** Non-functional requirements may trace directly to business requirements when they originate from regulatory, compliance, or organizational policy.

**Binding language:** `SHALL`/`MUST` = mandatory, `SHOULD` = recommended, `MAY` = optional (RFC 2119). The keyword appears in uppercase inside every FR and NFR statement.

### 2. Functional requirements

Each requirement uses the IEEE 29148 canonical form:

> The [system] SHALL [action verb] [object] [qualifying conditions].

Or the conditional form:

> When [condition], the [system/component] SHALL [action] [object] [performance measure].

| ID | Requirement | Traces to | Priority | Acceptance criteria |
|----|-------------|-----------|----------|---------------------|
| FR-001 | The [system] SHALL [action] [object] [conditions]. | UR-NNN | Must/Should/May | See scenarios under 2.1 |

Acceptance criteria are not prose. Each FR gets one or more `#### Scenario:` blocks below, in GIVEN/WHEN/THEN form. The table's last column points at them.

#### 2.1 FR-001 — [Short title]

**Statement:** The [system] SHALL [action] [object] [conditions].
**Traces to:** UR-NNN
**Priority:** Must | Should | May

##### Scenario: [Happy path name]

- **GIVEN** [initial state and preconditions]
- **WHEN** [the triggering action occurs]
- **THEN** the [system] SHALL [observable outcome]
- **AND** [additional observable outcome, if any]

##### Scenario: [Error or edge case name]

- **GIVEN** [initial state that makes the operation invalid]
- **WHEN** [the triggering action occurs]
- **THEN** the [system] SHALL [rejection or recovery behavior]
- **AND** [what the caller or user sees]

Repeat section 2.1 per functional requirement (2.2 for FR-002, and so on). Each FR needs at least one happy path and one failure path. If no scenario can be written, the requirement is not yet testable; return it to elicitation instead of guessing the outcome.

### 3. Non-functional requirements

Each requirement uses the form:

> The [system/component] SHALL [quality attribute] [measurable threshold] [under conditions].

Every NFR carries a number. Verify the threshold is measurable before writing it down.

#### 3.1 Performance

| ID | Requirement | Traces to | Metric |
|----|-------------|-----------|--------|
| NFR-001 | The system SHALL [performance target]. | FR-NNN / BR-NNN | [Measurable target] |

#### 3.2 Security

| ID | Requirement | Traces to | Standard/Compliance |
|----|-------------|-----------|---------------------|
| NFR-NNN | The system SHALL [security requirement]. | BR-NNN | [Standard] |

#### 3.3 Reliability and availability

| ID | Requirement | Traces to | Metric |
|----|-------------|-----------|--------|
| NFR-NNN | The system SHALL [reliability target]. | FR-NNN | [Measurable target] |

#### 3.4 Usability

| ID | Requirement | Traces to | Metric |
|----|-------------|-----------|--------|
| NFR-NNN | The system SHOULD [usability target]. | UR-NNN | [Task completion metric] |

#### 3.5 Scalability

| ID | Requirement | Traces to | Metric |
|----|-------------|-----------|--------|
| NFR-NNN | The system SHALL [scalability target]. | BR-NNN | [Capacity target] |

#### 3.6 Compliance

| ID | Requirement | Traces to | Regulation/Standard |
|----|-------------|-----------|---------------------|
| NFR-NNN | The system MUST [compliance requirement]. | BR-NNN | [Regulation] |

Add or remove NFR categories as appropriate. Not all categories apply to every project.

An NFR that constrains observable behavior (a timeout, a rate limit, a retention window) also gets a scenario, written in the same GIVEN/WHEN/THEN form as section 2.1.

### 4. Scope

#### In scope (system behaviors)

- [System capability included in this release]

#### Out of scope (system exclusions)

| Excluded item | Reason | Deferred to |
|---------------|--------|-------------|
| [System behavior excluded] | [Why] | [Phase/version/never] |

### 5. Constraints

- [Technical constraint — platform, language, integration]
- [Interface constraint — external systems, APIs]

### 6. Traceability matrix

| BR | UR | FR | NFR | Status |
|----|----|----|-----|--------|
| BR-001 | UR-001 | FR-001, FR-002 | NFR-001 | Draft |
| BR-002 | UR-003 | FR-005 | NFR-003 | Draft |

Orphans (a requirement with no parent) and dead ends (a BR with no derived UR) are listed below the matrix with the reason they exist.

### 7. Glossary

| Term | Definition |
|------|-----------|
| [Term] | [Definition] |

### 8. Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [date] | [Author] | Initial draft |
