# Requirements Review

Review existing requirements for quality, completeness, and consistency. Used by `/gather-requirements review`.

## Inputs

- `$1+` — Path to a requirements document (BRD, URD, FR-NFR, SRS, or similar)
- If no argument: scan the working directory for `BRD-*.md`, `URD-*.md`, `FR-NFR-*.md`, or other requirements files

## Six-step process

### 1. Load requirements

Read the target document. Extract every requirement statement, identified by its ID (`BR-NNN`, `UR-NNN`, `FR-NNN`, `NFR-NNN`).

### 2. Individual quality check

Evaluate each requirement against [quality-checklist.md](quality-checklist.md). Flag violations with the criterion name and a concrete replacement, not a general complaint.

### 3. Completeness check

- Are all requirement types present (BR, UR, FR, NFR)?
- Is scope defined, both in-scope and out-of-scope?
- Are success criteria defined?
- Are constraints and assumptions documented?
- Does every FR have at least one GIVEN/WHEN/THEN scenario, including a failure path?

### 4. Consistency check

- Scan for contradictions between requirements.
- Check for duplicate or overlapping requirements.
- Verify ID numbering is sequential with no gaps or duplicates.
- Verify RFC 2119 keywords are used in uppercase and one per requirement.

### 5. Traceability check

- Does every FR trace to a UR?
- Does every UR trace to a BR?
- Are there orphan requirements with no traceability link?
- Are there business requirements with no derived lower-level requirements?

### 6. Report

```markdown
### Requirements Review: [Document name]

**Summary:** [N] requirements reviewed, [M] issues found

**Quality findings:**

| # | Req ID | Issue | Criterion violated | Suggestion |
|---|--------|-------|--------------------|------------|
| 1 | FR-003 | "fast" is not measurable | Testable | Specify target: "within 200ms at p95" |

**Completeness:** COMPLETE / GAPS FOUND
- [Missing elements]

**Consistency:** CONSISTENT / CONFLICTS FOUND
- [Contradictions]

**Traceability:** COMPLETE / GAPS FOUND
- [Orphan requirements]

**Verdict:** PASS / NEEDS REVISION
```

`NEEDS REVISION` requires at least one critical finding (ambiguous, contradictory, untestable, or untraceable). Style and formatting issues alone do not block a PASS; list them separately.

## Constraints

- Do not modify the document. Review only.
- Do not invent missing requirements. Flag them as gaps.
- Distinguish critical issues (ambiguous, contradictory, untraceable) from minor ones (style, formatting).
- Cite the requirement ID and the document section for every finding.
