# Sesame CSM 1B

Verified: 2026-10-12. Id: `sesame/csm-1b`, served by DeepInfra [OR7]. Served through `POST https://openrouter.ai/api/v1/audio/speech` [OR1].

## Delivery handling

- Style field: none; `instructions` is ignored [OR1].
- Inline tags: none. Express delivery through the voice choice, wording, and punctuation only. State the delivery in plain words in the header for the user.
- Never write direction lines or bracketed cues into the text.
- Warn the user that this model garbled text in OpenRouter's benchmark ("Route 6 Expresses open till 9") [OR10, OR11].
- Header "Model settings": `voice`, `response_format`.

## Tags

None in the upstream README [CS1]. On OpenRouter it kept cue words silent but produced no whisper, sigh, or laugh, and garbled the text ("Route 6 Expresses open till 9") [OR10, OR11].

| Tag | Effect | Use | Source |
|---|---|---|---|
| None | Not applicable | no | CS1 |

## Controls

No style field.

## Voices

`conversational_a`, `conversational_b`, `read_speech_a`, `read_speech_b`, `read_speech_c`, `read_speech_d`, `none` [OR5]. Upstream: "it has not been fine-tuned on any specific voice" [CS1].

Voice menu: `conversational_a`, `conversational_b`, `read_speech_a`, `read_speech_b`.

## Limits

OpenRouter reports a 4,096 context length [OR5]; unconfirmed for text length.

## Pauses and punctuation

No pause markup is documented. Use ordinary punctuation.

## Unconfirmed

- The per-request text limit.

## Sources

- [CS1] Sesame CSM README: https://github.com/SesameAILabs/csm/blob/main/README.md (retrieved 2026-10-12)
- [OR1] OpenRouter, Text-to-Speech guide: https://openrouter.ai/docs/guides/overview/multimodal/tts.md (retrieved 2026-10-12)
- [OR5] Tested 2026-10-12: https://openrouter.ai/api/v1/models?output_modalities=speech (32 models, HTTP 200 without a key)
- [OR7] Tested 2026-10-12: https://openrouter.ai/api/v1/models/{canonical_slug}/endpoints for all 32 speech ids
- [OR10] OpenRouter speech benchmark, Bracketed cue: https://openrouter.ai/benchmarks/media/speech/bracketed-cue (retrieved 2026-10-12)
- [OR11] OpenRouter speech benchmark, Nonverbal cue: https://openrouter.ai/benchmarks/media/speech/nonverbal-cue (retrieved 2026-10-12)
