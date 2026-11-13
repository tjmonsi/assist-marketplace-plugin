# Control Register: assist-plugin

**Purpose:** Map each harness-governance control to an OWASP Agentic AI Top 10 item (or a reasoned "not applicable"), to a NIST AI RMF function, to an owner role, to a review cadence with an escalation path, and to a status.

**Status:** Tranche 5 build. The row set is fixed by `specs/spec-governance-control-register.md` (Requirement: Control-ID row set and inclusion rule). Traces to FR-235 and FR-236 (`docs/requirements/FR-NFR-harness-governance.md` v1.3) and to NFR-028, NFR-033, and NFR-035.

**Scope of this file:** Because this file sits under `rules/`, a change to it is on the LLM surface and needs the OWASP for LLM gate (`llm-security-checklist.md`).

## Reference data and confidence

- **OWASP Top 10 for Agentic Applications 2026** (official title). The spec calls it the OWASP Agentic AI Top 10; it comes from the OWASP GenAI Security Project's Agentic Security Initiative, and ASI abbreviates Agentic Security Initiative. Identifiers run from ASI01 to ASI10, each with the `:2026` suffix: ASI01 Agent Goal Hijack, ASI02 Tool Misuse & Exploitation, ASI03 Identity and Privilege Abuse, ASI04 Agentic Supply Chain Vulnerabilities, ASI05 Unexpected Code Execution, ASI06 Memory & Context Poisoning, ASI07 Insecure Inter-Agent Communication, ASI08 Cascading Failures, ASI09 Human-Agent Trust Exploitation, ASI10 Rogue Agents.
- **The ASI mapping is directional (NFR-033).** The official publication was gated and the item names were cross-confirmed from secondary sources (medium-to-high confidence). Each ASI letter in the register is a reviewer's best fit, not an OWASP-certified mapping.
- **NIST AI RMF (NIST.AI.100-1, January 2023)** defines four functions: GOVERN, MAP, MEASURE, and MANAGE (high confidence). The register uses GOVERN, MEASURE, and MANAGE (FR-236). MAP (context framing) is covered by the requirements and user-requirements work, not by a runtime control row.
- **Estimates.** The quarterly cadence, the NFR-032 rotation size, and the NFR-034 precision bar are estimates. A review history may change them. Any fact that rests on a vendor source is directional (NFR-033).

## Schema

Each row carries seven fields in this order:

- `id`: a stable control id `CTL-NNN`, where NNN is the primary FR number the row covers.
- `Requirement IDs`: the FR IDs the control realizes: its own FR, plus any output-and-field-format FRs it carries.
- `OWASP Agentic (ASI)`: one ASI item (`ASI01` to `ASI10`, each with the `:2026` suffix), or "not applicable" followed by a reason in the same cell.
- `NIST AI RMF`: one of GOVERN, MEASURE, or MANAGE.
- `Owner role`: one role from the URD stakeholder set: plugin maintainer, plugin user, security lead, compliance officer, auditor.
- `Review cadence and escalation`: a cadence and an escalation path.
- `Status`: the control's settled status (see Per-regulation status).

## Owners and escalation

The owner is the role accountable for the control: security lead for the LLM-surface guards and the protected-path and register controls; plugin maintainer for the commit, gate, approval, and severity-policy controls; compliance officer for the attribution, profile, FERPA, and HIPAA controls; auditor for the hash-chain and verification controls.

The escalation path is the same on every row: an unresolved review finding goes to the owner first, then to the security lead. The default cadence is quarterly (estimate, FR-236).

## Row inclusion rule

A functional requirement in FR-214 to FR-247 is a control row when it mandates a guard (a deny or ask decision), a log or record the plugin writes, or a governance policy or mechanism the plugin runs. FR-240 (reviewer finding fields) and FR-241 (SARIF output) only fix a format that FR-239 consumes, so they appear in the Requirement IDs field of the CTL-239 row and have no row of their own. FR-235 and FR-236 together describe this register and share the CTL-235 row. No NFR is a row: each is cited inside the row it qualifies. The result is 31 rows, with no CTL-236, CTL-240, or CTL-241.

## Register

