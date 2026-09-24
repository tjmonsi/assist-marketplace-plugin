# Specification Validation Rules for Task Planning

A specification is ready for task planning only if all acceptance criteria are present.

## Gate: Acceptance Criteria Presence

**Rule:** Every `### Requirement:` block must have at least one `#### Scenario:` subsection.

### Check

For each requirement in the spec:
1. Locate the line starting `### Requirement:`
2. Search forward for the next `#### Scenario:` at the same indentation level
3. If found before the next `### Requirement:` or end of document, the requirement has scenarios — pass
4. If not found or comes after the next requirement, the requirement lacks scenarios — fail

### Failure Output

Report each failing requirement:

```
Specification incomplete

Requirement [SPEC-NNN | FR-NNN]: "[Requirement title]"
at line [N] in [file path]

Has no acceptance criteria scenarios.

Resolution: Add at least one `#### Scenario:` block under this requirement. 
Reference: [gather-requirements skill](../gather-requirements/SKILL.md) for scenario format (GIVEN/WHEN/THEN).
```

Do not proceed to task planning until all requirements have scenarios.

### Success Output

```
Specification validated: [Spec file path]
- [N] requirements
- [M] scenarios across [M] requirements
Ready for task planning.
```

## Scenario Format Check (Optional, Informational)

After all requirements pass the presence gate, optionally check scenario quality:

| Check | Pattern | Result |
|---|---|---|
| Has GIVEN clause | `**GIVEN**` followed by a condition | Report if missing |
| Has WHEN clause | `**WHEN**` followed by an action | Report if missing |
| Has THEN clause | `**THEN**` followed by an outcome | Report if missing |

These are warnings, not blockers. A spec can proceed to planning even if some scenarios lack full GIVEN/WHEN/THEN structure, as long as they are present.

## Sourcing Requirement IDs

Accepted ID patterns for `Satisfies` citations:

- `SPEC-NNN` — Specification ID (this spec file's numbering)
- `FR-NNN` — Functional requirement (from requirements document)
- `NFR-NNN` — Non-functional requirement (from requirements document)
- `UC-NNN` — Use case ID (if the spec defines use cases)
- `AC-N` — Acceptance criterion number within a scenario

Invalid patterns (do not use):
- `REQ-NNN`, `SEC-NNN`, `CON-NNN` — legacy scheme, not used in assist-plugin
- Invented numbers not present in the target document

## Rejection Criteria

Halt task planning if:
1. Specification file does not exist or is unreadable
2. Specification has no requirements (empty `### Requirement:` blocks)
3. One or more requirements lack acceptance criteria scenarios
4. Target language cannot be detected from arguments or codebase
