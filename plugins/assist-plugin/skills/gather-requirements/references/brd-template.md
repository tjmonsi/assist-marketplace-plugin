# BRD Template

Use this template when producing the BRD output file via `/gather-requirements document`.

Fill **Author** from `git config user.name`. If that is unavailable, leave `[Author]` for the user to complete. Never hardcode a name.

---

## [Project Name] — Business Requirements Document

**Version:** [1.0]
**Date:** [YYYY-MM-DD]
**Author:** [Author]
**Status:** DRAFT | REVIEW | APPROVED

---

### 1. Introduction

**Purpose:** [Why this document exists — what business problem or opportunity it addresses]

**Project overview:** [Brief description of the initiative]

### 2. Stakeholders

| Role | Name/Group | Interest | Influence |
|------|-----------|----------|-----------|
| [Business owner] | [name] | [what they care about] | High/Medium/Low |
| [End user] | [group] | [what they need] | High/Medium/Low |

### 3. Business requirements

Each requirement uses the sentence template:
> To [achieve organizational goal], the business must [deliver/accomplish] [strategic outcome].

| ID | Requirement | Priority | Success criteria |
|----|-------------|----------|-----------------|
| BR-001 | To [goal], the business must [outcome]. | Must/Should/May | [How to verify] |

### 4. Scope

#### In scope

- [Included capability] — [brief rationale]

#### Out of scope

| Excluded item | Reason | Deferred to |
|---------------|--------|-------------|
| [Item] | [Why excluded] | [Phase/version/never] |

### 5. Constraints

- [Business constraint — budget, timeline, organizational]
- [Regulatory constraint — compliance, legal]
- [Technical constraint — if imposed by business policy]

### 6. Assumptions

- [Assumption 1 — what we are taking as given]
- [Assumption 2]

### 7. Success criteria

| ID | Criterion | Measurement | Target |
|----|-----------|-------------|--------|
| SC-001 | [What success looks like] | [How measured] | [Threshold] |

### 8. Glossary

| Term | Definition |
|------|-----------|
| [Term] | [Definition] |

### 9. Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [date] | [Author] | Initial draft |
