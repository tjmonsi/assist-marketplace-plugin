# xAI Grok Voice TTS 1.0

Verified: 2026-10-12. Id: `x-ai/grok-voice-tts-1.0`. Served through `POST https://openrouter.ai/api/v1/audio/speech` [OR1].

## Delivery handling

- Style field: none; `instructions` is ignored [OR1].
- Express delivery with inline `[tag]` events and wrapping `<tag>text</tag>` styles from the table, plus punctuation. xAI's tips: place inline tags where the expression would occur, combine them with punctuation rather than stacking, and wrap complete phrases [XA1].
- Never write direction lines into the text.
- Header "Model settings": `voice`, `response_format`. Add the note "wrapping tags: OpenRouter pass-through unconfirmed" when any wrapping tag is used.

## Tags

Two kinds: inline `[tag]` at a point, and wrapping `<tag>text</tag>` around a phrase; tags combine, for example `<slow><soft>Goodnight, sleep well.</soft></slow>` [XA1].

| Tag | Effect | Use | Source |
|---|---|---|---|
| `[pause]`, `[long-pause]` | Pause | yes | XA1 |
| `[hum-tune]` | Hum a tune (listed in the Pauses row on xAI's page) | yes | XA1 |
| `[laugh]`, `[chuckle]`, `[giggle]`, `[cry]` | Laughter and crying | yes | XA1 |
| `[tsk]`, `[tongue-click]`, `[lip-smack]` | Mouth sounds | yes | XA1 |
| `[breath]`, `[inhale]`, `[exhale]`, `[sigh]` | Breathing | yes | XA1 |
| `<soft>`, `<whisper>`, `<loud>`, `<build-intensity>`, `<decrease-intensity>` | Volume and intensity (wrapping; OpenRouter pass-through unconfirmed) | yes, note: pass-through unconfirmed | XA1 |
| `<higher-pitch>`, `<lower-pitch>`, `<slow>`, `<fast>` | Pitch and speed (wrapping; OpenRouter pass-through unconfirmed) | yes, note: pass-through unconfirmed | XA1 |
| `<sing-song>`, `<singing>`, `<emphasis>` | Vocal style (wrapping; OpenRouter pass-through unconfirmed) | yes, note: pass-through unconfirmed | XA1 |

On OpenRouter, Grok also honored `[whispering]`, `[excited]`, `(sighs)`, and `(laughs)` [OR10, OR11]. Those are not xAI's documented tags; use the table.

## Controls

Native `speed` 0.7 to 1.5 (default 1.0) and `language` [XA1]; OpenRouter exposes neither in the per-model field list and `speed` support is unconfirmed [OR9]. `instructions` is ignored [OR1].

## Voices

`eve`, `ara`, `rex`, `sal`, `leo` (case-insensitive natively; `eve` is xAI's default) [OR5, XA1].

Voice menu: `eve`, `ara`, `rex`, `sal`.

## Limits

15,000 characters per request on OpenRouter (OpenRouter limit) [OR8]; xAI's native API allows 60,000 (provider limit) [XA1]. Use 15,000.

## Pauses and punctuation

`[pause]` and `[long-pause]` [XA1], plus ordinary punctuation.

## Unconfirmed

- OpenRouter pass-through of the wrapping tags.
- OpenRouter support for `speed` and `language`.

## Sources

- [XA1] xAI, Text to Speech: https://docs.x.ai/developers/model-capabilities/audio/text-to-speech (request body from https://docs.x.ai/developers/model-capabilities/audio/text-to-speech.md; tag names from the rendered page; retrieved 2026-10-12)
- [OR1] OpenRouter, Text-to-Speech guide: https://openrouter.ai/docs/guides/overview/multimodal/tts.md (retrieved 2026-10-12)
- [OR5] Tested 2026-10-12: https://openrouter.ai/api/v1/models?output_modalities=speech (32 models, HTTP 200 without a key)
- [OR8] OpenRouter model pages, full descriptions: https://openrouter.ai/{model-id}, for example https://openrouter.ai/elevenlabs/eleven-v4 (retrieved 2026-10-12)
- [OR9] OpenRouter per-model API guides: https://openrouter.ai/{model-id}/llms.txt, for example https://openrouter.ai/elevenlabs/eleven-v4/llms.txt (retrieved 2026-10-12)
- [OR10] OpenRouter speech benchmark, Bracketed cue: https://openrouter.ai/benchmarks/media/speech/bracketed-cue (retrieved 2026-10-12)
- [OR11] OpenRouter speech benchmark, Nonverbal cue: https://openrouter.ai/benchmarks/media/speech/nonverbal-cue (retrieved 2026-10-12)
