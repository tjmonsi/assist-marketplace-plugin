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

