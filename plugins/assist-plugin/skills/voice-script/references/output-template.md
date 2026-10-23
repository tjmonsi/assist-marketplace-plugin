# Output template

The layout of the file that `voice-script` writes to `docs/tts/voice-<slug>-YYYYMMDD-HHmm.md`. The file has a header, a notes list, and the script. The header and notes follow the Report Writing Standard. The script blocks hold only the text to paste, follow the chosen model's rules, and hold no U+2014, U+2015, or curly quote.

## Brief script

````markdown
# Voice script: <title, 3 to 8 words; a comma or a period for a dash, ASCII quotes>

| Field | Value |
|---|---|
| Model | `<exact model id>` |
| Voice | `<voice id>` or `<reference clip path>` |
| Length | Brief, one request (<N> characters, estimate) |
| Delivery direction | <the user's words; a comma or a period for a dash, ASCII quotes> |
| Delivery applied | <style field value, or the tags and punctuation used, or "plain words for you to apply"> |
| Model settings | <see the list below> |
| Script source | Topic, written by the skill, or Draft, words unchanged |
| Catalog verified | 2026-10-12 |
| Live check | <list result>; <endpoint result>; or "catalog only: <reason>" |
| Created | YYYYMMDD-HHmm, or "time n/a" |

## Notes

- Em dashes replaced: <N> (U+2014 and U+2015, draft, header, and composed text).
- Curly quotes straightened to ASCII quotes.
- Kept tell: <family id>, draft line <N>.
- <other warning, one line each>

## Script

```text
<only the text to paste>
```
````

## Longer script

Replace the `Length` row with `Longer, <N> numbered segments, one fenced block each (paste each as its own request, in order)`. Replace the `## Script` section with one subsection per segment:

````markdown
## Script

### Segment 1 of <N> (<count> characters, estimate)

```text
<text of segment 1>
```

### Segment 2 of <N> (<count> characters, estimate)

```text
<text of segment 2>
```
````

## Rules

- **One fenced block per segment.** A brief script has exactly one fenced block in the whole file. A longer script has exactly one per numbered segment. Use no other fenced block anywhere in the file, not even in the notes. Write header values as inline code instead.
- **The block holds only text to paste.** It has no heading, label, delivery direction, stage direction, or segment number. If the script text contains three backticks, use a longer fence.
- **Fence language.** Use `text`.
- **Model settings.** List what the user sets outside the script, as the model file's "Header Model settings" line says: `voice`, `instructions` (the delivery phrase, for models with a style field), `System message` (gpt-audio), `response_format`, a reference clip path, `speed` only when the user asked. For a model not in the catalog, list `voice` and `response_format` only. Add a line "no effect on this model: <names>" when the model file lists ignored settings (Chatterbox-Turbo: `exaggeration`, `cfg_weight`, `min_p`).
- **Notes.** One line per item, including every note SKILL.md or the model file asks for. Three notes have fixed text, shown in the layout above. The count note `Em dashes replaced: <N> (U+2014 and U+2015, draft, header, and composed text).` is written on every saved script, 0 included, so the Notes section is never empty. The curly-quote note appears only when at least one curly quote was straightened. The kept-tell note appears once per kept tell, and names the family and the draft line without the tell's text. A U+2014, U+2015, or curly-quote swap is counted or noted only, never also listed as a punctuation change. Also include, at least: the endpoint warning; new or removed ids that matter to the choice; each "pass-through unconfirmed" or "unconfirmed" label that applies to a tag, setting, or limit used; the working cap when the skill used its own 1,000-character default; a retirement or legacy status; each punctuation change made to a draft; each draft sentence flagged for markup or instruction content; an unknown-model warning; a voice and delivery mismatch.
- **Limits.** Label a limit as an OpenRouter limit or a provider limit, as the model file does. Label character counts as estimates.
- **No secrets.** Never write tokens, keys, or credentials into any part of the file.

## Example (Chatterbox-Turbo, brief)

````markdown
# Voice script: Welcome message

| Field | Value |
|---|---|
| Model | `ResembleAI/chatterbox-turbo` |
| Voice | Reference clip `voices/host-sample.wav` (longer than 5 s; only the first 15 s is used) |
| Length | Brief, one request (about 100 characters, estimate; the segment size is about 300) |
| Delivery direction | Warm and conversational |
| Delivery applied | `[chuckle]` and commas; Turbo has no style field, so the reference clip sets the voice character |
| Model settings | Reference clip `voices/host-sample.wav`; no effect on this model: `exaggeration`, `cfg_weight`, `min_p` |
| Script source | Topic, written by the skill |
| Catalog verified | 2026-10-12 |
| Live check | List: no changes; endpoint check: not applicable (local model) |
| Created | 20261012-1405 |

## Notes

- Em dashes replaced: 0 (U+2014 and U+2015, draft, header, and composed text).
- Pause marks use ASCII `...` and commas, because Turbo rewrites an em dash to `-` and a single-character ellipsis to a comma.

## Script

```text
Hi, and welcome! [chuckle] I'm glad you made it... Let me show you around, and then we can get started.
```
````
