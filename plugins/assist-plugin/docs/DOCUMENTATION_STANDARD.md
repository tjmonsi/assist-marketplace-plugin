# Documentation Standard

[rules/writing-standard.md](../rules/writing-standard.md) is the source of truth for how assist-plugin agents and skills write reports, findings, documentation, and every other human-readable output. Agents and skills carry its compact form ([rules/writing-standard-compact.md](../rules/writing-standard-compact.md)) under a `## Report Writing Standard` heading, and the prose hooks check its block and advisory tiers with `hooks/lib/prose-rules.js`. Change rules there; this file holds only what is specific to documentation files.

## Citations in documentation

- Quote exact code or log output in a fenced block, or in a blockquote for a short line, so it stays verbatim and the prose checks skip it.
- Cite code locations as `path/to/file.ts:N-M`, and link files in the repository with relative paths.
- Link external standards and documentation with full URLs.

## Formats with their own conventions

Commit messages, changelog entries, and governance checklists follow their own formats (Conventional Commits, Keep a Changelog, signature lines). The writing standard applies to their free-text parts only; see its Scope section.
