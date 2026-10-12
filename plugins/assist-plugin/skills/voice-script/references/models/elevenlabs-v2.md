# ElevenLabs v2 family (no audio tags)

Verified: 2026-10-12. Ids: `elevenlabs/eleven-multilingual-v2`, `elevenlabs/eleven-flash-v2`, `elevenlabs/eleven-flash-v2.5`, `elevenlabs/eleven-turbo-v2`, `elevenlabs/eleven-turbo-v2.5`. Served through `POST https://openrouter.ai/api/v1/audio/speech` [OR1]. The five ids share tags, controls, and voices; only the per-request limit differs (see Limits).

## Delivery handling

- Style field: none. `instructions` is ignored [OR1].
- Inline tags: none. Cue words in brackets or parentheses are spoken aloud. Narrative emotion cues are also spoken: "the model will still speak out the emotional delivery guides" [EL2].
- Express delivery through voice choice, wording, and punctuation only. State the delivery in plain words in the header for the user.
- Never write direction lines or bracketed cues into the text.
- Header "Model settings": `voice`, `response_format` (`mp3` or `pcm`).

## Tags

None. ElevenLabs lists audio tags only for v3, v4, and v4 Turbo [EL5]. On OpenRouter all five spoke the cue words in both bracketed and parenthetical prompts (heard as "Whispering" and "Laughs") [OR10, OR11].

| Tag | Effect | Use | Source |
|---|---|---|---|
| None | Not applicable | no | EL5, OR10, OR11 |

## Pause and pronunciation markup

| Markup | Effect | Use | Source |
|---|---|---|---|
| `<break time="1.5s" />` | Natural pause; "The AI can handle pauses of up to 3 seconds"; too many cause instability | only when the user asks (pass-through unconfirmed) | EL4, EL6 |
| `-`, `--`, or an em dash | Short pause; ElevenLabs says a dash "often works well" but is less consistent than break tags | yes | EL4 |
| `...` | Pause that "usually also adds some hesitation or nervousness" | yes | EL4 |
| `<phoneme alphabet="cmu-arpabet" ph="...">word</phoneme>` | Pronunciation; Flash v2 and Turbo v2 only, English only | no (pass-through unconfirmed) | EL2, EL6 |

Whether OpenRouter forwards `<break>` and `<phoneme>` markup to ElevenLabs is unconfirmed.

## Controls

Native speed runs 0.7 to 1.2, default 1.0 [EL2]; OpenRouter `speed` support for these ids is unconfirmed. `instructions` is ignored [OR1].

## Voices

21 names, identical across all nine ElevenLabs ids: `george`, `sarah`, `adam`, `alice`, `bella`, `bill`, `brian`, `callum`, `charlie`, `chris`, `daniel`, `eric`, `harry`, `jessica`, `laura`, `liam`, `lily`, `matilda`, `river`, `roger`, `will` [OR5].

Voice menu: first three listed.

## Limits

| Model id | Characters per request (OpenRouter limit) | Source |
|---|---|---|
| `elevenlabs/eleven-multilingual-v2` | 10,000 | OR8, EL3 |
| `elevenlabs/eleven-flash-v2` | 30,000 | OR8, EL3 |
| `elevenlabs/eleven-flash-v2.5` | 40,000 | OR8, EL3 |
| `elevenlabs/eleven-turbo-v2` | 30,000 | OR8 |
| `elevenlabs/eleven-turbo-v2.5` | 40,000 | OR8 |

OpenRouter states all five limits on the model pages (checked 2026-10-12): "has a 10,000-character request limit" for Multilingual v2, "has a 30,000-character request limit" for Flash v2 and Turbo v2, and "has a 40,000-character request limit" for Flash v2.5 and Turbo v2.5 [OR8]. EL3 lists the same figures for `eleven_multilingual_v2`, `eleven_flash_v2`, and `eleven_flash_v2_5` as ElevenLabs' provider limits.

ElevenLabs states the Turbo models are "functionally equivalent" to the matching Flash models apart from latency [EL3].

## Unconfirmed

- Whether OpenRouter forwards `<break>` and `<phoneme>` markup.
- Whether OpenRouter honors `speed` for these ids.

## Sources

- [EL2] ElevenLabs, TTS best practices (Prompting Eleven v4 and v3, Pauses, Pace): https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices.md (retrieved 2026-10-12)
- [EL3] ElevenLabs, Models and character limits: https://elevenlabs.io/docs/overview/models.md (retrieved 2026-10-12)
- [EL4] ElevenLabs, How can I add pauses?: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-can-i-add-pauses.md (retrieved 2026-10-12)
- [EL5] ElevenLabs, How do audio tags work with Eleven v3 and v4?: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-and-v4.md (retrieved 2026-10-12)
- [EL6] ElevenLabs, Do pauses and SSML phoneme tags work with the API?: https://elevenlabs.io/docs/help-center/technical/do-pauses-and-ssml-phoneme-tags-work-with-the-api.md (retrieved 2026-10-12)
- [OR1] OpenRouter, Text-to-Speech guide: https://openrouter.ai/docs/guides/overview/multimodal/tts.md (retrieved 2026-10-12)
- [OR5] Tested 2026-10-12: https://openrouter.ai/api/v1/models?output_modalities=speech (32 models, HTTP 200 without a key)
- [OR8] OpenRouter model pages, full descriptions: https://openrouter.ai/{model-id}, for example https://openrouter.ai/elevenlabs/eleven-v4 (retrieved 2026-10-12)
- [OR10] OpenRouter speech benchmark, Bracketed cue: https://openrouter.ai/benchmarks/media/speech/bracketed-cue (retrieved 2026-10-12)
- [OR11] OpenRouter speech benchmark, Nonverbal cue: https://openrouter.ai/benchmarks/media/speech/nonverbal-cue (retrieved 2026-10-12)
