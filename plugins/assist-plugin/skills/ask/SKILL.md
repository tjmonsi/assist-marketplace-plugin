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

### Repo + web

```
/ask --web <question>
```

1. Run the repo-only search first. Repo context wins when it conflicts with the web.
2. If the repo is incomplete or the question is about external tools/APIs/general knowledge, use WebSearch to find sources.
3. Use WebFetch to confirm claims from the top 1-3 results before citing them.
4. Combine repo and web findings into one answer. Label which source backs each claim.

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
