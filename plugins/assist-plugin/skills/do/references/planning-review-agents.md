# Planning Document Review Agents

Reference guide for agents that produce documents subject to the Planning Document Review Gate.

See [../../../rules/assist-plugin-rule.md](../../../rules/assist-plugin-rule.md) for the full gate definition (triggers, process, signatures, escalation).

## Agents and Document Types

### Planner Agent
- **Document types:** Architecture decisions, task planning, roadmaps, sprint plans
- **Review gate applies:** Yes
- **Reviewed by:** `reviewer` or `code-reviewer` agent
- **Typical review criteria:**
  - Is the architecture decision well-justified?
  - Are task breakdowns clear and actionable?
  - Are dependencies identified?
- **Typical iterations:** 2-3 (refine clarity and feasibility)

### Solutions Architect Agent
- **Document types:** API specifications, data flow diagrams, schema designs, implementation contracts, system design docs
- **Review gate applies:** Yes
- **Reviewed by:** `reviewer` or `code-reviewer` agent
- **Typical review criteria:**
  - Are specifications complete and unambiguous?
  - Is the design feasible given constraints?
  - Are error cases handled?
  - Does it align with existing architecture?
- **Typical iterations:** 2-4 (technical refinement, API completeness)

### Requirements Gatherer Agent
- **Document types:** Business Requirements Document (BRD), User Requirements Document (URD), Feature requirements, Non-functional requirements (NFRs)
- **Review gate applies:** Yes
- **Reviewed by:** `reviewer` or `code-reviewer` agent
- **Typical review criteria:**
  - Are requirements clear and testable?
  - Are acceptance criteria complete?
  - Are NFRs specified (performance, security, scalability)?
  - Are conflicting requirements resolved?
- **Typical iterations:** 2-3 (stakeholder alignment, clarity)

### Researcher Agent
- **Document types:** Documentation audits, best practice surveys, analysis reports
- **Review gate applies:** Conditional (if output is final deliverable doc)
- **Reviewed by:** `reviewer` or `code-reviewer` agent
- **Typical review criteria:** Accuracy, completeness, source verification
- **Typical iterations:** 1-2 (fact-checking, source coverage)

---

## Iteration Guidelines

| Agent | Document Type | Typical Iterations | Max Iterations |
|-------|---------------|--------------------|----------------|
| Planner | Architecture | 2-3 | 10 |
| Planner | Task Plan | 1-2 | 10 |
| Solutions Architect | API Spec | 3-4 | 10 |
| Solutions Architect | Data Flow | 2-3 | 10 |
| Requirements Gatherer | BRD/URD | 2-3 | 10 |
| Requirements Gatherer | Requirements List | 1-2 | 10 |
| Researcher | Documentation Audit | 1-2 | 10 |

---

## Exit Criteria

Gate is cleared when:
1. Reviewer signs: `✓ LGTM #2` (two consecutive approvals), OR
2. Creator and reviewer reach consensus and reviewer approves

If 10 iterations reached without consensus:
- Escalate to `code-reviewer` agent
- `code-reviewer` makes final decision
- Outcome is binding

---

## Related References

- [review-protocol.md](review-protocol.md) — Review workflow and iteration tracking format
- [agent-registry.md](agent-registry.md) — Full agent responsibilities and routing
- [plan-format.md](plan-format.md) — Plan file structure for tracking review status