| id | Requirement IDs | OWASP Agentic (ASI, directional) | NIST AI RMF | Owner role | Review cadence and escalation | Status |
|---|---|---|---|---|---|---|
| CTL-214 | FR-214 | ASI01:2026 Agent Goal Hijack | MANAGE | security lead | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-215 | FR-215 | ASI02:2026 Tool Misuse & Exploitation | MANAGE | plugin maintainer | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-216 | FR-216 | ASI03:2026 Identity and Privilege Abuse | MEASURE | plugin maintainer | Quarterly (estimate); escalation: owner, then security lead | Active (health check ships; gap 3 closes on named-remote grants) |
| CTL-217 | FR-217 | ASI02:2026 Tool Misuse & Exploitation | MANAGE | plugin maintainer | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-218 | FR-218 | ASI08:2026 Cascading Failures | MANAGE | plugin maintainer | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-219 | FR-219 | ASI01:2026 Agent Goal Hijack | MANAGE | security lead | Quarterly (estimate); escalation: owner, then security lead | Active, advisory until promotion (blocking wired, enabled only by a user-run promotion; fails closed in blocking mode per NFR-028, fails open in advisory mode; severity-policy draft-2) |
| CTL-220 | FR-220 | ASI05:2026 Unexpected Code Execution | MANAGE | security lead | Quarterly (estimate); escalation: owner, then security lead | Active, advisory (blocking wired, enabled only by a user-run promotion; fails closed in blocking mode per NFR-028, fails open in advisory mode; severity-policy draft-2) |
| CTL-221 | FR-221 | ASI09:2026 Human-Agent Trust Exploitation | GOVERN | plugin maintainer | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-222 | FR-222 | ASI03:2026 Identity and Privilege Abuse | GOVERN | plugin maintainer | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-223 | FR-223 | ASI03:2026 Identity and Privilege Abuse | MANAGE | security lead | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-224 | FR-224 | ASI10:2026 Rogue Agents | MEASURE | auditor | Quarterly (estimate); escalation: owner, then security lead | Active (NFR-032 rotation size an estimate) |
| CTL-225 | FR-225 | ASI10:2026 Rogue Agents | MEASURE | auditor | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-226 | FR-226 | ASI03:2026 Identity and Privilege Abuse | MEASURE | compliance officer | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-227 | FR-227 | ASI03:2026 Identity and Privilege Abuse | MEASURE | compliance officer | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-228 | FR-228 | ASI10:2026 Rogue Agents | MEASURE | compliance officer | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-229 | FR-229 | not applicable (compliance-evidence export over the plugin's own hook logs; it reports on the controls and mitigates no specific agentic threat of its own) | MEASURE | compliance officer | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-230 | FR-230 | ASI03:2026 Identity and Privilege Abuse | MEASURE | compliance officer | Quarterly (estimate); escalation: owner, then security lead | Active, general FERPA governance support on the purpose dimension; cites no disclosure-recordation rule (directional, NFR-033) |
| CTL-231 | FR-231 | ASI06:2026 Memory & Context Poisoning | GOVERN | compliance officer | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-232 | FR-232 | ASI03:2026 Identity and Privilege Abuse | MEASURE | compliance officer | Quarterly (estimate); escalation: owner, then security lead | Verified against 45 CFR 164.312(b) as one required technical safeguard only; asserts no HIPAA compliance |
| CTL-233 | FR-233 | ASI02:2026 Tool Misuse & Exploitation | MANAGE | compliance officer | Quarterly (estimate); escalation: owner, then security lead | Active (NFR-028 fail-closed) |
| CTL-234 | FR-234 | ASI04:2026 Agentic Supply Chain Vulnerabilities | GOVERN | compliance officer | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-235 | FR-235, FR-236 | not applicable (a governance control-inventory and ownership mapping; a meta-governance artifact, not a runtime mitigation of a specific agentic threat) | GOVERN | security lead | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-237 | FR-237 | not applicable (a governance severity policy that defines the levels for this repo; the threat mitigation is in the rules it governs, FR-219 and FR-220) | GOVERN | plugin maintainer | Quarterly (estimate); escalation: owner, then security lead | Approved, advisory (severity-policy draft-2; a rule blocks only after the FR-238 baseline and a user-run promotion) |
| CTL-238 | FR-238 | not applicable (an advisory-baseline-first governance gate that bars blocking until a baseline and the precision bar are met; a process control) | GOVERN | plugin maintainer | Quarterly (estimate); escalation: owner, then security lead | Approved, advisory (NFR-034 precision bar an estimate) |
| CTL-239 | FR-239, FR-240, FR-241 | ASI05:2026 Unexpected Code Execution | MANAGE | plugin maintainer | Quarterly (estimate); escalation: owner, then security lead | Approved, advisory (blocks only at High confidence and HIGH or CRITICAL; active only after a promotion; severity-policy draft-2) |
| CTL-242 | FR-242 | ASI06:2026 Memory & Context Poisoning | MEASURE | security lead | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-243 | FR-243 | ASI06:2026 Memory & Context Poisoning | GOVERN | compliance officer | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-244 | FR-244 | ASI10:2026 Rogue Agents | MEASURE | compliance officer | Quarterly (estimate); escalation: owner, then security lead | Active |
| CTL-245 | FR-245 | ASI03:2026 Identity and Privilege Abuse | MANAGE | security lead | Quarterly (estimate); escalation: owner, then security lead | Active (six protected paths) |
| CTL-246 | FR-246 | ASI02:2026 Tool Misuse & Exploitation | MANAGE | compliance officer | Quarterly (estimate); escalation: owner, then security lead | To verify (34 CFR 99.32; NFR-028 fail-closed; exception handling pending review) |
| CTL-247 | FR-247 | ASI06:2026 Memory & Context Poisoning | MEASURE | compliance officer | Quarterly (estimate); escalation: owner, then security lead | Active |

## Control names

Each id resolves to the requirement title in `docs/requirements/FR-NFR-harness-governance.md`.

- CTL-214: Deny unconfirmed PR verdict
- CTL-215: No blanket staging
- CTL-216: Push grant scoped to named remotes
- CTL-217: Secret scan before commit
- CTL-218: Revision loop cap and escalation
- CTL-219: Goal-hijack guardrail
- CTL-220: Insecure generated code scan
- CTL-221: Evidence-backed gates
- CTL-222: Approval written by hook or orchestrator
- CTL-223: Shell write path closed
- CTL-224: Hash-chained audit log
- CTL-225: Chain verification command
- CTL-226: Per-agent identity
- CTL-227: Attribution record
- CTL-228: Logging from the first session
- CTL-229: Control evidence export
- CTL-230: FERPA internal access log
- CTL-231: Data-class tags
- CTL-232: HIPAA agent-level audit log
- CTL-233: PHI outbound guard
- CTL-234: BAA record
- CTL-235: OWASP Agentic mapping (FR-235) and NIST AI RMF mapping, ownership, and cadence (FR-236); this register
- CTL-237: Severity policy first
- CTL-238: Advisory baseline first
- CTL-239: Block only high-confidence, high-severity (FR-239), with the severity and routing fields (FR-240) and the SARIF output (FR-241)
- CTL-242: Confirmation recording
- CTL-243: Opt-out through committed settings only
- CTL-244: Disablement is logged and recorded
- CTL-245: Governance files and stores protected from subagents
- CTL-246: FERPA disclosure recordation
- CTL-247: Purpose-capture hook

## Per-regulation status

These statuses are settled (`DECISIONS.md`, "OQ-9 resolved; FERPA control reframed, HIPAA scope tightened"; NFR-033) and are not re-derived here.

- **HIPAA, CTL-232 (FR-232).** The row is verified against 45 CFR 164.312(b), which requires mechanisms that record and examine activity. It implements that one required technical safeguard. It asserts no HIPAA compliance: access control, integrity, authentication, transmission security, and the administrative and physical safeguards are separate.
- **FERPA internal log, CTL-230 (FR-230).** General FERPA governance support on the purpose dimension. The row carries no disclosure-recordation citation. The recordation duty covers disclosures to outside parties and belongs to CTL-246.
- **FERPA disclosure, CTL-246 (FR-246).** The only control cited against 34 CFR 99.32. The status stays "to verify" until its exception handling is reviewed, and the row is never marked "complete" before then. The control fails closed per NFR-028.
- **Severity-routing controls, CTL-219, CTL-220, CTL-237, CTL-238, CTL-239.** Approved but advisory, citing severity policy version draft-2 (`rules/severity-policy.md`). A rule blocks only after the FR-238 advisory baseline and a user-run promotion (`scripts/promote-rule.js`). CTL-219 and CTL-220 fail closed in blocking mode per NFR-028 and fail open in advisory mode.

## Maintenance

- The check script `scripts/check-control-register.js --check` validates this file: each row needs an ASI id or a reasoned "not applicable", a NIST function of GOVERN, MEASURE, or MANAGE, an owner, and a cadence. It also fails when the FR-230 row cites the FERPA disclosure-recordation section, or when the FR-232 row omits 45 CFR 164.312(b) or claims full HIPAA compliance. The FR-246 "to verify" status passes with a notice. The script does not enforce the 31-row set; the Step 41 tests do.
- Keep the register as the first table under the `## Register` heading. The script scopes to that heading and parses its first control table, so do not add another table above it under that heading.
- Keep the FR-230 row free of the disclosure-recordation citation and word the FR-232 status as it reads now; a rewrite that names a full-compliance phrase fails the check.
- Add a row when a new control requirement joins FR-214 to FR-247 and meets the inclusion rule, and update the Control names list with it. Review each row on its cadence; an unresolved finding goes to the owner, then to the security lead.
