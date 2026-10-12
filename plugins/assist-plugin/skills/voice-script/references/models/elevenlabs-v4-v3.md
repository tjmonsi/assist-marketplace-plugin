# ElevenLabs v4 and v3 (audio-tag models)

Verified: 2026-10-12. Ids: `elevenlabs/eleven-v4`, `elevenlabs/eleven-v4-turbo`, `elevenlabs/eleven-v3`, `elevenlabs/eleven-v3-conversational`. Served through `POST https://openrouter.ai/api/v1/audio/speech` [OR1]. ElevenLabs states "The same tags work with both models" for v3 and v4, and v4 Turbo "also supports audio tags" [EL5]. The four ids share tags, controls, and voices; only the per-request limit differs (see Limits).

## Delivery handling

- Style field: none on OpenRouter. `instructions` is ignored [OR1].
- Express delivery with inline `[tag]` cues placed where the delivery changes, plus punctuation: "Ellipses (...) add pauses and weight"; "Capitalization increases emphasis" [EL2].
- Never write direction lines into the text.
- Header "Model settings": `voice`, `response_format` (`mp3` or `pcm`).

## Tags

Syntax: a short instruction in square brackets placed where the delivery should change; the set is open-ended ("There are likely many more effective tags beyond this list") [EL5, EL2]. ElevenLabs advises tags that "clearly describe the voice quality you want (e.g. `[low, gravelly voice]`...)" because v4 can read a tag as a sound-effect request [EL2]. Free-form cues are allowed here because the set is open-ended; keep them short and describe delivery or voice quality.

Placement: "typically immediately before the dialogue segment they modify or immediately after", per the enhancer prompt ElevenLabs publishes [EL2].

| Tag | Effect | Use | Source |
|---|---|---|---|
| `[laughs]`, `[laughs harder]`, `[starts laughing]`, `[wheezing]` | Laughter | yes | EL2 |
| `[whispers]` | Whispered delivery | yes | EL2, EL5 |
| `[shouts]` | Shouted delivery | yes | EL5 |
| `[sighs]`, `[exhales]` | Sigh, exhale | yes | EL2, EL5 |
| `[clears throat]` | Throat clearing | yes | EL5 |
| `[sarcastic]`, `[curious]`, `[excited]`, `[crying]`, `[snorts]`, `[mischievously]` | Emotion or reaction | yes | EL2, EL5 |
| `[whispering]`, `[shouting]`, `[laughing]` | Delivery (v4 page examples) | yes | EL1 |
| `[gunshot]`, `[applause]`, `[clapping]`, `[explosion]`, `[swallows]`, `[gulps]` | Sound effects | yes | EL2 |
| `[strong X accent]`, `[sings]`, `[woo]`, `[fart]` | Experimental; "may be less consistent across different voices" | experimental | EL2 |
| `[happy]`, `[sad]`, `[angry]`, `[whisper]`, `[annoyed]`, `[appalled]`, `[thoughtful]`, `[surprised]` | Directions in ElevenLabs' tag-enhancer prompt (non-exhaustive) | yes | EL2 |
| `[chuckles]`, `[short pause]`, `[long pause]`, `[exhales sharply]`, `[inhales deeply]` | Non-verbal entries in the same enhancer list | yes | EL2 |
| Free-form directions such as `[Quiet, measured narration]`, `[Pause, dry amusement]`, `[Brief pause]` | Used in ElevenLabs' v4 examples | yes | EL1, EL2 |

ElevenLabs advises matching tags to the voice: "A serious, professional voice may not respond well to playful tags like `[giggles]` or `[mischievously]`." [EL2].

## Controls

| Control | Values | OpenRouter | Source |
|---|---|---|---|
| Inline tags and punctuation | "Ellipses (...) add pauses and weight"; "Capitalization increases emphasis" | Sent in `input` | EL2 |
| SSML `<break>` | "Eleven v4 and Eleven v3 do not support SSML break tags." | Not applicable | EL2, EL6 |
| Stability, Similarity | v4 settings; "Style and Speed sliders are not available in Eleven v4, and SSML is not supported." | Not exposed; pass-through unconfirmed | EL1, OR9 |
| IPA in slashes, for example `"/ˌbaɪoʊˈkemɪstri/"` | v4 pronunciation | Sent in `input`; behavior through OpenRouter unconfirmed | EL2 |
| `instructions` | Ignored | Ignored | OR1 |

Output on OpenRouter: `mp3` or `pcm` [OR9].

## Voices

21 names, identical across all nine ElevenLabs ids: `george`, `sarah`, `adam`, `alice`, `bella`, `bill`, `brian`, `callum`, `charlie`, `chris`, `daniel`, `eric`, `harry`, `jessica`, `laura`, `liam`, `lily`, `matilda`, `river`, `roger`, `will` [OR5, OR9].

Voice menu: first three listed.

## Limits

| Model id | Characters per request | Source |
|---|---|---|
| `elevenlabs/eleven-v4` | 10,000 | EL3, OR8 |
| `elevenlabs/eleven-v4-turbo` | 10,000 | OR8 |
| `elevenlabs/eleven-v3` | 5,000 | EL3, OR5, OR8 |
| `elevenlabs/eleven-v3-conversational` | 5,000 | OR5, OR8 |

All four figures are OpenRouter limits: each model's OR8 page ends its description with "10,000-character request limit" (v4, v4 Turbo) or "5,000-character request limit" (v3, v3 Conversational). EL3 lists the same figures for `eleven_v4` and `eleven_v3` as ElevenLabs' provider limits.

## Pauses and punctuation

- `...` adds pauses and weight; capitalization adds emphasis [EL2].
- `[short pause]` and `[long pause]` are listed in ElevenLabs' enhancer prompt [EL2].
- SSML `<break>` does not work on v3 or v4 [EL2, EL6]. Do not use it.

## Unconfirmed

- Whether IPA-in-slashes pronunciation works through OpenRouter.
- Whether Stability and Similarity settings can be passed through OpenRouter.

## Sources

- [EL1] ElevenLabs, Eleven v4: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4.md (retrieved 2026-10-12)
- [EL2] ElevenLabs, TTS best practices (Prompting Eleven v4 and v3, Pauses, Pace): https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices.md (retrieved 2026-10-12)
- [EL3] ElevenLabs, Models and character limits: https://elevenlabs.io/docs/overview/models.md (retrieved 2026-10-12)
- [EL5] ElevenLabs, How do audio tags work with Eleven v3 and v4?: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-and-v4.md (retrieved 2026-10-12)
- [EL6] ElevenLabs, Do pauses and SSML phoneme tags work with the API?: https://elevenlabs.io/docs/help-center/technical/do-pauses-and-ssml-phoneme-tags-work-with-the-api.md (retrieved 2026-10-12)
- [OR1] OpenRouter, Text-to-Speech guide: https://openrouter.ai/docs/guides/overview/multimodal/tts.md (retrieved 2026-10-12)
- [OR5] Tested 2026-10-12: https://openrouter.ai/api/v1/models?output_modalities=speech (32 models, HTTP 200 without a key)
- [OR8] OpenRouter model pages, full descriptions: https://openrouter.ai/{model-id}, for example https://openrouter.ai/elevenlabs/eleven-v4 (retrieved 2026-10-12)
- [OR9] OpenRouter per-model API guides: https://openrouter.ai/{model-id}/llms.txt, for example https://openrouter.ai/elevenlabs/eleven-v4/llms.txt (retrieved 2026-10-12)
