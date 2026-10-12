# Voice and Quotations

A cleaned text sounds like its writer with the tells removed. It never sounds like this skill, and it never changes what anyone said.

## Voice: note in pass 1, keep in passes 2 and 3

| Trait | Keep |
|---|---|
| Register | Formal stays formal; casual stays casual. Contractions stay where the writer used them and are not added where they did not. |
| Person | "I", "we", "you", or impersonal, as written. Do not switch "we" to passive or "you" to "the user". |
| Tense | The writer's tense in each passage. |
| Spelling | British or American, Oxford comma or not, as written. |
| Terms | The writer's word for each thing, used the same way every time. Do not swap a term for a synonym to vary the text. |
| Rhythm | The writer's own mix of long and short sentences. Join or split only to remove a tell. |
| Deliberate devices | Requirement keywords (`MUST`, `SHALL`), defined terms, legal repetition, jokes, and a rhetorical question the writer clearly meant. |
| Formatting | Heading levels, list style, emphasis, line wrapping, and table layout. |

When a tell and the voice conflict, remove the tell with the smallest cut that keeps the voice. When no cut works, leave the sentence and, in `detect`, report it.

## Protected inventory

Before changing anything, list every number, unit, date, version, path, identifier, name, link, code span, and quotation. After the last pass, find each one in the result and confirm it is byte-identical. A missing or changed item means the sentence holding it is reverted to the original and fixed again with a smaller cut, or left as written.

## Quotation integrity

A quotation is any text attributed to a source: double-quoted words, blockquotes, quoted log lines and error messages, UI strings, titles, and testimony. When it is unclear whether text is a quotation, treat it as one.

- **Never reword.** Keep every word, spelling, punctuation mark, and capital as the source has it, including the source's own tells. Fixing a quoted em dash or a quoted hedge misquotes the speaker.
- **Shorten only visibly.** Mark each omission with `[...]`, and only when the shortened quote means what the full one meant. Mark each insertion with square brackets.
- **Ask when unsure.** If a quote is too long and no cut keeps its meaning, leave it whole and ask the user, or paraphrase it without quote marks when the exact words are not needed. A paraphrase never keeps the quote marks.
- **No new quotes.** Never add quote marks around a paraphrase, and never turn reported speech into a direct quote.
- **Delimiters only.** Curly quote marks that open and close a quotation become straight quotes. Characters inside the quotation stay as they are.
