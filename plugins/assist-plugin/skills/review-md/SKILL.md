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

1. **Factual soundness:** Does every claim trace to evidence in the file (code snippet, log line, file:line reference, command output)? Flag claims stated as fact with no cited source.
2. **Consistency:** Does the report state the same conclusion more than once, in different words? Does any section contradict an earlier one?
3. **Conciseness:** Apply the `deslop` catalogs as `deslop detect` would, without editing. Word and character tells (em dashes, curly quotes, chatbot residue, summary labels, hedges, contrast phrases, and the rest) come from "Mechanical tiers" in [rules/writing-standard.md](../../rules/writing-standard.md), judged in context per [deslop/references/word-tells.md](../deslop/references/word-tells.md). Sentence-shape tells (tricolon padding, self-answered questions, echo summaries, signposting, stacked hedges, and the rest) come from [deslop/references/structural-tells.md](../deslop/references/structural-tells.md). Skip anything on a catalog's keep list, and never flag the wording inside a quotation. Label each conciseness finding with its family or tell id.

## Output Format

Write findings to `<report-name>.review.md` next to the reviewed file (or return inline if the caller is another skill mid-workflow). Structure the findings document itself using the three-part pattern: for each issue, state what's wrong, why it matters, and what to change. See [references/review-findings-template.md](references/review-findings-template.md).

If the report has no issues, output a single line: `No issues found in <path>.` Do not manufacture findings to fill a template.

## Constraints

- Read-only on the reviewed file. Never edit, rewrite, or reformat the file under review.
- Produces a separate findings artifact; the caller (user or invoking skill) decides whether to act on it.
- Do not re-review a file already reviewed in the same session unless it changed.
- Cite the exact line or section of the reviewed file for every finding.

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
