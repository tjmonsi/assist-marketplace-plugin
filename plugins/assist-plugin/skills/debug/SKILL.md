---
name: debug
description: >-
  Diagnoses and fixes bugs through structured root cause analysis and
  iterative fix cycles. Supports analyze, fix, and review subcommands.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - LSP
argument-hint: "[analyze | fix | review] [description | file:line]"
---

# Debug

Diagnose and fix bugs through root cause analysis and iterative fix cycles.

## Dynamic context

Current branch: !`git branch --show-current`
Recent commits: !`git log --oneline -5`
Working tree: !`git status --short`

## Routing

Parse `$0` (first argument) and route to the matching subcommand. If empty or unmatched, ask which mode.

| `$0` | Action | Reference |
|------|--------|-----------|
| `analyze` | Investigate bug, produce RCA report | [references/analyze.md](references/analyze.md) |
| `fix` | Apply fix based on approved RCA | [references/fix.md](references/fix.md) |
| `review` | Verify previously applied fix | [references/review.md](references/review.md) |

## Gate: `fix` requires approved input

**Do not proceed with `fix` unless:**

1. An approved RCA (from `/debug analyze` + user confirmation), OR
2. A human-report file (e.g., `human-report.md`, `.human-report`)

If neither, halt and tell user:
> "Fix requires an approved RCA (`/debug analyze` first) or human-report file."

## RCA template

Output format: [references/rca-template.md](references/rca-template.md)

## Debugging principles

- Read error messages carefully; they usually point to the answer
- Check assumptions: is the input what you think?
- Bisect: narrow the problem space by half each step
- One change at a time; verify each hypothesis
- Fix root cause, don't patch symptoms
- If fix feels complex, reconsider whether you found the real cause

## Constraints

- No code changes during `analyze`; report only
- No broad try/catch blocks as fixes
- No error suppression that hides root cause
- If reproduction needs user action, ask for it
- If bug is in dependency, report it; don't patch

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
