---
name: technical-writing
description: >-
  Generate and update technical documentation. Supports user docs, README,
  API documentation, guides, and specification writing.
effort: medium
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
argument-hint: "[docs | readme | guide | api] [topic | file]"
---

# Technical Writing

Create and update technical documentation for your project.

## Subcommands

### docs

Generate user-facing or developer documentation.

```
/technical-writing docs "User authentication flow"
```

Outputs:
- Conceptual overview
- Step-by-step guides
- Examples
- Diagrams (if applicable)

### readme

Generate or update README.md.

```
/technical-writing readme
```

Outputs:
- Project overview
- Installation instructions
- Quick start guide
- Features list
- Contributing guidelines
- License

### guide

Create implementation or setup guides.

```
/technical-writing guide "How to set up OAuth"
```

Outputs:
- Prerequisites
- Step-by-step setup
- Configuration
- Verification steps
- Troubleshooting

### api

Generate API documentation.

```
/technical-writing api
```

Outputs:
- API overview
- Endpoint documentation
- Request/response examples
- Error codes
- Authentication

## Output Format

Uses Markdown with:
- Clear headings (h2/h3)
- Code blocks for examples
- Tables for reference data
- Diagrams where helpful

## Constraints

- Research before writing (ensure accuracy)
- Include examples whenever possible
- Keep language clear and concise
- Update existing docs instead of duplicate
- Link to related documentation

## Report Writing Standard

- Put the answer or the most important finding first. No preamble, no restating the question, no closing recap.
- Let content set the length. Report a clean check in one line.
- Give each finding three parts: what happened, why it matters, what to do next.
- State each conclusion once. Open every paragraph with new information.
- Use active voice; put the important subject before the verb.
- Use plain words ("use" for "utilize"). Cut hedges, intensifiers, throat-clearing, buzzwords, and "not X but Y" framing; state what it is.
- Name headings after their content. Skip summary labels ("In conclusion", "Key takeaways"), severity badges, and summary sections unless the reader needs them.
- Write no em dashes (use a period, comma, colon, parentheses, or semicolon), no curly quotes, and no chatbot sign-offs or offers.
- Back every claim with evidence (file and line, log, test result, URL) and every number with a source; label estimates as estimates.
- Report tested results; never present the prompt or an assumption as fact.
- Quote exactly; never reword a quotation.
- Keep ticket ids and internal blame out of user-facing text.
