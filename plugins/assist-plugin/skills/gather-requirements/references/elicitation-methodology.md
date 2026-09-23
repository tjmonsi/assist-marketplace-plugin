# Elicitation Methodology

Interactively gather requirements through structured questioning. Used by `/gather-requirements elicit`.

## Inputs

- `$1+` — Topic, domain, or project name (optional; ask if not provided)

## Six-phase process

### 1. Establish context

- Ask: What is the project or initiative?
- Ask: Who are the stakeholders? (users, operators, business owners, regulators)
- Ask: What problem does this solve, or what opportunity does it address?
- Check the working directory for existing BRDs, URDs, specs, or documentation before asking about anything already written down.

### 2. Elicit business requirements

- Ask: What business outcome or goal must this achieve?
- Ask: What are the success criteria? How will we know it worked?
- Ask: What is in scope? What is explicitly out of scope?
- Ask: What constraints exist? (budget, timeline, technology, regulatory)

### 3. Elicit user requirements

For each stakeholder group identified in phase 1:

- Ask: What do they need to accomplish? (goals, not features)
- Ask: What is their current workflow? What pain points exist?
- Ask: What conditions must be true for them to consider this successful?

### 4. Elicit functional requirements

For each user requirement:

- Ask: What must the system do to satisfy this need?
- Ask: What inputs, processing, and outputs are involved?
- Ask: What happens when things go wrong? (error conditions, edge cases)
- Ask: How would we verify this works? The answer becomes the FR's first scenario.

### 5. Elicit non-functional requirements

Cover each category that applies, and skip the ones that do not:

- **Performance** — response times, throughput, capacity
- **Security** — authentication, authorization, data protection
- **Reliability** — uptime, recovery, fault tolerance
- **Usability** — accessibility, learnability
- **Compliance** — regulatory, legal, standards

Every NFR needs a number attached. "The system SHALL respond quickly" is not an NFR; "The system SHALL return search results within 200ms at p95" is.

### 6. Summarize and confirm

- Present a structured summary of everything gathered (format below).
- Ask the user to confirm, correct, or add missing items.
- Flag any conflicts or ambiguities discovered during elicitation.
- Do not proceed to `document` until the user confirms the summary.

## Questioning technique

- Start broad, then narrow: context, goals, capabilities, details.
- Use open questions first ("What do you need?"), then closed questions to confirm ("So the system must handle 1000 concurrent users?").
- **Extract the need behind the solution.** When the user gives a solution ("I need a dropdown"), ask for the underlying need ("What are you trying to select, and why?"). Record the need as the requirement and the solution as a note, not the other way around.
- When a requirement is vague, ask for a testable condition ("How would we verify this?").
- **Do not ask all questions at once. Batch 3-5 related questions per turn.** Use `AskUserQuestion` for closed choices; use plain prose for open questions.

## Output format

After elicitation, produce this summary:

```markdown
### Requirements Summary: [Project/Topic]

**Business requirements:**
- BR-001: [requirement]

**User requirements:**
- UR-001: [requirement] (stakeholder: [who], traces to: BR-NNN)

**Functional requirements:**
- FR-001: [requirement] (traces to: UR-NNN)
  - Scenario: GIVEN [state] WHEN [action] THEN [outcome]

**Non-functional requirements:**
- NFR-001: [requirement] (category: [performance|security|reliability|usability|compliance], traces to: [FR-NNN|UR-NNN|BR-NNN])

**Out of scope:**
- [Exclusion 1] — Reason: [why excluded] — Deferred to: [phase/version/never]

**Open questions:**
- [Anything unresolved]
```

## Constraints

- Do not assume requirements. Ask.
- Do not propose solutions during elicitation.
- If the user provides a solution, extract the underlying requirement.
- Batch questions to avoid overwhelming the user.
- Leave unresolved items in **Open questions** rather than guessing an answer.
