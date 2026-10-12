# Mistral Voxtral Mini TTS

Verified: 2026-10-12. Id: `mistralai/voxtral-mini-tts-2603`. Served through `POST https://openrouter.ai/api/v1/audio/speech` [OR1].

## Delivery handling

- Style field: none; `instructions` is ignored [OR1].
- Emotion is chosen by voice id (for example `en_paul_sad` versus `en_paul_happy`) [OR5]. Keep the voice the user chose. When it differs from the delivery answer, name the closer emotion voice from the list in a header note.
- Inline tags: none. Mistral says the voice prompt carries emotion, "no prosody or emotion tags needed", and warns against "markdown, emojis, or special characters" [MI1, MI2]. Write no brackets, parentheses cues, markdown, or emojis.
- Never write direction lines into the text.
- Header "Model settings": `voice`, `response_format`.

## Tags

None; on OpenRouter it spoke the cue words in both bracketed and parenthetical prompts [OR10, OR11].

| Tag | Effect | Use | Source |
|---|---|---|---|
| None | Not applicable | no | MI1 |

## Controls

Emotion is chosen by voice id (for example `en_paul_sad` versus `en_paul_happy`) [OR5]. `instructions` is ignored [OR1].

## Voices

30 ids [OR5]: `en_paul_sad`, `en_paul_neutral`, `en_paul_happy`, `en_paul_frustrated`, `en_paul_excited`, `en_paul_confident`, `en_paul_cheerful`, `en_paul_angry`, `gb_oliver_neutral`, `gb_oliver_sad`, `gb_oliver_excited`, `gb_oliver_curious`, `gb_oliver_confident`, `gb_oliver_cheerful`, `gb_oliver_angry`, `gb_jane_sarcasm`, `gb_jane_confused`, `gb_jane_shameful`, `gb_jane_sad`, `gb_jane_neutral`, `gb_jane_jealousy`, `gb_jane_frustrated`, `gb_jane_curious`, `gb_jane_confident`, `fr_marie_sad`, `fr_marie_neutral`, `fr_marie_happy`, `fr_marie_excited`, `fr_marie_curious`, `fr_marie_angry`.

Cloning is native (`ref_audio`, 3 to 25 s) but not offered on OpenRouter (`supports_voice_cloning` false) [MI2, OR7].

Voice menu: `en_paul_neutral`, `gb_oliver_neutral`, `gb_jane_neutral`, `fr_marie_neutral`.

## Limits

Mistral (provider guidance, not a hard cap): "keep prompts under 300 words for best results" [MI2]. OpenRouter reports a 4,096 context length and 3,276 max completion [OR5, OR7]; what those units mean for TTS is unconfirmed. Segment size for the skill: at most 300 words.

## Pauses and punctuation

No pause markup is documented. Use ordinary punctuation.

## Unconfirmed

- The OpenRouter per-request limit and the meaning of its 4,096 context length.

## Sources

- [MI1] Mistral, Text to Speech: https://docs.mistral.ai/studio/audio/text_to_speech.md (retrieved 2026-10-12)
- [MI2] Mistral, Speech Generation: https://docs.mistral.ai/studio/audio/text_to_speech/speech.md (retrieved 2026-10-12)
- [OR1] OpenRouter, Text-to-Speech guide: https://openrouter.ai/docs/guides/overview/multimodal/tts.md (retrieved 2026-10-12)
- [OR5] Tested 2026-10-12: https://openrouter.ai/api/v1/models?output_modalities=speech (32 models, HTTP 200 without a key)
- [OR7] Tested 2026-10-12: https://openrouter.ai/api/v1/models/{canonical_slug}/endpoints for all 32 speech ids
- [OR10] OpenRouter speech benchmark, Bracketed cue: https://openrouter.ai/benchmarks/media/speech/bracketed-cue (retrieved 2026-10-12)
- [OR11] OpenRouter speech benchmark, Nonverbal cue: https://openrouter.ai/benchmarks/media/speech/nonverbal-cue (retrieved 2026-10-12)
