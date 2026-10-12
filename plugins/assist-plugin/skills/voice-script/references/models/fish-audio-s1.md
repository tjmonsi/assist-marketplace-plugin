# Fish Audio S1

Verified: 2026-10-12. Id: `fish-audio/s1`. "S1 is deprecated and will be retired on December 31, 2026."; afterwards `s1` requests go to `s2.1-pro`, and the API does not convert parenthesis tags to bracket cues [FA1]. Warn the user in the header notes. Served through `POST https://openrouter.ai/api/v1/audio/speech` [OR1].

## Delivery handling

- Style field: none; `instructions` is ignored [OR1].
- Express delivery with the fixed parenthesis tags from the table, plus punctuation. Use parentheses only, and only tags from the table.
- Never write direction lines into the text.
- Header "Model settings": `voice` (id format unconfirmed), `response_format`.

## Tags

Parentheses, fixed set. S2 does not treat them as control tokens [FA2]; OpenRouter's benchmark still heard S2 Pro and S2.1 Pro produce the sigh and laugh for `(sighs)` and `(laughs)` [OR11]. Square brackets remain the S2 rule.

| Tag | Effect | Use | Source |
|---|---|---|---|
| `(angry)`, `(sad)`, `(excited)`, `(surprised)`, `(satisfied)`, `(delighted)`, `(scared)`, `(worried)`, `(upset)`, `(nervous)`, `(frustrated)`, `(depressed)`, `(empathetic)`, `(embarrassed)`, `(disgusted)`, `(moved)`, `(proud)`, `(relaxed)`, `(grateful)`, `(confident)`, `(interested)`, `(curious)`, `(confused)`, `(joyful)` | Basic emotions | yes | FA2 |
| `(disdainful)`, `(unhappy)`, `(anxious)`, `(hysterical)`, `(indifferent)`, `(impatient)`, `(guilty)`, `(scornful)`, `(panicked)`, `(furious)`, `(reluctant)`, `(keen)`, `(disapproving)`, `(negative)`, `(denying)`, `(astonished)`, `(serious)`, `(sarcastic)`, `(conciliative)`, `(comforting)`, `(sincere)`, `(sneering)`, `(hesitating)`, `(yielding)`, `(painful)`, `(awkward)`, `(amused)` | Advanced emotions | yes | FA2 |
| `(in a hurry tone)`, `(shouting)`, `(screaming)`, `(whispering)`, `(soft tone)` | Tone | yes | FA2 |
| `(laughing)`, `(chuckling)`, `(sobbing)`, `(crying loudly)`, `(sighing)`, `(panting)`, `(groaning)`, `(crowd laughing)`, `(background laughter)`, `(audience laughing)` | Sounds | yes | FA2 |

Fish's Emotion Control page lists a slightly different S1 set (for example `(calm)` and `(happy)`) [FA1]; the Models Overview list above is the one used here. OpenRouter's parenthetical prompt used `(sighs)` and `(laughs)`, which are not S1 tags, and S1 produced neither sound [OR11].

## Controls, voices, limits

Same as the S2 file: no style field, `supported_voices` null, no documented text cap; S1 supports 13 languages [FA2, OR5].

- Voices: `supported_voices` is null [OR5]; the `voice` id format is unconfirmed. Voice menu: "Provider default voice" and "A Fish voice id (type it; format unconfirmed)".
- Limits: no documented text cap (unconfirmed) [FA3]; OpenRouter limit unconfirmed. The model retires 2026-12-31 [FA2].

## Pauses and punctuation

No pause tag is listed for S1. Use ordinary punctuation.

## Unconfirmed

- The `voice` id format on OpenRouter.
- Any per-request text limit.

## Sources

- [FA1] Fish Audio, Emotion Control: https://docs.fish.audio/developer-guide/core-features/emotions.md (retrieved 2026-10-12)
- [FA2] Fish Audio, Models Overview: https://docs.fish.audio/developer-guide/models-pricing/models-overview.md (retrieved 2026-10-12)
- [FA3] Fish Audio, Text to Speech endpoint: https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech.md (retrieved 2026-10-12)
- [OR1] OpenRouter, Text-to-Speech guide: https://openrouter.ai/docs/guides/overview/multimodal/tts.md (retrieved 2026-10-12)
- [OR5] Tested 2026-10-12: https://openrouter.ai/api/v1/models?output_modalities=speech (32 models, HTTP 200 without a key)
- [OR11] OpenRouter speech benchmark, Nonverbal cue: https://openrouter.ai/benchmarks/media/speech/nonverbal-cue (retrieved 2026-10-12)
