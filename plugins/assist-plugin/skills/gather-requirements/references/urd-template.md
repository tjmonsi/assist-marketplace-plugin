# URD Template

Use this template when producing the URD output file via `/gather-requirements document`.

Fill **Author** from `git config user.name`. If that is unavailable, leave `[Author]` for the user to complete. Never hardcode a name.

---

## [Project Name] — User Requirements Document

**Version:** [1.0]
**Date:** [YYYY-MM-DD]
**Author:** [Author]
**Status:** DRAFT | REVIEW | APPROVED

---

### 1. Introduction

**Purpose:** [What this document captures — user and stakeholder needs]

**Relationship to BRD:** This document derives from [BRD-<project-slug>.md]. Every user requirement traces to at least one business requirement.

### 2. Stakeholder map

| Stakeholder | Role | Goals | Pain points | Priority |
|-------------|------|-------|-------------|----------|
| [Name/Group] | [Role in system] | [What they need to accomplish] | [Current frustrations] | High/Medium/Low |

### 3. User requirements

Each requirement uses one of these sentence templates:

**Shall-statement form:**
> The [user/role] shall be able to [accomplish goal] [qualifying condition].

**User story form (alternative):**
> As a [role], I want to [goal] so that [business value].

| ID | Requirement | Stakeholder | Traces to | Priority |
|----|-------------|-------------|-----------|----------|
| UR-001 | The [user/role] shall be able to [goal] [condition]. | [who] | BR-NNN | Must/Should/May |

### 4. Use case summaries

For complex user requirements, provide abbreviated use case summaries:

#### UC-NNN — [Active-verb goal phrase]

- **Primary actor:** [Role]
- **Precondition:** [What must be true before]
- **Success guarantee:** [What is true when goal is achieved]
- **Main scenario:** [3-5 step summary]
- **Key extensions:** [Notable alternate paths]

### 5. Scope

#### In scope (user-facing capabilities)

- [Capability the user will have access to]

#### Out of scope (user-facing exclusions)

| Excluded item | Reason | Deferred to |
|---------------|--------|-------------|
| [User-facing capability excluded] | [Why] | [Phase/version/never] |

### 6. Assumptions

- [Assumption about user behavior, environment, or context]

### 7. Open questions

- [Unresolved items requiring stakeholder input]

### 8. Glossary

| Term | Definition |
|------|-----------|
| [Term] | [Definition] |

### 9. Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [date] | [Author] | Initial draft |
