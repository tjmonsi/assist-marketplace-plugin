---
name: ask
description: >-
  Answer questions using repository search and optional web research.
  Searches repo files first. Add --web to also search the web when repo
  context is insufficient. Always cites sources.
effort: medium
allowed-tools:
  - Read
  - Grep
  - Glob
  - WebSearch
  - WebFetch
argument-hint: "[--web] <question>"
---

# Ask

Answer questions by searching the repository, and the web when needed.

## Quick Start

```
/ask how does the debug skill route subcommands?
/ask --web what's new in the Claude Agent SDK?
```

## Modes

### Repo-only (default)

```
/ask <question>
```

1. Search the repo with Grep/Glob for relevant files (skills, agents, docs, code).
2. Read matching files to confirm the answer.
3. Answer using only what the repo contains.
4. If the repo has no answer, say so. Do not guess. Suggest `--web` to the user.
5. Review the drafted answer with `/review-md` before presenting it to the user.

### Repo + web

```
/ask --web <question>
```

1. Run the repo-only search first. Repo context wins when it conflicts with the web.
2. If the repo is incomplete or the question is about external tools/APIs/general knowledge, use WebSearch to find sources.
3. Use WebFetch to confirm claims from the top 1-3 results before citing them.
4. Combine repo and web findings into one answer. Label which source backs each claim.
5. Review the drafted answer with `/review-md` before presenting it to the user.

## Answer Format

Use the template in [references/answer-format.md](references/answer-format.md) for every response.

## Constraints

- Always cite sources. Link repo files with relative paths, and web sources with full URLs.
- Never state a claim without a source backing it.
- Prefer repo sources over web sources when both answer the question.
- Do not fetch or cite untrusted/unverifiable pages (no login walls, no scraped forums without corroboration).
- Keep the summary to 2-3 sentences. Details go in "Found In" and code snippets.
- No em-dashes, filler phrases, or hedging language ("it's worth noting", "in today's fast-paced world"). Write directly.
- If the question can't be answered from repo or web, say so plainly and stop. Do not fabricate.

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
