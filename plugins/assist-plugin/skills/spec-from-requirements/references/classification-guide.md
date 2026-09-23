# Classification Guide

Classify each requirement into exactly one of six types before writing a spec. **First match wins**: walk the questions in order and stop at the first Yes.

## Decision tree

```
Start with one requirement.

1. Does it define system structure, component boundaries, service topology,
   data flow between components, or infrastructure layout?
     YES → Architecture
     NO  → continue

2. Does it define a request/response contract reachable over the network
   (HTTP endpoint, webhook receiver, gRPC or RPC method, GraphQL resolver)?
     YES → API endpoint
     NO  → continue

3. Is it triggered by a user acting on a UI element (click, submit, navigate,
   gesture, keypress) and described in terms of what the user does and sees?
     YES → Frontend action
     NO  → continue

4. Does it define backend processing: business logic, data transformation,
   a scheduled job, a queue or event handler, a calculation or decision rule?
     YES → Functionality
     NO  → continue

5. Does it define how the interface looks and feels: visual hierarchy, layout,
   design tokens, component variants, responsive behavior, accessibility?
     YES → UI/UX design
     NO  → continue

6. Anything else: configuration, tooling, CI/CD, integration wiring, policy,
   infrastructure-as-code, data retention rules, operational runbooks.
     → General
```

## Type reference

| Type | Owns | Does not own |
|---|---|---|
| **Architecture** | Components and their responsibilities, boundaries and protocols, topology, failure modes, design decisions, which NFRs the structure satisfies | The internals of any single component (those get their own specs) |
| **API endpoint** | Method, path, auth, rate limit, idempotency, parameters, request and response bodies, status codes, emitted events | UI behavior of callers, backend logic reused by other callers |
| **Frontend action** | User flow, screen states, inputs, client-side validation, API calls made, accessibility of the interaction | Visual design tokens and layout (UI/UX design), server-side processing |
| **Functionality** | Trigger conditions, preconditions, algorithmic steps, business rules, data transformations, events emitted and consumed | The transport that invokes it (API endpoint), the screen that triggers it |
| **UI/UX design** | Visual hierarchy, component hierarchy, layout per breakpoint, design tokens, interaction patterns, states, WCAG compliance | What happens on the server, the user flow's control logic |
| **General** | Configuration values, dependency wiring, pipeline steps, policies, tooling setup | Anything that matched one of the five above |

## Tie-breakers

| Ambiguity | Rule |
|---|---|
| An endpoint that also contains substantial business logic | API endpoint for the contract; if the logic is reused by another trigger, split it into a separate Functionality spec and reference it |
| A UI feature with both interaction and visual requirements | Split: Frontend action for behavior, UI/UX design for appearance. Link them as parent and sub-feature |
| A requirement naming several components and their wiring | Architecture, even if one of those components is an endpoint |
| A scheduled job that calls an internal HTTP endpoint | Functionality (the job is the feature); the endpoint gets its own API endpoint spec if it is not already specified |
| A webhook the system receives | API endpoint (it is an inbound request/response contract) |
| A webhook the system sends | Functionality, with the outbound contract documented under events emitted |
| Infrastructure-as-code for components already specified in an Architecture spec | General, referencing the Architecture spec as parent |
| Accessibility stated as a quality attribute across the product | UI/UX design if it is about components and tokens; General if it is a policy with an audit process |

## Multiple requirements, one feature

A feature usually satisfies several requirement IDs. Classify the **feature**, not each ID, and list all satisfied IDs in **Requirement refs**. When one requirement clearly spans two types (a payment flow with both an endpoint and a screen), produce two specs linked as parent and child rather than one mixed file.

## After classifying

1. Read the matched template in [templates/](templates/) end to end before writing.
2. Fill the metadata block, including every requirement ID this spec satisfies.
3. Express behavior as `### Requirement:` headers with `#### Scenario:` GIVEN/WHEN/THEN blocks.
4. Mark template sections that genuinely do not apply as "Not applicable" with a one-line reason. Do not delete them silently, and do not fill them with filler.
5. Close with the traceability table.
