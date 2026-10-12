# Canopy Labs Orpheus 3B

Verified: 2026-10-12. Id: `canopylabs/orpheus-3b-0.1-ft`, served by DeepInfra and Together [OR7]. Served through `POST https://openrouter.ai/api/v1/audio/speech` [OR1].

## Delivery handling

- Style field: none; `instructions` is ignored [OR1].
- Express delivery with the 8 angle-bracket emotive tags from the table, plus punctuation and voice choice. OpenRouter pass-through of the tags is unconfirmed: add the header note when any tag is used.
- Never write direction lines or square-bracket cues into the text: Orpheus spoke `[whispering]` aloud on OpenRouter [OR10].
- Header "Model settings": `voice`, `response_format`.

## Tags

Upstream: "You can additionally add the following emotive tags: `<laugh>`, `<chuckle>`, `<sigh>`, `<cough>`, `<sniffle>`, `<groan>`, `<yawn>`, `<gasp>`." [OP1]. OpenRouter's benchmark did not test angle brackets; Orpheus spoke `[whispering]` and "Laughed" for `(laughs)` [OR10, OR11]. Whether DeepInfra and Together pass the angle-bracket tags through is unconfirmed.

| Tag | Effect | Use | Source |
|---|---|---|---|
| `<laugh>` | Laugh | yes, note: pass-through unconfirmed | OP1 |
| `<chuckle>` | Chuckle | yes, note: pass-through unconfirmed | OP1 |
| `<sigh>` | Sigh | yes, note: pass-through unconfirmed | OP1 |
| `<cough>` | Cough | yes, note: pass-through unconfirmed | OP1 |
| `<sniffle>` | Sniffle | yes, note: pass-through unconfirmed | OP1 |
| `<groan>` | Groan | yes, note: pass-through unconfirmed | OP1 |
| `<yawn>` | Yawn | yes, note: pass-through unconfirmed | OP1 |
| `<gasp>` | Gasp | yes, note: pass-through unconfirmed | OP1 |

## Controls

Upstream notes "`repetition_penalty>=1.1`is required for stable generations" and that raising `repetition_penalty` and `temperature` makes speech faster [OP1]; neither is exposed on OpenRouter [OR9].

## Voices

`tara`, `leah`, `jess`, `leo`, `dan`, `mia`, `zac` [OR5]; upstream ranks them in that order "of conversational realism" [OP1].

Voice menu: `tara`, `leah`, `jess`, `leo`.

## Limits

OpenRouter reports a 4,096 context length and 3,686 max completion [OR5]; unit meaning for TTS is unconfirmed. Per-request limit unconfirmed.

## Pauses and punctuation

No pause tag is documented. Use ordinary punctuation.

## Unconfirmed

- Whether DeepInfra and Together pass the angle-bracket tags through.
- The per-request limit.

## Sources

- [OP1] Orpheus-TTS README: https://github.com/canopyai/Orpheus-TTS/blob/main/README.md (retrieved 2026-10-12)
- [OR1] OpenRouter, Text-to-Speech guide: https://openrouter.ai/docs/guides/overview/multimodal/tts.md (retrieved 2026-10-12)
- [OR5] Tested 2026-10-12: https://openrouter.ai/api/v1/models?output_modalities=speech (32 models, HTTP 200 without a key)
- [OR7] Tested 2026-10-12: https://openrouter.ai/api/v1/models/{canonical_slug}/endpoints for all 32 speech ids
- [OR9] OpenRouter per-model API guides: https://openrouter.ai/{model-id}/llms.txt, for example https://openrouter.ai/elevenlabs/eleven-v4/llms.txt (retrieved 2026-10-12)
- [OR10] OpenRouter speech benchmark, Bracketed cue: https://openrouter.ai/benchmarks/media/speech/bracketed-cue (retrieved 2026-10-12)
- [OR11] OpenRouter speech benchmark, Nonverbal cue: https://openrouter.ai/benchmarks/media/speech/nonverbal-cue (retrieved 2026-10-12)
