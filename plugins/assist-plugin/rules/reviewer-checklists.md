# Reviewer Checklists: assist-plugin

**Purpose:** Hold one reviewer checklist for each of three review lanes (defect-depth, test-integrity, architecture-safety) and the table that assigns each lane to the existing review gates. Each item has an identifier, a check, and the evidence that clears it.

**Status:** DRAFT. The register content is the initial content of FR-288; nothing here ships before the user approves Group B (`docs/requirements/FR-NFR-harness-governance.md`, Group B, FR-288 to FR-316). Source: `specs/spec-reviewer-machinery.md`, Requirement 1. Traces to FR-288 and FR-291.

**Scope of this file:** Because this file sits under `rules/`, a change to it is on the LLM surface and needs the OWASP for LLM gate (`llm-security-checklist.md`) and `✓ LLM Security Clear` before merge. A change to the register content also needs a user-approved edit and a `DECISIONS.md` entry (FR-315).

## Reading the register

- `ID` is the stable item identifier. The prefix names the lane: `DD` for defect-depth, `TI` for test-integrity, `AS` for architecture-safety. A finding raised from an item carries that identifier as its rule identifier (FR-290).
- `Check` is what the reviewer verifies. `Evidence that clears it` is what the reviewer cites to clear the item.
- `Applies to` lists the artifact types the item covers. It uses only five canonical types: code, config, test, pipeline, planning document. An item applies to an artifact when the artifact's type is in the item's list.
- The register has no severity column. Severity is fixed by the severity catalog, which is held with `rules/severity-policy.md` and is not part of this file.

## Register

| ID | Lane | Check | Evidence that clears it | Applies to |
|----|------|-------|-------------------------|------------|
| DD-01 | defect-depth | Each loop, repeated pattern, or parse step over external text has an upper bound on input size or repeat count | The bound at file:line, or a finding that names the unbounded step | code |
| DD-02 | defect-depth | Parsed external data has an overall size bound in addition to any per-field or per-level cap | The bound at file:line | code |
| DD-03 | defect-depth | A cap that drops or cuts data rejects the input or marks the cut for the caller | The rejection or marker at file:line | code |
| DD-04 | defect-depth | Sanitizing runs on bounded input, and a cut cannot leave a split token that survives it | The order of bound and sanitize at file:line | code |
| DD-05 | defect-depth | Identifiers match ASCII-only classes, and URLs pass the project's existing safe-URL check, including userinfo and look-alike host forms | The check at file:line | code |
| DD-06 | defect-depth | A normalizer returns the same value when applied twice, and one input class has one error outcome | The code path or a test | code |
| DD-07 | defect-depth | Values that are compared or ordered share one time-zone treatment | The conversion at file:line | code |
| DD-08 | defect-depth | A schema change declares its lock limit and does not collide with another open change to the same revision sequence | The declaration at file:line | code, config |
| DD-09 | defect-depth | Pinned versions match the runtime the build targets and the declared ranges of sibling packages | The manifest lines | config |
| TI-01 | test-integrity | Each assertion fails when the behavior it guards is reverted | The reverted case, or a test that fails on it | test |
| TI-02 | test-integrity | The boundary value and the value on each side of it have a case | The cases at file:line | test |
| TI-03 | test-integrity | No assertion passes when the guarded value is empty or removed | The assertion text | test |
| TI-04 | test-integrity | Each test reaches the branch or option it names, and no default setup hides it | The setup at file:line | test |
| TI-05 | test-integrity | Each behavior a docstring, comment, or document claims matches the code and has a test | The claim and the test or code line | code, test, planning document |
| TI-06 | test-integrity | A count or list stated in prose is derived or checked, not hand-written | The check or the matching count | planning document |
| TI-07 | test-integrity | Validators and constraints agree with the contract the code states for them | The two lines compared | code |
| TI-08 | test-integrity | A test that replaces a boundary with a recorder is not the only proof of that boundary's behavior | A test against the real boundary | test |
| AS-01 | architecture-safety | In a multi-owner data model, every table, unique key, and relation carries the owner key | The schema lines | code, config |
| AS-02 | architecture-safety | An access policy is scoped to the account and resource it serves | The policy lines | config |
| AS-03 | architecture-safety | A credential is not written to a location that outlives the job | The write at file:line | config, pipeline |
| AS-04 | architecture-safety | The author of a control change is not its only approver | The change record | config, planning document |
| AS-05 | architecture-safety | A failed privacy or permission check denies the operation | The failure path at file:line | code |
| AS-06 | architecture-safety | Untrusted text that reaches rendered output cannot create a live control or link | The escaping at file:line | code |

## Lane-to-gate table

| Lane | Existing gates that apply it |
|------|------------------------------|
| defect-depth | Pre-Test Code Review Gate; Security Gate |
| test-integrity | Testing Gate (applied by `qa`, D-17); Code Review Gate |
| architecture-safety | Code Review Gate |

No new gate and no new cap is added. The cap of FR-218 and every gate bound stay unchanged. The `qa` agent owns applying the test-integrity lane in the Testing Gate (D-17 settled; `DECISIONS.md`, 2026-11-25).

## Validation

Run `node plugins/assist-plugin/scripts/check-reviewer-checklists.js --check`. It exits 1 when an item has no id, no check, or no evidence entry, when an applies-to value is outside the five canonical types, or when a lane is assigned to no existing gate. It prints item identifiers and lane names only.
