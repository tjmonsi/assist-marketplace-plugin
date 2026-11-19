# Decision records

An architectural decision is a choice that binds later work: technology, structure, interface, data model, or policy. Step edits, model overrides, and scheduling answers are not architectural. Whenever the user makes one (at Clarify, PlanApproval, DocSignOff, a NeedsInput relay, or the Skip spec-first waiver):

1. Record it under `## User Decisions` in the plan file.
2. Before the user approves, keep it in the plan only. A cancelled or edited plan must leave `DECISIONS.md` alone.
3. At Approve, append the architectural decisions recorded so far to `<root>/DECISIONS.md` (see Project root). Append each later decision (a NeedsInput answer) when it arrives.

Add entries with the Edit tool, at the end of the file. Use Write only when the file does not exist. The file is append-only: never edit or remove an earlier entry.

```markdown
## 2026-10-12: Use opaque session tokens

Decision: Sessions use opaque tokens stored server-side; no JWT.
Plan: .agent/main-plan/plan-auth-20261012.md
```

Each entry carries the date, the decision, and the plan file path. The decision text follows the never-quote rule under Clarify: /do's wording of the chosen option plus citations, never document text.

**Root notes (FR-188).** When SpecGate recorded that a listed requirements or task-plan path came from an old root pattern, Approve appends a plain note for that document type; a cancelled or edited plan writes nothing. SpecGate reads no text for this. At Approve, for each such type, immediately before the append, run a Grep on `<root>/DECISIONS.md` with output mode `count`, using only the note title for that type, anchored after the date prefix (the heading form is `## YYYY-MM-DD: <title>`):

- requirements: `^## [0-9]{4}-[0-9]{2}-[0-9]{2}: Requirements kept at the repository root\r?$`
- task plans: `^## [0-9]{4}-[0-9]{2}-[0-9]{2}: Task plans kept at the repository root\r?$`

Use the match count and no heading text. A count above 0 skips the note for that type; no other heading is read, and heading text triggers nothing. A count of 0 appends one standard-layout entry headed with that title, whose Decision line says the project keeps those documents at the repository root and does not move them unless the user asks. The note holds no `Location:` line and no path or pattern for any tool, and no later search reads it. The files stay in place; a move happens only when the user asks, shown as its own step at PlanApproval. The append runs before Preflight takes the change-check baseline, so the baseline already holds it.
