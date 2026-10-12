# Qwen-Audio-3.0-TTS

Verified: 2026-10-12. Ids: `qwen/qwen-audio-3.0-tts-flash`, `qwen/qwen-audio-3.0-tts-plus`, served by Alibaba Cloud Model Studio [QW1, OR7]. Served through `POST https://openrouter.ai/api/v1/audio/speech` [OR1].

## Delivery handling

- Style field: none on OpenRouter. The model accepts free-style natural-language instructions natively [QW2, QW3], but OpenRouter ignores `instructions` for non-Gemini providers [OR1].
- Express delivery with inline `[tag]` cues only, from the table below. The full tag list is unconfirmed, so use only the demo examples listed.
- Never write direction lines into the text.
- Header "Model settings": `voice`, `response_format`.

## Tags

Alibaba describes "fine-grained tag control for more accurate control over emotion, tone, character, speaking rate, volume, and synthesis style" [QW1]; the paper counts "86 newly added fine-grained inline tags" covering emotion, style, speed, and non-verbal events such as laughter, breathing, coughing, and sighing [QW2]. Neither publishes the list or syntax. The official demo page shows square brackets [QW3]:

| Tag | Effect | Use | Source |
|---|---|---|---|
| `[excited]`, `[panicked]`, `[amazed]`, `[angry]`, `[mischievously]` | Emotion (demo examples) | yes | QW3 |
| `[laughing]`, `[giggles]` | Laughter (demo examples) | yes | QW3 |
| `[sarcastic, speaking slowly]` | Combined style and speed (demo example) | yes | QW3 |
| `[whispering]` | Honored on OpenRouter in one judged sample per model; not in the demo list | only when the user asks | OR10, OR11 |

The full 86-tag list is unconfirmed. On OpenRouter both models honored `[whispering]` and `[excited]`; Plus also honored `(sighs)` and `(laughs)`, Flash only `(laughs)` [OR10, OR11]. These are one judged sample each and `[whispering]` is not in the demo list, so do not use it unless the user asks.

## Controls

The model accepts free-style natural-language instructions natively [QW2, QW3], but OpenRouter ignores `instructions` for non-Gemini providers [OR1]. Delivery for the skill: inline tags only.

## Voices

- `qwen/qwen-audio-3.0-tts-flash`: `loongjohn`, `longanhuan_v3.6`.
- `qwen/qwen-audio-3.0-tts-plus`: `longanlingxin`, `longanlufeng` [OR5].

Voice descriptions are unpublished (unconfirmed). Voice menu: the two ids listed for the chosen model.

## Limits

Per-request character limit unconfirmed; Alibaba's model page leaves max input length blank [QW1]. The paper reports "one-pass synthesis up to 3 minutes" [QW2] (provider claim; OpenRouter limit unconfirmed).

## Pauses and punctuation

No pause tag is documented. Use ordinary punctuation.

## Unconfirmed

- The full 86-tag list and the syntax for non-verbal events.
- The per-request character limit on OpenRouter.
- Voice descriptions.

## Sources

- [QW1] Alibaba Cloud Model Studio, Qwen-Audio-3.0-TTS-Plus: https://help.aliyun.com/en/model-studio/qwen-audio-3-0-tts-plus (retrieved 2026-10-12)
- [QW2] Qwen-Audio-3.0-TTS paper: https://arxiv.org/html/2607.23938v1 (retrieved 2026-10-12)
- [QW3] Qwen-Audio-3.0-TTS demo page: https://qwenaudio.github.io/FunAudioLLM.github.io/qwen-audio-3.0-tts/ (retrieved 2026-10-12)
- [OR1] OpenRouter, Text-to-Speech guide: https://openrouter.ai/docs/guides/overview/multimodal/tts.md (retrieved 2026-10-12)
- [OR5] Tested 2026-10-12: https://openrouter.ai/api/v1/models?output_modalities=speech (32 models, HTTP 200 without a key)
- [OR7] Tested 2026-10-12: https://openrouter.ai/api/v1/models/{canonical_slug}/endpoints for all 32 speech ids
- [OR10] OpenRouter speech benchmark, Bracketed cue: https://openrouter.ai/benchmarks/media/speech/bracketed-cue (retrieved 2026-10-12)
- [OR11] OpenRouter speech benchmark, Nonverbal cue: https://openrouter.ai/benchmarks/media/speech/nonverbal-cue (retrieved 2026-10-12)
