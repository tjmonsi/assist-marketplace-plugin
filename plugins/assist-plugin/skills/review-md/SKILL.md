---
name: review-md
description: >-
  Review markdown reports for consistency, conciseness, and factual accuracy.
  Flags issues without editing the source file.
effort: medium
allowed-tools:
  - Read
  - Grep
  - Glob
  - Write
argument-hint: "<path-to-report.md>"
---

# Review MD

Review a markdown report for factual soundness, consistency, and conciseness. Produce a findings document; never edit the reviewed file.

## Modes

### Manual

```
/review-md path/to/report.md
```

Invoked directly on any markdown file the user names.

### Automated

Auto-invoked as the last step of a report-producing skill (`ask`, `debug analyze`/`review`, `pr-review`, `technical-writing`, `bump`, `map-project`, `commit`, `branch`, `do`) right after that skill writes or drafts its report, and before the report is presented to the user. The invoking skill passes the path (or in-memory draft) of the report it just produced.

## What It Checks

Check in this order; stop and report as soon as a category has findings rather than waiting to exhaustively check every rule in every category first.

1. **Factual soundness** — Does every claim trace to evidence in the file (code snippet, log line, file:line reference, command output)? Flag claims stated as fact with no cited source.
2. **Consistency** — Does the report state the same conclusion more than once, in different words? Does any section contradict an earlier one?
3. **Conciseness** — Hedges ("it should be noted," "arguably"), filler, em-dashes, meta-headers ("What follows," "Key takeaway"), and "This is X, not Y" contrastive framing.

## Output Format

Write findings to `<report-name>.review.md` next to the reviewed file (or return inline if the caller is another skill mid-workflow). Structure the findings document itself using the three-part pattern: for each issue, state what's wrong, why it matters, and what to change. See [references/review-findings-template.md](references/review-findings-template.md).

If the report has no issues, output a single line: `No issues found in <path>.` Do not manufacture findings to fill a template.

## Constraints

- Read-only on the reviewed file. Never edit, rewrite, or reformat the file under review.
- Produces a separate findings artifact; the caller (user or invoking skill) decides whether to act on it.
- Do not re-review a file already reviewed in the same session unless it changed.
- Cite the exact line or section of the reviewed file for every finding.

## Report Writing Standard

- Lead with the most important finding; never write "this is the more important of the two."
- Every finding has three parts: what happened, why it matters, what to do next.
- State each conclusion once. One optional summary line at the end for multi-finding reports; never repeat findings there.
- Use active voice, important subject before the verb ("Validation is skipped" not "The validation was skipped by...").
- Cut hedges ("it should be noted," "arguably") and contrastive filler ("This is X, not Y" — state what it is).
- No meta-headers about the act of writing ("What follows," "Key takeaway," "In conclusion").
- No em-dashes; use a period, comma, parentheses, or semicolon.
- No severity badges, remediation blocks, or summary sections unless the reader would be lost without them.
- Never restate the user's prompt or an assumption as fact; report the tested result.
- The first sentence of every paragraph must add new information.
