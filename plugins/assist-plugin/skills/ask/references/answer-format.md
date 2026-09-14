# Answer Format

Template for `/ask` responses. Fill every section. Omit "Code" if no snippet applies.

## Template

```markdown
## Answer

<2-3 sentence summary. Direct answer first, no preamble.>

## Found In

- `path/to/file.ext` (line N) — <one-line reason this file matters>
- https://example.com/docs/page — <one-line reason this source matters>

## Code

​```<language>
<exact snippet, unmodified>
​```
`path/to/file.ext:N-M`

## Learn More

- [Title of related doc](path/or/url)
- [Title of related doc](path/or/url)
```

## Rules

- **Answer:** State the conclusion first. Skip "Great question" or similar filler. Two to three sentences max.
- **Found In:** List every file or URL the answer relies on. Use relative repo paths (e.g., `plugins/assist-plugin/skills/ask/SKILL.md`), not absolute paths. Use full URLs for web sources.
- **Code:** Quote the exact snippet from the file. Include the file path and line range under the block. Skip this section entirely if no code applies.
- **Learn More:** Link 1-4 related resources (docs, related skills, external references). Skip if nothing further applies.
- **No em-dashes.** Use a period or parentheses instead.
- **No AI-slop.** Cut phrases like "it's important to note", "in conclusion", "leverage", "delve into", "robust solution". State facts plainly.
- **Active, imperative voice.** "Grep parses the config" not "The config is parsed by Grep".
- **Short paragraphs.** 2-3 sentences per paragraph, no walls of text.

## Example

```markdown
## Answer

The `debug` skill routes subcommands by reading `$0` and matching it against a table of `analyze`, `fix`, and `review`. If `$0` is empty or unmatched, it asks the user which mode to use.

## Found In

- `plugins/assist-plugin/skills/debug/SKILL.md` (lines 25-33) — defines the routing table
- `plugins/assist-plugin/skills/debug/references/fix.md` — details the `fix` subcommand gate

## Code

​```markdown
| `$0` | Action | Reference |
|------|--------|-----------|
| `analyze` | Investigate bug, produce RCA report | [references/analyze.md](references/analyze.md) |
| `fix` | Apply fix based on approved RCA | [references/fix.md](references/fix.md) |
| `review` | Verify previously applied fix | [references/review.md](references/review.md) |
​```
`plugins/assist-plugin/skills/debug/SKILL.md:29-33`

## Learn More

- [debug SKILL.md](../../debug/SKILL.md)
- [debug fix gate](../../debug/references/fix.md)
```
