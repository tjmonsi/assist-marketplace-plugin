# Frontend Action Template

Use when the requirement defines a user-facing interaction, UI flow, screen transition, form submission, or client-side behavior.

Unique to this template: the **Accessibility** section, which is mandatory and holds the interaction to WCAG 2.2 AA. Visual design (tokens, layout, component variants) belongs in a UI/UX design spec, not here; link the two as parent and sub-feature.

## Template

````markdown
# spec-[feature-name]

## Metadata

| Field | Value |
|---|---|
| **Feature** | [Human-readable feature name] |
| **Parent feature** | [spec-[parent].md, or "None" if top-level] |
| **Sub-features** | [Comma-separated spec-[child].md files, or "None"] |
| **Requirement refs** | [BR-NNN, UR-NNN, FR-NNN, NFR-NNN — the IDs this spec satisfies] |
| **Feature type** | Frontend action |
| **Status** | Draft |

Status values: Draft, Review, Approved, Implemented.

## Description

[2-4 sentences: what the user does, what they see, and why this interaction exists.]

## Triggered by

| Trigger type | Source | Condition |
|---|---|---|
| [Click, submit, navigate, gesture, keypress] | [Button, link, form, menu item, route change] | [When this trigger fires, e.g. user is on page X and the form is valid] |

## User flow

Numbered steps describing what the user experiences from trigger to completion, including what the UI shows at each step.

1. User [action] on [UI element]
2. UI shows [loading state / transition / feedback]
3. [Client-side processing: validation, state update, API call]
4. UI updates to [new state / screen / confirmation]
5. [Final state: what the user sees when the action is complete]

## Screen states

| State | Description | Transition to |
|---|---|---|
| **Initial** | [What the user sees before the action] | [What triggers leaving this state] |
| **Loading** | [What the user sees during processing] | [Success or error state] |
| **Success** | [Confirmation, redirect, updated data] | [Next available actions] |
| **Error** | [Inline error, toast, modal] | [How to recover: retry, correct input, dismiss] |
| **Empty** | [What the user sees when there is no data] | [How to populate: CTA, instructions] |

## User inputs

| Input | UI element | Type | Validation | Required | Default |
|---|---|---|---|---|---|
| [Field name] | [Text input, dropdown, checkbox, date picker] | [Data type] | [min/max length, regex, allowed values] | [yes/no] | [Default value or "—"] |

## Client-side validation

| Rule | Applied to | Error message shown | When checked |
|---|---|---|---|
| [Required, format, range, custom] | [Which input fields] | [Exact message the user sees] | [On blur, on submit, on change] |

## Required data

| Data | Source | Type | Notes |
|---|---|---|---|
| [Data needed to render or process] | [API response, local state, URL params, user input] | [Data type] | [How it is fetched or derived] |

## API calls made

| API endpoint | Method | When called | Request | Response used for |
|---|---|---|---|---|
| [/api/v1/resource] | [GET/POST] | [On mount, on submit, on action] | [Key request fields] | [What the response populates in the UI] |

## Behavior

Each client-side behavior is a Requirement with Scenarios. Cover the happy path, the validation path, and the network or API failure path.

### Requirement: [Behavior name, e.g. Submit the order form]

When the user [triggers the action] with [valid input], the client SHALL [call the endpoint, update state, and show the confirmation].

#### Scenario: Valid submission

- **GIVEN** [the form is populated with values that pass every validation rule]
- **AND** [the user is authenticated]
- **WHEN** the user [activates the submit control]
- **THEN** the client SHALL disable the submit control and show the loading state
- **AND** the client SHALL call [METHOD] [endpoint] with [fields]
- **AND** on a 2xx response the client SHALL [navigate / render the confirmation] and move focus to [element]

#### Scenario: Client-side validation failure

- **GIVEN** [a required field is empty or a value violates its rule]
- **WHEN** the user [activates the submit control]
- **THEN** the client SHALL NOT call the endpoint
- **AND** the client SHALL show [the exact message] next to the offending field
- **AND** the client SHALL move focus to the first invalid field and announce the error to assistive technology

#### Scenario: Network failure

- **GIVEN** [the request is in flight]
- **WHEN** the connection fails or the request times out after [N] seconds
- **THEN** the client SHALL replace the loading state with [the retry affordance]
- **AND** the client SHALL preserve the user's input

#### Scenario: API error response

- **GIVEN** [the endpoint returns 4xx or 5xx]
- **WHEN** the client receives the response
- **THEN** the client SHALL map [error code] to [the user-facing message]
- **AND** the client SHALL [enable retry / direct the user to correct the input]

## Algorithmic steps (client-side)

Numbered client-side processing logic. Each step maps to a Scenario above.

1. [Collect and validate user inputs]
2. [Transform data for the API call if needed]
3. [Call the API endpoint]
4. [Handle the response: update state, navigate, show feedback]
5. [Handle the error: show message, enable retry]

## Error handling

| Error condition | User experience | Recovery |
|---|---|---|
| [Validation failure] | [Inline error message next to the field] | [User corrects input and resubmits] |
| [Network error] | [Toast or banner: "Connection error. Please try again."] | [Retry control or automatic retry] |
| [API 4xx/5xx] | [Message mapped from the API error code] | [Correct input, contact support, or retry] |
| [Timeout] | [Loading state replaced with a timeout message] | [Retry or navigate away; input preserved] |

## Events emitted

| Event name | Payload | Consumer(s) | When emitted |
|---|---|---|---|
| [UI or analytics event] | [Key data included] | [Parent component, analytics service, state manager] | [After which step or user action] |

## Output / Outcome

| Output | Type | Description |
|---|---|---|
| [UI state change] | [Screen update, navigation, modal, toast] | [What changes for the user] |
| [Data mutation] | [API call side effect] | [What changes on the server] |
| [Analytics event] | [Tracking event] | [What is logged] |

## Accessibility

Mandatory. The interaction conforms to WCAG 2.2 AA; name the concrete mechanism, not the goal.

| Concern | Requirement |
|---|---|
| **Keyboard navigation** | Every interactive element SHALL be reachable via Tab in visual reading order, and activated via Enter or Space |
| **Screen reader** | [ARIA labels, roles, and the live region used for dynamic content] |
| **Focus management** | [Where focus moves after the action completes: confirmation heading, first invalid field, newly revealed content] |
| **Error announcement** | Errors SHALL be announced via `aria-live` and associated with their field via `aria-describedby`, and SHALL NOT be conveyed by color alone |
| **Loading state** | [How progress is announced, e.g. `aria-busy` or a polite live region] |
| **Motion** | [Behavior under `prefers-reduced-motion`] |

## Traceability

| Requirement | Spec section | Verified by |
|---|---|---|
| [UR-NNN] | [Requirement: [behavior name]] | [E2E test or usability review reference] |
| [FR-NNN] | [API calls made] | [Integration test reference] |
| [NFR-NNN] | [Accessibility] | [Accessibility audit reference] |
````
